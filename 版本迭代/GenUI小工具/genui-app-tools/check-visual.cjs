/** 视觉集成后自检：设计稿类名与 HTML 结构对齐、token 纪律 */
const fs = require('fs');
const path = require('path');
const INDEX = path.resolve(__dirname, '..', 'genui-app', 'index.html');
const html = fs.readFileSync(INDEX, 'utf8');
const css = (html.match(/<style>([\s\S]*?)<\/style>/) || ['', ''])[1];
const body = html.replace(/<style[\s\S]*?<\/style>/g, '');

console.log('=== 1. CSS 完整性 ===');
const open = (css.match(/\{/g) || []).length;
const close = (css.match(/\}/g) || []).length;
console.log('花括号: { ' + open + ' / } ' + close + (open === close ? '  平衡 OK' : '  *** 不平衡 ***'));

/* 2. token 纪律 */
const nc = css.replace(/\/\*[\s\S]*?\*\//g, '');
console.log('\n=== 2. Token 纪律 ===');
const cosDefine = nc.match(/[^{}]*\{[^{}]*--cos-[a-z0-9-]+\s*:/gi);
console.log((cosDefine ? '  [X] 定义了 --cos-*：' + cosDefine[0].trim().slice(0, 60) : '  [OK] 未定义任何 --cos-*'));
const rootMcu = nc.match(/:root\s*\{[^}]*--mcu-/i);
console.log((rootMcu ? '  [X] :root 中声明了 --mcu-*（应仅在 .mcu-* 作用域）' : '  [OK] :root 干净'));
const mcuBlocks = nc.match(/[^{}]*\{[^{}]*--mcu-[a-z0-9-]+\s*:/gi) || [];
const badScope = mcuBlocks.filter(function (x) {
  return x.split('{')[0].trim().indexOf('.mcu-') !== 0;
});
console.log((badScope.length
  ? '  [X] --mcu-* 越界：' + badScope[0].split('{')[0].trim()
  : '  [OK] --mcu-* 全在 .mcu-* 作用域（' + mcuBlocks.length + ' 处）'));

/* 3. 设计稿类名覆盖 */
const DESIGN = ['mcu-route-canvas', 'mcu-route-header', 'mcu-route-eyebrow', 'mcu-route-title',
  'mcu-route-subtitle', 'mcu-route-stats', 'mcu-stat-pill', 'mcu-timeline', 'mcu-tl-item',
  'mcu-tl-node', 'mcu-tl-content', 'mcu-tl-name', 'mcu-tl-year', 'mcu-phase-dot',
  'mcu-tl-phase', 'mcu-tl-note', 'mcu-route-footer', 'mcu-route-footer-icon',
  'mcu-route-footer-text', 'mcu-film-card', 'mcu-archive', 'mcu-archive-header',
  'mcu-archive-no', 'mcu-archive-label', 'mcu-archive-visual', 'mcu-archive-mark',
  'mcu-archive-roman', 'mcu-archive-film-icon', 'mcu-archive-short', 'mcu-archive-poster',
  'mcu-archive-poster-title', 'mcu-archive-body', 'mcu-archive-title',
  'mcu-archive-meta-row', 'mcu-archive-meta-item', 'mcu-archive-divider',
  'mcu-archive-desc', 'mcu-archive-footer', 'mcu-archive-tag', 'mcu-discover-canvas',
  'mcu-discover-card', 'mcu-discover-hero',
  'mcu-discover-hero-poster', 'mcu-discover-hero-overlay', 'mcu-discover-hero-roman',
  'mcu-discover-phase-tag', 'mcu-discover-body', 'mcu-discover-title', 'mcu-discover-meta',
  'mcu-discover-meta-item', 'mcu-discover-hero-title', 'mcu-discover-reason',
  'mcu-discover-reason-label', 'mcu-discover-reason-text', 'mcu-discover-foot',
  'mcu-discover-foot-left', 'mcu-discover-foot-icon', 'mcu-discover-foot-text',
  'mcu-discover-foot-right'];
/* V1.1：徽章行（header/badge/date）已按指令移除，不在必检清单内 */
/* V1.1 已按设计指令移除「今日发现」徽章行（含 badge/date），
   以把 33px 空间归还海报区。故这些类不再作为必检项。 */
console.log('\n=== 3. 设计稿类名覆盖（样式侧）===');
const missCss = DESIGN.filter(function (k) { return css.indexOf('.' + k) < 0; });
console.log((missCss.length ? '  [X] 样式缺失：' + missCss.join(', ') : '  [OK] ' + DESIGN.length + ' 个类全部就位'));

/* 4. HTML 结构是否用到关键元素 */
console.log('\n=== 4. 渲染模板结构（JS 侧）===');
const TPL = [
  ['mcu-route-eyebrow', /mcu-route-eyebrow/],
  ['mcu-route-title', /mcu-route-title/],
  ['mcu-route-subtitle', /mcu-route-subtitle/],
  ['mcu-route-stats', /mcu-route-stats/],
  ['mcu-tl-node（编号）', /mcu-tl-node/],
  ['mcu-phase-dot（阶段色点）', /mcu-phase-dot/],
  ['mcu-tl-note（推荐理由）', /mcu-tl-note/],
  ['mcu-route-footer', /mcu-route-footer/],
  ['mcu-archive-label（FILM ARCHIVE）', /mcu-archive-label/],
  ['mcu-archive-no（MCU-0xx）', /mcu-archive-no/],
  ['mcu-archive-meta-row', /mcu-archive-meta-row/],
  ['mcu-archive-short（英文简称）', /mcu-archive-short/],
  ['mcu-archive-divider', /mcu-archive-divider/],
  ['mcu-archive-footer（标签区）', /mcu-archive-footer/],
  ['mcu-discover-meta-item', /mcu-discover-meta-item/],
  /* 反向校验：徽章行按 V1.1 已移除，此处标记为「不应出现」 */
  ['徽章行已移除（V1.1）', /class="mcu-discover-header"/, true],
  ['mcu-discover-hero-title（V1.1 海报片名层）', /mcu-discover-hero-title/],
  ['mcu-discover-foot-left', /mcu-discover-foot-left/],
  ['mcu-discover-foot-right', /mcu-discover-foot-right/],
  ['mcu-discover-foot 可点入口（V1.1 方案A）', /id="mcu-discover-foot"/],
  ['phase-N 修饰类', /phase-['"]?\s*\+|phase-'\s*\+/],
  ['core 修饰类', /'core'|"core"/],
  ['side 修饰类', /'side'|"side"/]
];
const missTpl = [];
TPL.forEach(function (t) {
  const found = t[1].test(body);
  /* t[2] 为 true 表示该项「不应出现」 */
  const shouldAbsent = t.length > 2 && t[2] === true;
  const ok = shouldAbsent ? !found : found;
  console.log('  ' + (ok ? '[OK] ' : '[X]  ') + t[0]);
  if (!ok) missTpl.push(t[0]);
});

/* 5. 旧类是否清除 */
console.log('\n=== 5. 旧类清除 ===');
const OLD = ['mcu-canvas', 'mcu-route-head', 'mcu-route-name', 'mcu-route-tagline',
  'mcu-route-meta', 'mcu-chip', 'mcu-route-list', 'mcu-step', 'mcu-step-no',
  'mcu-step-core', 'mcu-step-side', 'mcu-step-main', 'mcu-step-title', 'mcu-step-cn',
  'mcu-step-year', 'mcu-step-role', 'mcu-random', 'mcu-random-hero', 'mcu-poster',
  'mcu-fallback', 'mcu-fallback-mark', 'mcu-fallback-cn', 'mcu-fallback-year',
  'mcu-random-body', 'mcu-random-title', 'mcu-random-meta', 'mcu-random-sf',
  'mcu-random-why', 'mcu-route-topline', 'mcu-route-mainline'];
const left = OLD.filter(function (k) {
  const re = new RegExp('\\.' + k.replace(/[-.]/g, '\\$&') + '(?![a-z0-9_-])');
  const reJs = new RegExp('class="[^"]*\\b' + k.replace(/-/g, '\\-') + '(?![a-z0-9_-])[^"]*"');
  return re.test(css) || reJs.test(body);
});
console.log((left.length ? '  [X] 残留：' + left.join(', ') : '  [OK] 旧类已全部清除'));

/* 6. 外壳冻结 */
console.log('\n=== 6. 外壳冻结校验 ===');
const SHELL = [
  ['padding-top:100%', /\.vc-component-wrapper\s*\{[^}]*padding-top:\s*100%/],
  ['absolute + inset:0', /\.vc-component-container\s*\{[^}]*position:\s*absolute[^}]*inset:\s*0/],
  ['表头 45px', /\.vc-component-header\s*\{[^}]*height:\s*45px/],
  ['body 清零', /body\s*\{[^}]*margin:\s*0[^}]*padding:\s*0/],
  ['Tabs 官方类', /\.vc-tabs-segmented/],
  ['按钮官方类', /\.vc-button-plain/],
  ['cos-icon', /\.cos-icon\s*\{/],
  ['打点接口', /window\.genui && typeof window\.genui\.sendLog === 'function'/]
];
let bad = 0;
SHELL.forEach(function (s) {
  const ok = s[1].test(css) || s[1].test(html);
  console.log('  ' + (ok ? '[OK] ' : '[X]  ') + s[0]);
  if (!ok) bad++;
});

const total = missCss.length + missTpl.length + left.length + bad;
console.log('\n' + (total === 0
  ? '*** 视觉集成自检全部通过 ***'
  : '*** ' + total + ' 处需处理 ***'));
process.exit(total === 0 ? 0 : 1);
