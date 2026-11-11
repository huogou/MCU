# MCU 微信小程序 V1.2.2 现状盘点与复联5专题升级建议报告

> 执行方：CodeBuddy（开发侧）｜日期：2026-11-09｜基线：微信小程序 V1.2.2（2026-09-22 发布）
> 任务性质：**只读代码审查与方案评估**。本次未修改任何源码、数据、配置、H5 线上内容，未部署、未提交审核。
> 核查口径：以 `wechat/` 与 `h5/` 实际代码为唯一事实依据；README / VERSION / CHANGELOG 仅作版本与发布记录的佐证，不作为功能依据。

---

## 0. 结论速览（先回答三个必答问题）

**Q1 当前小程序究竟已经具备哪些功能？**
V1.2.2 是一个**原生微信小程序、15 页 / 4 Tab、纯本地存储、无账号体系**的「观影导航工具」：59 条内容 / 92 条关系 / 24 位角色 / 11 条路线；具备上映顺序、故事时间线、Phase 阶段、6 条专题路线、作品详情、角色图鉴、关系探索（列表 + Canvas 网络图）、宇宙全景时间轴、标记已看 / 想看、进度与成就、分享海报、反馈提交、法律页。
**没有**：全文搜索、H5 外链 / web-view / 播放器、资讯、论坛、账号与云同步、**复联5补课专题**。收藏与保存路线在模型层有 API，但 UI 无入口（见 §2.10）。

**Q2 H5 复联5专题哪些可以直接复用，哪些需要适配？**
可直接复用：**1 份专题数据文件**（`h5/data/special-routes.js`，只存 workId 引用 + 文案）、**信息架构**（起点 / 核心 8 节点 / 完整 15 节点 / 五段链 / 底部入口）、**勾选进度逻辑**，且经实测 **15 个唯一 workId 在小程序现有 59 条 CONTENT 中 15/15 全命中**，作品名 / 类型 / 阶段 / 海报无需新增数据。
需要适配：`window.MCU_SPECIAL_ROUTES` → `module.exports`；H5 的 `<a href>` → 小程序路由；`MCU_UPCOMING['avengers-5']` 在小程序无同名数据源；洛基 S1/S2 共用 id 的进度语义；`<details>` 折叠 → WXML 条件渲染；底部 3 个 HTML 入口 → 小程序页面路径；文案与视觉去「观看 CTA / 外链」化。
**重要落差**：用户设想的「人物关系、关键事件」在 H5 专题里**并不存在**——专题不加载 `characters.js` / `relations.js`，无人物关系图、无时间线、无关键事件清单，只有 4 条主题线索 + 金色终点卡。若产品要求补齐，属于新增内容设计，超出「轻量移植」范围（§3.5、§6）。

**Q3 下一版本怎么以最小成本上线？**
**推荐方案 C（保留 H5 信息架构的轻量移植），以方案 A 的落地形态承载**：新增 **1 个独立专题页 + 1 个端内专题数据文件 + 首页 1 个入口**，`app.json` 加 1 行、`about.wxml` 改 1 行。不改 tabBar、不改 `shared/data`、不改 `routes.js` / `movies.js`、不碰抖音端、不新增存储 key、不引入 web-view。估算 **1～2 人日开发 + 0.5 人日自测/真机回归**，建议版本 **V1.3.0**（§4、§5）。

---

## 1. 核查范围与证据口径

| 标记 | 含义 |
|---|---|
| 【实测】 | 直接从代码读出，或经 Node 只读加载数据文件验证 |
| 【记录】 | 来自 `VERSION.md` / `docs/版本/CHANGELOG.md` / git log，仅用于版本与发布事实 |
| 【未验证】 | 本次无法验证，明确列出，不假设已实现 |

主要核查：`wechat/app.json`、`app.js`、`app.wxss`、`project.config.json`、`sitemap.json`、`models/*`（6 个）、`data/*`（11 个）、`pages/*`（15 页 × js/wxml/json/wxss）；`h5/special.html`、`h5/data/special-routes.js`、`h5/data/upcoming.js`、`h5/data/content.js`、`h5/assets/js/app.js`、`h5/index.html`、`h5/assets/css/v1-special.css`；`shared/sync_data.sh`；git log。

**发现一处文档互相矛盾**：`project.json`（更新于 2026-10-08）仍记「复联5专题代码零落地／15 部清单不存在」，但代码里 `h5/special.html`、`h5/data/special-routes.js` 已存在，`VERSION.md` 记 2026-10-13 已上线。**本报告一律以代码为准**，并建议后续由文档管理侧更新 `project.json`（本次只读，未改）。

---

# 第一部分：现有小程序全面盘点（V1.2.2）

## 2.1 目录结构与技术框架【实测】

- 框架：**微信原生小程序**（WXML / WXSS / JS / JSON），无构建工具、无 npm 依赖、无自定义组件目录（`wechat/` 下无 `components/`，15 页 `*.json` 的 `usingComponents` 全为空）。
- 结构：`wechat/{app.js,app.json,app.wxss,project.config.json,sitemap.json}`、`pages/`（15 页 × 4 文件）、`models/`（6 个）、`data/`（11 个 CommonJS 数据文件）、`assets/`（本地 Tab 图标等）、`utils/` 与 `workspace*/`（开发期脚本，已被 `project.config.json` 的 `packOptions.ignore` 排除）。
- 技术点：`app.wxss` 定义全局 Token（`--bg #080B12` / `--surface-* ` / `--gold #F2B233` 等，`app.wxss:8-15`）与通用类（`.mcu-page`、`.mcu-card`、`.btn-accent`、`.poster-pN` 等，`app.wxss:138-278`），全部页面靠全局样式而非组件复用。
- 数据链路：`shared/data/*.js` 为权威源 → `shared/sync_data.sh:19-24` 单向复制到 `wechat/data/` 与 `douyin/data/`；H5 为 `window.MCU_*` 全局格式，**不在同步脚本范围内**（`sync_data.sh:7-8,28`）。

## 2.2 实际运行页面与路由【实测】

`app.json:2-18` 注册 **15 页**，TabBar 4 项（`app.json:26-57`）：首页 / 路线 / 探索 / 我的MCU。

| 页面 | 类型 | 实际功能 | 入口来源 |
|---|---|---|---|
| `home` | Tab | Hero + 进度条、旅程卡、推荐下一部、2×2 入口、热门角色、最近观看 | TabBar |
| `routes` | Tab | 基础/专题双 Tab、11 条路线卡、当前路线进度、下一部、P1–P6 阶段条 | TabBar / 首页 |
| `route-detail` | 子页 | 路线简介、进度、下一部、路线节点列表 | `routes` / `my-mcu` |
| `movie` | 子页 | 详情 Hero、三态 CTA、观看说明、为什么现在看、主要角色、前后关联、下一部、标记已看、成就弹层 | 多页 |
| `explore` | Tab | 中心角色切换（24 角色底部弹层）、关系列表 5 类筛选、Canvas 网络视图 | TabBar / 首页 |
| `panorama` | 子页 | 六阶段纵向时间轴、已看状态、待映占位、点节点进详情 | 首页「宇宙时间线」 |
| `characters` | 子页 | 24 位角色、阵营筛选、出现作品数 | 首页「角色图鉴」 |
| `character` | 子页 | 首次出现、关联作品、共同出演推导的关联角色 | `characters` / `home` / `movie` |
| `browse` | 子页 | 按上映序分组的全部内容浏览（含海报与观看状态） | **注册但无任何跳转入口**（见 §2.10） |
| `my-mcu` | Tab | 进度 X/59、成就墙 6 项、当前路线、最近观看、观看记录、收藏列表、反馈与法律入口 | TabBar |
| `share` | 子页 | Canvas 2D 生成 progress / route / movie 三类海报、保存相册、转发 | `my-mcu` / `movie` 成就弹层 |
| `feedback` | 子页 | 6 类反馈 + 500 字文本 → CloudBase `feedback` 集合，失败落本地队列 | `my-mcu` |
| `about` / `agreement` / `privacy` | 子页 | 版本说明 / 用户协议 / 隐私政策 | `my-mcu` 法律入口 |

## 2.3 首页布局、导航与入口【实测】

`home.wxml` 自上而下 **6 个区块**（注释写「5 模块」，实际含推荐大卡共 6 段）：
① Hero Banner + 迷你进度条 → ② 旅程/推荐小卡 → ③ 推荐下一部大卡 → ④「宇宙入口」2×2 视觉卡 → ⑤ 热门角色横滚 → ⑥ 最近观看横滚。

4 张入口卡（`home.js:38-43`）与跳转（`home.js:217-223`）：
`开始观看 → switchTab routes`｜`宇宙时间线 → navigateTo panorama`｜`角色图鉴 → navigateTo characters`｜`关系探索 → switchTab explore`。
其余跳转：`home.js:202/208`（→ movie）、`:213`（→ routes）、`:228`（→ character）。
**首页不存在任何「复联5 / 专题 / special / doomsday」入口或字段**（`home.js`、`home.wxml` 全文核查）。一级导航 = 4 个 Tab，专题上线不需要新增 Tab。

## 2.4 数据组织【实测（Node 只读加载统计）】

| 数据 | 文件 | 实测条目 | 说明 |
|---|---|---|---|
| CONTENT（电影/剧集/特别呈现/短片） | `data/content.js` 合并 `movies/series/special/short` | **59** | 字段 `id, cn, en, year, date, phase, saga, ro, co, mainline, starter, role, sf, chars, next, type, importance, source*` |
| 关系 | `data/relations.js` | **92** | `from / to / type / weight / why` |
| 角色 | `data/characters.js` | **24** | `camp / first / note` 等 |
| 路线 | `data/routes.js` | **11** | 5 条 `basic` + 6 条 `topic`；`items` 为纯 workId 字符串数组，或 `generator` 动态生成 |
| 全景连接 | `models/pano.js` | 41 边 / 38 节点 + 2 待映占位 | 含 `avengers-5`（`毁灭之日`, 2026）与 `avengers-6` |
| 上映预告 | `data/movies.js:501-507` | 2 条 | `UPCOMING = [{ cn, en, date, note }]`，**无 id 字段**，含《复仇者联盟5：毁灭之日》2026-12-18 |
| 视觉资源 | `data/visuals.js` | 38 海报 / 38 剧照映射 | CDN `https://mcu.yaokaixin.top`（`visuals.js:24-28`） |

模型层：`mcuData.js`（索引/查询/三视图/路线展开/关系邻接/视觉转发）、`userState.js`（用户态）、`recommend.js`（下一部）、`achievements.js`、`shareData.js`、`pano.js`。

## 2.5 现有观影顺序与内容展示【实测】

- **上映顺序 / 故事时间线**：`mcuData.js:25-26` 的 `byRelease` / `byChrono`；`routes.js` 的 `release` / `chrono` 路线由 `generator` 生成（`mcuData.js:139-148`）。
- **Phase 阶段**：1–6 分组（`browse.js:30-38`）、阶段色 `mcuData.phaseColor`、阶段代表图、`panorama` 六阶段纵向时间轴。
- **11 条路线**：`新手入坑 / 上映顺序 / MCU 时间线 / 精简主线 / 推荐完整` + `蜘蛛侠 / 复仇者联盟 / 钢铁侠 / 美国队长 / 多元宇宙 / 无限宝石` 六条专题路线。
  ⚠ 其中 **`multiverse-line`（多元宇宙路线）的 `forWho` 已写「为《复联5》做准备」**（`data/routes.js:121`），但它的 8 部片单是 `doctor-strange, endgame, no-way-home, multiverse-of-madness, quantumania, deadpool-wolverine, fantastic-four, brand-new-day`，**与 H5 专题「核心 8 部」口径不同**，不构成补课专题；后续接入需避免双口径并存造成用户困惑（§4.3）。
- **作品详情**：`movie` 页展示中英文名、阶段、类型、重要度标签、三态状态、`role` 长文案（为什么现在看）、前 4 位角色、前后关联、`next.*.why` 下一部理由；**观看说明模块固定声明「不提供播放/下载」**（`movie.wxml:53-65`、`movie.js:158-159`）。

## 2.6 用户功能矩阵【实测】

| 功能 | 状态 | 证据 |
|---|---|---|
| 全文搜索（输入关键词找作品/角色） | **未实现**：`pages/` 内唯一 `bindinput` 是反馈页 textarea（`feedback.wxml:23`），无 `<input>` 搜索框 | — |
| 筛选 | **已实现**：`explore` 关系 5 类 chips（`explore.js:43-50,180-190`）、`characters` 阵营筛选（`characters.js:64-74`）、`routes` 基础/专题 Tab、`mcuData` 三视图 + 类型过滤 | — |
| 排序 | 上映序 / 故事时间线序 / 阶段序（数据层与页面均有） | `mcuData.js:25-26`、`browse.js:13-15` |
| 标记已看 / 想看 | **已实现**：`movie.js:269-297` → `userState.want/toggle`，成就弹层联动 | — |
| 收藏 | **模型有、UI 无入口**：`userState.js:136-147` 与 `my-mcu` 收藏列表齐备，但 15 页 WXML 中无收藏按钮；`my-mcu.wxml:107` 还提示「在电影详情页点击收藏」，实际点不到 | §2.10 |
| 进度 / 成就 | **已实现**：`X/59` 进度、路线进度百分比、6 项成就墙 + 弹层 | `my-mcu.js:77-124`、`achievements.js` |
| 保存路线 / 当前路线 | **模型有、UI 无入口**：`userState.saveRoute/savedRoutes/getCurrentRoute` 存在，但 `pages/` 无调用，故 `current_route` 通常为空、回落到默认 `newcomer` | §2.10 |
| 下一部推荐 | **已实现**：`recommend.next(id,'mainline')`，首页 / 路线 / 详情三处 | `home.js:125-127`、`movie.js:194` |
| 分享海报 | **已实现**：Canvas 2D 三类海报 + 保存相册（含授权引导）+ 转发 | `share.js:642-689` |
| 反馈 | **已实现**：CloudBase `feedback` 集合，最小必要 3 字段，失败本地队列 | `feedback.js:46-90` |
| 关系图 / 时间线 | 列表 + Canvas 力导向网络图（`explore`）、六阶段全景时间轴（`panorama`） | `explore.js:209+`、`panorama.js:32-79` |
| 外链 / 播放器 | **零实现**：全目录无 `web-view`、无 `mcuatlas.xyz`、无 `navigateToMiniProgram`、无视频链接 | 全域检索 |

## 2.7 本地存储与用户数据机制【实测】

| key | 用途 | 位置 |
|---|---|---|
| `mcu_nav_user_v1` | 主用户态：`watched / want_to_watch / favorite / saved_routes / last_watched / current_route / current_content / milestones_shown` | `userState.js:18`，`app.js:10` |
| `mcu_nav_seen_v1` | V1 旧数据迁移用（只读一次后写入新 key） | `userState.js:19,32-42` |
| `mcu_nav_achievements_v1` | 成就解锁与弹窗去重 | `achievements.js:17` |
| `_mcu_feedback_queue` | 反馈云写入失败时的本地缓冲 | `feedback.js:18,68-85` |
| `mcu_nav_share_v1` | 分享记录 `{ total, byType, history }`，供成就判定与统计 | `shareData.js:9-17,57-64` |

**无账号、无登录、无用户身份信息采集**；唯一上云是 `feedback` 三字段纯文本（`app.js:18-21` 初始化 `wx.cloud`）。`privacy.wxml:7,12` 与 `agreement.wxml:14` 明确「仅本机存储、不上传」「相册写入权限仅保存海报时使用」。

## 2.8 小程序配置 / 分包 / 资源加载【实测】

- `app.json`：**无 `subPackages`**，15 页全在主包；`lazyCodeLoading: "requiredComponents"`；`style: "v2"`；`sitemapLocation`；`sitemap.json` 全页 allow。
- `project.config.json`：`appid wx78f00e7f0a5948b7`、`libVersion 3.0.0`、`urlCheck:false`、`es6/enhance/postcss/minified` 开、`bigPackageSizeSupport:true`、`uploadWithSourceMap:true`；`packOptions.ignore` 排除 `workspace/`、`utils/` 两个开发脚本、大量预览图与 `assets/{avatars,phases,hero,entries,backgrounds}` 目录。
- 资源：Tab 图标走本地 `assets/icons/tab/*.png`；海报/剧照/头像/Hero/入口背景走 **CDN `https://mcu.yaokaixin.top`**（`visuals.js:24-28`），并有 `poster-pN` 首字兜底与 `binderror` 降级（`home.js:231-239`）。
- 合规事实：无 `web-view`、无视频、无 H5 引导组件、无外链；`feedback` 已按 V1.2.1 审核反馈删除联系方式字段（`feedback.js:5-6`）。

## 2.9 版本号与最近一次发布【实测 + 记录】

- 页面展示版本：**V1.2.2**（`about.wxml:12`），「最近更新：2026-09-22」（`about.wxml:23`），并注明「以微信后台实际上传版本号为准」。
- git：`03dd3da 2026-09-22 fix(wechat): 关于页版本号硬编码残留修正 → V1.2.2/2026-09-22` 是 `wechat/` **最近一次提交**（`git log -- wechat/`），此后小程序源码无提交，即**当前代码基线就是 V1.2.2**。
- 发布记录【记录】：`docs/版本/CHANGELOG.md:9,22` 与 `MCU项目总览.md §12` 记「微信 V1.2.2 于 2026-09-22 11:42 发布上线：图片域修复（visuals 迁 `mcu.yaokaixin.top`）+ 关于页版本号修正」；此前 V1.2.1（2026-09-10）曾因「涉及视频服务，个人主体未开放类目」被驳回，申诉（无播放器/无视频资源/无外部视频跳转）后通过（`VERSION.md:347-371`）。
- **版本配置不一致**：`project.config.json:2` 的 description 仍写「V1.0 小程序」，`app.js:1` 注释「V1.0」，而页面/发布记录为 V1.2.2 —— 属描述性陈旧，不影响运行。

## 2.10 四分类归纳（重点：已有但未使用 / 未完成 / 有问题）

**A. 已实现且可正常使用（基于代码 + 已上线记录，真机状态见 §7）**
15 页注册与 4 Tab、11 条路线与路线详情、59 条内容详情、24 角色图鉴与角色详情、关系探索（列表 + Canvas）、全景时间轴、标记已看/想看、进度与成就、下一部推荐、分享海报与转发、反馈提交、法律页、CDN 海报与兜底。

**B. 已实现但存在问题（静态代码判定，需真机复核）**
1. **字段名不匹配**：`CONTENT` 条目字段是 `cn`（实测无 `title`），但 `routes.js:93` 取 `nextMovie.title`、`route-detail.js:79` 取 `m.title` → 路线页「下一部」名称与路线详情页节点标题可能渲染为空。其它页面（`home/browse/movie/character`）均正确使用 `m.cn`。
2. **收藏功能不可达**：模型与「我的收藏」列表齐备，但作品详情页及其它页面均无收藏按钮；`my-mcu.wxml:107` 的引导文案与实际 UI 不符。成就「收藏家（收藏 ≥5）」因此基本无法解锁（`achievements.js:26`）。
3. **保存路线未接线**：`userState.saveRoute()` 等 API 无任何页面调用，`current_route` 恒为空，`routes` / `route-detail` / `my-mcu` 一律回落 `newcomer`；`route-detail.wxml:27` 的「当前路线」高亮条通常不显示。
4. **`browse` 页孤立**：`app.json` 注册了 `pages/browse/browse`，但 15 页中无任何 `navigateTo('/pages/browse/browse')`，也无 Tab 入口，用户正常路径无法到达。
5. **版本描述陈旧**：`project.config.json`、`app.js` 注释仍为 V1.0。
6. **文档口径冲突**：`project.json` 记「复联5专题代码零落地」与代码/VERSION 不符（§1）。

**C. 只有设计 / 文档，没有实际实现**
观看资源模块（`data/resources.js` 仅 `status:'pending'` 占位，页面固定为「不提供播放/下载」说明）；`project.json` 中「V1.2 UI/视觉重构」无对应代码推进证据；微信论坛只读（项目文档列为「暂无规划」）。

**D. 尚未开发**
全文搜索；账号 / 云同步；资讯 / 社区；H5 外链 / web-view / 视频播放；**复联5补课专题**（含专题数据、专题页、首页入口）；分包。

---

# 第二部分：H5 复联5专题内容核查

> 依据 `h5/` 本地实际代码；上线记录见 `VERSION.md:3-70`（「SPECIAL-DOOMSDAY V1，2026-10-13 13:25 已上线」）与 `VERSION.md:73-126`（首页横幅 15:34 上线）。**线上实时页面本次未联网验证**（§7）。

## 3.1 专题位置与形态【实测】

- 数据：`h5/data/special-routes.js` → `window.MCU_SPECIAL_ROUTES`（**1 条** `avengers-doomsday`）。
- 页面：`h5/special.html`（页面壳 + 内联 ES5 IIFE 渲染，`special.html:313` 用 `innerHTML` 拼装）；样式 `h5/assets/css/v1-special.css`（`sp-*` / `.v2-topic-*`）。
- 入口：`h5/index.html:56-70` 首页横幅 `<a href="special.html?id=avengers-doomsday">`，日期/英文名运行时取 `MCU_UPCOMING['avengers-5']`。
- 全局改动仅 2 处常量：`app.js:1135-1142`（`KEEP` 保留 `?id=`）、`app.js:1203,1206`（`mount` 页面键映射 `special`）。

## 3.2 专题包含的作品【实测】

**起点（不计入进度、不可点）**：`endgame`《复仇者联盟4：终局之战》，kw「时间线起点」（`special-routes.js:45`）。

**核心路线 8 节点**（`special-routes.js:50-59`，顺序即观看顺序；名称运行时由 `MCU.data.get(workId).cn` 解析）：

| # | workId | 显示名 | 类型 | 为什么需要看（kw） |
|---|---|---|---|---|
| 1 | `loki` | 洛基 S1（label 区分） | 剧集 | TVA / 时间线 |
| 2 | `loki` | 洛基 S2（label 区分） | 剧集 | 多元宇宙正式开启 |
| 3 | `multiverse-of-madness` | 奇异博士2：疯狂多元宇宙 | 电影 | 宇宙碰撞 |
| 4 | `no-way-home` | 蜘蛛侠：英雄无归 | 电影 | 多元宇宙暴露于人 |
| 5 | `deadpool-wolverine` | 死侍与金刚狼 | 电影 | 穿越者入局 |
| 6 | `brave-new-world` | 美国队长4：勇敢新世界 | 电影 | 新世界秩序 |
| 7 | `thunderbolts` | 雷霆特攻队* | 电影 | 反英雄集结 |
| 8 | `fantastic-four` | 神奇四侠：初露锋芒 | 电影 | 入口开启 |

**完整路线 15 节点**（`special-routes.js:66-82`，默认折叠）：在核心 8 部基础上重排并新增 7 部 —— `wandavision`《旺达幻视》、`quantumania`《蚁人与黄蜂女：量子狂潮》、`falcon-winter-soldier`《猎鹰与冬兵》、`hawkeye`《鹰眼》、`ironheart`《铁心》、`daredevil-born-again`《夜魔侠：重生》、`what-if`《假如…？》。**full 节点没有 kw 字段，只显示「电影/剧集」类型**。

**终点卡**：`avengers-5`《复仇者联盟5：毁灭之日》/ `Avengers: Doomsday` / `2026-12-18`，取 `h5/data/upcoming.js:35-43`，标题短名由 `en.split(':').pop()` 派生、中文「5」由正则派生，**零硬编码**。

## 3.3 观看顺序与分阶段安排【实测】

`core` 与 `full` 是**两条并列、各自有序的独立数组**（不是 core 后追加 7 部）；按数组下标渲染，core 默认展开、full 用原生 `<details>` 默认折叠。**没有第三阶段、没有阶段编号、没有分组小标题**。页面上的「阶段」只是卡片上的 MCU `P{phase}` 标签（`special.html:144`）。
进度徽章「已看 n / 8」只统计核心区；按**节点数**计，洛基 S1/S2 因共用 `workId:'loki'`，勾选一次两个节点同时亮（「一勾两亮」，`special.html:129,135`），这是已登记的设计决策，页面不提示。

## 3.4 每部作品为什么需要观看【实测】

仅 core 8 节点有 `kw` 短句（见 §3.2 表），起点条有 `kw`；**无逐部长理由文案**（数据里不存在 `why`/`desc`）。`movies.js` 的 `next.*.why` 长文案专题页未读取。full 区的 `desc` 是整条路线的合规说明：「MCU Atlas 整理路线，非官方指定片单」（`special-routes.js:65`）。

## 3.5 人物、人物关系、关键事件【实测：专题里没有】

- `special.html:24-36` 显式声明**不加载** `news.js / community.js / relations.js / routes.js / characters.js / components.js`；专题页**不展示任何角色、人物关系、关系图**。
- 所谓「为什么要补」是 **4 条主题线索 + 1 张金色终点卡**，不是关键事件清单（`special-routes.js:88-96`）：
  ① 时间线：终局之战后时间向前跳了数年；② 多元宇宙：洛基与奇异博士把平行宇宙变成主线；③ 跨宇宙角色：死侍、金刚狼、神奇四侠来自其他宇宙；④ 新一代英雄：山姆接盾、雷霆特攻队集结；⑤ 金色卡：三条线汇合到毁灭博士。
  无日期、无事件条目、无「关键事件列表」数据文件。
- ⚠ **因此本次任务设想的「人物关系、故事线、关键事件」内容，H5 专题并未提供**。小程序若照搬，只能得到「片单 + 短理由 + 4 条主题线索」。补齐人物关系/事件属于**新增内容设计与新数据**，需要产品另行拍板（§6）。

## 3.6 关系图、时间线、关联跳转【实测】

- 作品卡片点击 → `movie.html?id={workId}`（`special.html:132-134`）；序号按钮阻止冒泡，仅切换已看状态。
- 底部 3 个入口（`special-routes.js:100-107`）：`index.html`、`routes.html`、`map.html`。
- **无人物关系图页、无独立时间线页跳转、无社区/评论、无「下一部看这部」专区**（`special.html:24-36` 脚本清单 + 渲染串）。
- 交互三件：折叠、进度徽章、勾选（局部重渲染，不刷新不跳转）。
- 进度与 `movie.html` **共用唯一 key `mcu_nav_user_v1`**（`app.js:206`，结构 `{watched:{contentId:timestamp},...}`），专题零新增 localStorage key，与作品详情页双向同步。

## 3.7 数据存放与关联方式【实测】

`window.MCU_SPECIAL_ROUTES = [{ id, upcomingId, title, tagline, heroNote, origin{workId,kw}, core{title,items[{workId,label,kw}]}, full{title,desc,items[]}, chain{title,items[{t,d}],end{d}}, entry{title,primary{text,href},links[]}} ]`（`special-routes.js:35-108`）。
**数据纪律三条**（`special-routes.js:8-20`）：只存 workId 引用、作品名运行时取 `MCU.data.get(workId).cn`；`label` 仅用于洛基 S1/S2；上映日期/中英片名取 `MCU_UPCOMING[upcomingId]`；**故意不进 `routes.js` / `movies.js` / `shared/data`**，避免改变三端同步链。

**关键可行性验证（本次 Node 只读加载）**：
- H5 `MCU_CONTENT` 59 条，专题 **15 个唯一 workId 15/15 全命中**；
- 小程序 `wechat/data/content.js` 的 `CONTENT` 59 条，专题 **15 个唯一 workId 15/15 全命中，零缺失**（含 `fantastic-four`、`thunderbolts`、`brave-new-world`、`daredevil-born-again`、`ironheart` 等较新作品）。
→ **专题接入小程序不需要新增/扩充作品数据，也不需要改 `shared/data` 或执行 `sync_data.sh`**。这是最小成本方案的决定性依据。

## 3.8 可直接复用 / 需要适配

| 可直接复用 | 需要适配 |
|---|---|
| `special-routes.js` 的 1 条数据（workId 引用 + 全部文案、kw、chain、title/tagline/heroNote） | `window.MCU_SPECIAL_ROUTES` → `module.exports`（CommonJS） |
| 信息架构：起点 / core 8 / full 15 / 五段链 / 底部入口、双 CTA、进度徽章、勾选态 | `<details>` 折叠 → WXML `wx:if` + 布尔 data；`<a href>` → `wx.navigateTo`/`switchTab` |
| 15 个 workId 在小程序 CONTENT 全部命中；作品名/类型/阶段/海报可直接由 `mcuData.get/visual/phaseColor/typeLabel` 解析 | 底部 3 个 HTML 入口 → `/pages/home/home`、`/pages/routes/routes`、`/pages/panorama/panorama` |
| 进度语义：`userState.isSeen/toggle(workId)` 与 `mcu_nav_user_v1` 同构，零新增 key | `MCU_UPCOMING['avengers-5']` 小程序无同名源：需复用 `movies.js` 的 `UPCOMING`（无 id）或新增端内 `upcoming` 小映射 |
| 视觉 Token（三端统一：`#080B12/#161D2B/#F2B233`）与 `sp-*` 样式思路 | H5 CSS（`sp-*` / `v1-special.css`）→ WXSS（rpx、无 `:root` 依赖需改用 `app.wxss` 变量） |
| 文案「非官方指定片单」「只整理观看顺序、不提供播放」合规口径 | 洛基 S1/S2 共用 id 的「一勾两亮」、8 部按节点计数，需在小程序明确沿用口径 |
| — | H5 首页横幅 `.v2-topic`（DOM + 内联数据填充脚本）→ 小程序首页一个 WXML section |

---

# 第三部分：小程序接入方案评估

## 4.1 A / B / C 对比

| 维度 | A 独立专题页 | B 现有观影导航扩展 | C H5 轻量移植（保留信息架构） |
|---|---|---|---|
| 做法 | 新增 1 页，内容由小程序自行组织 | 在 `routes.js` 新增一条 `topic` 路线，复用 `route-detail` | 新增 1 页 + 端内专题数据文件，照搬 H5 的 core/full/chain/进度架构，交互与展示小程序化 |
| 开发工作量 | 小（1 页 + 1 入口），但内容需重新编排 | **表面最小、实际最大**：现有 `routes.js` schema 只有 `items: string[]`，无法表达 `label`（洛基 S1/S2）、`kw`、core/full 双路线、chain、upcomingId、起点/终点卡；要扩展 schema 就得改 `shared/data` → 同步抖音端 → 改 `route-detail` 渲染 → 回归 11 条既有路线 | **小且可控**：1 页 4 文件 + 1 数据文件 + 1 入口 + 2 行配置 |
| 用户体验 | 独立、聚焦，但易与 H5 专题体验割裂 | 与现有路线一致，但「补课」的核心/完整双路线与「为什么补」被压平，且会与已有 `multiverse-line`（口径不同）并列混淆 | **与 H5 专题同源同构**，社交流量落地体验一致；可保留 8/15 双路线、勾选进度、五段链 |
| 与现有功能兼容性 | 高（不动现有页） | **低**：触碰三端单一数据源与已上线页面，违反「不重构」 | **最高**：不改 `routes.js` / `movies.js` / `shared/data` / 抖音；只新增 |
| 内容复用程度 | 中（文案要重写） | 低（schema 不兼容） | **最高**：数据文件与 15 个 workId 直接复用，作品名/海报运行时取现有数据 |
| 后期维护成本 | 中：小程序与 H5 两套内容各自维护 | 高：一处改动三端同步 + 老路线回归 | 中低：两份同构数据文件（H5 `window.*` / 小程序 `module.exports`），可用一次性脚本机械转换；上映后按 H5 既有撤除预案同步下线入口 |
| 审核风险 | 中：若做成「海报墙 + 观看 CTA」易触发类目误判 | 中高：改动已过审的路线/作品详情体系，回归面大 | **最低**：新增独立页、不触碰已过审功能；复用「工具/进度/图鉴」语态与「不提供播放」声明 |

## 4.2 明确推荐：**方案 C（以方案 A 的页面形态落地）**

> 推荐表述：**新建一个独立专题页（A 的形态），但页面内容、数据结构、进度语义完整沿用 H5 专题（C 的内核）**；不采用 B。

理由：
1. **零重构**：不动 `shared/data`、不动 11 条路线、不动 15 页既有逻辑，符合「不要为了增加专题而重构整个小程序」。
2. **数据已就绪**：15/15 workId 命中、CDN 海报与 `mcuData` 查询接口现成，专题数据文件只需格式转换。
3. **体验与 H5 对齐**：H5 专题是社交流量落地页（已完成 78/78 + 31/31 验收【记录】），小程序保持一致口径可避免双口径内容。
4. **审核面最小**：新增页 + 首页入口，已过审功能零改动；并沿用现有合规声明。
5. **可撤除**：上映后删首页入口 + 移出 `app.json` 注册即可，无持久化残留。

**不推荐 B 的硬理由**：`routes.js` 是三端同步文件，`shared/sync_data.sh:19-24` 会把它下发到微信 + 抖音；一旦为专题扩展 schema，抖音端 `journey/library` 与微信 `route-detail` 都要回归，且小程序已有一条口径不同的「多元宇宙路线（为《复联5》做准备）」，并列出现会造成内容冲突。

## 4.3 微信小程序审核、内容与交互限制

**代码事实（确定的约束）**：现有包内 **无 `web-view`、无视频、无外部链接、无 H5 引导组件**；`movie.wxml:53-65` 固定声明「不提供播放/下载」；`privacy.wxml` / `agreement.wxml` 声明纯本地存储；`feedback` 只提交 3 个最小必要字段。

**历史审核教训【记录】**：
- 微信 V1.2.1 曾因「涉及视频服务，个人主体未开放类目」被驳回，靠「无播放器、无视频资源、无外部视频跳转」申诉通过 → **专题视觉不得强化「深色海报墙 + 大号观看 CTA」的流媒体观感**（`VERSION.md:369-371`、`MCU项目总览.md §14`）。
- 抖音 V2.3 因「第三方引流（H5 引导入口）」被驳回（`CHANGELOG.md:23`）→ 虽是抖音端规则，但**小程序内不放 H5 链接、不放复制 H5 地址、不引导跳外站**是稳妥做法。
- 抖音 V2.0.0 因「作品详情页影视/文娱特征」被驳回 → 专题文案宜用「节点 / 路线 / 补课进度 / 图鉴」等工具语态。

**接入必须遵守的 6 条**：
1. 不引入 `web-view`，不嵌 H5 专题页；微信小程序 `web-view` 涉及业务域名与个人主体资质限制，**具体以微信公众平台最新规则及后台配置为准（本次未联网核验）**。
2. 专题页内所有跳转都是小程序内部路由（`navigateTo` / `switchTab`），且路径必须在 `app.json` 注册。
3. 不出现「在线观看 / 立即播放 / 资源下载 / 前往 H5」等字样与按钮；保留「只整理观看顺序、不提供播放」口径。
4. 进度复用 `mcu_nav_user_v1`，**零新增 storage key** → 隐私政策与「隐私保护指引」无需变更；若产品决定新增独立进度 key，必须同步更新 `privacy.wxml` 与后台隐私保护指引。
5. 不新增图片资源（复用现有 CDN 海报 + 首字兜底），避免版权与包体积风险；不新增后台接口、不采集用户信息。
6. 上映日期/片名等事实沿用现有数据源（`movies.js` 的 `UPCOMING`、`upcoming.js` 口径），不臆测剧情；专题数据保留「非官方指定片单」说明。

**交互限制**：小程序无 `<details>`、无 DOM 操作、无 `innerHTML`；折叠/勾选/徽章需用 WXML 条件渲染 + `setData`；`scroll-view` 替代锚点滚动；页面层级受 10 层栈限制，专题 → 作品详情 → 角色详情 的跳转链需控制深度。

---

# 第四部分：下一版本升级建议（V1.3.0）

## 5.1 版本号建议

**V1.3.0**（新增功能级：新增独立专题页 + 新主题数据 + 首页入口；V1.2.x 均为修复/视觉迭代）。若产品坚持按修订号管理，可用 V1.2.3，但建议 V1.3.0 以便与 H5 专题版本、抖音 V2.x 区分。
需同步：`about.wxml:12` 版本号与 `:23` 最近更新日期；`docs/版本/CHANGELOG.md`、`VERSION.md`（由文档管理侧在产品验收后更新）；`project.config.json:2` 陈旧的「V1.0」描述建议一并校正（低风险，非必须）。

## 5.2 新增页面与入口（最小集合）

| 新增/改动 | 路径 | 说明 |
|---|---|---|
| 新增专题页 4 文件 | `wechat/pages/special/special.{js,wxml,wxss,json}` | 1 个页面；`json` 设标题「复联5补课路线」、`usingComponents:{}` |
| 新增端内数据 1 文件 | `wechat/data/special-routes.js` | `module.exports`，由 `h5/data/special-routes.js` 机械转换（见 §5.4） |
| 注册路由 1 行 | `wechat/app.json` `pages` 数组 | 加 `"pages/special/special"`；**tabBar 不动** |
| 首页入口 1 处 | `wechat/pages/home/home.{js,wxml,wxss}` | Hero 之后 / 2×2 入口之前新增一张专题横幅（对标 H5 `.v2-topic`），`bindtap` → `navigateTo('/pages/special/special?id=avengers-doomsday')` |
| 可选第二入口 | `wechat/pages/routes/routes.{js,wxml}` | 在「专题路线」Tab 列表顶部加一张「复联5补课路线」卡，同样跳专题页（**不新增 `routes.js` 数据**） |
| 版本文案 | `wechat/pages/about/about.wxml` | V1.3.0 + 日期 |

**不需要改**：`shared/data/*`、`wechat/data/{routes,movies,content,visuals,...}`、`douyin/`、`h5/`、`tabBar`、`userState.js`、`privacy/agreement`、`app.js`、CDN 与 Nginx。

## 5.3 需要复用的现有组件 / 能力

**小程序没有自定义组件目录**（15 页 `usingComponents` 全空），因此「复用」指复用模型、全局样式与现成页面：

- 模型：`models/mcuData.js`（`get / visual / phaseColor / typeLabel / counts`）、`models/userState.js`（`isSeen / toggle / count`，复用 `mcu_nav_user_v1`）、可选 `models/recommend.js`。
- 数据：`data/content.js`（59 条 CONTENT）、`data/constants.js`（阶段色）、`data/visuals.js`（CDN 海报与首字兜底）、`data/movies.js` 的 `UPCOMING`（复联5 片名/日期）。
- 全局样式：`app.wxss` 的 CSS 变量与 `.mcu-page / .mcu-card / .btn-accent / .poster-pN / .chip / .pill-*` 等通用类；新页样式用 `sp-` 前缀隔离，零新增 Token（与 H5 专题同一纪律）。
- 现成页面作跳转目标：`movie`（作品详情）、`home` / `routes` / `panorama`（底部 3 入口）、可选 `share`（专题进度分享，V1.3.1 再评估）。
- 兜底模式：`binderror` + `poster-pN` 首字徽章（CDN 异常时降级）、`wx:key` 列表渲染、`lazy-load` 图片。

## 5.4 需要新增的数据结构

`wechat/data/special-routes.js`（**仅端内文件，不进 `shared/data` 同步链**，避免影响抖音）：

```text
module.exports = [{
  id: 'avengers-doomsday',
  upcomingId: 'avengers-5',
  title, tagline, heroNote,
  origin: { workId:'endgame', kw:'时间线起点' },
  core: { title, items:[{ workId, label|null, kw }] },   // 8 节点
  full: { title, desc, items:[{ workId, label|null }] }, // 15 节点
  chain:{ title, items:[{ t, d }], end:{ d } },
  entry: { title, primary:{ text, route:'/pages/home/home', mode:'switchTab' },
           links:[{ text, route:'/pages/routes/routes', mode:'switchTab' },
                  { text, route:'/pages/panorama/panorama', mode:'navigateTo' }] }
}]
```

适配要点（与 H5 的唯一实质差异）：
1. `label` 保留（洛基 S1/S2 显示名），但**勾选与已看判定仍用 `workId`**，沿用 H5「一勾两亮 / 8 部按节点计」口径，并在页面注明「数据按作品记录」以免误解。
2. `entry.href` → `{ route, mode }`（小程序路由），禁止任何 HTML/外链。
3. `upcomingId` 解析：小程序无 `upcoming.js`。**推荐最小做法**：给 `data/movies.js` 的 `UPCOMING` 两条各补一个 `id` 字段（`avengers-5` / `avengers-6`，1–2 行、不改其它字段、不影响现有逻辑，实测 `UPCOMING` 当前未被 `CONTENT` 纳入），专题按 id 取 `cn/en/date`；`pano.js` 已有 `avengers-5` 占位可交叉核对。**备选**：在专题数据文件内自带 `upcoming:{title,en,date}`（会形成第二处片名维护，不优先）。
4. 页面视图模型在 `special.js` 内由 `mcuData.get(workId)` 装配 `{cn, typeLabel, phase, year, poster}`，**不复制作品数据、不硬编码片名**。
5. 折叠态、勾选态只存页面内存（`data`），**不写 storage**；已看状态复用 `userState`。

## 5.5 是否需要修改现有导航 / 调整原有功能

- **一级导航（4 Tab）不改**、`app.json.tabBar` 不动；与 H5 专题「一级导航不新增」口径一致。
- **首页只新增 1 个 section**，不改 `ENTRY_CARDS` 2×2 的语义与顺序（避免影响已过审首页布局）。
- **现有功能零调整**：不改作品详情、路线、关系、全景、成就、分享、反馈、隐私。
- §2.10 的 6 个存量问题（字段 `title`、收藏入口、保存路线、`browse` 孤立页、版本描述、文档口径）**建议单独立项修复，不并入本次专题版本**，避免扩大回归面与审核面；其中「字段名不匹配」若真机确认影响显示，可作为 V1.3.0 的 1 行附带修复，但需单独登记。

## 5.6 开发工作量与主要风险

**工作量估算**（不含设计与产品验收）：数据转换 + 1 页 4 文件 + 首页入口 + 配置 ≈ **1～2 人日**；自测 / 真机 / 15 页回归 ≈ **0.5 人日**；合计约 **2～2.5 人日**。不需要后端、不需要 CDN 变更、不需要 H5 改动。

| 风险 | 等级 | 应对 |
|---|---|---|
| 类目误判（视频服务）复发 | 中 | 弱化海报墙与观看 CTA，保留「不提供播放/下载」声明，工具/进度语态，零播放器零外链 |
| 专题与已有「多元宇宙路线（为复联5做准备）」片单口径冲突 | 中 | 产品拍板：保留旧路线但专题页注明「补课专题口径」，或后续版本统一；本期不删改旧路线 |
| 洛基 S1/S2 共用 id 导致进度显示异常 | 中 | 明确沿用 H5 口径并在页面/验收清单登记；为 `wx:key` 使用 `index` 而非重复 `workId` |
| `UPCOMING` 补 id 影响既有逻辑 | 低 | 实测 `UPCOMING` 不进 `CONTENT`、不参与推荐与地图；补字段前跑一次数据断言 |
| 新增页面导致主包体积 / 层级栈 | 低 | 无新增图片、无分包需求；`lazyCodeLoading` 已开；控制跳转深度 |
| 隐私/权限声明遗漏 | 低 | 零新增 storage key、零新权限；若方案变更须复核 `privacy.wxml` 与后台指引 |
| 两份专题数据长期不同步 | 中低 | 建立「H5 → 小程序机械转换」一次性脚本/清单，上映后按 H5 撤除预案同步下线 |
| 真机表现未验证 | — | 本次仅静态审查；开发阶段须做 375/390/430 宽度真机 + 15 页回归 + 审核前合规扫描 |

## 5.7 建议交付文件清单（供开发阶段使用，本次未创建）

新增：`wechat/pages/special/special.js`、`special.wxml`、`special.wxss`、`special.json`、`wechat/data/special-routes.js`。
修改：`wechat/app.json`、`wechat/pages/home/home.js`、`home.wxml`、`home.wxss`、`wechat/pages/about/about.wxml`（可选 `wechat/pages/routes/routes.js|wxml` 第二入口、`wechat/data/movies.js` 补 UPCOMING id）。
文档（验收后）：`docs/版本/CHANGELOG.md`、`VERSION.md`、`project.json`（由文档管理侧更新）。

---

## 6. 待产品验收确认项（本报告不代为拍板）

1. **专题内容范围**：是否只移植 H5 现有「片单 + kw + 五段链」，还是要新增「人物关系 / 关键事件 / 时间线」？后者是**新增内容设计 + 新数据**，不在最小成本方案内，需设计稿与内容口径。
2. **入口位置**：首页横幅（推荐）＋/或「路线-专题路线」Tab 卡片；是否接受首页新增一个 section。
3. **与已有「多元宇宙路线」的内容关系**：并存、加注说明，还是后续统一口径。
4. **版本号**：V1.3.0（推荐）或 V1.2.3。
5. **洛基 S1/S2 进度口径**：沿用 H5「一勾两亮 / 8 部按节点计」还是小程序改为按作品计（改动会与 H5 不一致）。
6. **存量 6 个问题**是否单独立项，不并入专题版本。

> 依项目协作规范，本阶段为开发侧只读盘点；设计相关约束与待确认项待产品验收后，由对应窄向同步通道（`同步/给设计/…`）另行发起，本次未创建同步文件。

## 7. 无法验证 / 未纳入范围（明确标注）

- **线上 H5 专题实时状态未联网验证**：本报告依据 `h5/` 本地源码 + `VERSION.md` 上线记录；`https://mcuatlas.xyz/special?id=avengers-doomsday` 的当前可访问性、线上缓存版本未测。
- **小程序「可正常使用」为静态代码判定**：未编译、未真机运行、未连微信开发者工具；§2.10 B 类的 6 个问题需真机复核后才能定性为线上缺陷。
- **微信公众平台后台当前线上版本号、服务类目、审核状态、隐私保护指引**未查询；平台规则（个人主体 `web-view` 资质、类目要求）需以官方最新规则为准。
- **抖音小程序**未纳入本次盘点，仅引用其驳回记录作为跨端合规经验。
- H5 专题验收数字（78/78、31/31、36/36 等）来自 `VERSION.md`【记录】，本次未重跑测试。

---

## 8. 三问完整回答（收口）

**1）当前小程序究竟已经具备哪些功能？**
原生微信小程序 V1.2.2，15 页 / 4 Tab / 无分包 / 无账号，59 作品 + 92 关系 + 24 角色 + 11 路线，具备观影顺序（上映/时间线/阶段）、路线与路线详情、作品与角色详情、关系探索（列表 + Canvas）、全景时间轴、已看/想看/进度/成就、下一部推荐、分享海报、反馈、法律页，全部数据本地 `wx.storage`（5 个 key：`mcu_nav_user_v1`、`mcu_nav_seen_v1`、`mcu_nav_achievements_v1`、`mcu_nav_share_v1`、`_mcu_feedback_queue`），唯一上云为反馈文本。收藏、保存路线在模型层存在但 UI 无入口；`browse` 页注册但无入口；路线页/详情存在 `title` 与 `cn` 字段不匹配的风险；**没有搜索、没有专题、没有 web-view / 外链 / 播放能力**。

**2）H5 复联5专题哪些可直接复用、哪些需适配？**
可直接复用：`h5/data/special-routes.js` 的 1 条数据（15 个唯一 workId，实测在小程序 CONTENT 15/15 命中）、core 8 / full 15 / 起点 / 五段链 / 底部入口的信息架构、kw 短理由、勾选进度语义（`mcu_nav_user_v1` 同构）、统一 Token 与合规文案。
需要适配：数据格式转 CommonJS、`upcomingId` 数据源（`movies.js` 的 `UPCOMING` 或补 id）、HTML 链接改小程序路由、`<details>`/DOM 渲染改 WXML + `setData`、H5 CSS 改 WXSS、洛基 S1/S2 共用 id 的进度与 `wx:key`、以及**明确 H5 专题没有人物关系图 / 时间线 / 关键事件清单**——若产品要这些，是新增内容而非移植。

**3）下一版本怎么以最小成本上线？**
**V1.3.0：方案 C 内核 + 方案 A 形态**。新增 1 个专题页（4 文件）+ 1 个端内专题数据文件 + 首页 1 个入口，`app.json` 加 1 行、`about.wxml` 改 1 行；复用 `mcuData` / `userState` / `visuals` / `app.wxss` 与现成 `movie`、`routes`、`panorama` 页；不改 `shared/data`、不改 `routes.js` / `movies.js`（除可选补 UPCOMING id）、不改 tabBar 与一级导航、不碰抖音与 H5、不新增存储 key、不引入 web-view。工作量约 2～2.5 人日，审核面仅限新增页与首页，上映后可一键撤除。**不采用方案 B**（会触碰三端单一数据源与已过审路线体系）。

---

**本次交付物（1 个文件，未修改任何代码）**
`docs/版本/微信小程序/MCU微信小程序V1.2.2现状盘点与复联5专题升级建议报告.md`

**状态：报告完成，等待产品验收；验收通过后再进入开发。**
