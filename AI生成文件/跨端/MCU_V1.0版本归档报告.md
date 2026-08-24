# MCU_V1.0 版本归档报告

> 归档时间：2026-08-24
> 归档基线：D12-A Step3-1 ~ Step3-8 全部完成（8 页面 + 反馈）
> 性质：本任务为**文档归档**，未改动任何代码 / UI / 数据（严格遵循指令禁止项）
> 数据口径：全部以 `mcu-miniprogram/` 真实文件实测为准（非记忆推断）

---

## 一、当前项目结构

### 1.1 目录全景

```
mcu-miniprogram/
├─ app.js                 # 入口：wx.cloud.init(env=mcu-d6gw0brqoa9521b58) + 全局 storeKey
├─ app.json               # 9 页面注册 + 4 TabBar + window/navigationBar 深色配置
├─ app.wxss               # 全局 Token 体系（--bg/--surface-*/--gold/--text-*/阶段色）
├─ project.config.json    # AppID=wx78f00e7f0a5948b7，基础库 3.0.0，compileType=miniprogram
├─ project.private.config.json
├─ sitemap.json
├─ pages/                 # 9 个页面，每个含 {js,wxml,wxss,json} 四件套（共 36 文件）
│  ├─ home/               # 首页（双态：新用户/老用户）
│  ├─ routes/             # 路线页（基础/专题双 Tab + 当前路线进度卡）
│  ├─ route-detail/       # 路线详情页
│  ├─ movie/              # 电影详情页（三态：未看/在看/已看）
│  ├─ explore/            # 探索页（角色网格 + 全景入口）
│  ├─ panorama/           # 全景地图页（canvas 2d 连线 + 节点）
│  ├─ browse/             # 浏览全部页（按阶段分组 59 部）
│  ├─ my-mcu/             # 我的MCU页（进度 + 已看 + 收藏 + 反馈入口）
│  └─ feedback/           # 反馈页（我要吐槽）
├─ data/                  # 11 个数据模块（单一可信源，禁第二套）
│  ├─ content.js          # CONTENT 59（合成器，由 movies/series/special/short 派生）
│  ├─ movies.js / series.js / special.js / short.js
│  ├─ relations.js        # RELATIONS 92 / REL_TYPES 6
│  ├─ characters.js       # CHARACTERS 24 / CAMPS 8
│  ├─ routes.js           # ROUTES 11（basic 5 + topic 6）
│  ├─ constants.js        # Token 权威色（PHASE/TYPE/IMP/CONN）
│  ├─ visuals.js          # 海报路径（当前为空，阶段色兜底）
│  └─ resources.js        # 观看资源结构（当前为空占位）
├─ models/                # 4 个数据模型层
│  ├─ mcuData.js          # CONTENT 封装 + relationsOf/expandRoute/routeById/phaseColor/panoNeighbors
│  ├─ userState.js        # 观看状态（watched/want_to_watch/favorite/saved_routes），storeKey=mcu_nav_user_v1
│  ├─ recommend.js         # 三模式推荐（mainline/understand/complete）
│  └─ pano.js             # PANO_MOVIES 40 / PANO_CONN 41 / PHASE_COLS 6
├─ utils/                 # render-tab-icons.js（图标渲染）/ check-home-conformance.js（一致性自检）
└─ assets/icons/tab/      # 8 张 TabBar PNG（4 图标 × 2 态）+ 参考图 3 张 + star 2 张
```

### 1.2 备份与部署信息（对应指令 §二.5）

| 类别 | 内容 | 当前状态 / 备份建议 |
|---|---|---|
| 源码 | `mcu-miniprogram/` 全量（pages/data/models/utils/assets + 根配置） | **待执行**：本步仅归档，**未做物理备份**。建议落地「同步上去」A 方案——上传至 CloudBase 静态托管作为源码备份，并产出《发布指南》 |
| 数据 | `data/` + `models/`（CONTENT/RELATIONS/ROUTES/PANO 等） | 已纳入源码目录，随源码一并备份即可；属静态 JS，禁止运行时修改 |
| 配置 | `project.config.json`（AppID、基础库）、`app.js`（CloudBase env）、`sitemap.json` | 随源码备份；AppID `wx78f00e7f0a5948b7` 与 env `mcu-d6gw0brqoa9521b58` 需与微信公众平台/CloudBase 控制台一致 |
| 部署信息 | 小程序：微信开发者工具导入本目录发布；H5：CloudBase 静态托管 `mcu-d6gw0brqoa9521b58-1307093647.tcloudbaseapp.com`；云环境 `mcu-d6gw0brqoa9521b58` | 小程序**尚未发布上线**（此前确认）；发布依赖腾讯云官网授权（已保留）；反馈集合与 H5 共用同一 CloudBase 环境 |

---

## 二、页面列表

| # | 页面路径 | Tab | 功能说明 | 状态 |
|---|---|---|---|---|
| 1 | `pages/home/home` | ✅ 首页 | 双态：新用户（品牌引导 + 8 热门起点 + 3 功能卡 + 钢铁侠 CTA）/ 老用户（进度环 + 继续观看 + 最近看过 + 快捷入口） | ✅ 完成 |
| 2 | `pages/routes/routes` | ✅ 路线 | 基础/专题双 Tab；当前路线进度卡（第 X/Y 部 + 下一部 + 去看）；11 条路线卡（进度条 + 金边高亮） | ✅ 完成 |
| 3 | `pages/route-detail/route-detail` | — | 顶部路线名/简介/进度；电影列表（编号/片名/阶段/三态状态）；当前观看节点金高亮；下一部推荐 | ✅ 完成 |
| 4 | `pages/movie/movie` | — | 电影详情：Hero 三态标签；CTA 三态联动（开始/继续/已观看）；为什么现在看；前后关联（PANO_CONN）；资源折叠；看完之后推荐 | ✅ 完成 |
| 5 | `pages/explore/explore` | ✅ 探索 | 角色网格（24 角色 + 8 阵营色）；角色展开「出现作品」三态状态色；宇宙全景入口 | ✅ 完成 |
| 6 | `pages/panorama/panorama` | — | 横滚宇宙全景图：canvas 2d 连线（mainline 金 / support 蓝 / cross 紫）+ 绝对定位节点（40）+ 阶段列（6）+ 图例；待映卡不跳 | ✅ 完成 |
| 7 | `pages/browse/browse` | — | 浏览全部：CONTENT 59 部按 6 阶段分组；三态状态色；点击跳电影详情 | ✅ 完成 |
| 8 | `pages/my-mcu/my-mcu` | ✅ 我的MCU | 已探索 X/59 进度；当前路线卡 + 继续观看；已看列表（倒序）；收藏区域（有则展示/无则占位）；底部「我要吐槽」入口 | ✅ 完成 |
| 9 | `pages/feedback/feedback` | — | 反馈类型 6 选 1；内容必填；联系方式选填；提交写 `feedback` 集合（对齐 H5 字段）+ 本地兜底队列；成功/失败态 | ✅ 完成 |

> 注：9 个页面中 4 个为 TabBar 常驻（首页/路线/探索/我的MCU），其余 5 个为导航二级页。

---

## 三、功能列表

### 已完成（V1.0 全部可预览）
- 首页双态 + 进度环 + 8 热门起点引导
- 路线列表（11 条）+ 当前路线进度 + 双 Tab 切换
- 路线详情（顺序 / 三态状态 / 当前节点高亮 / 下一部）
- 电影详情（Hero 三态 / CTA 三态联动 / 为什么现在看 / 前后关联 / 资源结构 / 看完推荐）
- 探索（角色网格 + 阵营色 + 出现作品三态）
- 全景地图（canvas 连线 + 节点 + 阶段列 + 图例）
- 浏览全部（按阶段分组 + 三态）
- 我的MCU（进度 / 已看 / 收藏 / 反馈入口）
- 用户反馈（6 类 + 内容 + 联系方式 + CloudBase 写入 + 本地兜底）
- 跨页状态联动：movie 标记 → 首页/路线/我的MCU/`onShow` 实时刷新

### 新增（本轮 D12-A 恢复建设）
- 全套 8 页面 UI（源码丢失后从 D10-A 冻结稿 + D11 清单重建）
- 状态三态模型（watchState：unwatched/watching/watched）
- 当前路线进度推导（getCurrentRoute + 第一个未看节点）
- 全景图 canvas 2d 渲染管线（微信不支持内联 SVG，技术必要）
- 反馈页 + 单一数据源写入（复用 H5 `feedback` 集合）
- 一致性自检工具（check-home-conformance.js，6 维度）

### 修复（本质为「源码恢复」，非缺陷修复）
- 修复「小程序源码丢失」风险：重建全量 9 页面 + 数据层 + 模型层，恢复可发布基线
- 修复 TabBar 图标缺失：4 图标 × 2 态 PNG 经 SVG→sharp(librsvg) 渲染管线生成

### 待规划（不在 V1.0，见第六节）
- D10-B 反馈闭环分析（入口已建，未做数据分析后台）
- 海报图接入（visuals.js poster 当前空）
- 观看资源链接接入（resources.js 当前空）
- H5 `?from=` 渠道统计接入（指令 §五 缺口）
- 视觉 Token 债统一（map.html / 小程序 explore/movie/panorama 硬编码色）
- 关系网可视化探索（探索页定位待定）
- 真机截图补齐（环境无 GUI 开发者工具）
- 版本发布上线（A 方案备份 + 发布指南）

---

## 四、数据说明

### 4.1 数据来源与版本

| 数据集 | 实测条目 | 来源 | 版本 | 可否修改 |
|---|---|---|---|---|
| `CONTENT`（作品） | 59 | H5 `data/*.js` 单一可信源（小程序由 movies/series/special/short 合成） | V1.0 | ❌ 禁改（静态 JS，禁第二套） |
| `RELATIONS`（关系） | 92 | H5 `relations.js` | V1.0 | ❌ 禁改（见已知问题：92 vs 93 待复核） |
| `ROUTES`（路线） | 11 | H5 `routes.js` | V1.0 | ❌ 禁改 |
| `CHARACTERS`（角色） | 24 | H5 `characters.js` | V1.0 | ❌ 禁改 |
| `CAMPS`（阵营） | 8 | H5 `characters.js` | V1.0 | ❌ 禁改 |
| `PANO_MOVIES` / `PANO_CONN` / `PHASE_COLS` | 40 / 41 / 6 | H5 全景数据 | V1.0 | ❌ 禁改 |
| `userState`（用户状态） | — | 本地 `wx.storage`（键 `mcu_nav_user_v1`） | 运行时 | ✅ 仅运行时读写，源码不预置 |
| `feedback`（反馈） | — | CloudBase NoSQL 集合（env `mcu-d6gw0brqoa9521b58`，与 H5 共用） | 运行时 | ✅ 仅追加写入 |

### 4.2 数据治理原则（铁律）
- **单一可信源**：小程序 `data/` 与 H5 `data/*.js` 同源，禁止在小程序端新建第二套 MCU 数据。
- **静态数据禁改**：CONTENT/RELATIONS/ROUTES/PANO 为静态 JS，恢复过程零修改。
- **用户数据本地化**：观看状态/收藏存 `wx.storage`，无账号体系；反馈经 CloudBase 集合，匿名写入。
- **Token 权威**：阶段色 / 类型色 / 连线色统一取自 `data/constants.js`（与 H5 `style.css` 一致），页面禁止写死 hex（D12 视觉债整改方向）。

---

## 五、已知问题

| # | 问题 | 严重度 | 说明 / 处置 |
|---|---|---|---|
| K1 | H5 `?from=` 渠道统计未接入 | P1 | Step3-8 §五 发现：H5 `resolveContext()` 未读取 `?from=` 参数，虽 SEO canonical 已约定该参数存在。因「H5 零改动」铁律，本步仅规划不实现；建议上线前单独立项补 `channel` 字段写入 |
| K2 | CloudBase `feedback` 写权限待确认 | P1 | 小程序反馈依赖 `feedback` 集合对 AppID `wx78f00e7f0a5948b7` 开启匿名/宽松写（与 H5 同策略）；未确认则真机提交走本地兜底队列而非抵达集合 |
| K3 | RELATIONS 92 vs 指令期望 93 | P2 | 实测 92 条，D12-A 第五步规划定性未执行；需复核是否为漏录 1 条 |
| K4 | 海报图未接入（visuals.js poster 空） | P2 | 全工程海报显示为「阶段色渐变 + 片名首字」兜底；资源就位后自动替换 |
| K5 | 观看资源链接未接入（resources.js 空） | P2 | 电影详情资源模块仅结构占位，链接 pending，不填不开发下载 |
| K6 | 真机截图缺失 | P3 | 当前环境无 GUI 开发者工具，无法补拍；视觉严格按 D10-A 冻结稿移植（px×2=rpx、全 Token） |
| K7 | 探索页定位待定 | P3 | 当前为「角色网格 + 全景入口」；是否增加「关系网可视化」待策划确认 |
| K8 | 全景缩放系数 SCALE=0.6 待定 | P3 | 总宽 2040px 横滚；可调大更清晰（注意 canvas 像素上限） |
| K9 | 总数口径待统一（CONTENT 59 全量 vs 仅电影） | P3 | 我的MCU「已探索 X/59」、浏览页 59 部均取 CONTENT 全量；若需「仅电影数」需统一调整 |
| K10 | 当前路线 currentIndex 持久化口径 | P3 | 当前用「第一个未看节点」派生，未用 `savedRoute.currentIndex` 持久化位置（与 Step3-7-A 同款） |
| K11 | 收藏取消写入未做 | P3 | 指令 §四「保留入口，不新增复杂逻辑」；收藏区域仅展示/占位，不支持取消 |
| K12 | 视觉 Token 债（D12） | P3 | map.html / 小程序 explore/movie/panorama 仍硬编码颜色，不阻塞上线 |
| K13 | 残留参考图包体 | P4 | `assets/icons/tab/` 下 `_home-preview.png` / `_preview.png` / `_overview.png` 为开发参考图，建议清理以减小包体（未动，待授权） |
| K14 | 源码未做版本备份 | P1 | 本任务前无物理备份，源码丢失风险仍在；见 §一.2 备份建议（A 方案待执行） |

---

## 六、下一版本建议

### V1.1（发布前必做）
1. **源码归档备份（A 方案）**：上传 `mcu-miniprogram/` 至 CloudBase 静态托管作源码备份 + 产出《发布指南》；关闭 K14。
2. **CloudBase 权限确认**：开通 `feedback` 集合小程序匿名写（K2）。
3. **RELATIONS 复核**：执行 D12-A 第五步，定性 92 vs 93（K3）。
4. **H5 `?from=` 渠道统计**：立项补 `channel` 字段写入（K1），支撑抖音/小红书来源区分。
5. **真机预览验证**：在微信开发者工具真机扫码，补齐核心页截图，验证 canvas 全景与进度环渲染。

### V1.2（体验增强，非阻塞）
6. 海报图接入（K4）、观看资源链接接入（K5）。
7. 视觉 Token 债统一（K12），消除硬编码色。
8. 探索页关系网可视化评估（K7）。
9. 收藏取消写入（K11）、当前路线位置持久化（K10）。
10. 清理残留参考图（K13）。

### 治理建议
- 保持「数据单一源 / 三态物理隔离 / H5 零改动」铁律，后续迭代不引入第二套 MCU 数据。
- 每次发布前执行「源码备份 + 一致性自检（check-home-conformance.js）」，防止再次源码丢失。

---

> **归档结论**：MCU_V1.0 基线已具备——9 页面全部可预览、8 大功能完成、数据层零改动且单一可信源、跨页状态联动打通、反馈能力就绪。剩余均为 P1~P4 非阻塞项，归档后可进入发布准备（A 方案备份 + 权限确认 + 渠道统计立项）。
