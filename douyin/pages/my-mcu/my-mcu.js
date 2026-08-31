// 我的MCU my-mcu（Tab4） - D12-A Step3-7-B 恢复 + V1.1 Step3 我的MCU 2.0 + Step5 成就墙
// 依据：D10 Token 体系（深色背景 / 金色强调 / 卡片结构 / 进度展示）+ V1.1 设计定稿
// 数据：mcuData.all（CONTENT 单一可信源）+ userState（游客免登录，禁账号体系）+ routes（当前路线）
// 禁第二套数据、禁手写观看记录、禁新增账号体系。
// 状态联动：onShow 刷新 → movie 页标记观看 / 路线进度变化 自动同步到此页。
// V1.1 Step3（我的 MCU 2.0）：
//   ① 顶部进度区统一 X/59（与首页一致）  ② 分享入口（Step4 已接入 share 页）
//   ③ 当前路线区增强（名称 + 当前阶段 Phase N + 当前进度）  ④ 「最近观看」区块（最近 3 部）
//   ⑤ 观看记录列表（时间倒序）
// V1.1 Step5（成就墙）：
//   ⑥ 「我的成就」区块（achievements 模型：已获得金徽章 / 未获得灰徽章 + 进度 x/6）
//   成就入口卡被成就墙替代（Step3 占位卡移除）
// 数据来源：current_route → saved_routes[].routeId → ROUTES（与首页旅程卡同口径）

const mcuData = require('../../models/mcuData.js');
const userState = require('../../models/userState.js');
const achievements = require('../../models/achievements.js');

const TYPE_LABEL = mcuData.typeLabel;

/* 最近观看最多展示数量（V1.1 Step3） */
const RECENT_MAX = 3;

function cnPhase(n) {
  return ['一', '二', '三', '四', '五', '六'][n - 1] || String(n);
}

function subOf(m) {
  if (!m) return 'MCU 作品';
  var s = '';
  if (m.phase) s += '第' + m.phase + '阶段';
  if (m.saga === 'infinity') s += '·无限传奇';
  else if (m.saga === 'multiverse') s += '·多元宇宙传奇';
  return s || 'MCU 作品';
}

/* CONTENT 节点 → 列表卡片描述符（统一用 cn 作为主显示名，与 movie 页一致）
   poster：真实电影海报（mcuData.visual(id).poster，CDN）；缺图空 → 前端阶段色+首字兜底 */
function toCard(m) {
  if (!m) return null;
  const v = mcuData.visual(m.id);
  return {
    id: m.id,
    cn: m.cn,
    letter: (m.cn || '').charAt(0),
    poster: (v && v.poster) ? v.poster : '',
    en: m.en || '',
    phase: m.phase || 1,
    type: m.type,
    typeLabel: TYPE_LABEL[m.type] || '作品',
    phaseText: '第' + cnPhase(m.phase || 1) + '阶段'
  };
}

Page({
  data: {
    explored: 0,
    total: 0,
    percent: 0,
    current: null,         // 当前路线卡 { routeId,name,tagline,watched,total,percent,nextId,nextName,nextSub,phaseText }
    journey: null,         // 旅程摘要（V1.1 Step3）{ routeName, phaseText, progressText }
    recentList: [],        // 最近观看（V1.1 Step3）最近 3 部
    entrances: [           // 分享入口（Step4 已接入 share 页；成就入口被成就墙替代）
      { key: 'share', title: '分享我的 MCU 进度', desc: '生成观影报告海报', primary: true }
    ],
    achievements: [],      // 成就墙（V1.1 Step5）[{id,name,desc,icon,group,gained}]
    achProgress: { count: 0, total: 6 },
    watchedList: [],
    watchedCount: 0,
    favList: [],
    favCount: 0,
    hasFav: false
  },

  onShow: function () { this.refresh(); },

  refresh: function () {
    var state = userState.getState();
    var explored = userState.count();
    var total = mcuData.all.length;
    var percent = total ? Math.round(explored / total * 100) : 0;

    /* 已看列表：按观看时间倒序（watched[id] = 时间戳） */
    var watchedMap = state.watched || {};
    var seenIds = Object.keys(watchedMap).sort(function (a, b) { return watchedMap[b] - watchedMap[a]; });
    var watchedList = [];
    seenIds.forEach(function (id) {
      var m = mcuData.get(id);
      if (m) watchedList.push(toCard(m));
    });

    /* 最近观看：最近 3 部（V1.1 Step3） */
    var recentList = [];
    seenIds.slice(0, RECENT_MAX).forEach(function (id) {
      var m = mcuData.get(id);
      if (!m) return;
      var v = mcuData.visual(id);
      recentList.push({ id: m.id, cn: m.cn, letter: (m.cn || '').charAt(0), poster: (v && v.poster) ? v.poster : '', phase: m.phase || 1 });
    });

    /* 收藏列表 */
    var favMap = state.favorite || {};
    var favList = [];
    Object.keys(favMap).forEach(function (id) {
      var m = mcuData.get(id);
      if (m) favList.push(toCard(m));
    });

    var current = this.buildCurrent();
    this.setData({
      explored: explored,
      total: total,
      percent: percent,
      current: current,
      journey: this.buildJourney(current),
      recentList: recentList,
      achievements: achievements.all(),
      achProgress: achievements.progress(),
      watchedList: watchedList,
      watchedCount: watchedList.length,
      favList: favList,
      favCount: favList.length,
      hasFav: favList.length > 0
    });
  },

  /* 旅程摘要（V1.1 Step3）：路线名 + 当前阶段（watched 最新上映 phase）+ 当前进度 */
  buildJourney: function (current) {
    var latest = userState.latest();
    var phaseNo = latest ? (latest.phase || 1) : 1;
    return {
      routeName: (current && current.name) || '新手入坑',
      phaseText: 'Phase ' + phaseNo,
      progressText: userState.count() + ' / ' + mcuData.all.length
    };
  },

  /* 当前路线卡：优先 userState 保存的当前路线，否则默认 newcomer（与 routes 页同口径） */
  buildCurrent: function () {
    var curSavedId = userState.getCurrentRoute();
    var routeId = 'newcomer';
    if (curSavedId) {
      var sr = userState.getSavedRoute(curSavedId);
      if (sr && sr.routeId) routeId = sr.routeId;
    }
    var route = mcuData.routeById(routeId) || mcuData.routeById('newcomer');
    if (!route) return null;
    var items = mcuData.expandRoute(route);
    var total = items.length;
    var watched = 0;
    var nextIdx = -1;
    var nextMovie = null;
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (!it) continue;
      if (userState.isSeen(it.id)) watched++;
      else if (nextIdx < 0) { nextIdx = i; nextMovie = it; }
    }
    var pct = total ? Math.round(watched / total * 100) : 0;
    var latest = userState.latest();
    return {
      routeId: route.id,
      name: route.name,
      tagline: route.tagline || '',
      watched: watched,
      total: total,
      percent: pct,
      phaseText: 'Phase ' + (latest ? (latest.phase || 1) : 1),
      nextId: nextMovie ? nextMovie.id : '',
      nextName: nextMovie ? nextMovie.cn : '已看完',
      nextSub: nextMovie ? subOf(nextMovie) : '这条路线已全部看完'
    };
  },

  goRoute: function () {
    var id = (this.data.current && this.data.current.routeId) || 'newcomer';
    tt.navigateTo({ url: '/pages/route-detail/route-detail?id=' + id });
  },

  goMovie: function (e) {
    var id = e.currentTarget.dataset.id;
    if (!id) return;
    tt.navigateTo({ url: '/pages/movie/movie?id=' + id });
  },

  /* 分享入口 → share 页（Step4）；成就墙见下方 onTapAch（Step5） */
  goEntry: function (e) {
    var key = e.currentTarget.dataset.key;
    if (key === 'share') {
      tt.navigateTo({ url: '/pages/share/share?type=progress' });
    }
  },

  /* 成就墙点击（V1.1 Step5）：已获得 → 展示成就名；未获得 → 提示解锁条件 */
  onTapAch: function (e) {
    var id = e.currentTarget.dataset.id;
    var gained = e.currentTarget.dataset.gained;
    if (gained) {
      var a = this.data.achievements.find(function (x) { return x.id === id; });
      if (a) tt.showToast({ title: a.name, icon: 'none' });
    } else {
      tt.showToast({ title: achievements.pendingDesc(id) || '继续观影解锁', icon: 'none' });
    }
  },

  /* 反馈入口（Step3-8）：从个人页跳转，携带来源页 my-mcu 供来源统计 */
  goFeedback: function () {
    tt.navigateTo({ url: '/pages/feedback/feedback?from=my-mcu' });
  },

  /* 法律与说明入口（V1.2 上线准备）：跳转协议 / 隐私 / 关于页 */
  goLegal: function (e) {
    var key = e.currentTarget.dataset.key;
    var map = {
      agreement: '/pages/agreement/agreement',
      privacy: '/pages/privacy/privacy',
      about: '/pages/about/about'
    };
    if (map[key]) tt.navigateTo({ url: map[key] });
  }
});
