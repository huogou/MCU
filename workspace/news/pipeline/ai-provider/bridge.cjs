/* ============================================================
 * N1.2 · ai_model 元数据桥接层（bridge）
 * ------------------------------------------------------------
 * 定位：闭合 D1 断点 —— 把 N1.1「标准 7 字段结果」与 G5.5 ai-normalizer
 *       所需的「8 字段 ai 对象」连接起来。
 *
 * 设计约束（D5 正式拍板）：
 *   - N1.1 的 Provider 7 字段契约保持不变（title/summary/category/related_* 7 个），
 *     严禁把 ai_model 重新加入这 7 个字段。
 *   - ai_model 只来自**受控的 Provider/Registry 元数据**（本层 meta 注入），
 *     Provider 原始输出不得携带 ai_model。
 *   - 未知字段规则继续有效（由 N1.1 validator 在 bridge 之前拦截）。
 *   - 不修改 N1.1 validator 的封闭字段集；不修改 G5.5 ai-normalizer。
 *   - 不修改 seven 入参，返回隔离副本。
 * ============================================================ */
'use strict';

function fail(code, message) {
  const e = new Error('[' + code + '] ' + message);
  e.code = code;
  throw e;
}

/**
 * 注入 ai_model：7 字段标准结果 + 受控元数据 → 8 字段 ai 对象。
 * @param {object} sevenFields N1.1 校验通过的 7 字段结果（不得含 ai_model）
 * @param {object} meta 受控元数据 { provider?, model }（model 必填非空）
 * @returns {object} 含 ai_model 的隔离副本（8 字段），供 ai-normalizer.normalize 使用
 * @throws BRIDGE_INVALID | BRIDGE_UNEXPECTED_FIELD | BRIDGE_MISSING_MODEL
 */
function injectAiModel(sevenFields, meta) {
  if (!sevenFields || typeof sevenFields !== 'object' || Array.isArray(sevenFields)) {
    fail('BRIDGE_INVALID', 'bridge 输入必须是普通对象（N1.1 标准 7 字段结果）');
  }
  /* ★ 防御：Provider 标准输出若已含 ai_model，属违规（应由受控元数据注入，非 Provider 自带） */
  if ('ai_model' in sevenFields) {
    fail('BRIDGE_UNEXPECTED_FIELD',
      'Provider 标准输出不得含 ai_model（应由受控 Provider/Registry 元数据注入，非 Provider 自带）');
  }
  if (!meta || typeof meta !== 'object') {
    fail('BRIDGE_MISSING_MODEL', '缺少受控 Provider/Registry 元数据 meta');
  }
  const model = meta.model;
  if (typeof model !== 'string' || !String(model).trim()) {
    fail('BRIDGE_MISSING_MODEL', 'meta.model 必填且非空（受控 Provider/Registry 元数据，禁止空值）');
  }
  /* 隔离副本 + 注入 ai_model；不修改 sevenFields 入参 */
  return Object.assign({}, sevenFields, { ai_model: String(model).trim() });
}

module.exports = { injectAiModel };
