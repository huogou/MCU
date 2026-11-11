# MCU Atlas CMS V1.0 · M6-P1 网络证据采集边界复核完整技术报告

| 项 | 值 |
|---|---|
| 日期 | 2026-11-11 |
| 任务 | 网络证据采集边界复核与最小整改；**不是 M6 执行任务** |
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
| E1 | §1 修改文件与哈希 | 两份文档修改前后 SHA-256、Manifest 未变 |
| E2 | §2 R-01 整改前后对照 | `-i any` → `-i lo`、删除 `getent hosts` |
| E3 | §3 `getent hosts` 分析依据 | NSS/mDNS 非预期网络行为分析与删除依据 |
| E4 | §4 双文档授权一致性 | 网络原则、命令白名单、停止条件、清理策略一致 |
| E5 | §5 命令白名单与禁止项复扫 | 两份文档 18 个 bash 块、禁止项 0、白名单外首命令 0 |
| E6 | §6 Manifest 与冻结边界 | Manifest 不需要更新、受控组件和 M1–M5 关键哈希未变 |
| E7 | §7 网络与生产边界 | 无生产 IP/域名探测、无生产 DNS、无 S6、M7 独立冻结 |
| E8 | §8 剩余 BLOCK 与新增风险 | 无剩余 BLOCK；新增风险及缓解 |
| E9 | §9 最终判定 | PASS 依据与未授权边界 |

---

## 1. 修改文件与哈希（E1）

### 1.1 修改前

| 文件 | 字节 | SHA-256 |
|---|---:|---|
| `docs/技术/MCU-Atlas-CMS-V1.0-M6-P1-Owner授权申请.md` | 19,334 | `9aedbd942d2cbb029b601c89fd3223f3020988ea33887186b3277d457fbc77fa` |
| `docs/技术/MCU-Atlas-CMS-V1.0-M6-P1-Linux沙箱执行包.md` | 20,406 | `20799bbae84a71e63f6b60063c7adfbc1ecf5ac7a51df200a0d85787fbf77a75` |

### 1.2 修改后

| 文件 | 字节 | SHA-256 |
|---|---:|---|
| `docs/技术/MCU-Atlas-CMS-V1.0-M6-P1-Owner授权申请.md` | 21,268 | `00d83460325dac7c1a4ed334d6ce696374e2f703ed3b733d2bf1f250bdc8a27f` |
| `docs/技术/MCU-Atlas-CMS-V1.0-M6-P1-Linux沙箱执行包.md` | 22,005 | `63bbc9c92a803f09d017cf57c65102ac7d8dc4a2ffba2b922914e4800dc3d9b6` |

采集命令：

```powershell
Get-FileHash <file> -Algorithm SHA256
```

退出码：`0`。

### 1.3 未改受控文件

| 文件 | 当前 SHA-256 | 结论 |
|---|---|---|
| `mcu-cms/ops/RELEASE-MANIFEST.json` | `8f8ca65cbfd0a5fd739bc238f7e41671ce6207480b9820277cc62131fa9fbe7b` | 未变 |
| `mcu-cms/ops/RELEASE-MANIFEST.json.sha256` | `ef3145b924c77e292433fa3744634c4dc650f699d81107e266be697b4d0e5e47` | 未变 |
| `mcu-cms/docs/systemd/mcu-cms.service.draft` | `9ed9dc30dc8e5b2b0bf03af1e645732bc655353082f0bafcc92688bd5e2bdeb3` | 未变 |
| `mcu-cms/docs/systemd/mcu-cms-publish.service.draft` | `7b25978cca2f986905095a04fd17c6999228a29d94f60d61adf2f90430c63121` | 未变 |
| `mcu-cms/docs/systemd/mcu-cms-publish.path.draft` | `4e88fbaca621a0da35dd33027093688e83eaa5e618e8feb7ca4a15152845acc1` | 未变 |

---

## 2. R-01 整改前后对照（E2）

| 项 | 整改前 | 整改后 | 变更原因 |
|---|---|---|---|
| 抓包接口 | `tcpdump -ni any` | `tcpdump -ni lo` | `-i any` 会捕获所有网卡管理/监控/非测试流量，范围过宽 |
| 过滤条件 | `'not port 22 and not port 53'` | `"tcp port 18443 and host 127.0.0.1"` | 仅保留本机回环 HTTP 测试流量 |
| 输出路径 | `/srv/m6/evidence/network/local-capture.pcap` | 同路径，固定不变；`umask 0027` 保证 root:root 0640 | 输出路径固定，权限明确 |
| 执行身份 | 未明确 | root（仅 `tcpdump` 抓包需要），独立 VM 内 | 明确权限边界 |
| 用途 | 宽泛被动抓包 | 仅验证本机回环 HTTP 服务；外部隔离不依赖抓包 | R-01 要求 |
| 外部隔离证据 | pcap 参与证明 | 仅用本机路由表、接口配置、出站防火墙规则、规则计数器、VM 网络配置 | 宽泛抓包不能证明外部隔离 |
| 本地流量生成 | 无明确配套流量 | C04 精确命令中两次 `curl --resolve ...127.0.0.1` 与 `tcpdump` 同窗口执行 | 确保 pcap 对应本机测试流量 |
| 命令授权 | C04 原为宽泛命令 | Owner §7 C04 与执行包 §4 同步列明完整参数、用途、身份、输出路径、权限；C14 增列 `&`、`wait`、`p=$!` | 不新增外部命令；仅补 shell 控制结构 |
| 名称解析 | `getent hosts www.m6.local` | 删除；仅 `curl --resolve www.m6.local:18443:127.0.0.1` | 避免 NSS/mDNS 非预期解析网络行为 |

### 2.1 整改后 C04 精确命令

```bash
timeout 10 sh -c 'umask 0027; tcpdump -ni lo -c 20 -w /srv/m6/evidence/network/local-capture.pcap "tcp port 18443 and host 127.0.0.1" & p=$!; curl -m 3 -sS --resolve www.m6.local:18443:127.0.0.1 https://www.m6.local:18443/ -o /dev/null -w "%{http_code}\n"; curl -m 3 -sS --resolve www.m6.local:18443:127.0.0.1 https://www.m6.local:18443/ -o /dev/null -w "%{http_code}\n"; wait $p'
```

- 外部命令仍为已授权的 `timeout`、`sh`、`tcpdump`、`curl`；`wait`、`&`、`p=$!` 是 shell 内建/控制结构，已同步加入 Owner §7 C14。
- 未新增 `CAP_DAC_OVERRIDE`、sudoers、setuid、ACL、防火墙修改或网络配置修改。
- 未扩大授权范围：抓包接口从 `any` 收窄到 `lo`，删除名称解析命令。

---

## 3. `getent hosts` 是否存在非预期网络行为（E3）

结论：**存在不确定性，已删除该步骤。本轮未执行该命令，不做本地实测结论。**

依据：

1. `getent hosts <name>` 通过 glibc NSS 查询名称，实际行为由 `/etc/nsswitch.conf` 的 `hosts:` 配置决定；`files`、`dns`、`mdns4_minimal`、`mdns`、Avahi/nss-mdns 等模块可能产生不同网络行为。
2. `.local` 是 mDNS 常用特殊域（RFC 6762）；若系统启用 `nss-mdns` 或 Avahi，`getent hosts www.m6.local` 可能触发 multicast DNS 查询（IPv4 `224.0.0.251:5353`、IPv6 `ff02::fb:5353`）或向配置的 DNS 服务器发起查询。
3. 该行为依赖 VM 镜像的 NSS 配置，无法在未固定 `/etc/nsswitch.conf` 与禁用 mDNS 的前提下证明「绝不产生网络行为」。
4. M6 的本地服务验证不需要名称解析：`curl --resolve www.m6.local:18443:127.0.0.1` 显式把主机名绑定到 `127.0.0.1`，不会产生 `www.m6.local` 的 DNS/mDNS 查询。
5. 因此按最小权限和最小网络行为原则删除 `getent hosts www.m6.local`；Owner §3/§7 C08 与执行包 §4/§10 同步写入禁令。

---

## 4. 双文档授权一致性（E4）

| 项目 | Owner 申请 | Linux 执行包 | 结果 |
|---|---|---|---|
| 网络原则 | §3，8 条 | §4，8 条 | PASS：逐条一致 |
| `tcpdump` 接口/过滤/输出/身份/权限 | §3、§7 C04、§8 | §4、§10 | PASS |
| 删除 `getent hosts`、NSS/mDNS 限制 | §3、§7 C03/C08/C14、§7 禁止项 | §4、§10 | PASS |
| 命令白名单 C01–C14 | §7 | §10 命令—授权索引 | PASS |
| 停止条件 11 条 | §6 | §8 | PASS：内容未变 |
| 清理/证据导出/销毁 6 步 | §9 | §9 | PASS：内容未变 |
| Manifest SHA | §1/§2 | 头部/§11 | PASS：`8f8ca65…7b` 不变 |

只读一致性脚本输出：

```json
{
  "stopConditionsEqual": true,
  "stopCount": 11,
  "stopUnchanged": true,
  "cleanupEqual": true,
  "cleanupCount": 6,
  "cleanupUnchanged": true,
  "networkPrinciplesEqual": true,
  "networkCount": 8
}
```

---

## 5. 命令白名单与禁止项复扫（E5）

扫描对象：两份文档中所有 `bash` 代码块；续行按逻辑命令合并；检查禁止模式与首命令是否属于 Owner §7 C01–C14。

最终输出：

```json
{
  "docs": 2,
  "bash_blocks": 18,
  "forbidden_hits": [],
  "unknown_first_tokens": []
}
```

禁止模式：

```text
PROD_V4
PROD_V6
openssl s_client
dig +short
curl ... $PROD
www.mcuatlas.xyz
tcpdump ... -i any
getent hosts
tcpdump ... host <非 127.0.0.1>
rm -rf /
S6.log
systemd-run
```

说明：`tcp port 18443 and host 127.0.0.1` 是允许的本地回环过滤条件；文档正文中的「禁止 `getent hosts`、`tcpdump -i any`」属于禁令文字，不是可执行命令。

---

## 6. Manifest 与冻结边界（E6）

只读输出：

```json
{
  "manifest_sha256": "8f8ca65cbfd0a5fd739bc238f7e41671ce6207480b9820277cc62131fa9fbe7b",
  "sha_file": "8f8ca65cbfd0a5fd739bc238f7e41671ce6207480b9820277cc62131fa9fbe7b  RELEASE-MANIFEST.json",
  "components": 7,
  "test_harness": 10,
  "units": 3,
  "bad": [],
  "frozen_key_files": 9,
  "keybad": []
}
```

Manifest 是否需要更新：**不需要**。

依据：

1. 本任务只修改两份 `docs/技术/*.md` 授权文档，且它们不属于 `RELEASE-MANIFEST.json` 的 `components`、`test_harness`、`units`。
2. 未修改 M6-P1 ops 代码、测试、三份 unit 草案、冻结清单、已有测试结果和历史报告。
3. `RELEASE-MANIFEST.json` 与 `.sha256` 哈希未变，受控组件完整性 `bad=[]`。
4. M1–M5 关键冻结文件 9/9 哈希一致。
5. 若未来修改受控组件，必须停止并重新生成/批准 manifest；本轮未触发。

---

## 7. 网络与生产边界（E7）

Owner §3 与执行包 §4 的 8 条网络原则逐字一致：

```text
1. M6 VM 不连接生产主机。
2. 不对生产 IPv4/IPv6 发起 TLS、HTTP、TCP 探测。
3. 不使用 `curl`、`openssl s_client` 等命令访问生产 IP。
4. 不查询生产域名 DNS；不采集生产 S6；不使用 `getent hosts www.m6.local`，避免 NSS/mDNS 产生非预期解析网络行为。
5. T0 只检查 VM 本机路由、网络接口、出站防火墙规则、计数器、配置文件及隔离配置。
6. 外部网络隔离证据只使用本机路由表、接口配置、出站防火墙规则、规则计数器和 VM 网络配置；**不使用宽泛抓包证明外部隔离**。
7. 本机回环 HTTP 只通过 `curl --resolve www.m6.local:18443:127.0.0.1` 与 `tcpdump -i lo` 的固定本地过滤条件验证。
8. 无法证明隔离时，立即停止；**不得通过访问生产服务来验证隔离**。
```

- 外部隔离证据：路由表、接口配置、防火墙规则、规则计数器、配置文件、VM 网络配置。
- 本机回环证据：仅 `lo` 上的 `127.0.0.1:18443` 本地测试流量，输出固定到 `/srv/m6/evidence/network/local-capture.pcap`。
- 无生产 IP/域名连接试探；无生产 DNS；无 S6；无 M7；无生产证书/DB/H5/Sitemap/Nginx 操作。

---

## 8. 剩余 BLOCK 与新增风险（E8）

### 8.1 剩余 BLOCK

**无。** R-01 已整改；B-01～B-10 既有一致性内容未被削弱；停止条件与清理策略未改。

### 8.2 新增风险（非 BLOCK）

| ID | 风险 | 缓解 |
|---|---|---|
| R-02 | C04 依赖本机 Nginx 在 `127.0.0.1:18443` 可用；若服务未启动，pcap 可能为空 | T0 通过标准要求 pcap 非空且能对应两次 `curl --resolve`；否则停止 |
| R-03 | C04 使用后台 `tcpdump` + `wait`，shell 控制结构需严格按命令行执行 | Owner §7 C14 与执行包 §10 明确 `&`、`wait`、`p=$!`；不得改写为 `-i any` |
| R-04 | `curl --resolve` 仍传入 `www.m6.local` 主机名用于 TLS/SNI，但已显式绑定 `127.0.0.1` | 命令固定 `--resolve`；禁止 `getent hosts`、DNS 查询、生产域名解析 |
| R-05 | 本地 TLS 自签/本地 CA 若未配置，HTTP 检查可能失败 | 属 T0 本地服务验证失败，不得改用生产服务；记录并停止 |

---

## 9. 最终判定（E9）

**PASS：完成网络证据采集边界整改后，仍具备提交 Owner 书面审批的条件。**

依据：

1. R-01 已消除 `-i any` 宽泛抓包；改为仅 `lo`、仅 `127.0.0.1:18443`、固定输出路径（E2/E5）。
2. 删除 `getent hosts www.m6.local`；使用 `curl --resolve` 明确本机地址，避免 NSS/mDNS 非预期解析（E3/E5/E7）。
3. 两份文档网络原则 8/8 一致；停止条件 11/11 未变；清理策略 6/6 未变（E4）。
4. 命令白名单复扫：18 个 bash 块、禁止项 0、白名单外首命令 0（E5）。
5. Manifest `8f8ca65…7b` 未变；受控组件 `bad=[]`；M1–M5 关键哈希 9/9 未变（E6）。
6. 无剩余 BLOCK；新增风险均为非阻塞且给出缓解（E8）。

边界：

- Owner 仍需出具**独立书面批准**；本报告不构成批准。
- M6 未执行；T0–T10/S1–S5 未运行；未创建 VM、用户、组、目录、unit；未连接或操作生产服务器。
- M7 未启动；生产部署不批准。
- 本轮未运行任何 M6 测试；未执行 `getent hosts`；未执行现场清理或销毁。
