(function () {
  'use strict';

  var CONTENT = window.MCU_CONTENT || [];
  var ROUTES = window.MCU_ROUTES || [];
  var RELATIONS = window.MCU_RELATIONS || [];
  var CHARACTERS = window.MCU_CHARACTERS || [];
  var CAMPS = window.MCU_CAMPS || {};
  var UPCOMING = window.MCU_UPCOMING || [];
  var SPECIAL_ROUTES = window.MCU_SPECIAL_ROUTES || [];
  var PG = window.MCUProgress;

  var app = document.getElementById('app');
  var backBtn = document.getElementById('backBtn');
  var main = document.getElementById('main');
  var views = {
    home: document.getElementById('homeView'),
    f1: document.getElementById('f1View'),
    f2: document.getElementById('f2View'),
    f3: document.getElementById('f3View'),
    f4: document.getElementById('f4View'),
    progress: document.getElementById('progressView'),
    a5: document.getElementById('a5View')
  };

  var currentView = 'home';
  var lastExploreResult = null;

  function contentById(id) {
    for (var i = 0; i < CONTENT.length; i++) if (CONTENT[i].id === id) return CONTENT[i];
    return null;
  }

  function showView(name) {
    Object.keys(views).forEach(function (key) {
      if (key === name) views[key].classList.remove('hidden');
      else views[key].classList.add('hidden');
    });
    currentView = name;
    backBtn.classList.toggle('hidden', name === 'home');
    main.scrollTop = 0;
  }

  backBtn.addEventListener('click', function () {
    if (currentView === 'a5' || currentView === 'progress') showView('home');
    else showView('home');
  });

  document.querySelectorAll('.menu-card').forEach(function (card) {
    card.addEventListener('click', function () {
      var action = card.getAttribute('data-action');
      if (action === 'f1') { renderRoutes(); showView('f1'); }
      else if (action === 'f2') { showView('f2'); }
      else if (action === 'f3') { showView('f3'); }
      else if (action === 'f4') { showView('f4'); generateCard(); }
      else if (action === 'progress') { showView('progress'); renderProgressView(); }
      else if (action === 'a5') { showView('a5'); renderTopicView(); }
    });
  });

  /* ========== F1 观影顺序 ========== */
  function renderRoutes() {
    var list = document.getElementById('routeList');
    list.innerHTML = '';
    ROUTES.forEach(function (route) {
      var el = document.createElement('div');
      el.className = 'route-item';
      el.innerHTML = '<span class="route-kind">' + (route.kind === 'basic' ? '基础' : '专题') +
        '</span><div class="route-name">' + escapeHtml(route.name) + '</div>' +
        '<div class="route-tagline">' + escapeHtml(route.tagline) + '</div>';
      el.addEventListener('click', function () { openRoute(route); });
      list.appendChild(el);
    });
  }

  function openRoute(route) {
    var items = [];
    if (route.generator) {
      items = generateRouteItems(route.generator);
    } else {
      items = route.items.map(function (id) {
        return CONTENT.find(function (c) { return c.id === id; });
      }).filter(Boolean);
    }

    document.getElementById('f1RouteName').textContent = route.name;
    document.getElementById('f1RouteDesc').textContent = route.desc || route.tagline || '';

    var cList = document.getElementById('f1ContentList');
    cList.innerHTML = '';
    items.forEach(function (c, idx) {
      cList.appendChild(renderContentItem(c, idx + 1));
    });

    lastExploreResult = { type: 'route', data: route, items: items };
    document.getElementById('f1Result').classList.remove('hidden');
  }

  function generateRouteItems(generator) {
    var list = CONTENT.slice();
    if (generator === 'release') {
      list.sort(function (a, b) { return (a.ro || 0) - (b.ro || 0); });
    } else if (generator === 'chrono') {
      list.sort(function (a, b) { return (a.co || 0) - (b.co || 0); });
    } else if (generator === 'mainline') {
      list = list.filter(function (c) { return c.importance === 'core'; });
      list.sort(function (a, b) { return (a.ro || 0) - (b.ro || 0); });
    } else if (generator === 'essential') {
      list = list.filter(function (c) { return c.importance === 'core' || c.importance === 'recommended'; });
      list.sort(function (a, b) { return (a.ro || 0) - (b.ro || 0); });
    }
    return list;
  }

  function renderContentItem(c, idx) {
    var div = document.createElement('div');
    div.className = 'content-item';
    var meta = [];
    if (c.year) meta.push(c.year + '');
    if (c.type) meta.push(typeLabel(c.type));
    if (c.phase) meta.push('阶段 ' + c.phase);
    if (c.episodes) meta.push(c.episodes);
    var watched = PG && PG.isWatched(c.id);
    var want = PG && PG.isWant(c.id);
    div.innerHTML = '<div class="content-index">' + idx + '</div>' +
      '<div class="content-body">' +
      '<div class="content-title">' + escapeHtml(c.cn) + (watched ? ' <span class="seen-badge">已看</span>' : '') + '</div>' +
      '<div class="content-meta">' + escapeHtml(meta.join(' · ')) + '</div>' +
      '<div class="content-role">' + escapeHtml(c.role || c.sf || '') + '</div>' +
      '<div class="item-actions">' +
      '<button class="mini-btn' + (watched ? ' active' : '') + '" data-act="watch">' + (watched ? '✓ 已看' : '标记已看') + '</button>' +
      '<button class="mini-btn' + (want ? ' active' : '') + '" data-act="want">' + (want ? '✓ 想看' : '想看') + '</button>' +
      '</div>' +
      '</div>';
    div.querySelector('[data-act="watch"]').addEventListener('click', function () {
      if (!PG) return;
      PG.toggleWatched(c.id).then(function () {
        var fresh = renderContentItem(c, idx);
        div.parentNode.replaceChild(fresh, div);
        refreshHomeProgress();
      });
    });
    div.querySelector('[data-act="want"]').addEventListener('click', function () {
      if (!PG) return;
      PG.toggleWant(c.id).then(function (on) {
        if (on === false && PG.isWatched(c.id)) { showGlobalTip('已看作品无需加入想看'); }
        var fresh = renderContentItem(c, idx);
        div.parentNode.replaceChild(fresh, div);
        refreshHomeProgress();
      });
    });
    return div;
  }

  function typeLabel(type) {
    var map = { movie: '电影', series: '剧集', special: '特别呈现', short: '短片' };
    return map[type] || type;
  }

  /* ========== F2 宇宙节点 ========== */
  var f2Filter = 'all';
  document.querySelectorAll('#f2Filters .filter-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('#f2Filters .filter-btn').forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      f2Filter = btn.getAttribute('data-filter');
      performSearch();
    });
  });

  document.getElementById('f2SearchBtn').addEventListener('click', performSearch);
  document.getElementById('f2Search').addEventListener('keypress', function (e) {
    if (e.key === 'Enter') performSearch();
  });

  function performSearch() {
    var q = document.getElementById('f2Search').value.trim().toLowerCase();
    if (!q) return;
    var detail = document.getElementById('f2Detail');
    var empty = document.getElementById('f2Empty');

    var charResult = CHARACTERS.find(function (ch) {
      return (ch.cn && ch.cn.toLowerCase().indexOf(q) !== -1) ||
             (ch.en && ch.en.toLowerCase().indexOf(q) !== -1);
    });
    var contentResult = CONTENT.find(function (c) {
      return (c.cn && c.cn.toLowerCase().indexOf(q) !== -1) ||
             (c.en && c.en.toLowerCase().indexOf(q) !== -1) ||
             (c.role && c.role.toLowerCase().indexOf(q) !== -1) ||
             (c.sf && c.sf.toLowerCase().indexOf(q) !== -1);
    });

    var node = null;
    if (f2Filter === 'character') node = charResult ? { kind: 'character', data: charResult } : null;
    else if (f2Filter === 'content') node = contentResult ? { kind: 'content', data: contentResult } : null;
    else node = charResult ? { kind: 'character', data: charResult } :
                           (contentResult ? { kind: 'content', data: contentResult } : null);

    if (!node) {
      detail.classList.add('hidden');
      empty.classList.remove('hidden');
      empty.textContent = '未找到与「' + q + '」相关的节点';
      return;
    }

    empty.classList.add('hidden');
    detail.classList.remove('hidden');
    detail.innerHTML = renderNodeDetail(node);
    if (node.kind === 'content' && PG) {
      var watchBtn = detail.querySelector('[data-node-watch]');
      var wantBtn = detail.querySelector('[data-node-want]');
      if (watchBtn) watchBtn.addEventListener('click', function () {
        PG.toggleWatched(node.data.id).then(function () {
          performSearch();
          refreshHomeProgress();
        });
      });
      if (wantBtn) wantBtn.addEventListener('click', function () {
        PG.toggleWant(node.data.id).then(function () {
          performSearch();
          refreshHomeProgress();
        });
      });
    }
    lastExploreResult = node;
  }

  function renderNodeDetail(node) {
    var html = '';
    if (node.kind === 'character') {
      var ch = node.data;
      var camp = CAMPS[ch.camp] || {};
      html += '<h3>' + escapeHtml(ch.cn) + '</h3>';
      html += '<div class="node-en">' + escapeHtml(ch.en) + '</div>';
      html += '<div class="node-note">' + escapeHtml(ch.note || '') + '</div>';
      html += '<div class="node-section-title">首次登场</div>';
      var first = CONTENT.find(function (c) { return c.id === ch.first; });
      html += first ? renderMiniContent(first) : '<p class="secondary">暂无</p>';

      html += '<div class="node-section-title">关联作品</div>';
      var related = CONTENT.filter(function (c) {
        return c.chars && c.chars.indexOf(ch.id) !== -1;
      });
      if (related.length) {
        related.forEach(function (c) { html += renderMiniContent(c); });
      } else {
        html += '<p class="secondary">暂无更多关联作品</p>';
      }
    } else {
      var c = node.data;
      html += '<h3>' + escapeHtml(c.cn) + '</h3>';
      html += '<div class="node-en">' + escapeHtml(c.en || '') + '</div>';
      html += '<div class="node-note">' + escapeHtml(c.role || c.sf || '') + '</div>';
      if (PG) {
        html += '<div class="item-actions node-actions">' +
          '<button class="mini-btn' + (PG.isWatched(c.id) ? ' active' : '') + '" data-node-watch>' + (PG.isWatched(c.id) ? '✓ 已看' : '标记已看') + '</button>' +
          '<button class="mini-btn' + (PG.isWant(c.id) ? ' active' : '') + '" data-node-want>' + (PG.isWant(c.id) ? '✓ 想看' : '想看') + '</button>' +
          '</div>';
      }
      html += '<div class="node-section-title">相关角色</div>';
      if (c.chars && c.chars.length) {
        c.chars.forEach(function (cid) {
          var ch = CHARACTERS.find(function (x) { return x.id === cid; });
          if (ch) html += renderMiniCharacter(ch);
        });
      } else {
        html += '<p class="secondary">暂无角色信息</p>';
      }
      html += '<div class="node-section-title">宇宙关系</div>';
      var rels = RELATIONS.filter(function (r) { return r.from === c.id || r.to === c.id; });
      if (rels.length) {
        rels.forEach(function (r) {
          var otherId = r.from === c.id ? r.to : r.from;
          var other = CONTENT.find(function (x) { return x.id === otherId; });
          html += '<div class="relation-item">' +
            '<div class="relation-target">' + escapeHtml((other && other.cn) || otherId) + ' · ' + relationTypeLabel(r.type) + '</div>' +
            '<div class="relation-why">' + escapeHtml(r.why || '') + '</div>' +
            '</div>';
        });
      } else {
        html += '<p class="secondary">暂无关系数据</p>';
      }
    }
    return html;
  }

  function renderMiniContent(c) {
    return '<div class="content-item mini-row">' +
      '<div class="content-body">' +
      '<div class="content-title mini-title">' + escapeHtml(c.cn) + '</div>' +
      '<div class="content-meta">' + escapeHtml((c.year || '') + (c.year ? ' · ' : '') + typeLabel(c.type)) + '</div>' +
      '</div></div>';
  }

  function renderMiniCharacter(ch) {
    return '<div class="content-item mini-row">' +
      '<div class="content-body">' +
      '<div class="content-title mini-title">' + escapeHtml(ch.cn) + '</div>' +
      '<div class="content-meta">' + escapeHtml(ch.en || '') + '</div>' +
      '</div></div>';
  }

  function relationTypeLabel(type) {
    var map = { sequel: '续集', prereq: '前置', character: '角色', setup: '伏笔', event: '事件', world: '世界观' };
    return map[type] || type;
  }

  /* ========== F3 随机探索 ========== */
  document.getElementById('f3PickContent').addEventListener('click', function () {
    var c = CONTENT[Math.floor(Math.random() * CONTENT.length)];
    showRandomResult(c, 'content');
  });

  document.getElementById('f3PickCharacter').addEventListener('click', function () {
    var ch = CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)];
    showRandomResult(ch, 'character');
  });

  function showRandomResult(item, kind) {
    var panel = document.getElementById('f3Result');
    var card = document.getElementById('f3Card');
    panel.classList.remove('hidden');
    lastExploreResult = { kind: kind, data: item };

    var title, sub, desc;
    if (kind === 'content') {
      title = item.cn;
      sub = [item.year, typeLabel(item.type), item.phase ? '阶段 ' + item.phase : ''].filter(Boolean).join(' · ');
      desc = item.role || item.sf || '';
    } else {
      title = item.cn;
      sub = item.en || '';
      desc = item.note || '';
    }

    card.innerHTML = '<div class="random-icon">' + (kind === 'content' ? '🎬' : '🦸') + '</div>' +
      '<div class="random-label">' + (kind === 'content' ? '随机作品' : '随机角色') + '</div>';

    panel.innerHTML = '<div class="random-result-title">' + escapeHtml(title) + '</div>' +
      '<div class="random-result-sub">' + escapeHtml(sub) + '</div>' +
      '<div class="random-result-desc">' + escapeHtml(desc) + '</div>';
  }

  /* ========== F4 分享卡片 ========== */
  var canvas = document.getElementById('shareCanvas');
  var ctx = canvas.getContext('2d');
  var cardTitleInput = document.getElementById('cardTitle');
  var cardLineInput = document.getElementById('cardLine');
  var cardSubInput = document.getElementById('cardSub');
  var cardType = 'custom';

  document.querySelectorAll('#cardTypeRow .filter-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('#cardTypeRow .filter-btn').forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      cardType = btn.getAttribute('data-card');
      document.getElementById('cardCustomForm').classList.toggle('hidden', cardType !== 'custom');
      generateCard();
    });
  });

  function defaultCardText() {
    var title = '漫威宇宙导航';
    var line = '探索 MCU 的轻量指南';
    if (lastExploreResult) {
      if (lastExploreResult.type === 'route') {
        title = lastExploreResult.data.name;
        line = lastExploreResult.data.tagline || '一条精选 MCU 观影路线';
      } else if (lastExploreResult.kind === 'content') {
        title = lastExploreResult.data.cn;
        line = lastExploreResult.data.role || lastExploreResult.data.sf || '一部值得一看的 MCU 作品';
      } else if (lastExploreResult.kind === 'character') {
        title = lastExploreResult.data.cn;
        line = lastExploreResult.data.note || '一位值得了解的 MCU 角色';
      }
    }
    if (title.length > 20) title = title.slice(0, 19) + '…';
    if (line.length > 40) line = line.slice(0, 39) + '…';
    return { title: title, line: line };
  }

  function generateCard() {
    if (cardType === 'progress') { drawProgressCard(); return; }
    if (cardType === 'a5core') { drawA5Card('core'); return; }
    if (cardType === 'a5full') { drawA5Card('full'); return; }
    var def = defaultCardText();
    if (!cardTitleInput.value.trim()) cardTitleInput.value = def.title;
    if (!cardLineInput.value.trim()) cardLineInput.value = def.line;
    drawCard(cardTitleInput.value.trim() || def.title, cardLineInput.value.trim() || def.line, cardSubInput.value.trim() || '漫威宇宙导航');
  }

  /* ---------- 新卡通用绘制 ---------- */
  function cardBase(accent) {
    var w = canvas.width, h = canvas.height;
    var bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#141B2C');
    bg.addColorStop(0.55, '#0C1220');
    bg.addColorStop(1, '#080B12');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    var glow = ctx.createRadialGradient(w * 0.85, 0, 0, w * 0.85, 0, w);
    glow.addColorStop(0, accent === 'red' ? 'rgba(226,60,60,0.18)' : 'rgba(242,178,51,0.16)');
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = accent === 'red' ? '#E23C3C' : '#F2B233';
    ctx.font = 'bold 30px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('MCU ATLAS · 漫威宇宙导航', 60, 84);
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(60, 108); ctx.lineTo(w - 60, 108); ctx.stroke();
  }

  /* 文本按宽度换行，仅在确实超出行数时给末行加省略号，避免短文本被误截断 */
  function layoutLines(text, maxWidth, maxLines) {
    var lines = [];
    var line = '';
    var truncated = false;
    for (var i = 0; i < text.length; i++) {
      var test = line + text[i];
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = text[i];
        if (lines.length === maxLines) { truncated = true; break; }
      } else {
        line = test;
      }
    }
    if (!truncated) {
      if (line) lines.push(line);
      return lines;
    }
    var last = lines[maxLines - 1];
    while (last && ctx.measureText(last + '…').width > maxWidth) last = last.slice(0, -1);
    lines[maxLines - 1] = last + '…';
    return lines;
  }

  function drawProgressCard() {
    var data = PG ? PG.shareData() : { total: CONTENT.length, watchedCount: 0, wantCount: 0, percent: 0, watched: [], want: [] };
    cardBase('gold');
    var w = canvas.width;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#F5F7FB';
    ctx.font = 'bold 56px sans-serif';
    ctx.fillText('我的漫威观影进度', 60, 190);

    ctx.fillStyle = '#F2B233';
    ctx.font = 'bold 150px sans-serif';
    ctx.fillText(data.percent + '%', 56, 350);
    ctx.fillStyle = '#B8C1D4';
    ctx.font = '32px sans-serif';
    ctx.fillText('已看 ' + data.watchedCount + ' / ' + data.total + ' 部 · 想看 ' + data.wantCount + ' 部', 62, 404);

    /* 进度条 */
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(60, 440, w - 120, 22);
    ctx.fillStyle = '#F2B233';
    ctx.fillRect(60, 440, (w - 120) * data.percent / 100, 22);

    ctx.fillStyle = '#F5F7FB';
    ctx.font = 'bold 36px sans-serif';
    ctx.fillText('已看作品', 60, 540);

    ctx.font = '30px sans-serif';
    var y = 596;
    if (!data.watched.length) {
      ctx.fillStyle = '#8B95AA';
      ctx.fillText('还没有标记已看作品。', 60, y);
      ctx.fillText('从小工具里挑一部，开始你的 MCU 之旅。', 60, y + 48);
      y += 110;
    } else {
      var maxShow = 4;
      for (var i = 0; i < Math.min(maxShow, data.watched.length); i++) {
        var item = data.watched[i];
        ctx.fillStyle = '#DDE3EE';
        var lines = layoutLines((i + 1) + '. ' + item.cn + (item.year ? '（' + item.year + '）' : ''), w - 120, 1);
        ctx.fillText(lines[0], 60, y);
        y += 52;
      }
      if (data.watched.length > maxShow) {
        ctx.fillStyle = '#8B95AA';
        ctx.fillText('…以及另外 ' + (data.watched.length - maxShow) + ' 部', 60, y);
        y += 48;
      }
      y += 24;
    }

    /* 想看清单：填补中部留白，限制条数保证不越过底部页脚 */
    ctx.fillStyle = '#F5F7FB';
    ctx.font = 'bold 34px sans-serif';
    ctx.fillText('想看清单', 60, y);
    y += 48;
    ctx.font = '28px sans-serif';
    if (!data.want.length) {
      ctx.fillStyle = '#8B95AA';
      ctx.fillText('暂无想看作品。', 60, y);
    } else {
      var maxWant = 3;
      for (var k = 0; k < Math.min(maxWant, data.want.length); k++) {
        var wItem = data.want[k];
        ctx.fillStyle = '#B8C1D4';
        var wLines = layoutLines('· ' + wItem.cn, w - 120, 1);
        ctx.fillText(wLines[0], 60, y);
        y += 42;
      }
      if (data.want.length > maxWant) {
        ctx.fillStyle = '#8B95AA';
        ctx.fillText('…以及另外 ' + (data.want.length - maxWant) + ' 部', 60, y);
      }
    }

    ctx.fillStyle = '#F2B233';
    ctx.font = 'bold 34px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('每一部，都是我的无限传奇', w / 2, 1100);
    ctx.fillStyle = 'rgba(242,178,51,0.7)';
    ctx.font = '22px sans-serif';
    ctx.fillText('由漫威宇宙导航小工具生成', w / 2, 1148);
  }

  function drawA5Card(which) {
    var topic = SPECIAL_ROUTES[0];
    if (!topic) { drawCard('复联5补课专题', '数据未就绪', '漫威宇宙导航'); return; }
    var group = which === 'core' ? topic.core : topic.full;
    var items = group ? group.items : [];
    var prog = PG ? PG.routeProgress(items) : { done: 0, total: items.length, percent: 0 };
    cardBase('red');
    var w = canvas.width;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#F5F7FB';
    ctx.font = 'bold 52px sans-serif';
    ctx.fillText((topic.hero && topic.hero.title) || '复仇者联盟5', 60, 184);
    ctx.fillStyle = '#E23C3C';
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(which === 'core' ? '8 部核心补课清单' : '15 部完整补课清单', 60, 248);
    ctx.fillStyle = '#B8C1D4';
    ctx.font = '30px sans-serif';
    ctx.fillText('已定档 2026 年 12 月 18 日（北美）', 60, 300);
    ctx.fillText('我的进度：' + prog.done + ' / ' + prog.total + ' 部（' + prog.percent + '%）', 60, 348);

    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(60, 378, w - 120, 18);
    ctx.fillStyle = '#E23C3C';
    ctx.fillRect(60, 378, (w - 120) * prog.percent / 100, 18);

    ctx.font = '28px sans-serif';
    var y = 452;
    var maxShow = which === 'core' ? 8 : 12;
    for (var i = 0; i < Math.min(maxShow, items.length); i++) {
      var it = items[i];
      var done = PG && PG.isWatched(it.workId + '|' + (it.label || ''));
      ctx.fillStyle = done ? '#4CD1A5' : '#DDE3EE';
      var name = (i + 1) + '. ' + (done ? '✓ ' : '') + (it.label || it.cn) + (it.year ? ' · ' + it.year : '');
      var lines = layoutLines(name, w - 120, 1);
      ctx.fillText(lines[0], 60, y);
      y += which === 'core' ? 62 : 46;
    }
    if (items.length > maxShow) {
      ctx.fillStyle = '#8B95AA';
      ctx.fillText('…以及另外 ' + (items.length - maxShow) + ' 部', 60, y);
    }

    ctx.fillStyle = '#E8A0A0';
    ctx.font = '24px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('仅含官方定档信息，不含剧情推测', w / 2, 1100);
    ctx.fillStyle = 'rgba(242,178,51,0.8)';
    ctx.font = 'bold 30px sans-serif';
    ctx.fillText('MCU ATLAS · 漫威宇宙导航', w / 2, 1150);
  }

  function currentNoteMeta() {
    if (cardType === 'progress') {
      var d = PG ? PG.shareData() : { watchedCount: 0, total: CONTENT.length, percent: 0 };
      return {
        title: '我的漫威观影进度',
        content: '我已看完 ' + d.watchedCount + ' / ' + d.total + ' 部 MCU 作品，完成度 ' + d.percent + '%。用漫威宇宙导航小工具记录你的观影进度。'
      };
    }
    if (cardType === 'a5core' || cardType === 'a5full') {
      var which = cardType === 'a5core' ? '8 部核心' : '15 部完整';
      var a5hero = SPECIAL_ROUTES[0] && SPECIAL_ROUTES[0].hero;
      var a5name = (a5hero && a5hero.title) || '复仇者联盟5';
      return {
        title: '复联5补课清单',
        content: a5name + '（Avengers: Doomsday）已定档 2026 年 12 月 18 日（北美）。这是我的' + which + '补课清单，来自漫威宇宙导航小工具。'
      };
    }
    return {
      title: (cardTitleInput.value.trim() || '漫威宇宙导航').slice(0, 20),
      content: '用漫威宇宙导航小工具生成的分享卡片'
    };
  }

  function drawCard(title, line, sub) {
    var w = canvas.width;
    var h = canvas.height;
    var cx = w * 0.5;

    // ===== 深空星云背景 =====
    var bg = ctx.createRadialGradient(cx, h * 0.28, 40, cx, h * 0.28, w * 0.75);
    bg.addColorStop(0, '#1E2A44');
    bg.addColorStop(0.45, '#121A2B');
    bg.addColorStop(1, '#080B12');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // 左上金辉 / 右下红辉（星云光晕，居中对称分布）
    var glowGold = ctx.createRadialGradient(w * 0.22, h * 0.3, 0, w * 0.22, h * 0.3, w * 0.6);
    glowGold.addColorStop(0, 'rgba(242,178,51,0.14)');
    glowGold.addColorStop(1, 'rgba(242,178,51,0)');
    ctx.fillStyle = glowGold;
    ctx.fillRect(0, 0, w, h);

    var glowRed = ctx.createRadialGradient(w * 0.78, h * 0.72, 0, w * 0.78, h * 0.72, w * 0.6);
    glowRed.addColorStop(0, 'rgba(226,60,60,0.12)');
    glowRed.addColorStop(1, 'rgba(226,60,60,0)');
    ctx.fillStyle = glowRed;
    ctx.fillRect(0, 0, w, h);

    // 星尘粒子（确定性伪随机，避免 Math.random 每次重绘闪烁）
    ctx.fillStyle = 'rgba(232,236,244,0.5)';
    var seed = 7;
    function nextRand() { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }
    for (var s = 0; s < 60; s++) {
      var sx = nextRand() * w;
      var sy = nextRand() * h;
      ctx.fillRect(sx, sy, 2, 2);
    }

    // ===== 中心：六色无限宝石能量环 =====
    var gemColors = ['#E23C3C', '#F28D28', '#F2B233', '#4CD1A5', '#5865F2', '#A855F7'];
    var gemInner = ['#F77B7B', '#F8B878', '#F8D87A', '#8FE8C8', '#8F9BFF', '#D0A5FA'];
    var ringR = 200;
    var ringY = h * 0.25;
    ctx.lineWidth = 5;
    for (var g = 0; g < 6; g++) {
      var ang = -Math.PI / 2 + (g * Math.PI) / 3;
      var px = cx + Math.cos(ang) * ringR;
      var py = ringY + Math.sin(ang) * ringR;
      // 宝石外发光环（暗底 + 彩色描边）
      ctx.save();
      ctx.shadowColor = gemColors[g];
      ctx.shadowBlur = 30;
      ctx.beginPath();
      ctx.arc(px, py, 34, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(10,14,23,0.6)';
      ctx.fill();
      ctx.strokeStyle = gemColors[g];
      ctx.lineWidth = 5;
      ctx.stroke();
      ctx.restore();
      // 宝石实心体：亮→本色→深，模拟体积
      var gemGrad = ctx.createRadialGradient(px - 8, py - 8, 3, px, py, 27);
      gemGrad.addColorStop(0, '#FFFFFF');
      gemGrad.addColorStop(0.25, gemInner[g]);
      gemGrad.addColorStop(0.72, gemColors[g]);
      gemGrad.addColorStop(1, 'rgba(10,14,23,0.9)');
      ctx.beginPath();
      ctx.arc(px, py, 27, 0, Math.PI * 2);
      ctx.fillStyle = gemGrad;
      ctx.fill();
      // 镜面白高光点（specular dot）
      ctx.beginPath();
      ctx.arc(px - 8, py - 8, 6, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.fill();
    }

    // 宝石间连线（能量轨道）
    ctx.strokeStyle = 'rgba(242,178,51,0.55)';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([9, 11]);
    for (var g2 = 0; g2 < 6; g2++) {
      var a1 = -Math.PI / 2 + (g2 * Math.PI) / 3;
      var a2 = -Math.PI / 2 + ((g2 + 1) * Math.PI) / 3;
      ctx.beginPath();
      ctx.arc(cx, ringY, ringR, a1, a2);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // ===== 中心盾牌 =====
    ctx.save();
    ctx.shadowColor = 'rgba(242,178,51,0.85)';
    ctx.shadowBlur = 44;
    ctx.fillStyle = 'rgba(10,14,23,0.88)';
    ctx.beginPath();
    ctx.arc(cx, ringY, 84, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(242,178,51,0.95)';
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.restore();

    ctx.font = '90px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🛡️', cx, ringY);

    // ===== 标题（烫金：大光晕 + 深描边 + 陡金属渐变） =====
    var titleGrad = ctx.createLinearGradient(0, h * 0.46, 0, h * 0.6);
    titleGrad.addColorStop(0, '#FFF3C9');
    titleGrad.addColorStop(0.3, '#F5C84E');
    titleGrad.addColorStop(0.62, '#F2B233');
    titleGrad.addColorStop(1, '#8F5B0D');
    ctx.save();
    ctx.font = 'bold 64px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // 第一层：金色大光晕（glow 打底）
    ctx.shadowColor = 'rgba(242,178,51,0.9)';
    ctx.shadowBlur = 28;
    ctx.fillStyle = 'rgba(242,178,51,0.85)';
    wrapText(ctx, title, cx, h * 0.55, w - 90, 78, 2);
    // 第二层：深色粗描边，把字"切"出来
    ctx.lineWidth = 8;
    ctx.strokeStyle = 'rgba(20,14,4,0.95)';
    wrapStrokeText(ctx, title, cx, h * 0.55, w - 90, 78, 2);
    // 第三层：陡金属渐变填充
    ctx.shadowBlur = 0;
    ctx.fillStyle = titleGrad;
    wrapText(ctx, title, cx, h * 0.55, w - 90, 78, 2);
    ctx.restore();

    // ===== 分隔线（金→红渐变，提亮） =====
    var sep = ctx.createLinearGradient(w * 0.2, 0, w * 0.8, 0);
    sep.addColorStop(0, 'rgba(242,178,51,0)');
    sep.addColorStop(0.5, 'rgba(242,178,51,1)');
    sep.addColorStop(1, 'rgba(226,60,60,0)');
    ctx.strokeStyle = sep;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(w * 0.2, h * 0.665);
    ctx.lineTo(w * 0.8, h * 0.665);
    ctx.stroke();

    // ===== 一句话 =====
    ctx.fillStyle = '#DDE3EE';
    ctx.font = '34px sans-serif';
    ctx.textAlign = 'center';
    wrapText(ctx, line, cx, h * 0.73, w - 100, 50, 2);

    // ===== 底部品牌 =====
    ctx.fillStyle = '#F2B233';
    ctx.font = 'bold 42px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(layoutLines(sub, w - 100, 1)[0] || '', cx, h * 0.87);

    // 品牌底部小字母
    ctx.fillStyle = 'rgba(242,178,51,0.75)';
    ctx.font = '600 20px sans-serif';
    ctx.fillText('MCU  ATLAS', cx, h * 0.92);
  }

  function wrapStrokeText(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
    var lines = [];
    var line = '';
    for (var i = 0; i < text.length; i++) {
      var testLine = line + text[i];
      var metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && line !== '') {
        lines.push(line);
        line = text[i];
      } else {
        line = testLine;
      }
    }
    lines.push(line);
    if (lines.length > maxLines) lines = lines.slice(0, maxLines);
    var startY = y - ((lines.length - 1) * lineHeight) / 2;
    for (var k = 0; k < lines.length; k++) {
      ctx.strokeText(lines[k], x, startY + k * lineHeight);
    }
  }

  function wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
    var words = [];
    for (var i = 0; i < text.length; i++) words.push(text[i]);
    var line = '';
    var lines = [];
    for (var j = 0; j < words.length; j++) {
      var testLine = line + words[j];
      var metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && line !== '') {
        lines.push(line);
        line = words[j];
      } else {
        line = testLine;
      }
    }
    lines.push(line);
    if (lines.length > maxLines) lines = lines.slice(0, maxLines);
    var startY = y - ((lines.length - 1) * lineHeight) / 2;
    for (var k = 0; k < lines.length; k++) {
      ctx.fillText(lines[k], x, startY + k * lineHeight);
    }
  }

  document.getElementById('genCardBtn').addEventListener('click', function () {
    generateCard();
  });

  document.getElementById('saveCardBtn').addEventListener('click', function () {
    generateCard();
    var base64 = canvas.toDataURL('image/png');
    var xhs = window.xhs && window.xhs.miniTool;
    if (!xhs || typeof xhs.writeTempFile !== 'function') {
      showTip('当前环境未注入小红书端能力，请在 App 内测试');
      return;
    }
    /* saveImageToPhotosAlbum 需客户端 9.42+（在线文档 §3.4） */
    clientAtLeast(9420).then(function (ok) {
      if (!ok) { showTip('当前客户端版本过低，请升级小红书至 9.42 及以上后保存'); return; }
      xhs.writeTempFile({
        data: base64,
        success: function (res) {
          xhs.saveImageToPhotosAlbum({
            filePath: res.filePath,
            success: function () { showTip('已保存到相册'); },
            fail: function (err) { showTip('保存失败：' + (err && err.errMsg ? err.errMsg : '未知错误')); }
          });
        },
        fail: function (err) { showTip('临时文件失败：' + (err && err.errMsg ? err.errMsg : '未知错误')); }
      });
    });
  });

  function clientAtLeast(minimum) {
    var xhs = window.xhs;
    function fromOpts(opts) {
      var env = opts && opts.miniToolEnv;
      var bv = Number(env && env.buildVersion) || 0;
      return Math.floor(bv / 1000) >= minimum;
    }
    var sync = xhs && xhs.launchOptions;
    if (sync && sync.miniToolEnv && sync.miniToolEnv.buildVersion) {
      return Promise.resolve(fromOpts(sync));
    }
    var mt = xhs && xhs.miniTool;
    if (!mt || typeof mt.getLaunchOptions !== 'function') return Promise.resolve(true); // 无法取版本时不阻断，由端上返回错误
    return Promise.resolve()
      .then(function () { return mt.getLaunchOptions(); })
      .then(fromOpts)
      .catch(function () { return true; });
  }

  document.getElementById('postCardBtn').addEventListener('click', function () {
    generateCard();
    var meta = currentNoteMeta();
    var base64 = canvas.toDataURL('image/png');
    var xhs = window.xhs && window.xhs.miniTool;
    if (!xhs || typeof xhs.postNote !== 'function') {
      showTip('当前环境未注入小红书端能力，无法直接发笔记');
      return;
    }
    xhs.writeTempFile({
      data: base64,
      success: function (res) {
        xhs.postNote({
          title: meta.title.slice(0, 20),
          content: meta.content.slice(0, 1000),
          pageType: 'photo_publish',
          mediaInfo: { image_resources: [{ url: res.filePath }] },
          success: function () { showTip('已唤起笔记发布页；是否发布成功以笔记实际状态为准'); },
          fail: function (err) { showTip('发笔记失败：' + (err && err.errMsg ? err.errMsg : '未知错误')); }
        });
      },
      fail: function (err) { showTip('临时文件失败：' + (err && err.errMsg ? err.errMsg : '未知错误')); }
    });
  });

  function showTip(msg) {
    var tip = document.getElementById('cardTip');
    tip.textContent = msg;
    setTimeout(function () { tip.textContent = '当前为离线预览；保存 / 发笔记需在小红书 App 内调用端能力。'; }, 3000);
  }

  function showGlobalTip(msg) {
    var tip = document.getElementById('globalTip');
    if (!tip) return;
    tip.textContent = msg;
    tip.classList.add('show');
    setTimeout(function () { tip.classList.remove('show'); }, 2200);
  }

  /* ========== P2 我的观影进度 ========== */
  function renderProgressView() {
    if (!PG) return;
    var data = PG.shareData();

    document.getElementById('pgPercent').textContent = data.percent + '%';
    document.getElementById('pgBar').style.width = data.percent + '%';
    document.getElementById('pgStats').innerHTML =
      '<span>已看 <b>' + data.watchedCount + '</b> 部</span>' +
      '<span>待看 <b>' + (data.total - data.watchedCount) + '</b> 部</span>' +
      '<span>想看 <b>' + data.wantCount + '</b> 部</span>';

    /* 复联5 双路线进度 */
    var topic = SPECIAL_ROUTES[0];
    var a5 = document.getElementById('pgA5');
    a5.innerHTML = '';
    if (topic && topic.core && topic.full) {
      [['8 部核心', topic.core.items], ['15 部完整', topic.full.items]].forEach(function (pair) {
        var p = PG.routeProgress(pair[1]);
        var row = document.createElement('div');
        row.className = 'pg-route';
        row.innerHTML = '<div class="pg-route-head"><span>' + pair[0] + '补课</span>' +
          '<span class="pg-route-num">' + p.done + '/' + p.total + ' · ' + p.percent + '%</span></div>' +
          '<div class="progress-bar"><div class="progress-bar-fill" data-w="' + p.percent + '"></div></div>';
        row.querySelector('.progress-bar-fill').style.width = p.percent + '%';
        a5.appendChild(row);
      });
    } else {
      a5.innerHTML = '<p class="secondary">专题数据未就绪</p>';
    }

    /* 想看 */
    var wantList = document.getElementById('pgWantList');
    document.getElementById('pgWantCount').textContent = '（' + data.wantCount + '）';
    wantList.innerHTML = '';
    if (!data.want.length) {
      wantList.innerHTML = '<p class="secondary">还没有想看的作品，在观影顺序里点「想看」加入。</p>';
    } else {
      data.want.forEach(function (item) {
        wantList.appendChild(makeProgressRow(item, 'want'));
      });
    }

    /* 已看 */
    var watchedList = document.getElementById('pgWatchedList');
    document.getElementById('pgWatchedCount').textContent = '（' + data.watchedCount + '）';
    watchedList.innerHTML = '';
    if (!data.watched.length) {
      watchedList.innerHTML = '<p class="secondary">还没有已看记录，看一部就标记一部吧。</p>';
    } else {
      data.watched.forEach(function (item) {
        watchedList.appendChild(makeProgressRow(item, 'watched'));
      });
    }
  }

  function escapeAttr(s) {
    return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function makeProgressRow(item, kind) {
    var row = document.createElement('div');
    row.className = 'pg-row';
    row.innerHTML = '<div class="pg-row-main"><div class="pg-row-title">' + escapeHtml(item.cn) + '</div>' +
      '<div class="pg-row-meta">' + escapeHtml(item.year ? item.year + '' : '') + '</div></div>' +
      '<button class="mini-btn">' + (kind === 'watched' ? '取消已看' : '移出想看') + '</button>';
    row.querySelector('button').addEventListener('click', function () {
      var job = kind === 'watched' ? PG.unmarkWatched(item.id) : PG.toggleWant(item.id);
      job.then(function () {
        renderProgressView();
        refreshHomeProgress();
      });
    });
    return row;
  }

  /* ========== P3 复联5补课专题 ========== */
  function renderTopicView() {
    var topic = SPECIAL_ROUTES[0];
    var hero = document.getElementById('a5Hero');
    var chain = document.getElementById('a5Chain');
    var tip = document.getElementById('a5Tip');
    if (!topic) {
      hero.innerHTML = '<p class="secondary">专题数据未就绪</p>';
      chain.innerHTML = '';
      return;
    }
    var up = UPCOMING.filter(function (u) { return u.id === topic.upcomingId; })[0];

    hero.innerHTML =
      '<div class="a5-hero">' +
      '<div class="a5-hero-kicker">官方已定档</div>' +
      '<h2 class="a5-hero-title">' + escapeHtml(topic.hero.title || '复仇者联盟5') + '</h2>' +
      '<div class="a5-hero-en">' + escapeHtml(topic.hero.en || 'Avengers: Doomsday') + '</div>' +
      (topic.hero.titleNote ? '<div class="a5-hero-name-note">' + escapeHtml(topic.hero.titleNote) + '</div>' : '') +
      '<div class="a5-hero-date">北美上映日期：' + escapeHtml(formatDate(topic.hero.date)) + '</div>' +
      '<p class="a5-hero-note">' + escapeHtml(topic.hero.note || '') + '</p>' +
      '</div>';

    renderTopicBlock('core', topic.core);
    renderTopicBlock('full', topic.full);

    var html = '<h3 class="progress-section-title">' + escapeHtml(topic.chain.title) + '</h3>';
    topic.chain.items.forEach(function (x, i) {
      html += '<div class="a5-chain-item"><div class="a5-chain-idx">' + (i + 1) + '</div>' +
        '<div><div class="a5-chain-t">' + escapeHtml(x.t) + '</div>' +
        '<div class="a5-chain-d">' + escapeHtml(x.d) + '</div></div></div>';
    });
    if (topic.chain.end) {
      html += '<div class="a5-chain-item speculative"><div class="a5-chain-idx">5</div>' +
        '<div><div class="a5-chain-t">收束 <span class="spec-badge">' + escapeHtml(topic.chain.end.label) + '</span></div>' +
        '<div class="a5-chain-d">' + escapeHtml(topic.chain.end.d) + '</div></div></div>';
    }
    html += '<p class="tip a5-disclaim">以上为整理性说明：标注「推测」的内容未经官方确认，请以漫威影业公布信息为准。</p>';
    chain.innerHTML = html;

    document.getElementById('a5CoreBtn').textContent = topic.core.title;
    document.getElementById('a5FullBtn').textContent = topic.full.title;
    document.getElementById('a5CoreBlock').classList.remove('hidden');
    document.getElementById('a5FullBlock').classList.add('hidden');
    document.getElementById('a5CoreBtn').classList.add('active');
    document.getElementById('a5FullBtn').classList.remove('active');
    tip.textContent = '数据仅含已上映作品与官方定档信息，不接入未核实资讯。';
  }

  function formatDate(iso) {
    if (!iso) return '待公布';
    var parts = String(iso).split('-');
    if (parts.length !== 3) return iso;
    return parts[0] + ' 年 ' + Number(parts[1]) + ' 月 ' + Number(parts[2]) + ' 日';
  }

  function renderTopicBlock(which, group) {
    var el = document.getElementById(which === 'core' ? 'a5CoreBlock' : 'a5FullBlock');
    if (!group) { el.innerHTML = '<p class="secondary">路线数据未就绪</p>'; return; }
    var prog = PG ? PG.routeProgress(group.items) : { done: 0, total: group.items.length, percent: 0 };
    var html = '<div class="a5-block-head"><div class="a5-block-title">' + escapeHtml(group.title) + '</div>' +
      '<div class="a5-block-prog">完成 ' + prog.done + '/' + prog.total + ' · ' + prog.percent + '%</div></div>' +
      '<div class="progress-bar"><div class="progress-bar-fill pct-' + prog.percent + '"></div></div>';
    if (group.desc) html += '<p class="a5-block-desc">' + escapeHtml(group.desc) + '</p>';
    group.items.forEach(function (it, i) {
      var c = contentById(it.workId);
      var nodeKey = it.workId + '|' + (it.label || '');
      var done = PG && PG.isWatched(nodeKey);
      html += '<div class="a5-node' + (done ? ' done' : '') + '" data-key="' + escapeAttr(nodeKey) + '">' +
        '<div class="a5-node-idx">' + (i + 1) + '</div>' +
        '<div class="a5-node-body">' +
        '<div class="a5-node-title">' + escapeHtml(it.label || (c && c.cn) || it.workId) + '</div>' +
        '<div class="a5-node-meta">' + escapeHtml([(c && c.year) || '', typeLabel(c && c.type)].filter(Boolean).join(' · ')) + '</div>' +
        (it.kw ? '<div class="a5-node-why">补课理由：' + escapeHtml(it.kw) + '</div>' : '') +
        '</div>' +
        '<button class="mini-btn' + (done ? ' active' : '') + '">' + (done ? '✓ 已看' : '标记已看') + '</button>' +
        '</div>';
    });
    el.innerHTML = html;
    el.querySelectorAll('.a5-node').forEach(function (node) {
      node.querySelector('button').addEventListener('click', function () {
        var key = node.getAttribute('data-key');
        PG.toggleWatched(key).then(function () {
          renderTopicView();
          refreshHomeProgress();
        });
      });
    });
  }

  document.getElementById('a5CoreBtn').addEventListener('click', function () {
    document.getElementById('a5CoreBlock').classList.remove('hidden');
    document.getElementById('a5FullBlock').classList.add('hidden');
    document.getElementById('a5CoreBtn').classList.add('active');
    document.getElementById('a5FullBtn').classList.remove('active');
  });
  document.getElementById('a5FullBtn').addEventListener('click', function () {
    document.getElementById('a5FullBlock').classList.remove('hidden');
    document.getElementById('a5CoreBlock').classList.add('hidden');
    document.getElementById('a5FullBtn').classList.add('active');
    document.getElementById('a5CoreBtn').classList.remove('active');
  });
  document.getElementById('a5ShareCore').addEventListener('click', function () { exportTopicCard('a5core'); });
  document.getElementById('a5ShareFull').addEventListener('click', function () { exportTopicCard('a5full'); });
  document.getElementById('pgShareBtn').addEventListener('click', function () {
    showView('f4');
    document.querySelectorAll('#cardTypeRow .filter-btn').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-card') === 'progress');
    });
    cardType = 'progress';
    document.getElementById('cardCustomForm').classList.add('hidden');
    generateCard();
  });
  document.getElementById('pgClearBtn').addEventListener('click', function () {
    var tip = document.getElementById('pgTip');
    if (this.getAttribute('data-armed') !== '1') {
      this.setAttribute('data-armed', '1');
      this.textContent = '确认清除？点击再次确认';
      tip.textContent = '清除后已看记录与想看清单都会丢失，且无法恢复。';
      return;
    }
    this.removeAttribute('data-armed');
    this.textContent = '清除我的进度';
    PG.clear().then(function () {
      renderProgressView();
      refreshHomeProgress();
      tip.textContent = '已清除本机保存的观影进度。';
    });
  });

  function exportTopicCard(which) {
    showView('f4');
    document.querySelectorAll('#cardTypeRow .filter-btn').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-card') === which);
    });
    cardType = which;
    document.getElementById('cardCustomForm').classList.add('hidden');
    generateCard();
  }

  function refreshHomeProgress() {
    if (!PG) return;
    var d = PG.shareData();
    var el = document.getElementById('homeProgressDesc');
    if (el) el.textContent = '已看 ' + d.watchedCount + ' / ' + d.total + ' 部 · 想看 ' + d.wantCount + ' 部';
  }

  /* ========== 工具函数 ========== */
  function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // 初始化：先恢复本机进度，再绘制卡片与首页进度摘要
  showView('home');
  if (PG) {
    PG.init().then(function () {
      refreshHomeProgress();
      generateCard();
    }).catch(function () {
      generateCard();
    });
  } else {
    generateCard();
  }
})();
