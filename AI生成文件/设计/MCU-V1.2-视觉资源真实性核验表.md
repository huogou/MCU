# MCU V1.2 视觉资源真实性核验表

> 设计 AI：QoderWork CN · 2026-08-26
> 核验范围：24 角色头像 / 38 电影海报 / 关系探索数据 / 角色-电影关联
> 核验方法：逐文件代码审查 + 逐张头像视觉核验 + 关系数据逻辑审计

---

## 一、角色头像核验（24 张）

所有头像均为 AI 生成（ImageGen），落盘路径 `mcu-miniprogram/assets/avatars/{id}.jpg`，已缩放至 300×300 上传 CDN。

| # | 角色 ID | 角色名 | 演员 | 头像视觉评估 | 结论 |
|---|---------|--------|------|-------------|------|
| 1 | tony | 托尼·斯塔克/钢铁侠 | Robert Downey Jr. | 钢铁侠战甲 + 面部，红金配色正确，面部有 RDJ 特征 | ✅ 可接受 |
| 2 | steve | 史蒂夫·罗杰斯/美国队长 | Chris Evans | 蓝色战衣 + 盾牌正确，但面部与 Chris Evans 相似度低，偏通用帅哥脸 | ️ 面部不准确 |
| 3 | thor | 索尔/雷神 | Chris Hemsworth | 金色长发 + Mjolnir + 闪电，形象正确 | ✅ 可接受 |
| 4 | natasha | 娜塔莎/黑寡妇 | Scarlett Johansson | 红发 + 黑色战术服，形象正确 | ✅ 可接受 |
| 5 | banner | 布鲁斯·班纳/浩克 | Mark Ruffalo | 白大褂 + 绿色调面部，Banner 形态正确 | ✅ 可接受 |
| 6 | clint | 克林特/鹰眼 | Jeremy Renner | 持弓姿态，形象正确 | ✅ 可接受 |
| 7 | loki | 洛基 | Tom Hiddleston | 角盔 + 狡黠笑容，形象正确 | ✅ 可接受 |
| 8 | fury | 尼克·弗瑞 | Samuel L. Jackson | 光头 + 眼罩 + 黑皮衣，形象正确 | ✅ 可接受 |
| 9 | bucky | 巴基/冬日战士 | Sebastian Stan | 长发 + 金属臂（蓝光），形象正确 | ✅ 可接受 |
| 10 | sam | 山姆/猎鹰 | Anthony Mackie | 机械翼 + 红色战衣，形象正确 | ✅ 可接受 |
| 11 | **peter** | **彼得·帕克/蜘蛛侠** | **Tom Holland** | **儿童面孔 + 蜘蛛侠战衣，明显是儿童版/动画版，非 Tom Holland MCU 版** | **❌ 需更换** |
| 12 | strange | 斯蒂芬·斯特兰奇/奇异博士 | Benedict Cumberbatch | 红色斗篷 + 阿戈摩托之眼 + 胡须，形象正确 | ✅ 可接受 |
| 13 | tchalla | 特查拉/黑豹 | Chadwick Boseman | 黑豹战衣，形象正确 | ✅ 可接受 |
| 14 | wanda | 旺达/绯红女巫 | Elizabeth Olsen | 黑发 + 红色混沌魔法，形象正确 | ✅ 可接受 |
| 15 | vision | 幻视 | Paul Bettany | 红色皮肤 + 心灵宝石额头，形象正确 | ✅ 可接受 |
| 16 | scott | 斯科特/蚁人 | Paul Rudd | 蚁人战衣 + 头盔，形象正确 | ✅ 可接受 |
| 17 | carol | 卡罗尔/惊奇队长 | Brie Larson | 蓝红战衣 + 星形徽章 + 能量拳，形象正确 | ✅ 可接受 |
| 18 | starlord | 彼得·奎尔/星爵 | Chris Pratt | 太空头盔 + 红色皮衣，形象正确 | ✅ 可接受 |
| 19 | gamora | 卡魔拉 | Zoe Saldana | 绿色皮肤 + 黑发，形象正确 | ✅ 可接受 |
| 20 | thanos | 灭霸 | Josh Brolin | 紫色皮肤 + 无限手套，形象正确 | ✅ 可接受 |
| 21 | shangchi | 尚气 | Simu Liu | 金色十环 + 亚洲面孔，形象正确 | ✅ 可接受 |
| 22 | yelena | 叶莲娜 | Florence Pugh | 金色短发 + 黑色战术服，形象正确 | ✅ 可接受 |
| 23 | wade | 韦德/死侍 | Ryan Reynolds | 红色战衣 + 双刀 + 疤痕，形象正确 | ✅ 可接受 |
| 24 | logan | 罗根/金刚狼 | Hugh Jackman | 钢爪 + 粗犷面容，形象正确 | ✅ 可接受 |

**头像核验结论**：22/24 可接受，2 张需更换。

**必须更换**：
- `peter.jpg` — 当前为儿童版蜘蛛侠，需重新生成 Tom Holland MCU 版（青少年/青年面孔，红蓝战衣）

**建议更换**：
- `steve.jpg` — 面部与 Chris Evans 相似度低，建议重新生成（蓝色战衣 + 盾牌 + Chris Evans 面部特征）

---

## 二、关系探索数据核验

### 2.1 SPECIAL 关系表（12 条）

| # | from | to | 当前类型 | MCU 实际关系 | 是否正确 | 修改建议 |
|---|------|----|---------|-------------|---------|---------|
| 1 | tony | peter | mentor | 师徒（Tony 是 Peter 的导师） | ✅ 正确 | — |
| 2 | **tony** | **steve** | **rival** | **核心盟友（内战短暂对立，终局和解）** | **❌ 错误** | **改为 ally** |
| 3 | thor | loki | family | 兄弟（收养） | ✅ 正确 | — |
| 4 | thor | odin | family | 父子 | ⚠️ 数据断链 | odin 不在 CHARACTERS 中，此条永不生效，建议删除 |
| 5 | steve | bucky | family | 挚友（童年至今） | ✅ 正确 | — |
| 6 | natasha | clint | family | 深厚战友情 | ✅ 可接受 | — |
| 7 | wanda | vision | family | 恋人/伴侣 | ✅ 可接受 | — |
| 8 | tony | thanos | enemy | 宿敌 | ✅ 正确 | — |
| 9 | thanos | gamora | family | 养父女 | ✅ 正确 | — |
| 10 | **strange** | **wanda** | **rival** | **盟友（偶有紧张但非对手关系）** | **❌ 错误** | **改为 ally** |
| 11 | wade | logan | rival | 对手（Deadpool & Wolverine） | ✅ 正确 | — |
| 12 | **tchalla** | **starlord** | **rival** | **短暂冲突后迅速结盟，非对手** | **❌ 错误** | **改为 ally** |

**SPECIAL 表结论**：12 条中 3 条类型错误，1 条数据断链。

### 2.2 关系推导逻辑问题

当前逻辑链：SPECIAL 查表（最高优先级）→ 同阵营=ally → 跨阵营共演≥2=rival → 无关系

**核心 Bug**：SPECIAL 表中 `tony-steve=rival` 覆盖了同阵营 ally 规则，导致：
- tony 与 steve（同为 avengers）被标为"对手"
- tony 与 natasha（avengers vs shield，跨阵营共演 5 部）被标为"对手"
- tony 与 thor（avengers vs asgard，跨阵营共演 4 部）被标为"对手"

**影响**：以钢铁侠为中心的关系探索图中，3 个最重要的盟友（美国队长、黑寡妇、雷神）全部显示为"对手"（红色虚线），严重误导用户。

**修复方案**：
1. 将 SPECIAL 表中 `tony-steve` 改为 `ally`
2. 将 `strange-wanda` 改为 `ally`
3. 将 `tchalla-starlord` 改为 `ally`
4. 删除 `thor-odin`（odin 不在角色表中）
5. 修复后，tony-natasha 和 tony-thor 将通过"跨阵营共演≥2=rival"规则仍被标为 rival——但这也不准确

**更深层问题**：自动推导规则"跨阵营共演≥2=rival"本身有缺陷。大量 MCU 核心关系是跨阵营盟友（如 tony-fury、tony-tchalla、steve-tchalla 等），不应被标为 rival。

**建议**：
- 方案 A：将跨阵营共演阈值从 ≥2 提高到 ≥4（减少误判）
- 方案 B：在 SPECIAL 表中为关键跨阵营盟友添加 ally 条目（如 tony-fury、tony-tchalla、steve-tchalla 等）
- 方案 C：移除自动 rival 推导，所有关系均由 SPECIAL 表显式定义（最准确但需 GPT 提供完整 92 条）

**推荐方案 B**：在等待 GPT 提供完整 92 条期间，先补充以下关键 ally 条目：
- tony-fury → ally
- tony-tchalla → ally
- tony-natasha → ally（修正 auto-derived rival）
- tony-thor → ally（修正 auto-derived rival）
- steve-tchalla → ally
- steve-natasha → ally
- steve-thor → ally

### 2.3 关系探索页面视觉问题

根据截图（V1.2关系探索_网络图预览.png）：
- Canvas 网络图渲染正常，节点分布合理
- 连线颜色正确（蓝色=盟友、红色=敌人/对手、金色=师徒、紫色=家人）
- **但关系类型错误**：tony-steve/tony-natasha/tony-thor 显示为红色"对手"线，实际应为蓝色"盟友"线
- 下方关系列表同样显示错误的关系类型标签

---

## 三、电影海报核验（38 张）

海报文件名与电影 ID 1:1 对应（`posters/{movie-id}.jpg`），映射结构正确。

| # | 电影 ID | 中文名 | 年份 | 阶段 | 海报映射 | 结论 |
|---|---------|--------|------|------|---------|------|
| 1 | iron-man | 钢铁侠 | 2008 | 1 | ✅ | 文件名正确 |
| 2 | incredible-hulk | 无敌浩克 | 2008 | 1 | ✅ | 文件名正确 |
| 3 | iron-man-2 | 钢铁侠2 | 2010 | 1 | ✅ | 文件名正确 |
| 4 | thor | 雷神 | 2011 | 1 | ✅ | 文件名正确 |
| 5 | captain-america-first-avenger | 美国队长：复仇者先锋 | 2011 | 1 | ✅ | 文件名正确 |
| 6 | avengers | 复仇者联盟 | 2012 | 1 | ✅ | 文件名正确 |
| 7 | iron-man-3 | 钢铁侠3 | 2013 | 2 | ✅ | 文件名正确 |
| 8 | thor-dark-world | 雷神2：黑暗世界 | 2013 | 2 | ✅ | 文件名正确 |
| 9 | winter-soldier | 美国队长2：冬日战士 | 2014 | 2 | ✅ | 文件名正确 |
| 10 | guardians | 银河护卫队 | 2014 | 2 | ✅ | 文件名正确 |
| 11 | age-of-ultron | 复仇者联盟2：奥创纪元 | 2015 | 2 | ✅ | 文件名正确 |
| 12 | ant-man | 蚁人 | 2015 | 2 | ✅ | 文件名正确 |
| 13 | civil-war | 美国队长3：内战 | 2016 | 3 | ✅ | 文件名正确 |
| 14 | doctor-strange | 奇异博士 | 2016 | 3 | ✅ | 文件名正确 |
| 15 | guardians-2 | 银河护卫队2 | 2017 | 3 | ✅ | 文件名正确 |
| 16 | spider-man-homecoming | 蜘蛛侠：英雄归来 | 2017 | 3 | ✅ | 文件名正确 |
| 17 | thor-ragnarok | 雷神3：诸神黄昏 | 2017 | 3 | ✅ | 文件名正确 |
| 18 | black-panther | 黑豹 | 2018 | 3 | ✅ | 文件名正确 |
| 19 | infinity-war | 复仇者联盟3：无限战争 | 2018 | 3 | ✅ | 文件名正确 |
| 20 | ant-man-wasp | 蚁人2：黄蜂女现身 | 2018 | 3 | ✅ | 文件名正确 |
| 21 | captain-marvel | 惊奇队长 | 2019 | 3 | ✅ | 文件名正确 |
| 22 | endgame | 复仇者联盟4：终局之战 | 2019 | 3 | ✅ | 文件名正确 |
| 23 | far-from-home | 蜘蛛侠：英雄远征 | 2019 | 3 | ✅ | 文件名正确 |
| 24 | black-widow | 黑寡妇 | 2021 | 4 | ✅ | 文件名正确 |
| 25 | shang-chi | 尚气与十环传奇 | 2021 | 4 | ✅ | 文件名正确 |
| 26 | eternals | 永恒族 | 2021 | 4 | ✅ | 文件名正确 |
| 27 | no-way-home | 蜘蛛侠：英雄无归 | 2021 | 4 | ✅ | 文件名正确 |
| 28 | multiverse-of-madness | 奇异博士2：疯狂多元宇宙 | 2022 | 4 | ✅ | 文件名正确 |
| 29 | love-and-thunder | 雷神4：爱与雷霆 | 2022 | 4 | ✅ | 文件名正确 |
| 30 | wakanda-forever | 黑豹2：瓦坎达万岁 | 2022 | 4 | ✅ | 文件名正确 |
| 31 | quantumania | 蚁人与黄蜂女：量子狂潮 | 2023 | 5 | ✅ | 文件名正确 |
| 32 | guardians-3 | 银河护卫队3 | 2023 | 5 | ✅ | 文件名正确 |
| 33 | the-marvels | 惊奇队长2 | 2023 | 5 | ✅ | 文件名正确 |
| 34 | deadpool-wolverine | 死侍与金刚狼 | 2024 | 5 | ✅ | 文件名正确 |
| 35 | brave-new-world | 美国队长4：勇敢新世界 | 2025 | 5 | ✅ | 文件名正确 |
| 36 | thunderbolts | 雷霆特攻队* | 2025 | 5 | ✅ | 文件名正确 |
| 37 | fantastic-four | 神奇四侠：初露锋芒 | 2025 | 6 | ✅ | 文件名正确 |
| 38 | brand-new-day | 蜘蛛侠：崭新之日 | 2026 | 6 | ✅ | 文件名正确 |

**海报核验结论**：38 张海报文件名与电影 ID 1:1 对应，映射结构无误。实际海报图像内容需 GPT 确认（AI 生成图，非官方海报）。

---

## 四、角色-电影关联核验

### 4.1 数据不一致问题

| # | 问题 | 详情 | 影响 | 修改建议 |
|---|------|------|------|---------|
| D-01 | thanos 首次出场不一致 | characters.js 中 `thanos.first = 'avengers'`（2012 彩蛋），但 movies.js 中 avengers 的 chars 数组不含 'thanos' | filmsOfChar('thanos') 不返回 avengers，角色详情页首次出场卡显示 avengers 但关联作品列表不含 avengers | 在 avengers 的 chars 数组中添加 'thanos' |
| D-02 | odin 不在角色表 | SPECIAL 表中 `thor-odin=family`，但 CHARACTERS 无 odin | 此关系永不生效 | 删除 SPECIAL 表中 thor-odin 条目，或将 odin 加入角色表 |
| D-03 | clint 缺少出场 | clint 的 chars 仅含 avengers/age-of-ultron/endgame，缺少 winter-soldier 和 civil-war | 角色详情页关联作品不完整 | 在 winter-soldier 和 civil-war 的 chars 中添加 'clint' |
| D-04 | 多部电影 chars 为空 | eternals、wakanda-forever、fantastic-four 的 chars 数组为空 | 这些电影的角色关联完全缺失 | 补充对应角色的 chars 映射 |
| D-05 | tchalla 缺少 wakanda-forever | wakanda-forever 的 chars 为空，tchalla 未映射 | 黑豹2 在角色详情页不出现 | 在 wakanda-forever 的 chars 中添加 'tchalla' |

### 4.2 角色关联作品完整性（按 filmsOfChar 反向查询）

| 角色 | 关联电影数 | 电影列表 | 完整性评估 |
|------|-----------|---------|-----------|
| tony | 9 | iron-man, iron-man-2, avengers, iron-man-3, age-of-ultron, civil-war, spider-man-homecoming, infinity-war, endgame | ✅ 完整 |
| steve | 7 | captain-america-first-avenger, avengers, winter-soldier, age-of-ultron, civil-war, infinity-war, endgame | ✅ 完整 |
| thor | 7 | thor, avengers, thor-dark-world, age-of-ultron, thor-ragnarok, infinity-war, endgame | ✅ 完整 |
| natasha | 7 | iron-man-2, avengers, winter-soldier, age-of-ultron, civil-war, black-widow, endgame | ✅ 完整 |
| banner | 5 | incredible-hulk, avengers, age-of-ultron, thor-ragnarok, endgame | ✅ 完整 |
| clint | 3 | avengers, age-of-ultron, endgame | ️ 缺少 winter-soldier, civil-war |
| loki | 4 | thor, avengers, thor-dark-world, thor-ragnarok | ✅ 完整 |
| fury | 5 | iron-man, iron-man-2, avengers, winter-soldier, captain-marvel | ✅ 完整 |
| bucky | 3 | captain-america-first-avenger, winter-soldier, civil-war | ✅ 完整 |
| sam | 3 | winter-soldier, civil-war, brave-new-world | ✅ 完整 |
| peter | 6 | civil-war, spider-man-homecoming, infinity-war, far-from-home, no-way-home, brand-new-day | ✅ 完整 |
| strange | 4 | doctor-strange, infinity-war, no-way-home, multiverse-of-madness | ✅ 完整 |
| tchalla | 3 | civil-war, black-panther, infinity-war | ⚠️ 缺少 wakanda-forever |
| wanda | 4 | age-of-ultron, civil-war, infinity-war, multiverse-of-madness | ✅ 完整 |
| vision | 3 | age-of-ultron, civil-war, infinity-war | ✅ 完整 |
| scott | 5 | ant-man, civil-war, ant-man-wasp, endgame, quantumania | ✅ 完整 |
| carol | 3 | captain-marvel, endgame, the-marvels | ✅ 完整 |
| starlord | 4 | guardians, guardians-2, infinity-war, guardians-3 | ✅ 完整 |
| gamora | 3 | guardians, guardians-2, infinity-war | ✅ 完整 |
| thanos | 3 | guardians, infinity-war, endgame | ⚠️ 缺少 avengers（彩蛋出场） |
| shangchi | 1 | shang-chi | ✅ 完整 |
| yelena | 2 | black-widow, thunderbolts | ✅ 完整 |
| wade | 1 | deadpool-wolverine | ✅ 完整 |
| logan | 1 | deadpool-wolverine | ✅ 完整 |

---

## 五、阶段图与背景图核验

| 类型 | 资源 | 评估 | 结论 |
|------|------|------|------|
| 阶段图 phase-1~6 | 6 张，文件名与阶段编号对应 | AI 生成宇宙主题图，非官方阶段海报 | ️ 文件名正确，图像为 AI 生成风格图 |
| 首页背景 hero-banner | 1 张 | AI 生成宇宙门户主题图 | ️ AI 生成风格图 |
| 入口卡片 entry-* | 4 张 | AI 生成主题图 | ⚠️ AI 生成风格图 |
| 剧照 stills | 38 张 | 文件名与电影 ID 对应 | ⚠️ AI 生成风格图，非官方剧照 |

---

## 六、汇总与优先级

### 必须修复（阻塞定版）

| # | 类型 | 问题 | 修改方案 |
|---|------|------|---------|
| **R-01** | 角色头像 | peter.jpg 为儿童版蜘蛛侠 | 重新生成 Tom Holland MCU 版蜘蛛侠头像 |
| **R-02** | 关系数据 | SPECIAL 表 3 条类型错误（tony-steve/strange-wanda/tchalla-starlord 应为 ally） | 修改 explore.js SPECIAL_RELATIONS |
| **R-03** | 关系数据 | SPECIAL 表 1 条断链（thor-odin，odin 不在角色表） | 删除该条目 |
| **R-04** | 关系推导 | 跨阵营共演≥2=rival 规则导致 tony-natasha/tony-thor 等被误标为对手 | 补充 SPECIAL ally 条目或提高阈值 |
| **R-05** | 数据一致性 | thanos first='avengers' 但 avengers chars 不含 thanos | 在 avengers chars 中添加 'thanos' |

### 建议修复（不阻塞定版）

| # | 类型 | 问题 | 修改方案 |
|---|------|------|---------|
| R-06 | 角色头像 | steve.jpg 面部与 Chris Evans 相似度低 | 重新生成 |
| R-07 | 数据完整性 | clint 缺少 winter-soldier/civil-war | 补充 chars 映射 |
| R-08 | 数据完整性 | tchalla 缺少 wakanda-forever | 补充 chars 映射 |
| R-09 | 数据完整性 | eternals/wakanda-forever/fantastic-four chars 为空 | 补充 chars 映射 |

### 已知限制（本轮不处理）

| # | 说明 |
|---|------|
| L-01 | 38 张海报 + 38 张剧照 + 6 张阶段图 + 5 张入口/背景图均为 AI 生成，非官方素材。文件名映射正确，但图像内容为 AI 风格化创作 |
| L-02 | 完整 92 条 SPECIAL 关系表待 GPT 提供，当前 12 条为基础子集 |
| L-03 | 部分未来电影（brave-new-world/thunderbolts/fantastic-four/brand-new-day）尚未上映，海报为 AI 生成概念图 |

---

## 七、执行建议

**本轮优先处理 R-01 ~ R-05**（阻塞定版），预计工时：

1. R-01：重新生成 peter.jpg（~5 分钟）
2. R-02~R-04：修改 explore.js SPECIAL_RELATIONS + 补充 ally 条目（~15 分钟）
3. R-05：修改 movies.js avengers chars 数组（~2 分钟）

R-06~R-09 可在定版后迭代处理。
