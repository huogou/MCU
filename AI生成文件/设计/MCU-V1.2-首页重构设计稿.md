# MCU V1.2 首页重构设计稿

> 版本：V1.2-DS · 2026-08-25
> 依据：《MCU V1.2 Design System》+ GPT《V1.2 UI重构任务》
> 状态：待策划AI（GPT）审核
> 效力：首页视觉实现的唯一标准，替代此前所有首页设计文档

---

## 一、设计理念

首页不是功能入口列表。

首页是 **"我的 MCU 宇宙入口"** —— 用户打开的第一秒就应该感受到：

- 我在漫威宇宙里
- 我知道自己看到哪了
- 我知道下一步看什么
- 我可以探索更多

---

## 二、页面结构

```
┌──────────────────────────────────────┐
│                                      │
│  ① MCU 旅程进度卡                    │  ← 核心身份感
│     "我的 MCU 旅程 · 18/59"          │
│     当前电影海报 + Phase              │
│                                      │
│  ② 推荐下一部（大卡）                │  ← 核心行动点
│     大电影海报 + 片名 + 理由 + CTA    │
│                                      │
│  ③ 宇宙入口（3 个视觉卡片）          │  ← 探索导航
│     时间线 / 角色图鉴 / 关系探索      │
│                                      │
│  ④ 热门角色（横向滚动）              │  ← 角色吸引力
│     真实头像 + 名字 + 阵营            │
│                                      │
│  ⑤ 最近观看（横向滚动）              │  ← 历史记录
│     真实海报 + 片名                   │
│                                      │
└──────────────────────────────────────┘
```

模块数量：5 个。结构自上而下，wxml 整体框架调整（模块①②重构，③④⑤保留结构）。

---

## 三、各模块精确规格

### ① MCU 旅程进度卡

这是首页的"身份锚点"——告诉用户"你在 MCU 的位置"。

```
╔════════════════════════════════════════╗
║  [宇宙背景图 叠加渐变]                  ║
║                                        ║
║  我的 MCU 旅程           ← 24rpx/sub   ║
║                                        ║
║  18 / 59                 ← 56rpx/700   ║
║  Phase 1 · 无限传奇      ← 24rpx/weak  ║
║                                        ║
║  ┌──────┐  钢铁侠                     ║
║  │[海报] │  Iron Man                  ║
║  │120×  │  Phase 1 · 2008             ║
║  │ 180  │  ● 当前观看                 ║
║  └──────┘                              ║
╚════════════════════════════════════════╝
```

**新人态**：
- 进度：0 / 59
- Phase：Phase 1
- 当前电影：钢铁侠（海报 + 信息）
- 状态标签：准备开始

| 元素 | 规格 |
|------|------|
| 卡片 | 背景 linear-gradient(135deg, --surface-0, --surface-1) |
| | 圆角 32rpx，padding 36rpx |
| | border 1rpx --surface-3 |
| 顶部背景 | 叠加宇宙背景图（高度 200rpx），底部渐变至 --surface-1 |
| "我的 MCU 旅程" | 24rpx / 400 / --text-sub，letter-spacing 2rpx |
| 进度数字 | 56rpx / 700 / --gold，行高 1.2 |
| | 格式："{已看} / {总数}" |
| Phase 信息 | 24rpx / 400 / --text-weak，margin-top 8rpx |
| 当前电影区 | 水平布局：海报左（120×180rpx）+ 信息右 |
| 电影名 | 28rpx / 600 / --text-main |
| 英文名 | 22rpx / 400 / --text-sub，margin-top 4rpx |
| Phase + 年份 | 22rpx / 400 / --text-weak，margin-top 8rpx |
| 状态标签 | 22rpx / 600 / --gold，胶囊背景 --gold-a10 |
| 卡片底部间距 | margin-bottom 56rpx（--space-xl） |

### ② 推荐下一部（大卡）

全页核心行动点。用户看到这张卡就知道"下一步做什么"。

```
╔════════════════════════════════════════╗
║                                        ║
║  ┌──────────────────────────────────┐  ║
║  │                                  │  ║
║  │  [电影海报 全宽 686×360]         │  ║  ← 大海报，视觉冲击
║  │                                  │  ║
║  │  ┌────────────────────────────┐  │  ║
║  │  │ 推荐下一部     Phase 2     │  │  ║  ← 叠在海报底部
║  │  │                            │  │  ║
║  │  │ 复仇者联盟                 │  │  ║  ← 36rpx/700
║  │  │ 无限传奇 · 2012            │  │  ║  ← 24rpx
║  │  │                            │  │  ║
║  │  │ "上一部结尾留下了悬念..."  │  │  ║  ← 24rpx/sub 理由
║  │  │                            │  │  ║
║  │  │ ┌──────────────────────┐   │  │  ║
║  │  │ │     开始观看          │   │  │  ║  ← 金色 CTA
║  │  │ └──────────────────────┘   │  │  ║
║  │  └────────────────────────────┘  │  ║
║  └──────────────────────────────────┘  ║
║                                        ║
╚════════════════════════════════════════╝
```

| 元素 | 规格 |
|------|------|
| 大卡 | 背景 --surface-1，圆角 32rpx，overflow hidden |
| | box-shadow: --shadow-hero |
| 海报区 | 全宽（686rpx），高 360rpx |
| | image mode="aspectFill"，阶段色渐变兜底 |
| | 底部叠加渐变：transparent → --surface-1（让文字可读） |
| "推荐下一部"标签 | 22rpx / 600 / --gold，letter-spacing 2rpx |
| Phase 标签 | 22rpx / 400 / --text-weak，float right |
| 电影名 | 36rpx / 700 / --text-main，margin-top 8rpx |
| 副信息 | 24rpx / 400 / --text-sub，margin-top 6rpx |
| 推荐理由 | 24rpx / 400 / --text-sub，line-height 1.5 |
| | margin-top 16rpx，最多 2 行截断 |
| CTA 按钮 | 全宽（卡内），高 88rpx，圆角 16rpx |
| | --gold 底，28rpx / 600 / --gold-btn-text |
| | box-shadow: --glow-gold |
| | margin-top 28rpx |
| 信息区 padding | 28rpx |
| 卡片底部间距 | margin-bottom 56rpx |

**新人态**：推荐钢铁侠，理由="MCU 的起点，一切从这里开始"
**老用户态**：推荐下一部未看，理由来自 recommend.js

### ③ 宇宙入口（3 个视觉卡片）

三个入口让用户探索 MCU 的不同维度。

```
  ┌────────────┐ ┌────────────┐ ┌────────────┐
  │            │ │            │ │            │
  │ [阶段代表图]│ │ [角色群像] │ │ [关系网络] │
  │  或阶段色   │ │  或阵营色   │ │  或宇宙色   │
  │  渐变背景   │ │  渐变背景   │ │  渐变背景   │
  │            │ │            │ │            │
  │  ◷         │ │  ✦         │ │  ⬡         │
  │  宇宙时间线 │ │  角色图鉴   │ │  关系探索   │
  └────────────┘ └────────────┘ └────────────┘
```

| 元素 | 规格 |
|------|------|
| 布局 | 3 列等宽 flex，间距 16rpx |
| 每个卡片 | 高度 200rpx，圆角 20rpx，overflow hidden |
| | position relative |
| 背景 | 每张卡片有独立氛围色：|
| | 时间线 → linear-gradient(135deg, --p1-a20, --surface-2) |
| | 角色 → linear-gradient(135deg, --accent-red-a10, --surface-2) |
| | 关系 → linear-gradient(135deg, --accent-purple-a10, --surface-2) |
| 图标 | 48rpx 容器，图标色 --gold，位于卡片左上区域 |
| | 暂用 Unicode 占位（◷ ✦ ⬡），待 SVG 替换 |
| 标题 | 24rpx / 600 / --text-main，位于卡片底部 |
| | padding 16rpx 20rpx |
| 底部渐变 | linear-gradient(to top, rgba(8,11,18,0.8), transparent) |
| | 保证标题可读 |
| hover 态 | border 1rpx --gold-a20 |
| 模块间距 | margin-bottom 56rpx |

### ④ 热门角色（横向滚动）

```
  热门角色                ← 36rpx/600/main

  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐
  │[头像]│ │[头像]│ │[头像]│ │[头像]│    ← 真实照片 96rpx
  │      │ │      │ │      │ │      │       圆形 + 阵营色描边
  ├──────┤ ├──────┤ ├──────┤ ├──────┤
  │钢铁侠│ │ 美队 │ │ 雷神 │ │蜘蛛侠│    ← 28rpx/600
  │复仇者│ │复仇者│ │阿斯加│ │复仇者│    ← 22rpx/阵营色
  └──────┘ └──────┘ └──────┘ └──────┘
    168rpx     横向滚动
```

| 元素 | 规格 |
|------|------|
| "热门角色"标题 | 36rpx / 600 / --text-main，margin-bottom 28rpx |
| 卡片 | 宽 168rpx，背景 --surface-2，圆角 16rpx |
| | padding 24rpx 16rpx，align-items center |
| | 间距 20rpx |
| 头像 | 96rpx 圆形，真实角色照片 |
| | 阵营色 3rpx 半透明描边 |
| | 兜底：阵营色渐变 + 首字 |
| 角色名 | 28rpx / 600 / --text-main，margin-top 16rpx |
| 阵营标签 | 22rpx / 400 / 阵营色，margin-top 6rpx |
| hover 态 | border 1rpx --gold-a20 |

### ⑤ 最近观看（横向滚动）

```
  最近观看                ← 36rpx/600/main

  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐
  │[海报]│ │[海报]│ │[海报]│ │[海报]│    ← 真实海报 120×160
  └─────┘ └─────┘ └─────┘ └─────┘
  钢铁侠   美队    雷神    银护        ← 24rpx
          横向滚动
```

| 元素 | 规格 |
|------|------|
| "最近观看"标题 | 36rpx / 600 / --text-main，margin-bottom 28rpx |
| 海报 | 120×160rpx，圆角 12rpx，真实海报 |
| | 兜底：阶段色渐变 + 首字 |
| 间距 | 24rpx |
| 片名 | 24rpx / 400 / --text-sub，margin-top 16rpx |
| | max-width 120rpx，text-overflow ellipsis |
| 空态 | "还没有观看记录，从《钢铁侠》开始你的旅程" |
| | 28rpx / --text-weak，padding 56rpx 0 居中 |

---

## 四、视觉层级总览

| 层级 | 字号 | 字重 | 颜色 | 首页元素 |
|------|------|------|------|---------|
| 一级 | 56rpx | 700 | --gold | 进度数字（18/59） |
| 二级 | 36rpx | 600 | --text-main | 模块标题、推荐电影名 |
| 三级 | 28rpx | 600/400 | --text-main | 当前电影名、角色名、按钮文字 |
| 辅助 | 24/22rpx | 400 | --text-sub/--text-weak | Phase、阵营、理由、片名 |

注意：进度数字用 56rpx + --gold 是首页的视觉焦点——"我在 MCU 的位置"。

---

## 五、wxml 改动要点

### 5.1 模块①重构：旅程进度卡

```xml
<!-- 替换原 brand-area + continue-card 为新的旅程进度卡 -->
<view class="journey-card">
  <view class="journey-bg">
    <image class="journey-bg-img" src="{{bgImage}}" mode="aspectFill" />
    <view class="journey-bg-overlay"></view>
  </view>
  <view class="journey-label">我的 MCU 旅程</view>
  <view class="journey-progress">
    <text class="journey-count">{{watchedCount}}</text>
    <text class="journey-total"> / {{totalCount}}</text>
  </view>
  <view class="journey-phase">{{phaseText}}</view>
  <view class="journey-current" data-id="{{currentMovie.id}}" bindtap="goMovie">
    <image class="journey-poster" src="{{currentMovie.posterUrl}}" mode="aspectFill" />
    <view class="journey-info">
      <view class="journey-movie-name">{{currentMovie.cn}}</view>
      <view class="journey-movie-en">{{currentMovie.en}}</view>
      <view class="journey-movie-phase">{{currentMovie.phaseText}}</view>
      <view class="journey-status">{{currentMovie.statusLabel}}</view>
    </view>
  </view>
</view>
```

### 5.2 模块②重构：推荐下一部大卡

```xml
<!-- 替换原 my-route 为推荐大卡 -->
<view class="rec-card" data-id="{{recommend.movieId}}" bindtap="goMovie">
  <image class="rec-poster" src="{{recommend.posterUrl}}" mode="aspectFill" />
  <view class="rec-poster-overlay"></view>
  <view class="rec-body">
    <view class="rec-header">
      <text class="rec-label">推荐下一部</text>
      <text class="rec-phase">{{recommend.phaseText}}</text>
    </view>
    <view class="rec-title">{{recommend.cn}}</view>
    <view class="rec-sub">{{recommend.subText}}</view>
    <view class="rec-reason">{{recommend.reason}}</view>
    <view class="mcu-btn-primary rec-btn">{{recommend.buttonText}}</view>
  </view>
</view>
```

### 5.3 模块③：宇宙入口改为 3 列视觉卡

```xml
<!-- 替换原纵向三行探索入口为横向三列 -->
<view class="explore-entries">
  <view class="explore-entry entry-timeline" data-key="timeline" bindtap="goExplore">
    <view class="entry-icon">◷</view>
    <view class="entry-title">宇宙时间线</view>
  </view>
  <view class="explore-entry entry-characters" data-key="characters" bindtap="goExplore">
    <view class="entry-icon">✦</view>
    <view class="entry-title">角色图鉴</view>
  </view>
  <view class="explore-entry entry-relation" data-key="relation" bindtap="goExplore">
    <view class="entry-icon">⬡</view>
    <view class="entry-title">关系探索</view>
  </view>
</view>
```

### 5.4 模块④⑤：保留结构，替换图片

- 热门角色：char-avatar 从色块 div 改为 `<image>` 组件
- 最近观看：recent-poster 从色块 div 改为 `<image>` 组件
- 结构不变，只改图片渲染方式

---

## 六、js 改动要点

### 6.1 新增数据字段

```javascript
// 旅程进度卡
journeyCard: {
  watchedCount: 18,
  totalCount: 59,
  phaseText: 'Phase 1 · 无限传奇',
  currentMovie: {
    id: 'iron-man',
    cn: '钢铁侠',
    en: 'Iron Man',
    phaseText: 'Phase 1 · 2008',
    statusLabel: '当前观看',
    posterUrl: '' // 从 visuals.js 获取
  }
}

// 推荐大卡
recommend: {
  movieId: 'avengers',
  cn: '复仇者联盟',
  phaseText: 'Phase 1',
  subText: '无限传奇 · 2012',
  reason: '上一部结尾留下了悬念，这部将揭晓答案',
  buttonText: '开始观看',
  posterUrl: '' // 从 visuals.js 获取
}
```

### 6.2 visuals.js 对接

```javascript
const visuals = require('../../data/visuals.js');
// 在 refresh() 中注入图片 URL
posterUrl: visuals.poster(movieId)
```

---

## 七、验收标准

1. **旅程感**：首页顶部进度数字醒目（金色 56rpx），用户一眼看到"我在 MCU 的位置"
2. **行动明确**：推荐大卡是全页视觉焦点，海报大且有冲击力，CTA 引导清晰
3. **探索吸引**：三个入口卡片有各自氛围色，不像无聊的列表
4. **图片就位**：所有海报/头像显示真实图片，不显示色块首字
5. **降级优雅**：图片加载中/失败时阶段色渐变兜底
6. **层级清晰**：进度数字（一级56rpx）> 模块标题（二级36rpx）> 电影名（三级28rpx）> 描述（辅助24/22rpx）
7. **双态正确**：新人态和老用户态显示不同内容
