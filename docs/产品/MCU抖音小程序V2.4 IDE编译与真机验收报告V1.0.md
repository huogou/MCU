# MCU 抖音小程序 V2.4 IDE 编译与真机验收报告 V1.0

| 项目 | 内容 |
|---|---|
| 报告日期 | 2026-11-09 |
| 验证对象 | `douyin/`（V2.4，未升版本号） |
| 验证工具 | 抖音开发者工具 4.5.6（`D:\抖音\@bytedminiprogram-ide`），内置编译器 `@byted-rspuck` 2.15.1 |
| 执行前 HEAD | `519a820`（master） |
| 执行后 HEAD | `519a820`（未提交、未推送、未上传、未提审） |
| 结论 | **B — 有条件提审** |

---

## 0. 结论摘要（先看这里）

- **编译**：用 IDE 内置真实编译器完整编译 `douyin/`，`result: success`，**0 error / 0 warning**。
- **`wx:` 兼容性**：**兼容，无需替换为 `tt:`**。编译器源码显式接受 `wx:`/`wx-` 前缀；真实产物中 `wx:if` 已被编译为三元条件 VNode、`wx:for` 已被编译为 `_renderList`，产物内 `wx:if` 残留计数为 0；IDE 模拟器运行时首页条件块与列表均正常渲染。
- **代码修改**：**本轮 0 处修改**。`douyin/` 下 4 个 `M` 均为上一轮（V2.4 收尾）既有改动，本轮未新增、未回滚。
- **包体积**：开发态产物 3,041 KB / 120 文件；按 `packOptions.ignore` 剔除后的**上传等效 445.9 KB / 59 文件**（主包上限 2 MB，达标）。Tab2 的 `routes.png`(337 B)、`routes-active.png`(342 B) **已确认进入实际上传包**。
- **CDN 图片**：本机实测 76 个 URL（38 海报 + 38 剧照）**全部 200，`image/jpeg`，0 失败**。
- **主要缺口**：真机 10 项验收中，除首页渲染外**其余各项未取得可观测证据**（详见第 4 节），图片域名白名单**未核实**（需后台权限）。故结论为 B 而非 A。

---

## 1. IDE 实际编译结果

### 1.1 环境与项目配置确认

| 项 | 实际值 | 来源 |
|---|---|---|
| IDE 版本 | 4.5.6（`win32-4.5.6-478346290-x64`） | IDE 日志 `release` 字段 |
| 编译器 | `@byted-rspuck` 2.15.1 | IDE `workspace-config.json` → `compiler.cache.puck_version` |
| 登录态 | 已登录（`user_id 3717899342596939` / `yaoqiang0115`），非绕过 | IDE 日志 |
| 项目 | `douyin`（IDE 标题栏「douyin - 抖音开发者工具」） | 窗口标题 |
| AppID | `tt00eb76569e914af801` | `app-config.json` / 日志 `getMicroappInfo` |
| 基础库 | `libVersion 3.0.0` | `project.config.json` |
| 编译类型 | `compileType: miniprogram`，`bigPackageSizeSupport: true`，`urlCheck: false` | `project.config.json` |
| 编译缓存 | `compiler.cache.valid: true`，`puck_version 2.15.1` | IDE `workspace-config.json` |

IDE 已打开项目并在模拟器中加载首页（`iPhone 15 Pro`，`pages/home/home`），状态栏错误/警告计数为 `0 / 0`。

### 1.2 编译执行与结果

- 使用 IDE 自身编译器 CLI（与 IDE 内「编译」同源，非第三方静态检查）：
  `@byted-rspuck/ide/dist/cli.js --compileType microapp --scene ide-simulator --input <douyin> --output <临时目录> --sourceMap false`
- 输出协议：`[sendMsgToIde]{name:'START'}` → `{name:'END', result:'success'}`，并输出 `[编译埋点] ide_compile`（Build / ModuleGraph / Ttpkg / Done 各阶段耗时）。
- **错误：0 条；警告：0 条。** 编译日志全文（1,645 B）无 `warn` / `error` 行。
- 产物结构完整：`app-config.json`、`app-service.js`、`app.js`、`page-frame.js`、`preload-modules.json`、`razor-page-frame.js`、`pages/<name>/*`。
- `app-config.json` 校验：`pages` 10 项、`tabBar.list` 4 项、`entryPagePath: pages/home/home`、`navigationBarTitleText: "MCU观影导航"`。

### 1.3 说明：开发态产物 ≠ 上传包

`--scene ide-simulator` 为开发态编译，**不套用 `packOptions.ignore`**，因此产物含 61 个本应被忽略的文件（设计预览图、本地备用资源目录、校验脚本），共 2,595.1 KB。上传打包会剔除它们，故**不能用 3,041 KB 作为上传包体积**（见第 6 节）。

---

## 2. `wx:` 模板指令兼容性结论及证据

### 2.1 结论

**`wx:` 在抖音开发者工具 4.5.6 下可被正确解析，不需要替换为 `tt:`，本轮未做任何指令替换。**

### 2.2 证据链（三层，互相独立）

**证据一：编译器源码显式声明支持 `wx:` 前缀**

`@byted-razor/compile-core/dist/compile-core.cjs.js`：

- 第 2762 行：`const directivePrefix = ["tt:", "tt-", "wx:", "wx-"];`
- 第 89 行存在同一前缀集合（Set 形式）

即 `wx:if` / `wx:for` / `wx:else` / `wx:elif` / `wx:key` 与 `tt:` 等价，属编译器设计内兼容，不是「碰巧能编译」。

**证据二：真实编译产物已完成指令转换**

对 `page-frame.js` 检索：

| 检索项 | 结果 |
|---|---|
| `wx:if` 残留 | **0 处** |
| `home` 页 `wx:if="{{nextStep}}"` | 编译为 `_data.nextStep ? _createVNode(...)` |
| `home` 页 `wx:for="{{entries}}"` | 编译为 `_renderList(_data.entries, function(item, index){...})` |
| `hasProgress` 等条件表达式 | 正常进入渲染函数，未丢失 |

**证据三：运行时渲染（IDE 模拟器）**

模拟器首页实际渲染出：导航标题「MCU观影导航」、Hero「MCU 旅程」、「已完成 1 / 59 部 · 第一阶段」、快速开始 3 张入口卡（第一次观看 / 继续观看 / 观看路线）、「下一步」卡（《复仇者联盟》）、底部 4 个 Tab。条件块与循环块均可见输出，**无白屏、无数据缺失**。

### 2.3 61 处 `wx:` 分布（静态盘点，仅作范围说明）

集中分布于 `home.wxml`、`journey.wxml`、`movie.wxml`、`library.wxml`、`feedback.wxml`、`my-mcu.wxml`、`share.wxml` 等；指令类型为 `wx:if` / `wx:elif` / `wx:else` / `wx:for` / `wx:key`。`tt:` 现有 0 处，本轮亦未新增。

---

## 3. 是否发生代码修改

**本轮（IDE 编译与真机验收）未修改任何文件。**

`git status -- douyin`：

```
 M douyin/pages/share/share.js
 M douyin/pages/share/share.wxml
 M douyin/project.config.json
 M douyin/utils/check-visible-content.js
```

以上 4 项为上一轮 V2.4 收尾（C1 文案中性化、C2 海报收敛、M1 Tab 图标入包、C3 门禁重写）遗留的工作区改动，本轮只读取、未触碰。`wechat/`、`shared/` 未改动（7 项未提交改动维持原状）。`data/content.js` 的 `source_url` 等溯源字段完整保留。

---

## 4. 真机 10 项验收结果

> 判定口径：只有「可复现的观测证据」才记「通过」；无证据一律记「未观测 / 待确认」，不做推测。
> 本轮可用证据来源：IDE 模拟器截图（1 张首页）、IDE 编译产物、本机网络实测、IDE 日志。**手机端画面不在本机可观测范围**。

| # | 验收项 | 结果 | 依据 / 说明 |
|---|---|---|---|
| 1 | 4 个 Tab 切换 | **部分观测** | Tab 栏 4 项（首页 / 路线 / 作品 / 我的MCU）文案与图标在模拟器正确渲染，`app-config.json` 4 项齐全；**逐项点击切换动作未观测**（见 4.1 阻塞说明） |
| 2 | 首页入口、进度与最近标记 | **部分观测** | 模拟器首页渲染出：3 个快速入口、进度「1 / 59 部 · 第一阶段」、「下一步」卡；**「最近标记」区因当前无最近记录未进入渲染分支，未观测**；入口点击跳转未观测 |
| 3 | 上映顺序路线 | **未观测** | 需在真机/模拟器进入「路线」页切换「上映顺序」 |
| 4 | 主线必看路线 | **未观测** | 同上，需切换「主线必看」 |
| 5 | 作品搜索与观看状态筛选 | **未观测** | 需输入关键词并切换筛选态 |
| 6 | 节点关联跳转 | **未观测** | 需在作品详情页点击关联节点 |
| 7 | 收藏 / 已看 / 进度持久化 | **部分观测** | 首页显示「已完成 1 / 59 部」，说明 `userState` 持久化数据被正确读取并渲染；**写入后杀进程重启的持久化验证未观测** |
| 8 | 分享海报生成、预览、保存 | **未观测** | 需进入分享页并触发 canvas 生成 + 保存相册 |
| 9 | 相册权限拒绝、授权及后续处理 | **未观测** | 必须在真机弹窗上人工选择「拒绝 / 允许」，本机无法代操作 |
| 10 | 本地反馈记录 | **未观测** | 需提交一条反馈并验证本地记录写入 |

**通过项：0；部分观测：3；未观测：7。**

### 4.1 为什么真机 10 项没跑完（阻塞说明，不含推测）

1. **手机画面无法回传**：真机预览已由用户扫码连通，但真机屏幕内容不在本机可读范围，本机只能拿到 IDE 与模拟器侧画面。
2. **模拟器 GUI 自动化被系统前台锁拦下**：脚本已能取得 IDE 窗口句柄，但 Windows 拒绝把非前台进程的窗口置前（`SetForegroundWindow` 返回后前台窗口立即被其他应用抢回），合成点击会落到别的应用窗口（实测有一次落到浏览器）。为避免误操作其他应用，**已停止 GUI 合成点击**，未用「假点击」代替真实验收。
3. **独立 CLI 无法出预览二维码**：`--scene ide-preview` 报 `TypeError: Cannot read properties of undefined (reading 'hooks')`（`@byted-rspuck/plugin-ttpkg`），预览依赖 IDE 宿主注入，只能由 IDE GUI 触发（已由用户完成扫码）。

> 处理方式：以上 10 项按「未观测」如实记录，未把任何未验证项写成通过。

---

## 5. CDN 图片加载与域名白名单核验

### 5.1 CDN 实际加载（本机网络实测）

- 方法：从 `data/visuals.js` 提取 38 张海报 + 38 张剧照，共 **76 个 URL**，逐个发 GET（`Range: bytes=0-1`，8 s 超时，6 并发）。
- 结果：

| 指标 | 数值 |
|---|---|
| 总数 | 76 |
| 成功 | **76** |
| 失败 | **0** |
| Content-Type | `image/jpeg` × 76 |

- 结论：CDN 资源（`https://mcu.yaokaixin.top/assets/...`）在本机网络下**全部可达**，无失效、无 404、无跨域重定向异常。
- 局限：本机为 PC 网络，**不等于真机 4G/Wi-Fi 下的加载结果**；真机侧图片是否全部显示属第 4 节未观测范围。

### 5.2 图片域名白名单

- **未核实，标记为「待产品侧处理」。**
- 依据：IDE 在 15:52:52 确实调用了 `developer.toutiao.com/api/developer/ide/v1/microapp/get_app_domains`（应用域名列表接口），但**响应体未落日志**，本机无法读取白名单内容；核对域名白名单需登录抖音开放平台后台（「开发设置 → 服务器域名 / 图片域名」）。
- 风险提示：`project.config.json` 中 `setting.urlCheck: false`，**开发者工具不校验域名**，因此「IDE/模拟器能显示图片」不能证明「真机能显示图片」。若后台未把 `mcu.yaokaixin.top` 加入图片域名白名单，真机将加载失败。**本报告不声称该项已验证。**

---

## 6. 实际构建包体积与 Tab 图标

### 6.1 两种口径（必须区分）

| 口径 | 文件数 | 体积 | 说明 |
|---|---|---|---|
| 开发态编译产物 | 120 | **3,041 KB** | `--scene ide-simulator`，不套用 `packOptions.ignore`，含设计预览图等非上传文件 |
| **上传等效包（计算值）** | **59** | **445.9 KB** | 按 `packOptions.ignore` 剔除 61 个文件 / 2,595.1 KB 后 |
| 被忽略部分 | 61 | 2,595.1 KB | 21 张 `_*-preview.png` 等设计预览图（1,779.2 KB）、`assets/avatars`、`assets/phases`、`assets/hero`、`assets/entries`、`assets/backgrounds`、`utils/check-*.js` 等 |

- 主包体积 445.9 KB，远低于 2 MB 上限；`bigPackageSizeSupport: true` 亦已开启。
- IDE 内记录的历史上传体积 `Upload:last-size = 219,291 B`（约 214 KB，时间为历史某次上传，**非本轮**），与当前计算值量级一致（差异来自历史构建内容不同），可作旁证但**不作为本轮结论依据**。
- 局限：上传等效体积为**按 `packOptions.ignore` 规则对真实产物做的确定性计算**，非 IDE「上传」按钮回传值（本轮按约束未执行上传）。

### 6.2 Tab2 两个图标是否进入上传包

- `app-config.json` → `tabBar.list[1]`：`iconPath: assets/icons/tab/routes.png`，`selectedIconPath: assets/icons/tab/routes-active.png`。
- `project.config.json` 的 `packOptions.ignore` 已**不再排除**这两个文件（仅排除 `star*.png`、`explore*.png`）。
- 构建产物实存且在上传保留集合内：

| 文件 | 大小 | 是否被 ignore | 结论 |
|---|---|---|---|
| `assets/icons/tab/routes.png` | 337 B | 否 | **进入上传包** |
| `assets/icons/tab/routes-active.png` | 342 B | 否 | **进入上传包** |

→ 上一轮 M1（Tab2 图标被 `packOptions.ignore` 误排除）**已确认修复到位**，产物可自证。

---

## 7. 真机截图与控制台输出

### 7.1 截图

| 截图 | 内容 | 路径 |
|---|---|---|
| IDE 模拟器（首页） | Hero「MCU 旅程」、1/59 进度、3 个快速入口、「下一步」卡、底部 4 Tab | `C:\Users\Administrator\AppData\Local\Temp\mcu-ide-03-printwindow.png`（临时目录，未入库） |

- **真机截图：无。** 手机端画面无法回传，需产品侧补图。

### 7.2 控制台与日志

| 来源 | 内容 | 判定 |
|---|---|---|
| 编译日志 | 无 `error` / `warn` 行 | 通过 |
| IDE 模拟器状态栏 | 错误 0 / 警告 0 | 通过 |
| IDE `main.log` | 15:52:55 有若干 `js_error: Canceled`，栈全部位于 `@byted-tila/vscode/out/out/main.js`（IDE 自身终端容器） | **IDE 内部事件，与本项目代码无关**，不计为项目错误 |
| 真机控制台 | **未取得** | 需产品侧在真机调试面板导出 |

---

## 8. Git 工作区变化

| 项 | 执行前 | 执行后 | 判定 |
|---|---|---|---|
| HEAD | `519a820` | `519a820` | 未变 |
| 分支 | master | master | 未变 |
| `douyin/` 改动 | 4 个 `M` | 4 个 `M`（同一批） | **无新增改动** |
| `wechat/` + `shared/` | 7 项未提交改动 | 7 项 | 未触碰 |
| 新增文件 | — | 本报告 1 个 `??`（`docs/产品/…V1.0.md`） | 仅报告本身 |

未执行 `git commit` / `push` / 上传 / 提审。临时编译产物与日志均写入 `%TEMP%`，未污染仓库。

---

## 9. 最终结论

### B — 有条件提审

**支持提审的已证事实**

1. IDE 真实编译器完整编译通过，0 error / 0 warning，AppID、基础库、10 页 4 Tab 配置均正确。
2. `wx:` 指令三层证据（源码前缀声明、产物指令转换、模拟器渲染）确认兼容，**无需改代码**，不存在「61 处指令导致白屏」的风险。
3. 上传等效包 445.9 KB，远低于 2 MB 上限；Tab2 两个图标确认入包。
4. 76 个 CDN 图片本机实测全部 200，无失效链接。
5. Git 工作区无意外改动，未删除任何溯源字段。

**必须补齐的条件（缺一则不应提审）**

1. **真机 10 项验收**：第 3、4、5、6、8、9、10 项尚无观测证据；第 1、2、7 项仅部分观测。需产品侧在真机上逐项走查并回传截图/结论。
2. **相册权限流程**：必须真机人工点击「拒绝」与「允许」两条分支，确认不崩溃、有兜底提示、可再次授权。
3. **图片域名白名单**：登录抖音开放平台后台核对 `mcu.yaokaixin.top` 是否在图片域名白名单内（`urlCheck:false` 使 IDE 侧无法验证）。
4. **真机控制台**：导出真机调试面板日志，确认无运行时 JS 报错。

**建议（不属本轮范围，未执行）**

- 开发态产物 3,041 KB 中有 1,779.2 KB 是 21 张 `_*-preview.png` 设计预览图。虽然已由 `packOptions.ignore` 排除、不影响上传包，但建议后续把它们移出 `assets/`，避免「开发态体积」与「上传体积」长期产生 6 倍差异、掩盖真实包体变化。
- 品牌名仍有三套并存（`MCU观影导航` / `漫威电影观影导航` / `MCU 宇宙导航`），建议提审前统一，但本轮按约束未改。

---

**报告结束。未执行 commit / push / 上传 / 提审；未修改 `wechat/`、`shared/`；未删除 `source_url` 等溯源字段。**
