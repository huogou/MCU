/* V1.2 Phase1 首页 VDS 版验证：Hero Banner + 简化旅程卡 + 2×2 入口（真实资源） */
const fs = require('fs');
const path = require('path');
const mcuData = require('../models/mcuData.js');
const userState = require('../models/userState.js');
const recommend = require('../models/recommend.js');

const ROOT = path.resolve(__dirname, '..');
function toFile(p) {
  if (!p) return '';
  if (/^https?:/.test(p)) return p;
  return 'file:///' + path.join(ROOT, p.replace(/^\//, '')).replace(/\\/g, '/');
}

const HOT_CHAR_IDS = ['tony', 'steve', 'thor', 'peter'];
const SAGA_LABEL = { infinity: '无限传奇', multiverse: '多元宇宙' };
const CAMP_MAP = { avengers:{cls:'red',label:'复仇者'}, asgard:{cls:'blue',label:'阿斯加德'}, guardians:{cls:'purple',label:'银河护卫队'}, wakanda:{cls:'gold',label:'瓦坎达'}, shield:{cls:'blue',label:'神盾局'} };
const ENTRY_CARDS = [
  { key:'watch', title:'开始观看', desc:'38 部 · 按序排列', icon:'▶' },
  { key:'timeline', title:'宇宙时间线', desc:'6 阶段 · 脉络清晰', icon:'◷' },
  { key:'characters', title:'角色图鉴', desc:'24 位 · 阵营关系', icon:'✦' },
  { key:'relationships', title:'关系探索', desc:'92 条 · 网络图谱', icon:'⬡' }
];
function heroOf(cn){ const p=(cn||'').split('/'); return p.length>1?p[1].trim():(cn||''); }
function movieVM(id){
  const m = mcuData.get(id); if(!m) return null;
  const v = mcuData.visual(id); const ph = m.phase||1;
  return { id:m.id, poster:(v&&v.poster)||null, backdrop:(v&&v.backdrop)||null, name:m.cn, enName:m.en||'',
    phaseText:'Phase '+ph+(SAGA_LABEL[m.saga]?' · '+SAGA_LABEL[m.saga]:''), year:m.year?String(m.year):'', initial:m.cn.charAt(0), phase:ph };
}
const count = userState.count();
const total = mcuData.all.length;
const hasProgress = count > 0;
const state = userState.getState();
const watched = state.watched || {};
const latest = userState.latest();
const progressPercent = total>0 ? Math.min(100, Math.round(count/total*100)) : 0;

const currentId = (hasProgress && latest) ? latest.id : 'iron-man';
const cur = movieVM(currentId);
const isCurrent = !watched[currentId];
const progress = {
  count, total, journeyLabel:'我的 MCU 旅程',
  phaseText: hasProgress ? cur.phaseText : 'Phase 1 · 无限传奇',
  movie:{ id:cur.id, poster:cur.poster, name:cur.name, enName:cur.enName, phaseText:cur.phaseText, year:cur.year, initial:cur.initial, phase:cur.phase, statusLabel:isCurrent?'继续观看':'已观看' }
};
let recMovie = movieVM('iron-man');
if (hasProgress && latest){ const r = recommend.next(latest.id,'mainline'); if(r&&r.content) recMovie = movieVM(r.content.id); }
const recommendCard = { id:recMovie.id, poster:recMovie.poster, initial:recMovie.initial, phase:recMovie.phase, tag:'推荐下一部', name:recMovie.name, subInfo:recMovie.year?('Phase '+recMovie.phase+' · '+recMovie.year):recMovie.phaseText, reason:hasProgress?'上一部留下的悬念，从这里继续':'MCU 的起点，一切从这里开始', cta:hasProgress?'继续观看':'开始观看' };
const hotChars = HOT_CHAR_IDS.map(function(id){ const c=mcuData.getChar(id); if(!c)return null; const n=heroOf(c.cn); const camp=CAMP_MAP[c.camp]||CAMP_MAP.avengers; return {id,name:n,initial:n.charAt(0),factionCls:camp.cls,factionLabel:camp.label,poster:mcuData.avatar(id)||''}; }).filter(Boolean);

const heroBanner = toFile(mcuData.heroBanner() || '');
const entryCards = ENTRY_CARDS.map(e => ({ ...e, bg: toFile(mcuData.entryBg(e.key) || '') }));

let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#0B0E14;font-family:-apple-system,'PingFang SC','Microsoft YaHei',sans-serif;width:375px;color:#E8ECF4}
.page{padding:0 36px 72px;min-height:100vh;background:#0B0E14}
/* Hero Banner */
.hero-banner{position:relative;width:auto;height:210px;overflow:hidden;margin:0 -36px}
.hero-banner-bg{position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover}
.hero-banner-overlay{position:absolute;top:0;left:0;right:0;bottom:0;background:linear-gradient(to bottom,rgba(8,11,18,.2) 0%,rgba(8,11,18,.1) 40%,rgba(8,11,18,.7) 80%,#0B0E14 100%)}
.hero-banner-content{position:absolute;bottom:0;left:0;right:0;padding:0 36px 56px}
.hero-banner-tag{font-size:22px;font-weight:600;color:#F2B233;letter-spacing:4px;margin-bottom:8px}
.hero-banner-title{font-size:56px;font-weight:700;color:#fff;line-height:1.2}
.hero-banner-sub{font-size:24px;color:#A8B0C0;margin-top:8px}
.hero-journey-bar{display:flex;align-items:center;background:#161D2B;border:1px solid #2A3447;border-radius:999px;padding:8px 20px;margin-top:28px}
.hero-journey-progress{flex:1;height:6px;background:#2A3447;border-radius:999px;margin-right:20px;overflow:hidden}
.hero-journey-fill{height:100%;background:#F2B233;border-radius:999px}
.hero-journey-text{font-size:22px;color:#F2B233;font-weight:600;white-space:nowrap}
/* 旅程卡简化 */
.journey-card{background:#161D2B;border:1px solid #2A3447;border-radius:32px;margin-top:28px;margin-bottom:56px;padding:28px}
.journey-label{font-size:24px;color:#A8B0C0;letter-spacing:2px;margin-bottom:20px}
.journey-movie{display:flex;align-items:center}
.jm-poster{width:88px;height:132px;border-radius:12px;object-fit:cover;flex-shrink:0}
.jm-info{flex:1;min-width:0;margin-left:28px}
.jm-name{font-size:28px;font-weight:600;color:#E8ECF4}
.jm-en{font-size:22px;color:#A8B0C0;margin-top:8px}
.jm-phase{font-size:22px;color:#6B7384;margin-top:8px}
.jm-cta{flex-shrink:0;font-size:22px;font-weight:600;color:#F2B233;background:rgba(242,178,51,.10);padding:10px 28px;border-radius:999px;margin-left:20px}
/* 推荐卡 */
.rec-card{background:#161D2B;border-radius:32px;overflow:hidden;box-shadow:0 8px 24px rgba(0,0,0,.4);margin-bottom:56px}
.rec-poster-wrap{position:relative;width:100%;height:180px}
.rec-poster{width:100%;height:180px;object-fit:cover}
.rec-poster-mask{position:absolute;left:0;right:0;bottom:0;height:100px;background:linear-gradient(to top,#161D2B,transparent)}
.rec-body{padding:28px}
.rec-tag{font-size:22px;font-weight:600;color:#F2B233;letter-spacing:2px}
.rec-name{font-size:36px;font-weight:600;color:#E8ECF4;margin-top:8px}
.rec-sub{font-size:24px;color:#A8B0C0;margin-top:8px}
.rec-reason{font-size:24px;color:#A8B0C0;line-height:1.5;margin-top:20px}
.btn-accent{height:88px;line-height:88px;text-align:center;border-radius:16px;background:linear-gradient(135deg,#F2B233,#D9962A);color:#0B0E14;font-size:28px;font-weight:600;margin-top:28px;box-shadow:0 8px 24px rgba(242,178,51,.25)}
/* 2x2 入口 */
.section{margin-top:56px}
.module-title{font-size:36px;font-weight:600;color:#E8ECF4;margin-bottom:28px}
.entry-grid{display:flex;flex-wrap:wrap;gap:20px}
.entry-visual-card{width:calc((100% - 20px)/2);height:120px;border-radius:20px;overflow:hidden;position:relative}
.evc-bg{position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover}
.evc-overlay{position:absolute;top:0;left:0;right:0;bottom:0;background:linear-gradient(135deg,rgba(8,11,18,.75) 0%,rgba(8,11,18,.45) 100%)}
.evc-content{position:relative;height:100%;padding:28px;display:flex;flex-direction:column;justify-content:flex-end}
.evc-icon{width:56px;height:56px;border-radius:16px;background:rgba(242,178,51,.15);color:#F2B233;font-size:32px;display:flex;align-items:center;justify-content:center;margin-bottom:20px}
.evc-title{font-size:36px;font-weight:700;color:#fff;line-height:1.2}
.evc-desc{font-size:22px;color:#A8B0C0;margin-top:4px}
/* 热门角色 */
.char-row{display:flex;gap:28px}
.char-card{width:120px;text-align:center;background:#1E2636;border-radius:16px;padding:20px 8px}
.char-avatar{width:96px;height:96px;border-radius:50%;border:3px solid;margin:0 auto 20px;overflow:hidden;display:flex;align-items:center;justify-content:center}
.char-img{width:100%;height:100%;object-fit:cover}
.char-name{font-size:28px;font-weight:600;color:#E8ECF4;margin-top:20px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.char-faction{font-size:22px;margin-top:8px}
.fc-red{color:#E85D5D}.fc-blue{color:#4A9EF5}.fc-gold{color:#F2B233}
</style></head><body><div class="page">

  <div class="hero-banner">
    <img class="hero-banner-bg" src="${heroBanner}"/>
    <div class="hero-banner-overlay"></div>
    <div class="hero-banner-content">
      <div class="hero-banner-tag">MCU 宇宙入口</div>
      <div class="hero-banner-title">探索无限传奇</div>
      <div class="hero-banner-sub">${total} 部 · 24 角色 · 6 阶段</div>
      <div class="hero-journey-bar">
        <div class="hero-journey-progress"><div class="hero-journey-fill" style="width:${progressPercent}%"></div></div>
        <div class="hero-journey-text">${progress.count}/${progress.total}</div>
      </div>
    </div>
  </div>

  <div class="journey-card">
    <div class="journey-label">${progress.journeyLabel} · ${progress.phaseText}</div>
    <div class="journey-movie">
      ${progress.movie.poster ? `<img class="jm-poster" src="${progress.movie.poster}"/>` : ''}
      <div class="jm-info">
        <div class="jm-name">${progress.movie.name}</div>
        <div class="jm-en">${progress.movie.enName}</div>
        <div class="jm-phase">${progress.movie.phaseText}${progress.movie.year ? ' · ' + progress.movie.year : ''}</div>
      </div>
      <div class="jm-cta">${progress.movie.statusLabel}</div>
    </div>
  </div>

  <div class="rec-card">
    <div class="rec-poster-wrap">
      ${recommendCard.poster ? `<img class="rec-poster" src="${recommendCard.poster}"/>` : ''}
      <div class="rec-poster-mask"></div>
    </div>
    <div class="rec-body">
      <div class="rec-tag">${recommendCard.tag}</div>
      <div class="rec-name">${recommendCard.name}</div>
      <div class="rec-sub">${recommendCard.subInfo}</div>
      <div class="rec-reason">${recommendCard.reason}</div>
      <div class="btn-accent">${recommendCard.cta}</div>
    </div>
  </div>

  <div class="section"><div class="module-title">宇宙入口</div><div class="entry-grid">
    ${entryCards.map(c => `<div class="entry-visual-card">
      <img class="evc-bg" src="${c.bg}"/>
      <div class="evc-overlay"></div>
      <div class="evc-content">
        <div class="evc-icon">${c.icon}</div>
        <div class="evc-title">${c.title}</div>
        <div class="evc-desc">${c.desc}</div>
      </div>
    </div>`).join('')}
  </div></div>

  <div class="section"><div class="module-title">热门角色</div><div class="char-row">
    ${hotChars.map(c => `<div class="char-card">
      <div class="char-avatar" style="border-color:rgba(232,93,93,.2)">
        ${c.poster ? `<img class="char-img" src="${toFile(c.poster)}"/>` : ''}
      </div>
      <div class="char-name">${c.name}</div>
      <div class="char-faction fc-${c.factionCls}">${c.factionLabel}</div>
    </div>`).join('')}
  </div></div>

</div></body></html>`;

fs.writeFileSync(path.join(__dirname, 'home_vds_preview.html'), html, 'utf8');
console.log('WROTE home_vds_preview.html');
console.log('heroBanner:', heroBanner ? 'REAL' : 'MISSING');
console.log('entryBgs:', entryCards.map(c => c.key + (c.bg ? ':IMG' : ':MISSING')).join(', '));
console.log('progress:', progress.count + '/' + progress.total, progressPercent + '%');
