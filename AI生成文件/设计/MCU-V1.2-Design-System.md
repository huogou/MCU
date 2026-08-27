# MCU V1.2 Design System

> 版本：V1.2-DS · 2026-08-25
> 设计：QoderWork CN（设计AI）
> 状态：待策划AI（GPT）审核
> 效力：MCU 小程序全部页面的唯一视觉规范，替代此前所有设计文档
> 配套文档：《MCU V1.2 视觉升级方案》（图片资源清单）、《MCU V1.2 首页重构设计稿》、《MCU V1.2 核心页面视觉方案》

---

## 一、产品视觉定位

**一句话**：帮助用户探索漫威宇宙的沉浸式观影导航。

**视觉关键词**：暗黑宇宙 · 图片驱动 · 金色主线 · 电影质感

**30 秒体验目标**：用户打开即感受到"这是漫威宇宙"——不是数据工具，不是信息列表。

**设计原则**：
1. **影视化** — 海报、角色照、背景图驱动视觉，禁止纯文字色块占位
2. **暗色画布** — 深色背景让图片成为焦点
3. **金色主线** — 金色引导行动，蓝色标注信息，红色标识英雄，紫色指向宇宙
4. **优雅降级** — 图片未加载时阶段色渐变兜底，不空白不破碎

---

## 二、颜色规范

### 2.1 背景层

| Token | 值 | 用途 |
|-------|-----|------|
| --bg | #080B12 | 页面底色（宇宙黑） |
| --surface-0 | #0D1119 | 微分层（Hero 区底色） |
| --surface-1 | #161D2B | 一级卡片背景 |
| --surface-2 | #1E2636 | 二级卡片背景 |
| --surface-3 | #2A3447 | 边框/分割线/三级背景 |

### 2.2 品牌色

| Token | 值 | 用途 |
|-------|-----|------|
| --gold | #F2B233 | 品牌主色：CTA 按钮、关键数据、进度强调 |
| --gold-btn-text | #1A1206 | 金色按钮上的文字色 |

金色使用克制原则：
- 金色实心填充：全页最多 1 处（主 CTA）
- 金色文字：关键数据（进度值、推荐片名）
- 金色边框：hover/选中态
- 禁止：金色大面积铺底、金色用于非强调装饰

### 2.3 功能强调色（新增）

GPT 指定的四色体系——金色主线 + 蓝/红/紫功能色：

| Token | 值 | 语义 | 用途 |
|-------|-----|------|------|
| --accent-blue | #4A9EF5 | 科技/信息 | 时间线相关、信息标签、导航提示 |
| --accent-red | #E85D5D | 英雄/热血 | 复仇者阵营标识、英雄角色高亮、行动状态 |
| --accent-purple | #9B7FE8 | 宇宙/神秘 | 多元宇宙标识、宇宙力量相关、特殊事件 |

使用规则：
- 这四个色（gold/blue/red/purple）用于**功能强调**，不用于背景或大面积填充
- 每个颜色都有对应的 alpha 变体用于底色/标签（见 2.5）
- 阶段色（P1~P6）用于**内容标识**（电影/阶段归属），与功能色互不干扰

### 2.4 阶段色（不变）

6 个 Phase 各有专属色，仅用于内容标识（海报底色、阶段标签）：

| Token | 值 | Phase |
|-------|-----|-------|
| --p1 | #5B8DEF | Phase 1（2008-2012） |
| --p2 | #28B487 | Phase 2（2013-2015） |
| --p3 | #F0A932 | Phase 3（2016-2019） |
| --p4 | #8B6FE8 | Phase 4（2021-2022） |
| --p5 | #E8483F | Phase 5（2023-2024） |
| --p6 | #C25B8E | Phase 6（2025-2027） |

### 2.5 文本层

| Token | 值 | 用途 |
|-------|-----|------|
| --text-main | #E8ECF4 | 标题、正文（高对比） |
| --text-sub | #8E98AA | 副标题、描述 |
| --text-weak | #555F73 | 辅助信息、标签、时间 |

### 2.6 状态色

| Token | 值 | 用途 |
|-------|-----|------|
| --success | #3FB98A | 已看/完成 |
| --error | #E5604D | 错误/删除 |

### 2.7 Alpha 变体（新增功能色变体）

```css
/* 功能色 alpha（新增） */
--accent-blue-a10: rgba(74,158,245,0.10);
--accent-blue-a20: rgba(74,158,245,0.20);
--accent-red-a10: rgba(232,93,93,0.10);
--accent-red-a20: rgba(232,93,93,0.20);
--accent-purple-a10: rgba(155,127,232,0.10);
--accent-purple-a20: rgba(155,127,232,0.20);

/* 金色 alpha（已有，保留） */
--gold-a04 ~ --gold-a60: （保持现有完整梯度）
```

---

## 三、字体规范

### 3.1 字号体系（5 级）

| 层级 | Token | 值 | 用途 |
|------|-------|-----|------|
| Display | --fs-display | 56rpx | 页面主标题（品牌区标题） |
| Title | --fs-title | 36rpx | 模块标题（"继续观看""热门角色"） |
| Body | --fs-body | 28rpx | 正文、按钮文字、卡片标题 | |
| Caption | --fs-caption | 24rpx | 辅助说明、标签、片名 |
| Mini | --fs-mini | 22rpx | 极辅助（进度标签、时间标注） |

### 3.2 四级视觉层级

每一屏文字必须归入以下四级之一：

| 层级 | 字号 | 字重 | 颜色 | 示例 |
|------|------|------|------|------|
| 一级 · 页面标题 | 56rpx | 700 | --text-main 或 white | "MCU观影导航" |
| 二级 · 模块标题 | 36rpx | 600 | --text-main | "继续观看""热门角色" |
| 三级 · 卡片标题 | 28rpx | 600 | --text-main | 电影名、角色名 |
| 辅助 · 描述 | 24/22rpx | 400 | --text-sub / --text-weak | Phase、进度、标签 |

### 3.3 字重规则

仅允许 **400 / 600 / 700** 三档。禁止 500。

- 400：正文、描述、辅助
- 600：标题、按钮
- 700：页面标题、品牌名、关键数字

### 3.4 字体族

```css
font-family: -apple-system, "PingFang SC", "Helvetica Neue", Helvetica, sans-serif;
```

### 3.5 行高

- 标题：line-height 1.2~1.3
- 正文：line-height 1.5
- 长文本：line-height 1.7

---

## 四、间距规范

### 4.1 间距 Token（7 级）

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

- 模块与模块之间：56rpx — 明显区隔不同内容区
- 页面顶部留白：72rpx — 首屏不压抑
- 卡片内标题与内容：28rpx — 信息不贴边
- 页面左右边距：36rpx — 两侧有呼吸

---

## 五、圆角规范

### 5.1 圆角 Token

| Token | 值 | 用途 |
|-------|-----|------|
| --radius-sm | 12rpx | 小元素（标签、chips、小按钮） |
| --radius-md | 16rpx | 中元素（紧凑卡片、输入框） |
| --radius-lg | 20rpx | 内容卡片 |
| --radius-xl | 32rpx | Hero 卡片、弹窗 |
| --radius-full | 999rpx | 圆形头像、胶囊按钮/chips |

### 5.2 三级卡片圆角

| 层级 | 圆角 | 用途 |
|------|------|------|
| Hero | 32rpx | 全页焦点卡（继续观看、推荐电影） |
| Content | 20rpx | 内容卡（路线、电影信息） |
| Compact | 16rpx | 紧凑卡（探索入口、角色卡） |

---

## 六、阴影规范

暗色主题下阴影不可见，改用**微光线**和**辉光**来表达层级：

### 6.1 阴影 Token

| Token | 值 | 用途 |
|-------|-----|------|
| --shadow-card | 0 4rpx 16rpx rgba(0,0,0,0.3) | 普通卡片微浮起 |
| --shadow-hero | 0 8rpx 32rpx rgba(0,0,0,0.4) | Hero 卡片更强浮起感 |
| --glow-gold | 0 8rpx 24rpx rgba(242,178,51,0.12) | 金色 CTA 按钮微光 |
| --glow-gold-strong | 0 12rpx 40rpx rgba(242,178,51,0.20) | 焦点 CTA 强调 |

### 6.2 使用规则

- 普通卡片：--shadow-card（轻微浮起，不张扬）
- Hero 卡片：--shadow-hero（更强的空间感）
- 金色 CTA：--glow-gold（金色微光呼吸，引导点击）
- 禁止：大面积强阴影、彩色阴影（金色 CTA 除外）

---

## 七、按钮规范

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
| 全宽 CTA | 88rpx | 16rpx | 28rpx / 600 |
| 标准按钮 | 72rpx | 16rpx | 26rpx / 600 |
| 小按钮 | 56rpx | 12rpx | 24rpx / 600 |
| 胶囊 chips | 56rpx | 999rpx | 24rpx / 400 |

### 7.3 按钮交互态

- hover/active：opacity 0.85
- disabled：opacity 0.4
- 过渡：transition: opacity 0.15s

---

## 八、卡片规范

### 8.1 三级卡片体系

| 层级 | 背景 | 边框 | 圆角 | 内边距 | 阴影 | 用途 |
|------|------|------|------|--------|------|------|
| Hero | --surface-1 | 可选 --gold-a20 | 32rpx | 36~40rpx | --shadow-hero | 全页焦点 |
| Content | --surface-2 | 1rpx --surface-3 | 20rpx | 28rpx | --shadow-card | 内容卡 |
| Compact | --surface-2 | 无 | 16rpx | 20rpx | 无 | 紧凑列表项 |

### 8.2 图片卡片规则

含图片的卡片（海报卡、角色卡）：
- 图片与卡片边缘无额外间距（图片贴边）
- 图片圆角与卡片圆角一致
- 图片加载前显示阶段色渐变兜底

### 8.3 卡片密度控制

- 每张卡片核心信息不超过 3 行
- 超过则拆分或折叠
- 卡片之间间距 ≥ 20rpx（--space-sm）

---

## 九、Icon 规范

### 9.1 图标风格

- 风格：线性（描边），2rpx 描边宽度
- 尺寸：48rpx × 48rpx 容器，图标本体 36rpx 区域
- 颜色：默认 --text-sub，激活/强调 --gold
- 圆角：与容器一致

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

SVG 资源就位前：
- 功能性箭头/勾选继续使用 CSS 绘制
- 入口图标暂用 Unicode 占位（◷ ✦ ◈ ⊞），统一放入 48rpx 方形容器
- 新模块禁止引入新的 Unicode 图标

---

## 十、图片组件规范

### 10.1 通用行为

所有图片统一三态：

**加载中**：阶段色渐变背景 + 居中首字
**加载成功**：opacity 从 0 渐入到 1（0.3s transition）
**加载失败**：保持阶段色渐变 + 首字（不显示 broken icon）

### 10.2 图片尺寸规格

| 场景 | 显示尺寸(rpx) | 源图尺寸(px) | 说明 |
|------|-------------|-------------|------|
| 海报-大（电影详情 Hero） | 220×320 | 400×600 | @2x |
| 海报-中（推荐卡片/继续观看） | 160×240 | 400×600 | |
| 海报-小（全景图/前后关联） | 80×120 | 400×600 | |
| 海报-列表（最近观看） | 120×160 | 400×600 | |
| 角色头像-大（角色详情） | 128×128 | 300×300 | 圆形 |
| 角色头像-中（图鉴/热门） | 96×96 | 300×300 | 圆形 |
| 角色头像-小（关系网格） | 80×80 | 300×300 | 圆形 |
| 背景图-首页 | 750×500 | 750×500 | 全宽 |
| 背景图-角色/电影详情 | 750×400 | 750×400 | 全宽 |
| 阶段代表图 | 750×400 | 750×400 | 全宽 |

### 10.3 图片目录结构

```
assets/
  posters/       ← 59 张电影海报 {id}.jpg
  characters/    ← 24 张角色头像 {charId}.jpg
  phases/        ← 6 张阶段代表图 phase-{n}.jpg
  bg/            ← 背景图 home-bg.jpg 等
  icons/         ← 功能图标（SVG/PNG）
    tab/         ← TabBar 图标（已有）
```

---

## 附录 A：Token 完整清单

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

  /* ── 功能强调色 ── */
  --accent-blue: #4A9EF5;
  --accent-red: #E85D5D;
  --accent-purple: #9B7FE8;

  /* ── 阶段色 ── */
  --p1: #5B8DEF;
  --p2: #28B487;
  --p3: #F0A932;
  --p4: #8B6FE8;
  --p5: #E8483F;
  --p6: #C25B8E;

  /* ── 文本层 ── */
  --text-main: #E8ECF4;
  --text-sub: #8E98AA;
  --text-weak: #555F73;

  /* ── 状态 ── */
  --success: #3FB98A;
  --error: #E5604D;

  /* ── 基础 ── */
  --white: #FFFFFF;

  /* ── 字号 ── */
  --fs-display: 56rpx;
  --fs-title: 36rpx;
  --fs-body: 28rpx;
  --fs-caption: 24rpx;
  --fs-mini: 22rpx;

  /* ── 间距 ── */
  --space-xs: 8rpx;
  --space-sm: 20rpx;
  --space-md: 28rpx;
  --space-lg: 36rpx;
  --space-xl: 56rpx;
  --space-2xl: 72rpx;
  --page-x: 36rpx;

  /* ── 圆角 ── */
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

## 附录 B：全局通用类

```css
/* 布局 */
.mcu-page { min-height: 100vh; background: var(--bg); padding: 0 var(--page-x); }
.mcu-section { margin-bottom: var(--space-xl); }

/* 三级卡片 */
.card-hero { background: var(--surface-1); border-radius: var(--radius-xl); padding: var(--space-lg); box-shadow: var(--shadow-hero); }
.card-content { background: var(--surface-2); border: 1rpx solid var(--surface-3); border-radius: var(--radius-lg); padding: var(--space-md); }
.card-compact { background: var(--surface-2); border-radius: var(--radius-md); padding: var(--space-sm) 20rpx; }

/* 文字 */
.mcu-display { font-size: var(--fs-display); font-weight: 700; color: var(--text-main); }
.mcu-title { font-size: var(--fs-title); font-weight: 600; color: var(--text-main); }
.mcu-body { font-size: var(--fs-body); color: var(--text-main); }
.mcu-sub { font-size: var(--fs-body); color: var(--text-sub); }
.mcu-caption { font-size: var(--fs-caption); color: var(--text-sub); }
.mcu-weak { font-size: var(--fs-caption); color: var(--text-weak); }
.mcu-mini { font-size: var(--fs-mini); color: var(--text-weak); }
.mcu-gold { color: var(--gold); }

/* 按钮 */
.mcu-btn-primary { background: var(--gold); color: var(--gold-btn-text); font-weight: 600; border-radius: var(--radius-md); height: 88rpx; line-height: 88rpx; text-align: center; box-shadow: var(--glow-gold); }
.mcu-btn-ghost { color: var(--gold); font-size: var(--fs-body); font-weight: 400; }

/* 分割线 */
.mcu-divider { height: 1rpx; background: var(--surface-3); margin: var(--space-lg) 0; }
```
