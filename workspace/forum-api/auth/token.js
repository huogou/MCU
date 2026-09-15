'use strict';
/* 身份层：匿名用户 token 签发与校验
 * - token = base64url(payload{uid,iat,exp}) + '.' + HMAC-SHA256(base64url)
 * - 设备 UUID 仅在注册时作弱幂等键，不参与任何后续鉴权（非可信凭据）
 * - 管理端 token 与用户 token 完全隔离，均由服务端首次启动自动生成
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const config = require('../config');

let SECRET = null;

function ensureFile(filePath, generator, mode) {
  try {
    return fs.readFileSync(filePath, 'utf8').trim();
  } catch (e) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true }); // 目录自保证，不依赖调用顺序
    const v = generator();
    fs.writeFileSync(filePath, v + '\n', { mode });
    try { fs.chmodSync(filePath, mode); } catch (e2) {}
    return v;
  }
}

function initSecrets() {
  SECRET = ensureFile(config.SECRET_PATH, () => crypto.randomBytes(32).toString('hex'), 0o600);
  getAdminToken(); // 启动即生成 admin token 文件，不依赖首个管理请求
}

function signToken(uid, nowMs) {
  const payload = { uid, iat: nowMs, exp: nowMs + config.TOKEN_TTL_MS };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const mac = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  return body + '.' + mac;
}

function verifyToken(token) {
  if (typeof token !== 'string' || token.length < 16) return null;
  const i = token.lastIndexOf('.');
  if (i <= 0) return null;
  const body = token.slice(0, i);
  const mac = Buffer.from(token.slice(i + 1));
  const expect = Buffer.from(crypto.createHmac('sha256', SECRET).update(body).digest('base64url'));
  if (mac.length !== expect.length || !crypto.timingSafeEqual(mac, expect)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!payload || typeof payload.uid !== 'string' || typeof payload.exp !== 'number') return null;
    if (payload.exp < Date.now()) return null;
    return payload; // {uid, iat, exp}
  } catch (e) {
    return null;
  }
}

function getAdminToken() {
  return ensureFile(config.ADMIN_TOKEN_PATH, () => crypto.randomBytes(24).toString('base64url'), 0o600);
}

/* 管理端鉴权：恒时比较 */
function isAdminToken(given) {
  if (typeof given !== 'string' || !given) return false;
  const actual = getAdminToken();
  const a = Buffer.from(given);
  const b = Buffer.from(actual);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = { initSecrets, signToken, verifyToken, getAdminToken, isAdminToken };
