============================================================
MCU小程序 V1.0 重建实施方案
阶段：D12-A Step2（策划 AI 已确认选 B：据 D10-A 冻结稿 + D11 验收清单重建）
生成时间：2026-08-20 17:24
编写方：开发/设计 AI（WorkBuddy，双岗合并，仅向策划 AI 汇报）
原则：恢复原项目，不重新设计；数据单一源，禁第二套
============================================================

# 一、页面恢复清单（8 个注册页 + 资源模块）

说明：小程序端 8 个注册页来自 D10 Step9 验收报告（home/routes/route-detail/explore/
panorama/browse/movie/my-mcu），与策划指令的 8 页一一对应。「资源入口」对应 D10-A
在 movie 详情内新增的「观看资源折叠模块」，非独立页；browse（浏览全部 59 部）为增强页，
一并纳入恢复范围。

| # | 页面 | 用途 | 原设计依据（一手资料） | 恢复优先级 |
|---|------|------|------------------------|-----------|
| 1 | 首页 home（Tab1） | 引导与发现：新用户态=品牌引导+8热门起点pills+3功能卡+CTA「从《钢铁侠》开始」；老用户态=进度环(已看/38)+继续观看大卡+快捷入口+最近看过横滑 | D10 Step3/4/5/6 首页双态冻结稿 | P0 |
| 2 | 路线 routes（Tab2） | 结构化观影：基础5/专题6分组+路线卡(名称/标语/总数/进度条/当前高亮)+当前路线进度入口卡 | D10 Step6 路线页冻结 + D10-A 当前进度入口 | P0 |
| 3 | 路线详情 route-detail（子页） | 纵向步骤时间轴(已看绿/当前金/未看灰)+桥梁文案+保存路线；数据=ROUTES+CONTENT | D10 Step6 路线详情冻结 | P0 |
| 4 | 电影详情 movie（子页） | 单部深读：Hero/为什么重要/双时间线/下一部3模式/前置/关系去重/轻量角色/宇宙地图入口/底部三态栏(未看·正在·已看)+观看资源折叠模块；核心操作=标记已看(isSeen)、轻量吐槽 | D6 结构 + D10-A 三态 + 资源模块 | P0 |
| 5 | 探索 explore（Tab3） | 以作品为中心探索关联：搜索栏+8热门起点pills+紧凑Hero卡+前置/后续/直接关联流+关系概览+全景图入口(?id=)；数据=RELATIONS+CONTENT+characters | D7 explore + D10 Step6 | P0 |
| 6 | 全景地图 panorama（子页，由 explore 进入） | 六阶段全局脉络：横向 scroll-view 画布(最终压缩 3400px)，38 节点三层，canvas 2d 三类型连线(mainline金/support灰/cross紫虚)+?id定位高亮+点击节点跳详情；数据=PANO_MOVIES+PANO_CONN(41边) | D7 全景图 + D7 最终验收(3400px) | P1（依赖 explore） |
| 7 | 我的MCU my-mcu（Tab4） | 个人中心：统计+路线进度+收藏+最近看过；操作=已看/收藏管理；数据=userState | D10 Step6 冻结 | P0 |
| 8 | 浏览全部 browse | 59 部全片单，类型筛选(全部59/电影38/剧集14/特别2/短片5)；入口=首页/探索快捷 | D10 Step9 | P1（增强页） |
| ＋ | 资源入口（movie 内模块） | 观看资源折叠模块：图标+标题+箭头，展开资源列表+「打开资源」；无链接显示「资源整理中」占位；点击=wx.setClipboardData 复制夸克链接+提示 | D10-A #3 资源模块 + data/resources.js | 随 movie 一并恢复 |

TabBar（4 一级标签，线性描边图标，金色选中 #E9A93B）：首页=基地 / 路线=路径 / 探索=指南针 / 我的MCU=盾牌。
二级返回：电影详情 / 路线详情 / 全景图。页内切换：探索→全景图（非 Tab 切换）。

# 二、数据恢复方案（唯一数据源 = H5 data/*.js）

铁律：H5 mcu-navigator/data/*.js 是唯一可信源，小程序端只读复用，不重新整理、不建第二套。

| 数据 | H5 源文件 | 小程序接入方式 | 备注 |
|------|-----------|----------------|------|
| CONTENT 59 | movies.js(38)+series.js(14)+special.js(2)+short.js(5) → content.js 合成 | models/mcuData.content（聚合，不另建电影表） | id/type/importance/cn/title/year/date/phase/co(时间线序)/ro(上映序)/source |
| RELATIONS | relations.js（实测 93 / 文档 92） | mcuData.relationsOf / recommend.prereqOf | 每条带 why；差异走 D12-A 第五步独立复核 |
| CHARACTERS 24 | characters.js | mcuData.getChar | 角色 pills / Hero 卡关联 |
| ROUTES 11 | routes.js | mcuData.routes | {id,kind(basic|topic),name,tagline,forWho,desc,why,generator,items[]} |
| PHASE 1–6 | constants.js PHASE | 全局 Token，p1–p6 色值 | 阶段色唯一权威来源 |
| userState | H5 localStorage key=mcu_nav_user_v1 | wx.storage 迁移（游客免登录） | watched/want_to_watch/favorite/saved_routes/last_watched/current_route/current_content/milestones_shown；isSeen 向后兼容 |
| recommend | models/recommend.js | 下一部推荐逻辑 | 基于 RELATIONS 的 ro 序 + prereqOf，三模式切换 |
| pano | models/pano.js（移植 map.html PANO_MOVIES/PANO_CONN/PHASE_COLS/LAYOUT） | 节点 id 全部指回 content 单一源 | 不改 38 节点、不改 PANO_CONN、不改数据 |
| resources | data/resources.js（D10-A 新增独立配置层） | contentId→夸克链接；空配置占位 | 项目方提供链接后填入即生效，无需改页面逻辑 |

适配要点（仅改挂载方式，不改数据内容）：
H5 用 window.MCU_* 全局变量注入；小程序需把 data/*.js 改为可被 require/import 的模块
（module.exports 或挂 app.globalData）。这是重建时的唯一工程适配点，数据零改动。

# 三、页面开发顺序（严格按指令）

1. 基础框架：app.json（4 Tab 注册 + 8 页注册）/ app.js / app.wxss（全局 Token 变量）/ 目录结构
2. 数据层：适配 data/*.js 为小程序模块 + models/{mcuData,userState,recommend,pano} + resources.js
3. TabBar：4 图标 PNG（基地/路径/指南针/盾牌，金色选中态）+ app.json 配置
4. 首页 home：双态 + canvas 2d 进度环 + 8 pills + CTA 卡
5. 电影详情 movie：三态栏 + 资源折叠模块 + 下一部推荐 + 关系去重 + 深链 onLoad({id})
6. 路线 routes + 路线详情 route-detail：分组 + 时间轴三态 + 保存路线
7. 探索 explore：搜索 + pills + Hero 卡 + 关联流 + 全景图入口
8. 全景地图 panorama：canvas 2d 坐标重建 + 三类型连线 + ?id 定位高亮
9. 我的MCU my-mcu：统计 + 路线进度 + 收藏 + 最近看过
10. 资源入口：movie 内模块接入 resources.js（随 movie 阶段一并完成）
11. 测试验收：node --check 全 JS + 逻辑冒烟（目标 ≥49/49，对齐 D10-A）+ 深链回归

# 四、功能恢复范围（严格按 D10-A 冻结稿 + D11 验收清单）

恢复项（据开发史可 100% 还原）：
- 首页双态、电影三态、观看资源折叠、路线进度入口、下一部推荐(三模式)、状态全链路联动
- 8 页 + 4 Tab + 4 模型 + 深链(movie/route-detail/explore onLoad)
- 探索关系流、全景图 canvas 绘制、我的MCU 统计、用户态 wx.storage 迁移
- 夸克资源「复制链接」逻辑、H5→小程序六档入口接收方（D8 已部署，小程序侧仅接收）

明确禁止（D12-A 红线 + D10 禁用清单）：
❌ 社区 ❌ 评论 ❌ 会员 ❌ 广告 ❌ 后台 ❌ 复杂消息中心
❌ 重写小程序 ❌ 改 H5 结构 ❌ 改 MCU 数据 ❌ 改关系分类规则 ❌ 改产品定位

# 五、设计恢复原则（设计 AI 只还原，不创新）

沿用已冻结 Token 体系（D10 Step6 + D10 Step3 纠正后权威值）：

| 类别 | 值 |
|------|-----|
| 阶段色 p1–p6 | #5B8DEF / #28B487 / #F0A932 / #8B6FE8 / #E8483F / #C25B8E |
| 背景/表面 | #0B0E14 / #141925 / #1C2330 / #232C3D |
| 金色 | #E9A93B |
| 文本 | 主 #E8ECF4 / 次 #A8B0C0 / 弱 #6B7384（注：D10-A 实测 text-3 为 #7A8296，建议统一回 #6B7384） |
| 状态 | 成功 #3FB98A / 错误 #E5604D |

- 间距体系：页面边距 20px，卡片间距 8–12px，section 间距 12–16px（D10 Step6 冻结）
- 微信不支持内联 SVG → 进度环用 canvas 2d、功能卡/对勾用 PNG/文本（D10 Step9 已验证）
- 海报兜底：阶段色 + 首字 fallback（加载失败优雅降级）
- 已知 P2 偏差 6 项（D10 Step8）作为非阻塞记录，本阶段不返工

# 六、风险评估

【100% 可恢复（依据详尽开发报告 + 原型 + 冻结稿）】
- 8 页结构 / 4 Tab / 数据同源（CONTENT/RELATIONS/ROUTES/PHASE/characters）
- 首页双态 / 路线时间轴 / 探索关系流 / 我的MCU / 用户态迁移
- 下一部推荐 / 状态全链路联动 / 资源折叠模块 / 夸克复制逻辑
- 深链 onLoad(movie/route-detail/explore) / 全景图坐标（3400px 压缩值已在 D7 报告留档）

【需据文档推断（有依据，但需重建细节）】
- movie 三态具体视觉细节（读 D10-A 原型还原）
- panorama canvas 坐标 LAYOUT 常量（从 pano.js 重建，3400px 压缩参数已记录）
- TabBar 4 枚 PNG 图标（按「基地/路径/指南针/盾牌 线性描边 + 金色选中」重绘）
- resources.js 空模板结构（D10-A 已定义 contentId→链接 schema）

【需重新确认（非阻塞，待项目方/策划）】
1. 关系数据 93 vs 92 偏差 → D12-A 第五步独立只读复核
2. 夸克资源链接清单 → 项目方提供后填入 resources.js
3. D10-B 反馈功能是否纳入 V1.0（设计已完成、未开发，可选）
4. 真机验收 → 沙箱不可行，需策划放行真机环境
5. 全景图最终宽度 3400 vs 4240 → 已定 3400，原始坐标留档可一键回退

# 七、时间评估（单人重建，复用全部既有报告；不含真机）

| 里程碑 | 预计耗时 | 说明 |
|--------|----------|------|
| 框架完成（app.json/TabBar/全局Token/目录） | 0.5 天 | 可注册空壳 |
| 数据层完成（适配 data/*.js + 4 models + resources） | 1 天 | 数据零改动，仅改挂载 |
| 首页完成 | 1 天 | 双态 + canvas 进度环 |
| 电影详情完成 | 1.5 天 | 三态 + 资源模块 + 下一部 + 关系去重 |
| 路线 + 路线详情 | 1 天 | |
| 探索完成 | 1 天 | |
| 全景地图完成 | 1.5 天 | canvas 坐标重建为最重项 |
| 我的MCU 完成 | 0.5 天 | |
| 资源入口接入 | 0.5 天 | 随 movie |
| 联调自测（node --check + 逻辑冒烟 ≥49/49） | 1 天 | |
| **第一版可运行（框架+数据层+首页首屏）** | **≈ 2.5 天** | 可跑通首屏与数据读取 |
| **完整恢复（8 页 + 4 模型 + 自测）** | **≈ 9–10 个工作日** | 不含真机 |
| **测试时间（真机验收）** | **2–3 天** | 多机型滚动/触控/TabBar/图片/CloudBase/网络异常，需策划放行真机 |

注：以上为开发 AI 估算，实际受真机放行节奏、夸克链接到位时间影响。

============================================================
下一步：本方案提交后暂停，等待策划 AI 确认后进入实际开发（D12-A Step3）。
============================================================
