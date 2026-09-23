/* ============================================================
 * G5.5 · ai-normalizer 单元测试（离线，零网络）
 * ------------------------------------------------------------
 * 运行：node workspace/news/pipeline/ai-normalizer/tests/test-ai-normalizer.cjs
 * ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const LOG_PATH = path.join(__dirname, 'out-ai-normalizer.txt');
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
const AN = require('../ai-normalizer.cjs');
const CI = require('../../candidate-item.cjs');
const CS = require('../../capture-store.cjs');
const RC = require('../../raw-capture.cjs');
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
console.log('G5.5 AI 整理层单元测试（ai-normalizer）');
console.log('============================================================');

/* idSpace：真实数据白名单（content 取 MCU_CONTENT，character 取 MCU_CHARACTERS） */
const ctx = {};
ctx.window = ctx; ctx.global = ctx; ctx.console = console;
ctx.URL = URL; ctx.Date = Date; ctx.Math = Math; ctx.JSON = JSON;
vm.createContext(ctx);
['movies.js', 'series.js', 'special.js', 'short.js', 'content.js', 'characters.js'].forEach(function (f) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'h5', 'data', f), 'utf8'), ctx, { filename: f });
});
const idSpace = {
  content: new Set((ctx.window.MCU_CONTENT || []).map(function (x) { return x.id; })),
  character: new Set((ctx.window.MCU_CHARACTERS || []).map(function (x) { return x.id; }))
};
const opt = { idSpace: idSpace, seq: 1 };

function stub() {
  return CI.fromRawCapture(RC.create(F.raw({ capture_id: 'cap-g55-t1' })), {
    title: F.raw({}).title_raw, summary: 'test', category: 'industry', ai_model: 'stub'
  }, opt);
}

/* A. 契约 */
const c0 = stub();
const ai0 = { title: '奇异博士确认回归新作', summary: '测试摘要内容，长度足够。', category: 'movie', ai_model: 't' };
const e0 = AN.normalize(c0, ai0, opt);
eq('A1 输出恰为 35 字段', Object.keys(e0).length, CI.FIELDS.length);
eq('A2 LAYER = L1-AI', AN.LAYER, 'L1-AI');
ok('A3 AI_ALLOWED_FIELDS 恰为任务书七字段 + ai_model',
  AN.AI_ALLOWED_FIELDS.length === 8 &&
  ['title', 'summary', 'category', 'related_movies', 'related_series',
    'related_characters', 'related_phases', 'ai_model'].every(function (k) {
      return AN.AI_ALLOWED_FIELDS.indexOf(k) >= 0;
    }));

/* B. 禁止字段 */
const b1 = Object.assign({ title: 't', summary: 's', category: 'movie', ai_model: 't' }, { verification_status: 'official_confirmed' });
eq('B1 AI 结果含 verification_status → FORBIDDEN_FIELD', caught(function () { AN.normalize(c0, b1, opt); }) && caught(function () { AN.normalize(c0, b1, opt); }).code, 'FORBIDDEN_FIELD');
const b2 = Object.assign({ title: 't', summary: 's', category: 'movie', ai_model: 't' }, { judged_by: 'human_confirmed' });
eq('B2 AI 结果含 judged_by → FORBIDDEN_FIELD', caught(function () { AN.normalize(c0, b2, opt); }).code, 'FORBIDDEN_FIELD');
const b3 = Object.assign({ title: 't', summary: 's', category: 'movie', ai_model: 't' }, { supersedes_id: 'x' });
eq('B3 AI 结果含 supersedes_id（交付物独有）→ FORBIDDEN_FIELD', caught(function () { AN.normalize(c0, b3, opt); }).code, 'FORBIDDEN_FIELD');
const b4 = Object.assign({ title: 't', summary: 's', category: 'movie', ai_model: 't' }, { confidence: 0.9 });
eq('B4 AI 结果含白名单外字段（confidence）→ FORBIDDEN_FIELD', caught(function () { AN.normalize(c0, b4, opt); }).code, 'FORBIDDEN_FIELD');

/* C. 必填/枚举/纯文本 */
const c1 = { title: 'x', summary: 's', category: 'movie', ai_model: 't' };
eq('C1 title 为空 → MISSING_FIELD', caught(function () { AN.normalize(c0, Object.assign({}, c1, { title: '' }), opt); }).code, 'MISSING_FIELD');
eq('C2 category 非法 → INVALID_CATEGORY', caught(function () { AN.normalize(c0, Object.assign({}, c1, { category: 'tv' }), opt); }).code, 'INVALID_CATEGORY');
eq('C3 title 含 HTML → MARKUP_NOT_ALLOWED', caught(function () { AN.normalize(c0, Object.assign({}, c1, { title: '<b>x</b>' }), opt); }).code, 'MARKUP_NOT_ALLOWED');
eq('C4 summary 含 Markdown 粗体 → MARKUP_NOT_ALLOWED', caught(function () { AN.normalize(c0, Object.assign({}, c1, { summary: '**x**' }), opt); }).code, 'MARKUP_NOT_ALLOWED');

/* D. 实体白名单交集 + key/id 重算 */
const d0 = stub();
const d1 = AN.normalize(d0, {
  title: '《洛基》新季消息公布', summary: '测试摘要。', category: 'series', ai_model: 't',
  related_movies: ['loki', 'not-a-real-movie'],
  related_series: ['avengers', 'not-real-series'],
  related_characters: ['strange', 'ghost-x'],
  related_phases: [4, 9, 0]
}, opt);
eq('D1 related_movies 丢弃未命中 id（loki 是 series/movie id，在 content 空间）', JSON.stringify(d1.related_movies), '["loki"]');
eq('D2 related_series 丢弃未命中（avengers 是 movie，不在 series 传入位？——注意：content 空间共用，avengers 应命中）',
  JSON.stringify(d1.related_series), '["avengers"]');
eq('D3 related_characters 丢弃未命中（strange 命中，ghost-x 丢弃）', JSON.stringify(d1.related_characters), '["strange"]');
eq('D4 related_phases 过滤非法值（保留 4）', JSON.stringify(d1.related_phases), '[4]');
ok('D5 event_key 已重算且形态合法', /^evt1-[0-9a-f]{16}$/.test(d1.event_key));
ok('D6 candidate_id 已重算且与 key 派生一致', d1.candidate_id === 'cand-' + d1.event_key.slice(-8) + '-001');
ok('D7 与桩候选不同 key（分类/实体变化驱动）', d1.event_key !== d0.event_key);
ok('D8 capture_refs 保留（追溯链不断）', JSON.stringify(d1.capture_refs) === JSON.stringify(d0.capture_refs));
ok('D9 深扫无状态字段/occurrence', (function () {
  const ks = deepKeys(d1);
  return ks.indexOf('verification_status') < 0 && ks.indexOf('occurrence') < 0 && ks.indexOf('judged_by') < 0;
})());

/* E. normalizeAll：映射与多余输入 */
const e1 = stub(), e2 = CI.fromRawCapture(RC.create(F.raw({ capture_id: 'cap-g55-t2' })), {
  title: 'x2', summary: 's2', category: 'industry', ai_model: 'stub'
}, { idSpace: idSpace, seq: 2 });
const all = AN.normalizeAll([e1, e2], {
  [e1.candidate_id]: { title: '整理后的标题', summary: '整理后的摘要。', category: 'movie', ai_model: 't', related_movies: ['endgame'] }
}, { idSpace: idSpace });
eq('E1 输出候选数 = 输入数', all.candidates.length, 2);
eq('E2 mapping[0].to = 重算后的 id', all.mappings[0].to, all.candidates[0].candidate_id);
ok('E3 mapping[0].changed_keys 含 title/category/candidate_id',
  ['title', 'category', 'candidate_id'].every(function (k) { return all.mappings[0].changed_keys.indexOf(k) >= 0; }));
eq('E4 无 AI 结果的候选原样保留（mapping 记 no_ai_result）',
  all.mappings[1].changed_keys.length, 0);
eq('E5 多余 AI 结果键如实暴露', 0, all.discarded_ai.length);
const all2 = AN.normalizeAll([e1, e2], { 'cand-xxxxxxxx-999': { title: 'o', summary: 'o', category: 'movie', ai_model: 't' } }, { idSpace: idSpace });
eq('E6 传入不存在候选的 AI 结果 → discarded_ai 记录', JSON.stringify(all2.discarded_ai), '["cand-xxxxxxxx-999"]');

/* F. 输入非法候选拒绝 */
const bad = Object.assign({}, e1, { verification_status: 'rumor' });
eq('F1 输入候选含状态字段 → CANDIDATE_INVALID', caught(function () { AN.normalize(bad, ai0, opt); }).code, 'CANDIDATE_INVALID');

console.log('\n============================================================');
console.log('结果：' + pass + ' PASS / ' + fail + ' FAIL');
if (fail) { fails.forEach(function (f2) { console.log('  - ' + f2); }); }
console.log('============================================================');
process.exit(fail ? 1 : 0);
