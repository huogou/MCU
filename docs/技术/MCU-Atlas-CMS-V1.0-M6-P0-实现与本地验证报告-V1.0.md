# MCU Atlas CMS V1.0 · M6-P0 实现与本地验证报告 V1.0

> **已被 M6-P1 审计修复取代。** P0 中的 manifest `a4e171…09e1`、组件/测试哈希仅保留历史；当前生效版本与哈希见 `M6-P1-冻结清单.md`、`RELEASE-MANIFEST.json.sha256`。

| 项 | 值 |
|---|---|
| 日期 | 2026-11-10 |
| 执行方 | CodeBuddy |
| 性质 | M6 前置组件实现 + 本地隔离测试；**未执行 M6** |
| 范围 | 仅新增 `mcu-cms/ops/`；未改 M1–M5 冻结代码 |
| 结论 | G2/G3/G4 已实现；本地测试 6/6 套件通过；Linux DAC/systemd/symlink 切换未验证 |
| 生产 | 未登录、未部署、未创建资源、未 Git 操作 |

---

## 1. 实现内容

### G2：Preflight

`mcu-cms/ops/preflight.cjs`

- 校验 manifest 与外部 `.sha256`、组件/工具哈希、unit 源文件哈希。
- 校验布局目录、`h5/article` 软链边界、`h5/sitemap.xml` 普通文件、Node 版本。
- Linux 权限检查：mode/owner/group（`id`/`getent`）；Windows 明确 `PERMISSION_CHECK_SKIPPED`，不伪造通过。
- 失败 exit 1，输出 `issues`；不写业务文件。
- `--root/--manifest/--h5` 仅 `M6_TEST_MODE=1`；生产拒绝测试参数。

### G3：Spawn Guard

`mcu-cms/ops/spawn-guard.cjs`

- 由 `NODE_OPTIONS=--require` 在 `server.cjs` 前加载；拦截 `spawnSync`/`spawn`/`execFile`/`execFileSync`/`exec*`。
- 只允许 manifest 指定的 sitemap 工具；校验路径、SHA-256、参数白名单、`shell:true`、自定义 env 是否保留 guard。
- 子进程继承 `NODE_OPTIONS` 后再次校验并写 `guard_child_loaded`。
- 失败抛 `M6_GUARD_DENIED`；在 spawn 前拒绝，不产生工具输出。
- 直接 `node app/server.cjs` 不经 unit 的入口只能检测（cgroup/MainPID），不是技术阻断。

### G4：Helper / Release Gate

`mcu-cms/ops/helper.cjs`、`release-gate.cjs`

- 请求字段白名单；禁止 request 中出现路径/命令；ID/时间/seq/hash 校验。
- release 目录固定 `releases/<seq>`；拒绝软链/跨盘；逐文件校验 `manifest.json`；校验 sitemap 和 article manifest hash。
- `verify_only` 无副作用；`switch` 创建临时 symlink 后 rename，sitemap 备份后替换；失败回滚 article；结果写 done/failed。
- spool：`incoming→work` 原子 claim、work 冲突不覆盖、重复 id 不重复执行、非法 JSON 隔离、单轮 10 条、lock 文件。
- 操作日志写入 `logs/publish.log`（测试）或 `/var/log/mcu-cms-publish/publish.log`（生产）；日志失败不改变结果。
- 不增加 `CAP_DAC_OVERRIDE`，不放宽 work 权限；权限仍按 V1.4 组+setgid 设计，Linux 未验证。

---

## 2. 本地隔离测试

命令：

```bash
node mcu-cms/ops/tests/run-all.cjs
```

结果：**6/6 套件通过，37 项断言/检查通过**。

| 套件 | 结果 | 覆盖 |
|---|---|---|
| freeze | PASS 9/9 | 关键冻结文件哈希 |
| g2 | 7/7 | 正常、组件/工具篡改、manifest SHA、路径穿越、缺目录、测试参数拒绝 |
| g2-real | PASS 1/1 | 用真实 manifest 在临时部署树运行 preflight；Windows DAC 跳过 |
| g3 | 6/6 | 两次模拟调用、子进程 guard、shell、自定义 env、非白名单路径、哈希不符 |
| g3-build | PASS 1/1 | **真实 `buildSite`** 两处 spawnSync 均被拦截；构建 `ok:true`，79 条 sitemap，guard calls=2 |
| g4 | 13/13 | 正常/非法/哈希不符/篡改、gate 零副作用、重复、failed、spool、claim 冲突；switch Windows SKIP |

关键原始结果：

```text
[freeze] PASS 9 frozen files match
[g2] 7/7 通过
[g2-real] ok:true, warnings: REPO_TOOL_ABSENT + 7×PERMISSION_CHECK_SKIPPED
[g3] 6/6 通过
[g3-build] build outcome ok:true, verify:true, sitemapUrls:79; guard calls:2
[g4] 13/13 通过；switch: SKIP Windows 不能验证 POSIX symlink rename
```

### M1–M5 基线回归

```text
node mcu-cms/tests/run-all.cjs
14 套件，失败 0，总耗时 75633 ms
```

- 205/205 通过（原有基线未删除/未放宽）。
- 端到端：`ok:true`，`I1–I6` 全 true，`level=local-isolated`。
- `h5/tools/generate-sitemap.cjs --check`：基础段 76 条一致。

---

## 3. Manifest 与哈希

`mcu-cms/ops/RELEASE-MANIFEST.json`

| 项 | 值 |
|---|---|
| manifest SHA-256（历史，已失效） | `a4e1715279cc216ab0d33f387948bbed3b33209bc4153a21e4dd6d046b3009e1` |
| 当前 manifest | 见 `M6-P1-冻结清单.md`：`8f8ca65…7b` |
| 外部 SHA 文件 | `mcu-cms/ops/RELEASE-MANIFEST.json.sha256` |
| 工具 | `ae1678d981577dc3b401d15dad314e1abae3878ac00b73ad1ff3bbf6fd936846` |
| 组件 | `ops/VERSION`、`lib/common.cjs`、`preflight.cjs`、`spawn-guard.cjs`、`helper.cjs`、`release-gate.cjs`、`build-manifest.cjs` |
| units | 三个 `.draft` 源文件及目标路径 |

新增组件/测试完整哈希：

| 文件 | 字节 | SHA-256 |
|---|---:|---|
| `ops/VERSION` | 9 | `dfb8feb501ff0a2e9b42dd357b101bb1b523acdd0c53d1942e0cfdfdc55b9d7d` |
| `ops/lib/common.cjs` | 3,310 | `efd2acc45a63c7849a5b744603f635c540fb1ddd71a0458154ba429b97a79b8f` |
| `ops/preflight.cjs` | 12,274 | `c042aa4a1350f3cd53615871147ca271a261aa5f54ceca9df0ffccb00e9f45c7` |
| `ops/spawn-guard.cjs` | 5,739 | `621e86fdcfb3d10c1182b4b2cbccf7c1e08f29dfe5518a6dc72ee38fed7a9b34` |
| `ops/helper.cjs` | 15,233 | `735cfadba15035d81c7f1938b24b2cd514c3cb95305b48a6ab7856d844d00624` |
| `ops/release-gate.cjs` | 2,876 | `b10698288bf764112b0df269a93104acb6b64427472e5e092e40427dd0ce8813` |
| `ops/build-manifest.cjs` | 3,654 | `52b9fd9f8b091f0c0334bfecee5ff04329fe790dd0a16aa6f020567fb0d702cd` |
| `RELEASE-MANIFEST.json` | 3,246 | `a4e1715279cc216ab0d33f387948bbed3b33209bc4153a21e4dd6d046b3009e1` |
| `RELEASE-MANIFEST.json.sha256` | 88 | `c6b1311f0a84d86c5320699a479783d2cc8d2194e54e20ff35da6355bffbced9` |
| `tests/fixture.cjs` | 5,040 | `73b2421553a4cd08b754bfcda298027ea84d5f57d4c598e6233339fedf29d50d` |
| `tests/g2.test.cjs` | 3,624 | `f9170796a746c04d786fd459a413b8f3b3ca090d1dbd17ad8240f78b007eb90a` |
| `tests/g2-real-manifest.test.cjs` | 2,659 | `75aa0a18960db5209f09475cbb1032653f3bbfabdd7b12517603df1e4eeed933` |
| `tests/g3.test.cjs` | 3,230 | `091086865c422c3880f89804ea45e30f9cf52eab2cdc20a0f5f7d0ea64da157c` |
| `tests/g3-harness.cjs` | 1,119 | `ae551056ddeca7e5ab90cf5bf239fcc7ea3cbc78da6c91024636408c9730d2ab` |
| `tests/g3-build-harness.cjs` | 3,219 | `53bef3ef0c58a4be6851922d45d15ac902293e36395a5e76c30c6e84f7f02ef4` |
| `tests/g3-build.test.cjs` | 2,007 | `1db8e9fd42706794944fae6025bf811eb42e237dc3d16a35e1d7f1521a4f55cf` |
| `tests/g4.test.cjs` | 6,429 | `6e9b9626e4760755d9e551c9c844b5f0edeeef7b0689ab964a5ef2cf20bee8a4` |
| `tests/freeze.test.cjs` | 1,557 | `57c8df2a1e86d502d1381691d9fc2f2c0bf41cb90c4ad028a89852b08f490824` |
| `tests/run-all.cjs` | 790 | `cfbf0902c35e92fd494c2069569eddd4a45fb65c4e2a6a3321207820876540c4` |

> 本表为 P0 历史快照，勿用于授权。manifest 不包含自身；`RELEASE-MANIFEST.json.sha256` 锁定 manifest。Owner 必须书面批准当前 `8f8ca65…7b`，不能只看 `signed_by/signed_at`。

---

## 4. 仍阻塞 M6 / 未验证

### 4.1 未验证（本机无法证明）

1. Linux DAC：`incoming 2770` + `SupplementaryGroups` + 空 capability 读 0640/rename；`work` 对 mcucms 隔离。
2. systemd 239：空 `CapabilityBoundingSet`、`PrivateDevices`、`LogsDirectory`、父只读/子可写、`PathExistsGlob` 重触发。
3. G4 POSIX symlink 切换/回滚（Windows SKIP）；真实 `h5/article` 与 sitemap 切换。
4. 真实 CMS service 下 G3 拦截（本机真实 buildSite 已验证 2 次，但不是 systemd 环境）。
5. 直接启动入口的 cgroup/MainPID 检测（无 systemd）。
6. HTTP、T0 网络证据、T6/T7 恢复、M7。
7. 生产 `/var/log` 日志权限/写入。
8. manifest 的 Owner 签字与 C5 批准。

### 4.2 阻塞 M6 的授权/资源

- Owner 未授权沙箱 VM、用户/组、目录、三个 unit、helper、spool。
- Owner 未书面批准当前 manifest SHA `8f8ca65…7b`（P0 的 `a4e171…09e1` 已失效）。
- 真实 Linux 验证未执行。

### 4.3 不阻塞 M6 沙箱、阻塞生产

- C1 证书（记录 2026-12-14，未经联网复核，约 34–35 天）。
- C3 生产 S0/S6/P7/P9。
- M7 生产恢复演练、Nginx/证书变更。

---

## 5. 等级

| 项 | 结论 |
|---|---|
| 代码已实现 | 是（G2/G3/G4 新增组件） |
| 本地测试通过 | 是（ops 6/6；基线 14/205；e2e I1–I6） |
| 隔离环境验证通过 | 部分（Windows 文件系统/模拟；无 Linux DAC/systemd） |
| 真实服务器验证通过 | 否 |
| 正式生产上线 | 否 |

**M6 未执行、未获授权；M7 未启动；生产部署不批准。**
