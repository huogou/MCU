# M6 实施方案 V1.3 → V1.4 修订摘要

对照：`MCU-Atlas-CMS-V1.0-M6准入条件与Linux隔离验证实施方案-V1.3.md`
现行：`MCU-Atlas-CMS-V1.0-M6准入条件与Linux隔离验证实施方案-V1.4.md`

| # | V1.3 复审问题 | V1.4 处理 |
|---|---|---|
| 1 | root helper 空 capability 无法穿越 `incoming 0700` | 改为专用组 `mcucms-publish` + `incoming 2770` setgid；helper `SupplementaryGroups=mcucms-publish`；请求文件 0640 组读；不增加 `CAP_DAC_OVERRIDE` |
| 2 | spool 权限矩阵不完整 | 新增 owner/group/mode/ACL/文件权限完整矩阵；`work` root:root 0700、`done` root:mcucms 0750、`failed` root:mcucms 0750；含 setgid/组继承 |
| 3 | 三个 unit 需完整正文 | 完整列出 `mcu-cms.service`、`mcu-cms-publish.service`、`mcu-cms-publish.path`；解释安全参数；未确认项标 M6 验证 |
| 4 | G3 验证设计不足 | 增加注入时机/模块加载顺序、两处 `spawnSync`、NODE_OPTIONS 继承、自定义 env 拒绝、shell/路径/哈希负向测试、release/CURRENT 不变验证、直接入口检测 |
| 5 | M6 准入复核项 | 增加 T0 固定 IP/IPv6、T4 真实 unit、S1–S5 采样、P3-Prod 估算边界、T2 人工兜底、T6/T7 停服约束表 |
| 6 | 权限不可行时停止 | 明确组/ACL 方案或空 capability 不满足时停止并提交替代设计，不得放宽权限 |

## 关键设计选择

- **采用组+setgid，不采用 ACL**：`incoming` 为 `mcucms:mcucms-publish 2770`，新请求文件继承组并 0640；helper 通过补充组读取/rename。
- **不增加 `CAP_DAC_OVERRIDE`**；`work` 仍 `root:root 0700`，`mcucms` 不在组内，不能访问。
- **请求文件 0640**，不再使用 0644；0644 只解决文件读，不解决源目录 rename。
- **G3 未验证**：guard 能否拦截冻结代码两处 `spawnSync` 必须在 M6 实测；若必须改冻结代码，停止。
- **Owner 签字**：`signed_by/signed_at` 不是签字；须书面批准具体 manifest SHA-256。

## 边界

- 仅方案文档；未改代码、未执行 M6、未连接服务器、未创建资源。
- M1–M5 保持冻结；M6 新组件独立版本/哈希管理。
- 方案通过 ≠ 执行授权；M6 通过 ≠ 生产部署批准。
