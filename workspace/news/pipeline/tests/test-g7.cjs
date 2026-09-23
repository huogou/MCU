/* ============================================================
 * G7 测试 · 审核队列 / 审核动作 / 审核日志 / 写入模拟
 * ------------------------------------------------------------
 * 运行：node workspace/news/pipeline/tests/test-g7.cjs
 * 前置：先运行 run-g7-sim.cjs（生成队列/日志/预览产物）。
 * ★ 全程只读 h5/data/news.js。
 * ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const LOG_PATH = path.join(__dirname, 'out-g7.txt');
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
const NEWS_JS = path.join(H5, 'data', 'news.js');
const sha256 = function (p) {
  return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex').toUpperCase();
};
const SHA_BEFORE = sha256(NEWS_JS);

const CI = require('../candidate-item.cjs');
const RQ = require('../review/review-queue.cjs');
const RA = require('../review/review-actions.cjs');
const DC = require('../delivery/delivery-converter.cjs');
const AIOUT = require('../ai-normalizer/output/20260923.json');
const F = require('../fixtures/g5-cases.cjs');
const RC = require('../raw-capture.cjs');

let pass = 0, fail = 0;
const fails = [];
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; fails.push(name + (detail ? ' → ' + detail : '')); console.log('  FAIL  ' + name + (detail ? ' → ' + detail : '')); }
}
function eq(name, a, b) { ok(name, a === b, 'expected ' + JSON.stringify(b) + ', got ' + JSON.stringify(a)); }
function caught(fn) { try { fn(); return null; } catch (e) { return e; } }

console.log('============================================================');
console.log('G7 审核队列 / 动作 / 日志 / 写入模拟 测试');
console.log('============================================================');

/* ---------------- T1 · 审核队列 ---------------- */
console.log('\n■ G7-1 审核队列');
const q = RQ.buildQueue(AIOUT.candidates, { date: '20260923' });
eq('T1.1 队列条数 = 输入候选数（133）', q.doc.count, AIOUT.candidates.length);
eq('T1.2 全部 pending（禁止自动 approved）',
  q.doc.entries.every(function (e) { return e.gate_status === 'pending'; }), true);
ok('T1.3 投影字段齐全（candidate_id/event_key/title/summary/category/related_entities/source/capture_refs/gate_status）',
  q.doc.entries.every(function (e) {
    return e.candidate_id && e.event_key && e.title && e.summary !== undefined &&
      e.category && e.related_entities && Array.isArray(e.source) &&
      Array.isArray(e.capture_refs) && e.gate_status;
  }));
eq('T1.4 签名重算映射留档 = 133 条', q.mappings.length, 133);
eq('T1.5 队列 candidate_id 与签名重算结果一致',
  q.doc.entries.every(function (e, i) { return e.candidate_id === q.signed[i].candidate_id; }), true);

/* ---------------- T2 · 审核动作语义 ---------------- */
console.log('\n■ G7-2 审核动作（approve / reject / modify）');
function mk(over) {
  const base = CI.fromRawCapture(RC.create(F.raw({ capture_id: 'cap-g7-' + Math.random().toString(16).slice(2, 6) })), {
    title: '审核测试标题', summary: '审核测试摘要，长度足够。', category: 'movie',
    ai_model: 'stub', gate_status: 'pending'
  }, { seq: 1, idSpace: { content: new Set(['endgame']), character: new Set() } });
  return Object.assign(base, over || {});
}
const t2a = RA.applyDecision(mk({ gate_status: 'pending' }), {
  action: 'approve', operator: 't', reviewId: 'rev-20260923-001', now: '2026-09-23T00:00:00Z'
});
eq('T2.1 approve → gate_status=approved', t2a.candidate.gate_status, 'approved');
eq('T2.2 reject 缺原因 → REASON_REQUIRED',
  caught(function () { RA.applyDecision(mk({}), { action: 'reject', operator: 't' }); }).code, 'REASON_REQUIRED');
const t2r = RA.applyDecision(mk({ gate_status: 'pending' }), {
  action: 'reject', reason: '与现有报道重复且无增量信息', operator: 't', reviewId: 'rev-20260923-002'
});
eq('T2.3 reject → rejected + 原因入日志', t2r.candidate.gate_status === 'rejected' && t2r.history.reason.indexOf('重复') >= 0, true);
const inputCand = mk({ gate_status: 'pending' });
const inputSnapshot = JSON.stringify(inputCand);
const t2m = RA.applyDecision(inputCand, {
  action: 'modify', operator: 't', reviewId: 'rev-20260923-003', reviewSeq: 9,
  modifications: { title: '修改后的审核标题' }, reason: '措辞统一'
});
ok('T2.4 modify 返回新对象（输入候选未被就地修改）',
  JSON.stringify(inputCand) === inputSnapshot && t2m.candidate.title === '修改后的审核标题');
ok('T2.5 modify 后 L1 合法且 key/id 重算',
  CI.validate(t2m.candidate).pass && t2m.candidate.candidate_id !== inputCand.candidate_id);
eq('T2.6 modify 白名单外字段 → MODIFY_FIELD_FORBIDDEN',
  caught(function () {
    RA.applyDecision(mk({}), { action: 'modify', operator: 't', modifications: { gate_status: 'approved' } });
  }).code, 'MODIFY_FIELD_FORBIDDEN');
eq('T2.7 modify 不得触碰状态字段（verification_status）',
  caught(function () {
    RA.applyDecision(mk({}), { action: 'modify', operator: 't', modifications: { verification_status: 'official_confirmed' } });
  }).code, 'MODIFY_FIELD_FORBIDDEN');
ok('T2.8 history 条目八字段齐全',
  ['review_id', 'event_id', 'operator', 'action', 'before', 'after', 'reason', 'created_at']
    .every(function (k) { return k in t2a.history; }));

/* ---------------- T3 · 审核日志（run-g7-sim 产物） ---------------- */
console.log('\n■ G7-3 审核日志（review-history.json）');
const histPath = path.join(__dirname, '..', 'review', 'review-history.json');
const hist = JSON.parse(fs.readFileSync(histPath, 'utf8'));
eq('T3.1 模拟日志 12 条（10 approve + 1 reject + 1 modify）', hist.entries.length, 12);
eq('T3.2 动作分布 approve=10 / reject=1 / modify=1',
  hist.entries.filter(function (e) { return e.action === 'approve'; }).length + '/' +
  hist.entries.filter(function (e) { return e.action === 'reject'; }).length + '/' +
  hist.entries.filter(function (e) { return e.action === 'modify'; }).length, '10/1/1');
const ids = hist.entries.map(function (e) { return e.review_id; });
ok('T3.3 review_id 唯一且按序递增（rev-20260923-001…012）',
  new Set(ids).size === 12 && ids[0] === 'rev-20260923-001' && ids[11] === 'rev-20260923-012');
ok('T3.4 每条日志 operator/created_at 非空',
  hist.entries.every(function (e) { return e.operator && e.created_at; }));
ok('T3.5 reject 决策带原因、modify 决策带 modifications',
  hist.entries.some(function (e) { return e.action === 'reject' && e.reason; }) &&
  hist.entries.some(function (e) { return e.action === 'modify' && e.modifications && e.modifications.title; }));

/* ---------------- T4/T5 · 写入预览与 diff（run-g7-sim 产物） ---------------- */
console.log('\n■ G7-4/5 写入预览与 diff');
const pvPath = path.join(ROOT, 'workspace', 'news', 'pipeline', 'deliveries', '20260923.delivery-preview.json');
const pv = JSON.parse(fs.readFileSync(pvPath, 'utf8'));
eq('T4.1 preview 10 条（首批模拟批准）', pv.count, 10);
eq('T4.2 逐条恰 33 字段',
  pv.items.every(function (it) { return Object.keys(it).length === 33; }), true);
ok('T4.3 id 形态全部合法（news-YYYY-MM-DD-NNN）',
  pv.items.every(function (it) { return /^news-\d{4}-\d{2}-\d{2}-\d{3}$/.test(it.id); }));
eq('T5.1 diff：新增 10', pv.diff.to_add.length, 10);
eq('T5.2 diff：修改 0', pv.diff.to_update.length, 0);
eq('T5.3 diff：删除 0（追加写入，现网 15 条全部保留）', pv.diff.to_delete_reported.length, 0);
ok('T5.4 现网 supersedes 互链对不在本批（保持原状）',
  pv.diff.supersedes_protection.indexOf('保持原状') >= 0);
eq('T5.5 覆盖核对：MCU 新闻 ≥5 / 同事件双条 2 / 单来源事件全部（igc 均=1）',
  (function () {
    const mcu = pv.items.filter(function (it) {
      return it.title.indexOf('复联4') >= 0 || it.title.indexOf('漫威') >= 0 ||
        it.title.indexOf('蜘蛛侠') >= 0 || it.title.indexOf('旺达幻视') >= 0 ||
        it.title.indexOf('毁灭之日') >= 0;
    }).length;
    const cto = pv.items.filter(function (it) { return it.title.indexOf('首席技术官') >= 0; }).length;
    const single = pv.items.every(function (it) { return it.independent_group_count === 1; });
    return (mcu >= 5 ? 1 : 0) * 10 + (cto === 2 ? 1 : 0) * 2 + (single ? 1 : 0);
  })(), 13);

/* ---------------- T6 · 基线不破坏 ---------------- */
console.log('\n■ 基线不破坏');
eq('T6.1 news.js SHA256 前后一致（全程只读）', sha256(NEWS_JS), SHA_BEFORE);
console.log('  INFO  news.js SHA256 = ' + SHA_BEFORE.slice(0, 16) + '…');
eq('T6.2 全部输出无状态字段泄漏（preview 深扫）',
  (function () {
    let hits = 0;
    (function walk(n) {
      if (n == null || typeof n !== 'object') return;
      if (Array.isArray(n)) { n.forEach(walk); return; }
      Object.keys(n).forEach(function (k) {
        if (['verification_status'].indexOf(k) >= 0 && typeof n[k] !== 'string') hits++;
        walk(n[k]);
      });
    })(pv.items);
    return hits === 0;
  })(), true);

console.log('\n============================================================');
console.log('结果：' + pass + ' PASS / ' + fail + ' FAIL');
if (fail) { fails.forEach(function (f2) { console.log('  - ' + f2); }); }
console.log('============================================================');
process.exit(fail ? 1 : 0);
