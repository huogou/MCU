============================================================
MCU观影导航 · D12-A Step3-4 首页开发完成报告
阶段：D12-A Step3（实际开发重建）· Step3-4
生成时间：2026-08-21 11:35
编写方：开发/设计 AI（WorkBuddy，双岗合并，仅向策划 AI 汇报）
原则：恢复 D10-A 冻结稿 / 单一可信源 / 物理隔离 / 全 Token 化
============================================================

一、本步目标
按 D10-A 强化稿 + D10 Step5/Step6 冻结规格，恢复首页双态：
· 新用户态：品牌引导 + 8 热门起点 pills + 3 功能入口卡 + 「从钢铁侠开始」CTA
· 老用户态：进度环（canvas 2d）+ 继续观看卡 + 2 快捷入口 + 最近看过横滑
视觉基准：D10-A 强化稿（恢复资料/D10原型）+ D10 Step5 间距压缩 + D10 Step8 P2 偏差修正
不动业务页面、不改数据、不接资源。

二、修改/新增文件（共 5 个，新增 4，修改 1）
1. 修改
   - mcu-miniprogram/pages/home/home.js        （框架占位 → 完整双态逻辑）
   - mcu-miniprogram/pages/home/home.wxml      （占位 → 双态模板）
   - mcu-miniprogram/pages/home/home.wxss      （空 → 全 Token 化样式）
2. 新增
   - mcu-miniprogram/assets/icons/tab/star.png         (81×81, 1.5KB, 帮我选星形)
   - mcu-miniprogram/assets/icons/tab/star-active.png  (81×81, 1.5KB, 选中态)
   - mcu-miniprogram/assets/icons/tab/_home-preview.png (822×840, 双态预览)
   - mcu-miniprogram/utils/check-home-conformance.js   (6 维度一致性自检脚本)

三、视觉基准依据
- D10-A 强化稿 CSS（恢复资料/D10原型/D10-A_观影主线强化原型.html line 289-560）
- D10 核心原型 HTML（AI生成文件/旧版文件/D10_小程序核心原型.html line 1151-1306）——
  8 个热门起点 pills 名称完整留存（钢铁侠/复仇者联盟/蜘蛛侠：英雄归来/奇异博士/银河护卫队/美国队长：复仇者先锋/雷神/黑豹）
- D10 Step5 反馈响应（恢复资料同步文件 line 462-468）：标题 22→18px，副文本 14→13px，
  pill 5px 12px，功能卡图标 36→28px 内边距 12px 标题 12px 描述 10px，section-label 13/t2→12/t3
- D10 Step6 冻结结论（line 470-478）：间距体系冻结 20px / 8-12px / 12-16px
- D10 Step8 P2 偏差（line 502-508）：本步按冻结稿原值修复（text-3 #6B7384 非实现值 #7A8296；
  section-label 间距 16px / 32rpx 非 24rpx；CTA 圆角 8px / 16rpx 非 12rpx）

四、关键设计决策
- 双态判定：hasProgress = (watched.count() > 0)，onShow 时刷新（覆盖进入页后再回首页场景）
- 8 个热门起点：用内容 id 数组 + 自动剔除不存在 id（与 Step9 验证记录一致）
- 进度环：微信不支持内联 SVG，用 canvas 2d 绘制（与 D10 Step8 记录一致）；
  环色 surface-3/gold 为 canvas 直写（canvas 无法读 CSS 变量），注释说明
- 海报阶段色兜底：visuals.js 图片暂空（Step3-2 已记录），poster-p1..p6 渐变（阶段色 135deg → 60% 黑）
- 帮我选卡跳转：D10-A 原型无 onclick 绑定，恢复决策指向 routes 页（语义"选路线"），
  记录为待策划 AI 确认
- 全 Token 化：wxss 中 color 属性零 raw hex（rgba 用于透明灰/金底），全引用 var(--*)
- wxml 零内联 svg（与 D10 纪律一致），图标全用 image 标签引用 PNG

五、6 维度一致性自检（17/17 全过）
1) 页面布局    ✓ 双态结构（wx:if="{{!hasProgress}}"）
2) 组件位置    ✓ 新用户 hero→pills→feat-cards→cta；老用户 progress→continue→quick→recent
3) 间距       ✓ 页面边距 20px→40rpx；卡片 16-24rpx 区间；section 16-32rpx
4) 字体层级    ✓ h1 36rpx / sub 26rpx / section-label 24rpx / pill 26rpx / feat-title 24rpx
5) 状态展示    ✓ 进度环 40rpx 金色 + p2 阶段标签 + poster-p1..p6 全
6) TabBar     ✓ 复用已生成的 routes.png / explore.png / star.png
T) Token 自检  ✓ 全 Token 化（无 raw hex 泄漏）+ 引用 surface-2/gold/p2/text-weak

六、截图（视觉验证）
- _home-preview.png（822×840，深色背景，左屏新用户态 / 右屏老用户态）：
  · 新用户：品牌引导 + 8 热门 pills（横向显示前 4 个完整，可滑）+ 3 功能卡（路线/探索/选）
  + 「从《钢铁侠》开始」CTA（蓝色 poster + 金色开始按钮）
  · 老用户：进度环 2/38（绿底 + 金色描边）+ 阶段"第一阶段 · 无限传奇"
  + 继续观看（雷神金色海报 + 下一部推荐：复仇者联盟 + 金色继续观看按钮）
  + 2 快捷卡（新手入坑已看 2/12 / 宇宙探索）+ 最近看过（雷神/钢铁侠）

七、自测结果（5 项全过）
1) node --check home.js          ✓ SYNTAX_OK
2) 逻辑冒烟 14/14                ✓ 新用户 8 项 + 老用户 6 项 + 边缘 1 项（含剔除不存在 id）
3) 6 维度一致性自检 17/17        ✓ CONFORMANCE_ALL_PASS
4) 视觉预览                     ✓ _home-preview.png 渲染清晰，深色主题一致
5) Token 自检                   ✓ 零 raw hex 颜色泄漏到 color 属性

八、异常项 / 待策划确认（均未越界）
1. 帮我选卡跳转目标 → 恢复决策指 routes（语义最近），待策划 AI 确认
2. 进度环 color canvas 直写 → 因 canvas 无法读 CSS 变量（技术必要），非业务规范违反
3. 海报图阶段色兜底 → visuals.js 图片暂空，待策划 AI 接入资源链接（Step3-5+ 阶段）

九、下一步建议（待策划 AI 决策）
· Step3-5 电影详情页（未观看 / 正在观看 / 已观看 三态 + 观看资源折叠模块）
· Step3-6 路线页（11 条路线 + 当前路线进度入口）
· Step3-7 探索 / 全景 / 我的MCU / browse（4 页并行轻量开发）
· 待第五步：RELATIONS 92 vs 93 差异定性
· D10-B 反馈与纠错：Step3-8 接入入口与提交结构

十、执行边界自检
✅ 未改 H5 结构    ✅ 未改 MCU 数据    ✅ 未新增产品功能
✅ 未碰 models      ✅ 全 Token 化（零 raw hex）
✅ wxml 零内联 svg  ✅ 单步暂停同步（等策划 AI 验收）
✅ 视觉基准 = D10-A 冻结稿 + D10 Step5/6 规格
✅ D10 Step8 P2 偏差已按冻结稿原值修复（非沿用实现偏差）

十一、交付物路径索引
- 报告：        AI生成文件/D12-A Step3-4 首页开发完成报告.md
- 页面：        mcu-miniprogram/pages/home/home.{js,wxml,wxss}
- 图标资源：    mcu-miniprogram/assets/icons/tab/star{,-active}.png
- 预览图：      mcu-miniprogram/assets/icons/tab/_home-preview.png
- 自检脚本：    mcu-miniprogram/utils/check-home-conformance.js
- 同步文件：    给策划AI同步文件.txt（追加 七、节）
- 工作日志：    .workbuddy/memory/2026-08-21.md

============================================================
（本报告同步写入 给策划AI同步文件.txt 七、节）
============================================================