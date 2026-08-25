# MCU 观影导航

MCU 观影导航是一个帮助用户解决「漫威电影宇宙怎么看」的轻量工具，采用**双端闭环**架构：H5 负责外部获客与首次体验，微信小程序负责长期使用与观影进度沉淀。

## 项目介绍

- **核心用户路径**：顺序 → 路线 → 下一部 → 关系 → 地图 → 进度
- **核心能力**：观影顺序与路线推荐、电影关系图谱、宇宙全景时间线、观影进度管理、分享海报、成就系统、角色图鉴
- **双端关系**：H5 与小程序不是替代关系，而是「传播 → 体验 → 长期使用」闭环

| 端 | 定位 | 状态 |
| --- | --- | --- |
| H5（`mcu-navigator/`） | 外部获客 / 首体验 | 已上线（CloudBase 静态托管） |
| 微信小程序（`mcu-miniprogram/`） | 长期使用 / 进度沉淀 | V1.1 上线前基线（真机验证通过） |

## 技术架构

| 项 | 说明 |
| --- | --- |
| H5 | 纯静态多页（index / map / movie / next / routes），原生 JS + CSS，无框架、无构建 |
| 小程序 | 微信原生小程序（style v2），纯本地存储（`wx.storage` 键 `mcu_nav_user_v1`），无云函数、无外部 API |
| 数据层 | 静态 JS 单一可信源：H5 `data/*.js`（`window.MCU_*`），小程序 `data/*.js`（`module.exports`，由 H5 机械适配去 window 前缀） |
| 云端 | 腾讯云 CloudBase（环境 `mcu-d6gw0brqoa9521b58`）：H5 静态托管 + NoSQL（stats / feedback 集合） |
| 视觉 | 设计 Token 体系：深色宇宙科技风，全局 CSS 变量（H5 `style.css` / 小程序 `app.wxss`），阶段色权威值统一 |

**数据量**（单一可信源，禁止第二套）：CONTENT 59 / RELATIONS 92 / ROUTES 11 / CHARACTERS 24 / CAMPS 8 / PANO 40-41-6

## 文件结构

```
MCU观影导航/
├── mcu-navigator/           # H5 源码（与线上同源）
│   ├── index.html / map.html / movie.html / next.html / routes.html
│   ├── assets/              # css / js / 海报剧照
│   └── data/                # 单一数据可信源（*.js）
├── mcu-miniprogram/         # 小程序源码
│   ├── app.js / app.json / app.wxss / sitemap.json / project.config.json
│   ├── pages/               # 12 页面（home/routes/route-detail/movie/explore/
│   │                        #   panorama/browse/my-mcu/characters/character/share/feedback）
│   ├── data/                # 数据层（与 H5 同源，机械适配）
│   ├── models/              # mcuData / userState / recommend / pano / shareData / achievements
│   ├── assets/              # TabBar 图标等资源
│   └── workspace-*.js       # 验收/渲染/一致性校验脚本（可复跑）
├── AI生成文件/              # 项目文档与报告（按 H5/小程序/跨端/旧版文件 分类）
├── 恢复资料/                # 从系统 Temp 抢救回的第一手资料
├── backup/                  # 备份目录（版本记录 / 更新日志 / 设计文件索引）
├── 给策划AI同步文件.txt     # 开发 AI → 策划 AI 同步文件（唯一活跃）
├── verify_stats.js          # H5 运营数据统计验证脚本
├── README.md                # 本文件
└── .gitignore
```

## 本地运行方式

### H5
静态站点，任选其一：
```bash
cd mcu-navigator
python -m http.server 8080        # 或 npx serve / 任意静态服务器
# 访问 http://localhost:8080/index.html
```

### 小程序
1. 微信开发者工具（服务端口需在「设置 → 安全设置」开启）
2. 导入项目目录 `mcu-miniprogram/`，AppID `wx78f00e7f0a5948b7`
3. 编译即可在模拟器查看；「预览」生成真机二维码扫码真机测试

### 自动化校验（Node 22+，需 sharp）
```bash
cd mcu-miniprogram
node workspace-smoke-v11-full.js     # 三场景流程 42 断言
node workspace-smoke-v11-device.js   # 分享/全景设备流程 16 断言
node workspace-check-data-v11.js     # 数据一致性 35 断言
```

## 部署方式

| 端 | 方式 |
| --- | --- |
| H5 | CloudBase 静态托管（`mcu-navigator/` 上传至环境 `mcu-d6gw0brqoa9521b58`，域名 `mcu-d6gw0brqoa9521b58-1307093647.tcloudbaseapp.com`） |
| 小程序 | 微信开发者工具「上传」→ `mp.weixin.qq.com` 提交审核 → 发布 |

## 当前版本

| 项 | 值 |
| --- | --- |
| 版本 | **V1.1**（待发布 · 发布确认报告已生成） |
| 功能 | 首页继续观看 / 我的MCU 2.0 / 分享海报 / 成就系统 / 角色主页 / D12 视觉统一 |
| 真机测试 | Step7 13/13 通过 |
| 数据一致性 | H5↔小程序 JSON 级一致（35/35） |
| 上传版本号 | `v1.1.0`（用户于微信开发者工具手动上传提审） |
| 发布确认 | 《V1.1最终发布确认报告》见 `AI生成文件/跨端/V1.1最终发布确认报告.md` |
| 提交规范 | 每完成一个开发阶段提交一次，格式 `DXX-阶段名称`（见 `backup/CHANGELOG.md`） |

## 备份与恢复

- Git 仓库：本仓库（`MCU观影导航/`），远程托管见 `backup/版本记录.md`
- 版本提交格式：`DXX-阶段名称`（例：`D12-首页完成`）
- 重大修改前必须先提交版本
- 恢复流程见 `backup/版本记录.md`「恢复流程」
