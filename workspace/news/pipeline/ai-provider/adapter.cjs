/* ============================================================
 * N1.1 · AI Provider Adapter（统一 Provider 抽象 + 适配层）
 * ------------------------------------------------------------
 * 架构（单向，职责清晰分离）：
 *   Provider（可替换具体 AI）
 *      ↓ provider.provide(input)
 *   AI Provider Adapter（runAdapter）
 *      ↓ 调用 contract-validator.validate
 *   标准 7 字段结果
 *      ↓ 通过 → 后续流程；失败 → 明确错误向上抛
 *
 * 设计约束（N1.1 指令）：
 *   - 不修改 G1–G10 / D1/D2 / news.js / H5
 *   - 不复制一套新的生产运行逻辑（仅做 Provider→7字段 的适配与校验）
 *   - Provider-specific 字段不得泄漏到业务层（校验器拦截越权字段）
 *   - Adapter 与 Validator 职责分离（本文件只负责调用与错误传播）
 *   - 校验失败不得进入后续生产持久化链路（校验器抛错，adapter 不接管）
 * ============================================================ */
'use strict';

const V = require('./contract-validator.cjs');

function fail(code, message) {
  const e = new Error('[' + code + '] ' + message);
  e.code = code;
  throw e;
}

/**
 * 构造统一 Provider 抽象。
 * @param {string} name provider 标识
 * @param {{provide:function}} impl 必须实现 provide(input)（可 async）
 * @returns {Readonly<{name:string, provide:function}>}
 */
function createProvider(name, impl) {
  if (!name || typeof name !== 'string') fail('PROVIDER_INVALID', 'provider 名称必填');
  if (!impl || typeof impl.provide !== 'function') {
    fail('PROVIDER_INVALID', 'provider 必须实现 provide(input) 方法');
  }
  return Object.freeze({ name: name, provide: impl.provide });
}

/**
 * 简单 Provider 注册表：使后续可替换具体 AI Provider，不影响上层。
 */
function createRegistry() {
  const map = Object.create(null);
  return {
    register: function (name, provider) { map[name] = provider; return this; },
    get: function (name) {
      if (!map[name]) fail('PROVIDER_NOT_FOUND', '未注册的 provider：' + name);
      return map[name];
    },
    list: function () { return Object.keys(map); }
  };
}

/**
 * 运行 Adapter：调用 provider.provide → 校验 7 字段契约。
 * @param {object} provider createProvider 产出的 provider
 * @param {*} input 喂给 provider 的原始输入（如原始候选/raw capture）
 * @param {object} [opts] 保留扩展位
 * @returns {Promise<object>} 校验通过的隔离 7 字段结果
 * @throws PROVIDER_ERROR（provider 内部错误，保留 cause 向上传播）
 *         | FORBIDDEN_FIELD | MISSING_FIELD | TYPE_ERROR（校验失败，原样向上抛）
 */
async function runAdapter(provider, input, opts) {
  opts = opts || {};
  if (!provider || typeof provider.provide !== 'function') {
    fail('PROVIDER_INVALID', 'adapter 需要合法 provider');
  }

  let raw;
  try {
    raw = await provider.provide(input);
  } catch (e) {
    /* Provider 错误正确向上层传播（不吞掉、不伪装成校验通过） */
    const pe = new Error('[PROVIDER_ERROR] provider.provide 失败：' + (e && e.message ? e.message : String(e)));
    pe.code = 'PROVIDER_ERROR';
    pe.cause = e;
    throw pe;
  }

  /* 校验不通过会向上抛（FORBIDDEN_FIELD / MISSING_FIELD / TYPE_ERROR）；
     adapter 不静默丢弃、不接管，失败不得进入后续持久化链路 */
  return V.validate(raw);
}

module.exports = {
  createProvider: createProvider,
  createRegistry: createRegistry,
  runAdapter: runAdapter
};
