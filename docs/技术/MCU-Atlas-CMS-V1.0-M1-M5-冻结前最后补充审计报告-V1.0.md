# MCU Atlas CMS V1.0 · M1–M5 冻结前最后补充审计报告 V1.0

| 项 | 值 |
|---|---|
| 日期 | 2026-11-10 |
| 执行方 | CodeBuddy（开发） |
| 性质 | 本地只读审计 + 文档补充（**本轮无代码修改**） |
| 范围 | `mcu-cms/`、`h5/tools/generate-sitemap.cjs`（本轮未改） |
| 结论 | SQLite 恢复入口无当前暴露路径；共享 CSS 当前无内部资源依赖；**G-01/G-02/G-03 为上一轮修复后的复查确认，无回归** |
| 全量回归 | **14 套件 / 205 项全部通过**；端到端 I1–I6 全 true |
| 生产动作 | **零**：未登录服务器、未创建用户/unit/timer/helper/spool、未改线上 H5/Sitemap/Nginx、未 Git commit/push |

---

## 一、SQLite 恢复安全补充结论

完整手册：`mcu-cms/docs/SQLite恢复调用约束与人工恢复操作手册.md`

### 1. 调用入口与暴露风险

- `restoreDatabase` / `recoverPreRestore` 仅定义在 `mcu-cms/app/publish/backup.cjs`。
- **当前无 HTTP API、无后台任务、无 CMS 请求路径调用**：`app/server.cjs`、`app/api/index.cjs`、`app/publish/release.cjs`、`app/tools/*` 均未 require `backup.cjs`；只有 `tests/backup.test.cjs` 调用。
- 允许调用者：人工维护窗口（本地 shell / SSH，按手册）；M7 专用恢复脚本（尚未创建，需授权）。
- 禁止：`/cms/api/*`、`mcu-cms.service` 业务进程、spool helper、定时任务、队列消费者。
- **判断**：当前不存在“普通 API 误调用”的实际路径；风险是未来新增调用。最小建议（本轮未实施）：若新增 CLI，加 `--confirm-restore`；不要把恢复函数挂到 HTTP 或 spool。

### 2. 恢复前置条件（调用方保证，不是代码强制）

必须停止：

1. `mcu-cms.service` 与手工 `node app/server.cjs`；
2. 所有调用 CMS DB 的脚本（seed/init-admin/register-media/e2e/tests）；
3. M6 发布 path/service/timer（若存在）；
4. SQLite CLI/DB 浏览器/备份脚本。

确认无活动连接（M6/M7 Linux）：

```bash
systemctl stop mcu-cms
systemctl is-active mcu-cms
ss -ltnp | grep 8790
pgrep -a node | grep -E 'mcu-cms|server.cjs'
lsof /www/wwwroot/mcu-cms/data/cms.db
lsof /www/wwwroot/mcu-cms/data/cms.db-wal
lsof /www/wwwroot/mcu-cms/data/cms.db-shm
```

以上均应无输出。Windows 的文件占用失败**不能**当作生产锁证明。

### 3. 代码已实现 / 依赖调用方 / M6 / M7

| 能力 | 代码已实现 | 调用方保证 | M6 Linux 沙箱 | M7 生产演练 |
|---|---|---|---|---|
| 备份只读校验 + integrity_check | ✅ | — | — | 复跑 |
| 同目录临时文件 | ✅ | 目录可写 | — | — |
| 旧主库 + WAL/SHM 整体挪移 | ✅ | 已停服务 | `rename` 语义 | ✅ |
| 换库后再次 verify | ✅ | — | — | ✅ |
| 失败自动回滚 | ✅ | 磁盘可写 | ✅ | ✅ |
| 连续恢复 pre 不覆盖 | ✅ | — | — | — |
| `recoverPreRestore` | ✅ | 人工选择 pre | ✅ | ✅ |
| 阻止 API 误调用 | ❌（无路由，靠架构约束） | 代码评审 | — | — |
| 阻止并发写入 | ❌ | **必须停服务** | 验证无连接 | ✅ |
| `ROLLBACK_FAILED` 处理 | ❌（只报错） | 人工 | ✅ | ✅ |
| 断电/fsync 持久性 | ❌ | — | ✅ | ✅ |

### 4. 替换顺序与恢复后检查

顺序：`verify src` → 复制到 `dest.restore-<pid>` → 旧 `cms.db`/`-wal`/`-shm` 改名为 `.pre-restore-<pid>[-n]` → 换入新库 → 只读 `verifyBackup(dest)` → 失败回滚。

恢复后必须：`integrity_check=ok` → 媒体 manifest ok → 当前 release 目录存在 → sitemap SHA 一致 → I1–I6 全 true → HTTP 冒烟。全部通过才允许启动服务。

`.pre-restore-*` 仅在服务稳定、I1–I6 持续 true、已有新可验证备份、Owner 确认后才允许清理。

### 5. 状态处理

- `left_for_manual`：dest 与 pre 并存；先 verify dest，好则继续检查，坏则人工把 pre + sidecar 改回。
- `ROLLBACK_FAILED`：停止，不启动，不删除任何文件；保留现场，用已知可用备份重新恢复。
- 其它 `BACKUP_INVALID` / `DEST_EXISTS` / `RESTORE_VERIFY_FAILED` 的处理见手册。

**结论**：代码级恢复逻辑已实现并有本地故障注入；**“无并发写入”仍完全依赖人工停服务**，未在 Linux 验证，属于 M6 阻塞项。

---

## 二、共享 CSS 资源依赖审计结论

### 1. 实际构建产物引用

从 `tmp/e2e-releases/000001/article/e2e-article.html` 实测：

```html
<link rel="stylesheet" href="/assets/css/style.css">
<link rel="stylesheet" href="/article/assets/article.css">
```

- 路径：`/assets/css/style.css`（绝对路径，来自 H5 根）。
- `/article/assets/article.css` 由 CMS 构建写入 release。

### 2. 资源归属

| 文件 | 是否 CMS 构建产物 | 位置 | 责任 |
|---|---|---|---|
| `/assets/css/style.css` | **否** | `h5/assets/css/style.css`（77,597 B，SHA `38d4c7eb…6471`） | H5 基线/发布流程 |
| `/article/assets/article.css` | **是** | release 内 `article/assets/article.css`（3,059 B，SHA `72b992b8…b914`） | CMS 构建 |

### 3. 内部资源依赖

- `h5/assets/css/style.css`：`url(`、`@import`、`@font-face`、`src:` 匹配数均为 **0**；无本地图片/字体/其他 CSS 依赖。
- `article.css`（`templates.ARTICLE_CSS`）：`url()`/`@import` 匹配数为 **0**。
- 因此当前不存在“共享 CSS 内部资源缺失”的实际风险。

### 4. 检查责任

- CMS 构建的 `link-check` 会检查 `<link href="/assets/css/style.css">` 的目标文件是否存在于 `h5Dir`；缺失 → `LINK_ASSET_MISSING` BLOCK。
- CMS 构建会扫描自身 `article/assets/article.css` 的 `url()`（上一轮已接入 `cssFiles`，本轮复查未改）。
- **H5 共享 CSS 的内部 `url()` 不由 CMS 负责**；若未来 `style.css` 增加图片/字体，应由 H5 构建/发布回归或独立检查负责。

### 5. 结论

**CMS 当前不需要扫描共享 CSS 内部 `url()`**：

1. 当前 `style.css` 无内部资源引用；
2. 它不属于 CMS 发布产物，CMS 只负责引用存在性；
3. 强行扫描会把 H5 既有资源纳入 CMS 构建责任，扩大范围且产生跨项目噪声。

**未来最小改动（仅建议，不实施）**：若 `style.css` 新增 `url()`，在 `app/build/build.cjs` 的 `cssFiles` 中增加一项 `{ file: path.join(h5Dir,'assets/css/style.css'), url:'/assets/css/style.css' }` 即可复用现有扫描；或由 H5 侧做同样检查。本轮不扩大扫描范围。

**残余风险**：CMS 构建通过后，若 H5 单独发布删除/替换 `style.css`，CMS 页面会失去样式；这属于 H5 发布治理，不是 CMS 构建缺陷。

---

## 三、是否有新增代码修改

**没有。** G-01/G-02/G-03 已在上一份《MCU Atlas CMS V1.0 · M1–M5 最终补证与安全审计报告 V1.0》中发现并修复；本轮为**修复后的复查确认**，未再次修改代码，未发生回归。

### 3.1 复查确认的上一轮修复

| ID | 问题 | 上一轮修复 | 本轮复查 |
|---|---|---|---|
| G-01 | `link-check` 的 `/article/assets/*` 分支被 `/article/*` 先 `continue` 吞掉，构建 CSS/图片缺失不报错 | 调整分支顺序；带扩展名的 `/article/*` 按构建资源检查落盘 | 代码仍为修复后逻辑；link-check 10/10 |
| G-02 | 内链未覆盖 `source[src]`、`source[srcset]`、`script[src]`、CSS `url()` | 新增解析；CSS 相对路径按 CSS 文件目录解析；构建 `article.css` 纳入 `cssFiles` | 覆盖项与测试仍存在；无回归 |
| G-03 | `restoreDatabase` 同一进程连续恢复复用 `.pre-restore-<pid>`，覆盖回退点 | pre 路径加序号，保留每一份回退点 | 连续恢复测试仍通过；无回归 |

### 3.2 上一轮修复文件的当前版本（本轮未修改）

| 文件 | 字节 | SHA-256 | 原因 |
|---|---:|---|---|
| `mcu-cms/app/build/link-check.cjs` | 6,127 | `5f9517f740d89af1cef743896bd68d89ee81536ff8b7815f606279ab6d39191b` | G-01/G-02 |
| `mcu-cms/app/build/build.cjs` | 26,288 | `b61b28a4feee253d3447ad960c43acac459a5d8f364abc5b72b6416a5e530091` | 传入 CSS 扫描清单 |
| `mcu-cms/app/publish/backup.cjs` | 8,520 | `f78f4b3c9c4fe010d940d2080d6ac13d39562eb058e5cbaf6a617ed0925d0364` | G-03 |
| `mcu-cms/tests/link-check.test.cjs` | 7,465 | `c3a825eb46c5470f110447ec3d25483befa2bc01dcbd8b106afabb3867d5e471` | 新增 source/script/CSS/编码用例 |
| `mcu-cms/tests/sitemap-parity.test.cjs`（新） | 4,617 | `f4d70360367e455559cf55fda9282378dd022ca45c7adae1b7a6f6f2e0b19ad3` | 双实现一致性 |
| `mcu-cms/tests/backup.test.cjs` | 10,500 | `3589a1add56f8d1069b4fcdd682bc41595ab7d23934b7eb5014aacbc0e7b6064` | 连续恢复/中断 |
| `mcu-cms/tests/run-all.cjs` | 2,160 | `e4ff77bd6fa51d4d86d5c0a14dd40bfe979c1bc7136f52a86cd66d8aed128419` | 加入 parity |
| `mcu-cms/docs/SQLite恢复调用约束与人工恢复操作手册.md`（新） | — | — | 本任务文档 |

**未修改**：`h5/tools/generate-sitemap.cjs` 保持 `ae1678d9…6846`；线上 H5/Sitemap/Nginx/证书均未动。

---

## 四、全量测试结果

`node mcu-cms/tests/run-all.cjs` → **14 套件 / 205 项全部通过**：

```
=== db PASS (2864 ms) ===
=== markdown-40 PASS (326 ms) ===
=== api PASS (2355 ms) ===
=== build PASS (7825 ms) ===
=== removed-pages PASS (5601 ms) ===
=== seo-geo PASS (332 ms) ===
=== sitemap PASS (9161 ms) ===
=== sitemap-parity PASS (5754 ms) ===
=== link-check PASS (1233 ms) ===
=== publish-sim PASS (2418 ms) ===
=== release-removal PASS (3210 ms) ===
=== spool-sim PASS (18403 ms) ===
=== backup PASS (5139 ms) ===
=== media-exif PASS (1333 ms) ===

共 14 套件，失败 0 个，总耗时 65956 ms
范围声明：以上均为本地隔离测试，不代表生产环境验证通过。
```

- 端到端：`ok:true`，I1–I6 全 true，`level=local-isolated`。
- 无参数 sitemap 输出仍为 `9ce7ffb0…c90219`。
- 上一轮新增测试：link +3、parity +6、backup 连续恢复 +1；原 195 项保留，总计 205。本轮无代码/测试修改，仅做回归确认。

---

## 五、仍未满足的 M6 准入条件

| 条件 | 状态 |
|---|---|
| 下架桩页 / 内链 / Sitemap | ✅ 本地通过；HTTP 未验证 |
| 恢复安全代码逻辑 | ✅ 本地通过；**无代码级写锁** |
| 真实 systemd/root/spool/软链 | ❌ 未验证 |
| timer 兜底 | ❌ 未授权、未创建 |
| 生产备份/恢复演练 | ❌ 未执行 |
| M6 沙箱 HTTP 清单 | ❌ 未执行 |
| C1 证书 | ❌ |
| C2 用户/unit/helper/权限 | ❌ |
| C3 内存实测/降级 | ❌ |
| C5 sitemap 工具签字 | ❌（`ae1678d9…6846`） |
| ChatGPT 复审 | ❌ 本报告待审 |

**M6 仍不准入。**

---

## 六、新的 P0/P1 风险

- **本轮新 P0：无；本轮新 P1：无。**
- G-01、G-02、G-03 属上一轮 P1，已在上一轮修复；本轮复查无回归。
- 残余 P1：恢复前无代码强制写锁（依赖停服务）、`.path` 重触发依赖未创建的 timer、真实 Linux/systemd 未验证。

---

## 七、等级声明

- 代码已实现：是
- 本地测试通过：是（205/205）
- 隔离环境验证通过：部分（spool / 备份恢复模型）
- 真实服务器验证通过：**否**
- 正式生产上线：**否**

本轮完成审计与文档补充后立即停止；不进入 M6、不部署、不创建任何生产资源、不执行 Git 操作，等待 ChatGPT 复审。
