/* ============================================================
 * 作品查询 library（Tab2）· 2026-09-08 抖音审核整改第二阶段新增
 * ------------------------------------------------------------
 * 定位：MCU 作品信息查询工具（不是内容浏览、不是资讯流）
 * 能力：关键词搜索 / 类型筛选 / 阶段筛选 / 已看未看筛选 / 排序切换
 *      → 结果列表 → 进入作品详情（工具闭环：查询→查看详情→标记→收藏）
 * 数据纪律：
 *   - 唯一数据源 models/mcuData.js（CONTENT 59 部，导出时已按 ro 上映序排好）
 *   - 观看/收藏态唯一来源 models/userState.js（storage key mcu_nav_user_v1）
 *   - 图片只经 mcuData.visual(id) 转发，页面禁硬编码 URL
 * 合规纪律：本页不出现任何资讯/新闻/热点/推荐文章表述。
 * ============================================================ */

const mcuData = require('../../models/mcuData.js');
const userState = require('../../models/userState.js');
const { PHASE_LABEL } = require('../../data/constants.js');

/* 阶段中文显示（较短，用于 chip） */
const PHASE_SHORT = { 1: 'P1', 2: 'P2', 3: 'P3', 4: 'P4', 5: 'P5', 6: 'P6' };

/* —— 筛选维度唯一定义（页面不写死筛选选项到 WXML） —— */
const TYPE_FILTERS = [
  { key: 'all', label: '全部' },
  { key: 'movie', label: '电影' },
  { key: 'series', label: '剧集' },
  { key: 'special', label: '特别呈现' },
  { key: 'short', label: '短片' }
];
const PHASE_FILTERS = [{ key: 0, label: '全部' }].concat(
  Object.keys(PHASE_LABEL).map(function (n) { return { key: Number(n), label: PHASE_SHORT[n] }; })
);
const STATUS_FILTERS = [
  { key: 'all', label: '全部' },
  { key: 'watched', label: '已看' },
  { key: 'unwatched', label: '未看' }
];
const SORTS = [
  { key: 'release', label: '上映顺序' },
  { key: 'chrono', label: '故事时间线' }
];

Page({
  data: {
    keyword: '',
    typeFilters: TYPE_FILTERS,
    phaseFilters: PHASE_FILTERS,
    statusFilters: STATUS_FILTERS,
    sorts: SORTS,
    typeKey: 'all',
    phaseKey: 0,
    statusKey: 'all',
    sortKey: 'release',
    list: [],
    resultCount: 0,
    totalCount: 0,
    watchedCount: 0,
    favCount: 0,
    hasResult: false,
    /* 筛选是否处于非默认态（用于展示「重置」按钮） */
    isFiltering: false
  },

  onLoad: function () {
    this.setData({ totalCount: mcuData.all.length });
  },

  /* Tab 页从其它 Tab 切回 / 详情页返回都会触发 */
  onShow: function () { this.applyFilters(); },

  /* 下拉/分享等场景：无 */

  /* ---- 输入 ---- */
  onInput: function (e) {
    this.setData({ keyword: e.detail.value || '' }, function () { this.applyFilters(); });
  },
  onClearKeyword: function () {
    this.setData({ keyword: '' }, function () { this.applyFilters(); });
  },

  /* ---- 筛选交互（统一事件委托） ---- */
  onPickType: function (e) {
    this.setData({ typeKey: e.currentTarget.dataset.key }, function () { this.applyFilters(); });
  },
  onPickPhase: function (e) {
    this.setData({ phaseKey: Number(e.currentTarget.dataset.key) || 0 }, function () { this.applyFilters(); });
  },
  onPickStatus: function (e) {
    this.setData({ statusKey: e.currentTarget.dataset.key }, function () { this.applyFilters(); });
  },
  onPickSort: function (e) {
    this.setData({ sortKey: e.currentTarget.dataset.key }, function () { this.applyFilters(); });
  },
  onReset: function () {
    this.setData({
      keyword: '', typeKey: 'all', phaseKey: 0, statusKey: 'all', sortKey: 'release'
    }, function () { this.applyFilters(); });
  },

  /* ---- 核心：过滤 + 排序 + 视图模型装配 ---- */
  applyFilters: function () {
    const kw = (this.data.keyword || '').trim().toLowerCase();
    const typeKey = this.data.typeKey;
    const phaseKey = this.data.phaseKey;
    const statusKey = this.data.statusKey;
    const sortKey = this.data.sortKey;

    /* 排序基准：release=上映序 byRelease；chrono=故事时间线 byChrono */
    const base = (sortKey === 'chrono') ? mcuData.byChrono : mcuData.byRelease;
    const favMap = userState.getState().favorite || {};

    const list = base.filter(function (c) {
      if (typeKey !== 'all' && c.type !== typeKey) return false;
      if (phaseKey && c.phase !== phaseKey) return false;
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
        phaseText: PHASE_LABEL[c.phase] || ('第' + (c.phase || 1) + '阶段'),
        year: c.year ? String(c.year) : '',
        dateText: c.date || '',
        order: sortKey === 'chrono' ? ('时间线 #' + c.co) : ('上映 #' + c.ro),
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
      isFiltering: !!(kw || typeKey !== 'all' || phaseKey || statusKey !== 'all')
    });
  },

  /* ---- 跳转：作品详情（工具闭环核心：列表必须有去处） ---- */
  goDetail: function (e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    tt.navigateTo({ url: '/pages/movie/movie?id=' + id });
  }
});
