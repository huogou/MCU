/* G10.1 部署后核验：①服务器 6 文件 md5 == 本地；②线上 https 拉取 news.js 字节一致；③线上渲染（headless Chrome，生产域名 + cache-bust） */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const os = require('os');

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const H5 = path.join(ROOT, 'h5');
const DOMAIN = 'https://mcuatlas.xyz';
const CB = 'cb=' + Date.now();

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? ' → ' + detail : '')); }
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ---- ① 服务器 md5 vs 本地 ---- */
function localMd5(rel) {
  return crypto.createHash('sha256').update(fs.readFileSync(path.join(H5, rel))).digest('hex');
}
const files = ['data/news.js', 'news.html', 'news-detail.html', 'assets/css/v2n-news.css', 'assets/js/components.js', 'index.html'];
const serverMd5 = {};
fs.readFileSync(path.join(__dirname, 'server-md5-after.txt'), 'utf8').split('\n').forEach(l => {
  const m = /^\s*([0-9a-f]{64})\s+(.+)$/.exec(l.trim());
  if (m) serverMd5[m[2]] = m[1];
});
files.forEach(rel => {
  ok('md5 一致：' + rel, serverMd5[rel] === localMd5(rel), serverMd5[rel] + ' vs ' + localMd5(rel));
});

/* ---- ② 线上 https 拉取 news.js ---- */
(async function main() {
  const r = await fetch(DOMAIN + '/data/news.js?' + CB, { headers: { 'Cache-Control': 'no-cache' } });
  const text = await r.text();
  const sha = crypto.createHash('sha256').update(text).digest('hex').toUpperCase();
  ok('线上 news.js HTTP ' + r.status, r.status === 200, String(r.status));
  ok('线上 news.js SHA256 == 本地 G9 版（EBF67DE0…56FCAF）',
    sha === 'EBF67DE08BF8C391C59F05ED82CB43144A2726F879EF7185388CA7939E56FCAF', sha.slice(0, 16) + '…');
  const c2 = {}; c2.window = c2; c2.global = c2; c2.console = console; c2.URL = URL; c2.Date = Date; c2.Math = Math; c2.JSON = JSON;
  require('vm').createContext(c2);
  require('vm').runInContext(text, c2, { filename: 'news.js' });
  const cnt = c2.window.MCU_NEWS.length;
  ok('线上数据条数 = 35（vm 解析）', cnt === 35, 'actual ' + cnt);

  /* ---- ③ 线上渲染（headless Chrome） ---- */
  const { spawn } = require('child_process');
  function findChrome() {
    const cands = [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      path.join(os.homedir(), 'AppData\\Local\\Google\\Chrome\\Application\\chrome.exe'),
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
    ];
    for (const c of cands) if (fs.existsSync(c)) return c;
    return null;
  }
  class CDP {
    constructor(ws) { this.ws = ws; this.id = 0; this.pending = new Map(); this.handlers = []; }
    static async connect(wsUrl) {
      const ws = new WebSocket(wsUrl);
      await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
      const c = new CDP(ws);
      ws.onmessage = ev => {
        const msg = JSON.parse(ev.data);
        if (msg.id && c.pending.has(msg.id)) {
          const { res, rej } = c.pending.get(msg.id); c.pending.delete(msg.id);
          msg.error ? rej(new Error(JSON.stringify(msg.error))) : res(msg.result);
        } else if (msg.method) { c.handlers.forEach(h => h(msg)); }
      };
      return c;
    }
    send(method, params) {
      const id = ++this.id;
      return new Promise((res, rej) => {
        this.pending.set(id, { res, rej });
        this.ws.send(JSON.stringify({ id, method, params: params || {} }));
      });
    }
    on(fn) { this.handlers.push(fn); }
    async evalExpr(expr) {
      const r2 = await this.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
      if (r2.exceptionDetails) throw new Error(r2.exceptionDetails.text);
      return r2.result.value;
    }
  }

  const chrome = findChrome();
  if (!chrome) { console.log('未找到 Chrome，渲染验证跳过（数据层已验证）'); process.exit(fail ? 1 : 0); }
  const profile = path.join(os.tmpdir(), 'mcu-g101-' + Date.now());
  const proc = spawn(chrome, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--window-size=1440,900', '--user-data-dir=' + profile,
    '--remote-debugging-port=9335', 'about:blank'
  ], { stdio: 'ignore' });
  let wsUrl = null;
  for (let i = 0; i < 50; i++) {
    await sleep(300);
    try {
      const rr = await fetch('http://127.0.0.1:9335/json/version');
      const jj = await rr.json();
      if (jj.webSocketDebuggerUrl) { wsUrl = jj.webSocketDebuggerUrl; break; }
    } catch (e) { /* wait */ }
  }
  if (!wsUrl) { console.log('CDP 未就绪'); proc.kill(); process.exit(1); }
  const browser = await CDP.connect(wsUrl);
  const t = await browser.send('Target.createTarget', { url: 'about:blank' });
  const page = await CDP.connect('ws://127.0.0.1:9335/devtools/page/' + t.targetId);
  let errors = [];
  const NOISE = /tcloudbasegateway|Access to fetch|blocked by CORS|favicon|net::ERR|api\/|Failed to load resource/i;
  page.on(m => {
    if (m.method === 'Runtime.exceptionThrown') {
      const d = m.params.exceptionDetails;
      errors.push('EXCEPTION: ' + (d.exception && d.exception.description ? d.exception.description.split('\n')[0] : d.text));
    }
  });
  await page.send('Runtime.enable');
  await page.send('Page.enable');
  page.on(m => {
    if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') {
      const tx = m.params.entry.text || '';
      if (!NOISE.test(tx)) errors.push('LOG.ERROR: ' + tx);
    }
  });

  /* 列表页（线上） */
  errors = [];
  await page.send('Page.navigate', { url: DOMAIN + '/news.html?' + CB });
  await sleep(2500);
  ok('线上 news.html 无 JS 异常', errors.length === 0, errors.join(' | '));
  for (let i = 0; i < 10; i++) {
    const more = await page.evalExpr('!!document.getElementById("news-more")');
    if (!more) break;
    await page.evalExpr('document.getElementById("news-more").click(); true');
    await sleep(400);
  }
  const listIds = await page.evalExpr('JSON.stringify(Array.prototype.map.call(document.querySelectorAll("#news-list .v2n-news-card"), function(c){return c.dataset.id;}))').then(JSON.parse);
  ok('线上列表渲染 35 条', listIds.length === 35, 'actual ' + listIds.length);
  const newIn = listIds.filter(id => /news-2026-09-23-/.test(id));
  ok('线上新增 20 条卡片全部在场', newIn.length === 20, 'actual ' + newIn.length);

  /* 新增条目详情页（线上） */
  errors = [];
  await page.send('Page.navigate', { url: DOMAIN + '/news-detail.html?id=' + (newIn[0] || 'news-2026-09-23-001') + '&' + CB });
  await sleep(2000);
  const d1 = await page.evalExpr('JSON.stringify({title:(document.querySelector(".v2n-detail-title")||{}).textContent||"",badge:!!document.querySelector(".v2n-detail-head .v2n-status-badge")})').then(JSON.parse);
  ok('线上新增条目详情页渲染（标题+状态标签）', (d1.title || '').trim().length > 0 && d1.badge === true, d1.title);
  ok('线上详情页无 JS 异常', errors.length === 0, errors.join(' | '));

  /* 现网 010 supersedes 链（线上） */
  await page.send('Page.navigate', { url: DOMAIN + '/news-detail.html?id=news-2026-09-20-010&' + CB });
  await sleep(2000);
  const corr = await page.evalExpr('JSON.stringify({box:!!document.querySelector(".v2n-correction-notice"),chain:!!document.querySelector(".v2n-chain")})').then(JSON.parse);
  ok('线上 supersedes 链式引用展示正常', corr.box && corr.chain, JSON.stringify(corr));

  /* 首页资讯 Section（线上） */
  await page.send('Page.navigate', { url: DOMAIN + '/index.html?' + CB });
  await sleep(2500);
  const homeCnt = await page.evalExpr('document.querySelectorAll("#news-list .v2n-news-card").length');
  ok('线上首页资讯 Section 卡片渲染（R1 口径 6 条）', homeCnt === 6, 'actual ' + homeCnt);

  console.log('\n============================================================');
  console.log('结果：' + pass + ' PASS / ' + fail + ' FAIL');
  console.log('============================================================');
  proc.kill();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FATAL: ' + e.message); process.exit(1); });
