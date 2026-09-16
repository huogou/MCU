# MCU 观影导航 · 项目总览（AI 协作版）

> **本文件用途**：让任何新加入的 AI 在 5-10 分钟内建立项目全貌，作为后续协作的事实基础。
> 不替代 `给策划AI/开发AI/设计AI同步文件.txt`（三角色间的窄向协同通道），也不替代 README/VERSION（产品/版本元数据）。
>
> **维护**：随项目推进同步更新；大改动后整段重写而非追加（沿用"归档后重写"约定）。
> 最后更新：2026-09-16 16:00（**全线收口**：复制 P0 已关闭（控制台声明已配+真机复测无问题+加固入库 c881b46）· 论坛 V3.0 H5 线闭环+⑮ 版本收尾 · mcuatlas.xyz 生产运行 · stats/feedback 恢复 · 远端一致；**无进行中开发任务**）

---

## 1. 一句话定位

**MCU 观影导航** = 「陪用户探索漫威宇宙的观影助手」。

以"作品（电影/剧集）+ 关系 + 路线 + 进度"为内容核心，覆盖 H5、微信小程序、抖音小程序三端，服务于"传播→首体验→长期使用"的闭环。

---

## 2. 平台矩阵（产品闭环）

| 端 | 定位 | 用户场景 | 当前生产地址 / AppID |
|---|---|---|---|
| **H5** | 外部获客 / 首体验 | 微信/浏览器分享链接打开 | `https://mcuatlas.xyz/`（**2026-09-16 起生产**，漫威专属域名；旧域 `mcu.yaokaixin.top` 保留作小程序图片 CDN） |
| **微信小程序** | 长期使用 / 进度沉淀 | 核心用户日活 | AppID `wx78f00e7f0a5948b7`，**V1.2.1 已通过审核并上线**（2026-09-10） |
| **抖音小程序** | 作品查询 / 个人记录工具 | 抖音用户作品查询与进度管理 | AppID `tt00eb76569e914af801`，**V1.3.0 已上线；V2.0.0 轻量内容版提审中**（2026-09-16） |

**核心用户路径**（共享心智；H5/微信为完整链路）：`顺序 → 路线 → 下一部 → 关系 → 地图 → 进度`。抖音为轻量工具版，仅保留「作品查询 → 已看/收藏 → 进度管理」子链路。

---

## 3. 仓库结构（Monorepo）

项目根：`D:\SEO\发挥余热\漫威电影宇宙导航\`

```
.
├── wechat/                    # 微信小程序当前代码（基线 wechat-production → baf309b）
├── douyin/                    # 抖音小程序当前代码（V1.3.0 线上 / V2.0.0 提审中）
├── h5/                        # H5 当前生产代码（与线上同源）
├── shared/                    # 跨端共享代码/数据（data/*.js + sync_data.sh）
├── workspace/                 # 开发/部署/验证工具（deploy/、自测脚本、移动日志）
│
├── docs/                      # 当前有效项目文档
│   ├── 产品/                  #   产品方案（含 V3.0论坛/后续论坛扩展方案.md）
│   ├── 技术/                  #   部署/同步/交接说明（DESIGN.md、仓库同步交接说明.md 等）
│   ├── 版本/                  #   CHANGELOG.md、版本记录.md、设计文件索引.md
│   └── 同步/                  #   三份 AI 同步文件 + 历史归档/
├── design/                    # 当前有效设计资料（H5/、小程序/微信、小程序/抖音、其他）
├── archive/                   # 历史版本与废弃资料（V1/ V2.0/ V2.1/ V2.2/ 其他历史/）
├── release/                   # 发布包（微信小程序-v1.2.0上传包）
│
├── README.md                  # 产品 README
├── VERSION.md                 # 版本号与发布记录
├── MCU项目总览.md             # ★ 本文件（AI 协作总览）
└── AI生成文件/                # 仅存服务器 SSH 密钥 H5/MCU.pub、H5/MCU.pem（R4 冻结；.gitignore 覆盖，不在 Git）
```

**关键 Git 标记**：
- 微信：`wechat-production` → `baf309b`（只读基线）
- 抖音：`9faf617`（V2.0.0 轻量内容版，2026-09-16；V1.3.0 线上版为 `22494e1`）
- H5：当前 `h5/` 工作树（无单独 tag，H5 与线上同源）；论坛 UI `1d413e7`、首页 PC 方案 C 载于 `fa2dc2c`、首页社区入口 `69736bc`

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

> ⚠ **单端改写风险**：端上副本是同步产物，手工改动会被 `sync_data.sh` 覆盖。历史案例：`douyin/data/relations.js` 文案曾单端改写未回源，**2026-09-16 已按 shared 权威源纠偏**（三端 sha256 一致）；后续改文案一律先改 `shared/` 源头再同步。

---

## 5. H5 端

### 5.1 内容与结构

- **形态**：纯静态多页（无构建），HTML + data JS + 资源；V2 组件层 `assets/js/components.js`（`window.MCU.v2`）+ `assets/css/v2.css`
- **页面**：`index.html`（V2 单页内容流）/ `map.html` / `movie.html` / `next.html` / `routes.html` + `route-detail.html`（V2.2）+ 论坛 4 页 `community.html` / `topic-detail.html` / `post-create.html` / `my-community.html`（V3.0，H5 线闭环）
- **JS**：1 个核心 `assets/js/app.js`（77 KB，路由/状态/视图）+ 11 个 data JS
- **资源**：38 张海报 + 38 张剧照 + 二维码 + 头像/Phase/条目图
- **关系图**：全景 `PANO_CONN` 41 边（三态物理隔离：只读，不可写）
- **入口**：首页 Hero Banner + 2×2 入口卡（作品/角色/关系/时间线）
- **小程序入口**：H5 → 微信 + 抖音双平台 5 档入口（PC 双卡 / 手机纵向 / 微信优先 / 抖音优先 / 二维码降级），由 `app.js` 的 `ui.MP_PLATFORMS` 单一源配置
- **反馈/统计**：底部反馈卡（`FeedbackUI`）+ 浏览统计写入 CloudBase `feedback` 集合；CloudBase WEB 安全域名**已加 `mcuatlas.xyz` + `www.mcuatlas.xyz`**（2026-09-16），落库恢复待浏览器验证（本地队列兜底仍在）
- **论坛（V3.0 H5）**：`forum.js` + `v3-forum.css`（`v3f-` 前缀）；走同域相对 `/api/`（Nginx 反代论坛后端）；先审后发 + token 身份复用 + 点赞/举报/我的社区；开发侧断言 111/111（`workspace/forum-e2e.cjs`）

### 5.2 当前部署（**唯一生产地址**）

```
https://mcuatlas.xyz/
```

| 项 | 值 |
|---|---|
| 服务器 | 阿里云轻量应用服务器（Alibaba Cloud Linux 3 / Nginx 1.26.3 / 宝塔 11.1.0；内存 ~896Mi 紧张） |
| 外网 IP | `<阿里云ECS公网IP>`（真实值见本地 `.workbuddy/memory/MEMORY.md`，不入库） |
| 部署路径 | `/www/wwwroot/mcu-h5/`（新旧域同源共用目录） |
| Nginx 站点配置 | `/www/server/panel/vhost/nginx/mcuatlas.xyz.conf`（本地蓝本 `workspace/deploy/mcuatlas.xyz.conf`，限流 zone=`forum_api_atlas`） |
| 80 端口 | www → 301 根域；根域 → HTTPS |
| 443 端口 | TLSv1.2/1.3 + HSTS + 缓存策略（HTML 不缓存；CSS/JS/JSON 7 天；图片 30 天）+ `try_files $uri $uri.html $uri/ =404`；**`^~ /api/` → 127.0.0.1:8787（论坛后端反代）** |
| 证书 | DigiCert DV（SAN：`mcuatlas.xyz` + `www.mcuatlas.xyz`，至 2026-12-14；续签走阿里云控制台，**续签≠部署**） |
| DNS | `mcuatlas.xyz` zone：`@` / `www` / `mcu` → <阿里云ECS公网IP>（已生效） |
| 旧域 | `mcu.yaokaixin.top` vhost 保留（**仅作小程序图片 CDN**）；`mcu.yaoqiang.xin` 已下线（NXDOMAIN） |
| SSH | RSA 2048（本地 `AI生成文件/H5/MCU.pem`，**未入库**，已注入 root authorized_keys） |

### 5.3 H5 部署历史（决策链）

| 时间 | 方案 | 状态 |
|---|---|---|
| 2026-08-28 | CloudBase 静态托管（`mcu-d6gw0brqoa9521b58-1307093647.tcloudbaseapp.com`） | **2026-09-08 清理**（桶清空 252 文件 → 404） |
| 2026-09-07 | Cloudflare Pages（`mcu-navigator-h5.pages.dev`） | **2026-09-08 清理**（项目删除 → 连接失败） |
| 2026-09-08 | 阿里云轻量 + `mcu.yaoqiang.xin` 子域 | 已退役（域名 NXDOMAIN；vhost 保留待清理） |
| 2026-09-16 | 阿里云轻量 + `mcuatlas.xyz`（已备案；DigiCert DV 证书 + 独立 vhost + `/api/` 论坛反代） | **当前生产**（双域同源，公网复验全过） |

---

## 6. 微信小程序（`wechat/`）

### 6.1 基本信息

- **AppID**：`wx78f00e7f0a5948b7`
- **当前版本**：**V1.2.1 已通过审核并正式上线**（2026-09-10）
  - V1.2.0 为 2026-08-28 上传的基线版本 → `wechat-production` 分支 `baf309b`（只读）
  - V1.2.1 内容：审核反馈修复（删联系方式字段、按钮居中）+ 视觉资源 CDN 迁移（见 §4 + §12）
- **驳回与申诉**：V1.2.1 曾因「涉及视频服务，属个人主体未开放类目」被驳回；
  申诉说明小程序**无播放器、无视频资源、无外部视频跳转**（代码无 `web-view` / `navigateToMiniProgram` / 任何视频链接），
  经复核判定为误判后通过。→ **视觉警示见 §14**
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
- **产品定位**：**MCU 作品信息查询 + 个人观影记录 + 进度管理 + 收藏工具**（工具型应用，非内容/资讯平台）；V2.0.0 起深度内容外跳 H5（`https://mcuatlas.xyz/`，经 `models/h5Link.js` 唯一链接源复制引导）
- **服务类目**：工具-实用工具-信息查询（类目资质已通过）
- **版本**：
  - **V1.3.0 已上线**（2026-09-16 核实；此前 2 次驳回——①「文娱-资讯」类目不符个人主体 ②「功能不完整可用性低」——整改后过审）
  - **V2.0.0 轻量内容版 提审中**（2026-09-16 提交；10 页/4 Tab；真机验收通过后提交，git `9faf617`）
- **V2.0.0 复制链接问题（2026-09-16，已关闭）**：真机曾现场景性 fail——抖音剪贴板属**隐私接口**（官方错误码 104179 隐私协议未声明 / 104180·190 未授权）；处置=控制台「隐私保护指引」补**剪贴板**声明（对提审中/线上包即时生效）+ `models/h5Link.js` 按官方错误码加固入库（`c881b46`：console 全量透出+错误码映射+openSetting 授权引导）+ **真机复测确认无问题**
- **核心功能**：作品查询、搜索、筛选、排序、轻量作品详情、标记已看、收藏、观影进度、观影路线（journey）、H5 引导外跳

### 7.2 页面结构（V2.0.0：10 页 / 4 TabBar）

**TabBar**：首页 / 路线 / 作品 / 我的MCU

```
home（首页：下一步/最近标记/内容入口）   journey（观影路线：上映顺序+主线必看）   library（作品：查询/筛选/排序）   my-mcu（我的 MCU）
movie（轻量作品详情）                    feedback / share / about / agreement / privacy
组件：components/h5-guide（H5 引导卡，点击复制 mcuatlas.xyz 链接）
```

**已删除且禁止恢复**（不作为当前产品功能描述）：`explore` / `panorama` / `characters` / `character` / `routes` / `route-detail`

### 7.3 与微信版的差异（治理要点）

- 抖音版 `movie` 是**轻量工具版**：仅信息表 + 无剧透简介(sf) + 标记已看 + 收藏 + ≤4 条基础关系
- **主动规避 `role` 字段**（剧情作用解读类编辑文本，审核风险）
- `feedback.js`：**纯本地队列**（`tt.getStorageSync/setStorageSync`），数据不上云、不汇总（提交 `1242a65`，策划拍板"选项一 本地"）
- ~~`douyin/data/relations.js:61` 文案单端中性化~~ → **2026-09-16 已按 shared 权威源纠偏**（三端 sha256 一致），风险解除；后续改文案一律走 shared 源头 + sync

### 7.4 验收记录

- **V1.3.0**：自动化测试 151 项断言通过（工具功能 103 / Canvas 25 / 禁用词 0 命中 / Tab 图标 23）→ 真机演示通过 → 上线
- **V2.0.0**：开发侧静态断言 18 项全过（渲染 5 / 交互 4 / 跳转 6 / 数据 3；合规三项：wxss 零 raw hex、字段白名单、禁用词零命中）+ 域名前置（mcuatlas.xyz 部署生效）+ **真机验收通过（2026-09-16）** → 提审

### 7.5 提审历史

| 版本 | 结果 |
|---|---|
| V1.2.0（「文娱-资讯」类目） | 驳回（个人主体类目不符）→ 改「工具-实用工具-信息查询」 |
| V1.3.0（补工具功能后再审） | **通过并上线** |
| V2.0.0 轻量内容版 | **提审中**（2026-09-16；结果处置见 §13 P0） |

---

## 8. 设计语言（★ 三端统一 Token，2026-09-10 起）

> **现行口径**：H5 已于 2026-09-10 统一为小程序 Token 值，**三端单一体系**（旧"两套 Token"记录作废）。
> 权威源：`DESIGN.md` + `h5/assets/css/style.css` `:root`（注释标明与小程序变量对应关系）。

### 8.1 统一 Token（核心值）

| 语义 | 值 |
|---|---|
| 页面底色 bg | `#080B12` |
| 主卡片 surface | `#161D2B` |
| 次级卡片 | `#1E2636` |
| 边框 | `#2A3447` |
| **强调金 gold** | **`#F2B233`**（按钮字 `#1A1206`） |
| 主文字 / 次文字 / 弱文字 | `#E8ECF4` / `#8E98AA` / `#6E7889` |
| TabBar 选中 / 未选中 | `#F2B233` / `#555F73` |
| 状态 success / error | `#3FB98A` / `#E5604D` |

### 8.2 跨端锚点与组件契约

- 六阶段色 p1–p6：`#5B8DEF` / `#28B487` / `#F0A932` / `#8B6FE8` / `#E8483F` / `#C25B8E`（三端一致的视觉锚点）
- 组件前缀契约：H5 通用 `v2-`、路线详情 `rd-`、论坛 `v3f-`；按钮复用 `.v2-btn-*`
- 小程序排版标尺以 `DESIGN.md` 为准（56/44/36/28/24/22 rpx）；**旧记「48/36/34/28/24」已作废**
- 视觉纪律：禁新增复杂背景动画（星点静态、去 pulse）；已看项右侧图标=箭头；勿强化「深黑海报墙 + 大号观看 CTA」的流媒体观感（微信类目误判教训，见 §14）
- 首页收口禁令长期有效：①不删未来上映英文名行 ②已看 8 部 ③移动端资料库 3 列 ④首页 12 部

---

## 9. 部署与基础设施（汇总）

### 9.1 阿里云轻量（唯一服务器）

| 项 | 值 |
|---|---|
| OS | Alibaba Cloud Linux 3 |
| Web | Nginx 1.26.3 + 宝塔 11.1.0 |
| 外网 IP | `<阿里云ECS公网IP>`（真实值见本地 `.workbuddy/memory/MEMORY.md`，**已 gitignore，不入库**） |
| 主域 | `yaoqiang.xin`（WordPress） |
| H5 | `mcuatlas.xyz`（**正式运行**，漫威专属域名，2026-09-16 起） |
| SSH | RSA 2048 密钥登录；本地 PEM `AI生成文件/H5/MCU.pem`（未入库） |

### 9.2 DNS

- **Cloudflare**：账号 `huoguo`（Account ID `8caa1fd98ba2ae75794f1bc58c584b13`），OAuth 登录（**仅 pages:write，无 account:write**），H5 Pages 项目已删除
- **阿里云 / 万网**：父域 `yaoqiang.xin` zone（NS `dns3.hichina.com`）；独立域名 `mcuatlas.xyz`（NS `dns15/dns20.hichina.com`，**已备案**）A 记录 `@`/`www`/`mcu` → <阿里云ECS公网IP>（已生效）

### 9.3 CloudBase（腾讯云开发）

| 项 | 值 |
|---|---|
| EnvId | `mcu-d6gw0brqoa9521b58`（上海） |
| 静态托管 | **已清空**（2026-09-08，252 文件删除） |
| NoSQL 集合 | `feedback`（tnt-h0fzw1o7k），**保留**（小程序 + 新 H5 反馈写入） |
| 云函数 | 0 个 |
| WEB 安全域名 | **已含 `mcuatlas.xyz` + `www.mcuatlas.xyz`**（2026-09-16 加，实测 ENABLE）；`mcu.yaokaixin.top` 保留；stats/feedback 落库恢复待浏览器验证 |

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

- 每次修改 → Git 提交 + 版本号 + README/同步文件 + 归档（`archive/`）
- 跨 AI 协作通过 `docs/同步/给X同步文件.txt`（三份窄向通道）+ `.workbuddy/memory/YYYY-MM-DD.md`（长期记忆）
- `AI生成文件/`、`archive/`、`release/`、`design/` 已被 .gitignore 覆盖 → **不在 Git 中**，勿用 git 找回

---

## 11. 协作约定

### 11.1 同步文件（三份无空格文件 = 唯一工作集）

```
docs/同步/给策划AI同步文件.txt  →  GPT/用户（维护：开发/设计）
docs/同步/给开发AI同步文件.txt  →  Work（维护：策划/设计）
docs/同步/给设计AI同步文件.txt  →  QoderWork CN（维护：开发/策划）
```

- 交付物写完整绝对路径 + 扩展名
- 修改列表给相对路径
- 完成后自动写对应通道，无需逐次询问
- **精简约定**：文件过长（>~150 行）时整体覆盖重写为"当前态"而非继续追加。流程：先 cp 原件归档到 `docs/同步/历史归档/{YYYY-MM-DD}/` → 再重写 → 文件内注明归档路径

### 11.2 记忆

- `D:\SEO\发挥余热\漫威电影宇宙导航\.workbuddy\memory\` 项目级
  - `YYYY-MM-DD.md` —— 每日工作日志（append-only）
  - `MEMORY.md` —— 长期项目笔记（限 3000 字符/会话）
- `~\.workbuddy\MEMORY.md` 用户级（跨项目）

### 11.3 Backup

- `archive/` —— 历史版本与废弃资料（V1/ V2.0/ V2.1/ V2.2/ 其他历史；原 `backup/`、`恢复资料/` 已归入）
- `docs/同步/历史归档/{YYYY-MM-DD}/` —— 同步文件精简前的归档

---

## 12. 当前状态（2026-09-16 截至）

| 项 | 状态 |
|---|---|
| **H5** | **`https://mcuatlas.xyz/` 正式运行**（2026-09-16 切生产，双域同源；部署 `/www/wwwroot/mcu-h5/`）；论坛 V3.0 H5 线闭环（第二轮真机复验通过 09-16 12:37） |
| H5 专属域名 `mcuatlas.xyz` | 已备案、DigiCert DV 证书（至 2026-12-14）、独立 vhost 生效；旧域 `mcu.yaoqiang.xin` 已下线（NXDOMAIN） |
| **微信小程序** | **V1.2.1 已上线**（2026-09-10）；图片 CDN 走 `mcu.yaokaixin.top`，渲染正常 |
| **抖音小程序** | **V1.3.0 已上线**（2026-09-16 核实）；**V2.0.0 轻量内容版提审中**（09-16 提交，git `9faf617`）；复制问题已关闭（09-16，见 §7.1） |
| 双端图像资源 | 三端 `visuals.js` CDN = `https://mcu.yaokaixin.top`（2026-09-16 拍板保持，避免重发小程序） |
| CloudBase 环境 | **保留**（静态托管已清空；DB 供小程序反馈 + H5 反馈/统计；WEB 安全域名已加 mcuatlas.xyz，落库恢复待验证） |
| 论坛后端 | 阿里云 `/www/wwwroot/forum-api/`（Node 24 + SQLite WAL，systemd 守护，RSS ~58MB）+ Nginx `^~ /api/` 反代（mcuatlas vhost）；管理页 `/api/admin/`（token 用户持有）；备份 cron 14 份 |
| 博客 yaoqiang.xin | 正常（零影响） |

---

## 13. 待办（2026-09-16 16:00 刷新 · P0 已全部清零）

### P0（已全部关闭）

1. ~~抖音复制链接 P0~~ → **已关闭（09-16）**：控制台「隐私保护指引」已配剪贴板声明 + 真机复测无问题（用户确认）+ `h5Link.js` 加固入库（`c881b46`）

### 当前待办（无阻塞开发项）

- **被动等待**：抖音 V2.0.0 审核结果（过审 → 线上观察；驳回 → 按驳回点整改）
- **日历项**：`mcuatlas.xyz` 证书 2026-12-14 到期（11 月底阿里云控制台续签，不着急；**续签≠部署**）
- **规划项（暂无规划，有规划再启动）**：⑫ 微信论坛只读（前置=产品方案）→ ⑬ 抖音只读（建议并入下次提审）→ ⑭ 联调

### 长期项（不阻塞、未排期）

- 小程序 feedback 迁移阿里云（独立立项；CloudBase 环境在迁移完成前保留）
- 旧域 `mcu.yaokaixin.top` 退役评估（待小程序图片 CDN 不再依赖后）

### 近期已闭环

- 抖音复制链接 P0（09-16：声明已配 + 复测无问题 + 加固 `c881b46`）
- CloudBase stats/feedback 落库恢复验证（09-16 13:45 生产实测命中）
- 远端备份 push（`68e4e19..c881b46`）

- `mcuatlas.xyz` 备案 + 证书 + vhost + 切生产（2026-09-16，双域同源，公网复验全过）
- 论坛 V3.0：后端上线 → H5 4 核心页 → UI 修复（111/111 断言）→ 部署（双域同源）→ 两轮真机验收通过（09-16 12:37）
- 抖音 V1.3.0 上线（09-16 核实）；V2.0.0 真机验收通过并提审（09-16）
- H5 首页 PC 方案 C 实现部署（`fa2dc2c`）；首页社区入口 9-B（`69736bc`）
- 三端 Token 统一（2026-09-10）；`relations.js` 三端数据纠偏（09-16）

---

## 14. 风险与合规

| 风险 | 性质 | 应对 |
|---|---|---|
| 抖音剪贴板隐私接口 | ~~V2.0.0 复制 fail~~ **已关闭（09-16）**：声明已配 + 复测无问题 + 加固入库 | 经验留存：小程序新增隐私接口（剪贴板/相机/位置等）前，先在控制台「隐私保护指引」补声明 |
| ★ **视频类目误判风险（微信，已触发过 1 次）** | V1.2.1 曾因「涉及视频服务，个人主体未开放类目」被驳回；申诉方才通过 | **视觉层持续自律**：勿强化「深色海报墙 + 大号观看 CTA」的流媒体观感，宜强化工具/图鉴/进度属性；保持无播放器、无视频资源、无外部视频跳转的事实基础 |
| 论坛 UGC（个人主体） | 微信/抖音小程序挂论坛只读涉类目合规 | ⑫/⑬ 立项前由策划做个人主体合规评估；H5 论坛已有先审后发 + 举报机制基线 |
| CloudBase 写库依赖共享 env | 删环境会同时坏掉小程序反馈 + H5 反馈/统计 | **环境保留**；feedback 迁移完成后再评估下线 |
| 服务器内存紧张 | 阿里云轻量 ~896Mi（论坛后端 + Nginx + WordPress 同机） | 论坛后端 systemd 守护 + RSS 观察；备份 cron 在跑；扩容属用户决策 |
| 本地提交未推送 | 远端 ref 落后本地 | 定期 `git push origin master` 建立云端备份 |

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
   - 续签证书：`mcuatlas.xyz` 走阿里云控制台（DigiCert DV，至 2026-12-14；**续签≠部署**，到期需手动换 nginx 证书 + reload）
   - 删 CF Pages：`wrangler pages project delete <name> --yes`（PATH 加 node 后跑 .bin/wrangler 包装脚本，**勿用 node 直接执行**）
   - CloudBase 清理旧托管：`manageHosting(action=delete, cloudPath="/", isDir=true, confirm=true)`（无"关闭默认域名" action，只能删文件）
   - DNS 探测：`curl -s 'https://dns.alidns.com/resolve?name=<fqdn>&type=A'`（独立源核验，不依赖 nslookup/dig）
8. **踩过的坑**：
   - 不要盲目试 `acme.sh`（Let's Encrypt 每小时 5 次限流），DNS 未生效先 DoH 验 NXDOMAIN
   - 阿里云"绑定密钥对"对运行中实例不自动写 authorized_keys → 用 Workbench 一键连接(Admin)+sudo 注入公钥

---

**置信度：高**。本文件基于实测验证结果（HTTP 状态、DoH 解析、nginx -t、acme.sh 输出、wrangler 输出、CloudBase listFiles/manageHosting 输出）+ Git 历史 + 用户口述。所有"已执行"项均可复验。