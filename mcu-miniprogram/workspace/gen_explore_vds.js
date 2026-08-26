/* V1.2 Phase4 explore Canvas 网络图验证：生成 HTML 预览（真实 mcuData 派生 + canvas 绘制 + 真实头像） */
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

/* 派生（与 explore.js 一致） */
const SPECIAL = [ ['tony','peter','mentor'],['tony','steve','rival'],['thor','loki','family'],['thor','odin','family'],['steve','bucky','family'],['natasha','clint','family'],['wanda','vision','family'],['tony','thanos','enemy'],['thanos','gamora','family'],['strange','wanda','rival'],['wade','logan','rival'],['tchalla','starlord','rival'] ];
const sp = {}; SPECIAL.forEach(p => { sp[p[0]+'|'+p[1]] = p[2]; sp[p[1]+'|'+p[0]] = p[2]; });
const REL = { ally:{label:'盟友',color:'#4A9EF5'}, enemy:{label:'敌人',color:'#E85D5D'}, mentor:{label:'师徒',color:'#F2B233'}, family:{label:'家人',color:'#9B7FE8'}, rival:{label:'对手',color:'#E85D5D',dash:1} };
const CAMP = { avengers:'red', asgard:'blue', guardians:'purple', wakanda:'gold', shield:'blue', mutant:'purple', villain:'gray', street:'red' };
const CAMP_COLOR = { red:'#E85D5D', blue:'#4A9EF5', purple:'#9B7FE8', gold:'#F2B233', gray:'#6B7384' };
const heroOf = cn => { const p=(cn||'').split(' / '); return p.length>1?p[1].trim():(cn||''); };
function co(a,b){ const fa=mcuData.filmsOfChar(a),fb=mcuData.filmsOfChar(b); if(!fa.length||!fb.length)return 0; const s={}; fb.forEach(f=>s[f.id]=1); return fa.filter(f=>s[f.id]).length; }
function relOf(a,b){ const p=sp[a+'|'+b]; if(p)return p; const ca=mcuData.getChar(a),cb=mcuData.getChar(b); if(ca&&cb&&ca.camp===cb.camp)return 'ally'; return null; }
function relsOf(id){ const out=[]; CHARACTERS.forEach(c=>{ if(c.id===id)return; const t=relOf(id,c.id); if(!t)return; out.push({id:c.id,type:t,shared:co(id,c.id)}); }); out.sort((a,b)=>b.shared-a.shared); return out; }

const CENTER = 'tony';
const center = mcuData.getChar(CENTER);
const rels = relsOf(CENTER);
const relsJson = JSON.stringify(rels.map(r => ({ id: r.id, type: r.type, label: REL[r.type].label, shared: r.shared, color: REL[r.type].color, dash: !!REL[r.type].dash, name: heroOf(mcuData.getChar(r.id).cn), camp: CAMP_COLOR[CAMP[mcuData.getChar(r.id).camp]||'gray'], avatar: toFile(visuals.avatar(r.id)||'') })));
const centerJson = JSON.stringify({ name: heroOf(center.cn), camp: CAMP_COLOR[CAMP[center.camp]||'gray'], avatar: toFile(visuals.avatar(CENTER)||'') });

let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#0B0E14;font-family:-apple-system,'PingFang SC','Microsoft YaHei',sans-serif;width:375px;color:#E8ECF4}
.page{padding:0 36px;min-height:100vh;background:#0B0E14;padding-bottom:72px}
.page-head{padding:56px 0 28px}
.page-title{font-size:56px;font-weight:700;color:#E8ECF4}
.page-sub{font-size:24px;color:#A8B0C0;margin-top:8px}
.filter-row{white-space:nowrap;margin-bottom:28px}
.filter-inner{display:inline-flex;gap:8px}
.chip{display:inline-flex;align-items:center;justify-content:center;height:56px;padding:0 28px;border-radius:999px;font-size:24px;font-weight:600;color:#A8B0C0;background:#141925;border:1px solid #232B3B;margin-right:8px}
.chip-active{color:#F2B233;background:rgba(242,178,51,.10);border-color:#F2B233}
.canvas-wrap{border-radius:20px;overflow:hidden;border:1px solid #232B3B;background:#0B0E14;margin-bottom:56px}
canvas{display:block;width:375px;height:300px}
.section-label{font-size:28px;font-weight:600;color:#F2B233;margin-bottom:20px;letter-spacing:1px}
.relation-card{background:#141925;border:1px solid #232B3B;border-radius:20px;padding:28px;margin-bottom:20px}
.rel-main{display:flex;align-items:center;justify-content:center}
.rel-avatar{width:40px;height:40px;border-radius:50%;border:2px solid;overflow:hidden;background:#232B3B}
.rel-avatar img{width:100%;height:100%;object-fit:cover;display:block}
.rel-line{flex:1;display:flex;align-items:center;justify-content:center;padding:0 20px;position:relative}
.rel-line::before{content:'';position:absolute;left:20px;right:20px;height:1px;background:#232B3B}
.rel-type{position:relative;font-size:22px;font-weight:600;padding:0 8px;background:#141925;white-space:nowrap}
.rel-info{text-align:center;margin-top:20px;padding-top:8px;border-top:1px solid #232B3B}
.rel-name{font-size:28px;font-weight:600;color:#E8ECF4}
.rel-shared{font-size:22px;color:#6B7384;margin-top:8px}
.bottom-pad{height:60px}
</style></head><body><div class="page">
  <div class="page-head"><div class="page-title">关系探索</div><div class="page-sub">以 ${centerJson ? heroOf(center.cn) : ''} 为中心 · 点击节点切换探索</div></div>
  <div class="filter-row"><div class="filter-inner">
    <span class="chip chip-active">全部</span><span class="chip">盟友</span><span class="chip">敌人</span><span class="chip">师徒</span><span class="chip">家人</span>
  </div></div>
  <div class="canvas-wrap"><canvas id="g" width="750" height="600"></canvas></div>
  <div class="section-label">关系（${rels.length}）</div>
  <div id="list"></div>
  <div class="bottom-pad"></div>
</div>
<script>
const rels = ${relsJson};
const center = ${centerJson};
const canvas = document.getElementById('g');
const ctx = canvas.getContext('2d');
const W = 375, H = 300;
ctx.scale(0.5, 0.5); /* 750x600 画布 → 375x300 显示 */

function drawGraph() {
  ctx.fillStyle = '#0B0E14';
  ctx.fillRect(0, 0, 750, 600);
  const cx = 375, cy = 300, R = 200;
  /* 连线 */
  rels.slice(0, 10).forEach(function (r, i) {
    const a = -Math.PI / 2 + (i / Math.min(10, rels.length)) * Math.PI * 2;
    const nx = cx + Math.cos(a) * R, ny = cy + Math.sin(a) * R;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(nx, ny);
    ctx.strokeStyle = r.color; ctx.lineWidth = r.dash ? 2 : 3;
    ctx.setLineDash(r.dash ? [8, 8] : []);
    ctx.stroke(); ctx.setLineDash([]);
    r._x = nx; r._y = ny;
  });
  function node(x, y, r, url, color, name, big) {
    const img = new Image();
    img.onload = function () {
      ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.clip();
      ctx.drawImage(img, x - r, y - r, r * 2, r * 2); ctx.restore();
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.strokeStyle = color; ctx.lineWidth = big ? 4 : 3; ctx.stroke();
      ctx.fillStyle = 'rgba(232,236,244,0.9)'; ctx.font = (big ? '20px' : '16px') + ' sans-serif';
      ctx.textAlign = 'center'; ctx.fillText(name, x, y + r + 24);
    };
    img.onerror = function () {
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = (big ? '26px' : '20px') + ' sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText((name || '?').charAt(0), x, y); ctx.textBaseline = 'alphabetic';
    };
    img.src = url || '';
  }
  /* 中心 */
  node(cx, cy, 46, center.avatar, center.camp, center.name, true);
  /* 邻居 */
  rels.slice(0, 10).forEach(function (r) {
    node(r._x, r._y, 34, r.avatar, r.camp, r.name, false);
  });
  /* 中心名 */
  ctx.fillStyle = '#E8ECF4'; ctx.font = '18px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(center.name, cx, cy + 66);
}

/* 关系列表 */
const listEl = document.getElementById('list');
rels.forEach(function (r) {
  listEl.innerHTML += '<div class="relation-card"><div class="rel-main">'
    + '<div class="rel-avatar" style="border-color:' + center.camp + '"><img src="' + center.avatar + '"/></div>'
    + '<div class="rel-line"><div class="rel-type" style="color:' + r.color + '">' + r.label + '</div></div>'
    + '<div class="rel-avatar" style="border-color:' + r.camp + '"><img src="' + r.avatar + '"/></div>'
    + '</div><div class="rel-info"><div class="rel-name">' + center.name + ' ↔ ' + r.name + '</div>'
    + '<div class="rel-shared">' + r.label + ' · 共同出演 ' + r.shared + ' 部</div></div></div>';
});

drawGraph();
</script></body></html>`;

fs.writeFileSync(path.join(__dirname, 'explore_vds_preview.html'), html, 'utf8');
console.log('WROTE explore_vds_preview.html | center:', center.cn, '| rels:', rels.length);
console.log('rels:', rels.map(r => r.id + ':' + r.type).join(', '));
