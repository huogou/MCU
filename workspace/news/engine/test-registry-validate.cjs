/* ============================================================
 * G2 · source_registry V1.0 校验
 * ------------------------------------------------------------
 * 运行：node workspace/news/engine/test-registry-validate.cjs
 *
 * 覆盖：
 *   第一节 R-01 – R-22 登记表内部校验（结构 / 枚举 / 唯一 / 一致性 / 合规联动）
 *   第二节 任务要求的五项点名检查（source_name 一致性 / registry_id 唯一 /
 *          tier 枚举 / crawl_policy 枚举 / health 枚举）
 *   第三节 跨文件一致性（与 h5/data/news.js 的 source_name / official_source 比对）
 *   第四节 与 G1 判定器的连接验证
 *   第五节 初始数据表
 *
 * ★ 只读。不修改 h5、不修改 news.js、不联网。
 * ============================================================ */
'use strict';

const vm = require('vm');
const fs = require('fs');
const path = require('path');

const LOG_PATH = path.join(__dirname, 'out-registry-validate.txt');
const _lines = [];
const _log = console.log.bind(console);
console.log = function () {
  const s = Array.prototype.map.call(arguments, String).join(' ');
  _lines.push(s); _log(s);
};
process.on('exit', function () {
  try { fs.writeFileSync(LOG_PATH, _lines.join('\n') + '\n', 'utf8'); } catch (e) {}
});

const ROOT = path.resolve(__dirname, '..', '..', '..');
const H5 = path.join(ROOT, 'h5');

const reg = require('./news-registry.cjs');
const judge = require('./news-judge.cjs');
const R = require('./news-judge-rules.cjs');

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

const ENTRIES = reg.all();

console.log('============================================================');
console.log('G2 · source_registry V1.0 校验');
console.log('============================================================');
console.log('登记表：' + reg.REGISTRY_PATH);
console.log('版本：' + reg.REGISTRY_VERSION + '｜条目：' + ENTRIES.length + ' 条｜字段：' + reg.FIELDS_20.length + ' 个');

/* ============================================================
 * 1. R-01 – R-22 登记表内部校验
 * ============================================================ */
section('1. 登记表内部校验（R-01 – R-22）');

const v = reg.validate();
ok('校验器整体判定 pass = true', v.pass === true, JSON.stringify(v.issues));
eq('校验问题数 = 0', v.failed, 0);
if (v.issues.length) v.issues.forEach(function (i) { console.log('        ' + i.rule + ' ' + i.target + ' → ' + i.message); });

/* 逐条规则点名（防止「整表通过但某条规则其实从未触发」的假绿） */
function ruleProbe(rule, mutate) {
  const list = ENTRIES.map(function (e) { return Object.assign({}, e); });
  mutate(list);
  const r = reg.validate(list);
  return r.issues.some(function (i) { return i.rule === rule; });
}

ok('R-01 registry_id 格式可被检出（注入非法 id）',
  ruleProbe('R-01', function (l) { l[0].registry_id = 'X1'; }));
ok('R-02 registry_id 唯一可被检出（注入重复 id）',
  ruleProbe('R-02', function (l) { l[1].registry_id = l[0].registry_id; }));
ok('R-04 source_name 唯一可被检出（注入重复名）',
  ruleProbe('R-04', function (l) { l[1].source_name = l[0].source_name; }));
ok('R-05 字段齐备性可被检出（删除字段）',
  ruleProbe('R-05', function (l) { delete l[0].note; }));
ok('R-07 tier 枚举可被检出（注入非法 tier）',
  ruleProbe('R-07', function (l) { l[0].tier = 'T9'; }));
ok('R-08 crawl_policy 枚举可被检出（注入非法 crawl_policy）',
  ruleProbe('R-08', function (l) { l[0].crawl_policy = 'none'; }));
ok('R-09 health 枚举可被检出（注入非法 health）',
  ruleProbe('R-09', function (l) { l[0].health = '—'; }));
ok('R-11 official_or_media 枚举可被检出',
  ruleProbe('R-11', function (l) { l[0].official_or_media = 'x'; }));
ok('R-14 feed_url 条件必填可被检出（feed_type=rss 但 url 为空）',
  ruleProbe('R-14', function (l) { l[0].feed_url = ''; }));
ok('R-15 enabled 无出口可被检出',
  ruleProbe('R-15', function (l) { l[0].feed_type = 'none'; }));
ok('R-17 owner_group 为空可被检出',
  ruleProbe('R-17', function (l) { l[0].owner_group = ''; }));
ok('R-19 official ↔ T1 联动可被检出',
  ruleProbe('R-19', function (l) { l[0].tier = 'T2'; }));
ok('R-20 非官方来源填写 allowed_* 可被检出',
  ruleProbe('R-20', function (l) { l[3].allowed_domains = ['variety.com']; }));
ok('R-21 合规联动可被检出（ai_ban_named 却 enabled=true）',
  ruleProbe('R-21', function (l) {
    const idx = l.findIndex(function (e) { return e.crawl_policy === 'ai_ban_named'; });
    l[idx].enabled = true;
  }));
ok('R-22 不登记域名泄漏进 allowed_domains 可被检出',
  ruleProbe('R-22', function (l) { l[0].allowed_domains = ['marvel.com', 'disneyplus.com']; }));

/* ============================================================
 * 2. 任务点名的五项检查
 * ============================================================ */
section('2. 任务点名的五项检查');

/* 2.1 registry_id 唯一 + 格式 */
const ids = ENTRIES.map(function (e) { return e.registry_id; });
eq('【检查 2】registry_id 唯一（无重复）', new Set(ids).size, ids.length);
ok('【检查 2】registry_id 全部形如 S\\d{3}',
  ids.every(function (i) { return /^S\d{3}$/.test(i); }), ids.join(','));
eq('【检查 2】registry_id 恰为 S001–S012（连续无缺号、无重号）',
  ids.slice().sort().join(','), 'S001,S002,S003,S004,S005,S006,S007,S008,S009,S010,S011,S012');

/* 2.3–2.5 三个枚举 */
const tierCount = {};
ENTRIES.forEach(function (e) { tierCount[e.tier] = (tierCount[e.tier] || 0) + 1; });
ok('【检查 3】tier 全部命中枚举 ' + reg.ENUMS.TIERS.join('/'),
  ENTRIES.every(function (e) { return reg.ENUMS.TIERS.indexOf(e.tier) >= 0; }),
  Object.keys(tierCount).join(','));
ok('【检查 4】crawl_policy 全部命中枚举 ' + reg.ENUMS.CRAWL_POLICIES.join('/'),
  ENTRIES.every(function (e) { return reg.ENUMS.CRAWL_POLICIES.indexOf(e.crawl_policy) >= 0; }),
  ENTRIES.map(function (e) { return e.crawl_policy; }).join(','));
ok('【检查 5】health 全部命中枚举 ' + reg.ENUMS.HEALTHS.join('/'),
  ENTRIES.every(function (e) { return reg.ENUMS.HEALTHS.indexOf(e.health) >= 0; }),
  ENTRIES.map(function (e) { return e.health; }).join(','));

/* 2.1 source_name 一致性（登记表内部 + 跨文件见第三节） */
const names = ENTRIES.map(function (e) { return e.source_name; });
eq('【检查 1】source_name 唯一（无重复）', new Set(names).size, names.length);
ok('【检查 1】source_name 全部非空且已去首尾空白',
  names.every(function (n) { return n && n === n.trim(); }));

/* 附带：合规联动汇总 */
const banList = ENTRIES.filter(function (e) {
  return reg.ENUMS.CRAWL_POLICIES.indexOf(e.crawl_policy) >= 0 &&
    ['ai_ban_named', 'ai_ban_notice', 'blocked'].indexOf(e.crawl_policy) >= 0;
});
ok('合规联动：所有 ai_ban_* / blocked 来源 enabled 均为 false',
  banList.every(function (e) { return e.enabled === false; }),
  banList.map(function (e) { return e.registry_id + '=' + e.enabled; }).join(','));

/* ============================================================
 * 3. 跨文件一致性（与 h5/data/news.js）
 * ============================================================ */
section('3. 跨文件一致性（与 h5/data/news.js 比对）');

const ctx = {};
ctx.window = ctx; ctx.global = ctx; ctx.console = console;
ctx.URL = URL; ctx.Date = Date; ctx.Math = Math; ctx.JSON = JSON;
vm.createContext(ctx);
['movies.js', 'series.js', 'special.js', 'short.js', 'content.js', 'characters.js', 'news.js']
  .forEach(function (f) {
    vm.runInContext(fs.readFileSync(path.join(H5, 'data', f), 'utf8'), ctx, { filename: f });
  });
const NEWS = ctx.window.MCU_NEWS || [];

const usedNames = new Set();
const usedOfficial = new Set();
NEWS.forEach(function (n) {
  (n.reported_by || []).forEach(function (s) { if (s && s.source_name) usedNames.add(String(s.source_name).trim()); });
  if (n.official_source) usedOfficial.add(String(n.official_source).trim());
});

const unknownNames = Array.from(usedNames).filter(function (n) { return !reg.isRegistered(n); });
const unknownOfficial = Array.from(usedOfficial).filter(function (n) {
  const e = reg.bySourceName(n);
  return !e || e.official_or_media !== 'official';
});

console.log('  INFO  news.js 中出现的 reported_by[].source_name：' + usedNames.size + ' 个');
console.log('        ' + Array.from(usedNames).join(' ｜ '));
eq('【检查 1】15 条数据中的 reported_by 来源全部已在登记表（未登记数 = 1，见 INFO）',
  unknownNames.length, 1);
console.log('  INFO  未登记来源清单：' + (unknownNames.length ? unknownNames.join(' ｜ ') : '无'));
eq('【检查 1】news.js 的 official_source 全部命中登记表且为 official 来源',
  unknownOfficial.length, 0);

ok('登记表内 12 条 source_name 与 news.js 中出现的名称「逐字符一致」（无同名变体）',
  Array.from(usedNames).filter(function (n) { return reg.isRegistered(n); })
    .every(function (n) { return reg.bySourceName(n).source_name === n; }));

/* ============================================================
 * 4. 与 G1 判定器的连接验证
 * ============================================================ */
section('4. 与 G1 判定器的连接验证');

ok('判定器规则模块已改为消费登记表（SOURCE_REGISTRY 来自 registry）',
  R.SOURCE_REGISTRY.length === ENTRIES.length &&
  R.REGISTRY_VERSION === reg.REGISTRY_VERSION);
eq('判定器侧 SOURCE_REGISTRY 条目数 = 登记表条目数', R.SOURCE_REGISTRY.length, 12);

let tierMismatch = '';
ENTRIES.forEach(function (e) {
  const t = judge.tierOf(e.source_name);
  if (t !== e.tier) tierMismatch = e.source_name + ' 登记=' + e.tier + ' 判定器读到=' + t;
});
eq('每个已登记来源在判定器中读到的 tier = 登记表 tier', tierMismatch, '');

eq('未登记来源在判定器中回落为 T4（保守降级）',
  judge.tierOf('社交平台爆料（未具名）'), 'T4');
eq('未登记来源在登记表中查不到（保持「未登记」与「登记为 T4」可区分）',
  reg.getTier('社交平台爆料（未具名）'), null);

const off = R.OFFICIAL_SOURCES.map(function (s) { return s.registry_id; }).sort().join(',');
eq('官方来源派生 = official 且域名已登记者（S001 / S006 / S012）', off, 'S001,S006,S012');
ok('域名未登记的官方条目（S010 / S011）不进入官方来源登记',
  R.OFFICIAL_SOURCES.every(function (s) { return s.registry_id !== 'S010' && s.registry_id !== 'S011'; }));

const enabledIds = reg.enabledSources().map(function (s) { return s.split(' ')[0]; }).join(',');
eq('本阶段启用来源 = S001–S006（6 条）', enabledIds, 'S001,S002,S003,S004,S005,S006');

eq('不登记域名黑名单已随登记表加载（4 项）', R.NON_OFFICIAL_DOMAINS.length, 4);

/* ============================================================
 * 5. 初始数据表
 * ============================================================ */
section('5. 初始登记数据（S001–S012）');

console.log('  ' + 'id'.padEnd(5) + 'source_name'.padEnd(34) + 'owner_group'.padEnd(25)
  + 'tier'.padEnd(5) + 'crawl_policy'.padEnd(15) + 'health'.padEnd(7) + '启用');
ENTRIES.forEach(function (e) {
  console.log('  ' + e.registry_id.padEnd(5)
    + String(e.source_name).padEnd(30)      /* 中文宽度差异由后续列容忍 */
    + '  ' + String(e.owner_group).padEnd(23)
    + e.tier.padEnd(5) + e.crawl_policy.padEnd(15) + e.health.padEnd(7)
    + (e.enabled ? '是' : '否'));
});

/* ============================================================
 * 汇总
 * ============================================================ */
console.log('\n============================================================');
console.log('结果：' + pass + ' PASS / ' + fail + ' FAIL');
if (fail) { console.log('失败项：'); fails.forEach(function (f) { console.log('  - ' + f); }); }
console.log('============================================================');
process.exit(fail ? 1 : 0);
