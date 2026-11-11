# MCU Atlas CMS V1.0 · 最终架构定案 V2.1

| 项 | 值 |
|---|---|
| 文档版本 | **V2.1（架构补充审查 · 最终定案意见）** |
| 日期 | 2026-11-09 |
| 执行方 | CodeBuddy（开发 AI） |
| 上游依据 | 《MCU Atlas CMS V1.0 架构修订报告 V2.0》（`docs/技术/MCU-Atlas-CMS-V1.0-架构修订报告-V2.0.md`） |
| 本轮性质 | **只读核查 + 文档编写**。未写代码、未装依赖、未建库/用户/服务、未改 sudoers/systemd/Nginx/证书/权限、未改任何生产文件、未停止任何服务、未做写性测试、未执行 Git 操作 |
| 证据等级 | **【已验证】**=本轮或上一轮亲眼看到的事实（命令输出/源码/官方文档）；**【机制】**=由操作系统/协议语义直接推出、本轮未在本机复现；**【设计建议】**=尚未实现；**【待验证】**=必须真实运行或授权才能确认；**【待决策】**=需 Owner 拍板 |

---

## 0. 结论摘要

### 0.1 一句话结论

> **V2.0 的发布权限方案（CMS 用 sudo 调 root 助手）与 `NoNewPrivileges=yes` 在机制上直接冲突，必须废弃；改用「root 拥有的 systemd `.path` 单元监听 spool 目录」后，冲突消失、权限面更小、审计更完整。除此之外，V2.0 无新增致命矛盾。最终结论：有条件进入开发（C1–C6 六项条件，其中 3 项需 Owner 授权）。**

### 0.2 十条要点

| # | 结论 | 等级 |
|---|---|---|
| 1 | **`NoNewPrivileges=yes` 会让 `sudo` 完全失效**：NNP 使 `execve` 忽略 setuid 位，sudo（`---s--x--x`、setuid root）无法提权。V2.0 §4 与 §16.4 自相矛盾 | 【机制】+【已验证】sudo 权限位 |
| 2 | **不再用 sudo**。改为 root 拥有的 `mcu-cms-publish.path` + `.service`（oneshot）监听 spool，CMS 保持 `NoNewPrivileges=yes`。**权限转移由文件系统权限完成，不由提权完成** | 【设计建议】 |
| 3 | **`NOPASSWD: NOEXEC` 与空参数匹配规则本身是正确的**（`cmd ""` = 仅零参数），但因 NNP 无法生效，故整套 sudoers 设计作废 | 【机制】+【已验证】sudo 1.9.5p2 |
| 4 | **新发现 P0：Sitemap 生成器根本没部署在服务器**（`/www/wwwroot/mcu-h5/tools` 不存在），且脚本把 H5 根写死为 `__dirname/..`，**V2.0 §3.3 的调用链当前不可执行** | 【已验证】 |
| 5 | **不能把生成器放进 `h5/`（Web root）**：未知扩展名会被 Nginx 当静态文件下发，等于**公开源码** | 【机制】 |
| 6 | **服务器是 cgroup v1，不是 v2**：V2.0 引用的 `memory.events` 不存在；正确指标是 `memory.max_usage_in_bytes` / `memory.stat` / `memory.memsw.*` / `memory.oom_control` | 【已验证】 |
| 7 | **内存预算算术要改**：`146 − 60 = 86 MB` 是「CMS 常驻 + 构建峰值」的**总和**，不是「构建单独」上限。且实测 `MemAvailable` 在 1 小时内从 149 MB 波动到 162 MB，**必须取 24 h 最低值做基线** | 【已验证】+【设计建议】 |
| 8 | **系统已经在用 swap**：forum-api 单元 `memsw.usage − usage = 13.9 MiB`（即该进程已有约 13.9 MB 被换出），系统 swap 已用 197 MiB → `MemAvailable` 高估了真实余量 | 【已验证】 |
| 9 | **D4（文章站内入口）**：零改动方案下，文章**只对爬虫可见、对人类用户几乎不可见**。推荐：V1 以「`/article/` 索引 + sitemap + 外链」上线；同时准备一份 **1 个 `<a>` 的页脚入口变更单**，需 Owner 授权后与上线同批执行 | 【设计建议】+【待决策】 |
| 10 | **工作量由 34 → 37 人日**（+3：特权单元加固 0.5、故障注入套件 1.5、sitemap 工具与部署 0.5、内存实测明确 0.5） | 【设计建议】 |

### 0.3 最终结论（§10 详述）

**有条件进入开发（Conditionally GO）**，条件 C1–C6 见 §10.2。三项与 Owner 强相关：证书（C1）、特权执行单元落地授权（C2）、文章入口决策（C4）。**未满足 C1/C2 前不得开工 M6**（发布链路）。

---

## 1. V2.0 已解决问题的清单（含本轮验证状态）

| # | V2.0 修正项 | 处置 | 本轮验证状态 |
|---|---|---|---|
| 1 | JSON-LD 与 `script` 校验冲突 | 脚本三分类：可执行=0 / `ld+json`≥2 / 其他=0，JSON-LD 需 `\u003c` 转义 | 【已验证】分类规则自洽，无残留矛盾 |
| 2 | 冻结集含 `sitemap.xml` | 文件四级分类（F1/F2/F3/F4），sitemap 移出冻结集 | 【已验证】但**新发现生成器未部署**（N2） |
| 3 | setuid 提权 | 废弃 setuid | ✅ 已废弃；但替代方案（sudo）**又踩 NNP**（N1） |
| 4 | 发布原子性被夸大 | 9 阶段状态机 + 写前意图 + 对账 | 【设计建议】待故障注入验证（§5） |
| 5 | `MemoryMax` 当资源充足证明 | 改为 5 项实测 + 阈值 + 4 条降级 | ⚠️ 阈值算术需修正（N5）、指标平台需改（N3） |
| 6 | Markdown 兼容性承诺失实 | 严格受限文法 + 40 用例 + 降级触发条件 | 【设计建议】待 M3 实现验证 |
| 7 | 分类页与 `try_files` 撞目录 | 目录式 `c/<cat>/index.html` | 【已验证】Nginx 主站 server 块已声明 `index index.html;` |
| 8 | `?page=n` 无静态文件 | 构建期真实分页文件 | 【设计建议】 |
| 9 | 修订只存 title/body | `snapshot_json` 全字段 + 关联快照 | 【设计建议】 |
| 10 | 无外键/级联/软删 | FK + RESTRICT/CASCADE + 仅 `status` 软删 | 【设计建议】 |
| 11 | `Secure` Cookie 与 SSH 隧道互斥 | `access_mode=tunnel/proxy` 双模式 + Host 校验 | 【机制】合理 |
| 12 | robots 假设继承通配组 | 每组重复声明（RFC 9309） | 【已验证】官方文档（OpenAI/Google/Anthropic/Perplexity） |
| 13 | 下架桩页未处理内链 | 桩页 + sitemap 移除 + 内链扫描阻断 | 【设计建议】 |
| 14 | 媒体备份选做 | 强制 + manifest 校验 | 【设计建议】 |
| 15 | 备份未校验 release 引用 | 保留矩阵 + 恢复流程校验 | 【设计建议】 |
| 16 | GEO 用分数暗示引用概率 | 改为内容质量检查（CQC）5 类 3 级 | 【已验证】定位自洽 |

---

## 2. 新发现的问题与风险等级

### N1【P0】`NoNewPrivileges=yes` 与 sudo 方案直接冲突

| 项 | 内容 |
|---|---|
| 现象 | V2.0 同时要求：① CMS 单元 `NoNewPrivileges=true`；② CMS 通过 `sudo -n /usr/local/sbin/mcu-cms-publish` 提权执行助手 |
| 机制 | `NoNewPrivileges` 设置进程 `PR_SET_NO_NEW_PRIVS=1`。该标志使**后续 `execve` 不再授予新特权**：setuid/setgid 位被忽略、文件 capabilities 不生效，子进程继承该标志 |
| 后果 | `sudo` 是 setuid root 程序（本机实测 `---s--x--x`，setuid 位在），在 NNP 下 exec 后 euid **仍为 `mcucms`**，无法 `setuid(0)`，`NOPASSWD` 也无效 → **报错退出，发布永远失败** |
| 影响 | M6「发布链路」全部不可用；若按 V2.0 直接开工，会在集成阶段整段返工 |
| 结论 | **P0，必须改方案**（见 §3） |
| 证据 | 【机制】`man 2 PR_SET_NO_NEW_PRIVS` / `man 7 capabilities`（no_new_privs 段）；【已验证】`ls -l /usr/bin/sudo` → `---s--x--x`；【待验证】本机复现报错文案（需创建单元，本轮禁止） |

### N2【P0】Sitemap 生成器未部署在服务器，且路径写死

| 项 | 内容 |
|---|---|
| 现象 | `/www/wwwroot/mcu-h5/tools` **不存在**（`ls` 直接报 No such file or directory）；`h5/tools/generate-sitemap.cjs` 只存在于本地仓库 |
| 后果 | V2.0 §3.3「CMS 调用 `node h5/tools/generate-sitemap.cjs --extra …`」**当前无法执行**——服务器上既没有这个文件，也没有 `node` 的 PATH |
| 次生问题 | 该脚本 `const H5 = path.resolve(__dirname, '..')`，把 H5 根**写死为脚本上一级**。若把脚本部署到 `mcu-cms/app/tools/`，它会去读 `mcu-cms/app/data/`（不存在）→ 直接失败 |
| 结论 | **P0，必须在 F3 工具变更里增加 `--h5` 参数**（详见 §6.3） |
| 证据 | 【已验证】`ls -la /www/wwwroot/mcu-h5/tools` → 不存在；本地脚本源码第 24 行 |

### N3【P1】服务器是 cgroup v1，V2.0 的内存指标取错

| 项 | 内容 |
|---|---|
| 现象 | `/sys/fs/cgroup/` 下是 `memory`、`cpu`、`blkio` 等**独立控制器目录**（v1 特征）；`mcu-forum-api.service` 目录内是 `memory.usage_in_bytes`、`memory.max_usage_in_bytes`、`memory.failcnt`、`memory.stat`、`memory.memsw.*`、`memory.oom_control`，**没有 `memory.events`**（v2 才有） |
| 后果 | 按 V2.0 写的 `memory.events` 采集脚本会全部失败；「峰值」与「swap 用量」两项关键指标测不出来 |
| 结论 | P1，改用手册 §4.3 的 v1 指标表 |
| 证据 | 【已验证】见附录 A-4 |

### N4【P1】系统已在用 swap，`MemAvailable` 高估余量

| 项 | 内容 |
|---|---|
| 实测 | 系统 swap：总 1,048,572 kB，空闲 846,796 kB → **已用 201,776 kB ≈ 197 MiB**；`vm.swappiness=0` |
| 更细的证据 | forum-api 单元：`memory.usage_in_bytes` = 13,754,368 B（13.1 MiB）；`memory.memsw.usage_in_bytes` = 28,282,880 B（27.0 MiB）→ **差 13.85 MiB 就是该进程已被换出的部分** |
| 含义 | 说明 896 MiB 的机器已经在"把冷页换出去"的状态下运行。`MemAvailable` 把可回收缓存也算成可用，**不等于能承受一次 80 MB 的瞬时申请** |
| 结论 | P1，验收必须同时看 swap 增量与 OOM 计数（§4.4） |
| 证据 | 【已验证】附录 A-3、A-5 |

### N5【P1】内存预算的算术关系写错（会误判）

| 项 | 内容 |
|---|---|
| 现象 | V2.0 表述为「基线 146 MB − 安全垫 60 MB = **构建峰值上限 86 MB**」 |
| 问题 | 146 MB 是**尚未运行 CMS** 时的可用量。CMS 常驻本身也是新增消耗，因此正确关系是：**CMS 常驻 + 构建峰值（并发发生）+ 后台峰值（不同时）≤ 86 MB**。若 CMS 常驻 40 MB，则构建只能用 46 MB，不是 86 MB |
| 后果 | 若按 86 MB 验收，可能出现「构建 80 MB 通过验收，但 MemAvailable 掉到 40 MB 触发 OOM」 |
| 结论 | P1，改为 §4.5 的预算表（含组合判定） |
| 证据 | 【设计建议】 |

### N6【P1】把 `.cjs` 放进 Web root 等于公开源码

| 项 | 内容 |
|---|---|
| 机制 | Nginx 对未知扩展名不拒绝，`location /` 的 `try_files $uri` 命中即以 `application/octet-stream` 下发 |
| 风险 | 若为"让 CMS 能调用"而把 `generate-sitemap.cjs` 放到 `/www/wwwroot/mcu-h5/tools/`，任何人访问 `https://www.mcuatlas.xyz/tools/generate-sitemap.cjs` 都能下载源码（含内部路径、数据加载逻辑） |
| 结论 | P1，**禁止把任何脚本放进 Web root**；生成器放 `mcu-cms/app/tools/`，用 sha256 与仓库版本对齐（§6.3） |
| 证据 | 【机制】+【已验证】现有 `location /` 规则 |

### N7【P2】sudo 二进制权限位特殊（仅记录）

`/usr/bin/sudo` 权限为 `---s--x--x`（0o4111，RHEL 系默认）。setuid 位存在，但因 NNP 无法生效。**不建议修改该权限位**（改错会导致系统无法 sudo）。

### N8【P2】systemd 版本较老（239）

`systemd 239 (239-82.0.3.1.al8.3)`。影响：
- `.path` / `PathExistsGlob=` / `.timer` / `RuntimeMaxSec=` / `MemoryMax=` 均可用（均为更早期特性）；
- 但内存限制落在 **cgroup v1** 的 `memory.limit_in_bytes`；
- `RestrictAddressFamilies=`、`ProtectSystem=full`、`PrivateTmp=` 均可用。
→ 【待验证】具体单元行为必须在 M6 沙箱实测（本轮禁止创建单元）。

### N9【P2】D4 无入口 → 上线首月自然流量 ≈ 0

已在 V2.0 R16 记录，本轮给出决策方案（§7）。

### N10【P2】文章页 CSS 体积浪费

若文章页照抄现有页面引入 `style.css`(77.6 KB) + `v2.css`(44.5 KB) + `v2n-news.css`(14 KB)，单篇要多下 ~136 KB 样式，而文章页只需要 Token 与少量排版。
→ 建议：文章页只引 `style.css` + 新增 `article.css`（~6 KB），**不引 `v2.css`/`v3-forum.css`/`app.js`**。【设计建议】

### N11【P2】noindex 页面必须排除在 sitemap 之外（V2.0 未写死）

V2.0 允许标签页默认 `noindex,follow`，但 sitemap 规则里没有"noindex 不得入 sitemap"这一条。若不补，会出现「sitemap 收录 noindex 页」的自相矛盾（Search Console 会报"已提交但被 noindex 排除"）。
→ 结论：校验器必须增加一条硬规则（§6.4-S7）。

---

## 3. 发布权限最终推荐方案（唯一推荐）

### 3.1 先回答四个子问题

#### 3.1.1 sudo 提权是否会被 NoNewPrivileges 阻止

**会，且是彻底阻止。**【机制】

- `NoNewPrivileges=yes` → systemd 在 `execve` 前调用 `prctl(PR_SET_NO_NEW_PRIVS, 1)`；
- 该标志生效后，**任何后续 execve 都不会获得新特权**：文件上的 setuid/setgid 位被内核忽略，file capabilities 不被授予；
- `sudo` 靠 setuid root 获得 euid 0；NNP 下 euid 保持 `mcucms`，sudo 无法 `setuid(0)`，`NOPASSWD` 只跳过密码、不改变"能不能变 root"；
- 该标志**不可逆**（进程级，无法在运行时清除），子进程继承。

→ **只要 CMS 单元保留 `NoNewPrivileges=yes`，sudo 方案就不可能工作。**

**反向取舍也不成立**：为了 sudo 而给 CMS 单元设 `NoNewPrivileges=no`，等于让一个"接受用户输入并渲染内容"的进程可以执行**任意 setuid 二进制**提权——这比不用 sudo 危险得多。

#### 3.1.2 `NOPASSWD: NOEXEC` 的实际限制范围

| 指令 | 作用 | 边界 |
|---|---|---|
| `NOPASSWD` | 跳过密码 | 不改变权限判定，只省交互 |
| `NOEXEC` | 阻止被授权命令**再 exec 其它程序**（sudo 用 `LD_PRELOAD` 或 seccomp 实现，视编译选项） | 只限制"派生"，**不限制该命令自身的文件操作**；本机 sudo 编译未启用 `--with-selinux` 的 exec 限制时，NOEXEC 依赖 `LD_PRELOAD`，**对静态链接或直接 syscall 的程序无效** |
| 结论 | `NOEXEC` 是"减少",不是"保证"。真正的边界必须是"助手代码只做固定几种操作 + 输入不可控字段全部白名单" | 【机制】 |

#### 3.1.3 零参数匹配规则是否符合预期

`sudoers` 中 `cmd ""` 表示**仅匹配零参数调用**（sudo ≥1.9）。若写成 `cmd`（无 `""`），则**任意参数都允许** —— 这是最常见的配置事故。所以 V2.0 的 `mcu-cms-publish ""` 写法在语义上是正确的。

但它**没有实际价值了**：因为 N1，这条路根本执行不到。本节保留结论仅作为"若未来 owner 明确要求 sudo 时的正确写法"记录。

#### 3.1.4 CMS 进程与特权助手之间的权限边界

最终方案的边界是**三层互不重叠**：

| 主体 | uid | 可写 | 可读 | 不可写 |
|---|---|---|---|---|
| `mcu-cms.service` | `mcucms` | `mcu-cms/{data,releases,spool,incoming,tmp,logs}` | `h5/data`、`h5/tools`(若部署)、自己的目录、`spool/results` | `h5/*.html`、`h5/data/*.js`、`h5/article`、`h5/media`、`h5/sitemap.xml`、`/usr/local/sbin/*`、`/etc` |
| `mcu-cms-publish.service` | `root`（oneshot） | `h5/article`（软链）、`h5/sitemap.xml`、`/www/backup/cms-sitemap`、`/var/log/mcu-cms-publish.log`、`spool/{work,done,failed}` | 上述 + `releases/<seq>` | 其它一切（`ProtectSystem=full` + `ReadOnlyPaths=/etc /usr /boot`） |
| `www`（nginx） | `www` | 无 | 经软链读 `article/`、`media/` | 全部写 |

**关键点**：CMS 进程**从不发生权限变化**（始终是 `mcucms`）；"提权"这件事根本不存在，只有"一个原本就有 root 的常驻能力，按文件系统约定去执行固定操作"。

### 3.2 推荐方案（唯一）：root 拥有的 systemd `.path` 单元读取 spool

```
mcucms 写 spool/incoming/<id>.req（0744 文件、0700 目录）
        │
        ▼（内核 inotify，无提权）
mcu-cms-publish.path   PathExistsGlob=/www/wwwroot/mcu-cms/spool/incoming/*.req
        │  触发
        ▼
mcu-cms-publish.service  Type=oneshot  User=root  ExecStart=/usr/local/sbin/mcu-cms-publish
        │  （内部：flock → 逐个 rename 到 work/ → O_NOFOLLOW 读 → 校验 → 两次 rename → 写结果）
        ▼
spool/done/<id>.res（0644）  +  /var/log/mcu-cms-publish.log
        │
        ▼（mcucms 轮询结果）
CMS 更新 cms_releases.phase
```

**为什么这是唯一推荐（不是"选项之一"）**：

| 备选 | 否决理由 |
|---|---|
| sudo（V2.0 方案） | 与 NNP 机制冲突（N1），且需要为 sudo 打开 NNP，安全性更差 |
| setuid 助手 | Linux 忽略脚本 setuid；改用二进制则引入 C 代码与 setuid 面；且 NNP 下同样失效 |
| root 常驻 socket 服务 | 可用，但多一个**长期监听的特权进程**（内存 + 攻击面 + 生命周期管理）；`.path` 是内核事件驱动、**无常驻进程** |
| 让 CMS 直接以 root 运行 | 直接否决：整个后端变成 root 面 |
| 用 cron 每分钟扫描 | 可行但延迟最高 60 s、且 cron 与 systemd 混用两套日志；`.path` 是即时触发 |

**延迟与吞吐**：`.path` 触发通常在 100 ms 内启动；一次运行最多处理 10 个请求，`RuntimeMaxSec=60` 兜底。

### 3.3 spool 方案的加固设计（回答任务点名的攻击面）

#### 3.3.1 请求生命周期（防 TOCTOU 的核心）

```
1) CMS: 写 spool/incoming/<id>.req.part  → fsync → rename 为 <id>.req（同目录原子）
2) 单元启动, helper 取 flock /run/mcu-cms-publish.lock（非阻塞）
3) 取 pending 列表（按文件名排序，最多 10 个）
4) 对每个：rename(incoming/<id>.req → work/<id>.req)
          ★ work/ 属于 root:root 0700，mcucms 无法进入、无法改写
          ★ 从这一刻起，请求内容不可再被篡改（TOCTOU 窗口关闭）
5) open(work/<id>.req, O_RDONLY|O_NOFOLLOW) → fstat：
     必须 S_ISREG、st_uid==mcucms、st_size ≤ 4096、st_nlink==1
6) 读内容 → JSON.parse → schema 校验（字段白名单，多余字段拒绝）
7) 执行（见 3.3.3）→ 写结果 → rename 到 done/ 或 failed/
8) 写审计日志（一行 JSON）→ 释放锁
```

#### 3.3.2 威胁与对策（逐项）

| 威胁 | 攻击方式 | 对策 | 残余风险 |
|---|---|---|---|
| **符号链接攻击** | `incoming/x.req` 指向 `/etc/shadow` | ① 先 `rename` 进 root 独占目录再读；② `O_NOFOLLOW`；③ `fstat` 校验 `S_ISREG` | 无（rename 只搬目录项，不跟随目标） |
| **TOCTOU** | 校验后、读取前替换内容 | 内容只在 `work/`（mcucms 不可写不可进入）读取 | 无 |
| **硬链接攻击** | 把系统文件硬链成 `x.req` | `st_nlink == 1` 拒绝；且 mcucms 读不到的文件无法创建硬链（Linux `protected_hardlinks=1` 默认） | 极低 |
| **伪造请求** | 任意 JSON | ① 只接受 `{v, id, action, release_seq, expect_prev_seq, sitemap_sha256, article_manifest_sha256, requested_by, requested_at}`；② **所有路径由 helper 用 `release_seq` 拼出，请求里不允许出现任何路径字符串**；③ `action` 白名单（`switch`/`verify_only`） | 无（mcucms 本来就有权发起发布，这是其职责） |
| **重放 / 重复** | 同一 id 重复投递 | ① `done/<id>.res` 存在即判 dup 丢弃；② 操作本身幂等（目标态可检测：软链 seq + sitemap sha） | 无 |
| **泛洪** | 投 10 万个文件 | 每次运行上限 10 个；`RuntimeMaxSec=60`；`work/` 每次清空 | 中：mcucms 可让发布队列长期拥堵（等同 Self-DoS），接受 |
| **manifest 路径穿越** | 清单写 `../../etc/x` | 拒绝绝对路径、`..`、软链（`lstat` 必须普通文件）；`realpath` 必须以 `releases/<seq>/` 为前缀 | 无 |
| **超大文件 / 解压炸弹** | 塞 2 GB | 文件数 ≤ 5000；单文件 ≤ 10 MB；总 ≤ 200 MB；`fstat` 实测大小与清单声明一致 | 无 |
| **release 目录被替换成软链** | `releases/000007` → `/etc` | `lstat` 必须为目录且非软链；`st_dev` 必须等于 `h5` 的 `st_dev` | 无 |
| **helper 自身被篡改** | mcucms 改 `/usr/local/sbin/mcu-cms-publish` | 文件 `root:root 0755`；`mcu-cms` 目录链上无 mcucms 可写父目录 | 无 |
| **环境注入** | 传 `PATH`/`LD_*` | systemd 单元固定 `Environment=PATH=/usr/local/sbin:/usr/sbin:/usr/bin:/sbin:/bin`，不继承用户环境；`PrivateTmp=yes` | 无 |

#### 3.3.3 helper 允许执行的**全部**操作（白名单）

| # | 操作 | 目标（由 seq 推导，不可自定义） |
|---|---|---|
| 1 | `symlink` + `rename` | `/www/wwwroot/mcu-h5/article` → `/www/wwwroot/mcu-cms/releases/<seq>/article` |
| 2 | `rename` | `/www/wwwroot/mcu-cms/releases/<seq>/sitemap.xml` → `/www/wwwroot/mcu-h5/sitemap.xml`（旧件先备份到 `/www/backup/cms-sitemap/`） |
| 3 | `rename` | spool 内部搬移（incoming → work → done/failed） |
| 4 | `append` | `/var/log/mcu-cms-publish.log` 一行 |

**没有**：`unlink` / 递归删除 / `exec` / 网络 / 读取 spool 与 releases 之外的任何路径 / 写 DB。

#### 3.3.4 单元配置（设计稿，未创建）

```ini
# /etc/systemd/system/mcu-cms-publish.service
[Unit]
Description=MCU CMS publish helper (release switch only)
StartLimitIntervalSec=0

[Service]
Type=oneshot
User=root
Group=root
ExecStart=/usr/local/sbin/mcu-cms-publish
RuntimeMaxSec=60
Nice=10
IOSchedulingClass=idle
NoNewPrivileges=yes
PrivateTmp=yes
ProtectSystem=full
ProtectHome=yes
ProtectKernelTunables=yes
ProtectControlGroups=yes
RestrictAddressFamilies=AF_UNIX
RestrictNamespaces=yes
LockPersonality=yes
Environment=PATH=/usr/local/sbin:/usr/sbin:/usr/bin:/sbin:/bin
StandardOutput=journal
StandardError=journal
```

```ini
# /etc/systemd/system/mcu-cms-publish.path
[Unit]
Description=Watch CMS publish spool

[Path]
PathExistsGlob=/www/wwwroot/mcu-cms/spool/incoming/*.req
Unit=mcu-cms-publish.service

[Install]
WantedBy=multi-user.target
```

> 注意：`ProtectSystem=full` 让 `/usr`、`/boot`、`/etc` 只读，但 `/www` 可写——这是必要的，因为要切软链。更严格的 `strict` 需要 `ReadWritePaths=` 精确列出，**且软链路径能否被 `ReadWritePaths` 正确处理需实测**（【待验证】V4）。

### 3.4 与 CMS 单元的最终关系

| 项 | CMS 单元 | 发布单元 |
|---|---|---|
| `NoNewPrivileges` | **yes（保留）** | yes（root 无需提权，纯保险） |
| 网络 | 仅 `127.0.0.1:8790` | 无网络（`AF_UNIX` only） |
| 内存上限 | `MemoryMax=192M` / `MemoryHigh=160M` / `OOMScoreAdjust=500` | `MemoryMax=64M`（helper 只读 JSON 与算哈希） |
| 权限 | `mcucms` | `root`（oneshot，60 s 上限） |
| 触发 | systemd 常驻 | `.path` 事件或人工 `systemctl start` |

**结论**：V2.0 的 sudo 方案作废；V2.1 采用「`.path` + oneshot root helper + spool」。**这也是任务里点名的"优先评估"方向，且评估结果是唯一的合理选择。**

---

## 4. 内存预算与实测验收标准

### 4.1 五个概念必须分开（否则测试结论必然错）

| 概念 | 读取位置 | 含义 | 常见误用 |
|---|---|---|---|
| **V8 Heap** | `process.memoryUsage()` → `heapUsed/heapTotal/external/arrayBuffers`；`v8.getHeapStatistics()` | JS 对象占用；`--max-old-space-size` 只限 **old space** | 用 heapUsed 代表进程占用（漏掉 young gen、code space、Buffer） |
| **进程 RSS** | `/proc/<pid>/status: VmRSS`；`/proc/<pid>/smaps_rollup: Pss` | 该进程全部驻留页（含 file-backed 代码页） | 用 RSS 判断"内存够不够"（没算缓存与共享页） |
| **cgroup anon rss** | `/sys/fs/cgroup/memory/…/memory.stat` 的 `rss` 字段 | **匿名页**（真正"不可回收"的那部分） | 与 RSS 混用（本机实测 forum：ps RSS 12.7 MB vs cgroup `rss` 3.5 MB，差 9 MB 全是可回收的 file-backed） |
| **cgroup usage** | `memory.usage_in_bytes` | anon + **page cache** + kernel 记账 | 当成"进程占用"→ 会把读文件产生的缓存算成泄漏 |
| **系统 MemAvailable** | `/proc/meminfo` | 内核估算的"可分配"量（含可回收缓存） | 当成"空闲物理内存"（它不是 free） |

> **本机实证（附录 A-5）**：forum-api 单元 `memory.usage_in_bytes` = 13.1 MiB、`memory.stat:rss` = 3.5 MiB、`ps` RSS = 12.7 MB、`memsw.usage` = 27.0 MiB。**同一个进程四个数字**——不区分就会得出互相矛盾的结论。

### 4.2 为什么必须是 24 h 基线而不是单点

实测两次（相隔约 50 分钟）：`MemAvailable` **149,552 kB → 162,104 kB**（+12.5 MB），同期 swap 已用基本不变（196 → 197 MiB）。说明该值受 page cache 回收影响剧烈波动。

→ **基线 = 连续 24 h 采样的最小值**（不是均值，不是某一秒的快照）。若 24 h 最低值 < 146 MB，则预算按实测值重算，不沿用 146。

### 4.3 采集指标表（cgroup v1，全部已验证可读）

| 指标 | 文件 | 用途 |
|---|---|---|
| 单元当前占用（含缓存） | `memory.usage_in_bytes` | 判断 `MemoryMax` 是否触顶 |
| 单元匿名页 | `memory.stat` → `rss` | **主判据**：进程真实占用 |
| 单元缓存 | `memory.stat` → `cache` | 解释峰值来源 |
| **单元历史峰值** | `memory.max_usage_in_bytes` | 事后取证（比"每秒采样"更准） |
| **单元峰值（含 swap）** | `memory.memsw.max_usage_in_bytes` | 判断是否被换出 |
| **单元已换出量** | `memory.memsw.usage_in_bytes − memory.usage_in_bytes` | swap 抖动判据 |
| 触顶次数 | `memory.failcnt` | 是否撞过 limit |
| OOM 事件 | `memory.oom_control` 的 `oom_kill` 计数 | 单元级 OOM |
| 系统可用 | `/proc/meminfo: MemAvailable` | 主判据 |
| 系统换页速率 | `/proc/vmstat: pswpin/pswpout`（差分） | 抖动判据 |
| 全局 OOM | `dmesg -T \| grep -i -E 'out of memory\|oom-kill'` | 一票否决 |

### 4.4 测试场景（S0–S6）

| 场景 | 内容 | 需要授权 | 时长 |
|---|---|---|---|
| **S0 基线观察** | 不启动 CMS，仅被动采样 `MemAvailable` / swap / `vmstat` | ❌ 只读 | 24 h |
| **S1 空载** | 启动 CMS，静置 10 min，不操作 | ✅ 起服务 | 15 min |
| **S2 后台操作** | 10 次保存草稿 + 3 次预览 + 2 次切换文章（串行） | ✅ | 20 min |
| **S3 小规模构建** | 发布 20 篇（含校验） | ✅ | 15 min |
| **S4 全量构建** | 发布 60 篇（含校验） | ✅ | 20 min |
| **S5 构建 + 并发读** | S4 期间，另开终端对 `/article/*` 施加 20 rps × 60 s（本机 curl 循环，不需 ab/wrk） | ✅ | 20 min |
| **S6 08:00 窗口** | 在 08:00 采集 cron 前后各 10 min 采样 | ❌ 只读（但需在 08:00 值守） | 30 min |

**采样方式**（只读，无依赖）：
```bash
# 每 2 秒一行，记录系统与目标单元
while :; do
  echo "$(date +%s) $(awk '/MemAvailable/{print $2}' /proc/meminfo) \
$(awk '/pswpin|pswpout/{printf "%s ",$2}' /proc/vmstat) \
$(awk '/^rss |^cache /{printf "%s ",$2}' /sys/fs/cgroup/memory/system.slice/mcu-cms.service/memory.stat 2>/dev/null)" \
  >> /www/wwwroot/mcu-cms/tmp/mem-$(date +%H%M).log
  sleep 2
done
```
（S0/S6 不需要 CMS 单元存在，脚本对不存在的路径容错即可。）

### 4.5 预算算术（修正 N5）

```
设：
  A = 24h 基线 MemAvailable 最低值（MB）        // 待测；当前快照 146–162
  S = 安全垫 60 MB
  C = CMS 常驻 anon rss（MB）                    // 待测
  B = 构建子进程峰值 anon rss（MB）               // 待测
  P = 后台单请求峰值（MB，与 B 不同时发生）

预算：  C + B ≤ A − S
验收：  min(MemAvailable) ≥ S  且  swap 增量 ≤ 8 MB/场景  且  OOM = 0
```

以 A = 146 计算（保守）：

| C（CMS 常驻） | 允许的 B（构建峰值） | 判定 |
|---|---|---|
| 30 MB | ≤ 56 MB | ✅ 大概率通过（20 篇构建通常 30–50 MB） |
| 40 MB | ≤ 46 MB | ⚠️ 临界，建议先做 R1 流式构建 |
| 45 MB | ≤ 41 MB | ❌ 需 R1，且必须压缩构建峰值 |
| 任一项 > 上限 | — | ❌ 走 R2 低峰 / R3 本地构建 / R4 扩容 |

> **注意**：`MemoryMax=192M` 是**上限保护**，不是预算；`OOMScoreAdjust=500` 是**优先级声明**，不是容量。**改这两个值只改变"谁先被杀"，不改变"够不够用"。** 本方案的验收只看系统级 `MemAvailable`、swap 增量、OOM 记录三项，不看单元是否存活。

### 4.6 通过标准（全满足才算通过）

| # | 判据 | 阈值 |
|---|---|---|
| P1 | S1 空载 `memory.stat:rss` | ≤ 45 MB |
| P2 | S2 后台峰值 `memory.max_usage_in_bytes` 对应 anon 增量 | ≤ +25 MB（即总 ≤ 70 MB） |
| P3 | S3/S4 构建峰值 `memory.stat:rss` | ≤ (A − S − C) |
| P4 | S4/S5 期间系统 `MemAvailable` 最低点 | ≥ 60 MB |
| P5 | S1–S5 每场景 swap 增量（`pswpout` 差分） | ≤ 8 MB |
| P6 | 全局 OOM 记录 | 0 次 |
| P7 | 现有服务（nginx/forum/mariadb/php-fpm）RSS 偏差 | ≤ 10%，且无重启 |
| P8 | 单元 `memory.failcnt` 增量 | 0（未触顶） |
| P9 | S6 08:00 窗口 `MemAvailable` 最低点 | ≥ 60 MB |

### 4.7 停止条件（**任一命中立即中止测试，不是"继续观察"**）

| # | 条件 | 处置 |
|---|---|---|
| X1 | 任一时刻 `MemAvailable` < 40 MB | 立即 `systemctl stop mcu-cms`，记录现场 |
| X2 | `pswpout` 速率 > 20 MB/min 持续 1 min | 立即停止构建 |
| X3 | `dmesg` 出现任何 OOM kill（含其它进程） | 立即停止，判定失败 |
| X4 | nginx/forum/mariadb 出现重启或 5xx | 立即停止 |
| X5 | 单次构建 > 5 min（异常） | 中止，怀疑内存抖动 |
| X6 | 单元 `oom_kill` > 0 | 判定失败 |

### 4.8 若失败：4 条降级路线（不改服务器既有服务）

| 路线 | 做法 | 触发条件 | 成本 |
|---|---|---|---|
| R1 流式构建 | 逐篇渲染→写盘→释放；`--max-old-space-size=96`；数据只加载一次 | B 超预算 ≤ 30% | 0（本就该做） |
| R2 低峰 + 限速 | 只允许 01:00–07:30 发布；`Nice=10`/`CPUQuota=60%` | R1 后仍超 10–20% | 0 |
| R3 本地构建上传 | 开发机构建 → `release.tar.gz`（含 manifest+sha256）→ `scp` → 服务器只校验与切换 | R1/R2 后仍不达标 | +1 人日 |
| R4 扩容 / 停 WordPress | 升配，或停无关 WordPress（释放约 400 MB） | 上述都不可接受 | 费用 / Owner 决策 |

> **本报告不执行、也不建议擅自停任何现有服务**（任务明令）。若唯一可行解是"停 WordPress"，那必须由 Owner 决策，且不能计入 CMS 的"通过"。

---

## 5. 发布状态机故障测试矩阵

### 5.1 状态与"可发布"的判定（先定死，避免部分成功被当成功）

`published` **仅当以下 4 条同时成立**才允许写入：
1. `readlink(h5/article)` 的 seq == 本次 release seq；
2. `sha256(h5/sitemap.xml)` == 本次 release 的 `sitemap_sha256`；
3. HTTP 自检通过（`/article/` 200 且含 `<!-- release:<seq> -->`）；
4. DB 事务提交成功。

API 语义：`published` → `200 {ok:true}`；`published_pending` → `202 {job_id}`（**不是成功**）；其余 → 4xx/5xx + `phase`。

### 5.2 故障注入矩阵

> 「注入方式」为测试设计；**本轮未执行**，需 Owner 授权后在沙箱/测试窗口执行。
> 「自动恢复」= `reconcile()` 无需人工即收敛到一致终态；「人工」= 必须进 `inconsistent` 并人工处理。

| ID | 注入点 | 注入方式 | 现场（注入后） | `reconcile()` 结论 | 自动/人工 | 终态 |
|---|---|---|---|---|---|---|
| **F1** | 构建完成后、校验前 | 构建中 `kill -9` CMS worker | `phase=building`，`releases/<seq>` 不存在（构建在 tmp） | 判 `failed_build`，清 `tmp/<seq>` | ✅ 自动 | 无副作用 |
| **F2** | 校验通过后、写意图前 | 校验通过瞬间 `kill -9` | `phase=verified`，release 目录已生成 | 判 `abandoned`（**不是** failed_verify，避免语义错误），保留目录供排查 | ✅ 自动 | 无副作用 |
| **F3** | 写 `switch_intent` 后、调 helper 前 | `kill -9` | `phase=switch_intent`；软链=prev；sitemap=prev | 软链==prev 且 sitemap==prev → `failed_switch` | ✅ 自动 | 无副作用 |
| **F4** | helper 切完软链、切 sitemap 前 | 在 helper 内两 rename 之间 `kill -9`（用测试开关或 `SIGSTOP`+改文件） | 软链=target；sitemap=prev | 软链==target 且 sitemap≠target → **重试 sitemap**（幂等）→ 成功则 `published` | ✅ 自动 | **一致（新版）** |
| **F5** | sitemap 切完、DB 提交前 | `kill -9` | 软链=target；sitemap=target；`phase=published_pending` | 两者皆 target → 跑自检 → 补写 `published` | ✅ 自动 | **一致（新版）** |
| **F6** | DB 提交失败 | 人为让事务失败（磁盘满/约束冲突） | 同 F5 | 同 F5 | ✅ 自动 | **一致（新版）** |
| **F7** | 服务重启（发布中） | `systemctl restart mcu-cms` | `phase ∈ {building…published_pending}` | 启动时跑 `reconcile()`，按 §5.3 算法收敛 | ✅ 自动 | 收敛 |
| **F8** | 两个发布并发 | 同时提交两次发布 | 第二个取不到 `flock` | 返回 `409 PUBLISH_IN_PROGRESS`；第一个正常 | ✅ 自动 | 无副作用 |
| **F9** | 数据库与文件系统不一致 | 手工把软链指向另一个 release（模拟运维误操作） | 软链=第三方 seq；DB 记录=target | 两者都对不上 → **`inconsistent`** + 告警 | ❌ 人工 | 需人工 |
| **F10** | sitemap 被外部改动 | 手工编辑 `h5/sitemap.xml` | sha 与记录不符 | 若 release 内有 sitemap → 覆盖回；否则 `inconsistent` | ⚠️ 自动（有 release 副本时）/ 人工 | 视情况 |
| **F11** | release 目录被部分删除 | 删掉 `article/index.html` | helper 校验失败 | `failed_switch`，不切 | ✅ 自动 | 无副作用 |
| **F12** | 当前软链指向的 release 被保留策略误删 | 手工删目录 | 软链悬空 → 全站 `/article/*` 404 | 保留策略守卫应阻止；若已发生 → `inconsistent` + 从 DB 重建 | ❌ 人工（可重建） | 需重建 |
| **F13** | 自检失败（服务未生效） | 让软链指向错误权限目录 | 软链=target 但 HTTP 404 | 回滚软链 + 回滚 sitemap → `rolled_back` | ✅ 自动 | **一致（旧版）** |
| **F14** | helper 崩溃（段错误/被杀） | `kill -9` helper | 视注入点落在 F3/F4/F5 | 同对应场景 | ✅ 自动 | 收敛 |
| **F15** | 心跳超时（构建卡死） | 人为让构建 sleep 300 s | `heartbeat_at` 过期 | Watchdog 判 `failed_build` 并杀子进程 | ✅ 自动 | 无副作用 |

### 5.3 `reconcile()` 判定表（唯一权威，按此实现）

| 软链 | sitemap sha | 结论 | 动作 |
|---|---|---|---|
| = target | = target | 两个 rename 都成功 | 跑自检 → 通过则 `published`，否则回滚 |
| = target | ≠ target | 崩在两次 rename 之间 | 重试 sitemap（幂等）→ 成功 `published`；失败则回滚软链 → `rolled_back` |
| = prev | ≠ target | 两个 rename 都没做 | `failed_switch`（无副作用） |
| = prev | = target | 异常组合（sitemap 先行/被外部改） | 用 prev 快照覆盖 sitemap → `rolled_back` |
| 其它 | 任意 | 第三方介入/人工误操作 | **`inconsistent`** + 告警，禁止自动处理 |

### 5.4 明确不能保证的部分（诚实边界）

- 两次 rename 之间是**真实时间窗口**（毫秒级），期间"文章已上线但 sitemap 未更新"。方向是"少"不是"多"，危害有限，且可重试。
- F9/F12 类**必须人工**，因为自动决定"该信任谁"会掩盖事故。
- 断电（非进程崩溃）可能让 rename 的目录项未落盘——本机为 ext4 + `data=ordered`，恢复后要么旧要么新，不会半写；但**未做 fsync 的 rename 语义不保证**，因此要求 helper 在两次 rename 后 `fsync` 目标目录（尽力而为）。【待验证】

---

## 6. Sitemap 与文件系统发布安全边界

### 6.1 唯一写入者：原则保留，但当前**链路是断的**

| 事实 | 证据 | 结论 |
|---|---|---|
| `/www/wwwroot/mcu-h5/tools` 不存在 | 【已验证】`ls` 报错 | 生成器**未部署** |
| 生成器只在本地仓库 `h5/tools/generate-sitemap.cjs` | 【已验证】 | 当前 sitemap 是**本地生成后手工上传**的 |
| 本地 `sitemap.xml` sha256 = `9ce7ffb0…c90219`，与线上**完全一致** | 【已验证】两侧 `sha256sum` | 说明本地工具输出 == 生产文件，**这是 `--check` 回归的黄金基线** |
| 生成器 `H5 = path.resolve(__dirname,'..')` | 【已验证】源码 L24 | 部署到别处会读错目录 |

→ **必须在 F3 授权变更里新增 `--h5 <dir>`**，否则部署后无法运行。

### 6.2 不要放进 Web root

若把 `.cjs` 放进 `/www/wwwroot/mcu-h5/tools/`，可直接被下载（`location /` 的 `try_files` 命中即返回，`application/octet-stream`）。**这是源码泄露，P1。**

正确位置：`/www/wwwroot/mcu-cms/app/tools/generate-sitemap.cjs`，并在 `cms_settings.tool_sha256` 记录哈希；每次发布前断言「部署副本哈希 == 仓库登记哈希」，不一致即拒绝发布。

### 6.3 F3 工具变更的完整清单（授权后一次性改到位）

| # | 变更 | 语义 | 兼容性 |
|---|---|---|---|
| T1 | `--extra <file>` | 追加 URL（每行 1 个绝对 URL） | 无参数时行为完全不变 |
| T2 | `--out <path>` | 输出路径 | 默认仍是 `h5/sitemap.xml` |
| T3 | `--h5 <dir>` | 指定 H5 根（读 `data/` 与模板校验） | 默认 `__dirname/..`（保持本地可用） |
| T4 | `--min-count <n>` | 合并后 URL 数 < n 则 **exit 1** | 无参数不启用 |
| T5 | `--allow-remove <file>` | 显式允许移除的 URL 白名单（下架用） | 无参数则不删除任何既有 URL |
| T6 | 排序与去重 | **基础 URL 段保持原有顺序不变**；`--extra` 段**自身排序后追加**；全表去重，发现重复 **exit 1**（不静默跳过） | 保证默认输出与现状字节一致 |
| T7 | `--check` | 保持现有语义（基础段一致性） | 必须仍 PASS |

**回归判据（可执行）**：
1. 不带任何新参数运行 → 输出 sha256 必须等于 `9ce7ffb0…c90219`（与线上一致）。
2. `--check` 必须 PASS（用现有文件）。
3. 带一个 `--extra`（2 条 /article URL）→ 基础 76 条顺序不变，2 条新 URL 追加在末尾且有序。
4. 故意制造重复 URL → 必须 exit 1。
5. 故意让 `--extra` 少 1 条（模拟误删）→ `--min-count 77` 必须 exit 1。

### 6.4 Sitemap 校验规则（三层，最终版）

| 层 | 位置 | 规则 |
|---|---|---|
| L1 工具内 | `generate-sitemap.cjs` | 模板存在、未上映不混入、**空数据拒绝**、**重复拒绝**、**`--min-count` 拒绝**、**`--allow-remove` 外不得删既有 URL** |
| L2 CMS 校验器 | build 校验阶段 | 解析产物：根元素/命名空间正确；每条 loc 以 `https://www.mcuatlas.xyz/` 开头；无 `..`；**新增 loc 必须命中本次 `sitemap-urls.txt`**；**loc 数 ≥ 上一版 − allow_remove 数**；**S7：任何 noindex 页面不得出现在 sitemap** |
| L3 特权助手 | `mcu-cms-publish` | 再独立解析一遍：S1 大小/根元素、S3 前缀、S4 新增全部命中清单、S5 无重复、S2 只增不减（读线上现有文件比对） |

> **三层都做不是冗余**：L1 防"工具改坏"，L2 防"构建把脏数据带进去"，L3 防"CMS 被完全控制后伪造结果"。L3 的那一遍**不信任任何 CMS 产物**，只信自己算出的集合。

### 6.5 生产文件保护范围（最终版，替代 V2.0 §3.2）

| 级别 | 路径 | 允许变化 | 谁能改 |
|---|---|---|---|
| **A 绝对冻结（38 个文件）** | `h5/*.html`(15)、`h5/data/*.js`(15)、`h5/assets/js/*.js`(3)、`h5/assets/css/*.css`(5) | **永不** | 无人（只能人工变更单 + 重新基线） |
| **B 受控变化** | `h5/sitemap.xml` | 每次发布 | 仅特权助手（内容来自 L1 工具） |
| **C 人工授权变更** | `h5/robots.txt`、`h5/tools/*`（若未来部署） | 仅变更单 | 人工 |
| **D 授权工具** | `h5/tools/generate-sitemap.cjs`（仓库侧） | 一次性 + 哈希留痕 | 开发（授权后） |
| **E CMS 产物** | `h5/article`（软链）、`h5/media`（软链） | 每次发布整体替换 | 仅特权助手（软链）+ CMS（软链目标内） |
| **F 禁止新增** | `h5/` 下任何其它新文件/新目录 | **禁止** | — |

> F 这一条是 V2.0 没写死的：**除 `/article`、`/media` 两个软链外，`h5/` 下不得新增任何文件**（包括 `.cjs`、`.json`、`.txt`）。新增前必须走变更单。

### 6.6 原子性边界（再次明确，避免误读）

| 操作 | 原子？ | 说明 |
|---|---|---|
| 单次 `rename(软链)` | ✅ **是** | 内核单系统调用；观察者只会看到旧或新 |
| 单次 `rename(sitemap)` | ✅ **是** | 同上 |
| 软链 + sitemap 的**组合** | ❌ **否** | 两次 rename 之间有窗口（毫秒级），只能靠"顺序 + 重试 + 对账" |
| 整批发布（构建→校验→切换→sitemap→自检→DB） | ❌ **否** | 靠状态机 + 写前意图 + `reconcile()` |
| 回滚 | ❌ **否** | 同样是两次 rename；回滚失败进 `inconsistent` |

**对应承诺（写进产品口径）**：CMS 保证「不静默成功」「不一致显式可见」「可对账收敛」；**不保证**跨资源零窗口原子。

---

## 7. D4：文章站内入口决策

### 7.1 前提（约束不可破）

现有 15 个 HTML + 15 个 data JS + 3 个 JS + 5 个 CSS = **38 个文件绝对冻结**。导航由 `app.js` 的 `NAV` 数组运行时生成，页脚由 `ui.foot()` 生成。**任何站内入口都必须改这两处之一或某页 HTML。**

### 7.2 四个候选（任务点名）逐个评估

| 方案 | 零改动？ | 效果 | 成本 | 维护 |
|---|---|---|---|---|
| **A. 独立文章列表页 `/article/`** | ✅ 是（全新文件） | 有"落地页"，但**没有任何入口指向它**；仅 sitemap 可发现 | 0（本来就要做） | 低 |
| **B. 分类入口 `/article/c/<cat>`** | ✅ 是 | 站内导航结构完整，但仍是"孤岛" | 0 | 低 |
| **C. 首页 / 现有导航接入** | ❌ 否（改 F1 冻结文件） | 有真实流量入口 | 1 个 `<a>` + 重新基线，约 0.5 人日 | 低（一次） |
| **D. 用现有专题内容引导** | ❌ 否（`special-routes.js` 是 F1 冻结，链接写死在数据里） | 可借"复联5补课"专题的流量 | 需改数据文件（违反铁律） | — |

**D 的替代实现**：在 CMS 侧新建一个**CMS 拥有的专题页** `/article/topic/avengers-doomsday`（内容由 CMS 撰写，链接到文章），零改动。但它**同样没有入口**，除非从外部渠道推广。

### 7.3 推荐（V1 最低成本 + 最低维护）

> **采纳 A + B 作为 V1 的"零改动骨架"，并同时准备 C 的「1 行入口变更单」，建议与上线同批执行。**

理由：

1. **A+B 是必须做的**（文章总得有个索引与分类），成本已含在 M5，不额外增加。
2. **纯 A+B 上线 = 只有搜索引擎知道文章存在**。这不是"SEO 友好"，而是"没有用户"。V1 的价值（管理员能独立发文章并被看到）至少有 80% 依赖入口。
3. **C 的最小形态可以做到风险极低**：在 `app.js` 的 `foot()` 里加一行链接（页脚），影响面 = 所有页面底部多一行文字；不挤占移动端导航、不改视觉层级、不改任何 CSS。改动 = **1 个文件 + 约 1 行**。
4. 若 Owner 拒绝任何冻结文件改动 → 明确接受"首月自然流量 ≈ 0"，并靠**站外渠道**（公众号/抖音主页/百度站长提交 sitemap）获得初始访问。

### 7.4 若批准 C：变更单草案（供 Owner 签字用）

| 项 | 内容 |
|---|---|
| 目标文件 | `h5/assets/js/app.js`（1 处）、`h5/index.html` 不涉及 |
| 具体位置 | `ui.foot()` 返回的页脚 HTML 内，追加 `<a href="/article/">漫威文章</a>` |
| 视觉影响 | 页脚多一个链接（与现有页脚链接同款式），**不改 CSS** |
| 影响页面 | 全部页面（页脚共用） |
| 风险 | 极低；但**破坏 F1 冻结**，必须走：① 改前备份 ② 改后重新生成 `baseline.json` ③ 在 `tool-change-log` 登记 ④ 回归（`h5/tools/regression-basic.cjs` 若可用） |
| 回滚 | 备份文件覆盖 + 重新基线 |
| 预估 | 0.5 人日（含回归） |

### 7.5 不推荐的做法

- ❌ 用 `meta refresh` / JS 跳到 `/article/`（对爬虫与用户都不友好）
- ❌ 在 sitemap 里塞一个"首页入口"（sitemap 不是导航）
- ❌ 改 `robots.txt` 或加隐藏链接（黑帽）
- ❌ 通过社区发帖引流（社区是独立服务，且属营销动作，不是产品入口）

---

## 8. G1 / G2 / G3 最终状态

### 8.1 G1 证书 —— **未完成（阻断项，剩余 35 天）**

| 项 | 内容 |
|---|---|
| 当前证书 | `CN=www.mcuatlas.xyz`，DigiCert DV，`notAfter = Dec 14 23:59:59 2026 GMT`【已验证】 |
| 剩余时间 | 今日 `Nov 9 08:42 UTC` → **35 天 15 小时** |
| 自动续签 | **未覆盖**：`/root/.acme.sh/` 只托管 `mcu.yaokaixin.top`、`mcu.yaoqiang.xin`、`yaoqiang.xin`；`mcuatlas.xyz` 不在其中【已验证】 |
| 状态判定 | **未完成**。属于"计划未执行"，不构成任何验证通过 |
| 独立处理要求 | ① Owner 在阿里云控制台续签单域名 DV（含 www）；② 部署 `fullchain.pem` / `privkey.key` 到原路径（`/www/server/panel/vhost/cert/mcuatlas.xyz/`）；③ `nginx -t && nginx -s reload`；④ `openssl s_client -connect www.mcuatlas.xyz:443 -servername www.mcuatlas.xyz` 复核新有效期；⑤ 建议同时把该域纳入 acme.sh（webroot 模式，`/.well-known/acme-challenge/` 已在 vhost 豁免），避免每年手工 |
| 硬约束 | **剩余 < 30 天时必须停止一切上线动作**（证书过期会让 CMS 文章页与新 sitemap 一并失效） |

### 8.2 G2 内存 —— **未完成（本轮只读，未起服务）**

必须执行的测试（§4.4）：

| 编号 | 测试 | 是否需授权 |
|---|---|---|
| S0 | 24 h 基线采样（不启动 CMS） | 否（只读） |
| S1 | 空载 10 min | 是（起服务） |
| S2 | 后台操作 20 min | 是 |
| S3 | 20 篇构建 | 是 |
| S4 | 60 篇构建 | 是 |
| S5 | 构建 + 20 rps 并发 | 是 |
| S6 | 08:00 窗口采样 | 否（只读，需值守） |

**本轮提供的可用证据（不等于通过）**：
- `MemAvailable` 两次实测 149,552 / 162,104 kB（波动 12.5 MB）→ 必须取 24 h 最小值；
- forum 单元已有 **13.85 MiB 被换出** → 系统已在用 swap；
- forum 单元历史峰值 `max_usage_in_bytes` = 37.5 MiB（当前仅 13.1 MiB）→ **"当前值"不能代表"峰值"**。

### 8.3 G3 发布权限 —— **方案已定案，实现未落地**

| 项 | 状态 |
|---|---|
| 方案 | ✅ **已定案**：`.path` + oneshot root helper + spool（§3.2），sudo 方案作废 |
| 落地 | ❌ **未执行**（本轮禁止创建用户/单元/文件） |
| 阻断原因 | 需要：① 创建 `mcucms` 系统用户；② 创建 `/etc/systemd/system/mcu-cms-publish.{service,path}`；③ 安装 `/usr/local/sbin/mcu-cms-publish`；④ 目录与权限；⑤ 沙箱验证 15 项注入场景。**以上全部需要 Owner 授权** |
| 判定 | **不视为"已通过"**。只能写"方案定案，实现待授权" |

---

## 9. 工作量是否调整

**结论：34 → 37 人日（区间 33–41）。**

| 增量项 | 人日 | 依据 |
|---|---|---|
| 特权执行单元（`.path` + `.service` + spool 加固 + O_NOFOLLOW/rename-to-work），替代 sudo 方案 | +0.5 | 少了 sudoers，但多了单元生命周期与 11 项加固校验 |
| 故障注入测试套件（F1–F15，含沙箱目录、注入开关、结果断言） | +1.5 | V2.0 只算了单元测试，没算"真注入"的脚手架 |
| Sitemap 工具 `--h5` / `--min-count` / `--allow-remove` + 部署路径 + 哈希对齐与回归 | +0.5 | N2/N6 新增 |
| 内存实测执行（S0 24h + S1–S5 + 报告） | +0.5 | 原估 1 人日，实际含值守与报告约 1.5 |
| **合计** | **+3.0** | |

不调整的部分：M2/M3/M4/M5 的业务功能量不变（V2.1 未新增功能，只加固与验证）。

---

## 10. 最终结论

### 10.1 判定

> **有条件进入开发（Conditionally GO）。**
> 架构方向成立、无新增致命矛盾；但 **C1/C2 未满足前不得开工 M6（发布链路）**，C3 未通过前不得进入 M5 的"上线"环节。

### 10.2 六个条件

| # | 条件 | 谁来做 | 判据 | 阻塞 |
|---|---|---|---|---|
| **C1** | **证书剩余 ≥ 60 天**，或已纳入自动续签 | Owner | `openssl x509 -enddate` 复核；acme 目录含该域或台账有明确续签日期 | 全部上线动作 |
| **C2** | **授权创建 `mcucms` 用户 + 两个 unit + helper + 目录权限**，并完成沙箱 15 项注入验证 | Owner 授权，开发执行 | 沙箱内 F1–F15 全绿（对照 §5.2 期望） | M6 |
| **C3** | **G2 内存实测通过**，或明确选定 R1/R2/R3/R4 降级路线 | 开发执行，Owner 确认 | §4.6 的 P1–P9 全绿，或降级路线书面确认 | M5 上线 |
| **C4** | **D4 决策**：是否批准"页脚 1 行入口"变更单 | Owner | 批准 → 走变更单；不批准 → 书面接受"首月自然流量≈0" | 不阻塞开发，影响价值 |
| **C5** | **F3 工具变更授权**：改 `generate-sitemap.cjs`（T1–T7） | Owner | 变更单 + 改后哈希登记 + §6.3 的 5 条回归全过 | M6 |
| **C6** | **robots.txt 策略定案**（D9）并生成 `robots.proposed.txt` | Owner | 文件归档，且**明确不由 CMS 自动部署** | 不阻塞 |

### 10.3 不需要再解决的问题（可留到后续，已列原因）

完整媒体库、复杂实体面板、RSS、复杂 GEO 分析、L4/L5 全站 SEO、作品/人物静态化、301 管理、AI 爬虫日志分析——见 V2.0 §18.2，本轮无变化。

### 10.4 本轮新增但可以后置的问题

| 问题 | 后置理由 | 何时处理 |
|---|---|---|
| N10 文章页 CSS 体积 | 不影响正确性，只影响性能 | M5 模板阶段顺手做（0 成本） |
| N11 noindex 不得入 sitemap | 一条校验规则 | M5 校验器实现时加（0 成本） |
| N8 systemd 239 的老版本行为差异 | 只能实测 | M6 沙箱（已含在 C2） |

### 10.5 明确不构成"已验证"的事项（防止误读）

| 事项 | 状态 |
|---|---|
| 内存是否够用 | ❌ 未验证（只有两次快照 + 一项 swap 证据） |
| sudo 在 NNP 下的报错文案 | ❌ 未在本机复现（机制确定，现象未录） |
| `.path` 单元能否正确触发 | ❌ 未验证（需创建单元） |
| `www` 能否穿过 `mcu-cms/releases` 读到文件 | ❌ 未验证（需建目录） |
| `rename` 覆盖已存在软链 | ❌ 未在本机验证 |
| 60 篇构建的真实峰值 | ❌ 未构建过 |
| 故障注入 F1–F15 | ❌ 全部未执行（本轮禁止） |
| sitemap 工具 T1–T7 改动 | ❌ 未改（仅为设计） |

---

## 附录 A：本轮只读核查新增事实

| # | 命令 | 结果 | 用途 |
|---|---|---|---|
| A-1 | `openssl x509 -enddate` | `notAfter=Dec 14 23:59:59 2026 GMT` | G1 |
| A-2 | `date -u` | `Mon Nov 9 08:42:17 AM UTC 2026` | 计算剩余 35 天 15 h |
| A-3 | `grep MemAvailable /proc/meminfo` | `162104 kB`；SwapFree `846796 / 1048572 kB` | 24 h 基线必要性、swap 已用 197 MiB |
| A-4 | `ls /sys/fs/cgroup/` | `memory` `cpu` `blkio` 独立目录 → **cgroup v1** | 指标平台判定 |
| A-5 | `cat .../mcu-forum-api.service/memory.{usage_in_bytes,stat,max_usage_in_bytes,memsw.*,oom_control}` | usage 13.75 MB / rss 3.68 MB / cache 8.03 MB / peak 39.36 MB / memsw 28.28 MB / oom_kill 0 / failcnt 0 / limit 150 MiB | 四个"占用"数字并存；峰值≠当前；已换出 13.85 MiB |
| A-6 | `ls /www/wwwroot/mcu-h5/tools` | No such file or directory | N2 |
| A-7 | `ls -l /usr/bin/sudo` | `---s--x--x` | setuid 存在但 NNP 下无效 |
| A-8 | `systemctl --version` | `systemd 239` | N8 |
| A-9 | `which systemd-run` | `/usr/bin/systemd-run` | G3 沙箱测试可行 |
| A-10 | `sha256sum /www/wwwroot/mcu-h5/sitemap.xml` | `9ce7ffb0…c90219`（6121 B） | sitemap 基线 |
| A-11 | 本地 `Get-FileHash h5/sitemap.xml` | `9CE7FFB0…C90219`（与线上**一致**） | 证明本地工具输出 == 生产文件 |
| A-12 | 本地 `Get-FileHash h5/tools/generate-sitemap.cjs` | `A2FABDC0…0753A5` | F3 变更前的工具基线 |

> 全程未读取任何密钥内容（`*.key`、`*.env` 只做存在性/权限检查），未执行写操作。

## 附录 B：待授权动作清单（本报告未执行）

| # | 动作 | 影响面 | 需谁授权 |
|---|---|---|---|
| B1 | 创建 `mcucms` 系统用户、目录树、权限 | 新增用户与目录 | Owner |
| B2 | 创建 `mcu-cms.service` / `mcu-cms-publish.{service,path}` | 新增 2 个 systemd 单元 | Owner |
| B3 | 安装 `/usr/local/sbin/mcu-cms-publish`（root:root 0755） | 新增特权可执行文件 | Owner |
| B4 | 执行 S1–S5 内存测试（含启动服务、施加负载） | 瞬时资源占用 | Owner |
| B5 | 执行 F1–F15 故障注入（沙箱 + 生产窗口） | 可能触发回滚 | Owner |
| B6 | 修改 `h5/tools/generate-sitemap.cjs`（T1–T7） | 仓库工具变更 | Owner |
| B7 | 证书续签与部署 | 生产证书 | Owner |
| B8 | （可选）页脚 1 行入口变更 + 重新基线 | F1 冻结文件 | Owner |
| B9 | 部署 `robots.txt` 建议稿 | 生产文件 | Owner |

## 附录 C：指标口径对照（给后续开发照抄）

| 你要回答的问题 | 看这个 | 不要看这个 |
|---|---|---|
| 进程真实占了多少**不可回收**内存？ | `memory.stat` → `rss` | `ps` RSS（含 file-backed） |
| 会不会撞 `MemoryMax`？ | `memory.usage_in_bytes` + `failcnt` | `memory.stat:rss`（不含缓存，会低估） |
| 这次构建的峰值是多少？ | `memory.max_usage_in_bytes`（历史峰值） | 只采当前值（会漏掉瞬时峰值） |
| 有没有被换出？ | `memsw.usage − usage`；`pswpout` 差分 | 只看 swap 总量（噪音大） |
| 系统还够不够？ | `/proc/meminfo: MemAvailable` **的 24 h 最低值** | 单点 `free` |
| 有没有被杀？ | `memory.oom_control: oom_kill` + `dmesg` | 服务是否还在（systemd 会自动重启） |
