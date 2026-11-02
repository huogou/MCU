# MCU观影助手 GenUI 轻量版开发交付报告 V1.0

- 执行方：CodeBuddy
- 产品验收方：ChatGPT
- 设计依据：《GenUI-MCU观影助手-轻量版视觉设计V1.0.html》及《设计AI-GenUI轻量版V1.0设计方案与状态说明.md》
- 任务性质：现有 GenUI 项目轻量化改造（去除随机探索 / 档案卡 / 海报展示）
- 最终状态：**轻量版开发完成，待产品验收，未发布，未提审**

---

## 一、改造前文件状态及备份位置

### 改造前状态（GenUI 子项目：`版本迭代/GenUI小工具/`）
| 文件 / 目录 | 改造前身份 | 说明 |
|---|---|---|
| `genui-app/index.html` | **V1.5（未提交 git）** | 含顶部双 Tabs（路线/随机）、路线条 chips、F1 时间轴（今日发现徽章 + 评分排序）、B 电影档案卡、F3 随机探索（发现卡 + 换一部 + 程序化视觉卡）、海报展示。 |
| `genui-app/static/data.js` | V1.5 生成物 | 约 714KB，含 `movies`(海报白名单/heroes 等)、`series`、`randomPool`、`heroes`。 |
| `genui-app/static/posters/` | V1.4.1 遗留 | 15 张海报。 |
| `genui-app.zip` | **V1.4.1 回退包** | 已核对：根 `index.html` + `static/`（含 posters + data.js），确为可靠回退来源。 |
| `genui-app-tools/build-data.cjs` 等工具 | V1.5 版本 | 旧版构建器（输出旧结构数据）。 |
| `genui-app-tools/e2e-visual.cjs` | V1.5 版本 | 针对旧三模块（F1/B/F3）的 E2E。 |
| `genui-app-tools/guard-frozen.cjs` | V1.5 版本 | 冻结件守卫。 |

### Git 状态
- 仓库根：`D:\SEO\发挥余热\漫威电影宇宙导航`。
- `git status` 显示工作区存在大量未提交改动；GenUI 相关文件（`genui-app/index.html`、`e2e-visual.cjs`、`genui-app.zip` 等）均为 Modified/未提交，**无干净基线**（与《设计方案与状态说明》记录一致）。本轮**未执行任何 git 提交 / 推送**。

### 独立备份（改造前对照）
- 备份目录：`版本迭代/GenUI小工具/backup-20261030-161142/`
- 备份内容：`genui-app/`、`genui-app-tools/`、`genui-app.zip`、`package.json`、`package-lock.json`（共 41 个文件）。
- 作用：保留 V1.5 原始态与 V1.4.1 回退包，任何破坏性改动均可从此恢复。

---

## 二、实际修改文件清单

| 文件 | 操作 | 说明 |
|---|---|---|
| `genui-app/index.html` | **重写** | 删除三模块/海报/随机探索/路线条，新增轻量版顺序列表 + 三路线 COSUI Tabs。冻结外壳（`.vc-*`/`.cos-*`）逐字保留。 |
| `genui-app/static/data.js` | **重新生成** | 由 build-data.cjs 生成，仅含三条路线数据，体积 10.2KB（原 ~714KB）。 |
| `genui-app-tools/build-data.cjs` | **改写** | 改为三条路线映射；新增母项目 `series.js` 解析；洛基 S2 年份覆盖（设计稿指定）。 |
| `genui-app-tools/guard-frozen.cjs` | **修正** | 移除已删除的 `shuffle`/`onPickRoute` 两项过期 MUST 断言；新增 keyframe 帧选择器跳过逻辑。 |
| `genui-app-tools/e2e-visual.cjs` | **重写** | 针对轻量版三路线 + 交互的浏览器核验（保留原有效意图）。 |
| `genui-app-tools/baseline-pre-visual.html` | **新增** | 由 V1.5 备份生成，作为冻结件比对基线。 |
| `MCU观影助手-GenUI轻量版-V1.0.zip` | **新增** | 最终轻量版交付包。 |
| `screenshots/` | **新增** | 三条路线 × 360/414 实际浏览器截图。 |
| `scratch/e2e-visual-result.json` 及截图 | **测试产物** | E2E 结果，不入交付包。 |

**未改动**：`package.json`（无新增依赖）、母项目 `h5/`（只读引用）、线上服务器、git 提交。

---

## 三、删除的旧版功能和资源

**功能（不再保留）**
- 随机探索（F3 发现卡、换一部 shuffle、程序化视觉卡）
- 电影档案卡（B：海报 + 剧情 + 理由 + 罗马编号）
- F1 时间轴（今日发现徽章 + 8 项评分排序展示）
- 路线条 route-picker chips、顶部双 Tabs（路线/随机）
- 海报展示与海报白名单逻辑

**资源依赖（已去除）**
- 海报海报白名单（`posters.js` 逻辑）
- `static/posters/` 15 张海报（本地开发目录保留，**未**打包进交付 ZIP；index.html 不再引用）
- `data.js` 中 `randomPool`、`heroes`、`poster`、`coLabel` 等冗余字段

**保留**
- GenUI 官方冻结外壳（Header / 操作区 / COSUI Tabs / 提示气泡 / 重置）
- `sendLog` 打点接口、官方 `.vc-*`/`.cos-*` 结构与样式

---

## 四、数据构建逻辑及来源

**单一可信源**：母项目 `h5/data/{routes,special-routes,movies,series}.js`（只读，未改动）。

**构建管线**（`genui-app-tools/build-data.cjs`，可重复执行：`node genui-app-tools/build-data.cjs`）：
1. 读 `routes.js` → 取 `newcomer.items`（显式 12 个电影 id）与 `essential`（其 `generator:'mainline'` → 主线电影，按 `ro` 上映顺序 18 部）。
2. 读 `special-routes.js` → 取 `avengers-doomsday.core.items`（8 项，含 `workId` 与 `label`）。
3. 读 `movies.js` / `series.js` 解析 `cn / year / phase`；电影 `isSeries=false`，剧集 `isSeries=true`。
4. 洛基 S1/S2：以 `label` 区分名称，剧集标记；**S2 年份取 2023 来自已验收设计稿指定覆盖**（母项目 `series.js` 仅存整剧单年 2021，无分季字段，详见风险项）。
5. 输出 `window.MCU_GENUI_DATA = { version, phases, routes:[3 条，每条含 count + items] }`。

**映射对照（严格遵循指令）**
| GenUI 路线 | 母项目数据 | 条数 |
|---|---|---:|
| 新手入门 | `routes.newcomer.items` | 12 |
| 主线精选 | `routes.essential`（generator=mainline） | 18 |
| 复联5补课 | `special-routes.avengers-doomsday.core.items` | 8（6 电影 + 洛基 S1/S2 两剧集） |

---

## 五、三条路线完整数据核验表

### 路线一 · 新手入门（12 项，来源 routes.newcomer）
| # | 中文名称 | 年份 | 类型 | 阶段 | 来源 |
|---|---|---:|---|---|---|
| 01 | 钢铁侠 | 2008 | 电影 | 第一阶段 | movies.js |
| 02 | 美国队长：复仇者先锋 | 2011 | 电影 | 第一阶段 | movies.js |
| 03 | 雷神 | 2011 | 电影 | 第一阶段 | movies.js |
| 04 | 复仇者联盟 | 2012 | 电影 | 第一阶段 | movies.js |
| 05 | 美国队长2：冬日战士 | 2014 | 电影 | 第二阶段 | movies.js |
| 06 | 银河护卫队 | 2014 | 电影 | 第二阶段 | movies.js |
| 07 | 复仇者联盟2：奥创纪元 | 2015 | 电影 | 第二阶段 | movies.js |
| 08 | 美国队长3：内战 | 2016 | 电影 | 第三阶段 | movies.js |
| 09 | 雷神3：诸神黄昏 | 2017 | 电影 | 第三阶段 | movies.js |
| 10 | 黑豹 | 2018 | 电影 | 第三阶段 | movies.js |
| 11 | 复仇者联盟3：无限战争 | 2018 | 电影 | 第三阶段 | movies.js |
| 12 | 复仇者联盟4：终局之战 | 2019 | 电影 | 第三阶段 | movies.js |

### 路线二 · 主线精选（18 项，来源 routes.essential / mainline）
| # | 中文名称 | 年份 | 类型 | 阶段 | 来源 |
|---|---|---:|---|---|---|
| 01 | 钢铁侠 | 2008 | 电影 | 第一阶段 | movies.js |
| 02 | 雷神 | 2011 | 电影 | 第一阶段 | movies.js |
| 03 | 美国队长：复仇者先锋 | 2011 | 电影 | 第一阶段 | movies.js |
| 04 | 复仇者联盟 | 2012 | 电影 | 第一阶段 | movies.js |
| 05 | 美国队长2：冬日战士 | 2014 | 电影 | 第二阶段 | movies.js |
| 06 | 银河护卫队 | 2014 | 电影 | 第二阶段 | movies.js |
| 07 | 复仇者联盟2：奥创纪元 | 2015 | 电影 | 第二阶段 | movies.js |
| 08 | 美国队长3：内战 | 2016 | 电影 | 第三阶段 | movies.js |
| 09 | 奇异博士 | 2016 | 电影 | 第三阶段 | movies.js |
| 10 | 蜘蛛侠：英雄归来 | 2017 | 电影 | 第三阶段 | movies.js |
| 11 | 雷神3：诸神黄昏 | 2017 | 电影 | 第三阶段 | movies.js |
| 12 | 复仇者联盟3：无限战争 | 2018 | 电影 | 第三阶段 | movies.js |
| 13 | 复仇者联盟4：终局之战 | 2019 | 电影 | 第三阶段 | movies.js |
| 14 | 蜘蛛侠：英雄远征 | 2019 | 电影 | 第三阶段 | movies.js |
| 15 | 蜘蛛侠：英雄无归 | 2021 | 电影 | 第四阶段 | movies.js |
| 16 | 奇异博士2：疯狂多元宇宙 | 2022 | 电影 | 第四阶段 | movies.js |
| 17 | 神奇四侠：初露锋芒 | 2025 | 电影 | 第六阶段 | movies.js |
| 18 | 蜘蛛侠：崭新之日 | 2026 | 电影 | 第六阶段 | movies.js |

### 路线三 · 复联5补课（8 项，来源 special-routes.avengers-doomsday.core.items）
| # | 中文名称 | 年份 | 类型 | 阶段 | 来源 |
|---|---|---:|---|---|---|
| 01 | 洛基 S1 | 2021 | **剧集** | 第四阶段 | series.js + label |
| 02 | 洛基 S2 | 2023 | **剧集** | 第四阶段 | series.js + 设计稿覆盖 |
| 03 | 奇异博士2：疯狂多元宇宙 | 2022 | 电影 | 第四阶段 | movies.js |
| 04 | 蜘蛛侠：英雄无归 | 2021 | 电影 | 第四阶段 | movies.js |
| 05 | 死侍与金刚狼 | 2024 | 电影 | 第五阶段 | movies.js |
| 06 | 美国队长4：勇敢新世界 | 2025 | 电影 | 第五阶段 | movies.js |
| 07 | 雷霆特攻队* | 2025 | 电影 | 第五阶段 | movies.js |
| 08 | 神奇四侠：初露锋芒 | 2025 | 电影 | 第六阶段 | movies.js |

> 核验结论：三条路线条数 12 / 18 / 8 与指令完全一致；剧集正确标记为「剧」且不与电影混淆；年份/阶段均来自母项目数据。

---

## 六、页面交互实现情况

- **页面标题**：统一为「漫威观影顺序」（画布内标题）；Header 仍保留官方「小工具 · MCU观影助手」。
- **路线说明**：每路线一句话说明（文案见下方第七条）。
- **列表内容**：每项仅展示 序号 / 中文名称 / 年份 / MCU阶段；剧集额外显示「剧」标签；无逐部剧情、无装饰元素。
- **默认路线**：进入即「新手入门」（平台禁存储，每次打开为初始态）。
- **Tabs 切换**：底部 COSUI 官方 Tabs（新手入门 / 主线精选 / 复联5补课），点击/键盘切换，更新路线说明与列表。
- **滚动与重置**：列表超出可上下滚动；切换路线时 `scrollTop` 重置为 0（已实测）。
- **重置按钮**：回到默认路线「新手入门」（保留官方旋转动画）。
- **提示气泡**：保留官方 header 提示气泡与边缘避让逻辑。
- **已删除入口**：随机探索、档案卡、路线条 chips 均不存在。
- **CSS**：删除随机/档案/海报相关组件样式，重写顺序列表渲染；官方 COSUI Tabs 类与 GenUI 冻结外壳结构/尺寸/样式**零改动**。

---

## 七、360px / 414px 浏览器实测结果

浏览器实测由 `e2e-visual.cjs` 驱动（genui preview + Playwright，系统 Chrome）。**两条视口全部断言通过（共 45 项，0 失败）**。关键结果：

| 检查项 | 360px | 414px |
|---|---|---|
| 1:1 卡片比例（ratio≈1） | PASS (1) | PASS (1) |
| 无文档横向溢出 | PASS | PASS |
| 无容器横向溢出 | PASS | PASS |
| 画布完整落在 demo 内 | PASS | PASS |
| Tabs 三项齐全（新手入门/主线精选/复联5补课） | PASS | PASS |
| 默认进入新手入门（12 项） | PASS | PASS |
| 标题=漫威观影顺序 | PASS | PASS |
| 底部提示=「列表可上下滑动 · 点下方切换路线」 | PASS | PASS |
| 产品内无外部网络资源引用 | PASS (0) | PASS (0) |
| 长片名无截断 | PASS | PASS |
| 切到主线精选=18 项且可滚动 | PASS | PASS |
| 切到复联5补课=8 项（含 2 部剧集） | PASS | PASS |
| 洛基 S1=2021 且为剧 / 洛基 S2=2023 且为剧 | PASS | PASS |
| 复联5补课电影非剧集（6 部） | PASS | PASS |
| 切回新手入门正常 | PASS | PASS |
| 切换路线后列表位置重置 | PASS | PASS |
| 重置按钮回到默认路线 | PASS | PASS |

**路线说明文案（实测一致）**
- 新手入门：第一次看漫威，照这个顺序看这 12 部就够了
- 主线精选：想理清主线剧情，按这个顺序看这 18 部
- 复联5补课：已看完《终局之战》，补这 8 项接上复联5

**控制台**：无 `pageerror`；仅有 `genui preview` 预览容器自身的网络提示（非产品代码，详见风险项）。

---

## 八、COSUI 冻结件检查结果（guard-frozen.cjs）

执行：`node genui-app-tools/guard-frozen.cjs` → **冻结件完好**。
- 外壳与官方组件样式（`.vc-*` / `.cos-icon` / `.cos-*`）：**零改动**
- 外壳结构存在性：外壳骨架 / 数据引用 `./static/data.js` / `sendLog` / `onTabChange` / `resetDemo` / `showTipsTooltip` / `adjustTipsTooltipPosition` 全部存在
- token 纪律：未定义任何 `--cos-*`；`:root` 干净；`--mcu-*` 全部在 `.mcu-*` 根容器作用域内（1 处）
- 外壳硬指标：1:1 padding-top:100% / absolute+inset:0 / 表头 45px / 内间距 15px 15px 12px / 底描边 0.5px / body 清零 / Tabs 官方类 / 按钮官方类 / cos-icon / 旋转动画 / 气泡 / 画布 flex:1 全部 OK
- 表头文案：小工具 · MCU观影助手（项目名 7 字，≤10）

> 说明：原 MUST 清单中的 `shuffle`(换一部) 与 `onPickRoute`(路线条) 两项，因设计稿已删除对应功能、路线切换统一收归 COSUI Tabs，已从断言中移除（保留其余检查意图，非删除测试取绿）。另新增对 keyframe 帧选择器（如 `0%,100%`）的跳过，避免把已删除的 `.mcu-*` 动画内部帧误判为外壳改动。

---

## 九、genui preview / genui check 结果

- **genui preview**：`genui preview genui-app/index.html -n MCU观影助手 --qr-image` 启动成功（E2E 中实际连接并渲染），端口解析正常，画布正确加载 `data.js`。
- **genui check**：`genui check genui-app/index.html` → **代码包已通过安全检测。**

---

## 十、E2E 测试结果

- 脚本：`genui-app-tools/e2e-visual.cjs`
- 覆盖：360 / 414 两档视口 ×（1:1 比例、无横向/画布溢出、Tabs、三路线切换、剧集标签、洛基 S1/S2 年份、长片名无截断、列表滚动、切换重置、重置按钮、无产品外链、控制台无错）
- 结果：**全部断言通过（45/45）**，结果写入 `scratch/e2e-visual-result.json`
- 截图：见 `screenshots/` 与下方附录

---

## 十一、ZIP 文件路径及实际大小

- 路径：`版本迭代/GenUI小工具/MCU观影助手-GenUI轻量版-V1.0.zip`
- 实际大小：**0.01 MB**（远小于百度平台 8MB 上限）

---

## 十二、ZIP 解压结构检查结果

解压后结构：
```
MCU观影助手-GenUI轻量版-V1.0.zip
├── index.html          (28,390 bytes)
└── static/
    └── data.js         (10,487 bytes)
```
- 根目录直接包含 `index.html`，无多余的 `genui-app/` 包裹层。
- 静态资源统一置于 `static/`。
- `index.html` 通过相对路径 `./static/data.js` 引用数据，解压后引用正常。
- **未引用任何已删除的海报文件**；未包含源码备份 / 临时截图 / 测试报告 / 无用资源。
- 保留完整本地开发目录（`genui-app/` + 备份），非仅留 ZIP。

---

## 十三、未解决问题与风险

1. **洛基 S2 年份数据口径**：母项目 `series.js` 中《洛基》仅存整剧单一年份 `2021`，无「分季」字段；设计稿 V1.0（已验收）明确指定 S2 显示 `2023`。本版按「设计稿为唯一视觉/产品依据」取 2023，并在 `build-data.cjs` 的 `SERIES_SEASON_YEAR` 中注释来源。若产品侧要求以母项目单一年份为准，则需回退为 2021——属数据口径决策，非实现缺陷。
2. **预览容器外链**：`genui preview` 运行时会向预览页注入 cosmic 图标/CSS（来自 `ms.bdstatic.com` CDN），属 GenUI 平台运行时，并非产品代码。产品作用域（`.vc-component-wrapper` 内）经实测 `externalRes=0`，即产品本身零外部网络依赖；真实发布到平台后由官方外壳提供 `--cos-*` token。
3. **旧版测试修正**：`e2e-visual.cjs` 与 `guard-frozen.cjs` 中针对旧结构的过期断言已按设计稿分析并修正，保留了原本有效的检查意图（外壳/比例/溢出/Tabs/无外链），未以「删除失败测试」换取 PASS。
4. **合规边界**：全程严格遵守停止条件——未执行 `genui publish`（含 `--dry-run`/`--yes`）、未提审、未发布、未改母项目 H5、未改线上服务器、未提交 git、未擅自新增功能。
5. **本地环境**：测试在 Windows 开发机完成，`genui` CLI v1.0.4；Playwright 调用系统 Chrome。

---

## 最终状态

**轻量版开发完成，待产品验收，未发布，未提审。**

等待产品（ChatGPT）验收，验收通过后再行发布与提审流程。

---

## 附录：实际浏览器截图（screenshots/）

| 路线 | 360px | 414px |
|---|---|---|
| 新手入门 | `screenshots/route1-新手入门-360px.png` | `screenshots/route1-新手入门-414px.png` |
| 主线精选 | `screenshots/route2-主线精选-360px.png` | `screenshots/route2-主线精选-414px.png` |
| 复联5补课 | `screenshots/route3-复联5补课-360px.png` | `screenshots/route3-复联5补课-414px.png` |
