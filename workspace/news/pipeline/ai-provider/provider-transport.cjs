/* ============================================================
 * N1.2 U1 · Provider Transport（P11：独立 Provider 网络出口）
 * ------------------------------------------------------------
 * 与「采集层 http-transport（collectors/）」**概念分离**：
 *   - 采集层 transport = 取新闻源；本模块 = AI 推理出口。
 *   - 二者不合并为「无边界统一 transport」。
 *
 * 合规要求（§9 / §12 / §21）：
 *   - timeout = 15s；retry ≤ 2；**仅瞬态错误**允许 retry；
 *   - 401/403/400/invalid key/invalid model/invalid request/schema 错误 → **不 retry**；
 *   - 不记录 Authorization；不记录完整请求体；不记录完整响应体；
 *   - 只暴露计数/状态/错误码，不暴露任何凭据。
 * ============================================================ */
'use strict';

const https = require('https');

const DEFAULTS = {
  timeoutMs: 15000,
  maxRetries: 2,
  backoffMs: 800,
  userAgent: 'MCUAtlas-ProviderBot/1.0 (+https://mcuatlas.xyz/)'
};

function fail(code, message) {
  const e = new Error('[' + code + '] ' + message);
  e.code = code;
  throw e;
}
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

/* 瞬态状态码：仅 5xx 与 429 允许 retry */
function isTransientStatus(s) { return (s >= 500 && s <= 599) || s === 429; }
/* 瞬态网络错误码 */
function isTransientCode(c) {
  return ['ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED', 'EAI_AGAIN', 'ENETUNREACH', 'EPIPE']
    .indexOf(String(c)) >= 0;
}

/** 单次 POST（不重试） */
function once(url, headers, bodyStr, o) {
  return new Promise(function (resolve, reject) {
    let u;
    try { u = new URL(url); } catch (e) { return reject(Object.assign(new Error('URL 非法'), { code: 'INVALID_URL' })); }
    const req = https.request({
      hostname: u.hostname,
      port: u.port || 443,
      path: u.pathname + (u.search || ''),
      method: 'POST',
      headers: Object.assign({
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr),
        'User-Agent': o.userAgent
      }, headers || {}),
      timeout: o.timeoutMs
    }, function (res) {
      let n = 0; const chunks = [];
      res.on('data', function (c) {
        n += c.length;
        if (n > 2 * 1024 * 1024) { req.destroy(); reject(Object.assign(new Error('响应体超限'), { code: 'RESPONSE_TOO_LARGE' })); return; }
        chunks.push(c);
      });
      res.on('end', function () { resolve({ status: res.statusCode, text: Buffer.concat(chunks).toString('utf8') }); });
    });
    req.on('timeout', function () { req.destroy(); reject(Object.assign(new Error('Provider 请求超时'), { code: 'ETIMEDOUT' })); });
    req.on('error', function (e) { reject(Object.assign(e, { code: e.code || 'ENETWORK' })); });
    req.write(bodyStr);
    req.end();
  });
}

/**
 * 创建 Provider transport。
 * @param {object} options 覆盖 DEFAULTS
 * @returns {{postJson:Function, summary:Function, state:object}}
 */
function createProviderTransport(options) {
  const o = Object.assign({}, DEFAULTS, options || {});
  const state = { requests: 0, retries: 0, timeouts: 0, last_status: null, error_codes: [] };

  /**
   * POST JSON（带受控重试）。
   * @returns {Promise<{status:number, text:string, attempts:number}>}
   */
  async function postJson(url, headers, bodyObj) {
    const bodyStr = JSON.stringify(bodyObj);
    let attempt = 0, lastErr = null;
    while (attempt <= o.maxRetries) {
      state.requests++;
      try {
        const res = await once(url, headers, bodyStr, o);
        state.last_status = res.status;
        if (isTransientStatus(res.status) && attempt < o.maxRetries) {
          attempt++; state.retries++; await sleep(o.backoffMs * attempt); continue;
        }
        return { status: res.status, text: res.text, attempts: attempt + 1 };
      } catch (e) {
        lastErr = e;
        if (e.code === 'ETIMEDOUT') state.timeouts++;
        if (isTransientCode(e.code) && attempt < o.maxRetries) {
          attempt++; state.retries++; await sleep(o.backoffMs * attempt); continue;
        }
        state.error_codes.push(e.code || 'ENETWORK');
        throw e;
      }
    }
    throw lastErr || new Error('Provider 请求失败');
  }

  /* 只暴露计数与状态，绝不含凭据 / payload / response */
  function summary() {
    return {
      user_agent: o.userAgent,
      limits: { timeout_ms: o.timeoutMs, max_retries: o.maxRetries },
      requests: state.requests,
      retries: state.retries,
      timeouts: state.timeouts,
      last_status: state.last_status,
      error_codes: state.error_codes.slice()
    };
  }

  return { postJson: postJson, summary: summary, state: state };
}

module.exports = { createProviderTransport, DEFAULTS, isTransientStatus, isTransientCode };
