/**
 * 冻结件守卫（视觉集成专用）
 * ------------------------------------------------------------
 * 验证 GenUI 外壳 / COSUI 官方组件 / 数据引用 / 打点接口 相对「视觉集成前」的改动情况。
 * 基线：genui-app-tools/baseline-pre-visual.html（视觉集成前快照，由本脚本 --bless 生成）
 *
 * 允许改动：.mcu-* 画布样式 + .mcu-* 渲染模板（F1/B/C 三模块）
 * 禁止改动：.vc-component-* / .vc-tabs-* / .vc-button / .cos-icon 样式与结构
 *           window.genui 调用、sendLog、shuffle、resetDemo、onPickRoute、onTabChange
 *           数据引用 <script src="./static/data.js">
 */
const fs = require('fs');
const path = require('path');

const APP = path.resolve(__dirname, '..', 'genui-app');
const INDEX = path.join(APP, 'index.html');
const BASE = path.join(__dirname, 'baseline-pre-visual.html');
const BLESS = process.argv.indexOf('--bless') >= 0;

const html = fs.readFileSync(INDEX, 'utf8');
const css = (html.match(/<style>([\s\S]*?)<\/style>/) || ['', ''])[1];

if (BLESS || !fs.existsSync(BASE)) {
  fs.writeFileSync(BASE, html, 'utf8');
  console.log('已生成视觉集成前基线：genui-app-tools/baseline-pre-visual.html');
  process.exit(0);
}

const baseHtml = fs.readFileSync(BASE, 'utf8');
const baseCss = (baseHtml.match(/<style>([\s\S]*?)<\/style>/) || ['', ''])[1];
let bad = 0;

console.log('=== 冻结件守卫 · 视觉集成核对 ===\n');

/* 1. 非 .mcu-* 样式必须零改动 */
function rules(src) {
  const map = {};
  /* 先剥离注释：否则注释文本会被当作选择器，产生大量误报 */
  const clean = src.replace(/\/\*[\s\S]*?\*\//g, '');
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(clean)) !== null) {
    const sel = m[1].trim().replace(/\s+/g, ' ');
    if (!sel || sel.charAt(0) === '@') continue;
    /* 关键帧内的百分比帧（如 @keyframes 中的 50%）不参与外壳比对 */
    if (/^\d+%$/.test(sel)) continue;
    map[sel] = m[2].replace(/\s+/g, ' ').trim();
  }
  return map;
}
const b = rules(baseCss);
const c = rules(css);
const chg = [], add = [], rm = [];
// 跳过 keyframe 帧选择器（如 0%, 100% / 50%）：它们仅出现在 .mcu-* 动画内部，
// 属画布区改动范围（轻量版删除了 .mcu-pulse-dot / .mcu-node-pulse 等动画）。
// 纯数字/百分比选择器不可能是 .vc-* / .cos-* 外壳选择器，跳过不会漏检真实外壳改动。
function isKeyframeStop(s) {
  return /^[\d%,\s]+$/.test(s) || s === 'from' || s === 'to';
}
Object.keys(c).forEach(function (s) {
  if (s.indexOf('.mcu-') === 0 || isKeyframeStop(s)) return;
  if (!(s in b)) add.push(s);
  else if (b[s] !== c[s]) chg.push(s);
});
Object.keys(b).forEach(function (s) {
  if (s.indexOf('.mcu-') === 0 || isKeyframeStop(s)) return;
  if (!(s in c)) rm.push(s);
});
console.log('--- 外壳与官方组件样式（.vc-* / .cos-icon / .cos-*）---');
if (!chg.length && !add.length && !rm.length) {
  console.log('  [OK] 零改动');
} else {
  chg.forEach(function (s) { console.log('  [X] 改动 ' + s); bad++; });
  add.forEach(function (s) { console.log('  [X] 新增 ' + s); bad++; });
  rm.forEach(function (s) { console.log('  [X] 删除 ' + s); bad++; });
}

/* 2. 外壳结构与交互逻辑必须存在 */
const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();
// 轻量版 V1.0 改造说明（2026-10-30）：设计稿已删除「换一部（shuffle）」与
// 「路线 chips / onPickRoute」两类交互，路线切换统一收归 COSUI 官方 Tabs。
// 故下方 MUST 移除这两项针对旧结构的断言，保留其余冻结件存在性检查意图。
const MUST = [
  ['外壳骨架（表头/操作区/Tabs/重置）',
    /<div class="vc-component-wrapper">[\s\S]*?<script src="\.\/static\/data\.js"><\/script>/],
  ['数据引用', /<script src="\.\/static\/data\.js"><\/script>/],
  ['打点接口 sendLog', /function sendLog\(area\) \{[\s\S]*?window\.genui && typeof window\.genui\.sendLog === 'function'[\s\S]*?\n            \}/],
  ['Tabs 路线切换 onTabChange', /function onTabChange[\s\S]*?\n            \}/],
  ['重置 resetDemo', /function resetDemo\(\) \{[\s\S]*?\n            \}/],
  ['气泡 showTipsTooltip', /function showTipsTooltip\(\) \{[\s\S]*?\n            \}/],
  ['气泡避让 adjustTips', /function adjustTipsTooltipPosition\(\) \{[\s\S]*?\n            \}/]
];
console.log('\n--- 外壳结构与交互逻辑存在性 ---');
MUST.forEach(function (s) {
  if (html.match(s[1])) {
    console.log('  [OK] ' + s[0]);
  } else {
    console.log('  [X] ' + s[0] + ' 缺失或被改动');
    bad++;
  }
});

/* 3. token 纪律：不得定义 --cos-*；--mcu-* 必须在 .mcu-* 作用域 */
const nc = css.replace(/\/\*[\s\S]*?\*\//g, '');
console.log('\n--- token 纪律 ---');
if (/[^{}]*\{[^{}]*--cos-[a-z0-9-]+\s*:/i.test(nc)) {
  console.log('  [X] 产物内定义了 --cos-* token（严禁）');
  bad++;
} else {
  console.log('  [OK] 未定义任何 --cos-* token');
}
if (/:root\s*\{[^}]*--(?:cos|mcu)-/i.test(nc)) {
  console.log('  [X] :root 中出现 --cos-* 或 --mcu-*');
  bad++;
} else {
  console.log('  [OK] :root 干净（无 --cos-* / --mcu-*）');
}
const blocks = nc.match(/[^{}]*\{[^{}]*--mcu-[a-z0-9-]+\s*:/gi) || [];
const badScope = blocks.filter(function (x) { return x.split('{')[0].trim().indexOf('.mcu-') !== 0; });
if (badScope.length) {
  console.log('  [X] --mcu-* 声明越界：' + badScope[0].split('{')[0].trim());
  bad++;
} else {
  console.log('  [OK] --mcu-* 全部在 .mcu-* 根容器作用域内（' + blocks.length + ' 处）');
}

/* 4. 外壳硬指标逐项核对（对照官方规范，防止视觉集成误伤外壳） */
console.log('\n--- 外壳硬指标（对照官方规范）---');
const SHELL = [
  ['外壳 1:1 骨架 padding-top:100%', /\.vc-component-wrapper\s*\{[^}]*padding-top:\s*100%/],
  ['外壳容器 absolute + inset:0', /\.vc-component-container\s*\{[^}]*position:\s*absolute[^}]*inset:\s*0/],
  ['表头高度 45px', /\.vc-component-header\s*\{[^}]*height:\s*45px/],
  ['表头内间距 15px 15px 12px', /\.vc-component-header\s*\{[^}]*padding:\s*15px 15px 12px/],
  ['表头底描边 0.5px', /\.vc-component-header\s*\{[^}]*border-bottom:\s*0\.5px/],
  ['body 显式清零 margin/padding', /body\s*\{[^}]*margin:\s*0[^}]*padding:\s*0/],
  ['操作区 Tabs 官方类保留', /\.vc-tabs-segmented/],
  ['操作区按钮官方类保留', /\.vc-button-plain/],
  ['cos-icon 图标体系保留', /\.cos-icon\s*\{/],
  ['重置按钮旋转动画保留', /vc-component-icon-rotating/],
  ['提示气泡与边缘避让保留', /vc-component-tips-tooltip/],
  ['画布区 flex:1 撑满保留', /\.vc-component-demo\s*\{[^}]*flex:\s*1/]
];
SHELL.forEach(function (s) {
  if (s[1].test(css) || s[1].test(html)) {
    console.log('  [OK] ' + s[0]);
  } else {
    console.log('  [X] ' + s[0]);
    bad++;
  }
});

/* 表头文案 */
const titleM = html.replace(/<style[\s\S]*?<\/style>/g, '').match(/class="vc-component-header-title"[^>]*>\s*([^<]+?)\s*</);
if (titleM) {
  const proj = titleM[1].trim().replace(/^小工具\s*·\s*/, '');
  console.log('  表头文案: ' + titleM[1].trim() + '（项目名 ' + proj.length + ' 字，上限 10）');
  if (proj.length > 10) { console.log('  [X] 表头项目名超 10 字'); bad++; }
} else {
  console.log('  [X] 表头文案未找到');
  bad++;
}

console.log('\n' + (bad === 0
  ? '*** 冻结件完好：仅 .mcu-* 画布与三模块渲染模板改动 ***'
  : '*** ' + bad + ' 处越界，需回退 ***'));
process.exit(bad === 0 ? 0 : 1);
