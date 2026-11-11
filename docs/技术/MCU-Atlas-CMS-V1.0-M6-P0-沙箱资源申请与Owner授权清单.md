# M6-P0 沙箱资源申请与 Owner 授权清单

> **已被 M6-P1 授权申请取代。** 文内 manifest `a4e171…09e1` 已失效；当前待批 SHA 见 `M6-P1-Owner授权申请.md`。
> 本清单是历史申请材料，不是授权。M6 未执行；未创建任何用户/组/目录/unit/资源。

## 1. 沙箱资源

| 资源 | 申请值 | 说明 |
|---|---|---|
| VM | 独立可销毁 Linux VM，systemd 239 或同代 | 不与生产共用；无生产挂载 |
| 用户 | `mcucms`（系统用户、nologin） | CMS service |
| 组 | `mcucms-publish`（系统组、无普通成员） | helper `SupplementaryGroups` |
| 根目录 | `/www/wwwroot/mcu-cms` | 沙箱内合成；非生产 |
| H5 | `/www/wwwroot/mcu-h5` | 独立 VM 内合成 H5；禁止挂载/同步/软链生产 |
| spool | `.../spool/{incoming,work,done,failed}` | incoming 2770 setgid；work root 0700 |
| 日志 | `/var/log/mcu-cms-publish` | helper 专用 root 0750 |
| helper | `/usr/local/sbin/mcu-cms-publish` | root:root 0755 |
| units | `mcu-cms.service`、`mcu-cms-publish.service`、`mcu-cms-publish.path` | path 在 T4 通过前 disabled |
| 工具 | `app/tools/generate-sitemap.cjs` | `ae1678d9…6846` |
| 备份 | `/www/backup/cms-sitemap` | root 0750 |
| 网络 | 固定 IPv4/IPv6 台账；默认出站拒绝；仅本地 | T0 证据 |

## 2. 三个 unit

完整草案见 `mcu-cms/docs/systemd/*.draft` 与 V1.4 §3.4/3.5：

- `mcu-cms.service`：`User=mcucms`、`NoNewPrivileges=yes`、空 `CapabilityBoundingSet`、`ExecStartPre` G2、`NODE_OPTIONS` G3。
- `mcu-cms-publish.service`：`User=root`、`SupplementaryGroups=mcucms-publish`、空 capability、`ExecStartPre` G4。
- `mcu-cms-publish.path`：`PathExistsGlob`；**T4 前不得 enable/start**。

## 3. Owner 书面批准事项

1. **本历史申请中的 SHA 已失效**：`a4e1715279cc216ab0d33f387948bbed3b33209bc4153a21e4dd6d046b3009e1`。当前待批 SHA 见 `M6-P1-Owner授权申请.md`：`8f8ca65…7b`。
2. 批准沙箱 VM、用户/组、目录、三个 unit、helper、spool、工具副本。
3. 批准在沙箱执行 T0–T10（不含生产）。
4. 批准 C5 工具/新增组件签字（Owner 为唯一签字人）。
5. 明确 M6 不包含生产部署、M7、Nginx/证书变更。

> `signed_by/signed_at` 不是签字；Owner 需对上述 manifest SHA 出具独立书面记录。manifest 任何变化即原批准失效。

## 4. T0–T10 顺序与停止

顺序：T0 → T4 → T1 → T3 → T2 → T5 → T8/T9 → T6 → T7 → T10。

硬性停止：

- 需修改 M1–M5 冻结代码；
- helper 需扩大权限/加 `CAP_DAC_OVERRIDE` 才能工作；
- systemd 239 无法提供必要隔离；
- 网络隔离固定 IP 仍可连通；
- 发布门禁存在绕过或失败副作用；
- manifest 无法锁定执行文件；
- 指标无法按 V1.4 口径计算。

## 5. 仍未验证

- Linux DAC：2770/0640、SupplementaryGroups、空 capability；
- systemd 239：`PrivateDevices`、`LogsDirectory`、父只读/子可写、path 重触发；
- G3 真实 CMS 环境（本机已有真实 buildSite 2 次调用测试，但非 systemd）；
- G4 POSIX symlink 切换（Windows SKIP）；
- 真实 HTTP、T6/T7、M7。

## 6. 状态

- M6：**未执行/未授权**。
- 生产部署：不批准。
- M7：未启动。
- 本清单仅提交 ChatGPT 复审与 Owner 决策。
