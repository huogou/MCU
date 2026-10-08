/* ============================================================
 * N1.2 · Implementation-01 全量回归验收
 * ------------------------------------------------------------
 * 覆盖任务十要求的 A–J：
 *   A. N1.1 专项测试（子进程 → 32 PASS）
 *   B. D1/D2 回归（子进程 → 42 PASS）
 *   C. Mock Provider 8 类测试
 *   D. Adapter → ai-normalizer 集成（第 8 类：Provider 不输出 ai_model，bridge 注入后 normalizer 获得）
 *   E. manualCaptureLoader 测试
 *   F. failure record 测试
 *   G. scheduler disabled 安全测试
 *   H. fixture 回归
 *   I. news.js SHA256 检查
 *   J. git diff / git status 冻结边界检查
 * ★ 全部使用隔离临时目录，绝不污染真实 captures/candidates/deliveries/run-history/news.js。
 * ★ 要求：FAIL = 0。
 * ============================================================= */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const cp = require('child_process');

const PIPELINE = path.resolve(__dirname, '..', '..');            /* .../workspace/news/pipeline */
const V = require('../contract-validator.cjs');                   /* N1.1（冻结，仅读） */
const A = require('../adapter.cjs');                              /* N1.1（冻结，仅读） */
const B = require('../bridge.cjs');                               /* N1.2 新增 */
const R = require('../runner.cjs');                               /* N1.2 新增 */
const MCL = require('../../collectors/manual-capture-loader.cjs');/* N1.2 新增 */
const SCH = require('../../runner/scheduler.cjs');                /* N1.2 新增 */
const FR = require('../../failures/failure-record.cjs');          /* N1.2 新增 */
const NM = require('../../ai-normalizer/ai-normalizer.cjs');      /* G5.5（冻结，仅读） */
const CI = require('../../candidate-item.cjs');                   /* G5（冻结，仅读） */
const RC = require('../../raw-capture.cjs');                      /* G5（冻结，仅读） */

const LOG_PATH = path.join(__dirname, 'out-n1.2.txt');
const _lines = [];
const _log = console.log.bind(console);
console.log = function () {
  const s = Array.prototype.map.call(arguments, String).join(' ');
  _lines.push(s); _log(s);
};
process.on('exit', function () { try { fs.writeFileSync(LOG_PATH, _lines.join('\n') + '\n', 'utf8'); } catch (e) {} });

/* 每轮唯一临时目录：位于 pipeline 内（满足 capture-store 的 WRITE_OUTSIDE_PIPELINE 守卫），
 * 唯一命名故无需 rmSync 清理（sandbox 环境下删除会被拦截，故彻底去删除化）。 */
const TMP = path.join(__dirname, 'tmp-n1.2-' + process.pid + '-' + Date.now());
const REAL = {
  news: path.join(PIPELINE, '..', '..', '..', 'h5', 'data', 'news.js'),
  captures: path.join(PIPELINE, 'captures'),
  candidates: path.join(PIPELINE, 'candidates'),
  deliveries: path.join(PIPELINE, 'deliveries'),
  runHistory: path.join(PIPELINE, 'run-history')
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
function caughtAsync(fn) { return Promise.resolve().then(fn).then(function () { return null; }, function (e) { return e; }); }
function sha256(file) { return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'); }
function fileCount(dir) { return fs.existsSync(dir) ? fs.readdirSync(dir).length : 0; }

const VALID = {
  title: 'Test Title',
  summary: 'Test summary text.',
  category: 'industry',
  related_movies: ['mcu-001'],
  related_series: [],
  related_characters: ['char-001'],
  related_phases: [4]
};

/* 受控元数据（D5：ai_model 来自此处，非 Provider 输出） */
const META = { provider: 'mock', model: 'mock-gpt-4o-mini' };

async function main() {
  console.log('============================================================');
  console.log('N1.2 · Implementation-01 全量回归验收');
  console.log('============================================================');

  fs.mkdirSync(TMP, { recursive: true });
  const realSnap = {
    captures: fileCount(REAL.captures), candidates: fileCount(REAL.candidates),
    deliveries: fileCount(REAL.deliveries), runHistory: fileCount(REAL.runHistory)
  };

  /* ============ A. N1.1 专项（子进程） ============ */
  console.log('\n■ A · N1.1 专项测试（子进程）');
  const n11 = path.join(PIPELINE, 'ai-provider', 'tests', 'test-n1.1.cjs');
  let n11out = '', n11code = 0;
  try { n11out = cp.execFileSync(process.execPath, [n11], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); }
  catch (e) { n11code = e.status || 1; n11out = (e.stdout || '') + (e.stderr || ''); }
  ok('A.1 N1.1 测试退出码 0', n11code === 0, 'exit=' + n11code);
  ok('A.2 输出含「32 PASS / 0 FAIL」', /32 PASS \/ 0 FAIL/.test(n11out));

  /* ============ B. D1/D2 回归（子进程） ============ */
  console.log('\n■ B · D1/D2 行为矩阵回归（子进程）');
  const d1d2 = path.join(PIPELINE, 'runner', 'tests', 'test-d1d2.cjs');
  let d1out = '', d1code = 0;
  try { d1out = cp.execFileSync(process.execPath, [d1d2], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); }
  catch (e) { d1code = e.status || 1; d1out = (e.stdout || '') + (e.stderr || ''); }
  ok('B.1 D1/D2 测试退出码 0', d1code === 0, 'exit=' + d1code);
  ok('B.2 输出含「42 PASS / 0 FAIL」', /42 PASS \/ 0 FAIL/.test(d1out));

  /* ============ C. Mock Provider 8 类测试 ============ */
  console.log('\n■ C · Mock Provider 8 类测试');

  // 1. 正常 7 字段
  const pGood = A.createProvider('good', { provide: function () { return Object.assign({}, VALID); } });
  let e1 = null, o1 = null;
  try { o1 = await A.runAdapter(pGood, {}); } catch (e) { e1 = e; }
  ok('C1 正常 7 字段 → runAdapter 通过', e1 === null && o1 && o1.title === 'Test Title');
  eq('C1b 输出恰为 7 字段（无 ai_model）', Object.keys(o1).sort().join(','), V.FIELDS.slice().sort().join(','));

  // 2. 缺失字段
  const pMiss = A.createProvider('miss', { provide: function () { const x = Object.assign({}, VALID); delete x.title; return x; } });
  const e2 = await caughtAsync(function () { return A.runAdapter(pMiss, {}); });
  eq('C2 缺失字段 → MISSING_FIELD', e2 && e2.code, 'MISSING_FIELD');

  // 3. 空字符串
  const pEmpty = A.createProvider('empty', { provide: function () { return Object.assign({}, VALID, { title: '   ' }); } });
  const e3 = await caughtAsync(function () { return A.runAdapter(pEmpty, {}); });
  eq('C3 空字符串 → MISSING_FIELD', e3 && e3.code, 'MISSING_FIELD');

  // 4. 类型错误
  const pType = A.createProvider('type', { provide: function () { return Object.assign({}, VALID, { related_movies: 'x' }); } });
  const e4 = await caughtAsync(function () { return A.runAdapter(pType, {}); });
  eq('C4 类型错误 → TYPE_ERROR', e4 && e4.code, 'TYPE_ERROR');

  // 5. 未知字段 / Provider 试图注入 ai_model
  const pLeak = A.createProvider('leak', { provide: function () { return Object.assign({}, VALID, { foo: 'bar' }); } });
  const e5 = await caughtAsync(function () { return A.runAdapter(pLeak, {}); });
  eq('C5 未知字段 → FORBIDDEN_FIELD', e5 && e5.code, 'FORBIDDEN_FIELD');
  const pAiLeak = A.createProvider('aileak', { provide: function () { return Object.assign({}, VALID, { ai_model: 'evil' }); } });
  const e5b = await caughtAsync(function () { return A.runAdapter(pAiLeak, {}); });
  eq('C5b Provider 自带 ai_model → FORBIDDEN_FIELD（D5：禁止 Provider 注入 ai_model）', e5b && e5b.code, 'FORBIDDEN_FIELD');

  // 6. Provider 主动抛错
  const pBoom = A.createProvider('boom', { provide: function () { throw new Error('llm down'); } });
  const e6 = await caughtAsync(function () { return A.runAdapter(pBoom, {}); });
  eq('C6 Provider 抛错 → PROVIDER_ERROR', e6 && e6.code, 'PROVIDER_ERROR');
  ok('C6b 保留 cause', e6 && e6.cause && /llm down/.test(e6.cause.message));

  // 7. validator 抛错（Provider 返回非对象）
  const pBad = A.createProvider('bad', { provide: function () { return 'not-an-object'; } });
  const e7 = await caughtAsync(function () { return A.runAdapter(pBad, {}); });
  eq('C7 validator 抛错 → RESULT_INVALID', e7 && e7.code, 'RESULT_INVALID');

  // 桥接层专项（D5）
  const eB1 = caught(function () { B.injectAiModel(Object.assign({}, VALID, { ai_model: 'x' }), META); });
  eq('C8 seven 含 ai_model → BRIDGE_UNEXPECTED_FIELD', eB1 && eB1.code, 'BRIDGE_UNEXPECTED_FIELD');
  const eB2 = caught(function () { B.injectAiModel(Object.assign({}, VALID), { provider: 'mock' }); });
  eq('C9 meta 缺 model → BRIDGE_MISSING_MODEL', eB2 && eB2.code, 'BRIDGE_MISSING_MODEL');
  const b3 = B.injectAiModel(Object.assign({}, VALID), META);
  ok('C10 bridge 注入 ai_model = meta.model', b3.ai_model === META.model);
  eq('C10b bridge 输出恰为 8 字段', Object.keys(b3).length, 8);

  /* ============ D. Adapter → ai-normalizer 集成（第 8 类） ============ */
  console.log('\n■ D · Adapter → ai-normalizer 集成（第 8 类：Provider 不输出 ai_model，bridge 注入后 normalizer 获得）');
  const fixturePath = path.join(PIPELINE, 'ai-normalizer', 'output', '20260923.json');
  const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
  const cand0 = fixture.candidates[0];
  // ground-truth 七字段 + ai_model（来自 fixture 增强版）
  const gt = {
    title: cand0.title, summary: cand0.summary, category: cand0.category,
    related_movies: cand0.related_movies, related_series: cand0.related_series,
    related_characters: cand0.related_characters, related_phases: cand0.related_phases,
    ai_model: cand0.ai_model
  };
  // mock provider 只返回 7 字段（刻意剥离 ai_model，模拟「Provider 标准输出」）
  const p7 = A.createProvider('mock7', { provide: function () {
    return { title: gt.title, summary: gt.summary, category: gt.category,
      related_movies: gt.related_movies, related_series: gt.related_series,
      related_characters: gt.related_characters, related_phases: gt.related_phases };
  } });
  const reg = A.createRegistry().register('mock7', p7);
  let dErr = null, dRes = null;
  try { dRes = await R.runAiProviderStage(cand0, reg, 'mock7', { meta: META, idSpace: null, seq: 1 }); }
  catch (e) { dErr = e; }
  ok('D.1 接线无异常', dErr === null, dErr && dErr.message);
  ok('D.2 seven 恰为 7 字段且无 ai_model', dRes && Object.keys(dRes.seven).length === 7 && !('ai_model' in dRes.seven));
  eq('D.3 enriched.ai_model = 受控 meta.model（bridge 注入，非 Provider 输出）', dRes && dRes.enriched.ai_model, META.model);
  ok('D.4 ai-normalizer 成功接收（enhanced 为合法 L1）',
    dRes && CI.validate(dRes.enhanced).pass === true);
  ok('D.5 enhanced.ai_model = 受控注入值', dRes && dRes.enhanced.ai_model === META.model);
  ok('D.6 enhanced 七字段与 fixture 一致（title）', dRes && dRes.enhanced.title === gt.title);
  ok('D.7 enhanced 七字段与 fixture 一致（category）', dRes && dRes.enhanced.category === gt.category);

  /* ============ E. manualCaptureLoader 测试 ============ */
  console.log('\n■ E · manualCaptureLoader（S001 D+A）');
  const inbox = path.join(TMP, 'inbox');
  fs.mkdirSync(inbox, { recursive: true });
  // 情形 A：合法 L0 RawCapture（用 RC.create 现造，S001 + Marvel 官方）
  const srcS001 = require('../../../engine/news-registry.cjs').byId('S001');
  const validL0 = RC.create({
    capture_id: 'cap-S001-manual-001', pipeline_run_id: 'manual-20260924', registry_id: 'S001',
    source_name: srcS001.source_name, source_url: 'https://www.marvel.com/news/sample-article',
    title_raw: 'Manual Sample Title', published_at_raw: '2026-09-23T10:00:00Z',
    fetched_at: '2026-09-24T00:00:00Z', feed_type: 'html-parse', http_status: 200,
    raw_excerpt: 'Manual sample excerpt under 200 chars.'
  });
  fs.writeFileSync(path.join(inbox, 'valid-l0.json'), JSON.stringify(validL0, null, 2), 'utf8');
  // 情形 B：人工最小提交结构（缺字段由 loader 组装）
  fs.writeFileSync(path.join(inbox, 'minimal.json'), JSON.stringify({
    title_raw: 'Minimal Manual Title', source_url: 'https://www.marvel.com/news/minimal',
    published_at_raw: '2026-09-23', raw_excerpt: 'minimal excerpt'
  }), 'utf8');
  // 错误输入：缺 title_raw（应明确失败，不静默）
  fs.writeFileSync(path.join(inbox, 'broken.json'), JSON.stringify({ source_url: 'https://x.com/y' }), 'utf8');
  // 不支持类型
  fs.writeFileSync(path.join(inbox, 'notes.txt'), 'not json', 'utf8');

  const mres = MCL.loadInbox(inbox, { registryId: 'S001' });
  ok('E.1 合法 L0 被接收', mres.captures.length >= 1);
  ok('E.2 最小结构被转换为合法 L0', mres.captures.some(function (c) { return RC.validate(c).pass; }) && mres.captures.length >= 2);
  ok('E.3 全部 captures 通过 L0 校验', mres.captures.every(function (c) { return RC.validate(c).pass; }));
  ok('E.4 错误输入进 errors（不静默）', mres.errors.some(function (e) { return /broken\.json/.test(e.file || ''); }));
  ok('E.5 不支持类型进 errors', mres.errors.some(function (e) { return /notes\.txt/.test(e.file || ''); }));
  // 证明「成功进入 Adapter 流程」：取一个转换后的 L1 → runAiProviderStage
  let adapterFlowOk = false, adapterFlowErr = null;
  try {
    const cap = mres.captures[0];
    const l1 = CI.fromRawCapture(cap, {
      title: cap.title_raw, summary: cap.raw_excerpt || cap.title_raw,
      category: 'industry', ai_model: 'mock-gpt-4o-mini',
      ai_suggested_status: '', gate_status: 'pending'
    }, { idSpace: null, seq: 1 });
    const pM = A.createProvider('manual', { provide: function () { return Object.assign({}, VALID); } });
    const regM = A.createRegistry().register('manual', pM);
    const rM = await R.runAiProviderStage(l1, regM, 'manual', { meta: META, idSpace: null, seq: 1 });
    adapterFlowOk = CI.validate(rM.enhanced).pass === true;
  } catch (e) { adapterFlowErr = e; }
  ok('E.6 人工 capture 成功进入 Adapter 流程（→ enhanced L1 合法）', adapterFlowOk, adapterFlowErr && adapterFlowErr.message);

  /* ============ F. failure record 测试 ============ */
  console.log('\n■ F · failure record（S004 B）');
  const fdir = path.join(TMP, 'failures');
  const f1 = FR.recordFailure({ run_id: 'run-20260924', source_id: 'S003', stage: 'fetch', error_code: 'HTTP_403', error_type: 'fetch', reason: '403 Forbidden', mode: 'capture-only' }, { dir: fdir });
  const f2 = FR.recordFailure({ run_id: 'run-20260924', source_id: 'S005', stage: 'fetch', error_code: 'ECONNREFUSED', error_type: 'fetch', reason: 'connect ECONNREFUSED', mode: 'capture-only' }, { dir: fdir });
  ok('F.1 写入文件存在', fs.existsSync(f1.file));
  const farr = JSON.parse(fs.readFileSync(f1.file, 'utf8'));
  eq('F.2 记录数 = 2（S003 + S005）', farr.length, 2);
  const required = ['run_id', 'source_id', 'stage', 'error_code', 'error_type', 'reason', 'timestamp', 'mode'];
  ok('F.3 每条含 8 个结构化字段', farr.every(function (r) { return required.every(function (k) { return k in r; }); }));
  ok('F.4 S003=HTTP_403 形成记录', farr.some(function (r) { return r.source_id === 'S003' && r.error_code === 'HTTP_403'; }));
  ok('F.5 S005=ECONNREFUSED 形成记录', farr.some(function (r) { return r.source_id === 'S005' && r.error_code === 'ECONNREFUSED'; }));
  // 从采集结果批量记录（模拟 collect 失败）
  const fakeResult = { registry_id: 'S003', errors: [{ stage: 'fetch', code: 'HTTP_403', message: '403' }] };
  const fb = FR.recordFromCollectErrors('run-20260924', fakeResult, 'capture-only', { dir: fdir });
  ok('F.6 recordFromCollectErrors 产出 1 条', fb.length === 1);

  /* ============ G. scheduler disabled 安全测试 ============ */
  console.log('\n■ G · scheduler 脚手架安全（S002）');
  const sDefault = SCH.createScheduler();
  eq('G.1 默认 enabled = false', sDefault.isEnabled(), false);
  eq('G.2 默认 mode = capture-only', sDefault.getMode(), 'capture-only');
  eq('G.3 DEFAULT_DISABLED 常量 = true', SCH.DEFAULT_DISABLED, true);
  const gRun = sDefault.run();
  ok('G.4 disabled → run() skipped 且不执行', gRun.skipped === true && gRun.executed === false);
  const gMan = sDefault.triggerManual();
  ok('G.5 手动触发仅返回计划、不执行', gMan.triggered === true && gMan.executed === false);
  // 即便配置 enabled=true，脚手架也不自动 production
  const sForce = SCH.createScheduler({ enabled: true, mode: 'production' });
  const gForce = sForce.run();
  ok('G.6 即便 enabled，run() 仍 skipped（绝不自动 production）', gForce.skipped === true && gForce.executed === false);
  eq('G.7 强制配置下 autoProduction 仍为 false', sForce.getConfig().autoProduction, false);

  /* ============ H. fixture 回归 ============ */
  console.log('\n■ H · fixture 回归');
  eq('H.1 fixture 候选数 = 133', fixture.count, 133);
  ok('H.2 fixture[0] 为合法 L1', CI.validate(cand0).pass === true);

  /* ============ I. news.js SHA256 ============ */
  console.log('\n■ I · news.js SHA256 冻结自检');
  eq('I.1 news.js SHA256 = 基线', sha256(REAL.news), NEWS_BASELINE_SHA);

  /* ============ J. git 冻结边界 ============ */
  console.log('\n■ J · git 冻结边界检查');
  let gstat = '', gcode = 0;
  try { gstat = cp.execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8', cwd: path.resolve(PIPELINE, '..', '..', '..'), stdio: ['ignore', 'pipe', 'pipe'] }); }
  catch (e) { gcode = e.status || 1; gstat = (e.stdout || '') + (e.stderr || ''); }
  const lines = gstat.split('\n').filter(Boolean);
  const tracked = lines.filter(function (l) { return !/^\?\?/.test(l); }); /* 仅检查已跟踪文件的修改，排除遗留未跟踪 scratch */
  /* N1.2 P1-A 边界修订：orchestrator.cjs / run-modes.cjs / run-n1.cjs 属「编排接线层」，
   * 本阶段（及后续 P1-B/C）按任务要求可演进；冻结边界收敛为真正的不可变件：
   *   contract-validator / adapter / ai-normalizer / candidate-item / raw-capture /
   *   base-collector / parser / normalizer / h5/news.js
   * 故从 FORBIDDEN 中移除上述编排层路径，仅守护真正冻结件。 */
  const FORBIDDEN = [
    /h5\//, /news\.js/,
    /pipeline\/ai-normalizer\//, /pipeline\/candidate-item/, /pipeline\/raw-capture/,
    /collectors\/base-collector/, /collectors\/parser/, /collectors\/normalizer/,
    /pipeline\/contract-validator/, /pipeline\/adapter\.cjs/
  ];
  const forbiddenHit = tracked.filter(function (l) { return FORBIDDEN.some(function (re) { return re.test(l); }); });
  ok('J.1 无冻结文件被修改（H5/G/D/N1.1 validator/adapter）', forbiddenHit.length === 0, forbiddenHit.join(' | '));
  /* J.2：D6 改动的正确校验 = 读登记表内容（不依赖 git 未提交状态；
     原实现依赖 git status 显示 source-registry.json，提交后必然失败——属状态耦合缺陷，已改为内容校验） */
  let s001policy = null;
  try {
    const reg = JSON.parse(fs.readFileSync(path.join(PIPELINE, '..', 'engine', 'registry', 'source-registry.json'), 'utf8'));
    const s001 = (reg.entries || []).filter(function (e) { return e.registry_id === 'S001'; })[0] || {};
    s001policy = s001.crawl_policy;
  } catch (e) { s001policy = 'READ_ERROR:' + e.message; }
  ok('J.2 source-registry.json S001 crawl_policy = manual_only（D6，内容校验）', s001policy === 'manual_only', 'crawl_policy=' + s001policy);
  // 真实归档未被污染
  eq('J.3 真实 captures 目录文件数不变', fileCount(REAL.captures), realSnap.captures);
  eq('J.4 真实 candidates 目录文件数不变', fileCount(REAL.candidates), realSnap.candidates);
  eq('J.5 真实 deliveries 目录文件数不变', fileCount(REAL.deliveries), realSnap.deliveries);
  eq('J.6 真实 run-history 目录文件数不变', fileCount(REAL.runHistory), realSnap.runHistory);

  /* ---------------- 汇总 ---------------- */
  console.log('\n============================================================');
  console.log('N1.2 Implementation-01 验收结果：' + pass + ' PASS / ' + fail + ' FAIL');
  if (fail) { fails.forEach(function (f2) { console.log('  - ' + f2); }); }
  console.log('============================================================');
  process.exit(fail ? 1 : 0);
}

main().catch(function (e) {
  console.error('测试异常：' + (e && e.stack ? e.stack : e));
  process.exit(1);
});
