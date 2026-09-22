/* verify-v23.cjs · V2.3 验收：数据完整性 + 跳转链路 + journey 语义采样 */
const fs = require('fs');
const vm = require('vm');
const base = 'D:/SEO/发挥余热/漫威电影宇宙导航/douyin';

/* 1. 数据完整性（带 require 缓存的模块加载器，适配 douyin/data 模块链） */
const path = require('path');
const cacheMap = {};
function loadMod(f) {
  if (cacheMap[f]) return cacheMap[f].exports;
  const src = fs.readFileSync(f, 'utf8');
  const mod = { exports: {} };
  const req = function (p) { return loadMod(path.join(path.dirname(f), p)); };
  const fn = new Function('require', 'module', 'exports', 'window', 'tt', src);
  fn(req, mod, mod.exports, {}, {});
  cacheMap[f] = mod;
  return mod.exports;
}
const CONTENT = loadMod(base + '/data/content.js');
const RELS = loadMod(base + '/data/relations.js');
/* content.js 合成结果可能是数组或 { CONTENT } 形态，relations 同理 */
const LIST = Array.isArray(CONTENT) ? CONTENT : (CONTENT.CONTENT || CONTENT.MCU_CONTENT || []);
const RRAW = Array.isArray(RELS) ? RELS : (RELS.RELATIONS || RELS.MCU_RELATIONS || []);
const ids = {};
LIST.forEach(c => { ids[c.id] = c; });
let bad = [];
RRAW.forEach(r => {
  const a = Array.isArray(r) ? r[0] : r.from;
  const b = Array.isArray(r) ? r[1] : r.to;
  if (!ids[a]) bad.push('from:' + a);
  if (!ids[b]) bad.push('to:' + b);
});
console.log('MCU_CONTENT 条数:', LIST.length);
console.log('关系总数:', RRAW.length, '| 无效指向:', bad.length, bad.length ? bad.slice(0, 5).join(',') : '');
const W = { idMap: ids, raw: RRAW };

/* 2. winter-soldier 样本（预览数据） */
const ws = ids['winter-soldier'];
console.log('winter-soldier:', JSON.stringify({ cn: ws.cn, year: ws.year, phase: ws.phase, ro: ws.ro }));
const rels = RRAW.filter(r => (Array.isArray(r) ? r[0] : r.from) === 'winter-soldier' || (Array.isArray(r) ? r[1] : r.to) === 'winter-soldier')
  .map(r => { const oid = Array.isArray(r) ? (r[0] === 'winter-soldier' ? r[1] : r[0]) : (r.from === 'winter-soldier' ? r.to : r.from); const o = ids[oid]; return o ? o.cn + '(第' + (o.phase || '?') + '阶段)' : 'MISSING:' + oid; });
console.log('winter-soldier 关联节点:', rels.join('、'));

/* 3. journey 语义采样 */
const jj = fs.readFileSync(base + '/pages/journey/journey.js', 'utf8');
const labels = jj.match(/label:\s*'[^']*'/g) || [];
console.log('journey 路线标签:', labels.join(' | '));
console.log('journey typeLabel 渲染:', jj.indexOf('typeLabel') > -1 ? '有(列表项显示电影/剧集)' : '无');
console.log('journey 观看语义词:', ['观看', '已看', '上映'].filter(w => jj.indexOf(w) > -1).join('/'));

/* 4. home→movie 入口 */
const hj = fs.readFileSync(base + '/pages/home/home.js', 'utf8');
console.log('home 跳 movie 次数:', (hj.match(/movie\/movie\?id=/g) || []).length);

/* 5. movie 页被引用处（入口兼容） */
['home', 'library', 'journey', 'my-mcu'].forEach(p => {
  const src = fs.readFileSync(base + '/pages/' + p + '/' + p + '.js', 'utf8');
  const n = (src.match(/pages\/movie\/movie/g) || []).length;
  if (n) console.log(p + ' → movie 跳转: ' + n + ' 处');
});
