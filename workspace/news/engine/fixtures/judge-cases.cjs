/* ============================================================
 * 判定器测试夹具
 * ------------------------------------------------------------
 * GOLDEN_INPUTS  —— 15 条黄金用例的**输入侧车**（I9 语义标记 + 判定选项）
 * GOLDEN_EXPECT  —— 15 条黄金用例的期望输出（任务书 7.1 表）
 * BOUNDARY_CASES —— 合成边界用例 B1–B10（自造输入，不写入 h5/data/news.js）
 *
 * ★ 侧车只提供「语义标记」，严禁从 title / summary / status_history
 *   文本反推（冻结确认 6.2）。
 * ★ 本文件不修改任何生产数据，纯粹是测试输入。
 * ============================================================ */
'use strict';

/* ---------------- 15 条黄金用例的输入侧车 ---------------- */
/* 结构：id → { input: I9 标记, opts: 判定选项 } */

const GOLDEN_INPUTS = {
  'news-2026-09-22-001': {
    input: { official_confirm: { url: 'https://www.marvel.com/news', reviewed: true } }
  },
  'news-2026-09-22-002': { input: {} },
  'news-2026-09-22-003': {
    input: {},
    opts: { judgedBy: 'human_confirmed' }   /* 数据记录：伪多源系人工复核发现 */
  },
  'news-2026-09-22-004': { input: {} },
  'news-2026-09-22-005': { input: {} },
  'news-2026-09-21-006': { input: {} },
  'news-2026-09-21-007': { input: {} },
  'news-2026-09-21-008': {
    input: { conflict_verified: { verified: true } }
  },
  'news-2026-09-20-009': {
    input: { official_denial: { url: 'https://www.marvel.com/news', reviewed: true } }
  },
  'news-2026-09-20-010': { input: {} },
  'news-2026-09-19-011': { input: {} },
  'news-2026-09-18-012': { input: {} },
  'news-2026-09-19-013': {
    input: { official_confirm: { url: 'https://www.marvel.com/articles/live-events/', reviewed: true } }
  },
  'news-2026-09-19-014': { input: {} },
  'news-2026-09-17-015': { input: {} }
};

/* ---------------- 15 条黄金用例的期望输出 ---------------- */
/* 该表独立于 h5/data/news.js 写成，用于避免「用数据校验数据」的循环论证 */

const GOLDEN_EXPECT = {
  'news-2026-09-22-001': { status: 'official_confirmed',    groups: 1, step: 'Step 1' },
  'news-2026-09-22-002': { status: 'multi_source_reported', groups: 2, step: 'Step 5' },
  'news-2026-09-22-003': { status: 'single_source',         groups: 1, step: 'Step 6' },
  'news-2026-09-22-004': { status: 'single_source',         groups: 1, step: 'Step 6' },
  'news-2026-09-22-005': { status: 'unverified',            groups: 0, step: 'Step 8' },
  'news-2026-09-21-006': { status: 'rumor',                 groups: 0, step: 'Step 7' },
  'news-2026-09-21-007': { status: 'unverified',            groups: 0, step: 'Step 8' },
  'news-2026-09-21-008': { status: 'conflicting',           groups: 0, step: 'Step 4' },
  'news-2026-09-20-009': { status: 'officially_denied',     groups: 1, step: 'Step 2' },
  'news-2026-09-20-010': { status: 'corrected',             groups: 0, step: 'Step 3' },
  'news-2026-09-19-011': { status: 'multi_source_reported', groups: 2, step: 'Step 5' },
  'news-2026-09-18-012': { status: 'single_source',         groups: 1, step: 'Step 6' },
  'news-2026-09-19-013': { status: 'official_confirmed',    groups: 1, step: 'Step 1' },
  'news-2026-09-19-014': { status: 'corrected',             groups: 0, step: 'Step 3' },
  'news-2026-09-17-015': { status: 'single_source',         groups: 1, step: 'Step 6' }
};

/* ---------------- 合成边界用例 B1–B10 ---------------- */

function mk(over) {
  const base = {
    id: 'boundary-000',
    title: '边界用例（合成）',
    summary: '合成输入，不写入生产数据。',
    publish_time: '2026-09-22',
    first_seen_at: '2026-09-22T00:00:00Z',
    verification_status: 'unverified',
    category: 'industry',
    reported_by: [],
    independent_group_count: 0,
    original_source: 'unknown',
    original_source_url: '',
    official_source: '',
    official_source_url: '',
    related_movies: [], related_series: [], related_characters: [], related_phases: [],
    pinned: false, pinned_until: null, pinned_order: 0, pinned_reason: '',
    status_history: [],
    status_changed_at: '', status_change_reason: '', status_change_evidence_url: '',
    supersedes_id: null, superseded_by_id: null,
    report_corrections: [], conflict_statements: [],
    judged_by: 'rule_validated', chain_steps_hit: ''
  };
  return Object.assign(base, over);
}

/* 可用的可靠来源（tier 由 source_registry 决定）
 * ★ 注意：Variety 与 Deadline 同属 Penske Media Corporation（同一 owner_group），
 *   二者**不可**用于构造「2 个独立组」——这正是 003 号用例所防的「伪多源」。
 *   构造多源用例必须跨集团：Variety(PMC) + Collider(Valnet)。 */
const VARIETY  = { source_name: 'Variety',    source_url: 'https://variety.com/2026/09/some-article/',    owner_group: 'Penske Media Corporation' };
const DEADLINE = { source_name: 'Deadline',   source_url: 'https://deadline.com/2026/09/another-article/', owner_group: 'Penske Media Corporation' };
const COLLIDER = { source_name: 'Collider',   source_url: 'https://collider.com/2026/09/an-article/',     owner_group: 'Valnet' };
const T4A      = { source_name: '某社交账号A', source_url: 'https://x.com/a/status/1',                   owner_group: 'Foo Group' };
const T4B      = { source_name: '某社交账号B', source_url: 'https://x.com/b/status/2',                   owner_group: 'Bar Group' };

const BOUNDARY_CASES = [
  {
    id: 'B1',
    desc: '两家来源，owner_group 均为「待核」→ 不计独立组 → 落 Step 8',
    item: mk({ id: 'B1', reported_by: [
      { source_name: 'The Direct', source_url: 'https://thedirect.com/a', owner_group: '待核' },
      { source_name: 'ComicBook',  source_url: 'https://comicbook.com/b', owner_group: '待核' }
    ] }),
    input: {},
    expect: { status: 'unverified', groups: 0, step: 'Step 8' }
  },
  {
    id: 'B2',
    desc: 'reported_by 空 + original_source 命中爆料词表 → Step 7 rumor',
    item: mk({ id: 'B2', reported_by: [], original_source: '业内人士（未具名）' }),
    input: {},
    expect: { status: 'rumor', groups: 0, step: 'Step 7' }
  },
  {
    id: 'B3',
    desc: 'reported_by 空 + original_source = unknown → Step 8 unverified',
    item: mk({ id: 'B3', reported_by: [], original_source: 'unknown' }),
    input: {},
    expect: { status: 'unverified', groups: 0, step: 'Step 8' }
  },
  {
    id: 'B4',
    desc: '独立组 2（跨集团：PMC + Valnet）+ 已核准互斥 → Step 4 conflicting（证明 Step 4 早于 Step 5）',
    item: mk({
      id: 'B4',
      reported_by: [VARIETY, COLLIDER],
      conflict_statements: [
        { source_name: 'Variety',  statement: '称档期后移', source_url: VARIETY.source_url },
        { source_name: 'Collider', statement: '称按原档期', source_url: COLLIDER.source_url }
      ]
    }),
    input: { conflict_verified: { verified: true } },
    expect: { status: 'conflicting', groups: 2, step: 'Step 4' }
  },
  {
    id: 'B4b',
    desc: '同 B4 但互斥未经人工核准 → 不判 conflicting，落 Step 5（对照）',
    item: mk({
      id: 'B4b',
      reported_by: [VARIETY, COLLIDER],
      conflict_statements: [
        { source_name: 'Variety',  statement: '称档期后移', source_url: VARIETY.source_url },
        { source_name: 'Collider', statement: '称按原档期', source_url: COLLIDER.source_url }
      ]
    }),
    input: {},
    expect: { status: 'multi_source_reported', groups: 2, step: 'Step 5' }
  },
  {
    id: 'B5',
    desc: '官方 URL host 命中但 path 属排除区（/articles/comics/）→ 不得 official_confirmed',
    item: mk({ id: 'B5', reported_by: [COLLIDER] }),
    input: { official_confirm: { url: 'https://www.marvel.com/articles/comics/kraven-preview', reviewed: true } },
    expect: { status: 'single_source', groups: 1, step: 'Step 6' }
  },
  {
    id: 'B6',
    desc: '官方标记存在但 reviewed = false → 不得 official_confirmed',
    item: mk({ id: 'B6', reported_by: [COLLIDER] }),
    input: { official_confirm: { url: 'https://www.marvel.com/news', reviewed: false } },
    expect: { status: 'single_source', groups: 1, step: 'Step 6' }
  },
  {
    id: 'B7',
    desc: '官方否认标记存在但 URL 未命中登记表 → 不得 officially_denied',
    item: mk({ id: 'B7', reported_by: [COLLIDER] }),
    input: { official_denial: { url: 'https://example.com/news/some-deny', reviewed: true } },
    expect: { status: 'single_source', groups: 1, step: 'Step 6' }
  },
  {
    id: 'B8',
    desc: '跨集团 2 条报道（PMC + Valnet）仅 1 条被更正 → 不进 Step 3，继续判 Step 5',
    item: mk({
      id: 'B8',
      reported_by: [VARIETY, COLLIDER],
      report_corrections: [
        { source_name: 'Collider', corrected_at: '2026-09-22T01:00:00Z',
          original_statement: '原文表述', corrected_statement: '更正表述',
          evidence_url: 'https://collider.com/2026/09/an-article/' }
      ]
    }),
    input: {},
    expect: { status: 'multi_source_reported', groups: 2, step: 'Step 5' }
  },
  {
    id: 'B9',
    desc: '独立组 1 但来源 tier = T4（未登记）→ 不得判 single_source，落 Step 7',
    item: mk({ id: 'B9', reported_by: [T4A] }),
    input: {},
    expect: { status: 'rumor', groups: 1, step: 'Step 7', forbidStatus: 'single_source' }
  },
  {
    id: 'B10',
    desc: '2 个独立组但来源均为 tier = T4 → 不得判 multi_source_reported，落 Step 8',
    item: mk({ id: 'B10', reported_by: [T4A, T4B] }),
    input: {},
    expect: { status: 'unverified', groups: 2, step: 'Step 8', forbidStatus: 'multi_source_reported' }
  }
];

module.exports = { GOLDEN_INPUTS, GOLDEN_EXPECT, BOUNDARY_CASES, mk };
