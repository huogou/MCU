# MCU Atlas CMS V1.0 · M1–M5 最终补证与安全审计报告 V1.0

| 项 | 值 |
|---|---|
| 日期 | 2026-11-10 |
| 执行方 | CodeBuddy（开发） |
| 审核方 | ChatGPT（待复审） |
| 性质 | 本地只读审计 + 补证测试 + 最小修复 |
| 范围 | 仅 `mcu-cms/` 与 `h5/tools/generate-sitemap.cjs` |
| 结论 | 新发现 3 项 P1、2 项 P2、1 项测试环境问题；均已修复或明确记录 |
| 全量回归 | **14 套件 / 205 项全部通过**；端到端 I1–I6 全 true |
| 生产动作 | **零**：未登录服务器、未创建任何生产资源、未改线上 H5/Sitemap、未 Git commit/push |

**等级声明**

| 级别 | 结论 |
|---|---|
| 代码已实现 | 是 |
| 本地测试通过 | 是（205/205） |
| 隔离环境验证通过 | 部分（spool / 备份恢复为本地模型，不是 Linux/root/systemd） |
| 真实服务器验证通过 | **否** |
| 正式生产上线 | **否** |

---

## 1. 本轮发现的问题

| ID | 级别 | 问题 | 状态 |
|---|---|---|---|
| G-01 | **P1** | `link-check` 的 `/article/assets/*` 分支被前面的 `/article/*` 分支吞掉，构建 CSS/图片缺失永远不会报错 | 已修复 |
| G-02 | **P1** | 内链扫描未覆盖 `source[src]`、`source[srcset]`、`script[src]`、CSS `url()` | 已修复 |
| G-03 | **P1** | `restoreDatabase` 同一进程连续恢复复用 `.pre-restore-<pid>`，第二次会覆盖第一次回退点（POSIX）或直接失败（Windows） | 已修复 |
| G-04 | P2 | Sitemap 工具与构建侧两套严格解析器无一致性测试，存在漂移风险 | 已补测试 |
| G-05 | P2 | 仅扫描内联 `<style>` 与构建 `article.css` 的 `url()`；H5 共享 `style.css` 内部 `url()` 未扫描 | 记录为限制 |
| G-06 | P3 | 测试宿主的批量删除守卫（>500 文件）导致 `backup` 套件偶发假失败 | 测试隔离已修正 |

**未发现新的 P0 缺陷。** 下架桩页、Sitemap 基础保护、发布状态机本地模型均未发现新的 P0。

---

## 2. A · 下架桩页审计

### 2.1 生成与 Sitemap 移除的先后关系

`buildSite()` 的顺序（`app/build/build.cjs`）：

1. 渲染 published 正文（第 1 步）；
2. 写文章页（第 2 步）；
3. 写 `unpublished/archived` 桩页（第 2b 步）；
4. 写列表/分类/标签（第 3–5 步）；
5. 生成 `sitemap-urls.txt`（仅 `indexableUrls`，不含桩页）；
6. 调用唯一 sitemap 工具生成 `sitemap.xml`；
7. 全量校验；失败则整个 `tmp/build-<seq>` 删除并 `failed_build`；
8. 校验通过后 `rename` 到 `releases/<seq>`，再模拟切换。

**结论**：桩页与 sitemap 在同一 build 目录内产生；sitemap 生成时桩页已在 `removedSlugs`/`pageRobots` 中排除。若构建中途失败，不会移动、不会切换，旧 release 保持完整；不存在“本地已移除 sitemap、桩页却缺失”的可发布状态。

### 2.2 本地失败边界

| 失败点 | 结果 |
|---|---|
| 桩页写盘失败 | 抛错 → `buildSite` 失败 → 临时目录删除、release 不移动 |
| sitemap 工具失败 | `SITEMAP_TOOL_FAILED` BLOCK → 不移动 |
| 校验发现 noindex 入 sitemap | `SEO115` BLOCK → 不移动 |
| 移动/切换失败 | 旧软链/旧 sitemap 未改（本地指针文件仍在旧值） |
| 进程被 kill | 只有 `tmp/build-*` 残留；`releases/CURRENT` 不变 |

> 以上是**本地文件级**结论；真实 HTTP 200、Nginx 跟随软链、systemd 切换未验证。

### 2.3 所有曾发布文章是否都有桩页

查询条件：`status IN ('unpublished','archived') AND published_at IS NOT NULL`。

- 发布时写入 `published_at`；下架/归档不清空 → 有桩页。
- 从未发布的 draft/review → 无旧 URL → 不需要桩页。
- 物理删除文章（绕过 CMS）→ 无行、无桩页；下一批构建因上一 release URL 来源不明触发 `SITEMAP_URL_REMOVED_UNEXPECTED`，必须 owner `allowRemove` + reason。**不会静默 404。**
- 触发器等保护使正常 API 无法物理删除文章。

### 2.4 桩页规则（已测试）

| 项 | 实现 |
|---|---|
| HTTP 语义 | 产物为 `article/<slug>.html`；生产需 Nginx 返回 200（本轮**未验证 HTTP**） |
| robots | `noindex,follow` |
| canonical | 自指 `https://www.mcuatlas.xyz/article/<slug>` |
| Article JSON-LD | **不输出**；只输出 1 个 BreadcrumbList |
| 原正文 | 不输出；测试用唯一 marker 断言不存在 |
| 分类/列表入口 | 分类无已发布文章时回退 `/article/`，避免 404 |
| sitemap | 不收录；`indexableUrls` 不含桩页 |

### 2.5 列表/分类/分页排除

`loadContent()` 只加载 `status='published'`；列表、分类、标签、分页全部基于该集合。下架后分页会真实缩减（如 14 篇 → 12 篇，`page/2` 消失），分类页同理。测试 `removed-pages.test.cjs` 已断言列表/分类 HTML 不含下架 slug、`page/2.html` 不存在。

### 2.6 M6 沙箱 HTTP 验收清单（未执行）

| # | 请求 | 期望 |
|---|---|---|
| 1 | `GET /article/<published-slug>` | 200；`Content-Type: text/html; charset=utf-8`；正文 marker 在源码；`<meta name="robots" content="index,follow">`；canonical 自指；JSON-LD Article + Breadcrumb |
| 2 | `GET /article/<removed-slug>` | 200（**不是 404**）；`noindex,follow`；canonical 自指；无 Article JSON-LD；无原正文 marker；有“已下架/归档”提示 |
| 3 | `GET /article/<removed-slug>.html` | 与 #2 字节一致（N10 兼容） |
| 4 | `GET /article/` | 200；不含 removed slug；分页链接指向存在的文件 |
| 5 | `GET /article/page/2` | 分页仍存在时 200；缩减后 404 且 sitemap 不含 |
| 6 | `GET /article/c/<cat>` | 200；不含 removed slug；空分类不生成 |
| 7 | `GET /sitemap.xml` | 200；不含 removed slug；基础 76 条顺序不变；XML 结构严格 |
| 8 | `HEAD /article/<removed-slug>` | 200；无 `X-Robots-Tag: noindex` 冲突（以 meta 为准，若 Nginx 另加需一致） |
| 9 | `GET /article/assets/article.css` | 200；`Content-Type: text/css` |
| 10 | 关闭 JS 的浏览器 | 正文、面包屑、下架提示可读；无空白页 |

> 以上全部为 **M6 沙箱待验证**，本轮未发任何 HTTP 请求，不得写成“生产 200 已验证”。

---

## 3. B · 全站内链与资源引用扫描

### 3.1 实际覆盖（`app/build/link-check.cjs`）

| 选择器 | 是否覆盖 | 说明 |
|---|---|---|
| `a[href]` | ✅ | `H.links()` 解析 |
| `img[src]` | ✅ | `H.images()` 解析 |
| `source[src]` | ✅ | 本轮新增 |
| `source[srcset]` | ✅ | 本轮新增；按逗号取每项第一个 token，`data:` 不检查 |
| `script[src]` | ✅ | 本轮新增；内联 script 不执行、不扫描内容 |
| `link[href]` | ✅ | stylesheet/icon/canonical；canonical 是外部 https，被排除 |
| CSS `url()` | ✅（有限） | 内联 `<style>` + 构建 `article/assets/article.css`；**H5 共享 `style.css` 内部未扫描** |

### 3.2 排除与规整

- 外部 `http/https`、`mailto`、`data:`、`#anchor`、`//host`：不进入站内检查。
- `?query`、`#hash`：先剥离再比较。
- URL 编码：`decodeURIComponent` 后再匹配媒体/站内路径；非法编码按缺失处理。
- 尾斜杠：`cleanPath` 去掉一个尾 `/`；`/article/` → `/article`。
- 目录 index：`/article/c/<cat>/` 归一到无斜杠路径，由 SEO114 的 `knownPaths` 判定；不自动把 `/foo/` 映射到 `/foo.html`（保守策略）。
- 本地资源缺失：`/media/*`、`/assets/*`、`/article/assets/*`、带扩展名的 `/article/*` 全部 BLOCK。
- 扫描范围：`outDir/article` 下全部 `.html`（walk + 去重），包含文章、桩页、列表、分类、分页、标签、`page/index.html`。

### 3.3 本轮修复

**G-01**：原顺序先判断 `decoded.startsWith('/article/')` 并 `continue`，导致后面的 `/article/assets/` 分支不可达。构建 CSS 缺失、文章内 `/article/assets/x.png` 缺失都不会报错。已把 `/article/assets/` 提前，并对带扩展名的 `/article/*` 检查 `outDir` 落盘。

**G-02**：新增 `source`/`script`/`srcset`/CSS `url()`；CSS 相对 URL 以 CSS 文件所在目录解析（`../img/x.png` → `/article/img/x.png`），并检查构建产物。

### 3.4 测试

`tests/link-check.test.cjs` 10/10：

- 下架链接、媒体记录缺失、媒体文件缺失；
- 静态资源/站内页面缺失；
- source/script/link 四个缺失资源；
- 内联 style 与 CSS 文件 `url()`；data/http 忽略；
- URL 编码中文媒体、query/hash、尾斜杠；
- 合法链接/外部/mailto/锚点不误报；
- 消失分类。

**限制（G-05）**：H5 共享 `style.css` 的 `url()` 未扫描；它属于既有线上 CSS，若纳入会产生跨项目噪声，需 Owner 决定是否扩展。

---

## 4. C · Sitemap 双实现一致性

### 4.1 实现位置

- 构建：`mcu-cms/app/build/sitemap-xml.cjs` 的 `parseSitemapXml()`。
- 工具：`h5/tools/generate-sitemap.cjs` 内的 `parseStrictSitemap()`。
- 两者规则相同：只允许 `urlset → url → loc`；拒绝属性、额外字段、未转义 `&<>"`、非本站、`..`、空 loc、非白名单尾部内容。

### 4.2 一致性测试

`tests/sitemap-parity.test.cjs` 6/6：同一组样例分别跑工具 `--check` 与构建解析器，接受/拒绝一致。

| 样例 | 工具 | 构建解析器 |
|---|---|---|
| 合法基础 sitemap | 接受 | 接受 |
| 合法注释 | 接受 | 接受 |
| 根属性 `foo="1"` | 拒绝 | 拒绝 |
| `lastmod` | 拒绝 | 拒绝 |
| `priority` | 拒绝 | 拒绝 |
| 未转义 `&` | 拒绝 | 拒绝 |
| 外域 loc | 拒绝 | 拒绝 |
| `..` 路径 | 拒绝 | 拒绝 |
| 缺 `</urlset>` | 拒绝 | 拒绝 |

### 4.3 能力边界（必须如实说明）

- `--check` **不带 `--extra`**：只能验证基础 76 条顺序 + 结构 + extra 区“全部 `/article/` 且严格升序”。它**无法知道本次构建的权威 CMS URL 集合**，因此无法发现“extra 被替换成另一条合法 `/article/` URL”。
- 测试已证明：一个含伪造 extra 的完整 sitemap 在不带 `--extra` 时 PASS；带 `--extra` 的不同清单时 FAIL。
- 完整整表校验由 CMS 构建负责（`expectedAll` 双向比对 + `SITEMAP_EXTRA_ORDER` + `SITEMAP_DUP`）。
- 重复 loc：工具 `--check` 直接拒绝；构建解析器本身不管重复，由 `SITEMAP_DUP` 在上层拒绝。
- 基础 76 条：工具 `--allow-remove` 拒绝非 `/article/` URL；构建分类器对基础消失始终 `unknown → BLOCK`。

**保留双实现**：生产部署位置不同（工具在 `app/tools/`，构建在 `app/build/`），强行合并会引入相对路径耦合。已用 parity 测试锁定行为；漂移风险仍在（新增样例时两边都要跑）。

---

## 5. D · SQLite 恢复流程审计

### 5.1 逐项结论

| 检查项 | 结论 |
|---|---|
| 恢复前禁止并发写入 | **代码未强制**。`restoreDatabase` 不做锁/连接检测；必须由调用方先 `systemctl stop mcu-cms`。Windows 下打开中的 DB 会因文件占用失败；Linux 下 `rename` 可成功，旧进程会继续写已 unlink 的 inode，**必须停服务**。列为 M6 阻塞前置 |
| 主库与 WAL/SHM 顺序 | 先把旧主库、`-wal`、`-shm` 逐个 `rename` 到 `.pre-restore-*`，再换入新库；不再“先删 sidecar” |
| 同一文件系统 | 临时文件 `dest.restore-<pid>`、pre、目标都在 `dest` 同目录；跨盘备份通过 `copyFile` 读入本地临时文件 |
| integrity 失败回滚 | 换库后只读 `verifyBackup`；失败抛 `RESTORE_VERIFY_FAILED`，删除新库并把旧主库 + sidecar 改回 |
| `recoverPreRestore` | 仅处理 `dest` 缺失；找最近 `.pre-restore-*` 主库及 sidecar 整体改回；`dest` 已存在时返回 `left_for_manual`，不自动覆盖 |
| 重复恢复 | 已修复：pre 路径加序号，连续两次恢复保留两个回退点 |
| 进程中断状态 | 见下表 |

### 5.2 中断点与状态

| 中断点 | 磁盘状态 | 恢复动作 |
|---|---|---|
| 校验源备份前 | 无变化 | 重新执行 |
| 复制临时文件后、移动旧库前 | 多一个 `.restore-*` | 删除临时文件即可 |
| 移动旧主库后、移动 sidecar 前 | `dest` 缺失；pre 主库 + 原 sidecar | `recoverPreRestore` 把 pre 主库改回；sidecar 仍在原处 |
| 移动全部旧库后、换入新库前 | `dest` 缺失；pre 主库 + pre sidecars | `recoverPreRestore` 全部改回 |
| 换入新库后、verify 前 | `dest` = 新库；pre 全套存在 | `recoverPreRestore` 返回 `left_for_manual`；人工 verify 或回滚 |
| verify 后成功 | 新库 + pre 全套 | 起服务、跑 I1–I6；确认后删除 pre |
| 回滚中途再失败 | 可能残留 pre | 人工按 `.pre-restore-*` 处理；代码抛 `ROLLBACK_FAILED` |

### 5.3 故障注入测试

`tests/backup.test.cjs` 12/12：

- WAL 快照、备份后修改不影响备份；
- 恢复中断（`before_swap`）完整回滚；
- 恢复后 `integrity_check` 失败自动回滚；
- 连续两次恢复不覆盖 pre；
- 进程中断后 `recoverPreRestore` 找回；
- 嵌套媒体缺失/篡改/多余；
- 损坏备份拒绝；
- Windows 目标被占用时失败且旧库不被破坏（其他平台 SKIP）。

### 5.4 未验证（Linux / 生产）

- `rename` 覆盖打开中文件、`fsync` 持久性、目录 fsync。
- systemd stop 后是否真的无写入（SQLite 连接池/后台任务）。
- `/www/backup` 权限、root 操作、跨盘复制。
- 真实 kill -9 时点注入（本地用 `failAt` 模拟）。

以上全部列为 M6 沙箱项，**不得**用本地测试替代。

---

## 6. E · spool 安全边界

| 项 | 模型（`spool-sim.cjs`） | 真实 systemd/Linux |
|---|---|---|
| 锁获取/释放 | `open('wx')` + 陈旧锁回收；`finally` 释放 | 需 `flock` 非阻塞 + `exit 75`；未验证 |
| claim 冲突 | 目标存在 → `CLAIM_CONFLICT`，不覆盖 | 同文件系统 `rename`；未验证 |
| 重复触发 | 同一 id 只执行一次；duplicate 文件递增 | `.path` 是否重触发未验证 |
| failed/done/work | 互斥；`STATE_CONFLICT` 不执行 | 需 root 目录 0700；未验证 |
| 请求大小 | submit ≤4096 B；读时再校验 | 需 `fstat` size ≤4096；未验证 |
| 硬链接/符号链接 | 两者均拒绝 | 需 `O_NOFOLLOW` + `st_nlink==1` + uid；未验证 |
| 单轮预算 | `max=10` + `maxRuntimeMs`；剩余留 incoming | `RuntimeMaxSec=60`；未验证 |
| timer | **未创建**，仅设计稿 | 待 Owner 授权 |
| root helper | **未创建** | 需 uid、0700、同盘 `st_dev`、路径白名单；未验证 |

**结论**：模型 14/14 通过，只证明消费协议与幂等假设；不证明 systemd、root、Linux 文件系统语义。

---

## 7. F · 媒体隐私说明

已实现：

- JPEG 删除 APP1（Exif/XMP）、APP13（IPTC）、COM；保留 JFIF/ICC/像素数据。
- PNG 删除 `eXIf`、`tEXt`、`zTXt`、`iTXt`、`tIME`；保留 IHDR/IDAT/IEND/ICC/pHYs。
- WebP 含 EXIF/XMP → 拒绝，不做 RIFF 重写。
- Orientation≠1 → 拒绝，要求先旋转导出。
- 哈希/文件名基于剥离后字节；审计记录 `original_sha256`、`metadata_removed`；文件临时写 + rename；DB 事务失败删除文件。

**未覆盖（不得宣称彻底清除）**：

- ICC 色彩配置、未知 APPn（APP2/APP4…）可能含设备/软件信息。
- 像素级水印、隐写、缩略图残留（本轮不重编码）。
- 文件系统时间戳、备份副本中的原始文件（若运维另行保留）。
- 不是取证级清洗；对抗刻意构造文件无保证。

当前策略保持零依赖、零付费服务、不重编码像素。

---

## 8. 修改文件与 SHA-256

> 本轮仅修改以下文件；未列出的文件未改动，不得虚构哈希变化。`mcu-cms/` 未纳入 Git，无“修改前”哈希。

| 文件 | 字节 | SHA-256（修改后） | 原因 |
|---|---:|---|---|
| `h5/tools/generate-sitemap.cjs` | 13,456 | `ae1678d981577dc3b401d15dad314e1abae3878ac00b73ad1ff3bbf6fd936846` | 严格 XML、基础保护、extra 特殊字符 |
| `mcu-cms/app/build/sitemap-xml.cjs`（新） | 1,870 | `c8c4a7f98cd6d3d4e739b1d592d05bd55271ba5a1846b9e4b0ec7bc88cefb5bd` | 构建侧严格解析 |
| `mcu-cms/app/build/build.cjs` | 26,288 | `b61b28a4feee253d3447ad960c43acac459a5d8f364abc5b72b6416a5e530091` | 严格校验/缺失基线/兜底/CSS 扫描 |
| `mcu-cms/app/build/link-check.cjs` | 6,127 | `5f9517f740d89af1cef743896bd68d89ee81536ff8b7815f606279ab6d39191b` | `/article/assets` 顺序、source/srcset/script/CSS url |
| `mcu-cms/app/publish/spool-sim.cjs` | 8,861 | `310a8b1dc50c84ca18b8aa0cf5bc8a59be436c2ca6e30e7851dce780eab63319` | 重复触发/锁/claim/冲突/硬链接/预算 |
| `mcu-cms/app/publish/backup.cjs` | 8,520 | `f78f4b3c9c4fe010d940d2080d6ac13d39562eb058e5cbaf6a617ed0925d0364` | 恢复顺序/pre 唯一/递归媒体 |
| `mcu-cms/app/repo/media.cjs` | 10,198 | `0daee823a7a7609c04b02a3dda76db349fa6f3758fddeda9501b74b770555ebe` | 原子写 + 事务清理 |
| `mcu-cms/tests/link-check.test.cjs` | 7,465 | `c3a825eb46c5470f110447ec3d25483befa2bc01dcbd8b106afabb3867d5e471` | 资源选择器/CSS/编码测试 |
| `mcu-cms/tests/sitemap-parity.test.cjs`（新） | 4,617 | `f4d70360367e455559cf55fda9282378dd022ca45c7adae1b7a6f6f2e0b19ad3` | 双实现一致性/能力边界 |
| `mcu-cms/tests/backup.test.cjs` | 10,500 | `3589a1add56f8d1069b4fcdd682bc41595ab7d23934b7eb5014aacbc0e7b6064` | 中断/连续恢复/占用 |
| `mcu-cms/tests/run-all.cjs` | 2,160 | `e4ff77bd6fa51d4d86d5c0a14dd40bfe979c1bc7136f52a86cd66d8aed128419` | 加入 parity 套件 |

说明：`backup.test.cjs` 因宿主的批量删除守卫改为独立临时目录，属于测试环境适配，不改变产品断言。

---

## 9. 全量测试结果（原始输出）

`node mcu-cms/tests/run-all.cjs`：

```
=== db PASS (3047 ms) ===
=== markdown-40 PASS (333 ms) ===
=== api PASS (2367 ms) ===
=== build PASS (14013 ms) ===
=== removed-pages PASS (6438 ms) ===
=== seo-geo PASS (421 ms) ===
=== sitemap PASS (11122 ms) ===
=== sitemap-parity PASS (5539 ms) ===
=== link-check PASS (2110 ms) ===
=== publish-sim PASS (1943 ms) ===
=== release-removal PASS (3114 ms) ===
=== spool-sim PASS (19824 ms) ===
=== backup PASS (5223 ms) ===
=== media-exif PASS (1440 ms) ===

共 14 套件，失败 0 个，总耗时 65956 ms
范围声明：以上均为本地隔离测试，不代表生产环境验证通过。
```

端到端：`node mcu-cms/app/tools/e2e.cjs` → `ok:true`，I1–I6 全 true，`level=local-isolated`。

失败记录：

- 本轮开发中 `link-check` 的 CSS 用例先暴露 G-01（`/article/assets` 分支不可达），修复后通过。
- 全量首次运行 `backup` 因宿主批量删除守卫（>500 文件）失败，非产品逻辑；改为独立临时目录后 14/14 PASS。

原有 195 项全部保留；新增 10 项（link +3、parity +6、backup 连续恢复 +1），总计 205。

---

## 10. 未修复 / 未验证

| # | 项 | 级别 | 原因 |
|---|---|---|---|
| 1 | 恢复时无代码级写锁 | P1 | 必须由 systemd 停服务；M6 沙箱验证 |
| 2 | `.path` 失败后不保证重触发 | P1 | 需 timer（未授权、未创建） |
| 3 | 真实 systemd/root/spool/软链 | P1 | 无 Linux root 环境 |
| 4 | Sitemap 双实现漂移 | P2 | 已加 parity；新增规则需两边同步 |
| 5 | H5 共享 CSS `url()` 未扫描 | P2 | 跨项目噪声，需 Owner 决定 |
| 6 | `--check` 无 `--extra` 的能力边界 | P2 | 只能做基础段 + extra 卫生，不能替代构建整表校验 |
| 7 | EXIF ICC/未知 APPn/隐写 | P2 | 不重编码的固有限制 |
| 8 | Linux `rename`/`fsync`/kill 时点 | P2 | 需 M6 沙箱 |
| 9 | C1/C2/C3/C5 | 阻塞 | Owner 未决 |

---

## 11. M6 尚未满足的准入条件

| 条件 | 状态 |
|---|---|
| 下架桩页 + 内链 | ✅ 本地通过；HTTP 未验证 |
| Sitemap 严格结构 + 基础保护 | ✅ 本地通过 |
| 双实现一致性 | ✅ 6/6（样例集） |
| spool 模型 | ✅ 14/14；真实 systemd 未验证 |
| M7 备份基础件 | ✅ 12/12；生产恢复未演练 |
| 媒体元数据 | ✅ 6/6；ICC/APPn/隐写未覆盖 |
| C1 证书 | ❌ |
| C2 用户/unit/helper/spool/权限 | ❌ |
| C3 内存实测/降级 | ❌ |
| C5 sitemap 工具签字 | ❌（`ae1678d9…6846`） |
| M6 沙箱 HTTP 清单 | ❌ 未执行 |
| ChatGPT 复审 | ❌ 本报告待审 |

**M6 不准入。**

---

## 12. 需要 Owner 授权

1. C2：`mcucms` 用户、两个 unit、root helper、spool、目录权限。
2. timer：是否批准 `.path` + `.timer` 双触发（本轮未创建）。
3. C5：sitemap 工具哈希重新签字。
4. C1：证书续签/自动续期。
5. C3：内存实测窗口或降级路线。
6. M7：备份目录、保留份数、恢复演练窗口。
7. G-05：是否把 H5 共享 CSS 的 `url()` 纳入扫描。
8. 媒体：WebP 元数据拒绝、Orientation 预处理策略。

---

## 13. 是否存在新的 P0/P1 风险

- **新 P0：无。**
- **新 P1：G-01、G-02、G-03，均已修复并测试。**
- 残余 P1 均为环境/授权类：恢复写锁依赖停服务、`.path` 重触发依赖 timer、真实 systemd/root 未验证。

---

## 14. 停止声明

本轮完成审计、补证测试与最小修复后立即停止：

- 不进入 M6；
- 不部署、不创建 timer/unit/helper/spool/用户；
- 不登录服务器、不修改线上 H5/Sitemap/Nginx/证书；
- 不执行 Git commit/push。

等待 ChatGPT 复审。
