/* ============================================================
 * V1.2 最终视觉验收修正任务 —— 三页数据/资源支撑度核查（只读）
 * ------------------------------------------------------------
 * 目的：在设计 AI 出方案前，先程序化确认三页设计要求所需的
 *       数据字段与图片资源是否真实存在，避免设计出无法落地的方案。
 * 范围：只 require 数据层（data/*.js、models/pano.js），
 *       不触碰 wx API，不修改任何文件。
 * 用法：node workspace/audit_v12_visual_readiness.js
 * ============================================================ */

const P = __dirname + '/../';
const { PANO_MOVIES, PANO_CONN, PHASE_COLS } = require(P + 'models/pano.js');
const visuals = require(P + 'data/visuals.js');
const CONTENT_MOD = require(P + 'data/content.js');
const CHAR_MOD = require(P + 'data/characters.js');
const REL_MOD = require(P + 'data/relations.js');

function pick(mod, keys) {
  for (let i = 0; i < keys.length; i++) if (mod[keys[i]]) return mod[keys[i]];
  return Array.isArray(mod) ? mod : null;
}
const content = pick(CONTENT_MOD, ['CONTENT', 'all']);
const chars = pick(CHAR_MOD, ['CHARACTERS']);
const relRaw = pick(REL_MOD, ['CHAR_RELATIONS', 'CHAR_REL', 'RELATIONS']);

const byId = {};
(content || []).forEach(function (c) { byId[c.id] = c; });

console.log('========== ① 宇宙全景图（panorama）数据支撑 ==========');
console.log('PANO_MOVIES 节点数 :', PANO_MOVIES.length);
console.log('PANO_CONN   连线数 :', PANO_CONN.length);
console.log('PHASE_COLS  阶段数 :', PHASE_COLS.length, '→', PHASE_COLS.map(function (p) { return 'P' + p.phase; }).join(' '));
const upcoming = PANO_MOVIES.filter(function (n) { return n.upcoming; });
console.log('待映(upcoming)     :', upcoming.length, upcoming.length ? ('→ ' + upcoming.map(function (n) { return n.id; }).join(', ')) : '');

let hasPoster = 0; const noPoster = [];
PANO_MOVIES.forEach(function (n) {
  const v = visuals.visual ? visuals.visual(n.id) : null;
  if (v && v.poster) hasPoster++; else noPoster.push(n.id + (n.upcoming ? '(待映)' : ''));
});
console.log('可取海报节点       :', hasPoster + '/' + PANO_MOVIES.length);
console.log('无海报节点         :', noPoster.length ? noPoster.join(', ') : '（无）');

let hasYear = 0; const noYear = [];
PANO_MOVIES.forEach(function (n) {
  const c = byId[n.id];
  const y = c && (c.date ? String(c.date).slice(0, 4) : (c.coLabel || ''));
  if (y) hasYear++; else noYear.push(n.id + (n.upcoming ? '(待映)' : ''));
});
console.log('可取年份节点       :', hasYear + '/' + PANO_MOVIES.length, noYear.length ? ('｜缺: ' + noYear.join(', ')) : '');

const grp = {};
PANO_MOVIES.forEach(function (n) {
  const c = byId[n.id];
  const p = c ? c.phase : (n.upcoming ? 6 : 0);
  grp['P' + p] = (grp['P' + p] || 0) + 1;
});
console.log('按 Phase 可分组     :', JSON.stringify(grp));
console.log('已观看状态来源      : models/userState.js → progress.isSeen(id) / statusOf(id)（已存在，可直接用）');

console.log('');
console.log('========== ② 关系探索（explore）数据支撑 ==========');
console.log('CHARACTERS 角色数   :', chars ? chars.length : '(未解析)');
if (Array.isArray(relRaw)) {
  console.log('角色关系条目        :', relRaw.length);
} else if (relRaw && typeof relRaw === 'object') {
  const ks = Object.keys(relRaw);
  console.log('角色关系(对象键)    :', ks.length, '→', ks.slice(0, 8).join(', ') + (ks.length > 8 ? ' …' : ''));
} else {
  console.log('角色关系            : REL_MOD 导出键 =', Object.keys(REL_MOD).join(', '));
}
let avaOk = 0; const avaMiss = [];
(chars || []).forEach(function (c) {
  const a = visuals.avatar ? visuals.avatar(c.id) : null;
  if (a) avaOk++; else avaMiss.push(c.id);
});
console.log('有头像映射角色      :', avaOk + '/' + (chars ? chars.length : 0), avaMiss.length ? ('｜缺: ' + avaMiss.join(', ')) : '');

console.log('');
console.log('========== ③ 分享海报（share）资源支撑 ==========');
console.log('heroBanner()        :', visuals.heroBanner ? (visuals.heroBanner() ? '有' : '空') : '(无此 API)');
if (visuals.entryBg) {
  console.log('entryBg(key)        :', ['explore', 'routes', 'browse', 'panorama', 'home'].map(function (k) {
    return k + '=' + (visuals.entryBg(k) ? '有' : '无');
  }).join(' | '));
}
if (visuals.phase) {
  console.log('phase(n) 阶段图     :', [1, 2, 3, 4, 5, 6].map(function (n) {
    return 'P' + n + ':' + (visuals.phase(n) ? '有' : '无');
  }).join(' '));
}
console.log('电影海报总量        :', (function () {
  let c = 0;
  (content || []).forEach(function (x) { const v = visuals.visual ? visuals.visual(x.id) : null; if (v && v.poster) c++; });
  return c + '/' + (content ? content.length : 0) + '（CONTENT 全量中可取海报数）';
})());
