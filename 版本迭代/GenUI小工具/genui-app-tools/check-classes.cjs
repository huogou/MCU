/** 视觉集成后自检：类名就位与旧类清除情况 */
const fs = require('fs');
const path = require('path');
const INDEX = path.resolve(__dirname, '..', 'genui-app', 'index.html');
const html = fs.readFileSync(INDEX, 'utf8');
const css = (html.match(/<style>([\s\S]*?)<\/style>/) || ['', ''])[1];

function count(sel) {
  return css.split('.' + sel).length - 1;
}

console.log('=== 操作区样式（应保留，属 .mcu-* 但在操作区）===');
['mcu-route-picker', 'mcu-route-chip', 'mcu-operate-row'].forEach(function (k) {
  const n = count(k);
  console.log('  .' + k.padEnd(20) + n + ' 处 ' + (n > 0 ? '✔' : '✘ 缺失'));
});

console.log('\n=== 新设计稿类是否就位 ===');
const NEW = ['mcu-route-canvas', 'mcu-route-header', 'mcu-route-eyebrow', 'mcu-route-title',
  'mcu-route-subtitle', 'mcu-route-stats', 'mcu-stat-pill', 'mcu-timeline', 'mcu-tl-item',
  'mcu-tl-node', 'mcu-tl-content', 'mcu-tl-name', 'mcu-tl-year', 'mcu-phase-dot',
  'mcu-tl-phase', 'mcu-tl-note', 'mcu-route-footer', 'mcu-film-card', 'mcu-archive',
  'mcu-archive-header', 'mcu-archive-no', 'mcu-archive-visual', 'mcu-archive-mark',
  'mcu-archive-roman', 'mcu-archive-film-icon', 'mcu-archive-poster', 'mcu-archive-body',
  'mcu-archive-title', 'mcu-archive-desc', 'mcu-archive-tag', 'mcu-discover-canvas',
  'mcu-discover-header', 'mcu-discover-badge', 'mcu-discover-card', 'mcu-discover-hero',
  'mcu-discover-hero-roman', 'mcu-discover-phase-tag', 'mcu-discover-body',
  'mcu-discover-title', 'mcu-discover-meta', 'mcu-discover-reason',
  'mcu-discover-reason-text', 'mcu-discover-foot'];
let missing = 0;
NEW.forEach(function (k) {
  const n = count(k);
  if (n === 0) { missing++; }
  console.log('  .' + k.padEnd(28) + n + ' 处 ' + (n > 0 ? '✔' : '✘ 缺失'));
});

console.log('\n=== 旧类清除情况 ===');
const OLD = ['mcu-canvas', 'mcu-route-head', 'mcu-route-name', 'mcu-route-tagline',
  'mcu-route-meta', 'mcu-chip', 'mcu-route-list', 'mcu-step', 'mcu-step-no',
  'mcu-step-core', 'mcu-step-side', 'mcu-step-main', 'mcu-step-title', 'mcu-step-cn',
  'mcu-step-year', 'mcu-step-role', 'mcu-random', 'mcu-random-hero', 'mcu-poster',
  'mcu-fallback', 'mcu-fallback-mark', 'mcu-fallback-cn', 'mcu-fallback-year',
  'mcu-random-body', 'mcu-random-title', 'mcu-random-meta', 'mcu-random-sf',
  'mcu-random-why'];
OLD.forEach(function (k) {
  // 精确匹配：CSS 中 .k 后须为非字母数字连字符；JS 中须为完整 class="k" 或 'k' 字符串
  const cssRe = new RegExp('\\.' + k.replace(/-/g, '\\-') + '(?![a-z0-9_-])');
  const jsRe = new RegExp('class="[^"]*\\b' + k.replace(/-/g, '\\-') + '(?![a-z0-9_-])[^"]*"');
  const inCss = cssRe.test(css);
  const inJs = jsRe.test(html);
  if (inCss || inJs) {
    console.log('  ✘ ' + k + ' 残留：样式=' + (inCss ? '有' : '无') + ' JS=' + (inJs ? '有' : '无'));
    missing++;
  }
});

console.log('\n' + (missing === 0
  ? '*** 类名核对通过：新类齐备，旧类已清 ***'
  : '*** ' + missing + ' 处需处理 ***'));
