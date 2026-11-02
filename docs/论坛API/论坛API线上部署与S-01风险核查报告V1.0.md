# 论坛 API 线上部署与 S-01 风险核查报告 V1.0

**核查对象：** `mcuatlas.xyz` / `mcu.yaokaixin.top` 的 `/api/` → `127.0.0.1:8787`（MCU Forum API）
**核查目的：** 核实《MCU Atlas 论坛 API 全仓库只读审计报告 V1.0》中 **S-01**（反代后 IP 恒为 127.0.0.1 → 注册限流退化为全站共享）的线上适用条件，并核对部署版本
**执行方：** CodeBuddy　**审查方：** ChatGPT
**本轮性质：** 只读核查。未修复、未部署、未重启、未改配置、未写库、未发送注册请求

---

## 1. 核查时间与执行环境

| 项 | 值 |
|---|---|
| 核查时间 | 2026-10-23 12:5x–13:0x CST（服务器时间与本地一致） |
| 执行端 | Windows 开发机（`D:\SEO\发挥余热`），CodeBuddy CN 1.106.1，Node v24.20.0 |
| 服务器端 | `iZ2vc84qp0oamyzsg87hsaZ`，Alibaba Cloud Linux，SSH 别名 `mcu-atlas`（`root`，仅密钥） |
| 访问方式 | ① SSH 只读命令（`systemctl show/status`、`ss`、`ps`、`pgrep`、`sha256sum`、`sed -n`、`nginx -T`、`grep`、`journalctl`、`ls`、`command -v`）；② 外部 HTTPS GET（经抓取工具，非本机直连） |
| 未使用 | 未执行 `git`（服务器未安装）、未执行 `nginx -s reload`、未执行 `systemctl restart/stop/start`、未执行任何 `POST` |

> SSH 前两次批准请求超时，第三次起获批；未获批期间未执行任何远端命令，也未扩大操作范围。

---

## 2. 实际运行代码版本 vs 本地审计版本

### 2.1 部署形态

| 项 | 实测 |
|---|---|
| 工作目录 | `/www/wwwroot/forum-api` |
| 启动命令 | `/opt/node24/bin/node /www/wwwroot/forum-api/server.js` |
| 运行用户 | `forumapi`（目录属主 `forumapi:forumapi`） |
| 部署方式 | **拷贝部署，非 Git 克隆**——目录内无 `.git`，且服务器**未安装 git**（`bash: git: command not found`） |
| 部署时间戳 | 顶层文件均为 `Sep 15 14:59`，`data/` 为 `Sep 15 15:12` |

**因此「线上 Git HEAD」不可得**：部署目录不是仓库，服务器也没有 git 命令。版本比对改用**文件级 SHA-256**。

### 2.2 文件级比对（17 个文件，全部一致）

| 文件 | 线上 SHA-256（前 16） | 本地审计版本（前 16） | 结果 |
|---|---|---|---|
| `server.js` | `043509bae715f434` | `043509BAE715F434` | ✅ 一致 |
| `config.js` | `86586a2237c7417c` | `86586A2237C7417C` | ✅ |
| `lib/http.js` | `f2516ada813e4c7b` | `F2516ADA813E4C7B` | ✅ |
| `db/database.js` | `811fdb5de6eebde6` | `811FDB5DE6EEBDE6` | ✅ |
| `db/schema.sql` | `3b97d60306ef59ec` | `3B97D60306EF59EC` | ✅ |
| `auth/token.js` | `192c5eb84038d6eb` | `192C5EB84038D6EB` | ✅ |
| `middleware/auth.js` | `187c5cb91c9c6380` | `187C5CB91C9C6380` | ✅ |
| `middleware/rate-limit.js` | `20316c879ee66911` | `20316C879EE66911` | ✅ |
| `routes/admin.js` | `00e1d0abeec26296` | `00E1D0ABEEC26296` | ✅ |
| `routes/likes.js` | `69e3b00bbe798920` | `69E3B00BBE798920` | ✅ |
| `routes/replies.js` | `1cd27417a5fcb1fc` | `1CD27417A5FCB1FC` | ✅ |
| `routes/reports.js` | `08e875c1dd88e8ea` | `08E875C1DD88E8EA` | ✅ |
| `routes/topics.js` | `11f633870f012fa1` | `11F633870F012FA1` | ✅ |
| `routes/users.js` | `2e38927168ceeec3` | `2E38927168CEEEC3` | ✅ |
| `admin/index.html` | `301b921b46535c07` | `301B921B46535C07` | ✅ |
| `test/e2e.mjs` | `ed41cca60c2d131e` | `ED41CCA60C2D131E` | ✅ |
| `/etc/systemd/system/mcu-forum-api.service` | `e15b669d77ae1f89…` | `deploy/mcu-forum-api.service` = `E15B669D77AE1F89` | ✅ 一致 |
| `deploy/backup-forum.sh` | `5468a8be4db32419…` | `5468A8BE4DB32419` | ✅ |

### 2.3 结论

**线上运行代码与本地审计依据版本（仓库 HEAD `fc5531f006ccc1849206232b10a0cd6bdbc76889` 下 `workspace/forum-api/`）字节级一致。** 审计报告中对代码行为的所有判断（含 S-01）可直接适用于线上，无需做「线上可能已修复」的降级假设。

> 补充：`deploy/` 下 `.service` 与 `backup-forum.sh` 亦一致；`data/` 存在（未读取任何内容）。

---

## 3. 服务状态、监听地址与进程管理方式

| 项 | 实测值 |
|---|---|
| systemd 单元 | `mcu-forum-api.service`，`Loaded: loaded (/etc/systemd/system/…; enabled)` |
| 状态 | **active (running)**，自 `2026-09-15 16:06:41 CST` 起，已运行 **37 天 21 小时** |
| MainPID | `2144097`（`PPID=1`，`NLWP=7` 线程，单进程） |
| 内存 | `24.2M`（上限 `150.0M`） |
| 监听 | **`127.0.0.1:8787`**（`users:(("MainThread",pid=2144097,fd=24))`）——仅回环，无 `0.0.0.0` 绑定 |
| 进程管理 | 仅 systemd（`Type=simple`、`Restart=always`）；`command -v pm2 docker haproxy caddy traefik` **全部无输出**；cgroup 内仅 1 个 PID |
| 其他监听 | nginx `0.0.0.0:80/443/888`、sshd `22`、`BT-Panel 8888`、`mariadbd 3306`（与本服务无关） |

**关键点：应用只监听回环地址 → 任何外部请求都必须先经过 nginx，应用看到的 TCP 对端必然是 `127.0.0.1`。**

---

## 4. Nginx 生效配置（`nginx -T` 实读，脱敏片段）

`nginx -T` 为只读展开，不 reload、不写文件。配置中与论坛相关的仅两处 `location`，**无 `upstream` 负载均衡块、无 `proxy_cache`、无 CDN**（`grep -c 8787` = 4，即 2 处 `proxy_pass` + 2 处注释；`grep upstream` 仅命中系统日志格式与 `proxy_next_upstream`，无 upstream 定义）。

### 4.1 vhost：`mcu.yaokaixin.top`（行 555-566）

```nginx
    # ===== V3.0 论坛 API 反代（2026-09-15）：^~ 阻止下方正则 location 截获 =====
    location ^~ /api/ {
        limit_req zone=forum_api burst=20 nodelay;      # 行 492: rate=10r/s, key=$binary_remote_addr
        proxy_pass http://127.0.0.1:8787;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 5s;
        proxy_read_timeout 30s;
    }
```

### 4.2 vhost：`mcuatlas.xyz`（行 722-733）

```nginx
    location ^~ /api/ {
        limit_req zone=forum_api_atlas burst=20 nodelay; # 行 669: rate=10r/s, key=$binary_remote_addr
        proxy_pass http://127.0.0.1:8787;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 5s;
        proxy_read_timeout 30s;
    }
```

### 4.3 其他反代层

- `grep set_real_ip_from`、`grep real_ip_header` → **均无输出**（未启用 realip 模块改写 `$remote_addr`）
- 无 Cloudflare/其它 CDN（80/443 由本机 nginx 直接监听；文档亦记载「CDN 不存在」）
- 仅此两层链路：`公网 → nginx(80/443) → 127.0.0.1:8787`

**本片段不含任何凭据、证书私钥或口令；`access_log` 路径为常规站点日志路径，无敏感信息。**

---

## 5. IP 获取与限流 key 的调用链（基于线上运行文件）

### 5.1 源码证据（`sed -n` 直读 `/www/wwwroot/forum-api`，非仓库副本）

`server.js:64-72`
```js
    user = resolveUser(req);
    const ctx = {
      req, res, user, body,
      query: u.searchParams,
      params: null,
      ip: (req.socket.remoteAddress || 'unknown').replace(/^::ffff:/, ''),
    };
```

`routes/users.js:19-22`
```js
function register(route) {
  route('POST', /^\/api\/me\/register$/, async (ctx) => {
    rate.registerByIp(ctx.ip || 'unknown');
```

`middleware/rate-limit.js:41`
```js
  registerByIp: (ip) => limit('reg:' + ip, config.LIMITS.REGISTER_PER_HOUR_PER_IP, HOUR),
```

`config.js:24`
```js
    REGISTER_PER_HOUR_PER_IP: 5,   // 建号
```

### 5.2 调用链

```
公网请求
  → nginx 443（$remote_addr = 真实客户端 IP，无 realip 改写）
  → proxy_pass http://127.0.0.1:8787   （并下发 X-Real-IP / X-Forwarded-For）
  → 应用 accept：req.socket.remoteAddress = 127.0.0.1   ← 代码只读这里
  → ctx.ip = "127.0.0.1"
  → rate.registerByIp("127.0.0.1")
  → limit('reg:127.0.0.1', 5, 1h)
  → 全站唯一注册桶
```

`X-Real-IP`、`X-Forwarded-For` 由 nginx 正确下发，但**应用代码从不读取这两个头**（全仓 grep 无命中），因此对限流 key 无影响。

### 5.3 逐项回答

| 问题 | 结论 | 依据 |
|---|---|---|
| ① `ctx.ip` 来源 | `req.socket.remoteAddress`（TCP 对端），非任何 `X-*` 头 | `server.js:69`（线上实读） |
| ② 注册限流 key 构造 | `'reg:' + ip`，窗口 1 小时，阈值 5 | `rate-limit.js:41`、`config.js:24` |
| ③ 是否所有公网请求共用同一桶 | **是**。应用仅监听 `127.0.0.1:8787`，全部外部流量经 nginx，故 `remoteAddress` 恒为 `127.0.0.1` | `ss` 监听结果 + nginx `proxy_pass` + 代码 |
| ④ 公开 API 是否依赖先注册 | **服务端不依赖**（匿名 GET `/api/topics` 实测 200，日志 `uid=-`）；**但线上客户端依赖**：`forum.js` 的 `api()` 先 `ensureToken()`，无 token 时 `register()`，注册失败则所有页面数据请求失败 | 线上 `/assets/js/forum.js` 特征核对 + `server.js:64` 注释「公开接口匿名可用」 |
| ⑤ 是否有其他独立注册限流保护 | **无注册级保护**。仅有 nginx 通用请求限流 `limit_req_zone $binary_remote_addr zone=forum_api[_atlas]:10m rate=10r/s burst=20`（按真实 IP，但只限请求速率，不区分注册动作）；无验证码、无手机/邮箱验证、无账户体系 | `nginx -T` 行 492/669；应用内仅 `registerByIp` 一处 |

### 5.4 线上流量实证（journalctl 全生命周期，只读）

| 指标 | 数值 |
|---|---|
| `POST /api/me/register` 日志总行数 | 20 |
| 成功（200） | 17 |
| deviceId 格式非法（400） | 3 |
| **被限流（429）** | **0** |

时间分布：

| 时间 | 情况 | 说明 |
|---|---|---|
| 09-15 15:07:23（PID 2142883） | 3×200 + 1×400 同一秒 | 形态与 `test/e2e.mjs` 的注册序列完全一致（2 次同 deviceId + 1 次新 deviceId + 1 次非法）→ **e2e 曾在线上直接跑过**（T-01 的线上佐证） |
| 09-15 15:11:24（PID 2143021） | 同上 | 前后 PID 变化说明服务重启过，**内存桶随之清零**（S-08 的实证） |
| 09-15 16:06:43（PID 2144097） | 同上 | 当前进程启动时 |
| 09-15 16:18:46 / 09-16 11:41:22 / 09-20 00:06:10 | 各 1×200 | 零散注册 |
| **10-13 13:26:57 → 13:32:23** | **5×200，间隔 6 分 26 秒** | **1 小时窗口配额被占满（5/5）**；此后至 `14:26:57` 之间任何第 6 次注册都会被 429。日志中未出现第 6 次尝试，故「0 次 429」≠「风险不成立」 |

> 另注：日志中 `GET /api/topics?sort=latest&size=2` 多次 200（`uid=-`）来自 H5 首页预览的真实匿名访问，佐证「公开读接口服务端不要求身份」。

---

## 6. S-01 判断

# **已确认适用**

### 6.1 判断依据（分层）

| 层级 | 事实 | 强度 |
|---|---|---|
| L1 代码 | 线上 `server.js:69` 取 `req.socket.remoteAddress`；`rate-limit.js:41` 以 `'reg:'+ip` 为 key；阈值 5/小时 | **直接证据**（线上文件实读 + SHA-256 与审计版本一致） |
| L2 部署 | 应用仅监听 `127.0.0.1:8787`；唯一入口 nginx `location ^~ /api/ → proxy_pass 127.0.0.1:8787`；无 realip 改写、无 upstream、无 CDN | **直接证据**（`ss` + `nginx -T`） |
| L3 链路推演 | 外部请求的 TCP 对端必然是 nginx（127.0.0.1）→ 所有公网请求进入同一桶 | **必然推断**（L1+L2 决定，无需运行即可确定） |
| L4 客户端 | 线上 `forum.js` 的 `api()` 统一先 `ensureToken()`→`register()`，公开列表同样走该路径（4 项特征全部为「是」） | **直接证据**（线上静态资源读取） |
| L5 现网影响 | 10-13 已出现 5/5 占满；未出现第 6 次尝试，故尚未产生 429 | **直接证据**（journalctl） |

**结论：S-01 的三个构成要件（代码取错 IP、部署为回环反代、客户端把注册作为前置）全部在线上成立。风险不再是「条件待确认」，而是「已具备触发条件、尚未被触发到报错」。**

### 6.2 对原审计报告的影响

- S-01 严重度**维持高危**，撤销原文中的条件说明「若线上 `/api/` 未启用则降级为中危」——**该前提不成立，反代已在两个域名同时生效**。
- 原报告 Verdict `FAIL` 的判定依据第 1 条由「待验证线上生效性」升级为「已确认线上适用」。
- 影响面随现网状态进一步明确：论坛当前 `total=0`（无已通过话题）、注册用户 17 个，属**低频/试运行状态**；一旦做推广或集中活动（如 10-13 的 5 人集中注册），第 6 个新访客起即被全站拒绝，且拒绝发生在**浏览之前**（客户端注册前置）。

---

## 7. 每项证据的来源与检查方式

| 编号 | 结论 | 证据来源 | 检查方式 |
|---|---|---|---|
| E1 | 运行用户/工作目录/启动命令 | systemd | `systemctl show mcu-forum-api -p MainPID,User,Group,WorkingDirectory,ExecStart,Type` |
| E2 | 服务运行 37 天、单进程、24.2M | systemd / cgroup | `systemctl status mcu-forum-api`、`ps -o pid,ppid,nlwp,user,etime,rss,args -p 2144097` |
| E3 | 仅监听 127.0.0.1:8787 | 内核套接字 | `ss -lntp` |
| E4 | 无 pm2/docker/haproxy/caddy/traefik | PATH | `command -v pm2 docker haproxy caddy traefik`（无输出） |
| E5 | 17 个源文件与审计版本一致 | 文件系统 | `sha256sum`（本地 `Get-FileHash` 对照） |
| E6 | 非 Git 部署 | 目录 + PATH | `ls -la`（无 `.git`）、`git rev-parse HEAD` → `git: command not found` |
| E7 | unit 文件与仓库副本一致 | 文件系统 | `sha256sum /etc/systemd/system/… deploy/…` |
| E8 | 两个 vhost 均反代 8787 且下发 X-Real-IP/XFF | nginx 生效配置 | `nginx -T \| grep -n -B 8 -A 12 proxy_pass` |
| E9 | 无 realip 改写 / 无 upstream / 无 CDN | nginx 生效配置 | `grep -n set_real_ip_from`、`grep -n real_ip_header`、`grep -n upstream`、`grep -c 8787` |
| E10 | 边缘限流 10r/s 按真实 IP | nginx 生效配置 | `grep -n limit_req_zone`（行 492、669） |
| E11 | IP 取值与限流 key 代码 | 线上运行文件 | `sed -n 64,72p server.js`、`sed -n 19,22p routes/users.js`、`sed -n 39,42p middleware/rate-limit.js`、`sed -n 22,25p config.js` |
| E12 | 反代生效（行为） | 应用响应 | `GET https://mcuatlas.xyz/api/topics` → `{items:[],page:1,size:10,total:0}`；`GET …/api/admin/` → 「MCU 论坛审核台」 |
| E13 | 错误契约与审计版本一致 | 应用响应 | `GET …/api/me` → `error.code=NO_TOKEN`；`GET …/api/topics?category=bogus` → `error.code=BAD_CATEGORY`（与 `users.js:47`、`topics.js:71` 字面一致） |
| E14 | 线上客户端注册前置 | 静态资源 | `GET https://mcuatlas.xyz/assets/js/forum.js` 特征核对（含 `mcu_forum_device_id`；`api()`→`ensureToken()`→`register()`；`Math.random`） |
| E15 | 注册请求 20 次、0 次 429、10-13 5/5 占满 | 服务日志 | `journalctl -u mcu-forum-api --since 2026-09-15 \| grep me/register`、`… \| grep me/register \| grep 429 \| wc -l` |

---

## 8. 未检查项目及原因

| 项 | 原因 |
|---|---|
| 线上 Git HEAD | 部署目录非 Git 仓库，服务器未安装 git → 改以 17 个文件 SHA-256 + unit 文件比对替代（已达字节级） |
| `data/` 内密钥与数据库内容 | 任务明令禁止读取；仅确认目录存在（`Sep 15 15:12`） |
| 数据库实际行数、`reply_count` 是否已漂移（对应 D-01/D-02） | 需读库，禁止；且不在本轮范围 |
| 注册 429 的行为复现 | 任务明令禁止消耗生产注册额度；改以「代码 + 部署链路必然性 + 日志中 5/5 占满」三条证据定性 |
| 应用层是否读取 `X-Real-IP` | 已通过全仓 grep 与代码行确认**不读取**，无需运行时验证 |
| 宝塔面板 WAF / 云盾 / fail2ban 是否另有拦截 | 未核验（不属应用代码路径；若存在，可能额外限制注册频率，但不改变「单桶」结论） |
| Nginx `access_log` 内容 | 未读取（含 IP/UA，非必要；应用 journald 已足够） |
| `h5` 前端其余渲染逻辑、XSS 面 | 属另一项目范围，仅核对与本次结论相关的 `forum.js` 调用链特征 |
| `forum-e2e.cjs`（H5 UI 测试）运行状态 | 未运行；与 S-01 无关 |
| 证书有效期、DNS 解析链 | 与 S-01 无关，未检查（TLS 正常可用由 HTTPS 请求成功间接证明） |

---

## 9. 副作用声明

### 9.1 对生产的影响

| 动作 | 次数 | 副作用 |
|---|---|---|
| SSH 只读命令 | 6 个会话 | 仅读取（`systemctl show/status`、`ss`、`ps`、`pgrep`、`sha256sum`、`sed -n`、`nginx -T`、`journalctl`、`ls`、`command -v`）。**未重启、未 reload、未改任何文件或配置**；`nginx -T` 为配置展开，不触发 reload |
| 外部 `GET /api/topics`（mcuatlas.xyz） | 1 | 应用内 1 次 `COUNT` + 1 次 `SELECT`（只读，空表）；`accessLog` 新增 1 行 |
| 外部 `GET /api/admin/`（mcuatlas.xyz） | 1 | 返回静态 HTML（1 次文件读）；`accessLog` 新增 1 行 |
| 外部 `GET /api/me`（无 token） | 1 | 401，**未触库**（`requireUser` 在查询前抛出）；日志 1 行 |
| 外部 `GET /api/topics?category=bogus&size=1000` | 1 | 400，**未触库**（分类校验早于 `COUNT`）；日志 1 行 |
| 外部 `GET /api/topics`（mcu.yaokaixin.top） | 1 | 同第 1 项 |
| 外部 `GET /assets/js/forum.js` | 1 | nginx 静态读，不触应用、不写日志到应用 |
| **注册请求** | **0** | **未消耗任何注册额度**：核查前后 `me/register` 日志仍为 20 行、429 仍为 0 |
| 数据库写入 / 审核动作 / 部署 | **0** | 无 |

应用日志可复核本轮的 5 次 API 访问（`uid=-`）：
`12:56:16 GET /api/topics 200` · `12:56:16 GET /api/admin/ 200` · `12:56:37 GET /api/me 401` · `12:56:38 GET /api/topics?category=bogus&size=1000 400` · `12:56:59 GET /api/topics 200`

### 9.2 本地影响

- 本报告为本轮**唯一新建文件**（`D:\SEO\发挥余热\论坛API线上部署与S-01风险核查报告V1.0.md`，位于非 Git 的工作区根目录）。
- **未修改、未删除、未暂存、未提交**任何项目文件；`漫威电影宇宙导航` 仓库状态与核查前一致。

---

## 10. 附：本轮顺带确认的两项现网事实（不改动既有结论）

1. **S-06 已在线生效**：`https://mcuatlas.xyz/api/admin/` 无需任何凭据即返回「MCU 论坛审核台」页面（低危，维持原评级）。
2. **论坛处于试运行状态**：`/api/topics` 返回 `total=0`（无已通过话题），历史注册 17 次、举报/回复链路无异常日志；因此 S-01 目前是**未被触发的可用性定时炸弹**，而非已发生的故障。

---

**报告结束。本轮只做核查，未做任何修复或变更。等待独立审查；未经明确授权，不进入修复阶段。**
