/* 生成 角色详情 视觉预览 HTML（像素级验证用）
 * 严格镜像 character.wxss + app.wxss Token（rpx÷2=px，375px 视口）
 * 数据：通过真实 mcuData 取 Tony Stark（camp=avengers/red），验证数据链路。
 */
const fs = require('fs');
const path = require('path');
const mcuData = require('../models/mcuData.js');
const { CHARACTERS } = require('../data/characters.js');
const { TYPE_LABEL } = require('../data/content.js');

const CDN = 'https://mcu-d6gw0brqoa9521b58-1307093647.tcloudbaseapp.com';
const id = 'tony';
const char = mcuData.getChar(id);
const CAMP_MAP = {
  avengers:'red', guardians:'purple', asgard:'blue', wakanda:'gold',
  shield:'blue', mutant:'purple', villain:'gray', street:'red'
};
function factionOf(camp){ return { cls: CAMP_MAP[camp]||'gray', label: camp||'' }; }

const av = mcuData.visual('char-' + char.id);
const first = mcuData.get(char.first);
const firstCard = {
  cn: first.cn, en: first.en, phase: first.phase||1,
  typeLabel: TYPE_LABEL[first.type]||'',
  poster: (mcuData.visual(first.id).poster)||'',
  posterClass: 'poster-p'+(first.phase||1),
  letter: (first.cn||'?').charAt(0)
};
const films = mcuData.filmsOfChar(id).map(function(m){
  const v = mcuData.visual(m.id);
  return {
    cn:m.cn, en:m.en, phase:m.phase||1, typeLabel:TYPE_LABEL[m.type]||'',
    poster:(v&&v.poster)?v.poster:'', posterClass:'poster-p'+(m.phase||1),
    letter:(m.cn||'?').charAt(0), status:'watching'
  };
});
// relatedChars 复刻
const myFilms = {};
mcuData.filmsOfChar(id).forEach(function(m){ myFilms[m.id]=true; });
const rel = [];
CHARACTERS.forEach(function(c){
  if(c.id===id) return;
  const shared = mcuData.filmsOfChar(c.id).filter(function(m){ return myFilms[m.id]; });
  if(shared.length) rel.push({ id:c.id, cn:c.cn, camp:c.camp, shared:shared.length });
});
rel.sort(function(a,b){ return b.shared-a.shared; });
const related = rel.slice(0,6).map(function(r){
  const f = factionOf(r.camp);
  return {
    cn:r.cn, shared:r.shared, avatar:(r.cn||'?').charAt(0),
    ringCls:'fring-'+f.cls, factionCls:'fbg-'+f.cls, fcCls:'fc-'+f.cls,
    pillCls:'pill-'+f.cls
  };
});

const f = factionOf(char.camp);
const faction = { cls:f.cls, label:f.label, ringCls:'fring-'+f.cls, factionCls:'fbg-'+f.cls };

// ---- CSS（app.wxss Token 镜像，rpx÷2=px）----
const css = `
*{box-sizing:border-box;margin:0;padding:0;}
body{width:375px;background:#080B12;color:#E8ECF4;font-family:-apple-system,"PingFang SC",sans-serif;font-size:14px;line-height:1.5;}
.mcu-page{min-height:100vh;background:#080B12;padding:0 18px;}
.hero{padding:28px 0 28px;display:flex;flex-direction:column;align-items:center;text-align:center;}
.hero-red{background:linear-gradient(160deg,rgba(232,93,93,0.10),#161D2B 65%);}
.hero-blue{background:linear-gradient(160deg,rgba(74,158,245,0.10),#161D2B 65%);}
.hero-purple{background:linear-gradient(160deg,rgba(155,127,232,0.10),#161D2B 65%);}
.hero-gold{background:linear-gradient(160deg,rgba(242,178,51,0.04),#161D2B 65%);}
.hero-gray{background:#161D2B;}
.hero-avatar{width:64px;height:64px;border-radius:50%;border:2px solid transparent;overflow:hidden;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:700;color:rgba(255,255,255,0.6);}
.hero-cn{font-size:22px;font-weight:700;color:#E8ECF4;margin-top:14px;line-height:1.3;}
.hero-en{font-size:12px;color:#8E98AA;margin-top:4px;}
.hero-meta{display:flex;align-items:center;gap:10px;margin-top:10px;}
.hero-camp{font-size:11px;font-weight:600;padding:3px 10px;border-radius:999px;}
.hero-count{font-size:11px;color:#555F73;}
.card{background:#1E2636;border:1px solid #2A3447;border-radius:10px;padding:14px;margin-bottom:14px;}
.card-title{font-size:14px;font-weight:600;color:#F2B233;margin-bottom:10px;letter-spacing:1px;}
.char-note{font-size:14px;color:#8E98AA;line-height:1.7;}
.first-row,.film-row{display:flex;align-items:center;}
.first-poster{width:60px;height:90px;border-radius:6px;overflow:hidden;margin-right:10px;flex-shrink:0;display:flex;align-items:center;justify-content:center;border:1px solid #2A3447;}
.film-poster{width:40px;height:60px;border-radius:6px;overflow:hidden;margin-right:10px;flex-shrink:0;display:flex;align-items:center;justify-content:center;border:1px solid #2A3447;}
.poster-fallback{width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-weight:700;color:rgba(255,255,255,0.6);}
.first-poster .poster-fallback{font-size:22px;}
.film-poster .poster-fallback{font-size:14px;}
.fill-img{width:100%;height:100%;display:block;object-fit:cover;}
.film-info{flex:1;min-width:0;}
.film-cn{font-size:14px;color:#E8ECF4;font-weight:600;}
.film-en{font-size:11px;color:#8E98AA;margin-top:2px;}
.phase-tag{font-size:11px;color:#555F73;border:1px solid #2A3447;border-radius:5px;padding:3px 7px;flex-shrink:0;}
.film-status{font-size:11px;padding:3px 8px;border-radius:10px;flex-shrink:0;}
.status-unwatched{color:#F2B233;background:rgba(242,178,51,0.15);}
.status-watching{color:#3FB98A;background:rgba(63,185,138,0.15);}
.status-watched{color:#555F73;background:#2A3447;}
.film-list{display:flex;flex-direction:column;gap:10px;}
.related-grid{display:flex;flex-wrap:wrap;gap:10px;}
.related-item{width:calc((100% - 20px) / 3);background:#161D2B;border:1px solid #2A3447;border-radius:8px;padding:14px 6px;display:flex;flex-direction:column;align-items:center;text-align:center;}
.related-avatar{width:40px;height:40px;border-radius:50%;border:2px solid transparent;overflow:hidden;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:700;color:rgba(255,255,255,0.6);}
.related-avatar .poster-fallback{font-size:18px;}
.related-cn{font-size:12px;font-weight:600;color:#E8ECF4;margin-top:7px;line-height:1.3;}
.related-shared{font-size:9.5px;color:#555F73;margin-top:3px;}
/* 阵营色 */
.fc-red{color:#E85D5D;}.fc-blue{color:#4A9EF5;}.fc-purple{color:#9B7FE8;}.fc-gold{color:#F2B233;}.fc-gray{color:#555F73;}
.fring-red{border-color:rgba(232,93,93,0.20);}.fring-blue{border-color:rgba(74,158,245,0.20);}.fring-purple{border-color:rgba(155,127,232,0.20);}.fring-gold{border-color:rgba(242,178,51,0.20);}.fring-gray{border-color:#2A3447;}
.fbg-red{background:linear-gradient(135deg,#E85D5D,rgba(232,93,93,0.60));}
.fbg-blue{background:linear-gradient(135deg,#4A9EF5,rgba(74,158,245,0.60));}
.fbg-purple{background:linear-gradient(135deg,#9B7FE8,rgba(155,127,232,0.60));}
.fbg-gold{background:linear-gradient(135deg,#F2B233,rgba(242,178,51,0.60));}
.fbg-gray{background:#2A3447;}
.pill-red{background:rgba(232,93,93,0.10);color:#E85D5D;}.pill-blue{background:rgba(74,158,245,0.10);color:#4A9EF5;}.pill-purple{background:rgba(155,127,232,0.10);color:#9B7FE8;}.pill-gold{background:rgba(242,178,51,0.10);color:#F2B233;}.pill-gray{background:#2A3447;color:#555F73;}
.poster-p1{background:linear-gradient(135deg,#5B8DEF,rgba(91,141,239,0.60));}
.poster-p2{background:linear-gradient(135deg,#28B487,rgba(40,180,135,0.60));}
.poster-p3{background:linear-gradient(135deg,#F0A932,rgba(240,169,50,0.60));}
.poster-p4{background:linear-gradient(135deg,#8B6FE8,rgba(139,111,232,0.60));}
.poster-p5{background:linear-gradient(135deg,#E8483F,rgba(232,72,63,0.60));}
.poster-p6{background:linear-gradient(135deg,#C25B8E,rgba(194,91,142,0.60));}
.bottom-pad{height:30px;}
`;

function posterBlock(p){
  return p.poster
    ? '<img class="fill-img" src="'+p.poster+'"/>'
    : '<span class="poster-fallback">'+p.letter+'</span>';
}
const statusLabel = {watched:'已看',watching:'在看',unwatched:'未看'};

const firstHtml = `
<div class="card">
  <div class="card-title">首次出现</div>
  <div class="first-row">
    <div class="first-poster ${firstCard.posterClass}">${posterBlock(firstCard)}</div>
    <div class="film-info">
      <div class="film-cn">${firstCard.cn}</div>
      <div class="film-en">${firstCard.en}${firstCard.typeLabel?' · '+firstCard.typeLabel:''}</div>
    </div>
    <div class="phase-tag">P${firstCard.phase}</div>
  </div>
</div>`;

const filmsHtml = `
<div class="card">
  <div class="card-title">关联作品（${films.length}）</div>
  <div class="film-list">
    ${films.map(function(m){ return `
    <div class="film-row">
      <div class="film-poster ${m.posterClass}">${posterBlock(m)}</div>
      <div class="film-info">
        <div class="film-cn">${m.cn}</div>
        <div class="film-en">${m.en}${m.typeLabel?' · '+m.typeLabel:''}</div>
      </div>
      <div class="film-status status-${m.status}">${statusLabel[m.status]||m.status}</div>
    </div>`; }).join('')}
  </div>
</div>`;

const relatedHtml = `
<div class="card">
  <div class="card-title">关系探索</div>
  <div class="related-grid">
    ${related.map(function(r){ return `
    <div class="related-item">
      <div class="related-avatar ${r.ringCls} ${r.factionCls}"><span class="poster-fallback">${r.avatar}</span></div>
      <div class="related-cn">${r.cn}</div>
      <div class="related-shared">共同出演 ${r.shared} 部</div>
    </div>`; }).join('')}
  </div>
</div>`;

const heroAvatar = av && av.poster
  ? '<img class="fill-img" src="'+av.poster+'"/>'
  : '<span class="poster-fallback">'+ (char.cn||'?').charAt(0) +'</span>';

const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${css}</style></head>
<body>
<div class="mcu-page">
  <div class="hero hero-${faction.cls}">
    <div class="hero-avatar ${faction.ringCls} ${faction.factionCls}">${heroAvatar}</div>
    <div class="hero-cn">${char.cn}</div>
    <div class="hero-en">${char.en}</div>
    <div class="hero-meta">
      <div class="hero-camp pill-${faction.cls}">${faction.label}</div>
      <div class="hero-count">${films.length} 部关联作品</div>
    </div>
  </div>
  <div class="card"><div class="card-title">角色简介</div><div class="char-note">${char.note}</div></div>
  ${firstHtml}
  ${filmsHtml}
  ${relatedHtml}
  <div class="bottom-pad"></div>
</div>
</body></html>`;

fs.writeFileSync('D:/tmp/character_preview.html', html, 'utf8');
console.log('WROTE D:/tmp/character_preview.html');
console.log('char:', char.cn, '| camp:', faction.cls, '| films:', films.length, '| related:', related.length);
console.log('firstPoster:', firstCard.poster ? 'REAL' : 'FALLBACK');
films.forEach(function(m){ console.log('  film', m.cn, m.poster?'REAL':'FALLBACK'); });
related.forEach(function(r){ console.log('  rel', r.cn, r.factionCls); });
