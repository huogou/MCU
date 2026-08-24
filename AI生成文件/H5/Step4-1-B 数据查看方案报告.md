# Step4-1-B 数据查看方案报告

> 阶段：MCU 观影导航 · 运营数据闭环建设（H5 侧）
> 日期：2026-08-24
> 上游：第二十二节《Step4-1 H5 运营数据闭环建设报告》（代码已改、自动化测试 30/30）
> 本步：确认数据查看方案 + 实测验证（写测试数据、确认后台是否可见）
> 结论先行：代码层埋点已完成，但**后台当前看不到 stats 数据**——根因是 `stats` 集合尚未在 CloudBase 创建。详见第四节。

---

## 1. 当前统计数据存储位置

| 项 | 说明 |
|----|------|
| 是否腾讯统计 | ❌ 否。未接入腾讯统计 / 百度统计 / GA4 / Umeng 等第三方 SDK |
| 是否外部数据库 | ❌ 否。无自建 MySQL/PG/外部接口 |
| 存储位置 | ✅ **腾讯云 CloudBase NoSQL 数据库**（文档型集合） |
| 环境 ID | `mcu-d6gw0brqoa9521b58`（与 H5、小程序、feedback 同一环境） |
| 集合名 | **`stats`**（新增集合，与 `feedback` 同库同级） |
| 写入方 | H5 自研 `MCU.stats`：浏览器端 `@cloudbase/js-sdk@3.8.0` 匿名登录后 `database().collection('stats').add(doc)` |
| 兜底 | 写失败 → 本地队列 `localStorage._mcu_stats_queue`（最多 200 条），恢复后 `flushQueue` 补写 |

> 即：数据**自有、存于 CloudBase、与 feedback 控制台同源闭环**，运营在 CloudBase 控制台即可统一查看，无需另开第三方后台。

---

## 2. 查看方式

### A. CloudBase 控制台（运营日常入口，推荐）
1. 登录 [腾讯云开发控制台](https://console.cloud.tencent.com/tcb) → 环境 `mcu-d6gw0brqoa9521b58`；
2. 左侧「数据库」→ 集合列表选择 **`stats`**；
3. 「数据」页签：看到每条原始记录（type / channel / page / name / payload / createdAt 等）；
4. 筛选：集合页支持按字段筛选（如 `channel = douyin`、`type = pageview`、`page = movie`）+ 按 `createdAt` 排序；
5. 权限：需该环境「环境成员 / 开发者」或主账号。建议为运营建**子账号并授数据库只读**，避免误操作写。

### B. MCP / API 查询（开发排障用）
- `mcp__cloudbase__readNoSqlDatabaseContent`，`collectionName: "stats"`，`query` 按条件筛选，`projection` 选字段，`sort:[{key:"createdAt",direction:-1}]`。
- 本质与控制台读同一集合，适合批量核对 / 脚本导出。

### C. 未来建议（非本步，列 V1.1/V1.2）
- 当前控制台看到的是**原始文档**，运营需手动筛选/计数，效率低。
- 建议增 **stats 看板页**（H5 运营页或小程序运营 Tab）：自动聚合 PV / UV / 来源占比 / 页面分布 / 行为漏斗，免去翻原始文档。
- 本步仅确认「能存、能查」，看板聚合为后续增强。

---

## 3. 当前可查看指标

一旦 `stats` 集合可用（见第四节修复后），可derive以下指标：

### 流量
| 指标 | 计算 | 当前可用性 |
|------|------|-----------|
| PV | `count(type = 'pageview')` | ✅ 直接可得 |
| UV | 需去重键 | ⚠️ **当前 schema 无稳定 UV 键**（无 sessionId / 匿名 `_openid` 未落库）。近似方案：按 `createdAt + channel + ua` 粗去重，或后续补 `sessionId` 字段。**精确 UV 待补字段** |

### 来源（channel 归一后）
- `douyin` / `xiaohongshu` / `wechat` / `direct`
- 计算：`count()` 按 `channel` 分组 → 各渠道占比

### 页面（page）
- `home`（首页）/ `routes`（路线页）/ `route_detail`（路线详情）/ `movie`（电影详情）/ `panorama`（全景地图）/ `next`（下一部）
- 注：指令要求 6 页含「探索页」，H5 无独立探索整页，以行为事件 `click_relation_explore` 承接（见下）

### 行为（事件 name，统一 `click_` 前缀）
- `click_start_watch`（开始观看）→ payload.id
- `click_movie_detail`（点击电影）→ payload.id
- `click_relation_explore`（点击探索）
- `click_enter_miniprogram`（进入小程序）→ payload.{type,id,channel}
- `click_<data-stat>`（通用扩展点）

### 渠道 × 页面 × 行为 交叉
- 例：抖音用户进入后，首页 PV + 进入小程序事件 + 电影详情点击，可拼出「抖音 → H5 → 小程序」转化漏斗。

---

## 4. 数据验证（实测）

**目标**：提交测试数据（模拟 douyin / xiaohongshu 访问），确认后台是否可见。

**操作**：通过 CloudBase 管理端写入 4 条测试记录（均带 `isTest: true` 便于识别/清理）：
- douyin：`home` 的 `pageview` + `click_enter_miniprogram`（payload: movie/avengers）
- xiaohongshu：`movie` 的 `pageview`（payload.id=avengers）+ `click_movie_detail`（payload.id=iron-man）

**结果**：

| 动作 | 结果 |
|------|------|
| 写入 `stats`（insert 4 条） | ❌ 失败：`[PutItem] Db or Table not exist: stats` |
| 读取 `feedback`（对照，已存在集合） | ✅ 成功：返回 1 条真实数据（2026-08-23，feedbackType=观影顺序） |
| 读取 `stats`（验证是否存在） | ❌ 失败：`[QueryRecords] Db or Table not exist: stats` |

**结论**：**后台当前看不到 stats 数据**。根因 = **`stats` 集合尚未在 CloudBase 创建**。

**为什么集合不存在**（原因链）：
1. `stats` 是 Step4-1 新增集合，从未在控制台创建；
2. 静态托管**尚未重新发布**含 `Stats` 的新 `app.js`/`movie.html`，故无浏览器端写入发生过；
3. 匿名写权限**未确认**（Step4-1 部署结果中的待办项）。
→ 即使现在发布 H5，`Stats.write` 会因集合不存在走 `catch` → 落入浏览器本地队列 `_mcu_stats_queue`，**数据滞留本地、不上云、清缓存即丢**，后台仍看不到。

**修复步骤（上线前必做，提策划 AI 拍板）**：
1. **创建集合**：CloudBase 控制台 → 环境 `mcu-d6gw0brqoa9521b58` → 数据库 → 新建集合 `stats`（与 `feedback` 同级）；
2. **设权限**：安全规则允许匿名/已登录写入（与 `feedback` 同策略，建议 `auth != null || true` 宽松写或仅 anonymous）；
3. **重发静态托管**：上传新 `app.js` / `movie.html` 到 `mcu-d6gw0brqoa9521b58` 静态托管；
4. **真机/浏览器验证**：带 `?from=douyin` 访问 H5 → 控制台 `stats` 集合出现记录 → 验证通过；
5. （可选）修复后本验证可重跑：写 4 条测试 → 控制台可见 → 删除 `isTest:true` 记录保持干净。

**补充待办（精确 UV）**：当前 schema 缺稳定 UV 去重键，建议在 `Stats.write` 补 `sessionId`（首次访问生成、存 localStorage）或确保匿名 `_openid` 落库，方可精确计算 UV。

---

## 5. 输出与待办

**本步交付**：本报告（数据查看方案 + 实测验证）。已**暂停**（按指令）。

**待策划 AI / 用户拍板后执行**：
- ① 控制台创建 `stats` 集合 + 设匿名写权限（上线前必做）；
- ② 静态托管重新发布新 `app.js`/`movie.html`；
- ③ 真机验证（带 `?from=douyin` 访问 → 后台可见）；
- ④ 补 `sessionId` 字段以支持精确 UV（V1.1）；
- ⑤ 评估 stats 看板聚合页（V1.1/V1.2）。

**实测证据存档**：反馈集合可读（1 条 2026-08-23 真实数据）证明读路径正常；`stats` 集合不存在证明写路径前置条件缺失。
