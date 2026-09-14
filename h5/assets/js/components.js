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
    }
  };

  /* 挂到 MCU 命名空间，保持与 data/progress/rec/ui 同级 */
  MCU.v2 = v2;
  global.MCU_V2 = v2;   /* 便捷别名 */
})(window);
