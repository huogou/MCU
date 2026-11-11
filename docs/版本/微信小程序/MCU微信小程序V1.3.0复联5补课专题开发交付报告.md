# MCU 微信小程序 V1.3.0 复联5补课专题 · 开发交付报告

> 执行方：CodeBuddy（开发侧）｜日期：2026-11-09｜开发基线：V1.2.2（git HEAD `519a820`）｜目标版本：V1.3.0
> 状态：**代码完成、静态与模拟运行验收通过；未提交 git、未上传、未提审、未发布**。
> 口径声明：本报告中「PASS」均指**静态代码断言 / Node 模拟运行**；**微信开发者工具编译预览与真机测试均未执行**，一律标注「未验证」，不以静态检查冒充真机通过。

---

## 1. 修改和新增文件清单

### 1.1 新增产品文件（5 个）

| 文件 | 用途 |
|---|---|
| `wechat/pages/special/special.js` | 专题页逻辑：数据装配、进度、折叠、勾选、跳转、图片降级 |
| `wechat/pages/special/special.wxml` | 专题页结构：Hero / 核心 8 节点 / 完整 15 节点 / 五段链 / 底部入口 |
| `wechat/pages/special/special.wxss` | 专题页样式（`sp-*` 前缀隔离，全量复用全局 Token） |
| `wechat/pages/special/special.json` | 页面配置（标题「复联5补课路线」、`usingComponents: {}`） |
| `wechat/data/special-routes.js` | 端内专题数据（`module.exports`，H5 数据机械转换） |

### 1.2 修改产品文件（5 个）

| 文件 | 改动 | diff 行数 |
|---|---|---|
| `wechat/pages/home/home.js` | 引入专题数据、装配 `topic`、新增 `goTopic()` | +20 / -0 |
| `wechat/pages/home/home.wxml` | Hero 之后插入独立专题横幅 `v2-topic` | +17 / -0 |
| `wechat/pages/home/home.wxss` | 追加 `.v2-topic-*` 样式块（不动原有规则） | +48 / -0 |
| `wechat/app.json` | `pages` 新增 `pages/special/special` 一行；**tabBar 零改动** | +1 / -0 |
| `wechat/pages/about/about.wxml` | `V1.2.2 → V1.3.0`、`2026-09-22 → 2026-11-09` | +2 / -2 |

### 1.3 验证脚本（1 个，非产品代码）

| 文件 | 用途 |
|---|---|
| `workspace/verify-v130-special.cjs` | 只读验收脚本：数据一致性 + 页面模拟运行 + 合规扫描 + 回归 + 越界检查 + 体积统计。按项目规则落在 `workspace/`（临时验证产物），可删除，不参与小程序打包。 |

### 1.4 明确未修改（禁止范围逐项确认）

`shared/data/*`、`shared/sync_data.sh`、`wechat/data/routes.js`、`wechat/data/content.js`、`wechat/data/movies.js`、`douyin/*`、`h5/*`、`app.json` 的 `tabBar`、`models/userState.js` 的存储结构、`privacy/agreement` 页面、原有 11 条路线及片单、原有 4 Tab 导航 —— **git diff 全部为空**，专题数据未加入三端共享同步链。

**停止条件**：未触发。`mcuData.get/visual/phaseColor/typeLabel` 与 `userState.isSeen/toggle` 现有接口完全满足需求，无需修改禁止范围内文件。

---

## 2. 核心实现说明

### 2.1 数据层（`wechat/data/special-routes.js`）

由 `h5/data/special-routes.js` 机械转换：**workId、core 8 / full 15 顺序、title / tagline / heroNote、label、kw、chain 4 环 + 金色卡文案、origin、entry 文案全部逐字保留**。仅 4 处必要适配：

1. `window.MCU_SPECIAL_ROUTES` → `module.exports`；
2. 新增 `upcoming` **专题内部最小映射**（`id/title/en/date`，来源 `h5/data/upcoming.js` 的 `avengers-5`）——按任务书要求，不修改 `movies.js` / `shared/data` / 同步脚本；
3. `entry.href`（HTML 页面）→ `entry.route` + `mode`（`switchTab` / `navigateTo`），目标为 `/pages/home/home`、`/pages/routes/routes`、`/pages/panorama/panorama`；
4. 新增 `disclaimer`（产品决策 5：「本专题为 MCU Atlas 独立整理的建议路线，非官方指定片单。」）。

### 2.2 专题页逻辑（`special.js`）

- `buildNodes()` 只装配视图模型：作品名 `it.label || mcuData.get(id).cn`、类型 `mcuData.typeLabel`、阶段 `mcuData.phaseColor`、海报 `mcuData.visual()`，**零复制作品数据**；
- **wx:key 唯一**：核心 `c0..c7`、完整 `f0..f14` 前缀序号，洛基 S1/S2 共用 `workId:'loki'` 但 key 不重复；
- 已看状态只调用 `userState.isSeen/toggle`，与 `movie` 页共用 `mcu_nav_user_v1.watched`，**零新增 storage key**；
- 进度徽章按 **8 个核心节点**统计；洛基一勾选两个节点同时亮（沿用 H5 口径）；「你看到这里了」金线按 H5 规则插在最后已看节点之后；
- `fullOpen` 用 WXML `wx:if` + `setData` 折叠，`onShow()` 刷新进度但保留折叠态（返回 / 重复进入状态正常）；折叠、勾选、徽章均无 DOM / `innerHTML` / `<details>`；
- `onGoCore` / `onGoFull` 用 `wx.createSelectorQuery` + `wx.pageScrollTo` 定位；`catchtap` 阻止序号按钮冒泡到整卡跳转；
- `onImgError` 记录失败 key，节点 `imgErr` 驱动 WXML 走「阶段色 + 首字」兜底，不新增图片资源；
- `onEntry` 按 `mode` 调用 `switchTab` / `navigateTo`，全部小程序内部路由。

### 2.3 首页与注册

- `home.js` 的 `refresh()` 由专题数据派生 `topic`（标题、副文案「复联5之前，先看这 8 部」、日期 `2026.12.18`、英文名 `DOOMSDAY`），`goTopic()` → `/pages/special/special?id=avengers-doomsday`；
- 横幅位于 **Hero Banner 之后、2×2 宇宙入口之前**；`ENTRY_CARDS` 4 张卡的数量 / 顺序 / 语义**未改**；路线 Tab 未加第二个入口；
- `app.json` 仅加 1 行页面注册，tabBar 4 项及图标文案保持 V1.2.2 原样。

### 2.4 合规

页面底部保留「本小程序只整理观看顺序，不提供播放/下载。」；无外链、无 `web-view`、无播放器 / 播放按钮 / 下载入口、无「在线观看 / 立即播放」文案、无用户信息采集、无新增后台接口与图片资源。

---

## 3. 15 个 workId 命中验证结果

| 项 | 结果 |
|---|---|
| 专题唯一 workId | **15 个**（含起点 `endgame`；core 8 + full 15 去重后） |
| 命中 `wechat/data/content.js` 的 `CONTENT`（59 条） | **15 / 15，零缺失** |
| 命中 H5 `MCU_CONTENT`（59 条） | **15 / 15** |
| 唯一 workId 集合与 H5 完全一致 | PASS |

15 个 ID：`endgame, loki, multiverse-of-madness, no-way-home, deadpool-wolverine, brave-new-world, thunderbolts, fantastic-four, wandavision, quantumania, falcon-winter-soldier, hawkeye, ironheart, daredevil-born-again, what-if`。
→ **未新增 / 未扩充任何作品数据，未执行 `sync_data.sh`**。

---

## 4. 各项测试结果及未通过项

验收脚本：`node workspace/verify-v130-special.cjs` → **PASS 103 / FAIL 0**（静态断言 + Node 模拟运行；`node --check` 对 3 个新增/修改 JS 与脚本本身均通过；IDE 诊断 0 条）。

| # | 任务书验收项 | 结果 | 方式与边界 |
|---|---|---|---|
| 1 | 15 个 workId 全部命中 CONTENT | **PASS** | 数据加载实测 |
| 2 | core 8 / full 15 顺序与 H5 一致 | **PASS** | 逐项比对 workId / label / kw |
| 3 | 起点《终局之战》与终点《毁灭之日》 | **PASS** | 起点名动态解析；终点数字 `5`、短名 `DOOMSDAY`、日期均由内部映射派生 |
| 4 | 洛基 S1/S2 一勾两亮 | **PASS** | 模拟 `onToggle('loki')`：core + full 两列表共 4 个节点同时变已看 |
| 5 | 专题进度 ↔ 作品详情页双向同步 | **PASS（模拟）** | 专题 toggle 后 `userState.isSeen('loki')=true`；反向模拟详情页 `toggle` 后 `onShow()` 同步；真机未验证 |
| 6 | 进度按核心 8 节点计 | **PASS** | 初始 `已看 0 / 8` → 勾 loki `已看 2 / 8` → 再勾一部 `已看 3 / 8` |
| 7 | 所有作品详情跳转正确 | **PASS（模拟）** | 15 个唯一 workId 全部生成 `/pages/movie/movie?id=...` 且目标数据存在；真机未验证 |
| 8 | 折叠、展开、返回、重复进入 | **部分 PASS** | 折叠 / 展开 / Hero CTA 展开 / 重复进入保留折叠态：模拟 PASS；**「返回」依赖微信系统导航栏，真机未验证** |
| 9 | CDN 图片失败降级 | **PASS（模拟）** | 模拟 `binderror` → 节点 `imgErr=true` → WXML 条件渲染首字兜底；真实网络失败未验证 |
| 10 | 首页入口及底部导航 | **PASS（模拟）** | 首页 `topic` 装配、`goTopic` URL、横幅位置；底部 3 入口 `switchTab/switchTab/navigateTo` 与目标路径全部正确；真机未验证 |
| 11 | 375 / 390 / 430 布局检查 | **静态审查 PASS / 渲染未验证** | 零裸 hex、零 `px` 硬编码、flex + `min-width:0`、长文本省略/换行、固定 rpx 小尺寸；**未做三档宽度渲染验证** |
| 12 | 原有 15 页及 4 Tab 回归 | **静态回归 PASS / 运行时未验证** | 16 页注册、原 15 页四件套齐全、所有 json 可解析、tabBar 4 项与顺序不变、2×2 入口卡 4 张不变、WXML 事件均有实现、两个 WXML 标签配对、多元宇宙路线保留；**未做 15 页运行时回归** |
| 13 | 全局扫描外链 / 播放器 / 下载 / storage key | **PASS** | 12 类禁用特征零命中；合规声明在场；运行时写操作仅 `mcu_nav_user_v1`，无新增 key |
| 14 | git diff 越界检查 | **PASS** | 禁止范围零 diff；已跟踪修改仅限 5 个允许文件；未跟踪仅 5 个产品新增 |

**未通过项：0（已执行项）**。**未执行 / 未验证项**：第 8 项的「返回」真机行为、第 11 项三档渲染、第 12 项运行时回归、微信开发者工具与真机测试（见 §5、§6）。以上不计为 PASS。

---

## 5. 微信开发者工具测试结果

**未执行，标注未验证。**
本机仅检测到微信开发者工具的**用户数据与缓存目录**（`C:/Users/Administrator/AppData/Local/微信开发者工具/User Data`、`AppData/Roaming/微信开发者工具`），常见安装路径与 `cli.bat` 均不存在（已逐一探测），故本次**未启动工具、未编译、未预览、未生成上传包**。
因此：**WXML/WXSS 编译结果、页面渲染、控制台报错、`wx.createSelectorQuery` 滚动定位、编译后包体积均未经工具验证**。本次仅完成 `node --check`、JSON 解析、WXML 标签配对与事件函数存在性等静态检查。

## 6. 真机测试结果

**未执行，标注未验证。**
未安装/未启动开发者工具、未连接真机，故以下均为未验证：375/390/430 实际渲染与横向溢出、`catchtap` 阻止冒泡的真实点击行为、CDN 海报加载失败降级、系统返回键、Tab 切换、页面滚动定位、进度与作品详情页真机双向同步。

---

## 7. 主包体积变化

| 项 | 数值 |
|---|---|
| 新增 5 个产品文件 | **35,219 bytes（34.39 KB）** |
| 修改 5 个文件净增 | **4,165 bytes（4.07 KB）** |
| **源码合计净增** | **39,384 bytes（约 38.46 KB）** |

> ⚠ 以上为**源码字节变化**，不是编译/上传包体积。微信开发者工具未运行，**编译后主包体积、是否触发分包阈值未测**。新页未引入任何图片资源，图片仍走现有 CDN。

开发前基线字节（用于对比）：`app.json` 1741、`home.js` 9126、`home.wxml` 6187、`home.wxss` 10611、`about.wxml` 1272。

## 8. git diff 与提交记录

```
git diff --numstat -- wechat/
1  0  wechat/app.json
2  2  wechat/pages/about/about.wxml
20 0  wechat/pages/home/home.js
17 0  wechat/pages/home/home.wxml
48 0  wechat/pages/home/home.wxss
```

`git status --porcelain --untracked-files=all`：5 个 `M`（上表）+ 5 个 `??`（`wechat/data/special-routes.js` 与 `wechat/pages/special/` 四件套）+ 1 个 `??`（`workspace/verify-v130-special.cjs`）。工作区另有上一轮交付的盘点报告 `docs/版本/微信小程序/MCU微信小程序V1.2.2现状盘点与复联5专题升级建议报告.md` 为未跟踪文件（非本次开发产物，未动）。

**提交记录：本次未执行任何 git 提交（无新 commit）**，开发基线 HEAD 仍为 `519a820`（2026-11-02）。原因：任务书未要求提交，且仓库存在他人在途工作区，避免卷入非本次改动。**未上传、未提交微信审核、未发布线上版本。**

> 备注：git 提示 `LF will be replaced by CRLF`（仓库 `core.autocrlf=true`），但 `diff --numstat` 仅为上述预期增量，未出现整文件行尾重写，越界检查通过。

---

## 9. 产品决策逐条对照

| # | 决策 | 落地 |
|---|---|---|
| 1 | 新建独立专题页，不扩展 routes.js | 新增 `pages/special/`，`wechat/data/routes.js` 零改动 |
| 2 | Hero 之后、2×2 入口之前加横幅 | `home.wxml` 独立 `v2-topic` section，位置断言 PASS |
| 3 | 不加 Tab、路线 Tab 不加第二入口 | tabBar 4 项不变；`routes` 页零 `special` 引用 |
| 4 | 保留多元宇宙路线 | `multiverse-line` 及「为《复联5》做准备」文案原样保留 |
| 5 | 标注非官方指定片单 | Hero 下 `sp-disclaimer` 常驻显示 |
| 6 | 洛基一勾两亮、进度按 8 节点 | 模拟验证 PASS |
| 7 | 与作品详情页共用已看状态 | 仅用 `userState.isSeen/toggle`，零新增 key |
| 8 | V1.3.0 | `about.wxml` 已更新 |

---

## 10. 遗留问题及风险

1. **最高优先级**：微信开发者工具编译/预览与真机测试未执行（§5、§6）。上线前必须补做：编译无报错、375/390/430 三档渲染无横向溢出、真机点击/返回/进度同步、CDN 失败降级、控制台无 error。
2. **审核风险（历史教训）**：微信 V1.2.1 曾因「涉及视频服务，个人主体未开放类目」被驳回。专题页含海报列表，虽已弱化观看 CTA、保留「只整理观看顺序，不提供播放/下载」声明且零外链，**提审前仍建议做一次视觉/文案合规复核**。
3. **双份同构数据**：H5 `window.MCU_SPECIAL_ROUTES` 与小程序 `module.exports` 为两份文件，后续片单/文案调整需同步修改两端并重新跑本验收脚本（脚本已内置逐字比对）。
4. **上映后撤除**：删 `home.wxml` 的 `v2-topic` section + `home.wxss` 的 `.v2-topic-*` 样式块；专题页可保留或同步移出 `app.json`；无 storage 残留。
5. **已知口径**：洛基 S1/S2「一勾两亮」为沿用 H5 的设计决策，页面不额外提示；点击两节点均进入同一 `movie?id=loki`。
6. **未顺带修复（按任务书）**：`project.config.json` 描述仍写 V1.0、`app.js` 注释 V1.0；以及 V1.2.2 盘点中登记的存量问题（路线页 `title`/`cn` 字段不匹配、收藏与保存路线 UI 无入口、`browse` 页无入口、文档口径冲突）。均未纳入本次范围。
7. **CDN 依赖**：专题海报复用 `https://mcu.yaokaixin.top`（现有 `visuals.js`），已实现首字兜底；若该域退役需统一评估三端。
8. **编译后主包体积未测**：源码净增约 38.46 KB，编译压缩后实际增量与分包阈值需开发者工具确认。

---

## 11. 交付结论

V1.3.0 复联5补课专题已按任务书在 **不重构、不改三端数据结构、不触碰禁止范围** 的前提下完成：`10 个产品文件（5 新增 + 5 修改）` + `1 个验收脚本`。静态与模拟运行验收 **103/103 PASS，0 未通过**。

**当前状态：等待产品验收与微信开发者工具 / 真机补测；未提交 git、未上传、未提审、未发布。** 本报告不将任何静态检查结果描述为真机验证通过。

**关联文件**
- 交付报告：`docs/版本/微信小程序/MCU微信小程序V1.3.0复联5补课专题开发交付报告.md`
- 上轮现状盘点：`docs/版本/微信小程序/MCU微信小程序V1.2.2现状盘点与复联5专题升级建议报告.md`
- 验收脚本：`workspace/verify-v130-special.cjs`（`node workspace/verify-v130-special.cjs` 可复跑）
