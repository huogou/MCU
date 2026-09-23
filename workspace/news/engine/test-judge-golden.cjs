/* ============================================================
 * G1 · 黄金用例回归：现有 15 条 news.js
 * ------------------------------------------------------------
 * 运行：node workspace/news/engine/test-judge-golden.cjs
 *
 * 测法：在 vm 沙箱中加载**真实的 h5/data/news.js**（只读），
 *       逐条调用真实判定器，与三处基准比对：
 *         ① 数据现状（verification_status / independent_group_count / chain_steps_hit）
 *         ② 任务书 7.1 的独立期望表（避免「用数据校验数据」的循环论证）
 *         ③ 输出契约与 8 态枚举
 * ★ 不复制、不复刻被测逻辑；不修改任何生产文件。
 * ============================================================ */
'use strict';

const vm = require('vm');
const fs = require('fs');
const path = require('path');

/* 输出另存 UTF-8 日志（本机 PowerShell 原生命令重定向编码不可控） */
const LOG_PATH = path.join(__dirname, 'out-golden.txt');
const _lines = [];
const _log = console.log.bind(console);
console.log = function () {
  const s = Array.prototype.map.call(arguments, String).join(' ');
  _lines.push(s); _log(s);
};
process.on('exit', function () {
  try { fs.writeFileSync(LOG_PATH, _lines.join('\n') + '\n', 'utf8'); } catch (e) {}
});

const ROOT = path.resolve(__dirname, '..', '..', '..');
const H5 = path.join(ROOT, 'h5');

const judge = require('./news-judge.cjs');
const R = require('./news-judge-rules.cjs');
const F = require('./fixtures/judge-cases.cjs');

/* ---------------- 断言框架 ---------------- */
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

/* ---------------- 沙箱：加载真实生产数据（只读） ---------------- */
const ctx = {};
ctx.window = ctx; ctx.global = ctx; ctx.console = console;
ctx.URL = URL; ctx.Date = Date; ctx.Math = Math; ctx.JSON = JSON;
vm.createContext(ctx);
['movies.js', 'series.js', 'special.js', 'short.js', 'content.js', 'characters.js', 'news.js']
  .forEach(function (f) {
    vm.runInContext(fs.readFileSync(path.join(H5, 'data', f), 'utf8'), ctx, { filename: f });
  });
const NEWS = ctx.window.MCU_NEWS || [];

console.log('============================================================');
console.log('G1 · 资讯状态判定器 V1.0 —— 黄金用例回归（现有 15 条 news.js）');
console.log('============================================================');
console.log('判定器规则版本：' + R.RULE_VERSION + '｜path 策略：' + R.PATH_POLICY.mode);
console.log('数据：MCU_NEWS ' + NEWS.length + ' 条');

const NOW = '2026-09-22T12:00:00Z';

/* ============================================================
 * 1. 逐条判定并与双重基准比对
 * ============================================================ */
section('1. 15 条黄金用例逐条比对（数据现状 + 任务书期望表）');

const results = [];
let mismatchData = '', mismatchExpect = '', mismatchGroups = '', mismatchStep = '';

NEWS.forEach(function (item) {
  const fx = F.GOLDEN_INPUTS[item.id] || {};
  const res = judge.judge(item, fx.input || {}, Object.assign({ now: NOW }, fx.opts || {}));
  const exp = F.GOLDEN_EXPECT[item.id];

  results.push({ item: item, res: res, exp: exp });

  /* 基准①：与数据现状一致 */
  if (res.verification_status !== item.verification_status) {
    mismatchData = item.id + ' 数据=' + item.verification_status + ' 判定=' + res.verification_status;
  }
  /* 基准②：与独立期望表一致 */
  if (!exp) {
    mismatchExpect = item.id + ' 缺少期望表条目';
  } else {
    if (res.verification_status !== exp.status) {
      mismatchExpect = item.id + ' 期望=' + exp.status + ' 判定=' + res.verification_status;
    }
    if (res.chain_steps_hit !== exp.step) {
      mismatchStep = item.id + ' 期望=' + exp.step + ' 判定=' + res.chain_steps_hit;
    }
  }
  /* 派生值三方差一致：判定器自算 == 数据存储 == 运行时口径 */
  if (res.independent_group_count !== item.independent_group_count) {
    mismatchGroups = item.id + ' 数据=' + item.independent_group_count + ' 判定=' + res.independent_group_count;
  }
  if (exp && res.independent_group_count !== exp.groups) {
    mismatchGroups = mismatchGroups || (item.id + ' 期望=' + exp.groups + ' 判定=' + res.independent_group_count);
  }
});

eq('【A1】15 条判定状态 = 数据现状 verification_status', mismatchData, '');
eq('【A4】15 条判定状态 = 任务书独立期望表', mismatchExpect, '');
eq('【A3】15 条 chain_steps_hit = 数据现状', mismatchStep, '');
eq('【A2】15 条 independent_group_count = 数据现状', mismatchGroups, '');

/* ============================================================
 * 2. 输出契约与枚举
 * ============================================================ */
section('2. 输出契约（7 项必填）与 8 态枚举');

let missingOut = '', badStatus = '', badStep = '';
const REQUIRED = judge.REQUIRED_OUTPUT_FIELDS;
results.forEach(function (r) {
  REQUIRED.forEach(function (k) {
    if (!(k in r.res)) missingOut = r.res.id + '.' + k;
  });
  if (R.STATUS_LIST.indexOf(r.res.verification_status) < 0) badStatus = r.res.id + '=' + r.res.verification_status;
  const steps = Object.keys(R.STEP).map(function (k) { return R.STEP[k]; });
  if (steps.indexOf(r.res.chain_steps_hit) < 0) badStep = r.res.id + '=' + r.res.chain_steps_hit;
});
eq('【A5】每条输出均含 7 项必填契约', missingOut, '');
eq('【A6】全部产出状态均为 8 态之一（无第 9 态）', badStatus, '');
eq('chain_steps_hit 均为合法步骤标识', badStep, '');

/* status_history_entry 结构 */
let badEntry = '';
results.forEach(function (r) {
  const e = r.res.status_history_entry;
  const keys = ['from', 'to', 'at', 'reason', 'evidence_url'];
  if (!e || keys.some(function (k) { return !(k in e); })) badEntry = r.res.id;
  if (e && e.to !== r.res.verification_status) badEntry = r.res.id + ' entry.to 不一致';
});
eq('status_history_entry 结构完整且 to 与状态一致', badEntry, '');

/* ============================================================
 * 3. 幂等与确定性
 * ============================================================ */
section('3. 幂等与确定性（A7）');

let notIdempotent = '';
NEWS.forEach(function (item) {
  const fx = F.GOLDEN_INPUTS[item.id] || {};
  const a = judge.judge(item, fx.input || {}, Object.assign({ now: NOW }, fx.opts || {}));
  const b = judge.judge(item, fx.input || {}, Object.assign({ now: NOW }, fx.opts || {}));
  if (JSON.stringify(a) !== JSON.stringify(b)) notIdempotent = item.id;
});
eq('【A7】同输入两次运行输出完全一致', notIdempotent, '');

/* ============================================================
 * 4. 关键规则专项验证（黄金数据内的规则点）
 * ============================================================ */
section('4. 关键规则专项');

const byId = {};
results.forEach(function (r) { byId[r.item.id] = r; });

eq('【伪多源】003：3 家同属 PMC → 独立组 = 1（非 3）',
  byId['news-2026-09-22-003'].res.independent_group_count, 1);
eq('【伪多源】003：状态为 single_source，命中 Step 6',
  byId['news-2026-09-22-003'].res.verification_status + '/' + byId['news-2026-09-22-003'].res.chain_steps_hit,
  'single_source/Step 6');
eq('【真多源】002：PMC + People Inc. → 独立组 = 2',
  byId['news-2026-09-22-002'].res.independent_group_count, 2);
eq('【待核不计】005：两家 owner_group 待核 → 独立组 = 0',
  byId['news-2026-09-22-005'].res.independent_group_count, 0);
eq('【空源】007：reported_by 空 → 独立组 = 0，落 Step 8',
  byId['news-2026-09-21-007'].res.independent_group_count + '/' + byId['news-2026-09-21-007'].res.chain_steps_hit,
  '0/Step 8');
eq('【报道级更正】011：仅 1 条被更正 → 事件级不落 corrected，落 Step 5',
  byId['news-2026-09-19-011'].res.verification_status + '/' + byId['news-2026-09-19-011'].res.chain_steps_hit,
  'multi_source_reported/Step 5');
eq('【全部更正】010：全部有效报道均被更正 → Step 3 corrected',
  byId['news-2026-09-20-010'].res.chain_steps_hit, 'Step 3');
ok('【更正链】010 ↔ 014 均判定为 corrected（链式引用成对）',
  byId['news-2026-09-20-010'].res.verification_status === 'corrected' &&
  byId['news-2026-09-19-014'].res.verification_status === 'corrected');
eq('【官方确认】001：官方 URL 过 R7.4 Step2/3 + 人工复核 → Step 1',
  byId['news-2026-09-22-001'].res.chain_steps_hit, 'Step 1');
eq('【官方否认】009：否认可回链官方 → Step 2',
  byId['news-2026-09-20-009'].res.chain_steps_hit, 'Step 2');
eq('【置顶不影响状态】012：失效置顶不改变状态判定',
  byId['news-2026-09-18-012'].res.verification_status, 'single_source');
eq('【日期缺失不影响状态】015：publish_time = null 不影响判定',
  byId['news-2026-09-17-015'].res.verification_status, 'single_source');

/* 路径策略开关（E-1 关键项） */
const legacyOk = judge.checkOfficialUrl('https://www.marvel.com/news', 'legacy').pass;
const strictOk = judge.checkOfficialUrl('https://www.marvel.com/news', 'article-level').pass;
eq('【E-1】legacy 策略下 001 的官方 URL 通过（现行规则，须为 true）', legacyOk, true);
eq('【E-1】article-level 策略下同一 URL 不通过（G8 启用后须修正）', strictOk, false);

/* 接口纪律：不接受外部传入独立组数 */
ok('【红线 1】判定器不提供「传入独立组数」的接口参数',
  judge.judge.length <= 3);

/* ============================================================
 * 5. 诊断项（非断言，供报告使用）
 * ============================================================ */
section('5. 诊断（记录差异，不计失败）');

let tierDiff = '';
results.forEach(function (r) {
  if (r.res.independent_group_count !== r.res.reliable_group_count) {
    tierDiff = r.res.id + ' 独立组=' + r.res.independent_group_count + ' 可靠组=' + r.res.reliable_group_count;
  }
});
ok('现有 15 条：独立组数与可靠组数一致（tier 过滤未造成差异）', tierDiff === '', tierDiff);

const judgedDiff = results.filter(function (r) {
  return r.res.judged_by !== r.item.judged_by;
}).map(function (r) { return r.res.id + ' 数据=' + r.item.judged_by + ' 产出=' + r.res.judged_by; });
console.log('  INFO  judged_by 与数据现状的差异（属「谁确认的」溯源信息，非规则输出）：');
console.log('        ' + (judgedDiff.length ? judgedDiff.join('; ') : '无'));

/* ============================================================
 * 6. 结果明细表
 * ============================================================ */
section('6. 判定明细');
console.log('  ' + 'id'.padEnd(22) + '状态'.padEnd(24) + '步骤'.padEnd(8) + '独立组');
results.forEach(function (r) {
  console.log('  ' + String(r.res.id).padEnd(22)
    + String(r.res.verification_status).padEnd(24)
    + String(r.res.chain_steps_hit).padEnd(8)
    + r.res.independent_group_count);
});

/* ============================================================
 * 汇总
 * ============================================================ */
console.log('\n============================================================');
console.log('结果：' + pass + ' PASS / ' + fail + ' FAIL');
if (fail) { console.log('失败项：'); fails.forEach(function (f) { console.log('  - ' + f); }); }
console.log('============================================================');
process.exit(fail ? 1 : 0);
