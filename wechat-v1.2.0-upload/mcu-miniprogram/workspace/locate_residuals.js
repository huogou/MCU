/* 定位残留 hex/500/800（含上下文） */
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

wxssFiles.forEach(function (f) {
  const s = fs.readFileSync(f, 'utf8');
  const rel = f.replace(pagesDir + '/', '');
  const h = (s.match(/#[0-9A-Fa-f]{3,8}/g) || []);
  const w5 = (s.match(/font-weight:\s*500/g) || []);
  const w8 = (s.match(/font-weight:\s*800/g) || []);
  if (!h.length && !w5.length && !w8.length) return;
  console.log('==', rel, '==');
  h.forEach(function (x) {
    const i = s.indexOf(x);
    console.log('  hex:', x, '→', s.slice(Math.max(0, i - 70), i + 30).replace(/\n/g, ' '));
  });
  w5.forEach(function (x) {
    const i = s.indexOf(x);
    console.log('  500:', '→', s.slice(Math.max(0, i - 70), i + 30).replace(/\n/g, ' '));
  });
  w8.forEach(function (x) {
    const i = s.indexOf(x);
    console.log('  800:', '→', s.slice(Math.max(0, i - 70), i + 30).replace(/\n/g, ' '));
  });
});
