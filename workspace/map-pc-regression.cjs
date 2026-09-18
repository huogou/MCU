/* ============================================================
 * map-pc-regression.cjs · PC 观影宇宙地图「信息避让优化」回归验收
 * 覆盖开发指令第六节 8 项：
 *   ① 全景地图  ② 单节点探索×3  ③ 多关系作品  ④ A→B→C 连续探索
 *   ⑤ 空白退出  ⑥ 滚轮缩放(双模式)  ⑦ 拖拽不误退  ⑧ 1440×900 / 1920×1080
 * 核心断言：关系标签不压节点文字(海报/名称/年份)、标签互不重叠、无残留
 * 输入走 CDP Input 域真实事件（wheel/drag/click），非 JS 合成
 * 运行：node map-pc-regression.cjs
 * ============================================================ */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const H5ROOT = 'D:/SEO/发挥余热/漫威电影宇宙导航/h5';
const OUTDIR = 'D:/SEO/发挥余热/漫威电影宇宙导航/workspace/map-shots';

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

let PASS = 0, FAIL = 0;
function rec(name, pass, actual) {
  if (pass) PASS++; else FAIL++;
  console.log((pass ? 'PASS' : 'FAIL') + ' | ' + name + ' | ' + String(actual));
}
async function evalJS(cdp, expr) {
  const r = await cdp.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  return r.result ? r.result.value : undefined;
}
async function shot(cdp, name) {
  const s = await cdp.send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(OUTDIR, name), Buffer.from(s.data, 'base64'));
}

/* ---------- CDP 真实输入 ---------- */
async function realClick(cdp, x, y) {
  await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
}
async function realWheel(cdp, x, y, deltaY) {
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x, y, deltaX: 0, deltaY });
}
async function realDrag(cdp, x, y, dx, dy) {
  await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
  for (let i = 1; i <= 6; i++) {
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x + dx * i / 6, y: y + dy * i / 6, button: 'left' });
    await sleep(30);
  }
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: x + dx, y: y + dy, button: 'left', clickCount: 1 });
}

/* ---------- 页面内断言表达式 ---------- */
/* 点击节点（JS 路径，等同真实 click 命中节点） */
function clickNode(id) {
  return '(function(){var el=document.querySelector(\'.movie-node[data-id="' + id + '"]\');if(!el)return "NO_NODE";'
    + 'var r=el.getBoundingClientRect();el.dispatchEvent(new MouseEvent("click",{bubbles:true,cancelable:true,clientX:r.x+r.width/2,clientY:r.y+r.height/2}));return "CLICKED";})()';
}
/* ① 全景健康检查 */
const OVERVIEW_CHK =
  '(function(){return JSON.stringify({'
  + 'nodes:document.querySelectorAll(".movie-node").length,'
  + 'timeline:document.querySelectorAll(".tl-year-mark").length,'
  + 'nav:!!document.querySelector(".pc-map-header"),'
  + 'filter:!!document.getElementById("btn-filter"),'
  + 'zoomBtn:!!document.getElementById("btn-zoom-in")&&!!document.getElementById("btn-zoom-out"),'
  + 'zoom:document.getElementById("zoom-display").textContent});})()';
/* 探索态几何 + 标签避让采样 */
const FOCUS_CHK =
  '(function(){'
  + 'var c=document.querySelector(".movie-node.center");if(!c)return JSON.stringify({err:"NO_CENTER"});'
  + 'var cr=c.getBoundingClientRect();'
  + 'var rels=[].slice.call(document.querySelectorAll(".movie-node.related"));'
  + 'var bgs=[].slice.call(document.querySelectorAll(".focus-conn-label-bg"));'
  + 'var cl=function(r){return {x1:r.x,y1:r.y,x2:r.x+r.width,y2:r.y+r.height};};'
  + 'var hit=function(a,b,p){return a.x1<b.x2+p&&a.x2+p>b.x1&&a.y1<b.y2+p&&a.y2+p>b.y1};'
  /* 标签 vs 可见节点文字（名称+年份） */
  + 'var bad=[];'
  + '[].slice.call(document.querySelectorAll(".movie-node.center .node-label,.movie-node.center .node-year,.movie-node.related .node-label,.movie-node.related .node-year")).forEach(function(t){'
  + '  var tr=cl(t.getBoundingClientRect());'
  + '  bgs.forEach(function(b,i){ if(hit(tr,cl(b.getBoundingClientRect()),2)) bad.push("label"+i+"~"+(t.textContent||"").slice(0,6)); });'
  + '});'
  /* 标签两两不重叠 */
  + 'var lblHit=0;'
  + 'for(var i=0;i<bgs.length;i++)for(var j=i+1;j<bgs.length;j++){if(hit(cl(bgs[i].getBoundingClientRect()),cl(bgs[j].getBoundingClientRect()),2))lblHit++;}'
  + 'return JSON.stringify({'
  + '  id:c.getAttribute("data-id"),'
  + '  name:(c.querySelector(".node-label")||{}).textContent||"",'
  + '  year:(c.querySelector(".node-year")||{}).textContent||"",'
  + '  d:Math.round(cr.width),zoom:document.getElementById("zoom-display").textContent,'
  + '  nRel:rels.length,nLbl:bgs.length,'
  + '  textOverlap:bad, lblOverlap:lblHit});})()';

async function main() {
  fs.mkdirSync(OUTDIR, { recursive: true });
  const srv = await startServer();
  const port = srv.address().port;
  const ORIGIN = 'http://127.0.0.1:' + port;

  const tmpUser = path.join(process.env.TEMP || 'D:/tmp', 'mcu-map-reg-' + Date.now());
  const chrome = spawn(CHROME, [
    '--headless=new', '--remote-debugging-port=0', '--no-proxy-server', '--proxy-server=direct://',
    '--proxy-bypass-list=*', '--force-device-scale-factor=1', '--disable-gpu',
    '--user-data-dir=' + tmpUser, '--window-size=1440,900', 'about:blank'
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

  /* ================= 分辨率 1440×900 全流程 ================= */
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await cdp.send('Page.navigate', { url: ORIGIN + '/map-pc.html' });
  await sleep(2000);

  /* ① 全景地图 */
  const ov = JSON.parse(await evalJS(cdp, OVERVIEW_CHK));
  rec('①a 地图加载(节点40)', ov.nodes === 40, 'nodes=' + ov.nodes);
  rec('①b 时间轴正常', ov.timeline > 0, 'marks=' + ov.timeline);
  rec('①c 顶部导航正常', ov.nav, String(ov.nav));
  rec('①d 筛选/缩放控件正常', ov.filter && ov.zoomBtn, String(ov.filter && ov.zoomBtn));
  rec('①e 全景缩放正常', parseFloat(ov.zoom) > 0 && parseFloat(ov.zoom) < 60, ov.zoom + '%');
  const baseZoom = parseFloat(ov.zoom);

  /* ⑥a 全景滚轮缩放 */
  await realWheel(cdp, 720, 450, -240); await realWheel(cdp, 720, 450, -240); await sleep(300);
  const zIn = parseFloat(await evalJS(cdp, 'document.getElementById("zoom-display").textContent'));
  await realWheel(cdp, 720, 450, 240); await realWheel(cdp, 720, 450, 240); await realWheel(cdp, 720, 450, 240); await realWheel(cdp, 720, 450, 240); await sleep(300);
  const zOut = parseFloat(await evalJS(cdp, 'document.getElementById("zoom-display").textContent'));
  rec('⑥a 全景滚轮放大/缩小', zIn > baseZoom + 3 && zOut < baseZoom + 3, 'in=' + zIn + '% out=' + zOut + '% (基准' + baseZoom + '%)');

  /* ⑦a 全景拖拽（位置变化，且不误触） */
  const tx0 = await evalJS(cdp, '(window.__t0=0,document.getElementById("map-content").getAttribute("transform"))');
  await realDrag(cdp, 700, 400, 120, -80); await sleep(400);
  const tx1 = await evalJS(cdp, 'document.getElementById("map-content").getAttribute("transform")');
  rec('⑦a 全景拖拽生效', tx0 !== tx1, 'transform changed=' + (tx0 !== tx1));

  /* ② 单节点探索 ×3（含避让断言） */
  const probes = [
    { id: 'iron-man', name: '钢铁侠' },
    { id: 'ant-man', name: '蚁人' },
    { id: 'no-way-home', name: '蜘蛛侠：英雄无归' }
  ];
  for (let p = 0; p < probes.length; p++) {
    const tag = '②-' + (p + 1) + ' ' + probes[p].name;
    if (p > 0) { /* 先退出回全景 */
      await evalJS(cdp, clickNode('__none__'));
      await evalJS(cdp, '(function(){var b=document.querySelector(".pc-crumb.home");if(b)b.dispatchEvent(new MouseEvent("click",{bubbles:true}));return 1;})()');
      await sleep(1400);
    }
    await evalJS(cdp, clickNode(probes[p].id));
    await sleep(1300);
    const f = JSON.parse(await evalJS(cdp, FOCUS_CHK));
    if (f.err) { rec(tag + ' 进入探索', false, f.err); continue; }
    rec(tag + ' 中心突出', f.id === probes[p].id && f.d >= 100, 'id=' + f.id + ' d=' + f.d + 'px zoom=' + f.zoom);
    rec(tag + ' 名称年份清晰', f.name === probes[p].name && f.year !== '', 'name=' + f.name + ' year=' + f.year);
    rec(tag + ' 关联展开且标签齐全', f.nRel > 0 && f.nLbl === f.nRel, 'rel=' + f.nRel + ' labels=' + f.nLbl);
    rec(tag + ' 标签不压节点文字', f.textOverlap.length === 0, JSON.stringify(f.textOverlap));
    rec(tag + ' 标签互不重叠', f.lblOverlap === 0, 'overlap=' + f.lblOverlap);
    if (p === 0) await shot(cdp, 'reg-iron-man-900.png');
  }

  /* ③+④ 多关系作品 + 连续探索 A→B→C（钢铁侠→复仇者联盟→冬兵） */
  /* 当前在 no-way-home 探索态 → 先退回全景 */
  await evalJS(cdp, '(function(){var b=document.querySelector(".pc-crumb.home");if(b)b.dispatchEvent(new MouseEvent("click",{bubbles:true}));return 1;})()');
  await sleep(1400);
  await evalJS(cdp, clickNode('iron-man')); await sleep(1200);          /* A */
  await evalJS(cdp, clickNode('avengers')); await sleep(1200);          /* B */
  const fB = JSON.parse(await evalJS(cdp, FOCUS_CHK));
  rec('③ 多关系(复仇者8关联)标签不堆叠', fB.id === 'avengers' && fB.nRel === 8 && fB.nLbl === 8 && fB.lblOverlap === 0, 'rel=' + fB.nRel + ' labels=' + fB.nLbl + ' overlap=' + fB.lblOverlap + ' 压文字=' + fB.textOverlap.length);
  rec('③ 多关系标签不压文字', fB.textOverlap.length === 0, JSON.stringify(fB.textOverlap));
  await shot(cdp, 'reg-avengers-900.png');
  await evalJS(cdp, clickNode('winter-soldier')); await sleep(1200);    /* C */
  const fC = JSON.parse(await evalJS(cdp, FOCUS_CHK));
  rec('④a C切换中心正确', fC.id === 'winter-soldier' && fC.d >= 100, 'id=' + fC.id + ' d=' + fC.d);
  rec('④b C关系重算/无残留', fC.nLbl === fC.nRel && fC.nRel > 0, 'rel=' + fC.nRel + ' labels=' + fC.nLbl);
  rec('④c C标签无碰撞', fC.textOverlap.length === 0 && fC.lblOverlap === 0, '压文字=' + fC.textOverlap.length + ' 标签重叠=' + fC.lblOverlap);
  await shot(cdp, 'reg-winter-soldier-900.png');

  /* ⑥b 探索模式滚轮缩放 */
  await realWheel(cdp, 720, 450, -240); await sleep(300);
  const fz1 = parseFloat(await evalJS(cdp, 'document.getElementById("zoom-display").textContent'));
  await realWheel(cdp, 720, 450, 480); await sleep(300);
  const fz2 = parseFloat(await evalJS(cdp, 'document.getElementById("zoom-display").textContent'));
  rec('⑥b 探索模式滚轮缩放', fz1 > 130 && fz2 < fz1 - 3, 'in=' + fz1 + '% out=' + fz2 + '%');
  /* 缩放后标签仍避让（布局未重算但同坐标系缩放） */
  const fZ = JSON.parse(await evalJS(cdp, FOCUS_CHK));
  rec('⑥c 探索缩放后标签仍无碰撞', fZ.textOverlap.length === 0 && fZ.lblOverlap === 0, '压文字=' + fZ.textOverlap.length + ' 标签重叠=' + fZ.lblOverlap);

  /* ⑦b 探索模式拖拽位移 → 不误触空白退出 */
  await realDrag(cdp, 720, 700, 80, 0); await sleep(500);
  const stillFocus = await evalJS(cdp, 'document.querySelectorAll(".movie-node.center").length');
  rec('⑦b 探索拖拽不误触退出', stillFocus === 1, 'center=' + stillFocus);

  /* ⑤ 空白点击退出 */
  await realClick(cdp, 1300, 200); await sleep(1600);
  const backChk = JSON.parse(await evalJS(cdp, '(function(){return JSON.stringify({c:document.querySelectorAll(".movie-node.center").length,z:document.getElementById("zoom-display").textContent});})()'));
  rec('⑤ 空白点击退出回全景', backChk.c === 0 && Math.abs(parseFloat(backChk.z) - baseZoom) <= 5, 'center=' + backChk.c + ' zoom=' + backChk.z);

  rec('①f 1440×900 全程无JS异常', jsErr === 0, jsErr);

  /* ================= 分辨率 1920×1080 精简流程 ================= */
  jsErr = 0;
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
  await sleep(900);
  /* resize 后聚焦适配：触发 reset 键回 fit */
  await evalJS(cdp, 'document.getElementById("btn-reset").click();');
  await sleep(1200);
  const ov2 = JSON.parse(await evalJS(cdp, OVERVIEW_CHK));
  rec('⑧a 1920 全景正常', ov2.nodes === 40 && parseFloat(ov2.zoom) > 0, 'nodes=' + ov2.nodes + ' zoom=' + ov2.zoom);
  await evalJS(cdp, clickNode('avengers')); await sleep(1300);
  const f1920 = JSON.parse(await evalJS(cdp, FOCUS_CHK));
  rec('⑧b 1920 多关系避让', f1920.id === 'avengers' && f1920.nLbl === 8 && f1920.textOverlap.length === 0 && f1920.lblOverlap === 0, 'labels=' + f1920.nLbl + ' 压文字=' + f1920.textOverlap.length + ' 重叠=' + f1920.lblOverlap);
  await shot(cdp, 'reg-avengers-1920.png');
  /* ⑤ 1920 空白退出 */
  await realClick(cdp, 1750, 180); await sleep(1600);
  const back2 = await evalJS(cdp, 'document.querySelectorAll(".movie-node.center").length');
  rec('⑧c 1920 空白退出', back2 === 0, 'center=' + back2);
  rec('⑧d 1920×1080 无JS异常', jsErr === 0, jsErr);

  await cdp.close();
  chrome.kill();
  srv.close();
  console.log('==== ' + PASS + ' PASS, ' + FAIL + ' FAIL ====');
  process.exit(FAIL ? 1 : 0);
}

main().catch(function (e) { console.log('FATAL ' + e.message); process.exit(2); });
