# MCU观影导航 V1.1 数据模型确认报告

- 版本：V1.1 数据模型 v1.0
- 日期：2026-08-24
- 维护方：开发/设计 AI（WorkBuddy）
- 依据：V1.1 开发启动指令（第六节 数据要求 / 第七节 成就规则 / 第九节 执行顺序第一步）
- 状态：**开发阶段第一步交付，确认后暂停，等待下一步指令（不进入页面开发）**

---

## 一、现有数据结构核对（铁律确认：零修改）

| 数据 | 实测 | V1.1 处理 |
|---|---|---|
| CONTENT 59 | data/content.js（movie 38 / series 14 / special 2 / short 5） | **零修改** |
| ROUTES 11 | data/routes.js（basic 5 + topic 6） | **零修改** |
| RELATIONS 92 | data/relations.js | **零修改** |
| CHARACTERS 24 / CAMPS 8 | data/characters.js | **零修改**（角色主页只读引用） |
| PANO 40-41-6 | models/pano.js | **零修改** |
| 用户态 | wx.storage `mcu_nav_user_v1`：watched / want_to_watch / favorite / saved_routes / last_watched / current_route / current_content / milestones_shown | **零修改**（V1.1 新增数据全部独立键，见第三节） |

**结论：V1.0 全部数据源保持原样，V1.1 不做任何字段增删改（指令六：禁止为了 V1.1 重构原始数据）。**

---

## 二、成就规则落地口径（指令第七节，实测确认）

### 2.1 第一阶段完成

| 项 | 实测结果 |
|---|---|
| Phase 1 全部内容 | **10 部** = 电影 6 + 短片 4（无剧集） |
| Phase 1 核心（importance=core） | **4 部，全部为电影** |
| 判定口径 | 看完以下 4 部 → 解锁「完成第一阶段」 |

```
iron-man（钢铁侠）/ thor（雷神）/ captain-america-first-avenger（美国队长：复仇者先锋）/ avengers（复仇者联盟）
```

✓ 符合指令「按 Phase 1 核心电影统计，不包含短片、剧集」（4 部短片 one-shot-* 与 2 部 optional 电影不计入）。

### 2.2 无限传奇完成

| 项 | 实测结果 |
|---|---|
| saga=infinity 内容 | **23 部 = 全部为电影**（movie×23，无剧集/短片） |
| 判定口径 | 看完 saga=infinity 全部 23 部 → 解锁「完成无限传奇」 |
| 数据源 | CONTENT（V1.0 单一源，口径与 V1.0 一致） |

✓ 23 部恰好全为电影，与指令「按当前 59 部数据口径、保持与 V1.0 一致」无冲突（59 = CONTENT 全量作品数，V1.0 进度分母沿用）。

### 2.3 完整成就清单（判定全部基于现有字段推导，零新增字段）

| id | 名称 | 判定条件 | 数据来源 |
|---|---|---|---|
| first-step | 初入漫威 | watched 数 ≥ 1 | userState.watched |
| journey-5 | 旅程开始 | watched 数 ≥ 5（沿用 V1.0 里程碑） | userState.watched |
| journey-10 | 一段旅程 | watched 数 ≥ 10（沿用 V1.0 里程碑） | userState.watched |
| journey-20 | 走得很远 | watched 数 ≥ 20（沿用 V1.0 里程碑） | userState.watched |
| phase-1-done | 完成第一阶段 | 4 部 Phase1 core 电影全看（见 2.1） | userState.watched + CONTENT.phase/importance |
| infinity-explorer | 无限传奇探索者 | saga=infinity 已看 ≥ 10 部 | userState.watched + CONTENT.saga |
| infinity-done | 完成无限传奇 | saga=infinity 23 部全看（见 2.2） | userState.watched + CONTENT.saga |
| newcomer-done | 入坑完成 | 新手入坑路线 12/12 全看 | userState.watched + ROUTES(items) |
| collector-5 | 收藏家 | favorite 数 ≥ 5 | userState.favorite |
| sharer-1 | 分享新人 | shareData.total ≥ 1（首次分享成功） | mcu_nav_share_v1 |

---

## 三、新增数据模型（指令六：新增数据必须独立）

### 3.1 achievements 模型（新增文件 models/achievements.js）

**职责**：成就定义 + 判定 + 解锁状态读写。

**组成**：
1. **成就定义表**（只读常量）：10 项（见 2.3），含 id/名称/描述/图标键/判定函数。判定函数只读依赖 `userState` 与 `mcu_nav_share_v1`，**不修改任何既有数据**。
2. **解锁状态存储**：独立键 **`mcu_nav_achievements_v1`**

```
mcu_nav_achievements_v1 = {
  gained: [ { id, at }, ... ],        // 已解锁成就（含时间）
  shown:  { 'first-step': true, ... } // 已弹窗提示记录（沿用 milestones_shown 语义，控制不重复打扰）
}
```

3. **接口**：
- `define()` 成就定义表
- `check(watchedDelta)` 标记观看后检测：返回本次新解锁的成就数组（空=无）
- `gained()` 已解锁列表
- `isGained(id)` / `pending()` 下一个未解锁成就（首页成就进度条用）
- 内部：判定计算只读 userState.getState()，解锁写入 mcu_nav_achievements_v1

**关键决策**：解锁状态**不并入** `mcu_nav_user_v1`（V1.0 用户态零改动，兼容性 100%）；成就系统为纯小程序侧功能，独立键不影响 H5 读取（H5 不认识该键，无副作用）。

### 3.2 shareData 模型（新增文件 models/shareData.js）

**职责**：分享模板配置 + 分享记录读写（指令六：分享模板、分享记录）。

**组成**：
1. **分享模板**（静态配置，随包，不落 storage）：三类型模板布局参数
   - `progress`：大进度环 + 已看 X/59 + 阶段徽章 + 当前路线进度 + 下一部推荐
   - `route`：路线名 + tagline + 路线进度 N/M + 当前节点 + 路线描述节选
   - `movie`：单部电影（片名/英文名/阶段徽章）+ 观看状态 + 前后关联
   - 公共：尺寸 750×1100（5:7.3 竖版）、品牌栏、slogan、小程序码占位、阶段色/金/深色 Token
2. **分享记录存储**：独立键 **`mcu_nav_share_v1`**

```
mcu_nav_share_v1 = {
  total: 0,                          // 累计分享成功次数
  byType: { progress: 0, route: 0, movie: 0 },
  history: [ { type, at }, ... ]     // 最近记录（保留最近 50 条，防膨胀）
}
```

3. **接口**：
- `template(type)` 取模板配置
- `record(type)` 分享成功 +1（后台统计，不展示，指令八）
- `getStats()` 读统计（成就 sharer-1 判定用 total）

### 3.3 变更清单（开发第一步范围）

| 类型 | 文件 | 说明 |
|---|---|---|
| 新增 | models/achievements.js | 成就定义+判定+解锁状态（独立键 mcu_nav_achievements_v1） |
| 新增 | models/shareData.js | 分享模板配置+分享记录（独立键 mcu_nav_share_v1） |
| 零改动 | data/ 全部 | CONTENT/ROUTES/RELATIONS/CHARACTERS/PANO（铁律） |
| 零改动 | models/userState.js / mcuData.js / recommend.js / pano.js | V1.0 模型零修改（成就判定只读复用） |
| 零改动 | H5 mcu-navigator/ | 指令八：暂不修改 H5 |
| 零改动 | 全部页面 | 数据模型确认阶段不动页面（第二步起开发） |

---

## 四、数据兼容性验证方案（指令十一：数据测试）

| 测试项 | 方法 | 预期 |
|---|---|---|
| 老用户数据读取 | 用含已有 watched/saved_routes 的 mock `mcu_nav_user_v1` 跑 achievements.check | 判定基于既有数据正确计算；mcu_nav_user_v1 内容不被改写 |
| 已观看记录 | 对照 watched 数量与 count() | 一致 |
| 当前路线 | current_route → ROUTES.name 解析 | 与 V1.0 同口径（默认新手入坑） |
| 进度计算 | watched / 59 | 与 V1.0 我的MCU 一致 |
| 新增键隔离 | 写入 achievements/share 键后读回 | mcu_nav_user_v1 字节级不变（新旧键互不影响） |
| 成就边界 | 0/1/4/5/23 部等临界点 | 2.3 表判定逐项通过 |

验证方式：Node mock wx（沿用 V1.0 逻辑冒烟方式）+ 数据零修改断言。

---

## 五、待确认事项（本步闸门）

1. **解锁状态独立键** `mcu_nav_achievements_v1`（不并入 mcu_nav_user_v1）——是否符合"新增数据必须独立"预期。
2. **成就清单 10 项**（2.3 表）判定口径是否接受，尤其：
   - 「完成第一阶段」= Phase1 core 4 部电影（短片 4 部 + optional 2 部不计入）
   - 「完成无限传奇」= saga=infinity 23 部（实测全为电影）
3. **分享记录键** `mcu_nav_share_v1` 结构（total/byType/history，history 保留最近 50 条）。
4. 确认后第二步即开发**首页继续观看**（旅程状态条 / 下一站双卡 / 成就进度条）。

---

*本步仅数据模型确认，未动任何代码/页面。确认后暂停，等待下一步指令（第九节第二步）。*
