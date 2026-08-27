# MCU V1.2 四页面视觉一致性审查报告

> 审查时间：2026-08-26
> 审查人：QoderWork CN（设计AI）
> 审查方式：逐行代码审查 wxml + wxss
> 参照标准：《MCU-V1.2-开发视觉标注》+ app.wxss Token 定义
> 目标：从"信息展示页面"升级为"漫威粉丝愿意收藏和分享的产品页面"

---

## 一、审查总览

| 页面 | 字体层级 | 间距规范 | Icon对齐 | 卡片高度 | 图片比例 | 空白区域 | 总体 |
|------|---------|---------|---------|---------|---------|---------|------|
| 首页 | ⚠️ 2处 | ⚠️ 8处 | ⚠️ Unicode | ✅ 统一 | ✅ 统一 | ✅ 合理 | ⚠️ |
| 电影详情 | ⚠️ 3处 | ⚠️ 5处 | ✅ CSS图标 | ✅ 统一 | ✅ 统一 | ✅ 合理 | ️ |
| 角色详情 | ✅ 合规 | ⚠️ 3处 | ✅ CSS图标 | ✅ 统一 | ✅ 统一 | ✅ 合理 | ✅ |
| 关系探索 | ✅ 合规 | ✅ 合规 | ️ Unicode | ✅ 统一 | N/A | ✅ 合理 | ❌ 结构需重做 |

---

## 二、首页（home.wxss）审查

### 2.1 字体大小层级 ⚠️

| 位置 | 当前值 | 问题 | 建议 |
|------|--------|------|------|
| L179 `.rec-name` | var(--fs-title)=36rpx / **700** | Title 级用 700 过重 | 改为 600（Title 级规范字重） |
| L299 `.char-name` | var(--fs-body)=28rpx / **600** | ✅ 合规 | — |

**结论：** 1 处需调整。推荐卡片电影名字重 700→600，与模块标题层级区分。

### 2.2 间距规范 ⚠️（8 处非标准值）

| 行号 | 选择器 | 当前值 | 标准 Token | 偏差 |
|------|--------|--------|-----------|------|
| L221 | `.exp-row` | gap: **16rpx** | --space-xs(8) 或 --space-sm(20) | 无对应 Token |
| L272 | `.char-card` | padding: **24rpx 16rpx** | --space-md(28) / --space-sm(20) | 上下左右均非标准 |
| L108 | `.jm-en` | margin-top: **4rpx** | --space-xs(8) | 过小 |
| L114 | `.jm-phase` | margin-top: **4rpx** | --space-xs(8) | 过小 |
| L187 | `.rec-sub` | margin-top: **4rpx** | --space-xs(8) | 过小 |
| L301 | `.char-name` | margin-top: **16rpx** | --space-sm(20) 或 --space-xs(8) | 无对应 Token |
| L306 | `.char-faction` | margin-top: **6rpx** | --space-xs(8) | 过小 |
| L325 | `.recent-item` | margin-right: **24rpx** | --space-md(28) 或 --space-sm(20) | 无对应 Token |
| L346 | `.recent-name` | margin-top: **12rpx** | --space-sm(20) 或 --space-xs(8) | 无对应 Token |

**修正方案：**

```css
/* 方案 A：严格 Token 化（推荐） */
.exp-row { gap: var(--space-sm); }          /* 16→20 */
.char-card { padding: var(--space-sm) var(--space-xs); }  /* 24 16→20 8 */
.jm-en, .jm-phase, .rec-sub { margin-top: var(--space-xs); }  /* 4→8 */
.char-name { margin-top: var(--space-sm); }  /* 16→20 */
.char-faction { margin-top: var(--space-xs); }  /* 6→8 */
.recent-item { margin-right: var(--space-md); }  /* 24→28 或改 --space-sm=20 */
.recent-name { margin-top: var(--space-xs); }  /* 12→8 */
```

### 2.3 Icon 和文字对齐 ⚠️

宇宙入口 3 列使用 Unicode 占位符（◷⬡），非标准图标。

| 入口 | 当前 | 问题 |
|------|------|------|
| 宇宙时间线 | ◷ | Unicode 字符，各设备渲染不一致 |
| 角色图鉴 | ✦ | 同上 |
| 关系探索 | ⬡ | 同上 |

**修正方案：** 替换为内联 SVG（P1 优先级，见《视觉资源补充规范》§2.3）。

### 2.4 卡片高度 ✅

| 卡片 | 高度 | 一致性 |
|------|------|--------|
| 旅程进度卡 | 自适应（含背景图） | ✅ |
| 推荐大卡 | 360rpx 海报区 + 内容区 | ✅ |
| 入口卡片 | 200rpx 固定 | ✅ 三卡等高 |
| 角色卡片 | 自适应（头像96rpx + 文字） | ✅ 横滚统一 |
| 最近观看 | 160rpx 海报 + 文字 | ✅ 统一 |

### 2.5 图片比例 ✅

- 推荐海报：全宽 360rpx 高，aspectFill → 正确
- 角色头像：96rpx 圆形 → 正确
- 最近观看海报：120×160rpx（3:4）→ 正确

### 2.6 空白区域 ✅

- 页顶 --space-2xl(72rpx) → 充足
- 模块间距 --space-xl(56rpx) → 呼吸感好
- 页边距 --page-x(36rpx) → 标准

---

## 三、电影详情页（movie.wxss）审查

### 3.1 字体大小层级 ⚠️

| 位置 | 当前值 | 问题 | 建议 |
|------|--------|------|------|
| L97 `.hero-title` | var(--fs-title)=36rpx / **700** | 电影名用 700 可接受（Hero 级标题） | 保留 |
| L389 `.seq-poster text` | var(--fs-body)=28rpx / **700** | 前后关联占位字用 700 过重 | 改为 600 |
| L463 `.next-rec-poster text` | var(--fs-title)=36rpx / **700** | 下一部推荐占位字用 700 过重 | 改为 600 |
| L615 `.ach-sheet-badge` | 60rpx / **700** | 成就徽章数字，非标准字号 | 保留（特殊组件） |

**结论：** 2 处需调整。占位首字字重 700→600。

### 3.2 间距规范 ️（5 处非标准值）

| 行号 | 选择器 | 当前值 | 标准 Token | 偏差 |
|------|--------|--------|-----------|------|
| L17 | `.movie-nav-bar` | padding-bottom: **12rpx** | --space-xs(8) | 非标准 |
| L84 | `.hero-phase` | margin-bottom: **12rpx** | --space-xs(8) | 非标准 |
| L100 | `.hero-title` | margin-bottom: var(--space-xs) | ✅ | — |
| L207 | `.resource-title` | margin-bottom: **6rpx** | --space-xs(8) | 非标准 |
| L273 | `.why-label` | margin-bottom: **12rpx** | --space-xs(8) | 非标准 |
| L278 | `.why-ctx` | margin-bottom: **10rpx** | --space-xs(8) | 非标准 |
| L369 | `.seq-card` | gap: **12rpx** | --space-xs(8) | 非标准 |
| L436 | `.mark-watched-btn` | margin-bottom: var(--space-md) | ✅ | — |
| L480 | `.next-rec-title` | margin-bottom: **6rpx** | --space-xs(8) | 非标准 |

**修正方案：**

```css
.movie-nav-bar { padding-bottom: var(--space-xs); }   /* 12→8 */
.hero-phase { margin-bottom: var(--space-xs); }         /* 12→8 */
.resource-title { margin-bottom: var(--space-xs); }     /* 6→8 */
.why-label { margin-bottom: var(--space-xs); }          /* 12→8 */
.why-ctx { margin-bottom: var(--space-xs); }            /* 10→8 */
.seq-card { gap: var(--space-xs); }                     /* 12→8 */
.next-rec-title { margin-bottom: var(--space-xs); }     /* 6→8 */
```

### 3.3 圆角规范 ⚠️

| 行号 | 选择器 | 当前值 | 应使用 |
|------|--------|--------|--------|
| L454 | `.next-rec-poster` | border-radius: var(--**space**-xs) | var(--**radius**-sm)=12rpx |

> 这是 Bug：用了 spacing token 而非 radius token。space-xs=8rpx，radius-sm=12rpx。

### 3.4 Icon 和文字对齐 ✅

全部使用 CSS 绘制图标（ico-play / ico-check / chevron），无 Unicode，对齐一致。

### 3.5 卡片高度 ✅

- Hero 区：自适应
- CTA：88rpx 固定
- 资源模块：自适应
- 为什么看：自适应
- 主要角色：自适应（80rpx 头像 + 文字）
- 前后关联：自适应（80×120rpx 海报 + 文字）
- 下一部推荐：自适应

### 3.6 图片比例 ✅

- 主海报：220×320rpx（≈2:3）→ 正确
- 前后关联海报：80×120rpx（2:3）→ 正确
- 下一部海报：100×144rpx（≈2:3）→ 正确
- 角色头像：80rpx 圆形 → 正确

---

## 四、角色详情页（character.wxss）审查

### 4.1 字体大小层级 ✅

全部使用 Token，字重仅 400/600/700，无违规。

### 4.2 间距规范 ⚠️（3 处非标准值）

| 行号 | 选择器 | 当前值 | 标准 Token |
|------|--------|--------|-----------|
| L61 | `.related-cn` | margin-top: **14rpx** | --space-sm(20) 或 --space-xs(8) |
| L62 | `.related-shared` | margin-top: **6rpx** | --space-xs(8) |
| L46 | `.phase-tag` | padding: **6rpx** 14rpx | --space-xs(8) |

**修正方案：**

```css
.related-cn { margin-top: var(--space-sm); }      /* 14→20 */
.related-shared { margin-top: var(--space-xs); }  /* 6→8 */
.phase-tag { padding: var(--space-xs) 14rpx; }    /* 6→8 */
```

### 4.3 圆角规范 ⚠️

| 行号 | 选择器 | 当前值 | 应使用 |
|------|--------|--------|--------|
| L46 | `.phase-tag` | border-radius: **10rpx** | var(--radius-sm)=12rpx |

### 4.4 Icon 和文字对齐 ✅

纯 CSS 图标，无 Unicode。

### 4.5 卡片高度 ✅

- Hero 区：自适应
- 通用卡片：自适应，border-radius var(--radius-lg)=20rpx
- 首次出现行：120×180rpx 海报
- 关联作品行：80×120rpx 海报
- 关联角色网格：80rpx 头像 + 文字

### 4.6 图片比例 ✅

- Hero 头像：128rpx 圆形 → 正确
- 首次出现海报：120×180rpx（2:3）→ 正确
- 关联作品海报：80×120rpx（2:3）→ 正确
- 关联角色头像：80rpx 圆形 → 正确

---

## 五、关系探索页（explore.wxml/wxss）审查

### 5.1 总体结论 ❌

**仍为 V1.1 入口聚合页结构**，与 V1.2 设计方向（角色关系网络探索）完全不符。

| 维度 | V1.1（当前） | V1.2（设计要求） |
|------|-------------|-----------------|
| 页面定位 | 入口聚合（全景图+角色图鉴+角色网格） | 角色关系网络探索 |
| 核心组件 | 角色文字卡片网格 | 关系对卡片（双头像+关系类型） |
| 角色头像 | 无（纯文字+阵营色背景） | 真实头像照片 80rpx 圆形 |
| 关系展示 | 无 | 关系类型筛选 + 关系对卡片 |
| 功能色 | 无 | 盟友蓝/敌人红/师徒金/家人紫 |

### 5.2 字体层级 ✅

当前代码字体全部使用 Token，无违规。但这是 V1.1 结构的合规，重做后需按新方案执行。

### 5.3 间距规范 ✅

同上，V1.1 结构内间距合规。

### 5.4 Icon ⚠️

使用 Unicode 占位（◈✦），需替换为 SVG。

### 5.5 执行方案

按《MCU-V1.2-关系探索页视觉方案》完整重做 explore.wxml / explore.wxss / explore.js。

---

## 六、跨页面一致性问题

### 6.1 字重使用不一致

| 场景 | 首页 | 电影详情 | 角色详情 | 规范 |
|------|------|---------|---------|------|
| 模块标题 | 600 ✅ | 600 ✅ | 600 ✅ | 600 |
| 页面标题 | 700 ✅ | — | — | 700 |
| 卡片标题 | — | 600 ✅ | 600 ✅ | 600 |
| 电影名（Hero） | — | **700** ⚠️ | — | 700 可接受 |
| 电影名（推荐卡） | **700** ⚠️ | — | — | 应 600 |
| 角色名 | 600 ✅ | 600 ✅ | 600 ✅ | 600 |
| 占位首字 | **700** | **700** ⚠️ | — | 应 600 |

### 6.2 间距非标准值汇总

共 **16 处**非标准间距值，分布在 3 个页面：

| 页面 | 数量 | 主要问题值 |
|------|------|-----------|
| 首页 | 8 处 | 4rpx / 6rpx / 12rpx / 16rpx / 24rpx |
| 电影详情 | 7 处 | 6rpx / 10rpx / 12rpx |
| 角色详情 | 3 处 | 6rpx / 10rpx / 14rpx |

**规律：** 非标准值集中在 4/6/10/12/14/16rpx 这几个"中间值"，说明开发时 Token 粒度不够细或开发自行估算。

**建议：** 统一映射到 --space-xs(8rpx)，少数需要更大间距的用 --space-sm(20rpx)。

### 6.3 圆角非标准值汇总

| 页面 | 位置 | 当前值 | 应使用 |
|------|------|--------|--------|
| 电影详情 | .next-rec-poster | var(--space-xs)=8rpx | var(--radius-sm)=12rpx |
| 角色详情 | .phase-tag | 10rpx | var(--radius-sm)=12rpx |

### 6.4 图片资源接入状态

| 页面 | 海报 | 剧照 | 角色头像 | 背景图 |
|------|------|------|---------|--------|
| 首页 | ✅ visuals.visual() | — | ️ 用 item.poster 字段 | ✅ homeBg 已接入 |
| 电影详情 | ✅ visuals.visual() | ✅ visuals.visual() | ⚠️ 用兜底 | ✅ heroBg 已接入 |
| 角色详情 | ✅ visuals.visual() | — | ️ 用兜底 | ✅ 阵营渐变 |
| 关系探索 | — | — | ❌ 无头像 | — |

**首页角色头像问题：** 当前使用 `item.poster` 字段（来自 home.js 视图模型），该字段返回空字符串时走兜底。应改为调用 `visuals.avatar(item.id)` 获取真实头像。

---

## 七、修改优先级汇总

### P0（必须修复，影响功能/视觉完整性）

| 编号 | 页面 | 问题 | 修改方案 |
|------|------|------|---------|
| P0-1 | 关系探索 | V1.1 旧结构 | 按《关系探索页视觉方案》重做 |
| P0-2 | 首页 | 角色头像未接入 visuals.avatar() | home.js 中改用 visuals.avatar() |

### P1（应修复，影响视觉一致性）

| 编号 | 页面 | 问题 | 修改方案 |
|------|------|------|---------|
| P1-1 | 首页 | 8 处非标准间距 | 统一映射到 Token（见 §2.2） |
| P1-2 | 电影详情 | 7 处非标准间距 | 统一映射到 Token（见 §3.2） |
| P1-3 | 角色详情 | 3 处非标准间距 | 统一映射到 Token（见 §4.2） |
| P1-4 | 电影详情 | .next-rec-poster 圆角 Bug | var(--space-xs)→var(--radius-sm) |
| P1-5 | 角色详情 | .phase-tag 圆角 10rpx | →var(--radius-sm)=12rpx |
| P1-6 | 首页 | .rec-name 字重 700 | →600 |
| P1-7 | 电影详情 | 2 处占位字重 700 | →600 |

### P2（可延后）

| 编号 | 页面 | 问题 | 修改方案 |
|------|------|------|---------|
| P2-1 | 首页 | 3 入口 Unicode 图标 | 替换为 SVG（见资源规范 §2.3） |
| P2-2 | 关系探索 | 2 入口 Unicode 图标 | 重做时一并处理 |
| P2-3 | 全页面 | 图片缩放+CDN上传 | 按资源规范执行 |

---

## 八、升级目标对照

| 维度 | 现状 | 目标 | 差距 |
|------|------|------|------|
| 视觉氛围 | 暗色+金色，基本到位 | 图片驱动沉浸感 | 缺真实图片填充 |
| 信息层级 | 5 级字号体系建立 | 层级清晰可扫读 | 16 处间距不统一干扰层级 |
| 组件一致性 | Token 化完成 | 跨页面统一 | 圆角/间距有遗漏 |
| 图片质量 | 38 海报在线 | 全量真实图片 | 角色头像/背景待缩放上传 |
| 交互品质 | 基础 hover 态 | 流畅有品质感 | Icon 需 SVG 化 |
| 分享欲望 | 功能工具感 | 产品收藏感 | 关系探索页需重做 |

**核心结论：** 框架和 Token 体系已建立（开发 Step4 全局统一做得好），主要差距在：
1. **16 处间距非标准值** → 机械修正，约 30 分钟
2. **关系探索页结构重做** → 按设计稿执行
3. **图片资源缩放+CDN 上传** → 资源就位后自动提升品质
4. **首页角色头像接入** → 改 1 行代码
