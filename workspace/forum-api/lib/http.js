'use strict';
/* HTTP 层小工具：JSON 响应 / 请求体读取 / Bearer 解析 / 错误构造 */

function json(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) {
        reject(httpError(413, 'BODY_TOO_LARGE', '请求体超出限制'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function parseBearer(req) {
  const h = req.headers.authorization || '';
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m ? m[1].trim() : null;
}

function httpError(status, code, message) {
  const e = new Error(message || code);
  e.status = status;
  e.code = code;
  return e;
}

/* 按 Unicode 字符计长（emoji/扩展区不裂） */
function charLen(s) {
  return Array.from(s).length;
}
function charSlice(s, n) {
  return Array.from(s).slice(0, n).join('');
}

module.exports = { json, readBody, parseBearer, httpError, charLen, charSlice };
