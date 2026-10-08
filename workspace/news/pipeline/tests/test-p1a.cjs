/* ============================================================
 * N1.2 P1-A · 状态与日志基础设施 验收测试
 * ------------------------------------------------------------
 * 运行：node workspace/news/pipeline/tests/test-p1a.cjs
 * 覆盖：
 *   A. 状态层隔离（item 仅 5 字段、无业务字段、单向不回退）
 *   B. run-history 兼容（FIELDS 仍为 10、历史10字段可校验、新12字段可校验、越权字段仍拒）
 *   C. orchestrator 接线（dry-run 不写 status、production 写 status + 新字段落 run-history）
 * ★ 全部使用隔离临时目录，绝不污染真实归档。
 * ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');

const PIPELINE = path.resolve(__dirname, '..');   /* .../workspace/news/pipeline */
const RH = require('../run-history/run-history.cjs');
const SM = require('../status/status-machine.cjs');
const { runPipeline } = require('../runner/orchestrator.cjs');

const LOG_PATH = path.join(__dirname, 'out-p1a.txt');
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

async function main() {
  console.log('============================================================');
  console.log('N1.2 P1-A · 状态与日志基础设施 验收');
  console.log('============================================================');

  const TMP = path.join(__dirname, 'tmp-p1a-' + process.pid + '-' + Date.now());
  const DIRS = {
    captures: path.join(TMP, 'business', 'captures'),
    candidates: path.join(TMP, 'business', 'candidates'),
    deliveries: path.join(TMP, 'business', 'deliveries'),
    runHistory: path.join(TMP, 'run-history'),
    scratch: path.join(TMP, 'scratch'),
    status: path.join(TMP, 'status')
  };
  Object.keys(DIRS).forEach(function (d) { fs.mkdirSync(d, { recursive: true }); });

  const realCaptures = JSON.parse(fs.readFileSync(
    path.join(PIPELINE, 'captures', '20260923.captures.json'), 'utf8')).captures.slice(0, 5);
  const realCandidates = JSON.parse(fs.readFileSync(
    path.join(PIPELINE, 'ai-normalizer', 'output', '20260923.json'), 'utf8')).candidates.slice(0, 6);
  const decs = realCandidates.slice(0, 4).map(function (c) { return { candidate_id: c.candidate_id, action: 'approve' }; })
    .concat(realCandidates.slice(4, 6).map(function (c) { return { candidate_id: c.candidate_id, action: 'reject', reason: '测试拒绝' }; }));

  /* ============ A · 状态层隔离 ============ */
  console.log('\n■ A 状态层隔离与单向流转');
  const sTmp = path.join(TMP, 'status-unit');
  const store = SM.createItemStore({ dir: sTmp, date: '20260930' });
  store.mark('cap-1', 'L0', 'FETCHED', { evidence: 'collect:S002' });
  store.mark('cap-1', 'L0', 'FETCHED', { evidence: 'collect:S002' });  // 同态应 noop
  store.mark('cand-2', 'L1', 'VERIFIED', { evidence: 'gate:approve' }); // RAW 自动初始化后前进
  const rBack = store.mark('cand-2', 'L1', 'RAW');                      // 回退 → anomaly
  store.persist();
  const doc = store.load();

  Object.keys(doc.items).forEach(function (id) {
    const it = doc.items[id];
    const extra = Object.keys(it).filter(function (k) { return SM.ITEM_FIELDS.indexOf(k) < 0; });
    eq('item(' + id + ') 仅含 5 允许字段（无业务字段）', extra.length, 0);
    eq('item(' + id + ') 必含 item_id', it.item_id === id, true);
    eq('item(' + id + ') 必含 ref_layer', typeof it.ref_layer === 'string', true);
    eq('item(' + id + ') 必含 current_status', typeof it.current_status === 'string', true);
    eq('item(' + id + ') 必含 history 数组', Array.isArray(it.history), true);
    eq('item(' + id + ') 必含 timestamp', typeof it.timestamp === 'string', true);
  });
  eq('A. 同态 FETCHED→FETCHED 为 noop', store.mark('cap-1', 'L0', 'FETCHED').status, 'noop');
  eq('A. 回退 VERIFIED→RAW 被拒（anomaly）', rBack.status, 'anomaly');
  ok('A. canTransition 单向：RAW→FETCHED 允许', SM.canTransition('RAW', 'FETCHED') === true);
  ok('A. canTransition 禁止回退：VERIFIED→FETCHED 拒绝', SM.canTransition('VERIFIED', 'FETCHED') === false);
  ok('A. canTransition 禁止回退：FETCHED→RAW 拒绝', SM.canTransition('FETCHED', 'RAW') === false);
  ok('A. 文件级 anomalies 不污染 item（记录非法转换）', Array.isArray(doc.anomalies) && doc.anomalies.length >= 1);

  /* ============ B · run-history 兼容 ============ */
  console.log('\n■ B run-history 兼容（向后兼容 + 新字段）');
  const base10 = {
    run_id: 'run-20260930-001', start_time: '2026-09-30T00:00:00Z', end_time: '2026-09-30T00:01:00Z',
    source_success: 1, source_failed: 0, capture_count: 5, candidate_count: 0,
    approved_count: 0, rejected_count: 0, delivery_count: 0
  };
  ok('B.1 历史 10 字段校验通过', RH.validate(Object.assign({}, base10)) === true);
  eq('B.2 FIELDS 仍为 10（不破坏 test-g10 T1.1）', RH.FIELDS.length, 10);
  ok('B.3 含可选扩展字段的 12 字段校验通过',
    RH.validate(Object.assign({}, base10, { ai_processed_count: 3, fail_reasons: [{ stage: 'COLLECT', source: 'S002', code: 'X', message: 'y' }] })) === true);
  eq('B.4 越权字段仍拒绝（FIELD_SET_MISMATCH）',
    caught(function () { RH.validate(Object.assign({}, base10, { note: 'x' })); }).code, 'FIELD_SET_MISMATCH');
  eq('B.5 缺必填字段仍拒绝',
    caught(function () { const e = Object.assign({}, base10); delete e.delivery_count; RH.validate(e); }).code, 'FIELD_SET_MISMATCH');
  eq('B.6 可选字段类型错误仍拒绝（ai_processed_count 负数）',
    caught(function () { RH.validate(Object.assign({}, base10, { ai_processed_count: -1 })); }).code, 'BAD_COUNT');

  /* ============ C · orchestrator 接线 ============ */
  console.log('\n■ C orchestrator 状态通知接线');
  const DATE = '20260924';

  /* C.1 dry-run：即便传入 status 目录也不写（守 D1 + 状态层仅 production） */
  const rDry = await runPipeline({ mode: 'dry-run', date: DATE, dirs: DIRS, captures: realCaptures });
  eq('C.1.1 dry-run 不写 run-history', RH.load({ dir: DIRS.runHistory }).runs.length, 0);
  eq('C.1.2 dry-run 不写 item-status', fs.existsSync(path.join(DIRS.status, 'item-status', DATE + '.item-status.json')), false);
  eq('C.1.3 dry-run 不写 run-status', fs.existsSync(path.join(DIRS.status, 'run-status')), false);

  /* C.2 production-capture：写 status（FETCHED）+ run-history 新字段 */
  fs.mkdirSync(DIRS.runHistory, { recursive: true });
  fs.mkdirSync(DIRS.status, { recursive: true });
  const rCap = await runPipeline({ mode: 'production-capture', date: DATE, dirs: DIRS, captures: realCaptures });
  eq('C.2.1 run-history 已记录', rCap.runHistoryRecorded, true);
  const capEntry = RH.load({ dir: DIRS.runHistory }).runs.pop();
  ok('C.2.2 新记录含 ai_processed_count', 'ai_processed_count' in capEntry);
  ok('C.2.3 新记录含 fail_reasons 数组', Array.isArray(capEntry.fail_reasons));
  eq('C.2.4 item-status 文件已生成', fs.existsSync(path.join(DIRS.status, 'item-status', DATE + '.item-status.json')), true);
  const istat = JSON.parse(fs.readFileSync(path.join(DIRS.status, 'item-status', DATE + '.item-status.json'), 'utf8'));
  const ids = Object.keys(istat.items);
  ok('C.2.5 item-status 含 FETCHED 条目', ids.length === realCaptures.length);
  ids.forEach(function (id) {
    const it = istat.items[id];
    const extra = Object.keys(it).filter(function (k) { return SM.ITEM_FIELDS.indexOf(k) < 0; });
    eq('C.2.6 ' + id + ' 仅 5 字段', extra.length, 0);
    eq('C.2.7 ' + id + ' 状态=FETCHED', it.current_status, 'FETCHED');
  });

  /* C.3 production-delivery-preview：VERIFIED + PUBLISHED */
  const rDel = await runPipeline({ mode: 'production-delivery-preview', date: DATE, dirs: DIRS, candidates: realCandidates, decisions: decs });
  const rstat = JSON.parse(fs.readFileSync(path.join(DIRS.status, 'run-status', rDel.runId + '.status.json'), 'utf8'));
  eq('C.3.1 run-status 含 run_id', rstat.run_id, rDel.runId);
  eq('C.3.2 run-status 含 mode', rstat.mode, 'production-delivery-preview');
  ok('C.3.3 run-status 含 stages.VERIFY', !!rstat.stages.VERIFY);
  ok('C.3.4 run-status 含 stages.DELIVER', !!rstat.stages.DELIVER);
  ok('C.3.5 run-status 含 errors 数组', Array.isArray(rstat.errors));
  const istat2 = JSON.parse(fs.readFileSync(path.join(DIRS.status, 'item-status', DATE + '.item-status.json'), 'utf8'));
  /* 审批通过候选的状态流：VERIFIED → PUBLISHED，最终态为 PUBLISHED。
   * 故以「至少到达 VERIFIED（current_status 为 VERIFIED/PUBLISHED）且历史含 VERIFIED 步骤」判定。 */
  const verifiedOrPublished = Object.keys(istat2.items).filter(function (id) {
    const s = istat2.items[id].current_status;
    return s === 'VERIFIED' || s === 'PUBLISHED';
  });
  const withVerifiedHistory = Object.keys(istat2.items).filter(function (id) {
    return istat2.items[id].history.some(function (h) { return h.status === 'VERIFIED'; });
  });
  eq('C.3.6 审批通过候选均达 VERIFIED/PUBLISHED = 4', verifiedOrPublished.length, 4);
  eq('C.3.6b 历史含 VERIFIED 步骤 = 4', withVerifiedHistory.length, 4);
  const published = Object.keys(istat2.items).filter(function (id) { return istat2.items[id].current_status === 'PUBLISHED'; });
  eq('C.3.7 PUBLISHED 数量 = 4', published.length, 4);

  /* C.4 L0/L1/L2 未被注入状态字段（隔离验证） */
  const capFields = Object.keys(realCaptures[0]).filter(function (k) { return ['verification_status', 'status_history', 'status_changed_at', 'judged_by', 'current_status', 'history'].indexOf(k) >= 0; });
  eq('C.4 L0 对象无新增状态字段', capFields.length, 0);

  /* ---------------- 汇总 ---------------- */
  console.log('\n============================================================');
  console.log('P1-A 验收结果：' + pass + ' PASS / ' + fail + ' FAIL');
  if (fail) { fails.forEach(function (f2) { console.log('  - ' + f2); }); }
  console.log('============================================================');
  process.exit(fail ? 1 : 0);
}

main().catch(function (e) {
  console.error('测试异常：' + (e && e.stack ? e.stack : e));
  process.exit(1);
});
