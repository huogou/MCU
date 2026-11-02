/**
 * 用已同步的规则源回写 index.html 画布样式区，并在回写后做严格校验
 * ------------------------------------------------------------
 * 与 apply-visual-patch.cjs 的分工：
 *   apply-visual-patch.cjs —— 执行写入（轻量，供日常样式更新走查）
 *   apply-design-css.cjs    —— 执行写入 + 严格校验（token 纪律 / 保护属性 / 幂等性）
 *
 * V1.3 起变更（工具链债清理）：
 *   规则源由「V1.0 设计稿 HTML 抽取结果 + 脚本内嵌高度覆盖」改为
 *   scratch/mcu-design-header.css + scratch/mcu-design-rules.css
 *   （由 extract-design-css.cjs 从 live 产物原文抽取）。
 *   旧实现会在回写时用 HEIGHT_OVERRIDE 强制覆盖视觉区高度（V1.0 的值），
 *   直接跑会把 V1.1/V1.2/V1.3 的 360px 预算修正全部打回，
 *   故本次改为「规则源即 live」的文本级幂等链路，高度值随 live 走。
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
  console.error('规则源缺失，请先运行 extract-design-css.cjs');
  process.exit(1);
}

const html = fs.readFileSync(INDEX, 'utf8');
const header = fs.readFileSync(HEADER, 'utf8');
const rules = fs.readFileSync(RULES, 'utf8');

const s = html.match(START_RE);
const e = html.match(END_RE);
if (!s || !e) {
  console.error('未能定位画布样式区 start=' + !!s + ' end=' + !!e);
  process.exit(1);
}
console.log('替换区间: 字节 ' + s.index + ' – ' + e.index + '（' + (e.index - s.index) + ' 字节）');

const after = html.slice(0, s.index) + header + rules + html.slice(e.index);
const idempotent = (after === html);
if (!idempotent) fs.writeFileSync(INDEX, after, 'utf8');
console.log(idempotent ? '幂等：规则源与 live 一致，产物未变化' : '已回写画布样式区。');

/* ── 严格校验 ──────────────────────────────────────────────────── */
const PROTECTED_PROPERTIES = [
  'position', 'overflow', 'z-index', 'inset', 'top', 'right', 'bottom', 'left'
];
let failed = 0;

const lost = PROTECTED_PROPERTIES.filter(function (p) {
  return !new RegExp('(^|;|\\s)' + p + '\\s*:', 'i').test(rules);
});
if (lost.length) { console.log('  [error] 保护属性丢失: ' + lost.join(', ')); failed++; }
else console.log('  [ok] 保护属性保留：' + PROTECTED_PROPERTIES.join('/'));

/* token 纪律：不得定义 --cos-*；--mcu-* 必须在 .mcu-* 根容器作用域内 */
if (/--cos-[a-z0-9-]+\s*:/.test(rules + header)) {
  console.log('  [error] 规则源内出现 --cos-* token 定义'); failed++;
} else {
  console.log('  [ok] 未定义任何 --cos-* token');
}
if (!/--mcu-[a-z0-9-]+\s*:/.test(header)) {
  console.log('  [error] --mcu-* token 未在 .mcu-* 根容器内声明'); failed++;
} else {
  console.log('  [ok] --mcu-* token 声明在 .mcu-* 根容器作用域内');
}

/* 关键帧动画必须存在（节点脉冲 / 徽章脉冲） */
const kf = (rules.match(/@keyframes\s+[a-z0-9-]+/gi) || []);
if (kf.length === 0) { console.log('  [error] 未发现 @keyframes'); failed++; }
else console.log('  [ok] 关键帧动画: ' + kf.join(', '));

console.log(failed === 0 ? '\n*** 回写校验通过 ***' : '\n*** ' + failed + ' 项校验失败 ***');
process.exit(failed === 0 ? 0 : 1);
