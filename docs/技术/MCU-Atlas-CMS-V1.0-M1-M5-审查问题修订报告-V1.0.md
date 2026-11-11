# MCU Atlas CMS V1.0 · M1–M5 审查问题修订报告 V1.0

| 项 | 值 |
|---|---|
| 日期 | 2026-11-10 |
| 执行方 | CodeBuddy（开发） |
| 性质 | 独立审查问题核查 + 本地最小修订 |
| 架构基线 | 《MCU Atlas CMS V1.0 最终架构定案 V2.1》+ V2.0 §13.5/§17.2 |
| 等级 | **已实现 / 本地测试通过 / 隔离模型验证通过**；生产环境验证 = 无 |
| 测试 | 12 套件、177 项断言全部通过；端到端自检通过 |
| 生产动作 | **零**：未登录服务器、未创建用户/服务、未改 Nginx/证书、未部署 sitemap、未 Git commit/push |
| 后续 | 专项复核发现的新问题及修复见 `docs/技术/MCU-Atlas-CMS-V1.0-M1-M5-修订代码专项复核报告-V1.0.md`（195/195） |

---

## 0. 结论摘要

| 审查问题 | 是否确认缺陷 | 本轮状态 |
|---|---|---|
| P0-1 下架桩页与 Sitemap 移除冲突 | **是**（两个缺陷：无桩页；移除守卫一刀切） | 已修复：200/noindex 桩页 + 自动/审批移除分类 + 审计 |
| P0-2 `--check` 完整性范围 | **是**（只查基础段，extra 被替换无法发现） | 已修复：结构/重复/整表（带 `--extra`）/extra 卫生 |
| P0-3 内链扫描 | **是**（只查 `/article/` 目标存在，未查下架/媒体/资源/站内页） | 已修复：构建期全站扫描 + BLOCK 规则 |
| P1-1 `systemd.path` 重复触发 | 设计缺口（未实现，无法证伪生产行为） | 已补消费模型 + 8 项隔离测试；真实 unit 仍未验证 |
| P1-2 M7 备份恢复 | 缺口（无代码、无演练） | 已补基础件 + 6 项本地测试 + 设计稿；生产未执行 |
| P1-3 媒体 EXIF | **是**（原样落盘，元数据可公开） | 已实现 JPEG/PNG 剥离、WebP/方向拒绝、审计 |

**M6 仍未准入**。本轮只关闭了 M6 前置中的“桩页 + 内链 + 校验完整性”三项，C1/C2/C3/C5 与 M7 生产演练仍未满足。

---

## 1. P0-1：下架桩页与 Sitemap 逻辑

### 1.1 原始代码证据（修订前）

| 证据 | 位置（修订前） | 说明 |
|---|---|---|
| 构建只加载 `published` | `mcu-cms/app/build/build.cjs:62` | `WHERE status = 'published'`；`unpublished/archived` 不进入任何页面 |
| 无桩页模板 | `mcu-cms/app/build/templates.cjs` | 只有 `articlePage` / `listPage`，无下架提示页 |
| Sitemap 移除一刀切 | `mcu-cms/app/build/build.cjs` 旧 `SITEMAP_SHRINK_PREV` 分支 | 任何上一版 URL 消失都要求显式 `allowRemove`，无法区分“下架应移除”与“误删” |
| 无移除审计 | `mcu-cms/app/publish/release.cjs` | 只写 `release_build/switch/rollback`，无 `removed_urls` 记录 |
| 测试把“下架→构建失败”当预期 | `mcu-cms/tests/build.test.cjs` 旧用例 | 断言下架后必须抛错，等于把缺陷固化 |
| V2.1/V2.0 要求 | V2.0 §17.2（第 1242–1251 行） | 200 桩页 + `noindex,follow` + 自指 canonical + sitemap 移除 + 内链阻断 |

### 1.2 缺陷确认

1. 下架/归档文章旧 URL 直接 404，外链与搜索流量断崖。
2. `allowRemove` 被当成唯一手段，导致“正常下架”与“URL 被误删”无法区分；且原实现没有审批/审计。
3. 即使生成桩页，若仍把 URL 留在 sitemap，会与 `noindex` 冲突（S7）。

### 1.3 修订后的行为

| 状态 | 旧 URL | 页面 | Sitemap | 内链 |
|---|---|---|---|---|
| `published` | 200 | 正常文章页 | 收录 | 允许 |
| `unpublished`（曾发布） | 200 | **桩页**：标题、下架说明、发布时间、分类/列表入口；`noindex,follow`；canonical 自指；无 Article JSON-LD | **移除**，自动允许并审计 `release_removed_urls` | 指向该 slug 的 `<a>` → **BLOCK**，要求清理 |
| `archived`（曾发布） | 200 | 同上，文案为“归档” | 同上 | 同上 |
| 从未发布（draft/review） | 不存在 | 不生成 | 不涉及 | 不涉及 |
| 物理删除（仅直接改库） | 无桩页 | 无 | 该 URL 变成“来源不明消失” → **BLOCK** | — |

**允许 URL 删除的条件**（`app/build/removals.cjs`）：

1. 对应文章在 `removedSlugs` 中（下架/归档且 `published_at` 非空）→ 自动允许，reason=`article_unpublished`。
2. 分页缩减（`/article/page/N`、`/article/c/<cat>/page/N`）→ 自动允许，reason=`pagination_shrink`。
3. 显式 `allowRemove`：仅 owner、必须 reason、写 `release_allow_remove` 审计；仍不允许删除基础 76 条中的任何一条。
4. 其它消失 → `SITEMAP_URL_REMOVED_UNEXPECTED` **BLOCK**。

**已删除文章**：V1 不提供物理删除 API（`DELETE /articles/:id` 不存在；修订 FK 为 RESTRICT）。若有人直接 `DELETE FROM cms_articles`，构建会因上一版 URL 来源不明而阻断，必须 owner 显式 `allowRemove` + reason；不提供“静默 404”。

### 1.4 修改文件

- `app/build/build.cjs`：加载 removed 文章、生成桩页、`removedSlugs`、Sitemap 分类、审计数据。
- `app/build/templates.cjs`：新增 `removedPage()`。
- `app/build/removals.cjs`（新）：消失分类器。
- `app/publish/release.cjs`：owner 校验、`allowRemoveReason`、`sitemap_diff_json`、两类审计。
- `app/api/index.cjs`：`POST /releases` 接收 `allow_remove` / `reason`，透传 actor。
- `tests/build.test.cjs`、`tests/release-removal.test.cjs`。

### 1.5 测试

- `build.test.cjs`：下架后桩页存在、200 语义（静态 200 由文件存在与 Nginx 保证）、`noindex,follow`、canonical 自指、仅 Breadcrumb JSON-LD、正文不出现、sitemap 排除、自动移除分类正确；正文链接下架文章 → `LINK_REMOVED_ARTICLE` 阻断；ghost URL → 阻断；owner + reason 放行。
- `release-removal.test.cjs`：批次 2 自动审计；editor 用 `allowRemove` → `ALLOW_REMOVE_FORBIDDEN`；owner 无 reason → `ALLOW_REMOVE_REASON_REQUIRED`；owner + reason → `release_allow_remove` 审计与 `sitemap_diff_json` 落库。
- 原旧用例“下架必须抛错”不再符合需求，已改写为两条更强断言（自动允许 + 来源不明阻断），未删除测试、未放宽其它断言。

---

## 2. P0-2：Sitemap `--check` 完整性

### 2.1 原始代码证据

`h5/tools/generate-sitemap.cjs` 旧 `--check`：

```js
const curLocs = readLocList(cur);
const baseOk = curLocs.length >= baseUrls.length
  && baseUrls.every(function (u, idx) { return curLocs[idx] === u; });
```

只比较前 76 条；extra 区域被替换成另一条合法 `/article/` URL、或顺序打乱，均会 PASS。

### 2.2 缺陷确认

- **是**。基础段一致不能证明 extra 区未被篡改；`--check` 无法作为发布前整表校验。
- 另发现：`--check` 会先执行“只增不减”生成守卫，导致对一份含 extra 的合法 sitemap 做只读检查时，被“本次生成会缩水”误判为失败（测试暴露）。

### 2.3 修订

| 模式 | 校验内容 |
|---|---|
| `--check`（无 `--extra`） | XML 结构（声明/根元素/收尾/无 script/无 DOCTYPE）、基础段逐条一致、无重复 loc、extra 区全部为 `/article/`、严格升序 |
| `--check --extra <file>` | 上述 + **整表必须与「基础 + 本次清单」完全一致**（数量、顺序、逐条）；extra 被替换/多/少即失败 |
| 生成模式 | `--check` 为只读，不再触发“只增不减”生成守卫；生成仍保留该守卫 |

构建侧（`app/build/build.cjs`）另做：

- `SITEMAP_XML_INVALID`：结构/根元素/收尾/script/DOCTYPE。
- `SITEMAP_MISSING_URL` / `SITEMAP_UNEXPECTED_URL`：与 `expectedAll` 双向比对。
- `SITEMAP_EXTRA_ORDER`：extra 尾部必须与排序后的清单逐条一致。
- `SITEMAP_DUP`：重复 URL。
- `SITEMAP_URL_REMOVED_UNEXPECTED` / `ALLOW_REMOVE_REASON_REQUIRED`：移除审批。

### 2.4 测试

`sitemap.test.cjs` 15/15：

- 黄金基线逐字节不变。
- `--check` 现有 h5 PASS。
- `--check --extra` 整表 PASS；把 `alpha` 换成 `beta`（仍合法、仍排序）→ 基础段仍 PASS、整表失败。
- 无 `--extra`：extra 未排序 → 失败；extra 出现非 `/article/` → 失败。
- 根元素/收尾损坏 → 失败。
- 原有重复、min-count、只增不减、allow-remove、非法 URL 全部保留。

---

## 3. P0-3：内链扫描

### 3.1 原始代码证据

`app/build/seo-check.cjs:162-176` 只做：

```js
if (isInternalPath(href) && href.startsWith('/article/')) {
  ...
  if (!knownPaths.has(clean)) out.push(SEO114);
}
```

缺口：

- 指向已下架/归档文章的链接（桩页存在，SEO114 不会报）。
- `/media/...` 不存在或记录已软删。
- `/assets/...` 资源不存在。
- `/routes.html`、`/nope.html` 等站内页面不存在。
- 构建产物中失效的站内链接。

### 3.2 修订规则（全部 BLOCK）

| 代码 | 条件 | 级别 |
|---|---|---|
| `LINK_REMOVED_ARTICLE` | `<a href="/article/<下架slug>">` | BLOCK（V2.0 §17.2 要求先清理引用） |
| `LINK_MEDIA_MISSING` | `/media/...` 无 active 媒体记录 | BLOCK |
| `LINK_MEDIA_FILE_MISSING` | 记录存在但 `data/media` 文件缺失 | BLOCK |
| `LINK_ASSET_MISSING` | `/assets/...` 或 `/article/assets/...` 文件不存在 | BLOCK |
| `LINK_SITE_MISSING` | 非 `/article/`、非 `/media/`、非 `/assets/` 的站内路径不在 h5 页面清单 | BLOCK |
| `SEO114`（既有） | `/article/...` 目标不存在（含分类/标签/分页） | BLOCK |

**WARN**：本轮未把任何“断链”降级为 WARN。外部链接缺 `rel` 仍是 GEO `C5-03` WARN（不属于内链）。

### 3.3 修改文件

- `app/build/link-check.cjs`（新）：`scanLinks`、`buildSitePaths`。
- `app/build/seo-check.cjs`：**未修改**；SEO114 保留，新扫描器对 `/article/...` 目标存在性不重复报告。
- `app/build/build.cjs`：在页面校验后对全部 HTML 扫描。
- `tests/link-check.test.cjs`、`tests/build.test.cjs`。

### 3.4 测试

- `link-check.test.cjs` 6/6：下架链接、媒体缺失/文件缺失、资源/站内页面缺失、合法链接不误报、消失分类（下架/分页自动、ghost 阻断、基础 URL 永不可删、allowRemove 只进 manual）。
- `build.test.cjs`：正文链接下架文章 → 构建阻断；正常构建无内链误报。

---

## 4. P1-1：`systemd.path` 重复触发

### 4.1 原始状态

只有设计文字（`mcu-cms/docs/发布链路设计与本地模拟说明.md` §1.2），无模型、无测试。原设计写“每次运行清空 work/”，与崩溃恢复冲突。

### 4.2 修订后的防重复方案

| 机制 | 实现 |
|---|---|
| 单实例 | `flock` 非阻塞；拿不到 `exit 75`，由下一次 path 触发再试 |
| 请求幂等 | `id` 唯一；`done/<id>.res` 存在即不再执行 |
| 原子 claim | `rename(incoming/<id>.req → work/<id>.req)`，同文件系统 |
| 消费顺序 | 先 `reconcile(work)`，再按文件名（时间戳）升序；每轮 ≤10 |
| 无效隔离 | JSON/字段/action/seq/sha 校验失败 → `failed/<id>.res`，继续下一条 |
| 失败恢复 | 业务失败 → `failed/`；work 残留下次 reconcile |
| 超时 | `RuntimeMaxSec=60`；被 kill 的请求留在 work，下次继续；切换动作必须幂等（目标 seq 已达成则 no-op） |
| 至少一次 | 允许重复执行；靠“读当前软链/sitemap 事实 + 目标 seq”收敛 |

### 4.3 修改文件与测试

- `app/publish/spool-sim.cjs`（新，本地模型，不创建 systemd/root/spool）。
- `tests/spool-sim.test.cjs` 8/8：重复触发一次副作用、incoming→work 崩溃恢复、无效请求隔离、单实例锁/陈旧锁、失败不阻塞、至少一次幂等、重复 submit 拒绝、字段白名单（路径/命令字段拒绝）。

### 4.4 仍未验证

- 真实 `PathExistsGlob` 在 systemd 下的合并/排队行为。
- `flock` 在 root oneshot 与 `RuntimeMaxSec` kill 下的行为。
- `O_NOFOLLOW`、`st_uid`、`st_nlink` 的真实文件系统语义。
- 必须 M6 沙箱 + 真实 unit 才能声称“发布服务防重复已验证”。

---

## 5. P1-2：M7 备份与恢复

### 5.1 原始缺口

- 无备份代码；只有 V2.0 文档描述。
- 无 WAL 快照实现；无媒体 manifest；无恢复校验。
- 未做恢复演练。

### 5.2 本轮完成

- `app/publish/backup.cjs`：
  - `backupDatabase`：`VACUUM INTO`（WAL 安全，禁止 `cp`）。
  - `verifyBackup`：只读打开、`integrity_check`、文章数/已发布数、`current_release_seq`、sha256。
  - `restoreDatabase`：校验源、目标需 `force`、删除 `-wal/-shm`、临时文件 + rename。
  - `mediaManifest` / `verifyMedia`：path/bytes/sha256，缺失与篡改。
  - `backupSitemap`：copy + sha256。
- `docs/M7-备份与恢复设计.md`：对象、保留矩阵、WAL、校验、恢复顺序、失败回滚、恢复后 I1–I6、演练要求。
- `tests/backup.test.cjs` 6/6：WAL 快照、备份后修改不影响备份、恢复需 force、恢复后无 WAL/SHM、媒体篡改/缺失、sitemap sha、损坏备份拒绝。

### 5.3 仍未完成

- 生产 `/www/backup`、cron、tar.gz、权限、systemd stop/start。
- 真实恢复演练（季度 1 次）。
- `cms_backups` 表尚未接入备份记录（本轮只做文件级）。
- 媒体 manifest 的“额外文件”检测仅顶层，嵌套目录需后续补强。

---

## 6. P1-3：媒体 EXIF

### 6.1 原始代码证据

`app/repo/media.cjs` 旧 `registerMedia`：

```js
const hash = sha256(buffer);
...
fs.writeFileSync(abs, buffer, { mode: 0o644 });
```

原始字节直接落盘，无元数据检测/剥离；GPS、设备、作者、XMP、PNG 文本块均可公开。

### 6.2 策略与实现

- `app/repo/exif.cjs`（新）：
  - JPEG：删除 APP1（Exif/XMP）、APP13（IPTC）、COM；保留 JFIF/ICC/像素数据；读取 EXIF Orientation，≠1 拒绝。
  - PNG：删除 `eXIf`、`tEXt`、`zTXt`、`iTXt`、`tIME`；保留 IHDR/IDAT/IEND/ICC/pHYs。
  - WebP：只检测；含 EXIF/XMP 拒绝（不做 RIFF 重写）。
- `registerMedia`：剥离后再计算尺寸/哈希/文件名；审计 `metadata_removed`、`original_bytes`、`original_sha256`。
- 错误码：`MEDIA_METADATA_UNSUPPORTED`、`MEDIA_ORIENTATION_REQUIRES_PREPROCESS`。

### 6.3 测试

`tests/media-exif.test.cjs` 6/6：JPEG Exif 剥离、Orientation=6 拒绝、PNG 文本块剥离、WebP 含 EXIF 拒绝/无元数据通过、落盘字节无 Exif 且审计完整、API 层 WebP 拒绝。

另对 `h5/` 现有 135 张 JPG/PNG/WebP 做解析验证：135/135 可安全处理（不修改原图）。

### 6.4 未解决

- ICC、未知 APPn 保留（可能含设备描述）；不做像素重编码/隐写检测。
- WebP 含元数据只能拒绝，需上传者预处理。
- Orientation≠1 需上传者先旋转导出（本轮不自动旋转）。

---

## 7. 修改文件与 SHA256

> 说明：`mcu-cms/` 上一轮未纳入 Git，修订前没有可比对哈希；下表为**修订后**实测值。唯一有修订前基线的是 `h5/tools/generate-sitemap.cjs`（`a2fabdc0…0753a5`，原始副本在变更单目录）。

| 文件 | 字节 | SHA-256（修订后） |
|---|---:|---|
| `mcu-cms/app/build/build.cjs` | 26,190 | `81edbc201b42be4c142edcc7abb27824c199aefdf5ba6d8fd584994bc93e84a9` |
| `mcu-cms/app/build/templates.cjs` | 13,248 | `246dbf0f39bc9f04186f4268a4a4382dbe2a20ff74bf4baccbbba4a0a4589d72` |
| `mcu-cms/app/build/removals.cjs`（新） | 2,892 | `5f0c3c162b9dbf75ad2d7b100c12dff44acac5b2dfae82b76fa2980a78f76ce2` |
| `mcu-cms/app/build/link-check.cjs`（新） | 4,215 | `f9d5e839a5f81079bcf182ff6bd85656cd1c0749a2fbdd766bae19d0b40e012e` |
| `mcu-cms/app/repo/media.cjs` | 9,782 | `277cdad23443bed32f3c33026c584ba54f196b69d05819eeca68ef5e4197dfd2` |
| `mcu-cms/app/repo/exif.cjs`（新） | 6,095 | `8caae00406e2458f5c5876f6fdcfa4fe824509f4ee82a13b8742de7a6db3636b` |
| `mcu-cms/app/publish/release.cjs` | 13,924 | `d14a81c8ffeef24e7ce7d33d1e830b9f44c26f0221fed9269ec3c8ba2d998ea9` |
| `mcu-cms/app/publish/spool-sim.cjs`（新） | 7,250 | `ec3882fba7beb2bc1fdb704659749062eaab9e37a30b7fa9910f7107127de438` |
| `mcu-cms/app/publish/backup.cjs`（新） | 5,355 | `2a2609310cf82d0d8fae90b23d63e9d08fbb2b303016da2db3cadce3ff755d71` |
| `mcu-cms/app/api/index.cjs` | 23,430 | `a40fcda3a513330ea79d865d15c78a8a5bffd52cc7be420c8038e85e8d36d158` |
| `h5/tools/generate-sitemap.cjs` | 11,553 | `a3129fac55af9d6406c3c108692ca2c0db2f97a5070f0380c70df950a23143eb` |

新增/修改测试：`build.test.cjs`、`sitemap.test.cjs`、`link-check.test.cjs`、`release-removal.test.cjs`、`spool-sim.test.cjs`、`backup.test.cjs`、`media-exif.test.cjs`。

新增文档：`mcu-cms/docs/M7-备份与恢复设计.md`、`mcu-cms/docs/媒体EXIF处理策略.md`、本报告。

---

## 8. 测试与回归

`node mcu-cms/tests/run-all.cjs` → **12 套件 / 177 项全部通过**：

| 套件 | 项 | 结果 |
|---|---:|---|
| db | 18 | PASS |
| markdown-40 | 40 | PASS |
| api | 26 | PASS |
| build | 15 | PASS |
| seo-geo | 20 | PASS |
| sitemap | 15 | PASS |
| link-check | 7 | PASS |
| publish-sim | 11 | PASS |
| release-removal | 5 | PASS |
| spool-sim | 8 | PASS |
| backup | 6 | PASS |
| media-exif | 6 | PASS |

端到端：`node mcu-cms/app/tools/e2e.cjs` → `ok:true`，`I1–I6` 全 true，`level=local-isolated`。

**原有测试是否回归**：原有 140 项断言未删除；其中 1 条旧断言（“下架导致 Sitemap 消失必须抛错”）因需求明确要求改为“桩页 + 自动移除”，已改写为两条更严格断言（自动允许分类 + ghost 阻断），其余全部保留并通过。测试总数由 140 → 177 是新增，不是替换。

**失败测试说明**：本轮开发中曾出现 3 次失败，均已定位并修复，不是通过放宽断言：
1. 构建测试 `buildSitePaths is not defined` → 漏引入，修复。
2. 下架测试预期 stubs=1，实际=2（历史归档的 `build-bad` 也应保留桩页）→ 修正断言为 2。
3. Sitemap 测试在 `--check` 时被“只增不减”生成守卫误判 → 修复为 `--check` 不执行生成守卫。

---

## 9. 与 V2.1/V2.0 的差异（本轮新增）

| ID | 差异 | 说明 |
|---|---|---|
| R-01 | Sitemap 下架移除改为“自动允许 + 审计”，不再要求每次手工 allowRemove | 与 V2.0 §17.2 一致；`allowRemove` 仅用于来源不明 URL |
| R-02 | 显式 `allowRemove` 仅 owner + reason + `release_allow_remove` 审计 | V2.1 只写“显式”，本轮细化为权限与留痕 |
| R-03 | `--check` 增加 `--extra` 整表模式 | 解决 extra 被替换无法发现 |
| R-04 | 内链新增 5 个 BLOCK 代码（下架/媒体/文件/资源/站内页） | V2.0 §17.2 的具体化 |
| R-05 | JPEG Orientation≠1 拒绝上传 | 不重编码前提下无法既剥离 EXIF 又保留旋转 |
| R-06 | WebP 含 EXIF/XMP 拒绝上传 | 避免 RIFF 改写风险 |
| R-07 | M7 备份基础件使用 `VACUUM INTO`，不依赖系统 `sqlite3` | 与 V2.0 的 `.backup` 等价且更适配 node:sqlite |

---

## 10. 仍未解决 / 风险

| # | 项 | 等级 | 说明 |
|---|---|---|---|
| 1 | 生产发布链路（C2） | P0 | unit/helper/spool/软链/生产 sitemap 全未实现；spool-sim 不是生产验证 |
| 2 | M7 生产备份/恢复演练 | P1 | 仅有本地基础件与设计；无 cron、无真实恢复 |
| 3 | 物理删除文章 | P1 | 无 API；直接改库会触发 `SITEMAP_URL_REMOVED_UNEXPECTED`，需 owner allowRemove |
| 4 | `--check` 无 `--extra` 时无法知道“应有”的 CMS 集合 | P2 | 只能做 extra 卫生；构建期已做整表双向校验 |
| 5 | EXIF 残余（ICC/未知 APPn/隐写） | P2 | 零依赖不重编码的固有限制 |
| 6 | WebP/方向需预处理 | P2 | 上传体验成本，需后台上传提示 |
| 7 | 媒体 manifest 嵌套 extra 未检测 | P3 | 当前只检查顶层 |
| 8 | C1 证书、C3 内存、C4 页脚、C5 工具签字 | 阻塞 M6 | 未变 |

---

## 11. M6 准入条件最新状态

| 条件 | 状态 |
|---|---|
| 下架桩页 + 内链扫描 | ✅ 已完成（本轮） |
| Sitemap 完整性（L1/L2） | ✅ 本地完成；L3 root helper 未实现 |
| 发布 spool 防重复模型 | ✅ 隔离模型 8/8；真实 systemd 未验证 |
| M7 备份设计 + 基础件 | ✅ 设计 + 6/6；生产演练未做 |
| 媒体 EXIF | ✅ JPEG/PNG 剥离；WebP/方向拒绝 |
| C1 证书 | ❌ 未确认 |
| C2 用户/unit/helper/权限 | ❌ 未授权、未创建 |
| C3 内存实测/降级 | ❌ 未做 |
| C5 sitemap 工具签字 | ❌ 待签（哈希已变为 `a3129fac…43eb`） |
| ChatGPT 复审 | ❌ 本报告待审 |

**结论：M6 不准入。** 本轮不得进入 M6，不得部署。

---

## 12. 需要 Owner 决策

1. **下架策略**：是否批准“桩页 200 + `noindex,follow` + sitemap 移除 + 自动审计”？（本报告默认方案）
2. **allowRemove 权限**：是否批准“仅 owner + 必填 reason + 双重审计”？
3. **物理删除**：是否确认 V1 永不物理删除；如直接改库导致 URL 消失，必须 owner allowRemove？
4. **媒体策略**：是否接受 WebP 含元数据拒绝、Orientation≠1 需先旋转导出？
5. **M7 备份**：备份目录、保留份数、季度演练窗口与操作人。
6. **C5 重签**：工具哈希已从 `a2fabdc0…` 变为 `a3129fac…43eb`，需重新签字后才可部署。

---

## 13. 唯一下一步

把本报告交 ChatGPT 复审；复审通过前不进入 M6、不部署、不执行 Git commit/push、不创建任何生产资源。
