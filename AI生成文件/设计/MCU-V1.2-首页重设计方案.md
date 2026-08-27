# MCU观影导航 V1.2 首页重设计方案

> 版本：V1.2
> 依据文档：《MCU-V1.2-UI-Design-System》
> 输出方：QoderWork CN（设计AI）
> 状态：待策划AI（GPT）确认
> 约束：不新增功能 / 不改数据结构 / 不改跳转逻辑 / 不写代码

---

## 一、首页设计总览

### 1.1 页面使命

用户打开 30 秒内知道"我下一步应该看什么"。

首页不是一个"功能列表"，而是一个"入口大厅"——它只需要完成三件事：
1. 告诉用户"你在这里"（品牌感）
2. 告诉用户"下一步看什么"（继续观看 / 路线推荐）
3. 给用户一个"探索的冲动"（宇宙探索 / 热门角色）

### 1.2 固定模块结构（6模块，禁删）

```
┌──────────────────────────────────────┐
│                                      │
│  ① 品牌入口                          │  品牌区
│  MCU观影导航 · 你的漫威宇宙旅程       │
│                                      │
├──────────────────────────────────────┤
│                                      │
│  ② 继续观看                          │  Hero Card（一级卡片）
│  ┌────────────────────────────────┐  │  全页视觉焦点
│  │  从钢铁侠开始                   │  │
│  │  Phase 1 · 无限传奇             │  │
│  │  已看 12 / 59                  │  │
│  │  [▶ 开始观看]                  │  │  金色 CTA
│  └────────────────────────────────┘  │
│                                      │
├──────────────────────────────────────┤
│                                      │
│  ③ 我的路线                          │  二级卡片
│  新手入坑 · 12/59 部                 │
│  下一部：奇异博士                     │
│  [继续路线]                          │  Ghost 按钮
│                                      │
├──────────────────────────────────────┤
│                                      │
│  ④ 宇宙探索                          │  三个三级卡片
│  [时间线]  [角色关系]  [阵营探索]     │  横向排列
│                                      │
├──────────────────────────────────────┤
│                                      │
│  ⑤ 热门角色                          │  横向滚动
│  ← [角色卡] [角色卡] [角色卡] →      │  三级卡片
│                                      │
├──────────────────────────────────────┤
│                                      │
│  ⑥ 最近观看                          │  横向滚动
│  ← [海报] [海报] [海报] →            │  阶段色占位
│                                      │
└──────────────────────────────────────┘
```

### 1.3 视觉层次分配

| 模块 | 卡片层级 | 视觉权重 | 说明 |
|------|---------|---------|------|
| ① 品牌入口 | 无卡片 | 低 | 安静存在，不抢焦点 |
| ② 继续观看 | Hero（一级） | **最高** | 全页唯一焦点，金色 CTA |
| ③ 我的路线 | Content（二级） | 中 | 信息传递为主 |
| ④ 宇宙探索 | Compact（三级）×3 | 中低 | 轻量入口，不加描述 |
| ⑤ 热门角色 | Compact（三级） | 低 | 横向滚动，探索性质 |
| ⑥ 最近观看 | 无卡片（海报缩略） | 低 | 个人记录，轻量展示 |

### 1.4 与现有代码的对应关系

| 设计模块 | 对应 WXML 结构 | 对应 JS 数据 |
|---------|---------------|-------------|
| ① 品牌入口 | `.brand-area` | 静态文字 |
| ② 继续观看 | `.card.continue-card` | `continueCard`（双态） |
| ③ 我的路线 | `.card.my-route` | `myRoute` |
| ④ 宇宙探索 | `.section > .explore-row` | `exploreEntries`（3项） |
| ⑤ 热门角色 | `.section > .char-row` | `hotChars`（4位） |
| ⑥ 最近观看 | `.section > .recent-row` | `recent`（最多6部） |

数据结构和跳转逻辑完全不变，设计方案只涉及视觉呈现和交互细节。

---

## 二、模块详细设计

---

### ① 品牌入口

#### 页面结构

```
.brand-area
  ├── .brand-mark        ← 品牌标识（盾牌图标，金色装饰）
  └── .brand-text
       ├── .brand-title  ← "MCU观影导航"（Display / --text-main）
       └── .brand-sub    ← "你的漫威宇宙旅程"（Body / --text-sub）
```

#### 模块说明

品牌入口的职责是建立"你进入了漫威宇宙控制中心"的第一印象。它不需要承担任何功能，只需要用字号和留白建立品牌感。

品牌区位于页面最顶部，上方留白 `--space-2xl`（64rpx），下方与继续观看卡间距 `--space-xl`（48rpx）。

#### 视觉说明

- 品牌标识（`.brand-mark`）：使用一个 48rpx × 48rpx 的盾牌 SVG 图标，颜色为 `--gold-a40`。图标放在品牌标题左侧，与文字水平对齐。不使用大色块或渐变背景。
- 品牌标题（`.brand-title`）：`font-size: var(--fs-display)`（48rpx），`font-weight: 700`，`color: var(--text-main)`。行高 1.3。
- 副标题（`.brand-sub`）：`font-size: var(--fs-body)`（28rpx），`font-weight: 400`，`color: var(--text-sub)`。与标题间距 `--space-xs`（8rpx）。
- 整体布局：品牌标识 + 文字水平排列（flex，align-items: center），居左对齐。

#### 交互说明

品牌入口无交互行为。不可点击，无动画。

---

### ② 继续观看（Hero Card）

#### 页面结构

```
.card.continue-card（一级卡片）
  ├── .card-title           ← "继续观看"（Title / --text-sub）
  └── .continue-body
       ├── .continue-meta
       │    ├── .movie-name           ← 电影名（Title / --text-main）
       │    ├── .movie-phase          ← "Phase 1 · 无限传奇"（Caption / --text-weak）
       │    ├── .movie-progress-label ← "当前观看进度"（Mini / --text-weak）
       │    └── .movie-progress       ← "已看 12 / 59"（Caption / --gold）
       └── .btn-accent               ← CTA 按钮（Primary）
```

#### 模块说明

继续观看是全页唯一的 Hero Card，也是绝对的视觉焦点。它需要根据用户状态展示两种内容：

**新人态（hasProgress = false）：**
- 电影名："从钢铁侠开始"
- 阶段："Phase 1"
- 无进度信息
- 按钮文字："开始观看"
- 跳转目标：`iron-man` 电影详情

**老用户态（hasProgress = true）：**
- 电影名：下一部推荐电影中文名
- 阶段："Phase X · 传奇名"
- 进度标签："当前观看进度"
- 进度值："已看 X / 59"（使用 `--gold` 色）
- 按钮文字："继续观看"
- 跳转目标：推荐电影详情

#### 视觉说明

- 卡片样式：`.card-hero` 规范。`background: var(--surface-1)`，`border: 2rpx solid var(--surface-3)`，`border-radius: 24rpx`，`padding: 32rpx`。
- 特殊处理：卡片背景使用从 `--gold-a06` 到 `var(--surface-1)` 的微渐变（`linear-gradient(135deg, var(--gold-a06), var(--surface-1))`），让它在页面中微微"亮起来"。边框使用 `--gold-a20`。
- 模块标题（"继续观看"）：`font-size: var(--fs-title)`（34rpx），`font-weight: 600`，`color: var(--text-sub)`。注意这里用 `--text-sub` 而不是 `--text-main`，让标题安静退后，把焦点留给卡片内容。
- 电影名：`font-size: var(--fs-title)`（34rpx），`font-weight: 600`，`color: var(--text-main)`。与模块标题间距 `--space-lg`（32rpx）。
- 阶段信息：`font-size: var(--fs-caption)`（24rpx），`color: var(--text-weak)`。与电影名间距 `--space-xs`（8rpx）。
- 进度信息（仅老用户态）：标签用 Mini/--text-weak，数值用 Caption/--gold。与阶段信息间距 `--space-sm`（16rpx）。
- CTA 按钮：`.btn-primary` 规范。`background: var(--gold)`，`color: var(--gold-btn-text)`，`border-radius: 16rpx`，`height: 88rpx`，全宽。与上方内容间距 `--space-lg`（32rpx）。

#### 交互说明

- CTA 按钮点击：跳转到对应电影详情页（`/pages/movie/movie?id={movieId}`）。
- 按钮按下态：`opacity: 0.85`，`hover-stay-time: 80`。
- 整个 Hero Card 不可点击，只有 CTA 按钮可点击。
- 可选动效：CTA 按钮默认态可加微弱呼吸光晕（`box-shadow: 0 0 20rpx var(--gold-a10)` 循环动画，2000ms），但需评估性能后决定是否启用。

---

### ③ 我的路线

#### 页面结构

```
.card.my-route（二级卡片）
  ├── .card-title              ← "我的路线"（Title / --text-sub）
  ├── .route-body
  │    ├── .route-info
  │    │    ├── .route-name       ← 路线名（Title / --text-main）
  │    │    └── .route-progress   ← "已完成 12 / 59 部"（Caption / --text-weak）
  │    └── .route-next
  │         ├── .next-label       ← "下一部推荐"（Mini / --text-weak）
  │         └── .next-name        ← 电影名（Body / --text-main）
  └── .btn-accent.btn-sm      ← "继续路线"（Ghost 按钮 / --gold）
```

#### 模块说明

我的路线展示用户当前选择的一条观影路线和完成进度。只展示一条路线，不展示多条路线选择器。如果需要切换，用 Ghost 文字链接"切换路线"。

与上方继续观看卡间距 `--space-xl`（48rpx）。

#### 视觉说明

- 卡片样式：`.card-content` 规范。`background: var(--surface-2)`，`border: 1rpx solid var(--surface-3)`，`border-radius: 16rpx`，`padding: 24rpx`。
- 模块标题（"我的路线"）：同继续观看，Title/--text-sub。
- 路线名：`font-size: var(--fs-title)`（34rpx），`font-weight: 600`，`color: var(--text-main)`。
- 完成进度：`font-size: var(--fs-caption)`（24rpx），`color: var(--text-weak)`。与路线名间距 `--space-xs`（8rpx）。
- "下一部推荐"标签：`font-size: var(--fs-mini)`（20rpx），`color: var(--text-weak)`。与进度信息间距 `--space-lg`（32rpx）。
- 下一部电影名：`font-size: var(--fs-body)`（28rpx），`color: var(--text-main)`。与标签间距 `--space-xs`（8rpx）。
- "继续路线"按钮：`.btn-ghost` 规范。`color: var(--gold)`，`font-size: var(--fs-body)`，`font-weight: 500`。位于卡片底部，与上方内容间距 `--space-lg`（32rpx）。
- 进度条（可选增强）：在路线名下方可加一条细进度条（高度 4rpx，背景 `--surface-3`，已完成部分 `--gold`），直观展示完成比例。此为可选元素，不影响核心功能。

#### 交互说明

- "继续路线"按钮点击：跳转到路线内下一部未看电影的详情页（`/pages/movie/movie?id={nextId}`）。
- 按钮按下态：`opacity: 0.7`。
- 如果路线已全部看完（`nextId` 为空），按钮不显示，改为显示"已完成当前路线"文字（Caption / --text-weak）。
- 整个卡片不可点击。

---

### ④ 宇宙探索入口

#### 页面结构

```
.section
  ├── .module-title              ← "宇宙探索"（Title / --text-main）
  └── .explore-row
       ├── .explore-card × 3     ← 三个三级卡片，横向等分排列
       │    ├── .explore-ic      ← SVG 图标（48rpx / --gold-a40）
       │    ├── .explore-body
       │    │    ├── .explore-title  ← 入口名（Body / --text-main）
       │    │    └── .explore-desc ← 描述（移除，不显示）
       │    └── .explore-arrow   ← 移除，不显示
```

#### 模块说明

宇宙探索提供三个不同视角进入漫威宇宙：时间线（全景页）、角色关系（探索Tab）、阵营探索（角色图鉴）。

三个入口使用三级卡片横向等分排列，每个卡片内只有一个图标 + 一个名称。**不加描述文字，不加箭头**——保持轻量，让用户好奇点击。

与上方我的路线间距 `--space-xl`（48rpx）。

#### 视觉说明

- 模块标题（"宇宙探索"）：`font-size: var(--fs-title)`（34rpx），`font-weight: 600`，`color: var(--text-main)`。注意这里用 `--text-main`（而非 `--text-sub`），因为这是独立模块的标题，需要比卡片内标题更突出。
- 三个入口卡片：`.card-compact` 规范变体。`background: var(--surface-2)`，`border-radius: 12rpx`，`padding: 24rpx 16rpx`。三个卡片等宽排列（flex，justify-content: space-between），卡片间距 `--space-sm`（16rpx）。
- 图标：48rpx × 48rpx SVG，颜色 `--gold-a40`。居中显示。
  - 时间线：星系/时钟图标
  - 角色关系：连线/网络图标
  - 阵营探索：盾牌/分组图标
- 入口名称：`font-size: var(--fs-body)`（28rpx），`font-weight: 400`，`color: var(--text-main)`。与图标间距 `--space-sm`（16rpx）。居中。
- 卡片内部结构：垂直居中（flex-direction: column，align-items: center，justify-content: center）。
- 当前代码中的 `.explore-desc` 和 `.explore-arrow` 在 V1.2 中隐藏（`display: none`），不显示。

#### 交互说明

- 每个入口卡片可点击：
  - 时间线 → `/pages/panorama/panorama`
  - 角色关系 → `/pages/explore/explore`（switchTab）
  - 阵营探索 → `/pages/characters/characters`
- 卡片按下态：`opacity: 0.85`，`hover-stay-time: 80`。
- 无选中态（入口不是状态切换）。

---

### ⑤ 热门角色

#### 页面结构

```
.section
  ├── .module-title              ← "热门角色"（Title / --text-main）
  └── .char-row                  ← 横向滚动（scroll-view horizontal）
       └── .char-card × 4        ← 三级卡片
            ├── .char-avatar     ← 角色头像占位（阶段色背景 + 首字母）
            ├── .char-name       ← 角色名（Body / --text-main）
            ├── .char-count      ← "关联 X 部作品"（Mini / --text-weak）
            └── .char-story      ← "查看故事线"（Mini / --gold）
```

#### 模块说明

热门角色展示 4 位核心角色（Tony / Steve / Thor / Peter），作为"角色故事"的入口。使用横向滚动列表，用户可以左右滑动查看更多。

与上方宇宙探索间距 `--space-xl`（48rpx）。

#### 视觉说明

- 模块标题：同"宇宙探索"。
- 横向滚动容器：`scroll-view`，`scroll-x`，`white-space: nowrap`。容器高度固定（约 280rpx），内容超出后可横向滚动。
- 角色卡片：`.card-compact` 规范。`background: var(--surface-2)`，`border-radius: 12rpx`，`padding: 20rpx`。固定宽度 200rpx，卡片间距 `--space-sm`（16rpx）。
- 角色头像占位：64rpx × 64rpx 圆形，背景使用角色首登场作品的阶段色（`var(--p1)` ~ `var(--p6)`），中央显示角色名首字母（`font-size: var(--fs-title)`，`color: rgba(255,255,255,0.6)`）。
- 角色名：`font-size: var(--fs-body)`（28rpx），`color: var(--text-main)`。与头像间距 `--space-sm`（16rpx）。
- 关联作品数：`font-size: var(--fs-mini)`（20rpx），`color: var(--text-weak)`。与角色名间距 `--space-xs`（8rpx）。
- "查看故事线"：`font-size: var(--fs-mini)`（20rpx），`color: var(--gold)`，`font-weight: 500`。与关联数间距 `--space-xs`（8rpx）。
- 卡片内部结构：垂直排列（flex-direction: column），居左对齐。

#### 交互说明

- 角色卡片整体可点击：跳转到角色详情页（`/pages/character/character?id={charId}`）。
- 卡片按下态：`opacity: 0.85`，`hover-stay-time: 80`。
- 横向滚动使用原生 `scroll-view`，无额外动效。
- "查看故事线"文字与卡片点击行为相同，不做单独绑定。

---

### ⑥ 最近观看

#### 页面结构

```
.section
  ├── .module-title              ← "最近观看"（Title / --text-main）
  └── .recent-row                ← 横向滚动（scroll-view horizontal）
       └── .recent-item × N      ← 最多 6 部
            ├── .recent-poster   ← 海报占位（阶段色渐变 + 首字母）
            └── .recent-name     ← 电影名（Mini / --text-sub）
```

#### 模块说明

最近观看展示用户按时间倒序的最近 6 部已观看电影。如果用户没有观看记录，显示空态提示："还没有观看记录，从《钢铁侠》开始你的旅程"。

与上方热门角色间距 `--space-xl`（48rpx）。

#### 视觉说明

- 模块标题：同上。
- 横向滚动容器：同热门角色。容器高度约 200rpx。
- 海报占位：120rpx × 160rpx（3:4 比例），`border-radius: 12rpx`。背景使用阶段色到 `--surface-2` 的渐变（`linear-gradient(135deg, var(--p{n}), var(--surface-2))`），中央显示电影名首字母（`font-size: var(--fs-display)`，`color: rgba(255,255,255,0.5)`）。
- 电影名：`font-size: var(--fs-mini)`（20rpx），`color: var(--text-sub)`。与海报间距 `--space-xs`（8rpx）。限制最多两行，超出省略（`overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2`）。
- 每个项目宽度：120rpx（与海报同宽），项目间距 `--space-sm`（16rpx）。
- 空态提示：`font-size: var(--fs-body)`（28rpx），`color: var(--text-weak)`，居中显示，上下留白 `--space-xl`。

#### 交互说明

- 每个海报占位可点击：跳转到对应电影详情页（`/pages/movie/movie?id={movieId}`）。
- 按下态：`opacity: 0.85`。
- 横向滚动使用原生 `scroll-view`。
- 空态不可点击。

---

## 三、页面整体节奏

### 3.1 垂直间距节奏

```
[状态栏]
    ↓ --space-2xl (64rpx)
[① 品牌入口]
    ↓ --space-xl (48rpx)
[② 继续观看 Hero Card]
    ↓ --space-xl (48rpx)
[③ 我的路线]
    ↓ --space-xl (48rpx)
[④ 宇宙探索]
    ↓ --space-xl (48rpx)
[⑤ 热门角色]
    ↓ --space-xl (48rpx)
[⑥ 最近观看]
    ↓ --space-2xl (64rpx)
[底部安全区]
```

模块间距统一 48rpx，首尾留白 64rpx。这是"呼吸感"的基础。

### 3.2 视觉权重曲线

```
高 │    ██
   │    ██
中 │          ██
   │    ██          ██          ██
低 │    ██          ██          ██          ██          ██
   └──────────────────────────────────────────────────
     品牌    继续观看   我的路线   宇宙探索   热门角色   最近观看
```

继续观看是绝对焦点，之后视觉权重逐步降低。用户视线自然从上到下被引导。

### 3.3 色彩使用检查

| 颜色 | 使用位置 | 是否合规 |
|------|---------|---------|
| `--gold` | CTA 按钮、进度数值、"查看故事线" | ✓ 引导视线 |
| `--text-main` | 模块标题、电影名、角色名、路线名 | ✓ 核心信息 |
| `--text-sub` | 副标题、卡片内标题、电影名（最近观看） | ✓ 次要信息 |
| `--text-weak` | 阶段信息、进度标签、关联数、空态 | ✓ 辅助信息 |
| `--gold-a40` | 品牌图标、探索入口图标 | ✓ 装饰 |
| `--p1~p6` | 角色头像背景、海报占位背景 | ✓ 内容标识 |
| 无其他高饱和色 | — | ✓ 合规 |

---

## 四、与 V1.1 首页的差异对照

| 维度 | V1.1 | V1.2 设计 |
|------|------|----------|
| 品牌区 | 品牌标题 + 副标题 + 盾牌图标 | 结构不变，图标改为 SVG，颜色改为 --gold-a40 |
| 继续观看 | 普通卡片，32rpx 圆角 | Hero Card，24rpx 圆角，金色微渐变背景 + --gold-a20 边框 |
| 我的路线 | 普通卡片，与继续观看视觉权重相同 | 二级卡片，16rpx 圆角，CTA 改为 Ghost 按钮（降低权重） |
| 宇宙探索 | 三个入口带描述文字 + 箭头 | 去掉描述和箭头，只保留图标 + 名称（轻量化） |
| 热门角色 | 卡片带"关联 X 部" + "查看故事线" | 结构不变，样式迁移到三级卡片，图标替换为 SVG |
| 最近观看 | 海报占位 + 电影名 | 结构不变，海报占位使用阶段色渐变，样式对齐 |
| 整体间距 | 模块间距 16-20rpx | 模块间距统一 48rpx |
| 卡片圆角 | 统一 32rpx | 三级体系：24/16/12rpx |
| 字号 | 15+ 种字号混用 | 5 级制：48/34/28/24/20rpx |
| 色彩 | 首页独立色值（双色彩体系） | 全局统一色值（消除双色彩体系） |

---

## 五、开发实现指引

### 5.1 需要改动的文件

| 文件 | 改动范围 |
|------|---------|
| `home.wxml` | 结构微调：移除 `.explore-desc` 和 `.explore-arrow`，品牌区加 SVG 图标 |
| `home.wxss` | 全面重写：按设计系统 token 和三级卡片规范 |
| `home.js` | **不改**。数据结构和跳转逻辑完全不变 |

### 5.2 需要开发注意的要点

1. **移除 `.home-page` 内的 token 覆盖**：当前首页在 `.home-page` 作用域内覆盖了全局 token（`--bg`、`--gold` 等），V1.2 需要移除这些覆盖，让首页使用全局 token。
2. **Hero Card 渐变背景**：`linear-gradient(135deg, var(--gold-a06), var(--surface-1))`，需要测试在真机上的渲染效果。
3. **Unicode → SVG 替换**：探索入口的 `◷ ✦ ◈` 需要替换为 SVG 图标文件。在 SVG 资源就绪前，可暂时保留 Unicode 作为占位。
4. **scroll-view**：热门角色和最近观看需要使用 `scroll-view` 组件实现横向滚动，确保滚动流畅。
5. **进度条（可选）**：我的路线模块中的进度条是可选增强元素，如果实现复杂度高可以跳过。

### 5.3 真机验证要点

- [ ] Hero Card 渐变背景在深色屏幕上是否可见（不能太暗也不能太亮）
- [ ] 48rpx Display 字号在小屏手机上是否溢出
- [ ] 横向滚动（热门角色 / 最近观看）是否流畅
- [ ] 模块间距 48rpx 是否让页面看起来"太松"（需要在真机上感受）
- [ ] 金色 CTA 按钮在深色背景上是否足够醒目

---

> 本文档由 QoderWork CN（设计AI）输出，待策划AI（GPT）确认后交由开发AI（Work）实现。
> 确认后不直接进入开发，需先由用户在微信开发者工具中截图真机效果，设计AI据截图微调后再正式验收。
