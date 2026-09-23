/* ============================================================
 * 审核队列生成器（G7-1）
 * ------------------------------------------------------------
 * 输入：AI 增强候选（pipeline\ai-normalizer\output\YYYYMMDD.json）
 *       → 签名重算（G6 §四，管道顺序：增强 → 签名 → Gate）
 *       → **审核友好投影**（人工可读字段，不含任何状态字段）。
 * 输出：review-queue-YYYYMMDD.json
 *
 * 硬规则：
 *   1. 队列条目 gate_status 一律 **pending**（禁止自动 approved）；
 *   2. 投影只读原始候选，不修改管道数据；
 *   3. 完整性校验：输入 N 条 → 队列 N 条，0 丢失 0 新增。
 * ============================================================ */
'use strict';

const SIG = require('../gate/event-signature-normalizer.cjs');

const LAYER = 'REVIEW-QUEUE';
const SCHEMA_VERSION = '1.0';

function fail(code, message) {
  const e = new Error('[' + code + '] ' + message);
  e.code = code;
  throw e;
}

/**
 * 构建审核队列。
 * @param {Array} enhancedCandidates AI 增强候选（35 字段）
 * @param {object} opts { date:'YYYYMMDD', generated_at }
 * @returns {{doc, byTitle}} doc=队列文档；byTitle=title→条目索引（选样用）
 */
function buildQueue(enhancedCandidates, opts) {
  opts = opts || {};
  const list = Array.isArray(enhancedCandidates) ? enhancedCandidates : [];
  if (!list.length) fail('EMPTY_INPUT', '审核队列输入为空');

  /* 签名重算（与真实管道一致：event_key 不依赖单一 AI 标题） */
  const re = SIG.rekeyAll(list, {});
  const signed = re.candidates;

  const entries = signed.map(function (c, i) {
    return {
      queue_seq: i + 1,
      candidate_id: c.candidate_id,
      event_key: c.event_key,
      title: c.title,
      summary: c.summary,
      category: c.category,
      related_entities: {
        movies: c.related_movies,
        series: c.related_series,
        characters: c.related_characters,
        phases: c.related_phases
      },
      source: c.reported_by,
      capture_refs: c.capture_refs,
      gate_status: 'pending'                        /* ← 禁止自动 approved */
    };
  });

  const doc = {
    schema_version: SCHEMA_VERSION,
    layer: LAYER,
    date: opts.date || new Date().toISOString().slice(0, 10).replace(/-/g, ''),
    generated_at: opts.generated_at || new Date().toISOString(),
    input_count: list.length,
    count: entries.length,
    note: '审核队列：全部 pending，等待人工审核（approve/reject/modify）；'
      + 'event_key 为签名重算值；本队列不产生任何审核决策',
    mappings_signature: re.mappings,
    entries: entries
  };

  if (doc.input_count !== doc.count) fail('QUEUE_COUNT_MISMATCH', '队列条数与输入不符');
  entries.forEach(function (e) {
    if (e.gate_status !== 'pending') fail('AUTO_APPROVED_FORBIDDEN', '队列出现非 pending 条目：' + e.candidate_id);
  });

  const byTitle = {};
  entries.forEach(function (e) { byTitle[e.title] = e; });
  return { doc: doc, byTitle: byTitle, signed: signed, mappings: re.mappings };
}

module.exports = { LAYER, SCHEMA_VERSION, buildQueue };
