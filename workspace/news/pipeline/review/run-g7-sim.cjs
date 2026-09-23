/* ============================================================
 * G7-4/G7-5 · 首批上线模拟编排（人工模拟 approved；不写 h5）
 * ------------------------------------------------------------
 * 运行：node workspace/news/pipeline/review/run-g7-sim.cjs
 * 流程：队列生成（133）→ 12 条模拟决策（10 approve + 1 reject
 *       + 1 modify→approve）→ Gate → DeliveryItem → 33 字段校验
 *       → delivery-preview.json + news.js diff 报告。
 * ★ 全程只读 h5/data/news.js；operator = simulated-g7-reviewer（演练），
 *   真实上线须由负责人按 G6 报告四步条件另行操作。
 * ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const LOG_PATH = path.join(__dirname, 'out-g7-sim.txt');
const _lines = [];
const _log = console.log.bind(console);
console.log = function () {
  const s = Array.prototype.map.call(arguments, String).join(' ');
  _lines.push(s); _log(s);
};
process.on('exit', function () {
  try { fs.writeFileSync(LOG_PATH, _lines.join('\n') + '\n', 'utf8'); } catch (e) {}
});

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');   /* review→pipeline→news→workspace→项目根 */
const H5 = path.join(ROOT, 'h5');

const AIOUT = require('../ai-normalizer/output/20260923.json');
const RQ = require('./review-queue.cjs');
const RA = require('./review-actions.cjs');
const GATE = require('../gate/gate.cjs');
const DC = require('../delivery/delivery-converter.cjs');

const NEWS_JS = path.join(H5, 'data', 'news.js');
const sha256 = function (p) {
  return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex').toUpperCase();
};
const SHA_BEFORE = sha256(NEWS_JS);
const NOW = '2026-09-23T00:00:00Z';
const OPERATOR = 'simulated-g7-reviewer';

/* ---------------- 1) 审核队列 ---------------- */
console.log('============================================================');
console.log('G7 首批上线模拟（审核 → Gate → DeliveryItem → 写入预览）');
console.log('============================================================');
const q = RQ.buildQueue(AIOUT.candidates, { date: '20260923', generated_at: NOW });
const qPath = path.join(__dirname, 'review-queue-20260923.json');
fs.writeFileSync(qPath, JSON.stringify(q.doc, null, 2), 'utf8');
console.log('审核队列：' + q.doc.count + ' 条（全部 pending）→ ' + qPath);

/* title → 签名后完整候选（35 字段）索引 */
const signedByTitle = {};
q.signed.forEach(function (c) { signedByTitle[c.title] = c; });
function pick(title) {
  const c = signedByTitle[title];
  if (!c) {
    const e = new Error('[PICK_NOT_FOUND] 队列中找不到 title：' + title);
    e.code = 'PICK_NOT_FOUND';
    throw e;
  }
  return c;
}

/* ---------------- 2) 模拟决策（12 条） ---------------- */
const APPROVE_TITLES = [
  /* MCU 新闻（6） */
  '《复联4》重映版独家片段据报聚焦两位MCU角色会面',
  '《复联4》为Encore重映更换全新海报',
  '漫威影业SDCC震撼官宣：《毁灭之日》《恶灵骑士》《黑豹3》',
  '《毁灭之日》新剧照为猩红女巫回归传闻增添可信度',
  '漫威官方确认蜘蛛侠最不受欢迎的反派已存在于MCU',
  '《旺达幻视》续作公布第三位主要超级英雄',
  /* 同事件双条（CTO 对，2；其中旧条走 modify→approve 路径，见下） */
  '华特迪士尼公司任命卡兰迪普·阿南德为新设首席技术官职位',
  /* Disney 行业高价值（2） */
  '泰勒·斯威夫特为《玩具总动员5》创作新歌《我知道是你》',
  '《王国之心》获批准开拍首部原创剧集登陆Disney频道与Disney+'
];
const REJECT_TITLE = '迪士尼加速器公布2026年度入选企业';
const MODIFY_TITLE_OLD = '华特迪士尼公司任命卡兰迪普·阿南德为首任首席技术官';
const MODIFY_NEW_TITLE = '华特迪士尼公司任命卡兰迪普·阿南德为新设首席技术官职位';

let revSeq = 0;
function nextReviewId() {
  revSeq++;
  return 'rev-20260923-' + String(revSeq).padStart(3, '0');
}

const histories = [];
const approved = [];

/* reject（先于 approve 计数，review_id 顺序即执行顺序） */
console.log('\n■ 模拟决策（operator=' + OPERATOR + '）');
const rejCand = pick(REJECT_TITLE);
const rej = RA.applyDecision(rejCand, {
  action: 'reject', reason: '纯行业名录公告，无 MCU 作品关联且无实体，信息价值低',
  operator: OPERATOR, reviewId: nextReviewId(), now: NOW
});
histories.push(rej.history);
console.log('  REJECT  ' + rej.history.candidate_id + ' ← ' + REJECT_TITLE);

/* modify → approve（统一措辞，落实 G5.5 建议） */
const modCand = pick(MODIFY_TITLE_OLD);
const mod1 = RA.applyDecision(modCand, {
  action: 'modify', operator: OPERATOR, reviewId: nextReviewId(), now: NOW,
  modifications: { title: MODIFY_NEW_TITLE },
  reason: '同公告双出口统一措辞（G5.5 统一措辞建议的首次落地）'
});
histories.push(mod1.history);
const mod2 = RA.applyDecision(mod1.candidate, {
  action: 'approve', operator: OPERATOR, reviewId: nextReviewId(), now: NOW,
  reason: '修改后通过'
});
histories.push(mod2.history);
approved.push(mod2.candidate);
console.log('  MODIFY  ' + mod1.history.candidate_id + ' → ' + mod2.history.candidate_id +
  '（title 统一）→ APPROVE');

/* approve ×10 */
APPROVE_TITLES.forEach(function (t) {
  const c = pick(t);
  const r = RA.applyDecision(c, {
    action: 'approve', operator: OPERATOR, reviewId: nextReviewId(), now: NOW,
    reason: 'G7-4 首批上线模拟（负责人视角演练）'
  });
  histories.push(r.history);
  approved.push(r.candidate);
  console.log('  APPROVE ' + r.history.candidate_id + ' ← ' + t);
});

eqCheck('审核决策总数 = 12', histories.length, 12);
eqCheck('approved 总数 = 10（含 modify 后批准 1 条）', approved.length, 10);

function eqCheck(name, a, b) {
  console.log('  ' + (a === b ? 'PASS' : 'FAIL') + '  ' + name +
    (a === b ? '' : '（expected ' + b + ', got ' + a + '）'));
  if (a !== b) process.exitCode = 1;
}

/* ---------------- 3) review-history.json（追加式） ---------------- */
const histPath = path.join(__dirname, 'review-history.json');
let histDoc = { schema_version: '1.0', entries: [] };
if (fs.existsSync(histPath)) {
  try { histDoc = JSON.parse(fs.readFileSync(histPath, 'utf8')); } catch (e) { /* 损坏则重建前先备份 */ }
}
const prevCount = (histDoc.entries || []).length;
histDoc.schema_version = '1.0';
histDoc.updated_at = NOW;
histDoc.count = prevCount + histories.length;
histDoc.entries = (histDoc.entries || []).concat(histories);
fs.writeFileSync(histPath, JSON.stringify(histDoc, null, 2), 'utf8');
console.log('\n审核日志（追加）：+' + histories.length + ' 条 → 总 ' + histDoc.count + ' 条 → ' + histPath);

/* ---------------- 4) Gate → DeliveryItem ---------------- */
console.log('\n■ Gate → DeliveryItem');
const gate = GATE.review(approved, {});
console.log('  Gate：approved=' + gate.stats.approved + ' rejected=' + gate.stats.rejected +
  '（supersedes_pairs=' + gate.stats.supersedes_pairs + '）');
if (gate.stats.approved !== 10) {
  console.log('  ★ approved ≠ 10，终止（预期 10 条模拟批准）');
  process.exit(1);
}
const conv = DC.toDeliveries(gate.approved, { now: NOW });
console.log('  DeliveryItem：' + conv.items.length + ' 条');
conv.items.forEach(function (it) {
  const keysOk = Object.keys(it).length === 33;
  console.log('    ' + it.id + '  33字段=' + (keysOk ? 'OK' : 'BAD') +
    '  vs=' + it.verification_status + '  igc=' + it.independent_group_count +
    '  judged_by=' + it.judged_by);
  if (!keysOk) process.exitCode = 1;
});

/* ---------------- 5) delivery-preview + diff ---------------- */
console.log('\n■ 写入模拟（不写 h5）');
/* 读现网（只读） */
const vm = require('vm');
const ctx = {};
ctx.window = ctx; ctx.global = ctx; ctx.console = console;
ctx.URL = URL; ctx.Date = Date; ctx.Math = Math; ctx.JSON = JSON;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(NEWS_JS, 'utf8'), ctx, { filename: 'news.js' });
const existing = ctx.window.MCU_NEWS || [];
const existingById = {};
existing.forEach(function (n) { existingById[n.id] = n; });

/* diff：新增 / 修改 / 删除 */
const to_add = [], to_update = [], unchanged = [];
conv.items.forEach(function (it) {
  if (!existingById[it.id]) { to_add.push(it.id); return; }
  /* 稳定字段对比（排除判定时刻相关：status_history/status_changed_at/reason/evidence） */
  const real = existingById[it.id];
  const STABLE = ['title', 'summary', 'category', 'publish_time', 'first_seen_at',
    'verification_status', 'reported_by', 'independent_group_count',
    'original_source', 'original_source_url', 'official_source', 'official_source_url',
    'related_movies', 'related_series', 'related_characters', 'related_phases',
    'supersedes_id', 'superseded_by_id', 'report_corrections', 'conflict_statements', 'judged_by'];
  const diffK = STABLE.filter(function (k) { return JSON.stringify(it[k]) !== JSON.stringify(real[k]); });
  (diffK.length ? to_update : unchanged).push(it.id + (diffK.length ? '（差异:' + diffK.join(',') + '）' : '（内容一致）'));
});
/* ★ 删除语义：写入为**追加**（现网 15 条全部保留），写入后总库 =
 *   现网 ∪ preview；「删除」= 现网有而写入后总库没有 → 恒为 0。
 *   管道不提供下线/删除能力，该需求属另行流程。 */
const to_delete = [];

console.log('  diff（old news.js × 15 vs delivery-preview × 10，写入后总库 25）：');
console.log('    新增 ' + to_add.length + ' 条：' + to_add.join(', '));
console.log('    修改 ' + to_update.length + ' 条：' + (to_update.join(', ') || '（无）'));
console.log('    一致 ' + unchanged.length + ' 条');
console.log('    删除 ' + to_delete.length + ' 条（追加写入，现网 15 条全部保留）');
/* 现网 supersedes 互链保护：010/014 不在本批 → 不被触及 */
const previewIds = conv.items.map(function (it) { return it.id; });
console.log('  现网 supersedes 互链保护：news-2026-09-20-010 / news-2026-09-19-014 ' +
  (previewIds.indexOf('news-2026-09-20-010') < 0 && previewIds.indexOf('news-2026-09-19-014') < 0
    ? '不在本批 → 保持原状 ✅' : '★ 被本批触及（需人工核查）'));

/* delivery-preview.json */
const previewDoc = {
  schema_version: '1.0',
  layer: 'L3-DELIVERY-PREVIEW',
  generated_at: NOW,
  nature: 'G7-5 写入模拟预览（预计写入 news.js 的数据）；未写入 h5/data/news.js',
  count: conv.items.length,
  diff: {
    existing_count: existing.length,
    preview_count: conv.items.length,
    to_add: to_add,
    to_update: to_update,
    unchanged: unchanged,
    to_delete_reported: to_delete,
    delete_semantics: '追加写入：现网 15 条全部保留，写入后总库 25 条；管道无删除语义，下线/归档属另行流程',
    supersedes_protection: '现网互链对 news-2026-09-20-010 ← news-2026-09-19-014 不在本批，保持原状'
  },
  review_summary: {
    decisions: histories.length,
    approved: approved.length,
    rejected: 1,
    modified: 1,
    operator: OPERATOR
  },
  items: conv.items
};
const pvPath = path.join(ROOT, 'workspace', 'news', 'pipeline', 'deliveries', '20260923.delivery-preview.json');
fs.writeFileSync(pvPath, JSON.stringify(previewDoc, null, 2), 'utf8');
console.log('\n  写入预览：' + pvPath);

/* SHA256 终检 */
const SHA_AFTER = sha256(NEWS_JS);
console.log('\n  news.js SHA256：' + (SHA_AFTER === SHA_BEFORE ? '未变 ✅' : '★ 已变化 ❌') +
  '（' + SHA_BEFORE.slice(0, 16) + '…）');
if (SHA_AFTER !== SHA_BEFORE) process.exitCode = 1;
console.log('\n============================================================');
console.log('G7 模拟编排完成。');
console.log('============================================================');
