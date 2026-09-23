/* ============================================================
 * MCU 宇宙导航 · source_registry V1.0 —— 加载器 + 校验器
 * ------------------------------------------------------------
 * 性质：管道层数据层的唯一入口。
 *   · 零网络：只读本地 JSON
 *   · 零副作用：不写文件、不改全局数据
 *   · 无 h5 依赖：不引用 h5/ 下任何文件（跨文件一致性由测试脚本负责）
 *
 * 依据：《MCU宇宙导航｜资讯治理冻结确认 V1.0》第 5 节（20 字段 + 枚举 + 维护规则）
 *
 * ★ 硬约束（写死在实现里）：
 *   1. registry 的任何字段都不得渲染进 H5。
 *   2. owner_group 未确认时必须恰为「待核」或「未确认」，禁止空白、禁止猜测。
 *   3. crawl_policy 为 ai_ban_named / ai_ban_notice / blocked 的来源，
 *      enabled 必须为 false（合规联动，R6.3）。
 *   4. registry_id 永不重用、永不改号；停用只改 enabled / health，不删记录。
 * ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');

const REGISTRY_PATH = path.join(__dirname, 'registry', 'source-registry.json');

/* ---------------- 冻结的枚举（与冻结确认 5.3 一致） ---------------- */
const TIERS = Object.freeze(['T1', 'T2', 'T3', 'T4']);
const CRAWL_POLICIES = Object.freeze(['auto_allowed', 'manual_only', 'ai_ban_named', 'ai_ban_notice', 'blocked']);
const HEALTHS = Object.freeze(['ok', 'degraded', 'paused']);
const SOURCE_TYPES = Object.freeze(['官方', '权威媒体', 'MCU垂直媒体', '公告平台']);
const OFFICIAL_OR_MEDIA = Object.freeze(['official', 'media']);
const DISCOVERY_ROLES = Object.freeze(['发现器', '验证器', '公告核实器', '人工']);
const FEED_TYPES = Object.freeze(['rss', 'atom', 'html-parse', 'none']);
const UNCONFIRMED_GROUPS = Object.freeze(['待核', '未确认']);
/* 合规联动：这些 crawl_policy 必须 enabled = false */
const POLICY_REQUIRES_DISABLED = Object.freeze(['ai_ban_named', 'ai_ban_notice', 'blocked']);

/* 20 个字段（顺序即冻结顺序，不得增删改名） */
const FIELDS_20 = Object.freeze([
  'registry_id', 'source_name', 'owner_group', 'tier', 'crawl_policy',
  'health', 'note', 'source_type', 'official_or_media', 'discovery_role',
  'feed_type', 'feed_url', 'allowed_domains', 'allowed_paths', 'excluded_paths',
  'source_role', 'last_check_at', 'consecutive_failures', 'enabled', 'registry_version'
]);

/* ---------------- 加载 ---------------- */
function load() {
  const raw = fs.readFileSync(REGISTRY_PATH, 'utf8');
  let doc;
  try {
    doc = JSON.parse(raw);
  } catch (e) {
    throw new Error('source-registry.json 解析失败：' + e.message);
  }
  if (!doc || !Array.isArray(doc.entries)) {
    throw new Error('source-registry.json 结构非法：缺少 entries 数组');
  }
  return doc;
}

const DOC = load();
const ENTRIES = DOC.entries;
const REGISTRY_VERSION = DOC.registry_version;
const NON_OFFICIAL_DOMAINS = Object.freeze((DOC.non_official_domains || []).slice());

/* ---------------- 索引（加载期一次性建立，运行时只读） ---------------- */
const BY_ID = Object.create(null);
const BY_NAME = Object.create(null);
ENTRIES.forEach(function (e) {
  BY_ID[e.registry_id] = e;
  BY_NAME[e.source_name] = e;
});

/* ---------------- 查询 API ---------------- */

/** 全部条目（深拷贝，防止调用方改动内部状态） */
function all() {
  return ENTRIES.map(function (e) { return Object.assign({}, e); });
}

function byId(id) {
  return BY_ID[id] ? Object.assign({}, BY_ID[id]) : null;
}

function bySourceName(name) {
  const n = String(name == null ? '' : name).trim();
  return BY_NAME[n] ? Object.assign({}, BY_NAME[n]) : null;
}

/** 该来源是否已在登记表中（用于「未登记来源」识别） */
function isRegistered(name) {
  return !!bySourceName(name);
}

/**
 * 来源等级。未登记来源返回 null —— ★ 注意：
 * 判定器侧对未登记来源按 T4 处理（保守降级），但登记表本身
 * 不伪造一个 T4 条目，以保持「未登记」与「登记为 T4」可区分。
 */
function getTier(name) {
  const e = bySourceName(name);
  return e ? e.tier : null;
}

function getOwnerGroup(name) {
  const e = bySourceName(name);
  return e ? e.owner_group : null;
}

function isEnabled(name) {
  const e = bySourceName(name);
  return e ? e.enabled === true : false;
}

/**
 * 官方来源登记（用于 R7.4 的 host / path 校验）
 * 派生规则：official_or_media = 'official' 且 allowed_domains 非空。
 * 「域名未登记 → 不构成官方确认依据」由此规则保证（如 S010 / S011）。
 */
function officialSources() {
  return ENTRIES.filter(function (e) {
    return e.official_or_media === 'official' && (e.allowed_domains || []).length > 0;
  }).map(function (e) {
    return {
      registry_id: e.registry_id,
      source_name: e.source_name,
      owner_group: e.owner_group,
      allowed_domains: (e.allowed_domains || []).slice(),
      allowed_paths: (e.allowed_paths || []).slice(),
      excluded_paths: (e.excluded_paths || []).slice(),
      source_role: e.source_role
    };
  });
}

/** 本阶段实际启用（进入流水线）的来源 */
function enabledSources() {
  return ENTRIES.filter(function (e) { return e.enabled === true; })
    .map(function (e) { return e.registry_id + ' ' + e.source_name; });
}

/* ============================================================
 * 校验器（R-01 – R-20，全部为登记表内部一致性检查）
 * 返回 { pass, total, failed, issues: [{rule, level, target, message}] }
 * ============================================================ */
function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}
function isStringArray(v) {
  return Array.isArray(v) && v.every(function (x) { return typeof x === 'string'; });
}
function isHttpUrl(u) {
  return typeof u === 'string' && /^https?:\/\/[^\s]+$/i.test(u);
}
function isIso8601(v) {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/.test(v);
}

function validate(entries) {
  const list = entries || ENTRIES;
  const issues = [];
  function bad(rule, target, message) {
    issues.push({ rule: rule, level: 'FAIL', target: target, message: message });
  }

  /* ---- 结构类 ---- */
  list.forEach(function (e, i) {
    const tag = (e && e.registry_id) || ('#' + i);
    if (!e || typeof e !== 'object') { bad('R-01', tag, '条目不是对象'); return; }

    /* R-05 20 字段齐备且无多余键 */
    const keys = Object.keys(e);
    const missing = FIELDS_20.filter(function (k) { return keys.indexOf(k) < 0; });
    const extra = keys.filter(function (k) { return FIELDS_20.indexOf(k) < 0; });
    if (missing.length) bad('R-05', tag, '缺少字段：' + missing.join(', '));
    if (extra.length) bad('R-05', tag, '存在 20 字段之外的键：' + extra.join(', '));

    /* R-01 registry_id 格式 */
    if (!isNonEmptyString(e.registry_id) || !/^S\d{3}$/.test(e.registry_id)) {
      bad('R-01', tag, 'registry_id 须形如 S001');
    }
    /* R-03 source_name 非空 */
    if (!isNonEmptyString(e.source_name)) bad('R-03', tag, 'source_name 为空');
    /* R-06 registry_version 与顶层一致 */
    if (e.registry_version !== REGISTRY_VERSION) {
      bad('R-06', tag, 'registry_version=' + e.registry_version + '，顶层=' + REGISTRY_VERSION);
    }
    /* R-16 类型检查 */
    if (!isStringArray(e.allowed_domains)) bad('R-16', tag, 'allowed_domains 必须为字符串数组');
    if (!isStringArray(e.allowed_paths)) bad('R-16', tag, 'allowed_paths 必须为字符串数组');
    if (!isStringArray(e.excluded_paths)) bad('R-16', tag, 'excluded_paths 必须为字符串数组');
    if (!Number.isInteger(e.consecutive_failures) || e.consecutive_failures < 0) {
      bad('R-16', tag, 'consecutive_failures 必须为 ≥0 的整数');
    }
    if (typeof e.enabled !== 'boolean') bad('R-16', tag, 'enabled 必须为布尔');
    if (!isNonEmptyString(e.note)) bad('R-16', tag, 'note 不得为空（解析陷阱 / 待核原因须留痕）');

    /* ---- 枚举类 ---- */
    if (TIERS.indexOf(e.tier) < 0) bad('R-07', tag, 'tier 非枚举值：「' + e.tier + '」');
    if (CRAWL_POLICIES.indexOf(e.crawl_policy) < 0) bad('R-08', tag, 'crawl_policy 非枚举值：「' + e.crawl_policy + '」');
    if (HEALTHS.indexOf(e.health) < 0) bad('R-09', tag, 'health 非枚举值：「' + e.health + '」');
    if (SOURCE_TYPES.indexOf(e.source_type) < 0) bad('R-10', tag, 'source_type 非枚举值：「' + e.source_type + '」');
    if (OFFICIAL_OR_MEDIA.indexOf(e.official_or_media) < 0) bad('R-11', tag, 'official_or_media 非枚举值：「' + e.official_or_media + '」');
    if (DISCOVERY_ROLES.indexOf(e.discovery_role) < 0) bad('R-12', tag, 'discovery_role 非枚举值：「' + e.discovery_role + '」');
    if (FEED_TYPES.indexOf(e.feed_type) < 0) bad('R-13', tag, 'feed_type 非枚举值：「' + e.feed_type + '」');

    /* ---- 条件必填 ---- */
    /* R-14 feed_type ≠ none → feed_url 必须为有效 http(s) */
    if (e.feed_type !== 'none') {
      if (!isHttpUrl(e.feed_url)) bad('R-14', tag, 'feed_type=' + e.feed_type + ' 但 feed_url 非法：「' + e.feed_url + '」');
    } else if (e.feed_url !== '') {
      bad('R-14', tag, 'feed_type=none 时 feed_url 必须为空字符串');
    }
    /* R-15 enabled=true → feed_type ≠ none */
    if (e.enabled === true && e.feed_type === 'none') {
      bad('R-15', tag, 'enabled=true 但 feed_type=none（无抓取出口）');
    }
    /* R-18 last_check_at 须为 ISO8601 */
    if (!isIso8601(e.last_check_at)) bad('R-18', tag, 'last_check_at 非 ISO8601：「' + e.last_check_at + '」');

    /* ---- 一致性类 ---- */
    /* R-17 owner_group 非空；未确认时必须恰为「待核」或「未确认」 */
    if (!isNonEmptyString(e.owner_group)) {
      bad('R-17', tag, 'owner_group 为空（未确认须显式写「待核」）');
    } else {
      const g = e.owner_group.trim();
      if (g !== '待核' && g !== '未确认' && g.length < 2) {
        bad('R-17', tag, 'owner_group 取值可疑：「' + g + '」');
      }
    }
    /* R-19 official_or_media = 'official' ↔ tier = 'T1'（双向） */
    if (e.official_or_media === 'official' && e.tier !== 'T1') {
      bad('R-19', tag, 'official 来源的 tier 必须为 T1，当前=' + e.tier);
    }
    if (e.tier === 'T1' && e.official_or_media !== 'official') {
      bad('R-19', tag, 'tier=T1 的来源 official_or_media 必须为 official，当前=' + e.official_or_media);
    }
    /* R-20 allowed_* / excluded_* 仅 official 可非空 */
    if (e.official_or_media !== 'official') {
      const leaked = (e.allowed_domains || []).length + (e.allowed_paths || []).length + (e.excluded_paths || []).length;
      if (leaked > 0) bad('R-20', tag, '非官方来源不得填写 allowed_* / excluded_*');
    }
    /* R-21 合规联动：ai_ban_* / blocked 必须 enabled = false */
    if (POLICY_REQUIRES_DISABLED.indexOf(e.crawl_policy) >= 0 && e.enabled !== false) {
      bad('R-21', tag, 'crawl_policy=' + e.crawl_policy + ' 时 enabled 必须为 false（合规联动 R6.3）');
    }
  });

  /* ---- 唯一性（跨条目） ---- */
  const seenId = Object.create(null), seenName = Object.create(null);
  list.forEach(function (e) {
    if (!e) return;
    if (seenId[e.registry_id]) bad('R-02', e.registry_id, 'registry_id 重复（永不重用、永不改号）');
    seenId[e.registry_id] = 1;
    if (seenName[e.source_name]) bad('R-04', e.source_name, 'source_name 重复（须唯一，且与生产数据逐字符一致）');
    seenName[e.source_name] = 1;
  });

  /* ---- 附属黑名单 ---- */
  if (!Array.isArray(DOC.non_official_domains) || DOC.non_official_domains.length === 0) {
    bad('R-22', 'non_official_domains', '附属黑名单缺失或为空');
  }
  /* 黑名单域名不得出现在任何 official 条目的 allowed_domains */
  list.forEach(function (e) {
    if (!e || e.official_or_media !== 'official') return;
    (e.allowed_domains || []).forEach(function (d) {
      if (NON_OFFICIAL_DOMAINS.indexOf(d) >= 0) {
        bad('R-22', e.registry_id, '不登记域名出现在 allowed_domains：' + d);
      }
    });
  });

  return {
    pass: issues.length === 0,
    total: list.length,
    failed: issues.length,
    issues: issues
  };
}

module.exports = {
  REGISTRY_PATH,
  REGISTRY_VERSION,
  FIELDS_20,
  ENUMS: {
    TIERS, CRAWL_POLICIES, HEALTHS, SOURCE_TYPES,
    OFFICIAL_OR_MEDIA, DISCOVERY_ROLES, FEED_TYPES, UNCONFIRMED_GROUPS
  },
  NON_OFFICIAL_DOMAINS,
  DOC: { built_at: DOC.built_at, note: DOC.note, non_official_domains_note: DOC.non_official_domains_note },
  /* 查询 */
  all, byId, bySourceName, isRegistered, getTier, getOwnerGroup, isEnabled,
  officialSources, enabledSources,
  /* 校验 */
  validate
};
