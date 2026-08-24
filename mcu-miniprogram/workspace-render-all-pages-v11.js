/* ============================================================
 * V1.1 页面原型图生成（缺失 7 页）· SVG→sharp 真实数据渲染
 * 输出 assets/preview/_page-{name}.png（750 宽竖屏示意）
 * ============================================================ */
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
global.wx = { getStorageSync: function(){return '';}, setStorageSync: function(){}, cloud:{init:function(){}} };

const mcuData = require('./models/mcuData.js');
const { CHARACTERS, CAMPS } = require('./data/characters.js');
const { PHASE_COLS, PANO_MOVIES, LAYOUT } = require('./models/pano.js');
const { PHASE_LABEL } = require('./data/constants.js');

const BG='#0B0E14', S1='#141925', S2='#1C2330', S3='#232C3D', GOLD='#E9A93B';
const TXT='#E8ECF4', SUB='#A8B0C0', WEAK='#6B7384', LINE='rgba(255,255,255,0.08)';
const P=['#5B8DEF','#28B487','#F0A932','#8B6FE8','#E8483F','#C25B8E'];
const F='Microsoft YaHei, PingFang SC, sans-serif';

function card(x,y,w,h,fill,stroke){return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="16" fill="${fill}" stroke="${stroke||LINE}" stroke-width="1.5"/>`;}
function txt(x,y,s,size,fill,weight,anchor){return `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" font-family="${F}" font-weight="${weight||400}"${anchor?(' text-anchor="'+anchor+'"'):''}>${s}</text>`;}
function clip(s,n){s=String(s||'');return s.length>n?s.slice(0,n)+'…':s;}
function wrap(s,size,maxChars){return clip(s,maxChars);}

const OUT = path.join(__dirname,'assets','preview');
if(!fs.existsSync(OUT))fs.mkdirSync(OUT,{recursive:true});

function head(title,sub){return txt(40,64,title,44,TXT,700)+txt(40,96,sub,24,SUB);}
function footer(svg){return svg+'</svg>';}
function page(title,sub,H){return `<svg xmlns="http://www.w3.org/2000/svg" width="750" height="${H}" viewBox="0 0 750 ${H}"><rect width="750" height="${H}" fill="${BG}"/>`+head(title,sub);}

const R = {};   // 收集每页 SVG

/* ───────── 1. routes 路线列表 ───────── */
(function(){
  let s=page('MCU 观影路线','按目的选一条路，剩下的交给顺序',1520);
  // 双 Tab
  s+=card(40,128,326,52,S2,'rgba(233,169,59,0.3)')+txt(72,162,'基础路线',26,GOLD,600);
  s+=card(382,128,328,52,S2)+txt(414,162,'专题路线',26,SUB);
  // 当前路线卡
  const r=mcuData.routes[0];
  s+=card(40,204,670,150,S2,'rgba(233,169,59,0.2)');
  s+=txt(64,238,'当前路线',22,GOLD,600);
  s+=txt(64,278,r.name,34,TXT,700);
  s+=txt(64,306,'2 / 12 部 · 下一部 奇异博士',22,SUB);
  s+=`<rect x="64" y="326" width="606" height="8" rx="4" fill="${S3}"/><rect x="64" y="326" width="101" height="8" rx="4" fill="${GOLD}"/>`;
  // 路线列表（4 条）
  let y=380;
  mcuData.routes.slice(0,4).forEach(function(rr,i){
    const n=mcuData.expandRoute(rr).length;
    s+=card(40,y,670,132,S2);
    s+=`<rect x="64" y="${y+24}" width="8" height="44" rx="4" fill="${P[i%6]}"/>`;
    s+=txt(90,y+40,rr.name,28,TXT,600);
    s+=txt(90,y+68,clip(rr.tagline,20),20,SUB);
    s+=txt(640,y+44,n+' 部',22,WEAK,'','end');
    s+=txt(90,y+96,clip(rr.forWho,24),20,WEAK);
    s+=`<rect x="64" y="${y+114}" width="606" height="6" rx="3" fill="${S3}"/><rect x="64" y="${y+114}" width="${60+i*40}" height="6" rx="3" fill="${P[i%6]}"/>`;
    y+=148;
  });
  R.routes=footer(s);
})();

/* ───────── 2. route-detail 路线详情 ───────── */
(function(){
  const r=mcuData.routeById('newcomer');
  const items=mcuData.expandRoute(r);
  let s=page(r.name,'新手入坑路线',1560);
  s+=txt(40,128,clip(r.desc,26),24,SUB);
  // 进度摘要
  s+=card(40,160,670,120,S2);
  s+=txt(64,196,'已看',22,WEAK); s+=txt(64,240,'2',52,GOLD,700);
  s+=txt(120,236,'/ '+items.length+' 部',26,SUB);
  s+=`<rect x="64" y="252" width="606" height="10" rx="5" fill="${S3}"/><rect x="64" y="252" width="101" height="10" rx="5" fill="${GOLD}"/>`;
  // 下一部推荐
  s+=txt(40,316,'下一部',24,GOLD,600);
  s+=card(40,336,670,96,S2,'rgba(233,169,59,0.2)');
  s+=txt(64,372,'奇异博士',30,TXT,700); s+=txt(64,396,'第3阶段 · 无限传奇',20,SUB);
  s+=`<rect x="566" y="360" width="120" height="44" rx="8" fill="${GOLD}"/><text x="626" y="388" font-size="24" fill="#1A1206" font-weight="600" text-anchor="middle" font-family="${F}">去观看</text>`;
  // 电影列表
  s+=txt(40,464,'路线电影（'+items.length+'）',24,WEAK);
  let y=488;
  items.slice(0,5).forEach(function(m,i){
    const pc=P[(m.phase||1)-1]||WEAK;
    s+=card(40,y,670,72,S2);
    s+=`<rect x="60" y="${y+12}" width="48" height="48" rx="8" fill="${pc}"/>`;
    s+=txt(72,y+42,(m.cn||'?')[0],24,'rgba(255,255,255,0.85)',700);
    s+=txt(128,y+30,m.cn,26,TXT,600);
    s+=txt(128,y+52,(m.en||'')+' · P'+m.phase,18,WEAK);
    const st=i<2;
    s+=`<rect x="${st?556:594}" y="${y+22}" width="${st?70:74}" height="30" rx="6" fill="${st?'rgba(63,185,138,0.15)':'rgba(233,169,59,0.15)'}"/><text x="${st?591:631}" y="${y+43}" font-size="19" fill="${st?'#3FB98A':GOLD}" font-family="${F}">${st?'已看':'未看'}</text>`;
    y+=84;
  });
  R.routeDetail=footer(s);
})();

/* ───────── 3. movie 电影详情 ───────── */
(function(){
  const m=mcuData.get('iron-man');
  const pc=P[(m.phase||1)-1];
  let s=page(m.cn,'电影详情 · 未观看态',1700);
  // Hero
  s+=`<rect x="40" y="120" width="150" height="220" rx="12" fill="${pc}"/>`;
  s+=txt(90,235,(m.cn||'?')[0],64,'rgba(255,255,255,0.8)',800);
  s+=txt(220,160,'第1阶段 · 2008',22,WEAK);
  s+=txt(220,196,m.cn,38,TXT,700);
  s+=txt(220,224,m.en,22,SUB);
  s+=`<rect x="220" y="240" width="90" height="34" rx="17" fill="rgba(233,169,59,0.15)"/><text x="265" y="263" font-size="20" fill="${GOLD}" text-anchor="middle" font-family="${F}">无限传奇</text>`;
  s+=`<rect x="220" y="284" width="150" height="36" rx="18" fill="rgba(233,169,59,0.12)" stroke="${GOLD}"/><text x="295" y="308" font-size="20" fill="${GOLD}" text-anchor="middle" font-family="${F}">未观看</text>`;
  s+=txt(220,348,wrap(m.role,30),22,SUB);
  // CTA
  s+=`<rect x="40" y="372" width="670" height="72" rx="12" fill="${GOLD}"/><text x="375" y="416" font-size="28" fill="#1A1206" font-weight="700" text-anchor="middle" font-family="${F}">开始观看</text>`;
  // 观看资源
  s+=card(40,460,670,80,S2);
  s+=txt(64,494,'观看资源',26,TXT,600);
  s+=txt(64,520,'想看时，资源会在这里',20,WEAK);
  // 为什么现在看
  s+=card(40,556,670,120,S2);
  s+=txt(64,588,'为什么现在看',22,GOLD,600);
  s+=txt(64,622,wrap(m.role,30),22,SUB);
  s+=txt(64,650,wrap(m.role,30),22,SUB);
  // 前后关联
  s+=txt(40,708,'前后关联',22,WEAK);
  s+=`<rect x="40" y="728" width="200" height="120" rx="10" fill="${S2}" stroke="${P[1]}"/><text x="140" y="778" font-size="22" fill="${SUB}" text-anchor="middle" font-family="${F}">（无前作）</text>`;
  s+=`<rect x="275" y="728" width="200" height="120" rx="10" fill="${pc}"/><text x="375" y="788" font-size="56" fill="rgba(255,255,255,0.8)" font-weight="800" text-anchor="middle" font-family="${F}">钢</text><text x="375" y="824" font-size="20" fill="#fff" text-anchor="middle" font-family="${F}">钢铁侠</text>`;
  s+=`<rect x="510" y="728" width="200" height="120" rx="10" fill="${S2}" stroke="${P[2]}"/><text x="610" y="778" font-size="22" fill="${SUB}" text-anchor="middle" font-family="${F}">下一部</text><text x="610" y="804" font-size="22" fill="${TXT}" text-anchor="middle" font-family="${F}">无敌浩克</text>`;
  // 看完之后
  s+=txt(40,880,'看完之后',22,WEAK);
  s+=card(40,900,670,110,S2,'rgba(233,169,59,0.2)');
  s+=txt(64,934,'继续看下一部',22,GOLD,600);
  s+=txt(64,972,'无敌浩克',30,TXT,700);
  s+=txt(64,996,'同一时期的另一位复仇者',20,SUB);
  R.movie=footer(s);
})();

/* ───────── 4. explore 探索 ───────── */
(function(){
  let s=page('关系探索','从角色与宇宙全景，读懂作品之间的关系',1420);
  s+=card(40,128,670,96,S2);
  s+=`<rect x="64" y="152" width="52" height="52" rx="12" fill="rgba(233,169,59,0.15)"/>`;
  s+=txt(80,187,'◈',34,GOLD,700);
  s+=txt(136,174,'宇宙全景图',28,TXT,600);
  s+=txt(136,200,'一图看尽主线脉络与时间线',20,WEAK);
  s+=txt(676,184,'›',40,WEAK,'','end');
  s+=card(40,240,670,96,S2);
  s+=`<rect x="64" y="264" width="52" height="52" rx="12" fill="rgba(139,111,232,0.15)"/>`;
  s+=txt(80,299,'✦',34,'#8B6FE8',700);
  s+=txt(136,286,'角色图鉴',28,TXT,600);
  s+=txt(136,312,'24 位角色 · 阵营、作品与关系图谱',20,WEAK);
  s+=txt(676,296,'›',40,WEAK,'','end');
  // 热门角色网格
  s+=txt(40,372,'从热门角色开始',24,GOLD,600);
  let x=40,y=396;
  CHARACTERS.slice(0,6).forEach(function(c,i){
    const cc=(CAMPS[c.camp]||{}).color||WEAK;
    const col=i%3,row=Math.floor(i/3);
    const cx=40+col*222, cy=396+row*168;
    s+=card(cx,cy,206,152,S2);
    s+=`<rect x="${cx+18}" y="${cy+18}" width="86" height="30" rx="15" fill="${cc}22"/><text x="${cx+61}" y="${cy+39}" font-size="19" fill="${cc}" text-anchor="middle" font-family="${F}">${(CAMPS[c.camp]||{}).label}</text>`;
    s+=txt(cx+18,cy+74,c.cn.split(' / ')[0],24,TXT,600);
    s+=txt(cx+18,cy+98,c.en,18,WEAK);
    s+=txt(cx+18,cy+126,'首登场 · '+ (mcuData.get(c.first)?mcuData.get(c.first).cn:''),17,WEAK);
  });
  R.explore=footer(s);
})();

/* ───────── 5. panorama 全景 ───────── */
(function(){
  let s=page('宇宙全景图','主线脉络与时间线 · 一图看尽',900);
  // 6 阶段列 + 金色主线
  s+=`<rect x="40" y="240" width="670" height="3" rx="1.5" fill="${GOLD}"/>`;
  PHASE_COLS.forEach(function(p,i){
    const lx=40+p.left*0.16;  // 压缩到 750 宽度示意
    s+=`<line x1="${lx}" y1="130" x2="${lx}" y2="620" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>`;
    s+=`<text x="${lx}" y="150" font-size="20" fill="${P[i%6]}" text-anchor="middle" font-family="${F}" font-weight="700">${p.title}</text>`;
    s+=`<text x="${lx}" y="172" font-size="15" fill="${WEAK}" text-anchor="middle" font-family="${F}">${p.years}</text>`;
  });
  // 节点（采样 8 个）
  const sample=[0,3,6,10,15,20,26,32];
  sample.forEach(function(idx){
    const n=PANO_MOVIES[idx]; if(!n)return;
    const c=mcuData.get(n.id);
    const lx=40+n.left*0.16;
    const main=n.cls.indexOf('mainline')>=0;
    const ty=main?236:(n.cls.indexOf('above')>=0?180:300);
    const pc=P[(c?c.phase:6)-1]||WEAK;
    s+=`<rect x="${lx-22}" y="${ty}" width="44" height="64" rx="6" fill="${pc}" stroke="${main?GOLD:'rgba(255,255,255,0.1)'}" stroke-width="${main?2:1}"/>`;
    s+=`<text x="${lx}" y="${ty+38}" font-size="20" fill="rgba(255,255,255,0.85)" text-anchor="middle" font-family="${F}" font-weight="700">${(c?c.cn:'?')[0]}</text>`;
  });
  // 图例
  s+=txt(40,660,'金色主线 · 主线必看   灰线 · 支线   紫线 · 跨宇宙',18,WEAK);
  s+=txt(40,700,'横滚查看完整时间线',20,SUB);
  R.panorama=footer(s);
})();

/* ───────── 6. browse 浏览全部 ───────── */
(function(){
  let s=page('浏览全部','电影 / 剧集 / 特别呈现 / 短片',1560);
  let y=128;
  [1,2].forEach(function(ph){
    const list=mcuData.all.filter(function(c){return c.phase===ph;});
    s+=`<circle cx="56" cy="${y+12}" r="8" fill="${P[ph-1]}"/>`;
    s+=txt(76,y+18,PHASE_LABEL[ph],28,TXT,700);
    s+=txt(680,y+18,list.length+' 部',20,WEAK,'','end');
    y+=28;
    list.slice(0,5).forEach(function(m){
      const pc=P[(m.phase||1)-1];
      s+=card(40,y,670,70,S2);
      s+=`<rect x="58" y="${y+10}" width="50" height="50" rx="8" fill="${pc}"/>`;
      s+=txt(70,y+40,(m.cn||'?')[0],22,'rgba(255,255,255,0.85)',700);
      s+=txt(126,y+28,m.cn,25,TXT,600);
      s+=txt(126,y+50,(m.en||'')+' · '+m.year,17,WEAK);
      s+=`<rect x="596" y="${y+22}" width="90" height="28" rx="6" fill="rgba(233,169,59,0.15)"/><text x="641" y="${y+41}" font-size="18" fill="${GOLD}" text-anchor="middle" font-family="${F}">未看</text>`;
      y+=82;
    });
    y+=24;
  });
  R.browse=footer(s);
})();

/* ───────── 7. feedback 反馈 ───────── */
(function(){
  let s=page('我要吐槽','你的意见直接影响下一次更新',1160);
  s+=card(40,128,670,90,S2);
  s+=txt(64,164,'反馈类型',22,GOLD,600);
  const types=['内容错误','观影体验','功能建议','其他'];
  let x=64;
  types.forEach(function(t,i){
    const w=t.length*26+36;
    s+=`<rect x="${x}" y="${190}" width="${w}" height="44" rx="22" fill="${i===0?'rgba(233,169,59,0.12)':S3}" stroke="${i===0?GOLD:LINE}"/>`;
    s+=`<text x="${x+w/2}" y="${219}" font-size="22" fill="${i===0?GOLD:SUB}" text-anchor="middle" font-family="${F}">${t}</text>`;
    x+=w+14;
  });
  s+=txt(40,274,'反馈内容',22,GOLD,600);
  s+=`<rect x="40" y="294" width="670" height="160" rx="12" fill="${S2}" stroke="${LINE}"/>`;
  s+=txt(64,330,'说说你遇到的问题或建议…',22,WEAK);
  s+=txt(40,494,'联系方式（选填）',22,GOLD,600);
  s+=`<rect x="40" y="514" width="670" height="64" rx="12" fill="${S2}" stroke="${LINE}"/>`;
  s+=txt(64,552,'微信 / 邮箱，方便我们回复你',22,WEAK);
  s+=`<rect x="40" y="610" width="670" height="72" rx="12" fill="${GOLD}"/><text x="375" y="654" font-size="28" fill="#1A1206" font-weight="700" text-anchor="middle" font-family="${F}">提交反馈</text>`;
  s+=txt(40,724,'反馈仅用于改进产品，不涉及个人隐私',20,WEAK);
  R.feedback=footer(s);
})();

/* ───────── 输出 ───────── */
const jobs=[
  ['routes',R.routes],['route-detail',R.routeDetail],['movie',R.movie],
  ['explore',R.explore],['panorama',R.panorama],['browse',R.browse],['feedback',R.feedback]
];
Promise.all(jobs.map(function(j){
  const svg=j[1];
  const p=path.join(OUT,'_page-'+j[0]+'.png');
  fs.writeFileSync(p.replace('.png','.svg'),svg);
  return sharp(Buffer.from(svg)).png().toFile(p);
})).then(function(){
  jobs.forEach(function(j){ fs.unlinkSync(path.join(OUT,'_page-'+j[0]+'.svg')); });
  console.log('7 页原型图已生成到 assets/preview/：');
  jobs.forEach(function(j){ console.log('  _page-'+j[0]+'.png'); });
}).catch(function(e){ console.error('失败:',e.message); process.exit(1); });
