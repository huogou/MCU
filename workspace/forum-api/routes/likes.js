'use strict';
/* 点赞路由（幂等；仅 approved 内容可点赞；计数服务端原子更新）
 * POST   /api/topics/:id/like
 * DELETE /api/topics/:id/like
 * POST   /api/replies/:id/like
 * DELETE /api/replies/:id/like
 */
const crypto = require('crypto');
const db = require('../db/database');
const { json, httpError } = require('../lib/http');
const { requireUser } = require('../middleware/auth');
const rate = require('../middleware/rate-limit');
const { requireInteractableTopic } = require('./replies');

function isUniqueConflict(e) {
  return !!(e && (String(e.code || '').indexOf('SQLITE_CONSTRAINT') >= 0 ||
    String(e.message || '').indexOf('UNIQUE') >= 0));
}

function likeTarget(user, type, targetId, res) {
  rate.likeByUid(user.uid);
  const table = type === 'topic' ? 'forum_topics' : 'forum_replies';
  const target = db.getRow(`SELECT id, status FROM ${table} WHERE id = ?`, targetId);
  if (!target) throw httpError(404, 'NOT_FOUND', '内容不存在');
  if (target.status === 'deleted') throw httpError(410, 'CONTENT_DELETED', '内容已被删除');
  if (target.status !== 'approved') throw httpError(403, 'NOT_INTERACTABLE', '该内容当前不可互动');

  const likeId = `${user.uid}:${type}:${targetId}`;
  try {
    db.run('INSERT INTO forum_likes (id, user_id, target_type, target_id, created_at) VALUES (?,?,?,?,?)',
      likeId, user.uid, type, targetId, new Date().toISOString());
    db.run(`UPDATE ${table} SET like_count = like_count + 1 WHERE id = ?`, targetId);
  } catch (e) {
    if (!isUniqueConflict(e)) throw e;
    // 唯一约束冲突 → 已赞过，幂等返回当前状态（防重复点赞）
  }
  const row = db.getRow(`SELECT like_count FROM ${table} WHERE id = ?`, targetId);
  json(res, 200, { liked: true, likeCount: row.like_count });
}

function unlikeTarget(user, type, targetId, res) {
  rate.likeByUid(user.uid);
  const table = type === 'topic' ? 'forum_topics' : 'forum_replies';
  const target = db.getRow(`SELECT id, status FROM ${table} WHERE id = ?`, targetId);
  if (!target) throw httpError(404, 'NOT_FOUND', '内容不存在');
  if (target.status === 'deleted') throw httpError(410, 'CONTENT_DELETED', '内容已被删除');
  if (target.status !== 'approved') throw httpError(403, 'NOT_INTERACTABLE', '该内容当前不可互动');

  const likeId = `${user.uid}:${type}:${targetId}`;
  const del = db.run('DELETE FROM forum_likes WHERE id = ?', likeId);
  if (del.changes > 0) {
    db.run(`UPDATE ${table} SET like_count = CASE WHEN like_count > 0 THEN like_count - 1 ELSE 0 END WHERE id = ?`, targetId);
  }
  const row = db.getRow(`SELECT like_count FROM ${table} WHERE id = ?`, targetId);
  json(res, 200, { liked: false, likeCount: row.like_count }); // 未赞时取消 → 幂等
}

function register(route) {
  route('POST', /^\/api\/topics\/([A-Za-z0-9-]+)\/like$/, async (ctx) => {
    likeTarget(requireUser(ctx), 'topic', ctx.params[0], ctx.res);
  });
  route('DELETE', /^\/api\/topics\/([A-Za-z0-9-]+)\/like$/, async (ctx) => {
    unlikeTarget(requireUser(ctx), 'topic', ctx.params[0], ctx.res);
  });
  route('POST', /^\/api\/replies\/([A-Za-z0-9-]+)\/like$/, async (ctx) => {
    likeTarget(requireUser(ctx), 'reply', ctx.params[0], ctx.res);
  });
  route('DELETE', /^\/api\/replies\/([A-Za-z0-9-]+)\/like$/, async (ctx) => {
    unlikeTarget(requireUser(ctx), 'reply', ctx.params[0], ctx.res);
  });
}

module.exports = { register };
