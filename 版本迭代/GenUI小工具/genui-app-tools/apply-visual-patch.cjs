/**
 * 视觉集成补丁：把已同步的画布样式规则写入 index.html 的「画布内容区」样式块
 * ------------------------------------------------------------
 * 范围：仅替换「画布内容区」样式块（.mcu-*），不动 header / cosui 组件 / Tabs / 按钮
 * 原则：
 *   1. --mcu-* token 声明在各根容器（.mcu-route-canvas / .mcu-film-card / .mcu-discover-canvas），
 *      不写入 :root，不污染全局，不修改任何 --cos-* token。
 *   2. 优先复用 cos token；仅阶段色与档案金为新增（设计稿指定）。
 *   3. 等宽字体走系统字体栈，不引入外部字体文件。
 *   4. 程序化视觉卡全部 CSS 绘制（渐变 + 伪元素），零图片依赖。
 *
 * V1.3 起变更（工具链债清理）：
 *   规则源由脚本内嵌的 V1.0 常量改为 scratch/mcu-design-header.css + scratch/mcu-design-rules.css，
 *   由 extract-design-css.cjs 从 live 产物抽取（原文逐字保留，含注释与 @keyframes）。
 *   因此本脚本在规则源与 live 同步时为「文本级幂等」：重跑不改变 live。
 *   走查顺序：extract-design-css.cjs → apply-visual-patch.cjs → apply-design-css.cjs（校验）。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const INDEX = path.join(ROOT, 'genui-app', 'index.html');
const HEADER = path.join(ROOT, 'scratch', 'mcu-design-header.css');
const RULES = path.join(ROOT, 'scratch', 'mcu-design-rules.css');

const START_RE = /\/\* =+\s*\n\s*\* 画布内容区/;
const END_RE = /\/\* =+\s*\n\s*\* 操作区 Tabs/;

if (!fs.existsSync(HEADER) || !fs.existsSync(RULES)) {
  console.error('规则源缺失，请先运行：node genui-app-tools\\extract-design-css.cjs');
  process.exit(1);
}

const html = fs.readFileSync(INDEX, 'utf8');
const header = fs.readFileSync(HEADER, 'utf8');
const rules = fs.readFileSync(RULES, 'utf8');

const s = html.match(START_RE);
const e = html.match(END_RE);
if (!s || !e) {
  console.error('未定位到画布样式块', { start: !!s, end: !!e });
  process.exit(1);
}
if (e.index <= s.index) {
  console.error('样式块边界异常', { start: s.index, end: e.index });
  process.exit(1);
}
console.log('定位到样式块：' + s.index + ' → ' + e.index + '（' + (e.index - s.index) + ' 字节）');

const after = html.slice(0, s.index) + header + rules + html.slice(e.index);

if (after === html) {
  console.log('幂等：规则源与 live 已一致，产物无变化');
} else {
  fs.writeFileSync(INDEX, after, 'utf8');
  console.log('已写入画布样式区（' + Math.round(html.length / 1024) + 'KB → ' +
    Math.round(after.length / 1024) + 'KB）');
}

/* ── 定位上下文保护校验 ────────────────────────────────────────────
   设计 AI 复核回执第 3 节要求：position/overflow/z-index/inset/top/right/
   bottom/left 不得被抽取/替换流程清空。历史上曾因整条规则体被替换，导致
   .mcu-discover-hero 与 .mcu-archive-visual 的 position:relative 丢失，
   absolute 子元素（海报、片名层）参照错位到卡片，与底部提示条重叠。 */
const PROTECTED_PROPERTIES = [
  'position', 'overflow', 'z-index', 'inset', 'top', 'right', 'bottom', 'left'
];
const lost = PROTECTED_PROPERTIES.filter(function (prop) {
  return !new RegExp('(^|;|\\s)' + prop + '\\s*:', 'i').test(rules);
});
if (lost.length) {
  console.log('  [error] 保护属性丢失: ' + lost.join(', '));
  process.exit(1);
}
console.log('  [ok] 保护属性保留：' + PROTECTED_PROPERTIES.join('/'));
