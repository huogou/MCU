/* ============================================================
 * 分享海报 share（V1.1 Step4）
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
 * 铁律：只读现有数据，不改 CONTENT/ROUTES/RELATIONS/CHARACTERS/PANO
 * canvas 无法读取 CSS 变量 → 颜色为 Token 权威值直写（技术必要，非规范违反）
 * ============================================================ */

const mcuData = require('../../models/mcuData.js');
const userState = require('../../models/userState.js');
const shareData = require('../../models/shareData.js');

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

/* 文本按最大宽度换行，超 maxLines 截断加省略号 */
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

Page({
  data: {
    type: 'progress',
    typeLabel: '',
    /* progress */
    count: 0,
    total: 59,
    phaseText: '',
    routeName: '',
    routePct: 0,
    /* route */
    routeTagline: '',
    routeDescLines: [],
    routeWatched: 0,
    routeTotal: 0,
    /* movie */
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

  /* 类型1：观影进度（已看/59 + 当前阶段 + 当前路线） */
  prepareProgress: function () {
    var count = userState.count();
    var total = mcuData.all.length; /* 59，与首页/我的MCU 同口径 */
    var latest = userState.latest();
    var phaseNo = latest ? (latest.phase || 1) : 1;
    /* 当前路线（与首页旅程卡同口径） */
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

  /* 类型2：路线分享（路线名 + 特点 + 进度 + 推荐描述） */
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

  /* 类型3：电影分享（名称 + 海报 + 简介 + 在 MCU 中的位置） */
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

  /* 描述行预分段（canvas 绘制时二次换行） */
  _slimLines: function (text, max) {
    return text ? text.slice(0, max) : '';
  },

  /* ---- canvas 绘制 ---- */
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
      that.draw(ctx, W, H);
    });
  },

  draw: function (ctx, W, H) {
    /* 底 */
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, W, H);
    /* 品牌栏 */
    this.drawBrand(ctx, W);
    /* 类型分支 */
    var t = this.data.type;
    if (t === 'route') this.drawRoute(ctx, W, H);
    else if (t === 'movie') this.drawMovie(ctx, W, H);
    else this.drawProgress(ctx, W, H);
    /* 底部 slogan + 小程序码占位 */
    this.drawFooter(ctx, W, H);
  },

  drawBrand: function (ctx, W) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = C.gold;
    ctx.font = '600 24px sans-serif';
    ctx.fillText(shareData.brand, W / 2, 70);
    /* 装饰线 */
    ctx.fillStyle = 'rgba(233,169,59,0.35)';
    ctx.fillRect(140, 96, W - 280, 1.5);
  },

  drawFooter: function (ctx, W, H) {
    var t = this.data.type;
    var slogan = shareData.template(t) ? shareData.template(t).slogan : '';
    /* 小程序码占位（surface-3 方块） */
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
    /* slogan */
    ctx.fillStyle = C.textWeak;
    ctx.font = '22px sans-serif';
    ctx.fillText(slogan, W / 2, H - 120);
  },

  drawProgress: function (ctx, W, H) {
    var d = this.data;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    /* 标题 */
    ctx.fillStyle = C.textMain;
    ctx.font = '700 40px sans-serif';
    ctx.fillText('我的 MCU 旅程', W / 2, 168);
    ctx.fillStyle = C.textSub;
    ctx.font = '22px sans-serif';
    ctx.fillText('已完成', W / 2, 226);
    /* 大数字 count / total */
    ctx.textAlign = 'right';
    ctx.fillStyle = C.gold;
    ctx.font = '700 108px sans-serif';
    ctx.fillText(String(d.count), W / 2 - 8, 330);
    ctx.textAlign = 'left';
    ctx.fillStyle = C.textSub;
    ctx.font = '600 44px sans-serif';
    ctx.fillText('/ ' + d.total, W / 2 + 6, 336);
    /* 阶段 pill */
    var pillW = 260;
    var pillH = 52;
    var px = (W - pillW) / 2;
    var py = 410;
    ctx.fillStyle = 'rgba(233,169,59,0.12)';
    ctx.fillRect(px, py, pillW, pillH);
    ctx.strokeStyle = 'rgba(233,169,59,0.4)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(px, py, pillW, pillH);
    ctx.fillStyle = C.gold;
    ctx.font = '600 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(d.phaseText, W / 2, py + pillH / 2);
    /* 当前路线 + 进度条 */
    ctx.fillStyle = C.textWeak;
    ctx.font = '20px sans-serif';
    ctx.fillText('当前路线', W / 2, 520);
    ctx.fillStyle = C.textMain;
    ctx.font = '600 28px sans-serif';
    ctx.fillText(d.routeName, W / 2, 566);
    var barW = 400;
    var barX = (W - barW) / 2;
    var barY = 596;
    ctx.fillStyle = C.surface3;
    ctx.fillRect(barX, barY, barW, 10);
    if (d.routePct > 0) {
      ctx.fillStyle = C.gold;
      ctx.fillRect(barX, barY, barW * Math.min(1, d.routePct / 100), 10);
    }
  },

  drawRoute: function (ctx, W, H) {
    var d = this.data;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = C.textMain;
    ctx.font = '700 40px sans-serif';
    ctx.fillText('我在走这条路线', W / 2, 168);
    /* 路线名 */
    ctx.fillStyle = C.textMain;
    ctx.font = '700 46px sans-serif';
    ctx.fillText(d.routeName, W / 2, 280);
    /* tagline */
    ctx.fillStyle = C.gold;
    ctx.font = '24px sans-serif';
    ctx.fillText(d.routeTagline, W / 2, 342);
    /* 进度 */
    ctx.fillStyle = C.textSub;
    ctx.font = '26px sans-serif';
    ctx.fillText('已看 ' + d.routeWatched + ' / ' + d.routeTotal + ' 部', W / 2, 406);
    var barW = 400;
    var barX = (W - barW) / 2;
    var barY = 440;
    ctx.fillStyle = C.surface3;
    ctx.fillRect(barX, barY, barW, 10);
    if (d.routePct > 0) {
      ctx.fillStyle = C.gold;
      ctx.fillRect(barX, barY, barW * Math.min(1, d.routePct / 100), 10);
    }
    /* 描述卡 */
    var cardX = 90;
    var cardY = 500;
    var cardW = W - 180;
    var cardH = 290;
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
    /* 标题 */
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = C.textMain;
    ctx.font = '700 38px sans-serif';
    var title = d.movieCn.length > 14 ? d.movieCn.slice(0, 14) + '…' : d.movieCn;
    ctx.fillText(title, W / 2, 158);
    if (d.movieEn) {
      ctx.fillStyle = C.textSub;
      ctx.font = '22px sans-serif';
      ctx.fillText(d.movieEn, W / 2, 208);
    }
    /* 海报区（左 180×270 阶段色） */
    var px = 90;
    var py = 290;
    var pc = phaseColor(d.moviePhase);
    ctx.fillStyle = pc;
    ctx.globalAlpha = 0.85;
    ctx.fillRect(px, py, 180, 270);
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = '800 72px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText((d.movieCn || '影').charAt(0), px + 90, py + 135);
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
    /* 在 MCU 中的位置 */
    ctx.fillStyle = C.textWeak;
    ctx.font = '20px sans-serif';
    ctx.fillText('在 MCU 中的位置', px + 220, 600);
    ctx.fillStyle = C.textMain;
    ctx.font = '600 24px sans-serif';
    ctx.textAlign = 'left';
    var posLines = wrapText(ctx, d.moviePosText, W - 90 - 220 - 40, 2);
    var pyy = 636;
    for (var j = 0; j < posLines.length; j++) {
      ctx.fillText(posLines[j], px + 220, pyy);
      pyy += 36;
    }
  },

  /* ---- 保存到相册（授权处理） ---- */
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

  /* ---- 转发（微信惯例：onShareAppMessage 触发即记录） ---- */
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
