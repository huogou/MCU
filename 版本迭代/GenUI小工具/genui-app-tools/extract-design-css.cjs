/**
 * 从「当前生效产物」genui-app/index.html 抽取画布样式区（.mcu-*），原文逐字保留
 * 输出：scratch/mcu-design-header.css  （token 容器 + 1:1 小屏适配块）
 *       scratch/mcu-design-rules.css  （A/B/C 三模块样式区）
 *
 * V1.3 起变更（工具链债清理）：
 *   抽取源由「V1.0 设计稿 HTML」改为「live 产物」。原因：V1.1/V1.2/V1.3 的样式
 *   均由设计指令直接落到 live，旧脚本仍指向 V1.0 稿，重跑会把 live 回退到 V1.0。
 *   本脚本与 apply-visual-patch.cjs / apply-design-css.cjs 构成文本级幂等链路：
 *   extract → apply 不改变 live 内容（可用 git diff / 文件哈希自检）。
 *
 * 切分点：画布样式区起止以注释块为界，header 与 A/B/C 三模块区以「* A. F1」注释为界。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const INDEX = path.join(ROOT, 'genui-app', 'index.html');
const OUT_HEADER = path.join(ROOT, 'scratch', 'mcu-design-header.css');
const OUT_RULES = path.join(ROOT, 'scratch', 'mcu-design-rules.css');

/* 保护属性：下游替换流程不得清空（海报/片名层为 absolute 定位，丢失会参照错位） */
const PROTECTED_PROPERTIES = [
  'position', 'overflow', 'z-index', 'inset', 'top', 'right', 'bottom', 'left'
];

const START_RE = /\/\* =+\s*\n\s*\* 画布内容区/;
const END_RE = /\/\* =+\s*\n\s*\* 操作区 Tabs/;
const SPLIT_RE = /\/\* =+\s*\* A\. F1 观影路线卡/;

const html = fs.readFileSync(INDEX, 'utf8');
const s = html.match(START_RE);
const e = html.match(END_RE);
const p = html.match(SPLIT_RE);

if (!s || !e || !p) {
  console.error('定位失败', { start: !!s, end: !!e, split: !!p });
  process.exit(1);
}
if (!(s.index < p.index && p.index < e.index)) {
  console.error('切分点顺序异常', { start: s.index, split: p.index, end: e.index });
  process.exit(1);
}

const header = html.slice(s.index, p.index);
const rules = html.slice(p.index, e.index);

fs.writeFileSync(OUT_HEADER, header, 'utf8');
fs.writeFileSync(OUT_RULES, rules, 'utf8');

console.log('抽取区间: ' + s.index + ' → ' + e.index + '（' + (e.index - s.index) + ' 字节）');
console.log('  header: ' + Math.round(header.length / 1024 * 10) / 10 + ' KB  → ' + OUT_HEADER);
console.log('  rules : ' + Math.round(rules.length / 1024 * 10) / 10 + ' KB  → ' + OUT_RULES);

/* 抽取后校验：保护属性必须在规则区中存在（下游回写不得清空） */
let lost = 0;
PROTECTED_PROPERTIES.forEach(function (prop) {
  if (!new RegExp('(^|;|\\s)' + prop + '\\s*:', 'i').test(rules)) {
    console.log('  [error] 保护属性丢失: ' + prop);
    lost++;
  }
});
console.log(lost === 0
  ? '保护属性校验通过：position/overflow/z-index/inset/top/right/bottom/left 均在'
  : '*** ' + lost + ' 个保护属性丢失 ***');

/* @keyframes 必须完整保留（V1.3 新增 mcu-node-pulse，V1.1 有 mcu-pulse-dot） */
const kf = (rules.match(/@keyframes\s+[a-z0-9-]+/gi) || []);
console.log('关键帧动画: ' + (kf.join(', ') || '无'));
if (kf.length === 0) {
  console.log('  [warn] 未发现 @keyframes，请确认抽取区间是否正确');
}
process.exit(lost === 0 ? 0 : 1);
