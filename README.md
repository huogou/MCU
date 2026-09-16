# MCU 观影导航（Monorepo）

漫威电影宇宙观影导航，定位「陪用户探索漫威宇宙的观影助手」。采用 **H5 获客 + 微信 / 抖音小程序长期使用** 三端闭环：H5 负责外部获客与首次体验，小程序负责长期使用与观影进度沉淀。

本仓库为单一 **Monorepo**，三端源码共库管理，便于跨端内容（尤其是数据）原子化更新。

## 仓库结构

```
MCU/                        （本仓库根）
├── wechat/                 # 微信小程序当前代码（AppID wx78f00e7f0a5948b7）
├── douyin/                 # 抖音小程序当前代码（AppID tt00eb76569e914af801）
├── h5/                     # H5 当前生产代码（已上线阿里云轻量，HTTPS）
├── shared/                 # 跨端单一数据源与同步工具
│   ├── data/               # 权威数据（module.exports 格式，与微信/抖音一致）
│   └── sync_data.sh        # 将 shared/data 同步到 wechat/data、douyin/data
├── workspace/              # 开发 / 部署 / 验证工具（含 verify_stats.js、deploy/、移动日志）
├── docs/                   # 当前有效项目文档
│   ├── 产品/               #   产品方案（含 V3.0论坛/）
│   ├── 技术/               #   部署/同步/交接说明（DESIGN.md 等）
│   ├── 版本/               #   CHANGELOG / 版本记录 / 设计文件索引
│   └── 同步/               #   三份 AI 同步文件 + 历史归档/
├── design/                 # 当前有效设计资料（H5/、小程序/、其他）
├── archive/                # 历史版本与废弃资料（V1/ V2.0/ V2.1/ V2.2/ 其他历史/）
├── release/                # 发布包（微信小程序-v1.2.0上传包）
├── MCU项目总览.md          # 项目总览（AI 协作版：架构/部署/治理/待办）
├── README.md
└── VERSION.md
```

> 非源码目录（`archive/`、`release/`、`design/`、`AI生成文件/`、原 `backup/`·`恢复资料/`、三份 AI 同步文件）仅本地保留，已被 `.gitignore` 排除，**不进本仓库**。

## 数据单一源（铁律）

- 微信与抖音数据格式一致（`module.exports`），以 **`shared/data/` 为唯一权威源**。
- 修改数据后运行 `bash shared/sync_data.sh`，自动同步到 `wechat/data/`、`douyin/data/`。**禁止在各端各改一套**。
- H5 数据为 `window.MCU_*` 全局格式（与小程序不同），由 H5 侧机械适配生成，**不在此脚本范围内**，需单独维护（见下方「H5 数据」说明）。

## 各端说明

| 端 | 目录 | 技术栈 | 部署 |
| --- | --- | --- | --- |
| 微信小程序 | `wechat/` | 微信原生小程序，纯本地存储 | 微信开发者工具「上传」→ 提审发布 |
| 抖音小程序 | `douyin/` | 抖音原生小程序，纯本地存储 | 抖音开发者工具「上传」→ 提审发布 |
| H5 | `h5/` | 纯静态多页，原生 JS/CSS，无框架无构建 | 阿里云轻量（Nginx 独立站点 + Let's Encrypt HTTPS） |

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
| H5 | 阿里云轻量（Nginx 独立站点）：`h5/` 上传至 `/www/wwwroot/mcu-h5/`，站点配置见 `workspace/deploy/mcuatlas.xyz.conf`（生产；含论坛 `/api/` 反代） |
| 微信 | 微信开发者工具「上传」→ `mp.weixin.qq.com` 提交审核 → 发布 |
| 抖音 | 抖音开发者工具「上传」→ 抖音开放平台提交审核 → 发布 |

### H5 访问地址

- **当前生产**：`https://mcuatlas.xyz/`（2026-09-16 起；漫威专属域名，已 ICP 备案）
- **已退役**：`mcu.yaokaixin.top`（2026-09-16 下线）、`mcu.yaoqiang.xin`（NXDOMAIN）
- **已下线**：CloudBase 静态托管（2026-09-08 清空）、Cloudflare Pages（2026-09-08 删除）

> H5 的浏览统计与用户反馈写入 CloudBase 环境 `mcu-d6gw0brqoa9521b58` 的 `feedback` 集合（跨端与微信小程序共用）。该环境目前**保留**，待小程序反馈迁移至自建后端后再下线。

### 当前进度（2026-09-10 · 三端全部在线）

| 端 | 版本 | 状态 |
|---|---|---|
| **微信小程序** | V1.2.1 | **已通过审核并正式上线**（2026-09-10） |
| **抖音小程序** | V1.3.0 | **已上线** |
| **H5** | — | 运行中：`https://mcuatlas.xyz/`（旧域 `mcu.yaokaixin.top` 已下线） |

- **微信 V1.2.1 审核**：曾因「涉及视频服务，属个人主体未开放类目」被驳回；申诉说明小程序无播放器、无视频资源、无外部视频跳转（代码不存在 `web-view` / `navigateToMiniProgram` / 任何视频链接），经复核判定为**误判**后通过上线。
- **图像资源**：三端 `visuals.js` CDN = `https://mcuatlas.xyz`（2026-09-16 切换；微信/抖音需重新发布后生效）。
- **下一步**：V1.3 三端升级进入设计阶段，设计 AI 交接资料见 [`给设计AI-项目交接说明.md`](./docs/技术/给设计AI-项目交接说明.md)。

> ⚠ 设计注意：本项目 H5 与小程序为**两套独立 Token**（H5 gold `#E9A93B` / 小程序 gold `#F2B233`），勿跨端套用。详见总览 §8。

## H5 数据说明

H5 的 `h5/data/*.js` 采用 `window.MCU_*` 全局变量格式，与小程序 `module.exports` 格式不同，属「机械适配」关系（去 window 前缀）。因此 `shared/data` 仅直接服务于微信 / 抖音；H5 数据需由适配脚本另行生成，未纳入 `sync_data.sh`，避免格式错配破坏 H5。

## 备份与恢复

- 本仓库为单一 Monorepo，重大修改前先提交版本。
- 历史版本与抢救资料已归入 `archive/`（原 `backup/`、`恢复资料/`），均不进版本库；版本记录 / 更新日志见 `docs/版本/`。
