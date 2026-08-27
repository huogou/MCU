// 宇宙全景图 panorama（V1.2 纵向 Phase 时间轴） - V3 真机适配专项
// 数据纪律：PANO_MOVIES / mcuData / visuals / userState 全部零改动，仅在本页派生视图。
const PANO_MOVIES = require('../../models/pano.js').PANO_MOVIES;
const mcuData = require('../../models/mcuData.js');
const visuals = require('../../data/visuals.js');
const userState = require('../../models/userState.js');

/* 阶段元信息（标题 + 年份区间），与 pano.js PHASE_COLS 同源，仅用于纵向展示 */
const PHASE_META = [
  { phase: 1, title: '第一阶段', years: '2008 – 2012' },
  { phase: 2, title: '第二阶段', years: '2013 – 2015' },
  { phase: 3, title: '第三阶段', years: '2016 – 2019' },
  { phase: 4, title: '第四阶段', years: '2021 – 2022' },
  { phase: 5, title: '第五阶段', years: '2023 – 2025' },
  { phase: 6, title: '第六阶段', years: '2025 –' }
];

/* 节点所属阶段：待映固定归 6；其余取内容真实 phase 字段 */
function phaseOfNode(n) {
  if (n.upcoming) return 6;
  const c = mcuData.get(n.id);
  return (c && c.phase) ? c.phase : 0;
}

Page({
  data: {
    phaseGroups: [],
    upcoming: [],
    _posterErr: {}
  },

  onLoad: function () {
    const groupsMap = {};
    const order = [];
    const upcoming = [];

    // PANO_MOVIES 已按上映序排列，单次遍历即可保持阶段内上映序
    PANO_MOVIES.forEach(function (n) {
      const ph = phaseOfNode(n);
      const c = mcuData.get(n.id);
      const title = n.upcoming ? n.title : (c ? c.cn : n.id);
      const en = c ? c.en : '';
      const year = n.year || (c && c.date ? c.date.slice(0, 4) : '');
      const item = {
        id: n.id,
        cn: title,
        en: en,
        year: year,
        phase: ph,
        poster: visuals.visual(n.id).poster,
        mainline: c ? !!c.mainline : false,
        starter: c ? !!c.starter : false,
        seen: userState.isSeen(n.id),
        firstChar: (title || '?')[0],
        upcoming: !!n.upcoming,
        phaseColor: mcuData.phaseColor(ph)
      };
      if (n.upcoming) { upcoming.push(item); return; }
      if (!groupsMap[ph]) { groupsMap[ph] = []; order.push(ph); }
      groupsMap[ph].push(item);
    });

    const groups = order.map(function (ph) {
      const meta = PHASE_META.filter(function (m) { return m.phase === ph; })[0];
      const items = groupsMap[ph];
      const watched = items.filter(function (m) { return m.seen; }).length;
      return {
        phase: ph,
        title: meta ? meta.title : ('第' + ph + '阶段'),
        years: meta ? meta.years : '',
        color: mcuData.phaseColor(ph),
        count: items.length,
        watched: watched,
        movies: items
      };
    });

    this.setData({ phaseGroups: groups, upcoming: upcoming });
  },

  /* 海报加载失败 → 标记该 id 走首字兜底（不重复 setData） */
  onPosterError: function (e) {
    const id = e.currentTarget.dataset.id;
    const err = this.data._posterErr;
    if (err[id]) return;
    err[id] = true;
    this.setData({ _posterErr: err });
  },

  goMovie: function (e) {
    const id = e.currentTarget.dataset.id;
    const node = PANO_MOVIES.filter(function (n) { return n.id === id; })[0];
    if (node && node.upcoming) return; // 待映卡片不跳转
    wx.navigateTo({ url: '/pages/movie/movie?id=' + id });
  }
});
