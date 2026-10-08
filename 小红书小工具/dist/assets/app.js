(function () {
  'use strict';

  var CONTENT = window.MCU_CONTENT || [];
  var ROUTES = window.MCU_ROUTES || [];
  var RELATIONS = window.MCU_RELATIONS || [];
  var CHARACTERS = window.MCU_CHARACTERS || [];
  var CAMPS = window.MCU_CAMPS || {};

  var app = document.getElementById('app');
  var backBtn = document.getElementById('backBtn');
  var main = document.getElementById('main');
  var views = {
    home: document.getElementById('homeView'),
    f1: document.getElementById('f1View'),
    f2: document.getElementById('f2View'),
    f3: document.getElementById('f3View'),
    f4: document.getElementById('f4View')
  };

  var currentView = 'home';
  var lastExploreResult = null;

  function showView(name) {
    Object.keys(views).forEach(function (key) {
      if (key === name) views[key].classList.remove('hidden');
      else views[key].classList.add('hidden');
    });
    currentView = name;
    backBtn.classList.toggle('hidden', name === 'home');
    main.scrollTop = 0;
  }

  backBtn.addEventListener('click', function () { showView('home'); });

  document.querySelectorAll('.menu-card').forEach(function (card) {
    card.addEventListener('click', function () {
      var action = card.getAttribute('data-action');
      if (action === 'f1') { renderRoutes(); showView('f1'); }
      else if (action === 'f2') { showView('f2'); }
      else if (action === 'f3') { showView('f3'); }
      else if (action === 'f4') { showView('f4'); generateCard(); }
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
    div.innerHTML = '<div class="content-index">' + idx + '</div>' +
      '<div class="content-body">' +
      '<div class="content-title">' + escapeHtml(c.cn) + '</div>' +
      '<div class="content-meta">' + escapeHtml(meta.join(' · ')) + '</div>' +
      '<div class="content-role">' + escapeHtml(c.role || c.sf || '') + '</div>' +
      '</div>';
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
    return '<div class="content-item" style="padding:10px 0;">' +
      '<div class="content-body">' +
      '<div class="content-title" style="font-size:14px;">' + escapeHtml(c.cn) + '</div>' +
      '<div class="content-meta">' + escapeHtml((c.year || '') + (c.year ? ' · ' : '') + typeLabel(c.type)) + '</div>' +
      '</div></div>';
  }

  function renderMiniCharacter(ch) {
    return '<div class="content-item" style="padding:10px 0;">' +
      '<div class="content-body">' +
      '<div class="content-title" style="font-size:14px;">' + escapeHtml(ch.cn) + '</div>' +
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
    var def = defaultCardText();
    if (!cardTitleInput.value.trim()) cardTitleInput.value = def.title;
    if (!cardLineInput.value.trim()) cardLineInput.value = def.line;
    drawCard(cardTitleInput.value.trim() || def.title, cardLineInput.value.trim() || def.line, cardSubInput.value.trim() || '漫威宇宙导航');
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
    ctx.fillText(sub, cx, h * 0.87);

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
    if (!xhs) {
      showTip('当前环境未注入小红书端能力，请在 App 内测试');
      return;
    }
    // 官方推荐路径：base64 先 writeTempFile 换 filePath，再保存相册，避免超长 base64 上行
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

  document.getElementById('postCardBtn').addEventListener('click', function () {
    generateCard();
    var title = cardTitleInput.value.trim() || '漫威宇宙导航';
    var base64 = canvas.toDataURL('image/png');
    var xhs = window.xhs && window.xhs.miniTool;
    if (!xhs) {
      showTip('当前环境未注入小红书端能力，无法直接发笔记');
      return;
    }
    xhs.writeTempFile({
      data: base64,
      success: function (res) {
        xhs.postNote({
          title: title,
          content: '用漫威宇宙导航小工具生成的分享卡片',
          pageType: 'photo_publish',
          mediaInfo: { image_resources: [{ url: res.filePath }] },
          success: function () { showTip('已唤起笔记发布页'); },
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

  // 初始化
  showView('home');
})();
