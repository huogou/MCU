/* ============================================================
 * 作品详情 movie · 2026-09-08 抖音审核整改第二阶段重建（轻量版）
 * ------------------------------------------------------------
 * 定位：作品信息查询工具页。用户动作闭环只有四个：
 *       查询 → 查看基础信息 → 标记已看 → 收藏
 * 与旧版区别（旧版为影视内容型详情页，已按审核要求永久删除）：
 *   - 不展示：娱乐资讯 / 新闻 / 热点 / 影评 / 演员资料 / 推荐文章
 *   - 不展示：role 剧情作用解读类编辑文本（风险字段，本页主动规避）
 *   - 保留：海报、名称、类型、上映时间、阶段、个人观看状态、收藏
 *   - 保留：必要的基础作品关系（≤4 条，用户第三条第 2 项明确允许）
 * 数据纪律：
 *   - 内容来自 mcuData.get(id)（CONTENT 单一可信源），不新增不虚构
 *   - 观看/收藏唯一来源 userState（storage key mcu_nav_user_v1）
 *     与首页 / 作品查询 / 我的MCU 三处共用同一份状态，禁止第二套
 *   - 图片只经 mcuData.visual(id) 转发，禁硬编码 URL
 * ============================================================ */

const mcuData = require('../../models/mcuData.js');
const userState = require('../../models/userState.js');
const { PHASE_LABEL } = require('../../data/constants.js');

/* 传奇标签映射 */
const SAGA_LABEL = { infinity: '无限传奇', multiverse: '多元宇宙传奇' };

/* 相关作品展示上限（保持「基础」关系，不做关系图谱） */
const REL_MAX = 4;

/* 类型 → 上映动词（院线 vs 上线） */
const RELEASE_VERB = { movie: '上映日期', series: '上线日期', special: '上线日期', short: '发布年份' };

Page({
  data: {
    id: '',
    cn: '',
    en: '',
    letter: '',
    poster: '',
    backdrop: '',
    phase: 1,
    typeLabel: '',
    phaseText: '',
    infoRows: [],
    synopsis: '',
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

  onLoad: function (options) {
    const id = (options && options.id) || '';
    if (!id) { this.setData({ notFound: true }); return; }
    this.setData({ id: id });
    this.refresh();
  },

  /* 从「相关作品」进入下一部后返回本页时，状态保持最新 */
  onShow: function () {
    if (this.data.id) this.refresh();
  },

  refresh: function () {
    const c = mcuData.get(this.data.id);
    if (!c) { this.setData({ notFound: true }); return; }

    const v = mcuData.visual(c.id) || {};
    const state = userState.getState();
    const watchedAt = (state.watched || {})[c.id];

    /* ── 基础信息表（工具型字段，逐行装配） ── */
    const rows = [
      { k: '内容类型', v: mcuData.typeLabel[c.type] || '作品' },
      { k: RELEASE_VERB[c.type] || '上映日期', v: c.date || (c.year ? String(c.year) : '—') }
    ];
    if (c.phase) rows.push({ k: 'MCU 阶段', v: PHASE_LABEL[c.phase] || ('第' + c.phase + '阶段') });
    if (c.saga && SAGA_LABEL[c.saga]) rows.push({ k: '所属篇章', v: SAGA_LABEL[c.saga] });
    if (c.episodes) rows.push({ k: '篇幅', v: c.episodes });
    rows.push({ k: '上映顺序', v: '第 ' + c.ro + ' 部' });
    if (c.coLabel) rows.push({ k: '故事时间', v: c.coLabel });

    /* ── 基础作品关系（≤4 条，按强度降序） ── */
    const relRaw = mcuData.relationsOf(c.id) || [];
    const relations = relRaw.slice(0, REL_MAX).map(function (r) {
      const other = mcuData.get(r.other);
      const t = (mcuData.types && mcuData.types[r.type]) || {};
      return {
        id: r.other,
        cn: other ? other.cn : r.other,
        phase: other ? (other.phase || 1) : 1,
        typeLabel: t.label || '关联',
        why: r.why || '',
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
      backdrop: v.backdrop || '',
      phase: c.phase || 1,
      typeLabel: mcuData.typeLabel[c.type] || '',
      phaseText: PHASE_LABEL[c.phase] || '',
      infoRows: rows,
      synopsis: c.sf || '',
      watched: watched,
      favored: favored,
      watchedLabel: watched ? '取消已看' : '标记为已看',
      favorLabel: favored ? '取消收藏' : '收藏这部作品',
      relations: relations,
      relCount: relRaw.length,
      hasRelations: relations.length > 0,
      seenAtText: watchedAt ? ('记录于 ' + this.fmtDate(watchedAt)) : ''
    });

    tt.setNavigationBarTitle({ title: c.cn || '作品详情' });
  },

  fmtDate: function (ts) {
    const d = new Date(ts);
    const p = function (n) { return n < 10 ? '0' + n : String(n); };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  },

  /* ---- 动作 1：标记已看 / 取消已看（唯一状态源 userState.toggle） ---- */
  onToggleWatched: function () {
    const id = this.data.id;
    if (!id) return;
    const seen = userState.toggle(id);
    tt.showToast({ title: seen ? '已标记为已看' : '已取消已看', icon: 'none' });
    this.refresh();
  },

  /* ---- 动作 2：收藏 / 取消收藏（此前模型已有 toggleFav，但缺真实入口，本轮补齐） ---- */
  onToggleFav: function () {
    const id = this.data.id;
    if (!id) return;
    const fav = userState.toggleFav(id);
    tt.showToast({ title: fav ? '已加入收藏' : '已取消收藏', icon: 'none' });
    this.refresh();
  },

  /* ---- 相关作品 → 跳转详情 ----
   * 用 redirectTo 而非 navigateTo：观影关系可无限串联，重定向保证页面栈
   * 深度恒定（不超过 10 层），且返回必回「作品查询」列表。 */
  goRelated: function (e) {
    const id = e.currentTarget.dataset.id;
    if (!id || id === this.data.id) return;
    tt.redirectTo({ url: '/pages/movie/movie?id=' + id });
  },

  /* ---- 异常兜底：无 id / id 不存在 → 回作品查询列表 ---- */
  goLibrary: function () {
    tt.switchTab({ url: '/pages/library/library' });
  }
});
