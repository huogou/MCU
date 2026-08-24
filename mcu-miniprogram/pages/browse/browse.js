// 浏览全部 browse - Step3-7-C 恢复
const mcuData = require('../../models/mcuData.js');
const userState = require('../../models/userState.js');

Page({
  data: { groups: [] },

  onLoad: function () { this.build(); },
  onShow: function () { this.build(); },

  build: function () {
    const all = mcuData.all.slice().sort(function (a, b) {
      return (a.ro - b.ro) || (a.co - b.co);
    });
    const map = {};
    all.forEach(function (m) {
      const p = m.phase || 0;
      (map[p] = map[p] || []).push({
        id: m.id, cn: m.cn, en: m.en, phase: m.phase,
        phaseColor: mcuData.phaseColor(m.phase),
        status: userState.watchState(m.id)
      });
    });
    const groups = Object.keys(map).map(function (p) {
      return {
        phase: +p,
        title: '第' + p + '阶段',
        color: mcuData.phaseColor(+p),
        items: map[p]
      };
    }).sort(function (a, b) { return a.phase - b.phase; });
    this.setData({ groups: groups });
  },

  goMovie: function (e) {
    wx.navigateTo({ url: '/pages/movie/movie?id=' + e.currentTarget.dataset.id });
  }
});
