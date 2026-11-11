# MCU 抖音小程序 V2.4 提审前最终核验报告 V1.0

- 核验性质：**提审前质量核验（只读）**。不开发新功能、不升级版本号、不修改代码/数据/平台后台、不提交审核、不执行 Git 写操作。
- 核验日期：2026-11-09
- 核验对象：`douyin/`（Git `master`，V2.4，commit `7b43ddd`，2026-09-23）
- 依据：《MCU 抖音小程序现状恢复与 V2.5 迭代前审计报告 V1.0》
- 对照基线：微信 V1.3.0（本次仅作功能对照，未读取/修改其代码）

## 最终结论：**B. 有条件提审**

> **判定依据**：静态检查与数据核验全部通过（页面结构、跳转、数据完整性、零引流均无实质问题），核心功能代码链路完整；但存在 **1 项静态可确认的配置缺陷（Tab2 图标被打包忽略规则排除）** 与 **4 项本机无法完成的运行时验证（抖音开发者工具编译/真机渲染/图片域名白名单/相册权限）**。这些项目未闭环前，不能判定为「A. 可以提审」；同时未发现影响核心功能实现或合规底线的实质性问题，故不判「C」。

| 结论选项 | 是否适用 | 说明 |
|---|---|---|
| A. 可以提审 | 否 | 缺开发者工具编译与真机验证，且存在 Tab 图标配置冲突 |
| **B. 有条件提审** | **是** | 修复/确认 §9 的 M1，并完成 §10 的 U1-U3 验证后，方可提交 |
| C. 暂不可提审 | 否 | 无核心功能崩溃、无引流回潮、无数据断裂 |

---

## 1. 核验范围、方法与证据等级

| 等级 | 含义 |
|---|---|
| A | 平台原始记录（审核原文、后台截图、真机截图） |
| B | 项目内文字记录（文档/提交信息明确转述） |
| C | 本次实测（代码、数据、脚本、网络探测） |
| D | 推断（无直接证据） |

**本次实际完成的验证类型**：源码静态检查（C）、数据完整性计算（C）、自带脚本复跑（C）、网络可达性探测（C）。
**本次未完成的验证类型**：抖音开发者工具编译、预览二维码、真机运行、后台配置核对（**均标记未验证**）。

---

## 2. 自检脚本复核（36 PASS / 1 FAIL）

### 2.1 复跑结果

- 命令：`node workspace/verify-v24.cjs`
- 结果：**PASS 36 / FAIL 1**（与审计报告一致，可复现）
- 唯一 FAIL 项：`movie 无删除项回潮（poster/观看/收藏/上映）`

### 2.2 误报机理（确认为注释误报）

| 证据 | 内容 |
|---|---|
| 判定代码 | [verify-v24.cjs](file:///d:/SEO/发挥余热/漫威电影宇宙导航/workspace/verify-v24.cjs#L53) 该断言直接对**原始 wxml 文本**执行 `mw.indexOf(k)`，**未剥离注释** |
| 命中位置 | [movie.wxml](file:///d:/SEO/发挥余热/漫威电影宇宙导航/douyin/pages/movie/movie.wxml#L3) 第 3 行注释：`V2.3 结构性删除：海报、英文片名、内容类型标签、观看状态、标记已看、收藏、上映日期` |
| 剥离注释后复测 | `poster=否 / watched=否 / 收藏=否 / 上映=否`，四项全部不存在 → 断言应为 PASS |
| 对比 | 同一脚本的「零引流残留」扫描（L22）已实现注释剥离，唯独 L53 未剥 → **脚本自身不一致** |

### 2.3 结论

- **该 FAIL 确属注释误报**，渲染层无任何回潮。
- **未删除、未放宽任何有效检查**；本次仅在核验脚本外做「剥离注释」的等价复算，`verify-v24.cjs` 本体未改动。
- 建议（不属本次修改范围）：将 L53 改为对剥离注释后的文本判定，与 L22 口径统一；否则该 FAIL 会长期干扰 CI。

---

## 3. 页面注册、跳转路径与资源引用

### 3.1 页面注册（10 页 / 4 Tab）

| 检查项 | 结果 | 证据 |
|---|---|---|
| `app.json.pages` 数量 | 10 | [app.json](file:///d:/SEO/发挥余热/漫威电影宇宙导航/douyin/app.json) |
| 每页四件套（js/wxml/json/wxss） | **10/10 齐全，无缺文件** | C（逐页存在性检查） |
| TabBar 4 项注册 | home / journey / library / my-mcu **全部在 pages 中** | C |
| TabBar 8 个图标文件 | **本地 8/8 存在，均为 81×81 PNG** | C |

### 3.2 跳转路径

- 扫描 35 个页面/模型 JS，提取所有指向 `pages/...` 的 `url/path`：**悬空跳转 0 个**。
- `switchTab`（首页→路线/作品/我的MCU、我的MCU→路线）与 `navigateTo`（→movie/feedback/share/law）目标均已在 `app.json` 注册。

### 3.3 资源引用

| 类型 | 结果 |
|---|---|
| 页面 `usingComponents` | 全部为空（无组件依赖），**不存在指向已删除 `components/h5-guide` 的残留引用** |
| 本地图片引用 | 仅 TabBar 图标 8 个，全部存在 |
| 网络图片引用 | 通过 `<image src="{{poster}}">` 动态绑定，域名统一为 `https://mcu.yaokaixin.top`（详见 §7.3） |
| 缺失资源 | **0** |

---

## 4. 核心功能核验（静态链路）

| 功能 | 实现位置 | 静态检查结果 | 运行时 |
|---|---|---|---|
| 首页 | [home.js](file:///d:/SEO/发挥余热/漫威电影宇宙导航/douyin/pages/home/home.js) | 进度 Hero、3 个快速入口（第一次/继续/路线）、下一步、最近标记；无 H5 入口 | 未验证 |
| 双路线 | [journey.js](file:///d:/SEO/发挥余热/漫威电影宇宙导航/douyin/pages/journey/journey.js) | `release` / `mainline` 两条，生成器均可用；进度条与已看状态计算正确 | 未验证 |
| 作品查询 | [library.js](file:///d:/SEO/发挥余热/漫威电影宇宙导航/douyin/pages/library/library.js) | 搜索（名称/英文名）+ 观看状态筛选 + 空态重置；无分页压力（59 条） | 未验证 |
| 节点关联 | [movie.wxml](file:///d:/SEO/发挥余热/漫威电影宇宙导航/douyin/pages/movie/movie.wxml) | 仅渲染中文名/阶段/节点信息/关联节点；`mcuData.get(other)` 取不到时已过滤（[movie.js](file:///d:/SEO/发挥余热/漫威电影宇宙导航/douyin/pages/movie/movie.js) 有空值保护） | 未验证 |
| 收藏 | [my-mcu.js](file:///d:/SEO/发挥余热/漫威电影宇宙导航/douyin/pages/my-mcu/my-mcu.js) | 列表就地收藏/取消，写本机 storage | 未验证 |
| 进度记录 | [userState.js](file:///d:/SEO/发挥余热/漫威电影宇宙导航/douyin/models/userState.js) | 已看集合、最近标记、路线进度；键 `mcu_nav_user_v1` | 未验证 |
| 成就 | [achievements.js](file:///d:/SEO/发挥余热/漫威电影宇宙导航/douyin/models/achievements.js) | 6 项成就按已看数计算，边界（0 部）不报错 | 未验证 |
| 分享海报 | [share.js](file:///d:/SEO/发挥余热/漫威电影宇宙导航/douyin/pages/share/share.js) | progress/route/movie 三型绘制逻辑完整；保存走 `canvas.toDataURL → writeFile → saveImageToPhotosAlbum`，含授权失败引导 | 未验证（canvas 2D 与相册权限须真机） |
| 本地反馈 | [feedback.js](file:///d:/SEO/发挥余热/漫威电影宇宙导航/douyin/pages/feedback/feedback.js) | 纯本机队列（`tt.getStorageSync/setStorageSync`），无网络、无云端 | 未验证 |

**功能核验结论**：静态链路完整、无中断；**不代表真机运行通过**（§10）。

---

## 5. 数据完整性、异常与高风险内容回潮

### 5.1 数据完整性（实测）

| 指标 | 结果 |
|---|---|
| 内容总数 | 59（38 电影 + 5 短片 + 14 剧集 + 2 特别呈现） |
| 关系 | 92 条，**端点全部存在** |
| 角色 | 24 位，页面引用的角色 id 全部存在 |
| 路线 | 11 条；显式节点引用全部存在；无「既无 items 又无 generator」的路线 |
| 重复 id | 0 |
| 必填字段缺失 | 0 |
| phase 越界 | 0 |
| 待映节点（`avengers-5/6`） | 不在 CONTENT 中，节点页不渲染 → 无悬空访问 |
| 综合问题数 | **0** |

### 5.2 页面异常 / 控制台错误

- 静态可查的异常：**无空指针高风险点**（movie 对 `notFound` 有兜底；library/home/journey 均有空数组判断）。
- **控制台错误**：**未验证**（本机无抖音开发者工具，无法产生真实 console 输出）。

### 5.3 历史高风险内容是否回潮

| 风险项 | 检查结果 | 证据 |
|---|---|---|
| 影视详情特征（节点页） | **未回潮**：movie 页正文仅 中文名/阶段/节点信息/关联节点/导航按钮 | [movie.wxml](file:///d:/SEO/发挥余热/漫威电影宇宙导航/douyin/pages/movie/movie.wxml)（注释剥离后 `poster/watched/收藏/上映` 全 0） |
| 第三方引流 | **未回潮**：0 个 h5-guide / h5Link / mcuatlas / 复制链接 / setClipboardData / window.open | `verify-v24.cjs` 12 类特征 × 全源码行 = 0 命中；本次复核一致 |
| 已删除页面 | **未恢复**：explore/panorama/characters/character/routes/route-detail 目录均不存在 | C |
| 但——分享海报仍渲染影视文本 | **存在**：movie 海报绘制 `movieEn` + `movieRole`；route 海报绘制 `tagline` + `descLines` | [share.js](file:///d:/SEO/发挥余热/漫威电影宇宙导航/douyin/pages/share/share.js)（见 §9 C2） |

### 5.4 仓库自带合规门禁

- 脚本：[check-visible-content.js](file:///d:/SEO/发挥余热/漫威电影宇宙导航/douyin/utils/check-visible-content.js)
- 复跑：**FAIL（exit 1）**，报「禁用词命中 2 处」，均来自 `RELATIONS.why`（`winter-soldier → age-of-ultron`，含「官方支持/官方」）。
- **关键判定**：该脚本的检查口径基于 V1.3.0（当时 movie 页渲染 `why`）。**V2.4 节点页已不渲染 `why`**（本次已逐字段核对），故这 2 处**不属于用户可见内容**，属**门禁口径过期**，不是 V2.4 回潮。
- 同时发现该门禁**漏检**：`role` 未纳入扫描，而 `civil-war` 的 `role` 含「官方靠山」，会被 movie 分享海报绘制（见 §9 C2）。
- 结论：门禁 FAIL **不构成提审阻断**，但需产品侧确认口径（§9 C3）。

---

## 6. H5 引导 / 外部链接 / web-view

| 检查项 | 结果 | 证据 |
|---|---|---|
| `<web-view>` | **0** | 全目录扫描 |
| `navigateToMiniProgram` / `openEmbeddedMiniProgram` | **0** | 全目录扫描 |
| `setClipboardData` / 剪贴板 | **0** | 全目录扫描 |
| `window.open` / `location.href` / `openUrl` | **0** | 全目录扫描 |
| `h5-guide` / `h5Link` / `mcuatlas` / `goH5` | **0**（文件已删除，引用已清） | `verify-v24.cjs` + 本次复扫 |
| `tt.request / tt.uploadFile / tt.downloadFile / cloud` | **0** | 全目录扫描 |
| 唯一外部网络行为 | `<image>` 与 canvas 加载 `https://mcu.yaokaixin.top` 图片 | [visuals.js](file:///d:/SEO/发挥余热/漫威电影宇宙导航/douyin/data/visuals.js) |

**结论：第三方引流入口为 0。** 唯一遗留的外部依赖是**图片 CDN 域名**（非可点击链接、非跳转），其合规性与可用性见 §7.3/§10 U3。

---

## 7. 编译、包体积与平台配置

### 7.1 编译

| 检查 | 结果 |
|---|---|
| JS 语法（`node --check`） | **35/35 通过** |
| JSON 解析 | **12/12 通过** |
| 抖音开发者工具编译 | **未验证**（本机未安装抖音开发者工具，仅检测到 `Bytedance\JianyingPro`） |
| 预览 / 真机 | **未验证** |

### 7.2 包体积（静态估算，非平台构建结果）

| 指标 | 数值 |
|---|---|
| 全量文件 | 约 **2.87 MB**（主要冗余：`assets/preview` 1.78MB、`avatars` 389KB、`phases` 275KB 等历史截图/图标） |
| `packOptions.ignore` 排除 | 约 **2.59 MB** |
| **实际打包估算** | **约 0.27 MB** |
| 平台主包上限 | **未在本仓库取得官方书面口径 → 未验证**；按常见 2MB 主包上限，0.27MB **无超限风险** |

> `project.config.json` 已配置 `bigPackageSizeSupport: true`，但当前体积远低于常见上限，该开关不影响结论。

### 7.3 平台配置关键项

| 项 | 值 | 判定 |
|---|---|---|
| AppID | `tt00eb76569e914af801` | 与迁移记录一致 |
| `libVersion` | `3.0.0` | 基础库版本有效性 **未验证**（需 IDE 实际加载） |
| `setting.urlCheck` | `false` | **仅影响开发者工具**，不代表线上域名已放行 → 见 U3 |
| `packOptions.ignore` | 含 `assets/icons/tab/routes.png`、`routes-active.png` | **缺陷 M1**（见 §9） |
| 网络图片域名 | `https://mcu.yaokaixin.top`（HEAD 200、`image/jpeg`、149,681B，2026-11-09 实测可访问） | 网络层可达已证；**平台白名单未验证** |

---

## 8. 产品名称、简介、类目一致性 + 提审资料清单

### 8.1 一致性核对

| 项 | 代码/页面现值 | 判定 |
|---|---|---|
| 服务类目 | 记录为 `工具-实用工具-信息查询`；实际功能=查询/记录/路线/成就，**无播放、无资讯、无交易** | **一致（B）**，无需更改 |
| 页面标题/工程名 | `MCU观影导航`（[app.json](file:///d:/SEO/发挥余热/漫威电影宇宙导航/douyin/app.json)） | 与「观影」词存在软风险 |
| 关于页产品名 | `漫威电影观影导航`（[about.wxml](file:///d:/SEO/发挥余热/漫威电影宇宙导航/douyin/pages/about/about.wxml)） | **与页面标题不一致** |
| 分享海报品牌名 | `MCU 宇宙导航`（[shareData.js](file:///d:/SEO/发挥余热/漫威电影宇宙导航/douyin/models/shareData.js)） | **第三套名称** |
| 后台注册名称 | 未知 | **未验证（需后台核对）** |

**判定：功能与类目一致；但应用内存在**三套品牌名**，提审前建议统一（至少与后台注册名一致）。

### 8.2 提审资料清单（仅整理，未修改后台）

- [ ] 小程序名称（与后台一致，确认是否为「MCU观影导航」）
- [ ] 服务类目：工具-实用工具-信息查询（主体资质已备）
- [ ] 简介文案（建议强调：作品信息查询、进度记录、路线规划、数据仅存本机、**不提供播放/下载/资讯**）
- [ ] 小程序头像、3-5 张运行截图（建议避免以电影海报为主视觉，以免强化影视属性）
- [ ] 版本号（以平台上传版本为准；about 已写 V2.4）
- [ ] 隐私保护指引（需声明：本机存储、写入相册、设备信息；说明无账号体系）
- [ ] 测试说明（免登录、无测试账号；审核路径：首页→作品→节点→我的MCU→反馈）
- [ ] 版权声明/免责声明（about 与 agreement 已含「海报版权归原权利人」）
- [ ] 提审备注（工具定位说明、无外链、无 H5、无视频资源）

---

## 9. 缺陷与建议清单（未修改任何代码）

| 编号 | 级别 | 位置 | 问题 | 修复建议 |
|---|---|---|---|---|
| **M1** | **必须处理** | [project.config.json](file:///d:/SEO/发挥余热/漫威电影宇宙导航/douyin/project.config.json) `packOptions.ignore` | 排除了仍被 [app.json](file:///d:/SEO/发挥余热/漫威电影宇宙导航/douyin/app.json) tabBar 引用的 `assets/icons/tab/routes.png` 与 `routes-active.png`（两文件本地存在且为有效 81×81 PNG）。若抖音 IDE 遵循该忽略规则，Tab2「路线」图标将在上传包中缺失，可能导致上传校验失败或图标空白 | 从 ignore 移除这两条；或为 Tab2 换用未被忽略的图标路径 |
| C1 | 建议 | [share.wxml](file:///d:/SEO/发挥余热/漫威电影宇宙导航/douyin/pages/share/share.wxml) | 分享说明中提及「小红书」等第三方平台名 | 改为中性表述（如「分享给朋友」），降低引流误判 |
| C2 | 建议 | [share.js](file:///d:/SEO/发挥余热/漫威电影宇宙导航/douyin/pages/share/share.js) | 电影海报渲染英文片名 + `role`（`civil-war` 含「官方靠山」）；路线海报渲染 `tagline/desc`。虽仅在分享海报出现，仍是「影视详情特征/编辑体」残留 | 若追求最稳：海报只保留中文片名/年份/进度，去掉英文名与解读文本 |
| C3 | 需裁定 | [check-visible-content.js](file:///d:/SEO/发挥余热/漫威电影宇宙导航/douyin/utils/check-visible-content.js) | 门禁 FAIL（2 处 `why`，V2.4 未渲染）；且漏检 `role` | 由产品侧确认：更新门禁口径（仅扫实际渲染字段）或调整数据文案 |
| C4 | 低 | [movie.js](file:///d:/SEO/发挥余热/漫威电影宇宙导航/douyin/pages/movie/movie.js) | 「关联节点 · N」计数为全部关系数，列表最多显示 4 条，可能出现「5 却只显示 4」 | 计数与展示数取同一口径 |
| C5 | 低 | app.json / about.wxml / shareData.js | 三套品牌名不一致 | 统一为后台注册名 |
| C6 | 低 | app.json | `backgroundTextStyle: "dark"` 配深色背景，下拉加载点几乎不可见；tabBar 未选中色 `#555F73` 于 `#161D2B` 对比度偏低 | 调为 `light`；提高未选中色亮度 |
| C7 | 提示 | 工作区 | 存在大量未提交改动（与本次核验无关），影响可复现性 | 由项目侧决定是否整理基线 |

> 以上均未擅自修改；M1 建议在提审前处理，C1-C2 由产品侧决定，C3 需口径裁定。

---

## 10. 未验证事项（不得以静态检查替代）

| 编号 | 未验证项 | 原因 | 影响 | 验证方式 |
|---|---|---|---|---|
| **U1** | 抖音开发者工具编译/预览 | 本机未安装抖音开发者工具 | 无法证明构建产物可用 | 安装 IDE → 导入 `douyin/` → 编译无报错 |
| **U2** | 真机渲染与交互（列表、条件渲染、canvas 海报、相册授权、4 Tab） | 同 U1 | **最大不确定项**：代码模板使用 `wx:` 指令（61 处）而非官方文档所示的 `tt:`（0 处）。V1.3.0 同期沿用 `wx:` 且已上线（B 级证据），推断兼容，但**未运行验证** | IDE 预览 + 真机走查全部 10 页 |
| **U3** | 图片 CDN 域名白名单 | 需登录抖音开放平台后台 | 若未配置，38 部电影海报在线上可能全部加载失败（列表出现空白图） | 后台核对 `downloadFile` 合法域名是否含 `mcu.yaokaixin.top` |
| **U4** | 真实包体积与平台上限 | 未执行平台构建 | 静态估算 0.27MB，风险低 | 上传时查看 IDE 实际包体 |
| **U5** | 后台产品名称/简介/类目现值 | 后台不可见 | 影响名称一致性核对 | 后台截图核对 |
| **U6** | 控制台实际报错 | 无运行时环境 | 无法确认运行时 warning/error | 真机 console |
| **U7** | `libVersion 3.0.0` 有效性 | 无 IDE | 可能导致编译失败 | IDE 加载基础库版本检查 |

---

## 11. 核验结论与下一步

### 11.1 结论

**B. 有条件提审。** 静态技术条件基本就绪，但提审前必须完成：

1. **M1**：处理 Tab2 图标被 `packOptions.ignore` 排除的配置冲突（10 分钟级修复，需产品/开发确认后执行）。
2. **U1+U2**：在抖音开发者工具完成编译、预览、真机走查（重点：列表渲染是否正常、canvas 海报能否生成保存、4 Tab 切换）。
3. **U3**：后台确认图片域名白名单。
4. **U5**：后台核对名称/简介/类目，并与应用内品牌名统一。
5. 产品侧裁决 **C1/C2/C3**（引流文案、海报影视文本、合规门禁口径）。

以上闭环后，可升级为 **A. 可以提审**；若 U2 发现 `wx:` 指令不被渲染引擎识别（列表/条件块不显示），则降级为 **C. 暂不可提审**。

### 11.2 本次未做的事

- 未修改任何代码/配置/数据；未删除或放宽任何有效检查。
- 未执行 `git commit` / `git push` / 上传 / 平台提审。
- 未修改微信小程序与 `shared` 数据。
- 未修改抖音平台后台任何信息。

---

## 附录 A：本次核验证据索引

| 证据 | 位置 |
|---|---|
| 自检脚本（36P/1F，L53 未剥注释） | [verify-v24.cjs](file:///d:/SEO/发挥余热/漫威电影宇宙导航/workspace/verify-v24.cjs#L53) |
| 节点页渲染层 | [movie.wxml](file:///d:/SEO/发挥余热/漫威电影宇宙导航/douyin/pages/movie/movie.wxml#L3) |
| 页面注册 / TabBar / 窗口配置 | [app.json](file:///d:/SEO/发挥余热/漫威电影宇宙导航/douyin/app.json) |
| 打包忽略规则（M1） | [project.config.json](file:///d:/SEO/发挥余热/漫威电影宇宙导航/douyin/project.config.json) |
| 图片 CDN 域名 | [visuals.js](file:///d:/SEO/发挥余热/漫威电影宇宙导航/douyin/data/visuals.js) |
| 分享海报绘制 | [share.js](file:///d:/SEO/发挥余热/漫威电影宇宙导航/douyin/pages/share/share.js) |
| 合规门禁（FAIL 2 处） | [check-visible-content.js](file:///d:/SEO/发挥余热/漫威电影宇宙导航/douyin/utils/check-visible-content.js) |
| 用户态与成就 | [userState.js](file:///d:/SEO/发挥余热/漫威电影宇宙导航/douyin/models/userState.js)、[achievements.js](file:///d:/SEO/发挥余热/漫威电影宇宙导航/douyin/models/achievements.js) |

| 实测数据 | 值 |
|---|---|
| 页面/四件套 | 10 / 10 完整 |
| TabBar | 4 项已注册；8 图标存在（81×81 PNG） |
| 悬空跳转 | 0 |
| 缺失资源 | 0 |
| 内容/关系/角色/路线 | 59 / 92 / 24 / 11，问题 0 |
| 引流特征命中 | 0 |
| web-view / 外链 / 剪贴板 / 网络请求 | 0 / 0 / 0 / 0 |
| JS 语法 / JSON 解析 | 35 通过 / 12 通过 |
| 打包体积（估算） | 全量 2.87MB → 实际约 0.27MB |
| 模板指令 | `wx:` 61 处，`tt:` 0 处（待 U2 验证） |
| CDN 探测 | `https://mcu.yaokaixin.top/assets/posters/iron-man.jpg` → 200, image/jpeg, 149,681B |

---

*本报告为提审前只读核验产物，不含任何代码改动。完成后停止，等待产品侧决定是否正式提交审核。*
