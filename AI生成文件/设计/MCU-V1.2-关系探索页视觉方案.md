# MCU V1.2 关系探索页视觉方案

> 版本：V1.2 · 2026-08-26
> 设计：QoderWork CN（设计AI）
> 依据：《MCU-V1.2-页面视觉升级方案》§七 + GPT《V1.2联合执行指令》Step2
> 配套：visuals.js 已接入 24 角色头像 + 38 海报
> 状态：待策划AI（GPT）确认 → 确认后开发实现

---

## 一、页面使命

关系探索页是 MCU 小程序的差异化核心——其他工具只告诉你"有什么电影"，我们告诉用户"这些角色之间有什么关系"。

用户进入此页的感受应该是：**我站在一张 MCU 宇宙关系网的入口，每一对角色之间都有故事。**

---

## 二、页面结构总览

```
┌──────────────────────────────────────┐
│  关系探索               ← 56rpx/700  │
│  MCU 角色关系网络        ← 24rpx/sub │
│                                      │
│  ┌─ 入口区 ──────────────────────┐   │
│  │ ◇ 宇宙全景图     › │          │   │  ← 2列入口卡
│  │ ✦ 角色图鉴       › │          │   │
│  └────────────────────────────────┘   │
│                                      │
│  ┌─ 筛选 Chips ──────────────────┐   │
│  │ [全部] [盟友] [敌人] [师徒]   │   │
│  │ [家人] [对手]                 │   │
│  └────────────────────────────────┘   │
│                                      │
│  ┌─ 关系对卡片列表 ──────────────┐   │
│  │                                │   │
│  │  [头像] ←── 盟友 ──→ [头像]  │   │  ← 关系对卡片
│  │  钢铁侠          美队         │   │
│  │  复仇者联盟      复仇者联盟   │   │
│  │  共同出演 12 部               │   │
│  │                                │   │
│  │  [头像] ←── 师徒 ──→ [头像]  │   │
│  │  托尼            彼得         │   │
│  │  钢铁侠          蜘蛛侠       │   │
│  │  共同出演 4 部                │   │
│  │                                │   │
│  │  ... 更多关系对 ...           │   │
│  └────────────────────────────────┘   │
└──────────────────────────────────────┘
```

---

## 三、模块详细设计

### 3.1 页面头部

| 元素 | 规格 |
|------|------|
| 标题"关系探索" | --fs-display(56rpx) / 700 / --text-main |
| 副标题"MCU 角色关系网络" | --fs-body(28rpx) / 400 / --text-sub |
| 上间距 | --space-xl(56rpx) |
| 下间距 | --space-md(28rpx) |

### 3.2 入口区（2列横排）

保留现有的宇宙全景图和角色图鉴两个入口，改为 2 列横排紧凑布局。

| 元素 | 规格 |
|------|------|
| 卡片尺寸 | 各占 50% 宽，高 120rpx |
| 卡片背景 | --surface-2，圆角 --radius-md(20rpx) |
| 图标容器 | 64rpx 圆形，--gold-a10 底 + --gold 图标（全景图）/ --p4-a10 底 + --p4 图标（角色图鉴）|
| 入口名称 | --fs-body(28rpx) / 600 / --text-main |
| 入口描述 | --fs-mini(22rpx) / 400 / --text-sub |
| 右箭头 | CSS chevron，--text-weak |
| 间距 | 两卡之间 --space-sm(20rpx) |

### 3.3 关系类型筛选 Chips

横向滚动，单选。

| 状态 | 样式 |
|------|------|
| 默认 | --surface-2 底，--text-sub 文字，--surface-3 边框，24rpx/400 |
| 选中 | --gold-a10 底，--gold 文字，--gold 边框，24rpx/600 |
| 尺寸 | 高 56rpx，左右 padding 28rpx，圆角 999rpx |
| 间距 | chip 之间 --space-xs(8rpx) |
| 容器 | 横向 scroll-view，左右 padding --space-page(36rpx) |

**筛选类型（6 种）：**

| Chip 文字 | 关系含义 | 关系卡颜色 Token |
|-----------|---------|-----------------|
| 全部 | 显示所有关系对 | --gold（默认高亮） |
| 盟友 | 同阵营并肩作战 | --accent-blue |
| 敌人 | 对立阵营的威胁 | --accent-red |
| 师徒 | 传承与引导 | --gold |
| 家人 | 血缘或养育关系 | --accent-purple |
| 对手 | 竞争但非敌对 | --accent-red |

### 3.4 关系对卡片（核心组件）

这是本页面的核心视觉。每一张卡片展示一对角色之间的关系。

**卡片结构：**

```
┌────────────────────────────────────────────┐
│                                            │
│   [80rpx头像]    关系类型    [80rpx头像]    │
│     ○          ── 盟友 ──       ○          │
│                                            │
│   中文名字         │         中文名字       │
│   英文名字         │         英文名字       │
│   阵营标签         │         阵营标签       │
│                                            │
│   ────── 共同出演 X 部 ──────              │
│                                            │
└────────────────────────────────────────────┘
```

**卡片规格：**

| 元素 | 规格 |
|------|------|
| 卡片背景 | --surface-2，圆角 --radius-content(20rpx)，border 1rpx --surface-3 |
| padding | --space-md(28rpx) |
| 卡片间距 | --space-sm(20rpx) |
| 头像 | 80rpx 圆形，真实照片（visuals.js avatar），2rpx 阵营色描边 |
| 头像兜底 | 阵营色渐变 + 首字（与首页角色卡一致） |
| 角色中文名 | --fs-body(28rpx) / 600 / --text-main |
| 角色英文名 | --fs-mini(22rpx) / 400 / --text-sub |
| 阵营标签 | --fs-mini(22rpx)，阵营色文字，阵营色a15背景，圆角 999rpx |
| 关系类型文字 | --fs-mini(22rpx) / 600 / 按类型颜色（见 3.3 表格） |
| 连接线 | 两头像之间 1rpx --surface-3 横线，关系类型文字居中叠在横线上 |
| 共同出演 | --fs-mini(22rpx) / 400 / --text-weak，居中，顶部 1rpx --surface-3 分割线 |

**关系类型颜色映射（连线 + 标签文字）：**

| 关系 | 颜色 | Token |
|------|------|-------|
| 盟友 | 蓝色 | --accent-blue |
| 敌人 | 红色 | --accent-red |
| 师徒 | 金色 | --gold |
| 家人 | 紫色 | --accent-purple |
| 对手 | 红色 | --accent-red |

---

## 四、关系对数据生成规则

### 4.1 数据来源

关系对数据从现有 CHARACTERS 数据派生，不新增数据模型。

**派生逻辑（在 explore.js 视图层计算）：**

1. **同阵营 = 盟友**：同一 camp 的角色两两配对，关系类型 = "盟友"
2. **跨阵营高频共现 = 对手**：不同 camp 但在 3+ 部电影中共同出现的角色对，关系类型 = "对手"
3. ** predefined 师徒/家人/敌人**：由预定义关系表指定（见 4.2）

**共同出演数计算：**
遍历 CHARACTERS 的 first 字段和 appearances（通过 models/mcuData.js），统计两个角色出现在同一部电影中的次数。

### 4.2 预定义特殊关系

以下关系优先于阵营推断：

| 角色对 | 关系 | 说明 |
|--------|------|------|
| tony ↔ peter | 师徒 | 钢铁侠与蜘蛛侠 |
| strange ↔ wanda | 对手 | 奇异博士与绯红女巫 |
| thanos ↔ gamora | 家人 | 灭霸与卡魔拉（养父女） |
| thanos ↔ tony | 敌人 | 无限战争对决 |
| steve ↔ bucky | 家人 | 发小兄弟 |
| thor ↔ loki | 家人 | 兄弟 |
| natasha ↔ clint | 盟友 | 神盾局老搭档 |
| wade ↔ logan | 对手 | 死侍与金刚狼（跨宇宙） |
| tchalla ↔ starlord | 对手 | 无限战争泰坦星对峙 |

### 4.3 排序规则

关系对列表按以下优先级排序：
1. 有预定义特殊关系的排在最前
2. 同阵营盟友按共同出演数降序
3. 跨阵营对手按共同出演数降序

---

## 五、与现有代码的对应关系

| 设计模块 | 当前代码 | 改动量 |
|---------|---------|--------|
| 页面头部 | page-head 已有 | 微调文案 |
| 入口区 | 2 个 entry-card 纵向 | 改为 2 列横排 |
| 筛选 Chips | 不存在 | **新增** |
| 关系对卡片 | 不存在（当前是角色网格） | **新增，替代角色网格** |
| explore.js | 只有 chars 列表 | **新增关系对派生逻辑** |
| explore.wxss | 旧样式 | **大部分重写** |
| explore.wxml | 旧结构 | **大部分重写** |

**不改的内容：**
- 数据模型（CHARACTERS / RELATIONS / CAMPS）零改动
- 跳转逻辑（goPano / goCharacters / goCharacter）保留
- 页面路由不变

---

## 六、开发实现说明

### 6.1 explore.wxml 结构

```xml
<view class="mcu-page">
  <!-- 页面头部 -->
  <view class="page-head">
    <view class="page-title">关系探索</view>
    <view class="page-sub">MCU 角色关系网络</view>
  </view>

  <!-- 入口区：2列横排 -->
  <view class="entry-row">
    <view class="entry-card" bindtap="goPano">
      <view class="entry-icon icon-pano">◇</view>
      <view class="entry-body">
        <view class="entry-name">宇宙全景图</view>
        <view class="entry-desc">一图看尽主线脉络</view>
      </view>
      <view class="entry-arrow">›</view>
    </view>
    <view class="entry-card" bindtap="goCharacters">
      <view class="entry-icon icon-char">✦</view>
      <view class="entry-body">
        <view class="entry-name">角色图鉴</view>
        <view class="entry-desc">{{totalChars}} 位角色</view>
      </view>
      <view class="entry-arrow">›</view>
    </view>
  </view>

  <!-- 筛选 Chips -->
  <scroll-view scroll-x class="filter-row">
    <view wx:for="{{filters}}" wx:key="key"
          class="chip {{activeFilter === item.key ? 'chip-active' : ''}}"
          data-key="{{item.key}}" bindtap="onFilter">
      {{item.label}}
    </view>
  </scroll-view>

  <!-- 关系对卡片列表 -->
  <view class="pair-list">
    <view wx:for="{{pairs}}" wx:key="fromId+'-'+toId"
          class="pair-card" data-from="{{item.fromId}}" data-to="{{item.toId}}"
          bindtap="goCharacter" hover-class="pair-card-hover">
      <!-- 左角色 -->
      <view class="pair-char">
        <image class="pair-avatar" style="border-color:{{item.fromCampColor}}"
               src="{{item.fromAvatar}}" mode="aspectFill"
               wx:if="{{item.fromAvatar}}" />
        <view class="pair-avatar-fallback" wx:else
              style="background:{{item.fromCampColor}}">
          {{item.fromFirst}}
        </view>
        <view class="pair-name">{{item.fromCn}}</view>
        <view class="pair-en">{{item.fromEn}}</view>
        <view class="pair-camp" style="color:{{item.fromCampColor}};background:{{item.fromCampColor}}15">
          {{item.fromCampLabel}}
        </view>
      </view>

      <!-- 关系类型（中间） -->
      <view class="pair-relation" style="color:{{item.relColor}}">
        <view class="pair-line"></view>
        <view class="pair-type">{{item.relLabel}}</view>
        <view class="pair-line"></view>
      </view>

      <!-- 右角色 -->
      <view class="pair-char">
        <image class="pair-avatar" style="border-color:{{item.toCampColor}}"
               src="{{item.toAvatar}}" mode="aspectFill"
               wx:if="{{item.toAvatar}}" />
        <view class="pair-avatar-fallback" wx:else
              style="background:{{item.toCampColor}}">
          {{item.toFirst}}
        </view>
        <view class="pair-name">{{item.toCn}}</view>
        <view class="pair-en">{{item.toEn}}</view>
        <view class="pair-camp" style="color:{{item.toCampColor}};background:{{item.toCampColor}}15">
          {{item.toCampLabel}}
        </view>
      </view>

      <!-- 共同出演 -->
      <view class="pair-footer">
        共同出演 {{item.coCount}} 部
      </view>
    </view>
  </view>

  <view class="bottom-pad"></view>
</view>
```

### 6.2 explore.js 核心逻辑

```javascript
// 视图层关系对派生（不改数据模型）
const mcuData = require('../../models/mcuData.js');
const { CHARACTERS, CAMPS } = require('../../data/characters.js');
const visuals = require('../../data/visuals.js');

// 预定义特殊关系
const SPECIAL_RELATIONS = [
  { from: 'tony', to: 'peter', type: 'mentor' },
  { from: 'thanos', to: 'gamora', type: 'family' },
  { from: 'thanos', to: 'tony', type: 'enemy' },
  { from: 'steve', to: 'bucky', type: 'family' },
  { from: 'thor', to: 'loki', type: 'family' },
  { from: 'natasha', to: 'clint', type: 'ally' },
  { from: 'wade', to: 'logan', type: 'rival' },
  { from: 'strange', to: 'wanda', type: 'rival' },
  { from: 'tchalla', to: 'starlord', type: 'rival' }
];

// 关系类型 → 显示标签 + 颜色 Token
const REL_TYPE_MAP = {
  ally:  { label: '盟友', color: 'var(--accent-blue)' },
  enemy: { label: '敌人', color: 'var(--accent-red)' },
  mentor: { label: '师徒', color: 'var(--gold)' },
  family: { label: '家人', color: 'var(--accent-purple)' },
  rival: { label: '对手', color: 'var(--accent-red)' }
};

// 筛选 chips
const FILTERS = [
  { key: 'all', label: '全部' },
  { key: 'ally', label: '盟友' },
  { key: 'enemy', label: '敌人' },
  { key: 'mentor', label: '师徒' },
  { key: 'family', label: '家人' },
  { key: 'rival', label: '对手' }
];
```

### 6.3 关键 CSS 规格

```css
/* 关系对卡片 */
.pair-card {
  background: var(--surface-2);
  border: 1rpx solid var(--surface-3);
  border-radius: var(--radius-content); /* 20rpx */
  padding: var(--space-md); /* 28rpx */
  margin-bottom: var(--space-sm); /* 20rpx */
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
}

/* 角色列（左右各一列） */
.pair-char {
  width: 35%;
  display: flex;
  flex-direction: column;
  align-items: center;
}

/* 头像 */
.pair-avatar {
  width: 80rpx;
  height: 80rpx;
  border-radius: 50%;
  border: 2rpx solid; /* 颜色 inline style */
}

/* 中间关系区域 */
.pair-relation {
  width: 30%;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  height: 80rpx; /* 与头像对齐 */
}

.pair-line {
  flex: 1;
  height: 1rpx;
  background: var(--surface-3);
}

.pair-type {
  font-size: var(--fs-mini); /* 22rpx */
  font-weight: 600;
  padding: 0 8rpx;
  white-space: nowrap;
}

/* 共同出演 */
.pair-footer {
  width: 100%;
  text-align: center;
  font-size: var(--fs-mini); /* 22rpx */
  color: var(--text-weak);
  padding-top: var(--space-xs); /* 8rpx */
  margin-top: var(--space-xs);
  border-top: 1rpx solid var(--surface-3);
}
```

---

## 七、视觉层次

```
页面标题 56rpx/700/main ──────────── 最高层
  ↓
入口卡片 28rpx/600 ─────────────── 导航层
  ↓
筛选 Chips 24rpx/400~600 ───────── 交互层
  ↓
关系对卡片 ─────────────────────── 内容层
  角色名 28rpx/600/main
  关系类型 22rpx/600/功能色
  共同出演 22rpx/400/weak ───────── 最底层
```

---

## 八、验收标准

| 检查项 | P0/P1 | 标准 |
|--------|-------|------|
| 筛选 Chips 可切换 | P0 | 点击切换，列表实时过滤 |
| 关系对卡片显示真实头像 | P0 | 使用 visuals.js avatar() |
| 关系类型颜色区分 | P0 | 盟友蓝/敌人红/师徒金/家人紫/对手红 |
| 头像兜底 | P0 | 无图时阵营色渐变+首字 |
| 入口卡片可点击跳转 | P0 | 全景图/角色图鉴正常跳转 |
| 零裸 hex | P1 | 所有颜色用 var() |
| 零 500 字重 | P1 | 只用 400/600/700 |
| 字号仅 5 档 | P1 | 56/36/28/24/22 |
| 卡片圆角 20rpx | P1 | --radius-content |
| 间距用 Token | P1 | --space-* 系列 |

---

## 九、与 V1.1 差异对照

| 维度 | V1.1（当前） | V1.2（本方案） |
|------|-------------|---------------|
| 页面定位 | 入口聚合页（全景图+角色图鉴+角色网格） | 角色关系网络探索 |
| 核心组件 | 角色文字卡片网格 | 关系对卡片（双头像+关系类型） |
| 角色头像 | 无（纯文字+阵营色背景） | 真实头像照片 80rpx 圆形 |
| 关系展示 | 无 | 关系类型筛选 + 关系对卡片 |
| 功能色 | 无 | 盟友蓝/敌人红/师徒金/家人紫 |
| 入口区 | 2 个纵向大卡 | 2 个横向紧凑卡 |
| 数据模型 | 不变 | 不变（视图层派生关系对） |
