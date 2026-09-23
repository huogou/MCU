/* ============================================================
 * G5 · 管道三层接口测试（L0 RawCapture / L1 CandidateItem / L2 串联）
 * ------------------------------------------------------------
 * 运行：node workspace/news/pipeline/tests/test-pipeline.cjs
 *
 * ★ 2026-09-23 修订：L0 由 16 → **14 字段**（event_key / first_publish_time 上移 L1）；
 *   L1 = 14 + 21 = **35**；merger 输入改为 **白名单投影**。
 * ★ 零网络、零抓取、不写 h5/。全部输入为合成夹具。
 * ============================================================ */
'use strict';

const vm = require('vm');
const fs = require('fs');
const path = require('path');

const LOG_PATH = path.join(__dirname, 'out-pipeline.txt');
const _lines = [];
const _log = console.log.bind(console);
console.log = function () {
  const s = Array.prototype.map.call(arguments, String).join(' ');
  _lines.push(s); _log(s);
};
process.on('exit', function () {
  try { fs.writeFileSync(LOG_PATH, _lines.join('\n') + '\n', 'utf8'); } catch (e) {}
});

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const H5 = path.join(ROOT, 'h5');

const RC = require('../raw-capture.cjs');
const CI = require('../candidate-item.cjs');
const EM = require('../../engine/dedup/event-merger.cjs');
const registry = require('../../engine/news-registry.cjs');
const F = require('../fixtures/g5-cases.cjs');

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
function deepFind(node, keys, p) {
  const hits = [];
  (function walk(n, pre) {
    if (n == null || typeof n !== 'object') return;
    if (Array.isArray(n)) { n.forEach(function (x, i) { walk(x, pre + '[' + i + ']'); }); return; }
    Object.keys(n).forEach(function (k) {
      if (keys.indexOf(k) >= 0) hits.push(pre + '.' + k);
      walk(n[k], pre + '.' + k);
    });
  })(node, p || '');
  return hits;
}

console.log('============================================================');
console.log('G5 · 资讯管道三层接口测试');
console.log('============================================================');
console.log('L0 字段数：' + RC.FIELDS.length + '｜L1 字段数：' + CI.FIELDS.length);
console.log('登记表：' + registry.REGISTRY_VERSION + '｜条目 ' + registry.all().length);

/* ============================================================
 * 1. 目录与冻结约束
 * ============================================================ */
section('1. pipeline 目录与冻结约束');
['captures', 'candidates', 'events', 'fixtures', 'tests'].forEach(function (d) {
  const p = path.join(__dirname, '..', d);
  ok('目录存在：pipeline\\' + d + '\\', fs.existsSync(p) && fs.statSync(p).isDirectory());
});
ok('测试脚本位于 pipeline\\tests\\ 内', __dirname.indexOf(path.join('pipeline', 'tests')) > 0);

const srcOf = function (f) { return fs.readFileSync(path.join(__dirname, '..', f), 'utf8'); };
const codeOnly = function (s) { return s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1'); };
const rcCode = codeOnly(srcOf('raw-capture.cjs'));
const ciCode = codeOnly(srcOf('candidate-item.cjs'));
const netRe = /\brequire\(\s*['"](http|https|net|dns|node-fetch|axios)['"]\s*\)|\bfetch\s*\(|XMLHttpRequest/;
ok('L0 零网络能力', !netRe.test(rcCode));
ok('L1 零网络能力', !netRe.test(ciCode));
ok('L0 不写文件', !/writeFile|appendFile|mkdir|unlink/.test(rcCode));
ok('L1 不写文件', !/writeFile|appendFile|mkdir|unlink/.test(ciCode));
ok('L0 / L1 不引用 h5 路径', srcOf('raw-capture.cjs').indexOf('h5') < 0 && srcOf('candidate-item.cjs').indexOf('h5') < 0);

/* ============================================================
 * 2. L0 RawCapture（14 字段）
 * ============================================================ */
section('2. L0 RawCapture（14 字段）');
eq('L0 字段数 = 14', RC.FIELDS.length, 14);
eq('L0 字段顺序与规范一致', RC.FIELDS.join(','),
  'capture_id,pipeline_run_id,registry_id,source_name,source_url,url_level,title_raw,' +
  'published_at_raw,published_at,fetched_at,feed_type,http_status,content_hash,raw_excerpt');
ok('★ L0 不含 event_key（已上移 L1）', RC.FIELDS.indexOf('event_key') < 0);
ok('★ L0 不含 first_publish_time（已上移 L1）', RC.FIELDS.indexOf('first_publish_time') < 0);

const c1raw = RC.create(F.C1_OFFICIAL.raw);
eq('C1 输出字段集合恰为 14', Object.keys(c1raw).length, 14);
eq('C1 url_level = article', c1raw.url_level, 'article');
eq('C1 published_at 规范化为 ISO', c1raw.published_at, '2026-09-23T01:10:00Z');
ok('C1 content_hash 为 40 位十六进制', /^[0-9a-f]{40}$/.test(c1raw.content_hash));
eq('L0 validate 通过', RC.validate(c1raw).pass, true);
ok('★ L0 输出不含 event_key', !('event_key' in c1raw));

section('2b. url_level 判定');
eq('/news → section', RC.classifyUrlLevel('https://www.marvel.com/news'), 'section');
eq('/news/slug → article', RC.classifyUrlLevel('https://www.marvel.com/news/slug'), 'article');
eq('/feed/ → feed', RC.classifyUrlLevel('https://variety.com/feed/'), 'feed');
eq('/rss → feed', RC.classifyUrlLevel('https://thedirect.com/rss'), 'feed');
eq('/category/marvel/feed/ → feed', RC.classifyUrlLevel('https://comicbook.com/category/marvel/feed/'), 'feed');
eq('RFC822 可解析', RC.normalizeIso('Mon, 22 Sep 2026 23:40:00 +0000'), '2026-09-22T23:40:00Z');
eq('无法解析 → null', RC.normalizeIso('not-a-date'), null);

section('2c. C4 非法 URL + registry 一致性');
F.C4_BAD_URL.cases.forEach(function (c) {
  const e = caught(function () { RC.create(F.raw(c.over)); });
  eq('【' + c.id + '】' + c.desc + ' → ' + c.code, e && e.code, c.code);
});
eq('registry_id 未登记 → UNKNOWN_REGISTRY_ID',
  (caught(function () { RC.create(F.raw({ registry_id: 'S999' })); }) || {}).code, 'UNKNOWN_REGISTRY_ID');
eq('source_name 不符 → SOURCE_NAME_MISMATCH',
  (caught(function () { RC.create(F.raw({ registry_id: 'S001', source_name: 'Variety' })); }) || {}).code, 'SOURCE_NAME_MISMATCH');
const c3raw = RC.create(F.C3_UNREGISTERED.raw);
eq('C3 保留值 unregistered 可用', c3raw.registry_id, 'unregistered');

/* ============================================================
 * 3. L1 CandidateItem（35 字段）
 * ============================================================ */
section('3. L1 CandidateItem（35 字段 = 14 + 21）');
eq('L1 字段数 = 35', CI.FIELDS.length, 35);
eq('L1 新增字段数 = 21', CI.L1_ADDED.length, 21);
ok('L1 包含 event_key（由 L0 上移）', CI.L1_ADDED.indexOf('event_key') >= 0);
ok('L1 包含 first_publish_time（由 L0 上移）', CI.L1_ADDED.indexOf('first_publish_time') >= 0);

const c1 = CI.fromRawCapture(c1raw, F.C1_OFFICIAL.ai, { seq: 1 });
eq('C1 L0→L1 输出字段集合恰为 35', Object.keys(c1).length, 35);
eq('C1 candidate_id 形态合法', /^cand-[0-9a-f]{8}-\d{3}$/.test(c1.candidate_id), true);
ok('C1 candidate_id 非交付物 id 格式', !CI.DELIVERY_ID_RE.test(c1.candidate_id));
ok('★ event_key 只在 L1 产出且形态合法', /^evt1-[0-9a-f]{16}$/.test(c1.event_key), c1.event_key);
eq('★ L1 first_publish_time = L0 published_at', c1.first_publish_time, c1raw.published_at);
eq('C1 publish_time 取日期部分', c1.publish_time, '2026-09-23');
eq('C1 first_seen_at = fetched_at', c1.first_seen_at, c1raw.fetched_at);
eq('C1 gate_status 默认 pending', c1.gate_status, 'pending');
eq('C1 capture_refs 指向 L0', c1.capture_refs.join(','), c1raw.capture_id);
eq('C1 L1 validate 通过', CI.validate(c1).pass, true);
eq('★ C1 owner_group 取自登记表', c1.reported_by[0].owner_group, 'Disney / Marvel');

const c2 = CI.fromRawCapture(RC.create(F.C2_MEDIA.raw), F.C2_MEDIA.ai, { seq: 1 });
eq('C2 owner_group = Penske Media Corporation', c2.reported_by[0].owner_group, 'Penske Media Corporation');
const c3 = CI.fromRawCapture(c3raw, F.C3_UNREGISTERED.ai, { seq: 1 });
eq('C3 未登记来源 owner_group = unknown', c3.reported_by[0].owner_group, 'unknown');
eq('登记表 S002 = 独立', registry.byId('S002').owner_group, '独立');
eq('登记表 S003 = Savage', registry.byId('S003').owner_group, 'Savage');

section('3b. C7 缺失发布时间');
const c7raw = RC.create(F.C7_NO_TIME.raw);
eq('C7 published_at = null', c7raw.published_at, null);
const c7 = CI.fromRawCapture(c7raw, F.C7_NO_TIME.ai, { seq: 1 });
eq('C7 publish_time = 空串', c7.publish_time, '');
ok('C7 first_seen_at 仍有值', !!c7.first_seen_at);
eq('C7 validate 通过（不拒绝）', CI.validate(c7).pass, true);

section('3c. C5 重复事件 / C6 supersedes');
const c5 = F.C5_DUP.map(function (x, i) { return CI.fromRawCapture(RC.create(x.raw), x.ai, { seq: i + 1 }); });
eq('C5 两条同一 event_key', c5[0].event_key === c5[1].event_key ? 'same' : 'diff', 'same');
ok('C5 owner_group 分别为 独立 / Savage',
  c5[0].reported_by[0].owner_group === '独立' && c5[1].reported_by[0].owner_group === 'Savage');
const c6 = F.C6_SUPERSEDES.map(function (x, i) { return CI.fromRawCapture(RC.create(x.raw), x.ai, { seq: i + 1 }); });
eq('C6 两条同一 event_key', c6[0].event_key === c6[1].event_key ? 'same' : 'diff', 'same');
eq('C6 更正记录已承载（P-补1）', c6[1].report_corrections.length, 1);

/* ============================================================
 * 4. C8 异常字段
 * ============================================================ */
section('4. C8 异常字段（15 变体）');
F.C8_ANOMALY.cases.forEach(function (c) {
  let e;
  if (c.layer === 'L0') e = caught(function () { RC.create(F.raw(c.over)); });
  else e = caught(function () { CI.fromRawCapture(RC.create(F.raw()), F.ai(c.aiOver), { seq: 1 }); });
  eq('【' + c.id + '】' + c.desc + ' → ' + c.code, e && e.code, c.code);
});

section('4b. 关联交集校验');
const ctx = {};
ctx.window = ctx; ctx.global = ctx; ctx.console = console;
ctx.URL = URL; ctx.Date = Date; ctx.Math = Math; ctx.JSON = JSON;
vm.createContext(ctx);
['movies.js', 'series.js', 'special.js', 'short.js', 'content.js', 'characters.js'].forEach(function (f) {
  vm.runInContext(fs.readFileSync(path.join(H5, 'data', f), 'utf8'), ctx, { filename: f });
});
const contentIds = new Set((ctx.window.MCU_CONTENT || []).map(function (x) { return x.id; }));
const charIds = new Set((ctx.window.MCU_CHARACTERS || []).map(function (x) { return x.id; }));
ok('已载入 idSpace（只读）', contentIds.size > 0 && charIds.size > 0, contentIds.size + ' / ' + charIds.size);
const ic = F.C8_ANOMALY.intersectCase;
const c8i = CI.fromRawCapture(RC.create(F.raw()), F.ai(ic.aiOver),
  { seq: 1, idSpace: { content: contentIds, character: charIds } });
eq('未命中 related_movies 被丢弃（含 avengers-5）', c8i.related_movies.join(','), ic.expectKept.movies.join(','));
eq('related_series 保留命中项', c8i.related_series.join(','), ic.expectKept.series.join(','));
eq('related_characters 保留命中项', c8i.related_characters.join(','), ic.expectKept.characters.join(','));
eq('related_phases 只保留 1–6 整数', c8i.related_phases.join(','), ic.expectKept.phases.join(','));
eq('C8i validate 通过（丢弃不报错）', CI.validate(c8i).pass, true);

/* ============================================================
 * 5. 交付物隔离
 * ============================================================ */
section('5. 交付物隔离（L0 / L1 ≠ DeliveryItem）');
ok('L0 无状态字段（深扫 9 项）', deepFind(c1raw, RC.LAYER_FORBIDDEN_KEYS).join(',') === '');
ok('L1 无状态字段（深扫 9 项）', deepFind(c1, RC.LAYER_FORBIDDEN_KEYS).join(',') === '');
ok('L1 无交付物独有字段（深扫）', deepFind(c1, CI.LAYER_FORBIDDEN_KEYS).join(',') === '');
let leaked = '';
['status_history', 'pinned', 'independent_group_count', 'official_source',
  'supersedes_id', 'conflict_resolved_at'].forEach(function (k) { if (k in c1) leaked = k; });
eq('L1 不含交付物独有字段（点名）', leaked, '');
ok('L1 无 verification_status（含深扫）', JSON.stringify(c1).indexOf('verification_status') < 0);
ok('L1 无 occurrence（任务书第 5 节）', JSON.stringify(c1).indexOf('occurrence') < 0);

/* ============================================================
 * 6. 三层串联 + merger 白名单
 * ============================================================ */
section('6. 三层串联（L0 → L1 → L2）');
const all = [c1].concat(c5).concat(c6);
const res = EM.mergeCandidates(CI.toMergerInputs(all));

eq('适配器输出恰为 10 个键（9 白名单 + id）', Object.keys(CI.toMergerInput(c1)).length, 10);
eq('适配器 id = candidate_id', CI.toMergerInput(c1).id, c1.candidate_id);
let inWhitelist = '';
Object.keys(CI.toMergerInput(c1)).forEach(function (k) {
  if (k !== 'id' && CI.MERGER_INPUT_WHITELIST.indexOf(k) < 0) inWhitelist = k;
});
eq('适配器输出未越出白名单', inWhitelist, '');
let forbiddenLeak = '';
CI.MERGER_INPUT_FORBIDDEN.forEach(function (k) { if (k in CI.toMergerInput(c1)) forbiddenLeak = k; });
eq('适配器输出不含 6 项禁止字段', forbiddenLeak, '');

eq('串联：输入 ' + all.length + ' 条 → 报道记录零丢失', res.stats.reports_preserved, all.length);
eq('串联：records_deleted = 0', res.stats.records_deleted, 0);
eq('串联：输出无状态字段（深扫 6 项）', EM.findForbiddenKeys(res).join(','), '');
ok('串联：输出无 occurrence', JSON.stringify(res).indexOf('occurrence') < 0);

function eventOf(k) { return res.events.filter(function (e) { return e.event_key === k; })[0]; }
const ev5 = eventOf(c5[0].event_key);
ok('C5 两条不同来源归并为 1 个事件（2 报道）', !!ev5 && ev5.report_count === 2);
const ev6 = eventOf(c6[0].event_key);
ok('★ C6 supersedes 归并为 1 个事件但两条报道都保留（A3/A4）',
  !!ev6 && ev6.report_count === 2 && ev6.item_ids.length === 2);

/* ★ 反证：不桥接 id 会怎样 */
const naiveId = EM.mergeCandidates(all);
eq('【反证】未桥接 id → merger 报道记录数 = 0', naiveId.stats.reports_preserved, 0);

/* ============================================================
 * 7. 确定性
 * ============================================================ */
section('7. 确定性与幂等');
eq('L0 create 幂等', JSON.stringify(RC.create(F.C1_OFFICIAL.raw)), JSON.stringify(RC.create(F.C1_OFFICIAL.raw)));
eq('L1 fromRawCapture 幂等',
  JSON.stringify(CI.fromRawCapture(RC.create(F.C1_OFFICIAL.raw), F.C1_OFFICIAL.ai, { seq: 1 })),
  JSON.stringify(CI.fromRawCapture(RC.create(F.C1_OFFICIAL.raw), F.C1_OFFICIAL.ai, { seq: 1 })));
eq('toMergerInput 幂等', JSON.stringify(CI.toMergerInput(c1)), JSON.stringify(CI.toMergerInput(c1)));

console.log('\n============================================================');
console.log('结果：' + pass + ' PASS / ' + fail + ' FAIL');
if (fail) { console.log('失败项：'); fails.forEach(function (f) { console.log('  - ' + f); }); }
console.log('============================================================');
process.exit(fail ? 1 : 0);
