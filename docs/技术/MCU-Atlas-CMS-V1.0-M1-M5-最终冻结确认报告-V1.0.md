# MCU Atlas CMS V1.0 · M1–M5 最终冻结确认报告 V1.0

| 项 | 值 |
|---|---|
| 日期 | 2026-11-10 |
| 执行方 | CodeBuddy（开发） |
| 性质 | 文档准确性修订 + 审计记录确认（**本轮无代码修改**） |
| 状态 | M1–M5 本地冻结；M6 不准入 |
| 全量测试 | 14 套件 / 205 项通过（同代码版本最后一次运行） |
| 端到端 | I1–I6 全 true，`level=local-isolated` |
| 生产动作 | 零：未登录服务器、未创建用户/unit/timer/helper/spool、未改线上 H5/Sitemap/Nginx/证书、未 Git commit/push |

---

## 1. 最终代码与文档版本

### 1.1 代码（本轮未修改）

| 文件 | 字节 | SHA-256 |
|---|---:|---|
| `h5/tools/generate-sitemap.cjs` | 13,456 | `ae1678d981577dc3b401d15dad314e1abae3878ac00b73ad1ff3bbf6fd936846` |
| `mcu-cms/app/build/build.cjs` | 26,288 | `b61b28a4feee253d3447ad960c43acac459a5d8f364abc5b72b6416a5e530091` |
| `mcu-cms/app/build/link-check.cjs` | 6,127 | `5f9517f740d89af1cef743896bd68d89ee81536ff8b7815f606279ab6d39191b` |
| `mcu-cms/app/build/sitemap-xml.cjs` | 1,870 | `c8c4a7f98cd6d3d4e739b1d592d05bd55271ba5a1846b9e4b0ec7bc88cefb5bd` |
| `mcu-cms/app/publish/backup.cjs` | 8,520 | `f78f4b3c9c4fe010d940d2080d6ac13d39562eb058e5cbaf6a617ed0925d0364` |
| `mcu-cms/app/publish/spool-sim.cjs` | 8,861 | `310a8b1dc50c84ca18b8aa0cf5bc8a59be436c2ca6e30e7851dce780eab63319` |
| `mcu-cms/app/repo/media.cjs` | 10,198 | `0daee823a7a7609c04b02a3dda76db349fa6f3758fddeda9501b74b770555ebe` |

> 上述代码哈希与上一轮《最终补证与安全审计报告》记录的修复后版本一致；本轮**未改代码**。

### 1.2 文档（本轮修订）

| 文档 | 字节 | SHA-256 |
|---|---:|---|
| `mcu-cms/docs/SQLite恢复调用约束与人工恢复操作手册.md` | 13,423 | `52f62c35df250a73bdc7bb79609e88178fc29074ebfffff63c7ad44867b85821` |
| `docs/技术/MCU-Atlas-CMS-V1.0-M1-M5-冻结前最后补充审计报告-V1.0.md`（已更正历史表述） | 11,592 | `3f9f63edec346fe2af422f22bb91aa0d1d4340cfae2157ee2d331c6606fb3076` |

本报告自身不列入哈希表（写入后无法自引用）。

---

## 2. G-01/G-02/G-03 审计历史与最终状态

### 2.1 结论

**三项均已在上一份《MCU Atlas CMS V1.0 · M1–M5 最终补证与安全审计报告 V1.0》中发现并修复；本轮为修复后的复查确认，不是新发现，也没有回归。**

### 2.2 历史对照

| ID | 首次发现/修复 | 修复内容 | 之后复查 |
|---|---|---|---|
| G-01 | 上一轮《最终补证与安全审计报告》 | `link-check` 的 `/article/assets/*` 分支原本不可达；调整顺序，带扩展名的 `/article/*` 检查落盘 | 本轮确认代码仍为修复后逻辑；link-check 10/10 |
| G-02 | 上一轮同名报告 | 新增 `source[src]`、`source[srcset]`、`script[src]`、CSS `url()` 扫描；构建 `article.css` 纳入 `cssFiles` | 本轮确认覆盖项与测试仍在；无回归 |
| G-03 | 上一轮同名报告 | `restoreDatabase` 的 `.pre-restore-<pid>` 加序号，连续恢复不覆盖 | 本轮确认连续恢复测试仍通过 |

### 2.3 关于《冻结前最后补充审计报告》的更正

该报告曾把 G-01/G-02/G-03 写成“本轮发现并修复”，属于**审计归属表述错误**，不是代码回归。现已更正为：

- 首次发现/修复：上一轮《最终补证与安全审计报告》；
- 《冻结前最后补充审计报告》与本次冻结：**复查确认，无代码修改**；
- 代码哈希、测试数量、行为均未变化。

不存在“为了让报告完整而虚构新发现/修复”的情况；更正后的表述见该报告 §三。

### 2.4 回归检查

- 代码哈希与上一轮一致。
- `link-check` 10/10、`sitemap-parity` 6/6、`backup` 12/12 均通过。
- 无新增失败、无断言放宽。

---

## 3. SQLite 恢复操作手册修订结果

文件：`mcu-cms/docs/SQLite恢复调用约束与人工恢复操作手册.md`

### 3.1 systemctl 描述修正

- `systemctl stop mcu-cms` 后，`systemctl is-active mcu-cms` 的正常输出是 **`inactive`**，不是“无输出”。
- `is-active` 对 inactive 通常返回非 0（常见 3）；**非 0 不代表命令执行失败**，而是状态判断结果。
- 明确区分：输出（`inactive`/`active`/`failed`）、退出状态（0/非 0）、检查目的（systemd 是否认为服务已停）。
- 服务状态只证明 systemd 视角，不能证明无手工进程/其他 unit。

### 3.2 ss / pgrep / lsof 的职责与局限

| 命令 | 正常输出 | 退出状态 | 判断目的 | 局限 |
|---|---|---|---|---|
| `ss -ltnp \| grep 8790` | 无输出 | 管道退出 1 | 无 8790 监听 | 不能证明无其他端口/无连接/无写入 |
| `ss -tnp \| grep 8790` | 无输出 | 管道退出 1 | 无 8790 活动连接 | 不能证明文件未被 mmap/其他进程打开 |
| `pgrep -af 'mcu-cms\|server\.cjs'` | 无输出 | 非 0 | 无匹配 CMS 进程 | 进程名可改写；可能漏掉其他 DB 工具 |
| `lsof <db/wal/shm>` | 无输出 | 非 0 | 三个 DB 文件无占用 | 需 root；短连接/命名空间等局限 |
| `fuser -v <db*>` | 无输出 | 非 0 | 文件占用 | 同 lsof |

**明确写入手册**：不得把单条命令“无输出”等同于“绝对不存在并发写入”；必须同时满足服务 inactive、无监听/连接、无 CMS 进程、三个 DB 文件无占用，并确认没有其他数据库访问者（脚本、DB 浏览器、备份工具、其他 unit）。无法排除时推迟恢复。

### 3.3 仍保留的硬性要求

- 恢复前必须停止所有数据库访问者；该要求未放松。
- `restoreDatabase` 仍不提供代码级写锁；停服务是调用方责任。
- 恢复顺序、回滚、`left_for_manual`、`ROLLBACK_FAILED`、启动服务条件、`.pre-restore-*` 清理条件均保持原样。
- **仅修改文档，未改恢复代码。**

---

## 4. 全量测试结果

同代码版本最后一次全量运行（本轮仅文档修改，未重跑以制造新数字）：

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

- 原 195 项保留；新增 link 3、parity 6、backup 1；总计 205。
- 无失败、无跳过（Windows 目标占用测试在非 Windows 会 SKIP；本次在 Windows 执行）。

---

## 5. I1–I6 端到端结果

`node mcu-cms/app/tools/e2e.cjs`：

```json
{
  "ok": true,
  "level": "local-isolated",
  "releases": [1, 2],
  "rolledBackTo": 1,
  "consistency": ["I1=true","I2=true","I3=true","I4=true","I5=true","I6=true"]
}
```

该结果来自本地指针文件模拟，**不是**生产软链/sitemap 切换验证。

---

## 6. 本地测试与真实 Linux 验证的边界

| 能力 | 本地 | 真实 Linux/systemd |
|---|---|---|
| 构建/桩页/Sitemap/内链/SEO/GEO | 205 项通过 | 未验证 HTTP/Nginx |
| SQLite 恢复文件级顺序、回滚、`recoverPreRestore` | 12 项通过 | `rename` 打开文件、fsync、kill 时点未验证 |
| 恢复前无并发写入 | 代码不强制；测试为单进程 | 需停服务 + `ss/pgrep/lsof` 验证 |
| spool 重复触发/锁/claim/冲突 | 14 项模型通过 | `flock`、`PathExistsGlob`、root、uid、`O_NOFOLLOW` 未验证 |
| 软链/sitemap 切换 | 指针文件模拟 | 真实 `rename`/Nginx 跟随未验证 |
| timer 重触发 | 仅设计 | 未创建、未验证 |
| 媒体 EXIF | 6 项通过 | 生产媒体库未处理 |

**结论**：本地测试通过 ≠ 隔离环境验证通过 ≠ 真实服务器验证通过 ≠ 生产上线。

---

## 7. M6 / M7 尚未满足的条件

### M6

| 条件 | 状态 |
|---|---|
| C1 证书剩余 ≥60 天/自动续签 | ❌ |
| C2 `mcucms` 用户、两个 unit、root helper、spool、目录权限 | ❌ 未授权、未创建 |
| C3 内存实测/降级路线 | ❌ |
| C5 sitemap 工具签字（`ae1678d9…6846`） | ❌ |
| M6 沙箱 HTTP 验收清单（文章/桩页/列表/分类/sitemap/CSS） | ❌ 未执行 |
| 真实 systemd/root/软链/权限 | ❌ |
| ChatGPT 复审 | ❌ 本报告待审 |

### M7

| 条件 | 状态 |
|---|---|
| 生产备份目录/保留策略 | ❌ 未定 |
| 定时备份 cron | ❌ 未创建 |
| 真实恢复演练（含 kill/断电/占用） | ❌ 未执行 |
| 备份文件加密/异地 | ❌ 未定 |
| 恢复后 I1–I6 + HTTP 冒烟 | ❌ 未在生产执行 |

**M6 不准入，M7 未启动。**

---

## 8. 冻结声明

- M1–M5 本地冻结：代码与文档版本如上；本轮仅修订文档，不改功能、不加依赖。
- 不进入 M6；不登录服务器；不创建用户/unit/timer/helper/spool；不修改线上 H5/Sitemap/Nginx/证书；不执行 Git commit/push。
- 等待 ChatGPT 最终复审；复审通过前不得部署。

**等级**：代码已实现 / 本地测试通过 / 隔离模型部分验证；真实服务器验证与生产上线均为否。
