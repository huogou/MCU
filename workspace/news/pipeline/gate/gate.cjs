/* ============================================================
 * 审核闸门（G6 §一）· Gate 层
 * ------------------------------------------------------------
 * 定位：EventCandidate 流 → 人工审核决策 → **唯一转换入口**。
 * 规则（唯一、刚性）：
 *   只有 gate_status === 'approved' 的候选才能进入 DeliveryItem 转换；
 *   pending / rejected / 非法候选一律进 rejected 桶（附 reason）。
 *
 * 三条纪律：
 *   1. **Gate 不产生审核决策** —— 谁批准是人的职责（产品流程）；
 *      本层只按既有 gate_status 过滤，绝不自动把 pending 升为 approved。
 *   2. **纯过滤，不改候选** —— 输入候选原样透传（approved 桶内对象
 *      与输入同一引用，便于追溯）。
 *   3. **supersedes 关系显式输入** —— {new, old}（candidate_id 体系）
 *      由审核决策随行提供；Gate 只校验引用完整性（fail closed），
 *      转换器负责回填。
 * ============================================================ */
'use strict';

const CI = require('../candidate-item.cjs');

const LAYER = 'GATE';
const SCHEMA_VERSION = '1.0';

const GATE_STATUSES = Object.freeze(['pending', 'approved', 'rejected']);

function review(candidates, opts) {
  opts = opts || {};
  const list = Array.isArray(candidates) ? candidates : [];

  const approved = [], rejected = [];
  list.forEach(function (c) {
    if (!c || typeof c !== 'object') {
      rejected.push({ reason: 'INVALID_CANDIDATE', candidate: null });
      return;
    }
    /* 先验闸门状态值（闸门视角），再验候选整体合法性——两道独立防线 */
    if (GATE_STATUSES.indexOf(c.gate_status) < 0) {
      rejected.push({ reason: 'UNKNOWN_GATE_STATUS: ' + String(c.gate_status), candidate: c });
      return;
    }
    const v = CI.validate(c);
    if (!v.pass) {
      rejected.push({ reason: 'CANDIDATE_INVALID: ' + JSON.stringify(v.issues.slice(0, 2)), candidate: c });
      return;
    }
    if (c.gate_status === 'approved') approved.push(c);
    else rejected.push({ reason: 'gate_status=' + c.gate_status, candidate: c });
  });

  /* supersedes 引用完整性（fail closed：引用不在 approved 集合即抛错） */
  const supersedes = Array.isArray(opts.supersedes) ? opts.supersedes : [];
  const approvedIds = new Set(approved.map(function (c) { return c.candidate_id; }));
  supersedes.forEach(function (s) {
    if (!s || !s.new || !s.old) {
      const e = new Error('[SUPERSEDES_MALFORMED] supersedes 关系缺 new/old：' + JSON.stringify(s));
      e.code = 'SUPERSEDES_MALFORMED';
      throw e;
    }
    if (!approvedIds.has(s.new) || !approvedIds.has(s.old)) {
      const e = new Error('[SUPERSEDES_REF_NOT_APPROVED] supersedes 引用的候选未通过闸门：' +
        JSON.stringify(s) + '（supersedes 双条必须同时获批，不允许只批准其一）');
      e.code = 'SUPERSEDES_REF_NOT_APPROVED';
      throw e;
    }
  });

  return {
    approved: approved,
    rejected: rejected,
    supersedes: supersedes,
    stats: {
      input: list.length,
      approved: approved.length,
      rejected: rejected.length,
      supersedes_pairs: supersedes.length
    }
  };
}

module.exports = { LAYER, SCHEMA_VERSION, GATE_STATUSES, review };
