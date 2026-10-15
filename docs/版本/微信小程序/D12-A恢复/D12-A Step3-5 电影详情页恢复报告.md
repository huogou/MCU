# D12-A Step3-5 电影详情页恢复报告

- 生成时间：2026-08-21
- 维护方：开发/设计 AI（WorkBuddy，已合并双岗，只向策划 AI 汇报）
- 依据：D10-A 观影主线强化原型（恢复资料/D10原型/D10-A_观影主线强化原型.html line 674-966 样式 + line 1474-1790 三态页面结构）+ D11 验收清单
- 状态：✅ 开发完成，73/73 逻辑自测通过，待策划 AI 验收

---

## 1. 修改文件清单

| 文件 | 变更 |
|------|------|
| `mcu-miniprogram/pages/movie/movie.js` | Step3-1 占位 → 三态逻辑（Hero/CTA/资源/为什么看/前后关联/状态联动） |
| `mcu-miniprogram/pages/movie/movie.wxml` | 占位 → 三态模板（6 区块，wxml 零内联 svg） |
| `mcu-miniprogram/pages/movie/movie.wxss` | 空 → 全 Token 化样式 + 纯 CSS 图标（ico/chevron，无 emoji/无图片资源） |
| `mcu-miniprogram/models/mcuData.js` | 修改：新增 PANO_CONN 邻接表 + `panoNeighbors(id)` 接口（前后关联权威口径） |
| `mcu-miniprogram/pages/movie/movie.json` | 不变（`navigationBarTitleText` 保持「电影详情」） |

> 说明：mcuData.js 改动仅为新增数据访问方法（`panoNeighbors`），未改任何既有数据或逻辑，属 models 职责范围内扩展。

---

## 2. 页面结构说明（对应 D10-A 六区块）

1. **Hero 区**：海报 220×320rpx（阶段色兜底 `poster-p{phase}`，图片就位后自动显图）+ 阶段色 hero-bg 渐变 + 片名 + 英文名 + chips（传奇标签 / 重要度 / 类型）+ 状态三态标签（未观看金 / 正在观看绿 / 已观看灰）。
2. **主 CTA 三态联动**：未观看「开始观看」(金) / 正在观看「继续观看」(金) / 已观看「已观看」(灰，不可点)。
3. **观看资源折叠模块**：header（图标+标题+副文案+箭头）+ 展开 body（资源列表/打开按钮/来源）；当前 resources.js 为空，仅结构占位，点击提示「资源整理中」。
4. **为什么现在看**：标题「为什么现在看这部」+ 路线上下文（如「你正沿新手入坑路线观看，这是第 N 部」）+ 说明文字（取自 CONTENT.role）。
5. **前后关联（观影位置）**：前一部 / 当前 / 下一部 三卡（阶段色迷你海报 + 片名 + 角色标签）；点击跳转该片详情。
6. **看完之后**：「标记为已观看」按钮（未看态绿、已看态标记态）+ 下一部推荐卡（recommend.next 主线下一部，点击跳转）。

---

## 3. 数据来源说明（单一可信源，禁第二套数据）

- **内容/阶段色/海报**：`mcuData.get(id)` / `mcuData.phaseColor(phase)` / `mcuData.visual(id)`
- **前后关联**：`mcuData.panoNeighbors(id)` —— 基于 `PANO_CONN`（指令指定口径）
- **状态三态**：`userState.watchState(id)` / `userState.want(id)`（→正在观看）/ `userState.toggle(id)`（→已观看）
- **下一部推荐**：`recommend.next(id, 'mainline')`
- **资源**：`resources.get(id)`（当前全空，结构占位）
- **为什么现在看**：`CONTENT.role`（数据内已有字段，直接回答「为何重要」，未新建文本）

> 全部页面字段均来自 models / data 单一源，未引入任何第二套数据或硬编码文案。

---

## 4. 状态联动测试（自测 73/73 通过）

- **三态流转**：未观看 → 点「开始观看」→ `want_to_watch` 写入 → watching；→ 点「标记为已观看」→ `watched` 写入 → watched。
- **CTA 文案**：开始观看 / 继续观看 / 已观看（done 态不可点，无副作用）。
- **标记按钮**：未看「标记为已观看」(绿) / 已看「已标记为观看」(标记态，不可点)。
- **前后关联角色标签**：前一部 / 当前 / 下一部；当前片已看后 → 「已看」。
- **跨页联动**：标记后首页/路线/我的MCU 经各自 `onShow` 读 `userState` 自动刷新（无需本页额外代码）。
- **边界**：第一部（iron-man）无前作→占位；末部无后继→占位。
- **数据一致性抽查（8 部）**：movieId 存在 / phase 1-6 / ro·co 正整数 / PANO 前后驱为有效内容 / 渲染 cn 与数据一致，全部通过。

---

## 5. 截图

- 当前环境无 GUI 开发者工具，无法补拍真机截图。
- 视觉严格按 D10-A 冻结稿 CSS 移植（原型 px × 2 = rpx，颜色全部引用 app.wxss 全局 Token，零 raw hex 泄漏）。
- 逻辑冒烟覆盖三态渲染字段（cn / posterClass / phaseText / chips / status / cta / seq / nextRec / why / resource），可作为视觉还原的程序化校验。

---

## 6. 存在问题 / 待策划复核

1. **前后关联口径**：D10-A 原型为静态策划三联（雷神→复仇者联盟→钢铁侠3）。现按指令指定口径 `PANO_CONN` 确定性推导（mainline 边优先 + 上映序最近），avengers 实得 **美国队长→复仇者联盟→冬日战士**（mainline 优先，更一致）。原型是静态 mock，线上以 PANO_CONN 为准。若策划要求完全照搬原型三联，请告知。
2. **为什么现在看**：用 `CONTENT.role`（数据已有），未新建 curated 文案字段（禁第二套）。各片文案即其 role 原文。
3. **资源模块**：`resources.js` 全空（链接 pending），模块仅结构占位，不填链接、不开发下载（符合既定纪律）。
4. **海报图**：`visuals.js` 暂空，阶段色兜底；图片资源就位后自动显图，不破图。
5. **时长 chip**：数据无 duration 字段，原型「143 分钟」为 curated，线上不显示时长 chip（禁第二套数据）。
6. **真机截图**：待策划 AI 或用户侧补拍。

---

## 7. 下一步建议

- Step3-6 路线页（11 条路线 + 当前路线进度入口）
- Step3-7 探索 / 全景 / 我的MCU / browse（4 页轻量开发）
- 第五步：RELATIONS 92/93 差异定性（独立只读复核）
- D10-B 反馈与纠错：Step3-8 接入入口与提交结构
- 「同步上去」A 方案（CloudBase 静态托管备份源码 + 发布指南）待全部代码完成时执行
