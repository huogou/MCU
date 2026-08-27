# MCU V1.2 开发视觉标注

> 版本：V1.2-DS · 2026-08-25
> 设计：QoderWork CN（设计AI）
> 依据：《MCU V1.2 Design System》+ GPT《V1.2 联合升级任务书》
> 状态：待策划AI（GPT）审核
> 配套文件：《MCU-V1.2页面视觉升级方案》《MCU-V1.2图片资源清单》

---

## 一、Token 完整 CSS 清单

以下为 app.wxss `page {}` 中需要设置的完整 Token 列表。开发直接复制到 app.wxss 替换现有 Token。

```css
page {
  /* ── 背景层 ── */
  --bg: #080B12;
  --surface-0: #0D1119;
  --surface-1: #161D2B;
  --surface-2: #1E2636;
  --surface-3: #2A3447;

  /* ── 品牌色 ── */
  --gold: #F2B233;
  --gold-btn-text: #1A1206;

  /* ── 功能强调色（V1.2 新增） ── */
  --accent-blue: #4A9EF5;
  --accent-red: #E85D5D;
  --accent-purple: #9B7FE8;

  /* ── 功能色 Alpha 变体（V1.2 新增） ── */
  --accent-blue-a10: rgba(74,158,245,0.10);
  --accent-blue-a20: rgba(74,158,245,0.20);
  --accent-red-a10: rgba(232,93,93,0.10);
  --accent-red-a20: rgba(232,93,93,0.20);
  --accent-purple-a10: rgba(155,127,232,0.10);
  --accent-purple-a20: rgba(155,127,232,0.20);

  /* ── 阶段色 ── */
  --p1: #5B8DEF;
  --p2: #28B487;
  --p3: #F0A932;
  --p4: #8B6FE8;
  --p5: #E8483F;
  --p6: #C25B8E;

  /* ── 阶段色 Alpha 变体 ── */
  --p1-a20: rgba(91,141,239,0.20);
  --p1-a60: rgba(91,141,239,0.60);
  --p2-a20: rgba(40,180,135,0.20);
  --p2-a60: rgba(40,180,135,0.60);
  --p3-a20: rgba(240,169,50,0.20);
  --p3-a60: rgba(240,169,50,0.60);
  --p4-a20: rgba(139,111,232,0.20);
  --p4-a60: rgba(139,111,232,0.60);
  --p5-a20: rgba(232,72,63,0.20);
  --p5-a60: rgba(232,72,63,0.60);
  --p6-a20: rgba(194,91,142,0.20);
  --p6-a60: rgba(194,91,142,0.60);

  /* ── 金色 Alpha 变体 ── */
  --gold-a04: rgba(242,178,51,0.04);
  --gold-a06: rgba(242,178,51,0.06);
  --gold-a10: rgba(242,178,51,0.10);
  --gold-a14: rgba(242,178,51,0.14);
  --gold-a15: rgba(242,178,51,0.15);
  --gold-a20: rgba(242,178,51,0.20);
  --gold-a30: rgba(242,178,51,0.30);
  --gold-a40: rgba(242,178,51,0.40);
  --gold-a50: rgba(242,178,51,0.50);
  --gold-a55: rgba(242,178,51,0.55);
  --gold-a60: rgba(242,178,51,0.60);

  /* ── 文本层 ── */
  --text-main: #E8ECF4;
  --text-sub: #8E98AA;
  --text-weak: #555F73;

  /* ── 状态色 ── */
  --success: #3FB98A;
  --success-a08: rgba(63,185,138,0.08);
  --success-a10: rgba(63,185,138,0.10);
  --success-a20: rgba(63,185,138,0.20);
  --success-a30: rgba(63,185,138,0.30);
  --error: #E5604D;

  /* ── 基础 ── */
  --white: #FFFFFF;
  --white-a50: rgba(255,255,255,0.50);
  --bg-a70: rgba(8,11,18,0.70);

  /* ── 字号（5 级） ── */
  --fs-display: 56rpx;
  --fs-title: 36rpx;
  --fs-body: 28rpx;
  --fs-caption: 24rpx;
  --fs-mini: 22rpx;

  /* ── 间距（7 级） ── */
  --space-xs: 8rpx;
  --space-sm: 20rpx;
  --space-md: 28rpx;
  --space-lg: 36rpx;
  --space-xl: 56rpx;
  --space-2xl: 72rpx;
  --page-x: 36rpx;

  /* ── 圆角（5 级） ── */
  --radius-sm: 12rpx;
  --radius-md: 16rpx;
  --radius-lg: 20rpx;
  --radius-xl: 32rpx;
  --radius-full: 999rpx;

  /* ── 阴影 ── */
  --shadow-card: 0 4rpx 16rpx rgba(0,0,0,0.3);
  --shadow-hero: 0 8rpx 32rpx rgba(0,0,0,0.4);
  --glow-gold: 0 8rpx 24rpx rgba(242,178,51,0.12);
  --glow-gold-strong: 0 12rpx 40rpx rgba(242,178,51,0.20);

  /* ── 字体 ── */
  font-family: -apple-system, "PingFang SC", "Helvetica Neue", Helvetica, sans-serif;
  font-size: 28rpx;
  line-height: 1.5;
}
```

---

## 二、全局通用类

以下类可直接在 wxml 中使用，无需各页面重复定义：

```css
/* ══ 布局 ══ */
.mcu-page       { min-height: 100vh; background: var(--bg); padding: 0 var(--page-x); }
.mcu-section    { margin-bottom: var(--space-xl); }

/* ══ 三级卡片 ══ */
.card-hero      { background: var(--surface-1); border-radius: var(--radius-xl); padding: var(--space-lg); box-shadow: var(--shadow-hero); }
.card-content   { background: var(--surface-2); border: 1rpx solid var(--surface-3); border-radius: var(--radius-lg); padding: var(--space-md); }
.card-compact   { background: var(--surface-2); border-radius: var(--radius-md); padding: var(--space-sm) 20rpx; }

/* ══ 文字 ══ */
.mcu-display    { font-size: var(--fs-display); font-weight: 700; color: var(--text-main); }
.mcu-title      { font-size: var(--fs-title); font-weight: 600; color: var(--text-main); }
.mcu-body       { font-size: var(--fs-body); color: var(--text-main); }
.mcu-sub        { font-size: var(--fs-body); color: var(--text-sub); }
.mcu-caption    { font-size: var(--fs-caption); color: var(--text-sub); }
.mcu-weak       { font-size: var(--fs-caption); color: var(--text-weak); }
.mcu-mini       { font-size: var(--fs-mini); color: var(--text-weak); }
.mcu-gold       { color: var(--gold); }

/* ══ 按钮 ══ */
.mcu-btn-primary  { background: var(--gold); color: var(--gold-btn-text); font-weight: 600; border-radius: var(--radius-md); height: 88rpx; line-height: 88rpx; text-align: center; box-shadow: var(--glow-gold); }
.mcu-btn-ghost    { color: var(--gold); font-size: var(--fs-body); font-weight: 400; }

/* ══ 分割线 ══ */
.mcu-divider      { height: 1rpx; background: var(--surface-3); margin: var(--space-lg) 0; }
```

---

## 三、字体规范标注

### 3.1 字号体系

| 层级 | Token | 值 | 用途 |
|------|-------|-----|------|
| Display | --fs-display | 56rpx | 页面主标题、进度数字 |
| Title | --fs-title | 36rpx | 模块标题 |
| Body | --fs-body | 28rpx | 正文、按钮文字、卡片标题 |
| Caption | --fs-caption | 24rpx | 辅助说明、标签 |
| Mini | --fs-mini | 22rpx | 极辅助（进度标签、时间） |

### 3.2 字重规则

**仅允许 400 / 600 / 700 三档。禁止 500。**

| 字重 | 用途 |
|------|------|
| 400 | 正文、描述、辅助 |
| 600 | 标题、按钮、卡片名 |
| 700 | 页面标题、品牌名、关键数字（进度值） |

### 3.3 四级视觉层级

每屏文字必须归入以下四级之一，不允许出现"中间态"：

| 层级 | 字号 | 字重 | 颜色 |
|------|------|------|------|
| 一级 · 页面标题 | 56rpx | 700 | --text-main 或 white |
| 二级 · 模块标题 | 36rpx | 600 | --text-main |
| 三级 · 卡片标题 | 28rpx | 600 | --text-main |
| 辅助 · 描述 | 24/22rpx | 400 | --text-sub / --text-weak |

### 3.4 行高

| 场景 | line-height |
|------|------------|
| 标题 | 1.2~1.3 |
| 正文 | 1.5 |
| 长文本 | 1.7 |

---

## 四、间距标注

### 4.1 间距 Token

| Token | 值 | 用途 |
|-------|-----|------|
| --space-xs | 8rpx | 紧凑内间距（标签内、图标与文字） |
| --space-sm | 20rpx | 卡片内元素间距、卡片间间距 |
| --space-md | 28rpx | 标题与内容间距 |
| --space-lg | 36rpx | 模块内段落间距 |
| --space-xl | 56rpx | 模块间距 |
| --space-2xl | 72rpx | 页面顶部留白 |
| --page-x | 36rpx | 页面左右边距 |

### 4.2 关键呼吸感指标

| 位置 | 值 | 说明 |
|------|-----|------|
| 模块与模块之间 | 56rpx | 明显区隔不同内容区 |
| 页面顶部留白 | 72rpx | 首屏不压抑 |
| 卡片内标题与内容 | 28rpx | 信息不贴边 |
| 页面左右边距 | 36rpx | 两侧有呼吸 |

---

## 五、圆角标注

| Token | 值 | 用途 |
|-------|-----|------|
| --radius-sm | 12rpx | 小元素（标签、chips、小按钮） |
| --radius-md | 16rpx | 中元素（紧凑卡片、输入框） |
| --radius-lg | 20rpx | 内容卡片 |
| --radius-xl | 32rpx | Hero 卡片、弹窗 |
| --radius-full | 999rpx | 圆形头像、胶囊按钮/chips |

### 三级卡片圆角

| 层级 | 圆角 | 用途 |
|------|------|------|
| Hero | 32rpx | 全页焦点卡（继续观看、推荐电影） |
| Content | 20rpx | 内容卡（路线、电影信息） |
| Compact | 16rpx | 紧凑卡（探索入口、角色卡） |

---

## 六、阴影标注

| Token | 值 | 用途 |
|-------|-----|------|
| --shadow-card | 0 4rpx 16rpx rgba(0,0,0,0.3) | 普通卡片微浮起 |
| --shadow-hero | 0 8rpx 32rpx rgba(0,0,0,0.4) | Hero 卡片更强浮起感 |
| --glow-gold | 0 8rpx 24rpx rgba(242,178,51,0.12) | 金色 CTA 微光 |
| --glow-gold-strong | 0 12rpx 40rpx rgba(242,178,51,0.20) | 焦点 CTA 强调 |

使用规则：普通卡片 --shadow-card，Hero 卡片 --shadow-hero，金色 CTA --glow-gold。禁止大面积强阴影和彩色阴影（金色除外）。

---

## 七、按钮规范标注

### 7.1 按钮类型

| 类型 | 样式 | 用途 | 每页限量 |
|------|------|------|---------|
| Primary（金色实心） | --gold 底 + --gold-btn-text + 600字重 + --glow-gold | 全页主行动点 | **1 个** |
| Secondary（描边） | transparent 底 + --gold 边框 + --gold 文字 | 次级行动 | 不限 |
| Ghost（文字链） | 无背景无边框 + --gold 文字 | 轻量跳转 | 不限 |
| Success（绿色描边） | transparent 底 + --success 边框 + --success 文字 | 标记已看 | 1 个 |

### 7.2 按钮尺寸

| 类型 | 高度 | 圆角 | 字号 |
|------|------|------|------|
| 全宽 CTA | 88rpx | 16rpx (--radius-md) | 28rpx / 600 |
| 标准按钮 | 72rpx | 16rpx | 26rpx / 600 |
| 小按钮 | 56rpx | 12rpx (--radius-sm) | 24rpx / 600 |
| 胶囊 chips | 56rpx | 999rpx (--radius-full) | 24rpx / 400 |

### 7.3 交互态

| 状态 | 样式 |
|------|------|
| hover/active | opacity 0.85 |
| disabled | opacity 0.4 |
| 过渡 | transition: opacity 0.15s |

---

## 八、卡片规范标注

### 8.1 三级卡片体系

| 层级 | 背景 | 边框 | 圆角 | 内边距 | 阴影 |
|------|------|------|------|--------|------|
| Hero | --surface-1 | 可选 --gold-a20 | 32rpx | 36~40rpx | --shadow-hero |
| Content | --surface-2 | 1rpx --surface-3 | 20rpx | 28rpx | --shadow-card |
| Compact | --surface-2 | 无 | 16rpx | 20rpx | 无 |

### 8.2 图片卡片规则

- 图片与卡片边缘无额外间距（图片贴边）
- 图片圆角与卡片圆角一致
- 图片加载前显示阶段色渐变兜底
- 每张卡片核心信息不超过 3 行
- 卡片之间间距 ≥ 20rpx（--space-sm）

---

## 九、Icon 规范标注

### 9.1 图标风格

- 风格：线性（描边），2rpx 描边宽度
- 尺寸：48rpx × 48rpx 容器，图标本体 36rpx 区域
- 颜色：默认 --text-sub，激活/强调 --gold

### 9.2 图标清单

| 图标 | 用途 | 实现方式 |
|------|------|---------|
| chevron-left | 返回 | CSS（已有） |
| chevron-right | 进入/展开 | CSS（已有） |
| play | 播放/开始观看 | CSS（已有） |
| check | 已看/完成 | CSS（已有） |
| close | 关闭 | CSS（已有） |
| chevron-down | 折叠展开 | CSS 新增 |
| timeline | 时间线入口 | 待 SVG |
| characters | 角色入口 | 待 SVG |
| relation | 关系入口 | 待 SVG |
| route | 路线入口 | 待 SVG |

### 9.3 过渡方案

SVG 就位前：功能性箭头/勾选继续 CSS 绘制，入口图标暂用 Unicode 占位（◷ ✦ ◈ ⊞），统一放入 48rpx 方形容器。新模块禁止引入新的 Unicode 图标。

---

## 十、图片组件规范标注

### 10.1 三态行为

| 状态 | 表现 |
|------|------|
| 加载中 | 阶段色渐变背景 + 居中首字 |
| 加载成功 | opacity 从 0 渐入到 1（transition 0.3s） |
| 加载失败 | 保持阶段色渐变 + 首字（不显示 broken icon） |

### 10.2 图片尺寸规格

| 场景 | 显示尺寸(rpx) | 源图尺寸(px) |
|------|-------------|-------------|
| 海报-大（电影详情 Hero） | 220×320 | 400×600 |
| 海报-中（推荐卡片） | 120×180 | 400×600 |
| 海报-小（全景/前后关联） | 80×120 | 400×600 |
| 海报-列表（最近观看） | 120×160 | 400×600 |
| 推荐大卡海报 | 686×360 | 750×400 |
| 角色头像-大（角色详情） | 128×128 | 300×300 |
| 角色头像-中（图鉴/热门） | 96~104 | 300×300 |
| 角色头像-小（关系网格） | 80×80 | 300×300 |
| 背景图-首页 | 750×500 | 750×500 |
| 背景图-详情 | 750×400~500 | 750×500 |
| 阶段代表图 | 750×400 | 750×400 |

---

## 十一、各页面改动要点

### 11.1 首页（home）

**wxml 改动：**
- 模块①：替换原 brand-area + continue-card 为新的旅程进度卡（journey-card）
- 模块②：替换原 my-route 为推荐大卡（recCard）
- 模块③：替换原纵向三行探索入口为横向三列（explore-entries）
- 模块④⑤：保留结构，char-avatar / recent-poster 从色块 div 改为 `<image>` 组件

**wxss 改动：**
- 新增 journey-card / journey-bg / journey-progress 等样式
- 新增 recCard / rec-poster / rec-body 等样式
- 新增 explore-entries / explore-entry 三列布局样式
- 新增入口氛围色（entry-timeline / entry-characters / entry-relation）

**js 改动：**
- 新增 journeyCard 数据字段（watchedCount / totalCount / phaseText / currentMovie）
- 新增 recommend 数据字段（movieId / cn / reason / posterUrl）
- 从 visuals.js 注入图片 URL

### 11.2 电影详情页（movie）

**wxml 改动：**
- Hero 区增加背景图 image + 叠加渐变
- 新增"主要角色"模块（横向 4 个头像）
- 前后关联海报从色块改为 image
- 推荐理由标签颜色改为 --accent-blue

**wxss 改动：**
- Hero 区背景图样式 + 渐变叠加
- 主要角色模块样式（头像横排 + 名字）
- 推荐理由标签颜色 token 替换

**js 改动：**
- 从 content.chars 取前 4 位角色 ID
- 注入角色头像 URL（从 visuals.js）
- 注入背景图 URL

### 11.3 角色详情页（character）

**wxml 改动：**
- Hero 区增加背景图 image
- 头像从色块改为 image
- 首次出现和关联作品海报改为 image
- 关系网格头像改为 image

**wxss 改动：**
- 背景图样式 + 阵营色渐变映射
- 头像圆形 + 阵营色描边样式
- 阵营色映射类（camp-avengers / camp-asgard 等）

**js 改动：**
- 注入角色背景图 URL
- 注入关联作品海报 URL
- 注入关系角色头像 URL

### 11.4 全景图页（panorama）

**wxml 改动：**
- 从 Canvas 自由画布改为按阶段分区的纵向列表
- 每个阶段一个卡片，内含阶段背景图 + 海报横滚

**wxss 改动：**
- 全新样式（阶段卡片 + 海报行 + 连接线）

**js 改动：**
- 数据结构微调（按阶段分组内容列表）

### 11.5 角色图鉴页（characters）

**wxml 改动：**
- 角色头像从色块改为 image
- 卡片左侧增加阵营色竖条

**wxss 改动：**
- 头像圆形 + 阵营色描边
- 左边条样式（4rpx 宽，阵营色）

**js 改动：**
- 注入角色头像 URL

### 11.6 关系探索页（explore）

**wxml 改动：**
- 关系对中的文字头像改为 image

**wxss 改动：**
- 关系类型颜色映射（盟友蓝/敌人红/师徒金/家人紫）

**js 改动：**
- 注入角色头像 URL

### 11.7 我的 MCU 旅程页（my-mcu）

**wxml 改动：**
- 增加背景图
- 进度数字放大
- 增加推荐路线卡 + 海报

**wxss 改动：**
- 背景图样式
- 进度数字样式

**js 改动：**
- 注入背景图 URL + 推荐电影海报 URL

---

## 十二、实施约束

1. **不改功能逻辑**：不改跳转、不改数据模型结构、不改路由
2. **visuals.js 单一来源**：图片路径统一从 visuals.js 获取，页面不硬编码图片 URL
3. **图片三态必须有**：所有图片组件必须有加载态和失败态（阶段色渐变兜底）
4. **零 raw hex**：所有颜色引用 Token 变量，不允许直接写 #xxxxxx
5. **零 font-weight:500**：只允许 400/600/700
6. **网络图片需 lazy-load**：首屏外图片设置 lazy-load

---

## 十三、实施优先级

| 优先级 | 内容 | 理由 |
|--------|------|------|
| P0 | 59 张海报 + 24 张角色头像就位 | 覆盖所有页面核心视觉 |
| P0 | 电影详情页（海报+背景图+角色头像） | 用户停留最久 |
| P0 | 角色详情页（头像+背景图+海报） | 角色体系核心 |
| P1 | 首页背景 + 6 张阶段代表图 | 氛围提升最大 |
| P1 | 首页重构（旅程卡+推荐大卡+3列入口） | 首屏体验核心 |
| P1 | 关系探索页（头像替换） | 改动小，效果明显 |
| P2 | 全景图结构重做 | 改动最大，需更多开发时间 |
| P2 | 83 张场景图 | 背景氛围提升 |
| P3 | 功能入口 SVG 图标 | 可用 Unicode 暂代 |

---

## 十四、验收 Checklist

- [ ] 所有颜色引用 Token 变量（零 raw hex）
- [ ] 字重仅 400/600/700（零 500）
- [ ] 字号仅 56/36/28/24/22rpx 五档
- [ ] 间距仅使用 Token 定义的 7 级值
- [ ] 圆角仅使用 Token 定义的 5 级值
- [ ] 所有图片有加载态和失败态
- [ ] 金色实心按钮每页最多 1 个
- [ ] 模块间距 56rpx，页面边距 36rpx
- [ ] 首页进度数字 56rpx/700/--gold
- [ ] 功能四色正确使用（gold/blue/red/purple）
- [ ] 阵营色映射正确（8 个阵营）
- [ ] 关系类型颜色正确（盟友蓝/敌人红/师徒金/家人紫）
