/* gen-v23-preview.cjs · V2.3 验收截图生成
 * 按 movie.wxml/journey.wxml 结构 1:1 还原为 HTML（真实数据 + 现有视觉 Token）
 * ⚠️ 产物为「结构还原预览」，非开发者工具实机截图 */
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');
const base = 'D:/SEO/发挥余热/漫威电影宇宙导航/douyin';
const OUT = 'D:/SEO/发挥余热/漫威电影宇宙导航/workspace/v23-preview';

/* ---- 数据加载（带 require 缓存） ---- */
const cacheMap = {};
function loadMod(f) {
  if (cacheMap[f]) return cacheMap[f].exports;
  const mod = { exports: {} };
  const req = p => loadMod(path.join(path.dirname(f), p));
  new Function('require', 'module', 'exports', 'window', 'tt', fs.readFileSync(f, 'utf8'))(req, mod, mod.exports, {}, {});
  cacheMap[f] = mod;
  return mod.exports;
}
const CONTENT = loadMod(base + '/data/content.js');
const RELS = loadMod(base + '/data/relations.js');
const LIST = Array.isArray(CONTENT) ? CONTENT : (CONTENT.CONTENT || []);
const RRAW = Array.isArray(RELS) ? RELS : (RELS.RELATIONS || []);
const PHASE_LABEL = { 1: '第一阶段', 2: '第二阶段', 3: '第三阶段', 4: '第四阶段', 5: '第五阶段', 6: '第六阶段' };
const ids = {}; LIST.forEach(c => { ids[c.id] = c; });
function relOf(id) {
  const out = [];
  RRAW.forEach(r => {
    const a = Array.isArray(r) ? r[0] : r.from, b = Array.isArray(r) ? r[1] : r.to;
    if (a === id) out.push(b); else if (b === id) out.push(a);
  });
  return out;
}
function nodePage(id) {
  const c = ids[id];
  const rels = relOf(id).slice(0, 4).map(oid => {
    const o = ids[oid];
    return '<div class="rel-item"><div class="rel-main"><div class="rel-name">' + o.cn + '</div><div class="rel-phase">' + (PHASE_LABEL[o.phase || 1] || '') + '</div></div><span class="rel-arrow">›</span></div>';
  }).join('');
  return '<div class="phone"><div class="navbar"><span class="nv-back">‹</span><span class="nv-title">' + c.cn + '</span><span class="nv-capsule">⋯  ◉</span></div><div class="page">'
    + '<div class="mv-cn">' + c.cn + '</div>'
    + '<div class="pills"><span class="pill">' + (PHASE_LABEL[c.phase || 1] || '') + '</span></div>'
    + '<div class="section-label">宇宙节点</div>'
    + '<div class="card info">'
    + '<div class="mi-row"><span class="k">时间节点</span><span class="v">' + c.year + '年</span></div>'
    + '<div class="mi-row"><span class="k">MCU 阶段</span><span class="v">' + (PHASE_LABEL[c.phase || 1] || '') + '</span></div>'
    + '<div class="mi-row"><span class="k">宇宙序号</span><span class="v">' + (c.ro || '—') + '</span></div>'
    + '</div>'
    + '<div class="section-label">关联节点 · ' + relOf(id).length + '</div>'
    + '<div class="card rels">' + rels + '</div>'
    + '<div class="nav-btn">进入宇宙导航</div>'
    + '<div class="h5guide"><b>想了解更多？</b><span>打开 H5 查看完整宇宙导航</span></div>'
    + '<div class="bottom-space"></div></div></div>';
}
function journeyPage() {
  const order = ['iron-man', 'the-incredible-hulk', 'iron-man-2', 'thor', 'captain-america-first-avenger', 'the-avengers', 'iron-man-3', 'thor-the-dark-world'].map(x => ids[x] || ids[x.replace('the-', '')]).filter(Boolean).slice(0, 8);
  let i = 0;
  const rows = order.map(c => {
    i++;
    const t = c.type || 'movie';
    return '<div class="route-item"><span class="ri-order">' + i + '</span><div class="ri-info"><span class="ri-name">' + c.cn + '</span><div class="ri-meta"><span class="ri-type">' + (t === 'movie' ? '电影' : t === 'series' ? '剧集' : t === 'special' ? '特别呈现' : '短片') + '</span><span class="ri-phase">' + (PHASE_LABEL[c.phase || 1] || '') + ' · ' + c.year + '</span></div></div><span class="ri-status">' + (i <= 3 ? '✓' : '○') + '</span></div>';
  }).join('');
  return '<div class="phone"><div class="navbar"><span class="nv-title">MCU观影导航</span><span class="nv-capsule">⋯  ◉</span></div><div class="page">'
    + '<div class="seg"><span class="seg-item on">上映顺序</span><span class="seg-item">主线必看</span></div>'
    + '<div class="progress"><span class="pl">路线进度</span><div class="bar"><div class="fill" style="width:37%"></div></div><span class="pt">3/8</span></div>'
    + '<div class="card rels">' + rows + '</div>'
    + '<div class="h5guide"><b>想了解完整宇宙关系？</b><span>前往 H5 探索</span></div>'
    + '<div class="bottom-space"></div></div></div>';
}

/* ---- HTML 输出 ---- */
fs.mkdirSync(OUT, { recursive: true });
const CSS = fs.readFileSync(path.join(__dirname, 'v23-token.css'), 'utf8');
function html(body, note) {
  return '<!DOCTYPE html><html><head><meta charset="utf-8"><style>' + CSS + '</style></head><body>'
    + '<div class="frame-note">结构还原预览（非实机截图）· ' + note + '</div>' + body + '</body></html>';
}
fs.writeFileSync(OUT + '/p1-winter-soldier.html', html(nodePage('winter-soldier'), '宇宙节点信息页 winter-soldier'));
fs.writeFileSync(OUT + '/p2-cap-first.html', html(nodePage('captain-america-first-avenger'), '宇宙节点信息页 captain-america-first-avenger（关联节点跳转后）'));
fs.writeFileSync(OUT + '/p3-journey.html', html(journeyPage(), 'journey 路线页（进入宇宙导航落点 · 简化还原）'));
console.log('HTML generated');

/* ---- CDP 截图 ---- */
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
function connect(port) {
  return new Promise(function (res, rej) {
    http.get('http://127.0.0.1:' + port + '/json/list', function (r) {
      let d = '';
      r.on('data', c => d += c);
      r.on('end', () => res(JSON.parse(d).filter(t => t.type === 'page')[0].webSocketDebuggerUrl));
    }).on('error', rej);
  });
}
function CDP(u) {
  let id = 0; const pend = []; const ws = new WebSocket(u);
  ws.addEventListener('message', ev => { const m = JSON.parse(ev.data); if (m.id && pend[m.id]) { const f = pend[m.id]; delete pend[m.id]; f(m.error ? Promise.reject(new Error(JSON.stringify(m.error))) : Promise.resolve(m.result)); } });
  const raw = (method, params) => new Promise((res, rej) => { const mid = ++id; pend[mid] = p => p.then(res).catch(rej); ws.send(JSON.stringify({ id: mid, method, params: params || {} })); });
  return { ready: new Promise(res => ws.addEventListener('open', res)), send: raw, close: () => { try { ws.close(); } catch (e) {} } };
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function main() {
  const chrome = spawn(CHROME, ['--headless=new', '--remote-debugging-port=0', '--no-proxy-server', '--proxy-server=direct://', '--proxy-bypass-list=*', '--force-device-scale-factor=1', '--disable-gpu', '--user-data-dir=' + path.join(process.env.TEMP || 'D:/tmp', 'mcu-v23-' + Date.now()), '--window-size=420,900', 'about:blank'], { stdio: ['ignore', 'pipe', 'pipe'] });
  let wsUrl = null;
  chrome.stderr.on('data', c => { const m = c.toString().match(/DevTools listening on (ws:\/\/\S+)/); if (m && !wsUrl) wsUrl = m[1]; });
  while (!wsUrl) await sleep(200);
  const cdp = CDP(await connect(new URL(wsUrl).port));
  await cdp.ready; await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 420, height: 900, deviceScaleFactor: 1, mobile: false });
  async function shot(file, url, clip) {
    await cdp.send('Page.navigate', { url: 'file:///' + url.replace(/\\/g, '/') });
    await sleep(700);
    const p = clip ? { format: 'png', clip: clip } : { format: 'png' };
    const s = await cdp.send('Page.captureScreenshot', p);
    fs.writeFileSync(OUT + '/' + file, Buffer.from(s.data, 'base64'));
    console.log('SHOT', file);
  }
  /* p1: 首屏(0-560) / 信息区(560-1100) / 关联区(1100-1640) / 底部(1640-2200) */
  const W = 420;
  await shot('01-node-first-screen.png', OUT + '\\p1-winter-soldier.html', { x: 0, y: 0, width: W, height: 560, scale: 1 });
  await shot('02-node-info.png', OUT + '\\p1-winter-soldier.html', { x: 0, y: 560, width: W, height: 540, scale: 1 });
  await shot('03-node-relations.png', OUT + '\\p1-winter-soldier.html', { x: 0, y: 1100, width: W, height: 540, scale: 1 });
  await shot('04-node-bottom.png', OUT + '\\p1-winter-soldier.html', { x: 0, y: 1640, width: W, height: 560, scale: 1 });
  await shot('05-jump-to-node.png', OUT + '\\p2-cap-first.html');
  await shot('06-journey.png', OUT + '\\p3-journey.html');
  cdp.close(); chrome.kill(); process.exit(0);
}
main().catch(e => { console.log('FATAL', e.message); process.exit(2); });
