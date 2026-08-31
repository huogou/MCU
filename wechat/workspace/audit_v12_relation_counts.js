/* ============================================================
 * V1.2 关系探索 —— 每角色关系数分布核查（只读）
 * ------------------------------------------------------------
 * 目的：给设计 AI 提供准确的「关系卡片 / Canvas 节点」数量口径，
 *       避免设计出 N 个节点但真实数据只有 M 个（M<N）的方案。
 * 方法：完全复用 explore.js 的派生规则（SPECIAL 优先 → 同阵营 ally
 *       → 跨阵营共演≥2 = rival → 其余 null），逐角色统计。
 * 不修改任何文件；不引入第二套数据。
 * ============================================================ */

const P = __dirname + '/../';
const mcuData = require(P + 'models/mcuData.js');
const { CHARACTERS } = require(P + 'data/characters.js');
const visuals = require(P + 'data/visuals.js');

const SPECIAL_RELATIONS = [
  { from: 'tony', to: 'peter', type: 'mentor' },
  { from: 'tony', to: 'steve', type: 'ally' },
  { from: 'thor', to: 'loki', type: 'family' },
  { from: 'steve', to: 'bucky', type: 'family' },
  { from: 'natasha', to: 'clint', type: 'family' },
  { from: 'wanda', to: 'vision', type: 'family' },
  { from: 'tony', to: 'thanos', type: 'enemy' },
  { from: 'thanos', to: 'gamora', type: 'family' },
  { from: 'strange', to: 'wanda', type: 'ally' },
  { from: 'wade', to: 'logan', type: 'rival' },
  { from: 'tchalla', to: 'starlord', type: 'ally' },
  { from: 'tony', to: 'fury', type: 'ally' },
  { from: 'tony', to: 'tchalla', type: 'ally' },
  { from: 'tony', to: 'natasha', type: 'ally' },
  { from: 'tony', to: 'thor', type: 'ally' },
  { from: 'steve', to: 'tchalla', type: 'ally' },
  { from: 'steve', to: 'natasha', type: 'ally' },
  { from: 'steve', to: 'thor', type: 'ally' },
  { from: 'tony', to: 'clint', type: 'ally' }
];
const specialMap = {};
SPECIAL_RELATIONS.forEach(function (p) {
  specialMap[p.from + '|' + p.to] = p.type;
  specialMap[p.to + '|' + p.from] = p.type;
});

function coCount(aId, bId) {
  const fa = mcuData.filmsOfChar(aId);
  const fb = mcuData.filmsOfChar(bId);
  if (!fa.length || !fb.length) return 0;
  const setB = {};
  fb.forEach(function (f) { setB[f.id] = true; });
  return fa.filter(function (f) { return setB[f.id]; }).length;
}
function relationOf(a, b) {
  const pre = specialMap[a + '|' + b];
  if (pre) return pre;
  const ca = mcuData.getChar(a), cb = mcuData.getChar(b);
  if (!ca || !cb) return null;
  if (ca.camp === cb.camp) return 'ally';
  if (coCount(a, b) >= 2) return 'rival';
  return null;
}
function heroOf(cn) {
  if (!cn) return '';
  const parts = cn.split(' / ');
  return (parts.length > 1 ? parts[1] : cn).trim();
}

const rows = [];
const typeTotal = {};
CHARACTERS.forEach(function (c) {
  const out = [];
  CHARACTERS.forEach(function (o) {
    if (o.id === c.id) return;
    const t = relationOf(c.id, o.id);
    if (!t) return;
    out.push({ id: o.id, type: t, shared: coCount(c.id, o.id) });
    typeTotal[t] = (typeTotal[t] || 0) + 1;
  });
  out.sort(function (a, b) { return b.shared - a.shared; });
  rows.push({ id: c.id, name: heroOf(c.cn), n: out.length, top: out.slice(0, 6) });
});
rows.sort(function (a, b) { return b.n - a.n; });

console.log('========== 每角色关系数分布（共 ' + CHARACTERS.length + ' 角色）==========');
console.log('角色ID        名称           关系数  前6关系(类型)');
console.log('------------------------------------------------------------------');
rows.forEach(function (r) {
  const pad = function (s, n) { s = String(s); while (s.length < n) s += ' '; return s; };
  console.log(pad(r.id, 13) + pad(r.name, 14) + pad(r.n, 7) + r.top.map(function (t) { return t.id + '(' + t.type + ')'; }).join(' '));
});

const ns = rows.map(function (r) { return r.n; });
const sum = ns.reduce(function (a, b) { return a + b; }, 0);
console.log('');
console.log('关系数  最小 =', Math.min.apply(null, ns), '｜最大 =', Math.max.apply(null, ns), '｜平均 =', (sum / ns.length).toFixed(1));
console.log('关系边总数(有向计) =', sum, '→ 去重无向 =', sum / 2);
console.log('按类型分布(有向计) =', JSON.stringify(typeTotal));
const zero = rows.filter(function (r) { return r.n === 0; });
console.log('零关系角色 =', zero.length ? zero.map(function (r) { return r.id; }).join(', ') : '（无，每个角色都有关系可展示）');
const lt3 = rows.filter(function (r) { return r.n < 3; });
console.log('关系数 <3 角色 =', lt3.length ? lt3.map(function (r) { return r.id + '(' + r.n + ')'; }).join(', ') : '（无）');

console.log('');
console.log('========== 分享海报可用背景资源（修正键名）==========');
console.log('heroBanner()  :', visuals.heroBanner());
Object.keys(visuals.entryBgs).forEach(function (k) {
  console.log('entryBg(' + k + ')'.padEnd(18) + ' : ' + visuals.entryBg(k));
});
console.log('phase(1..6)   :', [1, 2, 3, 4, 5, 6].map(function (n) { return 'P' + n + (visuals.phase(n) ? '✓' : '✗'); }).join(' '));
