/* ============================================================
 * N1.2 · Adapter → ai-normalizer 最小接线（runner）
 * ------------------------------------------------------------
 * 链路（D5 / 任务三）：
 *   candidate(L1 桩)
 *     → registry.get(providerName)
 *     → runAdapter(provider, candidate)   [N1.1：validate → 标准 7 字段]
 *     → bridge.injectAiModel(7 字段, 受控 meta)   [注入 ai_model → 8 字段]
 *     → ai-normalizer.normalize(candidate, 8 字段)   [G5.5：产出增强 L1]
 *
 * 设计约束：
 *   - 复用 N1.1（adapter.cjs / contract-validator.cjs），禁止复制 validator、禁止绕过。
 *   - Provider 原始输出不能直接进入 normalizer（须经 bridge）。
 *   - validator / bridge 失败立即向上抛错；不 catch 后返回空对象；不静默删除未知字段。
 *   - N1.1 adapter 与 G5.5 ai-normalizer 均仅读不改（本阶段冻结）。
 *   - 受控元数据经 opts.meta 注入（adapter.cjs 保持 N1.1 冻结，未改 createProvider 签名）。
 * ============================================================ */
'use strict';

const A = require('./adapter.cjs');                  /* N1.1（冻结，仅读） */
const B = require('./bridge.cjs');                    /* 本阶段新增 */
const NM = require('../ai-normalizer/ai-normalizer.cjs'); /* G5.5（冻结，仅读） */

/**
 * 解析受控元数据：优先 opts.meta（由接线/注册层显式注入），其次 provider.meta（若存在）。
 * @returns {object|null} { provider?, model } 或 null（缺 model）
 */
function resolveMeta(provider, opts) {
  if (opts && opts.meta && typeof opts.meta.model === 'string' && opts.meta.model.trim()) return opts.meta;
  if (provider && provider.meta && typeof provider.meta.model === 'string' && provider.meta.model.trim()) return provider.meta;
  return null;
}

/**
 * Adapter → ai-normalizer 最小接线入口。
 * @param {object} candidate 桩版 L1（35 字段，须通过 CI.validate）
 * @param {object} registry  N1.1 createRegistry 实例（含注册好的 provider）
 * @param {string} providerName 注册名
 * @param {object} opts { meta:{provider?,model}, idSpace, seq }
 * @returns {Promise<{seven:object, enriched:object, enhanced:object}>}
 *   seven    : N1.1 校验通过的 7 字段（无 ai_model）
 *   enriched : bridge 注入 ai_model 后的 8 字段（供 ai-normalizer）
 *   enhanced : ai-normalizer.normalize 产出的增强 L1（35 字段）
 */
async function runAiProviderStage(candidate, registry, providerName, opts) {
  opts = opts || {};
  const provider = registry.get(providerName);          /* 未注册 → PROVIDER_NOT_FOUND 向上抛 */
  const seven = await A.runAdapter(provider, candidate, opts); /* 校验失败向上抛（不静默） */
  const meta = resolveMeta(provider, opts);
  const enriched = B.injectAiModel(seven, meta);        /* 缺 meta.model → BRIDGE_MISSING_MODEL 向上抛 */
  const enhanced = NM.normalize(candidate, enriched, {   /* G5.5 只读调用，不修改 */
    idSpace: opts.idSpace || null,
    seq: opts.seq || 1
  });
  return { seven: seven, enriched: enriched, enhanced: enhanced };
}

module.exports = { runAiProviderStage, resolveMeta };
