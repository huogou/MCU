# MCU 观影导航 · 项目总览（AI 协作版）

> **本文件用途**：让任何新加入的 AI 在 5-10 分钟内建立项目全貌，作为后续协作的事实基础。
> 不替代 `给策划AI/开发AI/设计AI同步文件.txt`（三角色间的窄向协同通道），也不替代 README/VERSION（产品/版本元数据）。
>
> **维护**：随项目推进同步更新；大改动后整段重写而非追加（沿用"归档后重写"约定）。
> 最后更新：2026-09-08（当前状态校正：抖音 V1.3.0 提审准备态 · H5 阿里云正式运行 · 三端状态对齐）

---

## 1. 一句话定位

**MCU 观影导航** = 「陪用户探索漫威宇宙的观影助手」。

以"作品（电影/剧集）+ 关系 + 路线 + 进度"为内容核心，覆盖 H5、微信小程序、抖音小程序三端，服务于"传播→首体验→长期使用"的闭环。

---

## 2. 平台矩阵（产品闭环）

| 端 | 定位 | 用户场景 | 当前生产地址 / AppID |
|---|---|---|---|
| **H5** | 外部获客 / 首体验 | 微信/浏览器分享链接打开 | `https://mcu.yaoqiang.xin/`（**阿里云轻量正式运行**；品牌域名 `mcuatlas.xyz` 备案后切换） |
| **微信小程序** | 长期使用 / 进度沉淀 | 核心用户日活 | AppID `wx78f00e7f0a5948b7`，V1.2.0 已发布 |
| **抖音小程序** | 作品查询 / 个人记录工具 | 抖音用户作品查询与进度管理 | AppID `tt00eb76569e914af801`，**V1.3.0（提审准备阶段）** |

**核心用户路径**（共享心智；H5/微信为完整链路）：`顺序 → 路线 → 下一部 → 关系 → 地图 → 进度`。抖音为轻量工具版，仅保留「作品查询 → 已看/收藏 → 进度管理」子链路。

---

## 3. 仓库结构（Monorepo）

项目根：`D:\SEO\发挥余热\漫威电影宇宙导航\`

```
.
├── wechat/                    # 微信小程序源码（基线 wechat-production → baf309b）
├── douyin/                    # 抖音小程序源码（提交 22494e1，V1.3.0，2 次驳回整改后形态）
├── h5/                        # H5 源码（与线上同源，121 文件）
├── shared/                    # 跨端共享数据（11 个 data/*.js + 1 个 sh，H5+抖音直接 import）
│
├── 给策划AI同步文件.txt       # 协同通道：用户/策划 → 开发
├── 给开发AI同步文件.txt       # 协同通道：用户/策划/设计 → 开发（Work）
├── 给设计AI同步文件.txt       # 协同通道：用户/策划 → 设计（QoderWork CN）
│
├── README.md                  # 产品 README
├── DESIGN.md                  # 设计规范（两小程序共用）
├── VERSION.md                 # 版本号与发布记录
├── MCU项目总览.md             # ★ 本文件（AI 协作总览）
│
├── workspace/                 # 临时工具/脚本/部署文件（不入产品构建）
│   ├── deploy/                 # 阿里云 H5 部署相关（conf/脚本/打包）
│   ├── ocr.ps1, *.js, *.mjs   # 临时自测脚本
├── AI生成文件/                # 报告/截图/分类（已被 .gitignore 覆盖，**不在 Git**）
├── backup/                    # 基线/发布备份（368 文件）
└── 恢复资料/                  # D7→D10 抢救资料
```

**关键 Git 标记**：
- 微信：`wechat-production` → `baf309b`（只读基线）
- 抖音：当前 `douyin/` 工作树，提交 `22494e1`（V1.3.0）
- H5：当前 `h5/` 工作树（无单独 tag，H5 与线上同源）

---

## 4. 共享数据层（`shared/data/*.js`）

11 个 JS 是跨端**唯一数据源头**（治理铁律：禁止编造、不得丢入 CMS、禁第二套）。四端各自持有同步副本（`shared/data`、`h5/data`、`douyin/data`、`wechat/data` 各 11 个），由 `shared/sync_data.sh` 从源头单向下发：

| 文件 | 用途 | 体量 |
|---|---|---|
| `movies.js` | 作品信息（59 部 + 剧集，含海报/上映日/阶段/关系） | 31 KB |
| `relations.js` | 关系（92 条，type ∈ {sequel, prereq, character, setup, event, world} + weight 1-3） | 26 KB |
| `routes.js` | 官方/观影路线 | 9 KB |
| `characters.js` | 角色 | 7 KB |
| `series.js` | 剧集元信息 | 7 KB |
| `content.js` | 内容文案（阶段描述等） | 4.7 KB |
| `posters.js` | 海报资源映射 | 3.2 KB |
| `stills.js` | 剧照资源映射 | 3.2 KB |
| `visuals.js` | **含 CloudBase envId `mcu-d6gw0brqoa9521b58`**（Stats/Feedback 写库端点） | 2.8 KB |
| `special.js`, `short.js` | 特殊内容/短片 | — |

**注意**：`visuals.js` 是 H5 端 CloudBase 写库（Stats + FeedbackUI）的 envId 承载文件；**当 CloudBase 写库链路迁移到阿里云时需同步改此文件**。

> ⚠ **单端改写风险**：端上副本是同步产物，手工改动会被 `sync_data.sh` 覆盖。`douyin/data/relations.js:61` 文案中性化即属单端改写未回源（见 §7.3）；如需全端统一，须策划拍板后改 `shared/` 源头再同步。

---

## 5. H5 端

### 5.1 内容与结构

- **形态**：纯静态多页（无构建），5 个 HTML + 11 个 data JS + 资源
- **页面**：`index.html` / `map.html` / `movie.html` / `next.html` / `routes.html`
- **JS**：1 个核心 `assets/js/app.js`（77 KB，路由/状态/视图）+ 11 个 data JS
- **资源**：38 张海报 + 38 张剧照 + 二维码 + 头像/Phase/条目图
- **关系图**：全景 `PANO_CONN` 41 边（三态物理隔离：只读，不可写）
- **入口**：首页 Hero Banner + 2×2 入口卡（作品/角色/关系/时间线）
- **小程序入口**：H5 → 微信 + 抖音双平台 5 档入口（PC 双卡 / 手机纵向 / 微信优先 / 抖音优先 / 二维码降级），由 `app.js` 的 `ui.MP_PLATFORMS` 单一源配置
- **反馈**：底部"我要吐槽"反馈卡，调用 `app.js` 的 `FeedbackUI`，写入 CloudBase `feedback` 集合（mcu.yaoqiang.xin 域名**未在 CloudBase 白名单**，写入会失败，控制台报错但不影响页面）

### 5.2 当前部署（**唯一生产地址**）

```
https://mcu.yaoqiang.xin/
```

| 项 | 值 |
|---|---|
| 服务器 | 阿里云轻量应用服务器（Alibaba Cloud Linux 3 / Nginx 1.26.3 / 宝塔 11.1.0） |
| 外网 IP | `<阿里云ECS公网IP>` |
| 主域（博客） | `yaoqiang.xin`（WordPress 在 `/www/wwwroot/wordpress`） |
| 部署路径 | `/www/wwwroot/mcu-h5/`（121 文件，www:www 755/644） |
| Nginx 站点配置 | `/www/server/panel/vhost/nginx/mcu.yaoqiang.xin.conf` |
| 80 端口 | 全局 301 → HTTPS；`/.well-known/acme-challenge/` 例外（保 acme 续签） |
| 443 端口 | TLSv1.2/1.3 + HSTS + 缓存策略（HTML 不缓存；CSS/JS/JSON 7 天；图片 30 天）+ `try_files $uri $uri.html $uri/ =404` |
| 证书 | Let's Encrypt ECC（`/root/.acme.sh/mcu.yaoqiang.xin_ecc/`，acme.sh 自动续签） |
| DNS | 阿里云 yaoqiang.xin zone 内 `mcu` → <阿里云ECS公网IP> A 记录 |
| SSH | RSA 2048（本地 `AI生成文件/H5/MCU.pem`，**未入库**）；Workbench 一键连接 + sudo 注入 root authorized_keys |

### 5.3 H5 部署历史（决策链）

| 时间 | 方案 | 状态 |
|---|---|---|
| 2026-08-28 | CloudBase 静态托管（`mcu-d6gw0brqoa9521b58-1307093647.tcloudbaseapp.com`） | **2026-09-08 清理**（桶清空 252 文件 → 404） |
| 2026-09-07 | Cloudflare Pages（`mcu-navigator-h5.pages.dev`） | **2026-09-08 清理**（项目删除 → 连接失败） |
| 2026-09-08 | 阿里云轻量 + `mcu.yaoqiang.xin` 子域 | **当前主用** |
| 未来 | 阿里云轻量 + `mcuatlas.xyz`（用户已购、已加 3 条 A 记录、**未备案**） | **待备案后切生产** |

---

## 6. 微信小程序（`wechat/`）

### 6.1 基本信息

- **AppID**：`wx78f00e7f0a5948b7`
- **当前版本**：V1.2.0（已上传后台 2026-08-28 13:29:01）；V1.2.1 含审核反馈修复（删联系方式字段、按钮居中），待上传
- **基线**：`wechat-production` 分支 → `baf309b`（只读）
- **生产 tag**：`v1.2.0-release` → `23e62ce`；`release/v1.2.0` 已冻结

### 6.2 页面结构（15 页 / 4 TabBar）

**TabBar**：首页 / 路线 / 探索 / 我的MCU

```
home（首页 Hero+2×2 入口）        routes（路线列表）        browse（浏览）
movie（电影详情）                  route-detail（路线详情）  explore（探索）
panorama（关系全景 Canvas）        characters（角色列表）    character（角色详情）
my-mcu（我的 MCU）                share（分享）             feedback（反馈 → CloudBase）
about / agreement / privacy
```

### 6.3 数据 / 模型

- `models/mcuData.js` —— 共享数据加载
- `models/userState.js` —— 用户态（已看/收藏/进度）
- `models/recommend.js` —— 推荐逻辑（"下一部"）
- `models/pano.js` —— 全景图节点/边
- 静态 data 来自 `shared/data/*.js`

### 6.4 CloudBase 依赖

`wechat/app.js` 通过 `wx.cloud.init({ env: 'mcu-d6gw0brqoa9521b58' })` 初始化，**仅 `pages/feedback/feedback.js` 使用**（写 `feedback` 集合，3 字段纯文本，无文件上传，已有本地兜底队列）。

→ **这是 CloudBase 环境与微信小程序唯一的耦合点**，迁移到自建后端只需改这一页 + 初始化。

---

## 7. 抖音小程序（`douyin/`）

### 7.1 基本信息

- **AppID**：`tt00eb76569e914af801`
- **产品定位**：**MCU 作品信息查询 + 个人观影记录 + 进度管理 + 收藏工具**（工具型应用，非内容/资讯平台）
- **服务类目**：工具-实用工具-信息查询（类目资质已通过）
- **驳回历史**（2 次，均未过审）：
  - 第 1 次（2026-09-07）：申请「文娱-资讯」类目不符合个人主体资质 → 改类目（非整体过审）
  - 第 2 次：「小程序功能不完整且可用性低」 → 整改为 V1.3.0（补充作品查询/作品详情/收藏/观影进度等工具功能）
- **当前版本**：**V1.3.0（提审准备阶段）**——开发与自动化测试已完成（151 项断言通过），**等待最终真机确认后提交审核；未上传、未过审**
- **核心功能**：作品查询、搜索、类型/阶段/已看筛选、排序、轻量作品详情、标记已看、收藏、我的作品清单、首页作品查询入口

### 7.2 页面结构（9 页 / 3 TabBar）

**TabBar**：首页 / 作品 / 我的MCU（V1.3.0 定稿 3 Tab）

```
home（首页，含作品查询入口）       library（作品：查询/搜索/筛选/排序）       my-mcu（我的 MCU：观影记录/我的作品清单/收藏/进度）
movie（轻量作品详情）              feedback / share / about / agreement / privacy
```

**已删除且禁止恢复**（不作为当前产品功能描述）：`explore` / `panorama` / `characters` / `character` / `routes` / `route-detail`

### 7.3 与微信版的差异（治理要点）

- 抖音版 `movie` 是**轻量工具版**：仅信息表 + 无剧透简介(sf) + 标记已看 + 收藏 + ≤4 条基础关系
- **主动规避 `role` 字段**（剧情作用解读类编辑文本，审核风险）
- `feedback.js`：**纯本地队列**（`tt.getStorageSync/setStorageSync`），数据不上云、不汇总（提交 `1242a65`，策划拍板"选项一 本地"）
- `douyin/data/relations.js:61` 文案已中性化（「失去官方支持」→「失去机构后盾」）；属**单端改写未回源**，`shared/` 源头仍为原文——需全端统一须策划拍板后改源头再同步

### 7.4 测试基建（151 项断言全通过）

- `smoke-tool-features.js`（103 项）—— headless 页面测试范式：桩 `tt` + 桩 `Page()` + 手动实例化 + 直接调方法断言 userState 真实落库
- `smoke-canvas.js`（25 项）—— Canvas 绘制指令执行 / 保存成功 / 写文件失败 / 相册权限拒绝 / Canvas 未就绪 五分支
- `check-visible-content.js`（0 命中）—— WXML 文本 + JS 字符串 + CONTENT 全量禁用词扫描
- `check-tab-icons.js`（23 项，需 sharp）—— 81×81 / 非空白 / 两态异色 / 跨 Tab 无色差（通道偏差 ≤1/255）
- 运行：`cd douyin && node utils/smoke-tool-features.js`；sharp 相关需 NODE_PATH 指向 node workspace

### 7.5 提审决策（2026-09-08 已拍板，不再挂起）

1. 提审版本：**V1.3.0**（about 页已同步版本号与日期）
2. `relations.js`「失去官方支持」：**改为中性表述**（「失去机构后盾」，已落地于 douyin 端）
3. 收藏：**并入"我的MCU"内部功能，不设独立 Tab**（已落地）

---

## 8. 设计语言（微信 + 抖音共用）

| 项 | 值 |
|---|---|
| 主色 p1 | `#5B8DEF` |
| 辅色 p2-6 | `#28B487` / `#F0A932` / `#8B6FE8` / `#E8483F` / `#C25B8E` |
| 背景 bg | `#0B0E14` |
| 表面 surface-1 | `#141925` |
| 强调金 gold | `#E9A93B` |
| 文本 main / secondary / weak | `#E8ECF4` / `#A8B0C0` / `#6B7384` |
| 状态 success / error | `#3FB98A` / `#E5604D` |

- 设计令牌与规范：微信/抖音遵循 `DESIGN.md`（同套 token）
- 以下视觉里程碑为**微信端 V1.2**：首页 Hero Banner + 2×2 入口、电影详情氛围图、角色详情 Hero 增强、关系探索 Canvas 网络图/列表混合、characters/my-mcu 真实图片接入（抖音端无探索/角色/路线页面，不适用）
- 微信 CDN 0.75 MB、主包 ~0.6 MB

---

## 9. 部署与基础设施（汇总）

### 9.1 阿里云轻量（唯一服务器）

| 项 | 值 |
|---|---|
| OS | Alibaba Cloud Linux 3 |
| Web | Nginx 1.26.3 + 宝塔 11.1.0 |
| 外网 IP | `<阿里云ECS公网IP>`（真实值见本地 `.workbuddy/memory/MEMORY.md`，**已 gitignore，不入库**） |
| 主域 | `yaoqiang.xin`（WordPress） |
| H5 | `mcu.yaoqiang.xin`（**正式运行**）→ `mcuatlas.xyz`（品牌域名，备案后切换） |
| SSH | RSA 2048 密钥登录；本地 PEM `AI生成文件/H5/MCU.pem`（未入库） |

### 9.2 DNS

- **Cloudflare**：账号 `huoguo`（Account ID `8caa1fd98ba2ae75794f1bc58c584b13`），OAuth 登录（**仅 pages:write，无 account:write**），H5 Pages 项目已删除
- **阿里云 / 万网**：父域 `yaoqiang.xin` zone（NS `dns3.hichina.com`），H5 子域 `mcu` 已加；新购独立域名 `mcuatlas.xyz`（NS `dns15/dns20.hichina.com`）已加 3 条 A 记录（`mcu`/`@`/`www` → <阿里云ECS公网IP>）

### 9.3 CloudBase（腾讯云开发）

| 项 | 值 |
|---|---|
| EnvId | `mcu-d6gw0brqoa9521b58`（上海） |
| 静态托管 | **已清空**（2026-09-08，252 文件删除） |
| NoSQL 集合 | `feedback`（tnt-h0fzw1o7k），**保留**（小程序 + 新 H5 反馈写入） |
| 云函数 | 0 个 |
| WEB 安全域名 | 仅含原 mcu-navigator-h5.pages.dev（mcu.yaoqiang.xin **未加**，写入会失败） |

### 9.4 凭据索引（不写密码）

| 凭据 | 位置 | 状态 |
|---|---|---|
| 阿里云 SSH 私钥 | `AI生成文件/H5/MCU.pem` | **未入库**（.gitignore `*.pem`） |
| SSH 公钥 | `AI生成文件/H5/MCU.pub` | 已注入服务器 `/root/.ssh/authorized_keys` |
| CF Wrangler OAuth | 浏览器授权本地 keychain | 仍有效（可 `wrangler pages deploy/delete`） |
| CloudBase MCP | 连接器内置 | 可用（manageHosting/queryHosting/readNoSqlDatabase/writeNoSqlDatabase…） |

---

## 10. 治理原则（铁律）

> **优先级**：恢复 > 理解 > 验证 > 修复 > 优化

### 10.1 内容/数据
- **H5 零改动**（一旦上线不擅自改产品）
- **数据单一源**：禁第二套、禁编造、不得丢入 CMS 让用户自改
- **三态物理隔离**：全景图只读，不可写

### 10.2 三角色隔离

| 角色 | AI | 职责 | 边界 |
|---|---|---|---|
| 策划 / 用户 | **用户本人**（项目负责人 + 产品决策） | 定方向、拍板、验收 | 唯一变更授权者 |
| 设计 | QoderWork CN | 出方案/视觉规范 | 不直接改源码，通过同步文件协作 |
| 开发 | **Work（本 AI）** | 执行实现 | 禁接手策划/设计；禁自主设计/改布局/换组件风格 |

> **AI 不擅自动手**——执行前需用户拍板。开发不产设计系统。

### 10.3 源码管理

- 每次修改 → Git 提交 + 版本号 + README/同步文件 + backup
- 跨 AI 协作通过 `给X同步文件.txt`（三份窄向通道）+ `.workbuddy/memory/YYYY-MM-DD.md`（长期记忆）
- `AI生成文件/` 已被 .gitignore 覆盖 → **不在 Git 中**，勿用 git 找回

---

## 11. 协作约定

### 11.1 同步文件（三份无空格文件 = 唯一工作集）

```
给策划AI同步文件.txt  →  GPT/用户（维护：开发/设计）
给开发AI同步文件.txt  →  Work（维护：策划/设计）
给设计AI同步文件.txt  →  QoderWork CN（维护：开发/策划）
```

- 交付物写完整绝对路径 + 扩展名
- 修改列表给相对路径
- 完成后自动写对应通道，无需逐次询问
- **精简约定**：文件过长（>~150 行）时整体覆盖重写为"当前态"而非继续追加。流程：先 cp 原件归档到 `backup/同步文件归档/{YYYY-MM-DD}/` → 再重写 → 文件内注明归档路径

### 11.2 记忆

- `D:\SEO\发挥余热\漫威电影宇宙导航\.workbuddy\memory\` 项目级
  - `YYYY-MM-DD.md` —— 每日工作日志（append-only）
  - `MEMORY.md` —— 长期项目笔记（限 3000 字符/会话）
- `~\.workbuddy\MEMORY.md` 用户级（跨项目）

### 11.3 Backup

- `backup/` —— 基线 / 发布备份（368 文件）
- `恢复资料/` —— D7→D10-A/B 抢救资料
- `backup/同步文件归档/{YYYY-MM-DD}/` —— 同步文件精简前的归档

---

## 12. 当前状态（2026-09-08 截至）

| 项 | 状态 |
|---|---|
| **H5** | **阿里云轻量服务器正式运行**：`https://mcu.yaoqiang.xin/`（HTTPS 200，LE 自动续签；部署 `/www/wwwroot/mcu-h5/`） |
| H5 CloudBase 静态托管 | **已清空**（历史部署记录，旧地址 404） |
| H5 Cloudflare Pages | **已删除**（历史部署记录，旧地址连接失败） |
| H5 新域名 `mcuatlas.xyz` | **已购、未备案**（3 条 A 记录已加），备案后切生产 |
| **微信小程序** | **V1.2.0 已发布**（基线 baf309b）；V1.2.1（审核反馈修复）待后续上传 |
| **抖音小程序** | **V1.3.0 开发完成**（自动化测试 151 项通过），真机最终确认后提审；未上传、未过审 |
| CloudBase 环境 | **保留**（仅静态托管清空，DB/存储仍在，供小程序 + 新 H5 反馈） |
| 博客 yaoqiang.xin | 正常（零影响） |

---

## 13. 待办（按优先级）

### P0（用户已表态）

1. **`mcuatlas.xyz` 备案**（用户已购、待提交工信部）→ 备案完成后启动以下 P1
2. **小程序 feedback 迁移到阿里云**（独立立项，未启动）
   - 范围：`wechat/pages/feedback/feedback.js` + `app.js` 初始化
   - 路径：阿里云建小后端 API（Nginx 反代） + 改 `feedback.js` 用 `wx.request` + 微信公众平台加 `mcu.yaoqiang.xin` 为 request 合法域名（`mcuatlas.xyz` 备案后改用 `mcuatlas.xyz`）
   - **受治理铁律"不重写/需策划把关"约束**，须用户拍板后再动代码

### P1（备案后启动）

3. **`mcuatlas.xyz` 切生产**（替代 `mcu.yaoqiang.xin`）
   - 签发 Let's Encrypt 证书（acme.sh 同 webroot，docroot 不变）
   - 新增 Nginx 站点 `mcuatlas.xyz.conf`（结构与 mcu.yaoqiang.xin 一致，零博客改动）
   - 切换生产 + `mcu.yaoqiang.xin` 退役 + 同步更新小程序/H5 内的固定域名引用（需 grep `mcu.yaoqiang.xin`）
4. **迁移完成后删 CloudBase 环境**

### P2

5. 微信小程序 V1.2.1 上传（含审核反馈修复）
6. 抖音小程序 V1.3.0：抖音开发者工具完成最终真机验收 → 提交审核（3 项提审决策已落地：版本 V1.3.0 / relations 中性表述 / 收藏并入我的MCU）
7. 将 H5 生产域名 `mcu.yaoqiang.xin` 加入 CloudBase WEB 安全域名白名单（恢复 Stats/Feedback 写库；`mcuatlas.xyz` 切生产后再改加新域名）

---

## 14. 风险与合规

| 风险 | 性质 | 应对 |
|---|---|---|
| `mcuatlas.xyz` 未备案 | **微信内置浏览器可能拦截**；不能作为小程序 request 合法域名 | 备案完成前不切换生产、不挂小程序入口 |
| CloudBase 写库依赖共享 env | 删环境会同时坏掉小程序反馈 + 新 H5 反馈 | **环境保留**；小程序迁移后再删 |
| H5 Stats/Feedback 在新域名失效 | 控制台报错；用户数据不写入 | P2 加 CloudBase 白名单解决 |
| 历史反馈数据 | CloudBase feedback 集合内的历史数据 | 迁移时导出/保留；用户决策后处理 |
| 抖音 V1.3.0 | 开发/自动化测试完成，**未做最终真机验收、未提审** | 产品负责人在抖音开发者工具完成人工真机验收（清单见 `AI生成文件/小程序/抖音/`）后提交审核 |

---

## 15. 给新 AI 的协作建议

1. **先读本文件 + `MEMORY.md` + 当日 `YYYY-MM-DD.md`** —— 已能建立 80% 上下文
2. **确认角色边界**：你是策划/设计/开发？若是设计或策划，**不要直接改源码**，通过对应同步文件沟通
3. **执行前先复述理解、给思路大纲、等用户说"继续"才执行**（除非用户说"直接做/举一反三/抽到手册"）
4. **指令编号（如 D10-B）驱动流程**，用户以单字"继续"切换 Step
5. **不可逆操作前必须确认**：DNS 删除、CloudBase 删除、域名切换、Git force push 等
6. **敏感信息不写进代码/文档**：SSH 私钥、API Token、AccessKey 等只放在本地 `AI生成文件/`（已在 .gitignore）
7. **可复用的命令清单**：
   - 部署 H5：`scp` 上传 + `nginx -t && nginx -s reload`
   - 续签证书：`/root/.acme.sh/acme.sh --renew -d mcu.yaoqiang.xin --ecc --force`（或等自动 cron）
   - 删 CF Pages：`wrangler pages project delete <name> --yes`（PATH 加 node 后跑 .bin/wrangler 包装脚本，**勿用 node 直接执行**）
   - CloudBase 清理旧托管：`manageHosting(action=delete, cloudPath="/", isDir=true, confirm=true)`（无"关闭默认域名" action，只能删文件）
   - DNS 探测：`curl -s 'https://dns.alidns.com/resolve?name=<fqdn>&type=A'`（独立源核验，不依赖 nslookup/dig）
8. **踩过的坑**：
   - 不要盲目试 `acme.sh`（Let's Encrypt 每小时 5 次限流），DNS 未生效先 DoH 验 NXDOMAIN
   - 阿里云"绑定密钥对"对运行中实例不自动写 authorized_keys → 用 Workbench 一键连接(Admin)+sudo 注入公钥

---

**置信度：高**。本文件基于实测验证结果（HTTP 状态、DoH 解析、nginx -t、acme.sh 输出、wrangler 输出、CloudBase listFiles/manageHosting 输出）+ Git 历史 + 用户口述。所有"已执行"项均可复验。