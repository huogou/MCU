'use strict';
/* 中间件：请求身份解析
 * - resolveUser：解析 Authorization: Bearer，返回 {uid, token, exp} 或 null（不抛错）
 * - requireUser：无有效身份直接 401
 * - maybeRenew：token 剩余期 <30 天时，在响应头下发新 token（X-Renewed-Token）
 */
const { httpError } = require('../lib/http');
const { verifyToken, signToken } = require('../auth/token');
const config = require('../config');

function resolveUser(req) {
  const auth = req.headers.authorization || '';
  const m = /^Bearer\s+(.+)$/i.exec(auth);
  if (!m) return null;
  const payload = verifyToken(m[1].trim());
  if (!payload) return null;
  return { uid: payload.uid, exp: payload.exp };
}

function requireUser(ctx) {
  if (!ctx.user) throw httpError(401, 'NO_TOKEN', '需要有效身份 token');
  return ctx.user;
}

function maybeRenew(ctx, res) {
  if (!ctx.user) return;
  if (ctx.user.exp - Date.now() < config.TOKEN_RENEW_AHEAD_MS) {
    res.setHeader('X-Renewed-Token', signToken(ctx.user.uid, Date.now()));
  }
}

module.exports = { resolveUser, requireUser, maybeRenew };
