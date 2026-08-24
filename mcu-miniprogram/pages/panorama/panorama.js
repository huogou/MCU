// 宇宙全景图 panorama（子页，由 explore 进入） - Step3-7-C 恢复
const { PANO_MOVIES, PANO_CONN, PHASE_COLS, LAYOUT } = require('../../models/pano.js');
const mcuData = require('../../models/mcuData.js');

const SCALE = 0.6;     // 设计坐标 → 显示像素（1:1.67 缩放，适配移动端横滚）
const CARD_W = 96;     // 节点卡宽（px）
const CARD_H = 144;    // 节点卡高（px）

function topOf(cls) {
  if (cls.indexOf('support-above') >= 0) return LAYOUT.supportAboveTop;
  if (cls.indexOf('support-below') >= 0) return LAYOUT.supportBelowTop;
  return LAYOUT.mainlineTop;
}

Page({
  data: {
    mapW: Math.round(LAYOUT.canvasW * SCALE),
    mapH: Math.round(LAYOUT.canvasH * SCALE),
    canvasW: Math.round(LAYOUT.canvasW * SCALE),
    canvasH: Math.round(LAYOUT.canvasH * SCALE),
    cardW: CARD_W,
    cardH: CARD_H,
    nodes: [],
    phases: []
  },

  onLoad: function () {
    const byId = {};
    PANO_MOVIES.forEach(function (n) { byId[n.id] = n; });
    const nodes = PANO_MOVIES.map(function (n) {
      const c = mcuData.get(n.id);
      const isMain = n.cls.indexOf('mainline') >= 0;
      const phase = c ? c.phase : (n.upcoming ? 6 : 0);
      const title = n.upcoming ? n.title : (c ? c.cn : n.id);
      return {
        id: n.id,
        left: Math.round(n.left * SCALE),
        top: Math.round(topOf(n.cls) * SCALE),
        cls: n.cls,
        main: isMain,
        upcoming: !!n.upcoming,
        title: title,
        letter: (title || '?')[0],
        phaseColor: mcuData.phaseColor(phase)
      };
    });
    const phases = PHASE_COLS.map(function (p) {
      return { phase: p.phase, left: Math.round(p.left * SCALE), title: p.title, years: p.years };
    });
    this._byId = byId;
    this.setData({ nodes: nodes, phases: phases });
  },

  onReady: function () {
    this.drawLines();
  },

  drawLines: function () {
    const self = this;
    const q = wx.createSelectorQuery();
    q.select('#panoCanvas').fields({ node: true, size: true }).exec(function (res) {
      if (!res || !res[0] || !res[0].node) return;
      const canvas = res[0].node;
      const ctx = canvas.getContext('2d');
      const info = (wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync());
      const dpr = info.pixelRatio || 2;
      const W = self.data.canvasW, H = self.data.canvasH;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, W, H);

      // 主线金色轨道（视觉基准线）
      const gt = Math.round(LAYOUT.mainlineTop * SCALE);
      ctx.strokeStyle = 'rgba(233,169,59,0.16)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, gt);
      ctx.lineTo(W, gt);
      ctx.stroke();

      // 连线路（mainline 金 / support 蓝 / cross 紫）
      PANO_CONN.forEach(function (edge) {
        const a = self._byId[edge[0]], b = self._byId[edge[1]];
        if (!a || !b) return;
        const type = edge[2];
        let color = 'rgba(122,130,150,0.35)';
        if (type === 'mainline') color = 'rgba(233,169,59,0.7)';
        else if (type === 'support') color = 'rgba(91,141,239,0.45)';
        else if (type === 'cross') color = 'rgba(139,111,232,0.45)';
        ctx.strokeStyle = color;
        ctx.lineWidth = type === 'mainline' ? 2.6 : 1.4;
        ctx.beginPath();
        ctx.moveTo(a.left * SCALE + CARD_W / 2, topOf(a.cls) * SCALE + CARD_H / 2);
        ctx.lineTo(b.left * SCALE + CARD_W / 2, topOf(b.cls) * SCALE + CARD_H / 2);
        ctx.stroke();
      });
    });
  },

  goMovie: function (e) {
    const id = e.currentTarget.dataset.id;
    if (this._byId[id] && this._byId[id].upcoming) return; // 待映卡片不跳转
    wx.navigateTo({ url: '/pages/movie/movie?id=' + id });
  }
});
