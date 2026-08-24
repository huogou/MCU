/* ============================================================
 * MCU 宇宙导航 - 核心逻辑层
 * ------------------------------------------------------------
 * 本文件是所有页面共用的地基，包含四块：
 *   1. MCU.data     数据索引与查询（基于统一的「MCU 内容 / CONTENT」）
 *   2. MCU.progress 观影进度（本地存储，第二阶段迁移到小程序）
 *   3. MCU.rec      下一部推荐算法
 *   4. MCU.ui       公共渲染组件
 *
 * 数据基座说明（2026-08 升级）：
 *   数据层已从「仅院线电影」升级为统一的 CONTENT 模型，
 *   包含四类内容：movie（电影）/ series（剧集）/ special（特别呈现）/ short（短片）。
 *   每类内容都带有 type 与 importance（core 必看 / recommended 推荐 / optional 可选）。
 *   三视图（core / recommended / all）由 MCU.data.filtered() 统一过滤。
 *
 * 依赖顺序：data/*.js 必须先于本文件加载（content.js 必须在最后）。
 * ============================================================ */

(function (global) {
  'use strict';

  var CONTENT = global.MCU_CONTENT || [];
  var RELS    = global.MCU_RELATIONS || [];
  var ROUTES  = global.MCU_ROUTES || [];
  var CHARS   = global.MCU_CHARACTERS || [];
  var TYPES   = global.MCU_REL_TYPES || {};

  var TYPE       = global.MCU_TYPE || {};
  var TYPE_LABEL = global.MCU_TYPE_LABEL || {};
  var IMP        = global.MCU_IMPORTANCE || {};
  var IMP_LABEL  = global.MCU_IMPORTANCE_LABEL || {};

  /* 类型 / 重要度的展示配色——统一引用 CSS token（--type-* / --imp-*），
     主题或 Nudges 改色时徽标自动跟随，不再维护第二套 hex 事实来源。
     半透明描边用 color-mix 生成；不支持的浏览器回退为不透明描边。 */
  var TYPE_COLOR = { movie: 'var(--type-movie)', series: 'var(--type-series)', special: 'var(--type-special)', short: 'var(--type-short)' };
  var IMP_COLOR  = { core: 'var(--imp-core)', recommended: 'var(--imp-recommended)', optional: 'var(--imp-optional)' };

  function softBorder(col) {
    return 'border-color:' + col + ';border-color:color-mix(in srgb, ' + col + ' 35%, transparent)';
  }

  /* V1.3：小程序码图形（代码绘制的占位符）。转化卡小图标与扫码面板兜底共用。
     真实小程序码统一走 assets/miniprogram/qrcode.png（见指令 A9），
     该文件加载失败时才回退到这份占位图形。 */
  var QR_SVG = '<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">'
    + '<rect x="4" y="4" width="16" height="16" rx="3" stroke="currentColor" stroke-width="2.5"/>'
    + '<rect x="28" y="4" width="16" height="16" rx="3" stroke="currentColor" stroke-width="2.5"/>'
    + '<rect x="4" y="28" width="16" height="16" rx="3" stroke="currentColor" stroke-width="2.5"/>'
    + '<circle cx="12" cy="12" r="3" fill="currentColor"/>'
    + '<circle cx="36" cy="12" r="3" fill="currentColor"/>'
    + '<circle cx="12" cy="36" r="3" fill="currentColor"/>'
    + '<rect x="28" y="28" width="6" height="6" rx="1" fill="currentColor"/>'
    + '<rect x="37" y="28" width="6" height="6" rx="1" fill="currentColor" opacity=".6"/>'
    + '<rect x="28" y="37" width="6" height="6" rx="1" fill="currentColor" opacity=".6"/>'
    + '<rect x="37" y="37" width="6" height="6" rx="1" fill="currentColor"/>'
    + '</svg>';

  /* 扫码面板懒创建后的缓存 */
  var _mpOverlay = null;

  /* ========== 1. 数据索引 ========== */

  var byId = {};
  CONTENT.forEach(function (m) { byId[m.id] = m; });

  var charById = {};
  CHARS.forEach(function (c) { charById[c.id] = c; });

  var byRelease = CONTENT.slice().sort(function (a, b) { return a.ro - b.ro; });
  var byChrono  = CONTENT.slice().sort(function (a, b) { return a.co - b.co; });

  /* 邻接表：每部内容 -> 所有与它相连的边（含反向） */
  var adj = {};
  CONTENT.forEach(function (m) { adj[m.id] = []; });
  RELS.forEach(function (r) {
    if (adj[r.from]) adj[r.from].push({ other: r.to,   type: r.type, weight: r.weight, why: r.why });
    if (adj[r.to])   adj[r.to].push({   other: r.from, type: r.type, weight: r.weight, why: r.why });
  });

/* 三视图：core=主线必看, recommended=推荐观看, all=完整宇宙 */
var VIEW_MODES = {
  core:        { label: '主线必看', desc: '必看内容，剧情不中断', imps: ['core'] },
  recommended: { label: '推荐观看', desc: '必看 + 推荐，补齐关键支线', imps: ['core', 'recommended'] },
  all:         { label: '完整宇宙', desc: '电影 / 剧集 / 特别呈现 / 短片全收录', imps: ['core', 'recommended', 'optional'] }
};

  function impOK(item, imps) { return imps.indexOf(item.importance) !== -1; }

  var state = { viewMode: 'all', typeFilter: null };

  function counts() {
    var c = { movie: 0, series: 0, special: 0, short: 0 };
    CONTENT.forEach(function (x) { if (c[x.type] != null) c[x.type]++; });
    return c;
  }

  var data = {
    all: CONTENT,
    byRelease: byRelease,
    byChrono: byChrono,
    routes: ROUTES,
    types: TYPES,
    typeLabel: TYPE_LABEL,
    impLabel: IMP_LABEL,
    viewModes: VIEW_MODES,
    counts: counts,

    get state() { return state; },
    setView: function (v) { if (VIEW_MODES[v]) state.viewMode = v; },
    setTypeFilter: function (t) { state.typeFilter = (t || null); },
    viewLabel: function () { return (VIEW_MODES[state.viewMode] || VIEW_MODES.all).label; },

    /* 按当前视图 + 类型过滤后的内容（三视图的核心出口） */
    filtered: function () {
      var vm = VIEW_MODES[state.viewMode] || VIEW_MODES.all;
      return CONTENT.filter(function (c) {
        if (!impOK(c, vm.imps)) return false;
        if (state.typeFilter && c.type !== state.typeFilter) return false;
        return true;
      });
    },

    get: function (id) { return byId[id] || null; },
    getChar: function (id) { return charById[id] || null; },

    /* 角色「出现作品数量」：从全部内容的 chars 反查（电影/剧集/特别呈现/短片都算），
       不改动 characters.js 结构。供关系探索「相关角色」展示出现作品数。
       返回 { list: [content...], count: n }。 */
    charAppearances: function (id) {
      if (!id) return { list: [], count: 0 };
      var list = CONTENT.filter(function (c) {
        return c.chars && c.chars.indexOf(id) >= 0;
      });
      return { list: list, count: list.length };
    },

    /* 与某内容相关的全部关系，按强度降序 */
    relationsOf: function (id) {
      return (adj[id] || []).slice().sort(function (a, b) { return b.weight - a.weight; });
    },

    /* 按上映顺序的前一部 / 后一部 */
    prevByRelease: function (id) {
      var m = byId[id]; if (!m) return null;
      return byRelease[m.ro - 2] || null;
    },
    nextByRelease: function (id) {
      var m = byId[id]; if (!m) return null;
      return byRelease[m.ro] || null;
    },

    /* 展开一条路线为内容数组 */
    expandRoute: function (route) {
      if (route.items && route.items.length) {
        return route.items.map(function (id) { return byId[id]; }).filter(Boolean);
      }
      if (route.generator === 'release')  return byRelease.slice();
      if (route.generator === 'chrono')   return byChrono.slice();
      if (route.generator === 'mainline') return byRelease.filter(function (m) { return m.importance === 'core' || m.mainline; });
      if (route.generator === 'essential') return byRelease.filter(function (m) { return m.importance === 'core' || m.importance === 'recommended'; });
      return [];
    },

    routeById: function (id) {
      for (var i = 0; i < ROUTES.length; i++) if (ROUTES[i].id === id) return ROUTES[i];
      return null;
    },

    phaseColor: function (p) {
      return (p && p >= 1 && p <= 6) ? 'var(--p' + p + ')' : '#7A8296';
    },

    /* V1.3 A4：统一视觉入口。页面只调用 data.visual(id)，
     * 不直接读 MCU_POSTERS / MCU_STILLS，避免图片 URL 散落各页。
     * 由 data/visuals.js 提供 global.MCU_VISUAL。 */
    visual: function (id) {
      var fn = global.MCU_VISUAL;
      return fn ? fn(id) : { poster: null, backdrop: null };
    },

    /* 该角色出现过的作品（由 chars 反查） */
    filmsOfChar: function (charId) {
      return byRelease.filter(function (m) {
        return m.chars && m.chars.indexOf(charId) !== -1;
      });
    }
  };

  /* ========== 2. 用户状态模型（H5 → 小程序预留）==========
   * 本地先用 localStorage 保存游客态数据；字段命名与结构保持长期稳定，
   * 第二阶段迁移到小程序/服务端时，外部代码不需要改接口。
   *
   * 数据结构：
   * {
   *   watched:      { contentId: timestamp },           // 已看
   *   want_to_watch:{ contentId: timestamp },           // 想看
   *   favorite:     { contentId: timestamp },           // 收藏
   *   saved_routes: [ { id, routeId, createdAt, currentIndex, note } ],
   *   last_watched: contentId,                         // 最后观看
   *   current_route: savedRouteId,                     // 当前进行中的保存路线
   *   current_content: contentId                       // 当前看到的内容
   * }
   */

  var KEY = 'mcu_nav_user_v1';
  var LEGACY_KEY = 'mcu_nav_seen_v1';

  function _uid() {
    return 'r_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
  }

  function readState() {
    try {
      var raw = global.localStorage.getItem(KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    /* 兼容 V1 旧数据：迁移到 watched */
    try {
      var leg = global.localStorage.getItem(LEGACY_KEY);
      if (leg) {
        var old = JSON.parse(leg);
        var migrated = { watched: old || {}, want_to_watch: {}, favorite: {}, saved_routes: [], milestones_shown: {} };
        var ids = Object.keys(old || {});
        if (ids.length) migrated.last_watched = ids.sort(function (a, b) { return old[b] - old[a]; })[0];
        global.localStorage.setItem(KEY, JSON.stringify(migrated));
        return migrated;
      }
    } catch (e) {}
    return { watched: {}, want_to_watch: {}, favorite: {}, saved_routes: [], milestones_shown: {} };
  }

  function writeState(state) {
    try { global.localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
  }

  function touch(state) {
    writeState(state);
    return state;
  }

  function markWatched(state, id) {
    state.watched[id] = Date.now();
    state.last_watched = id;
    state.current_content = id;
  }
  function unmarkWatched(state, id) {
    delete state.watched[id];
    if (state.last_watched === id) state.last_watched = null;
    if (state.current_content === id) state.current_content = null;
  }

  var progress = {
    /* ---- 已看（向后兼容 V1 的 seen 语义）---- */
    isSeen: function (id) { return !!readState().watched[id]; },
    toggle: function (id) {
      var s = readState();
      if (s.watched[id]) unmarkWatched(s, id); else markWatched(s, id);
      return touch(s), !!s.watched[id];
    },
    count: function () { return Object.keys(readState().watched).length; },
    total: function () { return CONTENT.length; },
    seenIds: function () { return Object.keys(readState().watched); },
    clear: function () { writeState({ watched: {}, want_to_watch: {}, favorite: {}, saved_routes: [], milestones_shown: {} }); },

    /* V1.3 6.1：「我的 MCU 旅程」里程碑（5/10/20 部）。每个最多出现一次，
     * 用状态里的 milestones_shown 记录已提示过的节点，避免频繁打扰。 */
    MILESTONES: [5, 10, 20],
    checkMilestone: function () {
      var s = readState();
      var c = Object.keys(s.watched).length;
      var shown = s.milestones_shown || {};
      var TEXTS = {
        5:  { title: '你的 MCU 旅程已经开始了', desc: '已看 5 部，保存进度，下次继续。' },
        10: { title: '你已经走过 MCU 的一段旅程', desc: '保存观影进度，换设备也能继续。' },
        20: { title: '你的 MCU 旅程已经走得很远了', desc: '保存进度和路线，继续从这里出发。' }
      };
      for (var i = 0; i < this.MILESTONES.length; i++) {
        var n = this.MILESTONES[i];
        if (c >= n && !shown[n]) {
          shown[n] = true;
          s.milestones_shown = shown;
          touch(s);
          return { n: n, title: TEXTS[n].title, desc: TEXTS[n].desc };
        }
      }
      return null;
    },

    /* 已看内容里上映时间最晚的那部，用于首页"继续观看" */
    latest: function () {
      var ids = Object.keys(readState().watched);
      if (!ids.length) return null;
      var list = ids.map(function (i) { return byId[i]; }).filter(Boolean);
      list.sort(function (a, b) { return b.ro - a.ro; });
      return list[0] || null;
    },

    /* ---- 想看 ---- */
    isWanted: function (id) { return !!readState().want_to_watch[id]; },
    want: function (id) {
      var s = readState(); s.want_to_watch[id] = Date.now(); return touch(s), true;
    },
    unwant: function (id) {
      var s = readState(); delete s.want_to_watch[id]; return touch(s), false;
    },
    toggleWant: function (id) { return this.isWanted(id) ? this.unwant(id) : this.want(id); },
    wantedIds: function () { return Object.keys(readState().want_to_watch); },

    /* ---- 收藏 ---- */
    isFav: function (id) { return !!readState().favorite[id]; },
    favorite: function (id) {
      var s = readState(); s.favorite[id] = Date.now(); return touch(s), true;
    },
    unfavorite: function (id) {
      var s = readState(); delete s.favorite[id]; return touch(s), false;
    },
    toggleFav: function (id) { return this.isFav(id) ? this.unfavorite(id) : this.favorite(id); },
    favIds: function () { return Object.keys(readState().favorite); },

    /* ---- 保存路线 ---- */
    saveRoute: function (routeId, note) {
      var s = readState();
      var item = { id: _uid(), routeId: routeId, createdAt: Date.now(), currentIndex: 0, note: note || '' };
      s.saved_routes.push(item);
      s.current_route = item.id;
      return touch(s), item;
    },
    unsaveRoute: function (savedId) {
      var s = readState();
      s.saved_routes = (s.saved_routes || []).filter(function (x) { return x.id !== savedId; });
      if (s.current_route === savedId) s.current_route = null;
      return touch(s);
    },
    savedRoutes: function () { return (readState().saved_routes || []).slice(); },
    getSavedRoute: function (savedId) {
      return (readState().saved_routes || []).find(function (x) { return x.id === savedId; }) || null;
    },
    updateRouteIndex: function (savedId, index) {
      var s = readState();
      var r = (s.saved_routes || []).find(function (x) { return x.id === savedId; });
      if (r) { r.currentIndex = index; return touch(s), r; }
      return null;
    },
    setCurrentRoute: function (savedId) { var s = readState(); s.current_route = savedId; return touch(s); },
    getCurrentRoute: function () { return readState().current_route; },

    /* ---- 当前内容（继续观看）---- */
    setCurrentContent: function (id) { var s = readState(); s.current_content = id; return touch(s); },
    getCurrentContent: function () { return readState().current_content; },

    /* ---- 原始状态读写（迁移/同步用）---- */
    getState: function () { return readState(); },
    setState: function (obj) { writeState(obj); }
  };

  /* ========== 3. 下一部推荐 ==========
   * 三种目的对应三条不同的路径。
   * 推荐结果必须同时返回 content 与 movie（movie 保留作向后兼容别名），
   * 每种都必须给出「为什么」，没有理由的推荐视为无效。 */

  var MODES = {
    mainline: { label: '只想看主线', desc: '跳过支线，用最短路径把故事看完' },
    understand: { label: '想完整看懂', desc: '补上理解剧情必需的前置作品' },
    complete: { label: '想按顺序全看', desc: '严格按上映顺序，一部不落' }
  };

  function _result(content, why, fallback) {
    return { content: content, movie: content, why: why, fallback: fallback };
  }

  var rec = {
    modes: MODES,

    /**
     * 计算某内容在某种模式下的下一部推荐
     * @returns {{content: Object, movie: Object, why: String, fallback: Boolean}|null}
     */
    next: function (fromId, mode) {
      var m = byId[fromId];
      if (!m) return null;

      /* 优先使用数据里手写的推荐，理由质量最高 */
      if (m.next && m.next[mode]) {
        var picked = byId[m.next[mode].id];
        if (picked) return _result(picked, m.next[mode].why, false);
      }

      if (mode === 'complete') return this._complete(m);
      if (mode === 'mainline') return this._mainline(m);
      return this._understand(m);
    },

    /* 上映顺序的下一部 */
    _complete: function (m) {
      var nx = byRelease[m.ro];
      if (!nx) return null;
      return _result(nx,
        '按上映顺序，《' + m.cn + '》之后上映的就是它（' + nx.date + '）。'
      + '照这个顺序看，你会和当年的观众一样，按漫威设计的节奏依次接收到每一个伏笔和反转。',
        true);
    },

    /* 之后的第一部「核心」内容 */
    _mainline: function (m) {
      for (var i = m.ro; i < byRelease.length; i++) {
        if (byRelease[i].importance === 'core' || byRelease[i].mainline) {
          var nx = byRelease[i];
          var skipped = i - m.ro;
          var why = '《' + nx.cn + '》是《' + m.cn + '》之后第一部推动整体剧情的作品。';
          if (skipped > 0) {
            why += '中间跳过的 ' + skipped + ' 部属于角色个人篇章或补完性前传，'
                 + '不看不会影响你理解主线走向。';
          }
          why += nx.role ? '它的作用是：' + nx.role : '';
          return _result(nx, why, true);
        }
      }
      return null;
    },

    /* 关系最强的、你还没看过的关联作品 */
    _understand: function (m) {
      var links = data.relationsOf(m.id);
      var seen = readState().watched;
      var best = null, bestScore = -1;

      links.forEach(function (l) {
        var o = byId[l.other];
        if (!o) return;
        var score = l.weight * 10;
        if (l.type === 'prereq') score += 8;
        if (l.type === 'sequel') score += 6;
        if (seen[o.id]) score -= 30;          /* 看过的降权 */
        if (o.ro < m.ro) score += 2;          /* 前置作品略微优先 */
        if (o.type !== m.type) score += 1;    /* 跨类型关联优先提示（剧集/电影互补） */
        if (score > bestScore) { bestScore = score; best = { link: l, content: o }; }
      });

      if (!best) return this._complete(m);
      var tName = (TYPES[best.link.type] || {}).label || '关联';
      return _result(best.content,
        '这两部作品之间是「' + tName + '」关系。' + best.link.why,
        true);
    },

    /**
     * 某内容的前置作品（看之前建议先看什么）
     */
    prereqOf: function (id) {
      var m = byId[id]; if (!m) return [];
      return data.relationsOf(id).filter(function (l) {
        var c = byId[l.other];
        return c && c.ro < m.ro && (l.type === 'prereq' || l.type === 'sequel' || l.weight === 3);
      });
    },

    /**
     * 某内容的后续作品（看完之后建议看什么）
     */
    followOf: function (id) {
      var m = byId[id]; if (!m) return [];
      return data.relationsOf(id).filter(function (l) {
        var c = byId[l.other];
        return c && c.ro > m.ro;
      });
    }
  };

  /* ========== 4. 公共渲染 ========== */

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  var NAV = [
    { href: 'index.html',  text: '首页' },
    { href: 'next.html',   text: '下一部看什么' },
    { href: 'routes.html', text: '观影路线' },
    { href: 'map.html',    text: '宇宙地图' }
  ];

  var ui = {
    esc: esc,

    /* 顶部导航，current 传当前文件名 */
    nav: function (current) {
      var links = NAV.map(function (n) {
        return '<a href="' + n.href + '"' + (n.href === current ? ' class="on"' : '') + '>'
             + n.text + '</a>';
      }).join('');
      return '<header class="nav"><div class="nav-in">'
           + '<a href="index.html" class="logo"><span class="logo-mark"></span>MCU 宇宙导航</a>'
           + '<span class="nav-section" id="nav-section" aria-live="polite"></span>'
           + '<nav class="nav-links">' + links + '</nav>'
           + '</div></header>';
    },

    /* 章节滚动追踪：自动检测当前可见的 section 并在导航栏显示名称 */
    initScrollSpy: function () {
      var sections = document.querySelectorAll('main > section, main > [class*="hero"]');
      if (!sections || sections.length < 2) return;  /* 少于2个section则不需要 */
      var labelEl = document.getElementById('nav-section');
      if (!labelEl) return;

      var labels = [];
      sections.forEach(function (s, i) {
        /* 优先取 data-section-label，其次取第一个 h1/h2 文本 */
        var label = s.getAttribute('data-section-label');
        if (!label) {
          var h = s.querySelector('h1, h2');
          label = h ? h.textContent.trim().replace(/\s+/g, ' ').slice(0, 30) : ('第 ' + (i + 1) + ' 区块');
        }
        labels.push({ el: s, label: label });
      });

      /* IntersectionObserver：当 section 进入视口顶部区域时触发 */
      var observer = new IntersectionObserver(function (entries) {
        var visible = null;
        entries.forEach(function (e) {
          if (e.isIntersecting && e.intersectionRatio >= 0.15) {
            visible = e.target;
          }
        });
        if (!visible) {
          /* 回退：找距离视口顶最近的 section */
          var top = Infinity;
          labels.forEach(function (item) {
            var r = item.el.getBoundingClientRect();
            if (r.top < window.innerHeight && r.top < top) { top = r.top; visible = item.el; }
          });
        }
        if (visible) {
          for (var j = 0; j < labels.length; j++) {
            if (labels[j].el === visible) {
              labelEl.textContent = labels[j].label;
              labelEl.classList.add('show');
              break;
            }
          }
        } else {
          labelEl.classList.remove('show');
        }

        /* 导航栏滚动阴影 */
        var nav = document.querySelector('.nav');
        if (nav) { nav.classList.toggle('scrolled', window.scrollY > 10); }
      }, {
        root: null,
        rootMargin: '-10% 0px -70% 0px',   /* 触发区：略高于视口中下部 */
        threshold: [0, 0.15, 0.5]
      });

      labels.forEach(function (item) { observer.observe(item.el); });

      /* 初始状态：页面刚加载时立即判断一次 */
      setTimeout(function () {
        var top = Infinity, first = null;
        labels.forEach(function (item) {
          var r = item.el.getBoundingClientRect();
          if (r.top <= 80 && r.top < top) { top = r.top; first = item; }
        });
        if (first) { labelEl.textContent = first.label; labelEl.classList.add('show'); }
        var nav = document.querySelector('.nav');
        if (nav) nav.classList.toggle('scrolled', window.scrollY > 10);
      }, 50);
    },

  foot: function () {
    return '<footer class="foot"><div class="wrap">'
         + MCU.ui.mpEntry({ variant: 'foot', title: 'MCU 宇宙导航 · 小程序', desc: '记录进度 · 保存路线 · 继续观看' })
         + '<div>MCU 宇宙导航｜漫威电影与 MCU 作品观影决策工具</div>'
         + '<div>收录 MCU 电影、剧集、特别呈现及短片内容，提供观影顺序、故事时间线、作品关系与下一步观看建议。</div>'
         + '<div>内容信息及时间线根据公开资料整理，仅用于信息展示与观影规划。本站为独立制作项目，与 Marvel Studios 无隶属关系。</div>'
         + '<button class="complain-entry" type="button" data-fb>'
         +   '<svg viewBox="0 0 24 24" fill="none"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'
         +   '我要吐槽</button>'
         + '</div></footer>';
  },

    /* 类型徽标 */
    typeBadge: function (type) {
      var col = TYPE_COLOR[type] || 'var(--text-3)';
      return '<span class="chip" style="color:' + col + ';' + softBorder(col) + '">'
           + esc(TYPE_LABEL[type] || type) + '</span>';
    },
    /* 重要度徽标 */
    impBadge: function (imp) {
      var col = IMP_COLOR[imp] || 'var(--text-3)';
      return '<span class="chip" style="color:' + col + ';' + softBorder(col) + '">'
           + esc(IMP_LABEL[imp] || imp) + '</span>';
    },

    /* ── 发布文案口径（四类内容统一）──
     * movie 用「上映」（院线），series 用「上线」（Disney+），
     * special / short 用「发布」。全站展示日期与序号时都走这组出口，
     * 不再对剧集/短片误用「上映 / 北美上映」。 */
    releaseVerb: function (type) {
      return { movie: '北美上映', series: '上线', special: '发布', short: '发布' }[type] || '发布';
    },
    /* 「2012-05-04 北美上映」/「2021-06-09 上线」 */
    releaseLabel: function (m) { return m.date + ' ' + ui.releaseVerb(m.type); },
    /* 序号：电影保留「上映第 N 部」，其余内容用中性「全库第 N 部」 */
    orderLabel: function (m) {
      return (m.type === 'movie' ? '上映第 ' : '全库第 ') + m.ro + ' 部';
    },
    /* 时间轴标题：电影「上映顺序」，其余「发布顺序」 */
    orderAxisLabel: function (m) {
      return m.type === 'movie' ? '上映顺序' : '发布顺序';
    },

    /* 内容卡片（电影 / 剧集 / 特别呈现 / 短片 通用） */
    contentCard: function (m, opts) {
      opts = opts || {};
      var seen = progress.isSeen(m.id);
      var typeColor = TYPE_COLOR[m.type] || 'var(--text-3)';
      var impColor  = IMP_COLOR[m.importance] || 'var(--text-3)';

      var tags = '';
      tags += '<span class="chip" style="color:' + typeColor + ';' + softBorder(typeColor) + '">'
            + esc(TYPE_LABEL[m.type] || m.type) + '</span>';
      tags += '<span class="chip" style="color:' + impColor + ';' + softBorder(impColor) + '">'
            + esc(IMP_LABEL[m.importance] || m.importance) + '</span>';
      if (m.mainline) tags += '<span class="chip chip-red">核心主线</span>';
      if (m.starter)  tags += '<span class="chip chip-blue">适合新手</span>';
      if (opts.showChrono) tags += '<span class="chip">' + esc(m.coLabel) + '</span>';

      var orderText = m.type === 'movie'
        ? '第 ' + m.phase + ' 阶段 · 上映第 ' + m.ro + ' 部'
        : (m.type === 'series'
            ? '第 ' + m.phase + ' 阶段 · ' + (m.episodes || '剧集')
            : (m.year || '') + ' 年发布');

      /* V1.3 A4：卡片背景图统一经 data.visual(id) 取（优先 backdrop，其次 poster）；
         缺失则不加，由 CSS 阶段色微渐变兜底，保证不破图。 */
      var _v = data.visual(m.id);
      var bgSrc = _v.backdrop || _v.poster;
      var bgHtml = bgSrc
        ? '<span class="mcard-bg" style="background-image:url(' + bgSrc + ')"></span>'
        : '';

      return '<a class="mcard' + (seen ? ' seen' : '') + '" href="movie.html?id=' + m.id + '">'
        + bgHtml
        + '<div class="mcard-top">'
        +   '<span class="mcard-phase" style="background:' + data.phaseColor(m.phase) + '"></span>'
        +   '<span class="mcard-order">' + orderText + '</span>'
        + '</div>'
        + '<h3>' + esc(m.cn) + '</h3>'
        + '<div class="mcard-sub">' + esc(m.en) + ' · ' + m.year + '</div>'
        + (tags ? '<div class="mcard-tags">' + tags + '</div>' : '')
        + '</a>';
    },

    /* 兼容旧调用：movieCard 现在等价于 contentCard */
    movieCard: function (m, opts) { return ui.contentCard(m, opts); },

    /* 进度条 */
    progressBar: function () {
      var c = progress.count(), t = progress.total();
      var pct = t ? Math.round(c / t * 100) : 0;
      return '<div class="prog-shell">'
        + '<div class="prog-bar"><div class="prog-fill" style="width:' + pct + '%"></div></div>'
        + '<span class="prog-num">已看 ' + c + ' / ' + t + '</span>'
        + '</div>';
    },

    /* 关系条目 */
    relationItem: function (link, contextId) {
      var o = data.get(link.other);
      if (!o) return '';
      var t = TYPES[link.type] || { label: '关联', color: '#7A8296' };
      return '<a class="rel" href="movie.html?id=' + o.id + '">'
        + '<div class="rel-top">'
        +   '<span class="rel-dot" style="background:' + t.color + '"></span>'
        +   '<span class="rel-name">' + esc(o.cn) + '</span>'
        +   '<span class="chip" style="color:' + t.color + ';border-color:' + t.color + '40">' + t.label + '</span>'
        +   '<span class="dim2">' + o.year + ' · ' + ui.orderLabel(o) + '</span>'
        + '</div>'
        + '<div class="rel-why">' + esc(link.why) + '</div>'
        + '</a>';
    },

    /* 三视图切换器（调用方提供容器与回调） */
    bindViewSwitcher: function (el, onPick) {
      if (!el) return;
      var keys = ['core', 'recommended', 'all'];
      el.innerHTML = keys.map(function (k) {
        var vm = VIEW_MODES[k];
        return '<button class="vbtn' + (k === state.viewMode ? ' on' : '') + '" data-v="' + k + '">'
          + '<b>' + vm.label + '</b><span>' + vm.desc + '</span></button>';
      }).join('');
      Array.prototype.forEach.call(el.querySelectorAll('.vbtn'), function (b) {
        b.onclick = function () {
          state.viewMode = b.getAttribute('data-v');
          if (onPick) onPick(state.viewMode);
          Array.prototype.forEach.call(el.querySelectorAll('.vbtn'), function (x) {
            x.classList.toggle('on', x.getAttribute('data-v') === state.viewMode);
          });
        };
      });
    },

    /* 类型过滤器（调用方提供容器与回调；all 表示不限） */
    bindTypeFilter: function (el, onPick) {
      if (!el) return;
      var keys = ['all', 'movie', 'series', 'special', 'short'];
      el.innerHTML = keys.map(function (k) {
        var label = k === 'all' ? '全部类型' : (TYPE_LABEL[k] || k);
        return '<button class="tbtn' + ((state.typeFilter || 'all') === k ? ' on' : '') + '" data-t="' + k + '">'
          + label + '</button>';
      }).join('');
      Array.prototype.forEach.call(el.querySelectorAll('.tbtn'), function (b) {
        b.onclick = function () {
          state.typeFilter = b.getAttribute('data-t');
          if (state.typeFilter === 'all') state.typeFilter = null;
          if (onPick) onPick(state.typeFilter);
          Array.prototype.forEach.call(el.querySelectorAll('.tbtn'), function (x) {
            var v = x.getAttribute('data-t');
            x.classList.toggle('on', (state.typeFilter || 'all') === v);
          });
        };
      });
    },

    /* 小程序引导（项目说明第七章：H5 → 小程序） */
    mpHint: function (text) {
      return '<div class="mp-hint"><div><b>保存你的 MCU 进度</b><br>'
        + esc(text || '打开微信小程序，进度、路线和收藏一起同步，换设备也能接着看。')
        + '</div></div>';
    },

    /* ── V1.3 小程序转化卡（白色卡片 + 小程序码 + 核心利益点 + 简短说明）──
     * 先给用户价值，再让用户保存价值。二维码只承担「保存/继续/完整体验」。
     * @param title  核心利益点标题
     * @param desc   简短说明
     * @param btnTxt 按钮文案（可选，默认「保存」）
     * @param compact 是否紧凑模式 */
    mpCard: function (title, desc, btnTxt, compact) {
      return '<div class="mp-card' + (compact ? ' mp-card--compact' : '') + '">'
        + '<div class="mp-card-qr" aria-hidden="true">' + QR_SVG + '</div>'
        + '<div class="mp-card-body">'
        +   '<div class="mp-card-t">' + esc(title) + '</div>'
        +   '<div class="mp-card-d">' + esc(desc) + '</div>'
        + '</div>'
        + '<button class="mp-card-btn" type="button" aria-haspopup="dialog"'
        +   ' data-mp-title="' + esc(title) + '" data-mp-desc="' + esc(desc) + '">'
        +   esc(btnTxt || '保存') + '</button>'
        + '</div>';
    },

    /* ── V1.3 小程序扫码面板：点「保存」按钮后弹出 ──
     * 指令 A9：小程序码统一走 assets/miniprogram/qrcode.png 单一资源位，
     * 以后换码只需替换该文件，无需改任何页面代码。
     * 面板遵循「白色卡片 + 小程序码 + 核心利益点 + 简短说明」，不做产品宣传。
     * V1.3 最终收口：根据用户环境（PC / 手机非微信 / 微信内）显示不同引导。 */
    /* D8 H5 to mini-program bridging: six-strength entry component.
     * variant: compact(1/5 home bar) | inline(2/5 movie bar)
     *          card(3/5 explore card) | module(4/5 route module)
     *          pano(5/5 panorama panel) | foot(1/5 global footer)
     * Any element with data-mp-title opens the scan modal.
     * payload:{type,id} is reserved only (future deep-link), not used to jump yet. */
    mpEntry: function (o) {
      o = o || {};
      var title = esc(o.title || ''), desc = esc(o.desc || ''), btn = esc(o.btnTxt || '保存');
      var p = o.payload ? ' data-mp-type="' + esc(o.payload.type) + '" data-mp-id="' + esc(o.payload.id) + '"' : '';
      if (o.variant === 'compact') {
        return '<button class="mp-entry mp-compact" type="button" data-mp-title="' + title + '" data-mp-desc="' + desc + '"' + p + '>'
          + '<span class="mp-qr mp-qr-40" aria-hidden="true">' + QR_SVG + '</span>'
          + '<span class="mp-compact-tx"><b>' + title + '</b><span>' + desc + '</span></span>'
          + '<span class="mp-go" aria-hidden="true">›</span></button>';
      }
      if (o.variant === 'inline') {
        return '<button class="mp-entry mp-inline" type="button" data-mp-title="' + title + '" data-mp-desc="' + desc + '"' + p + '>'
          + '<span class="mp-qr mp-qr-32" aria-hidden="true">' + QR_SVG + '</span>'
          + '<span class="mp-inline-tx"><b>' + title + '</b><span>' + desc + '</span></span>'
          + '<span class="mp-go" aria-hidden="true">›</span></button>';
      }
      if (o.variant === 'card') {
        return '<div class="mp-entry mp-card-x">'
          + '<span class="mp-qr mp-qr-72" aria-hidden="true">' + QR_SVG + '</span>'
          + '<div class="mp-card-x-body"><b>' + title + '</b><span>' + desc + '</span></div>'
          + '<button class="mp-entry-btn" type="button" data-mp-title="' + title + '" data-mp-desc="' + desc + '"' + p + '>' + btn + '</button></div>';
      }
      if (o.variant === 'module') {
        return '<div class="mp-entry mp-module">'
          + '<span class="mp-qr mp-qr-72" aria-hidden="true">' + QR_SVG + '</span>'
          + '<div class="mp-module-body"><b>' + title + '</b><span>' + desc + '</span></div>'
          + '<button class="mp-entry-btn mp-cta-strong" type="button" data-mp-title="' + title + '" data-mp-desc="' + desc + '"' + p + '>' + btn + '</button></div>';
      }
      if (o.variant === 'pano') {
        return '<div class="mp-entry mp-pano">'
          + '<div class="mp-pano-tag">MCU 小程序</div>'
          + '<div class="mp-pano-t">' + title + '</div>'
          + '<div class="mp-pano-d">' + desc + '</div>'
          + '<button class="mp-entry-btn mp-pano-cta" type="button" data-mp-title="' + title + '" data-mp-desc="' + desc + '"' + p + '>' + btn + '</button>'
          + '<div class="mp-pano-foot">微信扫码即可打开 · 进度本机保存</div></div>';
      }
      if (o.variant === 'foot') {
        return '<button class="mp-entry mp-foot" type="button" data-mp-title="' + title + '" data-mp-desc="' + desc + '"' + p + '>'
          + '<span class="mp-foot-ic" aria-hidden="true">' + QR_SVG + '</span>'
          + '<span class="mp-foot-tx"><b>' + title + '</b><span>' + desc + '</span></span>'
          + '<span class="mp-foot-go" aria-hidden="true">扫码打开 ›</span></button>';
      }
      return '';
    },

    _detectEnv: function () {
      var ua = navigator.userAgent || '';
      if (/windows|macintosh|linux/i.test(ua) && !/mobile/i.test(ua)) return 'desktop';
      if (/micromessenger/i.test(ua)) return 'wechat';
      return 'mobile';
    },
    openMpModal: function (title, desc, payload) {
      var ov = ui._ensureMpModal();
      ov.querySelector('.mp-modal-t').textContent = title || '保存你的 MCU 进度';
      ov.querySelector('.mp-modal-d').textContent = desc || '';
      /* D8：参数化预留——把入口携带的 movieId/routeId/exploreId 暂存到面板，
         未来小程序支持带参跳转时，此处即可读取并拼接跳转链接（当前仅预留，不跳转）。 */
      ov.setAttribute('data-mp-payload', payload ? JSON.stringify(payload) : '');
      var c = progress.count();
      var env = ui._detectEnv();
      var envEl = ov.querySelector('.mp-modal-env');
      var qrEl = ov.querySelector('.mp-modal-qr');

      /* 环境引导文案 */
      if (env === 'desktop') {
        envEl.innerHTML = '<svg viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="14" rx="2" stroke="currentColor" stroke-width="1.5"/><path d="M8 21h8M12 17v4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>打开微信扫一扫，扫描屏幕上的二维码';
        envEl.className = 'mp-modal-env';
        qrEl.classList.remove('hint-longpress');
      } else if (env === 'wechat') {
        envEl.innerHTML = '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.5"/><path d="M12 8v4l2.5 2.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>长按识别上方小程序码，直接打开小程序';
        envEl.className = 'mp-modal-env wechat-env';
        qrEl.classList.add('hint-longpress');
      } else {
        envEl.innerHTML = '<svg viewBox="0 0 24 24" fill="none"><rect x="5" y="2" width="14" height="20" rx="3" stroke="currentColor" stroke-width="1.5"/><circle cx="12" cy="18" r="1" fill="currentColor"/></svg>打开微信扫一扫，扫描上方小程序码';
        envEl.className = 'mp-modal-env';
        qrEl.classList.remove('hint-longpress');
      }

      ov.querySelector('.mp-modal-note').innerHTML =
        (env === 'wechat'
          ? '长按识别上方小程序码即可打开。<br>'
          : '小程序已上线，微信扫码即可打开。<br>')
        + (c > 0
          ? '你标记的 <b>' + c + '</b> 部已看作品已保存在本机浏览器，不会丢失。'
          : '你当前的浏览记录已保存在本机浏览器，不会丢失。');
      ov.classList.add('show');
      document.body.style.overflow = 'hidden';
    },
    closeMpModal: function () {
      if (!_mpOverlay) return;
      _mpOverlay.classList.remove('show');
      document.body.style.overflow = '';
    },
    _ensureMpModal: function () {
      if (_mpOverlay) return _mpOverlay;
      _mpOverlay = document.createElement('div');
      _mpOverlay.className = 'mp-modal-overlay';
      _mpOverlay.innerHTML =
        '<div class="mp-modal" role="dialog" aria-modal="true" aria-label="扫码打开小程序">'
        +   '<button class="mp-modal-close" type="button" aria-label="关闭">×</button>'
        +   '<div class="mp-modal-badge">微信小程序 · 已上线</div>'
        +   '<div class="mp-modal-qr">'
        +     '<img src="assets/miniprogram/qrcode.png" alt="小程序码"'
        +       ' onerror="this.style.display=\'none\';var s=this.nextElementSibling;if(s)s.style.display=\'\'">'
        +     '<div class="mp-modal-qr-fb" style="display:none">' + QR_SVG + '</div>'
        +   '</div>'
        +   '<div class="mp-modal-env"></div>'
        +   '<div class="mp-modal-t"></div>'
        +   '<div class="mp-modal-d"></div>'
        +   '<div class="mp-modal-note"></div>'
        +   '<button class="mp-modal-ok" type="button">知道了</button>'
        + '</div>';
      document.body.appendChild(_mpOverlay);
      _mpOverlay.addEventListener('click', function (e) {
        if (e.target === _mpOverlay) ui.closeMpModal();
      });
      _mpOverlay.querySelector('.mp-modal-close').onclick = ui.closeMpModal;
      _mpOverlay.querySelector('.mp-modal-ok').onclick = ui.closeMpModal;
      return _mpOverlay;
    },

    /* ── V1.3 统一「为什么」语言块 ── */
    whyBlock: function (label, text) {
      return '<div class="why-block">'
        + '<div class="why-block-t">' + esc(label) + '</div>'
        + '<p>' + esc(text) + '</p>'
        + '</div>';
    },

    /* ── V1.3 路线步骤缩略图 ── */
    stepThumb: function (m) {
      var v = data.visual(m.id);
      if (v.poster) {
        return '<div class="step-thumb">'
          + '<img src="' + v.poster + '" alt="《' + esc(m.cn) + '》" loading="lazy"'
          + ' onerror="MCU.ui._stepThumbFail(this,\'' + m.id + '\')">'
          + '</div>';
      }
      return '<div class="step-thumb">' + ui.posterFallback(m) + '</div>';
    },
    _stepThumbFail: function (img, id) {
      img.onerror = null;
      var m = data.get(id);
      if (!m || !img.parentNode) { img.style.display = 'none'; return; }
      var tmp = document.createElement('div');
      tmp.innerHTML = ui.posterFallback(m);
      img.parentNode.replaceChild(tmp.firstChild, img);
    },

    /* ── V1.3 地图电影视觉卡（点击节点后展示）── */
    mapVisualCard: function (m) {
      var posterHtml = '';
      var v = data.visual(m.id);
      if (v.poster) {
        posterHtml = '<img src="' + v.poster + '" alt="《' + esc(m.cn) + '》海报" loading="lazy"'
          + ' onerror="this.style.display=\'none\';var s=this.nextElementSibling;if(s)s.style.display=\'\'">'
          + '<div class="mv-fallback" style="--pc:' + data.phaseColor(m.phase) + ';display:none">'
          + '<span class="mv-fallback-t">' + esc(m.cn.slice(0, 1)) + '</span></div>';
      } else {
        posterHtml = '<div class="mv-fallback" style="--pc:' + data.phaseColor(m.phase) + '">'
          + '<span class="mv-fallback-t">' + esc(m.cn.slice(0, 1)) + '</span></div>';
      }
      return '<div class="map-visual-card">'
        + '<div class="mvc-poster">' + posterHtml + '</div>'
        + '<div class="mvc-info">'
        +   '<div class="mvc-t">' + esc(m.cn) + '</div>'
        +   '<div class="mvc-meta">'
        +     '<span class="chip">' + m.year + '</span>'
        +     '<span class="chip">第 ' + m.phase + ' 阶段</span>'
        +     ui.typeBadge(m.type)
        +   '</div>'
        +   '<div class="mvc-desc">' + esc(m.role || '') + '</div>'
        + '</div>'
        + '</div>';
    },

    /* ── V1.3 地图探索链（电影→关系→为什么→下一节点）── */
    exploreChain: function (m) {
      var links = data.relationsOf(m.id);
      if (!links.length) return '';
      var chips = links.slice(0, 4).map(function (l) {
        var o = data.get(l.other);
        if (!o) return '';
        return '<button class="map-explore-chip" data-explore="' + o.id + '">'
          + '<svg viewBox="0 0 12 12" fill="none"><path d="M4 2l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>'
          + esc(o.cn)
          + '</button>';
      }).join('');
      return '<div class="map-explore-chain">' + chips + '</div>';
    },

    /* 读取 URL 参数 */
    param: function (k) {
      var m = new RegExp('[?&]' + k + '=([^&#]*)').exec(global.location.search);
      return m ? decodeURIComponent(m[1]) : null;
    },

    /* 检测 prefers-reduced-motion */
    reducedMotion: function () {
      return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    },

    /* 阶段颜色辅助（统一委托 data.phaseColor 的 CSS token 版本，
     * 不再维护第二份 hex 映射，保证主题/Nudges 改色时全局一致） */
    phaseColor: function (phase) { return data.phaseColor(phase); },

    /* ── V1.3 A4：电影视觉输出，统一经 data.visual(id) 取 poster ──
     * 有海报映射 → <img>；没有 → 代码绘制的阶段色视觉卡。
     * 保证任意一部作品（含剧集/特别呈现/短片）都有"电影感"卡面。 */
    movieVisual: function (m, cls) {
      cls = cls ? ' ' + cls : '';
      var v = data.visual(m.id);
      if (v.poster) {
        return '<img class="mv-img' + cls + '" src="' + v.poster
          + '" alt="《' + esc(m.cn) + '》海报" loading="lazy"'
          + ' onerror="MCU.ui._visualImgFail(this,\'' + m.id + '\')">';
      }
      return ui.posterFallback(m, cls);
    },

    /* 海报加载失败：原地替换为代码绘制的阶段色视觉卡，绝不露出破图 */
    _visualImgFail: function (img, id) {
      img.onerror = null;
      var m = data.get(id);
      if (!m || !img.parentNode) { img.style.display = 'none'; return; }
      var cls = '';
      Array.prototype.forEach.call(img.classList, function (c) {
        if (c !== 'mv-img') cls += ' ' + c;
      });
      var tmp = document.createElement('div');
      tmp.innerHTML = ui.posterFallback(m, cls);
      img.parentNode.replaceChild(tmp.firstChild, img);
    },

    posterFallback: function (m, cls) {
      cls = cls ? ' ' + cls : '';
      var pc = ui.phaseColor(m.phase);
      var sym = {
        movie:   '<circle cx="60" cy="60" r="30" fill="none" stroke="currentColor" stroke-width="3"/>'
               + '<circle cx="60" cy="60" r="12" fill="currentColor" opacity=".75"/>',
        series:  '<path d="M60 18v84M18 60h84M32 32l56 56M88 32L32 88" stroke="currentColor" stroke-width="2.5" fill="none"/>',
        special: '<circle cx="60" cy="60" r="32" fill="none" stroke="currentColor" stroke-width="3" stroke-dasharray="6 6"/>'
               + '<circle cx="60" cy="60" r="10" fill="currentColor"/>',
        short:   '<rect x="36" y="42" width="48" height="36" rx="4" fill="none" stroke="currentColor" stroke-width="3"/>'
               + '<path d="M36 54h48" stroke="currentColor" stroke-width="3"/>'
      }[m.type] || '';
      return '<div class="mv-fallback' + cls + '" style="--pc:' + pc + '" aria-hidden="false">'
        + '<svg viewBox="0 0 120 120" aria-hidden="true">' + sym + '</svg>'
        + '<span class="mv-fallback-t">' + esc(m.cn) + '</span>'
        + '<span class="mv-fallback-y">' + (m.year || '') + ' · Phase ' + m.phase + '</span>'
        + '</div>';
    },

    /* SEO：canonical + Open Graph（JS 输出，部署到任意域名都自动生成正确 URL）
     * canonical 去掉状态参数（?r= / ?from= / ?focus=），只保留内容定义参数
     * （movie.html 的 ?id=），避免参数化 URL 被搜索引擎重复收录。 */
    injectSeoTags: function (currentPage) {
      try {
        var KEEP = { 'movie.html': ['id'], 'routes.html': ['r'] };
        var u = new URL(global.location.href);
        var q = new URLSearchParams();
        (KEEP[currentPage] || []).forEach(function (k) {
          var v = u.searchParams.get(k);
          if (v) q.set(k, v);
        });
        var canon = u.origin + u.pathname + (q.toString() ? '?' + q.toString() : '');

        var link = document.createElement('link');
        link.rel = 'canonical';
        link.href = canon;
        document.head.appendChild(link);

        var descEl = document.querySelector('meta[name="description"]');
        var pairs = [
          ['og:title', document.title],
          ['og:description', descEl ? descEl.content : ''],
          ['og:url', canon],
          ['og:type', 'website'],
          ['og:site_name', 'MCU 宇宙导航']
        ];
        pairs.forEach(function (p) {
          if (!p[1]) return;
          var meta = document.createElement('meta');
          meta.setAttribute('property', p[0]);
          meta.content = p[1];
          document.head.appendChild(meta);
        });
      } catch (e) {}
    },

    /* 挂载页面骨架 */
    mount: function (currentPage) {
      var h = document.getElementById('app-nav');
      if (h) h.innerHTML = ui.nav(currentPage);
      var f = document.getElementById('app-foot');
      if (f) f.innerHTML = ui.foot();
      /* 如果用户偏好减弱动效，添加 body class */
      if (ui.reducedMotion()) {
        document.body.classList.add('reduced-motion');
      }
      /* 延迟初始化滚动追踪，确保 DOM 已渲染 */
      requestAnimationFrame(function () { ui.initScrollSpy(); });
      /* 延迟到内联脚本执行完（动态 title 已设置）再注入 SEO 标签 */
      setTimeout(function () { ui.injectSeoTags(currentPage); }, 0);

      /* ── 运营数据统计：页面访问上报（V1.0 运营数据闭环 · 第四步）──
       * 仅统计层改动；channel 取自 URL ?from=/?channel=/?utm_source。
       * 页面键映射：index→home / routes(?r=)→route_detail / routes→routes
       *            / map→panorama / movie→movie / next→next */
      try {
        var _base = (currentPage || '').replace('.html', '');
        var _qs = new URLSearchParams(global.location.search);
        var _pg = _base;
        if (_base === 'index') _pg = 'home';
        else if (_base === 'routes') _pg = _qs.get('r') ? 'route_detail' : 'routes';
        else if (_base === 'map') _pg = 'panorama';
        else if (_base === 'movie') _pg = 'movie';
        else if (_base === 'next') _pg = 'next';
        var _pvPayload = null;
        if (_base === 'movie') { var _mid = _qs.get('id'); if (_mid) _pvPayload = { id: _mid }; }
        else if (_base === 'routes' && _qs.get('r')) { _pvPayload = { routeId: _qs.get('r') }; }
        if (global.MCU && global.MCU.stats) global.MCU.stats.pageView(_pg, { payload: _pvPayload });
      } catch (e) {}
    }
  };

  /* V1.3：转化卡按钮委托绑定——卡片由各页面 innerHTML 动态注入，
     用事件委托保证任何时刻插入的按钮都能点开扫码面板。
     document 存在性守卫：让本文件在 verify.js 等无 DOM 环境下也可加载。 */
  if (typeof document !== 'undefined' && document.addEventListener) {
    /* 行为埋点 + 转化卡委托（V1.0 运营数据闭环 · 第四/五/六节）
     * 事件命名统一为 click_<动作>；mp 入口额外携带 channel/from。 */
    document.addEventListener('click', function (e) {
      var t = e.target, matched = null;
      while (t && t !== document) {
        if (t.getAttribute) {
          if (t.getAttribute('data-fb') !== null) { matched = 'fb'; break; }
          if (t.getAttribute('data-mp-title') !== null) { matched = 'mp'; break; }
          if (t.getAttribute('data-stat') !== null) { matched = 'stat'; break; }
        }
        t = t.parentNode;
      }
      if (!t || t === document) return;
      var _pageKey = (global.location.pathname.split('/').pop() || '').replace('.html', '') || 'home';

      if (matched === 'stat') {
        if (global.MCU && global.MCU.stats) {
          global.MCU.stats.event(t.getAttribute('data-stat'), { page: _pageKey, payload: parseStatPayload(t) });
        }
        return; /* 显式埋点元素不触发弹层 */
      }
      if (matched === 'fb') { FeedbackUI.open(); return; }

      /* matched === 'mp'：进入小程序点击 */
      var _pt = t.getAttribute('data-mp-type'), _pid = t.getAttribute('data-mp-id'), _p = null;
      if (_pt && _pid) _p = { type: _pt, id: _pid };
      if (global.MCU && global.MCU.stats) {
        global.MCU.stats.event('click_enter_miniprogram', {
          page: _pageKey,
          payload: { type: _pt || '', id: _pid || '', channel: getChannel() }
        });
      }
      /* 参数透传方案：微信内 webview 通过 wx.miniProgram 带 channel 跳转小程序；
       * 站外扫码场景 channel 归因降级为「点击时记录 enter_miniprogram 事件（已知 H5 侧渠道）」。
       * 动态小程序码（scene）为首选升级，需微信服务端生成，列为 V1.1。 */
      if (global.wx && global.wx.miniProgram && typeof global.wx.miniProgram.navigateTo === 'function') {
        try { global.wx.miniProgram.navigateTo({ url: '/pages/home/home?channel=' + getChannel() + '&from=' + getChannel() }); } catch (e2) {}
      }
      ui.openMpModal(t.getAttribute('data-mp-title'), t.getAttribute('data-mp-desc'), _p);
    });

    /* 电影详情 / 关系探索 链接埋点（委托到 <a>） */
    document.addEventListener('click', function (e) {
      var a = e.target;
      while (a && a !== document && !(a.tagName && a.tagName.toLowerCase() === 'a')) a = a.parentNode;
      if (!a || a === document) return;
      var href = a.getAttribute('href') || '';
      if (!global.MCU || !global.MCU.stats) return;
      if (href.indexOf('movie.html') >= 0) {
        var _mid = ''; try { _mid = new URLSearchParams(href.split('?')[1] || '').get('id') || ''; } catch (e3) {}
        global.MCU.stats.event('click_movie_detail', {
          page: (global.location.pathname.split('/').pop() || '').replace('.html', '') || 'home',
          payload: { id: _mid }
        });
      } else if (href.indexOf('map.html') >= 0) {
        global.MCU.stats.event('click_relation_explore', {
          page: (global.location.pathname.split('/').pop() || '').replace('.html', '') || 'home',
          payload: {}
        });
      }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && _mpOverlay && _mpOverlay.classList.contains('show')) ui.closeMpModal();
    });
  }

  /* ── 运营数据统计 SDK（MCU.stats）──
   * V1.0 运营数据闭环建设：页面 PV / 用户行为事件统一上报。
   * 数据层：复用与 feedback 相同的 CloudBase Web SDK 匿名写通道，
   * 写入独立集合 stats（与 feedback 同源，运营在 CloudBase 控制台一处看全）。
   * 离线/云不可达：本地队列 _mcu_stats_queue 兜底，恢复后补发。 */
  function getChannel() {
    try {
      var q = new URLSearchParams(global.location.search);
      var ch = q.get('channel') || q.get('from') || q.get('utm_source') || '';
      ch = (ch || '').trim().toLowerCase();
      if (!ch) return 'direct';
      if (ch === 'douyin' || ch === 'dy' || ch.indexOf('douyin') >= 0) return 'douyin';
      if (ch === 'xiaohongshu' || ch === 'xhs' || ch.indexOf('xiaohongshu') >= 0 || ch.indexOf('rednote') >= 0) return 'xiaohongshu';
      if (ch === 'wechat' || ch === 'weixin' || ch.indexOf('wechat') >= 0) return 'wechat';
      if (ch === 'direct' || ch === 'none') return 'direct';
      return ch;
    } catch (e) { return 'direct'; }
  }
  function getEnv() {
    var ua = (global.navigator && global.navigator.userAgent) || '';
    if (/micromessenger/i.test(ua)) return 'wechat';
    if (/windows|macintosh|linux/i.test(ua) && !/mobile/i.test(ua)) return 'desktop';
    return 'mobile';
  }
  function parseStatPayload(t) {
    var p = {};
    var id = t.getAttribute('data-id'); if (id) p.id = id;
    var r = t.getAttribute('data-route'); if (r) p.routeId = r;
    return p;
  }

  var Stats = (function () {
    var ENV = 'mcu-d6gw0brqoa9521b58';
    var SDK_URL = 'https://cdn.jsdelivr.net/npm/@cloudbase/js-sdk@3.8.0/+esm';
    var sdkReady = null, app = null;

    function loadSdk() {
      if (sdkReady) return sdkReady;
      sdkReady = new Promise(function (resolve, reject) {
        try {
          if (window.cloudbase) { app = window.cloudbase.init({ env: ENV }); resolve(app); return; }
        } catch (e) {}
        import(SDK_URL).then(function (m) {
          var cb = (window.cloudbase || (m && m.default));
          if (!cb) throw new Error('sdk_no_factory');
          app = cb.init({ env: ENV });
          resolve(app);
        }).catch(function (e) { reject(e); });
      });
      return sdkReady;
    }
    // 匿名登录：浏览器内匿名写入前必须先登录（无登录时 add 会静默失败、resolve 但不落库）。
    // 优先用 Web SDK 标准 signInAnonymously()，失败回落到 anonymousAuthProvider().signIn()；
    // 两者都失败也继续尝试 add（部分环境允许未登录写），由 write 的回读校验兜底。
    function ensureAuth() {
      return loadSdk().then(function (a) {
        var auth;
        try { auth = a.auth(); } catch (e) { return a; }
        if (!auth) return a;
        var p;
        if (auth.signInAnonymously) p = auth.signInAnonymously();
        else if (auth.anonymousAuthProvider) p = auth.anonymousAuthProvider().signIn();
        else return a;
        return p.then(function () { return a; }, function () { return a; });
      });
    }
    function localQueue() {
      try { var raw = global.localStorage.getItem('_mcu_stats_queue'); return raw ? JSON.parse(raw) : []; }
      catch (e) { return []; }
    }
    function pushQueue(doc) {
      try { var q = localQueue(); q.push(doc); global.localStorage.setItem('_mcu_stats_queue', JSON.stringify(q.slice(-200))); } catch (e) {}
    }
    function flushQueue(db) {
      var q = localQueue();
      if (!q.length) return;
      q.slice().forEach(function (doc) {
        db.collection('stats').add(doc).then(function (r) {
          var id = (r && (r.id || r._id)) || null;
          if (!id) { pushQueue(doc); return; }            // SDK 未返回 id → 视为未落库
          var remain = localQueue(); var i = remain.indexOf(doc);
          if (i >= 0) remain.splice(i, 1);
          try { global.localStorage.setItem('_mcu_stats_queue', JSON.stringify(remain)); } catch (e) {}
        }).catch(function () { pushQueue(doc); });
      });
    }
    function write(doc) {
      doc.createdAt = new Date().toISOString();
      if (doc.ts == null) doc.ts = Date.now();
      doc.channel = doc.channel || getChannel();
      doc.env = doc.env || ENV;            // CloudBase 环境 ID（非设备类型）
      doc.device = doc.device || getEnv(); // 设备/平台分类：wechat/desktop/mobile
      doc.ua = doc.ua || ((global.navigator && global.navigator.userAgent) || '');
      ensureAuth().then(function (a) {
        var db = a.database();
        // add 返回真实 _id 即视为落库成功（readback 会因安全规则 read 限制误判，故不回读）。
        // add 失败（reject）才进本地队列，下次 pageview 时 flushQueue 重试。
        return db.collection('stats').add(doc).then(function (r) {
          var id = (r && (r.id || r._id)) || null;
          if (!id) { pushQueue(doc); return; }
          flushQueue(db);
        }).catch(function () { pushQueue(doc); });
      }).catch(function () { pushQueue(doc); });
    }
    function pageView(page, extra) {
      extra = extra || {};
      var fromRaw = '';
      try { fromRaw = new URLSearchParams(global.location.search).get('from') || ''; } catch (e) {}
      write({
        type: 'pageview',
        page: page,
        path: (global.location && global.location.pathname) || '',
        query: (global.location && global.location.search) || '',
        ref: (global.document && global.document.referrer) || '',
        from: fromRaw,
        payload: extra.payload || null,
        ts: Date.now()
      });
    }
    function event(name, extra) {
      extra = extra || {};
      var fromRaw = '';
      try { fromRaw = new URLSearchParams(global.location.search).get('from') || ''; } catch (e) {}
      write({
        type: 'event',
        name: name,
        page: extra.page || ((global.location.pathname.split('/').pop() || '').replace('.html', '') || 'home'),
        from: fromRaw,
        payload: extra.payload || null,
        ts: Date.now()
      });
    }
    return { pageView: pageView, event: event };
  })();

  /* ── D8「我要吐槽」反馈功能 ──
   * 低门槛纠错入口：用户发现问题 → 快速反馈 → CloudBase feedback 集合
   * 数据层：CloudBase Web SDK 匿名登录 + feedback.add（首次写入自动建集合）
   * 不强制登录 / 不建账号 / 最小必要字段 / 防重复提交 / 不暴露技术错误 */
  var FeedbackUI = (function () {
    var ENV = 'mcu-d6gw0brqoa9521b58';
    var SDK_URL = 'https://cdn.jsdelivr.net/npm/@cloudbase/js-sdk@3.8.0/+esm';
    var sdkReady = null, app = null, injected = false, submitting = false;

    var PANEL_HTML = ''
      + '<div class="fb-overlay" id="fbOverlay"><div class="fb-panel" id="fbPanel">'
      +   '<button class="fb-close" id="fbClose" type="button" aria-label="关闭">&times;</button>'
      +   '<div id="fbForm">'
      +     '<div class="fb-title"><svg viewBox="0 0 24 24" fill="none"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 10h.01M12 10h.01M16 10h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>我要吐槽</div>'
      +     '<div class="fb-guide">发现哪里不对？直接告诉我们。</div>'
      +     '<div class="fb-context" id="fbContext" style="display:none"><svg viewBox="0 0 24 24" fill="none"><path d="M12 2L2 7l10 5 10-5-10-5z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M2 17l10 5 10-5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M2 12l10 5 10-5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg><span id="fbContextLabel">当前作品：</span><b id="fbContextText"></b></div>'
      +     '<div class="fb-types-label">反馈类型</div>'
      +     '<div class="fb-types" id="fbTypes">'
      +       '<button type="button" class="fb-type" data-v="观影顺序">观影顺序</button>'
      +       '<button type="button" class="fb-type" data-v="电影名称">电影名称</button>'
      +       '<button type="button" class="fb-type" data-v="电影信息">电影信息</button>'
      +       '<button type="button" class="fb-type" data-v="电影关系">电影关系</button>'
      +       '<button type="button" class="fb-type" data-v="推荐问题">推荐问题</button>'
      +       '<button type="button" class="fb-type" data-v="页面问题">页面问题</button>'
      +       '<button type="button" class="fb-type" data-v="其他">其他</button>'
      +     '</div>'
      +     '<textarea class="fb-textarea" id="fbText" placeholder="说说哪里不对，我们来看看" maxlength="500"></textarea>'
      +     '<div class="fb-hint">例如：<em id="fbExample">我觉得《钢铁侠 2》应该放在《无敌浩克》之后。</em></div>'
      +     '<div class="fb-error" id="fbError">先说说哪里不对吧。</div>'
      +     '<button type="button" class="fb-submit" id="fbSubmit">提交吐槽</button>'
      +     '<button type="button" class="fb-cancel" id="fbCancel">取消</button>'
      +   '</div>'
      +   '<div id="fbSuccess" style="display:none"><div class="fb-success">'
      +     '<div class="fb-success-icon"><svg viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></div>'
      +     '<div class="fb-success-t">收到了，我们会认真看看。</div>'
      +     '<div class="fb-success-d">感谢你帮我们把 MCU 做得更准确。</div>'
      +     '<button type="button" class="fb-success-close" id="fbSuccessClose">关闭</button>'
      +   '</div></div>'
      +   '<div id="fbFail" style="display:none"><div class="fb-fail">'
      +     '<div class="fb-fail-icon"><svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.5"/><path d="M15 9l-6 6m0-6l6 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></div>'
      +     '<div class="fb-fail-t">没提交成功，再试一次。</div>'
      +     '<div class="fb-fail-d">网络好像出了点问题，检查一下网络后重试。</div>'
      +     '<button type="button" class="fb-fail-retry" id="fbRetry">再试一次</button>'
      +   '</div></div>'
      + '</div></div>';

    function loadSdk() {
      if (sdkReady) return sdkReady;
      sdkReady = new Promise(function (resolve, reject) {
        if (window.cloudbase) { try { app = window.cloudbase.init({ env: ENV }); resolve(app); } catch (e) { reject(e); } return; }
        import(SDK_URL).then(function (m) {
          var cb = window.cloudbase || (m && m.default);
          if (!cb) throw new Error('sdk_no_factory');
          app = cb.init({ env: ENV });
          resolve(app);
        }).catch(function (e) { reject(e); });
      });
      return sdkReady;
    }

    function ensureAuth() {
      return loadSdk().then(function (a) {
        var auth = a.auth();
        if (auth.anonymousAuthProvider) return auth.anonymousAuthProvider().signIn();
        if (auth.signInAnonymously) return auth.signInAnonymously();
        return auth.signInWithAnonymousAuthProvider();
      });
    }

    function resolveContext() {
      var path = (location.pathname.split('/').pop() || '').replace('.html', '') || 'home';
      var q = new URLSearchParams(location.search);
      var ctx = { page: path, movieId: '', routeId: '', exploreId: '', name: '' };
      try {
        if (path === 'movie') {
          var id = q.get('id');
          if (id && MCU.data.get) { var m = MCU.data.get(id); if (m) { ctx.movieId = id; ctx.name = m.cn || m.title || m.name || id; } }
        } else if (path === 'routes') {
          var rid = q.get('r') || 'newcomer';
          if (MCU.data.routeById) { var r = MCU.data.routeById(rid); if (r) { ctx.routeId = rid; ctx.name = r.name || rid; } }
        } else if (path === 'map') {
          var fid = q.get('focus');
          if (fid && MCU.data.get) { var fm = MCU.data.get(fid); if (fm) { ctx.exploreId = fid; ctx.movieId = fid; ctx.name = fm.cn || fm.title || fm.name || fid; } }
        }
      } catch (e) {}
      return ctx;
    }

    function inject() {
      if (injected) return; injected = true;
      var wrap = document.createElement('div'); wrap.innerHTML = PANEL_HTML;
      document.body.appendChild(wrap.firstElementChild);
      document.getElementById('fbClose').onclick = close;
      document.getElementById('fbSuccessClose').onclick = close;
      document.getElementById('fbCancel').onclick = close;
      document.getElementById('fbOverlay').addEventListener('click', function (e) { if (e.target === e.currentTarget) close(); });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
      document.getElementById('fbTypes').addEventListener('click', function (e) {
        var b = e.target.closest('.fb-type'); if (!b) return;
        this.querySelectorAll('.fb-type').forEach(function (x) { x.classList.remove('on'); });
        b.classList.add('on');
      });
      document.getElementById('fbSubmit').onclick = submit;
      document.getElementById('fbRetry').onclick = resetForm;
    }

    function open() {
      inject();
      var ctx = resolveContext();
      var c = document.getElementById('fbContext');
      if (ctx.name) { c.style.display = 'flex'; document.getElementById('fbContextText').textContent = ctx.name; }
      else c.style.display = 'none';
      var lbl = document.getElementById('fbContextLabel');
      if (lbl) lbl.textContent = (ctx.page === 'routes') ? '当前路线：' : '当前作品：';
      var ex = '我觉得《钢铁侠 2》应该放在《无敌浩克》之后。';
      if (ctx.page === 'routes') ex = '这条路线的顺序好像不太对。';
      else if (ctx.page === 'map') ex = '这两部作品的关系好像不成立。';
      document.getElementById('fbExample').textContent = ex;
      resetForm();
      document.getElementById('fbOverlay').classList.add('show');
      loadSdk().catch(function () {}); // 预加载，不阻塞交互
    }

    function resetForm() {
      document.getElementById('fbForm').style.display = 'block';
      document.getElementById('fbSuccess').style.display = 'none';
      document.getElementById('fbFail').style.display = 'none';
      var er = document.getElementById('fbError'); er.classList.remove('show'); er.textContent = '先说说哪里不对吧。';
      var ta = document.getElementById('fbText'); ta.classList.remove('error'); ta.value = '';
      document.getElementById('fbTypes').querySelectorAll('.fb-type').forEach(function (x) { x.classList.remove('on'); });
    }

    function close() {
      var ov = document.getElementById('fbOverlay'); if (ov) ov.classList.remove('show');
    }

    function submit() {
      if (submitting) return;
      var typeEl = document.querySelector('#fbTypes .fb-type.on');
      var ta = document.getElementById('fbText');
      var val = ta.value.trim();
      var er = document.getElementById('fbError');
      if (!typeEl) { er.textContent = '先选个反馈类型吧。'; er.classList.add('show'); return; }
      if (!val) { er.textContent = '先说说哪里不对吧。'; er.classList.add('show'); ta.classList.add('error'); return; }
      er.classList.remove('show'); ta.classList.remove('error');
      submitting = true;
      var btn = document.getElementById('fbSubmit'); btn.disabled = true; btn.textContent = '提交中…';
      var ctx = resolveContext();
      ensureAuth().then(function () {
        return app.database().collection('feedback').add({
          feedbackType: typeEl.getAttribute('data-v'),
          content: val,
          page: ctx.page,
          movieId: ctx.movieId || '',
          routeId: ctx.routeId || '',
          exploreId: ctx.exploreId || '',
          contextName: ctx.name || '',
          channel: getChannel(),
          platform: 'h5',
          contact: '',
          createdAt: new Date().toISOString(),
          status: 'new'
        });
      }).then(function () {
        submitting = false; btn.disabled = false; btn.textContent = '提交吐槽';
        document.getElementById('fbForm').style.display = 'none';
        document.getElementById('fbSuccess').style.display = 'block';
        setTimeout(close, 2000);
      }).catch(function () {
        submitting = false; btn.disabled = false; btn.textContent = '提交吐槽';
        document.getElementById('fbForm').style.display = 'none';
        document.getElementById('fbFail').style.display = 'block';
      });
    }

    return { open: open, close: close };
  })();

  global.MCU = { data: data, progress: progress, rec: rec, ui: ui, stats: Stats, getChannel: getChannel };

})(window);
