/* ============================================================
 * MCU 宇宙导航 · 官方来源校验器 V1.0（G3）
 * ------------------------------------------------------------
 * 性质：R7.4 官方来源校验规则的**纯函数验证层**。
 *   · 零网络：不发起任何请求、不抓取任何页面
 *   · 零副作用：不写文件、不改全局
 *   · 确定性：同输入必得同输出
 *
 * 依据：《MCU宇宙导航｜官方来源校验器 V1.0 开发任务书（G3）》
 *       + V2.2 R7.4（official_source 判定六步校验）
 *       + G0 冻结确认（PATH_POLICY 默认 legacy）
 *
 * ★ 数据来源纪律：
 *   域名事实（allowed_domains / allowed_paths / excluded_paths /
 *   non_official_domains）**一律来自 source-registry.json**，本文件
 *   **不硬编码任何域名**。
 *   path 策略开关复用 G1 的 PATH_POLICY（不另建第二套策略），
 *   以保证「legacy / article-level」只有一个权威定义。
 *
 * ★ 本层不覆盖的 R7.4 步骤：
 *   Step 1 URL 可达性（HTTP 200）—— 需联网，G3 明确不做；
 *   Step 4「内容确实对应当前事件」的内容层面比对 —— 需抓取正文，G3 明确不做；
 *           本层只校验「声明的 event_id 是否与官方确认记录的 event_id 一致」。
 * ============================================================ */
'use strict';

const registry = require('../news-registry.cjs');
const judge = require('../news-judge.cjs');
const rules = require('../news-judge-rules.cjs');

const RULE_VERSION = 'V1.0';

/* 固定检查顺序（用于 reason 选取与报告展示） */
const CHECK_ORDER = Object.freeze([
  'url_scheme',
  'domain_allowed',
  'path_allowed',
  'domain_blacklist',
  'registry_match',
  'review_required'
]);

/* ---------------- 内部工具（纯函数，不含任何域名常量） ---------------- */

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

/** host 是否命中给定域名列表（列表来自登记表，非硬编码） */
function hostInList(host, domains) {
  if (!host || !Array.isArray(domains) || !domains.length) return false;
  const h = String(host).toLowerCase();
  return domains.some(function (d) { return String(d).toLowerCase() === h; });
}

/** 精确取登记表中的条目（按 source_name），用于资格复核 */
function lookupRegistered(entry) {
  if (!entry || !isNonEmptyString(entry.source_name)) return null;
  return registry.bySourceName(entry.source_name);
}

/* ============================================================
 * 六项检查
 * ============================================================ */

/** 检查 1：URL 基础校验 —— 非空 + http(s) */
function checkUrlScheme(input) {
  const raw = input && input.source_url;
  if (!isNonEmptyString(raw)) {
    return { pass: false, detail: 'URL 为空（禁止空 URL）' };
  }
  const p = judge.parseUrl(raw);
  if (!p.ok) {
    return { pass: false, detail: '非 http(s) 协议或 URL 格式非法：「' + String(raw).trim() + '」' };
  }
  return { pass: true, detail: '协议合法（' + p.protocol + '），host=' + p.host + '，path=' + p.path };
}

/** 检查 2：域名是否命中 registry_entry.allowed_domains */
function checkDomainAllowed(input, parsed) {
  const entry = input && input.registry_entry;
  if (!entry) {
    return { pass: false, detail: '未提供 registry_entry，无法做域名校验' };
  }
  const domains = entry.allowed_domains;
  if (!Array.isArray(domains) || !domains.length) {
    return { pass: false, detail: 'registry_entry.allowed_domains 为空（该来源未登记任何域名）' };
  }
  if (!parsed || !parsed.ok) {
    return { pass: false, detail: 'URL 非法，无法取得 host' };
  }
  const hit = hostInList(parsed.host, domains);
  return {
    pass: hit,
    detail: hit
      ? 'host ' + parsed.host + ' 命中登记域名'
      : 'host ' + parsed.host + ' 未命中登记域名（登记：' + domains.join(' / ') + '）'
  };
}

/** 检查 3：path 是否命中 allowed_paths（受 PATH_POLICY 控制，默认 legacy） */
function checkPathAllowed(input, parsed, opts) {
  const entry = input && input.registry_entry;
  if (!entry) return { pass: false, detail: '未提供 registry_entry，无法做路径校验' };
  if (!parsed || !parsed.ok) return { pass: false, detail: 'URL 非法，无法取得 path' };

  /* 显式排除路径优先（excluded_paths 亦来自登记表） */
  const excluded = entry.excluded_paths || [];
  const excludedHit = excluded.some(function (e) {
    const base = String(e).replace(/\*+$/, '');
    return parsed.path.indexOf(base) === 0;
  });
  if (excludedHit) {
    return { pass: false, detail: 'path 落在 excluded_paths（' + parsed.path + '）' };
  }

  const policyMode = (opts && opts.pathPolicy) || rules.PATH_POLICY.mode;

  const pass = judge.pathAllowed(parsed.path, entry, policyMode);
  return {
    pass: pass,
    detail: pass
      ? 'path ' + parsed.path + ' 命中 allowed_paths（策略 ' + policyMode + '）'
      : 'path ' + parsed.path + ' 未命中 allowed_paths（策略 ' + policyMode + '，登记：' +
        (entry.allowed_paths || []).join(' / ') + '）'
  };
}

/** 检查 4：是否命中 non_official_domains 黑名单（命中即失败） */
function checkDomainBlacklist(parsed) {
  const list = registry.NON_OFFICIAL_DOMAINS;
  if (!parsed || !parsed.ok) return { pass: false, detail: 'URL 非法，无法做黑名单校验' };
  const hit = hostInList(parsed.host, list);
  return {
    pass: !hit,
    detail: hit
      ? '★ host ' + parsed.host + ' 命中 non_official_domains 黑名单，直接失败'
      : 'host ' + parsed.host + ' 不在黑名单（黑名单 ' + list.length + ' 项）'
  };
}

/** 检查 5：官方来源资格判断 + 条目真实性复核
 *  条件：official_or_media = official 且 allowed_domains 存在
 *  另加：source_name 须与传入 registry_entry 一致，且该条目在登记表中可查到
 */
function checkRegistryMatch(input) {
  const entry = input && input.registry_entry;
  if (!entry) return { pass: false, detail: '未登记来源：未提供 registry_entry' };

  if (entry.official_or_media !== 'official') {
    return { pass: false, detail: '资格不符：official_or_media=' + entry.official_or_media + '（须为 official）' };
  }
  if (!Array.isArray(entry.allowed_domains) || !entry.allowed_domains.length) {
    return { pass: false, detail: '资格不符：allowed_domains 为空 → 不得进入 official_confirm 判断' };
  }

  const registered = lookupRegistered(entry);
  if (!registered) {
    return { pass: false, detail: '登记表中查无此来源：' + entry.source_name };
  }
  if (registered.registry_id !== entry.registry_id) {
    return { pass: false, detail: 'registry_id 与登记表不一致（传入 ' + entry.registry_id + '，登记表 ' + registered.registry_id + '）' };
  }
  if (isNonEmptyString(input.source_name) && input.source_name.trim() !== registered.source_name) {
    return { pass: false, detail: 'source_name 与条目不符（传入「' + input.source_name + '」，条目「' + registered.source_name + '」）' };
  }
  const inOfficial = registry.officialSources().some(function (s) {
    return s.registry_id === registered.registry_id;
  });
  if (!inOfficial) {
    return { pass: false, detail: '该条目未进入官方来源登记派生结果（' + registered.registry_id + '）' };
  }
  return { pass: true, detail: '资格成立：official 且域名已登记（' + registered.registry_id + '）' };
}

/** 检查 6：官方确认所需的人工复核是否已完成 + 事件 ID 关联
 *  ★ R7.4 Step 4 的「内容确实对应当前事件」需抓取正文，G3 不做；
 *    本层只校验 ID 层面的关联声明。
 */
function checkReviewRequired(input) {
  const oc = input && input.official_confirm;
  if (!oc) return { pass: false, detail: '未提供 official_confirm 记录 → 复核要求未满足' };
  if (oc.reviewed !== true) return { pass: false, detail: '人工复核未通过（reviewed ≠ true）' };

  const claimed = input.claimed_event_id;
  const declared = oc.event_id;
  if (isNonEmptyString(claimed) && isNonEmptyString(declared) && claimed.trim() !== declared.trim()) {
    return {
      pass: false,
      detail: '事件 ID 不一致（claimed_event_id「' + claimed + '」≠ official_confirm.event_id「' + declared + '」）'
    };
  }
  return {
    pass: true,
    detail: '人工复核已通过' + (isNonEmptyString(claimed) && isNonEmptyString(declared)
      ? '，且事件 ID 一致（' + claimed + '）'
      : '，未提供成对事件 ID（跳过 ID 关联校验）')
  };
}

/* ============================================================
 * 主入口
 * ============================================================ */

/**
 * 校验一个官方来源声明。
 * @param {object} input {
 *   source_url       待校验的官方来源 URL（必填）
 *   source_name      来源名称（用于与登记表条目复核）
 *   registry_entry   登记表条目（须来自 source-registry.json）
 *   claimed_event_id 本条声称对应的事件 id
 *   official_confirm { reviewed:boolean, event_id?:string }
 * }
 * @param {object} opts { pathPolicy: 'legacy' | 'article-level' }（默认 legacy）
 * @returns {{valid:boolean, checks:object, reason:string, rule_version:string}}
 */
function validateOfficialSource(input, opts) {
  const src = input || {};
  const parsed = judge.parseUrl(src.source_url);

  const checks = {
    url_scheme:       checkUrlScheme(src),
    domain_allowed:   checkDomainAllowed(src, parsed),
    path_allowed:     checkPathAllowed(src, parsed, opts),
    domain_blacklist: checkDomainBlacklist(parsed),
    registry_match:   checkRegistryMatch(src),
    review_required:  checkReviewRequired(src)
  };

  /* 不做短路：六项全部计算并返回，便于调用方与审计看到全貌。
   * valid 要求六项全部通过。 */
  const failed = CHECK_ORDER.filter(function (k) { return checks[k].pass !== true; });
  const valid = failed.length === 0;

  let reason;
  if (valid) {
    reason = '六项检查全部通过：可进入 official_confirm 判断';
  } else {
    const first = failed[0];
    reason = '未通过 ' + failed.length + ' 项（' + failed.join(', ') + '）；首个失败项 ' +
      first + ' → ' + checks[first].detail;
  }

  return {
    valid: valid,
    checks: checks,
    reason: reason,
    rule_version: RULE_VERSION
  };
}

module.exports = {
  RULE_VERSION,
  CHECK_ORDER,
  validateOfficialSource,
  /* 导出内部检查项，便于单测与复用 */
  checks: {
    url_scheme: checkUrlScheme,
    domain_allowed: checkDomainAllowed,
    path_allowed: checkPathAllowed,
    domain_blacklist: checkDomainBlacklist,
    registry_match: checkRegistryMatch,
    review_required: checkReviewRequired
  },
  /* 内部工具（纯逻辑，不含域名常量） */
  hostInList
};
