# MCU V1.2 视觉验收报告

> 验收时间：2026-08-25
> 验收人：QoderWork CN（设计AI）
> 验收对象：开发AI（Work）基础页面实现
> 验收方式：逐文件代码审查，对照《页面视觉升级方案》《开发视觉标注》《视觉验收清单》
> 验收范围：首页 / 电影详情 / 角色详情 / 关系探索 / 全局Token / visuals.js

---

## 一、总览

| 页面 | 状态 | P0 | P1 | P2 | 结论 |
|------|------|-----|-----|-----|------|
| 首页 | ✅ 基本通过 | 0 | 2 | 1 | 结构/规范合规，细节微调 |
| 电影详情 | ⚠️ 条件通过 | 1 | 2 | 1 | CTA字号违规需修，其余合规 |
| 角色详情 | ❌ 未通过 | 5 | 2 | 1 | **仍为V1.1旧结构，需按V1.2重做** |
| 关系探索 | ❌ 未通过 | 4 | 1 | 0 | **仍为V1.1入口聚合页，需按V1.2重做** |
| 全局Token | ✅ 通过 | 0 | 1 | 0 | Token体系基本完整 |
| visuals.js | ⚠️ 部分完成 | 1 | 1 | 0 | 38张海报已接入，角色/背景/阶段图缺失 |

**总结：首页 + 电影详情 基本达标（修少量P0/P1即可）；角色详情 + 关系探索 仍为V1.1旧实现，需按V1.2设计稿重做。**

---

## 二、首页验收（home.wxml / home.wxss / home.js）

### 通过项 ✅

| 检查项 | 结果 | 代码位置 |
|--------|------|---------|
| H-01 旅程进度卡存在 | ✅ | home.wxml L14-31 |
| H-02 进度数字 56rpx/700/--gold | ✅ | .journey-num: var(--fs-display)/700/var(--gold) |
| H-05 推荐大卡存在，海报区 360rpx | ✅ | .rec-poster-wrap height:360rpx |
| H-07 CTA 88rpx/--gold/--glow-gold | ✅ | .btn-accent 全合规 |
| H-09 宇宙入口3列，200rpx高，20rpx圆角 | ✅ | .exp-card 全合规 |
| H-10 三入口氛围色：蓝/红/紫 | ✅ | .exp-blue/.exp-red/.exp-purple |
| H-12 热门角色 96rpx 圆形 + 阵营色描边 | ✅ | .char-avatar 96rpx/50%/3rpx border |
| H-14 最近观看 120×160rpx 海报 | ✅ | .recent-poster 120×160rpx |
| H-15 片名 ellipsis 截断 | ✅ | .recent-name text-overflow:ellipsis |
| H-18 全页金色实心仅1个 | ✅ | 仅 .btn-accent 为金色实心 |
| G-02 零 raw hex | ✅ | home.wxss 全部 var() |
| G-05 字号仅5档 | ✅ | 全部使用 Token |
| G-06 字重仅400/600/700 | ✅ | 无500 |
| G-09 模块间距 56rpx | ✅ | .section margin-bottom: var(--space-xl) |
| G-10 页面边距 36rpx | ✅ | .home-page padding: var(--space-2xl) var(--page-x) |

### 问题项

| # | 问题 | 严重等级 | 修改方案 | 需要资源 |
|---|------|---------|---------|---------|
| H-P1-01 | 旅程卡背景为渐变占位，无实际背景图 | P1 | 待 home-bg.jpg 资源就位后，将 .journey-bg 改为 `<image>` 组件加载背景图 | 首页背景图 1张（home-bg.jpg） |
| H-P1-02 | 角色头像 poster 字段未从 visuals.js 取图（home.js L148 返回空字符串） | P1 | 在 visuals.js 中增加角色头像映射 `charAvatars`，home.js 中 `mcuData.visual('char-'+id)` 改为读取头像映射 | 角色头像 24张 + visuals.js 扩展 |
| H-P2-01 | 海报/头像兜底首字字号使用 --fs-display-sm(44rpx)，非标准5档之内 | P2 | 可接受（兜底态不面向用户常态），不改也可 | 无 |

---

## 三、电影详情页验收（movie.wxml / movie.wxss）

### 通过项 ✅

| 检查项 | 结果 | 代码位置 |
|--------|------|---------|
| M-02 海报 220×320rpx，圆角16rpx，border 4rpx --gold-a20 | ✅ | .poster 全合规 |
| M-03 电影名 36rpx/700/--text-main | ✅ | .hero-title: var(--fs-title)/700 |
| M-04 状态标签：未看金色胶囊/已看灰色 | ✅ | .watch-status.unwatched/.watched |
| M-06 推荐理由卡 --surface-2底/圆角20rpx | ✅ | .why-section 全合规 |
| M-07 推荐理由标签 --accent-blue | ✅ | .why-label: var(--accent-blue) |
| M-08 主要角色模块存在，80rpx圆形头像 | ✅ | .cast-section/.cast-avatar 80rpx |
| M-10 前后关联3列，当前卡高亮 | ✅ | .seq-card.current: --gold-a10底 |
| M-11 标记已看绿色描边 | ✅ | .mark-watched-btn: --success边框 |
| G-02 零 raw hex | ✅ | movie.wxss 全部 var() |

### 问题项

| # | 问题 | 严重等级 | 修改方案 | 需要资源 |
|---|------|---------|---------|---------|
| M-P0-01 | **CTA 按钮字号 var(--fs-title)=36rpx，设计稿要求 28rpx (--fs-body)；字重700，设计稿要求600** | P0 | movie.wxss `.movie-cta` 改为 `font-size: var(--fs-body); font-weight: 600;` | 无 |
| M-P1-01 | Hero 区背景仅有渐变占位，无实际场景图 | P1 | 待电影场景图资源就位后，将 .hero-bg 通过 inline style 设置背景图（当前已有 style="{{heroBg}}"，需 movie.js 注入 backdrop URL） | 电影场景图 59张 |
| M-P1-02 | .poster-letter / .seq-poster text / .next-rec-poster text 使用 font-weight:800 | P1 | 改为 700（800不在允许字重范围） | 无 |
| M-P2-01 | .seq-card.current 边框使用 --gold-a50，设计稿要求 --gold-a20 | P2 | movie.wxss `.seq-card.current` border-color 改为 var(--gold-a20) | 无 |

---

## 四、角色详情页验收（character.wxml / character.wxss）

### ❌ 整体判定：未通过 — 仍为 V1.1 旧结构，需按 V1.2 设计稿重做

| # | 问题 | 严重等级 | 修改方案 | 需要资源 |
|---|------|---------|---------|---------|
| C-P0-01 | **头像仍为阵营色圆圈+首字文字（`{{char.avatar}}`），未使用 `<image>` 组件** | P0 | 按V1.2设计稿 §4：Hero 区头像改为 `<image>` 组件加载真实角色照片，兜底阵营色渐变+首字 | 角色头像 24张 |
| C-P0-02 | **无 Hero 背景图** — 设计稿要求 750×500 角色场景图 + 阵营色氛围渐变 | P0 | 按V1.2设计稿 §4.2：Hero 区增加背景图 `<image>` + 叠加阵营色渐变 | 角色场景图 24张 |
| C-P0-03 | **首次出现/关联作品仍用阶段色方块+首字** — 设计稿要求真实海报 | P0 | 将 .film-letter 从 `<view style="background:phaseColor">` 改为 `<image>` 加载海报缩略图 | 海报已在 visuals.js 中，需接入 |
| C-P0-04 | **关系探索网格头像仍为阵营色圆圈+首字** — 设计稿要求真实角色照片 | P0 | 将 .related-avatar 从文字改为 `<image>` 组件 | 角色头像复用 |
| C-P0-05 | **卡片标题 .card-title 颜色为 var(--gold)** — 设计稿要求 var(--text-main) | P0 | character.wxss `.card-title` color 改为 var(--text-main) | 无 |
| C-P1-01 | .related-shared 字号 19rpx，非标准5档 | P1 | 改为 var(--fs-mini) = 22rpx | 无 |
| C-P1-02 | .hero-cn 使用 --fs-display-sm(44rpx)，设计稿标注角色名44rpx | P1 | 可接受（--fs-display-sm 在 app.wxss 中已定义），保留 | 无 |
| C-P2-01 | .film-letter 尺寸 72×72rpx，设计稿要求首次出现 120×180、关联作品 80×120 | P2 | 按设计稿调整尺寸 | 无 |

---

## 五、关系探索页验收（explore.wxml / explore.wxss）

### ❌ 整体判定：未通过 — 仍为 V1.1 入口聚合页，需按 V1.2 设计稿重做

| # | 问题 | 严重等级 | 修改方案 | 需要资源 |
|---|------|---------|---------|---------|
| R-P0-01 | **页面仍为"入口聚合页"（宇宙全景图+角色图鉴两个入口卡+热门角色网格）** — 设计稿要求为"关系对列表"（角色A ←关系类型→ 角色B） | P0 | 按V1.2设计稿 §7 重做页面结构：关系类型筛选chips + 关系对卡片列表 | 无 |
| R-P0-02 | **无关系类型筛选 chips** — 设计稿要求 [全部][盟友][敌人][师徒][家人] | P0 | 新增筛选模块，chips 选中态 --gold-a10底/--gold文字 | 无 |
| R-P0-03 | **无关系类型功能色** — 设计稿要求盟友蓝/敌人红/师徒金/家人紫 | P0 | 新增关系类型颜色映射 CSS 类 | 无 |
| R-P0-04 | **角色卡片无头像图片** — 仍为纯文字卡片 | P0 | 角色卡片增加 `<image>` 头像组件 | 角色头像 24张 |
| R-P1-01 | 页面标题使用 --fs-display(56rpx) 但无副标题层级区分 | P1 | 副标题 .page-sub 使用 var(--fs-caption)/--text-sub（当前已合规），可保留 | 无 |

---

## 六、全局规范验收（app.wxss）

### 通过项 ✅

| 检查项 | 结果 |
|--------|------|
| G-01 页面底色 --bg: #080B12 | ✅ |
| G-03 三个功能色已定义 | ✅ --accent-blue/red/purple + alpha变体 |
| G-05 字号5级 + --fs-display-sm(44rpx) 额外定义 | ✅ |
| G-12 圆角5级 | ✅ |
| G-14 阴影Token 4个 | ✅ |
| 三级卡片全局类 | ✅ card-hero/content/compact |
| 文字全局类 | ✅ mcu-display/title/body/sub/caption/weak/mini |
| 按钮全局类 | ✅ mcu-btn-primary/ghost/gold |

### 问题项

| # | 问题 | 严重等级 | 修改方案 | 需要资源 |
|---|------|---------|---------|---------|
| G-P1-01 | 缺少部分阶段色 alpha 变体：--p1-a10/~a20（仅-a06/-a20/-a60）、--p3-a20、--p4-a20、--p6-a20 等 | P1 | 按《开发视觉标注》§1 补全缺失的阶段色 alpha 变体 | 无 |

---

## 七、visuals.js 资源接入验收

### 现状

| 资源类型 | 已接入 | 需要 | 缺口 |
|---------|--------|------|------|
| 电影海报 | 38张 ✅ | 59张 | 21张（剧集/特别呈现/短片） |
| 电影剧照 | 38张 ✅ | 59张 | 21张 |
| 角色头像 | 0 ❌ | 24张 | 24张 |
| 首页背景 | 0 ❌ | 1张 | 1张 |
| 阶段代表图 | 0 ❌ | 6张 | 6张 |
| 角色场景图 | 0 ❌ | 24张 | 24张 |

### 问题项

| # | 问题 | 严重等级 | 修改方案 | 需要资源 |
|---|------|---------|---------|---------|
| V-P0-01 | **角色头像映射完全缺失** — visuals.js 无 charAvatars 对象 | P0 | 新增 charAvatars 映射 + 导出，页面通过 mcuData.visual('char-'+id) 取头像 | 角色头像 24张上传至 CDN |
| V-P1-01 | 剧集/短片海报缺失21张 | P1 | 补全剩余21张海报映射 | 剧集海报资源 |

### ID 匹配风险

visuals.js 中的 ID 与 content.js 中的 ID 可能存在不一致（如 "captain-america" vs "captain-america-first-avenger"）。需开发确认 mcuData.visual(id) 的 id 参数与 posters 对象的 key 完全一致，否则海报无法显示。

---

## 八、修改优先级汇总

### P0 — 必须修复（7项）

| # | 页面 | 问题 | 修改量 | 依赖 |
|---|------|------|--------|------|
| M-P0-01 | 电影详情 | CTA字号36→28rpx、字重700→600 | 2行CSS | 无 |
| C-P0-01 | 角色详情 | 头像改`<image>` | 重做Hero区 | 角色头像资源 |
| C-P0-02 | 角色详情 | 增加Hero背景图 | 重做Hero区 | 角色场景图资源 |
| C-P0-03 | 角色详情 | 首次出现/关联作品改海报`<image>` | 改film-row | 海报已接入 |
| C-P0-04 | 角色详情 | 关系网格头像改`<image>` | 改related-grid | 角色头像资源 |
| C-P0-05 | 角色详情 | .card-title颜色gold→text-main | 1行CSS | 无 |
| R-P0-01~04 | 关系探索 | 整页按V1.2设计稿重做 | **整页重做** | 角色头像资源 |
| V-P0-01 | visuals.js | 角色头像映射缺失 | 新增映射 | 角色头像资源 |

### P1 — 应该修复（8项）

| # | 页面 | 问题 |
|---|------|------|
| H-P1-01 | 首页 | 旅程卡背景图待资源就位 |
| H-P1-02 | 首页 | 角色头像未从visuals.js取图 |
| M-P1-01 | 电影详情 | Hero背景图待资源就位 |
| M-P1-02 | 电影详情 | font-weight:800→700（3处） |
| G-P1-01 | 全局 | 补全阶段色alpha变体 |
| C-P1-01 | 角色详情 | .related-shared 19rpx→22rpx |
| V-P1-01 | visuals.js | 补全21张剧集海报 |

### P2 — 建议修复（3项）

| # | 页面 | 问题 |
|---|------|------|
| H-P2-01 | 首页 | 兜底首字44rpx非标准档（可接受） |
| M-P2-01 | 电影详情 | 当前卡边框 --gold-a50→a20 |
| C-P2-01 | 角色详情 | film-letter 尺寸与设计稿不一致 |

---

## 九、验收结论

### 可立即修复（不依赖资源）

1. **M-P0-01**：电影详情CTA字号/字重（2行CSS）
2. **C-P0-05**：角色详情卡片标题颜色（1行CSS）
3. **M-P1-02**：font-weight:800→700（3处）
4. **C-P1-01**：related-shared 字号（1行CSS）
5. **M-P2-01**：seq-card.current 边框色（1行CSS）

### 需资源就位后修复

6. **角色详情页整页重做**（C-P0-01~04）— 需角色头像24张 + 角色场景图24张
7. **关系探索页整页重做**（R-P0-01~04）— 需角色头像24张
8. **visuals.js 扩展**（V-P0-01）— 需角色头像上传CDN

### 验收结论

**首页 + 电影详情页**：修复 M-P0-01 后即可通过验收。
**角色详情页 + 关系探索页**：仍为V1.1旧实现，需按V1.2设计稿重做，当前**不通过**。
**核心阻塞**：角色头像资源（24张）未就位，导致所有涉及角色头像的页面无法完成V1.2升级。

---

## 十、下一步行动

1. **开发立即修复**：M-P0-01 / C-P0-05 / M-P1-02 / C-P1-01 / M-P2-01（约10行CSS，5分钟）
2. **用户/开发采集图片**：按《MCU-V1.2图片资源清单》抓取角色头像24张 + 角色场景图24张 → 上传CDN → 更新visuals.js
3. **开发重做角色详情页**：按《页面视觉升级方案》§4 + 本验收报告 C-P0 修改方案
4. **开发重做关系探索页**：按《页面视觉升级方案》§7 + 本验收报告 R-P0 修改方案
5. **修复完成后**：再次提交截图，设计AI二次验收
