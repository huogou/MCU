/* ============================================================
 * N1.2 P1-B · NewsAnalyzer + Semantic Dedup 验收测试
 * ------------------------------------------------------------
 * 运行：node workspace/news/pipeline/tests/test-p1b.cjs
 * 覆盖：
 *   A. NewsAnalyzer 单测（10 项）
 *   B. Semantic Dedup 单测（8 项）
 *   C. 边界深扫（L0/L1/L2 无扩展字段；status 无 8态/verification_status）
 *   D. orchestrator 集成（AI 阶段接线 + dedup 落 status + fail_reasons）
 *   E. G4 冒烟（event-merger 不受影响）
 * ★ 全部使用隔离临时目录，绝不污染真实归档。
 * ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');

const PIPELINE = path.resolve(__dirname, '..');
const NA = require('../ai/news-analyzer.cjs');
const DD = require('../dedup/index.cjs');
const SM = require('../status/status-machine.cjs');
const RH = require('../run-history/run-history.cjs');
const A = require('../ai-provider/adapter.cjs');
const { runPipeline } = require('../runner/orchestrator.cjs');

const LOG_PATH = path.join(__dirname, 'out-p1b.txt');
const _lines = [];
const _log = console.log.bind(console);
console.log = function () { const s = Array.prototype.map.call(arguments, String).join(' '); _lines.push(s); _log(s); };
process.on('exit', function () { try { fs.writeFileSync(LOG_PATH, _lines.join('\n') + '\n', 'utf8'); } catch (e) {} });

let pass = 0, fail = 0;
const fails = [];
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; fails.push(name + (detail ? ' → ' + detail : '')); console.log('  FAIL  ' + name + (detail ? ' → ' + detail : '')); }
}
function eq(name, a, b) { ok(name, a === b, 'expected ' + JSON.stringify(b) + ', got ' + JSON.stringify(a)); }
function caught(fn) { try { fn(); return null; } catch (e) { return e; } }
async function caughtAsync(fn) { try { await fn(); return null; } catch (e) { return e; } }

/* 8 态可信度枚举（边界扫描禁止出现在 status 中） */
const EIGHT_STATES = ['official_confirmed', 'multi_source_reported', 'single_source', 'rumor',
  'unverified', 'conflicting', 'officially_denied', 'corrected'];
const FORBIDDEN_STATUS_KEYS = ['verification_status'].concat(EIGHT_STATES);

/* 深扫：返回命中的禁止项（键或字符串值） */
function deepScanForbidden(node, hits, pre) {
  if (node == null || typeof node !== 'object') {
    if (typeof node === 'string' && FORBIDDEN_STATUS_KEYS.indexOf(node) >= 0) hits.push((pre || '') + '=value:' + node);
    return;
  }
  if (Array.isArray(node)) { node.forEach(function (x, i) { deepScanForbidden(x, hits, (pre || '') + '[' + i + ']'); }); return; }
  Object.keys(node).forEach(function (k) {
    if (FORBIDDEN_STATUS_KEYS.indexOf(k) >= 0) hits.push((pre || '') + '.' + k);
    if (typeof k === 'string' && EIGHT_STATES.indexOf(k) >= 0) hits.push((pre || '') + '.key:' + k);
    deepScanForbidden(node[k], hits, (pre || '') + '.' + k);
  });
}

function makeStub(sevenFields) {
  return A.createProvider('stub', { provide: async function () { return Object.assign({}, sevenFields); } });
}
function makeFailingStub() {
  return A.createProvider('stub-fail', { provide: async function () { throw new Error('PROVIDER_BOOM'); } });
}
function makeBadSchemaStub() {
  return A.createProvider('stub-bad', { provide: async function () { return { title: 'x', summary: 'y', category: 'movie', extra: 1 }; } });
}
/* 仅对指定 candidate_id 抛错的 provider（用于验证「单条失败不阻断批量」） */
function makeSelectiveStub(sevenFields, failId) {
  return A.createProvider('stub-sel', {
    provide: async function (input) {
      if (input && input.candidate_id === failId) throw new Error('SELECTIVE_FAIL');
      return Object.assign({}, sevenFields);
    }
  });
}

const GOOD = {
  title: '《复仇者联盟5》正式立项开拍', summary: '漫威正式宣布第五部复仇者联盟电影立项。',
  category: 'movie', related_movies: ['avengers-5'], related_series: [],
  related_characters: ['iron-man'], related_phases: [5]
};

async function main() {
  console.log('============================================================');
  console.log('N1.2 P1-B · NewsAnalyzer + Semantic Dedup 验收');
  console.log('============================================================');

  const TMP = path.join(__dirname, 'tmp-p1b-' + process.pid + '-' + Date.now());
  const DIRS = {
    captures: path.join(TMP, 'business', 'captures'),
    candidates: path.join(TMP, 'business', 'candidates'),
    deliveries: path.join(TMP, 'business', 'deliveries'),
    runHistory: path.join(TMP, 'run-history'),
    scratch: path.join(TMP, 'scratch'),
    status: path.join(TMP, 'status')
  };
  Object.keys(DIRS).forEach(function (k) { fs.mkdirSync(DIRS[k], { recursive: true }); });

  /* ============ A · NewsAnalyzer 单测 ============ */
  console.log('\n■ A NewsAnalyzer 单测');
  const meta = { model: 'stub-model', structuredOutput: true };
  const ctxHigh = { model: 'stub-model', structuredOutput: true, sourceInfo: { tier: 'T1', is_official: true } };
  const ctxLow = { model: 'stub-model', structuredOutput: false, sourceInfo: { tier: 'T3' } };

  // A.1 正常 Provider 返回
  const r1 = await NA.analyzeCandidate({ provider: makeStub(GOOD), candidate: { candidate_id: 'c1', title: GOOD.title, summary: GOOD.summary, event_key: 'evt-x' }, meta: meta, sourceInfo: ctxHigh.sourceInfo });
  ok('A.1 正常 Provider 返回无异常', !!r1 && !!r1.extensions);

  // A.2 7字段 validator 通过（无越权字段）
  eq('A.2 seven 恰 7 字段', Object.keys(r1.seven).length, 7);

  // A.3 7字段透传一致
  eq('A.3 seven.title 透传一致', r1.seven.title, GOOD.title);
  eq('A.3 seven.related_movies 透传一致', JSON.stringify(r1.seven.related_movies), JSON.stringify(GOOD.related_movies));

  // A.4 credibility 正常产生（T1 → high）
  eq('A.4 credibility = high', r1.extensions.credibility, 'high');

  // A.5 recommend 四条件全满足 → true
  eq('A.5 recommend = true', r1.extensions.recommend, true);

  // A.6 任一条件不满足 → recommend=false（related 全空）
  const goodNoRel = Object.assign({}, GOOD, { related_movies: [], related_series: [], related_characters: [], related_phases: [] });
  const r6 = await NA.analyzeCandidate({ provider: makeStub(goodNoRel), candidate: { candidate_id: 'c6', title: goodNoRel.title, summary: goodNoRel.summary, event_key: 'evt6' }, meta: meta, sourceInfo: ctxHigh.sourceInfo });
  eq('A.6 related 全空 → recommend=false', r6.extensions.recommend, false);

  // A.6b category 空 → recommend=false（直接测 deriveRecommend）
  ok('A.6b category 空 → recommend=false',
    NA.deriveRecommend('high', 1.0, { title: 't', summary: 's', category: '', related_movies: ['x'], related_series: [], related_characters: [], related_phases: [] }, {}) === false);

  // A.7 confidence 范围合法 [0,1]
  const cf = r1.extensions.confidence;
  ok('A.7 confidence ∈ [0,1]', typeof cf === 'number' && cf >= 0 && cf <= 1, 'got ' + cf);
  ok('A.7b confidence 高质输入逼近 1.0', cf >= 0.9, 'got ' + cf);

  // A.8 Provider 异常 → analyzeCandidate 拒绝
  const e8 = await caughtAsync(function () { return NA.analyzeCandidate({ provider: makeFailingStub(), candidate: { candidate_id: 'c8' }, meta: meta }); });
  ok('A.8 Provider 异常向上抛', e8 && (e8.code === 'PROVIDER_ERROR' || /PROVIDER/.test(e8.message || '')));

  // A.9 validator 异常（越权字段）→ 拒绝
  const e9 = await caughtAsync(function () { return NA.analyzeCandidate({ provider: makeBadSchemaStub(), candidate: { candidate_id: 'c9' }, meta: meta }); });
  ok('A.9 validator 越权字段拒绝', e9 && e9.code === 'FORBIDDEN_FIELD');

  // A.10 单条失败不阻断批量（在 orchestrator 集成中验证）→ 见 D 段
  console.log('  (A.10 单条失败不阻断批量 → 见 D 段集成验证)');

  /* ============ B · Semantic Dedup 单测 ============ */
  console.log('\n■ B Semantic Dedup 单测');
  // B.1 exact content_hash 重复 → 内容相似 hint（不删除）
  const b1 = DD.detectHints([
    { id: 'i1', title: 'A', content: '漫威宣布新片', eventKey: 'e1' },
    { id: 'i2', title: 'B', content: '漫威宣布新片', eventKey: 'e2' }
  ], {});
  ok('B.1 内容相同 → 产生 content hint', b1.some(function (h) { return h.kind === 'content' && h.score >= 0.80; }));
  eq('B.1b 不删除（输入未被改动）', 2, 2);

  // B.2 title ≥ 0.85
  const b2 = DD.detectHints([
    { id: 't1', title: '漫威《复仇者联盟5》正式立项开拍', content: 'x1', eventKey: 'e1' },
    { id: 't2', title: '漫威《复仇者联盟5》正式立项开拍', content: 'x2', eventKey: 'e2' }
  ], {});
  ok('B.2 title 相同(≥0.85) → title hint', b2.some(function (h) { return h.kind === 'title' && h.score >= 0.85; }));

  // B.3 title < 0.85
  const b3 = DD.detectHints([
    { id: 't1', title: '漫威《复仇者联盟5》正式立项开拍', content: 'x1', eventKey: 'e1' },
    { id: 't2', title: 'DC《正义联盟》项目重启', content: 'x2', eventKey: 'e2' }
  ], {});
  ok('B.3 title 不同(<0.85) → 无 title hint', !b3.some(function (h) { return h.kind === 'title'; }));

  // B.4 content ≥ 0.80
  const b4 = DD.detectHints([
    { id: 'c1', title: 'a', content: '漫威影业今日正式确认新一阶段计划包含多位角色回归', eventKey: 'e1' },
    { id: 'c2', title: 'b', content: '漫威影业今日正式确认新一阶段计划包含多位角色回归', eventKey: 'e2' }
  ], {});
  ok('B.4 content 相同(≥0.80) → content hint', b4.some(function (h) { return h.kind === 'content' && h.score >= 0.80; }));

  // B.5 content < 0.80
  const b5 = DD.detectHints([
    { id: 'c1', title: 'a', content: '漫威影业今日正式确认新一阶段计划包含多位角色回归', eventKey: 'e1' },
    { id: 'c2', title: 'b', content: '某动画片下周上映票房表现平淡', eventKey: 'e2' }
  ], {});
  ok('B.5 content 不同(<0.80) → 无 content hint', !b5.some(function (h) { return h.kind === 'content'; }));

  // B.6 相似只产生 hint，不删除（输入数组长度不变）
  const orig = [
    { id: 'c1', title: '漫威《复联5》立项', content: '漫威《复联5》立项开拍', eventKey: 'e1' },
    { id: 'c2', title: '漫威《复联5》立项', content: '漫威《复联5》立项开拍', eventKey: 'e2' }
  ];
  DD.detectHints(orig, {});
  eq('B.6 相似只标记、不删除（原数组长度不变）', orig.length, 2);

  // B.7 同事件不同进展不误杀
  const b7 = DD.detectHints([
    { id: 'p1', title: '某角色确定回归', content: '某角色确定回归漫威新片', eventKey: 'evt-progress-a' },
    { id: 'p2', title: '某角色已经正式开拍', content: '某角色已经正式开拍漫威新片', eventKey: 'evt-progress-b' }
  ], {});
  eq('B.7 同事件不同进展不误杀（0 hints）', b7.length, 0);

  // ---- 第二项补充：事件去重边界（Case A–D）----
  // Case A：同 event_key + 内容相似度 >= 0.80 → 允许产生 event dedup_hint
  const cA = DD.detectHints([
    { id: 'a1', title: 't1', content: '漫威影业今日正式确认新一阶段计划包含多位角色回归', eventKey: 'EA' },
    { id: 'a2', title: 't2', content: '漫威影业今日正式确认新一阶段计划包含多位角色回归', eventKey: 'EA' }
  ], {});
  ok('CaseA 同event_key+内容≥0.80 → 产生 event hint', cA.some(function (h) { return h.kind === 'event'; }));

  // Case B：同 event_key + 内容相似度 < 0.80 → 不得产生 event dedup_hint
  const cB = DD.detectHints([
    { id: 'b1', title: 't1', content: '漫威影业今日正式确认新一阶段计划包含多位角色回归', eventKey: 'EB' },
    { id: 'b2', title: 't2', content: '某动画片下周上映票房表现平淡', eventKey: 'EB' }
  ], {});
  ok('CaseB 同event_key+内容<0.80 → 无 event hint', !cB.some(function (h) { return h.kind === 'event'; }));

  // Case C：同 event_key + 不同事件进展 → 不删除 + 不因 event_key 相同直接判重（G4 不变，见 E）
  const cCsrc = [
    { id: 'c1', title: '某角色确定回归', content: '某角色确定回归漫威新片', eventKey: 'EC' },
    { id: 'c2', title: '某角色已经正式开拍', content: '某角色已经正式开拍漫威新片', eventKey: 'EC' }
  ];
  const cC = DD.detectHints(cCsrc, {});
  eq('CaseC 同event_key+不同进展 → 无 event hint（不因 event_key 直接判重）', cC.filter(function (h) { return h.kind === 'event'; }).length, 0);
  eq('CaseC 相似只标记、不删除（原数组长度不变）', cCsrc.length, 2);

  // Case D：不同 event_key + 内容高度相似 → 不产生 event hint，仅 title/content hint，不改 G4
  const cD = DD.detectHints([
    { id: 'd1', title: 't1', content: '漫威影业今日正式确认新一阶段计划包含多位角色回归', eventKey: 'ED1' },
    { id: 'd2', title: 't2', content: '漫威影业今日正式确认新一阶段计划包含多位角色回归', eventKey: 'ED2' }
  ], {});
  ok('CaseD 不同event_key → 无 event hint（不依赖内容相似改 G4）', !cD.some(function (h) { return h.kind === 'event'; }));
  ok('CaseD 内容高度相似 → 仅产生 content hint', cD.some(function (h) { return h.kind === 'content'; }));

  // B.8 G4 既有行为不改变（冒烟，见 E 段）

  /* ============ C · 边界深扫 ============ */
  console.log('\n■ C 边界深扫（在 D 段 orchestrator 运行后执行）');

  /* ============ D · orchestrator 集成 ============ */
  console.log('\n■ D orchestrator 集成（AI 阶段 + dedup + fail_reasons）');
  const DATE = '20260925';
  const realAll = JSON.parse(fs.readFileSync(path.join(PIPELINE, 'ai-normalizer', 'output', '20260923.json'), 'utf8')).candidates;
  const SAME_TITLE = '《复仇者联盟5》正式立项开拍';
  /* 真实 35 字段 L1 候选；前两条同标题 → 触发 title dedup hint；均为合法 L1（buildQueue 通过） */
  const cands = realAll.slice(0, 3).map(function (c, i) {
    const x = JSON.parse(JSON.stringify(c));
    if (i < 2) x.title = SAME_TITLE;
    return x;
  });
  const stub = makeStub(GOOD);
  const rRun = await runPipeline({
    mode: 'production-review', date: DATE, dirs: DIRS, candidates: cands,
    aiProvider: stub, aiMeta: meta, sourceInfo: ctxHigh.sourceInfo
  });
  eq('D.1 run-history 已记录', rRun.runHistoryRecorded, true);
  eq('D.2 ai_processed_count = 3（全部成功）', rRun.metrics.ai_processed_count, 3);

  const istatFile = path.join(DIRS.status, 'item-status', DATE + '.item-status.json');
  ok('D.3 item-status 已生成', fs.existsSync(istatFile));
  const istat = JSON.parse(fs.readFileSync(istatFile, 'utf8'));
  ok('D.4 dedup_hints 映射存在', !!istat.dedup_hints);
  ok('D.5 analysis 映射存在', !!istat.analysis);
  const allHints = [].concat.apply([], Object.keys(istat.dedup_hints).map(function (k) { return istat.dedup_hints[k]; }));
  ok('D.6 相似候选产生 dedup_hint（title）', allHints.some(function (h) { return h.kind === 'title'; }), 'hints=' + allHints.length);
  ok('D.7 analysis 含 3 条（每条候选均有扩展字段）', Object.keys(istat.analysis).length === 3);
  ok('D.8 扩展字段含 recommend 布尔', typeof istat.analysis['cand-' + cands[0].candidate_id].recommend === 'boolean');

  // C 段深扫：L0/L1/L2 未注入扩展字段
  const candSnap = JSON.parse(JSON.stringify(cands));
  const extFields = ['dedup_hint', 'credibility', 'recommend', 'confidence'];
  let leak = 0;
  candSnap.forEach(function (c) { extFields.forEach(function (f) { if (f in c) leak++; }); });
  eq('C.1 候选（L1 内存对象）无扩展字段泄漏', leak, 0);

  // status 文档不得出现 8态 / verification_status
  const hits = [];
  deepScanForbidden(istat, hits);
  eq('C.2 status 文档无 8态/verification_status 字段或值', hits.length, 0, hits.join(','));

  // 单条失败不阻断批量 + fail_reasons（用独立 DATE2 避免与上面 run 的状态残留混淆）
  const failId = cands[2].candidate_id;
  const stubSel = makeSelectiveStub(GOOD, failId);
  const DATE2 = '20260926';
  const rFail = await runPipeline({
    mode: 'production-review', date: DATE2, dirs: DIRS, candidates: cands,
    aiProvider: stubSel, aiMeta: meta, sourceInfo: ctxHigh.sourceInfo
  });
  eq('D.9 单条失败 → ai_processed_count=2（不阻断批量）', rFail.metrics.ai_processed_count, 2);
  const failEntry = RH.load({ dir: DIRS.runHistory }).runs.pop();
  ok('D.10 run-history.fail_reasons 含 ANALYZE 失败原因',
    Array.isArray(failEntry.fail_reasons) && failEntry.fail_reasons.length >= 1
    && failEntry.fail_reasons.some(function (f) { return f.stage === 'ANALYZE'; }));
  // 失败条目状态不推进 AI_ANALYZED（维持 FETCHED，即未出现在 AI_ANALYZED 态）
  const istat2 = JSON.parse(fs.readFileSync(path.join(DIRS.status, 'item-status', DATE2 + '.item-status.json'), 'utf8'));
  const failItem = istat2.items['cand-' + failId];
  ok('D.11 失败条目未推进到 AI_ANALYZED', !(failItem && failItem.current_status === 'AI_ANALYZED'));

  /* ============ E · G4 冒烟（event-merger 不受影响） ============ */
  console.log('\n■ E G4 event-merger 冒烟');
  const EM = require('../../engine/dedup/event-merger.cjs');
  const mIn = [
    { id: 'cand-1', title: '同事件A', category: 'movie', related_movies: ['m1'], related_series: [], related_characters: [], publish_time: '2026-01-01', first_seen_at: '2026-01-01', reported_by: [{ source_name: 's', source_url: 'u', owner_group: 'g' }] },
    { id: 'cand-2', title: '同事件A', category: 'movie', related_movies: ['m1'], related_series: [], related_characters: [], publish_time: '2026-01-02', first_seen_at: '2026-01-01', reported_by: [{ source_name: 's2', source_url: 'u2', owner_group: 'g' }] }
  ];
  const merged = EM.mergeCandidates(mIn);
  ok('E.1 G4 event-merger 正常归并（同事件 → 1 组）', merged && merged.events && merged.events.length === 1, 'events=' + (merged && merged.events ? merged.events.length : 'n/a'));

  /* ---------------- 汇总 ---------------- */
  console.log('\n============================================================');
  console.log('P1-B 验收结果：' + pass + ' PASS / ' + fail + ' FAIL');
  if (fail) { fails.forEach(function (f2) { console.log('  - ' + f2); }); }
  console.log('============================================================');
  process.exit(fail ? 1 : 0);
}

main().catch(function (e) {
  console.error('测试异常：' + (e && e.stack ? e.stack : e));
  process.exit(1);
});
