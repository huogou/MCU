/* 在已播种进度的 route-detail 页面上执行任意表达式（复用 e2e 的 CDP 通道）
 * 用法：node workspace/rd-eval.cjs <pageUrl> <width> <watchedCsv|-> "<js表达式>"
 */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const os = require('os');
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const H5 = path.join(__dirname, '..', 'h5');
const WebSocket = globalThis.WebSocket;
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.jpg': 'image/jpeg', '.png': 'image/png' };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const [pageUrl, widthS, watchedCsv, expr] = process.argv.slice(2);
const width = +widthS || 390;

(async function () {
  const srv = http.createServer((req, res) => {
    let rel = decodeURIComponent(req.url.split('?')[0]);
    if (rel === '/') rel = '/index.html';
    const f = path.join(H5, rel);
    if (!f.startsWith(H5) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const port = srv.address().port;
  const url = 'http://127.0.0.1:' + port + pageUrl;

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rd-eval-'));
  const browser = cp.spawn(CHROME, ['--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars',
    '--force-device-scale-factor=1', '--remote-debugging-port=9335',
    '--no-proxy-server', '--proxy-server=direct://', '--proxy-bypass-list=*', '--user-data-dir=' + tmp], { stdio: 'ignore' });
  const cleanup = () => { try { browser.kill('SIGKILL'); } catch (e) {} try { srv.close(); } catch (e) {} };
  process.on('exit', cleanup);
  await sleep(1800);

  const list = await new Promise((res, rej) => http.get('http://127.0.0.1:9335/json', r => { let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d))); }).on('error', rej));
  const t = list.find(x => x.type === 'page');
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  let id = 0; const pending = new Map();
  const send = (m, p) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method: m, params: p || {} })); });
  ws.addEventListener('message', ev => {
    const m = JSON.parse(ev.data.toString());
    if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); }
  });
  await new Promise(r => ws.addEventListener('open', r));
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 600 });
  await send('Page.navigate', { url });
  await sleep(2600);
  if (watchedCsv && watchedCsv !== '-') {
    const obj = { watched: {}, want_to_watch: {}, favorite: {}, saved_routes: [], milestones_shown: {} };
    watchedCsv.split(',').filter(Boolean).forEach((x, i) => obj.watched[x] = Date.now() - i * 1000);
    await send('Runtime.evaluate', { expression: 'localStorage.setItem("mcu_nav_user_v1",' + JSON.stringify(JSON.stringify(obj)) + ')' });
    await send('Page.reload'); await sleep(2600);
  }
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) { console.error('EVAL ERROR', JSON.stringify(r.exceptionDetails)); cleanup(); process.exit(1); }
  console.log(typeof r.result.value === 'string' ? r.result.value : JSON.stringify(r.result.value, null, 2));
  cleanup(); process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
