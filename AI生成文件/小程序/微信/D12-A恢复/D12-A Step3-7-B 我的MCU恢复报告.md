# D12-A Step3-7-B 我的MCU页面恢复报告

> 生成时间：2026-08-21 15:34
> 执行方：开发/设计 AI（WorkBuddy，双岗合并，向策划 AI 汇报）
> 依据：D10-A 冻结稿 Token 体系 + routes/movie 页视觉语言；本指令 §一–§七

## 1. 修改文件

| 文件 | 变更 |
|---|---|
| `mcu-miniprogram/pages/my-mcu/my-mcu.js` | 占位（Step3-1 空壳）→ 四区块装配逻辑（顶部进度 / 当前路线卡 / 已看列表 / 收藏区域） |
| `mcu-miniprogram/pages/my-mcu/my-mcu.wxml` | 占位 → 四区块模板（wxml 零内联 svg，全 Token 类） |
| `mcu-miniprogram/pages/my-mcu/my-mcu.wxss` | 空 → 全 Token 化样式（深色 bg / 金色 gold / 卡片 surface / 进度条 / 阶段色兜底） |
| `mcu-miniprogram/pages/my-mcu/my-mcu.json` | 不变（navigationBarTitleText「我的MCU」已就位） |

- 数据层零改动：`mcuData` / `userState` 既有接口复用，未新增第二套数据、未手写观看记录、未引入账号体系。

## 2. 数据来源（单一可信源，禁第二套）

- **总作品数量**：`mcuData.all.length`（CONTENT 59 条全量）—— 对应指令示例「已探索 12 / 59」。
- **已观看数量 / 已看列表**：`userState.count()` + `userState.getState().watched`（id→时间戳）→ `mcuData.get(id)` 映射为卡片（id / cn / letter / en / phase / type / typeLabel）。
- **当前路线**：`userState.getCurrentRoute()` → `getSavedRoute()` → `routeById()`；无则默认 `newcomer`（与 routes 页同口径）。进度 = `expandRoute` 已看数 / 总数；下一部 = 展开后首个未看内容。
- **收藏区域**：`userState.favIds()` → `mcuData.get(id)`；有则展示，无则保留入口（占位提示，不新增复杂逻辑）。
- **阶段色 / 主显示名**：`mcuData.phaseColor(phase)` + `cn`（与 movie 页一致，主显示名用 `cn`）。

## 3. 页面截图

当前环境无 GUI 微信开发者工具，无法补拍真机/模拟器截图（与 Step3-4/3-5/3-6/3-7-A 一致，列为待补项）。

页面视觉严格按 D10-A 冻结稿 Token 体系移植（px×2=rpx，零 raw hex），四区块结构如下（文字描述）：

- **顶部状态区**：`我的MCU` 标签 + 巨大金色 `已探索数 / 59` + 金色进度条 + 「整体进度 X% · 已看 N 部」。
- **当前路线卡**：金边卡片，含「继续你的路线」金色 label + 路线名（金/主文本）+ 「X / Y 部 · 下一部 片名」+ 金按钮「继续观看」（全看完置灰）。
- **已观看列表**：每片一行卡片（阶段色字母方块 + 片名 + 英文名·阶段·类型 + 灰色「已看」徽标），按观看时间倒序。
- **我的收藏**：同结构卡片 + 金色「★」徽标；无收藏时显示占位提示。

**预览路径**：微信开发者工具导入 `mcu-miniprogram` → 切到「我的MCU」Tab（最右）→ 在电影详情页标记观看/收藏后，本页经 `onShow` 实时刷新。

## 4. 状态测试（冒烟 26/26 全通过）

| 用例 | 验证点 | 结果 |
|---|---|---|
| 1 新用户空态 | 已探索=0 / 总=59 / 进度=0% / 已看空 / 无收藏 / 当前路线默认 newcomer(total=12) | ✓ |
| 2 标记3部看过 | 已探索=3 / 进度=5% / 列表=3 / 倒序(最近=thor) / cn 非空 / 阶段色 letter 齐全 | ✓ |
| 3 当前路线同步 | 当前路线 watched=3 / percent=25% / 下一部存在 | ✓ |
| 4 收藏区域 | 有收藏 hasFav / 数=1 / 项=黑豹 | ✓ |
| 5 点击电影跳转 | `goMovie` → `/pages/movie/movie?id=avengers` | ✓ |
| 6 当前路线跳转 | `goRoute` → `/pages/route-detail/route-detail?id=newcomer` | ✓ |
| 7 返回刷新 | 再标记2部 → onShow 重装配 已探索=5 / 列表=5 | ✓ |
| 8 数据一致性 | 已看列表 ids == `userState.seenIds()`；抽查≥5部 id 均能在 CONTENT 取到且 cn 非空 | ✓ |

> 注：用例2「倒序」在测试中以可控时钟（每次操作时间戳 +1000ms）精确验证；真机环境每次操作天然有时间间隔，倒序成立。

全工程 JS 语法校验（27 文件）无回归。

## 5. 问题记录 / 待策划复核

- **总作品数口径**：指令示例「12 / 59」的 59 取自 CONTENT 全量（电影/剧集/特别呈现/短片），已按 `mcuData.all.length` 渲染。若需改为「仅电影数」(`counts().movie`) 请告知。
- **当前路线口径**：与 routes / route-detail 页统一，默认 `newcomer`，优先取 `userState` 保存的当前路线（Step3-7-A 同款「第一个未看节点」派生，未用 `savedRoute.currentIndex` 持久化）。待 Step3-7-A 决策一并确认。
- **收藏入口**：当前仅展示 + 占位，未做「取消收藏」等写入操作（指令 §4「保留入口，不新增复杂逻辑」）。如需在个人中心支持取消收藏请指示。
- **真机截图**：环境无 GUI 开发者工具，待补（与历史步骤一致）。
- **越界声明**：全程仅实现 my-mcu 页（js/wxml/wxss），复用 models，未开发其他页面、未改数据、未接资源、未新增账号体系，符合 D12-A「恢复优先」边界。

## 6. 下一步建议

- 进入 **Step3-7 探索 / 全景 / browse**（剩余 3 页，探索与全景复用 PANO 数据）。
- 第五步 RELATIONS 92/93 差异定性（待全部页面完成）。
- D10-B 反馈与纠错：Step3-8 接入入口与提交结构。
- 「同步上去」A 方案（CloudBase 静态托管备份源码 + 发布指南）待代码全部完成执行。
