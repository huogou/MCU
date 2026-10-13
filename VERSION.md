# MCU小程序版本记录

## SPECIAL-DOOMSDAY（H5 端 · 复联5补课路线专题页 · 已上线）

版本：
SPECIAL-DOOMSDAY V1（复联5补课路线专题 · 社交流量落地页）

时间：2026-10-13

状态：
**已上线**（2026-10-13 13:25）

适用端：
H5（纯静态多页）；微信/抖音小程序**零改动**，`shared/data/` 未动，未执行 `sync_data.sh`

线上地址：
- 主入口 `https://mcuatlas.xyz/special?id=avengers-doomsday`
- 等价入口 `https://mcuatlas.xyz/special.html?id=avengers-doomsday`
- 短链 `/special/avengers-doomsday` **尚未配置**（Nginx rewrite 待放行，当前 404）

新增文件：
- `h5/special.html`（页面壳 + 内联渲染/交互脚本，ES5 IIFE，同构 route-detail.html）
- `h5/data/special-routes.js`（`window.MCU_SPECIAL_ROUTES`，1 条 `avengers-doomsday`）
- `h5/assets/css/v1-special.css`（`sp-*` 全套样式，Token 全复用，零新增变量）

修改文件：
- `h5/assets/js/app.js`（**仅 2 处常量**，净增 7 行）
  ① `injectSeoTags` 的 `KEEP` 增 `'special.html': ['id']`（否则 canonical 被洗掉 `?id=`）
  ② `mount()` 页面键映射增 `special` + `{ specialId }` 载荷

页面结构（6 区块，顶栏/页脚由 `MCU.ui.mount` 注入）：
`sp-hero`（双 CTA 锚点）→ `sp-core`（起点条 + 8 节点 + 进度徽章 + 终点条）→ `sp-full`（原生 details，默认折叠，15 节点）→ `sp-chain`（五段链 + Doomsday 金卡）→ `sp-entry`（底部入口）

核心数据纪律：
- 作品名一律运行时取 `MCU.data.get(workId).cn`；数据文件只存引用，**不复制作品数据**
- `label` 仅用于洛基 S1/S2（共用 `id: 'loki'`），其余为 `null`，**禁止二次命名**
- 上映日期 / 英文片名 / 中文片名一律取 `MCU_UPCOMING['avengers-5']`；短英文名由 `en.split(':').pop()` 派生，终点圆点数字由 `title.match(/联盟(\d+)/)` 派生 —— **全程零硬编码**
- 15 个唯一 workId 全部命中既有 CONTENT 59 条，**无缺失、无编造数据**

关键口径（项目负责人 2026-10-13 锁定）：
- 底部主入口落点：`index.html`
- 「8 部」进度按**节点数**计（洛基 S1/S2 为两个节点，勾其一即 2/8）
- 洛基「一勾两亮」为已知设计决策，页面不提示
- 一级导航不新增（`NAV` 仍 4 项）

用户状态：
- **零新增 localStorage key**，复用既有 `mcu_nav_user_v1`（`MCU.progress`）
- 与 `movie.html` 作品详情页共用同一份进度，**双向同步已验证**
- 无账号系统、无后端、无第二套数据源

验收：
- 本地自动化两轮 **78 / 78 PASS**（功能正确性 45 + 设备模拟/点击热区/数据降级/跨页闭环 33）
- 设计 AI 独立验收 **32 / 32 PASS**，规格符合度 95%+，5 项偏差登记放行
- 线上自动化 **31 / 31 PASS**（页面 / 状态持久化 / SEO / 资源海报 / console + 全站 8 页回归零影响）
- SEO：canonical 保留 `?id=`、`og:url` 同步、`title`/`description` 数据驱动（85 字符 ≤150）
- 缓存：`.html` 为 `no-cache`；`app.js` / `.css` / `.js` 为 7 天强缓存 —— `app.js` 旧缓存仅影响 canonical 与埋点，**不影响页面渲染**

服务器：
- 站点根 `/www/wwwroot/mcu-h5/`
- 回滚点 `.bak-special-20261013/assets/js/app.js`（MD5 `89fca35acafa0b365f2fc8471255ff07`，=部署前线上原版）

待办：
- Nginx 短链 rewrite（前置条件已满足，待负责人放行）
- 内置浏览器真机检验（已移交设计 AI，见 `docs/同步/复联5补课路线专题-上线后同步.md`）

交付文档：
- 规格 `docs/同步/复联5补课路线专题-H5-设计AI正式规格-V1.md`
- 设计验收 `docs/同步/复联5补课路线专题-设计AI验收结论.md`
- 落地方案 / 实现报告 / 上线验收记录 `AI生成文件/H5/复联5补课路线专题/`

---

## H5-HOME-TOPIC-CARD（H5 端 · 首页专题入口横幅 · 已上线）

版本：
H5-HOME-TOPIC-CARD V1（首页横幅，指向复联5补课路线专题）

时间：2026-10-13

状态：
**已上线**（2026-10-13 15:34，https://mcuatlas.xyz/）

适用端：
H5 首页（`h5/index.html`，**仅此一个页面**）；专题页与专题本体共用样式文件；微信/抖音小程序零改动

口径变更：
**原口径「首页专题入口卡 V1 暂不上线」已由项目负责人推翻**，本横幅为 V1 正式交付内容

规格与设计稿：
- 规格 `docs/同步/复联5补课路线专题-首页入口卡规格-V1.md`
- 设计稿 `AI生成文件/H5/复联5补课路线专题/首页入口卡-设计稿.png`

修改文件（仅 2 个，线上 MD5 与本地逐字节一致）：
| 文件 | MD5 | 改动 |
| --- | --- | --- |
| `h5/index.html` | `3591bbe8a5e3ccd8db35020d2cacaaf9` | 新增 `.v2-topic` section + head 一行 CSS link + 数据填充脚本 |
| `h5/assets/css/v1-special.css` | `d64435927e445ec43a8d9df93cb7916c` | 追加 `.v2-topic-*` 样式块（含 `@media ≥1024` 3 行） |

实现要点：
- 位置：`v2-hero` 之后、`v2-routes` 之前（符合规格第一节）
- 整卡 `<a>` 包裹 → `special.html?id=avengers-doomsday`
- 日期 `2026.12.18` 与英文名 `DOOMSDAY` **运行时取 `MCU_UPCOMING['avengers-5']`**，英文短名由 `en.split(':').pop()` 派生（与专题页终点条同一口径）
- 副文案按规格第七节拍板①：「复联5之前，先看这 8 部」
- 样式类名 `.v2-topic-*`，与专题页 `.sp-*` 分离；Token 全复用，零新增变量
- **一级导航未新增**（`NAV` 仍 4 项）

与规格的 1 处判断差异（已登记，待设计 AI 确认）：
规格第三节两处写「PC 卡片 `max-width: 760px` 居中」，但设计稿中横幅**与 Hero 内容列同宽**。实现按设计稿对齐 `.v2-hero-inner`（≥1024px 时 `max-width:1280px; padding:22px 40px 20px`，日期列 `flex: 0 0 220px`）。若设计 AI 认为应按字面 760 执行，改 1 行 CSS 即可。

另一处登记：规格预计「CSS 增量约 1KB」，实际因要求不新增 CSS 文件，首页引入整个 `v1-special.css`（约 16KB / gzip 约 4KB）。首页本已加载 `news.js`(72KB)，无实质影响。

验收：
- 本地 **44 / 44 PASS**（390/430/360/PC1440 四档渲染、位置、无溢出、整卡跳转、源码无字面量日期片名、首页 7 模块未受影响、一级导航仍 4 项）
- 线上 **36 / 36 PASS**（四宽度线上渲染 + 跳转 + 首页回归 + 全站 7 页回归 + 缓存头）
- 首页零 JS 错误、零 console.error、零 4xx

服务器：
- 站点根 `/www/wwwroot/mcu-h5/`
- 回滚点 `.bak-homecard-20261013/`（`index.html` MD5 `8f434b103fdbfbd4247e302d607fbf74`、`assets/css/v1-special.css` MD5 `f9301e183bbc8f7b81f24062caea5369`）

撤除预案（影片上映后）：
1. `index.html` 删除 `.v2-topic` section + head 的 `v1-special.css` link
2. `v1-special.css` 删除 `.v2-topic-*` 样式块
3. 首页视觉抽查一次；无持久化、无缓存 key、无残留
4. ⚠️ `index.html` 为 `no-cache` 撤除即时生效；`v1-special.css` 为 7 天强缓存，老客户端最长 7 天可能仍带样式，因 section 已删最多表现为无样式裸元素，不影响其他区块

---

## H5-FAVICON（H5 端 · 全站 favicon 部署）

版本：
H5-FAVICON（原创星轨导航图标）

状态：
**已部署上线**（2026-09-28，https://mcuatlas.xyz/）

适用端：
H5（纯静态多页）；微信/抖音小程序**零改动**

本轮内容：
- 新增原创 favicon 三件套（设计基因：深空圆底 `#080B12` + 品牌金 `#F2B233` 星轨轨道环 + 蓝锚点 `#4A9EF5`）：
  - `h5/assets/favicon.svg`（矢量主力，现代浏览器标签页矢量渲染、16px 锐利）
  - `h5/assets/favicon.ico`（六帧位图 16/32/48/64/128/256，老浏览器兜底）
  - `h5/assets/apple-touch-icon.png`（180px，iOS/Android 主屏图标）
- 全站 13 个线上页面 `<head>` 注入 favicon 引用（index / routes / movie / map / map-pc / community / my-community / news / news-detail / next / post-create / route-detail / topic-detail）
- 设计过程三轮小尺寸辨识度校验（识图复核 16px/32px），最终采用「SVG 矢量主力 + ICO 位图兜底」分层方案

验收：
- 服务器部署：`/www/wwwroot/mcu-h5/`，先备份 `.bak-favicon-20260928/` 可回滚
- sha256 本地与服务器逐字节一致（favicon 三件套 + 抽查 index/news/routes）
- 线上公网验证：favicon.svg / favicon.ico / apple-touch-icon.png 均 200 且 MIME 正确；index.html / news.html head 引用在场；子页面 200

备注：
- favicon 属浏览器强缓存资源，老访客需刷新（Ctrl+F5）后可见新图标
- `review/index.html` 为本地审查页，服务器无此目录，未部署

---

## H5 资讯模块 V2.2（H5 端 · 模拟数据施工完成，未部署）

版本：
H5 资讯模块 V2.2（最新漫威资讯 · 模拟数据阶段）

时间：2026-09-22

范围：H5 端新增「最新漫威资讯」模块。本阶段**只完成产品与模拟数据施工，未接入真实资讯抓取**。

新增文件：
- h5/data/news.js（资讯数据唯一权威源，window.MCU_NEWS，15 条模拟数据）
- h5/news.html（资讯列表页，首批 10 条 + 加载更多）
- h5/news-detail.html（资讯详情页，10 个信息块）
- h5/assets/css/v2n-news.css（v2n- 前缀，零新增 Token）
- workspace/news/test-news-rules.cjs（规则与数据断言，78 断言）
- workspace/news/regression-news.cjs（全站回归 + 页面实测，55 断言）

修改文件：
- h5/index.html（引入 v2n-news.css 与 data/news.js；新增「最新漫威资讯」Section，位于社区入口之后）
- h5/assets/js/components.js（MCU.v2 内新增资讯组件与规则函数：statusBadge / sortNews /
  newsCard / newsDetail / sourceItem / relatedNode / calcIndependentGroupCount 等）

核心规则：
- verification_status 严格实现 8 态（official_confirmed / multi_source_reported / single_source /
  rumor / unverified / conflicting / officially_denied / corrected），未新增状态
- independent_group_count 为派生字段，按 owner_group 去重运行时计算，禁止手写；
  「待核 / unknown」不计入独立证据组
- 同 owner_group 多家媒体只计 1 个独立证据（如 Variety / Deadline / THR 同属
  Penske Media Corporation → 计 1）
- 官方确认须通过官方来源登记表校验（host + path + 内容对应 + 人工复核）
- 排序按 R5.2 五步（过滤 → 置顶有效性 → 分层 → 置顶组内 → 并列打破）；
  官方确认不自动置顶
- 关联只引用 MCU_CONTENT / MCU_CHARACTERS 既有 id，未命中一律丢弃；
  角色跳 map.html?focus=，阶段本期只展示不可点击

验收：
- 本地 file:// 可运行；无新增运行时依赖、无后端、无第二套数据源
- 规则与数据断言 78 PASS / 0 FAIL
- 全站回归 55 PASS / 0 FAIL（7 个既有页面无新增 JS 异常；MCU_CONTENT 59 /
  MCU_RELATIONS 92 / MCU_ROUTES 11 / MCU_CHARACTERS 24 计数未变；v2.css 零改动、无 CSS 污染）

状态：**未部署**。待项目负责人确认（① 状态标签文案定稿 ② 人工视觉验收）后进入真实资讯接入阶段。

交付文档：docs/产品/资讯模块/ 下《V2.2 施工报告》《V2.2 施工方案》《V2.2 施工规范 R6-R8》《V2.1 规范 R1-R5》

---

## V2.3（抖音小程序 · 代码冻结提审中）

版本：
V2.3（宇宙节点信息页）

状态：
**验收通过、代码冻结、提审中**（2026-09-22）

适用端：
抖音小程序（AppID tt00eb76569e914af801）；服务类目不变（工具-实用工具-信息查询）

背景：
V2.0.0 驳回（驳回点=作品详情页仍具明显「影视/文娱作品详情」特征）→ 产品指令结构性整改（非文案替换规避）

本轮内容（git `36e9441`）：
- 作品详情页 → **MCU 宇宙节点信息页**：结构性删除海报、英文片名、内容类型标签、观看状态、标记已看、收藏、上映日期
- 字段：上映顺序第X部 → **宇宙序号 X**；保留 时间节点（XX年）/ MCU 阶段
- 相关作品 → **关联节点**（节点名+所属阶段，节点互跳 redirectTo）
- 新增底部「进入宇宙导航」（switchTab 现有 journey 路线页）
- movie.json 导航标题→宇宙节点；about 版本号 V1.3.0→V2.3；h5-guide 文案宇宙化
- 数据层 mcuData/userState 未动（my-mcu 仍用）；H5/微信零改动

验收：
- 静态断言：渲染层/代码层零影视残留 16/16 + 绑定变量 13/13 + 数据校验（59 节点/92 关系零无效指向）+ 入口 6 处兼容
- 审核前验收报告【可以提审】（`design/小程序/抖音/V2.3整改/`，6 张结构还原截图）
- 提审前置：后台隐私保护指引补正（剪贴板+相册勾选、删昵称头像项，09-22 已由彦祖完成）

审核结果路由：
- 通过 → 记录闭环
- 驳回且仍判「文娱→文娱→资讯」→ 不改代码，同步策划 → 第二阶段全局文娱内容信号分析（journey/library/about/synopsis/reason/角色 note/海报文本组合/数据密度）

---

## V2.4（抖音小程序 · 引流清除整改 · 待提审）

版本：
V2.4（第三方引流清除）

状态：
**整改完成、待提审**（2026-09-23；本地 commit `7b43ddd`，待代理恢复推送远端）

背景：
V2.3 驳回——驳回点「小程序页面内容不得存在第三方引流行为」（小程序运营规则：第三方引流；审核截图指向首页 H5 引导入口）

本轮内容（git `7b43ddd`，18 文件 +80/-223）：
- **删除** `components/h5-guide` 组件（4 文件）与 `models/h5Link.js`（H5_URL + 复制逻辑）
- home：删「宇宙关系 → 前往 H5」入口卡、goH5、h5Guide 数据、组件注册
- journey：删 allDone「分享你的成就」按钮（实为复制 H5 链接）+ h5-guide 卡 + goH5
- movie / my-mcu：删 h5-guide 卡与组件注册
- journey.wxss 清理 ad-share 死样式；about 版本 V2.3 → V2.4 / 09-23
- 全端零外部链接：抖音包内不再含 mcuatlas.xyz 或任何 H5 出口

自检（workspace/verify-v24.cjs）：
- 全目录零引流残留（12 特征 × 全部源码行，注释剔除后判定）
- 10 页 json/js 无悬空引用（组件注册与 require 全清）
- V2.3 功能全保持：宇宙节点卡/关联节点/进入宇宙导航/节点互跳/入口 6 处兼容
- H5 端与微信端零改动

---

## V2.3（抖音小程序 · 已驳回存档）

版本：
V2.3（宇宙节点信息页）

状态：
**驳回**（2026-09-22 提审；驳回点=第三方引流，非宇宙节点页本身问题）

说明：
宇宙节点信息页整改内容全部保留在 V2.4 中继续有效；驳回点为 H5 引导引流元素，
已由 V2.4 清除。详见 V2.4 条目。

---

## PC-V3.1（H5 · PC 观影宇宙地图 · 当前线上）

版本：
PC-V3.1

状态：
**已上线**（2026-09-18）

适用端：
H5 · PC 端观影宇宙地图（h5/map-pc.html，仅此文件；移动端/小程序未触及）

本轮内容：
- 聚焦交互修复：进入探索按中心节点半径自适应放大（期望屏幕半径 58px，clamp 1~3.5x，只放大不缩小）；中心节点保持全景原位、视口飞行跟随（保留全局空间感）；环绕半径按目标缩放换算，关联>8 自动扩环
- 信息避让优化（设计 AI 方案落地）：节点信息安全区=海报圆+名称/年份文字窄条（双形状，文字宽度运行时实测）；关系标签脱离固定锚点，沿线 t×法线网格贪心避让，多标签自动分散；兜底为环外极坐标搜索（θ±30°、1.4R~2.0R）
- 探索模式点击空白直接退出全景（mousedown 记录按下点，位移>6px 判拖拽不误触）；探索模式开放滚轮与 +/− 缩放（原仅全景）
- 关联节点标签随方位翻转（上方节点标签置顶）、退出重置（设计 AI 方案既有项，本轮回归覆盖）

验收：
- CDP 断言式回归 36/36 PASS（workspace/map-pc-regression.cjs）：全景加载/单节点探索×3/多关系 8 关联/A→B→C 连续探索/空白退出/双模式滚轮缩放/拖拽防误触/1440×900+1920×1080
- 核心断言：标签不压节点文字（海报/名称/年份）、标签互不重叠、无残留、无 JS 异常

---

## V2.0.0（抖音小程序 · 提审中）

版本：
V2.0.0（轻量内容版）

状态：
**提审中**（2026-09-16）

适用端：
抖音小程序（AppID tt00eb76569e914af801）

服务类目：
工具-实用工具-信息查询

形态：
10 页 / 4 Tab（首页 / 路线 / 作品 / 我的MCU）

定位：
MCU 观看决策工具（导航/查询/进度记录），深度内容一律外跳 H5（https://mcuatlas.xyz/）

本次内容（轻量内容版重构）：
- 新增：journey 观看路线页（上映顺序/主线必看双路线，含短片）、h5-guide H5 引导组件（models/h5Link.js 为唯一链接来源）
- 降级：library→作品索引（仅搜索+状态筛选）、movie→作品节点页（删简介/所属篇章/篇幅/故事时间/backdrop/rel-why，海报缩至 100×142rpx 识别用）
- Home 重构 5 层（进度 Hero→核心入口 2×2→下一步→最近标记→H5 引导）；My MCU 收敛（删冗余 tab-row）
- 真机 BUG 修复：h5-guide 复制链接 fail（showModal 回调内剪贴板调用被真机丢弃）→ 点击直接复制 + fail 透出 errMsg，三处收敛 h5Link
- 数据：douyin/data/relations.js 与权威源同步纠偏（三端 sha256 一致）

验收记录：
- dev 侧静态断言 18 项全过（页面渲染 5/组件交互 4/跳转链路 6/数据一致性 3）
- 真机验收通过（2026-09-16，复制 BUG 修复后复测 OK）
- 域名前置：mcuatlas.xyz 已部署生效（严格 TLS / 页面 200 / API 200·401 实测）

备注：
旧 explore/panorama/characters/character/routes/route-detail 维持永久删除禁恢复；
UI 渲染层合规扫描通过（无简介/演职员/评分/票房/资讯/评论/角色/多图海报墙）；
V1.3.0 线上版本的 CDN 域 mcu.yaokaixin.top 不受影响。
复制链接问题（2026-09-16，**已关闭**）：真机曾现场景性 fail——抖音剪贴板属隐私接口
（104179=隐私协议未声明 / 104180·190=未授权）。处置三件套：
控制台「隐私保护指引」补剪贴板声明（对提审中/线上包即时生效）
+ h5Link.js 按官方错误码加固入库（c881b46：错误映射+openSetting 授权引导）
+ 真机复测确认无问题（09-16 用户确认）。

---

## V1.2.1（微信小程序 · 当前线上）

版本：
V1.2.1

状态：
**已通过审核并正式上线**（2026-09-10）

适用端：
微信小程序（AppID wx78f00e7f0a5948b7）

本次内容：
- 审核反馈修复（删除联系方式字段、按钮居中）
- 视觉资源 CDN 迁移：visuals.js 由已清空的 CloudBase 默认域名迁至 https://mcu.yaoqiang.xin
- 补齐 avatars / phases / hero / entries 资源，修复海报缺失

驳回与申诉记录：
- 曾因「涉及视频服务，属个人主体未开放类目」被驳回
- 申诉说明：小程序无播放器、无视频资源、无外部视频跳转
  （代码中不存在 web-view / navigateToMiniProgram / 任何视频链接）
- 结果：判定为误判，审核通过

备注：
后续若再遇同类驳回，优先检查视觉是否过度强化流媒体观感
（深色海报墙 + 大号「观看」CTA 是审核敏感点）。

---

## V1.3.0（抖音小程序 · 当前线上）

版本：
V1.3.0

状态：
**已通过审核并正式上线**

适用端：
抖音小程序（AppID tt00eb76569e914af801）

服务类目：
工具-实用工具-信息查询

形态：
9 页 / 3 Tab（首页 / 作品 / 我的MCU），轻量工具版
永久删除页面：explore / panorama / characters / character / routes / route-detail

备注：
该形态是两次驳回后工具化收敛的结果，禁止恢复已删页面。

---

## V1.2.0（微信基线）

版本：
V1.2.0

状态：
微信首个正式提交版本

日期：
2026-08-27

Git Tag：
v1.2.0-release

主要功能：

- MCU电影观看顺序
- Phase阶段导航
- 电影详情
- 角色图鉴
- 关系探索
- 我的MCU
- 分享海报

备注：

该版本作为后续微信小程序和抖音小程序迁移基准版本。

---

## H5 V3.0 / V2.2 / V2.1 / V2.0（H5 端）

> H5 为纯静态多页（`h5/` 部署于阿里云轻量 Nginx，域名 https://mcuatlas.xyz）。
> H5 版本号独立于微信/抖音小程序，按大版本 V2.0 → V2.1 → V2.2 → V3.0 演进；以下均以「已上线/已部署」功能为准。

### H5 V3.0（论坛 · 当前线上）

状态：**已上线（H5 线闭环，2026-09-16 第二轮真机复验通过）**
适用端：H5（https://mcuatlas.xyz）；论坛 4 页：community / topic-detail / post-create / my-community

本次内容：
- 论坛 4 核心页 + `forum.js` + `v3-forum.css`（`v3f-` 前缀隔离）；先审后发、token 身份复用（H5 匿名身份体系）、点赞/举报/我的社区
- 论坛后端（阿里云同机 8787）：Node 24 + SQLite(WAL)，systemd 守护；Nginx `^~ /api/` 反代（mcuatlas vhost，限流 zone=forum_api_atlas）；管理页 `/api/admin/`（token 用户持有）；备份 cron 14 份
- 首页社区入口 9-B：金边入口卡 + 最新话题预览 2 条（git `69736bc`）
- UI 修复 5 大项（紧凑 Hero 92-99px / 双入口卡 Grid / 话题卡 Flex+2 行截断+缩略图 / 详情紧凑化 / 输入栏 fixed+safe-area+防遮挡）+ 响应式三档 ≤375 / 376-390 / ≥411（git `1d413e7`）
- 部署：mcuatlas.xyz 双域同源（2026-09-16 服务器部署生效，公网复验全过）

验收记录：
- 后端 e2e 60/60；H5 UI 断言 **111/111**（`workspace/forum-e2e.cjs`，Chrome headless + CDP，fetch 桩仅测试注入、产品零 mock）
- 真机验收两轮通过（09-15 首轮；09-16 12:37 UI 修复后复验，用户确认）
- ⑮ V2.2 回归 **35/35 全过**（2026-09-16，`workspace/v22-regression.cjs`：index/routes/movie/next/map/route-detail 零 JS 异常、零横向溢出、收口禁令合规、PC 方案 C 断点抽查通过）

备注：
- 论坛完整版未完：⑫ 微信只读（**暂无规划，有规划再启动**，前置=产品方案）→ ⑬ 抖音只读 → ⑭ 联调 未启动
- H5 版本号沿用项目内「论坛 V3.0」口径

### H5 V2.2

状态：已部署上线（2026-09-14 提交 `fa2dc2c` 后全量部署）
适用端：H5（https://mcuatlas.xyz）

本次内容：
- 路线详情页 `route-detail.html` 上线：六大模块（路线说明 / 作品串联 / 下一部 / 关系 / 阶段 / 吐槽上下文归到当前路线）
- 首页 PC 版式「方案 C」：`v2.css` 末尾 `@media ≥1024px` 块——容器 1280px、Hero 42px、资料库 5 列、未来计划双列、我的MCU 双列（ID 限定，移动端不变）；**已实现并部署，2026-09-16 线上实测命中**（此前"待策划授权"状态已由用户拍板解除）
- 三端 `visuals.js` CDN 由 `mcu.yaoqiang.xin` 迁至 `mcu.yaokaixin.top`（shared / wechat / douyin 同源）
- 2026-09-16：H5 生产域名切换为专属域名 `https://mcuatlas.xyz`；三端 `visuals.js` CDN **保持** `https://mcu.yaokaixin.top`（旧域保留作小程序图片 CDN，避免重发小程序）
- 反馈/统计代码已落地；CloudBase WEB 安全域名**已加 `mcuatlas.xyz`**（2026-09-16），落库恢复待浏览器验证（本地队列兜底仍在）

备注：
- 社区静态入口已被 V3.0 真实论坛替代（本条目为历史记录，V2.2 期间社区仍为 V2.1 静态 4 卡 + toast 筹备中）。

### H5 V2.1

状态：已上线
适用端：H5

本次内容：
- 我的MCU 进度（已看 8 部 / 5 成就，本地存储 key `mcu_nav_user_v1`）
- 未来上映关注（`upcoming.js` + 关注切换，首页「漫威未来计划」4 部）
- 社区话题卡（`community.js` 静态 4 话题 + 点击 toast 筹备中；真实论坛延至 V3.0）
- 首页精修验收收口
- H5 → 微信/抖音小程序引导双按钮 + 里程碑「保存到小程序」

### H5 V2.0

状态：已上线（V2 基线）
适用端：H5

本次内容：
- 首页单页内容流 6 模块：Hero / 路线 / 未来计划 / 资料库 / 我的MCU / 社区+小程序入口
- V2 组件层（`components.js` → `window.MCU.v2`）
- 资料库类型筛选：电影 / 剧集 / 特别呈现 / 短片 / 全部
- 移动优先适配

---

## 版本与维护说明

- 数据层（`shared/data/*.js`）为跨端唯一可信源，版本号不由数据变更驱动。
- 每次修改须落 Git 提交，并同步 VERSION.md / MCU项目总览.md / README.md。
- 跨角色协作通过 `docs/同步/` 同步文件与项目记忆完成。
