/* ============================================================
 * 作品索引 library（Tab3）· V2.0.0 降级为「作品索引」
 * ------------------------------------------------------------
 * V2.0 变更（降级）：
 *   - 删除类型筛选（TYPE_FILTERS 已删除）
 *   - 删除阶段筛选（PHASE_FILTERS 已删除）
 *   - 删除多排序（仅保留上映顺序）
 *   - 保留：名称搜索、已看/未看状态筛选、结果统计
 *
 * 定位：结构化索引 / 工具列表
 * 不是：作品资料库、影视资讯流
 * ============================================================ */

const mcuData = require('../../models/mcuData.js');
const userState = require('../../models/userState.js');
const { PHASE_LABEL } = require('../../data/constants.js');

/* V2.0 仅保留状态筛选 */
const STATUS_FILTERS = [
  { key: 'all', label: '全部' },
  { key: 'watched', label: '已看' },
  { key: 'unwatched', label: '未看' }
];

Page({
  data: {
    keyword: '',
    statusFilters: STATUS_FILTERS,
    statusKey: 'all',
    list: [],
    resultCount: 0,
    totalCount: 0,
    watchedCount: 0,
    favCount: 0,
    hasResult: false,
    isFiltering: false
  },

  onLoad() {
    this.setData({ totalCount: mcuData.all.length });
  },

  onShow() { this.applyFilters(); },

  /* ---- 输入 ---- */
  onInput(e) {
    this.setData({ keyword: e.detail.value || '' }, () => { this.applyFilters(); });
  },
  onClearKeyword() {
    this.setData({ keyword: '' }, () => { this.applyFilters(); });
  },

  /* ---- 筛选交互 ---- */
  onPickStatus(e) {
    this.setData({ statusKey: e.currentTarget.dataset.key }, () => { this.applyFilters(); });
  },
  onReset() {
    this.setData({ keyword: '', statusKey: 'all' }, () => { this.applyFilters(); });
  },

  /* ---- 过滤 + 视图模型装配（仅上映顺序） ---- */
  applyFilters() {
    const kw = (this.data.keyword || '').trim().toLowerCase();
    const statusKey = this.data.statusKey;

    /* V2.0 固定使用上映顺序 */
    const base = mcuData.byRelease;
    const favMap = userState.getState().favorite || {};

    const list = base.filter(function (c) {
      if (kw) {
        const cn = (c.cn || '').toLowerCase();
        const en = (c.en || '').toLowerCase();
        if (cn.indexOf(kw) < 0 && en.indexOf(kw) < 0) return false;
      }
      const seen = userState.isSeen(c.id);
      if (statusKey === 'watched' && !seen) return false;
      if (statusKey === 'unwatched' && seen) return false;
      return true;
    }).map(function (c) {
      const v = mcuData.visual(c.id);
      return {
        id: c.id,
        cn: c.cn,
        en: c.en || '',
        letter: (c.cn || '').charAt(0),
        poster: (v && v.poster) ? v.poster : '',
        phase: c.phase || 1,
        typeLabel: mcuData.typeLabel[c.type] || '作品',
        typeKey: c.type,
        phaseText: PHASE_LABEL[c.phase] || ('第' + (c.phase || 1) + '阶段'),
        year: c.year ? String(c.year) : '',
        order: '上映 #' + c.ro,
        watched: userState.isSeen(c.id),
        favored: !!favMap[c.id]
      };
    });

    this.setData({
      list: list,
      resultCount: list.length,
      watchedCount: userState.count(),
      favCount: userState.favIds().length,
      hasResult: list.length > 0,
      isFiltering: !!(kw || statusKey !== 'all')
    });
  },

  /* ---- 跳转：作品节点页 ---- */
  goDetail(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    tt.navigateTo({ url: '/pages/movie/movie?id=' + id });
  }
});
