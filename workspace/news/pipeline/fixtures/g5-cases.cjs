/* ============================================================
 * G5 · 管道测试夹具（L0 RawCapture / L1 CandidateItem）
 * ------------------------------------------------------------
 * 覆盖任务书要求的 8 类：
 *   C1 官方来源　C2 媒体来源　C3 未登记来源　C4 非法 URL
 *   C5 重复事件　C6 supersedes 场景　C7 缺失发布时间　C8 异常字段
 *
 * ★ 全部为**合成输入**，不含任何真实抓取内容；
 *   不写入 h5/、不触碰 33 字段交付物、不产出任何状态。
 * ============================================================ */
'use strict';

const RUN = 'run20260923';

function raw(over) {
  return Object.assign({
    capture_id: 'cap-S001-' + RUN + '-001',
    pipeline_run_id: RUN,
    registry_id: 'S001',
    source_name: 'Marvel 官方',
    source_url: 'https://www.marvel.com/articles/movies/avengers-doomsday-first-teaser',
    title_raw: '【独家】Marvel 官方公布《复仇者联盟5：毁灭之日》首支正式预告',
    published_at_raw: '2026-09-23T01:10:00Z',
    fetched_at: '2026-09-23T02:00:00Z',
    feed_type: 'html-parse',
    http_status: 200,
    raw_excerpt: 'Marvel 于今日发布该片首支正式预告……'
  }, over || {});
}

function ai(over) {
  return Object.assign({
    title: 'Marvel 官方公布《复仇者联盟5：毁灭之日》首支正式预告',
    summary: 'Marvel 发布该片首支正式预告，并确认北美上映档期。',
    category: 'movie',
    ai_model: 'g5-fixture',
    related_movies: ['avengers-5'],
    related_series: [],
    related_characters: ['strange'],
    related_phases: [6],
    original_source: 'Marvel 官方',
    original_source_url: 'https://www.marvel.com/articles/movies/avengers-doomsday-first-teaser',
    ai_suggested_status: 'official_confirmed',
    gate_status: 'pending',
    report_corrections: [],
    conflict_statements: []
  }, over || {});
}

/* ---------------- C1 官方来源 ---------------- */
const C1_OFFICIAL = {
  raw: raw({}),
  ai: ai({})
};

/* ---------------- C2 媒体来源 ---------------- */
const C2_MEDIA = {
  raw: raw({
    capture_id: 'cap-S004-' + RUN + '-001',
    registry_id: 'S004',
    source_name: 'Variety',
    source_url: 'https://variety.com/2026/film/news/avengers-doomsday-teaser-1234567890/',
    feed_type: 'rss',
    title_raw: '《复仇者联盟5：毁灭之日》首支预告正式发布',
    published_at_raw: 'Mon, 22 Sep 2026 23:40:00 +0000'
  }),
  ai: ai({
    title: '《复仇者联盟5：毁灭之日》首支预告发布',
    summary: 'Variety 报道该片首支预告已上线，并提及档期信息。',
    related_movies: ['avengers-5'],
    related_characters: [],
    ai_suggested_status: 'single_source',
    original_source: 'unknown',
    original_source_url: ''
  })
};

/* ---------------- C3 未登记来源 ---------------- */
const C3_UNREGISTERED = {
  raw: raw({
    capture_id: 'cap-unregistered-' + RUN + '-001',
    registry_id: 'unregistered',
    source_name: '社交平台爆料（未具名）',
    source_url: 'https://x.com/some-account/status/1234567890',
    feed_type: 'html-parse',
    http_status: 200,
    title_raw: '有消息称《神奇侠》将引入新的常驻角色',
    published_at_raw: '2026-09-22T18:20:00Z'
  }),
  ai: ai({
    title: '有消息称《神奇侠》将引入新的常驻角色',
    summary: '该消息源自未具名社交爆料，尚无可靠媒体报道。',
    category: 'series',
    related_movies: [],
    related_series: [],
    related_characters: [],
    related_phases: [],
    original_source: '某业内人士（未具名）',
    original_source_url: '',
    ai_suggested_status: 'rumor'
  }),
  /* 期望：owner_group 回落为 'unknown'（登记表查不到） */
  expectOwnerGroup: 'unknown'
};

/* ---------------- C4 非法 URL（3 变体） ---------------- */
const C4_BAD_URL = {
  cases: [
    { id: 'C4a', desc: '空 URL', over: { source_url: '' }, code: 'INVALID_URL' },
    { id: 'C4b', desc: '非 http(s) 协议（javascript:）', over: { source_url: 'javascript:alert(1)' }, code: 'INVALID_URL' },
    { id: 'C4c', desc: '非 http(s) 协议（ftp:）', over: { source_url: 'ftp://example.com/a' }, code: 'INVALID_URL' },
    { id: 'C4d', desc: '相对路径（无协议）', over: { source_url: '/articles/x' }, code: 'INVALID_URL' }
  ]
};

/* ---------------- C5 重复事件（同事件、不同来源） ---------------- */
const C5_DUP = [
  {
    raw: raw({
      capture_id: 'cap-S002-' + RUN + '-001',
      registry_id: 'S002',
      source_name: 'The Direct',
      source_url: 'https://thedirect.com/article/avengers-doomsday-teaser-released',
      feed_type: 'rss',
      published_at_raw: '2026-09-23T00:40:00Z'
    }),
    ai: ai({
      title: '《夜魔侠：重生》第三季将完结',
      summary: 'The Direct 报道该剧将在第三季完结，尚未获官方确认。',
      category: 'series',
      related_movies: [],
      related_series: ['daredevil-born-again'],
      related_characters: [],
      related_phases: [5],
      ai_suggested_status: 'single_source',
      original_source: 'unknown',
      original_source_url: ''
    })
  },
  {
    raw: raw({
      capture_id: 'cap-S003-' + RUN + '-001',
      registry_id: 'S003',
      source_name: 'ComicBook',
      source_url: 'https://comicbook.com/tv-shows/news/daredevil-born-again-season-3-ends/',
      feed_type: 'rss',
      published_at_raw: '2026-09-23T01:05:00Z'
    }),
    ai: ai({
      title: '《夜魔侠：重生》第三季完结消息',
      summary: 'ComicBook 亦报道该剧第三季完结，措辞与 The Direct 略有不同。',
      category: 'series',
      related_movies: [],
      related_series: ['daredevil-born-again'],
      related_characters: [],
      related_phases: [5],
      ai_suggested_status: 'multi_source_reported',
      original_source: 'unknown',
      original_source_url: ''
    })
  }
];

/* ---------------- C6 supersedes 场景 ---------------- */
/* 两条同事件（同标题同作品同动作）→ 同一 event_key；
 * 其中一条带 report_corrections（报道级更正）。
 * 期望：merger 归并为 **1 个事件**，但**保留两条报道记录**（A3/A4）。 */
const C6_SUPERSEDES = [
  {
    raw: raw({
      capture_id: 'cap-S002-' + RUN + '-010',
      registry_id: 'S002',
      source_name: 'The Direct',
      source_url: 'https://thedirect.com/article/ironheart-season-2-delayed-2027',
      feed_type: 'rss',
      published_at_raw: '2026-09-22T09:30:00Z',
      title_raw: '《钢铁心》第二季将改档至 2027 年'
    }),
    ai: ai({
      title: '《钢铁心》第二季将改档至 2027 年',
      summary: '原始报道称该剧第二季将改档至 2027 年。',
      category: 'series',
      related_movies: [],
      related_series: ['ironheart'],
      related_characters: [],
      related_phases: [6],
      ai_suggested_status: 'single_source',
      original_source: 'The Direct',
      original_source_url: 'https://thedirect.com/article/ironheart-season-2-delayed-2027',
      report_corrections: []
    })
  },
  {
    raw: raw({
      capture_id: 'cap-S002-' + RUN + '-011',
      registry_id: 'S002',
      source_name: 'The Direct',
      source_url: 'https://thedirect.com/article/ironheart-season-2-delayed-2027-update',
      feed_type: 'rss',
      published_at_raw: '2026-09-23T00:10:00Z',
      title_raw: '《钢铁心》第二季将改档至 2027 年（更正版）'
    }),
    ai: ai({
      title: '《钢铁心》第二季将改档至 2027 年',
      summary: '原发布方已发布更正声明：档期未定，此前表述有误。',
      category: 'series',
      related_movies: [],
      related_series: ['ironheart'],
      related_characters: [],
      related_phases: [6],
      ai_suggested_status: 'corrected',
      original_source: 'The Direct',
      original_source_url: 'https://thedirect.com/article/ironheart-season-2-delayed-2027-update',
      report_corrections: [{
        source_name: 'The Direct',
        corrected_at: '2026-09-23T00:10:00Z',
        original_statement: '称《钢铁心》第二季将改档至 2027 年',
        corrected_statement: '更正为档期未定，此前表述有误',
        evidence_url: 'https://thedirect.com/article/ironheart-season-2-delayed-2027-update'
      }]
    })
  }
];

/* ---------------- C7 缺失发布时间 ---------------- */
const C7_NO_TIME = {
  raw: raw({
    capture_id: 'cap-S006-' + RUN + '-001',
    registry_id: 'S006',
    source_name: 'The Walt Disney Company 官方公告页',
    source_url: 'https://thewaltdisneycompany.com/news/marvel-studios-announcement/',
    feed_type: 'rss',
    published_at_raw: 'not-a-date',
    title_raw: '迪士尼官方公告页发布 Marvel Studios 相关公告'
  }),
  ai: ai({
    title: '迪士尼官方公告页发布 Marvel Studios 相关公告',
    summary: '该公告无可用发布时间，日期将回落到系统首次见到时间。',
    category: 'industry',
    related_movies: [],
    related_characters: [],
    related_phases: [],
    ai_suggested_status: 'unverified',
    original_source: 'unknown',
    original_source_url: ''
  }),
  expect: { published_at: null, publish_time: '' }
};

/* ---------------- C8 异常字段 ---------------- */
const C8_ANOMALY = {
  cases: [
    { id: 'C8a', desc: 'raw 含 verification_status', layer: 'L0',
      over: { verification_status: 'official_confirmed' }, code: 'FORBIDDEN_FIELD' },
    { id: 'C8b', desc: 'L0 缺必填（title_raw）', layer: 'L0',
      over: { title_raw: '' }, code: 'MISSING_FIELD' },
    { id: 'C8c', desc: 'raw_excerpt 超长（>200 字）', layer: 'L0',
      over: { raw_excerpt: '长'.repeat(201) }, code: 'EXCERPT_TOO_LONG' },
    { id: 'C8d', desc: 'registry_id 未登记', layer: 'L0',
      over: { registry_id: 'S999' }, code: 'UNKNOWN_REGISTRY_ID' },
    { id: 'C8e', desc: 'source_name 与登记表不符', layer: 'L0',
      over: { registry_id: 'S001', source_name: 'Variety' }, code: 'SOURCE_NAME_MISMATCH' },
    { id: 'C8f', desc: 'feed_type 非枚举', layer: 'L0',
      over: { feed_type: 'json' }, code: 'INVALID_FEED_TYPE' },
    { id: 'C8g', desc: 'http_status 非整数', layer: 'L0',
      over: { http_status: 'OK' }, code: 'INVALID_HTTP_STATUS' },
    { id: 'C8h', desc: 'AI 结果含 verification_status', layer: 'L1',
      aiOver: { verification_status: 'official_confirmed' }, code: 'FORBIDDEN_FIELD' },
    { id: 'C8i', desc: 'AI 结果含 judged_by', layer: 'L1',
      aiOver: { judged_by: 'human_confirmed' }, code: 'FORBIDDEN_FIELD' },
    { id: 'C8j', desc: 'AI 结果含交付物 id', layer: 'L1',
      aiOver: { id: 'news-2026-09-23-001' }, code: 'FORBIDDEN_FIELD' },
    { id: 'C8k', desc: 'title 含 HTML 标签', layer: 'L1',
      aiOver: { title: '<b>Marvel 官方公布预告</b>' }, code: 'MARKUP_NOT_ALLOWED' },
    { id: 'C8l', desc: 'summary 含 Markdown 粗体', layer: 'L1',
      aiOver: { summary: '**重要** Marvel 发布预告' }, code: 'MARKUP_NOT_ALLOWED' },
    { id: 'C8m', desc: 'category 非 6 值枚举', layer: 'L1',
      aiOver: { category: 'tv' }, code: 'INVALID_CATEGORY' },
    { id: 'C8n', desc: 'ai_suggested_status 非 8 态', layer: 'L1',
      aiOver: { ai_suggested_status: 'likely_true' }, code: 'INVALID_SUGGESTED_STATUS' },
    { id: 'C8o', desc: 'gate_status 非枚举', layer: 'L1',
      aiOver: { gate_status: 'draft' }, code: 'INVALID_GATE_STATUS' }
  ],
  /* 关联交集校验：未命中一律丢弃（不报错） */
  intersectCase: {
    aiOver: {
      related_movies: ['avengers-5', 'not-a-real-movie'],
      related_series: ['loki', 'ghost-series'],
      related_characters: ['strange', 'nobody-here'],
      related_phases: [6, 9, 0, 'x']
    },
    /* expectKept 为「提供真实 idSpace 后」的期望结果：
     * 'avengers-5' 不在 MCU_CONTENT（属 MCU_UPCOMING）→ 也会被丢弃 */
    expectKept: { movies: [], series: ['loki'], characters: ['strange'], phases: [6] },
    expectDiscardedIncludes: ['avengers-5', 'not-a-real-movie', 'ghost-series', 'nobody-here']
  }
};

module.exports = {
  RUN,
  raw, ai,
  C1_OFFICIAL, C2_MEDIA, C3_UNREGISTERED, C4_BAD_URL, C5_DUP,
  C6_SUPERSEDES, C7_NO_TIME, C8_ANOMALY
};
