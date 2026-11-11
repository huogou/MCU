# MCU Atlas CMS V1.0 · M6-P1 C04/C15 验收逻辑最终修复完整技术报告

| 项 | 值 |
|---|---|
| 日期 | 2026-11-11 |
| 任务 | C04/C15 验收逻辑最后一轮修复 + 只读复核；**不是 M6 执行任务** |
| 修改范围 | 仅两份授权文档；本报告为独立第二层证据，不覆盖历史报告 |
| 未修改 | M1–M5 冻结代码、M6-P1 ops、测试、Manifest、unit 草案、冻结清单 |
| Manifest SHA-256 | `8f8ca65cbfd0a5fd739bc238f7e41671ce6207480b9820277cc62131fa9fbe7b`（不变） |
| 最终结论 | **PASS：具备提交 Owner 审批的条件** |
| 当前状态 | Owner 书面批准仍待签署；M6 未执行；M7 未启动；生产部署不批准 |

> 摘要每项 PASS 均可在 `E1–E10` 回查。本轮仅做文档整改与本地 awk/shell 逻辑验证；未启动 tcpdump/curl、未连接生产、未创建 VM/用户/组/目录/unit。

---

## 0. 证据索引

| 编号 | 章节 | 支撑内容 |
|---|---|---|
| E1 | §1 | C04/C15 修订后完整命令（两份文档一致） |
| E2 | §2 | TCP 连接计数算法与“仅客户端源端口”说明 |
| E3 | §3 | 单连接 FAIL / 双连接 PASS 本地逻辑测试结果 |
| E4 | §4 | curl 失败、tcpdump 异常退出、timeout 触发、pcap 缺失等场景判定 |
| E5 | §5 | C15 整体失败传递机制（`set -e` + 显式 `[ ]` 测试） |
| E6 | §6 | 两份文档修改前后 SHA-256 |
| E7 | §7 | 命令白名单完整扫描 |
| E8 | §8 | 双文档命令/网络原则/停止条件/清理策略一致性复核 |
| E9 | §9 | Manifest 与 M1–M5 冻结边界复核 |
| E10 | §10 | 剩余 BLOCK、新增风险与最终准入判断 |

---

## 1. C04/C15 修订后完整命令（E1）

### 1.1 C04（两份文档完全一致）

```bash
timeout 12 sh -c 'umask 0027; test ! -e /srv/m6/evidence/network/local-capture.pcap || exit 1; timeout 9 tcpdump -U -ni lo -w /srv/m6/evidence/network/local-capture.pcap "tcp port 18443 and host 127.0.0.1" & p=$!; sleep 2; test -f /srv/m6/evidence/network/local-capture.pcap || exit 1; code1=$(curl -m 3 -sS --resolve www.m6.local:18443:127.0.0.1 https://www.m6.local:18443/ -o /dev/null -w "%{http_code}"); rc1=$?; code2=$(curl -m 3 -sS --resolve www.m6.local:18443:127.0.0.1 https://www.m6.local:18443/ -o /dev/null -w "%{http_code}"); rc2=$?; echo "req1 rc=$rc1 code=$code1" > /srv/m6/evidence/network/local-curl.log; echo "req2 rc=$rc2 code=$code2" >> /srv/m6/evidence/network/local-curl.log; if [ "$rc1" -ne 0 ] || [ "$rc2" -ne 0 ] || [ "$code1" != "200" ] || [ "$code2" != "200" ]; then echo "curl check failed"; exit 1; fi; wait $p; rc=$?; if [ "$rc" -ne 124 ]; then echo "capture abnormal exit $rc"; exit 1; fi'
```

关键修复：分别捕获两次 curl 的 `rc` 与 `http_code`；预期 `200`；任一 `rc≠0` 或 `code≠200` 立即 `exit 1`；删除 `wait $p || true`，改为 `wait $p; rc=$?` 并显式要求 `rc=124`（内层 timeout 正常停止），否则 `exit 1`。

### 1.2 C15（两份文档完全一致）

```bash
set -e
test -s /srv/m6/evidence/network/local-capture.pcap
stat -c '%s %n' /srv/m6/evidence/network/local-capture.pcap
sha256sum /srv/m6/evidence/network/local-capture.pcap > /srv/m6/evidence/network/local-capture.pcap.sha256
tcpdump -nn -tttt -r /srv/m6/evidence/network/local-capture.pcap "tcp port 18443 and host 127.0.0.1" > /srv/m6/evidence/network/local-capture.txt
tcpdump -nn -tttt -r /srv/m6/evidence/network/local-capture.pcap > /srv/m6/evidence/network/local-capture.all.txt
awk '{for(i=1;i<=NF;i++) if($i ~ /^([0-9]{1,3}\.){3}[0-9]{1,3}/){n=split($i,a,"."); ip=a[1]"."a[2]"."a[3]"."a[4]; if(ip!="127.0.0.1"){exit 1}}}' /srv/m6/evidence/network/local-capture.all.txt
n=$(awk 'END{print NR}' /srv/m6/evidence/network/local-curl.log); [ "$n" -ge 2 ] || exit 1
echo "$n" > /srv/m6/evidence/network/local-curl.count
c=$(awk '/Flags \[S\]/{for(i=1;i<NF-1;i++) if($i ~ /^127\.0\.0\.1\.[0-9]+$/ && $(i+1)==">" && $(i+2) ~ /^127\.0\.0\.1\.18443:$/){split($i,a,"."); seen[a[5]]=1}} END{m=0; for(p in seen)m++; print m}' /srv/m6/evidence/network/local-capture.txt); [ "$c" -ge 2 ] || exit 1
echo "$c" > /srv/m6/evidence/network/local-capture.connections
```

关键修复：`set -e` 保证任一必要检查失败立即终止；连接计数 awk 仅匹配 `127.0.0.1.<clientport> > 127.0.0.1.18443:` 形态；新增无过滤回放 + 逐 IPv4 字面量检查，确保 pcap 仅含本机回环流量。

---

## 2. TCP 连接计数算法（E2）

目标：只统计 SYN 报文的**客户端源端口**，且**不得**把服务端端口 18443 计入客户端端口集合。

tcpdump 回放行格式（Linux 标准）：

```
IP 127.0.0.1.51000 > 127.0.0.1.18443: Flags [S], seq 0, win 65495
```

算法（`awk`）：

1. 仅处理含 `Flags [S]` 的行（精确 `[S]`，不匹配 `[S.]` 等）。
2. 遍历字段 `i`，要求同时满足：
   - 字段 `i` 匹配 `^127\.0\.0\.1\.[0-9]+$`（纯源地址+客户端端口，无冒号）；
   - 字段 `i+1` 恰好是 `>`；
   - 字段 `i+2` 匹配 `^127\.0\.0\.1\.18443:$`（目的地址为 127.0.0.1:18443）。
3. 对命中的源字段按 `.` 切分，取第 5 段（客户端临时端口）放入 `seen` 集合。
4. 结束阶段统计 `seen` 中不同端口数 `m`；要求 `m >= 2` 才通过。

为什么不会误判：

- 服务端端口 `18443` 出现在目的字段 `127.0.0.1.18443:`（带冒号），不满足 `^127\.0\.0\.1\.[0-9]+$`（因末尾有冒号），故不会被当作源端口收集。
- 反向行 `127.0.0.1.18443 > 127.0.0.1.51000:` 的源字段是 `127.0.0.1.18443`（无冒号），但它不满足 `$(i+2) ~ /^127\.0\.0\.1\.18443:$/`（其目的不是 18443），因此不计入。
- 仅当“源为某客户端临时端口且目的确为 18443”时才计数，从根本上排除服务端端口混入。

---

## 3. 逻辑测试结果（E3）

本地用静态样例行运行上述 `awk`（不涉及生产、未启动 tcpdump/curl）：

```
single_count=1 (expect 1)
double_count=2 (expect 2)
SINGLE CASE -> FAIL (correct)
DOUBLE CASE -> PASS (correct)
FOREIGN ALLCHK -> FAIL (correct)
LOCAL ALLCHK -> PASS (correct)
CURL both ok -> C04 pass (correct)
CURL rc2!=0 -> C04 fail (correct)
CURL code1!=200 -> C04 fail (correct)
CAPTURE rc=124 -> ok (correct)
CAPTURE rc=0 -> fail (correct)
CAPTURE rc=1 -> fail (correct)
```

结论：

- 单 TCP 连接：计数 1 → 判定 FAIL（满足“单连接不会误判为两个连接”）。
- 两个不同客户端临时端口：计数 2 → 判定 PASS（满足“两个不同客户端连接能被正确识别”）。
- 含非 127.0.0.1 地址的 pcap：全流量检查 FAIL（满足仅本机流量）。
- curl 失败 / 非 200 / 抓包异常退出：均触发 C04 失败。

---

## 4. 失败场景判定（E4）

| 场景 | 机制 | 判定 |
|---|---|---|
| 任一 curl `rc≠0` | C04 `if [ "$rc1" -ne 0 ] \|\| ...` 命中，`exit 1` | C04 整体失败，不进入 C15 |
| 任一 curl `http_code≠200` | 同上，`[ "$code1" != "200" ]` 命中 | C04 整体失败 |
| tcpdump 异常退出（内层 timeout 返回非 124，如崩溃码 1） | `wait $p; rc=$?; if [ "$rc" -ne 124 ]; exit 1` | C04 整体失败，pcap 存在也不覆盖 |
| 外层 `timeout 12` 触发（hang >12s） | 整个 `sh -c` 被杀死，命令退出码 124 | T0 失败，无法掩盖 |
| pcap 缺失/空 | C04 `test -f` 失败 `exit 1`；C15 `test -s` 在 `set -e` 下失败 | 失败 |
| C15 连接数 <2 | `[ "$c" -ge 2 ]` 失败，`set -e` 终止 | C15 整体失败 |
| C15 含非本机地址 | 全流量 `awk` `exit 1`，`set -e` 终止 | C15 整体失败 |
| C15 `sha256sum`/`tcpdump -r` 失败 | `set -e` 终止 | C15 整体失败 |

---

## 5. C15 整体失败传递机制（E5）

- C15 以 `set -e` 开头：任何一条必要命令返回非零，shell 立即终止并返回非零，不会出现“前项失败、末项成功却判 PASS”。
- 必要检查顺序：pcap 存在非空 → 大小记录 → SHA-256 → 过滤回放 → 全流量本机校验 → curl 日志行数 ≥2 → 不同客户端临时端口 ≥2；任一步 `exit 1` 或非零即整体失败。
- `n=$(awk ...)` 与 `c=$(awk ...)` 的赋值后紧跟 `[ "$n" -ge 2 ] || exit 1` / `[ "$c" -ge 2 ] || exit 1`，将计数结果转为显式退出码，避免“仅写文件成功”被误判通过。
- 因 C04 已在 curl/抓包异常时失败，C15 不会在请求失败场景下把连接计数当作成功证据。

---

## 6. 两份文档修改前后 SHA-256（E6）

### 6.1 修改前（上一轮 C04 完整性整改后）

| 文件 | 字节 | SHA-256 |
|---|---:|---|
| `docs/技术/MCU-Atlas-CMS-V1.0-M6-P1-Owner授权申请.md` | 24,301 | `6c425be3f7a836ca7e6c497d4b898c9eb70b3d387e1ab030dfabd7acdbcebd5a` |
| `docs/技术/MCU-Atlas-CMS-V1.0-M6-P1-Linux沙箱执行包.md` | 25,119 | `03fe34d9ba2e2429f168e4c9744171c93e3c29e7cc32f9e057ba7c6ca55192c0` |

### 6.2 修改后

| 文件 | 字节 | SHA-256 |
|---|---:|---|
| `docs/技术/MCU-Atlas-CMS-V1.0-M6-P1-Owner授权申请.md` | 26,128 | `aa84505c14968df4e43dbccd7f7b4d9b480690d836e86d6c371bd730a455af65` |
| `docs/技术/MCU-Atlas-CMS-V1.0-M6-P1-Linux沙箱执行包.md` | 26,754 | `ff667412f06c64f13ff01971098495e6fb7d80105bbfd5f6e8b6e692c2bef499` |

仅文档内容变化（C04/C15 命令、白名单 C14/C15、说明、禁止项），无代码/Manifest 变化。

---

## 7. 命令白名单完整扫描（E7）

```json
{
  "docs": 2,
  "bash_blocks": 20,
  "forbidden_hits": [],
  "unknown_first_tokens": []
}
```

- 禁止模式含：生产 IP/域名探测、`openssl s_client`、`dig +short`、`curl ... $PROD`、`www.mcuatlas.xyz`、`tcpdump -i any`、`tcpdump -c 20`、`getent hosts`、独立 `kill`、`tcpdump ... host <非 127.0.0.1>`、`rm -rf /`、`S6.log`、`systemd-run`、`wait $p || true`（无条件吞状态）。
- 新增/调整的 `set -e`、命令替换 `$(...)`、变量赋值均已纳入 C14；首命令 `set` 与赋值行已在扫描中豁免，无白名单外首命令。
- 未新增 root 权限、网络操作、生产访问或未授权外部命令。

---

## 8. 双文档一致性复核（E8）

```json
{
  "c04_equal": true,
  "c15_equal": true,
  "c04_no_count20": true,
  "c04_has_rc_check": true,
  "c04_no_wait_true": true,
  "c04_has_200": true,
  "c15_has_sete": true,
  "c15_srcport_only": true,
  "c15_allip_check": true,
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

## 9. Manifest 与 M1–M5 冻结边界（E9）

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

## 10. 剩余 BLOCK、新增风险与最终准入（E10）

### 10.1 剩余 BLOCK

**无。** 三个必改问题（C15 源端口计数、C04 退出状态、curl 成功判定）均已修复并通过本地逻辑测试；C15 整体失败传递已用 `set -e` + 显式 `[ ]` 测试保证。

### 10.2 新增风险（非 BLOCK）

| ID | 风险 | 缓解 |
|---|---|---|
| R-10 | awk 在不同实现（gawk/mawk）下行为差异 | 仅用 POSIX awk 特性（字段遍历、`split`、`match` 未用 gawk 扩展），样例已验证 |
| R-11 | tcpdump 输出格式差异（如 `>` 周围空格） | 采用标准 ` > ` 形态匹配；若格式异常，C15 计数/全流量检查将失败并中止 |
| R-12 | `set -e` 与命令替换交互 | `n=$(awk ...)` 若 awk 非零，`set -e` 直接终止；且紧跟 `[ ]` 显式测试，双保险 |

### 10.3 最终准入判断

**PASS：C04/C15 验收逻辑修复后，仍具备提交 Owner 书面审批的条件。**

依据：

1. 单连接不会误判为两个连接（E3 单连接 FAIL）。
2. 两个不同客户端连接能被正确识别（E3 双连接 PASS）。
3. curl 任意一次失败都会阻断 C04（E3/E4）。
4. tcpdump/timeout 异常退出不会被吞掉（C04 显式 `rc=$?` 校验，E3/E4）。
5. C15 任意必要检查失败都会导致整体失败（E5 `set -e` + `[ ]`）。
6. 两份文档命令与授权范围完全一致（E8）。
7. 不扩大原授权边界（E7/E8）。
8. Manifest 受控组件与 M1–M5 冻结内容保持不变（E9）。

边界：

- Owner 仍需出具独立书面批准；本报告不构成批准。
- M6 未执行；T0–T10/S1–S5 未运行；未创建 VM、用户、组、目录、unit；未连接或操作生产服务器；未执行现场清理；未运行 Git。
- M7 未启动；生产部署不批准。
