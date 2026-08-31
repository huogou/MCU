/* V1.2 Step1-4 首页验证：生成 HTML 预览（真实 mcuData + 真实本地资源 + SVG 入口图标 + 修正后间距） */
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

/* 与 home.js 相同的视图装配（新用户态：无观看记录） */
const HOT_CHAR_IDS = ['tony', 'steve', 'thor', 'peter'];
const SAGA_LABEL = { infinity: '无限传奇', multiverse: '多元宇宙' };
const CAMP_MAP = {
  avengers:  { cls: 'red',    label: '复仇者' },
  asgard:    { cls: 'blue',   label: '阿斯加德' },
  guardians: { cls: 'purple', label: '银河护卫队' },
  wakanda:   { cls: 'gold',   label: '瓦坎达' },
  shield:    { cls: 'blue',   label: '神盾局' }
};
const EXPLORE_ENTRIES = [
  { key: 'timeline',   title: '宇宙时间线', bg: 'exp-blue' },
  { key: 'characters', title: '角色图鉴',   bg: 'exp-red' },
  { key: 'relation',   title: '关系探索',   bg: 'exp-purple' }
];
function heroOf(cn) {
  if (!cn) return '';
  const parts = cn.split('/');
  return (parts.length > 1 ? parts[1] : cn).trim();
}
function movieVM(id) {
  const m = mcuData.get(id);
  if (!m) return null;
  const v = mcuData.visual(id);
  const phaseNo = m.phase || 1;
  const saga = SAGA_LABEL[m.saga] || '';
  return {
    id: m.id,
    poster: (v && v.poster) ? v.poster : null,
    backdrop: (v && v.backdrop) ? v.backdrop : null,
    name: m.cn,
    enName: m.en || '',
    phaseText: 'Phase ' + phaseNo + (saga ? ' · ' + saga : ''),
    year: m.year ? String(m.year) : '',
    initial: m.cn.charAt(0),
    phase: phaseNo
  };
}

/* 新用户态装配 */
const count = userState.count();
const hasProgress = count > 0;
const state = userState.getState();
const watched = state.watched || {};
const latest = userState.latest();
const currentId = (hasProgress && latest) ? latest.id : 'iron-man';
const cur = movieVM(currentId);
const isCurrent = !watched[currentId];
const progress = {
  count: count, total: mcuData.all.length, journeyLabel: '我的 MCU 旅程',
  phaseText: hasProgress ? cur.phaseText : 'Phase 1 · 无限传奇',
  movie: {
    id: cur.id, poster: cur.poster, name: cur.name, enName: cur.enName,
    phaseText: cur.phaseText, year: cur.year, initial: cur.initial, phase: cur.phase,
    statusLabel: isCurrent ? '当前观看' : '已观看',
    statusCls: isCurrent ? 'st-current' : 'st-done'
  }
};
let recMovie = movieVM('iron-man');
if (hasProgress && latest) {
  const r = recommend.next(latest.id, 'mainline');
  if (r && r.content) recMovie = movieVM(r.content.id);
}
const recommendCard = {
  id: recMovie.id, poster: recMovie.poster, initial: recMovie.initial, phase: recMovie.phase,
  tag: '推荐下一部', phaseLabel: recMovie.phaseText, name: recMovie.name,
  subInfo: recMovie.year ? ('Phase ' + recMovie.phase + ' · ' + recMovie.year) : recMovie.phaseText,
  reason: hasProgress ? '上一部留下的悬念，从这里继续' : 'MCU 的起点，一切从这里开始',
  cta: hasProgress ? '继续观看' : '开始观看'
};
const hotChars = HOT_CHAR_IDS.map(function (id) {
  const c = mcuData.getChar(id);
  if (!c) return null;
  const heroName = heroOf(c.cn);
  const camp = CAMP_MAP[c.camp] || CAMP_MAP.avengers;
  return {
    id: id, name: heroName, initial: heroName.charAt(0),
    factionCls: camp.cls, factionLabel: camp.label,
    poster: mcuData.avatar(id) || ''
  };
}).filter(Boolean);
const recentIds = Object.keys(watched).sort(function (a, b) { return watched[b] - watched[a]; });
const recent = recentIds.slice(0, 6).map(function (id) {
  const m = mcuData.get(id);
  if (!m) return null;
  const v = mcuData.visual(id);
  return { id: id, name: m.cn, initial: m.cn.charAt(0), poster: (v && v.poster) ? v.poster : '', phase: m.phase || 1 };
}).filter(Boolean);
const homeBg = mcuData.homeBg() || '';

/* 入口图标（SVG data-URI 背景，与 home.wxss 一致，设计§2.3） */
const SVG_TIMELINE = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23F2B233' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='12' cy='12' r='9'/%3E%3Cpolyline points='12 7 12 12 15.5 14'/%3E%3C/svg%3E";
const SVG_CHAR = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23F2B233' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='9' cy='8.5' r='2.8'/%3E%3Cpath d='M3.8 19.2c.7-2.9 2.6-4.6 5.2-4.6s4.5 1.7 5.2 4.6'/%3E%3Ccircle cx='16.5' cy='9.5' r='2.1'/%3E%3Cpath d='M15.4 14.9c1.7.2 3.2 1.3 4.1 3.6'/%3E%3C/svg%3E";
const SVG_REL = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23F2B233' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='5.5' cy='12' r='2'/%3E%3Ccircle cx='18.5' cy='5.5' r='2'/%3E%3Ccircle cx='18.5' cy='18.5' r='2'/%3E%3Cline x1='7.2' y1='10.7' x2='16.6' y2='6.6'/%3E%3Cline x1='7.2' y1='13.3' x2='16.6' y2='17.4'/%3E%3C/svg%3E";
const EXP_ICONS = { timeline: SVG_TIMELINE, characters: SVG_CHAR, relation: SVG_REL };

let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#0B0E14;font-family:-apple-system,'PingFang SC','Microsoft YaHei',sans-serif;width:375px}
.page{padding:56px 36px 56px 36px;min-height:100vh;background:#0B0E14}
.section{margin-bottom:56px}
.module-title{font-size:36px;font-weight:600;color:#E8ECF4;margin-bottom:28px}
/* ① 旅程卡 */
.journey-card{position:relative;overflow:hidden;background:linear-gradient(135deg,#0F141E,#141925);border:1px solid #232B3B;border-radius:32px;margin-bottom:56px}
.journey-bg-img{position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;border-radius:32px;opacity:.85}
.journey-bg{position:absolute;top:0;left:0;right:0;height:200px;
  background:radial-gradient(140px 90px at 18% 28%, rgba(242,178,51,.1), transparent 70%),
             radial-gradient(180px 110px at 82% 18%, rgba(74,158,245,.1), transparent 70%),
             linear-gradient(180deg,#0F141E,transparent);opacity:.9;pointer-events:none}
.journey-inner{position:relative;padding:36px}
.journey-label{font-size:24px;color:#A8B0C0;letter-spacing:2px;margin-bottom:8px}
.journey-num{font-size:56px;font-weight:700;color:#F2B233;line-height:1.2;margin-bottom:8px}
.journey-phase{font-size:24px;color:#6B7384;margin-bottom:24px}
.jm-poster{width:120px;height:160px;border-radius:16px;object-fit:cover;display:block;float:left;margin-right:24px}
.jm-info{overflow:hidden}
.jm-name{font-size:34px;font-weight:700;color:#E8ECF4;margin-bottom:6px}
.jm-en{font-size:22px;color:#6B7384;margin-top:8px}
.jm-phase{font-size:22px;color:#A8B0C0;margin-top:8px;margin-bottom:10px}
.jm-status{display:inline-block;padding:4px 14px;border-radius:999px;font-size:22px}
.st-current{background:rgba(242,178,51,.12);color:#F2B233}
/* ② 推荐卡 */
.rec-card{display:flex;gap:24px;background:#141925;border:1px solid #232B3B;border-radius:32px;padding:28px;margin-bottom:56px}
.rec-poster{width:144px;height:216px;border-radius:20px;object-fit:cover}
.rec-body{flex:1}
.rec-tag{display:inline-block;background:rgba(242,178,51,.15);color:#F2B233;font-size:24px;padding:4px 14px;border-radius:999px;margin-bottom:12px}
.rec-name{font-size:36px;font-weight:600;color:#E8ECF4;margin-bottom:6px}
.rec-sub{font-size:24px;color:#A8B0C0;margin-top:8px;margin-bottom:10px}
.rec-reason{font-size:24px;color:#6B7384;margin-bottom:16px}
.btn-accent{display:flex;align-items:center;justify-content:center;height:88px;border-radius:16px;background:linear-gradient(135deg,#F2B233,#D9962A);color:#0B0E14;font-size:28px;font-weight:600;box-shadow:0 8px 24px rgba(242,178,51,.25)}
/* ③ 入口 */
.exp-row{display:flex;gap:20px}
.exp-card{flex:1;height:200px;border-radius:20px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:20px}
.exp-blue{background:rgba(74,158,245,.12);border:1px solid rgba(74,158,245,.25)}
.exp-red{background:rgba(232,93,93,.12);border:1px solid rgba(232,93,93,.25)}
.exp-purple{background:rgba(155,127,232,.12);border:1px solid rgba(155,127,232,.25)}
.exp-ic{width:48px;height:48px;background-repeat:no-repeat;background-position:center;background-size:100% 100%}
.exp-title{font-size:24px;color:#A8B0C0}
/* ④ 热门角色 */
.char-row{display:flex;gap:28px}
.char-card{width:120px;text-align:center;background:#141925;border-radius:16px;padding:20px 8px}
.char-avatar{width:96px;height:96px;border-radius:50%;border:3px solid rgba(232,93,93,.2);margin:0 auto 20px;overflow:hidden;display:flex;align-items:center;justify-content:center;background:#141925}
.char-img{width:100%;height:100%;object-fit:cover;border-radius:50%;display:block}
.char-initial{width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:44px;font-weight:700;color:rgba(255,255,255,.70)}
.char-name{font-size:28px;font-weight:600;color:#E8ECF4;margin-top:20px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.char-faction{font-size:22px;margin-top:8px}
.fbg-red{background:linear-gradient(135deg,#E85D5D,#E85D5D66)}
.fbg-blue{background:linear-gradient(135deg,#4A9EF5,#4A9EF566)}
.fbg-gold{background:linear-gradient(135deg,#F2B233,#F2B23366)}
.fc-red{color:#E85D5D}.fc-blue{color:#4A9EF5}.fc-gold{color:#F2B233}
/* ⑤ 最近观看 */
.recent-row{display:flex;gap:24px}
.recent-item{width:120px;text-align:center;margin-right:20px}
.recent-img{width:120px;height:160px;border-radius:12px;object-fit:cover;display:block;margin-bottom:8px}
.recent-name{font-size:22px;color:#A8B0C0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.empty-hint{font-size:24px;color:#6B7384}
.clear{clear:both}
</style></head><body><div class="page">
`;

/* ① 旅程进度卡 */
html += `<div class="journey-card">
  ${homeBg ? `<img class="journey-bg-img" src="${toFile(homeBg)}"/>` : ''}
  <div class="journey-bg"></div>
  <div class="journey-inner">
    <div class="journey-label">${progress.journeyLabel}</div>
    <div class="journey-num">${progress.count} / ${progress.total}</div>
    <div class="journey-phase">${progress.phaseText}</div>
    <div class="journey-movie">
      ${progress.movie.poster ? `<img class="jm-poster" src="${progress.movie.poster}"/>` : `<div class="jm-poster" style="background:linear-gradient(135deg,#5B8DEF,#5B8DEF99);display:flex;align-items:center;justify-content:center;font-size:48px;color:#fff">${progress.movie.initial}</div>`}
      <div class="jm-info">
        <div class="jm-name">${progress.movie.name}</div>
        <div class="jm-en">${progress.movie.enName}</div>
        <div class="jm-phase">${progress.movie.phaseText}${progress.movie.year ? ' · ' + progress.movie.year : ''}</div>
        <div class="jm-status st-current">${progress.movie.statusLabel}</div>
      </div>
    </div>
  </div>
</div><div class="clear"></div>`;

/* ② 推荐下一部 */
html += `<div class="rec-card">
  ${recommendCard.poster ? `<img class="rec-poster" src="${recommendCard.poster}"/>` : `<div class="rec-poster" style="background:linear-gradient(135deg,#5B8DEF,#5B8DEF99);display:flex;align-items:center;justify-content:center;font-size:56px;color:#fff">${recommendCard.initial}</div>`}
  <div class="rec-body">
    <div class="rec-tag">${recommendCard.tag}</div>
    <div class="rec-name">${recommendCard.name}</div>
    <div class="rec-sub">${recommendCard.subInfo}</div>
    <div class="rec-reason">${recommendCard.reason}</div>
    <div class="btn-accent">${recommendCard.cta}</div>
  </div>
</div>`;

/* ③ 宇宙入口（SVG 图标） */
html += `<div class="section"><div class="module-title">宇宙入口</div><div class="exp-row">`;
EXPLORE_ENTRIES.forEach(function (e) {
  html += `<div class="exp-card ${e.bg}"><div class="exp-ic" style="background-image:url('${EXP_ICONS[e.key]}')"></div><div class="exp-title">${e.title}</div></div>`;
});
html += `</div></div>`;

/* ④ 热门角色 */
html += `<div class="section"><div class="module-title">热门角色</div><div class="char-row">`;
hotChars.forEach(function (c) {
  html += `<div class="char-card">
    <div class="char-avatar" style="border-color:rgba(255,255,255,.15)">
    ${c.poster ? `<img class="char-img" src="${toFile(c.poster)}"/>` : `<div class="char-initial fbg-${c.factionCls}">${c.initial}</div>`}
    </div><div class="char-name">${c.name}</div><div class="char-faction fc-${c.factionCls}">${c.factionLabel}</div></div>`;
});
html += `</div></div>`;

/* ⑤ 最近观看 */
html += `<div class="section"><div class="module-title">最近观看</div>`;
if (recent.length) {
  html += `<div class="recent-row">`;
  recent.forEach(function (m) {
    html += `<div class="recent-item">${m.poster ? `<img class="recent-img" src="${m.poster}"/>` : `<div style="width:120px;height:160px;border-radius:12px;background:linear-gradient(135deg,#5B8DEF,#5B8DEF99);display:flex;align-items:center;justify-content:center;font-size:44px;color:#fff;margin-bottom:8px">${m.initial}</div>`}<div class="recent-name">${m.name}</div></div>`;
  });
  html += `</div>`;
} else {
  html += `<div class="empty-hint">还没有观看记录，从《钢铁侠》开始你的旅程</div>`;
}
html += `</div>`;

html += `</div></body></html>`;

fs.writeFileSync(path.join(__dirname, 'home_v12_preview.html'), html, 'utf8');
console.log('WROTE home_v12_preview.html');
console.log('hotChars:', hotChars.map(function (c) { return c.id + '=' + (c.poster ? 'IMG' : 'fallback'); }).join(', '));
