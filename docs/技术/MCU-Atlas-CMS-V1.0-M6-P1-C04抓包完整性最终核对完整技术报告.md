# MCU Atlas CMS V1.0 · M6-P1 C04 抓包完整性最终核对完整技术报告

| 项 | 值 |
|---|---|
| 日期 | 2026-11-11 |
| 任务 | C04 抓包完整性分析、最小文档整改与只读复核；**不是 M6 执行任务** |
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
| E2 | §2 C04 完整性分析 | `-c 20` 提前退出风险、是否需要修改的结论 |
| E3 | §3 同步机制与整改命令 | C04 启动/两次请求/停止的同步关系、精确命令 |
| E4 | §4 pcap 验收方法 | C15 只读验收命令与证明逻辑 |
| E5 | §5 命令白名单与双文档一致性 | 20 个 bash 块扫描、C04/C15 精确命令一致、网络/停止/清理不变 |
| E6 | §6 Manifest 与冻结边界 | Manifest 不需要更新、受控组件和 M1–M5 关键哈希未变 |
| E7 | §7 网络与生产边界 | 无生产 IP/域名探测、无生产 DNS、无 S6、M7 独立冻结 |
| E8 | §8 剩余 BLOCK 与新增风险 | 无剩余 BLOCK；新增风险及缓解 |
| E9 | §9 最终判定 | PASS 依据与未授权边界 |

---

## 1. 修改文件与哈希（E1）

### 1.1 修改前

| 文件 | 字节 | SHA-256 |
|---|---:|---|
| `docs/技术/MCU-Atlas-CMS-V1.0-M6-P1-Owner授权申请.md` | 21,268 | `00d83460325dac7c1a4ed334d6ce696374e2f703ed3b733d2bf1f250bdc8a27f` |
| `docs/技术/MCU-Atlas-CMS-V1.0-M6-P1-Linux沙箱执行包.md` | 22,005 | `63bbc9c92a803f09d017cf57c65102ac7d8dc4a2ffba2b922914e4800dc3d9b6` |

### 1.2 修改后

| 文件 | 字节 | SHA-256 |
|---|---:|---|
| `docs/技术/MCU-Atlas-CMS-V1.0-M6-P1-Owner授权申请.md` | 24,301 | `6c425be3f7a836ca7e6c497d4b898c9eb70b3d387e1ab030dfabd7acdbcebd5a` |
| `docs/技术/MCU-Atlas-CMS-V1.0-M6-P1-Linux沙箱执行包.md` | 25,119 | `03fe34d9ba2e2429f168e4c9744171c93e3c29e7cc32f9e057ba7c6ca55192c0` |

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

## 2. C04 完整性分析与修改结论（E2）

### 2.1 原命令

```bash
timeout 10 sh -c 'umask 0027; tcpdump -ni lo -c 20 -w /srv/m6/evidence/network/local-capture.pcap "tcp port 18443 and host 127.0.0.1" & p=$!; curl -m 3 -sS --resolve www.m6.local:18443:127.0.0.1 https://www.m6.local:18443/ -o /dev/null -w "%{http_code}\n"; curl -m 3 -sS --resolve www.m6.local:18443:127.0.0.1 https://www.m6.local:18443/ -o /dev/null -w "%{http_code}\n"; wait $p'
```

### 2.2 `-c 20` 是否可能提前退出

**结论：可能，且无法保证两次 HTTPS 请求都被记录。**

依据：

1. `tcpdump -c 20` 的计数单位是**匹配过滤条件的包数**，不是 HTTP 请求数、TCP 连接数或 TLS 会话数。
2. 一次本机 HTTPS 请求在 `lo` 上可能产生：TCP SYN/SYN-ACK/ACK、TLS ClientHello/ServerHello/证书/密钥交换/Finished、HTTP 请求/响应、TLS close_notify、FIN/ACK 等多个 TCP 段；loopback MTU 虽较大，但 TLS 握手和应用数据仍可能拆成多包。
3. 第一次 `curl` 完全可能单独产生 ≥20 个匹配包，使 `tcpdump` 在第二次 `curl` 开始前退出；即使第一次少于 20 包，第二次也可能在传输中途达到 20 包后退出。
4. `tcpdump` 退出后 `wait $p` 立即返回，shell 仍会继续执行后续 `curl`，但此时已无抓包进程；pcap 不能证明两次请求都被捕获。
5. 原“pcap 非空且能对应两次 curl”的验收标准因此缺少可靠机制，不能写成 PASS。

### 2.3 是否需要修改

**需要修改。** 这不是为了修改而修改，而是因为 `-c 20` 与“两次本机请求均被记录”存在确定性冲突。

整改原则：

- 删除 `-c 20` 作为结束条件。
- 用时间窗口 + `wait` 明确控制抓包启动、请求、停止。
- 两次 `curl` 结果落盘。
- 增加 C15 pcap 只读验收，证明非空、本地过滤、两次请求和两个独立 TCP 连接。
- 不新增 root 权限、网络操作、生产访问或未授权外部命令。

---

## 3. C04 同步机制与整改后精确命令（E3）

### 3.1 C04 精确命令（两份文档完全一致）

```bash
timeout 12 sh -c 'umask 0027; test ! -e /srv/m6/evidence/network/local-capture.pcap || exit 1; timeout 9 tcpdump -U -ni lo -w /srv/m6/evidence/network/local-capture.pcap "tcp port 18443 and host 127.0.0.1" & p=$!; sleep 2; test -f /srv/m6/evidence/network/local-capture.pcap || exit 1; curl -m 3 -sS --resolve www.m6.local:18443:127.0.0.1 https://www.m6.local:18443/ -o /dev/null -w "req1 %{http_code}\n" > /srv/m6/evidence/network/local-curl.log; curl -m 3 -sS --resolve www.m6.local:18443:127.0.0.1 https://www.m6.local:18443/ -o /dev/null -w "req2 %{http_code}\n" >> /srv/m6/evidence/network/local-curl.log; wait $p || true'
```

### 3.2 同步关系

| 时点 | 动作 | 保证 |
|---|---|---|
| t0 | `test ! -e ...local-capture.pcap` | T0 从空 `evidence/network` 开始；有旧 pcap 即停止，不覆盖 |
| t0 | `timeout 9 tcpdump -U -ni lo -w ... & p=$!` | 抓包先启动；内层 `timeout 9` 是唯一结束条件 |
| t0+2s | `sleep 2` + `test -f ...local-capture.pcap` | 等待 pcap 文件创建；失败即退出，不发请求 |
| t0+2s～t0+5s | 第一次 `curl -m 3`，写 `req1` | 抓包已运行，覆盖第一次请求 |
| t0+5s～t0+8s | 第二次 `curl -m 3`，写 `req2` | 抓包仍在运行，覆盖第二次请求 |
| t0+9s | 内层 `timeout 9` 终止 tcpdump | 两次请求（≤6s）之后才停止 |
| t0+9s+ | `wait $p || true` | 等待进程退出和 pcap flush；吸收 timeout 的预期退出码 124 |
| 外层 | `timeout 12` | 整体硬上限，防止异常挂起 |

关键不变量：

- 抓包窗口 `[t0, t0+9s]` 覆盖请求窗口 `[t0+2s, t0+8s]`。
- 两次 `curl` 合计最多 6s；`sleep 2` + 6s = 8s < 9s。
- `tcpdump -U` 使用包缓冲写入，`wait` 保证进程退出后再进入 C15 验收。
- 不使用 `-c 20`；不使用 `kill`；不修改防火墙；不访问生产 IP/域名；不查询 DNS。

---

## 4. C15 pcap 验收方法（E4）

### 4.1 C15 精确命令（两份文档完全一致）

```bash
test -s /srv/m6/evidence/network/local-capture.pcap
stat -c '%s %n' /srv/m6/evidence/network/local-capture.pcap
sha256sum /srv/m6/evidence/network/local-capture.pcap > /srv/m6/evidence/network/local-capture.pcap.sha256
tcpdump -nn -tttt -r /srv/m6/evidence/network/local-capture.pcap "tcp port 18443 and host 127.0.0.1" > /srv/m6/evidence/network/local-capture.txt
awk 'END{if(NR<2) exit 1; print NR}' /srv/m6/evidence/network/local-curl.log > /srv/m6/evidence/network/local-curl.count
awk '/Flags \[S\]/{for(i=1;i<=NF;i++) if($i ~ /^127\.0\.0\.1\.[0-9]+$/){split($i,a,"."); seen[a[5]]=1}} END{n=0; for(p in seen)n++; if(n<2) exit 1; print n}' /srv/m6/evidence/network/local-capture.txt > /srv/m6/evidence/network/local-capture.connections
```

### 4.2 证明逻辑

| 验收项 | 命令 | 通过标准 |
|---|---|---|
| pcap 非空 | `test -s` | 文件存在且大小 >0 |
| 字节数 | `stat -c` | 记录实际大小 |
| 完整性 | `sha256sum` | 生成 `.sha256`，归档 |
| 本地过滤 | `tcpdump -r` | 回放输出只含 `127.0.0.1:18443` 本地测试流量 |
| 两次请求日志 | 第一个 `awk` | `local-curl.log` ≥2 行（`req1`/`req2`） |
| 两个独立连接 | 第二个 `awk` | `Flags [S]` 中不同客户端临时端口 ≥2 |
| 失败处理 | 任一命令非零 | T0 失败，按 §8/§6 停止条件处理 |

说明：HTTPS 负载加密，pcap 不能直接证明 URL 路径；对应关系由“两次 curl 结果行 + 两个独立 TCP 握手 + 同一时间窗口 + 仅本地过滤”共同证明。`tcpdump -r` 是本地 pcap 文件只读回放，不是新抓包、不联网、不访问生产资源。

---

## 5. 命令白名单与双文档一致性复核（E5）

### 5.1 只读一致性脚本输出

```json
{
  "c04_equal": true,
  "c15_equal": true,
  "c04_no_count20": true,
  "c04_has_timeout9": true,
  "c04_has_wait": true,
  "c15_has_readback": true,
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

结论：

- Owner §3/§7 C04/C15 与执行包 §4/§10 C04/C15 精确命令一致。
- 网络隔离原则 8/8 未变。
- 停止条件 11/11 未变。
- 清理/证据导出/销毁 6/6 未变。
- M1–M5 / M6 / M7 边界未变。

### 5.2 命令白名单扫描输出

```json
{
  "docs": 2,
  "bash_blocks": 20,
  "forbidden_hits": [],
  "unknown_first_tokens": []
}
```

禁止模式包括：生产 IP/域名探测、`openssl s_client`、`dig +short`、`curl ... $PROD`、`www.mcuatlas.xyz`、`tcpdump -i any`、`tcpdump -c 20`、`getent hosts`、独立 `kill` 命令、`tcpdump ... host <非 127.0.0.1>`、`rm -rf /`、`S6.log`、`systemd-run`。

新增/调整的 C04/C15 命令均已在 Owner §7 C04/C14/C15 与执行包 §10 同步登记；未新增 root 权限、网络操作或生产访问。

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

- C04 仅监听 `lo`，过滤 `tcp port 18443 and host 127.0.0.1`。
- C15 仅以 `tcpdump -r` 回放本地 pcap，不产生新抓包或网络流量。
- 无生产 IPv4/IPv6 连接试探；无生产域名 DNS；无生产 S6；无 M7。
- 不访问生产证书、DB、H5、Sitemap、Nginx。
- 网络隔离原则 8 条保持不变；外部隔离仍只由本机路由/接口/防火墙/计数器/配置文件证明。

---

## 8. 剩余 BLOCK 与新增风险（E8）

### 8.1 剩余 BLOCK

**无。** `-c 20` 提前退出风险已消除；C04/C15、命令白名单、停止条件、清理策略、网络原则、Manifest 与冻结边界均完成一致性复核。

### 8.2 新增风险（非 BLOCK）

| ID | 风险 | 缓解 |
|---|---|---|
| R-06 | `tcpdump -U` 依赖 VM 内 tcpdump 版本支持该参数 | `tcpdump` 已在运行时清单；T0 用 `test -f`/C15 验收确认 pcap 正常；失败即停止 |
| R-07 | `sleep 2` + `test -f` 是启动就绪守卫，不是密码学证明 | 若 pcap 未创建即 `exit 1`；C15 再验证 pcap 非空、两次请求、两个连接 |
| R-08 | 旧 pcap 可能造成误验收 | `test ! -e ...local-capture.pcap` 要求空 `evidence/network`；有旧文件即停止，不覆盖 |
| R-09 | HTTPS 加密负载不能直接从 pcap 证明 URL 路径 | 以两次 curl 日志、两个独立 TCP 握手、同一时间窗口、仅本地过滤共同证明；已写入 §4 |

---

## 9. 最终判定（E9）

**PASS：C04 抓包完整性整改后，仍具备提交 Owner 书面审批的条件。**

依据：

1. `tcpdump -c 20` 提前退出风险已分析并确认存在，原命令不可靠（E2）。
2. C04 改为 `timeout 9` + `sleep 2` + 两次 `curl -m 3` + `wait` 的确定性时间窗口；不使用 `-c 20`（E3）。
3. C15 提供 pcap 非空、SHA-256、本地过滤回放、两次 curl 日志、两个独立 TCP 连接的验收（E4）。
4. 两份文档 C04/C15 精确命令一致；20 个 bash 块禁止项 0、白名单外首命令 0；停止/清理/网络原则未变（E5）。
5. Manifest `8f8ca65…7b` 未变；受控组件 `bad=[]`；M1–M5 关键哈希 9/9 未变（E6）。
6. 无生产网络接触、无新增权限/网络操作、无剩余 BLOCK（E7/E8）。

边界：

- Owner 仍需出具**独立书面批准**；本报告不构成批准。
- M6 未执行；T0–T10/S1–S5 未运行；未创建 VM、用户、组、目录、unit；未连接或操作生产服务器。
- M7 未启动；生产部署不批准。
- 本轮未运行任何 M6 测试；未执行 `tcpdump`、`curl`、`getent hosts` 或现场清理/销毁。
