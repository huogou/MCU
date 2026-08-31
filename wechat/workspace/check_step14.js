/* Step1-4 校验：explore 三文件 + 全局 var 引用 */
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');

const wxss = fs.readFileSync(path.join(root, 'pages/explore/explore.wxss'), 'utf8');
const wxml = fs.readFileSync(path.join(root, 'pages/explore/explore.wxml'), 'utf8');

console.log('=== explore.wxss ===');
console.log('raw_hex:', (wxss.match(/#[0-9A-Fa-f]{3,8}/g) || []).length, '(期望0)');
console.log('font-weight:500:', (wxss.match(/font-weight:\s*500/g) || []).length, '(期望0)');
console.log('font-weight:800:', (wxss.match(/font-weight:\s*800/g) || []).length, '(期望0)');
console.log('font-weight 分布:', (wxss.match(/font-weight:\s*(\d+)/g) || []).join(', '));

console.log('\n=== explore.wxml ===');
const o = (wxml.match(/\{\{/g) || []).length;
const c = (wxml.match(/\}\}/g) || []).length;
console.log('open{{:', o, 'close}}:', c, o === c ? 'BALANCED' : 'MISMATCH');
console.log('含 === 表达式:', /===/.test(wxml) ? 'YES(不合法)' : 'NO(ok)');
console.log('wx:key="key":', /wx:key="key"/.test(wxml) ? 'OK' : 'NO');
console.log('pair-char 点击跳转:', (wxml.match(/data-id="{{item\.(from|to)Id}}"/g) || []).length, '处');

/* 全局 var() 引用解析（全 pages） */
console.log('\n=== 全局 var() 引用解析 ===');
const appWxss = fs.readFileSync(path.join(root, 'app.wxss'), 'utf8');
const tokens = new Set();
const re = /--([a-z0-9-]+)\s*:/g;
let m;
while ((m = re.exec(appWxss))) tokens.add(m[1]);
const pagesDir = path.join(root, 'pages');
const allWxss = [];
(function walk(d) {
  fs.readdirSync(d).forEach(function (f) {
    const p = path.join(d, f);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (f.endsWith('.wxss')) allWxss.push(p);
  });
})(pagesDir);
let refs = 0, missing = [];
allWxss.forEach(function (p) {
  const s = fs.readFileSync(p, 'utf8');
  const rr = /var\(--([a-z0-9-]+)\)/g;
  let mm;
  while ((mm = rr.exec(s))) {
    refs++;
    if (!tokens.has(mm[1])) missing.push(p.split('/').slice(-3).join('/') + ' -> ' + mm[1]);
  }
});
console.log('var() 引用总数:', refs, '| 悬空:', missing.length);
if (missing.length) missing.slice(0, 10).forEach(x => console.log('  MISSING:', x));
