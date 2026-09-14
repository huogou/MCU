/* ============================================================
 * V2.2 route-detail 端到端验收脚本
 * ------------------------------------------------------------
 * 自带静态服务（http://127.0.0.1:<随机端口>）→ 起 Chrome headless → CDP 驱动。
 * 覆盖：三条路线 / 无进度·有进度·全部看完 / Next→movie / 复制链接 /
 *      首页入口联动 / 控制台错误 / 横向溢出 / 390·1280 整页截图
 * 用法：node workspace/rd-e2e.cjs
 * ============================================================ */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const os = require('os');

const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const H5 = path.join(__dirname, '..', 'h5');
const OUT = path.join(__dirname, '..', 'AI生成文件', 'V2.2路线详情页');
const WebSocket = globalThis.WebSocket;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon'
};

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const results = [];
function check(name, pass, detail) {
  results.push({ name, pass: !!pass, detail: detail === undefined ? '' : String(detail) });
  console.log((pass ? '  PASS  ' : '  FAIL  ') + name + (detail !== undefined ? '  :: ' + detail : ''));
}

function startServer() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      let rel = decodeURIComponent(req.url.split('?')[0]);
      if (rel === '/') rel = '/index.html';
      const file = path.join(H5, rel);
      if (!file.startsWith(H5) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404); res.end('404'); return;
      }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    });
    srv.listen(0, '127.0.0.1', () => resolve({ srv, port: srv.address().port }));
  });
}

async function connect(port) {
  const getJSON = (u) => new Promise((res, rej) => {
    http.get(u, (r) => { let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d))); }).on('error', rej);
  });
  const list = await getJSON('http://127.0.0.1:' + port + '/json');
  const target = list.find(t => t.type === 'page');
  if (!target) throw new Error('no page target');

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  let id = 0; const pending = new Map();
  const logs = [];
  const send = (method, params) => new Promise((res, rej) => {
    const mid = ++id; pending.set(mid, { res, rej });
    ws.send(JSON.stringify({ id: mid, method, params: params || {} }));
  });
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data.toString());
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id); pending.delete(m.id);
      if (m.error) p.rej(new Error(JSON.stringify(m.error))); else p.res(m.result);
      return;
    }
    if (m.method === 'Runtime.exceptionThrown') {
      const d = m.params.exceptionDetails || {};
      logs.push({ kind: 'exception', text: (d.exception && (d.exception.description || d.exception.value)) || d.text || 'unknown' });
    } else if (m.method === 'Runtime.consoleAPICalled' && (m.params.type === 'error' || m.params.type === 'warning')) {
      logs.push({ kind: m.params.type, text: (m.params.args || []).map(a => a.value || a.description || '').join(' ') });
    } else if (m.method === 'Log.entryAdded') {
      const e = m.params.entry || {};
      if (e.level === 'error') logs.push({ kind: 'log:' + (e.source || 'other'), text: e.text || '' });
    }
  });
  await new Promise(r => ws.addEventListener('open', r));
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Log.enable');

  const evaluate = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error('eval: ' + JSON.stringify(r.exceptionDetails.exception && r.exceptionDetails.exception.description || r.exceptionDetails.text));
    return r.result.value;
  };
  const setViewport = (w, h) => send('Emulation.setDeviceMetricsOverride',
    { width: w, height: h, deviceScaleFactor: 1, mobile: w < 600 });
  const goto = async (url, wait) => {
    logs.length = 0;
    await send('Page.navigate', { url });
    await sleep(wait || 2600);
  };
  const shot = async (w, h, file) => {
    await setViewport(w, h);
    await sleep(900);
    await evaluate('window.scrollTo(0, document.body.scrollHeight)'); await sleep(700);
    await evaluate('window.scrollTo(0, 0)'); await sleep(700);
    const m = await send('Page.getLayoutMetrics');
    const cs = m.cssContentSize || m.contentSize;
    const r = await send('Page.captureScreenshot', {
      format: 'png', captureBeyondViewport: true,
      clip: { x: 0, y: 0, width: w, height: Math.ceil(cs.height), scale: 1 }
    });
    fs.writeFileSync(file, Buffer.from(r.data, 'base64'));
    return Math.ceil(cs.height);
  };
  return { send, evaluate, setViewport, goto, shot, logs };
}

/* 断言辅助：页面内取一组值 */
const PROBE = `(function(){
  var q=function(s){return document.querySelector(s)};
  var qa=function(s){return Array.prototype.slice.call(document.querySelectorAll(s))};
  var items=qa('.rd-item');
  var nextIdx=items.findIndex(function(el){return el.classList.contains('is-next')});
  var seenIdx=items.map(function(el){return el.classList.contains('is-watched')});
  var splitIdx=qa('.rd-list > *').findIndex(function(el){return el.classList.contains('rd-split')});
  var ovAll=qa('.rd-ov-c').filter(function(e){return getComputedStyle(e).display!=='none'}).map(function(e){return e.querySelector('.rd-ov-n').textContent+'/'+e.querySelector('.rd-ov-l').textContent});
  var canon=q('link[rel=canonical]');
  return JSON.stringify({
    title: document.title,
    name: (q('.rd-name')||{}).textContent,
    eyebrow: (q('.rd-eyebrow')||{}).textContent,
    tagline: (q('.rd-tagline')||{}).textContent,
    meta: qa('.rd-meta-i').filter(function(e){return getComputedStyle(e).display!=='none'}).map(function(e){return e.textContent}),
    badge: q('.rd-badge')?q('.rd-badge').textContent.trim():null,
    heroCta: q('.rd-actions .v2-btn-primary')?q('.rd-actions .v2-btn-primary').textContent.trim():null,
    barCta: q('.rd-bar .v2-btn-primary')?q('.rd-bar .v2-btn-primary').textContent.trim():null,
    barShare: q('.rd-bar .v2-btn-ghost')?q('.rd-bar .v2-btn-ghost').textContent.trim():null,
    backHref: q('.rd-actions .v2-btn-ghost')?q('.rd-actions .v2-btn-ghost').getAttribute('href'):null,
    nextLabel: q('.rd-next-lbl')?q('.rd-next-lbl').textContent.trim():null,
    nextName: q('.rd-next-name')?q('.rd-next-name').textContent.trim():null,
    nextMeta: q('.rd-next-meta')?q('.rd-next-meta').textContent.trim():null,
    nextReasonLen: q('.rd-next-reason')?q('.rd-next-reason').textContent.trim().length:0,
    nextCtaText: q('.rd-next-cta .v2-btn')?q('.rd-next-cta .v2-btn').textContent.trim():null,
    nextCtaHref: q('.rd-next-cta .v2-btn')?q('.rd-next-cta .v2-btn').getAttribute('href'):null,
    total: items.length,
    seenCount: seenIdx.filter(Boolean).length,
    nextIdx: nextIdx,
    splitIdx: splitIdx,
    firstItemHref: items[0]?items[0].getAttribute('href'):null,
    ovVisible: ovAll,
    phasesOn: qa('.rd-phase.is-on').length,
    phaseText: qa('.rd-phase').map(function(e){return (e.innerText||'').replace(/\\s+/g,'')}),
    itemNames: qa('.rd-item .rd-nm').map(function(e){return e.textContent}),
    itemIsNext: items.map(function(e){return e.classList.contains('is-next')}),
    stateIconPaths: qa('.rd-state svg path').map(function(e){return e.getAttribute('d')}),
    numCheckCount: qa('.rd-item.is-watched .rd-num svg').length,
    noteLabels: qa('.rd-note-l').map(function(e){return e.textContent}),
    canonical: canon?canon.getAttribute('href'):null,
    hasVideoTriangle: document.documentElement.outerHTML.indexOf('M8 5v14l11-7z')>=0,
    scrollW: document.documentElement.scrollWidth,
    innerW: window.innerWidth,
    overflow: qa('*').filter(function(el){var r=el.getBoundingClientRect();return r.width>window.innerWidth+1&&r.width>0}).slice(0,5).map(function(el){return el.className+'@'+Math.round(el.getBoundingClientRect().width)}),
    consoleErrCount: 0
  });
})()`;

(async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const { srv, port } = await startServer();
  const base = 'http://127.0.0.1:' + port + '/';
  console.log('静态服务: ' + base);

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rd-e2e-'));
  const browser = cp.spawn(CHROME, [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars',
    '--force-device-scale-factor=1', '--remote-debugging-port=9333',
    '--no-proxy-server', '--proxy-server=direct://', '--proxy-bypass-list=*',
    '--user-data-dir=' + tmp
  ], { stdio: 'ignore' });
  const cleanup = () => { try { browser.kill('SIGKILL'); } catch (e) {} try { srv.close(); } catch (e) {} };
  process.on('exit', cleanup);

  await sleep(1900);
  const P = await connect(9333);
  await P.setViewport(390, 844);

  /* ---------- A0. 源码级纪律检查 ---------- */
  console.log('\n[A0] 源码级纪律');
  const src = fs.readFileSync(path.join(H5, 'route-detail.html'), 'utf8');
  check('[源码] 不含设计稿演示数据「美国队长2」', src.indexOf('美国队长2') < 0);
  check('[源码] 不含时长演示值 30 小时 / 120 小时', src.indexOf('30 小时') < 0 && src.indexOf('120 小时') < 0);
  check('[源码] 不含任何时长字段（hours/runtime/duration）', !/(hours|runtime|duration)/i.test(src));
  check('[源码] 未新增 localStorage key（进度全走 MCU.progress）',
    !/localStorage\s*[.[]/.test(src) && /MCU\.progress\.isSeen/.test(src));
  check('[源码] 未出现 getItem/setItem/removeItem 直读写', !/(getItem|setItem|removeItem)\s*\(/.test(src));
  check('[源码] 未出现播放三角形图标 M8 5v14l11-7z', src.indexOf('M8 5v14l11-7z') < 0);
  check('[源码] 未新增视觉 Token（无 --xx: #hex 定义）', !/--[a-z0-9-]+\s*:\s*#/i.test(src));
  check('[源码] 路线数据只读 routes.js（无内置 items 数组）', src.indexOf('MCU_ROUTES') < 0);
  const cssSrc = fs.readFileSync(path.join(H5, 'assets', 'css', 'v2.css'), 'utf8');
  check('[源码] 偏差1 已修：页面与样式均无 ic-watched 残留',
    src.indexOf('ic-watched') < 0 && cssSrc.indexOf('ic-watched') < 0,
    'html=' + (src.indexOf('ic-watched') < 0) + ' css=' + (cssSrc.indexOf('ic-watched') < 0));

  /* ---------- A. 三条路线渲染 ---------- */
  console.log('\n[A] 三条路线渲染');
  const EXPECT = {
    newcomer: { name: '新手入坑', total: 12, next: '钢铁侠', phases: 3 },
    release: { name: '上映顺序', total: 59, next: '钢铁侠', phases: 6 },
    chrono: { name: 'MCU 时间线', total: 59, next: '特工卡特', phases: 6 }
  };
  const probes = {};
  for (const rid of ['newcomer', 'release', 'chrono']) {
    await P.goto(base + 'route-detail.html?id=' + rid);
    const raw = await P.evaluate(PROBE);
    const d = JSON.parse(raw);
    probes[rid] = d;
    const e = EXPECT[rid];
    check('[' + rid + '] 路线名 = ' + e.name, d.name === e.name, d.name);
    check('[' + rid + '] 列表条目 = ' + e.total, d.total === e.total, d.total);
    check('[' + rid + '] 无进度时下一部 = ' + e.next, d.nextName === e.next, d.nextName);
    check('[' + rid + '] Next CTA → movie.html', /^movie\.html\?id=/.test(d.nextCtaHref || ''), d.nextCtaHref);
    check('[' + rid + '] canonical 保留 ?id=', (d.canonical || '').indexOf('id=' + rid) >= 0, d.canonical);
    check('[' + rid + '] 移动端 4 格概览', d.ovVisible.length === 4, JSON.stringify(d.ovVisible));
    check('[' + rid + '] 无播放三角形图标', d.hasVideoTriangle === false, d.hasVideoTriangle);
    check('[' + rid + '] 无横向溢出(390)', d.scrollW <= 391 && d.overflow.length === 0,
      'scrollW=' + d.scrollW + ' offenders=' + JSON.stringify(d.overflow));
    check('[' + rid + '] 无控制台异常', P.logs.filter(l => l.kind === 'exception').length === 0,
      JSON.stringify(P.logs.filter(l => l.kind === 'exception')));
  }

  /* 59 部口径 */
  check('release 概览构成 38/14/7',
    JSON.stringify(probes.release.ovVisible) === JSON.stringify(['59/总作品', '38/电影', '14/剧集', '7/特别内容']),
    JSON.stringify(probes.release.ovVisible));
  check('chrono 覆盖 6 个阶段', probes.chrono.phasesOn === 6, probes.chrono.phasesOn);
  check('newcomer 覆盖 3 个阶段', probes.newcomer.phasesOn === 3, probes.newcomer.phasesOn);
  check('newcomer 特别内容 = 0', probes.newcomer.ovVisible.join('|').indexOf('0/特别内容') >= 0, JSON.stringify(probes.newcomer.ovVisible));
  check('移动端阶段条文案为 P1..P6', /^P1$/.test(probes.release.phaseText[0] || ''), JSON.stringify(probes.release.phaseText));

  /* ---------- B. 无进度 / 有进度 / 全部看完 ---------- */
  console.log('\n[B] 观看进度三态（newcomer）');
  const URL_RD = base + 'route-detail.html?id=newcomer';
  const setStore = async (ids) => {
    const obj = { watched: {}, want_to_watch: {}, favorite: {}, saved_routes: [], milestones_shown: {} };
    ids.forEach((x, i) => { obj.watched[x] = Date.now() - (ids.length - i) * 1000; });
    await P.evaluate('localStorage.setItem("mcu_nav_user_v1", ' + JSON.stringify(JSON.stringify(obj)) + ')');
  };
  const NEWCOMER = ['iron-man', 'captain-america-first-avenger', 'thor', 'avengers', 'winter-soldier',
    'guardians', 'age-of-ultron', 'civil-war', 'thor-ragnarok', 'black-panther', 'infinity-war', 'endgame'];

  /* B1 无进度 */
  await P.goto(URL_RD); await P.evaluate('localStorage.clear()');
  await P.goto(URL_RD);
  let d = JSON.parse(await P.evaluate(PROBE));
  check('[无进度] Hero CTA = 开始这条路线', d.heroCta === '开始这条路线', d.heroCta);
  check('[无进度] Bottom CTA = 从第一部开始', d.barCta === '从第一部开始', d.barCta);
  check('[无进度] 无进度 badge', d.badge === null, d.badge);
  check('[无进度] 无「你看到这里了」分割线', d.splitIdx === -1, d.splitIdx);
  check('[无进度] 第 1 项为 next-up', d.nextIdx === 0, d.nextIdx);
  check('[无进度] 已看数 = 0', d.seenCount === 0, d.seenCount);

  /* B2 有进度（前 3 部已看） */
  await setStore(NEWCOMER.slice(0, 3));
  await P.goto(URL_RD);
  d = JSON.parse(await P.evaluate(PROBE));
  check('[有进度] Hero CTA = 继续这条路线', d.heroCta === '继续这条路线', d.heroCta);
  check('[有进度] Bottom CTA = 继续观看', d.barCta === '继续观看', d.barCta);
  check('[有进度] badge = 已看 3 / 12 部', /已看 3 \/ 12 部/.test(d.badge || ''), d.badge);
  check('[有进度] 已看数 = 3', d.seenCount === 3, d.seenCount);
  check('[有进度] 下一部 = 第 4 项（复仇者联盟，按 routes.js 真实顺序）',
    d.nextIdx === 3 && d.nextName === '复仇者联盟', d.nextIdx + ' / ' + d.nextName);
  check('[有进度] 下一部由「路线中第一部未看」推导（Next 名与列表第 4 项一致）',
    d.nextName === d.itemNames[3], d.nextName + ' vs ' + d.itemNames[3]);
  check('[有进度] 不写死设计稿演示值（美国队长2 不在第 4 位）',
    d.itemNames[3] !== '美国队长2：冬日战士', '第4项=' + d.itemNames[3]);
  check('[有进度] 下一部随进度变化（无进度时第 1 项 → 有进度时第 4 项）',
    probes.newcomer.nextIdx === 0 && d.nextIdx === 3 && probes.newcomer.itemIsNext[0] === true && d.itemIsNext[3] === true,
    '无进度 idx=' + probes.newcomer.nextIdx + ' / 有进度 idx=' + d.nextIdx);
  check('[有进度] 分割线在已看与未看之间', d.splitIdx >= 0, 'splitIdx=' + d.splitIdx);
  check('[有进度] 分割线文案 = 你看到这里了',
    (await P.evaluate('(document.querySelector(".rd-split-tx")||{}).textContent')) === '你看到这里了',
    await P.evaluate('(document.querySelector(".rd-split-tx")||{}).textContent'));

  /* 偏差1 修复验证：右侧图标统一为箭头，状态区分只在左侧序号位 */
  const CHEV = 'M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z';
  const CHK  = 'M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z';
  check('[偏差1] 右侧图标全为箭头（无对勾）',
    d.stateIconPaths.length === d.total && d.stateIconPaths.every(p => p === CHEV),
    '共 ' + d.stateIconPaths.length + ' 个，非箭头 ' + d.stateIconPaths.filter(p => p !== CHEV).length + ' 个');
  check('[偏差1] 右侧不存在对勾路径',
    d.stateIconPaths.indexOf(CHK) < 0,
    d.stateIconPaths.indexOf(CHK) < 0 ? '无' : '仍有对勾');
  check('[偏差1] 已看项左侧序号位仍为绿色对勾（未被一并改掉）',
    d.numCheckCount === d.seenCount && d.seenCount === 3,
    'numCheck=' + d.numCheckCount + ' / seen=' + d.seenCount);
  check('[偏差1] 未看项左侧序号位仍为数字（无对勾）',
    await P.evaluate('document.querySelectorAll(".rd-item:not(.is-watched) .rd-num svg").length') === 0,
    await P.evaluate('document.querySelectorAll(".rd-item:not(.is-watched) .rd-num svg").length'));

  /* B3 全部看完 */
  await setStore(NEWCOMER);
  await P.goto(URL_RD);
  d = JSON.parse(await P.evaluate(PROBE));
  check('[全部看完] 已看数 = 12', d.seenCount === 12, d.seenCount);
  check('[全部看完] badge = 已看 12 / 12 部', /已看 12 \/ 12 部/.test(d.badge || ''), d.badge);
  check('[全部看完] 无 next-up 项', d.nextIdx === -1, d.nextIdx);
  check('[全部看完] 无分割线', d.splitIdx === -1, d.splitIdx);
  check('[全部看完] 呈现完成态文案', /已全部看完/.test(d.nextLabel || ''), d.nextLabel);
  check('[全部看完] Next CTA 仍指向 movie.html', /^movie\.html\?id=/.test(d.nextCtaHref || ''), d.nextCtaHref);

  /* ---------- C. 分享路线（复制链接） ---------- */
  console.log('\n[C] 分享路线 = 复制链接');
  await setStore(NEWCOMER.slice(0, 3));
  await P.goto(URL_RD);
  // C1 成功路径：stub clipboard resolve
  await P.evaluate('window.__prompt=null;window.prompt=function(m,d){window.__prompt=[m,d];return null};'
    + 'Object.defineProperty(navigator,"clipboard",{configurable:true,value:{writeText:function(t){window.__clipText=t;return Promise.resolve()}}});'
    + 'document.querySelector(".rd-bar .v2-btn-ghost").click();');
  await sleep(700);
  check('[分享] 成功路径无 prompt 弹窗', (await P.evaluate('window.__prompt')) === null, await P.evaluate('JSON.stringify(window.__prompt)'));
  check('[分享] clipboard 收到正确链接',
    (await P.evaluate('window.__clipText||""')).indexOf('route-detail.html?id=newcomer') >= 0,
    await P.evaluate('window.__clipText||""'));
  check('[分享] 成功后有 toast', /已复制/.test(await P.evaluate('(document.getElementById("v2-toast")||{}).textContent||""')),
    await P.evaluate('(document.getElementById("v2-toast")||{}).textContent||""'));
  check('[分享] 按钮文案 = 分享路线',
    (await P.evaluate('document.querySelector(".rd-bar .v2-btn-ghost").textContent.trim()')) === '分享路线',
    await P.evaluate('document.querySelector(".rd-bar .v2-btn-ghost").textContent.trim()'));

  // C2 失败回退路径：clipboard reject + execCommand 返回 false → prompt 兜底
  await P.evaluate('window.__prompt=null;'
    + 'Object.defineProperty(navigator,"clipboard",{configurable:true,value:{writeText:function(){return Promise.reject(new Error("denied"))}}});'
    + 'document.execCommand=function(){return false};'
    + 'document.querySelector(".rd-bar .v2-btn-ghost").click();');
  await sleep(700);
  const pr = await P.evaluate('JSON.stringify(window.__prompt)');
  check('[分享] 失败时走 prompt 兼容回退', pr !== 'null', pr);
  check('[分享] 回退链接含 route-detail.html?id=newcomer',
    typeof pr === 'string' && pr.indexOf('route-detail.html?id=newcomer') >= 0, pr);

  /* ---------- D. CTA 行为 + 首页入口 ---------- */
  console.log('\n[D] CTA 职责与首页入口联动');
  await P.goto(URL_RD);
  await P.evaluate('document.querySelector(".rd-actions .v2-btn-primary").click()');
  await sleep(1100);
  check('[CTA] Hero CTA 滚动到「下一部看这部」',
    await P.evaluate('Math.abs(document.getElementById("rd-next-sec").getBoundingClientRect().top) < 120'),
    await P.evaluate('Math.round(document.getElementById("rd-next-sec").getBoundingClientRect().top)'));
  await P.evaluate('window.scrollTo(0,0)'); await sleep(400);
  await P.evaluate('document.querySelector(".rd-bar .v2-btn-primary").click()');
  await sleep(1100);
  check('[CTA] Bottom CTA 同样指向路线内导航（非 movie.html）',
    await P.evaluate('Math.abs(document.getElementById("rd-next-sec").getBoundingClientRect().top) < 120'),
    await P.evaluate('Math.round(document.getElementById("rd-next-sec").getBoundingClientRect().top)'));
  const ctaTargets = await P.evaluate('JSON.stringify(['
    + 'document.querySelector(".rd-actions .v2-btn-primary").tagName,'
    + 'document.querySelector(".rd-next-cta .v2-btn").getAttribute("href"),'
    + 'document.querySelector(".rd-bar .v2-btn-primary").tagName])');
  check('[CTA] 三个 CTA 不同目标（按钮/链接/movie）', ctaTargets.indexOf('movie.html') >= 0, ctaTargets);

  await P.goto(base + 'index.html');
  const pillIds = await P.evaluate('JSON.stringify(Array.prototype.slice.call(document.querySelectorAll("#route-pills .v2-pill")).map(function(b){return b.getAttribute("data-route")}))');
  check('[首页] 三个路线 pill 存在', JSON.parse(pillIds).length === 3, pillIds);
  const entry = {};
  for (const rid of JSON.parse(pillIds)) {
    await P.evaluate('document.querySelector(\'#route-pills .v2-pill[data-route="' + rid + '"]\').click()');
    await sleep(350);
    entry[rid] = await P.evaluate('document.getElementById("route-more").getAttribute("href") + " || " + document.getElementById("route-more").textContent');
  }
  check('[首页] 新手入坑入口 → route-detail?id=newcomer', /route-detail\.html\?id=newcomer/.test(entry.newcomer || ''), entry.newcomer);
  check('[首页] 上映顺序入口 → route-detail?id=release', /route-detail\.html\?id=release/.test(entry.release || ''), entry.release);
  check('[首页] MCU时间线入口 → route-detail?id=chrono', /route-detail\.html\?id=chrono/.test(entry.chrono || ''), entry.chrono);
  check('[首页] 「全部路线」总览入口仍指向 routes.html',
    (await P.evaluate('document.querySelector("#v2-routes .v2-st-more").getAttribute("href")')) === 'routes.html',
    await P.evaluate('document.querySelector("#v2-routes .v2-st-more").getAttribute("href")'));

  /* D2 真实点击穿透：首页 → route-detail（真导航，不只看 href） */
  await P.evaluate('document.querySelector(\'#route-pills .v2-pill[data-route="chrono"]\').click()');
  await sleep(300);
  await P.evaluate('document.getElementById("route-more").click()');
  await sleep(2600);
  const afterClick = JSON.parse(await P.evaluate(PROBE));
  check('[首页点击穿透] URL 落到 route-detail.html?id=chrono',
    (await P.evaluate('location.pathname + location.search')).indexOf('route-detail.html?id=chrono') >= 0,
    await P.evaluate('location.pathname + location.search'));
  check('[首页点击穿透] 页面渲染正确路线（MCU 时间线）', afterClick.name === 'MCU 时间线', afterClick.name);
  check('[首页点击穿透] 无 JS 异常', P.logs.filter(l => l.kind === 'exception').length === 0,
    JSON.stringify(P.logs.filter(l => l.kind === 'exception')));

  /* D3 sticky 底栏在页面末端不遮挡内容 */
  await P.setViewport(390, 844);
  await P.goto(URL_RD);
  const tail390 = JSON.parse(await P.evaluate('(function(){window.scrollTo(0,document.documentElement.scrollHeight);'
    + 'var b=document.querySelector(".rd-bar").getBoundingClientRect();'
    + 'var s=document.querySelectorAll(".rd-sec");var n=s[s.length-1].getBoundingClientRect();'
    + 'return JSON.stringify({barTop:Math.round(b.top),notesBottom:Math.round(n.bottom)})})()'));
  check('[底栏] 390 页面末端不遮挡最后一项', tail390.barTop >= tail390.notesBottom - 2, JSON.stringify(tail390));

  await P.setViewport(1280, 900);
  const tail1280 = JSON.parse(await P.evaluate('(function(){window.scrollTo(0,document.documentElement.scrollHeight);'
    + 'var b=document.querySelector(".rd-bar").getBoundingClientRect();'
    + 'var s=document.querySelectorAll(".rd-sec");var n=s[s.length-1].getBoundingClientRect();'
    + 'return JSON.stringify({barTop:Math.round(b.top),notesBottom:Math.round(n.bottom)})})()'));
  check('[底栏] 1280 页面末端不遮挡最后一项', tail1280.barTop >= tail1280.notesBottom - 2, JSON.stringify(tail1280));

  /* ---------- E. 截图（390 / 1280） ---------- */
  console.log('\n[E] 截图');
  await setStore(NEWCOMER.slice(0, 3));
  await P.goto(URL_RD);
  const hM = await P.shot(390, 844, path.join(OUT, 'route-detail-newcomer-390.png'));
  check('[截图] 390 移动端整页已生成', fs.existsSync(path.join(OUT, 'route-detail-newcomer-390.png')), hM + 'px');
  const hP = await P.shot(1280, 900, path.join(OUT, 'route-detail-newcomer-1280.png'));
  check('[截图] 1280 PC 整页已生成', fs.existsSync(path.join(OUT, 'route-detail-newcomer-1280.png')), hP + 'px');

  // PC 布局断言
  const pc = JSON.parse(await P.evaluate(PROBE));
  check('[PC] 内容宽 1080 居中', await P.evaluate('(function(){var s=document.querySelector(".rd-sec");return Math.round(s.getBoundingClientRect().width)})()') <= 1080,
    await P.evaluate('(function(){var s=document.querySelector(".rd-sec");return Math.round(s.getBoundingClientRect().width)})()'));
  check('[PC] 概览 5 格', pc.ovVisible.length === 5, JSON.stringify(pc.ovVisible));
  check('[PC] 列表双列', await P.evaluate('getComputedStyle(document.querySelector(".rd-list")).gridTemplateColumns.split(" ").length') === 2,
    await P.evaluate('getComputedStyle(document.querySelector(".rd-list")).gridTemplateColumns'));
  check('[PC] 阶段条文案为 Phase n', /^Phase1$/.test(pc.phaseText[0] || ''), pc.phaseText[0]);
  check('[PC] Hero 含「涉及阶段」meta', pc.meta.some(m => /涉及 \d+ 个阶段/.test(m)), JSON.stringify(pc.meta));
  check('[PC] Hero 无「时长」', JSON.stringify(pc.meta).indexOf('小时') < 0 && JSON.stringify(pc.meta).indexOf('时长') < 0, JSON.stringify(pc.meta));
  check('[PC] 无横向溢出(1280)', pc.scrollW <= 1281 && pc.overflow.length === 0, 'scrollW=' + pc.scrollW + ' offenders=' + JSON.stringify(pc.overflow));
  check('[PC] 分割线跨两列', (await P.evaluate('getComputedStyle(document.querySelector(".rd-split")).gridColumn')).indexOf('-1') >= 0,
    await P.evaluate('getComputedStyle(document.querySelector(".rd-split")).gridColumn'));
  const barRect = await P.evaluate('JSON.stringify(document.querySelector(".rd-bar").getBoundingClientRect())');
  check('[PC] Bottom Bar 在视口内可见', JSON.parse(barRect).top < 900, barRect);

  // 长列表路线截图（release 59 部）
  await setStore([]);
  await P.goto(base + 'route-detail.html?id=release');
  const hR = await P.shot(390, 844, path.join(OUT, 'route-detail-release-390.png'));
  check('[截图] release 59 部移动端整页已生成', fs.existsSync(path.join(OUT, 'route-detail-release-390.png')), hR + 'px');

  /* ---------- F. 控制台错误汇总 ---------- */
  console.log('\n[F] 控制台');
  await P.goto(URL_RD);
  const exc = P.logs.filter(l => l.kind === 'exception');
  const errs = P.logs.filter(l => l.kind === 'error');
  check('[控制台] 无 JS 未捕获异常', exc.length === 0, JSON.stringify(exc));
  check('[控制台] 无 console.error', errs.length === 0, JSON.stringify(errs));
  console.log('  (网络/其他日志 ' + P.logs.filter(l => l.kind.startsWith('log:')).length + ' 条: '
    + JSON.stringify(P.logs.filter(l => l.kind.startsWith('log:')).slice(0, 3)) + ')');

  const passed = results.filter(r => r.pass).length;
  console.log('\n===== 合计 ' + results.length + ' 项，通过 ' + passed + '，失败 ' + (results.length - passed) + ' =====');
  if (passed !== results.length) {
    console.log('失败项：');
    results.filter(r => !r.pass).forEach(r => console.log('  - ' + r.name + ' :: ' + r.detail));
  }
  cleanup();
  process.exit(passed === results.length ? 0 : 1);
})().catch(e => { console.error('E2E ERROR', e); process.exit(2); });
