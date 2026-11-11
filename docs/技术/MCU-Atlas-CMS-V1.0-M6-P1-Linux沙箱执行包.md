# MCU Atlas CMS V1.0 · M6-P1 Linux 沙箱执行包（B-01～B-10 整改版）

| 项 | 值 |
|---|---|
| 日期 | 2026-11-11 |
| 版本 | V1.4（C04/C15 验收逻辑最终修复） |
| 依据 | 《M6-P1 授权前最终核对完整证据报告》B-01～B-10；R-01 网络证据边界；C04 抓包完整性核对；C04/C15 验收逻辑最终修复 |
| 性质 | 最小文档整改 + 只读核对；**不是执行结果** |
| Manifest | `8f8ca65cbfd0a5fd739bc238f7e41671ce6207480b9820277cc62131fa9fbe7b`（不变） |
| 授权窗口 | 至少 48 小时；含 24 小时 `S0-VM` 被动基线 |
| 网络原则 | **不连接生产主机；不对生产 IP/域名发起任何探测；不查询生产 DNS；不采集生产 S6；抓包仅 `lo` 本机回环** |

> 本文件所有命令必须在 Owner 书面批准后、独立 VM 内、按 `MCU-Atlas-CMS-V1.0-M6-P1-Owner授权申请.md` §7「唯一命令白名单」执行。
> 未列入授权清单的命令不得执行。命令标签：`[只读]`、`[创建]`、`[修改]`、`[证据]`；本版**不提供 `[破坏]` 删除命令**。

---

## 0. B-01～B-10 整改索引

| ID | 本版处理 |
|---|---|
| B-01/B-08 | T0 改为本机路由/接口/防火墙/计数器/配置文件证据；删除生产 IP/域名探测、DNS 查询、S6 |
| B-02 | 授权窗口 ≥48h；24h `S0-VM` 完整保留 |
| B-03/B-04/B-09/B-10 | 所有目录、文件、systemd、root 模拟、tcpdump、证据命令逐项进入 Owner §7 |
| B-05 | §8 停止条件与 Owner §6 完全一致 |
| B-06 | §9 改为证据导出 + Owner 批准后销毁；删除 `rm -rf` |
| B-07 | 删除 `S6.log`；M6 只采集 VM 内证据 |
| R-01 | 抓包改为仅 `lo` + `127.0.0.1:18443` 固定过滤；删除 `getent hosts`，避免 NSS/mDNS 名称解析 |
| C04 | 删除 `-c 20` 与 `wait $p || true` 吞状态；`timeout 9`+`sleep 2`+两次 `curl`（捕获 rc 与 HTTP 200）+`wait` 显式校验 `rc=124`；C15 用 `set -e` 与源端口计数杜绝误判 |

---

## 1. VM 最低要求与执行窗口

| 项 | 要求 |
|---|---|
| OS | Linux，systemd 239 或同代；cgroup v1/v2 路径在 T1 记录 |
| CPU / 内存 / 磁盘 | ≥2 vCPU、≥2 GiB RAM、≥20 GiB 可用磁盘 |
| 运行时 | Node.js 24.x、`nginx`、`openssl`、`curl`、`getent`、`id`、`nft`/`iptables`、`tcpdump`、`strace`、`lsof`、`fuser`、`sha256sum` |
| 网络 | 默认拒绝所有 IPv4/IPv6 出站；仅 loopback + 本地 DNS 配置；**无生产 IP/域名连接目标** |
| 隔离 | 独立可销毁 VM；不得挂载/同步/软链生产 H5、DB、证书、Sitemap |
| 快照 | T0 前创建；失败回滚；结束后按 §9 流程处理 |
| 授权窗口 | 至少 48 小时；前 24 小时完成 `S0-VM` 被动基线，之后才允许启动 CMS/T1 |

`[只读]` 基线（对应 Owner §7 C01）：

```bash
uname -a
systemctl --version
node -v
nginx -v
df -h / /var
free -m
ip -br addr
ip route show
ip -6 route show
```

> 若 24 小时 `S0-VM` 未完整采样并归档，不得启动 CMS；若测试超出 48 小时授权窗口，按 §8 停止并重新申请授权。

---

## 2. 用户、组、目录与权限（对应 Owner §7 C05/C08）

`[创建]`：

```bash
groupadd --system mcucms-publish
useradd --system --home /www/wwwroot/mcu-cms --shell /usr/sbin/nologin mcucms
getent group www || { echo MISSING_WWW_GROUP; exit 1; }

install -d -o root -g root -m 0755 /www/wwwroot/mcu-cms
install -d -o root -g root -m 0755 /www/wwwroot/mcu-cms/app
install -d -o root -g root -m 0755 /www/wwwroot/mcu-cms/app/tools
install -d -o root -g root -m 0555 /www/wwwroot/mcu-cms/ops
install -d -o root -g root -m 0555 /www/wwwroot/mcu-cms/ops/lib
install -d -o mcucms -g mcucms -m 0711 /www/wwwroot/mcu-cms/data
install -d -o mcucms -g mcucms -m 0755 /www/wwwroot/mcu-cms/data/media
install -d -o mcucms -g mcucms -m 0755 /www/wwwroot/mcu-cms/releases
install -d -o mcucms -g mcucms -m 0700 /www/wwwroot/mcu-cms/tmp
install -d -o mcucms -g mcucms -m 0700 /www/wwwroot/mcu-cms/logs
install -d -o root -g root -m 0755 /www/wwwroot/mcu-cms/spool
install -d -o mcucms -g mcucms-publish -m 2770 /www/wwwroot/mcu-cms/spool/incoming
install -d -o root -g root -m 0700 /www/wwwroot/mcu-cms/spool/work
install -d -o root -g mcucms -m 0750 /www/wwwroot/mcu-cms/spool/done
install -d -o root -g mcucms -m 0750 /www/wwwroot/mcu-cms/spool/failed
install -d -o root -g root -m 0750 /var/log/mcu-cms-publish
install -d -o root -g root -m 0750 /www/backup/cms-sitemap
install -d -o root -g www -m 0755 /www/wwwroot/mcu-h5

install -d -o root -g root -m 0755 /srv/m6
install -d -o root -g root -m 0755 /srv/m6/source
install -d -o root -g root -m 0755 /srv/m6/source/manifest
install -d -o root -g root -m 0755 /srv/m6/source/ops
install -d -o root -g root -m 0755 /srv/m6/source/ops/lib
install -d -o root -g root -m 0755 /srv/m6/source/tool
install -d -o root -g root -m 0755 /srv/m6/source/helper
install -d -o root -g root -m 0755 /srv/m6/source/units
install -d -o root -g root -m 0755 /srv/m6/manifest
install -d -o root -g root -m 0755 /srv/m6/ops
install -d -o root -g root -m 0755 /srv/m6/ops/lib
install -d -o root -g root -m 0755 /srv/m6/tool
install -d -o root -g root -m 0755 /srv/m6/helper
install -d -o root -g root -m 0755 /srv/m6/units
install -d -o root -g root -m 0750 /srv/m6/evidence
install -d -o root -g root -m 0750 /srv/m6/evidence/network
install -d -o root -g root -m 0750 /srv/m6/evidence/resources
```

`[只读]` 权限核对（C08/C13）：

```bash
namei -l /www/wwwroot/mcu-cms/spool/incoming
stat -c '%U %G %a %n' /www/wwwroot/mcu-cms/spool/incoming \
  /www/wwwroot/mcu-cms/spool/work \
  /www/wwwroot/mcu-cms/spool/done \
  /www/wwwroot/mcu-cms/spool/failed
getent group mcucms-publish
id mcucms
findmnt -T /www/wwwroot/mcu-h5
findmnt -T /www/wwwroot/mcu-h5 -o TARGET,SOURCE,FSTYPE,OPTIONS
stat -c '%d %i %n' /www/wwwroot/mcu-h5 /srv/m6
readlink -f /www/wwwroot/mcu-h5
ls -la /www/wwwroot/mcu-h5
```

预期：`incoming` `mcucms:mcucms-publish 2770`；`work` `root:root 0700`；`done/failed` `root:mcucms 0750`；H5 为 VM 本地磁盘合成目录，不是挂载/软链生产 H5。

---

## 3. 文件安装与三个 unit（对应 Owner §7 C06/C07）

`/srv/m6/source/` 由 VM 镜像提供本地仓库副本；**不从生产或外部网络复制**。以下命令只在该本地副本与 §2 staging 目录之间安装。

`[修改]` staging 与 manifest 校验：

```bash
install -o root -g root -m 0444 /srv/m6/source/manifest/RELEASE-MANIFEST.json /srv/m6/manifest/RELEASE-MANIFEST.json
install -o root -g root -m 0444 /srv/m6/source/manifest/RELEASE-MANIFEST.json.sha256 /srv/m6/manifest/RELEASE-MANIFEST.json.sha256
install -o root -g root -m 0444 /srv/m6/source/ops/VERSION /srv/m6/ops/VERSION
install -o root -g root -m 0444 /srv/m6/source/ops/*.cjs /srv/m6/ops/
install -o root -g root -m 0444 /srv/m6/source/ops/lib/*.cjs /srv/m6/ops/lib/
install -o root -g root -m 0444 /srv/m6/source/tool/generate-sitemap.cjs /srv/m6/tool/generate-sitemap.cjs
install -o root -g root -m 0555 /srv/m6/source/helper/mcu-cms-publish /srv/m6/helper/mcu-cms-publish
install -o root -g root -m 0444 /srv/m6/source/units/mcu-cms.service /srv/m6/units/mcu-cms.service
install -o root -g root -m 0444 /srv/m6/source/units/mcu-cms-publish.service /srv/m6/units/mcu-cms-publish.service
install -o root -g root -m 0444 /srv/m6/source/units/mcu-cms-publish.path /srv/m6/units/mcu-cms-publish.path
( cd /srv/m6/manifest && sha256sum -c RELEASE-MANIFEST.json.sha256 )
```

`[修改]` 部署到目标路径：

```bash
install -o root -g root -m 0444 /srv/m6/ops/VERSION /www/wwwroot/mcu-cms/ops/VERSION
install -o root -g root -m 0555 /srv/m6/ops/*.cjs /www/wwwroot/mcu-cms/ops/
install -o root -g root -m 0555 /srv/m6/ops/lib/*.cjs /www/wwwroot/mcu-cms/ops/lib/
install -o root -g root -m 0555 /srv/m6/tool/generate-sitemap.cjs /www/wwwroot/mcu-cms/app/tools/generate-sitemap.cjs
install -o root -g root -m 0755 /srv/m6/helper/mcu-cms-publish /usr/local/sbin/mcu-cms-publish
install -o root -g root -m 0644 /srv/m6/units/mcu-cms.service /etc/systemd/system/mcu-cms.service
install -o root -g root -m 0644 /srv/m6/units/mcu-cms-publish.service /etc/systemd/system/mcu-cms-publish.service
install -o root -g root -m 0644 /srv/m6/units/mcu-cms-publish.path /etc/systemd/system/mcu-cms-publish.path
systemctl daemon-reload
```

`[只读]` 安装后检查：

```bash
systemctl cat mcu-cms.service mcu-cms-publish.service mcu-cms-publish.path
systemctl is-enabled mcu-cms-publish.path
systemctl is-active mcu-cms-publish.path
sha256sum /www/wwwroot/mcu-cms/ops/*.cjs /www/wwwroot/mcu-cms/app/tools/generate-sitemap.cjs
```

启停顺序：

1. `[修改]` `systemctl enable --now mcu-cms.service`（T1）。
2. **T4 通过前 path 必须 disabled/stopped**。
3. `[修改]` T4 通过后：`systemctl enable --now mcu-cms-publish.path`（T2）。
4. `[只读]` `systemctl status mcu-cms.service` / `journalctl -u mcu-cms-publish.service`。

不创建 timer；不使用 `systemctl edit`；不以 `systemd-run` 作为验收依据。

---

## 4. T0 本机网络隔离证据（对应 Owner §7 C02/C03/C04/C13）

统一原则（与 Owner §3 完全一致）：

1. M6 VM 不连接生产主机。
2. 不对生产 IPv4/IPv6 发起 TLS、HTTP、TCP 探测。
3. 不使用 `curl`、`openssl s_client` 等命令访问生产 IP。
4. 不查询生产域名 DNS；不采集生产 S6；不使用 `getent hosts www.m6.local`，避免 NSS/mDNS 产生非预期解析网络行为。
5. T0 只检查 VM 本机路由、网络接口、出站防火墙规则、计数器、配置文件及隔离配置。
6. 外部网络隔离证据只使用本机路由表、接口配置、出站防火墙规则、规则计数器和 VM 网络配置；**不使用宽泛抓包证明外部隔离**。
7. 本机回环 HTTP 只通过 `curl --resolve www.m6.local:18443:127.0.0.1` 与 `tcpdump -i lo` 的固定本地过滤条件验证。
8. 无法证明隔离时，立即停止；**不得通过访问生产服务来验证隔离**。

`[只读]` 本机接口、路由、防火墙、计数器与配置（外部隔离证据）：

```bash
ip -br addr
ip route show
ip -6 route show
cat /etc/resolv.conf
resolvectl status 2>/dev/null || true
nft list ruleset 2>/dev/null || iptables -S
iptables -L -v -n 2>/dev/null || true
ip6tables -S 2>/dev/null || true
ip6tables -L -v -n 2>/dev/null || true
cat /proc/net/nf_conntrack 2>/dev/null || true
ss -ltnup
for f in /etc/nftables.conf /etc/iptables/rules.v4 /etc/iptables/rules.v6 /etc/sysctl.conf; do [ -f "$f" ] && sha256sum "$f"; done
```

`[证据]` 本机回环 HTTP 抓包（C04 完整性整改后精确命令；仅验证本机回环服务，不证明外部隔离；**不使用 `-c 20` 作为结束条件**）：

```bash
timeout 12 sh -c 'umask 0027; test ! -e /srv/m6/evidence/network/local-capture.pcap || exit 1; timeout 9 tcpdump -U -ni lo -w /srv/m6/evidence/network/local-capture.pcap "tcp port 18443 and host 127.0.0.1" & p=$!; sleep 2; test -f /srv/m6/evidence/network/local-capture.pcap || exit 1; code1=$(curl -m 3 -sS --resolve www.m6.local:18443:127.0.0.1 https://www.m6.local:18443/ -o /dev/null -w "%{http_code}"); rc1=$?; code2=$(curl -m 3 -sS --resolve www.m6.local:18443:127.0.0.1 https://www.m6.local:18443/ -o /dev/null -w "%{http_code}"); rc2=$?; echo "req1 rc=$rc1 code=$code1" > /srv/m6/evidence/network/local-curl.log; echo "req2 rc=$rc2 code=$code2" >> /srv/m6/evidence/network/local-curl.log; if [ "$rc1" -ne 0 ] || [ "$rc2" -ne 0 ] || [ "$code1" != "200" ] || [ "$code2" != "200" ]; then echo "curl check failed"; exit 1; fi; wait $p; rc=$?; if [ "$rc" -ne 124 ]; then echo "capture abnormal exit $rc"; exit 1; fi'
```

命令边界与同步关系：

- 执行身份：root（仅 `tcpdump` 抓包需要），在独立 VM 内执行。
- 接口：仅 `lo`；**禁止 `-i any`、其他网卡或混杂捕获管理/监控流量**。
- 过滤条件：`tcp port 18443 and host 127.0.0.1`；只捕获本机测试所需流量。
- 输出路径：`/srv/m6/evidence/network/local-capture.pcap`、`/srv/m6/evidence/network/local-curl.log`；`umask 0027` 保证 root:root 0640。
- 启动：`test ! -e ...local-capture.pcap` 要求 T0 从空 `evidence/network` 开始；`timeout 9 tcpdump ... & p=$!` 先启动抓包；`sleep 2` + `test -f` 等待 pcap 创建后才发请求。
- 两次请求：两次 `curl -m 3`（合计 ≤6s）分别捕获退出码 `rc1`/`rc2` 与 HTTP 状态码 `code1`/`code2`，写入 `local-curl.log`；预期 `200`；任一 `rc≠0` 或 `code≠200` 立即 `exit 1`。
- 停止：内层 `timeout 9` 在两次请求之后终止 tcpdump；`tcpdump -U` 包缓冲写入；`wait $p; rc=$?` 必须校验 `rc=124`，否则 `exit 1`；外层 `timeout 12` 触发时整个命令被杀死并返回 `124`，T0 失败。不再使用 `wait $p || true`。
- 名称解析：仅 `curl --resolve ...127.0.0.1`；**不执行 `getent hosts`，不触发 NSS/mDNS**。
- 权限：不加 `CAP_DAC_OVERRIDE`；不改防火墙；不访问生产 IP/域名；不查询 DNS。

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
- 任一 C15 必要检查非零退出即 T0 失败，按 §8 停止条件处理。

`[只读]` 合成 H5 目录核验：

```bash
findmnt -T /www/wwwroot/mcu-h5
findmnt -T /www/wwwroot/mcu-h5 -o TARGET,SOURCE,FSTYPE,OPTIONS
stat -c '%d %i %n' /www/wwwroot/mcu-h5 /srv/m6
readlink -f /www/wwwroot/mcu-h5
ls -la /www/wwwroot/mcu-h5
```

证据目录：`/srv/m6/evidence/network/`。记录命令、时间、退出码、stdout/stderr、规则计数器、配置文件 SHA-256、`local-capture.pcap`、`local-curl.log`、C15 输出的 `.sha256`、`.txt`、`.all.txt`、`.count`、`.connections`。

通过标准：

1. 默认出站策略为 reject/drop；若 accept，必须有覆盖全部 IPv4/IPv6 出站的 drop 规则。
2. 所有网卡、IPv4/IPv6 路由、监听端口已记录；无 0.0.0.0/公网监听。
3. 外部隔离由路由表、接口配置、防火墙规则、规则计数器、配置文件和 VM 网络配置证明；不使用宽泛抓包。
4. C04 两次 `curl` 均 `rc=0` 且 HTTP `200`；C15 在 `set -e` 下全通过：pcap 非空、`sha256sum` 已记录、`tcpdump -r` 回放仅含 `127.0.0.1`（无其它地址）、`local-curl.log` ≥2 行、不同客户端临时端口 ≥2；任一必要检查失败整体失败；无其他网卡流量。
5. 不执行 `getent hosts`，无生产域名 DNS 查询、无 mDNS/NSS 解析探测。
6. H5 为 VM 本地合成目录；`findmnt` 非 NFS/CIFS/9p/virtiofs/宿主机绑定挂载。
7. 无法证明隔离、发现非预期出站连接或发现生产资源触碰 → 按 §8 停止。

---

## 5. T4 真实 unit 权限与空 capability（对应 Owner §7 C07/C08/C09）

`[只读]`：

```bash
systemctl show -p User -p Group -p SupplementaryGroups -p CapabilityBoundingSet \
  -p AmbientCapabilities -p NoNewPrivileges -p ProtectSystem \
  -p ReadWritePaths -p ReadOnlyPaths -p LogsDirectory \
  mcu-cms.service mcu-cms-publish.service
systemctl is-enabled mcu-cms-publish.path
stat -c '%U %G %a %n' /www/wwwroot/mcu-cms/spool/incoming \
  /www/wwwroot/mcu-cms/spool/work /var/log/mcu-cms-publish
namei -l /www/wwwroot/mcu-cms/spool/incoming
```

`[创建/测试]` 合成两个独立 probe；第一个供 `setpriv` 组权限验证，第二个供真实 service 触发：

```bash
runuser -u mcucms -- sh -c 'umask 0027; printf "%s" "$REQ_JSON" > /www/wwwroot/mcu-cms/spool/incoming/probe-a.req; chmod 0640 /www/wwwroot/mcu-cms/spool/incoming/probe-a.req'
runuser -u mcucms -- sh -c 'umask 0027; printf "%s" "$REQ_JSON" > /www/wwwroot/mcu-cms/spool/incoming/probe-b.req; chmod 0640 /www/wwwroot/mcu-cms/spool/incoming/probe-b.req'
stat -c '%U %G %a %n' /www/wwwroot/mcu-cms/spool/incoming/probe-*.req
systemctl start mcu-cms-publish.service
journalctl -u mcu-cms-publish.service --since "2 min ago" -o cat
```

`[只读]` 负向与 root 模拟：

```bash
runuser -u mcucms -- ls /www/wwwroot/mcu-cms/spool/work
runuser -u mcucms -- touch /www/wwwroot/mcu-h5/sitemap.xml
runuser -u mcucms -- touch /var/log/mcu-cms-publish/publish.log
setpriv --reuid=0 --regid=0 --clear-groups --groups=mcucms-publish \
  --inh-caps=-all --ambient-caps=-all --bounding-set=-all \
  sh -c 'id; cat /www/wwwroot/mcu-cms/spool/incoming/probe-a.req >/dev/null; mv /www/wwwroot/mcu-cms/spool/incoming/probe-a.req /www/wwwroot/mcu-cms/spool/work/probe-a.req'
```

- `setpriv` 仅用于验证组权限 + 空 capability 下读 0640/rename；不代替真实 unit 判定。
- `systemd-run` 不作为验收依据；最终判定必须使用真实 `mcu-cms-publish.service`。
- 空 capability 下读 0640/rename 失败即 T4 FAIL；不得加 `CAP_DAC_OVERRIDE`。

---

## 6. S0-VM 与 S1–S5 资源采样（对应 Owner §7 C10）

前置：授权窗口至少 48 小时；前 24 小时完成 `S0-VM` 被动基线采样并归档，之后才允许启动 CMS/T1。

数据目录：`/srv/m6/evidence/resources/`。

`[证据]` 初始化：

```bash
install -d -m 0755 /srv/m6/evidence/resources
getconf PAGESIZE > /srv/m6/evidence/resources/pagesize.txt
systemctl show -p MainPID mcu-cms.service > /srv/m6/evidence/resources/mainpid.txt
```

`[证据]` 2 秒采样（每场景分别起停；`SCENARIO` 仅取 `S0-VM`、`S1`…`S5`）：

```bash
while :; do
  echo "$(date +%s) $(awk '/MemAvailable/{print $2}' /proc/meminfo) \
$(awk '/pswpin|pswpout/{printf "%s ",$2}' /proc/vmstat) \
$(awk '/^rss |^cache /{printf "%s ",$2}' /sys/fs/cgroup/memory/system.slice/mcu-cms.service/memory.stat 2>/dev/null) \
$(awk '/^oom_kill|^oom /{printf "%s ",$2}' /proc/vmstat 2>/dev/null)" \
  >> "/srv/m6/evidence/resources/${SCENARIO}.log"
  sleep 2
done
```

原始文件仅：`S0-VM.log`、`S1.log` … `S5.log`、`http.jsonl`、`build-ms.txt`。**不采集生产 S0/S6，不生成 `S6.log`。**

指标计算（沿用 V1.4，阈值不改）：

- `C_idle` = S1 最后 5min `memory.stat:rss` 中位；
- `C_base` = S2 前 5min 中位；
- `B_total` = S3/S4 构建开始−1min 到结束+1min 的 cgroup anon `rss` 2s max；
- `M_min` = S4/S5 构建开始至结束+5min 的 `MemAvailable` 2s min；
- `SW` = (`pswpout_end − pswpout_start`) × `getconf PAGESIZE` / 1MiB；
- `OOM` = cgroup `oom_kill` + dmesg；
- `FAILCNT` = cgroup `memory.failcnt` 差；
- `HTTP` = 20rps × 60s 的成功率/P95/5xx。

所有阈值仍为预设验收标准，不是实测结论。M6 只采集沙箱 VM 内证据。

---

## 7. T0–T10 顺序、输入、预期、停止

前置：`S0-VM` 24h 已完成并归档；manifest SHA 一致；`mcu-cms-publish.path` disabled/stopped；合成 H5 已核验。

| 顺序 | 测试 | 输入 | 预期 | 停止条件 |
|---|---|---|---|---|
| 0 | T0 预检 | manifest、本机网络规则/路由/计数器、快照、合成 H5 | 哈希一致；本机隔离证据完整；path disabled；无生产挂载 | 隔离无法证明、出现非预期出站、哈希不符、生产挂载 |
| 1 | T4 权限隔离 | 真实 unit + probe | 组权限可读/rename；mcucms 不能访问 work/写 H5/其他日志 | 越权、空 capability 下失败 |
| 2 | T1 服务 | CMS unit | start/health/stop/kill/restart；`CapEff=0` | 公网监听、崩溃循环、DB 损坏 |
| 3 | T3 spool | 正常/异常/重复请求 | 锁、claim、failed/done、不覆盖 work | 请求丢失、冲突覆盖 |
| 4 | T2 path | 1/重复/12 请求 | 单轮 ≤10；重复不重复执行；剩余人工启动可处理 | 永久滞留且无兜底 |
| 5 | T5 切换 | 两个 release | 软链 + sitemap 一致；中断后 `inspectLive` 能识别 | 混合状态未收敛 |
| 6 | T8 桩页 HTTP | published/unpublished/archived | 200/noindex/canonical/无正文/无 Article LD | 404/index/正文泄露 |
| 7 | T9 页面 HTTP | 60 篇 | 文章/列表/分类/CSS/Sitemap 200 且内容正确 | MIME/分页/sitemap 异常 |
| 8 | T6 恢复 | 合成 DB 备份 | 停服后恢复；WAL/SHM 处理；pre_restore 保留 | 带写入恢复、丢数据 |
| 9 | T7 并发约束 | 写入循环 | 未停服流程中止；停服后恢复 | 流程绕过停服 |
| 10 | T10 中断/I1–I6 | F1–F13 注入 | 状态机收敛；I1–I6 true | 静默成功、永久不一致 |

---

## 8. 停止条件（两份文档完全一致）

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

## 9. 清理、证据导出与 VM 销毁（两份文档完全一致，对应 Owner §7 C11/C12）

1. 测试结束后停止相关服务。
2. 整理并导出 `/srv/m6/evidence/` 证据。
3. 对导出文件计算 SHA-256。
4. 核对证据完整性。
5. 向 Owner 提交证据清单。
6. Owner 明确批准后，销毁独立 Linux VM。

`[修改]` 停止服务（不销毁）：

```bash
systemctl stop mcu-cms-publish.path mcu-cms-publish.service mcu-cms.service
systemctl disable mcu-cms-publish.path
```

`[证据]` 打包与完整性校验：

```bash
journalctl -u mcu-cms.service -u mcu-cms-publish.service --since "1 hour ago" > /srv/m6/evidence/journal.txt
tar -czf /srv/m6/evidence/final.tar.gz /srv/m6/evidence
sha256sum /srv/m6/evidence/final.tar.gz > /srv/m6/evidence/final.tar.gz.sha256
```

- 不得使用无边界 `rm -rf` 清理证据、系统目录或未明确授权的路径。
- 不得删除尚未完成导出的证据。
- 如确实需要删除 VM 内临时文件，必须列明精确路径、删除目的和授权范围；**本执行包未授权任何 `rm -rf` 或等价删除命令**。
- VM 销毁由 Owner/运维在证据归档并再次明确批准后执行；不得在生产主机执行。

---

## 10. 命令—授权索引（所有实际命令对应 Owner §7）

| 执行包章节 | Owner §7 授权 ID | 说明 |
|---|---|---|
| §1 | C01 | 本机只读基线 |
| §2 | C05、C08、C13 | 用户/组/目录创建、权限与 H5 本机核验 |
| §3 | C06、C07 | staging/install/manifest 校验、systemd 安装与启停 |
| §4 | C02、C03、C04、C13、C15 | 本机网络规则/计数/配置、C04 精确本机回环抓包、C15 pcap 只读验收、合成 H5；不含名称解析 |
| §5 | C07、C08、C09 | 真实 unit、权限负向、setpriv root 模拟 |
| §6 | C10 | S0-VM/S1–S5 采样 |
| §9 | C11、C12 | 证据打包、停止服务 |
| 全文 | C14 | shell 控制结构与内建命令（含 C04/C15 所需 `set -e`、`$(...)`、`&`、`wait`、`p=$!`、`rc=$?`、`sleep`、`!` 取反、逻辑或） |
| 全文 | C15 | pcap 只读验收（`set -e`、源端口计数、整体失败传递）；精确命令见 §4，与 Owner §3 C15 完全一致 |

**未列入 Owner §7 的命令不得执行。** 禁止生产 IP/域名探测、生产 DNS 查询、生产 S6、`tcpdump -i any` 宽泛抓包、`tcpdump -c 20` 作为 C04 结束条件、`getent hosts www.m6.local`、NSS/mDNS 名称解析探测、`rm -rf`、`systemd-run` 验收、权限扩大、timer、M7 与生产部署；**禁止 `wait $p || true` 吞掉抓包进程退出状态；禁止将服务端端口 18443 计入客户端连接计数**。

---

## 11. 适用边界

- 本包不含生产 S0/S6、C1 证书、Nginx 生产变更、M7、正式部署。
- M6 只采集独立 VM 内证据；M7 生产恢复演练继续独立冻结，不得混入 M6。
- 所有命令需在 Owner 书面授权、独立 VM、固定 manifest SHA 下才允许执行。
- 本地 Windows 结果不能替代 Linux DAC/systemd/POSIX symlink 验证。
- 本整改版不创建 VM、用户、组、目录、unit、spool；不运行 T0–T10/S1–S5；不连接或操作生产服务器。
