/* ============================================================
 * forum-e2e.cjs · H5 论坛 V3.0 UI 断言式验收（本地 Chrome headless + CDP）
 * 覆盖：4 页 × 375/390/414 三宽度（含 pending 详情变体）
 * 说明：fetch stub 通过 Page.addScriptToEvaluateOnNewDocument 注入，
 *       仅存在于测试运行时，产品代码零 mock（指令十一合规）。
 * ============================================================ */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const H5ROOT = 'D:/SEO/发挥余热/漫威电影宇宙导航/h5';
const OUTDIR = 'D:/SEO/发挥余热/漫威电影宇宙导航/workspace/forum-shots';
const NODE_OK = true;

/* ---------- 静态服务 ---------- */
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.json': 'application/json' };
function startServer() {
  return new Promise(function (res) {
    const srv = http.createServer(function (req, resp) {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p === '/') p = '/index.html';
      const fp = path.join(H5ROOT, p);
      fs.readFile(fp, function (err, buf) {
        if (err) { resp.writeHead(404); resp.end('nf'); return; }
        resp.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream' });
        resp.end(buf);
      });
    });
    srv.listen(0, '127.0.0.1', function () { res(srv); });
  });
}

/* ---------- fetch stub（注入页面） ---------- */
function stubCode() {
  return [
    '(function(){',
    '  var NOW = Date.now();',
    '  var A = { id: "u1", name: "测试影迷", avatar: "a03" };',
    '  function iso(ms) { return new Date(NOW - ms).toISOString(); }',
    '  var LONG_TITLE = "这是一个特别特别长的话题标题用来验证两行截断是否生效以及超长中文标题绝对不会撑破话题卡片布局的边界情况测试用例";',
    '  var LONG_BODY = "这是一段很长的正文。".repeat(20) + " 另外附上一个超长链接 https://example.com/very/long/path/segment_abcdefghijklmnopqrstuvwxyz_0123456789?q=%E6%B5%8B%E8%AF%95&foo=bar_baz_qux_abcdefghijklmnopqrstuvwxyz 以及一段没有任何空格的连续英文字符串abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz 结束。";',
    '  var topics = [',
    '    { id: "t-long", title: LONG_TITLE, category: "movie", status: "approved", excerpt: LONG_BODY.slice(0, 80), author: A, createdAt: iso(3600e3 * 2), likeCount: 42, replyCount: 5, liked: false },',
    '    { id: "t-normal", title: "看完钢铁侠1的一些随想", category: "general", status: "approved", excerpt: "托尼在山洞里造出第一套战甲的那一刻，整个 MCU 就开始了。", author: A, createdAt: iso(86400e3 * 3), likeCount: 0, replyCount: 0, liked: false },',
    '    { id: "t-pending", title: "审核中的话题标题示例", category: "series", status: "approved", excerpt: "列表里显示为正常公开话题。", author: A, createdAt: iso(600e3), likeCount: 3, replyCount: 0, liked: true }',
    '  ];',
    '  var topicDetail = {',
    '    "t-long": { id: "t-long", title: LONG_TITLE, content: LONG_BODY, category: "movie", status: "approved", author: A, createdAt: iso(3600e3 * 2), likeCount: 42, liked: false },',
    '    "t-pendingflag": { id: "t-pendingflag", title: "待审核话题详情示例", content: "这篇内容还在审核中，作者本人可见。", category: "series", status: "pending", author: A, createdAt: iso(120e3), likeCount: 0, liked: false },',
    '    "t-deleted": { id: "t-deleted", title: "已删除", content: "", category: "general", status: "deleted", author: A, createdAt: iso(9e6), likeCount: 0, liked: false }',
    '  };',
    '  var replies = {',
    '    "t-long": [',
    '      { id: "r1", content: LONG_BODY, author: A, floor: 1, createdAt: iso(300e3), status: "approved", likeCount: 7, liked: false },',
    '      { id: "r2", content: "短回复。", author: A, floor: 2, createdAt: iso(240e3), status: "approved", likeCount: 0, liked: false },',
    '      { id: "r3", content: "这条回复也写得比较长一些，用来验证回复区域在窄屏下的换行与间距表现，确认不会出现横向溢出或者文字重叠的问题，内容重复一次：这条回复也写得比较长一些，用来验证回复区域在窄屏下的换行与间距表现。", author: A, floor: 3, createdAt: iso(180e3), status: "approved", likeCount: 2, liked: true },',
    '      { id: "r4", content: "赞一个。", author: A, floor: 4, createdAt: iso(120e3), status: "approved", likeCount: 1, liked: false },',
    '      { id: "r5", content: "前排围观。", author: A, floor: 5, createdAt: iso(60e3), status: "approved", likeCount: 0, liked: false }',
    '    ],',
    '    "t-pendingflag": []',
    '  };',
    '  var meTopics = [',
    '    { id: "t1", title: LONG_TITLE, category: "movie", status: "pending", excerpt: "审核中摘要", createdAt: iso(600e3), likeCount: 0, replyCount: 0 },',
    '    { id: "t2", title: "已通过的话题", category: "series", status: "approved", excerpt: "公开可见", createdAt: iso(86400e3), likeCount: 5, replyCount: 1 },',
    '    { id: "t3", title: "被驳回的话题", category: "general", status: "rejected", excerpt: "未通过审核", createdAt: iso(172800e3), likeCount: 0, replyCount: 0 }',
    '  ];',
    '  var meReplies = [',
    '    { topicId: "t-normal", topicTitle: "看完钢铁侠1的一些随想", topicStatus: "approved", content: "我的回复内容一。", status: "approved", createdAt: iso(3600e3), likeCount: 1 },',
    '    { topicId: "t-normal", topicTitle: "看完钢铁侠1的一些随想", topicStatus: "approved", content: "我的回复内容二（审核中）。", status: "pending", createdAt: iso(120e3), likeCount: 0 }',
    '  ];',
    '  window.fetch = function (u) {',
    '    var s = String(u || "");',
    '    var i = s.indexOf("/api/");',
    '    if (i === -1) return Promise.reject(new Error("no-api"));',
    '    var p = s.slice(i);',
    '    function ok(obj) { return Promise.resolve(new Response(JSON.stringify(obj), { status: 200, headers: { "Content-Type": "application/json" } })); }',
    '    if (p === "/api/me/register") return ok({ token: "tk", uid: "u1", profile: { nickname: A.name, avatar: A.avatar } });',
    '    if (p === "/api/me") return ok({ uid: "u1", profile: { nickname: A.name, avatar: A.avatar } });',
    '    if (p === "/api/me/topics") return ok({ items: meTopics, total: meTopics.length });',
    '    if (p === "/api/me/replies") return ok({ items: meReplies, total: meReplies.length });',
    '    if (p.indexOf("/api/topics/") === 0) {',
    '      var rest = p.slice("/api/topics/".length);',
    '      if (rest.indexOf("/replies") > -1) { var tid = rest.slice(0, rest.indexOf("/")); var key = (tid === "t-pendingflag") ? "t-pendingflag" : "t-long"; return ok({ items: replies[key] || [], total: (replies[key] || []).length }); }',
    '      if (rest.indexOf("/like") > -1 || rest.indexOf("/report") > -1) return ok({ likeCount: 1, liked: true });',
    '      var d = topicDetail[rest] || topicDetail["t-long"];',
    '      if (d.status === "deleted") return Promise.resolve(new Response(JSON.stringify({ error: { code: "GONE", message: "deleted" } }), { status: 410, headers: { "Content-Type": "application/json" } }));',
    '      return ok(d);',
    '    }',
    '    if (p.indexOf("/api/topics") === 0) return ok({ items: topics, total: topics.length });',
    '    return ok({});',
    '  };',
    '})();'
  ].join('\n');
}

/* ---------- CDP 客户端 ---------- */
function connect(port) {
  return new Promise(function (res, rej) {
    http.get('http://127.0.0.1:' + port + '/json/list', function (r) {
      let d = '';
      r.on('data', function (c) { d += c; });
      r.on('end', function () {
        try {
          const list = JSON.parse(d);
          const page = list.filter(function (t) { return t.type === 'page'; })[0];
          if (!page) return rej(new Error('no page target'));
          res(page.webSocketDebuggerUrl);
        } catch (e) { rej(e); }
      });
    }).on('error', rej);
  });
}

function CDP(wsUrl) {
  let id = 0; const pend = []; const evs = [];
  const ws = new WebSocket(wsUrl);
  ws.addEventListener('message', function (ev) {
    const m = JSON.parse(ev.data);
    if (m.id && pend[m.id]) { const f = pend[m.id]; delete pend[m.id]; f(m.error ? Promise.reject(new Error(JSON.stringify(m.error))) : Promise.resolve(m.result)); return; }
    if (m.method) evs.forEach(function (f) { f(m); });
  });
  const raw = function (method, params) {
    return new Promise(function (res, rej) {
      const mid = ++id;
      pend[mid] = function (p) { p.then(res).catch(rej); };
      ws.send(JSON.stringify({ id: mid, method: method, params: params || {} }));
    });
  };
  const ready = new Promise(function (res) { ws.addEventListener('open', res); });
  return {
    ready: ready,
    send: raw,
    onEvent: function (f) { evs.push(f); },
    close: function () { try { ws.close(); } catch (e) {} }
  };
}

const sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

/* ---------- 断言运行 ---------- */
const results = [];
function rec(group, name, pass, actual) {
  results.push({ group: group, name: name, pass: !!pass, actual: String(actual) });
  console.log((pass ? 'PASS' : 'FAIL') + ' | ' + group + ' | ' + name + ' | ' + String(actual));
}

async function evalJS(cdp, expr) {
  const r = await cdp.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  return r.result ? r.result.value : undefined;
}

async function runPage(cdp, base, url, width, tag, asserts) {
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: width, height: 844, deviceScaleFactor: 1, mobile: true });
  await cdp.send('Page.navigate', { url: url });
  await sleep(2300);
  for (const a of asserts) {
    try {
      const v = await evalJS(cdp, a.expr);
      rec(tag, a.name, a.check(v), a.show ? a.show(v) : v);
    } catch (e) { rec(tag, a.name, false, 'EVAL_ERR ' + e.message); }
  }
  try {
    const shot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
    fs.writeFileSync(path.join(OUTDIR, tag + '.png'), Buffer.from(shot.data, 'base64'));
  } catch (e) { console.log('SHOT_ERR ' + tag + ' ' + e.message); }
}

const OVERFLOW = { expr: 'document.documentElement.scrollWidth - document.documentElement.clientWidth', name: '无横向溢出', check: function (v) { return v <= 0; } };
const NOJSERR = { expr: 'window.__jsErrors||0', name: '无JS异常', check: function (v) { return v === 0; } };

async function main() {
  fs.mkdirSync(OUTDIR, { recursive: true });
  const srv = await startServer();
  const port = srv.address().port;
  const ORIGIN = 'http://127.0.0.1:' + port;

  const tmpUser = path.join(process.env.TEMP || 'D:/tmp', 'mcu-chrome-e2e-' + Date.now());
  const chrome = spawn(CHROME, [
    '--headless=new', '--remote-debugging-port=0', '--no-proxy-server', '--proxy-server=direct://',
    '--proxy-bypass-list=*', '--force-device-scale-factor=1', '--disable-gpu',
    '--user-data-dir=' + tmpUser, '--window-size=414,900', 'about:blank'
  ], { stdio: ['ignore', 'pipe', 'pipe'] });

  let wsUrl = null;
  chrome.stderr.on('data', function (c) {
    const s = c.toString();
    const m = s.match(/DevTools listening on (ws:\/\/\S+)/);
    if (m && !wsUrl) wsUrl = m[1];
  });
  const t0 = Date.now();
  while (!wsUrl && Date.now() - t0 < 15000) await sleep(300);
  if (!wsUrl) { console.log('FATAL: chrome ws url not found'); process.exit(2); }

  const cdp = CDP(await connect(new URL(wsUrl).port));
  await cdp.ready;
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Log.enable');

  let jsErrors = 0;
  cdp.onEvent(function (m) {
    if (m.method === 'Runtime.exceptionThrown') jsErrors++;
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') jsErrors++;
  });

  /* 首次导航到 origin 以建立安全上下文，再注入 stub */
  await cdp.send('Page.navigate', { url: ORIGIN + '/index.html' });
  await sleep(800);
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: stubCode() });

  const W = [375, 390, 414];
  for (const w of W) {
    jsErrors = 0;
    await evalJS(cdp, 'window.__jsErrors=0');
    /* 用事件计数器：注入后页面错误计入 __jsErrors 的另一路：直接用 jsErrors 变量值同步 */
    const jsErrBefore = jsErrors;

    await runPage(cdp, 'community', ORIGIN + '/community.html', w, 'community-' + w, [
      OVERFLOW,
      { expr: '!!document.querySelector(".v3f-hero")', name: 'Hero存在', check: Boolean },
      { expr: 'Math.round(document.querySelector(".v3f-hero").getBoundingClientRect().height)', name: 'Hero高度<150', check: function (v) { return v > 0 && v < 150; } },
      { expr: 'document.querySelectorAll(".v3f-hint").length', name: '入口双卡=2', check: function (v) { return v === 2; } },
      { expr: 'document.querySelectorAll(".v3f-card").length', name: '话题卡=3', check: function (v) { return v === 3; } },
      { expr: 'document.querySelectorAll(".v3f-skel").length', name: '骨架已清', check: function (v) { return v === 0; } },
      { expr: 'getComputedStyle(document.querySelector(".v3f-card-title"))["-webkit-line-clamp"]', name: '标题2行截断', check: function (v) { return String(v) === '2'; } },
      { expr: 'document.querySelectorAll(".v3f-card-thumb").length', name: '无图态(缩略图0)', check: function (v) { return v === 0; } },
      { expr: 'document.querySelectorAll(".v3f-tab").length', name: '排序Tab=2', check: function (v) { return v === 2; } }
    ]);
    rec('community-' + w, '无JS异常', jsErrors === jsErrBefore, jsErrors - jsErrBefore);

    jsErrors = 0;
    await runPage(cdp, 'detail', ORIGIN + '/topic-detail.html?id=t-long', w, 'detail-' + w, [
      OVERFLOW,
      { expr: '!!document.querySelector(".v3f-post")', name: '原帖区存在', check: Boolean },
      { expr: 'document.querySelectorAll(".v3f-reply").length', name: '回复=5', check: function (v) { return v === 5; } },
      { expr: '(function(){var b=document.querySelector(".v3f-post-body");return b.scrollWidth<=b.clientWidth;})()', name: '长正文不横向溢出', check: Boolean },
      { expr: 'getComputedStyle(document.querySelector(".v3f-inputbar")).position', name: '输入栏fixed', check: function (v) { return v === 'fixed'; } },
      { expr: '!!document.querySelector(".v3f-detail-pad")', name: '底部防遮挡pad', check: Boolean },
      { expr: 'document.querySelector(".v3f-inputbar").getBoundingClientRect().bottom <= window.innerHeight + 1', name: '输入栏贴底可见', check: Boolean },
      { expr: '(function(){var b=document.querySelector(".v3f-post-body");return getComputedStyle(b).wordBreak;})()', name: '长词可断行', check: function (v) { return v === 'break-word'; } }
    ]);
    rec('detail-' + w, '无JS异常', jsErrors === 0, jsErrors);

    jsErrors = 0;
    await runPage(cdp, 'detail-pending', ORIGIN + '/topic-detail.html?id=t-pendingflag', w, 'detail-pending-' + w, [
      OVERFLOW,
      { expr: '!!document.querySelector(".v3f-flag")', name: '审核中旗标', check: Boolean },
      { expr: 'document.querySelectorAll(".v3f-reply").length', name: '0回复空态', check: function (v) { return v === 0; } },
      { expr: 'document.body.innerText.indexOf("还没有人回复")>-1', name: '空态文案', check: Boolean }
    ]);
    rec('detail-pending-' + w, '无JS异常', jsErrors === 0, jsErrors);

    jsErrors = 0;
    await runPage(cdp, 'post-create', ORIGIN + '/post-create.html', w, 'post-create-' + w, [
      OVERFLOW,
      { expr: 'document.querySelectorAll("#v3f-pick .v3f-cat").length', name: '分类=6', check: function (v) { return v === 6; } },
      { expr: 'document.getElementById("v3f-go") && document.getElementById("v3f-go").disabled', name: '空标题禁用发布', check: Boolean },
      { expr: '(function(){var t=document.getElementById("v3f-title");t.value="两字以上标题";t.dispatchEvent(new Event("input"));return !document.getElementById("v3f-go").disabled;})()', name: '填标题后可发布', check: Boolean },
      { expr: 'document.body.innerText.indexOf("审核")>-1', name: '先审后发提示', check: Boolean }
    ]);
    rec('post-create-' + w, '无JS异常', jsErrors === 0, jsErrors);

    jsErrors = 0;
    await runPage(cdp, 'my-community', ORIGIN + '/my-community.html', w, 'my-community-' + w, [
      OVERFLOW,
      { expr: 'document.querySelectorAll(".v3f-mtab").length', name: '双Tab', check: function (v) { return v === 2; } },
      { expr: 'document.querySelectorAll(".v3f-mine").length', name: '我的帖子=3', check: function (v) { return v === 3; } },
      { expr: '!!document.querySelector(".v3f-st--pending")', name: 'pending徽标', check: Boolean },
      { expr: '!!document.querySelector(".v3f-st--rejected")', name: 'rejected徽标', check: Boolean }
    ]);
    /* 切换到我的回复 */
    await evalJS(cdp, '(function(){var t=document.querySelectorAll(".v3f-mtab")[1];t.click();return true;})()');
    await sleep(700);
    const mv = await evalJS(cdp, 'document.querySelectorAll(".v3f-mine").length');
    rec('my-community-' + w, '切Tab我的回复=2', mv === 2, mv);
    rec('my-community-' + w, '无JS异常', jsErrors === 0, jsErrors);
  }

  const pass = results.filter(function (r) { return r.pass; }).length;
  const fail = results.length - pass;
  console.log('==== SUMMARY PASS=' + pass + ' FAIL=' + fail + ' ====');
  const cdpClose = cdp.close; cdpClose();
  chrome.kill();
  srv.close();
  process.exit(fail > 0 ? 1 : 0);
}

main().catch(function (e) { console.log('FATAL ' + (e && e.stack || e)); process.exit(3); });
