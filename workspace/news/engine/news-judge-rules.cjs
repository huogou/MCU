/* ============================================================
 * MCU 宇宙导航 · 资讯状态判定器 V1.0 —— 规则与常量
 * ------------------------------------------------------------
 * 性质：纯数据与常量模块。零网络、零副作用。
 * 依据：《MCU宇宙导航｜资讯治理冻结确认 V1.0》第 4 / 5 / 6 节
 *       + 《资讯状态判定器 V1.0 开发任务书》第 4 节
 *
 * ★ G2 变更（2026-09-22）：来源数据不再内联，改为消费
 *   `registry/source-registry.json`（经 news-registry.cjs 加载与校验）。
 *   即本文件不再持有来源事实，只持有**规则常量**。
 *
 * 纪律：
 *   · 不得新增第 9 种状态（前端 NEWS_LABEL 仅 8 键，未知值兜底 unverified）
 *   · tier 仅用于采集过滤与判定输入，不得渲染、不得映射为状态
 *   · owner_group 未确认一律写「待核」，禁止凭来源名填空
 * ============================================================ */
'use strict';

const REG = require('./news-registry.cjs');

const RULE_VERSION = 'V1.0';

/* ---------------- 状态枚举（8 态，冻结） ---------------- */
const STATUS = Object.freeze({
  OFFICIAL_CONFIRMED:    'official_confirmed',
  MULTI_SOURCE_REPORTED: 'multi_source_reported',
  SINGLE_SOURCE:         'single_source',
  RUMOR:                 'rumor',
  UNVERIFIED:            'unverified',
  CONFLICTING:           'conflicting',
  OFFICIALLY_DENIED:     'officially_denied',
  CORRECTED:             'corrected'
});

const STATUS_LIST = Object.freeze([
  STATUS.OFFICIAL_CONFIRMED,
  STATUS.MULTI_SOURCE_REPORTED,
  STATUS.SINGLE_SOURCE,
  STATUS.RUMOR,
  STATUS.UNVERIFIED,
  STATUS.CONFLICTING,
  STATUS.OFFICIALLY_DENIED,
  STATUS.CORRECTED
]);

/* ---------------- 判定链步骤标识（R8.3 八步） ---------------- */
const STEP = Object.freeze({
  OFFICIAL_CONFIRM:   'Step 1',
  OFFICIAL_DENY:      'Step 2',
  CORRECTED:          'Step 3',
  CONFLICTING:        'Step 4',
  MULTI_SOURCE:       'Step 5',
  SINGLE_SOURCE:      'Step 6',
  RUMOR:              'Step 7',
  FALLBACK:           'Step 8'
});

/* 需要人工介入的步骤（R3.5 第三层） */
const HUMAN_REVIEW_STEPS = Object.freeze([
  STEP.OFFICIAL_CONFIRM, STEP.OFFICIAL_DENY, STEP.CORRECTED, STEP.CONFLICTING
]);

/* ---------------- owner_group 口径（R6.1 / R8.3 约束 b） ----------------
 * ★ 注意与登记表的 UNCONFIRMED_GROUPS（2 值，「待核」「未确认」）区分：
 *   判定器侧额外把字面量 'unknown' 也视为未确认（历史数据中存在该取值）。
 * ---------------------------------------------------------------------- */
const UNCONFIRMED_GROUPS = Object.freeze(['待核', '未确认', 'unknown']);

/* ---------------- 来源可信等级（冻结确认 5.3） ---------------- */
const TIERS = Object.freeze(['T1', 'T2', 'T3', 'T4']);
/* 「可靠来源」= tier ∈ {T1,T2,T3}；T4 一律不构成可靠来源（冻结确认 6.4） */
const RELIABLE_TIERS = Object.freeze(['T1', 'T2', 'T3']);
/* 未登记来源的默认等级：T4（保守，绝不默认升格） */
const DEFAULT_TIER = 'T4';

/* ---------------- 爆料词表（Step 7 用，仅匹配 original_source 字段） ----
 * 说明：这是判定器**唯一允许**的文本匹配，且只作用于 original_source
 *      这一最小封闭字段（R8.3 Step 7 的判据本身即「原始来源是否属爆料」）。
 *      **禁止**对 title / summary 做任何匹配或推断。
 *      词表为待校准项（任务书开放点 O-2）。
 * ---------------------------------------------------------------------- */
const GOSSIP_KEYWORDS = Object.freeze([
  '业内人士', '消息人士', '内部人士', '知情人士', '爆料', '未具名',
  '匿名', '传闻', '网传', '据称', '疑似', 'allegedly', 'insider', 'unnamed', 'rumor'
]);

/* ============================================================
 * 来源数据（★ G2 起改为从登记表加载，本模块不再内联）
 * ============================================================ */
const REGISTRY_VERSION = REG.REGISTRY_VERSION;

/** 登记表全部条目（20 字段）。判定器只消费 source_name / owner_group / tier */
const SOURCE_REGISTRY = Object.freeze(REG.all());

/** 官方来源登记（R7.4 的 host / path 校验依据）
 *  由 official_or_media='official' 且 allowed_domains 非空的条目派生 ——
 *  「域名未登记 → 不构成官方确认依据」由此规则保证（如 S010 / S011）。 */
const OFFICIAL_SOURCES = Object.freeze(REG.officialSources());

/** 不登记为 official 的域名（不得构成 official_confirmed） */
const NON_OFFICIAL_DOMAINS = REG.NON_OFFICIAL_DOMAINS;

/* ---------------- path 校验策略（★ E-1 关键开关） ----------------------
 * 'legacy'        —— 现行规则，与 test-news-rules.cjs 现状断言一致：
 *                    允许 /news 或 /news/（栏目页），允许 /articles/{movies|tv-shows|live-events}/
 * 'article-level' —— Q-5 冻结的严格规则：路径至少含一级 slug 段
 *                    （即 /news/{slug}），仅允许文章级 URL
 *
 * ★ 默认 'legacy'。原因：E-1 已确认「规则冻结立即生效，历史数据整改延后至 G8」，
 *   若在 G1 直接启用严格模式，001 / 009 / 013（官方 URL 为栏目页 / 目录页）
 *   将无法通过 Step 1 / Step 2，与「黄金用例必须复现现有状态」直接冲突。
 *   G8 完成 URL 修正后，把本开关切为 'article-level' 并同步收紧测试断言。
 * ---------------------------------------------------------------------- */
const PATH_POLICY = Object.freeze({
  mode: 'legacy',
  legacy: Object.freeze({
    /* /news 或 /news/（无后续段）视为合法；/articles/{影视类}/ 视为合法 */
    newsRe: /^\/news\/?$/,
    articlesRe: /^\/articles\/(movies|tv-shows|live-events)\/?$/
  }),
  articleLevel: Object.freeze({
    /* 至少一级 slug：/news/{slug}（可再带尾斜杠） */
    newsRe: /^\/news\/[^\/]+\/?$/,
    articlesRe: /^\/articles\/(movies|tv-shows|live-events)\/[^\/]+\/?$/
  })
});

module.exports = {
  RULE_VERSION,
  REGISTRY_VERSION,
  STATUS,
  STATUS_LIST,
  STEP,
  HUMAN_REVIEW_STEPS,
  UNCONFIRMED_GROUPS,
  TIERS,
  RELIABLE_TIERS,
  DEFAULT_TIER,
  GOSSIP_KEYWORDS,
  SOURCE_REGISTRY,
  OFFICIAL_SOURCES,
  NON_OFFICIAL_DOMAINS,
  PATH_POLICY
};
