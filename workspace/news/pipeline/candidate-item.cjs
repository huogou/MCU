/* ============================================================
 * L1 · CandidateItem 接口（G5）
 * ------------------------------------------------------------
 * 定位：把 L0 RawCapture + AI 整理结果 → **候选条目**。
 * 性质：纯函数、零网络、零副作用。
 *
 * ★ G5 范围：仅实现接口。**不接入任何 AI 服务** ——
 *   「AI 整理结果」由调用方以结构化对象传入。
 *
 * 规范依据：G5 启动任务书 V1.0 第 3 / 4 节
 *   + 《候选数据 Candidate Schema V1.0》第 3 / 4 / 5 节
 *
 * ★★ 2026-09-23 规范修订（按 G5 任务书）：
 *   · L0 由 16 → **14 字段**（移除 event_key、first_publish_time）
 *   · 两者**上移至 L1**：L1 = L0 14 + 新增 21 = **35 字段**（总数不变）
 *   · `event_key` 现在**只在 L1 计算**（依赖 category 与关联实体，L0 没有）
 *     → 彻底消除「L0 临时 key 与 L1 正式 key 不一致」的隐患
 *
 * ★★ 三条硬禁止（实现层强制，违者抛错）：
 *   1. **不得生成 verification_status**（最终状态只能由 G1 判定器按 R8.3 重算）；
 *   2. **不得生成 judged_by / status_history**（同为状态相关字段）；
 *   3. **不得进入 33 字段交付物**（L1 不含交付物独有字段）
 *      + 不得使用交付物 id 格式（`news-YYYY-MM-DD-NNN` 由 G6 生成）。
 *
 * ★★ 与 L2（merger）的接线（本阶段实测发现并加固）：
 *   `event-merger`（G4）读取的条目主标识字段名是 **`id`**，
 *   而候选层字段名是 **`candidate_id`**（`id` 在 L1 属禁止字段）。
 *   → 必须经 `toMergerInput()` 适配；该适配器同时执行
 *     **merger 输入字段白名单投影**（任务书第 4 节：严格限制为 9 个字段）：
 *       candidate_id / title / category / related_movies / related_series /
 *       related_characters / publish_time / first_seen_at / reported_by
 *     + 桥接用 `id`（值 = candidate_id）。
 *     → 输出恰为 **10 个键**，**不含** verification_status / judged_by /
 *       chain_steps_hit / status_history / ai_suggested_status / gate_status。
 * ============================================================ */
'use strict';

const registry = require('../engine/news-registry.cjs');
const EK = require('../engine/dedup/event-key.cjs');
const RC = require('./raw-capture.cjs');

const LAYER = 'L1';
const SCHEMA_VERSION = '1.1';

const L0_FIELDS = RC.FIELDS;                       /* 14 */
const L1_ADDED = Object.freeze([
  'candidate_id', 'title', 'summary', 'category',
  'related_movies', 'related_series', 'related_characters', 'related_phases',
  'reported_by', 'original_source', 'original_source_url',
  'publish_time', 'first_seen_at',
  'ai_suggested_status', 'ai_model', 'capture_refs', 'gate_status',
  /* —— 本阶段补充登记（P-补1 / P-补2）—— */
  'report_corrections', 'conflict_statements',
  /* —— 2026-09-23 由 L0 上移（任务书第 2 节未列，第 5 节要求 key 在 L1 产出）—— */
  'event_key', 'first_publish_time'
]);                                                /* 21 */
const FIELDS = Object.freeze(L0_FIELDS.concat(L1_ADDED));   /* 35 */

const CATEGORIES = Object.freeze(['movie', 'series', 'special', 'short', 'character', 'industry']);
const GATE_STATUSES = Object.freeze(['pending', 'approved', 'rejected']);
const AI_STATUSES = Object.freeze([
  'official_confirmed', 'multi_source_reported', 'single_source', 'rumor',
  'unverified', 'conflicting', 'officially_denied', 'corrected', ''
]);

/* ★ merger 输入字段白名单（任务书第 4 节，9 个；另加桥接用 id） */
const MERGER_INPUT_WHITELIST = Object.freeze([
  'candidate_id', 'title', 'category', 'related_movies', 'related_series',
  'related_characters', 'publish_time', 'first_seen_at', 'reported_by'
]);
const MERGER_INPUT_FORBIDDEN = Object.freeze([
  'verification_status', 'judged_by', 'chain_steps_hit', 'status_history',
  'ai_suggested_status', 'gate_status'
]);

/* L1 一律禁止出现的字段（状态 9 项 + 交付物独有字段） */
const LAYER_FORBIDDEN_KEYS = Object.freeze(
  RC.LAYER_FORBIDDEN_KEYS.concat([
    'id', 'independent_group_count',
    'pinned', 'pinned_until', 'pinned_order', 'pinned_reason',
    'supersedes_id', 'superseded_by_id',
    'official_source', 'official_source_url'
  ])
);

const DELIVERY_ID_RE = /^news-\d{4}-\d{2}-\d{2}-\d{3}$/;
const EVENT_KEY_RE = /^evt1-[0-9a-f]{16}$/;

function fail(code, message) {
  const e = new Error('[' + code + '] ' + message);
  e.code = code;
  throw e;
}
function isNonEmptyString(v) { return typeof v === 'string' && v.trim().length > 0; }
function isStringArray(v) { return Array.isArray(v) && v.every(function (x) { return typeof x === 'string'; }); }

/** 纯文本检查：拒绝 HTML 标签、Markdown 代码围栏与粗体标记 */
function findMarkup(s) {
  const t = String(s == null ? '' : s);
  if (/<[a-zA-Z\/][^>]*>/.test(t)) return 'HTML 标签';
  if (/```/.test(t)) return 'Markdown 代码围栏';
  if (/\*\*[^*]+\*\*/.test(t)) return 'Markdown 粗体';
  return '';
}

/** 按 idSpace 做交集校验，未命中丢弃（返回 {kept, discarded}） */
function intersect(ids, space) {
  const arr = Array.isArray(ids) ? ids : [];
  const out = [], discarded = [];
  arr.forEach(function (id) {
    if (id == null) { discarded.push(String(id)); return; }
    const v = String(id).trim();
    if (!v) { discarded.push(v); return; }
    if (!space) { out.push(v); return; }          /* 未提供 idSpace → 不做过滤 */
    (space.has(v) ? out : discarded).push(v);
  });
  return { kept: Array.from(new Set(out)), discarded: discarded };
}

/**
 * 由 RawCapture + AI 整理结果构造 CandidateItem。
 * @param {object} capture L0 对象（须先通过 raw-capture 校验）
 * @param {object} ai      结构化 AI 整理结果
 * @param {object} opts    { idSpace:{content:Set,character:Set}, seq:number }
 * @returns {object} 恰含 35 个 L1 字段的对象
 * @throws {Error} 带 .code
 */
function fromRawCapture(capture, ai, opts) {
  opts = opts || {};
  const a = ai || {};

  /* 0) L0 合法性 */
  const v0 = RC.validate(capture);
  if (!v0.pass) fail('CAPTURE_INVALID', 'L0 校验未通过：' + JSON.stringify(v0.issues));

  /* 1) 禁止字段（状态 9 项 + 交付物独有字段） */
  LAYER_FORBIDDEN_KEYS.forEach(function (k) {
    if (k in a) fail('FORBIDDEN_FIELD', 'L1 不得生成/承载字段：' + k);
  });

  /* 2) AI 整理结果必填 */
  ['title', 'summary', 'category', 'ai_model'].forEach(function (k) {
    if (!isNonEmptyString(a[k])) fail('MISSING_FIELD', 'L1 必填字段缺失：' + k);
  });

  /* 3) 纯文本纪律 */
  const mkTitle = findMarkup(a.title); if (mkTitle) fail('MARKUP_NOT_ALLOWED', 'title 含' + mkTitle);
  const mkSum = findMarkup(a.summary); if (mkSum) fail('MARKUP_NOT_ALLOWED', 'summary 含' + mkSum);

  /* 4) category 枚举 */
  if (CATEGORIES.indexOf(a.category) < 0) {
    fail('INVALID_CATEGORY', 'category 非 6 值枚举：' + a.category);
  }

  /* 5) AI 建议状态（仅建议值，非最终状态） */
  const suggested = a.ai_suggested_status === undefined ? '' : a.ai_suggested_status;
  if (AI_STATUSES.indexOf(suggested) < 0) {
    fail('INVALID_SUGGESTED_STATUS', 'ai_suggested_status 非 8 态之一或空：' + suggested);
  }

  /* 6) gate_status */
  const gate = a.gate_status === undefined ? 'pending' : a.gate_status;
  if (GATE_STATUSES.indexOf(gate) < 0) fail('INVALID_GATE_STATUS', 'gate_status 非枚举值：' + gate);

  /* 7) 关联交集校验 */
  const sp = opts.idSpace || null;
  const rm = intersect(a.related_movies, sp && sp.content);
  const rs = intersect(a.related_series, sp && sp.content);
  const rc_ = intersect(a.related_characters, sp && sp.character);
  const phases = Array.isArray(a.related_phases) ? a.related_phases.filter(function (p) {
    return Number.isInteger(p) && p >= 1 && p <= 6;
  }) : [];

  /* 8) 来源行 —— ★ owner_group 以**登记表**为权威取值来源 */
  const ownerGroup = registry.getOwnerGroup(capture.source_name) || 'unknown';
  const reported_by = [{
    source_name: capture.source_name,
    source_url: capture.source_url,
    owner_group: ownerGroup
  }];

  /* 9) ★ event_key 在 L1 计算（L0 不再产出） */
  const eventKey = EK.buildEventKey({
    title: String(a.title),
    category: String(a.category),
    related_movies: rm.kept,
    related_series: rs.kept,
    related_characters: rc_.kept,
    publish_time: capture.published_at || ''
  });

  /* 10) 双时间 */
  const publishTime = capture.published_at ? String(capture.published_at).slice(0, 10) : '';
  const firstSeenAt = capture.fetched_at || '';
  if (!publishTime && !firstSeenAt) {
    fail('MISSING_TIME', 'publish_time 与 first_seen_at 至少一个非空');
  }

  /* 11) 数组类字段 */
  const corr = Array.isArray(a.report_corrections) ? a.report_corrections.slice() : [];
  const conf = Array.isArray(a.conflict_statements) ? a.conflict_statements.slice() : [];

  const seq = Number(opts.seq) || 1;
  const candidateId = 'cand-' + eventKey.slice(-8) + '-' + String(seq).padStart(3, '0');
  if (DELIVERY_ID_RE.test(candidateId)) {
    fail('DELIVERY_ID_FORBIDDEN', '候选层不得使用交付物 id 格式');
  }

  const candidate = Object.assign({}, capture, {
    candidate_id: candidateId,
    title: String(a.title),
    summary: String(a.summary),
    category: a.category,
    related_movies: rm.kept,
    related_series: rs.kept,
    related_characters: rc_.kept,
    related_phases: phases,
    reported_by: reported_by,
    original_source: isNonEmptyString(a.original_source) ? String(a.original_source) : 'unknown',
    original_source_url: isNonEmptyString(a.original_source_url) ? String(a.original_source_url) : '',
    publish_time: publishTime,
    first_seen_at: firstSeenAt,
    ai_suggested_status: suggested,
    ai_model: String(a.ai_model),
    capture_refs: [capture.capture_id],
    gate_status: gate,
    report_corrections: corr,
    conflict_statements: conf,
    event_key: eventKey,                                  /* ← 由 L0 上移 */
    first_publish_time: capture.published_at              /* ← 由 L0 上移 */
  });

  /* 12) 输出契约自检 */
  const keys = Object.keys(candidate).sort();
  const want = FIELDS.slice().sort();
  if (keys.join(',') !== want.join(',')) {
    fail('FIELD_SET_MISMATCH', 'L1 输出字段集合不等于规范 35 字段\n实际：' + keys.join(','));
  }
  return candidate;
}

/**
 * ★ L1 → L2 适配器：**白名单投影** + `id` 桥接。
 *
 * 1) 桥接：merger 读 `item.id`，候选层字段名是 `candidate_id`
 *    → 补 `id = candidate_id`（不改 merger，G4 冻结件）。
 * 2) 白名单：任务书第 4 节要求 merger 输入**严格限制为 9 个字段**
 *    → 只投影白名单 + `id`，输出恰为 **10 个键**，
 *      从结构上保证 merger **读不到**验证/审核类字段。
 */
function toMergerInput(candidate) {
  if (!candidate || typeof candidate !== 'object') {
    fail('MERGER_INPUT_INVALID', 'toMergerInput 需要候选对象');
  }
  const out = { id: candidate.candidate_id };
  MERGER_INPUT_WHITELIST.forEach(function (k) {
    if (k in candidate) out[k] = candidate[k];
  });
  return out;
}

function toMergerInputs(list) {
  return (Array.isArray(list) ? list : []).map(toMergerInput);
}

/** 校验一个 L1 对象 */
function validate(candidate) {
  const issues = [];
  function bad(rule, message) { issues.push({ rule: rule, target: LAYER, message: message }); }
  const c = candidate;
  if (!c || typeof c !== 'object') { bad('L1-00', '不是对象'); return { pass: false, issues: issues }; }

  const keys = Object.keys(c);
  const miss = FIELDS.filter(function (f) { return keys.indexOf(f) < 0; });
  const extra = keys.filter(function (f) { return FIELDS.indexOf(f) < 0; });
  if (miss.length) bad('L1-01', '缺少字段：' + miss.join(', '));
  if (extra.length) bad('L1-01', '存在字段集之外的键：' + extra.join(', '));

  LAYER_FORBIDDEN_KEYS.forEach(function (k) {
    if (k in c) bad('L1-02', '出现禁止字段：' + k);
  });
  /* ★ 复用 L0 校验时须放行额外字段（L1 天然含更多字段） */
  const v0 = RC.validate(c, { allowExtraFields: true });
  if (!v0.pass) bad('L1-03', 'L0 部分校验未通过：' + JSON.stringify(v0.issues.slice(0, 3)));

  if (!/^cand-[0-9a-f]{8}-\d{3}$/.test(String(c.candidate_id))) bad('L1-04', 'candidate_id 形态非法：' + c.candidate_id);
  if (DELIVERY_ID_RE.test(String(c.candidate_id))) bad('L1-05', 'candidate_id 使用了交付物 id 格式');
  if (CATEGORIES.indexOf(c.category) < 0) bad('L1-06', 'category 非枚举值：' + c.category);
  if (AI_STATUSES.indexOf(c.ai_suggested_status) < 0) bad('L1-07', 'ai_suggested_status 非法：' + c.ai_suggested_status);
  if (GATE_STATUSES.indexOf(c.gate_status) < 0) bad('L1-08', 'gate_status 非枚举值：' + c.gate_status);
  if (!EVENT_KEY_RE.test(String(c.event_key))) bad('L1-09', 'event_key 形态非法');
  if (!Array.isArray(c.reported_by) || !c.reported_by.length) bad('L1-10', 'reported_by 为空');
  else {
    const s = c.reported_by[0];
    if (!s || !s.source_name || !s.source_url) bad('L1-10', 'reported_by[0] 缺 source_name / source_url');
    if (!s || typeof s.owner_group !== 'string' || !s.owner_group) bad('L1-11', 'reported_by[0].owner_group 为空');
  }
  if (!c.publish_time && !c.first_seen_at) bad('L1-12', 'publish_time 与 first_seen_at 皆空');
  if (!isStringArray(c.capture_refs) || !c.capture_refs.length) bad('L1-13', 'capture_refs 为空');
  if (!Array.isArray(c.report_corrections)) bad('L1-14', 'report_corrections 非数组');
  if (!Array.isArray(c.conflict_statements)) bad('L1-15', 'conflict_statements 非数组');
  const mk = findMarkup(c.title) || findMarkup(c.summary);
  if (mk) bad('L1-16', 'title / summary 含' + mk);
  /* ★ occurrence 不得出现在任何输出（任务书第 5 节） */
  if ('occurrence' in c) bad('L1-17', 'occurrence 不得出现在 L1 输出中');
  return { pass: issues.length === 0, issues: issues };
}

module.exports = {
  LAYER,
  SCHEMA_VERSION,
  FIELDS,
  L1_ADDED,
  MERGER_INPUT_WHITELIST,
  MERGER_INPUT_FORBIDDEN,
  CATEGORIES,
  GATE_STATUSES,
  AI_STATUSES,
  LAYER_FORBIDDEN_KEYS,
  DELIVERY_ID_RE,
  EVENT_KEY_RE,
  findMarkup,
  intersect,
  fromRawCapture,
  toMergerInput,
  toMergerInputs,
  validate
};
