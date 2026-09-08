// 我的MCU my-mcu（Tab3） - D12-A Step3-7-B 恢复 + V1.1 Step3/Step5 + 2026-09-08 整改第二阶段
// 依据：D10 Token 体系（深色背景 / 金色强调 / 卡片结构 / 进度展示）+ V1.1 设计定稿
// 数据：mcuData.all（CONTENT 单一可信源）+ userState（游客免登录，禁账号体系）
// 禁第二套数据、禁手写观看记录、禁新增账号体系。
// 状态联动：onShow 刷新 → movie 详情页标记观看/收藏后，返回本页自动同步。
//
// 2026-09-08 抖音审核整改第二阶段（本轮变更）：
//   ① 三个列表（已看 / 未看 / 收藏）全部可点击 → 进入作品详情，不再是死列表
//   ② 新增「未看」列表（此前缺失，审核要求补充）
//   ③ 收藏列表项支持就地「取消收藏」（此前 userState.toggleFav 有实现但无入口）
//   ④ 顶部统计卡点击切换列表，替代原先互不联通的两段静态列表
//   ⑤ 「我的片单进度」卡可点击进入下一部未看作品的详情
// 说明：以上均为既有能力的补齐，未恢复任何已被删除的页面。

const mcuData = require('../../models/mcuData.js');
const userState = require('../../models/userState.js');
const achievements = require('../../models/achievements.js');
const { PHASE_LABEL } = require('../../data/constants.js');

const RECENT_MAX = 3;

/* 列表切换维度（唯一定义，页面不写死到 WXML） */
const TABS = [
  { key: 'all', label: '全部' },
  { key: 'watched', label: '已看' },
  { key: 'unwatched', label: '未看' },
  { key: 'fav', label: '收藏' }
];

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

/* CONTENT → 列表项视图模型
   poster：mcuData.visual(id).poster；缺失为空 → 前端阶段色 + 首字兜底 */
function toItem(m, watchedAt, favored) {
  const v = mcuData.visual(m.id);
  return {
    id: m.id,
    cn: m.cn,
    letter: (m.cn || '').charAt(0),
    poster: (v && v.poster) ? v.poster : '',
    en: m.en || '',
    phase: m.phase || 1,
    type: m.type,
    typeLabel: mcuData.typeLabel[m.type] || '作品',
    phaseText: PHASE_LABEL[m.phase] || ('第' + cnPhase(m.phase || 1) + '阶段'),
    order: '上映 #' + m.ro,
    watched: !!watchedAt,
    favored: !!favored
  };
}

Page({
  data: {
    explored: 0,
    total: 0,
    percent: 0,
    unwatchedCount: 0,
    favCount: 0,
    current: null,
    journey: null,
    recentList: [],
    entrances: [
      { key: 'share', title: '分享我的 MCU 进度', desc: '生成观影报告海报', primary: true }
    ],
    achievements: [],
    achProgress: { count: 0, total: 6 },
    tabs: TABS,
    listKey: 'all',
    list: [],
    listEmptyText: '',
    nextId: ''
  },

  onShow: function () { this.refresh(); },

  refresh: function () {
    const state = userState.getState();
    const watchedMap = state.watched || {};
    const favMap = state.favorite || {};
    const total = mcuData.all.length;
    const explored = userState.count();
    const percent = total ? Math.round(explored / total * 100) : 0;

    /* 已看：按观看时间倒序 */
    const seenIds = Object.keys(watchedMap).sort(function (a, b) { return watchedMap[b] - watchedMap[a]; });

    /* 最近观看：最近 3 部 */
    const recentList = [];
    seenIds.slice(0, RECENT_MAX).forEach(function (id) {
      const m = mcuData.get(id);
      if (!m) return;
      const v = mcuData.visual(id);
      recentList.push({
        id: m.id, cn: m.cn, letter: (m.cn || '').charAt(0),
        poster: (v && v.poster) ? v.poster : '', phase: m.phase || 1
      });
    });

    const current = this.buildCurrent();

    this.setData({
      explored: explored,
      total: total,
      percent: percent,
      unwatchedCount: total - explored,
      favCount: Object.keys(favMap).length,
      current: current,
      journey: this.buildJourney(current),
      recentList: recentList,
      achievements: achievements.all(),
      achProgress: achievements.progress(),
      nextId: (current && current.nextId) || ''
    });

    this.buildList();
  },

  /* ---- 列表装配：全部 / 已看 / 未看 / 收藏 ---- */
  buildList: function () {
    const key = this.data.listKey;
    const state = userState.getState();
    const watchedMap = state.watched || {};
    const favMap = state.favorite || {};
    let list = [];

    if (key === 'watched') {
      /* 已看：按观看时间倒序 */
      Object.keys(watchedMap).sort(function (a, b) { return watchedMap[b] - watchedMap[a]; })
        .forEach(function (id) {
          const m = mcuData.get(id);
          if (m) list.push(toItem(m, watchedMap[id], favMap[id]));
        });
    } else if (key === 'unwatched') {
      /* 未看：按上映顺序（可直接作为「接下来看什么」的清单） */
      mcuData.byRelease.forEach(function (m) {
        if (!watchedMap[m.id]) list.push(toItem(m, null, favMap[m.id]));
      });
    } else if (key === 'fav') {
      /* 收藏：按收藏时间倒序 */
      Object.keys(favMap).sort(function (a, b) { return favMap[b] - favMap[a]; })
        .forEach(function (id) {
          const m = mcuData.get(id);
          if (m) list.push(toItem(m, watchedMap[id], favMap[id]));
        });
    } else {
      /* 全部：按上映顺序 */
      mcuData.byRelease.forEach(function (m) {
        list.push(toItem(m, watchedMap[m.id], favMap[m.id]));
      });
    }

    const EMPTY_TEXT = {
      all: '作品库还没有内容',
      watched: '还没有观看记录，去「作品」页挑一部标记已看',
      unwatched: '已经全部看完了，当前进度 100%',
      fav: '还没有收藏作品，在作品详情页点「收藏」试试'
    };

    this.setData({ list: list, listEmptyText: EMPTY_TEXT[key] || '' });
  },

  /* 切换列表维度 */
  onPickTab: function (e) {
    this.setData({ listKey: e.currentTarget.dataset.key }, function () { this.buildList(); });
  },

  /* 旅程摘要 */
  buildJourney: function (current) {
    const latest = userState.latest();
    const phaseNo = latest ? (latest.phase || 1) : 1;
    return {
      routeName: (current && current.name) || '新手入坑',
      phaseText: 'Phase ' + phaseNo,
      progressText: userState.count() + ' / ' + mcuData.all.length
    };
  },

  /* 我的片单进度：优先 userState 保存的当前片单，否则默认 newcomer */
  buildCurrent: function () {
    const curSavedId = userState.getCurrentRoute();
    let routeId = 'newcomer';
    if (curSavedId) {
      const sr = userState.getSavedRoute(curSavedId);
      if (sr && sr.routeId) routeId = sr.routeId;
    }
    const route = mcuData.routeById(routeId) || mcuData.routeById('newcomer');
    if (!route) return null;
    const items = mcuData.expandRoute(route);
    const total = items.length;
    let watched = 0, nextIdx = -1, nextMovie = null;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it) continue;
      if (userState.isSeen(it.id)) watched++;
      else if (nextIdx < 0) { nextIdx = i; nextMovie = it; }
    }
    const latest = userState.latest();
    return {
      routeId: route.id,
      name: route.name,
      tagline: route.tagline || '',
      watched: watched,
      total: total,
      percent: total ? Math.round(watched / total * 100) : 0,
      phaseText: 'Phase ' + (latest ? (latest.phase || 1) : 1),
      nextId: nextMovie ? nextMovie.id : '',
      nextName: nextMovie ? nextMovie.cn : '已看完',
      nextSub: nextMovie ? subOf(nextMovie) : '这份片单已全部看完'
    };
  },

  /* ---- 跳转：作品详情（列表项点击，本轮核心补齐） ---- */
  goDetail: function (e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    tt.navigateTo({ url: '/pages/movie/movie?id=' + id });
  },

  /* 片单进度卡 → 下一部未看作品详情 */
  goNext: function () {
    const id = this.data.nextId;
    if (!id) { tt.showToast({ title: '这份片单已全部看完', icon: 'none' }); return; }
    tt.navigateTo({ url: '/pages/movie/movie?id=' + id });
  },

  /* 列表项内联「收藏/取消收藏」
   * catchtap 阻止冒泡，避免触发整行的 goDetail。 */
  onToggleFavItem: function (e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    const fav = userState.toggleFav(id);
    tt.showToast({ title: fav ? '已加入收藏' : '已取消收藏', icon: 'none' });
    this.refresh();
  },

  /* 分享入口 → share 页 */
  goEntry: function (e) {
    if (e.currentTarget.dataset.key === 'share') {
      tt.navigateTo({ url: '/pages/share/share?type=progress' });
    }
  },

  /* 成就墙点击 */
  onTapAch: function (e) {
    const id = e.currentTarget.dataset.id;
    const gained = e.currentTarget.dataset.gained;
    if (gained) {
      const a = this.data.achievements.find(function (x) { return x.id === id; });
      if (a) tt.showToast({ title: a.name, icon: 'none' });
    } else {
      tt.showToast({ title: achievements.pendingDesc(id) || '继续观影解锁', icon: 'none' });
    }
  },

  goFeedback: function () {
    tt.navigateTo({ url: '/pages/feedback/feedback?from=my-mcu' });
  },

  goLegal: function (e) {
    const key = e.currentTarget.dataset.key;
    const map = {
      agreement: '/pages/agreement/agreement',
      privacy: '/pages/privacy/privacy',
      about: '/pages/about/about'
    };
    if (map[key]) tt.navigateTo({ url: map[key] });
  }
});
