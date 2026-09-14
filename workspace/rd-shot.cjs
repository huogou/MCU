/* 局部区域截图：按「文档坐标 y + 高度」截取，用于细看长页面的中段与尾部
 * 用法：node workspace/rd-shot.cjs <url> <width> <y> <height> <outPng> [watchedIdsCsv]
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

const [url, widthS, yS, hS, outPng, watchedCsv, scaleS] = process.argv.slice(2);
const width = +widthS, y = +yS, height = +hS, scale = +scaleS || 1;
const xS = process.argv[9];
const x = +xS || 0;
const preScroll = +(process.argv[10] || 0);   /* 截取前先滚动到的位置，用于把 sticky 元素移出裁切区 */
if (!url || !outPng) { console.error('usage: node rd-shot.cjs <url> <width> <y> <height> <outPng> [watchedCsv] [scale] [x]'); process.exit(2); }

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
  const target = url.replace(/^https?:\/\/[^/]+/, 'http://127.0.0.1:' + port);

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rd-shot-'));
  const browser = cp.spawn(CHROME, ['--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars',
    '--force-device-scale-factor=1', '--remote-debugging-port=9334',
    '--no-proxy-server', '--proxy-server=direct://', '--proxy-bypass-list=*', '--user-data-dir=' + tmp], { stdio: 'ignore' });
  const cleanup = () => { try { browser.kill('SIGKILL'); } catch (e) {} try { srv.close(); } catch (e) {} };
  process.on('exit', cleanup);
  await sleep(1800);

  const list = await new Promise((res, rej) => http.get('http://127.0.0.1:9334/json', r => { let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d))); }).on('error', rej));
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
  const vh = width < 600 ? 844 : 900;   /* 与 e2e 的移动端视口保持一致，便于视口截图对齐 */
  await send('Emulation.setDeviceMetricsOverride', { width, height: vh, deviceScaleFactor: 1, mobile: width < 600 });
  await send('Page.navigate', { url: target });
  await sleep(2600);

  if (watchedCsv) {
    const obj = { watched: {}, want_to_watch: {}, favorite: {}, saved_routes: [], milestones_shown: {} };
    if (watchedCsv !== 'CLEAR') {
      watchedCsv.split(',').filter(Boolean).forEach((x, i) => obj.watched[x] = Date.now() - i * 1000);
    }
    await send('Runtime.evaluate', { expression: 'localStorage.clear();localStorage.setItem("mcu_nav_user_v1",' + JSON.stringify(JSON.stringify(obj)) + ')' });
    await send('Page.reload'); await sleep(2600);
  }
  // 触发懒加载
  await send('Runtime.evaluate', { expression: 'window.scrollTo(0,document.body.scrollHeight)' });
  await sleep(1200);
  await send('Runtime.evaluate', { expression: 'window.scrollTo(0,' + preScroll + ')' });
  await sleep(700);

  const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x, y, width, height, scale } });
  fs.writeFileSync(outPng, Buffer.from(r.data, 'base64'));
  console.log('shot ' + width + 'x' + height + ' @(' + x + ',' + y + ') scale=' + scale + ' -> ' + outPng);
  cleanup(); process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
