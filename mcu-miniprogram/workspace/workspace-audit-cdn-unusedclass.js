/* V1.2 上线前 · CDN 资源全量核验 + 页面级未使用 class 扫描（只读，2026-08-27） */
const fs = require('fs');
const path = require('path');
const ROOT = process.cwd();

/* ── 1. CDN 全量核验 ── */
(async () => {
  const v = require(path.join(ROOT, 'data', 'visuals.js'));
  const urls = new Set();
  Object.values(v.posters || {}).forEach(u => urls.add(u));
  Object.values(v.stills || {}).forEach(u => urls.add(u));
  Object.values(v.avatars || {}).forEach(u => urls.add(u));
  Object.values(v.phases || {}).forEach(u => urls.add(u));
  Object.values(v.entryBgs || {}).forEach(u => urls.add(u));
  if (v.heroBanner) urls.add(v.heroBanner());
  const list = [...urls];
  console.log('=== CDN 资源全量核验（共 ' + list.length + ' 个 URL）===');
  let ok = 0, fail = 0;
  const fails = [];
  for (const u of list) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 6000);
      const res = await fetch(u, { method: 'HEAD', signal: ctrl.signal });
      clearTimeout(t);
      if (res.status === 200) ok++;
      else { fail++; fails.push(res.status + ' ' + u); }
    } catch (e) { fail++; fails.push('ERR ' + u + ' ' + e.message.slice(0, 40)); }
  }
  console.log('  200 = ' + ok + ' / 失败 = ' + fail);
  fails.slice(0, 10).forEach(f => console.log('  ✗ ' + f));
  if (!fail) console.log('  ✓ CDN 111 张全部线上可访问');
})().catch(e => console.error('CDN 核验异常:', e.message));

/* ── 2. 页面级未使用 class 候选（page wxss 类 → 本页 wxml/js 引用检查）── */
function walk(dir, ext, out) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, ext, out);
    else if (e.name.endsWith(ext)) out.push(p);
  }
}
const wxmlFiles = [], wxssFiles = [];
walk(path.join(ROOT, 'pages'), '.wxml', wxmlFiles);
walk(path.join(ROOT, 'pages'), '.wxss', wxssFiles);

const pageMap = {};
wxmlFiles.forEach(f => pageMap[path.basename(f, '.wxml')] = f);
const globalUsed = new Set();
wxmlFiles.forEach(f => {
  const src = fs.readFileSync(f, 'utf8');
  for (const m of src.matchAll(/class="([^"]+)"/g)) m[1].split(/\s+/).forEach(c => globalUsed.add(c));
  const js = fs.readFileSync(f.replace('.wxml', '.js'), 'utf8');
  for (const m of js.matchAll(/['"]([\w-]+)['"]/g)) globalUsed.add(m[1]); /* js 中的字符串也可能为动态类名 */
});

console.log('\n=== 页面级未使用 class 候选（仅提示，需人工复核）===');
let n = 0;
for (const f of wxssFiles) {
  const base = path.basename(f, '.wxss');
  const wxml = pageMap[base];
  const wxmlSrc = wxml ? fs.readFileSync(wxml, 'utf8') : '';
  const jsSrc = fs.readFileSync(f.replace('.wxss', '.js'), 'utf8');
  const both = wxmlSrc + jsSrc;
  const css = fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const selRe = /\.([a-zA-Z_][\w-]*)/g;
  const seen = new Set();
  for (const m of css.matchAll(selRe)) {
    const c = m[1];
    if (seen.has(c)) continue;
    seen.add(c);
    if (both.includes(c)) continue;           /* 本页 wxml/js 有用 */
    if (globalUsed.has(c)) continue;           /* 其他页/全局用了 */
    n++;
    console.log('  [' + base + '.wxss] .' + c);
  }
}
if (!n) console.log('  ✓ 无页面级完全未用 class');
