'use strict';
/* 回复路由（一层回复，无楼中楼；先审后发）
 * GET  /api/topics/:id/replies   公开回复列表（仅 approved；floor 展示时计算）
 * POST /api/topics/:id/replies   回复（话题必须 approved；恒为 pending）
 * GET  /api/me/replies           我的回复（排除 deleted，附原帖标题）
 */
const crypto = require('crypto');
const config = require('../config');
const db = require('../db/database');
const { json, httpError, charLen } = require('../lib/http');
const { requireUser, maybeRenew } = require('../middleware/auth');
const rate = require('../middleware/rate-limit');
const { topicVisibility, likedIdsFor } = require('./topics');

function replyOut(row, likedSet, idx) {
  return {
    id: row.id,
    topicId: row.topic_id,
    content: row.content,
    status: row.status,
    likeCount: row.like_count,
    floor: idx != null ? idx : row.floor, // 公开列表按可见序计算；me 列表无序号
    createdAt: row.created_at,
    liked: likedSet ? likedSet.has(row.id) : false,
    author: { name: row.nickname || '匿名影迷', avatar: row.avatar || 'a00' },
  };
}

/* 话题互动前置：deleted→410；其余非 approved→403（不可互动）；不存在→404 */
function requireInteractableTopic(topicId) {
  const topic = db.getRow('SELECT id, status FROM forum_topics WHERE id = ?', topicId);
  if (!topic) throw httpError(404, 'NOT_FOUND', '话题不存在');
  if (topic.status === 'deleted') throw httpError(410, 'TOPIC_DELETED', '此话题已被删除');
  if (topic.status !== 'approved') throw httpError(403, 'NOT_INTERACTABLE', '该话题当前不可互动');
  return topic;
}

function register(route) {
  route('GET', /^\/api\/topics\/([A-Za-z0-9-]+)\/replies$/, async (ctx) => {
    maybeRenew(ctx, ctx.res);
    const topicId = ctx.params[0];
    const topic = db.getRow('SELECT * FROM forum_topics WHERE id = ?', topicId);
    const v = topicVisibility(topic, ctx.user);
    if (v === 'notfound' || v === 'hidden') throw httpError(404, 'NOT_FOUND', '话题不存在');
    if (v === 'deleted') throw httpError(410, 'TOPIC_DELETED', '此话题已被删除');
    const page = Math.max(1, parseInt(ctx.query.get('page') || '1', 10) || 1);
    const size = Math.min(50, Math.max(1, parseInt(ctx.query.get('size') || '20', 10) || 20));
    const rows = db.all(
      `SELECT r.*, u.nickname, u.avatar FROM forum_replies r
       JOIN forum_users u ON u.id = r.author_id
       WHERE r.topic_id = ? AND r.status = 'approved'
       ORDER BY r.created_at ASC, r.rowid ASC LIMIT ? OFFSET ?`,
      topicId, size, (page - 1) * size
    );
    const liked = likedIdsFor(ctx.user && ctx.user.uid, 'reply', rows.map((r) => r.id));
    json(ctx.res, 200, {
      items: rows.map((r, i) => replyOut(r, liked, (page - 1) * size + i + 1)),
      page, size,
    });
  });

  route('POST', /^\/api\/topics\/([A-Za-z0-9-]+)\/replies$/, async (ctx) => {
    const user = requireUser(ctx);
    rate.replyByUid(user.uid);
    requireInteractableTopic(ctx.params[0]); // 仅 approved 话题可回复
    const me = db.getRow('SELECT nickname FROM forum_users WHERE id = ?', user.uid);
    if (!me || !me.nickname) throw httpError(403, 'PROFILE_REQUIRED', '请先设置昵称与头像');
    if (ctx.body && typeof ctx.body.author_id === 'string') {
      throw httpError(400, 'FORBIDDEN_FIELD', 'author_id 由服务端决定，不接受客户端提交');
    }
    const content = typeof ctx.body.content === 'string' ? ctx.body.content.trim() : '';
    if (!content || charLen(content) > config.REPLY_MAX) {
      throw httpError(400, 'BAD_CONTENT', '回复需为 1-' + config.REPLY_MAX + ' 字');
    }
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    db.run(
      `INSERT INTO forum_replies (id, topic_id, author_id, content, status, like_count, created_at, updated_at)
       VALUES (?,?,?,?, 'pending', 0, ?, ?)`,
      id, ctx.params[0], user.uid, content, now, now
    );
    json(ctx.res, 201, { id, status: 'pending' }); // 先审后发：恒为 pending
  });

  route('GET', /^\/api\/me\/replies$/, async (ctx) => {
    const user = requireUser(ctx);
    maybeRenew(ctx, ctx.res);
    const rows = db.all(
      `SELECT r.*, t.title AS topic_title, t.status AS topic_status, u.nickname, u.avatar
       FROM forum_replies r
       JOIN forum_topics t ON t.id = r.topic_id
       JOIN forum_users u ON u.id = r.author_id
       WHERE r.author_id = ? AND r.status != 'deleted'
       ORDER BY r.created_at DESC LIMIT 100`, user.uid
    );
    const liked = likedIdsFor(user.uid, 'reply', rows.map((r) => r.id));
    json(ctx.res, 200, {
      items: rows.map((r) => {
        const out = replyOut(r, liked, null);
        out.topicTitle = r.topic_title;
        out.topicStatus = r.topic_status;
        return out;
      }),
    });
  });
}

module.exports = { register, requireInteractableTopic };
