/* D12 视觉债清理：wxss 硬编码色 → app.wxss Token（值不变，零视觉变化） */
const fs = require('fs'), path = require('path');
const MAP = [
  ['rgba(233,169,59,0.60)', 'var(--gold-a60)'],
  ['rgba(233,169,59,0.6)',  'var(--gold-a60)'],
  ['rgba(233,169,59,0.55)', 'var(--gold-a55)'],
  ['rgba(233,169,59,0.50)', 'var(--gold-a50)'],
  ['rgba(233,169,59,0.5)',  'var(--gold-a50)'],
  ['rgba(233,169,59,0.30)', 'var(--gold-a30)'],
  ['rgba(233,169,59,0.3)',  'var(--gold-a30)'],
  ['rgba(233,169,59,0.20)', 'var(--gold-a20)'],
  ['rgba(233,169,59,0.2)',  'var(--gold-a20)'],
  ['rgba(233,169,59,0.15)', 'var(--gold-a15)'],
  ['rgba(233,169,59,0.14)', 'var(--gold-a14)'],
  ['rgba(233,169,59,0.12)', 'var(--gold-a12)'],
  ['rgba(233,169,59,0.10)', 'var(--gold-a10)'],
  ['rgba(233,169,59,0.1)',  'var(--gold-a10)'],
  ['rgba(233,169,59,0.08)', 'var(--gold-a08)'],
  ['rgba(233,169,59,0.06)', 'var(--gold-a06)'],
  ['rgba(233,169,59,0.04)', 'var(--gold-a04)'],
  ['rgba(233,169,59,0.03)', 'var(--gold-a03)'],
  ['rgba(233,169,59,0.02)', 'var(--gold-a02)'],
  ['rgba(63,185,138,0.30)', 'var(--success-a30)'],
  ['rgba(63,185,138,0.3)',  'var(--success-a30)'],
  ['rgba(63,185,138,0.20)', 'var(--success-a20)'],
  ['rgba(63,185,138,0.2)',  'var(--success-a20)'],
  ['rgba(63,185,138,0.15)', 'var(--success-a15)'],
  ['rgba(63,185,138,0.10)', 'var(--success-a10)'],
  ['rgba(63,185,138,0.1)',  'var(--success-a10)'],
  ['rgba(63,185,138,0.08)', 'var(--success-a08)'],
  ['rgba(229,96,77,0.15)',  'var(--error-a15)'],
  ['rgba(255,255,255,0.70)', 'var(--white-a70)'],
  ['rgba(255,255,255,0.7)',  'var(--white-a70)'],
  ['rgba(255,255,255,0.60)', 'var(--white-a60)'],
  ['rgba(255,255,255,0.6)',  'var(--white-a60)'],
  ['rgba(255,255,255,0.50)', 'var(--white-a50)'],
  ['rgba(255,255,255,0.12)', 'var(--white-a12)'],
  ['rgba(255,255,255,0.08)', 'var(--white-a08)'],
  ['#fff',                    'var(--white)'],
  ['#FFFFFF',                 'var(--white)'],
  ['#ffffff',                 'var(--white)'],
  ['rgba(11,14,20,0.70)',    'var(--bg-a70)'],
  ['rgba(11,14,20,0.55)',    'var(--bg-a55)'],
  ['rgba(0,0,0,0.35)',       'var(--black-a35)'],
  ['rgba(91,141,239,0.6)',  'var(--p1-a60)'],
  ['rgba(40,180,135,0.6)',  'var(--p2-a60)'],
  ['rgba(40,180,135,0.15)', 'var(--p2-a15)'],
  ['rgba(240,169,50,0.6)',  'var(--p3-a60)'],
  ['rgba(139,111,232,0.6)', 'var(--p4-a60)'],
  ['rgba(232,72,63,0.6)',   'var(--p5-a60)'],
  ['rgba(194,91,142,0.6)',  'var(--p6-a60)'],
  ['#1A1206',                'var(--gold-btn-text)'],
  ['#1a1206',                'var(--gold-btn-text)']
];
const files = fs.readdirSync('pages', { withFileTypes: true })
  .filter(d => d.isDirectory())
  .flatMap(d => fs.readdirSync(path.join('pages', d.name)).filter(f => f.endsWith('.wxss')).map(f => path.join('pages', d.name, f)));
let total = 0;
for (const file of files) {
  let src = fs.readFileSync(file, 'utf8');
  let cnt = 0;
  for (const [from, to] of MAP) {
    const re = new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    const m = src.match(re); if (m) cnt += m.length;
    src = src.split(from).join(to);
  }
  if (cnt) { fs.writeFileSync(file, src); total += cnt; console.log('  ' + file + ' : ' + cnt + ' 处替换'); }
}
console.log('共替换 ' + total + ' 处');
