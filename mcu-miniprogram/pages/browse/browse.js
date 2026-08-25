// 浏览全部 browse · V1.2-DS 视觉校准（左海报 + 右信息）
// 图片走 visuals.js 单一来源：mcuData.visual(id).poster；缺失时前端 poster-pN 兜底
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
        id: m.id,
        cn: m.cn,
        en: m.en,
        phase: m.phase,
        phaseColor: mcuData.phaseColor(m.phase),
        status: userState.watchState(m.id),
        posterUrl: mcuData.visual(m.id).poster,   // 统一视觉层注入
        initial: m.cn[0]
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
