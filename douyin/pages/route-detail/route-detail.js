// 路线详情 route-detail（子页） - D12-A Step3-7-A 恢复
// 依据：D10-A 冻结稿 Token 体系 + routes 页 / movie 页视觉语言（原型无独立整页设计）
// 数据：routes.js（单一可信源，11 条）+ CONTENT（expandRoute）+ userState（状态 / 当前路线）
// 禁第二套数据、禁改 routes.js 内容、禁改路线顺序。

const mcuData = require('../../models/mcuData.js');
const userState = require('../../models/userState.js');

const STATUS = {
  unwatched: { text: '未观看', cls: 'unwatched' },
  watching:  { text: '正在观看', cls: 'watching' },
  watched:   { text: '已观看', cls: 'watched' }
};

function statusOf(id) {
  return STATUS[userState.watchState(id)] || STATUS.unwatched;
}

function typeLabelOf(t) {
  if (t === 'movie') return '电影';
  if (t === 'series') return '剧集';
  if (t === 'special') return '特别呈现';
  if (t === 'short') return '短片';
  return 'MCU 作品';
}

Page({
  data: {
    notFound: false,
    routeId: '',
    name: '',
    tagline: '',
    desc: '',
    kind: '',
    total: 0,
    watched: 0,
    percent: 0,
    isCurrent: false,
    currentNo: 0,
    currentText: '',
    nextId: '',
    nextName: '',
    nextPhase: '',
    hasNext: false,
    nodes: []
  },

  onLoad: function (opt) {
    this.setData({ routeId: (opt && opt.id) || '' });
    this.refresh();
  },
  onShow: function () { this.refresh(); },

  refresh: function () {
    var id = this.data.routeId;
    var route = id ? mcuData.routeById(id) : null;
    if (!route) { this.setData({ notFound: true }); return; }

    // 导航栏标题随路线名更新
    if (tt && tt.setNavigationBarTitle) tt.setNavigationBarTitle({ title: route.name });

    var items = mcuData.expandRoute(route);
    var total = items.length;
    var watched = 0;
    var firstUnwatched = -1;
    var nodes = [];

    for (var i = 0; i < items.length; i++) {
      var m = items[i];
      if (!m) continue;
      var st = statusOf(m.id);
      if (userState.isSeen(m.id)) watched++;
      else if (firstUnwatched < 0) firstUnwatched = i;

      var pc = mcuData.phaseColor(m.phase);
      nodes.push({
        no: i + 1,
        id: m.id,
        cn: m.title,
        en: m.en || '',
        phase: m.phase ? ('第 ' + m.phase + ' 阶段') : '',
        phaseColor: pc,
        typeLabel: typeLabelOf(m.type),
        statusCls: st.cls,
        statusText: st.text,
        isCurrent: false
      });
    }

    // 当前路线判定（用户保存的 current_route 指向本路线才显著高亮）
    var curId = '';
    var savedId = userState.getCurrentRoute();
    if (savedId) {
      var sr = userState.getSavedRoute(savedId);
      if (sr && sr.routeId) curId = sr.routeId;
    }
    var isCurrent = (curId === id);

    // 当前观看节点 = 第一个未看（1-based）；全部看完则为 total
    var currentNo = (firstUnwatched >= 0) ? (firstUnwatched + 1) : total;
    if (currentNo > 0 && currentNo <= nodes.length) {
      nodes[currentNo - 1].isCurrent = true;
    }
    var currentText = currentNo > 0 ? ('当前看到 · 第 ' + currentNo + ' / ' + total + ' 部') : '';

    // 下一部（第一个未看）
    var nextNode = (firstUnwatched >= 0) ? nodes[firstUnwatched] : null;
    var nextId = nextNode ? nextNode.id : '';
    var nextName = nextNode ? nextNode.cn : (total ? '已看完' : '暂无内容');
    var nextPhase = nextNode ? nextNode.phase : '这条路线已全部看完';
    var hasNext = !!nextNode;

    var percent = total ? Math.round((watched / total) * 100) : 0;

    this.setData({
      notFound: false,
      name: route.name,
      tagline: route.tagline || '',
      desc: route.desc || route.why || '',
      kind: route.kind || '',
      total: total,
      watched: watched,
      percent: percent,
      isCurrent: isCurrent,
      currentNo: currentNo,
      currentText: isCurrent ? currentText : '',
      nextId: nextId,
      nextName: nextName,
      nextPhase: nextPhase,
      hasNext: hasNext,
      nodes: nodes
    });
  },

  goMovie: function (e) {
    var id = e.currentTarget.dataset.id;
    if (id) tt.navigateTo({ url: '/pages/movie/movie?id=' + id });
  },
  goNext: function () {
    if (this.data.nextId) tt.navigateTo({ url: '/pages/movie/movie?id=' + this.data.nextId });
  }
});
