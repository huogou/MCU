/* Step5 全局视觉检查：12 页 wxss 零裸hex/零500/零800 + 可映射间距残留 */
const fs = require('fs');
const path = require('path');
const pagesDir = path.resolve(__dirname, '../pages');

const wxssFiles = [];
(function walk(d) {
  fs.readdirSync(d).forEach(function (f) {
    const p = path.join(d, f);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (f.endsWith('.wxss')) wxssFiles.push(p);
  });
})(pagesDir);

let totalHex = 0, total500 = 0, total800 = 0;
wxssFiles.forEach(function (f) {
  const s = fs.readFileSync(f, 'utf8');
  const h = (s.match(/#[0-9A-Fa-f]{3,8}/g) || []).length;
  const w5 = (s.match(/font-weight:\s*500/g) || []).length;
  const w8 = (s.match(/font-weight:\s*800/g) || []).length;
  totalHex += h; total500 += w5; total800 += w8;
  if (h || w5 || w8) console.log('  ⚠', f.split('/pages/')[1], 'hex=' + h, 'w500=' + w5, 'w800=' + w8);
});
console.log('=== Step5 全局审计（' + wxssFiles.length + ' 个 wxss）===');
console.log('裸 hex 总数:', totalHex, '(期望 0)');
console.log('font-weight:500 总数:', total500, '(期望 0)');
console.log('font-weight:800 总数:', total800, '(期望 0)');

/* 可映射间距残留：padding/margin/gap 行内含 8/20/28/56/72rpx 值 */
const re = /(?:padding|margin|gap)(?:-[a-z]+)?:\s*[^;]*\b(?:8|20|28|56|72)rpx/g;
const leftover = [];
wxssFiles.forEach(function (f) {
  const s = fs.readFileSync(f, 'utf8');
  const mm = s.match(re);
  if (mm) mm.forEach(function (x) { leftover.push(f.split('/pages/')[1] + ': ' + x.trim()); });
});
console.log('可映射间距残留:', leftover.length);
leftover.slice(0, 8).forEach(function (x) { console.log('  ', x); });
