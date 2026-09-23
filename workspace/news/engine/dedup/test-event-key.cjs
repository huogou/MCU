/* ============================================================
 * G4 · 事件指纹 / 合并引擎 V1.0 测试
 * ------------------------------------------------------------
 * 运行：node workspace/news/engine/dedup/test-event-key.cjs
 *
 * 覆盖：E1–E6（任务要求）+ E7–E14（补充）
 *       + 三条禁用行为的机器校验 + 真实 15 条 news.js 集成跑
 *
 * ★ 只读、零网络、不修改 h5 / wechat / douyin、不修改 33 字段结构、不修改 8 态体系。
 * ============================================================ */
'use strict';

const vm = require('vm');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

const LOG_PATH = path.join(__dirname, 'out-event-key.txt');
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

const EK = require('./event-key.cjs');
const EM = require('./event-merger.cjs');
const F = require('./fixtures/event-cases.cjs');

const NEWS_JS_SHA256_EXPECTED = '589A39347EF6BEEA682D0102CE8C078EBA3900EB1C7BE9698DC545B1270242F2';

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

const KEY_RE = /^evt1-[0-9a-f]{16}$/;
const K = function (item) { return EK.buildEventKey(item); };

console.log('============================================================');
console.log('G4 · 事件指纹 / 合并引擎 V1.0 —— 测试');
console.log('============================================================');
console.log('指纹版本：' + EK.KEY_VERSION + '｜合并窗口：' + EM.WINDOW_DAYS_DEFAULT + ' 天');

/* ============================================================
 * 1. key 形态与确定性（E7）
 * ============================================================ */
section('1. key 形态与确定性（E7）');

const sample = F.mk({ id: 'S', title: '复仇者联盟5毁灭之日预告', related_movies: ['avengers-5'] });
ok('key 形如 evt1-<16位十六进制>', KEY_RE.test(K(sample)), K(sample));
eq('【E7】同输入两次调用返回同一 key（确定性）', K(sample), K(sample));
eq('【E7】深拷贝同内容对象 → 同一 key', K(JSON.parse(JSON.stringify(sample))), K(sample));
let threw = null;
try { K({}); } catch (e) { threw = e.message; }
eq('空对象输入不抛错', threw, null);

/* ============================================================
 * 2. E1 同事件不同标题 → 同 key
 * ============================================================ */
section('2. E1 同事件不同标题 → 同 key');

F.E1.sub.forEach(function (s) {
  const ka = K(s.a), kb = K(s.b);
  eq('【' + s.id + '】同 key　（' + s.desc + '）', ka, kb);
  ok('【' + s.id + '】两标题确实不同（非同标题退化用例）', s.a.title !== s.b.title);
});

/* ============================================================
 * 3. E2 同标题不同事件
 * ============================================================ */
section('3. E2 同标题不同事件');

F.E2.sub.forEach(function (s) {
  const ka = K(s.a), kb = K(s.b);
  if (s.expectSameKey === false) {
    ok('【' + s.id + '】不同 key　（' + s.desc + '）', ka !== kb, ka + ' == ' + kb);
  } else {
    eq('【' + s.id + '】同 key　（' + s.desc + '）', ka, kb);
    const pair = EM.decidePair(s.a, s.b);
    eq('【' + s.id + '】merger 决策 = ' + s.expectMergerDecision, pair.decision, s.expectMergerDecision);
    eq('【' + s.id + '】hold 原因 = ' + s.expectHoldReason, pair.reason.indexOf(s.expectHoldReason) >= 0, true);
    ok('【' + s.id + '】同 key 但超窗口 → 不自动合并（不误合不同事件）', pair.decision === 'hold' && pair.within_window === false);
  }
});

/* ============================================================
 * 4. E3 不同作品 → 不同 key
 * ============================================================ */
section('4. E3 不同作品 / 不同 category → 不同 key');

F.E3.sub.forEach(function (s) {
  ok('【' + s.id + '】不同 key　（' + s.desc + '）', K(s.a) !== K(s.b));
});

/* ============================================================
 * 5. E4 日期不同 → 可识别同事件
 * ============================================================ */
section('5. E4 日期不同 → 可识别同事件');

F.E4.sub.forEach(function (s) {
  if (s.a && s.b) {
    eq('【' + s.id + '】同 key（日期不参与 key）　（' + s.desc + '）', K(s.a), K(s.b));
    const pair = EM.decidePair(s.a, s.b);
    eq('【' + s.id + '】merger 决策 = ' + s.expectMergerDecision, pair.decision, s.expectMergerDecision);
    ok('【' + s.id + '】within_window = true', pair.within_window === true);
  } else if (s.base) {
    const alt = Object.assign({}, s.base, { publish_time: s.altTime });
    eq('【' + s.id + '】仅改 publish_time（' + s.base.publish_time + ' → ' + s.altTime + '）→ key 完全不变',
      K(s.base), K(alt));
  }
});

/* ============================================================
 * 6. E5 空关联 → 不崩溃
 * ============================================================ */
section('6. E5 空关联 / 异常输入 → 不崩溃');

F.E5.cases.forEach(function (c) {
  let k = null, err = null;
  try { k = K(c.item); } catch (e) { err = e.message; }
  eq('【' + c.id + '】不抛错　（' + c.desc + '）', err, null);
  ok('【' + c.id + '】返回合法 key', KEY_RE.test(String(k)), String(k));
});

/* ============================================================
 * 7. E6 边界标题
 * ============================================================ */
section('7. E6 边界标题');

F.E6.cases.forEach(function (c) {
  let k = null, err = null;
  try { k = K(F.mk({ id: c.id, title: c.title })); } catch (e) { err = e.message; }
  eq('【' + c.id + '】不抛错　（' + c.desc + '）', err, null);
  ok('【' + c.id + '】返回合法 key', KEY_RE.test(String(k)), String(k));
});

/* ============================================================
 * 8. E8「不是 title hash」的证明
 * ============================================================ */
section('8. E8 证明不是直接 title hash');

const e8 = F.EXTRA.items.filter(function (x) { return x.id === 'E8'; })[0];
const e8a = K(e8.a), e8b = K(e8.b);
eq('【E8】不同 title、相同实体与动作 → 同 key', e8a, e8b);
ok('【E8】两个 title 本身确实不同', e8.a.title !== e8.b.title);
const sha = function (s) { return crypto.createHash('sha1').update(String(s), 'utf8').digest('hex'); };
ok('【E8】且 key 不等于任何 title 的 hash（含前缀截断形式）',
  e8a !== sha(e8.a.title) && e8a !== sha(e8.b.title) &&
  e8a.indexOf(sha(e8.a.title)) < 0 && e8a !== 'evt1-' + sha(e8.a.title).slice(0, 16));
/* 反向：title 不同而 key 相同 → 若实现是 title hash，本条必失败 */
ok('【E8】反证成立：title 哈希不同但 key 相同 → 实现不是 title hash',
  sha(e8.a.title) !== sha(e8.b.title) && e8a === e8b);

const ex = EK.explain(e8.a);
ok('【E8】explain() 暴露三个成分（可审计）',
  Array.isArray(ex.entity_sig) && Array.isArray(ex.action_sig) &&
  typeof ex.text_sig === 'string' && typeof ex.normalized_title === 'string');
eq('【E8】explain() 明确 time_participates = false', ex.time_participates, false);
eq('【E8】entity 模式下不使用 text_sig', ex.text_sig, '(未使用)');
eq('【E8】mode = entity', ex.mode, 'entity');

/* ============================================================
 * 9. E12 / E13 / E14
 * ============================================================ */
section('9. E12 / E13 / E14 补充用例');

const byId = {};
F.EXTRA.items.forEach(function (x) { byId[x.id] = x; });

/* E12 缺时间 → hold(missing_time) */
const res12 = EM.mergeCandidates([byId.E12.a, byId.E12.b]);
const held12 = res12.events.filter(function (e) { return e.decision === 'hold'; });
ok('【E12】缺时间条目被判 hold', held12.length === 1, JSON.stringify(res12.events.map(function (e) { return e.decision; })));
eq('【E12】hold 原因 = missing_time', held12[0] && held12[0].hold_reason, 'missing_time');

/* E13 动作词参与 */
ok('【E13】同作品不同动作（定档 / 改档）→ 不同 key', K(byId.E13.a) !== K(byId.E13.b));

/* E14 状态词不影响 key */
eq('【E14】官方确认版 与 传闻版 → 同 key（事件身份跨状态稳定）', K(byId.E14.a), K(byId.E14.b));
eq('【E14】该对动作词一致（续集 / 开发）',
  EK.explain(byId.E14.a).action_sig.join(','), EK.explain(byId.E14.b).action_sig.join(','));
ok('【E14】状态词已被标准化移除（A 中不含「官方」「确认」）',
  EK.explain(byId.E14.a).normalized_title.indexOf('官方') < 0 &&
  EK.explain(byId.E14.a).normalized_title.indexOf('确认') < 0);

/* ============================================================
 * 10. 三条禁用行为的机器校验
 * ============================================================ */
section('10. 禁用行为校验（不落状态 / 不删记录 / 不跨事件合并）');

const batch = [
  byId.E14.a, byId.E14.b,                       /* 同事件两条 → 应合并 */
  byId.E13.a, byId.E13.b,                       /* 同作品不同动作 → 不合并 */
  F.E2.sub[1].a, F.E2.sub[1].b,                 /* 同 key 但超窗口 → hold */
  F.E1.sub[0].a, F.E1.sub[0].b                  /* 同事件不同标题 → 应合并 */
];
const res = EM.mergeCandidates(batch);

/* ① 不产出任何状态字段（深层扫描） */
const forbidden = EM.findForbiddenKeys(res);
eq('【禁用 1】输出中不含任何状态字段（深层扫描，含 verification_status）', forbidden.join(','), '');
ok('【禁用 1】输出文本中亦不出现 verification_status 字样',
  JSON.stringify(res).indexOf('verification_status') < 0);
ok('【禁用 1】模块显式声明禁止输出的字段清单（6 项）',
  EM.FORBIDDEN_OUTPUT_KEYS.length === 6 && EM.FORBIDDEN_OUTPUT_KEYS.indexOf('verification_status') === 0);

/* ② 不删除任何报道记录 */
eq('【禁用 2】输入 ' + batch.length + ' 条 → 输出报道总数仍为 ' + batch.length,
  res.stats.reports_preserved, batch.length);
eq('【禁用 2】records_deleted = 0', res.stats.records_deleted, 0);
const allIds = [];
res.events.forEach(function (e) { e.item_ids.forEach(function (i) { allIds.push(i); }); });
const inputIds = batch.map(function (x) { return x.id; }).sort();
eq('【禁用 2】每条输入的 id 都出现在输出中（无丢失）', allIds.slice().sort().join(','), inputIds.join(','));
ok('【禁用 2】无重复 id（同一报道不会被两边各算一次）', new Set(allIds).size === allIds.length);

/* ③ 不同 event_key 绝不合并 */
let crossMerge = '';
const keyOfId = {};
batch.forEach(function (x) { keyOfId[x.id] = K(x); });
res.events.forEach(function (e) {
  const ks = Array.from(new Set(e.item_ids.map(function (i) { return keyOfId[i]; })));
  if (ks.length !== 1) crossMerge = e.item_ids.join(',') + ' → ' + ks.join(' | ');
  if (ks[0] !== e.event_key) crossMerge = crossMerge || ('event_key 不一致：' + e.event_key + ' vs ' + ks[0]);
});
eq('【禁用 3】每个事件的成员都属于同一 event_key（无跨事件合并）', crossMerge, '');

/* ★ 同一 event_key 可以对应多个 hold 事件（窗口分裂），但
 *   「可自动合并(merge) / 单条(single)」事件在每个 key 下必须唯一 ——
 *   否则就是把一个 key 拆出了两个「正式事件」。 */
const mergeLike = res.events.filter(function (e) { return e.decision !== 'hold'; });
eq('【禁用 3】某个 event_key 下至多一个 merge/single 事件',
  new Set(mergeLike.map(function (e) { return e.event_key; })).size, mergeLike.length);
ok('【禁用 3】所有 hold 事件都给出了 hold_reason（不静默）',
  res.events.filter(function (e) { return e.decision === 'hold'; }).every(function (e) { return !!e.hold_reason; }));

/* 窗口分裂的具体验证：E2b 两条同 key 但相距 79 天 → 必须输出 2 个 hold 事件 */
const e2bKeys = [K(F.E2.sub[1].a)];
const e2bEvents = res.events.filter(function (e) { return e2bKeys.indexOf(e.event_key) >= 0; });
eq('【窗口分裂】同 key 超窗口 → 输出 2 个 hold 事件（不自动合并）', e2bEvents.length, 2);
ok('【窗口分裂】两个事件 decision 均为 hold，reason 均为 out_of_window',
  e2bEvents.every(function (e) { return e.decision === 'hold' && e.hold_reason === 'out_of_window'; }));

/* 决策统计 */
ok('【合并统计】存在可合并事件（decision = merge）', res.stats.mergeable_events > 0,
  JSON.stringify(res.stats));
ok('【合并统计】存在被 hold 的事件（超窗口 / 缺时间）', res.stats.held_events > 0,
  JSON.stringify(res.stats));

/* ============================================================
 * 11. 真实 15 条 news.js 集成跑（只读）
 * ============================================================ */
section('11. 真实 15 条 news.js 集成跑（只读）');

const ctx = {};
ctx.window = ctx; ctx.global = ctx; ctx.console = console;
ctx.URL = URL; ctx.Date = Date; ctx.Math = Math; ctx.JSON = JSON;
vm.createContext(ctx);
['movies.js', 'series.js', 'special.js', 'short.js', 'content.js', 'characters.js', 'news.js']
  .forEach(function (f) {
    vm.runInContext(fs.readFileSync(path.join(H5, 'data', f), 'utf8'), ctx, { filename: f });
  });
const NEWS = ctx.window.MCU_NEWS || [];

const real = EM.mergeCandidates(NEWS);
eq('输入条数 = 15', real.stats.input_items, 15);
eq('报道记录零丢失', real.stats.reports_preserved, 15);
eq('records_deleted = 0', real.stats.records_deleted, 0);
eq('输出中不含状态字段', EM.findForbiddenKeys(real).join(','), '');
ok('归并后事件数 ≤ 15（去重生效但不激进）',
  real.stats.output_events > 0 && real.stats.output_events <= 15, String(real.stats.output_events));
ok('每条真实数据都能生成合法 key',
  NEWS.every(function (n) { return KEY_RE.test(K(n)); }));

console.log('  INFO  真实数据归并结果：输入 15 条 → 事件 ' + real.stats.output_events +
  ' 个（可合并 ' + real.stats.mergeable_events + ' / hold ' + real.stats.held_events + '）');
real.events.forEach(function (e) {
  console.log('        ' + e.event_key + '  ×' + e.report_count + '  ' + e.decision +
    (e.hold_reason ? ' (' + e.hold_reason + ')' : '') + '  ' + e.item_ids.join(', '));
});

/* ============================================================
 * 12. 验收输出
 * ============================================================ */
section('12. 验收输出');

console.log('  ── h5/data/news.js SHA256 ──');
const shaNews = crypto.createHash('sha256')
  .update(fs.readFileSync(path.join(H5, 'data', 'news.js'))).digest('hex').toUpperCase();
console.log('  实测：' + shaNews);
console.log('  基线：' + NEWS_JS_SHA256_EXPECTED);
ok('h5/data/news.js SHA256 与基线一致（未改动）', shaNews === NEWS_JS_SHA256_EXPECTED, shaNews);

console.log('');
console.log('  ── git status ──');
try {
  const st = execSync('git -C "' + ROOT + '" status --porcelain', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  const lines = st.split('\n').filter(function (l) { return l.trim(); });
  const bad = lines.filter(function (l) { return /h5[\\/]|wechat[\\/]|douyin[\\/]/.test(l); });
  console.log('  条目数：' + lines.length + '　其中 h5 / wechat / douyin 相关：' + bad.length);
  ok('git status 中无 h5 / wechat / douyin 路径', bad.length === 0, bad.join(' | '));
} catch (e) {
  console.log('  （本环境无法执行 git，跳过 —— 由外部 wrapper 另行留档）：' + e.message);
}

console.log('');
console.log('============================================================');
console.log('结果：' + pass + ' PASS / ' + fail + ' FAIL');
if (fail) { console.log('失败项：'); fails.forEach(function (f) { console.log('  - ' + f); }); }
console.log('============================================================');
process.exit(fail ? 1 : 0);
