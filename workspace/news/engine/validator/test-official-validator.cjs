/* ============================================================
 * G3 · 官方来源校验器 V1.0 测试
 * ------------------------------------------------------------
 * 运行：node workspace/news/engine/validator/test-official-validator.cjs
 *
 * 覆盖：
 *   第一节 输出契约完整性（4 顶层键 / 6 检查项 / 顺序）
 *   第二节 C1–C14 逐例验证（C1–C8 为任务要求，C9–C14 为补充）
 *   第三节 与 G1 checkOfficialUrl 的交叉一致性（防两套实现漂移）
 *   第四节 数据来源纪律自证（源码中不得硬编码域名）
 *   第五节 验收输出（PASS / FAIL / 退出码 / git status / news.js SHA256）
 *
 * ★ 只读、零网络、不修改 h5 / wechat / douyin / 三个基线脚本。
 * ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

const LOG_PATH = path.join(__dirname, 'out-official-validator.txt');
const _lines = [];
const _log = console.log.bind(console);
console.log = function () {
  const s = Array.prototype.map.call(arguments, String).join(' ');
  _lines.push(s); _log(s);
};
process.on('exit', function () {
  try { fs.writeFileSync(LOG_PATH, _lines.join('\n') + '\n', 'utf8'); } catch (e) {}
});

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const H5 = path.join(ROOT, 'h5');
const VALIDATOR_SRC = path.join(__dirname, 'official-source-validator.cjs');

const V = require('./official-source-validator.cjs');
const judge = require('../news-judge.cjs');
const F = require('./fixtures/official-validator-cases.cjs');

/* 冻结期望值：h5/data/news.js 的 SHA256（G1/G2 阶段已记录） */
const NEWS_JS_SHA256_EXPECTED = 'EBF67DE08BF8C391C59F05ED82CB43144A2726F879EF7185388CA7939E56FCAF';

let pass = 0, fail = 0;
const fails = [];
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; fails.push(name + (detail ? ' → ' + detail : '')); console.log('  FAIL  ' + name + (detail ? ' → ' + detail : '')); }
}
function eq(name, actual, expected) {
  ok(name, actual === expected, 'expected ' + JSON.stringify(expected) + ', got ' + JSON.stringify(actual));
}
function section(t) { console.log('\n■ ' + t); }

console.log('============================================================');
console.log('G3 · 官方来源校验器 V1.0 —— 测试');
console.log('============================================================');
console.log('校验器：' + VALIDATOR_SRC);
console.log('规则版本：' + V.RULE_VERSION);
console.log('登记表：' + require('../news-registry.cjs').REGISTRY_PATH);
console.log('用例数：' + F.CASES.length + '（C1–C8 任务要求 + C9–C14 补充）');

/* ============================================================
 * 1. 输出契约完整性
 * ============================================================ */
section('1. 输出契约完整性');

const sample = V.validateOfficialSource(F.CASES[0].input, F.CASES[0].opts);
eq('顶层键恰为 valid / checks / reason / rule_version',
  Object.keys(sample).sort().join(','), 'checks,reason,rule_version,valid');
ok('checks 为对象且含 6 项', sample.checks && typeof sample.checks === 'object' &&
  Object.keys(sample.checks).length === 6);
eq('checks 键位与顺序与任务书一致',
  Object.keys(sample.checks).join(','), V.CHECK_ORDER.join(','));
let badShape = '';
Object.keys(sample.checks).forEach(function (k) {
  const c = sample.checks[k];
  if (typeof c.pass !== 'boolean' || typeof c.detail !== 'string' || !c.detail) {
    badShape = k + ' 结构不合法';
  }
});
eq('每个检查项均为 { pass:boolean, detail:非空字符串 }', badShape, '');
ok('reason 为非空字符串', typeof sample.reason === 'string' && sample.reason.length > 0);
eq('rule_version = V1.0', sample.rule_version, 'V1.0');

/* ============================================================
 * 2. C1–C14 逐例验证
 * ============================================================ */
section('2. 用例验证（C1–C14）');

const results = [];
F.CASES.forEach(function (c) {
  const r = V.validateOfficialSource(c.input, c.opts);
  results.push({ c: c, r: r });

  eq('【' + c.id + '】valid = ' + c.expect.valid + '　（' + c.desc + '）', r.valid, c.expect.valid);

  const failedNow = V.CHECK_ORDER.filter(function (k) { return r.checks[k].pass !== true; });
  eq('【' + c.id + '】失败检查项 = ' + (c.expect.failChecks.join('/') || '无'),
    failedNow.join('/'), c.expect.failChecks.join('/'));

  (c.expect.passChecks || []).forEach(function (k) {
    ok('【' + c.id + '】' + k + ' 应为通过（隔离验证）', r.checks[k].pass === true, r.checks[k].detail);
  });

  /* reason 必须指向「按固定顺序最早失败的那一项」
   * ★ 注意：校验器刻意不短路，URL 不可用时依赖项会一并失败（级联失败），
   *   因此失败清单可能是多项；reason 只报最早一项，其余项由 checks 全量呈现。 */
  if (r.valid) {
    ok('【' + c.id + '】reason 表述为「六项检查全部通过」',
      r.reason.indexOf('六项检查全部通过') >= 0, r.reason);
  } else {
    const firstFailed = V.CHECK_ORDER.filter(function (k) { return r.checks[k].pass !== true; })[0];
    ok('【' + c.id + '】reason 指向最早失败项 ' + firstFailed,
      r.reason.indexOf(firstFailed) >= 0, r.reason);
  }
});

/* valid 与「六项全通过」的一致性 */
let inconsistent = '';
results.forEach(function (x) {
  const all = V.CHECK_ORDER.every(function (k) { return x.r.checks[k].pass === true; });
  if (all !== x.r.valid) inconsistent = x.c.id;
});
eq('valid === 六项检查全部通过（无遗漏、无放宽）', inconsistent, '');

/* ============================================================
 * 3. 与 G1 checkOfficialUrl 的交叉一致性
 * ============================================================ */
section('3. 与 G1 checkOfficialUrl 交叉一致性（防实现漂移）');

const S001 = require('../news-registry.cjs').byId('S001');
let drift = '';
F.CROSS_CHECK.forEach(function (x) {
  /* G1 原生实现 */
  const g1 = judge.checkOfficialUrl(x.url, x.mode).pass;
  /* 本校验器：取前 5 项（不含 review_required，因其属复核层而非 URL 层） */
  const r = V.validateOfficialSource({
    source_url: x.url,
    source_name: 'Marvel 官方',
    registry_entry: S001,
    official_confirm: { reviewed: true }
  }, { pathPolicy: x.mode });
  const first5 = ['url_scheme', 'domain_allowed', 'path_allowed', 'domain_blacklist', 'registry_match']
    .every(function (k) { return r.checks[k].pass === true; });

  if (g1 !== x.expected) drift = 'G1 对 ' + (x.url || '(空)') + '/' + x.mode + ' 期望 ' + x.expected + ' 实得 ' + g1;
  if (first5 !== x.expected) drift = drift || ('校验器对 ' + (x.url || '(空)') + '/' + x.mode + ' 期望 ' + x.expected + ' 实得 ' + first5);
  if (g1 !== first5) drift = drift || ('两者不一致：' + (x.url || '(空)') + '/' + x.mode);
});
eq('8 组 URL × 策略下，校验器前五项结论 = G1 结论 = 期望值', drift, '');

/* ============================================================
 * 4. 数据来源纪律自证：源码中不得硬编码域名
 * ============================================================ */
section('4. 数据来源纪律自证（不硬编码域名）');

const src = fs.readFileSync(VALIDATOR_SRC, 'utf8');
/* 剥离注释后再扫描域名样式的字面量 */
const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
const domainHits = code.match(/\b[a-z0-9][a-z0-9.-]*\.(com|net|org|jp|io|cn)\b/gi) || [];
eq('校验器代码中不含任何域名样式的字面量（域名全部来自登记表）',
  domainHits.join(','), '');
ok('校验器通过 news-registry.cjs 取得域名事实',
  code.indexOf("require('../news-registry.cjs')") > 0);
ok('校验器通过 news-judge-rules.cjs 取得 path 策略（不另建第二套）',
  code.indexOf("require('../news-judge-rules.cjs')") > 0);
ok('校验器未引入任何网络能力（无 http/https/net/dns/fetch/axios）',
  !/\brequire\(\s*['"](http|https|net|dns|node-fetch|axios)['"]\s*\)|\bfetch\s*\(|XMLHttpRequest/.test(code));

/* ============================================================
 * 5. 验收输出
 * ============================================================ */
section('5. 验收输出');

console.log('  ── 用例明细 ──');
console.log('  ' + 'case'.padEnd(6) + 'valid'.padEnd(7) + '失败检查项');
results.forEach(function (x) {
  const failedNow = V.CHECK_ORDER.filter(function (k) { return x.r.checks[k].pass !== true; });
  console.log('  ' + x.c.id.padEnd(6) + String(x.r.valid).padEnd(7) + (failedNow.join(', ') || '（无）'));
});

console.log('');
console.log('  ── h5/data/news.js SHA256 ──');
const buf = fs.readFileSync(path.join(H5, 'data', 'news.js'));
const sha = crypto.createHash('sha256').update(buf).digest('hex').toUpperCase();
console.log('  实测：' + sha);
console.log('  基线：' + NEWS_JS_SHA256_EXPECTED);
ok('h5/data/news.js SHA256 与基线一致（文件未改动）', sha === NEWS_JS_SHA256_EXPECTED, sha);

console.log('');
console.log('  ── git status ──');
try {
  const st = execSync('git -C "' + ROOT + '" status --porcelain', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  const lines = st.split('\n').filter(function (l) { return l.trim(); });
  const h5Lines = lines.filter(function (l) { return /h5[\\/]/.test(l); });
  const wechatLines = lines.filter(function (l) { return /wechat[\\/]/.test(l); });
  const douyinLines = lines.filter(function (l) { return /douyin[\\/]/.test(l); });
  console.log('  条目数：' + lines.length);
  console.log('  其中 h5 / wechat / douyin 相关：' + (h5Lines.length + wechatLines.length + douyinLines.length) + ' 条');
  /* G9 起：h5/data/news.js 的合法生产写入被白名单放行（其余 h5/wechat/douyin 变更仍视为污染） */
  const h5Other = h5Lines.filter(function (l) { return l.indexOf('h5/data/news.js') < 0; });
  ok('git status 中仅允许 h5/data/news.js 变更（G9 白名单），wechat/douyin 零改动',
    h5Other.length + wechatLines.length + douyinLines.length === 0,
    h5Other.concat(wechatLines, douyinLines).join(' | '));
} catch (e) {
  console.log('  （本环境无法执行 git，跳过 —— 由外部 wrapper 另行留档）');
  console.log('  原因：' + e.message);
}

/* ============================================================
 * 汇总
 * ============================================================ */
console.log('');
console.log('============================================================');
console.log('结果：' + pass + ' PASS / ' + fail + ' FAIL');
if (fail) { console.log('失败项：'); fails.forEach(function (f) { console.log('  - ' + f); }); }
console.log('============================================================');
process.exit(fail ? 1 : 0);
