# M6 实施方案 V1.1 修订摘要

对照：`MCU-Atlas-CMS-V1.0-M6准入条件与Linux隔离验证实施方案-V1.0.md`
现行：`MCU-Atlas-CMS-V1.0-M6准入条件与Linux隔离验证实施方案-V1.1.md`

| # | 复审意见 | V1.1 修订 |
|---|---|---|
| 1 | C1 与 M6 未拆分，生产证书被误作独立 VM 前置 | M6 沙箱使用自签/本地 CA `www.m6.local`；C1 仅属生产部署；M6 通过 ≠ C1 通过 |
| 2 | C3 生产 S0 与 VM S1–S5 混在一起，易被误读为共存验证 | 拆为 A（生产 S0）、A2（VM S0-VM）、B（VM S1–S5）、C（文档估算）；明确 C 不是共存压力测试 |
| 3 | T7 要求代码自动识别并发写入，超出冻结代码能力 | 改为验证“操作流程必须阻止带写入恢复”；验证停服/残留进程/文件占用；无法确认即中止；不要求代码级写锁 |
| 4 | P3 的 A/C 未定义，P2/P4/P5/P7 口径不清 | 定义 `A_prod/A_vm/C_idle/C_base/B_total/M_min/SW/RSS_svc`；P3 改为 `B_total ≤ A_vm−60`，生产估算另列；P2 用 S2 前 5min 中位；P4 用 2s 最低值；P5 用 `pswpout` 绝对增量；P7 拆 RSS/重启/5xx |
| 5 | C5 只有一次性核查，无持续保护 | 新增独立 `ops/preflight-sitemap-hash.cjs` 方案：仓库/部署副本/签字值三方校验，每次构建/发布前执行，失败阻断；不改冻结代码 |
| 6 | helper `ReadWritePaths` 含 `/var/log` 过宽 | 改为 `/var/log/mcu-cms`（`LogsDirectory`）；只允许写自己的 `publish.log`；缩小读写路径；给出 systemd 239 验证方法 |
| 7 | 测试顺序/前置/回滚不清 | 固定 T0→T4→T1→T3→T2→T5→T8/T9→T6→T7→T10；S0-VM 在 T1 前；T6/T7 强制停服；T7 负向测试不调用 restore |
| 8 | 沙箱 HTTP 验收可能触碰生产域名 | 改 `www.m6.local` + 本地 CA + `--resolve`；canonical 只查字符串，不请求生产 |

## 结论

- V1.1 是方案，不是执行结果。
- M6 沙箱准入不依赖生产 C1；生产部署仍需 C1/C2/C3/C5/Nginx/M7/Owner。
- 冻结代码未修改；M6 未执行；M7 未启动；生产不批准。
