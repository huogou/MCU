'use strict';
/* 管理路由（极简审核后台的 API 侧）
 * 鉴权：独立 admin token（服务端 data/admin-token.key），与用户 token 完全隔离
 * GET  /api/admin/topics?status=&page=    审核列表
 * GET  /api/admin/replies?status=&page=
 * POST /api/admin/topics/:id/approve|reject|hide|restore|delete
 * POST /api/admin/replies/:id/approve|reject|hide|restore|delete
 *
 * 状态机（拍板指令第七节）：
 *   pending  → approved | rejected | deleted
 *   approved → hidden | deleted
 *   rejected → deleted
 *   hidden   → approved（恢复） | deleted
 *   deleted  → 终态，任何转换非法
 * 计数口径：reply_count 仅在 reply pending→approved 时 +1、approved→deleted 时 -1；
 *          hidden 期间保留计数（恢复无损）。
 */
const db = require('../db/database');
const { json, parseBearer, httpError } = require('../lib/http');
const { isAdminToken } = require('../auth/token');

const TRANSITIONS = {
  approve: ['pending'],
  reject:  ['pending'],
  hide:    ['approved'],
  restore: ['hidden'],
  delete:  ['pending', 'approved', 'rejected', 'hidden'],
};
const TARGET_OF = { approve: 'approved', reject: 'rejected', hide: 'hidden', restore: 'approved', delete: 'deleted' };

function requireAdmin(req) {
  const token = parseBearer(req);
  if (!token || !isAdminToken(token)) {
    throw httpError(401, 'ADMIN_UNAUTHORIZED', '管理鉴权失败');
  }
}

function adminList(kind, ctx) {
  const status = ctx.query.get('status') || 'pending';
  if (!['pending', 'approved', 'rejected', 'hidden', 'deleted'].includes(status)) {
    throw httpError(400, 'BAD_STATUS', 'status 取值非法');
  }
  const page = Math.max(1, parseInt(ctx.query.get('page') || '1', 10) || 1);
  const size = 20;
  const table = kind === 'topics' ? 'forum_topics' : 'forum_replies';
  const total = db.getRow(`SELECT COUNT(*) AS c FROM ${table} WHERE status = ?`, status).c;
  const rows = db.all(
    `SELECT x.*, u.nickname, u.avatar FROM ${table} x
     JOIN forum_users u ON u.id = x.author_id
     WHERE x.status = ? ORDER BY x.created_at ASC LIMIT ? OFFSET ?`,
    status, size, (page - 1) * size
  );
  const items = rows.map((r) => ({
    id: r.id,
    type: kind === 'topics' ? 'topic' : 'reply',
    title: r.title || null,
    content: r.content,
    excerpt: r.excerpt || null,
    category: r.category || null,
    status: r.status,
    createdAt: r.created_at,
    author: { name: r.nickname || '匿名影迷', avatar: r.avatar || 'a00' },
    ...(kind === 'replies' ? { topicId: r.topic_id } : {}),
  }));
  json(ctx.res, 200, { items, page, size, total });
}

function transition(kind, action, id, res) {
  const fromList = TRANSITIONS[action];
  if (!fromList) throw httpError(404, 'NOT_FOUND', '未知操作');
  const to = TARGET_OF[action];
  const table = kind === 'topics' ? 'forum_topics' : 'forum_replies';
  const row = db.getRow(`SELECT id, status FROM ${table} WHERE id = ?`, id);
  if (!row) throw httpError(404, 'NOT_FOUND', '内容不存在');
  if (fromList.indexOf(row.status) < 0) {
    throw httpError(400, 'INVALID_TRANSITION', `非法状态转换：${row.status} → ${to}`);
  }
  const now = new Date().toISOString();
  db.run(`UPDATE ${table} SET status = ?, updated_at = ? WHERE id = ?`, to, now, id);
  if (kind === 'replies') {
    if (action === 'approve') {
      db.run('UPDATE forum_topics SET reply_count = reply_count + 1 WHERE id = ?', row2TopicId(id));
    }
    if (action === 'delete' && row.status === 'approved') {
      db.run('UPDATE forum_topics SET reply_count = CASE WHEN reply_count > 0 THEN reply_count - 1 ELSE 0 END WHERE id = ?', row2TopicId(id));
    }
  }
  json(res, 200, { id, status: to });
}

function row2TopicId(replyId) {
  const r = db.getRow('SELECT topic_id FROM forum_replies WHERE id = ?', replyId);
  return r ? r.topic_id : null;
}

function register(route) {
  route('GET', /^\/api\/admin\/topics$/, async (ctx) => {
    requireAdmin(ctx.req);
    adminList('topics', ctx);
  });
  route('GET', /^\/api\/admin\/replies$/, async (ctx) => {
    requireAdmin(ctx.req);
    adminList('replies', ctx);
  });

  const ACTIONS = ['approve', 'reject', 'hide', 'restore', 'delete'];
  for (const action of ACTIONS) {
    route('POST', new RegExp(`^/api/admin/topics/([A-Za-z0-9-]+)/(?:${action})$`), async (ctx) => {
      requireAdmin(ctx.req);
      transition('topics', action, ctx.params[0], ctx.res);
    });
    route('POST', new RegExp(`^/api/admin/replies/([A-Za-z0-9-]+)/(?:${action})$`), async (ctx) => {
      requireAdmin(ctx.req);
      transition('replies', action, ctx.params[0], ctx.res);
    });
  }
}

module.exports = { register };
