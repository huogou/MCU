# 漫威电影宇宙导航（微信小程序）

MCU 观影导航微信小程序源码。产品定位：陪用户探索漫威宇宙的观影助手。

## 工程结构

- `pages/`：15 个页面（首页 / 路线 / 路线详情 / 电影详情 / 探索 / 全景 / 角色列表 / 角色详情 / 浏览 / 我的MCU / 反馈 / 分享 / 关于 / 协议 / 隐私）
- `data/`：静态数据单一可信源（电影 / 角色 / 关系 / 路线 / 系列等）
- `models/`：数据模型（mcuData / userState / recommend / pano / share / achievements）
- `utils/`：工具函数
- `assets/`：图标 / 头像 / 背景 / tabBar 图标等静态资源
- `app.js` `app.json` `app.wxss`：小程序入口与全局配置
- `project.config.json`：项目配置

## 本地预览

用微信开发者工具「导入项目」，目录选本仓库根目录即可。应用名「MCU观影导航」，首页 `pages/home/home`。

## 说明

- 本仓库为源码备份，不含云端密钥与运行态数据。
- `workspace/` 目录为开发期校验 / 预览脚本，不影响小程序构建。
