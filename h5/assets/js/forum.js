/* ============================================================
 * MCU 观影导航 H5 · V3.0 论坛逻辑层（forum.js）
 * ------------------------------------------------------------
 * 设计基准：AI生成文件/设计/H5-V3.0/forum-design-spec.md（36 画框）
 * 身份纪律：复用后端 token（/api/me/register），不建第二套身份系统；
 *           UI 层只展示昵称/头像，不暴露 uid 等技术标识。
 * 数据纪律：全部内容经 /api/ 动态获取；不内置任何 Mock 帖子。
 * 状态纪律：先审后发——发帖/回复提交后均为 pending，必须明确提示。
 * 页面分发：body[data-page] = community | topic-detail | post-create | my-community
 * ============================================================ */
(function () {
  'use strict';

  var MCU = window.MCU;
  var V2 = MCU.v2;
  var esc = MCU.ui.esc;

  /* ================= 身份层 ================= */
  var TK = 'mcu_forum_token';
  var DV = 'mcu_forum_device_id';
  var PF = 'mcu_forum_profile'; // 本地缓存 {uid,nickname,avatar}

  function uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }
  function deviceId() {
    var d = null;
    try { d = localStorage.getItem(DV); } catch (e) {}
    if (!d) { d = uuid(); try { localStorage.setItem(DV, d); } catch (e) {} }
    return d;
  }
  function getToken() { try { return localStorage.getItem(TK); } catch (e) { return null; } }
  function setToken(t) { try { localStorage.setItem(TK, t); } catch (e) {} }
  function clearToken() { try { localStorage.removeItem(TK); localStorage.removeItem(PF); } catch (e) {} }

  function cacheProfile(p) { try { localStorage.setItem(PF, JSON.stringify(p)); } catch (e) {} }
  function localProfile() { try { return JSON.parse(localStorage.getItem(PF) || 'null'); } catch (e) { return null; } }

  var _registering = null;
  function register() {
    if (_registering) return _registering;
    _registering = fetch('/api/me/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId: deviceId() })
    }).then(function (r) { return r.json(); }).then(function (j) {
      if (!j.token) throw new Error('register_failed');
      setToken(j.token);
      if (j.profile) cacheProfile({ uid: j.uid, nickname: j.profile.nickname, avatar: j.profile.avatar });
      _registering = null;
      return j;
    }).catch(function (e) { _registering = null; throw e; });
    return _registering;
  }

  function ensureToken() {
    if (getToken()) return Promise.resolve();
    return register();
  }

  /* 统一 API 调用：401 自动重注册并重试一次；X-Renewed-Token 自动续签 */
  function api(method, path, body, _retried) {
    return ensureToken().then(function () {
      var headers = { 'Authorization': 'Bearer ' + getToken() };
      var opt = { method: method, headers: headers };
      if (body !== undefined) { headers['Content-Type'] = 'application/json'; opt.body = JSON.stringify(body); }
      return fetch(path, opt).then(function (r) {
        var renew = r.headers.get('X-Renewed-Token');
        if (renew) setToken(renew);
        return r.json().catch(function () { return {}; }).then(function (j) {
          if (r.ok) return j;
          var err = new Error((j.error && j.error.message) || '请求失败');
          err.status = r.status;
          err.code = j.error && j.error.code;
          /* token 失效 → 清除并重注册重试一次（幂等 GET/写均可重试一次） */
          if (r.status === 401 && !_retried && err.code !== 'ADMIN_UNAUTHORIZED') {
            clearToken();
            return api(method, path, body, true);
          }
          throw err;
        });
      });
    });
  }

  /* 服务端权威资料（优先于本地缓存） */
  function serverProfile() {
    return api('GET', '/api/me').then(function (j) {
      var p = { uid: j.uid, nickname: j.profile.nickname, avatar: j.profile.avatar };
      cacheProfile(p);
      return p;
    });
  }

  /* ================= UI 帮助层 ================= */
  var CATS = [
    { key: 'movie',    label: '电影' },
    { key: 'series',   label: '剧集' },
    { key: 'char',     label: '角色' },
    { key: 'timeline', label: '时间线' },
    { key: 'new',      label: '新作' },
    { key: 'general',  label: '闲聊' }
  ];
  function catLabel(k) { for (var i = 0; i < CATS.length; i++) if (CATS[i].key === k) return CATS[i].label; return '闲聊'; }

  var ICON = {
    heart: 'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z',
    reply: 'M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z',
    flag:  'M14.4 6L14 4H5v17h2v-7h5.6l.4 2h7V6z',
    back:  'M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z',
    chat:  'M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z',
    user:  'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z',
    info:  'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z'
  };
  function svg(p) { return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + p + '"/></svg>'; }

  /* 预设头像：a01~a12 → 12 色 CSS 生成式（无图片资源）；异常值哈希兜底 */
  function avatarHtml(avatar, name, size) {
    var idx = 0;
    if (avatar && /^a\d{2}$/.test(avatar)) {
      idx = (parseInt(avatar.slice(1), 10) - 1) % 12;
    } else {
      var s = String(name || '');
      for (var i = 0; i < s.length; i++) idx = (idx + s.charCodeAt(i)) % 12;
    }
    var ch = (String(name || '影').trim()[0] || '影').toUpperCase();
    return '<span class="v3f-av v3f-av--c' + idx + '" style="width:' + size + 'px;height:' + size + 'px;font-size:' + Math.round(size * .42) + 'px">' + esc(ch) + '</span>';
  }

  function timeAgo(iso) {
    if (!iso) return '';
    var t = new Date(iso).getTime();
    if (!t) return '';
    var diff = Date.now() - t;
    if (diff < 60e3) return '刚刚';
    if (diff < 3600e3) return Math.floor(diff / 60e3) + ' 分钟前';
    if (diff < 86400e3) return Math.floor(diff / 3600e3) + ' 小时前';
    if (diff < 7 * 86400e3) return Math.floor(diff / 86400e3) + ' 天前';
    var d = new Date(iso);
    return (d.getMonth() + 1) + '月' + d.getDate() + '日';
  }

  function statusBadge(st) {
    var map = { pending: '审核中', approved: '已公开', rejected: '未通过', hidden: '已隐藏' };
    if (!map[st]) return '';
    return '<span class="v3f-st v3f-st--' + st + '">' + map[st] + '</span>';
  }

  function emptyState(icon, title, desc, ctaText, ctaFn) {
    var el = document.createElement('div');
    el.className = 'v3f-empty';
    el.innerHTML = '<div class="v3f-empty-ico">' + svg(icon) + '</div>'
      + '<div class="v3f-empty-title">' + esc(title) + '</div>'
      + '<div class="v3f-empty-desc">' + esc(desc) + '</div>'
      + (ctaText ? '<button class="v3f-empty-cta">' + esc(ctaText) + '</button>' : '');
    if (ctaText && ctaFn) el.querySelector('.v3f-empty-cta').onclick = ctaFn;
    return el;
  }

  function errorState(msg, retry) {
    var el = document.createElement('div');
    el.className = 'v3f-error';
    el.textContent = msg || '加载失败，请稍后重试';
    if (retry) {
      var b = document.createElement('button');
      b.className = 'v3f-empty-cta'; b.textContent = '重试';
      b.onclick = retry;
      el.appendChild(document.createElement('br'));
      el.appendChild(b);
    }
    return el;
  }

  /* ---------- BottomSheet 通用（回复 / 举报 / 身份设置） ---------- */
  function openSheet(title, buildContent) {
    closeSheet();
    var mask = document.createElement('div');
    mask.className = 'v3f-mask';
    var sheet = document.createElement('div');
    sheet.className = 'v3f-sheet';
    sheet.innerHTML = '<div class="v3f-handle"></div><div class="v3f-sheet-title">' + esc(title) + '</div><div class="v3f-sheet-body"></div>';
    document.body.appendChild(mask);
    document.body.appendChild(sheet);
    requestAnimationFrame(function () { mask.classList.add('show'); sheet.classList.add('show'); });
    mask.onclick = closeSheet;
    buildContent(sheet.querySelector('.v3f-sheet-body'), closeSheet);
    return { mask: mask, sheet: sheet };
  }
  function closeSheet() {
    var m = document.querySelector('.v3f-mask'), s = document.querySelector('.v3f-sheet');
    if (m) m.remove();
    if (s) s.remove();
  }

  /* ---------- 身份设置（无昵称时的前置引导；预设头像 12 选 1） ---------- */
  function openProfileSheet(onDone) {
    openSheet('设置你的社区身份', function (body, close) {
      var picked = 'a01';
      body.innerHTML =
        '<label class="v3f-label">昵称（1-16 字，仅用于社区展示）</label>' +
        '<input class="v3f-input" id="v3f-nick" maxlength="16" placeholder="给自己起个名字">' +
        '<label class="v3f-label">选一个预设头像</label>' +
        '<div class="v3f-av-grid" id="v3f-avgrid"></div>' +
        '<div class="v3f-count">不采集手机号、微信、邮箱等任何真实信息</div>' +
        '<button class="v3f-btn-primary" id="v3f-save">保存并继续</button>';
      var grid = body.querySelector('#v3f-avgrid');
      var letters = '甲乙丙丁戊己庚辛壬癸子丑';
      for (var i = 1; i <= 12; i++) {
        (function (i) {
          var key = 'a' + (i < 10 ? '0' + i : '' + i);
          var it = document.createElement('div');
          it.className = 'v3f-av-item v3f-av v3f-av--c' + (i - 1) + (key === picked ? ' on' : '');
          it.style.width = '100%'; it.style.fontSize = '16px';
          it.textContent = letters[i - 1];
          it.onclick = function () {
            picked = key;
            grid.querySelectorAll('.v3f-av-item').forEach(function (x) { x.classList.remove('on'); });
            it.classList.add('on');
          };
          grid.appendChild(it);
        })(i);
      }
      body.querySelector('#v3f-save').onclick = function () {
        var nick = body.querySelector('#v3f-nick').value.trim();
        if (!nick) { V2.toast('先给自己起个名字'); return; }
        var btn = body.querySelector('#v3f-save');
        btn.disabled = true; btn.textContent = '保存中...';
        api('POST', '/api/me/profile', { nickname: nick, avatar: picked }).then(function (j) {
          cacheProfile({ uid: localProfile() && localProfile().uid, nickname: j.profile.nickname, avatar: j.profile.avatar });
          V2.toast('身份已保存');
          close();
          if (onDone) onDone();
        }).catch(function (e) {
          btn.disabled = false; btn.textContent = '保存并继续';
          V2.toast(e.message || '保存失败');
        });
      };
    });
  }
  /* 确保已有昵称（发帖/回复前置）；返回 Promise<true|false> */
  function ensureProfile() {
    return serverProfile().then(function (p) {
      if (p.nickname) return true;
      return new Promise(function (resolve) {
        openProfileSheet(function () { resolve(true); });
        /* 用户关闭弹窗未设置 → false */
        var iv = setInterval(function () {
          if (!document.querySelector('.v3f-sheet')) { clearInterval(iv); resolve(!!(localProfile() && localProfile().nickname)); }
        }, 300);
      });
    }).catch(function () { return false; });
  }

  /* ================= 页面：社区首页 ================= */
  function initCommunity() {
    var root = document.getElementById('v3f-list');
    var state = { sort: 'latest', cat: '', page: 1, loading: false, done: false };

    function skeleton() {
      root.innerHTML = '<div class="v3f-skel"></div><div class="v3f-skel"></div><div class="v3f-skel"></div>';
    }
    function card(t) {
      var d = document.createElement('div');
      d.className = 'v3f-card';
      var thumb = t.cover || t.thumb ? '<div class="v3f-card-thumb" style="background-image:url(\'' + esc(t.cover || t.thumb) + '\')"></div>' : '';
      d.innerHTML =
        '<div class="v3f-card-main">' +
        '<div class="v3f-card-text">' +
        '<div class="v3f-card-top"><span class="v3f-badge v3f-badge--' + esc(t.category) + '">' + esc(catLabel(t.category)) + '</span></div>' +
        '<div class="v3f-card-title">' + esc(t.title) + '</div>' +
        (t.excerpt ? '<div class="v3f-card-excerpt">' + esc(t.excerpt) + '</div>' : '') +
        '</div>' + thumb + '</div>' +
        '<div class="v3f-card-meta">' + avatarHtml(t.author.avatar, t.author.name, 18) +
        '<span>' + esc(t.author.name) + '</span><span>·</span><span>' + esc(timeAgo(t.createdAt)) + '</span>' +
        '<span class="num' + (t.liked ? ' liked' : '') + '" style="margin-left:auto">' + svg(ICON.heart) + t.likeCount + '</span>' +
        '<span class="num">' + svg(ICON.chat) + t.replyCount + '</span></div>';
      d.onclick = function () { location.href = 'topic-detail.html?id=' + encodeURIComponent(t.id); };
      return d;
    }
    function load() {
      if (state.loading) return;
      state.loading = true;
      var q = '?sort=' + state.sort + '&page=' + state.page + '&size=10' + (state.cat ? '&category=' + state.cat : '');
      api('GET', '/api/topics' + q).then(function (j) {
        state.loading = false;
        if (state.page === 1) root.innerHTML = '';
        var items = j.items || [];
        if (!items.length && state.page === 1) {
          root.appendChild(emptyState(ICON.chat, '这里还很安静', '来聊聊你最近看的 MCU 作品？第一个发言的人就是你。', '发布话题', function () { location.href = 'post-create.html'; }));
          return;
        }
        if (!items.length) { state.done = true; return; }
        items.forEach(function (t) { root.appendChild(card(t)); });
      }).catch(function (e) {
        state.loading = false;
        if (state.page === 1) { root.innerHTML = ''; root.appendChild(errorState('社区加载失败', load)); }
      });
    }
    function reload() { state.page = 1; state.done = false; skeleton(); load(); }

    /* 排序 Tab */
    document.querySelectorAll('.v3f-tab').forEach(function (tab) {
      tab.onclick = function () {
        document.querySelectorAll('.v3f-tab').forEach(function (x) { x.classList.remove('on'); });
        tab.classList.add('on');
        state.sort = tab.getAttribute('data-sort');
        reload();
      };
    });
    /* 分类 chips */
    var cats = document.getElementById('v3f-cats');
    if (cats) {
      cats.querySelectorAll('.v3f-cat').forEach(function (c) {
        c.onclick = function () {
          cats.querySelectorAll('.v3f-cat').forEach(function (x) { x.classList.remove('on'); });
          c.classList.add('on');
          state.cat = c.getAttribute('data-cat') || '';
          reload();
        };
      });
    }
    /* FAB */
    var fab = document.getElementById('v3f-fab');
    if (fab) fab.onclick = function () { location.href = 'post-create.html'; };

    skeleton();
    load();
  }

  /* ================= 页面：话题详情 ================= */
  function initTopicDetail() {
    var id = MCU.ui.param('id');
    var root = document.getElementById('v3f-root');
    var topic = null;

    function statePage(title, desc, ctaText, ctaHref, icon) {
      root.innerHTML = '';
      root.appendChild(emptyState(icon || ICON.info, title, desc, ctaText || '返回社区', function () { location.href = 'community.html'; }));
    }
    function load() {
      root.innerHTML = '<div class="v3f-skel" style="height:180px"></div><div class="v3f-skel"></div>';
      api('GET', '/api/topics/' + encodeURIComponent(id)).then(function (t) {
        topic = t;
        render();
        return api('GET', '/api/topics/' + encodeURIComponent(id) + '/replies?page=1&size=50');
      }).then(function (j) { if (j) renderReplies(j.items || []); })
        .catch(function (e) {
          if (e.status === 410) statePage('此话题已被删除', '内容已不存在，去看看大家在聊什么吧。', '返回社区', null, ICON.info);
          else if (e.status === 404) statePage('内容不存在', '它可能还在审核中，或已被删除。', '返回社区', null, ICON.info);
          else { root.innerHTML = ''; root.appendChild(errorState('加载失败', load)); }
        });
    }
    function render() {
      var dim = topic.status === 'rejected' || topic.status === 'hidden' ? ' v3f-dim' : '';
      var flag = '';
      if (topic.status === 'pending') flag = '<div class="v3f-flag">' + svg(ICON.info) + '审核中，审核通过后会公开显示</div>';
      if (topic.status === 'rejected') flag = '<div class="v3f-flag" style="background:var(--red-soft);border-color:rgba(232,72,63,.3);color:var(--red)">' + svg(ICON.info) + '内容未通过审核，仅你可见</div>';
      if (topic.status === 'hidden') flag = '<div class="v3f-flag" style="color:var(--text-2);background:rgba(110,120,137,.12);border-color:var(--border)">' + svg(ICON.info) + '此内容已被暂时隐藏，仅你可见</div>';
      root.innerHTML =
        '<div class="v3f-post' + dim + '">' +
        '<div class="v3f-post-head">' + avatarHtml(topic.author.avatar, topic.author.name, 36) +
        '<div class="who"><div class="name">' + esc(topic.author.name) + '</div><div class="time">' + esc(timeAgo(topic.createdAt)) + '</div></div>' +
        '<span class="v3f-badge v3f-badge--' + esc(topic.category) + '">' + esc(catLabel(topic.category)) + '</span></div>' +
        '<div class="v3f-post-title">' + esc(topic.title) + '</div>' +
        '<div class="v3f-post-body">' + esc(topic.body || topic.content || '') + '</div>' +
        '<div class="v3f-post-ops">' +
        '<button class="v3f-op' + (topic.liked ? ' liked' : '') + '" id="v3f-like">' + svg(ICON.heart) + '<span id="v3f-like-n">' + topic.likeCount + '</span></button>' +
        '<button class="v3f-op v3f-op--right" id="v3f-report">' + svg(ICON.flag) + '举报</button>' +
        '</div></div>' + flag +
        '<div class="v3f-replies"><div class="v3f-replies-title">回复 <span id="v3f-rc-n"></span></div><div id="v3f-reply-list"></div></div>' +
        '<div class="v3f-inputbar"><div class="v3f-inputbar-in">' +
        '<input id="v3f-quick" placeholder="说点什么..." readonly>' +
        '<button class="v3f-send" id="v3f-quick-send">发送</button>' +
        '</div></div>' +
        '<div class="v3f-detail-pad"></div>';
      document.getElementById('v3f-like').onclick = toggleLike;
      document.getElementById('v3f-report').onclick = openReport;
      document.getElementById('v3f-quick').onclick = openReplySheet;
      document.getElementById('v3f-quick-send').onclick = openReplySheet;
    }
    function renderReplies(items) {
      var list = document.getElementById('v3f-reply-list');
      var n = document.getElementById('v3f-rc-n');
      if (n) n.textContent = items.length ? '(' + items.length + ')' : '';
      if (!items.length) {
        list.innerHTML = '<div class="v3f-empty" style="padding:26px 0">' +
          '<div class="v3f-empty-title">还没有人回复</div>' +
          '<div class="v3f-empty-desc">来留下第一句话。</div></div>';
        return;
      }
      list.innerHTML = items.map(function (r) {
        return '<div class="v3f-reply">' + avatarHtml(r.author.avatar, r.author.name, 28) +
          '<div class="v3f-reply-main"><div class="v3f-reply-head"><span class="name">' + esc(r.author.name) + '</span>' +
          '<span class="floor">#' + r.floor + '</span><span class="time">' + esc(timeAgo(r.createdAt)) + '</span></div>' +
          '<div class="v3f-reply-body">' + esc(r.content) + '</div>' +
          '<div class="v3f-reply-ops">' +
          '<button class="v3f-op' + (r.liked ? ' liked' : '') + '" data-like="' + esc(r.id) + '">' + svg(ICON.heart) + '<span>' + r.likeCount + '</span></button>' +
          '<button class="v3f-op" data-report="' + esc(r.id) + '">' + svg(ICON.flag) + '举报</button>' +
          '</div></div></div>';
      }).join('');
      list.querySelectorAll('[data-like]').forEach(function (b) {
        b.onclick = function () { likeReply(b.getAttribute('data-like'), b); };
      });
      list.querySelectorAll('[data-report]').forEach(function (b) {
        b.onclick = function () { openReport('reply', b.getAttribute('data-report')); };
      });
    }

    function toggleLike() {
      var btn = document.getElementById('v3f-like');
      var n = document.getElementById('v3f-like-n');
      var wasLiked = btn.classList.contains('liked');
      var oldN = parseInt(n.textContent, 10) || 0;
      /* 乐观更新，失败回退 */
      btn.classList.toggle('liked', !wasLiked);
      n.textContent = wasLiked ? oldN - 1 : oldN + 1;
      api(wasLiked ? 'DELETE' : 'POST', '/api/topics/' + encodeURIComponent(id) + '/like')
        .then(function (j) { n.textContent = j.likeCount; btn.classList.toggle('liked', j.liked); })
        .catch(function (e) {
          btn.classList.toggle('liked', wasLiked);
          n.textContent = oldN;
          V2.toast(e.message || '操作失败');
        });
    }
    function likeReply(replyId, btn) {
      var wasLiked = btn.classList.contains('liked');
      var span = btn.querySelector('span');
      var oldN = parseInt(span.textContent, 10) || 0;
      btn.classList.toggle('liked', !wasLiked);
      span.textContent = wasLiked ? oldN - 1 : oldN + 1;
      api(wasLiked ? 'DELETE' : 'POST', '/api/replies/' + encodeURIComponent(replyId) + '/like')
        .then(function (j) { span.textContent = j.likeCount; btn.classList.toggle('liked', j.liked); })
        .catch(function (e) {
          btn.classList.toggle('liked', wasLiked);
          span.textContent = oldN;
          V2.toast(e.message || '操作失败');
        });
    }

    function openReplySheet() {
      ensureProfile().then(function (ok) {
        if (!ok) return;
        openSheet('回复话题', function (body, close) {
          body.innerHTML =
            '<textarea class="v3f-textarea" id="v3f-reply-ta" maxlength="500" placeholder="写下你的想法（0-500 字）"></textarea>' +
            '<div class="v3f-count" id="v3f-reply-c">0/500</div>' +
            '<button class="v3f-btn-primary" id="v3f-reply-go" disabled>发送</button>';
          var ta = body.querySelector('#v3f-reply-ta');
          var go = body.querySelector('#v3f-reply-go');
          var cnt = body.querySelector('#v3f-reply-c');
          ta.oninput = function () {
            var n = ta.value.length;
            cnt.textContent = n + '/500';
            cnt.classList.toggle('over', n > 500);
            go.disabled = !ta.value.trim() || n > 500;
          };
          go.onclick = function () {
            go.disabled = true; go.textContent = '发送中...';
            api('POST', '/api/topics/' + encodeURIComponent(id) + '/replies', { content: ta.value.trim() })
              .then(function () {
                close();
                V2.toast('回复已提交，审核通过后会显示');
                api('GET', '/api/topics/' + encodeURIComponent(id) + '/replies?page=1&size=50')
                  .then(function (j) { renderReplies(j.items || []); }).catch(function () {});
              })
              .catch(function (e) {
                go.disabled = false; go.textContent = '发送';
                V2.toast(e.message || '回复失败，请重试');
              });
          };
        });
      });
    }

    function openReport(type, targetId) {
      openSheet('举报', function (body, close) {
        var reasons = [
          ['spam', '垃圾广告或营销内容'],
          ['abuse', '辱骂攻击或人身攻击'],
          ['porn', '色情低俗内容'],
          ['illegal', '违法违规内容'],
          ['other', '其他问题']
        ];
        var picked = '';
        body.innerHTML = reasons.map(function (r) {
          return '<button class="v3f-opt" data-r="' + r[0] + '"><span class="dot"></span>' + esc(r[1]) + '</button>';
        }).join('') + '<button class="v3f-btn-primary" id="v3f-report-go" disabled>提交举报</button>';
        body.querySelectorAll('.v3f-opt').forEach(function (o) {
          o.onclick = function () {
            body.querySelectorAll('.v3f-opt').forEach(function (x) { x.classList.remove('on'); });
            o.classList.add('on');
            picked = o.getAttribute('data-r');
            body.querySelector('#v3f-report-go').disabled = false;
          };
        });
        body.querySelector('#v3f-report-go').onclick = function () {
          var go = body.querySelector('#v3f-report-go');
          go.disabled = true; go.textContent = '提交中...';
          var p = type === 'reply'
            ? api('POST', '/api/replies/' + encodeURIComponent(targetId) + '/report', { reason: picked })
            : api('POST', '/api/topics/' + encodeURIComponent(id) + '/report', { reason: picked });
          p.then(function () { close(); V2.toast('举报已提交，感谢反馈'); })
            .catch(function (e) {
              if (e.code === 'ALREADY_REPORTED') { close(); V2.toast('你已举报过此内容'); return; }
              go.disabled = false; go.textContent = '提交举报';
              V2.toast(e.message || '提交失败');
            });
        };
      });
    }

    load();
  }

  /* ================= 页面：发帖 ================= */
  function initPostCreate() {
    var cat = 'movie';
    var root = document.getElementById('v3f-root');

    function renderForm() {
      root.innerHTML =
        '<div class="v3f-topbar"><button class="v3f-back" id="v3f-back">' + svg(ICON.back) + '</button>' +
        '<div><div class="v3f-topbar-title">发布话题</div><div class="v3f-topbar-sub">提交后进入审核，通过后公开显示</div></div></div>' +
        '<label class="v3f-label">分类</label><div class="v3f-cats-pick" id="v3f-pick"></div>' +
        '<label class="v3f-label">标题（2-50 字，必填）</label>' +
        '<input class="v3f-input" id="v3f-title" maxlength="60" placeholder="一句话说清你想聊的">' +
        '<div class="v3f-count" id="v3f-title-c">0/50</div>' +
        '<label class="v3f-label">正文（0-2000 字）</label>' +
        '<textarea class="v3f-textarea" id="v3f-body" maxlength="2100" placeholder="展开聊聊，纯文本即可"></textarea>' +
        '<div class="v3f-count" id="v3f-body-c">0/2000</div>' +
        '<button class="v3f-btn-primary" id="v3f-go" disabled>发布</button>';
      var pick = document.getElementById('v3f-pick');
      CATS.forEach(function (c) {
        var b = document.createElement('button');
        b.className = 'v3f-cat' + (c.key === cat ? ' on' : '');
        b.textContent = c.label;
        b.onclick = function () {
          cat = c.key;
          pick.querySelectorAll('.v3f-cat').forEach(function (x) { x.classList.remove('on'); });
          b.classList.add('on');
        };
        pick.appendChild(b);
      });
      var title = document.getElementById('v3f-title');
      var bod = document.getElementById('v3f-body');
      var tc = document.getElementById('v3f-title-c');
      var bc = document.getElementById('v3f-body-c');
      var go = document.getElementById('v3f-go');
      function check() {
        var tl = Array.from(title.value.trim()).length;
        var bl = bod.value.length;
        tc.textContent = tl + '/50'; tc.classList.toggle('over', tl > 50);
        bc.textContent = bl + '/2000'; bc.classList.toggle('over', bl > 2000);
        go.disabled = tl < 2 || tl > 50 || bl > 2000;
      }
      title.oninput = check; bod.oninput = check;
      document.getElementById('v3f-back').onclick = function () { history.length > 1 ? history.back() : (location.href = 'community.html'); };
      go.onclick = function () {
        go.disabled = true; go.textContent = '发布中...';
        api('POST', '/api/topics', { title: title.value.trim(), content: bod.value.trim(), category: cat })
          .then(function (j) {
            V2.toast('已提交，审核通过后会公开显示');
            setTimeout(function () { location.href = 'topic-detail.html?id=' + encodeURIComponent(j.id); }, 600);
          })
          .catch(function (e) {
            go.disabled = false; go.textContent = '发布';
            if (e.code === 'PROFILE_REQUIRED') { renderProfileGate(); return; }
            V2.toast(e.message || '发布失败，请重试');
          });
      };
    }
    function renderProfileGate() {
      root.innerHTML = '<div class="v3f-empty" style="padding-top:80px">' +
        '<div class="v3f-empty-ico">' + svg(ICON.user) + '</div>' +
        '<div class="v3f-empty-title">先设置你的社区身份</div>' +
        '<div class="v3f-empty-desc">发帖需要一个昵称和头像，不采集任何真实信息。</div>' +
        '<button class="v3f-empty-cta" id="v3f-gate-go">设置身份</button></div>';
      document.getElementById('v3f-gate-go').onclick = function () {
        ensureProfile().then(function (ok) { if (ok) renderForm(); });
      };
    }
    /* 进入页面先查身份：无昵称 → 引导卡片；有 → 表单 */
    ensureProfile().then(function (ok) { ok ? renderForm() : renderProfileGate(); })
      .catch(function () { renderProfileGate(); });
  }

  /* ================= 页面：我的社区 ================= */
  function initMyCommunity() {
    var root = document.getElementById('v3f-root');
    var tab = 'topics';

    function load() {
      root.innerHTML = '<div class="v3f-skel"></div><div class="v3f-skel"></div>';
      api('GET', tab === 'topics' ? '/api/me/topics' : '/api/me/replies').then(function (j) {
        var items = j.items || [];
        root.innerHTML = '';
        if (!items.length) {
          root.appendChild(tab === 'topics'
            ? emptyState(ICON.chat, '还没有发布过话题', '去社区看看大家在聊什么，或者发一个你的话题。', '去社区看看', function () { location.href = 'community.html'; })
            : emptyState(ICON.reply, '还没有回复过', '看到感兴趣的话题，留下你的想法吧。', '去社区看看', function () { location.href = 'community.html'; }));
          return;
        }
        items.forEach(function (it) {
          var d = document.createElement('div');
          d.className = 'v3f-mine';
          if (tab === 'topics') {
            d.innerHTML = '<div class="v3f-mine-head"><span class="v3f-badge v3f-badge--' + esc(it.category) + '">' + esc(catLabel(it.category)) + '</span>' +
              '<span class="st">' + statusBadge(it.status) + '</span></div>' +
              '<div class="v3f-mine-title">' + esc(it.title) + '</div>' +
              (it.excerpt ? '<div class="v3f-mine-body">' + esc(it.excerpt) + '</div>' : '') +
              '<div class="v3f-mine-foot">' + esc(timeAgo(it.createdAt)) + ' · ❤ ' + it.likeCount + ' · 回复 ' + it.replyCount + '</div>';
            d.onclick = function () { location.href = 'topic-detail.html?id=' + encodeURIComponent(it.id); };
          } else {
            d.innerHTML = '<div class="v3f-mine-head"><span style="font-size:12px;color:var(--text-3)">回复 · ' + esc(it.topicTitle || '') + '</span>' +
              '<span class="st">' + statusBadge(it.status) + '</span></div>' +
              '<div class="v3f-mine-body">' + esc(it.content) + '</div>' +
              '<div class="v3f-mine-foot">' + esc(timeAgo(it.createdAt)) + ' · ❤ ' + it.likeCount + '</div>';
            if (it.topicStatus !== 'deleted') {
              d.onclick = function () { location.href = 'topic-detail.html?id=' + encodeURIComponent(it.topicId); };
            }
          }
          root.appendChild(d);
        });
      }).catch(function () {
        root.innerHTML = '';
        root.appendChild(errorState('加载失败', load));
      });
    }

    document.querySelectorAll('.v3f-mtab').forEach(function (t) {
      t.onclick = function () {
        document.querySelectorAll('.v3f-mtab').forEach(function (x) { x.classList.remove('on'); });
        t.classList.add('on');
        tab = t.getAttribute('data-tab');
        load();
      };
    });
    load();
  }

  /* ================= 分发 ================= */
  document.addEventListener('DOMContentLoaded', function () {
    var page = document.body.getAttribute('data-page');
    if (page === 'community') initCommunity();
    else if (page === 'topic-detail') initTopicDetail();
    else if (page === 'post-create') initPostCreate();
    else if (page === 'my-community') initMyCommunity();
  });

  /* 挂到 MCU 命名空间（调试/复用） */
  window.MCU.forum = { api: api, ensureToken: ensureToken, serverProfile: serverProfile };
})();
