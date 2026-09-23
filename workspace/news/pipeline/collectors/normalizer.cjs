/* ============================================================
 * collectors · normalizer.cjs（G5.2）
 * ------------------------------------------------------------
 * 职责：把「parser 出来的原始条目 + 登记表来源」组装成
 *       **L0 RawCapture 的入参**，并做最后一道纪律校验。
 *
 * 性质：纯函数、零网络。
 *
 * ★ 三条纪律（实现层强制）：
 *   1. **不改写标题语义** —— `title_raw` 原样透传（只允许 trim 首尾空白）
 *   2. **不生成状态** —— 输出不得含任何状态字段（深扫即抛错）
 *   3. **不生成 L0 之外的派生字段** —— 尤其：
 *      `event_key` / `first_publish_time` **不属于 L0**，
 *      本模块**禁止**产出；`url_level` / `published_at` / `content_hash`
 *      交由 `raw-capture.create()` 统一派生（避免两处实现漂移）
 * ============================================================ */
'use strict';

const STATE_FIELDS = [
  'verification_status', 'status_history', 'status_changed_at',
  'judged_by', 'chain_steps_hit', 'status_change_reason',
  'status_change_evidence_url', 'conflict_resolved_at',
  'conflict_resolved_by_evidence_url'
];

/* ★ 这两个**不属于 L0**（2026-09-23 修订后上移至 L1），本模块禁止产出 */
const NOT_L0_FIELDS = ['event_key', 'first_publish_time'];

const EXCERPT_MAX = 200;

function fail(code, message) {
  const e = new Error('[' + code + '] ' + message);
  e.code = code;
  throw e;
}

/** 深扫禁止字段；命中即抛 */
function assertClean(obj) {
  const hits = [];
  (function walk(n, p) {
    if (n == null || typeof n !== 'object') return;
    if (Array.isArray(n)) { n.forEach(function (x, i) { walk(x, p + '[' + i + ']'); }); return; }
    Object.keys(n).forEach(function (k) {
      if (STATE_FIELDS.indexOf(k) >= 0 || NOT_L0_FIELDS.indexOf(k) >= 0) hits.push((p ? p + '.' : '') + k);
      walk(n[k], p ? p + '.' + k : k);
    });
  })(obj, '');
  if (hits.length) fail('FORBIDDEN_FIELD', 'L0 入参不得含禁止字段：' + hits.join(', '));
  return true;
}

/** 去标签 + 压缩空白 + 限长（原文摘录，不做改写；仅截断） */
function makeExcerpt(raw, max) {
  const m = max || EXCERPT_MAX;
  let s = String(raw == null ? '' : raw)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (s.length > m) s = s.slice(0, m);
  return s;
}

/** capture_id：cap-<registry_id>-<run_id>-<3 位序号> */
function makeCaptureId(registryId, runId, seq) {
  const n = String(Number(seq) || 1);
  return 'cap-' + String(registryId) + '-' + String(runId) + '-' + n.padStart(3, '0');
}

/**
 * 组装 L0 入参（14 字段中除 3 个派生字段外的 11 个）
 * @param {object} item    parser 产出的原始条目
 * @param {object} source  登记表来源记录（含 registry_id / source_name / feed_url / feed_type）
 * @param {object} ctx     { run_id, seq, fetched_at, http_status }
 * @returns {object} 供 raw-capture.create() 使用
 * @throws FORBIDDEN_FIELD / MISSING_FIELD / URL_LEVEL_FALLBACK_TO_FEED
 */
function toCaptureInput(item, source, ctx) {
  const it = item || {}, src = source || {}, c = ctx || {};

  /* ★ fail closed：原始条目本身若携带状态字段或 event_key（不属 L0），
   *   一律**拒绝**而不是静默丢弃 —— 静默丢弃会让上游的越权写入无从发现。 */
  assertClean(it);

  /* ★ 不改写标题语义：仅 trim */
  const titleRaw = String(it.title_raw == null ? '' : it.title_raw).trim();
  if (!titleRaw) fail('MISSING_FIELD', '条目缺少 title_raw');

  /* 条目 URL 优先；缺失 → 回落登记出口（此时该条 url_level 会被判为 feed，属可识别状态） */
  const entryUrl = String(it.url || '').trim();
  const sourceUrl = entryUrl || String(src.feed_url || '').trim();
  if (!sourceUrl) fail('MISSING_FIELD', '条目与来源均无可用 URL');

  const input = {
    capture_id: c.capture_id || makeCaptureId(src.registry_id, c.run_id, c.seq),
    pipeline_run_id: String(c.run_id || ''),
    registry_id: src.registry_id,
    source_name: src.source_name,
    source_url: sourceUrl,
    title_raw: titleRaw,
    published_at_raw: String(it.published_at_raw == null ? '' : it.published_at_raw),
    fetched_at: String(c.fetched_at || ''),
    feed_type: src.feed_type || 'rss',
    http_status: c.http_status,
    raw_excerpt: makeExcerpt(it.excerpt_raw || titleRaw, EXCERPT_MAX)
  };

  assertClean(input);
  if (!input.pipeline_run_id) fail('MISSING_FIELD', 'ctx.run_id 缺失');
  if (!input.fetched_at) fail('MISSING_FIELD', 'ctx.fetched_at 缺失');
  if (input.http_status == null) fail('MISSING_FIELD', 'ctx.http_status 缺失');

  return input;
}

module.exports = {
  STATE_FIELDS,
  NOT_L0_FIELDS,
  EXCERPT_MAX,
  assertClean,
  makeExcerpt,
  makeCaptureId,
  toCaptureInput
};
