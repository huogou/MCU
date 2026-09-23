/* ============================================================
 * G1 · 合成边界用例回归 B1–B10
 * ------------------------------------------------------------
 * 运行：node workspace/news/engine/test-judge-boundary.cjs
 *
 * 输入全部为**合成构造**（fixtures/judge-cases.cjs），
 * 不读取也不写入 h5/data/news.js —— 生产数据零污染。
 * ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');

/* 输出另存 UTF-8 日志（本机 PowerShell 原生命令重定向编码不可控） */
const LOG_PATH = path.join(__dirname, 'out-boundary.txt');
const _lines = [];
const _log = console.log.bind(console);
console.log = function () {
  const s = Array.prototype.map.call(arguments, String).join(' ');
  _lines.push(s); _log(s);
};
process.on('exit', function () {
  try { fs.writeFileSync(LOG_PATH, _lines.join('\n') + '\n', 'utf8'); } catch (e) {}
});

const judge = require('./news-judge.cjs');
const R = require('./news-judge-rules.cjs');
const F = require('./fixtures/judge-cases.cjs');

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

const NOW = '2026-09-22T12:00:00Z';

console.log('============================================================');
console.log('G1 · 资讯状态判定器 V1.0 —— 合成边界用例（B1–B10，含对照用例 B4b，共 11 例）');
console.log('============================================================');
console.log('用例数：' + F.BOUNDARY_CASES.length + '｜规则版本：' + R.RULE_VERSION);

section('逐例判定');

const results = [];
F.BOUNDARY_CASES.forEach(function (c) {
  const res = judge.judge(c.item, c.input || {}, { now: NOW });
  results.push({ c: c, res: res });

  eq('【' + c.id + '】状态 = ' + c.expect.status + '　（' + c.desc + '）',
    res.verification_status, c.expect.status);
  eq('【' + c.id + '】独立组数 = ' + c.expect.groups, res.independent_group_count, c.expect.groups);
  eq('【' + c.id + '】命中 ' + c.expect.step, res.chain_steps_hit, c.expect.step);

  if (c.expect.forbidStatus) {
    ok('【' + c.id + '】不得判为 ' + c.expect.forbidStatus,
      res.verification_status !== c.expect.forbidStatus,
      '实际=' + res.verification_status);
  }
});

section('边界专项');

/* B9 / B10：tier 过滤的作用 */
const b9 = results.filter(function (r) { return r.c.id === 'B9'; })[0].res;
const b10 = results.filter(function (r) { return r.c.id === 'B10'; })[0].res;
eq('【B9】独立组 1 / 可靠组 0（来源 tier=T4 不计入可靠来源）',
  b9.independent_group_count + '/' + b9.reliable_group_count, '1/0');
eq('【B10】独立组 2 / 可靠组 0（两个 T4 组均不计入可靠来源）',
  b10.independent_group_count + '/' + b10.reliable_group_count, '2/0');
ok('【B10】2 个独立组但均为 T4 → 不得升格为 multi_source_reported（缺数据/低质一律降级）',
  b10.verification_status === 'unverified');

/* B4 vs B4b：Step 4 必须早于 Step 5 */
const b4 = results.filter(function (r) { return r.c.id === 'B4'; })[0].res;
const b4b = results.filter(function (r) { return r.c.id === 'B4b'; })[0].res;
eq('【B4/B4b】同样 2 个独立组：已核准互斥 → Step 4；未核准 → Step 5',
  b4.chain_steps_hit + '|' + b4b.chain_steps_hit, 'Step 4|Step 5');

/* B5/B6/B7：官方标记不合格一律回落 */
['B5', 'B6', 'B7'].forEach(function (id) {
  const r = results.filter(function (x) { return x.c.id === id; })[0].res;
  ok('【' + id + '】不得落 Step 1 / Step 2（官方标记不合格 → 回落）',
    r.chain_steps_hit !== 'Step 1' && r.chain_steps_hit !== 'Step 2',
    '实际=' + r.chain_steps_hit);
});

/* B8：Step 3 的「全部更正」严格性 */
const b8 = results.filter(function (r) { return r.c.id === 'B8'; })[0].res;
ok('【B8】仅 1 条被更正 → 事件级不落 corrected（R8.5 事件级语义）',
  b8.verification_status === 'multi_source_reported');

section('判定器纪律（红线自检）');

ok('【红线 4】不得假设未确认来源的独立性（待核一律不计组）',
  results.filter(function (r) { return r.c.id === 'B1'; })[0].res.independent_group_count === 0);
ok('【红线 7】产出状态全部落在 8 态枚举内',
  results.every(function (r) { return R.STATUS_LIST.indexOf(r.res.verification_status) >= 0; }));
ok('【契约】全部输出含 7 项必填字段',
  results.every(function (r) {
    return judge.REQUIRED_OUTPUT_FIELDS.every(function (k) { return k in r.res; });
  }));

/* 幂等 */
let notIdem = '';
F.BOUNDARY_CASES.forEach(function (c) {
  const a = JSON.stringify(judge.judge(c.item, c.input || {}, { now: NOW }));
  const b = JSON.stringify(judge.judge(c.item, c.input || {}, { now: NOW }));
  if (a !== b) notIdem = c.id;
});
eq('幂等：同输入两次运行输出一致', notIdem, '');

/* 异常输入必须显式抛错，不静默返回默认值 */
let threw = false;
try { judge.judge(null, {}); } catch (e) { threw = true; }
ok('非法输入（item=null）显式抛错', threw);
threw = false;
try { judge.judge({ title: '无 id' }, {}); } catch (e) { threw = true; }
ok('缺 id 的条目显式抛错', threw);

section('判定明细');
console.log('  ' + 'case'.padEnd(6) + '状态'.padEnd(24) + '步骤'.padEnd(8) + '独立组/可靠组');
results.forEach(function (r) {
  console.log('  ' + String(r.c.id).padEnd(6)
    + String(r.res.verification_status).padEnd(24)
    + String(r.res.chain_steps_hit).padEnd(8)
    + r.res.independent_group_count + '/' + r.res.reliable_group_count);
});

console.log('\n============================================================');
console.log('结果：' + pass + ' PASS / ' + fail + ' FAIL');
if (fail) { console.log('失败项：'); fails.forEach(function (f) { console.log('  - ' + f); }); }
console.log('============================================================');
process.exit(fail ? 1 : 0);
