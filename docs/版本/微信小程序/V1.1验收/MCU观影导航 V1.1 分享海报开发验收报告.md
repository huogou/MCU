# MCU观影导航 V1.1 分享海报开发验收报告

- 版本：V1.1 Step4 v1.0
- 日期：2026-08-24
- 维护方：开发/设计 AI（WorkBuddy）
- 依据：V1.1 Step4 分享海报开发指令 + V1.1 数据模型确认报告
- 范围：分享功能（share 页面 + 三类型海报模板 + shareData 数据模型），未开发成就/角色主页

---

## 1. 修改文件（2 个）

| 文件 | 变更 |
|---|---|
| `mcu-miniprogram/app.json` | pages 数组新增 `pages/share/share`（9 → 10 页） |
| `mcu-miniprogram/pages/my-mcu/my-mcu.js` | `goEntry` 分享分支由 toast 占位（Step3）替换为 `wx.navigateTo('/pages/share/share?type=progress')`（Step4 接入真实跳转）；成就分支保持 toast 待 Step5 |

## 2. 新增文件（6 个）

| 文件 | 用途 |
|---|---|
| `mcu-miniprogram/models/shareData.js` | shareData 数据模型（三类型模板元数据 + 独立键 mcu_nav_share_v1 记录读写） |
| `mcu-miniprogram/pages/share/share.json` | 分享页 navigationBar 配置 |
| `mcu-miniprogram/pages/share/share.wxml` | 海报画布（canvas type="2d"）+ 操作区（保存相册 / 转发） |
| `mcu-miniprogram/pages/share/share.wxss` | 全 Token 化样式（深色 Token + 金按钮） |
| `mcu-miniprogram/pages/share/share.js` | 三类型数据装配 + canvas 2d 绘制 + 保存相册（授权处理）+ 转发 + 分享记录 |
| `mcu-miniprogram/assets/icons/tab/_share-poster-{progress,route,movie}.png` | 三类型海报模板预览（SVG→sharp 渲染，模拟布局） |

## 3. 海报模板截图

**类型1 · progress（观影进度）** — _share-poster-progress.png
- 品牌栏（MCU 宇宙导航 + 金色装饰线）
- 标题「我的 MCU 旅程」+ 副标「已完成」
- 大数字 18 / 59（count 金色大号 108px，/ 59 灰色 44px）
- 阶段 pill「Phase 3 · 无限传奇」（金色边框 + 12% 底）
- 当前路线 + 路线名 + 金色进度条
- 底部码占位 + slogan「分享我的 MCU 进度」

**类型2 · route（路线分享）** — _share-poster-route.png
- 品牌栏 + 「我在走这条路线」
- 路线名（46px bold） + tagline（金色 24px）
- 「已看 N / M 部」+ 金进度条
- 路线描述卡（surface-1 圆角 + 描述文字）
- 码占位 + slogan「来一起走这条 MCU 路线」

**类型3 · movie（电影分享）** — _share-poster-movie.png
- 品牌栏 + 电影 cn/en
- 左侧阶段色海报块（180×270 + 首字）
- 右侧 Phase N + 简介（role 多行换行）
- 「在 MCU 中的位置」+ 前后关联「前：《X》→ 后：《Y》」或上映序位置
- 码占位 + slogan「我在看 MCU，一起吗」

> 预览图为布局示意（SVG 单行 text）；真实 canvas 使用 `wrapText` 多行换行。

## 4. 数据结构说明

### 4.1 shareData 模型（`models/shareData.js`）

- **模板元数据** `TEMPLATES`：三类型常量定义（type/label/title/slogan/desc）
- **画布常量** `CANVAS = { width: 750, height: 1100 }`
- **品牌常量** `BRAND = 'MCU 宇宙导航'` + `SLOGAN` 三类型
- **接口**：
  - `template(type)`：取模板元数据
  - `record(type)`：分享成功 +1（total/byType/history）
  - `getStats()`：读统计（成就 sharer-1 判定用 total）

### 4.2 独立键 `mcu_nav_share_v1`

```json
{
  "total": 4,
  "byType": { "progress": 2, "route": 1, "movie": 1 },
  "history": [{ "type": "progress", "at": 1724476800000 }, ...]
}
```

- `history` 保留最近 50 条（自动裁剪，防止膨胀）
- **不并入** `mcu_nav_user_v1`（V1.0 用户态零改动，兼容 100%）
- H5 不读取该键（纯小程序侧，纯数据独立）

### 4.3 铁律验证

- `data/*` 全部零修改（CONTENT/ROUTES/RELATIONS/CHARACTERS/PANO）
- `userState.js` 零修改（V1.0 兼容）
- `mcuData.js` 只读引用（count/total/phase/routeById/expandRoute/panoNeighbors）
- H5 `mcu-navigator/` 零改动

## 5. 测试结果（5 用例 33/33 通过）

| 用例 | 验证项 | 结果 |
|---|---|---|
| A1 模板元数据 | progress/route/movie 标题正确 + 非法类型 null + 画布 750×1100 | ✓ |
| A2 分享记录 | total/byType 累计正确 + history 自动裁剪至 50 | ✓ |
| B1 progress 新用户 | 0/59 + Phase 1 + 默认路线 | ✓ |
| B2 progress 老用户（3 部） | 3/59 + Phase 1（avengers phase1，含 saga 后缀）+ 新手入坑 | ✓ |
| B3 route 不同路线 | 复仇者联盟路线 11 部 + 已看 3（iron-man/thor/avengers）+ 27% 进度 | ✓ |
| B4 movie endgame | cn/en/Phase 3/role/前后关联 | ✓ |
| B5 draw 三类型 | progress/route/movie canvas 绘制均不抛错 | ✓ |
| C1 我的MCU 分享入口 | goEntry key=share → share?type=progress | ✓ |

附加验证：
- 全工程 29 个 JS 语法无回归
- share.wxss 零 raw hex / wxml 零内联 svg / 零 emoji 零第三方图标
- 临时脚本/SVG 已清理

## 6. 技术实现

### 6.1 Canvas 2D 绘制
- canvas type="2d"，id="posterCanvas"
- 逻辑尺寸 750×1100，绘制时按 dpr 缩放（canvas.width = 750*dpr）
- 颜色为 Token 权威值直写（canvas 无法读 CSS 变量，技术必要）
- `wrapText()` 通用换行（按 maxWidth 测宽 + maxLines 截断加省略号）
- 三类型分支：`drawProgress` / `drawRoute` / `drawMovie`

### 6.2 保存相册
```
canvasToTempFilePath → saveImageToPhotosAlbum
├ 成功：shareData.record(type) + toast「已保存到相册」
└ 失败 auth/deny：showModal 引导「去设置」+ openSetting
```

### 6.3 转发
- `onShareAppMessage` 返回 `{ title, path: '/pages/share/share?type=&id=' }`
- 触发即 `shareData.record(type)`（微信惯例：转发按钮即记录）

### 6.4 入口接入
- 我的MCU 分享入口（goEntry key=share）→ `navigateTo share?type=progress`（Step3 占位 → Step4 真实跳转）
- 成就入口保持 toast「成就系统 Step5 上线」（待 Step5 接入）
- route/movie 类型入口：share 页支持参数驱动（`share?type=route&id=` / `share?type=movie&id=`），可在路线详情页/电影详情页加按钮（**留待后续集成**，本步范围仅做 share 页+数据模型+我的MCU入口）

## 7. 已知问题 / 待后续

1. **route/movie 类型入口未集成到路线详情/电影详情页**（范围控制：仅做 share 页+数据模型+我的MCU入口）。可在 Step5/6 或后续小迭代加入口按钮。
2. **小程序码占位为 surface-3 方块**（无真实码）：正式上线需生成小程序码（按渠道 + scene 参数，与 H5→小程序转化归因一致，V1.1 留待「动态小程序码 scene」排期）。
3. **微信分享卡片图**：当前使用小程序默认缩略图（onShareAppMessage 未设置 imageUrl），待小程序码接入后可用海报图作为 imageUrl。
4. **小红书截图适配**：海报 750×1100 约 5:7.3，小红书 3:4 严格略裁。**指令六设计要求"保持深色宇宙风、不花哨"已满足**；尺寸可选调至 750×1000（严格 3:4）——数据模型确认报告待拍板项「海报尺寸 750×1100 vs 750×1000」需策划确认。
5. **真机截图未补**：环境无 GUI，SVG→sharp 模拟预览；真机 canvas 渲染效果待 Step7 真机测试。
6. **昵称字段**（指令三类型1「用户昵称（如有）」）：当前无账号体系，海报标题用「我的 MCU 旅程」占位，不展示昵称。若需昵称可后续接入微信 userInfo 授权（个人主体小程序需注意合规）。

## 8. 交付物

- 代码：share.js / share.wxml / share.wxss / share.json + shareData.js + app.json + my-mcu.js（2 改 + 6 增）
- 预览：_share-poster-{progress,route,movie}.png（3 张布局示意）
- 本报告：AI生成文件/MCU观影导航 V1.1 分享海报开发验收报告.md

---

*Step4 完成后暂停，等待下一阶段指令（开发启动指令第九节：第五步 成就系统开发）。*
