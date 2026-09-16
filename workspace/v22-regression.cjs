/* ============================================================
 * v22-regression.cjs · ⑮ 版本收尾：V2.2 + 首页基线回归（本地 Chrome headless + CDP）
 * 范围：论坛开发未触碰的 V2/V2.2 页面（index/routes/movie/next/map/route-detail）
 *       + PC 方案 C 断点抽查（index @1280）
 * 断言：无 JS 异常 / 无横向溢出 / 关键模块渲染 / 数据填充 / 方案 C 生效
 * ============================================================ */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const H5ROOT = 'D:/SEO/发挥余热/漫威电影宇宙导航/h5';
const OUTDIR = 'D:/SEO/发挥余热/漫威电影宇宙导航/workspace/v22-regression-shots';

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

function connect(port) {
  return new Promise(function (res, rej) {
    http.get('http://127.0.0.1:' + port + '/json/list', function (r) {
      let d = '';
      r.on('data', function (c) { d += c; });
      r.on('end', function () {
        try {
          const page = JSON.parse(d).filter(function (t) { return t.type === 'page'; })[0];
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
  return { ready: ready, send: raw, onEvent: function (f) { evs.push(f); }, close: function () { try { ws.close(); } catch (e) {} } };
}

const sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

const results = [];
function rec(group, name, pass, actual) {
  results.push({ group: group, name: name, pass: !!pass });
  console.log((pass ? 'PASS' : 'FAIL') + ' | ' + group + ' | ' + name + ' | ' + String(actual));
}

async function evalJS(cdp, expr) {
  const r = await cdp.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  return r.result ? r.result.value : undefined;
}

async function runPage(cdp, base, urlPath, width, tag, asserts) {
  let jsErrors = 0;
  const onErr = function (m) {
    if (m.method === 'Runtime.exceptionThrown') jsErrors++;
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') jsErrors++;
  };
  cdp.onEvent(onErr);
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: width, height: 900, deviceScaleFactor: 1, mobile: width < 800 });
  await cdp.send('Page.navigate', { url: base + urlPath });
  await sleep(2500);
  rec(tag, '无JS异常', jsErrors === 0, jsErrors + ' 个');
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
  cdp.onEvent(function (m) { const i = [onErr].indexOf(m); });
}

const NO_OVERFLOW = { expr: 'document.documentElement.scrollWidth - document.documentElement.clientWidth', name: '无横向溢出', check: function (v) { return v <= 0; } };

(async function main() {
  fs.mkdirSync(OUTDIR, { recursive: true });
  const srv = await startServer();
  const port = srv.address().port;
  const ORIGIN = 'http://127.0.0.1:' + port;

  const tmpUser = path.join(process.env.TEMP || 'D:/tmp', 'mcu-chrome-v22-' + Date.now());
  const chrome = spawn(CHROME, [
    '--headless=new', '--remote-debugging-port=0', '--no-proxy-server', '--proxy-server=direct://',
    '--proxy-bypass-list=*', '--force-device-scale-factor=1', '--disable-gpu',
    '--user-data-dir=' + tmpUser, '--window-size=414,900', 'about:blank'
  ], { stdio: ['ignore', 'pipe', 'pipe'] });

  let wsUrl = null;
  chrome.stderr.on('data', function (c) {
    const m = c.toString().match(/DevTools listening on (ws:\/\/\S+)/);
    if (m && !wsUrl) wsUrl = m[1];
  });
  const t0 = Date.now();
  while (!wsUrl && Date.now() - t0 < 15000) await sleep(300);
  if (!wsUrl) { console.log('FATAL: chrome ws url not found'); process.exit(2); }

  const cdp = CDP(await connect(new URL(wsUrl).port));
  await cdp.ready;
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');

  /* 1. 首页 @390（V2 基线 + 9-B 社区入口） */
  await runPage(cdp, ORIGIN, '/index.html', 390, 'index-390', [
    { expr: '!!document.querySelector(".v2-hero")', name: 'Hero 渲染', check: function (v) { return v; } },
    { expr: 'document.querySelectorAll("#v2-routes .v2-mcard").length', name: '路线轨道海报>0', check: function (v) { return v > 0; } },
    { expr: 'document.querySelectorAll("#v2-library .v2-mcard").length', name: '资料库=12部(禁令④)', check: function (v) { return v === 12; } },
    { expr: 'document.querySelectorAll("#v2-upcoming .v2-tl-item, #v2-upcoming .v2-tl-year").length', name: '未来计划渲染', check: function (v) { return v > 0; } },
    { expr: 'document.querySelector("#stat-count") ? document.querySelector("#stat-count").textContent : ""', name: '统计数字已填充', check: function (v) { return v && v !== '—'; }, show: function (v) { return v; } },
    { expr: '(document.body.textContent.match(/社区|讨论区/) || []).length > 0', name: '社区入口存在(9-B)', check: function (v) { return v; } },
    { expr: 'Array.prototype.some.call(document.images, function(i){ return i.naturalWidth > 0; })', name: '海报图片可加载', check: function (v) { return v; } },
    NO_OVERFLOW
  ]);

  /* 2. 首页 @1280（PC 方案 C 抽查） */
  await runPage(cdp, ORIGIN, '/index.html', 1280, 'index-1280-pc', [
    { expr: 'getComputedStyle(document.querySelector(".v2-inner")).maxWidth', name: '容器max-width=1280', check: function (v) { return v === '1280px'; }, show: function (v) { return v; } },
    { expr: 'getComputedStyle(document.querySelector("#v2-library .v2-grid")).gridTemplateColumns.split(" ").length', name: '资料库PC=5列', check: function (v) { return v === 5; } },
    { expr: 'parseFloat(getComputedStyle(document.querySelector(".v2-hero-title")).fontSize)', name: 'Hero标题42px', check: function (v) { return v === 42; } },
    NO_OVERFLOW
  ]);

  /* 3. routes.html @390 */
  await runPage(cdp, ORIGIN, '/routes.html', 390, 'routes-390', [
    { expr: 'document.body.textContent.length', name: '内容已渲染>200字', check: function (v) { return v > 200; } },
    { expr: '(document.body.textContent.match(/路线/) || []).length', name: '路线文案存在', check: function (v) { return v > 0; } },
    NO_OVERFLOW
  ]);

  /* 4. movie.html?id=iron-man @390 */
  await runPage(cdp, ORIGIN, '/movie.html?id=iron-man', 390, 'movie-ironman-390', [
    { expr: 'document.querySelector("#detail") ? document.querySelector("#detail").textContent.indexOf("钢铁侠") > -1 : false', name: '详情=钢铁侠', check: function (v) { return v; } },
    { expr: 'document.querySelectorAll("#detail img").length', name: '详情含图片', check: function (v) { return v > 0; } },
    NO_OVERFLOW
  ]);

  /* 5. next.html @390 */
  await runPage(cdp, ORIGIN, '/next.html', 390, 'next-390', [
    { expr: 'document.body.textContent.length', name: '内容已渲染>200字', check: function (v) { return v > 200; } },
    { expr: 'document.body.textContent.indexOf("下一部") > -1', name: '下一部文案存在', check: function (v) { return v; } },
    NO_OVERFLOW
  ]);

  /* 6. map.html @390 */
  await runPage(cdp, ORIGIN, '/map.html', 390, 'map-390', [
    { expr: '!!(document.querySelector("canvas") || document.querySelector("svg"))', name: '地图画布存在', check: function (v) { return v; } },
    { expr: 'document.body.textContent.length', name: '内容已渲染>100字', check: function (v) { return v > 100; } },
    NO_OVERFLOW
  ]);

  /* 7. route-detail.html?id=newcomer @390（V2.2 核心） */
  await runPage(cdp, ORIGIN, '/route-detail.html?id=newcomer', 390, 'route-detail-newcomer-390', [
    { expr: 'document.querySelectorAll("[class^=rd-], [class*=\\\"rd-\\\"]").length', name: 'rd- 组件已渲染', check: function (v) { return v > 5; } },
    { expr: 'document.body.textContent.length', name: '内容已渲染>300字', check: function (v) { return v > 300; } },
    { expr: 'document.body.textContent.indexOf("钢铁侠") > -1', name: '路线串联作品存在', check: function (v) { return v; } },
    NO_OVERFLOW
  ]);

  chrome.kill();
  srv.close();
  const pass = results.filter(function (r) { return r.pass; }).length;
  const fail = results.length - pass;
  console.log('====');
  console.log('TOTAL: ' + results.length + ' | PASS: ' + pass + ' | FAIL: ' + fail);
  process.exit(fail > 0 ? 1 : 0);
})();
