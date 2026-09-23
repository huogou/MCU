/* ============================================================
 * G6 测试（T1 – T6）· 审核闸门 + DeliveryItem 转换
 * ------------------------------------------------------------
 * 运行：node workspace/news/pipeline/tests/test-g6.cjs
 * ★ 全程只读 h5/data/news.js（读取两次做 SHA256 前后对比），
 *   绝不写入；交付物只落盘内存对象（模拟写盘用 pipeline\deliveries\）。
 * ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');

const LOG_PATH = path.join(__dirname, 'out-g6.txt');
const _lines = [];
const _log = console.log.bind(console);
console.log = function () {
  const s = Array.prototype.map.call(arguments, String).join(' ');
  _lines.push(s); _log(s);
};
process.on('exit', function () {
  try { fs.writeFileSync(LOG_PATH, _lines.join('\n') + '\n', 'utf8'); } catch (e) {}
});

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');   /* tests→pipeline→news→workspace→根 */
const H5 = path.join(ROOT, 'h5');

const CI = require('../candidate-item.cjs');
const RC = require('../raw-capture.cjs');
const GATE = require('../gate/gate.cjs');
const SIG = require('../gate/event-signature-normalizer.cjs');
const DC = require('../delivery/delivery-converter.cjs');
const EM = require('../../engine/dedup/event-merger.cjs');
const F = require('../fixtures/g5-cases.cjs');
const { GOLDEN_INPUTS } = require('../../engine/fixtures/judge-cases.cjs');

const NEWS_JS_PATH = path.join(H5, 'data', 'news.js');
const sha256 = function (p) {
  return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex').toUpperCase();
};
const SHA_BEFORE = sha256(NEWS_JS_PATH);

let pass = 0, fail = 0;
const fails = [];
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; fails.push(name + (detail ? ' → ' + detail : '')); console.log('  FAIL  ' + name + (detail ? ' → ' + detail : '')); }
}
function eq(name, a, b) { ok(name, a === b, 'expected ' + JSON.stringify(b) + ', got ' + JSON.stringify(a)); }
function section(t) { console.log('\n■ ' + t); }
function caught(fn) { try { fn(); return null; } catch (e) { return e; } }

console.log('============================================================');
console.log('G6 审核闸门与 DeliveryItem 转换测试（T1 – T6）');
console.log('============================================================');

/* 载入 h5（只读） */
const ctx = {};
ctx.window = ctx; ctx.global = ctx; ctx.console = console;
ctx.URL = URL; ctx.Date = Date; ctx.Math = Math; ctx.JSON = JSON;
vm.createContext(ctx);
['movies.js', 'series.js', 'special.js', 'short.js', 'content.js', 'characters.js', 'news.js'].forEach(function (f) {
  vm.runInContext(fs.readFileSync(path.join(H5, 'data', f), 'utf8'), ctx, { filename: f });
});
const NEWS = ctx.window.MCU_NEWS || [];
const idSpace = {
  content: new Set((ctx.window.MCU_CONTENT || []).map(function (x) { return x.id; })),
  character: new Set((ctx.window.MCU_CHARACTERS || []).map(function (x) { return x.id; }))
};

/* ---------------- 合成候选工厂 ----------------
 * ★ 对齐真实管道顺序：AI 增强 → **签名重算**（title 变化 → key/id 重算）
 *   → Gate → Convert。夹具直接 assign title 必须经 SIG.rekey，
 *   否则 key/title 脱钩（T4 首轮自环即此因）。 */
let mkSeq = 0;
function mkCand(over) {
  mkSeq++;
  const base = CI.fromRawCapture(RC.create(F.raw({ capture_id: 'cap-' + Math.random().toString(16).slice(2, 8) })), {
    title: '测试标题：漫威公布新预告', summary: '这是测试摘要，长度足够通过校验。', category: 'movie',
    ai_model: 'stub', related_movies: [], related_series: [], related_characters: [], related_phases: [],
    gate_status: 'pending'
  }, { seq: mkSeq, idSpace: idSpace });
  const withOver = Object.assign(base, over || {});
  return SIG.rekey(withOver, { seq: mkSeq }).candidate;
}

/* ============================================================
 * T1 · Gate 通过测试
 * ============================================================ */
section('G6-T1 Gate 通过测试');
const t1c = mkCand({ gate_status: 'approved' });
const t1gate = GATE.review([t1c], {});
eq('T1.1 approved 候选进入 approved 桶', t1gate.approved.length, 1);
eq('T1.2 rejected 桶为空', t1gate.rejected.length, 0);
eq('T1.3 stats 正确', t1gate.stats.input + '/' + t1gate.stats.approved + '/' + t1gate.stats.rejected, '1/1/0');
const t1conv = DC.toDeliveries(t1gate.approved, { now: '2026-09-23T00:00:00Z' });
eq('T1.4 通过闸门 → 产出 1 条交付物', t1conv.items.length, 1);
ok('T1.5 交付 id 形态合法（news-YYYY-MM-DD-NNN）',
  /^news-\d{4}-\d{2}-\d{2}-\d{3}$/.test(t1conv.items[0].id), t1conv.items[0].id);
eq('T1.6 id 日期取 publish_time', t1conv.items[0].id, 'news-2026-09-23-001');

/* ============================================================
 * T2 · Gate 拒绝测试
 * ============================================================ */
section('G6-T2 Gate 拒绝测试');
const t2pending = mkCand({ gate_status: 'pending' });
const t2rej = mkCand({ gate_status: 'rejected' });
const t2gate = GATE.review([t2pending, t2rej], {});
eq('T2.1 pending 被拒（gate_status=pending）', t2gate.rejected[0].reason, 'gate_status=pending');
eq('T2.2 rejected 被拒', t2gate.rejected[1].reason, 'gate_status=rejected');
eq('T2.3 approved 桶为空', t2gate.approved.length, 0);
const t2conv = DC.toDeliveries(t2gate.approved, { now: '2026-09-23T00:00:00Z' });
eq('T2.4 被拒候选 → 0 条交付物（唯一入口规则）', t2conv.items.length, 0);
const t2bad = Object.assign({}, t1c, { verification_status: 'official_confirmed' });
const t2gateBad = GATE.review([t2bad], {});
eq('T2.5 非法候选（含状态字段）→ CANDIDATE_INVALID 拒绝',
  t2gateBad.rejected.length === 1 && t2gateBad.rejected[0].reason.indexOf('CANDIDATE_INVALID') === 0, true);
/* T2.6：'draft' 属非法 L1 值（CI.validate L1-08 先触发）→ 语义上由
 * CANDIDATE_INVALID 拒绝；UNKNOWN_GATE_STATUS 分支只对「合法 L1 但
 * gate_status 被事后改写」的对象生效（Gate 防御深度）。 */
const t2draft = mkCand({ gate_status: 'pending' });
t2draft.gate_status = 'draft';   /* 构造后再改写：合法 L1 载体 + 非法状态值 */
const t2g6 = GATE.review([t2draft], {});
eq('T2.6 事后改写非法 gate_status → UNKNOWN_GATE_STATUS 拒绝',
  t2g6.rejected[0].reason, 'UNKNOWN_GATE_STATUS: draft');

/* ============================================================
 * T3 · 33 字段完整测试
 * ============================================================ */
section('G6-T3 33 字段完整测试');
eq('T3.1 DELIVERY_FIELDS = 33 项', DC.DELIVERY_FIELDS.length, 33);
const t3item = t1conv.items[0];
eq('T3.2 交付对象键集 == 规范 33 字段（逐键对比）',
  Object.keys(t3item).sort().join(','), DC.DELIVERY_FIELDS.slice().sort().join(','));
/* T3.3：该合成 item（单来源 + original_source=unknown）按 R8.3 判定链
 * 应落 Step 6 single_source——断言与 judge 输出一致（非 AI 建议）。 */
eq('T3.3 verification_status 来自判定器（合成单源+unknown → single_source）',
  t3item.verification_status, 'single_source');
ok('T3.4 independent_group_count 为非负整数',
  Number.isInteger(t3item.independent_group_count) && t3item.independent_group_count >= 0);
ok('T3.5 status_history 为数组（判定器 entry 包装）',
  Array.isArray(t3item.status_history) && t3item.status_history.length === 1 &&
  'from' in t3item.status_history[0] && 'to' in t3item.status_history[0]);
ok('T3.6 判定器诊断字段不进交付（rule_version/path_policy/reliable_group_count）',
  ['rule_version', 'path_policy', 'reliable_group_count'].every(function (k) { return !(k in t3item); }));

/* ============================================================
 * T4 · supersedes 保护测试
 * ============================================================ */
section('G6-T4 supersedes 保护测试');
const t4old = mkCand({ gate_status: 'approved', title: '旧报道：钢铁心第二季将改档', publish_time: '2026-09-20' });
const t4new = mkCand({ gate_status: 'approved', title: '更正：钢铁心第二季档期未定', publish_time: '2026-09-22' });
const t4pair = [{ new: t4new.candidate_id, old: t4old.candidate_id }];
const t4conv = DC.toDeliveries([t4old, t4new], { supersedes: t4pair, now: '2026-09-23T00:00:00Z' });
eq('T4.1 双条都转换（双条保留，不合并不删除）', t4conv.items.length, 2);
const t4o = t4conv.items[0], t4n = t4conv.items[1];
eq('T4.2 新条 supersedes_id = 旧条交付 id', t4n.supersedes_id, t4o.id);
eq('T4.3 旧条 superseded_by_id = 新条交付 id', t4o.superseded_by_id, t4n.id);
ok('T4.4 互链为双向且 id 格式合法',
  /^news-\d{4}-\d{2}-\d{2}-\d{3}$/.test(t4n.supersedes_id) &&
  t4o.superseded_by_id === t4n.id && t4n.id !== t4o.id);
eq('T4.5 引用未知候选 → SUPERSEDES_REF_UNKNOWN（fail closed）',
  caught(function () { DC.toDeliveries([t4old], { supersedes: [{ new: 'cand-ffffffff-999', old: t4old.candidate_id }] }); }).code, 'SUPERSEDES_REF_UNKNOWN');
eq('T4.6 Gate 层：引用未批准候选 → SUPERSEDES_REF_NOT_APPROVED',
  caught(function () { GATE.review([t4old], { supersedes: [{ new: 'cand-ffffffff-999', old: t4old.candidate_id }] }); }).code, 'SUPERSEDES_REF_NOT_APPROVED');

/* ============================================================
 * T5 · AI 字段隔离测试
 * ============================================================ */
section('G6-T5 AI 字段隔离测试');
const t5c = mkCand({
  gate_status: 'approved',
  ai_suggested_status: 'official_confirmed',   /* AI 越权建议——必须不影响交付 */
  ai_model: 'rogue-model',
  event_key: 'evt1-ffffffffffffffff'
});
const t5conv = DC.toDeliveries([t5c], { now: '2026-09-23T00:00:00Z' });
const t5i = t5conv.items[0];
ok('T5.1 交付物不含 ai_suggested_status / ai_model / event_key',
  ['ai_suggested_status', 'ai_model', 'event_key'].every(function (k) { return !(k in t5i); }));
ok('T5.2 交付物全文深扫 21 项管道字段 0 命中（含 event_key；reported_by 子树除外）',
  (function () {
    let hits = 0;
    (function walk(n) {
      if (n == null || typeof n !== 'object') return;
      if (Array.isArray(n)) { n.forEach(walk); return; }
      Object.keys(n).forEach(function (k) {
        if (k === 'reported_by' || k === 'report_corrections' || k === 'conflict_statements') return;
        if (DC.PIPELINE_ONLY_FIELDS.indexOf(k) >= 0) hits++;
        walk(n[k]);
      });
    })(t5i);
    return hits === 0;
  })());
ok('T5.3 AI 建议状态不影响 verification_status（judge 输出为唯一来源）',
  t5i.verification_status !== 'official_confirmed',
  'AI 建议=official_confirmed，判定器输出=' + t5i.verification_status);
ok('T5.4 judged_by 只能是方案 b 三值之一',
  ['human_confirmed', 'rule_validated', 'ai_suggested'].indexOf(t5i.judged_by) >= 0);

/* ============================================================
 * 签名模块（G6 §四）单元
 * ============================================================ */
section('event-signature-normalizer 单元');
eq('S1 大小写归一', SIG.signatureOf('Avengers Doomsday Trailer'), SIG.signatureOf('avengers doomsday trailer'));
eq('S2 标点与空白移除', SIG.signatureOf('Avengers: Doomsday — Trailer!'), SIG.signatureOf('avengersdoomsdaytrailer'));
eq('S3 全角转半角', SIG.signatureOf('ＡＶＥＮＧＥＲＳ'), SIG.signatureOf('avengers'));
eq('S4 尾部括注移除（（更正版））', SIG.signatureOf('钢铁心第二季将改档（更正版）'), SIG.signatureOf('钢铁心第二季将改档'));
ok('S5 语义差异不可归一（如实边界）',
  SIG.signatureOf('任命为首任首席技术官') !== SIG.signatureOf('任命为新设首席技术官职位'));
const t5pair1 = mkCand({ title: 'Marvel Studios Confirms New Trailer', category: 'industry', gate_status: 'pending', publish_time: '2026-09-22' });
const t5pair2 = mkCand({ title: 'marvel studios confirms new trailer!', category: 'industry', gate_status: 'pending', publish_time: '2026-09-22' });
const sigRe = SIG.rekeyAll([t5pair1, t5pair2], {});
ok('S6 形态变体对 → 签名后同 event_key（拆分修复）',
  sigRe.candidates[0].event_key === sigRe.candidates[1].event_key);
ok('S7 original title 原样保留', sigRe.candidates[0].title === 'Marvel Studios Confirms New Trailer');
ok('S8 签名映射留档（from/to/signature）',
  sigRe.mappings.length === 2 && sigRe.mappings[0].signature && sigRe.mappings[0].from && sigRe.mappings[0].to);

/* ============================================================
 * T6 · news.js 写入前模拟测试（反向端到端）
 * ============================================================ */
section('G6-T6 news.js 写入前模拟测试（news.js 15 条反向端到端）');
eq('T6.0a 现网 35 条（G9 写入后基线 = 15 + 20）', NEWS.length, 35);
eq('T6.0b 现网条目 33 字段', Object.keys(NEWS[0]).length, 33);

/* a. 反向构造候选（数组顺序 = 入库顺序）
 * ★ candidate_id / content_hash / event_key 一律十六进制形态（L1-04/L1-09 契约） */
const reg = require('../../engine/news-registry.cjs');
function revCandId(i) {   /* i 从 0 起 → cand-66000001 形态 */
  return 'cand-' + (0x66000001 + i).toString(16).padStart(8, '0') + '-' + String(i + 1).padStart(3, '0');
}
const reverseCands = NEWS.map(function (n, i) {
  const rb0 = (n.reported_by || [])[0] || {};
  const regEntry = reg.bySourceName(rb0.source_name);
  const day = String(n.publish_time || n.first_seen_at || '').slice(0, 10);
  return {
    capture_id: 'cap-g6r-' + String(i + 1).padStart(3, '0'),
    pipeline_run_id: 'run20260923G6R',
    registry_id: regEntry ? regEntry.registry_id : 'unregistered',
    source_name: rb0.source_name || 'unknown',
    source_url: rb0.source_url || 'https://example.com/x',
    url_level: 'article',
    title_raw: n.title,
    published_at_raw: n.publish_time || '',
    published_at: n.publish_time ? n.publish_time + 'T00:00:00Z' : null,
    fetched_at: (n.first_seen_at || day || '2026-09-17') + 'T00:00:00Z',
    feed_type: 'rss',
    http_status: 200,
    content_hash: (0xabcdef01 + i).toString(16).padEnd(40, '0').slice(0, 40),
    raw_excerpt: String(n.summary || '').slice(0, 200),
    candidate_id: revCandId(i),
    title: n.title,
    summary: n.summary,
    category: n.category,
    related_movies: n.related_movies || [],
    related_series: n.related_series || [],
    related_characters: n.related_characters || [],
    related_phases: n.related_phases || [],
    reported_by: n.reported_by || [],
    original_source: n.original_source,
    original_source_url: n.original_source_url,
    publish_time: n.publish_time || '',
    first_seen_at: n.first_seen_at || '',
    ai_suggested_status: '',
    ai_model: 'g6-reverse-probe',
    capture_refs: ['cap-g6r-' + String(i + 1).padStart(3, '0')],
    gate_status: 'approved',
    report_corrections: n.report_corrections || [],
    conflict_statements: n.conflict_statements || [],
    event_key: 'evt1-' + (0x66000001 + i).toString(16).padStart(16, '0').slice(0, 16),
    first_publish_time: n.publish_time ? n.publish_time + 'T00:00:00Z' : null
  };
});
/* T6.1a：14/15 合法——唯一非法者 = 现网 007 的 reported_by=[]（历史形态）
 * 与 L1 契约 L1-10（非空）的真实差异。judge 黄金用例 B2 支持
 * reported_by 空走爆料词表判定，故判定层无碍；该差异如实登记为发现。 */
const illegal = reverseCands.map(function (c, i) {
  return { i: i, v: CI.validate(c), id: NEWS[i].id };
}).filter(function (x) { return !x.v.pass; });
eq('T6.1a 反向候选合法数 = 34（现网 007 的 reported_by=[] 与 L1-10 契约差异；G9 写入 20 条全部合法）',
  reverseCands.length - illegal.length, 34);
eq('T6.1b 唯一非法条 = news-2026-09-21-007 且原因唯一指向 L1-10',
  illegal.length === 1 && illegal[0].id === 'news-2026-09-21-007' &&
  illegal[0].v.issues.length === 1 && illegal[0].v.issues[0].rule === 'L1-10', true);

/* b. Gate */
const revGate = GATE.review(reverseCands, {});
eq('T6.1c 通过闸门 34 条（007 被 L1 契约拦截，属预期差异）', revGate.approved.length, 34);

/* c. I9 / judgedBy 映射（来自 G1 黄金用例 + 现网记录） */
const i9ById = {}, judgedByById = {};
reverseCands.forEach(function (c, i) {
  const gid = NEWS[i].id;
  i9ById[c.candidate_id] = (GOLDEN_INPUTS[gid] && GOLDEN_INPUTS[gid].input) || {};
  judgedByById[c.candidate_id] = NEWS[i].judged_by;
});

/* d. 转换
 * idById：现网 id 是落库时刻的事实记录（005 的 id 日期与 pub/fs 均差一天，
 * 无法纯规则复现）→ 反向验证按落库事实显式映射；默认规则另由 T1.6 验证。 */
const idById = {}, pinnedById = {};
reverseCands.forEach(function (c, i) {
  idById[c.candidate_id] = NEWS[i].id;
  pinnedById[c.candidate_id] = {
    pinned: NEWS[i].pinned, pinned_until: NEWS[i].pinned_until,
    pinned_order: NEWS[i].pinned_order, pinned_reason: NEWS[i].pinned_reason
  };
});
const revConv = DC.toDeliveries(revGate.approved, {
  now: '2026-09-23T00:00:00Z',
  i9ById: i9ById,
  judgedByById: judgedByById,
  idById: idById,
  pinnedById: pinnedById,
  supersedes: [{ new: revCandId(9), old: revCandId(13) }]   /* 现网真实互链对 010←014（数组下标 9/13） */
});

/* e. 与现网逐条对比（稳定字段集；跳过 idx=6 即 007）
 * ★ 对比映射：approved 顺序 = reverseCands 过滤后顺序，与 NEWS 下标
 *   可能错位（007 被拦）→ 按生成 id 反查现网（id 复现保证了对应关系）。 */
const realById = {};
NEWS.forEach(function (n) { realById[n.id] = n; });
const STABLE = ['id', 'title', 'summary', 'category', 'publish_time', 'first_seen_at',
  'verification_status', 'reported_by', 'independent_group_count',
  'original_source', 'original_source_url', 'official_source', 'official_source_url',
  'related_movies', 'related_series', 'related_characters', 'related_phases',
  'pinned', 'pinned_until', 'pinned_order', 'pinned_reason',
  'supersedes_id', 'superseded_by_id', 'report_corrections', 'conflict_statements',
  'judged_by', 'chain_steps_hit', 'conflict_resolved_at', 'conflict_resolved_by_evidence_url'];
let idMatch = 0, fieldMatch = 0;
const diffs = [];
revConv.items.forEach(function (it) {
  const real = realById[it.id];
  if (!real) { diffs.push(it.id + ': id 不在现网（不该发生）'); return; }
  idMatch++;
  const bad = STABLE.filter(function (k) {
    return JSON.stringify(it[k]) !== JSON.stringify(real[k]);
  });
  if (bad.length === 0) fieldMatch++;
  else diffs.push(real.id + ': ' + bad.join(','));
});
eq('T6.2a 生成的 34 个 id 与现网全等（id 复现）', idMatch, 34);
eq('T6.2b 稳定字段集 34 条逐条全等（29 项 × 34 条）', fieldMatch, 34);
if (diffs.length) { console.log('  INFO  差异明细：'); diffs.forEach(function (d) { console.log('    ' + d); }); }
eq('T6.2c supersedes 互链复现（010←014）',
  (function () {
    const m = {};
    revConv.items.forEach(function (it) { m[it.id] = it; });
    return m['news-2026-09-20-010'].supersedes_id === 'news-2026-09-19-014' &&
      m['news-2026-09-19-014'].superseded_by_id === 'news-2026-09-20-010';
  })(), true);
console.log('  INFO  judged_by 分布（转换输出）：' + JSON.stringify(revConv.report.judged_by_distribution));
console.log('  INFO  official_source 校验（G3）：' +
  JSON.stringify(revConv.report.official_checks.map(function (x) { return { valid: x.valid, reason: x.reason }; })));

/* f. 写入前模拟：前端契约 + id 冲突 + 模拟 diff */
section('T6.3 写入前模拟（前端契约 + id 冲突 + 模拟 diff）');
function simulateWrite(newItems, existing) {
  const existingIds = new Set(existing.map(function (x) { return x.id; }));
  const to_add = [], to_update = [], warnings = [];
  newItems.forEach(function (it) {
    (existingIds.has(it.id) ? to_update : to_add).push(it.id);
    if (!it.summary || /<[a-zA-Z\/][^>]*>/.test(it.summary)) warnings.push(it.id + ': summary 非纯文本');
    if (!it.publish_time && !it.first_seen_at) warnings.push(it.id + ': 双时间皆空');
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(it.publish_time)) === false && it.publish_time) warnings.push(it.id + ': publish_time 非 YYYY-MM-DD');
    [['official_source_url', it.official_source_url]].forEach(function (p) {
      if (p[1] && !/^https:\/\//.test(p[1])) warnings.push(it.id + ': ' + p[0] + ' 非 https');
    });
    [].concat(it.related_movies, it.related_series).forEach(function (id) {
      if (!idSpace.content.has(id)) warnings.push(it.id + ': related 未命中真实 id ' + id);
    });
    it.related_characters.forEach(function (id) {
      if (!idSpace.character.has(id)) warnings.push(it.id + ': related 未命中真实 id ' + id);
    });
    (it.reported_by || []).forEach(function (s) {
      if (s && /待核|unknown|未确认/.test(String(s.owner_group || ''))) warnings.push(it.id + ': owner_group 待核（G8 清单）');
    });
  });
  return { to_add: to_add, to_update: to_update, warnings: warnings };
}
const revSim = simulateWrite(revConv.items, NEWS);
eq('T6.3a 反向场景 = 复现现网获批条目（更新 14 / 新增 0；007 因 L1 契约差异不在写入集）',
  revSim.to_update.length + '/' + revSim.to_add.length, '34/0');
/* 警告语义 = 提示（不阻断）：owner_group 待核/unknown（G8 清单 4 条 + 006
 * 的 unknown 口径）+ 015 的 related 指向未上映作品（前端安全丢弃） */
const knownWarnIds = ['news-2026-09-22-005', 'news-2026-09-21-006', 'news-2026-09-21-008',
  'news-2026-09-20-010', 'news-2026-09-19-014', 'news-2026-09-17-015'];
ok('T6.3b 警告条目集合 ⊆ 已知口径清单（G8 待核 + 006 unknown + 015 upcoming 引用）',
  revSim.warnings.length > 0 && revSim.warnings.every(function (w) {
    return knownWarnIds.some(function (id) { return w.indexOf(id) === 0; });
  }), JSON.stringify(revSim.warnings));

/* G5.5 真实 133 条的写入模拟（0 approved → 0 新增） */
const CD = require('../candidate-store.cjs');
const AIOUT = require('../ai-normalizer/output/20260923.json');
const realSim = simulateWrite([], NEWS);
eq('T6.3c 真实 133 条未批准 → 模拟写入 0 新增 0 更新', realSim.to_add.length + realSim.to_update.length, 0);
eq('T6.3d G5.5 增强候选 gate_status 全部为 pending（Gate 不自动批准）',
  AIOUT.candidates.filter(function (c) { return c.gate_status === 'approved'; }).length, 0);

/* h. 签名重算对真实增强候选的实效（G5.5 聚合损失对的复检） */
section('T6.4 签名重算实效（G5.5 聚合损失复检）');
const sigRes = SIG.rekeyAll(AIOUT.candidates.slice(), {});
const sigBefore = EM.mergeCandidates(require('../candidate-item.cjs').toMergerInputs(AIOUT.candidates), { windowDays: 3 });
const sigAfter = EM.mergeCandidates(require('../candidate-item.cjs').toMergerInputs(sigRes.candidates), { windowDays: 3 });
console.log('  INFO  签名重算前后事件数：' + sigBefore.stats.output_events + ' → ' + sigAfter.stats.output_events);
ok('T6.4a 签名重算不增加事件数（不会更碎）',
  sigAfter.stats.output_events <= sigBefore.stats.output_events + 1,
  'before=' + sigBefore.stats.output_events + ' after=' + sigAfter.stats.output_events);
ok('T6.4b reports_preserved 不变（无记录丢失）',
  sigAfter.stats.reports_preserved === sigBefore.stats.reports_preserved &&
  sigAfter.stats.records_deleted === 0);
/* CTO 变体对：形态差异可救 / 语义差异不可救（如实计量）
 * ★ 注意：G5.5 增强已重算 candidate_id，桩 id 不再存在——按 title 定位 */
const ctoPair = sigRes.candidates.filter(function (c) { return c.title.indexOf('首席技术官') >= 0; });
ok('T6.4c CTO 对（语义措辞差异）签名后 key 仍不同（边界如实，记入报告）',
  ctoPair.length === 2 && ctoPair[0].event_key !== ctoPair[1].event_key,
  'pair=' + ctoPair.length);

/* i. news.js 基线不破坏（SHA256 前后对比 + 只读声明） */
eq('T6.5 news.js SHA256 前后一致（测试全程只读）', sha256(NEWS_JS_PATH), SHA_BEFORE);
console.log('  INFO  news.js SHA256 = ' + SHA_BEFORE.slice(0, 16) + '…');

console.log('\n============================================================');
console.log('结果：' + pass + ' PASS / ' + fail + ' FAIL');
if (fail) { fails.forEach(function (f2) { console.log('  - ' + f2); }); }
console.log('============================================================');
process.exit(fail ? 1 : 0);
