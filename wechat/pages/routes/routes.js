// 路线 routes（Tab2） - D12-A Step3-6 恢复
// 依据：D10-A 冻结稿（恢复资料/D10原型/D10-A_观影主线强化原型.html line 1168-1301 / 1792-1872）
// 数据：mcuData.routes（单一可信源，11 条）+ userState（当前路线 / 进度 / 下一部）
// 禁第二套数据、禁改 routes.js 内容。

const mcuData = require('../../models/mcuData.js');
const userState = require('../../models/userState.js');

function subOf(m) {
  // 下一部副标题：阶段 + 传奇线（数据驱动，无硬编码）
  if (!m) return 'MCU 作品';
  var s = '';
  if (m.phase) s += '第' + m.phase + '阶段';
  if (m.saga === 'infinity') s += '·无限传奇';
  else if (m.saga === 'multiverse') s += '·多元宇宙';
  return s || 'MCU 作品';
}

function buildCard(route) {
  var items = mcuData.expandRoute(route);
  var total = items.length;
  var watched = 0;
  items.forEach(function (it) {
    if (it && userState.isSeen(it.id)) watched++;
  });
  var percent = total ? Math.round((watched / total) * 100) : 0;
  return {
    id: route.id,
    name: route.name,
    tagline: route.tagline,
    forWho: route.forWho,
    count: total,
    watched: watched,
    percent: percent
  };
}

Page({
  data: {
    activeTab: 'basic',
    tabs: [
      { key: 'basic', label: '基础路线' },
      { key: 'topic', label: '专题路线' }
    ],
    current: null,   // 当前路线进度卡
    list: [],        // 当前 Tab 下的路线卡
    phases: []       // 专项⑥：Phase 导航序列（阶段图辅助视觉，纯展示）
  },

  onLoad: function () {
    this.phases = [1, 2, 3, 4, 5, 6].map(function (n) {
      return { n: n, img: mcuData.phase(n) || '' };
    });
    this.refresh();
  },
  onShow: function () { this.refresh(); },

  refresh: function () {
    var all = mcuData.routes;

    // 当前路线：优先读 userState 保存的当前路线，否则默认 newcomer
    var curRouteId = 'newcomer';
    var curSavedId = userState.getCurrentRoute();
    if (curSavedId) {
      var sr = userState.getSavedRoute(curSavedId);
      if (sr && sr.routeId) curRouteId = sr.routeId;
    }
    var curRoute = mcuData.routeById(curRouteId) || mcuData.routeById('newcomer');

    // 当前路线进度 + 下一部
    var curItems = mcuData.expandRoute(curRoute);
    var curTotal = curItems.length;
    var curWatched = 0;
    var nextIdx = -1;
    var nextMovie = null;
    for (var i = 0; i < curItems.length; i++) {
      var it = curItems[i];
      if (!it) continue;
      if (userState.isSeen(it.id)) curWatched++;
      else if (nextIdx < 0) { nextIdx = i; nextMovie = it; }
    }
    var curPercent = curTotal ? Math.round((curWatched / curTotal) * 100) : 0;

    var current = null;
    if (curRoute) {
      current = {
        routeId: curRoute.id,
        name: curRoute.name,
        index: nextIdx >= 0 ? nextIdx + 1 : curTotal,
        total: curTotal,
        percent: curPercent,
        nextId: nextMovie ? nextMovie.id : '',
        nextName: nextMovie ? nextMovie.title : (curTotal ? '已看完' : '暂无内容'),
        nextSub: nextMovie ? subOf(nextMovie) : '这条路线已全部看完'
      };
    }

    // 列表：按当前 Tab 过滤，标记当前路线卡
    var self = this;
    var list = all.filter(function (r) { return r.kind === self.data.activeTab; })
      .map(function (r) {
        var c = buildCard(r);
        if (r.id === curRouteId) c.current = true;
        return c;
      });

    this.setData({ current: current, list: list, phases: this.phases || [] });
  },

  switchTab: function (e) {
    var key = e.currentTarget.dataset.key;
    if (key === this.data.activeTab) return;
    this.setData({ activeTab: key });
    this.refresh();
  },

  goDetail: function (e) {
    var id = e.currentTarget.dataset.id;
    if (id) wx.navigateTo({ url: '/pages/route-detail/route-detail?id=' + id });
  },

  goNext: function () {
    var cur = this.data.current;
    if (cur && cur.nextId) wx.navigateTo({ url: '/pages/movie/movie?id=' + cur.nextId });
  }
});
