/* ============================================================
 * G5 基础测试（任务书第 6 节）：G5-T1 – G5-T6
 * ------------------------------------------------------------
 * 运行：node workspace/news/pipeline/tests/test-g5-baseline.cjs
 *
 *  G5-T1  L0 -> L1 字段完整性
 *  G5-T2  禁止字段进入 DeliveryItem
 *  G5-T3  merger 输入字段白名单
 *  G5-T4  event_key 不污染交付层
 *  G5-T5  capture 证据可追溯
 *  G5-T6  重复采集不会覆盖历史 capture
 *
 * ★ 零网络、零抓取；除 T5/T6 在 tests\tmp\ 下写入临时归档（结束即清理）外不写任何文件；
 *   不写 h5/ wechat/ douyin/。
 * ============================================================ */
'use strict';

const vm = require('vm');
const fs = require('fs');
const path = require('path');

const LOG_PATH = path.join(__dirname, 'out-g5-baseline.txt');
const _lines = [];
const _log = console.log.bind(console);
console.log = function () {
  const s = Array.prototype.map.call(arguments, String).join(' ');
  _lines.push(s); _log(s);
};
process.on('exit', function () {
  try { fs.writeFileSync(LOG_PATH, _lines.join('\n') + '\n', 'utf8'); } catch (e) {}
});

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const H5 = path.join(ROOT, 'h5');
const TMP = path.join(__dirname, 'tmp');

const RC = require('../raw-capture.cjs');
const CI = require('../candidate-item.cjs');
const CS = require('../capture-store.cjs');
const EM = require('../../engine/dedup/event-merger.cjs');
const F = require('../fixtures/g5-cases.cjs');

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
console.log('G5 基础测试 G5-T1 – G5-T6');
console.log('============================================================');
console.log('L0 ' + RC.FIELDS.length + ' 字段｜L1 ' + CI.FIELDS.length + ' 字段');

/* 载入 h5 的交付物字段集与 idSpace（只读） */
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
ok('已载入交付物字段集（' + DELIVERY_KEYS.length + ' 字段）与 idSpace（只读）',
  DELIVERY_KEYS.length === 33 && idSpace.content.size > 0);

const c1raw = RC.create(F.C1_OFFICIAL.raw);
const c1 = CI.fromRawCapture(c1raw, F.C1_OFFICIAL.ai, { seq: 1, idSpace: idSpace });

/* ============================================================
 * G5-T1  L0 → L1 字段完整性
 * ============================================================ */
section('G5-T1  L0 → L1 字段完整性');
eq('L0 恰为 14 字段', Object.keys(c1raw).length, 14);
eq('L1 恰为 35 字段', Object.keys(c1).length, 35);
eq('L1 = L0(14) + 新增(21)', RC.FIELDS.length + CI.L1_ADDED.length, 35);
let lost = '';
RC.FIELDS.forEach(function (k) { if (!(k in c1)) lost = k; });
eq('L0 的 14 字段在 L1 中全部继承（无丢失）', lost, '');
eq('L1 输出无 L0 之外的多余字段（严格等于规范字段集）',
  Object.keys(c1).length === CI.FIELDS.length &&
  Object.keys(c1).every(function (k) { return CI.FIELDS.indexOf(k) >= 0; }), true);
eq('L1 validate 通过', CI.validate(c1).pass, true);
/* 关键字段取值 */
eq('candidate_id 已生成', /^cand-[0-9a-f]{8}-\d{3}$/.test(c1.candidate_id), true);
eq('title 取自 AI 整理（纯文本）', c1.title, F.C1_OFFICIAL.ai.title);
eq('summary 取自 AI 整理', c1.summary, F.C1_OFFICIAL.ai.summary);
eq('category 为 6 值之一', CI.CATEGORIES.indexOf(c1.category) >= 0, true);
ok('reported_by 为数组且首项含 source_name/source_url/owner_group',
  Array.isArray(c1.reported_by) && !!c1.reported_by[0].source_name &&
  !!c1.reported_by[0].source_url && !!c1.reported_by[0].owner_group);
eq('capture_refs = [L0.capture_id]', c1.capture_refs.join(','), c1raw.capture_id);
eq('gate_status 默认 pending', c1.gate_status, 'pending');
eq('ai_suggested_status 保留为建议值', c1.ai_suggested_status, F.C1_OFFICIAL.ai.ai_suggested_status);

/* ============================================================
 * G5-T2  禁止字段进入 DeliveryItem
 * ============================================================ */
section('G5-T2  禁止字段进入 DeliveryItem');
const STATUS9 = RC.LAYER_FORBIDDEN_KEYS;
const DELIVERY_ONLY = ['id', 'independent_group_count', 'pinned', 'pinned_until',
  'pinned_order', 'pinned_reason', 'supersedes_id', 'superseded_by_id',
  'official_source', 'official_source_url', 'status_history',
  'conflict_resolved_at', 'conflict_resolved_by_evidence_url'];

let l0Leak = '', l1Leak = '';
STATUS9.forEach(function (k) { if (k in c1raw) l0Leak = k; if (k in c1) l1Leak = k; });
eq('L0 不含 9 项状态字段', l0Leak, '');
eq('L1 不含 9 项状态字段', l1Leak, '');

let onlyLeak = '';
DELIVERY_ONLY.forEach(function (k) { if (k in c1) onlyLeak = k; });
eq('L1 不含交付物独有字段', onlyLeak, '');

ok('L1 未生成 verification_status（含深扫）', JSON.stringify(c1).indexOf('verification_status') < 0);
ok('L1 未生成 judged_by', !('judged_by' in c1) && JSON.stringify(c1).indexOf('judged_by') < 0);
ok('L1 未生成 status_history', !('status_history' in c1) && JSON.stringify(c1).indexOf('status_history') < 0);

/* 反向：交付物字段集与 L1 字段集的差集 = 交付物独有字段，二者不得混淆 */
const deliveryOnlyComputed = DELIVERY_KEYS.filter(function (k) { return CI.FIELDS.indexOf(k) < 0; });
ok('交付物确有 L1 不含的独有字段（差集 ' + deliveryOnlyComputed.length + ' 个，证明两层可区分）',
  deliveryOnlyComputed.length > 0);
eq('L1 字段集与交付物字段集**不相等**（L1 35 / 交付物 33）',
  CI.FIELDS.length === DELIVERY_KEYS.length, false);
/* 强断言：L1 出现任何交付物独有字段都算违规 */
let strictLeak = '';
deliveryOnlyComputed.forEach(function (k) { if (k in c1) strictLeak = k; });
eq('L1 不含任何「交付物独有字段」（按交付物 33 字段反算）', strictLeak, '');

/* ============================================================
 * G5-T3  merger 输入字段白名单
 * ============================================================ */
section('G5-T3  merger 输入字段白名单');
const mi = CI.toMergerInput(c1);
const miKeys = Object.keys(mi).sort();
const expectKeys = ['id'].concat(CI.MERGER_INPUT_WHITELIST).sort();
eq('白名单字段数 = 9', CI.MERGER_INPUT_WHITELIST.length, 9);
eq('toMergerInput 输出键集合 = 白名单 + id', miKeys.join(','), expectKeys.join(','));
eq('输出恰为 10 个键', miKeys.length, 10);
let outOfWhitelist = '';
miKeys.forEach(function (k) { if (k !== 'id' && CI.MERGER_INPUT_WHITELIST.indexOf(k) < 0) outOfWhitelist = k; });
eq('无越出白名单的字段', outOfWhitelist, '');
let forbid = '';
CI.MERGER_INPUT_FORBIDDEN.forEach(function (k) { if (k in mi) forbid = k; });
eq('不含 6 项禁止字段（verification_status/judged_by/chain_steps_hit/status_history/ai_suggested_status/gate_status）',
  forbid, '');
eq('白名单精确内容与任务书一致', CI.MERGER_INPUT_WHITELIST.join(','),
  'candidate_id,title,category,related_movies,related_series,related_characters,publish_time,first_seen_at,reported_by');
/* 功能性：适配后可正常归并 */
const r3 = EM.mergeCandidates([mi, CI.toMergerInput(c1)]);
eq('适配后 merger 可正常产出事件', r3.stats.output_events > 0, true);
eq('适配后报道记录数 = 2', r3.stats.reports_preserved, 2);

/* ============================================================
 * G5-T4  event_key 不污染交付层
 * ============================================================ */
section('G5-T4  event_key 不污染交付层');
ok('L0 不产出 event_key（字段集与输出双向确认）',
  RC.FIELDS.indexOf('event_key') < 0 && !('event_key' in c1raw));
ok('event_key 在 L1 产出且形态合法', /^evt1-[0-9a-f]{16}$/.test(c1.event_key), c1.event_key);
eq('交付物 33 字段中**不含** event_key', DELIVERY_KEYS.indexOf('event_key') < 0, true);
ok('交付数据实际条目中不含 event_key（全量扫描 15 条）',
  NEWS.every(function (n) { return !('event_key' in n); }));
ok('交付物不含 occurrence', DELIVERY_KEYS.indexOf('occurrence') < 0);
ok('L0 / L1 输出均不含 occurrence',
  JSON.stringify(c1raw).indexOf('occurrence') < 0 && JSON.stringify(c1).indexOf('occurrence') < 0);
/* merger 输出也不得含 event_key 之外的污染：event_key 属管道层，可出现在 merger 输出；
   但绝不能出现在交付层 —— 上面已断言。此处再断言 occurrence 在 merger 输出中亦不存在 */
const r4 = EM.mergeCandidates([mi]);
ok('merger 输出不含 occurrence（B-ii 暂不落码）', JSON.stringify(r4).indexOf('occurrence') < 0);
ok('merger 输出不含状态字段', EM.findForbiddenKeys(r4).join(',') === '');

/* ============================================================
 * G5-T5  capture 证据可追溯
 * ============================================================ */
section('G5-T5  capture 证据可追溯');
fs.mkdirSync(TMP, { recursive: true });
const t5opts = { dir: TMP, date: '2026-09-23' };
let t5res = CS.appendCaptures([c1raw], t5opts);
eq('capture 已落盘', t5res.added, 1);

const back = CS.findById(c1raw.capture_id, t5opts);
ok('按 capture_refs 可取回原始 capture', !!back);
eq('取回的 capture 与原始一致（逐字段）', JSON.stringify(back), JSON.stringify(c1raw));
ok('原始证据齐备：title_raw / source_url / published_at_raw / fetched_at / http_status / content_hash / raw_excerpt',
  !!back.title_raw && !!back.source_url && ('published_at_raw' in back) &&
  !!back.fetched_at && Number.isInteger(back.http_status) &&
  /^[0-9a-f]{40}$/.test(back.content_hash) && !!back.raw_excerpt);
eq('title_raw 未被改写（不做 AI 判断、不改标题）', back.title_raw, F.C1_OFFICIAL.raw.title_raw);
eq('L1 的 capture_refs 指向的正是该 capture', c1.capture_refs[0], back.capture_id);
ok('写入位置守卫：pipeline 之外的路径被拒绝',
  !!(caught(function () { CS.assertInsidePipeline(path.join(H5, 'tmp.json')); }) || {}).code);
eq('拒绝写入 h5 的 code',
  (caught(function () { CS.assertInsidePipeline(path.join(H5, 'data', 'x.json')); }) || {}).code,
  'WRITE_OUTSIDE_PIPELINE');

/* ============================================================
 * G5-T6  重复采集不会覆盖历史 capture
 * ============================================================ */
section('G5-T6  重复采集不会覆盖历史 capture');
/* 第 1 次采集：2 条 */
const run1a = RC.create(F.raw({ capture_id: 'cap-T6-1', pipeline_run_id: 'run-A' }));
const run1b = RC.create(F.raw({
  capture_id: 'cap-T6-2', pipeline_run_id: 'run-A',
  source_url: 'https://www.marvel.com/articles/movies/second-article'
}));
const a1 = CS.appendCaptures([run1a, run1b], t5opts);
eq('第 1 次采集：新增 2 条', a1.added, 2);
eq('归档总数 = 3（含 T5 的 1 条）', a1.total, 3);

/* 第 2 次采集：同 id 但内容不同（模拟同一 capture 被重采且字段有变）+ 1 条新 */
const run2Changed = RC.create(F.raw({
  capture_id: 'cap-T6-1', pipeline_run_id: 'run-B',
  title_raw: '（重采后标题被上游改动）Marvel 公布预告'
}));
const run2new = RC.create(F.raw({ capture_id: 'cap-T6-3', pipeline_run_id: 'run-B' }));
const a2 = CS.appendCaptures([run2Changed, run2new], t5opts);

eq('第 2 次采集：新增 1 条', a2.added, 1);
eq('第 2 次采集：冲突 1 条（同 id 不同内容）', a2.conflicts.length, 1);
eq('冲突对象为 cap-T6-1', a2.conflicts[0].capture_id, 'cap-T6-1');
ok('冲突未被覆盖（原记录仍为 run-A）',
  CS.findById('cap-T6-1', t5opts).pipeline_run_id === 'run-A',
  CS.findById('cap-T6-1', t5opts).pipeline_run_id);
eq('原记录 title_raw 未被改动',
  CS.findById('cap-T6-1', t5opts).title_raw, run1a.title_raw);
eq('归档总数 = 4（3 + 1 新增，冲突不新增）', a2.total, 4);

/* 第 3 次采集：完全重复 → 全部跳过（幂等） */
const a3 = CS.appendCaptures([run1a, run2new], t5opts);
eq('第 3 次采集：新增 0', a3.added, 0);
eq('第 3 次采集：跳过 2（幂等）', a3.skipped, 2);
eq('归档总数仍为 4（无增长）', a3.total, 4);
ok('历史 capture 累计可查（4 条）', CS.loadCaptures(t5opts).length === 4);
ok('可按 pipeline_run_id 过滤（run-A 2 条）',
  CS.loadCaptures({ dir: TMP, date: '2026-09-23', pipeline_run_id: 'run-A' }).length === 2, true);

/* ============================================================
 * 汇总
 * ============================================================ */
try { fs.rmSync(TMP, { recursive: true, force: true }); console.log('\n■ 已清理临时目录 tests\\tmp\\'); } catch (e) {}

console.log('\n============================================================');
console.log('结果：' + pass + ' PASS / ' + fail + ' FAIL');
if (fail) { console.log('失败项：'); fails.forEach(function (f) { console.log('  - ' + f); }); }
console.log('============================================================');
process.exit(fail ? 1 : 0);
