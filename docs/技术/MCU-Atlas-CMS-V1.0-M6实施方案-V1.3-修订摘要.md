# M6 实施方案 V1.2 → V1.3 修订摘要

对照：`MCU-Atlas-CMS-V1.0-M6准入条件与Linux隔离验证实施方案-V1.2.md`
现行：`MCU-Atlas-CMS-V1.0-M6准入条件与Linux隔离验证实施方案-V1.3.md`

| # | 复审缺口 | V1.3 处理 |
|---|---|---|
| 1 | systemd 配置不完整 | 完整列出 `mcu-cms.service`、`mcu-cms-publish.service`、`mcu-cms-publish.path` 全文；补 `CapabilityBoundingSet=`、`AmbientCapabilities=`、`PrivateDevices`、`RestrictSUIDSGID`、`RestrictRealtime`、`ProtectKernelModules`、`UMask`；未确认参数标 M6 验证 |
| 2 | S1–S5 场景定义不足 | 新增完整场景表：目的、服务状态、操作、负载、时长、采样、重复、重置、通过/失败；指标映射到 S1–S5 |
| 3 | G3 guard 调用链未审计 | 逐行列出 `build.cjs` 两处 `spawnSync`；确认无其他 app 入口；说明 NODE_OPTIONS 继承、`shell:true`/自定义 env 例外、直接 CLI 绕过；负向测试与停止条件 |
| 4 | 网络隔离证据不足 | 增加 Owner 台账/固定 IPv4/IPv6、默认拒绝、全接口/路由/监听、本地 DNS、固定 IP `openssl/curl` 试探、`tcpdump` 10s 超时；DNS 失败不作唯一证据 |
| 5 | 沙箱 H5 目录不清 | 明确 Nginx root 为 VM 内合成 H5 目录；禁止挂载/同步/软链生产 H5；给出 `findmnt/readlink/stat` 验证 |
| 6 | 生产证书检查不完整 | 保留 C1 只属生产部署；补 SAN/域名匹配、系统 CA 链验证、TLS1.2/1.3、剩余期、文件/线上一致性；2026-12-14 记录未经联网复核 |
| 7 | T4 前 path 误触发 | 创建顺序明确 path 先 disabled/stopped；T4 通过后才 enable；T4 步骤先检查状态 |
| 8 | Owner 签字证据不足 | 明确 `signed_by/signed_at` 不是签字；Owner 须书面批准具体 `RELEASE-MANIFEST.json` SHA-256 |
| 9 | helper 空 capability | 说明请求文件必须 0644；空 capability 下验证 rename/symlink/append；不得直接加 `CAP_DAC_OVERRIDE` |

## 边界

- 方案文档修改；未改代码、未执行 M6、未连接服务器、未创建资源。
- M1–M5 保持冻结；M6 新组件独立版本/哈希管理。
- 方案通过 ≠ 执行授权；M6 通过 ≠ 生产部署批准。
