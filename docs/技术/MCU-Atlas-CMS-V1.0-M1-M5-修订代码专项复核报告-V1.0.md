# MCU Atlas CMS V1.0 · M1–M5 修订代码专项复核报告 V1.0

| 项 | 值 |
|---|---|
| 日期 | 2026-11-10 |
| 执行方 | CodeBuddy（开发） |
| 性质 | 本地只读审查 + 必要的隔离测试补充 + 最小修复 |
| 基线 | V2.1、M1–M5 交付报告、审查问题修订报告 V1.0 |
| 结论 | 发现并修复 **13 项**代码/设计缺陷 + **1 项**防御性加固；新增 18 项断言，原 177 项保留 |
| 全量回归 | 13 套件 / **195 项全部通过**；端到端自检 I1–I6 全 true |
| 生产动作 | **零**：未登录服务器、未创建用户/服务/spool、未改 Nginx/证书/线上 H5/Sitemap、未 Git commit/push |
| 后续 | 最终补证与安全审计见 `docs/技术/MCU-Atlas-CMS-V1.0-M1-M5-最终补证与安全审计报告-V1.0.md`（205/205） |

**等级声明**

| 级别 | 本轮结论 |
|---|---|
| 已实现 | 是（修复均落在本地代码） |
| 本地测试通过 | 是（195/195） |
| 隔离环境验证通过 | 部分（spool / 备份恢复为模型级；非真实 systemd / 非真实 root） |
| 真实服务器验证通过 | **否**（未登录服务器） |
| 正式生产上线 | **否** |

---

## 1. 审查方法与范围

- 逐行阅读：`build.cjs`、`templates.cjs`、`removals.cjs`、`link-check.cjs`、`sitemap-xml.cjs`、`generate-sitemap.cjs`、`spool-sim.cjs`、`backup.cjs`、`media.cjs`、`exif.cjs` 及相关测试。
- 用构造输入验证边界：非法 XML 字段、基础 URL 移除、0 文章构建、sitemap 缺失、重复触发、硬链接请求、恢复中断、嵌套媒体篡改、APP13/COM、半成品文件。
- 只在 `mcu-cms/` 与 `h5/tools/generate-sitemap.cjs` 内修改；未触碰线上页面。

---

## 2. 实际发现的问题

### P0-1 下架桩页与内链一致性

**结论：未发现新的 P0 缺陷。** 上一轮修复（200 桩页、noindex、自指 canonical、无 Article LD、下架链接 BLOCK、Sitemap 自动移除）经本轮 4 项新增边界测试复核通过：

- published → unpublished / archived 同批处理；
- 多篇批量下架（4 篇桩页累加）；
- 列表页 / 分类页 / 分页页无残留链接，分页真实缩减；
- 直接改库删除文章 → 下一批构建 `SITEMAP_URL_REMOVED_UNEXPECTED` 阻断；
- 桩页自身引用分类/列表入口不产生误报（空分类回退 `/article/`）。

新增测试：`tests/removed-pages.test.cjs`（4 项）。

### P0-2 Sitemap 完整性

#### F-01 严重 · `--check` 只校验 loc，不校验 loc 之外的字段

**原始证据**：`h5/tools/generate-sitemap.cjs` 修订前 `checkXmlStructure()` 仅检查 XML 声明、`urlset` 根、收尾、script、DOCTYPE；`readLocList()` 用正则扫描任意 `<loc>`。`app/build/build.cjs` 修订前第 481–487 行同样只做根/收尾/script 检查。

**风险**：`<url><loc>x</loc><lastmod>2026-01-01</lastmod></url>`、`<url priority="1">`、`<urlset foo="1">`、额外 `<loc>` 等都能 PASS；只校验数量和顺序无法发现字段级篡改。

**修复**：
- 新增 `app/build/sitemap-xml.cjs`：严格解析 `urlset → url → loc`，拒绝属性、`lastmod`/`changefreq`/`priority`、额外节点、未转义 `&<>"`、非本站/含 `..` 的 loc。
- 工具内置同规则 `parseStrictSitemap()`；`--check`、`--prev`、生成后自检全部走严格解析。
- 构建侧改用严格解析器，错误码仍为 `SITEMAP_XML_INVALID`，message 带具体原因。

#### F-02 严重 · `--allow-remove` 可触碰基础 76 条

**原始证据**：工具修订前 `const allowRemove = new Set(readUrlList(...))` 后直接用于 `missingPrev` 过滤，未限制 URL 范围。

**风险**：基础页（首页、路线、作品、专题、资讯等）可被列入白名单后移除，违反 V2.1“基础 URL 顺序保留”。

**修复**：`--allow-remove` 的每一项必须以 `https://www.mcuatlas.xyz/article/` 开头，否则 exit 1；构建侧分类器也始终把非 `/article/` 的消失判为 `unknown → BLOCK`。

#### F-03 防御性加固（非已发生缺陷）· 构建对 `extraUrls` 非空的隐式依赖

**原始证据**：`build.cjs` 修订前 `if (extraUrls.length) { spawnSync(...) }`。当前 `indexableUrls` 初始包含 `/article/`，因此 0 文章时仍为 1，原代码可正常运行（0 文章实测 77 条 URL），**不构成实际故障**。

**加固**：改为无条件运行 sitemap 工具；`--extra` 仅在清单非空时传入；`--min-count` 始终使用 `expectedAll.length`，避免未来列表页策略变化时静默缺产物。

#### F-04 高 · h5/sitemap.xml 缺失时基础段为空，导致全量误报

**原始证据**：`build.cjs` 修订前 `const baseUrls = readLocs(prevSitemap)...`；若文件不存在，`expectedAll=extraUrls`，随后工具生成的 76 条基础 URL 全部被判 `SITEMAP_UNEXPECTED_URL`。

**修复**：基础段为空时，先用唯一工具生成一份 base-only 临时文件作为期望基线；失败则 `SITEMAP_BASE_UNAVAILABLE` BLOCK。

#### F-05 中 · extra 含 XML 特殊字符会在严格自检时失败

**修复**：`validateExtra` 直接拒绝 `& < > " '`，避免“写入成功但自检失败”或转义歧义。

### P1-1 spool 消费模型

#### F-06 高 · 第三次重复触发因 duplicate 文件已存在而崩溃

**原始证据**：`spool-sim.cjs` 修订前：
```js
const dup = path.join(spool.done, req.id + '.req.duplicate');
fs.renameSync(file, dup);
```
第二次重复生成 `.duplicate`，第三次 rename 到同名文件，Windows 抛 EEXIST，整批处理中断。

**修复**：duplicate 文件名递增（`.duplicate.1`、`.duplicate.2`…），不覆盖、不崩溃。

#### F-07 高 · `reconcile()` 不取锁

**原始证据**：修订前 `reconcile()` 直接遍历 `work/` 处理，未获取 `flock`；与 `processOnce()` 并发时会重复执行同一 work 文件。

**修复**：`reconcile()` 默认 `acquireLock`，支持 `alreadyLocked` 供调用方复用；取锁失败返回 `{locked:true, processed:[]}`。

#### F-08 高 · claim 时 rename 可能覆盖已有 work 文件（POSIX）

**原始证据**：修订前 `claimNext()` 直接 `renameSync(incoming/name, work/name)`；POSIX 下目标存在会被静默替换，旧请求丢失。

**修复**：claim 前检查 `work/name`；存在则把 incoming 移入 `failed/<id>.res`（`CLAIM_CONFLICT`），保留旧 work 文件。

#### F-09 中 · done/failed 同时存在时状态冲突

**修复**：`handleWorkFile` 先检测两者；同时存在 → `STATE_CONFLICT`，不执行 handler；成功写 done 时删除 failed，失败写 failed 时删除 done。

#### F-10 中 · 请求校验与预算缺口

**修复**：
- `submit` 限制 JSON ≤4096 B；
- `readWorkFile` 拒绝硬链接（`nlink > 1`）；
- `submit` 检查 `failed/`，禁止静默重投；
- `processOnce` 支持 `maxRuntimeMs`/`now` 预算，超时保留剩余请求，下一轮继续；
- 单轮上限仍为 10，配合设计稿新增的 timer 兜底（**未创建 unit**）。

### P1-2 M7 备份恢复

#### F-11 严重 · 先删 WAL/SHM 再换库，存在不可恢复窗口

**原始证据**：`backup.cjs` 修订前 `restoreDatabase()` 第 64–68 行：
```js
fs.copyFileSync(srcFile, tmp);
fs.rmSync(destFile + '-wal', { force: true });
fs.rmSync(destFile + '-shm', { force: true });
fs.renameSync(tmp, destFile);
```
若 rename 失败，旧主库还在，但 WAL/SHM 已删除，已提交数据丢失且无法回滚。

**修复**：旧主库与 sidecar 整体 `rename` 到 `.pre-restore-<pid>[-wal|-shm]`；换入新库；失败或 `integrity_check` 失败时整体回滚；成功保留 `.pre-restore-*` 作为人工回退点。

#### F-12 高 · 恢复后不校验，进程中断无入口

**修复**：
- 换库后只读 `verifyBackup`，失败抛 `RESTORE_VERIFY_FAILED` 并回滚；
- 新增 `recoverPreRestore(dest)`：处理“旧库已挪走、新库未换入”时被 kill 的窗口；
- `restoreDatabase` 成功返回 `pre_restore` 与 `moved_sidecars`。

#### F-13 中 · 媒体 manifest 只检查顶层额外文件

**修复**：`verifyMedia` 递归遍历所有嵌套目录，报告 missing / mismatch / extra；测试覆盖 `2026/11/...` 嵌套文件篡改、缺失、额外。

### P1-3 媒体元数据

#### F-14 中 · 原图直接写最终路径，DB 失败会留孤儿文件

**原始证据**：`media.cjs` 修订前 `fs.writeFileSync(abs, clean)` 后单独 INSERT + audit，无事务、无临时文件。

**修复**：
- 先写 `abs.tmp-<pid>`，再 `rename` 到最终路径；
- 媒体行与审计放入同一事务；事务失败删除已落盘文件；
- 测试断言媒体目录无 `.tmp-*` 残留。

**复核确认**：APP1/APP13/COM、PNG `eXIf/tEXt/zTXt/iTXt/tIME`、Orientation≠1 拒绝、WebP 含元数据拒绝、哈希基于剥离后字节、审计保留 `original_sha256/metadata_removed` 均符合预期。

---

## 3. 修复文件清单与 SHA256

> `mcu-cms/` 未纳入 Git，无修订前逐文件哈希；唯一有外部基线的是 `h5/tools/generate-sitemap.cjs`（原 `a2fabdc0…0753a5`）。

| 文件 | 字节 | SHA-256（修订后） |
|---|---:|---|
| `h5/tools/generate-sitemap.cjs` | 13,456 | `ae1678d981577dc3b401d15dad314e1abae3878ac00b73ad1ff3bbf6fd936846` |
| `mcu-cms/app/build/sitemap-xml.cjs`（新） | 1,870 | `c8c4a7f98cd6d3d4e739b1d592d05bd55271ba5a1846b9e4b0ec7bc88cefb5bd` |
| `mcu-cms/app/build/build.cjs` | 26,148 | `414b55f59893cc019ca5a101722fbd1a83afb9201e128370a53b232604446087` |
| `mcu-cms/app/publish/spool-sim.cjs` | 8,861 | `310a8b1dc50c84ca18b8aa0cf5bc8a59be436c2ca6e30e7851dce780eab63319` |
| `mcu-cms/app/publish/backup.cjs` | 8,224 | `8edb2ce83cfc7a9bfa120b954b3a2946f0784523064f0982dc0e0392010b7899` |
| `mcu-cms/app/repo/media.cjs` | 10,198 | `0daee823a7a7609c04b02a3dda76db349fa6f3758fddeda9501b74b770555ebe` |
| `mcu-cms/tests/sitemap.test.cjs` | 11,278 | `e033689f1b5fbe177eaab281c4edc7b60bf2f8c5a428754712dd50d1c770c185` |
| `mcu-cms/tests/removed-pages.test.cjs`（新） | 7,833 | `24c44f757ba5c0e0025b77482dd5bcac26d8b6f407fd5559cb392403ff583345` |
| `mcu-cms/tests/spool-sim.test.cjs` | 10,729 | `64796df7622462731bbda5423202174f7965b309e14e9c5d1a885361d73207e8` |
| `mcu-cms/tests/backup.test.cjs` | 9,861 | `88582db638e6b06a293afca2eecf726e3f624f53fd9d441956c3ae10c976f90a` |
| `mcu-cms/tests/media-exif.test.cjs` | 8,801 | `9057d4405eafdc7dc37fc99f677a701617dda4eacd45496e9856ca6cb4ce9bb6` |

同时更新：`tests/run-all.cjs`（加入 removed-pages）、`docs/M7-备份与恢复设计.md`、`docs/发布链路设计与本地模拟说明.md`、`docs/媒体EXIF处理策略.md`、`docs/change-orders/F3-Sitemap工具变更单.md`、`README`。

---

## 4. 新增测试与原始输出

| 套件 | 原有 | 新增 | 现计 | 结果 |
|---|---:|---:|---:|---|
| db | 18 | 0 | 18 | PASS |
| markdown-40 | 40 | 0 | 40 | PASS |
| api | 26 | 0 | 26 | PASS |
| build | 15 | 0 | 15 | PASS |
| removed-pages | 0 | 4 | 4 | PASS |
| seo-geo | 20 | 0 | 20 | PASS |
| sitemap | 15 | 3 | 18 | PASS |
| link-check | 7 | 0 | 7 | PASS |
| publish-sim | 11 | 0 | 11 | PASS |
| release-removal | 5 | 0 | 5 | PASS |
| spool-sim | 8 | 6 | 14 | PASS |
| backup | 6 | 5 | 11 | PASS |
| media-exif | 6 | 0（改写为更强断言） | 6 | PASS |
| **合计** | **177** | **18** | **195** | **195/195** |

### 全量原始输出

```
=== db PASS (3099 ms) ===
=== markdown-40 PASS (310 ms) ===
=== api PASS (2400 ms) ===
=== build PASS (15005 ms) ===
=== removed-pages PASS (4985 ms) ===
=== seo-geo PASS (251 ms) ===
=== sitemap PASS (7836 ms) ===
=== link-check PASS (948 ms) ===
=== publish-sim PASS (13469 ms) ===
=== release-removal PASS (4431 ms) ===
=== spool-sim PASS (19914 ms) ===
=== backup PASS (4007 ms) ===
=== media-exif PASS (1307 ms) ===

共 13 套件，失败 0 个，总耗时 77968 ms
范围声明：以上均为本地隔离测试，不代表生产环境验证通过。
```

### 端到端

```json
{
  "ok": true,
  "level": "local-isolated",
  "releases": [1, 2],
  "rolledBackTo": 1,
  "consistency": ["I1=true","I2=true","I3=true","I4=true","I5=true","I6=true"]
}
```

### 失败测试说明

本轮新增/改写过程中出现过以下失败，均已修复，未通过放宽断言：

1. `removed-pages` 直接删库：被 `REVISION_IMMUTABLE` 触发器阻止 → 测试内先禁用触发器，模拟真实绕过路径；产品代码未改。
2. `spool` 预算测试：`maxRuntimeMs=1` 在首条前即超时 → 调整为 2，验证“处理 1 条后停止”。
3. `spool` duplicate 测试：最初重复写同一路径 → 改为两次独立触发，验证 `.duplicate.1`。
4. 全量运行时 `backup` 曾被宿主的批量删除守卫（`SAFE_DELETE_BULK_CONFIRM_REQUIRED`，>500 文件）判定失败，并非产品逻辑失败；已改为每次运行独立临时目录 + 清理失败不影响结论。复跑 13/13 PASS。

---

## 5. 全量回归与原有覆盖

- 原 177 项断言保留；2 项改写为更强断言（媒体测试加入 APP13/COM 与临时文件检查；备份媒体测试改为嵌套目录），未删除、未降低。
- 新增 18 项对应明确风险：严格 XML 3 项、桩页 4 项、spool 6 项、backup 5 项。
- 端到端 I1–I6 全 true；`h5/sitemap.xml` 未变（`9ce7ffb0…c90219`），无参数工具输出仍为该 SHA。

---

## 6. 尚未解决 / 未验证

| # | 项 | 级别 | 原因 / 所需环境 |
|---|---|---|---|
| 1 | `.path` 失败后是否再次触发 | 高 | 仅能在真实 systemd 验证；已给出 timer 兜底设计，**未创建 unit** |
| 2 | spool 的 uid/st_nlink/0700 权限语义 | 高 | 本地 Windows 无法验证 Linux 权限；模型只验证了 symlink/hardlink |
| 3 | `O_NOFOLLOW`、`st_dev` 同盘校验 | 高 | 需真实 Linux helper |
| 4 | 生产恢复（停服务、systemctl、root 权限） | 高 | 本轮只做文件级；未登录服务器 |
| 5 | 恢复中断的“进程被 kill”窗口 | 中 | `recoverPreRestore` 可找回，但未在真实 kill 下演练 |
| 6 | Sitemap 严格解析器在工具/构建各一份 | 中 | 存在双实现漂移风险；目前由两套测试同时覆盖 |
| 7 | 0 文章 / h5 sitemap 缺失的构建路径 | 低 | 0 文章已手工验证；缺 sitemap 的 fallback 仅代码审查，未做完整构建 |
| 8 | EXIF 残余（ICC、未知 APPn、隐写） | 中 | 不重编码的固有限制 |
| 9 | 目标 DB 被占用测试 | 低 | 仅 Windows 可复现；Linux 需 `flock`/服务停止约束 |
| 10 | C1 证书 / C3 内存 / C5 工具签字 | 阻塞 | Owner 未决 |

---

## 7. M6 准入条件最新状态

| 条件 | 状态 |
|---|---|
| 下架桩页 + 内链扫描 | ✅ 通过（含新增 4 项） |
| Sitemap 严格结构与整表校验 | ✅ 通过（含非 loc 字段） |
| Sitemap 基础 76 条保护 | ✅ 工具 + 构建双侧 |
| spool 重复触发/残留/冲突模型 | ✅ 14/14；真实 systemd 未验证 |
| M7 备份基础件 | ✅ 11/11；生产恢复未演练 |
| 媒体元数据 | ✅ 6/6 |
| C1 证书 | ❌ 未确认 |
| C2 用户/unit/helper/权限 | ❌ 未授权 |
| C3 内存实测/降级 | ❌ 未做 |
| C5 sitemap 工具签字 | ❌ 待签（哈希 `ae1678d9…6846`） |
| ChatGPT 复审 | ❌ 本报告待审 |

**M6 不准入。** 不得进入 M6、不得部署。

---

## 8. 仍需 Owner 授权的事项

1. **C2**：创建 `mcucms` 用户、两个 unit、root helper、spool、目录权限。
2. **timer**：是否批准新增 `mcu-cms-publish.timer`（每分钟兜底），否则 `.path` 在锁冲突/失败后可能不再触发。
3. **C5**：sitemap 工具哈希已变为 `ae1678d9…6846`，需重新签字。
4. **C1**：证书续签与自动续期。
5. **C3**：内存实测窗口或降级路线。
6. **M7**：备份目录、保留份数、季度恢复演练窗口与操作人。
7. **媒体策略**：WebP 含元数据拒绝、Orientation≠1 先旋转导出。
8. **下架策略**：桩页 `noindex,follow`、Sitemap 移除、allowRemove 仅 owner + reason 的现行规则。

---

## 9. 停止声明

本轮已完成本地审查、必要修复与全量回归，**立即停止**：

- 不进入 M6；
- 不部署；
- 不创建生产用户、服务、helper、spool、目录；
- 不修改 Nginx、证书、线上 H5/Sitemap；
- 不执行 Git commit / push。
