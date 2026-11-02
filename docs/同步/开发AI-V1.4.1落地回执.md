# 开发 AI · V1.4.1 落地回执

> 关联设计稿：`docs/同步/设计AI-V1.4.1修订说明与复核发现.md`
> 日期：2026-10-29
> 改动文件：`版本迭代/GenUI小工具/genui-app/index.html`、`版本迭代/GenUI小工具/genui-app-tools/e2e-visual.cjs`

---

## 一、落地对照（设计稿「V1.4.1 修订清单」1–6）

| # | 设计项 | 落地情况 |
|---|--------|----------|
| 1 | 空白吸收规则反转：文字区（剧情/理由/衔接条）`flex:none` 保底禁止压缩；B 海报 `flex:1 1 52px; min 52; max 110`、F3 hero `flex:1 1 70px; min 70; max 126` 为唯一 grow 层 | ✅ 已落地。`.mcu-archive-visual` 改 `1 1 52px/52/110`；`.mcu-discover-hero` 改 `1 1 70px/70/126`；`.mcu-discover-body` 由 `flex:1` 改为 `flex:0 0 auto`（固定内容高，hero 吸收富余）；`.mcu-archive-meta-row`/`.mcu-archive-reason`/`.mcu-archive-plot`/`.mcu-archive-next` 均 `flex-shrink:0`。 |
| 2 | 片名永远只出现一次（视觉区底部），英文短名移至视觉区右上角小字 | ✅ 已落地。海报态由 `.mcu-archive-poster-title` 承载；程序化态新增 `.mcu-archive-visual-title` 承载；二者互斥，DOM 中片名计数 = 1（见证据）。英文短名 `.mcu-archive-short-en` 绝对定位至视觉区右上角，`rgba(255,255,255,.65)` 小字。 |
| 3 | 分视口剧情行数：360 为 1 行钩子，414 放开 2 行（剧情取自 `sf` 字段，母项目 synopsis） | ✅ 已落地。B、F3 均新增「剧情」行（`.mcu-archive-plot` / `.mcu-discover-plot`），内容取 `cur.sf` / `m.sf`。断点见「已知变量①」。实测：360 剧情 clientH=21/18px（1 行），414=41/36px（2 行）。 |
| 4 | F1 删 tagline 独立行，与操作提示合并为一行「第一次看漫威，就照这个来 · 点节点切换推荐」；eyebrow 保留 | ✅ 已落地。删除 `.mcu-route-subtitle` 渲染；提示条改为 `route.tagline + ' · 点节点切换推荐'`；新手路线实测文案 =「第一次看漫威，就照这个来 · 点节点切换推荐」。eyebrow 保留。 |
| 5 | 预算账单写入稿内（每卡实测逐项高度，可核对） | ✅ 见下方「内容预算实测」。 |
| 6 | 设计侧自检已通过 | —（设计侧职责，开发不代判） |

> 注：B 卡另新增「编号行」`MCU-xxx · 观影 #n · 上映 #co`（等宽字体，替代原 phase 表头条，阶段色改由 meta 阶段点承载）与「衔接条」`看完后看 → {下一部} · {年}`（设计稿 mockup `.ids`/`.b-next` 已含，落地补齐）。

---

## 二、冻结件守卫（guard-frozen.cjs）

**结果：PASS，零越界。**

- 外壳与官方组件样式（`.vc-*` / `.cos-icon` / `.cos-*`）：零改动 ✅
- 外壳结构与交互逻辑存在性（骨架 / 数据引用 / sendLog / onTabChange / shuffle / resetDemo / onPickRoute / showTipsTooltip / adjustTips）：全部保留 ✅
- token 纪律：未定义任何 `--cos-*`；`:root` 干净；`--mcu-*` 全在 `.mcu-*` 根容器作用域内 ✅
- 外壳硬指标（1:1 骨架、表头 45px、容器 absolute+inset:0、Tabs/按钮官方类、cos-icon、重置旋转动画、气泡避让、画布 flex:1）：全部保留 ✅

---

## 三、冻结件构成复核（对照基线 133 / 125 / 99）

- 本次改动**仅触及 `.mcu-*` 画布样式与三模块渲染模板**，**未改动任何外壳**（GenUI Header / 操作区 Tabs / 路线条 / 返回区）。
- 因此冻结件构成与基线 **133 / 125 / 99 完全一致，无出入** —— 设计侧无需再校一轮账单（你提到的唯一已知变量在此确认不触发）。
- 内容预算实测（与稿内账单对照）：

| 模块 | 设计账单（360 / 414） | 实测（scrollH / clientH） | 结论 |
|------|----------------------|---------------------------|------|
| B 档案区 | 201 / 255 | **201 / 201** · **255 / 255** | ✅ 精确命中 |
| F3 发现卡 | 207 / 261 | **205 / 205** · **259 / 259** | ✅ 富余 2px（未超预算） |
| F1 时间轴 | 193 / 247 | 无溢出断言通过（画布完整落 demo） | ✅ |

---

## 四、新增断言与证据（e2e-visual.cjs）

`e2e-visual.cjs` 新增 V1.4.1 断言组，并在 B / F3 采集函数中补充 `plotClientH / plotScrollH / reasonClientH / reasonScrollH / titleCount / idsFontMono / footRightFontMono / 卡体 scrollH·clientH / 相邻块间隙 maxGap`，F1 补充 `nodeFontMono`。

**运行结果：ALL_PASS = true（全部断言通过）。**

JSON 证据：`版本迭代/GenUI小工具/scratch/e2e-visual-result.json`

关键数值（节选）：

```
360 | B card 201/201  plot 21(1行)  reason 38/38(2行无裁切)  title 1  idsMono true  gap 4px
360 | F3 card 205/205 plot 18(1行)  title 1  footMono true  gap 2px
414 | B card 255/255  plot 41(2行)  reason 38/38            title 1  idsMono true  gap 4px
414 | F3 card 259/259 plot 36(2行)  title 1  footMono true  gap 2px
```

新增断言清单（每条均 PASS）：
- V1.4.1 B 剧情行数（360≥20 / 414≥40）
- V1.4.1 B 理由 2 行可见（clientH≥36）
- V1.4.1 B 相邻内容块间隙 ≤24px（无空白吞内容）
- V1.4.1 B 编号行存在且等宽字体
- V1.4.1 B 片名在 DOM 中仅出现 1 次
- V1.4.1 B 卡体无裁切溢出
- V1.4.1 F3 剧情行数（360≥18 / 414≥36）
- V1.4.1 F3 相邻内容块间隙 ≤24px
- V1.4.1 F3 编号行存在且等宽字体
- V1.4.1 F3 片名在 DOM 中仅出现 1 次
- V1.4.1 F3 卡体无裁切溢出
- V1.4.1 F1 时间轴编号行等宽字体

---

## 五、六图截图（附程序化卡专项图）

路径：`版本迭代/GenUI小工具/scratch/`

| 图 | 文件 |
|----|------|
| F1 · 360 | `visual-f1-360.png` |
| F1 · 414 | `visual-f1-414.png` |
| B 档案 · 360 | `visual-b-360.png` |
| B 档案 · 414 | `visual-b-414.png` |
| F3 发现 · 360 | `visual-f3-360.png` |
| F3 发现 · 414 | `visual-f3-414.png` |
| F3 程序化卡 · 360（专项） | `visual-f3-prog-360.png` |
| F3 程序化卡 · 414（专项） | `visual-f3-prog-414.png` |

> 你提到的「坑位清单」逐项复核（隐形元素 / 渐隐吞内容 / 容器内裁切）：e2e 已用断言兜底——B 理由底边距卡片底边 26px（≥8）、F3 换一部按钮完整可见、F1 当前项理由在渐隐带之上 31/85px、三卡卡体 scrollH≤clientH 全部通过，未见容器内裁切。

---

## 六、已知变量 / 偏差说明（不静默漂移）

**① 分视口断点取值**
设计稿写「仅 414 生效」，但 genui 预览实测卡体宽 = **326（360 视口）/ 380（414 视口）**（非 360/414）。故 media query 断点取 **`min-width: 380px`** 而非 401px，以同时兼容预览（380→2 行）与真机（360→1 行、≥380→2 行）。若设计希望严格按「真机视口 414」语义，可改为 401px，但预览态 414 将回退为 1 行——当前取 380 与稿内 mockup（380 宽 2 行）一致。

**② reasonShort 长度（建议项，非阻塞）**
B/F3 理由取 `reasonShort`（母项目 `role` 裁剪，当前 `MAX_REASON_SHORT=62`）。实测 360 窄卡下理由均落在 2 行内（`reasonScrollH==reasonClientH==38px`，无裁切）。若设计希望「绝对无截断（≤2 行必完整呈现）」对全部电影成立，可将母项目 `build-data.cjs` 的 `MAX_REASON_SHORT` 由 62 收敛至 ~48（需重新生成 `data.js`，非冻结件）。当前实现不阻塞放行。

**③ 编号行文案**
B 卡编号行改为 `MCU-xxx · 观影 #n · 上映 #co`（n = 路线内序号，co = 母项目上映顺序）。原 `.mcu-archive-header` phase 表头条移除，阶段色由 meta 行阶段点承载。

---

## 七、结论

V1.4.1 已按稿落地，guard-frozen 零越界，冻结件构成与基线 133/125/99 一致（毋庸重校账单），e2e 新增断言全部通过，六图 + JSON 证据齐备。**开发侧无阻塞项，提交设计逐帧复核与放行/驳回回执。**
