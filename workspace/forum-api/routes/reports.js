'use strict';
/* 举报路由（同一用户对同一对象仅一次；仅 approved 内容可举报）
 * POST /api/topics/:id/report
 * POST /api/replies/:id/report
 */
const crypto = require('crypto');
const config = require('../config');
const db = require('../db/database');
const { json, httpError } = require('../lib/http');
const { requireUser } = require('../middleware/auth');
const rate = require('../middleware/rate-limit');
const { requireInteractableTopic } = require('./replies');

function isUniqueConflict(e) {
  return !!(e && (String(e.code || '').indexOf('SQLITE_CONSTRAINT') >= 0 ||
    String(e.message || '').indexOf('UNIQUE') >= 0));
}

function report(user, type, targetId, reason, res) {
  rate.reportByUid(user.uid);
  if (type === 'topic') {
    requireInteractableTopic(targetId);
  } else {
    const reply = db.getRow('SELECT id, status FROM forum_replies WHERE id = ?', targetId);
    if (!reply) throw httpError(404, 'NOT_FOUND', '内容不存在');
    if (reply.status === 'deleted') throw httpError(410, 'CONTENT_DELETED', '内容已被删除');
    if (reply.status !== 'approved') throw httpError(403, 'NOT_INTERACTABLE', '该内容当前不可互动');
  }
  if (!config.REPORT_REASONS.includes(reason)) {
    throw httpError(400, 'BAD_REASON', '举报原因不在允许范围');
  }
  try {
    db.run(
      'INSERT INTO forum_reports (id, target_type, target_id, reporter_id, reason, status, created_at) VALUES (?,?,?,?,?, ?,?)',
      crypto.randomUUID(), type, targetId, user.uid, reason, 'open', new Date().toISOString()
    );
  } catch (e) {
    if (isUniqueConflict(e)) throw httpError(409, 'ALREADY_REPORTED', '你已举报过此内容');
    throw e;
  }
  json(res, 201, { reported: true });
}

function register(route) {
  route('POST', /^\/api\/topics\/([A-Za-z0-9-]+)\/report$/, async (ctx) => {
    const user = requireUser(ctx);
    const reason = ctx.body && typeof ctx.body.reason === 'string' ? ctx.body.reason.trim() : '';
    report(user, 'topic', ctx.params[0], reason, ctx.res);
  });
  route('POST', /^\/api\/replies\/([A-Za-z0-9-]+)\/report$/, async (ctx) => {
    const user = requireUser(ctx);
    const reason = ctx.body && typeof ctx.body.reason === 'string' ? ctx.body.reason.trim() : '';
    report(user, 'reply', ctx.params[0], reason, ctx.res);
  });
}

module.exports = { register };
