# MCU Atlas CMS V1.0 · M6-P1 C15 IPv6 校验补漏完整技术报告

| 项 | 值 |
|---|---|
| 日期 | 2026-11-11 |
| 任务 | C15 IPv6 校验补漏 + 只读复核；**不是 M6 执行任务** |
| 修改范围 | 仅两份授权文档中的 C15 命令与说明；本报告为独立第二层证据，不覆盖历史报告 |
| 未修改 | M1–M5 冻结代码、M6-P1 ops、测试、Manifest、unit 草案、冻结清单、C04、网络原则 8 条、停止 11 条、清理 6 步 |
| Manifest SHA-256 | `8f8ca65cbfd0a5fd739bc238f7e41671ce6207480b9820277cc62131fa9fbe7b`（不变） |
| 最终结论 | **PASS：两份授权文档具备提交 Owner 书面审批的条件** |
| 当前状态 | Owner 书面批准仍待签署；M6 未执行；M7 未启动；生产部署不批准 |

> 摘要每项 PASS 均可在 `E1–E9` 回查。本轮仅做文档整改与本地 awk 逻辑验证；未启动 tcpdump/curl、未连接生产、未创建 VM/用户/组/目录/unit。

---

## 0. 证据索引

| 编号 | 章节 | 支撑内容 |
|---|---|---|
| E1 | §1 | C15 修订后完整命令（两份文档一致） |
| E2 | §2 | 5 类本地逻辑测试的输入、命令与退出码 |
| E3 | §3 | 原有 C04/C15 逻辑未被意外改动的核对 |
| E4 | §4 | 两份文档修改前后 SHA-256 |
| E5 | §5 | 命令白名单完整扫描 |
| E6 | §6 | 双文档命令/网络原则/停止条件/清理策略一致性复核 |
| E7 | §7 | Manifest 与 M1–M5 冻结边界复核 |
| E8 | §8 | 尚未验证的真实运行项清单 |
| E9 | §9 | 剩余 BLOCK 与最终准入判断 |

---

## 1. C15 修订后完整命令（E1）

两份授权文档（Owner §3、执行包 §4）中的 C15 精确命令现完全一致，关键增补为 `test -s ...all.txt` 与 `IP6` 拒绝：

```bash
set -e
test -s /srv/m6/evidence/network/local-capture.pcap
stat -c '%s %n' /srv/m6/evidence/network/local-capture.pcap
sha256sum /srv/m6/evidence/network/local-capture.pcap > /srv/m6/evidence/network/local-capture.pcap.sha256
tcpdump -nn -tttt -r /srv/m6/evidence/network/local-capture.pcap "tcp port 18443 and host 127.0.0.1" > /srv/m6/evidence/network/local-capture.txt
tcpdump -nn -tttt -r /srv/m6/evidence/network/local-capture.pcap > /srv/m6/evidence/network/local-capture.all.txt
test -s /srv/m6/evidence/network/local-capture.all.txt || exit 1
awk '{for(i=1;i<=NF;i++) if($i=="IP6"){exit 1}; for(i=1;i<=NF;i++) if($i ~ /^([0-9]{1,3}\.){3}[0-9]{1,3}/){n=split($i,a,"."); ip=a[1]"."a[2]"."a[3]"."a[4]; if(ip!="127.0.0.1"){exit 1}}}' /srv/m6/evidence/network/local-capture.all.txt
n=$(awk 'END{print NR}' /srv/m6/evidence/network/local-curl.log); [ "$n" -ge 2 ] || exit 1
echo "$n" > /srv/m6/evidence/network/local-curl.count
c=$(awk '/Flags \[S\]/{for(i=1;i<NF-1;i++) if($i ~ /^127\.0\.0\.1\.[0-9]+$/ && $(i+1)==">" && $(i+2) ~ /^127\.0\.0\.1\.18443:$/){split($i,a,"."); seen[a[5]]=1}} END{m=0; for(p in seen)m++; print m}' /srv/m6/evidence/network/local-capture.txt); [ "$c" -ge 2 ] || exit 1
echo "$c" > /srv/m6/evidence/network/local-capture.connections
```

新增/保留要点：

- `set -e` 全程生效，任一必要检查失败立即终止。
- 保留 IPv4 本机检查（所有 IPv4 字面量必须为 `127.0.0.1`）。
- 新增 `IP6` 字段检查：tcpdump 回放的 IPv6 报文首部含独立字段 `IP6`，命中即 `exit 1`。
- 新增 `test -s ...all.txt || exit 1`：回放文件为空或缺失直接失败，覆盖“空文件/必要输入缺失”场景。
- 覆盖整个 `local-capture.all.txt`（无过滤回放），不只对过滤后 TCP 报文检查。
- 采用 POSIX awk 字段判断，无 gawk 专有扩展，可移植性已通过本地测试验证。

---

## 2. 本地逻辑测试（E2）

测试仅用静态样例，未启动 tcpdump/curl，未连接任何服务器。使用的 awk 与文档一致：

```
awk '{for(i=1;i<=NF;i++) if($i=="IP6"){exit 1}; for(i=1;i<=NF;i++) if($i ~ /^([0-9]{1,3}\.){3}[0-9]{1,3}/){n=split($i,a,"."); ip=a[1]"."a[2]"."a[3]"."a[4]; if(ip!="127.0.0.1"){exit 1}}}' FILE
```

### CASE1 仅 127.0.0.1 IPv4 流量（预期 PASS）

输入 `FILE` 内容：

```
IP 127.0.0.1.51000 > 127.0.0.1.18443: Flags [S], seq 0
IP 127.0.0.1.51001 > 127.0.0.1.18443: Flags [S], seq 0
```

执行：`awk '...' FILE`；退出码 `0` → **PASS（符合预期）**。

### CASE2 含非 127.0.0.1 IPv4 地址（预期 FAIL）

输入：

```
IP 10.0.0.5.12345 > 127.0.0.1.18443: Flags [S], seq 0
```

执行：退出码 `1` → **FAIL（符合预期）**。

### CASE3 含 IPv6 报文行（IP6）（预期 FAIL）

输入：

```
IP6 fe80::1 > 127.0.0.1.18443: Flags [S], seq 0
```

执行：退出码 `1` → **FAIL（符合预期）**。

### CASE4 IPv4 本机流量与 IPv6 报文混合（预期 FAIL）

输入：

```
IP 127.0.0.1.51000 > 127.0.0.1.18443: Flags [S]
IP6 fe80::2 > 127.0.0.1.18443: Flags [S]
```

执行：退出码 `1` → **FAIL（符合预期）**。

### CASE5 空文件或必要输入缺失（预期 FAIL）

- 空文件：先 `test -s FILE || exit 1` 直接 `exit 1`；即便进入 awk，空输入也无 `IP6`/IPv4 但 C15 上游 `test -s` 已失败。
- 缺失文件：同上 `test -s` 失败。

执行：退出码 `1` → **FAIL（符合预期）**。

测试结果汇总：

```
CASE1 only 127.0.0.1 IPv4 -> exit 0 (PASS)
CASE2 foreign IPv4       -> exit 1 (FAIL)
CASE3 IPv6 IP6           -> exit 1 (FAIL)
CASE4 mixed IPv4+IPv6    -> exit 1 (FAIL)
CASE5 empty/missing      -> exit 1 (FAIL)
```

---

## 3. 原有 C04/C15 逻辑未被意外改动（E3）

```json
{
  "c04_equal": true,
  "c04_unchanged_rc": true,
  "c15_equal": true,
  "c15_has_sete": true,
  "c15_has_ip6": true,
  "c15_has_tests_alltxt": true,
  "c15_srcport_only": true,
  "c15_ipv4_check": true
}
```

- C04 在两文档仍完全一致；仍包含 `rc=$?`、`124`、`"200"`，且不含 `wait $p || true`（源端口计数、curl 退出码/HTTP200、抓包退出码校验均未变动）。
- C15 在两文档仍完全一致；在保留 `set -e`、源端口计数（`$(i+1)==">"` 且 `18443:$/`）、IPv4 本机检查之外，仅新增 `IP6` 拒绝与 `test -s all.txt`，未删改既有逻辑。

---

## 4. 两份文档修改前后 SHA-256（E4）

### 4.1 修改前（上一轮 C04/C15 验收逻辑最终修复后）

| 文件 | 字节 | SHA-256 |
|---|---:|---|
| `docs/技术/MCU-Atlas-CMS-V1.0-M6-P1-Owner授权申请.md` | 26,128 | `aa84505c14968df4e43dbccd7f7b4d9b480690d836e86d6c371bd730a455af65` |
| `docs/技术/MCU-Atlas-CMS-V1.0-M6-P1-Linux沙箱执行包.md` | 26,754 | `ff667412f06c64f13ff01971098495e6fb7d80105bbfd5f6e8b6e692c2bef499` |

### 4.2 修改后

| 文件 | 字节 | SHA-256 |
|---|---:|---|
| `docs/技术/MCU-Atlas-CMS-V1.0-M6-P1-Owner授权申请.md` | 26,381 | `47b1f409cf93df593b6a4bb8aa2b36f4758f262bc705f5bfded1bd20d167981d` |
| `docs/技术/MCU-Atlas-CMS-V1.0-M6-P1-Linux沙箱执行包.md` | 27,007 | `24f776e86d684843169d06dfb004748b63661a2b86e2a07e957e87ec8a1f3398` |

仅 C15 命令与说明变化，无代码/Manifest 变化。

---

## 5. 命令白名单完整扫描（E5）

```json
{
  "docs": 2,
  "bash_blocks": 20,
  "forbidden_hits": [],
  "unknown_first_tokens": []
}
```

- 禁止模式含：生产 IP/域名探测、`openssl s_client`、`dig +short`、`curl ... $PROD`、`www.mcuatlas.xyz`、`tcpdump -i any`、`tcpdump -c 20`、`getent hosts`、独立 `kill`、`tcpdump ... host <非 127.0.0.1>`、`rm -rf /`、`S6.log`、`systemd-run`、`wait $p || true`。
- 本轮新增的 `test -s`、`IP6` 字段判断均在既有 `test`/`awk` 白名单内；首命令 `set`、`test` 与赋值行已豁免，无白名单外首命令。
- 未新增 root 权限、网络操作、生产访问或未授权外部命令。

---

## 6. 双文档一致性复核（E6）

```json
{
  "c04_equal": true,
  "c15_equal": true,
  "networkPrinciplesEqual": true,
  "networkCount": 8,
  "stopConditionsEqual": true,
  "stopCount": 11,
  "stopUnchanged": true,
  "cleanupEqual": true,
  "cleanupCount": 6,
  "cleanupUnchanged": true
}
```

- Owner §3/§7 与执行包 §4/§10 的 C04/C15 精确命令一致。
- 原有 8 条网络原则、11 条停止条件、6 步清理策略均未改动。
- 授权范围未扩大：不访问生产 IP/域名、不查生产 DNS、不增防火墙/权限、不增未授权命令。

---

## 7. Manifest 与 M1–M5 冻结边界（E7）

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

Manifest 是否需要更新：**不需要**。依据：

1. 本轮只改两份 `docs/技术/*.md` 授权文档，均不属于 `RELEASE-MANIFEST.json` 的受控组件。
2. 受控组件完整性 `bad=[]`，M1–M5 关键冻结文件 9/9 哈希一致。
3. 若未来修改受控组件，须停止并重新生成/批准 manifest；本轮未触发。

---

## 8. 尚未验证的真实运行项（E8）

以下为文档/逻辑层之外的真实现场验证项，本轮未执行、也未声称通过：

1. **真实 Linux VM 内 tcpdump 抓包**：未启动，回放文件 `local-capture.*` 为真实执行产物，尚未生成。
2. **真实 systemd 239 隔离能力**：未在该环境实测。
3. **真实 POSIX shell 行为**：仅本地静态 awk/shell 逻辑验证，未在目标 VM 跑完整 C04/C15。
4. **真实本机 HTTP 服务与 curl 200**：未连接任何服务，预期 `200` 为文档规定值，真实返回值待现场确认。
5. **M6 现场整体流程**：T0–T10、S1–S5 均未运行；生产部署不批准。

---

## 9. 剩余 BLOCK、新增风险与最终准入（E9）

### 9.1 剩余 BLOCK

**无。** C15 IPv6 校验补漏已完成并通过 5 类本地逻辑测试；原有 C04/C15 逻辑未变动；双文档一致；授权边界未扩大。

### 9.2 新增风险（非 BLOCK）

| ID | 风险 | 缓解 |
|---|---|---|
| R-13 | 若目标 VM 的 tcpdump 对 IPv6 使用不同字段标记（非 `IP6`） | 标准 `tcpdump` 对 IPv6 报文首字段为 `IP6`；若格式异常，现有 IPv4 检查与 `set -e` 仍会因其不符合 `127.0.0.1` 而失败，不会默认通过 |
| R-14 | `test -s all.txt` 在 pcap 非空但回放为空时的处理 | 已明确：回放空即 `exit 1`，与需求“空文件 FAIL”一致 |

### 9.3 最终准入判断

**PASS：两份授权文档具备提交 Owner 书面审批的条件。**

依据：

1. C15 已明确拒绝 IPv6（`IP6`）报文，且覆盖整个 `all.txt`（E1/E2）。
2. 空文件/缺失输入判定失败（E2 CASE5）。
3. 原有 C04/C15 逻辑未被意外改动（E3）。
4. 两份文档 C04/C15 命令完全一致，网络原则 8/8、停止 11/11、清理 6/6 未变（E6）。
5. 命令白名单无违规、无未授权首命令（E5）。
6. Manifest 受控组件与 M1–M5 冻结内容保持不变（E7）。

边界：

- Owner 仍需出具独立书面批准；本报告不构成批准。
- M6 未执行；T0–T10/S1–S5 未运行；未创建 VM、用户、组、目录、unit；未连接或操作生产服务器；未执行 Git；未执行现场清理。
- M7 未启动；生产部署不批准。
- 文档验收通过**不等于** M6 执行获批。
