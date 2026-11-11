# MCU Atlas CMS V1.0 · M6-P1 代码审计与修复报告 V1.0

| 项 | 值 |
|---|---|
| 日期 | 2026-11-10 |
| 性质 | 针对性代码审计 + 确定缺陷的最小修复 |
| 范围 | `mcu-cms/ops/**`；未改 M1–M5 冻结代码 |
| 结论 | 发现 12 项确定缺陷并修复；1 项设计限制需 M6 Linux 验证；manifest 已重新生成 |
| 状态 | M6-P0 新代码冻结；M6 未执行 |

---

## 1. 审计方法

- 逐文件检查 `preflight.cjs`、`spawn-guard.cjs`、`helper.cjs`、`release-gate.cjs`、`build-manifest.cjs`。
- 检查 manifest 是否覆盖所有 `ops/*.cjs`、`ops/lib/*.cjs`、`ops/tests/*.cjs`、三个 unit 草案。
- 对每项风险补负向测试；保留原有 205 项基线与 P0 测试。
- Windows 本地无法验证 Linux DAC 与 POSIX symlink rename；这些项目只登记，不伪造 PASS。

## 2. 确定缺陷与修复

| ID | 级别 | 位置 | 缺陷 | 修复 | 测试 |
|---|---|---|---|---|---|
| A-01 | P1 | `preflight.cjs` CLI/`runPreflight` | `--h5`、`--repo-root`、`--skip-permissions` 及程序化 `runPreflight` 可在非测试模式覆盖路径；`M6_TEST_MODE=1` 生产根路径未拒绝 | 生产模式只允许默认 root/h5/manifest/repo；所有测试参数仅 `M6_TEST_MODE=1`；生产根 + TEST 模式报 `TEST_MODE_PRODUCTION_ROOT` | G2 2 项 |
| A-02 | P1 | `preflight.cjs` | manifest 只校验列出的文件；未列出的 `ops/*.cjs`、`ops/lib/*.cjs`、`ops/tests/*.cjs` 可成为执行依赖 | 增加 `checkOpsComponents`：扫描未声明可执行/测试文件并 BLOCK；`test_harness` 哈希校验 | G2 2 项 + manifest 完整性核对 |
| A-03 | P1 | `spawn-guard.cjs` | 自定义 env 仅检查 `NODE_OPTIONS.includes('spawn-guard.cjs')`，可换成伪造 guard 路径 | 改为精确匹配 `--require <本文件绝对路径>`；新增 forged-env 负向测试 | G3 1 项 |
| A-04 | P1 | `spawn-guard.cjs` | guard 自身哈希条目缺失时不校验 | 缺失 `ops/spawn-guard.cjs` 条目直接 fail closed | G3 1 项 |
| A-05 | P1 | `spawn-guard.cjs` | `node -e` 间接引用 sitemap 工具未被拦截 | 检测 `-e/--eval` 参数中的 sitemap/工具引用并拒绝 | G3 1 项 |
| A-06 | P1 | `helper.cjs` `readRelease` | `manifest.json` 可为软链/非普通文件，可能读到 release 目录外 | 增加 `lstat`：必须普通文件且非软链 | 代码审计 + G4 回归 |
| A-07 | P1 | `helper.cjs` `processSpool` | Linux 下只校验文件 mode，未默认校验 `st_uid==mcucms`、`st_gid==mcucms-publish` | 默认用 `id -u mcucms` / `getent group mcucms-publish` 解析；不匹配拒绝 | Linux 待验证；Windows 跳过 |
| A-08 | P1 | `helper.cjs` 锁 | `.lock` 残留后永久返回 locked | 增加 PID/时间陈旧锁回收；`staleLockMs` 可测 | G4 陈旧锁测试 |
| A-09 | P1 | `helper.cjs` `switchRelease` | 回滚和 sitemap 恢复错误被吞掉，可能掩盖 `ROLLBACK_FAILED` | 统一 `rollbackAll()`，失败抛 `ROLLBACK_FAILED`；新增 `inspectLive()` 检测 `PARTIAL_SWITCH` | G4 inspectLive 测试；真实 POSIX 待验证 |
| A-10 | P2 | `helper.cjs` 日志 | 日志写入失败被静默吞掉，结果里没有痕迹 | `log()` 返回布尔；所有结果带 `log_ok` | G4 log_ok 测试 |
| A-11 | P1 | `helper.cjs` CLI | 生产模式仍接受 `--h5`、`--backup`、`--uid`、`--inspect` | 统一拒绝测试参数 | G4 CLI 测试 |
| A-12 | P1 | `build-manifest.cjs` / manifest | P0 manifest 未纳入 10 个测试文件 | 新增 `test_harness` 数组并逐文件校验；重新生成 manifest | `g2-real` + 完整性脚本 |

## 3. 未修复但已确认的设计限制

| ID | 说明 | 处理 |
|---|---|---|
| L-01 | `article` symlink 与 `sitemap.xml` 是两次 rename；进程在二者之间被 kill 仍可能留下混合状态 | 代码无法保证跨文件原子。新增 `inspectLive()` 检测 `PARTIAL_SWITCH`；M6 T5 注入中断后必须人工/对账收敛；V1.4 已声明残余风险 |
| L-02 | 直接 `node app/server.cjs` 不经 unit 时没有 `NODE_OPTIONS` guard | 只能靠 systemd cgroup/MainPID 检测，不是技术阻断；T0/T1 验证 unit 唯一入口 |
| L-03 | Windows 不能验证 Linux DAC、空 capability + 组权限、POSIX symlink rename | M6 T4/T5 必须真实 Linux；不得把 Windows 本地 PASS 写成 Linux 通过 |
| L-04 | G3 无法防止被完全控制的 CMS 进程用非 `child_process` 原生方式执行任意代码 | 威胁边界：root/业务进程被攻破不在防护范围；最小权限 + root-owned 工具缓解 |

## 4. 回归结果

```text
node mcu-cms/ops/tests/run-all.cjs
freeze 9/9；g2 10/10；g2-real PASS；g3 9/9；g3-build PASS(2 calls)；g4 16/16
6/6 套件通过
```

- 真实 `buildSite` 在 guard 下 `ok:true`、79 条 sitemap、两处 `guard_call`。
- M1–M5：`14 套件 / 205 项 PASS`，耗时 82,194 ms。
- 端到端：`I1–I6` 全 true；`sitemap --check` 基础 76 条一致。
- 冻结关键文件 9/9 哈希一致。
- linter：0 error / 0 warning。

## 5. Manifest

旧 `a4e171…09e1` 因代码/测试/manifest 扩容**已失效**。

当前：

```text
RELEASE-MANIFEST.json SHA-256:
8f8ca65cbfd0a5fd739bc238f7e41671ce6207480b9820277cc62131fa9fbe7b
```

`.sha256` 文件内容与文件实际哈希一致；`components=7`、`test_harness=10`、`units=3`；完整性脚本 `bad=0`。

## 6. 结论

- 代码已实现并冻结；确定缺陷已修复；未进行无依据重构。
- 本地测试通过；**真实 Linux/systemd/HTTP/M7 仍未验证**。
- M6 仍未获执行授权；生产部署不批准。
