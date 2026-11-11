# M6 实施方案 V1.2 修订摘要

对照：`MCU-Atlas-CMS-V1.0-M6准入条件与Linux隔离验证实施方案-V1.1.md`
现行：`MCU-Atlas-CMS-V1.0-M6准入条件与Linux隔离验证实施方案-V1.2.md`

| # | V1.1 复审问题 | V1.2 处理 |
|---|---|---|
| 1 | CMS service / helper 配置不完整 | 补齐完整 `[Unit]/[Service]/[Install]`、实际 systemd 参数、`ExecStartPre`、`NODE_OPTIONS` guard、日志目录与 0750/0640 权限 |
| 2 | C5 预检无强制入口 | 定义 G1 部署门、G2 CMS `ExecStartPre`、G3 `NODE_OPTIONS` spawn guard、G4 helper `ExecStartPre`；明确正常发布链无法绕过；**尚未实现，不得宣称已验证** |
| 3 | P3 RSS/cgroup 口径混淆 | 区分进程 RSS、`usage_in_bytes`、`memory.stat:rss`；`B_total` 统一为 cgroup anon rss 峰值（含父子），2s 采样；不再用 `max_usage_in_bytes` 作判据 |
| 4 | P7/P9 定义不足 | 冻结服务清单；S0 24h 基线；S4/S5 窗口；`NRestarts`/`ActiveEnterTimestamp`/journal 识别重启；Nginx/Forum 5xx；S6 仅生产只读、不启动 CMS |
| 5 | P3-Prod 1.5 系数来源 | 明确为**无实测依据的保守估算参数**；生产仍需 `A_prod` + canary，不得写成已验证容量模型 |
| 6 | M6 新组件版本管理缺失 | `ops/RELEASE-MANIFEST.json` 管理 helper/unit/path/preflight/guard/harness 版本与哈希；禁止修改 M1–M5 冻结代码 |
| 7 | P5 页大小 | 使用 `getconf PAGESIZE`，不写死 4KiB |
| 8 | S0-VM 顺序 | 24h 采样归档后才允许启动 CMS；中途启动则丢弃基线重采 |
| 9 | 网络隔离证据 | 路由、nft/iptables、`ss`、生产域名 `curl/openssl` 试探、`tcpdump` 五类证据 |
| 10 | 真实 unit 权限测试 | `systemd-run` 仅探索；T4 必须在实际安装的 `mcu-cms.service`/`mcu-cms-publish.service` 上复跑 |
| 11 | 阈值包装成实测 | P1/P2/P5 等标注为预设验收标准；无数据不得写“已实测通过” |
| 12 | 签字角色 | **Owner 唯一签字**；CodeBuddy 提供证据；ChatGPT 仅技术复核，不签字 |

## 角色与边界

- M1–M5：继续冻结，205/205、I1–I6 基线不变。
- M6 新增组件：独立版本、独立哈希、独立审查，不复用冻结业务代码。
- 方案通过 ≠ M6 执行授权；M6 通过 ≠ 生产部署批准。
