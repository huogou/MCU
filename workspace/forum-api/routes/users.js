'use strict';
/* 用户身份与资料路由
 * POST /api/me/register  设备首次建号（deviceId 弱幂等）→ 签发 token
 * GET  /api/me           当前身份资料
 * POST /api/me/profile   设置昵称 + 预设头像（发帖/回复前置条件）
 */
const crypto = require('crypto');
const config = require('../config');
const db = require('../db/database');
const { json, httpError, charLen } = require('../lib/http');
const { requireUser, maybeRenew } = require('../middleware/auth');
const rate = require('../middleware/rate-limit');
const { signToken } = require('../auth/token');

function profileOf(row) {
  return { nickname: row ? row.nickname : null, avatar: row ? row.avatar : null };
}

function register(route) {
  route('POST', /^\/api\/me\/register$/, async (ctx) => {
    rate.registerByIp(ctx.ip || 'unknown');
    const deviceId = ctx.body && typeof ctx.body.deviceId === 'string' ? ctx.body.deviceId.trim() : '';
    if (!config.DEVICE_ID_RE.test(deviceId)) {
      throw httpError(400, 'BAD_DEVICE_ID', 'deviceId 格式非法');
    }
    const now = new Date().toISOString();
    const existing = db.getRow('SELECT * FROM forum_users WHERE device_id = ?', deviceId);
    let uid;
    if (existing) {
      uid = existing.id; // 弱幂等：同设备重复 register 不重复建号
    } else {
      uid = crypto.randomUUID();
      db.run(
        'INSERT INTO forum_users (id, device_id, nickname, avatar, created_at, updated_at) VALUES (?,?,?,?,?,?)',
        uid, deviceId, null, null, now, now
      );
    }
    const token = signToken(uid, Date.now());
    const row = db.getRow('SELECT nickname, avatar FROM forum_users WHERE id = ?', uid);
    json(ctx.res, 200, { uid, token, profile: profileOf(row) });
  });

  route('GET', /^\/api\/me$/, async (ctx) => {
    const user = requireUser(ctx);
    maybeRenew(ctx, ctx.res);
    const row = db.getRow('SELECT id, nickname, avatar, created_at FROM forum_users WHERE id = ?', user.uid);
    if (!row) throw httpError(401, 'IDENTITY_GONE', '身份不存在');
    json(ctx.res, 200, { uid: row.id, profile: profileOf(row), createdAt: row.created_at });
  });

  route('POST', /^\/api\/me\/profile$/, async (ctx) => {
    const user = requireUser(ctx);
    maybeRenew(ctx, ctx.res);
    rate.profileByUid(user.uid);
    const nickname = ctx.body && typeof ctx.body.nickname === 'string' ? ctx.body.nickname.trim() : '';
    const avatar = ctx.body && typeof ctx.body.avatar === 'string' ? ctx.body.avatar.trim() : '';
    if (!nickname || charLen(nickname) > config.NICKNAME_MAX) {
      throw httpError(400, 'BAD_NICKNAME', '昵称需为 1-' + config.NICKNAME_MAX + ' 个字符');
    }
    if (!config.AVATAR_RE.test(avatar)) {
      throw httpError(400, 'BAD_AVATAR', '头像必须为预设标识（a01~a99）');
    }
    const row = db.getRow('SELECT id FROM forum_users WHERE id = ?', user.uid);
    if (!row) throw httpError(401, 'IDENTITY_GONE', '身份不存在');
    db.run('UPDATE forum_users SET nickname = ?, avatar = ?, updated_at = ? WHERE id = ?',
      nickname, avatar, new Date().toISOString(), user.uid);
    json(ctx.res, 200, { uid: user.uid, profile: { nickname, avatar } });
  });
}

module.exports = { register, profileOf };
