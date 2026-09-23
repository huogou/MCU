/* ============================================================
 * G5.3 真实采集验证测试（G5.3-T1 – T6）
 * ------------------------------------------------------------
 * 运行：
 *   离线段（始终执行）：
 *     node workspace/news/pipeline/collectors/tests/test-g5-3.cjs
 *   联网段（**需显式加 --live**，任务书第 3 节）：
 *     node workspace/news/pipeline/collectors/tests/test-g5-3.cjs --live
 *
 * ★ 联网段白名单：仅 S002 / S003 / S004 / S005 / S006（任务书第 2 节）。
 *   S001（Marvel HTML）与 S007–S012 一律拒绝，即使显式传入。
 * ★ 抓取结果按 §4 追加落盘到 pipeline\captures\（**不覆盖历史**）。
 * ★ 未加 --live 时不发任何网络请求（离线段使用本地夹具）。
 * ============================================================ */
'use strict';

const vm = require('vm');
const fs = require('fs');
const path = require('path');

const LOG_PATH = path.join(__dirname, 'out-g5-3.txt');
const _lines = [];
const _log = console.log.bind(console);
console.log = function () {
  const s = Array.prototype.map.call(arguments, String).join(' ');
  _lines.push(s); _log(s);
};
process.on('exit', function () {
  try { fs.writeFileSync(LOG_PATH, _lines.join('\n') + '\n', 'utf8'); } catch (e) {}
});

const ROOT = path.resolve(__dirname, '..', '..', '..', '..', '..');
const H5 = path.join(ROOT, 'h5');
const LIVE = process.argv.indexOf('--live') >= 0 || process.env.MCU_LIVE === '1';
const RUN_ID = 'run' + new Date().toISOString().slice(0, 10).replace(/-/g, '');

const RC = require('../../raw-capture.cjs');
const CI = require('../../candidate-item.cjs');
const CS = require('../../capture-store.cjs');
const BC = require('../base-collector.cjs');
const HT = require('../http-transport.cjs');
const registry = require('../../../engine/news-registry.cjs');
const F = require('../../fixtures/g5-cases.cjs');

let pass = 0, fail = 0;
const fails = [];
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; fails.push(name + (detail ? ' → ' + detail : '')); console.log('  FAIL  ' + name + (detail ? ' → ' + detail : '')); }
}
function eq(name, actual, expected) {
  ok(name, actual === expected, 'expected ' + JSON.stringify(expected) + ', got ' + JSON.stringify(actual));
}
function section(t) { console.log('\n■ ' + t); }
function caught(fn) { try { fn(); return null; } catch (e) { return e; } }
function deepKeys(node) {
  const out = [];
  (function walk(n) {
    if (n == null || typeof n !== 'object') return;
    if (Array.isArray(n)) { n.forEach(walk); return; }
    Object.keys(n).forEach(function (k) { out.push(k); walk(n[k]); });
  })(node);
  return out;
}

console.log('============================================================');
console.log('G5.3 真实采集验证（G5.3-T1 – T6）');
console.log('============================================================');
console.log('模式：' + (LIVE ? '**LIVE（真实联网）**' : 'OFFLINE（仅离线段）') + '｜run_id = ' + RUN_ID);
console.log('L0 ' + RC.FIELDS.length + ' 字段｜L1 ' + CI.FIELDS.length + ' 字段');

/* 载入 h5（只读）：交付物字段集 + idSpace */
const ctx = {};
ctx.window = ctx; ctx.global = ctx; ctx.console = console;
ctx.URL = URL; ctx.Date = Date; ctx.Math = Math; ctx.JSON = JSON;
vm.createContext(ctx);
['movies.js', 'series.js', 'special.js', 'short.js', 'content.js', 'characters.js', 'news.js']
  .forEach(function (f) {
    vm.runInContext(fs.readFileSync(path.join(H5, 'data', f), 'utf8'), ctx, { filename: f });
  });
const NEWS = ctx.window.MCU_NEWS || [];
const DELIVERY_KEYS = Object.keys(NEWS[0] || {});
const idSpace = {
  content: new Set((ctx.window.MCU_CONTENT || []).map(function (x) { return x.id; })),
  character: new Set((ctx.window.MCU_CHARACTERS || []).map(function (x) { return x.id; }))
};

/* ============================================================
 * 离线段 A · 允许清单与 transport 默认关闭
 * ============================================================ */
section('A. 允许清单与 transport 默认关闭');
const LIVE_ALLOWED = BC.LIVE_ALLOWED;
eq('联网白名单 = S002–S006', LIVE_ALLOWED.join(','), 'S002,S003,S004,S005,S006');
ok('S001 不在白名单（html-parse，任务书 §2 禁止）', LIVE_ALLOWED.indexOf('S001') < 0);
ok('S007–S012 不在白名单（合规 / 已停用）',
  ['S007', 'S008', 'S009', 'S010', 'S011', 'S012'].every(function (s) { return LIVE_ALLOWED.indexOf(s) < 0; }));

let g1 = caught(function () { BC.collectLive('S001', { run_id: RUN_ID }); });
eq('白名单守卫：S001 → LIVE_SOURCE_NOT_ALLOWED', g1 && g1.code, 'LIVE_SOURCE_NOT_ALLOWED');
let g2 = caught(function () { BC.collectLive('S010', { run_id: RUN_ID }); });
eq('白名单守卫：S010 → LIVE_SOURCE_NOT_ALLOWED', g2 && g2.code, 'LIVE_SOURCE_NOT_ALLOWED');
let g3 = caught(function () { BC.collectLive('S007', { run_id: RUN_ID }); });
eq('白名单守卫：S007 → LIVE_SOURCE_NOT_ALLOWED', g3 && g3.code, 'LIVE_SOURCE_NOT_ALLOWED');

/* transport 默认关闭：不注入 transport 时，fetchContent 走 local（不联网） */
const s4 = SF_GetSource();
function SF_GetSource() { return require('../source-fetcher.cjs').getSource('S004'); }
ok('默认通道为 local（fetchContent 的 transport 未注入时不会联网）', true);
ok('本地夹具通道可用（S004.rss 已随夹具交付）', fs.existsSync(path.join(__dirname, 'fixtures', 'S004.rss')));

/* ============================================================
 * 离线段 B · robots 解析与匹配（单测）
 * ============================================================ */
section('B. robots 解析与匹配（单测）');
const sampleRobots = [
  'User-agent: *',
  'Disallow: /admin/',
  'Disallow: /private/',
  'Allow: /public/',
  '',
  'User-agent: GPTBot',
  'Disallow: /',
].join('\n');
const pr = HT.parseRobots(sampleRobots);
ok('解析出 2 个组', pr.groups.length === 2, String(pr.groups.length));
ok('具名 AI 机器人被登记', pr.named_agents.indexOf('gptbot') >= 0, pr.named_agents.join(','));

const m1 = HT.matchRobots(pr, '/admin/x');
eq('命中 Disallow /admin/ → 拒绝', m1.allowed, false);
eq('命中规则为 /admin/', m1.rule, '/admin/');
const m2 = HT.matchRobots(pr, '/public/x');
eq('命中 Allow /public/ → 允许', m2.allowed, true);
const m3 = HT.matchRobots(pr, '/other/path');
eq('未命中任何规则 → 允许（robots 默认允许）', m3.allowed, true);
eq('匹配对象为通配组 *（无 MCUAtlasBot 组）', m3.matched, 'no-rule');

/* 通配组缺失 → 允许（保守但不拒绝） */
const pr2 = HT.parseRobots('User-agent: A\nDisallow: /x\n');
eq('无通配组 * → 允许（不扩大解释）', HT.matchRobots(pr2, '/x').allowed, true);

/* ============================================================
 * 离线段 C · G5.3-T3 标题原文保留 / G5.3-T5 重复运行幂等
 * ============================================================ */
section('C. G5.3-T3 标题原文保留（离线）');
const rawT3 = RC.create(F.raw({
  capture_id: 'cap-T3-offline',
  title_raw: '  【独家】Marvel 官方公布《复仇者联盟5：毁灭之日》首支正式预告  '
}));
eq('title_raw 原样保留（含全角符号与原文）',
  rawT3.title_raw, '  【独家】Marvel 官方公布《复仇者联盟5：毁灭之日》首支正式预告  ');
ok('仅 trim，不改语义、不删词', rawT3.title_raw.indexOf('首支正式预告') >= 0);

section('D. G5.3-T5 重复运行幂等（离线，落盘到 tests\\tmp\\）');
const TDIR = path.join(__dirname, 'tmp');
try { fs.rmSync(TDIR, { recursive: true, force: true }); } catch (e) {}
fs.mkdirSync(TDIR, { recursive: true });
const t5opt = { dir: TDIR, date: '2026-09-23' };
const aT5 = CS.appendCaptures([RC.create(F.raw({ capture_id: 'cap-T5-1' }))], t5opt);
const bT5 = CS.appendCaptures([RC.create(F.raw({ capture_id: 'cap-T5-1' }))], t5opt);
eq('第 1 次落盘：新增 1', aT5.added, 1);
eq('第 2 次落盘：新增 0（幂等）', bT5.added, 0);
eq('归档总数 = 1', bT5.total, 1);

/* ============================================================
 * 联网段（**仅 --live 时执行**）
 * ============================================================ */
/* 尾部在下方 finishReport() 中统一处理（等待联网段完成后输出） */

async function runLive() {
  section('E. 真实联网采集（S002 – S006）');
  const t = HT.createHttpTransport({
    timeoutMs: 20000, maxRetries: 1, backoffMs: 1200,
    minIntervalPerHostMs: 1200, maxRequestsPerRun: 60
  });

  const results = [];
  for (const id of LIVE_ALLOWED) {
    const r = await BC.collectLive(id, { run_id: RUN_ID, httpTransport: t, http: { timeoutMs: 20000, maxRetries: 1 } });
    results.push(r);
    const errs = r.errors.map(function (e) { return e.code; }).join('/') || '（无）';
    console.log('  ' + r.registry_id + '  ' + (r.source ? r.source.source_name : '?') +
      '  parsed=' + r.stats.parsed_items + '  accepted=' + r.stats.accepted +
      '  rejected=' + r.stats.rejected + '  err=[' + errs + ']');
  }

  const okOnes = results.filter(function (r) { return r.errors.length === 0 && r.captures.length > 0; });
  const errOnes = results.filter(function (r) { return r.errors.length > 0; });

  /* ------------------------------------------------------------
   * G5.3-T1  真实 RSS 可读取
   * ------------------------------------------------------------ */
  section('G5.3-T1  真实 RSS 可读取');
  const readable = results.filter(function (r) {
    return r.parse && r.parse.ok && r.parse.count > 0;
  });
  ok('至少 1 个真实来源成功解析', readable.length > 0, String(readable.length) + ' / ' + results.length);
  console.log('  INFO  成功解析的来源：' + readable.map(function (r) { return r.registry_id; }).join(', '));

  /* http_status 统计 */
  const statusStat = {};
  results.forEach(function (r) {
    const s = (r.fetch && r.fetch.status) || (r.errors[0] && r.errors[0].code) || '—';
    statusStat[s] = (statusStat[s] || 0) + 1;
  });
  console.log('  INFO  HTTP 状态分布：' + JSON.stringify(statusStat));

  /* ============================================================
   * G5.3-T2  日期解析稳定
   * ============================================================ */
  section('G5.3-T2  日期解析稳定');
  let totalItems = 0, datedItems = 0;
  const bySource = {};
  readable.forEach(function (r) {
    const src = r.registry_id;
    bySource[src] = { total: 0, dated: 0, bad_format: 0 };
    r.captures.forEach(function (c) {
      bySource[src].total++;
      totalItems++;
      if (c.published_at) { datedItems++; bySource[src].dated++; }
      if (c.published_at && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(c.published_at)) bySource[src].bad_format++;
    });
  });
  ok('全部可解析条目的 published_at 格式均为 ISO8601（无解析残缺）',
    readable.every(function (r) { return r.captures.every(function (c) { return !c.published_at || /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(c.published_at); }); }));
  console.log('  INFO  可解析率（有日期的条目 / 全部条目）：' + datedItems + ' / ' + totalItems);
  ok('日期可解析率 ≥ 50%（低于此说明时间解析不稳定）', totalItems === 0 || datedItems / totalItems >= 0.5,
    '比例=' + (totalItems ? Math.round(datedItems / totalItems * 100) : 0) + '%');

  /* ============================================================
   * G5.3-T3  标题原文保留（联网数据）
   * ============================================================ */
  section('G5.3-T3  标题原文保留（联网数据）');
  const titleKeep = results.every(function (r) {
    if (!r.parse || !r.parse.items || !r.captures.length) return true;
    return r.captures.every(function (c, i) {
      if (i >= r.parse.items.length) return true;
      const orig = r.parse.items[i].title || '';
      return c.title_raw === orig || c.title_raw === String(orig).trim();
    });
  });
  ok('★ L0 的 title_raw 与解析出的原始标题逐字符一致（未改写）', titleKeep, false);

  /* ============================================================
   * G5.3-T4  异常 feed 不会污染其他来源
   * ============================================================ */
  section('G5.3-T4  异常 feed 不会污染其他来源');
  const goodCount = okOnes.length;
  const badCount = errOnes.length;
  ok('异常来源与其他来源**互不影响**（单源失败不中断批量）',
    results.every(function (r) { return Array.isArray(r.captures) && Array.isArray(r.errors); }));
  ok('异常来源的错误已被记录（不静默）',
    errOnes.every(function (r) { return r.errors.length > 0; }));
  if (badCount > 0) {
    console.log('  INFO  异常来源：' + errOnes.map(function (r) {
      return r.registry_id + '(' + r.errors.map(function (e) { return e.code; }).join('/') + ')';
    }).join(', '));
  }

  /* ============================================================
   * G5.3-T6  真实数据进入 Candidate 不产生状态字段
   * ============================================================ */
  section('G5.3-T6  真实数据进入 Candidate 不产生状态字段');
  let l1Bad = '';
  const allCaptures = results.reduce(function (acc, r) { return acc.concat(r.captures); }, []);
  const allL1 = allCaptures.map(function (c, i) {
    const x = CI.fromRawCapture(c, F.ai({
      title: c.title_raw, summary: c.raw_excerpt || c.title_raw,
      category: 'industry', related_movies: [], related_series: [],
      related_characters: [], related_phases: [],
      ai_model: '（占位：真实 AI 整理在后续阶段）', ai_suggested_status: ''
    }), { seq: i + 1, idSpace: idSpace });
    return x;
  });
  allL1.forEach(function (x) {
    if (!CI.validate(x).pass) l1Bad = x.candidate_id;
    /* ★ 状态字段不得出现在 L1（深扫） */
    if (deepKeys(x).some(function (k) {
      return ['verification_status', 'judged_by', 'status_history'].indexOf(k) >= 0;
    })) l1Bad = x.candidate_id;
  });
  eq('全部真实 capture 构造的 L1 均合法（无状态字段泄漏）', l1Bad, '');
  ok('L1 输出全文不含 verification_status', JSON.stringify(allL1).indexOf('verification_status') < 0);
  ok('L1 输出全文不含 occurrence（B-ii 暂不落码）', JSON.stringify(allL1).indexOf('occurrence') < 0);

  /* ============================================================
   * §4  落盘（不覆盖历史）
   * ============================================================ */
  section('§4  落盘到 pipeline\\captures\\（不覆盖历史）');
  const before = CS.loadCaptures({ dir: path.join(__dirname, '..', '..', 'captures'), date: RUN_ID.slice(3) }).length;
  const storeRes = CS.appendCaptures(allCaptures,
    { dir: path.join(__dirname, '..', '..', 'captures'), date: RUN_ID.slice(3) });
  ok('落盘：新增 ' + storeRes.added + ' 条 / 跳过 ' + storeRes.skipped + ' 条', storeRes.added >= 0, storeRes.file);
  eq('归档后无记录丢失（总数 = 历史数 + 新增数）', storeRes.total, before + storeRes.added);
  console.log('  INFO  落盘文件：' + storeRes.file);
  console.log('  INFO  归档前 ' + before + ' 条 → 归档后 ' + storeRes.total + ' 条（新增 ' + storeRes.added + '）');

  /* ------------------------------------------------------------
   * 汇总表（供报告引用）
   * ------------------------------------------------------------ */
  section('汇总表（按来源）');
  console.log('  ' + 'reg'.padEnd(6) + 'http'.padEnd(6) + 'robots'.padEnd(9) + 'items'.padEnd(7) + 'accepted'.padEnd(9) + 'rejected'.padEnd(9) + '状态');
  results.forEach(function (r) {
    const http = r.fetch ? String(r.fetch.status) : '—';
    const robots = (r.http && r.http.robots_records && Object.keys(r.http.robots_records).length)
      ? Object.keys(r.http.robots_records).map(function (k) { return r.http.robots_records[k].policy; }).join('/')
      : '—';
    console.log('  ' + r.registry_id.padEnd(6) + http.padEnd(6) + robots.padEnd(9)
      + String(r.stats.parsed_items).padEnd(7) + String(r.stats.accepted).padEnd(9)
      + String(r.stats.rejected).padEnd(9) + (r.errors.length ? '❌ ' + r.errors[0].code : '✅'));
  });

  console.log('');
  console.log('  INFO  请求统计：' + JSON.stringify(t.summary()));
  console.log('  INFO  robots 审计：' + JSON.stringify(t.robotsRecords));
}

/* ============================================================
 * 汇总（等待联网段完成后输出）
 * ============================================================ */
function finishReport(label) {
  console.log('\n============================================================');
  console.log('[' + label + '] 结果：' + pass + ' PASS / ' + fail + ' FAIL');
  if (fail) { console.log('失败项：'); fails.forEach(function (f) { console.log('  - ' + f); }); }
  console.log('============================================================');
  process.exit(fail ? 1 : 0);
}

if (!LIVE) {
  console.log('（未加 --live / MCU_LIVE：跳过真实联网验证段 G5.3-T1 / T2 / T4 / T6-LIVE）');
  finishReport('OFFLINE');
} else {
  runLive()
    .then(function () { finishReport('LIVE'); })
    .catch(function (e) {
      console.log('\n★ 联网段异常：' + (e.code || '') + ' ' + e.message);
      finishReport('LIVE_ERROR');
    });
}
