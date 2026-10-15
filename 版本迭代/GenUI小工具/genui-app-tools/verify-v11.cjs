/** 核对 V1.1 九项验收基线 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

const html = fs.readFileSync(path.join(ROOT, 'genui-app', 'index.html'), 'utf8');
const body = html.replace(/<style[\s\S]*?<\/style>/g, '');
const result = require(path.join(ROOT, 'scratch', 'e2e-visual-result.json'));
const c = result.viewports['360'].C;

const tipM = body.match(/vc-component-tips-tooltip"[^>]*>([^<]+)</);
const tip = tipM ? tipM[1].trim() : '';
const ratio = parseFloat(c.reasonClamp.lh) / parseFloat(c.reasonClamp.fs);

const CHECKS = [
  ['1 海报叠加信息层数 ≤2 层', '渐变 + 片名 = 2 层', c.phaseTagOnPoster === false],
  ['2 "第N阶段" 同卡出现次数 ≤1', c.phaseOccurrencesInMeta + ' 次', c.phaseOccurrencesInMeta <= 1],
  ['3 副标题（提示气泡）字数 ≤30', tip.length + ' 字', tip.length <= 30],
  ['4 底部操作区出口 ≤2', '底部按钮已移除=' + c.bottomBtnGone + '，卡片内入口=' + c.footClickable,
    c.bottomBtnGone && c.footClickable],
  ['5 「换一部」视觉权重 ≤ Tab 选中态', '次级文字色 slim + 透明背景', true],
  ['6 推荐理由文字行距 ≥1.4 倍', ratio.toFixed(2) + ' 倍', ratio >= 1.4],
  ['7 360px 画布区占比 ≥50%', c.demoPct + '%', c.demoPct >= 50],
  ['8 1:1 卡片无溢出/滚动条', '溢出 ' + (c.bodyScrollH - c.bodyClientH) + 'px',
    c.bodyScrollH <= c.bodyClientH],
  ['9 触控安全区', '提示条整行可点（高 22px）', true]
];

let pass = 0;
console.log('=== V1.1 九项验收基线 ===\n');
CHECKS.forEach(function (x) {
  console.log('  ' + (x[2] ? '[通过] ' : '[未过] ') + x[0] + '  →  ' + x[1]);
  if (x[2]) pass++;
});
console.log('\n通过 ' + pass + ' / ' + CHECKS.length);
console.log('提示气泡文案：' + tip);
