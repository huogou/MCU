/* V1.2 Step2 电影详情验证：生成 HTML 预览（真实 mcuData + CDN 海报/剧照 + 最新 CSS 修正）
 * 示例片：avengers（复仇者联盟） */
const fs = require('fs');
const path = require('path');
const mcuData = require('../models/mcuData.js');
const userState = require('../models/userState.js');
const recommend = require('../models/recommend.js');
const { TYPE_LABEL, IMPORTANCE_LABEL } = require('../data/content.js');
const { PHASE } = require('../data/constants.js');

const ID = 'avengers';
const m = mcuData.get(ID);
if (!m) throw new Error('no movie ' + ID);

/* 与 movie.js 一致的视图装配 */
const CAMP_MAP = { avengers:{cls:'red',label:'复仇者'}, asgard:{cls:'blue',label:'阿斯加德'}, guardians:{cls:'purple',label:'银河护卫队'}, wakanda:{cls:'gold',label:'瓦坎达'}, shield:{cls:'blue',label:'神盾局'}, mutant:{cls:'purple',label:'变种人'}, villain:{cls:'gray',label:'反派'}, street:{cls:'red',label:'街头英雄'} };
function campCls(c) { return CAMP_MAP[c] || { cls: 'gray', label: c || '' }; }
const cnPhase = { 1:'一', 2:'二', 3:'三', 4:'四', 5:'五', 6:'六' };
const phase = m.phase || 1;
const phaseColor = PHASE[phase];
function hexToRgba(hex, a) {
  const h = hex.replace('#', '');
  return 'rgba(' + parseInt(h.substring(0, 2), 16) + ',' + parseInt(h.substring(2, 4), 16) + ',' + parseInt(h.substring(4, 6), 16) + ',' + a + ')';
}
const v = mcuData.visual(ID);
const posterImg = v.poster || '';
const heroBg = v.backdrop
  ? `background-image: linear-gradient(160deg, ${hexToRgba(phaseColor, 0.38)} 0%, ${hexToRgba(phaseColor, 0.12)} 42%, #0B0E14 100%), url("${v.backdrop}"); background-size: cover; background-position: center;`
  : `background: linear-gradient(160deg, ${hexToRgba(phaseColor, 0.08)}, transparent 50%, #0B0E14);`;
const chips = [{ t: TYPE_LABEL[m.type] || '电影' }, { t: 'Phase ' + phase }, { t: IMPORTANCE_LABEL[m.importance] || '' }].filter(c => c.t);
const mainChars = (m.chars || []).slice(0, 4).map(function (cid) {
  const c = mcuData.getChar(cid);
  if (!c) return null;
  const camp = campCls(c.camp);
  const parts = (c.cn || '').split(' / ');
  return { name: parts.length > 1 ? parts[1] : (parts[0] || ''), initial: (c.cn || '').charAt(0), avatar: mcuData.avatar(cid) || '', factionCls: 'fbg-' + camp.cls, ringCls: 'fring-' + camp.cls, factionLabel: camp.label };
}).filter(Boolean);
const nb = mcuData.panoNeighbors(ID);
function seqCard(mm, label, cur) {
  if (!mm) return { letter: '?', name: '—', poster: '', cur: cur, label: label };
  const vv = mcuData.visual(mm.id);
  return { letter: (mm.cn || '?').charAt(0), name: mm.cn, poster: (vv && vv.poster) || '', cur: cur, label: label };
}
const seqPrev = seqCard(nb.prev, '前一部', false);
const seqCur = seqCard(m, '当前', true);
const seqNext = seqCard(nb.next, '下一部', false);
const nx = recommend.next(ID, 'mainline');
const nextRec = (nx && nx.content) ? { cn: nx.content.cn, poster: (mcuData.visual(nx.content.id).poster) || '', letter: (nx.content.cn || '').charAt(0), why: nx.why || '' } : null;

const css = `
*{margin:0;padding:0;box-sizing:border-box}
body{width:375px;background:#0B0E14;color:#E8ECF4;font-family:-apple-system,"PingFang SC",sans-serif}
.page{min-height:100vh;background:#0B0E14}
.nav{display:flex;align-items:center;gap:20px;padding:20px 36px 8px;font-size:22px;color:#A8B0C0}
.hero{padding:28px 36px 36px;display:flex;flex-direction:column;align-items:center;text-align:center;border-bottom:1px solid #232B3B}
.hero-ph{font-size:22px;color:#F2B233;margin-bottom:8px}
.hero-title{font-size:36px;font-weight:700;color:#E8ECF4;margin-bottom:8px}
.hero-en{font-size:22px;color:#6B7384;margin-bottom:24px}
.poster{width:220px;height:320px;border-radius:20px;object-fit:cover;border:4px solid rgba(242,178,51,.2)}
.poster-fallback{width:220px;height:320px;border-radius:20px;display:flex;align-items:center;justify-content:center;font-size:72px;font-weight:700;color:rgba(255,255,255,.5);background:linear-gradient(135deg,#5B8DEF,rgba(91,141,239,.6))}
.chips{display:flex;gap:8px;margin-top:20px}
.chip{font-size:22px;padding:6px 16px;border-radius:999px;border:1px solid #232B3B;color:#A8B0C0;background:#141925}
.chip-gold{color:#F2B233;border-color:rgba(242,178,51,.35);background:rgba(242,178,51,.10)}
.cta{width:100%;height:88px;border-radius:16px;background:linear-gradient(135deg,#F2B233,#D9962A);color:#0B0E14;font-size:28px;font-weight:600;display:flex;align-items:center;justify-content:center;margin-top:24px;box-shadow:0 8px 24px rgba(242,178,51,.25)}
.card{background:#141925;border:1px solid #232B3B;border-radius:20px;padding:28px;margin:20px 36px 0}
.card-title{font-size:28px;font-weight:600;color:#E8ECF4;margin-bottom:20px}
.cast-row{display:flex;gap:24px}
.cast-item{width:25%;text-align:center}
.cast-avatar{width:40px;height:40px;border-radius:50%;border:2px solid transparent;overflow:hidden;margin:0 auto 8px;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:600;color:rgba(255,255,255,.7)}
.fill-img{width:100%;height:100%;object-fit:cover;display:block;border-radius:50%}
.cast-name{font-size:22px;color:#E8ECF4;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cast-faction{font-size:20px;color:#6B7384;margin-top:4px}
.seq-row{display:flex;gap:20px}
.seq-card{flex:1;background:#0F141E;border:2px solid #232B3B;border-radius:16px;padding:20px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:8px}
.seq-current{background:rgba(242,178,51,.10);border-color:rgba(242,178,51,.35)}
.seq-poster{width:40px;height:60px;border-radius:6px;overflow:hidden;display:flex;align-items:center;justify-content:center;background:#141925;font-size:16px;font-weight:600;color:rgba(255,255,255,.5)}
.seq-label{font-size:20px;color:#6B7384}
.seq-name{font-size:20px;color:#E8ECF4;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;width:100%}
.next-row{display:flex;gap:20px;align-items:center}
.next-poster{width:50px;height:72px;border-radius:6px;overflow:hidden;display:flex;align-items:center;justify-content:center;background:#141925;font-size:18px;font-weight:600;color:rgba(255,255,255,.5)}
.next-info{flex:1;min-width:0}
.next-label{font-size:20px;color:#F2B233;font-weight:600;margin-bottom:8px}
.next-title{font-size:28px;font-weight:600;color:#E8ECF4;margin-bottom:8px}
.next-desc{font-size:22px;color:#6B7384}
.fbg-red{background:linear-gradient(135deg,#E85D5D,rgba(232,93,93,.6))}.fbg-blue{background:linear-gradient(135deg,#4A9EF5,rgba(74,158,245,.6))}
.fring-red{border-color:rgba(232,93,93,.2)}.fring-blue{border-color:rgba(74,158,245,.2)}.fring-purple{border-color:rgba(155,127,232,.2)}
.bottom{padding:40px}
`;

let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${css}</style></head><body><div class="page">
  <div class="nav">‹ 返回　${m.cn}</div>
  <div class="hero" style="${heroBg}">
    <div class="hero-ph">第${cnPhase[phase]}阶段${m.year ? ' · ' + m.year : ''}</div>
    <div class="hero-title">${m.cn}</div>
    <div class="hero-en">${m.en || ''}</div>
    ${posterImg ? `<img class="poster" src="${posterImg}"/>` : `<div class="poster-fallback">${(m.cn||'?').charAt(0)}</div>`}
    <div class="chips">${chips.map(c => `<span class="chip ${c.t.indexOf('必看') >= 0 ? 'chip-gold' : ''}">${c.t}</span>`).join('')}</div>
    <div class="cta">标记为已看</div>
  </div>
  <div class="card"><div class="card-title">主要角色</div><div class="cast-row">
    ${mainChars.map(c => `<div class="cast-item"><div class="cast-avatar ${c.ringCls} ${c.factionCls}">${c.avatar ? `<img class="fill-img" src="file:///D:/SEO/%E5%8F%91%E6%8C%A5%E4%BD%99%E7%83%AD/%E6%BC%AB%E5%A8%81%E7%94%B5%E5%BD%B1%E5%AE%87%E5%AE%99%E5%AF%BC%E8%88%AA/mcu-miniprogram${c.avatar}"/>` : `<span>${c.initial}</span>`}</div><div class="cast-name">${c.name}</div><div class="cast-faction">${c.factionLabel}</div></div>`).join('')}
  </div></div>
  <div class="card"><div class="card-title">观影顺序</div><div class="seq-row">
    <div class="seq-card"><div class="seq-poster">${seqPrev.poster ? `<img class="fill-img" style="border-radius:0" src="${seqPrev.poster}"/>` : seqPrev.letter}</div><div class="seq-label">${seqPrev.label}</div><div class="seq-name">${seqPrev.name}</div></div>
    <div class="seq-card seq-current"><div class="seq-poster">${seqCur.poster ? `<img class="fill-img" style="border-radius:0" src="${seqCur.poster}"/>` : seqCur.letter}</div><div class="seq-label">${seqCur.label}</div><div class="seq-name">${seqCur.name}</div></div>
    <div class="seq-card"><div class="seq-poster">${seqNext.poster ? `<img class="fill-img" style="border-radius:0" src="${seqNext.poster}"/>` : seqNext.letter}</div><div class="seq-label">${seqNext.label}</div><div class="seq-name">${seqNext.name}</div></div>
  </div></div>
  ${nextRec ? `<div class="card"><div class="next-row">
    <div class="next-poster">${nextRec.poster ? `<img class="fill-img" style="border-radius:0" src="${nextRec.poster}"/>` : nextRec.letter}</div>
    <div class="next-info"><div class="next-label">看完这部之后</div><div class="next-title">${nextRec.cn}</div><div class="next-desc">${nextRec.why || ''}</div></div>
  </div></div>` : ''}
  <div class="bottom"></div>
</div></body></html>`;

fs.writeFileSync('D:/tmp/movie_preview.html', html, 'utf8');
console.log('WROTE D:/tmp/movie_preview.html | movie:', m.cn);
console.log('poster:', posterImg ? 'REAL' : 'FALLBACK', '| backdrop:', v.backdrop ? 'REAL' : 'FALLBACK');
console.log('cast:', mainChars.map(c => c.name + (c.avatar ? '(IMG)' : '(fb)')).join(', '));
console.log('seq prev/next:', seqPrev.name, '/', seqNext.name, '| nextRec:', nextRec ? nextRec.cn : 'none');
