/**
 * 用设计稿规则替换 index.html 中的画布样式区（L241–L1160）
 * 保留：1-240 行（外壳 + Tabs/按钮等 COSUI 相关样式）
 * 替换：画布内容区（.mcu-*）
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const INDEX = path.join(ROOT, 'genui-app', 'index.html');
const RULES = path.join(ROOT, 'scratch', 'mcu-design-rules.css');

const lines = fs.readFileSync(INDEX, 'utf8').split('\n');

/* 定位画布样式区起止：以注释块为界 */
let start = -1;
let end = -1;
for (let i = 0; i < lines.length; i++) {
  if (start < 0 && /画布内容区/.test(lines[i])) {
    /* 回溯到该注释块的起始 /* */
    let j = i;
    while (j > 0 && !/^\s*\/\* =+\s*$/.test(lines[j])) j--;
    start = j;
  }
  if (start >= 0 && end < 0 && i > start && /操作区 Tabs/.test(lines[i])) {
    let j = i;
    while (j > 0 && !/^\s*\/\* =+\s*$/.test(lines[j])) j--;
    end = j;
    break;
  }
}

if (start < 0 || end < 0) {
  console.error('未能定位画布样式区 start=' + start + ' end=' + end);
  process.exit(1);
}

console.log('替换区间: L' + (start + 1) + ' – L' + end + '（共 ' + (end - start) + ' 行）');
console.log('原样式区开头: ' + lines[start].trim().slice(0, 40));
console.log('原样式区结尾前: ' + lines[end - 1].trim().slice(0, 40));

/* 组装新样式区 */
const rules = fs.readFileSync(RULES, 'utf8');
const header = [
  '        /* ============================================================',
  '         * 画布内容区 · 设计稿 V1.0 实现',
  '         * 依据：docs/产品/GenUI-MCU观影助手-画布视觉设计V1.0.html',
  '         * 纪律：--mcu-* token 仅在 .mcu-* 作用域内声明，不触碰 --cos-* 官方变量。',
  '         * ============================================================ */',
  '',
  '        /* Token 容器：三个画布根容器各自声明，避免污染全局 */',
  '        .mcu-route-canvas,',
  '        .mcu-film-card,',
  '        .mcu-discover-canvas {',
  '            --mcu-archive-gold: #b8860b;',
  '            --mcu-archive-gold-bg: #faf3e0;',
  '            --mcu-archive-gold-line: #e6d5a8;',
  '            --mcu-ink: #1a1d23;',
  '            --mcu-paper: #ffffff;',
  '            --mcu-line: #ececec;',
  '            --mcu-mono-font: "SF Mono", "Menlo", "Consolas", monospace;',
  '            --mcu-phase-1: #4a7fd4;',
  '            --mcu-phase-2: #2a9d7a;',
  '            --mcu-phase-3: #d4922a;',
  '            --mcu-phase-4: #7b5fd4;',
  '            --mcu-phase-5: #d4453d;',
  '            --mcu-phase-6: #b04d7d;',
  '        }',
  '',
  '        /* 1:1 小屏适配：设计稿视觉区的固定高度在小屏会挤压内容区，',
  '           改为 flex 占比 + max-height 兜底，保持设计稿比例关系。 */',
  '        .mcu-archive-visual { flex: 0 0 40%; min-height: 76px; max-height: 120px; }',
  '        .mcu-discover-hero { flex: 0 0 34%; min-height: 62px; max-height: 140px; }',
  '',
  '        /* 竖版 2:3 海报放入横向视觉区必然裁切，取景偏上保留人物头部 */',
  '        .mcu-archive-poster { object-position: center 18%; }',
  '        .mcu-discover-hero-poster { object-position: center 20%; }',
  '',
  '        /* 海报态隐藏程序化标记与胶片孔装饰 */',
  '        .mcu-archive-visual.has-poster::before,',
  '        .mcu-archive-visual.has-poster::after { display: none; }',
  '',
  '        /* 交互反馈 */',
  '        .mcu-tl-item { cursor: pointer; -webkit-tap-highlight-color: transparent; }',
  '        .mcu-route-footer { cursor: pointer; -webkit-tap-highlight-color: transparent; }',
  '        .mcu-route-footer:active { opacity: 0.7; }',
  ''
];

/* ── 定位上下文保护白名单 ────────────────────────────────────────
   设计 AI 复核回执第 3 节要求：以下属性不得被抽取/替换流程清空。
   历史上曾因整条规则体被替换，导致 .mcu-discover-hero 与
   .mcu-archive-visual 的 position:relative 丢失，absolute 子元素
   （海报、片名层）参照错位到卡片，与底部提示条重叠。 */
const PROTECTED_PROPERTIES = [
  'position', 'overflow', 'z-index', 'inset', 'top', 'right', 'bottom', 'left'
];

/* 仅允许被小屏适配覆盖的属性（高度相关），其余一律原样保留 */
const HEIGHT_OVERRIDE = {
  '.mcu-archive-visual': { flex: '0 0 40%', 'min-height': '76px', 'max-height': '120px' },
  '.mcu-discover-hero': { flex: '0 0 40%', 'min-height': '80px', 'max-height': '140px' }
};

/** 属性级覆盖：保留原规则的所有属性，仅替换 HEIGHT_OVERRIDE 指定的键 */
function overrideProps(body, overrides) {
  const parts = body.split(';').map((s) => s.trim()).filter(Boolean);
  const map = {};
  parts.forEach((p) => {
    const i = p.indexOf(':');
    if (i < 0) return;
    map[p.slice(0, i).trim().toLowerCase()] = p.slice(i + 1).trim();
  });
  Object.keys(overrides).forEach((k) => { map[k.toLowerCase()] = overrides[k]; });
  return Object.keys(map).map((k) => k + ': ' + map[k]).join('; ');
}

/** 对指定选择器做属性级高度覆盖，其余属性原样保留 */
function applyHeightOverrides(cssText) {
  let out = cssText;
  Object.keys(HEIGHT_OVERRIDE).forEach((sel) => {
    const esc = sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp('(' + esc + '\\s*\\{)([^}]*)(\\})');
    const m = out.match(re);
    if (!m) { console.log('  [warn] 未找到 ' + sel + '，跳过覆盖'); return; }
    const merged = overrideProps(m[2], HEIGHT_OVERRIDE[sel]);
    /* 校验保护属性未被丢掉 */
    const lost = PROTECTED_PROPERTIES.filter((p) => {
      const had = new RegExp('(^|;|\\s)' + p + '\\s*:', 'i').test(m[2]);
      const has = new RegExp('(^|;|\\s)' + p + '\\s*:', 'i').test(merged);
      return had && !has;
    });
    if (lost.length) {
      console.log('  [error] ' + sel + ' 丢失保护属性: ' + lost.join(', '));
    } else {
      console.log('  [ok] ' + sel + ' 属性级覆盖完成，保护属性保留');
    }
    out = out.replace(re, m[1] + '\n    ' + merged + '\n' + m[3]);
  });
  return out;
}

/* 移除设计稿里的固定高度声明（已在 header 中用适配版覆盖） */
let body = rules
  .replace(/animation:\s*pulse-dot\s*2s[^;]*;/, '')
  .replace(/@keyframes pulse-dot \{[\s\S]*?\n        \}/, '');

/* 用属性级覆盖替代原来的整规则替换，避免丢失 position/overflow */
body = applyHeightOverrides(body);

const newLines = lines.slice(0, start).concat(header, body.split('\n'), lines.slice(end));
fs.writeFileSync(INDEX, newLines.join('\n'), 'utf8');

console.log('\n替换完成。新文件行数: ' + newLines.length + '（原 ' + lines.length + '）');
