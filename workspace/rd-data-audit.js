/* 路线详情页（route-detail）开发前数据核验
 * 目的：确认 59 部口径、三条路线的真实条目数、以及设计稿要求的字段是否存在。
 * 运行：node workspace/rd-data-audit.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const H5 = path.join(__dirname, '..', 'h5');
const FILES = [
  'movies.js', 'upcoming.js', 'relations.js', 'routes.js', 'characters.js',
  'series.js', 'special.js', 'short.js', 'content.js', 'posters.js',
  'stills.js', 'visuals.js'
];

const sandbox = { window: {}, console, URLSearchParams, Date, Math, JSON, Promise };
sandbox.window.localStorage = { getItem: () => null, setItem: () => {} };
vm.createContext(sandbox);

FILES.forEach(f => {
  const code = fs.readFileSync(path.join(H5, 'data', f), 'utf8');
  vm.runInContext(code, sandbox, { filename: 'data/' + f });
});

const w = sandbox.window;
const CONTENT = w.MCU_CONTENT || [];
const ROUTES = w.MCU_ROUTES || [];

const byId = {};
CONTENT.forEach(c => byId[c.id] = c);

const counts = { movie: 0, series: 0, special: 0, short: 0 };
CONTENT.forEach(c => { if (counts[c.type] != null) counts[c.type]++; });

console.log('=== 内容总数与分类 ===');
console.log('总计', CONTENT.length, JSON.stringify(counts));
console.log('（设计稿释意 7 特别内容 = 2 特别篇 + 5 短片）特别篇', counts.special, '短片', counts.short);

console.log('\n=== 阶段分布 ===');
const ph = {};
CONTENT.forEach(c => { ph[c.phase] = (ph[c.phase] || 0) + 1; });
console.log(JSON.stringify(ph));

console.log('\n=== 字段清单（content 条目并集）===');
const fieldSet = {};
CONTENT.forEach(c => Object.keys(c).forEach(k => fieldSet[k] = (fieldSet[k] || 0) + 1));
console.log(Object.keys(fieldSet).sort().map(k => k + ':' + fieldSet[k]).join('  '));

console.log('\n=== 是否存在时长/片长类字段 ===');
console.log(Object.keys(fieldSet).filter(k => /dur|runtime|length|min/i.test(k)).join(',') || '（无）');

console.log('\n=== 三条路线实际条目 ===');
['newcomer', 'release', 'chrono'].forEach(id => {
  const r = ROUTES.find(x => x.id === id);
  if (!r) { console.log(id, '路线不存在'); return; }
  let list = [];
  if (r.items && r.items.length) list = r.items.map(i => byId[i]).filter(Boolean);
  else if (r.generator === 'release') list = CONTENT.slice().sort((a, b) => a.ro - b.ro);
  else if (r.generator === 'chrono') list = CONTENT.slice().sort((a, b) => a.co - b.co);
  const c = { movie: 0, series: 0, special: 0, short: 0 };
  list.forEach(x => { if (c[x.type] != null) c[x.type]++; });
  const phases = Array.from(new Set(list.map(x => x.phase))).sort();
  console.log(id, '| 条目', list.length, '|', JSON.stringify(c),
    '| 覆盖阶段', phases.join(','), '| 首部', list[0] && list[0].cn, '| 末部', list[list.length - 1] && list[list.length - 1].cn);
});

console.log('\n=== 三条路线元信息字段 ===');
['newcomer', 'release', 'chrono'].forEach(id => {
  const r = ROUTES.find(x => x.id === id);
  console.log(id, '| name:', r.name, '| tagline:', r.tagline, '| forWho:', r.forWho, '| note:', r.note ? '有' : '无');
});

console.log('\n=== newcomer 手写顺序前 6 部 ===');
ROUTES.find(r => r.id === 'newcomer').items.slice(0, 6).forEach((i, n) => {
  const m = byId[i];
  console.log(' ', n + 1, i, m ? m.cn + ' / ' + m.date + ' / P' + m.phase : '(缺失)');
});
