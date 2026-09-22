/* ============================================================
 * MCU 观影导航 H5 · V2.0 组件层
 * ------------------------------------------------------------
 * 统一组件（策划指令第十节）：
 *   SectionTitle  sectionTitle(o)   章节标题
 *   MovieCard     movieCard(m, o)   电影卡（海报 / 名称 / 阶段 / 推荐观看位置 / 已看状态）
 *   TimelineCard  timelineCard(u)   上映预告时间轴节点
 *   ProgressCard  progressCard()    我的 MCU 进度（完成比例 / 已看数量 / 档案入口）
 *
 * 依赖：data/*.js → assets/js/app.js → 本文件（顺序不可颠倒）
 * 挂载：window.MCU.v2
 *
 * 跨端说明（重要，避免误解）：
 *   本文件是 **H5 实现**。微信（WXML/WXSS）与抖音（TTML/TTSS）的组件体系
 *   与 H5 的 DOM 字符串渲染**无法共用同一份代码文件**。
 *   三端可复用的是：① 设计 Token ② 数据结构 ③ 本文件定义的**结构与类名契约**。
 *   契约见 `AI生成文件/H5/V2.0/组件规范.md`；小程序端按同一契约各自实现。
 *
 * 图片纪律：所有图片一律经 MCU.data.visual(id) 取（内部支持 MCU_ASSET_BASE 的
 *   CDN 前缀），禁止在本文件拼接任何资源路径；全部带 loading="lazy" + decoding="async"。
 * ============================================================ */

(function (global) {
  'use strict';

  var MCU = global.MCU;
  if (!MCU) { if (global.console) console.warn('[v2] MCU 未就绪，components.js 需在 app.js 之后加载'); return; }

  var esc = MCU.ui.esc;

  /* ==========================================================
   * V2.1 成就系统（本地计算，纯展示，无后端）
   * 规则全部基于 MCU.progress 的本地数据派生，不引入新存储。
   * need(p) 接收 MCU.progress 对象，返回布尔表示是否已达成。
   * 顺序即展示顺序（从易到难）。
   * ========================================================== */
  var ACHIEVEMENTS = [
    { id: 'start',   title: '启程',     desc: '标记第一部已看作品',
      need: function (p) { return p.count() >= 1; } },
    { id: 'five',    title: '初窥门径', desc: '累计观看 5 部 MCU 作品',
      need: function (p) { return p.count() >= 5; } },
    { id: 'ten',     title: '渐入佳境', desc: '累计观看 10 部 MCU 作品',
      need: function (p) { return p.count() >= 10; } },
    { id: 'phases',  title: '六阶通览', desc: '每个叙事阶段都看过至少一部',
      need: function (p) {
        for (var i = 1; i <= 6; i++) {
          var list = MCU.data.all.filter(function (c) { return c.phase === i; });
          if (!list.some(function (c) { return p.isSeen(c.id); })) return false;
        }
        return true;
      } },
    { id: 'all',     title: '完整宇宙', desc: '看完全部 MCU 作品',
      need: function (p) { return p.count() >= p.total(); } }
  ];
  var CHECK = '<svg viewBox="0 0 16 16" fill="none"><path d="M13.5 4.5L6.5 11.5 2.5 7.5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  function phaseBadge(phase) {
    if (phase >= 1 && phase <= 6) {
      return '<span class="v2-badge v2-badge--p' + phase + '">第 ' + phase + ' 阶段</span>';
    }
    return '<span class="v2-badge v2-badge--na">阶段待定</span>';
  }

  /* 无海报占位：阶段色渐变 + 片名首字，保证不破图 */
  function posterFallback(name, phase) {
    var ch = String(name || '?').trim().charAt(0);
    var col = (phase >= 1 && phase <= 6) ? 'var(--p' + phase + ')' : 'var(--surface-4)';
    return '<span class="v2-mcard-ph" style="background:linear-gradient(150deg,'
         + 'color-mix(in srgb, ' + col + ' 26%, var(--surface-2)) 0%, var(--surface-3) 100%)">'
         + esc(ch) + '</span>';
  }

  var v2 = {

    /* ==========================================================
     * SectionTitle
     * @param {Object} o
     *   eyebrow   小标签（可选，金色）
     *   title     主标题
     *   sub       副标题（可选）
     *   moreHref  「更多」链接（可选）
     *   moreText  「更多」文案，默认「全部」
     * ========================================================== */
    sectionTitle: function (o) {
      o = o || {};
      var more = '';
      if (o.moreHref) {
        more = '<a class="v2-st-more" href="' + o.moreHref + '">'
             + esc(o.moreText || '全部')
             + '<svg viewBox="0 0 24 24"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>'
             + '</a>';
      }
      return '<div class="v2-hd">'
        + '<div class="v2-hd-l">'
        +   (o.eyebrow ? '<span class="v2-st-eyebrow">' + esc(o.eyebrow) + '</span>' : '')
        +   '<h2 class="v2-st-title">' + esc(o.title || '') + '</h2>'
        +   (o.sub ? '<div class="v2-st-sub">' + esc(o.sub) + '</div>' : '')
        + '</div>' + more + '</div>';
    },

    /* ==========================================================
     * MovieCard
     * @param {Object} m    MCU 内容对象（CONTENT 模型）
     * @param {Object} opts
     *   sub   'order'（默认）显示「第 N 阶段 · 上映第 M 部」= 推荐观看位置
     *          'date'  显示发布时间（YYYY-MM-DD）
     * ========================================================== */
    movieCard: function (m, opts) {
      if (!m) return '';
      opts = opts || {};
      var seen = MCU.progress.isSeen(m.id);
      var vis = MCU.data.visual(m.id);
      var src = vis.poster || '';

      var sub;
      if (opts.sub === 'date') {
        sub = esc(m.date || (m.year || '')) + ' · 第 ' + m.phase + ' 阶段';
      } else {
        sub = '第 ' + m.phase + ' 阶段 · ' + esc(MCU.ui.orderLabel(m));
      }

      return '<a class="v2-mcard' + (seen ? ' is-seen' : '') + '" href="movie.html?id=' + esc(m.id) + '">'
        + '<span class="v2-mcard-poster">'
        +   (src
              ? '<img class="v2-mcard-img" src="' + esc(src) + '" alt="' + esc(m.cn) + '"'
                + ' loading="lazy" decoding="async">'
              : posterFallback(m.cn, m.phase))
        +   '<span class="v2-mcard-phase" style="color:'
        +     ((m.phase >= 1 && m.phase <= 6) ? 'var(--p' + m.phase + ')' : 'var(--text-weak)')
        +   '">P' + m.phase + '</span>'
        +   '<span class="v2-mcard-seen">' + CHECK + '已看</span>'
        + '</span>'
        + '<span class="v2-mcard-title">' + esc(m.cn) + '</span>'
        + '<span class="v2-mcard-meta">' + sub + '</span>'
        + '</a>';
    },

    /* ==========================================================
     * TimelineCard —— 上映预告时间轴节点
     * @param {Object} u  MCU_UPCOMING 条目
     *                    { id, title, en, date, phase, poster, status, note }
     * ========================================================== */
    timelineCard: function (u, opts) {
      if (!u) return '';
      opts = opts || {};
      var featured = !!opts.featured;
      var statusBadge = (u.status === 'dated')
        ? '<span class="v2-badge v2-badge--soon">已定档</span>'
        : '<span class="v2-badge v2-badge--tba">档期待定</span>';

      /* V2.1 推荐关注：复用进度里的 want_to_watch（想看=关注），本地存储 */
      var wanted = MCU.progress.isWanted(u.id);
      var followBtn = '<button class="v2-tl-follow' + (wanted ? ' is-on' : '') + '"'
        + ' type="button" data-follow="' + esc(u.id || u.title || '') + '">'
        + (wanted ? '已关注' : '关注') + '</button>';

      return '<div class="v2-tl-item' + (featured ? ' featured' : '') + '">'
        + '<span class="v2-tl-dot"></span>'
        + '<div class="v2-tl-card">'
        +   '<div class="v2-tl-top">'
        +     phaseBadge(u.phase)
        +     statusBadge
        +     '<span class="v2-tl-date">' + esc(u.date || '') + '</span>'
        +     followBtn
        +   '</div>'
        +   '<div class="v2-tl-name">' + esc(u.title || u.cn || '') + '</div>'
        +   (u.en ? '<div class="v2-tl-en">' + esc(u.en) + '</div>' : '')
        +   (u.note ? '<div class="v2-tl-note">' + esc(u.note) + '</div>' : '')
        + '</div></div>';
    },

    /* 上映预告整段：按年份分组的垂直时间轴
     * @param {Array} list  MCU_UPCOMING
     */
    timeline: function (list) {
      list = (list || []).slice().sort(function (a, b) {
        return String(a.date || '').localeCompare(String(b.date || ''));
      });
      if (!list.length) return '<div class="v2-empty">暂无已公布的未来作品</div>';

      var groups = [], index = {};
      list.forEach(function (u) {
        var y = String(u.date || '').slice(0, 4) || '待定';
        if (!index[y]) { index[y] = []; groups.push(y); }
        index[y].push(u);
      });

      var nearest = list[0].id;   /* 排序后第一条 = 最近一部，作为 featured */

      return groups.map(function (y) {
        var items = index[y];
        var head = '<div class="v2-tl-year"><b>' + esc(y) + '</b><i></i>'
                 + '<span>' + items.length + ' 部</span></div>';
        return head + '<div class="v2-tl-list">'
          + items.map(function (u) { return v2.timelineCard(u, { featured: u.id === nearest }); }).join('')
          + '</div>';
      }).join('');
    },

    /* ==========================================================
     * ProgressCard —— 我的 MCU
     * 展示：观看进度 / 完成比例 / 已观看数量 / 生成档案入口
     * ========================================================== */
    progressCard: function () {
      var seen = MCU.progress.count();
      var total = MCU.progress.total();
      var pct = total ? Math.round(seen / total * 100) : 0;

      /* 环形进度：r=34 → 周长 213.6 */
      var C = 2 * Math.PI * 34;
      var offset = C * (1 - (total ? seen / total : 0));

      var latest = MCU.progress.latest();
      var nextHtml = '';
      if (latest) {
        var r = MCU.rec.next(latest.id, 'mainline');
        nextHtml = '<a class="v2-prog-link" href="next.html?from=' + esc(latest.id) + '">'
          + '最新看过《' + esc(latest.cn) + '》'
          + (r ? '，下一部《' + esc(r.movie.cn) + '》' : '')
          + '<svg viewBox="0 0 24 24"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg></a>';
      }

      /* 六阶段进度点 */
      var dots = [1, 2, 3, 4, 5, 6].map(function (p) {
        var list = MCU.data.all.filter(function (c) { return c.phase === p; });
        if (!list.length) return '';
        var done = list.filter(function (c) { return MCU.progress.isSeen(c.id); }).length;
        var cls = (done === list.length) ? ' done' : (done > 0 ? ' cur' : '');
        return '<span class="v2-prog-dot' + cls + '" style="background:' + MCU.data.phaseColor(p)
             + '" title="第 ' + p + ' 阶段 ' + done + '/' + list.length + '"></span>';
      }).join('');

      return '<div class="v2-prog">'
        + '<div class="v2-prog-hd">'
        +   '<div>'
        +     '<div class="v2-prog-label">已观看</div>'
        +     '<div class="v2-prog-count"><em>' + seen + '</em> <span>/ ' + total + ' 部</span></div>'
        +     '<div class="v2-prog-note">'
        +       (seen ? '已完成全部内容的 ' + pct + '%' : '还没有记录，去作品页标记为已看即可开始计数')
        +     '</div>'
        +   '</div>'
        +   '<div class="v2-prog-ring">'
        +     '<svg width="76" height="76" viewBox="0 0 80 80" aria-hidden="true">'
        +       '<circle class="v2-prog-ring-bg" cx="40" cy="40" r="34"></circle>'
        +       '<circle class="v2-prog-ring-fill" cx="40" cy="40" r="34"'
        +         ' stroke-dasharray="' + C.toFixed(1) + '" stroke-dashoffset="' + offset.toFixed(1) + '"></circle>'
        +     '</svg>'
        +     '<span class="v2-prog-pct">' + pct + '%</span>'
        +   '</div>'
        + '</div>'
        + '<div class="v2-prog-bar"><div class="v2-prog-fill" style="width:' + pct + '%"></div></div>'
        + '<div class="v2-prog-phases">' + dots + '</div>'
        + '<button class="v2-btn-archive" type="button" data-mp-title="生成我的 MCU 档案"'
        +   ' data-mp-desc="已看记录、观影路线与收藏，一起存进小程序，换设备也能接着看。">'
        +   '<svg viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/></svg>'
        +   '生成我的 MCU 档案'
        + '</button>'
        + nextHtml
        + '</div>';
    },

    /* ==========================================================
     * 社区入口卡（V2.1：热门话题 + 讨论入口 + 参与提示）
     * 纪律：不做发帖 / 评论 / 用户系统；不展示任何虚构互动数据。
     * topics 来自 window.MCU_COMMUNITY_TOPICS（策划精选静态数据）。
     * 契约：{ id, tag, title, desc }；将来社区上线后整体替换为后端列表即可。
     * ========================================================== */
    communityCard: function (topics) {
      topics = topics || global.MCU_COMMUNITY_TOPICS || [];
      var topicHtml = topics.slice(0, 4).map(function (t) {
        return '<button class="v2-topic" type="button" data-topic="' + esc(t.id) + '">'
          + '<span class="v2-topic-tag">' + esc(t.tag || '话题') + '</span>'
          + '<span class="v2-topic-t">' + esc(t.title) + '</span>'
          + (t.desc ? '<span class="v2-topic-d">' + esc(t.desc) + '</span>' : '')
          + '</button>';
      }).join('');

      return '<div class="v2-community-wrap">'
        + '<div class="v2-community" id="v2-community" role="button" tabindex="0">'
        +   '<span class="v2-com-icon">'
        +     '<svg viewBox="0 0 24 24"><path d="M21 6h-2v9H6v2c0 .55.45 1 1 1h11l4 4V7c0-.55-.45-1-1-1zm-4 6V3c0-.55-.45-1-1-1H3c-.55 0-1 .45-1 1v14l4-4h10c.55 0 1-.45 1-1z"/></svg>'
        +   '</span>'
        +   '<span class="v2-com-info">'
        +     '<span class="v2-com-title">漫威讨论区</span>'
        +     '<span class="v2-com-meta">剧情讨论、观影路线分享、角色投票</span>'
        +   '</span>'
        +   '<span class="v2-com-soon">即将开放</span>'
        + '</div>'
        + (topicHtml ? '<div class="v2-topics">' + topicHtml + '</div>' : '')
        + '<div class="v2-com-tip">社区开放后，你可以分享观影路线、参与角色投票、发起话题讨论。</div>'
        + '</div>';
    },

    /* ==========================================================
     * V2.1 已观看电影列表（我的MCU）
     * 数据：MCU.progress.seenIds() → MCU.data.get(id) → 内容对象
     * 展示：最近的 8 部（按上映时间倒序），超出提示去作品库查看
     * ========================================================== */
    seenList: function () {
      var ids = MCU.progress.seenIds();
      if (!ids.length) return '';
      var items = ids.map(function (id) { return MCU.data.get(id); })
        .filter(Boolean)
        .sort(function (a, b) { return b.ro - a.ro; });   /* 最近看过的在前 */
      var cap = 8;
      var shown = items.slice(0, cap);
      var chips = shown.map(function (m) {
        var vis = MCU.data.visual(m.id);
        var src = vis.poster || '';
        var ph = src
          ? '<img class="v2-seen-img" src="' + esc(src) + '" alt="' + esc(m.cn) + '"'
            + ' loading="lazy" decoding="async">'
          : posterFallback(m.cn, m.phase);
        return '<a class="v2-seen-chip" href="movie.html?id=' + esc(m.id) + '">'
          +   '<span class="v2-seen-ph">' + ph + '</span>'
          +   '<span class="v2-seen-name">' + esc(m.cn) + '</span>'
          + '</a>';
      }).join('');

      return '<div class="v2-seen">'
        + '<div class="v2-seen-hd">已观看 · <b>' + items.length + '</b> 部</div>'
        + '<div class="v2-seen-grid">' + chips + '</div>'
        + (items.length > cap
              ? '<div class="v2-seen-more">还有 ' + (items.length - cap) + ' 部，去作品库查看</div>'
              : '')
        + '</div>';
    },

    /* ==========================================================
     * V2.1 成就系统（我的MCU）
     * 纯展示，基于 ACHIEVEMENTS 规则本地计算，无新存储
     * ========================================================== */
    achievements: function () {
      var p = MCU.progress;
      var earned = 0;
      var items = ACHIEVEMENTS.map(function (a) {
        var on = a.need(p);
        if (on) earned++;
        return '<div class="v2-ach-item' + (on ? ' is-on' : '') + '">'
          +   '<span class="v2-ach-ic">' + (on ? CHECK
              : '<svg viewBox="0 0 24 24"><path d="M19 13H5v-2h14v2z"/></svg>') + '</span>'
          +   '<span class="v2-ach-t">' + esc(a.title) + '</span>'
          +   '<span class="v2-ach-d">' + esc(a.desc) + '</span>'
          + '</div>';
      }).join('');

      return '<div class="v2-ach">'
        + '<div class="v2-seen-hd">成就 · <b>' + earned + '</b>/' + ACHIEVEMENTS.length + '</div>'
        + '<div class="v2-ach-grid">' + items + '</div>'
        + '</div>';
    },

    /* ==========================================================
     * 轻提示
     * ========================================================== */
    toast: function (msg) {
      var el = document.getElementById('v2-toast');
      if (!el) {
        el = document.createElement('div');
        el.id = 'v2-toast';
        el.className = 'v2-toast';
        el.setAttribute('role', 'status');
        document.body.appendChild(el);
      }
      el.textContent = msg;
      /* 强制回流，保证连续点击也能重播过渡 */
      void el.offsetWidth;
      el.classList.add('show');
      clearTimeout(el._t);
      el._t = setTimeout(function () { el.classList.remove('show'); }, 2200);
    },

    /* ==========================================================
     * ===== V2.2 最新漫威资讯模块（v2n- 前缀）=====
     * ----------------------------------------------------------
     * 依据：产品规范 V2.2 R6/R7/R8 + 设计规范 R1-R12
     * 数据：window.MCU_NEWS（h5/data/news.js）
     * 纪律：不新增 Token；不改写状态文案；不出现百分比 / 星级 / 评分
     * ========================================================== */

    /* ---- 状态文案与提醒语（设计规范附录 A，固定文案，禁止改写）---- */
    NEWS_NOTICE: {
      official_confirmed:    '该消息已获得 Marvel / Disney 官方发布确认。官方信息此后仍可能调整或更正，请以官方最新发布为准。',
      multi_source_reported: '已有多家媒体报道该消息，但目前尚未获得 Marvel / Disney 官方确认。',
      single_source:         '目前仅有单一媒体报道，尚未获得 Marvel / Disney 官方确认。',
      rumor:                 '该信息来自非官方消息源，目前尚未获得 Marvel / Disney 官方确认，请谨慎参考。',
      unverified:            '目前来源不足，暂无法判断该消息的来源层级。',
      conflicting:           '目前不同来源存在明确差异，暂无法确认该消息是否属实。相关来源及其表述已列于详情页。',
      officially_denied:     '该消息已被 Marvel / Disney 官方否认。',
      corrected:             '原发布方已发布更正声明，当前内容以更正后为准。'
    },

    NEWS_LABEL: {
      official_confirmed:    '官方已确认',
      multi_source_reported: '多家媒体报道',
      single_source:         '单一来源报道',
      rumor:                 '传闻 · 爆料',
      unverified:            '信息待核实',
      conflicting:           '信息存在冲突',
      officially_denied:     '官方已否认',
      corrected:             '来源已更正'
    },

    /* ---- 状态图标（12x12 内联 SVG，统一线条风格，设计规范 R5.7）---- */
    NEWS_ICON: {
      official_confirmed:    'M6 1L2 3v4c0 2 1.5 3.5 4 4 2.5-0.5 4-2 4-4V3L6 1z M4 5l1.5 1.5L8 4',
      multi_source_reported: 'M2 4h6v4H2z M3 6h6v4H3z',
      single_source:         'M5 6h2v2H5z',
      rumor:                 'M5 3a2 2 0 012 2c0 1-1 1-1 2v.5 M6 8.5h.01',
      unverified:            'M3 6h4',
      conflicting:           'M6 2v3 M6 5L4 7 M6 5l2 2',
      officially_denied:     'M3.5 3.5l5 5 M8.5 3.5l-5 5',
      corrected:             'M7 2.5A3 3 0 105 8.5 M5 8.5L3 7 M5 8.5L3 9.5'
    },

    /* 并列打破用的状态优先级（产品规范 R5.2 Step 4） */
    NEWS_STATUS_RANK: {
      official_confirmed: 0, multi_source_reported: 1, single_source: 2,
      rumor: 3, unverified: 4, conflicting: 5, officially_denied: 6, corrected: 7
    },

    /* ----------------------------------------------------------
     * owner_group 独立性判定（产品规范 V2.2 R6.1 + R8.3 约束）
     * 「待核」「unknown」「未确认」及空值一律不计入独立证据组。
     * ---------------------------------------------------------- */
    isGroupConfirmed: function (g) {
      var v = String(g == null ? '' : g).trim();
      if (!v) return false;
      if (v === '待核' || v === '未确认' || v === 'unknown') return false;
      return true;
    },

    /* 派生：独立 owner_group 数量（禁止手写，运行时计算） */
    calcIndependentGroupCount: function (item) {
      if (!item || !item.reported_by || !item.reported_by.length) return 0;
      var seen = {}, n = 0;
      item.reported_by.forEach(function (s) {
        var g = s && s.owner_group;
        if (!v2.isGroupConfirmed(g)) return;
        var k = String(g).trim();
        if (!seen[k]) { seen[k] = 1; n++; }
      });
      return n;
    },

    /* 展示用：独立来源数文案（设计规范 R6.4 / D10 / D11） */
    independentCountText: function (item) {
      var st = item && item.verification_status;
      if (st !== 'multi_source_reported' && st !== 'single_source') return '';
      /* owner_group 全部未确认时，不得展示任何来源数量 */
      var confirmed = (item.reported_by || []).filter(function (s) {
        return v2.isGroupConfirmed(s && s.owner_group);
      });
      if (!confirmed.length) return '';
      var n = v2.calcIndependentGroupCount(item);
      if (n >= 2) return '已由 ' + n + ' 个独立来源报道';
      if (n === 1) return st === 'single_source' ? '仅有 1 个独立来源报道' : '已由 1 个独立来源报道';
      return '';
    },

    /* 日期口径：一律只取日期部分，禁止时分（设计规范 D13） */
    newsDate: function (item) {
      if (!item) return '';
      var raw = item.publish_time || item.first_seen_at || '';
      var m = String(raw).match(/(\d{4})-(\d{2})-(\d{2})/);
      return m ? (m[1] + '-' + m[2] + '-' + m[3]) : '';
    },

    /* 仅允许 http/https/相对链接，避免 javascript: 注入 */
    safeUrl: function (u) {
      var s = String(u == null ? '' : u).trim();
      if (!s) return '';
      if (/^https?:\/\//i.test(s) || /^[a-z0-9._\/-]+$/i.test(s)) return s;
      return '';
    },

    /* ----------------------------------------------------------
     * 状态标签
     * ---------------------------------------------------------- */
    statusBadge: function (status) {
      var st = v2.NEWS_LABEL[status] ? status : 'unverified';   /* 兜底 unverified */
      var d = v2.NEWS_ICON[st];
      return '<span class="v2n-status-badge v2n-status-badge--' + st + '">'
           + '<svg class="v2n-status-badge__icon" viewBox="0 0 12 12" fill="none" '
           + 'stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" '
           + 'aria-hidden="true"><path d="' + d + '"/></svg>'
           + esc(v2.NEWS_LABEL[st])
           + '</span>';
    },

    /* ----------------------------------------------------------
     * 排序（产品规范 R5.2 五步）
     * @param {Array} list
     * @param {number} nowTs 可选，便于测试注入固定时间
     * ---------------------------------------------------------- */
    sortNews: function (list, nowTs) {
      var now = nowTs == null ? Date.now() : nowTs;
      var arr = (list || []).slice();

      /* Step 0 过滤 */
      arr = arr.filter(function (it) {
        if (!it) return false;
        if (it.verification_status === 'officially_denied' && it.pinned !== true) return false;
        if (!it.publish_time && !it.first_seen_at) return false;
        return true;
      });

      /* Step 1 置顶有效性 */
      arr.forEach(function (it) {
        var ok = it.pinned === true;
        if (ok && it.pinned_until) {
          var t = Date.parse(it.pinned_until);
          if (!isNaN(t) && t <= now) ok = false;
        }
        it.__pinnedOk = ok;
      });

      function ts(it) {
        var t = it.publish_time ? Date.parse(it.publish_time) : NaN;
        if (isNaN(t)) t = Date.parse(it.first_seen_at || '');
        return isNaN(t) ? 0 : t;
      }
      function rank(it) {
        var r = v2.NEWS_STATUS_RANK[it.verification_status];
        return r == null ? 9 : r;
      }

      arr.sort(function (a, b) {
        /* Step 2 分层：有效置顶优先 */
        if (a.__pinnedOk !== b.__pinnedOk) return a.__pinnedOk ? -1 : 1;

        /* Step 3 置顶组内：pinned_order 升序 → publish_time 降序 → id 升序 */
        if (a.__pinnedOk && b.__pinnedOk) {
          var oa = Number(a.pinned_order) || 0, ob = Number(b.pinned_order) || 0;
          if (oa !== ob) return oa - ob;
        }

        var ta = ts(a), tb = ts(b);
        if (ta !== tb) return tb - ta;

        /* Step 4 并列打破：状态优先级 → id 升序 */
        if (rank(a) !== rank(b)) return rank(a) - rank(b);
        return String(a.id).localeCompare(String(b.id));
      });
      return arr;
    },

    /* ----------------------------------------------------------
     * 关联 MCU 节点
     * 未命中 id 一律丢弃（设计规范 R12.8），不得新造 id。
     * ---------------------------------------------------------- */
    relatedNodes: function (item) {
      var out = [], i;
      if (!item) return out;

      (item.related_movies || []).forEach(function (id) {
        var m = MCU.data.get(id);
        if (m && m.type === 'movie') out.push({ kind: 'movie', label: '电影', name: m.en || m.cn, phase: m.phase, href: 'movie.html?id=' + encodeURIComponent(m.id) });
      });
      (item.related_series || []).forEach(function (id) {
        var s = MCU.data.get(id);
        if (s && s.type === 'series') out.push({ kind: 'series', label: '剧集', name: s.en || s.cn, phase: s.phase, href: 'movie.html?id=' + encodeURIComponent(s.id) });
      });
      (item.related_characters || []).forEach(function (id) {
        var c = MCU.data.getChar(id);
        if (c) out.push({ kind: 'character', label: '角色', name: c.cn || c.en, phase: null, href: 'map.html?focus=' + encodeURIComponent(c.id) });
      });
      (item.related_phases || []).forEach(function (p) {
        var n = Number(p);
        if (!(n >= 1 && n <= 6) || n % 1 !== 0) return;   /* 阶段取值 1-6 */
        out.push({ kind: 'phase', label: '阶段', name: 'Phase ' + n, phase: n, href: '' });  /* D17：不跳转 */
      });
      return out;
    },

    /* 卡片关联行文案（紧凑一行） */
    relatedSummary: function (item) {
      var ns = v2.relatedNodes(item);
      if (!ns.length) return '';
      var parts = ns.slice(0, 2).map(function (n) { return n.name; });
      if (ns.length > 2) parts.push('等 ' + ns.length + ' 个节点');
      return parts.join(' · ');
    },

    /* ----------------------------------------------------------
     * 来源行（设计规范 R4.6）
     * ---------------------------------------------------------- */
    sourceLine: function (item) {
      if (!item) return '';
      var st = item.verification_status;
      var rb = item.reported_by || [];

      function names() {
        return rb.map(function (s) { return s.source_name; }).filter(Boolean);
      }
      if (st === 'official_confirmed') return item.official_source || names()[0] || '';
      if (st === 'conflicting') return '多来源存在分歧';
      if (st === 'unverified') return '来源待确认';
      if (st === 'officially_denied' || st === 'corrected') return names()[0] || '';
      if (st === 'rumor') return item.original_source || '爆料来源';
      if (rb.length > 2) return names().slice(0, 2).join(' · ') + ' 等 ' + rb.length + ' 家';
      return names().join(' · ');
    },

    /* ----------------------------------------------------------
     * 资讯卡片（首页 compact / 列表 standard）
     * ---------------------------------------------------------- */
    newsCard: function (item, opts) {
      if (!item) return '';
      opts = opts || {};
      var st = v2.NEWS_LABEL[item.verification_status] ? item.verification_status : 'unverified';
      var variant = opts.variant === 'compact' ? 'compact' : 'standard';

      var cls = 'v2n-news-card v2n-news-card--' + variant;
      if (st === 'conflicting') cls += ' v2n-news-card--conflict';
      if (st === 'officially_denied') cls += ' v2n-news-card--denied';
      if (st === 'corrected' || (item.report_corrections && item.report_corrections.length)) cls += ' v2n-news-card--corrected';

      var h = '<article class="' + cls + '" data-id="' + esc(item.id) + '" data-status="' + st + '">';
      h += v2.statusBadge(st);
      h += '<h3 class="v2n-news-card__title">' + esc(item.title) + '</h3>';

      /* 报道级更正提示行（仅当有更正记录且事件级未落为 corrected 时） */
      if (st !== 'corrected' && item.report_corrections && item.report_corrections.length) {
        h += '<div class="v2n-correction-notice v2n-correction-notice--inline">'
           + '<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><path d="' + v2.NEWS_ICON.corrected + '"/></svg>'
           + '<span>该报道已被来源更正</span></div>';
      }
      if (st === 'corrected') {
        h += '<div class="v2n-correction-notice v2n-correction-notice--inline">'
           + '<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><path d="' + v2.NEWS_ICON.corrected + '"/></svg>'
           + '<span>该报道已被来源更正，以更正后内容为准</span></div>';
      }

      if (variant === 'standard' && item.summary) {
        h += '<p class="v2n-news-card__summary">' + esc(item.summary) + '</p>';
      }

      var sl = v2.sourceLine(item);
      if (sl) h += '<div class="v2n-news-card__sources">' + esc(sl) + '</div>';

      var meta = [];
      var ct = v2.independentCountText(item);
      if (ct) meta.push(ct);
      var d = v2.newsDate(item);
      if (d) meta.push(d);
      if (meta.length) h += '<div class="v2n-news-card__meta">' + esc(meta.join(' · ')) + '</div>';

      var rs = v2.relatedSummary(item);
      if (rs) h += '<div class="v2n-news-card__related">相关：' + esc(rs) + '</div>';

      h += '<span class="v2n-news-card__arrow" aria-hidden="true">'
         + '<svg viewBox="0 0 24 24"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg></span>';
      h += '</article>';
      return h;
    },

    /* ----------------------------------------------------------
     * 来源项 + 关联节点 + 详情页
     * ---------------------------------------------------------- */
    sourceItem: function (s, isOfficial) {
      if (!s) return '';
      var url = v2.safeUrl(s.source_url);
      var host = '';
      try { if (url && /^https?:/i.test(url)) host = new URL(url).hostname; } catch (e) { host = ''; }

      var h = '<div class="v2n-source-item' + (isOfficial ? ' v2n-source-item--official' : '') + '">';
      h += '<div class="v2n-source-item__head">'
         + (isOfficial ? '<span class="v2n-source-item__star" aria-hidden="true">★</span>' : '')
         + '<span class="v2n-source-item__name">' + esc(s.source_name) + '</span></div>';
      if (host) h += '<div class="v2n-source-item__host">' + esc(host) + '</div>';
      else if (s.owner_group) h += '<div class="v2n-source-item__host">' + esc('owner_group：' + s.owner_group) + '</div>';
      if (url) {
        h += '<a class="v2n-source-item__link" href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">查看'
           + '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg></a>';
      }
      h += '</div>';
      return h;
    },

    relatedNode: function (n) {
      if (!n) return '';
      var inner = '<span class="v2n-related-node__type' + (n.phase ? ' v2n-related-node__type--p' + n.phase : '') + '">' + esc(n.label) + '</span>'
                + '<span class="v2n-related-node__name">' + esc(n.name) + '</span>'
                + (n.phase ? '<span class="v2n-related-node__phase">Phase ' + n.phase + '</span>' : '');
      /* D17：阶段节点卡本期纯信息展示，不做跳转、不产生死链 */
      if (n.href) {
        return '<a class="v2n-related-node" href="' + esc(n.href) + '">' + inner + '</a>';
      }
      return '<span class="v2n-related-node v2n-related-node--static">' + inner + '</span>';
    },

    /* 详情页：原始来源 URL 选取（设计规范 R3.4⑨） */
    originalSourceUrl: function (item) {
      if (item && item.official_source_url) return item.official_source_url;
      var rb = (item && item.reported_by) || [];
      return rb.length ? (rb[0].source_url || '') : '';
    },

    newsDetail: function (item) {
      if (!item) return '';
      var st = v2.NEWS_LABEL[item.verification_status] ? item.verification_status : 'unverified';
      var h = '';

      /* ① + ② + ③ */
      h += '<div class="v2n-detail-head">' + v2.statusBadge(st) + '</div>';
      h += '<h1 class="v2n-detail-title">' + esc(item.title) + '</h1>';
      var d = v2.newsDate(item);
      if (d) h += '<div class="v2n-detail-date">' + esc(d) + '</div>';
      h += '<hr class="v2n-hr">';

      /* ④ 摘要 */
      if (item.summary) h += '<p class="v2n-detail-summary">' + esc(item.summary) + '</p>';

      /* ⑤ 关联 MCU */
      var ns = v2.relatedNodes(item);
      if (ns.length) {
        h += '<div class="v2n-block"><div class="v2n-block__eyebrow">RELATED MCU · 关联 MCU</div>'
           + '<div class="v2n-related-rail">'
           + ns.map(function (n) { return v2.relatedNode(n); }).join('')
           + '</div></div>';
      }

      /* ⑥ 来源信息 */
      var rb = item.reported_by || [];
      h += '<div class="v2n-block"><div class="v2n-block__eyebrow">SOURCES · 来源信息</div>';
      if (rb.length) {
        h += '<div class="v2n-source-grid">' + rb.map(function (s) {
          var isOfficial = !!item.official_source && s.source_name === item.official_source;
          return v2.sourceItem(s, isOfficial);
        }).join('') + '</div>';
      } else {
        h += '<div class="v2n-source-item"><div class="v2n-source-item__head"><span class="v2n-source-item__name">来源待确认</span></div></div>';
      }
      var ct = v2.independentCountText(item);
      if (ct) h += '<div class="v2n-source-count">' + esc(ct) + '</div>';
      var os = item.original_source;
      if (os && os !== 'unknown') h += '<div class="v2n-source-note">原始消息源：' + esc(os) + '</div>';
      else if (os === 'unknown' || !os) h += '<div class="v2n-source-note v2n-source-note--muted">暂无法确认原始消息源</div>';
      h += '</div>';

      /* ⑦ 交叉验证（仅 conflicting） */
      if (st === 'conflicting' && item.conflict_statements && item.conflict_statements.length) {
        h += '<div class="v2n-block"><div class="v2n-block__eyebrow">CROSS-CHECK · 交叉验证信息</div>'
           + '<p class="v2n-block__lead">不同来源对该消息存在不一致说法：</p>'
           + '<div class="v2n-cross-grid">'
           + item.conflict_statements.map(function (c) {
               var u = v2.safeUrl(c.source_url);
               return '<div class="v2n-cross-item">'
                    + '<div class="v2n-cross-item__src">来源：' + esc(c.source_name) + '</div>'
                    + '<div class="v2n-cross-item__stmt">表述：' + esc(c.statement) + '</div>'
                    + (u ? '<a class="v2n-cross-item__link" href="' + esc(u) + '" target="_blank" rel="noopener noreferrer">查看 →</a>' : '')
                    + '</div>';
             }).join('')
           + '</div>'
           + '<div class="v2n-cross-official">官方确认：' + (item.official_source ? esc(item.official_source) : '暂未发现') + '</div>'
           + '</div>';
      }

      /* ⑧ 真实性提醒 */
      h += '<div class="v2n-block"><div class="v2n-block__eyebrow">NOTICE · 真实性提醒</div>'
         + '<div class="v2n-notice-box">'
         + '<svg class="v2n-notice-box__icon" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><path d="' + v2.NEWS_ICON[st] + '"/></svg>'
         + '<span>' + esc(v2.NEWS_NOTICE[st]) + '</span>'
         + '</div></div>';

      /* ⑨ 原始来源 */
      var url = v2.safeUrl(v2.originalSourceUrl(item));
      h += '<div class="v2n-block"><div class="v2n-block__eyebrow">ORIGINAL SOURCE · 原始来源</div>'
         + '<div class="v2n-original-source">';
      if (url) {
        var preview = url.replace(/^https?:\/\//, '');
        h += '<div class="v2n-original-source__url">' + esc(preview) + '</div>'
           + '<a class="v2n-original-source__cta" href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">查看原始来源'
           + '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg></a>';
      } else {
        h += '<div class="v2n-original-source__url">暂无原始来源链接</div>';
      }
      h += '</div></div>';

      /* ⑩ 更正 / 状态变化提示（仅有 status_history 时展示，轻量，不做时间轴） */
      var sh = item.status_history || [];
      var rc = item.report_corrections || [];
      if (sh.length || rc.length) {
        var last = sh.length ? sh[sh.length - 1] : null;
        h += '<div class="v2n-block"><div class="v2n-block__eyebrow">CHANGE LOG · 更正与状态变化</div>'
           + '<div class="v2n-correction-notice">'
           + '<div class="v2n-correction-notice__title">来源更正</div>';
        if (st === 'corrected') h += '<div class="v2n-correction-notice__line">该报道已被来源更正，当前内容以更正后为准</div>';
        else if (rc.length) h += '<div class="v2n-correction-notice__line">该报道已被来源更正；事件级状态按当前仍有效的证据重新判定</div>';
        if (rc.length && rc[0].original_statement) {
          h += '<div class="v2n-correction-notice__line">更正方向：原表述为「' + esc(rc[0].original_statement) + '」，更正后为「' + esc(rc[0].corrected_statement) + '」</div>';
        }
        if (last && last.at) h += '<div class="v2n-correction-notice__line">时间：' + esc(v2.newsDate({ publish_time: last.at })) + '</div>';
        if (last && v2.safeUrl(last.evidence_url)) {
          h += '<a class="v2n-correction-notice__link" href="' + esc(v2.safeUrl(last.evidence_url)) + '" target="_blank" rel="noopener noreferrer">查看更正声明 →</a>';
        }
        h += '</div>';
        /* 链式引用（R8.5，轻量文字链接） */
        var byId = {};
        (global.MCU_NEWS || []).forEach(function (n) { byId[n.id] = n; });
        if (item.supersedes_id && byId[item.supersedes_id]) {
          h += '<div class="v2n-chain"><span>本文为更正后版本</span><a href="news-detail.html?id=' + esc(item.supersedes_id) + '">查看原始版本 →</a></div>';
        }
        if (item.superseded_by_id && byId[item.superseded_by_id]) {
          h += '<div class="v2n-chain"><span>本文已被更正</span><a href="news-detail.html?id=' + esc(item.superseded_by_id) + '">查看更正后版本 →</a></div>';
        }
        h += '</div>';
      }
      return h;
    }
  };

  /* 挂到 MCU 命名空间，保持与 data/progress/rec/ui 同级 */
  MCU.v2 = v2;
  global.MCU_V2 = v2;   /* 便捷别名 */
})(window);
