/* ============================================================
 * 观看路线 journey（Tab2）· V2.0.0 新增
 * ------------------------------------------------------------
 * 定位：观看路线工具页。帮用户快速确定观看路线。
 * 两条路线：① 上映顺序（全部 59 部含短片）② 主线必看（core 22 部含短片）
 * 每步仅展示：顺序号、作品名、类型、我的状态
 * 不做影视内容页，无剧情介绍、无资讯、无角色内容。
 * ============================================================ */

const mcuData = require('../../models/mcuData.js');
const userState = require('../../models/userState.js');
const { PHASE_LABEL } = require('../../data/constants.js');

/* 路线定义（产品方案确定：两条路线都包含短片） */
const ROUTES = [
  { key: 'release', label: '上映顺序' },
  { key: 'mainline', label: '主线必看' }
];

Page({
  data: {
    routeKey: 'release',
    routes: ROUTES,
    list: [],
    progressCount: 0,
    progressTotal: 0,
    progressPercent: 0,
    allDone: false
  },

  onShow() { this.refresh(); },

  /* ---- 路线切换 ---- */
  onPickRoute(e) {
    const key = e.currentTarget.dataset.key;
    if (key === this.data.routeKey) return;
    this.setData({ routeKey: key }, () => { this.refresh(); });
  },

  /* ---- 数据装配 ---- */
  refresh() {
    const key = this.data.routeKey;
    const base = key === 'mainline'
      ? mcuData.byRelease.filter(c => c.importance === 'core')
      : mcuData.byRelease.slice();

    const list = base.map((c, i) => {
      const v = mcuData.visual(c.id) || {};
      const watched = userState.isSeen(c.id);
      return {
        id: c.id,
        order: String(i + 1).padStart(2, '0'),
        cn: c.cn,
        typeLabel: mcuData.typeLabel[c.type] || '作品',
        typeKey: c.type,
        phaseText: PHASE_LABEL[c.phase] || '',
        year: c.year ? String(c.year) : '',
        watched: watched,
        poster: v.poster || ''
      };
    });

    const watchedCount = list.filter(x => x.watched).length;
    const total = list.length;
    const percent = total > 0 ? Math.min(100, Math.round(watchedCount / total * 100)) : 0;

    this.setData({
      list: list,
      progressCount: watchedCount,
      progressTotal: total,
      progressPercent: percent,
      allDone: watchedCount === total && total > 0
    });
  },

  /* ---- 点击列表项 → 作品节点页 ---- */
  goDetail(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    tt.navigateTo({ url: '/pages/movie/movie?id=' + id });
  }
});
