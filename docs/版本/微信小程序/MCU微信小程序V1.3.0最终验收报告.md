# MCU 微信小程序 V1.3.0 最终验收报告

> 执行方：CodeBuddy（开发侧）｜日期：2026-11-09
> 验收对象：V1.3.0 复联5补课专题｜开发基线：V1.2.2 / git HEAD `519a820`
> 依据：《MCU 微信小程序 V1.3.0 复联5补课专题开发交付报告》与本次《最终验收任务书》
> **最终结论：B. 有条件通过**（存在未验证项目，已明确风险及补测条件）

---

## 0. 结论与停止条件（2026-11-09 登录后补测更新）

**最终结论：B. 有条件通过**。第一轮因未登录触发停止条件；用户完成扫码登录后已完成第二轮补测，**编译、专题页与首页横幅渲染、控制台、原有功能回归均实测通过**，但仍存在明确未验证项，故仍不具备进入 Git 提交及发布准备的条件（不是 A）；未发现阻断性缺陷（不是 C）。

**第一轮（未登录）**：`cli islogin` → `{"login":false}`，`cli open --project <绝对路径>` → `[error] code 10 需要重新登录`，触发「缺少必要账号授权」停止条件；编译/渲染/尺寸/交互/包体积/真机一律标注未验证。

**第二轮（登录补测，详见 §7）**：`cli islogin` → `{"login":true}`；`cli open` → `✔ open`；`wechatide auth` → `authorized:true / alreadyTrusted:true / tokenRequired:false`；`check_wechatide_status` → `loginExpired:false / versionRelation:equal`。官方 compiler / debugger 通道完成本地编译、控制台与模拟器截图：**项目编译 PASS、专题页与首页横幅真实渲染 PASS、控制台零 error PASS、4 个 Tab + 作品详情页回归 PASS**。

**仍未验证**：375 / 430 两档尺寸（官方工具集无模拟器机型切换 API，仅当前 iPhone 12/13 一档实拍）、10 项 UI 交互（`automation_*` / `automation_wx_api call` 稳定 ETIMEDOUT，自动化端口 9420 未监听）、专题页下半屏渲染（`pageScrollTo` 超时）、编译后主包体积（无读取工具且 preview/upload 被禁止）、真机测试（无设备与授权）。

**执行约束复核**：未执行 `upload` / `preview` 上传 / 提审 / 发布；未执行 `git commit` / `git push`；未改 AppID、账号、项目权限与配置（`project.config.json`、`project.private.config.json`、`app.json` 的 SHA256 前后一致）；未引入新依赖（仅用工具自带 `wechatide`）；未修改禁止范围；缺陷修复 **0 处**。

> 证据分级：**静态检查**（源码/数据断言）、**模拟测试**（Node mock `wx`/`Page`）、**开发工具测试**（CLI / wechatide compiler-debugger）、**模拟器测试**（`simulator_open_page` + `simulator_screenshot` 实拍）、**真机测试**（未执行）。不以静态、模拟或工具返回冒充真机通过。

---

## 1. 验收结果总表（按任务书 §六 · 补测后）

| 验收项目 | 结果 | 实际测试证据（区分测试类型） |
|---|---|---|
| 开发工具启动 | **PASS** | 开发工具测试：`{"login":true}`、`✔ open`、`wechatide auth: authorized:true`、门禁 `loginExpired:false / versionRelation:equal`、IDE 服务 `127.0.0.1:50713` |
| 项目编译 | **PASS** | 开发工具测试：`compile_wxss` 两次 `success:true`；`simulator_open_page` 对 6 个页面全部 `success:true`；console `grep -i error` 返回空；模拟器测试：专题页/首页实际渲染成功（WXML 单文件编译工具 `compile_wxml` 调用超时，但页面渲染成功即为编译通过的间接证据） |
| 专题页渲染 | **PASS（首屏）／下半屏未验证** | 模拟器实拍 `workspace/verify-v130-shots/08-special-nowait.jpg`：Hero、日期、双 CTA、免责声明、核心 8 节点/徽章 `已看 0 / 8`、起点条、洛基 S1/S2、真实海报与首字兜底均可见；滚动工具超时，完整 15 节点折叠区/五段链/底部入口未见实拍 |
| 三档尺寸检查 | **未验证** | 仅当前 iPhone 12/13 一档实拍无可见横向溢出；官方工具无「切换机型/宽度」API，375 / 430 未切换，按任务书不得用 CSS 静态审查代替渲染 |
| 10 项交互测试 | **未验证** | Node 模拟运行 10 项逻辑 PASS（§4.3）；IDE 自动化端口 9420 未监听，`automation_runtime_info` / `automation_navigate` / `automation_page_action` / `automation_wx_api call` 均 ETIMEDOUT，UI 点击与真机交互未执行 |
| 原有功能回归 | **PASS（静态 + 模拟器）／真机未验证** | 模拟器：`simulator_open_page` 依次打开 `home / routes / explore / my-mcu / movie?id=loki` 全部 success，console 无 error；静态：tabBar 4 项、2×2 入口卡、11 条路线、多元宇宙路线、隐私/用户协议、userState 零改动 |
| 合规风险检查 | **PASS（静态）** | 12 类禁用特征零命中、诱导观看/播放类文案 0 命中、两项声明在场（截图亦可见免责声明）；**不承诺微信审核通过** |
| 编译包体积 | **未验证**（无实际数值） | IDE 未提供包体积读取工具；`preview` / `upload` 按约束未执行。编译缓存最近产物 868,748 B / 42 文件仅作调试产物参考，**不作为包体积结论**；源码净增 39,384 B 同样不代替 |
| 缺陷修复 | **0 处** | 补测未发现 V1.3.0 明确缺陷；未改任何产品代码，未产生修复 diff |
| Git 工作区保护 | **PASS** | 无 commit / push / 上传 / 提审 / 发布；HEAD 仍 `519a820`；报告与脚本保留；精确禁止范围零 diff；他人在途工作未清理未覆盖 |

---

## 2. 开发环境检查（开发工具测试 · 实测证据）

| 项 | 实测结果 |
|---|---|
| 工具安装 | 注册表 `HKLM\SOFTWARE\WOW6432Node\...\Uninstall\微信开发者工具`：`微信开发者工具 2.02.2608040`，`DisplayIcon = D:\微信web开发者工具\微信开发者工具.exe`；安装目录内 `cli.bat` / `cli.js` / exe 均存在（上一轮只探测常见路径，遗漏此安装位置，本次已纠正） |
| CLI 通道 | `D:\微信web开发者工具\cli.bat --help` **exit 0**，返回 `open / islogin / preview / auto-preview / upload / build-npm / auto / agent / close / quit` 等命令与 `--project/--port/--token` 参数 |
| IDE 服务 | `✔ IDE server started successfully, listening on http://127.0.0.1:50713`（`islogin` 输出） |
| 登录态 | `cli islogin` → **`{"login":false}`** |
| 导入项目（相对路径） | `cli open --project wechat` → `[error] code 10 项目路径不存在` |
| 导入项目（绝对路径） | `cli open --project d:/SEO/发挥余热/漫威电影宇宙导航/wechat` → **`[error] code 10 需要重新登录`** |
| 配置保护 | `project.config.json` / `project.private.config.json` / `app.json` 的 SHA256 前后一致：`edfe25eda292｜ab5609101901｜bd723e82c388` → 未变；未执行 `login`、未改账号与权限 |
| 项目配置 | `project.config.json`：`appid wx78f00e7f0a5948b7`、`compileType miniprogram`、`libVersion 3.0.0`、`es6/enhance/postcss/minified` 开启、`minifyWXML/minifyWXSS: true`、`urlCheck:false` |
| 基础库口径 | `project.private.config.json` 的 `libVersion 3.17.1` 会覆盖 `project.config.json` 的 `3.0.0`（既有配置，本次未改）；**真机/模拟器实际基础库版本未验证** |
| 未执行项 | `preview`（需登录且会上传预览包，任务书禁止上传）、`auto`（需 `miniprogram-automator` 等新依赖，任务书禁止引入）、`upload`（禁止） |

---

## 3. 已完成的可执行验收（静态 + 模拟）

`node workspace/verify-v130-special.cjs` 重跑：**PASS 103 / FAIL 0**；`node --check` 对 3 个 JS 与脚本本身通过；IDE 诊断 0 条。

| 类别 | 覆盖内容与结果 |
|---|---|
| 数据一致性 | 15 个唯一 workId 15/15 命中 `wechat/data/content.js`；core 8 / full 15 顺序、label、kw、文案与 H5 逐字一致；起点、终点（`5` / `DOOMSDAY` / `2026.12.18`）、五段链一致 |
| 页面模拟运行 | `onLoad/onShow` 装配、默认折叠、进度徽章 `已看 0 / 8`、wx:key 唯一（c0..c7 / f0..f14）、洛基一勾两亮（core+full 共 4 节点）、「你看到这里了」分隔、15 个作品详情跳转、底部 3 入口、CDN 失败降级 |
| 进度同步 | 专题 → 详情：`userState.isSeen('loki')=true`；详情 → 专题：模拟 `toggle` 后 `onShow()` 同步，徽章 `已看 3 / 8`；运行时仅写 `mcu_nav_user_v1`，`userState` 数据结构未变 |
| 折叠与重复进入 | 展开/收起/Hero CTA 展开 PASS；`onShow()` 保留 `fullOpen` |
| 首页入口 | 模拟 `refresh()` 得到 `topic`（标题 / `复联5之前，先看这 8 部` / `2026.12.18` / `DOOMSDAY`）；`goTopic()` → `/pages/special/special?id=avengers-doomsday`；2×2 入口卡仍 4 张且顺序不变 |
| 静态回归 | 16 页注册、原 15 页四件套齐全、所有 json 可解析、tabBar 4 项与顺序不变、WXML 事件均有实现、`special.wxml` 与 `home.wxml` 标签配对、多元宇宙路线保留 |
| 合规扫描 | `http(s)` 外链、H5 域名、`web-view`、`navigateToMiniProgram`、`<video`、`innerHTML/document.`、`<details`、storage 直调、在线观看/立即播放/下载入口、`<a/href=` 全部零命中；合规声明在场；无新增图片资源引用 |
| 越界检查 | 禁止范围零 diff；已跟踪修改仅 5 个允许文件；未跟踪仅 5 个产品新增 |

补充静态审查：`gap`、`{{!...}}` 在项目既有页面（`feedback.wxss`、`explore.wxml` 等）已广泛使用；新增页 `env(safe-area-inset-bottom)` 位于 `calc()` 内，前一条 `padding-bottom: var(--space-2xl)` 可作兜底 —— 均属**待 IDE 渲染确认**的兼容点，非已验证通过。

---

## 4. 逐项验收明细

### 4.1 编译与页面检查（任务书 §二.2）—— 全部「未验证」

| 检查点 | 结果 | 原因 |
|---|---|---|
| WXML / WXSS / JS 编译错误 | 未验证 | 项目未导入，IDE 未编译；仅 `node --check`、JSON 解析、标签配对等静态检查通过 |
| 专题页能否正常打开 | 未验证 | 需 IDE 模拟器 |
| 首页横幅位置、样式、跳转 | 静态 + 模拟 PASS / 渲染未验证 | 源码位置断言与 `goTopic()` 模拟通过；视觉渲染未见 |
| 核心 8 / 完整 15 节点展示 | 静态 + 模拟 PASS / 渲染未验证 | 视图模型 8/15 节点装配正确 |
| 折叠与展开 | 模拟 PASS / 渲染未验证 | `fullOpen` 状态切换正确 |
| 海报及加载失败兜底 | 模拟 PASS / 渲染未验证 | `imgErr` 驱动 WXML 条件渲染，真实 CDN 失败未见 |
| 页面滚动定位 | 未验证 | `wx.createSelectorQuery` + `wx.pageScrollTo` 仅静态存在，未运行 |
| 底部入口跳转 | 模拟 PASS / 渲染未验证 | 3 个 URL 与跳转方式正确 |
| 控制台异常 | 未验证 | 未编译、无控制台输出 |

### 4.2 三档尺寸检查（375 / 390 / 430）—— 未验证

静态审查已确认：全 rpx、零裸 hex、flex + `min-width:0`、日期/英文名字 `text-overflow: ellipsis`、节点信息列 `word-break`、海报 88×124rpx 固定比例、底部 `safe-area` 留白。但**横向溢出、标题截断、卡片布局、海报比例、按钮热区、底部遮挡均未经实际渲染检查**，按任务书要求不写 PASS。

### 4.3 10 项交互测试（模拟运行逐项）

| # | 交互 | 模拟结果 | 开发工具/真机 |
|---|---|---|---|
| 1 | 首页横幅进入专题页 | PASS（`goTopic` URL 正确） | 未验证 |
| 2 | 核心/完整节点切换 | PASS（`fullOpen` 切换） | 未验证 |
| 3 | 勾选后进度更新 | PASS（`0/8 → 2/8 → 3/8`） | 未验证 |
| 4 | 洛基 S1/S2 状态同步 | PASS（两列表共 4 节点同亮） | 未验证 |
| 5 | 专题 ↔ 作品详情双向同步 | PASS（同一 `userState` 实例） | 未验证 |
| 6 | 作品卡片进入详情页 | PASS（15 个 workId 全测） | 未验证 |
| 7 | 返回专题页进度刷新 | PASS（`onShow` 模拟） | 未验证 |
| 8 | 折叠/展开/重复进入 | PASS | 未验证 |
| 9 | 页面滚动定位 | **未验证**（仅静态存在） | 未验证 |
| 10 | 底部三个入口 | PASS（switchTab/switchTab/navigateTo） | 未验证 |

**汇总结果：未验证**（模拟测试不等同开发工具/真机交互）。

### 4.4 原有功能回归（静态 + 模拟 PASS，运行时未验证）

4 个 Tab 页面路径/顺序/图标文案不变；首页 2×2 入口卡 4 张与顺序不变；11 条路线与 `multiverse-line` 片单零改动；`movie` 详情页、`userState.js`、`privacy` / `agreement` 页面 `git diff` 为空；已看状态数据结构未变、运行时仅写既有 key。未删除或弱化任何原有功能。**IDE/真机运行时回归未执行**。

### 4.5 审核风险复核（静态 PASS，不承诺过审）

- 禁用特征：外链、H5 域名、`web-view`、`navigateToMiniProgram`、播放器/`<video`、播放/下载/在线观看入口文案 —— 12 类零命中（验收脚本 T13）。
- 补充扫描「诱导观看」类词（`在线观看 / 立即播放 / 立即观看 / 点击观看 / 去观看 / 马上看 / 免费看 / 播放地址 / VIP / 抢先 / 投屏 / 观看入口 / 诱导`）—— **0 命中**。
- 两项声明均在场：`disclaimer`（「本专题为 MCU Atlas 独立整理的建议路线，非官方指定片单。」）与「本小程序只整理观看顺序，不提供播放/下载。」。
- **风险识别（不承诺通过）**：专题页仍含作品海报列表与「先补这 8 部 / 完整补课 15 部 / 查看作品」等路线引导文案，属导航而非播放功能入口；鉴于 V1.2.1 曾因「涉及视频服务，个人主体未开放类目」被驳回，**提审前建议做一次真机视觉与文案人工复核**，并在微信后台核对服务类目。

### 4.6 缺陷修复

**本次修复 0 处**。理由：静态断言 + Node 模拟运行未发现 V1.3.0 新增/修改代码的明确缺陷；未触发「最小必要修复」条件。**但项目编译与渲染未执行，不能据此断言零缺陷**；若补测发现 WXML/WXSS 编译错误或渲染问题，需另立最小修复并保留修改前后 diff。未修改任何禁止范围内文件，未引入依赖/外部接口/新存储结构，未改 `tabBar`。

### 4.7 包体积检查

**编译后主包大小：未验证（无实际数值）**；是否触及分包/主包限制、新增页面对编译包的实际影响均无法测量。工具未编译、未生成 `.wxapkg`；`preview` 因登录态与「不上传微信平台」约束未执行。
仅供参考的代码量变化（**不得当作包体积**）：新增 5 文件 35,219 B、修改 5 文件净增 4,165 B、合计 39,384 B（约 38.46 KB）。

### 4.8 Git 与文件保护（PASS）

- `git log -1`：`HEAD 519a820 2026-11-02 ...` 未变；**无新 commit、无 push、无上传、无提审、无发布**。
- `wechat/` 范围：5 个 `M`（`app.json`、`about.wxml`、`home.js/wxml/wxss`）+ 5 个 `??`（`data/special-routes.js` 与 `pages/special/` 四件套）；diff 增量 `1/0、2/2、20/0、17/0、48/0`。
- 两份报告与验收脚本均保留：`docs/版本/微信小程序/MCU微信小程序V1.2.2现状盘点与复联5专题升级建议报告.md`、`docs/版本/微信小程序/MCU微信小程序V1.3.0复联5补课专题开发交付报告.md`、`workspace/verify-v130-special.cjs`。
- `wechat/pages/privacy`、`wechat/pages/agreement`、`wechat/pages/movie`、`wechat/models/userState.js`、`wechat/data/routes.js`、`shared/`、`douyin/`、`h5/` 的 `git diff --numstat` 全为空。
- 全仓库另有 GenUI 小工具、资讯模块等**他人在途改动**，本次未清理、未覆盖、未暂存。

---

## 5. 未验证清单与补测条件

| 未验证项 | 依赖条件 |
|---|---|
| 项目编译、WXML/WXSS/JS 编译错误、控制台异常 | 已登录的微信开发者工具导入 `wechat/` |
| 专题页渲染、首页横幅视觉、8/15 节点展示、海报及失败兜底、滚动定位 | IDE 模拟器 |
| 375 / 390 / 430 三档实际渲染（溢出/截断/卡片/海报/按钮/底部遮挡） | IDE 模拟器三档机型 |
| 10 项交互在 IDE 与真机上的真实点击行为 | IDE 模拟器 + 真机 |
| 原有 15 页 / 4 Tab 运行时回归 | IDE 模拟器 |
| 编译后主包体积、分包阈值 | IDE 编译产物 / 上传包信息 |
| 真机测试（全部） | 登录态 + 真机设备 + 授权 |

**唯一推荐动作（补测）**：由彦祖在完成微信开发者工具扫码登录后，导入 `d:/SEO/发挥余热/漫威电影宇宙导航/wechat` 完成本地编译并检查控制台，再按 §4.1–§4.3 顺序做三档渲染与 10 项交互、原有功能运行时回归，最后读取编译后主包体积；补测结果回填本报告后再裁定是否进入 Git 提交与发布准备。补测不等于提交审核或发布，仍受任务书第五节约束。

---

## 6. 最终判定（补测后复判）

**B. 有条件通过**（结论不变，但补测范围显著扩大）：登录补测后，**项目编译、专题页与首页横幅模拟器渲染、控制台零 error、4 Tab + 作品详情页回归均实测通过**，静态/模拟 103 项验收保持全绿（除 1 项因他人在途改动的环境噪声，见 §7.9），Git 工作区保护完好，未发现阻断性缺陷。
仍存在 4 类未验证项：**375/430 两档尺寸、10 项 UI 交互（IDE 自动化通道故障）、编译后主包体积、真机测试**；另有专题页下半屏渲染因滚动工具超时未见实拍。因此**仍不具备进入 Git 提交及后续发布准备的条件（不是 A）**；未发现阻断性缺陷（不是 C）。补测条件见 §7.11。

> §2–§5 为第一轮（未登录）记录，保留不改；**结论与状态以 §0 / §1 / §6 / §7 为准**。本报告未将开发完成、静态检查、模拟运行或工具返回描述为真机验证通过；未承诺微信审核必然通过。

---

## 7. 登录后补测记录（2026-11-09 · 第二轮）

> 说明：§7 全部为**开发工具测试 / 模拟器测试**；真机测试未执行。未执行 upload / preview 上传 / 提审 / 发布 / git commit / push，未改 AppID、账号、项目权限与配置，未引入新依赖（仅使用工具自带 `wechatide`）。

### 7.1 登录与项目导入（开发工具测试 · PASS）

| 命令 | 真实输出 |
|---|---|
| `cli islogin` | `{"login":true}` |
| `cli open --project d:/SEO/发挥余热/漫威电影宇宙导航/wechat` | `✔ open`（exit 0） |
| `wechatide auth -c CodeBuddy` | `{"ok":true,"authorized":true,"alreadyTrusted":true,"port":50713,"tokenRequired":false}` |
| `check_wechatide_status --skill-version 0.3.9` | `loginExpired:false`、`versionRelation:equal`、`tokenRequired:false`、`skillVersion 0.3.9` |
| 配置保护 | `project.config.json` / `project.private.config.json` / `app.json` SHA256 前后一致 `edfe25eda292｜ab5609101901｜bd723e82c388` |

基础库实测：`WeChatLib: 3.17.1 (2026.8.28 14:30:47)`（console），与 `project.private.config.json` 的 `libVersion 3.17.1` 一致；`project.config.json` 的 `3.0.0` 被私有配置覆盖（既有口径，本次未改）。AppID `wx78f00e7f0a5948b7` 未变。

### 7.2 编译检查（开发工具测试 · PASS）

- `compile_wxss --file-path pages/special/special.wxss` → `success:true, files:2, fileList:["comm","page"], totalCodeLength:14530`；`pages/home/home.wxss` 同样 `success:true`。
- `compile_wxml`（special / home）**两次调用均 ETIMEDOUT 无输出**，该单文件诊断工具不可用；但 `simulator_open_page` 对专题页与 5 个原有页面全部 `success:true`，且专题页 WXML 结构在模拟器中完整渲染 → **WXML 编译通过的间接实证**。
- `get_simulator_console --command "grep -i error"` → 返回空字符串（**零 error**）；全量日志仅 3 条：`[info] WeChatLib 3.17.1`、`[info] Lazy code loading is enabled`、`[warn] [Perf] App.onLaunch took 82ms / 94ms`（性能提示，非错误）。
- `get_simulator_network --command "grep -n ."` → 空（未捕获到请求记录，不作为海报失败证据；海报以截图实证为准）。

### 7.3 模拟器实拍（模拟器测试 · PASS，首屏）

- 首页横幅：`workspace/verify-v130-shots/probe.jpg`（用户另行提供的 IDE 截图亦一致）——Hero 之后、旅程卡之前的金边卡片「补课专题 / 复联5补课路线 / 复联5之前，先看这 8 部 / 查看路线 / 2026.12.18 / DOOMSDAY」，位置与文案符合产品决策。
- 专题页：`workspace/verify-v130-shots/08-special-nowait.jpg` —— 导航栏「复联5补课路线」、Hero 标题与 tagline、`2026.12.18 / AVENGERS: DOOMSDAY`、双 CTA「先补这 8 部 ›」「完整补课 15 部 ›」、heroNote、**免责声明**「本专题为 MCU Atlas 独立整理的建议路线，非官方指定片单。」、区块「核心补课路线 · 8部」+ 徽章 **`已看 0 / 8`**、起点条「你已看完《复仇者联盟4：终局之战》/ 时间线起点」、节点 1「洛基 S1 / TVA / 时间线 / P4 / 2021」、节点 2「洛基 S2 / 多元宇宙正式开启」、节点 3「奇异博士2：疯狂多元宇宙」。
- **海报与失败降级**：节点 3 显示 CDN 真实海报；节点 1/2（剧集 `loki` 无海报映射）显示阶段色 + 「洛」首字兜底 —— 两种路径均按预期工作，无破图。
- 未实拍：`完整 15 节点折叠区 / 五段链 / 终点卡 / 底部入口 / 合规声明` —— `automation_viewport_action pageScrollTo` 与 `wx.pageScrollTo` 调用均 ETIMEDOUT，`09-bottom.jpg` 仍为首屏。

### 7.4 原有功能回归（模拟器测试 · PASS）

`simulator_open_page` 依次打开 `pages/home/home`、`pages/routes/routes`、`pages/explore/explore`、`pages/my-mcu/my-mcu`、`pages/movie/movie?id=loki` —— **5/5 `success:true`**；回归后 `console grep -i error` 为空。静态回归（tabBar 4 项、2×2 入口卡、11 条路线、多元宇宙路线、隐私/用户协议、userState 零改动）见 §3/§4.4。**真机运行时回归未执行**。

### 7.5 三档尺寸检查（部分未验证）

官方 `wechatide` 工具集（tool-index / tools.yaml）**无模拟器机型或宽度切换 API**；`automation_runtime_info systemInfo`、`automation_element_action size` 属 automator 通道，均 ETIMEDOUT。实测仅当前机型（IDE 显示 iPhone 12/13，约 390 逻辑宽度）一档：专题页与首页首屏**无可见横向溢出、标题与卡片未截断**（截图证据）。**375 / 430 两档未验证**，不以 CSS 静态审查代替渲染。

### 7.6 10 项交互测试（未验证）

`cli auto --project` 已执行且返回 `✔ auto`，但自动化端口 **9420 未监听**（50713 正常）；以下工具**全部 ETIMEDOUT（无输出）**：`automation_runtime_info`、`automation_navigate`、`automation_page_action`、`automation_element_action`、`automation_viewport_action`、`automation_wx_api call`（`getSystemInfoSync` / `pageScrollTo` / `navigateTo` / `getStorageSync`）。`automation_wx_api` 首次以错误参数调用时返回 `args 期望 array`，证明通道存在但 `call` 动作会挂起；`simulator_screenshot` 带 `--wait` / `--wait-for-selector` 亦挂起，去掉可选参数后正常。
因此 **UI 点击、折叠/展开、勾选、进度同步、卡片跳转、返回刷新、滚动定位、底部入口均未在模拟器/真机执行**；仅 Node 模拟运行 10 项逻辑 PASS（§4.3），不等同交互测试通过。**真机测试全部未执行**。

### 7.7 编译后主包体积（未验证）

IDE 未提供包体积读取工具；`preview` / `upload` 按约束未执行，无 `.wxapkg` 可测。参考数据（**均不作为包体积结论**）：IDE 编译缓存最近目录 `868,748 B / 42 文件`、另一缓存 `1,917,412 B / 94 文件`（调试缓存含 source map 等，非上传包）；源码净增 `39,384 B`。是否触及主包/分包限制：**未验证**。

### 7.8 审核风险复核（静态 PASS，不承诺过审）

补测未改变合规结论：12 类禁用特征零命中、诱导观看/播放类文案 0 命中、两项声明在场（免责声明已在模拟器截图可见）。专题页仍含海报列表与「先补这 8 部」等路线引导文案，属导航而非播放入口；V1.2.1 类目误判历史仍需提审前人工视觉/文案复核。

### 7.9 原有 103 项验收脚本重跑（102 PASS / 1 FAIL）

`node workspace/verify-v130-special.cjs` → **PASS 102 / FAIL 1**。唯一 FAIL 为 `T14-1 禁止范围文件零 diff`，实测 `h5/data/characters.js` 出现 **+4 行 `ultron` 角色实体**的**他人在途改动**（git log 该文件仍为 `9dbc29b`，属未提交工作区修改），与 V1.3.0 开发/补测无关，且本次未触碰该文件、未清理或覆盖他人在途工作。补充精确检查：`wechat/data/{routes,content,movies}.js`、`wechat/models/userState.js`、`wechat/pages/{movie,privacy,agreement}`、`shared/data/`、`shared/sync_data.sh`、`douyin/` 全部零 diff；允许范围内仅 `wechat/app.json` `1/0`。**未为通过测试而修改验收脚本或绕过断言**。

### 7.10 Git 与文件保护（PASS）

`HEAD` 仍 `519a820`（2026-11-02），无 commit / push；未上传、未提审、未发布；V1.2.2 盘点报告、V1.3.0 开发交付报告、`workspace/verify-v130-special.cjs` 均保留。补测新增验证产物：`workspace/verify-v130-devtools.cjs`、`workspace/verify-v130-devtools-result.json`（29 条工具调用原始记录）、`workspace/verify-v130-shots/`（4 张实拍 JPEG + 3 个参数 JSON），均为验证产物，不参与小程序打包。缺陷修复 **0 处**，无产品代码 diff。

### 7.11 剩余未验证项与补测条件

| 未验证项 | 原因 | 补测条件（唯一推荐动作） |
|---|---|---|
| 375 / 430 两档渲染 | 无机型切换 API | 在 IDE 顶部机型下拉手动切换，重跑无等待截图与元素尺寸断言 |
| 10 项 UI 交互 / 下半屏渲染 | automator 端口 9420 未监听、工具超时 | 在 IDE「设置 → 安全」启用自动化并恢复端口后，按 §4.3 顺序重跑点击/折叠/勾选/跳转/滚动 |
| 编译后主包体积 | 无读取工具、preview/upload 被禁止 | 由彦祖在不上传前提下从 IDE「详情/代码质量」读取，或在另行授权后由预览包信息获取 |
| 真机测试 | 无设备与授权 | 扫码真机调试后按 10 项交互清单复测 |
| 原验收脚本 T14-1 | 他人在途 `h5/data/characters.js` +4 行 | 待该在途工作提交或回退后重跑脚本，预期恢复 103/103 |

### 7.12 结论依据

**B. 有条件通过**：补测把「编译 / 渲染 / 控制台 / 回归」从「未验证」推进到**实测 PASS**，未发现任何阻断性缺陷，静态与模拟验收保持全绿；但仍有上述 4 类未验证项（尺寸两档、UI 交互、包体积、真机），按任务书定义不具备 A 的条件。完成 §7.11 补测并回填后，方可复判是否进入 Git 提交及发布准备。

**交付文件**：`docs/版本/微信小程序/MCU微信小程序V1.3.0最终验收报告.md`（本文件，含第一轮记录与 §7 补测记录）
**验证脚本**：`workspace/verify-v130-special.cjs`（103 项静态/模拟）、`workspace/verify-v130-devtools.cjs`（官方工具补测）
**实拍证据**：`workspace/verify-v130-shots/probe.jpg`（首页横幅）、`workspace/verify-v130-shots/08-special-nowait.jpg`（专题页首屏）
