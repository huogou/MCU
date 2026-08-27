# MCU V1.2 Visual Design System

> 设计 AI：QoderWork CN · 2026-08-26
> 状态：待策划 AI（GPT）确认 → 开发 AI（Work）执行
> 定位：从"信息展示工具"→"漫威粉丝愿意收藏和分享的宇宙探索产品"

---

## 一、总体评估

### 1.1 已完成

| 维度 | 状态 | 说明 |
|------|------|------|
| 设计 Token 体系 | ✅ | 75+ CSS 变量（颜色/字号/间距/圆角/阴影），app.wxss 全局唯一来源 |
| 38 部电影海报 + 剧照 | ✅ | CDN 托管，visuals.js 统一接入 |
| 24 位角色头像 | ✅ | 本地 assets/avatars/，真实图片已点亮 3 页 |
| 1 张首页背景 + 6 阶段图 | ✅ | 本地 assets/backgrounds/ + assets/phases/ |
| 电影详情页 Hero 区 | ✅ | 海报 + 阶段色 + 标题 + 观看状态（GPT 要求的完整组合） |
| 角色详情页 | ✅ | 真实头像 + 阵营渐变 + 简介 + 关联作品 + 关联角色 |
| 全局 Token 化 | ✅ | 12 页 930 处 var()，零裸 hex / 零 500 / 零 800 |

### 1.2 本次需解决

| 维度 | GPT 要求 | 当前差距 | 本方案解法 |
|------|----------|----------|------------|
| 首页 Hero 区 | "MCU 世界入口视觉，第一眼感受到这是漫威工具" | 旅程卡有背景图但不够震撼 | 新增沉浸式 Hero Banner + 重构旅程卡为"宇宙门户" |
| 功能入口卡片 | "视觉卡片：Icon + 背景 + 图形元素" | 3 列文字按钮 + Unicode 占位 | 2×2 视觉卡片网格，真实背景图 + CSS 图标 |
| 电影资源 | "背景图 / 阶段封面 / 禁止色块+字" | 海报已有，stills 未充分利用 | Hero 区接入 stills 作为背景氛围图 |
| 角色体系 | "头像 + 阵营色 + 简介 + 关联作品" | 已基本完成 | 增强 Hero 区视觉冲击力（更大头像 + 全宽阵营色带） |
| 关系探索 | "节点 / 头像 / 关系线 / 点击展开" | 仍是 V1.1 入口聚合页 | 全新关系网络可视化页面 |

### 1.3 资源预算

| 类别 | 数量 | 尺寸 | 预估大小 | 存储位置 |
|------|------|------|----------|----------|
| 已有头像 | 24 | 300×300 | ~720KB | local |
| 已有首页背景 | 1 | 750×500 | ~150KB | local |
| 已有阶段图 | 6 | 750×400 | ~600KB | local |
| **新增 Hero Banner** | 1 | 750×420 | ~150KB | local |
| **新增入口卡片背景** | 4 | 400×300 | ~400KB | local |
| 海报（CDN） | 38 | — | 0 (CDN) | CDN |
| 剧照（CDN） | 38 | — | 0 (CDN) | CDN |
| **本地总计** | ~74 文件 | | **~2.0MB** | 接近 2MB 上限 |

> 注意：本地资源已达 2MB 主包上限。建议将头像 + 背景图上传 CDN，
> 仅需修改 visuals.js 的 `LOCAL` 常量即可一键切换。

---

## 二、首页视觉重构（Step 1）

### 2.1 整体结构（自上而下）

```
┌──────────────────────────────────┐
│  ① MCU Hero Banner（新增）       │  ← 沉浸式宇宙入口
│     背景：hero-banner.jpg        │
│     叠加：标题 + 副标题 + 光效   │
├──────────────────────────────────┤
│  ② 旅程进度卡（重构）            │  ← 紧凑化，嵌入 Hero 下方
│     进度数字 + 当前电影 + CTA    │
├──────────────────────────────────┤
│  ③ 推荐下一部大卡                │  ← 保持不变
├──────────────────────────────────┤
│  ④ 功能入口 2×2 网格（重设计）   │  ← 从 3 列文字 → 2×2 视觉卡片
│     开始观看 / 时间线 /          │
│     角色图鉴 / 关系探索           │
├──────────────────────────────────┤
│  ⑤ 热门角色横滚                  │  ← 保持不变
├──────────────────────────────────┤
│  ⑥ 最近观看横滚                  │  ← 保持不变
└──────────────────────────────────┘
```

### 2.2 ① MCU Hero Banner（新增模块）

**设计目标**：用户打开小程序的第一眼，就感受到"这是漫威宇宙"。

**视觉规格**：

| 属性 | 值 |
|------|-----|
| 宽度 | 750rpx（满宽，突破页边距） |
| 高度 | 420rpx |
| 背景图 | hero-banner.jpg（宇宙门户 + 金色能量 + 星云） |
| 图片模式 | aspectFill，锚点 center |
| 叠加层 1 | 底部渐变：linear-gradient(to top, var(--bg) 0%, transparent 60%) |
| 叠加层 2 | 整体暗化：rgba(8,11,18,0.3) |
| 圆角 | 底部 0，顶部 0（满宽沉浸） |

**内容层**：

```
┌──────────────────────────────────────┐
│                                      │
│    MCU 宇宙入口          ← 金色小标签 │
│                                      │
│    探索无限传奇          ← Display 白色 │
│    59 部 · 24 角色 · 6 阶段 ← Caption │
│                                      │
│  ╔══════════════════════════════╗    │
│  ║  旅程 12/59 · 钢铁侠 ▶     ║    │  ← 迷你旅程条
│  ╚══════════════════════════════╝    │
│                                      │
└──────────────────────────────────────┘
```

**CSS 规格**：

```css
/* Hero Banner */
.hero-banner {
  position: relative;
  width: 100%;
  height: 420rpx;
  overflow: hidden;
}
.hero-banner-bg {
  position: absolute;
  top: 0; left: 0;
  width: 100%; height: 100%;
}
.hero-banner-overlay {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: linear-gradient(
    to bottom,
    rgba(8,11,18,0.2) 0%,
    rgba(8,11,18,0.1) 40%,
    rgba(8,11,18,0.7) 80%,
    var(--bg) 100%
  );
}
.hero-banner-content {
  position: absolute;
  bottom: 0; left: 0; right: 0;
  padding: 0 var(--page-x) var(--space-lg);
}
.hero-banner-tag {
  font-size: var(--fs-mini);
  font-weight: 600;
  color: var(--gold);
  letter-spacing: 4rpx;
  margin-bottom: var(--space-xs);
}
.hero-banner-title {
  font-size: var(--fs-display);
  font-weight: 700;
  color: var(--white);
  line-height: 1.2;
}
.hero-banner-sub {
  font-size: var(--fs-caption);
  color: var(--text-sub);
  margin-top: var(--space-xs);
}
/* 迷你旅程条 */
.hero-journey-bar {
  display: flex;
  align-items: center;
  background: var(--surface-1-a80);
  border: 1rpx solid var(--surface-3);
  border-radius: var(--radius-full);
  padding: 8rpx 20rpx;
  margin-top: var(--space-md);
}
.hero-journey-progress {
  flex: 1;
  height: 6rpx;
  background: var(--surface-3);
  border-radius: var(--radius-full);
  margin-right: var(--space-sm);
  overflow: hidden;
}
.hero-journey-fill {
  height: 100%;
  background: var(--gold);
  border-radius: var(--radius-full);
}
.hero-journey-text {
  font-size: var(--fs-mini);
  color: var(--gold);
  font-weight: 600;
  white-space: nowrap;
}
```

**WXML 结构**：

```xml
<view class="hero-banner">
  <image class="hero-banner-bg" src="{{heroBanner}}" mode="aspectFill" lazy-load="true"/>
  <view class="hero-banner-overlay"></view>
  <view class="hero-banner-content">
    <view class="hero-banner-tag">MCU 宇宙入口</view>
    <view class="hero-banner-title">探索无限传奇</view>
    <view class="hero-banner-sub">{{totalMovies}} 部 · {{totalChars}} 角色 · {{totalPhases}} 阶段</view>
    <view class="hero-journey-bar" bindtap="goJourney">
      <view class="hero-journey-progress">
        <view class="hero-journey-fill" style="width:{{progressPercent}}%"></view>
      </view>
      <view class="hero-journey-text">{{progress.count}}/{{progress.total}}</view>
    </view>
  </view>
</view>
```

**与现有旅程卡的关系**：

Hero Banner 吸收了原旅程进度卡的核心信息（进度数字 + 当前电影），
原旅程进度卡 **保留但简化** 为"当前电影推荐卡"——展示当前正在看的电影的海报 + 继续观看 CTA。
如果用户没有进度（新用户），则展示"从钢铁侠开始"的推荐。

简化后的旅程卡不再需要背景图，变为一个紧凑的电影推荐卡片。

### 2.3 ④ 功能入口 2×2 视觉卡片（重设计）

**设计目标**：从文字按钮升级为视觉卡片，每个入口有自己的视觉身份。

**布局**：

```
┌─────────────────┬─────────────────┐
│  开始观看        │  宇宙时间线      │
│  [entry-watch]  │  [entry-timeline]│
│  38部 · 按序排列 │  6阶段 · 脉络清晰│
├─────────────────┼─────────────────┤
│  角色图鉴        │  关系探索        │
│  [entry-chars]  │  [entry-rels]   │
│  24位 · 阵营关系 │  92条 · 网络图谱│
└─────────────────┴─────────────────┘
```

**卡片规格**：

| 属性 | 值 |
|------|-----|
| 宽度 | calc((100% - var(--space-sm)) / 2) |
| 高度 | 240rpx |
| 圆角 | var(--radius-lg) 20rpx |
| 背景图 | 4 张独立图片 |
| 叠加层 | linear-gradient(135deg, rgba(8,11,18,0.7), rgba(8,11,18,0.4)) |
| 间距 | gap: var(--space-sm) |

**每张卡片结构**：

```xml
<view class="entry-visual-card" data-route="{{item.route}}" bindtap="onEntryTap">
  <image class="evc-bg" src="{{item.bg}}" mode="aspectFill" lazy-load="true"/>
  <view class="evc-overlay"></view>
  <view class="evc-content">
    <view class="evc-icon">{{item.icon}}</view>
    <view class="evc-title">{{item.title}}</view>
    <view class="evc-desc">{{item.desc}}</view>
  </view>
</view>
```

**4 张卡片数据**：

```javascript
const ENTRY_CARDS = [
  {
    route: '/pages/routes/routes',
    bg: '/assets/entries/entry-watch.jpg',
    icon: '▶',           // CSS 绘制播放图标
    title: '开始观看',
    desc: '38 部 · 按序排列'
  },
  {
    route: '/pages/timeline/timeline',
    bg: '/assets/entries/entry-timeline.jpg',
    icon: '◷',           // CSS 绘制时钟图标
    title: '宇宙时间线',
    desc: '6 阶段 · 脉络清晰'
  },
  {
    route: '/pages/characters/characters',
    bg: '/assets/entries/entry-characters.jpg',
    icon: '✦',           // CSS 绘制人物图标
    title: '角色图鉴',
    desc: '24 位 · 阵营关系'
  },
  {
    route: '/pages/explore/explore',
    bg: '/assets/entries/entry-relationships.jpg',
    icon: '⬡',           // CSS 绘制网络图标
    title: '关系探索',
    desc: '92 条 · 网络图谱'
  }
];
```

**CSS 规格**：

```css
/* 功能入口 2×2 网格 */
.entry-grid {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-sm);
  margin-bottom: var(--space-xl);
}
.entry-visual-card {
  width: calc((100% - var(--space-sm)) / 2);
  height: 240rpx;
  border-radius: var(--radius-lg);
  overflow: hidden;
  position: relative;
}
.evc-bg {
  position: absolute;
  top: 0; left: 0;
  width: 100%; height: 100%;
}
.evc-overlay {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: linear-gradient(
    135deg,
    rgba(8,11,18,0.75) 0%,
    rgba(8,11,18,0.45) 100%
  );
}
.evc-content {
  position: relative;
  height: 100%;
  padding: var(--space-md);
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
}
.evc-icon {
  width: 56rpx;
  height: 56rpx;
  border-radius: var(--radius-md);
  background: var(--gold-a15);
  color: var(--gold);
  font-size: 32rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: var(--space-sm);
}
.evc-title {
  font-size: var(--fs-title);
  font-weight: 700;
  color: var(--white);
  line-height: 1.2;
}
.evc-desc {
  font-size: var(--fs-mini);
  color: var(--text-sub);
  margin-top: 4rpx;
}
```

### 2.4 首页完整模块顺序（刷新后）

| 序号 | 模块 | 变化 | 说明 |
|------|------|------|------|
| ① | Hero Banner | **新增** | 沉浸式宇宙入口，hero-banner.jpg |
| ② | 旅程/推荐卡 | 简化 | 去掉背景图，变为紧凑电影推荐 |
| ③ | 功能入口 | **重设计** | 3列文字 → 2×2 视觉卡片 |
| ④ | 热门角色 | 保持 | 已有真实头像 |
| ⑤ | 最近观看 | 保持 | 已有海报 |

---

## 三、电影资源体系（Step 2）

### 3.1 当前状态

电影详情页已具备 GPT 要求的大部分元素：

| 元素 | 状态 | 来源 |
|------|------|------|
| 官方风格海报 | ✅ | 38 张 CDN 海报，visuals.js 接入 |
| 标题 + 阶段 | ✅ | Hero 区完整展示 |
| 观看状态 | ✅ | 已看/在看/未看三态 |
| 主要角色 | ✅ | 4 位真实头像 |
| 观影位置 | ✅ | 前后关联卡片 |

### 3.2 需增强：背景氛围图

**问题**：Hero 区当前使用 CSS 渐变作为背景，缺少电影专属的氛围感。

**解法**：将 stills（剧照）作为 Hero 区背景氛围图。

```css
/* movie Hero 区背景增强 */
.movie-hero {
  position: relative;
  min-height: 480rpx;
}
.movie-hero-bg {
  position: absolute;
  top: 0; left: 0;
  width: 100%; height: 100%;
}
/* 如果 stills 存在，使用剧照作为背景 */
.movie-hero-bg-img {
  width: 100%; height: 100%;
  opacity: 0.25;
  filter: blur(8rpx);
}
/* 叠加渐变保证文字可读 */
.movie-hero-overlay {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: linear-gradient(
    to bottom,
    rgba(8,11,18,0.4) 0%,
    rgba(8,11,18,0.8) 60%,
    var(--bg) 100%
  );
}
```

**WXML 变更**：

```xml
<view class="movie-hero">
  <!-- 新增：背景氛围图 -->
  <view class="movie-hero-bg">
    <image wx:if="{{backdropImg}}" class="movie-hero-bg-img"
           src="{{backdropImg}}" mode="aspectFill" lazy-load="true"/>
  </view>
  <view class="movie-hero-overlay"></view>

  <!-- 原有内容保持不变 -->
  <view class="hero-content">
    <view class="poster ...">...</view>
    <view class="hero-info">...</view>
  </view>
</view>
```

**数据来源**：visuals.js 的 `visual(id).backdrop` 已返回 stills URL，
只需在 movie.js 中取出并传入 data 即可。

### 3.3 阶段封面

6 张阶段代表图已生成（assets/phases/phase-{1-6}.jpg），
可在时间线页面、旅程卡、推荐卡中作为阶段标识使用。

**推荐卡中的阶段标识**：

```xml
<view class="rec-phase-badge">
  <image wx:if="{{phaseImg}}" class="rec-phase-img"
         src="{{phaseImg}}" mode="aspectFill"/>
  <text wx:else class="rec-phase-text">P{{phase}}</text>
</view>
```

### 3.4 "禁止色块+字"验收标准

GPT 明确要求：**禁止出现"一个色块 + 一个字"的降级展示**。

当前兜底逻辑（G-18/G-19）在资源缺失时使用阶段色渐变 + 首字。
这在开发阶段是合理的，但上线前应确保：

1. 所有海报 URL 可访问（CDN 验证）
2. 所有角色头像可访问（本地或 CDN 验证）
3. 如果仍有资源加载失败，兜底方案应在视觉上尽量接近正常态

**建议**：保留兜底逻辑作为安全网，但在验收阶段逐一确认所有资源可加载。

---

## 四、角色体系优化（Step 3）

### 4.1 当前状态

角色详情页已基本满足 GPT 要求：

| 元素 | 状态 | 说明 |
|------|------|------|
| 角色头像 | ✅ | 24 张真实头像，character.wxml 已接入 |
| 阵营颜色 | ✅ | hero-{faction} 渐变背景 + 阵营胶囊标签 |
| 简介 | ✅ | char.note 展示 |
| 关联作品 | ✅ | films 列表 + 海报 + 观看状态 |
| 关联角色 | ✅ | related 网格 + 头像 + 共同出演数 |

### 4.2 增强方向

**4.2.1 Hero 区视觉增强**

当前 Hero 区是居中的头像 + 名字 + 阵营标签。
增强为更大、更有冲击力的布局：

```
┌──────────────────────────────────┐
│  [阵营渐变背景 + 氛围光效]       │
│                                  │
│     ┌─────────┐                  │
│     │  头像    │  160×160rpx     │
│     │ (圆形)  │  阵营色边框      │
│     └─────────┘                  │
│                                  │
│   托尼·斯塔克 / 钢铁侠           │
│   Tony Stark                     │
│                                  │
│   [复仇者]  6 部关联作品          │
│                                  │
│   "MCU 的第一个主角..."          │  ← 简介直接展示
│                                  │
└──────────────────────────────────┘
```

**变更要点**：

| 属性 | 当前 | 增强后 |
|------|------|--------|
| 头像尺寸 | 128rpx | 160rpx |
| 边框宽度 | 4rpx | 6rpx |
| 简介位置 | 单独卡片内 | Hero 区直接展示 |
| 阵营氛围 | 简单渐变 | 渐变 + 径向光效 |

**CSS 变更**：

```css
/* Hero 区增强 */
.hero {
  padding: var(--space-xl) var(--page-x);
  position: relative;
  overflow: hidden;
}
/* 阵营氛围光效 */
.hero::before {
  content: '';
  position: absolute;
  top: -100rpx; right: -100rpx;
  width: 400rpx; height: 400rpx;
  border-radius: 50%;
  background: radial-gradient(
    circle,
    var(--faction-color-a10) 0%,
    transparent 70%
  );
  pointer-events: none;
}
.hero-avatar {
  width: 160rpx;
  height: 160rpx;
  border-width: 6rpx;
}
.hero-cn {
  font-size: var(--fs-display-sm);
  margin-top: var(--space-lg);
}
/* 简介直接展示 */
.hero-note {
  font-size: var(--fs-body);
  color: var(--text-sub);
  line-height: 1.7;
  margin-top: var(--space-md);
  text-align: left;
  max-width: 600rpx;
}
```

**4.2.2 阵营色映射（补充）**

当前阵营色映射已覆盖主要阵营：

| 阵营 | CSS class | 颜色 | 角色 |
|------|-----------|------|------|
| 复仇者 | red | #E85D5D | tony, steve, banner, bucky, sam, peter, wanda, vision, strange |
| 阿斯加德 | blue | #4A9EF5 | thor, loki |
| 神盾局 | blue | #4A9EF5 | natasha, clint, fury |
| 银护 | purple | #9B7FE8 | starlord, gamora |
| 瓦坎达 | gold | #F2B233 | tchalla |
| 反派 | gray | #555F73 | thanos |
| 街头 | red | #E85D5D | (待扩展) |
| 变种人 | purple | #9B7FE8 | (待扩展) |

**新增角色**（yelena, shangchi, wade, logan）的阵营映射：

```javascript
// characters.js 中补充
{ id: 'shangchi', camp: 'avengers', ... }   // 尚气 → 复仇者
{ id: 'yelena', camp: 'street', ... }        // 叶莲娜 → 街头
{ id: 'wade', camp: 'mutant', ... }          // 死侍 → 变种人
{ id: 'logan', camp: 'mutant', ... }         // 金刚狼 → 变种人
```

> 注意：characters.js 中标注"禁止修改数据"。
> 如需补充阵营信息，应由策划 AI（GPT）确认后修改。

---

## 五、关系探索页面（Step 4）

### 5.1 设计目标

从"入口聚合页"升级为"MCU 角色关系网络探索"。

**核心体验**：
- 用户看到一个以某角色为中心的**关系网络图**
- 每个节点是一个角色头像
- 节点之间的连线表示关系（颜色区分类型）
- 点击节点可以切换中心角色，继续探索
- 筛选 chips 过滤关系类型

### 5.2 页面结构

```
┌──────────────────────────────────┐
│  关系探索                   [?]  │  ← 标题 + 帮助按钮
├──────────────────────────────────┤
│  [全部][盟友][敌人][师徒][家人]  │  ← 关系类型筛选 chips
├──────────────────────────────────┤
│                                  │
│        [洛基]                    │
│       /  |  \                    │
│  [托尔]—✦—[灭霸]                │  ← 关系网络图
│      |    /  |                   │     (canvas 绘制)
│  [奥丁]  [奇异博士]              │
│                                  │
├──────────────────────────────────┤
│  关系列表（滚动）                 │
│  ┌──────────────────────────┐    │
│  │ [托尔] ←→ [洛基]        │    │
│  │ 兄弟 · 对手              │    │
│  │ 共同出演 6 部            │    │
│  └──────────────────────────┘    │
│  ┌──────────────────────────┐    │
│  │ [洛基] ←→ [灭霸]        │    │
│  │ 上下级 · 敌人            │    │
│  │ 共同出演 2 部            │    │
│  └──────────────────────────┘    │
└──────────────────────────────────┘
```

### 5.3 关系网络图（Canvas 实现）

**技术方案**：使用微信小程序 Canvas 2D API 绘制。

**布局算法**：力导向图（Force-Directed Graph）简化版。

```
中心节点：屏幕中央
一级关系：围绕中心的圆形分布
二级关系：更外圈（可选，初期可只展示一级）
```

**节点规格**：

| 属性 | 值 |
|------|-----|
| 中心节点半径 | 60rpx |
| 关系节点半径 | 44rpx |
| 节点内容 | 角色头像（圆形裁剪） |
| 节点边框 | 4rpx，阵营色 |
| 节点标签 | 角色名，fs-mini，白色 |

**连线规格**：

| 关系类型 | 颜色 | 线宽 |
|----------|------|------|
| 盟友 | var(--accent-blue) | 3rpx |
| 敌人 | var(--accent-red) | 3rpx |
| 师徒 | var(--gold) | 3rpx |
| 家人 | var(--accent-purple) | 3rpx |
| 对手 | var(--accent-red-a50) | 2rpx 虚线 |

**交互**：

1. **点击节点**：切换为该角色为中心，重新布局
2. **拖拽**：平移画布（初期可不实现）
3. **长按节点**：弹出角色快捷信息卡

**Canvas 尺寸**：

```css
.relation-canvas {
  width: 750rpx;
  height: 600rpx;
  background: var(--bg);
}
```

### 5.4 关系数据派生

**数据源**：characters.js + relationships.js（如存在）

**关系类型判定逻辑**：

```javascript
// 关系类型派生规则
function getRelationType(charA, charB) {
  // 1. 优先查预定义关系表（如有 relationships.js）
  if (predefined[charA.id + '-' + charB.id]) {
    return predefined[charA.id + '-' + charB.id];
  }
  // 2. 同阵营 = 盟友
  if (charA.camp === charB.camp) {
    return 'ally';
  }
  // 3. 不同阵营 = 无明确关系（不展示连线）
  return null;
}
```

**预定义特殊关系**（92 条来自 GPT 数据层）：

```javascript
const SPECIAL_RELATIONS = [
  { from: 'tony', to: 'peter', type: 'mentor', label: '师徒' },
  { from: 'tony', to: 'steve', type: 'rival', label: '对手' },
  { from: 'thor', to: 'loki', type: 'family', label: '兄弟' },
  { from: 'thor', to: 'odin', type: 'family', label: '父子' },
  { from: 'steve', to: 'bucky', type: 'family', label: '挚友' },
  { from: 'natasha', to: 'clint', type: 'family', label: '搭档' },
  { from: 'wanda', to: 'vision', type: 'family', label: '恋人' },
  { from: 'tony', to: 'thanos', type: 'enemy', label: '宿敌' },
  // ... 完整 92 条由策划 AI 提供
];
```

### 5.5 筛选 Chips

```css
.filter-chips {
  display: flex;
  gap: var(--space-sm);
  padding: var(--space-md) var(--page-x);
  overflow-x: auto;
  white-space: nowrap;
}
.filter-chip {
  font-size: var(--fs-caption);
  font-weight: 600;
  padding: 8rpx 24rpx;
  border-radius: var(--radius-full);
  background: var(--surface-2);
  color: var(--text-sub);
  border: 1rpx solid var(--surface-3);
}
.filter-chip.active {
  background: var(--chip-color-a15);
  color: var(--chip-color);
  border-color: var(--chip-color-a30);
}
```

**5 种筛选**：

| 筛选 | 颜色 | 展示关系 |
|------|------|----------|
| 全部 | 金色 | 所有连线 |
| 盟友 | 蓝色 | type = ally |
| 敌人 | 红色 | type = enemy |
| 师徒 | 金色 | type = mentor |
| 家人 | 紫色 | type = family |

### 5.6 关系列表（卡片式）

网络图下方展示当前筛选的关系列表：

```xml
<view class="relation-list">
  <view wx:for="{{filteredRelations}}" wx:key="id" class="relation-card">
    <view class="relation-pair">
      <view class="relation-avatar">
        <image src="{{item.fromAvatar}}" mode="aspectFill"/>
      </view>
      <view class="relation-line">
        <view class="relation-type-dot" style="background:{{item.typeColor}}"></view>
      </view>
      <view class="relation-avatar">
        <image src="{{item.toAvatar}}" mode="aspectFill"/>
      </view>
    </view>
    <view class="relation-info">
      <view class="relation-label">{{item.typeLabel}}</view>
      <view class="relation-shared">共同出演 {{item.sharedCount}} 部</view>
    </view>
  </view>
</view>
```

---

## 六、资源清单（新增部分）

### 6.1 本次新增资源

| 文件名 | 路径 | 尺寸 | 用途 | 状态 |
|--------|------|------|------|------|
| hero-banner.jpg | assets/hero/ | 750×420 | 首页 Hero 背景 | ✅ 已生成 |
| entry-watch.jpg | assets/entries/ | 400×300 | "开始观看"卡片背景 | ✅ 已生成 |
| entry-timeline.jpg | assets/entries/ | 400×300 | "时间线"卡片背景 | ✅ 已生成 |
| entry-characters.jpg | assets/entries/ | 400×300 | "角色图鉴"卡片背景 | ✅ 已生成 |
| entry-relationships.jpg | assets/entries/ | 400×300 | "关系探索"卡片背景 | ✅ 已生成 |

### 6.2 visuals.js 更新

```javascript
// 新增 Hero Banner
const heroBanner = LOCAL + '/hero/hero-banner.jpg';

// 新增入口卡片背景
const entryBgs = {
  watch: LOCAL + '/entries/entry-watch.jpg',
  timeline: LOCAL + '/entries/entry-timeline.jpg',
  characters: LOCAL + '/entries/entry-characters.jpg',
  relationships: LOCAL + '/entries/entry-relationships.jpg'
};

// 新增访问函数
function heroBannerUrl() { return heroBanner; }
function entryBg(key) { return (key && entryBgs[key]) ? entryBgs[key] : null; }

// 更新 module.exports
module.exports = {
  visual, avatar, phase, homeBg,
  heroBanner: heroBannerUrl, entryBg,
  posters, stills, avatars, phases, entryBgs
};
```

### 6.3 资源总量预算

| 类别 | 文件数 | 预估大小 |
|------|--------|----------|
| 头像 | 24 | ~720KB |
| 首页背景 | 1 | ~150KB |
| 阶段图 | 6 | ~600KB |
| Hero Banner | 1 | ~150KB |
| 入口卡片背景 | 4 | ~400KB |
| **本地总计** | **36** | **~2.0MB** |

> 已达 2MB 主包上限。强烈建议将本地资源上传 CDN，
> 仅需修改 visuals.js 的 `LOCAL` 常量：
> ```javascript
> const LOCAL = CDN + '/assets';  // 一行切换
> ```

---

## 七、开发执行顺序

### Phase 1：首页 Hero Banner + 入口卡片（~2hr）

1. visuals.js 新增 heroBanner / entryBg 映射
2. home.wxml 新增 Hero Banner 模块
3. home.wxss 新增 Hero Banner 样式
4. home.js 新增 heroBanner / entryCards 数据
5. home.wxml 替换 3 列宇宙入口为 2×2 视觉卡片
6. home.wxss 替换 .exp-row / .exp-card 为 .entry-grid / .entry-visual-card
7. 简化原旅程进度卡（去掉背景图，改为紧凑推荐）

### Phase 2：电影详情背景氛围图（~30min）

1. movie.js 从 visuals.visual(id).backdrop 取出剧照 URL
2. movie.wxml Hero 区新增背景图元素
3. movie.wxss 新增背景图 + 叠加层样式

### Phase 3：角色详情 Hero 增强（~30min）

1. character.wxss 增大头像尺寸 128→160rpx
2. character.wxml 将简介移至 Hero 区
3. character.wxss 新增阵营氛围光效

### Phase 4：关系探索页重做（~3-4hr）

1. explore.wxml 全新结构（筛选 chips + canvas + 关系列表）
2. explore.wxss 全新样式
3. explore.js 关系数据派生 + canvas 绘制逻辑
4. 交互：点击节点切换中心角色

### Phase 5：验收

1. 截图对比（前后对比）
2. 资源加载验证（所有图片可访问）
3. Token 一致性检查（零裸 hex / 零 500 / 零 800）
4. 设计 AI 验收 → 策划 AI 验收

---

## 八、验收标准

### 8.1 GPT 要求对照

| GPT 要求 | 验收标准 | 本方案覆盖 |
|----------|----------|------------|
| 首页 Hero 区 | 有沉浸式宇宙入口视觉 | ✅ Hero Banner + 光效 |
| 功能入口视觉化 | 每个入口有 Icon + 背景 + 图形元素 | ✅ 2×2 视觉卡片 |
| 电影海报 | 官方风格海报 | ✅ 38 张 CDN |
| 电影背景图 | 背景氛围图 | ✅ stills 作为 Hero 背景 |
| 阶段封面 | 阶段代表图 | ✅ 6 张阶段图 |
| 禁止色块+字 | 所有资源可加载 | ✅ 兜底 + CDN 验证 |
| 角色头像 | 真实头像 | ✅ 24 张 |
| 阵营颜色 | 阵营色区分 | ✅ 6 阵营色映射 |
| 角色简介 | 简介展示 | ✅ Hero 区直接展示 |
| 关联作品 | 作品列表 | ✅ films 列表 |
| 关系网络 | 节点 + 头像 + 关系线 | ✅ Canvas 网络图 |
| 点击展开 | 交互探索 | ✅ 点击节点切换中心 |

### 8.2 技术验收

- [ ] 零裸 hex（所有颜色引用 CSS 变量）
- [ ] 零 500 / 800 font-weight
- [ ] 所有间距使用 token（--space-*）
- [ ] 所有圆角使用 token（--radius-*）
- [ ] 所有图片经 visuals.js 访问（页面零硬编码）
- [ ] 本地资源 < 2MB（或已切换 CDN）
- [ ] Canvas 网络图在真机流畅运行（>30fps）

---

## 九、与上一轮交付的关系

| 上一轮交付 | 本轮处理 |
|------------|----------|
| MCU-V1.2-视觉资源补充规范.md | 本轮 §六 资源清单覆盖，新增 5 张资源 |
| MCU-V1.2-四页面视觉审查报告.md | 本轮 §1.2 差距分析覆盖 |
| MCU-V1.2-开发标注-视觉修正.md | 16 处非标间距修正仍然有效，本轮新增变更在此基础上叠加 |
| MCU-V1.2-关系探索页视觉方案.md | 本轮 §五 **完全替代**上一版方案（从关系对卡片 → 关系网络图） |

> 开发注意：上一版《开发标注-视觉修正》中的 Phase1+Phase2 CSS 修正仍然有效，
> 应先执行修正，再按本轮方案做新增/重设计。

---

## 十、待策划 AI（GPT）确认事项

1. **首页 Hero Banner 视觉方向**：宇宙门户 + 金色能量 + 星云，是否符合预期？
2. **入口卡片从 3→4**：新增"开始观看"入口（跳转路线页），是否合理？
3. **关系网络图技术方案**：Canvas 实现力导向图，性能是否可接受？
4. **角色阵营补充**：shangchi/yelena/wade/logan 的阵营映射需策划确认
5. **本地资源 2MB 上限**：是否同意上传 CDN？
6. **关系数据 92 条**：需策划提供完整预定义关系表

---

*文档版本：V1.0 · 2026-08-26*
*设计 AI：QoderWork CN*
*状态：待策划确认*
