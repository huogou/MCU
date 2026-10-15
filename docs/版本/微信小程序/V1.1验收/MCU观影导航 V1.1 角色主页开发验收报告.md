# MCU观影导航｜V1.1 Step6 角色主页开发验收报告

| 项 | 内容 |
| --- | --- |
| 阶段 | V1.1 Step6 角色主页开发 |
| 提交时间 | 2026-08-24 |
| 开发 AI | WorkBuddy（本对话 AI） |
| 上游阶段 | Step1 数据模型 / Step2 首页继续观看 / Step3 我的MCU 2.0 / Step4 分享海报 / Step5 成就系统（全部验收通过） |
| 验收状态 | 待策划 AI / 用户验收 |

---

## 1. 修改文件

| 文件 | 变更说明 |
| --- | --- |
| `mcu-miniprogram/app.json` | 注册两个新页面 `pages/characters/characters` 与 `pages/character/character` |
| `mcu-miniprogram/pages/explore/explore.wxml` | 新增「角色图鉴」入口卡片；角色网格点击改为跳转角色详情页（替代原内联展开） |
| `mcu-miniprogram/pages/explore/explore.js` | 移除内联展开逻辑（toggleChar/renderFilms/selectedId）；新增 `goCharacters` 与 `goCharacter` |
| `mcu-miniprogram/pages/explore/explore.wxss` | 清理内联展开死代码（film-*/status-*/char-note/char-card-on）；新增 `icon-char`（角色图鉴入口紫色图标底色，区分全景图金色入口） |

---

## 2. 新增文件

| 文件 | 用途 |
| --- | --- |
| `mcu-miniprogram/pages/characters/characters.json` | 角色图鉴页面配置（导航栏标题「角色图鉴」） |
| `mcu-miniprogram/pages/characters/characters.wxml` | 角色列表页模板（head + 阵营 chips + 角色卡片列表） |
| `mcu-miniprogram/pages/characters/characters.wxss` | 角色列表页样式（深色宇宙科技风，全 Token 化） |
| `mcu-miniprogram/pages/characters/characters.js` | 角色列表页逻辑（CHARACTERS + charAppearances 推导，阵营筛选） |
| `mcu-miniprogram/pages/character/character.json` | 角色详情页面配置 |
| `mcu-miniprogram/pages/character/character.wxml` | 角色详情页模板（Hero + 简介 + 首秀 + 关联作品 + 关系探索 + notFound 兜底） |
| `mcu-miniprogram/pages/character/character.wxss` | 角色详情页样式（全 Token 化） |
| `mcu-miniprogram/pages/character/character.js` | 角色详情页逻辑（含「共同出演作品数」关联角色推导） |
| `mcu-miniprogram/workspace-smoke-characters-v11.js` | 逻辑冒烟测试脚本（mock wx/Page，覆盖验收 5 项用例） |
| `mcu-miniprogram/workspace-render-characters-v11.js` | 视觉预览图生成脚本（SVG→sharp，真实数据） |
| `mcu-miniprogram/assets/preview/_characters-list-preview.png` | 角色图鉴列表页预览（750×1500） |
| `mcu-miniprogram/assets/preview/_character-detail-preview.png` | 角色详情页预览（750×1700，托尼示例） |

---

## 3. 页面截图（模拟预览，SVG→sharp）

### 角色图鉴列表页

`_characters-list-preview.png`：head（角色图鉴 · 24 位角色 · 8 大阵营）→ 阵营筛选 chips（全部金色选中 + 复仇者/银河/阿斯加德/瓦坎达/神盾局/变种人/反派，横向滚动示意）→ 共 24 位角色 → 角色卡片（圆形首字徽章 + 名称 + 英文名 + 简介两行 + 阵营标签 + 首登场 + 9/7/8/7 部作品）

### 角色详情页（托尼·斯塔克）

`_character-detail-preview.png`：Hero（复仇者红渐变 + 大徽章「托」+ 托尼·斯塔克 / 钢铁侠 + Tony Stark + 复仇者阵营 + 9 部关联作品）→ 角色简介（note 全文）→ 首次出现（钢铁侠 P1）→ 关联作品（9）列表（前 4 部样例，含阶段色块、类型标签、观看状态）→ 关系探索（6 位关联角色网格，史蒂夫/娜塔莎/索尔/布鲁斯·班纳/克林特·巴顿/尼克·弗瑞，各标注「共同出席 N 部」）

---

## 4. 数据来源说明

| 数据 | 来源 | 访问方式 |
| --- | --- | --- |
| 角色清单（24 位） | `data/characters.js` | `require` CHARACTERS（只读） |
| 阵营标签与色值 | `data/characters.js` | CAMPS（只读） |
| 角色首次出现作品 | `data/characters.js` | `char.first` 字段（只读） |
| 关联作品清单与数量 | CONTENT.chars 反查 | `mcuData.charAppearances(id)` / `mcuData.filmsOfChar(id)`（上映序） |
| 阶段色值 | `data/constants.js` PHASE | `mcuData.phaseColor(p)` |
| 类型展示标签 | `data/content.js` TYPE_LABEL | 电影/剧集/特别呈现/短片 |
| 观看状态 | userState（游客本地存储） | `userState.watchState(id)` |
| **关联角色推导** | 共同出演作品数 | 页面内推导函数 `relatedChars(id)`：取该角色出现作品集合，逐个反查其他角色的共同作品，按共同数降序取前 6，**数据零修改** |

数据纪律：未修改 `CONTENT / ROUTES / RELATIONS / CHARACTERS / PANO` 任何字段，未新增第二套数据。关系探索采用「共同出演作品数」推导方案，与数据零修改原则兼容。

---

## 5. 测试结果

执行脚本：`node workspace-smoke-characters-v11.js`（mock wx/Page 环境，node 直跑）

**结果：30 / 30 通过，0 失败**

| 用例 | 检查项 | 结果 |
| --- | --- | --- |
| 用例 1 角色列表加载 | 总角色数 24 | ✓ 24 |
|  | 总阵营数 8 | ✓ 8 |
|  | 阵营筛选 chips 8 个 | ✓ 8 |
|  | 默认「全部」展示 24 位 | ✓ 24 |
|  | 钢铁侠卡片：首字徽章「托」 | ✓ |
|  | 首登场《钢铁侠》 | ✓ |
|  | 关联作品数量 9 | ✓ |
|  | 阵营筛选「反派」→ 灭霸 1 位 | ✓ |
|  | 阵营筛选「变种人」→ 死侍/金刚狼 2 位 | ✓ |
| 用例 2 角色详情展示 | 存在角色 notFound=false | ✓ |
|  | 基础信息：名称含「钢铁侠」+ 简介非空 | ✓ |
|  | 阵营：复仇者阵营 | ✓ |
|  | 首次出现：iron-man《钢铁侠》 | ✓ |
|  | 关联作品数量 > 3（实测 9） | ✓ |
|  | 关系探索：1-6 位（实测 6） | ✓ |
|  | 关系探索：不包含角色自身 | ✓ |
|  | 关系探索：首位关联共同出席 5 部 | ✓ |
|  | 导航栏标题：托尼·斯塔克 | ✓ |
|  | 关联作品行：id/阶段色/观看状态字段齐全 | ✓ |
| 用例 3 电影跳转 | 首次出现 → `/pages/movie/movie?id=iron-man` | ✓ |
|  | 关联作品行 → `/pages/movie/movie?id=avengers` | ✓ |
| 用例 4 角色关联跳转 | 关联角色 → `/pages/character/character?id=steve` | ✓ |
|  | 关联角色详情可正常打开（steve 二级链路） | ✓ |
|  | 列表页角色卡 → 详情页 `/pages/character/character?id=thor` | ✓ |
| 用例 5 数据不存在 | 非法 id → notFound=true | ✓ |
|  | 缺 id 参数 → notFound=true | ✓ |
| 附加 数据一致性 | 钢铁侠出现作品 ≥8（实测 9） | ✓ |
|  | 灭霸出现作品 ≥3（实测 3，数据口径：明确出场，彩蛋镜头不计入 chars） | ✓ |

---

## 6. 设计纪律遵循

- **零 raw hex**：页面层全部引用 `var(--gold)` / `var(--surface-2)` / `var(--p1..--p6)` 等 CSS 变量，仅 inline style 中阶段色与阵营色通过 `style="background:{{phaseColor}}"` / `{{camp.color}}` 拼接，仍走 constants/CAMPS 权威值
- **深色宇宙科技风**：背景 `#0B0E14`、表面 `#1C2330`、金色强调 `#E9A93B`、阵营色按 CAMPS 唯一来源
- **角色头像方案**：数据层无角色图片资源（visuals.js 海报/剧照映射为空，H5 亦无角色头像）。采用「首字徽章」方案（阵营色圆形徽章 + 中文名首字），与电影页 posterCard 兜底逻辑（letter + 阶段色块）保持同一视觉语言，未来若补全角色图片，仅需在 visuals.js 或 characters.js 增 `avatar` 字段，无需改页面结构
- **三态隔离**：角色主页属「探索增强功能」，不抢占核心观看入口（路线 → 电影 → 观看），入口仅放探索页面与角色图鉴列表页
- **数据零修改**：未改动 CONTENT / ROUTES / RELATIONS / CHARACTERS / PANO 任何字段

---

## 7. 已知问题

1. **真机截图未补**：当前为无 GUI 环境，预览图采用 SVG→sharp 模拟渲染。真机效果待用户接入微信开发者工具后补正。
2. **角色头像为占位**：暂无角色图片资源（visuals.js 仅覆盖海报/剧照且当前为空），采用首字徽章方案；后续若补全角色头像，需在 `data/characters.js` 增 `avatar` 字段或在 `data/visuals.js` 扩展 `charAvatars` 映射。
3. **关系探索口径**：采用「共同出演作品数」推导，与 `CONTENT.chars` 字段强绑定。数据中未录入的彩蛋镜头（如灭霸在《复仇者联盟》彩蛋）不计入关联，灭霸出现作品实际为 3 部（银河护卫队/无限战争/终局之战），与 H5 口径一致。
4. **D12 视觉 Token 统一债**：D12-A 已记录 map.html / 小程序 explore/movie/panorama 硬编码颜色，不阻塞上线。角色主页全 Token 化，未引入新债。
5. **探索页「内联展开」逻辑移除**：原探索页角色网格点击为内联展开显示出现作品列表，现改为跳转角色详情页。属于指令驱动的最小改动（角色主页收归独立页面，避免双套交互），不影响核心观看路径。

---

## 8. 入口与交互链路

```
[探索页]
  ├─ 宇宙全景图 → /pages/panorama/panorama（保留）
  ├─ 角色图鉴（新增） → /pages/characters/characters
  └─ 热门角色网格 → /pages/character/character?id=xxx
                        ├─ 首次出现作品 → /pages/movie/movie?id=xxx
                        ├─ 关联作品行 → /pages/movie/movie?id=xxx
                        └─ 关联角色 → /pages/character/character?id=xxx（二级）
```

---

## 9. 暂停，等待下一阶段指令

Step6 角色主页开发完成。请策划 AI / 用户验收。

如通过，等待 Step7 指令（如：D10-B 小程序反馈与纠错页面，或 V1.1 下一阶段功能）。