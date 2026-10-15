# MCU V1.2 P1 全局视觉巡检报告

> 设计 AI：QoderWork CN · 2026-08-26
> 巡检范围：全部 12 个页面（home / movie / character / explore / routes / route-detail / browse / characters / panorama / my-mcu / share / feedback）
> 巡检依据：VDS V2 + app.wxss Token 体系

---

## 一、总体评价

四核心页面（home / movie / character / explore）视觉质量高，已达到 V1.2 设计标准。

其余 8 个页面整体风格统一（暗色主题 + 金色主线 + Token 化），但存在以下系统性问题：

1. **部分页面仍保留非标间距/圆角值**（历史遗留，未完全 Token 化）
2. **角色图鉴页未接入真实头像**（24 张头像已生成但此页仍用首字徽章）
3. **我的 MCU 页海报卡片未接入真实图片**（仍用阶段色+首字兜底）
4. **按钮圆角/高度不完全统一**

整体而言，用户从首页进入任何页面，基本能感受到是同一个 MCU 产品。但角色图鉴和我的 MCU 两个页面在图片视觉上明显落后于其他页面。

---

## 二、P0 必须修（0 项）

无。四核心页面 P0 已全部通过，其余 8 页无阻塞性问题。

---

## 三、P1 建议修

### 3.1 图片视觉权重（最重要）

| # | 页面 | 问题 | 建议 | 影响 |
|---|------|------|------|------|
| P1-01 | characters（角色图鉴） | 24 张真实头像已生成（visuals.avatar），但此页仍用「首字徽章 + 阵营色」，未接入真实头像 | 将 .char-avatar 从首字徽章改为真实头像（88rpx 圆形），缺失走首字兜底 | 高 — 角色图鉴是核心入口页，首字徽章与 character 详情页的 160rpx 真实头像视觉落差大 |
| P1-02 | my-mcu（我的 MCU） | 最近观看 + 观看记录 + 收藏列表的海报卡片均用 `poster-pN` 阶段色+首字，未接入真实海报 | 接入 mcuData.visual(id).poster，缺失走阶段色兜底 | 高 — 我的 MCU 是 Tab 页，用户高频访问，纯文字感强 |
| P1-03 | panorama（宇宙全景图） | 节点卡片只显示首字 + 阶段色，未接入海报缩略图 | 在 node-letter 上方/内部接入海报缩略图（96×144rpx），缺失走首字兜底 | 中 — 全景图是 Canvas 辅助页，但节点视觉可增强 |

### 3.2 间距 Token 化（历史遗留非标值）

以下页面存在未映射到 Token 的间距值（4/6/10/12/14/18rpx 等中间值）：

| # | 页面 | 非标值 | 位置 | 建议映射 |
|---|------|--------|------|----------|
| P1-04 | routes | 4rpx | .phase-strip-inner padding, .rn-title margin-bottom | → --space-xs(8rpx) 或保留（过小值 Token 无法精确表达） |
| P1-05 | routes | 6rpx | .phase-cell gap | → --space-xs(8rpx) |
| P1-06 | characters | 4rpx | .camp-row padding | → --space-xs(8rpx) 或保留 |
| P1-07 | characters | 12rpx | .char-note margin-top, .char-arrow margin-left | → --space-xs(8rpx) |
| P1-08 | characters | 14rpx | .char-meta margin-top | → --space-sm(20rpx) 偏大，建议新增 --space-xxs(4rpx) 或保留 |
| P1-09 | browse | 18rpx | .group-head margin-bottom | → --space-sm(20rpx) |
| P1-10 | browse | 14rpx | .group-dot margin-right | → --space-xs(8rpx) 偏小，建议保留 |
| P1-11 | panorama | 6rpx | .page-sub margin-top, .legend-line height | → --space-xs(8rpx) |
| P1-12 | panorama | 18rpx | .phase-years font-size | → --fs-mini(22rpx) 偏大，建议保留（辅助信息可小于 Mini） |
| P1-13 | panorama | 4rpx | .phase-years margin-top | → 保留（过小值） |
| P1-14 | panorama | 40rpx | .legend gap | → --space-lg(36rpx) |
| P1-15 | panorama | 10rpx | .legend-line margin-right | → --space-xs(8rpx) |
| P1-16 | route-detail | 12rpx | .rd-name/.rd-progress-num/.rd-empty-title margin-bottom | → --space-xs(8rpx) |
| P1-17 | route-detail | 6rpx | .rd-total margin-left, .rd-bar-fill border-radius | → --space-xs(8rpx) / --radius-sm(12rpx) |
| P1-18 | route-detail | 18rpx | .rd-current-banner padding | → --space-sm(20rpx) |
| P1-19 | route-detail | 4rpx / 10rpx | .rd-node-en margin / .rd-node-meta gap | → --space-xs(8rpx) |
| P1-20 | my-mcu | 36rpx | .mcu-hero padding-bottom | → --space-lg(36rpx) ✅ 已匹配 |
| P1-21 | my-mcu | 12rpx | .mcu-progress margin, .rn-progress margin-top | → --space-xs(8rpx) |
| P1-22 | my-mcu | 6rpx | .rn-title margin-bottom, .rn-progress border-radius | → --space-xs(8rpx) / --radius-sm(12rpx) |
| P1-23 | my-mcu | 4rpx | .wc-name margin-bottom | → --space-xs(8rpx) |
| P1-24 | my-mcu | 10rpx | .ach-badge/.recent-poster margin-bottom | → --space-xs(8rpx) |
| P1-25 | feedback | 4rpx | .fb-hero/.fb-source padding/margin | → 保留（微调值） |
| P1-26 | feedback | 10rpx | .fb-hero-tip margin-top | → --space-xs(8rpx) |

**说明**：部分 4rpx/6rpx 值过小，Token 体系最小档 --space-xs=8rpx 无法精确表达。建议策略：
- 4rpx → 保留（微调值，Token 无法覆盖）
- 6rpx → 可映射到 --space-xs(8rpx)，视觉差异 2rpx 不可感知
- 10rpx → 可映射到 --space-xs(8rpx)
- 12rpx → 可映射到 --space-xs(8rpx) 或 --radius-sm(12rpx)（圆角场景）
- 14rpx → 保留或映射到 --space-sm(20rpx)（偏大）
- 18rpx → 可映射到 --space-sm(20rpx)

### 3.3 圆角 Token 化

| # | 页面 | 非标值 | 位置 | 建议映射 |
|---|------|--------|------|----------|
| P1-27 | routes | 4rpx | .rc-progress border-radius, .bar border-radius | → --radius-sm(12rpx) 偏大，建议保留（进度条细圆角） |
| P1-28 | route-detail | 6rpx | .rd-bar/.rd-bar-fill border-radius | → --radius-sm(12rpx) 偏大，建议保留 |
| P1-29 | my-mcu | 6rpx | .mcu-progress/.mcu-progress-bar/.rn-progress/.rn-progress-bar border-radius | → --radius-sm(12rpx) 偏大，建议保留 |
| P1-30 | my-mcu | 4rpx | .rn-progress border-radius | → 保留 |
| P1-31 | my-mcu | 16rpx/14rpx | .entry-badge border-radius（不对称） | → 统一为 --radius-sm(12rpx) |
| P1-32 | share | 24rpx | .poster-stage border-radius | → --radius-xl(32rpx) 或 --radius-lg(20rpx) |

**说明**：进度条圆角（4rpx/6rpx）属于特殊组件，Token 体系 --radius-sm=12rpx 过大。建议保留或新增 --radius-xs=4rpx。

### 3.4 按钮圆角/高度统一

| # | 页面 | 问题 | 建议 |
|---|------|------|------|
| P1-33 | routes/route-detail/my-mcu | .route-next-btn / .rd-next-btn 使用 `border-radius: var(--space-xs)` (8rpx) | → 统一为 `var(--radius-md)` (16rpx) 或 `var(--radius-full)` (999rpx) |
| P1-34 | feedback | .fb-submit 高度 92rpx（其他页面按钮 88rpx） | → 统一为 88rpx |
| P1-35 | feedback | .fb-link 高度 80rpx | → 统一为 88rpx 或作为次要按钮保持差异 |

### 3.5 其他视觉一致性

| # | 页面 | 问题 | 建议 |
|---|------|------|------|
| P1-36 | characters | 阵营筛选 chip 选中态颜色使用 CAMPS 数据中的 hex（内联 style），未走 Token | 技术必要（动态阵营色），但 CAMPS 数据中的 hex 值应与 app.wxss 阵营 Token 一致 |
| P1-37 | panorama | Canvas 连线颜色 rgba 值与 Token 不完全一致（如 'rgba(233,169,59,0.7)' vs --gold #F2B233） | Canvas 层技术必要，但颜色值应与 Token 对齐 |
| P1-38 | panorama | 节点卡片无海报图，仅首字+阶段色 | 见 P1-03 |
| P1-39 | my-mcu | .wc-poster 使用 text-shadow（var(--black-a35)），需确认 Token 存在 | 检查 app.wxss 是否定义 --black-a35 |
| P1-40 | share | .poster-stage border-radius 24rpx 不在 Token 体系中 | → --radius-lg(20rpx) 或 --radius-xl(32rpx) |

---

## 四、P2 可以以后优化

| # | 问题 | 说明 |
|---|------|------|
| P2-01 | 进度条圆角新增 Token | 当前进度条用 4rpx/6rpx 圆角，Token 最小 --radius-sm=12rpx 过大。可新增 --radius-xs=4rpx |
| P2-02 | 过小间距新增 Token | 4rpx/6rpx 间距值无法用 --space-xs(8rpx) 精确表达。可新增 --space-xxs=4rpx |
| P2-03 | characters 阵营 chip 动态色 | 内联 style 使用 CAMPS 数据 hex，可考虑在 app.wxss 新增 .camp-{key} 类 |
| P2-04 | 空状态视觉统一 | 各页空状态样式不统一（movie 用 .movie-empty，route-detail 用 .rd-empty，my-mcu 用 .empty-tip）。可抽取全局 .empty-state 组件 |
| P2-05 | 返回按钮统一 | 部分子页（movie）有自定义返回按钮，其他子页（character/explore/browse/panorama/route-detail/share/feedback）依赖小程序原生导航栏。风格基本一致，无需改动 |

---

## 五、图片视觉专项评估

### 5.1 海报统一比例 ✅
- 竖版海报统一 2:3 比例（96×144rpx / 80×120rpx / 120×180rpx / 220×320rpx），aspectFill 裁切
- 横版剧照统一 16:9 比例，aspectFill 裁切

### 5.2 角色头像统一尺寸 ✅
- character 详情页：160rpx
- home 热门角色：96rpx
- movie 主要角色：80rpx
- explore 关系节点：80rpx（Canvas 内 22px≈44rpx）
- 尺寸差异合理（按模块重要性分级）

### 5.3 背景图是否过度抢主体 ✅
- movie Hero 背景图有渐变罩层（阶段色 rgba + to-bottom 渐变），文字可读
- home Hero Banner 有双层叠加（暗化 + 底部渐变），文字清晰
- entry 卡片有 135deg 暗化叠加，文字可读

### 5.4 图片裁切人物脸部 ️
- aspectFill 模式在极端比例下可能裁切脸部，但当前海报/头像比例匹配良好，未发现明显问题
- 建议：真机测试时重点检查小尺寸海报（80×120rpx）的角色识别度

### 5.5 小尺寸海报识别度 ✅
- 最小海报 80×120rpx（movie 前后关联 / character 关联作品），CDN 压缩后仍清晰
- 首字兜底方案在破 URL 时优雅降级

### 5.6 图片与文字层级 ✅
- 所有图片叠加文字的区域均有渐变/暗化罩层
- 海报底部渐变（linear-gradient to top）保证文字可读

### 5.7 "纯文字资料库"感评估

| 页面 | 评估 | 说明 |
|------|------|------|
| home | ✅ 已脱离 | Hero Banner + 2×2 视觉卡片 + 真实图片 |
| movie | ✅ 已脱离 | stills 背景 + 海报 + 角色头像 |
| character | ✅ 已脱离 | 160rpx 真实头像 + 阵营光效 |
| explore | ✅ 已脱离 | Canvas 网络图 + 真实头像节点 |
| browse | ✅ 已脱离 | 真实海报缩略图 + 阶段图 |
| routes | ️ 轻微 | 纯文字卡片 + 进度条，无图片。但路线页定位是功能导航，可接受 |
| route-detail | ⚠️ 轻微 | 纯文字列表 + 序号圆球，无海报。建议接入海报缩略图 |
| characters | ⚠️ 中等 | 首字徽章 + 文字列表，未接入真实头像。**建议优先修 P1-01** |
| panorama | ⚠️ 中等 | Canvas 连线图 + 首字节点，视觉独特但信息密度低。可接受 |
| my-mcu | ⚠️ 中等 | 海报卡片用阶段色+首字，未接入真实图片。**建议优先修 P1-02** |
| share | ✅ 已脱离 | Canvas 海报生成页，视觉独特 |
| feedback | ✅ 已脱离 | 表单页，视觉简洁 |

---

## 六、优先级排序

**建议 Work 按以下顺序执行 P1 修正：**

1. **P1-01** characters 接入真实头像（视觉提升最大，改动最小）
2. **P1-02** my-mcu 接入真实海报（Tab 页高频访问）
3. **P1-33** 按钮圆角统一（routes/route-detail/my-mcu）
4. **P1-34/35** feedback 按钮高度统一
5. **P1-04~P1-26** 间距 Token 化（批量修正，工时集中）
6. **P1-27~P1-32** 圆角 Token 化
7. **P1-03** panorama 节点接入海报（可选，视觉提升有限）
8. **P1-36~P1-40** 其他一致性修正

---

## 七、结论

**P0：0 项必改**

**P1：40 项建议修**（其中 P1-01/P1-02 图片接入优先级最高）

**P2：5 项可后优化**

四核心页面 P0 全部通过，全局视觉一致性良好。主要改进空间在图片资源接入（characters/my-mcu 两个页面）和历史遗留的非标间距/圆角值 Token 化。
