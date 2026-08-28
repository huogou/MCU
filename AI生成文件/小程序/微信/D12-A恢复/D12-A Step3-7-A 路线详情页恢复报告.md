# MCU观影导航｜D12-A Step3-7-A 路线详情页恢复报告

> 生成时间：2026-08-21  
> 维护方：开发/设计 AI（WorkBuddy，已合并双岗，只向策划 AI 汇报）  
> 接收方：策划 AI（deepseek）  
> 状态：**待策划 AI 验收**

---

## 一、修改文件

| 文件 | 变更 |
|---|---|
| `mcu-miniprogram/pages/route-detail/route-detail.js` | 占位 → 顶部信息装配 + 电影列表三态 + 当前观看节点 + 下一部推荐逻辑 |
| `mcu-miniprogram/pages/route-detail/route-detail.wxml` | 占位 → 顶部区 / 下一部卡 / 路线列表三态（wxml 零内联 svg） |
| `mcu-miniprogram/pages/route-detail/route-detail.wxss` | 空 → 全 Token 化样式 + 纯 CSS 图标（ico-check 勾） |
| `mcu-miniprogram/pages/route-detail/route-detail.json` | `navigationBarTitleText`「路线详情」（页面内 `wx.setNavigationBarTitle` 动态覆盖为路线名） |
| 数据层 | **零改动**，复用 `mcuData.expandRoute` / `userState` 既有接口 |

---

## 二、数据来源（单一源，禁第二套）

- **路线元信息**：`routes.js`（唯一可信源，11 条）。`route-detail` 仅读 `routeById(id)`，不重定义。
- **节点列表**：`mcuData.expandRoute(route)` —— 手写 `items` 路线按数组顺序；`generator` 路线（release/chrono/essential/mainline）按规则自动展开。
- **节点字段**：`CONTENT` → `title / en / phase / type / importance`，经 `expandRoute` 透出，页面不另存。
- **状态**：`userState.watchState(id)`（未观看/正在观看/已观看）+ `userState.isSeen(id)`（进度计数）。
- **当前路线**：`userState.getCurrentRoute()` → `getSavedRoute(savedId).routeId`。
- **当前观看节点**：第一个未看节点（1-based）为「当前位置」，全部看完则为 `total`。
- 全程未引入任何第二套数据，未修改 `routes.js` 顺序。

---

## 三、页面结构（五区块，对应指令 §1–§5）

1. **顶部区域**：类型标签（基础/专题）+ 路线名称 + golden tagline + `desc` 简介 + 进度摘要「`X` / `Y` 部」+ 金色进度条。
2. **电影列表**：按 `routes.js` 顺序逐节点展示 —— 编号圆点、片名、英文名、阶段色点 + 阶段文字 + 类型、右侧状态三态色块（未观看金 / 正在观看绿 / 已观看灰，与 movie 页一致）。
3. **当前观看节点**：第一个未看节点金色高亮（圆点金 + 卡片金边 + 标题金）；仅当本路线是用户 `saved current_route` 时显示「当前看到 · 第 N / Y 部」金色横幅（指令 §4 门槛）。
4. **下一部推荐**：第一个未看节点 → `movie?id=`；全部看完显示「已看完」并禁用跳转。
5. **状态联动**：点击任意节点跳 `movie?id=`；在 movie 页标记后返回本页，`onShow` 重新读取 `userState`，进度/当前节点/下一部自动刷新（无需额外代码）。

> 视觉基准：D10-A 冻结稿 Token 体系（深色 bg + 金色 gold + 卡片 surface + 状态三态色）。D10-A 原型无独立 route-detail 整页设计（仅 line 1259「路线详情入口」CSS 注释），本页据已确立 Token 体系 + routes/movie 页相邻视觉语言恢复，px×2=rpx，零 raw hex 泄漏。

---

## 四、状态测试（指令 §8 全覆盖，冒烟 40/40 通过）

| 校验项 | 结果 |
|---|---|
| ① 11 条路线均可进入 | ✅ 全部 `notFound=false`，节点数 = `expandRoute` 长度（newcomer12 / release59 / chrono59 / essential22 / recommended28 / spiderman9 / avengers-line11 / ironman-line9 / captain-line8 / multiverse-line8 / infinity-stones8） |
| ② 电影顺序正确 | ✅ 7 条手写 items 路线节点 id 与 `routes.js` 逐一比对一致 |
| ③ 状态同步 | ✅ 标记 iron-man 已看 → `watched`+1、首节点状态变「已观看」 |
| ④ 下一部跳转 | ✅ 未看时 `nextId`=首未看节点；标记首部后 `nextId`=第二部 |
| ⑤ 返回刷新 | ✅ movie 页标记后 `onShow` 自动 +1；全部看完 `hasNext=false` / `nextName=已看完` / `watched=12` |
| 附加：当前路线高亮 | ✅ `saveRoute('newcomer')` → `isCurrent=true` + 横幅非空 + 当前节点金标记；非当前路线 `isCurrent=false` |

附：全工程 27 个 JS 文件 `node --check` 全部通过，无编译阻断回归。

---

## 五、问题记录 / 待策划 AI 复核

1. **当前观看节点口径**（指令 §4）：以「第一个未看节点」为当前位置（数据驱动、确定性强），并对当前路线额外显示金色横幅；全部看完时 `currentNo=total`（即「第 Y / Y 部」）。若需改用 `savedRoute.currentIndex` 持久化位置（在标记时写回），请告知——当前实现为纯派生、只读，不写 `currentIndex`。
2. **简介文本**：取 `routes.js` 的 `desc` 长文本（部分路线 `desc` 较长），已用卡片 + 行高 1.7 排版，未裁剪。
3. **路线数量**：以 `routes.js`（11 条）为准，与 Step3-6 一致。
4. **真机截图**：当前环境无 GUI 开发者工具，无法补拍；视觉严格按 D10-A CSS 移植（px×2=rpx、全 Token），可于微信开发者工具直接预览。

---

## 下一步

- 待验收通过后进入 **Step3-7 探索 / 全景 / 我的MCU / browse**（4 页并行轻量开发）。
- 第五步 RELATIONS 92/93 差异定性；D10-B 反馈 Step3-8；「同步上去」A 方案（CloudBase 静态托管备份 + 发布指南）待代码完成执行。
