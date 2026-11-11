# M6 Linux 沙箱执行授权申请（B-01～B-10 整改版）

| 项 | 值 |
|---|---|
| 日期 | 2026-11-11 |
| 版本 | V1.4（C04/C15 验收逻辑最终修复） |
| 依据 | 《M6-P1 授权前最终核对完整证据报告》B-01～B-10；R-01 网络证据边界；C04 抓包完整性核对；C04/C15 验收逻辑最终修复 |
| 性质 | 最小文档整改 + 只读核对；**不执行 M6、不创建资源、不连接生产服务器** |
| 批准对象 | 当前 `mcu-cms/ops/RELEASE-MANIFEST.json` |
| **Manifest 完整 SHA-256** | `8f8ca65cbfd0a5fd739bc238f7e41671ce6207480b9820277cc62131fa9fbe7b` |
| 外部哈希 | `mcu-cms/ops/RELEASE-MANIFEST.json.sha256` |
| 旧哈希 | `a4e171…09e1` 已失效，不得批准 |
| Manifest 更新 | **不需要**；两份授权文档不在 manifest 受控组件内，本轮不修改 ops 代码/测试/unit 草案 |

> 本申请需 Owner **独立书面批准**。manifest 内 `signed_by/signed_at` 不能代替签字。
> Owner 书面记录必须包含完整 manifest SHA、批准范围、批准日期、签字人和授权窗口；manifest 任何字段变化即批准失效。
> **未列入 §7 唯一命令白名单的命令不得执行；不得仅以“T0–T10 已授权”代替具体系统操作授权。**

---

## 0. 整改声明

本版解决 B-01～B-10：

- 彻底取消生产 IP/域名连接试探、生产 DNS 查询和生产 S6。
- 授权窗口调整为至少 48 小时，保留 24 小时 `S0-VM` 基线。
- 逐项列明 VM、用户组、目录、文件、systemd、root 模拟、抓包、证据打包等系统操作。
- 统一停止条件、清理/证据导出/VM 销毁流程。
- M6 只采集独立 VM 内证据；M7 生产恢复演练继续独立冻结。

---

## 1. Owner 必须批准的完整事项

| # | 批准事项 | 本申请对应章节 |
|---|---|---|
| 1 | 允许创建独立 Linux VM，并在证据归档且 Owner 再次明确批准后销毁 | §2、§7 |
| 2 | 允许使用 ≥2 vCPU、≥2 GiB RAM、≥20 GiB 可用磁盘，授权有效期至少 48 小时 | §2 |
| 3 | 允许创建 `mcucms` 系统用户和 `mcucms-publish` 系统组 | §4.1、§7 C05 |
| 4 | 允许创建 §4.2 全部目录，且精确 owner/group/mode 不得偏离 | §4.2 |
| 5 | 允许创建和安装 `/srv/m6/` 下 manifest、ops、tool、helper、units、evidence 文件 | §4.3、§7 C06 |
| 6 | 每个文件的来源、目标路径、owner、group、mode 均已列明 | §4.3 |
| 7 | 允许三个 systemd unit 的安装、`daemon-reload`、`enable`、`start`、`stop`、`disable` | §4.4、§7 C07 |
| 8 | 允许 T4 中 `setpriv --reuid=0 --regid=0 ...` 的 root 模拟，仅用于组权限/空 capability 验证 | §4.5、§7 C09 |
| 9 | 允许 C04 仅在 `lo` 接口、固定本地过滤条件和固定输出路径被动抓包；允许 C15 只读回放本地 pcap 并做完整性验收；不采集其他网卡流量 | §3、§7 C04/C15 |
| 10 | 允许 `tar`、`sha256sum` 打包和校验 `/srv/m6/evidence/` 证据 | §7 C11 |
| 11 | 允许 `/srv/m6/evidence/` 下全部证据目录及写入范围 | §4.2、§4.6、§7 C10/C11 |
| 12 | 允许测试期间的限定 root 权限；明确禁止任何权限扩大行为 | §8 |

---

## 2. VM、资源规格与授权窗口

- **允许创建和销毁独立 Linux VM**；VM 必须与生产环境隔离，systemd 239 或同代。
- 资源规格：≥2 vCPU、≥2 GiB RAM、≥20 GiB 可用磁盘。
- 运行时：Node.js 24.x、Nginx、OpenSSL、curl、getent/id、nft/iptables、tcpdump、strace、lsof/fuser、sha256sum。
- **授权有效期至少 48 小时**：
  - 前 24 小时用于 `S0-VM` 被动基线采样，**必须完整保留**；采样结束并归档后才允许启动 CMS/T1。
  - 其余时间用于 T0–T10、S1–S5、复核和证据整理。
  - 不得通过缩短基线、跳过测试或伪造采样结果满足期限。
  - 若实际测试超出授权窗口，立即停止并重新申请授权。
- 不申请付费服务；不连接生产主机；不使用生产凭证；不挂载生产数据。

---

## 3. 网络隔离范围与证据（B-01、B-08、R-01）

统一原则（与 Linux 执行包 §4 完全一致）：

1. M6 VM 不连接生产主机。
2. 不对生产 IPv4/IPv6 发起 TLS、HTTP、TCP 探测。
3. 不使用 `curl`、`openssl s_client` 等命令访问生产 IP。
4. 不查询生产域名 DNS；不采集生产 S6；不使用 `getent hosts www.m6.local`，避免 NSS/mDNS 产生非预期解析网络行为。
5. T0 只检查 VM 本机路由、网络接口、出站防火墙规则、计数器、配置文件及隔离配置。
6. 外部网络隔离证据只使用本机路由表、接口配置、出站防火墙规则、规则计数器和 VM 网络配置；**不使用宽泛抓包证明外部隔离**。
7. 本机回环 HTTP 只通过 `curl --resolve www.m6.local:18443:127.0.0.1` 与 `tcpdump -i lo` 的固定本地过滤条件验证。
8. 无法证明隔离时，立即停止；**不得通过访问生产服务来验证隔离**。

允许的网络证据：

- IPv4/IPv6 出站默认拒绝规则：`nft list ruleset`、`iptables -S`、`iptables -L -v -n`、`ip6tables -S`、`ip6tables -L -v -n`。
- 本机接口/路由/监听：`ip -br addr`、`ip route show`、`ip -6 route show`、`ss -ltnup`。
- 本机配置/计数器/VM 网络配置：`cat /etc/resolv.conf`、`resolvectl status`、`cat /proc/net/nf_conntrack`、配置文件 SHA-256。
- 外部隔离：只以上述本机规则、路由表、计数器、配置文件作为证据；禁止 `-i any` 宽泛抓包。
- 本地回环：仅 `curl --resolve www.m6.local:18443:127.0.0.1 ...`；**不执行 `getent hosts` 或任何名称解析**。
- 本机回环抓包（C04 完整性整改后精确命令；**不使用 `-c 20` 作为结束条件**）：

```bash
timeout 12 sh -c 'umask 0027; test ! -e /srv/m6/evidence/network/local-capture.pcap || exit 1; timeout 9 tcpdump -U -ni lo -w /srv/m6/evidence/network/local-capture.pcap "tcp port 18443 and host 127.0.0.1" & p=$!; sleep 2; test -f /srv/m6/evidence/network/local-capture.pcap || exit 1; code1=$(curl -m 3 -sS --resolve www.m6.local:18443:127.0.0.1 https://www.m6.local:18443/ -o /dev/null -w "%{http_code}"); rc1=$?; code2=$(curl -m 3 -sS --resolve www.m6.local:18443:127.0.0.1 https://www.m6.local:18443/ -o /dev/null -w "%{http_code}"); rc2=$?; echo "req1 rc=$rc1 code=$code1" > /srv/m6/evidence/network/local-curl.log; echo "req2 rc=$rc2 code=$code2" >> /srv/m6/evidence/network/local-curl.log; if [ "$rc1" -ne 0 ] || [ "$rc2" -ne 0 ] || [ "$code1" != "200" ] || [ "$code2" != "200" ]; then echo "curl check failed"; exit 1; fi; wait $p; rc=$?; if [ "$rc" -ne 124 ]; then echo "capture abnormal exit $rc"; exit 1; fi'
```

  - 用途：仅验证 VM 本机回环 HTTP 服务，不证明外部网络隔离。
  - 执行身份：root（仅 `tcpdump` 抓包需要），在独立 VM 内执行。
  - 接口：仅 `lo`；**禁止 `-i any`、其他网卡或混杂捕获管理/监控流量**。
  - 过滤条件：`tcp port 18443 and host 127.0.0.1`；只捕获本机测试所需流量。
  - 输出路径：`/srv/m6/evidence/network/local-capture.pcap`、`/srv/m6/evidence/network/local-curl.log`；`umask 0027` 保证 root:root 0640。
  - 同步关系：
    1. `test ! -e ...local-capture.pcap` 要求 T0 从空 `evidence/network` 开始；若有旧 pcap 即停止，不覆盖。
    2. `timeout 9 tcpdump ... & p=$!` 先启动抓包；内层 `timeout 9` 是唯一结束条件。
    3. `sleep 2` + `test -f ...local-capture.pcap` 等待 pcap 已创建，之后才发出请求。
    4. 两次 `curl -m 3`（合计 ≤6s）分别捕获退出码 `rc1`/`rc2` 与 HTTP 状态码 `code1`/`code2`，写入 `local-curl.log`；本机服务预期状态码 `200`。
    5. 若任一 `rc≠0` 或 `code≠200`，C04 立即 `exit 1`；内层 `timeout 9` 在两次请求之后终止 tcpdump；`wait $p; rc=$?` 必须校验 `rc=124`（内层 timeout 正常停止），否则 `exit 1`；外层 `timeout 12` 触发时整个命令被杀死并返回 `124`，T0 失败。不再使用 `wait $p || true`。
  - 抓包结束机制：不使用 `-c 20`；`tcpdump -U` 包缓冲写入；内层 `timeout 9` 结束；`wait` 后显式校验退出码，异常退出或外层超时均判失败，不会被后续 pcap 存在掩盖；抓包窗口 `[t0, t0+9s]` 覆盖请求窗口 `[t0+2s, t0+8s]`。
  - 权限边界：不加 `CAP_DAC_OVERRIDE`；不改防火墙；不访问生产 IP/域名；不查询 DNS；不使用 `getent hosts`。

`[证据]` pcap 验收（C15 精确命令；只读回放本地 pcap，不抓包、不联网）：

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

验收解释：

- `set -e` 保证任一必要检查失败立即终止，整体返回失败；不会出现前项失败、末项成功却判 PASS。
- `test -s` 证明 pcap 非空；`stat -c` 记录字节数；`sha256sum` 记录完整性。
- `tcpdump -r` 使用同一本地过滤条件回放输出 `local-capture.txt`；另一次无过滤回放 `local-capture.all.txt`；`set -e` 下先 `test -s` 确保回放非空，再由 `awk` 检查：任一字段为 `IP6`（IPv6 报文）立即 `exit 1`；其余 IPv4 字面量必须全为 `127.0.0.1`，否则失败；确保 pcap 仅含本机 IPv4 回环流量、无其它地址、无 IPv6。
- `n=$(awk ...)` 统计 `local-curl.log` 行数并要求 ≥2；`[ "$n" -ge 2 ]` 失败则整体失败。
- 连接计数 `awk` 仅匹配 `127.0.0.1.<clientport> > 127.0.0.1.18443:` 形态（源地址 127.0.0.1、源端口非 18443、目的为 18443），只统计客户端临时端口；服务端端口 18443 不会被计入。要求不同客户端临时端口 ≥2 才通过。
- HTTPS 负载加密，不能从 pcap 直接证明 URL 路径；对应关系由“两次 curl 成功记录（rc=0 且 200）+ 两个独立 TCP 握手 + 同一时间窗口 + 仅本地过滤”共同证明；若 curl 阶段已失败，C04 不会进入 C15。
- 任一 C15 必要检查非零退出即 T0 失败，按 §6 停止条件处理。

IPv4/IPv6 限制：默认拒绝全部出站；仅允许 loopback 与本地 DNS 配置读取；不设置生产 IP 变量；不向生产目标发包；不触发 mDNS/NSS 名称解析。

---

## 4. 允许创建的资源与系统操作

### 4.1 用户与组

| 操作 | 精确命令/参数 | owner/group/mode |
|---|---|---|
| 创建组 | `groupadd --system mcucms-publish` | 系统组，无普通成员 |
| 创建用户 | `useradd --system --home /www/wwwroot/mcu-cms --shell /usr/sbin/nologin mcucms` | 系统用户、nologin |

### 4.2 目录精确矩阵

| 路径 | owner:group | mode | 用途 |
|---|---|---|---|
| `/www/wwwroot/mcu-cms` | root:root | 0755 | CMS 根 |
| `/www/wwwroot/mcu-cms/app` | root:root | 0755 | 冻结代码目录 |
| `/www/wwwroot/mcu-cms/app/tools` | root:root | 0755 | 部署 sitemap 工具 |
| `/www/wwwroot/mcu-cms/ops` | root:root | 0555 | M6 ops 组件 |
| `/www/wwwroot/mcu-cms/ops/lib` | root:root | 0555 | ops 公共库 |
| `/www/wwwroot/mcu-cms/data` | mcucms:mcucms | 0711 | DB 目录 |
| `/www/wwwroot/mcu-cms/data/media` | mcucms:mcucms | 0755 | 合成媒体 |
| `/www/wwwroot/mcu-cms/releases` | mcucms:mcucms | 0755 | 合成 release |
| `/www/wwwroot/mcu-cms/tmp` | mcucms:mcucms | 0700 | 构建临时 |
| `/www/wwwroot/mcu-cms/logs` | mcucms:mcucms | 0700 | 预留日志 |
| `/www/wwwroot/mcu-cms/spool` | root:root | 0755 | spool 父目录 |
| `/www/wwwroot/mcu-cms/spool/incoming` | mcucms:mcucms-publish | **2770** | setgid，请求投递 |
| `/www/wwwroot/mcu-cms/spool/work` | root:root | **0700** | helper 独占 |
| `/www/wwwroot/mcu-cms/spool/done` | root:mcucms | 0750 | 成功结果 |
| `/www/wwwroot/mcu-cms/spool/failed` | root:mcucms | 0750 | 失败结果 |
| `/var/log/mcu-cms-publish` | root:root | 0750 | helper 日志 |
| `/www/backup/cms-sitemap` | root:root | 0750 | sitemap 备份 |
| `/www/wwwroot/mcu-h5` | root:www | 0755 | VM 内合成 H5 根；文件 root:www 0644 |
| `/srv/m6` | root:root | 0755 | VM 本地 staging/evidence 根 |
| `/srv/m6/source` | root:root | 0755 | 本地仓库副本来源；禁止网络/生产复制 |
| `/srv/m6/source/manifest` | root:root | 0755 | manifest 源 |
| `/srv/m6/source/ops` | root:root | 0755 | ops 源 |
| `/srv/m6/source/ops/lib` | root:root | 0755 | ops lib 源 |
| `/srv/m6/source/tool` | root:root | 0755 | sitemap tool 源 |
| `/srv/m6/source/helper` | root:root | 0755 | helper 源 |
| `/srv/m6/source/units` | root:root | 0755 | unit 草案源 |
| `/srv/m6/manifest` | root:root | 0755 | 已批准 manifest staging |
| `/srv/m6/ops` | root:root | 0755 | ops staging |
| `/srv/m6/ops/lib` | root:root | 0755 | ops lib staging |
| `/srv/m6/tool` | root:root | 0755 | tool staging |
| `/srv/m6/helper` | root:root | 0755 | helper staging |
| `/srv/m6/units` | root:root | 0755 | unit staging |
| `/srv/m6/evidence` | root:root | 0750 | 全部证据根 |
| `/srv/m6/evidence/network` | root:root | 0750 | 网络证据 |
| `/srv/m6/evidence/resources` | root:root | 0750 | 资源采样证据 |

> `/www/wwwroot/mcu-h5` 必须是 VM 本地磁盘上的合成目录；禁止挂载、同步、软链到生产 H5。若 `www` 组不存在，停止，不创建额外组。

### 4.3 文件来源、目标、owner、group、mode

| 来源（VM 本地副本） | staging 目标 | staging mode | 部署目标 | 部署 mode |
|---|---|---|---|---|
| `/srv/m6/source/manifest/RELEASE-MANIFEST.json` | `/srv/m6/manifest/RELEASE-MANIFEST.json` | root:root 0444 | 不部署，仅校验 | — |
| `/srv/m6/source/manifest/RELEASE-MANIFEST.json.sha256` | `/srv/m6/manifest/RELEASE-MANIFEST.json.sha256` | root:root 0444 | 不部署，仅校验 | — |
| `/srv/m6/source/ops/VERSION` | `/srv/m6/ops/VERSION` | root:root 0444 | `/www/wwwroot/mcu-cms/ops/VERSION` | root:root 0444 |
| `/srv/m6/source/ops/*.cjs` | `/srv/m6/ops/*.cjs` | root:root 0444 | `/www/wwwroot/mcu-cms/ops/*.cjs` | root:root 0555 |
| `/srv/m6/source/ops/lib/*.cjs` | `/srv/m6/ops/lib/*.cjs` | root:root 0444 | `/www/wwwroot/mcu-cms/ops/lib/*.cjs` | root:root 0555 |
| `/srv/m6/source/tool/generate-sitemap.cjs` | `/srv/m6/tool/generate-sitemap.cjs` | root:root 0444 | `/www/wwwroot/mcu-cms/app/tools/generate-sitemap.cjs` | root:root 0555 |
| `/srv/m6/source/helper/mcu-cms-publish` | `/srv/m6/helper/mcu-cms-publish` | root:root 0555 | `/usr/local/sbin/mcu-cms-publish` | root:root 0755 |
| `/srv/m6/source/units/mcu-cms.service` | `/srv/m6/units/mcu-cms.service` | root:root 0444 | `/etc/systemd/system/mcu-cms.service` | root:root 0644 |
| `/srv/m6/source/units/mcu-cms-publish.service` | `/srv/m6/units/mcu-cms-publish.service` | root:root 0444 | `/etc/systemd/system/mcu-cms-publish.service` | root:root 0644 |
| `/srv/m6/source/units/mcu-cms-publish.path` | `/srv/m6/units/mcu-cms-publish.path` | root:root 0444 | `/etc/systemd/system/mcu-cms-publish.path` | root:root 0644 |
| VM 镜像内合成 H5 文件 | 预置在 `/www/wwwroot/mcu-h5/` | — | 同路径 | 目录 0755 / 文件 0644，root:www |

来源约束：`/srv/m6/source/` 只来自随 VM 镜像提供的本地仓库副本；禁止 `rsync/scp` 从生产或外部网络拉取；不得把 `ops/tests/` 部署进生产路径。

### 4.4 systemd unit 操作

允许且仅允许：

- `systemctl daemon-reload`。
- `systemctl enable --now mcu-cms.service`（T1）。
- `systemctl start mcu-cms-publish.service`（T4 probe，仅一次/按测试需要）。
- T4 通过后 `systemctl enable --now mcu-cms-publish.path`（T2）。
- `systemctl stop mcu-cms-publish.path mcu-cms-publish.service mcu-cms.service`。
- `systemctl disable mcu-cms-publish.path`。
- 只读：`systemctl show`、`systemctl cat`、`systemctl is-enabled`、`systemctl is-active`、`systemctl status`。

`mcu-cms-publish.path` 在 T4 通过前必须 disabled/stopped；**不创建 timer**；不使用 `systemctl edit`；不以 `systemd-run` 作为验收依据。

### 4.5 `setpriv` root 模拟

仅 T4 允许以下精确用途和参数：

```bash
setpriv --reuid=0 --regid=0 --clear-groups --groups=mcucms-publish \
  --inh-caps=-all --ambient-caps=-all --bounding-set=-all \
  sh -c 'id; cat /www/wwwroot/mcu-cms/spool/incoming/probe-a.req >/dev/null; mv /www/wwwroot/mcu-cms/spool/incoming/probe-a.req /www/wwwroot/mcu-cms/spool/work/probe-a.req'
```

- 执行身份：模拟 root（`--reuid=0 --regid=0`），仅补充 `mcucms-publish` 组，清空 capability。
- 目的：验证组权限 + 空 capability 下能读 0640/rename；不代替真实 unit 判定。
- 禁止加入 `CAP_DAC_OVERRIDE`、sudo、setuid 或任意命令。

### 4.6 测试数据、日志与证据范围

- 仅使用合成 DB、媒体、文章、CSS、Sitemap；不访问生产 DB/H5/Sitemap/Nginx/证书。
- 日志写入范围仅：
  - `/var/log/mcu-cms-publish/publish.log`（helper 自身，0640）；
  - `/srv/m6/evidence/**`（测试证据）。
- `/srv/m6/evidence/` 允许写入：`network/`、`resources/`、`journal.txt`、`final.tar.gz`、`final.tar.gz.sha256`、`evidence-manifest.txt`、各场景 `.log`、`http.jsonl`、`build-ms.txt`。
- 不采集生产 S0、生产 S6、生产日志或生产证书信息。M6 只采集沙箱 VM 内证据。

---

## 5. 允许执行范围（不得替代 §7 命令白名单）

- 24 小时 `S0-VM` 被动基线；S0-VM 完成并归档后才允许启动 CMS/T1。
- T0 本机网络隔离证据、T4 真实 unit 权限、T1–T10、S1–S5。
- 仅使用合成数据；仅 VM 本地证据。
- `mcu-cms-publish.path` 在 T4 通过前 disabled，T4 通过后 enable。
- 任何命令必须能在 §7 找到对应授权 ID；未列入的命令不得执行。

---

## 6. 停止条件（两份文档完全一致）

任一命中立即停止后续测试，保留现场和日志，不得自行扩大操作范围：

1. 发现任何生产资源被访问或触碰。
2. 网络隔离无法证明，或发现非预期出站连接。
3. G3 无法可靠拦截目标调用。
4. G4 必须扩大权限、绕过门禁或产生非预期副作用。
5. 需要修改 M1–M5 冻结代码。
6. systemd 239 不支持必要隔离能力且无等价安全方案。
7. Linux DAC、POSIX 切换、回滚或指标验证失败。
8. 出现证据丢失、完整性校验失败或无法解释的异常。
9. Owner 要求停止。
10. 授权窗口到期。
11. 任何关键操作超出书面授权范围。

---

## 7. 唯一命令白名单（所有实际执行命令必须对应）

| ID | 授权命令/操作 | 执行包对应章节 |
|---|---|---|
| C01 | 本机只读基线：`uname -a`、`systemctl --version`、`node -v`、`nginx -v`、`df -h / /var`、`free -m`、`ip -br addr`、`ip route show`、`ip -6 route show` | §1 |
| C02 | 本机网络规则/计数/配置只读：`cat /etc/resolv.conf`、`resolvectl status`、`nft list ruleset`、`iptables -S`、`iptables -L -v -n`、`ip6tables -S`、`ip6tables -L -v -n`、`cat /proc/net/nf_conntrack`、`ss -ltnup`、本地配置文件 `sha256sum` | §4 |
| C03 | 本地回环地址：仅由 C04 精确命令中的 `curl --resolve www.m6.local:18443:127.0.0.1 ...` 使用；禁止 `getent hosts` 与任何名称解析 | §4 |
| C04 | 本机回环抓包：精确命令见 §3；用途=验证本机回环 HTTP；执行身份=root；接口=仅 `lo`；过滤=`tcp port 18443 and host 127.0.0.1`；输出=`local-capture.pcap`、`local-curl.log`；同步/结束机制=`timeout 9`+`sleep 2`+两次 `curl -m 3`+`wait`；**不使用 `-c 20`**；mode=root:root 0640；权限=无 `CAP_DAC_OVERRIDE` | §3、§4 |
| C05 | 创建用户/组/目录：`groupadd --system mcucms-publish`、`useradd --system --home /www/wwwroot/mcu-cms --shell /usr/sbin/nologin mcucms`、`install -d` | §2 |
| C06 | staging/安装/校验：`install`、`sha256sum -c`、`sha256sum`、`cd /srv/m6/manifest`；只允许 §4.3 路径 | §3 |
| C07 | systemd：`systemctl daemon-reload`、`enable --now`、`start`、`stop`、`disable`、`show`、`cat`、`is-enabled`、`is-active`、`status`；只允许 §4.4 三个 unit | §3、§5、§9 |
| C08 | 权限只读/测试准备：`namei -l`、`stat -c`、`getent group`、`id`、`runuser -u mcucms -- sh -c ...`、`chmod 0640`、`ls`、`touch`；不含 `getent hosts` | §2、§5 |
| C09 | root 模拟：§4.5 精确 `setpriv` 命令 | §5 |
| C10 | 资源采样：`install -d /srv/m6/evidence/resources`、`getconf PAGESIZE`、`systemctl show -p MainPID`、`date`、`awk`、`sleep`、`echo`、shell `while` 循环、重定向到 `/srv/m6/evidence/resources/*.log` | §6 |
| C11 | 证据打包：`journalctl -u ... > /srv/m6/evidence/journal.txt`、`tar -czf /srv/m6/evidence/final.tar.gz /srv/m6/evidence`、`sha256sum /srv/m6/evidence/final.tar.gz > /srv/m6/evidence/final.tar.gz.sha256` | §9 |
| C12 | 停止服务：`systemctl stop ...`、`systemctl disable mcu-cms-publish.path` | §9 |
| C13 | 合成 H5 只读核验：`findmnt -T /www/wwwroot/mcu-h5`、`findmnt -T /www/wwwroot/mcu-h5 -o TARGET,SOURCE,FSTYPE,OPTIONS`、`stat -c`、`readlink -f`、`ls -la` | §4 |
| C14 | shell 控制结构与内建命令：`set -e`、命令替换 `$(...)`、`if`、`for`、`while`、`test`/`[ ]`、`!` 取反、逻辑与、逻辑或（两条竖线）、管道、重定向、`echo`、`printf`、`true`、`exit`、`umask`、子 shell、后台 `&`、`wait`、shell 变量赋值（`p=$!`、`rc=$?`、`code1=$(...)`、`n=$(...)` 等）；仅用于上述白名单命令，特别是 C04/C15 | 全文 |
| C15 | pcap 只读验收：精确命令见 §3；`set -e` 顺序执行；`test -s`、`stat -c`、`sha256sum`、`tcpdump -nn -tttt -r`、`awk`、命令替换 `$(...)`、`[ ]` 测试；输出仅 `/srv/m6/evidence/network/` 下的 `.sha256`、`.txt`、`.all.txt`、`.count`、`.connections`；不抓包、不联网、不写业务文件 | §3、§4 |

**明确禁止的命令/动作**：生产 IP/DNS 连接试探、`dig` 查询生产域名、`openssl s_client` 连接生产 IP、`curl` 访问生产 IP、`tcpdump -i any` 宽泛抓包、`tcpdump -c 20` 作为 C04 结束条件、`tcpdump` 以生产 IP/域名或非本机地址过滤、`getent hosts www.m6.local`、任何 NSS/mDNS 名称解析探测、`rm -rf`、`systemd-run` 作为验收依据、`systemctl edit`、`iptables/nft` 修改规则、网络配置修改、防火墙放行、生产挂载/同步、timer、sudoers、setuid、ACL、`CAP_DAC_OVERRIDE`、M7、生产 S0/S6、生产证书/DB/H5/Sitemap/Nginx 操作；**禁止 `wait $p || true` 无条件吞掉抓包进程退出状态；禁止将服务端端口 18443 计入客户端连接计数**。

---

## 8. root 权限与禁止的权限扩大

允许的 root 权限：

- 创建 §4.2 目录，安装 §4.3 文件，安装/启停 §4.4 unit。
- T4 中 §4.5 的 `setpriv` root 模拟。
- `tcpdump` 仅在 `lo` 上按 C04 固定过滤条件被动抓包；C15 仅以 `tcpdump -r` 只读回放本地 pcap；`journalctl`、`tar`、`sha256sum` 证据打包。
- helper 以 root oneshot 执行固定白名单操作：incoming→work rename、done/failed 结果、sitemap/article 切换、专用日志 append；不写 DB、不执行任意命令、不联网。

禁止的权限扩大：

- 不加 `CAP_DAC_OVERRIDE`；不改 sudoers；不设置 setuid/setgid 可执行文件；不使用 ACL 放宽权限；不修改防火墙规则；不添加用户/组；不改内核参数；不创建 timer；不扩大 `ReadWritePaths`；不删除证据；不删除未导出的文件；不访问生产资源。

---

## 9. 清理、证据导出与 VM 销毁（两份文档完全一致）

1. 测试结束后停止相关服务。
2. 整理并导出 `/srv/m6/evidence/` 证据。
3. 对导出文件计算 SHA-256。
4. 核对证据完整性。
5. 向 Owner 提交证据清单。
6. Owner 明确批准后，销毁独立 Linux VM。

- 不得使用无边界 `rm -rf` 清理证据、系统目录或未明确授权的路径。
- 不得删除尚未完成导出的证据。
- 如确实需要删除 VM 内临时文件，必须列明精确路径、删除目的和授权范围；**本申请未授权任何 `rm -rf` 或等价删除命令**。
- VM 销毁由 Owner/运维在证据归档并再次明确批准后执行；不得在生产主机执行。

---

## 10. M1–M5 / M6 / M7 边界

- M1–M5 冻结代码不得修改；如需修改，按 §6 停止条件停止。
- M6 只在独立 VM 内使用合成数据，采集 VM 内证据；不采集生产 S0/S6，不访问生产证书、DB、H5、Sitemap、Nginx。
- T6/T7 是 M6 沙箱内的合成 DB 恢复/并发约束验证，不是 M7。
- M7 生产恢复演练继续独立冻结，不得混入 M6。
- 本授权仅适用于 M6 沙箱；不构成生产部署授权。

---

## 11. 签字

**申请人：CodeBuddy（准备材料）**  
**批准人：Owner（待独立书面批准）**  
**ChatGPT：仅技术复审，不签字**  
**批准记录必须写明：manifest SHA `8f8ca65…7b`、批准范围、授权窗口（≥48h）、批准日期、签字人。**
