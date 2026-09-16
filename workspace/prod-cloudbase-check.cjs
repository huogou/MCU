/* 生产验证：mcuatlas.xyz stats/feedback 写库链路是否恢复
 * 判定：页面加载后 _mcu_stats_queue 为空（写成功即清空）+ 无 CloudBase 相关 console error
 * 附加：论坛 /api/topics 真后端连通抽查 */
const http = require('http');
const { spawn } = require('child_process');

const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const TARGET = 'https://mcuatlas.xyz/';

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

(async function main() {
  const tmpUser = process.env.TEMP + '\\mcu-chrome-prodchk-' + Date.now();
  const chrome = spawn(CHROME, [
    '--headless=new', '--remote-debugging-port=0', '--no-proxy-server', '--proxy-server=direct://',
    '--proxy-bypass-list=*', '--disable-gpu', '--user-data-dir=' + tmpUser,
    '--window-size=390,844', TARGET
  ], { stdio: ['ignore', 'pipe', 'pipe'] });

  let wsUrl = null;
  chrome.stderr.on('data', function (c) {
    const m = c.toString().match(/DevTools listening on (ws:\/\/\S+)/);
    if (m && !wsUrl) wsUrl = m[1];
  });
  const t0 = Date.now();
  while (!wsUrl && Date.now() - t0 < 15000) await sleep(300);
  if (!wsUrl) { console.log('FATAL: no ws'); process.exit(2); }

  const cdp = CDP(await connect(new URL(wsUrl).port));
  await cdp.ready;
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');

  const errs = [];
  cdp.onEvent(function (m) {
    if (m.method === 'Runtime.exceptionThrown') errs.push('EXC: ' + JSON.stringify(m.params.exceptionDetails.exception || {}).slice(0, 160));
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
      errs.push('CONSOLE: ' + (m.params.args || []).map(function (a) { return a.value !== undefined ? a.value : (a.description || a.type); }).join(' ').slice(0, 200));
    }
  });

  await sleep(9000); // 等匿名登录 + pageView 写库 + 队列补发

  async function ev(expr) {
    const r = await cdp.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    return r.result ? r.result.value : undefined;
  }

  const title = await ev('document.title');
  const queue = await ev('(localStorage.getItem("_mcu_stats_queue") || "[]")');
  const fbQueue = await ev('(localStorage.getItem("_mcu_feedback_queue") || localStorage.getItem("_mcu_fb_queue") || "n/a")');
  const api = await ev('fetch("/api/topics").then(function(r){ return r.status; }).catch(function(e){ return "ERR:" + e.message; })');

  console.log('TITLE: ' + title);
  console.log('STATS_QUEUE: ' + (queue === '[]' ? 'EMPTY(写库成功或无积压)' : 'HAS_ITEMS(写库失败积压): ' + queue.slice(0, 300)));
  console.log('FEEDBACK_QUEUE: ' + String(fbQueue).slice(0, 200));
  console.log('API_TOPICS_STATUS: ' + api);
  console.log('CONSOLE_ERRORS: ' + errs.length);
  errs.slice(0, 6).forEach(function (e) { console.log('  - ' + e); });

  chrome.kill();
  process.exit(0);
})();
