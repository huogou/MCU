/* ============================================================
 * N1 · D1/D2 行为矩阵验收测试（策划裁定：dry-run 不写 run-history、
 *      production-* 必写 run-history、业务数据仅 --persist 才落盘、
 *      dry-run + --persist 拒绝）
 * ------------------------------------------------------------
 * 运行：node workspace/news/pipeline/runner/tests/test-d1d2.cjs
 * ★ 全部使用隔离临时目录（pipeline/runner/tests/tmp-d1d2/），
 *   绝不污染真实生产归档（captures / candidates / deliveries / run-history）。
 * ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');

const PIPELINE = path.resolve(__dirname, '..', '..');                  /* .../workspace/news/pipeline */
const RH = require('../../run-history/run-history.cjs');
const CS = require('../../capture-store.cjs');
const { runPipeline } = require('../orchestrator.cjs');

const LOG_PATH = path.join(__dirname, 'out-d1d2.txt');
const _lines = [];
const _log = console.log.bind(console);
console.log = function () {
  const s = Array.prototype.map.call(arguments, String).join(' ');
  _lines.push(s); _log(s);
};
process.on('exit', function () { try { fs.writeFileSync(LOG_PATH, _lines.join('\n') + '\n', 'utf8'); } catch (e) {} });

const DATE = '20260924';
const TMP = path.join(__dirname, 'tmp-d1d2');
const DIRS = {
  captures: path.join(TMP, 'business', 'captures'),
  candidates: path.join(TMP, 'business', 'candidates'),
  deliveries: path.join(TMP, 'business', 'deliveries'),
  runHistory: path.join(TMP, 'run-history'),
  scratch: path.join(TMP, 'scratch')
};

/* 真实生产归档路径（用于「不得污染」断言） */
const REAL = {
  captures: path.join(PIPELINE, 'captures'),
  candidates: path.join(PIPELINE, 'candidates'),
  deliveries: path.join(PIPELINE, 'deliveries'),
  runHistory: path.join(PIPELINE, 'run-history')
};

let pass = 0, fail = 0;
const fails = [];
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; fails.push(name + (detail ? ' → ' + detail : '')); console.log('  FAIL  ' + name + (detail ? ' → ' + detail : '')); }
}
function eq(name, a, b) { ok(name, a === b, 'expected ' + JSON.stringify(b) + ', got ' + JSON.stringify(a)); }
function caught(fn) { try { fn(); return null; } catch (e) { return e; } }

/* ---------------- 计数工具 ---------------- */
function rhCount(dir) { return RH.load({ dir: dir }).runs.length; }
function capCount(dir) {
  const f = path.join(dir, DATE + '.captures.json');
  if (!fs.existsSync(f)) return 0;
  return JSON.parse(fs.readFileSync(f, 'utf8')).captures.length;
}
function candCount(dir) {
  const f = path.join(dir, DATE + '.json');
  if (!fs.existsSync(f)) return 0;
  return JSON.parse(fs.readFileSync(f, 'utf8')).candidates.length;
}
function delivCount(dir) {
  if (!fs.existsSync(dir)) return 0;
  return fs.readdirSync(dir).filter(function (x) { return /\.delivery-preview\.json$/.test(x); }).length;
}
function fileCount(dir) {
  if (!fs.existsSync(dir)) return 0;
  return fs.readdirSync(dir).length;
}

function run(over) {
  return runPipeline(Object.assign({ mode: 'dry-run', date: DATE, dirs: DIRS }, over));
}

/* ---------------- 主执行（async，因 runPipeline 为异步） ---------------- */
async function main() {
  console.log('============================================================');
  console.log('N1 · D1/D2 行为矩阵验收');
  console.log('============================================================');

  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  [DIRS.captures, DIRS.candidates, DIRS.deliveries, DIRS.runHistory, DIRS.scratch].forEach(function (d) {
    fs.mkdirSync(d, { recursive: true });
  });

  /* 真实 captures 切片（前 5 条，L0 合法） */
  const realCaptures = JSON.parse(fs.readFileSync(
    path.join(PIPELINE, 'captures', '20260923.captures.json'), 'utf8')).captures.slice(0, 5);
  /* 真实 candidates 切片（前 6 条，L1 35 字段） */
  const realCandidates = JSON.parse(fs.readFileSync(
    path.join(PIPELINE, 'ai-normalizer', 'output', '20260923.json'), 'utf8')).candidates.slice(0, 6);

  /* 真实生产归档快照（验收 #9：不得污染） */
  const realSnap = {
    captures: fileCount(REAL.captures),
    candidates: fileCount(REAL.candidates),
    deliveries: fileCount(REAL.deliveries),
    runHistory: fileCount(REAL.runHistory)
  };

  /* ============ 验收 1 · dry-run ============ */
  console.log('\n■ 验收 1 · dry-run（不写 run-history、不动正式业务目录）');
  const rhBefore1 = rhCount(DIRS.runHistory);
  const capBefore1 = capCount(DIRS.captures);
  const r1 = await run({ mode: 'dry-run', captures: realCaptures });
  eq('1.1 runHistoryRecorded = false', r1.runHistoryRecorded, false);
  eq('1.2 run_id = null', r1.runId, null);
  eq('1.3 run-history 数量不增加', rhCount(DIRS.runHistory), rhBefore1);
  eq('1.4 正式 capture 目录无变化', capCount(DIRS.captures), capBefore1);
  eq('1.5 dry-run 不产生任何文件（含 scratch）', fileCount(DIRS.scratch), 0);

  /* ============ 验收 2 · production-capture（无 --persist） ============ */
  console.log('\n■ 验收 2 · production-capture（无 --persist）');
  const rhBefore2 = rhCount(DIRS.runHistory);
  const r2 = await run({ mode: 'production-capture', captures: realCaptures });
  eq('2.1 runHistoryRecorded = true', r2.runHistoryRecorded, true);
  eq('2.2 run-history +1', rhCount(DIRS.runHistory), rhBefore2 + 1);
  eq('2.3 正式 capture-store 不变化', capCount(DIRS.captures), 0);
  ok('2.4 可写临时 scratch（captures.json 在场）', fs.existsSync(path.join(DIRS.scratch, 'captures.json')));

  /* ============ 验收 3 · production-capture --persist ============ */
  console.log('\n■ 验收 3 · production-capture --persist');
  const rhBefore3 = rhCount(DIRS.runHistory);
  const r3 = await run({ mode: 'production-capture', persist: true, captures: realCaptures });
  eq('3.1 runHistoryRecorded = true', r3.runHistoryRecorded, true);
  eq('3.2 run-history +1', rhCount(DIRS.runHistory), rhBefore3 + 1);
  eq('3.3 正式 capture-store 写入 5 条', capCount(DIRS.captures), 5);
  ok('3.4 落盘结果含 added=5', r3.persisted.captures && r3.persisted.captures.added === 5);

  /* ============ 验收 4 · production-review（无 --persist） ============ */
  console.log('\n■ 验收 4 · production-review（无 --persist）');
  const rhBefore4 = rhCount(DIRS.runHistory);
  const r4 = await run({ mode: 'production-review', candidates: realCandidates });
  eq('4.1 runHistoryRecorded = true', r4.runHistoryRecorded, true);
  eq('4.2 run-history +1', rhCount(DIRS.runHistory), rhBefore4 + 1);
  eq('4.3 正式 candidate-store 不变化', candCount(DIRS.candidates), 0);
  ok('4.4 可写临时 scratch（candidates.json 在场）', fs.existsSync(path.join(DIRS.scratch, 'candidates.json')));
  eq('4.5 审核队列全部 pending', r4.artifacts.reviewQueue.entries.every(function (e) { return e.gate_status === 'pending'; }), true);

  /* ============ 验收 5 · production-review --persist ============ */
  console.log('\n■ 验收 5 · production-review --persist');
  const rhBefore5 = rhCount(DIRS.runHistory);
  const r5 = await run({ mode: 'production-review', persist: true, candidates: realCandidates });
  eq('5.1 runHistoryRecorded = true', r5.runHistoryRecorded, true);
  eq('5.2 run-history +1', rhCount(DIRS.runHistory), rhBefore5 + 1);
  eq('5.3 正式 candidate-store 写入 6 条', candCount(DIRS.candidates), 6);

  /* ============ 验收 6 · production-delivery-preview（无 --persist） ============ */
  console.log('\n■ 验收 6 · production-delivery-preview（无 --persist）');
  const decs6 = realCandidates.slice(0, 4).map(function (c) { return { candidate_id: c.candidate_id, action: 'approve' }; })
    .concat(realCandidates.slice(4, 6).map(function (c) { return { candidate_id: c.candidate_id, action: 'reject', reason: '测试拒绝' }; }));
  const rhBefore6 = rhCount(DIRS.runHistory);
  const r6 = await run({ mode: 'production-delivery-preview', candidates: realCandidates, decisions: decs6 });
  eq('6.1 runHistoryRecorded = true', r6.runHistoryRecorded, true);
  eq('6.2 run-history +1', rhCount(DIRS.runHistory), rhBefore6 + 1);
  eq('6.3 正式 deliveries 不变化（0 个预览文件）', delivCount(DIRS.deliveries), 0);
  eq('6.4 approved=4', r6.metrics.approved_count, 4);
  eq('6.5 rejected=2', r6.metrics.rejected_count, 2);
  eq('6.6 delivery_count=4（仅 approved 进交付）', r6.metrics.delivery_count, 4);
  ok('6.7 可写临时 scratch（delivery-preview.json 在场）', fs.existsSync(path.join(DIRS.scratch, 'delivery-preview.json')));

  /* ============ 验收 7 · production-delivery-preview --persist ============ */
  console.log('\n■ 验收 7 · production-delivery-preview --persist');
  const rhBefore7 = rhCount(DIRS.runHistory);
  const r7 = await run({ mode: 'production-delivery-preview', persist: true, candidates: realCandidates, decisions: decs6 });
  eq('7.1 runHistoryRecorded = true', r7.runHistoryRecorded, true);
  eq('7.2 run-history +1', rhCount(DIRS.runHistory), rhBefore7 + 1);
  eq('7.3 正式 deliveries 写入 1 个预览文件', delivCount(DIRS.deliveries), 1);
  ok('7.4 预览文件每条键集为 33 字段', r7.artifacts.deliveries.every(function (d) { return Object.keys(d).length === 33; }), true);

  /* ============ 验收 8 · dry-run + --persist 必须拒绝 ============ */
  console.log('\n■ 验收 8 · dry-run + --persist 语义冲突（拒绝）');
  const e8 = caught(function () {
    /* runPipeline 为异步：用 done 回调捕获拒绝 */
    let thrown = null;
    run({ mode: 'dry-run', persist: true, captures: realCaptures }).catch(function (e) { thrown = e; });
    if (thrown) throw thrown;
  });
  /* 上述同步捕获无法拿到异步 reject，改用 await 直接断言 */
  let asyncErr = null;
  try { await run({ mode: 'dry-run', persist: true, captures: realCaptures }); }
  catch (e) { asyncErr = e; }
  eq('8.1 抛 PARAM_CONFLICT', asyncErr && asyncErr.code, 'PARAM_CONFLICT');
  eq('8.2 拒绝后 run-history 仍不增加', rhCount(DIRS.runHistory), rhBefore7 + 1);

  /* ============ 验收 9 · 重复运行（append-only + 幂等 + 不污染） ============ */
  console.log('\n■ 验收 9 · 重复运行（run-history append-only / 业务持久化遵循 --persist / 不污染真实归档）');
  const rhBefore9 = rhCount(DIRS.runHistory);
  const r9 = await run({ mode: 'production-capture', persist: true, captures: realCaptures });
  eq('9.1 run-history 再次 +1（append-only，无 dup）', rhCount(DIRS.runHistory), rhBefore9 + 1);
  eq('9.2 capture 幂等：正式 capture 仍为 5（skipped>0）', capCount(DIRS.captures), 5);
  ok('9.3 幂等 skipped=5', r9.persisted.captures && r9.persisted.captures.skipped === 5);

  /* 9b 直接验证 RUN_ID_DUP：同一 run_id 二次 record 必抛错 */
  const dupEntry = {
    run_id: 'run-20260924-999', start_time: '2026-09-24T00:00:00Z', end_time: '2026-09-24T00:00:01Z',
    source_success: 0, source_failed: 0, capture_count: 0, candidate_count: 0, approved_count: 0, rejected_count: 0, delivery_count: 0
  };
  RH.record(dupEntry, { dir: DIRS.runHistory });
  const eDup = caught(function () { RH.record(dupEntry, { dir: DIRS.runHistory }); });
  eq('9.4 同 run_id 二次写入 → RUN_ID_DUP', eDup && eDup.code, 'RUN_ID_DUP');

  /* 9c 真实生产归档未被污染 */
  eq('9.5 真实 captures 目录文件数不变', fileCount(REAL.captures), realSnap.captures);
  eq('9.6 真实 candidates 目录文件数不变', fileCount(REAL.candidates), realSnap.candidates);
  eq('9.7 真实 deliveries 目录文件数不变', fileCount(REAL.deliveries), realSnap.deliveries);
  eq('9.8 真实 run-history 目录文件数不变', fileCount(REAL.runHistory), realSnap.runHistory);

  /* ---------------- 汇总 ---------------- */
  console.log('\n============================================================');
  console.log('D1/D2 验收结果：' + pass + ' PASS / ' + fail + ' FAIL');
  if (fail) { fails.forEach(function (f2) { console.log('  - ' + f2); }); }
  console.log('============================================================');
  process.exit(fail ? 1 : 0);
}

main().catch(function (e) {
  console.error('测试异常：' + (e && e.stack ? e.stack : e));
  process.exit(1);
});
