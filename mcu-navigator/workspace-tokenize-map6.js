/* D12 视觉债清理 · H5 map.html v6 终版：整体重写 :root 块（修正自引用 + 补齐缺失变量） */
const fs = require('fs');
let src = fs.readFileSync('map.html', 'utf8');

const ROOT = `:root{
  /* ===== D12 视觉债清理（2026-08-24）：值=原色视觉零变化；阶段色统一 var(--p1..--p6） ===== */
  --panel:#111827; --panel-2:#171f31;
  --gold-border:rgba(233,169,59,.22); --gold-dim:#f4c86a;
  --pano-bg:#080c14;
  --pano-bg-97:rgba(8,12,20,.97); --pano-bg-85:rgba(8,12,20,.85); --pano-bg-95:rgba(8,12,20,.95);
  --pano-text-2:#D5DCE6;
  --pano-year:#5a6270;
  --pano-card-year:#6a7380;
  --pano-close:#aaa;
  --pano-thumb-bg:#1b2638;
  --poster-bg:#151c28;
  --poster-dark:#0d121b;
  --cross:#9b6dff;
  --avatar-a:#a9344a; --avatar-b:#224c86;
  --status-green:#32B792; --status-green-a24:rgba(50,183,146,.24); --status-green-a08:rgba(50,183,146,.08);
  --upcoming-gold:#f0b65e; --upcoming-gold-a24:rgba(240,182,94,.24); --upcoming-gold-a08:rgba(240,182,94,.08);
  --gold-btn-text:#1a1408;
  --gold-a08:rgba(233,169,59,.08); --gold-a10:rgba(233,169,59,.1); --gold-a12:rgba(233,169,59,.12);
  --gold-a18:rgba(233,169,59,.18); --gold-a30:rgba(233,169,59,.3); --gold-a40:rgba(233,169,59,.4);
  --gold-a70:rgba(233,169,59,.7); --gold-a80:rgba(233,169,59,.8);
  --golddim-a60:rgba(244,200,106,.6); --golddim-a40:rgba(244,200,106,.4);
  --cross-a08:rgba(155,109,255,.08); --cross-a18:rgba(155,109,255,.18); --cross-a40:rgba(155,109,255,.4);
  --white-a03:rgba(255,255,255,.03); --white-a04:rgba(255,255,255,.04); --white-a06:rgba(255,255,255,.06);
  --white-a08:rgba(255,255,255,.08); --white-a10:rgba(255,255,255,.1); --white-a12:rgba(255,255,255,.12);
  --white-a15:rgba(255,255,255,.15); --white-a25:rgba(255,255,255,.25); --white-a70:rgba(255,255,255,.7);
  --bg-50:rgba(11,14,20,.5); --bg-85:rgba(11,14,20,.85); --bg-97:rgba(11,14,20,.97);
  --black-a30:rgba(0,0,0,.3);
  --hero-grad-a:#141a26; --hero-grad-b:#0e1520; --hero-grad-c:#1e1a10;
  --pano-grad-a:#151c2a; --pano-grad-b:#1a1520; --pano-grad-c:#1c1810;
  --p1-a30:rgba(91,141,239,.3); --p2-a30:rgba(40,180,135,.3);
  --p3-a30:rgba(240,169,50,.3); --p4-a30:rgba(139,111,232,.3);
  --p5-a30:rgba(232,72,63,.3);  --p6-a30:rgba(194,91,142,.3);
}`;

const before = src;
src = src.replace(/:root\{[^}]*\}/, ROOT);
if (src !== before) console.log('✓ :root 整体重写成功');
else console.log('✗ :root 未匹配');
fs.writeFileSync('map.html', src);

/* 校验：所有 var() 引用都有定义 */
const defs = new Set();
for (const m of src.matchAll(/--([a-z0-9-]+):/g)) defs.add(m[1]);
const used = new Set();
for (const m of src.matchAll(/var\(--([a-z0-9-]+)/g)) used.add(m[1]);
const missing = [...used].filter(t => !defs.has(t));
console.log('定义 ' + defs.size + ' / 引用 ' + used.size + (missing.length ? ('，缺失: ' + missing.join(',')) : '，全部有定义 ✓'));

/* 裸色残留检查（排除 :root 定义行与注释） */
const residual = [];
src.split('\n').forEach(function (line, i) {
  const t = line.trim();
  if (t.indexOf(':root') === 0 || /^--[a-z0-9-]+:/.test(t) || t.indexOf('/*') === 0 || t.indexOf('*') === 0) return;
  const body = line.replace(/var\(--[a-z0-9-]+(,[^)]*)?\)/g, 'V');
  if (/#[0-9a-fA-F]{3,8}/.test(body) || /rgba?\([^)]*\)/.test(body)) residual.push((i + 1) + ': ' + t.slice(0, 120));
});
console.log(residual.length ? '裸色残留:\n  ' + residual.join('\n  ') : '✓ map.html 规则区无裸色');
