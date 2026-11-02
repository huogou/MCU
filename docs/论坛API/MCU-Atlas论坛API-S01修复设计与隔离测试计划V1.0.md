# MCU Atlas 论坛 API｜S-01 修复设计与隔离测试计划 V1.0

**执行方：** CodeBuddy　**策划与验收方：** ChatGPT
**依据：**《MCU Atlas 论坛 API 全仓库只读审计报告 V1.0》《论坛 API 线上部署与 S-01 风险核查报告 V1.0》
**阶段：** 方案设计。**本轮未修改任何代码、未执行修复、未部署、未连接生产数据库、未发送任何生产写请求。**

---

## 1. 现状与证据

### 1.1 已线上确认的事实（引自核查报告，附证据编号）

| # | 事实 | 证据 |
|---|---|---|
| F1 | 应用仅监听 `127.0.0.1:8787`，单进程，systemd 托管 | E3 `ss -lntp`、E2 `systemctl status` |
| F2 | 唯一公网入口为 nginx `location ^~ /api/ → proxy_pass 127.0.0.1:8787`（两个 vhost 均有） | E8 `nginx -T` |
| F3 | nginx 下发 `X-Real-IP $remote_addr`、`X-Forwarded-For $proxy_add_x_forwarded_for` | E8 |
| F4 | 无 realip 模块改写、无 upstream、无 CDN、无其他代理层 | E9 |
| F5 | `server.js:69` `ip: (req.socket.remoteAddress \|\| 'unknown')…`，**全仓不读取任何转发头** | E11 + 本机 grep（`x-real-ip`/`x-forwarded-for` 在 forum-api 下 0 命中） |
| F6 | `rate-limit.js:41` `registerByIp: (ip) => limit('reg:' + ip, 5, HOUR)`；`config.js:24` 阈值 5/小时 | E11 |
| F7 | `remoteAddress` 与 `ctx.ip` 在**整个后端仅出现 2 处**（`server.js:69`、`users.js:21`）→ 修复爆炸半径 = 1 行 + 1 个新模块 | 本机 grep（只读） |
| F8 | 线上 `forum.js` 的 `api()` 统一先 `ensureToken()`→`register()`；公开列表/详情也走该链 | E14 + 本机读 `forum.js:59-87,287,345,348` |
| F9 | `h5/index.html:486` 已用**裸 fetch**（无 token）读 `/api/topics?sort=latest&size=2`，并注释「匿名读公开数据」→ 「公开读不依赖注册」的既有范式 | 本机读 `index.html:485-489` |
| F10 | 服务端公开 GET **本就不要求身份**：`GET /api/topics`、`/api/topics/:id`、`/api/topics/:id/replies` 均无 `requireUser`；写操作（profile/topics/replies/like/report）全部 `requireUser` | 本机读路由（`server.js:64` 注释亦明示） |
| F11 | 现网注册日志：17×200 / 3×400 / 0×429；10-13 出现 5 次成功注册占满 1 小时窗口 | E15 |

### 1.2 问题定性

S-01 = 「IP 取值层」缺陷（F5 + F1/F2/F3 共同导致所有公网请求的 `ctx.ip` 恒为 `127.0.0.1`），与「限流策略本身」无关。修复只需让 `ctx.ip` 反映真实客户端 IP，且**只在请求确实来自可信代理时**才相信转发头。

同时存在一个**独立的**前端可用性问题：注册失败会连带公开浏览失败（F8）。它与 S-01 成因不同、修复面不同、回滚方式不同，因此拆为方案 B 单列。

---

## 2. 方案 A：可信 IP 获取与注册限流修复

### 2.1 设计要点（逐条回答指令第三节的 7 个问题）

**Q1 客户端 IP 从哪里获取、在哪一层实现？**
- 数据源优先级：`X-Real-IP`（可信代理写入）→ `X-Forwarded-For` 的**最右一条**（nginx 追加的观测地址）→ TCP 对端地址。
- 实现层：HTTP 入口构造 `ctx` 时（`server.js:65-70`），抽为**纯函数模块** `lib/client-ip.js`，导出一个不依赖全局状态的 `clientIp(req, opts)`，便于单元测试注入「信任/不信任」两种配置。
- **不**在路由层或中间件层各自解析（避免多套规则）；nginx 侧**零改动**（F3 已正确下发头）。

**Q2 如何限定可信代理范围？**
- `config.js` 新增两个常量：`TRUST_PROXY`（布尔）与 `TRUSTED_PROXIES`（数组，默认 `['127.0.0.1', '::1']`）。
- 读取转发头的**充要条件**：`TRUST_PROXY === true` **且** TCP 对端（规范化后）∈ `TRUSTED_PROXIES`。
- 二者任一不满足 → 完全不看 `req.headers['x-real-ip']` / `['x-forwarded-for']`。
- 之所以用白名单而非「看头是否存在」：端口仅回环（F1）意味着正常链路 peer 必为 `127.0.0.1`；白名单同时覆盖未来把应用搬到「反代在另一台机」的场景（把那台机的 IP 加进列表即可），并且即便端口被误开放，公网直连请求也不会被采信转发头。

**Q3 当前 Nginx 是否覆盖转发头，能否抵御公网伪造？**
- **能，双重防护**：
  1. nginx `proxy_set_header X-Real-IP $remote_addr;` 会**无条件覆盖**客户端自带的同名头，伪造值到不了应用；`X-Forwarded-For $proxy_add_x_forwarded_for` 是「客户端原值 + `,` + nginx 观测地址」，伪造值只会出现在**最左**，而方案只取最右（或直接用 X-Real-IP），因此伪造无效。
  2. 端口仅监听回环（F1），公网无法直连 8787；即使直连（误开放端口或本机 curl），peer 不在 `TRUSTED_PROXIES`（或 peer 是 `127.0.0.1` 但由本机故意构造——见测试矩阵 TC-A7 的处理规则）。
- 结论：**不需要**改 nginx，也不需要新增 `proxy_hide_header`。

**Q4 非可信来源如何处理？**
- 忽略全部转发头，`ctx.ip` = 规范化后的 TCP 对端地址；对端缺失/非法 → `'unknown'`（fail-closed：落入共享桶 = 从严限流，绝不因异常而放宽）。

**Q5 IPv4 / IPv4-mapped IPv6 / 缺失 / 异常的规范化规则**
| 输入 | 处理 |
|---|---|
| `1.2.3.4` | 原样 |
| `::ffff:1.2.3.4` | 去 `::ffff:` 前缀 → `1.2.3.4`（与同客户端 IPv4 直连**合并同一桶**，符合「同一客户端」语义；现有代码已有此去前缀行为，保持一致） |
| `::1` | 原样（本机 IPv6 回环，保留在白名单） |
| 缺失 / 空串 | `'unknown'` |
| 非 IP 文本（`abc`、`1.2.3.4:5678`、`[::1]:8787`、`999.1.1.1`、超长串） | 判负 → `'unknown'`，**不**做「取第一段」式容错（避免把畸形输入收敛成看似合法的 IP） |
| `X-Forwarded-For` 多值 | 取最右一条后同样走上述校验；每条都非法则回退 peer |
| `X-Real-IP` 含多值/空白/CRLF | 判负（`trim()` 后仍须 `isIP` 通过） |
- 校验用 `node:net` 的 `isIP()`（Node 24 内置，零依赖），不用正则手写（避免漏判 IPv6 压缩形式）。

**Q6 是否修改限流 key / 计数器生命周期 / 阈值？**
| 项 | 结论 | 必要性 |
|---|---|---|
| key 格式 `reg:<ip>` | **不变** | IP 修好后天然按真实客户端隔离；改格式只会让新旧部署的桶不兼容（回滚更危险） |
| 计数器生命周期（进程内固定窗口，重启清零） | **不变** | 与 S-01 无关；重启清零是 S-08 已记录的独立问题，改它需要引入共享存储，超出本次范围 |
| 阈值 5 次/小时 | **不变** | 修好后即为设计意图（每 IP 5 次/小时）。是否放宽属产品策略，见待裁定事项 |
| nginx `limit_req 10r/s` | **不变** | 本就按真实 IP（`$binary_remote_addr`）生效，无需调整 |

**Q7 是否有其他代码路径继续使用错误 IP？**
- 全仓 grep 证明仅 2 处引用（F7），无第三条路径。
- 唯一「间接相关」项：`accessLog`（`server.js:31-35`）不记录 IP，导致修复后**无法从日志观测**限流 key 归属。建议在 accessLog 增加 `ip=`（P-07 的延伸），这是本修复的**验证手段**，但它同时改了日志格式，因此单列为「建议项 A-4」，不混入 S-01 逻辑主体。

### 2.2 建议代码（本轮不落盘，仅供评审）

`lib/client-ip.js`（新增，约 40 行）
```js
'use strict';
/* 可信代理下的客户端 IP 解析（S-01 修复）
 * 规则：
 *  1) 仅在 TRUST_PROXY=true 且 TCP 对端 ∈ TRUSTED_PROXIES 时采信转发头；
 *  2) 优先级 X-Real-IP > X-Forwarded-For 最右一条 > TCP 对端；
 *  3) 任何一条不通过 net.isIP 校验即丢弃并继续回退，绝不「容错取子串」；
 *  4) 全部失败返回 'unknown'（fail-closed）。
 */
const net = require('node:net');

function stripV4Mapped(ip) {
  const m = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(ip);
  return m ? m[1] : ip;
}
function normalize(ip) {
  if (typeof ip !== 'string') return null;
  const v = ip.trim();
  if (!v || v.length > 45) return null;
  if (net.isIP(v) === 0) return null;
  return stripV4Mapped(v);
}
function rightmostForwardedFor(v) {
  if (typeof v !== 'string') return null;
  const parts = v.split(',');
  return parts.length ? parts[parts.length - 1].trim() : null;
}
function isTrustedProxy(peer, trusted) {
  const p = normalize(peer);
  return !!p && trusted.indexOf(p) >= 0;
}

function clientIp(req, opts) {
  const trusted = (opts && opts.trustedProxies) || [];
  const peerRaw = (req.socket && req.socket.remoteAddress) || '';
  const peer = normalize(peerRaw) || 'unknown';

  if (!opts || !opts.trustProxy) return peer;                 // 未声明信任代理 → 只用 peer
  if (!isTrustedProxy(peerRaw, trusted)) return peer;          // 来源不可信 → 忽略所有转发头

  const xri = normalize(req.headers['x-real-ip']);
  if (xri) return xri;
  const xff = normalize(rightmostForwardedFor(req.headers['x-forwarded-for']));
  if (xff) return xff;
  return peer;
}

module.exports = { clientIp, normalize, stripV4Mapped, rightmostForwardedFor, isTrustedProxy };
```

`server.js`（改动 1 处：`65-70` 行 ctx 构造；另 import 一行）
```js
 const { clientIp } = require('./lib/client-ip');   // 顶部 import 区追加
 // ...
 const ctx = {
   req, res, user, body,
   query: u.searchParams,
   params: null,
   ip: clientIp(req, { trustProxy: config.TRUST_PROXY, trustedProxies: config.TRUSTED_PROXIES }),
 };
```

`config.js`（新增 2 项，放在 HTTP 服务段）
```js
  // S-01 修复：是否信任反代转发头；白名单外的来源一律忽略转发头，只用 TCP 对端
  TRUST_PROXY: true,                          // 当前部署：nginx 与本机同机反代
  TRUSTED_PROXIES: ['127.0.0.1', '::1'],      // 仅本机回环；新增反代主机时在此追加
```
> 之所以把 `TRUST_PROXY` 默认设为 `true`：当前唯一部署形态就是本机 nginx 反代（F1/F2），若默认 `false` 则修复不生效、线上行为与现状无异。该常量为显式声明、评审可控；若策划希望「默认 false + 环境变量开启」，见待裁定事项 D-1（需同步改 systemd unit，属配置面变更）。

### 2.3 明确不做（防止范围蔓延）

- 不改 `auth/token.js`、不改限流阈值与 key、不改任何路由鉴权、不改数据库结构。
- 不开放端口、不取消注册限流、不动 nginx/systemd。
- 不借机重构 `rate-limit.js`（S-08/S-09 另案）。

---

## 3. 方案 B：公开读取与注册解耦（只分析，不随 A 捆绑）

### 3.1 服务端边界现状（已逐路由核实，非依据前端按钮推断）

| 路由 | 方法 | 服务端鉴权 | 结论 |
|---|---|---|---|
| `/api/topics` | GET | 无 `requireUser` | 公开 |
| `/api/topics/:id` | GET | 无 | 公开（作者可见性由 `topicVisibility` 控制，与身份可选） |
| `/api/topics/:id/replies` | GET | 无 | 公开 |
| `/api/me`、`/api/me/profile`、`/api/me/topics`、`/api/me/replies` | GET/POST | `requireUser` | 需身份 |
| `/api/topics`、`/api/topics/:id/replies` | POST | `requireUser` + 昵称校验 | 需身份 |
| `/api/topics/:id/like`、`/api/replies/:id/like` | POST/DELETE | `requireUser` | 需身份 |
| `/api/topics/:id/report`、`/api/replies/:id/report` | POST | `requireUser` | 需身份 |
| `/api/admin/*` | GET/POST | `requireAdmin`（独立 admin token） | 需管理身份 |

**服务端边界已正确**：写操作在路由层强制身份，公开读在路由层不要求身份。因此方案 B **不需要改任何服务端代码**，只改前端调用方式。

### 3.2 前端改动设计（`h5/assets/js/forum.js`）

新增一个「公开读」调用函数（与 `api()` 平级，约 12 行）：
```js
  /* 公开读：不带身份、不触发注册；仅用于服务端本就匿名的 GET */
  function pub(path) {
    return fetch(path).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (r.ok) return j;
        var err = new Error((j.error && j.error.message) || '加载失败');
        err.status = r.status; err.code = j.error && j.error.code;
        throw err;
      });
    });
  }
```
切换点（3 处，其余不动）：
| 位置 | 现状 | 改为 |
|---|---|---|
| `forum.js:287` 社区列表 | `api('GET', '/api/topics' + q)` | `pub('/api/topics' + q)` |
| `forum.js:345` 话题详情 | `api('GET', '/api/topics/' + id)` | `pub(...)` |
| `forum.js:348` 回复列表 | `api('GET', … + '/replies?page=1&size=50')` | `pub(...)` |

保持不变：`/api/me*`、写操作（发帖/回复/点赞/举报/资料）继续走 `api()`（含 401 自动重注册重试一次）；`index.html:486` 的裸 fetch 不动（与 `pub()` 同语义，可作一致性佐证）。

行为影响评估：
- 匿名访客：社区列表/详情/回复**不再因注册失败而空白**（F9 已在首页预览验证该路径可用）。
- `liked` 字段：匿名时服务端返回 `false`（`topics.js:37` `likedSet ? … : false`），无回归。
- 未登录用户点「点赞/发布」：仍走 `api()` → `ensureToken()` → 注册 → 服务端 `requireUser`，鉴权强度不变。
- 若注册被限流（A 修复后仅影响该 IP 自己）：该访客仍可浏览，仅不能互动——这是**正确的降级方向**。

### 3.3 方案 B 的风险与回滚（独立于 A）

| 项 | 内容 |
|---|---|
| 修改文件 | 仅 `h5/assets/js/forum.js` |
| 风险 1 | nginx 对 `.js` 设 `expires 7d`（`nginx -T` 行 552），新文件最长 7 天才全量生效 → 需 cache-bust：**改文件名**（如 `forum.v3.js`，同步改 4 个 html 的 script 引用）或加查询串（弱于改名） |
| 风险 2 | 匿名浏览不再产生 token，`X-Renewed-Token` 续签改由 `/api/me*` 与写操作触发——对登录用户无影响 |
| 风险 3 | 前端行为变化需 UI 回归（`workspace/forum-e2e.cjs` 的 4 页 × 3 宽度断言可覆盖） |
| 回滚 | 覆盖回旧版 `forum.js`（文件名方案则同时回 html 引用）；服务端无需回滚 |
| 与 A 的关系 | **完全独立**。A 不依赖 B；B 也不修复 S-01（注册限额仍在，只是不再连带浏览）。可分别上线、分别回滚 |

---

## 4. 修改文件清单

| 编号 | 文件 | 变更 | 目的 | 分类 |
|---|---|---|---|---|
| A-1 | `workspace/forum-api/lib/client-ip.js` | **新增**约 40 行 | 可信代理 IP 解析纯函数 | **必须项**（S-01） |
| A-2 | `workspace/forum-api/server.js` | import 1 行 + ctx.ip 1 行（`:65-70`） | 接入 A-1 | **必须项**（S-01） |
| A-3 | `workspace/forum-api/config.js` | 新增 `TRUST_PROXY`、`TRUSTED_PROXIES` 两项 | 声明信任范围 | **必须项**（S-01） |
| A-4 | `workspace/forum-api/server.js` | `accessLog` 增加 `ip=` | 修复后可观测、可验证（P-07 延伸） | 建议项（强烈建议随 A 一起，否则验证只能靠触库/触注册） |
| T-1 | `workspace/forum-api/config.js` | `DATA_DIR/DB_PATH/PORT/HOST` 增加环境变量回退（默认值与现状逐字相同） | 隔离测试前提（T-01），不影响现网行为 | 建议项（若要做隔离 e2e 则为必须） |
| T-2 | `workspace/forum-api/test/e2e.mjs` | 目标地址/密钥路径改 env；新增「拒绝远程默认目标」护栏；由 harness 拉起隔离实例 | 防止再次直连生产（T-01） | 建议项（安全底线，建议必须） |
| T-3 | `workspace/forum-api/test/unit/*.test.mjs` | 新增单测（见第 5 节） | 回归网 | 建议项（必须用于 A 的验收） |
| B-1 | `h5/assets/js/forum.js` | 新增 `pub()`，3 处公开 GET 切换 | 公开读与注册解耦 | 建议项（独立于 S-01） |
| B-2 | `h5/*.html` + `forum.js` 文件名 | cache-bust（若采用改名方案） | 保证 B-1 生效 | 建议项（随 B-1） |

**不属于本次范围（暂缓项）**：token 撤销/版本号（S-02/S-03）、deviceId 凭证化（S-02）、事务化（D-02/D-03）、hidden 回复删除计数（D-01）、举报消费端（D-04）、安全响应头（S-06）、管理审计日志（S-07）、限流顺序（S-08）、桶清理（S-09）、413 行为（S-10）。这些均有独立依据，需单独立项，**不得**搭车本次变更。

---

## 5. 隔离测试矩阵与通过标准

### 5.1 测试环境（硬性要求）

- 使用 `FORUM_DATA_DIR=<临时目录>`、`FORUM_PORT=0`（随机端口）启动**独立实例**；`secret.key`/`admin-token.key` 在临时目录内自动生成，**绝不指向** `/www/wwwroot/forum-api/data`。
- 所有断言针对 `127.0.0.1:<随机端口>`；**禁止**把 `mcuatlas.xyz` / `mcu.yaokaixin.top` 作为默认目标。
- 单测（`node --test`）不启服务，直接 require 模块，零副作用。
- **本轮不执行任何测试**；以下为设计。

### 5.2 单测矩阵（`test/unit/client-ip.test.mjs`）

| 编号 | 场景 | 输入 | 期望 |
|---|---|---|---|
| TC-A1 | 信任代理 + 两个不同客户端 IP | peer=`127.0.0.1`，请求1 `X-Real-IP: 203.0.113.9`，请求2 `X-Real-IP: 198.51.100.7` | 分别得到 `203.0.113.9` / `198.51.100.7` → 限流 key 为 `reg:203.0.113.9` / `reg:198.51.100.7`，互不共享 |
| TC-A2 | 同一 IP 仍受限 | 同一 `X-Real-IP` 连续 6 次注册 | 前 5 次放行、第 6 次 429 `RATE_LIMITED` |
| TC-A3 | 伪造 `X-Real-IP`（直连场景） | peer=`203.0.113.9`（不在白名单），带 `X-Real-IP: 1.1.1.1` | 忽略头，结果为 `203.0.113.9`；伪造值不能把 key 变成 `reg:1.1.1.1` |
| TC-A4 | 伪造 `X-Forwarded-For` 最左值 | peer=`127.0.0.1`，`X-Forwarded-For: 9.9.9.9, 203.0.113.9` | 取最右 → `203.0.113.9`，**不**等于 `9.9.9.9` |
| TC-A5 | `X-Real-IP` 缺失、`X-Forwarded-For` 缺失 | peer=`127.0.0.1`，无任何头 | 回退 peer → `127.0.0.1` |
| TC-A6 | 异常值 | `X-Real-IP` 分别为 `abc`、`1.2.3.4:80`、`999.1.1.1`、空串、70 字符长串、`::ffff:203.0.113.9` | 前 5 种 → `'unknown'`；最后一种 → `203.0.113.9` |
| TC-A7 | 不信任模式 | `TRUST_PROXY=false`，peer=`127.0.0.1` + 伪造 `X-Real-IP: 1.1.1.1` | 一律 `127.0.0.1`（等价现状，证明开关有效、可回退） |
| TC-A8 | IPv6 回环与 v4-mapped 归一 | peer=`::1`；`X-Real-IP: ::ffff:127.0.0.1` | `::1` 在白名单内被视为可信；`::ffff:127.0.0.1` → `127.0.0.1` |

### 5.3 限流回归单测（`test/unit/rate-limit.test.mjs`）

| 编号 | 场景 | 期望 |
|---|---|---|
| TC-R1 | 固定窗口边界：`windowMs` 内第 `max+1` 次 | 第 `max+1` 次返回 false（触发 429） |
| TC-R2 | 窗口过期后同 key | 重置为可放行（证明未改动窗口语义） |
| TC-R3 | 桶数 >10000 时清理 | 清理后 size ≤ 8000，且未过期桶计数不丢（证明未引入回归） |
| TC-R4 | 并发语义 | 连续同步调用计数准确（单线程串行，无丢计数） |
| TC-R5 | 400/参数非法仍消耗额度（已知行为） | 记录在案，不作为失败项（S-08 另案） |

### 5.4 隔离 e2e 矩阵（`test/e2e.mjs` 改造后）

| 编号 | 场景 | 期望 |
|---|---|---|
| TC-E1 | 匿名 `GET /api/topics`（无 token） | 200（对应方案 B 的服务端前提；A 修复前后均应成立） |
| TC-E2 | 无 token 写操作（POST 发帖 / 点赞 / 举报 / 资料） | 401 `NO_TOKEN`（服务端仍强制身份） |
| TC-E3 | 伪造/过期/篡改 token 写操作 | 401（回归，`e2e.mjs` 已有断言） |
| TC-E4 | 经隔离实例重复注册同 deviceId | 幂等同 uid（回归） |
| TC-E5 | 生产目标防护：未设置 `FORUM_BASE_URL` 时运行 | **拒绝启动**并提示需显式指定隔离地址 |
| TC-E6 | 生产目标防护：`FORUM_BASE_URL` 指向非回环且未设 `FORUM_E2E_ALLOW_REMOTE=1` | **拒绝启动**（防止再次误连 `mcuatlas.xyz` / 生产库） |
| TC-E7 | 空请求体 POST 发帖/回复 | 400 `BAD_TITLE` / `BAD_CONTENT`（S-04 回归，若 M2 已修则本项转绿） |
| TC-E8 | 状态机与计数对账：approve→hide→delete 后 `reply_count === COUNT(approved replies)` | 相等（D-01 回归，若未修 D-01 则本项作为已知失败项登记，不阻塞 A） |

### 5.5 通过标准

- **必须**：TC-A1～TC-A8、TC-R1～TC-R4 全绿；TC-E5、TC-E6 全绿（护栏本身）。
- **必须**：`node --test tests/*.test.mjs` 退出码 0；隔离 e2e 除「已知失败项（D-01/D-04 等未修项）」外全绿，且已知失败项在报告中原样登记、不静默跳过。
- **禁止**：为凑绿而放宽断言、删除断言或跳过用例。

---

## 6. 风险与兼容性分析

### 6.1 方案 A

| 风险 | 影响 | 缓解 |
|---|---|---|
| `TRUSTED_PROXIES` 配错（漏掉实际代理 IP） | 退化为按 peer 计 → 回到「单桶」现状（**功能退化而非安全放宽**，可观测） | 上线后用 A-4 的日志 `ip=` 字段核验；配错时立即表现为桶 key 全是 `127.0.0.1` |
| 误信伪造头 | 限流被绕过 | 双重条件（开关 + peer 白名单）+ 只取最右 XFF；TC-A3/TC-A4 固化 |
| IPv4/IPv6 双栈访客被算成两个桶 | 限额翻倍 | `::ffff:` 归一（TC-A8）；当前 nginx 仅监听 IPv4，实际不触发 |
| 非法 IP 汇入 `'unknown'` 共享桶 | 一批异常访客互相挤占 | fail-closed 设计使然；数量级由 `isIP` 严格性保证，正常浏览器不会触发 |
| 回滚后新旧 key 不兼容 | 无 | key 格式不变（`reg:<ip>`），回滚仅是把 ip 还原为 `127.0.0.1` |
| 前面新增代理层（未来） | XFF 最右变成该代理 IP，退回「少桶」 | 文档化：新增代理时必须把代理 IP 加入 `TRUSTED_PROXIES`，并在该代理上覆盖 `X-Real-IP` |
| 端口误开放公网 | 伪造头风险 | peer 白名单已挡（TC-A3）；另建议运维层保持 `ss` 巡检（本轮不改配置） |

### 6.2 方案 B

| 风险 | 影响 | 缓解 |
|---|---|---|
| 静态缓存 7 天 | 新旧前端行为并存最多 7 天 | cache-bust 改名（B-2）；或临时把该文件 `expires -1`（需改 nginx，单独立项） |
| 匿名用户看不到 `liked` 状态 | 体验 | 服务端本就返回 `false`，属既有语义；登录后即恢复 |
| 写操作仍依赖注册 | 注册失败时不能互动 | 这是**预期降级**；A 修复后注册限额只影响该 IP 自身 |
| 前端回归遗漏 | UI 异常 | 跑 `workspace/forum-e2e.cjs`（4 页 × 3 宽度断言） |
| 与 A 同时上线时故障难归因 | 排障 | **强烈建议 A、B 分两次上线**（见部署顺序） |

---

## 7. 部署前置条件与顺序

### 7.1 前置条件（缺一不可）

1. 单测与隔离 e2e 达标（第 5.5 节）。
2. 生产目录**全量备份**（非 Git 仓库，禁止依赖 `git checkout` 回滚）：
   `cp -a /www/wwwroot/forum-api /www/backup/forum-api-pre-s01fix-$(date +%Y%m%d-%H%M%S)`
   并落一份**变更前后 SHA-256 清单**（基线已知：`server.js 043509ba…`、`config.js 86586a22…` 等 17 项，见核查报告 §2.2）。
3. 记录当前 `systemctl show` 快照（MainPID、ExecStart、User、MemoryMax）与 `ss -lntp | grep 8787` 结果，供回滚后比对。
4. 确认部署窗口内无他人改动该目录（核查报告已确认当前 17 文件哈希与仓库一致；部署前再跑一次 `sha256sum` 比对，发现漂移即停）。
5. 变更文件白名单上传（**不用** `rsync --delete`，**不**同步 `data/`）。

### 7.2 部署顺序（建议 A、B 分离）

**第一阶段：方案 A（后端）**
1. 上传 A-1/A-2/A-3（+ A-4 若批准）。
2. `systemctl restart mcu-forum-api`（唯一必要的重启，安排在低峰）。
3. 启动检查：`systemctl is-active` = `active`；`ss -lntp | grep 8787` 仍为 `127.0.0.1:8787`；`journalctl -u mcu-forum-api -n 20` 无 `[500]`。
4. 效果验证（**零注册消耗**，见 7.3）。
5. 观察 24～48 小时：注册 200/429 比例、`[500]` 计数、公开列表 200 率。

**第二阶段：方案 B（前端，建议 7 天后）**
1. 上传 B-1（+ B-2 cache-bust）。
2. 纯静态更新，**无需重启服务**；生效时间受 7 天缓存影响。
3. UI 回归：`workspace/forum-e2e.cjs`（本地 Chrome，不连生产）。

### 7.3 如何确认新 IP 逻辑生效（不消耗注册额度）

利用 A-4 的 `ip=` 日志字段，从**服务器本机**发 3 个只读请求（全部 GET，零写库、零注册）：

| 探针 | 请求 | 期望日志 |
|---|---|---|
| P1 | `curl -s -o /dev/null -H 'X-Real-IP: 203.0.113.9' http://127.0.0.1:8787/api/topics` | `ip=203.0.113.9`（证明信任链路 + 头部被采信） |
| P2 | `curl -s -o /dev/null -H 'X-Real-IP: not-an-ip' http://127.0.0.1:8787/api/topics` | `ip=127.0.0.1`（证明非法值被拒并回退 peer，而非容错） |
| P3 | `curl -s -o /dev/null http://127.0.0.1:8787/api/topics` | `ip=127.0.0.1`（无头时回退 peer） |

> P1/P2 的请求来自本机（peer=`127.0.0.1`，在白名单内），因此会走「信任分支」，与公网真实链路一致；三者均为 GET `/api/topics`，对空表只做 COUNT+SELECT，不写库。
> 若 A-4 未获批，则只能通过「注册计数变化」间接验证，即必须消耗真实额度——因此**建议 A-4 必须随 A 上线**。

---

## 8. 回滚方案

### 8.1 回滚触发条件（任一即回滚）

- `/api/topics` 等公开接口 5xx 率上升，或 `journalctl` 出现新 `[500]`；
- `systemctl is-active` 非 `active`（启动失败，通常是语法/依赖问题）；
- 探针 P1 未得到预期 `ip=`（说明信任链路未生效且已影响限流正确性）；
- 注册 429 异常激增（说明 key 逻辑错误导致误限流）。

### 8.2 回滚步骤（后端）

1. 停服务：`systemctl stop mcu-forum-api`（短暂不可用，需提前知会）。
2. 从 7.1 的日期备份恢复**白名单文件**（不要整目录覆盖，避免盖上备份后产生的新数据）：
   `cp -a /www/backup/forum-api-pre-s01fix-<STAMP>/{server.js,config.js,lib} /www/wwwroot/forum-api/`
   （`lib/` 恢复为旧内容，即移除 `client-ip.js`；`data/` **绝不动**。）
3. 校验：`sha256sum server.js config.js` 与备份清单一致（应回到 `043509ba…` / `86586a22…`）。
4. 启动并复检：`systemctl start` → `is-active` → `ss -lntp | grep 8787` → `journalctl -n 20`。
5. 记录回滚时间与原因。

### 8.3 回滚步骤（前端，若已上 B）

1. 用上线前保存的 `forum.js`（及 html 引用）覆盖回旧版；
2. 无需重启服务；提示用户强刷或等待缓存过期。

### 8.4 避免覆盖他人改动

- 部署与回滚**只触碰白名单文件**（`server.js`、`config.js`、`lib/`、`h5/assets/js/forum.js`、`h5/*.html`）；
- 全程**不使用** `rsync --delete`、整目录覆盖、`git` 类操作；
- 部署前后各跑一次全目录 `sha256sum`，除白名单外的任何文件哈希变化都必须先查清再继续；
- 该目录当前无其他在途改动（核查报告 §2.2 已确认 17 文件与仓库一致），但**每次部署前仍需复检**，不能沿用旧结论。

---

## 9. 待策划裁定事项

| 编号 | 事项 | 我方建议 |
|---|---|---|
| D-1 | `TRUST_PROXY` 用**代码常量**（默认 true）还是**环境变量 + systemd unit 注入**？ | 代码常量（改动面最小、不碰 systemd）；若偏好 env，则需同步改 unit，属配置面变更，须单独批准 |
| D-2 | A-4（accessLog 加 `ip=`）是否随 A 上线？ | **随 A 上线**，否则 7.3 的零额度验证不可行 |
| D-3 | 方案 B 是否本次一并上线？ | **分开**：先 A（止血 S-01），观察 7 天后再 B |
| D-4 | `forum.js` cache-bust 采用「改文件名」还是「加查询串」？ | 改文件名（`expires 7d` 下查询串不可靠） |
| D-5 | 注册阈值是否维持 5 次/小时？ | 维持（修复后即为设计意图）；如需放宽请产品侧另行评估，不搭车 |
| D-6 | T-1/T-2/T-3（配置 env 化 + e2e 护栏 + 单测）是否纳入本次变更集？ | 纳入 T-2/T-3（安全底线与回归网）；T-1 是隔离 e2e 前提，建议一并 |
| D-7 | 是否需要在 A 上线后补一条运维巡检（`ss` 确认 8787 仍仅回环）？ | 建议纳入现有巡检，非代码变更 |
| D-8 | 已登记的 D-01/D-02 等一致性缺陷是否在 A 之后立即立项？ | 建议立项，但**不与 A 同批** |

---

## 10. 本轮声明

- **未修改**任何业务代码、测试代码、配置文件；
- **未执行**修复脚本、迁移或部署动作；
- **未修改** Nginx 或 systemd 配置，**未重启/重载/停止**任何服务；
- **未发送**生产注册、发布、点赞、回复、举报等写请求；**未读取**生产数据库内容或密钥；
- **未运行**任何可能连接生产环境的测试（`test/e2e.mjs` 未运行）；
- 本轮唯一产出为本设计文档；文中所有代码均为**建议稿**，尚未落盘；
- **方案设计完成 ≠ 风险已消除**。S-01 在修复上线并通过第 5.5 节与 7.3 验证之前，仍按「已确认适用」处理。

---

**报告结束。等待 ChatGPT 独立审查；未经明确授权，不进入实施阶段。**
