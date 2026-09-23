/* ============================================================
 * G3 · 官方来源校验器测试夹具
 * ------------------------------------------------------------
 * 覆盖任务要求 C1–C8，另加 6 个补充用例（C9–C14）。
 * ★ 全部条目取自 source-registry.json（不硬编码域名）；
 *   唯一例外是 C5 的**合成条目**，目的是把黑名单验证成**独立守卫**
 *   （否则黑名单域名天然也会因 host 未命中 allowed_domains 而失败，
 *    无法单独证明黑名单本身有效）。
 * ★ 本文件不修改任何生产数据。
 * ★ 关于「级联失败」：校验器**刻意不做短路** —— 六项检查全部计算并返回，
 *   便于调用方与审计看到全貌。因此当 URL 不可用（空 / 非法 / host 未命中）时，
 *   依赖它的 domain_allowed / path_allowed / domain_blacklist 会**一并失败**。
 *   本文件中的 failChecks 均为**完整清单**（非仅主因），主因见 primary 字段。
 * ============================================================ */
'use strict';

const registry = require('../../news-registry.cjs');

const EVENT_OK = 'news-2026-09-22-001';
const OC_OK = { reviewed: true, event_id: EVENT_OK };

function entry(id) {
  const e = registry.byId(id);
  if (!e) throw new Error('夹具错误：登记表中查无 ' + id);
  return e;
}

const CASES = [
  /* ── C1 正常官方 URL（文章级，legacy 与 article-level 均应通过）── */
  {
    id: 'C1',
    desc: '正常官方 URL：marvel.com 文章页 + official 条目 + 已复核 + 事件 ID 一致',
    input: {
      source_url: 'https://www.marvel.com/articles/movies/avengers-doomsday-first-teaser',
      source_name: 'Marvel 官方',
      registry_entry: entry('S001'),
      claimed_event_id: EVENT_OK,
      official_confirm: OC_OK
    },
    expect: { valid: true, failChecks: [] }
  },

  /* ── C2 官方栏目页 legacy 通过 ── */
  {
    id: 'C2',
    desc: '官方栏目页 /news：legacy 策略下通过（现行规则，E-1 冻结）',
    input: {
      source_url: 'https://www.marvel.com/news',
      source_name: 'Marvel 官方',
      registry_entry: entry('S001'),
      claimed_event_id: EVENT_OK,
      official_confirm: OC_OK
    },
    opts: { pathPolicy: 'legacy' },
    expect: { valid: true, failChecks: [] }
  },

  /* ── C3 同一 URL 在 article-level 下失败 ── */
  {
    id: 'C3',
    desc: '同一官方栏目页在 article-level 策略下失败（Q-5 严格规则，G8 才启用）',
    input: {
      source_url: 'https://www.marvel.com/news',
      source_name: 'Marvel 官方',
      registry_entry: entry('S001'),
      claimed_event_id: EVENT_OK,
      official_confirm: OC_OK
    },
    opts: { pathPolicy: 'article-level' },
    expect: { valid: false, failChecks: ['path_allowed'] }
  },

  /* ── C4 非官方域名失败 ── */
  {
    id: 'C4',
    desc: '未登记域名 example.com 冒充官方来源 → 域名校验失败',
    input: {
      source_url: 'https://example.com/news/some-official-looking-article',
      source_name: 'Marvel 官方',
      registry_entry: entry('S001'),
      claimed_event_id: EVENT_OK,
      official_confirm: OC_OK
    },
    expect: { valid: false, failChecks: ['domain_allowed'] }
  },

  /* ── C5 黑名单失败（合成条目，隔离黑名单守卫）── */
  {
    id: 'C5',
    desc: '黑名单域名 disneyplus.com：即使被写入 allowed_domains，也必须直接失败',
    input: {
      source_url: 'https://www.disneyplus.com/news/some-article',
      source_name: 'Marvel 官方',
      /* 合成条目：故意把黑名单域名放进 allowed_domains，用于单独验证黑名单守卫 */
      registry_entry: {
        registry_id: 'S001',
        source_name: 'Marvel 官方',
        official_or_media: 'official',
        allowed_domains: ['disneyplus.com', 'www.disneyplus.com'],
        allowed_paths: ['/news/'],
        excluded_paths: []
      },
      claimed_event_id: EVENT_OK,
      official_confirm: OC_OK
    },
    expect: { valid: false, failChecks: ['domain_blacklist'], passChecks: ['domain_allowed'] }
  },

  /* ── C6 未登记来源失败 ── */
  {
    id: 'C6',
    desc: '未登记来源（registry_entry 缺失）→ 资格判断失败',
    input: {
      source_url: 'https://unknown-outlet.example/news/x',
      source_name: '某未知媒体',
      registry_entry: null,
      claimed_event_id: EVENT_OK,
      official_confirm: OC_OK
    },
    expect: { valid: false, failChecks: ['domain_allowed', 'path_allowed', 'registry_match'], primary: 'registry_match' }
  },

  /* ── C7a / C7b official 但域名未登记 ── */
  {
    id: 'C7a',
    desc: 'S010 Marvel 日本官方：official 但 allowed_domains 为空 → 不得进入 official_confirm 判断',
    input: {
      source_url: 'https://marvel.disney.co.jp/news/x',
      source_name: 'Marvel 日本官方',
      registry_entry: entry('S010'),
      claimed_event_id: EVENT_OK,
      official_confirm: OC_OK
    },
    expect: { valid: false, failChecks: ['domain_allowed', 'path_allowed', 'registry_match'], primary: 'registry_match' }
  },
  {
    id: 'C7b',
    desc: 'S011 Marvel Studios 官方：official 但 allowed_domains 为空；URL 是 marvel.com 也无效',
    input: {
      source_url: 'https://www.marvel.com/news',
      source_name: 'Marvel Studios 官方',
      registry_entry: entry('S011'),
      claimed_event_id: EVENT_OK,
      official_confirm: OC_OK
    },
    expect: { valid: false, failChecks: ['domain_allowed', 'path_allowed', 'registry_match'], primary: 'registry_match' }
  },

  /* ── C8 空 URL ── */
  {
    id: 'C8',
    desc: '空 URL → URL 基础校验失败',
    input: {
      source_url: '',
      source_name: 'Marvel 官方',
      registry_entry: entry('S001'),
      claimed_event_id: EVENT_OK,
      official_confirm: OC_OK
    },
    expect: {
      valid: false,
      /* 空 URL → 依赖 URL 的四项一并失败（级联），主因是 url_scheme */
      failChecks: ['url_scheme', 'domain_allowed', 'path_allowed', 'domain_blacklist'],
      primary: 'url_scheme'
    }
  },

  /* ════════ 补充用例 C9–C14 ════════ */

  {
    id: 'C9',
    desc: 'excluded_paths 命中：/articles/comics/* 即使域名正确也必须失败',
    input: {
      source_url: 'https://www.marvel.com/articles/comics/kraven-the-hunter-preview',
      source_name: 'Marvel 官方',
      registry_entry: entry('S001'),
      claimed_event_id: EVENT_OK,
      official_confirm: OC_OK
    },
    expect: { valid: false, failChecks: ['path_allowed'] }
  },

  {
    id: 'C10',
    desc: 'source_name 与 registry_entry 不一致（防伪造条目）→ 资格判断失败',
    input: {
      source_url: 'https://www.marvel.com/news',
      source_name: 'Variety',
      registry_entry: entry('S001'),
      claimed_event_id: EVENT_OK,
      official_confirm: OC_OK
    },
    expect: { valid: false, failChecks: ['registry_match'] }
  },

  {
    id: 'C11',
    desc: 'article-level 下文章级 URL 通过（证明严格策略不是「一律拒绝」）',
    input: {
      source_url: 'https://www.marvel.com/news/some-official-announcement',
      source_name: 'Marvel 官方',
      registry_entry: entry('S001'),
      claimed_event_id: EVENT_OK,
      official_confirm: OC_OK
    },
    opts: { pathPolicy: 'article-level' },
    expect: { valid: true, failChecks: [] }
  },

  {
    id: 'C12',
    desc: '人工复核未通过（reviewed = false）→ 复核检查失败',
    input: {
      source_url: 'https://www.marvel.com/news',
      source_name: 'Marvel 官方',
      registry_entry: entry('S001'),
      claimed_event_id: EVENT_OK,
      official_confirm: { reviewed: false, event_id: EVENT_OK }
    },
    expect: { valid: false, failChecks: ['review_required'] }
  },

  {
    id: 'C13',
    desc: 'claimed_event_id 与 official_confirm.event_id 不一致 → ID 关联检查失败',
    input: {
      source_url: 'https://www.marvel.com/news',
      source_name: 'Marvel 官方',
      registry_entry: entry('S001'),
      claimed_event_id: 'news-2026-09-22-999',
      official_confirm: { reviewed: true, event_id: EVENT_OK }
    },
    expect: { valid: false, failChecks: ['review_required'] }
  },

  {
    id: 'C14',
    desc: '非官方条目（S004 Variety，official_or_media = media）冒充官方来源 → 资格失败',
    input: {
      source_url: 'https://variety.com/2026/09/some-article/',
      source_name: 'Variety',
      registry_entry: entry('S004'),
      claimed_event_id: EVENT_OK,
      official_confirm: OC_OK
    },
    expect: { valid: false, failChecks: ['domain_allowed', 'path_allowed', 'registry_match'], primary: 'registry_match' }
  }
];

/* 与 G1 checkOfficialUrl 的交叉一致性对照（防止两套实现漂移）
 * 比较口径：validator 的前 5 项检查（不含 review_required）
 *           与 G1 的 checkOfficialUrl 结论必须一致。 */
const CROSS_CHECK = [
  { url: 'https://www.marvel.com/news',                            mode: 'legacy',        expected: true  },
  { url: 'https://www.marvel.com/news',                            mode: 'article-level', expected: false },
  { url: 'https://www.marvel.com/articles/movies/some-article',    mode: 'legacy',        expected: true  },
  { url: 'https://www.marvel.com/articles/movies/some-article',    mode: 'article-level', expected: true  },
  { url: 'https://www.marvel.com/articles/comics/some-preview',    mode: 'legacy',        expected: false },
  { url: 'https://www.disneyplus.com/news/x',                      mode: 'legacy',        expected: false },
  { url: 'https://example.com/news/x',                             mode: 'legacy',        expected: false },
  { url: '',                                                       mode: 'legacy',        expected: false }
];

module.exports = { CASES, CROSS_CHECK, EVENT_OK, OC_OK };
