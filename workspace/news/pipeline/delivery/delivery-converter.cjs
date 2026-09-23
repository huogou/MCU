/* ============================================================
 * DeliveryItem 转换器（G6 §二）· 管道 → 交付物（唯一出口）
 * ------------------------------------------------------------
 * 输入：Gate approved 桶（增强候选，恰 35 字段）
 * 输出：DeliveryItem 数组（**恰 33 字段**，封闭集，逐字节对齐
 *       h5/data/news.js 现网条目键集——见 DELIVERY_FIELDS）
 *
 * 六项硬规则（任务书 §二）：
 *   1. id 重新生成：news-YYYY-MM-DD-NNN
 *      —— 日期 = (publish_time || first_seen_at) 前 10 位；
 *         NNN = 全局入库序号（按输入顺序 001 起，与现网形态一致）；
 *         两时间皆空 → MISSING_TIME fail closed。
 *   2. verification_status **必须计算** —— 只能来自 G1 判定器
 *      judge()（冻结件，只消费不修改）；候选的 ai_suggested_status
 *      **不参与**（AI 隔离：结构上到不了状态字段）。
 *   3. official_source 生成 —— reported_by 中官方组（Disney / Marvel）
 *      来源行直通，并交 G3 官方来源校验器离线校验（结果入 report）；
 *      URL 活性探测仍不在自动链路（R7.4 归属问题维持既有结论）。
 *   4. independent_group_count **必须计算** —— 取 judge 输出，禁手填。
 *   5. supersedes 链保护 —— 显式映射 {new, old}（candidate_id 体系），
 *      id 分配完成后回填互链；引用未知 → SUPERSEDES_REF_UNKNOWN 抛错；
 *      双条必须同时在场（Gate 层已 fail closed，本层双保险）。
 *   6. 管道字段禁入 —— 21 项管道字段（含 event_key、gate_status、
 *      ai_model、candidate_id 等）+ judge 诊断字段，深扫 0 命中，
 *      违者 FIELD_FORBIDDEN_IN_DELIVERY 抛错。
 *
 * ★ 本层零网络、不写 h5（交付物由调用方落盘 pipeline/deliveries/）。
 * ============================================================ */
'use strict';

const JUDGE = require('../../engine/news-judge.cjs');
const REG = require('../../engine/news-registry.cjs');
const OV = require('../../engine/validator/official-source-validator.cjs');

const LAYER = 'L3-DELIVERY';
const SCHEMA_VERSION = '1.0';

/* 33 字段封闭集（键序对齐 h5/data/news.js 现网条目） */
const DELIVERY_FIELDS = Object.freeze([
  'id', 'title', 'summary', 'publish_time', 'first_seen_at',
  'verification_status', 'category', 'reported_by', 'independent_group_count',
  'original_source', 'original_source_url', 'official_source', 'official_source_url',
  'related_movies', 'related_series', 'related_characters', 'related_phases',
  'pinned', 'pinned_until', 'pinned_order', 'pinned_reason',
  'status_history', 'status_changed_at', 'status_change_reason', 'status_change_evidence_url',
  'supersedes_id', 'superseded_by_id', 'report_corrections', 'conflict_statements',
  'judged_by', 'chain_steps_hit', 'conflict_resolved_at', 'conflict_resolved_by_evidence_url'
]);

/* 管道字段禁入清单：L1 35 字段中不进交付的 21 项（含 event_key）+ judge 诊断项 */
const PIPELINE_ONLY_FIELDS = Object.freeze([
  'capture_id', 'pipeline_run_id', 'registry_id', 'source_name', 'source_url',
  'url_level', 'title_raw', 'published_at_raw', 'published_at', 'fetched_at',
  'feed_type', 'http_status', 'content_hash', 'raw_excerpt',
  'candidate_id', 'ai_suggested_status', 'ai_model', 'capture_refs',
  'gate_status', 'event_key', 'first_publish_time',
  'rule_version', 'path_policy', 'reliable_group_count', 'status_history_entry',
  'occurrence'
]);

const DELIVERY_ID_RE = /^news-\d{4}-\d{2}-\d{2}-\d{3}$/;
const OFFICIAL_OWNER_GROUP = 'Disney / Marvel';

function fail(code, message) {
  const e = new Error('[' + code + '] ' + message);
  e.code = code;
  throw e;
}

/** 深扫：交付对象树内不得出现管道字段
 * ★ 三个豁免子树（均为交付物规范内的合法嵌套结构，现网形态即如此）：
 *   reported_by[] 行的 source_name/source_url；report_corrections[] 行的
 *   source_name；conflict_statements[] 行的 source_name/source_url。
 *   豁免是「键名子树级」的——其行内仍不得出现管道字段。 */
function assertNoPipelineFields(item) {
  const hits = [];
  (function walk(n) {
    if (n == null || typeof n !== 'object') return;
    if (Array.isArray(n)) { n.forEach(walk); return; }
    Object.keys(n).forEach(function (k) {
      if (k === 'reported_by' || k === 'report_corrections' || k === 'conflict_statements') return;
      if (PIPELINE_ONLY_FIELDS.indexOf(k) >= 0) hits.push(k);
      walk(n[k]);
    });
  })(item);
  if (hits.length) {
    fail('FIELD_FORBIDDEN_IN_DELIVERY', '交付物含管道字段：' + hits.join(', '));
  }
  return true;
}

/** 官方来源行 → G3 离线校验（记录性，不阻断；URL 活性探测不在链路内） */
function officialCheck(officialRow, claimedId) {
  if (!officialRow) return null;
  const entry = REG.bySourceName(officialRow.source_name) || null;
  const input = {
    source_url: officialRow.source_url,
    source_name: officialRow.source_name,
    registry_entry: entry,
    claimed_event_id: claimedId,
    official_confirm: { url: officialRow.source_url, reviewed: true }
  };
  try {
    const r = OV.validateOfficialSource(input);
    return { candidate_id: claimedId, valid: r.valid === true, reason: r.reason || '' };
  } catch (e) {
    return { candidate_id: claimedId, valid: false, reason: 'G3 校验器异常: ' + (e.code || e.message) };
  }
}

/**
 * 转换主入口。
 * @param {Array} approvedCandidates Gate approved 桶（增强候选）
 * @param {object} opts {
 *   supersedes: [{new, old}]（candidate_id 体系，显式输入）
 *   i9ById: {candidate_id: I9 标记对象}（official_confirm/conflict_verified/official_denial）
 *   judgedByById: {candidate_id: 'human_confirmed'|'rule_validated'|'ai_suggested'}
 *     —— 仅用于复现现网历史中间态（ai_suggested）；语义仍为方案 b
 *   now: 判定时刻（ISO）
 * }
 * @returns {{items, report}}
 */
function toDeliveries(approvedCandidates, opts) {
  opts = opts || {};
  const list = Array.isArray(approvedCandidates) ? approvedCandidates : [];
  const now = opts.now || new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  const i9ById = opts.i9ById || {};
  const judgedByById = opts.judgedByById || {};

/* 1) id 分配
 * ★ 语义定案（T6 反向验证实测）：交付 id 的日期与序号是**落库时刻的事实
 *   记录**——现网 005 的 id 日期与 publish/first_seen 均差一天（历史落库
 *   痕迹），无法纯规则复现。因此：
 *   · 默认规则：日期 = (first_seen_at || publish_time) 前 10 位（首次见到
 *     优先，015 号无 publish 亦复现）；NNN = 全局序号按输入顺序递增；
 *   · 显式覆盖：opts.idById（candidate_id → 完整交付 id），供落库器
 *     写入既有序号体系（反向验证/人工指定）。覆盖值同样过格式+唯一校验。 */
const idById = opts.idById || {};
const ids = [];
let autoSeq = 1;
list.forEach(function (c) {
  let nid = idById[c.candidate_id];
  if (!nid) {
    const day = String(c.first_seen_at || c.publish_time || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
      fail('MISSING_TIME', 'first_seen_at 与 publish_time 均不可用于 id 日期：' +
        String(c.candidate_id) + '（got ' + JSON.stringify(c.first_seen_at) + '/' + JSON.stringify(c.publish_time) + '）');
    }
    nid = 'news-' + day + '-' + String(autoSeq).padStart(3, '0');
    autoSeq++;
  }
  if (!DELIVERY_ID_RE.test(nid)) fail('INVALID_DELIVERY_ID', '生成 id 非法：' + nid);
  ids.push(nid);
});

  /* 2) 逐条转换 */
  const items = [];
  const officialChecks = [];
  list.forEach(function (c, i) {
    /* judge 只读 6 字段（G1 冻结契约；id 用 candidate_id 体系） */
    const judgeItem = {
      id: c.candidate_id,
      reported_by: c.reported_by,
      report_corrections: c.report_corrections,
      conflict_statements: c.conflict_statements,
      original_source: c.original_source,
      original_source_url: c.original_source_url
    };
    const j = JUDGE.judge(judgeItem, i9ById[c.candidate_id] || {}, {
      now: now,
      judgedBy: judgedByById[c.candidate_id]
    });

    /* 官方来源行 */
    const officialRow = (c.reported_by || []).filter(function (s) {
      return s && s.owner_group === OFFICIAL_OWNER_GROUP;
    })[0] || null;
    let official_source = '', official_source_url = '';
    if (officialRow) {
      official_source = officialRow.source_name;
      official_source_url = officialRow.source_url;
      officialChecks.push(officialCheck(officialRow, c.candidate_id));
    }

    /* pinned = 落库运营字段（人工置顶），管道默认全关；
     * 允许 opts.pinnedById 显式指定（复现现网运营态/人工置顶决策） */
    const pv = (opts.pinnedById && opts.pinnedById[c.candidate_id]) || null;

    const item = {
      id: ids[i],
      title: c.title,
      summary: c.summary,
      /* 现网形态：无发布时间用 null（非空串） */
      publish_time: c.publish_time || null,
      first_seen_at: c.first_seen_at,
      verification_status: j.verification_status,        /* ← 只出自判定器 */
      category: c.category,
      reported_by: c.reported_by,
      independent_group_count: j.independent_group_count, /* ← 只出自判定器 */
      original_source: c.original_source,
      original_source_url: c.original_source_url,
      official_source: official_source,
      official_source_url: official_source_url,
      related_movies: c.related_movies,
      related_series: c.related_series,
      related_characters: c.related_characters,
      related_phases: c.related_phases,
      pinned: pv ? pv.pinned : false,
      pinned_until: pv ? pv.pinned_until : null,
      pinned_order: pv ? pv.pinned_order : 0,
      pinned_reason: pv ? pv.pinned_reason : '',
      status_history: [j.status_history_entry],
      status_changed_at: j.status_changed_at,
      status_change_reason: j.status_change_reason,
      status_change_evidence_url: j.status_change_evidence_url,
      /* 现网形态：无 supersedes 链用 null（非空串），有链时为交付 id */
      supersedes_id: null,
      superseded_by_id: null,
      report_corrections: c.report_corrections,
      conflict_statements: c.conflict_statements,
      judged_by: j.judged_by,
      chain_steps_hit: j.chain_steps_hit,
      conflict_resolved_at: null,
      conflict_resolved_by_evidence_url: null
    };

    /* 33 键集自检 */
    const keys = Object.keys(item).sort();
    const want = DELIVERY_FIELDS.slice().sort();
    if (keys.join(',') !== want.join(',')) {
      fail('FIELD_SET_MISMATCH', '交付字段集 ≠ 33 字段规范\n差异：' +
        JSON.stringify({ got: keys, want: want }));
    }
    assertNoPipelineFields(item);
    items.push(item);
  });

  /* 3) supersedes 回填（id 已分配） */
  const byCandidate = Object.create(null);
  list.forEach(function (c, i) { byCandidate[c.candidate_id] = i; });
  (Array.isArray(opts.supersedes) ? opts.supersedes : []).forEach(function (s) {
    const ni = byCandidate[s.new], oi = byCandidate[s.old];
    if (ni === undefined || oi === undefined) {
      fail('SUPERSEDES_REF_UNKNOWN', 'supersedes 引用未在 approved 集合：' + JSON.stringify(s));
    }
    if (items[ni].superseded_by_id || items[oi].supersedes_id) {
      fail('SUPERSEDES_CONFLICT', 'supersedes 互链冲突（一条候选只能属于一对）');
    }
    items[ni].supersedes_id = items[oi].id;     /* 新 → 指向旧 */
    items[oi].superseded_by_id = items[ni].id;  /* 旧 → 指向新 */
  });

  /* 4) id 全局唯一自检 */
  const seen = Object.create(null);
  items.forEach(function (it) {
    if (seen[it.id]) fail('DUPLICATE_DELIVERY_ID', '交付 id 重复：' + it.id);
    seen[it.id] = 1;
  });

  const jd = { human_confirmed: 0, rule_validated: 0, ai_suggested: 0 };
  items.forEach(function (it) { if (jd[it.judged_by] !== undefined) jd[it.judged_by]++; });

  return {
    items: items,
    report: {
      count: items.length,
      id_assignments: list.map(function (c, i) { return { from_candidate: c.candidate_id, to_delivery: ids[i] }; }),
      official_checks: officialChecks,
      judged_by_distribution: jd,
      generated_at: now
    }
  };
}

module.exports = {
  LAYER,
  SCHEMA_VERSION,
  DELIVERY_FIELDS,
  PIPELINE_ONLY_FIELDS,
  toDeliveries
};
