/* ============================================================
 * AI 整理层（G5.5）· CandidateItem 增强接口
 * ------------------------------------------------------------
 * 定位：把「桩版 L1 候选」（G5.4，title/category/实体为占位）
 *       与「AI 整理结果」合成为 **CandidateItem 增强版**。
 * 性质：纯函数、零网络。★ AI 结果由调用方以结构化对象传入
 *       （本轮 = 会话内 LLM 逐条整理并落盘为 ai-results 数据文件；
 *         生产化时的自动模型通道是 G6 前的独立决策，不在本模块）。
 *
 * 任务书边界（G5.5 V1.0 §一）：
 *   允许生成：title / summary / category / related_movies /
 *             related_series / related_characters / related_phases
 *   禁止生成：verification_status / judged_by / status_history
 *             （+ L1 层全部既有禁止字段，同 candidate-item.cjs 口径）
 *
 * 三条硬规则：
 *   1. 输出恰为 **35 字段**（L1 规范字段集，不增不减不改名）；
 *   2. event_key / candidate_id **必须重算**（实体/分类变化 →
 *      key 变化 → id 随之重算；旧→新 id 映射由调用方在外层文档留档）；
 *   3. related_* 一律经 idSpace 白名单交集（未命中真实 id 丢弃）。
 * ============================================================ */
'use strict';

const CI = require('../candidate-item.cjs');
const EK = require('../../engine/dedup/event-key.cjs');

const LAYER = 'L1-AI';
const SCHEMA_VERSION = '1.0';

/* AI 结果允许携带的字段（任务书 §一「允许生成」+ ai_model 标识） */
const AI_ALLOWED_FIELDS = Object.freeze([
  'title', 'summary', 'category',
  'related_movies', 'related_series', 'related_characters', 'related_phases',
  'ai_model'
]);

function fail(code, message) {
  const e = new Error('[' + code + '] ' + message);
  e.code = code;
  throw e;
}

/** AI 结果内不得出现任何禁止字段（9 项状态 + 交付物独有 + 白名单外） */
function assertCleanAiResult(ai) {
  if (!ai || typeof ai !== 'object') fail('AI_RESULT_INVALID', 'AI 整理结果不是对象');
  Object.keys(ai).forEach(function (k) {
    if (AI_ALLOWED_FIELDS.indexOf(k) < 0) {
      fail('FORBIDDEN_FIELD', 'AI 整理结果携带白名单之外的字段：' + k);
    }
  });
  CI.LAYER_FORBIDDEN_KEYS.forEach(function (k) {
    if (k in ai) fail('FORBIDDEN_FIELD', 'AI 整理结果不得生成字段：' + k);
  });
  return true;
}

/**
 * 增强单条候选。
 * @param {object} candidate 桩版 L1（35 字段，须先通过 CI.validate）
 * @param {object} ai        AI 整理结果（AI_ALLOWED_FIELDS 子集；title/summary/category/ai_model 必填）
 * @param {object} opts      { idSpace:{content,character}, seq }
 * @returns {object} 增强版 L1（恰 35 字段）
 */
function normalize(candidate, ai, opts) {
  opts = opts || {};
  assertCleanAiResult(ai);

  /* 0) 输入必须是合法 L1 */
  const v0 = CI.validate(candidate);
  if (!v0.pass) {
    fail('CANDIDATE_INVALID', '输入候选不合法：' + JSON.stringify(v0.issues.slice(0, 3)));
  }

  /* 1) 必填字段（对齐 fromRawCapture 必填语义） */
  ['title', 'summary', 'category', 'ai_model'].forEach(function (k) {
    if (typeof ai[k] !== 'string' || !ai[k].trim()) {
      fail('MISSING_FIELD', 'AI 整理结果缺少必填字段：' + k + '（candidate=' + candidate.candidate_id + '）');
    }
  });

  /* 2) 纯文本纪律 */
  const mkT = CI.findMarkup(ai.title);
  if (mkT) fail('MARKUP_NOT_ALLOWED', 'AI title 含' + mkT + '（candidate=' + candidate.candidate_id + '）');
  const mkS = CI.findMarkup(ai.summary);
  if (mkS) fail('MARKUP_NOT_ALLOWED', 'AI summary 含' + mkS + '（candidate=' + candidate.candidate_id + '）');

  /* 3) category 枚举 */
  if (CI.CATEGORIES.indexOf(ai.category) < 0) {
    fail('INVALID_CATEGORY', 'AI category 非 6 值枚举：' + ai.category + '（candidate=' + candidate.candidate_id + '）');
  }

  /* 4) related_* 白名单交集（未命中真实 id 一律丢弃，静默） */
  const sp = opts.idSpace || null;
  const rm = CI.intersect(ai.related_movies, sp && sp.content);
  const rs = CI.intersect(ai.related_series, sp && sp.content);
  const rc = CI.intersect(ai.related_characters, sp && sp.character);
  const ph = (Array.isArray(ai.related_phases) ? ai.related_phases : [])
    .filter(function (p) { return Number.isInteger(p) && p >= 1 && p <= 6; });

  /* 5) event_key 重算（实体/分类变化驱动 key 变化） */
  const eventKey = EK.buildEventKey({
    title: String(ai.title),
    category: ai.category,
    related_movies: rm.kept,
    related_series: rs.kept,
    related_characters: rc.kept,
    publish_time: candidate.published_at || ''
  });

  /* 6) candidate_id 重算（id 由 key 派生，保持「id 可由内容推出」） */
  const seq = Number(opts.seq) || 1;
  const newId = 'cand-' + eventKey.slice(-8) + '-' + String(seq).padStart(3, '0');
  if (CI.DELIVERY_ID_RE.test(newId)) fail('DELIVERY_ID_FORBIDDEN', '候选层不得使用交付物 id 格式');

  /* 7) 合成增强版：七字段来自 AI，其余继承原候选 */
  const enhanced = Object.assign({}, candidate, {
    title: String(ai.title),
    summary: String(ai.summary),
    category: ai.category,
    related_movies: rm.kept,
    related_series: rs.kept,
    related_characters: rc.kept,
    related_phases: ph,
    event_key: eventKey,
    candidate_id: newId,
    ai_model: String(ai.ai_model)
  });

  /* 8) 输出契约自检：恰 35 字段 + L1 合法 */
  const keys = Object.keys(enhanced).sort();
  const want = CI.FIELDS.slice().sort();
  if (keys.join(',') !== want.join(',')) {
    fail('FIELD_SET_MISMATCH', '增强输出字段集不等于规范 35 字段\n实际：' + keys.join(','));
  }
  const v = CI.validate(enhanced);
  if (!v.pass) {
    fail('ENHANCED_INVALID', '增强输出未通过 L1 校验：' + JSON.stringify(v.issues.slice(0, 3)));
  }
  return enhanced;
}

/**
 * 批量增强：aiResults 以原 candidate_id 为键。
 * @returns {{candidates:Array, mappings:Array, discarded_ai:Array}}
 *   mappings: {from,to,changed_keys,dropped:{movies,series,characters}}
 *   discarded_ai: 未匹配到候选的 AI 结果键（多余输入，如实暴露）
 */
function normalizeAll(candidates, aiResults, opts) {
  opts = opts || {};
  const list = Array.isArray(candidates) ? candidates : [];
  const aiMap = aiResults && typeof aiResults === 'object' ? aiResults : {};
  const out = [], mappings = [];
  const usedKeys = Object.create(null);

  list.forEach(function (c, i) {
    const ai = aiMap[c.candidate_id];
    if (!ai) {
      /* 无 AI 结果的候选：保持原样（允许部分增强），但如实记录 */
      mappings.push({
        from: c.candidate_id, to: c.candidate_id, changed_keys: [],
        note: 'no_ai_result（未提供 AI 整理结果，原样保留）'
      });
      out.push(c);
      return;
    }
    usedKeys[c.candidate_id] = 1;
    const before = {
      title: c.title, category: c.category,
      related_movies: c.related_movies, related_series: c.related_series,
      related_characters: c.related_characters, related_phases: c.related_phases
    };
    const sp = opts.idSpace || null;
    const enhanced = normalize(c, ai, { idSpace: sp, seq: i + 1 });
    const changed = [];
    ['title', 'summary', 'category', 'related_movies', 'related_series',
      'related_characters', 'related_phases', 'ai_model', 'event_key', 'candidate_id']
      .forEach(function (k) {
        if (JSON.stringify(before[k] !== undefined ? before[k] : null) !==
          JSON.stringify(enhanced[k] !== undefined ? enhanced[k] : null)) changed.push(k);
      });
    mappings.push({
      from: c.candidate_id,
      to: enhanced.candidate_id,
      changed_keys: changed,
      dropped: {
        movies: (ai.related_movies || []).filter(function (x) { return enhanced.related_movies.indexOf(x) < 0; }),
        series: (ai.related_series || []).filter(function (x) { return enhanced.related_series.indexOf(x) < 0; }),
        characters: (ai.related_characters || []).filter(function (x) { return enhanced.related_characters.indexOf(x) < 0; })
      }
    });
    out.push(enhanced);
  });

  const discarded = Object.keys(aiMap).filter(function (k) { return !usedKeys[k]; });
  return { candidates: out, mappings: mappings, discarded_ai: discarded };
}

module.exports = {
  LAYER,
  SCHEMA_VERSION,
  AI_ALLOWED_FIELDS,
  assertCleanAiResult,
  normalize,
  normalizeAll
};
