# MCU V1.2 首页视觉设计稿

> 版本：V1.2-visual · 2026-08-25
> 依据：《MCU V1.2 视觉升级方案》
> 状态：待策划AI（GPT）审核
> 效力：首页视觉实现的唯一标准

---

## 一、设计理念

首页是用户打开小程序的第一屏。它必须做到一件事：

**让用户在 3 秒内感受到"这是漫威宇宙"**

手段：
- 顶部宇宙背景图营造沉浸氛围
- 电影海报和角色照片取代文字色块
- 金色 CTA 引导行动
- 暗色画布让图片成为焦点

---

## 二、页面结构（自上而下）

```
┌──────────────────────────────────────┐
│  ① 品牌区（背景图 + 标题）           │  ← 沉浸区域
│                                      │
│  ② 继续观看（Hero Card + 海报）      │  ← 核心焦点
│                                      │
│  ③ 快捷入口（4 个图标卡片）          │  ← 导航
│                                      │
│  ④ 热门角色（横滚 + 真实头像）       │  ← 角色吸引力
│                                      │
│  ⑤ 最近观看（横滚 + 真实海报）       │  ← 历史记录
└──────────────────────────────────────┘
```

模块数量：5 个（原 6 个合并——"宇宙探索"三入口与"快捷入口"4 入口合并为 4 个快捷入口行）

等等，让我重新考虑。GPT 原文提到的快捷入口是：
- 开始观看
- 宇宙时间线
- 角色探索
- 我的收藏

而当前首页有"宇宙探索"模块（时间线/角色关系/阵营探索 3 行）。

**合并方案**：将"宇宙探索"3 行入口改为 4 个横向图标卡片，增加"我的收藏"入口。

但考虑到约束"不新增功能"，我的收藏如果不存在就暂不加。改为保留原有 3 个入口 + 路线入口，共 4 个。

最终快捷入口：
1. 时间线（→ 全景页）
2. 角色关系（→ 探索 Tab）
3. 阵营探索（→ 角色图鉴）
4. 我的路线（→ 路线 Tab）

---

## 三、精确设计规格

### ① 品牌区（沉浸背景）

```
╔════════════════════════════════════════╗
║  [宇宙背景图 750×500]                  ║
║  叠加底部渐变（transparent → --bg）    ║
║                                        ║
║  ┃ MCU观影导航        ← 56rpx/700/白  ║
║  ┃ 你的漫威宇宙旅程   ← 24rpx/白70%   ║
║                                        ║
╚════════════════════════════════════════╝
```

| 元素 | 规格 |
|------|------|
| 背景图 | 750×500rpx，`/assets/bg/home-bg.jpg` |
| 叠加渐变 | linear-gradient(to bottom, transparent 40%, var(--bg) 100%) |
| 品牌竖条 | 14rpx × 72rpx，--gold，圆角 8rpx |
| 主标题 | 56rpx / 700 / var(--white)，行高 1.2 |
| 副标题 | 24rpx / 400 / rgba(255,255,255,0.7)，margin-top 8rpx |
| 区域总高 | ~400rpx（含底部渐变过渡） |
| 底部间距 | margin-bottom: 0（与 Hero Card 无缝衔接） |

### ② 继续观看 Hero Card

```
╔════════════════════════════════════════╗
║  继续观看              ← 36rpx/600    ║
║                                        ║
║  ┌──────┐                              ║
║  │      │  钢铁侠          ← 36rpx/700║
║  │[海报] │  Phase 1         ← 22rpx   ║
║  │120×  │  已看 18/59      ← 24rpx金  ║
║  │ 180  │                              ║
║  └──────┘  ┌──────────────────────┐   ║
║            │      开始观看         │   ║  ← 金色 CTA
║            └──────────────────────┘   ║
╚════════════════════════════════════════╝
```

| 元素 | 规格 |
|------|------|
| 卡片 | 背景 linear-gradient(135deg, --gold-a04, --surface-1)，border 2rpx --gold-a20 |
| | 圆角 32rpx，padding 36rpx |
| "继续观看"标题 | 36rpx / 600 / --text-main，margin-bottom 28rpx |
| 海报缩略图 | 120rpx × 180rpx，圆角 12rpx，阶段色渐变兜底 |
| | 与右侧信息间距 28rpx |
| 电影名 | 36rpx / 700 / --text-main |
| Phase 信息 | 22rpx / 400 / --text-sub，margin-top 8rpx |
| 进度值 | 24rpx / 400 / --gold，margin-top 12rpx |
| CTA 按钮 | 全宽，高 88rpx，圆角 16rpx，--gold 底 |
| | 文字 26rpx / 600 / --gold-btn-text |
| | margin-top 28rpx |
| | box-shadow: 0 8rpx 24rpx rgba(242,178,51,0.12) |
| 布局方式 | 水平：海报左 + 信息右，CTA 全宽在下 |

**新人态**：海报=钢铁侠海报，文字="从钢铁侠开始"，按钮="开始观看"
**老用户态**：海报=当前电影海报，文字=电影名+进度，按钮="继续观看"

### ③ 快捷入口（4 个图标卡片）

```
  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐
  │ [图] │  │ [图] │  │ [图] │  │ [图] │
  │时间线│  │角色  │  │阵营  │  │路线  │
  └──────┘  └──────┘  └──────┘  └──────┘
```

| 元素 | 规格 |
|------|------|
| 布局 | 4 列等宽 flex，间距 16rpx |
| 每个卡片 | 背景 --surface-2，圆角 16rpx |
| | padding 24rpx 0，text-align center |
| 图标 | 48rpx × 48rpx 容器，居中 |
| | 图标内容：CSS 绘制或 Unicode 暂用，待 SVG |
| | 颜色 --gold |
| 标题 | 24rpx / 400 / --text-sub，margin-top 12rpx |
| 模块间距 | margin-bottom 56rpx |

### ④ 热门角色

```
  热门角色                ← 36rpx/600/main

  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐
  │[头像]│ │[头像]│ │[头像]│ │[头像]│    ← 真实照片 96rpx
  │      │ │      │ │      │ │      │       圆形 + 阵营色描边
  ├──────┤ ├──────┤ ├──────┤ ├──────┤
  │钢铁侠│ │ 美队 │ │ 雷神 │ │蜘蛛侠│    ← 26rpx/600
  │复仇者│ │复仇者│ │阿斯加│ │复仇者│    ← 22rpx/阵营色
  └──────┘ └──────┘ └──────┘ └──────┘
    168rpx     横向滚动
```

| 元素 | 规格 |
|------|------|
| "热门角色"标题 | 36rpx / 600 / --text-main，margin-bottom 28rpx |
| 卡片宽度 | 168rpx |
| 卡片背景 | --surface-2，圆角 16rpx |
| 卡片内边距 | 24rpx 16rpx |
| 卡片间距 | 20rpx |
| 角色头像 | 96rpx × 96rpx，圆形 |
| | **真实角色照片**（从 `/assets/characters/{id}.jpg` 加载） |
| | 加载兜底：阵营色渐变 + 首字 |
| | 描边：3rpx solid 阵营色（半透明） |
| 角色名 | 26rpx / 600 / --text-main，margin-top 16rpx |
| 阵营标签 | 22rpx / 400 / 阵营色，margin-top 6rpx |
| | 内容：阵营名（复仇者/阿斯加德/银河护卫队等） |
| hover 态 | border 1rpx --gold-a20 |

### ⑤ 最近观看

```
  最近观看                ← 36rpx/600/main

  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐
  │     │ │     │ │     │ │     │
  │[海报]│ │[海报]│ │[海报]│ │[海报]│    ← 真实海报 120×160
  │     │ │     │ │     │ │     │
  └─────┘ └─────┘ └─────┘ └─────┘
  钢铁侠   美队    雷神    银护        ← 24rpx
          横向滚动
```

| 元素 | 规格 |
|------|------|
| "最近观看"标题 | 36rpx / 600 / --text-main，margin-bottom 28rpx |
| 海报 | 120rpx × 160rpx，圆角 12rpx |
| | **真实电影海报**（从 `/assets/posters/{id}.jpg` 加载） |
| | 加载兜底：阶段色渐变 + 首字 |
| 海报间距 | 24rpx |
| 片名 | 24rpx / 400 / --text-sub，margin-top 16rpx |
| | max-width 120rpx，text-overflow ellipsis |
| 空态 | "还没有观看记录，从《钢铁侠》开始你的旅程" |
| | 26rpx / --text-weak，padding 56rpx 0，居中 |

---

## 四、UI 组件规范

### 4.1 海报图片组件

用途：所有电影/内容海报展示。

```
状态1 - 加载中：
  ┌──────────┐
  │ ▓▓▓▓▓▓▓▓ │  ← 阶段色渐变（poster-pN）
  │ ▓▓▓首▓▓▓ │  ← 居中首字，48rpx/700/white-a50
  │ ▓▓▓▓▓▓▓▓ │
  └──────────┘

状态2 - 加载成功：
  ┌──────────┐
  │          │
  │ [海报图] │  ← opacity 从 0 渐入到 1（0.3s）
  │          │
  └──────────┘

状态3 - 加载失败：
  → 保持状态1（阶段色渐变 + 首字）
```

尺寸规格：
- 大（电影详情 Hero）：220×320rpx
- 中（继续观看/推荐）：120×180rpx
- 小（全景图/前后关联）：80×120rpx
- 列表（最近观看）：120×160rpx

### 4.2 角色头像组件

用途：所有角色头像展示。

```
状态1 - 加载中：
  ┌────────┐
  │ ▓▓▓▓▓▓ │  ← 阵营色渐变
  │ ▓▓首▓▓ │  ← 居中首字，36rpx/700/white-a60
  │ ▓▓▓▓▓▓ │
  └────────┘
  外圈：3rpx 阵营色半透明描边

状态2 - 加载成功：
  ┌────────┐
  │ [头像] │  ← 真实角色照片，圆形
  │        │
  └────────┘
  外圈：3rpx 阵营色半透明描边
```

尺寸规格：
- 大（角色详情 Hero）：128rpx
- 中（图鉴/热门角色）：96rpx
- 小（关系网格）：80rpx

### 4.3 背景图组件

用途：首页品牌区、角色详情 Hero、我的 MCU 旅程。

```
结构：
  ┌──────────────────────────┐
  │ [背景图]                  │  ← position absolute, 铺满容器
  │ 叠加渐变（底部→--bg）     │  ← 保证与下方内容无缝衔接
  │                           │
  │ [前景内容]                │  ← 文字、标题等
  └──────────────────────────┘
```

规格：
- 首页品牌区：750×500rpx
- 角色详情 Hero：750×400rpx
- 叠加渐变：linear-gradient(to bottom, transparent 40%, var(--bg) 100%)

### 4.4 阶段色渐变兜底

当图片未加载时，所有图片位统一使用阶段色渐变作为背景：

```css
/* 海报兜底 */
.poster-fallback-p1 { background: linear-gradient(135deg, var(--p1), var(--p1-a60)); }
.poster-fallback-p2 { background: linear-gradient(135deg, var(--p2), var(--p2-a60)); }
/* ... P3~P6 同理 */

/* 角色头像兜底 */
.char-fallback { background: linear-gradient(135deg, var(--surface-2), var(--surface-3)); }
```

---

## 五、视觉层级

本页所有文字归入四级：

| 层级 | 字号 | 字重 | 颜色 | 本页元素 |
|------|------|------|------|---------|
| 一级 | 56rpx | 700 | white | 品牌区主标题 |
| 二级 | 36rpx | 600 | --text-main | 模块标题（继续观看/热门角色/最近观看） |
| 三级 | 26rpx | 600/400 | --text-main | 电影名、角色名 |
| 辅助 | 24/22rpx | 400 | --text-sub/--text-weak | Phase、进度、阵营、片名 |

---

## 六、wxml 改动要点

### 6.1 品牌区：增加背景图容器

```xml
<!-- 新增：品牌区背景 -->
<view class="brand-hero">
  <image class="brand-bg" src="{{bgImage}}" mode="aspectFill" />
  <view class="brand-hero-overlay"></view>
  <view class="brand-hero-content">
    <view class="brand-mark"></view>
    <view class="brand-text">
      <view class="brand-title">MCU观影导航</view>
      <view class="brand-sub">你的漫威宇宙旅程</view>
    </view>
  </view>
</view>
```

### 6.2 Hero Card：增加海报图片

```xml
<!-- 修改：继续观看卡增加海报 -->
<view class="continue-body">
  <image class="continue-poster" src="{{continueCard.posterUrl}}" mode="aspectFill" />
  <view class="continue-meta">
    <!-- 原有内容不变 -->
  </view>
</view>
```

### 6.3 快捷入口：从纵向三行改为横向四列

```xml
<!-- 修改：快捷入口改为 4 列横排 -->
<view class="quick-entries">
  <view class="quick-entry" wx:for="{{quickEntries}}" ...>
    <view class="quick-ic">{{item.glyph}}</view>
    <view class="quick-label">{{item.title}}</view>
  </view>
</view>
```

### 6.4 热门角色：头像改为 image

```xml
<!-- 修改：角色头像从色块改为 image -->
<image class="char-avatar" src="{{item.avatarUrl}}" mode="aspectFill" />
```

### 6.5 最近观看：海报改为 image

```xml
<!-- 修改：海报从色块改为 image -->
<image class="recent-poster" src="{{item.posterUrl}}" mode="aspectFill" />
```

---

## 七、js 改动要点

### 7.1 数据源：visuals.js

```javascript
const visuals = require('../../data/visuals.js');

// 在 data 组装时获取图片 URL
const posterUrl = visuals.poster(movieId);
const avatarUrl = visuals.character(charId);
const bgImage = visuals.background('home');
```

### 7.2 各模块图片数据注入

- continueCard 增加 posterUrl 字段
- hotChars 每项增加 avatarUrl 字段
- recent 每项增加 posterUrl 字段
- 增加 bgImage 字段

---

## 八、开发实现优先级

| 优先级 | 任务 | 效果 |
|--------|------|------|
| P0 | 59 张海报就位 + 海报 image 替换 | 电影详情/最近观看/继续观看立刻"活"起来 |
| P0 | 24 张角色头像就位 + 头像 image 替换 | 热门角色/角色图鉴/角色详情立刻"活"起来 |
| P1 | 首页背景图 + 品牌区改造 | 首页氛围大幅提升 |
| P1 | Hero Card 改为水平布局（海报+信息） | 首页焦点更明确 |
| P2 | 快捷入口改为横向四列 | 导航更直观 |
| P2 | 角色卡底部合并 + 阵营标签 | 信息更精简 |

---

## 九、验收标准

1. **图片就位**：海报位、头像位全部显示真实图片
2. **氛围感**：首页顶部有背景图，打开即感受到 MCU 氛围
3. **加载体验**：图片加载中不空白（阶段色渐变兜底）
4. **降级兜底**：图片加载失败时优雅降级，不显示 broken icon
5. **层级清晰**：海报/头像成为视觉焦点，文字有序退后
6. **性能正常**：图片 lazy-load，首屏不卡顿
