/* 视觉统一规范审计（V1.1 上线前 · 第二部分） */
const fs = require('fs');
const pages = fs.readdirSync('pages').filter(d => fs.statSync('pages/' + d).isDirectory());
console.log('页面 | 背景Token | surface-2卡片 | 金色CTA | 裸hex | 裸rgba');
pages.forEach(p => {
  const f = 'pages/' + p + '/' + p + '.wxss';
  if (!fs.existsSync(f)) return;
  const s = fs.readFileSync(f, 'utf8');
  const hexes = s.match(/#[0-9a-fA-F]{3,8}/g) || [];
  const rgs = s.match(/rgba?\(/g) || [];
  console.log('  ' + p.padEnd(12) +
    ' | ' + (/background:\s*var\(--bg\)/.test(s) ? '✓' : '✗') +
    ' | ' + (/var\(--surface-2\)/.test(s) ? '✓' : '✗') +
    ' | ' + (/var\(--gold\)/.test(s) ? '✓' : '✗') +
    ' | ' + hexes.length + ' | ' + rgs.length);
});
