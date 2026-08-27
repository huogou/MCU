/* ============================================================
 * 分享海报 share（V1.1 Step4 + V3 真机适配 §3）
 * ------------------------------------------------------------
 * 功能：
 *   - 三类型海报 canvas 2d 生成：progress（观影进度）/ route（路线）/ movie（电影）
 *   - 保存到相册（scope.writePhotosAlbum 授权处理）
 *   - 转发给朋友（onShareAppMessage，带 type/id 参数）
 *   - 分享记录 → shareData.record(type)（后台统计，不展示）
 * 数据：
 *   - progress：userState（count/59 + latest.phase + current_route）
 *   - route：mcuData.routeById(id) + expandRoute 进度
 *   - movie：mcuData.get(id) + panoNeighbors（在 MCU 中的位置）
 * 铁律：只读现有数据，不改 CONTENT/ROUTES/RELATIONS/CHARACTERS/PANO/shareData
 * canvas 无法读取 CSS 变量 → 颜色为 Token 权威值直写（技术必要，非规范违反）
 * V3 §3 视觉升级：
 *   - 宇宙渐变背景 + 星点 + 金色光带（drawCosmicBg）
 *   - 品牌盾徽（drawBrandShield）
 *   - 真实海报/头像异步加载（createImage + pending 计数，drawPoster/drawAvatarImg）
 * ============================================================ */

const mcuData = require('../../models/mcuData.js');
const userState = require('../../models/userState.js');
const shareData = require('../../models/shareData.js');
const visuals = require('../../data/visuals.js');

/* ---- Token 权威色值 V1.2（与 app.wxss 一致，canvas 直写） ---- */
const C = {
  bg: '#080B12',
  surface1: '#161D2B',
  surface2: '#1E2636',
  surface3: '#2A3447',
  gold: '#F2B233',
  textMain: '#E8ECF4',
  textSub: '#8E98AA',
  textWeak: '#555F73',
  p: ['#5B8DEF', '#28B487', '#F0A932', '#8B6FE8', '#E8483F', '#C25B8E']
};

const CN_PHASE = ['一', '二', '三', '四', '五', '六'];

function cnPhase(n) {
  return CN_PHASE[n - 1] || String(n);
}

function phaseColor(p) {
  return (p && p >= 1 && p <= 6) ? C.p[p - 1] : '#7A8296';
}

/* 海报兜底工厂（按电影首字 + 阶段色），避免闭包捕获循环变量 */
function posterFallback(m) {
  return function (c, x, y, w, h) {
    c.fillStyle = phaseColor(m.phase);
    c.fillRect(x, y, w, h);
    c.fillStyle = 'rgba(255,255,255,0.7)';
    c.font = '800 ' + Math.round(h * 0.28) + 'px sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText((m.cn || '影').charAt(0), x + w / 2, y + h / 2);
    c.textBaseline = 'alphabetic';
  };
}

/* ---- 文本换行 ---- */
function wrapText(ctx, text, maxWidth, maxLines) {
  const lines = [];
  const chars = String(text || '').split('');
  let line = '';
  for (let i = 0; i < chars.length; i++) {
    const test = line + chars[i];
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = chars[i];
      if (lines.length >= maxLines - 1) break;
    } else {
      line = test;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  if (lines.length >= maxLines) {
    let last = lines[lines.length - 1];
    while (last && ctx.measureText(last + '…').width > maxWidth) last = last.slice(0, -1);
    lines[lines.length - 1] = last + '…';
  }
  return lines;
}

function heroOf(cn) {
  if (!cn) return '';
  const parts = cn.split(' / ');
  return (parts.length > 1 ? parts[1] : cn).trim();
}

Page({
  data: {
    type: 'progress',
    typeLabel: '',
    count: 0,
    total: 59,
    phaseText: '',
    routeName: '',
    routePct: 0,
    routeTagline: '',
    routeDescLines: [],
    routeWatched: 0,
    routeTotal: 0,
    movieCn: '',
    movieEn: '',
    movieRole: '',
    moviePhase: 1,
    moviePosText: ''
  },

  onLoad: function (options) {
    const type = (options && (options.type === 'route' || options.type === 'movie')) ? options.type : 'progress';
    const id = (options && options.id) || '';
    const meta = shareData.template(type);
    const prep = this.prepare(type, id);
    this.setData(Object.assign({ type: type, typeLabel: meta ? meta.label : '', id: id }, prep));
  },

  onReady: function () {
    this.initCanvas();
  },

  /* ---- 数据装配（三类型） ---- */
  prepare: function (type, id) {
    if (type === 'route') return this.prepareRoute(id);
    if (type === 'movie') return this.prepareMovie(id);
    return this.prepareProgress();
  },

  prepareProgress: function () {
    var count = userState.count();
    var total = mcuData.all.length;
    var latest = userState.latest();
    var phaseNo = latest ? (latest.phase || 1) : 1;
    var curSavedId = userState.getCurrentRoute();
    var routeId = 'newcomer';
    if (curSavedId) {
      var sr = userState.getSavedRoute(curSavedId);
      if (sr && sr.routeId) routeId = sr.routeId;
    }
    var route = mcuData.routeById(routeId) || mcuData.routeById('newcomer');
    var routeName = route ? route.name : '新手入坑';
    var routePct = 0;
    if (route) {
      var items = mcuData.expandRoute(route);
      var w = 0;
      for (var i = 0; i < items.length; i++) {
        if (items[i] && userState.isSeen(items[i].id)) w++;
      }
      routePct = items.length ? Math.round(w / items.length * 100) : 0;
    }
    var saga = latest ? (latest.saga === 'multiverse' ? '· 多元宇宙' : (latest.saga === 'infinity' ? '· 无限传奇' : '')) : '';
    return {
      count: count,
      total: total,
      phaseText: 'Phase ' + phaseNo + (saga ? ' ' + saga : ''),
      routeName: routeName,
      routePct: routePct
    };
  },

  prepareRoute: function (id) {
    var route = mcuData.routeById(id || 'newcomer') || mcuData.routeById('newcomer');
    if (!route) return {};
    var items = mcuData.expandRoute(route);
    var watched = 0;
    for (var i = 0; i < items.length; i++) {
      if (items[i] && userState.isSeen(items[i].id)) watched++;
    }
    return {
      routeName: route.name,
      routeTagline: route.tagline || '',
      routeWatched: watched,
      routeTotal: items.length,
      routePct: items.length ? Math.round(watched / items.length * 100) : 0,
      routeDescLines: this._slimLines(route.desc || '', 120)
    };
  },

  prepareMovie: function (id) {
    var m = mcuData.get(id);
    if (!m) return {};
    var pos = mcuData.panoNeighbors(id);
    var posText = '';
    if (pos && pos.prev && pos.next) {
      posText = '前：《' + pos.prev.cn + '》 → 后：《' + pos.next.cn + '》';
    } else if (pos && pos.next) {
      posText = '后：《' + pos.next.cn + '》';
    } else if (pos && pos.prev) {
      posText = '前：《' + pos.prev.cn + '》';
    } else {
      posText = '上映序 第 ' + (m.ro || '-') + ' 部';
    }
    return {
      movieCn: m.cn,
      movieEn: m.en || '',
      movieRole: m.role || '',
      moviePhase: m.phase || 1,
      moviePosText: posText
    };
  },

  _slimLines: function (text, max) {
    return text ? text.slice(0, max) : '';
  },

  /* ---- 最近观看（进度海报用，取已看时间最晚 3 部） ---- */
  _recentMovies: function () {
    var st = (userState.getState().watched) || {};
    var ids = Object.keys(st);
    var list = ids.map(function (i) { return mcuData.get(i); }).filter(Boolean);
    list.sort(function (a, b) { return (st[b.id] || 0) - (st[a.id] || 0); });
    return list.slice(0, 3);
  },

  /* ---- canvas 初始化：先预载图片，再绘制（pending 计数，R5） ---- */
  initCanvas: function () {
    var that = this;
    var query = wx.createSelectorQuery().in(this);
    query.select('#posterCanvas').fields({ node: true, size: true }).exec(function (res) {
      if (!res || !res[0] || !res[0].node) return;
      var canvas = res[0].node;
      var dpr = wx.getSystemInfoSync().pixelRatio;
      var W = shareData.canvas.width;
      var H = shareData.canvas.height;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      var ctx = canvas.getContext('2d');
      ctx.scale(dpr, dpr);
      that._canvas = canvas;
      that._ctx = ctx;
      that._imgCache = {};
      that._loadImagesThen(function () { that.draw(ctx, W, H); });
    });
  },

  /* 收集当前类型所需图片（海报/头像）并预载，全部就绪（或超时）后回调 */
  _loadImagesThen: function (cb) {
    var that = this;
    var imgs = this._collectImages();
    if (!imgs.length) { cb(); return; }
    var pending = imgs.length;
    var settled = false;
    var finish = function () {
      if (settled) return;
      pending--;
      if (pending <= 0) { settled = true; cb(); }
    };
    /* 安全超时：CDN 异常时 2.6s 后仍绘制（缺失图走兜底） */
    setTimeout(function () { if (!settled) { settled = true; cb(); } }, 2600);
    imgs.forEach(function (it) {
      if (!it.url) { that._imgCache[it.key] = null; finish(); return; }
      var img = that._canvas.createImage();
      img.onload = function () { that._imgCache[it.key] = img; finish(); };
      img.onerror = function () { that._imgCache[it.key] = null; finish(); };
      img.src = it.url;
    });
  },

  _collectImages: function () {
    var t = this.data.type;
    var list = [];
    if (t === 'progress') {
      this._recentMovies().forEach(function (m) {
        var p = visuals.visual(m.id).poster;
        if (p) list.push({ key: 'poster-' + m.id, url: p });
      });
    } else if (t === 'route') {
      var route = mcuData.routeById(this.data.id || 'newcomer');
      if (route) {
        mcuData.expandRoute(route).slice(0, 5).forEach(function (m) {
          if (!m) return;
          var p = visuals.visual(m.id).poster;
          if (p) list.push({ key: 'poster-' + m.id, url: p });
        });
      }
    } else if (t === 'movie') {
      var m = mcuData.get(this.data.id);
      if (m) {
        var pm = visuals.visual(m.id).poster;
        if (pm) list.push({ key: 'movie-' + m.id, url: pm });
        (m.chars || []).slice(0, 4).forEach(function (cid) {
          var a = visuals.avatar(cid);
          if (a) list.push({ key: 'avatar-' + cid, url: a });
        });
      }
    }
    return list;
  },

  /* ---- 绘制 ---- */
  draw: function (ctx, W, H) {
    this.drawCosmicBg(ctx, W, H);
    this.drawBrand(ctx, W);
    var t = this.data.type;
    if (t === 'route') this.drawRoute(ctx, W, H);
    else if (t === 'movie') this.drawMovie(ctx, W, H);
    else this.drawProgress(ctx, W, H);
    this.drawFooter(ctx, W, H);
  },

  /* 宇宙背景：渐变 + 约 60 颗种子星点 + 金色对角光带 */
  drawCosmicBg: function (ctx, W, H) {
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0A0F1C');
    g.addColorStop(0.55, C.bg);
    g.addColorStop(1, '#0B0E14');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    var seed = 20260826;
    function rnd() { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }
    for (var i = 0; i < 60; i++) {
      var sx = rnd() * W;
      var sy = rnd() * H;
      var sr = rnd() * 1.4 + 0.4;
      ctx.globalAlpha = 0.3 + rnd() * 0.6;
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.save();
    ctx.globalAlpha = 0.06;
    ctx.fillStyle = C.gold;
    ctx.translate(W / 2, H / 2);
    ctx.rotate(-0.4);
    ctx.fillRect(-W, -260, W * 2, 120);
    ctx.fillRect(-W, 140, W * 2, 70);
    ctx.restore();
  },

  /* 品牌盾徽（顶部居中） */
  drawBrandShield: function (ctx, x, y, size) {
    ctx.save();
    var w = size, h = size * 1.1;
    ctx.beginPath();
    ctx.moveTo(x + w / 2, y);
    ctx.lineTo(x + w, y + h * 0.32);
    ctx.lineTo(x + w * 0.82, y + h);
    ctx.lineTo(x + w / 2, y + h * 0.84);
    ctx.lineTo(x + w * 0.18, y + h);
    ctx.lineTo(x, y + h * 0.32);
    ctx.closePath();
    var g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, C.gold);
    g.addColorStop(1, 'rgba(242,178,51,0.5)');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.fillStyle = '#0B0E14';
    ctx.font = '700 ' + Math.round(size * 0.5) + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('M', x + w / 2, y + h * 0.52);
    ctx.textBaseline = 'alphabetic';
    ctx.restore();
  },

  drawBrand: function (ctx, W) {
    this.drawBrandShield(ctx, W / 2 - 30, 26, 60);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = C.gold;
    ctx.font = '600 24px sans-serif';
    ctx.fillText(shareData.brand, W / 2, 124);
    ctx.fillStyle = 'rgba(233,169,59,0.35)';
    ctx.fillRect(140, 152, W - 280, 1.5);
  },

  drawFooter: function (ctx, W, H) {
    var t = this.data.type;
    var slogan = shareData.template(t) ? shareData.template(t).slogan : '';
    var size = 78;
    var x = (W - size) / 2;
    var y = H - 250;
    ctx.fillStyle = C.surface3;
    ctx.fillRect(x, y, size, size);
    ctx.fillStyle = 'rgba(232,236,244,0.55)';
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('MCU', W / 2, y + size / 2 - 6);
    ctx.fillText('扫码进入', W / 2, y + size / 2 + 14);
    ctx.fillStyle = C.textWeak;
    ctx.font = '22px sans-serif';
    ctx.fillText(slogan, W / 2, H - 120);
  },

  /* 圆角矩形路径 */
  _roundRectPath: function (ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  },

  /* 海报：圆角裁切真实图；缺失走兜底 */
  drawPoster: function (ctx, key, x, y, w, h, radius, fallbackFn) {
    var img = this._imgCache[key];
    this._roundRectPath(ctx, x, y, w, h, radius);
    ctx.save();
    ctx.clip();
    if (img) ctx.drawImage(img, x, y, w, h);
    ctx.restore();
    if (!img && fallbackFn) fallbackFn(ctx, x, y, w, h);
  },

  /* 头像：圆形裁切真实图；缺失走兜底 */
  drawAvatarImg: function (ctx, key, x, y, r, firstChar) {
    var img = this._imgCache[key];
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    if (img) {
      ctx.clip();
      ctx.drawImage(img, x - r, y - r, r * 2, r * 2);
    } else {
      ctx.clip();
      ctx.fillStyle = C.surface3;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.font = '600 ' + Math.round(r) + 'px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(firstChar, x, y + 1);
      ctx.textBaseline = 'alphabetic';
    }
    ctx.restore();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 2;
    ctx.stroke();
  },

  drawProgress: function (ctx, W, H) {
    var d = this.data;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = C.textMain;
    ctx.font = '700 40px sans-serif';
    ctx.fillText('我的 MCU 旅程', W / 2, 192);
    ctx.fillStyle = C.textSub;
    ctx.font = '22px sans-serif';
    ctx.fillText('已完成', W / 2, 240);
    ctx.textAlign = 'right';
    ctx.fillStyle = C.gold;
    ctx.font = '700 108px sans-serif';
    ctx.fillText(String(d.count), W / 2 - 8, 344);
    ctx.textAlign = 'left';
    ctx.fillStyle = C.textSub;
    ctx.font = '600 44px sans-serif';
    ctx.fillText('/ ' + d.total, W / 2 + 6, 350);
    var pillW = 260, pillH = 52;
    var px = (W - pillW) / 2, py = 424;
    ctx.fillStyle = 'rgba(233,169,59,0.12)';
    ctx.fillRect(px, py, pillW, pillH);
    ctx.strokeStyle = 'rgba(233,169,59,0.4)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(px, py, pillW, pillH);
    ctx.fillStyle = C.gold;
    ctx.font = '600 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(d.phaseText, W / 2, py + pillH / 2);
    ctx.fillStyle = C.textWeak;
    ctx.font = '20px sans-serif';
    ctx.fillText('当前路线', W / 2, 524);
    ctx.fillStyle = C.textMain;
    ctx.font = '600 28px sans-serif';
    ctx.fillText(d.routeName, W / 2, 562);
    var barW = 400, barX = (W - barW) / 2, barY = 596;
    ctx.fillStyle = C.surface3;
    ctx.fillRect(barX, barY, barW, 10);
    if (d.routePct > 0) {
      ctx.fillStyle = C.gold;
      ctx.fillRect(barX, barY, barW * Math.min(1, d.routePct / 100), 10);
    }

    /* 最近观看海报（V3 §3） */
    var recents = this._recentMovies();
    if (recents.length) {
      ctx.fillStyle = C.textWeak;
      ctx.font = '20px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('最近观看', W / 2, 644);
      var pw = 120, ph = 160, gap = 30;
      var totalW = recents.length * pw + (recents.length - 1) * gap;
      var sx = (W - totalW) / 2;
      for (var i = 0; i < recents.length; i++) {
        var m = recents[i];
        var pxx = sx + i * (pw + gap);
        this.drawPoster(ctx, 'poster-' + m.id, pxx, 668, pw, ph, 12, posterFallback(m));
      }
    }
  },

  drawRoute: function (ctx, W, H) {
    var d = this.data;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = C.textMain;
    ctx.font = '700 40px sans-serif';
    ctx.fillText('我在走这条路线', W / 2, 188);
    ctx.fillStyle = C.textMain;
    ctx.font = '700 46px sans-serif';
    var rname = d.routeName.length > 12 ? d.routeName.slice(0, 12) + '…' : d.routeName;
    ctx.fillText(rname, W / 2, 256);
    ctx.fillStyle = C.gold;
    ctx.font = '24px sans-serif';
    ctx.fillText(d.routeTagline, W / 2, 308);
    ctx.fillStyle = C.textSub;
    ctx.font = '26px sans-serif';
    ctx.fillText('已看 ' + d.routeWatched + ' / ' + d.routeTotal + ' 部', W / 2, 362);
    var barW = 400, barX = (W - barW) / 2, barY = 392;
    ctx.fillStyle = C.surface3;
    ctx.fillRect(barX, barY, barW, 10);
    if (d.routePct > 0) {
      ctx.fillStyle = C.gold;
      ctx.fillRect(barX, barY, barW * Math.min(1, d.routePct / 100), 10);
    }

    /* 前 5 部缩略海报（未看 alpha 0.4，V3 §3） */
    var route = mcuData.routeById(this.data.id || 'newcomer');
    if (route) {
      var items = mcuData.expandRoute(route).slice(0, 5);
      var tw = 100, th = 140, tgap = 16;
      var tw2 = items.length * tw + (items.length - 1) * tgap;
      var tx = (W - tw2) / 2;
      var ty = 430;
      for (var k = 0; k < items.length; k++) {
        var mm = items[k];
        if (!mm) continue;
        var seen = userState.isSeen(mm.id);
        var tpx = tx + k * (tw + tgap);
        if (!seen) ctx.globalAlpha = 0.4;
        this.drawPoster(ctx, 'poster-' + mm.id, tpx, ty, tw, th, 10, posterFallback(mm));
        ctx.globalAlpha = 1;
      }
    }

    /* 描述卡 */
    var cardX = 90, cardY = 600, cardW = W - 180, cardH = 230;
    ctx.fillStyle = C.surface1;
    ctx.fillRect(cardX, cardY, cardW, cardH);
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(cardX, cardY, cardW, cardH);
    ctx.fillStyle = C.textSub;
    ctx.font = '24px sans-serif';
    ctx.textAlign = 'left';
    var lines = wrapText(ctx, d.routeDescLines, cardW - 48, 6);
    var ly = cardY + 44;
    for (var i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], cardX + 24, ly);
      ly += 40;
    }
  },

  drawMovie: function (ctx, W, H) {
    var d = this.data;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = C.textMain;
    ctx.font = '700 38px sans-serif';
    var title = d.movieCn.length > 14 ? d.movieCn.slice(0, 14) + '…' : d.movieCn;
    ctx.fillText(title, W / 2, 196);
    if (d.movieEn) {
      ctx.fillStyle = C.textSub;
      ctx.font = '22px sans-serif';
      ctx.fillText(d.movieEn, W / 2, 244);
    }

    /* 真实海报（V3 §3） */
    var px = 90, py = 290, pw = 180, ph = 270;
    this.drawPoster(ctx, 'movie-' + this.data.id, px, py, pw, ph, 14, function (c, x, y, w, h) {
      c.fillStyle = phaseColor(d.moviePhase);
      c.fillRect(x, y, w, h);
      c.fillStyle = 'rgba(255,255,255,0.7)';
      c.font = '800 72px sans-serif';
      c.textAlign = 'center';
      c.fillText((d.movieCn || '影').charAt(0), x + w / 2, y + h / 2);
    });

    /* 右侧信息 */
    ctx.textAlign = 'left';
    ctx.fillStyle = C.gold;
    ctx.font = '600 26px sans-serif';
    ctx.fillText('Phase ' + d.moviePhase, px + 220, 330);
    ctx.fillStyle = C.textSub;
    ctx.font = '24px sans-serif';
    var roleLines = wrapText(ctx, d.movieRole, W - 90 - 220 - 40, 5);
    var ry = 380;
    for (var i = 0; i < roleLines.length; i++) {
      ctx.fillText(roleLines[i], px + 220, ry);
      ry += 38;
    }
    ctx.fillStyle = C.textWeak;
    ctx.font = '20px sans-serif';
    ctx.fillText('在 MCU 中的位置', px + 220, 560);
    ctx.fillStyle = C.textMain;
    ctx.font = '600 24px sans-serif';
    var posLines = wrapText(ctx, d.moviePosText, W - 90 - 220 - 40, 2);
    var pyy = 596;
    for (var j = 0; j < posLines.length; j++) {
      ctx.fillText(posLines[j], px + 220, pyy);
      pyy += 36;
    }

    /* 前 4 角色头像组（V3 §3） */
    var m = mcuData.get(this.data.id);
    if (m && m.chars && m.chars.length) {
      var chars = m.chars.slice(0, 4);
      ctx.fillStyle = C.textWeak;
      ctx.font = '20px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('主要角色', px, 690);
      var r = 42, agap = 28;
      var totalW = chars.length * (r * 2) + (chars.length - 1) * agap;
      var ax = px;
      for (var c = 0; c < chars.length; c++) {
        var cid = chars[c];
        var cc = mcuData.getChar(cid);
        var first = cc ? heroOf(cc.cn).charAt(0) : '?';
        var cx = ax + c * (r * 2 + agap) + r;
        var cy = 760;
        this.drawAvatarImg(ctx, 'avatar-' + cid, cx, cy, r, first);
        if (cc) {
          ctx.fillStyle = C.textSub;
          ctx.font = '18px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(heroOf(cc.cn), cx, cy + r + 22);
          ctx.textAlign = 'left';
        }
      }
    }
  },

  /* ---- 保存到相册 ---- */
  savePoster: function () {
    var that = this;
    if (!this._canvas) {
      wx.showToast({ title: '海报生成中，请稍后', icon: 'none' });
      return;
    }
    wx.canvasToTempFilePath({
      canvas: this._canvas,
      success: function (res) {
        wx.saveImageToPhotosAlbum({
          filePath: res.tempFilePath,
          success: function () {
            shareData.record(that.data.type);
            wx.showToast({ title: '已保存到相册', icon: 'success' });
          },
          fail: function (err) {
            var msg = (err && err.errMsg) || '';
            if (/auth|deny|permission/i.test(msg)) {
              wx.showModal({
                title: '需要相册权限',
                content: '请在设置中开启「保存到相册」权限',
                confirmText: '去设置',
                success: function (r) { if (r.confirm) wx.openSetting(); }
              });
            } else {
              wx.showToast({ title: '保存失败，请重试', icon: 'none' });
            }
          }
        });
      },
      fail: function () {
        wx.showToast({ title: '海报生成失败，请重试', icon: 'none' });
      }
    });
  },

  /* ---- 转发 ---- */
  onShareAppMessage: function () {
    var t = this.data.type;
    var id = this.data.id || '';
    var title = '我在用 MCU 宇宙导航' + (t === 'progress' ? '，已看完 ' + this.data.count + ' / ' + this.data.total + ' 部' : (t === 'route' ? '，正在走「' + this.data.routeName + '」' : '，推荐《' + this.data.movieCn + '》'));
    shareData.record(t);
    return {
      title: title,
      path: '/pages/share/share?type=' + t + (id ? '&id=' + id : '')
    };
  }
});
