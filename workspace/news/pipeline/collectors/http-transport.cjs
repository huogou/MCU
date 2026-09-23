/* ============================================================
 * collectors · http-transport.cjs（G5.3）
 * ------------------------------------------------------------
 * 定位：**独立**的真实联网取数通道。**默认关闭**，仅在调用侧显式开启：
 *     collect(id, { transport: createHttpTransport(opts).transport })
 *   未显式注入时，采集器仍走 local 夹具通道（G5.2 的默认行为不变）。
 *
 * 必须具备（任务书 §3，五条，缺一不可）：
 *   1. **User-Agent 声明**   —— 可识别的机器人 UA，含项目域名
 *   2. **timeout**          —— 单请求超时（默认 15s）
 *   3. **retry**            —— 有限重试（默认 2 次，指数退避；4xx 不重试，429 除外）
 *   4. **rate limit**       —— 同 host 最小请求间隔（默认 1.5s）
 *   5. **robots 策略记录**   —— 抓取前审计 robots.txt 并**留档**；被 disallow 则拒绝抓取
 *
 * 且**禁止无限循环抓取**：
 *   · 单次运行请求总数上限（默认 40）
 *   · 重定向层数上限（默认 5）
 *   · 重试次数上限（默认 2）
 *   任一超限 → 抛错终止该来源，不继续尝试。
 *
 * ★ 本模块是**唯一**允许发起网络请求的模块；其余采集层模块保持零网络。
 * ============================================================ */
'use strict';

const https = require('https');
const http = require('http');

const UA = 'MCUAtlasBot/1.0 (+https://mcu.yaokaixin.top/)';
const UA_TOKEN = 'mcuatlasbot';          /* 用于 robots 组匹配 */

const DEFAULTS = {
  timeoutMs: 15000,
  maxRetries: 2,
  backoffMs: 1500,
  minIntervalPerHostMs: 1500,
  maxRequestsPerRun: 40,
  maxRedirects: 5,
  userAgent: UA,
  auditRobots: true
};

const RETRY_STATUS = [429, 500, 502, 503, 504];

function fail(code, message) {
  const e = new Error('[' + code + '] ' + message);
  e.code = code;
  throw e;
}

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

function originOf(u) {
  const m = /^(https?):\/\/([^\/?#]+)/i.exec(String(u || ''));
  return m ? (m[1].toLowerCase() + '://' + m[2].toLowerCase()) : '';
}
function hostOf(u) {
  const m = /^(https?):\/\/([^\/?#]+)/i.exec(String(u || ''));
  return m ? m[2].toLowerCase().replace(/:\d+$/, '') : '';
}
function pathOf(u) {
  const m = /^(https?):\/\/([^\/?#]+)([^?#]*)/i.exec(String(u || ''));
  return m ? (m[3] || '/') : '/';
}

/* ---------------- robots.txt 解析与匹配 ---------------- */

/** 极简 robots.txt 解析：返回 [{agents:[], allow:[], disallow:[]}] 与具名 AI 机器人清单 */
function parseRobots(text) {
  const groups = [];
  const named = [];
  let cur = null, lastWasAgent = false;
  String(text || '').split(/\r?\n/).forEach(function (raw) {
    const line = raw.replace(/#.*$/, '').trim();
    if (!line) return;
    const i = line.indexOf(':');
    if (i < 0) return;
    const field = line.slice(0, i).trim().toLowerCase();
    const value = line.slice(i + 1).trim();
    if (field === 'user-agent') {
      if (!cur || !lastWasAgent) { cur = { agents: [], allow: [], disallow: [] }; groups.push(cur); }
      cur.agents.push(value.toLowerCase());
      lastWasAgent = true;
      if (value && value !== '*' && named.indexOf(value.toLowerCase()) < 0) named.push(value.toLowerCase());
      return;
    }
    lastWasAgent = false;
    if (!cur) { cur = { agents: ['*'], allow: [], disallow: [] }; groups.push(cur); }
    if (field === 'allow') cur.allow.push(value);
    if (field === 'disallow') cur.disallow.push(value);
  });
  return { groups: groups, named_agents: named };
}

/** 命中规则：优先匹配具名组，否则通配组；最长匹配优先，Allow 平局胜出 */
function matchRobots(parsed, path) {
  const pick = function (agentToken) {
    let g = null;
    parsed.groups.forEach(function (x) {
      if (g === null && x.agents.indexOf(agentToken) >= 0) g = x;
    });
    if (!g) {
      parsed.groups.forEach(function (x) {
        if (g === null && x.agents.indexOf('*') >= 0) g = x;
      });
    }
    return g;
  };
  const g = pick(UA_TOKEN) || pick('*');
  if (!g) return { allowed: true, rule: '', matched: 'no-group' };
  const cands = [];
  g.allow.forEach(function (p) { if (p && path.indexOf(p) === 0) cands.push({ p: p, allow: true }); });
  g.disallow.forEach(function (p) { if (p && path.indexOf(p) === 0) cands.push({ p: p, allow: false }); });
  if (!cands.length) return { allowed: true, rule: '', matched: 'no-rule' };
  cands.sort(function (a, b) { return b.p.length - a.p.length; });
  const top = cands[0];
  return { allowed: top.allow, rule: top.p, matched: 'rule' };
}

/* ---------------- 底层请求 ---------------- */

/** 单次 GET（不重定向、不重试）；返回 {status, body, contentType, headers} */
function rawGet(url, opts) {
  return new Promise(function (resolve, reject) {
    const lib = /^https:/i.test(url) ? https : http;
    const req = lib.get(url, { headers: { 'User-Agent': opts.userAgent, 'Accept': 'application/rss+xml, application/atom+xml, application/json, text/html;q=0.8, */*;q=0.5' }, timeout: opts.timeoutMs }, function (res) {
      let n = 0;
      const chunks = [];
      res.on('data', function (c) {
        n += c.length;
        if (n > 5 * 1024 * 1024) { req.destroy(); reject(Object.assign(new Error('响应体超过 5MB 上限'), { code: 'BODY_TOO_LARGE' })); return; }
        chunks.push(c);
      });
      res.on('end', function () {
        resolve({
          status: res.statusCode,
          body: Buffer.concat(chunks).toString('utf8'),
          contentType: String(res.headers['content-type'] || ''),
          location: String(res.headers.location || '')
        });
      });
    });
    req.on('timeout', function () { req.destroy(); reject(Object.assign(new Error('请求超时'), { code: 'ETIMEDOUT' })); });
    req.on('error', function (e) { reject(Object.assign(e, { code: e.code || 'ENETWORK' })); });
  });
}

function absolute(base, loc) {
  if (/^https?:\/\//i.test(loc)) return loc;
  const m = /^(https?:\/\/[^\/?#]+)/i.exec(base);
  const o = m ? m[1] : '';
  return o + (loc.charAt(0) === '/' ? loc : '/' + loc);
}

/* ---------------- 工厂 ---------------- */

/**
 * 创建带完整合规控制的 http transport。
 * @param {object} options 覆盖 DEFAULTS
 * @returns {{transport:Function, summary:Function, state:object, robotsRecords:object}}
 */
function createHttpTransport(options) {
  const o = Object.assign({}, DEFAULTS, options || {});
  const state = { requests: 0, by_host: {}, last_at: {}, timeouts: 0, retries: 0, redirects: 0, errors: [], denied_urls: [] };
  const robotsRecords = {};   /* origin → 审计记录（每次运行只取一次） */

  function budget() {
    if (state.requests >= o.maxRequestsPerRun) {
      fail('REQUEST_BUDGET_EXCEEDED',
        '单次运行请求数已达上限 ' + o.maxRequestsPerRun + '（禁止无限循环抓取）');
    }
  }

  async function rateLimit(host) {
    const last = state.last_at[host] || 0;
    const wait = o.minIntervalPerHostMs - (Date.now() - last);
    if (wait > 0) await sleep(wait);
    state.last_at[host] = Date.now();
  }

  /** 带重试 + 重定向跟随的 GET */
  async function getWithRetry(url, depth) {
    const host = hostOf(url);
    let attempt = 0, lastErr = null;
    while (attempt <= o.maxRetries) {
      budget();
      await rateLimit(host);
      state.requests++;
      state.by_host[host] = (state.by_host[host] || 0) + 1;
      try {
        const res = await rawGet(url, o);
        if (res.status >= 300 && res.status < 400 && res.location) {
          if ((depth || 0) >= o.maxRedirects) fail('TOO_MANY_REDIRECTS', '重定向层数超过 ' + o.maxRedirects);
          state.redirects++;
          return await getWithRetry(absolute(url, res.location), (depth || 0) + 1);
        }
        if (RETRY_STATUS.indexOf(res.status) >= 0 && attempt < o.maxRetries) {
          attempt++; state.retries++;
          await sleep(o.backoffMs * attempt);
          continue;
        }
        return res;
      } catch (e) {
        lastErr = e;
        if (['REQUEST_BUDGET_EXCEEDED', 'TOO_MANY_REDIRECTS'].indexOf(e.code) >= 0) throw e;
        if (e.code === 'ETIMEDOUT') state.timeouts++;
        if (attempt < o.maxRetries) { attempt++; state.retries++; await sleep(o.backoffMs * attempt); continue; }
        throw e;
      }
    }
    throw lastErr || new Error('请求失败');
  }

  /** robots 审计（每 origin 一次，留档） */
  async function auditRobots(targetUrl) {
    const origin = originOf(targetUrl);
    if (!origin) return { status: 0, policy: 'allow', note: 'origin 解析失败' };
    if (robotsRecords[origin]) return robotsRecords[origin];
    const rUrl = origin + '/robots.txt';
    let rec = { url: rUrl, origin: origin, status: 0, bytes: 0, fetched_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'), policy: 'allow', matched_rule: '', named_agents: [], note: '' };
    try {
      const res = await getWithRetry(rUrl, 0);
      rec.status = res.status;
      rec.bytes = res.body.length;
      if (res.status === 200 && res.body) {
        const parsed = parseRobots(res.body);
        rec.named_agents = parsed.named_agents.slice(0, 40);
        const m = matchRobots(parsed, pathOf(targetUrl));
        rec.matched = m.matched;
        rec.matched_rule = m.rule;
        rec.policy = m.allowed ? 'allow' : 'disallow';
      } else if (res.status === 404) {
        rec.note = 'robots.txt 不存在（404）→ 按允许处理';
      } else {
        rec.note = 'robots.txt 状态 ' + res.status + ' → 保守按允许处理但记录在案';
      }
    } catch (e) {
      rec.note = 'robots.txt 获取失败：' + (e.code || e.message);
      rec.policy = 'unknown';
    }
    robotsRecords[origin] = rec;
    return rec;
  }

  /** 采集器取数接口（与 localTransport 同签名） */
  async function transport(source, opts2) {
    const url = (opts2 && opts2.url) || source.feed_url;
    if (!/^https?:\/\//i.test(url)) fail('INVALID_URL', '非 http(s) URL：' + url);

    let robots = { policy: 'skipped' };
    if (o.auditRobots) {
      robots = await auditRobots(url);
      if (robots.policy === 'disallow') {
        state.denied_urls.push(url);
        fail('ROBOTS_DISALLOW', 'robots.txt 命中 Disallow（规则 ' + robots.matched_rule + '）→ 拒绝抓取：' + url);
      }
    }

    const res = await getWithRetry(url, 0);
    if (res.status >= 400) {
      const code = res.status === 403 ? 'HTTP_FORBIDDEN' : (res.status === 404 ? 'HTTP_NOT_FOUND' : 'HTTP_ERROR');
      fail(code, 'HTTP ' + res.status + '：' + url);
    }
    return {
      status: res.status,
      body: res.body,
      contentType: res.contentType,
      fetched_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
      url: url,
      transport: 'http',
      robots: robots
    };
  }

  function summary() {
    return {
      user_agent: o.userAgent,
      limits: {
        timeout_ms: o.timeoutMs, max_retries: o.maxRetries,
        min_interval_per_host_ms: o.minIntervalPerHostMs,
        max_requests_per_run: o.maxRequestsPerRun, max_redirects: o.maxRedirects
      },
      requests: state.requests,
      by_host: state.by_host,
      retries: state.retries,
      timeouts: state.timeouts,
      redirects: state.redirects,
      denied_urls: state.denied_urls,
      robots_records: robotsRecords
    };
  }

  return { transport: transport, summary: summary, state: state, robotsRecords: robotsRecords, options: o };
}

module.exports = {
  UA,
  UA_TOKEN,
  DEFAULTS,
  RETRY_STATUS,
  parseRobots,
  matchRobots,
  originOf,
  hostOf,
  pathOf,
  createHttpTransport
};
