# MCU Atlas 目录架构与文件归位治理报告（修订 V1.1.1）

> 执行方：WorkBuddy（项目管理/文档管理 AI） ｜ 项目负责人：彦祖 ｜ 修订日期：2026-10-15
> 依据：《全项目目录架构与文件归位治理 V1.1》＋ 彦祖验收意见（暂不批准第一批移动/删除）
> 本轮性质：**只读核验 + 架构修订 + 落盘规范修订 + 执行建议清单**。**未执行任何文件移动/删除/重命名，未修改 .gitignore、代码或凭据**。

## 0. 关联文件索引

| 类别 | 绝对路径 |
|---|---|
| 本修订报告 | `D:/SEO/发挥余热/漫威电影宇宙导航/docs/技术/MCU目录架构与归位治理报告.md` |
| 精简执行建议清单 | `D:/SEO/发挥余热/漫威电影宇宙导航/docs/技术/MCU目录架构与归位治理-执行建议清单.txt` |
| 被核查·README/项目总览/VERSION | `漫威电影宇宙导航/README.md` `MCU项目总览.md` `VERSION.md` |
| 被核查·.gitignore | `漫威电影宇宙导航/.gitignore` |
| 实测证据脚本 | `C:/Users/Administrator/AppData/Local/Temp/mcu_verify.py`（.trae zip 比对 / design 重叠 / 空目录） |
| genui-app 验收报告 | `漫威电影宇宙导航/同步/GenUI发布上传包验收报告.md` |
| 小红书小工具定义 | `漫威电影宇宙导航/小红书小工具/README.md` `项目说明.md` |
| 敏感资产索引 | `D:/SEO/发挥余热/00_项目总览/敏感资产索引.md` |

---

## 1. 修订说明

原 V1.1 报告整体方向获认可，但彦祖指出：第一批移动/删除暂不批准，且 6 个方面需有依据补齐核验。本轮据此重做针对性只读核验（**未重扫全库、未重复清单**），并作如下关键修正：

| 原 V1.1 判断 | 本轮核验后修正 |
|---|---|
| `genui-app*` / `小红书小工具` ＝「独立子项目，建议迁 `tools/`」 | 二者均为 **MCU Atlas 家族的平台交付物/衍生子项目**（百度 GenUI 小工具、小红书小工具），应作为**一等目录保留**，不应塞入 `tools/` 或迁出 |
| `.trae-html-share-packages/`（≈68MB）＝「可删重复导出」 | 确为 Trae「导出分享」冗余副本、已 gitignore、无工具依赖；但**无法证明每 entry 可安全替代**（可能含历史快照）→ **保留（C）** |
| 根 5 空目录＝「可删」 | 确为空且未被引用（流水线用 `workspace/news/pipeline/*` 同名目录）；但**删除无实际收益** → **保留（C）** |
| `design/` 与 `AI生成文件/设计/`＝「双存放重叠」 | 实测**同名重叠 = 0**，二者互补（定稿 vs 原始产出），**非重复** |
| `scratch/` 日志＝「可删临时」 | `scratch/e2e-visual-result.json` 被 `genui-app-tools/verify-v11.cjs` **引用** → 整目录为 GenUI 验证工作目录，**保留（C）** |
| 拟在 `.gitignore` 增 `genui-app*`/`generated-images/`/`小红书小工具/`/空目录 | 多数属「归属」问题非「跟踪」问题，**撤回**（见 §6） |

**结论导向**：本轮核心价值是建立稳定架构与 AI 落盘规则以**降低未来混乱**，而非最大化本次移动/删除数量。除 2 张误置根 PNG 外，无高确定性、高收益的清理项。

---

## 2. 阶段 A · 修订后现状结论

### 2.1 文档漂移（保留原结论）
README §3 / 项目总览 §3 / `07_AI协作记录/` 称同步在 `docs/同步/`，但**实际 `docs/同步/` 不存在，真实同步在根 `同步/`**；`07_AI协作记录/AI协作角色说明.md` 已自注「2026-10-08 废弃」；`release/` 经 Glob 为空/不存在。验收后做最小化文档修正（不改文件本轮）。

### 2.2 根目录「污染」修正
`genui-app/`、`genui-app-tools/`、`genui-app.zip`、`generated-images/` 与 `小红书小工具/` **不是外部污染**，而是 MCU Atlas 家族的**其他平台交付物/衍生子项目**：
- `genui-app/index.html` + `genui-app.zip` 是**百度 GenUI 平台小工具「MCU 观影助手」产物**（有上传包验收报告）；`genui-app-tools/` 是其开发侧工具（报告明确「不随产物提交」）；`data.js` 由 `h5/data` 单一源重建。
- `小红书小工具/` 自述「母项目 MCU Atlas」，是小红书平台纯本地 Web 小工具，含完整项目文档（产品方案/开发计划/设计规范/决策记录/TASK）。
- 二者与 `wechat/douyin/h5` 并列**合理**，应作为一等目录保留（可选重命名求一致，见 §3）。

### 2.3 工具缓存 / 导出（保留）
`.trae-html-share-packages/`（≈11 个 zip：5 个完整 H5 站点导出 + 设计稿/doc 导出包）：实测 H5 导出内 forum 页与 `h5/` 一致、设计/doc 导出内容在 `design/ AI生成文件/ docs/` 另有正本；**属冗余但不可证安全删**（或含历史快照）、已 gitignore、**无构建/部署依赖** → **保留（C）**。
`.loomy-attachments/`（设计 AI 附件缓存）、`.skill/`（技能包）、`.codebuddy/`、`.screenshots/`：工具基础设施/缓存，多已 gitignore 或工具依赖 → **保留（C）**。

### 2.4 设计资产双存放（修正为合理）
`design/`（131 文件＝定稿/采用）与 `AI生成文件/设计/`（22 文件＝原始 AI 产出）**同名重叠 0**，互补非重复。边界合理：**`AI生成文件/设计/`＝原始产出收件箱；`design/`＝人工筛选定稿**。无需合并；仅须在落盘规范明确分工。

### 2.5 根空目录（保留）
`candidates/ captures/ deliveries/ runHistory/ status/` 均 0 项、未被任何脚本/约定引用（N1 流水线用 `workspace/news/pipeline/candidates|deliveries|run-history` 等不同路径）。删除无实际收益 → **保留（C）**。

### 2.6 `scratch/`（保留）
含 GenUI 预览日志、`genui-*.png` 验证截图、`mcu-design-rules.css`，且 `genui-app-tools/verify-v11.cjs` 读取 `scratch/e2e-visual-result.json` → 为 GenUI 验证工作目录 → **保留（C）**。

### 2.7 源代码纯净（保持）
`wechat/ douyin/ h5/ shared/` 结构纯净，未见 PM 文档/设计稿混入；`shared/data` 单一可信源未受污染。

---

## 3. 阶段 B · 目标目录架构（修订）

> 最小调整、复用既有、不拆工程、不碰运行路径。方括号 `[]` 为可选。

```
MCU Atlas 根/
├── README.md VERSION.md MCU项目总览.md project.json .gitignore .env.example   # 入口(保留)
├── wechat/ douyin/ h5/ shared/        # 三端源码 + 单一数据源(保留·禁改结构)
├── genui/  [更名自 genui-app/]        # 百度 GenUI 平台小工具产物(一等目录)
│   └── tools/  [更名自 genui-app-tools/]   #   其开发侧工具(不随产物提交)
│   genui-app.zip  [→ genui/ 上传包或 release/]
│   generated-images/  [→ 归 AI生成文件/设计/ 或 design/]
├── xhs/  [更名自 小红书小工具/]         # MCU 衍生·小红书平台小工具(一等子项目)
├── workspace/                         # 开发/部署/验证工具(保留，内部不强制分层)
│   ├── deploy/ forum-api/ news/        #   稳定子系统
│   └── (瞬时产物已由 .gitignore 覆盖，保持原位即可)
├── docs/ 产品/外宣物料/技术/版本/       # 当前有效文档(保留；本治理报告在 技术/)
├── design/                            # 定稿设计(保留·本地 gitignore)
├── AI生成文件/                        # 原始 AI 产出收件箱 + 凭据(保留)
│   ├── H5/  (MCU.pem/pub + 各专题报告) #   凭据禁动
│   └── 设计/                           #   原始 AI 设计产出(待筛选后进 design/)
├── 同步/                              # 三角色协作枢纽(保留·真实位置在根)
├── archive/  [release/]               # 历史归档/正式交付(保留)
└── 隐藏工具目录(保留·gitignore 或工具依赖): .workbuddy/ .codebuddy/ .skill/ .loomy-attachments/ .screenshots/ .trae-html-share-packages/
```

**关键决策（待彦祖拍板，非默认执行）**
- **D1 平台目录命名**：`genui-app/`→`genui/`、`genui-app-tools/`→`genui/tools/`、`小红书小工具/`→`xhs/` 仅为命名一致，**非必需**；若移动须同步更新 `同步/GenUI*` 报告与 `genui-app-tools/*.cjs` 内的相对路径引用（如 `genui-app/index.html`、`scratch/e2e-visual-result.json`）。亦可保持原名。
- **D2 设计边界**：明确 `AI生成文件/设计/`＝原始收件箱、`design/`＝定稿；新增 AI 设计产出落前者，定稿筛入后者（实测无重叠，无需迁搬）。
- **D3 源码零改动**：`wechat/douyin/h5/shared` 结构与运行路径不动；`workspace/` 不强制「稳定/瞬时」物理分层（gitignore 已覆盖瞬时部分）。

---

## 4. 阶段 C · AI 文件落盘规范（修订，覆盖 7 焦点）

> 约束：WorkBuddy / CodeBuddy / 设计 AI（LOOMY/豆包）/ GenUI 等工具。

1. **根目录仅作入口**：只保留 README/VERSION/MCU项目总览/project.json/.gitignore/.env.example 及既定隐藏工具目录；图片/设计稿/HTML/报告/日志**不得**落根。
2. **源码与 PM 分离**：`wechat/douyin/h5/shared` 不得混入 PM 文档、设计过程稿、临时产物；测试/验证产物留 `workspace/`（已被 gitignore 覆盖）。
3. **PM 资料统一归档**：产品/技术/版本/外宣入 `docs/` 对应子目录；协作枢纽入根 `同步/`（非 `docs/同步/`）。
4. **三角色协作独立**：`同步/给策划|给开发|给设计/` 三通道分离；设计 AI 产出先入 `AI生成文件/设计/` 或 `同步/给设计/`，不直接改源码。
5. **资产分类归属**：原始 AI 生成 → `AI生成文件/设计/`；正式定稿 → `design/`；临时/验证产物 → `workspace/`（gitignore）；正式交付/上传包 → `release/` 或平台目录；历史 → `archive/`。
6. **专项目录判断**：属 MCU Atlas 家族的其他平台交付物（如 genui/xhs）作为一等目录保留；确属独立产品线再评估迁 发挥余热根级独立项目——**不因"像子项目"就强迁 `tools/`**。
7. **归属不明先暂存登记**：不确定不得落根、不得擅移已有文件；放入 `workspace/_待归位/` 并登记「路径+建议归属」，待彦祖裁定。
8. **优先既有目录**：新建文件优先落入既有区，不新建平行目录。
9. **交付列路径**：正式交付列出新增/修改文件绝对路径与扩展名。
10. **结束前自检**：任务收尾检查本次新增文件是否符合上述规则。
11. **发现他人乱放先登记**：不自行扩大移动范围。
12. **不覆盖/不删/不擅改名他人成果**；保持运行有效，不修改代码路径/运行配置/Git 结构。

---

## 5. 阶段 D · 归位清单（A/B/C/D 修订）

> 本轮 **A 类极小**（仅 2 张根 PNG）；其余多为 **C 保留**。**所有 A 项仍须彦祖逐项显式授权，不自动视为已批准。**

### A 类 · 可进入低风险候选（须 PM 逐项授权）
| 当前路径 | 目标/动作 | 依赖核验 | 风险 | 收益 |
|---|---|---|---|---|
| 根 `最终版-分享卡片-移动端.png` | 迁 `design/H5/` 或 `design/其他/` | grep 确认无引用 | 低 | 中（根治 2 个根级噪音） |
| 根 `最终版-首页-移动端.png` | 同上 | 同上 | 低 | 中 |

### B 类 · 需核验/裁定（不移动）
| 当前路径 | 建议 | 依赖核验 | 风险 |
|---|---|---|---|
| `genui-app/` `genui-app-tools/` `genui-app.zip` `generated-images/` | 保留为 MCU 家族一等平台目录（命名 D1 待拍板） | 移动须改 `同步/GenUI*` 报告与 `genui-app-tools/*.cjs` 相对路径 | 中 |
| `小红书小工具/` | 保留为 MCU 衍生子项目（可重命名 `xhs/`） | 命名决策；无引用冲突 | 低-中 |
| `.trae-html-share-packages/` | 保留；未来若删须逐 zip 比对每 entry 有版本可控副本 | 内容安全未证 | 低（已 gitignore、无依赖） |
| `scratch/` | 保留（GenUI 验证工作目录，含被引用 result.json） | 删其中文件前确认无引用 | 低 |
| `design/` vs `AI生成文件/设计/` | 保留双存（互补非重复） | 可选 MD5 复核 | 无 |

### C 类 · 继续保留，暂不处理
- 根空目录 `candidates/ captures/ deliveries/ runHistory/ status/`（空、未引用、删无收益）
- `.loomy-attachments/` `.codebuddy/` `.screenshots/` `.skill/`（工具基础设施/缓存）
- `07_AI协作记录/`（历史留痕，自注废弃，无现行约束；可选日后归档）
- `workspace/` 全部瞬时产物与子系统（证据/子系统，gitignore 已覆盖瞬时部分）
- `AI生成文件/H5/` 各专题报告（AI 产出收件箱）

### D 类 · 高风险，禁止未经专项授权处理
- `AI生成文件/H5/MCU.pem` `MCU.pub`；`workspace/deploy/cert-mcuatlas/fullchain.pem` `privkey.key`（凭据，敏感资产登记第1/5/6项，禁动）
- `wechat/ douyin/ h5/ shared/` 源码与 `shared/data/*.js` `h5/data/*.js` 单一可信源（结构/路径零改动）
- `release/`（若含上传包等正式交付物，禁动）

---

## 6. `.gitignore` 拟增规则审查（本轮不修改）

逐条审查原拟增规则，**撤回与"归属"混淆的条目**，仅缓存/临时类已由现有规则覆盖：

| 原拟增规则 | 审查结论 | 理由 |
|---|---|---|
| `genui-app*` | **撤回** | `genui-app` 是平台交付物（产物应提交）；`genui-app-tools` 本就「不随产物提交」靠约定；忽略会丢未提交工作。归属由治理规则管，非 gitignore |
| `generated-images/` | **撤回** | 单张 AI 产出图，可能留作资产；归 `AI生成文件/设计/` 或 `design/`，不忽略 |
| `scratch/` | **撤回** | 含被引用的 `e2e-visual-result.json` 与设计规则 css；整体忽略会藏有效文件；日志已受 `*.log` 覆盖 |
| `小红书小工具/` | **撤回** | 真实子项目，应纳入版本管理（提交），绝不忽略 |
| 根 `candidates/ deliveries/ runHistory/ status/` | **撤回** | 空目录 git 本不跟踪，忽略无意义；且与 `workspace/news/pipeline/*` 同名易混淆 |
| （保留既有）`.trae-html-share-packages/` `.loomy-attachments/` `.skill/` `*.pem/*.key` `AI生成文件/` `archive/` `release/` `design/` `*.log` `workspace/**/out-*.txt` 等 | **维持** | 确属缓存/临时/凭据/本地资产，忽略合理 |

**区分原则**：目录"不应出现在根"由**文件治理规则/落盘规范**解决；"是否纳入版本库"由**版本管理规则（.gitignore）**解决。二者不混为一谈。

---

## 7. 精简执行建议清单

> 详见同目录 `-执行建议清单.txt`。每项含：当前路径 / 目标或保留 / 原因 / 依赖核验 / 风险 / 需 PM 确认 / 实际收益。A 类仍须逐项授权，不等于已批准。

---

## 8. 红线声明（本轮零变更）

- **未执行任何删除、移动、重命名、覆盖**；仅新建/修订本报告与清单（交付物），读取既有文件。
- 未修改代码、运行配置、`.gitignore`、部署结构、文件权限。
- 未读取/输出/移动/修改 `.pem/.key/.env` 等凭据；敏感资产维持原状与登记。
- 所有 A 类清理、B/C/D 类裁定均**待彦祖显式验收与逐项授权**；本 AI 不自行开始归位。

**最终原则复诵**：先建立稳定的目录架构与 AI 落盘规则，再处理确实有价值的存量归位；目标是降低未来混乱，而非最大化本次文件移动或删除数量。
