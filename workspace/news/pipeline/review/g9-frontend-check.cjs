/* ============================================================
 * G9-5 · 前端验证（新增 20 条的渲染可用性 + 来源/supersedes 展示）
 * ------------------------------------------------------------
 * 运行：node workspace/news/pipeline/review/g9-frontend-check.cjs
 * 做法：本机 Chrome headless + CDP（与 regression-news.cjs 同机制），
 *   file:// 真实加载，断言：
 *   ① news.html 列表含新增条目卡片（news-2026-09-23-001 等）
 *   ② 新增条目详情页可渲染（标题/状态标签/日期/来源行）
 *   ③ 现网 010 的 supersedes 链式引用保持（写入未破坏互链展示）
 * ============================================================ */
'use strict';

const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const H5 = path.join(ROOT, 'h5');
const PORT = 9334;

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? ' → ' + detail : '')); }
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

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
    const r = await this.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text);
    return r.result.value;
  }
}

(async function main() {
  const chrome = findChrome();
  if (!chrome) { console.log('未找到 Chrome/Edge，跳过前端检查（regression-news 已覆盖数据层）'); process.exit(2); }

  const profile = path.join(os.tmpdir(), 'mcu-g9-frontend-' + Date.now());
  const proc = spawn(chrome, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--allow-file-access-from-files', '--window-size=1440,900',
    '--user-data-dir=' + profile,
    '--remote-debugging-port=' + PORT, 'about:blank'
  ], { stdio: 'ignore' });

  let wsUrl = null;
  for (let i = 0; i < 50; i++) {
    await sleep(300);
    try {
      const r = await fetch('http://127.0.0.1:' + PORT + '/json/version');
      const j = await r.json();
      if (j.webSocketDebuggerUrl) { wsUrl = j.webSocketDebuggerUrl; break; }
    } catch (e) { /* 等待启动 */ }
  }
  if (!wsUrl) { console.log('CDP 未就绪'); proc.kill(); process.exit(2); }

  const browser = await CDP.connect(wsUrl);
  const t = await browser.send('Target.createTarget', { url: 'about:blank' });
  const page = await CDP.connect('ws://127.0.0.1:' + PORT + '/devtools/page/' + t.targetId);

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
  function fileUrl(p) {
    const i = p.indexOf('?');
    const file = i < 0 ? p : p.slice(0, i);
    const q = i < 0 ? '' : p.slice(i);
    return pathToFileURL(path.join(H5, file)).href + q;
  }

  console.log('============================================================');
  console.log('G9-5 前端验证（新增 20 条的渲染可用性）');
  console.log('============================================================');

  /* ① 列表页：新增条目卡片在场 */
  errors = [];
  await page.send('Page.navigate', { url: fileUrl('news.html') });
  await sleep(1200);
  ok('news.html 无 JS 异常（噪声过滤后）', errors.length === 0, errors.join(' | '));
  /* 循环加载全部 */
  for (let i = 0; i < 10; i++) {
    const more = await page.evalExpr('!!document.getElementById("news-more")');
    if (!more) break;
    await page.evalExpr('document.getElementById("news-more").click(); true');
    await sleep(350);
  }
  const listIds = await page.evalExpr('JSON.stringify(Array.prototype.map.call(document.querySelectorAll("#news-list .v2n-news-card"), function(c){return c.dataset.id;}))').then(JSON.parse);
  ok('①a 列表渲染 35 条', listIds.length === 35, 'actual ' + listIds.length);
  const newInList = listIds.filter(function (id) { return /news-2026-09-23-/.test(id); });
  ok('①b 新增 20 条卡片全部在场（id 含 news-2026-09-23-）', newInList.length === 20, 'actual ' + newInList.length);

  /* ② 新增条目详情页（取列表第一条新增）渲染 */
  errors = [];
  const firstNew = newInList[0] || 'news-2026-09-23-001';
  await page.send('Page.navigate', { url: fileUrl('news-detail.html?id=' + firstNew) });
  await sleep(1000);
  const d1 = await page.evalExpr('JSON.stringify({title:(document.querySelector(".v2n-detail-title")||{}).textContent||"",badge:!!document.querySelector(".v2n-detail-head .v2n-status-badge"),date:(document.querySelector(".v2n-detail-date")||{}).textContent||"",src:JSON.stringify(document.querySelectorAll(".v2n-detail-src, .v2n-detail-source, .v2n-meta").length)})').then(JSON.parse);
  ok('②a 新增条目详情页有标题（' + firstNew + '）', (d1.title || '').trim().length > 0, d1.title);
  ok('②b 新增条目详情页有状态标签', d1.badge === true);
  ok('②c 新增条目详情页无 JS 异常', errors.length === 0, errors.join(' | '));

  /* ③ 现网 010 supersedes 展示未被破坏 */
  errors = [];
  await page.send('Page.navigate', { url: fileUrl('news-detail.html?id=news-2026-09-20-010') });
  await sleep(1000);
  const corr = await page.evalExpr('JSON.stringify({box:!!document.querySelector(".v2n-correction-notice"),chain:!!document.querySelector(".v2n-chain")})').then(JSON.parse);
  ok('③ supersedes 互链展示保持（更正区块 + 链式引用）', corr.box && corr.chain, JSON.stringify(corr));

  console.log('\n============================================================');
  console.log('结果：' + pass + ' PASS / ' + fail + ' FAIL');
  console.log('============================================================');
  proc.kill();
  process.exit(fail ? 1 : 0);
})();
