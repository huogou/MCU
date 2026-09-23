/* ============================================================
 * MCU 宇宙导航 · 资讯状态判定器 V1.0
 * ------------------------------------------------------------
 * 性质：纯函数规则引擎。
 *   · 零网络（不发起任何 socket / DNS 请求）
 *   · 零 AI 依赖（不调用任何模型接口）
 *   · 零副作用（不写文件、不改全局状态）
 *   · 时间可注入（便于固定时间回归）
 *
 * 依据：《资讯状态判定器 V1.0 开发任务书》第 3–6 节
 *       《资讯治理冻结确认 V1.0》第 6 节（判定器原则冻结）
 *
 * ★ 核心纪律（写死在实现里，不得放宽）：
 *   1. 判定器**不读文本、不做语义判断**。官方确认 / 官方否认 / 互斥表述
 *      这三类语义由第一层 AI 建议 + 人工复核后以**结构化标记**传入（I9）。
 *   2. 独立证据组数**由本模块自行计算**，接口一律不接受外部传入该值（I4）。
 *   3. 缺数据一律降级，绝不升格。
 *   4. 不得新增第 9 种状态。
 * ============================================================ */
'use strict';

const R = require('./news-judge-rules.cjs');

/* ============================================================
 * 输出契约：7 项必填，缺一即判定失败
 * ============================================================ */
const REQUIRED_OUTPUT_FIELDS = Object.freeze([
  'verification_status',
  'chain_steps_hit',
  'judged_by',
  'status_changed_at',
  'status_change_reason',
  'status_change_evidence_url',
  'status_history_entry'
]);

/* ============================================================
 * 基础工具（全部为纯函数）
 * ============================================================ */

/** owner_group 是否为「已确认」——与 components.js isGroupConfirmed 口径一致 */
function isGroupConfirmed(g) {
  const v = String(g == null ? '' : g).trim();
  if (!v) return false;
  if (R.UNCONFIRMED_GROUPS.indexOf(v) >= 0) return false;
  return true;
}

/** 按 source_name 查来源等级；未登记一律返回 T4（保守，绝不默认升格） */
function tierOf(sourceName) {
  const n = String(sourceName == null ? '' : sourceName).trim();
  for (let i = 0; i < R.SOURCE_REGISTRY.length; i++) {
    if (R.SOURCE_REGISTRY[i].source_name === n) return R.SOURCE_REGISTRY[i].tier;
  }
  return R.DEFAULT_TIER;
}

/** 该来源是否为「可靠来源」（tier ∈ T1–T3） */
function isReliableSource(sourceName) {
  return R.RELIABLE_TIERS.indexOf(tierOf(sourceName)) >= 0;
}

/** 解析 URL（纯字符串处理，无网络） */
function parseUrl(u) {
  const s = String(u == null ? '' : u).trim();
  if (!s) return { ok: false, protocol: '', host: '', path: '' };
  let m = /^(https?):\/\/([^\/?#]+)([^?#]*)/i.exec(s);
  if (!m) return { ok: false, protocol: '', host: '', path: '' };
  return {
    ok: true,
    protocol: m[1].toLowerCase(),
    host: m[2].toLowerCase().replace(/:\d+$/, ''),
    path: m[3] || '/'
  };
}

function hostAllowed(host, allowedDomains) {
  if (!host) return false;
  return (allowedDomains || []).some(function (d) {
    return String(d).toLowerCase() === host;
  });
}

function normalizeBase(p) {
  return String(p).replace(/\*+$/, '');
}

function pathInScope(path, basePaths) {
  return (basePaths || []).some(function (b) {
    const base = normalizeBase(b);
    if (path === base) return true;
    if (path === base.replace(/\/$/, '')) return true;
    return path.indexOf(base) === 0;
  });
}

function pathHasSlug(path, basePaths) {
  return (basePaths || []).some(function (b) {
    const base = normalizeBase(b);
    if (path.indexOf(base) !== 0) return false;
    const rest = path.slice(base.length).replace(/\/$/, '');
    return rest.length > 0;
  });
}

/**
 * path 校验（受 PATH_POLICY 开关控制）
 * legacy        —— 现行规则（与 test-news-rules.cjs 现状断言一致）
 * article-level —— Q-5 冻结的严格规则（G8 数据修正后启用）
 */
function pathAllowed(path, src, mode) {
  const excluded = src.excluded_paths || [];
  if (excluded.some(function (e) { return path.indexOf(normalizeBase(e)) === 0; })) return false;

  const basePaths = src.allowed_paths || [];
  if (!basePaths.length) return false;          /* 未登记路径 → 一律不生效（D23 规则） */

  const m = mode || R.PATH_POLICY.mode;
  if (m === 'article-level') return pathInScope(path, basePaths) && pathHasSlug(path, basePaths);
  return pathInScope(path, basePaths);
}

/** 按官方来源登记表查匹配项；未命中返回 null */
function findOfficialSource(url) {
  const p = parseUrl(url);
  if (!p.ok) return null;
  for (let i = 0; i < R.OFFICIAL_SOURCES.length; i++) {
    const s = R.OFFICIAL_SOURCES[i];
    if (hostAllowed(p.host, s.allowed_domains)) return { src: s, parsed: p };
  }
  return null;
}

/**
 * R7.4 的 Step 1–3 机器校验（本阶段只做 host / path 字符串校验）
 * Step 1 可访问性（HTTP 200）与 Step 4 内容对应事件，由 I9 标记承载，联网探测归 G3。
 */
function checkOfficialUrl(url, mode) {
  const p = parseUrl(url);
  if (!p.ok) return { pass: false, reason: 'URL 缺失或非 http(s)' };
  if (R.NON_OFFICIAL_DOMAINS.indexOf(p.host) >= 0) {
    return { pass: false, reason: 'host 属不登记域名（' + p.host + '）' };
  }
  const hit = findOfficialSource(url);
  if (!hit) return { pass: false, reason: 'host 未命中来源登记表' };
  if (!pathAllowed(p.path, hit.src, mode)) {
    return { pass: false, reason: 'path 未命中 allowed_paths（' + p.path + '）' };
  }
  return { pass: true, reason: 'host + path 均命中登记表（' + hit.src.registry_id + '）', source: hit.src };
}

/* ============================================================
 * 派生计算（I4：必须自算，禁止外部传入）
 * ============================================================ */

/**
 * 独立证据组数 —— 口径与 components.js calcIndependentGroupCount 完全一致：
 * 仅按 owner_group 去重（不做 tier 过滤）。
 */
function calcIndependentGroupCount(item) {
  const rb = (item && item.reported_by) || [];
  if (!rb.length) return 0;
  const seen = Object.create(null);
  let n = 0;
  rb.forEach(function (s) {
    const g = s && s.owner_group;
    if (!isGroupConfirmed(g)) return;
    const k = String(g).trim();
    if (!seen[k]) { seen[k] = 1; n++; }
  });
  return n;
}

/**
 * 「可靠来源」独立组数 —— 额外要求 tier ∈ {T1,T2,T3}。
 * 供 Step 5 / Step 6 使用（R3.2 要求「来源质量不低」）。
 * ※ 现有 15 条数据下该值与 calcIndependentGroupCount 逐条相同
 *   （已由黄金用例诊断项验证）；二者分离是为了满足 B9 这类边界。
 */
function calcReliableGroupCount(item) {
  const rb = (item && item.reported_by) || [];
  if (!rb.length) return 0;
  const seen = Object.create(null);
  let n = 0;
  rb.forEach(function (s) {
    if (!s) return;
    if (!isGroupConfirmed(s.owner_group)) return;
    if (!isReliableSource(s.source_name)) return;
    const k = String(s.owner_group).trim();
    if (!seen[k]) { seen[k] = 1; n++; }
  });
  return n;
}

/**
 * Step 3 判据：该事件的**全部有效报道**是否均已被其发布方更正。
 * 判定方式：reported_by 的每一项都能在 report_corrections 中找到同 source_name 的更正记录。
 */
function allReportsCorrected(item) {
  const rb = (item && item.reported_by) || [];
  const rc = (item && item.report_corrections) || [];
  if (!rb.length || !rc.length) return false;
  const corrected = Object.create(null);
  rc.forEach(function (c) { if (c && c.source_name) corrected[String(c.source_name)] = 1; });
  return rb.every(function (s) { return s && corrected[String(s.source_name)] === 1; });
}

/**
 * Step 7 判据：原始来源是否属爆料 / 消息人士 / 社交爆料。
 * 三条任一成立：
 *   a) original_source 命中爆料词表（唯一允许的文本匹配，只作用于该字段）
 *   b) reported_by 唯一项在登记表中 tier = T4
 *   c) reported_by 唯一项的 owner_group = 'unknown'
 */
function isGossipOriginal(item) {
  const os = String((item && item.original_source) || '').trim();
  if (os && os !== 'unknown') {
    for (let i = 0; i < R.GOSSIP_KEYWORDS.length; i++) {
      if (os.indexOf(R.GOSSIP_KEYWORDS[i]) >= 0) return true;
    }
  }
  const rb = (item && item.reported_by) || [];
  if (rb.length === 1 && rb[0]) {
    if (tierOf(rb[0].source_name) === 'T4') return true;
    if (String(rb[0].owner_group || '').trim().toLowerCase() === 'unknown') return true;
  }
  return false;
}

/* ============================================================
 * 八步判定链（R8.3；首个条件成立即输出并终止）
 * ============================================================ */

function firstSourceUrl(item) {
  const rb = (item && item.reported_by) || [];
  for (let i = 0; i < rb.length; i++) {
    if (rb[i] && rb[i].source_url) return String(rb[i].source_url);
  }
  return '';
}

function runChain(item, input, opts) {
  const mode = opts.pathPolicy || R.PATH_POLICY.mode;

  /* ── Step 1 官方确认 ── */
  const oc = input.official_confirm;
  if (oc && oc.url) {
    const chk = checkOfficialUrl(oc.url, mode);
    if (chk.pass && oc.reviewed === true) {
      return {
        status: R.STATUS.OFFICIAL_CONFIRMED,
        step: R.STEP.OFFICIAL_CONFIRM,
        reason: '官方来源 URL 通过 R7.4 Step 2/3 校验（' + chk.reason + '），且已完成人工复核',
        evidence: String(oc.url)
      };
    }
  }

  /* ── Step 2 官方明确否认 ── */
  const od = input.official_denial;
  if (od && od.url) {
    const chk = checkOfficialUrl(od.url, mode);
    if (chk.pass && od.reviewed === true) {
      return {
        status: R.STATUS.OFFICIALLY_DENIED,
        step: R.STEP.OFFICIAL_DENY,
        reason: '官方明确否认可回链登记表来源（' + chk.reason + '），且已完成人工复核',
        evidence: String(od.url)
      };
    }
  }

  /* ── Step 3 全部有效报道均被更正（事件级） ──
   * ★ 若仍有未被更正的报道 → 不成立，继续 Step 4 及后续（R8.5 事件级语义） */
  if (allReportsCorrected(item)) {
    const rc = (item.report_corrections || [])[0] || {};
    return {
      status: R.STATUS.CORRECTED,
      step: R.STEP.CORRECTED,
      reason: '该事件的全部有效报道均已被其发布方发布更正，且无其他有效证据',
      evidence: String(rc.evidence_url || '')
    };
  }

  /* ── Step 4 可靠来源间互斥表述 ──
   * ★ 必须早于 Step 5：存在互斥时「各来源表述一致」的前提已被破坏 */
  const cv = input.conflict_verified;
  const cs = (item && item.conflict_statements) || [];
  if (cv && cv.verified === true && cs.length >= 2) {
    return {
      status: R.STATUS.CONFLICTING,
      step: R.STEP.CONFLICTING,
      reason: '存在 ' + cs.length + ' 个可靠来源对同一要素给出互斥表述，且已经人工核准',
      evidence: String((cs[0] && cs[0].source_url) || '')
    };
  }

  const reliable = calcReliableGroupCount(item);

  /* ── Step 5 独立组 ≥2 ── */
  if (reliable >= 2) {
    return {
      status: R.STATUS.MULTI_SOURCE_REPORTED,
      step: R.STEP.MULTI_SOURCE,
      reason: '存在 ' + reliable + ' 个独立 owner_group 的可靠来源且表述一致',
      evidence: firstSourceUrl(item)
    };
  }

  /* ── Step 6 独立组 =1（可靠媒体） ── */
  if (reliable === 1) {
    return {
      status: R.STATUS.SINGLE_SOURCE,
      step: R.STEP.SINGLE_SOURCE,
      reason: '仅 1 个独立 owner_group 的可靠媒体报道',
      evidence: firstSourceUrl(item)
    };
  }

  /* ── Step 7 原始来源属爆料 ── */
  if (isGossipOriginal(item)) {
    return {
      status: R.STATUS.RUMOR,
      step: R.STEP.RUMOR,
      reason: '原始来源属爆料 / 消息人士 / 社交爆料类',
      evidence: String(item.original_source_url || firstSourceUrl(item) || '')
    };
  }

  /* ── Step 8 兜底 ── */
  return {
    status: R.STATUS.UNVERIFIED,
    step: R.STEP.FALLBACK,
    reason: '来源数量与层级均不足，以上判定条件全部不成立',
    evidence: ''
  };
}

/* ============================================================
 * 主入口
 * ============================================================ */

/**
 * 判定单条资讯。
 * @param {object} item   资讯条目（须含 id / reported_by 等；只读，不修改）
 * @param {object} input  I9 语义标记：{ official_confirm:{url,reviewed},
 *                          official_denial:{url,reviewed}, conflict_verified:{verified} }
 * @param {object} opts   { now, pathPolicy, previousStatus, judgedBy }
 * @returns {object} 7 项输出契约 + 诊断字段
 * @throws {Error} 输入非法或输出契约不完整时显式抛错（不静默返回默认值）
 */
function judge(item, input, opts) {
  if (!item || typeof item !== 'object') throw new Error('judge: item 必须为对象');
  if (!item.id) throw new Error('judge: item.id 缺失');
  opts = opts || {};
  input = input || {};

  const now = opts.now || new Date().toISOString();
  const hit = runChain(item, input, opts);

  if (R.STATUS_LIST.indexOf(hit.status) < 0) {
    throw new Error('judge: 产出状态不在 8 态枚举内 → ' + hit.status);
  }

  /* judged_by：需人工介入的 4 步记为 human_confirmed，其余为 rule_validated
   * ※ 该字段记录「谁确认的」，非规则输出；可被 opts.judgedBy 覆盖
   *   （如 003 号条目系人工复核发现伪多源，数据中记为 human_confirmed） */
  const judgedBy = opts.judgedBy ||
    (R.HUMAN_REVIEW_STEPS.indexOf(hit.step) >= 0 ? 'human_confirmed' : 'rule_validated');

  const result = {
    id: String(item.id),
    verification_status: hit.status,
    chain_steps_hit: hit.step,
    judged_by: judgedBy,
    status_changed_at: now,
    status_change_reason: hit.reason,
    status_change_evidence_url: hit.evidence,
    status_history_entry: {
      from: opts.previousStatus === undefined ? null : opts.previousStatus,
      to: hit.status,
      at: now,
      reason: hit.reason,
      evidence_url: hit.evidence
    },
    /* ---- 诊断字段（不属交付物，供测试与报告使用） ---- */
    rule_version: R.RULE_VERSION,
    path_policy: opts.pathPolicy || R.PATH_POLICY.mode,
    independent_group_count: calcIndependentGroupCount(item),
    reliable_group_count: calcReliableGroupCount(item)
  };

  const missing = REQUIRED_OUTPUT_FIELDS.filter(function (k) { return !(k in result); });
  if (missing.length) throw new Error('judge: 输出契约不完整，缺少 ' + missing.join(', '));

  return result;
}

/** 批量判定；inputsById 为 id → I9 标记 的映射 */
function judgeAll(items, inputsById, opts) {
  const map = inputsById || {};
  return (items || []).map(function (it) {
    return judge(it, map[it && it.id], opts);
  });
}

module.exports = {
  RULE_VERSION: R.RULE_VERSION,
  REQUIRED_OUTPUT_FIELDS,
  STATUS: R.STATUS,
  STEP: R.STEP,
  /* 派生与判据（导出以便单测） */
  isGroupConfirmed,
  tierOf,
  isReliableSource,
  parseUrl,
  checkOfficialUrl,
  pathAllowed,
  calcIndependentGroupCount,
  calcReliableGroupCount,
  allReportsCorrected,
  isGossipOriginal,
  /* 入口 */
  judge,
  judgeAll
};
