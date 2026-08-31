# MCU 观影导航（Monorepo）

漫威电影宇宙观影导航，定位「陪用户探索漫威宇宙的观影助手」。采用 **H5 获客 + 微信 / 抖音小程序长期使用** 三端闭环：H5 负责外部获客与首次体验，小程序负责长期使用与观影进度沉淀。

本仓库为单一 **Monorepo**，三端源码共库管理，便于跨端内容（尤其是数据）原子化更新。

## 仓库结构

```
MCU/                        （本仓库根）
├── wechat/                 # 微信小程序源码（已上线 V1.2，AppID wx78f00e7f0a5948b7）
├── douyin/                 # 抖音小程序源码（由微信工程迁移，AppID tt00eb76569e914af801）
├── h5/                     # H5 静态站源码（已上线 CloudBase 静态托管）
├── shared/                 # 跨端单一数据源与同步工具
│   ├── data/               # 权威数据（module.exports 格式，与微信/抖音一致）
│   └── sync_data.sh        # 将 shared/data 同步到 wechat/data、douyin/data
├── README.md
├── VERSION.md
└── verify_stats.js         # H5 运营数据统计验证脚本
```

> 非源码目录（`AI生成文件/`、`backup/`、`恢复资料/`、`wechat-v1.2.0-upload/`、三份 AI 同步文件）仅本地保留，已被 `.gitignore` 排除，**不进本仓库**。

## 数据单一源（铁律）

- 微信与抖音数据格式一致（`module.exports`），以 **`shared/data/` 为唯一权威源**。
- 修改数据后运行 `bash shared/sync_data.sh`，自动同步到 `wechat/data/`、`douyin/data/`。**禁止在各端各改一套**。
- H5 数据为 `window.MCU_*` 全局格式（与小程序不同），由 H5 侧机械适配生成，**不在此脚本范围内**，需单独维护（见下方「H5 数据」说明）。

## 各端说明

| 端 | 目录 | 技术栈 | 部署 |
| --- | --- | --- | --- |
| 微信小程序 | `wechat/` | 微信原生小程序，纯本地存储 | 微信开发者工具「上传」→ 提审发布 |
| 抖音小程序 | `douyin/` | 抖音原生小程序，纯本地存储 | 抖音开发者工具「上传」→ 提审发布 |
| H5 | `h5/` | 纯静态多页，原生 JS/CSS，无框架无构建 | CloudBase 静态托管 |

数据量（单一可信源，禁止第二套）：CONTENT 59 / RELATIONS 92 / ROUTES 11 / CHARACTERS 24 / CAMPS 8 / PANO 40-41-6。

## 本地运行

### 微信小程序
微信开发者工具导入 `wechat/` 目录，AppID `wx78f00e7f0a5948b7`，编译即可在模拟器查看。

### 抖音小程序
抖音开发者工具导入 `douyin/` 目录，AppID `tt00eb76569e914af801`。

### H5
```bash
cd h5
python -m http.server 8080        # 或 npx serve / 任意静态服务器
# 访问 http://localhost:8080/index.html
```

### 自动化校验（Node 22+，需 sharp）
```bash
cd wechat
node workspace-smoke-v11-full.js     # 三场景流程 42 断言
node workspace-smoke-v11-device.js   # 分享/全景设备流程 16 断言
node workspace-check-data-v11.js     # 数据一致性 35 断言
```

## 部署方式

| 端 | 方式 |
| --- | --- |
| H5 | CloudBase 静态托管（环境 `mcu-d6gw0brqoa9521b58`）：将 `h5/` 上传至该环境，域名 `mcu-d6gw0brqoa9521b58-1307093647.tcloudbaseapp.com` |
| 微信 | 微信开发者工具「上传」→ `mp.weixin.qq.com` 提交审核 → 发布 |
| 抖音 | 抖音开发者工具「上传」→ 抖音开放平台提交审核 → 发布 |

## H5 数据说明

H5 的 `h5/data/*.js` 采用 `window.MCU_*` 全局变量格式，与小程序 `module.exports` 格式不同，属「机械适配」关系（去 window 前缀）。因此 `shared/data` 仅直接服务于微信 / 抖音；H5 数据需由适配脚本另行生成，未纳入 `sync_data.sh`，避免格式错配破坏 H5。

## 备份与恢复

- 本仓库为单一 Monorepo，重大修改前先提交版本。
- 本地另有 `backup/`（版本记录 / 更新日志）与 `恢复资料/`（抢救资料），均不进版本库。
