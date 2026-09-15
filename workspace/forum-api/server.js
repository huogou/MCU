'use strict';
/* MCU Forum API · V3.0 —— HTTP 入口
 * 零 npm 依赖：node:http + node:sqlite（Node 24 LTS）
 * 仅监听 127.0.0.1:8787；公网经 Nginx ^~ /api/ 反代（下一阶段接入）
 * 职责：请求解析、路由分发、统一错误响应、访问日志（journald 收集）
 */
const http = require('http');
const config = require('./config');
const database = require('./db/database');
const { initSecrets } = require('./auth/token');
const { json, readBody, httpError } = require('./lib/http');
const { resolveUser } = require('./middleware/auth');

/* ---- 路由表 ---- */
const routeTable = [];
function route(method, pattern, handler) {
  routeTable.push({ method, pattern, handler });
}
require('./routes/users').register(route);
require('./routes/topics').register(route);
require('./routes/replies').register(route);
require('./routes/likes').register(route);
require('./routes/reports').register(route);
require('./routes/admin').register(route);

/* ---- 管理页静态文件（同域提供，鉴权靠 admin token，不做前端判断） ---- */
const fs = require('fs');
const path = require('path');
const ADMIN_HTML = path.join(__dirname, 'admin', 'index.html');

function accessLog(started, req, res, user) {
  const ms = Date.now() - started;
  const uid = user ? user.uid.slice(0, 8) : '-';
  console.log(`[api] ${req.method} ${req.url} ${res.statusCode} ${ms}ms uid=${uid}`);
}

const server = http.createServer(async (req, res) => {
  const started = Date.now();
  let user = null;
  try {
    const u = new URL(req.url, 'http://localhost');
    const pathName = u.pathname.replace(/\/+$/, '') || '/';

    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

    // 管理页（GET /api/admin/ → 静态 HTML；其余 /api/admin/* 走 JSON 路由）
    if (req.method === 'GET' && (pathName === '/api/admin' || pathName === '/api/admin/')) {
      const html = fs.readFileSync(ADMIN_HTML);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(html);
      accessLog(started, req, res, null);
      return;
    }

    let body = null;
    if (['POST', 'PUT', 'PATCH', 'DELETE'].indexOf(req.method) >= 0) {
      const raw = await readBody(req, config.BODY_LIMIT);
      if (raw) {
        try { body = JSON.parse(raw); }
        catch (e) { throw httpError(400, 'BAD_JSON', '请求体不是合法 JSON'); }
      }
    }

    user = resolveUser(req); // 解析失败不抛错：公开接口匿名可用，写接口由 requireUser 把关
    const ctx = {
      req, res, user, body,
      query: u.searchParams,
      params: null,
      ip: (req.socket.remoteAddress || 'unknown').replace(/^::ffff:/, ''),
    };

    for (const r of routeTable) {
      if (r.method !== req.method) continue;
      const m = r.pattern.exec(pathName);
      if (!m) continue;
      ctx.params = m.slice(1);
      await r.handler(ctx);
      accessLog(started, req, res, user);
      return;
    }
    throw httpError(404, 'NOT_FOUND', '接口不存在');
  } catch (e) {
    const status = e.status || 500;
    if (status >= 500) console.error('[500]', req.method, req.url, e && e.stack || e);
    try {
      json(res, status, {
        error: {
          code: e.code || (status === 500 ? 'INTERNAL' : 'ERROR'),
          message: status === 500 ? '服务内部错误' : String(e.message || '请求失败'),
        },
      });
    } catch (e2) { /* 响应头已发时忽略 */ }
    accessLog(started, req, res, user);
  }
});

/* ---- 启动 ---- */
initSecrets();
database.init();

server.listen(config.PORT, config.HOST, () => {
  console.log(`[forum-api] listening on http://${config.HOST}:${config.PORT} (node ${process.version})`);
  console.log(`[forum-api] db: ${config.DB_PATH}`);
  console.log(`[forum-api] admin page: http://${config.HOST}:${config.PORT}/api/admin/`);
});

/* systemd SIGTERM → 优雅关闭（正常关闭后 WAL 数据完整） */
process.on('SIGTERM', () => {
  console.log('[forum-api] SIGTERM, closing...');
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
});
