'use strict';
/* 话题路由
 * GET  /api/topics        公开列表（服务端强制 status='approved'，无 status 参数）
 * GET  /api/topics/:id    详情（approved 所有人；pending/rejected/hidden 仅作者；deleted 410）
 * POST /api/topics        发帖（先审后发：恒为 pending）
 * GET  /api/me/topics     我的帖子（排除 deleted，含各状态徽标依据）
 */
const crypto = require('crypto');
const config = require('../config');
const db = require('../db/database');
const { json, httpError, charLen, charSlice } = require('../lib/http');
const { requireUser, maybeRenew } = require('../middleware/auth');
const rate = require('../middleware/rate-limit');

/* 话题可见性判定（详情与回复列表共用）
 * 返回：ok=可访问；deleted=410；hidden=他人不可见
 */
function topicVisibility(topic, user) {
  if (!topic) return 'notfound';
  if (topic.status === 'deleted') return 'deleted';
  if (topic.status === 'approved') return 'ok';
  if (user && user.uid === topic.author_id) return 'ok'; // 作者可见自己的 pending/rejected/hidden
  return 'hidden';
}

function topicOut(row, likedSet) {
  return {
    id: row.id,
    title: row.title,
    excerpt: row.excerpt,
    category: row.category,
    status: row.status,
    likeCount: row.like_count,
    replyCount: row.reply_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    liked: likedSet ? likedSet.has(row.id) : false,
    author: { name: row.nickname || '匿名影迷', avatar: row.avatar || 'a00' },
  };
}

function likedIdsFor(uid, type, ids) {
  if (!uid || !ids.length) return new Set();
  const ph = ids.map(() => '?').join(',');
  const rows = db.all(
    `SELECT target_id FROM forum_likes WHERE user_id = ? AND target_type = '${type}' AND target_id IN (${ph})`,
    uid, ...ids
  );
  return new Set(rows.map((r) => r.target_id));
}

function queryPage(query, key, def, max) {
  const v = parseInt(query.get(key) || '', 10);
  if (!Number.isFinite(v) || v < 1) return def;
  return Math.min(v, max);
}

function register(route) {
  route('GET', /^\/api\/topics$/, async (ctx) => {
    maybeRenew(ctx, ctx.res);
    const q = ctx.query;
    const sort = q.get('sort') === 'hot' ? 'hot' : 'latest';
    const category = q.get('category');
    const page = queryPage(q, 'page', config.PAGE_DEFAULT, 1000);
    const size = queryPage(q, 'size', config.PAGE_SIZE_DEFAULT, config.PAGE_SIZE_MAX);

    // 服务端强制仅 approved；不读取任何 status 参数（拍板指令第十节）
    let where = "t.status = 'approved'";
    const params = [];
    if (category) {
      if (!config.TOPIC_CATEGORIES.includes(category)) throw httpError(400, 'BAD_CATEGORY', '未知分类');
      where += ' AND t.category = ?';
      params.push(category);
    }
    const order = sort === 'hot'
      ? 't.like_count DESC, t.reply_count DESC, t.created_at DESC'
      : 't.created_at DESC';

    const total = db.getRow(`SELECT COUNT(*) AS c FROM forum_topics t WHERE ${where}`, ...params).c;
    const rows = db.all(
      `SELECT t.*, u.nickname, u.avatar FROM forum_topics t
       JOIN forum_users u ON u.id = t.author_id
       WHERE ${where} ORDER BY ${order} LIMIT ? OFFSET ?`,
      ...params, size, (page - 1) * size
    );
    const liked = likedIdsFor(ctx.user && ctx.user.uid, 'topic', rows.map((r) => r.id));
    json(ctx.res, 200, {
      items: rows.map((r) => topicOut(r, liked)),
      page, size, total,
    });
  });

  route('GET', /^\/api\/topics\/([A-Za-z0-9-]+)$/, async (ctx) => {
    maybeRenew(ctx, ctx.res);
    const topic = db.getRow(
      `SELECT t.*, u.nickname, u.avatar FROM forum_topics t
       JOIN forum_users u ON u.id = t.author_id WHERE t.id = ?`, ctx.params[0]
    );
    const v = topicVisibility(topic, ctx.user);
    if (v === 'notfound' || v === 'hidden') throw httpError(404, 'NOT_FOUND', '话题不存在');
    if (v === 'deleted') throw httpError(410, 'TOPIC_DELETED', '此话题已被删除');
    const liked = likedIdsFor(ctx.user && ctx.user.uid, 'topic', [topic.id]);
    json(ctx.res, 200, topicOut(topic, liked));
  });

  route('POST', /^\/api\/topics$/, async (ctx) => {
    const user = requireUser(ctx);
    rate.topicByUid(user.uid);
    const me = db.getRow('SELECT nickname FROM forum_users WHERE id = ?', user.uid);
    if (!me || !me.nickname) throw httpError(403, 'PROFILE_REQUIRED', '请先设置昵称与头像');
    if (ctx.body && typeof ctx.body.author_id === 'string') {
      // 越权防御：author_id 一律由服务端 token 决定，客户端传入即拒绝（拍板指令第五节）
      throw httpError(400, 'FORBIDDEN_FIELD', 'author_id 由服务端决定，不接受客户端提交');
    }
    const title = typeof ctx.body.title === 'string' ? ctx.body.title.trim() : '';
    const content = typeof ctx.body.content === 'string' ? ctx.body.content.trim() : '';
    const category = typeof ctx.body.category === 'string' ? ctx.body.category.trim() : '';
    if (charLen(title) < config.TITLE_MIN || charLen(title) > config.TITLE_MAX) {
      throw httpError(400, 'BAD_TITLE', '标题需为 ' + config.TITLE_MIN + '-' + config.TITLE_MAX + ' 字');
    }
    if (!content || charLen(content) > config.TOPIC_MAX) {
      throw httpError(400, 'BAD_CONTENT', '正文需为 1-' + config.TOPIC_MAX + ' 字');
    }
    if (!config.TOPIC_CATEGORIES.includes(category)) {
      throw httpError(400, 'BAD_CATEGORY', '未知分类');
    }
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    db.run(
      `INSERT INTO forum_topics (id, author_id, title, content, excerpt, category, status, like_count, reply_count, created_at, updated_at)
       VALUES (?,?,?,?,?,?, 'pending', 0, 0, ?, ?)`,
      id, user.uid, title, content, charSlice(content.replace(/\s+/g, ' ').trim(), config.EXCERPT_LEN), category, now, now
    );
    json(ctx.res, 201, { id, status: 'pending' }); // 先审后发：恒为 pending，客户端无法指定
  });

  route('GET', /^\/api\/me\/topics$/, async (ctx) => {
    const user = requireUser(ctx);
    maybeRenew(ctx, ctx.res);
    const rows = db.all(
      `SELECT t.*, u.nickname, u.avatar FROM forum_topics t
       JOIN forum_users u ON u.id = t.author_id
       WHERE t.author_id = ? AND t.status != 'deleted'
       ORDER BY t.created_at DESC LIMIT 100`, user.uid
    );
    const liked = likedIdsFor(user.uid, 'topic', rows.map((r) => r.id));
    json(ctx.res, 200, { items: rows.map((r) => topicOut(r, liked)) });
  });
}

module.exports = { register, topicVisibility, topicOut, likedIdsFor };
