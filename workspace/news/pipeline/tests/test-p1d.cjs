/* ============================================================
 * N1.2 P1-D · 同日幂等 + 生产路径安全自检
 * ------------------------------------------------------------
 * 说明：真实 live production 在本环境被阻断（DASHSCOPE_API_KEY 未设置、
 *       无真实 provider 出口），按 P1-D 规则 STOP，不触发真实抓取。
 * 本测试在「隔离临时目录 + mock provider + 注入 fixtures」下，验证：
 *   A. 初始无锁 / 无当日标记
 *   B. production 成功 → 写 run-history / 分配 run_id / 标记当日
 *   C. 同日重复触发 → skipped（already produced）
 *   E. production 中途失败 → 当天不被锁死、锁已释放
 *   F. 失败后同日可再次执行（证明失败不污染当天）
 *   H. production 带 status 落盘 → item-status 仍符合 P1-B 冻结 schema
 *      （items 5 字段 + dedup_hints + analysis 同文档，无第二存储）
 *   G. news.js SHA256 前后一致（零写入）
 * ★ 全部使用隔离临时目录，绝不污染真实生产归档 / news.js。
 * ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PIPELINE = path.resolve(__dirname, '..');
const { createScheduler } = require('../runner/scheduler.cjs');
const A = require('../ai-provider/adapter.cjs');
const NEWS_JS = path.join(PIPELINE, '..', '..', '..', 'h5', 'data', 'news.js');

const LOG_PATH = path.join(__dirname, 'out-p1d.txt');
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
function sha256(f) { return crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex'); }

const realCaptures = JSON.parse(fs.readFileSync(path.join(PIPELINE, 'captures', '20260923.captures.json'), 'utf8')).captures.slice(0, 4);
const realCandidates = JSON.parse(fs.readFileSync(path.join(PIPELINE, 'ai-normalizer', 'output', '20260923.json'), 'utf8')).candidates.slice(0, 6);
const GOOD = {
  title: '《复仇者联盟5》正式立项开拍', summary: '漫威正式宣布第五部复仇者联盟电影立项。',
  category: 'movie', related_movies: ['avengers-5'], related_series: [],
  related_characters: ['iron-man'], related_phases: [5]
};
function makeStub() { return A.createProvider('stub', { provide: async function () { return Object.assign({}, GOOD); } }); }
function decisionsFor(cands) {
  return cands.slice(0, 3).map(function (c) { return { candidate_id: c.candidate_id, action: 'approve' }; })
    .concat(cands.slice(3).map(function (c) { return { candidate_id: c.candidate_id, action: 'reject', reason: 'demo-reject' }; }));
}

async function main() {
  console.log('============================================================');
  console.log('N1.2 P1-D · 同日幂等 + 生产路径安全自检（隔离环境）');
  console.log('============================================================');

  const shaBefore = sha256(NEWS_JS);
  const TMP = path.join(__dirname, 'tmp-p1d-' + process.pid + '-' + Date.now());
  const V = path.join(TMP, 'valid'); fs.mkdirSync(V, { recursive: true });
  const VDIRS = {
    captures: path.join(V, 'captures'), candidates: path.join(V, 'candidates'),
    deliveries: path.join(V, 'deliveries'), runHistory: path.join(V, 'runHistory'),
    scratch: path.join(V, 'scratch')
  };
  Object.keys(VDIRS).forEach(function (k) { fs.mkdirSync(VDIRS[k], { recursive: true }); });
  const BAD = path.join(TMP, 'badfile'); fs.writeFileSync(BAD, ''); /* runHistory 指向文件 → 强制 RH.record 抛错 */
  const BADIR = Object.assign({}, VDIRS, { runHistory: BAD });

  const sched = createScheduler({ enabled: true, productionAllowed: true });
  sched._clearState();

  /* A. 初始状态 */
  console.log('\n■ A · 初始状态');
  eq('A.1 初始无并发锁', sched._lockState(), null);
  eq('A.2 初始无当日标记', sched._lastRun(), null);

  /* B. production 成功 */
  console.log('\n■ B · production 成功');
  const b = await sched.triggerProduction({
    date: '20260925', captures: realCaptures, candidates: realCandidates,
    decisions: decisionsFor(realCandidates),
    aiProvider: makeStub(), aiMeta: { model: 'stub-model' }, persist: true, dirs: VDIRS
  });
  eq('B.1 成功 executed', b.executed, true);
  eq('B.2 ok', b.ok, true);
  eq('B.3 三阶段均执行', (b.stages || []).length, 3);
  ok('B.4 三阶段 run_id 唯一', new Set(b.runIds).size === 3, JSON.stringify(b.runIds));
  ok('B.5 写入当日标记', !!sched._lastRun() && sched._lastRun().date === '20260925' && !!sched._lastRun().runId, JSON.stringify(sched._lastRun()));
  ok('B.6 run-history 文件生成', fs.existsSync(path.join(VDIRS.runHistory, 'run-history.json')));
  const rh = JSON.parse(fs.readFileSync(path.join(VDIRS.runHistory, 'run-history.json'), 'utf8'));
  eq('B.7 run-history 记录数 = 3', rh.runs.length, 3);
  eq('B.8 锁已释放', sched._lockState(), null);

  /* C. 同日重复触发 */
  console.log('\n■ C · 同日重复触发防护');
  const c = await sched.triggerProduction({
    date: '20260925', captures: realCaptures, candidates: realCandidates,
    decisions: decisionsFor(realCandidates),
    aiProvider: makeStub(), aiMeta: { model: 'stub-model' }, persist: true, dirs: VDIRS
  });
  eq('C.1 同日重复 → skipped', c.skipped, true);
  ok('C.2 原因含 already produced', /already produced/.test(c.reason || ''), c.reason);

  /* E. 中途失败（runHistory 指向文件强制抛错） */
  console.log('\n■ E · production 中途失败');
  const e = await sched.triggerProduction({
    date: '20260926', captures: realCaptures, candidates: realCandidates,
    decisions: decisionsFor(realCandidates),
    aiProvider: makeStub(), aiMeta: { model: 'stub-model' }, persist: true, dirs: BADIR
  });
  eq('E.1 失败 ok=false', e.ok, false);
  ok('E.2 有 error 记录（失败可追踪）', e.error && !!e.error.code && !!e.error.message, JSON.stringify(e.error));
  ok('E.3 失败未把当天标记为已生产（未锁死 20260926）', sched._lastRun() ? sched._lastRun().date !== '20260926' : true, JSON.stringify(sched._lastRun()));
  eq('E.4 失败锁已释放', sched._lockState(), null);

  /* F. 失败后同日再次触发 → 允许 */
  console.log('\n■ F · 失败后同日可再次执行');
  const f = await sched.triggerProduction({
    date: '20260926', captures: realCaptures, candidates: realCandidates,
    decisions: decisionsFor(realCandidates),
    aiProvider: makeStub(), aiMeta: { model: 'stub-model' }, persist: true, dirs: VDIRS
  });
  eq('F.1 失败后同日可重新执行', f.executed, true);
  eq('F.2 再次执行 ok', f.ok, true);
  ok('F.3 20260926 现已被标记', !!sched._lastRun() && sched._lastRun().date === '20260926', JSON.stringify(sched._lastRun()));

  /* H. production 带 status 落盘 → P1-B 冻结 schema 验证 */
  console.log('\n■ H · 生产 status 落盘（P1-B 冻结 schema）');
  const ST = path.join(TMP, 'status');
  const h = await sched.triggerProduction({
    date: '20260927', captures: realCaptures, candidates: realCandidates,
    decisions: decisionsFor(realCandidates),
    aiProvider: makeStub(), aiMeta: { model: 'stub-model' }, persist: true,
    dirs: Object.assign({}, VDIRS, { status: ST })
  });
  eq('H.1 带 status 生产 ok', h.ok, true);
  const stDir = path.join(ST, 'item-status');
  const stFile = fs.readdirSync(stDir).filter(function (x) { return /status\.json$/.test(x); })[0];
  ok('H.2 item-status 文件生成', !!stFile, stFile);
  if (stFile) {
    const doc = JSON.parse(fs.readFileSync(path.join(stDir, stFile), 'utf8'));
    const first = doc.items ? Object.values(doc.items)[0] : null;
    ok('H.3 items 存在且首条含 5 字段不变量', !!first &&
      ['item_id', 'ref_layer', 'current_status', 'history', 'timestamp'].every(function (k) { return k in first; }),
      first ? Object.keys(first).join(',') : 'no item');
    ok('H.4 dedup_hints 位于同一 item-status JSON', 'dedup_hints' in doc);
    ok('H.5 analysis 位于同一 item-status JSON', 'analysis' in doc);
    ok('H.6 dedup_hints/analysis 与 items 同处一个 item-status JSON（无第二存储）',
      ['items', 'dedup_hints', 'analysis'].every(function (k) { return k in doc; }),
      Object.keys(doc).join(','));
  }
  /* delivery-preview 不写 news.js：actual_writes 恒为 0 */
  eq('H.7 delivery-preview actual_writes = 0（不写 news.js）',
    h.stages[h.stages.length - 1].metrics.actual_writes, 0);

  /* G. news.js 零写入 */
  console.log('\n■ G · news.js 零写入');
  const shaAfter = sha256(NEWS_JS);
  eq('G.1 news.js SHA256 前后一致', shaBefore, shaAfter);
  console.log('  基线 SHA256: ' + shaBefore);

  sched._clearState();
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}

  console.log('\n============================================================');
  console.log('P1-D 自检结果：' + pass + ' PASS / ' + fail + ' FAIL');
  if (fail) { fails.forEach(function (f) { console.log('  - ' + f); }); }
  console.log('============================================================');
  process.exit(fail ? 1 : 0);
}

main().catch(function (e) {
  console.error('测试异常：' + (e && e.stack ? e.stack : e));
  process.exit(1);
});
