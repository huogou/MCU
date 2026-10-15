# MCU观影导航 V1.1 首页继续观看开发验收报告

- 版本：V1.1 Step2 v1.0
- 日期：2026-08-24
- 维护方：开发/设计 AI（WorkBuddy）
- 依据：V1.1 Step2 首页继续观看开发指令 + V1.1 数据模型确认报告
- 范围：严格限定首页（当前旅程状态卡 / 下一站推荐卡 / 最近观看），未越界开发其他页面

---

## 1. 修改文件（3 个）

| 文件 | 变更 |
|---|---|
| `mcu-miniprogram/pages/home/home.js` | data 增加 `journey / nextCard`；新增 `buildJourney / resolveCurrentRouteId / buildNextCard`；`buildContinue / buildPhaseTag` 整合进 `buildJourney`；`refresh()` 进度分母统一为 CONTENT 全量 59；交互 `goContinue` → `goNext`；新用户态 hero 注释更新 |
| `mcu-miniprogram/pages/home/home.wxml` | 新用户态 hero 文案「欢迎进入 MCU / 选一条路线…」（指令四）；老用户态顶部新增 ① 旅程状态卡 + ③ 下一站推荐卡（替换原继续观看区块为 nextCard）+ 完成态卡兜底 |
| `mcu-miniprogram/pages/home/home.wxss` | 新增 `.journey-card / .journey-label / .journey-row / .j-item / .j-key / .j-val` + `.last-seen` + `.done-card`（V1.1 Step2 全部新增样式） |

## 2. 新增文件（2 个 · 视觉预览）

| 文件 | 用途 |
|---|---|
| `mcu-miniprogram/assets/icons/tab/_home-v11-old-preview.png` | 老用户态首页模拟预览（750×1334，SVG→sharp 渲染，非真机） |
| `mcu-miniprogram/assets/icons/tab/_home-v11-new-preview.png` | 新用户态首页模拟预览（750×1100，SVG→sharp 渲染，非真机） |

> 环境无 GUI 开发者工具，采用 SVG→PNG 模拟渲染。临时脚本与 SVG 源已清理。

## 3. 首页截图（模拟预览）

**老用户态**（_home-v11-old-preview.png）：
- 顶部金色边框「继续你的 MCU 旅程」三列：当前路线=新手入坑 / 当前阶段=Phase 1 / 观看进度=2 / 59
- 进度环 2/59（金环 + 第一阶段 · 无限传奇 徽章）
- 下一站推荐卡：下一站 · Phase 1 · 上次看到《雷神》+ 复仇者联盟 + 简短说明（why 截断）+ 金色「继续观看」按钮
- 快捷入口（新手入坑路线 2/12 / 宇宙探索）
- 最近看过横滑（钢铁侠 / 雷神 / 复仇者联盟 阶段色海报）

**新用户态**（_home-v11-new-preview.png）：
- 「欢迎进入 MCU」大标题 + 副文案（指令四）
- 热门角色起点 pills（6 个）
- 3 功能入口卡（观影路线 / 宇宙探索 / 帮我选）
- 「从《钢铁侠》开始」CTA 金色按钮

## 4. 新用户测试结果

| 项 | 预期 | 实际 |
|---|---|---|
| hasProgress | false | ✓ |
| 欢迎语 | 包含「欢迎进入 MCU」 | ✓ |
| 引导 | CTA=从钢铁侠开始 | ✓ |
| 进度分母 | 0 / 59 | ✓ |
| 数据兼容 | 无 watched 走 userState 默认态 | ✓ |

## 5. 老用户测试结果

**5.1 逻辑冒烟（5 用例 18/18 通过，临时脚本已清理）**

| 用例 | 验证项 | 结果 |
|---|---|---|
| 1 新用户 | hasProgress=false / CTA=iron-man / 热门 8 个 / 进度 0/59 | ✓ |
| 2 老用户 2 部 | 旅程卡=新手入坑/Phase 1/2/59 + 下一站=复仇者联盟（thor 手写 mainline 推荐）+ 标注「上次看到 雷神」 | ✓ |
| 3 指定 current_route | 旅程卡=复仇者联盟路线（current_route→saved_routes[].routeId 解析） | ✓ |
| 4 主线看完 | recommend 无结果 → done 完成态卡（不再跳转） | ✓ |
| 5 V1.0 兼容 | 含 milestones_shown 的老用户数据读取后字节级不变；3 部进度=3/59 | ✓ |

**5.2 关键功能验证**

- **3 秒内知道下一步**（指令二）：老用户态顶部 ① 旅程卡 + ② 进度环 + ③ 下一站卡顺序连续呈现，从「当前路线/阶段/进度」到「下一站 继续观看」单屏可达（750×1334 视口内可见 ① 旅程 + ② 进度 + ③ 下一站 + 进入 ④ 快捷）。
- **current_route 优先**（指令四）：`resolveCurrentRouteId` 先查 saved_routes 中 id===current_route 的项取 routeId；无则默认 newcomer；旅程卡显示真实路线名（用例 3 验证）。
- **current_content 关联**（指令四）：`latest = userState.latest()` 取 watched 最新上映作品，旅程阶段/下一站卡均以此为基准（nextCard.lastSeen=最新作品 cn）。
- **下一站推荐**（指令三）：`recommend.next(latest.id, 'mainline')` —— 沿用 V1.0 已验证的推荐逻辑（手写 next 优先 + 上映序推导 + RELATIONS ro 序），含简短说明（why 或 content.role 截断 40 字）+ 继续观看按钮 → movie 详情。
- **V1.0 数据兼容**（指令六）：全程只读 `mcu_nav_user_v1`（不修改、不并入字段）；`userState.js` 零修改。

**5.3 数据来源与铁律验证**

| 限制 | 状态 |
|---|---|
| 只读取 mcu_nav_user_v1 + CONTENT + ROUTES | ✓（recommend.js 内部读 RELATIONS 为 V1.0 既有逻辑，不改数据；panorama/CHARACTERS/PANO 未触碰） |
| 禁止修改原数据 | ✓（data/* 零修改；userState.js 零修改） |
| 已有观看记录用户继续可用 | ✓（用例 5 字节级对比通过） |

## 6. 视觉与代码质量

| 项 | 状态 |
|---|---|
| 全 Token 化 | ✓（home.wxss 全局零 raw hex；新增样式使用 var(--gold) / rgba(233,169,59,*) 派生色） |
| wxml 零内联 svg | ✓ |
| 零 emoji / 零第三方图标 | ✓（海报用阶段色渐变 + 中文首字占位，与 V1.0 一致） |
| 节点 --check | ✓（home.js / userState.js / 全工程 28 个 JS） |
| 进度环 canvas 2d | ✓（drawRing 沿用 V1.0，hex 直写 surface-3 / gold 为技术必要） |

## 7. 已知问题 / 待后续

1. **进度分母口径调整**：V1.0 首页进度环分母为 `counts().movie=38`；V1.1 统一为 `mcuData.all.length=59`（与我的MCU 一致，符合指令示例 3/59）。同屏两处数字（旅程卡 2/59 + 进度环 2/59）现已一致；老用户可能看到 59 顶替 38 的视觉变化——**口径变化，非功能删除**，待策划确认。
2. **成就进度条**未在本步开发：依指令二"只开发首页相关功能、严格按阶段推进"原则，成就进度条属成就系统模块，**留待 Step5 成就系统**。Step2 完成后将由成就系统提供接口接入首页。
3. **真机截图未补**：环境无 GUI 开发者工具，采用 SVG→sharp 模拟预览。**真机效果仍待 Step7 阶段补拍**（沿用 V1.0 惯例）。
4. **下一站说明文案**：当前用 `c.role || recommend.why` 截断 40 字；CONTENT 多数内容 `role` 字段较长，截断后可能断句（如预览图「不看就接不上」处）。可在后续版本按字符边界（句号/逗号）优化截断。

## 8. 交付物

- 代码：home.js / home.wxml / home.wxss（3 文件）
- 预览：_home-v11-old-preview.png / _home-v11-new-preview.png（2 图）
- 本报告：AI生成文件/MCU观影导航 V1.1 首页继续观看开发验收报告.md

---

*Step2 完成后暂停，等待下一阶段指令（开发启动指令第九节：第三步 我的MCU 2.0）。*
