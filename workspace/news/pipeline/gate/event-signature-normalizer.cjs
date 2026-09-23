/* ============================================================
 * event-signature-normalizer（G6 §四）· AI 标题稳定化
 * ------------------------------------------------------------
 * 目标：避免 AI 改写标题导致同事件拆分（G5.5 实测「聚合损失 2 对」）。
 * 设计：
 *   · signature = 对 title 做**确定性规范化**（封闭规则集，见下）；
 *   · event_key 重算时以 signature 替代 title 作为 EK 输入
 *     —— **G4 event-key.cjs 冻结件零改动**（只换输入，不改规则）；
 *   · original title **原样保留**在候选 title 字段（展示/交付不受影响）；
 *   · event_key 不再依赖单一 AI 标题的措辞（大小写/全半角/标点/
 *     空白/尾部版本注记差异 → 同一签名 → 同一 key）。
 * 能力边界（如实声明，报告分开计量）：
 *   · 可救：大小写、全半角、标点、空白、尾部括注（如「（更正版）」）；
 *   · 不可救：语义措辞差异（如「首任 / 新设」）——归「同内容变体
 *     统一措辞」前置步骤解决（G5.5 已列入 G6 前建议）。
 * 签名规则（封闭、确定性、顺序固定）：
 *   1. trim 首尾空白
 *   2. 全角字符 → 半角（U+FF01–U+FF5E 平移；U+3000 → 空格）
 *   3. 转小写
 *   4. 反复移除尾部括注（（…）与 (…) 两种形态）
 *   5. 移除一切「字母/数字/汉字」之外的字符（含全部标点与空白）
 * ============================================================ */
'use strict';

const EK = require('../../engine/dedup/event-key.cjs');

const LAYER = 'L1-SIG';
const SCHEMA_VERSION = '1.0';

function toHalfWidth(s) {
  let out = '';
  for (const ch of String(s)) {
    const c = ch.codePointAt(0);
    if (c === 0x3000) out += ' ';
    else if (c >= 0xFF01 && c <= 0xFF5E) out += String.fromCharCode(c - 0xFEE0);
    else out += ch;
  }
  return out;
}

/** 确定性标题签名（规则集见文件头；同输入恒同输出） */
function signatureOf(title) {
  let s = String(title == null ? '' : title).trim();
  s = toHalfWidth(s).toLowerCase();
  /* 反复移除尾部括注（含先去尾部空白再判断） */
  let prev = null;
  while (prev !== s) {
    prev = s;
    s = s.replace(/[\s]*[（(][^（）()]*[)）]\s*$/, '');
  }
  /* 仅保留字母/数字/汉字（Unicode \p{L}\p{N}），其余一律移除 */
  s = s.replace(/[^\p{L}\p{N}]/gu, '');
  return s;
}

function fail(code, message) {
  const e = new Error('[' + code + '] ' + message);
  e.code = code;
  throw e;
}

/**
 * 对单条候选做签名化重算：event_key / candidate_id 重算，title 原样保留。
 * @returns 新候选对象（恰 35 字段，title 不变）
 */
function rekey(candidate, opts) {
  opts = opts || {};
  const sig = signatureOf(candidate.title);
  if (!sig) {
    fail('SIGNATURE_EMPTY', '签名化后为空（title 无任何字母/数字/汉字）：' + String(candidate.candidate_id));
  }
  const eventKey = EK.buildEventKey({
    title: sig,
    category: candidate.category,
    related_movies: candidate.related_movies,
    related_series: candidate.related_series,
    related_characters: candidate.related_characters,
    publish_time: candidate.published_at || ''
  });
  const seq = Number(opts.seq) || 1;
  const newId = 'cand-' + eventKey.slice(-8) + '-' + String(seq).padStart(3, '0');
  const out = Object.assign({}, candidate, { event_key: eventKey, candidate_id: newId });
  const keys = Object.keys(out).sort().join(',');
  const want = Object.keys(candidate).sort().join(',');
  if (keys !== want) fail('FIELD_SET_MISMATCH', '签名重算不得增删字段');
  return { candidate: out, signature: sig, from: candidate.candidate_id, to: newId };
}

/**
 * 批量签名重算。
 * @returns {{candidates, mappings:[{from,to,signature,title_kept}]}}
 */
function rekeyAll(candidates, opts) {
  const list = Array.isArray(candidates) ? candidates : [];
  const out = [], mappings = [];
  list.forEach(function (c, i) {
    const r = rekey(c, { seq: i + 1 });
    out.push(r.candidate);
    mappings.push({ from: r.from, to: r.to, signature: r.signature, title_kept: true });
  });
  return { candidates: out, mappings: mappings };
}

module.exports = { LAYER, SCHEMA_VERSION, signatureOf, toHalfWidth, rekey, rekeyAll };
