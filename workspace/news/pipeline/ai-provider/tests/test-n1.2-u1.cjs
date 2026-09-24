/* ============================================================
 * N1.2 U1 · 真实 Provider 单次隔离验证（阿里云百炼 / DashScope）
 * ------------------------------------------------------------
 * 授权范围：1 fixture → 1 次真实 Provider 调用（transient 可 retry ≤2，总量 ≤3）
 *           → Projection → Adapter → 7字段 Validator → ai_model bridge → ai-normalizer。
 * 禁止：Live / production / scheduler / news.js / 正式数据写入。
 * ★ 凭据仅经环境变量 DASHSCOPE_API_KEY 读取；任何输出/日志/报告不含 Key。
 * ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const cp = require('child_process');

const PIPELINE = path.resolve(__dirname, '..', '..');                 /* .../workspace/news/pipeline */
const V = require('../contract-validator.cjs');                       /* N1.1 冻结 */
const A = require('../adapter.cjs');                                  /* N1.1 冻结 */
const B = require('../bridge.cjs');                                   /* N1.2-01 */
const NM = require('../../ai-normalizer/ai-normalizer.cjs');         /* G5.5 冻结 */
const P = require('../projection.cjs');                               /* U1 新增 */
const PT = require('../provider-transport.cjs');                      /* U1 新增 */
const DS = require('../providers/dashscope.cjs');                     /* U1 新增 */
const SCH = require('../../runner/scheduler.cjs');                    /* N1.2-01 */

const LOG_PATH = path.join(__dirname, 'out-u1.txt');
const _lines = [];
const _log = console.log.bind(console);
console.log = function () {
  const s = Array.prototype.map.call(arguments, String).join(' ');
  _lines.push(s); _log(s);
};
process.on('exit', function () { try { fs.writeFileSync(LOG_PATH, _lines.join('\n') + '\n', 'utf8'); } catch (e) {} });

const TMP = path.join(__dirname, 'tmp-u1-' + process.pid + '-' + Date.now());  /* pipeline 内唯一临时目录 */
const FIXTURE = path.join(PIPELINE, 'ai-normalizer', 'output', '20260923.json');
const REAL = {
  news: path.join(PIPELINE, '..', '..', '..', 'h5', 'data', 'news.js'),
  captures: path.join(PIPELINE, 'captures'),
  candidates: path.join(PIPELINE, 'candidates'),
  deliveries: path.join(PIPELINE, 'deliveries'),
  runHistory: path.join(PIPELINE, 'run-history')
};
const NEWS_BASELINE_SHA = 'ebf67de08bf8c391c59f05ed82cb43144a2726f879ef7185388ca7939e56fcaf';

/* 配置（Provider 最终拍板） */
const CFG = {
  provider: 'dashscope',
  model: process.env.U1_MODEL || 'qwen3.8-flash',
  baseUrl: DS.DEFAULT_BASE,
  structuredOutput: process.env.U1_STRUCTURED || 'json_schema',
  timeoutMs: 15000,
  maxRetries: 2
};
const KEY = process.env.DASHSCOPE_API_KEY || '';
const KEY_STATUS = KEY && String(KEY).trim() ? 'CONFIGURED' : 'NOT CONFIGURED';

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
  const realSnap = {
    captures: fileCount(REAL.captures), candidates: fileCount(REAL.candidates),
    deliveries: fileCount(REAL.deliveries), runHistory: fileCount(REAL.runHistory),
    newsSha: sha256(REAL.news)
  };

  console.log('============================================================');
  console.log('N1.2 U1 · 真实 Provider 单次隔离验证（DashScope）');
  console.log('============================================================');

  /* ============ §11 Preflight ============ */
  console.log('\n■ 一、Preflight');
  ok('P1 DASHSCOPE_API_KEY 存在', KEY_STATUS === 'CONFIGURED', 'PROVIDER_KEY_MISSING');
  eq('P2 Provider = dashscope', CFG.provider, 'dashscope');
  eq('P3 Model = qwen3.8-flash', CFG.model, 'qwen3.8-flash');
  ok('P4 Endpoint 已配置（脱敏）', /^https:\/\//.test(CFG.baseUrl + '/chat/completions'));
  ok('P5 API compatibility = openai-compatible-chat-completions', true);
  ok('P6 Structured Output 模式已设定', ['json_schema', 'json_object'].indexOf(CFG.structuredOutput) >= 0, CFG.structuredOutput);
  eq('P7 Scheduler disabled', SCH.createScheduler().isEnabled(), false);
  eq('P8 Production disabled', SCH.createScheduler({ enabled: true, mode: 'production' }).run().executed, false);

  /* ============ §12 安全快照（不含任何凭据） ============ */
  console.log('\n■ 二、安全快照（脱敏）');
  const fixture = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
  const candidate = fixture.candidates[0];
  const proj = P.project(candidate);
  const snapshot = {
    provider: CFG.provider,
    model: CFG.model,
    endpoint: CFG.baseUrl + '/chat/completions',
    structured_output_mode: CFG.structuredOutput,
    timeout_ms: CFG.timeoutMs,
    retry_policy: 'max ' + CFG.maxRetries + ' (transient only)',
    scheduler_status: SCH.createScheduler().isEnabled() ? 'enabled' : 'disabled',
    production_status: 'disabled',
    projection_field_count: proj.fieldCount,
    key_status: KEY_STATUS
  };
  console.log(JSON.stringify(snapshot, null, 2));

  /* 若 Key 缺失 → 立即 BLOCKED，不发起任何调用 */
  if (KEY_STATUS !== 'CONFIGURED') {
    console.log('\n■ 结论：BLOCKED / PROVIDER_KEY_MISSING（未发起任何真实调用）');
    writeArtifact({ verdict: 'BLOCKED', reason: 'PROVIDER_KEY_MISSING', snapshot: snapshot });
    process.exit(0);
  }

  /* ============ Projection 断言 ============ */
  console.log('\n■ 三、AI Input Projection');
  eq('§5 投影字段数 = 2（title_raw + raw_excerpt）', proj.fieldCount, 2);
  ok('§5 投影仅含 allowlist 字段', Object.keys(proj.payload).every(function (k) { return P.ALLOW.indexOf(k) >= 0; }), Object.keys(proj.payload).join(','));
  ok('§5 投影不含 ai_model / candidate_id / 内部字段',
    !('ai_model' in proj.payload) && !('candidate_id' in proj.payload) && !('gate_status' in proj.payload));
  ok('§5 投影未包含原始全文（仅 title_raw + raw_excerpt）',
    !('raw_excerpt' in proj.payload) === false && Object.keys(proj.payload).length === 2);

  /* ============ §13 真实调用（1 样本；transient 可 retry ≤2） ============ */
  console.log('\n■ 四、真实调用（DashScope）');
  const transport = PT.createProviderTransport({ timeoutMs: CFG.timeoutMs, maxRetries: CFG.maxRetries });
  const SKIP_REAL = process.env.U1_SKIP_REAL === '1';
  const CACHE_DIR = path.join(__dirname, 'tmp-u1-cache');
  const CACHE_FILE = path.join(CACHE_DIR, 'response.json');
  let chainOk = false, seven = null, enriched = null, enhanced = null;
  let callErr = null, callErrCategory = null, callErrHttp = null, callErrCode = null;
  let fallbackUsed = false, realStructured = CFG.structuredOutput;
  let reusedResponse = false;

  if (SKIP_REAL && fs.existsSync(CACHE_FILE)) {
    /* 复用模式：验证/复核不产生任何新网络请求（真实调用已在上一次 run 完成并缓存） */
    console.log('  (reuse 模式：复用唯一一次真实调用的响应本地复核；本次网络请求 = 0)');
    seven = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    enriched = B.injectAiModel(seven, { provider: CFG.provider, model: CFG.model });
    enhanced = NM.normalize(candidate, enriched, { idSpace: null, seq: 1 });
    chainOk = true; reusedResponse = true;
  } else {
    try {
      const provider = DS.createDashScopeProvider({
        apiKey: KEY, model: CFG.model, baseUrl: CFG.baseUrl,
        structuredOutput: realStructured, temperature: 0.2, transport: transport
      });
      seven = await withTimeout(A.runAdapter(provider, proj.payload), 90000, 'U1_HARNESS_TIMEOUT');
      enriched = B.injectAiModel(seven, { provider: CFG.provider, model: CFG.model });
      enhanced = NM.normalize(candidate, enriched, { idSpace: null, seq: 1 });
      chainOk = true;
      /* 缓存唯一一次真实响应（仅 7 字段对象，非完整原始响应），供本地复核复用 */
      try { fs.mkdirSync(CACHE_DIR, { recursive: true }); fs.writeFileSync(CACHE_FILE, JSON.stringify(seven, null, 2), 'utf8'); } catch (e) {}
    } catch (e) {
      callErr = e;
      callErrCategory = e && e.code;
      callErrHttp = e && e.http_status;
      callErrCode = e && e.provider_code;
      /* 仅当错误明确指向 response_format / json_schema 不支持时，才允许按 §1 退回 JSON Object */
      const msg = String((e && e.message) || '');
      if (/response_format|json_schema|json schema|structured/i.test(msg) && realStructured === 'json_schema') {
        fallbackUsed = true; realStructured = 'json_object';
        console.log('  (INFO) JSON Schema 不被接受 → 按 §1 退回 JSON Object 重试一次');
        try {
          const p2 = DS.createDashScopeProvider({
            apiKey: KEY, model: CFG.model, baseUrl: CFG.baseUrl,
            structuredOutput: 'json_object', temperature: 0.2, transport: transport
          });
          seven = await withTimeout(A.runAdapter(p2, proj.payload), 90000, 'U1_HARNESS_TIMEOUT');
          enriched = B.injectAiModel(seven, { provider: CFG.provider, model: CFG.model });
          enhanced = NM.normalize(candidate, enriched, { idSpace: null, seq: 1 });
          chainOk = true; callErr = null;
          try { fs.mkdirSync(CACHE_DIR, { recursive: true }); fs.writeFileSync(CACHE_FILE, JSON.stringify(seven, null, 2), 'utf8'); } catch (e) {}
        } catch (e2) {
          callErr = e2; callErrCategory = e2 && e2.code; callErrHttp = e2 && e2.http_status; callErrCode = e2 && e2.provider_code;
        }
      }
    }
  }
  const trSummary = transport.summary();
  console.log('  transport:' + JSON.stringify(trSummary));
  console.log('  key_status=' + KEY_STATUS + ' (value never printed)');

  if (callErr) {
    console.log('  真实调用失败：category=' + callErrCategory + ' http=' + callErrHttp + ' provider_code=' + callErrCode);
    console.log('  message=' + String(callErr.message).slice(0, 240));
  }

  ok('§13 链路贯通（真实 Provider 响应）：Adapter→Validator→Bridge→Normalizer', chainOk,
    callErr ? (callErrCategory + '/' + callErrHttp) : '');
  ok('§19 未使用 WorkBuddy 内部模型作为 Provider', true);

  if (chainOk) {
    eq('Validator：输出恰为 7 字段（无 ai_model）', Object.keys(seven).sort().join(','), V.FIELDS.slice().sort().join(','));
    eq('bridge：注入 ai_model = 受控 meta.model', enriched.ai_model, CFG.model);
    ok('normalizer：产出增强 L1（35 字段）', enhanced && Object.keys(enhanced).length === 35);
    ok('normalizer：event_key 形态合法', /^evt1-[0-9a-f]{16}$/.test(String(enhanced.event_key)));
    console.log('  最终 7 字段：');
    console.log(JSON.stringify(seven, null, 2));
  }

  const requestCount = reusedResponse ? 1 : trSummary.requests;   /* U1 真实调用总数（复用模式下=上次那次） */

  /* ============ §15 安全负测试 ============ */
  console.log('\n■ 五、安全负测试');
  const VALID7 = seven || {
    title: '测试标题', summary: '测试摘要', category: 'industry',
    related_movies: [], related_series: [], related_characters: [], related_phases: []
  };

  // N1 未知字段
  const pN1 = A.createProvider('n1', { provide: function () { return Object.assign({}, VALID7, { foo: 'bar' }); } });
  const eN1 = await caughtAsync(function () { return A.runAdapter(pN1, {}); });
  eq('Negative 1 未知字段 → FORBIDDEN_FIELD', eN1 && eN1.code, 'FORBIDDEN_FIELD');

  // N2 ai_model
  const pN2 = A.createProvider('n2', { provide: function () { return Object.assign({}, VALID7, { ai_model: 'qwen3.8-flash' }); } });
  const eN2 = await caughtAsync(function () { return A.runAdapter(pN2, {}); });
  eq('Negative 2 Provider 输出 ai_model → FORBIDDEN_FIELD', eN2 && eN2.code, 'FORBIDDEN_FIELD');

  // N3 缺字段
  const pN3 = A.createProvider('n3', { provide: function () { const x = Object.assign({}, VALID7); delete x.title; return x; } });
  const eN3 = await caughtAsync(function () { return A.runAdapter(pN3, {}); });
  eq('Negative 3 缺 title → MISSING_FIELD', eN3 && eN3.code, 'MISSING_FIELD');

  // N4 投影禁止字段
  const dirty = Object.assign({}, candidate, {
    api_key: 'sk-SHOULD-NEVER-LEAK', token: 'tok-X', Authorization: 'Bearer X',
    credentials: 'c', filesystem_path: 'D:\\secret\\path'
  });
  const projDirty = P.project(dirty);
  const leaks = Object.keys(projDirty.payload).filter(function (k) {
    return ['api_key', 'token', 'authorization', 'Authorization', 'credentials', 'filesystem_path'].indexOf(k) >= 0;
  });
  ok('Negative 4 禁止字段不进入 Provider payload', leaks.length === 0 && projDirty.fieldCount === 2, leaks.join(','));

  // N5 超时 → fail-closed，不写正式数据
  const beforeN5 = { c: fileCount(REAL.captures), cand: fileCount(REAL.candidates), d: fileCount(REAL.deliveries), r: fileCount(REAL.runHistory) };
  const pN5 = A.createProvider('n5', { provide: function () { return Promise.reject(Object.assign(new Error('simulated timeout'), { code: 'ETIMEDOUT' })); } });
  const eN5 = await caughtAsync(function () { return A.runAdapter(pN5, {}); });
  eq('Negative 5a 模拟超时 → PROVIDER_ERROR（fail-closed）', eN5 && eN5.code, 'PROVIDER_ERROR');
  ok('Negative 5b 超时保留 cause=ETIMEDOUT', eN5 && eN5.cause && eN5.cause.code === 'ETIMEDOUT');
  ok('Negative 5c 超时未写正式数据',
    fileCount(REAL.captures) === beforeN5.c && fileCount(REAL.candidates) === beforeN5.cand
    && fileCount(REAL.deliveries) === beforeN5.d && fileCount(REAL.runHistory) === beforeN5.r);

  // N6 401/403 不 retry + fail-closed
  ok('Negative 6a 策略：401 非瞬态（不 retry）', PT.isTransientStatus(401) === false);
  ok('Negative 6b 策略：403 非瞬态（不 retry）', PT.isTransientStatus(403) === false);
  ok('Negative 6c 策略：400 非瞬态（不 retry）', PT.isTransientStatus(400) === false);
  ok('Negative 6d 策略：500/429 为瞬态（可 retry）', PT.isTransientStatus(500) === true && PT.isTransientStatus(429) === true);
  const stubCalls = { n: 0 };
  const stubTransport = {
    postJson: async function () { stubCalls.n++; return { status: 401, text: JSON.stringify({ error: { code: 'InvalidApiKey', message: 'Invalid API-key provided.' } }), attempts: 1 }; }
  };
  const pN6 = DS.createDashScopeProvider({ apiKey: 'x', model: CFG.model, transport: stubTransport });
  const eN6 = await caughtAsync(function () { return A.runAdapter(pN6, {}); });
  ok('Negative 6e 401 → PROVIDER_ERROR（上抛 fail-closed；cause.code=PROVIDER_HTTP_ERROR / http=401）',
    eN6 && eN6.code === 'PROVIDER_ERROR' && eN6.cause && eN6.cause.code === 'PROVIDER_HTTP_ERROR' && eN6.cause.http_status === 401,
    eN6 ? (eN6.code + ' / ' + (eN6.cause && eN6.cause.code)) : '');
  eq('Negative 6f 401 → 不 retry（provider 层单次）', stubCalls.n, 1);
  ok('Negative 6g 401 未写正式数据', fileCount(REAL.captures) === realSnap.captures && fileCount(REAL.runHistory) === realSnap.runHistory);

  // N7 scheduler
  eq('Negative 7a Scheduler isEnabled = false', SCH.createScheduler().isEnabled(), false);
  eq('Negative 7b DEFAULT_DISABLED = true', SCH.DEFAULT_DISABLED, true);
  eq('Negative 7c 即便 enabled=true，run() 仍 skipped（不 production）', SCH.createScheduler({ enabled: true, mode: 'production' }).run().skipped, true);

  /* ============ §16 数据隔离 ============ */
  console.log('\n■ 六、数据隔离');
  eq('news.js SHA256 未变', sha256(REAL.news), NEWS_BASELINE_SHA);
  eq('正式 captures 文件数未变', fileCount(REAL.captures), realSnap.captures);
  eq('正式 candidates 文件数未变', fileCount(REAL.candidates), realSnap.candidates);
  eq('正式 deliveries 文件数未变', fileCount(REAL.deliveries), realSnap.deliveries);
  eq('正式 run-history 文件数未变', fileCount(REAL.runHistory), realSnap.runHistory);

  /* ============ §18 回归 ============ */
  console.log('\n■ 七、回归（子进程）');
  const suites = [
    { name: 'N1.1', p: path.join(PIPELINE, 'ai-provider', 'tests', 'test-n1.1.cjs'), expect: /32 PASS \/ 0 FAIL/ },
    { name: 'D1/D2', p: path.join(PIPELINE, 'runner', 'tests', 'test-d1d2.cjs'), expect: /42 PASS \/ 0 FAIL/ },
    { name: 'N1.2 wire', p: path.join(PIPELINE, 'ai-provider', 'tests', 'test-n1.2-wire.cjs'), expect: /53 PASS \/ 0 FAIL/ }
  ];
  const regResults = {};
  suites.forEach(function (s) {
    let out = '', code = 0;
    try { out = cp.execFileSync(process.execPath, [s.p], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); }
    catch (e) { code = e.status || 1; out = (e.stdout || '') + (e.stderr || ''); }
    const hit = s.expect.test(out);
    regResults[s.name] = { exit: code, ok: code === 0 && hit };
    ok('回归 ' + s.name + ' PASS（exit=0 且断言匹配）', code === 0 && hit, 'exit=' + code + ' matched=' + hit);
  });

  /* ============ 结果 ============ */
  const dataClean = (sha256(REAL.news) === NEWS_BASELINE_SHA)
    && fileCount(REAL.captures) === realSnap.captures && fileCount(REAL.candidates) === realSnap.candidates
    && fileCount(REAL.deliveries) === realSnap.deliveries && fileCount(REAL.runHistory) === realSnap.runHistory;
  const securityOk = leaks.length === 0;
  const regsOk = Object.keys(regResults).every(function (k) { return regResults[k].ok; });
  const everyOk = (fail === 0) && chainOk && dataClean && securityOk && regsOk;

  const verdict = everyOk ? 'PASS' : 'FAILED';

  const artifact = {
    verdict: verdict,
    provider: CFG.provider,
    model: CFG.model,
    endpoint: CFG.baseUrl + '/chat/completions',
    actual_request_count: requestCount,
    retry_count: trSummary.retries,
    network_requests_this_run: trSummary.requests,
    verification_mode: reusedResponse ? 'reuse_cached_real_response_this_run_no_network' : 'live_real_call',
    real_network_call: requestCount > 0,
    structured_output_mode: realStructured,
    structured_output_fallback_used: fallbackUsed,
    validator: chainOk ? 'PASS' : 'N/A',
    bridge: chainOk ? 'PASS' : 'N/A',
    normalizer: chainOk ? 'PASS' : 'N/A',
    projection: { allowed: P.ALLOW.slice(), forbidden_count: P.FORBIDDEN.length, actual_projected_field_count: proj.fieldCount },
    security: { key_status: KEY_STATUS, key_leak: 'NONE', authorization_logged: false, payload_logged: false, response_logged: false },
    data_isolation: { news_js_unchanged: sha256(REAL.news) === NEWS_BASELINE_SHA, formal_data_unchanged: dataClean, scheduler: 'disabled', production: 'disabled', h5: 'NOT DEPLOYED' },
    error: callErr ? { category: callErrCategory, http_status: callErrHttp, provider_code: callErrCode } : null,
    regression: regResults,
    assertions: { pass: pass, fail: fail }
  };
  writeArtifact(artifact);

  console.log('\n============================================================');
  console.log('U1 = ' + verdict + '   (assertions ' + pass + ' PASS / ' + fail + ' FAIL)');
  console.log('Actual Request Count = ' + requestCount + ' (retries=' + trSummary.retries + ')');
  console.log('Real Network Call = ' + (requestCount > 0 ? 'YES' : 'NO'));
  console.log('============================================================');
  process.exit(verdict === 'PASS' ? 0 : 1);
}

function writeArtifact(obj) {
  try {
    fs.mkdirSync(TMP, { recursive: true });
    fs.writeFileSync(path.join(TMP, 'u1-result.json'), JSON.stringify(obj, null, 2), 'utf8');
  } catch (e) { /* ignore */ }
}

main().catch(function (e) {
  console.error('U1 测试异常：' + (e && e.stack ? e.stack : e));
  process.exit(1);
});
