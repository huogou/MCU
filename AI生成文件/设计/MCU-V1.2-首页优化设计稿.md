# MCU V1.2 首页优化设计稿

> 版本：V1.2-calibration · 2026-08-25
> 依据：《MCU V1.2 UI优化设计规范》
> 状态：待策划AI（GPT）确认
> 效力：首页开发的唯一视觉标准，替代此前所有首页设计文档

---

## 一、页面结构（自上而下，模块不变）

```
① 品牌区
   ↓ 56rpx
② 继续观看（Hero Card）
   ↓ 56rpx
③ 我的路线（Content Card）
   ↓ 56rpx
④ 宇宙探索（三行入口）
   ↓ 56rpx
⑤ 热门角色（横向滚动）
   ↓ 56rpx
⑥ 最近观看（横向滚动）
```

约束：不新增模块、不删除模块、不调整顺序。wxml 结构不变。

---

## 二、四级视觉层级

本页所有文字必须归入以下四级之一，不允许自由发挥：

| 层级 | 字号 | 字重 | 颜色 | 本页中的元素 |
|------|------|------|------|-------------|
| 一级 · 页面标题 | 56rpx | 700 | --text-main | "MCU观影导航" |
| 二级 · 模块标题 | 36rpx | 600 | --text-main | "继续观看""我的路线""宇宙探索""热门角色""最近观看" |
| 三级 · 卡片标题 | 26rpx | 600 | --text-main | 电影名、路线名、角色名、片名 |
| 辅助 · 描述 | 24rpx或22rpx | 400 | --text-sub或--text-weak | Phase信息、进度、标签、说明 |

关键变化：
- 模块标题从 --text-sub 改为 --text-main（增强存在感）
- 卡片标题从 34rpx 降到 26rpx（拉开与模块标题的距离）
- 描述文字从 28rpx 降到 24/22rpx（退后，不抢焦点）

---

## 三、各模块精确规格

### ① 品牌区

```
┌─────────────────────────────────────────┐
│  ┃  MCU观影导航            ← 56rpx/700  │
│  ┃  你的漫威宇宙旅程       ← 24rpx/400  │
└─────────────────────────────────────────┘
```

| 元素 | 属性 | 值 |
|------|------|-----|
| 金色竖条 | 宽×高 | 14rpx × 72rpx |
| | 圆角 | 8rpx |
| | 颜色 | --gold |
| | 与文字间距 | margin-right: 24rpx |
| 主标题 | 字号/字重 | 56rpx / 700 |
| | 颜色 | --text-main |
| | 行高 | 1.2 |
| 副标题 | 字号/字重 | 24rpx / 400 |
| | 颜色 | --text-sub |
| | margin-top | 8rpx |
| 品牌区整体 | margin-bottom | 56rpx（--space-xl） |

与上一版差异：
- 竖条 10→14rpx（更有存在感）
- 主标题 48→56rpx（一级标题需要足够大）
- 副标题 28→24rpx（与主标题拉开差距）

### ② 继续观看 Hero Card

```
╔═══════════════════════════════════════════╗
║  继续观看              ← 36rpx/600/main  ║
║                                           ║
║  钢铁侠                ← 36rpx/700/main  ║
║  Phase 1 · 无限传奇    ← 22rpx/400/weak  ║
║  当前观看进度          ← 22rpx/400/weak  ║
║  已看 3 / 59           ← 24rpx/400/gold  ║
║                                           ║
║  ┌───────────────────────────────────────┐║
║  │           开始观看                    │║  ← 26rpx/600
║  └───────────────────────────────────────┘║
╚═══════════════════════════════════════════╝
```

**新人态**（无观看记录）：
- 主文字："从钢铁侠开始"
- Phase："Phase 1"
- 无进度行
- 按钮："开始观看"
- movieId: iron-man

**老用户态**（有观看记录）：
- 主文字：当前电影中文名
- Phase："Phase X · 传奇名"
- 进度标签："当前观看进度"
- 进度值："已看 X / 59"
- 按钮："继续观看"

| 元素 | 属性 | 值 |
|------|------|-----|
| 卡片 | 背景 | linear-gradient(135deg, --gold-a04, --surface-1) |
| | 边框 | 2rpx solid --gold-a20 |
| | 圆角 | 32rpx |
| | 内边距 | 40rpx |
| | margin-bottom | 56rpx |
| "继续观看"标题 | 字号/字重/颜色 | 36rpx / 600 / --text-main |
| | margin-bottom | 28rpx（--space-md） |
| 电影名 | 字号/字重/颜色 | 36rpx / 700 / --text-main |
| Phase 信息 | 字号/字重/颜色 | 22rpx / 400 / --text-weak |
| | margin-top | 8rpx |
| 进度标签 | 字号/字重/颜色 | 22rpx / 400 / --text-weak |
| | margin-top | 20rpx（--space-sm） |
| 进度值 | 字号/字重/颜色 | 24rpx / 400 / --gold |
| | margin-top | 8rpx |
| CTA 按钮 | 宽 | 100% |
| | 高 | 88rpx |
| | 圆角 | 16rpx |
| | 背景 | --gold |
| | 文字 | 26rpx / 600 / --gold-btn-text |
| | margin-top | 36rpx（--space-lg） |
| | 阴影 | box-shadow: 0 8rpx 24rpx rgba(242,178,51,0.12) |

与上一版差异：
- 卡片圆角 24→32rpx（Hero 需要更圆润的高级感）
- 卡片内边距 32→40rpx（呼吸感）
- 电影名 34rpx→36rpx，字重 600→700（提升焦点感）
- Phase 信息 28rpx/--text-sub → 22rpx/--text-weak（退后，让电影名更突出）
- CTA 28rpx → 26rpx（与正文字号统一，按钮不喧宾夺主）
- CTA 新增微阴影（金色呼吸感，不刺眼）

### ③ 我的路线 Content Card

```
┌───────────────────────────────────────────┐
│  我的路线              ← 36rpx/600/main  │
│                                           │
│  新手入坑              ← 26rpx/600/main  │
│  已完成 3 / 12         ← 22rpx/400/weak  │
│                                           │
│  下一部推荐            ← 22rpx/400/weak  │
│  钢铁侠                ← 26rpx/400/gold  │
│                                           │
│  继续路线 ›            ← 26rpx/400/gold  │
└───────────────────────────────────────────┘
```

| 元素 | 属性 | 值 |
|------|------|-----|
| 卡片 | 背景 | --surface-2 |
| | 边框 | 1rpx solid --surface-3 |
| | 圆角 | 20rpx |
| | 内边距 | 28rpx |
| | margin-bottom | 56rpx |
| "我的路线"标题 | 字号/字重/颜色 | 36rpx / 600 / --text-main |
| | margin-bottom | 28rpx |
| 路线名 | 字号/字重/颜色 | 26rpx / 600 / --text-main |
| 进度 | 字号/颜色 | 22rpx / --text-weak |
| | margin-top | 8rpx |
| "下一部推荐" | 字号/颜色 | 22rpx / --text-weak |
| | margin-top | 28rpx |
| 推荐片名 | 字号/颜色 | 26rpx / --gold |
| | margin-top | 8rpx |
| Ghost 按钮 | 字号/字重/颜色 | 26rpx / 400 / --gold |
| | margin-top | 28rpx |
| 已完成态 | 字号/颜色 | 24rpx / --text-weak |

与上一版差异：
- 卡片圆角 16→20rpx
- 卡片内边距 24→28rpx
- 路线名 34→26rpx（降为三级标题）
- 进度 24→22rpx
- 推荐片名 28→26rpx
- Ghost 按钮 28→26rpx

### ④ 宇宙探索

```
  宇宙探索                ← 36rpx/600/main
                          
  ┌─────────────────────────────────────────┐
  │  ┌────┐  时间线                  ›     │
  ├─────────────────────────────────────────┤
  │  ┌────┐  角色关系                ›     │
  ├─────────────────────────────────────────┤
  │  ┌────┐  阵营探索                ›     │
  └─────────────────────────────────────────┘
```

| 元素 | 属性 | 值 |
|------|------|-----|
| "宇宙探索"标题 | 字号/字重/颜色 | 36rpx / 600 / --text-main |
| | margin-bottom | 28rpx |
| 每行卡片 | 背景 | --surface-2 |
| | 圆角 | 16rpx |
| | min-height | 88rpx |
| | padding | 24rpx 28rpx |
| | margin-bottom | 16rpx（--space-sm） |
| | 最后一行 | margin-bottom: 0 |
| 图标容器 | 宽×高 | 64rpx × 64rpx |
| | 圆角 | 16rpx |
| | 背景 | linear-gradient(135deg, --gold-a08, --surface-1) |
| | flex-shrink | 0 |
| 图标 | 字号/颜色 | 32rpx / --gold |
| | 内容 | Unicode 暂用（◷ ✦ ◈），待 SVG 替换 |
| 标题文字 | 字号/字重/颜色 | 26rpx / 400 / --text-main |
| | margin-left | 24rpx |
| 右箭头 | 类型 | CSS chevron（border-right + border-bottom rotated） |
| | 尺寸 | 约 20rpx × 20rpx |
| | 颜色 | --text-weak |
| | 定位 | margin-left: auto |
| hover 态 | 边框 | 1rpx solid --gold-a20 |

与上一版差异：
- 图标容器 48→64rpx（更有点击感，也更像"入口"）
- 图标容器背景改为金色微渐变（增加品质感）
- 图标字号 28→32rpx
- 行高 72→88rpx
- 行内 padding 20rpx 24rpx → 24rpx 28rpx
- 右箭头从 Unicode "›" 改为 CSS chevron（统一图标风格）
- 标题文字 28→26rpx

### ⑤ 热门角色

```
  热门角色                ← 36rpx/600/main
                          
  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐
  │      │ │      │ │      │ │      │
  │  奥  │ │  美  │ │  雷  │ │  彼  │    ← 96rpx 头像
  │      │ │      │ │      │ │      │
  ├──────┤ ├──────┤ ├──────┤ ├──────┤
  │钢铁侠│ │ 美队 │ │ 雷神 │ │蜘蛛侠│    ← 26rpx/600
  │5部·故事线›│ │     │ │      │ │      │    ← 22rpx/gold 合并1行
  └──────┘ └──────┘ └──────┘ └──────┘
    168rpx     横向滚动
```

| 元素 | 属性 | 值 |
|------|------|-----|
| "热门角色"标题 | 字号/字重/颜色 | 36rpx / 600 / --text-main |
| | margin-bottom | 28rpx |
| 卡片 | 宽度 | 168rpx |
| | 背景 | --surface-2 |
| | 圆角 | 16rpx |
| | padding | 24rpx 16rpx |
| | margin-right | 20rpx（--space-sm） |
| | 对齐 | flex-direction: column; align-items: center |
| 头像 | 宽×高 | 96rpx × 96rpx |
| | 形状 | 圆形（border-radius: 50%） |
| | 背景 | 阶段色渐变（poster-pN） |
| | 描边 | 2rpx solid rgba(255,255,255,0.12) |
| | 首字 | 36rpx / 700 / --white-a60 |
| | margin-bottom | 16rpx（--space-sm） |
| 角色名 | 字号/字重/颜色 | 26rpx / 600 / --text-main |
| 合并行 | 内容 | "X 部 · 故事线 ›" |
| | 字号/颜色 | 22rpx / --gold |
| | margin-top | 8rpx |
| hover 态 | 边框 | 1rpx solid --gold-a20 |

与上一版差异：
- 卡片宽度 156→168rpx（减少文字截断）
- 头像 88→96rpx（更有存在感）
- 角色名 28→26rpx，字重 400→600（名字需要一点力度）
- **关键变化**：底部两行（"关联X部作品" + "查看故事线 ›"）合并为一行 "X 部 · 故事线 ›"
- 卡片内边距 20rpx 12rpx → 24rpx 16rpx

### ⑥ 最近观看

```
  最近观看                ← 36rpx/600/main
                          
  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐
  │     │ │     │ │     │ │     │
  │  钢 │ │  美 │ │  雷 │ │  奇 │    ← 120×160 海报
  │     │ │     │ │     │ │     │
  └─────┘ └─────┘ └─────┘ └─────┘
  钢铁侠   美国队长  雷神   奇异博士    ← 24rpx
          横向滚动
```

| 元素 | 属性 | 值 |
|------|------|-----|
| "最近观看"标题 | 字号/字重/颜色 | 36rpx / 600 / --text-main |
| | margin-bottom | 28rpx |
| 海报 | 宽×高 | 120rpx × 160rpx |
| | 圆角 | 16rpx |
| | 首字 | 44rpx / 700 / --white-a50 |
| 海报间距 | margin-right | 24rpx |
| 片名 | 字号/颜色 | 24rpx / --text-sub |
| | margin-top | 16rpx |
| | max-width | 120rpx |
| | 溢出 | text-overflow: ellipsis |
| 空态 | 文字 | "还没有观看记录，从《钢铁侠》开始你的旅程" |
| | 字号/颜色 | 26rpx / --text-weak |
| | padding | 56rpx 0，居中 |

与上一版差异：
- 海报圆角 12→16rpx
- 海报首字 48→44rpx（留白更多，不那么撑）
- 片名 24rpx 不变
- 名字间距 12→16rpx
- 模块标题统一为 36rpx/--text-main

---

## 四、交互状态

### 4.1 Hover 态（开发者工具模拟）

| 元素 | hover 效果 |
|------|-----------|
| CTA 按钮 | opacity: 0.85 |
| Ghost 按钮 | opacity: 0.7 |
| 探索入口行 | border: 1rpx solid --gold-a20 |
| 角色卡 | border: 1rpx solid --gold-a20 |
| 最近观看海报 | opacity: 0.85 |

### 4.2 双态逻辑（不变）

仅"继续观看 Hero Card"内容随 hasProgress 变化：
- 新人态（hasProgress=false）：从钢铁侠开始 / Phase 1 / 开始观看
- 老用户态（hasProgress=true）：当前电影 / 进度 / 继续观看

其他模块不受影响。

---

## 五、CSS 变更清单（给开发 AI）

### 5.1 app.wxss 变更

```
/* 字号升级 */
--fs-display:     48rpx → 56rpx
--fs-display-sm:  40rpx → 44rpx
--fs-title:       34rpx → 36rpx
--fs-body:        28rpx → 26rpx
--fs-mini:        20rpx → 22rpx

/* 间距升级 */
--space-sm:   16rpx → 20rpx
--space-md:   24rpx → 28rpx
--space-lg:   32rpx → 36rpx
--space-xl:   48rpx → 56rpx
--space-2xl:  64rpx → 72rpx
--page-x:     32rpx → 36rpx

/* 新增 */
--surface-0:  #0D1119;

/* 卡片类调整 */
.card-hero:   border-radius 24→32rpx, padding 32→40rpx
.card-content: border-radius 16→20rpx, padding 24→28rpx
.card-compact: border-radius 12→16rpx, padding 16→20rpx
```

### 5.2 home.wxss 变更

```
/* 品牌区 */
.brand-mark:    width 10→14rpx, height 64→72rpx, border-radius 6→8rpx
.brand-title:   font-size --fs-display (56rpx)
.brand-sub:     font-size --fs-caption (24rpx)

/* 模块标题 */
.module-title:  font-size --fs-title (36rpx)
.card-title:    font-size --fs-body (26rpx), color --text-main (不再用--text-sub)

/* Hero Card */
.continue-card: border-radius 32rpx (覆盖), padding 40rpx (覆盖)
.movie-name:    font-size --fs-title (36rpx), font-weight 700
.movie-phase:   font-size --fs-mini (22rpx), color --text-weak
.movie-progress-label: font-size --fs-mini (22rpx)
.btn-accent:    font-size --fs-body (26rpx), 新增 box-shadow

/* 我的路线 */
.route-name:    font-size --fs-body (26rpx)
.route-progress: font-size --fs-mini (22rpx)
.next-label:    font-size --fs-mini (22rpx)
.next-name:     font-size --fs-body (26rpx)

/* 宇宙探索 */
.explore-ic-wrap: width/height 48→64rpx, background 改为金色渐变
.explore-ic:    font-size 28→32rpx
.explore-card:  min-height 72→88rpx, padding 24rpx 28rpx
.explore-title: font-size --fs-body (26rpx), margin-left 24rpx
.explore-arrow: 改为 CSS chevron（删除 Unicode 内容）

/* 热门角色 */
.char-card:     width 156→168rpx, padding 24rpx 16rpx
.char-avatar:   width/height 88→96rpx, font-size 40→36rpx, 新增 2rpx 半透明描边
.char-name:     font-size --fs-body (26rpx), font-weight 600
/* 合并 char-count 和 char-story 为一行 */
/* 删除 .char-count 独立样式 */
/* .char-story 改为合并行样式：22rpx / --gold */

/* 最近观看 */
.recent-poster: border-radius 12→16rpx
.poster-text:   font-size 48→44rpx
.recent-name:   margin-top 12→16rpx
```

### 5.3 home.wxml 变更

仅一处结构变更：
- 角色卡底部 `.char-count` + `.char-story` 合并为一个 `.char-info` 元素
- 内容格式：`{{item.count}} 部 · 故事线 ›`
- 其余 wxml 不变

### 5.4 home.js 变更

- 无变更。数据结构和跳转逻辑完全不变。

---

## 六、验收标准

开发完成后，按以下标准验收：

1. **层级可辨**：遮住具体内容，仅看字号大小，能区分出"这是标题""这是内容""这是说明"
2. **呼吸感**：模块之间有明显空白带，不显得拥挤
3. **焦点明确**：Hero Card 是全页视觉焦点，金色 CTA 是全页唯一强调
4. **图标统一**：所有箭头/chevron 风格一致，不混用 Unicode 和 CSS
5. **角色卡精简**：底部信息合并为一行，卡片不再拥挤
6. **零裸 hex**：所有颜色值引用 var() token
7. **零 500 字重**：仅 400/600/700
8. **双态正确**：新人态和老用户态显示正确内容
