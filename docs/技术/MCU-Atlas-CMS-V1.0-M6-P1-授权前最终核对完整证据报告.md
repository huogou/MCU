# MCU Atlas CMS V1.0 · M6-P1 授权前最终核对完整证据报告

| 项 | 值 |
|---|---|
| 日期 | 2026-11-10 |
| 任务性质 | 只读审查；未执行 M6 |
| 核对对象 | Owner 授权申请、Linux 沙箱执行包、冻结清单、`RELEASE-MANIFEST.json`、`.sha256` |
| 本轮动作 | 只读检查 + 新增本报告；**未修改被核五文件、未改代码/配置、未重新生成 Manifest、未改变任何 SHA-256** |
| 结论 | **BLOCK**：manifest 一致，但授权范围、网络隔离试探、执行期限、清理/销毁、停止条件存在矛盾或缺项 |
| 最终建议 | **不具备提交 Owner 审批的条件**；需先修订授权申请与执行包并复审 |

---

## 0. 两层报告定位

- 第一层：聊天中执行摘要，5～10 行。
- 第二层：本报告，保留完整核对证据：文件哈希、章节引用、命令输出、PASS/BLOCK 依据、授权范围、问题清单、停止条件。

---

## 1. 被核五文件哈希（只读，核对前后未变）

| 文件 | 字节 | SHA-256 |
|---|---:|---|
| `docs/技术/MCU-Atlas-CMS-V1.0-M6-P1-Owner授权申请.md` | 3,242 | `4f4969ba8bf4fa32e4242f6b057dd2d1ad6f6f1f7fea1c4a5595485b10592511` |
| `docs/技术/MCU-Atlas-CMS-V1.0-M6-P1-Linux沙箱执行包.md` | 12,129 | `98272d0d0349e9467e59a7b263b1d68b37e781ad620d5f6e7ef7e07f951be0e5` |
| `docs/技术/MCU-Atlas-CMS-V1.0-M6-P1-冻结清单.md` | 3,981 | `6172de946cb609e44bd953cd82b0d27c25f1f64305d481cdd1c359bc3bfc88bf` |
| `mcu-cms/ops/RELEASE-MANIFEST.json` | 4,865 | `8f8ca65cbfd0a5fd739bc238f7e41671ce6207480b9820277cc62131fa9fbe7b` |
| `mcu-cms/ops/RELEASE-MANIFEST.json.sha256` | 88 | `ef3145b924c77e292433fa3744634c4dc650f699d81107e266be697b4d0e5e47` |

核对命令：

```powershell
Get-FileHash <file> -Algorithm SHA256
```

只读输出见本报告 §1 表格；创建本报告后再次执行同一命令，五个哈希保持不变。

---

## 2. Manifest 核对（PASS，附文件/章节）

期望值：

```text
8f8ca65cbfd0a5fd739bc238f7e41671ce6207480b9820277cc62131fa9fbe7b
```

只读命令：

```bash
node -e "const fs=require('fs'),c=require('crypto');const p='mcu-cms/ops/RELEASE-MANIFEST.json';const h=c.createHash('sha256').update(fs.readFileSync(p)).digest('hex');const sha=fs.readFileSync(p+'.sha256','utf8').trim().split(/\s+/)[0];const expected='8f8ca65cbfd0a5fd739bc238f7e41671ce6207480b9820277cc62131fa9fbe7b';console.log(JSON.stringify({actual_manifest_sha256:h,sha_file_value:sha,expected,match_file:h===expected,match_sha_file:sha===expected,match_each_other:h===sha},null,2))"
```

退出码：`0`。

原始输出：

```json
{
  "actual_manifest_sha256": "8f8ca65cbfd0a5fd739bc238f7e41671ce6207480b9820277cc62131fa9fbe7b",
  "sha_file_value": "8f8ca65cbfd0a5fd739bc238f7e41671ce6207480b9820277cc62131fa9fbe7b",
  "expected": "8f8ca65cbfd0a5fd739bc238f7e41671ce6207480b9820277cc62131fa9fbe7b",
  "match_file": true,
  "match_sha_file": true,
  "match_each_other": true
}
```

PASS 证据：

| 核对项 | 结果 | 文件/章节 |
|---|---|---|
| Owner 授权申请写入完整 SHA | PASS | `M6-P1-Owner授权申请.md` §1 第 10 行 |
| 冻结清单写入完整 SHA | PASS | `M6-P1-冻结清单.md` 表头第 9 行 |
| `.sha256` 文件内容一致 | PASS | `RELEASE-MANIFEST.json.sha256` 第 1 行 |
| 当前 manifest 文件哈希一致 | PASS | §2 命令输出 `match_file=true` |
| manifest 与 `.sha256` 互相比对一致 | PASS | §2 命令输出 `match_each_other=true` |
| 旧 SHA 明确失效 | PASS | Owner §1 第 12 行；冻结清单第 12 行 |

---

## 3. 授权申请与执行包一致性核对

### 3.1 逐项结论

| 核对项 | 结果 | 证据文件/章节 | 说明 |
|---|---|---|---|
| VM 类型与 systemd 版本 | PASS | Owner §2 第 19 行；执行包 §1 第 12 行 | 均为独立可销毁 Linux VM、systemd 239 或同代 |
| CPU / 内存 / 磁盘 | PASS | Owner §2 第 20 行；执行包 §1 第 13 行 | 均为 ≥2 vCPU、≥2 GiB RAM、≥20 GiB 可用磁盘 |
| 运行时工具 | PASS | Owner §2 第 21 行；执行包 §1 第 14 行 | 工具集合一致 |
| 用户 / 组 | PASS | Owner §3 第 26–27 行；执行包 §2 第 40–41 行 | `mcucms`、`mcucms-publish` 一致 |
| 目录与关键权限 | PASS（仅关键值） | Owner §3 第 28、33 行；执行包 §2 第 43–72 行；manifest `permissions` 第 121–164 行 | 关键矩阵一致；但 Owner 未列全部目录 mode，见 B-04 |
| systemd unit 名称 | PASS | Owner §3 第 29 行；执行包 §3 第 87–89 行；冻结清单 §3 | 三个 unit 名称一致 |
| path 启用顺序 | PASS | Owner §4 第 41 行；执行包 §3 第 104–106 行 | T4 前 disabled，T4 后 enable 一致 |
| 网络隔离语义 | **BLOCK** | Owner §2 第 22 行、§5 第 46 行；执行包 §4 第 130–144 行 | 「不连接生产主机」与「固定生产 IP 连接试探」矛盾；见 B-01 |
| 执行命令授权覆盖 | **BLOCK** | Owner §4 第 37–41 行；执行包 §3、§4、§5、§6、§8 | 执行包含 root 安装、systemctl、setpriv、tcpdump、tar、rm -rf 等，Owner 仅按测试编号授权；见 B-03 |
| 停止条件 | **BLOCK** | Owner §6 第 52 行；执行包 §7 第 244 行、§8 | 执行包缺少「任何生产资源接触」「Owner 停止」等；见 B-05 |
| 执行期限 | **BLOCK** | Owner §6 第 51 行；执行包 §7 第 230–242 行、§6 第 211 行 | ≤1 自然日无法覆盖 24h S0-VM + T0–T10；见 B-02 |
| 清理 / 销毁 | **BLOCK** | Owner §6 第 53–54 行；执行包 §8 第 265–271 行 | 「不清理现场」与 `[破坏] rm -rf` 冲突；见 B-06 |
| M1–M5 冻结边界 | PASS | 冻结清单 §4、§5；Owner §6 第 52 行；执行包 §7 第 244 行 | 明确冻结、不修改 M1–M5 |
| M6 / M7 边界 | **BLOCK（部分）** | Owner §5 第 47 行；执行包 §7 第 240–241 行、§9 第 277 行；执行包 §6 第 211 行 | M7 禁止明确，但 `S6.log（生产只读）` 与 §9「不含生产 S0/S6」矛盾；见 B-07 |

### 3.2 总体一致性

**BLOCK。** manifest 一致，VM 规格、用户组、unit 名称、path 顺序基本一致；但存在 7 个 BLOCK 级矛盾/缺项，故授权申请与执行包不满足“完全一致”。

---

## 4. Owner 必须批准的完整事项

以下为按任务要求整理的完整审批清单；标注「已写」表示 Owner 申请已有文字，标注「未覆盖/不明确」表示执行包有动作或需要审批但未清晰写入。

| # | 事项 | 当前 Owner 申请覆盖 | 结论 |
|---|---|---|---|
| 1 | 允许创建独立 Linux VM | §2 只写「独立可销毁 Linux VM」规格；§3「允许创建的资源」未列 VM 创建本身 | 未覆盖/不明确 |
| 2 | CPU / 内存 / 磁盘规格 | §2 第 20 行：≥2 vCPU、≥2 GiB RAM、≥20 GiB | 已写 |
| 3 | 指定系统用户 `mcucms` | §3 第 26 行 | 已写 |
| 4 | 指定系统组 `mcucms-publish` | §3 第 27 行 | 已写 |
| 5 | 目录清单 | §3 第 28 行 | 已写，但目录精确 mode 未逐项列全 |
| 6 | 权限矩阵 | §3 第 33 行列关键值；manifest/执行包有完整矩阵 | 部分覆盖 |
| 7 | 安装三个 systemd unit | §3 第 29 行列出 unit；§4 第 41 行允许 path enable | 已写 unit 名称，但未覆盖 `daemon-reload` 等命令 |
| 8 | 启动 / 停止 / disable unit | §4 仅概括 T1–T10；未明确 `systemctl start/stop/disable/enable` | 未覆盖/不明确 |
| 9 | helper 与 ops/tool/unit 文件安装 | §3 第 28–30 行列目录/helper/unit，未明确 `/srv/m6/ops/*.cjs`、tool 副本、`install` | 未覆盖/不明确 |
| 10 | 网络隔离范围 | §3 第 31 行、§5 第 45–46 行 | 有文字但自相矛盾，见 B-01 |
| 11 | IPv4/IPv6 固定台账与阻断试探 | §5 第 46 行允许固定 IP 连接并预期失败；§3 第 31 行台账 | 有文字但生产触碰风险未消除 |
| 12 | 测试数据范围 | §4 第 40 行：仅合成 DB/媒体/文章/CSS/Sitemap | 已写 |
| 13 | 日志 / 证据范围 | §6 第 53 行提 `/srv/m6/evidence/`、`final.tar.gz` | 部分覆盖；执行包创建 `/srv/m6/evidence/network`、`resources` 未逐项批准 |
| 14 | 停止条件 | §6 第 52 行 | 已写，但执行包不完全一致 |
| 15 | 清理与销毁 | §6 第 53–54 行 | 与执行包 `rm -rf` 冲突 |
| 16 | 不创建 timer / 不部署 / 不执行 M7 | §5 第 47 行 | 已写 |
| 17 | 不触碰生产资源 | §5 第 45–46 行 | 已写但与 §2「不连接生产主机」/执行包固定 IP 试探冲突 |
| 18 | Manifest SHA 书面批准 | §1 第 10、15 行 | 已写 |

---

## 5. BLOCK 问题清单（矛盾、缺项、风险）

| ID | 级别 | 问题 | 证据 | 风险 |
|---|---|---|---|---|
| B-01 | BLOCK | Owner 申请 §2 写「不连接生产主机」，§5 又写「生产 IP 只允许在固定 IP 阻断测试中连接并预期失败」；执行包 §4 使用 `openssl s_client -connect "$PROD_V4:443"` / `curl https://$PROD_V4/ -H Host: www.mcuatlas.xyz -k` | Owner 第 22、46 行；执行包第 133–137 行 | 若隔离失效，会实际连接生产 TLS/HTTP 并接触证书/服务内容；触碰生产环境风险 |
| B-02 | BLOCK | 执行期限「建议不超过 1 个自然日」与 24h `S0-VM` 采样 + T0–T10 顺序冲突 | Owner §6 第 51 行；执行包 §6 第 211 行、§7 第 230–242 行 | 授权窗口不可执行，或迫使跳过 24h 基线 |
| B-03 | BLOCK | 执行包包含 `/srv/m6/*` 安装、root-owned 文件安装、`systemctl daemon-reload/enable/start/stop/disable`、`setpriv --reuid=0`、`tcpdump`、`tar`、`sha256sum` 等具体命令；Owner 仅按 T0–T10/S1–S5 编号授权，未覆盖具体变更动作 | 执行包 §3 第 81–90 行、§4、§5、§6、§8；Owner §4 | 未经批准可能扩大系统权限或修改系统配置 |
| B-04 | BLOCK | Owner 未以审批项逐条列出目录 mode、文件 mode、`/srv/m6/manifest`、`/srv/m6/ops`、`/srv/m6/tool`、`/srv/m6/helper`、`/srv/m6/units` staging 路径 | Owner §3；执行包 §2、§3 | 授权范围不明确 |
| B-05 | BLOCK | 停止条件不完全一致：Owner 含「任何生产资源接触」「G3 无法可靠拦截」「G4 需扩大权限/绕过/副作用」「网络固定 IP 可连通」「指标无法按 V1.4 计算」；执行包 §7 通用停止较简略，缺「任何生产资源接触」「Owner 停止」 | Owner §6 第 52 行；执行包 §7 第 244 行 | 停止条件漏项，可能继续测试 |
| B-06 | BLOCK | Owner §6 写「不清理现场」，执行包 §8 写 `[破坏] rm -rf .../spool/* .../tmp/* .../logs/*` | Owner 第 53 行；执行包第 265–269 行 | 清理授权冲突，可能删除证据或越权破坏 |
| B-07 | BLOCK | 执行包 §6 第 211 行列 `S6.log（生产只读，不属 M6 VM）`，但 §9 第 277 行写「本包不含生产 S0/S6」；Owner §5 不允许生产恢复/M7，未批准生产只读 S6 采集 | 执行包第 211、277 行；Owner 第 47 行 | 内部矛盾，可能把生产 S6 混入 M6 证据目录 |
| B-08 | BLOCK | Owner §2 写「不连接生产主机」，执行包 T0 使用 `dig +short A www.mcuatlas.xyz` / `AAAA` 解析生产域名 | Owner 第 22 行；执行包第 119–120 行 | 生产域名查询是否属于「连接/接触」未定义，审批范围不明确 |
| B-09 | BLOCK | 授权申请未明确「允许创建独立 Linux VM」作为审批项，仅在 §2 描述规格 | Owner §2、§3 | 创建 VM 本身可能未获授权 |
| B-10 | BLOCK | 执行包 T4 `setpriv --reuid=0 --regid=0 ...` 以 root 身份模拟 helper；Owner §4 只写 T4 空 capability/组权限验证 | 执行包第 179–181 行；Owner §4 第 38 行 | 特权模拟命令未在授权申请中明确 |

---

## 6. M1–M5 / M6 / M7 边界

| 项 | 结论 | 证据 |
|---|---|---|
| M1–M5 冻结 | PASS | 冻结清单 §4 第 53–56 行、§5 第 60–63 行；Owner §6 第 52 行；执行包 §7 第 244 行 |
| M6 测试范围 | 部分清晰但存在 BLOCK | Owner §4；执行包 §7/§9；但 S6.log、固定 IP 试探、S0-VM 24h 与期限冲突 |
| M7 生产恢复演练 | PASS（禁止明确） | Owner §5 第 47 行「不执行 M7 或生产恢复」；执行包 §9 第 277 行「本包不含 M7」 |
| T6/T7 性质 | PASS（需说明） | 执行包 §7 第 240–241 行写明「合成 DB 备份 / 写入循环 / 停服后恢复」，属 M6 沙箱恢复约束，不是 M7 生产恢复 |

---

## 7. 停止条件触发情况

任务停止条件为：

> 任何关键授权范围不明确、Manifest 不一致或发现生产环境触碰风险，立即停止，不得进入 M6。

核对结果：

- Manifest 一致：PASS。
- 关键授权范围不明确：BLOCK（B-03、B-04、B-09、B-10）。
- 生产环境触碰风险：BLOCK（B-01、B-07、B-08）。
- 停止条件不一致：BLOCK（B-05）。
- 清理/销毁冲突：BLOCK（B-06）。

**已触发停止条件。本轮到此停止，不进入 M6，不创建任何资源，不连接服务器。**

---

## 8. 最终建议

**不具备提交 Owner 审批的条件。**

原因：虽然 manifest SHA 完全一致，但授权申请与执行包存在生产 IP 连接语义冲突、执行期限与 24h 基线冲突、清理/销毁冲突、停止条件不一致、S6 生产只读表述矛盾，以及多个执行动作/特权命令未在 Owner 申请中明确覆盖。

建议下一步（本轮不执行）：

1. 修订 Owner 授权申请与 Linux 执行包，消除 B-01～B-10。
2. 明确「是否允许对固定生产 IPv4/IPv6 做连接试探」，并限定为「仅防火墙/路由阻断验证，禁止 TLS 握手和 HTTP 请求读取生产服务内容」或改为纯 `ip route`/防火墙规则证据。
3. 明确 `S0-VM` 24h 是否包含在授权窗口内，或延长授权期限。
4. 明确 staging 路径、安装命令、systemctl 命令、setpriv、tcpdump、tar、证据目录、清理/销毁责任。
5. 删除或澄清执行包中的 `S6.log（生产只读）`。
6. 修订后重新核对；任何被核文件变化都需重新生成/批准 manifest SHA（本轮未改）。

---

## 9. 核对前后只读证据

本报告创建前后，五个被核文件哈希保持不变。

创建后复核命令：

```powershell
Get-FileHash <file> -Algorithm SHA256
```

退出码：`0`。原始输出：

```text
docs/技术/MCU-Atlas-CMS-V1.0-M6-P1-Owner授权申请.md	4f4969ba8bf4fa32e4242f6b057dd2d1ad6f6f1f7fea1c4a5595485b10592511
docs/技术/MCU-Atlas-CMS-V1.0-M6-P1-Linux沙箱执行包.md	98272d0d0349e9467e59a7b263b1d68b37e781ad620d5f6e7ef7e07f951be0e5
docs/技术/MCU-Atlas-CMS-V1.0-M6-P1-冻结清单.md	6172de946cb609e44bd953cd82b0d27c25f1f64305d481cdd1c359bc3bfc88bf
mcu-cms/ops/RELEASE-MANIFEST.json	8f8ca65cbfd0a5fd739bc238f7e41671ce6207480b9820277cc62131fa9fbe7b
mcu-cms/ops/RELEASE-MANIFEST.json.sha256	ef3145b924c77e292433fa3744634c4dc650f699d81107e266be697b4d0e5e47
```

本轮未重新生成 manifest；未执行 `T0–T10`、`S1–S5`；未创建 VM、用户、组、目录或 unit；未连接或操作生产服务器。
