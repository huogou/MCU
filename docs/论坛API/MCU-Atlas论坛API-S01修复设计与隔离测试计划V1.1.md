# MCU Atlas 论坛 API｜S-01 修复设计与隔离测试计划 V1.1

**执行方：** CodeBuddy　**策划与验收方：** ChatGPT
**依据：**《S-01 修复设计与隔离测试计划 V1.0》及审查意见
**性质：** 设计修订与隔离测试准备。**本任务不是生产修复任务。**

**交付物索引：**
1. 第一部分：本轮只读核查结果（现状基线，交付物 6 的前置）
2. 第二部分：《V1.0 设计问题修订对照表》（交付物 2）
3. 第三部分：IP 解析最终规范 V1.1 + 建议代码（交付物 1 主体）
4. 第四部分：《隔离测试启动与生产目标防护设计》（交付物 3）
5. 第五部分：《测试用例—执行命令—验收标准映射表》（交付物 4）
6. 第六部分：《生产验证与逐文件回滚方案》（交付物 5）
7. 第七部分：未解决问题清单与本轮声明

---

# 第一部分　本轮只读核查结果

## 1.1 核查范围与方法

仅读取与 S-01 修复及隔离测试直接相关的文件；线上部分用只读命令复核（不沿用旧报告结论）。

| 核查项 | 方法 | 结果 |
|---|---|---|
| `server.js` IP 取值 / ctx 构造 / 日志 | 读文件 `30-70`、`96-113` 行 | `ctx.ip = req.socket.remoteAddress`（`:69`）；`accessLog` **不含 IP**（`:31-35`） |
| `server.js` 启动日志 | 读 `:101-105` | 监听回调打印 `config.PORT`，**不是** `server.address().port` → `PORT=0` 时日志显示 0，随机端口不可发现 |
| `config.js` 加载逻辑 | 读全文 | 纯静态对象、**无任何 env 读取**；`HOST/PORT` 写死 |
| 数据/密钥/数据库路径推导 | 读 `config.js:13-16` + `db/database.js:14-16` + `auth/token.js:14-24` | `DATA_DIR/DB_PATH/SECRET_PATH/ADMIN_TOKEN_PATH` **四者各自独立**拼自 `__dirname`，后三者**并非**由 `DATA_DIR` 派生 |
| `rate-limit.js` 注册限流 | 读全文 | `hit()` 固定窗口、`limit()` 抛 429、`registerByIp = 'reg:'+ip`、`HOUR` 窗口 |
| `test/e2e.mjs` 默认目标与密钥 | 读 `:11-13` | `BASE='http://127.0.0.1:8787'`；`SECRET`/`ADMIN_TOKEN` 在**模块顶层** `readFileSync('/www/wwwroot/forum-api/data/...')` |
| `test/e2e.mjs` 是否发写请求 | 读全文 | **会**：注册、发帖、回复、点赞、举报、管理端状态转换全部执行（写生产库） |
| 其他测试脚本 | `workspace/forum-e2e.cjs` | H5 **UI** 测试：本地静态服务 + fetch stub，不连生产网络；产物写 `workspace/forum-shots/`。**无生产连接路径** |
| Nginx 转发配置 | 线上 `nginx -T` + `grep -B6 -A6 proxy_set_header` | 两处 vhost 均为 `X-Real-IP $remote_addr` / `X-Forwarded-For $proxy_add_x_forwarded_for`；`set_real_ip_from` 计数 0（无 realip 改写） |
| 线上文件是否仍与审计版本一致 | 线上 `sha256sum`（7 个关键文件） | 全部与核查报告基线一致（`server.js 043509ba…` 等）→ **生产未被改动** |

## 1.2 与 V1.0 假设的差异（直接影响设计正确性）

| # | V1.0 的假设 | 实际 | 后果 |
|---|---|---|---|
| X1 | T-1「`DATA_DIR/DB_PATH/PORT/HOST` 加 env 回退」即可隔离 | 只覆盖 `DATA_DIR` 时，`DB_PATH`/`SECRET_PATH`/`ADMIN_TOKEN_PATH` 仍指向**生产路径** | **隔离失效**：测试会连生产库、读生产密钥 |
| X2 | `FORUM_PORT=0` 时从日志拿端口 | 日志打印 `config.PORT`（=0），不打印真实端口 | harness 无法发现端口 → 隔离 e2e 不可执行 |
| X3 | env 回退可写成 `Number(env) \|\| 8787` | `0` 是 falsy → `FORUM_PORT=0` 会退化成 8787（**撞上生产服务**） | 必须用 `!== undefined` 判断 |
| X4 | e2e 可先跑护栏再读密钥 | 密钥在**模块顶层**读取，护栏写在后面也来不及 | 护栏必须位于任何 FS 读取之前 |
| X5 | 直连探针可证明「nginx 覆盖伪造头」 | 直连只证明「应用在信任 peer 时采信头」 | 必须把「本机直连探针」与「经 Nginx 链路验证」分开 |

---

# 第二部分　《V1.0 设计问题修订对照表》

| 编号 | V1.0 问题 | 严重度 | V1.1 修订 | 状态 |
|---|---|---|---|---|
| R-01 | TC-A6 把「非法 `X-Real-IP`」期望为 `unknown`，与「非法头不判 unknown、继续回退」的规则矛盾 | 逻辑矛盾（实现与测试互相打架） | 改为：非法 `X-Real-IP` → 继续试 XFF 最右 → 再回退 peer；仅当**全部来源非法/缺失**才 `unknown` | 已修订（3.1 / 5.2） |
| R-02 | 7.3 把本机直连伪造头探针表述为「证明 Nginx 覆盖头部」 | 证据错位 | 拆为两类：**T-直连**（证明应用信任逻辑，本机执行）与 **T-Nginx**（经公网入口 + 可控伪造头，证明 nginx 用 `$remote_addr` 覆盖）；后者列为部署后验证，**本轮不执行** | 已修订（6.2） |
| R-03 | 未发现 `PORT=0` 端口不可观测 | 隔离不可执行 | 增补变更 S-3：listen 回调打印 `server.address().port`，harness 从该行解析 | 已修订（3.3 / 4.2） |
| R-04 | env 回退写法会用 `\|\|` 把 0 变默认值 | 会撞生产端口 | 明确 `process.env.FORUM_PORT !== undefined ? Number(...) : 8787`，并加护栏「端口 8787 需显式授权」 | 已修订（3.3 / 4.3） |
| R-05 | 只覆盖 `DATA_DIR` 不能搬走 DB 与密钥 | **隔离失效（最高优先）** | 重构为「先定 `DATA_DIR`，再由它派生 `DB_PATH/SECRET_PATH/ADMIN_TOKEN_PATH`」，env 未设时路径与现状逐字节相同 | 已修订（3.3 / 4.3） |
| R-06 | e2e 顶层读生产密钥 | 未跑就先抛错/泄读 | 护栏前置到文件最顶部（仅依赖 `process.env`），密钥读取改为护栏之后 | 已修订（4.3） |
| R-07 | 回滚用 `cp -a backup/lib` | 会覆盖整个目录、可能盖上他人在途改动 | 改为**逐文件恢复 + 删除本次新增文件**，禁整目录覆盖 | 已修订（6.4） |
| R-08 | A-4 只说要加 `ip=`，未处理 `accessLog` 取不到 ctx 的路径 | 实现会出现 `undefined` | `accessLog` 增第 5 参 `ip`，3 个调用点分别传 `ctx.ip` / `'-'` | 已修订（3.3） |
| R-09 | D-01/D-04 未修项「不阻塞 A」但无明确登记机制 | 可能被静默跳过 | 建立 `KNOWN_FAILURES` 显式清单，harness 汇总单独分组打印，不允许删除或跳过断言 | 已修订（5.4） |
| R-10 | 未证明单测不启服务/不发请求 | 验收不可检 | 增加元检查命令（grep 禁项）+ 目录约定 | 已修订（5.1） |
| R-11 | 「nginx 零改动」结论未在本轮复核 | 依赖旧结论 | 本轮已线上复核（1.1），结论不变 | 已复核 |
| R-12 | 未说明 XFF 最右为何可信的边界 | 未来加代理层会静默退化 | 明确「最右 = 最后一跳代理观测地址」，新增代理层必须加白名单并在该层覆盖 `X-Real-IP` | 已补充（3.4） |

---

# 第三部分　IP 解析最终规范 V1.1（交付物 1 主体）

## 3.1 最终规则（唯一权威表述，实现与测试均以此为基准）

```
输入：req（含 req.socket.remoteAddress、req.headers）、opts{trustProxy, trustedProxies}

N1  规范化 normalize(v):
      - 非字符串 / trim 后为空 / 长度 > 45       → null
      - net.isIP(v) === 0                        → null
      - 形如 ::ffff:<IPv4>                       → 去掉前缀，返回 IPv4
      - 其余                                     → 原样返回
N2  信任判定 trusted：
      - opts.trustProxy !== true                 → false
      - normalize(peer) 为 null                  → false
      - normalize(peer) ∈ opts.trustedProxies    → true（白名单匹配同样走 N1）
N3  解析顺序（短路，任一步成功即返回）：
      a) 若 trusted：normalize(headers['x-real-ip']) 成功 → 采用
      b) 若 trusted：取 headers['x-forwarded-for'] 按 ',' 分割的**最后一条**，trim 后 normalize 成功 → 采用
      c) normalize(peer) 成功                    → 采用
      d) 其余                                    → 'unknown'
N4  硬性约束：
      - 不得读取 XFF 的第一条（客户端可伪造）
      - 不得对非法头值做「取子串/去端口/猜测」式容错
      - 单个非法头不会把整体打成 unknown（只有 d 分支才产出 unknown）
      - 不得直接信任任意客户端提交的转发头（必须过 N2）
```

## 3.2 与旧实现的差异说明

| 场景 | 旧行为 | V1.1 行为 |
|---|---|---|
| 反代下正常公网请求 | `127.0.0.1`（错误） | 真实客户端 IP |
| `X-Real-IP: 203.0.113.9`（peer 可信） | 忽略 | `203.0.113.9` |
| `X-Real-IP: abc`（peer 可信） | 忽略 | 继续试 XFF → 回退 peer（**不是** unknown） |
| `X-Forwarded-For: 9.9.9.9, 203.0.113.9`（peer 可信） | 忽略 | `203.0.113.9`（最右） |
| peer 不可信 + 任意伪造头 | 忽略 | 只用 peer |
| peer `::ffff:127.0.0.1` | 去前缀 → `127.0.0.1` | 同样去前缀，且因此**命中**白名单 `127.0.0.1` |
| peer 缺失 + 头非法 | `unknown` | `unknown` |

## 3.3 变更文件与建议代码（本轮不落盘）

### S-1（必须）新增 `workspace/forum-api/lib/client-ip.js`

```js
'use strict';
/* S-01 修复：可信代理下的客户端 IP 解析（纯函数，便于单测注入信任/不信任）
 * 规则见设计文档 3.1：N1 规范化 / N2 信任判定 / N3 解析顺序 / N4 硬性约束
 */
const net = require('node:net');

function normalize(v) {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  if (!s || s.length > 45) return null;
  if (net.isIP(s) === 0) return null;
  const m = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(s);
  return m ? m[1] : s;
}
function rightmostXff(v) {
  if (typeof v !== 'string' || !v.trim()) return null;
  const parts = v.split(',');
  return parts[parts.length - 1].trim();
}
function isTrustedPeer(peerRaw, trusted) {
  const p = normalize(peerRaw);
  return !!p && Array.isArray(trusted) && trusted.indexOf(p) >= 0;
}

function clientIp(req, opts) {
  const o = opts || {};
  const trusted = o.trustedProxies || [];
  const peerRaw = req && req.socket ? req.socket.remoteAddress : null;
  const peer = normalize(peerRaw);

  if (o.trustProxy === true && isTrustedPeer(peerRaw, trusted)) {
    const xri = normalize(req.headers['x-real-ip']);
    if (xri) return xri;                                    // N3a
    const xff = normalize(rightmostXff(req.headers['x-forwarded-for']));
    if (xff) return xff;                                    // N3b
  }
  return peer || 'unknown';                                  // N3c / N3d
}

module.exports = { clientIp, normalize, rightmostXff, isTrustedPeer };
```

### S-2（必须）`server.js` 改动 3 处

```js
// (1) import 区追加
const { clientIp } = require('./lib/client-ip');

// (2) accessLog 增加 ip 参数（A-4 最小化：仅一个字段）
function accessLog(started, req, res, user, ip) {
  const ms = Date.now() - started;
  const uid = user ? user.uid.slice(0, 8) : '-';
  console.log(`[api] ${req.method} ${req.url} ${res.statusCode} ${ms}ms uid=${uid} ip=${ip || '-'}`);
}

// (3) ctx.ip 接入（替换 :69）
    ip: clientIp(req, { trustProxy: config.TRUST_PROXY, trustedProxies: config.TRUSTED_PROXIES }),
```

三个 `accessLog` 调用点同步传参：
- `:51`（管理页 HTML，ctx 尚未创建）→ `accessLog(started, req, res, null, '-')`
- `:78`（命中路由）→ `accessLog(started, req, res, user, ctx.ip)`
- `:93`（异常分支，ctx 可能未创建）→ `accessLog(started, req, res, user, ctx ? ctx.ip : '-')`

### S-3（必须）`server.js` 启动日志打印真实端口（配合 PORT=0）

```js
server.listen(config.PORT, config.HOST, () => {
  const addr = server.address();                 // { address, port }
  const shown = addr && typeof addr === 'object' ? addr.port : config.PORT;
  console.log(`[forum-api] listening on http://${config.HOST}:${shown} (node ${process.version})`);
  console.log(`[forum-api] db: ${config.DB_PATH}`);
  console.log(`[forum-api] admin page: http://${config.HOST}:${shown}/api/admin/`);
});
```
> 只改日志取值，不改变监听行为；`PORT=8787` 时输出与现状一致。

### S-4（必须）`config.js`：路径派生重构 + env 回退（默认值与现状逐字节相同）

```js
const path = require('path');

const env = process.env;
const DATA_DIR = env.FORUM_DATA_DIR || path.join(__dirname, 'data');
const PORT = env.FORUM_PORT !== undefined ? Number(env.FORUM_PORT) : 8787;   // 不能用 ||，0 会被吞
const HOST = env.FORUM_HOST || '127.0.0.1';

module.exports = {
  HOST, PORT,
  DATA_DIR,
  DB_PATH: path.join(DATA_DIR, 'forum.db'),
  SECRET_PATH: path.join(DATA_DIR, 'secret.key'),
  ADMIN_TOKEN_PATH: path.join(DATA_DIR, 'admin-token.key'),

  // S-01 修复：仅在声明信任且对端命中白名单时才采信转发头
  TRUST_PROXY: true,
  TRUSTED_PROXIES: ['127.0.0.1', '::1'],

  /* ……以下 LIMITS / 业务规则 / BODY_LIMIT / 分页等原样不动…… */
};
```

**等价性证明（评审要点）**：`env` 全部未设置时，`DATA_DIR === path.join(__dirname,'data')`，`DB_PATH/SECRET_PATH/ADMIN_TOKEN_PATH` 与旧代码 `path.join(__dirname,'data', …)` 逐字节相同；`HOST/PORT` 与旧字面量相同。因此**现网行为零变化**（除 S-1/S-2 的 IP 与日志字段）。

### S-5（测试使能，必须）`test/e2e.mjs` 护栏前置 + 惰性读取密钥

```js
'use strict';
/* ---- 生产目标防护：必须位于任何 fs 读取之前 ---- */
import fs from 'node:fs';
const BASE = assertTestTarget(process.env.FORUM_BASE_URL);          // 无值 → exit 2
assertIsLoopback(new URL(BASE));                                    // 非回环 → exit 3
assertNotProdPort(new URL(BASE).port);                              // 8787 且未显式授权 → exit 4
assertIsolatedDataDir(process.env.FORUM_DATA_DIR,
                      process.env.FORUM_SECRET_PATH,
                      process.env.FORUM_ADMIN_TOKEN_PATH);          // 不在同一临时目录 / 含 /www/ → exit 5
const SECRET = fs.readFileSync(process.env.FORUM_SECRET_PATH, 'utf8').trim();     // 护栏之后才读
const ADMIN_TOKEN = fs.readFileSync(process.env.FORUM_ADMIN_TOKEN_PATH, 'utf8').trim();
```

### S-6（测试使能，必须）新增 `test/harness.mjs`（隔离实例编排）

职责（仅设计，本轮不执行）：
1. `fs.mkdtempSync(path.join(os.tmpdir(), 'forum-e2e-'))` 建独立数据目录；
2. `spawn(process.execPath, ['server.js'], { env: { ...process.env, FORUM_DATA_DIR: tmp, FORUM_PORT: '0', FORUM_HOST: '127.0.0.1' } })`；
3. 读 stdout，解析 `[forum-api] listening on http://127.0.0.1:<port>` 拿**真实随机端口**（不猜测、不扫描）；
4. 用该端口 + `tmp/secret.key`、`tmp/admin-token.key` 以 env 形式调用 `test/e2e.mjs`；
5. 结束时 `child.kill()`、`fs.rmSync(tmp, { recursive: true, force: true })`；
6. 打印摘要：e2e 退出码、PASS/FAIL 计数、监听地址、数据目录路径、已知失败项分组；**绝不打印密钥内容**。

## 3.4 兼容性边界（写进代码注释，防止未来静默退化）

- 「XFF 最右一条」的可信性来自「本部署只有一跳代理且该代理由我们控制」。**新增任何前置代理/CDN 时**：必须把该代理 IP 加入 `TRUSTED_PROXIES`，并确保其覆盖 `X-Real-IP`；否则桶粒度会退化到「按最后一跳代理」。
- 若未来启用 IPv6 监听（`HOST=::`），`::1` 已在白名单；`::ffff:` 归一保证同一客户端不分裂成两个桶。

---

# 第四部分　《隔离测试启动与生产目标防护设计》（交付物 3）

## 4.1 隔离实例启动参数（唯一合法形态）

```
FORUM_DATA_DIR = <mkdtemp 临时目录>      # DB + secret.key + admin-token.key 全部落在这里
FORUM_PORT     = 0                        # 随机端口，真实值从启动日志读取
FORUM_HOST     = 127.0.0.1
```
- 独立临时数据目录 ⇒ 独立测试数据库 + 独立测试密钥（密钥由应用首次启动自动生成于该目录）。
- **禁止**出现任何指向 `/www/wwwroot/forum-api/data`、`/www/backup/`、生产域名或生产 IP 的路径/地址。

## 4.2 端口发现（禁止猜测）

- 唯一合法来源：harness 解析子进程 stdout 的 `[forum-api] listening on http://127.0.0.1:<port>`（由 S-3 保证打印真实端口）。
- 禁止：写死 8787、端口扫描、`netstat` 猜测。
- 解析失败 ⇒ harness 立即终止并报错，不得回退到任何默认端口。

## 4.3 生产目标防护规则（可独立检查，不依赖执行者声明）

| 护栏 | 规则 | 失败动作 |
|---|---|---|
| G1 目标必填 | `FORUM_BASE_URL` 未设置或为空 | `exit 2`，打印「未指定测试目标，拒绝启动」 |
| G2 仅回环 | 目标 hostname ∉ {`127.0.0.1`,`::1`,`localhost`} 且未设 `FORUM_E2E_ALLOW_REMOTE=1` | `exit 3` |
| G3 禁生产端口 | 目标端口为 `8787` 且未设 `FORUM_E2E_ALLOW_PROD_PORT=1` | `exit 4`（防止误连线上服务） |
| G4 数据目录隔离 | `FORUM_DATA_DIR` 未设置；或 `FORUM_SECRET_PATH`/`FORUM_ADMIN_TOKEN_PATH` 不在 `FORUM_DATA_DIR` 内；或路径包含 `/www/` | `exit 5` |
| G5 禁生产域名/IP 字面量 | 目标或任何路径包含 `mcuatlas.xyz`、`mcu.yaokaixin.top`、`mcu.yaoqiang.xin`、`8.137.48.145` | `exit 6` |
| G6 运行前复检 | e2e 启动时再次校验 G1–G5，并打印一行目标/数据目录摘要（仅路径） | 任一失败即终止 |
| G7 运行中断言 | 任一响应来自非预期 `BASE`（如重定向到外部域） | 记为 FAIL 并终止 |

> 说明：G2/G3 的「显式授权开关」仅为将来在**受控演练**中留出通道，**本任务与本轮一律不启用**，且开启后仍禁止写生产（写请求仅发往隔离实例）。

## 4.4 对现有脚本的隐藏生产路径排查结论

| 脚本 | 隐藏生产默认 | 自动读生产密钥 | 连生产库 | 自动写请求 | 处置 |
|---|---|---|---|---|---|
| `test/e2e.mjs` | 有：`BASE=http://127.0.0.1:8787`（`:11`） | **有**：`:12-13` 顶层 `readFileSync('/www/wwwroot/forum-api/data/…')` | 会（经 8787 打生产库） | **会**（注册/发帖/回复/点赞/举报/审核） | S-5 护栏前置 + 惰性读取；仅允许 harness 以隔离参数调用 |
| `workspace/forum-e2e.cjs` | 无（本地静态服务 + fetch stub） | 无 | 无 | 无（UI 断言） | 保持原样；产物目录 `workspace/forum-shots/` |
| `test/unit/*`（新增） | 无 | 无 | 无 | 无 | 见 5.1 元检查 |

## 4.5 运行后记录（强制）

每次测试结束必须输出并留存：`e2e 退出码`、`PASS/FAIL 计数与用例名`、`实际监听地址（host:port）`、`数据目录路径`、`已知失败项清单`；**不得输出密钥内容**（harness 只打印路径）。

---

# 第五部分　《测试用例—执行命令—验收标准映射表》（交付物 4）

## 5.1 目录与命令约定（先验证命令能发现文件）

| 层 | 目录/文件 | 执行命令（PowerShell，工作目录 = `workspace/forum-api`） | 说明 |
|---|---|---|---|
| 纯单测 | `test/unit/client-ip.test.mjs`、`test/unit/rate-limit.test.mjs` | `node --test test/unit` | Node 24 test runner 支持目录递归发现 `*.test.mjs`；不启服务、不发请求 |
| 隔离 e2e | `test/harness.mjs`（内部调用 `test/e2e.mjs`） | `node test/harness.mjs` | 自行拉起隔离实例、发现端口、跑完清理 |
| 元检查（证明单测纯净） | — | `node -e "const fs=require('fs');const t=fs.readdirSync('test/unit').flatMap(f=>[fs.readFileSync('test/unit/'+f,'utf8')]).join('');if(/fetch\(|http\.request|require\(['\"]\.\.\/server/.test(t)){console.error('META_FAIL');process.exit(1)}console.log('META_OK')"` | 期望 `META_OK`、退出码 0 |
| UI 回归（仅方案 B） | `workspace/forum-e2e.cjs` | `node ..\forum-e2e.cjs` | 需本地 Chrome；不连生产 |

## 5.2 IP 解析单测（`test/unit/client-ip.test.mjs`）

| 编号 | 场景 | 构造 | 期望 | 对应规则 |
|---|---|---|---|---|
| TC-A1 | 可信 peer + 两个不同客户端 IP | peer=`127.0.0.1`；req1 `X-Real-IP: 203.0.113.9`；req2 `X-Real-IP: 198.51.100.7` | 分别 `203.0.113.9` / `198.51.100.7` → key 分别为 `reg:203.0.113.9` / `reg:198.51.100.7` | N3a |
| TC-A2 | 同一 IP 第 6 次注册 | 同 TC-A1 的单一 IP，连调 6 次限流 | 前 5 放行、第 6 抛 429 `RATE_LIMITED` | 回归 |
| TC-A3 | peer 不可信 + 伪造 `X-Real-IP` | peer=`203.0.113.9`，头 `X-Real-IP: 1.1.1.1` | `203.0.113.9`（头被忽略） | N2/N3c |
| TC-A4 | XFF 多值取最右 | peer=`127.0.0.1`，`X-Forwarded-For: 9.9.9.9, 203.0.113.9` | `203.0.113.9`（**不**等于 `9.9.9.9`） | N3b |
| TC-A5 | 头部缺失 | peer=`127.0.0.1`，无任何转发头 | `127.0.0.1` | N3c |
| TC-A6 | **非法 `X-Real-IP` 不回退成 unknown** | peer=`127.0.0.1`；① `X-Real-IP: abc`；② `X-Real-IP: 1.2.3.4:80`；③ `X-Real-IP:` 空 | 均 `127.0.0.1` | R-01 修订 |
| TC-A7 | 非法 X-Real-IP + 合法 XFF | peer=`127.0.0.1`，`X-Real-IP: abc` + `X-Forwarded-For: 9.9.9.9, 203.0.113.9` | `203.0.113.9` | N3a→N3b |
| TC-A8 | 全部非法/缺失 | peer 为 `null`，头全非法 | `'unknown'` | N3d |
| TC-A9 | IPv4-mapped 归一 | `X-Real-IP: ::ffff:203.0.113.9`（peer 可信） | `203.0.113.9` | N1 |
| TC-A10 | v4-mapped peer 命中白名单 | peer=`::ffff:127.0.0.1` + `X-Real-IP: 203.0.113.9` | `203.0.113.9`（peer 归一后命中 `127.0.0.1`，判为可信） | N1/N2 一致性 |
| TC-A11 | IPv6 回环 | peer=`::1` + `X-Real-IP: 2001:db8::1` | `2001:db8::1`（`::1` 在白名单） | N2 |
| TC-A12 | 不信任模式 | `trustProxy:false`，peer=`127.0.0.1` + 伪造 `X-Real-IP: 1.1.1.1` | `127.0.0.1` | N2 |
| TC-A13 | 超长/畸形值 | `X-Real-IP` 为 46+ 字符、`999.1.1.1`、`[::1]:8787` | 回退链，最终非这些值 | N1 |
| TC-A14 | 白名单为空 | `trustedProxies: []` + 任意头 | 一律 peer | N2 |

## 5.3 限流回归单测（`test/unit/rate-limit.test.mjs`）

| 编号 | 场景 | 期望 |
|---|---|---|
| TC-R1 | 固定窗口边界：窗口内第 `max+1` 次 | 第 `max+1` 次 `hit` 返回 false → `limit` 抛 429 |
| TC-R2 | 窗口过期后同 key | 重置可放行（窗口语义未变） |
| TC-R3 | 桶数 >10000 触发清理 | 清理后 `size ≤ 8000`，未过期桶计数保留 |
| TC-R4 | 计数准确性 | 同 key 连续 N 次，`count === N`，无丢计数 |
| TC-R5 | 两个不同 IP 的 key 互相独立 | `reg:A` 打满不影响 `reg:B` |
| TC-R6 | 已知行为登记（S-08） | 参数非法仍消耗额度 → 记为「已知行为」，不作为失败项 |

## 5.4 隔离 e2e（`test/harness.mjs` → `test/e2e.mjs`）

| 编号 | 场景 | 期望 | 已知失败登记 |
|---|---|---|---|
| TC-E1 | 匿名 `GET /api/topics` | 200（公开读不依赖注册） | — |
| TC-E2 | 无 token 写操作（发帖/点赞/举报/资料） | 401 `NO_TOKEN` | — |
| TC-E3 | 伪造 / 过期 / 篡改 token | 401 | — |
| TC-E4 | 同 deviceId 重复注册 | 幂等，同 uid | — |
| TC-E5 | 未设 `FORUM_BASE_URL` | 拒绝启动，`exit 2` | — |
| TC-E6 | 目标非回环且未授权 | 拒绝启动，`exit 3` | — |
| TC-E7 | 目标端口 8787 且未授权 | 拒绝启动，`exit 4` | — |
| TC-E8 | 数据目录/密钥路径不合规 | 拒绝启动，`exit 5` | — |
| TC-E9 | 出现生产域名/IP 字面量 | 拒绝启动，`exit 6` | — |
| TC-E10 | 空请求体 POST 发帖/回复 | 400 `BAD_TITLE`/`BAD_CONTENT`（S-04 修复后）；若未修 S-04 → 记入 `KNOWN_FAILURES` | S-04 未修时 |
| TC-E11 | approve→hide→delete 后计数对账 | `reply_count === COUNT(approved replies)`；不等 → 记入 `KNOWN_FAILURES` | D-01 未修时 |
| TC-E12 | 举报无消费端 | 无 admin 举报列表端点 → 404；记入 `KNOWN_FAILURES` | D-04 未修时 |
| TC-E13 | 注册限流（隔离实例） | 第 6 次 429（证明阈值未被改动） | — |

**`KNOWN_FAILURES` 机制**：harness 维护显式清单（如 `['TC-E10(S-04 未修)','TC-E11(D-01 未修)','TC-E12(D-04 未修)']`），汇总时单独分组打印；**禁止**删除断言、禁止 `try/catch` 静默跳过、禁止把已知失败算进通过率。

## 5.5 通过标准

| 层级 | 通过标准 |
|---|---|
| 元检查 | `META_OK`，退出码 0 |
| 纯单测 | `node --test test/unit` 退出码 0，TC-A1～A14、TC-R1～R6 全绿（TC-R6 仅登记） |
| 隔离 e2e | `node test/harness.mjs` 退出码 0；`KNOWN_FAILURES` 之外全绿；摘要含退出码/计数/监听地址/数据目录 |
| 记录 | 每次运行留存命令、退出码、摘要（路径级，无密钥） |
| 禁止 | 为凑绿放宽/删除断言；把已知失败静默跳过；任何指向生产的请求 |

---

# 第六部分　《生产验证与逐文件回滚方案》（交付物 5）

## 6.1 验证分层（三类严格分开记录）

| 层 | 环境 | 目的 | 是否本轮执行 |
|---|---|---|---|
| L1 应用单测 | 本机，无服务、无网络 | IP 解析与限流逻辑正确 | 设计（不执行） |
| L2 隔离 e2e | 本机临时目录 + 随机端口 | 端到端行为 + 护栏 | 设计（不执行） |
| L3 经 Nginx 入口验证 | 生产公网入口（只读 GET） | 证明 nginx 用 `$remote_addr` 覆盖伪造头 | **设计，部署后执行，本轮禁止** |

## 6.2 L3 经 Nginx 的只读验证（部署后，需单独授权）

探针全部为 `GET`，**不注册、不发帖、不点赞、不回复、不举报、不做审核**：

| 探针 | 请求 | 期望 |
|---|---|---|
| N-1 | `curl -s -o /dev/null -H 'X-Real-IP: 203.0.113.9' https://<生产域>/api/topics` | journald `ip=` 显示**真实出口 IP**，**不是** `203.0.113.9`（证明 nginx 覆盖了伪造头） |
| N-2 | `curl -s -o /dev/null -H 'X-Forwarded-For: 9.9.9.9' https://<生产域>/api/topics` | `ip=` 仍为真实出口 IP（证明只取最右、忽略伪造最左） |
| N-3 | `curl -s -o /dev/null https://<生产域>/api/topics` | `ip=` 为真实出口 IP（无头时正常） |

> N-1/N-2 的期望值只能是「代理观测到的地址」；若日志出现 `203.0.113.9`/`9.9.9.9` 即说明链路被伪造穿透，须立即回滚。
> **与 T-直连探针的区别**：T-直连（`curl -H … http://127.0.0.1:8787/api/topics`）只能证明「应用在 peer 可信时采信头」，**不能**证明 nginx 的覆盖行为；两者不得互相替代（R-02）。

## 6.3 发布前后核对项

| 阶段 | 核对项 | 期望 |
|---|---|---|
| 发布前 | 17 个源文件 SHA-256 与基线一致（`server.js 043509ba…`、`config.js 86586a22…` 等） | 全部一致（否则停） |
| 发布前 | 全量备份目录 + SHA 清单已落盘 | 有 |
| 发布前 | `systemctl show` 快照、`ss -lntp \| grep 8787` | 已记录 |
| 发布后 | `systemctl is-active` | `active` |
| 发布后 | `ss -lntp \| grep 8787` | 仍为 `127.0.0.1:8787`（未开放公网） |
| 发布后 | `journalctl -n 50` | 无新增 `[500]`；`ip=` 字段存在且格式正确 |
| 发布后 | L1/L2 全绿 + N-1/N-2/N-3 符合 6.2 | 全部符合 |
| 观察期 | 24～48h：注册 200/429 比例、`[500]` 计数、公开列表 200 率 | 无异常 |

## 6.4 逐文件回滚（禁整目录覆盖）

**回滚触发条件（任一）**：`is-active` 非 `active`；`/api/topics` 5xx 上升或新增 `[500]`；N-1/N-2 出现伪造值被采信；注册 429 异常激增；`ip=` 字段缺失或格式错误导致观测失效。

**回滚步骤（只动本次改动的文件，绝不碰 `data/` 与密钥）**：

1. `systemctl stop mcu-forum-api`（提前知会，短暂不可用）。
2. 从发布前备份**逐文件**恢复：`server.js`、`config.js`（用备份中的旧版本覆盖）。
3. **删除本次新增文件**：`rm -f /www/wwwroot/forum-api/lib/client-ip.js`（**不要** `cp -a backup/lib`，避免覆盖他人新增文件）。
4. 校验：`sha256sum server.js config.js` 回到 `043509ba…` / `86586a22…`；`ls lib/` 与备份清单一致。
5. `systemctl start mcu-forum-api` → 复检 `is-active`、`ss -lntp | grep 8787`、`journalctl -n 20`。
6. 记录回滚时间、原因、恢复后哈希。

**避免覆盖他人在途改动**：全程白名单文件操作；禁 `rsync --delete`、禁整目录覆盖、禁 `git` 类操作；发布前后各跑一次全目录 `sha256sum`，白名单之外的任何哈希变化必须先查清再继续。

---

# 第七部分　未解决问题清单与本轮声明

## 7.1 未解决问题（需策划裁定或后续立项）

| 编号 | 问题 | 归属 |
|---|---|---|
| U-1 | `TRUST_PROXY` 用代码常量（默认 true）还是 env + systemd 注入？常量方案改动最小但需改文件才能关 | 待裁定（D-1） |
| U-2 | `FORUM_PORT=0` 的真实端口依赖新日志行；若 S-3 未上线，harness 无法工作 | 设计已含 S-3，需批准 |
| U-3 | `KNOWN_FAILURES` 清单需在实施时按「实际未修项」填写，避免写死 | 实施阶段 |
| U-4 | L3 验证需要从公网发 3 个只读 GET；需明确授权（含是否接受日志出现本机出口 IP） | 待授权 |
| U-5 | 方案 B（前端解耦）是否同批上线；建议仍分开 | 待裁定（D-3） |
| U-6 | S-04/D-01/D-04 等未修缺陷是否在 A 之后立即立项 | 待裁定（D-8） |
| U-7 | 注册阈值 5 次/小时是否维持 | 待裁定（D-5） |

## 7.2 本轮声明

- **未修改**任何业务代码、测试代码、配置或生产环境；**未创建/删除**任何项目文件（本设计文档除外）。
- **未运行**任何测试（`test/e2e.mjs`、`workspace/forum-e2e.cjs`、单测均未执行）；**未连接**生产数据库、**未读取**生产密钥。
- **未发送**任何生产写请求；**未重启/停止/重载**任何服务；**未上传/部署/迁移/清理**。
- 线上仅执行只读核查命令（`nginx -T` 展开、`grep`、`sha256sum`），并已确认生产 7 个关键文件哈希与基线一致（未被改动）。
- 本文件所有代码均为**建议稿**，尚未落盘；**设计完成 ≠ 风险已消除**，S-01 在修复上线并通过第五部分通过标准与 6.2 L3 验证前，仍按「已确认适用」处理。

---

**报告结束。等待 ChatGPT 独立复核；未经后续明确授权，不进入代码实施或生产发布阶段。**
