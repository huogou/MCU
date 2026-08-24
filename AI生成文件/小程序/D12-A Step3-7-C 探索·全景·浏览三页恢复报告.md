# D12-A Step3-7-C 探索·全景·浏览 三页恢复报告

生成时间：2026-08-24 09:40
阶段：Step3-7 收尾（探索 explore / 全景 panorama / 浏览 browse）
依据：D10-A 冻结稿 Token 体系 + 既有页面视觉语言（D10-A 原型无此三页独立整页稿，按蓝图重建）

---

## 一、修改文件

数据层零改动，全部复用 `mcuData` / `userState` / `characters` / `relations` / `pano` 既有接口。

| 页面 | 文件 |
|---|---|
| 探索 explore（Tab3） | `pages/explore/explore.{js,wxml,wxss,json}` |
| 全景 panorama（子页） | `pages/panorama/panorama.{js,wxml,wxss,json}` |
| 浏览 browse（增强页） | `pages/browse/browse.{js,wxml,wxss,json}` |

共 12 个文件，全部由 Step3-1 占位升级为完整四件套。

---

## 二、数据来源（单一可信源，禁第二套）

- **角色数据**：`data/characters.js` → `CHARACTERS` / `CAMPS`（含阵营 label+color）
- **关系数据**：`data/relations.js` → `RELATIONS` / `REL_TYPES`（92 条，本步未直接渲染关系文案，保留接口供后续）
- **全景布局**：`models/pano.js` → `PANO_MOVIES`（40 节点）/ `PANO_CONN`（41 连线）/ `PHASE_COLS`（6 阶段）/ `LAYOUT`
- **内容模型**：`models/mcuData.js` → `get(id)` / `filmsOfChar(charId)` / `phaseColor(p)` / `all`（CONTENT 59）
- **状态联动**：`models/userState.js` → `watchState(id)`（未看/在看/已看 三态）

---

## 三、页面结构与视觉（D10 Token 全量落地）

### 探索 explore（Tab3）
- 头部标题「关系探索」+ 副标
- 宇宙全景图入口卡（金图标 ◈ → `panorama`）
- 「从热门角色开始」网格：角色卡含阵营标签（CAMPS 色）/ 中文名 / 英文名 / 首登场电影
- 点击角色卡展开：角色简介 note + 该角色出现作品列表（`filmsOfChar`，每片三态状态色 → `movie`）
- 全 Token：深色底 / 金色 section-label / 卡片 surface-2/3 / 状态三态色

### 全景 panorama（子页）
- 横+纵 `scroll-view` 包裹固定尺寸地图（设计坐标 ×0.6 缩放，总宽 2040px）
- 底层 `canvas 2d` 绘制连线：mainline 金 / support 蓝 / cross 紫 + 主线金色轨道
- 阶段列竖线 + 阶段名/年份（`PHASE_COLS`）
- 节点 `view` 绝对定位：阶段色字母方块 + 片名；mainline 金边高亮；upcoming 待映虚线半透明
- 点击节点 → `movie`（upcoming 待映不跳）
- 底部图例（主线/支线/跨宇宙）

### 浏览 browse（增强页）
- 头部标题「浏览全部」+ 副标
- 按阶段分组（phase 1–6 升序），每组：阶段色圆点 + 阶段名 + 部数
- 组内每片：阶段色字母方块 + 片名 + 英文名·阶段 + 三态状态色 → `movie`
- `onShow` 重装配，标记状态后返回实时刷新

---

## 四、状态测试

| 验证项 | 结果 |
|---|---|
| 全量 JS 语法校验（工程 27 文件） | 通过 |
| explore 角色装配 / 首登场片名 / 阵营色 | OK |
| explore 角色展开 → filmsOfChar + 三态 | OK |
| explore 全景入口 / 电影跳转 URL | OK |
| panorama 节点数=PANO_MOVIES(40) / 阶段=6 | OK |
| panorama iron-man 坐标(left48,top156) / main 标记 | OK |
| panorama upcoming 标记 / 普通跳转 / 待映不跳 | OK |
| browse 总数=59 / 阶段升序 / 组色 / 三态 / 跳转 | OK |

**逻辑自测 24/24 全通过**（mock `wx` 冒烟脚本，已清理临时文件）。

---

## 五、问题记录（待策划 AI 拍板）

1. **探索页定位**：D10-A 原型无此页独立整页稿，按「角色网格 + 全景入口」恢复（"关系探索"＝通过角色与全景理解作品关系）。若需增加「关系网可视化」或调整信息架构，请指示。
2. **全景图缩放系数**：当前 `SCALE=0.6`（总宽 2040px，横滚浏览）。如需更大更清晰可调大 SCALE（注意 canvas 像素上限与包体）；连线用 `canvas 2d`（微信不支持内联 SVG，技术必要）。
3. **待映卡片**：`avengers-5`（毁灭之日 2026）/ `avengers-6`（秘密战争 2027）按 PANO 占位渲染但点击不跳转（不在 CONTENT 单一源内）。
4. **浏览总数口径**：`browse` 总数 59 = CONTENT 全量（电影/剧集/特别呈现/短片）。若需改为「仅电影数」请告知（与 Step3-7-B 总作品数口径一致）。
5. **真机截图**：当前环境无 GUI 开发者工具，无法补拍；视觉严格按 D10-A 冻结稿移植（px×2=rpx、全 Token）。你现可在微信开发者工具点「探索」Tab 预览三页。

---

## 六、结论

Step3-7 阶段全部完成（A 路线详情 / B 我的MCU / C 探索·全景·浏览）。工程 8 页均已达可预览状态，剩余 **Step3-8 反馈与纠错（D10-B）** 待启动。
