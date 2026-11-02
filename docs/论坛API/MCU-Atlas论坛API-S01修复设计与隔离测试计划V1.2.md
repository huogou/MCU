# S-01 修复设计与隔离测试计划 V1.2

| 项 | 内容 |
|---|---|
| 文档 | 《S-01 修复设计与隔离测试计划 V1.2》 |
| 项目 | MCU Atlas 论坛 API（`workspace/forum-api`） |
| 基线 | V1.1（2026-10-23） |
| 修订原因 | P0-1 IP 规范化不完整、P0-2 隔离护栏未闭环、P0-3 注册限流端到端验证缺失、P1-1 单测副作用审查不足、P1-2 生产 systemd 环境未核实 |
| 执行方 | CodeBuddy（开发 AI） |
| 审查方 | ChatGPT（独立设计验收） |
| 日期 | 2026-10-23 |
| 审查状态 | **待独立审查** |
| 本轮性质 | 设计修订。**未修改任何代码、未创建任何待实施文件、未运行任何测试、未连接生产数据库、未读取/输出任何密钥或 Token、未发送生产写请求、未重启/重载/部署任何服务。** |

---

## 1. 文档元数据与结论速览

| 项 | 值 |
|---|---|
| 根因 | `server.js:69` 以 `req.socket.remoteAddress` 作为 `ctx.ip`；在「nginx 回环反代」部署下所有公网请求该值恒为 `127.0.0.1`，注册限流 key 退化为全站单桶 |
| 修复面 | 新增 `lib/client-ip.js`；改 `server.js`（3 处）、`config.js`（路径派生 + env 回退 + 信任配置） |
| 独立事项 | 方案 B（前端公开 GET 解耦）——分开实施/测试/上线 |
| 本轮新增闭环 | P0-1 完整 IP 规范化规范与精确断言；P0-2 护栏执行顺序 + 12 项负向测试；P0-3 注册限流端到端矩阵；P1-1 单测依赖链审查；P1-2 生产 systemd 环境只读核查（已完成） |
| 最终准入结论 | **有条件批准**（见第 20 章） |

---

## 2. V1.1 问题清单及风险等级

| 编号 | 问题 | 等级 | V1.2 处置 |
|---|---|---|---|
| V1.1-P0-1 | IPv4-mapped IPv6 用简单正则，不覆盖大小写与十六进制等价形式（`::ffff:c0a8:101`）；白名单与客户端地址可能因文本表示不同而绕过 | **P0** | 第 5 章完整解析规范 + 第 9 章精确断言 |
| V1.1-P0-2 | 护栏只判 URL 字符串包含性；未定义符号链接/路径逃逸/Windows 路径/重定向/子进程与临时目录清理 | **P0** | 第 7、8 章 |
| V1.1-P0-3 | 无注册限流端到端验证设计 | **P0** | 第 10 章 |
| V1.1-P1-1 | 用 grep 关键词证明「单测无网络」；TC-A13 断言模糊 | P1 | 第 11 章 + 第 9 章 N-13~N-25 |
| V1.1-P1-2 | 未核实生产 systemd 环境变量是否覆盖路径 | P1 | 第 12 章（**本轮已完成核查，无覆盖**） |
| V1.1-遗留 | R-01~R-12（V1.0→V1.1 已闭环项） | — | 继续有效，见附录对照表 |

---

## 3. S-01 根因与影响范围

### 3.1 根因链（已线上确认）

```
公网请求 → nginx:443 (location ^~ /api/) → proxy_pass http://127.0.0.1:8787
         → 应用 accept：req.socket.remoteAddress === '127.0.0.1'
         → server.js:69  ctx.ip = '127.0.0.1'
         → users.js:21    rate.registerByIp('127.0.0.1')
         → rate-limit.js:41 key = 'reg:127.0.0.1'，窗口 1h，阈值 5
         → 全站所有访客共享同一注册桶
```
叠加链：`h5/assets/js/forum.js` 的 `api()` 先 `ensureToken()`→`register()`，公开列表/详情也走该链 → 注册被限流时**新访客连公开内容都加载不出**。

### 3.2 影响范围

- 功能：任意 1 小时窗口内第 6 个新设备注册即 429，且连带公开浏览失败（服务端公开 GET 本身不要求身份，前端前置才是放大器）。
- 安全：按 IP 防刷意图失效（无法区分来源）。
- 现网证据：2026-10-13 13:26:57–13:32:23 连续 5 次成功注册占满 1 小时配额；尚无第 6 次尝试，故未出现 429。

### 3.3 不在本次范围

S-02/S-03（token 撤销、deviceId 凭证化）、S-04（空体 500）、D-01/D-02/D-03（计数与事务）、D-04（举报消费端）、S-06~S-10 等，均单独立项，不得搭车。

---

## 4. 目标架构与客户端 IP 可信链路

```
                        ┌─────────────────────────────┐
公网客户端 ──HTTPS──► nginx:443                        │
                        │  location ^~ /api/           │
                        │  proxy_set_header X-Real-IP $remote_addr;        ← 覆盖客户端伪造值
                        │  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;  ← 客户端值在左、观测值在右
                        └──────────────┬──────────────┘
                                       ▼
                              127.0.0.1:8787（仅回环）
                                       ▼
                        server.js：clientIp(req, {trustProxy, trustedProxies})
                          N2 信任判定：trustProxy===true 且 normalize(peer) ∈ TRUSTED_PROXIES
                          N3 顺序：X-Real-IP → XFF 最右 → peer → 'unknown'
                                       ▼
                         ctx.ip → rate.registerByIp(ctx.ip) → key 'reg:<真实客户端IP>'
```

可信边界声明：
- **唯一可信代理** = `TRUSTED_PROXIES`（当前 `['127.0.0.1','::1']`，即同机 nginx）。
- 只有来自该集合的 TCP 对端，才允许读取 `X-Real-IP` / `X-Forwarded-For`。
- 新增任何前置代理/CDN 时，必须将其 IP 加入白名单，并确保该层覆盖 `X-Real-IP`；否则限流桶粒度退化为「按最后一跳代理」——此约束写入代码注释与运维清单。
- 应用**不监听公网**（`HOST=127.0.0.1`，本轮不修改），公网无法直连 8787；此为纵深防御层，不作为唯一依赖。

---

## 5. IP 解析、规范化与白名单匹配规则（P0-1 闭环）

### 5.1 Node 标准库能力边界（明确声明，不虚构能力）

| 标准库能力 | 是否提供 | 本设计用法 |
|---|---|---|
| `net.isIP(v)` | 仅校验（返回 0/4/6） | **辅助交叉校验**：解析结果必须满足 `net.isIP(text) !== 0` |
| `net.isIPv4` / `net.isIPv6` | 仅校验 | 同上 |
| IPv6 规范化 / canonicalization | **不提供** | 由本模块自行实现（5.2） |
| `net.BlockList` 对 `::ffff:127.0.0.1` 与 `127.0.0.1` 的相等语义 | **未文档化** | **不依赖**；白名单匹配使用本模块同一规范化函数 |

**剩余限制（明示）**：不处理 zone id（`%eth0`）、不处理前缀长度（`/64`）、不接受带端口或方括号形式（一律判负，不做「修复」）；这些输入在测试中以 `null` 固化。

### 5.2 `canonicalizeIp(value)` 规范（实现必须逐条满足）

```
C1  typeof value !== 'string'                                    → null
C2  s = value.trim(); s 为空或 s.length > 45                     → null
C3  /[^0-9a-fA-F:.]/.test(s)                                     → null   （拒绝端口、方括号、%zone、/prefix、空白、引号）
C4  显式再拒：含 '[' / ']' / '%' / '/'                            → null   （冗余双保险）
C5  IPv4 分支（s 含 '.'）：
      parts = s.split('.')
      parts.length === 4
      且每段匹配 /^(0|[1-9][0-9]{0,2})$/                          （拒绝前导零，如 '01'）
      且每段数值 ≤ 255
      → { kind:'v4', text:s }
      s 含 '.' 但不符合上述                                        → null（不得回落按 IPv6 解释）
C6  IPv6 分支：
      C6.1 若 s 含 '.'：仅允许出现在最后一个 ':' 之后（embedded IPv4）；
            按 C5 的 IPv4 规则解析该尾段 → 转成 2 个 hextet；失败 → null
      C6.2 按 '::' 分割；出现次数 > 1                            → null
      C6.3 有 '::' 时：left/right 各自按 ':' 分割，每组匹配 /^[0-9a-fA-F]{1,4}$/，否则 null；
            hextets = left + 补零(8 - left.length - right.length) + right；
            若 (8 - left.length - right.length) < 0               → null
      C6.4 无 '::' 时：分组总数（embedded IPv4 计 2 组）必须 === 8，否则 null
      C6.5 mapped 判定：hextets[0..4] 全为 0 且 hextets[5] === 0xffff
            → { kind:'v4mapped', text: 由 hextets[6],hextets[7] 生成点分十进制 }
      C6.6 否则 → { kind:'v6', text: 规范压缩形式（最长连续 0 段 ≥2 压为 '::'，全小写）}
C7  输出交叉校验：net.isIP(text) !== 0，否则 null（自守卫，防解析器自身缺陷）
```

**映射目标（明确）**：IPv4-mapped IPv6 统一映射为**点分十进制 IPv4 文本**，因此 `::ffff:127.0.0.1`、`::FFFF:127.0.0.1`、`::ffff:c0a8:101`、`0:0:0:0:0:ffff:127.0.0.1` 与 `127.0.0.1` 规范化结果**完全相同**——这不是字符串替换，而是按 C6.5 的 hextet 判定后重新生成文本。

### 5.3 来源区分（不得混用同一套含糊规则）

| 来源 | 特征 | 规则 |
|---|---|---|
| `req.socket.remoteAddress` | Node 保证为**裸地址**，无端口、无方括号 | 直接进 `canonicalizeIp`；若解析为 null → 该请求不可信/不可用 |
| HTTP 头 `X-Real-IP` / `X-Forwarded-For` | 任意客户端文本，可能带端口、方括号、多值、大小写混写 | 同样进 `canonicalizeIp`；带端口/方括号一律 null（**不剥离端口、不去后缀、不猜端口**） |
| 白名单条目（`config.TRUSTED_PROXIES`） | 配置文本 | 同样进 `canonicalizeIp`，与客户端地址处于同一规范空间 |

### 5.4 白名单匹配

`isTrustedPeer(peerRaw, trustedRaw)`：对 `peerRaw` 与**每一个** `trustedRaw` 条目都执行 `canonicalizeIp`，在规范文本层面比较。任一客户端文本表示无法通过「换一种等价写法」绕过白名单。

### 5.5 `clientIp(req, opts)` 最终规则

```
N1 peer = canonicalizeIp(req.socket.remoteAddress)
N2 trusted = (opts.trustProxy === true) && peer !== null && trusted 列表（已规范化）包含 peer
N3 若 trusted：
     a) xri = canonicalizeIp(req.headers['x-real-ip'])；非 null → 返回 xri
     b) xff = canonicalizeIp(rightmostXff(req.headers['x-forwarded-for']))；非 null → 返回 xff
N4 返回 peer 非 null ? peer : 'unknown'
```
`rightmostXff(v)`：`v` 按 `,` 分割，取**最后一段** trim 后交给 `canonicalizeIp`；空/非字符串 → null。**禁止读取第一段。**

---

## 6. 配置项、路径解析与环境变量优先级

### 6.1 配置来源优先级（高 → 低）

```
进程环境变量（仅 harness 注入）  >  config.js 常量默认值
```
生产服务经第 12 章核查**未注入任何** `FORUM_*` 变量，因此生产实际使用常量默认值。

### 6.2 `config.js` 变更规格（S-4）

| 配置项 | 规则 | 生产实际值（未设 env 时） |
|---|---|---|
| `HOST` | `env.FORUM_HOST \|\| '127.0.0.1'` | `127.0.0.1` |
| `PORT` | `env.FORUM_PORT !== undefined ? Number(env.FORUM_PORT) : 8787` | `8787` |
| `DATA_DIR` | `env.FORUM_DATA_DIR \|\| path.join(__dirname,'data')` | `<项目>/data` |
| `DB_PATH` | `path.join(DATA_DIR,'forum.db')` | `<项目>/data/forum.db` |
| `SECRET_PATH` | `path.join(DATA_DIR,'secret.key')` | `<项目>/data/secret.key` |
| `ADMIN_TOKEN_PATH` | `path.join(DATA_DIR,'admin-token.key')` | `<项目>/data/admin-token.key` |
| `TRUST_PROXY` | 常量 `true` | `true` |
| `TRUSTED_PROXIES` | 常量 `['127.0.0.1','::1']` | 同左 |

**关键修正（相对 V1.1 R-05）**：`DB_PATH`/`SECRET_PATH`/`ADMIN_TOKEN_PATH` 必须由 `DATA_DIR` **派生**，禁止三者继续独立拼自 `__dirname`；否则隔离测试会连生产库、读生产密钥。
**关键修正（R-04）**：`PORT` 不得使用 `\|\|`，否则 `FORUM_PORT=0` 被吞成 8787。
**等价性证明**：env 全未设置时，四个路径与旧代码 `path.join(__dirname,'data', …)` 逐字节相同；`HOST/PORT` 与旧字面量相同。

### 6.3 与生产 systemd 的关系

第 12 章核查结论：unit 无 `EnvironmentFile`、无 drop-in、进程环境仅 8 个标准变量（`HOME/INVOCATION_ID/JOURNAL_STREAM/LANG/LOGNAME/NODE_ENV/PATH/USER`），**不存在**覆盖 `HOST/PORT/DATA_DIR/DB_PATH/SECRET_PATH/ADMIN_TOKEN_PATH` 的变量。因此 6.1 的优先级在生产恒为「常量默认值」，设计与之无冲突。
> 边界：若未来给 unit 增加 `Environment=`/`EnvironmentFile=`，必须重新评估本设计并更新第 12 章核查记录。

---

## 7. 隔离测试架构与护栏执行顺序（P0-2 闭环）

### 7.1 隔离实例（唯一合法形态）

```
数据根目录：fs.mkdtempSync(path.join(os.tmpdir(),'forum-e2e-'))     ← DB + secret.key + admin-token.key 全部派生自此
端口：      FORUM_PORT=0（OS 分配随机可用端口）
主机：      FORUM_HOST=127.0.0.1
密钥：      由应用首次启动在该临时目录内自动生成（测试代码不得读取任何生产路径密钥）
```

### 7.2 端口发现（禁止猜测）

唯一合法来源：harness 解析子进程 stdout 的 `[forum-api] listening on http://127.0.0.1:<port>`（依赖 S-3 打印 `server.address().port`）。
- 禁止：写死 8787、端口扫描、读取配置文件中的 `PORT`、`netstat` 猜测。
- 解析失败 → 立即终止（退出码 10），**不得回退任何默认端口**。
- harness 取得端口后必须断言 `port !== 8787`，否则终止（退出码 4）。

### 7.3 护栏执行顺序（硬性时序，任何一步失败即停止后续所有副作用步骤）

```
阶段 0（纯进程内，无 IO、无网络、无子进程）
  0.1 读取 env：FORUM_BASE_URL / FORUM_DATA_DIR / FORUM_SECRET_PATH / FORUM_ADMIN_TOKEN_PATH
  0.2 G1 目标必填                         → 失败 exit 2
阶段 1（纯解析，无 IO）
  1.1 new URL(FORUM_BASE_URL)
  1.2 G2 协议必须 http:（不允许 https/file: 等）           → 失败 exit 3
  1.3 G3 主机名必须 ∈ {127.0.0.1, ::1, localhost}
        （用 URL.hostname 精确比较 + net.isIP，不用「包含」判断）→ 失败 exit 3
  1.4 G4 端口不得为 8787（除非 FORUM_E2E_ALLOW_PROD_PORT=1，本机制本轮禁用）→ 失败 exit 4
  1.5 G5 URL 不得含 userinfo（username/password 必须为空）→ 失败 exit 4
  1.6 G6 目标与所有路径不得包含生产域名字面量
        （mcuatlas.xyz / mcu.yaokaixin.top / mcu.yaoqiang.xin / 8.137.48.145）→ 失败 exit 6
阶段 2（文件系统，只读判定，不写入）
  2.1 FORUM_DATA_DIR 必须已设置                                → 失败 exit 5
  2.2 路径规范化：path.resolve() 后不得含 '..' 段                → 失败 exit 7
  2.3 Windows 形式判定：在 Linux 上出现 'X:\' 或 '\\' 开头        → 失败 exit 7
  2.4 符号链接解析：fs.realpathSync(DATA_DIR) 必须位于 os.tmpdir() 的 realpath 之内 → 失败 exit 7
  2.5 SECRET_PATH / ADMIN_TOKEN_PATH 的 realpath 必须位于 DATA_DIR 的 realpath 之内 → 失败 exit 5
  2.6 上述任一 realpath 含 '/www/'                              → 失败 exit 5
阶段 3（创建临时目录、启动子进程）—— 仅在前两阶段全过后执行
阶段 4（发起网络请求）—— 仅使用 harness 返回的 host:port
阶段 5（运行中断言）—— 任何响应/重定向到非预期 BASE            → 记为 FAIL 并 exit 8
阶段 6（清理：kill 子进程 + rm 临时目录）
```

### 7.4 失败与清理机制

| 异常场景 | 处理 | 退出码 |
|---|---|---|
| 护栏拒绝 | 打印拒绝原因（仅路径/主机名，无密钥），**不**创建目录、**不**启动子进程、**不**发请求 | 2/3/4/5/6/7 |
| 临时目录创建失败 | 终止，不启动子进程 | 9 |
| 子进程启动失败（spawn error / 立即退出） | 读取 stderr 前 200 字符打印，清理已建目录 | 9 |
| 服务未在 15s 内输出监听行 | kill 子进程，清理目录 | 10 |
| 端口解析得到 8787 或非法值 | kill 子进程，清理目录 | 4 |
| 测试超时（单请求 10s / 整体 120s） | kill 子进程，清理目录，记录超时用例 | 11 |
| 断言失败 | 继续跑完剩余用例，汇总后 kill + 清理 | 12 |
| 用户中断（SIGINT/SIGTERM） | 信号处理：kill 子进程、清理目录、退出 | 130/143 |
| 子进程异常退出（测试中崩溃） | 记录退出码与 stderr 尾部，终止后续用例 | 12 |
| 临时目录删除失败 | 打印目录路径与 errno，退出码 13，**要求人工确认后处理** | 13 |
| 子进程 kill 后仍存活（3s 宽限期后） | 打印 PID，退出码 14，**要求人工确认后处理** | 14 |

清理保证：所有「启动子进程」之后的失败路径都必须经过统一 `cleanup()`（kill + rm）；若 OS 行为导致无法清理，必须**显式报告**（退出码 13/14），不得静默通过。

---

## 8. 护栏负向测试矩阵（GN-01 ~ GN-12）

| 测试 ID | 输入或环境 | 预期行为 | 预期退出码 | 网络副作用 | 文件副作用 | 进程副作用 | 验证方式 |
|---|---|---|---|---|---|---|---|
| GN-01 | `FORUM_BASE_URL=http://127.0.0.1:8787`（生产默认形态，无授权开关） | 拒绝启动 | 4 | 不得发生任何 HTTP 请求 | 不得创建/读取/写入/删除任何路径 | 不得启动子进程 | 断言 exit=4 且 stderr 含「prod port」；用 `strace`-free 方式：harness 在阶段 0/1 即退出 |
| GN-02 | `FORUM_BASE_URL=https://mcuatlas.xyz/api/topics` | 拒绝启动 | 3（主机名非回环） | 不得发生任何请求 | 无 | 不得启动子进程 | 断言 exit=3 |
| GN-03 | `FORUM_BASE_URL=http://203.0.113.9:9999` | 拒绝启动 | 3 | 不得发生任何请求 | 无 | 不得启动子进程 | 断言 exit=3 |
| GN-04 | `FORUM_BASE_URL` 指向合法随机端口，但 `FORUM_DATA_DIR` 未设置 | 拒绝启动 | 5 | 无 | 不得创建任何目录 | 不得启动子进程 | 断言 exit=5 |
| GN-05 | `FORUM_SECRET_PATH=/www/wwwroot/forum-api/data/secret.key` | 拒绝启动 | 5 | 无 | **不得读取该文件** | 不得启动子进程 | 断言 exit=5 且 stderr 指明路径违规；交叉验证：该文件 mtime 不变 |
| GN-06 | `FORUM_DATA_DIR` 为指向 `/www/wwwroot/forum-api/data` 的符号链接 | 拒绝启动 | 7 | 无 | 不得读取/写入链接目标 | 不得启动子进程 | 断言 exit=7；realpath 判定生效 |
| GN-07 | `FORUM_DATA_DIR=/tmp/forum-e2e-x/../../www/wwwroot/forum-api/data` | 拒绝启动 | 7 | 无 | 不得读取/写入 | 不得启动子进程 | 断言 exit=7（规范化后含 `..`/越出 tmpdir） |
| GN-08 | `FORUM_DATA_DIR=C:\Windows\Temp\forum`（Linux 上的 Windows 路径形式） | 拒绝启动 | 7 | 无 | 无 | 不得启动子进程 | 断言 exit=7 |
| GN-09 | 隔离实例运行中，服务端返回 302 到外部域 | 拒绝跟随，记 FAIL | 8 | 不得请求外部域 | 无 | 子进程由 harness 管理 | 断言 exit=8 且未产生外部请求（harness 记录全部请求目标） |
| GN-10 | `FORUM_SECRET_PATH`/`FORUM_ADMIN_TOKEN_PATH` 指向不存在的文件 | 拒绝启动 | 5 | 无 | 不得创建密钥文件于项目目录 | 不得启动子进程 | 断言 exit=5 |
| GN-11 | 目标合法但子进程启动即失败（如 `FORUM_PORT=abc`） | 清理并终止 | 9 | 无 | 临时目录已删除 | 子进程被 kill | 断言 exit=9 且临时目录不存在 |
| GN-12 | 服务启动后 15s 内未输出监听行（模拟 hang） | kill + 清理 | 10 | 无 | 临时目录已删除 | 子进程被 kill | 断言 exit=10 且目录已删 |
| GN-13 | 测试中途 SIGINT | kill 子进程 + 清理目录 | 130 | 无进行中请求残留 | 临时目录已删除 | 子进程已终止 | 断言目录已删、无残留 node 进程 |
| GN-14 | 临时目录 `rm` 失败（只读目录模拟） | 报告并终止 | 13 | 无 | 目录保留并打印路径 | 子进程已 kill | 断言 exit=13 且人工处理提示出现 |

> 若任一项无法可靠防护，即列为 P0 阻塞，不得默认放行。当前设计对 GN-01~GN-14 均可执行判定；GN-13/GN-14 依赖 OS 行为，设计为「显式报告 + 退出码」，见 7.4。

---

## 9. IP 纯单测矩阵（`test/unit/client-ip.test.mjs`，精确断言）

断言约定（全局统一）：非法/不可用输入 → 函数返回 `null`；`clientIp` 在全来源不可用时返回字符串 `'unknown'`。**不得**用「最终不是非法地址」类模糊断言。

### 9.1 `canonicalizeIp` / `normalize`

| ID | 输入 | 预期返回值 | 说明 |
|---|---|---|---|
| N-01 | `'192.168.1.1'` | `'192.168.1.1'` | 标准 IPv4 |
| N-02 | `'8.8.8.8'` | `'8.8.8.8'` | 标准 IPv4 |
| N-03 | `'255.255.255.255'` | `'255.255.255.255'` | 边界 |
| N-04 | `'0.0.0.0'` | `'0.0.0.0'` | 边界 |
| N-05 | `'2001:db8::1'` | `'2001:db8::1'` | 标准压缩 IPv6 |
| N-06 | `'2001:0db8:0000:0000:0000:0000:0000:0001'` | `'2001:db8::1'` | 合法非压缩表示须归一 |
| N-07 | `'::1'` | `'::1'` | IPv6 回环 |
| N-08 | `'::ffff:192.168.1.1'` | `'192.168.1.1'` | v4-mapped 小写 |
| N-09 | `'::FFFF:192.168.1.1'` | `'192.168.1.1'` | v4-mapped 大写 |
| N-10 | `'::ffff:c0a8:101'` | `'192.168.1.1'` | v4-mapped 十六进制形式（简单正则覆盖不到） |
| N-11 | `'0:0:0:0:0:ffff:192.168.1.1'` | `'192.168.1.1'` | v4-mapped 全展开形式 |
| N-12 | `'::ffff:10.0.0.1'` | `'10.0.0.1'` | mapped 另一例 |
| N-13 | `'1.2.3.4:5678'` | `null` | 带端口，**不剥离** |
| N-14 | `'[::1]:8787'` | `null` | 方括号 + 端口，**不剥离** |
| N-15 | `'fe80::1%eth0'` | `null` | zone id |
| N-16 | `'2001:db8::/64'` | `null` | 前缀长度 |
| N-17 | `'999.1.1.1'` | `null` | 非法 IPv4 |
| N-18 | `'256.1.1.1'` | `null` | 非法 IPv4 |
| N-19 | `'01.2.3.4'` | `null` | 前导零（明确拒绝策略） |
| N-20 | `'1.2.3'` | `null` | 段数不足 |
| N-21 | `'1.2.3.4.5'` | `null` | 段数过多 |
| N-22 | `'abc'` | `null` | 非 IP |
| N-23 | `'12345::'` | `null` | 组超长 |
| N-24 | `'1::2::3'` | `null` | 双 `::` |
| N-25 | `':::'` | `null` | 非法 |
| N-26 | `'::'` | `'::'` | 合法全零 |
| N-27 | `''` | `null` | 空串 |
| N-28 | `null` / `undefined` / `123` / `{}` / `['::1']` | `null` | 非字符串 |
| N-29 | 46 字符合法形态超长串（如 `'1'.repeat(46)`） | `null` | 超长 |
| N-30 | `' 192.168.1.1 '`（前后空白） | `'192.168.1.1'` | trim 后合法 |
| N-31 | `'192.168.1.1\n'` | `'192.168.1.1'` | 含尾部换行，trim 后合法 |
| N-32 | `'::FFFF:192.168.1.1'`（混合大小写十六进制） | `'192.168.1.1'` | 大小写不敏感 |
| N-33 | `'2001:DB8::AB'` | `'2001:db8::ab'` | 输出必须小写 |
| N-34 | `'0:0:0:0:0:0:0:1'` | `'::1'` | 压缩归一 |
| N-35 | `'1:2:3:4:5:6:7:8'` | `'1:2:3:4:5:6:7:8'` | 无零段不压缩 |
| N-36 | `'1:0:0:2:0:0:0:3'` | `'1:0:0:2::3'` | 取**最长**零段压缩 |
| N-37 | `'64:ff9b::1.2.3.4'`（NAT64 well-known） | `null` | 设计明确不支持 NAT64 嵌入 IPv4（非 mapped），判负 |
| N-38 | `'::0.0.0.2'` | `null` | 非 mapped 的 IPv4 尾（`hextets[5] !== 0xffff`）→ 判负（设计取舍：仅 mapped 归一，其余含 IPv4 尾的 IPv6 判负） |

> N-37/N-38 为**明确设计取舍**：仅 `::ffff:a.b.c.d` 族映射为 IPv4；其它含 IPv4 尾的 IPv6 文本一律判负（fail-closed），避免把不同语义地址混入同一桶。如需支持 NAT64，须单独立项扩展 C6.5。

### 9.2 `rightmostXff`

| ID | 输入 | 预期 |
|---|---|---|
| X-01 | `'9.9.9.9, 203.0.113.9'` | `'203.0.113.9'` |
| X-02 | `'203.0.113.9'` | `'203.0.113.9'` |
| X-03 | `'9.9.9.9,203.0.113.9,198.51.100.7'` | `'198.51.100.7'` |
| X-04 | `''` / `null` / `123` | `null` |
| X-05 | `'9.9.9.9, '` | `null`（末段空 → canonicalize 判负） |

### 9.3 `isTrustedPeer`

| ID | peerRaw | 白名单（原始） | 预期 |
|---|---|---|---|
| T-01 | `'127.0.0.1'` | `['127.0.0.1','::1']` | `true` |
| T-02 | `'::ffff:127.0.0.1'` | `['127.0.0.1','::1']` | `true`（规范化后命中） |
| T-03 | `'127.0.0.1'` | `['::ffff:127.0.0.1','::1']` | `true`（白名单侧同样规范化） |
| T-04 | `'::1'` | `['127.0.0.1','::1']` | `true` |
| T-05 | `'203.0.113.9'` | `['127.0.0.1','::1']` | `false` |
| T-06 | `'not-an-ip'` | `['127.0.0.1']` | `false` |
| T-07 | `'127.0.0.1'` | `[]` | `false` |

### 9.4 `clientIp` 端到端（单测层）

| ID | 构造 | 预期 |
|---|---|---|
| C-01 | peer=`127.0.0.1`，trustProxy=true，白名单含之，`X-Real-IP: 203.0.113.9` | `'203.0.113.9'` |
| C-02 | peer=`127.0.0.1`，trustProxy=true，`X-Real-IP: 198.51.100.7` | `'198.51.100.7'`（证明两个 IP 得分到不同 key） |
| C-03 | peer=`127.0.0.1`，trustProxy=true，`X-Real-IP: abc` + `X-Forwarded-For: 9.9.9.9, 203.0.113.9` | `'203.0.113.9'`（非法头不判 unknown，继续回退） |
| C-04 | peer=`127.0.0.1`，trustProxy=true，无任何转发头 | `'127.0.0.1'` |
| C-05 | peer=`203.0.113.9`（不在白名单），`X-Real-IP: 1.1.1.1` | `'203.0.113.9'`（伪造头被忽略） |
| C-06 | peer=`::ffff:127.0.0.1`，`X-Real-IP: 2001:db8::1` | `'2001:db8::1'`（peer 归一后可信） |
| C-07 | peer=`::1`，`X-Real-IP: 2001:db8::1` | `'2001:db8::1'` |
| C-08 | peer=`null`，头全非法 | `'unknown'` |
| C-09 | trustProxy=false，peer=`127.0.0.1` + `X-Real-IP: 1.1.1.1` | `'127.0.0.1'` |
| C-10 | trustProxy=true 但白名单为 `[]` + 任意头 | `'127.0.0.1'` |
| C-11 | `X-Forwarded-For: 2001:db8::1, 203.0.113.9`（含 IPv6 左值） | `'203.0.113.9'`（最右） |
| C-12 | `X-Real-IP: ::ffff:203.0.113.9` | `'203.0.113.9'`（头部 mapped 归一） |
| C-13 | `X-Real-IP` 为 46 字符 | 回退至 peer（不是 unknown） |

---

## 10. 注册限流隔离端到端测试矩阵（P0-3）

**环境硬约束**：仅使用 `test/harness.mjs` 启动的隔离实例；所有请求只发往 harness 返回的实际随机端口；不请求生产域名或 8787；不读取生产密钥；使用临时数据库与测试密钥；每次注册使用不同 `deviceId`（避免幂等逻辑干扰）。

### 场景 A：同一客户端 IP 的注册限流

| 项 | 内容 |
|---|---|
| 测试 ID | E2E-A |
| 前置条件 | 隔离实例已启动；harness 已记录 `BASE=http://127.0.0.1:<randPort>`；该端口 ≠ 8787 |
| 客户端 IP | 固定 `203.0.113.10`（通过请求头 `X-Real-IP` 提供，peer 为 harness 本机回环故可信） |
| 请求序列 | R1..R6：`POST /api/me/register`，body `{deviceId: <每次不同的合法 UUID>}`，header `X-Real-IP: 203.0.113.10` |
| 预期状态码 | R1~R5：`200`；R6：`429` |
| 预期业务错误码 | R6：`error.code === 'RATE_LIMITED'` |
| 预期限流桶行为 | 桶 key 为 `reg:203.0.113.10`；窗口 1h；第 6 次超出阈值 |
| 失败判定 | 出现以下任一即 FAIL：R1~R5 非 200；R6 非 429；R6 错误码不符；任何请求使用了非 harness 端口 |
| 证据记录 | 记录每次请求的序号、`X-Real-IP`、HTTP 状态码、`error.code`；**不记录 token/cookie/密钥** |

### 场景 B：不同客户端 IP 的桶相互独立

| 项 | 内容 |
|---|---|
| 测试 ID | E2E-B |
| 前置条件 | E2E-A 已完成（客户端 A 桶已耗尽：5 用满） |
| 步骤 B1 | 客户端 B（`X-Real-IP: 198.51.100.20`）发起 1 次注册（新 deviceId） |
| 预期 B1 | `200`（B 不因 A 达限被拒） |
| 步骤 B2 | 客户端 A 再发 1 次注册 |
| 预期 B2 | `429` + `RATE_LIMITED`（A 仍受限） |
| 步骤 B3 | 客户端 B 连续再发 4 次（累计 5 次） |
| 预期 B3 | 5 次全部 `200`；第 6 次（B6）`429` |
| 失败判定 | B1 被 429（桶未隔离）；B2 变 200（A 桶被错误重置/共享）；B 的计数与 A 混算 |
| 证据记录 | 每次请求的客户端 IP、状态码、错误码、时间戳；harness 汇总表 |

### 场景 C：测试请求目标校验

| 项 | 内容 |
|---|---|
| 测试 ID | E2E-C |
| 校验内容 | ① 每个请求的 URL 主机/端口必须等于 harness 返回值；② 全程记录请求总数、客户端 IP、状态码、错误码；③ 断言无任何请求发往 8787 或生产域名；④ 日志不得包含 Token/Cookie/密钥 |
| 失败判定 | 出现非 harness 目标即 FAIL 并立即终止（exit 8） |
| 证据记录 | harness 维护「请求目标白名单」集合，运行结束时打印集合内容与请求计数 |

**分层声明**：单测（第 9 章）只验证 IP 解析/规范化/限流键逻辑；端到端（本章）验证真实隔离服务行为。**不得以单测通过代替端到端验证**，反之亦然。

---

## 11. 纯单测依赖与副作用审查方案（P1-1）

### 11.1 文件清单与入口

| 文件 | 入口命令 | 直接依赖 |
|---|---|---|
| `test/unit/client-ip.test.mjs` | `node --test test/unit` | `node:test`、`node:assert`、`../lib/client-ip.js` |
| `test/unit/rate-limit.test.mjs` | 同上 | `node:test`、`node:assert`、`../middleware/rate-limit.js` |

### 11.2 间接依赖链（人工审查，逐文件记录）

| 文件 | 导入 | 是否含网络/子进程/生产路径 |
|---|---|---|
| `lib/client-ip.js`（待建） | `node:net`（仅 isIP 交叉校验） | 无网络连接、无子进程、无文件 IO |
| `middleware/rate-limit.js`（已存在） | `../lib/http.js`（httpError）、`../config.js` | `lib/http.js` 仅构造响应/错误；`config.js` 读 `node:path` 与 `process.env`，**无文件读取、无网络** |
| `config.js`（已存在，改造后） | `node:path`、`process.env` | 同上 |
| `test/e2e.mjs` | `node:fs`、`node:crypto`、`fetch` | **不在单测范围**，仅由 harness 在隔离环境调用 |

**审查记录（实际审查文件）**：`middleware/rate-limit.js`（全文 47 行）、`lib/http.js`（全文 53 行）、`config.js`（全文 44 行）、`db/database.js`（全文 41 行，确认单测不导入它）、`auth/token.js`（全文 69 行，确认单测不导入它）。结论：上述两处单测的传递依赖中**不存在**网络模块导入、`fetch`、子进程启动、HTTP 服务启动、生产路径访问或生产密钥读取。

### 11.3 静态搜索的定位（辅助证据，非证明）

保留关键词搜索（`fetch(`、`http.request`、`require('child_process')`、`spawn`、`/www/`、`secret.key`、`admin-token.key`）作为**辅助**证据，并在报告中明确：**「未搜索到关键词」不等于「绝对无网络」**；结论以 11.2 的依赖链人工审查为准。

### 11.4 元检查命令（计划，未执行）

```
node -e "const fs=require('fs');const files=fs.readdirSync('test/unit');const t=files.map(f=>fs.readFileSync('test/unit/'+f,'utf8')).join('\n');const bad=/(^|[^a-zA-Z])fetch\s*\(|http\.request|require\(['\"]child_process['\"]\)|spawn\s*\(|\/www\/|secret\.key|admin-token\.key/.test(t);console.log(bad?'META_FAIL':'META_OK');process.exit(bad?1:0)"
```
预期：输出 `META_OK`，退出码 0。**本轮未执行，仅为计划。**

---

## 12. systemd 生产配置只读核查清单（P1-2，本轮已完成）

| 核查项 | 方法 | 结果 |
|---|---|---|
| unit 文件内容 | `systemctl cat mcu-forum-api.service` | 与仓库副本一致（此前 SHA-256 已比对相同）；仅 `Environment=NODE_ENV=production` |
| 是否存在 `EnvironmentFile` | `systemctl show -p EnvironmentFiles` | **不存在** |
| 是否存在 drop-in | `systemctl show -p DropInPaths` + `ls /etc/systemd/system/mcu-forum-api.service.d` | **不存在** |
| 系统级 `DefaultEnvironment` | `grep ^DefaultEnvironment /etc/systemd/system.conf` | **无** |
| 进程实际环境变量**名** | `strings /proc/2144097/environ \| cut -d= -f1` | 仅 8 个：`HOME`、`INVOCATION_ID`、`JOURNAL_STREAM`、`LANG`、`LOGNAME`、`NODE_ENV`、`PATH`、`USER` |
| 是否存在覆盖关键路径的变量 | 对上表按 `forum/data_dir/port/secret/token/db_/dashscope` 过滤 | **无任何命中** |
| `/etc/mcu-atlas/` 下的 env 文件 | `ls -la /etc/mcu-atlas` | 存在 `dashscope.env`（root 600），属资讯流水线密钥，**未被 forum unit 引用**（无 EnvironmentFile、unit 内容与仓库副本一致） |

**结论：生产服务不存在覆盖 `HOST/PORT/DATA_DIR/DB_PATH/SECRET_PATH/ADMIN_TOKEN_PATH` 的环境变量；`config.js` 常量默认值即生产实际值。第 6 章设计与生产实际一致，不构成 P0 阻塞。**

安全说明：本轮仅读取变量**名**与 unit 文件结构；唯一打印的变量值为 8 个标准 systemd 变量的首 40 字符（`HOME=/home/forumapi`、`NODE_ENV=production`、`PATH=…` 等），均非秘密；未读取 `dashscope.env` 内容、未读取任何密钥/Token。

> 运维约束（写入文档）：今后若为该 unit 增加 `Environment=`/`EnvironmentFile=`，必须重新执行本清单并更新第 6.1 优先级表。

---

## 13. L1 / L2 / L3 分层验收标准（互不替代）

| 层 | 环境 | 内容 | 通过标准 | 状态 |
|---|---|---|---|---|
| L1 纯单测 | 本机，无服务、无网络、无子进程 | 第 9 章 N-01~N-38、X-01~X-05、T-01~T-07、C-01~C-13；第 11.4 元检查 | `node --test test/unit` 退出码 0；元检查 `META_OK` 退出码 0 | 计划，未执行 |
| L2 隔离 e2e | 临时目录 + 随机端口 | 第 8 章 GN-01~GN-14；第 10 章 E2E-A/B/C；TC-E1~E13（V1.1 既有） | `node test/harness.mjs` 退出码 0；`KNOWN_FAILURES` 之外全绿；摘要含退出码/计数/监听地址/数据目录 | 计划，未执行 |
| L3 生产入口验证 | 生产公网入口，只读 GET | N-1/N-2/N-3 探针（伪造头经 nginx 后日志显示真实出口 IP） | 全部符合第 6.2（V1.1）预期 | **需另行授权，本轮不执行** |

---

## 14. 日志与隐私要求

| 项 | 要求 |
|---|---|
| 新增字段 | `accessLog` 增加 `ip=<客户端IP 或 '-'>`（A-4 最小化） |
| 禁止记录 | Token、Cookie、`Authorization` 头、密钥内容、请求体中的 `deviceId`/`nickname` 等个人数据 |
| 已有字段 | `method/url/status/耗时/uid前8位` 保持 |
| 测试日志 | harness 可记录请求计数、客户端 IP、状态码、错误码、监听地址、数据目录**路径**；**不得**记录 Token/Cookie/密钥 |
| 502/500 堆栈 | 现有行为不变（500 打印堆栈到 journald，属本地日志，不在本次范围） |

---

## 15. 分阶段实施顺序

| 阶段 | 内容 | 出口条件 |
|---|---|---|
| P0 | 按第 5 章实现 `lib/client-ip.js`；按第 6 章改 `config.js`；按 5.5 + S-2/S-3 改 `server.js` | 代码与规范逐条对应；`node -c` 级语法通过 |
| P1 | 按第 9 章写单测；按第 11.2 完成依赖审查；按第 11.4 跑元检查 | L1 全绿 |
| P2 | 按第 7/8 章实现 `test/harness.mjs` 与 e2e 护栏；按第 10 章补注册限流端到端用例 | L2 全绿（GN-01~GN-14、E2E-A/B/C） |
| P3 | 备份 + 白名单上传 + 重启 + 第 13 章 L3（需授权） | L3 符合预期 |
| P4 | 观察 24–48h | 无第 16 章触发条件 |
| 方案 B | 独立阶段，前端 `forum.js` 公开 GET 解耦 | 独立 L1/L2 + UI 回归，**不与 A 同批** |

---

## 16. 失败处理与回滚方案

### 16.1 回滚触发条件（任一）

`systemctl is-active` 非 `active`；`/api/topics` 5xx 上升或新增 `[500]`；L3 探针出现伪造 IP 被采信；注册 429 异常激增；`ip=` 字段缺失/格式错误；任意非预期文件哈希变化。

### 16.2 回滚步骤（逐文件，禁整目录覆盖）

1. `systemctl stop mcu-forum-api`（提前知会）。
2. 从发布前备份**逐文件**恢复 `server.js`、`config.js`。
3. **删除**本次新增文件：`lib/client-ip.js`（**禁止** `cp -a backup/lib` 整目录覆盖）。
4. 校验：`sha256sum server.js config.js` 回到 `043509ba…` / `86586a22…`；`ls lib/` 与备份清单一致。
5. `systemctl start mcu-forum-api` → 复检 `is-active`、`ss -lntp | grep 8787`、`journalctl -n 20`。
6. 记录回滚时间、原因、恢复后哈希。

### 16.3 配置与数据兼容性

- 配置回滚 = 恢复 `config.js` 常量默认值；**无数据迁移**（schema 未改，DB 不变）。
- `TRUST_PROXY` 从 `true` 回退为「无该配置项」时，行为回到「仅用 peer」，即修复前状态（限流退化但不影响数据）。
- 服务重启要求：回滚必须重启才生效；重启即 `Restart=always` 覆盖。
- **绝不触碰** `data/`、`forum.db`、`secret.key`、`admin-token.key`。

### 16.4 防覆盖他人在途改动

白名单文件操作；禁 `rsync --delete`、禁整目录覆盖、禁 `git` 类操作；发布前后各跑一次全目录 `sha256sum`，白名单之外任何哈希变化先查清再继续。

---

## 17. P0 / P1 风险与阻塞项

| 编号 | 项 | 等级 | 状态 |
|---|---|---|---|
| B-01 | IPv4-mapped IPv6 规范化与白名单匹配规则完整性 | P0 | **已在第 5 章形成可审查规范 + 第 9 章 N-08~N-12、T-02/T-03 可验证断言** |
| B-02 | 隔离护栏须证明生产地址/密钥/数据路径被阻断 | P0 | **已在第 7.3 时序 + 第 8 章 GN-01~GN-14 形成可执行判定** |
| B-03 | 测试失败时须能控制子进程与临时数据副作用 | P0 | **已在第 7.4 退出码矩阵 + GN-11~GN-14 覆盖** |
| B-04 | 注册限流端到端须验证同 IP 限流与不同 IP 独立桶 | P0 | **已在第 10 章 E2E-A/E2E-B 覆盖** |
| B-05 | 请求目标不得回退到生产固定端口 8787 | P0 | **第 7.2 端口发现 + 7.3 阶段 1.4 + GN-01/GN-11 覆盖** |
| B-06 | systemd 环境变量可能改变生产关键路径 | P0 | **第 12 章已只读核查：无覆盖变量 → 不阻塞**；已加「未来新增 env 须复审」约束 |
| B-07 | 关键安全事实不得被假定为已验证 | P0 | **第 19 章列明未核实项**；第 12 章核查仅取变量名，值未打印 |
| B-08 | `clientIp` 依赖自研 IPv6 解析器，存在实现缺陷风险 | P1 | 以 N-01~N-38 精确断言 + C7 自守卫（`net.isIP` 交叉校验）缓解；L1 未跑前不得声称正确 |
| B-09 | 单测依赖链人工审查可能遗漏 | P1 | 第 11.2 逐文件记录 + 11.4 元检查辅助；明示「未搜到 ≠ 绝对无网络」 |
| B-10 | GN-13/GN-14 依赖 OS 行为（信号/删除失败） | P1 | 设计为显式报告 + 退出码 13/14，需人工确认；不作为静默通过 |
| B-11 | 前端静态资源 7 天缓存影响方案 B 生效 | P1 | 属方案 B，独立立项 |

---

## 18. 实施前置条件与授权边界

**进入代码实施前必须满足**：
1. 本 V1.2 获 ChatGPT 独立审查通过；
2. 第 5/6/7 章规格被完整实现（不允许部分实现后「边做边改」）；
3. L1（第 9/11 章）与 L2（第 8/10 章）在实际执行中全绿，并留存退出码与摘要；
4. 发布前备份 + 全目录 SHA 清单 + systemd 快照已落盘；
5. L3 生产入口探针取得**单独授权**后方可执行。

**授权边界（本轮及实施前持续有效）**：不修改业务代码/配置（除获批的实施阶段）；不创建 `lib/client-ip.js`、`test/harness.mjs`（实施阶段才建）；不运行 `test/e2e.mjs`；不连生产数据库；不读取/复制/输出生产密钥、Token、Cookie；不发生产写请求；不重启/重载服务；不改 Nginx/systemd/环境变量/生产文件；不部署/发布/回滚；不做公网探针；**不得把「计划测试」「静态推演」写成「测试通过」**。

---

## 19. 尚未核实的事实清单

| 编号 | 事实 | 状态 | 影响 |
|---|---|---|---|
| U-A | Node 24 `net.BlockList` 对 `::ffff:127.0.0.1` 与 `127.0.0.1` 的相等语义 | **未核实**，且设计**不依赖** | 无（改用自研规范化） |
| U-B | `test/e2e.mjs` 改造后在隔离实例的实际运行结果 | **未执行** | L2 通过前不得上线 |
| U-C | `lib/client-ip.js` 实际实现是否满足 N-01~N-38 | **未实现** | B-08 未闭合 |
| U-D | harness 在实际 OS 上对 GN-06/GN-07/GN-08 的判定结果 | **未执行** | B-02/B-10 未闭合 |
| U-E | 生产 Nginx 在真实公网请求下 `$remote_addr` 取值（L3 探针） | **未执行（需授权）** | S-01 修复效果未经链路验证 |
| U-F | 修复上线后注册 429 的实际变化 | **未发生** | 需观察期 |
| U-G | `/etc/mcu-atlas/dashscope.env` 内容 | **未读取（禁止）** | 与论坛无关（unit 未引用） |
| U-H | 本机 PowerShell→ssh 命令中 `tr \0 \n` 管道输出异常的原因 | **未核实** | 已改用 `strings` 复核并得到一致结果；不影响结论，但提示后续远端命令需交叉验证 |

---

## 20. 最终准入结论

# **有条件批准**

**理由**：V1.1 的 5 项问题（P0-1/P0-2/P0-3/P1-1/P1-2）在 V1.2 中均已形成**可审查、可验证**的设计（第 5 章规范 + 第 9 章 63 项精确断言、第 7.3 时序 + 第 8 章 14 项负向测试、第 10 章端到端矩阵、第 11 章依赖链审查、第 12 章生产环境只读核查结论为「无覆盖变量」）。设计层面无未闭合的 P0 阻塞。

**但**：所有安全结论目前仍是**设计层面的正确性论证**，尚未经过任何一次真实执行。因此不批准「直接进入生产发布」，仅批准「进入代码实施」，且以如下条件为前提：

| 条件 | 要求 |
|---|---|
| C-1 | 严格按第 5、6、7 章规格实现，不得偏离；偏离须回到本流程重新审查 |
| C-2 | L1 全绿（第 9 章 + 元检查），留存退出码与逐用例结果 |
| C-3 | L2 全绿（第 8 章 GN-01~GN-14 + 第 10 章 E2E-A/B/C），留存退出码、监听地址、数据目录 |
| C-4 | `KNOWN_FAILURES` 清单按实际未修项填写；禁止删除/跳过断言 |
| C-5 | 发布前完成备份、全目录 SHA 清单、systemd 快照 |
| C-6 | L3 生产入口验证取得单独授权后方可执行；未执行 L3 不得宣称 S-01 已消除 |
| C-7 | 方案 B 独立立项、独立上线，不与 A 同批 |
| C-8 | 第 19 章未核实项在相应阶段闭合前，不得在报告中表述为已验证 |

---

# 附录：《V1.1 → V1.2 修订对照表》

| 编号 | V1.1 原问题 | V1.2 修订内容 | 对应章节/测试 ID | 是否闭环 | 遗留风险 |
|---|---|---|---|---|---|
| C-01 | IPv4-mapped 用简单正则，不覆盖大小写/十六进制等价形式 | 给出完整 `canonicalizeIp` 规范（C1~C7），按 hextet 判定 mapped 后**重新生成**点分文本；明示 Node stdlib 不提供规范化、不依赖 BlockList 语义 | §5.2、§5.1 | 是（设计层） | 自研解析器实现缺陷风险 → B-08，由 N-01~N-38 + C7 自守卫缓解 |
| C-02 | 白名单与客户端地址可能因文本表示不同而绕过 | 两侧均过同一 `canonicalizeIp`，在规范文本空间比较 | §5.4、T-01~T-07 | 是（设计层） | 白名单配置书写错（如误写主机名）→ 实施时加启动日志打印规范化后的白名单（不打印密钥） |
| C-03 | 未区分 socket 地址 / 头部文本 / 带端口形式 | §5.3 三来源分表；端口、方括号、zone、前缀一律判负，不剥离 | §5.3、N-13~N-16 | 是 | 若上游代理改为下发带端口形式，将全部回退 peer → 已列为运维约束（§4） |
| C-04 | 护栏仅判 URL 字符串包含性 | 7.3 六阶段时序：协议/主机名（URL.hostname + isIP 精确比较）/端口/userinfo/生产字面量/路径规范化/符号链接 realpath/Windows 路径 | §7.3、GN-01~GN-08 | 是（设计层） | GN-13/GN-14 依赖 OS 行为 → B-10 |
| C-05 | 未定义失败与清理机制 | 7.4 十四种异常场景 + 退出码 2~14；统一 `cleanup()`；无法清理时显式报告 | §7.4、GN-11~GN-14 | 是（设计层） | 真实 OS 上的 kill/rm 边界需 L2 实测 |
| C-06 | 无注册限流端到端验证 | 第 10 章 E2E-A/B/C：同 IP 第 6 次 429、不同 IP 桶独立、目标校验与隐私记录 | §10 | 是（设计层） | 未执行 → U-B |
| C-07 | 用 grep 证明「单测无网络」 | 11.2 逐文件依赖链人工审查（记录实际审查文件）+ 11.4 元检查仅作辅助；明示「未搜到 ≠ 绝对无网络」 | §11 | 是 | 人工审查可能遗漏 → B-09 |
| C-08 | TC-A13 断言模糊 | 拆为 N-13~N-25 共 13 项精确断言（输入/预期 `null`/理由逐条列出） | §9.1 | 是 | 无 |
| C-09 | 未核实生产 systemd 环境 | 第 12 章只读核查（unit 无 EnvironmentFile/drop-in；进程环境仅 8 个标准变量；无 FORUM_*/DATA_DIR/PORT/SECRET 类变量） | §12 | **是（已核实）** | 未来新增 env 须复审（§6.3、§12 运维约束） |
| C-10 | V1.1 R-05：只覆盖 DATA_DIR 不搬 DB/密钥 | §6.2 明确四路径由 DATA_DIR 派生 + 等价性证明 | §6.2 | 是 | 无 |
| C-11 | V1.1 R-04：`\|\|` 吞掉 PORT=0 | §6.2 明确 `!== undefined` 判断 + GN-01 端口护栏 | §6.2、§7.3-1.4 | 是 | 无 |
| C-12 | V1.1 R-02：直连探针当 nginx 覆盖证明 | L3 与 T-直连分离；L3 用公网入口 + 可控伪造头验证（需授权，本轮不执行） | §13、§20-C6 | 是（设计层） | 未执行 → U-E |
| C-13 | V1.1 R-07：回滚整目录覆盖 lib | §16.2 逐文件恢复 + `rm` 新增文件；禁 `cp -a backup/lib` | §16.2 | 是 | 无 |
| C-14 | V1.1 R-09：已知失败无登记机制 | `KNOWN_FAILURES` 显式清单 + 汇总分组 + 禁止删断言/静默跳过 | §15-P4、§20-C4 | 是 | 清单需实施时按实际填写 → U-B |
| C-15 | V1.1 R-03：PORT=0 端口不可观测 | S-3 打印 `server.address().port`；harness 仅从该行解析，禁止猜测 | §7.2 | 是 | 依赖 S-3 已实施 |
| C-16 | V1.1 R-12：XFF 最右可信性边界未说明 | §4 可信边界声明 + 运维约束（新增代理须加白名单并覆盖 X-Real-IP） | §4 | 是 | 架构变更须复审 |
| C-17 | 「设计完成 ≠ 风险消除」 | §20 明确三选一结论 + C-1~C-8 条件；§19 未核实清单 | §20、§19 | 是 | 无 |

---

## 本轮只读核查记录与证据边界

| 项 | 记录 |
|---|---|
| 读取的文件（本机） | `server.js`、`config.js`、`db/database.js`、`middleware/rate-limit.js`、`lib/http.js`、`auth/token.js`、`test/e2e.mjs`（此前轮次已全量阅读，本轮复核关键行） |
| 线上只读命令 | `systemctl cat`、`systemctl show -p …`、`strings /proc/<pid>/environ \| cut -d= -f1`、`ls /etc/systemd/system/…`、`grep ^DefaultEnvironment /etc/systemd/system.conf`、`ls /etc/mcu-atlas` |
| 未做 | 未修改任何代码/配置/生产文件；未创建 `lib/client-ip.js`、`test/harness.mjs`；未运行 `test/e2e.mjs` 或任何测试；未连接生产数据库；未读取/复制/输出任何密钥、Token、Cookie（唯一打印的变量值为 8 个标准 systemd 变量的首 40 字符，均非秘密）；未发送生产写请求；未重启/重载/部署；未做公网探针 |
| 证据边界 | 第 12 章结论基于本轮只读核查；其余章节为设计论证，**不代表已验证**；第 19 章清单外的内容均已在本轮或此前轮次取得直接证据 |

---

**交付后停止。本文件不构成实施授权；只有在收到 ChatGPT 明确批准后，才能按第 18 章授权边界进入代码实施阶段。**
