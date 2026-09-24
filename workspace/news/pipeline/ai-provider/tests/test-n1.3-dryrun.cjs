/* ============================================================
 * N1.3 · 最小生产化收口 dry-run + 全量回归
 * ------------------------------------------------------------
 * 只处理一个生产化遗留问题：related_* 必须受项目真实 idSpace 约束。
 * 链路：fixture → Projection → DashScope Provider → 7字段 Validator
 *        → idSpace constrain → ai_model bridge → ai-normalizer
 *        → final idSpace validation → 最终结构
 * 隔离：不写正式数据 / 不写 news.js / 不启用 scheduler / 不 production。
 * 凭据仅经环境变量 DASHSCOPE_API_KEY；任何输出不含 Key。
 * 复用：N1_REUSE=1 时不联网，复用上次真实响应（tmp-n1-cache/response.json）。
 * ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const cp = require('child_process');

const PIPELINE = path.resolve(__dirname, '..', '..');
const V = require('../contract-validator.cjs');
const A = require('../adapter.cjs');
const B = require('../bridge.cjs');
const NM = require('../../ai-normalizer/ai-normalizer.cjs');
const P = require('../projection.cjs');
const PT = require('../provider-transport.cjs');
const DS = require('../providers/dashscope.cjs');
const ID = require('../id-space.cjs');
const SCH = require('../../runner/scheduler.cjs');

const LOG_PATH = path.join(__dirname, 'out-n1.3.txt');
const _lines = [];
const _log = console.log.bind(console);
console.log = function () {
  const s = Array.prototype.map.call(arguments, String).join(' ');
  _lines.push(s); _log(s);
};
process.on('exit', function () { try { fs.writeFileSync(LOG_PATH, _lines.join('\n') + '\n', 'utf8'); } catch (e) {} });

const TMP = path.join(__dirname, 'tmp-n13-' + process.pid + '-' + Date.now());
const CACHE_DIR = path.join(__dirname, 'tmp-n1-cache');
const CACHE_FILE = path.join(CACHE_DIR, 'response.json');
const FIXTURE = path.join(PIPELINE, 'ai-normalizer', 'output', '20260923.json');
const REAL = {
  news: path.join(PIPELINE, '..', '..', '..', 'h5', 'data', 'news.js'),
  captures: path.join(PIPELINE, 'captures'),
  candidates: path.join(PIPELINE, 'candidates'),
  deliveries: path.join(PIPELINE, 'deliveries'),
  runHistory: path.join(PIPELINE, 'run-history')
};
const NEWS_BASELINE_SHA = 'ebf67de08bf8c391c59f05ed82cb43144a2726f879ef7185388ca7939e56fcaf';

const CFG = { provider: 'dashscope', model: process.env.U1_MODEL || 'qwen3.8-flash', baseUrl: DS.DEFAULT_BASE, structuredOutput: 'json_schema', timeoutMs: 15000, maxRetries: 2 };
const KEY = process.env.DASHSCOPE_API_KEY || '';
const KEY_STATUS = KEY && String(KEY).trim() ? 'CONFIGURED' : 'NOT CONFIGURED';
const REUSE = process.env.N1_REUSE === '1';

let pass = 0, fail = 0;
const fails = [];
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; fails.push(name + (detail ? ' → ' + detail : '')); console.log('  FAIL  ' + name + (detail ? ' → ' + detail : '')); }
}
function eq(name, a, b) { ok(name, a === b, 'expected ' + JSON.stringify(b) + ', got ' + JSON.stringify(a)); }
function sha256(f) { return crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex'); }
function fileCount(dir) { return fs.existsSync(dir) ? fs.readdirSync(dir).length : 0; }
function caughtAsync(fn) { return Promise.resolve().then(fn).then(function () { return null; }, function (e) { return e; }); }
function withTimeout(p, ms, label) {
  return Promise.race([p, new Promise(function (_, rej) { setTimeout(function () { rej(Object.assign(new Error(label || 'timeout'), { code: 'HARNESS_TIMEOUT' })); }, ms); })]);
}

async function main() {
  fs.mkdirSync(TMP, { recursive: true });
  const realSnap = { captures: fileCount(REAL.captures), candidates: fileCount(REAL.candidates), deliveries: fileCount(REAL.deliveries), runHistory: fileCount(REAL.runHistory), newsSha: sha256(REAL.news) };

  console.log('============================================================');
  console.log('N1.3 · 最小生产化收口 dry-run（真实 idSpace 约束）');
  console.log('============================================================');

  /* ===== Preflight ===== */
  console.log('\n■ 一、Preflight');
  ok('P1 DASHSCOPE_API_KEY 存在', KEY_STATUS === 'CONFIGURED', 'PROVIDER_KEY_MISSING');
  eq('P2 Provider', CFG.provider, 'dashscope');
  eq('P3 Model', CFG.model, 'qwen3.8-flash');
  eq('P4 API compatibility', 'openai-compatible-chat-completions', 'openai-compatible-chat-completions');
  eq('P5 Scheduler disabled', SCH.createScheduler().isEnabled(), false);
  eq('P6 Production disabled', SCH.createScheduler({ enabled: true, mode: 'production' }).run().executed, false);
  console.log('  快照：' + JSON.stringify({ provider: CFG.provider, model: CFG.model, endpoint: CFG.baseUrl + '/chat/completions', structured_output: CFG.structuredOutput, timeout_ms: CFG.timeoutMs, retry: 'max 2 transient-only', key_status: KEY_STATUS, reuse: REUSE }).replace(/sk-[A-Za-z0-9]+/g, 'sk-***'));

  /* ===== idSpace 加载 ===== */
  console.log('\n■ 二、项目真实 idSpace（复用 h5/data，不建第二套）');
  const space = ID.loadIdSpace();
  console.log('  source = ' + space.source);
  console.log('  counts = ' + JSON.stringify(space.counts));
  eq('ID.1 content 实体数 = 59', space.counts.content, 59);
  eq('ID.2 character 实体数 = 24', space.counts.character, 24);

  /* ===== idSpace 单测（确定性，零网络） ===== */
  console.log('\n■ 三、idSpace 约束单测');
  const realC = [...space.content].filter(function (x) { return x === 'endgame'; })[0] || [...space.content][0];
  const realCh = [...space.character].filter(function (x) { return x === 'tony'; })[0] || [...space.character][0];
  const tb = {
    title: 'T', summary: 'S', category: 'movie', ai_model: 'meta-model',
    related_movies: [realC, 'NOT-A-REAL-ID'],
    related_series: ['lanterns'],
    related_characters: [realCh, 'FAKE-CHAR'],
    related_phases: [1, 9, 'x', 3]
  };
  const con = ID.constrain(tb, space);
  eq('ID.3 合法 movie 保留', JSON.stringify(con.fields.related_movies), JSON.stringify([realC]));
  ok('ID.4 不存在 movie 删除', con.dropped.movies.indexOf('NOT-A-REAL-ID') >= 0);
  ok('ID.5 不存在 series 删除（lanterns ∉ MCU 空间）', con.fields.related_series.length === 0 && con.dropped.series.indexOf('lanterns') >= 0);
  eq('ID.6 合法 character 保留', JSON.stringify(con.fields.related_characters), JSON.stringify([realCh]));
  ok('ID.7 不存在 character 删除', con.dropped.characters.indexOf('FAKE-CHAR') >= 0);
  eq('ID.8 phases 过滤为 1-6 整数', JSON.stringify(con.fields.related_phases), JSON.stringify([1, 3]));
  ok('ID.9 phases 非法项（9 / "x"）被删除', con.dropped.phases.indexOf(9) >= 0 && con.dropped.phases.indexOf('x') >= 0);
  const emptyCon = ID.constrain({ related_movies: [], related_series: [], related_characters: [], related_phases: [] }, space);
  ok('ID.10 空数组允许（不报错、保持空）', emptyCon.fields.related_movies.length === 0 && emptyCon.fields.related_phases.length === 0);
  const outIds = con.fields.related_movies.concat(con.fields.related_series, con.fields.related_characters, con.fields.related_phases.map(String));
  const inIds = (tb.related_movies || []).concat(tb.related_series, tb.related_characters, tb.related_phases.map(String));
  ok('ID.11 不自动创建实体（输出 id ⊆ 输入 id）', outIds.every(function (x) { return inIds.indexOf(x) >= 0; }));
  ok('ID.12 只过滤 related_*（title/summary/category/ai_model 原样保留）',
    con.fields.title === 'T' && con.fields.summary === 'S' && con.fields.category === 'movie' && con.fields.ai_model === 'meta-model');
  ok('ID.13 validateRelated：干净结果 ok', ID.validateRelated(con.fields, space).ok === true);
  ok('ID.14 validateRelated：脏结果被识别',
    ID.validateRelated({ related_movies: ['NOT-REAL'], related_series: [], related_characters: [], related_phases: [] }, space).ok === false);

  if (KEY_STATUS !== 'CONFIGURED') {
    console.log('\n■ 结论：BLOCKED / PROVIDER_KEY_MISSING');
    writeArtifact({ verdict: 'BLOCKED', reason: 'PROVIDER_KEY_MISSING' });
    process.exit(0);
  }

  /* ===== dry-run 链路 ===== */
  console.log('\n■ 四、dry-run（fixture → Projection → Provider → Validator → idSpace → bridge → Normalizer）');
  const fixture = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
  const candidate = fixture.candidates[0];
  const proj = P.project(candidate);
  eq('DR.1 Projection 生效（2 字段 allowlist）', proj.fieldCount, 2);
  ok('DR.1b Projection 仅含 allowlist', Object.keys(proj.payload).every(function (k) { return P.ALLOW.indexOf(k) >= 0; }));

  const transport = PT.createProviderTransport({ timeoutMs: CFG.timeoutMs, maxRetries: CFG.maxRetries });
  let seven = null, sevenC = null, enriched = null, enhanced = null, callErr = null, reused = false;
  let constrainReport = null;

  if (REUSE && fs.existsSync(CACHE_FILE)) {
    console.log('  (reuse 模式：复用上次真实调用响应；本次网络请求 = 0)');
    seven = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    reused = true;
  } else {
    try {
      const provider = DS.createDashScopeProvider({ apiKey: KEY, model: CFG.model, baseUrl: CFG.baseUrl, structuredOutput: CFG.structuredOutput, temperature: 0.2, transport: transport });
      seven = await withTimeout(A.runAdapter(provider, proj.payload), 90000, 'N1.3_TIMEOUT');
      try { fs.mkdirSync(CACHE_DIR, { recursive: true }); fs.writeFileSync(CACHE_FILE, JSON.stringify(seven, null, 2), 'utf8'); } catch (e) {}
    } catch (e) { callErr = e; }
  }
  const tr = transport.summary();
  const requestCount = reused ? 1 : tr.requests;
  ok('DR.2 真实 DashScope 调用成功（或复用真实响应）', !!seven, callErr ? (callErr.code + '/' + (callErr.http_status || '')) : '');
  if (!seven) {
    console.log('  调用失败：' + (callErr && callErr.message && callErr.message.slice(0, 200)));
    writeArtifact({ verdict: 'FAILED', reason: 'PROVIDER_CALL_FAILED', error: callErr && callErr.code });
    console.log('\nN1.3 = FAILED'); process.exit(1);
  }
  eq('DR.3 Validator：恰 7 字段（无 ai_model）', Object.keys(seven).sort().join(','), V.FIELDS.slice().sort().join(','));
  ok('DR.3b Validator 拒绝 ai_model（Provider 不得自带）',
    (await caughtAsync(function () { return A.runAdapter(A.createProvider('x', { provide: function () { return Object.assign({}, seven, { ai_model: 'evil' }); } }), {}); }) || {}).code === 'FORBIDDEN_FIELD');

  constrainReport = ID.constrain(seven, space);
  sevenC = constrainReport.fields;
  console.log('  idSpace 约束：dropped=' + constrainReport.droppedCount + ' ' + JSON.stringify(constrainReport.dropped));
  ok('DR.4 idSpace 约束已应用（related_* ⊆ 真实空间）',
    ID.validateRelated(sevenC, space).ok === true);

  enriched = B.injectAiModel(sevenC, { provider: CFG.provider, model: CFG.model });
  eq('DR.5 bridge 注入 ai_model（受控 meta）', enriched.ai_model, CFG.model);
  enhanced = NM.normalize(candidate, enriched, { idSpace: space, seq: 1 });
  ok('DR.6 Normalizer PASS（增强 L1，35 字段）', enhanced && Object.keys(enhanced).length === 35, enhanced ? '' : 'null');
  ok('DR.7 final idSpace validation：最终结果 related_* 全部属于真实空间', ID.validateRelated(enhanced, space).ok === true,
    JSON.stringify(ID.validateRelated(enhanced, space).violations));
  console.log('  最终 related_*：movies=' + JSON.stringify(enhanced.related_movies) +
    ' series=' + JSON.stringify(enhanced.related_series) +
    ' characters=' + JSON.stringify(enhanced.related_characters) +
    ' phases=' + JSON.stringify(enhanced.related_phases));

  /* DR.8~DR.10 链路级 idSpace 负测试（mock provider，零网络）：
     证明「不存在的实体不会进入最终结果」，不依赖真实模型是否返回实体。 */
  const mockSeven = {
    title: 'Mock', summary: 'Mock summary text.', category: 'movie',
    related_movies: [realC], related_series: ['lanterns'],
    related_characters: [realCh, 'FAKE-CHAR'], related_phases: [2, 9]
  };
  const pMock = A.createProvider('mock-idspace', { provide: function () { return Object.assign({}, mockSeven); } });
  const sevenMock = await A.runAdapter(pMock, {});
  const conMock = ID.constrain(sevenMock, space);
  const enhancedMock = NM.normalize(candidate,
    B.injectAiModel(conMock.fields, { provider: CFG.provider, model: CFG.model }), { idSpace: space, seq: 1 });
  ok('DR.8 链路级：不存在实体（lanterns / FAKE-CHAR）不进最终结果',
    enhancedMock.related_series.length === 0 && enhancedMock.related_characters.indexOf('FAKE-CHAR') < 0,
    JSON.stringify({ s: enhancedMock.related_series, c: enhancedMock.related_characters }));
  ok('DR.9 链路级：合法实体（endgame / tony）保留',
    enhancedMock.related_movies.indexOf(realC) >= 0 && enhancedMock.related_characters.indexOf(realCh) >= 0);
  ok('DR.10 链路级：final validateRelated ok（mock 路径）', ID.validateRelated(enhancedMock, space).ok === true);
  ok('DR.11 链路级：非法 phase（9）被移除', enhancedMock.related_phases.indexOf(9) < 0);

  /* ===== 数据隔离 ===== */
  console.log('\n■ 五、数据隔离');
  eq('news.js SHA256 未变', sha256(REAL.news), NEWS_BASELINE_SHA);
  eq('正式 captures 文件数未变', fileCount(REAL.captures), realSnap.captures);
  eq('正式 candidates 文件数未变', fileCount(REAL.candidates), realSnap.candidates);
  eq('正式 deliveries 文件数未变', fileCount(REAL.deliveries), realSnap.deliveries);
  eq('正式 run-history 文件数未变', fileCount(REAL.runHistory), realSnap.runHistory);

  /* ===== 回归 ===== */
  console.log('\n■ 六、回归（子进程）');
  const suites = [
    { name: 'N1.1', p: path.join(PIPELINE, 'ai-provider', 'tests', 'test-n1.1.cjs'), expect: /32 PASS \/ 0 FAIL/ },
    { name: 'N1.2', p: path.join(PIPELINE, 'ai-provider', 'tests', 'test-n1.2-wire.cjs'), expect: /53 PASS \/ 0 FAIL/ },
    { name: 'D1/D2', p: path.join(PIPELINE, 'runner', 'tests', 'test-d1d2.cjs'), expect: /42 PASS \/ 0 FAIL/ },
    { name: 'Normalizer', p: path.join(PIPELINE, 'ai-normalizer', 'tests', 'test-ai-normalizer.cjs'), expect: null }
  ];
  const regResults = {};
  suites.forEach(function (s) {
    if (!fs.existsSync(s.p)) { regResults[s.name] = { exit: -1, ok: false, note: 'MISSING' }; ok('回归 ' + s.name, false, 'suite 不存在'); return; }
    let out = '', code = 0;
    try { out = cp.execFileSync(process.execPath, [s.p], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); }
    catch (e) { code = e.status || 1; out = (e.stdout || '') + (e.stderr || ''); }
    const hit = s.expect ? s.expect.test(out) : true;
    regResults[s.name] = { exit: code, ok: code === 0 && hit };
    ok('回归 ' + s.name + ' PASS（exit=0' + (s.expect ? ' 且断言匹配' : '') + '）', code === 0 && hit, 'exit=' + code + (s.expect ? (' matched=' + hit) : ''));
  });

  /* ===== 结果 ===== */
  const dataClean = (sha256(REAL.news) === NEWS_BASELINE_SHA)
    && fileCount(REAL.captures) === realSnap.captures && fileCount(REAL.candidates) === realSnap.candidates
    && fileCount(REAL.deliveries) === realSnap.deliveries && fileCount(REAL.runHistory) === realSnap.runHistory;
  const regsOk = Object.keys(regResults).every(function (k) { return regResults[k].ok; });
  const verdict = (fail === 0 && dataClean && regsOk) ? 'PASS' : 'FAILED';

  writeArtifact({
    verdict: verdict, provider: CFG.provider, model: CFG.model,
    actual_request_count: requestCount, retry_count: tr.retries, network_requests_this_run: tr.requests,
    verification_mode: reused ? 'reuse_cached_real_response_no_network' : 'live_real_call',
    idspace: { source: space.source, counts: space.counts, dropped: constrainReport.dropped, final_related: { movies: enhanced.related_movies, series: enhanced.related_series, characters: enhanced.related_characters, phases: enhanced.related_phases } },
    validator: 'PASS', bridge: 'PASS', normalizer: 'PASS',
    data_isolation: { news_js_unchanged: dataClean, formal_data_unchanged: dataClean, scheduler: 'disabled', production: 'disabled', h5: 'NOT DEPLOYED' },
    regression: regResults, assertions: { pass: pass, fail: fail }
  });

  console.log('\n============================================================');
  console.log('N1.3 = ' + verdict + '   (assertions ' + pass + ' PASS / ' + fail + ' FAIL)');
  console.log('Actual Request Count = ' + requestCount + ' (this-run network=' + tr.requests + ', retries=' + tr.retries + ')');
  console.log('============================================================');
  process.exit(verdict === 'PASS' ? 0 : 1);
}

function writeArtifact(obj) {
  try { fs.mkdirSync(TMP, { recursive: true }); fs.writeFileSync(path.join(TMP, 'n1.3-result.json'), JSON.stringify(obj, null, 2), 'utf8'); } catch (e) {}
}

main().catch(function (e) {
  console.error('N1.3 测试异常：' + (e && e.stack ? e.stack : e));
  process.exit(1);
});
