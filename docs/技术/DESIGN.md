# DESIGN.md — MCU 观影导航 V1.2

> 设计系统单一可信源（Design System Single Source of Truth）
> 本文件供 AI 编码 Agent 读取，生成视觉一致的 MCU 导航界面。
> **提取源**：`./douyin/app.wxss`（代码根 `./douyin/`）—— 全局唯一 Token 与通用类来源。
> **上游依据**：《MCU-V1.2-开发视觉标注》§一/§二（设计 AI 唯一视觉标准）。
> 所有数值来自真实代码，非记忆推断。

---

## 1. 视觉主题与氛围（Visual Theme & Atmosphere）

- **定位**：陪用户探索漫威宇宙的观影助手（cinematic companion）。
- **基调**：深空影院黑（cinematic dark）。底色 `#080B12` 营造观影厅暗物质感，非纯黑以避免边界消失。
- **强调逻辑**：品牌金 `#F2B233` 为**唯一主强调色**，承担 CTA、选中态、高光，类比胶片质感金边。
- **功能色**：蓝/红/紫三色仅用于「阵营 / 状态 / 功能区分」，不进入基础 UI 框架。
- **内容标识**：六阶段色（p1–p6）**仅用于路线阶段标记**，不参与 UI 框架着色。
- **密度**：信息中等偏密，卡片化堆叠，留白克制（间距体系见 §6）。

---

## 2. 色彩板与角色（Color Palette & Roles）

### 背景层（Surface）
| 语义名 | Hex | 角色 |
|---|---|---|
| `--bg` | `#080B12` | 页面根背景、导航栏背景 |
| `--surface-0` | `#0D1119` | 最深卡片/凹陷面 |
| `--surface-1` | `#161D2B` | 主卡片底、tabBar 背景 |
| `--surface-2` | `#1E2636` | 次级卡片底、content 卡 |
| `--surface-3` | `#2A3447` | 边框、分割线、三级面 |

### 品牌与强调
| 语义名 | Hex | 角色 |
|---|---|---|
| `--gold` | `#F2B233` | 唯一主强调色（CTA/选中/高光） |
| `--gold-btn-text` | `#1A1206` | 金底按钮上的文字色（深棕，保证对比） |

### 功能四色（阵营 / 状态）
| 语义名 | Hex | 角色 |
|---|---|---|
| `--accent-blue` | `#4A9EF5` | 阵营蓝 |
| `--accent-red` | `#E85D5D` | 阵营红 |
| `--accent-purple` | `#9B7FE8` | 阵营紫 |

### 六阶段色（仅内容标识，禁入 UI 框架）
| 语义名 | Hex |
|---|---|
| `--p1` | `#5B8DEF` |
| `--p2` | `#28B487` |
| `--p3` | `#F0A932` |
| `--p4` | `#8B6FE8` |
| `--p5` | `#E8483F` |
| `--p6` | `#C25B8E` |

### 文本三级
| 语义名 | Hex | 角色 |
|---|---|---|
| `--text-main` | `#E8ECF4` | 主文字 |
| `--text-sub` | `#8E98AA` | 次要文字 |
| `--text-weak` | `#555F73` | 弱化文字、tabBar 未选中 |

### 状态
| 语义名 | Hex |
|---|---|
| `--success` | `#3FB98A` |
| `--error` | `#E5604D` |

> 另有大量 alpha 变体（如 `--gold-a10`、`--accent-blue-a20`、`--white-a12`、`--p1-a60` 等）与阶段色 alpha（`--p1-a06`…），**完整清单见 `./douyin/app.wxss`**，本文件不重复罗列，生成时一律引用变量。

---

## 3. 排版规则（Typography）

- **字体栈**：`-apple-system, "PingFang SC", "Helvetica Neue", Helvetica, sans-serif`
- **基准字号**：`28rpx`（body）
- **行高**：`1.5`

### 字号层级（5+ 级制）
| 语义名 | rpx | 字重 | 用途 |
|---|---|---|---|
| `--fs-display` | `56` | 700 | 首页 Hero 大标题 |
| `--fs-display-sm` | `44` | 700 | 次级大标题 |
| `--fs-title` | `36` | 600 | 区块标题 |
| `--fs-body` | `28` | 400 | 正文 |
| `--fs-caption` | `24` | 400 | 说明 / 注释 |
| `--fs-mini` | `22` | 400 | 极小标注 |

> ⚠️ 历史记忆曾记为「48/36/34/28/24」，与真实代码不符。**以本表为准**。

---

## 4. 组件样式（Component Stylings）

### 卡片（三级体系，圆角随级别递减）
| 类 | 背景 | 圆角 | 阴影 | 内边距 |
|---|---|---|---|---|
| `.card-hero` | `surface-1` | `--radius-xl`(32) | `shadow-hero` | `space-lg`(36) |
| `.mcu-card` | `surface-1` | `--radius-xl`(32) | — | `space-lg`(36) |
| `.card-content` | `surface-2` | `--radius-lg`(20) | `shadow-card` + 1rpx `surface-3` 边框 | `space-md`(28) |
| `.card-compact` | `surface-2` | `--radius-md`(16) | — | `space-sm`(20) 20rpx |

### 按钮
| 类 | 背景 | 文字 | 圆角 | 高度 | 阴影 |
|---|---|---|---|---|---|
| `.mcu-btn-primary` | `gold` | `gold-btn-text` | `radius-md`(16) | `88rpx` | `glow-gold` |
| `.mcu-btn-gold` | `gold` | `gold-btn-text` | `radius-md`(16) | — | `glow-gold` |
| `.mcu-btn-ghost` | 透明 | `gold` | — | — | — |

### 文字层级类
`.mcu-display` / `.mcu-title` / `.mcu-body` / `.mcu-sub` / `.mcu-caption` / `.mcu-weak` / `.mcu-mini` / `.mcu-gold` —— 对应 §3 字号与文本色，生成文字时优先用类而非手写 style。

### 分割线
`.mcu-divider`：高 `1rpx`，色 `surface-3`，上下 `space-lg`(36) 留白。

### 阵营色系统（全局工具类，页面不重复定义）
- 文字 `fc-red/blue/purple/gold/gray`
- 描边 `fring-*`（`border-color` 用对应 `--*-a20`）
- 渐变背景 `fbg-*`（135deg 主色 → `--*-a60`）
- 胶囊 `pill-*`（`--*-a10` 底 + 主色字）
- 阶段色兜底 `poster-p0`~`poster-p6`

### 导航 / TabBar（来自 app.json）
- 导航栏背景 `#080B12`，文字 `white`，标题「MCU观影导航」
- TabBar 4 项：首页 / 路线 / 探索 / 我的MCU
- 未选中 `#555F73`(`text-weak`)，选中 `#F2B233`(`gold`)，背景 `#161D2B`(`surface-1`)

### 图片
`.fill-img`：宽高 100% / `display:block`，全局唯一图片填充类。

---

## 5. 布局原则（Layout Principles）

- **页面边距**：`--page-x` = `36rpx`（`.mcu-page` 左右内边距）
- **区块间距**：`.mcu-section` 底部 `space-xl`(56)
- **栅格**：小程序流布局，无显式列栅格；卡片为纵向堆叠单元。
- **安全区**：遵守小程序安全区，TabBar 高度由框架提供。
- **间距尺度**：`xs8 / sm20 / md28 / lg36 / xl56 / 2xl72`（rpx）

---

## 6. 深度与层级（Depth & Elevation）

- **Surface 层级**：`bg → surface-0 → surface-1 → surface-2 → surface-3` 由深到浅，构建层级。
- **阴影体系**：
  - `shadow-card`：`0 4rpx 16rpx rgba(0,0,0,0.3)`
  - `shadow-hero`：`0 8rpx 32rpx rgba(0,0,0,0.4)`
  - `glow-gold`：`0 8rpx 24rpx rgba(242,178,51,0.12)`
  - `glow-gold-strong`：`0 12rpx 40rpx rgba(242,178,51,0.20)`
- **金光逻辑**：金色元素用 glow 而非深色投影，强化「影院金边」质感。

---

## 7. Do's and Don'ts

**DO**
- 页面层一律引用 `app.wxss` CSS 变量，**禁止写死 raw hex**（目标：零 raw hex 泄漏）。
- 卡片用三级体系（hero / content / compact），圆角随级别。
- 文字用 `.mcu-*` 层级类。
- 阵营区分用 `fc-/fring-/fbg-/pill-` 工具类，不新建颜色。
- 新增页面先从 `app.wxss` 取变量，缺变量再在 Token 层补充。

**DON'T**
- ❌ 禁止在页面 `.wxss` 写死颜色（如 `#080B12` 直接出现在页面文件）。
- ❌ 禁止用六阶段色（p1–p6）做 UI 框架着色（仅内容标识）。
- ❌ 禁止保留微信 button 默认伪元素边框（已全局清除 `button::after`）。
- ❌ 禁止缩小 Hero 卡片尺寸偏离规范（如 60×90 电影卡禁缩放）。
- ❌ 禁止自创主色；强调色只有 gold。

---

## 8. 响应式行为（Responsive Behavior）

- **单位**：全量 `rpx`，以 `750rpx` 为设计基准宽，自动按屏宽缩放。
- **断点**：小程序无需显式断点；布局为单列流式。
- **Touch Target**：主按钮高度 `88rpx`，满足可点区域。
- **折叠策略**：长列表虚拟滚动；详情页纵向滚动，Hero 固定视觉权重。

---

## 9. Agent 提示指南（Agent Prompt Guide）

**快速色值参考（生成时直接套用）**
```
背景   #080B12  卡片   #161D2B / #1E2636  边框   #2A3447
主强调  #F2B233  主文字 #E8ECF4  次文字 #8E98AA  弱文字 #555F73
阵营   蓝 #4A9EF5 红 #E85D5D 紫 #9B7FE8
```

**生成 MCU 导航页面时，AI 必须：**
1. 读取本 `DESIGN.md` 与 `./douyin/app.wxss` 作为唯一视觉标准。
2. 所有颜色 / 字号 / 间距 / 圆角 **引用 CSS 变量**，不得出现 raw hex。
3. 卡片套用 `.card-hero / .mcu-card / .card-content / .card-compact` 之一。
4. 按钮套用 `.mcu-btn-primary / .mcu-btn-gold / .mcu-btn-ghost`。
5. 字号用 `--fs-display/title/body/caption/mini`，间距用 `--space-*`。
6. 阵营/阶段用 `fc-/fring-/fbg-/pill-/poster-p*` 工具类。
7. 新增 Token 必须在 `app.wxss` 的 `page{}` 内声明，同步回本文件。

**验收基线**：生成的页面与本文件数值逐项一致（如底色 `#080B12`、金 `#F2B233`、Hero 圆角 `32rpx`、主按钮高 `88rpx`）即视为通过，无需依赖主观截图。

---

*本 DESIGN.md 由真实代码提取生成，作为 MCU 观影导航 V1.2 设计系统单一可信源。任何视觉改动须先改 `app.wxss` Token，再同步此处。*
