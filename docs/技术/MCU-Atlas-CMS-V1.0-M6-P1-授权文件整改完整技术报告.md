# MCU Atlas CMS V1.0 · M6-P1 授权文件整改完整技术报告

| 项 | 值 |
|---|---|
| 日期 | 2026-11-11 |
| 任务 | 授权文件整改 + 重新核对；**不是 M6 执行任务** |
| 修改范围 | 仅两份授权文档；另新增本报告作为第二层完整证据 |
| 未修改 | M1–M5 冻结代码、M6-P1 ops 代码/测试、`RELEASE-MANIFEST.json(.sha256)`、三份 unit 草案、冻结清单、已有测试结果和历史报告 |
| Manifest SHA-256 | `8f8ca65cbfd0a5fd739bc238f7e41671ce6207480b9820277cc62131fa9fbe7b`（不变） |
| 最终结论 | **PASS：具备提交 Owner 审批的条件** |
| 当前状态 | Owner 书面批准仍待签署；M6 未执行；M7 未启动；生产部署不批准 |

> 本报告为两层报告中的第二层。聊天中的第一层执行摘要每项 PASS 均可在 `E1–E9` 回查。

---

## 0. 证据索引

| 编号 | 章节 | 支撑内容 |
|---|---|---|
| E1 | §1 修改范围与文件哈希 | 两份文档修改前后 SHA-256、未改其他文件 |
| E2 | §2 Manifest 与冻结依据 | manifest 不需要更新、受控组件未变、M1–M5 冻结未变 |
| E3 | §3 B-01～B-10 对照表 | 十项 BLOCK 逐项整改 |
| E4 | §4 授权范围一致性 | Owner 申请与执行包的资源、命令、期限、网络、停止、清理一致 |
| E5 | §5 命令白名单扫描 | 两份文档 18 个 bash 块、禁止项 0、白名单外首命令 0 |
| E6 | §6 网络与生产边界 | 无生产 IP/域名探测、无生产 DNS、无 S6、M7 独立冻结 |
| E7 | §7 停止/清理一致性 | 停止条件 11/11、清理策略 6/6、网络原则 7/7 逐条一致 |
| E8 | §8 剩余 BLOCK 与新增风险 | 无剩余 BLOCK；新增风险及缓解 |
| E9 | §9 最终判定 | PASS 依据与未授权边界 |

---

## 1. 修改范围与两份文档 SHA-256（E1）

### 1.1 修改前

| 文件 | 字节 | SHA-256 |
|---|---:|---|
| `docs/技术/MCU-Atlas-CMS-V1.0-M6-P1-Owner授权申请.md` | 3,242 | `4f4969ba8bf4fa32e4242f6b057dd2d1ad6f6f1f7fea1c4a5595485b10592511` |
| `docs/技术/MCU-Atlas-CMS-V1.0-M6-P1-Linux沙箱执行包.md` | 12,129 | `98272d0d0349e9467e59a7b263b1d68b37e781ad620d5f6e7ef7e07f951be0e5` |

### 1.2 修改后

| 文件 | 字节 | SHA-256 |
|---|---:|---|
| `docs/技术/MCU-Atlas-CMS-V1.0-M6-P1-Owner授权申请.md` | 19,334 | `9aedbd942d2cbb029b601c89fd3223f3020988ea33887186b3277d457fbc77fa` |
| `docs/技术/MCU-Atlas-CMS-V1.0-M6-P1-Linux沙箱执行包.md` | 20,406 | `20799bbae84a71e63f6b60063c7adfbc1ecf5ac7a51df200a0d85787fbf77a75` |

采集命令：

```powershell
Get-FileHash <file> -Algorithm SHA256
```

退出码：`0`。

### 1.3 未改文件复核

| 文件 | 当前 SHA-256 | 结论 |
|---|---|---|
| `mcu-cms/ops/RELEASE-MANIFEST.json` | `8f8ca65cbfd0a5fd739bc238f7e41671ce6207480b9820277cc62131fa9fbe7b` | 未变 |
| `mcu-cms/ops/RELEASE-MANIFEST.json.sha256` | `ef3145b924c77e292433fa3744634c4dc650f699d81107e266be697b4d0e5e47` | 未变 |
| `mcu-cms/docs/systemd/mcu-cms.service.draft` | `9ed9dc30dc8e5b2b0bf03af1e645732bc655353082f0bafcc92688bd5e2bdeb3` | 未变 |
| `mcu-cms/docs/systemd/mcu-cms-publish.service.draft` | `7b25978cca2f986905095a04fd17c6999228a29d94f60d61adf2f90430c63121` | 未变 |
| `mcu-cms/docs/systemd/mcu-cms-publish.path.draft` | `4e88fbaca621a0da35dd33027093688e83eaa5e618e8feb7ca4a15152845acc1` | 未变 |

---

## 2. Manifest 与冻结依据（E2）

### 2.1 两份文档是否受 manifest 控制

只读命令输出：

```json
{
  "manifest_sha256": "8f8ca65cbfd0a5fd739bc238f7e41671ce6207480b9820277cc62131fa9fbe7b",
  "owner_doc_in_manifest": false,
  "package_doc_in_manifest": false
}
```

manifest 受控路径仅包括 `ops/**` 与 `docs/systemd/*.draft`；两份 `docs/技术/*.md` 授权文档不在 `RELEASE-MANIFEST.json` 的 `components`、`test_harness`、`units` 中。

### 2.2 Manifest 完整性

只读输出：

```json
{
  "manifest_sha256": "8f8ca65cbfd0a5fd739bc238f7e41671ce6207480b9820277cc62131fa9fbe7b",
  "sha_file": "8f8ca65cbfd0a5fd739bc238f7e41671ce6207480b9820277cc62131fa9fbe7b  RELEASE-MANIFEST.json",
  "components": 7,
  "test_harness": 10,
  "units": 3,
  "bad": []
}
```

结论：**不需要更新 Manifest**。依据：

1. 本任务只修改两份授权文档，且它们不属于 manifest 受控组件。
2. 未修改 M6-P1 ops 代码、测试代码、三份 unit 草案、冻结清单或历史报告。
3. `RELEASE-MANIFEST.json` 与 `.sha256` 哈希未变，受控组件完整性 `bad=[]`。
4. 若未来修改受控组件，必须停止并重新生成/批准 manifest；本轮未触发。

### 2.3 M1–M5 冻结边界

只读命令输出：

```json
{
  "frozen_key_files": 9,
  "bad": []
}
```

9 个关键冻结文件与最终冻结确认报告一致；未运行 M6 测试、未运行 M1–M5 回归、未改代码。

---

## 3. B-01～B-10 逐项整改对照表（E3）

| ID | 原问题 | 整改位置 | 整改结果 | 证据 |
|---|---|---|---|---|
| B-01 | 生产 IP 试探 vs「不连接生产主机」 | Owner §3；执行包 §4 | 删除生产 IPv4/IPv6 TLS/HTTP/TCP 探测；T0 仅本机路由/接口/防火墙/计数器/配置；`curl` 仅 `--resolve 127.0.0.1` | E5/E6 |
| B-02 | ≤1 日无法覆盖 24h 基线 | Owner §2；执行包 §1/§6/§7 | 授权窗口 ≥48h；24h `S0-VM` 完整保留；超窗停止并重新申请 | E4/E7 |
| B-03 | 具体命令/系统变更未逐项授权 | Owner §7；执行包 §10 | 建立唯一命令白名单 C01–C14；执行包所有 bash 命令均映射到 Owner §7 | E5 |
| B-04 | staging 路径、目录 mode、文件 mode 未覆盖 | Owner §4.2/§4.3；执行包 §2/§3 | 逐目录、逐文件列明来源、目标、owner、group、mode | E4 |
| B-05 | 停止条件不一致 | Owner §6；执行包 §8 | 11 条停止条件逐字一致 | E7 |
| B-06 | `rm -rf` 与「不清理现场」冲突 | Owner §9；执行包 §9 | 删除 `rm -rf`；改为 6 步证据导出/完整性/Owner 批准销毁 | E5/E7 |
| B-07 | `S6.log` 与「不含生产 S0/S6」冲突 | 执行包 §6/§11；Owner §4.6/§10 | 删除 `S6.log`；M6 只采集 VM 内证据；M7 独立冻结 | E6 |
| B-08 | 生产域名 DNS 查询未定义 | Owner §3；执行包 §4 | 删除 `dig`；不查询生产域名；本地 DNS 仅读 `/etc/resolv.conf`/`resolvectl status` | E5/E6 |
| B-09 | VM 创建审批项不明确 | Owner §1/§2 | 明确允许创建和销毁独立 Linux VM，并规定销毁需 Owner 再次批准 | E4 |
| B-10 | `setpriv --reuid=0 --regid=0` 未明确 | Owner §4.5/§7 C09；执行包 §5/§10 | 明确用途、参数、执行身份、T4 限定、不得用 `systemd-run` 代替 | E4/E5 |

---

## 4. 授权范围一致性（E4）

| 项目 | Owner 申请 | 执行包 | 结论 |
|---|---|---|---|
| 创建/销毁 VM | §1/§2/§9 | §1/§9/§11 | PASS |
| CPU/内存/磁盘 | §2 | §1 | PASS |
| 授权窗口 ≥48h、24h 基线 | §2 | §1/§6/§7 | PASS |
| 用户/组 | §4.1 | §2 | PASS |
| 全部目录精确 owner/group/mode | §4.2 | §2 | PASS |
| `/srv/m6/` staging、文件来源/目标/mode | §4.3 | §3 | PASS |
| 三个 unit 安装/启停 | §4.4 | §3 | PASS |
| `setpriv` root 模拟 | §4.5 | §5 | PASS |
| `tcpdump` 接口/过滤/输出路径 | §3 | §4 | PASS |
| `tar`/`sha256sum` 证据打包 | §7 C11 | §9 | PASS |
| `/srv/m6/evidence/` 写入范围 | §4.6 | §6/§9 | PASS |
| 测试期 root 权限与禁止扩大 | §8 | §5/§10/§11 | PASS |
| 不采集生产 S0/S6、M7 独立 | §4.6/§10 | §6/§11 | PASS |

结论：**授权申请与执行包的授权范围完全一致**；所有实际执行命令可在 Owner §7 唯一命令白名单中找到对应项目。

---

## 5. 命令白名单与禁止项扫描（E5）

只读扫描命令：解析两份文档所有 `bash` 代码块，检查禁止模式与每个逻辑命令行首命令是否在 Owner §7 白名单内；对续行命令按逻辑行合并处理。

最终输出：

```json
{
  "docs": 2,
  "bash_blocks": 18,
  "forbidden_hits": [],
  "unknown_first_tokens": []
}
```

禁止模式列表：

```text
PROD_V4
PROD_V6
openssl s_client
dig +short
curl ... $PROD
www.mcuatlas.xyz
tcpdump ... host <prod>
rm -rf /
S6.log
systemd-run
```

说明：文档正文中的“禁止 `openssl s_client`、`rm -rf`、`S6.log`、`systemd-run`”属于禁令文字，不是可执行命令；bash 代码块内命中数为 0。

---

## 6. 网络与生产边界（E6）

Owner §3 与执行包 §4 的前 7 条网络原则逐字一致：

```text
1. M6 VM 不连接生产主机。
2. 不对生产 IPv4/IPv6 发起 TLS、HTTP、TCP 探测。
3. 不使用 `curl`、`openssl s_client` 等命令访问生产 IP。
4. 不查询生产域名 DNS；不采集生产 S6。
5. T0 只检查 VM 本机路由、网络接口、出站防火墙规则、计数器、配置文件及隔离配置。
6. 使用本机规则、路由表、计数器、配置文件和本地回环服务作为网络隔离证据。
7. 无法证明隔离时，立即停止；**不得通过访问生产服务来验证隔离**。
```

证据来源：

- 本机接口/路由：`ip -br addr`、`ip route show`、`ip -6 route show`。
- 防火墙：`nft list ruleset`、`iptables -S/-L -v -n`、`ip6tables -S/-L -v -n`。
- 计数器/配置：`cat /proc/net/nf_conntrack`、配置文件 `sha256sum`。
- 监听：`ss -ltnup`。
- 本地回环：`getent hosts www.m6.local`、`curl --resolve www.m6.local:18443:127.0.0.1 ...`。
- 被动抓包：`tcpdump -ni any -c 20 -w /srv/m6/evidence/network/local-capture.pcap 'not port 22 and not port 53'`。

**未出现**：生产 IP 连接试探、生产域名 DNS 查询、生产证书/DB/H5/Sitemap/Nginx 访问、生产 S6、M7 生产恢复步骤。

---

## 7. 停止/清理/网络原则逐条一致性（E7）

只读脚本输出：

```json
{
  "stopConditionsEqual": true,
  "stopCount": 11,
  "cleanupEqual": true,
  "cleanupCount": 6,
  "networkPrinciplesEqual": true,
  "networkCount": 7
}
```

| 项 | 文件/章节 | 结果 |
|---|---|---|
| 11 条停止条件 | Owner §6；执行包 §8 | PASS（逐条一致） |
| 6 步清理/证据导出/销毁 | Owner §9；执行包 §9 | PASS（逐条一致） |
| 7 条网络原则 | Owner §3；执行包 §4 | PASS（逐条一致） |
| 无 `rm -rf` 删除命令 | Owner §9；执行包 §9；§5 扫描 | PASS |
| 24h 基线 + ≥48h 窗口 | Owner §2；执行包 §1/§6/§7 | PASS |
| T4 前 path disabled | Owner §4.4；执行包 §3/§7 | PASS |

---

## 8. 剩余 BLOCK 与新增风险（E8）

### 8.1 剩余 BLOCK

**无。** B-01～B-10 均已在两份授权文档中形成一致、明确、可回查的授权范围。

### 8.2 新增风险（非 BLOCK）

| ID | 风险 | 缓解 |
|---|---|---|
| R-01 | 被动 `tcpdump -ni any` 可能捕获 VM 管理流量 | 过滤 `not port 22 and not port 53`；输出仅存 `/srv/m6/evidence/network/local-capture.pcap`；不使用生产 IP/域名过滤 |
| R-02 | `setpriv --reuid=0 --regid=0` 是 root 模拟 | 仅在 T4、精确参数、空 capability、仅补充 `mcucms-publish`；不得代替真实 unit 判定；禁止 `CAP_DAC_OVERRIDE` |
| R-03 | 48 小时窗口仍可能被测试超出 | Owner 书面批准需写明窗口；超窗按停止条件停止并重新申请 |
| R-04 | 本地 `curl --resolve 127.0.0.1` 若被替换成 DNS 查询会触碰生产域名语义 | 命令白名单固定 `--resolve`；禁止 `dig` 与生产域名查询 |
| R-05 | `/srv/m6/source/` 由 VM 镜像本地副本提供，若副本不完整会影响安装 | 禁止网络/生产复制；`sha256sum -c` 校验 manifest；T0 哈希不符即停止 |

---

## 9. 最终判定（E9）

**PASS：具备提交 Owner 审批的条件。**

依据：

1. Manifest `8f8ca65…7b` 未变；`.sha256` 一致；受控组件 `bad=[]`（E2）。
2. 两份授权文档修改前后 SHA-256 已记录；未修改任何受控代码/配置/unit/冻结清单/历史报告（E1/E2）。
3. B-01～B-10 全部整改并交叉核对（E3/E4）。
4. 两份文档 18 个 bash 块禁止项 0、白名单外首命令 0（E5）。
5. 网络原则、停止条件、清理策略逐条一致（E6/E7）。
6. 无剩余 BLOCK；新增风险均为非阻塞并已给缓解（E8）。

边界：

- Owner 仍需出具**独立书面批准**；本报告不构成批准。
- M6 未执行；T0–T10/S1–S5 未运行；未创建 VM、用户、组、目录、unit；未连接或操作生产服务器。
- M7 未启动；生产部署不批准。
