# MCU Atlas H5 线上现状审计与迭代建议报告

- **审计日期**：2026-11-09
- **审计对象**：https://mcuatlas.xyz/ （线上实际版本） + 本地 `d:/SEO/发挥余热/漫威电影宇宙导航/h5/`
- **执行方**：CodeBuddy（开发 AI，只读审计）
- **审查方**：ChatGPT
- **约束**：本次未修改任何代码／数据／配置／线上资源，未部署、未提交 Git、未触发审核或任何写操作。报告文件写入 artifact 区，不进入项目仓库。

---

## 结论摘要（先看这一段）

站点主体功能是真实存在且可用的：11 条观影路线、62 条内容资料库、作品详情三种「下一部」推荐、关系地图、复联5专题、56 条持续更新的资讯，浏览器渲染均正常，PC 与 390px 移动端布局无明显横向溢出。

**下一阶段最值得投入的只有 4 件事，且都不是重构：**

| 序号 | 事项 | 为什么现在做 |
|---|---|---|
| P0-1 | 把 3 部未上映作品从「已上映内容库」中剥离，统一中文片名 | 已产生可见错误：未上映电影可「标记已看」、上映顺序路线写「62 部 / 100% 全 MCU 覆盖」、下一部推荐同片两个状态冲突 |
| P0-2 | 补 `robots.txt` + `sitemap.xml` + 原始 HTML 中的静态 canonical | 三者当前全部缺失／404；全站正文只有渲染后文本的 1%–12% 能被不执行 JS 的抓取器读到 |
| P0-3 | 让核心页面在原始 HTML 中可读（轻量预渲染／静态正文快照，不换架构） | 首页、路线详情、作品详情、专题页的正文全部由 15 个同步 `<script>` 动态生成，GEO/搜索收录的主要瓶颈 |
| P0-4 | 线上与本地数据回同步，并固化单一发布通道 | 线上比本地多 2 部电影、1 部剧集、1 个角色、7 条资讯；`sync_data.sh` 明确说明 H5 数据不在同步范围内，漂移会重复发生 |

其余（社区、角色详情页、双地图、大规模重构）建议暂缓或收口，理由见第 8 节。

---

## 0. 审计方法与证据口径

| 手段 | 具体做法 | 用途 |
|---|---|---|
| 爬虫视角（原始 HTML） | `curl.exe -sS/-I` 抓取 14 个页面、`robots.txt`、`sitemap.xml`、全部 `data/*.js`、76 个图片资源；逐文件与本地做规范化 diff | 判断状态码、meta、canonical、H1、正文可读性、资源 404 |
| 浏览器实际渲染 | Chrome headless `--dump-dom`（10+ 页面） + Playwright 视口模拟 390×844 / 1440×900 + 截图 | 判断 JS 渲染后真实内容、运行时注入的 canonical/OG、移动端与 PC 布局 |
| 只读数据加载 | Node `vm` 载入 `h5/data/*.js`，统计条目与悬空 ID | 判断内容规模、引用完整性 |
| 线上/本地一致性 | 忽略 CRLF 差异后逐文件比对 | 判断审计依据是否代表当前线上 |
| 外部参考 | Marvel 官方页面检索（仅用于核对档期） | 避免自行编造官方信息 |

**关键基线（均为实测）**

- 服务器：`nginx`，首页 `Last-Modified: 2026-10-13`；`movies.js` `2026-10-20`；`news.js` `2026-11-06`。
- 线上内容量：62 部（40 电影 / 15 剧集 / 7 特别内容）、11 条路线、25 个角色、92 条关系、56 条资讯。
- 本地内容量：59 部、11 条路线、24 个角色、92 条关系、49 条资讯。
- 本地数据引用完整性：`MISSING_IDS []`（路线／专题／关系均无悬空作品 ID）。
- 所有 14 个 HTML 页面返回 200；静态内链全部 200；76 个海报/剧照资源全部 200。

> **不能下的结论**：本报告不认为「搜索引擎一定无法收录」。Google 具备 JS 渲染能力；但百度及多数 GEO/LLM 抓取器通常不执行 JS。我们只陈述可验证事实：**原始 HTML 几乎无正文、无 canonical、无结构化数据、无 robots/sitemap**，这会显著增加收录与引用的不确定性。`site:mcuatlas.xyz` 检索本次未返回本站结果，但该工具不支持精确的收录判定，记为**未验证**。

---

## 1. 当前线上功能和页面清单

| # | 页面 | URL | 实现方式 | 实测状态 |
|---|---|---|---|---|
| 1 | 首页 | `/`、`/index.html` | 静态骨架 + 15 个数据脚本 + 内联 JS | 200，渲染正常；两个 URL 内容完全相同 |
| 2 | 观影路线总览 | `/routes.html`、`/routes.html?r=<id>` | JS 渲染 + 动态 title/description/canonical | 200，11 条路线全部可展示 |
| 3 | 路线详情 | `/route-detail.html?id=<id>` | JS 渲染，动态 title/H1/description | 200，`newcomer` 实测 H1「新手入坑」、12 部 |
| 4 | 作品详情 | `/movie.html?id=<id>` | JS 渲染，动态 title/H1 | 200，`iron-man` 实测三种下一部推荐 + 4 条关系 + 相关角色 |
| 5 | 下一部推荐 | `/next.html` | JS 渲染，选择器 48 项 | 200，功能可用但含重复/冲突项（见 A3） |
| 6 | 关系探索（移动优先） | `/map.html` | 静态 + 内置「MCU 全景图」覆盖层 | 200，渲染 47 张图且全部带 alt |
| 7 | PC 关系大地图 | `/map-pc.html` | 80KB 单文件独立实现 | 200，但**站内无任何入口**，且与 #6 全景图重复 |
| 8 | 复联5补课专题 | `/special.html?id=avengers-doomsday`、`/special` | 独立专题数据 `special-routes.js` | 200，8 部核心 + 15 部完整 + 进度「已看 0/8」 |
| 9 | 资讯列表 | `/news.html` | JS 渲染 56 条 | 200，最新条目 2026-11-06 |
| 10 | 资讯详情 | `/news-detail.html?id=<id>` | JS 渲染 | 200，**原始 HTML 含 `noindex`** |
| 11 | 社区 | `/community.html` | 后端 `/api/*` + `forum.js` | 200，接口可用但话题库为空（`total: 0`） |
| 12 | 话题详情 | `/topic-detail.html?id=<id>` | 同上 | 200，无内容时显示「内容不存在」 |
| 13 | 我的社区 | `/my-community.html` | 同上 | 200，空态 |
| 14 | 发布话题 | `/post-create.html` | 同上，先审后发 | 200，身份设置页；**本次只读未提交** |
| — | 时间线 | 无独立页面 | 由 `routes.html?r=chrono` / `route-detail.html?id=chrono` 承担 | 功能存在，但不是独立「时间线页」 |
| — | 角色详情 | **不存在** | 仅 `h5/review/index.html` 原型图（线上 `/review/` 返回 404） | 未实现。`characters.js` 仅用于作品详情/关系页的「相关角色」 |
| — | 我的 MCU / 进度收藏 | 无独立页面 | 首页第 5 区块 + `localStorage` | 首页可展示进度；收藏仅数据层有 API，无 UI 调用 |
| — | 小程序入口 | 无独立页面 | 首页区块 + 全站页脚 + 里程碑卡 + 扫码弹层 | `qrcode.png` / `qrcode-douyin.png` 均 200 |

全局导航 `NAV`（`h5/assets/js/app.js:478`）只有 4 项：首页 / 下一部看什么 / 观影路线 / 宇宙地图。**资讯、社区、复联5专题、时间线、我的 MCU 均不在全局导航中**，只能从首页各区块进入。

---

## 2. 已完成且运行正常的功能

1. **内容数据层**：`movies/series/special/short` → `content.js` 统一合成，统一重算 `ro`（上映序）/ `co`（故事时间线序）；本地 59 条、线上 62 条，引用零悬空。
2. **11 条观影路线**：5 条基础 + 6 条专题，`routes.js` 的 `generator` 自动生成 release/chrono/mainline/essential 四条；`routes.html` 与 `route-detail.html` 均能按 `?r=` / `?id=` 正确渲染，动态 title 如「新手入坑 观影路线详情 · 12 部 - MCU 宇宙导航」。
3. **作品详情的续看链路**：`movie.html?id=iron-man` 实测含「只想看主线 / 想完整看懂 / 想按顺序全看」三种推荐、4 条带原因的关系、「相关角色」、关联作品链接、`next.html` 引导，是站内最完整的探索闭环。
4. **复联5专题**：Hero 日期 `2026.12.18` 与英文名取自 `MCU_UPCOMING`（`special-routes.js` 只存引用，不复制作品数据，新增专题复用成本低）；核心 8 部 / 完整 15 部默认折叠；进度显示「已看 0/8」。
5. **资讯模块**：`news.js` 为 H5 单一权威源（明确不复制到小程序端），线上 56 条，最新 2026-11-06；列表展示来源、独立来源数、状态标签；HTTP 头 `Cache-Control: no-cache, must-revalidate`，每日更新可及时生效。
6. **社区后端**：`/api/me` 返回 401 JSON、`/api/topics` 返回 `{"items":[],"total":0}` JSON，说明服务已部署、身份/话题/回复/点赞/举报接口在 `forum.js` 中完整接线；只是**当前内容为空**。
7. **动态 SEO 标签**：`MCU.ui.mount()` 在运行时注入 canonical 与 5 个 OG 标签（`app.js:1133`）；浏览器渲染后实测各页 canonical 均存在，`movie.html?iron-man` / `route-detail.html?newcomer` / `special.html?...` 正确保留 `?id=`。
8. **图片 alt 与资源**：渲染后首页 24/24、路线页 13/13、专题 14/14、关系页 47/47 均带 alt；76 个海报/剧照引用全部 200。
9. **响应式**：Playwright 390×844 实测 `innerWidth = scrollWidth = 390`，无横向溢出；首页导航自动折行、专题横幅日期完整可见；1440×900 布局正常。

---

## 3. 存在问题及对应证据

### A. 内容与数据（最高优先级）

| 编号 | 问题 | 证据 |
|---|---|---|
| A1 | **未上映作品被当成已上映内容**：`doomsday`(2026-12-18)、`secretwars`(2027-12-17) 于 2026-10-20 加入 `movies.js`，`visionquest`(2026-11-01) 加入 `series.js`，且 `mainline: true` / `importance: 'core'`。 | `https://mcuatlas.xyz/movie.html?id=doomsday` 渲染出完整详情页，含「**标记已看**」「上映第 61 部」「2026-12-18 北美上映」；`route-detail.html?id=release` 显示「**62 部作品 / 100% 全 MCU 覆盖**」；首页统计「62 部内容」 |
| A2 | **同一部电影中文名与状态双轨**：`upcoming.js` 用「复仇者联盟5：毁灭之日 / 复仇者联盟6：秘密战争」，`movies.js` 用「复仇者联盟：末日 / 复仇者联盟：秘密战争」，资讯用「复仇者联盟：末日」，专题用「复联5」。 | `h5/data/upcoming.js:35-53`；线上 `movies.js` P1-B 新增段；`news.html` 实测文本 |
| A3 | **下一部推荐出现 4 个冲突选项**：`next.html` 把 `MCU_MOVIES` 与 `MCU_UPCOMING` 直接拼接，前者的未上映片标「✅已上映」，后者标「🕐即将上映」且 `id` 被清空。 | 渲染实测：`<option value="doomsday">39. 复仇者联盟：末日（2026）✅已上映</option>` 与 `<option value="">41. 复仇者联盟5：毁灭之日（2026）🕐即将上映</option>` 并存（秘密战争同样重复）；`h5/next.html:82-97` 中 `m.id = ''` 注释写「不可作为刚看完的作品被选中」，但选项仍被渲染出来 |
| A4 | **来源元数据失真**：`content.js` 给所有内容统一注入 `source: Marvel 官方 Complete MCU Timeline（2026-06-02）` / `verified_at: 2026-06-02` / `confidence: high`，但 `source_url` 指向维基百科；2026-10-20 新增的未上映作品同样继承这套「已核验」标记。 | `h5/data/content.js:49-62` |
| A5 | **资讯元信息口径与事实不符**：线上 `news.js` 头部仍写 `stage: 'mock'`、`stage_label: '模拟数据（未接入真实抓取）'`、`built_at: 2026-09-22`，实际已有 56 条带真实来源 URL 的资讯（抽样 2 条迪士尼官方公告 URL 均返回 200）。`window.MCU_NEWS_META` 全站无引用，属死数据。 | 线上 `/data/news.js` 实测；全站搜索 `MCU_NEWS_META` 仅定义处 1 处 |
| A6 | **线上与本地数据漂移**：线上 62 部 / 56 条资讯，本地 59 部 / 49 条资讯；`index.html`、`special.html`、`special-routes.js` 仅有注释路径差异（`同步/` → `docs/同步/`）。 | 逐文件规范化 diff；`shared/sync_data.sh:7-8,28` 明确「H5 数据格式不同，不在此脚本范围内，需另行机械适配」，即 H5 数据必须手工同步 |
| A7 | **待复核的官方档期**：`upcoming.js` 标注「最近一次核对：2026-09-10」，含 `black-panther-3` `status:'dated'` 2028-12-15、`ghost-rider` 2028 `tba`，注释称来自 SDCC 2026。`series.js` 的 `visionquest` 写「直连《复仇者联盟：末日》」且 `episodes: '待官方公布'`。 | `h5/data/upcoming.js:29-73`；线上 `series.js` P1-B 新增段。**本次无法独立核验这些官方档期与剧情关联，标记为「项目内推断／待复核」，不判定为错误**。已独立核验：`Avengers: Doomsday` 2026-12-18 与 Marvel 官方页面一致 |
| A8 | **复联5专题生命周期靠手工删代码**：首页注释写明「影片上映后撤除：删除 section + head 的 CSS link + CSS 中 `.v2-topic-*` 块」。当前距 2026-12-18 约 5 周，尚无状态开关。 | `h5/index.html:51-55`、`h5/index.html:278-284` |

### B. SEO / GEO

| 编号 | 问题 | 证据 |
|---|---|---|
| B1 | `robots.txt`、`sitemap.xml` 均为 **404**（nginx 默认 404 页），全站无任何 URL 清单与抓取指引。 | `curl -I https://mcuatlas.xyz/robots.txt` → 404；`/sitemap.xml` → 404 |
| B2 | **原始 HTML 正文几乎为空**：各核心页正文由 JS 生成，不执行 JS 的抓取器只能读到 1%–12% 的文本。 | 实测「原始 HTML 可见文本 / 浏览器渲染后文本」：`index.html` 244/3300 = 7.4%；`routes.html` 92/2591 = 3.6%；`route-detail.html?id=newcomer` 17/1634 = **1.0%**；`movie.html?id=iron-man` 41/1636 = 2.5%；`special.html` 33/1333 = 2.5%；`news.html` 52/1909 = 2.7%；`next.html` 77/1372 = 5.6%；`map.html` 329/2698 = 12.2% |
| B3 | **无结构化数据**：全站原始 HTML 与渲染后 DOM 均无 `application/ld+json`（10 个核心页实测均为 0）。 | Chrome `--dump-dom` 逐页统计；`h5/` 全目录搜索 `ld+json` 无结果 |
| B4 | **canonical 只在运行时由 JS 注入，且重复 URL 自相冲突**；原始 HTML 无 canonical。 | 浏览器实测：`/` → canonical `https://mcuatlas.xyz/`；`/index.html` → canonical `https://mcuatlas.xyz/index.html`；`/special` → `.../special`；`/special.html?id=avengers-doomsday` → `.../special.html?id=avengers-doomsday`。四者两两内容相同却各自自指（`app.js:1133-1154` 用 `location.pathname` 拼接） |
| B5 | **资讯详情 56 页放弃收录且无爬虫可发现内链**：`news-detail.html` 原始 HTML 有 `noindex`；列表/首页卡片通过 `data-id` + JS `location.href` 跳转，不是 `<a href>`；canonical 又丢掉 `?id=`（`KEEP` 未含 `news-detail.html`），全部指向 `/news-detail.html`。 | `h5/news-detail.html:12`；`h5/news.html:124`、`h5/index.html:541`；渲染后 `news.html` 中 `news-detail.html` 仅 1 处（canonical 自身）；`app.js:1135-1142` |
| B6 | **社区族 4 页为可索引的薄页**：无 H1、无 canonical（未调用 `MCU.ui.mount()` 故无运行时注入）、无 `noindex`，title 为通用文案，正文 45–160 字。 | 浏览器实测 `community.html / topic-detail.html / my-community.html / post-create.html`：`nav=False`、`H1=''`、`canon=''`；原始 HTML `noindex=False`；`forum.js` 全文无 `mount(` 调用 |
| B7 | **重复内容双 URL**：`/` 与 `/index.html`；`/special` 与 `/special.html`；`routes.html?r=<id>` 与 `route-detail.html?id=<id>` 含相同路线描述（实测两页均含「砍掉了所有支线」）但 canonical 不同。 | curl 内容比对 + 渲染文本比对 |
| B8 | 次要：根 `/favicon.ico` 404（HTML 已声明 `assets/favicon.*`，影响有限）；`h5/_redirects` 是 Cloudflare Pages 配置，线上为 nginx 且该文件 404，属死配置；`data/movies.js` 缓存 `max-age=604800`，与 `news.js` 的 `no-cache` 策略不一致，内容改动可能 7 天后才对回访用户生效。 | `curl -I` 实测 |

### C. 用户体验与转化

| 编号 | 问题 | 证据 |
|---|---|---|
| C1 | **首页 9 个区块信息分散**，新用户两个主 CTA「规划路线」「查看时间线」都指向 `routes.html`（后者仅多 `?r=chrono`），而 `routes.html` 是 11 条路线的文字列表，没有引导式选择。 | `h5/index.html:35-45`、`h5/index.html:223-229`；`routes.html` 渲染文本「没有唯一正确答案，只有适不适合」 |
| C2 | **进度／收藏／下一部未形成完整闭环**：`watched`、`want_to_watch` 有 UI（`标记已看`、`关注`），但 `favorite/toggleFav/favIds` 全站只有 `app.js:311-319` 定义、无任何调用；`saved_routes`、`current_route` 亦未见页面入口；进度仅存 `localStorage['mcu_nav_user_v1']`。 | 全目录搜索 `toggleFav|favIds|isFav` 仅命中定义；`app.js:190-207` |
| C3 | **小程序入口承诺与实现不符**：文案写「进度、路线和收藏一起同步，换设备也能接着看」「记录已看作品、保存观影路线，换设备也能接着看」，但全站 `/api/` 仅社区接口，无进度同步；`app.js:1250-1255` 也注明带参跳转「当前仅预留，不跳转」。 | `app.js:729-730`、`app.js:1250-1255`、`h5/index.html:150-160`；全目录 `/api/` 搜索仅 `forum.js` 与首页话题预览 |
| C4 | **社区是死胡同**：后端在线但话题库为 0，首页仍保留「进入社区讨论」入口；4 个社区页没有全局导航、没有页脚，只能靠返回按钮。 | `/api/topics` → `total: 0`；`community.html` 渲染文本「这里还很安静…第一个发言的人就是你」；浏览器实测 4 页 `nav=False` |
| C5 | **PC 关系地图默认不可读且孤立**：`map-pc.html` 默认缩放 14%–28%，节点文字极小，需手动放大；同时全站无任何链接指向它，`map.html` 已自带「MCU 全景图」覆盖层，功能重复。 | 1440×900 截图；全仓库搜索 `map-pc.html` 只命中文档/回归脚本与 `map-pc.html` 自身，无 H5 页面链接 |
| C6 | 次要：`movie.html?id=iron-man` 渲染后 4 张图中 3 张带 alt（1 张缺）；`special.html:115` 有一处 `alt=""` 装饰图。 | Chrome DOM 统计 |

### D. 代码与维护成本

| 编号 | 问题 | 证据 |
|---|---|---|
| D1 | **数据四份副本**：`shared/data`（小程序权威源，11 个 js）、`wechat/data`（12 个）、`douyin/data`（11 个）、`h5/data`（15 个，格式不同）。`sync_data.sh` 只同步前三份，H5 需手工适配，已实际漂移（A6）。`wechat/data/special-routes.js` 存在而 `shared/data` 无同名文件，副本已不一致。 | 目录清单 + `shared/sync_data.sh:19-28` |
| D2 | **每页 14–17 个同步 `<script>`**，无 `defer/async`；首页 14 个数据脚本合计约 217KB（未压缩） + `app.js` 80KB + `components.js` 40KB。功能正常，但新增页面时易漏引脚本。 | `h5/index.html:169-184` 等各页脚本清单；`curl -w size_download` 汇总 |
| D3 | **海报渲染逻辑重复**：`app.js:1009/1029/1088` 与 `components.js:125/311` 各有一套 `<img>`/占位卡生成；`map-pc.html` 80KB 单文件独立实现一套地图。 | 代码搜索 `<img` |
| D4 | **值得肯定的低成本设计**：`special-routes.js` 只存 `workId` 引用、日期取自 `MCU_UPCOMING`，新增专题无需复制作品数据；`content.js` 统一派生 type/importance/ro/co。这部分**不建议重构**。 | `h5/data/special-routes.js:8-20`、`h5/data/content.js:31-90` |

---

## 4. 内容更新建议

1. **给内容加「发布状态」并据此过滤（P0）**：在 `movies/series` 增加 `status: released | upcoming`，或把 `doomsday/secretwars/visionquest` 移回 `upcoming.js`，在 `content.js` 合成时排除未上映项。影响面：首页统计、资料库、`release/chrono/mainline/essential` 四条生成路线、`next.html` 选项、进度总数、地图节点。修复后首页应回到「已上映 59–60 部」，未上映作品只在「漫威未来计划」出现。
2. **统一中文片名（P0）**：以一处为准（建议与 `news.js` 保持一致），`upcoming.js` 的 `title` 与 `movies.js` 的 `cn` 不再各自命名；专题标题「复联5补课路线」可保留为营销名，但正文中的影片名必须统一。
3. **修正来源标注（P1）**：`content.js` 的 `DEFAULT_SOURCE` 改成「资料整理来源」而非「Marvel 官方已核验」，或按条目填写真实 `source/verified_at`；至少让 2026-10-20 之后新增条目不继承 2026-06-02 的核验标记。
4. **更新资讯元信息（P1）**：把 `MCU_NEWS_META` 的 `stage` 从 `mock` 改为真实阶段、`built_at` 改为最近发布日；若该变量无用，直接删除以免误导维护者。
5. **档期与关联复核（P1，人工）**：`upcoming.js` 的 2028 年两部、`visionquest` 的「直连《末日》」属项目内推断，需由内容负责人对照官方来源复核；复核前在页面标注「整理推断，非官方指定」。`routes.js:44` 已对《永恒族》《死侍与金刚狼》时间线争议作了标注，这个做法应保留并推广。
6. **专题生命周期开关（P1）**：把首页横幅改为由 `MCU_UPCOMING['avengers-5'].date` 与当前日期比较决定是否渲染，上映后自动撤下，而不是手工删 HTML/CSS 块。
7. **关键作品/人物补充（P2，需权威来源）**：`news.html` 已出现《夜魔侠：重生》第三季、《VisionQuest》、《The Punisher》等条目，而 `series.js/special.js` 未覆盖；是否收录应由内容负责人按官方时间线确认后再补，本报告**不代填任何官方信息**。

---

## 5. SEO / GEO 问题及修复建议

| 优先级 | 修复动作 | 具体做法 |
|---|---|---|
| P0 | 补 `robots.txt` | 允许全站抓取；显式 `Disallow: /api/`；`Sitemap: https://mcuatlas.xyz/sitemap.xml`；对 `topic-detail/post-create/my-community/community` 先不写入 Disallow，改用页面级 `noindex` 更可控 |
| P0 | 补 `sitemap.xml` | 收录 `/`（唯一首页 URL）、`/routes.html`、11 条 `/route-detail.html?id=…`、62 条已上映 `/movie.html?id=…`（修复 A1 后应为 59–60 条）、`/special.html?id=avengers-doomsday`、`/news.html`、`/next.html`、`/map.html`；排除 noindex 页与 `map-pc.html` |
| P0 | canonical 写进原始 HTML | 每个模板页在 `<head>` 写死规范 URL（`movie.html`/`route-detail.html`/`special.html` 需按 `?id=` 生成静态映射或在构建时产出）；运行时 JS 注入保留但不再作为唯一来源；`/` 与 `/index.html`、`/special` 与 `/special.html` 二选一，另一 URL 301 到规范 URL |
| P0 | 让正文可在原始 HTML 读取 | **不要重写成 SSR 框架**。建议二选一：①部署前用现有无头浏览器跑一次预渲染，为 6 类模板落静态 HTML 片段；②在现有空容器里放一份与数据同步生成的静态文本 + 关键 `<a href>` 内链（`<noscript>` 亦可）。目标是让「11 条路线、62 部作品、8+15 专题片单」这些核心文本与内链出现在原始 HTML 中 |
| P1 | 结构化数据 | 首页/路线页 `ItemList` + `BreadcrumbList`；作品详情 `Movie`（name/datePublished/genre，仅已上映）；专题页 `ItemList`；无需 `FAQPage` 除非真有问答内容 |
| P1 | 资讯内链与索引策略 | 卡片改成真实 `<a href="news-detail.html?id=…">`；`injectSeoTags` 的 `KEEP` 增加 `news-detail.html: ['id']`；若决定让资讯详情参与收录，去掉 `noindex` 并补动态唯一 title（当前为通用「资讯详情 - MCU 宇宙导航」）；若坚持不收录，则保持 noindex 但至少让站内用户可正常点击 |
| P1 | 社区族页面收口 | 4 页补 H1、全局导航/页脚、静态 canonical 与 `noindex`（空库期间）；首页社区入口在话题数 > 0 前隐藏或改为「筹备中」 |
| P2 | 重复内容与缓存 | 统一 `routes.html?r=` 与 `route-detail.html?id=` 的 canonical 归属；`movies.js` 等数据文件的 7 天缓存改为与 `news.js` 一致的 `no-cache, must-revalidate` 或加版本号；补根 `/favicon.ico`；删除或注释说明 `h5/_redirects` 仅适用于 Cloudflare Pages 部署 |

> 提醒：`title` / `description` 整体质量其实不错，首页、路线、作品详情、专题均有唯一且贴合意图的动态文案（如「钢铁侠 - MCU 宇宙导航」）。**不需要重做文案体系**，问题在于它们依赖 JS 才能生效。

---

## 6. 用户体验问题及优化建议

| 优先级 | 建议 | 说明 |
|---|---|---|
| P1 | 首页给新用户一条默认路径 | 把「规划路线」直接指向 `route-detail.html?id=newcomer`，或加一个 3 问选择器（看过几部 / 想看主线还是全看 / 有多少时间），结果复用现有 11 条路线直接跳转，**不新增数据源、不新增页面** |
| P1 | 补齐「我的 MCU」闭环 | 让收藏按钮真正调用 `toggleFav`（或删掉这个未使用的能力）；在作品详情的「标记已看」后直接给「下一部」按钮并带上 `?from=<id>`；把「保存路线」入口落到 `saved_routes` |
| P1 | 修正小程序文案 | 在进度同步实现前，把「换设备也能接着看」「进度、路线和收藏一起同步」改为「扫码打开小程序继续探索」，或明确说明进度保存在本机浏览器。入口本身（首页区块 + 页脚 + 二维码）是清晰的，不需要再加新入口 |
| P1 | PC 关系地图二选一 | 要么在 `map.html` 宽屏时给出「打开 PC 大地图」入口并把默认缩放调到可读（≥60%），要么把 `map-pc.html` 301 到 `map.html` 并停止维护第二套地图。当前「无入口 + 默认 14%」是最差组合 |
| P2 | 社区内容决策 | 空库期间从首页入口移除，或投放 3–5 条由编辑撰写的种子话题；不要为了填页面造虚构互动数据（`community.js` 已明确禁止，纪律正确） |
| P2 | 移动端细节 | 补 `movie.html` 那 1 张缺 alt 的图；`next.html` 48 项选择器建议改为可搜索/按阶段分组，减少长列表滚动 |

**已验证没有明显问题的部分**：390px 下导航折行正常、专题横幅日期与英文名完整、路线卡片横向滚动可用、无横向溢出；1440px 下主体内容居中、导航与页脚完整。此项基于 Playwright 视口模拟与截图，**真机手势/微信内置浏览器未验证**。

---

## 7. 值得新增的功能及其实际价值

按「投入产出」排序，只列 3 项：

1. **部署期静态正文快照（预渲染）** — 价值：把当前 1%–12% 的可抓取正文提升到接近 100%，直接改善搜索/GEO 对「漫威观看顺序」「复联5补课」这类核心查询的命中；同时保留现有 JS 交互，用户无感。复用已有 `content.js` 数据即可，不是重构。
2. **新用户路线速选（3 问）** — 价值：首页 9 个区块 + 11 条纯文字路线，对新用户决策成本偏高；速选把「找路线」这一步从「读 11 段说明」变成「答 3 个问题」，复用现有路线数据，预计能提升 `route-detail` 到达率。成本低、可 A/B 回退。
3. **内容状态字段 + 专题生命周期开关** — 价值：一次投入同时解决 A1/A2/A3/A8 和未来的同类问题（下一部新片上映时不必再手工改代码），也是新增专题能继续复用现有数据的前提。

---

## 8. 不建议投入的功能

| 不建议项 | 理由 |
|---|---|
| 社区扩建（审核后台、积分、通知、富文本） | 后端已完整但 `total: 0`，瓶颈是内容与流量，不是功能；继续加功能只会放大维护成本。先做种子内容或直接收口入口 |
| 独立「角色详情页」 | 目前仅原型图；25 个角色且 `chars` 大量为空、`relations.js` 是作品间关系，做出来会是大量空页/薄页，反而制造 SEO 负担 |
| 维护第二套 PC 地图 | `map.html` 已有全景覆盖层，`map-pc.html` 80KB 且无站内入口，重复投入无收益 |
| 大规模框架重构 / 把 `.js` 数据改成 `fetch JSON` | 现有「双击 index.html 即可运行」的设计约束在各数据文件注释中写得很清楚；`sync_data.sh` 也依赖 H5 与小程序格式不同。重构收益远低于 P0 三项 |
| 扩充资讯抓取量／自动化 | 已有 56 条且每日更新到 2026-11-06；当前瓶颈是收录与内链，不是产量 |
| 三端数据「大一统」 | 只需明确 H5 的发布通道并回同步一次（P0-4），不必合并四份副本 |
| 小程序扫码带参同步进度 | 需要服务端身份体系；在 H5→小程序转化数据未验证前，投入产出不成立。先修文案 |

---

## 9. 按 P0 / P1 / P2 排序的迭代清单

### P0（下一阶段只做这 4 项）

| ID | 事项 | 关联问题 |
|---|---|---|
| P0-1 | 未上映作品从已上映内容库剥离 + 统一中文片名 + 修复 `next.html` 重复选项 | A1 A2 A3 |
| P0-2 | 补 `robots.txt`、`sitemap.xml`、原始 HTML 静态 canonical，并解决 `/` vs `/index.html`、`/special` vs `/special.html` 重复 URL | B1 B4 B7 |
| P0-3 | 核心模板页静态正文快照（预渲染或静态文本+内链），让 11 条路线/作品库/专题片单在原始 HTML 可读 | B2 B5(内链部分) |
| P0-4 | 线上数据回同步本地，明确 H5 数据发布通道与回归基线 | A6 D1 |

### P1

| ID | 事项 | 关联问题 |
|---|---|---|
| P1-1 | 首页新用户默认路线 / 3 问速选 | C1 |
| P1-2 | 资讯详情改 `<a href>` 内链 + 修 `?id=` canonical + 决定 noindex 策略 | B5 |
| P1-3 | 社区族 4 页补 H1/导航/canonical/noindex，或空库期间隐藏首页入口 | B6 C4 |
| P1-4 | `map-pc.html` 收口（加入口并调默认缩放，或 301 到 `map.html`） | C5 |
| P1-5 | 补 `ItemList` / `BreadcrumbList` / `Movie` 结构化数据 | B3 |
| P1-6 | 修正来源元数据、`MCU_NEWS_META` 口径；人工复核 2028 年档期与「直连《末日》」关联 | A4 A5 A7 |
| P1-7 | 收藏接 UI 或删除；进度→下一部按钮串起来；小程序文案改为与实现一致 | C2 C3 |
| P1-8 | 专题横幅改为按日期自动上下线 | A8 |

### P2

| ID | 事项 |
|---|---|
| P2-1 | `movies.js` 等数据文件缓存策略与 `news.js` 对齐；补根 `favicon.ico` |
| P2-2 | 统一 `routes.html?r=` 与 `route-detail.html?id=` 的 canonical 归属 |
| P2-3 | 清理/说明 `h5/_redirects`（Cloudflare 配置，线上 nginx 不适用） |
| P2-4 | 合并 `app.js` 与 `components.js` 中重复的海报渲染片段（仅小范围抽取，不做架构改造） |
| P2-5 | 补 1 张缺失 alt；`next.html` 长选择器改为可搜索/分组 |
| P2-6 | 关键作品/人物补录（须先有权威来源，本报告不代填） |

---

## 10. 每项建议的工作量、收益和风险

> 工作量按 1 人日（1d）估算，含自测；「收益」指对收录、内容可信度、转化或维护成本的实际影响。

| ID | 工作量 | 收益 | 风险 | 风险缓解 |
|---|---|---|---|---|
| P0-1 | 1–1.5d | **高**：消除「未上映可标记已看 / 62 部 / 同片双状态」等可见错误，恢复内容可信度 | 中：`content.js` 的 `ro/co` 会重算，影响路线顺序、进度总数、地图节点与既有 localStorage 进度 | 先加 `status` 字段并只在 `filtered/expandRoute/progress.total` 处过滤；对 11 条路线 + 4 个核心页做回归；不动 id 命名空间 |
| P0-2 | 0.5–1d | **高**：补齐抓取指引与 URL 发现，消除首页/专题重复 URL 自指 | 低-中：canonical 选错会造成短期收录波动 | 统一以 `/` 为首页、`/special.html?id=…` 为专题；对另一形式做 301；sitemap 只列 200 的规范 URL |
| P0-3 | 2–3d | **高**：核心正文与内链从 1%–12% 提升到可被不执行 JS 的抓取器读取，是 GEO/收录的主要杠杆 | 中：预渲染产物与 JS 数据可能不同步，出现「快照说 59 部、页面说 62 部」 | 把预渲染接入现有发布流程；用 P0-4 的回同步数据做唯一输入；上线后比对快照与渲染 DOM 文本 |
| P0-4 | 0.5d | 中-高：审计/回归依据统一，避免继续漂移 | 低：仅数据文件与文档口径 | 只同步本次已确认差异的 5 个文件；不改代码逻辑；不卷入其他在途改动 |
| P1-1 | 1d | 中：降低新用户决策成本 | 低：纯前端，可开关回退 | 结果只映射现有 11 条路线 |
| P1-2 | 0.5–1d | 中：长尾资讯可被发现；若放开 noindex 可增加可收录页数 | 中：放开 noindex 会让 56 个薄页进入索引 | 先修内链与 canonical，观察 2–4 周再决定是否放开 noindex |
| P1-3 | 0.5d | 中：消除 4 个薄页与社区死胡同 | 低 | 优先加 `noindex` 与 H1，不改动社区 API |
| P1-4 | 0.5–1d | 中：消除孤立页与重复地图维护 | 低-中：若 301 需确认外宣物料中的旧链接 | `docs/外宣物料/` 中确有 `map-pc.html` 引用，先核对再决定保留或跳转 |
| P1-5 | 1d | 中：增强搜索结果呈现与 GEO 引用 | 低：结构化数据不影响交互 | 只标注已核实字段，未上映作品不加 `Movie` |
| P1-6 | 0.5–1d（含人工复核） | 中：来源标注可信、口径一致 | 低 | 争议项标注「整理推断/待复核」，不写死官方结论 |
| P1-7 | 1d | 中：闭环完整、文案不再误导 | 低 | 不改 localStorage 键名，避免老用户进度丢失 |
| P1-8 | 0.5d | 中：避免上映后忘记撤专题 | 低 | 日期仍取 `MCU_UPCOMING`，不硬编码 |
| P2-1~P2-6 | 各 0.5d 以内 | 低-中：维护性改善 | 低 | 逐项独立上线 |

---

## 附录 A：未验证项（不得当作已确认结论）

1. 搜索引擎实际收录、排名、百度/Google 抓取时的 JS 渲染行为；`site:` 检索结果不作为判定依据。
2. 真机移动端手势、微信/抖音内置浏览器、小程序码实际扫码打开结果。
3. 社区发帖、审核、点赞、举报等写操作（本次只读，未触发任何写接口）。
4. 资讯 56 条来源的逐条真实性；仅抽样 6 个 URL，其中 2 条迪士尼「官方确认」URL 返回 200，其余为通用媒体首页/RSS，`x.com` 超时。
5. 运营埋点（`MCU.stats`）是否成功上报；`/api/stats` GET 返回 404（可能为 POST-only），本次未探测写接口。
6. `upcoming.js` 中 2028 年两部作品的官方档期、`visionquest` 与《末日》的剧情关联——项目内注释称来自 SDCC 2026 / P1-B 新增，本次无法独立核验。
7. 小程序端进度是否与 H5 互通：从代码看无同步接口，但未做小程序端实测。
8. PC 大地图在更高分辨率/不同缩放档位下的可读性（仅测了 1440×900 默认视图）。

## 附录 B：争议与需人工确认的内容

- `h5/data/routes.js:44` 已主动标注《永恒族》《死侍与金刚狼》时间线定位存在影迷争议——**做法正确，建议保留**。
- `special-routes.js:65` 已标注「MCU Atlas 整理路线，非官方指定片单」——**做法正确，建议保留**。
- 需新增标注：`visionquest` 的「直连《复仇者联盟：末日》」、`upcoming.js` 的 2028 年档期，均属项目内整理/推断，不应以官方口径呈现。
- 中文片名不统一属于**项目内部口径问题**，不涉及官方事实；Marvel 官方页面仅用于确认 `Avengers: Doomsday` 上映日 2026-12-18，本报告未引入其他官方设定。

---

**审计结束。** 本次未修改任何代码、数据、配置或线上资源，未部署、未提交 Git。
