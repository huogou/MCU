# MCU Atlas 论坛 API 全仓库只读审计报告 V1.0

**审计对象：** `漫威电影宇宙导航/workspace/forum-api/`（18 个文件，全量）
**审计方式：** 静态只读、零安装、未启动服务、未连接数据库、未运行测试、未访问服务器
**审计日期：** 2026-10-23
**执行方：** CodeBuddy　**验收方：** ChatGPT（独立验收）
**依据：**《Ponytail 兼容性核查与代码审计准备报告 V1.0》第五节试点结论

**本轮明确未做：** 未修改/删除/格式化/暂存/提交任何代码；未安装依赖；未运行 `test/e2e.mjs`；未启动 8787 端口；未读取 `secret.key` / `admin-token.key` / `forum.db`；未连接 `8.137.48.145`。

---

## 0. 审计前保护与基线

### 0.1 路径确认

- 仓库根目录：`D:\SEO\发挥余热\漫威电影宇宙导航`（`git rev-parse --show-toplevel` 级别确认，含 `.git`）
- 目标目录：`D:\SEO\发挥余热\漫威电影宇宙导航\workspace\forum-api`（存在，18 个文件）
- 文件名与《准备报告》记录一致，**无差异**；额外发现 `middleware/rate-limit.js`、`db/schema.sql`、`deploy/*` 三处未在准备报告中逐项列出（准备报告按目录列举，未遗漏文件）

### 0.2 Git 基线

| 项 | 值 |
|---|---|
| HEAD | `fc5531f006ccc1849206232b10a0cd6bdbc76889` |
| 远程 | `origin https://github.com/huogou/MCU.git` |
| 目标目录最后一次提交 | `c765ef3` / 2026-09-15 16:07:25 / `feat(h5): V3.0 论坛 4 核心页…forum-api 详情返回 content` |
| 目标目录未提交改动 | **0 项**（`git status --porcelain -- workspace/forum-api` 为空） |
| 目标目录未跟踪文件 | **0 项** |

**结论：目标代码处于干净提交状态，不存在「已提交版本 / 未提交改动」的审计边界分裂。** 仓库整体有 27 项未提交改动，但均不落在 `forum-api/`（属 `h5/data/news.js`、`docs/`、`.codebuddy/`），故不影响本次结论。未做任何清理、暂存或还原。

### 0.3 文件 SHA-256（前 16 位，用于复验）

| 文件 | 大小 | SHA-256(16) |
|---|---|---|
| `server.js` | 4161 | `043509BAE715F434` |
| `config.js` | 1878 | `86586A2237C7417C` |
| `lib/http.js` | 1373 | `F2516ADA813E4C7B` |
| `db/database.js` | 1185 | `811FDB5DE6EEBDE6` |
| `db/schema.sql` | 2858 | `3B97D60306EF59EC` |
| `auth/token.js` | 2636 | `192C5EB84038D6EB` |
| `middleware/auth.js` | 1096 | `187C5CB91C9C6380` |
| `middleware/rate-limit.js` | 1559 | `20316C879EE66911` |
| `routes/users.js` | 3239 | `2E38927168CEEEC3` |
| `routes/topics.js` | 6701 | `11F633870F012FA1` |
| `routes/replies.js` | 4921 | `1CD27417A5FCB1FC` |
| `routes/likes.js` | 3441 | `69E3B00BBE798920` |
| `routes/reports.js` | 2357 | `08E875C1DD88E8EA` |
| `routes/admin.js` | 4682 | `00E1D0ABEEC26296` |
| `admin/index.html` | 6421 | `301B921B46535C07` |
| `deploy/mcu-forum-api.service` | 393 | `E15B669D77AE1F89` |
| `deploy/backup-forum.sh` | 492 | `5468A8BE4DB32419` |
| `test/e2e.mjs` | 13416 | `ED41CCA60C2D131E` |

### 0.4 敏感数据

`forum-api/data/` **不存在**（本地未初始化），因此本轮未接触任何密钥或数据库文件。服务器侧路径仅在 `test/e2e.mjs:12-13` 以硬编码字符串出现，未读取、未输出其内容。

---

## 1. 项目结构与调用链地图

### 1.1 模块结构

```
forum-api/
├── server.js            HTTP 入口：路由表、body 读取、身份解析、统一错误、访问日志、启动/关闭
├── config.js            全局常量（HOST/PORT/DB/密钥路径/TTL/限流阈值/业务上限）
├── lib/http.js          json() / readBody() / parseBearer() / httpError() / charLen() / charSlice()
├── auth/token.js        密钥文件自动生成、用户 token 签发/校验、admin token 读写与恒时比较
├── middleware/
│   ├── auth.js          resolveUser() / requireUser() / maybeRenew()
│   └── rate-limit.js    进程内固定窗口计数器 + 6 个语义化限流器
├── db/
│   ├── database.js      node:sqlite DatabaseSync 单例、PRAGMA、schema 幂等执行、getRow/all/run
│   └── schema.sql       5 张表 + 6 个索引
├── routes/
│   ├── users.js         POST /api/me/register、GET /api/me、POST /api/me/profile
│   ├── topics.js        GET /api/topics、GET /api/topics/:id、POST /api/topics、GET /api/me/topics
│   ├── replies.js       GET/POST /api/topics/:id/replies、GET /api/me/replies
│   ├── likes.js         POST/DELETE /api/topics/:id/like、/api/replies/:id/like
│   ├── reports.js       POST /api/topics/:id/report、/api/replies/:id/report
│   └── admin.js         GET /api/admin/{topics,replies}、POST /api/admin/{topics,replies}/:id/{action}
├── admin/index.html     单文件审核台（纯 JS，sessionStorage 存 admin token）
├── deploy/              systemd unit（User=forumapi, MemoryMax=150M）+ sqlite3 .backup 脚本
└── test/e2e.mjs         单文件 e2e（127.0.0.1:8787，读服务器密钥绝对路径）
```

### 1.2 请求调用链（实际代码路径）

```
TCP → http.createServer
  → new URL(req.url) → pathName 去尾斜杠
  → [OPTIONS] 立即 204（无 CORS 头）
  → [GET /api/admin] 读文件返回 admin/index.html（无鉴权）
  → [POST/PUT/PATCH/DELETE] readBody(64KB) → JSON.parse → body
  → resolveUser(req)：Bearer → verifyToken(HMAC) → {uid, exp} | null（不抛错）
  → 构造 ctx {req,res,user,body,query,params,ip}
  → 线性匹配 routeTable（method 精确 + RegExp.exec）
  → handler(ctx)
       ├─ 写操作：requireUser → rate.*ByUid → 资料完整性 → 入参校验 → db.run → 201
       ├─ 管理：requireAdmin(parseBearer → isAdminToken 恒时比较) → transition(读状态→校验→UPDATE→改计数)
       └─ 读操作：maybeRenew → db.all/getRow（含 JOIN forum_users 取昵称头像）→ topicOut/replyOut
  → accessLog（method/url/status/耗时/uid 前 8 位）
```

**关键数据流：** `token.uid` → `author_id`（服务端权威，拒绝客户端提交）→ 内容行；`forum_likes` 用 `{uid}:{type}:{targetId}` 复合主键保证点赞唯一，计数落在 `forum_topics/replies.like_count`；`reply_count` 由审核动作维护（非触发器）。

### 1.3 数据库形态

5 张表：`forum_users`(device_id UNIQUE、无密码字段)、`forum_topics`(status 五态、like_count/reply_count 冗余计数)、`forum_replies`(一层、status 五态)、`forum_likes`(UNIQUE 三列)、`forum_reports`(UNIQUE reporter+target)。
**无外键、无触发器、无迁移版本表**；WAL + `busy_timeout=5000` + `synchronous=NORMAL`（`db/database.js:17-19`）。

---

## 2. 身份认证与授权模型

### 2.1 两套完全隔离的凭据

| 维度 | 用户 token | 管理 token |
|---|---|---|
| 形态 | `base64url(payload).base64url(HMAC)`，payload `{uid,iat,exp}` | 32 字符随机串（`randomBytes(24).base64url`） |
| 密钥 | `data/secret.key`（32B 随机，0600） | `data/admin-token.key`（0600） |
| 有效期 | 180 天，剩余 <30 天时续签 | 永久（换文件即轮换） |
| 比较 | `timingSafeEqual`（`auth/token.js:45`） | `timingSafeEqual`（`auth/token.js:66`） |
| 传输 | `Authorization: Bearer` | `Authorization: Bearer` |
| 撤销 | **无** | 删除/替换密钥文件 |

### 2.2 授权判定点

| 能力 | 判定依据 | 位置 |
|---|---|---|
| 匿名可读 | 公开列表/详情/回复列表不 requireUser | `topics.js:59,93`、`replies.js:39` |
| 写操作 | `requireUser` | `users.js:52`、`topics.js:109`、`replies.js:63`、`likes.js:60`、`reports.js:46` |
| 内容归属 | `author_id` 恒取 `token.uid`，客户端传入即 400 | `topics.js:113-116`、`replies.js:68-70` |
| 未过审内容可见性 | 仅作者可见自己的 pending/rejected/hidden；他人 404 | `topics.js:18-24` |
| 管理操作 | 独立 admin token | `admin.js:31-36` |
| 状态机 | `TRANSITIONS` 白名单 | `admin.js:22-28` |

### 2.3 模型评价

**设计上是「匿名设备身份 + 先审后发 + 服务端权威 author_id + 独立管理凭据」，边界划分清晰，未发现可绕过鉴权或越权读写他人数据的路径。**（详见 P0 结论）

但存在一个结构性事实：**身份的真实性完全等价于「知道 deviceId」**——因为 `register` 对已存在的 deviceId 无条件重新签发 token（`users.js:27-38`）。这不是实现 bug，而是设计选择，但它使 deviceId 事实上成为永久凭据（见 S-02）。

---

## 3. 安全问题清单（按风险排序）

> 说明：**未发现** 鉴权绕过、SQL 注入（可利用）、IDOR 越权读写、命令注入、路径穿越、模板注入、CSRF（无 Cookie 鉴权）、管理端权限绕过。以下问题按可利用性与影响排序。

### S-01 【高危】【已验证·机制】反代后客户端 IP 恒为 `127.0.0.1`，注册限流退化为全站共享 5 次/小时

**位置**
- `server.js:69` —— `ip: (req.socket.remoteAddress || 'unknown').replace(/^::ffff:/, '')`
- `routes/users.js:21` —— `rate.registerByIp(ctx.ip || 'unknown')`
- `middleware/rate-limit.js:41` —— `registerByIp: (ip) => limit('reg:' + ip, 5, HOUR)`
- `config.js:24` —— `REGISTER_PER_HOUR_PER_IP: 5`
- 部署事实：`deploy/mcu.yaokaixin.top.conf:83-89`、`deploy/mcuatlas.xyz.conf:75-82` 均为 `location ^~ /api/ { proxy_pass http://127.0.0.1:8787; proxy_set_header X-Real-IP $remote_addr; ... }`

**代码证据**
```js
ip: (req.socket.remoteAddress || 'unknown').replace(/^::ffff:/, ''),
```
```js
rate.registerByIp(ctx.ip || 'unknown');
```

**触发条件**
经 Nginx 反代部署（仓库内两份站点配置均为该形态）后，所有公网请求的 `socket.remoteAddress` 都是 `127.0.0.1`；`X-Real-IP` / `X-Forwarded-For` 已由 Nginx 下发，但代码从不读取。于是全站只有一个限流桶 `reg:127.0.0.1`。

**影响范围（放大链）**
1. 任意 1 小时窗口内第 6 个「新设备」注册 → `429 RATE_LIMITED`
2. 客户端 `ensureToken()` 在**所有** API 调用前执行注册（`h5/assets/js/forum.js:59-62`），公开列表也不例外（`forum.js:287`、`345`、`597`）
3. 注册失败 → `register_failed` → 页面数据请求整体 reject → **新访客不仅不能发帖，连公开内容都加载不出**
4. 已持有效 token 的老用户不受影响（`ensureToken` 提前返回）

**是否越权/泄露/损坏**：不构成越权或数据泄露；构成**生产可用性故障**，并使「按 IP 防刷」的安全意图完全失效（无法区分来源，也无法对单 IP 施加独立限制）。

**为什么现有实现防不住**：限流 key 取自传输层地址，而部署形态（回环反代）使该地址对所有外部请求恒等；`X-Real-IP` 虽已传递但未被消费，且无「是否信任代理」的开关。

**最小修复方向**
1. 在 `server.js` 提取 `ctx.ip` 时改为：`TRUST_PROXY=true` 时优先取 `x-real-ip`，否则回退 `x-forwarded-for` 首个地址，再回退 socket 地址；
2. 在 `config.js` 增加 `TRUST_PROXY`（默认 false，与 `HOST=127.0.0.1` 绑定的部署显式开启），避免被伪造成本；
3. 若短期不改代码，可临时放大 `REGISTER_PER_HOUR_PER_IP`（治标，且会让限流失效）；
4. 建议同时评估：公开读接口不应强制注册（客户端侧改动，属另一项目范围）。

**推荐验证方式**
- 单元测试：`pickClientIp({headers:{'x-real-ip':'1.2.3.4'}, socket:{remoteAddress:'127.0.0.1'}})` → `1.2.3.4`；`TRUST_PROXY=false` 时 → `127.0.0.1`
- 隔离 e2e：起临时实例，连续 6 次 `POST /api/me/register`，每次携带**不同** `X-Real-IP`，断言 6 次均 200；同一 `X-Real-IP` 第 6 次为 429

**线上生效性**：`[待验证]` —— 本轮未访问服务器，无法确认该 `location ^~ /api/` 是否已实际启用。**若线上尚未接入反代（服务仅本机回环、H5 通过其他方式访问），则本项降级为中危，但修复仍必要**。

---

### S-02 【中危】【已验证】`deviceId` 实为永久身份凭据：可无条件换取 token，且由非加密随机数生成

**位置**
- `routes/users.js:27-38` —— 存在同 deviceId 即复用 uid 并签发新 token
- `h5/assets/js/forum.js:23-34` —— `Math.random()` 生成，`localStorage` 明文存储
- `h5/assets/js/forum.js:79-82` —— 401 后 `clearToken()` 并自动重新注册（复用同一 deviceId）

**代码证据**
```js
const existing = db.getRow('SELECT * FROM forum_users WHERE device_id = ?', deviceId);
if (existing) { uid = existing.id; }          // 无任何额外证明
...
const token = signToken(uid, Date.now());
```
```js
function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    var r = Math.random() * 16 | 0;            // 非 CSPRNG
```

**触发条件**
获得目标 `deviceId`（浏览器 XSS、共享设备、备份/同步、日志或截图外泄）→ 调 `POST /api/me/register {deviceId}` → 直接拿到该用户 180 天 token，**即使原 token 已被清除或轮换**。

**影响范围**：账号身份接管（发布内容、点赞、举报均以受害者名义）；由于 token 可无限续签且无撤销，接管是**永久性**的。个人数据泄露面有限（无邮箱/手机号），但内容归属与信誉被冒用。

**是否越权**：**是**（以他人身份行事）。**是否数据泄露**：中（可读该用户 /api/me、/api/me/topics、/api/me/replies）。**是否数据损坏**：中（可以其名义发帖，进入审核队列）。

**为什么现有实现防不住**：schema 注释明示「device_id 仅注册时弱幂等键，不参与鉴权」（`db/schema.sql:7`），但 `register` 用「知道 deviceId」作为签发 token 的唯一条件，实际把幂等键提升为认证因子；同时 `Math.random()` 不具备密码学强度，与「凭据」定位不匹配。

**最小修复方向**
1. 客户端改用 `crypto.randomUUID()`（一行）；
2. 服务端把 deviceId 语义拆开：注册时额外下发一次性 `device_secret`（随机 32B，仅存哈希），后续 re-register 必须同时提交 `deviceSecret` 且校验哈希；无 secret 时按「新设备」处理或拒绝；
3. 过渡期可先限制：同 deviceId 重复注册的 token 签发需满足「原 token 未过期或距上次注册 > N 分钟」，降低静默接管概率。

**推荐验证方式**
- 单元/集成：仅凭 deviceId 重复注册 → 期望 400/401（改造后）；带正确 deviceSecret → 200
- 手工：清除 localStorage 中的 token 但保留 deviceId，重进页面 → 应无法静默恢复同一 uid

---

### S-03 【中危】【已验证·代码】用户 token 无撤销机制，且可无限续签

**位置**
- `auth/token.js:38-54` —— 校验只验 HMAC 与 `exp`，无版本号/黑名单
- `middleware/auth.js:25-30` —— 剩余 <30 天即在**任意**请求上下发 `X-Renewed-Token`
- `server.js:72-80` —— 公开 GET 路由同样经过 `maybeRenew`

**代码证据**
```js
if (ctx.user.exp - Date.now() < config.TOKEN_RENEW_AHEAD_MS) {
  res.setHeader('X-Renewed-Token', signToken(ctx.user.uid, Date.now()));
}
```

**触发条件**：token 泄露后，攻击者保持每 30 天内至少一次请求，即可永久续期；受害者无「退出全部设备」手段，服务端也无失效入口。

**影响范围**：泄露窗口从「180 天」实质变为「无限期」。影响与 S-02 叠加。

**是否越权/泄露/损坏**：是（持续越权）；无直接数据损坏。

**为什么现有实现防不住**：payload 无 `ver`/`jti`，校验层无可撤销集合；续签条件只看时间窗，不看来源变化（UA/IP 变化无感知）。

**最小修复方向**（任一即可，改动量从小到大）
1. payload 增加 `ver`，`forum_users` 增加 `token_version`；校验时比对，改版本即全端失效（需一次 DB 变更）；
2. 增加 `POST /api/me/logout`（客户端清除 + 服务端记录 `revoked_before` 时间戳，校验 `iat > revoked_before`）；
3. 最小应急：为续签次数设上限（payload 带 `rn` 计数）。

**推荐验证方式**：单元测试 `verifyToken` 对 `ver` 不匹配返回 null；e2e：旧 token 在撤销后 → 401。

---

### S-04 【中危】【已验证】无请求体时 `POST /api/topics`、`POST /api/topics/:id/replies` 抛 TypeError → 500

**位置**
- `routes/topics.js:117` —— `typeof ctx.body.title === 'string'`
- `routes/replies.js:71` —— `typeof ctx.body.content === 'string'`

**代码证据**
```js
const title = typeof ctx.body.title === 'string' ? ctx.body.title.trim() : '';
```
（`ctx.body` 在空请求体时为 `null`：`server.js:55-62` 仅当 `raw` 非空才 `JSON.parse`）

**触发条件**
```http
POST /api/topics
Authorization: Bearer <valid>
（无 body / Content-Length: 0）
```
或 body 为 `null` 字面量。→ `TypeError: Cannot read properties of null (reading 'title')` → 500 `INTERNAL` + `console.error('[500]', ...)` 输出完整堆栈（`server.js:84`）。

**影响范围**：单请求可稳定触发；认证用户以 `TOPIC_PER_10MIN=3` 上限可每 10 分钟制造 3 条含堆栈的错误日志（回复同理 10 条），长期可污染 journald 并干扰真实故障定位。同类空体请求在 `users.js`（`ctx.body && …`）与 `reports.js`（`ctx.body &&`）中已被正确防护，说明属遗漏而非统一设计。

**是否越权/泄露/损坏**：不越权；**但 500 响应体虽被统一替换为「服务内部错误」（`server.js:89`），服务端日志含内部堆栈**，属信息暴露于本机日志（非公网）。

**为什么现有实现防不住**：解析层允许 `body=null` 透传到业务层，而业务层仅部分 handler 做了 `ctx.body &&` 短路；缺少统一「空体即 400」的前置校验。

**最小修复方向**：在 `server.js` 解析后统一 `ctx.body = body || {}`（1 行，覆盖全部路由）；或两个 handler 首行 `const b = ctx.body || {}`。

**推荐验证方式**：隔离 e2e 追加 3 条断言：无体 POST 发帖 → 400 `BAD_TITLE`；无体回复 → 400 `BAD_CONTENT`；断言响应非 500。

---

### S-05 【低危】【已验证·不可利用】`likedIdsFor` 用字符串插值拼接 `target_type`

**位置**：`routes/topics.js:46`

**代码证据**
```js
`SELECT target_id FROM forum_likes WHERE user_id = ? AND target_type = '${type}' AND target_id IN (${ph})`
```
`${ph}` 由 `ids.map(() => '?')` 生成（安全）；`${type}` 为字符串插值。

**触发条件**：当前全部调用方传入字面量 `'topic'`（`topics.js:86,102,148`）或 `'reply'`（`replies.js:55,96`），**无用户可控输入**，不可利用。

**影响范围**：若未来上游把 `type` 参数化（例如新增 `/api/{type}/:id/like` 通用入口）即成为真实 SQLi。

**为什么现有实现防不住**：函数签名把 `type` 当作可信常量，但未在函数内做白名单断言，安全性依赖调用方纪律。

**最小修复方向**：改为 `AND target_type = ?` 并在参数位传 `type`；或函数首行 `if (type!=='topic'&&type!=='reply') throw new Error('bad type')`。

**推荐验证方式**：单元测试传 `type="topic' OR '1'='1"` → 期望抛错或返回空集，而非读出他人点赞。

---

### S-06 【低危】【已验证】管理台 HTML 无鉴权即可获取，且缺 CSP / X-Frame-Options

**位置**：`server.js:47-53`（任何 GET `/api/admin` 返回完整 HTML）；`admin/index.html` 无 CSP、页面未设置 `X-Frame-Options`

**影响范围**：管理界面结构、接口路径、状态机按钮逻辑对公网可见（信息暴露）；可被第三方站点以 iframe 嵌入实施点击劫持（`delete` 有 `confirm`，实际危害有限；`approve/reject` 单击即生效，可被诱导）。

**为什么现有实现防不住**：注释以「鉴权靠 admin token，不做前端判断」为理由省略了 HTML 侧防护，但「无数据」不等于「无风险」；未设置任何响应安全头。

**最小修复方向**：给该响应加 `X-Frame-Options: DENY`、`X-Content-Type-Options: nosniff`，并加一条最小 CSP（`default-src 'self'; script-src 'self' 'unsafe-inline'` 需内联脚本，属折中，建议后续外置 JS 后收紧）；HTML 本身可保留无鉴权（不含数据）。

**推荐验证方式**：curl 检查响应头存在；本地起静态页 iframe 嵌入验证被拒。

---

### S-07 【低危】【已验证】管理操作无审计日志

**位置**：`routes/admin.js:68-89`（`transition` 只写库，不记录 actor/IP）；`server.js:31-35`（访问日志对 admin 请求 `uid` 恒为 `-`）

**影响范围**：误操作/滥用无法追溯（谁在何时把哪条内容 approve/delete）；仅能从 `accessLog` 时间点反推，缺 IP 与请求上下文。

**为什么现有实现防不住**：日志设计以「用户 uid 前 8 位」为核心，管理端无 uid，且未记录客户端地址（`server.js:34` 不含 ip）。

**最小修复方向**：`transition` 成功后追加一行结构化日志（`[admin] action=approve kind=topics id=xxx ip=...`）；或新增 `forum_admin_log` 表（改动更大，非必需）。

**推荐验证方式**：单次 admin 操作后检查 stdout 是否含该行；日志中不含 token。

---

### S-08 【低危】【优化建议】限流在参数校验之前消耗额度；限流状态为进程内、重启清零

**位置**：`topics.js:110`（先 `rate.topicByUid` 再校验标题/正文）、`replies.js:64`、`users.js:54`、`reports.js:20`；`middleware/rate-limit.js:10`（`const buckets = new Map()`）

**影响范围**：3 次非法发帖即被锁 10 分钟（自伤型；e2e 第 221 行已隐含此行为，因为被 400 拒绝的伪造请求也占用了配额）。重启后所有配额归零；若将来改多进程/多实例，限流按进程分裂。

**为什么现有实现防不住**：限流器与业务校验无先后约定；内存 Map 天然不跨进程。

**最小修复方向**：把 `rate.*` 调用移到所有入参校验之后（顺序调整，无逻辑变化）；多实例场景另行引入共享存储（当前不需要）。

**推荐验证方式**：连续 3 次非法发帖后第 4 次合法发帖 → 期望 201（当前为 429）。

---

### S-09 【低危】【已验证】限流桶满（>10000）时每次请求遍历最多 10000 条

**位置**：`middleware/rate-limit.js:20-25`

**代码证据**
```js
if (buckets.size > 10000) {
  for (const [k, v] of buckets) { if (v.resetAt <= now) buckets.delete(k); if (buckets.size <= 8000) break; }
}
```
**影响范围**：若桶内条目均未过期（`resetAt > now`），循环无法删到 8000，退化为「每个请求 O(10000) 遍历」；因为遍历发生在每次 `hit` 内，高并发下成为 CPU 放大点。当前由于 S-01 只有 1 个桶，暂不触发；**修复 S-01 后需同步处理**。

**为什么现有实现防不住**：清理策略依赖「存在过期桶」这一假设，未对「全活跃」情况设上限（如 LRU 淘汰）。

**最小修复方向**：满额时按「最早 resetAt」淘汰（或直接 `buckets.clear()` 降级），并为单 key 保留计数不中断。

**推荐验证方式**：单元测试灌 10001 个未过期桶，断言 `hit` 后 size ≤ 8000 且耗时在毫秒级。

---

### S-10 【低危】【待验证】413 路径先 `req.destroy()` 再写响应，客户端可能收到连接重置

**位置**：`lib/http.js:19-23`（超限 → `reject` + `req.destroy()`）；`server.js:82-94`（catch 中 `json(res, 413, ...)`）

**触发条件**：`Content-Length` 或实际负载 > 64KB。

**影响范围**：客户端拿到的可能不是 `413 BODY_TOO_LARGE` 而是 socket 错误，前端 `r.json()` 失败后走通用错误分支；`res.statusCode` 在响应未发出时为空，`accessLog` 记录的状态码不可靠。

**为什么现有实现防不住**：销毁请求流的同时仍尝试在已失效连接上写响应。

**最小修复方向**：超限时先 `res.writeHead(413, {'Connection':'close'})` 并 `res.end(...)`，再 `req.destroy()`；或改为「停止累积、忽略后续 chunk、正常返回 413」。

**推荐验证方式**：隔离实例发送 65KB body，断言 HTTP 413（当前预期为连接错误）——**本轮未运行，故为待验证**。

---

### S-11 【信息】【优化建议】`OPTIONS` 返回 204 但无任何 CORS 头

**位置**：`server.js:44`

**影响**：当前 H5 与 API 同源（Nginx `/api/` 前缀），不构成问题；若将来前端独立域名，预检将失败。属设计前提记录，不建议现在改。

---

## 4. 数据一致性与业务逻辑问题清单

### D-01 【中危】【已验证】删除「已隐藏」的回复不递减 `reply_count` → 永久幽灵计数

**位置**：`routes/admin.js:22-28`（`delete` 允许 `hidden`）、`routes/admin.js:80-86`

**代码证据**
```js
delete:  ['pending', 'approved', 'rejected', 'hidden'],
...
if (action === 'delete' && row.status === 'approved') {
  db.run('UPDATE forum_topics SET reply_count = CASE WHEN reply_count > 0 THEN reply_count - 1 ELSE 0 END WHERE id = ?', row2TopicId(id));
}
```
**触发条件**：回复 `pending → approve`（`reply_count +1`）→ `hide`（注释明确「hidden 期间保留计数」）→ `delete`（条件只匹配 `approved`，不减）。

**影响范围**：`forum_topics.reply_count` 永久虚高 1；列表页「N 条回复」与实际可见回复不一致；重复操作可累积虚高。

**是否数据损坏**：是（冗余计数与真实数据脱节，且无自愈机制）。

**为什么现有实现防不住**：计数维护是「按动作枚举」的命令式写法，未覆盖「hidden→deleted」这条合法路径；也没有对账机制（如触发器或定期重算）。

**最小修复方向**：`if (action === 'delete' && (row.status === 'approved' || row.status === 'hidden'))`（1 行）；或改由 `SELECT COUNT(*) WHERE status='approved'` 重算（更稳，代价是多一次查询）。

**推荐验证方式**：隔离库执行 approve→hide→delete 序列后断言 `reply_count === 0`；或断言 `reply_count === (SELECT COUNT(*) FROM forum_replies WHERE topic_id=? AND status='approved')`（建议作为回归断言固化）。

---

### D-02 【中危】【已验证·代码】状态变更与计数更新分两条语句、无事务

**位置**：`routes/admin.js:78-87`（`UPDATE 状态` 与 `UPDATE 计数` 分离）；全局无 `BEGIN/COMMIT`（全仓检索无事务调用）

**代码证据**
```js
db.run(`UPDATE ${table} SET status = ?, updated_at = ? WHERE id = ?`, to, now, id);
if (kind === 'replies') { if (action === 'approve') { db.run('UPDATE forum_topics SET reply_count = reply_count + 1 WHERE id = ?', ...); } ... }
```
**影响范围**：进程在两条语句之间退出（OOM、`MemoryMax=150M` 触发 kill、断电）→ 回复已 approved 但计数未加（或相反），产生长期偏差；`SIGTERM` 路径（`server.js:108-112`）无 `db.close()`，但 WAL 本身的原子性只保证单语句。

**是否数据损坏**：是（一致性受损，非数据丢失）。

**为什么现有实现防不住**：`DatabaseSync` 语句级原子，业务级未包事务；且「读状态 → 判断 → 写」在同一 tick 内完成，掩盖了单进程下的并发问题，却没有解决写入中断问题。

**最小修复方向**：`transition()` 内用 `db.exec('BEGIN IMMEDIATE')` … `db.exec('COMMIT')`，异常时 `ROLLBACK`；把 `row2TopicId` 的查询并入同一事务。

**推荐验证方式**：注入式测试（在两条语句之间抛错）后重启，断言 count 与真实值一致；或直接以「计数对账断言」为回归门槛。

---

### D-03 【低危】【已验证】点赞 INSERT 与 `like_count + 1` 非原子

**位置**：`routes/likes.js:30-32`

**影响范围**：`forum_likes` 行已写入但计数未加 → 用户显示「已赞」但 `likeCount` 少 1；取消路径同理（`likes.js:50-53`，`del.changes>0` 才减，方向安全）。

**是否数据损坏**：是（轻微、可累积）。

**为什么现有实现防不住**：同 D-02，缺事务；UNIQUE 约束只保证「不重复插入」，不保证计数同步。

**最小修复方向**：两条语句包事务；或改为 `INSERT ... ON CONFLICT DO NOTHING` + 仅在 `changes>0` 时 `+1`（当前正是此语义，但语句未原子）。

**推荐验证方式**：并发（多进程模拟）或注入中断后对账 `likeCount === SELECT COUNT(*) FROM forum_likes WHERE target_type='topic' AND target_id=?`。

---

### D-04 【低危】【已验证】举报只有写入、没有消费端

**位置**：`routes/reports.js:19-42`（写入 `forum_reports`，`status` 恒 `open`）；`routes/admin.js:96-116`（管理路由仅 topics/replies，无 reports）

**影响范围**：用户举报成功（201）后无人可见、无法处理；`status` 字段永远 `open`。属功能未闭环，而非数据错误。

**为什么现有实现防不住**：注释自述「MVP 仅记录，处理流不在本期范围」，属已知范围裁剪；但对外已暴露举报入口，存在「承诺未兑现」的体验风险。

**最小修复方向**：新增 `GET /api/admin/reports?status=open`（只读列表，改动最小）；或暂时在前端隐藏举报入口。

**推荐验证方式**：admin token 请求举报列表 → 返回刚提交的记录。

---

### D-05 【低危】【已验证】`hidden` 话题下的 `approved` 回复仍可点赞/举报

**位置**：`routes/likes.js:22-26`、`routes/reports.js:24-27`（仅校验回复自身 `status`，未校验所属话题可见性）

**影响范围**：话题被隐藏后，其下回复仍可被（知道回复 id 的人）点赞、举报；回复列表本身已因话题不可见而 404，属「孤儿可达」。

**为什么现有实现防不住**：互动校验的粒度停在「目标内容状态」，未向上追溯到话题；`requireInteractableTopic` 只用于发帖/举报话题分支。

**最小修复方向**：回复分支补一次 `SELECT status FROM forum_topics WHERE id = reply.topic_id`，要求 `approved`。

**推荐验证方式**：hide 话题后对其已通过回复点赞 → 期望 403。

---

### D-06 【低危】【待验证】并发注册同 `deviceId` 命中 UNIQUE → 500

**位置**：`routes/users.js:27-37`（`INSERT` 未捕获 `SQLITE_CONSTRAINT`）

**影响范围**：两个请求同时通过 `SELECT` 未命中后插入，第二个抛约束错误 → 500。**当前部署（单进程 + 同步 SQLite + 该 handler 内无 `await`）使两个请求不可能交错，故不可触发**；一旦改为 cluster/worker 或异步驱动即成立。

**为什么现有实现防不住**：依赖运行时串行性，而非数据库层兜底（`ON CONFLICT` 或捕获后重查）。

**最小修复方向**：`INSERT ... ON CONFLICT(device_id) DO NOTHING` 后重查一次；或捕获约束错误后按「已存在」处理。

**推荐验证方式**：多进程并发 20 次同 deviceId 注册，断言全部 200 且只建 1 个用户。

---

### D-07 【低危】【已验证】`/api/me/topics`、`/api/me/replies` 固定 `LIMIT 100` 且无分页

**位置**：`routes/topics.js:146`、`routes/replies.js:94`

**影响范围**：超过 100 条的历史内容永久不可见（无截断提示）。

**最小修复方向**：加 `page/size` 参数（复用 `queryPage`），或返回 `total` 让前端提示。

**推荐验证方式**：造 101 条后断言第 101 条可通过分页取到。

---

### D-08 【优化建议】【已验证】回复楼层 `floor` 由分页偏移推算，隐藏/删除后整体位移

**位置**：`routes/replies.js:57`（`replyOut(r, liked, (page-1)*size + i + 1)`）

**影响**：翻页客户端在两次请求之间若发生审核动作，会看到重复或跳号楼层。属展示口径问题，非数据错误。

**最小修复方向**：如需稳定楼层，应存 `floor` 快照或改用游标分页；当前可接受，建议不改。

---

### D-09 【优化建议】【已验证】`SIGTERM` 未 `db.close()`

**位置**：`server.js:108-112`

**影响**：依赖下次启动时的 WAL 恢复；正常情况下无数据丢失，但缺少显式 checkpoint。

**最小修复方向**：`server.close(() => { database.get().close(); process.exit(0); })`。

---

### D-10 【优化建议】【已验证】每次启动无条件执行 `schema.sql`

**位置**：`db/database.js:20-21`

**影响**：当前仅 `CREATE ... IF NOT EXISTS`，安全；但无迁移版本表，将来改列类型/加约束需要人工介入，且无法回滚。

**最小修复方向**：加 `PRAGMA user_version` 版本号 + 顺序迁移函数（暂不必要）。

---

## 5. 测试缺口与建议的隔离测试方案

### 5.1 现有测试资产（如实登记）

| 文件 | 性质 | 能否本地隔离运行 |
|---|---|---|
| `test/e2e.mjs` | API e2e，**读服务器密钥绝对路径**（`:12-13`）、打 `127.0.0.1:8787`、**直接写生产库** | **不能**（缺 `/www/wwwroot/forum-api/data/*.key`，且会污染真实数据） |
| `workspace/forum-e2e.cjs` | H5 **UI** 断言（4 页 × 3 宽度，fetch stub 注入），非 API 测试 | 可（需本地 Chrome + 硬编码 `H5ROOT`/`OUTDIR`） |

### 5.2 缺口清单

| 编号 | 等级 | 缺口 | 证据 |
|---|---|---|---|
| T-01 | 中危 | e2e 与生产库/生产密钥强耦合：无临时库、无清理、不校验副作用；重复执行会在生产表留下测试用户与内容 | `test/e2e.mjs:12-13,41-50,74-76` |
| T-02 | 中危 | **零单元测试**：`auth/token.js`（签名/篡改/过期）、`rate-limit.js`（窗口/清理）、`topicVisibility`、状态机 `TRANSITIONS`、「计数对账」均无直接测试 | 目录仅 `test/e2e.mjs` 一个文件 |
| T-03 | 低危 | e2e 断言依赖执行顺序与配额余额（第 218-221 行依赖前面 `forge` 已消耗 1 次发帖配额，注释写的「第4帖」实为 s3），增删用例即失效 | `test/e2e.mjs:78-80,218-221` |
| T-04 | 低危 | 未覆盖：空请求体（→ S-04）、非法 JSON、413 超限、404、`X-Renewed-Token` 续签、hidden 回复删除计数（→ D-01）、多用户点赞并发 | 全仓检索无对应用例 |
| T-05 | 低危 | 死代码误导：`forge.data.id` 恒为 undefined（400 响应无 id），`forgeId` 未被使用 | `test/e2e.mjs:80` |

### 5.3 建议的隔离测试方案（阶段 B 执行，本轮不实施）

1. **配置可注入**（最小改动，1 个文件）：`config.js` 增加
   `DATA_DIR: process.env.FORUM_DATA_DIR || path.join(__dirname,'data')`、`PORT: Number(process.env.FORUM_PORT)||8787`、`HOST: process.env.FORUM_HOST||'127.0.0.1'`。
2. **单测层**（`node:test`，零依赖，不启服务）：
   - `token.test.mjs`：正常签发/校验；篡改 payload、篡改 mac、过期、`uid` 非字符串 → 全部 null；`isAdminToken` 长度不等快速失败
   - `rate-limit.test.mjs`：窗口边界、超限、桶满清理、S-08 的顺序回归
   - `visibility.test.mjs`：`topicVisibility` 的 5×2 矩阵（5 状态 × 作者/他人）
   - `transitions.test.mjs`：`TRANSITIONS` 全组合（合法 5 条、非法若干）
3. **e2e 隔离化**：脚本改为读 `FORUM_BASE_URL/FORUM_SECRET_PATH/FORUM_ADMIN_TOKEN_PATH`，由运行器创建临时目录 + 临时端口，跑完删除；避免触碰生产。
4. **新增回归断言（对应本报告发现）**：无体 POST → 400（S-04）；approve→hide→delete 后 `reply_count=0`（D-01）；`reply_count === COUNT(approved)` 对账（D-01/D-02）；6 次不同 `X-Real-IP` 注册均成功（S-01）。
5. **不做**：不为凑覆盖率写断言；不把行数减少当通过标准。

---

## 6. 已检查文件清单与未检查内容

### 6.1 已全量阅读（18/18，逐行）

`server.js`、`config.js`、`lib/http.js`、`auth/token.js`、`middleware/auth.js`、`middleware/rate-limit.js`、`db/database.js`、`db/schema.sql`、`routes/users.js`、`routes/topics.js`、`routes/replies.js`、`routes/likes.js`、`routes/reports.js`、`routes/admin.js`、`admin/index.html`、`deploy/mcu-forum-api.service`、`deploy/backup-forum.sh`、`test/e2e.mjs`

### 6.2 关联文件（用于判定部署事实与客户端契约）

| 文件 | 读取范围 | 用途 |
|---|---|---|
| `workspace/deploy/mcu.yaokaixin.top.conf` | `/api/` 段落及上下文 | 确认反代与 `X-Real-IP` 传递（S-01） |
| `workspace/deploy/mcuatlas.xyz.conf` | `/api/` 段落及上下文 | 同上（第二站点） |
| `h5/assets/js/forum.js` | 1-120 行 + 全量调用点检索 | 确认注册前置链、token/deviceId 存储（S-01/S-02） |
| `workspace/forum-e2e.cjs` | 全文 | 区分 UI 测试与 API 测试（5.1） |

### 6.3 未检查（明确声明）

1. **生产运行状态**：未访问 `8.137.48.145`，未确认 `mcu-forum-api.service` 是否 active、`/api/` location 是否已启用、`data/` 是否存在
2. **真实数据库**：本地无 `data/`，未查看任何实际行、统计与索引执行计划
3. **Node 24 `node:sqlite` 运行时行为**：`run()` 返回的 `changes` 类型（number/bigint）、约束错误 `code`/`message` 实际取值未验证（`isUniqueConflict` 依赖 `message` 含 `UNIQUE`，见 7.2）
4. **未运行任何测试**：`test/e2e.mjs`、`workspace/forum-e2e.cjs` 均未执行 → 本报告所有「缺陷存在」均基于代码路径推断，不含运行证据
5. **H5 渲染层**：`forum.js` 仅读到第 120 行，其后渲染/转义逻辑未审（属另一项目范围，可能影响 S-02 的实际泄露面）
6. **`h5/` 其余页面与 `shared/`、`wechat/`、`douyin/`**：与本次目标无关，未读
7. **Nginx 实际生效配置**：仓库内 `.conf` 为副本，未与服务器 `/etc/nginx/` 比对
8. **备份可用性**：`deploy/backup-forum.sh` 是否被 cron 调用、`sqlite3` 是否存在、备份是否可恢复，未验证
9. **设计依据**：代码注释反复引用「拍板指令」第 N 节，但该文档**不在仓库内**（全库检索仅命中代码自身），无法核对「预期行为」与「实现」的偏差

---

## 7. 审计局限与剩余风险

### 7.1 局限

| # | 局限 | 对结论的影响 |
|---|---|---|
| 1 | 纯静态审计，零运行 | 所有 500/429/413 类结论为「代码路径必然」推断，未取得运行证据；`[待验证]` 项一律未升级 |
| 2 | 单进程假设来自 `deploy/mcu-forum-api.service`（`Type=simple`，无 cluster） | 若线上实际以多进程/PM2 cluster 运行，D-06、D-02 的并发风险立即升级为中/高危 |
| 3 | 未接触生产库 | 无法确认线上是否**已经**存在计数漂移（D-01/D-02 可能已发生） |
| 4 | 未核实 Nginx 生效 | S-01 的实际影响面取决于 `/api/` 是否已上线（见该项备注） |
| 5 | 设计文档缺失 | 无法判定「举报无消费端」「回复不可删除」等是遗漏还是裁剪；本报告按「已暴露入口但无闭环」记录 |
| 6 | 未做依赖审计 | 项目零 npm 依赖（`require` 仅 `node:` 内置），供应链风险为零；但 Node 运行时版本决定 `node:sqlite` 行为，未验证 |

### 7.2 剩余风险（无法用静态手段排除）

1. **`isUniqueConflict` 依赖错误文本**：`String(e.message).indexOf('UNIQUE')`。若 Node 版本改变措辞，重复点赞将从「幂等 200」退化为 500；重复举报从 409 退化为 500。
2. **`del.changes` 类型**：若驱动返回 bigint，`changes > 0` 仍成立（混合比较合法），但若将来改为 `===` 判断会静默失效。
3. **`Math.random()` 设备 ID**：理论上可预测（引擎内部状态可被推断），实际远程利用门槛高，但作为「凭据生成器」不应保留。
4. **管理 token 明文落在 `data/admin-token.key`**：与数据库同机同目录；若备份脚本或打包误包含 `data/`，凭据随之扩散（`backup-forum.sh` 仅备份 `.db`，当前未发现扩散路径）。
5. **无速率上限的公开读接口**：Nginx `limit_req` 10r/s burst 20 为唯一防线；应用层无读接口限流，缓存缺失时有被打满 CPU 的可能（未实测）。
6. **`h5/data/news.js` 与论坛同仓**：仓库根 27 项未提交改动与本次无关，但未来若在同一工作区做修复，存在误提交风险（阶段 B 需显式 `git add` 白名单）。

---

## 8. 最终 Verdict

# **FAIL**

**判定依据（按重要性）**

1. **存在 1 项高危生产可用性缺陷（S-01）**：在仓库既定的 Nginx 反代部署下，注册限流退化为全站共享 5 次/小时；由于客户端把所有 API 调用前置为「先注册」，第 6 个新设备之后**新访客连公开列表都无法加载**。这不是理论风险，而是代码 + 配置共同决定的必然行为；唯一未被验证的是线上 location 是否已启用。
2. **存在 2 项中危数据一致性缺陷（D-01、D-02）**：可稳定复现的 `reply_count` 幽灵计数，以及业务级无事务导致的写入中断漂移；两者均无自愈机制，且现有测试不覆盖。
3. **存在 1 项中危异常处理缺陷（S-04）**：空请求体导致未捕获 TypeError → 500 + 内部堆栈日志，认证用户可稳定触发。
4. **身份模型存在结构性弱点（S-02、S-03）**：`deviceId` 事实上是永久凭据（且非 CSPRNG 生成），token 无撤销且可无限续签；这使任何一次 `localStorage` 泄露都等价于永久账号接管。
5. **测试体系不具备安全网能力（T-01、T-02）**：唯一 API 测试硬编码生产密钥路径并写生产库，无法在隔离环境复跑；无任何单元测试，回归只能靠人工。

**同时必须明确：以下核心安全机制经检查是成立的，未发现可利用漏洞**

- 鉴权：伪造/篡改/过期 token 均被 `timingSafeEqual` + `exp` 拒绝；用户 token 与管理 token 完全隔离，用户 token 无法调用管理接口（`admin.js:31-36`）
- 授权：`author_id` 恒取服务端 token，客户端提交即 400；未过审内容仅作者可见，他人 404；无 PUT/PATCH/自定义 status 端点
- SQL：全部用户输入走参数绑定（唯一插值 `type` 不可控，S-05 仅为模式风险）；表名来自内部常量；`status`/`category`/`reason` 均白名单校验
- 注入/穿越/CSRF：无命令执行面、无用户可控文件路径、无 Cookie 鉴权故无 CSRF
- 管理台 XSS：`esc()` 对 title/content/author/id 全量转义，`opButtons` 仅插值服务端 UUID

**因此判定为「安全基线达标、工程完备性不达标」的 FAIL，而非「安全被攻破」。**

**条件说明**：若线上 `/api/` 反代尚未启用（服务仅本机回环访问），S-01 降级为中危，整体可调整为 **PASS WITH FINDINGS**；其余 Must-fix 项不变。

### 8.1 Must-fix（再次审计前置条件，本轮不执行）

| 序号 | 项 | 最小改动 |
|---|---|---|
| M1 | S-01 客户端 IP 提取 | `server.js` 增加 `TRUST_PROXY` 分支读取 `x-real-ip`/`x-forwarded-for`；`config.js` 加开关 |
| M2 | S-04 空体 500 | `server.js` 统一 `ctx.body = body \|\| {}` |
| M3 | D-01 隐藏回复删除计数 | `admin.js:84` 条件加 `\|\| row.status === 'hidden'` |
| M4 | D-02/D-03 事务 | `transition()`、点赞/取消包 `BEGIN IMMEDIATE`/`COMMIT` |
| M5 | T-01/T-02 隔离与单测 | `config.js` 环境变量注入 + 新增 `test/unit/*.test.mjs` + e2e 参数化 |

### 8.2 Should-fix（下一迭代）

S-02（`crypto.randomUUID()` + 设备秘密）、S-03（`ver` 或 logout）、S-06（安全响应头）、S-07（管理操作日志）、D-05（话题可见性上溯）、S-08（限流顺序）

### 8.3 Nice-to-have

S-05、S-09、S-10、S-11、D-04、D-06、D-07、D-08、D-09、D-10、P-01～P-07

---

## 附录 A：严重度统计

| 等级 | 数量 | 编号 |
|---|---|---|
| 高危 | 1 | S-01 |
| 中危 | 7 | S-02、S-03、S-04、D-01、D-02、T-01、T-02 |
| 低危 | 16 | S-05～S-10、D-03～D-07、P-01～P-04、P-07、T-03、T-04 |
| 优化建议 | 7 | S-11、D-08、D-09、D-10、P-05、P-06、T-05 |
| 待验证（独立标签） | 4 | S-10、D-06、S-01（线上生效性）、7.2-1/2 |

**说明：以上计数中的 `[待验证]` 项不因数量计入而升级；每条均已在正文注明缺少何种证据。**

## 附录 B：性能与稳定性备注（未达缺陷门槛，供参考）

- `db.prepare()` 每次调用重新编译 SQL（`db/database.js:31-39`）——当前 QPS 下影响可忽略，热点路径可加 `Map` 缓存
- `getAdminToken()` 每次管理请求同步读盘（`token.js:63`）——管理台低频，可接受
- `admin.js` 列表 `page` 无上限（`:43-44`）——大 OFFSET 全表扫描，管理台单人使用，风险低
- 访问日志不含 IP/UA（`server.js:31-35`）——影响排障，不影响安全
- systemd 已有 `NoNewPrivileges` / `PrivateTmp` / `MemoryMax=150M`；可补 `ProtectSystem=strict` + `ReadWritePaths=<data 目录>`（加固建议，非缺陷）

---

**报告结束。本轮只交付审计结论，未执行任何修复。等待独立验收。未经明确授权，不进入阶段 B。**
