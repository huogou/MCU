# MCU V1.2 真机适配专项设计方案（定版）

> 设计 AI 产出 · 2026-08-27（定版）
> 依据：GPT「真机适配专项任务」指令 + 最终视觉验收修正 + 成就模块视觉升级
> 适用范围：panorama / explore / share / my-mcu(成就) 四个页面的移动端重新设计
> 设计纪律：纯 WXSS 无预处理器、无第三方组件库、全 Token 引用（var()）、Canvas 层用 raw hex（技术必要）
> 定版变更：explore 混合方案（卡片默认+Canvas高级入口）/ 成就模块图标升级 / 三页真机适配

---

## 零、全量资源核验报告

> 按 GPT 要求：角色 → 演员 → 头像 → 作品 → 关系 全链路核验

### 0.1 角色 → 演员 → 头像 映射（24 位）

| id | 角色名 | 演员 | 头像文件 | 核验 |
|---|---|---|---|---|
| tony | 托尼·斯塔克 / 钢铁侠 | Robert Downey Jr. | tony.jpg | ✅ |
| steve | 史蒂夫·罗杰斯 / 美国队长 | Chris Evans | steve.jpg | ✅ 已重新生成 |
| thor | 索尔 / 雷神 | Chris Hemsworth | thor.jpg | ✅ |
| natasha | 娜塔莎·罗曼诺夫 / 黑寡妇 | Scarlett Johansson | natasha.jpg | ✅ |
| banner | 布鲁斯·班纳 / 浩克 | Mark Ruffalo | banner.jpg | ✅ |
| clint | 克林特·巴顿 / 鹰眼 | Jeremy Renner | clint.jpg | ✅ |
| loki | 洛基 | Tom Hiddleston | loki.jpg | ✅ |
| fury | 尼克·弗瑞 | Samuel L. Jackson | fury.jpg | ✅ |
| bucky | 巴基·巴恩斯 / 冬日战士 | Sebastian Stan | bucky.jpg | ✅ |
| sam | 山姆·威尔逊 | Anthony Mackie | sam.jpg | ✅ |
| peter | 彼得·帕克 / 蜘蛛侠 | Tom Holland | peter.jpg | ✅ 已重新生成 |
| strange | 奇异博士 | Benedict Cumberbatch | strange.jpg | ✅ |
| tchalla | 特查拉 / 黑豹 | Chadwick Boseman | tchalla.jpg | ✅ |
| wanda | 旺达 / 绯红女巫 | Elizabeth Olsen | wanda.jpg | ✅ |
| vision | 幻视 | Paul Bettany | vision.jpg | ✅ |
| scott | 斯科特·朗 / 蚁人 | Paul Rudd | scott.jpg | ✅ |
| carol | 卡罗尔 / 惊奇队长 | Brie Larson | carol.jpg | ✅ |
| starlord | 星爵 | Chris Pratt | starlord.jpg | ✅ |
| gamora | 卡魔拉 | Zoe Saldana | gamora.jpg | ✅ |
| thanos | 灭霸 | Josh Brolin | thanos.jpg | ✅ |
| shangchi | 尚气 | Simu Liu | shangchi.jpg | ✅ |
| yelena | 叶莲娜 | Florence Pugh | yelena.jpg | ✅ |
| wade | 死侍 | Ryan Reynolds | wade.jpg | ✅ |
| logan | 金刚狼 | Hugh Jackman | logan.jpg | ✅ |

**重点核验**：
- 钢铁侠 = Tony Stark → tony.jpg ✅
- 蜘蛛侠 = Tom Holland MCU 版 → peter.jpg ✅（已重新生成）
- 美国队长 = Chris Evans → steve.jpg ✅（已重新生成）

### 0.2 关系数据核验（SPECIAL_RELATIONS 19 条）

| # | from | to | type | 核验 |
|---|---|---|---|---|
| 1 | tony | peter | mentor | ✅ 师徒关系正确 |
| 2 | tony | steve | ally | ✅ 核心盟友（内战短暂对立终局和解） |
| 3 | thor | loki | family | ✅ 兄弟关系 |
| 4 | steve | bucky | family | ✅ 家人般的关系 |
| 5 | natasha | clint | family | ✅ 家人般的关系 |
| 6 | wanda | vision | family | ✅ 恋人/家人 |
| 7 | tony | thanos | enemy | ✅ 死敌 |
| 8 | thanos | gamora | family | ✅ 养父女 |
| 9 | strange | wanda | ally | ✅ 盟友（偶有紧张非对手） |
| 10 | wade | logan | rival | ✅ 对手（互怼式搭档） |
| 11 | tchalla | starlord | ally | ✅ 短暂冲突后结盟（无限战争） |
| 12 | tony | fury | ally | ✅ 共演 6+ 部 |
| 13 | tony | tchalla | ally | ✅ 共演 3 部（内战/无限战争） |
| 14 | tony | natasha | ally | ✅ 共演 7+ 部 |
| 15 | tony | thor | ally | ✅ 共演 4 部（复联系） |
| 16 | steve | tchalla | ally | ✅ 共演 3 部（内战/无限战争） |
| 17 | steve | natasha | ally | ✅ 共演 7+ 部 |
| 18 | steve | thor | ally | ✅ 共演 4 部（复联系） |
| 19 | tony | clint | ally | ✅ 共演 4 部（复联系） |

**自动派生规则核验**：
- SPECIAL 表优先 → 同阵营=盟友 → 跨阵营共演≥2=对手(rival) → 其余 null
- 同阵营自动 ally 正确性：avengers 12 人互 ally ✅ / asgard 2 人(thor+loki)互 ally ✅ / guardians 3 人互 ally ✅ / shield 3 人互 ally ✅ / mutant 2 人互 ally ✅
- tony 中心 18 条关系零误标 ✅

**结论**：24 角色头像映射全部正确，19 条特殊关系全部正确，自动派生逻辑正确。数据层无需改动。

---

## 一、宇宙全景图（panorama）— 纵向 Phase 时间轴 + 已观看状态

### 1.1 设计目标

用户打开页面 5 秒内理解：MCU 应该按照什么顺序观看。同时一眼看出哪些已看、哪些未看。

### 1.2 设计方案

**整体结构**：页面纵向滚动，按 Phase 1→6 分为 6 个区块。每个区块包含 Phase 标题横幅 + 该阶段电影卡片纵向列表。

**与 V1 方案差异**：每张电影卡片新增**已观看状态标识**。

### 1.3 页面结构（wxml）

```xml
<view class="mcu-page pano-page">
  <view class="page-head">
    <view class="page-title">宇宙全景图</view>
    <view class="page-sub">按 Phase 顺序观看 · 点击卡片进入详情</view>
  </view>

  <scroll-view scroll-y class="pano-timeline">
    <view wx:for="{{phaseGroups}}" wx:key="phase" class="phase-section">
      <!-- Phase 标题横幅 -->
      <view class="phase-header" style="border-left-color:{{item.color}}">
        <view class="phase-number" style="background:{{item.color}}">P{{item.phase}}</view>
        <view class="phase-info">
          <view class="phase-name">{{item.title}}</view>
          <view class="phase-years">{{item.years}}</view>
        </view>
        <view class="phase-count">{{item.watched}}/{{item.count}} 已看</view>
      </view>

      <!-- 电影卡片列表 -->
      <view class="movie-list">
        <view wx:for="{{item.movies}}" wx:for-item="movie" wx:key="id"
              class="movie-card {{movie.mainline?'card-mainline':''}} {{movie.upcoming?'card-upcoming':''}} {{movie.seen?'card-seen':''}}"
              data-id="{{movie.id}}" bindtap="goMovie">
          <!-- 电影海报 -->
          <view class="poster-wrap">
            <image wx:if="{{movie.poster && !_posterErr[movie.id]}}"
                   class="movie-poster" src="{{movie.poster}}" mode="aspectFill"
                   lazy-load="true" binderror="onPosterError" data-id="{{movie.id}}"/>
            <view wx:else class="poster-fallback" style="background:{{item.color}}">
              <text class="poster-first">{{movie.firstChar}}</text>
            </view>
            <!-- 已观看标记（右上角金色勾） -->
            <view wx:if="{{movie.seen}}" class="seen-badge">✓</view>
          </view>

          <!-- 电影信息 -->
          <view class="movie-info">
            <view class="movie-cn">{{movie.cn}}</view>
            <view class="movie-en">{{movie.en}}</view>
            <view class="movie-meta">
              <text class="movie-year">{{movie.year}}</text>
              <view class="movie-tag" style="background:{{item.color}}20; color:{{item.color}}">
                Phase {{item.phase}}
              </view>
              <view wx:if="{{movie.mainline}}" class="movie-tag tag-mainline">主线</view>
              <view wx:if="{{movie.starter}}" class="movie-tag tag-starter">推荐入门</view>
            </view>
          </view>

          <!-- 右侧箭头 -->
          <view class="movie-arrow">›</view>
        </view>
      </view>
    </view>

    <!-- 待映占位 -->
    <view wx:if="{{upcoming.length}}" class="upcoming-section">
      <view class="upcoming-label">即将上映</view>
      <view wx:for="{{upcoming}}" wx:key="id" class="movie-card card-upcoming" data-id="{{item.id}}">
        <view class="poster-wrap">
          <view class="poster-fallback" style="background:var(--surface-3)">
            <text class="poster-first">{{item.firstChar}}</text>
          </view>
        </view>
        <view class="movie-info">
          <view class="movie-cn">{{item.cn}}</view>
          <view class="movie-en">{{item.year}}</view>
        </view>
      </view>
    </view>
  </scroll-view>
</view>
```

### 1.4 已观看状态规格

**数据来源**：`userState.isSeen(id)` — 返回 boolean，从 `mcu_nav_user_v1` storage 读取。

**视觉表现**：
- **已观看卡片**：整体 opacity 0.75，海报右上角叠加金色 ✓ 标记（24rpx 圆圈，背景 `var(--gold)`，白色勾号）
- **未观看卡片**：正常显示，opacity 1.0
- **Phase 标题**：显示 "已看/总数" 计数（如 "3/6 已看"）

**JS 数据组装**：
```javascript
const userState = require('../../models/userState.js');
// 在 onLoad 中：
const seenIds = userState.seenIds(); // 所有已看 content id
// 每部电影附加 seen: seenIds.indexOf(movieId) >= 0
// 每个 Phase 附加 watched: 该 phase 内已看数量
```

**注意**：userState.isSeen 的 id 是 content id（与 movie id 一致），需确认 PANO_MOVIES 中的 id 与 movies.js 中的 id 完全对应（已核验：一致）。

### 1.5 视觉规格

**页面头部**
- 标题：`var(--fs-display-sm)` / 700 / `var(--text-main)`
- 副标题：`var(--fs-mini)` / 400 / `var(--text-sub)`
- 内边距：`var(--space-lg) var(--page-x) var(--space-sm)`

**Phase 标题横幅**
- 高度：88rpx
- 左侧竖线：6rpx 宽，颜色 = 该 Phase 色
- Phase 编号圆圈：56rpx × 56rpx，圆角 50%，背景 = Phase 色，文字白色 700 24rpx
- Phase 名称：`var(--fs-body)` / 600 / `var(--text-main)`
- 年份范围：`var(--fs-mini)` / 400 / `var(--text-sub)`
- 已看计数：`var(--fs-caption)` / 400 / `var(--text-weak)`，右对齐
- 背景：`var(--surface-1)`，圆角：`var(--radius-md)`，内边距：`var(--space-sm) var(--space-md)`

**电影卡片**
- 布局：水平排列（海报 | 信息 | 箭头）
- 背景：`var(--surface-2)`，圆角：`var(--radius-lg)`
- 边框：1rpx solid `var(--surface-3)`
- 主线卡片：左边框 4rpx solid Phase 色
- 待映卡片：opacity 0.6，border-style dashed
- 已观看卡片：opacity 0.75
- 内边距：`var(--space-sm)`，卡片间距：`var(--space-sm)`

**电影海报**
- 尺寸：100rpx × 140rpx（竖版 ≈ 2:3）
- 圆角：`var(--radius-sm)`
- 已观看 ✓ 标记：右上角 36rpx × 36rpx 圆圈，背景 `var(--gold)`，白色 ✓ 20rpx 700
- 加载失败兜底：Phase 色渐变 + 电影名首字

**电影信息区**
- 中文片名：`var(--fs-body)` / 600 / `var(--text-main)`，单行截断
- 英文片名：`var(--fs-caption)` / 400 / `var(--text-sub)`，单行截断
- 年份：`var(--fs-mini)` / 400 / `var(--text-weak)`
- Phase 标签：`var(--fs-mini)` / 600，背景 = Phase 色 20% alpha，文字 = Phase 色
- 主线标签：`var(--fs-mini)` / 600，背景 `var(--gold-a10)`，文字 `var(--gold)`
- 推荐入门标签：同上金色样式

### 1.6 关键 WXSS

```css
.pano-page { display: flex; flex-direction: column; min-height: 100vh; background: var(--bg); }
.pano-timeline { flex: 1; padding: 0 var(--page-x); }
.phase-section { margin-bottom: var(--space-lg); }

.phase-header {
  display: flex; align-items: center;
  background: var(--surface-1); border-radius: var(--radius-md);
  padding: var(--space-sm) var(--space-md);
  border-left: 6rpx solid var(--p1); /* 各 Phase 覆盖 */
  margin-bottom: var(--space-sm);
}
.phase-number {
  width: 56rpx; height: 56rpx; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: var(--fs-caption); font-weight: 700; color: var(--white);
  margin-right: var(--space-sm); flex-shrink: 0;
}
.phase-info { flex: 1; }
.phase-name { font-size: var(--fs-body); font-weight: 600; color: var(--text-main); }
.phase-years { font-size: var(--fs-mini); color: var(--text-sub); margin-top: 4rpx; }
.phase-count { font-size: var(--fs-caption); color: var(--text-weak); flex-shrink: 0; }

.movie-card {
  display: flex; align-items: center;
  background: var(--surface-2); border: 1rpx solid var(--surface-3);
  border-radius: var(--radius-lg); padding: var(--space-sm);
  margin-bottom: var(--space-sm);
}
.card-mainline { border-left: 4rpx solid var(--gold); }
.card-upcoming { opacity: 0.6; border-style: dashed; }
.card-seen { opacity: 0.75; }

.poster-wrap { position: relative; flex-shrink: 0; margin-right: var(--space-sm); }
.movie-poster { width: 100rpx; height: 140rpx; border-radius: var(--radius-sm); display: block; }
.poster-fallback {
  width: 100rpx; height: 140rpx; border-radius: var(--radius-sm);
  display: flex; align-items: center; justify-content: center;
}
.poster-first { font-size: var(--fs-title); font-weight: 700; color: var(--white); }
.seen-badge {
  position: absolute; top: -6rpx; right: -6rpx;
  width: 36rpx; height: 36rpx; border-radius: 50%;
  background: var(--gold); color: var(--white);
  font-size: 20rpx; font-weight: 700;
  display: flex; align-items: center; justify-content: center;
}

.movie-info { flex: 1; min-width: 0; }
.movie-cn {
  font-size: var(--fs-body); font-weight: 600; color: var(--text-main);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.movie-en {
  font-size: var(--fs-caption); color: var(--text-sub); margin-top: 4rpx;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.movie-meta { display: flex; align-items: center; gap: var(--space-xs); margin-top: var(--space-xs); flex-wrap: wrap; }
.movie-year { font-size: var(--fs-mini); color: var(--text-weak); }
.movie-tag {
  font-size: var(--fs-mini); font-weight: 600; padding: 2rpx 12rpx;
  border-radius: var(--radius-full);
}
.tag-mainline { background: var(--gold-a10); color: var(--gold); }
.tag-starter { background: var(--gold-a10); color: var(--gold); }

.movie-arrow { font-size: var(--fs-title); color: var(--text-weak); margin-left: var(--space-xs); flex-shrink: 0; }
```

### 1.7 数据纪律

- **pano.js 模型零改动**：PANO_MOVIES / PANO_CONN / PHASE_COLS / LAYOUT 全部保留。新页面只使用 PANO_MOVIES（按 Phase 分组展示），不再需要 PANO_CONN 和 LAYOUT。
- **visuals.js / mcuData.js 零改动**。
- **新增依赖**：userState.js（读取已观看状态）。
- **panorama.wxml/wxss 完全重写**，panorama.js 重写 onLoad 数据组装 + 删除 drawLines/Canvas 代码。

---

## 二、关系探索（explore）— 卡片列表默认 + Canvas 高级入口（混合方案）

### 2.1 设计变更说明

> GPT 最终验收指令：保留 Canvas，但移动端默认展示关系卡片。Canvas 作为高级查看入口。避免手机出现空白区域。

**V1 方案**：Canvas 2D 网络图（有空白渲染风险）
**V2 方案**：纯卡片列表（完全删除 Canvas）
**V3 终版（当前）**：混合方案 — 卡片列表为默认视图，Canvas 网络图保留为"网络视图"切换入口

### 2.2 交互设计

**双视图切换**：
- 默认进入页面 → 显示**列表视图**（卡片列表，零 Canvas 风险）
- 筛选 Chips 下方增加**视图切换按钮**："列表视图" / "网络视图"
- 点击"网络视图" → 切换到 Canvas 网络图（此时初始化 Canvas 并绘制）
- 点击"列表视图" → 切回卡片列表
- 切换时保持当前中心角色和筛选状态

**关键原则**：
- Canvas 只在用户主动切换到"网络视图"时才初始化绘制（懒加载），避免页面打开时 Canvas 空白
- Canvas 初始化前先显示 loading 状态，绘制完成后替换
- 如果 Canvas 初始化失败（极端情况），显示错误提示并自动退回列表视图

### 2.3 页面结构（wxml）

```xml
<view class="mcu-page explore-page">
  <!-- 页面头部 -->
  <view class="page-head">
    <view class="page-title">关系探索</view>
    <view class="page-sub">探索 MCU 角色之间的关系网络</view>
  </view>

  <!-- 中心角色卡片（大卡，两种视图共用） -->
  <view class="center-card" bindtap="onCenterTap">
    <view class="center-avatar fring-{{centerCls}}">
      <image wx:if="{{centerAvatar}}" class="fill-img" src="{{centerAvatar}}"
             mode="aspectFill" binderror="onCenterImgError"/>
      <view wx:else class="center-fallback fbg-{{centerCls}}">{{centerFirst}}</view>
    </view>
    <view class="center-info">
      <view class="center-name">{{centerName}}</view>
      <view class="center-camp" style="color:{{centerCampColor}}">{{centerCampLabel}}</view>
      <view class="center-hint">点击切换角色</view>
    </view>
  </view>

  <!-- 筛选 Chips + 视图切换 -->
  <view class="toolbar-row">
    <scroll-view scroll-x class="filter-row" enable-flex>
      <view class="filter-inner">
        <view wx:for="{{filters}}" wx:key="key"
              class="chip {{activeFilter == item.key ? 'chip-active' : ''}}"
              data-key="{{item.key}}" bindtap="onFilter">
          {{item.label}}
        </view>
      </view>
    </scroll-view>
    <!-- 视图切换按钮 -->
    <view class="view-toggle" bindtap="toggleView">
      <view class="toggle-btn {{viewMode == 'list' ? 'toggle-active' : ''}}">列表</view>
      <view class="toggle-btn {{viewMode == 'network' ? 'toggle-active' : ''}}">网络</view>
    </view>
  </view>

  <!-- 列表视图（默认） -->
  <view wx:if="{{viewMode == 'list'}}" class="list-view">
    <view class="section-label">关系（{{relations.length}}）</view>
    <view class="relation-list">
      <view wx:for="{{relations}}" wx:key="id" class="relation-card"
            data-id="{{item.id}}" bindtap="goCharacter" hover-class="rel-card-hover">
        <view class="rel-avatar-wrap">
          <view class="rel-avatar fring-{{item.campCls}}">
            <image wx:if="{{item.avatar && !_imgErr[item.id]}}" class="fill-img"
                   src="{{item.avatar}}" mode="aspectFill" lazy-load="true"
                   binderror="onImgError" data-id="{{item.id}}"/>
            <view wx:else class="rel-fallback fbg-{{item.campCls}}">{{item.first}}</view>
          </view>
        </view>
        <view class="rel-content">
          <view class="rel-name">{{item.name}}</view>
          <view class="rel-detail">
            <text class="rel-type rel-{{item.type}}">{{item.typeLabel}}</text>
            <text class="rel-sep">·</text>
            <text class="rel-shared">共同出演 {{item.shared}} 部</text>
          </view>
        </view>
        <view class="rel-arrow">›</view>
      </view>
    </view>
  </view>

  <!-- 网络视图（Canvas，按需加载） -->
  <view wx:if="{{viewMode == 'network'}}" class="network-view">
    <view wx:if="{{!canvasReady}}" class="canvas-loading">
      <view class="loading-text">正在绘制关系网络...</view>
    </view>
    <view class="canvas-wrap" style="{{canvasReady ? '' : 'opacity:0;height:0;'}}">
      <canvas type="2d" id="relCanvas" class="relation-canvas" bindtap="onCanvasTap"></canvas>
    </view>
    <view class="canvas-hint">点击节点切换中心角色 · 连线颜色代表关系类型</view>
  </view>

  <view class="bottom-pad"></view>
</view>
```

### 2.4 视觉规格

**中心角色卡片**（两种视图共用）
- 整体：水平布局（头像 | 信息），背景 `var(--surface-1)`，圆角 `var(--radius-xl)`
- 头像：96rpx × 96rpx，圆形，阵营色描边 3rpx
- 角色名：`var(--fs-title)` / 700 / `var(--text-main)`
- 阵营名：`var(--fs-caption)` / 400 / 阵营色
- 提示文字：`var(--fs-mini)` / 400 / `var(--text-weak)`

**工具栏（筛选 + 视图切换）**
- 筛选 Chips 行：保持现有 5 种（全部/盟友/敌人/师徒/家人）
- 视图切换按钮：位于 Chips 行右侧或下方
  - 两个按钮："列表" / "网络"
  - 当前激活：`var(--gold)` 文字 + `var(--gold-a10)` 背景
  - 未激活：`var(--text-sub)` 文字 + 透明背景
  - 按钮尺寸：高度 48rpx，padding 0 20rpx，圆角 `var(--radius-full)`
  - 整体背景：`var(--surface-1)`，圆角 `var(--radius-full)`

**关系卡片**（列表视图）
- 水平布局（头像 | 信息 | 箭头）
- 背景：`var(--surface-2)`，圆角 `var(--radius-lg)`
- 头像：72rpx × 72rpx，圆形，阵营色描边 2rpx
- 角色名：`var(--fs-body)` / 600 / `var(--text-main)`
- 关系类型：`var(--fs-caption)` / 600 / 关系功能色
- 共同出演数：`var(--fs-mini)` / 400 / `var(--text-weak)`

**Canvas 网络视图**
- Canvas 尺寸：750rpx × 600rpx（保持现有）
- 圆角：`var(--radius-lg)`
- 背景：`var(--bg)`（Canvas 内部绘制 `#080B12`）
- 底部提示文字：`var(--fs-mini)` / 400 / `var(--text-weak)`，居中
- Canvas 绘制逻辑保持现有代码（paint / paintNode / avatarImage / onCanvasTap）

### 2.5 JS 逻辑变更

**新增 data 字段**：
```javascript
data: {
  viewMode: 'list',      // 'list' | 'network'
  canvasReady: false,     // Canvas 是否已绘制
  // ... 其余保持现有
}
```

**新增 toggleView 方法**：
```javascript
toggleView: function() {
  var newMode = this.data.viewMode === 'list' ? 'network' : 'list';
  this.setData({ viewMode: newMode });
  if (newMode === 'network' && !this.data.canvasReady) {
    // 首次切换到网络视图时初始化 Canvas
    var self = this;
    setTimeout(function() {
      self.drawGraph();
    }, 100); // 延迟确保 DOM 渲染完成
  }
}
```

**修改 drawGraph**：绘制完成后设置 `canvasReady: true`

**保留全部现有 Canvas 代码**：drawGraph / paint / paintNode / avatarImage / onCanvasTap / _nodePos — 全部保留，仅在用户切换到网络视图时调用。

**保留全部数据逻辑**：SPECIAL_RELATIONS / coCount / relationOf / relationsOfChar / setCenter / onFilter / applyFilter / goCharacter / onImgError — 全部不变。

**setCenter 调整**：切换中心角色时，如果当前是网络视图，需要重绘 Canvas：
```javascript
setCenter: function(id) {
  // ... 现有逻辑 ...
  if (this.data.viewMode === 'network') {
    this.drawGraph(); // 网络视图下重绘
  }
}
```

### 2.6 关键 WXSS

```css
/* 工具栏 */
.toolbar-row {
  display: flex; align-items: center; gap: var(--space-xs);
  margin-bottom: var(--space-md);
}
.filter-row { flex: 1; white-space: nowrap; }

.view-toggle {
  display: flex; gap: 4rpx;
  background: var(--surface-1); border-radius: var(--radius-full);
  padding: 4rpx; flex-shrink: 0;
}
.toggle-btn {
  height: 48rpx; padding: 0 20rpx;
  border-radius: var(--radius-full);
  font-size: var(--fs-mini); font-weight: 600;
  color: var(--text-sub);
  display: flex; align-items: center; justify-content: center;
}
.toggle-active { color: var(--gold); background: var(--gold-a10); }

/* 列表视图 */
.list-view { /* 无特殊样式，由内部元素控制 */ }

/* 网络视图 */
.network-view { position: relative; }
.canvas-wrap {
  border-radius: var(--radius-lg); overflow: hidden;
  border: 1rpx solid var(--surface-3); background: var(--bg);
  transition: opacity 0.3s;
}
.relation-canvas { width: 100%; height: 600rpx; display: block; }
.canvas-loading {
  height: 600rpx; display: flex; align-items: center; justify-content: center;
  background: var(--surface-1); border-radius: var(--radius-lg);
}
.loading-text { font-size: var(--fs-caption); color: var(--text-sub); }
.canvas-hint {
  font-size: var(--fs-mini); color: var(--text-weak);
  text-align: center; padding: var(--space-sm) 0;
}
```

### 2.7 与 V1/V2 对比

| 维度 | V1（纯Canvas） | V2（纯列表） | V3 终版（混合） |
|------|-------------|-------------|---------------|
| 默认视图 | Canvas 网络图 | 卡片列表 | 卡片列表 |
| Canvas | 始终渲染 | 删除 | 按需渲染（切换后） |
| 空白风险 | 高 | 无 | 无（列表兜底） |
| 视觉丰富度 | 高 | 中 | 高（两种视图） |
| 代码量 | 中 | 少 | 中（保留 Canvas 代码） |
| 用户体验 | 需等 Canvas | 即时可用 | 即时可用 + 可选网络图 |

---

## 三、分享海报（share）— 宇宙视觉全面升级

### 3.1 设计目标

用户愿意保存并分享到朋友圈/小红书。不做纯数据截图。

### 3.2 通用变更（三类型共享）

**宇宙背景**：
- 底层：深色渐变（从 `#0A0F1A` 到 `#080B12`，自上而下）
- 星点层：~60 个伪随机光点（固定种子 seededRandom），大小 0.5~2px，alpha 0.1~0.4
- 顶部/底部各一条微弱金色光带（水平渐变线，alpha 0.06~0.08）

**品牌栏升级**：
- 品牌名 `var(--gold)` 色 600 24px（保持）
- 装饰线改为金色渐变（中间亮两端淡出）
- 新增：品牌名左侧简化盾牌轮廓（Canvas 绘制）

**底部区域**：
- 小程序码占位改为圆角矩形（radius 12px）
- Slogan 保持

### 3.3 progress 类型（观影进度）

```
y=0     ┌──────────────────────────┐
        │     ★ 宇宙背景 ★         │
y=50    │  [盾牌] MCU 宇宙导航      │
y=130   │  ─────────────────────    │
y=160   │    我的 MCU 旅程          │
y=220   │    已完成                 │
y=320   │    [大数字] / [总数]      │  ← 金色数字 + 灰色分母
y=400   │  [Phase pill 标签]       │
y=480   │    当前路线 · 路线名称     │
y=530   │  [========进度条=======]  │
y=600   │                          │
y=640   │  [最近观看的3部电影海报]  │  ← 真实海报横排
y=810   │                          │
y=850   │    [小程序码]             │
y=980   │    slogan                 │
        └──────────────────────────┘
```

**新增元素**：
- 最近观看 3 部电影真实海报（`visuals.visual(id).poster`），每张 100×150px，圆角 8px，间距 20px
- 海报通过 `canvas.createImage()` 异步加载，失败兜底 = Phase 色矩形+首字

### 3.4 route 类型（路线分享）

```
y=0     ┌──────────────────────────┐
        │     ★ 宇宙背景 ★         │
y=50    │  [盾牌] MCU 宇宙导航      │
y=160   │  我在走这条路线           │
y=240   │  [路线名称]               │
y=310   │  [tagline 金色]           │
y=370   │  已看 X / Y 部            │
y=410   │  [=====进度条=====]       │
y=480   │  ┌──路线描述卡片──┐      │
y=700   │  └────────────────┘      │
y=740   │  [路线前5部电影缩略海报]  │  ← 5张小海报
y=880   │    [小程序码]             │
y=1000  │    slogan                 │
        └──────────────────────────┘
```

**新增元素**：
- 路线前 5 部电影缩略海报（80×120px），已看正常显示，未看 `globalAlpha = 0.4`

### 3.5 movie 类型（电影分享）

```
y=0     ┌──────────────────────────┐
        │     ★ 宇宙背景 ★         │
y=50    │  [盾牌] MCU 宇宙导航      │
y=160   │  [电影中文名]             │
y=210   │  [电影英文名]             │
y=270   │  ┌──────┐                │
y=270   │  │ 真实  │  Phase X       │  ← 真实海报 180×270
y=540   │  └──────┘  简介文字...    │
y=620   │            在MCU中的位置  │
y=700   │  [角色头像组 前4位]       │  ← 圆形头像横排
y=800   │                          │
y=850   │    [小程序码]             │
y=970   │    slogan                 │
        └──────────────────────────┘
```

**关键变更**：
- 海报区从阶段色矩形改为**真实海报图片**（`visuals.visual(id).poster`）
- 新增电影主要角色头像组（`chars` 数组前 4 位，圆形 36px 头像横排）

### 3.6 图片加载方案

```javascript
// 通用图片加载+绘制
drawPoster: function(ctx, url, x, y, w, h, radius, fallbackFn) {
  if (!url) { fallbackFn(); return; }
  var img = this._canvas.createImage();
  img.onload = function() {
    ctx.save();
    if (radius > 0) {
      ctx.beginPath();
      ctx.moveTo(x + radius, y);
      ctx.arcTo(x + w, y, x + w, y + h, radius);
      ctx.arcTo(x + w, y + h, x, y + h, radius);
      ctx.arcTo(x, y + h, x, y, radius);
      ctx.arcTo(x, y, x + w, y, radius);
      ctx.closePath();
      ctx.clip();
    }
    ctx.drawImage(img, x, y, w, h);
    ctx.restore();
  }.bind(this);
  img.onerror = function() { fallbackFn(); }.bind(this);
  img.src = url;
},
```

**异步流程**：
1. 先绘制背景 + 文字 + 装饰（不依赖图片的部分）
2. 图片区域先画兜底色
3. 异步加载图片，onload 后覆盖绘制
4. 所有图片加载完成后调用 `wx.canvasToTempFilePath` 生成最终海报

### 3.7 share.js 变更清单

- 新增 `const visuals = require('../../data/visuals.js');`
- 新增 `drawCosmicBg(ctx, W, H)` — 宇宙背景绘制
- 新增 `drawBrandShield(ctx, x, y, size)` — 简化盾牌图形
- 新增 `drawPoster(ctx, url, x, y, w, h, radius, fallbackFn)` — 图片加载+绘制
- 修改 `drawProgress()` — 增加最近 3 部电影海报
- 修改 `drawRoute()` — 增加路线前 5 部缩略海报
- 修改 `drawMovie()` — 改用真实海报 + 角色头像组
- **shareData.js 零改动**（画布尺寸 750×1100 不变）
- **wxml/wxss 基本不变**

---

## 四、开发实现优先级

| 优先级 | 页面 | 任务 | 理由 |
|--------|------|------|------|
| P0 | - | 头像 CDN 修复 | 影响所有页面头像显示（待用户确认域名白名单） |
| P1 | explore | 卡片列表重构（删 Canvas） | 消除空白风险，确保移动端可用 |
| P1 | panorama | 纵向时间轴 + 已观看状态 | 当前横向布局不可用 |
| P2 | share | 宇宙背景 + 真实图片 | 视觉增强 |
| P2 | my-mcu | 成就模块图标升级 | 消除"纯文字"感，提升视觉品质 |

---

## 五、验收标准

### 5.1 panorama

- [ ] 纵向滚动，Phase 1→6 依次展示
- [ ] 每个 Phase 区块含标题横幅（Phase 编号 + 名称 + 年份 + 已看/总数）
- [ ] 每张电影卡片含：海报图、中文片名、英文片名、年份、Phase 标签、主线/推荐入门标签
- [ ] 已观看电影：opacity 0.75 + 海报右上角金色 ✓ 标记
- [ ] 未观看电影：正常显示
- [ ] 点击卡片跳转电影详情页
- [ ] 待映电影半透明+虚线边框
- [ ] 海报加载失败显示 Phase 色兜底

### 5.2 explore

- [ ] 页面顶部显示中心角色大头像 + 名称 + 阵营
- [ ] 点击中心角色可切换（ActionSheet 列出 24 角色）
- [ ] 筛选 Chips 联动列表
- [ ] **默认显示列表视图**（卡片列表，无空白区域）
- [ ] 关系卡片列表正常显示：头像 + 角色名 + 关系类型（功能色）+ 共同出演数
- [ ] 头像加载失败显示阵营首字兜底
- [ ] 点击关系卡片跳转角色详情页
- [ ] **视图切换按钮**："列表" / "网络" 可切换
- [ ] 切换到"网络"后 Canvas 正常渲染（无空白）
- [ ] Canvas 中点击节点可切换中心角色
- [ ] 切回"列表"后卡片列表正常显示
- [ ] 页面**无空白区域、无大面积不可读区域**

### 5.3 share

- [ ] 海报背景有宇宙星点效果
- [ ] progress 类型：大数字 + Phase 标签 + 最近 3 部电影真实海报
- [ ] route 类型：路线信息 + 前 5 部电影缩略海报（已看正常/未看灰度）
- [ ] movie 类型：真实电影海报 + 角色头像组 + 简介
- [ ] 图片加载失败有兜底显示
- [ ] 保存到相册功能正常
- [ ] 转发功能正常

### 5.4 my-mcu 成就模块

- [ ] 6 个成就徽章显示语义图标（非单字文字）
- [ ] 图标资源正确加载（ach-first-step / ach-phase-1 / ach-infinity / ach-newcomer / ach-collector / ach-sharer）
- [ ] 图标加载失败显示首字兜底
- [ ] 已获得徽章：金色描边 + 对应分组色背景 + 图标全彩
- [ ] 未获得徽章：灰色描边 + 深灰背景 + 图标灰度
- [ ] 分组配色正确（里程=绿/阶段=蓝/路线=紫/探索=金/分享=红）
- [ ] 横向滚动顺畅，6 个徽章完整展示
- [ ] 点击已获得 → 展示成就名 toast
- [ ] 点击未获得 → 展示解锁条件 toast
- [ ] 徽章尺寸 96rpx × 96rpx，间距合理

---

## 六、成就模块视觉升级设计（my-mcu）

### 6.1 现状分析

**当前实现**（my-mcu.wxml:31-40 + my-mcu.wxss:231-275）：
- 横向滚动列表，6 个成就徽章
- 每个徽章 = 96rpx 圆形 + 单字文字图标（一/壹/无/新/藏/享）
- 已获得：金色底 + 金色描边 + 金色文字
- 未获得：灰色底 + 灰色描边 + 灰色文字

**问题**：
1. 单字图标缺乏辨识度，"一/壹/无/新/藏/享" 视觉同质化严重
2. 纯圆形 + 单字 = 纯文字感，与 V1.2 图片驱动方向不符
3. 无分组色彩区分（里程/阶段/路线/探索/分享 5 组视觉相同）

### 6.2 升级方案

**核心变更**：单字文字 → 语义 PNG 图标

| 成就 ID | 名称 | 分组 | 图标文件名 | 图标语义 | 分组色 |
|---------|------|------|-----------|---------|--------|
| first-step | 初入漫威 | 里程 | ach-first-step.png | 五角星（里程碑） | --success #3FB98A |
| phase-1-done | 第一阶段完成 | 阶段 | ach-phase-1.png | 盾牌（阶段标志） | --accent-blue #4A9EF5 |
| infinity-explorer | 无限传奇探索者 | 阶段 | ach-infinity.png | 无穷符号（∞） | --accent-blue #4A9EF5 |
| newcomer-done | 新手入坑完成 | 路线 | ach-newcomer.png | 指南针（方向/路线） | --accent-purple #9B7FE8 |
| collector-5 | 收藏家 | 探索 | ach-collector.png | 宝石（收藏/珍品） | --gold #F2B233 |
| sharer-1 | 分享新人 | 分享 | ach-sharer.png | 箭头（分享/发送） | --accent-red #E85D5D |

**图标资源**：
- 路径：`assets/achievements/ach-{id}.png`
- 尺寸：192×192px（2x 适配 96rpx 显示）
- 格式：PNG（透明背景 + 金色图形）
- 单文件大小：4~6KB，总计 ~31KB
- 风格：深色圆底（#1E2636）+ 金色几何图形（#F2B233）+ 细描边圆环（#2A3447）

### 6.3 数据层变更（achievements.js）

在 `ACHIEVEMENTS` 数组中为每项新增 `groupColor` 字段，映射分组强调色：

```js
// 新增字段（不影响现有 test/icon/group/name/desc）
const GROUP_COLORS = {
  '里程': 'var(--success)',
  '阶段': 'var(--accent-blue)',
  '路线': 'var(--accent-purple)',
  '探索': 'var(--gold)',
  '分享': 'var(--accent-red)'
};
```

页面层 my-mcu.js 在 `refresh()` 中为每个成就追加 `iconPath` 和 `groupColor`：

```js
// refresh() 中 achievements 数据处理
var ICON_MAP = {
  'first-step': '/assets/achievements/ach-first-step.png',
  'phase-1-done': '/assets/achievements/ach-phase-1.png',
  'infinity-explorer': '/assets/achievements/ach-infinity.png',
  'newcomer-done': '/assets/achievements/ach-newcomer.png',
  'collector-5': '/assets/achievements/ach-collector.png',
  'sharer-1': '/assets/achievements/ach-sharer.png'
};
var COLOR_MAP = {
  '里程': 'var(--success)',
  '阶段': 'var(--accent-blue)',
  '路线': 'var(--accent-purple)',
  '探索': 'var(--gold)',
  '分享': 'var(--accent-red)'
};
// 在 achievements.all() 结果上追加 iconPath/groupColor
```

**数据纪律**：achievements.js 模型本身不改（保持独立模型原则），仅在页面层 my-mcu.js 追加展示字段。

### 6.4 wxml 结构变更

**当前**（my-mcu.wxml:34-39）：
```xml
<view class="ach-badge {{item.gained ? 'gained' : ''}}">{{item.icon}}</view>
```

**改为**：
```xml
<view class="ach-badge {{item.gained ? 'gained' : ''}} ach-group-{{item.groupCls}}">
  <image wx:if="{{item.iconPath}}" class="ach-icon" src="{{item.iconPath}}"
         mode="aspectFit" binderror="onAchImgError" />
  <text wx:else class="ach-icon-fallback">{{item.icon}}</text>
</view>
```

**变更要点**：
- `<text>` 单字 → `<image>` PNG 图标 + `<text>` 兜底
- 新增 `ach-group-{groupCls}` 分组色类（里程/阶段/路线/探索/分享 → 英文类名）
- 新增 `binderror="onAchImgError"` 图标加载失败兜底

### 6.5 wxss 样式变更

**当前**（my-mcu.wxss:246-264）：
```css
.ach-badge {
  width: 96rpx; height: 96rpx; border-radius: 50%;
  background: var(--surface-3); border: 2rpx solid var(--surface-3);
  color: var(--text-weak);
}
.ach-badge.gained {
  background: var(--gold-a14); border-color: var(--gold-a50); color: var(--gold);
}
```

**改为**：
```css
.ach-badge {
  width: 96rpx; height: 96rpx; border-radius: 50%;
  background: var(--surface-2); border: 2rpx solid var(--surface-3);
  display: flex; align-items: center; justify-content: center;
  overflow: hidden; position: relative;
}

/* 图标 */
.ach-icon {
  width: 64rpx; height: 64rpx;
}
.ach-icon-fallback {
  font-size: var(--fs-display-sm); font-weight: 700;
  color: var(--text-weak);
}

/* 已获得状态 */
.ach-badge.gained {
  border-color: var(--gold-a50);
  box-shadow: var(--glow-gold);
}
.ach-badge.gained .ach-icon-fallback {
  color: var(--gold);
}

/* 分组配色（已获得时生效） */
.ach-badge.gained.ach-group-milestone { background: var(--success-a10); border-color: var(--success-a30); }
.ach-badge.gained.ach-group-phase     { background: var(--accent-blue-a10); border-color: var(--accent-blue-a20); }
.ach-badge.gained.ach-group-route     { background: var(--accent-purple-a10); border-color: var(--accent-purple-a20); }
.ach-badge.gained.ach-group-explore   { background: var(--gold-a14); border-color: var(--gold-a50); }
.ach-badge.gained.ach-group-share     { background: var(--accent-red-a10); border-color: var(--accent-red-a20); }
```

**新增 Token 引用**：
- `--success-a10 / --success-a30`（里程组）
- `--accent-blue-a10 / --accent-blue-a20`（阶段组）
- `--accent-purple-a10 / --accent-purple-a20`（路线组）
- `--gold-a14 / --gold-a50`（探索组，沿用现有金色）
- `--accent-red-a10 / --accent-red-a20`（分享组）
- `--glow-gold`（已获得金色光晕）

以上 Token 均在 app.wxss 中已定义，零新增 Token。

### 6.6 JS 变更（my-mcu.js）

**新增方法**：
```js
onAchImgError: function (e) {
  // 图标加载失败 → 回退到单字文字（已有兜底机制）
  var id = e.currentTarget.dataset.id;
  var key = '_achErr_' + id;
  var upd = {};
  upd[key] = true;
  this.setData(upd);
}
```

**修改 refresh()**：为 achievements 数据追加展示字段：
```js
var ICON_MAP = { /* 6 项映射 */ };
var GROUP_CLS = { '里程': 'milestone', '阶段': 'phase', '路线': 'route', '探索': 'explore', '分享': 'share' };
var achList = achievements.all().map(function (a) {
  return Object.assign({}, a, {
    iconPath: ICON_MAP[a.id] || '',
    groupCls: GROUP_CLS[a.group] || ''
  });
});
```

### 6.7 视觉对比

| 维度 | 升级前 | 升级后 |
|------|--------|--------|
| 图标 | 单字文字（一/壹/无/新/藏/享） | 语义 PNG 图标（星/盾//指南针/宝石/箭头） |
| 分组区分 | 无（全部金色/灰色） | 5 组配色（绿/蓝/紫/金/红） |
| 已获得视觉 | 金色底+金色字 | 分组色底+金色描边+光晕+全彩图标 |
| 未获得视觉 | 灰色底+灰色字 | 深灰底+灰色描边+灰度图标 |
| 加载失败 | 无 | 回退到单字文字兜底 |

### 6.8 文件清单

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `assets/achievements/ach-first-step.png` | 新增 | 星形图标 |
| `assets/achievements/ach-phase-1.png` | 新增 | 盾牌图标 |
| `assets/achievements/ach-infinity.png` | 新增 | 无穷图标 |
| `assets/achievements/ach-newcomer.png` | 新增 | 指南针图标 |
| `assets/achievements/ach-collector.png` | 新增 | 宝石图标 |
| `assets/achievements/ach-sharer.png` | 新增 | 箭头图标 |
| `pages/my-mcu/my-mcu.wxml` | 修改 | 徽章结构（image + fallback） |
| `pages/my-mcu/my-mcu.wxss` | 修改 | 分组配色 + 图标样式 |
| `pages/my-mcu/my-mcu.js` | 修改 | 追加 iconPath/groupCls + onAchImgError |
| `models/achievements.js` | **不改** | 保持独立模型原则 |
