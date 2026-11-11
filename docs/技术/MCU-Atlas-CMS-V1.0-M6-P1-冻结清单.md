# MCU Atlas CMS V1.0 · M6-P1 冻结清单

| 项 | 值 |
|---|---|
| 日期 | 2026-11-10 |
| 版本 | `M6-P0.1`（`ops/VERSION`）+ P1 安全修复 |
| 冻结范围 | `mcu-cms/ops/**`、三个 unit 草案；M1–M5 继续冻结 |
| 当前 manifest | `mcu-cms/ops/RELEASE-MANIFEST.json` |
| manifest SHA-256 | `8f8ca65cbfd0a5fd739bc238f7e41671ce6207480b9820277cc62131fa9fbe7b` |
| 外部 SHA 文件 | `mcu-cms/ops/RELEASE-MANIFEST.json.sha256` |
| 外部 SHA 文件自身哈希 | `ef3145b924c77e292433fa3744634c4dc650f699d81107e266be697b4d0e5e47` |
| 旧 manifest | `a4e171…09e1` 已失效，不得用于授权 |

---

## 1. 执行组件（manifest.components）

| 文件 | 字节 | SHA-256 |
|---|---:|---|
| `mcu-cms/ops/VERSION` | 9 | `dfb8feb501ff0a2e9b42dd357b101bb1b523acdd0c53d1942e0cfdfdc55b9d7d` |
| `mcu-cms/ops/lib/common.cjs` | 3,310 | `efd2acc45a63c7849a5b744603f635c540fb1ddd71a0458154ba429b97a79b8f` |
| `mcu-cms/ops/preflight.cjs` | 16,184 | `683c93502cba715adbff88f8d58e492f28255c0a970e173ca000ff544512c85c` |
| `mcu-cms/ops/spawn-guard.cjs` | 6,315 | `f50064a6322c2ffc197c7a7e604029aa29706bff51ae75a653a6f4f615b557f9` |
| `mcu-cms/ops/helper.cjs` | 18,659 | `4d8e72731e3b185c709c396ad12c1cbbae98099fddbebf131d07039c606d1c63` |
| `mcu-cms/ops/release-gate.cjs` | 2,876 | `b10698288bf764112b0df269a93104acb6b64427472e5e092e40427dd0ce8813` |
| `mcu-cms/ops/build-manifest.cjs` | 4,038 | `56b2ea5b97fb823ec02c3ca924b31b03af16ac170d26231a734b3c5a502f394d` |

## 2. 测试组件（manifest.test_harness）

| 文件 | 字节 | SHA-256 |
|---|---:|---|
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

## 3. unit 草案（manifest.units）

| 文件 | 字节 | SHA-256 |
|---|---:|---|
| `mcu-cms/docs/systemd/mcu-cms.service.draft` | 2,122 | `9ed9dc30dc8e5b2b0bf03af1e645732bc655353082f0bafcc92688bd5e2bdeb3` |
| `mcu-cms/docs/systemd/mcu-cms-publish.service.draft` | 1,589 | `7b25978cca2f986905095a04fd17c6999228a29d94f60d61adf2f90430c63121` |
| `mcu-cms/docs/systemd/mcu-cms-publish.path.draft` | 489 | `4e88fbaca621a0da35dd33027093688e83eaa5e618e8feb7ca4a15152845acc1` |

## 4. M1–M5 冻结基线

- 9/9 关键冻结文件与《最终冻结确认报告 V1.0》一致，见 `ops/tests/freeze.test.cjs`。
- 14 套件 / 205 项本地测试 PASS；`I1–I6` 端到端全 true。
- `h5/tools/generate-sitemap.cjs`：`ae1678d981577dc3b401d15dad314e1abae3878ac00b73ad1ff3bbf6fd936846`。
- `h5/sitemap.xml` 未改；`--check` 基础 76 条一致。

## 5. 冻结规则

1. 不再扩展 G2/G3/G4 功能。
2. 任何文件改动必须重新生成 `RELEASE-MANIFEST.json` 与 `.sha256`，旧的 `8f8ca…` 立即失效。
3. Owner 必须书面批准完整 manifest SHA-256，不得只批准版本号或 `signed_by/signed_at`。
4. 无真实 Linux T0–T10 证据，不得宣称 M6 通过。
