/**
 * 从设计稿原文抽取 .mcu-* 规则（保持原顺序与原声明，避免手写偏差）
 * 输出：scratch/mcu-design-rules.css
 *
 * 定位上下文保护（设计 AI 复核回执第 3 节）：
 *   本脚本按原文整条保留声明，不做属性删减；真正需要防丢失的是
 *   下游 apply-design-css.cjs 的替换环节——那里只允许覆盖
 *   HEIGHT_OVERRIDE 中的高度属性，position/overflow/z-index/inset/
 *   top/right/bottom/left 一律原样保留。详见 apply-design-css.cjs。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'docs', '产品', 'GenUI-MCU观影助手-画布视觉设计V1.0.html');
const OUT = path.join(ROOT, 'scratch', 'mcu-design-rules.css');

const PROTECTED_PROPERTIES = [
  'position', 'overflow', 'z-index', 'inset', 'top', 'right', 'bottom', 'left'
];

const html = fs.readFileSync(SRC, 'utf8');
const styles = [];
const re = /<style[^>]*>([\s\S]*?)<\/style>/g;
let m;
while ((m = re.exec(html)) !== null) styles.push(m[1]);
const css = styles.join('\n');

const out = [];
const rr = /([^{}]+)\{([^{}]*)\}/g;
let r;
while ((r = rr.exec(css)) !== null) {
  const sel = r[1].trim().replace(/\s+/g, ' ');
  if (sel.indexOf('.mcu-') < 0) continue;
  const body = r[2].replace(/\s+/g, ' ').trim().replace(/; /g, ';\n    ');
  out.push(sel + ' {\n    ' + body + '\n}');
}

fs.writeFileSync(OUT, out.join('\n\n'), 'utf8');
console.log('抽取规则数: ' + out.length);
console.log('输出: ' + OUT + '  (' + Math.round(fs.statSync(OUT).size / 1024) + ' KB)');

/* 抽取后校验：保护属性不得丢失（相对设计稿原文） */
let lost = 0;
PROTECTED_PROPERTIES.forEach(function (p) {
  const inSrc = new RegExp('(^|;|\\s)' + p + '\\s*:', 'i').test(css);
  const inOut = new RegExp('(^|;|\\s)' + p + '\\s*:', 'i').test(out.join('\n'));
  if (inSrc && !inOut) {
    console.log('  [error] 保护属性丢失: ' + p);
    lost++;
  }
});
console.log(lost === 0
  ? '保护属性校验通过：position/overflow/z-index/inset/top/right/bottom/left 均在'
  : '*** ' + lost + ' 个保护属性丢失 ***');
