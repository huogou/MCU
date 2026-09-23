/* ============================================================
 * G9 · 首次生产写入编排（append-only；任何检查 FAIL 即终止不写）
 * ------------------------------------------------------------
 * 运行：node workspace/news/pipeline/review/run-g9-write.cjs
 * 确认链（D-1）：G8 review-result（20 条 approve 建议草案）→
 *   负责人发出《G9 首次生产写入任务书》= 对草案的执行确认。
 * Phase 1  G9-1 写入前检查（全 PASS 才继续）：
 *   1.1 负责人审核记录存在（review-result 20 approve）
 *   1.2 重建批次 → 1.3 Gate 重校验（20 approved）→ 1.4 T6 模拟
 * Phase 2  G9-2 生产备份（G8 备份校验 + g9 副本双保险）+ 旧 SHA 记录
 * Phase 3  G9-3 文本级追加写入（旧 15 条字节级不变）
 * Phase 4  G9-4 SHA256 + news-write-report.json + vm 重载断言
 * ★ 幂等守卫：若 news.js 已非 G8 基线（重复运行），拒绝执行。
 * ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const vm = require('vm');

const LOG_PATH = path.join(__dirname, 'out-g9-write.txt');
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
const G8_BASELINE_SHA = '589A39347EF6BEEA682D0102CE8C078EBA3900EB1C7BE9698DC545B1270242F2';
const NOW = '2026-09-23T00:00:00Z';
const OPERATOR = 'simulated-g7-reviewer';

function sha(s) { return crypto.createHash('sha256').update(s).digest('hex').toUpperCase(); }
function die(msg) { console.log('\n★★ 终止：' + msg); process.exit(1); }

console.log('============================================================');
console.log('G9 首次生产写入（append-only）');
console.log('============================================================');

/* ---------------- Phase 0 · 幂等守卫 ---------------- */
const rawBefore = fs.readFileSync(NEWS_JS, 'utf8');
const shaBefore = sha(rawBefore);
console.log('当前 news.js SHA256 = ' + shaBefore);
if (shaBefore !== G8_BASELINE_SHA) {
  die('news.js 已非 G8 基线（可能已写入过），拒绝重复执行（幂等守卫）');
}
console.log('幂等守卫通过：当前仍为 G8 基线（589A3934…），可执行首次写入');

/* ---------------- Phase 1 · G9-1 写入前检查 ---------------- */
console.log('\n■ Phase 1 · G9-1 写入前检查');

/* 1.1 负责人审核记录（确认链） */
const rr = JSON.parse(fs.readFileSync(path.join(__dirname, 'review-result-20260923.json'), 'utf8'));
const approves = rr.results.filter(function (r) { return r.action === 'approve'; });
if (rr.count !== 133 || approves.length !== 20) die('G8 建议草案数量异常');
console.log('1.1 确认链：G8 建议草案 133 条（approve 20）+ 负责人《G9 任务书》执行确认 ✅');

/* 1.2 重建批次（与 G8 相同路径：队列 → 20 approve → 动作链） */
const RQ = require('./review-queue.cjs');
const RA = require('./review-actions.cjs');
const AIOUT = require('../ai-normalizer/output/20260923.json');
const q = RQ.buildQueue(AIOUT.candidates, { date: '20260923', generated_at: NOW });
const approvedTitles = new Set(approves.map(function (r) { return r.title; }));
const batch = [];
q.doc.entries.forEach(function (e) {
  if (!approvedTitles.has(e.title)) return;
  const c = q.signed.find(function (x) { return x.candidate_id === e.candidate_id; });
  const r = RA.applyDecision(c, {
    action: 'approve', operator: OPERATOR, now: NOW,
    reason: 'G8 建议草案经负责人《G9 任务书》确认（首批写入）'
  });
  batch.push(r.candidate);
});
if (batch.length !== 20) die('重建批次数量异常：' + batch.length);
console.log('1.2 重建批次 = 20 条 ✅');

/* 1.3 Gate 重校验 */
const GATE = require('../gate/gate.cjs');
const gate = GATE.review(batch, {});
if (gate.stats.approved !== 20 || gate.stats.rejected !== 0) die('Gate 重校验未通过：' + JSON.stringify(gate.stats));
console.log('1.3 Gate 重校验：approved=20 / rejected=0 ✅');

/* 1.4 T6 模拟检查 */
const DC = require('../delivery/delivery-converter.cjs');
const conv = DC.toDeliveries(gate.approved, { now: NOW });
if (conv.items.length !== 20 || !conv.items.every(function (it) { return Object.keys(it).length === 33; })) {
  die('DeliveryItem 校验未通过');
}
const ctx = {};
ctx.window = ctx; ctx.global = ctx; ctx.console = console;
ctx.URL = URL; ctx.Date = Date; ctx.Math = Math; ctx.JSON = JSON;
vm.createContext(ctx);
vm.runInContext(rawBefore, ctx, { filename: 'news.js' });
const existing = ctx.window.MCU_NEWS || [];
const existingById = {};
existing.forEach(function (n) { existingById[n.id] = n; });
if (existing.length !== 15) die('现网条数异常：' + existing.length);
const to_add = [], to_update = [];
conv.items.forEach(function (it) {
  if (!existingById[it.id]) { to_add.push(it.id); return; }
  to_update.push(it.id);
});
if (to_add.length !== 20 || to_update.length !== 0) die('T6 模拟 diff 异常：新增 ' + to_add.length + ' 修改 ' + to_update.length);
/* 契约抽检：id 零冲突 + related 命中（复用 preview coverage 结论，此处独立复核 id） */
console.log('1.4 T6 模拟检查：新增 20 / 修改 0 / 删除 0（追加），id 零冲突 ✅');
console.log('Phase 1 全部 PASS → 进入写入');

/* ---------------- Phase 2 · G9-2 生产备份 ---------------- */
console.log('\n■ Phase 2 · G9-2 生产备份');
const bdir = path.join(__dirname, 'backup');
const g8Backup = path.join(bdir, 'news.js.20260923');
if (!fs.existsSync(g8Backup) || sha(fs.readFileSync(g8Backup)) !== shaBefore) {
  die('G8 备份缺失或不一致，拒绝写入');
}
const g9Backup = path.join(bdir, 'news.js.20260923-g9');
fs.copyFileSync(NEWS_JS, g9Backup);
if (sha(fs.readFileSync(g9Backup)) !== shaBefore) die('G9 备份副本校验失败');
console.log('  双保险备份：' + g8Backup + '（G8）+ ' + g9Backup + '（G9）');
console.log('  旧 SHA256 已记录：' + shaBefore);

/* ---------------- Phase 3 · G9-3 文本级追加写入 ---------------- */
console.log('\n■ Phase 3 · G9-3 追加写入（文本级插入）');

/* 序列化器：对齐现网风格（单引号 / 2 空格缩进 / 组间空行） */
function jsStr(s) { return "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'"; }
function jsVal(v, ind) {
  const pad = '  '.repeat(ind);
  const padIn = '  '.repeat(ind + 1);
  if (v === null) return 'null';
  if (typeof v === 'string') return jsStr(v);
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) {
    if (v.length === 0) return '[]';
    if (v.every(function (x) { return x === null || ['string', 'number', 'boolean'].indexOf(typeof x) >= 0; })) {
      return '[\n' + v.map(function (x) { return padIn + '  ' + jsVal(x, ind + 1); }).join(',\n') + '\n' + padIn + ']';
    }
    return '[\n' + v.map(function (x) { return padIn + '  ' + jsVal(x, ind + 1); }).join(',\n') + '\n' + padIn + ']';
  }
  const keys = Object.keys(v);
  return '{\n' + keys.map(function (k) { return padIn + '  ' + k + ': ' + jsVal(v[k], ind + 1); }).join(',\n') + '\n' + pad + '}';
}
function serializeItem(it) {
  return '  ' + jsVal(it, 1).replace(/^\{/, '{');
}

/* 20 条文本（键序 = 交付 33 字段规范序，status_history 结构与现网一致） */
const newItemsText = conv.items.map(function (it) {
  return serializeItem(it);
}).join(',\n\n');

/* 插入点：数组闭合 '\n];' 之前 —— 保留原 15 条全部字节 */
const insertAnchor = '\n];';
const anchorPos = rawBefore.lastIndexOf(insertAnchor);
if (anchorPos < 0) die('未找到数组闭合锚点');
/* 锚点前的最后一个非空白字符应为 '}'（最后一条的收尾） */
const tailObjEnd = rawBefore.lastIndexOf('}', anchorPos);
if (tailObjEnd < 0) die('未找到末条收尾');
const newText = rawBefore.slice(0, tailObjEnd + 1) + ',\n\n' + newItemsText + rawBefore.slice(anchorPos);

/* 字节级保证：新文件 = 旧前缀（至插入点）+ 插入 + 旧后缀 */
const oldPrefix = rawBefore.slice(0, tailObjEnd + 1);
const oldSuffix = rawBefore.slice(anchorPos);
if (!newText.startsWith(oldPrefix) || !newText.endsWith(oldSuffix)) die('字节级前缀/后缀校验失败');
console.log('  旧 15 条字节级不变：前缀 ' + oldPrefix.length + ' B + 插入 ' +
  (newText.length - oldPrefix.length - oldSuffix.length) + ' B + 后缀 ' + oldSuffix.length + ' B');

/* vm 预验证（写入前先在内存中验证新文本） */
function loadNews(text) {
  const c2 = {};
  c2.window = c2; c2.global = c2; c2.console = console;
  c2.URL = URL; c2.Date = Date; c2.Math = Math; c2.JSON = JSON;
  vm.createContext(c2);
  vm.runInContext(text, c2, { filename: 'news.js' });
  return c2.window.MCU_NEWS;
}
const previewNews = loadNews(newText);
if (previewNews.length !== 35) die('预验证条数异常：' + previewNews.length);
const oldById = {};
existing.forEach(function (n) { oldById[n.id] = JSON.stringify(n); });
let oldMutated = 0;
previewNews.forEach(function (n) {
  if (oldById[n.id] !== undefined && oldById[n.id] !== JSON.stringify(n)) oldMutated++;
});
if (oldMutated !== 0) die('旧 15 条在写入后发生变化：' + oldMutated);
const newIds = conv.items.map(function (it) { return it.id; });
if (!newIds.every(function (id) { return previewNews.some(function (n) { return n.id === id; }); })) {
  die('新 20 条未全部出现在写入结果中');
}
console.log('  vm 预验证：35 条 = 旧 15（零变化）+ 新 20（全部在场）✅');

/* 正式写入 */
fs.writeFileSync(NEWS_JS, newText, 'utf8');
console.log('  ✅ 已写入 h5/data/news.js（append-only）');

/* ---------------- Phase 4 · G9-4 写入后验证 ---------------- */
console.log('\n■ Phase 4 · G9-4 写入后验证');
const rawAfter = fs.readFileSync(NEWS_JS, 'utf8');
const shaAfter = sha(rawAfter);
const afterNews = loadNews(rawAfter);
if (afterNews.length !== 35) die('写入后条数异常');
let afterMutated = 0;
afterNews.forEach(function (n) {
  if (oldById[n.id] !== undefined && oldById[n.id] !== JSON.stringify(n)) afterMutated++;
});
if (afterMutated !== 0) die('写入后旧 15 条发生变化');
console.log('  新 SHA256 = ' + shaAfter);
console.log('  旧 15 条：零变化 ✅｜新 20 条：全部在场 ✅｜总库 35 条 ✅');

const report = {
  report: 'news-write-report',
  version: '1.0',
  generated_at: NOW,
  confirmation_chain: 'G8 review-result（20 approve 建议草案）→ 负责人《G9 首次生产写入任务书》= 执行确认',
  operator: 'dev-side (Jarvis) · 负责人授权：G9 任务书',
  old_hash: shaBefore,
  new_hash: shaAfter,
  added_count: 20,
  updated_count: 0,
  deleted_count: 0,
  total_after: 35,
  write_mode: 'append-only（文本级插入，旧 15 条字节级不变）',
  added_ids: newIds,
  backups: [g8Backup, g9Backup],
  verify: {
    old15_unchanged: true,
    new20_present: true,
    total_after: 35,
    vm_reload: true
  },
  note: '写入后 test-g6/test-g8 基线随总库演进更新（35 条），见 G9 报告 §基线演进'
};
const repPath = path.join(__dirname, 'news-write-report.json');
fs.writeFileSync(repPath, JSON.stringify(report, null, 2), 'utf8');
console.log('  写入报告：' + repPath);
console.log('\n============================================================');
console.log('G9 生产写入完成（Phase 1-4 全部 PASS）。');
console.log('============================================================');
