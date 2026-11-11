# MCU Atlas CMS V1.0 · M6 准入条件与 Linux 隔离验证实施方案 V1.2

> **已被 V1.3 / V1.4 取代。** 现行方案：`docs/技术/MCU-Atlas-CMS-V1.0-M6准入条件与Linux隔离验证实施方案-V1.4.md`。本文件仅保留历史。

| 项 | 值 |
|---|---|
| 日期 | 2026-11-10 |
| 执行方 | CodeBuddy（开发） |
| 性质 | 方案修订；**不执行 M6、不连接服务器、不改代码** |
| 基线 | M1–M5 冻结版（205/205，I1–I6 local-isolated） |
| 工具哈希 | `ae1678d981577dc3b401d15dad314e1abae3878ac00b73ad1ff3bbf6fd936846` |
| 本轮动作 | 仅文档；未创建 VM/用户/unit/timer/helper/spool；未改 H5/Sitemap/Nginx/证书；未 Git 操作 |

> 本文是 V1.2 方案，不是 M6 执行结果，也不是生产部署授权。
> 所有“预期结果”均未执行验证。P1/P2/P5 等阈值是**预设验收标准**，不是实测结论。

---

## 0. 修订摘要（V1.1 → V1.2）

| # | 复审意见 | V1.2 处理 |
|---|---|---|
| 1 | CMS service / root helper 配置不完整 | 补齐 `[Unit]/[Service]/[Install]`、路径、日志目录、文件权限、`LogsDirectory`、`ReadWritePaths`、`ExecStartPre` |
| 2 | C5 预检缺少强制入口 | 定义四道强制门：部署前、CMS 启动 `ExecStartPre`、CMS 内 `NODE_OPTIONS` spawn guard、helper 前置校验；说明正常发布无法绕过，但**尚未实现** |
| 3 | P3 RSS/cgroup 口径混淆 | 区分进程 RSS、cgroup `usage_in_bytes`、cgroup `stat:rss`；`B_total` 统一为 cgroup anon `rss` 峰值（含父子），2s 采样；公式与采集方式固定 |
| 4 | P7/P9 生产观察定义不足 | 补齐服务清单冻结、S0 基线、采样窗口、`NRestarts`/`ActiveEnterTimestamp` 重启识别、Nginx/Forum 5xx 统计、S6 仅生产只读 |
| 5 | P3-Prod 1.5 系数来源不明 | 明确为**保守估算系数**，无实测依据；不得写成已验证模型；生产仍需 canary/A_prod |
| 6 | M6 新组件版本管理缺失 | 新增 `ops/manifest.json` + 独立版本/哈希/审查；M1–M5 冻结代码禁止修改；新增 helper/unit/path/gate/harness 单独管理 |
| 7 | P5 页大小 | 使用 `getconf PAGESIZE` 实际页大小，不写死 4KiB |
| 8 | S0-VM 与 CMS 启动顺序 | S0-VM 24h 采样结束并归档后，才允许启动 CMS/进入 T1 |
| 9 | 网络隔离证据 | `ip route`、`ss`、`nft/iptables`、DNS/生产域名试探、抓包五类证据 |
| 10 | 真实 unit 权限测试 | `systemd-run` 只做探索；最终必须在实际安装的 unit 上执行 T4，不能替代 |
| 11 | 阈值包装成实测结论 | P1/P2/P5 等明确标注“预设验收标准”；报告不得写“已实测通过”除非有数据 |
| 12 | 签字角色 | **Owner 是唯一签字人**；CodeBuddy 提供证据；ChatGPT 只做技术复核，不签字 |

> V1.0→V1.1 的 C1/C3/T7/P 口径修订继续有效；本 V1.2 不重复展开，只在其上补强。

---

## 1. 双准入框架

### 1.1 M6 沙箱准入（与生产证书无关）

M6 沙箱只验证**机制**，不验证生产证书/生产数据/生产共存。

| 条件 | 判据 | 状态 |
|---|---|---|
| M1–M5 冻结 | 代码哈希与冻结报告一致；205/205 | ✅ |
| 独立环境 | 独立 VM/快照；不与生产共用；仅本地网络 | 待建 |
| 合成数据 | 60 篇/分类/标签/媒体；无生产 DB/媒体 | 待建 |
| 沙箱证书 | 自签或本地 CA；`www.m6.local`；可 HTTP/HTTPS 本地验收 | 待建 |
| C5 工具 | 仓库/部署副本哈希一致；Owner 签字 | 待签 |
| C2 沙箱授权 | 沙箱用户/目录/unit/helper/spool 创建许可 | 待授权 |
| C3 VM 资源 | S0-VM + S1–S5；P1–P6/P8/P10 | 待执行 |
| 禁止项 | 不访问生产证书/域名/DB/H5/Sitemap | 强制 |

**C1 不在 M6 沙箱准入表内。** 独立 VM 使用自签证书即可完成 HTTP/HTTPS 页面验证。

### 1.2 生产部署准入（C1 在这里）

正式生产部署必须同时满足：

| 条件 | 判据 |
|---|---|
| M6 通过 | T0–T10 全绿，证据归档 |
| C1 | `www.mcuatlas.xyz`/`mcuatlas.xyz` 证书剩余 ≥60 天（或自动续签已证明覆盖） |
| C2 生产 | 生产用户/unit/helper/spool/目录/权限按 V1.2 落地 |
| C3 生产 | S0 生产只读基线 + S6 窗口 + 共存估算 + 部署后 canary 观察 |
| C5 | 签字 + 每次构建/发布前预检脚本全绿 |
| Nginx | `/article/` 路由、软链、`try_files` 经生产前验证 |
| M7 | 生产备份恢复演练完成（或 Owner 明确并行风险接受；建议先 M7） |
| Owner | 书面部署授权 |

**M6 通过不代表 C1 通过；C1 通过也不代表 M6 通过。两者独立。**

---

## 2. C1：生产证书条件（只属生产部署）

### 2.1 域名

- `www.mcuatlas.xyz`：主站/canonical。
- `mcuatlas.xyz`：301 → `www`；TLS 握手仍需证书覆盖。

### 2.2 只读核查（生产预检时执行，本轮未执行）

```bash
openssl x509 -in /www/server/panel/vhost/cert/mcuatlas.xyz/fullchain.pem \
  -noout -subject -issuer -dates -ext subjectAltName

openssl s_client -connect www.mcuatlas.xyz:443 -servername www.mcuatlas.xyz </dev/null 2>/dev/null \
  | openssl x509 -noout -dates -ext subjectAltName
openssl s_client -connect mcuatlas.xyz:443 -servername mcuatlas.xyz </dev/null 2>/dev/null \
  | openssl x509 -noout -dates -ext subjectAltName

echo | openssl s_client -connect www.mcuatlas.xyz:443 -servername www.mcuatlas.xyz 2>/dev/null \
  | openssl x509 -noout -checkend $((60*24*3600)) && echo ">=60d" || echo "<60d"

ls -1 /root/.acme.sh 2>/dev/null | grep -i mcuatlas || echo "acme 未覆盖"
crontab -l 2>/dev/null | grep -i acme
systemctl list-timers --all | grep -i -E 'acme|certbot' || true
nginx -T 2>/dev/null | grep -n -A3 -B2 'ssl_certificate'
```

### 2.3 验收

1. 两个域名 SAN 均覆盖，链完整，TLS 1.2/1.3 可握手。
2. `notAfter - now ≥ 60×24×3600` 秒。
3. 自动续签：任务存在 + 最近成功记录 + 下次计划早于到期前 30 天；仅目录存在不算。
4. 剩余 <60 天不进入生产部署；<30 天停止全部上线动作。

### 2.4 当前判定

按本地 V2.1 记录（2026-11-09）到期 2026-12-14，距 2026-11-10 约 34–35 天，**低于 60 天**。本轮未联网复核，不能写成“已续签”。该状态**不阻止 M6 沙箱**，只阻止生产部署。

---

## 3. C2：Linux 运行环境与权限

### 3.1 两套资源，不可混用

| 环境 | 用户/路径 | 用途 | 授权 |
|---|---|---|---|
| 沙箱 VM | `mcucms`（仅 VM 内）+ `/srv/m6-sandbox` 或 VM 内 `/www/wwwroot` | M6 T0–T10 | Owner 批沙箱资源 |
| 生产 | `mcucms` + `/www/wwwroot/mcu-cms` | 生产部署 | Owner 单独批生产资源 |

沙箱可在独立 VM 内使用与生产相同的路径形态，但**不得挂载/访问生产磁盘、DB、证书、H5**。

### 3.2 目录与权限

| 对象 | owner:group | mode | 说明 |
|---|---|---|---|
| `mcu-cms` | root:root | 0755 | 代码根 |
| `app` | root:root | 0755 | 冻结代码只读 |
| `data` | mcucms:mcucms | 0711 | 可穿越到 media；不可列目录 |
| `data/cms.db` | mcucms:mcucms | 0600 | DB |
| `data/media` | mcucms:mcucms | 0755 | Nginx 只读；文件 0644 |
| `releases` | mcucms:mcucms | 0755 | Nginx 可读；mcucms 可写 |
| `tmp` | mcucms:mcucms | 0700 | 构建临时 |
| `logs` | mcucms:mcucms | 0750 | CMS 日志 |
| `spool` | root:root | 0755 | 父目录 |
| `spool/incoming` | mcucms:mcucms | 0700 | CMS 投递 |
| `spool/work` | root:root | 0700 | helper 独占 |
| `spool/done` | root:root | 0755 | CMS 读结果；文件 0644 |
| `spool/failed` | root:root | 0755 | 运维排查；文件 0644 |
| `mcu-h5` | root:www | 0755 | 现有 H5，只读 |
| `h5/article` | root:root | symlink | 仅 helper 切 |
| `h5/media` | root:root | symlink | 如启用 |
| `h5/sitemap.xml` | root:root | 0644 | 仅 helper 换 |
| `mcu-cms-publish` | root:root | 0755 | helper |
| units | root:root | 0644 | systemd |

### 3.3 创建顺序（授权后）

1. 创建 `mcucms` 系统用户（nologin，home 指向代码根）。
2. 创建目录树与 owner/mode。
3. 部署 root-owned 冻结代码；安装已签字 sitemap 工具到 `app/tools/`。
4. 以 `mcucms` 执行 `migrate.cjs`（沙箱合成 DB）。
5. 安装 helper（root:root 0755）。
6. 写 CMS service → publish service/path；**不创建 timer**。
7. `systemctl daemon-reload`。
8. 沙箱 Nginx（独立端口/本地 CA）。
9. T4 权限负向测试通过后，才做功能测试。

### 3.4 CMS service 完整草案

```ini
# /etc/systemd/system/mcu-cms.service
[Unit]
Description=MCU Atlas CMS (loopback only)
After=network.target
StartLimitIntervalSec=60
StartLimitBurst=5

[Service]
Type=simple
User=mcucms
Group=mcucms
WorkingDirectory=/www/wwwroot/mcu-cms

# C5 强制门 1：服务启动前校验仓库/部署/签字哈希；失败不启动
ExecStartPre=/www/wwwroot/mcu-cms/ops/preflight-sitemap-hash.cjs --mode=startup

# C5 强制门 2：所有对 sitemap 工具的 spawn 必须经过 guard（拒绝哈希不符/非白名单参数）
Environment=NODE_OPTIONS=--require /www/wwwroot/mcu-cms/ops/sitemap-spawn-guard.cjs
Environment=NODE_ENV=production
Environment=CMS_ACCESS_MODE=tunnel
Environment=CMS_PORT=8790
Environment=CMS_DATA_DIR=/www/wwwroot/mcu-cms/data
Environment=CMS_DB=/www/wwwroot/mcu-cms/data/cms.db
Environment=CMS_MEDIA_DIR=/www/wwwroot/mcu-cms/data/media
Environment=CMS_RELEASES_DIR=/www/wwwroot/mcu-cms/releases
Environment=CMS_TMP_DIR=/www/wwwroot/mcu-cms/tmp
Environment=CMS_LOG_DIR=/www/wwwroot/mcu-cms/logs
Environment=CMS_H5_DIR=/www/wwwroot/mcu-h5
Environment=CMS_SITEMAP_TOOL=/www/wwwroot/mcu-cms/app/tools/generate-sitemap.cjs

ExecStart=/opt/node24/bin/node app/server.cjs
Restart=on-failure
RestartSec=5
UMask=0022

NoNewPrivileges=yes
PrivateTmp=yes
ProtectSystem=full
ProtectHome=yes
ProtectKernelTunables=yes
ProtectControlGroups=yes
RestrictAddressFamilies=AF_UNIX AF_INET AF_INET6
ReadWritePaths=/www/wwwroot/mcu-cms/data /www/wwwroot/mcu-cms/releases /www/wwwroot/mcu-cms/tmp /www/wwwroot/mcu-cms/logs /www/wwwroot/mcu-cms/spool/incoming
ReadOnlyPaths=/www/wwwroot/mcu-h5 /www/wwwroot/mcu-cms/app /www/wwwroot/mcu-cms/ops
MemoryMax=192M
MemoryHigh=160M
OOMScoreAdjust=500

[Install]
WantedBy=multi-user.target
```

日志与文件权限：

| 对象 | owner:group | mode | 说明 |
|---|---|---|---|
| `/www/wwwroot/mcu-cms/logs` | mcucms:mcucms | 0700 | CMS 日志目录 |
| `logs/*.log` | mcucms:mcucms | 0600 | 仅 CMS 读；journal 另存 |
| `/www/wwwroot/mcu-cms/ops` | root:root | 0555 | 预检/guard/manifest 只读 |
| `ops/*.cjs` | root:root | 0555 | 可执行、不可改 |
| `ops/RELEASE-MANIFEST.json` | root:root | 0444 | 新组件哈希清单 |

**重要**：`ExecStartPre` 与 `NODE_OPTIONS` guard 是 M6 新增组件，当前**尚未实现**；没有它们，C5 只能靠人工预检，不能声称“正常发布无法绕过”。完整强制链见 §5.2。

### 3.5 root helper 完整单元与收紧

```ini
# /etc/systemd/system/mcu-cms-publish.service
[Unit]
Description=MCU CMS publish helper (release switch only)
StartLimitIntervalSec=0
After=network.target

[Service]
Type=oneshot
User=root
Group=root

# C5 强制门 3：helper 执行前再校验一次工具/部署/签字哈希
ExecStartPre=/www/wwwroot/mcu-cms/ops/preflight-sitemap-hash.cjs --mode=publish
ExecStart=/usr/local/sbin/mcu-cms-publish

RuntimeMaxSec=60
Nice=10
IOSchedulingClass=idle
NoNewPrivileges=yes
PrivateTmp=yes
ProtectSystem=full
ProtectHome=yes
ProtectKernelTunables=yes
ProtectControlGroups=yes
RestrictAddressFamilies=AF_UNIX
RestrictNamespaces=yes
LockPersonality=yes
Environment=PATH=/usr/local/sbin:/usr/sbin:/usr/bin:/sbin:/bin
LogsDirectory=mcu-cms-publish
LogsDirectoryMode=0750
ReadWritePaths=/www/wwwroot/mcu-h5 /www/wwwroot/mcu-cms/spool /www/backup/cms-sitemap /var/log/mcu-cms-publish
ReadOnlyPaths=/www/wwwroot/mcu-cms/app /www/wwwroot/mcu-cms/releases /www/wwwroot/mcu-cms/ops /var/log /etc /usr /boot
StandardOutput=journal
StandardError=journal
```

```ini
# /etc/systemd/system/mcu-cms-publish.path
[Unit]
Description=Watch CMS publish spool

[Path]
PathExistsGlob=/www/wwwroot/mcu-cms/spool/incoming/*.req
Unit=mcu-cms-publish.service

[Install]
WantedBy=multi-user.target
```

日志/文件权限：

| 对象 | owner:group | mode | 说明 |
|---|---|---|---|
| `/var/log/mcu-cms-publish` | root:root | 0750 | helper 专用 |
| `/var/log/mcu-cms-publish/publish.log` | root:root | 0640 | helper append；journal 双写 |
| `/www/backup/cms-sitemap` | root:root | 0750 | 旧 sitemap 备份 |
| `/usr/local/sbin/mcu-cms-publish` | root:root | 0755 | helper |
| `/www/wwwroot/mcu-cms/ops` | root:root | 0555 | preflight/guard/manifest |

关键收紧：

- **不再授予整个 `/var/log`**；只允许 `/var/log/mcu-cms-publish`，并把 `/var/log` 父目录设为只读（子目录通过 `ReadWritePaths` 单独开放）。
- helper 只能写自己的 `/var/log/mcu-cms-publish/publish.log`；T4 必须验证不能改写 `/var/log/syslog`、其他 unit 日志。
- systemd 239 若对“父只读 + 子可写”的覆盖顺序不符合预期，回退方案为 `ProtectSystem=strict` + 精确 `ReadWritePaths`，并在 T4 记录；不得直接上生产试。
- `ReadWritePaths` 保留 `/www/wwwroot/mcu-h5` 是必要的：`rename` 软链/`sitemap.xml` 需要目录写权限，不能只授权文件；但 code/releases 明确只读。
- helper 只允许：`symlink`+`rename`（article）、`rename`（sitemap，旧件备份）、spool 搬移、append 自己日志；无 `unlink`/递归/`exec`/网络/DB。
- 请求字段白名单、`release_seq` 推导路径、`O_NOFOLLOW`、`st_uid==mcucms`、`st_nlink==1`、`st_size≤4096`、`st_dev` 同盘。
- **残余风险**：helper 以 root 运行且必须能写 `h5` 目录；若 helper 自身被完全控制，仍可在 `h5` 写入白名单外文件。缓解是 root-owned 0755、无网络、无 exec、代码只做固定操作；不能宣称“helper 被攻破也无影响”。
- **真实 unit 测试**：`systemd-run` 只做探索；T4 必须在实际安装的 `mcu-cms.service` / `mcu-cms-publish.service` 上执行，验证实际 unit 的 `ReadWritePaths`、`ReadOnlyPaths`、`LogsDirectory`、软链 rename 行为。仅用 `systemd-run` 不能作为通过依据。
- systemd 239 验证方法：
  1. `systemd-analyze security mcu-cms-publish.service`（参考分，不作为唯一门槛）。
  2. 用 `systemd-run` 做探索性写入测试，但最终必须在真实 unit 上复跑。
  3. `strace -f -e trace=openat,rename,symlink` 跑一次沙箱切换，确认只打开/rename 白名单路径。
  4. `namei -l`、`stat -c '%U %G %a %d'` 验证属主/权限/同盘。
  5. 测试 `ProtectSystem=strict` 变体（仅沙箱）；若软链/`ReadWritePaths` 行为不兼容，记录并回退 `full`。**不得直接上生产试。**

### 3.6 helper 日志审查结论

- `/var/log` 过宽 → 已改 `/var/log/mcu-cms-publish`（专用目录）。
- helper 不能改写非目标日志；只能 append 自己的 `publish.log`。
- 日志文件 `root:root 0640`；目录 `root:root 0750`；`LogsDirectory` 若 systemd 239 不生成，则预创建同权限目录。非 root 审计走 journal，不额外扩大文件读权限。
- 仍存在“root 可改自己的日志”的固有风险；审计以 journal + 独立日志双写，不宣称防篡改。

---

## 4. C3：资源测试拆分与 P1–P10 计算标准

### 4.1 A/B/C 三个范围

| 范围 | 内容 | 环境 | 授权 | 输出用途 |
|---|---|---|---|---|
| **A. S0 生产只读基线** | 24h 被动采样；不启动 CMS、不加负载、不改配置 | 现有生产服务器 | **单独只读登录/采集授权** | 生产共存估算、生产部署准入 |
| **A2. S0-VM 基线** | VM 内 24h 被动采样；不启动 CMS | 独立 VM | 沙箱授权 | 计算 `A_vm`，供 P3-VM |
| **B. S1–S5 VM 资源** | 启动 CMS、合成数据、构建、并发读 | 独立 VM | 沙箱授权 | M6 资源验收 |
| **C. 共存估算** | 用 A+B 数据做容量推算 | 文档计算 | — | 生产部署参考；**不是共存压力测试** |

> 不得把 B 的结果写成“现有服务器共存验证通过”。
> `S0-VM` 必须完整 24h 采样并归档后，才允许启动 CMS（T1）；若中途启动过 CMS，丢弃该基线，重新采 24h。

### 4.2 变量定义

#### 4.2.1 先区分三种“内存”

| 口径 | 读取 | 含什么 | 用途 | 不能用于 |
|---|---|---|---|---|
| 进程 RSS | `/proc/<pid>/status:VmRSS` | 该进程驻留页（含 file-backed/共享） | P7 既有服务对比 | P3 的 cgroup 总内存 |
| cgroup `usage_in_bytes` | `memory.usage_in_bytes` | anon + page cache + kernel 记账 | 判断 `MemoryMax` 是否触顶 | P3/P1 的“进程真实占用” |
| cgroup `memory.stat:rss` | `memory.stat` 的 `rss` | **cgroup 内匿名页（不可回收部分）** | P1/P2/P3 的主判据 | 不能叫“进程 RSS” |

`B_total` 统一定义为：

```
B_total = max( rss(t) )，t ∈ [构建开始−1min, 构建进程退出+1min]
rss(t) = cgroup memory.stat 的 rss 字段（MiB）
```

- 即 **S3/S4 构建期间，`mcu-cms.service` cgroup 的匿名页 `rss` 峰值（MiB，包含 CMS 父进程与构建子进程）**。
- 采集：2s 一次读 `memory.stat`，取 `rss` 字段；构建开始前 1min 开始，构建进程退出后 1min 结束。
- 不用 `memory.max_usage_in_bytes` 作为 P3 判据：它含 page cache，会高估；只作为“上限是否触顶”的旁证。
- 不用“所有子进程 RSS 相加”代替：会漏共享页/重复计算；cgroup `rss` 是统一口径。
- 如果某环境读不到 cgroup `stat:rss`，该场景**不得判定通过**，只能记录为“不可测”。

#### 4.2.2 变量表

| 变量 | 含义 | 来源 | 采样/窗口 |
|---|---|---|---|
| `A_prod` | 生产 24h `MemAvailable` 最低值（MiB） | S0 `MemAvailable` | 2s 采样，24h 取 min |
| `A_vm` | VM 24h `MemAvailable` 最低值（MiB） | S0-VM | 2s 采样，24h 取 min |
| `C_idle` | CMS 空载 cgroup anon `rss`（MiB） | S1 `memory.stat:rss` | S1 最后 5min，2s 采样取中位数 |
| `C_base` | S2 前基线 cgroup anon `rss`（MiB） | S2 前 5min | 2s 采样取中位数 |
| `B_total` | 构建期间 cgroup anon `rss` 峰值（MiB，含父+子） | S3/S4 `memory.stat:rss` | 2s 采样 max；构建开始前 1min 到结束后 1min |
| `M_min` | 场景内 `MemAvailable` 最低值（MiB） | `/proc/meminfo` | S4/S5 2s 采样，含结束后 5min |
| `SW` | 场景 `pswpout` 差值（MiB） | `/proc/vmstat` | 场景开始/结束后 1min 各取一次；`getconf PAGESIZE` |
| `RSS_svc` | 既有服务 5min 中位 **进程 RSS**（MiB） | `/proc/<pid>/status:VmRSS` | S4/S5 期间 vs S0 中位 |
| `OOM` | cgroup `oom_kill` + dmesg OOM 计数 | cgroup/dmesg | 场景全程 |
| `FAILCNT` | cgroup `memory.failcnt` 差值 | cgroup | 场景开始/结束 |
| `HTTP` | S5 CMS HTTP 成功率和 P95 | 本地 curl 循环 | 20rps × 60s |

### 4.3 P1–P10 定义与适用

| ID | 公式/判据 | 窗口/频率 | 适用 |
|---|---|---|---|
| P1 | `C_idle ≤ 45 MiB` | S1 最后 5min 中位 | VM M6 |
| P2 | `max(S2 rss) − C_base ≤ 25 MiB` | S2 全程 2s；`C_base` 为 S2 前 5min 中位 | VM M6 |
| P3-VM | `B_total ≤ A_vm − 60 MiB` | S3/S4 全程 2s，取 max | VM M6 |
| P3-Prod 估算 | `1.5×B_total_vm ≤ A_prod − 60 MiB`（`B_total_vm` 已含 CMS 父进程，故不再加 `C_idle`） | 文档计算 | 生产部署估算，非压力测试 |
| P4 | `M_min ≥ 60 MiB` | S4/S5 2s，构建开始至结束后 5min | VM M6 |
| P5 | `SW ≤ 8 MiB/场景` | 场景开始→结束后 1min；`pswpout` 差×`getconf PAGESIZE` | VM M6 |
| P6 | `OOM = 0` | 场景全程 | VM M6 |
| P7a | 每个既有服务 `abs(RSS_svc − RSS_s0)/RSS_s0 ≤ 10%` | S4/S5 5min 中位 vs S0 24h 中位 | 生产 canary/共存 |
| P7b | 既有服务重启数 = 0 | 场景全程；`NRestarts`/`ActiveEnterTimestamp` 增量 | 生产 canary |
| P7c | 既有 HTTP 服务 5xx = 0 | Nginx/Forum API 访问日志窗口 | 生产 canary |
| P8 | `FAILCNT 增量 = 0` | 每场景开始/结束 | VM M6 |
| P9 | `S6 窗口 M_min ≥ 60 MiB` | 08:00 前后 15min，2s；仅生产 S0，不启动 CMS | 生产部署 |
| P10 | S5 CMS HTTP 成功率 ≥99%，P95 ≤1000ms，无 5xx | 20rps×60s | VM M6 |

说明：

- **P3 不再写成 `A−60−C` 的重复扣减**：`B_total` 已含 CMS 父进程 + 构建子进程的 cgroup `rss`；若只测子进程，必须明确改名 `B_child` 并单独定义，本文不采用。
- P2 的基准是 **S2 前 5min 中位 `C_base`**，不是 S1 的 `C_idle`。
- P4 是 **2s 采样的最低值**，不是平均值/单点。
- P5 是 **绝对增量**（每场景 `pswpout` 差×页大小）；停止条件另用**速率**（>20 MiB/min 持续 1min）。
- P7 三项分别验收，不得用“平均 RSS 正常”代替重启/5xx。
- P9/P7 需要生产只读/ canary 数据，**M6 VM 不适用**；M6 不能用 VM 数据代替。
- P1/P2/P5 等阈值是**预设验收标准**，不是本轮实测结论；报告只能写“按预设标准通过/失败”。
- **P3-Prod 的 1.5 倍系数**：这是为 VM 与生产环境差异（内核/Node 版本、构建并发、监控与其他进程干扰）预留的**保守估算参数**，没有实测依据；不是验证过的容量模型。必须用 `A_prod`（S0）与部署后 canary 复核；若 Owner 不接受该系数，P3-Prod 只能作参考，不能作为“共存通过”的证明。
- 任何无法按上述公式计算的指标，不作为正式门槛。

#### 4.3.1 P7 生产观察定义

**服务清单冻结**：在 S0 开始前记录并冻结，至少包含：

| 类别 | 服务 | 观测 |
|---|---|---|
| Web | `nginx` | RSS、`NRestarts`、5xx |
| Forum | `mcu-forum-api`（实际 unit 名在 S0 前确认） | RSS、`NRestarts`、5xx |
| 数据库 | `mariadb` | RSS、`NRestarts`；不统计 HTTP 5xx |
| PHP | `php-fpm`（实际 pool/unit 名确认） | RSS、`NRestarts` |
| CMS | `mcu-cms` | 仅 CMS 自身指标，不纳入“既有服务” |

**基线**：S0 生产只读 24h，每 10s 采一次 `VmRSS`/cgroup，取每服务 24h 中位数为 `RSS_s0`；同时记录 `NRestarts` 与 `ActiveEnterTimestamp` 初始值。

**窗口**：S4/S5 的生产 canary 对应窗口；每 10s 采 `VmRSS`，取 5min 中位数为 `RSS_svc`。

**重启识别**：

- `systemctl show -p NRestarts <unit>` 前后差值 >0；
- `ActiveEnterTimestamp` 变化；
- journal 出现新的 `Started <unit>`；
- 任一命中即 P7b 失败。

**5xx 统计**：

- Nginx access log 在窗口内的 500–599 计数；
- Forum API 自身访问日志的 5xx 计数；
- 不含 4xx、不含上游超时但最终 2xx 的请求；
- 任一 HTTP 服务 5xx >0 即 P7c 失败。

**P7 判定**：P7a、P7b、P7c **三项分别全绿**才算 P7 通过；M6 VM 不适用，不能在沙箱伪造。

#### 4.3.2 P9 / S6 生产只读范围

- S6 仅在生产环境执行，属于 **S0 类只读采样**：不启动 CMS、不发布、不施加负载、不改配置。
- 窗口：08:00 本地时间前后各 15min（共 30min），每 2s 采 `MemAvailable`。
- 取窗口内最低值 `M_min`；`M_min ≥ 60 MiB` 为 P9 通过。
- 若 08:00 窗口内有既有 cron/备份任务，必须记录任务名与开始/结束时间；不得把任务导致的下降归因于 CMS。
- M6 沙箱无生产 cron，P9 不适用；不能用 VM 的 08:00 采样代替。

### 4.4 通过标准与停止

- **M6 VM 通过**：P1、P2、P3-VM、P4、P5、P6、P8、P10 全绿。
- **生产部署评估**：S0 + S6 + P7 + P3-Prod 估算 + 部署后 canary；任何一项不满足不得宣称共存通过。
- 停止条件：`MemAvailable <40 MiB`、`pswpout` >20 MiB/min 持续 1min、OOM、既有服务 5xx/重启、S4 构建 >300s、P10 失败。
- 降级：R1 流式/限制 old-space；R2 低峰+限速；R3 本地构建上传；R4 扩容/停 WordPress（Owner，不得默认/不得算通过）。

---

## 5. C5：工具哈希校验

### 5.1 签字对象与角色

| 项 | 内容 |
|---|---|
| 文件 | `h5/tools/generate-sitemap.cjs` |
| SHA-256 | `ae1678d981577dc3b401d15dad314e1abae3878ac00b73ad1ff3bbf6fd936846` |
| 字节 | 13,456 |
| **签字人** | **仅 Owner**（实际签字/部署授权） |
| 证据提供 | CodeBuddy（变更单、测试输出、哈希计算） |
| 技术复核 | ChatGPT（只出复核意见，**不作为签署人**） |
| 依据 | F3 变更单、18/18、205/205、黄金输出 `9ce7ffb0…c90219`、无线上写入 |
| 部署位置 | `/www/wwwroot/mcu-cms/app/tools/generate-sitemap.cjs`（不得 Web root） |

### 5.2 强制校验入口（四道门）

正常发布链必须经过以下四道门；任一门失败即阻断。

| 门 | 执行者/入口 | 时机 | 校验对象 | 失败结果 |
|---|---|---|---|---|
| G1 部署门 | root 部署操作者执行 `ops/preflight-sitemap-hash.cjs --mode=deploy` | 安装/更新工具前 | 仓库文件、部署副本、签字 manifest | 不安装、不覆盖 |
| G2 服务启动门 | `mcu-cms.service` 的 `ExecStartPre=...--mode=startup` | 每次 CMS 启动 | 部署副本、`ops/RELEASE-MANIFEST.json`、签字值 | 服务不启动 |
| G3 构建门 | `mcu-cms.service` 的 `NODE_OPTIONS=--require .../sitemap-spawn-guard.cjs` | 每次 `spawn` sitemap 工具 | 工具路径、SHA-256、参数白名单 | 抛错，构建失败，不产出 release |
| G4 切换门 | `mcu-cms-publish.service` 的 `ExecStartPre=...--mode=publish` | 每次 helper 切换前 | 部署副本、manifest、helper/unit 版本 | 不切换、不写 sitemap |

**脚本/部署副本/签字清单关系**：

- `ops/RELEASE-MANIFEST.json`（root:root 0444，Owner 签字）是唯一权威清单，至少含：
  - `generate-sitemap.sha256`；
  - `preflight-sha256`、`spawn-guard-sha256`、`helper-sha256`、`units-sha256`；
  - `schema_version`、`signed_by`、`signed_at`、`reviewed_by`。
- 仓库文件哈希 = 部署副本哈希 = manifest 中的 `generate-sitemap.sha256`。
- `cms_settings.tool_sha256` 只作 UI/DB 镜像展示，不作为唯一信任源；与 manifest 不一致时以 manifest 为准并阻断。
- `preflight` 自身也校验 `sha256(__filename)` 与 manifest 的 `preflight-sha256`；`spawn-guard` 同样。这是**自校验**，不是密码学签名；防的是误部署/误替换，不是 root 被攻破。

**正常发布为何不能绕过（设计层）**：

1. CMS 服务启动前必须通过 G2；失败则 `systemctl start` 失败。
2. 运行中的 CMS 通过 `NODE_OPTIONS` 强制加载 guard；`build.cjs` 的 `spawnSync` 被 guard 拦截，非白名单路径/哈希不符直接抛错。
3. helper 只能由 root `.path` 或 root 手工触发；其 `ExecStartPre` 必须通过 G4。
4. `mcucms` 对 `app/`、`ops/`、helper、units 均无写权限；不能替换工具或 guard。
5. 直接 `node app/server.cjs`、直接 `systemctl start`、直接以 root 运行 helper 均不属于“正常发布链”；运维 runbook 禁止，T4/T0 检查是否只有 unit 入口。
6. **信任边界**：root 手工操作始终可以绕过任何脚本；本方案防的是误部署/普通 CMS 路径，不是 root 被攻破。

**边界**：以上是设计强制链，当前**尚未实现/未实测**。没有 G2/G3/G4，C5 只有人工 G1，不能声称“正常发布无法绕过”。M6 必须在沙箱实现并由 T4/T2 验证；root 被攻破不在防护范围。

### 5.3 预检脚本职责

`mcu-cms/ops/preflight-sitemap-hash.cjs`（新组件，不属于 M1–M5）：

- 输入：`--mode=deploy|startup|publish`；路径固定，不接受任意路径参数。
- 校验：仓库文件、部署副本、`RELEASE-MANIFEST.json`、自身/guard/helper 哈希。
- 输出：成功一行 JSON；失败退出码 1 + 差异字段；不写业务文件。
- 执行者：root 部署操作者（G1）、systemd（G2/G4）；guard（G3）由 Node 加载。
- 脚本本身：纳入 `ops/RELEASE-MANIFEST.json` 的哈希管理；任何改动需重新评审/Owner 签字。
- 不把一次性 `sha256sum` 当永久保护；每次构建/切换都必须经过 G3/G4。

### 5.4 哈希不一致处理

1. 停止，不写任何 release/sitemap。
2. 复核仓库、部署副本、manifest、`cms_settings` 四处。
3. 部署副本被改 → 用签字副本覆盖；不“将就”。
4. 仓库被改 → 重走 F3 变更单/测试/签字。
5. manifest 与文件不一致 → 以 Owner 签字副本为准；无法确认则阻断。
6. 不得以“输出仍等于黄金基线”跳过哈希不一致。

### 5.5 M6 新组件的独立版本与哈希管理

M6 会新增发布运行组件；它们**不属于 M1–M5 冻结业务代码**，必须独立管理。

| 组件 | 建议位置 | 版本/哈希 | 审查 |
|---|---|---|---|
| root helper | `/usr/local/sbin/mcu-cms-publish` | 独立版本 + SHA-256 | Owner + 安全复核 |
| publish service/path | `/etc/systemd/system/mcu-cms-publish.*` | 独立版本 + SHA-256 | Owner |
| CMS service | `/etc/systemd/system/mcu-cms.service` | 独立版本 + SHA-256 | Owner |
| preflight | `mcu-cms/ops/preflight-sitemap-hash.cjs` | 独立版本 + SHA-256 | Owner + ChatGPT 复核 |
| spawn guard | `mcu-cms/ops/sitemap-spawn-guard.cjs` | 独立版本 + SHA-256 | Owner + ChatGPT 复核 |
| release gate（若采用） | `mcu-cms/ops/release-gate.cjs` | 独立版本 + SHA-256 | Owner |
| M6 test harness | `mcu-cms/tests/m6/**` | 独立版本 + SHA-256 | 开发提交，复审 |
| manifest | `mcu-cms/ops/RELEASE-MANIFEST.json` | 含上述全部哈希 | Owner 签字 |

规则：

1. **M1–M5 冻结代码禁止修改**：`app/build/`、`app/repo/`、`app/publish/`、`app/api/`、`app/server.cjs` 等已有文件不得为 M6 改动；发现缺陷 → 停止，记录证据，走解冻评审。
2. 新增组件放在 `ops/` 或 systemd 目录；不得放进 Web root（`h5/`）。
3. 每个组件在 `RELEASE-MANIFEST.json` 有 `name/version/sha256/owner/reviewed_by`；任何改动必须新版本 + 新哈希 + 重新签字。
4. 部署只从 manifest 列出的文件安装；不手工 scp 覆盖。
5. 测试 harness 不得进入生产路径；生产环境不加载 `tests/`。
6. unit 文件改动也需版本与哈希；`systemctl daemon-reload` 前后记录。
7. helper/guard/preflight 的 `--version` 至少输出版本与自身 SHA；不输出敏感路径。

---

## 6. M6 沙箱环境

| 项 | 设计 |
|---|---|
| 主机 | 独立可销毁 Linux VM；systemd 239 或同代；不与生产共用 |
| 证书 | 本地 CA/自签，`www.m6.local`；不接生产证书 |
| 域名 | `/etc/hosts` + `curl --resolve`；**不请求生产域名** |
| 端口 | CMS 18790；Nginx 18443/18080；仅回环 |
| 数据 | 合成 60 篇/分类/标签/媒体；无生产数据 |
| 网络 | 禁止访问生产；仅本地 |
| 快照 | 测试前 snapshot；失败回滚；测试后销毁 |
| 日志 | `/srv/m6/logs`，保留给复审 |

### 6.0 网络隔离验证方法与证据

必须在 T0 前完成并归档以下证据；任一失败不得开始 M6：

```bash
# 1) 路由：最理想是 VM 无默认路由；若有，必须有防火墙默认拒绝
ip route show
ip -6 route show

# 2) 防火墙：默认 deny egress，仅允许 loopback/本地 DNS
nft list ruleset 2>/dev/null || iptables -S

# 3) 监听面：不得监听 0.0.0.0/公网
ss -ltnp

# 4) 生产域名/证书/HTTP 试探：必须失败（超时/拒绝/无路由）
curl -m 3 -sS -o /dev/null -w '%{http_code}\n' https://www.mcuatlas.xyz/ || echo BLOCKED
openssl s_client -connect www.mcuatlas.xyz:443 -servername www.mcuatlas.xyz </dev/null || echo BLOCKED

# 5) 抓包：试探期间不得有到生产地址的包
tcpdump -ni any host www.mcuatlas.xyz -c 5
```

证据要求：

- 命令原文、退出码、时间、截图/日志文件归档到 `/srv/m6/evidence/network/`。
- `curl` 失败是**预期结果**；若成功访问生产，立即停止并销毁 VM。
- 仅“`/etc/hosts` 写了 `www.m6.local`”不构成隔离证据。
- 运行期每次 T0/T4/T10 前复查 `ss` 与防火墙，防止测试中误开放。

### 6.1 沙箱 Nginx（本地 CA）

```nginx
server {
    listen 18443 ssl;
    server_name www.m6.local;
    ssl_certificate     /srv/m6/certs/m6.local.crt;
    ssl_certificate_key /srv/m6/certs/m6.local.key;
    root /www/wwwroot/mcu-h5;

    location = /article { return 301 /article/; }
    location ^~ /article/ {
        try_files $uri $uri.html $uri/index.html =404;
        add_header Cache-Control "public, max-age=300";
    }
    location = /sitemap.xml { try_files $uri =404; }
}
```

测试用：

```bash
curl --cacert /srv/m6/certs/m6-ca.crt \
  --resolve www.m6.local:18443:127.0.0.1 \
  https://www.m6.local:18443/article/
```

canonical/OG 仍检查字符串 `https://www.mcuatlas.xyz/...`，但**不访问该域名**。

---

## 7. M6 测试顺序与 T0–T10

### 7.0 顺序与前置

| 顺序 | 测试 | 前置 | 破坏性 | 生产数据 |
|---|---|---|---|---|
| 0 | T0 预检 | VM 快照/合成数据 | 否 | 否 |
| 1 | T4 权限隔离 | T0；C2 沙箱 | 权限变更 | 否 |
| 2 | T1 服务生命周期 | T4 | 启停 | 否 |
| 3 | T3 spool | T1 | 清 spool | 否 |
| 4 | T2 path/重复 | T3；两个 release | 切换 | 否 |
| 5 | T5 软链/回滚 | T2 | 切换 | 否 |
| 6 | T8 桩页 HTTP | T5；Nginx 沙箱 | 切换 | 否 |
| 7 | T9 页面/CSS/Sitemap | T5 | 切换 | 否 |
| 8 | T6 备份恢复 | T1；停服务 | **DB 替换** | 否 |
| 9 | T7 并发/停服约束 | T6；写入循环 | **DB 风险** | 否 |
| 10 | T10 中断/I1–I6 | T1–T9 | 注入 | 否 |

> T4 先于功能测试，防止带着越权环境做功能验证。
> T6/T7 前必须停 CMS；T7 的负向测试不得真正调用 restore。
> `S0-VM`（24h 被动采样）必须在 T1 之前完成；它不启动 CMS，只用于计算 `A_vm`。生产 `S0` 不包含在 M6 内，另行授权。

### T0 预检

- **目的**：确认沙箱、哈希、证书、网络隔离。
- **前置**：VM/合成数据/快照；S0-VM 24h 已完成（若 T0 时未完成，只能先做只读基线，不得启动 CMS）。
- **步骤**：核对代码/工具/ops manifest 哈希；`www.m6.local` 证书；`ss` 无公网监听；按 §6.0 执行路由/防火墙/DNS/生产域名试探/抓包；保存证据。
- **预期**：哈希一致；仅回环监听；生产域名连接失败；抓包无生产流量；无生产挂载/凭证。
- **失败**：哈希不符、能访问生产、证书域名错误、网络证据缺失。
- **回滚**：销毁/恢复快照。
- **生产数据**：否。**风险**：低。
- **证据**：`/srv/m6/evidence/network/` + 哈希清单 + 证书链。

### T4 真实 unit 权限隔离

- **目的**：证明 `mcucms` 不能写 H5/sitemap/helper/units/`/etc`；helper 只做白名单；日志不越权；**在实际安装的 unit 上验证**。
- **前置**：C2 权限；实际安装 `mcu-cms.service` / `mcu-cms-publish.service`；guard/preflight；测试用户。
- **步骤**：以 `mcucms` 尝试写 `h5/*.html`、`sitemap.xml`、`article`、helper、units、`/etc`；构造请求带 `path`/`command`；用 symlink/hardlink；尝试写 `/var/log/syslog`/其他日志；检查 `/var/log/mcu-cms-publish` 可写、其他日志不可写；用 `strace` 观察 helper 实际 open/rename。
- **预期**：全部拒绝；helper 仅 rename/symlink/append 自己的 `/var/log/mcu-cms-publish/publish.log`；无任意路径/命令；无 root shell；`ReadWritePaths`/`ReadOnlyPaths` 行为符合。
- **失败**：越权写、helper 接受路径/命令、可写其他日志、root shell、`ReadWritePaths` 失效。
- **回滚**：停 unit；恢复权限/快照；安全复盘。
- **生产数据**：否。**风险**：极高（一票否决）。
- **注意**：`systemd-run` 仅用于探索；未在实际 unit 上复跑不得判定通过。

### T1 CMS 服务生命周期

- **目的**：启动/停止/异常退出/重启不损坏 DB；仅回环。
- **前置**：T4；DB migrate；管理员。
- **步骤**：start/health/stop/is-active；`kill -9`；restart；integrity_check。
- **预期**：health 200；stop 输出 `inactive`（exit 3）；重启成功；integrity ok；不监听 0.0.0.0。
- **失败**：公网监听、崩溃循环、DB 损坏。
- **回滚**：stop/disable；快照。
- **生产数据**：否。**风险**：中。

### T3 spool 锁/claim/冲突/重试

- **目的**：验证锁、claim、异常文件、done/failed、重试。
- **前置**：T1；helper；可构造 incoming。
- **步骤**：占锁；陈旧锁；symlink/hardlink/超 4096/非法 JSON/未知字段；work 冲突；handler 失败；done 后重复触发。
- **预期**：锁冲突 exit 75；异常进 failed；不执行、不崩溃；旧 work 不覆盖；失败不阻塞；duplicate 不重复。
- **失败**：执行恶意请求、覆盖 work、批量崩溃、双状态。
- **回滚**：清沙箱 spool；快照。
- **生产数据**：否。**风险**：高。

### T2 path/service 触发与重复

- **目的**：验证 `.path` 触发、重复、10 条上限、剩余请求。
- **前置**：T3；两个 release。
- **步骤**：1 个请求；重复 id；12 个请求；观察一轮；必要时 `systemctl start` 处理剩余。
- **预期**：只切换一次；duplicate 无第二副作用；单轮 ≤10；剩余在下次触发/人工启动后完成。
- **失败**：重复切换、覆盖、永久滞留且无人工恢复。
- **回滚**：软链/sitemap 回 prev；清 spool；快照。
- **生产数据**：否。**风险**：高。
- **注意**：timer 未创建；无人值守的“永久滞留”仍未解决；生产部署需 timer 或值班 runbook。

### T5 软链切换与回滚

- **目的**：验证两次 rename、sitemap、F4/F5/F9/F13。
- **前置**：T2；两个有效 release。
- **步骤**：正常切换；两次 rename 间 kill；手工改软链；损坏 release；回滚。
- **预期**：published；F4 重试；F5 补写；F9 inconsistent；F13 rolled_back；HTTP/文件一致。
- **失败**：混合未识别、404、永久不一致。
- **回滚**：软链/sitemap prev；reconcile；快照。
- **生产数据**：否。**风险**：高。

### T8 下架桩页 HTTP

- **目的**：验证沙箱 HTTPS 下 200/noindex/canonical/无 Article LD/无原正文。
- **前置**：T5；Nginx 沙箱；published/unpublished/archived。
- **步骤**：curl 三个 slug（不跟随跳转）；检查状态码/Content-Type/meta/canonical/正文 marker/JSON-LD；HEAD；列表。
- **预期**：published 200 index；unpublished/archived 200 `noindex,follow`、自指 canonical、无 Article LD、无正文；列表不含下架。
- **失败**：404、index、canonical 错、LD、正文泄露。
- **回滚**：release/Nginx 快照。
- **生产数据**：否。**风险**：中。

### T9 文章/列表/分类/CSS/Sitemap HTTP

- **目的**：验证静态产物、MIME、分页、sitemap。
- **前置**：T8；60 篇。
- **步骤**：curl `/article/`、文章、`page/2`、分类、分类分页、CSS、sitemap；检查正文/OG/canonical/分页/严格 XML/无下架。
- **预期**：200；HTML/CSS MIME 正确；无 JS 正文可读；sitemap 基础顺序不变。
- **失败**：404/MIME/分页/sitemap 异常、CSS 缺失。
- **回滚**：release/Nginx 快照。
- **生产数据**：否。**风险**：低–中。

### T6 SQLite 备份/恢复/WAL

- **目的**：验证 `VACUUM INTO`、pre-restore、回滚、媒体 manifest。
- **前置**：T1；合成 DB/媒体；**停服务**。
- **步骤**：写入 WAL→backup→修改→stop→restore；注入 `failAt`/kill；verify；损坏/占用。
- **预期**：快照一致；无旧 WAL/SHM；integrity ok；失败回滚；状态可识别。
- **失败**：丢已提交数据、无法回滚、媒体缺失。
- **回滚**：`.pre-restore-*`；快照。
- **生产数据**：否。**风险**：极高。

### T7 并发写入与停服约束（修订重点）

- **目的**：验证**操作流程**在活动写入时禁止恢复；验证停服、残留进程、文件占用检查；验证 Linux 文件行为。
- **前置**：T6；CMS 写入循环；本手册的停服检查清单。
- **步骤**：
  1. 启动 CMS + 持续写入（合成）。
  2. 执行停服前检查：`systemctl is-active`、`ss`、`pgrep`、`lsof`/`fuser`。
  3. 有意在“未全部停止”状态下尝试进入恢复流程；测试 harness 必须在调用 `restoreDatabase` **之前**中止，并记录“禁止恢复”。
  4. 停服务；重复检查；确认全部停止。
  5. 才允许执行 T6 的恢复；恢复后核对写入记录。
- **预期**：
  - 有活动写入/服务未停 → **不调用** `restoreDatabase`，流程中止；
  - 任一检查失败/无法确认 → 中止；
  - 全部停止后才恢复；恢复后无丢写；`is-active=inactive` 是正常输出（exit 3），不是无输出。
- **失败**：在活动写入时实际调用恢复；检查命令误判；恢复后丢写。
- **回滚**：`.pre-restore-*`；VM 快照。
- **生产数据**：否。**风险**：极高。
- **边界**：冻结代码**没有代码级写锁**；本测试验证的是调用约束与 Linux 文件行为，**不是** `restoreDatabase` 自动识别并发写入。不得为通过测试修改冻结代码。

### T10 异常/中断/I1–I6

- **目的**：验证 F1/F2/F3/F4/F5/F7/F11/F13 状态机与一致性。
- **前置**：T1–T9；故障注入脚本。
- **步骤**：逐项注入；restart/reconcile；I1–I6；HTTP 抽查；重复。
- **预期**：按 §5.3 收敛；F9/F12 类 inconsistent；I1–I6 true；无静默成功。
- **失败**：卡死、自动处理不一致、I1–I6 false、HTTP/文件不符。
- **回滚**：prev release + DB pre + 快照。
- **生产数据**：否。**风险**：高。

---

### 7.1 M6 通过判定

必须同时满足：

1. T0–T10 全部有证据，且 T4/T6/T7 无“一票否决”失败。
2. P1、P2、P3-VM、P4、P5、P6、P8、P10 全绿。
3. 未访问生产证书/域名/DB/H5/Sitemap；无生产数据。
4. 工具哈希预检（仓库/部署/签字）通过。
5. 所有回滚步骤在沙箱实际演练过。
6. 日志/快照/报告归档，经 ChatGPT 复审。

不满足任一项 → M6 不通过；不得用“大部分通过”替代。

### 7.2 风险与回滚汇总

| 测试 | 风险 | 主要回滚 |
|---|---|---|
| T1 | 中 | stop/disable + 快照 |
| T2 | 高 | 软链/sitemap prev + 清 spool |
| T3 | 高 | 清 spool + 快照 |
| T4 | 极高 | 停 unit + 恢复权限 + 安全复盘 |
| T5 | 高 | 软链/sitemap prev + reconcile |
| T6 | 极高 | `.pre-restore-*` + 快照 |
| T7 | 极高 | 快照 + pre |
| T8 | 中 | Nginx/release prev |
| T9 | 低–中 | release prev |
| T10 | 高 | prev + pre + 快照 |

## 8. 测试顺序复查结论

V1.0 的顺序问题及 V1.2 修正：

| 问题 | 修正 |
|---|---|
| T4 权限测试原排在功能之后 | 提前到 T1 前；越权环境不得做功能验证 |
| T6/T7 可能带着运行中的服务做恢复 | T6 强制停服；T7 先做“未停服则中止”的负向检查，再停服恢复 |
| T2 假设 `.path` 会自动处理剩余 10+ | 明确 timer 未创建；剩余靠人工 `systemctl start`；生产部署需 timer/值班 |
| T8/T9 用生产域名/证书 | 改 `www.m6.local` + 本地 CA；canonical 只查字符串 |
| T10 依赖尚未实现的 helper/state machine | 标注 M6 执行前必须实现 helper/对账；否则 T5/T10 不成立 |
| T0 未包含哈希/证书/隔离检查 | T0 增加代码/工具哈希、沙箱证书、禁网检查 |
| T6 恢复可能被误当“代码级安全” | 明确是操作约束测试；不要求代码写锁 |

**遗留前置**：helper、publish units、对账逻辑在冻结版中尚未实现；M6 执行前必须在沙箱实现/部署，且不得修改 M1–M5 业务代码。T5/T10 的前置必须如实标注，不得跳过。

---

## 9. M6 失败停止条件

任一命中立即停止：

1. 访问生产证书/域名/DB/H5/Sitemap/Nginx。
2. `mcucms` 可写 H5/sitemap/helper/units/`/etc`，或 helper 接受任意路径/命令。
3. 活动写入时执行了恢复，或恢复后丢写。
4. `ROLLBACK_FAILED` 无法收敛。
5. OOM、`MemAvailable<40 MiB`、swap >20 MiB/min 持续 1min。
6. 既有服务 5xx/重启（生产 canary）。
7. 证书 <30 天（生产阶段）。
8. 工具哈希不一致且无法恢复签字副本。
9. 桩页非 200、sitemap 含下架页、I1–I6 false。
10. Owner 停止。

停止动作：停 CMS/path/helper；保留 VM 快照/日志；不清理；提交证据；等待 Owner。

---

## 10. M7 生产恢复演练边界

| 项 | M6 | M7 |
|---|---|---|
| 数据 | 合成 | 生产数据副本 |
| 环境 | 独立 VM | 生产/同构维护窗口 |
| 证书/域名 | 自签 `www.m6.local` | 真实 `www.mcuatlas.xyz` |
| 备份 | 合成 DB/媒体 | 真实 DB/媒体/sitemap |
| 恢复 | `failAt`/kill 模拟 | 真实停服、真实备份、RPO/RTO |
| 目标 | 机制可行 | 生产可恢复 |
| 授权 | 沙箱授权 | Owner + 维护窗口 + 生产访问 |

M6 通过不代表 M7；M7 未启动。M7 不得用 M6 合成数据替代。

---

## 11. Owner 授权清单

### M6 沙箱

1. 独立 VM/快照/合成数据/本地 CA。
2. 沙箱 `mcucms` 用户、目录、CMS unit、publish service/path、helper、spool。
3. S1–S5 VM 资源测试。
4. C5 工具签字（`ae1678d9…6846`）。
5. 是否允许 timer（本轮不创建；T2 用人工启动兜底）。

### 生产部署（独立于 M6）

1. C1 证书续签/部署/reload。
2. C2 生产用户/unit/helper/spool/权限。
3. S0 生产只读 24h + S6 08:00 窗口（单独只读授权）。
4. P7/P9 生产 canary 观察。
5. Nginx `/article/`、软链、`disable_symlinks` 变更。
6. C4 D4 页脚入口、C6 robots（不阻塞）。
7. M7 生产恢复演练。
8. 正式部署授权。

---

## 12. 分类矩阵

| 事项 | 已具备 | 尚未核实 | Owner 授权 | M6 验证 | M7 验证 |
|---|---|---|---|---|---|
| M1–M5 205/205 | ✅ | — | — | — | — |
| 工具哈希 | ✅ | 部署副本 | C5 | 预检脚本 | 生产预检 |
| 生产证书 | — | 剩余天数 | 续签 | — | 生产 HTTPS |
| 沙箱证书 | — | 自签生成 | 沙箱 | T0/T8/T9 | — |
| 用户/权限 | — | — | ✅ | T4 | 生产审计 |
| VM 资源 | — | S1–S5 | 沙箱 | P1–P6/P8/P10 | — |
| 生产 S0 | — | 24h | ✅ 只读 | — | 生产评估 |
| 共存 P7/P9 | — | — | canary | — | 生产 canary |
| Nginx `/article/` | — | 现有 vhost | ✅ | T8/T9 | 生产 |
| 恢复 | 本地 12/12 | Linux 语义 | ✅ | T6/T7 | 生产演练 |
| 下架桩页 HTTP | 本地文件 | 沙箱 HTTP | — | T8 | 生产 |
| 共享 CSS | 无内部依赖 | 沙箱 | — | T9 | 生产 |
| timer | 设计 | 行为 | ✅ 未批 | T2 人工兜底 | 生产值守 |

---

## 13. 结论

- M6 沙箱准入**不再依赖生产证书 C1**；C1 只属生产部署。
- C3 拆成生产只读 S0、VM S1–S5、共存估算，三者不互相冒充。
- T7 只验证操作约束与 Linux 文件行为，不宣称代码级写锁。
- P1–P10 均有变量、来源、频率、窗口、公式；P3 使用 cgroup anon `rss`；1.5 系数是保守估算，不是已验证模型。
- C5 采用 G1–G4 四道门；G2/G3/G4 尚未实现，不能声称“正常发布无法绕过”。
- root helper 日志缩到 `/var/log/mcu-cms-publish`，路径收紧；T4 必须在真实 unit 上复跑。
- M6 新增 helper/unit/path/preflight/guard/harness 独立版本与哈希管理；M1–M5 冻结代码不改。
- **M6 仍未执行；生产部署不批准；M7 未启动。**

等待 ChatGPT 技术复核与 Owner 授权；本方案不构成执行授权。
