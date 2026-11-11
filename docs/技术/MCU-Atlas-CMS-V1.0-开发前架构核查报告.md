# MCU Atlas CMS V1.0 · 开发前架构核查报告

> ⚠ **本文已被《MCU-Atlas-CMS-V1.0-架构修订报告-V2.0.md》部分取代（2026-11-09）**。
> 事实层（服务器、H5、数据、SEO 现状、资讯/社区边界）仍然有效；
> **设计层以下章节以 V2.0 为准**：§9.3 发布权限（setuid 作废）、§9.4 脚本校验（与 JSON-LD 冲突）、
> §9.5/§9.6 冻结集与 sitemap（分类重叠）、§9.4 分页（`?page=n` 缺陷）、§11.2 robots 分组（RFC 9309 语义）、
> §7.3 修订表（字段不全）、§13.5 权限落地（不可实现）。冲突时一律以 V2.0 为准。

| 项 | 值 |
|---|---|
| 文档版本 | V1.0（只读核查版，非开发交付） |
| 核查日期 | 2026-11-09 |
| 执行方 | CodeBuddy（开发 AI） |
| 任务性质 | **只读核查 + 技术可行性分析**。**未做任何开发、未部署、未安装依赖、未修改任何生产文件** |
| 核查方式 | ① 本地仓库源码阅读（`h5/`、`shared/`、`docs/`）；② 生产服务器 SSH **只读命令**（`ls/cat/grep/ss/df/free/systemctl cat/curl -I` 等）；③ 线上 HTTP **只读探测**（HEAD/GET，仅取状态码与已有公开内容） |
| 核查对象 | `https://www.mcuatlas.xyz`（首选域，2026-11-09 已统一 www）、`/www/wwwroot/mcu-h5/`、`/www/wwwroot/forum-api/`、`/www/wwwroot/mcu-atlas-news/` |
| 未做的事 | 未改 Nginx / 未改 Forum API / 未改资讯流水线 / 未改小程序与 shared 数据 / 未 Git 操作 / 未装依赖 / 未起进程 / 未读取任何密钥内容 / 未做生产部署 |

> **本报告的证据等级约定**（第 16 章有完整矩阵）：
> - **【核实】** = 已在本次核查看见的客观事实（命令输出 / 源码 / HTTP 响应）。
> - **【建议】** = 基于事实给出的方案建议，尚未实现、未验证。
> - **【待验证】** = 需要额外条件（改配置、装依赖、访问控制台、真实浏览器/爬虫环境）才能确认，本次**主动停止**。

---

## 0. 结论摘要（先看这 8 条）

1. **架构结论：可以做，且能零 npm 依赖、零 nginx 改动（后台走 SSH 隧道）落地。** 现有 Forum API 已经跑通「Node 24 + `node:http` + `node:sqlite`(WAL) + systemd + 反代」这条技术路线，CMS 直接复用同栈即可，不需要引入框架、数据库服务或构建工具链。【核实】
2. **真正的约束不是端口，是内存。** 服务器 2 vCPU / 896 MiB 内存，**当前可用仅约 146 MiB**（`MemAvailable: 149552 kB`），另有 1 GiB swap（已用 192 MiB）。占用大头是**与本项目无关的 WordPress 站**（3 个 php-fpm 各约 100 MB）+ MariaDB 118 MB。CMS 服务本身可压到 20–30 MB，但**同机跑构建 + 后台 + 现有服务会踩 OOM 边缘**，必须限内存、串行构建、后台不常驻重量级进程。【核实】
3. **Nginx 现有规则天生支持 CMS 静态页，不用改一行配置。** `location / { try_files $uri $uri.html $uri/ =404; }` 意味着 `/article/<slug>` 与 `/article/<slug>.html` 都能命中 `mcu-h5/article/<slug>.html`。文章目录可以放在现有 root 下，原子发布用「目录符号链接切换」实现。【核实】
4. **有一个必须避开的硬坑：`/api/` 已被论坛 API 独占。** 现有 `location ^~ /api/ → 127.0.0.1:8787`，`^~` 优先于正则。**CMS 的接口绝对不能放在 `/api/cms/*`**，否则请求会被打到论坛服务并返回 404。CMS 必须使用独立前缀（建议 `/cms/`）或 V1 干脆不开放公网路径、只走 SSH 隧道。【核实】
5. **现有 H5 的 SEO 是「模板写死 + JS 运行时补」的混合模式。** ID 参数页（`movie/route-detail/special/news-detail/routes`）的 title/description 靠页面内联脚本运行时改写，canonical 靠 `app.js` 的 `injectSeoTags()` 运行时注入；**爬虫不执行 JS 时，38 个作品页共享同一个泛化标题、4 类参数页无 canonical**。这正是 CMS 静态生成最有价值的改造点，但**V1 不回头改这 15 个页面**（保护范围）。【核实】
6. **JSON-LD 当前为 0，OG 只有运行时注入且无 `og:image`，robots.txt 只有一组 `User-agent: *`。** GEO 的基础设施基本是空白，属于「新增」而非「改造」，风险低、收益明确。【核实】
7. **Sitemap 存在双写冲突风险。** 现有 `h5/tools/generate-sitemap.cjs` 是 `sitemap.xml` 的**唯一所有者**（本地工具、`--check` 校验、76 条 URL、数据为空或含未上映会拒绝生成）。CMS 若自己写 sitemap 会互相覆盖。**结论：必须扩展这个工具而不是新增第二个生成器**，并加「URL 只增不减」守卫。【核实 + 建议】
8. **有两个时间敏感风险需要 owner 决策，不属于本任务范围但必须上报：**
   - **证书 2026-12-14 到期**（`notAfter=Dec 14 23:59:59 2026 GMT`），且**不在 acme.sh 托管范围内**（acme 只管 `mcu.yaokaixin.top` / `mcu.yaoqiang.xin` / `yaoqiang.xin`），需手动续签 + 部署。距今约 35 天。
   - **WordPress 遗留站仍在吃资源**（`/www/wwwroot/wordpress` 177 MB、`yaoqiang.xin.log` 159 MB、php-fpm 3 workers ≈ 300 MB、MariaDB 118 MB），且 `127.0.0.1.conf` 仍以它作 `default_server`。CMS 上线的内存空间本质上要从这里挤。

**一句话结论**：CMS V1 技术可行，推荐「独立 Node 服务 + SQLite(WAL) + 构建期静态生成 + 目录符号链接原子发布 + 后台仅本机/SSH 隧道访问」，**首版 18–22 人日**，最大风险是内存与证书，不是架构。

---

## 1. 当前真实技术架构

### 1.1 端到端拓扑（全部【核实】）

```
                 ┌──────────────────────────────────────────────┐
  用户/爬虫 ──▶  │ Nginx 1.26.3（宝塔，www:www）                 │
                 │  :80  全部主机名 → 301 https://www.mcuatlas.xyz│
                 │  :443 www.mcuatlas.xyz  ← 业务站              │
                 │  :443 mcuatlas.xyz      ← 301 → www           │
                 │  :888  :8888            ← 宝塔面板（0.0.0.0）  │
                 └───────┬──────────────────────┬───────────────┘
                         │ root                 │ ^~ /api/
                         ▼                      ▼
        /www/wwwroot/mcu-h5/            127.0.0.1:8787
        （纯静态 15 页 + assets + data）  mcu-forum-api.service
        15 MB / 179 文件                  Node 24.9.0 · node:sqlite WAL
                                          User=forumapi · MemoryMax=150M
                                          RSS 12.7 MB · 已运行 1 月 24 天

   旁路（CLI，无常驻进程）：
   /www/wwwroot/mcu-atlas-news/workspace/news/
     collectors → captures(L0) → candidates(L1,AI) → gate/review(G6)
     → deliveries → news-append-writer → mcu-h5/data/news.js（append-only）
   cron 08:00 仅 production-capture（三源 S002/S004/S006，flock 防重叠）

   遗留（与本项目无关）：
   /www/wwwroot/wordpress（177 MB）+ MariaDB 3306 + 3× php-fpm
```

### 1.2 关键事实清单

| 项 | 实测值 | 证据 |
|---|---|---|
| 域名解析 | `www.mcuatlas.xyz → 8.137.48.145`（即本机，无 CDN 层） | `getent hosts` |
| Web 根 | `/www/wwwroot/mcu-h5`（属主 `www:www`，755） | `ls -la` |
| 静态资源 | `assets/` 15 MB（posters 7.7 MB / stills 3.7 MB / avatars 448 KB / phases 296 KB / miniprogram 224 KB / css 184 KB / js 180 KB） | `du -sh` |
| 页面 | 15 个 `.html`（含百度验证文件）；`sitemap.xml` 76 条；`robots.txt` 5 行 | `ls` / `curl` |
| H5 技术形态 | 纯静态多页、无构建、ES5 IIFE、`window.MCU_*` 全局数据、单核心 `app.js`(81 KB/1627 行) + `components.js`(41 KB/820 行) + `forum.js`(33 KB/655 行) | 源码 |
| 论坛后端 | 零 npm 依赖；`node:http` 自建路由表 + `node:sqlite` `DatabaseSync`；WAL + `busy_timeout=5000` + `synchronous=NORMAL`；5 张表；admin token 文件 0600 | `server.js` / `database.js` / `schema.sql` |
| 资讯流水线 | 全文件型（captures/candidates/deliveries/review/run-history），无数据库、无常驻进程；cron 只做采集；`scheduler.config.cjs` 中 `enabled=false / autoProduction=false / productionAllowed=false` | 源码 + cron + 配置 |
| 数据副本 | `shared/data`(11) → 同步到 `wechat/data`、`douyin/data`；**`h5/data` 不在同步脚本内**（格式不同，走人工适配） | `sync_data.sh` |

### 1.3 现有 Nginx 规则要点（CMS 必须对齐的部分）

```nginx
# /www/server/panel/vhost/nginx/mcuatlas.xyz.conf（2026-11-09 版）
location ~* \.html$            { add_header Cache-Control "no-cache, must-revalidate"; }
location = /data/news.js       { no-cache }
location ~* ^/data/.*\.js$     { no-cache }     # 必须在上方通用 .js 规则之前
location ~* ^/assets/js/.*\.js$ { no-cache }
location ~* \.(css|js|json)$   { expires 7d; }
location ~* \.(jpg|png|webp|svg|ico|woff2?|ttf)$ { expires 30d; }
location ^~ /api/              { limit_req zone=forum_api_atlas burst=20 nodelay;
                                 proxy_pass http://127.0.0.1:8787; ... }
location /                     { try_files $uri $uri.html $uri/ =404; }
```

**由规则直接推导出的 4 个结论【核实 + 推导】**：
1. `/article/<slug>` 与 `/article/<slug>.html` 都可 200（前者经 `try_files` 内部重写到 `.html`），**无需新增 location**。
2. **没有自定义 404 页**（`=404` 走 nginx 默认页），也没有任何 301 规则（除 80→443、非 www→www）。**slug 改名的真正 301 无法零配置实现**（见 §10.6）。
3. `.js` 与 `/data/*.js`、`/assets/js/*.js` 已被设为 `no-cache`——CMS 若新增前端 JS，应放在 `/assets/js/` 之外的独立目录（例如 `/article/assets/`）以免继承 `no-cache`；静态文章页的 `.html` 也是 `no-cache`，符合发布即生效的诉求。
4. `^~ /api/` 的 `^~` 会**截断正则 location**，所以 CMS 路由必须换前缀（见 §0 第 4 条）。

---

## 2. 服务器资源与运行环境

### 2.1 系统【核实】

| 项 | 值 |
|---|---|
| 系统 | Alibaba Cloud Linux 3 (OpenAnolis Edition)，`ID_LIKE="rhel fedora centos anolis"` |
| 内核 | `5.10.134-19.1.al8.x86_64` |
| 主机名 | `iZ2vc84qp0oamyzsg87hsaZ` |
| CPU | 2 vCPU |
| 运行时长 | 159 天 |
| 时区 | CST（`Mon Nov 9 15:59:10 PM CST 2026`） |
| 控制面板 | 宝塔 BT-Panel（`:8888`，监听 `0.0.0.0`）、BT-Task |

### 2.2 资源实况【核实】

| 指标 | 值 | 判断 |
|---|---|---|
| 内存总量 | 918,012 kB ≈ **896 MiB** | 小 |
| 内存可用 | **149,552 kB ≈ 146 MiB** | **紧** |
| Swap | 1,048,572 kB 总 / 847,472 kB 空闲（已用 192 MiB） | 有兜底但会拖慢 |
| `vm.swappiness` | 0 | 尽量不换出，OOM 前更危险 |
| 磁盘 | `/dev/vda3` 30 G，已用 12 G，**可用 16 G（43%）** | 充足 |
| inode | 未单独核查（ext4 30 G 常规不会先耗尽） | 【待验证】低风险 |
| 负载 | `0.06, 0.01, 0.00` | 空闲 |

**内存占用前 6 名【核实】**：

| 进程 | 用户 | RSS | 归属 |
|---|---|---|---|
| mariadbd | mysql | 118.8 MB (12.9%) | 宝塔/WordPress |
| php-fpm: pool www ×3 | www | ≈100 MB ×3 | WordPress（yaoqiang.xin） |
| BT-Task | root | 49.7 MB | 宝塔面板 |
| AliYunDunMonitor | root | 42.2 MB | 阿里云安全组件 |
| nginx worker ×2 | www | ≈30 MB + 26 MB | 本项目 |
| mcu-forum-api（node） | forumapi | **12.7 MB** | 本项目 |

> **重要判断**：本项目自身占用很小（nginx 2 进程 + forum 12.7 MB ≈ 70 MB）。**没有余量是 WordPress 遗留站造成的**。CMS 上线前需要 owner 决策：是否停掉 WordPress/php-fpm（可释放约 400 MB）。**本报告不执行、不建议擅自停服**，仅列为资源前置项。

### 2.3 端口实况【核实】

| 端口 | 监听 | 进程 | 用途 |
|---|---|---|---|
| 22 | 0.0.0.0 | sshd | SSH |
| 80 | 0.0.0.0 | nginx | 301 → https://www |
| 443 | 0.0.0.0 | nginx | 业务站 + `/api/` 反代 |
| 888 | 0.0.0.0 | nginx | 宝塔 phpMyAdmin 入口 |
| 8888 | 0.0.0.0 | BT-Panel | 宝塔面板 |
| 3306 | 0.0.0.0 | mariadbd | MariaDB（对外监听） |
| 8787 | **127.0.0.1** | node（forum-api） | 论坛 API，仅本机 |

**8790 等端口"空闲"不是部署可行性证明**，理由见 §14 风险 R1。本机 `iptables INPUT` 策略为 `ACCEPT` 且无规则，实际端口暴露由**阿里云安全组**控制，**安全组规则本次无法核查（无控制台权限）→【待验证】**。

### 2.4 Node / npm / SQLite【核实】

| 项 | 值 |
|---|---|
| Node | `/opt/node24/bin/node` → **v24.9.0**（系统 PATH 中**没有** `node`） |
| npm | `/opt/node24/bin/npm` 存在，但 shebang 为 `#!/usr/bin/env node` → **直接执行报 `env: 'node': No such file or directory`**，须 `PATH=/opt/node24/bin:$PATH` |
| Node 内建模块 | `node:sqlite` **可用**（forum-api 已生产运行）；`process.versions.sqlite = 3.50.4`；openssl 3.5.3；icu 77.1 |
| 系统 SQLite CLI | `sqlite3 3.26.0 (2018-12-01)`，`sqlite-libs/sqlite/sqlite-devel 3.26.0-20.al8` |
| 项目内 npm 依赖 | **无**（`forum-api` 无 `node_modules`；H5 与资讯流水线均零依赖） |

> **兼容性结论**：CMS 用 `node:sqlite`（SQLite 3.50.4）建库没问题；但**备份若用系统 `sqlite3 3.26` 的 `.backup`，需避免使用 3.37+ 的 `STRICT` 表**（旧 CLI 解析 schema 会报错）。现有 `backup-forum.sh` 用 `.backup` 且工作正常（每日 03:30 产出文件），说明普通表结构互通。【核实 + 推导】

### 2.5 权限与属主【核实】

| 路径 | 属主:组 | 权限 | 说明 |
|---|---|---|---|
| `/www/wwwroot/mcu-h5` | `www:www` | 755 | CMS 若要写入，需要更精细的授权方案（见 §12） |
| `/www/wwwroot/mcu-h5/data/news.js` | `root:root` | 644 | 资讯写入器以 root 执行 |
| `/www/wwwroot/forum-api` | `forumapi:forumapi` | 755 | 专用系统用户（`uid 995`，`/sbin/nologin`） |
| `/www/wwwroot/mcu-atlas-news` | `root:root` | 755 | 流水线工作区，`h5` 为软链 → `mcu-h5` |
| `/www/backup/forum-db` | `root:root` | — | 备份目录，**不在任何 Web root 下** |

**现有纪律**：`data/`、`review/backup/`、`/www/backup/` 一律不在 Web root 之内。CMS 必须沿用（数据库与媒体原件不得落在 `mcu-h5` 下）。

### 2.6 Nginx 结构与缓存【核实】

- 主配置：`/www/server/nginx/conf/nginx.conf`（`gzip on`、`gzip_comp_level 5`、`client_max_body_size 50m`、`keepalive_timeout 60`）
- 站点：`/www/server/panel/vhost/nginx/`（`mcuatlas.xyz.conf` 为本项目；`mcu.yaokaixin.top.conf` 旧域保留作小程序图片 CDN；`127.0.0.1.conf` 为 WordPress `default_server`；`yaoqiang.xin-https.conf` 同为 WordPress）
- HTTPS：TLSv1.2/1.3，HSTS `max-age=31536000`，证书 `CN=www.mcuatlas.xyz`（DigiCert DV，SAN 含 `mcuatlas.xyz`）
- 证书有效期：**2026-09-16 → 2026-12-14**（35 天）【核实】
- 证书自动续签：**未覆盖**。`/root/.acme.sh/` 下只有 `mcu.yaokaixin.top_ecc`、`mcu.yaoqiang.xin_ecc`、`yaoqiang.xin_ecc`；crontab 有 acme 定时任务，但**不含 mcuatlas.xyz**。【核实】

### 2.7 CMS 独立服务的资源需求评估（结论）

| 项 | 估算 | 依据 |
|---|---|---|
| CMS 常驻进程 RSS | **20–35 MB**（Node 24 + 单例 SQLite） | forum-api 实测 12.7 MB；CMS 多一个 HTTP 层与模板函数，按 2–3 倍估 |
| 构建进程（发布时，秒级） | **60–110 MB 峰值**，`--max-old-space-size=128` 限制 | 读取 59+3 条内容数据（`vm` 沙箱）+ 全量文章 Markdown → HTML 字符串 |
| 磁盘 | 代码 < 2 MB；DB < 20 MB（千篇文章级）；媒体按上传量 | 余量 16 G，可忽略 |
| 并发 | 单管理员，无并发压力 | — |
| 结论 | **可部署，但必须**：① `MemoryMax` 硬限；② 构建串行（flock）；③ 不与资讯采集 cron 同时段；④ 后台不引入前端构建/SSR 框架 | — |

---

## 3. 当前 H5 页面与数据结构

### 3.1 页面组织【核实】

| 页面 | 类型 | 数据来源 | TDK 方式 |
|---|---|---|---|
| `index.html` | 静态单页内容流（8 个 section） | `data/*.js` 13 个 + 内联脚本 | 静态写死 + 运行时 OG |
| `routes.html` | 列表 | `MCU_ROUTES` | 静态 + 内联改写 |
| `route-detail.html?id=` | 参数页 | `MCU_ROUTES` + `expandRoute()` | 内联脚本按路线改写 title/desc |
| `movie.html?id=` | 参数页 | `MCU_CONTENT_ALL` | 内联脚本按作品改写 title（**desc 不改**） |
| `special.html?id=` | 参数页（专题） | `MCU_SPECIAL_ROUTES` | 内联脚本按专题改写 title/desc |
| `news.html` | 列表 | `MCU_NEWS`（前端切片 10/批） | 静态 |
| `news-detail.html?id=` | 参数页 | `MCU_NEWS` | 内联改写 + **`noindex`** |
| `next.html` | 工具（下一部看什么） | `MCU_CONTENT` + 本地存储 | 静态 |
| `map.html` / `map-pc.html` | 全景关系图 | `MCU_RELATIONS` | 静态（`map-pc` 无 canonical） |
| `community / topic-detail / post-create / my-community` | 论坛壳页 | `/api/`（`forum.js`） | 静态，无 canonical |
| `baidu_verify_codeva-IsGpEVEsix.html` | 验证文件 | — | — |

### 3.2 公共组件与 CSS/JS 分层【核实】

- **CSS 5 个文件，174 KB 未压缩**：`style.css`(77.6 KB，含 `:root` 全部设计 Token)、`v2.css`(44.5 KB)、`v2n-news.css`(14 KB)、`v3-forum.css`(20.7 KB)、`v1-special.css`(17.4 KB)。
- **JS 3 个文件**：`app.js`（`MCU.data` 索引查询 / `MCU.progress` 本地进度 / `MCU.rec` 推荐 / `MCU.ui` 公共渲染，`ui.mount()` 挂载 nav+foot 并注入 SEO）、`components.js`（`MCU.v2` 组件：`movieCard / timeline / newsCard / newsDetail / sortNews / relatedNodes / sourceLine` 等 24 个）、`forum.js`。
- **数据挂载方式**：`window.MCU_*` 全局变量（为了 `file://` 双击可运行，所以不用 `fetch`+JSON）。**这是 CMS 必须尊重的前提**：不要引入需要 HTTP 才能工作的数据加载方式到现有页面。
- **单页负载**：首页约 **343 KB JS + 174 KB CSS**（未压缩，gzip 后约 1/3）。**CMS 文章页不应复用这套数据脚本**，否则每篇文章都要背 343 KB。

### 3.3 数据加载机制与「静态/运行时」边界【核实】

| 内容 | 是否在 HTML 源码里 | 说明 |
|---|---|---|
| 页面骨架、标题区、文案 | ✅ 在源码 | 各页 `<main>` 里的 section 与静态文案 |
| 作品/路线/角色/关系/资讯列表 | ❌ 运行时渲染 | 由内联脚本 `innerHTML` 注入 |
| 角色/关系/资讯详情正文 | ❌ 运行时渲染 | `movie.html` / `news-detail.html` |
| nav / footer | ❌ 运行时（`app.js`） | 爬虫看到的是空 `<div id="app-nav">` |
| canonical（参数页） | ❌ 运行时 | `injectSeoTags()`，`setTimeout(0)` |
| OG | ❌ 运行时 | 同上 |

**这意味着**：现状是「**壳在源码里，内容不在**」。搜索/AI 抓取不执行 JS 时，得到的是**同质模板 + 空列表**。CMS 的价值恰恰是把「内容进源码」这件事在新页面上做对，而**不是**去重构现有 15 页。

### 3.4 数据结构全表【核实】

统计口径：`h5/data/*.js` 经 `vm` 加载后取全局变量（本地与线上完全一致：released 59 / all 62 / news 54）。

| 文件 | 全局变量 | 条目 | 说明 |
|---|---|---|---|
| `movies.js` | `MCU_MOVIES` | **40**（38 已上映 + 2 未上映） | 院线电影主数据 |
| `series.js` | `MCU_SERIES` | 15（14 + 1 未上映 `visionquest`） | 剧集元信息 |
| `special.js` | `MCU_SPECIAL` | 2 | 特别呈现 |
| `short.js` | `MCU_SHORT` | 5 | 短片 |
| `content.js` | `MCU_CONTENT` / `MCU_CONTENT_ALL` | **59 / 62** | **合成器**（不是文案表） |
| `characters.js` | `MCU_CHARACTERS` | **25** | 角色骨架 |
| `relations.js` | `MCU_RELATIONS` | **92** 条边 | 关系图 |
| `routes.js` | `MCU_ROUTES` | **11** | 观影路线 |
| `special-routes.js` | `MCU_SPECIAL_ROUTES` | **1** | 专题（复联5补课） |
| `upcoming.js` | `MCU_UPCOMING` | **4** | 未来计划 |
| `news.js` | `MCU_NEWS` + `MCU_NEWS_META` | **54** | 资讯，33 字段/条 |
| `posters.js` / `stills.js` / `visuals.js` | 映射与 `MCU_VISUAL(id)` | 38 海报 / 38 剧照 | 图片单一入口 |
| `community.js` | — | 1.6 KB | 论坛常量 |

#### 3.4.1 作品唯一 ID 规则【核实】

- **人写 kebab-case 语义 slug**，如 `iron-man`、`captain-america-first-avenger`、`one-shot-the-consultant`。
- **同一命名空间**：电影/剧集/特别呈现/短片合并在 `MCU_CONTENT_ALL`，**跨类型必须全局唯一**（否则 `MCU.data.get(id)` 冲突）。
- **无前缀、无数字号、无版本**。`movies.js` 头部注释明确纪律：「只增字段、不改 id」。
- **ID 被复用为**：URL 参数（`movie.html?id=`）、关系表外键（`relations.from/to`）、角色反查键（`chars[]`、`characters.first`）、路线条目（`routes.items[]`）、专题节点（`special-routes.core/full.items[]`）、图片映射键（`posters/stills`）、资讯关联（`related_movies/related_series`）。
- **未上映条目**（`doomsday` / `secretwars` / `visionquest`）保留 ID 但 `ro/co = null`，不进入路线与统计。

> ⚠ **对 CMS 的直接含义**：作品 ID 是**跨 6 个数据文件 + 3 处 URL 的主键**。CMS **只能读、不能写**，也不能自己生成新作品 ID（治理铁律：数据单一源、不得丢入 CMS 让用户自改）。

#### 3.4.2 人物唯一 ID 规则【核实】

`characters.js` 仅 **6 个字段**：`id, cn, en, camp, first, note`。

- `id`：人写 slug（`tony`、`steve`、`ultron`），**被 `movies.chars[]` 反向引用**。
- `camp`：8 类（`avengers/guardians/asgard/wakanda/shield/mutant/villain/street`）。
- `first`：首次登场作品 id。
- **缺**：头像、别名、出生/身份、来源、外部 ID（如 Wikidata/TMDB）、简介长度。**这层数据对 SEO/GEO 的「实体」需求偏薄**，属「需要后续适配」而非「可直接引用」。

#### 3.4.3 关系结构【核实】

```js
{ from: 'iron-man', to: 'avengers', type: 'setup', weight: 3, why: '...必填长文案...' }
```

- 无向边，页面查询同时匹配 `from`/`to`（不写反向边）。
- `type ∈ { sequel, prereq, character, setup, event, world }`（6 类）。
- `weight ∈ 1..3`（地图线宽与力导向强度）。
- `why` **必填且禁止套话**（产品铁律）。

#### 3.4.4 路线与专题关联方式【核实】

- `routes.js`：11 条，`kind ∈ {basic, topic}`；`generator ∈ {release, chrono, mainline, essential}` 时 `items: []` 由 `app.js` 现算；手写路线用 `items: [workId...]`。
- `special-routes.js`：1 条（`avengers-doomsday`），结构为 `upcomingId + origin + core{items[]} + full{items[]\|null} + chain[5] + entry`。**只存引用**：作品名运行时 `MCU.data.get(workId).cn` 读取，**禁止复制作品数据、禁止硬编码片名/日期**。
- **关联键统一是作品 id**，没有中间表。

#### 3.4.5 资讯数据结构（33 字段）【核实】

一条资讯 = `id`(news-YYYY-MM-DD-NNN) / `title` / `summary` / `publish_time` / `first_seen_at` / `verification_status`(八态) / `category` / `reported_by[{source_name, source_url, owner_group}]` / `independent_group_count`(派生) / `original_source(_url)` / `official_source(_url)` / `related_movies[]` / `related_series[]` / `related_characters[]` / `related_phases[]` / `pinned(+until/order/reason)` / `status_history[]` / `status_changed_at` / `status_change_reason` / `status_change_evidence_url` / `supersedes_id` / `superseded_by_id` / `report_corrections[]` / `conflict_statements[]` / `judged_by` / `chain_steps_hit` / `conflict_resolved_at` / `conflict_resolved_by_evidence_url`。

> 这套 schema 的「来源可追溯」程度**高于**典型 CMS 文章模型（有多源、有 owner_group 去重计数、有状态变更链、有更正记录）。CMS 的 `sources` 设计应向它看齐，但**不得反向改写它**。

#### 3.4.6 内容之间的关联关系图（可直接被 CMS 引用 vs 需适配）

| 关联 | 实现方式 | CMS 可直接引用？ |
|---|---|---|
| 作品 ↔ 角色 | `movie.chars[]` ↔ `characters.first` | ✅ 读 `chars[]` 即可，双向可查 |
| 作品 ↔ 作品 | `relations` 92 边 + `movie.next[]` | ✅ |
| 路线 ↔ 作品 | `routes.items[]` 或 generator | ✅ |
| 专题 ↔ 作品/未上映 | `special-routes.*.items[]` + `upcomingId` | ✅ |
| 资讯 ↔ 作品/角色/阶段 | `related_*[]` | ✅ |
| 作品 ↔ 图片 | `posters/stills` 映射键 = 作品 id | ✅ |
| 角色 ↔ 角色 | **无**（`characters.note` 里只有散文） | ❌ 需新增（治理待定） |
| 作品 ↔ 外部 ID（IMDb/TMDB/Wikidata） | **无** | ❌ 需新增（GEO 实体对齐的关键缺口） |
| 作品 ↔ 来源 | `source/source_type/source_url/verified_at/confidence`（`content.js` 统一注入 5 字段） | ✅ 但粒度粗（全站同一默认源） |
| 文章 ↔ 任意实体 | **不存在** | ❌ CMS 新增 `cms_article_entities` |

---

## 4. 当前 SEO 实现情况（逐项实测）

| 能力 | 现状 | 证据/细节 | 判断 |
|---|---|---|---|
| 每页独立 `<title>` | ✅ 15 页各有静态 title | 见 §3.1 | 已有 |
| 参数页独立 title | ⚠️ **仅运行时** | `movie.html` 内联 `document.title = m.cn + ' - MCU 宇宙导航'`；`route-detail`/`special`/`news-detail` 同 | 爬虫不执行 JS 时**全站 38 个作品页共享泛化标题** |
| `meta description` | ✅ 静态；参数页 2 处运行时可改（`route-detail`、`special`、`news-detail`） | `movie.html` **不改 description**（38 页同一条） | 部分覆盖 |
| `meta keywords` | 仅 6 页有 | `index/map/movie/routes/next/news` | 现代搜索引擎权重≈0，保留无害 |
| `link rel=canonical` | **5 页静态**（`index/map/news/next/routes`，带 `data-static="1"`）+ **4 类参数页运行时注入** | `app.js` `injectSeoTags()`，`CANON_ORIGIN` 硬编码 `https://www.mcuatlas.xyz`，`KEEP` 白名单保留 `?id=`、清洗其余参数；`/index.html→/`、`/special→/special.html` 归一 | 机制正确但**依赖 JS**；`special.html`/`movie.html`/`route-detail.html`/`news-detail.html`/`community*` 源码内**无** canonical |
| `meta robots` | 仅 `news-detail.html` → `noindex` | 全站其余 `index,follow`（缺省） | 缺分类/标签级策略 |
| OG 标签 | ⚠️ **仅运行时**注入 `og:title/description/url/type/site_name` | 无 `og:image`、无 `twitter:card`、无静态 OG | 社交分享无图 |
| JSON-LD 结构化数据 | **0** | `grep -c ld+json *.html` = 0 | 全缺 |
| Sitemap | ✅ 76 条，`h5/tools/generate-sitemap.cjs` 生成 | 无 `lastmod/changefreq/priority`；`--check` 可校验；含守卫（模板缺失/未上映混入/重复 URL/空数据一律拒绝） | 机制好，但**手工跑**、无文章体系 |
| `robots.txt` | 5 行：`User-agent: *` / `Allow: /` / `Disallow: /api/` / `Sitemap:` | 无分爬虫组 | AI 爬虫默认全允许 |
| 分类页/文章页 URL | ❌ 不存在 | `/blog/`、`/article/` 均 404 | 全新 |
| 301 重定向（slug 改名） | ❌ 无任何机制 | Nginx 仅 80→443、非 www→www；`h5/_redirects` 是 Cloudflare Pages 时代遗留，ECS 不读取 | 需新增（代价见 §10.6） |
| 重复内容检测 | ❌ 无 | — | 需新增 |
| 发布/下架机制 | ❌ 无 | 全站手工部署 | 需新增 |
| `hreflang` | ❌ 无（单语站，合理） | — | 不需要 |
| 404 处理 | nginx 默认 404 页 | 无自定义页 | 可接受 |
| 统计/埋点 | CloudBase Web SDK 匿名写（`MCU.stats` / `FeedbackUI`），离线本地队列兜底 | 无服务端日志分析 | 与 CMS 无关 |

**综合判断**：现有 SEO 是「**能写死就写死，写不死的运行时补**」的务实方案，**对已索引的 76 条 URL 没坏处**，但：
- 不执行 JS 的抓取器看到的是**同质页面**（这点对 AI 检索尤其致命）；
- **没有任何结构化数据**，实体/文章语义全靠自然语言；
- **文章体系为零**，所以 CMS 是「**增量做对**」而不是「改造存量」——这是本项目最省力的一点，也是必须守住的边界（V1 不动现有 15 页）。

---

## 5. 资讯与社区系统边界

### 5.1 资讯流水线现状【核实】

| 环节 | 实现 | 产物 |
|---|---|---|
| 采集 | `runner/run-n1.cjs --mode production-capture --sources S002,S004,S006 --persist` | `pipeline/captures/YYYYMMDD.captures.json`（当前 30 个文件） |
| 触发 | `/etc/cron.d/mcu-atlas-capture`，每日 08:00，`flock -n` 防重叠，显式 `source /etc/mcu-atlas/dashscope.env` | `/var/log/mcu-atlas-capture.log` + logrotate |
| 候选 | `tools/captures-to-candidates.cjs`（真实 AI，`timeoutMs` 需 60000） | `candidates/` |
| 审核 | `tools/gate-review.cjs list/approve/reject`（经 `review-actions.cjs` + `gate.cjs` 复核，**禁绕 G6**） | `review/`、`review-history.json` |
| 交付 | `deliver-and-map.cjs` → delivery-preview（33 字段） | `deliveries/`（9 个） |
| 发布 | `tools/news-append-writer.cjs`：SHA256 基线 + 双备份 + **append-only** + `vm` 预验证/复核 + 幂等 state | `h5/data/news.js`（54 条，110 KB） |
| 回滚 | 备份 `.bak-<ts>`（data/ 旁 5 份）+ `pipeline/review/backup/` | 手动 `cp` 恢复 |
| 护栏 | `scheduler.config.cjs`：`enabled=false`、`autoProduction=false`、`productionAllowed=false` | 无自动生产路径 |

### 5.2 资讯页渲染与来源维护【核实】

- 列表页 `news.html`：前端切片，每批 10 条，`V2.sortNews()` 五步排序（过滤→置顶有效性→分层→置顶组内→并列打破），**零网络请求**。
- 详情页 `news-detail.html`：`?id=` 查 `MCU_NEWS`，10 个信息块，**静态 `noindex`**。
- 原始来源 URL：`reported_by[].source_url` + `original_source_url` + `official_source_url` + `status_history[].evidence_url`，前端 `V2.safeUrl()` 过滤协议。
- `noindex` 策略：**详情页全量 noindex**，列表页可索引；`generate-sitemap.cjs` 明确把 `news-detail.html` 排除并注释「本轮不擅自开放资讯详情收录，是否纳入需单独评估」。

### 5.3 未来 CMS 接入资讯的方式（建议，不改变现状）

| 阶段 | 做法 | 边界 |
|---|---|---|
| V1 | **不接**。CMS 不读不写 `news.js`，不调用流水线 | 现有流程零影响 |
| V2 | CMS 只做「**已发布资讯的只读镜像索引**」：读 `news.js` → 展示在后台供选题参考；**不写回** | 单向只读，避免第二套资讯数据 |
| V3（需单独拍板） | 若要让资讯可被索引，应由**资讯流水线**产出文章型页面（复用 CMS 的构建器），而不是让 CMS 接管采集/审核 | 发布权仍归 G6 审核链路 |

**硬结论**：`news.js` 是**资讯唯一权威源**（S-1 拍板），CMS **不能**成为第二个资讯写入点，否则与 `news-append-writer` 的 append-only/幂等/双备份机制冲突。

### 5.4 Forum API 服务边界【核实】

| 维度 | 现状 | 对 CMS 的含义 |
|---|---|---|
| 职责 | 论坛：用户/话题/回复/点赞/举报/管理审核（6 组路由） | **纯社区域**，无内容管理概念 |
| 鉴权 | 用户 token（HMAC-SHA256，180 天）+ 独立 admin token 文件（0600） | admin token 是**论坛审核专用**，不可复用为 CMS 身份 |
| 数据 | 独立 SQLite `forum-api/data/forum.db`（WAL），5 张表 | 与内容/CMS 无任何关联；`config.js` 注释明确「本库只存论坛数据」 |
| 运行 | `User=forumapi`、`127.0.0.1:8787`、`MemoryMax=150M`、`PrivateTmp`、`NoNewPrivileges` | 权限模型是把「能写什么」写死在用户与目录上 |
| 暴露 | Nginx `^~ /api/` 反代 + 限流 10 r/s（burst 20） | **`/api/` 前缀已被占满** |

**结论（明确回答任务提问）**：**CMS 必须是独立服务，不能混入 Forum API。** 理由三条：
1. **职责不同**：论坛是用户内容（UGC，先审后发），CMS 是编辑内容（自有，发布即生效），两者状态机与审核语义相反。
2. **权限不同**：论坛服务用户 `forumapi` 只能写自己目录；CMS 需要写「发布产物目录」，若合并则论坛进程获得发布能力，扩大攻击面（论坛是唯一公网可写入口）。
3. **故障隔离**：论坛重启不应影响发布，发布失败不应影响社区可用性。

---

## 6. CMS 技术选型建议

### 6.1 推荐方案（方案 A：零依赖 Node + node:sqlite + 原生前端）

| 层 | 选型 | 理由 |
|---|---|---|
| 后台 UI | 原生 HTML/CSS/JS（无框架、无构建） | 与项目既有「无构建」纪律一致；单管理员场景不需要 SPA；省内存与维护成本 |
| 后端 | Node 24.9.0 + `node:http`（复用 forum-api 的路由表/`json`/`readBody`/`httpError` 模式） | 已被生产验证；零 npm；`MemoryMax` 可控 |
| 数据库 | `node:sqlite` `DatabaseSync` + WAL + `busy_timeout=5000` + `synchronous=NORMAL` | 与 forum 同构，备份脚本模式现成 |
| 内容格式 | Markdown（受限子集，自写渲染器 ~250 行） | 零依赖；渲染在**构建期**完成，服务端不装解析器也行 |
| 静态生成 | 自写模板函数（`模板字符串 + 转义函数`），构建期输出完整 HTML | 60 篇文章构建 < 1 s、< 100 MB 峰值；不需要 Astro/11ty |
| 部署 | 复用 ECS + 现有 Nginx（文章目录在 root 下，零 nginx 改动） | 见 §9 |
| 页面发布 | `releases/<seq>/` 构建 → 校验 → **符号链接原子切换** | 见 §9.3 |
| 图片 | 存 `mcu-cms/data/media/`（Web root 外）+ `mcu-h5/media` 软链暴露 | 见 §12.3 |
| 访问入口 | **V1 仅 `127.0.0.1:8790` + SSH 隧道** | 零 nginx 改动、零公网暴露 |

**内存画像**：常驻 20–35 MB（forum 实测 12.7 MB × 1.7 余量）；构建 60–110 MB 峰值（`--max-old-space-size=128`）。

### 6.2 备选方案对比（含成本/复杂度/维护差异）

| 方案 | 技术栈 | 内存 | 开发量 | 维护 | 结论 |
|---|---|---|---|---|---|
| **A. 零依赖 Node（推荐）** | Node 24 + node:sqlite + 原生前端 | 常驻 ~30 MB | 18–22 人日 | 低（无依赖升级、无构建链） | ✅ **推荐** |
| B. Node + better-sqlite3 / express | 需 `npm install`（原生模块编译） | 常驻 ~60 MB | 16–20 人日 | 中（依赖升级、ABI 与 Node 版本绑定、需 gcc/make） | ❌ 与「零依赖/不装依赖」约束冲突；`npm` 当前还不在 PATH，装包要额外改环境 |
| C. 复用现成 WordPress（已装 177 MB） | PHP + MariaDB | 需再开 php-fpm worker（~100 MB）| 5–8 人日（装插件配主题） | **高**（插件安全、主题改版、WP 升级、与静态站两套体系并存） | ❌ 内存已饱和；会产生**第三套内容体系**；SEO 插件重且不可控；迁移风险大 |
| D. Headless CMS SaaS（Strapi/Contentful 等） | 外部服务 | 低（本地） | 10–15 人日 | 中（外部依赖、费用、数据出境、可用性绑定第三方） | ❌ 与「轻量低成本、数据自持」冲突 |
| E. 纯文件即库（articles/*.md + front-matter，无 DB） | Node 文件扫描 | ~15 MB | 14–18 人日 | 低，但**无事务/无并发编辑保护/发布记录靠文件名** | ⚠️ 可作降级方案（若明确拒绝引入 DB） |
| F. Astro/11ty 静态站生成器 | Node + npm | 构建 200–400 MB | 12–16 人日 | 中（构建链、依赖升级） | ❌ 构建内存超出现有余量，风险最高 |

> **选型关键判断**：本项目的约束不是「功能够不够」，而是**内存 146 MB + 零依赖纪律 + 单人维护**。方案 A 是唯一同时满足三者的；方案 C 是「开发最快但运维最贵」的陷阱，需明确排除。

### 6.3 明确不引入的东西

- ❌ React/Vue/Webpack/Vite（构建内存与维护成本）
- ❌ ORM / 迁移框架（手写 `schema.sql` + 幂等 `IF NOT EXISTS`，与 forum 一致）
- ❌ 富文本所见即所得编辑器（复杂、产出 HTML 不可控、XSS 面大）→ 用 Markdown + 服务端渲染 + 预览
- ❌ 图片处理库（sharp，需编译）→ 只做「类型/尺寸/魔数校验 + 前端 `object-fit`」，不重编码（安全代价见 §13.4）
- ❌ 拖拽式页面搭建器（V1 明确不做）

---

## 7. 数据库初步设计

### 7.1 设计原则

1. **SQLite 单文件**，`cms.db` 放 Web root 之外；WAL 模式。
2. **时间一律 TEXT ISO8601**（与 forum 一致，可排序可读）。
3. **不用 `STRICT` 表**（系统 `sqlite3 3.26` 备份 CLI 兼容性）。
4. **不建外键约束到 JS 数据**：`entity_id` 存字符串，靠**构建期校验**（`vm` 加载 `h5/data` 后比对），因为数据源是 JS 文件不是表。
5. **修订与发布分离**：`revisions` 保历史，`releases` 保线上状态，任何发布可回滚到「某个 release」而不只是「某个 revision」。
6. **审计只增不改**。

### 7.2 表清单（14 张）

| 表 | 作用 | 关键点 |
|---|---|---|
| `cms_users` | 管理员 | scrypt 口令；`role ∈ owner/editor/viewer` |
| `cms_sessions` | 会话 | 只存 `sha256(token)`；绝对过期 |
| `cms_categories` | 分类 | 自带 TDK/robots（分类页要独立 TDK） |
| `cms_tags` / `cms_article_tags` | 标签 | 标签页默认 `noindex,follow` |
| `cms_articles` | 文章主表 | 状态机 + 全部 SEO/GEO 字段 |
| `cms_article_revisions` | 修订 | `UNIQUE(article_id, rev_no)`，回滚用 |
| `cms_article_entities` | 实体关联 | `entity_type ∈ movie/series/special/character/route` |
| `cms_article_sources` | 事实来源 | URL/标题/媒体/时间/类型/引用片段 |
| `cms_media` | 图片 | sha256 去重 + alt/caption/credit |
| `cms_redirects` | 跳转表 | V1 只登记，执行需 nginx（§10.6） |
| `cms_releases` / `cms_release_items` | 发布批次 | 一次发布 = 一个不可变版本 |
| `cms_audit_log` | 操作日志 | 只增 |
| `cms_settings` | 键值配置 | 站点级默认 TDK/作者/robots |

### 7.3 DDL（初步，可直接建库）

```sql
-- ============ 1. 管理员与会话 ============
CREATE TABLE IF NOT EXISTS cms_users (
  id            TEXT PRIMARY KEY,             -- randomUUID
  username      TEXT NOT NULL UNIQUE,
  display_name  TEXT,
  pass_hash     TEXT NOT NULL,                -- scrypt$N$r$p$saltB64$hashB64
  role          TEXT NOT NULL DEFAULT 'editor',-- owner|editor|viewer
  status        TEXT NOT NULL DEFAULT 'active',-- active|disabled
  created_at    TEXT NOT NULL,
  last_login_at TEXT
);

CREATE TABLE IF NOT EXISTS cms_sessions (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,            -- sha256(随机32B)
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  ip         TEXT,
  ua         TEXT,
  revoked_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON cms_sessions(user_id, expires_at);

-- ============ 2. 分类与标签 ============
CREATE TABLE IF NOT EXISTS cms_categories (
  id              TEXT PRIMARY KEY,
  slug            TEXT NOT NULL UNIQUE,
  name            TEXT NOT NULL,
  parent_id       TEXT,
  description     TEXT,
  seo_title       TEXT,
  seo_description TEXT,
  seo_keywords    TEXT,
  robots          TEXT NOT NULL DEFAULT 'index,follow',
  template        TEXT NOT NULL DEFAULT 'category',
  sort_order      INTEGER NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'active',
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cms_tags (
  id         TEXT PRIMARY KEY,
  slug       TEXT NOT NULL UNIQUE,
  name       TEXT NOT NULL,
  robots     TEXT NOT NULL DEFAULT 'noindex,follow',  -- 薄标签页默认不索引
  created_at TEXT NOT NULL
);

-- ============ 3. 文章 ============
CREATE TABLE IF NOT EXISTS cms_articles (
  id               TEXT PRIMARY KEY,
  slug             TEXT NOT NULL UNIQUE,      -- 发布后锁定（变更走 cms_redirects + nginx）
  type             TEXT NOT NULL DEFAULT 'article', -- article|topic|guide
  title            TEXT NOT NULL,
  subtitle         TEXT,
  excerpt          TEXT,                      -- 40-80 字「直接答案」，用于列表/OG/GEO
  body_md          TEXT NOT NULL,
  cover_media_id   TEXT,
  category_id      TEXT,
  author_id        TEXT,
  editor_id        TEXT,
  source_note      TEXT,                      -- 文末「资料来源说明」
  status           TEXT NOT NULL DEFAULT 'draft',
                   -- draft|review|scheduled|published|unpublished|archived
  scheduled_at     TEXT,
  published_at     TEXT,
  updated_at       TEXT NOT NULL,
  created_at       TEXT NOT NULL,

  -- SEO
  seo_title        TEXT,                      -- 空则回退 title
  seo_description  TEXT,                      -- 空则回退 excerpt
  seo_keywords     TEXT,
  canonical_override TEXT,                    -- 仅在确有必要时使用
  robots           TEXT NOT NULL DEFAULT 'index,follow',
  og_title         TEXT,
  og_description   TEXT,
  og_media_id      TEXT,
  jsonld_type      TEXT NOT NULL DEFAULT 'Article', -- Article|NewsArticle|ItemList

  -- GEO / 质量
  geo_score        INTEGER,
  geo_checked_at   TEXT,
  geo_issues_json  TEXT,                      -- [{code,level,msg,field}]
  word_count       INTEGER,
  revision_no      INTEGER NOT NULL DEFAULT 1,
  published_release_id TEXT,
  slug_locked      INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_articles_status ON cms_articles(status, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_cat    ON cms_articles(category_id, status);
CREATE INDEX IF NOT EXISTS idx_articles_slug   ON cms_articles(slug);

CREATE TABLE IF NOT EXISTS cms_article_revisions (
  id         TEXT PRIMARY KEY,
  article_id TEXT NOT NULL,
  rev_no     INTEGER NOT NULL,
  title      TEXT,
  body_md    TEXT,
  meta_json  TEXT,                            -- 该版本全部 SEO/GEO 字段快照
  note       TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(article_id, rev_no)
);

CREATE TABLE IF NOT EXISTS cms_article_tags (
  article_id TEXT NOT NULL,
  tag_id     TEXT NOT NULL,
  PRIMARY KEY(article_id, tag_id)
);

-- 实体关联：entity_id 只存字符串，构建期对 h5/data 校验存在性
CREATE TABLE IF NOT EXISTS cms_article_entities (
  article_id  TEXT NOT NULL,
  entity_type TEXT NOT NULL,                  -- movie|series|special|character|route
  entity_id   TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'mention',-- subject|mention|prereq
  note        TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(article_id, entity_type, entity_id)
);

-- 事实来源：GEO 的核心表
CREATE TABLE IF NOT EXISTS cms_article_sources (
  id           TEXT PRIMARY KEY,
  article_id   TEXT NOT NULL,
  url          TEXT NOT NULL,
  title        TEXT,
  publisher    TEXT,
  published_at TEXT,
  source_type  TEXT,                          -- official|trade|database|community
  accessed_at  TEXT,
  quote        TEXT,
  sort_order   INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_sources_article ON cms_article_sources(article_id, sort_order);

-- ============ 4. 媒体 ============
CREATE TABLE IF NOT EXISTS cms_media (
  id         TEXT PRIMARY KEY,
  path       TEXT NOT NULL UNIQUE,            -- media/2026/11/xxxx.webp（相对 cms 数据根）
  filename   TEXT,
  mime       TEXT,
  bytes      INTEGER,
  width      INTEGER,
  height     INTEGER,
  sha256     TEXT,                            -- 去重与完整性
  alt        TEXT,
  caption    TEXT,
  credit     TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL
);

-- ============ 5. 跳转（登记，执行依赖 nginx，见 §10.6） ============
CREATE TABLE IF NOT EXISTS cms_redirects (
  id          TEXT PRIMARY KEY,
  from_path   TEXT NOT NULL UNIQUE,           -- /article/old-slug
  to_path     TEXT NOT NULL,
  status_code INTEGER NOT NULL DEFAULT 301,
  reason      TEXT,
  active      INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL
);

-- ============ 6. 发布批次 ============
CREATE TABLE IF NOT EXISTS cms_releases (
  id                TEXT PRIMARY KEY,
  seq               INTEGER NOT NULL UNIQUE,
  status            TEXT NOT NULL,            -- building|verified|published|failed|rolled_back
  build_dir         TEXT,
  article_count     INTEGER,
  sitemap_url_count INTEGER,
  verify_json       TEXT,
  created_by        TEXT,
  created_at        TEXT NOT NULL,
  published_at      TEXT,
  rolled_back_at    TEXT
);

CREATE TABLE IF NOT EXISTS cms_release_items (
  release_id TEXT NOT NULL,
  article_id TEXT NOT NULL,
  action     TEXT NOT NULL,                   -- create|update|unpublish
  url        TEXT,
  file_sha256 TEXT,
  PRIMARY KEY(release_id, article_id)
);

-- ============ 7. 审计与配置 ============
CREATE TABLE IF NOT EXISTS cms_audit_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  at          TEXT NOT NULL,
  user_id     TEXT,
  action      TEXT NOT NULL,                  -- login|create|update|publish|rollback|delete|upload
  target_type TEXT,
  target_id   TEXT,
  detail      TEXT,                           -- JSON（不含敏感内容）
  ip          TEXT
);
CREATE INDEX IF NOT EXISTS idx_audit_at ON cms_audit_log(at DESC);

CREATE TABLE IF NOT EXISTS cms_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT,
  updated_at TEXT
);
```

### 7.4 站点级 TDK 的策略（重要取舍）

现有 15 个页面把 TDK **写死在各自 HTML 里**。CMS 若把「页面级 TDK」做成可编辑，就必须**改写这些 HTML**——这违反保护范围，且会把简单问题复杂化。

**建议**：
- **V1 只管理 CMS 拥有的页面**（文章页、分类页、文章索引页）。
- 现有 15 页的 TDK **保持手工维护**（它们已有独立 title/desc，不存在缺失）。
- 若未来要「统一接管」，正确路径是**让这 15 页也走构建器生成**（先冻结、再生成、再比对 diff），属于独立工程，不进 V1。

---

## 8. 后台 API 规划

### 8.1 前缀与鉴权（含现有冲突规避）

| 项 | 决定 | 理由 |
|---|---|---|
| **API 前缀** | **`/cms/api/...`**（若走公网）或**仅 loopback**（V1） | **禁止 `/api/cms/*`**：`location ^~ /api/` 会把它打到 8787 论坛服务并 404【核实】 |
| 鉴权 | 登录 → `Set-Cookie: cms_session=<32B>; HttpOnly; Secure; SameSite=Strict; Path=/cms` + `X-CSRF-Token` | 不用 localStorage（XSS 面）；双提交 CSRF |
| 会话 TTL | 12 h 绝对过期，无滑动续期；退出即撤销 | 单管理员场景，安全优先 |
| 口令 | `scrypt(N=16384,r=8,p=1)` + 16B salt；错误 5 次/5 分钟锁 IP | 零依赖（`node:crypto`） |
| 权限 | `owner`（全部） / `editor`（文章 CRUD + 发布，可回滚） / `viewer`（只读） | V1 一人多角色不必要，但字段先留 |

### 8.2 接口清单（V1）

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/cms/api/login` | `{username,password}` → cookie + csrf |
| POST | `/cms/api/logout` | 撤销会话 |
| GET | `/cms/api/me` | 当前用户 + 权限 |
| GET | `/cms/api/articles?status=&q=&page=&size=` | 列表（分页 20） |
| POST | `/cms/api/articles` | 新建（服务端生成 id，slug 唯一校验） |
| GET | `/cms/api/articles/:id` | 详情（含 revision_no，用于乐观锁） |
| PUT | `/cms/api/articles/:id` | 保存草稿；`If-Match: revision_no` 不匹配 → 409 |
| POST | `/cms/api/articles/:id/preview` | **返回渲染后的完整 HTML 片段**（供 iframe srcdoc，不落盘） |
| POST | `/cms/api/articles/:id/publish` | 单篇发布（进入 release 构建） |
| POST | `/cms/api/articles/:id/unpublish` | 下架 |
| GET | `/cms/api/articles/:id/revisions` | 修订列表 |
| POST | `/cms/api/articles/:id/revisions/:rev/restore` | 回滚到某修订（生成新修订，不删历史） |
| GET/POST/PUT/DELETE | `/cms/api/categories`、`/cms/api/tags` | 分类/标签 |
| POST | `/cms/api/media`（multipart） / GET 列表 / DELETE | 图片 |
| GET | `/cms/api/entities?type=movie&q=钢铁` | 从 `h5/data` **只读加载**的实体检索（`vm` + 内存缓存，5 分钟） |
| GET | `/cms/api/entities/:type/:id` | 实体详情（供关联面板展示中文名/阶段/关系） |
| POST | `/cms/api/geo/check` | 传入正文与元信息 → 返回 issues + score（不落盘） |
| GET/POST/PATCH | `/cms/api/redirects` | 跳转登记（**V1 只登记不生效**） |
| POST | `/cms/api/releases` | 触发一次发布（构建 → 校验 → 切换） |
| GET | `/cms/api/releases` / `:id` | 发布记录与校验报告 |
| POST | `/cms/api/releases/:id/rollback` | 回滚到该批次 |
| GET | `/cms/api/audit?page=` | 操作日志 |
| GET | `/cms/api/health` | `{ok, db, releases, disk}`（用于监控探针） |

### 8.3 不做的接口（明确排除）

- ❌ 公开读写 API（文章只以静态 HTML 暴露，无 JSON API）
- ❌ 用户注册/登录（无会员系统）
- ❌ 投稿/评论（社区已有 Forum API）
- ❌ 与资讯流水线互调（§5.3）
- ❌ 任何会写 `h5/data/*.js` 的接口（硬禁止）

---

## 9. 静态页面生成与发布方案

### 9.1 目标 URL 结构

| 页面 | URL | 实际文件 | canonical |
|---|---|---|---|
| 文章索引 | `/article/` | `article/index.html` | `https://www.mcuatlas.xyz/article/` |
| 文章 | `/article/<slug>` | `article/<slug>.html` | `https://www.mcuatlas.xyz/article/<slug>` |
| 分类 | `/article/c/<cat-slug>` | `article/c/<cat-slug>.html` | 同 URL |
| 标签（默认 noindex） | `/article/t/<tag-slug>` | `article/t/<tag-slug>.html` | 同 URL |
| RSS | `/article/feed.xml` | `article/feed.xml` | — |

**为什么用「无扩展名 canonical + 有扩展名文件」**：
- `try_files` 让两种写法都 200，因此**必须**在 HTML 里写死唯一 canonical（无扩展名形式），`.html` 写法访问时 canonical 指回无扩展名 → **重复内容被 canonical 收敛，且不需要 nginx 规则**。【核实 + 推导】
- 文章页内部链接**统一用无扩展名形式**，减少二次入口。

**保留字**：`c`、`t`、`assets`、`media`、`feed.xml`、`index` 不得作为文章 slug（避免与目录/文件冲突）。

### 9.2 构建流水线（流水线定义）

```
后台点「发布」
  ├─ 1. 读取 DB：所有 status ∈ {published} 的文章 + 分类 + 设置
  ├─ 2. 只读加载 h5/data（vm 沙箱）：校验 entity_id 全部存在、取中文名/阶段/关系
  ├─ 3. 渲染：Markdown → HTML（受限子集）→ 套 layout → 完整 HTML 字符串
  │      · 正文在源码中（不依赖 JS）
  │      · CSS 走 /assets/css/style.css（复用 Token）+ /article/assets/article.css（新增 ~6 KB）
  ├─ 4. 生成 JSON-LD（Article/NewsArticle + BreadcrumbList + about/mentions）
  ├─ 5. 生成 RSS（feed.xml）与 sitemap 片段（urls.txt）
  ├─ 6. 写入 releases/<seq>/  （Web root 之外）
  ├─ 7. 校验（§9.4，全部通过才继续）
  ├─ 8. 复核「冻结文件未变」（§9.5 守卫）
  ├─ 9. 原子切换：mcu-h5/article → releases/<seq>/article
  ├─ 10. 更新 sitemap.xml（单一所有者工具，§9.6）
  ├─ 11. 落 cms_releases（published，记录 verify_json + 文件 sha256）
  └─ 12. 抽查：HTTP 自检（本机 curl 200 + 关键串命中）→ 写审计日志
失败任一步 → 状态 failed，不改符号链接，线上无任何变化
```

### 9.3 原子发布与回滚（核心机制）

```bash
# 发布（构建目录已就绪并校验通过）
ln -sfn /www/wwwroot/mcu-cms/releases/0007/article /www/wwwroot/mcu-h5/.article.new
mv -Tf /www/wwwroot/mcu-h5/.article.new /www/wwwroot/mcu-h5/article   # rename(2)，原子

# 回滚（<1 秒）
ln -sfn /www/wwwroot/mcu-cms/releases/0006/article /www/wwwroot/mcu-h5/.article.new
mv -Tf /www/wwwroot/mcu-h5/.article.new /www/wwwroot/mcu-h5/article
```

**为什么用符号链接而不是逐文件覆盖**：
1. **原子性**：`rename` 是单系统调用，不存在"切了一半"的中间态。
2. **回滚零成本**：不复制文件，只换指针。
3. **不污染现有目录**：`mcu-h5/article` 是**新增**符号链接，**不触碰**任何现有文件；即使 CMS 完全坏掉，现有站点 15 页不受影响。
4. **与现有部署方式一致**：本机已有 `mcu-atlas-news/h5 → mcu-h5` 的软链先例，`nginx` 默认跟随符号链接（未配 `disable_symlinks`）。【核实】

**风险与对策**：软链被误删 → `/article/*` 全 404（但现有页面正常）。对策：① 软链目标写入 `cms_settings` 与 release 记录；② `/cms/api/health` 检查软链有效性；③ `releases` 保留最近 **10 批**，任何一批都可回切。

### 9.4 发布校验清单（任一失败即阻断）

| # | 校验项 | 判据 |
|---|---|---|
| 1 | 模板完整 | `layout/article.html` 等必需片段存在且非空 |
| 2 | 文档结构 | `<!DOCTYPE html>`、`lang="zh-CN"`、`charset`、`viewport` 齐全 |
| 3 | **正文在源码** | 去标签文本长度 ≥ 100 字；**不得出现** `{{`、`__PLACEHOLDER__`；关键词至少 1 次命中源码 |
| 4 | 唯一 H1 | `<h1>` 恰好 1 个，且等于 `title`（或允许的前缀变体） |
| 5 | 标题长度 | `seo_title` 12–40 汉字（或 ≤ 60 字符）；`seo_description` 40–160 字符 |
| 6 | canonical | 绝对地址、`https://www.mcuatlas.xyz` 前缀、**等于本页规范 URL**、无 `?` 冗余参数 |
| 7 | robots | 存在且取值合法（`index,follow` / `noindex,follow` / `noindex,nofollow`） |
| 8 | OG | `og:title/og:description/og:url/og:image/og:type` 齐全，图片路径可解析 |
| 9 | JSON-LD | 全部块可 `JSON.parse`；`@context/@type/headline/datePublished/dateModified/author/url/mainEntityOfPage` 必填齐全 |
| 10 | 站内链接 | 所有 `href`（站内）解析到已生成文件或已注册路由；无 `http://` 混合内容 |
| 11 | 实体完整性 | `entity_id` 在 `h5/data` 中存在；关联链接指向 `movie.html?id=` 等真实页面 |
| 12 | 无内联脚本依赖 | 文章页 `<script>` 数量 = 0（除统计可选）；正文不依赖 JS 渲染 |
| 13 | 单页体积 | HTML ≤ 300 KB；图片引用总数 ≤ 30 |
| 14 | **sitemap 只增不减** | 新 URL 集合 ⊇ 上一版（下架条目需在 release 里显式 `unpublish` 才允许消失） |
| 15 | 重名检测 | 无 slug 冲突、无 title 完全重复 |

### 9.5 「不覆盖现有 H5」守卫（发布前后各跑一次）

```
冻结集 = h5/*.html（15 个） + h5/data/*.js（15 个） + h5/assets/js/*.js（3 个）
        + h5/assets/css/*.css（5 个） + h5/sitemap.xml（由 sitemap 工具统一写）
处理：
  1) 发布前：对冻结集逐文件 sha256 → 写 releases/<seq>/baseline.json
  2) 发布后：逐文件重算并比对
  3) 任一不一致 → 立即回切 + 报 FAIL（并在审计日志记录差异文件名）
允许写的只有：mcu-h5/article/**（软链指向的构建产物）、mcu-h5/media/**（软链）、
             mcu-h5/sitemap.xml（仅由 generate-sitemap.cjs 写）
```

这条守卫是「CMS 绝不覆盖现有页面与数据」的**可执行定义**，不是口头承诺。

### 9.6 Sitemap 冲突的解法（任务点名项）

**冲突本体**：`h5/tools/generate-sitemap.cjs` 每次运行会**整文件重写** `sitemap.xml`，只含 76 条基础 URL；CMS 若自己追加文章 URL，下一次有人跑生成器就被覆盖。

**方案：保持单一所有者，扩展而不新增**

| 步骤 | 改动 | 风险 |
|---|---|---|
| 1 | `generate-sitemap.cjs` 增加可选参数 `--extra <urls.txt>`（CMS 构建产物里的 URL 清单）| 极低，纯增量参数 |
| 2 | 加守卫：`--extra` 文件必须由 CMS 生成并带 `# release=<seq>` 头；URL 必须 `https://www.mcuatlas.xyz/article/...` 前缀；不得与基础 URL 重复 | 低 |
| 3 | 加「只增不减」校验：读取现有 `sitemap.xml`，若新集合缺少旧 URL 且不在 `--removed` 白名单 → 拒绝写入 | 低 |
| 4 | 写入改原子：写 `sitemap.xml.tmp` → `rename` | 低 |
| 5 | `--check` 语义保持（离线校验基础 URL 一致性） | 低 |

**CMS 侧**：只产出 `releases/<seq>/sitemap-urls.txt`，**从不写 `sitemap.xml`**。发布流程调用生成器，失败则整批发布判 failed（文章仍可上线，但 sitemap 不更新 → 记录告警，不静默）。

> 该改动属于「修改现有工具」，**不在本次只读范围**，须在开发阶段按变更流程执行（改动 40 行以内，`--check` 保持兼容）。

### 9.7 URL 修改（slug 变更）的三种做法与代价

| 做法 | 效果 | 代价 | 建议 |
|---|---|---|---|
| **A. 锁 slug**（发布后不可改） | 无 301 需求 | 运营不便 | ✅ **V1 采用** |
| B. Nginx 301（`map` 或 `rewrite` + `cms_redirects` 导出） | 标准 301，权重传递最好 | **需改 Nginx**（1 处 `include` + 1 个 map 文件 + reload）；需审批 | ⏭ V1.5 做（改动小、收益明确） |
| C. 旧路径留「meta refresh 桩」 | 无需改配置；Google 能识别 | **不是 301**，信号弱；桩文件会长期堆积；对 AI 抓取基本无效 | ⚠️ 仅作无配置降级 |

**诚实结论**：**真正语义正确的 301 不可能零配置实现**。V1 用「锁 slug」规避，把 301 明确列为 V1.5 的**一次性 nginx 变更**（前置：owner 授权 + 变更清单 + 回滚备份）。

### 9.8 文章下架的三种做法

| 做法 | 结果 | SEO 影响 |
|---|---|---|
| 删除文件 | 404 | 负向（外链变死链） |
| 生成「已下架」桩页（`noindex` + 说明 + 回到分类） | 200 + noindex | 中性偏好（保留外链着陆点） |
| 410 | 需要 nginx 规则 | 最快去索引，但需改配置 |

**V1 建议**：桩页 + `noindex,follow`，并从 sitemap 移除（release 记录 `unpublish` 动作）。理由：零配置、可逆、对用户友好。

### 9.9 保证「正文在 HTML 源码」的具体要求

1. Markdown **在构建期**转 HTML，写入文件；运行时无 JS 也能读到全文。
2. **禁止**把正文塞进 JSON/`data-*` 后由 JS 渲染。
3. **禁止**懒加载正文（分页/展开更多）。长文就一整页。
4. 校验项 §9.4-#3 会**实际读文件**断言正文长度，而不是相信渲染器。
5. 文章页 `<script>` 数量强制为 0（如需统计，用 1 个 `defer` 外链脚本并在验收里登记例外）。

---

## 10. SEO 功能设计（逐项可行性）

> 图例：**✅ 已有** / **➕ 新增可实现** / **⚠️ 有条件** / **❌ 不可行或不应做**

| # | 需求 | 现状 | V1 方案 | 结论 |
|---|---|---|---|---|
| 1 | 全局 TDK | 无中心配置，15 页各自写死 | `cms_settings` 存站点名/后缀/默认 OG 图，仅作用于 CMS 页面 | ➕ |
| 2 | 页面级 Title | 静态 15 页 + 参数页运行时 | 文章/分类/索引页构建期写入；带长度校验 | ➕ |
| 3 | Description | 同上（`movie.html` 不改 desc） | 构建期写入；40–160 字符校验；缺省回退 `excerpt` | ➕ |
| 4 | Keywords | 6 页有 | 保留字段（写入但标注「低价值」）；不做长度强校验 | ✅/➖ |
| 5 | Canonical | 5 静态 + 4 运行时 | 构建期绝对地址 + 自指校验（§9.4-#6）；`?utm` 等参数不入 canonical | ➕ |
| 6 | Robots | 仅 news-detail noindex | 三档：文章 `index,follow`；薄标签 `noindex,follow`；下架桩 `noindex,follow` | ➕ |
| 7 | OG | 运行时、无图 | 构建期 5 项 + `og:image`（1200×630 裁切规范）+ `twitter:card=summary_large_image` | ➕ |
| 8 | Sitemap 自动更新 | 手工跑工具，76 条 | 扩展单一所有者 + 发布时自动调用 + 只增不减守卫 | ➕（§9.6） |
| 9 | 文章/分类独立 URL | 不存在 | `/article/<slug>`、`/article/c/<cat>`（零 nginx 改动） | ➕ |
| 10 | Slug 修改 + 301 | 无机制 | V1 **锁 slug**；301 列入 V1.5（需 nginx） | ⚠️ |
| 11 | 重复内容检测 | 无 | 三重：slug 唯一 + title/desc 完全重复 + 正文 5-gram Jaccard > 0.8 告警（不阻断，人工确认） | ➕ |
| 12 | 发布/下架 | 无 | release 批次 + 原子切换 + 桩页下架 | ➕ |
| 13 | JSON-LD | 0 | `Article`/`NewsArticle` + `BreadcrumbList` + `about/mentions`（实体 `@id`） | ➕ |
| 14 | 分页 SEO | 无分页页 | 索引页分页用 `?page=n` + `rel=prev/next` + 自指 canonical；**不用 canonical 指第一页**（错误做法） | ➕ |
| 15 | 面包屑 | 无 | 可见面包屑 + `BreadcrumbList` | ➕ |
| 16 | 图片 SEO | 有 alt 但零散 | `cms_media.alt` 必填 + 构建期写入 `alt`/`width`/`height`/`loading=lazy` | ➕ |
| 17 | 现有 15 页静态化 | 内容靠 JS | **V1 不做**（保护范围） | ⛔ 出界 |

**关于「页面重复内容检测」的更细判断**：现有 38 个 `movie.html?id=` 页面在**不执行 JS 的抓取器**眼里是同一个页面（同 title、同 desc、同 canonical 缺失）。这是**现存风险**，不是 CMS 引入的。建议作为**独立整改项**（为作品页生成静态快照或至少预渲染 title/canonical），**不在 V1 范围**，但应在验收时记录为已知负债。

---

## 11. GEO 功能设计

> **前置声明（必须写进产品文档）**：GEO（生成式引擎优化）**没有任何可保证的结果**。下面区分三类：**① 有明确标准支持的**、**② 平台特定策略**、**③ 实验性建议**。任何"保证被 AI 引用"的说法都不成立。

### 11.1 ① 有标准支持的技术项（可做、可验证）

| 项 | 标准依据 | V1 做法 |
|---|---|---|
| robots.txt 分爬虫管理 | **RFC 9309**（Robots Exclusion Protocol，2022 标准化）；`User-agent` 分组、最长匹配、`Allow`/`Disallow` | 保留现有 `User-agent: *` 组；**新增**按需分组（见 11.2）；`Sitemap:` 声明保留 |
| 静态 HTML 可读 | HTML 标准本身 | 构建期渲染正文（§9.9），`<script>` = 0 |
| 结构化数据 | **schema.org** + JSON-LD（W3C JSON-LD 1.1） | `Article`/`NewsArticle`、`BreadcrumbList`、`Person`(author)、`Organization`(publisher)、`WebSite`、`about`/`mentions`(Thing) |
| 规范 URL / 去重 | **RFC 6596**（canonical） | 自指 canonical + 单入口 |
| 语义化 HTML | HTML 标准 | `article`/`section`/`h1-h3`/`time[datetime]`/`figure`/`figcaption` |
| RSS/Atom | **RFC 4287**(Atom) / RSS 2.0 规范 | 构建期出 `/article/feed.xml`（最近 20 篇） |
| Sitemap | **sitemaps.org 0.9** | 复用现有机制并补 `lastmod` |

### 11.2 ② 平台特定策略（会变、不承诺）

| 爬虫 | 所属 | 用途 | 备注 |
|---|---|---|---|
| `GPTBot` | OpenAI | 训练抓取 | 允许/禁止是**策略选择**，不是技术必需 |
| `OAI-SearchBot` | OpenAI | 搜索索引（ChatGPT 搜索） | 与 `GPTBot` 分离 |
| `ChatGPT-User` | OpenAI | 用户触发实时访问 | 通常希望允许 |
| `ClaudeBot` / `Claude-User` / `Claude-SearchBot` | Anthropic | 训练 / 用户触发 / 搜索 | 名称随产品迭代 |
| `Google-Extended` | Google | 控制 Gemini 训练/grounding（**不影响** Googlebot 搜索收录） | 常见误解点 |
| `PerplexityBot` / `Perplexity-User` | Perplexity | 索引 / 用户触发 | — |
| `Bytespider` | 字节跳动 | 训练/索引 | 流量常较大 |

**建议策略（V1 落 `robots.txt`，需 owner 拍板）**：
```robots
User-agent: *
Allow: /
Disallow: /api/
Disallow: /cms/          # 仅当 CMS 公网可达时；V1 不可达也可先写

# 检索类（希望被引用）
User-agent: OAI-SearchBot
User-agent: Claude-SearchBot
User-agent: PerplexityBot
Allow: /article/
Allow: /
Disallow: /cms/

# 训练类（按 owner 意愿决定允许或禁止）
User-agent: GPTBot
User-agent: ClaudeBot
User-agent: Google-Extended
User-agent: Bytespider
Allow: /article/
Disallow: /cms/
```
**必须如实标注**：UA 名称由各厂商单方面定义、可随时更改；robots 是「请求」不是「强制」；**遵守率不保证**。

### 11.3 ③ 实验性建议（低成本试、不期待）

| 项 | 状态 | 建议 |
|---|---|---|
| `llms.txt` | 社区提案（llmstxt.org，2024），**无 IETF/W3C 标准，无主流厂商公开承诺支持** | 成本约 1 人时，可作为「元数据说明书」发布：站点定位、核心栏目、重要页面清单、更新频率。**不承诺效果** |
| `llms-full.txt` | 同上 | 不建议（体积大、易过期） |
| AI 摘要专用标记（如 `ai-summary` 自定义 meta） | **无标准** | 不做（无效且像作弊） |
| 内容"问答化"结构 | 内容策略，无标准 | 建议做（见 11.5） |

### 11.4 内容侧 GEO 能力（CMS 真正该做的）

| 能力 | 设计 |
|---|---|
| **事实来源与参考链接** | `cms_article_sources`：`url/title/publisher/published_at/source_type/accessed_at/quote`；页面底部「资料来源」区（可见、可点）；JSON-LD `citation` 输出。**`source_type` 分档与资讯模块的 R6/R7 保持同一口径**（`official` > `trade` > `database` > `community`） |
| **作者/编辑/时间** | `author_id` / `editor_id` → 页面 byline（真实姓名或稳定笔名 + 简介页/锚点）+ `<time datetime>`；JSON-LD `author`(Person)/`editor`/`datePublished`/`dateModified`。**时间必须真实变更，不得为 SEO 造假更新** |
| **摘要与直接答案** | `excerpt` 40–80 字，置于正文首段前（视觉上作为「结论先行」块）；H2 用问题式写法；关键结论用列表/表格。**这是写作规则，不是技术开关** |
| **实体知识关联** | `cms_article_entities` → 页面「相关作品/角色」区（内链到 `/movie.html?id=`）+ JSON-LD `about`/`mentions`（`Thing` + `@id`） |
| **实体 ID 与外部对齐** | 建议为作品/角色引入 `sameAs`（IMDb/TMDB/Wikidata 链接）。**当前数据无此字段**，需要单独的数据增补（不能靠 CMS 猜） |
| **内容质量检查** | §11.6 的 12 项规则，发布前阻断/告警分级 |
| **静态可读** | §9.9 |

### 11.5 「直接答案结构」的具体模板（建议）

```markdown
> **一句话结论**（40–80 字，先回答标题问题，可被独立引用）

## 为什么（3–5 句，给出因果）
## 关键事实（列表：时间/人物/作品，每条可追溯到 sources）
## 常见误解（可选）
## 资料来源
```

理由：AI 检索器抽取的是**可独立成立的段落**。把结论放最前、把事实做成列表、把来源单独成节，是**提高被正确引用概率**的结构性做法，**不是保证**。

### 11.6 GEO 质量检查规则（12 项，可自动执行）

| # | 规则 | 级别 |
|---|---|---|
| 1 | `excerpt` 存在且 40–80 字 | 阻断发布 |
| 2 | 至少 1 条 `sources` 且含 `url` | 阻断 |
| 3 | `source_type` 至少一条 `official` 或 `database`（纯社区源需标注「未经官方确认」） | 告警 |
| 4 | `author_id` 非空 | 阻断 |
| 5 | `datePublished` 与 `dateModified` 均存在且后者 ≥ 前者 | 阻断 |
| 6 | 正文 ≥ 600 字（中文）| 告警（<300 阻断） |
| 7 | H2 ≥ 2 个，且至少 1 个为问句式 | 告警 |
| 8 | 至少 1 个列表或表格 | 告警 |
| 9 | 至少 1 个实体关联（且实体存在） | 告警 |
| 10 | 正文与实体中文名一致（如写「钢铁侠」则关联 `iron-man`） | 告警 |
| 11 | 无「据悉/有消息称/网传」等无源表述 | 告警（有 sources 可豁免） |
| 12 | 标题与正文首段语义一致（关键词命中） | 告警 |

分数：`100 - Σ权重`，`< 70` 在后台标红但**不阻断**（除阻断级）；阻断项未过则不能发布。

### 11.7 明确不做/不承诺

- ❌ 不承诺任何 AI 平台会引用、不承诺排名、不承诺流量
- ❌ 不做「AI 专用隐藏文本」（黑帽）
- ❌ 不做自动生成文章（V1 明确排除）
- ❌ 不做 `llms.txt` 之外的"AI 协议"私有格式

---

## 12. 部署目录与端口建议

### 12.1 目录结构（建议新建，全部在 Web root 之外，除 2 个软链）

```
/www/wwwroot/mcu-cms/                  root:root 755
├── app/                               mcucms:mcucms 750   ← CMS 源码（零依赖）
│   ├── server.cjs                     HTTP 入口（复用 forum 路由模式）
│   ├── router.cjs  auth.cjs  config.cjs
│   ├── repo/                          SQLite 访问层
│   ├── render/                        Markdown + 模板 + JSON-LD
│   ├── build/                         构建器 + 15 项校验器
│   └── admin/                         后台静态页面（原生 HTML/JS）
├── data/                              mcucms:mcucms 700
│   ├── cms.db (+ -wal/-shm)           600
│   ├── media/YYYY/MM/*.webp           644（经软链对外）
│   └── secret.key                     600（自动生成，会话/CSRF 派生）
├── releases/
│   ├── 0001/article/…  0002/…         递增，保留最近 10 批
│   └── 0007/sitemap-urls.txt|verify.json|baseline.json
├── logs/                              mcucms 750（cms.log，logrotate）
└── tmp/                               构建临时区（同分区，保证 rename 原子）

对外软链（仅 2 个，均为"新增"，不改任何现有文件）：
/www/wwwroot/mcu-h5/article  → /www/wwwroot/mcu-cms/releases/<current>/article
/www/wwwroot/mcu-h5/media    → /www/wwwroot/mcu-cms/data/media
```

> **为什么 `releases` 与 `tmp` 必须同分区**：`rename(2)` 跨文件系统会退化为复制+删除，失去原子性。`/www` 全在 `/dev/vda3`，满足。【核实】

### 12.2 端口与访问方式

| 方案 | 端口 | 公网暴露 | Nginx 改动 | 建议 |
|---|---|---|---|---|
| **A. SSH 隧道（V1 推荐）** | `127.0.0.1:8790` | ❌ 无 | **0 处** | ✅ `ssh -L 8790:127.0.0.1:8790 mcu-atlas` → 浏览器开 `http://127.0.0.1:8790/` |
| B. `/cms/` 反代 | 8790 | 是 | 1 处 `location ^~ /cms/` + 基础认证 + IP 白名单 | ⏭ V1.5（需审批） |
| C. 子域 `cms.mcuatlas.xyz` | 8790 | 是 | 新 vhost + **新证书**（现有 DV 单域名不覆盖子域） | ⏭ 成本较高 |
| D. 复用论坛 8787 | — | 是 | 0 | ❌ 违反边界（§5.4） |

**为什么 8790**：8787 已被论坛占用；8800+ 区间在宝塔常用段内（888/8888 已用），8790 与二者无冲突且易记。**端口空闲只是必要条件**，实际可行性由内存与访问方式决定（§2.7）。

### 12.3 图片存储方案

| 项 | 决定 |
|---|---|
| 原件位置 | `/www/wwwroot/mcu-cms/data/media/YYYY/MM/<sha8>-<slug>.webp`（Web root 外） |
| 对外访问 | `https://www.mcuatlas.xyz/media/YYYY/MM/xxx.webp`（软链 `/www/wwwroot/mcu-h5/media`） |
| 为什么软链 | ① 原件不在 Web root，避免"上传目录可执行/可列目录"风险；② 无需 nginx 改动；③ 迁移只需换软链 |
| 格式策略 | 只收 `jpg/png/webp`（**禁止 SVG**，XSS 面）；单张 ≤ 2 MB；服务端读 magic bytes + 解析宽高，**不重编码**（零依赖限制） |
| 命名 | 内容哈希前缀 + 语义 slug，天然去重、可缓存 |
| 现有海报 | **不迁移**（`assets/posters` 保持原样，CMS 只读引用） |

### 12.4 systemd 单元（建议）

```ini
[Unit]
Description=MCU Atlas CMS (V1) - Node.js 24 / SQLite WAL
After=network.target

[Service]
Type=simple
User=mcucms
Group=mcucms
WorkingDirectory=/www/wwwroot/mcu-cms/app
ExecStart=/opt/node24/bin/node /www/wwwroot/mcu-cms/app/server.cjs
Restart=always
RestartSec=3
MemoryMax=192M
MemoryHigh=160M
Environment=NODE_ENV=production
Environment=NODE_OPTIONS=--max-old-space-size=160
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/www/wwwroot/mcu-cms
# 只允许写自己的目录；发布切换软链所需的 mcu-h5 写权限通过 ACL 最小授予（见 §13.5）
```

> `ProtectSystem=strict` 下 `/www/wwwroot/mcu-h5` 只读；发布时切换软链需要额外写权限 → 用 **ACL 给 `mcucms` 对 `mcu-h5` 目录的 `w` 权限**（不加组、不给文件写权限），或用**一次性的 root 助手脚本**（`/usr/local/bin/mcu-cms-switch`，仅接受 release 号，白名单校验）。推荐后者：**CMS 进程永远不能直接写 `mcu-h5`**。

---

## 13. 安全与备份方案

### 13.1 威胁模型（针对本项目实际情况）

| 威胁 | 现实性 | 对策 |
|---|---|---|
| 后台公网暴露被爆破 | 高（若走方案 B/C） | V1 仅 loopback；登录限速 + 锁定；口令 ≥ 12 位 |
| XSS 通过文章正文 | 高（编辑内容） | Markdown **转义优先**；禁用原始 HTML（或白名单极小子集）；CSP `default-src 'self'` |
| 上传恶意文件 | 中 | 白名单类型 + magic bytes + 禁 SVG + 路径固定 + 不执行 `media/` 下任何脚本（`location ~* /media/.*\.(php|cjs|js)$ { deny all; }`，需 nginx——V1 靠不写这类文件） |
| 会话劫持 | 中 | `HttpOnly + Secure + SameSite=Strict`；token 只存哈希；12 h 过期；改密即全撤销 |
| CSRF | 中 | 双提交 token + `SameSite` |
| 路径穿越（媒体删除/预览） | 中 | 所有路径走 `path.resolve` 后校验前缀白名单 |
| 发布流程被滥用 | 中 | 发布仅 `owner/editor`；每次发布写审计；release 不可变 |
| 依赖供应链 | **无**（零依赖） | 天然免疫 |
| 论坛被攻破横向到 CMS | 中 | 不同用户、不同目录、不同 DB、不同进程；`NoNewPrivileges` |

### 13.2 备份方案（沿用现有模式，全部在 Web root 外）

| 对象 | 方式 | 频率 | 保留 |
|---|---|---|---|
| `cms.db` | `sqlite3 cms.db ".backup 'backup/cms-$(date).db'"`（在线安全，WAL 友好） | 每日 03:40（避开 03:30 论坛备份） | 14 份 |
| `releases/` | 保留最近 10 批（旧的删） | 每批 | 10 |
| `data/media/` | 每周 `tar.gz`（可选，量大后单独策略） | 每周日 | 8 份 |
| 恢复演练 | 每季度从备份恢复一次到 `tmp/` 并跑校验器 | 季度 | — |

> 与现有 `backup-forum.sh` 完全同构，cron 一行即可。**备份目录 `/www/backup/cms-db/`**，不在任何 Web root 下。【核实+建议】
> **注意**：目前所有备份都在同一块盘（`/dev/vda3`），**无异地备份**。这是全站级风险（不只 CMS），建议后续单独处理（见 §14 R4）。

### 13.3 回滚矩阵

| 故障 | 回滚动作 | 耗时 |
|---|---|---|
| 单篇文章内容错误 | 后台「回滚到修订 N」→ 重新发布（新 release） | 1 分钟 |
| 整批发布出错（模板/样式） | 切换软链到上一 release | **< 1 秒** |
| DB 损坏 | 停服务 → 恢复最近备份 → 起服务（文章丢失 = 备份后新增部分，靠 revisions 可补） | 5 分钟 |
| 软链被误删 | 按 `cms_settings.current_release` 重建软链 | 1 分钟 |
| CMS 服务完全不可用 | 停 `mcu-cms.service`；现有站点不受影响（文章目录静态存在） | 即时 |

### 13.4 已知安全限制（如实说明）

1. **零依赖下无法重编码图片**：只能校验类型/尺寸，无法剥离 EXIF 或二次压缩。对策：禁止 SVG、限制体积、`Content-Disposition: inline` 且正确 `Content-Type`（由 nginx 按扩展名给出）。
2. **无 WAF 级防护**：宝塔 WAF 是否对 CMS 生效取决于其规则，本次未验证 → 【待验证】。
3. **无多因素认证**：V1 不做（单管理员 + 仅本机访问，风险可接受）；若开公网必须补（TOTP 需自写 ~100 行）。
4. **无并发编辑冲突的实时提示**：仅乐观锁（`revision_no`）→ 后保存者收到 409 并看到差异提示。

### 13.5 权限最小化落地

```bash
# 用户
useradd -r -s /sbin/nologin -d /www/wwwroot/mcu-cms mcucms

# 目录
install -d -o mcucms -g mcucms -m 700 /www/wwwroot/mcu-cms/data
install -d -o mcucms -g mcucms -m 700 /www/wwwroot/mcu-cms/releases

# CMS 进程对 mcu-h5 只读；唯一写入口是一次性助手脚本
chown root:root /usr/local/bin/mcu-cms-switch && chmod 4750 /usr/local/bin/mcu-cms-switch
# 助手脚本：校验 release 号 ∈ DB 已 verified 列表 → ln -sfn + mv -Tf → 退出
```

> 该设计让「**任何代码漏洞都无法直接写现有站点文件**」——即使 CMS 被完全控制，攻击面也只到 `mcu-cms/` 与发布目录。

---

## 14. 开发工作量与主要风险

### 14.1 工作量拆解（开发 AI 视角，串行，人日）

| 里程碑 | 内容 | 人日 |
|---|---|---|
| **M0 基线冻结与守卫** | 冻结集 sha256 基线脚本；`releases/` 骨架；`mcu-cms-switch` 助手；systemd 单元；备份 cron | **2** |
| **M1 数据与鉴权** | `schema.sql` + `repo` 层；用户/会话/scrypt；审计日志；health | **3** |
| **M2 文章核心** | 文章 CRUD + 乐观锁 + 修订 + 软删；分类/标签 | **4** |
| **M3 关联与媒体** | 实体只读加载（`vm`）+ 关联面板 API；来源管理；媒体上传与校验 | **3** |
| **M4 渲染与构建** | 受限 Markdown 渲染器；文章/分类/索引模板；JSON-LD；RSS；15 项校验器 | **4** |
| **M5 发布与 Sitemap** | release 构建/校验/软链切换/回滚；扩展 `generate-sitemap.cjs`；HTTP 自检 | **3** |
| **M6 后台 UI 与验收** | 原生后台（列表/编辑/预览/关联/GEO 面板/发布记录）；端到端验收脚本 | **3** |
| **合计** | | **18–22 人日** |

> 不含：现有 15 页静态化、作品页预渲染、301 的 nginx 变更、资讯接入、小程序端任何改动。这三类若做，另计 6–10 人日。

### 14.2 风险登记（按严重度）

| # | 风险 | 等级 | 影响 | 缓解 |
|---|---|---|---|---|
| **R1** | **内存不足导致 OOM / swap 抖动**（可用 146 MB，php-fpm + MariaDB 已占 420 MB） | **高** | CMS 或现有服务被 OOM Killer 杀掉（`oom_score` 高者先死，可能是 forum/nginx） | `MemoryMax=192M` + `MemoryHigh=160M`；构建串行（`flock`）；构建用 `--max-old-space-size=128`；**上线前必须 owner 决定是否停 WordPress**；先跑一次"内存演练"（构建 + 并发访问） |
| **R2** | **证书 2026-12-14 到期且无自动续签覆盖** | **高** | 全站 HTTPS 失效（含 CMS 静态页） | 立即在阿里云续签并部署；把 `mcuatlas.xyz` 纳入 acme.sh（需 DNS API 或 webroot）；上线前把「证书到期日」写入运维台账 |
| **R3** | **Sitemap 双写互相覆盖** | 中 | 文章 URL 消失，收录丢失 | §9.6 单一所有者 + 只增不减守卫 |
| **R4** | **全站备份与生产同盘，无异地** | 中 | 磁盘/误删即全损 | 后续单独处理（对象存储/异地），本次仅登记 |
| **R5** | **`/api/` 前缀冲突导致 CMS 接口 404** | 中 | 开发返工 | 本报告已明确前缀规则；后台 UI 与 API 全走 `/cms/` |
| **R6** | **数据双源风险（治理铁律）**：CMS 若自行缓存/复制作品数据 | 中 | 破坏"单一数据源"铁律 | 只读 `vm` 加载、内存缓存 5 分钟、**零写回**、DB 不留作品副本（只存 id） |
| **R7** | **slug 改名无 301** | 中 | 外链失效、权重流失 | V1 锁 slug；301 列 V1.5（需 nginx 变更） |
| **R8** | **`try_files` 与软链的边界**（符号链接是否被 nginx 跟随） | 低 | 文章 404 | 已核实本机存在同类软链示例且工作正常；上线前用 1 条测试页验证；`disable_symlinks` 未配置 |
| **R9** | **宝塔面板 :8888 与 MariaDB :3306 对外监听**（安全组待验证） | 中 | 面板爆破风险（影响全站，不只 CMS） | 建议安全组只放 80/443/22；**本次未改**，仅登记 |
| **R10** | **单人维护 + 无 CI** | 中 | 守卫被绕过 | 所有校验写成脚本 + 退出码；发布按钮只调用脚本，不允许"手动 cp" |
| **R11** | **不执行 JS 的抓取器看到同质模板页（现有 38 作品页）** | 中 | 收录质量低 | 已知负债；V1 不处理；建议独立整改 |
| **R12** | **WordPress 遗留站持续被扫描/打日志** | 低-中 | 资源与日志膨胀 | 建议 owner 决策下线；本次不动 |

---

## 15. 第一版开发任务拆分及验收标准

### 15.1 任务清单（可直接排期）

| ID | 任务 | 交付物 | 验收标准（可执行） |
|---|---|---|---|
| T1 | 基线冻结 | `tools/freeze-baseline.cjs`，`baseline.json` | 对 15 HTML + 15 data JS + 3 JS + 5 CSS 生成 sha256；重复运行结果一致 |
| T2 | 目录与权限 | `/www/wwwroot/mcu-cms/**`、`mcucms` 用户、systemd 单元 | `systemctl start` 成功；RSS < 40 MB；`ProtectSystem` 生效（写 `mcu-h5` 应失败） |
| T3 | 数据库 | `schema.sql` + `repo` 层 | 幂等初始化（重复执行不报错）；WAL 开启；`PRAGMA journal_mode` = `wal` |
| T4 | 鉴权与审计 | `auth.cjs`、`cms_sessions`、`cms_audit_log` | 错误口令 5 次锁定；会话 12 h 过期；登录/退出/发布均留审计行 |
| T5 | 文章 CRUD | 后台列表/编辑、乐观锁 | 并发保存第二次返回 409；修订号自增；软删后不出现在列表 |
| T6 | Markdown 渲染器 | `render/markdown.cjs` | 20 条用例（标题/列表/表格/代码/链接/嵌套/恶意 `<script>` 应被转义）全通过 |
| T7 | 实体关联 | 关联面板 + 校验 | 关联不存在的 id → 阻止并提示；关联后构建期能取到中文名 |
| T8 | 来源管理 | `cms_article_sources` + 编辑 UI | 无来源的文章发布被阻断；来源 URL 非法协议被拒 |
| T9 | 媒体 | 上传/列表/删除 | 上传 `.svg` 被拒；> 2 MB 被拒；伪造扩展名（png 内含 js）被 magic bytes 拒 |
| T10 | 构建器 | `build/build.cjs` | 生成 3 篇测试文章；HTML 内**可 grep 到正文全文**；`<script>` 计数 = 0 |
| T11 | 校验器 | 15 项检查 | 每项都有"故意制造失败"用例，且能被拦截（15/15） |
| T12 | 原子发布 | `mcu-cms-switch` + release 流程 | 发布前后现有 15 页 sha256 不变；软链切换 < 1 s；旧 release 可回切 |
| T13 | 回滚 | 后台「回滚到批次 N」 | 回切后线上内容等于该批次；审计留痕 |
| T14 | Sitemap 扩展 | `generate-sitemap.cjs --extra` | `--check` 仍通过；缺 URL 时拒绝写入；写入为原子替换 |
| T15 | SEO 输出 | 文章页 head 全量 | 无 JS 环境（`curl`）下 `title/desc/canonical/robots/OG/JSON-LD` 全部正确且唯一 |
| T16 | GEO 检查 | 12 条规则 | 每条规则有正/反用例；分数与 issues 落库 |
| T17 | 后台 UI | 6 个页面（登录/列表/编辑/关联/发布/审计） | 无框架、无构建；移动端可用；`curl` 无 token 访问全部 401 |
| T18 | 端到端验收 | `tools/e2e.cjs` | 建 3 篇 → 校验失败 1 次被拦 → 修复 → 发布 → curl 断言 200 且正文在源码 → 回滚 → 断言恢复 |
| T19 | 文档 | 运维手册 + SOP | 覆盖：启动/停止/备份/恢复/发布/回滚/证书/新增作者 |

### 15.2 V1 验收总标准（Definition of Done）

1. **零影响**：发布前后，现有 15 个 HTML、15 个 data JS、3 个 JS、5 个 CSS 的 sha256 **完全不变**（T12 断言）。
2. **零依赖**：`ls /www/wwwroot/mcu-cms/app/node_modules` 不存在；`npm` 从未在服务器执行。
3. **零 nginx 改动**：`nginx -T` 输出与开发前快照一致（除后续显式审批项）。
4. **正文在源码**：`curl -s https://www.mcuatlas.xyz/article/<slug> | grep -c "<正文首句>"` ≥ 1，且 `<script>` 计数 = 0。
5. **SEO 完整**：单页同时具备唯一 title / description / canonical / robots / 5 项 OG / 合法 JSON-LD。
6. **可回滚**：任一历史 release 可在 1 分钟内恢复，且回滚本身留审计。
7. **不双写**：`grep -r "sitemap.xml" app/` 只出现在"调用生成器"处，不存在直接写文件。
8. **内存达标**：常驻 RSS ≤ 40 MB；构建峰值 ≤ 128 MB（`/usr/bin/time -v` 记录）。
9. **审计完整**：登录、保存、发布、回滚、删除、上传六类动作全部留痕。
10. **失败安全**：任一校验失败，线上零变化（用"故意注入坏模板"验证）。

---

## 16. 核实状态矩阵（已核实 / 方案建议 / 待验证）

### 16.1 已核实（本次亲自看到，可作为开发前提）

| # | 事实 |
|---|---|
| 1 | 系统 Alibaba Cloud Linux 3，内核 5.10.134-19.1.al8，2 vCPU，896 MiB 内存，可用 146 MiB，swap 1 GiB |
| 2 | 磁盘 30 G / 已用 12 G / 可用 16 G（43%） |
| 3 | Node v24.9.0 位于 `/opt/node24/bin/node`；系统 PATH 无 `node`；`npm` 需改 PATH 才能跑 |
| 4 | `node:sqlite` 可用，`process.versions.sqlite = 3.50.4`；系统 `sqlite3` CLI 为 3.26.0 |
| 5 | 监听端口：22/80/443/888/8888/3306 + 127.0.0.1:8787 |
| 6 | Nginx 1.26.3；站点配置 `mcuatlas.xyz.conf`；`location /` 为 `try_files $uri $uri.html $uri/ =404` |
| 7 | `location ^~ /api/` → `127.0.0.1:8787`，限流 10 r/s burst 20 |
| 8 | 缓存策略：`.html` no-cache；`/data/*.js`、`/assets/js/*.js` no-cache；css/js/json 7d；图片 30d |
| 9 | 证书 `CN=www.mcuatlas.xyz`，有效期至 **2026-12-14**；acme.sh 未托管该域 |
| 10 | `mcu-forum-api.service`：`User=forumapi`、`MemoryMax=150M`、RSS 12.7 MB、零 npm 依赖、SQLite WAL、5 张表 |
| 11 | H5：15 个 HTML、5 个 CSS(174 KB)、3 个 JS、15 个 data JS(688 KB)；首页负载约 343 KB JS + 174 KB CSS |
| 12 | 数据规模：released 59（movie 38/series 14/special 2/short 5）、all 62、upcoming 3、角色 25、关系 92、路线 11、专题 1、资讯 54 |
| 13 | `characters.js` 仅 6 字段；作品 `content` 含 5 个来源字段；资讯 33 字段 |
| 14 | canonical：5 页静态 + 4 类参数页运行时注入；`news-detail.html` 有静态 `noindex` |
| 15 | JSON-LD 全站 0；OG 仅运行时且无 `og:image`；robots.txt 仅一组 `User-agent: *` |
| 16 | `sitemap.xml` 76 条，由 `h5/tools/generate-sitemap.cjs` 生成并带多重守卫 |
| 17 | `/llms.txt`、`/rss.xml`、`/blog/`、`/article/` 均 404；无自定义 404 页 |
| 18 | 资讯流水线为纯 CLI 文件流水线；cron 仅 08:00 采集；`enabled/autoProduction/productionAllowed` 三处为 false |
| 19 | 备份现状：论坛库每日 03:30 `.backup` 保留 14 份；`/www/backup/forum-db` 在 Web root 外 |
| 20 | `shared/data` 同步只覆盖 `wechat/`、`douyin/`；`h5/data` 走人工适配，不在自动同步内 |
| 21 | WordPress 遗留站 177 MB，`127.0.0.1.conf` 仍是 `default_server`；`yaoqiang.xin.log` 159 MB |
| 22 | 宝塔面板与 MariaDB 监听 `0.0.0.0`；本机 iptables 无规则（实际暴露取决于安全组） |

### 16.2 仅为方案建议（未实现、未验证）

| # | 建议 |
|---|---|
| 1 | 方案 A：Node 24 + `node:http` + `node:sqlite` + 原生前端（零依赖、零构建） |
| 2 | 文章 URL 采用 `/article/<slug>`（无扩展名 canonical，`.html` 文件） |
| 3 | 发布采用 `releases/<seq>` + 目录软链原子切换；回滚 = 换指针 |
| 4 | Sitemap 保持单一所有者，扩展 `--extra`，禁止 CMS 直接写 |
| 5 | V1 后台仅 `127.0.0.1:8790` + SSH 隧道；`/cms/` 反代列 V1.5 |
| 6 | V1 锁 slug；301 列 V1.5（需一次 nginx 变更） |
| 7 | 下架用 `noindex` 桩页而非删除/410 |
| 8 | 媒体存 `mcu-cms/data/media` + `mcu-h5/media` 软链暴露 |
| 9 | 14 张表结构（§7.3） |
| 10 | 23 个 API 端点（§8.2） |
| 11 | GE0 12 条检查规则 + 阻断/告警分级（§11.6） |
| 12 | 工作量 18–22 人日，6 个里程碑 |
| 13 | 权限最小化：CMS 进程不直接写 `mcu-h5`，改用一次性 root 助手脚本 |
| 14 | robots.txt 分爬虫分组（检索类允许、训练类按 owner 意愿） |
| 15 | RSS `/article/feed.xml`；`llms.txt` 低优先、不承诺效果 |

### 16.3 仍需进一步验证（本次主动停止，未越界）

| # | 待验证项 | 为什么停 | 需要什么条件 |
|---|---|---|---|
| 1 | 阿里云安全组实际放行端口 | 无控制台权限 | owner 在控制台确认 80/443/22 之外是否有 8888/3306 暴露 |
| 2 | 宝塔 WAF 是否对 `/cms/` 生效 | 需改配置或看面板 | 面板只读查看或安全组调整 |
| 3 | 内存演练（构建 + 后台 + 现有服务同跑） | 需起进程、装服务 | 开发阶段在测试窗口执行，并准备好回退 |
| 4 | nginx 是否跟随软链（`disable_symlinks`） | 需创建测试软链 | 开发阶段用 1 个测试页验证，风险极低 |
| 5 | MariaDB 内实际数据库与 WordPress 是否在用 | `mysql` 需口令，属敏感凭证 | owner 提供或自行查看面板（本报告**未尝试**获取口令） |
| 6 | 现有 38 个作品页在百度/Google 的真实收录表现 | 需站长平台账号 | owner 提供后台截图或授权查询 |
| 7 | AI 爬虫实际抓取情况（GPTBot 等是否来访） | 需查 nginx access log 的 UA 分布；本次未导出全量日志 | 一条 `grep -c` 即可，属只读，可作为下一轮核查项 |
| 8 | 现有 `h5/tools/*.cjs` 在本机 Node 版本下是否全绿 | 本次未跑（只读任务，避免产生文件） | 开发阶段先跑一次基线回归 |
| 9 | CDN 是否存在（DNS 直指 ECS，判断为无） | 只看到 DNS A 记录 | 确认阿里云是否另配 CDN 加速 |
| 10 | 真实 sitemap 收录覆盖（76 条中多少被索引） | 需站长平台 | 同 #6 |

### 16.4 停止条件触发记录（本任务）

| 触发点 | 处理 |
|---|---|
| 需要 `npm install` 才能用某些库 | **未执行**，改为零依赖方案（§6.1） |
| 需要 `mysql` 口令查看 MariaDB | **未尝试**，标记【待验证】 |
| 需要改 Nginx 才能做 301 / 反代后台 | **未改**，方案降级为"锁 slug + SSH 隧道"（§9.7、§12.2） |
| 需要起进程验证内存 | **未起**，改为估算 + 列为开发阶段演练（R1） |
| 需要写 `/tmp` 做 SQLite 兼容性测试 | **未写**，改用"forum-api 已生产运行"作为存在性证据 |

---

## 附录 A：本次只读核查命令索引（可复现）

```bash
# 环境
ssh mcu-atlas "uname -a; cat /etc/os-release; nproc; free -m; df -hT; uptime"
ssh mcu-atlas "/opt/node24/bin/node -v; /opt/node24/bin/node -p process.versions"
ssh mcu-atlas "sqlite3 --version; rpm -qa | grep -i sqlite"
# 服务与端口
ssh mcu-atlas "ss -tlnp; systemctl list-units --type=service --state=running"
ssh mcu-atlas "systemctl cat mcu-forum-api.service; systemctl status mcu-forum-api.service"
# Nginx 与证书
ssh mcu-atlas "nginx -v; ls /www/server/panel/vhost/nginx/; sed -n '1,200p' /www/server/panel/vhost/nginx/mcuatlas.xyz.conf"
ssh mcu-atlas "openssl x509 -in /www/server/panel/vhost/cert/mcuatlas.xyz/fullchain.pem -noout -subject -dates -issuer"
ssh mcu-atlas "ls /root/.acme.sh/"
# 站点与数据
ssh mcu-atlas "ls -la /www/wwwroot/mcu-h5/ /www/wwwroot/mcu-h5/data/"
ssh mcu-atlas "grep -c 'verification_status:' .../news.js; grep -c 'from:' .../relations.js"
# 线上只读探测
ssh mcu-atlas "curl -ksI https://www.mcuatlas.xyz/ | head -20"
ssh mcu-atlas "curl -ks https://www.mcuatlas.xyz/robots.txt; curl -ks https://www.mcuatlas.xyz/sitemap.xml | grep -c loc"
ssh mcu-atlas "curl -ksI https://www.mcuatlas.xyz/llms.txt | head -1"
# 本地
# vm 加载 h5/data/*.js 统计条目（读操作，脚本置于临时目录并已删除）
```

> **凭据纪律**：全程未 `cat` 任何 `*.key`、`.env`、`dashscope.env`、`config` 中的密钥字段；本报告不含任何口令、Token、私钥内容。

## 附录 B：本报告的边界声明

1. 本报告**只做核查与规划**，不构成开发承诺；所有工作量估算基于单人串行开发。
2. 报告中的"已核实"仅覆盖 2026-11-09 本次核查时的状态；服务器后续变更不在覆盖范围。
3. 报告中提到的"必须改动 Nginx / 停止 WordPress / 续签证书"均为**上报项**，本任务**未执行**。
4. 关于 GEO：本报告**不承诺**任何 AI 平台会引用本站内容；所有 GEO 手段均为概率性、结构性优化。
5. 关于现有 15 页的 SEO 短板（不执行 JS 时同质标题、参数页无静态 canonical）：属**已知存量负债**，V1 明确不处理，登记在 §10 与 §14 R11。
