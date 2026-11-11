# MCU Atlas www 域名统一与 301 部署验收报告

- **执行方**：CodeBuddy
- **日期**：2026-11-09
- **目标域名**：`mcuatlas.xyz` → **规范域名 `https://www.mcuatlas.xyz`**
- **任务性质**：生产环境 Nginx 配置调整 + H5 本地 SEO 地址同步
- **边界遵守**：本轮**只改** MCU Atlas 的 Nginx 配置、本地 H5 SEO 地址文件，以及向线上上传 2 个原本不存在的纯 SEO 文件；未部署第一轮业务修复、未改小程序/shared 数据、未改其他站点、未推送 Git、未改资讯收录策略。

---

## 摘要

| 验收项 | 结果 |
|---|---|
| 四种域名访问 301 / 200 | **通过**（线上实测，含 `-L` 跟随验证无循环） |
| 路径与查询参数保留 | **通过**（5 组 URL 实测） |
| Nginx 配置语法与 reload | **通过** |
| `/api/` 与 H5 核心页面 | **通过**（线上浏览器渲染 + HTTP 状态） |
| `robots.txt` / `sitemap.xml` 线上 200、76 条全 www | **通过** |
| Canonical 域名全部为 www | **通过**（线上渲染 + 本地全量） |
| 线上 `/index.html`、`/special` 的**路径规范化** | **未达标**，见第 9 节（因边界未部署 H5 业务文件；本地已修复并验证） |

---

## 1. DNS 和 HTTPS 证书检查结果

| 检查 | 命令 / 结果 |
|---|---|
| apex DNS | `Resolve-DnsName mcuatlas.xyz -Type A` → `8.137.48.145` |
| www DNS | `Resolve-DnsName www.mcuatlas.xyz -Type A` → `8.137.48.145`（同一 ECS，无 CDN CNAME） |
| 服务器端解析 | `getent hosts mcuatlas.xyz www.mcuatlas.xyz` → 两者均为 `8.137.48.145` |
| 证书文件 | `/www/server/panel/vhost/cert/mcuatlas.xyz/fullchain.pem` + `privkey.key` |
| 证书 subject | `CN = www.mcuatlas.xyz` |
| 证书 SAN | `DNS:www.mcuatlas.xyz, DNS:mcuatlas.xyz` —— **覆盖 www 与 apex** |
| 有效期 | `2026-09-16 00:00:00 GMT` ～ **`2026-12-14 23:59:59 GMT`**（本轮检查时有效，剩余约 35 天） |
| TLS 握手 | `https://www.mcuatlas.xyz/` 无证书错误，返回 301/200 |

**停止条件判定：未触发** —— www DNS 正确、证书覆盖 www 且有效、站点配置完整，可以实施。

> 提示（需人工安排）：证书 2026-12-14 到期，续签通道 `/.well-known/acme-challenge/` 的 80 端口豁免已在配置中保留，本轮未改动。

### CDN / 代理层

- 响应头仅 `Server: nginx`，无 `Via` / `X-Cache` / `CF-*` 等 CDN 特征；DNS 直接指向 ECS IP。
- 站点内部有 `/api/` 反代到 `127.0.0.1:8787`（`mcu-forum-api`），属业务代理，不影响域名跳转。
- 论坛 API 检查：`grep -rniE "mcuatlas|yaokaixin|allow_origin|cors"` 在 `/www/wwwroot/forum-api` 无域名绑定或 CORS 白名单命中；`systemctl is-active mcu-forum-api` = `active`；本地 `127.0.0.1:8787/api/topics` = 200。
- 小程序端只读检查：`wechat/data/visuals.js`、`douyin/data/visuals.js` 只使用独立图片 CDN `https://mcu.yaokaixin.top`（注释明确「不随 H5 页面域切换」），**未发现 apex API 绝对地址**。

---

## 2. 修改前后的 Nginx 配置差异

**配置文件**：`/www/server/panel/vhost/nginx/mcuatlas.xyz.conf`（宝塔面板 vhost，主配置 `/www/server/nginx/conf/nginx.conf` 通过 `include /www/server/panel/vhost/nginx/*.conf` 加载）。

### 调整前结构（3 个 server block + 1 个限流 zone）

```
limit_req_zone ... zone=forum_api_atlas:10m rate=10r/s;
80   : server_name mcuatlas.xyz www.mcuatlas.xyz mcu.mcuatlas.xyz;
       ACME 豁免 / 百度验证豁免 / location / { return 301 https://mcuatlas.xyz$request_uri; }
443  : server_name mcuatlas.xyz;  ← 业务站（root、证书、缓存、/api/ 反代、try_files、HSTS）
443  : server_name www.mcuatlas.xyz; ← 反向跳转块 { return 301 https://mcuatlas.xyz$request_uri; }
```

### 调整后结构（独立跳转块，业务站不含任何跳转）

```
limit_req_zone ... zone=forum_api_atlas:10m rate=10r/s;   （未改）
80   : server_name 不变；location / { return 301 https://www.mcuatlas.xyz$request_uri; }
443  : server_name www.mcuatlas.xyz;  ← 业务站（root、证书、缓存、/api/ 反代、try_files、HSTS 全部原样）
443  : server_name mcuatlas.xyz;      ← 独立跳转块 { return 301 https://www.mcuatlas.xyz$request_uri; }
```

**实质改动仅 4 处**（`diff -u` 已逐行审阅）：

| # | 位置 | 调整前 | 调整后 |
|---|---|---|---|
| ① | 80 block `location /` | `return 301 https://mcuatlas.xyz$request_uri;` | `return 301 https://www.mcuatlas.xyz$request_uri;` |
| ② | 443 业务站 | `server_name mcuatlas.xyz;` | `server_name www.mcuatlas.xyz;` |
| ③ | 443 跳转块 | `server_name www.mcuatlas.xyz;` | `server_name mcuatlas.xyz;` |
| ④ | 443 跳转块 `location /` | `return 301 https://mcuatlas.xyz$request_uri;` | `return 301 https://www.mcuatlas.xyz$request_uri;` |

其余为注释更新（追加「2026-11-09 www 域名统一」变更说明、修正块标题与百度验证注释措辞）。

**原样保留**：`limit_req_zone forum_api_atlas`、`/.well-known/acme-challenge/` 豁免、`/baidu_verify_codeva-IsGpEVEsix.html` 精确豁免（80 与 443 跳转块）、证书路径、`ssl_protocols/ciphers/session_cache`、HSTS、`location ~* \.html$` 与静态资源缓存、`location = /data/news.js` 禁缓存、`location ^~ /api/` 全部反代头与限流、`location / { try_files ... }`、access/error_log。

**未改动任何其他 vhost 文件**（`yaoqiang.xin`、`mcu.yaokaixin.top`、`mcu.yaoqiang.xin`、`127.0.0.1` 等均未触碰）。

### 调整前后 SHA256

| 文件 | SHA256 |
|---|---|
| 调整前 / 备份 | `08ae84523b5bd40b274fc85c8d13e46a5bbbbff61b60b6576e191964d2072a9e` |
| 调整后生效 | `23be94fb8fe3fca3ceb13f88e3b85c2e6c3601ae9e0e537639a5524627117708` |

---

## 3. 配置备份位置

| 位置 | 说明 |
|---|---|
| `/root/mcu-atlas-nginx-backup-20261109/mcuatlas.xyz.conf.before-www301` | **主备份**（独立目录，不受 vhost include 影响） |
| `/www/server/panel/vhost/nginx/mcuatlas.xyz.conf.bak-www301-20261109` | 同目录副本（后缀非 `.conf`，不会被 include 加载） |

两份备份与调整前文件的 SHA256 完全一致（已在应用前校验）。

**线上新增文件（原本不存在，故无备份）**：`/www/wwwroot/mcu-h5/robots.txt`、`/www/wwwroot/mcu-h5/sitemap.xml`，权限 `644 www:www`。

---

## 4. Nginx 配置语法检查结果

应用脚本内置保护：先写入新配置 → `nginx -t` → 若非 0 则自动从主备份还原并再次 `nginx -t` → 通过才 `nginx -s reload`。

```
nginx: [warn] conflicting server name "yaoqiang.xin" on 0.0.0.0:443, ignored
nginx: [warn] conflicting server name "www.yaoqiang.xin" on 0.0.0.0:443, ignored
nginx: the configuration file /www/server/nginx/conf/nginx.conf syntax is ok
nginx: configuration file /www/server/nginx/conf/nginx.conf test is successful
nginx_t_rc=0
reload_rc=0
```

- 2 条 `warn` 是**调整前就存在**的其他站点（`yaoqiang.xin`）重复 server_name，与本任务无关，未改动。
- reload 后 master 进程仍为 PID 650，最终复测 `nginx -t` 仍为 `successful`。

---

## 5. 四种域名访问方式的实际 HTTP 状态码和 Location

### 调整前基线（`curl -I`，2026-11-09 06:06 UTC）

| 访问 | 状态 | Location |
|---|---|---|
| `http://mcuatlas.xyz/` | 301 | `https://mcuatlas.xyz/` |
| `https://mcuatlas.xyz/` | 200 | — |
| `http://www.mcuatlas.xyz/` | 301 | `https://mcuatlas.xyz/` |
| `https://www.mcuatlas.xyz/` | 301 | `https://mcuatlas.xyz/` |

### 调整后线上实测（`curl -I`）

| 访问 | 状态 | Location |
|---|---|---|
| `http://mcuatlas.xyz/` | **301** | **`https://www.mcuatlas.xyz/`** |
| `https://mcuatlas.xyz/` | **301** | **`https://www.mcuatlas.xyz/`** |
| `http://www.mcuatlas.xyz/` | **301** | **`https://www.mcuatlas.xyz/`** |
| `https://www.mcuatlas.xyz/` | **200** | 无 |

### 跟随重定向（`curl -L -w '%{http_code} %{url_effective} %{num_redirects}'`）

```
http://mcuatlas.xyz/       => 200 https://www.mcuatlas.xyz/  redirects=1
https://mcuatlas.xyz/      => 200 https://www.mcuatlas.xyz/  redirects=1
http://www.mcuatlas.xyz/   => 200 https://www.mcuatlas.xyz/  redirects=1
https://www.mcuatlas.xyz/  => 200 https://www.mcuatlas.xyz/  redirects=0
```

**无重定向循环**（均 1 跳落地，规范域名 0 跳）。`http://mcu.mcuatlas.xyz/` 亦为 1 跳落地 `https://www.mcuatlas.xyz/`。

---

## 6. 路径、参数保留测试结果

| 请求 | 首跳 | Location | 最终 |
|---|---|---|---|
| `https://mcuatlas.xyz/movie.html?id=iron-man` | 301 | `https://www.mcuatlas.xyz/movie.html?id=iron-man` | 200 |
| `http://mcuatlas.xyz/special.html?id=avengers-doomsday` | 301 | `https://www.mcuatlas.xyz/special.html?id=avengers-doomsday` | 200 |
| `https://www.mcuatlas.xyz/movie.html?id=iron-man` | 200 | — | 200 |
| `https://mcuatlas.xyz/routes.html?r=chrono` | 301 | `https://www.mcuatlas.xyz/routes.html?r=chrono` | 200 |
| `http://www.mcuatlas.xyz/news.html?from=wx` | 301 | `https://www.mcuatlas.xyz/news.html?from=wx` | 200 |

`$request_uri` 完整保留路径与查询串；跟随重定向后均返回 200 且最终 URL 完全一致。

---

## 7. Canonical、robots、sitemap 检查结果

### 7.1 本地已同步的文件（12 个）

| 文件 | 本轮改动 |
|---|---|
| `h5/index.html`、`routes.html`、`news.html`、`next.html`、`map.html` | 静态 `canonical` → `https://www.mcuatlas.xyz/...` |
| `h5/assets/js/app.js` | `injectSeoTags` 新增固定 `CANON_ORIGIN = 'https://www.mcuatlas.xyz'`，canonical / `og:url` 不再跟随访问域名 |
| `h5/robots.txt` | `Sitemap: https://www.mcuatlas.xyz/sitemap.xml` |
| `h5/sitemap.xml` | 由工具重新生成，76 条 URL 全部 www |
| `h5/tools/generate-sitemap.cjs` | `ORIGIN` 常量 → www |
| `h5/tools/check-live-local-diff.cjs` | 线上抓取 `ORIGIN` → www |
| `h5/tools/regression-basic.cjs` | 期望值 → www，并新增 3 条 www 断言 |
| `docs/审计/H5 数据权威目录与发布流程.md` | 回同步示例 URL → www |

**保留未动**：`/index.html → /`、`/special → /special.html` 的 `NORM_PATH`；`KEEP` 中 `movie/route-detail/special/news-detail` 的 `?id=`；资讯详情 `noindex`；`robots.txt` 的 `Disallow: /api/`；sitemap 排除 `/index.html`、`/special`、`news-detail`、社区页、`map-pc.html`、未上映作品详情。

### 7.2 本地回归（`node h5/tools/regression-basic.cjs`）

**45 项全部 PASS**，其中本轮新增/相关：

```
PASS 静态 canonical: index.html / routes.html / news.html / next.html / map.html
PASS 首页规范 URL 为 / 而非 /index.html
PASS 运行时 canonical 规范化重复 URL
PASS 资讯详情 canonical 保留 ?id=
PASS 资讯详情仍为 noindex（未擅自开放收录）
PASS 运行时 canonical 固定为 www 规范域名
PASS sitemap 全部 URL 使用 www 域名
PASS H5 目录内无「非 www」绝对规范地址残留
```

`node h5/tools/generate-sitemap.cjs --check` → PASS；全目录扫描 44 个文件，`nonWwwFiles=0`。

### 7.3 本地浏览器全量 canonical（`http://127.0.0.1:8766`）

| 路径 | canonical | canonical 标签数 | noindex |
|---|---|---|---|
| `/` | `https://www.mcuatlas.xyz/` | 1 | — |
| `/index.html` | `https://www.mcuatlas.xyz/` | 1 | — |
| `/routes.html` | `https://www.mcuatlas.xyz/routes.html` | 1 | — |
| `/routes.html?r=chrono` | `https://www.mcuatlas.xyz/routes.html?r=chrono` | 1 | — |
| `/route-detail.html?id=newcomer` | `https://www.mcuatlas.xyz/route-detail.html?id=newcomer` | 1 | — |
| `/movie.html?id=iron-man` | `https://www.mcuatlas.xyz/movie.html?id=iron-man` | 1 | — |
| `/special.html?id=avengers-doomsday` | `https://www.mcuatlas.xyz/special.html?id=avengers-doomsday` | 1 | — |
| `/special` | `https://www.mcuatlas.xyz/special.html` | 1 | — |
| `/news.html` | `https://www.mcuatlas.xyz/news.html` | 1 | — |
| `/news-detail.html?id=...` | `https://www.mcuatlas.xyz/news-detail.html?id=...` | 1 | **保留** |
| `/next.html`、`/map.html` | `https://www.mcuatlas.xyz/next.html` / `map.html` | 1 | — |

所有页面 `nonWww=0`。

### 7.4 线上 SEO 文件（本轮上传 2 个纯新增文件）

| 检查 | 结果 |
|---|---|
| `https://www.mcuatlas.xyz/robots.txt` | **200** `text/plain`，`Sitemap: https://www.mcuatlas.xyz/sitemap.xml` ✓ |
| `https://www.mcuatlas.xyz/sitemap.xml` | **200** `text/xml`，76 条 `<loc>`，**76 条 www / 0 条非 www** ✓ |
| `https://mcuatlas.xyz/robots.txt` / `sitemap.xml` | 301 → www（域名统一后符合预期） |
| 线上 12 个页面原始 HTML 扫描 | `nonWwwAbsoluteRefs=0`（无非 www 绝对地址残留）✓ |

### 7.5 线上运行时 canonical（Playwright 实测）

| 页面 | canonical |
|---|---|
| `https://www.mcuatlas.xyz/` | `https://www.mcuatlas.xyz/` ✓ |
| `https://www.mcuatlas.xyz/special.html?id=avengers-doomsday` | `https://www.mcuatlas.xyz/special.html?id=avengers-doomsday` ✓ |
| `https://www.mcuatlas.xyz/movie.html?id=iron-man` | `https://www.mcuatlas.xyz/movie.html?id=iron-man` ✓ |
| `https://www.mcuatlas.xyz/index.html` | `https://www.mcuatlas.xyz/index.html` ⚠ 见第 9 节 |
| `https://www.mcuatlas.xyz/special` | `https://www.mcuatlas.xyz/special` ⚠ 见第 9 节 |

域名层面已全部统一为 www，且无重复 canonical 标签（首页实测 `canonCount=1`）。

---

## 8. `/api/` 和 H5 核心页面回归结果

### HTTP 状态（线上）

| URL | 结果 |
|---|---|
| `https://www.mcuatlas.xyz/` | 200 `text/html` |
| `/index.html` | 200 `text/html` |
| `/routes.html` | 200 |
| `/route-detail.html?id=newcomer` | 200 |
| `/movie.html?id=iron-man` | 200 |
| `/map.html` | 200 |
| `/special.html?id=avengers-doomsday` | 200 |
| `/news.html` | 200 |
| `/next.html` | 200 |
| `/data/news.js` | 200 `application/javascript` |
| `/assets/css/style.css` | 200 `text/css` |
| `/api/topics` | **200** `application/json`，响应 `{"items":[],"page":1,"size":10,"total":0}` |
| `https://mcuatlas.xyz/api/topics` | 301 → www（域名统一预期） |
| `/baidu_verify_codeva-IsGpEVEsix.html`（http/www/https www） | 200（既有豁免保留） |
| `http://mcuatlas.xyz/.well-known/acme-challenge/test` | 404（文件不存在，但未被 301 截走，ACME 豁免生效） |

### 浏览器渲染回归（Playwright，线上）

| 页面 | 实测 |
|---|---|
| 首页 | H1「漫威观影导航」、`stat-count=62`、`stat-routes=11`、canonical `https://www.mcuatlas.xyz/` |
| 作品详情 | H1「钢铁侠」、`seenBtn=true` |
| 观影路线 | H1「漫威电影按什么顺序看」，正文 2563 字符 |
| 关系地图 | H1「探索 MCU 关系」，40 个节点 |
| 复联5专题 | H1「复联5补课路线」，核心 8 部 / 完整 15 部 |
| 资讯列表 | H1「最新漫威资讯」，10 张资讯卡 |

> 线上首页仍显示 `62` 部（第一轮业务修复前的线上数据），符合本轮「不部署第一轮业务修复」的边界，**不是回归故障**。

### 其他站点未受影响

```
https://yaoqiang.xin/        => 200
https://www.yaoqiang.xin/    => 301（该站点原有行为）
https://mcu.yaokaixin.top/   => 200
```

---

## 9. 实际完成、未完成、未验证事项

### 9.1 实际完成

1. 前置检查 6 项全部完成（DNS、证书、Nginx 配置、CDN/代理层、备份、调整前基线），停止条件未触发。
2. 生产 Nginx 301 已实施并 reload 生效：独立跳转 server block 方案，业务站不含跳转规则。
3. 本地 H5 SEO 规范地址全量同步（12 个文件），路径规范化、`?id=`、noindex 策略全部保留。
4. 线上上传 `robots.txt` / `sitemap.xml` 两个**原本不存在**的纯 SEO 文件（不覆盖任何业务文件、不含业务逻辑）。
5. 线上 HTTP、路径参数、SEO 文件、浏览器渲染、`/api/` 与其他站点回归全部实测完成。
6. 临时脚本/服务器已清理，未推送 Git，未改小程序/shared/其他站点。

### 9.2 未完成 / 未达标（需明确知悉）

| 项 | 线上现状 | 原因 | 建议后续动作 |
|---|---|---|---|
| `/index.html` canonical 指向 www **首页** | 实测为 `https://www.mcuatlas.xyz/index.html` | 线上 `app.js` 仍是第一轮修复前旧版，无 `NORM_PATH`；本轮按边界「不部署第一轮业务修复」未部署 H5 文件 | 授权部署本轮 SEO 修复（或定点同步 `injectSeoTags`），或在 Nginx 加 `location = /index.html { return 301 /$is_args$args; }` |
| `/special` canonical 规范为 `/special.html` | 实测为 `https://www.mcuatlas.xyz/special` | 同上 | 同上，或加 `location = /special { return 301 /special.html$is_args$args; }` |
| 线上 HTML 无静态 canonical（仅运行时注入） | 原始 HTML 无 `link[rel=canonical]` | 同上（本地已全部补齐） | 部署本轮本地 SEO 修复 |
| 线上首页统计 `62` 部、数据为旧版 | 第一轮业务修复未部署 | 任务边界明确禁止 | 按第一轮修复报告另行安排发布 |

> 上述 4 项均**不是域名统一本身的缺陷**：域名层面线上 canonical 已全部是 `https://www.mcuatlas.xyz`，无一处非 www 残留。本地版本已实现并在本地全量验证通过。

### 9.3 未验证

1. 搜索引擎实际收录、对 301 / canonical 的采纳，以及旧 `www → apex` 301 被搜索引擎或浏览器缓存的过渡期影响。
2. 真机移动端、微信/抖音内置浏览器、小程序扫码链路。
3. 小程序端**完整配置**（request 合法域名、后台域名白名单）是否含 apex 绝对 API 地址：本次只读检查了 `wechat/data`、`douyin/data`，未发现 apex 引用；但若存在 apex 绝对 POST，301 可能被客户端改为 GET（需人工确认）。
4. 社区发帖/审核/点赞等写接口（本轮只读，未触发）。
5. HSTS 已缓存客户端的行为：可能先内部升级到 `https://mcuatlas.xyz` 再 301 到 www（多一跳，最终仍到 www），未在真实已缓存浏览器上验证。
6. 证书 2026-12-14 到期后的自动续签结果（ACME 豁免已保留，但未实测续签）。
7. 线上 sitemap 中 76 条 URL 的逐条可访问性（抽样已覆盖主要模板与页面；sitemap 由本地数据生成，线上数据为旧版但 76 个 id 均可解析）。

### 9.4 需要人工确认

1. 是否授权部署本轮本地 SEO 修复，以让线上 `/index.html`、`/special` 路径规范化达标；或改用 Nginx 精确 301（两者都需另行授权，本轮未擅自执行）。
2. 证书到期（2026-12-14）的续签安排与到期前验证。
3. 百度/Google 站长平台是否需要提交域名改版、以及旧 www→apex 301 缓存的清理策略。
4. 小程序 request 合法域名是否已配置为 `https://www.mcuatlas.xyz`；若仍为 apex，评估 POST 301 风险。
5. 首页统计 `62` 部与未上映作品状态，按第一轮修复报告另行安排发布窗口。

---

## 10. 回滚方法

### 10.1 回滚 Nginx 301（回到调整前行为）

```bash
cp /root/mcu-atlas-nginx-backup-20261109/mcuatlas.xyz.conf.before-www301 \
   /www/server/panel/vhost/nginx/mcuatlas.xyz.conf
nginx -t && nginx -s reload
```

备用副本：`/www/server/panel/vhost/nginx/mcuatlas.xyz.conf.bak-www301-20261109`（SHA256 与主备份一致）。回滚后确认：

```
08ae84523b5bd40b274fc85c8d13e46a5bbbbff61b60b6576e191964d2072a9e
```

> 本轮应用脚本已内置「`nginx -t` 失败自动还原备份」保护，但本次 `nginx -t` 一次通过，未触发回滚。

### 10.2 回滚线上 SEO 新增文件

线上原本不存在这两个文件，删除即完全还原：

```bash
rm -f /www/wwwroot/mcu-h5/robots.txt /www/wwwroot/mcu-h5/sitemap.xml
```

### 10.3 本地 SEO 地址改动的撤销

本地改动**未提交 Git**。注意：`h5/` 目录在本轮之前已有第一轮的未提交修改，**不可**用 `git checkout` / `git reset` 整体还原，否则会丢失第一轮修复。

本轮涉及的本地文件（12 个）：
`h5/{index,routes,news,next,map}.html`、`h5/assets/js/app.js`、`h5/robots.txt`、`h5/sitemap.xml`、`h5/tools/{generate-sitemap,check-live-local-diff,regression-basic}.cjs`、`docs/审计/H5 数据权威目录与发布流程.md`。

撤销方式：将上述文件中的 `https://www.mcuatlas.xyz` 换回 `https://mcuatlas.xyz`，把 `app.js` 的 `var canon = CANON_ORIGIN + path` 改回 `u.origin + path` 并移除 `CANON_ORIGIN`，然后执行 `node h5/tools/generate-sitemap.cjs` 重新生成 sitemap。

### 10.4 回滚后验证清单

- `curl -I http://mcuatlas.xyz/`、`https://mcuatlas.xyz/`、`http://www.mcuatlas.xyz/`、`https://www.mcuatlas.xyz/`
- `curl -I https://www.mcuatlas.xyz/api/topics` → 200
- `nginx -t` → successful

---

## 附：本轮操作清单（便于审查）

| 类别 | 内容 |
|---|---|
| 生产 Nginx | `mcuatlas.xyz.conf` 4 处实质改动 + 注释；`nginx -t` 通过；`nginx -s reload` |
| 生产新增文件 | `/www/wwwroot/mcu-h5/robots.txt`、`sitemap.xml`（`644 www:www`） |
| 生产备份 | `/root/mcu-atlas-nginx-backup-20261109/…` + vhost 目录带时间戳副本 |
| 本地修改 | 12 个 SEO 地址相关文件（见 7.1、10.3） |
| 明确未做 | 部署第一轮业务修复、改小程序/shared、改其他站点、改资讯收录策略、推送 Git、清理他人未提交改动 |
