============================================================
MCU观影导航 · D12-A Step3-2 数据层接入报告
阶段：D12-A Step3（实际开发重建）· Step3-2
生成时间：2026-08-21 10:05
编写方：开发/设计 AI（WorkBuddy，双岗合并，仅向策划 AI 汇报）
原则：恢复 D11 验收版，不重新设计；与 H5 物理隔离；数据单一源、禁第二套
============================================================

一、本步目标
按 D12-A Step3 开发顺序第 2 步，将 H5 唯一数据源 mcu-navigator/data/*.js
机械适配为小程序可读取模块，并建立 models 统一数据访问层。
让小程序重新拥有与 H5 一致的数据基础。不开发页面、不调整 UI、
不接入资源链接、不修改数据、不优化推荐算法。

============================================================
二、文件清单（新增 15 个，修改 1 个）
============================================================
A. data/ 数据模块（10 个，内容 100% 与 H5 一致，仅改挂载方式）
  1. data/movies.js      ← H5 data/movies.js（MCU_MOVIES 38 + MCU_UPCOMING 2）
  2. data/series.js      ← H5 data/series.js（14 部剧集）
  3. data/special.js     ← H5 data/special.js（2 部特别呈现）
  4. data/short.js       ← H5 data/short.js（5 部短片）
  5. data/content.js     ← H5 data/content.js（四类合成 CONTENT 59 + 类型/重要度常量）
  6. data/relations.js   ← H5 data/relations.js（92 条 + 来源注入 + REL_TYPES 6）
  7. data/characters.js  ← H5 data/characters.js（24 角色 + CAMPS 8）
  8. data/routes.js      ← H5 data/routes.js（11 条路线）
  9. data/constants.js   新建：阶段色 PHASE（1-6）+ 类型/重要度展示色（权威 Token）
 10. data/resources.js   新建：资源配置层（contentId/title/quarkUrl/status/updateTime，空配置占位）

B. models/ 统一数据访问层（4 个，接口对齐 H5 assets/js/app.js）
 11. models/mcuData.js   ← H5 MCU.data（统一读取 CONTENT/RELATIONS/CHARACTERS/ROUTES/PHASE）
 12. models/userState.js ← H5 MCU.progress（wx.storage 迁移 mcu_nav_user_v1，字段兼容 + isSeen + watchState 三态）
 13. models/recommend.js ← H5 MCU.rec（三模式 next + prereqOf + followOf，基于 RELATIONS ro 序）
 14. models/pano.js      ← H5 map.html PANO_MOVIES/PANO_CONN + D7 验收 PHASE_COLS/LAYOUT（3400px 压缩版）

C. 修改（1 个，仅常量对齐）
 15. app.js             storeKey 由 mcu_user_state_v1 → mcu_nav_user_v1（与 H5 键名对齐，见 userState.js）

D. 辅助（已删除）
    临时校验脚本（verify_step3_2.js / compare_h5_mp.js / tmp_gen_pano.js）验证后删除，不留仓。

============================================================
三、数据来源（单一源，禁第二套）
============================================================
- H5 mcu-navigator/data/*.js（movies/series/special/short/content/relations/characters/routes）
  为唯一可信源；适配方式 = 去掉 window.MCU_X = 前缀 + module.exports（H5 源码注释已注明此路径）。
- H5 assets/js/app.js（MCU.data / MCU.progress / MCU.rec）为 models 恢复蓝本，逻辑照搬。
- H5 map.html（PANO_MOVIES/PANO_CONN/阶段列/布局 CSS）为 pano 数据来源。
- H5 assets/css/style.css（--p1..--p6 / --type-* / --imp-*）为 constants.js 色值权威来源。
- PHASE_COLS 位置（48/674/1299/2165/2710/3159）与 LAYOUT.canvasW=3400、卡片 60×90
  来自 D7 最终验收报告（2026-08-17），压缩比 k=3400/4240≈0.8019 经复核与报告完全吻合。
- 未引入任何第二套电影数据，未手工维护作品列表或关系。

============================================================
四、是否零修改
============================================================
✅ 数据零修改：10 项数据对比（MOVIES/UPCOMING/SERIES/SPECIAL/SHORT/CHARACTERS/CAMPS/
   ROUTES/RELATIONS 数组/REL_TYPES）逐字段 JSON 深度对比全部一致（ALL DATA IDENTICAL）。
   content.js 合成算法（co/ro 重算、来源注入）逐行对照 H5 复制。
✅ H5 零改动：mcu-navigator/ 全程未触碰（冻结）。
✅ 页面零改动：9 个页面骨架（Step3-1）未动。
⚠️ 唯一改动：app.js 的 storeKey 常量对齐 H5 键名 mcu_nav_user_v1（数据层接入必要项，
   非页面/UI/业务逻辑改动）。
⚠️ 工程适配点（数据内容不变）：
   - H5 全局变量 window.MCU_X → CommonJS module.exports
   - H5 CSS 变量 var(--p1) → constants.js hex 色值（小程序不支持 CSS 变量跨文件引用）
   - H5 localStorage → wx.getStorageSync/setStorageSync（键名/字段结构不变）

============================================================
五、models 结构
============================================================
mcuData.js（数据访问层）
  - 索引：byId / charById / byRelease(ro 序) / byChrono(co 序) / adj 邻接表（含反向边）
  - 查询：get(id) / getChar(id) / relationsOf(id) / charAppearances(id) / filmsOfChar(charId)
  - 顺序：prevByRelease / nextByRelease（全量 59 内容口径）
  - 路线：routes / routeById / expandRoute（generator: release/chrono/mainline/essential）
  - 视图：viewModes(三视图) / setView / setTypeFilter / filtered / viewLabel / state
  - 展示：phaseColor(p) → hex / visual(id) → {poster, backdrop}（缺图返回 null 兜底）
  - 常量：types(REL_TYPES) / typeLabel / impLabel / counts()

userState.js（用户状态，wx.storage，键 mcu_nav_user_v1）
  - 字段兼容 H5：watched / want_to_watch / favorite / saved_routes / last_watched /
    current_route / current_content / milestones_shown
  - isSeen 向后兼容 V1 seen 语义；toggle / count / total / seenIds / clear
  - watchState(id) 三态：watched（已看）> watching（想看）> unwatched（未看）
  - 收藏 / 想看 / 保存路线 / 当前内容 / 里程碑（5/10/20）全套恢复
  - getState / setState 原始读写（迁移/同步用）

recommend.js（下一部推荐，基于 RELATIONS ro 序 + prereqOf）
  - modes：mainline（只想看主线）/ understand（想完整看懂）/ complete（想按顺序全看）
  - next(fromId, mode)：优先手写推荐（m.next[mode]）→ complete=上映序下一部 →
    mainline=之后第一部 core → understand=关系加权最优（prereq+8/sequel+6/已看-30/前置+2/跨类型+1）
  - prereqOf(id)：ro 更早且 prereq/sequel/weight=3 的前置流
  - followOf(id)：ro 更晚的后续流
  - 返回 { content, movie(别名), why, fallback }，每推荐必带 why（产品铁律）

pano.js（全景图配置，3400px 压缩版）
  - PANO_MOVIES 40 节点（38 电影 + avengers-5/6 待映占位），left 按 k=3400/4240 等比缩放
  - PANO_CONN 41 条（mainline 15 / support 18 / cross 8），与 H5 原样一致
  - PHASE_COLS 6 列（left 48/674/1299/2165/2710/3159，标题含年份）
  - LAYOUT：canvasW 3400 / canvasH 720 / cardW×cardH 60×90 / 三层 top（70/260/440）/ 金轨 310

resources.js（资源配置层，仅建结构）
  - 字段：contentId / title / quarkUrl / status / updateTime
  - get(contentId)：无配置或无链接返回 null；all()：全量
  - 当前 RESOURCES 为空数组（项目方提供链接后填入即生效，禁页面硬编码）

============================================================
六、数量校验结果（实测）
============================================================
  CONTENT    59  ✓（movie 38 / series 14 / special 2 / short 5；ro/co 连续 1-59）
  RELATIONS  92  ⚠（指令期望 93，H5 源文件实测 92，与 relations.js 注释「全部 92 条」一致）
  CHARACTERS 24  ✓
  ROUTES     11  ✓（basic 5 / topic 6）
  PANO_MOVIES 40 ✓（38 节点 id 全部落在 CONTENT；avengers-5/6 为待映占位不入正表）
  PANO_CONN  41  ✓（端点全部在 CONTENT；类型分布 mainline15/support18/cross8 与 D11 记录一致）
  PHASE_COLS 6   ✓（left 与 D7 验收值 48/674/1299/2165/2710/3159 逐一吻合）
  引用完整性：关系端点 / 角色 first / 路线 items / 全景节点 / 连线端点 全部有效（bad=0）
  语法检查：全部 15 个新增/修改 JS 经 node --check 通过
  API 冒烟：mcuData / userState / recommend / resources / pano 全接口通过
             （含深链场景 next(iron-man,mainline)=avengers 等）

============================================================
七、异常项 / 待策划 AI 复核（均未改动数据，仅记录）
============================================================
1. 【数量差异】RELATIONS 实测 92 条 vs 指令期望 93 条。
   依据：H5 relations.js 字面量 92 条 + 文件注释「全部 92 条关系」；
   《重建实施方案》曾记录「实测 93 / 文档 92」。92 或 93 以 H5 源文件为准
   （本次已按 H5 92 条原样接入），建议 D12-A 第五步独立只读复核时最终定性。
2. 【watchState 三态判定】原小程序实现细节未留存，本次按 D10-A 语义恢复：
   已看(watched) > 想看(want_to_watch) > 未看。若与 D10-A 原型有出入，告知后调整。
3. 【PHASE_COLS/LAYOUT 重建】原小程序 pano.js 源码丢失，本次按 H5 map.html 移动端
   布局 + D7 验收报告（3400px/60×90/阶段列位置）重建；三层 top（70/260/440）与金轨
   top(310) 为视觉排布常量，D7 已注明「可随设计微调」，不阻塞。
4. 【visuals 图片映射】data/visuals.js 已建接口，posters/stills 映射表当前为空
   （图片文件属 assets 阶段 Step3-3+ 填充）；缺图时 mcuData.visual 返回 null，
   前端以阶段色+首字兜底（D7 既有行为），不破图。
5. 【PANO_CONN 重复边】H5 中存在 endgame→far-from-home 同时以 mainline 与 support
   各出现一次，为 H5 源数据原样（D11 已记录「视觉重叠一条线，无功能影响」），未去重。
6. 【app.js storeKey】由 Step3-1 的 mcu_user_state_v1 对齐为 H5 键名 mcu_nav_user_v1，
   属数据层接入必要改动，非业务逻辑变化。

============================================================
八、下一步建议（Step3-3 起，待策划 AI 验收后执行）
============================================================
1. Step3-3 TabBar 恢复：4 枚线性描边 PNG 图标（基地/路径/指南针/盾牌，金色选中态）。
2. 页面开发（按实施方案顺序）：首页双态 → 电影详情（三态+资源模块）→ 路线/路线详情
   → 探索 → 全景图（pano.js 3400 坐标直接可用）→ 我的MCU → browse。
3. assets 阶段：海报/剧照图片文件落盘后填入 data/visuals.js 映射即生效。
4. 夸克资源链接清单到位后填入 data/resources.js。
5. RELATIONS 92/93 差异的最终定性（D12-A 第五步复核）。

============================================================
九、执行边界自检
============================================================
✅ 未改 H5 结构（mcu-navigator/ 冻结）   ✅ 数据零修改（10 项深度对比一致）
✅ 未建第二套 MCU 数据                  ✅ 未开发页面 / 未调 UI
✅ 未接入资源链接（仅建结构）            ✅ 未优化推荐算法（原逻辑照搬）
✅ 每阶段暂停同步

============================================================
（本报告已同步写入 给策划AI同步文件.txt）
============================================================
