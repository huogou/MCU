============================================================
MCU观影导航 · D12-A Step3-3 TabBar 恢复完成报告
阶段：D12-A Step3（实际开发重建）· Step3-3
生成时间：2026-08-21 10:45
编写方：开发/设计 AI（WorkBuddy，双岗合并，仅向策划 AI 汇报）
原则：恢复 D10-A 冻结稿 / 单一可信源 / 物理隔离 / 零业务改动
============================================================

一、本步目标
恢复小程序底部 TabBar 4 入口（首页/路线/探索/我的MCU），按 D10 Token 体系
配置 SVG 线性描边图标（PNG 形式，因微信 TabBar 仅支持本地 PNG），深色主题
一致、选中态金色强调。不动业务页面、不改数据、不接资源。

二、修改文件清单（共 11 个，新增 10，修改 1）
1. 修改
   - mcu-miniprogram/app.json
       · tabBar.list[i] 补入 iconPath + selectedIconPath（4 条）
       · 颜色色值（color / selectedColor / backgroundColor）保留 Step3-1 既有色板
         与 D10 Token 严格对齐（#6B7384 / #E9A93B / #141925）
       · pages[] / window / style / sitemapLocation / lazyCodeLoading 零改动

2. 新增（8 PNG + 1 渲染脚本 + 2 内部验证图）
   - mcu-miniprogram/assets/icons/tab/home.png           (81×81, 1.0KB, 灰描边)
   - mcu-miniprogram/assets/icons/tab/home-active.png    (81×81, 1.1KB, 金描边+15%填充)
   - mcu-miniprogram/assets/icons/tab/routes.png         (81×81, 0.3KB, 灰描边)
   - mcu-miniprogram/assets/icons/tab/routes-active.png  (81×81, 0.3KB, 金描边+15%填充)
   - mcu-miniprogram/assets/icons/tab/explore.png        (81×81, 1.6KB, 灰描边)
   - mcu-miniprogram/assets/icons/tab/explore-active.png (81×81, 1.7KB, 金描边+15%填充)
   - mcu-miniprogram/assets/icons/tab/my-mcu.png         (81×81, 1.3KB, 灰描边)
   - mcu-miniprogram/assets/icons/tab/my-mcu-active.png  (81×81, 1.4KB, 金描边+15%填充)
   - mcu-miniprogram/assets/icons/tab/_overview.png      (324×162, 8 图标合成, 内部验证)
   - mcu-miniprogram/assets/icons/tab/_preview.png       (1620×780, 4 状态手机壳预览)
   - mcu-miniprogram/utils/render-tab-icons.js           (可复跑的一次性渲染脚本，留档)

三、图标来源（唯一权威）
- 几何定义：恢复资料/D10原型/D10-A_观影主线强化原型.html 内联 SVG
  （line 1877-1894，nav.tab-bar 区块 4 个 tab-item）
  · 首页：M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z + 9 22 9 12 15 12 15 22
  · 路线：M3 6h18 M3 12h18 M3 18h12
  · 探索：circle cx12 cy12 r9 + M12 3v9l6 3
  · 我的MCU：M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z
- 样式定义：原型 .tab-bar CSS（line 149-194）
  · 未选中：stroke #6B7384 (text-weak), fill none, stroke-width 1.6
  · 选中：  stroke #E9A93B (gold), fill rgba(233,169,59,0.15), stroke-width 1.6
  · stroke-linecap/linejoin: round
- 渲染实现：Node + sharp（librsvg）按 viewBox 0 0 24 24 内容居中（-2.5,-2.5,29,29）
  渲染为 81×81 PNG（微信 TabBar 推荐尺寸，文件 < 40KB 上限）
- 概念映射（开发/设计 AI → 策划 AI 确认）：
  · 首页 ⇄ 基地（home：房子图标 = MCU 基地入口）
  · 路线 ⇄ 路径（routes：三线图标 = 观影路线规划）
  · 探索 ⇄ 指南针（explore：圆+指针 = 关系探索 / 宇宙地图）
  · 我的MCU ⇄ 盾牌（my-mcu：盾形 = 个人观看进度 / 我的存档）

四、页面映射关系
| 序 | 文字     | 路径                       | iconPath                          | selectedIconPath                       |
| -- | -------- | -------------------------- | --------------------------------- | -------------------------------------- |
| 1  | 首页     | pages/home/home            | assets/icons/tab/home.png         | assets/icons/tab/home-active.png       |
| 2  | 路线     | pages/routes/routes        | assets/icons/tab/routes.png       | assets/icons/tab/routes-active.png     |
| 3  | 探索     | pages/explore/explore      | assets/icons/tab/explore.png      | assets/icons/tab/explore-active.png    |
| 4  | 我的MCU  | pages/my-mcu/my-mcu        | assets/icons/tab/my-mcu.png       | assets/icons/tab/my-mcu-active.png     |
交互：微信原生 tabBar → 点击 = wx.switchTab（框架内置，无需手写逻辑）
状态保持：原生 tabBar 跨页面保留栈（4 个 tab 页面切换不触发 onLoad）

五、自测结果（8 项全过）
1) 四个 Tab 正常显示            ✅ （4 PNG 文件全部生成，物理存在，81×81）
2) 当前页面正确高亮              ✅ （selectedColor = #E9A93B；选中图标金+15%填充）
3) 页面切换正常                  ✅ （4 pagePath 均在 pages[] 中注册，4 页面四件套齐全）
4) 深色主题一致                  ✅ （backgroundColor #141925, color #6B7384, 边线 #232C3D）
5) 图标尺寸符合设计              ✅ （81×81 PNG，文件 0.3~1.7KB，远低于 40KB 上限）
6) JSON 解析                    ✅ （app.json 节点自测脚本通过：SELF_TEST_OK）
7) tabBar 颜色与 D10 Token 对齐  ✅ （color/selectedColor/backgroundColor 三项逐一比对一致）
8) 资源独立性                    ✅ （图标 100% 由恢复资料 D10-A 原型还原，无 emoji / 无微信默认 / 无第三方 icon 库）

六、截图（视觉验证）
- _overview.png（324×162, 8 图标缩略图）：上排 4 个未选中（灰），下排 4 个选中（金+填充）
- _preview.png（1620×780, 4 状态手机壳预览）：从左至右展示
  「首页 / 路线 / 探索 / 我的MCU」分别作为当前 Tab 的高亮状态；
  模拟微信小程序真实深色主题（导航栏 + 占位卡 + 底部 tabBar + 安全区）
- 真机/开发者工具截图：当前环境无 GUI 微信开发者工具，截图待策划 AI 或用户侧补拍
  （实机体验预计与 _preview.png 一致，原生 tabBar 渲染）

七、关键设计决策
- 几何 100% 沿用 D10-A 原型 SVG path（恢复原则，不重设计）
- 双态色严格使用 D10 Token：未选中 #6B7384、选中 #E9A93B
- 选中态 fill 15% 金色 = 原型 rgba(233,169,59,0.15) 效果复刻
- 81×81 画布 + viewBox -2.5 -2.5 29 29：图形留 ~14% 边距（避免顶格、视觉舒适）
- stroke-width 1.6（原型等比映射到 24 单位网格；缩放后约 4.5px，线条清晰不过粗）
- 微信限制：iconPath/selectedIconPath 必须本地路径 → 选本地 PNG 形式（项目内）
- _overview.png / _preview.png / render-tab-icons.js 留档，团队可复核、可重跑

八、下一步建议（待策划 AI 决策）
- 立即可推进（串行）：
  · Step3-4 首页开发（双态：新用户 / 老用户，按 D10-A 观影主线强化稿）
  · Step3-5 电影详情页（未观看 / 正在观看 / 已观看 三态 + 资源模块占位）
  · Step3-6 路线页（11 路线 + 进度入口）
  · Step3-7 探索 / 全景 / 我的MCU / browse（4 页并行轻量开发）
- 待策划 AI 拍板再动：
  · RELATIONS 92 vs 93 差异定性（第五步）
  · D10-B 反馈与纠错：Step3-8 接入入口与提交结构
  · 夸克网盘资源链接（resources.js 配置层，禁硬编码）

九、执行边界自检
✅ 未改 H5 结构   ✅ 未改 MCU 数据   ✅ 未新增产品功能
✅ 未改 page.js/wxml（仅 app.json + 新增 assets/） ✅ 数据层零改动
✅ 未接资源链接   ✅ 未开发反馈功能 ✅ 单一可信源（图标 path 来自 D10-A）
✅ 每阶段暂停同步（本步交付即停，等策划 AI 验收）

十、交付物路径索引（开发/设计 AI → 策划 AI 验收用）
- 报告：        AI生成文件/D12-A Step3-3 TabBar恢复报告.md
- 配置文件：    mcu-miniprogram/app.json
- 图标资源：    mcu-miniprogram/assets/icons/tab/*.png（8 张正式 + 2 张内部验证）
- 渲染脚本：    mcu-miniprogram/utils/render-tab-icons.js
- 同步文件：    给策划AI同步文件.txt（追加 六、节）
- 工作日志：    .workbuddy/memory/2026-08-21.md

============================================================
（本报告同步写入 给策划AI同步文件.txt 六、节）
============================================================
