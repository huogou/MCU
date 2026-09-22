/* ============================================================
 * MCU 宇宙导航 · V2.2 资讯模块接入后 —— 全站回归 + 页面实测
 * ------------------------------------------------------------
 * 运行：node workspace/news/regression-news.cjs
 *
 * 做法：启动本机 Chrome（headless + CDP），以 file:// 真实加载页面，
 *   ① 收集每个页面的 JS 异常与 console error
 *   ② 断言既有数据计数未被破坏（MCU_CONTENT 59 / RELATIONS 92 / ROUTES 11）
 *   ③ 断言既有页面关键渲染节点仍在（首页路线轨、地图 canvas 等）
 *   ④ 实测资讯模块三处：首页 Section / 列表页加载更多 / 详情页信息块
 *   ⑤ 实测关联跳转参数与阶段不可点击（D17 / D18）
 * ============================================================ */
'use strict';

const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.resolve(__dirname, '..', '..');
const H5 = path.join(ROOT, 'h5');
const PORT = 9333;

let pass = 0, fail = 0; const fails = [];
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; fails.push(name + (detail ? ' → ' + detail : '')); console.log('  FAIL  ' + name + (detail ? ' → ' + detail : '')); }
}
function section(t) { console.log('\n■ ' + t); }
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

/* ---------------- 极简 CDP 客户端 ---------------- */
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
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' :: ' + (r.exceptionDetails.exception && r.exceptionDetails.exception.description));
    return r.result.value;
  }
}

(async function main() {
  const chrome = findChrome();
  if (!chrome) { console.log('未找到 Chrome/Edge，跳过回归'); process.exit(2); }

  const profile = path.join(os.tmpdir(), 'mcu-news-reg-' + Date.now());
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

  console.log('============================================================');
  console.log('V2.2 资讯模块接入后 · 全站回归 + 页面实测');
  console.log('============================================================');

  let errors = [];
  page.on(m => {
    if (m.method === 'Runtime.exceptionThrown') {
      const d = m.params.exceptionDetails;
      errors.push('EXCEPTION: ' + (d.exception && d.exception.description ? d.exception.description.split('\n')[0] : d.text));
    }
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
      errors.push('CONSOLE.ERROR: ' + (m.params.args || []).map(a => a.value || a.description || '').join(' '));
    }
  });
  /* 噪声过滤：app.js 的 CloudBase 统计/反馈在 file:// 下必然触发 CORS 拦截，
   * 这是**改动前就存在**的环境噪声（与本地打开方式有关，非本次引入）。
   * 过滤后仍断言「不存在其他任何 JS 异常」，以保证回归有效。 */
  let filteredNoise = 0;
  const NOISE = /tcloudbasegateway|Access to fetch|blocked by CORS|favicon|net::ERR|api\/|Failed to load resource/i;

  await page.send('Runtime.enable');
  await page.send('Page.enable');
  await page.send('Log.enable');
  page.on(m => {
    if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') {
      const tx = m.params.entry.text || '';
      if (NOISE.test(tx)) { filteredNoise++; return; }
      errors.push('LOG.ERROR: ' + tx);
    }
  });

  /* 带查询串的 file:// URL：pathToFileURL 会把 '?' 转义成 %3F，必须分离处理 */
  function fileUrl(p) {
    const i = p.indexOf('?');
    const file = i < 0 ? p : p.slice(0, i);
    const q = i < 0 ? '' : p.slice(i);
    return pathToFileURL(path.join(H5, file)).href + q;
  }
  async function visit(p) {
    errors = [];
    await page.send('Page.navigate', { url: fileUrl(p) });
    await sleep(1400);
    return errors.slice();
  }

  /* ============================================================
   * 1. 既有页面回归
   * ============================================================ */
  section('1. 既有页面回归（JS 异常 / 关键渲染 / 数据计数）');

  const EXISTING = [
    ['index.html', '#route-rail'],
    ['routes.html', '#route-list, .v2-rail, main'],
    ['map.html', '#pano-canvas'],
    ['movie.html?id=iron-man', '.movie, main'],
    ['next.html', 'main'],
    ['route-detail.html?id=newcomer', 'main'],
    ['community.html', 'main']
  ];
  for (const [p, sel] of EXISTING) {
    const errs = await visit(p);
    const hasKey = await page.evalExpr('!!document.querySelector(' + JSON.stringify(sel) + ')');
    ok('既有页面 ' + p + ' 无 JS 异常（已滤除改动前既有的 file:// CORS 噪声）', errs.length === 0, errs.join(' | '));
    ok('既有页面 ' + p + ' 关键节点仍在（' + sel + '）', hasKey === true);
  }
  console.log('  （说明：本次共滤除 ' + filteredNoise + ' 条 file:// 下 CloudBase CORS 环境噪声）');

  await visit('index.html');
  const counts = await page.evalExpr(
    'JSON.stringify({content:(window.MCU_CONTENT||[]).length,relations:(window.MCU_RELATIONS||[]).length,routes:(window.MCU_ROUTES||[]).length,chars:(window.MCU_CHARACTERS||[]).length,news:(window.MCU_NEWS||[]).length})'
  ).then(JSON.parse);
  ok('MCU_CONTENT 未被破坏（59）', counts.content === 59, 'actual ' + counts.content);
  ok('MCU_RELATIONS 未被破坏（92）', counts.relations === 92, 'actual ' + counts.relations);
  ok('MCU_ROUTES 未被破坏（11）', counts.routes === 11, 'actual ' + counts.routes);
  ok('MCU_CHARACTERS 未被破坏（24）', counts.chars === 24, 'actual ' + counts.chars);
  ok('MCU_NEWS 已加载（15）', counts.news === 15, 'actual ' + counts.news);

  /* ============================================================
   * 2. 首页资讯 Section
   * ============================================================ */
  section('2. 首页资讯 Section（R1）');

  const homeCards = await page.evalExpr('document.querySelectorAll("#news-list .v2n-news-card").length');
  ok('首页渲染资讯卡片（6 条，落在 5–8 区间）', homeCards === 6, 'actual ' + homeCards);
  const homeTitle = await page.evalExpr('(document.querySelector("#news-title .v2-st-title")||{}).textContent||""');
  ok('Section 标题为「最新漫威资讯」', homeTitle === '最新漫威资讯', homeTitle);
  const homeMore = await page.evalExpr('(document.querySelector("#news-title .v2-st-more")||{}).getAttribute? document.querySelector("#news-title .v2-st-more").getAttribute("href") : ""');
  ok('「查看全部」指向 news.html', homeMore === 'news.html', homeMore);
  const deniedInHome = await page.evalExpr('document.querySelectorAll("#news-list .v2n-news-card--denied").length');
  ok('首页默认不含 officially_denied（本条 pinned 才出现，属预期含 1 条）', deniedInHome <= 1, 'actual ' + deniedInHome);
  const badgeCount = await page.evalExpr('document.querySelectorAll("#news-list .v2n-status-badge").length');
  ok('每张卡片均带状态标签', badgeCount === homeCards, badgeCount + ' vs ' + homeCards);
  const firstIsPinned = await page.evalExpr('(document.querySelector("#news-list .v2n-news-card")||{}).getAttribute? document.querySelector("#news-list .v2n-news-card").dataset.id : ""');
  ok('有效置顶条目排在最前（pinned_order=1 的 news-2026-09-20-009）', firstIsPinned === 'news-2026-09-20-009', firstIsPinned);

  /* ============================================================
   * 3. 列表页（含加载更多）
   * ============================================================ */
  section('3. 列表页 news.html（R2 / R11.6 加载更多）');

  errors = [];
  await page.send('Page.navigate', { url: fileUrl('news.html') });
  await sleep(1200);
  ok('news.html 无 JS 异常', errors.length === 0, errors.join(' | '));

  const batch1 = await page.evalExpr('document.querySelectorAll("#news-list .v2n-news-card").length');
  ok('首批渲染 10 条', batch1 === 10, 'actual ' + batch1);
  const hasMore = await page.evalExpr('!!document.getElementById("news-more")');
  ok('存在「加载更多」按钮', hasMore === true);

  if (hasMore) {
    await page.evalExpr('document.getElementById("news-more").click(); true');
    await sleep(600);
    const batch2 = await page.evalExpr('document.querySelectorAll("#news-list .v2n-news-card").length');
    /* 15 条数据中：officially_denied 那条 pinned=true 故保留，publish_time 缺失那条
       first_seen_at 存在故保留 → Step 0 不剔除任何条目，可展示总数为 15 */
    ok('点击后追加下一批（10 + 5 = 15 条全部可展示）', batch2 === 15, 'actual ' + batch2);
    const endText = await page.evalExpr('(document.querySelector(".v2n-list-end")||{}).textContent||""');
    ok('到底显示「— 已展示全部 —」', endText.indexOf('已展示全部') >= 0, endText);
  }
  const stdSummary = await page.evalExpr('document.querySelectorAll("#news-list .v2n-news-card__summary").length');
  ok('列表卡片为标准变体（含摘要行）', stdSummary === 15, 'actual ' + stdSummary);

  /* ============================================================
   * 4. 详情页
   * ============================================================ */
  section('4. 详情页 news-detail.html（R3 十个信息块）');

  errors = [];
  await page.send('Page.navigate', { url: fileUrl('news-detail.html?id=news-2026-09-22-003') });
  await sleep(1200);
  ok('详情页无 JS 异常', errors.length === 0, errors.join(' | '));

  const d = await page.evalExpr(`JSON.stringify({
    title: !!document.querySelector('.v2n-detail-title'),
    badge: !!document.querySelector('.v2n-detail-head .v2n-status-badge'),
    date: !!document.querySelector('.v2n-detail-date'),
    summary: !!document.querySelector('.v2n-detail-summary'),
    related: !!document.querySelector('.v2n-related-rail'),
    sources: document.querySelectorAll('.v2n-source-item').length,
    notice: !!document.querySelector('.v2n-notice-box'),
    original: !!document.querySelector('.v2n-original-source__cta'),
    count: (document.querySelector('.v2n-source-count')||{}).textContent||'',
    extLinkTarget: (document.querySelector('.v2n-source-item__link')||{}).getAttribute ? document.querySelector('.v2n-source-item__link').getAttribute('target') : '',
    rel: (document.querySelector('.v2n-source-item__link')||{}).getAttribute ? document.querySelector('.v2n-source-item__link').getAttribute('rel') : ''
  })`).then(JSON.parse);
  ok('① 标题', d.title); ok('② 状态标签', d.badge); ok('③ 发布时间', d.date);
  ok('④ 摘要', d.summary); ok('⑤ 关联 MCU 区块', d.related);
  ok('⑥ 来源信息（3 个来源项）', d.sources === 3, 'actual ' + d.sources);
  ok('⑧ 真实性提醒', d.notice);
  ok('⑨ 原始来源 CTA', d.original);
  ok('⑥ 独立来源数文案为「仅有 1 个独立来源报道」（伪多源示例）', d.count.indexOf('1 个独立来源') >= 0, d.count);
  ok('外链使用 target=_blank + rel=noopener noreferrer', d.extLinkTarget === '_blank' && /noopener/.test(d.rel), d.extLinkTarget + ' / ' + d.rel);

  /* conflicting 详情页：交叉验证区块 */
  await page.send('Page.navigate', { url: fileUrl('news-detail.html?id=news-2026-09-21-008') });
  await sleep(1000);
  const cross = await page.evalExpr('document.querySelectorAll(".v2n-cross-item").length');
  ok('conflicting 详情页展示交叉验证区块（各方表述并列 2 条）', cross === 2, 'actual ' + cross);
  const crossOfficial = await page.evalExpr('(document.querySelector(".v2n-cross-official")||{}).textContent||""');
  ok('交叉验证标注「官方确认：暂未发现」', crossOfficial.indexOf('暂未发现') >= 0, crossOfficial);

  /* corrected 详情页：更正信息 + 链式引用 */
  await page.send('Page.navigate', { url: fileUrl('news-detail.html?id=news-2026-09-20-010') });
  await sleep(1000);
  const corr = await page.evalExpr('JSON.stringify({box:!!document.querySelector(".v2n-correction-notice"),chain:!!document.querySelector(".v2n-chain"),badge:(document.querySelector(".v2n-detail-head .v2n-status-badge")||{}).className||""})').then(JSON.parse);
  ok('corrected 详情页展示更正信息区块', corr.box);
  ok('corrected 详情页展示链式引用（查看原始版本）', corr.chain);
  ok('corrected 状态标签为暗金灰类名', corr.badge.indexOf('--corrected') > 0, corr.badge);

  /* 关联跳转实测（点击角色节点） */
  section('5. 关联跳转实测（D17 / D18）');
  await page.send('Page.navigate', { url: fileUrl('news-detail.html?id=news-2026-09-17-015') });
  await sleep(1000);
  const hrefs = await page.evalExpr('JSON.stringify(Array.prototype.map.call(document.querySelectorAll(".v2n-related-node"), function(a){return {tag:a.tagName, href:a.getAttribute("href")||"", name:(a.querySelector(".v2n-related-node__name")||{}).textContent||""};}))').then(JSON.parse);
  const charNodes = hrefs.filter(x => x.href.indexOf('map.html?focus=') === 0);
  const phaseNodes = hrefs.filter(x => x.name.indexOf('Phase') === 0);
  ok('角色节点使用 map.html?focus= 且为 <a>', charNodes.length === 2 && charNodes.every(x => x.tag === 'A'), JSON.stringify(hrefs));
  ok('阶段节点为 <span> 且 href 为空（无死链、不可点击）',
    phaseNodes.length === 1 && phaseNodes[0].tag === 'SPAN' && phaseNodes[0].href === '', JSON.stringify(phaseNodes));
  ok('未命中的 avengers-5 未渲染为关联节点',
    hrefs.filter(x => /Doomsday/.test(x.name)).length === 0);

  /* ============================================================
   * 6. 响应式（移动端 / PC）
   * ============================================================ */
  section('6. 响应式实测（390px 移动端 / 1440px PC）');

  for (const [w, h, label] of [[390, 844, '移动端 390px'], [1440, 900, 'PC 1440px']]) {
    await page.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w < 720 });
    await page.send('Page.navigate', { url: fileUrl('news.html') });
    await sleep(1000);
    const m = await page.evalExpr('JSON.stringify({cards:document.querySelectorAll("#news-list .v2n-news-card").length,cols:getComputedStyle(document.querySelector("#news-list")).gridTemplateColumns.split(" ").length,overX:document.documentElement.scrollWidth>window.innerWidth+1})').then(JSON.parse);
    ok(label + ' 列表正常渲染且无横向溢出', m.cards === 10 && m.overX === false, JSON.stringify(m));
  }
  await page.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await page.send('Page.navigate', { url: fileUrl('index.html') });
  await sleep(1000);
  const pcHome = await page.evalExpr('getComputedStyle(document.querySelector("#news-list")).gridTemplateColumns.split(" ").length');
  ok('PC 端首页资讯为 2 列网格', pcHome === 2, 'actual ' + pcHome);
  await page.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await page.send('Page.navigate', { url: fileUrl('index.html') });
  await sleep(1000);
  const mbHome = await page.evalExpr('getComputedStyle(document.querySelector("#news-list")).gridTemplateColumns.split(" ").length');
  ok('移动端首页资讯为单列', mbHome === 1, 'actual ' + mbHome);

  /* CSS 污染检查：既有 class 未被 v2n 样式影响 */
  const pollution = await page.evalExpr(`(function(){
    var el = document.createElement('div');
    el.className = 'v2-section';
    document.body.appendChild(el);
    var bg = getComputedStyle(el).backgroundColor;
    el.remove();
    return bg;
  })()`);
  ok('v2n-news.css 未给既有 .v2-section 注入背景色（无 CSS 污染）',
    pollution === 'rgba(0, 0, 0, 0)' || pollution === 'transparent', pollution);

  await browser.send('Target.closeTarget', { targetId: t.targetId }).catch(() => {});
  proc.kill();

  console.log('\n============================================================');
  console.log('结果：' + pass + ' PASS / ' + fail + ' FAIL');
  if (fail) { console.log('失败项：'); fails.forEach(f => console.log('  - ' + f)); }
  console.log('============================================================');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('运行异常：' + e.message); process.exit(2); });
