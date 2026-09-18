/* ============================================================
 * map-focus-verify.cjs · PC 观影宇宙地图 V3 聚焦模式修复验收
 * 验证：低倍率全景点击作品 → 聚焦态「位置+大小+关系」三位一体
 *   B1 中心节点进入聚焦后明显放大（直径 ≥ 100 屏幕px）
 *   B2 中心节点贴近视口中心（考虑信息卡右移 offX）
 *   B3 关联节点环绕（距中心 ≈220px，容差 ±45）
 *   B4 聚焦连线已渲染
 *   C 切换聚焦中心后同样成立
 *   D 退出聚焦恢复全景缩放
 * 运行：node map-focus-verify.cjs
 * ============================================================ */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const H5ROOT = 'D:/SEO/发挥余热/漫威电影宇宙导航/h5';
const OUTDIR = 'D:/SEO/发挥余热/漫威电影宇宙导航/workspace/map-shots';
const VW = 1440, VH = 860;

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

/* ---------- CDP 客户端（同 forum-e2e 骨架） ---------- */
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
  return { ready: ready, send: raw, onEvent: function (f) { evs.push(f); }, close: function () { try { ws.close(); } catch (e) {} } };
}
const sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

const results = [];
function rec(name, pass, actual) {
  results.push({ name: name, pass: !!pass, actual: String(actual) });
  console.log((pass ? 'PASS' : 'FAIL') + ' | ' + name + ' | ' + String(actual));
}
async function evalJS(cdp, expr) {
  const r = await cdp.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  return r.result ? r.result.value : undefined;
}
async function shot(cdp, name) {
  const s = await cdp.send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(OUTDIR, name), Buffer.from(s.data, 'base64'));
  console.log('SHOT  | ' + name);
}
/* 对节点派发真实 click（走 addEventListener('click') 路径） */
function clickNode(id) {
  return '(function(){var el=document.querySelector(\'.movie-node[data-id="' + id + '"]\');if(!el)return "NO_NODE";'
    + 'var r=el.getBoundingClientRect();el.dispatchEvent(new MouseEvent("click",{bubbles:true,cancelable:true,clientX:r.x+r.width/2,clientY:r.y+r.height/2}));return "CLICKED";})()';
}
/* 聚焦态几何采样 */
const FOCUS_STATE =
  '(function(){var c=document.querySelector(".movie-node.center");if(!c)return JSON.stringify({err:"NO_CENTER"});' +
  'var cr=c.getBoundingClientRect();var cx=cr.x+cr.width/2,cy=cr.y+cr.height/2;' +
  'var cv=document.getElementById("map-canvas").getBoundingClientRect();' +
  'var rels=[].slice.call(document.querySelectorAll(".movie-node.related"));' +
  'var dists=rels.map(function(n){var r2=n.getBoundingClientRect();return Math.round(Math.hypot(r2.x+r2.width/2-cx,r2.y+r2.height/2-cy));});' +
  'return JSON.stringify({id:c.getAttribute("data-id"),zoom:document.getElementById("zoom-display").textContent,' +
  'd:Math.round(cr.width),cx:Math.round(cx),cy:Math.round(cy),vw:cv.width,vh:cv.height,cvTop:cv.top,' +
  'nRel:rels.length,dists:dists,conns:document.querySelectorAll(".focus-conn.show").length});})()';

async function main() {
  fs.mkdirSync(OUTDIR, { recursive: true });
  const srv = await startServer();
  const port = srv.address().port;
  const ORIGIN = 'http://127.0.0.1:' + port;

  const tmpUser = path.join(process.env.TEMP || 'D:/tmp', 'mcu-map-verify-' + Date.now());
  const chrome = spawn(CHROME, [
    '--headless=new', '--remote-debugging-port=0', '--no-proxy-server', '--proxy-server=direct://',
    '--proxy-bypass-list=*', '--force-device-scale-factor=1', '--disable-gpu',
    '--user-data-dir=' + tmpUser, '--window-size=' + VW + ',' + VH, 'about:blank'
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

  let jsErr = 0;
  cdp.onEvent(function (m) {
    if (m.method === 'Runtime.exceptionThrown') jsErr++;
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') jsErr++;
  });

  await cdp.send('Emulation.setDeviceMetricsOverride', { width: VW, height: VH, deviceScaleFactor: 1, mobile: false });
  await cdp.send('Page.navigate', { url: ORIGIN + '/map-pc.html' });
  await sleep(1800);

  /* A. 全景基准 */
  const baseZoom = await evalJS(cdp, 'document.getElementById("zoom-display").textContent');
  const baseNum = parseFloat(baseZoom);
  rec('A 全景基准缩放<60%', baseNum > 0 && baseNum < 60, baseZoom + '%');

  /* B. 点击 钢铁侠（core 节点，关联 4）进入聚焦 */
  const ck1 = await evalJS(cdp, clickNode('iron-man'));
  rec('B0 节点可点击', ck1 === 'CLICKED', ck1);
  await sleep(1200);
  const f1 = JSON.parse(await evalJS(cdp, FOCUS_STATE));
  if (f1.err) {
    rec('B1 中心节点存在', false, f1.err);
  } else {
    const expCx = f1.vw / 2 + Math.min(90, Math.max(40, (f1.vw - 560) / 4));
    const expCy = f1.cvTop + f1.vh / 2;
    rec('B1 中心节点=iron-man 且放大(直径≥100)', f1.id === 'iron-man' && f1.d >= 100, 'id=' + f1.id + ' d=' + f1.d + 'px zoom=' + f1.zoom);
    rec('B2 中心贴近视口中心(偏差≤30px)', Math.abs(f1.cx - expCx) <= 30 && Math.abs(f1.cy - expCy) <= 30, 'cx=' + f1.cx + '(期望≈' + Math.round(expCx) + ') cy=' + f1.cy + '(期望≈' + Math.round(expCy) + ')');
    const okDist = f1.nRel > 0 && f1.dists.every(function (d) { return d >= 175 && d <= 265; });
    rec('B3 关联节点环绕(距离220±45)', okDist, 'n=' + f1.nRel + ' dists=' + f1.dists.join(','));
    rec('B4 聚焦连线已渲染', f1.conns >= Math.min(3, f1.nRel), 'conns=' + f1.conns);
    rec('B5 聚焦缩放≥100%', parseFloat(f1.zoom) >= 100, f1.zoom);
  }
  await shot(cdp, 'focus-iron-man.png');

  /* C. 点击关联节点 复仇者联盟 切换中心 */
  const ck2 = await evalJS(cdp, clickNode('avengers'));
  rec('C0 关联节点可点击', ck2 === 'CLICKED', ck2);
  await sleep(1200);
  const f2 = JSON.parse(await evalJS(cdp, FOCUS_STATE));
  if (f2.err) {
    rec('C1 切换后中心存在', false, f2.err);
  } else {
    rec('C1 切换中心=avengers 且放大', f2.id === 'avengers' && f2.d >= 100, 'id=' + f2.id + ' d=' + f2.d + 'px zoom=' + f2.zoom);
    const okDist2 = f2.nRel > 0 && f2.dists.every(function (d) { return d >= 175 && d <= 265; });
    rec('C2 新中心关联环绕', okDist2, 'n=' + f2.nRel + ' dists=' + f2.dists.join(','));
  }
  await shot(cdp, 'focus-avengers.png');

  /* D. 点击面包屑「全景地图」退出 */
  const ck3 = await evalJS(cdp,
    '(function(){var el=document.querySelector(".pc-crumb.home");if(!el)return "NO_CRUMB";'
    + 'el.dispatchEvent(new MouseEvent("click",{bubbles:true,cancelable:true}));return "CLICKED";})()');
  rec('D0 面包屑可点击', ck3 === 'CLICKED', ck3);
  await sleep(1500);
  const backZoom = await evalJS(cdp, 'document.getElementById("zoom-display").textContent');
  const noCenter = await evalJS(cdp, 'document.querySelectorAll(".movie-node.center,.movie-node.related").length');
  rec('D1 退出后无聚焦节点', noCenter === 0, 'center/related=' + noCenter);
  rec('D2 退出恢复全景缩放(±5%)', Math.abs(parseFloat(backZoom) - baseNum) <= 5, backZoom + '% (基准 ' + baseZoom + '%)');

  rec('Z 全程无JS异常', jsErr === 0, jsErr);

  await cdp.close();
  chrome.kill();
  srv.close();
  const fails = results.filter(function (r) { return !r.pass; }).length;
  console.log('==== ' + (results.length - fails) + '/' + results.length + ' PASS, ' + fails + ' FAIL ====');
  process.exit(fails ? 1 : 0);
}

main().catch(function (e) { console.log('FATAL ' + e.message); process.exit(2); });
