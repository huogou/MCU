/* ============================================================
 * V1.1 上线前验收 · 数据一致性检查（第四部分）
 * ------------------------------------------------------------
 * 1. 小程序数据完整性：CONTENT/ROUTES/CHARACTERS/RELATIONS 无重复、引用完整
 * 2. H5 与小程序数据字节级一致性（机械适配，去 window 前缀后应 100% 一致）
 * ============================================================ */
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
function assert(cond, msg) {
  if (cond) { pass++; console.log('  ✓ ' + msg); }
  else { fail++; console.log('  ✗ FAIL: ' + msg); }
}

/* ========== 1. 小程序数据完整性 ========== */
console.log('— 1. 小程序数据完整性 —');
const mcuData = require('./models/mcuData.js');
const { RELATIONS, REL_TYPES } = require('./data/relations.js');
const { CHARACTERS, CAMPS } = require('./data/characters.js');
const ROUTES = require('./data/routes.js');
const { CONTENT } = require('./data/content.js');

/* id 唯一性 */
const cIds = CONTENT.map(c => c.id);
assert(new Set(cIds).size === CONTENT.length, 'CONTENT ' + CONTENT.length + ' 条，id 无重复');
assert(new Set(CHARACTERS.map(c => c.id)).size === CHARACTERS.length, 'CHARACTERS ' + CHARACTERS.length + ' 位，id 无重复');
assert(new Set(ROUTES.map(r => r.id)).size === ROUTES.length, 'ROUTES ' + ROUTES.length + ' 条，id 无重复');
assert(CONTENT.length === 59, 'CONTENT 总量 59（实际 ' + CONTENT.length + '）');
assert(CHARACTERS.length === 24, 'CHARACTERS 总量 24（实际 ' + CHARACTERS.length + '）');
assert(ROUTES.length === 11, 'ROUTES 总量 11（实际 ' + ROUTES.length + '）');
assert(RELATIONS.length === 92, 'RELATIONS 总量 92（实际 ' + RELATIONS.length + '）');

/* RELATIONS 引用完整性：from/to 必须在 CONTENT 内 */
const cSet = new Set(cIds);
let badRel = RELATIONS.filter(r => !cSet.has(r.from) || !cSet.has(r.to));
assert(badRel.length === 0, 'RELATIONS from/to 全部在 CONTENT 内（异常 ' + badRel.length + ' 条' + (badRel.length ? ': ' + JSON.stringify(badRel[0]) : '') + '）');

/* RELATIONS 无重复边（(from,to,type,weight) 四元组唯一；同对作品多 type 边为合法设计） */
const edgeSet = new Set();
let dupEdge = 0;
RELATIONS.forEach(r => {
  const k = [r.from, r.to, r.type, r.weight].join('|');
  if (edgeSet.has(k)) dupEdge++;
  edgeSet.add(k);
});
assert(dupEdge === 0, 'RELATIONS 无重复边（四元组判重，重复 ' + dupEdge + ' 条）');

/* RELATIONS type/weight 合法 */
let badType = RELATIONS.filter(r => !REL_TYPES[r.type]);
let badW = RELATIONS.filter(r => !(r.weight >= 1 && r.weight <= 3));
assert(badType.length === 0, 'RELATIONS type 均在 REL_TYPES 内（异常 ' + badType.length + '）');
assert(badW.length === 0, 'RELATIONS weight 均在 1-3（异常 ' + badW.length + '）');
assert(RELATIONS.filter(r => !r.why || r.why.length < 5).length === 0, 'RELATIONS why 全部非空（铁律）');

/* CHARACTERS.first 引用完整 */
let badFirst = CHARACTERS.filter(c => !cSet.has(c.first));
assert(badFirst.length === 0, 'CHARACTERS.first 均在 CONTENT 内（异常 ' + badFirst.length + '）');
let badCamp = CHARACTERS.filter(c => !CAMPS[c.camp]);
assert(badCamp.length === 0, 'CHARACTERS.camp 均在 CAMPS 内（异常 ' + badCamp.length + '）');

/* CONTENT.chars 引用完整：引用的角色 id 都在 CHARACTERS 内 */
const charSet = new Set(CHARACTERS.map(c => c.id));
const badCharRef = [];
CONTENT.forEach(c => {
  if (c.chars) c.chars.forEach(id => { if (!charSet.has(id)) badCharRef.push(c.id + '→' + id); });
});
assert(badCharRef.length === 0, 'CONTENT.chars 引用全部有效（异常 ' + badCharRef.length + '：' + badCharRef.slice(0, 3).join(',') + '）');

/* ROUTES.items 引用完整 */
const badRouteRef = [];
ROUTES.forEach(r => {
  (r.items || []).forEach(id => { if (!cSet.has(id)) badRouteRef.push(r.id + '→' + id); });
});
assert(badRouteRef.length === 0, 'ROUTES.items 引用全部有效（异常 ' + badRouteRef.length + '）');

/* 关键字段完整性 */
assert(CONTENT.filter(c => !c.cn || !c.id).length === 0, 'CONTENT cn/id 全部非空');
assert(CONTENT.filter(c => !c.phase).length === 0, 'CONTENT phase 全部存在（' + CONTENT.filter(c => !c.phase).length + ' 缺失）');
assert(CONTENT.filter(c => !c.importance).length === 0, 'CONTENT importance 全部存在');
const typeCount = {};
CONTENT.forEach(c => { typeCount[c.type] = (typeCount[c.type] || 0) + 1; });
console.log('  · 类型分布: ' + JSON.stringify(typeCount));
const roSet = new Set(CONTENT.map(c => c.ro));
const coSet = new Set(CONTENT.map(c => c.co));
assert(roSet.size === 59, 'CONTENT ro（上映序）1-59 无重复');
assert(coSet.size === 59, 'CONTENT co（时间线序）1-59 无重复');

/* ========== 2. H5 与小程序数据一致性（vm 双执行，JSON 级对比） ========== */
console.log('— 2. H5 与小程序数据一致性（vm 双执行） —');
const vm = require('vm');
const H5DIR = path.resolve(__dirname, '..', 'mcu-navigator', 'data');

/* H5 执行器：注入 window，按依赖顺序执行数据文件 */
function runH5() {
  const window = {};
  const ctx = vm.createContext({ window: window, console: console });
  const files = ['movies.js', 'series.js', 'special.js', 'short.js', 'relations.js', 'characters.js', 'routes.js', 'content.js', 'visuals.js'];
  for (const f of files) {
    const code = fs.readFileSync(path.join(H5DIR, f), 'utf8');
    vm.runInContext(code, ctx, { filename: f });
  }
  return window;
}
let h5w = null;
try { h5w = runH5(); } catch (e) { assert(false, 'H5 数据文件 vm 执行失败: ' + e.message); }

function jstr(x) { return JSON.stringify(x); }

/* 成对对比 */
const pairDefs = [
  ['movies', h5w.MCU_MOVIES, require('./data/movies.js').MOVIES],
  ['series', h5w.MCU_SERIES, require('./data/series.js')],
  ['special', h5w.MCU_SPECIAL, require('./data/special.js')],
  ['short', h5w.MCU_SHORT, require('./data/short.js')],
  ['relations', h5w.MCU_RELATIONS, require('./data/relations.js').RELATIONS],
  ['characters', h5w.MCU_CHARACTERS, require('./data/characters.js').CHARACTERS],
  ['routes', h5w.MCU_ROUTES, require('./data/routes.js')],
  ['content', h5w.MCU_CONTENT, CONTENT]
];
for (const [name, h, m] of pairDefs) {
  const same = jstr(h) === jstr(m);
  assert(same, name + ' H5↔小程序 JSON 一致（' + (h ? h.length : '?') + ' 条）');
}
/* CAMPS / REL_TYPES 常量 */
assert(jstr(h5w.MCU_CAMPS) === jstr(require('./data/characters.js').CAMPS), 'CAMPS 一致');
assert(jstr(h5w.MCU_REL_TYPES) === jstr(require('./data/relations.js').REL_TYPES), 'REL_TYPES 一致');
/* visuals：MP 空映射为预期（资源待填充阶段，不判定失败） */
console.log('  · visuals.js：小程序映射为空为预期（海报/剧照资源待填充，Step3-2 已记录）');
/* UPCOMING（H5 独有预告位，小程序 content 是否含） */
if (h5w.MCU_UPCOMING && h5w.MCU_UPCOMING.length) {
  const mpHas = CONTENT.filter(c => c.upcoming).length;
  console.log('  · H5 UPCOMING ' + h5w.MCU_UPCOMING.length + ' 条；小程序 CONTENT.upcoming=' + mpHas + ' 条');
}

/* CONTENT 合成口径：id / ro / co 全序对比 */
assert(h5w.MCU_CONTENT.length === CONTENT.length, 'H5 CONTENT 合成 ' + h5w.MCU_CONTENT.length + ' 条 = 小程序 ' + CONTENT.length + ' 条');
assert(jstr(h5w.MCU_CONTENT.map(c => c.id)) === jstr(CONTENT.map(c => c.id)), 'H5/小程序 CONTENT id 顺序 100% 一致');
assert(jstr(h5w.MCU_CONTENT.map(c => c.ro)) === jstr(CONTENT.map(c => c.ro)), 'H5/小程序 CONTENT ro 全序一致');
assert(jstr(h5w.MCU_CONTENT.map(c => c.co)) === jstr(CONTENT.map(c => c.co)), 'H5/小程序 CONTENT co 全序一致');

console.log('\n========== 数据一致性检查结果：' + pass + ' 通过 / ' + fail + ' 失败 ==========');
process.exit(fail ? 1 : 0);
