/* ============================================================
 * MCU 宇宙导航 · 资讯模块 V2.2 —— 人工视觉验收截图产出
 * ------------------------------------------------------------
 * 运行：node workspace/news/shots.cjs
 * 输出：workspace/news/shots/*.png
 *
 * 本脚本**只截图与只读检查**，不改动任何代码、不写任何数据文件。
 * 覆盖：首页 Section（PC/390/375）、news.html（PC/移动，含加载更多前后）、
 *       news-detail.html（PC 5 种状态 + 移动端 3 种状态）
 * 附：两处视觉规则的机器校验（corrected 非绿色 / 多家媒体报道 + 独立来源数）
 * ============================================================ */
'use strict';

const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.resolve(__dirname, '..', '..');
const H5 = path.join(ROOT, 'h5');
const SHOTS = path.join(ROOT, 'workspace', 'news', 'shots');
const PORT = 9334;

fs.mkdirSync(SHOTS, { recursive: true });
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
  constructor(ws) { this.ws = ws; this.id = 0; this.pending = new Map(); }
  static async connect(wsUrl) {
    const ws = new WebSocket(wsUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    const c = new CDP(ws);
    ws.onmessage = ev => {
      const m = JSON.parse(ev.data);
      if (m.id && c.pending.has(m.id)) {
        const { res, rej } = c.pending.get(m.id); c.pending.delete(m.id);
        m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result);
      }
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
  async evalExpr(expression) {
    const r = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text);
    return r.result.value;
  }
}

(async function main() {
  const chrome = findChrome();
  if (!chrome) { console.log('未找到 Chrome/Edge'); process.exit(2); }

  const profile = path.join(os.tmpdir(), 'mcu-news-shot-' + Date.now());
  const proc = spawn(chrome, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--allow-file-access-from-files', '--hide-scrollbars',
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
    } catch (e) { /* 等启动 */ }
  }
  if (!wsUrl) { console.log('CDP 未就绪'); proc.kill(); process.exit(2); }

  const browser = await CDP.connect(wsUrl);
  const t = await browser.send('Target.createTarget', { url: 'about:blank' });
  const page = await CDP.connect('ws://127.0.0.1:' + PORT + '/devtools/page/' + t.targetId);
  await page.send('Page.enable');
  await page.send('Runtime.enable');

  const fileUrl = (p) => {
    const i = p.indexOf('?');
    const f = i < 0 ? p : p.slice(0, i);
    const q = i < 0 ? '' : p.slice(i);
    return pathToFileURL(path.join(H5, f)).href + q;
  };

  async function setViewport(w, h) {
    await page.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w < 720 });
  }
  async function save(name) {
    const r = await page.send('Page.captureScreenshot', { format: 'png' });
    const file = path.join(SHOTS, name);
    fs.writeFileSync(file, Buffer.from(r.data, 'base64'));
    const size = fs.statSync(file).size;
    console.log('  SHOT  ' + name + '  (' + Math.round(size / 1024) + ' KB)');
    return file;
  }
  async function visit(p, w, h) {
    await setViewport(w, h);
    await page.send('Page.navigate', { url: fileUrl(p) });
    await sleep(1500);
  }
  /* 整页截图：把视口高度撑到文档高度后截图，避免 clip 坐标换算的坑 */
  async function fullShot(name) {
    const h = await page.evalExpr('Math.min(document.documentElement.scrollHeight, 12000)');
    const w = await page.evalExpr('window.innerWidth');
    await page.send('Emulation.setDeviceMetricsOverride', { width: w, height: Math.ceil(h), deviceScaleFactor: 1, mobile: w < 720 });
    await sleep(400);
    await save(name);
  }
  /* 元素截图：先把元素滚到顶部，再把视口高度设为元素高度 */
  async function elShot(sel, name) {
    const box = await page.evalExpr(`(function(){
      var el = document.querySelector(${JSON.stringify(sel)});
      if (!el) return null;
      el.scrollIntoView({block:'start'});
      var r = el.getBoundingClientRect();
      return { top: r.top + window.scrollY, h: Math.ceil(r.height), w: window.innerWidth };
    })()`);
    if (!box) { console.log('  MISS  ' + sel + ' (not found)'); return null; }
    await page.send('Emulation.setDeviceMetricsOverride', { width: box.w, height: Math.min(box.h + 24, 12000), deviceScaleFactor: 1, mobile: box.w < 720 });
    await sleep(300);
    await page.evalExpr(`window.scrollTo(0, ${box.top}); true`);
    await sleep(300);
    return save(name);
  }

  console.log('============================================================');
  console.log('资讯模块 V2.2 · 人工视觉验收截图');
  console.log('============================================================\n');

  /* ============ 1. 首页 ============ */
  console.log('■ 1. 首页 index.html');
  await visit('index.html', 1440, 900);
  await elShot('#v2-news', 'home_pc_section.png');
  await setViewport(1440, 900);
  await sleep(300);
  await fullShot('home_pc_full.png');
  await visit('index.html', 390, 844);
  await elShot('#v2-news', 'home_390_section.png');
  await setViewport(390, 844);
  await sleep(200);
  await fullShot('home_390_full.png');
  await visit('index.html', 375, 812);
  await elShot('#v2-news', 'home_375_section.png');

  /* ============ 2. news.html ============ */
  console.log('\n■ 2. news.html');
  await visit('news.html', 1440, 900);
  await fullShot('news_pc_batch1.png');
  await elShot('#news-footer', 'news_pc_footer_more.png');
  await setViewport(1440, 900);
  await sleep(200);
  await page.evalExpr('document.getElementById("news-more").click(); true');
  await sleep(700);
  await fullShot('news_pc_all.png');
  await elShot('#news-footer', 'news_pc_footer_end.png');

  await visit('news.html', 390, 844);
  await fullShot('news_390_batch1.png');
  await elShot('#news-footer', 'news_390_footer_more.png');
  await visit('news.html', 375, 812);
  await fullShot('news_375_batch1.png');

  /* ============ 3. news-detail.html ============ */
  console.log('\n■ 3. news-detail.html');
  const PC_STATES = [
    ['news-2026-09-22-001', 'official_confirmed', 'detail_pc_official.png'],
    ['news-2026-09-22-002', 'multi_source_reported', 'detail_pc_multi.png'],
    ['news-2026-09-21-008', 'conflicting', 'detail_pc_conflict.png'],
    ['news-2026-09-20-009', 'officially_denied', 'detail_pc_denied.png'],
    ['news-2026-09-20-010', 'corrected', 'detail_pc_corrected.png']
  ];
  for (const [id, label, file] of PC_STATES) {
    await visit('news-detail.html?id=' + id, 1440, 900);
    await fullShot(file);
  }
  const MB_STATES = [
    ['news-2026-09-22-001', 'detail_390_official.png'],
    ['news-2026-09-21-008', 'detail_390_conflict.png'],
    ['news-2026-09-20-010', 'detail_390_corrected.png']
  ];
  for (const [id, file] of MB_STATES) {
    await visit('news-detail.html?id=' + id, 390, 844);
    await fullShot(file);
  }
  /* 375px（窄屏下限）补充：详情页 corrected 与列表页 */
  await visit('news-detail.html?id=news-2026-09-20-010', 375, 812);
  await fullShot('detail_375_corrected.png');

  /* ============ 4. 两处视觉规则机器校验 ============ */
  console.log('\n■ 4. 视觉规则机器校验');
  const checks = [];
  function ck(name, cond, detail) { checks.push({ name, cond, detail }); console.log('  ' + (cond ? 'PASS' : 'FAIL') + '  ' + name + (detail ? '  → ' + detail : '')); }

  await visit('news-detail.html?id=news-2026-09-20-010', 1440, 900);
  const corr = await page.evalExpr(`(function(){
    var b = document.querySelector('.v2n-status-badge--corrected');
    if (!b) return null;
    var s = getComputedStyle(b);
    var txt = b.textContent.trim();
    return { color: s.color, bg: s.backgroundColor, text: txt, cls: b.className };
  })()`);
  ck('corrected 标签存在', !!corr);
  if (corr) {
    ck('corrected 文字色为暗金灰 #C9901E（rgb(201, 144, 30)）', /rgb\(201,\s*144,\s*30\)/.test(corr.color), corr.color);
    ck('corrected 文字色不是绿色系', !/rgb\(40,\s*180,\s*135\)|rgb\(63,\s*185,\s*138\)/.test(corr.color), corr.color);
    ck('corrected 使用 --corrected 类（非绿色语义类）', corr.cls.indexOf('--corrected') > 0, corr.cls);
  }

  await visit('news.html', 1440, 900);
  const multi = await page.evalExpr(`(function(){
    var b = document.querySelector('.v2n-status-badge--multi_source_reported');
    if (!b) return null;
    var card = b.closest('.v2n-news-card');
    return { text: b.textContent.trim(), color: getComputedStyle(b).color,
             meta: card ? (card.querySelector('.v2n-news-card__meta')||{}).textContent||'' : '' };
  })()`);
  ck('multi_source_reported 标签存在', !!multi);
  if (multi) {
    ck('标签文案为产品固定文案「多家媒体报道」', multi.text === '多家媒体报道', multi.text);
    ck('标签文案不是「多源报道」', multi.text.indexOf('多源报道') < 0, multi.text);
    ck('蓝色系（rgb(91, 141, 239)）', /rgb\(91,\s*141,\s*239\)/.test(multi.color), multi.color);
    ck('独立来源数使用「已由 N 个独立来源报道」', /独立来源/.test(multi.meta), multi.meta);
    ck('未把媒体数量当独立来源数（文案中无「家媒体报道」计数）', !/\d+\s*家媒体报道/.test(multi.meta), multi.meta);
  }

  /* 全站是否误用绿色：扫描三处页面的状态标签计算色 */
  const greenScan = await (async () => {
    const res = [];
    for (const p of ['index.html', 'news.html', 'news-detail.html?id=news-2026-09-20-010']) {
      await visit(p, 1440, 900);
      const hit = await page.evalExpr(`(function(){
        var out = [];
        document.querySelectorAll('.v2n-status-badge').forEach(function(b){
          var c = getComputedStyle(b).color;
          if (/rgb\\(40,\\s*180,\\s*135\\)|rgb\\(63,\\s*185,\\s*138\\)|rgb\\(151,\\s*196,\\s*89\\)/.test(c)) out.push(b.className + ' ' + c);
        });
        return JSON.stringify(out);
      })()`);
      res.push(p + ' → ' + hit);
    }
    return res.join(' | ');
  })();
  ck('三处页面均无绿色状态标签', !/rgb\(40|rgb\(63/.test(greenScan), greenScan);

  console.log('\n============================================================');
  const failed = checks.filter(c => !c.cond);
  console.log('视觉规则校验：' + (checks.length - failed.length) + ' PASS / ' + failed.length + ' FAIL');
  console.log('截图目录：' + SHOTS);
  console.log('============================================================');

  await browser.send('Target.closeTarget', { targetId: t.targetId }).catch(() => {});
  proc.kill();
  process.exit(failed.length ? 1 : 0);
})().catch(e => { console.log('运行异常：' + e.message); process.exit(2); });
