# GenUI MVP 开发报告 · MCU观影助手

> 出具方：开发 AI（CodeBuddy）｜日期：2026-10-13｜依据：策划《GenUI立项决策 V1》
> 状态：**S0–S3 完成，S4 未启动（按策划「暂不发布」指令）**
> 产物路径：`D:\SEO\发挥余热\漫威电影宇宙导航\genui-app\index.html`

---

## 0. 结论

| 项 | 结果 |
|---|---|
| S0 环境验证 | ✅ 完成。`@cosui/genui-toolkit@1.0.4` 已安装，`genui --version` 与 npm 最新版一致 |
| S1 数据快照 | ✅ 完成。38/38 部与母项目全字段零差异 |
| S2 功能实现 | ✅ 完成。F1 + F3 双视图，外壳严格照搬 cosui |
| S3 预览校验 | ✅ 完成。`genui check` 零错误；`genui preview` 实测通过 |
| S4 发布 | ⏸️ **未执行**，遵策划「暂不发布」指令 |
| 产物体积 | **0.73 MB / 8 MB 上限**（占 9.1%，余量充足） |

**一句话**：MVP 已可交付策划验收，功能与合规全部达标，仅待设计 AI 画布视觉与策划终审后发布。

---

## 1. S0 环境验证

| 项 | 值 |
|---|---|
| npm 包 | `@cosui/genui-toolkit` |
| 已安装版本 | 1.0.4 |
| npm 最新版 | 1.0.4（一致） |
| `genui --version` | 1.0.4 |
| `genui --help` | 7 个子命令全部可用 |
| `genui check` | 代码包已通过安全检测（exitCode 0） |

工具链可用性无阻塞。**未执行 `genui login`**——按 toolkit 规范，登录态仅在 `list`/`publish` 时需要，V1 不发布故不触发。

---

## 2. S1 数据快照（图片策略 C 混合方案落地）

### 2.1 海报精选与压缩

按策划「≤15 张核心作品 + 压缩 + 非核心程序化兜底」执行：

| 项 | 值 |
|---|---|
| 精选张数 | **15 张**（符合 ≤15 要求） |
| 源尺寸 | 800×1200（2:3） |
| 压缩后尺寸 | **480×720**（2:3，比例不变） |
| 压缩参数 | JPEG quality 72 + mozjpeg |
| 压缩前总量 | 2.90 MB |
| **压缩后总量** | **0.67 MB（−76.9%）** |

精选清单（15 部）：

```
iron-man                    captain-america-first-avenger
thor                        avengers
winter-soldier              guardians
age-of-ultron               civil-war
thor-ragnarok               black-panther
infinity-war                endgame
far-from-home               no-way-home
brand-new-day
```

选取逻辑：覆盖母项目「新手入坑」12 部主线 + `far-from-home` / `no-way-home` / `brand-new-day` 蜘蛛侠三代，兼顾无限传奇与多元宇宙两个叙事阶段。

### 2.2 程序化视觉卡兜底

- 覆盖 **23 部**无随包海报作品，沿用母项目 `MCU.ui.posterFallback()` 的「阶段色卡 + 符号」思路。
- GenUI 无 `hero` 海报时渲染罗马数字阶段标（`I`/`II`/`III`/`IV`，按上映序 ro 分段）+ 中文片名 + 年份。
- 已实测触发：`蜘蛛侠：英雄归来` → 标 `II`，无溢出。

### 2.3 数据一致性保障

**首次构建曾出现 43 处偏差**（手工抄写 `co`/`ro`/`starter`/`mainline` 导致，且漏 10 部）。已废弃手工数据文件，改为从母项目自动构建：

```
genui-app-tools/build-data.cjs   # 构建器（置于产物目录外）
  ├─ 读 h5/data/movies.js、routes.js  ← 数据单一可信源
  ├─ 字段裁剪 + 文本压缩（role≤46字 / sf≤58字 / desc≤76字）
  ├─ generator 路线构建期展开为显式 items
  └─ 输出 genui-app/static/data.js（22.9 KB）
```

校验结果：**38/38 部 id / cn / year / phase / ro / co / mainline / starter 全字段零差异**。

路线数据（沿用母项目 `routes.js`，构建期展开）：

| 路线 | 名称 | 部数 |
|---|---|---|
| `newcomer` | 新手入坑 | 12 |
| `essential` | 精简主线 | 18 |
| `release` | 上映顺序 | 38 |
| `chrono` | MCU 时间线 | 38 |

> 附注：母项目中「精简主线」的 route id 是 `essential`，其 `generator` 才是 `mainline`，构建器已按此映射。

---

## 3. S2 功能实现

### 3.1 形态选择

采用 **形态 A（表头 + 画布区 + 操作区）**。理由：F1 需路线切换、F3 需「换一部」，均属参数调节型交互，形态 A 的「交互控件集中在操作区」约束更契合。

### 3.2 外壳（按策划分工：开发 AI 负责，严格照搬官方规范）

| 元素 | 实现 | 依据 |
|---|---|---|
| 卡片容器 | `padding-top:100%` + `absolute inset:0` | `assets/layout.html` 1:1 照搬 |
| 表头 | 高 45px、padding 15/15/12、底描边 0.5px | 同上 |
| 表头文案 | `小工具 · MCU观影助手`（项目名 7 字 ≤10） | 策划提供 |
| 提示 icon | 16×16 cosmic icon + 气泡（含边缘避让、PC 浮层配色） | 同上 |
| 操作区 Tabs | `.vc-tabs-segmented` radiogroup，单次使用 | `assets/components/tabs.html` |
| 按钮 | `.vc-button-plain`（单按钮用 plain） | `assets/components/button.html` |
| 重置按钮 | 表头右侧 18×18 + 旋转反馈 | `assets/layout.html` |
| 配色 | 全部 `var(--cos-*)`，未定义任何 `--cos-*` | §7 token 纪律 |

**未添加**：声音按钮（作品无声音）、播放按钮（无持续可播放过程）——符合规范的「禁止无场景添加」。

### 3.3 F1 MCU观影顺序助手

- 画布区：路线名 + tagline + 「N 部作品 / 第 1 部起看」双 chip + 可滚动有序列表。
- 列表项：序号圆点（主线必看用深色实心、支线用浅色弱化）+ 中文片名 + 年份 + 意义看点（2 行截断）。
- 操作区：Tabs（观影路线/随机探索）+ 横向滚动路线切换条（4 条路线，显示部数）。
- 交互：切换路线即打点 `operation`；列表默认停在第 1 部。

### 3.4 F3 随机探索

- 画布区：主视觉（真实海报 或 程序化视觉卡）+ 片名 + 年份/阶段/主线 chip + 无剧透简介（3 行）+ 意义看点（3 行）。
- 操作区：「换一部」plain 按钮，随机取片且**不与当前重复**。
- 候选池 18 部主线作品，按「有随包海报优先」排序（保证常见结果视觉更完整）。

### 3.5 交互打点

按 `genui-api.md`：Tabs 切换、路线切换、换一部、重置均为用户主动操作，统一 `sendLog({area:'operation'})`；首屏初始化与自动渲染不打点；调用前判空 `window.genui`，本地无该对象时不影响运行。

---

## 4. S3 预览与校验

### 4.1 genui check

```
genui check genui-app/index.html
→ 代码包已通过安全检测。  exitCode=0
```

### 4.2 genui preview 实测

预览服务正常启动，产物运行于预览容器注入的 iframe 内（`srcdoc`，sandbox 已禁用 fullscreen/clipboard/geolocation 等），`window.genui` 对象存在。

实测渲染指标：

| 指标 | 要求 | 实测 | 结论 |
|---|---|---|---|
| 卡片宽高比 | 1:1 | 444×444，ratio=1.000 | ✅ |
| 表头高度 | 45px | 45px | ✅ |
| 画布区占比 | ≥50% | 52.1% ~ 59.2% | ✅ |
| body 默认边距 | 显式清除 | 0px | ✅ |
| 容器内滚动条 | 不得出现 | 无溢出 | ✅ |
| 表头项目名 | ≤10 字 | 7 字 | ✅ |
| cosui token 注入 | 生效 | `--cos-vcard-color-bg=#f8f9fc` | ✅ |
| 最小屏宽 | 360px 可用 | 324px 卡片，无截断 | ✅ |

响应式实测三档：360 / 414 / 768 屏宽下均 ratio=1、无溢出、画布区占比均 ≥50%。

### 4.3 自建合规自查（`genui-app-tools/check-compliance.cjs`）

覆盖 38 条硬约束规则 + 产物结构/体积/引用完整性，**结果 0 违规**：无联网、无存储、无 `eval`/`new Function`、无 iframe/postMessage 越界、无行内事件、无外部资源、无绝对/上跳路径、无非白名单后缀、无空目录、引用资源全部存在。

### 4.4 过程中发现并修复的 4 个缺陷

| # | 缺陷 | 根因 | 修复 |
|---|---|---|---|
| 1 | 数据集 43 处偏差 + 漏 10 部 | 手工抄写母项目字段 | 改为构建器自动生成 + 全字段校验 |
| 2 | 360px 下画布区仅 43.5%（<50%） | `card-wrapper` gap 18px + 操作区控件偏高 | gap 改 10px、chip 24px、按钮 34px → 回升至 52.1% |
| 3 | route 视图错误显示「换一部」按钮 | 类选择器 `display:flex` 覆盖 `[hidden]` 默认样式 | 补 `[hidden]{display:none}` 显式规则 |
| 4 | 选中路线 chip 文字不可见 | `--cos-color-text-on-primary-light` 与 `--cos-color-bg-primary` **同值 `#4e6ef2`**，蓝底蓝字 | 改用官方 Tabs 选中配色（`bg` + `text` + 阴影） |

> 缺陷 4 属 cosui token 语义陷阱：该 token 是配 `--cos-color-bg-raised` 使用的，不可与 `bg-primary` 配对。已在代码注释中标注警示。

---

## 5. 产物清单

```
genui-app/                          ← 提交产物（0.73 MB）
├── index.html                38.7 KB  外壳 + F1/F3 逻辑
└── static/                          ← 除入口外全部平铺于此
    ├── data.js               22.9 KB  38 部 + 4 路线（构建期生成）
    └── posters/              688 KB   15 张精选海报 480×720

genui-app-tools/                      ← 开发侧工具，不随产物提交
├── build-data.cjs                  数据集构建器
└── check-compliance.cjs            合规自查
```

产物结构符合规范：`index.html` 在根目录且唯一；其余文件全部平铺 `static/`；后缀全在白名单内；无未引用文件；无空目录。

---

## 6. 未完成 / 待办

### 6.1 按策划指令未执行

- **S4 发布**：`genui login` → `genui publish --dry-run` → `--yes` 提审，全部未执行。策划指令为「暂不发布，先完成 preview + check」。

### 6.2 阻塞项：画布区视觉待设计 AI 交付

按策划分工，画布内容区（观影路线卡、电影节点卡、随机探索结果卡）由设计 AI 设计。当前实现为**功能与信息层级的占位版本**，视觉为开发侧最小可用实现。设计 AI 交付后仅需替换 `.mcu-*` 样式，不触碰外壳。

### 6.3 建议的后续动作

| # | 动作 | 责任方 | 前置 |
|---|---|---|---|
| 1 | 画布区视觉设计交付（路线卡/节点卡/结果卡） | 设计 AI | 本报告 + 现有截图 |
| 2 | 评审画布视觉并定稿 | 策划 | 动作 1 |
| 3 | 准备 256×256 Logo（≤5MB） | 策划 | — |
| 4 | 确认发布文案（名称 7 字/简介 8 字/摘要 30 字，均在限内） | 策划 | — |
| 5 | `genui login` + `publish --dry-run` + `--yes` 提审 | 开发 AI | 动作 2、4 |
| 6 | 上线后按 `ziyuan.baidu.com/aitoolset` 观察数据 | 策划 | 审核通过 |

应用信息（策划已提供，字数均在平台限制内）：

| 参数 | 值 | 限制 |
|---|---|---|
| 名称 | MCU观影助手 | 7/10 字 ✅ |
| 简介 | 生成漫威观看路线 | 8/15 字 ✅ |
| 摘要 | 帮助用户快速生成漫威电影宇宙观看顺序，查看关键作品与时间线。 | 30/50 字 ✅ |
| Logo | **待策划提供** | 256×256，≤5MB |

---

## 7. 风险提示

| # | 风险 | 等级 | 说明 |
|---|---|---|---|
| 1 | 画布视觉未交付前不宜发布 | 中 | 当前为占位视觉，建议设计交付后再提审，避免审核往返 |
| 2 | 平台无存储，用户进度不保留 | 低 | V1 已按「一次性工具」设计，未做进度类功能 |
| 3 | 23 部作品依赖程序化视觉卡 | 低 | 已实测正常，但视觉吸引力弱于真实海报 |
| 4 | cosui token 存在同值陷阱 | 低 | 已修复 1 处，后续新增样式需留意 |
| 5 | 生态新，官方规范可能更新 | 低 | 以 Skill 内置规范为依据，版本已锁定 1.0.4 |

---

## 8. 复现命令

```powershell
# 重建数据集（母项目数据变更后执行）
node genui-app-tools\build-data.cjs

# 合规自查
node genui-app-tools\check-compliance.cjs

# 官方校验
genui check genui-app\index.html

# 本地预览（手机与电脑需同一 Wi-Fi 扫码）
genui preview genui-app\index.html -n "MCU观影助手" --qr-image
```

> 注：`genui preview` 必须走 CLI，直接双击 HTML 不注入 cosui token，样式不完整，不代表上线效果。

---

## 附：截图

- `scratch/genui-verify-f1.png` —— F1 观影路线视图
- `scratch/genui-verify-f3.png` —— F3 随机探索视图（真实海报）
