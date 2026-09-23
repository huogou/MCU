/* ============================================================
 * L0 · RawCapture 接口（G5）
 * ------------------------------------------------------------
 * 定位：采集器输出的**原始条目**结构定义与构造/校验接口。
 * 性质：纯函数、零网络、零副作用。
 *
 * ★ G5 范围：**仅实现接口**。不接真实网络、不抓网页、不调用外部 API。
 *
 * 规范依据：G5 启动任务书 V1.0 第 2 节（**L0 = 14 字段**）
 *   + 《候选数据 Candidate Schema V1.0》第 2 节
 *
 * ★★ 2026-09-23 规范修订（按 G5 任务书）：
 *   L0 字段由 16 个改为 **14 个** —— 移除 `event_key` 与 `first_publish_time`。
 *   两者**上移至 L1**（原因：event_key 依赖 category 与关联实体，
 *   而 L0 只有 title_raw，在 L0 算出的 key 必然走 text 模式、
 *   到 L1 还会被重算 —— 属无意义的临时值；上移后彻底消除该隐患）。
 *   L1 总数仍为 35（= 14 + 21），交付层映射不变。
 *
 * ★ L0 五条约束（任务书第 2 节，实现层强制）：
 *   1. 单来源单条     —— 一条 capture 只对应一个来源出口、一条原始条目
 *   2. 不做 AI 判断   —— 本模块不含任何语义判断；title_raw 原样保留
 *   3. 不修改标题     —— title_raw 不得改写
 *   4. 不生成状态     —— 输出不得含任何状态字段（9 项，违者抛错）
 *   5. 保留原始证据   —— url / published_at_raw / fetched_at / http_status /
 *                        content_hash / raw_excerpt 全部留痕
 * ============================================================ */
'use strict';

const crypto = require('crypto');

const registry = require('../engine/news-registry.cjs');

const LAYER = 'L0';
const SCHEMA_VERSION = '1.1';   /* 1.0(16 字段) → 1.1(14 字段，按 G5 任务书) */

/* L0 字段（**14 个**，顺序即规范顺序；不得增删改名） */
const FIELDS = Object.freeze([
  'capture_id', 'pipeline_run_id', 'registry_id', 'source_name', 'source_url',
  'url_level', 'title_raw', 'published_at_raw', 'published_at', 'fetched_at',
  'feed_type', 'http_status', 'content_hash', 'raw_excerpt'
]);

const RESERVED_REGISTRY_ID = 'unregistered';   /* 来源不在登记表时的保留值 */
const URL_LEVELS = Object.freeze(['article', 'feed', 'section']);
const FEED_TYPES = Object.freeze(['rss', 'atom', 'html-parse']);
const EXCERPT_MAX = 200;

/* L0 一律禁止出现的状态字段（9 个） */
const LAYER_FORBIDDEN_KEYS = Object.freeze([
  'verification_status', 'status_history', 'status_changed_at',
  'judged_by', 'chain_steps_hit', 'status_change_reason',
  'status_change_evidence_url', 'conflict_resolved_at',
  'conflict_resolved_by_evidence_url'
]);

/* ---------------- 工具 ---------------- */

function fail(code, message) {
  const e = new Error('[' + code + '] ' + message);
  e.code = code;
  throw e;
}

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

/** 仅接受 http(s)（Q-5 / safeUrl 纪律） */
function parseHttpUrl(u) {
  const s = String(u == null ? '' : u).trim();
  const m = /^(https?):\/\/([^\/?#]+)([^?#]*)/i.exec(s);
  if (!m) return null;
  return { protocol: m[1].toLowerCase(), host: m[2].toLowerCase().replace(/:\d+$/, ''), path: m[3] || '/' };
}

/**
 * 判定 URL 等级（暴露 Q-5「文章级 URL」的合规状态）
 *   feed    末段为 feed / rss，或路径含 /feed
 *   section 路径段数 ≤ 1（站点首页 / 单一栏目，如 /news）
 *   article 其余（至少两级路径）
 * ※ 已知边界：形如 /articles/live-events/ 的**目录页**会被判为 article
 *   （仅凭 URL 无法区分目录与文章），须靠人工审核识别。
 */
function classifyUrlLevel(url) {
  const p = parseHttpUrl(url);
  if (!p) return null;
  const segs = p.path.split('/').filter(Boolean);
  const last = (segs[segs.length - 1] || '').toLowerCase();
  if (last === 'feed' || last === 'rss' || /\/feed\//i.test(p.path)) return 'feed';
  if (segs.length <= 1) return 'section';
  return 'article';
}

/** 规范化时间为 ISO8601（无毫秒）；无法解析返回 null */
function normalizeIso(raw) {
  const s = String(raw == null ? '' : raw).trim();
  if (!s) return null;
  const t = Date.parse(s);
  if (isNaN(t)) return null;
  return new Date(t).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function sha1(s) {
  return crypto.createHash('sha1').update(String(s), 'utf8').digest('hex');
}

/* ---------------- 构造 ---------------- */

/**
 * 由采集输入构造一条 RawCapture。
 * @param {object} input 见 FIELDS（14 个）
 * @param {object} opts  { now } —— 预留（时间可注入）
 * @returns {object} 恰含 14 个 L0 字段的对象
 * @throws {Error} 带 .code（见报告错误码表）
 */
function create(input, opts) {
  const src = input || {};
  opts = opts || {};

  /* 1) L0 不得承载任何状态字段 */
  LAYER_FORBIDDEN_KEYS.forEach(function (k) {
    if (k in src) fail('FORBIDDEN_FIELD', 'L0 不得包含状态字段：' + k);
  });

  /* 2) 必填（source_url 由第 3 步的 URL 校验单独负责，以免空 URL 报错码不准） */
  ['capture_id', 'pipeline_run_id', 'registry_id', 'source_name',
    'title_raw', 'fetched_at', 'feed_type', 'raw_excerpt'].forEach(function (k) {
    if (!isNonEmptyString(src[k])) fail('MISSING_FIELD', 'L0 必填字段缺失或为空：' + k);
  });

  /* 3) URL 必须 http(s) */
  if (!parseHttpUrl(src.source_url)) {
    fail('INVALID_URL', 'source_url 必须是 http(s)：' + JSON.stringify(src.source_url));
  }

  /* 4) registry_id 必须命中登记表，或为保留值 unregistered */
  const rid = String(src.registry_id).trim();
  if (rid !== RESERVED_REGISTRY_ID && !registry.byId(rid)) {
    fail('UNKNOWN_REGISTRY_ID', 'registry_id 未在登记表中：' + rid +
      '（来源不在登记表时请显式填 "' + RESERVED_REGISTRY_ID + '"）');
  }

  /* 5) 已登记来源的 source_name 必须与登记表逐字符一致 */
  if (rid !== RESERVED_REGISTRY_ID) {
    const e = registry.byId(rid);
    if (e.source_name !== String(src.source_name).trim()) {
      fail('SOURCE_NAME_MISMATCH',
        'source_name 与登记表不一致（传入「' + src.source_name + '」，登记表「' + e.source_name + '」）');
    }
  }

  /* 6) 枚举与数值 */
  if (FEED_TYPES.indexOf(src.feed_type) < 0) {
    fail('INVALID_FEED_TYPE', 'feed_type 非枚举值：' + src.feed_type);
  }
  const hs = Number(src.http_status);
  if (!Number.isInteger(hs) || hs < 100 || hs > 599) {
    fail('INVALID_HTTP_STATUS', 'http_status 须为 100–599 的整数：' + src.http_status);
  }

  /* 7) 摘录限长 */
  if (String(src.raw_excerpt).length > EXCERPT_MAX) {
    fail('EXCERPT_TOO_LONG', 'raw_excerpt 超过 ' + EXCERPT_MAX + ' 字：' +
      String(src.raw_excerpt).length);
  }

  /* 8) 派生字段（仅 3 个：url_level / published_at / content_hash） */
  const publishedAt = normalizeIso(src.published_at_raw);
  const urlLevel = classifyUrlLevel(src.source_url);
  const ch = isNonEmptyString(src.content_hash)
    ? String(src.content_hash)
    : sha1([String(src.source_url), String(src.title_raw), publishedAt || ''].join('|'));

  const capture = {
    capture_id: String(src.capture_id).trim(),
    pipeline_run_id: String(src.pipeline_run_id).trim(),
    registry_id: rid,
    source_name: String(src.source_name).trim(),
    source_url: String(src.source_url).trim(),
    url_level: urlLevel,
    title_raw: String(src.title_raw),
    published_at_raw: String(src.published_at_raw == null ? '' : src.published_at_raw),
    published_at: publishedAt,
    fetched_at: normalizeIso(src.fetched_at) || String(src.fetched_at),
    feed_type: src.feed_type,
    http_status: hs,
    content_hash: ch,
    raw_excerpt: String(src.raw_excerpt)
  };

  /* 9) 输出契约自检：必须恰为 14 字段 */
  const keys = Object.keys(capture).sort();
  const want = FIELDS.slice().sort();
  if (keys.join(',') !== want.join(',')) {
    fail('FIELD_SET_MISMATCH', 'L0 输出字段集合不等于规范 14 字段\n实际：' + keys.join(','));
  }
  return capture;
}

/* ---------------- 校验 ---------------- */

/**
 * 校验一个对象是否符合 L0 规格。
 * @param {object} capture 待校验对象
 * @param {object} opts    { allowExtraFields } —— 供 L1 复用时跳过「字段集合恰为 14」的检查
 */
function validate(capture, opts) {
  const allowExtra = !!(opts && opts.allowExtraFields);
  const issues = [];
  function bad(rule, message) { issues.push({ rule: rule, target: LAYER, message: message }); }
  const c = capture;
  if (!c || typeof c !== 'object') { bad('L0-00', '不是对象'); return { pass: false, issues: issues }; }

  const keys = Object.keys(c);
  const miss = FIELDS.filter(function (f) { return keys.indexOf(f) < 0; });
  if (miss.length) bad('L0-01', '缺少字段：' + miss.join(', '));
  if (!allowExtra) {
    const extra = keys.filter(function (f) { return FIELDS.indexOf(f) < 0; });
    if (extra.length) bad('L0-01', '存在 14 字段之外的键：' + extra.join(', '));
  }

  /* 禁止状态字段 */
  LAYER_FORBIDDEN_KEYS.forEach(function (k) {
    if (k in c) bad('L0-02', '出现禁止的状态字段：' + k);
  });

  if (!isNonEmptyString(c.capture_id)) bad('L0-03', 'capture_id 为空');
  if (!isNonEmptyString(c.pipeline_run_id)) bad('L0-04', 'pipeline_run_id 为空');
  if (!parseHttpUrl(c.source_url)) bad('L0-05', 'source_url 非 http(s)');
  if (URL_LEVELS.indexOf(c.url_level) < 0) bad('L0-06', 'url_level 非枚举值：' + c.url_level);
  if (FEED_TYPES.indexOf(c.feed_type) < 0) bad('L0-07', 'feed_type 非枚举值：' + c.feed_type);
  if (!Number.isInteger(c.http_status)) bad('L0-08', 'http_status 非整数');
  if (String(c.raw_excerpt).length > EXCERPT_MAX) bad('L0-09', 'raw_excerpt 超长');
  if (c.published_at !== null && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(String(c.published_at))) {
    bad('L0-10', 'published_at 非 ISO8601 或非 null：' + c.published_at);
  }
  /* ★ 2 个字段不得出现在 L0（2026-09-23 修订）
   * ※ 仅在**严格 L0 校验**时检查；L1 复用本函数时须放行
   *   （event_key / first_publish_time 已正式上移到 L1） */
  if (!allowExtra) {
    if ('event_key' in c) bad('L0-14', 'event_key 不得出现在 L0（已上移至 L1）');
    if ('first_publish_time' in c) bad('L0-15', 'first_publish_time 不得出现在 L0（已上移至 L1）');
  }

  /* registry 一致性 */
  const rid = String(c.registry_id || '');
  if (rid !== RESERVED_REGISTRY_ID) {
    const e = registry.byId(rid);
    if (!e) bad('L0-12', 'registry_id 未在登记表中：' + rid);
    else if (e.source_name !== String(c.source_name || '').trim()) {
      bad('L0-13', 'source_name 与登记表不一致（' + c.source_name + ' ≠ ' + e.source_name + '）');
    }
  }
  return { pass: issues.length === 0, issues: issues };
}

module.exports = {
  LAYER,
  SCHEMA_VERSION,
  FIELDS,
  RESERVED_REGISTRY_ID,
  URL_LEVELS,
  FEED_TYPES,
  EXCERPT_MAX,
  LAYER_FORBIDDEN_KEYS,
  parseHttpUrl,
  classifyUrlLevel,
  normalizeIso,
  create,
  validate
};
