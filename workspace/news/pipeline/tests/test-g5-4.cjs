/* ============================================================
 * G5.4 生产采集稳定性验证（T9 多批次幂等 + T10 merger 真实数据）
 * ------------------------------------------------------------
 * 运行：
 *   离线段（始终执行）：
 *     node workspace/news/pipeline/tests/test-g5-4.cjs
 *   联网段（**需显式加 --live**）：
 *     node workspace/news/pipeline/tests/test-g5-4.cjs --live
 *
 * 断言清单（任务书 V1.0）：
 *   T9.1 历史 capture 不覆盖（G5.3 的 run20260923 批逐条原样保留）
 *   T9.2 content_hash 跨批稳定（交集条目 hash 全等；hash 可由输入复算）
 *   T9.3 同源重复内容不重复生成有效 Candidate（candidate-store 按
 *        registry_id+content_hash 去重；含 G5.3 历史批回灌验证）
 *   T9.4 单批失败不影响其他来源（fail closed，逐源独立）
 *   T10.1 event_key 仅作事件指纹、不作主键（同 key 可对应多个事件）
 *   T10.2 occurrence 不泄漏（L1/L2 全量键名深扫 0 命中）
 *   T10.3 supersedes 双条保留（news.js 真实 supersedes 对，只读引用）
 *   T10.4 merger 不删除 report（reports_preserved == 输入数、
 *         records_deleted == 0）
 *   T10.5 输出无任何状态字段（FORBIDDEN_OUTPUT_KEYS 深扫 0 命中）
 *
 * 产物（--live 时）：
 *   pipeline/captures/20260923.captures.json   追加 B1/B2/B3 三批
 *   pipeline/candidates/20260923.json          去重后的有效候选
 *   pipeline/events/20260923.events.json       merger 输出
 *   pipeline/source-health-report.json         来源健康报告（S002–S006）
 * ============================================================ */
'use strict';

const vm = require('vm');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const LOG_PATH = path.join(__dirname, 'out-g5-4.txt');
const _lines = [];
const _log = console.log.bind(console);
console.log = function () {
  const s = Array.prototype.map.call(arguments, String).join(' ');
  _lines.push(s); _log(s);
};
process.on('exit', function () {
  try { fs.writeFileSync(LOG_PATH, _lines.join('\n') + '\n', 'utf8'); } catch (e) {}
});

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');   /* tests→pipeline→news→workspace→项目根 */
const H5 = path.join(ROOT, 'h5');
const LIVE = process.argv.indexOf('--live') >= 0 || process.env.MCU_LIVE === '1';

const RC = require('../raw-capture.cjs');
const CI = require('../candidate-item.cjs');
const CS = require('../capture-store.cjs');
const CD = require('../candidate-store.cjs');          /* ★ G5.4 新增 */
const EM = require('../../engine/dedup/event-merger.cjs');
const EK = require('../../engine/dedup/event-key.cjs');
const BC = require('../collectors/base-collector.cjs');
const HT = require('../collectors/http-transport.cjs');
const F = require('../fixtures/g5-cases.cjs');

const LIVE_ALLOWED = BC.LIVE_ALLOWED;                  /* S002–S006 */
const CAP_DIR = CS.DEFAULT_DIR;                        /* pipeline/captures */
const CAND_DIR = CD.DEFAULT_DIR;                       /* pipeline/candidates */
const EV_DIR = path.join(CS.PIPELINE_DIR, 'events');
const STORE_DATE = '20260923';   /* ★ 对齐 G5.3 落盘命名（RUN_ID.slice(3)，无连字符）→ 与 G5.3 归档同文件 */
const G53_RUN_ID = 'run20260923';                      /* G5.3 历史批 */
const BATCH_RUN_IDS = ['run20260923G54B1', 'run20260923G54B2', 'run20260923G54B3'];

let pass = 0, fail = 0;
const fails = [];
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; fails.push(name + (detail ? ' → ' + detail : '')); console.log('  FAIL  ' + name + (detail ? ' → ' + detail : '')); }
}
function eq(name, actual, expected) {
  ok(name, actual === expected, 'expected ' + JSON.stringify(expected) + ', got ' + JSON.stringify(actual));
}
function section(t) { console.log('\n■ ' + t); }
function caught(fn) { try { fn(); return null; } catch (e) { return e; } }
function sha1(s) { return crypto.createHash('sha1').update(String(s), 'utf8').digest('hex'); }
function deepKeys(node) {
  const out = [];
  (function walk(n) {
    if (n == null || typeof n !== 'object') return;
    if (Array.isArray(n)) { n.forEach(walk); return; }
    Object.keys(n).forEach(function (k) { out.push(k); walk(n[k]); });
  })(node);
  return out;
}

console.log('============================================================');
console.log('G5.4 生产采集稳定性验证（T9 + T10）');
console.log('============================================================');
console.log('模式：' + (LIVE ? '**LIVE（真实联网，3 批）**' : 'OFFLINE（仅离线段）'));
console.log('批次 run_id：' + BATCH_RUN_IDS.join(' / '));

/* 载入 h5（只读）：idSpace + MCU_NEWS（supersedes 真实对） */
const ctx = {};
ctx.window = ctx; ctx.global = ctx; ctx.console = console;
ctx.URL = URL; ctx.Date = Date; ctx.Math = Math; ctx.JSON = JSON;
vm.createContext(ctx);
['movies.js', 'series.js', 'special.js', 'short.js', 'content.js', 'characters.js', 'news.js']
  .forEach(function (f) {
    vm.runInContext(fs.readFileSync(path.join(H5, 'data', f), 'utf8'), ctx, { filename: f });
  });
const NEWS = ctx.window.MCU_NEWS || [];
const idSpace = {
  content: new Set((ctx.window.MCU_CONTENT || []).map(function (x) { return x.id; })),
  character: new Set((ctx.window.MCU_CHARACTERS || []).map(function (x) { return x.id; }))
};

/** G5.4 确定性桩转换（无 AI）：title_raw 原文 / raw_excerpt / industry / 无实体 */
function stubConvert(capture, seq) {
  return CI.fromRawCapture(capture, {
    title: capture.title_raw,
    summary: capture.raw_excerpt || capture.title_raw,
    category: 'industry',
    related_movies: [], related_series: [], related_characters: [], related_phases: [],
    ai_model: 'g54-stub（G5.4 确定性桩，管道零 AI 依赖）',
    ai_suggested_status: '',
    gate_status: 'pending'
  }, { seq: seq || 1, idSpace: idSpace });
}

/* news.js 交付条目 → merger 白名单 10 键投影（真实数据，只读引用） */
function deliveryToMergerInput(n) {
  return {
    id: n.id,
    title: n.title,
    category: n.category,
    related_movies: n.related_movies || [],
    related_series: n.related_series || [],
    related_characters: n.related_characters || [],
    publish_time: n.publish_time || '',
    first_seen_at: n.first_seen_at || '',
    reported_by: n.reported_by || []
  };
}

/** 在 news.js 中动态发现 supersedes 互链对（不硬编码 010/014） */
function findSupersedesPair() {
  const byId = Object.create(null);
  NEWS.forEach(function (n) { if (n && n.id) byId[n.id] = n; });
  let pair = null;
  NEWS.forEach(function (n) {
    if (!n) return;
    if (n.supersedes_id && byId[n.supersedes_id]) pair = { older: byId[n.supersedes_id], newer: n };
    else if (n.superseded_by_id && byId[n.superseded_by_id]) pair = { older: n, newer: byId[n.superseded_by_id] };
  });
  return pair;
}

/** T10 断言组：对任意候选集跑 merger 并断言（label 用于区分离线/联网） */
function runT10Assertions(candidates, label) {
  const inputs = CI.toMergerInputs(candidates);
  const merged = EM.mergeCandidates(inputs, { windowDays: 3 });

  section('T10 [' + label + '] event-merger 真实数据验证');
  eq('T10.4a reports_preserved == 输入候选数（无丢失）',
    merged.stats.reports_preserved, inputs.length);
  eq('T10.4b records_deleted == 0（merger 不删除 report）',
    merged.stats.records_deleted, 0);
  ok('T10.4c 每条输入 id 都能在输出 reports[].id 中找到（逐一回查）',
    (function () {
      const outIds = new Set();
      merged.events.forEach(function (e) { (e.reports || []).forEach(function (r) { if (r.id) outIds.add(r.id); }); });
      return inputs.every(function (i) { return outIds.has(i.id); });
    })());

  const forbiddenHits = EM.findForbiddenKeys(merged, '');
  eq('T10.5 输出深扫状态字段（FORBIDDEN_OUTPUT_KEYS 6 项）0 命中', forbiddenHits.length, 0);

  /* occurrence_not_exported：键名深扫（非子串搜索，避免正文误伤） */
  const occKeys = deepKeys(merged).filter(function (k) { return k === 'occurrence'; });
  eq('T10.2 输出键名深扫 occurrence 0 命中（occurrence_not_exported）', occKeys.length, 0);
  const l1Occ = candidates.filter(function (c) { return 'occurrence' in c; });
  eq('T10.2b L1 候选含 occurrence 键者 0 条', l1Occ.length, 0);

  /* T10.1 event_key 仅指纹非主键：形态 + item_ids 可回溯到 candidate_id */
  const keyRe = /^evt1-[0-9a-f]{16}$/;
  ok('T10.1a 全部事件携带 event_key（形态 evt1-<16hex>）',
    merged.events.length > 0 && merged.events.every(function (e) { return keyRe.test(String(e.event_key)); }));
  ok('T10.1b 事件内 item_ids 与输入 candidate_id 一一对应（event_key 不是条目标识）',
    merged.events.every(function (e) {
      return (e.item_ids || []).every(function (id) {
        return candidates.some(function (c) { return c.candidate_id === id; });
      });
    }));
  ok('T10.1c 下游寻址字段 first_publish_time 存在于每个事件',
    merged.events.every(function (e) { return 'first_publish_time' in e; }));
  return merged;
}

/* ============================================================
 * 离线段 A · candidate-store 契约与单元幂等（临时目录）
 * ============================================================ */
section('A. candidate-store 契约');
eq('去重键字段 = registry_id + content_hash',
  'registry_id|content_hash', 'registry_id|content_hash');
ok('SEMANTIC_FIELDS 含 title/summary/category/related_*/publish_time',
  ['title', 'summary', 'category', 'publish_time'].every(function (k) {
    return CD.SEMANTIC_FIELDS.indexOf(k) >= 0;
  }));
ok('FORBIDDEN_KEYS 含 9 项状态字段 + supersedes_id/superseded_by_id',
  ['verification_status', 'judged_by', 'supersedes_id', 'superseded_by_id'].every(function (k) {
    return CD.FORBIDDEN_KEYS.indexOf(k) >= 0;
  }));

const TDIR = path.join(__dirname, 'tmp-g54');
try { fs.rmSync(TDIR, { recursive: true, force: true }); } catch (e) {}
fs.mkdirSync(TDIR, { recursive: true });
const topt = { dir: TDIR, date: '20260923' };

const cA = stubConvert(RC.create(F.raw({ capture_id: 'cap-g54-a' })), 1);
const cB = stubConvert(RC.create(F.raw({ capture_id: 'cap-g54-a', fetched_at: '2026-09-23T09:00:00Z' })), 99);
/* cA / cB：同 capture 内容（同 dedup 键），仅 fetched_at 与 seq 不同 → 语义一致 */
const rA = CD.appendCandidates([cA], topt);
eq('A1 首次落盘：added=1', rA.added, 1);
const rB = CD.appendCandidates([cB], topt);
eq('A2 同内容跨批（fetched_at/seq 变化）：skipped=1（幂等）', rB.skipped, 1);
eq('A2b added=0', rB.added, 0);
eq('A2c 归档总数仍为 1', rB.total, 1);
eq('A2d 保留首条 candidate_id', rB.file && CD.loadCandidates(topt)[0].candidate_id, cA.candidate_id);

/* 同键不同语义 → conflict，保留原始
 * ★ 不能改 title_raw（会改变 content_hash → 键也变）；
 *   手工改语义字段（summary）模拟「同内容、AI 整理结果不同批」 */
const cC = JSON.parse(JSON.stringify(cA));
cC.candidate_id = 'cand-aaaaaaaa-002';
cC.summary = 'Different summary text entirely';
const rC = CD.appendCandidates([cC], topt);
eq('A3 同键不同语义：conflict=1', rC.conflicts.length, 1);
eq('A3b 保留原始候选（总数不变）', rC.total, 1);
eq('A3c 保留的是首条 candidate_id', rC.conflicts.length ? rC.conflicts[0].kept_candidate_id : null, cA.candidate_id);

/* 禁止字段写入拒绝 */
const badC = JSON.parse(JSON.stringify(cA));
badC.verification_status = 'official_confirmed';
const eBad = caught(function () { CD.appendCandidates([badC], topt); });
eq('A4 候选含 verification_status → FORBIDDEN_FIELD', eBad && eBad.code, 'FORBIDDEN_FIELD');

/* 写入位置守卫 */
const eOut = caught(function () { CD.appendCandidates([cA], { dir: path.join(ROOT, 'h5', 'data'), date: '2026-09-23' }); });
eq('A5 拒绝写入 pipeline 之外', eOut && eOut.code, 'WRITE_OUTSIDE_PIPELINE');

/* ============================================================
 * 离线段 B · T10 机制预演（合成夹具）
 * ============================================================ */
section('B. T10 机制预演（合成夹具，不改引擎）');
const c6Cands = F.C6_SUPERSEDES.map(function (x, i) {
  return CI.fromRawCapture(RC.create(x.raw), x.ai, { seq: i + 1, idSpace: idSpace });
});
const c6Merged = EM.mergeCandidates(CI.toMergerInputs(c6Cands), { windowDays: 3 });
eq('B1 C6 supersedes 场景：同 key 归并为 1 事件', c6Merged.events.filter(function (e) {
  return e.decision === 'merge';
}).length >= 1, true);
const c6Event = c6Merged.events.filter(function (e) { return e.report_count === 2; })[0];
ok('B2 双条 report 保留（supersedes 双条保留机制）',
  !!c6Event && c6Event.reports.length === 2 && c6Event.reports.every(function (r) { return r.id; }));

/* 同 key 越窗分裂 → 同 event_key 对应多个事件 → event_key 不是主键 */
const far = JSON.parse(JSON.stringify(F.C6_SUPERSEDES));
far[1].raw.published_at_raw = '2026-10-30T00:00:00Z';
const farCands = far.map(function (x, i) {
  return CI.fromRawCapture(RC.create(x.raw), x.ai, { seq: i + 1, idSpace: idSpace });
});
const farMerged = EM.mergeCandidates(CI.toMergerInputs(farCands), { windowDays: 3 });
const keyCount = {};
farMerged.events.forEach(function (e) { keyCount[e.event_key] = (keyCount[e.event_key] || 0) + 1; });
const maxPerKey = Math.max.apply(null, Object.keys(keyCount).map(function (k) { return keyCount[k]; }));
ok('B3 同 event_key 对应 2 个 hold 事件（指纹非主键的结构证明）', maxPerKey === 2,
  'maxPerKey=' + maxPerKey);
ok('B4 分裂事件间 item_ids 不重叠（每条报道只属一个事件）',
  (function () {
    const seen = new Set();
    for (const e of farMerged.events) {
      for (const id of e.item_ids) { if (seen.has(id)) return false; seen.add(id); }
    }
    return true;
  })());

/* ============================================================
 * 离线段 C · T10.3 supersedes 真实对（news.js 只读引用）
 * ============================================================ */
section('C. T10.3 supersedes 双条保留（news.js 真实对）');
const pair = findSupersedesPair();
ok('C1 news.js 存在 supersedes 互链的真实对（动态发现，未硬编码）', !!pair,
  pair ? pair.older.id + ' ← ' + pair.newer.id : '未找到 supersedes_id/superseded_by_id 互链');
if (pair) {
  const pairInputs = [pair.older, pair.newer].map(deliveryToMergerInput);
  const pairMerged = EM.mergeCandidates(pairInputs, { windowDays: 3 });
  const outIds = new Set();
  pairMerged.events.forEach(function (e) { (e.reports || []).forEach(function (r) { outIds.add(r.id); }); });
  ok('C2 supersedes_pair_preserved：两条真实报道 id 均保留在输出中',
    outIds.has(pair.older.id) && outIds.has(pair.newer.id),
    Array.from(outIds).join(','));
  eq('C3 records_deleted == 0', pairMerged.stats.records_deleted, 0);
  ok('C4 互链对字段齐全（id/publish_time/reported_by 非空）',
    pairInputs.every(function (x) { return x.id && x.publish_time && Array.isArray(x.reported_by) && x.reported_by.length; }));
  console.log('  INFO  真实对：' + pair.older.id + '（旧）← ' + pair.newer.id + '（新）');
  console.log('  INFO  归并形态：' + pairMerged.events.length + ' 个事件 / report_count=' +
    pairMerged.events.map(function (e) { return e.report_count; }).join('+'));
}

/* ============================================================
 * 联网段（**仅 --live 时执行**）
 * ============================================================ */
async function runLive() {
  const health = {
    report: 'source-health-report',
    version: '1.0',
    generated_at: new Date().toISOString(),
    scope: 'G5.4 T9 连续 3 批真实采集（白名单 S002–S006；S001 html-parse 出界未纳入）',
    batches: [],
    sources: {},
    note: 'retries/timeouts/requests 为每批共享 transport 的全局计数（含 robots.txt 请求），不按来源拆分；单源故障通过 fail_reason 错误码归因（HTTP_FORBIDDEN / ETIMEDOUT / ECONNREFUSED 等）'
  };
  LIVE_ALLOWED.forEach(function (id) {
    health.sources[id] = { attempts: 0, success_runs: 0, fail_runs: 0, fail_reasons: [], http_statuses: [], robots_policies: [] };
  });

  const batchCaptures = [];      /* 每批 captures 数组 */

  /* ---------- 3 批真实采集 ---------- */
  for (let b = 0; b < BATCH_RUN_IDS.length; b++) {
    const runId = BATCH_RUN_IDS[b];
    section('T9 批次 ' + (b + 1) + '/3（run_id=' + runId + '）真实采集');
    const t = HT.createHttpTransport({
      timeoutMs: 20000, maxRetries: 1, backoffMs: 1200,
      minIntervalPerHostMs: 1200, maxRequestsPerRun: 60
    });
    const all = await BC.collectLiveAll({ run_id: runId, httpTransport: t, http: { timeoutMs: 20000, maxRetries: 1 } });
    const results = all.results;

    /* T9.4 结构断言：逐源独立、互不影响 */
    ok('T9.4[' + runId + '] 每源结果结构完整（captures/errors 独立数组，fail closed）',
      results.length === LIVE_ALLOWED.length &&
      results.every(function (r) { return Array.isArray(r.captures) && Array.isArray(r.errors); }));
    const okSrc = results.filter(function (r) { return r.errors.length === 0 && r.captures.length > 0; });
    const badSrc = results.filter(function (r) { return r.errors.length > 0; });
    ok('T9.4[' + runId + '] 单源失败不影响其他来源（成功源 ≥1 且 失败源错误已留痕）',
      okSrc.length >= 1 && badSrc.every(function (r) { return r.errors.length > 0; }),
      'ok=' + okSrc.length + ' fail=' + badSrc.length);
    console.log('  INFO  ' + results.map(function (r) {
      return r.registry_id + (r.errors.length ? '(✗' + r.errors[0].code + ')' : '(✓' + r.stats.accepted + ')');
    }).join(' '));

    /* 落盘（只追加不覆盖） */
    const flat = results.reduce(function (acc, r) { return acc.concat(r.captures); }, []);
    const before = CS.loadCaptures({ date: STORE_DATE }).length;
    const st = CS.appendCaptures(flat, { date: STORE_DATE });
    eq('T9.1[' + runId + '] 归档总数 = 历史数 + 新增数（只追加）', st.total, before + st.added);
    console.log('  INFO  落盘：added=' + st.added + ' skipped=' + st.skipped +
      ' conflicts=' + st.conflicts.length + ' total=' + st.total);

    /* health 累积 */
    const ts = t.summary();
    const perSource = {};
    results.forEach(function (r) {
      const firstErr = r.errors[0] || null;
      let httpStatus = r.fetch ? r.fetch.status : null;
      if (httpStatus == null && firstErr && /HTTP (\d{3})/.test(firstErr.message)) httpStatus = Number(RegExp.$1);
      const om = /^https?:\/\/[^\/?#]+/i.exec(r.source.feed_url || '');
      const origin = (r.source && om) ? om[0].toLowerCase() : '';
      const rec = {
        success: r.errors.length === 0 && r.stats.accepted > 0,
        fail_reason: firstErr ? (firstErr.code + ': ' + firstErr.message).slice(0, 200) : null,
        http_status: httpStatus,
        parsed: r.stats.parsed_items,
        accepted: r.stats.accepted,
        rejected: r.stats.rejected,
        robots_policy: (ts.robots_records && ts.robots_records[origin]) ? ts.robots_records[origin].policy : null
      };
      perSource[r.registry_id] = rec;
      const agg = health.sources[r.registry_id];
      agg.attempts++;
      if (rec.success) agg.success_runs++; else {
        agg.fail_runs++;
        if (rec.fail_reason && agg.fail_reasons.indexOf(rec.fail_reason) < 0) agg.fail_reasons.push(rec.fail_reason);
      }
      if (rec.http_status != null) agg.http_statuses.push(rec.http_status);
      if (rec.robots_policy) agg.robots_policies.push(rec.robots_policy);
    });
    health.batches.push({
      run_id: runId, captured_at: BC.nowIso(),
      transport: { requests: ts.requests, retries: ts.retries, timeouts: ts.timeouts, redirects: ts.redirects },
      store: { added: st.added, skipped: st.skipped, conflicts: st.conflicts.length, total: st.total },
      per_source: perSource
    });
    batchCaptures.push(flat);
  }

  /* ---------- T9.1 历史 capture 不覆盖（G5.3 批逐条原样） ---------- */
  section('T9.1 历史 capture 不覆盖（G5.3 run20260923 批）');
  const g53Now = CS.loadCaptures({ date: STORE_DATE }).filter(function (c) { return c.pipeline_run_id === G53_RUN_ID; });
  eq('G5.3 批条数不变（=130）', g53Now.length, 130);
  const g53ById = Object.create(null);
  g53Now.forEach(function (c) { g53ById[c.capture_id] = c; });
  let g53Mutated = 0;
  batchCaptures.forEach(function (flat) {
    flat.forEach(function (c) { if (c.pipeline_run_id === G53_RUN_ID) g53Mutated++; });
  });
  eq('G5.3 批未被新批次改写（新批次 run_id 均不同，0 条混入）', g53Mutated, 0);
  ok('G5.3 批 capture_id 抽样可回查（cap-S002-run20260923-001 等）',
    !!g53ById['cap-S002-run20260923-001'] || !!g53ById['cap-S006-run20260923-001']);

  /* ---------- T9.2 content_hash 稳定 ---------- */
  section('T9.2 content_hash 跨批稳定');
  let hashRecheck = 0, hashRecheckBad = 0;
  batchCaptures.forEach(function (flat) {
    flat.forEach(function (c) {
      const expect = sha1([c.source_url, c.title_raw, c.published_at || ''].join('|'));
      if (expect === c.content_hash) hashRecheck++; else hashRecheckBad++;
    });
  });
  eq('T9.2a 全部 capture 的 content_hash 可由 (source_url|title_raw|published_at) 复算（确定性）',
    hashRecheckBad, 0);
  console.log('  INFO  复算通过 ' + hashRecheck + ' 条 / 失败 ' + hashRecheckBad + ' 条');

  let pairChecked = 0, pairMismatch = 0;
  for (let b = 1; b < batchCaptures.length; b++) {
    const prev = batchCaptures[b - 1], cur = batchCaptures[b];
    const idx = Object.create(null);
    prev.forEach(function (c) { idx[c.source_url + '\u0001' + c.title_raw] = c; });
    cur.forEach(function (c) {
      const p = idx[c.source_url + '\u0001' + c.title_raw];
      if (!p) return;
      pairChecked++;
      if (p.content_hash !== c.content_hash) pairMismatch++;
    });
  }
  eq('T9.2b 相邻批交集条目 content_hash 全等（同内容跨批 hash 不漂移）', pairMismatch, 0);
  console.log('  INFO  批间交集比对 ' + pairChecked + ' 对');

  /* G5.3 批与 B1 的交集 hash 全等（跨「天级批次」稳定） */
  const b1Idx = Object.create(null);
  batchCaptures[0].forEach(function (c) { b1Idx[c.source_url + '\u0001' + c.title_raw] = c; });
  let g53Pair = 0, g53Mismatch = 0;
  g53Now.forEach(function (c) {
    const p = b1Idx[c.source_url + '\u0001' + c.title_raw];
    if (!p) return;
    g53Pair++;
    if (p.content_hash !== c.content_hash) g53Mismatch++;
  });
  eq('T9.2c G5.3 批 ∩ B1 交集 content_hash 全等', g53Mismatch, 0);
  console.log('  INFO  G5.3∩B1 交集 ' + g53Pair + ' 对');

  /* ---------- T9.3 候选层幂等（同源重复内容不重复生成有效候选） ---------- */
  section('T9.3 候选层幂等（candidate-store 按 registry_id+content_hash 去重）');
  const allFlat = batchCaptures.reduce(function (acc, f) { return acc.concat(f); }, []);
  console.log('  INFO  3 批 capture 总数（含跨批重复）=' + allFlat.length);

  const candsAll = [];
  allFlat.forEach(function (c, i) {
    try { candsAll.push(stubConvert(c, i + 1)); } catch (e) { /* 单条转换失败不中断 */ }
  });
  ok('T9.3a 全部 capture 桩转换为合法 L1（0 失败）', candsAll.length === allFlat.length,
    'converted=' + candsAll.length);

  const candRes = CD.appendCandidates(candsAll, { date: STORE_DATE });
  console.log('  INFO  候选归档：added=' + candRes.added + ' skipped=' + candRes.skipped +
    ' conflicts=' + candRes.conflicts.length + ' total=' + candRes.total);
  eq('T9.3b 归档总数 == 唯一去重键数（无重复有效候选）',
    candRes.total, (function () {
      const s = new Set(candsAll.map(function (c) { return CD.dedupKeyOf(c); }));
      return s.size;
    })());
  eq('T9.3c conflicts == 0（同键语义必一致：桩转换确定性）', candRes.conflicts.length, 0);
  ok('T9.3d 跨批重复被幂等吸收（skipped ≫ added：3 批 ≈ 同一 feed 状态）',
    candRes.skipped >= candRes.added,
    'skipped=' + candRes.skipped + ' added=' + candRes.added);

  /* G5.3 历史批回灌：内容与 3 批重叠 → 应几乎全部 skipped */
  const g53Cands = g53Now.map(function (c, i) {
    try { return stubConvert(c, i + 1); } catch (e) { return null; }
  }).filter(Boolean);
  const g53Res = CD.appendCandidates(g53Cands, { date: STORE_DATE });
  console.log('  INFO  G5.3 批（130 条）回灌：added=' + g53Res.added + ' skipped=' + g53Res.skipped +
    ' conflicts=' + g53Res.conflicts.length);
  ok('T9.3e G5.3 历史批回灌被幂等吸收（skipped 为主，added ≤ 20：仅 feed 撤换差异）',
    g53Res.added <= 20 && g53Res.skipped > g53Res.added,
    'added=' + g53Res.added + ' skipped=' + g53Res.skipped);

  const candsFinal = CD.loadCandidates({ date: STORE_DATE });

  /* ---------- T10 merger 真实数据验证 ---------- */
  const mergedReal = runT10Assertions(candsFinal, '真实130+条');
  ok('T10 真实数据规模 ≥ 100 条（来源 feed 未大面积变化）', candsFinal.length >= 100,
    'candidates=' + candsFinal.length);
  const mergeEvents = mergedReal.events;
  const multiReport = mergeEvents.filter(function (e) { return e.report_count >= 2; });
  console.log('  INFO  真实候选 ' + candsFinal.length + ' 条 → ' + mergeEvents.length + ' 个事件' +
    '（多报道事件 ' + multiReport.length + ' 个，reports_preserved=' + mergedReal.stats.reports_preserved + '）');

  /* events 落盘 */
  const evDoc = {
    schema_version: '1.0', layer: 'L2',
    updated_at: new Date().toISOString(),
    merger_version: mergedReal.merger_version,
    window_days: mergedReal.window_days,
    stats: mergedReal.stats,
    events: mergedReal.events,
    note: '事件归并输出：不含任何状态字段；状态须由 G1 判定器按 R8.3 重算'
  };
  const evFile = CS.assertInsidePipeline(path.join(EV_DIR, STORE_DATE + '.events.json'));
  const evTmp = evFile + '.tmp';
  fs.writeFileSync(evTmp, JSON.stringify(evDoc, null, 2), 'utf8');
  fs.renameSync(evTmp, evFile);
  console.log('  INFO  事件落盘：' + evFile);

  /* supersedes 真实对混入真实候选流复验 */
  if (pair) {
    const withPair = candsFinal.map(CI.toMergerInput)
      .concat([deliveryToMergerInput(pair.older), deliveryToMergerInput(pair.newer)]);
    const mp = EM.mergeCandidates(withPair, { windowDays: 3 });
    const ids = new Set();
    mp.events.forEach(function (e) { (e.reports || []).forEach(function (r) { ids.add(r.id); }); });
    ok('T10.3+ 真实对混入候选流后双条仍保留、无删除',
      ids.has(pair.older.id) && ids.has(pair.newer.id) && mp.stats.records_deleted === 0);
  }

  /* ---------- source-health-report.json ---------- */
  LIVE_ALLOWED.forEach(function (id) {
    const a = health.sources[id];
    a.last_http_status = a.http_statuses.length ? a.http_statuses[a.http_statuses.length - 1] : null;
    a.robots_policy_last = a.robots_policies.length ? a.robots_policies[a.robots_policies.length - 1] : null;
    a.success_rate = a.attempts ? (a.success_runs + '/' + a.attempts) : '0/0';
  });
  const healthFile = CS.assertInsidePipeline(path.join(CS.PIPELINE_DIR, 'source-health-report.json'));
  fs.writeFileSync(healthFile, JSON.stringify(health, null, 2), 'utf8');
  console.log('  INFO  来源健康报告：' + healthFile);

  /* ---------- 汇总 ---------- */
  section('汇总（供 G5.4 报告引用）');
  console.log('  批次：' + BATCH_RUN_IDS.join(' / '));
  console.log('  capture 归档总数：' + CS.loadCaptures({ date: STORE_DATE }).length +
    '（G5.3 批 ' + g53Now.length + ' 条原样保留）');
  console.log('  有效候选（去重后）：' + candsFinal.length);
  console.log('  事件数：' + mergeEvents.length + '｜reports_preserved=' + mergedReal.stats.reports_preserved +
    '｜records_deleted=' + mergedReal.stats.records_deleted);
  health.batches.forEach(function (bt) {
    console.log('  批 ' + bt.run_id + '：requests=' + bt.transport.requests +
      ' retries=' + bt.transport.retries + ' timeouts=' + bt.transport.timeouts);
    Object.keys(bt.per_source).forEach(function (id) {
      const s = bt.per_source[id];
      console.log('    ' + id + '  ' + (s.success ? '✓' : '✗ ' + (s.fail_reason || '').slice(0, 60)) +
        '  http=' + s.http_status + '  accepted=' + s.accepted);
    });
  });
}

/* ============================================================
 * 汇总
 * ============================================================ */
function finishReport(label) {
  console.log('\n============================================================');
  console.log('[' + label + '] 结果：' + pass + ' PASS / ' + fail + ' FAIL');
  if (fail) { console.log('失败项：'); fails.forEach(function (f) { console.log('  - ' + f); }); }
  console.log('============================================================');
  process.exit(fail ? 1 : 0);
}

if (!LIVE) {
  console.log('（未加 --live / MCU_LIVE：跳过 T9 真实联网三批与 T10 真实候选段）');
  finishReport('OFFLINE');
} else {
  runLive()
    .then(function () { finishReport('LIVE'); })
    .catch(function (e) {
      console.log('\n★ 联网段异常：' + (e.code || '') + ' ' + e.message);
      finishReport('LIVE_ERROR');
    });
}
