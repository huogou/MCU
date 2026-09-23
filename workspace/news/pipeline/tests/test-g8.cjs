/* ============================================================
 * G8 测试 · 历史兼容规则 / 审核规范 / 建议草案 / 最终预览 / 上线前检查
 * ------------------------------------------------------------
 * 运行：node workspace/news/pipeline/tests/test-g8.cjs
 * 前置：先运行 run-g8-sim.cjs（生成 review-result / final-preview / 备份）。
 * ★ 全程只读 h5/data/news.js。
 * ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const LOG_PATH = path.join(__dirname, 'out-g8.txt');
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
const sha256 = function (p) {
  return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex').toUpperCase();
};
const SHA_BEFORE = sha256(NEWS_JS);

let pass = 0, fail = 0;
const fails = [];
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; fails.push(name + (detail ? ' → ' + detail : '')); console.log('  FAIL  ' + name + (detail ? ' → ' + detail : '')); }
}
function eq(name, a, b) { ok(name, a === b, 'expected ' + JSON.stringify(b) + ', got ' + JSON.stringify(a)); }

console.log('============================================================');
console.log('G8 规则收口与上线准备 测试');
console.log('============================================================');

/* ---------------- T1 · 两份规范文档 ---------------- */
console.log('\n■ G8-1/2 规范文档');
const compatPath = path.join(ROOT, 'docs', '产品', '资讯模块', '历史数据兼容规则V1.0.txt');
const specPath = path.join(ROOT, 'docs', '产品', '资讯模块', '资讯审核规范V1.0.txt');
ok('T1.1 《历史数据兼容规则V1.0》存在', fs.existsSync(compatPath));
ok('T1.2 《资讯审核规范V1.0》存在', fs.existsSync(specPath));
const compat = fs.readFileSync(compatPath, 'utf8');
const spec = fs.readFileSync(specPath, 'utf8');
ok('T1.3 兼容规则含 R-1 历史允许空值 / R-2 新数据强制来源 / R-4 待拍板不动数据',
  compat.indexOf('R-1【历史数据允许空值】') >= 0 &&
  compat.indexOf('R-2【新数据强制来源行】') >= 0 &&
  compat.indexOf('R-4【未来统一的路径（待拍板，本轮不执行）】') >= 0);
ok('T1.4 审核规范含收录/拒绝/修改/优先级/来源可信等级五节',
  ['【1】收录规则', '【2】拒绝规则', '【3】修改规则', '【5】优先级规则', '【4】来源可信等级']
    .every(function (k) { return spec.indexOf(k) >= 0; }));
ok('T1.5 审核规范声明不改变 G1–G7 代码',
  spec.indexOf('不改变 G1–G7 任何代码') >= 0 || spec.indexOf('不触碰') >= 0);

/* ---------------- T2 · review-result 建议草案 ---------------- */
console.log('\n■ G8-3 审核建议草案（review-result）');
const rrPath = path.join(ROOT, 'workspace', 'news', 'pipeline', 'review', 'review-result-20260923.json');
const rr = JSON.parse(fs.readFileSync(rrPath, 'utf8'));
eq('T2.1 草案覆盖 133 条', rr.count, 133);
eq('T2.2 分布 approve=20 / reject=113', rr.distribution.approve + '/' + rr.distribution.reject, '20/113');
ok('T2.3 草案性质显著标注（不自动批准）',
  rr.nature.indexOf('草案') >= 0 && rr.nature.indexOf('须负责人逐条复核确认') >= 0);
ok('T2.4 每条含 candidate_id/operator/action/reason/timestamp 且 reason 非空',
  rr.results.every(function (r) {
    return r.candidate_id && r.operator === 'g8-draft-review' &&
      ['approve', 'reject'].indexOf(r.action) >= 0 && r.reason && r.timestamp;
  }));
ok('T2.5 candidate_id 无重复（与队列一一对应）',
  new Set(rr.results.map(function (r) { return r.candidate_id; })).size === 133);
ok('T2.6 reject 原因均引用拒绝规则条款（B1/B2/B3）',
  rr.results.filter(function (r) { return r.action === 'reject'; })
    .every(function (r) { return /B1|B2|B3/.test(r.reason); }));

/* ---------------- T3 · delivery-final-preview ---------------- */
console.log('\n■ G8-4 最终预览（delivery-final-preview）');
const pvPath = path.join(ROOT, 'workspace', 'news', 'pipeline', 'deliveries', '20260923.delivery-final-preview.json');
const pv = JSON.parse(fs.readFileSync(pvPath, 'utf8'));
eq('T3.1 preview ≤ 20 条（任务书上限）且 = 20', pv.count, 20);
ok('T3.2 逐条恰 33 字段', pv.items.every(function (it) { return Object.keys(it).length === 33; }));
ok('T3.3 id 形态全部合法', pv.items.every(function (it) { return /^news-\d{4}-\d{2}-\d{2}-\d{3}$/.test(it.id); }));
eq('T3.4 diff：新增 20', pv.diff.to_add.length, 20);
eq('T3.5 diff：修改 0', pv.diff.to_update.length, 0);
eq('T3.6 diff：删除 0（追加写入）', pv.diff.to_delete, 0);
ok('T3.7 覆盖：AI 修改案例 1 条 + 单来源事件全部 + MCU 核心 ≥10',
  pv.coverage.ai_modified_cases === 1 &&
  pv.coverage.single_source_events === pv.count &&
  pv.coverage.mcu_core >= 10, JSON.stringify(pv.coverage));
ok('T3.8 现网 supersedes 互链保护（010/014 不在本批）',
  pv.diff.supersedes_protection.indexOf('保持原状') >= 0);

/* ---------------- T4 · 上线前检查 ---------------- */
console.log('\n■ G8-5 上线前检查');
const backupPath = path.join(ROOT, 'workspace', 'news', 'pipeline', 'review', 'backup', 'news.js.20260923');
ok('T4.1 news.js 备份存在', fs.existsSync(backupPath));
eq('T4.2 备份 SHA256 == 现网（备份完整）', sha256(backupPath), SHA_BEFORE);
ok('T4.3 备份未落在 C 盘（用户环境约定）', backupPath.indexOf('C:') !== 0);

/* ---------------- T5 · 基线不破坏 ---------------- */
console.log('\n■ 基线不破坏');
eq('T5.1 news.js SHA256 前后一致（全程只读）', sha256(NEWS_JS), SHA_BEFORE);
console.log('  INFO  news.js SHA256 = ' + SHA_BEFORE.slice(0, 16) + '…');
eq('T5.2 review-history 正式决策链未被 G8 草案写入（仍为 G7 的 12 条）',
  (function () {
    const h = JSON.parse(fs.readFileSync(path.join(ROOT, 'workspace', 'news', 'pipeline', 'review', 'review-history.json'), 'utf8'));
    return h.entries.length === 12;
  })(), true);
ok('T5.3 review-queue 的 gate_status 仍全为 pending（草案未触碰队列）',
  (function () {
    const qq = JSON.parse(fs.readFileSync(path.join(ROOT, 'workspace', 'news', 'pipeline', 'review', 'review-queue-20260923.json'), 'utf8'));
    return qq.entries.every(function (e) { return e.gate_status === 'pending'; });
  })(), true);

console.log('\n============================================================');
console.log('结果：' + pass + ' PASS / ' + fail + ' FAIL');
if (fail) { fails.forEach(function (f2) { console.log('  - ' + f2); }); }
console.log('============================================================');
process.exit(fail ? 1 : 0);
