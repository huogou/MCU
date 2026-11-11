# MCU Atlas CMS V1.0 · 架构修订报告 V2.0

> ⚠ **本文有两处以《MCU-Atlas-CMS-V1.0-最终架构定案-V2.1.md》为准（2026-11-09）**：
> ① **§4 发布权限（sudo 方案）作废** —— `NoNewPrivileges=yes` 会使 sudo 失效，改由 root 拥有的 systemd `.path` 单元监听 spool；
> ② **§6.3 内存阈值算术修正** —— `146−60=86 MB` 是「CMS 常驻 + 构建峰值」之和，不是构建单独上限。
> 其余章节仍有效；冲突时一律以 V2.1 为准。

| 项 | 值 |
|---|---|
| 文档版本 | **V2.0（架构修订 · 开发前）** |
| 修订日期 | 2026-11-09 |
| 执行方 | CodeBuddy（开发 AI） |
| 上游依据 | 《MCU Atlas CMS V1.0 开发前架构核查报告》V1.0（`docs/技术/MCU-Atlas-CMS-V1.0-开发前架构核查报告.md`） |
| 本轮性质 | **架构修订 + 技术方案复核 + 范围收敛**。不写代码、不建库、不建用户、不建服务、不改 Nginx / robots / Sitemap 生成器 / 现有 H5 / Forum API / 资讯流水线 / 小程序 / shared 数据，不做 Git 操作 |
| 本轮新增只读核查 | 文件系统设备号、`disable_symlinks`、`sudo` 版本、工具可用性；OpenAI / Google / Anthropic / Perplexity 官方爬虫文档（用于 robots 分组） |
| 证据等级 | **【核实】**=已看到的事实；**【方案】**=本报告给出的技术设计，未实现；**【推导】**=基于事实的推理结论；**【待验证】**=必须真实运行/授权才能确认 |

---

## 0. 修订结论摘要

### 0.1 六个 P0 问题的处置一览

| 编号 | 原方案的矛盾 | 处置结论 | 章节 |
|---|---|---|---|
| **P0-1** | 一边要求「文章页 `<script>` = 0」，一边要求输出 JSON-LD（JSON-LD 本身就是 `<script type="application/ld+json">`），验收规则自相矛盾 | **重定义脚本分类**：把 `<script>` 分为「可执行脚本」与「数据块」两类，分别校验。文章页**可执行脚本 = 0**，**JSON-LD 数据块 ≥ 2（Article + BreadcrumbList）且必须可解析** | §2 |
| **P0-2** | 冻结集包含 `sitemap.xml`，但正常发布必须改 `sitemap.xml`，必然自撞 | **文件四级分类**：完全冻结集（不含 sitemap）/ 受控变化集（sitemap）/ 授权修改工具（生成器）/ CMS 产物集。sitemap 独立校验，不进冻结集 | §3 |
| **P0-3** | 用 `chmod 4750`（setuid）跑 Shell 脚本，等于给 CMS 开 root 后门 | **废弃 setuid**。改为「无参数 + 固定 spool 目录 + root 一次性助手 + sudoers 精确授权」，助手自行校验、自己算哈希、只做两次 `rename` | §4 |
| **P0-4** | 把「软链 rename 原子」当成「整个发布原子」 | **重新定义 9 阶段状态机 + 写前意图记录 + 对账式恢复**。明确只有 2 个操作原子，其余靠补偿；崩溃后以**文件系统实际状态**为准反推 DB 状态 | §5 |
| **P0-5** | 用 `MemoryMax=192M` 当资源充足的证明 | **不承认任何配置值等于资源充足**。给出 5 项可执行测量 + 阈值 + 失败后的 4 条降级路线（含本地构建），并加 `OOMScoreAdjust` 保护现有服务 | §6 |
| **P0-6** | 承诺 Markdown 兼容性，实际靠字符串替换 | **明确选「严格受限自研解析器」**，给出语法白名单、转义规则、URL 策略、40 条 XSS/回归用例、不支持清单、以及失败后的降级切换条件 | §7 |

### 0.2 是否建议进入 V1 开发

**结论：有条件建议进入，但不建议"现在立刻进入"。**

| 判断 | 内容 |
|---|---|
| 架构方向 | ✅ 维持不变（Node + SQLite + 独立服务 + SSH 隧道 + 静态生成 + release 回滚 + 数据只读） |
| 技术矛盾 | ✅ 本轮已消除 6 个 P0 + 9 个次级问题（清单见附录 A） |
| 可开发性 | ✅ 技术路径全部有本机先例（Forum API 已生产运行同栈） |
| **可否立即开工** | ❌ **不建议**。需先过 3 个前置门（§22）：G1 证书、G2 内存实测、G3 发布权限方案获批 |
| 前置门耗时 | 约 2–3 人日（G1/G2/G3 可与 M0 并行，但 G3 未批则 M6 不能开工） |
| 预计工作量 | **32 人日**（±4），见 §19 |

### 0.3 当前服务器是否具备上线条件

| 维度 | 结论 | 依据 |
|---|---|---|
| **部署可行性** | ✅ **具备**。零 npm 依赖、同栈先例、同文件系统可原子 rename、无 `disable_symlinks`、sudo/flock/sha256sum/curl 齐备 | 【核实】§6.1、§4.2 |
| **上线验收条件** | ❌ **不具备**（3 项硬缺口） | ① 内存**从未实测**过构建峰值（146 MiB 可用只是快照）；② 证书 35 天后到期且未纳入自动续签；③ root 发布权限机制尚未获批落地 |

---

## 1. 修订方法与「保留 / 修改」清单

### 1.1 修订原则

1. **只改矛盾，不推翻方向**。原报告的 9 条合理内核全部保留（见 1.2）。
2. **每个修正必须给出可执行判据**，不能停留在"要注意"。
3. **承认边界**：能原子就原子，不能原子就明确写"靠补偿 + 对账"，不美化。
4. **区分事实与设计**：凡是没跑过的，一律标【待验证】，不写成"已通过"。

### 1.2 原样保留的部分（及保留理由）

| 保留项 | 理由 |
|---|---|
| Node.js 24 + `node:sqlite`(WAL) 技术路线 | 本机 Forum API 已生产运行 1 月 24 天，RSS 12.7 MB，零 npm 依赖 | 
| CMS 独立服务，与 Forum API 分离 | 职责/权限/故障域三重隔离（原报告 §5.4 论证仍成立） |
| SSH 隧道访问后台 | 零 Nginx 改动、零公网暴露，是当前最省的方案 |
| Markdown 编辑 + 构建期静态 HTML | 正文进源码的唯一低成本路径 |
| 正文直接存在 HTML 源码 | GEO/SEO 的前提，且可被 `grep` 判定 |
| release 版本管理 + 回滚 | 已升级为状态机（§5），机制保留 |
| Sitemap 单一写入者 | 保留，只重划边界（§3.3） |
| 现有作品/人物/路线数据只读关联 | 治理铁律：数据单一源、不得丢入 CMS 让用户自改 |
| 资讯采集与审核流水线独立 | 不得出现第二个 `news.js` 写入点 |
| 微信/抖音小程序不纳入 | 跨端同步脚本不覆盖 H5，任何介入都会制造第 4 份数据 |

### 1.3 本轮修改的部分

| 修改项 | 原方案 | 修订后 | 章节 |
|---|---|---|---|
| 脚本校验 | `<script>` 计数 = 0 | 分类校验（可执行 0 / 数据块 ≥1） | §2 |
| 冻结集 | 含 `sitemap.xml` | 四级分类，sitemap 移出冻结集 | §3 |
| 发布权限 | setuid 4750 脚本 | sudo + 无参助手 + spool 目录 | §4 |
| 发布原子性 | 软链 = 原子 | 9 阶段状态机 + 对账恢复 | §5 |
| 内存验收 | 配置即证明 | 5 项实测 + 阈值 + 降级路线 | §6 |
| Markdown | 自研（未定语法边界） | 严格受限文法 + 40 用例 + 降级条件 | §7 |
| 分页 | `?page=n`（无静态文件） | 构建期真实分页文件 + 目录/文件冲突修正 | §10 |
| URL 结构 | `/article/c/<cat>` 平铺 | 目录式（`c/<cat>/index.html`）避免 `try_files` 撞目录 | §9.3 |
| 修订表 | 只存 title/body/meta | 全字段 + 关联快照（`snapshot_json`） | §13.2 |
| GEO | 12 条规则 + 分数 | 改为「内容质量检查」5 类 3 级，去评分化 | §14 |
| robots | 一组通配 + 简单分组 | 按官方文档分组，且每组重复声明限制 | §11 |
| 媒体 | 全量媒体库 | V1 最小可用 + 完整库延后 | §12、§18 |
| 备份 | 选做 | 强制项 + 引用完整性校验 + 恢复脚本 | §13.5 |

---

## 2. P0-1：JSON-LD 与脚本校验规则（冲突消除）

### 2.1 矛盾定位

原报告两处规则互斥：
- §9.4-#12：「文章页 `<script>` 数量 = 0」；
- §10-#13：「输出 `Article`/`NewsArticle`/`BreadcrumbList` JSON-LD」。

JSON-LD 的标准写法就是 `<script type="application/ld+json">…</script>`。按原规则，只要输出 JSON-LD 就必然违反脚本规则。**这是验收层的硬冲突，不修则 V1 无法通过自检。**

### 2.2 修订：脚本三分类

| 类别 | 判据（HTML 属性） | 是否可执行 | 文章页允许数 | 校验方式 |
|---|---|---|---|---|
| **A. 可执行脚本** | `<script>` 无 `type`、或 `type="text/javascript"`、`type="module"`、`type="application/javascript"` | 是 | **0（硬性）** | 计数必须为 0；存在即失败 |
| **B. 结构化数据块** | `type="application/ld+json"` | **否**（浏览器不执行） | **≥1（至少 Article + BreadcrumbList）** | 逐个 `JSON.parse` + 必填字段断言 |
| **C. 其他数据块** | `type="application/json"`、`type="importmap"`、`type="speculationrules"` | 否 / 非正文渲染 | **0**（V1 不允许，避免歧义） | 计数必须为 0 |

### 2.3 修订后的验收判据（可执行）

```
1) 解析文章 HTML，收集全部 <script ...> 开始标签及其 type 属性
2) 统计 nExec = count(type 缺失 或 type ∈ {text/javascript, module, application/javascript})
3) 统计 nLd   = count(type == application/ld+json)
4) 统计 nOther= count(type ∉ 上述两类)
5) 断言 nExec == 0        // 禁止任何可执行脚本
6) 断言 nLd   >= 2        // Article(或 NewsArticle) + BreadcrumbList
7) 断言 nOther== 0
8) 对每个 ld+json 块：
   - JSON.parse 必须成功
   - @context == "https://schema.org"
   - @type ∈ 白名单 {Article, NewsArticle, BreadcrumbList, WebSite, Organization, Person}
   - 必填字段齐全（Article: headline/datePublished/dateModified/author/mainEntityOfPage/image）
   - 所有 url/@id 必须 https://www.mcuatlas.xyz 前缀（禁止相对、禁止外域冒充）
9) 断言不存在内联事件属性：/on[a-z]+\s*=/i 命中数 == 0
10) 断言不存在 javascript: / data:text/html 协议链接
```

### 2.4 防误判的实现要求

1. **校验器必须按 `type` 分类，不得按"出现 `<script` 字样"一票否决。**
2. **不得用正则"数 `<script` 个数"代替解析**：`<script` 可能出现在正文代码块里（`&lt;script&gt;` 转义后是安全的，但若正文含未转义的 `<script`，说明渲染器有 bug，应单独报错）。
   → 判定顺序：先检查正文区（`<article>` 内）是否存在**任何** `<script`（包括转义失误），再检查 `<head>` 与页脚区的合法数据块。
3. **JSON-LD 生成器必须做转义**：JSON 内的字符串统一把 `<` 输出为 `\u003c`、`>` 输出为 `\u003e`、`&` 输出为 `\u0026`，防止 `</script>` 提前闭合造成 XSS 或截断。这是 JSON-LD 唯一的注入面，必须写进生成器而不是靠校验兜底。
4. **统计脚本**：V1 **文章页不引入任何统计脚本**（H5 现有 CloudBase 埋点只覆盖 `app.js` 管辖的页面）。若后续要加，必须走"外链 + `defer` + 白名单域名"三条同时满足，并在验收表里登记例外编号——默认禁止。

### 2.5 静态 HTML / JSON-LD / 脚本安全三者如何同时成立

| 目标 | 成立方式 |
|---|---|
| 正文在源码 | 构建期渲染成 HTML 文本节点，不依赖任何脚本 |
| JSON-LD 存在 | 作为**数据块**存在，浏览器不执行，抓取器可读 |
| 脚本安全 | 可执行脚本数 = 0；正文禁用原始 HTML；JSON-LD 做 `\u003c` 转义；CSP 仍作为第二道防线（`default-src 'none'` 仅放行同域 CSS/图片） |

> 补充：CSP 需要响应头，而静态文件由 Nginx 直出，**V1 无法给文章页加响应头**（Nginx 冻结）。因此 CSP 只能作为"未来 nginx 授权变更"的加分项，不能计入 V1 验收。V1 的 XSS 防线是「渲染器转义 + 脚本计数 0 + 无原始 HTML」三道，**这一限制必须写进验收说明，不能假装有 CSP**。

---

## 3. P0-2：冻结集与 Sitemap 校验（冲突消除）

### 3.1 矛盾定位

原报告 §9.5 把 `h5/sitemap.xml` 放进「冻结集」，要求发布前后 sha256 不变；而 §9.6/§9.4-#14 又要求每次发布更新 sitemap 且"只增不减"。**同一份文件既不许变又必须变。**

### 3.2 修订：文件四级分类（这是唯一的权威口径）

| 级别 | 集合内容 | 允许变化 | 校验方式 | 违规处置 |
|---|---|---|---|---|
| **F1 完全冻结** | ① `h5/*.html` 15 个 ② `h5/data/*.js` 15 个 ③ `h5/assets/js/*.js` 3 个 ④ `h5/assets/css/*.css` 5 个（共 38 个文件） | **永不允许** | 发布前写 `baseline.json`（逐文件 sha256），发布后逐文件重算比对 | 任一不一致 → 发布**立即失败** + 自动回切 + 告警；且记入审计（含差异文件名） |
| **F2 受控变化** | `h5/sitemap.xml` | **允许，但受规则约束** | 独立校验器（见 3.4），与 F1 无关 | 校验失败 → sitemap 不更新（回退到上一版），文章仍可上线（见 §5 阶段划分） |
| **F3 授权修改工具** | `h5/tools/generate-sitemap.cjs` | **一次性、授权、留痕** | 修改前后 sha256 写入 `docs/技术/tool-change-log.md` + release 记录；`--check` 必须仍通过 | 未登记即视为 F1 违规 |
| **F4 CMS 产物** | `h5/article/**`（软链）、`h5/media/**`（软链） | 每次发布整体替换 | release manifest 内逐文件 sha256 | 由构建器自身保证 |

**关键点**：F1 与 F2 **不再共用一个校验器**。原方案把两类混在一张清单里，是冲突的根源。

### 3.3 Sitemap 单一所有者（保留原则，明确流程）

**唯一写入者**：`h5/tools/generate-sitemap.cjs`（授权扩展后）。
**CMS 永不直接写 `h5/sitemap.xml`。**

```
CMS（mcucms 用户）
  1. 生成 releases/<seq>/sitemap-urls.txt        ← 仅文章/分类/索引 URL 清单
  2. 调用  node h5/tools/generate-sitemap.cjs --extra <该文件> --out releases/<seq>/sitemap.xml
     （工具读 h5/data 得到 76 条基础 URL，合并 extra，输出到 CMS 自己的目录）
  3. 发布助手（root）校验该文件 → rename 到 h5/sitemap.xml
```

工具唯一改动（授权项，约 30 行）：
| 新增参数 | 语义 | 默认 |
|---|---|---|
| `--extra <file>` | 追加 URL 清单（每行一个绝对 URL） | 无（行为不变） |
| `--out <path>` | 输出路径 | `h5/sitemap.xml`（行为不变） |
| `--expect-min <n>` | 若合并后 URL 数 < n 则拒绝 | 无 |

`--check` 语义保持不变（离线校验基础 URL 与数据一致），**并有回归测试证明未破坏**（用现有 `sitemap.xml` 跑 `--check` 必须仍 PASS）。

### 3.4 Sitemap 独立校验规则（发布链路内，root 助手再做一遍）

| # | 规则 | 失败后果 |
|---|---|---|
| S1 | 文件存在、≤ 5 MB、`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">` 为根元素 | 拒绝切换 sitemap |
| S2 | `<loc>` 数 ≥ **上一版 sitemap 的 loc 数**（除非 release manifest 显式列出 `removed_urls`，且每条都能在 `cms_redirects`/下架记录中对应） | 拒绝 |
| S3 | 每条 loc 必须是 `https://www.mcuatlas.xyz/` 前缀、必须无 `..`、无查询参数（除已登记）、必须是**无扩展名形式**（文章/分类），基础页保持原样（`/movie.html?id=` 这类历史形式不改） | 拒绝 |
| S4 | 新增 loc 必须全部命中 `sitemap-urls.txt`（不得出现来源不明的 URL） | 拒绝 |
| S5 | 不得有重复 loc | 拒绝 |
| S6 | 与上一版 diff 必须写入 `cms_releases.sitemap_diff_json` | 记录 |

> **注意 S3 与历史 URL 的冲突**：现有 76 条里有 `movie.html?id=xxx`、`route-detail.html?id=xxx`、`special.html?id=xxx`。这些是**历史规范形式**，V1 不改也不动（改了会动收录）。规则 S3 的"无扩展名要求"**只约束新增的 `/article/...` 条目**，历史条目原样保留。这一点必须在工具实现里按前缀分流，否则会误杀。

---

## 4. P0-3：发布权限重新设计（废弃 setuid）

### 4.1 原方案为什么必须废弃

原报告 §13.5：
```bash
chown root:root /usr/local/bin/mcu-cms-switch && chmod 4750 /usr/local/bin/mcu-cms-switch
```
问题有三：
1. **setuid shell script 在 Linux 上默认无效**（内核忽略脚本的 setuid 位），要么改成二进制，要么换成能用的机制——原方案本身不可实现。
2. 即便可用，setuid 意味着**进程以 root 身份继承 CMS 的整个环境**（环境变量、cwd、umask、ulimit 全由非特权方控制），是经典的提权面。
3. 与 `NoNewPrivileges=true` **直接冲突**：systemd 的 `NoNewPrivileges` 会阻止任何提权，包括 setuid —— 两个设计互斥。

### 4.2 修订方案 A（推荐）：sudo + 无参助手 + 固定 spool 目录

#### 4.2.1 角色与权限

| 主体 | 身份 | 能做什么 | 不能做什么 |
|---|---|---|---|
| `mcu-cms.service` | `mcucms`（普通用户，`/sbin/nologin`） | 读写 `/www/wwwroot/mcu-cms/**`；读 `h5/data`、`h5/tools`；写 spool 请求文件 | **不能写** `h5/*.html`、`h5/data/*.js`、`h5/sitemap.xml`、`h5/article`、`h5/media` |
| `/usr/local/sbin/mcu-cms-publish` | `root:root` `0755`，**不接受任何命令行参数** | 读 spool → 校验 → 两次 `rename` → 写审计 | 不能接受路径/命令/参数；不能执行子进程（`NOEXEC`） |
| sudo 授权 | `/etc/sudoers.d/mcu-cms-publish` | 仅允许 `mcucms` 以 root 执行**这一个二进制、零参数** | 不得给 `mcucms` 任何其他 sudo 权限 |

#### 4.2.2 sudoers 精确配置（一行都不能多）

```sudoers
# /etc/sudoers.d/mcu-cms-publish   权限 0440 root:root
Defaults:mcucms  !requiretty
Defaults:mcucms  !use_pty
Defaults:mcucms  env_reset
Defaults:mcucms  secure_path=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
Defaults:mcucms  !setenv
mcucms ALL=(root) NOPASSWD: NOEXEC: /usr/local/sbin/mcu-cms-publish ""
```

设计说明：
- **`""`（空参数列表）**：sudo 只允许"零参数"调用，`mcu-cms-publish anything` 会被 sudo 自身拒绝。**参数注入从 sudo 层就被堵死**，不依赖脚本自己判断。
- **`!use_pty`**：避免 pty 行缓冲污染（本方案不用 stdin，但明确关掉可消除一类不确定性）。
- **`NOEXEC`**：助手内部不得 `exec` 任何子进程 → 助手必须用 Node 的 `crypto` 算哈希、`fs` 做 rename，**不调用 `sha256sum`/`mv`/`ln`**。这样即使助手有命令拼接 bug，也无法执行外部程序。
- **`!setenv`**：禁传环境变量。
- `env_reset` + `secure_path` 防 PATH 劫持。

#### 4.2.3 请求协议（不用参数、不用 stdin，用固定 spool）

```
固定目录：/www/wwwroot/mcu-cms/spool/          mcucms:mcucms 0700
  pending/<id>.req                              CMS 写入，原子 rename 进入
  done/<id>.res                                 助手写入结果
  failed/<id>.res                               助手写入失败原因
  archive/                                      7 天后由 cron 清理（保留 30 天）

<id>.req 内容（JSON，≤ 4 KB）：
{
  "v": 1,
  "id": "20261109T101500Z-7f3a2c",
  "action": "switch",                 // switch | verify_only
  "release_seq": 7,                   // 正整数
  "expect_prev_seq": 6,               // 正整数或 0（首次发布）
  "sitemap_sha256": "<64 hex>",
  "article_manifest_sha256": "<64 hex>",
  "requested_by": "user-uuid",
  "requested_at": "2026-11-09T10:15:00Z"
}
```

CMS 侧调用：`sudo -n /usr/local/sbin/mcu-cms-publish`（无参数）。助手扫描 `pending/` 按文件名 FIFO 处理，处理完移动到 `done/` 或 `failed/`，并写结果 JSON。CMS 轮询结果文件（或直接读 `done/`）。

**为什么用 spool 而不是参数/stdin**：
- 参数：sudo 层可保证零参数，但一旦允许参数就要靠脚本正则，脆弱；
- stdin：`use_pty` 会污染、`sudo` 在某些配置下改写 stdin；spool 天然幂等、可重放、崩溃后可补跑；
- spool 还顺带解决「CMS 崩在请求发出之后、助手还没跑」的场景——助手被再次调用时会捡起来。

#### 4.2.4 助手的校验顺序（**先校验、后变更；任一失败零副作用**）

```
0. 取得独占锁 /run/mcu-cms-publish.lock（flock，非阻塞；拿不到即退出码 75）
1. 校验请求：JSON 可解析；v==1；id 匹配 /^[0-9TZ\-a-f]{20,40}$/；action ∈ 白名单
2. 校验 release_seq：整数 1..999999；目录 = /www/wwwroot/mcu-cms/releases/%06d
3. 校验目录：存在、是目录（非软链）、属主 uid == mcucms、权限不高于 0755
4. 校验同文件系统：stat(releases).st_dev == stat(/www/wwwroot/mcu-h5).st_dev   ← 保证 rename 原子
5. 校验 manifest.json：
   - 条目数 ≤ 5000；总大小 ≤ 200 MB
   - 每个 path：相对路径、无 `..`、无绝对、lstat 必须是普通文件（**拒绝软链**）
   - 每个 sha256 与文件实测一致（Node crypto）
   - 每个文件 mode & 0o002 == 0（无 world-write）
6. 校验必备产物：article/index.html 存在；且含标记 `<!-- release:<seq> -->`
7. 校验 sitemap 候选文件：按 §3.4 的 S1/S3/S4/S5 + 「≥ 当前线上 loc 数 − removed」
8. 校验当前线上状态：readlink(h5/article) 的 seq 必须 == expect_prev_seq（防错序/重放）
9. ——— 以下才开始变更 ———
9a. 备份当前 sitemap → /www/backup/cms-sitemap/sitemap-<ts>.xml（保留 30 份）
9b. 建临时软链 h5/.article.new.<pid> → 目标；fs.renameSync 覆盖 h5/article
9c. fs.renameSync(release/sitemap.xml → h5/sitemap.xml)
10. 复核：readlink == 目标；sha256(h5/sitemap.xml) == 请求值
11. 写 /var/log/mcu-cms-publish.log（append，root:adm 0640）+ 写 <id>.res
12. 释放锁
```

**边界声明（必须写进运维手册）**：助手能做的操作只有 3 种——建软链、rename 软链、rename sitemap。**没有删除、没有递归、没有通配、没有外部命令**。

#### 4.2.5 审计机制

| 层 | 内容 | 位置 |
|---|---|---|
| sudo 层 | 每次调用记录 user/cmd/tty/时间（authpriv） | `/var/log/secure` |
| 助手层 | 请求全文、prev→target、sitemap sha、结果、耗时 | `/var/log/mcu-cms-publish.log` |
| CMS 层 | 谁点的发布、哪个 release、校验摘要 | `cms_audit_log` + `cms_releases` |
| 结果层 | `<id>.res` 保留 30 天 | `spool/archive/` |

三层日志用同一个 `id` 串联，可事后完整复原一次发布。

### 4.3 修订方案 B（备选）：root Unix Socket 服务

若运维不接受 sudo（例如统一管控 sudoers），改用常驻特权服务：

- `mcu-cms-publish.service`：`root`，仅监听 `unix:/run/mcu-cms-publish.sock`（`srw-rw---- root:mcucms`）；
- 用 `SO_PEERCRED` 取调用方 uid，**必须等于 mcucms 的 uid**，否则断开；
- 报文同 §4.2.3 的 JSON（≤ 4KB），校验顺序同 §4.2.4；
- 单请求串行（内置队列），响应返回 JSON；
- 同样只做 3 种操作，同样只写两份日志。

| 对比 | A（sudo 一次性） | B（socket 常驻） |
|---|---|---|
| 常驻特权进程 | ❌ 无 | ✅ 有（增加一个长期 root 进程 = 增加攻击面） |
| 代码量 | 小 | 中（socket 生命周期、超时、并发） |
| 崩溃恢复 | 重新调用即可 | 需 systemd `Restart=always` + 客户端重试 |
| 审计 | sudo 原生 | 自己实现 |
| 结论 | **推荐** | 备选 |

**明确废弃**：setuid / setgid 二进制 / `chmod 4750` 脚本 / 把 `mcucms` 加入 `sudo` 组 / `NOPASSWD: ALL` / 通过 `systemctl` 让 CMS 启停任意 unit。

---

## 5. P0-4：发布状态机与失败恢复

### 5.1 核心原则（先立规矩）

1. **只有 2 个操作是原子的**：① `rename(软链)`；② `rename(sitemap)`。二者都在同一文件系统（已核实 `st_dev` 相同 = 64771）。
2. **其余全部非原子**：构建、校验、DB 写入、HTTP 自检、日志落盘——都只能靠"意图记录 + 补偿 + 对账"。
3. **文件系统是事实，DB 是日志**。崩溃恢复时以「软链实际指向 + sitemap 实际哈希」为准反推状态，**绝不反过来相信 DB 的 `status`**。
4. **未完成不得标成功**：`status` 只有经过自检才能写 `published`；任何中间态都会在健康检查里报 `degraded`。

### 5.2 状态机（9 阶段）

```
                  ┌──────────── failed_build (补偿：删 tmp)
                  │
 draft ──▶ building ──▶ built ──▶ verified ──▶ switch_intent ──▶ switching
                                                      │              │
                                                      │              ├─▶ sitemap_pending
                                                      │              │        │
                                                      │              │        ├─▶ published（终态·成功）
                                                      │              │        └─▶ failed_sitemap
                                                      │              └─▶ failed_switch
                                                      └──────────── failed_verify (补偿：删 release 目录)

 任一 *_failed / switch_intent / switching / sitemap_pending
        ──(补偿成功)──▶ rolled_back（终态·已回退）
        ──(补偿失败)──▶ inconsistent（终态·需人工，health=degraded）
```

字段落库（`cms_releases`）：
`phase`、`prev_release_id`、`prev_symlink_seq`、`sitemap_sha256`、`prev_sitemap_sha256`、`error_code`、`error_detail`、`started_at`、`heartbeat_at`、`finished_at`、`attempt`（重试次数）。

### 5.3 执行序列（含写前意图）

| # | 动作 | 原子？ | 失败后状态 | 补偿 |
|---|---|---|---|---|
| 1 | 取发布锁 `flock data/publish.lock` | 是（系统调用） | 无变化 | 直接退出 |
| 2 | **DB：插入 release 行，`phase=building`**（意图记录） | 是（事务） | 无变化 | 无 |
| 3 | 构建到 `tmp/<seq>/`（**不写 releases/**） | 否 | `failed_build` | 删 `tmp/<seq>` |
| 4 | 校验 15 项 → 写 `verify.json`；`mv tmp/<seq> → releases/<seq>` | 否（mv 同 fs 是 rename，原子） | `failed_verify` | 删 `tmp/<seq>` |
| 5 | **DB：`phase=verified` + `prev_symlink_seq` 快照** | 是 | `failed_verify` | 无 |
| 6 | **DB：`phase=switch_intent`（写前意图，必须先落库再动文件）** | 是 | `failed_verify` | 无 |
| 7 | 调助手：软链 rename（内部再校验一遍） | **是** | `failed_switch` 或已切换 | 见 5.4 |
| 8 | 调助手：sitemap rename | **是** | `sitemap_pending` | 重试 / 回退 sitemap |
| 9 | HTTP 自检（`curl --resolve` 打本机，断言含 `<!-- release:<seq> -->`） | 否 | `published_pending` | 回滚（软链 + sitemap） |
| 10 | **DB：`phase=published` + `finished_at`；写 release_items** | 是 | `published_pending` | 由对账补写 |

> 第 6 步的 `switch_intent` 是整套机制的关键：**在动任何文件之前，DB 已经知道"我要从 6 切到 7"**。这样即使进程在第 7 步被 kill，重启后也能判断"到底切没切"。

### 5.4 失败矩阵（逐一覆盖任务点名的 8 种）

| 失败场景 | 检测方式 | 当时的真实状态 | 恢复动作 | 终态 |
|---|---|---|---|---|
| ① 构建失败（模板异常/磁盘满） | 子进程退出码 ≠ 0 | 线上仍是旧版，`releases/<seq>` 不存在 | 删 `tmp/<seq>`，`phase=failed_build` | 无影响 |
| ② 校验失败（任一条） | `verify.json.failed > 0` | 同上 | 删 `tmp/<seq>`，`phase=failed_verify` | 无影响 |
| ③ 软链切换失败（权限/助手拒绝） | 助手返回非 0 | 软链仍指旧版 | `phase=failed_switch`；重新对账确认软链 == prev | 无影响 |
| ④ Sitemap 更新失败 | 助手返回非 0 或 sha 不符 | 软链=新版，sitemap=旧版 | **重试 1 次**；仍失败 → 回退软链到 prev（sitemap 未变，天然一致）→ `rolled_back` | 一致（旧版） |
| ⑤ DB 记录失败（步骤 10） | 事务异常 | 软链=新版，sitemap=新版，DB 仍 `published_pending` | 对账：软链==目标 且 sitemap sha==目标 → 补写 `published` | 一致（新版） |
| ⑥ HTTP 自检失败（404/内容不含标记） | curl 状态/内容断言 | 文件已切但服务未生效（软链错、权限错、缓存） | 回滚软链 + 回滚 sitemap → `rolled_back`；记录诊断 | 一致（旧版） |
| ⑦ 发布过程中服务意外退出 | 重启后 `recover()` 扫未完成 phase | 未知（可能切了一半） | 见 5.5 对账算法 | 收敛到一致态 |
| ⑧ 发布完成但 DB 未同步 | 同上 | 线上=新版，DB=中间态 | 对账补写 `published`（不重复切换） | 一致（新版） |

### 5.5 对账算法（`recover()`：启动时 + 每 5 分钟 + 每次发布前）

```js
// 输入：未完成 release 列表（phase ∈ {building, built, verified, switch_intent, switching, sitemap_pending, published_pending}）
// 事实来源：文件系统
const liveSeq   = readlinkSeq('/www/wwwroot/mcu-h5/article');      // 0007
const liveSmSha = sha256('/www/wwwroot/mcu-h5/sitemap.xml');

for (const r of inFlight) {
  const targetSeq = String(r.seq).padStart(6, '0');
  const prevSeq   = String(r.prev_symlink_seq).padStart(6, '0');

  if (r.phase === 'building' || r.phase === 'built' || r.phase === 'verified') {
    // 尚未动文件：一律判失败，清理 tmp（若 release 目录已生成则保留，供人工排查）
    setPhase(r, 'failed_' + (r.phase === 'building' ? 'build' : 'verify'));
    continue;
  }

  const symlinkIsTarget = (liveSeq === targetSeq);
  const sitemapIsTarget = (liveSmSha === r.sitemap_sha256);

  if (symlinkIsTarget && sitemapIsTarget) {
    // 两个 rename 都成功，只差 DB 收尾
    if (selfCheck(r.seq)) setPhase(r, 'published');         // 补齐
    else { rollbackTo(prevSeq, r.prev_sitemap_sha256); setPhase(r, 'rolled_back', 'SELFCHECK_FAIL'); }
    continue;
  }

  if (symlinkIsTarget && !sitemapIsTarget) {
    // 典型：崩在两次 rename 之间 → 补偿 sitemap（幂等）
    if (trySwitchSitemap(r)) setPhase(r, 'published');
    else { rollbackTo(prevSeq, r.prev_sitemap_sha256); setPhase(r, 'rolled_back', 'SITEMAP_FAIL'); }
    continue;
  }

  if (!symlinkIsTarget && liveSeq === prevSeq && !sitemapIsTarget) {
    // 两个 rename 都没做 → 纯失败，无副作用
    setPhase(r, 'failed_switch');
    continue;
  }

  // 其余组合（软链=prev 但 sitemap=target，或软链是第三个值）→ 不一致，必须人工
  setPhase(r, 'inconsistent', describe(liveSeq, liveSmSha));
  raiseAlert();
}
```

**这套算法回答"发布完成但数据库状态未同步"**：因为 DB 是日志不是事实，任何组合都能被反推并收敛。

### 5.6 严格保证 vs 只能补偿（如实区分）

| 保证 | 强度 | 说明 |
|---|---|---|
| 构建/校验失败时线上零变化 | **严格** | 构建在 `tmp/`，校验通过才 `mv` 进 `releases/` |
| 软链切换本身 | **严格原子** | 单次 `rename(2)` |
| Sitemap 替换本身 | **严格原子** | 单次 `rename(2)` |
| 软链 + Sitemap 的**联合**切换 | **非原子** | 存在毫秒级窗口：文章已上线但 sitemap 未更新（方向是"少了"而非"多了"，危害小，且可重试） |
| 发布 + DB 状态 | **非原子** | 靠对账收敛（< 5 分钟窗口） |
| 极端情况（两次 rename 之间断电） | **非原子** | 靠 `recover()`；若恢复也失败 → `inconsistent` + 告警，**绝不标成功** |
| 回滚 | **非严格**：回滚也是两次 rename | 回滚失败 → `inconsistent`，需人工；文档给出人工 3 条命令 |

> **必须写进产品口径**：CMS 保证的是「**不会静默成功**」+「**不一致会被显式标记为 degraded 并告警**」，不保证"跨资源零窗口原子"——POSIX 文件系统上做不到，任何声称做到的方案都在骗人。

### 5.7 幂等与重入

- 助手：两个目标状态都可检测（软链 seq、sitemap sha），重复调用结果一致（幂等）。
- 发布任务：同一 `release_seq` 重复执行 → 先跑对账，已是 `published` 直接返回成功，不再切换。
- 并发布：`flock` 单写者；第二个发布请求返回 `409 PUBLISH_IN_PROGRESS`。

---

## 6. P0-5：服务器内存重新评估

### 6.1 已核实基线（2026-11-09）

| 项 | 值 |
|---|---|
| CPU / 内存 | 2 vCPU / 918,012 kB ≈ 896 MiB |
| `MemAvailable` | 149,552 kB ≈ **146 MiB**（快照，非稳态） |
| Swap | 1 GiB，**已用 192 MiB**，`vm.swappiness=0` |
| 现有常驻 | MariaDB 118.8 MB + php-fpm ×3 ≈ 300 MB + 宝塔 49.7 MB + aegis 42.2 MB + nginx ≈ 56 MB + forum 12.7 MB |
| 磁盘 | 30 G / 已用 12 G / 可用 16 G（43%） |
| 采集 cron | 每日 08:00（`flock`，AI 调用在人工触发的候选阶段，不在 08:00） |

**结论：146 MiB 只是"某一秒的余量"。** 它不包含：① 08:00 采集 cron 的瞬时内存；② 宝塔面板备份/扫描任务；③ 日志轮转与 gzip；④ 内核 page cache 被回收后的抖动。**因此不能把任何 `MemoryMax` 数值当作"资源充足"的证明。**

### 6.2 上线前必须实测的 5 项（缺一不可）

| # | 测量项 | 方法 | 采集指标 |
|---|---|---|---|
| M1 | **CMS 空载 RSS** | 启动后静置 10 分钟 | `systemctl show -p MemoryCurrent mcu-cms`，`ps -o rss` |
| M2 | **后台操作 RSS** | 连续 10 次「保存草稿 + 3 次预览 + 2 次切换文章」 | 峰值 RSS、GC 后回落值 |
| M3 | **构建期峰值 RSS** | 构建 20 篇文章 | `/usr/bin/time -v node build.cjs` 的 `Maximum resident set size` |
| M4 | **并发期系统余量** | 构建 + `ab/wrk` 20 rps × 60 s 打文章页（本机 curl 循环即可，不装工具） | `MemAvailable` 最低点、`vmstat` 的 `si/so` |
| M5 | **OOM 与抖动** | 全流程后 | `dmesg \| grep -i oom`、swap 增量、现有服务 RSS 偏差 |

**执行原则**：M1–M5 在**业务低峰（02:00–07:00）** 跑，且必须先在 `MemoryMax` 保护下跑一遍"悲观路径"（构建 + 并发）。

### 6.3 建议验收阈值（**方案，需实测校准**）

| 指标 | 阈值 | 说明 |
|---|---|---|
| M1 空载 RSS | ≤ 45 MB | 参考 forum 12.7 MB，CMS 含模板/DB 层按 3 倍余量 |
| M2 后台操作峰值 | ≤ 70 MB | 单请求无并发 |
| M3 构建峰值（子进程） | **≤ 86 MB** | 由 M4 反推：`146（基线可用）− 60（安全垫）= 86 MB`。**120 MB 只是 `MemoryMax` 的硬顶，不是通过标准** |
| M4 `MemAvailable` 最低点 | **≥ 60 MB** | 低于此值视为"不可上线"，不是"再观察" |
| M4 swap `si/so` 增量 | ≤ 8 MB / 测试窗口 | 超过即视为抖动 |
| M5 OOM kill | **0 次** | 出现即失败 |
| M5 现有服务 RSS 偏差 | ≤ 10% | 防止 CMS 把别人挤走 |

**阈值之间存在算术关系（必须一起看）**：基线可用 146 MB，扣除 60 MB 安全垫后，**构建 + 后台 + CMS 常驻的新增占用总和必须 ≤ 86 MB**。这意味着：
- 常驻 40 MB + 后台峰值 70 MB 是**不同时发生**的两个场景（常驻是常态，后台峰值是瞬间），所以这两个阈值不能相加；
- **真正会相加的是"CMS 常驻 + 构建子进程"**（发布会话里两者同时存在）→ 45 + 86 = 131 MB > 146？不超标的前提是构建自身 ≤ 101 MB 且常驻实际 ≤ 45 MB。**因此 G2 必须实测"构建 + 常驻"同时刻的 `MemAvailable`，而不是分别看两个数字。**
- 若实测构建峰值为 60–86 MB，则通常可通过；若 > 86 MB，**必须立即启用 R1（流式构建）** 再测；R1 后仍 > 86 MB → 直接走 R3（本地构建）。

**为什么阈值是 60 MB 而不是"用完为止"**：内核在 `MemAvailable` 接近 0 时会触发直接回收与 OOM Killer，被杀的往往是 RSS 最大的进程（MariaDB/php-fpm），也就是**现有业务**。留 60 MB 是留给回收与突发的安全垫。

### 6.4 若实测不达标：4 条降级路线（按推荐顺序）

| 路线 | 做法 | 影响 | 成本 |
|---|---|---|---|
| **R1 逐篇流式构建（默认就做）** | 构建器不把全部 HTML 拼成一个字符串；每篇渲染→写盘→释放；`--max-old-space-size=96`；数据只加载一次（688 KB） | 无功能影响，构建慢一点（仍是秒级） | 0 |
| **R2 低峰构建 + 限速** | 只允许 01:00–07:30 发布；`Nice=10`、`IOSchedulingClass=idle`、`CPUQuota=60%` | 运营需接受"发布不即时"（可预约） | 0 |
| **R3 本地构建 + 上传产物** | 开发机（Windows + Node 24）跑同一份构建器 → 产出 `release.tar.gz`（含 manifest+sha256）→ `scp` 上传 → 服务器只做**校验 + 切换**（不构建） | ① 服务器内存压力 ≈ 0；② 引入"构建环境双份"风险，需固定 Node 版本 + 构建器版本号写进 manifest + 服务器侧全量 sha256 复算；③ 发布依赖开发机在线 | 低（多 1 人日的打包校验） |
| **R4 扩容 / 停用 WordPress** | 升配内存，或停掉与项目无关的 WordPress/php-fpm（释放约 400 MB） | **必须 owner 决策**，本报告不执行、不建议擅自操作 | 有费用/业务影响 |

> **明确不做**：为了"腾内存"去 kill 现有进程、改 MariaDB 参数、停 php-fpm、改 swap 大小。这些都属于越界运维。

### 6.5 OOM 保护（无论实测是否达标都要配）

```ini
# mcu-cms.service
OOMScoreAdjust=500        # 让 CMS 比现有服务更早被 OOM Killer 选中
MemoryHigh=160M
MemoryMax=192M
Nice=10
IOSchedulingClass=idle
CPUQuota=60%
```
构建子进程继承 `OOMScoreAdjust`，并额外 `--max-old-space-size=96`。

> 逻辑：**宁可 CMS 被杀，也不能让 MariaDB/php-fpm/nginx 被杀。** 这是"资源不足时的优先级声明"，比任何 MemMax 数值都更实际。

---

## 7. P0-6：Markdown 渲染方案（明确选型）

### 7.1 选型结论

**选择「严格受限的自研解析器」，并明确拒绝"兼容 CommonMark"的承诺。**

| 候选 | 评估 | 结论 |
|---|---|---|
| A. 引入 `marked` + 服务端 sanitizer | `marked` 本身不负责安全；服务端 sanitize 需要 DOM（`jsdom` 不可用于此环境）或引入 `DOMPurify`（依赖 DOM）。零依赖前提下**做不出可靠的 sanitize 层**，等于把 XSS 面交给"记得转义" | ❌ 否决 |
| B. 引入 `markdown-it` + `html:false` | `html:false` 确实能挡住原始 HTML，是相对安全的组合；但需 `npm install`（2 个包 + 传递依赖），与"服务器零 npm"纪律冲突 | ⚠️ 备选（仅在 owner 放开零依赖时） |
| C. 自研「严格子集」解析器 | 语法面小 → 可穷举测试；**默认全转义**、原始 HTML **直接报错而非转义**；不依赖任何外部输入解析器 | ✅ **采用** |

**C 的关键纪律**：**不追求 Markdown 兼容性。** 支持的就是规范里那几条，不支持的**显式报错**，让编辑改用别的写法。这比"看起来支持但边界模糊"安全得多。

### 7.2 支持的语法（完整清单，此外一律不支持）

| 类别 | 语法 | 输出 |
|---|---|---|
| 块：标题 | `##` `###` `####`（**不支持 `#`**，H1 由标题字段生成） | `<h2>`–`<h4>` |
| 块：段落 | 空行分隔 | `<p>` |
| 块：无序列表 | `- item`（支持 1 层嵌套：`  - item`） | `<ul><li>` |
| 块：有序列表 | `1. item` | `<ol><li>` |
| 块：引用 | `> text` | `<blockquote><p>` |
| 块：代码块 | ```` ``` ```` 围栏（**不解析语言标识，不生成 highlight**） | `<pre><code>` |
| 块：表格 | `\| a \| b \|` + 分隔行 `\|---\|---\|` | `<table><thead><tbody>` |
| 块：分割线 | `---`（独立成行） | `<hr>` |
| 块：图片 | `![alt](media:<id>)` **唯一形式** | `<figure><img><figcaption>` |
| 行内：粗体 | `**x**` | `<strong>` |
| 行内：斜体 | `*x*` | `<em>` |
| 行内：行内代码 | `` `x` `` | `<code>` |
| 行内：链接 | `[text](https://...)` 或 `[text](/article/...)` | `<a href rel>` |
| 行内：转义 | 反斜杠 + 特殊字符（星号、下划线、反引号、方括号） | 字面字符 |
| **换行** | **单换行 = 空格**（严格按 Markdown 语义，不自动 `<br>`） | — |

### 7.3 明确不支持（写入编辑器提示 + 解析器报错）

| 不支持 | 报错方式 |
|---|---|
| **任何原始 HTML**（`<div>`、`<br>`、`<span style>`、`<iframe>`…） | 解析失败，行号 + `RAW_HTML_NOT_ALLOWED` |
| 引用式链接 `[a][1]` | `UNSUPPORTED_SYNTAX` |
| 脚注 `[^1]` | 同上 |
| 任务列表 `- [ ]` | 同上 |
| 嵌套超过 1 层 | `NEST_TOO_DEEP` |
| 图片用外链 `![](https://...)` | `IMAGE_MUST_USE_MEDIA_ID`（**强制走媒体库**，防热链/防盗链/防 SSRF 式探测） |
| 自动链接 `<https://...>` | `UNSUPPORTED_SYNTAX`（用 `[text](url)`） |
| HTML 实体 `&nbsp;` | 原样输出文本（不解释为实体） |
| 数学公式 / mermaid / 高亮 | 同上 |

### 7.4 转义与安全规则（逐条可测）

| # | 规则 | 实现 |
|---|---|---|
| E1 | **所有文本节点先转义**：`&`→`&amp;`、`<`→`&lt;`、`>`→`&gt;`、`"`→`&quot;`、`'`→`&#39;` | 单一 `esc()` 函数，**所有输出路径必经** |
| E2 | 属性值同样走 `esc()`；URL 额外走协议校验 | — |
| E3 | 链接协议白名单：`http:`、`https:`、`mailto:`、站内相对路径（`/` 开头且不含 `//`） | 其余（`javascript:`、`data:`、`file:`、`vbscript:`）→ 解析失败并报 `BAD_URL_SCHEME` |
| E4 | 外链自动加 `rel="noopener noreferrer"`；**不生成 `target="_blank"`**（避免 opener 风险与行为不一致） | — |
| E5 | 站内链接必须是**无扩展名**形式（`/article/xxx`），且构建时校验目标存在 | 否则 `INTERNAL_LINK_BROKEN`（阻断发布） |
| E6 | 代码块内容**整体转义**，不做任何语法高亮 | — |
| E7 | 表格单元格内不允许块级元素；单元格内的竖线符必须转义为 `\|` | — |
| E8 | 图片 `src` 由 `media:<id>` 解析为 `/media/YYYY/MM/xxx.webp`；`id` 不存在 → 阻断发布 | — |
| E9 | 明细输出中**不出现** `innerHTML` 概念以外的拼接：解析器只产出「节点数组」，序列化阶段统一转义 | 结构上消除"某处忘了转义" |

### 7.5 测试矩阵（40 条，必须全绿才允许合并）

| 组 | 用例数 | 关键用例 |
|---|---|---|
| 基础语法 | 12 | 标题层级、列表嵌套、表格对齐、代码块含反引号、引用内多段落 |
| 转义 | 8 | `<script>alert(1)</script>`、`<img src=x onerror=alert(1)>`、`"` `'` `&` 混排、代码块里的 `</script>` |
| URL | 8 | `javascript:alert(1)`、`data:text/html;base64,...`、`//evil.com`、`/article/../etc`、`https://ok.com`、`mailto:`、相对路径、大小写混合 `JaVaScRiPt:` |
| 图片 | 4 | 合法 `media:`、不存在 id、外链被拒、alt 含引号 |
| 边界 | 8 | 空文档、仅空白、超长单行（100 KB）、1000 个列表项、未闭合代码块、CRLF、BOM、emoji |

**通过判据**：40/40 通过；且对每个 XSS 用例断言「输出中不出现可执行上下文」（即 `<script`、`on\w+=`、`javascript:` 均被转义或拒绝）。

### 7.6 降级条件（诚实的前置约定）

若在 M3 阶段出现以下任一情况，**立即切换到备选 B（`markdown-it` + `html:false`，vendored 单文件）**，并接受"引入 1 个第三方依赖"的代价：
- 40 条用例中有任何一条无法在 2 人日内修复；
- 发现解析器需要递归回溯才能正确处理的结构；
- 需要支持 7.3 里任何被列为"不支持"的语法（说明需求超出子集）。

**切换成本**：约 0.5 人日（替换 `render/markdown.cjs` 的实现，接口不变 `render(md, {mediaResolver}) → {html, errors[]}`）。

---

## 8. SEO 管理范围（分层，避免"只管理文章"的缩减）

### 8.1 五层模型（这是全站 SEO 的完整规划，V1 只做 L1–L3）

| 层 | 范围 | V1 | 后续 | 说明 |
|---|---|---|---|---|
| **L1 文章级** | 每篇文章的 title/desc/keywords/canonical/robots/OG/JSON-LD | ✅ 完整 | — | CMS 核心能力 |
| **L2 分类与索引页** | 分类页、文章索引页、分页页的 TDK + 自指 canonical + 面包屑 | ✅ 完整 | — | 与 L1 同一套字段，存 `cms_categories` |
| **L3 全局默认** | 站点名后缀、默认 OG 图、默认 author/publisher、默认 robots | ✅ 完整 | — | 存 `cms_settings`，仅作用于 CMS 页面 |
| **L4 现有 15 个 H5 页面** | 首页/路线/地图/资讯/工具/社区壳页的 TDK | ⛔ 不动（F1 冻结） | 规划中：整页改由构建器生成（先冻结基线 → 生成 → 逐字节 diff → 人工确认） | **不缩减需求**：明确"最终要统一管理"，只是 V1 不做 |
| **L5 参数页（作品/人物/路线/专题/资讯详情）** | `movie.html?id=`、`route-detail.html?id=`、`special.html?id=`、`news-detail.html?id=` | ⛔ 不动 | 规划中：**静态化**（每部作品/每个路线生成独立 HTML），是解决"不执行 JS 即同质页"的唯一正解 | 这是全站最大的 SEO 负债，V1 明确登记、不假装解决 |

### 8.2 为什么 L4/L5 必须留规划而不能"以后再说"

- L5 的 38 个作品页 + 11 条路线页 + 1 个专题页 = **50 个高价值 URL 目前对非 JS 抓取器是同质页**。CMS 的文章页做得再好，也补不上这 50 个页面的语义。
- 若不写进规划，后续很容易演变成"CMS = 只写文章"，全站 SEO 永远停在 L1。
- **留规划的具体形式**：在 `cms_settings` 预留 `site_seo_mode`（`cms_only` → `full_site`），并在数据库设计里预留 `cms_page_meta`（见 §13.6 的"未启用表"），明确"启用时序"而非"以后重构"。

### 8.3 V1 验收只对 L1–L3 负责（明确写死）

| 断言 | 判据 |
|---|---|
| L1 | 每个文章页具备唯一 title/desc/canonical/robots/OG ×5/JSON-LD ×2 |
| L2 | 每个分类页与分页页具备自指 canonical + 面包屑 + 列表可爬（纯 `<a>`） |
| L3 | 站点名后缀、默认 OG 图在 `cms_settings` 可改，且改后构建产物随之变化 |

---

## 9. Canonical 与 URL（明确 canonical ≠ 301）

### 9.1 概念边界（必须写进产品文档）

| 手段 | 语义 | 强度 | 本项目现状 |
|---|---|---|---|
| `rel=canonical` | **提示**搜索引擎"哪个 URL 是规范版本" | 弱（可能被忽略） | 现有 5 页静态 + 4 类参数页运行时注入 |
| HTTP 301 | **强制**跳转，权重传递最完整 | 强 | **全站无任何 301**（除 80→443、非 www→www） |
| `meta refresh` | 浏览器端跳转 | 很弱 | 不使用 |

> **结论**：canonical 只能"收敛重复"，**不能替代跳转**。用户从旧链接进来，仍会看到旧 URL。V1 用「锁 slug」避免产生需要 301 的场景。

### 9.2 URL 规范（V1 定稿）

| 类型 | 规范 URL（canonical 与内部链接统一用这个） | 实际文件 |
|---|---|---|
| 文章 | `https://www.mcuatlas.xyz/article/<slug>` | `article/<slug>.html` |
| 文章索引 | `https://www.mcuatlas.xyz/article/` | `article/index.html` |
| 索引分页 N（N≥2） | `https://www.mcuatlas.xyz/article/page/<N>` | `article/page/<N>.html` |
| 分类 | `https://www.mcuatlas.xyz/article/c/<cat>`（**无尾斜杠**） | `article/c/<cat>/index.html` |
| 分类分页 N | `https://www.mcuatlas.xyz/article/c/<cat>/page/<N>` | `article/c/<cat>/page/<N>.html` |
| 标签（默认 noindex） | `https://www.mcuatlas.xyz/article/t/<tag>` | `article/t/<tag>/index.html` |

### 9.3 为什么分类页用「目录 + index.html」而不是「平铺 .html」

原方案写 `article/c/<cat>.html` 并配 `article/c/<cat>/page/2.html`。**这会撞上 `try_files` 的目录优先行为**：

```nginx
location / { try_files $uri $uri.html $uri/ =404; }
# 请求 /article/c/ironman
#   $uri      = /article/c/ironman        → 若存在同名“目录”（为分页而建），命中的是目录
#   → 触发内部跳转 /article/c/ironman/    → index index.html → 不存在 → 403/404
```

即：**同名的文件（`c/ironman.html`）与目录（`c/ironman/`）不能共存**，一旦为分页建目录，第一页就 403。这是原设计的实质缺陷。

**修正**：分类页改为 `article/c/<cat>/index.html`（目录索引），分页放 `article/c/<cat>/page/<N>.html`。这样：
- `/article/c/<cat>` → `try_files $uri` 命中目录 → 内部跳 `/article/c/<cat>/` → `index index.html` ✅（Nginx 默认 `index index.html;`，已在 server 块声明 `index index.html;`【核实】）
- `/article/c/<cat>/` 也 200，canonical 统一写无尾斜杠形式（两者内容**字节相同**，因为同一个文件）
- 分页目录 `page/` 不会与任何第一页文件冲突

**同类修正**：文章索引分页 `/article/page/2` 的父路径 `/article/page`（无 N）是目录，直接访问会 403。**构建时额外生成 `article/page/index.html`**（内容为"跳到第 1 页"的 `<a>` 列表 + canonical 指向 `/article/`），把这个 403 变成正常页。

### 9.4 硬性规则（可校验）

| # | 规则 | 校验方式 |
|---|---|---|
| U1 | 内部链接与 sitemap **统一无扩展名** | 构建后扫描所有 `<a href>`，出现 `/article/xxx.html` 即失败 |
| U2 | 同一文章不同入口输出**字节相同** | 两个入口指向同一文件（`try_files` 保证）；自检时对 `/article/x` 与 `/article/x.html` 取 sha256 比对 |
| U3 | canonical 必须自指 | `canonical == 本页规范 URL` |
| U4 | canonical 不得含 `utm_*` 等跟踪参数 | 构建期断言 |
| U5 | 已发布 slug 不可改（`slug_locked=1`） | API 层拒绝；DB 层 `slug` 唯一 |
| U6 | 保留字不得作 slug：`c`、`t`、`page`、`index`、`feed.xml`、`assets`、`media` | 创建时校验 |
| U7 | 下架文章的 URL 不得被新文章复用 | slug 唯一约束覆盖归档态 |

### 9.5 后续 301 方案（不动手，只定路径）

| 阶段 | 做法 | 前置 |
|---|---|---|
| V1.5 | Nginx 增加 `map`（`/etc/nginx/conf.d/mcu-cms-redirect.map`）+ 一个 `if`/`error_page` 挂载点；`cms_redirects` 表导出为 map 文件，助手原子替换 + `nginx -s reload` | **owner 授权 + 变更单 + 回滚备份** |
| 备选（零配置） | 旧路径生成 `noindex` + `<link rel=canonical>` + `meta refresh` 桩页 | 不需要授权，但**不是 301**，权重传递弱，且桩页会累积 |

---

## 10. 静态分页（修正 `?page=n` 缺陷）

### 10.1 原方案的问题

原报告写「索引页分页用 `?page=n` + `rel=prev/next` + 自指 canonical」，但**没有为 `?page=n` 生成任何静态文件**。结果是：
- 抓取器访问 `?page=2` 拿到的是**第 1 页的同一份 HTML**（因为页面是静态的，服务端不解析 query）；
- 内容重复、分页链接全指向同一内容 → 典型的"分页黑洞"。

### 10.2 修订：构建期生成真实分页文件

| 项 | 规则 |
|---|---|
| 每页条数 | 12（可在 `cms_settings` 调整；改后需重新发布） |
| 文件 | `article/page/<N>.html`、`article/c/<cat>/page/<N>.html` |
| 链接 | **普通 `<a href="/article/page/2">`**，不用 JS、不用事件委托 |
| 第 1 页 | 就是 `/article/`（不生成 `page/1`，避免重复 URL） |
| 末页 | 不生成"下一页"链接 |
| canonical | 每页**自指**（`?page` 自指是错的，分页页不是重复页） |
| robots | `index,follow` |
| `rel=prev/next` | `<link rel="prev">` / `<link rel="next">` 输出（**说明**：Google 自 2019 年起不再将其作为索引信号，Bing 等仍可能参考；保留无害，不作为 SEO 承诺） |
| 空分类 | 不生成页面（全量重建天然删除旧文件） |
| 只有 1 页的分类 | 只生成 `index.html`，无 `page/` 目录 |
| 每页内容 | 列表项 = 标题 + 摘要 + 日期 + 分类，全部静态文本，图片可为 `loading=lazy` |

### 10.3 分页的边界情形

| 情形 | 处理 |
|---|---|
| 文章数恰好是 12 的整数倍 | 末页满；不生成空的下一页 |
| `<N>` 超出范围（如 `/article/page/99`） | 404（不做软 404） |
| `<N>` 非数字 | 404 |
| 分页页被 sitemap 收录？ | **收录**（它们是可访问的独立列表页），但优先级低于文章；V1 sitemap 不输出 `priority` |
| 下架导致总页数减少 | 全量重建 → 旧 `page/5.html` 自动消失；sitemap 移除（走 §3.4 S2 的 `removed_urls` 白名单） |

---

## 11. robots.txt 重设计（分爬虫组，官方依据）

### 11.1 关键标准语义（决定了怎么分组）

> **RFC 9309 §2.2.1**：爬虫匹配到**自己专属的 group** 后，**只**使用该 group 的规则，**不再合并** `User-agent: *` 的规则。

因此：
- **一旦为某个 UA 写了专属 group，就必须在该 group 内重新声明所有限制**（`/api/`、`/cms/`），**不能指望它继承通配组**。
- `Allow` 与 `Disallow` 冲突时，**最长匹配优先**，等长时 `Allow` 优先。所以 `Allow: /article/` + `Disallow: /` 是**允许 article、禁止其余**（不是反过来）。
- `Google-Extended` **没有独立 UA 字符串**，只是 robots.txt 令牌（官方原文），日志里看不到它，**无法用 UA 过滤验证**。

### 11.2 官方文档核实的 UA 清单（2026-11-09）

| 平台 | Token | 类型 | 官方说明要点 | 是否遵守 robots | 依据 |
|---|---|---|---|---|---|
| OpenAI | `OAI-SearchBot` | **检索** | 让站点出现在 ChatGPT 搜索结果；opt-out 后不出现在搜索答案 | 是 | platform.openai.com/docs/bots |
| OpenAI | `GPTBot` | **训练** | 抓取可能用于训练基础模型；禁止 = 不用于训练 | 是 | 同上 |
| OpenAI | `ChatGPT-User` | 用户触发 | 用户提问时的访问；**不用于自动爬全网**；官方明确"robots 规则可能不适用" | **可能不适用** | 同上 |
| OpenAI | `OAI-AdsBot` | 广告校验 | 仅访问作为广告提交的页面，不用于训练 | 官方未明确 | 同上 |
| Google | `Googlebot` | **检索** | 常规抓取，始终遵守 robots | 是 | developers.google.com/search/docs/crawling-indexing/google-common-crawlers |
| Google | `Google-Extended` | **训练/grounding** | 控制 Gemini 训练 + Gemini 应用 + Vertex AI grounding；**不影响搜索收录与排名**；**无独立 UA** | 是（令牌级） | 同上 |
| Anthropic | `ClaudeBot` | **训练** | 收集公开网页改进模型，可能进训练集 | 是 | support.claude.com（官方帮助中心） |
| Anthropic | `Claude-SearchBot` | **检索** | 抓取分析以提升搜索结果相关性 | 是 | 同上 |
| Anthropic | `Claude-User` | 用户触发 | 用户提问时代表用户访问 | 是 | 同上 |
| Perplexity | `PerplexityBot` | **检索** | 用于搜索索引展示与链接，**不用于训练基础模型** | 是 | docs.perplexity.ai（Crawlers） |
| Perplexity | `Perplexity-User` | 用户触发 | 用户请求的抓取，官方原文"generally ignores robots.txt rules" | **一般无视** | 同上 |
| 字节 | `Bytespider` | 训练/索引（未区分） | **未找到官方 UA 说明页面**；用途与 robots 行为需自行观察 | 【待验证】 | — |

**必须写进产品说明的两条**：
1. **UA 名称由各平台单方面定义，可随时变更**；上表是 2026-11-09 的快照，**每次改 robots 前必须复核官方页面**。
2. **robots.txt 是"请求"不是"强制"**，且对**用户触发型抓取**（`ChatGPT-User`、`Perplexity-User`）基本无效——它们的设计前提就是"用户要看这个页面"。
3. 补充：Google 官方页面提到**计划 2027 年初支持 AIPREF 的 `user-agent: __usage_ai-training`**；Anthropic 自 **2026-10-30** 起识别 AI 训练偏好信号，且**明确点名 `ClaudeBot` 的规则优先**。这说明"未来会出现统一的训练偏好信号"，V1 不押注，只写 explicit token。

### 11.3 建议的分组结构（**方案稿，不直接上线**）

```robots
# ── 默认组：搜索引擎 + 未列名爬虫 ──────────────────────────
User-agent: *
Allow: /
Disallow: /api/
Disallow: /cms/
Disallow: /spool/
Disallow: /article/t/          # 薄标签页不索引（同时页面内也有 noindex，双保险）
Sitemap: https://www.mcuatlas.xyz/sitemap.xml

# ── 检索型 AI（希望被引用：放行正文，禁后台）──────────────
User-agent: OAI-SearchBot
User-agent: Claude-SearchBot
User-agent: PerplexityBot
Allow: /
Disallow: /api/
Disallow: /cms/
Disallow: /spool/
Sitemap: https://www.mcuatlas.xyz/sitemap.xml

# ── 训练型 AI（是否放行 = Owner 策略，见 D9）───────────────
User-agent: GPTBot
User-agent: ClaudeBot
User-agent: Google-Extended
User-agent: Bytespider
Allow: /article/
Allow: /movie.html
Allow: /routes.html
Allow: /route-detail.html
Allow: /special.html
Allow: /news.html
Allow: /
Disallow: /api/
Disallow: /cms/
Disallow: /spool/
Sitemap: https://www.mcuatlas.xyz/sitemap.xml
```

要点：
- **每个 group 都重复写 `/api/`、`/cms/`、`/spool/` 与 `Sitemap`**，因为专属组不继承通配组（RFC 9309）。
- `Allow: /article/` + `Disallow: /` 的组合若使用，必须**每条都与 Disallow 配对**，且理解"最长匹配优先"（`/article/` 比 `/` 长 → 允许）。
- **`/cms/` 与 `/spool/` 的 Disallow 只有在这些路径公网可达时才有意义**。V1 走 SSH 隧道，它们根本不存在于公网 → **写入是无害的预防性声明**，但**不能把它当作安全措施**（真正的安全是"不监听公网"）。

### 11.4 变更流程（V1 不改线上 robots.txt）

| 步骤 | 动作 |
|---|---|
| 1 | 本报告 §11.3 作为**建议稿**，存 `docs/技术/robots.proposed.txt`（人工创建，非 CMS 自动生成） |
| 2 | Owner 审核 + 决定 D9（训练型放行与否） |
| 3 | 人工备份 `/www/wwwroot/mcu-h5/robots.txt.bak-<ts>` |
| 4 | 人工部署 + `curl -s https://www.mcuatlas.xyz/robots.txt` 复核 |
| 5 | 记录到 `docs/技术/运维变更台账.md` |

**CMS 永不在构建时写 robots.txt**（它属于 F1 之外但同样"手工授权"的文件，列入 F2 的"仅人工可改"子类）。

---

## 12. 媒体库（V1 最小可用 + 校验规则）

### 12.1 V1 范围收缩

| 能力 | V1 | 后续 |
|---|---|---|
| 上传（封面 + 正文图） | ✅ | — |
| 图片元数据（宽高/大小/sha256/alt/credit） | ✅ | — |
| 按文章查看已用图片 | ✅ | — |
| 删除（仅未被引用） | ✅ | — |
| 列表/搜索/批量/替换/裁剪 | ❌ | V1.1 |
| 图片重编码/压缩/多尺寸 | ❌ | 需图像库，与零依赖冲突；改用外部工具另行评估 |

**理由**：文章没有封面就没有 `og:image`，所以 V1 必须有"能上传一张封面并正确输出"的最小能力；但"媒体库管理"不是发布闭环的必要条件。

### 12.2 校验规则（全部硬性，任一不满足即拒绝）

| # | 规则 | 实现 |
|---|---|---|
| V1 | **扩展名必须与真实类型一致**：读 magic bytes 判定 `image/jpeg`(FFD8FF)、`image/png`(89504E47)、`image/webp`(RIFF....WEBP)；扩展名必须是对应的 `.jpg/.jpeg`、`.png`、`.webp` | 不一致 → `MIME_MISMATCH` |
| V2 | **禁止 SVG**（含 `image/svg+xml`、`.svg`、`.svgz`） | 显式黑名单 + magic bytes 不匹配双保险 |
| V3 | **禁止 GIF**（V1 简化；动图有像素炸弹风险） | 同上 |
| V4 | 文件大小 ≤ **2 MB** | `Content-Length` + 落盘后复核 |
| V5 | **最大像素数 ≤ 25,000,000**（25 MP），宽高各 ≤ 8000 | 解析图片头（JPEG SOF0/2、PNG IHDR、WebP VP8X/VP8/VP8L），**不依赖图像库** |
| V6 | **像素炸弹防护**：V5 在解码前完成（只读头部），任何算不出的尺寸一律拒绝 | — |
| V7 | **文件名由系统生成**：`<sha8>-<slug>.<ext>`，slug 只允许 `[a-z0-9-]{1,40}` | 忽略原始文件名 |
| V8 | **路径穿越防护**：目标路径 = `data/media/<YYYY>/<MM>/<生成名>`；`path.resolve` 后必须以 `data/media/` 为前缀；目录不存在则 `mkdir -p`，**不接受任何用户提供的目录片段** | 断言前缀 |
| V9 | 原始文件不得直接执行：目录位于 Web root 之外，只通过软链以静态资源形式暴露；扩展名白名单保证 Nginx 只按图片 Content-Type 处理 | 见 §12.3 |
| V10 | `alt` 必填（≥ 4 字），`credit` 选填 | 缺失 → 阻断发布（该图被使用时） |
| V11 | 相同 sha256 已存在 → 直接复用（不重复落盘） | 去重 |

### 12.3 存储与暴露

```
/www/wwwroot/mcu-cms/data/media/2026/11/a1b2c3d4-cover.webp    mcucms 0644
/www/wwwroot/mcu-h5/media → ../mcu-cms/data/media              软链，安装时由 owner 创建一次
公开 URL：https://www.mcuatlas.xyz/media/2026/11/a1b2c3d4-cover.webp
```

- 目录 `data/media` 属主 `mcucms`、权限 `0755`（需被 `www` 遍历读取）；`data/` 其余部分 `0700`。
- **媒体不随 release 切换**：媒体目录是"追加式不可变"的，因此**回滚永远不会导致图片 404**（这是刻意的设计属性）。
- 代价：媒体文件只增不减 → 删除策略见 §12.4。

### 12.4 删除与保留

| 规则 | 说明 |
|---|---|
| 删除 = 标记 `cms_media.status='trash'` + `trashed_at`，文件移入 `data/media-trash/` | 不物理删除 |
| 物理清理条件 | ① 状态 trash ≥ 30 天；② 未被任何 article（含历史修订）引用；③ **未被任何一个保留中的 release 的 HTML 引用**（扫描 `releases/*/**/*.html` 的 `/media/` 路径） |
| 清理由谁做 | root cron 单独的清理脚本（沿用 `retention-clean.cjs` 的"默认 DRY-RUN + 显式 `--apply`"纪律） |

### 12.5 媒体备份（强制项，不再是可选）

| 项 | 规则 |
|---|---|
| 频率 | 每周日 03:50（避开论坛 03:30、cms-db 03:40） |
| 方式 | `tar --create --gzip --file=/www/backup/cms-media/media-<YYYYMMDD>.tar.gz -C /www/wwwroot/mcu-cms/data media` |
| 保留 | 8 份（约 2 个月） |
| 校验 | 备份后 `tar -tzf` 列表行数 ≥ 文件数；并生成 `media-manifest-<date>.txt`（路径 + sha256） |
| 恢复校验 | 见 §13.5.3 |

> **注意**：服务器**没有 `rsync`**（已核实），所以所有备份/同步方案一律用 `tar` + `cp` + `sha256sum`，不要在设计里写 rsync。

---

## 13. 数据库 / Release / 备份一致性

### 13.1 DDL 修订要点（相对 V1.0 的差异）

| 变更 | 原因 |
|---|---|
| 全部内部关联加**外键**（`PRAGMA foreign_keys = ON`） | 原方案无外键，靠应用层自觉 |
| `cms_article_revisions` 增加 **`snapshot_json`**（文章全字段 + 实体 + 来源 + 标签快照） | 原方案只存 title/body，恢复会丢 SEO 字段与关联 |
| `cms_releases` 增加状态机字段（`phase`/`prev_symlink_seq`/`sitemap_sha256`/`error_code`/`heartbeat_at`/`attempt`） | 支撑 §5 |
| `cms_release_items` 增加 `rev_no` + `file_sha256` | 支撑"release 与文章版本一致"的断言 |
| 新增 `cms_jobs` | 发布是异步长任务，需要进度与超时 |
| 新增 `cms_backups` | 备份与 release 的引用关系需要落库 |
| `cms_media` 增加 `status`/`trashed_at` | 软删除 |
| `cms_articles` 增加 `published_revision_no`/`slug_locked`/`archived_at` | 版本一致性与 slug 锁定 |
| `cms_settings` 增加 `current_release_seq`/`current_sitemap_sha256`/`access_mode`/`site_seo_mode` | 运行时状态与模式开关 |

### 13.2 修订能否完整恢复所有字段（任务点名项）

**原方案缺陷**：`revisions` 只有 `title` / `body_md` / `meta_json`，而文章的**实体关联、来源、标签**在独立表里，恢复时若只回滚主表，会出现"正文回到旧版、来源仍是新版"的错位。

**修订**：每次保存生成修订时，`snapshot_json` 必须包含：

```json
{
  "article": { "title","subtitle","excerpt","body_md","type","category_id",
               "author_id","editor_id","source_note","cover_media_id",
               "seo_title","seo_description","seo_keywords","canonical_override",
               "robots","og_title","og_description","og_media_id","jsonld_type" },
  "entities": [ {"entity_type","entity_id","role","note","sort_order"} ],
  "sources":  [ {"url","title","publisher","published_at","source_type","accessed_at","quote","sort_order"} ],
  "tags":     ["tag-id", "..."],
  "schema_version": 1
}
```

**恢复（restore）语义**：单事务内 → 覆盖主表可编辑字段 → `DELETE` 并重建 entities/sources/tags → 写入新修订号（`rev_no = max+1`，**不删除任何历史**）→ 审计。**恢复不改变 `slug` / `status` / `published_*`**（这三项属于发布态，不随内容修订回滚）。

**校验**：恢复后断言「主表 19 个字段 + entities 集合 + sources 集合 + tags 集合」与快照逐项相等；不等则事务回滚。

### 13.3 release 与文章发布版本的一致性（任务点名项）

**不变量**（每次发布后、每次 `GET /cms/api/consistency` 时断言）：

```
I1: 对当前 release R：
    { a.id | a.status='published' AND a.published_release_id = R.id }
    == { i.article_id | i.release_id = R.id }

I2: 对每个 i ∈ R.items：
    i.rev_no == cms_articles.published_revision_no

I3: 对每个 i ∈ R.items：
    sha256(releases/<seq>/article/<slug>.html) == i.file_sha256

I4: cms_settings.current_release_seq == R.seq
I5: sha256(h5/sitemap.xml) == R.sitemap_sha256 == cms_settings.current_sitemap_sha256
I6: 不存在 status='published' 但 published_release_id 指向非当前 release 的文章
    （除显式"仅存在于历史 release"的归档态）
```

违反任一 → `health=degraded` + 后台红条 + 审计。**这是"数据库与线上一致"的可执行定义。**

### 13.4 外键 / 级联 / 软删除规则

| 关系 | 规则 | 理由 |
|---|---|---|
| `revisions.article_id → articles.id` | `ON DELETE RESTRICT` | 文章永不物理删除（只 `archived`），修订是资产 |
| `article_entities/sources/tags.article_id → articles.id` | `ON DELETE CASCADE` | 文章若真被删（仅测试库），子表跟随；生产不会触发 |
| `media` 被 `articles.cover_media_id/og_media_id` 引用 | **不建 FK**（可为 NULL，且历史修订也引用） | 改由应用层"引用计数"判断能否清理 |
| `release_items.release_id → releases.id` | `ON DELETE RESTRICT` | release 是审计资产 |
| `redirects` | 独立 | — |
| 软删除 | **只用 `status`**（`archived` / `unpublished`），**不设 `deleted_at`** | 避免"软删 + FK + 唯一约束"三者互斥的常见坑；slug 唯一性由 `slug` 列唯一索引保证（归档也占用） |
| `PRAGMA foreign_keys` | 每次连接 `db.exec('PRAGMA foreign_keys = ON;')` | SQLite 默认关闭 |

### 13.5 备份与保留策略（改掉原方案的"选做"）

#### 13.5.1 保留矩阵（必须同时满足，取交集）

| 对象 | 保留规则 |
|---|---|
| release 目录 | 保留 **最近 10 批**；**且**保留"当前线上"与"上一版"；**且**保留被最近 14 天任一 DB 备份引用到的所有 seq |
| `cms.db` 备份 | 每日 1 份，保留 **14 份**（覆盖 2 周） |
| sitemap 备份 | 每次发布 1 份，保留 **30 份** |
| 媒体 | 每周 1 份 tar.gz，保留 **8 份**；文件本身追加式不删 |
| 审计日志 | DB 内永久；发布日志按 logrotate 保留 8 周 |

**清理脚本的实现纪律**（沿用项目既有 `retention-clean.cjs` 模式）：
- 默认 **DRY-RUN**，必须显式 `--apply` 才删除；
- **硬编码白名单目录**，只允许删 `releases/` 下匹配 `^\d{6}$` 的子目录；
- **显式保护**：`current_release_seq`、`prev_release_seq`、`cms_backups` 里出现过的 seq、以及"目录 mtime 在 14 天内"的一律跳过；
- 删除前打印将要删除的清单与释放空间，删除后写审计。

#### 13.5.2 备份内容

| 备份 | 内容 | 校验 |
|---|---|---|
| `cms-<ts>.db` | `sqlite3 .backup`（WAL 安全，**禁止直接 `cp` 正在写的 db**） | 备份后 `PRAGMA integrity_check` + 表行数 + `settings.current_release_seq` 落 `cms_backups` |
| `media-<date>.tar.gz` | `data/media` 全量 | `tar -tzf` 行数 + manifest sha256 |
| `sitemap-<ts>.xml` | 发布时自动 | sha256 与 release 记录比对 |

> **WAL 关键细节**：`cms.db` 运行时会存在 `cms.db-wal` / `cms.db-shm`。`.backup` 命令会把 WAL 内容合并进备份文件，**这是唯一正确的在线备份方式**；`cp cms.db` 会丢最近的 WAL 提交。
> **已核实**：系统 `sqlite3` 为 3.26.0，`.backup` 在该版本可用（论坛库每日 03:30 备份已连续产出文件）。**不在 CMS 库使用 `STRICT` 表**（3.37+ 特性），否则旧 CLI 解析 schema 会失败。

#### 13.5.3 恢复流程（可直接执行，含校验）

```bash
# ── 0. 记录现状
systemctl stop mcu-cms
readlink /www/wwwroot/mcu-h5/article           # 记录当前 seq
sha256sum /www/wwwroot/mcu-h5/sitemap.xml

# ── 1. 校验备份可用
sqlite3 /www/backup/cms-db/cms-20261109-034000.db "PRAGMA integrity_check;"   # 期望 ok
sqlite3 /www/backup/cms-db/cms-20261109-034000.db "SELECT COUNT(*) FROM cms_articles WHERE status='published';"
sqlite3 /www/backup/cms-db/cms-20261109-034000.db "SELECT value FROM cms_settings WHERE key='current_release_seq';"
#    → 得到 seq_backup，例：000006

# ── 2. 检查该 seq 的 release 是否存在
test -d /www/wwwroot/mcu-cms/releases/000006/article && echo "release OK" || echo "release MISSING"

# ── 3. 恢复 DB（必须先停服务、必须删 WAL/SHM）
rm -f /www/wwwroot/mcu-cms/data/cms.db-wal /www/wwwroot/mcu-cms/data/cms.db-shm
cp /www/backup/cms-db/cms-20261109-034000.db /www/wwwroot/mcu-cms/data/cms.db
chown mcucms:mcucms /www/wwwroot/mcu-cms/data/cms.db && chmod 600 /www/wwwroot/mcu-cms/data/cms.db

# ── 4. 校验媒体完整性（manifest 来自媒体备份同批次）
cd /www/wwwroot/mcu-cms/data && sha256sum -c /www/backup/cms-media/media-manifest-20261108.txt --quiet
#    → 缺失/损坏会列出；缺失媒体 → 从 tar 恢复对应文件

# ── 5. 起服务 + 一致性检查
systemctl start mcu-cms
curl -s http://127.0.0.1:8790/cms/api/consistency -H "Cookie: ..." | jq .
#    → I1..I6 全 true 才算恢复完成

# ── 6. 若 release 缺失（第 2 步 MISSING）
#    不要回切到不存在的目录；直接从 DB 重建一个新 release：
node /www/wwwroot/mcu-cms/app/build/build.cjs --rebuild --from-db
#    → 新 seq，再走一次发布（校验 + 切换）
```

**两个必须写进文档的结论**：
1. **DB 是内容的事实源**（`body_md` + 全部元数据都在库里），所以"release 目录丢了"可以**重建**，不构成数据丢失 —— 这是"从 DB 构建"架构的最大好处。
2. **媒体不在 DB 里**，所以**媒体必须独立备份且必须校验**，否则会出现"文章还在、图全 404"。

#### 13.5.4 恢复演练（季度，必须真跑）

演练脚本（不装工具，纯 bash）在 `tmp/` 下恢复到一个**临时端口 + 临时目录**，跑 I1–I6，输出报告；**演练不触碰生产路径**。V1 验收要求完成 1 次演练并留报告。

### 13.6 未启用但预埋的表（避免未来重构）

`cms_page_meta`（L4/L5 用）：`path`（如 `/movie.html`）、`title`、`description`、`canonical`、`robots`、`og_*`、`updated_at`、`enabled`（默认 0）。
**V1 不建此表也不读它**——只在设计文档里保留结构，等 `site_seo_mode` 从 `cms_only` 切到 `full_site` 时再建。**理由**：建了空表容易被误认为"已支持"。

---

## 14. GEO 重新定位：从"评分"改为"内容质量检查"

### 14.1 定位修正

| 原方案 | 修订后 |
|---|---|
| 12 条 GEO 规则 + 一个分数，隐含"分数高 = 容易被 AI 引用" | **内容质量检查（Content Quality Check, CQC）**：只做**可判定的事实性/结构性检查**，输出"问题清单"，**不输出概率、不预测排名、不预测引用** |
| 分数 < 70 标红 | **取消总分数**。保留"严重度"（阻断 / 告警 / 人工），不做伪量化 |

### 14.2 五类检查（对应任务要求的五个维度）

| 类 | 检查什么 | 示例规则 |
|---|---|---|
| **C1 内容完整性** | 结构是否完整、能否独立回答标题问题 | 有摘要；正文 ≥ 300 字（<300 阻断，300–600 告警）；H2 ≥ 2；至少 1 个列表或表格；有结尾段 |
| **C2 来源可追溯性** | 事实能否追溯到来源 | 有来源记录时：URL 合法、`source_type` 有值、`accessed_at` 有值；**正文出现数字/日期/引语时，必须能对应到某条来源**（启发式：正则抽日期/数字，提示人工核对） |
| **C3 实体关联** | 是否挂到本站实体体系 | 至少关联 1 个实体；关联实体在 `h5/data` 中存在；正文提到的作品名（与 `MCU_CONTENT.cn` 全等匹配）若出现 ≥ 2 次但未关联 → 告警 |
| **C4 内容结构** | 是否利于"被摘录" | 首段 40–80 字的结论块；标题层级不跳级；单段 ≤ 400 字；长表格/长列表有 caption 或引导句 |
| **C5 表达与引用质量** | 是否有不可核实的表述 | 命中"据悉/网传/有消息称/据说"且无对应来源 → 告警；"最/第一/唯一"等绝对化表述且无来源 → 告警；外链无 `rel` → 构建期已阻断 |

### 14.3 三级严重度（取代分数）

| 级别 | 含义 | 处理 |
|---|---|---|
| **BLOCK（阻断）** | 发布后必然产生错误或缺失关键信息 | 不能发布。例：无摘要、无标题、无作者、正文 < 300 字、JSON-LD 必填缺失、内部链接断裂、实体 id 不存在 |
| **WARN（告警）** | 可能存在质量问题，需人工判断 | 可发布，但后台与发布记录里留痕。例：无外部来源、结构缺项、绝对化表述、来源类型单一 |
| **HUMAN（人工）** | 机器无法判断 | 列成"待人工确认"清单。例：事实是否准确、引语是否断章取义、是否涉及剧透 |

### 14.4 明确取消的规则（原方案不合理处）

| 原规则 | 为什么取消 |
|---|---|
| "至少一条 `source_type='official'` 否则告警" | **强制所有原创文章都要外部官方来源是不合理的**。原创分析（如"为什么这条路线更适合新人"）没有官方来源，来源就是作者本人。改为：`source_type` 可为 `original`（作者自述），此时 WARN 不阻断，且页面显示"本文为本站原创分析" |
| "GEO 分数 < 70 标红" | 伪量化。分数与"是否被 AI 引用"无因果关系 |
| 任何"提升 AI 引用概率"的表述 | 不成立。**GEO 只能提高"被正确理解与摘录"的结构性概率，不能保证被引用** |

### 14.5 页面上的呈现（可见、诚实）

```html
<!-- 文章页底部 -->
<section class="sources">
  <h2>资料来源</h2>
  <ol>
    <li><a href="https://www.marvel.com/..." rel="noopener noreferrer">Marvel 官方</a>（官方，访问于 2026-11-08）</li>
    <li>本站原创分析（作者：xxx，2026-11-09）</li>
  </ol>
  <p class="note">本文信息以文中所列来源为准；如发现错误请在社区反馈。</p>
</section>
```

原创文章显示"本站原创分析"，**不伪造外部来源**。

---

## 15. API 修订（相对 V1.0 的增量与变更）

| 变更 | 端点 | 说明 |
|---|---|---|
| 改 | `POST /cms/api/articles/:id/preview` | **必须 POST + CSRF**（不允许 GET，避免 URL 泄漏草稿）；返回 HTML + 独立 CSP（§16.5） |
| 改 | `POST /cms/api/releases` | 增加 `dry_run`（只构建+校验，不切换）；**异步返回 `job_id`** |
| 增 | `GET /cms/api/jobs/:id` | 发布任务进度（`phase`、`progress`、`error`）；前端轮询 1s |
| 增 | `GET /cms/api/consistency` | 返回 I1–I6 断言结果（§13.3） |
| 增 | `POST /cms/api/maintenance/reconcile` | 手动触发对账（仅 owner；用于 `inconsistent` 后） |
| 增 | `GET /cms/api/releases/:id/diff` | release 变更清单（新增/更新/下架 URL） |
| 增 | `POST /cms/api/media/:id/trash` / `restore` | 软删/还原（替代直接 DELETE） |
| 删 | `DELETE /cms/api/articles/:id` | 改为 `archive`（软删），不提供物理删除 |
| 保留 | 其余（登录/文章 CRUD/分类/标签/实体/来源/审计） | 同 V1.0 |

**统一约定**：
- 所有写操作要求 `X-CSRF-Token`；所有响应 `Cache-Control: no-store`；
- 错误码稳定（`{error:{code,message}}`），前端按 `code` 分支；
- 分页统一 `?page=&size=`，`size` 上限 50；
- 时间一律 ISO8601 UTC 字符串。

---

## 16. 安全设计复核（含发现的新问题）

### 16.1 口令与登录

| 项 | 方案 |
|---|---|
| 算法 | `scrypt(N=16384, r=8, p=1, keylen=64, salt=16B)`（Node `crypto.scryptSync`，单次约 50–80 ms、约 16 MB 临时内存，可接受） |
| 存储 | `scrypt$16384$8$1$<saltB64>$<hashB64>` |
| 比较 | `crypto.timingSafeEqual` |
| 限速 | 单 IP 5 次/15 分钟；单账号 10 次/15 分钟；超限锁 15 分钟（内存计数 + 落 `cms_audit_log`） |
| 口令强度 | ≥ 12 字符，禁止与用户名相同 |
| 初始口令 | 首次启动生成随机口令写入 `data/initial-password.txt`（0600），首次登录强制修改后删除该文件 |

### 16.2 Session 与 CSRF（**修掉原方案的内部矛盾**）

**原方案矛盾**：`HttpOnly + Secure + SameSite=Strict` 的 Cookie，**在 SSH 隧道的 `http://127.0.0.1:8790` 下根本不会被浏览器回传**（`Secure` 只允许 HTTPS）。等于"按方案实现就登录不上"。

**修订：双模式，由配置显式选择**

| 模式 | 触发 | Cookie 属性 | 额外防护 |
|---|---|---|---|
| `access_mode=tunnel`（V1 默认） | 仅 `127.0.0.1:8790` 可达 | `HttpOnly; SameSite=Strict; Path=/cms`（**不设 Secure**） | ① 服务只 bind `127.0.0.1`；② **强制校验 `Host` ∈ {`127.0.0.1:8790`,`localhost:8790`}**（防 DNS rebinding）；③ 强制校验 `Origin`（若有）与 `Host` 一致 |
| `access_mode=proxy`（V1.5，走 `/cms/` 反代） | HTTPS 反代 | `HttpOnly; Secure; SameSite=Strict; Path=/cms` | ① 只信任反代来的 `X-Forwarded-Proto: https`；② 同样校验 `Host` 白名单 |

| 项 | 方案 |
|---|---|
| Token | 32B 随机 → Cookie；DB 只存 `sha256(token)` |
| 过期 | 12 h **绝对**过期（不滑动），到期强制重登 |
| 轮换 | 每次登录新建；改密/禁用用户 → 撤销全部会话 |
| CSRF | 双提交：`cms_csrf` Cookie（非 HttpOnly）+ 请求头 `X-CSRF-Token`，`timingSafeEqual` 比对；所有非 GET 强制 |
| 会话固定 | 登录成功后**重新生成** session id |
| 登出 | 服务端撤销（`revoked_at`），非仅删 Cookie |

### 16.3 文章预览的权限与隔离（任务点名项）

| 风险 | 对策 |
|---|---|
| 预览 URL 被外部访问 | **无独立 URL**：预览内容只通过 `POST /cms/api/articles/:id/preview` 返回，需登录 + CSRF，`Cache-Control: no-store` |
| 预览 HTML 在 CMS 源上执行脚本（XSS 直达后台） | ① 预览响应头 `Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline' https://www.mcuatlas.xyz; img-src https://www.mcuatlas.xyz data:; font-src https://www.mcuatlas.xyz; base-uri 'none'; form-action 'none'`；② 前端用 `<iframe sandbox>`（**空 sandbox**，不授予 `allow-scripts` / `allow-same-origin`）→ 脚本不执行、且为不透明源，拿不到 CMS 的 Cookie/DOM |
| 预览内容与最终产物不一致 | 预览与构建**调用同一个渲染函数**（同一份模板 + 同一个 markdown 渲染器），只差"是否落盘"；在响应里返回 `rendered_sha256`，构建时断言一致（差异 → 告警） |
| 预览泄露草稿 | 预览响应里加 `X-Robots-Tag`? 不需要（不落盘、不公网）；但不允许把预览 HTML 复制到 `article/` 目录 |

### 16.4 权限隔离核对（CMS vs Forum）

| 项 | 现状 | 目标 |
|---|---|---|
| 系统用户 | `forumapi`（已有）、`mcucms`（待建） | 两个独立 `nologin` 用户 |
| 目录 | `/www/wwwroot/forum-api`（forumapi）、`/www/wwwroot/mcu-cms`（mcucms） | 互不可写 |
| **发现的问题** | `/www/wwwroot/forum-api/data/forum.db` 权限 **644**（world-readable），`secret.key`/`admin-token.key` 是 600【核实】 | 建议（需 owner 授权，**本次未改**）：`forum.db` 改 `600` 或 `640` + 专用组；否则**任何本机普通用户（含 mcucms）都能读论坛全部数据** |
| 进程隔离 | `MemoryMax`、`NoNewPrivileges`、`PrivateTmp` | CMS 同样配置，并加 `ProtectSystem=strict` + `ReadWritePaths` |
| 网络 | forum 仅 `127.0.0.1:8787` | CMS 仅 `127.0.0.1:8790` |
| 提权 | 论坛无提权路径 | CMS 有 sudo 白名单（§4），论坛**不得**获得同样权限 |

### 16.5 其他安全修正

| 项 | 修正 |
|---|---|
| 上传目录执行 | 媒体在 Web root 之外 + 只允许 3 种图片扩展名；即使有人塞入 `.php` 也无法被 Nginx 当脚本执行（`location ~ \.php$` 只对 `.php` 生效，而我们的目录里不会有 `.php`——且 CMS 生成的文件名由系统决定） |
| 错误信息 | 生产不返回堆栈；统一 `{error:{code,message}}`；详细错误只进日志 |
| 日志注入 | 审计日志的 `detail` 里的用户输入做 JSON 序列化 + 换行转义 |
| 依赖 | 零 npm 依赖 → 无供应链风险；若 M3 降级到 `markdown-it`，必须锁版本 + 记录 sha256 + 来源 URL |
| 敏感信息 | CMS 不读取、不存储任何第三方密钥；`dashscope.env` 等与 CMS 无关 |

---

## 17. 任务第五节 17 项技术细节复核（逐条回答）

| # | 检查项 | 原方案 | 结论 | 修订 |
|---|---|---|---|---|
| 1 | 修订能否恢复所有字段 | 只存 title/body/meta | ❌ **不能** | `snapshot_json` 全字段 + 关联快照（§13.2） |
| 2 | release 与文章发布版本一致性 | 无显式不变量 | ⚠️ 靠自觉 | I1–I6 六条不变量 + `consistency` 接口（§13.3） |
| 3 | 外键 / 级联 / 软删除 | 无 FK、无规则 | ❌ 缺失 | FK 表 + RESTRICT/CASCADE 规则 + 只用 `status` 软删（§13.4） |
| 4 | 审计是否覆盖关键操作 | 列了 6 类 | ⚠️ 不全 | 扩到 14 类，含登录失败/恢复/回滚/清理（§17.1） |
| 5 | 密码 / Session / CSRF | `Secure` + 隧道**互斥** | ❌ 不可运行 | 双模式 Cookie + Host/Origin 校验（§16.2） |
| 6 | 预览是否需要独立权限 | 未明确 | ⚠️ | POST-only + CSRF + 空 sandbox iframe + 严格 CSP（§16.3） |
| 7 | 媒体上传/删除权限 | 未定义 | ⚠️ | editor+；删除仅未被引用；软删 + 30 天（§12.4） |
| 8 | CMS 与 Forum 权限隔离 | 概念性 | ⚠️ 且有**现存漏洞**：forum.db 644 | 独立用户 + 建议收紧 forum.db 权限（§16.4） |
| 9 | SQLite WAL 备份与恢复 | 只说 `.backup` | ⚠️ 缺恢复细节 | 禁 `cp`、恢复前删 `-wal/-shm`、`integrity_check`（§13.5） |
| 10 | 软链与 Nginx 实际权限 | 未验证 `www` 可遍历 | ⚠️ | `releases` 755、`data` 700；`www` 只需 `o+x` 路径穿越（§13.7） |
| 11 | 构建 tmp 与 release 同文件系统 | 断言过 | ✅ 已核实同设备 | 助手额外断言 `st_dev` 相等（§4.2.4-4） |
| 12 | 下架桩页的 sitemap 与内链 | 未处理内链 | ❌ 缺失 | 桩页 + sitemap 移除 + **内链扫描阻断**（§17.2） |
| 13 | 分页静态文件 | `?page=n` 无文件 | ❌ 缺陷 | 真实分页文件 + 目录/文件冲突修正（§9.3、§10） |
| 14 | robots 分组继承 | 假设继承通配 | ❌ 事实错误 | 每组重复声明（RFC 9309）（§11.1） |
| 15 | JSON-LD 与脚本规则 | 互斥 | ❌ 冲突 | 脚本三分类（§2） |
| 16 | 冻结集含 sitemap | 互斥 | ❌ 冲突 | 四级分类（§3） |
| 17 | 发布提权 | setuid | ❌ 不可实现且危险 | sudo 无参助手（§4） |

### 17.1 审计日志覆盖清单（14 类）

`login_success` / `login_fail` / `logout` / `article_create` / `article_update` / `article_publish` / `article_unpublish` / `article_archive` / `revision_restore` / `category_write` / `media_upload` / `media_trash` / `release_build` / `release_switch` / `release_rollback` / `settings_write` / `user_write` / `maintenance_reconcile` / `backup_run` / `restore_run`

每条记录：`at / user_id / action / target_type / target_id / result / ip / request_id / detail(JSON, 不含正文全文，只含 sha256 与字段名)`

### 17.2 下架桩页的完整处理（任务点名项）

| 步骤 | 处理 |
|---|---|
| 文件 | 生成 `article/<slug>.html`，内容为：标题、下架说明、发布日期、返回分类/索引的链接；`<meta name="robots" content="noindex,follow">`；canonical 自指 |
| sitemap | **移除**该 URL，并写入 release 的 `removed_urls`（否则 §3.4-S2 会拒绝） |
| 内链 | **构建后全站扫描**：任何生成页里出现指向该 slug 的 `<a href>` → **阻断发布**，提示"请先清理这些引用"（列出文件名与行号） |
| 实体关联 | 该文章从"相关文章"列表移除（列表由 DB 查询生成，天然生效） |
| 重发 | 允许重新发布（slug 复用同一篇），桩页被正常页覆盖 |
| 永久删除 | 不提供（归档即可） |

### 17.3 目录权限矩阵（供实施时照抄）

| 路径 | 属主:组 | 权限 | 谁需要访问 |
|---|---|---|---|
| `/www/wwwroot/mcu-cms` | `root:root` | 755 | www 穿越 |
| `.../app` | `mcucms:mcucms` | 750 | mcucms 读、root 读 |
| `.../data` | `mcucms:mcucms` | 700 | 仅 mcucms |
| `.../data/media` | `mcucms:mcucms` | 755 | mcucms 写、www 读 |
| `.../releases` | `mcucms:mcucms` | 755 | mcucms 写、www 读（经软链） |
| `.../releases/NNNNNN/article` | `mcucms:mcucms` | 755 / 文件 644 | www 读 |
| `.../spool` | `mcucms:mcucms` | 700 | mcucms 写、root 读 |
| `.../logs` | `mcucms:adm` | 750 | mcucms 写、adm 读 |
| `/www/wwwroot/mcu-h5/article` | 软链 → `releases/<cur>/article` | — | www 经此读 |
| `/www/wwwroot/mcu-h5/media` | 软链 → `data/media` | — | www 经此读 |

> **`www` 只读、`mcucms` 写自己、`root` 只通过助手写"软链 + sitemap"** —— 三方权限互不重叠。

---

## 18. V1 范围收敛

### 18.1 V1 必须做（对应任务 13 项，逐项落位）

| # | 能力 | 里程碑 | 验收要点 |
|---|---|---|---|
| 1 | 后台安全登录 | M1 | scrypt + 限速 + 双模式 Cookie + Host 校验 |
| 2 | 文章新增/编辑/草稿/预览/发布/下架 | M2/M6 | 状态机 `draft→published→unpublished→archived`；下架走桩页 |
| 3 | 分类管理 | M2 | slug 唯一 + 自有 TDK + 空分类不生成 |
| 4 | Markdown 编辑 | M3 | 40 用例全绿 + 不支持语法报错 |
| 5 | 独立 SEO TDK | M5 | L1 全字段 + 长度校验 |
| 6 | 作者/摘要/来源管理 | M4 | 来源表 + 作者必填 + 来源可显示 |
| 7 | 静态 HTML 生成 | M5 | 正文可 `grep`；可执行脚本 = 0 |
| 8 | JSON-LD | M5 | Article + BreadcrumbList，可 `JSON.parse` |
| 9 | Sitemap 安全更新 | M6 | 单一所有者 + 只增不减 + 原子替换 |
| 10 | 发布记录 | M6 | release 表 + 逐项 sha256 + diff |
| 11 | 内容修订及回滚 | M2 | 全字段快照恢复 + 不删历史 |
| 12 | 基础 GEO 检查 | M5 | 5 类 20 条规则 + 3 级严重度 |
| 13 | 基础备份与恢复 | M7 | db + media + sitemap 三备份 + 恢复脚本 + 1 次演练 |

### 18.2 延后的功能（含原因与未来接入方式）

| 功能 | 延后原因 | 未来接入方式 | 预估 |
|---|---|---|---|
| **完整媒体库**（列表/搜索/批量/替换/裁剪/多尺寸） | 不是发布闭环的必要条件；V1 只解决"有封面" | 在现有 `cms_media` 表上加 `GET /cms/api/media?q=` + 后台媒体页；多尺寸需外部工具（零依赖做不到） | 3 人日 |
| **复杂实体关联面板**（关系图/批量/按关系类型分组） | V1 只需"关联 1–10 个实体"，用搜索+多选足够 | 复用 `h5/data/relations` 做可视化，只读 | 2 人日 |
| **RSS** | 无读者基数；对收录无直接影响 | 构建器加一个 `feed.xml` 模板（复用文章列表查询） | 1 人日 |
| **更复杂的 GEO 分析**（语义相似、事实比对、外部源交叉验证） | 需 NLP/外部 API，与零依赖冲突 | 作为离线脚本 + 人工抽检；或接入本地小模型（需评估内存） | 3–5 人日 |
| **全站现有 H5 页面 SEO 后台管理**（L4） | 必须改 15 个 F1 冻结文件，违反保护范围 | 整页改由构建器生成：先冻结基线 → 生成 → 逐字节 diff → 人工确认后切换 | 6–8 人日 |
| **作品/人物资料静态化**（L5） | 涉及 50 个 URL 与三端数据，属独立工程 | 生成 `/movie/<id>` 等静态页 + 301（需 Nginx）；先做 10 个样本验证收录变化 | 8–12 人日 |
| **301 管理** | 需 Nginx 变更（map + reload），不在 V1 授权范围 | `cms_redirects` 导出 map + 助手原子替换 + reload（§9.5） | 2 人日 + 1 次变更 |
| **AI 爬虫访问日志分析** | 需读 access log 并做 UA 聚合；V1 无公网入口时意义有限 | 独立只读脚本，输出周报（不写入 CMS 库） | 1 人日 |

### 18.3 V1 明确不做（避免范围蔓延）

评论、会员、投稿、AI 生成文章、拖拽编辑器、多语言、CDN、图片处理、搜索（站内搜索）、多作者权限矩阵（V1 三角色够用）。

---

## 19. 工作量估算（修订）

| 里程碑 | 内容 | 人日 |
|---|---|---|
| **M0 基线 / 骨架 / 权限** | 冻结集 sha256 脚本；目录与权限矩阵；systemd 单元；`OOMScoreAdjust`；备份 cron 骨架；`baseline.json` | 3 |
| **M1 数据与鉴权** | `schema.sql`（含 FK）；repo 层；scrypt；双模式 Session；CSRF；Host 校验；审计 14 类；health | 4 |
| **M2 文章核心** | 文章 CRUD；状态机；`snapshot_json` 修订与恢复；分类/标签；slug 锁与保留字 | 5 |
| **M3 Markdown** | 受限解析器；40 条测试；错误码；编辑器提示 | 3 |
| **M4 关联 / 来源 / 最小媒体** | 实体只读加载与检索；来源 CRUD；媒体上传（magic bytes + 尺寸头解析）、软删 | 4 |
| **M5 构建与校验** | 模板（文章/分类/索引/分页/桩页）；JSON-LD；CQC 5 类 20 条；15 项校验器；分页 | 6 |
| **M6 发布与恢复** | 9 阶段状态机；sudo 助手（含全部校验）；`reconcile`；sitemap 工具扩展 + 集成；HTTP 自检 | 5 |
| **M7 后台 UI / 一致性 / 备份 / 验收** | 8 个后台页面；`consistency` 接口；备份脚本；恢复演练；e2e 脚本；运维手册 | 4 |
| **合计** | | **34 人日** |

**与 V1.0 报告（18–22）的差异说明**（+12 人日，全部有据）：

| 增量 | 人日 | 原因 |
|---|---|---|
| 发布助手 + 全部校验 + 恢复对账 | +3 | 原方案用 setuid 一句话带过，实际需完整校验链与幂等设计 |
| 9 阶段状态机 + reconcile | +2 | 原方案"软链即原子"，未覆盖 8 种失败 |
| 修订全字段快照 + 一致性不变量 | +1.5 | 原方案会丢 SEO 字段与关联 |
| Markdown 独立里程碑 + 40 用例 | +3 | 原方案把渲染器算进"构建器"里，低估 |
| 静态分页 + 目录冲突修正 | +1 | 原方案有缺陷，等于重做 |
| 内存实测 + 降级路线落地 | +1 | 原方案没有验收动作 |
| 备份/恢复/演练 | +0.5 | 原方案"备份选做" |

**区间**：**30–38 人日**，中位 **34**。按每周 3 个有效人日计 ≈ **11 周**。

---

## 20. 风险登记（修订版）

| # | 风险 | 等级 | 变化 | 缓解 |
|---|---|---|---|---|
| R1 | 内存不足 → OOM 杀掉现有服务 | **高** | 原为"高"，现**增加了可执行验收与降级路线** | §6：5 项实测 + 阈值 + 4 条降级 + `OOMScoreAdjust=500` |
| R2 | 证书 2026-12-14 到期，无自动续签 | **高** | 未变（仍未处理） | G1 前置门；纳入台账 |
| R3 | 发布权限机制被绕过 | 中 | **降级**（setuid → sudo 无参 + 助手自校验） | §4；三层日志 |
| R4 | 发布失败导致线上不一致 | 中 | **降级**（有状态机 + 对账 + 显式 degraded） | §5 |
| R5 | Sitemap 双写 | 中 | **降级**（四级分类 + 单一所有者） | §3 |
| R6 | Markdown 解析器有 XSS/边界缺陷 | 中 | 新增 | 40 用例 + 默认全转义 + 不支持即报错 + 降级条件 |
| R7 | 数据双源（治理铁律） | 中 | 未变 | 只读 `vm` 加载、不写回、DB 只存 id |
| R8 | 全站备份与生产同盘 | 中 | 未变（登记） | 后续异地化（owner 决策） |
| R9 | `/api/` 前缀冲突 | 中 | **已消除**（明确 `/cms/`） | §15 |
| R10 | 分页/目录与 `try_files` 冲突 | 中 | **已消除**（改目录式） | §9.3 |
| R11 | robots 分组误以为继承通配 | 中 | **已消除**（每组重复声明） | §11.1 |
| R12 | 现有 38 作品页对非 JS 抓取器同质 | 中 | 未变（登记为 L5） | §8.1 |
| R13 | 论坛 DB 644（任何本地用户可读） | 中 | **新发现** | 建议收紧（需授权） |
| R14 | 单人维护 + 无 CI | 中 | 未变 | 守卫脚本化 + 退出码 + 禁止手工 `cp` |
| R15 | 媒体不随 release 回滚（设计使然） | 低 | 新增说明 | 媒体不可变 → 回滚不会 404；代价是只增不减 |
| R16 | 文章页无站内入口（导航冻结） | **中** | **新发现** | 需 owner 决策（D4）；否则 V1 上线后无自然流量 |

---

## 21. 需要 Owner 决策 / 授权的事项

| ID | 事项 | 为什么必须 Owner 定 | 建议 | 阻塞哪个里程碑 |
|---|---|---|---|---|
| **D1** | **证书续签与部署**（2026-12-14 到期） | 涉及阿里云控制台与证书私钥 | 立即续签，并把 `mcuatlas.xyz` 纳入 acme.sh（webroot 模式），避免每年手工 | 全部（G1） |
| **D2** | **是否停用/降配 WordPress + php-fpm**（可释放 ≈ 400 MB） | 可能影响 `yaoqiang.xin` 业务 | 建议先确认该站是否仍有业务；若已废弃，停服是最省的内存方案 | M6（发布权限与内存验收） |
| **D3** | **是否允许 V1.5 的 Nginx 变更**（`/cms/` 反代、301 map） | 保护范围明确禁止改 Nginx | 建议 V1 不改，V1.5 一次性变更（含回滚备份） | 不阻塞 V1 |
| **D4** | **是否允许在现有 H5 加入口**（导航/首页 1 个链接到 `/article/`） | 会改 F1 冻结文件 | 建议：V1 先"无入口上线"验证链路，V1.1 用 1 个变更单加入口 | 不阻塞，但影响 V1 的实际价值 |
| **D5** | **安全组收敛**（8888 宝塔、3306 MariaDB 对外监听） | 需云控制台，且属全站安全 | 建议只放 22/80/443；8888 加 IP 白名单 | 不阻塞 |
| **D6** | **备份异地化** | 有成本 | 建议对象存储 + 每周同步 | 不阻塞 |
| **D7** | **发布权限方案选 A（sudo）还是 B（socket 服务）** | 涉及 sudoers 或新增 root 服务 | 建议 A | M6（G3） |
| **D8** | **`forum.db` 权限收紧（644 → 600/640）** | 属 Forum API 范围，本任务禁改 | 建议收紧；若同意，需单独变更单 | 不阻塞 |
| **D9** | **训练型 AI 爬虫是否放行**（GPTBot/ClaudeBot/Google-Extended/Bytespider） | 内容策略 | 建议：检索类全放行；训练类**放行**（本站在意曝光而非版权），但由 Owner 定 | 不阻塞（robots 单独变更） |
| **D10** | **原创文章是否允许无外部来源** | 内容政策 | 建议允许，标记 `original` + 页面显示"本站原创分析" | M5（CQC 规则） |
| **D11** | **文章页导航/页脚的视觉规范**（现有 nav 由 JS 生成，文章页需静态复刻） | 涉及设计一致性，需设计侧输入 | 建议：静态复刻现有 nav 结构 + 复用现有 CSS Token，由设计侧确认 | M5（模板） |
| **D12** | **是否接受"文章页零统计脚本"** | 影响数据观测 | 建议接受（V1 优先正确性与性能） | M5 |

---

## 22. 开发前置条件（Gate：不过不开工）

| Gate | 内容 | 判据 | 责任人 |
|---|---|---|---|
| **G1 证书** | `mcuatlas.xyz` 证书剩余有效期 ≥ 60 天，且续签方式确定（自动或人工台账） | `openssl x509 -enddate` 复核 | Owner |
| **G2 内存** | 完成 §6.2 的 M1–M5 测量（可用**模拟负载**代替：用一次性脚本申请/释放内存 + 并发 curl，不需要真实 CMS），确认满足 §6.3 阈值；否则选定降级路线（R2/R3/R4） | 测量报告 + 结论 | 开发 + Owner |
| **G3 发布权限** | D7 定案；sudoers 或 socket 服务方案评审通过；**评审通过 ≠ 已创建**（创建在 M6） | 方案签字 | Owner |
| **G4 冻结基线** | `baseline.json` 已生成并在**本地**跑通（不部署） | 脚本输出 38 个文件 sha256，重复运行一致 | 开发 |
| **G5 视觉规范** | D11 得到设计侧确认（或明确"先复用现有结构，后续再调"） | 一句话结论即可 | 设计 + Owner |
| **G6 robots 建议稿** | D9 定案，`robots.proposed.txt` 归档（**不部署**） | 文件存在 + Owner 确认 | Owner |

> **G2 与 G3 是硬门**：G3 未定案则 M6 无法开工（不能先写一个"待定"的提权代码）；G2 未通过则必须先在 R1–R4 里选一条，否则 M5/M6 的构建与发布设计会返工。

---

## 23. 待验证事项（本轮未做，必须真实运行才能确认）

| # | 事项 | 为什么没做 | 下一步 |
|---|---|---|---|
| V1 | 内存 M1–M5 实测 | 需起进程/造负载 | G2，低峰执行 |
| V2 | sudo 无参调用的实际行为（`""` 语法在 1.9.5p2 的表现） | 需创建用户与 sudoers | M6 前的沙箱验证（可在测试机或用 `sudo -l -U` 干跑） |
| V3 | `www` 用户能否穿过 `mcu-cms/releases` 读到文件 | 需建目录与软链 | M0 用临时目录模拟（不触碰 mcu-h5） |
| V4 | `rename` 覆盖已存在软链在目标 fs 上的行为 | 同上 | M0 临时目录验证 |
| V5 | `node:sqlite` 在 FK 开启下的行为、`.backup` 对新库的兼容性 | 需建库 | M1 沙箱库验证（放 `tmp/`，不进生产） |
| V6 | Nginx 对 `index.html` 目录索引的实际响应（分类页依赖它） | 需真实文件 | 用一个**不影响 sitemap 的**临时目录验证，或 M5 首次构建后自检 |
| V7 | 08:00 采集 cron 与构建并发的实际内存 | 需在 08:00 观察 | 观察 2 天 |
| V8 | `Bytespider` 的 UA 与 robots 行为 | 无官方文档 | 观察 access log 30 天 |
| V9 | 现有 38 作品页的收录现状 | 需站长平台 | Owner 提供截图 |
| V10 | `markdown-it` 降级方案的体积与内存（仅备选） | 未到降级条件 | 若触发降级再测 |

---

## 24. V1 任务拆分与 Definition of Done

### 24.1 任务清单（34 人日）

| ID | 任务 | 交付物 | 验收（可执行断言） |
|---|---|---|---|
| T1 | 冻结基线 | `tools/freeze-baseline.cjs` + `baseline.json` | 38 个文件 sha256；重复运行字节一致；**不含 sitemap.xml**（显式断言） |
| T2 | 目录与权限 | 目录树 + 权限矩阵脚本 + systemd 单元 | `ProtectSystem=strict` 下写 `h5/*` 失败；`OOMScoreAdjust` 生效 |
| T3 | 数据库 | `schema.sql` + repo | 幂等初始化；`PRAGMA foreign_keys` = 1；WAL = wal |
| T4 | 鉴权 | scrypt + session + CSRF + Host 校验 | 隧道模式可登录（无 `Secure`）；错误 Host 返回 421/400；5 次失败锁定 |
| T5 | 文章 CRUD | 状态机 + slug 锁 + 保留字 | 改已发布 slug → 409；保留字 slug → 400 |
| T6 | 修订全字段 | `snapshot_json` + 恢复 | 恢复后 19 字段 + 3 张关联集合逐项相等；`rev_no` 只增 |
| T7 | Markdown | 渲染器 + 40 用例 | 40/40；每个 XSS 用例断言无执行上下文 |
| T8 | 实体/来源 | 只读检索 + 来源 CRUD | 不存在 id 被拒；`javascript:` URL 被拒 |
| T9 | 媒体 | 上传 + 头部解析 + 软删 | `.svg` 拒；GIF 拒；扩展名不符拒；> 2 MB 拒；> 25 MP 拒；`../` 拒 |
| T10 | 构建 | 模板 + JSON-LD + 分页 + 桩页 | 正文可 grep；可执行脚本 = 0；JSON-LD 可 parse；分页文件齐全 |
| T11 | 校验器 | 15 项（含 §2.3 脚本分类、§3.4 sitemap） | 每项有"故意失败"用例并被拦截（15/15） |
| T12 | CQC | 5 类 20 条 + 3 级 | 每条正/反用例；BLOCK 项确实阻断发布 |
| T13 | 发布助手 | `/usr/local/sbin/mcu-cms-publish` + spool | 改动前零副作用；非法 seq 被拒；篡改 sha256 被拒；软链与 sitemap 各一次 rename |
| T14 | 状态机 + 对账 | 9 phase + `reconcile()` | 8 种失败场景各有单测（用假 fs 或沙箱目录）；每种收敛到一致态或显式 inconsistent |
| T15 | Sitemap 集成 | 工具 `--extra/--out` + 调用链 | 现有 `--check` 仍 PASS；缺 URL 被拒；重复 URL 被拒 |
| T16 | 后台 UI | 8 页（登录/列表/编辑/分类/媒体/发布/审计/健康） | 无 token 全 401；预览 iframe 不执行脚本 |
| T17 | 一致性 + 备份 | `consistency` + 三个备份脚本 + 恢复脚本 | I1–I6 全 true；恢复演练 1 次通过 |
| T18 | e2e | `tools/e2e.cjs` | 建 3 篇 → 校验失败 1 次被拦 → 修复 → 发布 → 回滚 → 断言 |
| T19 | 文档 | 运维手册 + SOP + 变更台账 | 覆盖启停/备份/恢复/发布/回滚/证书/新增作者/降级路线 |

### 24.2 Definition of Done（V1 通过的全部条件）

**A. 零影响**
1. 发布前后 F1 的 **38 个文件** sha256 全部不变（T1 断言）。
2. `nginx -T` 与开发前快照逐字节一致（本轮不改 Nginx）。
3. 现有 15 页、资讯流水线、Forum API、小程序、shared 数据零改动（`git status` 自证）。

**B. 零依赖**
4. `app/node_modules` 不存在；服务器未执行过 `npm install`（若触发 M3 降级则例外，需登记）。

**C. 正文与脚本**
5. `curl -s https://www.mcuatlas.xyz/article/<slug>` 能 grep 到正文首句与末句。
6. 可执行 `<script>` 计数 = 0；`ld+json` 计数 ≥ 2 且全部可 parse（§2.3）。
7. 正文区无原始 `<script` 字样；无 `on*=` 属性；无 `javascript:` 链接。

**D. SEO**
8. 每篇文章：唯一 title（12–40 汉字）、description（40–160 字符）、自指 canonical、robots、OG ×5（含 `og:image`）。
9. 分类页与分页页：自指 canonical + 可见面包屑 + 纯 `<a>` 列表。
10. 内链与 sitemap 全部无扩展名（`/article/xxx.html` 出现即失败）。
11. 同一文章 `/article/x` 与 `/article/x.html` 响应字节相同。

**E. Sitemap**
12. sitemap 由 `generate-sitemap.cjs` 唯一产出；CMS 代码中不存在直接写 `sitemap.xml` 的调用（`grep` 断言）。
13. 文章 URL 全部在 sitemap；下架 URL 已移除且记录在 `removed_urls`。

**F. 发布与恢复**
14. 8 种失败场景各跑一遍：**没有一次把未完成标成 published**；最终态要么一致、要么显式 `inconsistent` + 告警。
15. 回滚任一历史 release ≤ 1 分钟；回滚本身留审计。
16. 服务在发布中途被 `kill -9` 后重启，`reconcile()` 能收敛（实测）。

**G. 数据一致**
17. `consistency` 返回 I1–I6 全 true。
18. 修订恢复后全字段 + 关联逐项相等。

**H. 安全**
19. 无 token 访问全部后台接口 → 401；错误 CSRF → 403；错误 Host → 拒绝。
20. 预览响应带严格 CSP，iframe 内脚本不执行（用 `alert(1)` 用例验证）。
21. 媒体：6 类非法文件全部被拒（§12.2）。

**I. 资源**
22. 常驻 RSS ≤ 45 MB；**构建峰值 ≤ 86 MB**（与 §6.3 一致）；"构建 + 常驻"同时刻 `MemAvailable` ≥ 60 MB；0 次 OOM（G2 报告）。

**J. 运维**
23. 备份三类齐全且可校验；恢复演练 1 次通过并留报告。
24. 运维手册可让一个没参与开发的人完成"发布 + 回滚 + 恢复"。

---

## 附录 A：V1.0 报告问题清单（本轮修正项定位）

| # | 问题 | 原报告位置 | V2.0 修正 |
|---|---|---|---|
| 1 | `<script>`=0 与 JSON-LD 互斥 | §9.4-#12 / §10-#13 | §2 |
| 2 | 冻结集含 sitemap，与自动更新互斥 | §9.5 / §9.6 | §3 |
| 3 | setuid 4750 脚本（不可实现 + 与 NoNewPrivileges 冲突） | §13.5 | §4 |
| 4 | 把软链 rename 当整流程原子 | §9.3 | §5 |
| 5 | 用 `MemoryMax` 当资源充足证明 | §2.7 / §6.1 | §6 |
| 6 | Markdown 未定语法边界 | §6.1 | §7 |
| 7 | 分页用 `?page=n` 但无静态文件 | §10-#14 | §10 |
| 8 | 分类页平铺文件 + 分页目录会与 `try_files` 撞车 | §9.1 | §9.3 |
| 9 | 修订只存 title/body，恢复丢字段 | §7.3 | §13.2 |
| 10 | 无外键/级联/软删规则 | §7.3 | §13.4 |
| 11 | `Secure` Cookie 与 SSH 隧道互斥（按方案实现无法登录） | §8.1 | §16.2 |
| 12 | robots 假设专属组继承通配组（RFC 9309 相反） | §11.2 | §11.1 |
| 13 | 下架桩页未处理内链 | §9.8 | §17.2 |
| 14 | 媒体备份选做 | §13.2 | §12.5 |
| 15 | 备份未校验 release 引用 | §13.2 | §13.5 |
| 16 | GEO 用分数暗示引用概率 | §11.6 | §14 |

## 附录 B：本轮新增只读核查事实

| # | 事实 | 值 |
|---|---|---|
| B1 | `/www`、`/www/wwwroot/mcu-h5`、`/www/backup` 同一设备 | `st_dev = 64771`（`/dev/vda3`）→ 跨目录 `rename` 原子成立 |
| B2 | Nginx 未配置 `disable_symlinks` | `grep` 无结果 → 默认跟随软链 |
| B3 | `sudo` 可用且版本 | `sudo 1.9.5p2`（含 `--with-linux-audit`、syslog authpriv 记录） |
| B4 | 工具可用性 | `flock`、`sha256sum`、`curl`、`tar` 均在；**`rsync` 不存在** |
| B5 | 服务器 `index index.html` | 主站 server 块已声明 → 目录式分类页可行 |
| B6 | 论坛数据库权限 | `forum.db` 644（world-readable）；`secret.key`/`admin-token.key` 600 |
| B7 | OpenAI 官方 UA | `OAI-SearchBot`(检索) / `GPTBot`(训练) / `ChatGPT-User`(用户触发，robots 可能不适用) / `OAI-AdsBot` |
| B8 | Google 官方 | `Google-Extended` 仅为 robots 令牌、**无独立 UA**、不影响搜索收录与排名；官方页面注明 2027 年初支持 AIPREF `__usage_ai-training` |
| B9 | Anthropic 官方 | `ClaudeBot`/`Claude-SearchBot`/`Claude-User` 均遵守 robots；自 2026-10-30 识别训练偏好信号，显式点名 `ClaudeBot` 优先 |
| B10 | Perplexity 官方 | `PerplexityBot`(检索，遵守) / `Perplexity-User`(用户触发，**generally ignores robots.txt**) |
| B11 | `Bytespider` | 未找到官方 UA 说明页 → 【待验证】 |

## 附录 C：本报告的边界声明

1. 本报告**未写任何 CMS 代码、未建库、未建用户、未建服务、未改配置**；所有"命令"均为设计示例，未执行。
2. 所有【方案】【推导】均为纸面设计，**未经运行验证**；【待验证】清单见 §23，**不得据本报告声称"已通过测试"**。
3. 关于 GEO：本报告**不承诺**任何 AI 平台会引用本站内容，也不预测搜索排名；CQC 仅是内容完整性/可追溯性的内部检查。
4. 关于内存：§6.3 的阈值是**建议值**，需 G2 实测校准；本报告不声称当前服务器"资源充足"。
5. 关于发布一致性：本报告明确 POSIX 文件系统上**无法**做到"文章 + sitemap + DB"三方严格原子，只承诺"不静默成功 + 不一致显式可见 + 可对账收敛"。
