# M6-P0 冻结完整性核对

| 项 | 值 |
|---|---|
| 日期 | 2026-11-10 |
| 范围 | M1–M5 冻结代码 + `h5/tools/generate-sitemap.cjs` |
| 结论 | **9/9 关键冻结文件哈希与《最终冻结确认报告 V1.0》一致；本任务未修改冻结代码** |
| 测试 | `mcu-cms/ops/tests/freeze.test.cjs` PASS 9/9 |

## 核对结果

| 文件 | SHA-256 |
|---|---|
| `h5/tools/generate-sitemap.cjs` | `ae1678d981577dc3b401d15dad314e1abae3878ac00b73ad1ff3bbf6fd936846` |
| `mcu-cms/app/build/build.cjs` | `b61b28a4feee253d3447ad960c43acac459a5d8f364abc5b72b6416a5e530091` |
| `mcu-cms/app/build/link-check.cjs` | `5f9517f740d89af1cef743896bd68d89ee81536ff8b7815f606279ab6d39191b` |
| `mcu-cms/app/build/sitemap-xml.cjs` | `c8c4a7f98cd6d3d4e739b1d592d05bd55271ba5a1846b9e4b0ec7bc88cefb5bd` |
| `mcu-cms/app/publish/release.cjs` | `d14a81c8ffeef24e7ce7d33d1e830b9f44c26f0221fed9269ec3c8ba2d998ea9` |
| `mcu-cms/app/publish/spool-sim.cjs` | `310a8b1dc50c84ca18b8aa0cf5bc8a59be436c2ca6e30e7851dce780eab63319` |
| `mcu-cms/app/publish/backup.cjs` | `f78f4b3c9c4fe010d940d2080d6ac13d39562eb058e5cbaf6a617ed0925d0364` |
| `mcu-cms/app/repo/media.cjs` | `0daee823a7a7609c04b02a3dda76db349fa6f3758fddeda9501b74b770555ebe` |
| `mcu-cms/app/server.cjs` | `215ae6b9f0db95d863a285d635331f5172f525313532859847d11bce6f4ddbfe` |

## 边界

- 上述为冻结关键文件；未对全部 `app/` 文件逐字节比对。
- 本任务新增代码全部在 `mcu-cms/ops/`，未写入 `app/`、`tests/` 基线或 `h5/`。
- 全量基线测试：**14 套件 / 205 项 PASS**；端到端 I1–I6 全 true。
- 真实 Linux DAC/systemd 未验证。
