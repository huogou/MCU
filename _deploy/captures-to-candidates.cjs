/* ============================================================
 * N1.2 U2 · L0 captures → L1 candidates 生产桥接（真实 DashScope）
 * ------------------------------------------------------------
 * 定位：把 production-capture 落盘的 L0 原始捕获，经**真实 AI Provider**
 *   分析并构造为合法 L1 候选（35 字段），写入候选归档（全 pending，
 *   等待人工审核）。这是「自动采集 → 人工审核」之间的生产桥接层。
 *
 * 链路（严格复用冻结件，零修改）：
 *   captures/<date>.captures.json（L0）
 *     → NA.analyzeCandidate（adapter → contract-validator 7 字段 → bridge）
 *     → CI.fromRawCapture（idSpace 约束 + 35 字段 + L1 校验）
 *     → CandS.appendCandidates（幂等去重落盘）
 *     → status/item-status analysis{}（P1-B：confidence 等扩展字段落位）
 *
 * 纪律：
 *   1. 默认 --limit=3（未传参数最多 3 次 AI 调用），硬顶 20；
 *   2. P0 取样：S002≤14 / S004≤3 / S006≤3（官方源：近 7 天 + MCU 预筛选），
 *      不足名额优先回流 S002、其次 S004；S006 配额 3 为硬上限不参与回流；
 *   3. 按规范化 URL 与标题去重；S006 关键词命中仅进候选池，不代表通过审核；
 *   4. 单条 AI 失败不阻断批量（fail_reasons 记录）；
 *   5. 不自动 approve、不写 news.js、不碰 deliveries；
 *   6. Key 仅经环境变量 DASHSCOPE_API_KEY；任何输出不含 Key。
 *
 * 用法：
 *   node tools/captures-to-candidates.cjs --date 20261012             # 默认 3 条
 *   node tools/captures-to-candidates.cjs --date 20261012 --limit 20  # 显式 20 条
 *
 * 退出码：0 成功 / 1 运行失败 / 2 参数错误
 * ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');

const PIPELINE = path.resolve(__dirname, '..');
const NA = require(path.join(PIPELINE, 'ai', 'news-analyzer.cjs'));        /* P1-B（冻结，只读） */
const CI = require(path.join(PIPELINE, 'candidate-item.cjs'));             /* L1 构造/校验（冻结） */
const CandS = require(path.join(PIPELINE, 'candidate-store.cjs'));         /* L1 归档（冻结） */
const ID = require(path.join(PIPELINE, 'ai-provider', 'id-space.cjs'));    /* h5 真实 idSpace（冻结） */
const SM = require(path.join(PIPELINE, 'status', 'status-machine.cjs'));   /* P1-A 状态层（冻结） */
const DS = require(path.join(PIPELINE, 'ai-provider', 'providers', 'dashscope.cjs'));

/* ============================================================
 * P0 取样层：纯函数、零网络、零落盘、不修改入参
 * ------------------------------------------------------------
 * 目标：替代 captures.slice(0, limit) 的来源前缀截断缺陷。
 *   - 按来源配额轮转取样：S002 14 / S004 3 / S006 3；
 *   - S006 为官方公告源，单独施加「近 7 天 + MCU 相关性预筛选」；
 *     关键词命中仅表示进入候选池，不构成内容审核结论；
 *   - 某源不足配额时，剩余名额优先回流 S002、其次 S004；
 *     S006 为官方源且配额 3 为硬上限，不参与回流；
 *   - 按规范化 URL 与规范化标题全局去重，重复资讯不会重复进入 AI；
 *   - 默认 DEFAULT_LIMIT=3，硬顶 MAX_TOTAL=20。
 * ============================================================ */
const SOURCE_ORDER = Object.freeze(['S002', 'S004', 'S006']);
/* S006 配额 3 为硬上限，不参与空余名额回流 */
const REDISTRIBUTE_ORDER = Object.freeze(['S002', 'S004']);
const DEFAULT_QUOTAS = Object.freeze({ S002: 14, S004: 3, S006: 3 });
const FRESH_SOURCES = Object.freeze(['S006']);
const FRESH_DAYS = 7;
const DEFAULT_LIMIT = 3;
const MAX_TOTAL = 20;
const DAY_MS = 86400000;

/* S006 官方源 MCU 相关性预筛选：宽松词表，仅决定能否进入候选池 */
const MCU_KEYWORDS_EN = Object.freeze([
  'marvel', 'marvel studios', 'marvel television', 'mcu',
  'avengers', 'doomsday', 'secret wars', 'endgame', 'infinity war',
  'spider-man', 'spider man', 'spider-verse', 'spiderverse',
  'daredevil', 'born again', 'visionquest', 'vision quest', 'wandavision',
  'fantastic four', 'x-men', 'x men', 'black panther', 'captain america',
  'iron man', 'ironheart', 'thor', 'loki', 'hulk', 'doctor strange',
  'deadpool', 'wolverine', 'thunderbolts', 'agatha', 'echo', 'ms marvel',
  'shang-chi', 'eternals', 'moon knight', 'she-hulk', 'hawkeye',
  'falcon', 'winter soldier', 'what if', 'ghost rider', 'blade',
  'ultron', 'human torch', 'doctor doom', 'galactus', 'silver surfer',
  'phase 5', 'phase 6', 'phase five', 'phase six'
].map(function (k) { return ' ' + normalizeTitle(k) + ' '; }));

const MCU_KEYWORDS_ZH = Object.freeze([
  '漫威', '复仇者联盟', '蜘蛛侠', '夜魔侠', '幻视', '末日博士', '神奇四侠',
  '黑豹', '美国队长', '钢铁侠', '雷神', '洛基', '绿巨人', '奇异博士',
  '死侍', '金刚狼', '猎鹰', '冬兵', '绯红女巫', '旺达', '霹雳火', '奥创'
]);

/** S006 官方公告 MCU 相关性预筛选：宽松关键词命中 ≠ 通过内容审核 */
function isMcuRelated(cap) {
  const text = ' ' + normalizeTitle(String((cap && cap.title_raw) || '') + ' ' +
    String((cap && cap.raw_excerpt) || '')) + ' ';
  return MCU_KEYWORDS_EN.some(function (k) { return text.indexOf(k) >= 0; }) ||
    MCU_KEYWORDS_ZH.some(function (k) { return text.indexOf(k) >= 0; });
}

/** 解析 --limit：默认 3，硬顶 20；缺省或非数字一律回落默认值 */
function resolveLimit(args) {
  const raw = (args && Number.isFinite(args.limit)) ? args.limit : DEFAULT_LIMIT;
  return Math.min(Math.max(raw, 1), MAX_TOTAL);
}

/** URL 规范化：去协议/www/尾斜杠/hash 与常见跟踪参数，保留有效 path 与业务 query */
function normalizeUrl(u) {
  if (typeof u !== 'string' || !u.trim()) return '';
  let v;
  try { v = new URL(u.trim()); } catch (e) { return ''; }
  if ((v.protocol !== 'http:' && v.protocol !== 'https:') || !v.hostname) return '';
  const keptQuery = Array.from(v.searchParams.entries())
    .filter(function (kv) { return !/^(utm_|fbclid|gclid|ref|spm|source)/i.test(kv[0]); })
    .map(function (kv) { return kv[0] + '=' + kv[1]; })
    .sort().join('&');
  return v.hostname.toLowerCase().replace(/^www\./, '') +
    v.pathname.replace(/\/+$/, '') + (keptQuery ? '?' + keptQuery : '');
}

/** 标题规范化：NFKC + 小写 + HTML 实体剥离 + 仅保留字母数字（含中文） */
function normalizeTitle(t) {
  if (typeof t !== 'string') return '';
  return t.normalize('NFKC').toLowerCase()
    .replace(/&[a-z]+;|&#\d+;/gi, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ').trim();
}

/** 时间解析：只接受可解析且有限的时间，异常返回 null */
function parseTime(v) {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v !== 'string' || !v.trim()) return null;
  const t = Date.parse(v.trim());
  return Number.isFinite(t) ? t : null;
}

/** URL 合法性：仅 http/https 且主机名非空 */
function isValidUrl(u) {
  if (typeof u !== 'string' || !u.trim()) return false;
  try {
    const p = new URL(u.trim());
    return (p.protocol === 'http:' || p.protocol === 'https:') && !!p.hostname;
  } catch (e) { return false; }
}

/** 新鲜度基准：优先注入 nowMs，其次归档日期当日 23:59:59Z，异常时退回当前时间 */
function referenceMs(date, nowMs) {
  if (Number.isFinite(nowMs)) return { ms: nowMs, source: 'injected' };
  const d = String(date || '');
  if (/^\d{8}$/.test(d)) {
    const y = Number(d.slice(0, 4)), m = Number(d.slice(4, 6)), day = Number(d.slice(6, 8));
    const t = Date.UTC(y, m - 1, day, 23, 59, 59, 999);
    const chk = new Date(t);
    if (Number.isFinite(t) && chk.getUTCFullYear() === y &&
        chk.getUTCMonth() === m - 1 && chk.getUTCDate() === day) {
      return { ms: t, source: 'date:' + d };
    }
  }
  return { ms: Date.now(), source: 'now' };
}

/**
 * 按来源配额 / 新鲜度 / 去重取样。
 * @param {Array} captures L0 原始捕获数组（只读，不会被修改）
 * @param {object} opts { date, limit, nowMs?, freshDays?, quotas? }
 * @returns {{batch:Array, stats:object}} batch 内元素为原始 capture 引用
 */
function selectBatch(captures, opts) {
  const o = opts || {};
  const list = Array.isArray(captures) ? captures : [];
  const rawLimit = Number.isFinite(o.limit) ? o.limit : DEFAULT_LIMIT;
  const totalLimit = Math.min(Math.max(rawLimit, 1), MAX_TOTAL);
  const quotas = Object.assign({}, DEFAULT_QUOTAS, o.quotas || {});
  const freshDays = Number.isFinite(o.freshDays) ? Math.max(0, o.freshDays) : FRESH_DAYS;
  const ref = referenceMs(o.date, o.nowMs);
  const cutoff = ref.ms - freshDays * DAY_MS;

  const stats = {
    input: list.length,
    reference_ms: ref.ms,
    reference_source: ref.source,
    cutoff_ms: cutoff,
    total_limit: totalLimit,
    default_limit: DEFAULT_LIMIT,
    quotas: Object.assign({}, quotas),
    per_source_input: {},
    per_source_output: {},
    rejected: {
      unknown_source: 0, invalid_url: 0, bad_date: 0, stale: 0,
      non_mcu_s006: 0, duplicate: 0, invalid_item: 0
    },
    s006_filter: {
      official: true, window_days: freshDays, quota: quotas.S006,
      total: 0, stale: 0, bad_date: 0, non_mcu: 0, eligible: 0
    },
    duplicates: 0,
    redistributed: 0,
    output: 0
  };
  SOURCE_ORDER.forEach(function (s) { stats.per_source_input[s] = 0; stats.per_source_output[s] = 0; });

  const pools = {};
  SOURCE_ORDER.forEach(function (s) { pools[s] = []; });

  list.forEach(function (cap, idx) {
    if (!cap || typeof cap !== 'object' || Array.isArray(cap)) { stats.rejected.invalid_item++; return; }
    const src = String(cap.registry_id || '');
    if (SOURCE_ORDER.indexOf(src) < 0) { stats.rejected.unknown_source++; return; }
    if (!isValidUrl(cap.source_url)) { stats.rejected.invalid_url++; return; }

    const pub = parseTime(cap.published_at);
    const pubRaw = parseTime(cap.published_at_raw);
    const published = Number.isFinite(pub) ? pub : (Number.isFinite(pubRaw) ? pubRaw : null);

    /* S006 官方源三道门：日期可解析且在 7 天窗口 → MCU 相关性预筛选 */
    if (FRESH_SOURCES.indexOf(src) >= 0) {
      stats.s006_filter.total++;
      if (!Number.isFinite(published) || published > ref.ms + DAY_MS) {
        stats.rejected.bad_date++; stats.s006_filter.bad_date++; return;
      }
      if (published < cutoff) {
        stats.rejected.stale++; stats.s006_filter.stale++; return;
      }
      /* 关键词命中仅进入候选池；不产生审核结论，也不改变官方来源属性 */
      if (!isMcuRelated(cap)) {
        stats.rejected.non_mcu_s006++; stats.s006_filter.non_mcu++; return;
      }
      stats.s006_filter.eligible++;
    }

    /* 排序时间：优先发布时间，退化用 fetched_at；异常排最后但不丢弃（S002/S004） */
    let sortTs = Number.isFinite(published) ? published : parseTime(cap.fetched_at);
    if (!Number.isFinite(sortTs) || sortTs > ref.ms + DAY_MS) {
      stats.rejected.bad_date++;
      sortTs = Number.NEGATIVE_INFINITY;
    }

    pools[src].push({
      cap: cap, idx: idx, ts: sortTs,
      urlKey: normalizeUrl(cap.source_url),
      titleKey: normalizeTitle(cap.title_raw)
    });
    stats.per_source_input[src]++;
  });

  SOURCE_ORDER.forEach(function (s) {
    pools[s].sort(function (a, b) {
      if (a.ts === b.ts) return a.idx - b.idx;
      return a.ts > b.ts ? -1 : 1;
    });
  });

  const seenUrl = new Set();
  const seenTitle = new Set();
  /** 从某源池中弹出下一条未重复的条目（重复项直接丢弃，不会进入 AI） */
  function popValid(src) {
    const pool = pools[src];
    while (pool.length) {
      const item = pool.shift();
      const u = item.urlKey, t = item.titleKey;
      if ((u && seenUrl.has(u)) || (t && seenTitle.has(t))) {
        stats.duplicates++; stats.rejected.duplicate++; continue;
      }
      if (u) seenUrl.add(u);
      if (t) seenTitle.add(t);
      return item.cap;
    }
    return null;
  }

  const picked = {};
  SOURCE_ORDER.forEach(function (s) { picked[s] = []; });
  let used = 0;

  /* 阶段 1：按来源配额轮转取样（保证小 --limit 也有三源覆盖） */
  let progressed = true;
  while (used < totalLimit && progressed) {
    progressed = false;
    for (let i = 0; i < SOURCE_ORDER.length && used < totalLimit; i++) {
      const s = SOURCE_ORDER[i];
      if (picked[s].length >= quotas[s]) continue;
      const cap = popValid(s);
      if (!cap) continue;
      picked[s].push(cap); used++; progressed = true;
    }
  }

  /* 阶段 2：来源不足时按优先级回流（S002 优先，其次 S004；S006 不回流） */
  for (let i = 0; i < REDISTRIBUTE_ORDER.length && used < totalLimit; i++) {
    const s = REDISTRIBUTE_ORDER[i];
    while (used < totalLimit && pools[s].length) {
      const cap = popValid(s);
      if (!cap) break;
      picked[s].push(cap);
      used++; stats.redistributed++;
    }
  }

  const batch = [];
  SOURCE_ORDER.forEach(function (s) {
    stats.per_source_output[s] = picked[s].length;
    picked[s].forEach(function (c) { batch.push(c); });
  });
  stats.output = batch.length;
  return { batch: batch, stats: stats };
}

/** 统计批次来源分布（供 CLI 与测试输出对照） */
function summarizeSources(batch) {
  const out = {};
  SOURCE_ORDER.forEach(function (s) { out[s] = 0; });
  (Array.isArray(batch) ? batch : []).forEach(function (c) {
    const s = String((c && c.registry_id) || '');
    if (s in out) out[s]++;
  });
  return out;
}

function fail(code, message, exitCode) {
  const e = new Error('[' + code + '] ' + message);
  e.code = code;
  e._exit = exitCode || 1;
  throw e;
}

function parseArgs(argv) {
  const a = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (t === '--date') a.date = argv[++i];
    else if (t === '--limit') a.limit = parseInt(argv[++i], 10);
    else if (t === '--dry-run') a.dryRun = true;
    else if (t === '--json') a.json = true;
    else a._.push(t);
  }
  return a;
}

function todayCompact() { return new Date().toISOString().slice(0, 10).replace(/-/g, ''); }

async function main() {
  const a = parseArgs(process.argv.slice(2));
  const date = a.date || todayCompact();
  /* 默认 3：未传 --limit 最多 3 次 AI 调用；显式指定才可上调，硬顶 20 */
  const limit = resolveLimit(a);

  /* ---- 输入：当日 L0 捕获归档 ---- */
  const capPath = path.join(PIPELINE, 'captures', date + '.captures.json');
  if (!fs.existsSync(capPath)) fail('CAPTURES_NOT_FOUND', '当日捕获归档不存在：' + capPath + '（先运行 production-capture）');
  const capDoc = JSON.parse(fs.readFileSync(capPath, 'utf8'));
  const captures = Array.isArray(capDoc.captures) ? capDoc.captures : [];
  if (!captures.length) fail('CAPTURES_EMPTY', '当日捕获归档为空：' + capPath);

  /* ---- 真实 idSpace（复用 h5/data，不建第二套） ---- */
  const space = ID.loadIdSpace();

  /* ---- 真实 DashScope Provider（Key 仅来自环境变量） ---- */
  const KEY = process.env.DASHSCOPE_API_KEY || '';
  if (!KEY.trim()) fail('KEY_MISSING', 'DASHSCOPE_API_KEY 未配置（环境变量）');
  const MODEL = process.env.U1_MODEL || 'qwen3.8-flash';
  const provider = DS.createDashScopeProvider({ apiKey: KEY, model: MODEL, baseUrl: DS.DEFAULT_BASE, timeoutMs: 60000 });
  const meta = { model: MODEL, structuredOutput: 'json_schema' };

  /* ---- P0 取样：来源配额 + S006 官方源（7 天 + MCU 预筛选）+ 双键去重 ---- */
  const sampling = selectBatch(captures, { date: date, limit: limit });
  const batch = sampling.batch;
  console.log('取样来源分布：' + JSON.stringify(summarizeSources(batch)) + ' / 共 ' + batch.length + ' 条');

  const report = {
    date: date,
    model: MODEL,
    captures_total: captures.length,
    batch_size: batch.length,
    sampling: {
      total_limit: sampling.stats.total_limit,
      default_limit: sampling.stats.default_limit,
      per_source_input: sampling.stats.per_source_input,
      per_source_output: sampling.stats.per_source_output,
      s006_filter: sampling.stats.s006_filter,
      rejected: sampling.stats.rejected,
      redistributed: sampling.stats.redistributed
    },
    ai_success: 0,
    ai_failed: 0,
    candidates_added: 0,
    candidates_skipped: 0,
    candidates_conflicts: 0,
    fail_reasons: [],
    dry_run: !!a.dryRun
  };

  const l1s = [];
  const analysisMap = {};
  for (let i = 0; i < batch.length; i++) {
    const cap = batch[i];
    try {
      /* adapter → contract-validator（7 字段）→ bridge；异常向上抛由本处捕获 */
      const res = await NA.analyzeCandidate({
        provider: provider,
        candidate: cap,
        meta: meta,
        idSpace: space,
        seq: i + 1
      });
      if (!res.seven) throw Object.assign(new Error('seven 为空'), { code: 'SEVEN_EMPTY' });
      /* L0 → L1：fromRawCapture 内部完成 idSpace 丢弃 + 35 字段 + validate */
      const l1 = CI.fromRawCapture(
        cap,
        Object.assign({}, res.seven, { ai_model: res.ai_model || MODEL, gate_status: 'pending' }),
        { seq: i + 1, idSpace: space }
      );
      l1s.push(l1);
      analysisMap[l1.candidate_id] = res.extensions;
      report.ai_success++;
      console.log('  AI✓ ' + (cap.title_raw || '').slice(0, 46) + ' → ' + l1.candidate_id +
        '（' + (res.extensions.credibility || '?') + '/' + (res.extensions.confidence ?? '?') + '）');
    } catch (e) {
      report.ai_failed++;
      report.fail_reasons.push({ capture_id: cap.capture_id || '', code: (e && e.code) || 'ERROR', message: e && e.message });
      console.log('  AI✗ ' + (cap.title_raw || '').slice(0, 46) + ' → ' + ((e && e.code) || 'ERROR'));
    }
  }

  /* ---- 落盘：候选归档（幂等）+ status analysis（P1-B 语义） ---- */
  if (!a.dryRun && l1s.length) {
    const r = CandS.appendCandidates(l1s, { dir: CandS.DEFAULT_DIR, date: date });
    report.candidates_added = r.added;
    report.candidates_skipped = r.skipped;
    report.candidates_conflicts = r.conflicts.length;
    report.candidates_file = r.file;
    const itemStore = SM.createItemStore({ dir: path.join(PIPELINE, 'status'), date: date });
    l1s.forEach(function (c) {
      itemStore.setAnalysis('cand-' + c.candidate_id, analysisMap[c.candidate_id]);
      itemStore.mark('cand-' + c.candidate_id, 'L1', 'AI_ANALYZED', { by: 'captures-to-candidates', evidence: 'ai:' + MODEL, note: 'enriched' });
    });
  }

  console.log('\n---- summary ----');
  console.log(JSON.stringify(report, null, 2));
  if (a.json) return;
  if (report.ai_failed && !report.ai_success) process.exit(1);
}

/* CLI 守卫：被 require 时只导出纯函数，绝不触发 main / AI 调用 / 落盘 */
if (require.main === module) {
  main().catch(function (e) {
    console.error('失败：' + (e && e.message));
    process.exit(e && e._exit ? e._exit : 1);
  });
}

module.exports = {
  SOURCE_ORDER: SOURCE_ORDER,
  REDISTRIBUTE_ORDER: REDISTRIBUTE_ORDER,
  DEFAULT_QUOTAS: DEFAULT_QUOTAS,
  FRESH_SOURCES: FRESH_SOURCES,
  FRESH_DAYS: FRESH_DAYS,
  DEFAULT_LIMIT: DEFAULT_LIMIT,
  MAX_TOTAL: MAX_TOTAL,
  MCU_KEYWORDS_EN: MCU_KEYWORDS_EN,
  MCU_KEYWORDS_ZH: MCU_KEYWORDS_ZH,
  normalizeUrl: normalizeUrl,
  normalizeTitle: normalizeTitle,
  parseTime: parseTime,
  isValidUrl: isValidUrl,
  referenceMs: referenceMs,
  isMcuRelated: isMcuRelated,
  resolveLimit: resolveLimit,
  parseArgs: parseArgs,
  selectBatch: selectBatch,
  summarizeSources: summarizeSources
};
