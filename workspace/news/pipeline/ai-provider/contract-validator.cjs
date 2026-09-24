/* ============================================================
 * N1.1 · AI Provider 标准输出契约校验器（Contract Validator）
 * ------------------------------------------------------------
 * 职责：对 AI Provider Adapter 产出的「标准 7 字段结果」做严格契约校验。
 *   - 字段集合封闭（恰 7 个，不允许 Provider 自行增加业务字段）
 *   - 未知字段 → 抛 FORBIDDEN_FIELD（不静默接受、不静默丢弃后当作成功）
 *   - 缺失必填 / 空字符串 → 抛 MISSING_FIELD
 *   - 类型错误 → 抛 TYPE_ERROR
 *   - 校验失败不得进入后续生产持久化链路（由调用方负责拦截）
 *   - 不修改原始输入（返回隔离副本）
 *
 * 与既有数据契约的关系（只读参照，未修改任何冻结模块）：
 *   - 7 字段 = ai-normalizer(G5.5) AI_ALLOWED_FIELDS 去掉 ai_model
 *   - title/summary/category 非空字符串、related_* 为 array：沿用 G5.5 既有契约
 *   - category 6 值枚举、related_phases 整数 1–6：属 G5.5 下游规则，不在本层重复
 *     （避免耦合/越界；若需在本层加严，列为待决策，见 N1.1 报告）
 * ============================================================ */
'use strict';

/* 封闭 7 字段集合（N1.1 唯一输出契约） */
const FIELDS = Object.freeze([
  'title', 'summary', 'category',
  'related_movies', 'related_series', 'related_characters', 'related_phases'
]);
const STRING_FIELDS = Object.freeze(['title', 'summary', 'category']);
const ARRAY_FIELDS = Object.freeze([
  'related_movies', 'related_series', 'related_characters', 'related_phases'
]);

function fail(code, message) {
  const e = new Error('[' + code + '] ' + message);
  e.code = code;
  throw e;
}

/**
 * 校验 AI Provider 标准输出。
 * @param {object} result AI Provider 产出的原始/标准结果
 * @returns {object} 校验通过的隔离副本（不修改入参）
 * @throws FORBIDDEN_FIELD | MISSING_FIELD | TYPE_ERROR | RESULT_INVALID
 */
function validate(result) {
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    fail('RESULT_INVALID', 'AI Provider 标准输出必须是普通对象');
  }

  /* 1) 未知字段 → FORBIDDEN_FIELD（越权字段，必须显式拒绝） */
  const unknown = Object.keys(result).filter(function (k) {
    return FIELDS.indexOf(k) < 0;
  });
  if (unknown.length) {
    fail('FORBIDDEN_FIELD',
      'AI Provider 输出含 7 字段契约之外的越权字段：' + unknown.join(', '));
  }

  /* 2) 缺失必填字段 → MISSING_FIELD */
  const missing = FIELDS.filter(function (f) { return !(f in result); });
  if (missing.length) {
    fail('MISSING_FIELD', 'AI Provider 输出缺失必填字段：' + missing.join(', '));
  }

  /* 3) 类型校验（严格，不为了通过而放宽） */
  STRING_FIELDS.forEach(function (f) {
    const v = result[f];
    if (typeof v !== 'string') {
      fail('TYPE_ERROR', '字段 ' + f + ' 必须为 string，实际 ' + typeof v);
    }
    if (v.trim() === '') {
      /* 沿用 G5.5 既有契约：title/summary/category 为必填非空字符串 */
      fail('MISSING_FIELD', '字段 ' + f + ' 不得为空字符串（既有契约必填）');
    }
  });
  ARRAY_FIELDS.forEach(function (f) {
    if (!Array.isArray(result[f])) {
      fail('TYPE_ERROR', '字段 ' + f + ' 必须为 array，实际 ' + typeof result[f]);
    }
  });

  /* 4) 通过：返回隔离副本，绝不修改原始输入 */
  return Object.assign({}, result);
}

module.exports = {
  FIELDS: FIELDS,
  STRING_FIELDS: STRING_FIELDS,
  ARRAY_FIELDS: ARRAY_FIELDS,
  validate: validate
};
