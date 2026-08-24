# MCU观影导航 V1.1 UI/UX设计方案（定稿版）

- 版本：V1.1 设计稿 v1.0（定稿）
- 日期：2026-08-24
- 维护方：开发/设计 AI（WorkBuddy，已合并双岗）
- 接收方：策划 AI（deepseek）→ 用户（最终确认）
- 依据：V1.1 开发阶段启动指令（P0 必做 / P1 成就系统 / P1.5 角色主页）+ 上一版设计方案 v0.1
- 状态：**设计阶段交付，提交后暂停，等待策划确认后进入开发（指令十二）**

---

## 一、现状勘察与数据核对（指令七：开发前必须检查当前数据）

### 1.1 数据结构现状（实测）

| 数据 | 现状 | V1.1 处理 |
|---|---|---|
| CONTENT 59 | data/content.js（单一源） | **零修改（铁律）** |
| ROUTES 11 | data/routes.js（basic5+topic6） | **零修改（铁律）** |
| RELATIONS 92 | data/relations.js | **零修改（铁律）** |
| CHARACTERS 24 / CAMPS 8 | data/characters.js | **零修改**（角色主页只读引用） |
| PANO 40-41-6 | models/pano.js | **零修改** |
| 用户进度 | models/userState.js，键 `mcu_nav_user_v1` | 复用 + 新增成就记录字段 |
| 里程碑提示 | milestones_shown（5/10/20 部） | 升级为成就体系 |
| 分享数据 | 无 | **新增**独立键 `mcu_nav_share_v1` |

### 1.2 指令示例 ↔ 真实数据映射（重要：示例为示意文案，实现以数据为准，禁第二套）

| 指令示例 | 真实数据 | 说明 |
|---|---|---|
| 「无限传奇路线」 | **不存在此路线**。ROUTES 实际 11 条：新手入坑/上映顺序/MCU时间线/精简主线/推荐完整/蜘蛛侠/复仇者联盟/钢铁侠/美国队长/多元宇宙/无限宝石 | 首页「当前路线」显示 userState.current_route 对应路线名（默认「新手入坑」），**不新增"无限传奇路线"** |
| 「下一站：复仇者联盟4」 | CONTENT 中 id=`endgame`，cn=**「复仇者联盟4：终局之战」**（ro=27, phase 3, saga infinity, core） | 下一站 = recommend.next() 真实推荐结果，仅当 endgame 真被推荐时显示 |
| 我的MCU「23 / 59」 | 进度 = userState.count() / CONTENT 全量 59 | 数字为示意，实际动态计算 |
| 我的MCU「当前阶段：无限传奇」 | 阶段 = watched 最新上映作品的 saga（infinity/multiverse）推导 | 无 saga 字段则显示「第 X 阶段」 |
| 成就「初入漫威」 | 已看 1 部 | 建议口径 |
| 成就「完成第一阶段」 | phase1 core 实测 4 部：iron-man / thor / captain-america-first-avenger / avengers | 建议口径：phase1 core 全看 |
| 成就「无限传奇探索者」 | saga=infinity 实测 23 部 | 建议口径：已看 ≥10 部 infinity 内容 |
| 成就「完成无限传奇」 | saga 分布：infinity 23 / multiverse 19 / none 17 | 建议口径：infinity 23 部全看 |
| 角色主页「钢铁侠 关联作品 10 部」 | filmsOfChar('tony') **实测 9 部** | 以实测 9 部为准 |
| 角色主页「关联角色：蜘蛛侠、美国队长」 | 共同出场 Top：黑寡妇(5)、**美国队长(5)**、雷神(4)、弗瑞(3)…蜘蛛侠不在 Top | 以「共同出场次数降序」推导为准 |
| 角色主页「人物路线：查看」 | 关联 topic 路线实测：钢铁侠路线 ironman-line（9 部） | 以角色 first 或共现作品归属路线推导 |

### 1.3 关键统计数字（供成就/海报判定）

- 阶段分布：phase1=10 / phase2=7 / phase3=11 / phase4=17 / phase5=11 / phase6=3（合计 59）
- 阶段 core：phase1=4 / phase2=3 / phase3=7 / phase4=5 / phase5=1 / phase6=2
- saga 分布：infinity=23 / multiverse=19 / none=17
- 钢铁侠关联作品 9 部；共同出场最高 黑寡妇/美队 各 5 次

---

## 二、数据结构调整方案（指令三/七：新增用模型或字段，禁改 data/）

### 2.1 新增模型（2 个）

**① models/achievements.js（成就系统 · P1）**
- 成就定义表（只读常量）：id / 名称 / 描述 / 图标键 / 判定函数（基于现有数据计算）
- 判定数据来源：`userState.watched`（结合 CONTENT 的 phase/saga/importance 属性）、`saved_routes`、`favorite`、`shareStats`
- 解锁记录：读写 `mcu_nav_user_v1.gained_achievements: [{id, at}]`（新字段，向后兼容，H5 忽略未知字段）
- 去重：沿用 milestones_shown 机制（已弹不重复弹）

**② models/shareStats.js（分享数据）**
- 独立键 `mcu_nav_share_v1`：`{ total, byType: { progress, route, movie }, history: [{type, at}] }`
- 接口：record(type) / getStats()
- 独立键理由：高频写、纯小程序侧行为数据，与用户档案分离；指令四已确认**不在界面展示**（仅后台统计用）

### 2.2 修改模型（1 个）

**models/userState.js**：仅新增 `gained_achievements` 字段的读写接口（getAchievements/addAchievement），**不改动任何既有字段语义**。

### 2.3 零改动（铁律）

- `data/` 全部（CONTENT/ROUTES/RELATIONS/CHARACTERS/PANO/CAMPS）
- H5 `mcu-navigator/`（指令六：H5 负责获客、小程序负责留存，**暂不改动 H5**）

---

## 三、首页新版设计（P0-1：继续观看增强）

### 3.1 目标

用户打开首页 **3 秒内知道下一步看什么**（交互要求）。

### 3.2 老用户态（信息层级与布局）

```
① 旅程状态条（新增，顶部）
   当前路线名 · 第X阶段 · 进度 X/59
② 进度环（保留）—— 已看 N/59
③ 成就进度条（新增）—— 「距成就『XX』还差 N 部」→ 点按跳我的MCU成就墙
④ 下一站双卡（升级继续观看卡）
   左卡「上次看到」：最近观看作品
   右卡「下一站」：recommend.next 推荐作品 + 推荐理由 →「继续观看」
⑤ 快捷入口（保留）
⑥ 最近看过横滑（保留）
```

### 3.3 新用户态（首次打开，3 秒价值立现）

- 品牌引导（保留）+ **3 步微引导条**（新增）：「① 选路线 → ② 按序看 → ③ 标记已看」
- 热门起点 / 功能入口 / 从《钢铁侠》开始 CTA（保留，CTA 副标题补「进度自动记录」）

### 3.4 数据口径

| 元素 | 来源 |
|---|---|
| 当前路线名 | userState.current_route → ROUTES.name（默认「新手入坑」） |
| 第 X 阶段 | watched 最新上映作品的 phase 推导（无观看则新用户态） |
| 进度 X/59 | userState.count() / mcuData.counts().movie? 或 CONTENT 全量（与我的MCU同口径，见待确认） |
| 下一站 | recommend.next(latest.id, 'mainline')（与 V1.0 同口径） |
| 成就进度 | achievements.nextPending()：下一个未解锁成就 + 差 N 部 |

---

## 四、我的 MCU 2.0（P0-2：个人漫威档案）

### 4.1 定位升级

从「记录工具」→「用户个人漫威档案」。

### 4.2 页面结构

```
① 顶部档案区（保留+强化）
   我的 MCU 观影进度：已完成 X / 59（动态计算，示例 23/59 为示意）
   当前阶段：saga 推导（无限传奇/多元宇宙）+ 整体进度条
   副文案：「一起探索漫威宇宙」
② 分享主入口（新增，金色胶囊大按钮）
   「分享我的 MCU 进度」→ share?type=progress
③ 成就墙（新增，横滑徽章条）
   已解锁彩色 / 未解锁灰阶占位（点按提示解锁条件）→ 成就系统 P1
④ 当前路线卡（保留）
⑤ 已看列表（保留）
⑥ 收藏区（保留）
⑦ 反馈入口（保留）
```

### 4.3 数据口径

| 元素 | 来源 |
|---|---|
| 已完成 X/59 | userState.count() / mcuData.all.length（CONTENT 59） |
| 当前阶段 | watched 最新上映作品 saga/phase 推导 |
| 成就墙 | achievements.js 判定 + gained_achievements |
| 分享入口 | shareStats.record('progress') 埋点 |

---

## 五、分享海报设计（P0-3：canvas 生成）

### 5.1 三类型模板

**类型1 · progress 进度分享（主场景）**
- 内容：品牌栏 → 大进度环「我已看完 X / 59 部」→ 阶段徽章（第X阶段·传奇名）→ 当前路线进度条 → 下一部推荐卡 → slogan
- 入口：我的MCU 主按钮 / 成就弹窗「分享」

**类型2 · route 路线分享**
- 内容：品牌栏 → 路线名+tagline → 路线进度「已看 N / M」→ 当前节点 → 路线描述节选 → slogan
- 入口：路线详情页「分享这条路线」

**类型3 · movie 电影分享**
- 内容：品牌栏 → 单部电影（片名/英文名/阶段徽章）→ 我的观看状态（已看/想看/未看）→ 前后关联（上一部/下一部）→ slogan
- 入口：电影详情页「分享这部」

### 5.2 尺寸与渠道适配

| 渠道 | 要求 | 方案 |
|---|---|---|
| 微信分享/社群 | 竖版 5:7 以上 | **750×1100**（接近 3:4，微信/朋友圈/社群通用） |
| 小红书截图 | 竖版 3:4 最佳 | 750×1100 可整图保存直发；如确认需严格 3:4 可调 750×1000（待拍板） |
| 通用 | 文字清晰、品牌露出 | 顶部品牌栏 + 底部 slogan + 小程序码占位 |

### 5.3 生成方式

- 独立页面 `pages/share/share?type=&id=`：onReady 后 **canvas 2d 绘制**（与首页进度环同技术方案）→ 预览 → [保存相册] [转发给朋友]
- 保存相册：saveImageToPhotosAlbum，需 scope.writePhotosAlbum 授权（拒绝引导设置页开启）
- 转发：onShareAppMessage 带 type/id 参数（路径穿透）
- 每次成功保存/转发 → shareStats.record(type)（后台统计，不展示，指令四）

---

## 六、成就系统（P1：观影纪念，轻量）

### 6.1 定位

**不是游戏**：无等级 / 无 XP / 无排行榜 / 无竞争机制。定位为「**观影纪念**」——记录用户走过的漫威旅程，弱激励、零打扰。

### 6.2 成就清单（建议口径，待策划拍板）

| id | 名称 | 解锁条件（建议） | 维度 |
|---|---|---|---|
| first-step | 初入漫威 | 已看 1 部 | 里程 |
| journey-5 | 旅程开始 | 已看 5 部（沿用现有里程碑） | 里程 |
| journey-10 | 一段旅程 | 已看 10 部（沿用现有里程碑） | 里程 |
| journey-20 | 走得很远 | 已看 20 部（沿用现有里程碑） | 里程 |
| phase-1-done | 完成第一阶段 | phase1 core 4 部全看（iron-man/thor/captain-america-first-avenger/avengers） | 阶段 |
| infinity-explorer | 无限传奇探索者 | 已看 ≥10 部 saga=infinity 内容 | 阶段 |
| infinity-done | 完成无限传奇 | saga=infinity 23 部全看 | 阶段 |
| newcomer-done | 入坑完成 | 新手入坑路线 12/12 | 路线 |
| collector-5 | 收藏家 | 收藏 5 部 | 探索 |
| sharer-1 | 分享新人 | 首次分享成功 | 分享 |

- 示例成就 4 个（初入漫威/完成第一阶段/无限传奇探索者/完成无限传奇）全部保留，与指令示例一一对应。
- 判定全部基于现有字段推导，**零新增数据字段**。

### 6.3 触发与展示

- 标记已看后调用 checkAchievement() → 命中解锁 → **半屏成就弹窗**（金徽章 + 成就名 + 描述 + 「分享我的进度」[主] /「继续旅程」[次]）
- 去重：gained_achievements 记录 + milestones_shown 控制（同一成就只弹一次）
- 展示位：我的MCU 成就墙 + 首页成就进度条 + 弹窗

---

## 七、角色主页（P1.5：角色探索增强）

### 7.1 定位

- 探索体验增强：从探索页角色卡点击进入 `pages/character/character?id=`
- **不是核心观看入口**：不影响路线观看流程（路线→电影路径零改动）

### 7.2 信息结构

```
① 顶部：角色名（中英）+ 阵营徽章（CAMPS 8 色）+ 首次出现作品（first）
② 简介：characters.note
③ 关联作品：filmsOfChar 按上映序 + 三态（已看/想看/未看，可标记）→ 显示「关联作品 N 部」（实测推导）
④ 关联角色：「共同出场」共现次数降序 Top N（点击跳转对应角色主页）
⑤ 人物路线：与角色关联的 topic 路线（如钢铁侠→ironman-line「钢铁侠路线」）→「查看」跳路线详情
```

### 7.3 数据来源（全部只读推导，零新增数据）

- characters.js（note/first/camp）+ mcuData.filmsOfChar + CONTENT.chars 共现推导 + ROUTES 关联匹配

---

## 八、完整交互流程

```
新用户：首页(新态) → 3步微引导 → 热门起点/CTA → 电影详情 → 标记已看(第1部)
      → 返回首页(切老用户态) → 成就弹窗「初入漫威」→ 分享/继续

续看：  首页(老态) → 下一站双卡 → 电影详情 → 标记已看 → 成就检测(解锁→弹窗)
      → 分享 → share页 → 保存/转发 → 返回

分享：  我的MCU主按钮 / 成就弹窗 / 路线详情 / 电影详情 → share页(canvas海报)
      → 保存相册 / 转发 → shareStats.record

探索：  探索页角色卡 → 角色主页 → 关联作品标记 / 关联角色跳转 / 人物路线查看
```

---

## 九、与 V1.0 视觉统一方案

- 全 Token 复用（bg #0B0E14 / surface-1/2/3 / gold #E9A93B / p1-p6 / 文本三级 / success/error），**零新增配色**
- 新增视觉规范：
  - 成就徽章：圆形 120rpx，金描边 + 阶段色底 + 白色线描图标（复用 Step3-3 TabBar sharp 渲染管线）
  - 分享主按钮：复用 `.mcu-btn-gold` 金色胶囊规范
  - 分享海报：图片产物，允许 Token hex 直写，构图与站内一致
- 页面纪律：全 Token 化（零 raw hex）/ wxml 零内联 svg / 零 emoji / 零第三方图标库（canvas 2d 绘制为技术必要）

---

## 十、执行顺序与变更清单（指令二/九）

**执行顺序**：数据结构确认 → UI 页面实现 → 功能开发 → 真机测试 → 修复 → 提交验收报告

### 10.1 新增文件

| 文件 | 归属 |
|---|---|
| pages/character/character.{js,wxml,wxss,json} | P1.5 角色主页 |
| pages/share/share.{js,wxml,wxss,json} | P0-3 海报页 |
| models/achievements.js | P1 成就系统 |
| models/shareStats.js | P0-3 分享统计 |

### 10.2 修改文件

| 文件 | 内容 |
|---|---|
| models/userState.js | 新增 gained_achievements 读写（不改既有字段） |
| pages/home/home.{js,wxml,wxss} | 旅程状态条 / 成就进度条 / 下一站双卡 / 微引导条 |
| pages/my-mcu/my-mcu.{js,wxml,wxss} | 分享主按钮 / 成就墙 / 档案区文案 |
| pages/movie/movie.{js,wxml} | 分享入口 + 成就检测 |
| pages/routes/route-detail.{js,wxml} | 路线分享入口 |
| pages/explore/explore.{js,wxml} | 角色卡点击 → 角色主页 |
| app.json | 注册 2 个新页面 |

### 10.3 零改动

- data/ 全部（铁律）/ H5 mcu-navigator/（指令六）

---

## 十一、暂缓内容确认（指令四/六）

1. ❌ 分享次数用户展示（后台统计即可）——已确认
2. ❌ H5 同步改版（H5 获客、小程序留存）——已确认
3. ❌ 社区功能 —— 已确认
4. ❌ 用户评论 —— 已确认
5. ❌ 会员体系 —— 已确认

---

## 十二、待策划 AI 确认事项（设计闸门）

1. **成就判定口径**：六、6.2 表（尤其「完成第一阶段」=phase1 core 4 部、「完成无限传奇」=infinity 23 部全看 是否接受）
2. **海报尺寸**：750×1100（通用）vs 750×1000（严格小红书 3:4）
3. **首页/我的MCU 进度分母**：59 = CONTENT 全量（与 V1.0 我的MCU 口径一致）确认沿用
4. **成就墙位置**：我的MCU 第 ③ 位（分享按钮下方）是否合适
5. **角色主页关联角色数**：共现 Top 取前 6 位是否合适
6. **新增页面 2 个**（character + share），页面总数 9 → 11 确认
7. **成就弹窗**：仅观影完成时触发（标记已看后检测），不设每日弹窗等打扰式触发

---

*提交后暂停。等待策划 AI 确认后进入开发阶段（指令九/十）。*
