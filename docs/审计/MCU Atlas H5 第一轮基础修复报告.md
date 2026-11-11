# MCU Atlas H5 第一轮基础修复报告

- **执行方**：CodeBuddy
- **依据**：《MCU Atlas H5 线上现状审计与迭代建议报告》（`docs/审计/`）
- **日期**：2026-11-09
- **审查方**：ChatGPT（本轮完成后交其独立审查）
- **本轮边界**：**只完成本地修复与验收**。未部署、未推送 Git、未修改任何线上资源、未改服务器 Nginx 配置、未触发审核或任何写接口。

---

## 0. 执行口径与保护边界

| 检查项 | 实测结果 |
|---|---|
| 全仓 Git 状态 | 232 项他人未提交改动（`D=97 / M=14 / ??=121`），**全程未触碰** |
| `h5/` 目录 Git 状态 | 修复前**完全干净**（`git status --porcelain -- h5/` 无输出），可安全修改 |
| `docs/审计/` | 上一轮报告所在的未跟踪目录，本轮仅在其中新增文档，未覆盖 |
| HEAD | `519a820 chore: GenUI 小工具视觉基线更新与外宣物料补充`（未提交、未推送） |
| 线上操作 | 仅 `curl` / `fetch` 只读 GET；未 POST、未删除、未写服务器文件 |
| 本地测试服务器 | `http://127.0.0.1:8765` 临时静态服务器，测试结束后已停止并清理 |

**修复前线上/本地差异（逐文件规范化比对，共 7 个文件）**

| 文件 | 线上 | 本地 | 差异性质 |
|---|---|---|---|
| `index.html` | 25726 | 25716 | 注释路径 `docs/同步/` vs `同步/` |
| `special.html` | 17350 | 17345 | 同上 |
| `data/special-routes.js` | 6061 | 6056 | 同上 |
| `data/movies.js` | 33392 | 32280 | 线上多 `doomsday` / `secretwars` |
| `data/series.js` | 8149 | 7551 | 线上多 `visionquest` |
| `data/characters.js` | 7433 | 7177 | 线上多 `ultron` |
| `data/news.js` | 110060 | 99147 | 线上多 5 条资讯（数组 49 → 54） |

> **数字更正**：上一轮审计报告写「线上 56 条资讯」，是按 `id: 'news-…'` 字面量正则统计的结果；本轮用 `vm` 实际载入后确认 `MCU_NEWS.length = 54`（56 处字面量中有 2 处重复 id，非独立条目）。线上与本地现均为 **54 条**，以数组长度为准。

---

## 1. 已完成

### 1.1 作品发布状态纠错

| 动作 | 落地位置 |
|---|---|
| 建立 `releaseStatus: released \| upcoming` 状态字段 | `h5/data/movies.js`、`h5/data/series.js` 显式标注 3 条；`h5/data/content.js` 为缺省条目注入 `released` |
| 双集合合成：`MCU_CONTENT`（**仅 59 部已上映**）与 `MCU_CONTENT_ALL`（62 部，含未上映） | `h5/data/content.js`；未上映条目的 `ro/co` 置空，且不再继承「Marvel 官方已核验」来源口径（改为 `confidence: pending_review`） |
| 3 部作品归入未上映，ID 全部保留 | `doomsday` / `secretwars` / `visionquest`；`app.js` 的 `byId` 改基于 `MCU_CONTENT_ALL`，详情与关系引用不中断 |
| 首页数量、上映顺序、路线、资料库、地图、进度统计自动跟随 | 全部基于 `MCU_CONTENT`，实测首页「59 部内容 / 11 条路线」、上映顺序「59 部作品」 |
| 未上映作品详情页 | `h5/movie.html` 新增独立精简视图：显示片名/英文名/计划上映日期，明确「尚未上映，暂不纳入观影路线…」；**不渲染**「标记已看」「下一部推荐」「上映第 N 部」「在小程序标记已看」 |
| 下一部推荐去重 | `h5/next.html`：已上映电影 38 部 + 未来计划中未关联详情的 2 部（黑豹3 / 恶灵骑士）= 40 项；未上映预置条目不进入选择器，`upcoming.js` 通过 `contentId` 与作品详情关联以去重；未来计划选项标记 `disabled`「暂不可选」 |
| 下一部推荐附带修复 | 「最新已上映」不再把 2027 年的 `secretwars` 当最新；修正 `_up` 排序把 `a.date` 与自身比较的失效 bug |
| 观影进度 | `app.js` 新增 `data.isUpcoming()`；`progress.count()` / `seenIds()` 过滤未上映 id，**但 localStorage 原始记录一字不删**（作品上映后改 `releaseStatus` 即自动重新计入） |
| 中文片名统一 | 以线上 `movies.js` 与近期资讯用的「复仇者联盟：末日」「复仇者联盟：秘密战争」为准；同步改 `upcoming.js` 的 `title`、`special-routes.js` tagline、`routes.js`、`relations.js`、`map.html` / `map-pc.html` 全景卡。「复联5补课路线」保留为**专题名**（非作品名） |
| 专题序号兼容 | `upcoming.js` 新增 `seriesNo`（视觉序号，非官方片名），`special.html` 优先取该字段、旧数据回退正则，终点圆点仍显示「5」 |
| 保留引用 | `upcoming.js` 的 `avengers-5/6` 通过 `contentId` 指向未上映作品；专题 `upcomingId`、关系表、`MCU.data.get()` 引用全部保留且可解析 |
| 待核实标记 | `upcoming.js` 的 2028 年两部档期加 `pendingReview: true` 并在 note 说明；`series.js` 的 VisionQuest 上线日期/集数/剧情关联加 `pendingReview: true`；`components.js` 把这类卡片显示成「档期待核实」而不是「已定档」 |

### 1.2 线上与本地数据一致性

- 以线上为依据，只读下载并覆盖 7 个差异文件；校验 `news=54`、`doomsday/visionquest/ultron` 均存在。
- 未覆盖 `h5/` 之外任何文件，未触碰他人 232 项未提交改动。
- 新增 `docs/审计/H5 数据权威目录与发布流程.md`：明确 `h5/data/*.js`（`window.MCU_*`）为 H5 唯一权威源、`shared/data/*.js`（`module.exports`）为小程序权威源，`shared/sync_data.sh` 只同步小程序三端；**不强行合并三端数据结构**；写明发布流程、数据纪律、规范 URL 约定。
- 新增 `h5/tools/check-live-local-diff.cjs`：发布前比较线上/本地各数据集合的 **id 集合**（不是全文 hash，避免新增字段误判），支持 `--full` 列出全文差异作为部署清单；只读、不写文件、不修改线上。
- 新增 `h5/tools/regression-basic.cjs` 与 `h5/tools/generate-sitemap.cjs`（含 `--check`）。

### 1.3 SEO 基础设施

| 项目 | 结果 |
|---|---|
| `h5/robots.txt` | 新增：`Allow: /`、`Disallow: /api/`、`Sitemap: https://mcuatlas.xyz/sitemap.xml` |
| `h5/sitemap.xml` | 新增，由工具按本地数据生成，**76 条 URL** = `/` + `/routes.html` + 11 条路线详情 + 59 部已上映作品详情 + 1 个专题 + `news/next/map`；排除 `/index.html`、`/special`、`/map-pc.html`、`news-detail`（noindex）、社区族薄页、未上映作品详情 |
| 静态 canonical | `index.html`(`/`)、`routes.html`、`news.html`、`next.html`、`map.html` 在 `<head>` 写死 `<link rel="canonical" data-static="1" …>`，不执行 JS 的抓取器也能读到 |
| 运行时 canonical | `app.js` 的 `injectSeoTags` 重写：`/index.html → /`、`/special → /special.html`；复用已有静态标签避免重复；KEEP 增加 `news-detail.html: ['id']`（并保留 `topic-detail.html`） |
| `/` 与 `/index.html` | 两处实测 canonical 均为 `https://mcuatlas.xyz/`；sitemap 只列 `/` |
| `/special` 与 `/special.html` | 本地模拟 pretty URL 实测 `/special` 的 canonical 规范为 `/special.html`；带 `?id=` 时两处一致 |
| 资讯详情 | **保持 `noindex`（未擅自开放收录）**；canonical 修正为保留 `?id=`；卡片点击跳转实测正常；内链仍为 JS `location.href`，浏览器导航可用，爬虫可发现性留待评估 |

---

## 2. 测试通过

### 2.1 本地数据断言：`node h5/tools/regression-basic.cjs`

**41 项全部 PASS，退出码 0。** 关键项：

```
PASS 已上映集合不含未上映作品 :: 已上映 59 部 / 全部 62 部
PASS 已上映上映序 ro 连续 1..N :: N=59
PASS 11 条观影路线 :: 实际 11
PASS 专题核心 8 部 / 完整 15 部 :: 8/15
PASS 全部关系两端均可解析 :: 0 条异常
PASS 未来计划中文片名与作品主数据一致
PASS 同一部片不会在下一部推荐里出现两次
PASS 观影进度统计排除未上映作品且保留原始记录
PASS sitemap URL 数与当前数据一致 :: 实际 76 / 期望 76
PASS 首页规范 URL 为 / 而非 /index.html
PASS 资讯详情仍为 noindex（未擅自开放收录）
```

### 2.2 工具与静态检查

| 命令 | 结果 |
|---|---|
| `node h5/tools/generate-sitemap.cjs` | 生成 76 条 URL |
| `node h5/tools/generate-sitemap.cjs --check` | PASS（与当前数据一致），退出码 0 |
| `node h5/tools/check-live-local-diff.cjs` | **PASS**，10 个数据集合线上/本地条目完全一致（`MOVIES 40/40`、`SERIES 15/15`、`CHARACTERS 25/25`、`NEWS 54/54`、`RELATIONS 92/92` 等） |
| `node --check` `app.js` / `content.js` / `upcoming.js` | 全部退出码 0 |
| `read_lints` 对 `h5/` | 0 条诊断 |

### 2.3 浏览器冒烟（本地静态服务器，真实 Chrome / Playwright）

| 场景 | 实测 |
|---|---|
| 首页 `/` 与 `/index.html` | `stat-count=59`、`stat-routes=11`；canonical 均 `https://mcuatlas.xyz/`，且 `link[rel=canonical]` 恰好 1 个；未来计划 4 部名称统一、2 个「档期待核实」 |
| `/next.html` | 41 个 `<option>`、2 个 `disabled`；**无** `doomsday` / `secretwars` 值，**无**「末日 / 毁灭之日」重复项；选中 `iron-man` 后正常给出「复仇者联盟」推荐 |
| `movie.html?id=doomsday` | H1「复仇者联盟：末日」，`seenBtn=false`，title 带「（未上映）」，文案含「尚未上映」，canonical 保留 `?id=doomsday` |
| `movie.html?id=iron-man` | H1「钢铁侠」，`seenBtn=true`，含「第 1 部」，canonical 保留 `?id=iron-man` |
| `route-detail.html?id=release` | 「59 部作品 / 59 总作品」，无「62 部」 |
| `special.html?id=avengers-doomsday` | 核心 8 / 完整 15、终点圆点「5」、终点中文名「复仇者联盟：末日 · 2026.12.18」、页面无「毁灭之日」旧名，canonical 保留 `?id=` |
| `routes.html?r=release` | 「即将上映」卡 4 部名称全部正确显示（顺带修复原 `u.cn` 读空字段导致片名空白的问题） |
| `news.html → 点击卡片` | 跳转 `news-detail.html?id=news-2026-11-06-001`，详情页 H1 与正文正常，`noindex=true`，canonical 含 `?id=` |
| 历史 localStorage | 注入含 `doomsday` 的 `mcu_nav_user_v1` 后 reload：`raw` **完整保留**；`isSeen('iron-man')=true`、`isSeen('doomsday')=true`（历史记录可读）；`count()=1`（统计只算已上映）、`total()=59`、`favIds/wantedIds` 正常 |
| `map.html` / `map-pc.html` | 关系地图 40 个节点正常渲染、canonical 正常，无回归 |
| 浏览器 console | 唯一错误为本地 `GET /api/topics?...` 404 —— 本地无后端，线上有 `/api/`，属**预期环境差异**，非代码错误 |

### 2.4 部署前检查记录

`node h5/tools/check-live-local-diff.cjs --full` 实测：数据集合 **PASS**；页面/配置全文差异（即待部署清单）为
`index.html, routes.html, movie.html, special.html, news.html, next.html, map.html, map-pc.html, assets/js/app.js, assets/js/components.js`；
`robots.txt` / `sitemap.xml` 线上仍为 404（`SKIP`），因本轮未部署，属预期。

---

## 3. 未验证

1. **线上真实环境**：所有浏览器测试在 `http://127.0.0.1:8765` 本地静态服务器完成；线上未部署，因此线上实际渲染、CDN/缓存行为、HTTP 头均未验证。
2. **搜索引擎实际收录与 JS 渲染**：本轮只验证「原始 HTML 中有静态 canonical / robots / sitemap 文件存在」，未验证搜索引擎是否抓取、是否执行 JS、是否采纳 canonical。
3. **`/special` 的服务器行为**：本地用自建静态服务器模拟 nginx pretty URL；线上 nginx 的实际 rewrite 规则未验证。
4. **参数化详情页的原始 HTML canonical**：`movie.html` / `route-detail.html` / `special.html` / `news-detail.html` 的 canonical 仍由 JS 运行时注入；不执行 JS 的抓取器读不到（这是纯静态站点的固有限制，需预渲染才能解决，本轮范围外）。
5. **真机移动端 / 微信内置浏览器 / 小程序扫码**：本轮用 Chrome/Playwright 视口模拟，未做真机验证。
6. **社区写操作**：发帖、审核、点赞、举报等接口本轮一律只读未触发。
7. **资讯来源逐条真实性**、**`/api/` 在线上的首页社区预览**、**运营埋点上报**：均未验证。
8. **2028 年档期、VisionQuest 上线日期/集数/剧情关联**：未做官方核验，已标 `pendingReview`，不认定为事实。

---

## 4. 尚未执行

按任务约束或范围外，明确**未做**：

- 部署、推送 Git、修改线上资源（约束要求）。
- 修改服务器 Nginx 配置或加 301（约束要求「不擅自修改」）；`/index.html → /`、`/special → /special.html` 目前仅靠 canonical + sitemap 归一，**URL 层面的 301 未实施**。
- 参数化详情页预渲染 / 原始 HTML 正文快照（P0-3，本轮任务未列入）。
- 资讯详情内链改成 `<a href>`、以及是否开放资讯详情收录的评估（任务明确要求「不要未经评估就开放全部资讯详情收录」）。
- 社区族 4 页补 H1/导航/canonical/noindex、`map-pc.html` 孤立页收口、JSON-LD 结构化数据、`routes.html?r=` 与 `route-detail.html?id=` 重复内容合并（审计 P1/P2 项）。
- 首页新用户路线引导、收藏接 UI、小程序文案与「换设备也能接着看」的一致性修正、`news.js` 头部 `stage: mock` 元信息更新（均属其他迭代项，避免扩大本轮范围）。

---

## 5. 需要人工确认

1. **正式中文片名口径**：本轮以线上 `movies.js` 与近期资讯的「复仇者联盟：末日 / 复仇者联盟：秘密战争」为全站准名，把 `upcoming.js` 改了过来；「复联5」仅保留为专题营销名。请内容负责人确认此选择（资讯正文为历史报道文本，未改写）。
2. **VisionQuest 是否加入「未来计划」**：本轮只把它标为 `releaseStatus: 'upcoming'` 并保留详情/关系引用，**未新增**任何官方档期条目，以免编造信息。若需在未来计划展示，请提供官方来源。
3. **待核实内容**：`black-panther-3` / `ghost-rider` 的 2028 年档期、VisionQuest 的上线日期/集数/「直连《末日》」关联，需对照官方来源复核后决定是否去掉 `pendingReview`。
4. **规范 URL 与 301 规则**：确认首页规范 URL 为 `/`、专题为 `/special.html?id=…`，并在部署阶段决定是否加 Nginx 301（见第 8 节）。
5. **资讯详情收录策略**：当前保持 `noindex`；是否让 54 个详情页参与收录，需单独评估内容质量后再定。
6. **部署清单与回滚**：确认第 8 节的部署范围，以及 `data/*.js` 的 7 天缓存是否需要在部署时处理。

---

## 6. 修改文件清单与 Git 差异

### 6.1 已跟踪文件修改（19 个）

| 文件 | 改动摘要 |
|---|---|
| `h5/assets/js/app.js` | 引入 `ALL_CONTENT` 双集合、`isUpcoming()`、进度统计过滤、`injectSeoTags` 规范化与 KEEP 补全（+50/-…） |
| `h5/assets/js/components.js` | 待核实档期徽标 |
| `h5/data/characters.js` | 回同步线上 `ultron` |
| `h5/data/content.js` | 发布状态注入、双集合输出、序号只在已上映集合重算 |
| `h5/data/movies.js` | 回同步 2 部 + `releaseStatus` + `mainline` 纠正 + 口径注释 |
| `h5/data/news.js` | 回同步线上新增资讯（数组 49 → 54） |
| `h5/data/relations.js` | 片名统一 |
| `h5/data/routes.js` | 片名统一 |
| `h5/data/series.js` | 回同步 `visionquest` + 发布状态/待核实标记 |
| `h5/data/special-routes.js` | 注释路径回同步 + tagline 片名统一 |
| `h5/data/upcoming.js` | 片名统一 + `contentId` / `seriesNo` / `pendingReview` + 口径注释 |
| `h5/index.html` | 注释路径回同步 + 静态 canonical |
| `h5/map.html` | 静态 canonical + 全景卡名统一 |
| `h5/map-pc.html` | 全景卡名统一 |
| `h5/movie.html` | 未上映作品精简详情分支 |
| `h5/news.html` | 静态 canonical |
| `h5/next.html` | 选择器去重与发布状态过滤、终点文案修复、静态 canonical |
| `h5/routes.html` | `u.title` 片名修复 + 静态 canonical |
| `h5/special.html` | 注释路径回同步 + `seriesNo` 兼容 |

`git diff --stat -- h5/`：**19 files changed, 478 insertions(+), 64 deletions(-)**。
其中 `news.js +271 行`、`movies.js +36`、`next.html +41/-…`、`content.js +28`、`app.js +50` 为主要体量。

### 6.2 新增文件（本轮）

| 文件 | 字节 | 用途 |
|---|---|---|
| `h5/robots.txt` | 87 | 抓取指引 + Sitemap |
| `h5/sitemap.xml` | 5817 | 76 条规范 URL（工具生成，勿手工编辑） |
| `h5/tools/generate-sitemap.cjs` | 4452 | sitemap 生成 / `--check` |
| `h5/tools/check-live-local-diff.cjs` | 6784 | 发布前线上/本地数据集合差异检查 |
| `h5/tools/regression-basic.cjs` | 9952 | 本地回归断言（41 项） |
| `docs/审计/H5 数据权威目录与发布流程.md` | 4237 | 权威目录、适配边界、发布流程 |

> `docs/审计/MCU Atlas H5 线上现状审计与迭代建议报告.md` 为**上一轮**交付物，同在未跟踪目录 `docs/审计/` 内，本轮未修改。
> `h5/tools/` 与 `docs/审计/` 为本地运维资产，部署时可不上传到 Web 根目录。

### 6.3 未触碰

`shared/`、`wechat/`、`douyin/`、`workspace/`、`h5/data/{posters,stills,visuals,special,short,community,content 之外的其他旧口径}` 均按要求未合并/未改动；全仓他人 232 项未提交改动保持不变。

---

## 7. 线上/本地数据差异记录

| 时点 | 记录 |
|---|---|
| 修复前 | 7 个文件不同：3 个仅注释路径；`movies/series/characters/news` 为线上领先本地（详见第 0 节） |
| 回同步后 | 7 个文件以线上为准覆盖本地；校验 `news=54`、`doomsday/visionquest/ultron` 存在 |
| 本地改造后 | 新增 `releaseStatus` / `contentId` / `seriesNo` / `pendingReview` 等字段、静态 canonical、SEO 文件；**条目 id 集合未变** |
| 验收时 | `check-live-local-diff.cjs` → PASS，10 个集合线上/本地条目数完全一致；`--full` 列出 10 个待部署页面差异 + 2 个线上尚未存在的 SEO 文件 |
| 部署后（待执行） | 应再次跑 `check-live-local-diff.cjs`，此时线上也应有 `MCU_CONTENT_ALL`，工具会比较未上映集合并给出 PASS |

---

## 8. 部署建议（本轮不实施，仅供人工确认）

1. **部署清单**：`h5/` 下 19 个已修改文件 + `robots.txt` + `sitemap.xml`；`h5/tools/`、`docs/审计/` 属本地运维资产，可不上传。
2. **Nginx 301（需人工确认后由运维配置，本轮未改）**：
   ```
   location = /index.html { return 301 /$is_args$args; }
   location = /special   { return 301 /special.html$is_args$args; }
   ```
   注意站内导航 logo 使用 `href="index.html"`，加 301 后会产生一次跳转；上线前需确认无表单/相对路径依赖。
3. **缓存**：线上 `data/movies.js` 等静态 JS 为 `Cache-Control: max-age=604800`（7 天），而 `data/news.js` 是 `no-cache`。本次改动了多个数据文件，部署后回访用户可能最长 7 天仍读旧数据；建议部署时对 `data/*.js` 统一刷新/缩短缓存（涉及服务器配置，需人工确认）。
4. **部署后验收清单**：
   - `curl -I https://mcuatlas.xyz/robots.txt`、`/sitemap.xml` → 200，sitemap 76 条；
   - 浏览器打开首页 → 59 部内容 / 11 条路线；`movie.html?id=doomsday` → 无「标记已看」；
   - `/` 与 `/index.html`、`/special` 与 `/special.html` 的 canonical 一致；
   - `node h5/tools/check-live-local-diff.cjs` → PASS 且未上映集合一致；
   - `node h5/tools/generate-sitemap.cjs --check` → PASS。
5. **回滚**：全部为静态文件改动，回滚即还原上一版文件；无数据库/服务端状态变更，`localStorage` 结构未变，用户数据不受影响。

---

## 9. 交 ChatGPT 独立审查的建议切入点

1. `content.js` 的双集合设计是否会让「未上映条目」在 `expandRoute()`（按 `byId` 映射手写 items）中被意外带回路线——本轮回归已验证 11 条路线无未上映/悬空 ID。
2. `app.js` 的 `injectSeoTags` 对静态 `data-static="1"` 标签的复用逻辑，是否在 `routes.html?r=` 与参数化页面上产生互相矛盾的 canonical。
3. `next.html` 的 `linkedIds` 去重是否会在未来计划新增同名条目时误删。
4. 以「复仇者联盟：末日」为唯一中文名的口径是否正确，以及资讯历史正文未改写是否可接受。
5. `sitemap.xml` 排除 `/index.html`、`/special`、`news-detail`、社区页、`map-pc.html` 的范围是否合适。
6. 未上映作品详情页仍可被浏览器直接访问且无 `noindex`，是否需要额外处理（本轮判断：保留引用优先，未擅自加索引限制）。

---

**本轮结束**：本地修复与验收完成，未部署、未推送 Git、未修改线上资源。
