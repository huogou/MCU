# MCU小程序版本记录

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
- 跨 AI 协作通过根目录三份同步文件与 `.workbuddy/memory/` 长期记忆完成。
