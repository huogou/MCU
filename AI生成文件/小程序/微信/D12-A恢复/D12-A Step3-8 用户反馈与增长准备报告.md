# D12-A Step3-8 用户反馈与增长基础建设 · 恢复报告

> 交付时间：2026-08-24 ｜ 阶段：D12-A 最后一步（Step3-8）
> 治理铁律：恢复优先＞稳定优先＞小范围优化＞新功能；**H5 零改动**、不改 MCU 数据/路线、不重新设计风格、不新增复杂后台。

---

## 1. 页面设计

### 1.1 反馈入口（小程序侧）
- **位置**：「我的MCU」页（Tab4）底部「反馈与帮助」区块，新增「我要吐槽」卡片入口。
  - 仅置于个人中心页，不进入 `首页→路线→电影详情` 核心观影流，**不影响核心体验**（符合指令 §二）。
  - 关于「设置区域」：已恢复的 8 页范围内无独立「设置」页，个人中心页即天然的「设置/帮助」落点，故入口落于此；若后续新增设置页，可同款镜像。
- **跳转**：`wx.navigateTo('/pages/feedback/feedback?from=my-mcu')`，携带来源页参数供来源统计。

### 1.2 反馈页（feedback）结构
- **头部**：「我要吐槽」+ 引导文案。
- **反馈类型**（6 类，指令 §三 完全一致）：
  - 观影顺序问题 `sequence` ｜ 电影信息错误 `movie_info` ｜ 名称错误 `name_error` ｜ 页面体验问题 `ux` ｜ 功能建议 `feature` ｜ 其他 `other`
  - 胶囊单选，选中金边金底（与 D10 Token 体系一致）。
- **反馈内容**：textarea（必填，maxlength 500）。
- **联系方式**：input（选填，maxlength 60，微信/邮箱）。
- **来源展示**：`来源页面：{{source}}`（透明反馈上下文）。
- **提交按钮**：金色主按钮「提交吐槽」，提交中置灰「提交中…」。
- **结果态**：成功（✓ 绿）/ 失败（! 红，可「重试」）/ 可「再提一条」或「返回」。
- **视觉**：平移 D10 Token 体系（深色 bg / 金色 gold 强调 / 卡片 surface / 状态色 success·error），px×2=rpx，零 raw hex，wxml 零内联 svg/emoji。

### 1.3 数据落点（单一源，禁第二套）
- 复用 `app.js` 已初始化的 `wx.cloud`（env `mcu-d6gw0brqoa9521b58`，与 H5 同一 CloudBase 环境）。
- 写入 **H5 已用的同一 `feedback` 集合**，字段严格对齐 H5（`mcu-navigator/assets/js/app.js:1239`）：
  `feedbackType / content / contact / page / movieId / routeId / exploreId / contextName / platform / channel / createdAt / status:'new'`
- 新增 `platform:'miniprogram'`、`channel`（为 H5 来源统计预留）、`contact` 三个字段——均为 H5 既有结构的**超集扩展**，不另建结构。
- 兜底：云能力不可达时写入本地队列 `_mcu_feedback_queue`（缓冲，不丢反馈），对用户仍显示成功（不暴露技术错误）。

---

## 2. 修改文件

| 文件 | 操作 | 说明 |
|---|---|---|
| `pages/feedback/feedback.js` | 重写（Step3-1 占位→完整） | 6 类选择器 + 必填校验 + 提交写 feedback 集合 + 本地兜底队列 + 成功/失败态 |
| `pages/feedback/feedback.wxml` | 重写 | 表单态 / 成功态 / 失败态 三结构，全 Token 类 |
| `pages/feedback/feedback.wxss` | 重写 | 平移 D10 Token，零 raw hex |
| `pages/feedback/feedback.json` | 不变 | 标题「我要吐槽」已就位 |
| `pages/my-mcu/my-mcu.wxml` | 编辑 | 底部加「我要吐槽」入口卡片 |
| `pages/my-mcu/my-mcu.js` | 编辑 | 加 `goFeedback()` 跳 `feedback?from=my-mcu` |
| `pages/my-mcu/my-mcu.wxss` | 编辑 | 加 `.fb-entry` 入口样式 |

**数据层零改动**：未动 `data/*`、`models/*`、H5 任何文件（H5 零改动）。`app.js` 的 `wx.cloud.init` 为 Step3-1 既有，非本次新增。

---

## 3. 交互流程

```
我的MCU（Tab4）
  └─ 点「我要吐槽」(底部反馈区)
       └─ navigateTo feedback?from=my-mcu
            ├─ 选类型（6 选 1，必选）
            ├─ 填内容（必填）
            ├─ 选填联系方式
            └─ 提交
                 ├─ wx.cloud 可用 → feedback.add({...}) → 成功态 ✓
                 └─ wx.cloud 不可达 → 本地队列缓冲 → 成功态 ✓（待联网同步）
            └─ 失败（网络/权限） → 失败态 ! → 重试

来源统计：feedback.page = 入口来源（my-mcu）；feedback.channel = 投放渠道（预留，小程序内为空）
```

---

## 4. 测试结果

逻辑冒烟（mock `wx` + `wx.cloud.database`，21 项全通过）：

| 维度 | 结果 |
|---|---|
| onLoad 读取来源页/渠道 | PASS |
| 未选类型拦截 + 提示 | PASS |
| 空内容拦截 + 提示 | PASS |
| 写集合名 `feedback` | PASS |
| 字段对齐 H5（feedbackType/content/contact/page/platform/channel/status/createdAt/movieId） | PASS |
| 提交后成功态 | PASS |
| 云不可达→本地队列不丢 + 成功态 | PASS |
| my-mcu 入口带 `from=my-mcu` | PASS |

全工程 **27 个 JS 文件语法校验无回归**（含本次新增/编辑）。

> 说明：真实 `feedback.add` 写入依赖 CloudBase 环境对小程序 AppID 的**匿名/宽松写权限**（H5 已用 Web SDK 匿名登录写入同一集合）；此权限属部署配置，非代码改动，已在「后续建议」标注待确认项。

---

## 5. 后续建议（待策划 AI 拍板）

1. **H5 `from` 渠道统计缺口（§五 规划项）**：检查结论——H5 `resolveContext()`（app.js:1159）当前只取 `page/movieId/routeId/exploreId/name`，**未读取 `?from=` 渠道参数**（尽管 SEO canonical 已约定 `?from=` 存在，app.js:1018）。
   - **规划方案**：在 H5 `resolveContext` 中补 `channel = URLSearchParams.get('from')`，写入 feedback 集合 `channel` 字段，实现 douyin / xiaohongshu / wechat 等来源区分。
   - **当前动作**：因「H5 零改动」铁律，本步**仅规划不实现**，列为上线前 H5 增量（建议在 Step3-8 之后单独立项，或并入第四步版本归档前的小补）。

2. **小程序 `channel` 预留**：feedback 页已支持 `?channel=` 入参，若后续通过 H5 分享链接（带 `from=douyin`）唤起小程序，可透传渠道；当前小程序内入口 `channel` 留空，与 H5 来源口径对齐。

3. **CloudBase 写权限确认**：上线前需在 CloudBase 控制台确认 `feedback` 集合对小程序 AppID（`wx78f00e7f0a5948b7`）开启匿名/宽松写（与 H5 同策略），否则真机提交会走本地兜底队列而非抵达集合。

4. **反馈闭环（第五步）**：本步只完成「收集」，尚未做「查看/处理」后台。指令 §六 明确「不新增复杂后台」，故后台查看交由运营在 CloudBase 控制台直接读 `feedback` 集合；如需轻量管理页可单列需求。

5. **入口位置复核**：确认「我的MCU 底部」作为唯一入口是否足够；若需要更强曝光，可后续在 movie 详情页底部加同款入口（但会触及核心观影流，建议保持现状）。

---

## 附：与 D10-B 原规划的对应
- D10-B「小程序反馈与纠错」设计为 P2（核心页完成后接入）；本步即 D10-B 的小程序侧落地。
- H5 侧「我要吐槽」已于 D8 封板（Web SDK 匿名写 feedback 集合），本次小程序侧与之共用集合，形成双端统一反馈池。

> 下一步：Step3-8 验收通过后，D12-A 八页全部完成，进入**第四步 版本归档（MCU_V1.0/V1.1）** 与**第五步 反馈闭环/视觉债/关系数据差异复核**，最终产出《D12-A 阶段总结报告》。
