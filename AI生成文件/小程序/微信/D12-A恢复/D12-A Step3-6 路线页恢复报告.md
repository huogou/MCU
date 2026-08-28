# D12-A Step3-6 路线页恢复报告

> 生成时间：2026-08-21 14:50
> 状态：✅ 已完成，待策划 AI 验收（用户 14:36「继续」确认 Step3-5 验收并推进本步）
> 指令依据：D10-A 冻结稿 + D11 验收清单（恢复而非重设计）

---

## 1. 修改文件清单

| 文件 | 变更 |
|---|---|
| `pages/routes/routes.js` | 占位 → Tab 过滤 + 当前路线进度 + 列表装配逻辑 |
| `pages/routes/routes.wxml` | 占位 → 标题 / 双 Tab / 当前进度卡 / 路线列表（wxml 零内联 svg） |
| `pages/routes/routes.wxss` | 空 → 全 Token 化样式（平移 D10-A line 1168-1301，px×2=rpx） |
| `pages/routes/routes.json` | 新增 `navigationBarTitleText: "观影路线"` |
| 数据层 | 零改动（复用 `mcuData.routes` / `userState` 既有接口） |

---

## 2. 页面结构与视觉还原

### 2.1 四区块（对齐 D10-A 原型 line 1792-1872）

1. **头部**：`观影路线` 标题（36rpx/700）+ 双 Tab（基础路线 / 专题路线）
2. **当前路线进度卡**：`当前路线进度` 标签 + 路线名 · 第 X/Y 部 + 下一部：片名 + 副标题（阶段·传奇线）+ `去看` 金按钮
3. **路线列表**：每条路线卡 = 名称 + `N 部` + 金色 tagline + 适合人群 + 进度条（已看% / success 绿）
4. **跳转**：卡片 → `route-detail?id=`；`去看` → `movie?id=下一部`

### 2.2 视觉 Token 映射（全 Token 化，零 raw hex）

| D10-A 变量 | 小程序 Token |
|---|---|
| `--s2` | `var(--surface-2)` |
| `--s3`（border） | `var(--surface-3)` |
| `--t1 / --t2 / --t3` | `var(--text-main) / var(--text-sub) / var(--text-weak)` |
| `--gold` | `var(--gold)` |
| `--ok` | `var(--success)` |
| `--gold-a20 / --gold-a50` | `rgba(233,169,59,0.2) / rgba(233,169,59,0.5)` |
| `--r-sm / --r-md / --r-lg` | `8rpx / 16rpx / 24rpx` |

> 小程序无 `--bd` / `--gold-a20` / `--gold-a50` 变量，沿用 movie 页已验证的兜底写法（与全局 Token 一致）。

---

## 3. 数据来源说明（单一可信源，禁第二套）

- **路线列表**：`mcuData.routes`（11 条，全量渲染，按 `kind` 分 Tab）
- **当前路线**：`userState.getCurrentRoute()` → 对应 `routeId`；无保存路线则默认 `newcomer`
- **进度**：`expandRoute(route)` 展开内容 → 已看数 / 总数 → 百分比
- **下一部**：展开后首个 `userState.isSeen` 为 false 的内容
- **详情跳转**：`route-detail?id=`（占位页，不崩，待 Step3-7 实现）

---

## 4. 状态联动测试

`userState` 变更（标记看过）经各页 `onShow` 自动刷新，路线页 `refresh()` 重算进度与下一部：

- 全新用户：当前路线 newcomer，进度 0%，下一部 = 钢铁侠
- 看过前 3 部：进度 25%，下一部 = 复仇者联盟，index = 4
- 全部看完：进度 100%，`nextId` 空，显示「已完成」
- 切换专题路线为当前：当前路线卡随 `current_route` 切换

---

## 5. 自测结果（冒烟 36/36 全通过）

| 项 | 结果 |
|---|---|
| `node --check` routes 四件套 | ✓ |
| 默认 Tab / 当前路线 / 进度 / 下一部 | ✓ |
| 双 Tab 切换（基础 5 / 专题 6） | ✓ |
| 全看完边界 | ✓ |
| 跳转参数（movie / route-detail） | ✓ |
| 数据抽查 9 条手写路线 + 2 条 generator 路线 count 一致 | ✓ |
| Token 自检（wxss 零 raw hex） | ✓ |
| wxml 零内联 svg | ✓ |

---

## 6. 存在问题 / 待策划 AI 复核

1. **路线数量口径**：D10-A 原型仅展示 5 条（新手入坑 / 上映顺序 / 时间线 / 完整补完 / 最短路径），但 `routes.js` 实际 11 条（basic5 + topic6）。**已按 routes.js 单一源全量渲染**；原型为设计 mock，如需严格还原 5 条子集请告知。
2. **当前路线默认 newcomer**：与原型一致（新用户引导），符合预期。
3. **「去看」副标题**：用「阶段 + 传奇线」推导（数据驱动），非硬编码原型的「第一阶段收官之作」。
4. **route-detail 占位**：当前为 Step3-1 骨架，点击不崩但仅显示占位；是否并入本步或留 Step3-7 请指示。
5. **真机截图**：环境无 GUI 开发者工具，无法补拍；视觉严格按 D10-A CSS 移植。

---

## 7. 下一步建议

- **Step3-7**：探索 / 全景 / 我的MCU / browse（4 页并行轻量开发）
- **route-detail 详情页**：建议并入 Step3-7 或单列 Step3-6-A
- **第五步**：RELATIONS 92/93 差异定性
- **D10-B 反馈**：Step3-8 接入入口与提交结构
- **「同步上去」A 方案**（CloudBase 静态托管备份 + 发布指南）：待全部代码完成执行

---

*执行边界：Step3-6 仅做路线页列表实现，未越界开发路线详情页或其他页面，符合 D12-A「恢复优先」纪律。*
