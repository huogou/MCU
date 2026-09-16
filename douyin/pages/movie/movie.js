/* ============================================================
 * 作品节点页 movie · V2.0.0 降级为「作品节点」
 * ------------------------------------------------------------
 * V2.0 变更（降级）：
 *   - 删除作品简介 synopsis（禁止剧情介绍）
 *   - 删除相关作品 why 描述（仅保留作品名+类型）
 *   - 删除 backdrop 大图
 *   - 删除所属篇章、故事时间、篇幅
 *   - 海报缩小为识别用（非影视宣传）
 *   - 核心视觉改为「观看状态 + 顺序位置」
 *   - 新增 H5 引导
 *
 * 定位：观看路线中的作品节点
 * 允许：中文名、英文名、单张海报、类型、阶段、上映日期、上映顺序、
 *       当前观看状态、记录时间、相关作品 ≤4
 * ============================================================ */

const mcuData = require('../../models/mcuData.js');
const userState = require('../../models/userState.js');
const { PHASE_LABEL } = require('../../data/constants.js');

const REL_MAX = 4;

Page({
  data: {
    id: '',
    cn: '',
    en: '',
    letter: '',
    poster: '',
    phase: 1,
    typeLabel: '',
    typeKey: '',
    phaseText: '',
    orderText: '',
    year: '',
    infoRows: [],
    watched: false,
    favored: false,
    watchedLabel: '标记为已看',
    favorLabel: '收藏这部作品',
    relations: [],
    relCount: 0,
    hasRelations: false,
    notFound: false,
    seenAtText: ''
  },

  onLoad(options) {
    const id = (options && options.id) || '';
    if (!id) { this.setData({ notFound: true }); return; }
    this.setData({ id: id });
    this.refresh();
  },

  onShow() {
    if (this.data.id) this.refresh();
  },

  refresh() {
    const c = mcuData.get(this.data.id);
    if (!c) { this.setData({ notFound: true }); return; }

    const v = mcuData.visual(c.id) || {};
    const state = userState.getState();
    const watchedAt = (state.watched || {})[c.id];

    /* ── 基础信息表（V2.0 精简：删除篇章/故事时间/篇幅） ── */
    const rows = [
      { k: '内容类型', v: mcuData.typeLabel[c.type] || '作品' },
      { k: '上映日期', v: c.date || (c.year ? String(c.year) : '—') }
    ];
    if (c.phase) rows.push({ k: 'MCU 阶段', v: PHASE_LABEL[c.phase] || ('第' + c.phase + '阶段') });
    rows.push({ k: '上映顺序', v: '第 ' + c.ro + ' 部' });

    /* ── 相关作品（V2.0 删除 why 描述，仅保留作品名+类型） ── */
    const relRaw = mcuData.relationsOf(c.id) || [];
    const relations = relRaw.slice(0, REL_MAX).map(function (r) {
      const other = mcuData.get(r.other);
      const t = (mcuData.types && mcuData.types[r.type]) || {};
      return {
        id: r.other,
        cn: other ? other.cn : r.other,
        phase: other ? (other.phase || 1) : 1,
        typeLabel: t.label || '关联',
        typeKey: other ? other.type : '',
        watched: userState.isSeen(r.other)
      };
    });

    const watched = !!watchedAt;
    const favored = !!((state.favorite || {})[c.id]);

    this.setData({
      notFound: false,
      cn: c.cn,
      en: c.en || '',
      letter: (c.cn || '').charAt(0),
      poster: v.poster || '',
      phase: c.phase || 1,
      typeLabel: mcuData.typeLabel[c.type] || '',
      typeKey: c.type,
      phaseText: PHASE_LABEL[c.phase] || '',
      orderText: '第 ' + c.ro + ' 部',
      year: c.year ? String(c.year) : '',
      infoRows: rows,
      watched: watched,
      favored: favored,
      watchedLabel: watched ? '取消已看' : '标记为已看',
      favorLabel: favored ? '取消收藏' : '收藏这部作品',
      relations: relations,
      relCount: relRaw.length,
      hasRelations: relations.length > 0,
      seenAtText: watchedAt ? ('记录于 ' + this.fmtDate(watchedAt)) : ''
    });

    tt.setNavigationBarTitle({ title: c.cn || '作品节点' });
  },

  fmtDate(ts) {
    const d = new Date(ts);
    const p = function (n) { return n < 10 ? '0' + n : String(n); };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  },

  /* ---- 标记已看 ---- */
  onToggleWatched() {
    const id = this.data.id;
    if (!id) return;
    const seen = userState.toggle(id);
    tt.showToast({ title: seen ? '已标记为已看' : '已取消已看', icon: 'none' });
    this.refresh();
  },

  /* ---- 收藏 ---- */
  onToggleFav() {
    const id = this.data.id;
    if (!id) return;
    const fav = userState.toggleFav(id);
    tt.showToast({ title: fav ? '已加入收藏' : '已取消收藏', icon: 'none' });
    this.refresh();
  },

  /* ---- 相关作品 → 跳转 ---- */
  goRelated(e) {
    const id = e.currentTarget.dataset.id;
    if (!id || id === this.data.id) return;
    tt.redirectTo({ url: '/pages/movie/movie?id=' + id });
  },

  /* ---- 异常兜底 ---- */
  goLibrary() {
    tt.switchTab({ url: '/pages/library/library' });
  }
});
