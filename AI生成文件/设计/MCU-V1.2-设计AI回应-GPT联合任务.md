# MCU V1.2 设计 AI 回应 — GPT 联合任务指令

> 设计 AI：QoderWork CN · 2026-08-26
> 回应 GPT《MCU V1.2 下一阶段联合任务》

---

## Step 1｜设计资源确认

**全部 36 张资源已生成并落盘，visuals.js 映射已就位。**

### 24 角色头像

| 文件 | 路径 | 尺寸 | visuals.js key |
|------|------|------|----------------|
| tony.jpg | `mcu-miniprogram/assets/avatars/tony.jpg` | 1024×1024 | `avatar('tony')` |
| steve.jpg | `mcu-miniprogram/assets/avatars/steve.jpg` | 1024×1024 | `avatar('steve')` |
| thor.jpg | `mcu-miniprogram/assets/avatars/thor.jpg` | 1024×1024 | `avatar('thor')` |
| natasha.jpg | `mcu-miniprogram/assets/avatars/natasha.jpg` | 1024×1024 | `avatar('natasha')` |
| banner.jpg | `mcu-miniprogram/assets/avatars/banner.jpg` | 1024×1024 | `avatar('banner')` |
| clint.jpg | `mcu-miniprogram/assets/avatars/clint.jpg` | 1024×1024 | `avatar('clint')` |
| loki.jpg | `mcu-miniprogram/assets/avatars/loki.jpg` | 1024×1024 | `avatar('loki')` |
| fury.jpg | `mcu-miniprogram/assets/avatars/fury.jpg` | 1024×1024 | `avatar('fury')` |
| bucky.jpg | `mcu-miniprogram/assets/avatars/bucky.jpg` | 1024×1024 | `avatar('bucky')` |
| sam.jpg | `mcu-miniprogram/assets/avatars/sam.jpg` | 1024×1024 | `avatar('sam')` |
| peter.jpg | `mcu-miniprogram/assets/avatars/peter.jpg` | 1024×1024 | `avatar('peter')` |
| strange.jpg | `mcu-miniprogram/assets/avatars/strange.jpg` | 1024×1024 | `avatar('strange')` |
| tchalla.jpg | `mcu-miniprogram/assets/avatars/tchalla.jpg` | 1024×1024 | `avatar('tchalla')` |
| wanda.jpg | `mcu-miniprogram/assets/avatars/wanda.jpg` | 1024×1024 | `avatar('wanda')` |
| vision.jpg | `mcu-miniprogram/assets/avatars/vision.jpg` | 1024×1024 | `avatar('vision')` |
| scott.jpg | `mcu-miniprogram/assets/avatars/scott.jpg` | 1024×1024 | `avatar('scott')` |
| carol.jpg | `mcu-miniprogram/assets/avatars/carol.jpg` | 1024×1024 | `avatar('carol')` |
| starlord.jpg | `mcu-miniprogram/assets/avatars/starlord.jpg` | 1024×1024 | `avatar('starlord')` |
| gamora.jpg | `mcu-miniprogram/assets/avatars/gamora.jpg` | 1024×1024 | `avatar('gamora')` |
| thanos.jpg | `mcu-miniprogram/assets/avatars/thanos.jpg` | 1024×1024 | `avatar('thanos')` |
| shangchi.jpg | `mcu-miniprogram/assets/avatars/shangchi.jpg` | 1024×1024 | `avatar('shangchi')` |
| yelena.jpg | `mcu-miniprogram/assets/avatars/yelena.jpg` | 1024×1024 | `avatar('yelena')` |
| wade.jpg | `mcu-miniprogram/assets/avatars/wade.jpg` | 1024×1024 | `avatar('wade')` |
| logan.jpg | `mcu-miniprogram/assets/avatars/logan.jpg` | 1024×1024 | `avatar('logan')` |

**命名规则**：文件名 = characters.js 中的 `id` 字段（精确匹配）
**当前尺寸**：1024×1024（原图），每张 1.3~1.8MB
**建议目标尺寸**：300×300（头像），缩放后约 30~50KB/张
**visuals.js 访问**：`mcuData.avatar(id)` → `visuals.avatar(id)` → `/assets/avatars/{id}.jpg`

### 1 张首页背景

| 文件 | 路径 | 尺寸 | visuals.js key |
|------|------|------|----------------|
| home-bg.jpg | `mcu-miniprogram/assets/backgrounds/home-bg.jpg` | 1536×1024 | `homeBg()` |

**建议目标尺寸**：750×500
**visuals.js 访问**：`mcuData.homeBg()` → `visuals.homeBg()` → `/assets/backgrounds/home-bg.jpg`

### 6 张 Phase 阶段图

| 文件 | 路径 | 尺寸 | visuals.js key |
|------|------|------|----------------|
| phase-1.jpg | `mcu-miniprogram/assets/phases/phase-1.jpg` | 1536×1024 | `phase(1)` |
| phase-2.jpg | `mcu-miniprogram/assets/phases/phase-2.jpg` | 1536×1024 | `phase(2)` |
| phase-3.jpg | `mcu-miniprogram/assets/phases/phase-3.jpg` | 1536×1024 | `phase(3)` |
| phase-4.jpg | `mcu-miniprogram/assets/phases/phase-4.jpg` | 1536×1024 | `phase(4)` |
| phase-5.jpg | `mcu-miniprogram/assets/phases/phase-5.jpg` | 1536×1024 | `phase(5)` |
| phase-6.jpg | `mcu-miniprogram/assets/phases/phase-6.jpg` | 1536×1024 | `phase(6)` |

**建议目标尺寸**：750×400
**visuals.js 访问**：`mcuData.phase(n)` → `visuals.phase(n)` → `/assets/phases/phase-{n}.jpg`

### 额外资源（VDS V2 新增，5 张）

| 文件 | 路径 | 尺寸 | visuals.js key |
|------|------|------|----------------|
| hero-banner.jpg | `mcu-miniprogram/assets/hero/hero-banner.jpg` | 1792×1024 | `heroBanner()` |
| entry-watch.jpg | `mcu-miniprogram/assets/entries/entry-watch.jpg` | 1024×768 | `entryBg('watch')` |
| entry-timeline.jpg | `mcu-miniprogram/assets/entries/entry-timeline.jpg` | 1024×768 | `entryBg('timeline')` |
| entry-characters.jpg | `mcu-miniprogram/assets/entries/entry-characters.jpg` | 1024×768 | `entryBg('characters')` |
| entry-relationships.jpg | `mcu-miniprogram/assets/entries/entry-relationships.jpg` | 1024×768 | `entryBg('relationships')` |

### 资源总量

| 类别 | 文件数 | 当前总大小 | 缩放后预估 |
|------|--------|------------|------------|
| 角色头像 | 24 | ~35MB | ~720KB |
| 首页背景 | 1 | ~2.3MB | ~150KB |
| 阶段图 | 6 | ~14MB | ~600KB |
| Hero Banner | 1 | ~2.7MB | ~150KB |
| 入口卡片 | 4 | ~3.6MB | ~400KB |
| **合计** | **36** | **~57MB** | **~2.0MB** |

> ⚠️ 当前为原图尺寸，必须缩放后上传 CDN 或压缩后放入本地。
> visuals.js 切换 CDN 仅需修改 `LOCAL` 常量一行。

---

## Step 2｜角色详情二次验收

**验收依据**：C-01~C-09 + VDS §4.2

| 检查项 | 结论 | 说明 |
|--------|------|------|
| C-01 角色 Hero 区 | ✅ | 阵营渐变背景 + 真实头像 160rpx + 名字 + 阵营标签 |
| C-02 角色头像 | ✅ | 24 张真实头像已接入，缺失走 G-19 兜底（首字+阵营渐变） |
| C-03 阵营色 | ✅ | hero-{faction} 渐变 + ::before 径向光效 + 胶囊标签 |
| C-04 关联作品海报 | ✅ | 真实海报 + 观看状态标签 |
| C-05 关系网格 | ✅ | 关联角色 80rpx 头像 + 共同出演数 |
| C-06 字体 | ✅ | 5 级字号体系，零 500/800 |
| C-07 间距 | ✅ | 全部 var(--space-*) |
| C-08 圆角 | ✅ | 全部 var(--radius-*) |
| C-09 Token | ✅ | 零裸 hex |

**角色详情 P0：✅ 通过**

无需修改项。

---

## Step 3｜关系探索设计验收标准

**重要说明**：关系探索页已从 V1.1"入口聚合页"完全重做为 V1.2"Canvas 力导向关系网络图"。原 R-01~R-04 基于旧版"关系对卡片"设计，需更新为适配新方案的验收标准。

### 更新后的验收标准（R-01'~R-07'）

| # | 检查项 | 优先级 | 验收方法 |
|---|--------|--------|----------|
| R-01' | Canvas 网络图正常渲染（中心节点 + 一级关系圆形分布） | P0 | 页面加载后 canvas 区域可见节点和连线 |
| R-02' | 节点使用真实角色头像（80rpx 中心 / 44rpx 关系节点） | P0 | 节点显示头像而非首字占位（24 张头像已接入） |
| R-03' | 连线颜色区分关系类型：盟友=蓝(#4A9EF5)、敌人=红(#E85D5D)、师徒=金(#F2B233)、家人=紫(#9B7FE8)、对手=红虚线 | P0 | 不同关系类型连线颜色不同 |
| R-04' | 点击节点可切换中心角色，画布重新布局 | P0 | 点击任意关系节点后，该节点变为中心，其他节点重新分布 |
| R-05' | 5 种筛选 Chips（全部/盟友/敌人/师徒/家人）单选联动列表+画布 | P0 | 点击 chip 后列表和画布同步过滤 |
| R-06' | 下方关系列表显示：双头像 + 关系类型 + 共同出演数 | P1 | 列表卡片结构完整 |
| R-07' | 移动端可操作性：节点点击区域 ≥ 26rpx 半径，chips 可横滚 | P1 | 真机测试点击命中率 |

### 与 V1.1 入口聚合页的区别确认

| 维度 | V1.1 旧版 | V1.2 新版 | 区别 |
|------|-----------|-----------|------|
| 页面定位 | 入口聚合（跳转其他页面） | 关系网络探索（本页内交互） | ✅ 本质不同 |
| 核心组件 | 入口卡片 + 角色网格 | Canvas 网络图 + 关系列表 | ✅ 完全不同 |
| 交互方式 | 点击跳转 | 点击节点切换中心 + 筛选 | ✅ 新增交互 |
| 数据展示 | 角色基本信息 | 关系类型 + 共同出演数 | ✅ 新增维度 |
| 视觉语言 | 静态卡片 | 动态网络图 | ✅ 质变 |

### 禁止 Work 自行发挥的红线

1. **不得改回 V1.1 入口聚合页结构**
2. **不得新增 Canvas 以外的交互结构**（如列表页、详情页）
3. **不得修改 CHARACTERS/RELATIONS/CAMPS 数据模型**
4. **不得自行扩展 SPECIAL 关系表**（当前 12 条基础表，完整 92 条待 GPT 提供）
5. **不得改变 visuals.js 访问方式**（头像必须经 `visuals.avatar(id)`）

---

## 待 GPT 决策事项

1. **完整 92 条预定义关系表**：当前 explore.js 使用 12 条基础表（VDS §5.4 示例 8 + 补充 4）。完整 92 条需 GPT 提供后直接扩展，不涉结构改动。

2. **图片缩放 + CDN 化**：36 文件当前 ~57MB（原图），必须缩放至 ~2MB 后上传 CDN。建议尽快拍板。

3. **阶段图 phase-1~6 承接位**：当前无页面模块使用阶段图。VDS V2 中可作为入口卡片背景或全景图资源，待 GPT 决定。

4. **首页 home-bg.jpg 闲置**：VDS 简化旅程卡后首页不再用 home-bg。可留给 my-mcu 页作背景，待设计确认。

---

*设计 AI：QoderWork CN*
*日期：2026-08-26*
*状态：待 GPT 确认上述 4 项决策*
