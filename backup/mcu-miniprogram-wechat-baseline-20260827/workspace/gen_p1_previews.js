/* P1 收尾渲染验证生成器：characters（真实头像）+ my-mcu（真实海报）
 * 用真实 mcuData + CDN URL 镜像页面结构（rpx÷2=px，375 宽），产出两个 HTML
 * 供 Chrome headless 渲染 + 破 URL 对照验证 */
const mcuData = require('../models/mcuData.js');
const fs = require('fs');

const CDN = 'https://mcu-d6gw0brqoa9521b58-1307093647.tcloudbaseapp.com';

/* ========== characters 页 ========== */
const { CHARACTERS, CAMPS } = require('../data/characters.js');
const CAMP_CLS = { avengers:'red', street:'red', asgard:'blue', shield:'blue', guardians:'purple', mutant:'purple', wakanda:'gold', villain:'gray' };

let charsHtml = '';
CHARACTERS.forEach(c => {
  const cls = CAMP_CLS[c.camp] || 'gray';
  const av = mcuData.avatar(c.id);
  const avatar = av
    ? `<img class="fill-img" src="${av}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block"/>`
    : `<span style="font-size:22px;font-weight:700;color:#fff">${(c.cn||'?').charAt(0)}</span>`;
  charsHtml += `
  <div class="char-card">
    <div class="char-avatar" style="border:1px solid #fff3;background:linear-gradient(135deg,#2A3447,#141925);overflow:hidden;display:flex;align-items:center;justify-content:center">${avatar}</div>
    <div style="flex:1;min-width:0;margin-left:16px">
      <div style="display:flex;align-items:center;justify-content:space-between">
        <div style="font-size:18px;font-weight:600;color:#E8ECF4">${c.cn}</div>
        <div style="font-size:11px;color:#6B7384">${mcuData.charAppearances(c.id).count} 部作品</div>
      </div>
      <div style="font-size:11px;color:#A8B0C0;margin-top:4px">${c.en}</div>
      <div style="font-size:11px;color:#6B7384;margin-top:6px">${CAMPS[c.camp].label}</div>
    </div>
  </div>`;
});

const charsHTML = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#0B0E14;font-family:-apple-system,'PingFang SC',sans-serif;width:375px;padding:28px 18px}
.page-title{font-size:34px;font-weight:700;color:#E8ECF4;margin-bottom:8px}
.page-sub{font-size:12px;color:#A8B0C0;margin-bottom:16px}
.chip-row{display:flex;gap:8px;margin-bottom:12px;overflow:hidden}
.chip{flex-shrink:0;font-size:12px;color:#A8B0C0;background:#141925;border:1px solid #232B3B;border-radius:999px;padding:6px 16px}
.chip-on{color:#F2B233;border-color:#F2B233;background:rgba(242,178,51,.1);font-weight:600}
.count-line{font-size:11px;color:#6B7384;margin:8px 0 12px}
.char-card{display:flex;align-items:center;background:#141925;border:1px solid #232B3B;border-radius:20px;padding:16px;margin-bottom:8px}
.char-avatar{width:44px;height:44px;border-radius:50%;flex-shrink:0}
</style></head><body>
<div class="page-title">角色图鉴</div>
<div class="page-sub">24 位角色 · 8 大阵营 · 从角色读懂宇宙关系</div>
<div class="chip-row"><span class="chip chip-on">全部</span><span class="chip">复仇者阵营</span><span class="chip">银河护卫队</span><span class="chip">阿斯加德</span></div>
<div class="count-line">共 24 位角色</div>
${charsHtml}
</body></html>`;
fs.writeFileSync('characters_p1_preview.html', charsHTML, 'utf8');
console.log('WROTE characters_p1_preview.html, cards:', CHARACTERS.length);

/* ========== my-mcu 页（最近观看 + 观看记录 + 收藏，真实海报） ========== */
const sampleIds = ['iron-man', 'captain-america-first-avenger', 'avengers', 'thor', 'guardians', 'winter-soldier'];
function posterOf(id) {
  const v = mcuData.visual(id);
  return (v && v.poster) ? v.poster : '';
}
let recentHtml = '', watchHtml = '', favHtml = '';
sampleIds.slice(0, 3).forEach(id => {
  const m = mcuData.get(id);
  const p = posterOf(id);
  recentHtml += `
  <div style="width:84px;text-align:center;flex-shrink:0;margin-right:12px">
    <div style="width:84px;height:118px;border-radius:16px;overflow:hidden;position:relative;background:linear-gradient(135deg,#2A3447,#141925);display:flex;align-items:center;justify-content:center">
      ${p ? `<img src="${p}" style="width:100%;height:100%;object-fit:cover;display:block"/>` : `<span style="font-size:24px;font-weight:700;color:rgba(255,255,255,.5)">${m.cn.charAt(0)}</span>`}
      <span style="position:absolute;bottom:4px;right:4px;font-size:9px;background:rgba(63,185,138,.9);color:#0B0E14;border-radius:6px;padding:1px 6px">已看</span>
    </div>
    <div style="font-size:11px;color:#A8B0C0;margin-top:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${m.cn}</div>
  </div>`;
});
sampleIds.forEach(id => {
  const m = mcuData.get(id);
  const p = posterOf(id);
  const card = `
  <div style="display:flex;align-items:center;background:#141925;border:1px solid #232B3B;border-radius:20px;padding:12px;margin-bottom:8px">
    <div style="width:40px;height:40px;border-radius:8px;overflow:hidden;flex-shrink:0;background:linear-gradient(135deg,#2A3447,#141925);display:flex;align-items:center;justify-content:center">
      ${p ? `<img src="${p}" style="width:100%;height:100%;object-fit:cover;display:block"/>` : `<span style="font-size:18px;font-weight:700;color:rgba(255,255,255,.5)">${m.cn.charAt(0)}</span>`}
    </div>
    <div style="flex:1;min-width:0;margin-left:12px">
      <div style="font-size:14px;font-weight:600;color:#E8ECF4">${m.cn}</div>
      <div style="font-size:11px;color:#6B7384;margin-top:2px">第${m.phase}阶段 · ${mcuData.typeLabel[m.type] || '作品'}</div>
    </div>
    <span style="font-size:10px;color:#3FB98A">已看</span>
  </div>`;
  watchHtml += card;
});
sampleIds.slice(0, 2).forEach(id => {
  const m = mcuData.get(id);
  const p = posterOf(id);
  favHtml += `
  <div style="display:flex;align-items:center;background:#141925;border:1px solid #232B3B;border-radius:20px;padding:12px;margin-bottom:8px">
    <div style="width:40px;height:40px;border-radius:8px;overflow:hidden;flex-shrink:0;background:linear-gradient(135deg,#2A3447,#141925);display:flex;align-items:center;justify-content:center">
      ${p ? `<img src="${p}" style="width:100%;height:100%;object-fit:cover;display:block"/>` : `<span style="font-size:18px;font-weight:700;color:rgba(255,255,255,.5)">${m.cn.charAt(0)}</span>`}
    </div>
    <div style="flex:1;min-width:0;margin-left:12px">
      <div style="font-size:14px;font-weight:600;color:#E8ECF4">${m.cn}</div>
      <div style="font-size:11px;color:#6B7384;margin-top:2px">第${m.phase}阶段</div>
    </div>
    <span style="font-size:14px;color:#F2B233">★</span>
  </div>`;
});

const mcuHTML = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#0B0E14;font-family:-apple-system,'PingFang SC',sans-serif;width:375px;padding:28px 18px}
.sec{font-size:14px;font-weight:600;color:#E8ECF4;margin:20px 0 12px}
</style></head><body>
<div class="sec">最近观看</div>
<div style="display:flex">${recentHtml}</div>
<div class="sec">观看记录 · ${sampleIds.length} 部</div>
${watchHtml}
<div class="sec">我的收藏 · 2</div>
${favHtml}
</body></html>`;
fs.writeFileSync('mymcu_p1_preview.html', mcuHTML, 'utf8');
console.log('WROTE mymcu_p1_preview.html');
