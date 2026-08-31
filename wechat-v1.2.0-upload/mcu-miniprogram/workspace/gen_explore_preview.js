/* V1.2 P0④ explore 重做验证：生成 HTML 预览（真实 mcuData 派生 + 真实本地头像） */
const fs = require('fs');
const path = require('path');
const mcuData = require('../models/mcuData.js');
const { CHARACTERS } = require('../data/characters.js');
const visuals = require('../data/visuals.js');

const ROOT = path.resolve(__dirname, '..');
function toFile(p) {
  if (!p) return '';
  if (/^https?:/.test(p)) return p;
  return 'file:///' + path.join(ROOT, p.replace(/^\//, '')).replace(/\\/g, '/');
}

/* ── 派生逻辑（与 explore.js 完全一致） ── */
const CAMP_MAP = { avengers:{cls:'red',label:'复仇者'}, asgard:{cls:'blue',label:'阿斯加德'}, guardians:{cls:'purple',label:'银河护卫队'}, wakanda:{cls:'gold',label:'瓦坎达'}, shield:{cls:'blue',label:'神盾局'}, mutant:{cls:'purple',label:'变种人'}, villain:{cls:'gray',label:'反派'}, street:{cls:'red',label:'街头英雄'} };
const REL_LABEL = { ally:'盟友', enemy:'敌人', mentor:'师徒', family:'家人', rival:'对手' };
const SPECIAL = [ ['tony','peter','mentor'],['strange','wanda','rival'],['thanos','gamora','family'],['thanos','tony','enemy'],['steve','bucky','family'],['thor','loki','family'],['natasha','clint','ally'],['wade','logan','rival'],['tchalla','starlord','rival'] ];
const pairKey = (a,b) => a < b ? a + '|' + b : b + '|' + a;
const heroOf = cn => { const p = (cn || '').split(' / '); return p.length > 1 ? p[1].trim() : (cn || ''); };
function coCount(a, b) {
  const fa = mcuData.filmsOfChar(a), fb = mcuData.filmsOfChar(b);
  if (!fa.length || !fb.length) return 0;
  const s = {}; fb.forEach(f => s[f.id] = true);
  return fa.filter(f => s[f.id]).length;
}
function makePair(aId, bId, type, count, special) {
  const A = mcuData.getChar(aId), B = mcuData.getChar(bId);
  if (!A || !B) return null;
  const ac = CAMP_MAP[A.camp] || { cls: 'gray', label: '' };
  const bc = CAMP_MAP[B.camp] || { cls: 'gray', label: '' };
  return { relType: type, relLabel: REL_LABEL[type], coCount: count, special,
    fromId: A.id, fromFirst: heroOf(A.cn).charAt(0), fromAvatar: visuals.avatar(A.id) || '',
    fromCn: heroOf(A.cn), fromEn: A.en, fromCampCls: ac.cls, fromCampLabel: ac.label,
    toId: B.id, toFirst: heroOf(B.cn).charAt(0), toAvatar: visuals.avatar(B.id) || '',
    toCn: heroOf(B.cn), toEn: B.en, toCampCls: bc.cls, toCampLabel: bc.label };
}
function derive() {
  const pairs = []; const used = {};
  SPECIAL.forEach(p => { const k = pairKey(p[0], p[1]); used[k] = 1; const c = makePair(p[0], p[1], p[2], coCount(p[0], p[1]), true); if (c) pairs.push(c); });
  const groups = {}; CHARACTERS.forEach(c => { (groups[c.camp] = groups[c.camp] || []).push(c.id); });
  Object.keys(groups).forEach(camp => {
    const ids = groups[camp]; const cands = [];
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
      const k = pairKey(ids[i], ids[j]); if (used[k]) continue;
      const n = coCount(ids[i], ids[j]); if (n >= 1) cands.push({ a: ids[i], b: ids[j], n, k });
    }
    cands.sort((x, y) => y.n - x.n);
    cands.slice(0, 4).forEach(c => { used[c.k] = 1; const card = makePair(c.a, c.b, 'ally', c.n, false); if (card) pairs.push(card); });
  });
  const cross = [];
  for (let i = 0; i < CHARACTERS.length; i++) for (let j = i + 1; j < CHARACTERS.length; j++) {
    const a = CHARACTERS[i], b = CHARACTERS[j]; if (a.camp === b.camp) continue;
    const k = pairKey(a.id, b.id); if (used[k]) continue;
    const n = coCount(a.id, b.id); if (n >= 3) cross.push({ a: a.id, b: b.id, n, k });
  }
  cross.sort((x, y) => y.n - x.n);
  cross.slice(0, 6).forEach(c => { const card = makePair(c.a, c.b, 'rival', c.n, false); if (card) pairs.push(card); });
  pairs.sort((x, y) => (x.special ? 0 : 1) - (y.special ? 0 : 1) || y.coCount - x.coCount);
  return pairs;
}
const pairs = derive();
const FILTERS = [['all','全部'],['ally','盟友'],['enemy','敌人'],['mentor','师徒'],['family','家人'],['rival','对手']];

/* ── 渲染 ── */
const CAMP_COLOR = { red: '#E85D5D', blue: '#4A9EF5', purple: '#9B7FE8', gold: '#F2B233', gray: '#6B7384' };
const REL_COLOR = { ally: '#4A9EF5', enemy: '#E85D5D', mentor: '#F2B233', family: '#9B7FE8', rival: '#E85D5D' };
const pillBg = { red: 'rgba(232,93,93,.10)', blue: 'rgba(74,158,245,.10)', purple: 'rgba(155,127,232,.10)', gold: 'rgba(242,178,51,.10)', gray: 'rgba(107,115,132,.15)' };
const fbg = { red: 'linear-gradient(135deg,#E85D5D,#E85D5D66)', blue: 'linear-gradient(135deg,#4A9EF5,#4A9EF566)', purple: 'linear-gradient(135deg,#9B7FE8,#9B7FE866)', gold: 'linear-gradient(135deg,#F2B233,#F2B23366)', gray: 'linear-gradient(135deg,#6B7384,#6B738466)' };

let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#0B0E14;font-family:-apple-system,'PingFang SC','Microsoft YaHei',sans-serif;width:375px}
.page{padding:0 36px;min-height:100vh;background:#0B0E14}
.page-head{padding:56px 0 28px}
.page-title{font-size:56px;font-weight:700;color:#E8ECF4}
.page-sub{font-size:28px;color:#A8B0C0;margin-top:8px}
.entry-row{display:flex;gap:20px;margin-bottom:56px}
.entry-card{flex:1;height:120px;display:flex;align-items:center;gap:20px;background:#141925;border:1px solid #232B3B;border-radius:20px;padding:0 20px}
.entry-icon{width:64px;height:64px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:44px;flex-shrink:0}
.icon-pano{background:rgba(242,178,51,.10);color:#F2B233}
.icon-char{background:rgba(139,111,232,.15);color:#8B6FE8}
.entry-body{flex:1;min-width:0}
.entry-name{font-size:28px;font-weight:600;color:#E8ECF4}
.entry-desc{font-size:22px;color:#A8B0C0;margin-top:8px}
.entry-arrow{font-size:44px;color:#6B7384;line-height:1}
.filter-row{white-space:nowrap;margin-bottom:28px}
.filter-inner{display:inline-flex;gap:8px;padding:4px 0}
.chip{display:inline-flex;align-items:center;justify-content:center;height:56px;padding:0 28px;border-radius:999px;font-size:24px;font-weight:400;color:#A8B0C0;background:#141925;border:1px solid #232B3B;flex-shrink:0;margin-right:8px}
.chip-active{color:#F2B233;background:rgba(242,178,51,.10);border-color:#F2B233;font-weight:600}
.pair-list{display:flex;flex-direction:column}
.pair-card{background:#141925;border:1px solid #232B3B;border-radius:20px;padding:28px;margin-bottom:20px;display:flex;flex-wrap:wrap;align-items:flex-start}
.pair-char{width:35%;display:flex;flex-direction:column;align-items:center}
.pair-avatar{width:80px;height:80px;border-radius:50%;border:2px solid;overflow:hidden;display:flex;align-items:center;justify-content:center;background:#232B3B}
.pair-avatar-img{width:100%;height:100%;object-fit:cover}
.pair-avatar-fallback{width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:36px;font-weight:600;color:rgba(255,255,255,.70)}
.pair-name{font-size:28px;font-weight:600;color:#E8ECF4;margin-top:8px;text-align:center;max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pair-en{font-size:22px;color:#A8B0C0;margin-top:4px;text-align:center;max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pair-camp{font-size:22px;margin-top:8px;border-radius:999px;padding:2px 12px}
.pair-relation{width:30%;height:80px;display:flex;align-items:center;justify-content:center;margin-top:6px}
.pair-line{flex:1;height:1px;background:#232B3B}
.pair-type{font-size:22px;font-weight:600;padding:0 8px;white-space:nowrap}
.pair-footer{width:100%;text-align:center;font-size:22px;color:#6B7384;padding-top:8px;margin-top:8px;border-top:1px solid #232B3B}
.bottom-pad{height:60px}
</style></head><body><div class="page">
  <div class="page-head"><div class="page-title">关系探索</div><div class="page-sub">MCU 角色关系网络</div></div>
  <div class="entry-row">
    <div class="entry-card"><div class="entry-icon icon-pano">◇</div><div class="entry-body"><div class="entry-name">宇宙全景图</div><div class="entry-desc">一图看尽主线脉络</div></div><div class="entry-arrow">›</div></div>
    <div class="entry-card"><div class="entry-icon icon-char">✦</div><div class="entry-body"><div class="entry-name">角色图鉴</div><div class="entry-desc">${CHARACTERS.length} 位角色</div></div><div class="entry-arrow">›</div></div>
  </div>
  <div class="filter-row"><div class="filter-inner">`;
FILTERS.forEach(f => { html += `<span class="chip${f[0]==='all' ? ' chip-active' : ''}">${f[1]}</span>`; });
html += `</div></div><div class="pair-list">`;

pairs.forEach(p => {
  const ac = CAMP_COLOR[p.fromCampCls], bc = CAMP_COLOR[p.toCampCls], rc = REL_COLOR[p.relType];
  const tag = p.special ? '★ ' : '';
  html += `<div class="pair-card" style="${p.special ? 'border-color:rgba(242,178,51,.35)' : ''}">
    <div class="pair-char">
      <div class="pair-avatar" style="border-color:${ac}">
        ${p.fromAvatar ? `<img class="pair-avatar-img" src="${toFile(p.fromAvatar)}"/>` : `<div class="pair-avatar-fallback" style="background:${fbg[p.fromCampCls]}">${p.fromFirst}</div>`}
      </div>
      <div class="pair-name">${p.fromCn}</div>
      <div class="pair-en">${p.fromEn}</div>
      <div class="pair-camp" style="background:${pillBg[p.fromCampCls]};color:${ac}">${p.fromCampLabel}</div>
    </div>
    <div class="pair-relation">
      <div class="pair-line"></div>
      <div class="pair-type" style="color:${rc}">${tag}${p.relLabel}</div>
      <div class="pair-line"></div>
    </div>
    <div class="pair-char">
      <div class="pair-avatar" style="border-color:${bc}">
        ${p.toAvatar ? `<img class="pair-avatar-img" src="${toFile(p.toAvatar)}"/>` : `<div class="pair-avatar-fallback" style="background:${fbg[p.toCampCls]}">${p.toFirst}</div>`}
      </div>
      <div class="pair-name">${p.toCn}</div>
      <div class="pair-en">${p.toEn}</div>
      <div class="pair-camp" style="background:${pillBg[p.toCampCls]};color:${bc}">${p.toCampLabel}</div>
    </div>
    <div class="pair-footer">共同出演 ${p.coCount} 部</div>
  </div>`;
});
html += `</div><div class="bottom-pad"></div></div></body></html>`;

fs.writeFileSync(path.join(__dirname, 'explore_v12_preview.html'), html, 'utf8');
console.log('WROTE explore_v12_preview.html | pairs:', pairs.length);
console.log('avatar 覆盖: 全部', pairs.every(p => p.fromAvatar && p.toAvatar) ? '真实图' : '有兜底');
