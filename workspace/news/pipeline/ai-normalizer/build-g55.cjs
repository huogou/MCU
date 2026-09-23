/* ============================================================
 * G5.5 · AI 整理执行编排（非测试；真实 133 条全量增强 + merger 联动）
 * ------------------------------------------------------------
 * 运行：node workspace/news/pipeline/ai-normalizer/build-g55.cjs
 * 步骤：
 *   1) 读 h5 idSpace（只读）+ candidates/20260923.json（G5.4 桩版 133 条）
 *   2) 读 ai-results-20260923.cjs（会话内 LLM 逐条整理结果）
 *      —— 覆盖完整性预检：键必须与候选一一对应，缺一即 FAIL
 *   3) normalizeAll → 增强版候选 + 旧→新 id 映射
 *   4) 落盘 ai-normalizer/output/20260923.json
 *   5) merger 联动对比（before 桩版 vs after 增强版，窗口 3 天）
 *   6) 质量统计（字段完整率/实体统计/异常处理）
 * ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const LOG_PATH = path.join(__dirname, 'out-g55.txt');
const _lines = [];
const _log = console.log.bind(console);
console.log = function () {
  const s = Array.prototype.map.call(arguments, String).join(' ');
  _lines.push(s); _log(s);
};
process.on('exit', function () {
  try { fs.writeFileSync(LOG_PATH, _lines.join('\n') + '\n', 'utf8'); } catch (e) {}
});

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');   /* ai-normalizer→pipeline→news→workspace→项目根 */
const CD = require('../candidate-store.cjs');
const CI = require('../candidate-item.cjs');
const EM = require('../../engine/dedup/event-merger.cjs');
const AN = require('./ai-normalizer.cjs');
const AI = require('./ai-results-20260923.cjs');

function deepKeys(node) {
  const out = [];
  (function walk(n) {
    if (n == null || typeof n !== 'object') return;
    if (Array.isArray(n)) { n.forEach(walk); return; }
    Object.keys(n).forEach(function (k) { out.push(k); walk(n[k]); });
  })(node);
  return out;
}

(async function main() {
  console.log('============================================================');
  console.log('G5.5 AI 整理执行编排（真实 133 条）');
  console.log('============================================================');

  /* 1) idSpace */
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

  /* 2) 输入 */
  const cands = CD.loadCandidates({ date: '20260923' });
  console.log('输入候选（G5.4 桩版）：' + cands.length + ' 条');
  const aiKeys = Object.keys(AI.results);
  console.log('AI 整理结果：' + aiKeys.length + ' 条（model=' + AI.meta.model + '）');

  /* 覆盖完整性预检 */
  const missing = cands.filter(function (c) { return !AI.results[c.candidate_id]; }).map(function (c) { return c.candidate_id; });
  const extra = aiKeys.filter(function (k) { return !cands.some(function (c) { return c.candidate_id === k; }); });
  if (missing.length || extra.length) {
    console.log('★ 覆盖不完整：missing=' + JSON.stringify(missing.slice(0, 5)) + ' extra=' + JSON.stringify(extra.slice(0, 5)));
    process.exit(1);
  }
  console.log('覆盖完整性预检：133/133 一一对应，0 缺失，0 多余 ✅');

  /* 3) 增强 */
  const res = AN.normalizeAll(cands, AI.results, { idSpace: idSpace });
  const enhanced = res.candidates;

  /* 4) 落盘 */
  const doc = {
    schema_version: '1.0',
    layer: 'L1-AI',
    ai_model: AI.meta.model,
    generated_at: new Date().toISOString(),
    input: 'pipeline/candidates/20260923.json（G5.4 桩版 133 条）',
    count: enhanced.length,
    note: 'AI 整理增强版候选：七字段来自 AI（title/summary/category/related_×3/phases），event_key/candidate_id 重算；旧→新 id 映射见 mappings；桩版原样保留于 pipeline/candidates/',
    forbidden_fields_note: '本层不生成 verification_status / judged_by / status_history 等任何状态字段',
    mappings: res.mappings,
    candidates: enhanced
  };
  const outFile = path.join(__dirname, 'output', '20260923.json');
  const tmp = outFile + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(doc, null, 2), 'utf8');
  fs.renameSync(tmp, outFile);
  console.log('增强版落盘：' + outFile);

  /* 5) merger 联动对比 */
  console.log('\n■ merger 联动对比（窗口 3 天）');
  const before = EM.mergeCandidates(CI.toMergerInputs(cands), { windowDays: 3 });
  const after = EM.mergeCandidates(CI.toMergerInputs(enhanced), { windowDays: 3 });
  console.log('  before（桩版）：input=' + before.stats.input_items +
    ' → events=' + before.stats.output_events +
    '（mergeable=' + before.stats.mergeable_events + ' held=' + before.stats.held_events + '）' +
    ' reports_preserved=' + before.stats.reports_preserved +
    ' records_deleted=' + before.stats.records_deleted);
  console.log('  after（增强）：input=' + after.stats.input_items +
    ' → events=' + after.stats.output_events +
    '（mergeable=' + after.stats.mergeable_events + ' held=' + after.stats.held_events + '）' +
    ' reports_preserved=' + after.stats.reports_preserved +
    ' records_deleted=' + after.stats.records_deleted);
  console.log('  事件数变化：' + before.stats.output_events + ' → ' + after.stats.output_events +
    '（' + (after.stats.output_events - before.stats.output_events >= 0 ? '+' : '') + (after.stats.output_events - before.stats.output_events) + '）');

  /* 多报道事件清单（供错误合并人工复核） */
  function multiReportEvents(m) {
    return m.events.filter(function (e) { return e.report_count >= 2; }).map(function (e) {
      return { event_key: e.event_key, decision: e.decision, reports: e.reports.map(function (r) { return r.id + '|' + (r.source_names || []).join('/'); }) };
    });
  }
  const beforeMulti = multiReportEvents(before);
  const afterMulti = multiReportEvents(after);
  console.log('\n  before 多报道事件：' + beforeMulti.length + ' 个');
  beforeMulti.forEach(function (e) {
    console.log('    ' + e.event_key + ' [' + e.decision + '] ' + e.reports.join('  +  '));
  });
  console.log('\n  after 多报道事件：' + afterMulti.length + ' 个（错误合并人工复核对象）');
  afterMulti.forEach(function (e) {
    console.log('    ' + e.event_key + ' [' + e.decision + '] ' + e.reports.join('  +  '));
  });

  /* 落盘 merger 对比产物 */
  const cmpDoc = {
    schema_version: '1.0',
    generated_at: new Date().toISOString(),
    window_days: 3,
    before: { stats: before.stats, multi_report_events: beforeMulti },
    after: { stats: after.stats, multi_report_events: afterMulti, events: after.events },
    note: 'merger 联动对比：before=桩版候选，after=AI 增强候选；状态字段零生成'
  };
  const cmpFile = path.join(__dirname, 'output', '20260923.merger-comparison.json');
  fs.writeFileSync(cmpFile, JSON.stringify(cmpDoc, null, 2), 'utf8');
  console.log('\n  对比产物落盘：' + cmpFile);

  /* 6) 质量统计 */
  console.log('\n■ 质量统计');
  const st = {
    input: cands.length, output: enhanced.length,
    title_ok: 0, summary_ok: 0, category_ok: 0,
    with_entities: 0, entity_hits: {}, dropped_entities: 0,
    with_phases: 0, category_after: {}, category_before: {},
    ai_summary_rewritten: 0, unchanged_no_ai: 0
  };
  const mk = function (s) { return /<[a-zA-Z\/][^>]*>/.test(String(s || '')); };
  const catCount = function (arr, key) {
    arr.forEach(function (c) { st[key][c.category] = (st[key][c.category] || 0) + 1; });
  };
  catCount(cands, 'category_before');
  catCount(enhanced, 'category_after');
  enhanced.forEach(function (c) {
    if (c.title && c.title.trim() && !mk(c.title)) st.title_ok++;
    if (c.summary && c.summary.trim() && !mk(c.summary)) st.summary_ok++;
    if (CI.CATEGORIES.indexOf(c.category) >= 0) st.category_ok++;
    const n = c.related_movies.length + c.related_series.length + c.related_characters.length;
    if (n > 0) {
      st.with_entities++;
      c.related_movies.concat(c.related_series).forEach(function (id) { st.entity_hits[id] = (st.entity_hits[id] || 0) + 1; });
      c.related_characters.forEach(function (id) { st.entity_hits[id] = (st.entity_hits[id] || 0) + 1; });
    }
    if (c.related_phases.length) st.with_phases++;
    /* 摘要是否真的被改写（不再是模板句） */
    if (!/The post .* appeared first on/.test(String(c.summary)) && !/appeared first on/.test(String(c.summary))) st.ai_summary_rewritten++;
  });
  res.mappings.forEach(function (m) {
    st.dropped_entities += (m.dropped ? m.dropped.movies.length + m.dropped.series.length + m.dropped.characters.length : 0);
    if (m.changed_keys.length === 0) st.unchanged_no_ai++;
  });
  console.log('  输入=' + st.input + ' 输出=' + st.output);
  console.log('  字段完整率：title ' + st.title_ok + '/' + st.output + '｜summary ' + st.summary_ok + '/' + st.output + '｜category ' + st.category_ok + '/' + st.output);
  console.log('  实体：含实体候选 ' + st.with_entities + ' 条｜白名单丢弃 ' + st.dropped_entities + ' 项｜填阶段 ' + st.with_phases + ' 条');
  console.log('  实体命中分布：' + JSON.stringify(st.entity_hits));
  console.log('  category 分布 before=' + JSON.stringify(st.category_before));
  console.log('  category 分布 after =' + JSON.stringify(st.category_after));
  console.log('  摘要模板句清除率：' + st.ai_summary_rewritten + '/' + st.output);
  console.log('  未增强（无 AI 结果）候选：' + st.unchanged_no_ai);

  /* 禁止字段终检（增强版全量深扫） */
  const forbidden = [];
  enhanced.forEach(function (c) {
    deepKeys(c).forEach(function (k) {
      if (['verification_status', 'judged_by', 'status_history', 'occurrence', 'chain_steps_hit'].indexOf(k) >= 0) forbidden.push(k);
    });
  });
  console.log('  禁止字段深扫（verification_status/judged_by/status_history/occurrence/chain_steps_hit）：' +
    (forbidden.length === 0 ? '0 命中 ✅' : '★ 命中 ' + forbidden.length + ' ❌'));

  /* AI 结果自身禁止字段终检 */
  const aiForbidden = Object.keys(AI.results).filter(function (k) {
    return Object.keys(AI.results[k]).some(function (f) { return AN.AI_ALLOWED_FIELDS.indexOf(f) < 0; });
  });
  console.log('  AI 结果白名单外字段：' + (aiForbidden.length === 0 ? '0 ✅' : '★ ' + aiForbidden.join(',') + ' ❌'));

  console.log('\n============================================================');
  console.log('G5.5 编排完成。');
  console.log('============================================================');
})();
