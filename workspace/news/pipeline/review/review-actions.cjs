/* ============================================================
 * 人工审核动作（G7-2 / G7-3）
 * ------------------------------------------------------------
 * 三种动作（任务书 §G7-2）：
 *   approve —— gate_status → 'approved'，进入 Delivery 转换资格；
 *   reject  —— gate_status → 'rejected'，**原因必填**，不进入 Delivery；
 *   modify  —— 修改 AI 七字段（title/summary/category/related_×3/
 *              phases），**不覆盖原始 AI 结果**（原始 ai-results 文件
 *              不动；修改以 history 的 before/after 留痕 + 返回新候选），
 *              修改后 event_key/candidate_id 重算（字段变化驱动）。
 *
 * 审核日志（G7-3）：追加式 review-history.json 条目：
 *   { review_id, event_id, operator, action, before, after, reason, created_at }
 *   review_id = rev-YYYYMMDD-NNN（调用方维护计数器）。
 *
 * 纪律：
 *   1. 动作只由人工决策驱动；本模块不做任何自动判断；
 *   2. reject 无原因 → REASON_REQUIRED（fail closed）；
 *   3. modify 不得触碰状态字段/管道字段（白名单同 ai-normalizer）；
 *   4. 输入候选不被就地修改（返回新对象，可追溯）。
 * ============================================================ */
'use strict';

const SIG = require('../gate/event-signature-normalizer.cjs');
const CI = require('../candidate-item.cjs');

const LAYER = 'REVIEW-ACTIONS';
const SCHEMA_VERSION = '1.0';

const ACTIONS = Object.freeze(['approve', 'reject', 'modify']);

/* modify 允许修改的字段 = AI 七字段（与 ai-normalizer 白名单一致，去掉 ai_model） */
const MODIFY_ALLOWED = Object.freeze([
  'title', 'summary', 'category',
  'related_movies', 'related_series', 'related_characters', 'related_phases'
]);

function fail(code, message) {
  const e = new Error('[' + code + '] ' + message);
  e.code = code;
  throw e;
}

/**
 * 应用一条审核决策。
 * @param {object} candidate 队列来源候选（35 字段；gate_status 任意当前值）
 * @param {object} decision { action, reason, operator, modifications, reviewSeq, now }
 *   modifications 仅 modify 时有效：{title?, summary?, category?, related_*?}
 * @returns {{candidate, history}} 新候选（未改动输入）+ 日志条目
 */
function applyDecision(candidate, decision) {
  const d = decision || {};
  if (ACTIONS.indexOf(d.action) < 0) fail('UNKNOWN_ACTION', '未知审核动作：' + String(d.action));
  if (!candidate || typeof candidate !== 'object') fail('CANDIDATE_INVALID', '审核对象不是候选');
  if (!d.operator || !String(d.operator).trim()) fail('OPERATOR_REQUIRED', '缺少 operator（审核人）');

  const now = d.now || new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  const before = {
    gate_status: candidate.gate_status,
    title: candidate.title,
    category: candidate.category
  };
  let out = candidate;

  if (d.action === 'approve') {
    out = Object.assign({}, candidate, { gate_status: 'approved' });
  } else if (d.action === 'reject') {
    if (!d.reason || !String(d.reason).trim()) fail('REASON_REQUIRED', 'reject 必须附原因');
    out = Object.assign({}, candidate, { gate_status: 'rejected' });
  } else {
    /* modify */
    const mods = d.modifications || {};
    const keys = Object.keys(mods);
    if (!keys.length) fail('MODIFY_EMPTY', 'modify 未提供任何修改内容');
    keys.forEach(function (k) {
      if (MODIFY_ALLOWED.indexOf(k) < 0) {
        fail('MODIFY_FIELD_FORBIDDEN', 'modify 不允许修改字段：' + k + '（AI 整理层七字段之外一律禁止）');
      }
    });
    const patched = Object.assign({}, candidate);
    keys.forEach(function (k) { patched[k] = mods[k]; });
    /* category 若被修改需仍为枚举值；文本字段走 CI 校验兜底（见下） */
    if (mods.category !== undefined && CI.CATEGORIES.indexOf(mods.category) < 0) {
      fail('INVALID_CATEGORY', 'modify 的 category 非 6 值枚举：' + mods.category);
    }
    /* 字段变化 → key/id 重算（同 G6 签名语义：original 内容已变） */
    const re = SIG.rekey(patched, { seq: Number(d.reviewSeq) || 1 });
    out = re.candidate;
  }

  /* 输出必须是合法 L1（approve/reject/modify 三路统一兜底） */
  const v = CI.validate(out);
  if (!v.pass) {
    fail('RESULT_INVALID', '决策结果未通过 L1 校验：' + JSON.stringify(v.issues.slice(0, 3)));
  }

  const history = {
    review_id: d.reviewId || null,             /* 由调用方按 rev-YYYYMMDD-NNN 赋值 */
    event_id: out.event_key,
    candidate_id: out.candidate_id,
    operator: String(d.operator),
    action: d.action,
    before: before,
    after: { gate_status: out.gate_status, title: out.title, category: out.category },
    modifications: d.action === 'modify' ? (d.modifications || {}) : undefined,
    reason: d.reason || '',
    created_at: now
  };
  return { candidate: out, history: history };
}

module.exports = { LAYER, SCHEMA_VERSION, ACTIONS, MODIFY_ALLOWED, applyDecision };
