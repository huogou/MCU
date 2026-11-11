# M6 V1.4 文档自检结果

| 项 | 值 |
|---|---|
| 日期 | 2026-11-10 |
| 性质 | 文档自检；**未执行 M6、未连接服务器、未创建资源、未改代码** |
| 对象 | V1.4 主方案、修订摘要、问题清单、权限矩阵、G3 设计、三个 unit 草案 |
| 结论 | 文本一致性通过；实际权限/systemd/G3 行为均**未验证**；M6 仍不准入 |

---

## 1. 逐项结果

| # | 检查项 | 结果 | 证据/说明 |
|---|---|---|---|
| 1 | 专用组+setgid 权限矩阵与 unit 一致 | **PASS（文本）** | `incoming` `mcucms:mcucms-publish 2770`；`work` `root:root 0700`；`done`/`failed` `root:mcucms 0750`；请求文件 `0640`；helper `SupplementaryGroups=mcucms-publish`；CMS 只写 `incoming` |
| 2 | 三个 unit 正文完整 | **PASS（文本）** | `[Unit]/[Service]/[Install]` 齐全（helper 无 `[Install]`，按 `.path` 触发设计）；有效指令与 `mcu-cms/docs/systemd/*.draft` 逐行一致 |
| 3 | systemd 239 待验证项已标注 | **PASS（标注）** | 主方案 §3.6 与三个 `.draft` 头部均列出：空 `CapabilityBoundingSet`+组权限、`PrivateDevices`、`LogsDirectory`、父只读/子可写、`PathExistsGlob` 重触发 |
| 4 | G3 覆盖两处 `spawnSync` | **PASS（设计覆盖）** | `build.cjs` 约 431 行（base 回退）与 473 行（正式生成）；G3-8 要求两次日志，缺一失败 |
| 5 | G3 覆盖子进程继承 | **PASS（设计覆盖）** | 要求子进程日志出现 `guard_child_loaded`；G3-10 |
| 6 | G3 覆盖绕过场景 | **PASS（设计覆盖）** | 自定义 env 删除/替换 guard、`shell:true`、非白名单路径、哈希不符、直接入口检测；G3-2～G3-7 |
| 7 | G3 失败后零副作用 | **PASS（设计覆盖）** | 检查 `releases/CURRENT` 不变、无新 `releases/<seq>`、sitemap 未写；G3-9 |
| 8 | 主方案/摘要/问题清单/矩阵一致 | **PASS（修正后）** | 初检发现 2 处文本不一致，已修正；见 §2 |
| 9 | 实际权限/真实 unit/G3 行为 | **未验证** | 需 M6 沙箱 T4/T2；不得写成通过 |

---

## 2. 自检中发现并修正的文本问题

| ID | 位置 | 原问题 | 修正 |
|---|---|---|---|
| C-01 | V1.4 修订摘要第 2 行 | 写 `failed root 0700`，与主方案/矩阵 `root:mcucms 0750` 矛盾 | 改为 `root:mcucms 0750` |
| C-02 | V1.4 主方案日志权限表 | 写 `logs/*.log 0600`，但当前代码无文件日志、`UMask=0022` 不能保证 0600 | 改为“`logs` 0700 预留；当前走 journal”，不虚构文件模式 |

> 这两项是**文档修正**，不涉及代码、权限或测试结果变更。修正前的主方案/摘要哈希不再使用；当前哈希见 §4。

---

## 3. 仍然阻塞 M6 的事项

### 3.1 授权/资源

1. Owner 未授权沙箱用户/组、三个 unit、helper、spool、目录。
2. Owner 未对 `RELEASE-MANIFEST.json` 的具体 SHA-256 作书面批准；`signed_by/signed_at` 不算签字。
3. preflight、spawn guard、helper、release gate 尚未实现；C5 G2/G3/G4 无实物。

### 3.2 必须实测（未验证）

1. **T4**：真实 unit 下 `incoming 2770` + `SupplementaryGroups` + 空 capability 能否读 0640/rename；`work` 是否确实对 mcucms 不可访问。
2. **systemd 239**：空 `CapabilityBoundingSet`、`PrivateDevices`、`LogsDirectory`、`ReadWritePaths` 父只读/子可写、`PathExistsGlob` 重触发的实际行为。
3. **G3**：两处 `spawnSync` 实际拦截、子进程继承、自定义 env/shell 拒绝、失败后 release/CURRENT/sitemap 不变。
4. **T0**：固定 IPv4/IPv6 台账、默认拒绝、全接口/路由/监听、固定 IP 试探、tcpdump 证据。
5. **S1–S5 / T1–T10**：全部未执行；P1–P10 仅为预设标准。
6. **T2**：单轮 10 条上限后的剩余请求目前只能人工 `systemctl start` 兜底；timer 未创建。
7. **T6/T7**：真实停服、残留进程/文件占用检查、恢复中断、Linux `rename/fsync` 语义未验证。
8. **T4 前 `mcu-cms-publish.path` 必须 disabled**；启用顺序未实测。

### 3.3 生产部署（不属 M6 沙箱）

- C1 证书：记录 2026-12-14 到期，约 34–35 天 <60，且未联网复核。
- C3 生产 S0/S6、P7/P9、共存估算未执行；P3-Prod 1.5 仅保守估算。
- M7 生产备份/恢复演练未启动。
- Nginx `/article/`、证书、生产 unit/权限均未变更。

---

## 4. 自检对象哈希

| 文件 | 字节 | SHA-256 |
|---|---:|---|
| V1.4 主方案 | 71,047 | `fb250bdf5e94c7e33b2f443ad55e803819ca6d5203ea4758bd16b29c58bba663` |
| V1.4 修订摘要 | 2,258 | `c5467c4b23fe2ca4c69c3fe941b5538420ec62040d65a6fdba9eb0085ee74dc3` |
| V1.4 问题清单 | 2,900 | `b9c49e53977f39461bf28d1d7a30d041e91ac0ba9d48c2a9d015fbfe69913418` |
| helper/spool 权限矩阵 | 3,601 | `3c1c492b7ef8762f5c2882b70d5a309f6d5f8872f42865e6e09f30f1d694652b` |
| G3 调用链/负向测试 | 3,668 | `914b48e2d5b75fa776f253088d137f05e321e9effd8bc5b66ff46ee3b8c84bbf` |
| `mcu-cms.service.draft` | 2,122 | `9ed9dc30dc8e5b2b0bf03af1e645732bc655353082f0bafcc92688bd5e2bdeb3` |
| `mcu-cms-publish.service.draft` | 1,589 | `7b25978cca2f986905095a04fd17c6999228a29d94f60d61adf2f90430c63121` |
| `mcu-cms-publish.path.draft` | 489 | `4e88fbaca621a0da35dd33027093688e83eaa5e618e8feb7ca4a15152845acc1` |

> 本报告自身不列入自引用哈希。自检只做了文档比对；未运行全量测试，未改变 M1–M5 冻结代码。

---

## 5. 最终状态

- 文本一致性：**PASS（修正后）**。
- 实际权限/systemd/G3/HTTP/恢复：**未验证**。
- M6：**不准入**。
- M7：未启动。
- 生产部署：不批准。
- 方案完成 ≠ 执行授权；M6 通过 ≠ 生产部署批准。

等待 ChatGPT 复审与 Owner 独立书面授权。
