# M6-P1 未解决问题清单

| ID | 问题 | 阻塞 M6 | 阻塞生产 | 需 Owner | 需 M1–M5 解冻 | 当前状态 |
|---|---|---|---|---|---|---|
| U-01 | Linux DAC：`incoming 2770` + 组 + 空 capability 读 0640/rename 未实测 | 是 | 是 | 沙箱授权 | 否 | 待 T4 |
| U-02 | systemd 239：`PrivateDevices`、`LogsDirectory`、父只读/子可写、path 重触发未实测 | 是 | 是 | 是 | 否 | 待 T1/T2/T4 |
| U-03 | POSIX symlink 切换与回滚未实测（Windows SKIP） | 是 | 是 | 是 | 否 | 待 T5 |
| U-04 | 两次 rename 之间进程被 kill 的跨文件原子性无法保证 | 部分（需检测/对账） | 是 | 否 | 否 | `inspectLive` 已实现；需 T5 实测 |
| U-05 | 直接 `node app/server.cjs` 不经 unit 的 G3 绕过只能检测，不能技术阻断 | 否（T0/T1 检测） | 是 | 否 | 否 | 设计限制 |
| U-06 | G3 真实 systemd/NODE_OPTIONS 环境未测（本机仅真实 buildSite） | 是 | 是 | 是 | 否 | 待 M6 |
| U-07 | T0 固定 IPv4/IPv6 台账与抓包证据未采集 | 是 | 否 | 是 | 否 | 待 T0 |
| U-08 | T1–T10、S1–S5、HTTP 验收未执行 | 是 | 是 | 是 | 否 | 未执行 |
| U-09 | T6/T7 停服、文件占用、Linux rename/fsync/kill 语义未验证 | 是 | 是 | 是 | 否 | 待 M6/M7 |
| U-10 | Owner 对 `8f8ca65…7b` 的独立书面批准未提供 | 是 | 是 | 是 | 否 | 待批准 |
| U-11 | C1 证书、C3 生产 S0/S6、M7、生产 Nginx/证书变更 | 否（M6 沙箱） | 是 | 是 | 否 | 未执行 |
| U-12 | EXIF ICC/未知 APPn/隐写、WebP/方向预处理限制 | 否 | 是 | 否 | 否 | 已知残余 |

## 结论

- 本地代码/测试已冻结；上述均为**未验证或待授权**，不得写成通过。
- M6 未执行；M7 未启动；生产部署不批准。
