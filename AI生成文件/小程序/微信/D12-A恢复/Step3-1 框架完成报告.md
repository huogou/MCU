============================================================
MCU观影导航 · D12-A Step3-1 项目基础框架完成报告
阶段：D12-A Step3（实际开发重建）· Step3-1
生成时间：2026-08-20 17:28
编写方：开发/设计 AI（WorkBuddy，双岗合并，仅向策划 AI 汇报）
原则：恢复 D11 验收版，不重新设计；与 H5 物理隔离；数据单一源
============================================================

一、本步目标
按 D12-A Step3 开发顺序第 1 步，建立可运行的微信小程序骨架（项目基础框架），
不触碰 H5、不录入数据、不实现业务逻辑。完成后暂停，提交本报告。

二、产出文件清单（共 41 个）
1. 工程配置
   - project.config.json  —— compileType=miniprogram，appid=wx78f00e7f0a5948b7，projectname=mcu-miniprogram
   - sitemap.json
2. 全局文件
   - app.json           —— 9 页注册 + 4 TabBar（首页/路线/探索/我的MCU）
   - app.js             —— 云初始化（env=mcu-d6gw0brqoa9521b58），用户态存储键 mcu_user_state_v1
   - app.wxss           —— 权威设计 Token（CSS 变量）+ 通用布局类（mcu-page/card/title/btn-gold 等）
3. 9 个页面骨架（各含 wxml/js/json/wxss 占位）
   - pages/home/          首页（Tab1）
   - pages/routes/        路线（Tab2）
   - pages/route-detail/  路线详情（子页）
   - pages/movie/         电影详情（子页，含资源模块位置）
   - pages/explore/       关系探索（Tab3）
   - pages/panorama/      全景地图（子页，由 explore 进入）
   - pages/browse/        浏览全部（增强页）
   - pages/my-mcu/        我的MCU（Tab4）
   - pages/feedback/      我要吐槽（D10-B，P2，已注册占位）
4. 预留空目录
   - data/  models/  assets/  utils/（Step3-2/3-3 填充）

三、关键设计决策
· 物理隔离：新建 mcu-miniprogram/，全程未改动 mcu-navigator/（H5）任何文件。
· TabBar：当前为文字版（4 标签），线性描边图标于 Step3-3（TabBar 恢复）补入。
· 设计 Token：严格采用恢复资料「给策划AI同步文件.txt」D10 权威色值表
  （p1-6 / bg #0B0E14 / surface-1-3 / gold #E9A93B / 三级文本 / success / error），
  写入 page 级 CSS 变量，页面层禁止写死颜色（满足 D12 视觉债整改方向）。
· 反馈页：feedback 已注册占位，落实「D10-B 纳入 V1.0、P2、首版仅入口+页面+提交结构」决策。
· 资源模块：movie 页预留资源模块位置，后续走 resources.js 配置层（禁硬编码）。

四、验证结果
· 12 个 JSON 文件（project.config.json / sitemap.json / app.json / 9 个 page.json）全部通过解析校验。
· 9 个页面均能被小程序框架识别并注册，骨架可在微信开发者工具中正常预览（空白页 + TabBar 切换）。
· 未引入任何业务数据或第三方依赖，首屏零报错。

五、下一步（待策划 AI 确认本报告后执行）
Step3-2 数据层接入：
  - 将 H5 data/*.js 机械适配为 CommonJS（去 `window.MCU_X =` 前缀、加 `module.exports`），
    数据值零改动，注入 models/。
  - H5 源码注释已明确：「把 window.MCU_MOVIES = 去掉即为标准 JSON」，适配方式有据可依。
  - 建立 models/{mcuData, userState, recommend, pano} 统一访问层。
  - 完成后同样暂停并提交《Step3-2 数据层接入报告》。

六、执行边界自检
✅ 未改 H5 结构   ✅ 未改 MCU 数据   ✅ 未新增产品功能
✅ 未重新设计页面 ✅ 未改变交互逻辑   ✅ 每阶段暂停同步

============================================================
（本报告同步写入 给策划AI同步文件.txt 三-C 节）
