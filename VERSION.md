# MCU小程序版本记录

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
- 论坛完整版未完：⑫ 微信只读（等产品方案）→ ⑬ 抖音只读 → ⑭ 联调 未启动
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
