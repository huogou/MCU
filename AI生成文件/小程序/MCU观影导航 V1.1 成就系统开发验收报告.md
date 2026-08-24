# MCU观影导航 V1.1 成就系统开发验收报告

- 版本：V1.1 Step5 v1.0
- 日期：2026-08-24
- 维护方：开发/设计 AI（WorkBuddy）
- 依据：V1.1 Step5 成就系统开发指令 + V1.1 数据模型确认报告
- 范围：成就数据模型 + 我的 MCU 成就墙 + 解锁逻辑（观影完成后弹窗）+ 入口接入；未开发角色主页

---

## 1. 修改文件（3 个）

| 文件 | 变更 |
|---|---|
| `mcu-miniprogram/pages/my-mcu/my-mcu.js` | require achievements；data 新增 `achievements / achProgress`；entrances 仅保留分享卡（成就占位卡移除）；refresh 装配 `achievements.all() / progress()`；新增 `onTapAch`（已获得→展示成就名，未获得→提示解锁条件）；goEntry 删除 achievement 分支 |
| `mcu-miniprogram/pages/my-mcu/my-mcu.wxml` | 入口行仅分享卡（角标改「生成海报」）；新增「我的成就 · x / 6」成就墙区块（横滑徽章：已获得金 / 未获得灰） |
| `mcu-miniprogram/pages/my-mcu/my-mcu.wxss` | 新增 `.ach-row/.ach-item/.ach-badge(.gained)/.ach-name(.gained)/.ach-hover` 成就墙样式 |

## 2. 新增文件（3 个）

| 文件 | 用途 |
|---|---|
| `mcu-miniprogram/models/achievements.js` | 成就数据模型（6 项定义 + 判定 + 独立键 mcu_nav_achievements_v1 + check/all/progress/gained/markShown 接口） |
| `mcu-miniprogram/assets/icons/tab/_ach-wall-preview.png` | 成就墙预览（750×340 横滑示意，SVG→sharp） |
| `mcu-miniprogram/assets/icons/tab/_ach-popup-preview.png` | 成就弹窗预览（750×600 半屏示意，SVG→sharp） |

> 另：`pages/movie/movie.{js,wxml,wxss}` 为弹窗接入（见第 5 节），计入修改文件。

## 3. 成就规则（指令四，实测口径）

| # | id | 名称 | 判定条件 | 实测数据 |
|---|---|---|---|---|
| 1 | first-step | 初入漫威 | 观看第一部 MCU 电影 | watched ≥ 1 |
| 2 | phase-1-done | 第一阶段完成 | **Phase 1 核心电影 4 部全看** | iron-man / thor / captain-america-first-avenger / avengers（phase=1 且 importance=core 实测 4 部；指令列表含 6 部电影含 optional 2 部，按「只统计核心电影，以数据实际配置为准」取 core 4 部） |
| 3 | infinity-explorer | 无限传奇探索者 | **Infinity Saga 23 部电影全看** | saga=infinity 实测 23 部（全为电影，指令「23部」吻合） |
| 4 | newcomer-done | 新手入坑完成 | 新手入坑路线 12/12 全看 | expandRoute(newcomer)=12 部 |
| 5 | collector-5 | 收藏家 | 收藏数量 ≥ 5 | favorite 数 |
| 6 | sharer-1 | 分享新人 | shareData.total ≥ 1 | mcu_nav_share_v1.total |

- 判定全部基于现有字段推导，**零新增数据字段**
- 新用户无成就；完成 Phase1 4 部时同时解锁 ①②；完成 Infinity 23 部时同时解锁 ①②③④（infinity 集合 ⊇ newcomer 12 部，实测确认）

## 4. 数据结构说明

### 4.1 achievements 模型（`models/achievements.js`）

- 定义表：6 项（id/name/desc/icon/group/test），test 只读 userState + shareData
- **独立键 `mcu_nav_achievements_v1`**：

```json
{
  "gained": [{ "id": "first-step", "at": 1724476800000 }],
  "shown": { "first-step": true }
}
```

- `gained`：已解锁记录（弹窗去重依据）；`shown`：已弹窗提示记录（同一成就只弹一次）
- **接口**：`list / all() / gained() / progress() / isGained(id) / check() / markShown(id) / isShown(id) / pendingDesc(id)`
- **展示口径**：`all()/progress()` 实时判定（金徽章 = 已记录 或 当前条件已满足），历史用户无需弹窗记录也能看到成就
- **触发口径**：`check()` 只在观影完成（movie 页标记已看）后调用，写入 gained 记录

### 4.2 铁律验证

- `mcu_nav_user_v1` 零修改（禁止项 ✓）· `data/*` 全部零修改 · `userState.js` 零修改 · H5 零改动

## 5. 解锁逻辑与弹窗（指令六：只在观看完成后触发，禁止频繁弹窗）

### 5.1 触发点（`pages/movie/movie.js`）

`onMarkWatched`（标记为已观看）内：
1. 先 `setData({ achPopup: null })` 清旧弹窗（防残留）
2. `userState.toggle(id)` 标记已看
3. `achievements.check()` → 返回新解锁成就数组
4. 有解锁且 `!isShown(first.id)` → `markShown(first.id)` + 弹出（**多个成就只弹第一个**，其余在成就墙可见）
5. 无新成就 → 不弹

### 5.2 弹窗 UI（movie.wxml/wxss 半屏弹层）

- 遮罩 + 底部圆角弹层（深色 Token：surface-1 底 + 金徽章）
- 内容：金圆徽章（图标字）→「成就解锁」→ 成就名 → 描述 → 双按钮「分享我的进度」（→ share?type=progress，Step4 复用）/「继续旅程」（关闭）
- 关闭：遮罩点击 / 右上 × / 按钮

## 6. 页面截图（模拟预览）

**成就墙**（_ach-wall-preview.png）：我的成就 · 2/6 → 6 个横滑徽章（初入漫威/第一阶段完成=金色 + 其余=灰色）+ 名称
**成就弹窗**（_ach-popup-preview.png）：半屏弹层（金徽章「一」+ 成就解锁 + 初入漫威 + 观看第一部 MCU 电影 + 分享/继续双按钮）

## 7. 测试结果（10 用例 22/22 通过）

| 用例 | 验证项 | 结果 |
|---|---|---|
| 1 新用户无成就 | gained 空 / 进度 0/6 / check 无解锁 | ✓ |
| 2 看第一部电影 | 解锁 first-step | ✓ |
| 3 完成 Phase1 核心 4 部 | 解锁 first-step + phase-1-done（恰好 2 项） | ✓ |
| 4 完成 Infinity 23 部 | 解锁 infinity-explorer + phase-1-done + newcomer-done（集合包含） | ✓ |
| 5 新手入坑 12 部 | 解锁 newcomer-done | ✓ |
| 6 收藏 5 | 解锁 collector-5 | ✓ |
| 7 分享 1 次 | 解锁 sharer-1（shareData.total=1） | ✓ |
| 8 check 去重 | 再次 check 不重复解锁 / 进度精确 1/6 | ✓ |
| 9 movie 弹窗 | 标记已看弹 first-step / 无新成就不弹（防频繁）/ 不重复弹 | ✓ |
| 10 成就墙装配 | 6 项 / 已获得 2 项（实时判定）/ 进度 2/6 / 入口行仅剩分享卡 | ✓ |

附加验证：
- 全工程 29 个 JS 语法无回归
- 新增样式零 raw hex（my-mcu.wxss 的 `#fff` 为 V1.0 遗留 wc-poster 文字色，非本步引入）
- wxml 零内联 svg / 零 emoji / 零第三方图标
- 临时脚本/SVG 已清理

## 8. 已知问题 / 待后续

1. **「第一阶段完成」口径**：指令列表写 6 部电影（含 optional 无敌浩克/钢铁侠2），括号注明「只统计 4 部核心电影，以当前项目 Phase1 数据实际配置为准」——实现取 **core 4 部**（与数据模型确认报告一致）。如需改为 6 部电影全看（phase=1 且 type=movie），一行常量改动即可，待策划确认。
2. **弹窗多成就只弹第一个**：同时解锁多个时仅弹 first（按定义表顺序），其余在成就墙可见（指令六防频繁弹窗）。
3. **真机截图未补**：环境无 GUI，SVG→sharp 模拟预览；真机效果待 Step7。
4. **V1.0 遗留 `#fff`**（my-mcu wc-poster）：历史视觉债（D12 已知），非本步引入。
5. **成就弹窗分享入口**已接 Step4 share 页（type=progress），后续如需成就专属海报可扩展。
6. 下一步：Step6 角色主页开发（pages/character，P1.5）。

## 9. 交付物

- 代码：achievements.js（新）+ movie.js/wxml/wxss（改，弹窗）+ my-mcu.js/wxml/wxss（改，成就墙）
- 预览：_ach-wall-preview.png / _ach-popup-preview.png（2 图）
- 本报告：AI生成文件/MCU观影导航 V1.1 成就系统开发验收报告.md

---

*Step5 完成后暂停，等待下一阶段指令（开发启动指令第九节：第六步 角色主页开发）。*
