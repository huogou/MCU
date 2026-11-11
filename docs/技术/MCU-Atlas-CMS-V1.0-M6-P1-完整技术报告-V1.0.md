# MCU Atlas CMS V1.0 · M6-P1 完整技术报告 V1.0

| 项 | 值 |
|---|---|
| 日期 | 2026-11-10 |
| 任务 | M6-P1 Linux 沙箱准入准备与代码冻结 |
| 报告层级 | 第二层：完整技术报告 |
| 对应第一层 | 聊天中的 5～10 行执行摘要 |
| 本轮动作 | 按两层报告规范整理上一任务证据；**未改代码、未跑新测试、未创建服务器资源** |
| 结论 | 本地代码/测试通过；真实 Linux/systemd/HTTP/M7 仍未验证；M6 未获执行授权 |

> 本报告是证据汇总，不是 M6 执行结果。摘要中每项 `PASS` 均能在本报告 `E1–E8` 找到对应证据。

---

## 0. 证据索引（供第一层摘要回查）

| 编号 | 证据章节 | 支撑摘要项 |
|---|---|---|
| E1 | §2 实际修改与缺陷修复 | 结论：完成代码审计与 12 项缺陷修复 |
| E2 | §4 测试命令、退出码与原始输出 | 关键结果：6/6 套件、205/205、I1–I6 |
| E3 | §5 Manifest 与完整性核对 | 关键结果：manifest SHA、外部 `.sha256` 一致、bad=0 |
| E4 | §3 / §6 变更清单与完整哈希 | 代码修改：变更文件清单及最新哈希 |
| E5 | §4.3 / §7 冻结完整性 | 结论：M1–M5 冻结未改 |
| E6 | §8 已知缺陷、风险、停止条件 | 未解决问题、授权阻塞项 |
| E7 | §9 与上一版本差异 | 摘要：旧 manifest 失效、P0 → P1 变化 |
| E8 | §10 核心交付文件 | 文件清单 |

---

## 1. 执行摘要对应的第一层内容

| 项目 | 内容 |
|---|---|
| 结论 | M6-P1 代码审计、确定缺陷修复、冻结与授权材料完成；本地测试通过（E1/E2/E5） |
| 文件清单 | 本完整报告、代码审计报告、冻结清单、Linux 执行包、Owner 授权申请、未解决问题清单、`RELEASE-MANIFEST.json(.sha256)`（E8） |
| 关键结果 | 新增组件 6/6 套件、46 项检查通过；M1–M5 205/205；I1–I6 全 true；manifest `8f8ca65…7b`（E2/E3/E5） |
| 未解决问题 | Owner 未书面批准；Linux DAC、systemd 239、POSIX switch、T0–T10、HTTP、M7 未验证（E6） |
| 当前状态 | M6 未执行；M7 未启动；生产部署不批准（E6/E8） |

---

## 2. 实际修改与缺陷修复（E1）

### 2.1 发现的确定缺陷

| ID | 级别 | 位置 | 缺陷 | 修复 |
|---|---|---|---|---|
| A-01 | P1 | `preflight.cjs` | 生产环境测试参数可覆盖 root/h5/manifest/repo；`M6_TEST_MODE=1` 生产根未拒绝 | 生产模式只允许默认路径；测试参数仅测试模式；生产根 + TEST 模式报 `TEST_MODE_PRODUCTION_ROOT` |
| A-02 | P1 | `preflight.cjs` | 未声明的 `ops/*.cjs`、`ops/lib/*.cjs`、`ops/tests/*.cjs` 可成为执行依赖 | 增加 `checkOpsComponents` 与 `test_harness` 哈希校验；未声明即 BLOCK |
| A-03 | P1 | `spawn-guard.cjs` | 自定义 env 仅检查 `NODE_OPTIONS.includes('spawn-guard.cjs')`，可用伪造路径绕过 | 精确匹配 `--require <当前 guard 绝对路径>` |
| A-04 | P1 | `spawn-guard.cjs` | guard 自身哈希条目缺失时不校验 | 缺失条目直接 fail closed |
| A-05 | P1 | `spawn-guard.cjs` | `node -e` 间接引用 sitemap 工具未拦截 | 检测 `-e/--eval` 中的 sitemap/工具引用并拒绝 |
| A-06 | P1 | `helper.cjs` | release `manifest.json` 可为软链/非普通文件 | 增加 `lstat`：必须普通文件且非软链 |
| A-07 | P1 | `helper.cjs` | Linux 请求文件未默认校验 `st_uid/st_gid` | 默认解析 `mcucms` / `mcucms-publish` 并校验 |
| A-08 | P1 | `helper.cjs` | `.lock` 残留后永久 locked | 增加 PID/时间陈旧锁回收 |
| A-09 | P1 | `helper.cjs` | 回滚/sitemap 恢复错误被吞掉 | 统一 `rollbackAll()`；失败抛 `ROLLBACK_FAILED`；新增 `inspectLive()` |
| A-10 | P2 | `helper.cjs` | 日志写失败被静默吞掉 | `log()` 返回布尔；所有结果带 `log_ok` |
| A-11 | P1 | `helper.cjs` CLI | 生产模式接受 `--h5`、`--backup`、`--uid`、`--inspect` | 统一拒绝测试参数 |
| A-12 | P1 | `build-manifest.cjs` | P0 manifest 未纳入 10 个测试文件 | 新增 `test_harness` 数组并重新生成 manifest |

### 2.2 未修复的设计限制

| ID | 说明 | 处理 |
|---|---|---|
| L-01 | `article` symlink 与 `sitemap.xml` 为两次 rename；进程在中间被 kill 仍可能留下混合状态 | `inspectLive()` 检测 `PARTIAL_SWITCH`；M6 T5 需实测收敛；不宣称跨文件原子 |
| L-02 | 直接 `node app/server.cjs` 不经 unit 时没有 `NODE_OPTIONS` guard | 只能靠 systemd cgroup/MainPID 检测；不是技术阻断 |
| L-03 | Windows 不能验证 Linux DAC、空 capability + 组权限、POSIX symlink rename | M6 T4/T5 必须真实 Linux |
| L-04 | G3 无法防止被完全控制的 CMS 进程以非 `child_process` 方式执行任意代码 | 威胁边界：root/业务进程被攻破不在防护范围 |

---

## 3. 变更文件清单及最新哈希（E4）

### 3.1 本任务实际修改/新增文件

| 文件 | 字节 | SHA-256 | 变更原因 |
|---|---:|---|---|
| `mcu-cms/ops/preflight.cjs` | 16,184 | `683c93502cba715adbff88f8d58e492f28255c0a970e173ca000ff544512c85c` | G2 参数泄漏、未声明组件、test_harness 校验修复 |
| `mcu-cms/ops/spawn-guard.cjs` | 6,315 | `f50064a6322c2ffc197c7a7e604029aa29706bff51ae75a653a6f4f615b557f9` | G3 env/eval/self-hash 修复 |
| `mcu-cms/ops/helper.cjs` | 18,659 | `4d8e72731e3b185c709c396ad12c1cbbae98099fddbebf131d07039c606d1c63` | G4 uid/gid、stale lock、rollback、log_ok、inspectLive、CLI 修复 |
| `mcu-cms/ops/build-manifest.cjs` | 4,038 | `56b2ea5b97fb823ec02c3ca924b31b03af16ac170d26231a734b3c5a502f394d` | 纳入 `test_harness` |
| `mcu-cms/ops/tests/g2.test.cjs` | 5,012 | `03cf0ca672d004f3ccb9f908385659346f1719f38a30887cfc5af4cb05405fd3` | 新增 G2 负向测试 |
| `mcu-cms/ops/tests/g2-real-manifest.test.cjs` | 2,903 | `cb86ff580149681c91683e7331335df7426ad3ab0d56dc009fd57e73204943e2` | 复制 tests 以验证真实 manifest |
| `mcu-cms/ops/tests/g3.test.cjs` | 4,572 | `9311f1abddb49ecdef437d076cc4d1f8d53d4385a941fc67e5cd0cb79155fd4d` | 新增 forged env/eval/self-entry 测试 |
| `mcu-cms/ops/tests/g3-harness.cjs` | 1,404 | `7276cb5883cd4a585fb37dfb1cbe804c7cccc5eaae02b821083d8346ea434166` | 新增负向 harness 模式 |
| `mcu-cms/ops/tests/g3-build.test.cjs` | 2,148 | `42422fea6904e6e78825da563e5def89214d53a8ce88538d355c3dda79271b7d` | guard self-hash 条目 |
| `mcu-cms/ops/tests/g4.test.cjs` | 8,271 | `18d9b2c6474e987724e5920080797b1c2500c7d8454a27e386f57b48cc6bffa1` | G4 新增 6 项测试 |
| `mcu-cms/ops/RELEASE-MANIFEST.json` | 4,865 | `8f8ca65cbfd0a5fd739bc238f7e41671ce6207480b9820277cc62131fa9fbe7b` | 重新生成当前冻结 manifest |
| `mcu-cms/ops/RELEASE-MANIFEST.json.sha256` | 88 | `ef3145b924c77e292433fa3744634c4dc650f699d81107e266be697b4d0e5e47` | 外部 manifest 哈希 |
| `docs/技术/MCU-Atlas-CMS-V1.0-M6-P0-实现与本地验证报告-V1.0.md` | 8,761 | `f82a873589f6bb0e8d209a3dfee5e0d106c59e5c4403b4ba478ccfb6bf634be6` | 标记被 P1 取代、旧 manifest 失效 |
| `docs/技术/MCU-Atlas-CMS-V1.0-M6-P0-沙箱资源申请与Owner授权清单.md` | 3,395 | `f91b9a09bad4adc7347f9a1ce37d3bb69a1e40cb4c9e2865b6b37f764c720d24` | 标记被 P1 授权申请取代 |
| `docs/技术/MCU-Atlas-CMS-V1.0-M6-P1-代码审计与修复报告-V1.0.md` | 5,581 | `26bde3eae266a9f776da22aebd0b068b5cadd6bda668592a393842b2f5109175` | 新建代码审计报告 |
| `docs/技术/MCU-Atlas-CMS-V1.0-M6-P1-冻结清单.md` | 3,981 | `6172de946cb609e44bd953cd82b0d27c25f1f64305d481cdd1c359bc3bfc88bf` | 新建冻结清单 |
| `docs/技术/MCU-Atlas-CMS-V1.0-M6-P1-Linux沙箱执行包.md` | 12,129 | `98272d0d0349e9467e59a7b263b1d68b37e781ad620d5f6e7ef7e07f951be0e5` | 新建 Linux 执行包 |
| `docs/技术/MCU-Atlas-CMS-V1.0-M6-P1-Owner授权申请.md` | 3,242 | `4f4969ba8bf4fa32e4242f6b057dd2d1ad6f6f1f7fea1c4a5595485b10592511` | 新建授权申请 |
| `docs/技术/MCU-Atlas-CMS-V1.0-M6-P1-未解决问题清单.md` | 1,795 | `3b97751646c94bdf6276e6b39c30c139ffdf2154b53d3ca5a259e230d6527da3` | 新建未解决问题清单 |

> 本报告 `MCU-Atlas-CMS-V1.0-M6-P1-完整技术报告-V1.0.md` 为按两层报告规范新增的汇总文件，不列入自引用哈希。

### 3.2 未修改但需冻结的文件

- M1–M5 冻结业务代码未改：`app/build/`、`app/repo/`、`app/publish/`、`app/api/`、`app/server.cjs`。
- `h5/tools/generate-sitemap.cjs` 未改，仍为 `ae1678d981577dc3b401d15dad314e1abae3878ac00b73ad1ff3bbf6fd936846`。
- `h5/sitemap.xml` 未改；`--check` 基础 76 条一致。

---

## 4. 测试命令、结果、退出码与原始证据（E2/E5）

### 4.1 新增组件全量测试

命令：

```bash
node mcu-cms/ops/tests/run-all.cjs
```

退出码：`0`。

原始输出：

```text
=== freeze ===
[freeze] PASS 9 frozen files match

=== g2 ===
PASS G2 normal sandbox passes (Windows skips DAC)
PASS G2 component tamper is rejected
PASS G2 deployed tool tamper is rejected
PASS G2 manifest SHA mismatch is rejected
PASS G2 component path traversal is rejected
PASS G2 missing required directory is rejected
PASS G2 rejects --root outside M6_TEST_MODE
PASS G2 rejects --h5/--repo-root/--skip-permissions outside test mode
PASS G2 undeclared ops executable is rejected
PASS G2 undeclared test harness is rejected
[g2] 10/10 通过

=== g2-real ===
{"ok":true,"issues":[],"warnings":["TEST_DIR_PRESENT","REPO_TOOL_ABSENT","PERMISSION_CHECK_SKIPPED","PERMISSION_CHECK_SKIPPED","PERMISSION_CHECK_SKIPPED","PERMISSION_CHECK_SKIPPED","PERMISSION_CHECK_SKIPPED","PERMISSION_CHECK_SKIPPED","PERMISSION_CHECK_SKIPPED"]}
[g2-real] PASS (real manifest; Windows DAC skipped)

=== g3 ===
PASS G3 two simulated build calls are intercepted; child guard loads
PASS G3 shell:true is denied
PASS G3 custom env without guard is denied
PASS G3 custom env with forged guard path is denied
PASS G3 node -e sitemap tool bypass is denied
PASS G3 non-whitelist sitemap-like path is denied
PASS G3 hash mismatch is denied and no output is produced
PASS G3 manifest without guard self hash fails closed
PASS G3 guarded calls still work with exact tool
[g3] 9/9 通过

=== g3-build ===
build outcome: {"ok":true,"verify":true,"sitemapUrls":79}
guard calls: 2
exit: 0
[g3-build] PASS (2/2 calls intercepted; build outcome independent)

=== g4 ===
PASS G4 verify_only 正常请求通过，并显式报告 log_ok
PASS G4 inspectLive 可发现 sitemap 与 article 不一致
PASS G4 非法字段/路径注入被拒绝
PASS G4 sitemap 哈希不符被拒绝
PASS G4 release 文件被篡改被拒绝
PASS G4 gate preflight + verify_only 正常，无 h5 副作用
PASS G4 gate 拒绝时 h5/article 与 sitemap 零副作用
PASS G4 重复请求返回 duplicate，不重复执行
PASS G4 请求校验失败写 failed，不改变 h5
PASS G4 spool 正常请求：incoming → work → done
PASS G4 spool 重复 id：不重复执行，保留 done
PASS G4 spool 非法 JSON：失败隔离，不改变 h5
PASS G4 spool claim 冲突：旧 work 不覆盖
PASS G4 陈旧 spool 锁可回收，不永久 locked
PASS G4 helper CLI 生产模式拒绝测试参数
  SKIP Windows 不能验证 POSIX symlink rename; 需 M6 Linux T5
PASS G4 switch 在 Windows 标记未验证，不在本地伪造通过
[g4] 16/16 通过

M6-P0 ops: 6/6 suites passed
```

合计：`freeze 9 + g2 10 + g2-real 1 + g3 9 + g3-build 1 + g4 16 = 46` 项检查/断言；**6/6 套件通过**。其中 Windows 的 POSIX symlink switch 为 `SKIP`，不是 PASS。

### 4.2 M1–M5 冻结基线回归

命令：

```bash
node mcu-cms/tests/run-all.cjs
```

退出码：`0`。

原始输出：

```text
=== db PASS (3415 ms) ===
=== markdown-40 PASS (385 ms) ===
=== api PASS (2666 ms) ===
=== build PASS (14451 ms) ===
=== removed-pages PASS (5487 ms) ===
=== seo-geo PASS (281 ms) ===
=== sitemap PASS (8197 ms) ===
=== sitemap-parity PASS (4938 ms) ===
=== link-check PASS (1974 ms) ===
=== publish-sim PASS (11238 ms) ===
=== release-removal PASS (4312 ms) ===
=== spool-sim PASS (18399 ms) ===
=== backup PASS (4950 ms) ===
=== media-exif PASS (1498 ms) ===

共 14 套件，失败 0 个，总耗时 82194 ms
范围声明：以上均为本地隔离测试，不代表生产环境验证通过。
```

合计：**14 套件 / 205 项 PASS**。

### 4.3 端到端与 Sitemap 检查

命令：

```bash
node mcu-cms/app/tools/e2e.cjs
node h5/tools/generate-sitemap.cjs --check
```

退出码：`0`。

原始输出：

```text
{
  "ok": true,
  "level": "local-isolated",
  "releases": [1, 2],
  "rolledBackTo": 1,
  "consistency": ["I1=true","I2=true","I3=true","I4=true","I5=true","I6=true"],
  "note": "本地隔离端到端自检；未部署、未触碰 h5/、未验证生产发布链路"
}

[sitemap] --check 通过：基础段 76 条顺序一致，extra 区域格式/排序正常（文件共 76 条 URL）。
```

### 4.4 Lint

命令：`read_lints mcu-cms/ops`。

结果：`totalCount=0`，0 error / 0 warning。

---

## 5. Manifest 与完整性核对（E3）

命令：

```bash
node mcu-cms/ops/build-manifest.cjs
sha256sum -c mcu-cms/ops/RELEASE-MANIFEST.json.sha256
```

退出码：`0`。

当前结果：

```text
RELEASE-MANIFEST.json SHA-256:
8f8ca65cbfd0a5fd739bc238f7e41671ce6207480b9820277cc62131fa9fbe7b
```

`RELEASE-MANIFEST.json.sha256` 内容：

```text
8f8ca65cbfd0a5fd739bc238f7e41671ce6207480b9820277cc62131fa9fbe7b  RELEASE-MANIFEST.json
```

完整性脚本原始输出：

```json
{
  "manifest_sha256": "8f8ca65cbfd0a5fd739bc238f7e41671ce6207480b9820277cc62131fa9fbe7b",
  "components": 7,
  "test_harness": 10,
  "units": 3,
  "bad": []
}
```

旧 manifest `a4e171…09e1` 已失效；P0 报告和资源申请已标注历史，不得用于授权。

---

## 6. 完整 SHA-256 清单（E4）

| 文件 | 字节 | SHA-256 |
|---|---:|---|
| `mcu-cms/ops/VERSION` | 9 | `dfb8feb501ff0a2e9b42dd357b101bb1b523acdd0c53d1942e0cfdfdc55b9d7d` |
| `mcu-cms/ops/lib/common.cjs` | 3,310 | `efd2acc45a63c7849a5b744603f635c540fb1ddd71a0458154ba429b97a79b8f` |
| `mcu-cms/ops/preflight.cjs` | 16,184 | `683c93502cba715adbff88f8d58e492f28255c0a970e173ca000ff544512c85c` |
| `mcu-cms/ops/spawn-guard.cjs` | 6,315 | `f50064a6322c2ffc197c7a7e604029aa29706bff51ae75a653a6f4f615b557f9` |
| `mcu-cms/ops/helper.cjs` | 18,659 | `4d8e72731e3b185c709c396ad12c1cbbae98099fddbebf131d07039c606d1c63` |
| `mcu-cms/ops/release-gate.cjs` | 2,876 | `b10698288bf764112b0df269a93104acb6b64427472e5e092e40427dd0ce8813` |
| `mcu-cms/ops/build-manifest.cjs` | 4,038 | `56b2ea5b97fb823ec02c3ca924b31b03af16ac170d26231a734b3c5a502f394d` |
| `mcu-cms/ops/tests/fixture.cjs` | 5,040 | `73b2421553a4cd08b754bfcda298027ea84d5f57d4c598e6233339fedf29d50d` |
| `mcu-cms/ops/tests/g2.test.cjs` | 5,012 | `03cf0ca672d004f3ccb9f908385659346f1719f38a30887cfc5af4cb05405fd3` |
| `mcu-cms/ops/tests/g2-real-manifest.test.cjs` | 2,903 | `cb86ff580149681c91683e7331335df7426ad3ab0d56dc009fd57e73204943e2` |
| `mcu-cms/ops/tests/g3.test.cjs` | 4,572 | `9311f1abddb49ecdef437d076cc4d1f8d53d4385a941fc67e5cd0cb79155fd4d` |
| `mcu-cms/ops/tests/g3-harness.cjs` | 1,404 | `7276cb5883cd4a585fb37dfb1cbe804c7cccc5eaae02b821083d8346ea434166` |
| `mcu-cms/ops/tests/g3-build-harness.cjs` | 3,219 | `53bef3ef0c58a4be6851922d45d15ac902293e36395a5e76c30c6e84f7f02ef4` |
| `mcu-cms/ops/tests/g3-build.test.cjs` | 2,148 | `42422fea6904e6e78825da563e5def89214d53a8ce88538d355c3dda79271b7d` |
| `mcu-cms/ops/tests/g4.test.cjs` | 8,271 | `18d9b2c6474e987724e5920080797b1c2500c7d8454a27e386f57b48cc6bffa1` |
| `mcu-cms/ops/tests/freeze.test.cjs` | 1,557 | `57c8df2a1e86d502d1381691d9fc2f2c0bf41cb90c4ad028a89852b08f490824` |
| `mcu-cms/ops/tests/run-all.cjs` | 790 | `cfbf0902c35e92fd494c2069569eddd4a45fb65c4e2a6a3321207820876540c4` |
| `mcu-cms/docs/systemd/mcu-cms.service.draft` | 2,122 | `9ed9dc30dc8e5b2b0bf03af1e645732bc655353082f0bafcc92688bd5e2bdeb3` |
| `mcu-cms/docs/systemd/mcu-cms-publish.service.draft` | 1,589 | `7b25978cca2f986905095a04fd17c6999228a29d94f60d61adf2f90430c63121` |
| `mcu-cms/docs/systemd/mcu-cms-publish.path.draft` | 489 | `4e88fbaca621a0da35dd33027093688e83eaa5e618e8feb7ca4a15152845acc1` |
| `mcu-cms/ops/RELEASE-MANIFEST.json` | 4,865 | `8f8ca65cbfd0a5fd739bc238f7e41671ce6207480b9820277cc62131fa9fbe7b` |
| `mcu-cms/ops/RELEASE-MANIFEST.json.sha256` | 88 | `ef3145b924c77e292433fa3744634c4dc650f699d81107e266be697b4d0e5e47` |

---

## 7. 冻结完整性（E5）

`mcu-cms/ops/tests/freeze.test.cjs` 校验 9 个关键冻结文件，与《最终冻结确认报告 V1.0》一致：

| 文件 | SHA-256 |
|---|---|
| `h5/tools/generate-sitemap.cjs` | `ae1678d981577dc3b401d15dad314e1abae3878ac00b73ad1ff3bbf6fd936846` |
| `mcu-cms/app/build/build.cjs` | `b61b28a4feee253d3447ad960c43acac459a5d8f364abc5b72b6416a5e530091` |
| `mcu-cms/app/build/link-check.cjs` | `5f9517f740d89af1cef743896bd68d89ee81536ff8b7815f606279ab6d39191b` |
| `mcu-cms/app/build/sitemap-xml.cjs` | `c8c4a7f98cd6d3d4e739b1d592d05bd55271ba5a1846b9e4b0ec7bc88cefb5bd` |
| `mcu-cms/app/publish/release.cjs` | `d14a81c8ffeef24e7ce7d33d1e830b9f44c26f0221fed9269ec3c8ba2d998ea9` |
| `mcu-cms/app/publish/spool-sim.cjs` | `310a8b1dc50c84ca18b8aa0cf5bc8a59be436c2ca6e30e7851dce780eab63319` |
| `mcu-cms/app/publish/backup.cjs` | `f78f4b3c9c4fe010d940d2080d6ac13d39562eb058e5cbaf6a617ed0925d0364` |
| `mcu-cms/app/repo/media.cjs` | `0daee823a7a7609c04b02a3dda76db349fa6f3758fddeda9501b74b770555ebe` |
| `mcu-cms/app/server.cjs` | `215ae6b9f0db95d863a285d635331f5172f525313532859847d11bce6f4ddbfe` |

---

## 8. 已知缺陷、风险、未验证项与停止条件（E6）

### 8.1 未解决问题

| ID | 问题 | 阻塞 M6 | 阻塞生产 | 需 Owner | 状态 |
|---|---|---|---|---|---|
| U-01 | Linux DAC：2770/0640 + 组 + 空 capability 未实测 | 是 | 是 | 是 | 待 T4 |
| U-02 | systemd 239：`PrivateDevices`、`LogsDirectory`、父只读/子可写、path 重触发未实测 | 是 | 是 | 是 | 待 T1/T2/T4 |
| U-03 | POSIX symlink 切换与回滚未实测（Windows SKIP） | 是 | 是 | 是 | 待 T5 |
| U-04 | 两次 rename 之间进程被 kill 的跨文件原子性无法保证 | 部分 | 是 | 否 | `inspectLive` 已实现；需 T5 |
| U-05 | 直接 `node app/server.cjs` 不经 unit 的 G3 绕过只能检测 | 否 | 是 | 否 | 设计限制 |
| U-06 | G3 真实 systemd/NODE_OPTIONS 环境未测 | 是 | 是 | 是 | 待 M6 |
| U-07 | T0 固定 IPv4/IPv6 台账与抓包证据未采集 | 是 | 否 | 是 | 待 T0 |
| U-08 | T1–T10、S1–S5、HTTP 验收未执行 | 是 | 是 | 是 | 未执行 |
| U-09 | T6/T7 停服、文件占用、Linux rename/fsync/kill 语义未验证 | 是 | 是 | 是 | 待 M6/M7 |
| U-10 | Owner 对 `8f8ca65…7b` 的独立书面批准未提供 | 是 | 是 | 是 | 待批准 |
| U-11 | C1 证书、C3 生产 S0/S6、M7、生产 Nginx/证书变更 | 否（M6 沙箱） | 是 | 是 | 未执行 |
| U-12 | EXIF ICC/未知 APPn/隐写、WebP/方向预处理限制 | 否 | 是 | 否 | 已知残余 |

### 8.2 失败项

- 无失败测试。
- 明确 `SKIP`：Windows 不能验证 POSIX symlink rename；不得写成 PASS。
- 明确 `NOT VERIFIED`：真实 Linux/systemd/HTTP/M7。

### 8.3 停止条件

1. 需修改 M1–M5 冻结代码。
2. G3 无法可靠拦截目标调用。
3. G4 必须依赖扩大系统权限才能完成。
4. 本地测试发现发布门禁存在绕过或失败副作用。
5. manifest 无法完整锁定执行文件。
6. 网络隔离无法提供固定 IP/IPv6 证据，或试探期间抓到生产流量。
7. systemd 239 不支持必要隔离参数且无等价安全方案。
8. 指标无法按 V1.4 口径计算。
9. Owner 停止或未批准 manifest SHA。

---

## 9. 与之前版本的差异（E7）

| 项 | P0 / 旧状态 | P1 / 当前状态 |
|---|---|---|
| manifest | `a4e171…09e1`，未含 `test_harness` | `8f8ca65…7b`，`components=7`、`test_harness=10`、`units=3` |
| 缺陷 | 12 项确定缺陷未修复 | 12 项已修复；1 项跨文件原子限制需 M6 验证 |
| G2 | 测试参数/未声明组件风险 | 生产参数锁定、未声明组件/测试 BLOCK |
| G3 | 伪造 env/eval/self-entry 风险 | 精确 guard flag、eval 拒绝、self-entry 强制 |
| G4 | uid/gid/锁/回滚/日志/CLI 风险 | uid/gid、stale lock、`ROLLBACK_FAILED`、`log_ok`、`inspectLive` |
| 测试 | P0 6/6 套件、37 项检查 | P1 6/6 套件、46 项检查；M1–M5 205/205 |
| Owner 授权 | 旧 SHA 申请 | 新 SHA `8f8ca65…7b` 申请；旧 SHA 失效 |
| 文档 | 多个分散报告 | 本报告按两层规范汇总，完整证据保留 |

---

## 10. 核心交付文件（E8）

| 文件 | 用途 |
|---|---|
| `docs/技术/MCU-Atlas-CMS-V1.0-M6-P1-完整技术报告-V1.0.md` | 本报告：第二层完整技术报告 |
| `docs/技术/MCU-Atlas-CMS-V1.0-M6-P1-代码审计与修复报告-V1.0.md` | 审计发现、修复、测试结论 |
| `docs/技术/MCU-Atlas-CMS-V1.0-M6-P1-冻结清单.md` | 当前冻结版本与完整哈希 |
| `docs/技术/MCU-Atlas-CMS-V1.0-M6-P1-Linux沙箱执行包.md` | T0–T10、S1–S5、资源、命令、停止/销毁 |
| `docs/技术/MCU-Atlas-CMS-V1.0-M6-P1-Owner授权申请.md` | Owner 书面批准事项 |
| `docs/技术/MCU-Atlas-CMS-V1.0-M6-P1-未解决问题清单.md` | 未验证/阻塞项 |
| `mcu-cms/ops/RELEASE-MANIFEST.json` | 当前冻结 manifest |
| `mcu-cms/ops/RELEASE-MANIFEST.json.sha256` | manifest 外部 SHA-256 |

---

## 11. 最终等级

| 项 | 结论 |
|---|---|
| 代码已实现 | 是 |
| 本地测试通过 | 是 |
| 隔离模型验证 | 部分 |
| 真实服务器验证 | 否 |
| 正式生产上线 | 否 |
| M6 执行 | 否 |
| M7 | 未启动 |
| 生产部署 | 不批准 |

等待 ChatGPT 技术复审与 Owner 对 `8f8ca65…7b` 的独立书面授权。
