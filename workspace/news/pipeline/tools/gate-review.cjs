/* ============================================================
 * 人工审核 CLI（G6 闸门操作工具）· gate-review.cjs
 * ------------------------------------------------------------
 * 定位：资讯每日人工审核的唯一操作入口。
 *   决策产生一律经 review/review-actions.cjs（applyDecision），
 *   结果一律经 gate/gate.cjs（GATE.review）复核——**禁止绕过 G6**。
 *
 * 用法：
 *   node tools/gate-review.cjs list pending [--date 20261012] [--dir <candidates目录>]
 *   node tools/gate-review.cjs approve <candidate_id> --operator <审核人> [--date ...] [--dir ...]
 *   node tools/gate-review.cjs reject  <candidate_id> --reason <原因> --operator <审核人> [--date ...] [--dir ...]
 *
 * 纪律（硬规则）：
 *   1. 本工具**不产生任何自动决策**——approve/reject 必须由人显式输入；
 *   2. reject 无原因 → 拒绝执行（review-actions fail closed）；
 *   3. 只改 gate_status（经 applyDecision），不改任何业务字段、不碰 L0/L2；
 *   4. 不写 news.js、不产 delivery、不调 run-g9-write（发布在 SOP 单独授权）；
 *   5. 归档写回采用原子写（tmp + rename），review-history.json 追加式留痕。
 *
 * 退出码：0 成功 / 1 运行或校验失败 / 2 参数错误
 * ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');

const PIPELINE = path.resolve(__dirname, '..');
const CandS = require(path.join(PIPELINE, 'candidate-store.cjs'));       /* L1 归档读写（现有） */
const RA = require(path.join(PIPELINE, 'review', 'review-actions.cjs')); /* 审核决策（现有 G7-2/G7-3） */
const GATE = require(path.join(PIPELINE, 'gate', 'gate.cjs'));           /* G6 闸门（现有） */
const SM = require(path.join(PIPELINE, 'status', 'status-machine.cjs')); /* P1-A 状态层（现有，读 analysis） */

const REVIEW_HISTORY = 'review-history.json';

function fail(code, message, exitCode) {
  const e = new Error('[' + code + '] ' + message);
  e.code = code;
  e._exit = exitCode || 1;
  throw e;
}

function parseArgs(argv) {
  const a = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (t === '--date') a.date = argv[++i];
    else if (t === '--dir') a.dir = argv[++i];
    else if (t === '--operator') a.operator = argv[++i];
    else if (t === '--reason') a.reason = argv[++i];
    else if (t === '--json') a.json = true;
    else a._.push(t);
  }
  return a;
}

function todayCompact() { return new Date().toISOString().slice(0, 10).replace(/-/g, ''); }
function nowIso() { return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'); }

/* ---------- review-history（追加式，rev-YYYYMMDD-NNN） ---------- */

function historyPath(dir) { return path.join(dir, REVIEW_HISTORY); }

function readHistory(dir) {
  const f = historyPath(dir);
  if (!fs.existsSync(f)) return { file: f, entries: [] };
  try {
    const doc = JSON.parse(fs.readFileSync(f, 'utf8'));
    return { file: f, entries: Array.isArray(doc.entries) ? doc.entries : [] };
  } catch (e) {
    fail('HISTORY_CORRUPT', '审核历史无法解析，拒绝继续写入：' + f);
  }
}

function nextReviewId(entries, dateCompact) {
  const prefix = 'rev-' + dateCompact + '-';
  let max = 0;
  entries.forEach(function (h) {
    if (h && typeof h.review_id === 'string' && h.review_id.indexOf(prefix) === 0) {
      const n = parseInt(h.review_id.slice(prefix.length), 10);
      if (!isNaN(n) && n > max) max = n;
    }
  });
  return prefix + String(max + 1).padStart(3, '0');
}

function appendHistory(dir, entry) {
  const h = readHistory(dir);
  h.entries.push(entry);
  const tmp = h.file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify({ schema_version: '1.0', layer: 'REVIEW-HISTORY', entries: h.entries }, null, 2), 'utf8');
  fs.renameSync(tmp, h.file);
}

/* ---------- analysis 读取（P1-B：confidence 等同文档 analysis{}，只读） ---------- */

function loadAnalysisMap(dateCompact) {
  try {
    const f = path.join(PIPELINE, 'status', 'item-status', dateCompact + '.item-status.json');
    if (!fs.existsSync(f)) return {};
    const doc = JSON.parse(fs.readFileSync(f, 'utf8'));
    return (doc && typeof doc.analysis === 'object' && doc.analysis) || {};
  } catch (e) { return {}; }
}

/* ---------- 原子写回候选归档（tmp + rename，与 capture/candidate-store 同模式） ---------- */

function writeArchive(file, doc) {
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(doc, null, 2), 'utf8');
  fs.renameSync(tmp, file);
}

/* ---------- list pending ---------- */

function cmdList(a) {
  const date = a.date || todayCompact();
  const dir = a.dir || CandS.DEFAULT_DIR;
  const arc = CandS.readArchive({ dir: dir, date: date });
  if (!arc.exists) {
    console.log('当日候选归档不存在：' + arc.file + '（无 pending）');
    return;
  }
  const analysis = loadAnalysisMap(date);
  const pending = arc.candidates.filter(function (c) { return c.gate_status === 'pending'; });
  const counts = { pending: 0, approved: 0, rejected: 0 };
  arc.candidates.forEach(function (c) { counts[c.gate_status] = (counts[c.gate_status] || 0) + 1; });

  if (a.json) { console.log(JSON.stringify({ date: date, file: arc.file, total: arc.candidates.length, counts: counts, pending: pending }, null, 2)); return; }

  console.log('日期 ' + date + '  归档 ' + arc.file);
  console.log('候选总数 ' + arc.candidates.length + '（pending ' + (counts.pending || 0) + ' / approved ' + (counts.approved || 0) + ' / rejected ' + (counts.rejected || 0) + '）');
  if (!pending.length) { console.log('无 pending 候选。'); return; }
  console.log('');
  console.log(pad('candidate_id', 30) + pad('source', 16) + pad('conf', 6) + pad('verification', 22) + 'title');
  pending.forEach(function (c) {
    const an = analysis[c.candidate_id] || {};
    const conf = (typeof an.confidence === 'number') ? an.confidence.toFixed(2) : '-';
    const cred = an.credibility ? ' (' + an.credibility + ')' : '';
    console.log(
      pad(String(c.candidate_id), 30) +
      pad(String((c.reported_by && c.reported_by[0] && c.reported_by[0].source_name) || '-'), 16) +
      pad(conf, 6) +
      pad(String(c.ai_suggested_status || '-') + cred, 22) +
      String(c.title || '').slice(0, 40)
    );
  });
  console.log('');
  console.log('共 ' + pending.length + ' 条待审核。审核命令：approve <candidate_id> / reject <candidate_id> --reason <原因>');
}

function pad(s, n) { s = String(s); while (s.length < n) s += ' '; return s.slice(0, n) + ' '; }

/* ---------- approve / reject（决策经 RA，结果经 GATE 复核） ---------- */

function decide(a, action) {
  const id = a._[1];
  if (!id) fail('ARG_MISSING', '缺少 candidate_id', 2);
  if (!a.operator || !a.operator.trim()) fail('OPERATOR_REQUIRED', '必须提供 --operator <审核人>', 2);
  if (action === 'reject' && (!a.reason || !a.reason.trim())) fail('REASON_REQUIRED', 'reject 必须提供 --reason <原因>', 2);

  const date = a.date || todayCompact();
  const dir = a.dir || CandS.DEFAULT_DIR;
  const arc = CandS.readArchive({ dir: dir, date: date });
  if (!arc.exists) fail('ARCHIVE_NOT_FOUND', '当日候选归档不存在：' + arc.file);

  const idx = arc.candidates.findIndex(function (c) { return c.candidate_id === id; });
  if (idx < 0) fail('CANDIDATE_NOT_FOUND', '归档中无此 candidate_id：' + id + '（' + arc.file + '）');

  const cur = arc.candidates[idx];
  if (cur.gate_status !== 'pending') {
    fail('ALREADY_DECIDED', '该候选已审核（当前 gate_status=' + cur.gate_status + '），不重复操作');
  }

  /* 1) 决策：一律经 review-actions（人工输入驱动，本工具不自动判断） */
  const r = RA.applyDecision(cur, {
    action: action,
    reason: action === 'reject' ? a.reason : '',
    operator: a.operator.trim(),
    reviewId: nextReviewId(readHistory(dir).entries, date),
    now: nowIso()
  });

  /* 2) G6 复核：决策结果必须经 gate.review 过滤验证（fail closed） */
  const g = GATE.review([r.candidate]);
  if (action === 'approve' && g.approved.length !== 1) {
    fail('GATE_REJECTED', 'G6 复核未通过，决策作废：' + JSON.stringify(g.rejected[0] && g.rejected[0].reason));
  }

  /* 3) 原子写回归档 + 追加审核历史 */
  arc.candidates[idx] = r.candidate;
  const doc = { schema_version: '1.1', layer: 'L1', candidates: arc.candidates };
  writeArchive(arc.file, doc);
  appendHistory(dir, r.history);

  if (a.json) {
    console.log(JSON.stringify({ action: action, candidate_id: id, review_id: r.history.review_id, gate_status: r.candidate.gate_status, history_file: historyPath(dir) }, null, 2));
  } else {
    console.log(action === 'approve' ? '已通过（approved）' : '已驳回（rejected）');
    console.log('  candidate_id : ' + id);
    console.log('  review_id    : ' + r.history.review_id);
    console.log('  操作人       : ' + a.operator.trim());
    if (action === 'reject') console.log('  原因         : ' + a.reason.trim());
    console.log('  G6 复核      : ' + (action === 'approve' ? 'PASS（进入 Delivery 转换资格）' : 'PASS（rejected 桶）'));
    console.log('  留痕         : ' + historyPath(dir));
  }
}

/* ---------- decisions：导出已 approved 候选的 decisions 文件（delivery-preview 输入） ---------- */

function cmdDecisions(a) {
  const date = a.date || todayCompact();
  const dir = a.dir || CandS.DEFAULT_DIR;
  const arc = CandS.readArchive({ dir: dir, date: date });
  if (!arc.exists) fail('ARCHIVE_NOT_FOUND', '当日候选归档不存在：' + arc.file);
  const decisions = arc.candidates
    .filter(function (c) { return c.gate_status === 'approved'; })
    .map(function (c) { return { candidate_id: c.candidate_id, action: 'approve' }; });
  console.log(JSON.stringify(decisions, null, 2));
  if (!decisions.length) console.error('（无 approved 候选，decisions 为空数组）');
}

/* ---------- main ---------- */

async function main() {
  const a = parseArgs(process.argv.slice(2));
  const cmd = a._[0];
  if (cmd === 'list' && a._[1] === 'pending') { cmdList(a); return; }
  if (cmd === 'decisions') { cmdDecisions(a); return; }
  if (cmd === 'approve') { decide(a, 'approve'); return; }
  if (cmd === 'reject') { decide(a, 'reject'); return; }
  console.error('用法：');
  console.error('  node tools/gate-review.cjs list pending [--date 20261012] [--dir <candidates目录>]');
  console.error('  node tools/gate-review.cjs decisions [--date ...] [--dir ...]   # 导出 approved 决策（delivery 输入）');
  console.error('  node tools/gate-review.cjs approve <candidate_id> --operator <审核人> [--date ...] [--dir ...]');
  console.error('  node tools/gate-review.cjs reject  <candidate_id> --reason <原因> --operator <审核人> [--date ...] [--dir ...]');
  process.exit(2);
}

main().catch(function (e) {
  console.error('失败：' + (e && e.message));
  process.exit(e && e._exit ? e._exit : 1);
});
