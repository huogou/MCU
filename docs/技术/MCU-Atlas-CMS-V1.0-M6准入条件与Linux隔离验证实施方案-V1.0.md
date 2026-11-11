# MCU Atlas CMS V1.0 · M6 准入条件与 Linux 隔离验证实施方案 V1.0

> **已被 V1.1 / V1.2 / V1.3 / V1.4 取代。** 现行方案：`docs/技术/MCU-Atlas-CMS-V1.0-M6准入条件与Linux隔离验证实施方案-V1.4.md`。本文件仅保留历史。

| 项 | 值 |
|---|---|
| 日期 | 2026-11-10 |
| 执行方 | CodeBuddy（开发） |
| 性质 | **M6 准入审查 + 隔离验证方案编制**；不是 M6 执行结果 |
| 当前状态 | M1–M5 已冻结；M6 未获准执行；M7 未启动；生产部署不批准 |
| 代码基线 | 14 套件 / 205 项本地通过；I1–I6 本地通过 |
| 工具基线 | `generate-sitemap.cjs` SHA-256 `ae1678d9…6846` |
| 本轮动作 | 未登录服务器、未创建任何资源、未改代码/Nginx/证书/H5/Sitemap、未 Git 操作 |

> **本文所有命令均为方案示例，未执行。** 任何“预期结果”都不等于已验证。
> 不得将本方案描述为 M6 通过、Linux 验证通过或生产可用。

---

## 0. 结论摘要

**M6 当前不放行。** 四个硬条件仍未满足：

| 条件 | 当前判定 | 说明 |
|---|---|---|
| C1 证书 | ❌ 不满足 | 按本地 V2.1 记录，证书 2026-12-14 到期，距 2026-11-10 约 34–35 天，低于 60 天；本轮未联网复核 |
| C2 运行环境/权限 | ❌ 未授权 | `mcucms` 用户、CMS unit、发布 path/service、root helper、spool、目录均未创建 |
| C3 服务器资源 | ❌ 未实测 | 历史 MemAvailable 只有快照，不得作为通过依据；24h 基线与 S1–S5 未执行 |
| C5 Sitemap 签字 | ❌ 未签字 | 哈希已记录，但 Owner 未签；且**当前冻结代码没有构建前断言工具哈希**，需在 M6 前解决 |
| C4 D4 入口 | ⏸ 未决策 | V2.1 明确不阻塞 M6，只影响上线价值 |
| C6 robots | ⏸ 未定案 | 不阻塞 M6 |

**结论：M6 准入准备完成；M6 执行需 Owner 先处理 C1/C2/C3/C5。本文只提供方案，不构成授权。**

---

## 1. M6 准入条件总表

| ID | 条件 | 判据 | 当前状态 | 阻塞 | 责任 |
|---|---|---|---|---|---|
| C1 | 证书剩余 ≥60 天 | 双域名 SAN + `notAfter` + 链/HTTPS | ❌ 约 34–35 天 | 全部上线动作 | Owner |
| C2 | 环境与权限落地 | 用户/目录/unit/helper/spool 创建 + 权限测试 | ❌ 未授权 | M6 | Owner 授权，开发执行 |
| C3 | 资源实测 | S0 24h + S1–S5 + P1–P9 | ❌ 未执行 | M6 | 开发执行，Owner 确认 |
| C4 | D4 页脚入口 | 批准变更单或书面接受流量≈0 | ⏸ 未决 | 不阻塞 M6 | Owner |
| C5 | Sitemap 工具签字 | 哈希 + 变更单 + 18/18 回归 + 运行时断言 | ❌ 未签 + 断言缺失 | M6 | Owner |
| C6 | robots 策略 | 文件归档，不由 CMS 部署 | ⏸ 未决 | 不阻塞 M6 | Owner |
| F | M1–M5 冻结 | 205/205 + I1–I6 + 哈希 | ✅ 通过 | — | 已完成 |
| N | Nginx 文章路由 | `/article/` 位置块与软链读取 | ⏸ 未设计落地 | M6 | Owner 授权 |
| T | M6 测试 | 本文 T1–T10 全绿 | ⏸ 未执行 | M6 | 开发执行 |

### 1.1 已具备 / 尚未核实 / 需授权 / M6 / M7

| 事项 | 已具备 | 尚未核实 | Owner 授权 | M6 验证 | M7 验证 |
|---|---|---|---|---|---|
| M1–M5 代码与测试 | ✅ 205/205 | — | — | — | — |
| 工具哈希 | ✅ `ae1678d9…6846` | 部署副本一致性 | C5 签字 | 构建前断言 | 生产核对 |
| 证书 | — | 当前剩余天数 | 续签/部署 | HTTPS 冒烟 | 生产证书 |
| 用户/目录/unit/helper/spool | — | — | ✅ 必须 | 权限/隔离 | 生产权限审计 |
| 内存/CPU/磁盘 | — | 全部 | 测试窗口 | S0–S5 | 生产容量 |
| Nginx `/article/` | — | 现有 vhost | ✅ 必须 | 沙箱 vhost | 生产 vhost |
| 软链/sitemap 切换 | 本地模型 | 真实 `rename` | C2 | T5 | 生产切换 |
| SQLite 恢复 | 本地 12/12 | Linux 语义 | C2/M7 | T6/T7 | 生产演练 |
| 下架桩页 HTTP | 本地文件 | 真实 HTTP | Nginx | T8 | 生产 HTTP |
| 共享 CSS | 本地无内部依赖 | 生产 vhost | — | T9 | 生产 HTTP |
| timer 兜底 | 设计 | systemd 行为 | ✅ 未批 | T2 | 生产值守 |

---

## 2. C1：证书条件

### 2.1 核查对象

| 域名 | 用途 | 要求 |
|---|---|---|
| `www.mcuatlas.xyz` | 主站/canonical/OG/文章 | 证书 SAN 必须包含；HTTPS 200 |
| `mcuatlas.xyz` | 301 → `www` | 证书 SAN 必须包含；不能因跳转跳过 TLS 握手 |

V2.1 记录：现有证书 `CN=www.mcuatlas.xyz`，SAN 含 `mcuatlas.xyz`；`notAfter=Dec 14 23:59:59 2026 GMT`。**本轮未连接服务器复核。**

### 2.2 只读核查命令（M6 预检执行）

```bash
# 1) 文件证书（不读私钥内容）
openssl x509 -in /www/server/panel/vhost/cert/mcuatlas.xyz/fullchain.pem \
  -noout -subject -issuer -dates -ext subjectAltName

# 2) 线上握手证书（两个域名分别做）
openssl s_client -connect www.mcuatlas.xyz:443 -servername www.mcuatlas.xyz </dev/null 2>/dev/null \
  | openssl x509 -noout -subject -issuer -dates -ext subjectAltName
openssl s_client -connect mcuatlas.xyz:443 -servername mcuatlas.xyz </dev/null 2>/dev/null \
  | openssl x509 -noout -subject -issuer -dates -ext subjectAltName

# 3) 证书链/到期时间（示例）
echo | openssl s_client -connect www.mcuatlas.xyz:443 -servername www.mcuatlas.xyz 2>/dev/null \
  | openssl x509 -noout -checkend $((60*24*3600)) && echo ">=60d" || echo "<60d"

# 4) 自动续签覆盖
ls -1 /root/.acme.sh 2>/dev/null | grep -i mcuatlas || echo "acme 未覆盖"
crontab -l 2>/dev/null | grep -i acme
systemctl list-timers --all | grep -i -E 'acme|certbot' || true

# 5) Nginx 实际引用（不打印私钥）
nginx -T 2>/dev/null | grep -n -A3 -B2 'ssl_certificate'
```

### 2.3 验收标准

必须全部满足：

1. `www.mcuatlas.xyz` 与 `mcuatlas.xyz` 的线上证书 SAN 均包含对应域名。
2. 两个域名 `notAfter - now ≥ 60×24×3600 秒`。
3. 证书链完整（`openssl verify` 或浏览器无链错误），TLSv1.2/1.3 可握手。
4. 若依赖自动续签：`acme.sh`/certbot 的续签任务存在、最近一次续签记录成功、下一次计划早于到期前 30 天；仅“目录存在”不算通过。
5. 不接受“先上线、到期前再续”的方案。

### 2.4 不满足时的处理

| 情况 | 处理 |
|---|---|
| 剩余 <60 天 | **不进入 M6**；Owner 在阿里云续签 DV 或纳入 acme.sh webroot |
| 剩余 <30 天 | **停止一切上线动作**（V2.1 硬约束）；先续签再评估 |
| SAN 缺 apex/www | 重新签发包含双域名的证书 |
| 自动续签未覆盖 | 建立续签任务 + 台账；不得只靠人工记忆 |
| 续签后 | 部署 fullchain/privkey 到原路径 → `nginx -t` → `nginx -s reload` → 重跑 2.2/2.3 |

> 续签、部署、reload 都是生产动作，需 Owner 授权；本轮只写方法。

### 2.5 当前判定

按本地 V2.1 记录（2026-11-09）剩余约 35 天；按 2026-11-10 计算约 34–35 天，**低于 60 天**。因此 C1 当前**不满足**；未联网复核，不能写成“证书已续签”。

---

## 3. C2：Linux 运行环境与权限

### 3.1 隔离环境建议

- 使用**独立、可销毁的 Linux VM**（Alibaba Cloud Linux 3 或同代 systemd 239 环境），不与生产共用。
- 路径按生产形态搭建，但根目录为 `/srv/m6-sandbox` 或独立 VM 的 `/www/wwwroot`；不接入生产 DB、不接生产 H5、不使用生产证书。
- Nginx 独立端口（如 `18080`），CMS 独立端口（如 `18790`），仅监听 `127.0.0.1`。
- 测试前快照；测试后销毁或回滚快照。**不创建生产资源。**

### 3.2 用户与目录

| 对象 | owner:group | mode | 用途 |
|---|---|---|---|
| `/www/wwwroot/mcu-cms` | root:root | 0755 | 代码根，mcucms 不可写 |
| `.../app` | root:root | 0755 | 代码，只读 |
| `.../data` | mcucms:mcucms | 0711 | 可穿越到 media；不可列目录 |
| `.../data/cms.db` | mcucms:mcucms | 0600 | DB |
| `.../data/media` | mcucms:mcucms | 0755 | Nginx 只读；文件 0644 |
| `.../releases` | mcucms:mcucms | 0755 | Nginx 可读；mcucms 可写 |
| `.../tmp` | mcucms:mcucms | 0700 | 构建临时 |
| `.../logs` | mcucms:mcucms | 0750 | 本地日志 |
| `.../spool` | root:root | 0755 | 父目录 |
| `.../spool/incoming` | mcucms:mcucms | 0700 | CMS 投递 |
| `.../spool/work` | root:root | 0700 | helper 独占 |
| `.../spool/done` | root:root | 0755 | CMS 读结果；文件 0644 |
| `.../spool/failed` | root:root | 0755 | 运维排查；文件 0644 |
| `/www/wwwroot/mcu-h5` | root:www | 0755 | 现有 H5，只读 |
| `h5/article` | root:root | symlink | 指向 `releases/<seq>/article` |
| `h5/media` | root:root | symlink | 指向 `data/media`（如启用） |
| `h5/sitemap.xml` | root:root | 0644 | 仅 helper 可换 |
| `/usr/local/sbin/mcu-cms-publish` | root:root | 0755 | helper |
| `/etc/systemd/system/mcu-cms*.service/.path` | root:root | 0644 | 单元 |

创建顺序（授权后）：

1. `mcucms` 系统用户（`--system`、nologin、home `/www/wwwroot/mcu-cms`）。
2. 目录树与上述 owner/mode。
3. 部署 root-owned 代码（只读）。
4. 以 `mcucms` 执行 `migrate.cjs` 建库。
5. 安装 helper（root:root 0755）。
6. 写 CMS service → 写 publish service/path（**不创建 timer**，除非 Owner 另批）。
7. `systemctl daemon-reload`。
8. 沙箱 Nginx vhost（独立端口）。
9. 权限负向测试（T4）通过后，才允许功能测试。

### 3.3 CMS service 草案（未创建）

```ini
[Unit]
Description=MCU Atlas CMS (loopback only)
After=network.target

[Service]
Type=simple
User=mcucms
Group=mcucms
WorkingDirectory=/www/wwwroot/mcu-cms
ExecStart=/opt/node24/bin/node app/server.cjs
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
NoNewPrivileges=yes
PrivateTmp=yes
ProtectSystem=full
ProtectHome=yes
ProtectKernelTunables=yes
ProtectControlGroups=yes
RestrictAddressFamilies=AF_UNIX AF_INET AF_INET6
ReadWritePaths=/www/wwwroot/mcu-cms/data /www/wwwroot/mcu-cms/releases /www/wwwroot/mcu-cms/tmp /www/wwwroot/mcu-cms/logs /www/wwwroot/mcu-cms/spool/incoming
ReadOnlyPaths=/www/wwwroot/mcu-h5 /www/wwwroot/mcu-cms/app
MemoryMax=192M
MemoryHigh=160M
OOMScoreAdjust=500
Restart=on-failure
RestartSec=5
UMask=0022

[Install]
WantedBy=multi-user.target
```

说明：

- `CMS_H5_DIR` 必须显式设置；默认 `REPO_ROOT/h5` 在部署布局下会指错。
- `CMS_SITEMAP_TOOL` 必须指向 CMS 内工具副本，不能放 Web root。
- `UMask=0022` 让 release 文件可被 Nginx 读；`data` 仍 0711/0600。
- `ProtectSystem=full` 使 `/usr`、`/boot`、`/etc` 只读；`/www` 仍可写，故用 `ReadOnlyPaths` 锁定 H5/code。
- 不添加 `MemoryDenyWriteExecute`（V8 JIT 风险，未验证）。
- `Restart=on-failure` 可能导致异常循环；M6 必须测试异常退出与重启上限。

### 3.4 发布 unit 与 helper 的最小权限

```ini
# /etc/systemd/system/mcu-cms-publish.service（草案）
[Unit]
Description=MCU CMS publish helper (release switch only)
StartLimitIntervalSec=0

[Service]
Type=oneshot
User=root
Group=root
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
ReadWritePaths=/www/wwwroot/mcu-h5 /www/wwwroot/mcu-cms/spool /www/backup/cms-sitemap /var/log
ReadOnlyPaths=/www/wwwroot/mcu-cms/releases /www/wwwroot/mcu-cms/app /etc /usr /boot
StandardOutput=journal
StandardError=journal
```

```ini
# /etc/systemd/system/mcu-cms-publish.path（草案）
[Unit]
Description=Watch CMS publish spool

[Path]
PathExistsGlob=/www/wwwroot/mcu-cms/spool/incoming/*.req
Unit=mcu-cms-publish.service

[Install]
WantedBy=multi-user.target
```

**helper 只允许**：

1. `symlink` + `rename` 切换 `h5/article`；
2. `rename` release sitemap → `h5/sitemap.xml`（旧件备份）；
3. spool 内 `incoming → work → done/failed` 搬移；
4. append 一行日志。

**禁止**：`unlink`/递归删除/`exec`/网络/读 spool 与 releases 之外的路径/写 DB/接受请求中的任意路径或命令。请求字段白名单 + `release_seq` 推导路径 + `O_NOFOLLOW` + `st_uid==mcucms` + `st_nlink==1` + `st_dev` 同盘 + 文件大小上限。

**不创建 timer**；`.path` 的失败重触发风险已在 T2 中作为人工 `systemctl start` 兜底验证。是否加 timer 由 Owner 另批。

### 3.5 root helper 最小权限审查结论

- CMS 进程**永不** sudo、永不 setuid、`NoNewPrivileges=yes` 保持不变。
- root 只存在于 oneshot helper，生命周期 ≤60s，只做固定 rename/symlink。
- helper 不读取请求中的路径/命令；所有路径由 `release_seq` 推导并做白名单/同盘/非软链校验。
- helper 不写 DB；CMS 自己写 DB。
- helper 的 `ReadWritePaths` 只含 h5、spool、backup、log；`/etc`/`/usr`/`/boot` 只读。
- **未验证**：systemd 239 下 `ReadWritePaths` 对 `/www` 的行为、`ProtectSystem=full` 与软链 rename、`O_NOFOLLOW`、`st_dev`；全部列入 M6 T4。

---

## 4. C3：服务器资源与共存风险

### 4.1 必须采集的指标

| 类别 | 指标 | 来源 |
|---|---|---|
| 系统内存 | `MemAvailable`、SwapFree、`pswpin/pswpout` | `/proc/meminfo`、`/proc/vmstat` |
| CMS cgroup | `memory.usage_in_bytes`、`memory.stat:rss/cache`、`max_usage_in_bytes`、`memsw.max_usage_in_bytes`、`failcnt`、`oom_control` | cgroup v1 |
| 进程 | RSS/PSS、线程数、fd 数 | `/proc/<pid>` |
| CPU | `%usr/%sys/%iowait`、loadavg、每核 | `mpstat`/`pidstat`/`/proc/loadavg` |
| 磁盘 | `/www`、`/var` 使用率、inode、release/tmp/WAL 增长 | `df -h`、`df -i`、`du` |
| I/O | 读写吞吐、await | `iostat -x` |
| 业务 | CMS HTTP 延迟/错误、构建耗时、SQLite busy、WAL 大小 | 日志/curl/DB |
| 既有服务 | nginx/forum/mariadb/php-fpm 的 RSS、重启、5xx | systemd/日志 |

**不得使用历史 146/162 MB 快照作为通过依据。** 必须重新采 24h。

### 4.2 测试场景

| 编号 | 内容 | 时长 | 授权 |
|---|---|---|---|
| S0 | 不启动 CMS，24h 被动采样 | 24h | 只读 |
| S1 | 启动 CMS 空载 | 10min | 起服务 |
| S2 | 10 次保存 + 3 次预览 + 2 次切换 | 20min | 是 |
| S3 | 20 篇构建 | 15min | 是 |
| S4 | 60 篇构建 | 20min | 是 |
| S5 | S4 + 20rps 读 | 20min | 是 |
| S6 | 08:00 cron 窗口 | 30min | 只读 |

### 4.3 通过标准

| # | 判据 | 阈值 |
|---|---|---|
| P1 | S1 空载 cgroup `rss` | ≤45 MB |
| P2 | S2 后台峰值 anon 增量 | ≤+25 MB |
| P3 | S3/S4 构建峰值 `rss` | ≤ A − 60 − C |
| P4 | S4/S5 `MemAvailable` 最低 | ≥60 MB |
| P5 | 每场景 swap 增量 | ≤8 MB |
| P6 | 全局 OOM | 0 |
| P7 | 现有服务 RSS 偏差/重启/5xx | ≤10%，0 重启，0 5xx |
| P8 | `failcnt` 增量 | 0 |
| P9 | S6 08:00 `MemAvailable` 最低 | ≥60 MB |
| P10 | 构建 CPU/IO 不导致现有服务超时 | 既有接口 P95 不劣化 >20% |

### 4.4 共存风险与降级

- CMS 与 H5、Forum API、MariaDB、php-fpm、WordPress 共存；CMS 构建峰值可能挤压缓存/swap。
- 任何 `MemAvailable <40MB`、持续 swap >20MB/min、OOM、既有服务重启/5xx → 立即停止。
- 降级路线：
  - R1 流式构建/限制 old-space；
  - R2 低峰 + Nice/CPUQuota；
  - R3 本地构建上传 release；
  - R4 扩容/停 WordPress（需 Owner，且不能算 CMS 通过）。
- **停 WordPress 不得作为默认方案，也不得由开发自行执行。**

---

## 5. C5：Sitemap 工具签字

### 5.1 签字对象与依据

| 项 | 内容 |
|---|---|
| 文件 | `h5/tools/generate-sitemap.cjs` |
| 当前 SHA-256 | `ae1678d981577dc3b401d15dad314e1abae3878ac00b73ad1ff3bbf6fd936846` |
| 字节 | 13,456 |
| 签署人 | **Owner**（部署授权）；**ChatGPT**（技术验收复核）；CodeBuddy 提供证据，不代替签字 |
| 依据 | 变更单 F3；18/18 sitemap 测试；205/205 全量；黄金输出 `9ce7ffb0…c90219`；无线上写入 |
| 部署位置 | `/www/wwwroot/mcu-cms/app/tools/generate-sitemap.cjs`（不得放 Web root） |
| 登记 | `cms_settings.tool_sha256` |

### 5.2 必须补的运行时断言

**当前冻结代码没有在构建前断言工具哈希**。V2.1 §6.3 要求“每次发布前断言部署副本哈希 == 仓库登记哈希”。因此即使 Owner 签字，C5 仍未闭环。

最小方案（**未实施，需 Owner 决定是否解除冻结**）：

1. 在 `buildSite()` 调用工具前，`sha256(config.SITEMAP_TOOL)` 与 `settings.tool_sha256` 比对；不一致 `SITEMAP_TOOL_HASH_MISMATCH` BLOCK；或
2. M6 预检脚本在启动构建前独立比对；CMS 不内置断言。

本文不选择、不实施；列为 Owner 决策。

### 5.3 哈希不一致处理

1. 停止构建/发布，不写任何 release/sitemap。
2. `sha256sum` 复核部署副本、仓库文件、签字记录三处。
3. 若部署副本被改：按签字副本重新安装；不 diff 后“将就”。
4. 若仓库文件被改：重新走 F3 变更单与测试，重新签字。
5. 不得以“输出仍为黄金基线”为由跳过哈希不一致。

---

## 6. Linux 隔离环境设计

| 项 | 设计 |
|---|---|
| 主机 | 独立、可销毁 Linux VM；systemd 239 或同代；不与生产共用 |
| 用户 | `mcucms`（nologin）；测试操作者另用 `ops` |
| 代码 | 冻结版 mcu-cms root-owned 只读；H5 复制到沙箱（不接生产） |
| 数据 | 合成 60 篇文章、分类、标签、媒体；无生产 DB/媒体 |
| 端口 | CMS 18790；Nginx 18080；仅 127.0.0.1 |
| 域名 | Nginx `server_name www.mcuatlas.xyz`，curl `--resolve`/Host；不解析生产 |
| 证书 | 沙箱可用自签/本地 CA；**不作为 C1 证据** |
| 网络 | 禁止出公网/禁止访问生产；仅本地 |
| 快照 | 测试前 VM snapshot；失败回滚；测试后销毁 |
| 日志 | `/srv/m6/logs`，保留到复审 |

**隔离判定**：任何测试步骤若访问生产路径/域名/DB/证书，立即停止，不算 M6。

### 6.1 沙箱 Nginx 文章路由（草案）

```nginx
server {
    listen 18080;
    server_name www.mcuatlas.xyz;
    root /www/wwwroot/mcu-h5;

    location = /article { return 301 /article/; }
    location ^~ /article/ {
        try_files $uri $uri.html $uri/index.html =404;
        add_header Cache-Control "public, max-age=300";
    }
    location = /sitemap.xml { try_files $uri =404; }
}
```

验证点：`/article/`、`/article/<slug>`、`/article/<slug>.html`、`/article/page/2`、`/article/c/<cat>`、`/article/c/<cat>/page/2`、`/article/assets/article.css`、`/sitemap.xml`；确认 Nginx 未开启 `disable_symlinks` 阻断。

---

## 7. M6 测试顺序与完整验收标准

### 7.0 顺序

1. **T0 预检**：快照、哈希、证书、端口、无生产访问。
2. **T4 权限隔离**（先于功能；防提权）。
3. **T1 CMS 服务**。
4. **T3 spool**。
5. **T2 path/重复触发**。
6. **T5 软链切换/回滚**。
7. **T8 桩页 HTTP** / **T9 页面/CSS/Sitemap**。
8. **T6 备份恢复** / **T7 并发写入**。
9. **T10 异常/中断/I1–I6**。
10. 清理与证据归档。

### T1 CMS 服务启动、停止、异常退出

- **目的**：验证 unit 生命周期、回环监听、异常重启不损坏 DB。
- **前置**：C2 完成；DB migrate；管理员；端口 18790；无生产。
- **步骤**：`systemctl start` → health；`stop` → `is-active`；`kill -9` → `systemctl start`；查 journal/DB integrity。
- **预期**：active；health 200；stop 后 `inactive`（非 0 退出）；重启成功；`integrity_check=ok`；不监听 0.0.0.0。
- **失败**：公网监听、崩溃循环、DB 损坏、重启后数据丢失。
- **回滚**：stop/disable；恢复快照。
- **生产数据**：否。**风险**：中。

### T2 发布 path/service 触发与重复触发

- **目的**：验证 `.path` 触发、重复触发、10 条上限和剩余请求。
- **前置**：T1/T3 通过；两个 release；spool 权限正确。
- **步骤**：投 1 个请求 → 观察 service；重复同一 id；投 12 个；观察一轮；必要时 `systemctl start mcu-cms-publish` 处理剩余。
- **预期**：只切换一次；duplicate 不产生第二次副作用；单轮 ≤10；剩余可在下一次触发/人工启动后完成；无不稳定崩溃。
- **失败**：重复切换、覆盖 work、队列永久滞留且无恢复手段、systemd 报错循环。
- **回滚**：软链/sitemap 回 prev；清空沙箱 spool；快照。
- **生产数据**：否。**风险**：高。

### T3 spool 锁、claim、冲突、重试、失败

- **目的**：验证锁、原子 claim、异常文件、done/failed、重试。
- **前置**：helper；测试用户可构造 incoming。
- **步骤**：占锁后触发；陈旧锁；符号链接/硬链接/超 4096B/非法 JSON/未知字段；同 id work 冲突；handler 失败；done 后重复触发。
- **预期**：锁冲突 exit 75；异常进 failed；不执行、不崩溃；旧 work 不被覆盖；失败不阻塞后续；duplicate 不重复执行。
- **失败**：执行恶意请求、覆盖旧 work、批量崩溃、done/failed 双状态。
- **回滚**：清空沙箱 spool；快照。
- **生产数据**：否。**风险**：高。

### T4 root helper 权限隔离

- **目的**：证明 `mcucms` 不能改 H5/sitemap/helper；helper 只做白名单操作。
- **前置**：C2 权限；helper root:root 0755；测试用户。
- **步骤**：以 `mcucms` 尝试写 `h5/*.html`、`h5/sitemap.xml`、`h5/article`、helper、units、`/etc`；构造请求带 `path`/`command`/绝对 seq；用 symlink/hardlink 替换请求；检查 helper 是否 `exec`/网络/写 DB。
- **预期**：全部 permission denied/拒绝；helper 只 rename/symlink/append；无 root shell；无任意路径。
- **失败**：任何越权写、helper 接受参数/路径、可执行命令、读取 releases 之外文件。
- **回滚**：立即停止 unit；恢复权限/快照；按安全事故处理。
- **生产数据**：否。**风险**：**极高（一票否决）**。

### T5 软链切换与失败回滚

- **目的**：验证两次 rename、sitemap 同步、F4/F5/F9/F13 状态。
- **前置**：T1–T4 通过；两个有效 release；Nginx 沙箱。
- **步骤**：正常切换 → `readlink`/sitemap SHA/HTTP；在两次 rename 间终止 helper；手工改软链；损坏 release；回滚。
- **预期**：正常 `published`；F4 重试 sitemap；F5 补写；F9 `inconsistent` 人工；F13 `rolled_back`；HTTP 与文件一致。
- **失败**：混合状态未识别、404、DB/文件永久不一致。
- **回滚**：软链回 prev；sitemap 备份覆盖；`reconcile()`；快照。
- **生产数据**：否。**风险**：高。

### T6 SQLite 备份、恢复、WAL/SHM

- **目的**：验证 `VACUUM INTO`、pre-restore、`integrity_check`、媒体 manifest、恢复顺序。
- **前置**：T1；合成 DB/媒体；停服务脚本。
- **步骤**：写入 WAL → backup → 修改 → stop → restore；注入 `failAt`/kill；恢复后 verify；损坏备份；占用。
- **预期**：备份为快照；restore 后无旧 WAL/SHM；integrity ok；失败回滚；`left_for_manual`/`ROLLBACK_FAILED` 可识别。
- **失败**：丢已提交数据、旧库被删、无法回滚、媒体缺失未发现。
- **回滚**：`.pre-restore-*`；VM 快照。
- **生产数据**：否。**风险**：**极高**。

### T7 进程占用、并发写入、恢复前停服

- **目的**：验证有活动写入时不得恢复；停服检查有效。
- **前置**：T1/T6；写入循环。
- **步骤**：服务运行 + 写入循环，尝试 restore（负向）；记录结果；stop 后按手册 `is-active/ss/pgrep/lsof/fuser`；再 restore。
- **预期**：有写入时拒绝/失败或明确不安全；stop 后检查全绿；恢复无丢写。
- **失败**：带写入恢复“成功”但丢数据；检查命令误判。
- **回滚**：快照/pre。
- **生产数据**：否。**风险**：**极高**。

### T8 下架桩页 HTTP 200、noindex、canonical

- **目的**：验证生产式 HTTP 行为，不是只看文件。
- **前置**：T5/T1；Nginx 沙箱；published/unpublished/archived 样本。
- **步骤**：curl 三个 slug（无 `-L`）；检查状态码/`Content-Type`/meta robots/canonical/正文 marker/JSON-LD 类型；HEAD；`/article/` 列表。
- **预期**：published 200 index；unpublished/archived 200 `noindex,follow`、自指 canonical、无 Article LD、无原正文；列表不含下架 slug。
- **失败**：404、index、canonical 错、Article LD、正文泄露。
- **回滚**：切换回 prev release；Nginx 配置快照。
- **生产数据**：否。**风险**：中。

### T9 文章、列表、分类、CSS、Sitemap HTTP 验收

- **目的**：验证静态产物在 Nginx 下可读、类型正确、无 JS 可读。
- **前置**：T8；60 篇/分类/分页。
- **步骤**：curl `/article/`、`/article/<slug>`、`/article/page/2`、`/article/c/<cat>`、`/article/c/<cat>/page/2`、`/article/assets/article.css`、`/sitemap.xml`；检查 200/Content-Type/正文/ canonical/OG/分页/sitemap 结构。
- **预期**：200；HTML `text/html`；CSS `text/css`；sitemap XML 严格、无下架、基础顺序不变；无 JS 正文可读。
- **失败**：404/403/MIME 错、分页 404、sitemap 缺/多/顺序错、CSS 缺失。
- **回滚**：release 回 prev；Nginx 快照。
- **生产数据**：否。**风险**：低–中。

### T10 服务异常、发布中断、恢复后 I1–I6

- **目的**：验证状态机在异常后的唯一收敛和一致性。
- **前置**：T1–T9；故障注入脚本。
- **步骤**：注入 F1/F2/F3/F4/F5/F7/F11/F13；`systemctl restart`/`reconcile`；跑 I1–I6；HTTP 抽查；重复注入。
- **预期**：按 V2.1 §5.3 收敛；F9/F12 类进 `inconsistent`；I1–I6 全 true；无静默成功。
- **失败**：状态机卡死、自动处理不一致、I1–I6 false、HTTP/文件不符。
- **回滚**：prev release + DB pre + 快照。
- **生产数据**：否。**风险**：高。

### 7.1 风险与回滚汇总

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

---

## 8. M6 失败后的停止条件

任一命中立即停止全部 M6，不继续“观察”：

1. 任何生产路径/域名/DB/证书被读写。
2. `mcucms` 能写 H5/sitemap/helper/units/`/etc`，或 helper 接受任意路径/命令。
3. 恢复导致已提交数据丢失，或 `ROLLBACK_FAILED` 无法收敛。
4. 并发写入下恢复“成功”且无法证明无丢写。
5. 现有 Nginx/Forum/MariaDB/php-fpm 出现 5xx、重启、OOM。
6. `MemAvailable <40MB`、持续 swap >20MB/min、OOM kill。
7. 证书 <30 天或 HTTPS 链失败。
8. 工具哈希不一致且无法恢复签字副本。
9. 桩页非 200、sitemap 混入下架页、I1–I6 false。
10. Owner 要求停止。

停止动作：停 CMS/path/helper；保留 VM 快照与日志；不清理现场；输出失败证据；等待 Owner 决策。

---

## 9. M7 与 M6 的边界

| 项 | M6 | M7 |
|---|---|---|
| 数据 | 合成 60 篇/沙箱 | 生产数据副本 |
| 环境 | 独立 VM/沙箱 | 生产或生产同构维护窗口 |
| Nginx/证书 | 沙箱 vhost/自签 | 真实 vhost/证书 |
| 备份 | 合成 DB/媒体 | 真实 DB/媒体/sitemap |
| 恢复 | `failAt`/kill 模拟 | 真实停服、真实备份、RPO/RTO |
| 目标 | 证明机制可行 | 证明生产可恢复 |
| 授权 | C2/C3/测试窗口 | Owner + 维护窗口 + 生产访问 |

**M6 通过不代表 M7 通过；M7 未启动。**

---

## 10. 需要 Owner 决策/授权

1. **C1**：证书续签（阿里云 DV 或 acme.sh webroot）+ 部署/reload。
2. **C2**：创建 `mcucms`、CMS unit、publish service/path、helper、spool、目录权限；是否允许 timer（本轮不创建）。
3. **C3**：S0 24h + S1–S5 测试窗口、负载授权、是否接受降级路线。
4. **C4**：D4 页脚入口是否批准（不阻塞 M6）。
5. **C5**：签署 `ae1678d9…6846`；决定运行时哈希断言方案（需解冻或 M6 预检脚本）。
6. **Nginx**：`/article/` 路由、`h5/article`/`h5/media` 软链、`disable_symlinks` 检查。
7. **M6 沙箱**：独立 VM/临时资源、数据合成、网络隔离。
8. **C6**：robots 策略（不阻塞）。
9. **M7**：后续单独授权，不在本轮。

---

## 11. 最终判定

| 项 | 判定 |
|---|---|
| M1–M5 | 冻结通过（205/205，I1–I6） |
| M6 方案 | 本文完成，可执行但未执行 |
| C1 | ❌ 不满足（约 34–35 天 <60） |
| C2 | ❌ 未授权 |
| C3 | ❌ 未实测 |
| C5 | ❌ 未签字 + 运行时断言缺失 |
| M6 执行 | **不准入** |
| M7 | 未启动 |
| 生产部署 | 不批准 |

**下一步**：Owner 先处理 C1/C2/C3/C5；批准后在独立 Linux 沙箱按 T0–T10 执行，输出每项证据，再由 ChatGPT 复审。本文不构成 M6 执行结果或生产授权。
