# 复联5补课路线专题 H5 · 设计 AI 正式规格 V1

- 文档类型：设计 AI 正式规格（交付开发 AI 执行；本文件不产生代码改动）
- 版本：V1（2026-10-13）
- 页面对象：`h5/special.html`（对外路由 `https://mcuatlas.xyz/special?id=avengers-doomsday`）
- 验收基准：移动端 390px 优先（小红书 / 抖音 / 快手 / 微信内置浏览器），兼顾 375 / 430 / PC
- 设计基调：继承 `route-detail.html`（.rd-*）视觉体系，类名新建 `sp-*` 前缀，不触碰 `style.css` / `v2.css`

---

## 一、概述与设计原则

### 1.1 页面定位

「复联5补课路线」是 **社交流量落地页**，不是普通路线详情页。

- 流量来源：小红书 / 抖音 / 快手 等社交平台，用户刚看完《复仇者联盟4：终局之战》重映版。
- 核心问题（用户带着三个问题来）：
  1. 最少需要补哪些作品？（→ 核心 8 部）
  2. 为什么这些作品和《复联5》有关？（→ 为什么要补 五段链）
  3. 想理解得更完整，还应该补哪些？（→ 完整 15 部折叠区）
- 页面出口：节点 → 现有作品详情页 `movie.html?id=`；底部 → 现有首页 `index.html`。**不设计任何新详情页 / 新导航 / 新地图。**

### 1.2 视觉基调（继承声明）

- 深色星空背景 + 金色强调 + 阶段色点缀 = 现有 MCU Atlas 视觉语言，本专题**原样继承**，不引入任何新设计语言。
- 电影感来自「信息层级 + 海报比例 + 星光底」三项，**不靠**大量动画、粒子特效、视差滚动制造。
- 动效边界：仅 `v2-btn:active` 的 0.975 缩放（既有全局）、chevron 旋转（折叠展开）、`rd-item` 按压态背景变化（既有范式）。**本期不新增任何动画。**

### 1.3 设计原则（六条）

1. **继承优先**：能复用 `route-detail.html` / `routes.html` 现成范式（三态节点、posterBox、金色徽章、金线分隔）的，一律复用，不重复发明。
2. **移动单列**：390px 下全部区块单列流式排布，不横向滚动。
3. **禁改 Token**：颜色 / 字号 / 圆角 / 阴影只引用全站 `:root` Token 变量名，不新增、不改值。
4. **文案合规**：禁用「官方指定 / 必须看 / 官方15部 / 看完这15部才能看复联5」；禁百分比；不做绝对化保证。作品名一律以数据 `cn` 为准（神奇四侠：初露锋芒、雷霆特攻队\*）。
5. **零新增存储**：已看状态读写 `MCU.progress`（key `mcu_nav_user_v1`），不新增 localStorage key。
6. **日期取数**：Hero 与终点条的「2026.12.18 / AVENGERS: DOOMSDAY」一律从 `MCU_UPCOMING['avengers-5']` 运行时读取，禁止硬编码。

---

## 二、页面信息架构与区块流

自上而下共 6 个区块（含注入骨架）：

```
┌─ #app-nav（MCU.ui.mount 注入，sticky 56px，4 项一级导航不变）
├─ ① sp-hero      「复联5补课路线」Hero（双 CTA 锚点入口）
├─ ② sp-core      「核心补课路线 · 8部」（起点条 + 8 节点 + 终点条）
├─ ③ sp-full      「完整补课路线 · 15部」（details 折叠区，默认折叠）
├─ ④ sp-chain     「为什么要补」五段链
├─ ⑤ sp-entry     底部入口「还想继续探索 MCU？」
└─ #app-foot（MCU.ui.mount 注入）
```

锚点关系：

| 元素 | 行为 |
|---|---|
| Hero CTA「先补这 8 部」 | 平滑滚动到 `#sp-core` |
| Hero CTA「完整补课 15 部」 | 打开 `#sp-full` 折叠区并平滑滚动到 `#sp-full` |
| 节点卡任意位置（除序号圆点） | 跳转 `movie.html?id={workId}` |
| 节点序号圆点 | 点击切换「已看」状态（stopPropagation，不跳转） |
| 底部「进入 MCU 宇宙导航」 | 跳转 `index.html` |
| 底部「查看全部观影路线 / 探索 MCU 宇宙地图」 | 跳转 `routes.html` / `map.html` |

---

## 三、复用 / 新增 / 禁改清单

### 3.1 直接复用（来自 route-detail / 全站基座，不重新设计）

| 项 | 来源 | 复用方式 |
|---|---|---|
| 导航 / 页脚骨架 | `MCU.ui.mount('special.html')` | 直接调用，零改动 |
| 按钮 | `.v2-btn / .v2-btn-primary / .v2-btn-ghost` | 直接引用类名 |
| Hero 星空底 | `.rd-hero-bg`（双层 radial 金/蓝微光 + bg-deep→bg 渐变）+ `.rd-star` 白点 opacity .28 | 同值移植为 `.sp-hero-bg` |
| 三态节点 | `.rd-item / .rd-num` 三态（未看灰 / 已看绿✓ / 当前建议金边） | 同值移植为 `.sp-item / .sp-num` |
| 海报盒 | posterBox 范式（`MCU.data.visual` + `--pc` 阶段色占位 + 首字兜底） | 同值移植为 `.sp-ph` |
| 金色进度胶囊 | `.rd-badge`（gold-a10 底 / gold-a20 边 / 12px gold 字 / 6px 金点） | 同值移植为 `.sp-badge` |
| 金线分隔 | `.rd-split`（渐变线 + 金点 + 11px gold 字） | 同值移植为 `.sp-split` |
| 区块标题体系 | `.rd-sec / .rd-sec-hd / .rd-sec-t` | 同值移植为 `.sp-sec*` |
| 已看读写 | `MCU.progress.isSeen / toggle` | 直接调用 |
| 日期 / 英文名 | `MCU_UPCOMING['avengers-5']` | 运行时读取 |
| 一键标记已看范式 | `routes.html` 的 `step-dot`（`data-toggle`） | 移植为节点序号圆点按钮 |

### 3.2 本专题新增设计（sp-*，全部写进 v1-special.css）

| 项 | 说明 |
|---|---|
| `sp-hero` 日期锁定排版 | 「2026.12.18 + AVENGERS: DOOMSDAY」双区块排版（见 4.4） |
| 双 CTA 锚点滚动 | 主 CTA 金色、次 CTA 幽灵按钮，锚点行为见区块流 |
| 起点条 `sp-origin` | 你已看完《复仇者联盟4：终局之战》· 时间线起点（figB 起点节点，非编号不计数） |
| 终点条 `sp-endpoint` | DOOMSDAY · 毁灭之日 · 2026.12.18（日期取自 upcoming.js） |
| kw 行 `sp-kw` | 核心 8 部名称下方一句话关键词（仅核心区） |
| 节点卡 `sp-item` | 含「查看作品」文字入口 + 序号即标记按钮 |
| 折叠区 `sp-full` | 原生 `<details>/<summary>` 结构与展开态视觉 |
| 五段链 `sp-chain` | 竖向链 + 金色强调末卡 |
| 底部入口 `sp-entry` | 品牌块 + 主按钮 + 两个辅助文字链 |

### 3.3 禁改项（铁律）

- 全站 Token（`style.css :root`）：不新增、不改值（颜色 / 字号 / 圆角 / 阴影 / 字体全部冻结）。
- `style.css` / `v2.css`：**零改动**；`sp-*` 全部写在新增的 `h5/assets/css/v1-special.css`。
- 一级导航 `NAV`（4 项）：不改。
- `routes.js` / `shared/data/` / 小程序：不触碰（本专题数据走独立新文件 `h5/data/special-routes.js`）。
- 不新增作品详情页、不改 `movie.html`、不改 `map.html`。
- 不做 sticky 底栏（与 route-detail 的差异点，见 5.6）。

---

## 四、Hero 规格

### 4.1 结构（390px 基准）

```
sp-hero
├─ sp-hero-bg（星空底，绝对定位铺满）
├─ sp-hero-stars（白点，6 颗，opacity .28，定位与 size 见 4.3）
└─ sp-hero-in（相对定位，z-index 2）
   ├─ h1 sp-name 「复联5补课路线」
   ├─ p sp-tagline 「从《终局之战》之后，快速补到《毁灭之日》」
   ├─ div sp-hero-date（日期锁定排版，见 4.4）
   └─ div sp-actions（双 CTA + 辅助说明）
```

- 无返回按钮（差异点）：本页由顶部导航承担站点导航；流量来自外部平台，浏览器自带返回能力。**不引入** route-detail 的 `.rd-back`。

### 4.2 标题与副标题

| 元素 | 规格 |
|---|---|
| `sp-name` | `font-size: var(--fs-display) / 30px`；`font-weight: 700`；`line-height: 1.22`；`margin-bottom: 8px`；金色渐变字（`linear-gradient(135deg, var(--text) 0%, var(--gold-light) 52%, var(--gold) 100%)` + `background-clip: text`，复用 `.rd-name`） |
| `sp-tagline` | `font-size: var(--fs-body) / 14px`；`color: var(--text-2)`；`line-height: 1.6`；`margin-bottom: 13px`（复用 `.rd-tagline`） |

### 4.3 星空底（复用，仅命名）

- `sp-hero-bg`：`background: radial-gradient(ellipse 80% 50% at 50% 20%, rgba(242,178,51,0.04) 0%, transparent 60%), radial-gradient(ellipse 60% 40% at 30% 80%, rgba(91,141,239,0.03) 0%, transparent 50%), linear-gradient(180deg, var(--bg-deep) 0%, var(--bg) 100%)`（与 `.rd-hero-bg` 同值）。
- 星星：6 颗白色圆点，`background: #fff; opacity: .28; border-radius: 50%`，尺寸 1–3px，分布在 390×180 视区内，具体坐标由实现按 7 颗参照 `route-detail.html` 的星点数组放置（不新增坐标算法）。

### 4.4 日期锁定排版（本专题新增 · 数据来源：upcoming.js）

结构：单行双列（390/375/430 均单行，PC 同）。

| 元素 | 规格 |
|---|---|
| 日期 `2026.12.18` | `font-family: var(--font-display)`；`font-size: 22px`；`font-weight: 600`；`color: var(--gold)`；`letter-spacing: .04em`；左对齐 |
| 分隔 | 日期与英文名之间 `flex: 1` 的 1px 线 `background: linear-gradient(90deg, transparent, var(--gold-a30), transparent)` |
| 英文名 `AVENGERS: DOOMSDAY` | `font-size: var(--fs-mini) / 11px`；`font-weight: 600`；`color: var(--gold)`；`letter-spacing: .18em`；右对齐 |
| 容器 | `display: flex; align-items: center; gap: 12px; margin-bottom: 16px` |

数据纪律：日期与英文名渲染前从 `MCU_UPCOMING` 取 `avengers-5` 的 `date`（格式化为 `2026.12.18`）与 `en`（大写），**代码中禁止出现字面量日期或英文片名**。

### 4.5 双 CTA 与辅助说明

| 元素 | 规格 |
|---|---|
| CTA1「先补这 8 部」 | `.v2-btn.v2-btn-primary`（直接复用，不做任何覆盖）；390 下占满宽度；`margin-bottom: 10px`；点击 → 滚动到 `#sp-core` |
| CTA2「完整补课 15 部」 | `.v2-btn.v2-btn-ghost`；390 下占满宽度；点击 → 打开 `#sp-full` 并滚动 |
| 辅助说明 | 11px `color: var(--text-3)` 居中：`8 部 = 最短路线 · 15 部 = 完整理解路线` |
| 布局 | `display: flex; flex-direction: column; gap: 10px; margin-top: 4px` |

- 视觉层级：主 CTA 金色渐变 + glow-gold（最短路线，主行动）；次 CTA 幽灵按钮（完整理解路线，次行动）。
- ≥560px 视口（PC / 平板横屏）双 CTA 改为同行：`flex-direction: row`，主按钮 `flex: 1.3`、次按钮 `flex: 1`。

### 4.6 首屏承诺

390×~700 视口下首屏完整可见：标题、副标题、日期块、双 CTA、辅助说明全部在首屏内（不含 sticky 导航 56px）。

---

## 五、核心 8 部路线组件规格

### 5.1 区块标题与进度徽章

| 元素 | 规格 |
|---|---|
| 标题 | 「核心补课路线 · 8部」`sp-sec-t`：`font-size: var(--fs-title) / 18px`；`font-weight: 700`；`color: var(--text)`（复用 `.rd-sec-t`） |
| 进度徽章 `sp-badge` | 右对齐；`padding: 5px 13px`；`border-radius: var(--r-full)`；`background: var(--gold-a10)`；`border: 1px solid var(--gold-a20)`；`font-size: var(--fs-caption) / 12px`；`color: var(--gold)`；内含 6px 金点；文案：`已看 n / 8`；n=8 时文案 `已看完 8 / 8`（复用 `.rd-badge` 同值） |
| 计数口径 | **按节点数**（分母 = 8，含洛基 S1/S2 两个节点）。页面不展示唯一 id 口径 |

### 5.2 起点条 sp-origin（新增）

- 内容：你已看完《复仇者联盟4：终局之战》· 时间线起点
- 结构：`flex; gap: 10px; align-items: center; padding: 10px 12px; border-radius: var(--r-md); background: var(--surface-0); border: 1px solid rgba(255,255,255,0.03)`；`margin-bottom: 10px`
- 左侧起点点：`10px` 圆，`background: var(--gold-a30)`，中心 `4px` 实心 `--gold`
- 文本：名称 `12px / 600 / color: var(--text-2)`；副行 `11px / color: var(--text-3)`（「时间线起点」kw 式短注）
- 不编号、不计入 8 部、不可点击

### 5.3 节点卡 sp-item（核心组件）

**结构**（390px，整卡为 `<a href="movie.html?id={workId}">`，序号位为 `<button data-toggle>` 并 `stopPropagation`）：

```
sp-item
├─ sp-num（序号圆点，同时是「标记已看」按钮，热区 44×44）
├─ sp-ph（海报盒 44×62）
├─ sp-info
│  ├─ sp-row：sp-nm（名称 14px/600） + sp-yr（11px text-3，年份）
│  ├─ sp-kw（一句话关键词 12px text-2，仅核心区）
│  └─ sp-tag（阶段标 9px 胶囊，阶段色字）
└─ sp-view（「查看作品」11px + chevron 16px）
```

**基础样式**（复用 `.rd-item` 同值）：`display: flex; gap: 12px; align-items: flex-start; padding: 12px; border-radius: var(--r-md); background: var(--surface); border: 1px solid rgba(255,255,255,0.04); margin-bottom: 10px; transition: background .18s ease, border-color .18s ease;` 首项无上 margin，末项无下 margin。

**逐元素规格**：

| 元素 | 规格 |
|---|---|
| `sp-num` | 视觉 `28px` 圆；`border-radius: 50%`；`font-size: var(--fs-caption) / 12px`；`font-weight: 700`；`display: flex; align-items: center; justify-content: center`；实际点击热区 ≥44×44（视觉圆外扩透明 padding，保证微信/抖音内置浏览器可点） |
| `sp-ph` | `44×62`；`border-radius: var(--r-sm)`；`border: 1px solid var(--pc)`（阶段色）；`overflow: hidden`；`img` `object-fit: cover; width/height: 100%`；无海报时显示首字（`position:absolute; inset:0; flex center; font-size: 18px; color: #fff; opacity:.85`）+ `onerror` 隐藏 img |
| `sp-nm` | `font-size: var(--fs-body) / 14px`；`font-weight: 600`；`color: var(--text-main)`；`line-height: 1.35` |
| `sp-yr` | `font-size: var(--fs-mini) / 11px`；`color: var(--text-3)` |
| `sp-kw` | `font-size: var(--fs-caption) / 12px`；`font-weight: 300`；`color: var(--text-2)`；`letter-spacing: .02em`；`margin-top: 3px` |
| `sp-tag`（阶段标） | `padding: 1px 6px`；`border-radius: var(--r-full)`；`font-size: 9px`；`font-weight: 600`；`background: var(--surface-2)`；字色 = 该节点 `phase` 对应阶段色（`--p1..--p6`）；`margin-top: 4px` |
| `sp-view` | 右对齐列：`font-size: var(--fs-mini) / 11px`；`color: var(--text-3)`；下 chevron `16px` 填充 `var(--text-3)`；当前建议态金色（见三态表） |

**三态样式表**（复用 `.rd-item` 三态同值，仅改类名）：

| 状态 | 判定 | 整卡 | `sp-num` | `sp-nm` | `sp-view` |
|---|---|---|---|---|---|
| 未看 | 节点对应 workId 未看 | 默认 | `background: var(--surface-2); color: var(--text-2)`，显示数字 | 默认 text-main | text-3 |
| 已看 | 已看 | `opacity: .5` | `background: rgba(40,180,135,0.15); color: var(--green)`，显示 ✓svg（14px） | `color: var(--text-2)` | text-3 |
| 当前建议观看 | 路线内**首个未看节点**（nextIdx） | `border-color: var(--gold-a30)`；`background: linear-gradient(135deg, rgba(242,178,51,0.06) 0%, var(--surface) 100%); box-shadow: var(--glow-gold)` | `background: var(--gold-a10); color: var(--gold); border: 1px solid var(--gold-a20)`，显示金色数字 | `color: var(--gold)` | `color: var(--gold)` |

- 洛基节点：名称显示 label（「洛基 S1」「洛基 S2」），其余节点显示数据 `cn`。
- 行为：点击序号圆点 = 切换已看（重渲染该节点 + 进度徽章，不整页刷新、不跳转）；点击节点其余区域 = 进 `movie.html?id={workId}`。
- 「一勾两亮」：洛基 S1/S2 共用 `loki`，标记任一节点二者同时变已看；**页面不做额外提示**。

### 5.4 金线分隔 sp-split（复用）

- 触发：有进度且未全部看完时，插在最后一部已看节点之后（同 route-detail 算法）。
- 规格（复用 `.rd-split` 同值）：`display: flex; align-items: center; gap: 12px`；两侧 `flex: 1; height: 1px; background: linear-gradient(90deg, transparent, var(--gold-a30), transparent)`；中间 `11px / 600 / color: var(--gold)` 文案「你看到这里了」+ 5px 金点；`margin: 2px 0`。

### 5.5 终点条 sp-endpoint（新增）

- 内容：DOOMSDAY · 毁灭之日 · 2026.12.18（日期取自 upcoming.js）
- 结构：`flex; gap: 10px; align-items: center; padding: 10px 14px; border-radius: var(--r-full); background: var(--gold-a10); border: 1px solid var(--gold-a20); margin-top: 4px`
- 左侧点：`28px` 圆，`background: var(--gold)`，中心 `--text-inverse` 色数字「5」（若实现无 text-inverse 变量则用 `#080B12`，即 bg 色）
- 文本两行：`DOOMSDAY` `11px / 700 / color: var(--gold); letter-spacing: .18em`；`毁灭之日 · 复联5 · 2026.12.18` `11px / color: var(--text-2)`
- 不可点击；不编号、不计数

### 5.6 与 route-detail 的差异点（显式声明）

- 无返回按钮（见 4.1）；无 sticky 底栏（页面短，底部入口走文档流，避免过重）；无「路线概览」网格与「下一部看这部」专区块（进度信息由徽章 + sp-split 承担）；无分享按钮（本期不扩需求，见待确认项 12.2）。

---

## 六、完整路线折叠区规格

### 6.1 结构（原生 details，零 JS 依赖，兼容微信/抖音 WebView）

```
sp-full（<details id="sp-full">）
├─ summary
│  ├─ sp-full-hd：标题「完整补课路线 · 15部」 + sp-full-num（15 计数胶囊） + sp-full-chev（chevron）
│  └─ sp-full-desc：辅助说明文案
└─ sp-full-body
   └─ sp-item × 15（紧凑行，见 6.3）
```

### 6.2 折叠态 / 展开态视觉

| 元素 | 折叠态 | 展开态 |
|---|---|---|
| summary 容器 | `padding: 12px 16px; border-radius: var(--r-md); background: var(--surface); border: 1px solid rgba(255,255,255,0.04)`；`cursor: pointer` | 同 |
| 标题 | `16px / 600 / color: var(--text)` | 同 |
| 15 计数胶囊 | `padding: 3px 10px; border-radius: var(--r-full); background: var(--gold-a10); border: 1px solid var(--gold-a20); font-size: 11px; color: var(--gold); font-weight: 600` | 同 |
| chevron | 16px，`color: var(--text-3)`，`transition: transform .2s ease; transform: rotate(0deg)` | `transform: rotate(180deg)` |
| 说明文案 | 可见（11px / color: var(--text-3)；margin-top: 6px；line-height: 1.55） | 同 |
| body | 不渲染（`details` 原生折叠） | `padding: 4px 0 2px`；15 行节点 |

- 辅助说明文案（逐字）：`想把人物、多元宇宙与新一代英雄线索补得更完整，可以继续这条路线。（MCU Atlas 整理路线，非官方指定片单）`——后半句为合规声明，`11px / color: var(--text-3)`，不省略。
- 默认折叠；展开状态不持久化（每次进入页面默认折叠）。
- 15 行节点使用与核心区相同的 `sp-item` 节点卡，但**不带 kw 行、不带阶段标、不带年份**（见 6.3）。

### 6.3 15 节点紧凑行规格

- 复用 `sp-item` 基础样式（padding 12px / r-md / surface / 1px 边），差异：
  - 无 `sp-kw`、无 `sp-tag`、无 `sp-yr`；
  - 名称行下加一行 `sp-type`：`11px / color: var(--text-3)`，文案 = 数据类型 label（电影 / 剧集，如「剧集 · 6 集」→ 仅「剧集」）；
  - 序号、海报、三态、查看入口、点击行为与核心区**完全一致**。
- 15 部顺序与名称（逐字，数据驱动；洛基两节点带 label）：
  1. 洛基 S1 / 2. 洛基 S2 / 3. 旺达幻视 / 4. 奇异博士2：疯狂多元宇宙 / 5. 蜘蛛侠：英雄无归 / 6. 蚁人与黄蜂女：量子狂潮 / 7. 死侍与金刚狼 / 8. 猎鹰与冬兵 / 9. 美国队长4：勇敢新世界 / 10. 鹰眼 /   11. 雷霆特攻队\* / 12. 铁心 / 13. 神奇四侠：初露锋芒 / 14. 夜魔侠：重生 / 15. 假如……？（若数据 cn 显示为「假如…？」，以数据为准；开发侧不二次命名）
- 数据纪律：名称一律运行时取数据 `cn`，label 仅用于洛基 S1/S2 区分；**不在页面或数据中二次命名**。

---

## 七、「为什么要补」五段链规格

### 7.1 结构

```
sp-chain
├─ sp-sec-hd（标题「为什么要补」）
└─ sp-chain-body（390 单列，max-width 720px 居中）
   ├─ sp-chain-item × 4（时间线 / 多元宇宙 / 跨宇宙角色 / 新一代英雄）
   └─ sp-chain-end（Doomsday 金色强调卡）
```

### 7.2 逐环规格（sp-chain-item）

- 布局：`display: flex; gap: 14px; padding: 6px 0`
- 左侧竖线：`width: 2px; background: linear-gradient(180deg, var(--gold-a30), rgba(242,178,51,0.06))`；贯穿五环（最后环收尾在金色卡内）
- 节点圆点：`10px` 圆，`background: var(--gold)`，`box-shadow: 0 0 0 4px rgba(242,178,51,0.12)`（金环）
- 标题：`font-size: var(--fs-body) / 14px; font-weight: 600; color: var(--text-main); margin-bottom: 2px`
- 解释：`font-size: var(--fs-caption) / 12px; color: var(--text-2); line-height: 1.6; max-width: 300px`（390 下右留 16px 安全边）

### 7.3 五句建议文案（建议文案 · 待产品验收，每句 ≤ 28 字、无剧透、无绝对化措辞）

| 环 | 标题 | 解释文案（建议） |
|---|---|---|
| 1 | 时间线 | 终局之战后，时间向前跳了数年，新阶段都在战后世界展开。 |
| 2 | 多元宇宙 | 洛基与奇异博士，把「平行宇宙」从设定变成了主线。 |
| 3 | 跨宇宙角色 | 死侍、金刚狼、神奇四侠来自其他宇宙，只有多元宇宙接得住他们。 |
| 4 | 新一代英雄 | 山姆接盾、雷霆特攻队集结，他们是《毁灭之日》的新一代战力。 |
| 5 | Doomsday | 三条线汇合到毁灭博士，前面补的每一环都在这里收束。 |

### 7.4 Doomsday 金色强调卡（sp-chain-end，本专题新增）

- 结构：`padding: 14px 16px; border-radius: var(--r-md); background: linear-gradient(135deg, var(--surface) 0%, var(--surface-0) 100%); border: 1px solid var(--gold-a20); box-shadow: var(--glow-gold)`（呼应 `.rd-next` 视觉）
- 标题 `Doomsday`：`16px / 700 / color: var(--gold)`，`font-family: var(--font-display)`
- 副行：`毁灭之日 · 复联5 · 2026.12.18`：`12px / color: var(--gold-light)`（日期取自 upcoming.js）
- 作用：让用户一眼看到「前面这些补的每一环，都汇到这里」——直接呼应 7.3 末环文案。

---

## 八、底部入口规格（sp-entry）

- 区块标题「还想继续探索 MCU？」：`text-align: center; font-size: 16px; font-weight: 600; color: var(text-main)`（上方品牌行「MCU Atlas」：`font-family: var(--font-display); 14px / 700 / color: var(--gold); letter-spacing: .08em`，margin-bottom 6px）
- 主按钮「进入 MCU 宇宙导航」→ `index.html`：`.v2-btn.v2-btn-primary`，390 下占满宽度，`margin: 12px 0 14px`
- 辅助链接（次级，无边框文字链）：
  - 「查看全部观影路线 →」→ `routes.html`
  - 「探索 MCU 宇宙地图 →」→ `map.html`
  - 规格：`font-size: var(--fs-caption) / 12px; color: var(--text-3); display: block; text-align: center; padding: 4px 0; gap: 4px（箭头与文字同行）`
- 区块容器：`padding: 28px 16px calc(20px + env(safe-area-inset-bottom)); border-top: 1px solid rgba(255,255,255,0.04)`（底部安全区预留，防微信/抖音 Home 条遮挡 CTA）
- 层级：主按钮为唯一主行动；辅助链接不抢眼（text-3 色、无边框）。

---

## 九、响应式规格

### 9.1 390px 主基准

| 区块 | 关键值（均已在上文标注） |
|---|---|
| Hero | 标题 30px 单行；日期块单行双列；双 CTA 堆叠占满宽 |
| 核心区 | 节点卡全宽（padding 12px + 边距 10px），无横向溢出 |
| 折叠区 | summary 全宽；15 行同宽节点卡 |
| 五段链 | 单列；解释 max-width 300px |
| 底部入口 | 全宽主按钮 + 居中辅助链 |

防溢出规则（390/375 通用）：`html/body { overflow-x: hidden }`；名称与 kw 允许换行不截断（`white-space: normal`）；阶段标 ≤ 4 字符胶囊；海报 `flex: 0 0 auto` 固定 44×62 比例锁定（`--pc` 阶段色边）。

### 9.2 375px 增量

- 布局不变；按钮不压缩（沿用 `.v2-btn` 原值不覆盖）；日期块仍单行双列（312px 内容 < 343px 可用宽）。
- 间距全部沿用 Token/既定 px，不做百分比缩放（保证各端像素级一致）。

### 9.3 430px 增量

- 双 CTA 仍堆叠（断点 ≥560px 才同行）；核心区节点卡同款全宽。
- 保证 430 与 390 视觉一致，仅视口余量更大。

### 9.4 PC 增量（不做单独设计，仅最小适配）

- 页面内容列：`max-width: 720px; margin: 0 auto; padding: 0 20px`（站点既有 `.wrap-narrow` 体系同款）。
- Hero 星空底 `min-width: 100%` 横向延展；标题 30px 不变（Token 冻结）。
- 双 CTA ≥560px 同行（见 4.5）；五段链居中 720px 列内。
- 节点卡、海报、胶囊均保持移动端尺寸（移动端优先，PC 不放大密度）。

### 9.5 内置浏览器适配清单（验收必查）

1. `viewport-fit=cover`（现有 meta 已含）+ 底部区块 `env(safe-area-inset-bottom)`。
2. 所有点击热区 ≥44×44（序号圆点视觉 28px、热区外扩至 44px）。
3. 海报比例锁定 44×62（`aspect-ratio` 不依赖，直接双固定尺寸）。
4. 不加载任何在线字体（全系统字体栈）；无自动播放音视频；无外部资源请求（除海报图，走既有 CDN/本地）。
5. 微信 / 抖音 / 快手 / 小红书内置浏览器真机自测：首屏完整、折叠展开无滚动跳动、`<details>` 正常（不依赖 JS）、剪贴板无需求（本期无分享）。
6. 已看标记后仅局部重渲染（该节点 + 徽章 + sp-split 位置），不整页刷新。

---

## 十、状态与边界情况

| 场景 | 表现 |
|---|---|
| 全部未看 | 徽章「已看 0 / 8」；无 sp-split；首个节点为「当前建议」金色态 |
| 部分已看 | 徽章「已看 n / 8」；sp-split 插在最后一部已看之后 |
| 全部看完 | 徽章「已看完 8 / 8」；无 sp-split；无「当前建议」节点 |
| 洛基一勾两亮 | 标记 S1 或 S2，两个节点同时变已看；页面不提示（数据层限制，V1 接受） |
| workId 数据缺失（极低概率） | 该节点渲染占位卡：阶段色海报盒 + 首字 + 名称「？」；不阻断整页 |
| `special-routes.js` 的 `full` 为 null（开发侧兼容） | 折叠区整体不渲染（开发侧纪律：数据未就绪不渲染区块，页面仍可用） |
| upcoming.js 档期变更 | 页面日期/英文名自动跟随，无硬编码 |
| 折叠区展开状态 | 不持久化，每次进入默认折叠 |
| 隐私模式 / 清缓存 | 已看状态丢失（全站现状一致，非本期新增；详情页「标记已看」同步失效） |

---

## 十一、页面结构说明（开发 AI 执行依据）

### 11.1 HTML 壳

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>复联5补课路线 · MCU 宇宙导航</title>
  <meta name="description" content="只看 8 部也能跟上《复仇者联盟5：毁灭之日》。MCU Atlas 复联5补课路线：最短 8 部核心路线 + 完整 15 部路线。">
  <!-- canonical 需进 app.js injectSeoTags KEEP 白名单（?id 保留），开发侧处理 -->
  <link rel="stylesheet" href="assets/css/style.css">
  <link rel="stylesheet" href="assets/css/v2.css">
  <link rel="stylesheet" href="assets/css/v1-special.css">   <!-- 新增，sp-* 全部在此 -->
</head>
<body>
  <div id="app-nav"></div>
  <main class="sp" id="sp-root"></main>
  <div id="app-foot"></div>
  ...
</body>
</html>
```

### 11.2 脚本与样式加载顺序

- 数据按需加载（弱网首屏关键，**不加载** `news.js`（72KB）/ `community.js`）：
  `movies.js → series.js → special.js → short.js → content.js → upcoming.js → visuals.js → special-routes.js`（新增）→ `app.js` → **内联渲染脚本（IIFE / ES5 风格，同构 route-detail.html）**。
- 本期无分享按钮 → 不需要 `components.js`（若产品后加分享，再恢复加载并复用 V2 三级兜底）。
- 渲染前调用 `MCU.ui.mount('special.html')`（注入 nav / foot、埋点 pageView 需在 app.js 加 `special` 映射，开发侧）。

### 11.3 渲染流程（页面内脚本职责）

1. 取专题数据（`MCU_SPECIAL_ROUTES` 中 `id:'avengers-doomsday'`）。
2. Hero：标题/副标题为常量文案；日期块与终点条日期从 `MCU_UPCOMING['avengers-5']` 取。
3. 核心 8 节点：遍历 `core.items`（seq / workId / label / kw），名称=`label ?? MCU.data.get(workId).cn`，状态=`MCU.progress.isSeen(workId)`，`nextIdx`=首个未看节点。
4. 进度徽章：`core.items.filter(isSeen).length` 对比 8。
5. 折叠区：`full` 非 null 才渲染；`<details>` 由原生处理；CTA2 打开时 `document.getElementById('sp-full').open = true` 后滚动。
6. 五段链：文案为设计侧建议（见 7.3），落库前由渲染脚本写为常量或经数据字段（待产品验收后定）。
7. 底部入口：常量链接。
8. 事件：锚点滚动（原生 `scrollTo({behavior:'smooth'})` + nav 高度偏移 56px）、序号圆点 `MCU.progress.toggle` 后局部重渲染、节点卡整卡跳转。

### 11.4 类名清单（sp-*，全部位于 v1-special.css）

`sp-hero / sp-hero-bg / sp-hero-stars / sp-star / sp-hero-in / sp-name / sp-tagline / sp-hero-date / sp-hero-date-d / sp-hero-date-l / sp-hero-date-en / sp-actions / sp-sec / sp-sec-hd / sp-sec-t / sp-core / sp-badge / sp-origin / sp-list / sp-item / sp-num / sp-ph / sp-info / sp-row / sp-nm / sp-yr / sp-kw / sp-tag / sp-view / sp-split / sp-endpoint / sp-full / sp-full-hd / sp-full-num / sp-full-chev / sp-full-desc / sp-full-body / sp-item-full / sp-type / sp-chain / sp-chain-body / sp-chain-item / sp-chain-end / sp-entry / sp-brand`

> 2026-10-13 补正（设计 AI 验收后）：按实现补入 3 个类名 —— `sp-hero-date-d` / `sp-hero-date-l`（4.4 日期块三段式：日/分隔线/英文）与 `sp-star`（4.3 单颗星点）。规格与实现同源。

### 11.5 埋点与 SEO 注意点

- 页面埋点键：`special`（开发侧在 app.js 映射补一行）。
- 节点点击可加 `data-stat="click_special_view"`（可选）。
- SEO：description 已给出建议值（≤150 字）；canonical 白名单（KEEP）需含 `'special.html': ['id']`，否则 `?id=` 被洗掉导致与首页重复收录（开发侧 C4 必做）。

---

## 十二、验收清单与待确认项

### 12.1 验收清单（移动端真机，小红书/抖音/快手/微信内置浏览器）

1. 390 / 375 / 430 三宽度：无横向溢出、无文字截断、海报比例稳定。
2. 首屏（含 56px 导航后）：标题、副标题、日期块、双 CTA、辅助说明完整可见。
3. 双 CTA 均可点：CTA1 平滑滚动到核心区；CTA2 打开折叠区并滚动。
4. 核心 8 节点：三态正确、序号圆点点击切换已看且徽章数字同步、整卡点击进 movie.html。
5. 折叠区默认折叠；展开/收起正常；15 行紧凑卡三态与查看入口正常。
6. 五段链五环文案与金色强调卡正确渲染；日期取自数据。
7. 底部入口：主按钮进 index.html；两个辅助链可点。
8. 文案合规：无「官方指定/必须看/官方15部/看完这15部才能看复联5」；无百分比；无绝对化保证。
9. 已看状态刷新后保持（localStorage 持久化）。
10. 微信/抖音/快手内置浏览器回归：无弹窗拦截、无样式错乱、`<details>` 可用。

### 12.2 待确认项（产品验收时拍板）

| # | 事项 | 现状 | 建议 |
|---|---|---|---|
| 1 | 五段链五句解释文案 | 本规格 7.3 提供建议文案 | 产品确认后落库 |
| 2 | 「8 部」计数口径 | 按节点数（分母 8，含洛基 S1/S2） | 产品确认 |
| 3 | 洛基「一勾两亮」 | V1 接受不提示 | 产品确认；若要求区分则另行立项（触三端数据） |
| 4 | 是否加分享按钮 | 本期规格未包含 | 产品确认（可选增强，开发侧有三级兜底方案） |
| 5 | 底部主入口落点 | 规格按 `index.html` | 产品确认（备选 map.html） |
| 6 | 对外路由短链 `/special/avengers-doomsday` | 开发侧方案：Nginx 1 条 rewrite | 产品/策划拍板 |
| 7 | 首页是否加专题入口卡 | **已拍板（2026-10-13）：加**，位置 Hero→观影路线之间，通栏横幅卡；规格见《复联5补课路线专题-首页入口卡规格-V1.md》 | 已出独立正式规格，转开发实现 |

---

*规格结束。开发 AI 请按第十一节结构执行；任何规格与数据的冲突，以「不新增数据、不硬编码、不改 Token」三条铁律为准。*
