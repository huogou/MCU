/* ============================================================
 * MCU 宇宙导航 H5 · 最新漫威资讯数据（MCU_NEWS）
 * ------------------------------------------------------------
 * 权威源：本文件即资讯数据的唯一权威源（S-1 产品最终拍板）
 *   · 不创建 shared/data/news.js
 *   · 不复制到 wechat/data 或 douyin/data
 *   · 不建第二套资讯数据
 *
 * 为什么用 .js 而不是 .json：
 *   本项目要求「双击 index.html 即可运行」。file:// 协议下浏览器会拦截
 *   fetch() 读取本地 JSON，因此数据以全局变量形式挂载。
 *   后续接入服务端时，把 window.MCU_NEWS = 去掉即为标准 JSON。
 *
 * ★ 当前数据阶段：mock（模拟数据）
 *   本阶段只完成「产品与模拟数据施工」，不接入真实资讯抓取。
 *   · 全部 title / summary 为示意文本，非真实报道转述
 *   · 全部 related_* 引用的是 MCU_CONTENT / MCU_CHARACTERS 中真实存在的 id
 *   · 不含任何第三方媒体封面图（卡片无图片区域）
 *   真实来源、抓取与交叉验证流程在 H5 UI 与数据层验收通过后单独进入。
 *
 * 字段与规则依据（不得擅自改动）：
 *   V2.1 R3.1 判定输入字段 / R3.2 八态 / R3.3 转换规则 / R5 排序
 *   V2.2 R6 来源分档 / R7 官方来源登记表 / R8 判定链与重新判定原则
 *   设计规范 R12.2 数据结构 / R12.3 空值 UI / 附录 A 状态文案表
 *
 * ★ independent_group_count 的口径（V2.2 R6.1 + R8.3 约束）
 *   本字段为**派生字段**，由 reported_by 按 owner_group 去重计算：
 *     · owner_group 为「待核」「unknown」或空 → **不计入**独立组
 *     · 同一 owner_group 下的多家媒体（如 Variety / Deadline / THR 同属
 *       Penske Media Corporation）**只计 1 个**独立证据
 *   本文件中该字段的值必须与运行时计算一致（由 test-news-rules.cjs 断言校验），
 *   禁止为了让某条资讯升格而人为改大。
 *
 * 加载顺序：须晚于 content.js 与 characters.js（关联字段引用其 id）、
 *          早于 app.js。见 index.html / news.html / news-detail.html。
 * ============================================================ */

/* 数据阶段元信息（不参与渲染，仅供追溯与验收） */
window.MCU_NEWS_META = {
  stage: 'mock',
  stage_label: '模拟数据（未接入真实抓取）',
  built_at: '2026-09-22',
  rule_ref: 'V2.2 R6/R7/R8 + 设计规范 R12',
  note: '本阶段为产品与模拟数据施工。真实来源抓取与交叉验证流程在验收通过后单独进入。'
};

window.MCU_NEWS = [

  /* ── 01 官方确认 · 关联阶段 + 关联角色 ───────────────────────── */
  {
    id: 'news-2026-09-22-001',
    title: 'Marvel 官方公布《复仇者联盟5：毁灭之日》首支正式预告',
    summary: 'Marvel 官方发布《复仇者联盟5：毁灭之日》首支正式预告，确认影片将于 2026 年 12 月 18 日北美上映。预告中出现多元宇宙线索与多位角色同框画面。本条为官方发布内容，非媒体转述。',
    publish_time: '2026-09-22',
    first_seen_at: '2026-09-22T01:10:00Z',
    verification_status: 'official_confirmed',
    category: 'movie',

    reported_by: [
      {
        source_name: 'Marvel 官方',
        source_url: 'https://www.marvel.com/news',
        owner_group: 'Disney / Marvel'
      }
    ],
    independent_group_count: 1,
    original_source: 'Marvel 官方',
    original_source_url: 'https://www.marvel.com/news',

    official_source: 'Marvel 官方',
    official_source_url: 'https://www.marvel.com/news',

    related_movies: [],
    related_series: [],
    related_characters: ['strange', 'wade', 'logan'],
    related_phases: [6],

    pinned: false,
    pinned_until: null,
    pinned_order: 0,
    pinned_reason: '',

    status_history: [
      {
        from: null,
        to: 'official_confirmed',
        at: '2026-09-22T01:10:00Z',
        reason: 'official_source_url 命中官方来源登记表（marvel.com / /news/*），经人工复核',
        evidence_url: 'https://www.marvel.com/news'
      }
    ],
    status_changed_at: '2026-09-22T01:10:00Z',
    status_change_reason: 'R8.3 Step 1 命中：官方来源 URL 通过 R7.4 校验',
    status_change_evidence_url: 'https://www.marvel.com/news',

    supersedes_id: null,
    superseded_by_id: null,

    report_corrections: [],
    conflict_statements: [],

    judged_by: 'human_confirmed',
    chain_steps_hit: 'Step 1',
    conflict_resolved_at: null,
    conflict_resolved_by_evidence_url: null
  },

  /* ── 02 多家媒体报道 · 2 个独立 owner_group（PMC + People Inc.）── */
  {
    id: 'news-2026-09-22-002',
    title: '《蜘蛛侠：崭新之日》续集已进入早期开发',
    summary: 'Variety 与 Entertainment Weekly 分别报道，索尼与 Marvel Studios 已就《蜘蛛侠：崭新之日》的后续影片展开早期讨论。两篇报道均由各自采编团队独立完成，目前尚未获得官方确认。',
    publish_time: '2026-09-22',
    first_seen_at: '2026-09-22T00:40:00Z',
    verification_status: 'multi_source_reported',
    category: 'movie',

    reported_by: [
      {
        source_name: 'Variety',
        source_url: 'https://variety.com/',
        owner_group: 'Penske Media Corporation'
      },
      {
        source_name: 'Entertainment Weekly',
        source_url: 'https://ew.com/',
        owner_group: 'People Inc.'
      }
    ],
    independent_group_count: 2,
    original_source: 'unknown',
    original_source_url: '',

    official_source: '',
    official_source_url: '',

    related_movies: ['brand-new-day'],
    related_series: [],
    related_characters: ['peter'],
    related_phases: [6],

    pinned: false,
    pinned_until: null,
    pinned_order: 0,
    pinned_reason: '',

    status_history: [
      {
        from: 'single_source',
        to: 'multi_source_reported',
        at: '2026-09-22T00:40:00Z',
        reason: '出现第 2 个独立 owner_group（People Inc.）的一致报道',
        evidence_url: 'https://ew.com/'
      }
    ],
    status_changed_at: '2026-09-22T00:40:00Z',
    status_change_reason: 'R8.3 Step 5 命中：independent_group_count 由 1 升至 2 且表述一致',
    status_change_evidence_url: 'https://ew.com/',

    supersedes_id: null,
    superseded_by_id: null,

    report_corrections: [],
    conflict_statements: [],

    judged_by: 'rule_validated',
    chain_steps_hit: 'Step 5',
    conflict_resolved_at: null,
    conflict_resolved_by_evidence_url: null
  },

  /* ── 03 ★ 旗舰示例：3 家报道但同属 1 个 owner_group → 单一来源 ── */
  {
    id: 'news-2026-09-22-003',
    title: '《夜魔侠：重生》将在第三季完结',
    summary: 'Variety、Deadline 与 The Hollywood Reporter 均出现同一消息的报道。三家同属 Penske Media Corporation，属同一 owner_group，因此本系统按规则只计 1 个独立证据，而非 3 个独立来源。目前尚未获得官方确认。',
    publish_time: '2026-09-22',
    first_seen_at: '2026-09-22T00:20:00Z',
    verification_status: 'single_source',
    category: 'series',

    reported_by: [
      {
        source_name: 'Variety',
        source_url: 'https://variety.com/feed/',
        owner_group: 'Penske Media Corporation'
      },
      {
        source_name: 'Deadline',
        source_url: 'https://deadline.com/feed/',
        owner_group: 'Penske Media Corporation'
      },
      {
        source_name: 'The Hollywood Reporter',
        source_url: 'https://www.hollywoodreporter.com/feed/',
        owner_group: 'Penske Media Corporation'
      }
    ],
    independent_group_count: 1,
    original_source: 'unknown',
    original_source_url: '',

    official_source: '',
    official_source_url: '',

    related_movies: [],
    related_series: ['daredevil-born-again'],
    related_characters: [],
    related_phases: [5],

    pinned: false,
    pinned_until: null,
    pinned_order: 0,
    pinned_reason: '',

    status_history: [
      {
        from: 'multi_source_reported',
        to: 'single_source',
        at: '2026-09-22T00:20:00Z',
        reason: '复核发现 3 家报道方同属 Penske Media Corporation，独立 owner_group 数由 3 修正为 1（伪多源降级）',
        evidence_url: 'https://pmc.com/leadership/'
      }
    ],
    status_changed_at: '2026-09-22T00:20:00Z',
    status_change_reason: 'R8.3 Step 6 命中：去重后仅 1 个独立 owner_group（伪多源识别）',
    status_change_evidence_url: 'https://pmc.com/leadership/',

    supersedes_id: null,
    superseded_by_id: null,

    report_corrections: [],
    conflict_statements: [],

    judged_by: 'human_confirmed',
    chain_steps_hit: 'Step 6',
    conflict_resolved_at: null,
    conflict_resolved_by_evidence_url: null
  },

  /* ── 04 单一来源报道（独家）────────────────────────────────── */
  {
    id: 'news-2026-09-22-004',
    title: 'Deadline 独家：《雷霆特攻队*》续集由原班主创回归',
    summary: 'Deadline 独家报道，《雷霆特攻队*》后续影片的主创班底已基本确定。目前仅有这一家媒体出现该消息，尚未获得官方确认。',
    publish_time: '2026-09-22',
    first_seen_at: '2026-09-22T00:05:00Z',
    verification_status: 'single_source',
    category: 'movie',

    reported_by: [
      {
        source_name: 'Deadline',
        source_url: 'https://deadline.com/feed/',
        owner_group: 'Penske Media Corporation'
      }
    ],
    independent_group_count: 1,
    original_source: 'unknown',
    original_source_url: '',

    official_source: '',
    official_source_url: '',

    related_movies: ['thunderbolts'],
    related_series: [],
    related_characters: ['yelena', 'bucky'],
    related_phases: [5],

    pinned: false,
    pinned_until: null,
    pinned_order: 0,
    pinned_reason: '',

    status_history: [
      {
        from: null,
        to: 'single_source',
        at: '2026-09-22T00:05:00Z',
        reason: 'R8.3 Step 6 命中：仅 1 个独立 owner_group 的可靠媒体报道',
        evidence_url: 'https://deadline.com/feed/'
      }
    ],
    status_changed_at: '2026-09-22T00:05:00Z',
    status_change_reason: '首次判定即命中 R8.3 Step 6',
    status_change_evidence_url: 'https://deadline.com/feed/',

    supersedes_id: null,
    superseded_by_id: null,

    report_corrections: [],
    conflict_statements: [],

    judged_by: 'ai_suggested',
    chain_steps_hit: 'Step 6',
    conflict_resolved_at: null,
    conflict_resolved_by_evidence_url: null
  },

  /* ── 05 ★ owner_group 待核：不得计为独立来源 → 0 组 → 信息待核实 ── */
  {
    id: 'news-2026-09-22-005',
    title: 'The Direct 与 ComicBook 同时报道《神奇四侠》续集反派人选',
    summary: '两家 MCU 垂直媒体均出现同一消息的报道，但二者的 owner_group 目前尚未核实。按本系统规则，无法确认独立性的来源不得计为独立证据组，因此在 owner_group 核实完成前，本条无法判断来源层级。',
    publish_time: '2026-09-21',
    first_seen_at: '2026-09-21T22:30:00Z',
    verification_status: 'unverified',
    category: 'movie',

    reported_by: [
      {
        source_name: 'The Direct',
        source_url: 'https://thedirect.com/rss',
        owner_group: '待核'
      },
      {
        source_name: 'ComicBook',
        source_url: 'https://comicbook.com/category/marvel/feed/',
        owner_group: '待核'
      }
    ],
    independent_group_count: 0,
    original_source: 'unknown',
    original_source_url: '',

    official_source: '',
    official_source_url: '',

    related_movies: ['fantastic-four'],
    related_series: [],
    related_characters: [],
    related_phases: [6],

    pinned: false,
    pinned_until: null,
    pinned_order: 0,
    pinned_reason: '',

    status_history: [
      {
        from: null,
        to: 'unverified',
        at: '2026-09-21T22:30:00Z',
        reason: '两家来源的 owner_group 均为「待核」，不得假设独立性，独立证据组数为 0 → 落到 R8.3 Step 8 兜底',
        evidence_url: 'https://thedirect.com/rss'
      }
    ],
    status_changed_at: '2026-09-21T22:30:00Z',
    status_change_reason: 'R8.3 Step 8 命中：owner_group 未确认，不满足任何更高层级条件',
    status_change_evidence_url: 'https://thedirect.com/rss',

    supersedes_id: null,
    superseded_by_id: null,

    report_corrections: [],
    conflict_statements: [],

    judged_by: 'rule_validated',
    chain_steps_hit: 'Step 8',
    conflict_resolved_at: null,
    conflict_resolved_by_evidence_url: null
  },

  /* ── 06 传闻 · 爆料 ────────────────────────────────────────── */
  {
    id: 'news-2026-09-21-006',
    title: '业内人士称《洛基》第三季已在早期筹备',
    summary: '一位未具名业内人士在社交平台提到《洛基》后续季度的筹备情况。该说法尚无任何可靠媒体独立报道，来源属于爆料性质，请谨慎参考。',
    publish_time: '2026-09-21',
    first_seen_at: '2026-09-21T20:00:00Z',
    verification_status: 'rumor',
    category: 'series',

    reported_by: [
      {
        source_name: '社交平台爆料（未具名）',
        source_url: 'https://x.com/',
        owner_group: 'unknown'
      }
    ],
    independent_group_count: 0,
    original_source: '某业内人士（未具名）',
    original_source_url: '',

    official_source: '',
    official_source_url: '',

    related_movies: [],
    related_series: ['loki'],
    related_characters: ['loki'],
    related_phases: [6],

    pinned: false,
    pinned_until: null,
    pinned_order: 0,
    pinned_reason: '',

    status_history: [
      {
        from: null,
        to: 'rumor',
        at: '2026-09-21T20:00:00Z',
        reason: 'R8.3 Step 7 命中：原始来源属于爆料 / 消息人士',
        evidence_url: 'https://x.com/'
      }
    ],
    status_changed_at: '2026-09-21T20:00:00Z',
    status_change_reason: 'R8.3 Step 7 命中：原始来源属爆料类',
    status_change_evidence_url: 'https://x.com/',

    supersedes_id: null,
    superseded_by_id: null,

    report_corrections: [],
    conflict_statements: [],

    judged_by: 'ai_suggested',
    chain_steps_hit: 'Step 7',
    conflict_resolved_at: null,
    conflict_resolved_by_evidence_url: null
  },

  /* ── 07 信息待核实（来源不足，reported_by 为空）──────────────── */
  {
    id: 'news-2026-09-21-007',
    title: '有消息称《神奇侠》将引入新的常驻角色',
    summary: '该消息在多个非正式渠道被提及，但未能定位到任何可确认的媒体报道或原始发布方，暂无法判断来源层级。在本系统补齐来源前，本条不作为可信依据。',
    publish_time: '2026-09-21',
    first_seen_at: '2026-09-21T18:20:00Z',
    verification_status: 'unverified',
    category: 'series',

    reported_by: [],
    independent_group_count: 0,
    original_source: 'unknown',
    original_source_url: '',

    official_source: '',
    official_source_url: '',

    related_movies: [],
    related_series: ['wonder-man'],
    related_characters: [],
    related_phases: [6],

    pinned: false,
    pinned_until: null,
    pinned_order: 0,
    pinned_reason: '',

    status_history: [
      {
        from: null,
        to: 'unverified',
        at: '2026-09-21T18:20:00Z',
        reason: '无可定位的来源，落到 R8.3 Step 8 兜底',
        evidence_url: ''
      }
    ],
    status_changed_at: '2026-09-21T18:20:00Z',
    status_change_reason: 'R8.3 Step 8 命中：来源不足',
    status_change_evidence_url: '',

    supersedes_id: null,
    superseded_by_id: null,

    report_corrections: [],
    conflict_statements: [],

    judged_by: 'ai_suggested',
    chain_steps_hit: 'Step 8',
    conflict_resolved_at: null,
    conflict_resolved_by_evidence_url: null
  },

  /* ── 08 ★ 信息存在冲突（各方表述互斥，并列展示）────────────── */
  {
    id: 'news-2026-09-21-008',
    title: '《复仇者联盟6：秘密战争》档期说法不一',
    summary: '两家 MCU 垂直媒体对同一问题给出相反表述：一方称影片档期将后移，另一方称按原档期推进。系统不判断哪一方正确，仅并列展示各方表述。',
    publish_time: '2026-09-21',
    first_seen_at: '2026-09-21T16:00:00Z',
    verification_status: 'conflicting',
    category: 'movie',

    reported_by: [
      {
        source_name: 'The Direct',
        source_url: 'https://thedirect.com/rss',
        owner_group: '待核'
      },
      {
        source_name: 'ComicBook',
        source_url: 'https://comicbook.com/category/marvel/feed/',
        owner_group: '待核'
      }
    ],
    independent_group_count: 0,
    original_source: 'unknown',
    original_source_url: '',

    official_source: '',
    official_source_url: '',

    related_movies: [],
    related_series: [],
    related_characters: ['strange'],
    related_phases: [6],

    pinned: false,
    pinned_until: null,
    pinned_order: 0,
    pinned_reason: '',

    /* 交叉验证区块的数据（设计规范 R3.4⑦ / R6.6 要求并列展示各方表述） */
    conflict_statements: [
      {
        source_name: 'The Direct',
        statement: '称影片档期将后移至 2028 年，并称已获内部人士确认',
        source_url: 'https://thedirect.com/rss'
      },
      {
        source_name: 'ComicBook',
        statement: '称影片仍按 2027 年 12 月 17 日原档期推进，未收到延期通知',
        source_url: 'https://comicbook.com/category/marvel/feed/'
      }
    ],

    status_history: [
      {
        from: 'single_source',
        to: 'conflicting',
        at: '2026-09-21T16:00:00Z',
        reason: 'R8.3 Step 4 命中：两个可靠来源对同一要素给出互斥表述，先于多源判定成立',
        evidence_url: 'https://comicbook.com/category/marvel/feed/'
      }
    ],
    status_changed_at: '2026-09-21T16:00:00Z',
    status_change_reason: 'R8.3 Step 4 命中：存在互斥表述，「各来源表述一致」前提被破坏',
    status_change_evidence_url: 'https://comicbook.com/category/marvel/feed/',

    supersedes_id: null,
    superseded_by_id: null,

    report_corrections: [],

    judged_by: 'human_confirmed',
    chain_steps_hit: 'Step 4',
    conflict_resolved_at: null,
    conflict_resolved_by_evidence_url: null
  },

  /* ── 09 ★ 官方已否认（默认不进列表，因 pinned=true 才出现）──── */
  {
    id: 'news-2026-09-20-009',
    title: '网传《死侍与金刚狼》续集已开机',
    summary: '此前有传闻称该片续集已进入拍摄阶段。Marvel 官方已就此事作出否认表态。本条默认不进入首页与列表，仅因人工置顶而在列表显著位置提示。',
    publish_time: '2026-09-20',
    first_seen_at: '2026-09-20T12:00:00Z',
    verification_status: 'officially_denied',
    category: 'movie',

    reported_by: [
      {
        source_name: 'Marvel 官方',
        source_url: 'https://www.marvel.com/news',
        owner_group: 'Disney / Marvel'
      }
    ],
    independent_group_count: 1,
    original_source: '社交平台爆料（未具名）',
    original_source_url: '',

    official_source: 'Marvel 官方',
    official_source_url: 'https://www.marvel.com/news',

    related_movies: ['deadpool-wolverine'],
    related_series: [],
    related_characters: ['wade', 'logan'],
    related_phases: [6],

    pinned: true,
    pinned_until: '2026-09-25T00:00:00Z',
    pinned_order: 1,
    pinned_reason: '该消息已被官方否认，需在列表显著位置向用户提示，避免继续传播',

    status_history: [
      {
        from: 'rumor',
        to: 'officially_denied',
        at: '2026-09-20T12:00:00Z',
        reason: 'R8.3 Step 2 命中：官方明确否认，且否认来源通过 R7.4 校验（marvel.com / /news/*）',
        evidence_url: 'https://www.marvel.com/news'
      }
    ],
    status_changed_at: '2026-09-20T12:00:00Z',
    status_change_reason: 'R8.3 Step 2 命中：官方否认（可回链官方原始 URL）',
    status_change_evidence_url: 'https://www.marvel.com/news',

    supersedes_id: null,
    superseded_by_id: null,

    report_corrections: [],
    conflict_statements: [],

    judged_by: 'human_confirmed',
    chain_steps_hit: 'Step 2',
    conflict_resolved_at: null,
    conflict_resolved_by_evidence_url: null
  },

  /* ── 10 ★ 事件级 corrected（全部有效报道均被更正且无其他证据）── */
  {
    id: 'news-2026-09-20-010',
    title: '《钢铁心》第二季将改档至 2027 年',
    summary: '最初出现的该档期消息已被其发布方发布更正声明，且不存在其他仍有效的报道。事件级状态因此落为「来源已更正」，原报道与更正记录均予保留。',
    publish_time: '2026-09-20',
    first_seen_at: '2026-09-20T09:30:00Z',
    verification_status: 'corrected',
    category: 'series',

    reported_by: [
      {
        source_name: 'The Direct',
        source_url: 'https://thedirect.com/rss',
        owner_group: '待核'
      }
    ],
    independent_group_count: 0,
    original_source: 'The Direct',
    original_source_url: 'https://thedirect.com/rss',

    official_source: '',
    official_source_url: '',

    related_movies: [],
    related_series: ['ironheart'],
    related_characters: [],
    related_phases: [6],

    pinned: false,
    pinned_until: null,
    pinned_order: 0,
    pinned_reason: '',

    /* 报道级更正记录（R8.5：保留原始报道、更正记录与链式引用） */
    report_corrections: [
      {
        source_name: 'The Direct',
        corrected_at: '2026-09-20T09:30:00Z',
        original_statement: '称《钢铁心》第二季将改档至 2027 年',
        corrected_statement: '更正为档期未定，此前表述有误',
        evidence_url: 'https://thedirect.com/rss'
      }
    ],

    status_history: [
      {
        from: 'single_source',
        to: 'corrected',
        at: '2026-09-20T09:30:00Z',
        reason: 'R8.3 Step 3 命中：该事件的全部有效报道均已被其发布方更正，且不存在其他有效证据',
        evidence_url: 'https://thedirect.com/rss'
      }
    ],
    status_changed_at: '2026-09-20T09:30:00Z',
    status_change_reason: 'R8.3 Step 3 命中：全部有效报道均被更正，事件级落为 corrected',
    status_change_evidence_url: 'https://thedirect.com/rss',

    supersedes_id: 'news-2026-09-19-014',
    superseded_by_id: null,

    conflict_statements: [],

    judged_by: 'human_confirmed',
    chain_steps_hit: 'Step 3',
    conflict_resolved_at: null,
    conflict_resolved_by_evidence_url: null
  },

  /* ── 11 ★ 报道级 corrected（事件级仍为多家媒体报道）────────── */
  {
    id: 'news-2026-09-19-011',
    title: '《旺达幻视》衍生剧正在讨论中',
    summary: '两家不同 owner_group 的媒体分别报道了该项目正在讨论中的消息，目前事件级状态仍为多家媒体报道。其中一家媒体已就报道中的细节发布更正声明，更正后内容以该媒体最新版本为准。',
    publish_time: '2026-09-19',
    first_seen_at: '2026-09-19T14:00:00Z',
    verification_status: 'multi_source_reported',
    category: 'series',

    reported_by: [
      {
        source_name: 'Variety',
        source_url: 'https://variety.com/feed/',
        owner_group: 'Penske Media Corporation'
      },
      {
        source_name: 'Entertainment Weekly',
        source_url: 'https://ew.com/',
        owner_group: 'People Inc.'
      }
    ],
    independent_group_count: 2,
    original_source: 'unknown',
    original_source_url: '',

    official_source: '',
    official_source_url: '',

    related_movies: [],
    related_series: ['wandavision', 'agatha-all-along'],
    related_characters: ['wanda', 'vision'],
    related_phases: [4],

    pinned: false,
    pinned_until: null,
    pinned_order: 0,
    pinned_reason: '',

    /* 报道级更正：事件级状态不变（R8.5 corrected 的事件级语义） */
    report_corrections: [
      {
        source_name: 'Entertainment Weekly',
        corrected_at: '2026-09-19T14:00:00Z',
        original_statement: '原表述称该剧已获正式预订',
        corrected_statement: '更正为项目仍在早期讨论阶段，尚未获得预订',
        evidence_url: 'https://ew.com/'
      }
    ],

    status_history: [
      {
        from: null,
        to: 'multi_source_reported',
        at: '2026-09-19T14:00:00Z',
        reason: 'R8.3 Step 5 命中：2 个独立 owner_group 且剩余有效证据表述一致',
        evidence_url: 'https://variety.com/feed/'
      },
      {
        from: 'multi_source_reported',
        to: 'multi_source_reported',
        at: '2026-09-19T14:00:00Z',
        reason: '其中一家来源发布更正。按 R8.5 事件级语义，corrected 为报道级标记，事件级须按当前仍有效的证据重跑判定链；剩余证据仍满足 ≥2 个独立 owner_group 且一致，故事件级维持多家媒体报道',
        evidence_url: 'https://ew.com/'
      }
    ],
    status_changed_at: '2026-09-19T14:00:00Z',
    status_change_reason: '报道级更正不改变事件级状态（R8.5），重跑判定链后仍命中 Step 5',
    status_change_evidence_url: 'https://ew.com/',

    supersedes_id: null,
    superseded_by_id: null,

    conflict_statements: [],

    judged_by: 'human_confirmed',
    chain_steps_hit: 'Step 5',
    conflict_resolved_at: null,
    conflict_resolved_by_evidence_url: null
  },

  /* ── 12 已失效置顶（pinned_until 已过 → 回到时间序）──────────── */
  {
    id: 'news-2026-09-18-012',
    title: '《雷霆特攻队*》原声带上线流媒体平台',
    summary: '该片原声带已在主要流媒体平台上架。消息来自单一来源报道，尚未获得官方确认。本条曾被人工置顶，置顶有效期已过，现按发布时间排序。',
    publish_time: '2026-09-18',
    first_seen_at: '2026-09-18T08:00:00Z',
    verification_status: 'single_source',
    category: 'movie',

    reported_by: [
      {
        source_name: 'Collider',
        source_url: 'https://collider.com/feed/',
        owner_group: 'Valnet'
      }
    ],
    independent_group_count: 1,
    original_source: 'unknown',
    original_source_url: '',

    official_source: '',
    official_source_url: '',

    related_movies: ['thunderbolts'],
    related_series: [],
    related_characters: [],
    related_phases: [5],

    pinned: true,
    pinned_until: '2026-09-19T00:00:00Z',
    pinned_order: 3,
    pinned_reason: '原声带上线当日的时效性置顶，有效期届满后自动回到时间序',

    status_history: [
      {
        from: null,
        to: 'single_source',
        at: '2026-09-18T08:00:00Z',
        reason: 'R8.3 Step 6 命中：仅 1 个独立 owner_group 的可靠媒体报道',
        evidence_url: 'https://collider.com/feed/'
      }
    ],
    status_changed_at: '2026-09-18T08:00:00Z',
    status_change_reason: '首次判定即命中 R8.3 Step 6',
    status_change_evidence_url: 'https://collider.com/feed/',

    supersedes_id: null,
    superseded_by_id: null,

    report_corrections: [],
    conflict_statements: [],

    judged_by: 'ai_suggested',
    chain_steps_hit: 'Step 6',
    conflict_resolved_at: null,
    conflict_resolved_by_evidence_url: null
  },

  /* ── 13 第二条有效置顶（pinned_order 2，测试多条置顶排序）──── */
  {
    id: 'news-2026-09-19-013',
    title: '《复仇者联盟5：毁灭之日》主创访谈：毁灭博士的塑造方向',
    summary: 'Marvel 官方发布主创访谈内容，谈及毁灭博士在第六阶段的塑造方向。本条为官方发布内容，经人工复核确认来源可回链。',
    publish_time: '2026-09-19',
    first_seen_at: '2026-09-19T02:00:00Z',
    verification_status: 'official_confirmed',
    category: 'movie',

    reported_by: [
      {
        source_name: 'Marvel 官方',
        source_url: 'https://www.marvel.com/articles/live-events/',
        owner_group: 'Disney / Marvel'
      }
    ],
    independent_group_count: 1,
    original_source: 'Marvel 官方',
    original_source_url: 'https://www.marvel.com/articles/live-events/',

    official_source: 'Marvel 官方',
    official_source_url: 'https://www.marvel.com/articles/live-events/',

    related_movies: [],
    related_series: [],
    related_characters: ['strange'],
    related_phases: [6],

    pinned: true,
    pinned_until: '2026-10-06T00:00:00Z',
    pinned_order: 2,
    pinned_reason: '第六阶段核心作品的官方主创访谈，人工置顶以配合预告发布周期',

    status_history: [
      {
        from: null,
        to: 'official_confirmed',
        at: '2026-09-19T02:00:00Z',
        reason: 'official_source_url 命中官方来源登记表（marvel.com / /articles/live-events/*），经人工复核',
        evidence_url: 'https://www.marvel.com/articles/live-events/'
      }
    ],
    status_changed_at: '2026-09-19T02:00:00Z',
    status_change_reason: 'R8.3 Step 1 命中：官方来源 URL 通过 R7.4 校验',
    status_change_evidence_url: 'https://www.marvel.com/articles/live-events/',

    supersedes_id: null,
    superseded_by_id: null,

    report_corrections: [],
    conflict_statements: [],

    judged_by: 'human_confirmed',
    chain_steps_hit: 'Step 1',
    conflict_resolved_at: null,
    conflict_resolved_by_evidence_url: null
  },

  /* ── 14 被更正前的原始版本（superseded_by_id 指向 010）──────── */
  {
    id: 'news-2026-09-19-014',
    title: '《钢铁心》第二季将改档至 2027 年',
    summary: '本条为已被更正的原始报道版本。按 R8.5，原始报道与更正记录一并保留，不因更正而删除。列表展示时与更正后版本合并为一条，以更正后内容为准。',
    publish_time: '2026-09-19',
    first_seen_at: '2026-09-19T01:00:00Z',
    verification_status: 'corrected',
    category: 'series',

    reported_by: [
      {
        source_name: 'The Direct',
        source_url: 'https://thedirect.com/rss',
        owner_group: '待核'
      }
    ],
    independent_group_count: 0,
    original_source: 'The Direct',
    original_source_url: 'https://thedirect.com/rss',

    official_source: '',
    official_source_url: '',

    related_movies: [],
    related_series: ['ironheart'],
    related_characters: [],
    related_phases: [6],

    pinned: false,
    pinned_until: null,
    pinned_order: 0,
    pinned_reason: '',

    report_corrections: [
      {
        source_name: 'The Direct',
        corrected_at: '2026-09-20T09:30:00Z',
        original_statement: '称《钢铁心》第二季将改档至 2027 年',
        corrected_statement: '更正为档期未定，此前表述有误',
        evidence_url: 'https://thedirect.com/rss'
      }
    ],

    status_history: [
      {
        from: 'single_source',
        to: 'corrected',
        at: '2026-09-20T09:30:00Z',
        reason: '原发布方发布更正声明，事件级状态随之落为 corrected',
        evidence_url: 'https://thedirect.com/rss'
      }
    ],
    status_changed_at: '2026-09-20T09:30:00Z',
    status_change_reason: 'R8.3 Step 3 命中：原发布方已发布更正',
    status_change_evidence_url: 'https://thedirect.com/rss',

    supersedes_id: null,
    superseded_by_id: 'news-2026-09-20-010',

    conflict_statements: [],

    judged_by: 'human_confirmed',
    chain_steps_hit: 'Step 3',
    conflict_resolved_at: null,
    conflict_resolved_by_evidence_url: null
  },

  /* ── 15 ★ 关联 id 校验用例：related_movies 含非 MCU_CONTENT 的 id ──
   *   'avengers-5' 存在于 MCU_UPCOMING，但不在 MCU_CONTENT，
   *   因此 MCU.data.get('avengers-5') 返回 null → 渲染时必须丢弃。
   *   同时 first_seen_at 存在但 publish_time 缺失 → 日期回落到 first_seen_at。 */
  {
    id: 'news-2026-09-17-015',
    title: '美国队长主题特展公布巡展城市',
    summary: '美国队长主题特展公布新一轮巡展城市名单。本条用于验证两件事：一是关联 id 未命中 MCU_CONTENT 时必须丢弃（不展示为关联节点），二是 publish_time 缺失时日期回落到 first_seen_at。',
    publish_time: null,
    first_seen_at: '2026-09-17T10:00:00Z',
    verification_status: 'single_source',
    category: 'character',

    reported_by: [
      {
        source_name: 'The Walt Disney Company 官方公告页',
        source_url: 'https://thewaltdisneycompany.com/feed/',
        owner_group: 'The Walt Disney Company'
      }
    ],
    independent_group_count: 1,
    original_source: 'unknown',
    original_source_url: '',

    official_source: '',
    official_source_url: '',

    related_movies: ['avengers-5'],
    related_series: [],
    related_characters: ['steve', 'sam'],
    related_phases: [6],

    pinned: false,
    pinned_until: null,
    pinned_order: 0,
    pinned_reason: '',

    status_history: [
      {
        from: null,
        to: 'single_source',
        at: '2026-09-17T10:00:00Z',
        reason: 'R8.3 Step 6 命中：仅 1 个独立 owner_group 的可靠媒体报道',
        evidence_url: 'https://thewaltdisneycompany.com/feed/'
      }
    ],
    status_changed_at: '2026-09-17T10:00:00Z',
    status_change_reason: '首次判定即命中 R8.3 Step 6',
    status_change_evidence_url: 'https://thewaltdisneycompany.com/feed/',

    supersedes_id: null,
    superseded_by_id: null,

    report_corrections: [],
    conflict_statements: [],

    judged_by: 'ai_suggested',
    chain_steps_hit: 'Step 6',
    conflict_resolved_at: null,
    conflict_resolved_by_evidence_url: null
  }

];
