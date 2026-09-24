/* ============================================================
 * N1.1 · AI Provider Adapter 专项验收
 * ------------------------------------------------------------
 * 覆盖指令 §六 的 10 项 + 额外冻结自检：
 *   1 合法 7 字段 → PASS
 *   2 缺少字段 → FAIL
 *   3 增加未知字段 → FORBIDDEN_FIELD
 *   4 多个未知字段 → 正确识别
 *   5 类型错误 → FAIL
 *   6 Adapter 正常调用 → PASS（并验证与 ai-normalizer 7 字段契约互通）
 *   7 Provider 错误向上层传播（PROVIDER_ERROR，保留 cause）
 *   8 Validator 不会修改原始输入
 *   9 N1.1 不破坏 D1/D2（行为矩阵快速断言）
 *   10 原有 D1/D2 测试全部回归通过（子进程跑 test-d1d2.cjs → 42 PASS）
 *   + news.js SHA256 冻结自检（必须等于 N1 D1/D2 基线）
 * ★ 全部使用隔离临时目录，绝不污染真实 captures/candidates/deliveries/run-history/news.js
 * ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const cp = require('child_process');

const PIPELINE = path.resolve(__dirname, '..', '..');            /* .../workspace/news/pipeline */
const V = require('../contract-validator.cjs');
const A = require('../adapter.cjs');
const M = require('../../runner/run-modes.cjs');

const LOG_PATH = path.join(__dirname, 'out-n1.1.txt');
const _lines = [];
const _log = console.log.bind(console);
console.log = function () {
  const s = Array.prototype.map.call(arguments, String).join(' ');
  _lines.push(s); _log(s);
};
process.on('exit', function () { try { fs.writeFileSync(LOG_PATH, _lines.join('\n') + '\n', 'utf8'); } catch (e) {} });

const TMP = path.join(__dirname, 'tmp-n1.1');
const REAL = {
  captures: path.join(PIPELINE, 'captures'),
  candidates: path.join(PIPELINE, 'candidates'),
  deliveries: path.join(PIPELINE, 'deliveries'),
  runHistory: path.join(PIPELINE, 'run-history'),
  news: path.join(PIPELINE, '..', '..', '..', 'h5', 'data', 'news.js')
};
const NEWS_BASELINE_SHA = 'ebf67de08bf8c391c59f05ed82cb43144a2726f879ef7185388ca7939e56fcaf';

let pass = 0, fail = 0;
const fails = [];
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; fails.push(name + (detail ? ' → ' + detail : '')); console.log('  FAIL  ' + name + (detail ? ' → ' + detail : '')); }
}
function eq(name, a, b) { ok(name, a === b, 'expected ' + JSON.stringify(b) + ', got ' + JSON.stringify(a)); }
function caught(fn) { try { fn(); return null; } catch (e) { return e; } }
function sha256(file) { return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'); }
function fileCount(dir) { return fs.existsSync(dir) ? fs.readdirSync(dir).length : 0; }

const VALID = {
  title: 'Test Title',
  summary: 'Test summary text.',
  category: 'news',
  related_movies: ['mcu-001'],
  related_series: [],
  related_characters: ['char-001'],
  related_phases: [4]
};

async function main() {
  console.log('============================================================');
  console.log('N1.1 · AI Provider Adapter 专项验收');
  console.log('============================================================');

  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  fs.mkdirSync(TMP, { recursive: true });
  const realSnap = {
    captures: fileCount(REAL.captures), candidates: fileCount(REAL.candidates),
    deliveries: fileCount(REAL.deliveries), runHistory: fileCount(REAL.runHistory)
  };

  /* ===== 1. 合法 7 字段 → PASS ===== */
  console.log('\n■ 1 · 合法 7 字段结果');
  let e1 = null;
  let out1 = null;
  try { out1 = V.validate(VALID); } catch (e) { e1 = e; }
  ok('1.1 合法 7 字段 validate 通过', e1 === null && out1 && out1.title === 'Test Title');
  eq('1.2 通过结果恰为 7 字段', Object.keys(out1).length, 7);

  /* ===== 2. 缺少字段 → FAIL ===== */
  console.log('\n■ 2 · 缺失字段');
  const miss = Object.assign({}, VALID); delete miss.title;
  const e2 = caught(function () { V.validate(miss); });
  eq('2.1 抛 MISSING_FIELD', e2 && e2.code, 'MISSING_FIELD');

  /* ===== 3. 增加未知字段 → FORBIDDEN_FIELD ===== */
  console.log('\n■ 3 · 越权字段');
  const leak = Object.assign({}, VALID, { foo: 'bar' });
  const e3 = caught(function () { V.validate(leak); });
  eq('3.1 抛 FORBIDDEN_FIELD', e3 && e3.code, 'FORBIDDEN_FIELD');

  /* ===== 4. 多个未知字段 → 正确识别 ===== */
  console.log('\n■ 4 · 多个越权字段');
  const multi = Object.assign({}, VALID, { foo: 1, bar: 2, baz: 3 });
  const e4 = caught(function () { V.validate(multi); });
  eq('4.1 抛 FORBIDDEN_FIELD', e4 && e4.code, 'FORBIDDEN_FIELD');
  ok('4.2 错误信息列全越权字段', e4 && /foo/.test(e4.message) && /bar/.test(e4.message) && /baz/.test(e4.message));

  /* ===== 5. 类型错误 → FAIL ===== */
  console.log('\n■ 5 · 类型错误');
  const badType = Object.assign({}, VALID, { related_movies: 'should-be-array' });
  const e5 = caught(function () { V.validate(badType); });
  eq('5.1 数组字段传 string → TYPE_ERROR', e5 && e5.code, 'TYPE_ERROR');
  const badStr = Object.assign({}, VALID, { title: 123 });
  const e5b = caught(function () { V.validate(badStr); });
  eq('5.2 字符串字段传 number → TYPE_ERROR', e5b && e5b.code, 'TYPE_ERROR');
  const emptyStr = Object.assign({}, VALID, { summary: '   ' });
  const e5c = caught(function () { V.validate(emptyStr); });
  eq('5.3 空字符串 → MISSING_FIELD（既有契约必填）', e5c && e5c.code, 'MISSING_FIELD');

  /* ===== 6. Adapter 正常调用 → PASS ===== */
  console.log('\n■ 6 · Adapter 正常调用');
  const goodProvider = A.createProvider('mock', { provide: function () { return Object.assign({}, VALID); } });
  let e6 = null, out6 = null;
  try { out6 = await A.runAdapter(goodProvider, { raw: 'x' }); } catch (e) { e6 = e; }
  ok('6.1 runAdapter 返回校验通过结果', e6 === null && out6 && out6.title === 'Test Title');
  ok('6.2 输出恰为 7 字段（与 ai-normalizer 契约互通，无 ai_model 泄漏）',
    out6 && Object.keys(out6).sort().join(',') === V.FIELDS.slice().sort().join(','));
  /* 注册表可替换 provider */
  const reg = A.createRegistry().register('mock', goodProvider);
  let out6b = null, e6b = null;
  try { out6b = await A.runAdapter(reg.get('mock'), {}); } catch (e) { e6b = e; }
  ok('6.3 注册表取 provider 正常调用', e6b === null && out6b && out6b.title === 'Test Title');

  /* ===== 7. Provider 错误向上层传播 ===== */
  console.log('\n■ 7 · Provider 错误传播');
  const badProvider = A.createProvider('boom', { provide: function () { throw new Error('llm down'); } });
  const e7 = await caughtAsync(function () { return A.runAdapter(badProvider, {}); });
  eq('7.1 抛 PROVIDER_ERROR', e7 && e7.code, 'PROVIDER_ERROR');
  ok('7.2 保留原始错误 cause', e7 && e7.cause && /llm down/.test(e7.cause.message));

  /* ===== 8. Validator 不会修改原始输入 ===== */
  console.log('\n■ 8 · Validator 不修改输入');
  const input8 = Object.assign({}, VALID);
  const beforeKeys = Object.keys(input8).sort().join(',');
  const beforeJson = JSON.stringify(input8);
  const out8 = V.validate(input8);
  eq('8.1 输入键集未变', Object.keys(input8).sort().join(','), beforeKeys);
  eq('8.2 输入值未变', JSON.stringify(input8), beforeJson);
  ok('8.3 返回为隔离副本（非同一引用）', out8 !== input8);

  /* ===== 9. N1.1 不破坏 D1/D2（行为矩阵快速断言） ===== */
  console.log('\n■ 9 · N1.1 不破坏 D1/D2 行为矩阵');
  eq('9.1 validateMode 合法', M.validateMode('dry-run'), 'dry-run');
  let e9 = null;
  try { M.validateMode('bogus'); } catch (e) { e9 = e; }
  ok('9.2 未知模式拒绝', e9 && e9.code === 'UNKNOWN_MODE');
  eq('9.3 isDryRun(dry-run)=true', M.isDryRun('dry-run'), true);
  eq('9.4 isProduction(production-capture)=true', M.isProduction('production-capture'), true);
  eq('9.5 requiresRunHistory(production-capture)=true', M.requiresRunHistory('production-capture'), true);
  eq('9.6 requiresRunHistory(dry-run)=false', M.requiresRunHistory('dry-run'), false);
  let e9b = null;
  try { M.checkPersistConflict('dry-run', true); } catch (e) { e9b = e; }
  eq('9.7 dry-run+--persist → PARAM_CONFLICT', e9b && e9b.code, 'PARAM_CONFLICT');
  eq('9.8 默认采集来源封闭集', M.DEFAULT_CAPTURE_SOURCES.join(','), 'S002,S004,S006');

  /* ===== 10. 原有 D1/D2 测试全部回归通过 ===== */
  console.log('\n■ 10 · D1/D2 测试套件回归（子进程）');
  const d1d2 = path.join(PIPELINE, 'runner', 'tests', 'test-d1d2.cjs');
  let d1out = '', d1code = 0, d1err = null;
  try {
    d1out = cp.execFileSync(process.execPath, [d1d2], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    d1code = e.status || 1; d1out = (e.stdout || '') + (e.stderr || ''); d1err = e;
  }
  ok('10.1 D1/D2 测试退出码 0', d1code === 0, 'exit=' + d1code);
  ok('10.2 输出含「42 PASS / 0 FAIL」', /42 PASS \/ 0 FAIL/.test(d1out), d1err ? 'stderr 见日志' : '');

  /* ===== 冻结自检：news.js SHA256 + 真实归档未污染 ===== */
  console.log('\n■ 冻结自检');
  eq('F.1 news.js SHA256 = N1 D1/D2 基线', sha256(REAL.news), NEWS_BASELINE_SHA);
  eq('F.2 真实 captures 目录文件数不变', fileCount(REAL.captures), realSnap.captures);
  eq('F.3 真实 candidates 目录文件数不变', fileCount(REAL.candidates), realSnap.candidates);
  eq('F.4 真实 deliveries 目录文件数不变', fileCount(REAL.deliveries), realSnap.deliveries);
  eq('F.5 真实 run-history 目录文件数不变', fileCount(REAL.runHistory), realSnap.runHistory);

  /* 清理隔离目录 */
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}

  console.log('\n============================================================');
  console.log('N1.1 验收结果：' + pass + ' PASS / ' + fail + ' FAIL');
  if (fail) { fails.forEach(function (f2) { console.log('  - ' + f2); }); }
  console.log('============================================================');
  process.exit(fail ? 1 : 0);
}

function caughtAsync(fn) {
  return Promise.resolve().then(fn).then(function () { return null; }, function (e) { return e; });
}

main().catch(function (e) {
  console.error('测试异常：' + (e && e.stack ? e.stack : e));
  process.exit(1);
});
