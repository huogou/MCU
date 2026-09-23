/* ============================================================
 * G10 测试 · 运行记录模块 + 生产基线统计
 * ------------------------------------------------------------
 * 运行：node workspace/news/pipeline/tests/test-g10.cjs
 * ★ 全程只读 h5/data/news.js（SHA 前后一致断言）。
 * ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const LOG_PATH = path.join(__dirname, 'out-g10.txt');
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
const NEWS_JS = path.join(ROOT, 'h5', 'data', 'news.js');
const sha = function (p) {
  return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex').toUpperCase();
};
const SHA_BEFORE = sha(NEWS_JS);
const G9_SHA = 'EBF67DE08BF8C391C59F05ED82CB43144A2726F879EF7185388CA7939E56FCAF';

const RH = require('../run-history/run-history.cjs');
const CS = require('../capture-store.cjs');
const RC = require('../raw-capture.cjs');
const EM = require('../../engine/dedup/event-merger.cjs');
const vm = require('vm');

let pass = 0, fail = 0;
const fails = [];
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; fails.push(name + (detail ? ' → ' + detail : '')); console.log('  FAIL  ' + name + (detail ? ' → ' + detail : '')); }
}
function eq(name, a, b) { ok(name, a === b, 'expected ' + JSON.stringify(b) + ', got ' + JSON.stringify(a)); }
function caught(fn) { try { fn(); return null; } catch (e) { return e; } }

console.log('============================================================');
console.log('G10 运行记录模块 + 生产基线统计 测试');
console.log('============================================================');

/* ---------------- T1 · 字段封闭集与校验 ---------------- */
console.log('\n■ T1 字段封闭集与校验');
eq('T1.1 规范恰 10 字段', RH.FIELDS.length, 10);
ok('T1.2 十字段与任务书清单一致',
  ['run_id', 'start_time', 'end_time', 'source_success', 'source_failed',
    'capture_count', 'candidate_count', 'approved_count', 'rejected_count',
    'delivery_count'].every(function (k) { return RH.FIELDS.indexOf(k) >= 0; }));

function mkEntry(over) {
  return Object.assign({
    run_id: 'run-20260923-001', start_time: '2026-09-23T00:00:00Z', end_time: '2026-09-23T00:05:00Z',
    source_success: 3, source_failed: 2, capture_count: 130, candidate_count: 133,
    approved_count: 20, rejected_count: 113, delivery_count: 20
  }, over || {});
}
ok('T1.3 合法记录通过校验', RH.validate(mkEntry()) === true);
eq('T1.4 缺字段 → FIELD_SET_MISMATCH', caught(function () { const e = mkEntry(); delete e.delivery_count; RH.validate(e); }).code, 'FIELD_SET_MISMATCH');
eq('T1.5 多字段 → FIELD_SET_MISMATCH',
  caught(function () { RH.validate(Object.assign(mkEntry(), { note: 'x' })); }).code, 'FIELD_SET_MISMATCH');
eq('T1.6 坏 run_id → BAD_RUN_ID', caught(function () { RH.validate(mkEntry({ run_id: 'run-20260923-1' })); }).code, 'BAD_RUN_ID');
eq('T1.7 负数计数 → BAD_COUNT', caught(function () { RH.validate(mkEntry({ capture_count: -1 })); }).code, 'BAD_COUNT');
eq('T1.8 坏时间 → BAD_TIME', caught(function () { RH.validate(mkEntry({ start_time: '2026-09-23' })); }).code, 'BAD_TIME');

/* ---------------- T2 · 追加式与 run_id（临时目录） ---------------- */
console.log('\n■ T2 追加式记录与 run_id 递增');
const TDIR = path.join(__dirname, 'tmp-g10');
try { fs.rmSync(TDIR, { recursive: true, force: true }); } catch (e) {}
fs.mkdirSync(TDIR, { recursive: true });
const topt = { dir: TDIR };
eq('T2.1 nextRunId 首次 = run-20260923-001', RH.nextRunId(Object.assign({ date: '20260923' }, topt)), 'run-20260923-001');
const r1 = RH.record(mkEntry({ run_id: 'run-20260923-001' }), topt);
eq('T2.2 首条落盘 count=1', r1.count, 1);
eq('T2.3 nextRunId 递增 = 002', RH.nextRunId(Object.assign({ date: '20260923' }, topt)), 'run-20260923-002');
const r2 = RH.record(mkEntry({ run_id: 'run-20260923-002', delivery_count: 0 }), topt);
eq('T2.4 追加后 count=2', r2.count, 2);
eq('T2.5 run_id 重复 → RUN_ID_DUP（append-only 禁覆盖）',
  caught(function () { RH.record(mkEntry({ run_id: 'run-20260923-001' }), topt); }).code, 'RUN_ID_DUP');
eq('T2.6 load 回读 2 条且字段完整', RH.load(topt).runs.length, 2);

/* 写入位置守卫复测 */
eq('T2.7 拒绝写入 h5（守卫复测）',
  caught(function () { RH.record(mkEntry(), { dir: path.join(ROOT, 'h5', 'data') }); }).code, 'WRITE_OUTSIDE_PIPELINE');

/* ---------------- T3 · 生产基线统计（news.js 35 条实测） ---------------- */
console.log('\n■ T3 生产基线统计（35 条）');
const raw = fs.readFileSync(NEWS_JS, 'utf8');
const ctx = {};
ctx.window = ctx; ctx.global = ctx; ctx.console = console;
ctx.URL = URL; ctx.Date = Date; ctx.Math = Math; ctx.JSON = JSON;
vm.createContext(ctx);
vm.runInContext(raw, ctx, { filename: 'news.js' });
const N = ctx.window.MCU_NEWS || [];
eq('T3.1 总库 = 35 条（G9 后基线）', N.length, 35);

let mcuEntity = 0, mcuKw = 0, singleRows = 0, singleIgc = 0;
const KW = /漫威|MCU|复联|毁灭之日|蜘蛛侠|旺达|幻视|猩红女巫|钢铁|雷神|美国队长|奇异博士|黑豹|银河护卫队|蚁人|惊奇|夜魔侠|神盾|秘密战争|Encore/i;
N.forEach(function (n) {
  if ((n.related_movies || []).length + (n.related_series || []).length + (n.related_characters || []).length > 0) mcuEntity++;
  if (KW.test(String(n.title || ''))) mcuKw++;
  if ((n.reported_by || []).length === 1) singleRows++;
  if (n.independent_group_count === 1) singleIgc++;
});
eq('T3.2 MCU 关联（实体口径）= 基线文件一致',
  mcuEntity, JSON.parse(fs.readFileSync(path.join(ROOT, 'workspace', 'news', 'pipeline', 'run-history', 'production-baseline-20260923.json'), 'utf8')).mcu_ratio.by_entity_hit.mcu);
ok('T3.3 MCU 双口径并列（实体 ' + mcuEntity + ' / 关键词 ' + mcuKw + '，均为 35 的 40%+）',
  mcuEntity >= 14 && mcuKw >= 14);
ok('T3.4 单来源双口径并列（rows ' + singleRows + ' / igc ' + singleIgc + '，均 > 70%）',
  singleRows > 24 && singleIgc > 24);
const merged = EM.mergeCandidates(N.map(function (n) {
  return { id: n.id, title: n.title, category: n.category,
    related_movies: n.related_movies || [], related_series: n.related_series || [],
    related_characters: n.related_characters || [],
    publish_time: n.publish_time || '', first_seen_at: n.first_seen_at || '',
    reported_by: n.reported_by || [] };
}), { windowDays: 3 });
ok('T3.5 事件合并：35 条 → 34 事件（mergeable 1，records_deleted=0）',
  merged.stats.input_items === 35 && merged.stats.output_events === 34 &&
  merged.stats.records_deleted === 0);

/* ---------------- T4 · 三不影响 + SHA 机制 ---------------- */
console.log('\n■ T4 三不影响与 SHA256 机制');
ok('T4.1 run-history 模块零网络零 h5 写路径（代码级：无 news.js 引用）',
  fs.readFileSync(path.join(ROOT, 'workspace', 'news', 'pipeline', 'run-history', 'run-history.cjs'), 'utf8')
    .indexOf('news.js') < 0);
eq('T4.2 news.js SHA256 前后一致（G10 全程零写入）', sha(NEWS_JS), SHA_BEFORE);
eq('T4.3 SHA256 机制延续有效：当前值 == G9 写入后基线', SHA_BEFORE, G9_SHA);
/* capture-store / candidate-store 守卫复测（append-only 机制仍有效） */
eq('T4.4 capture-store 写入守卫复测（h5 拒绝）',
  caught(function () { CS.appendCaptures([RC.create(require('../fixtures/g5-cases.cjs').raw({})), ], { dir: path.join(ROOT, 'h5', 'data'), date: '20260923' }); }).code, 'WRITE_OUTSIDE_PIPELINE');

console.log('\n============================================================');
console.log('结果：' + pass + ' PASS / ' + fail + ' FAIL');
if (fail) { fails.forEach(function (f2) { console.log('  - ' + f2); }); }
console.log('============================================================');
process.exit(fail ? 1 : 0);
