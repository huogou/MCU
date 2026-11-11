/* ============================================================
 * 复联5补课路线专题（V1.3.0 新增独立页）
 * ------------------------------------------------------------
 * 依据：h5/special.html + h5/data/special-routes.js（信息架构与内容口径）
 * 纪律：
 *  - 作品名 / 类型 / 阶段 / 海报全部经 models/mcuData 运行时解析，不复制作品数据
 *  - 已看状态复用 models/userState（mcu_nav_user_v1），与 movie 页双向同步，零新增 key
 *  - 折叠 / 勾选 / 徽章用 WXML 条件渲染 + setData，不用 DOM / innerHTML / details
 *  - 洛基 S1/S2 共用 workId：列表 wx:key 用前缀序号（c0.. / f0..），绝不重复
 *  - 所有跳转为小程序内部路由；无外链、无播放器、无下载、无用户信息采集
 * ============================================================ */

const SPECIALS = require('../../data/special-routes.js');
const mcuData = require('../../models/mcuData.js');
const userState = require('../../models/userState.js');

/* ISO 日期 → 点分隔（与 H5 fmtDate 同口径） */
function fmtDate(s) {
  const d = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return d ? (d[1] + '.' + d[2] + '.' + d[3]) : '';
}

/* 节点视图模型：只装配，不产生内容数据 */
function buildNodes(items, prefix, opts, imgErr) {
  const seenArr = items.map(function (it) { return userState.isSeen(it.workId); });
  const nextIdx = seenArr.indexOf(false);          /* 首个未看 = 当前建议节点 */
  const hasProgress = seenArr.indexOf(true) >= 0;
  const all = nextIdx < 0;

  return items.map(function (it, i) {
    const m = mcuData.get(it.workId);
    const v = m ? mcuData.visual(m.id) : null;
    const name = it.label || (m ? m.cn : '？');
    const key = prefix + i;                        /* 唯一 key，避开重复的 workId */
    return {
      key: key,
      workId: it.workId,
      name: name,
      kw: opts.kw ? (it.kw || '') : '',
      typeLabel: (opts.type && m) ? (mcuData.typeLabel[m.type] || '') : '',
      year: (opts.yr && m) ? String(m.year || '') : '',
      phaseText: m ? ('P' + (m.phase || 0)) : '',
      phaseColor: m ? mcuData.phaseColor(m.phase) : '',
      poster: (v && v.poster) ? v.poster : '',
      letter: String(name || '？').charAt(0),
      seen: seenArr[i],
      isNext: i === nextIdx,
      /* 「你看到这里了」金线：与 H5 同规则，插在最后已看节点之后 */
      splitAfter: !!(hasProgress && !all && i === nextIdx - 1),
      imgErr: !!imgErr[key]
    };
  });
}

Page({
  data: {
    hasRoute: false,
    fullOpen: false,          /* 完整路线默认折叠；build() 不重置，重复进入保留 */
    _imgErr: {},              /* CDN 图片失败标记（页面内存，不写 storage） */

    title: '', tagline: '', heroNote: '', disclaimer: '',
    heroDate: '', heroEn: '', hasHeroDate: false,
    coreCount: 0, fullCount: 0, hasFull: false,
    coreTitle: '', fullTitle: '', fullDesc: '', badge: '',
    originCn: '', originKw: '',
    endpointNum: '', endpointEn: '', endpointCn: '',
    coreNodes: [], fullNodes: [],
    chainTitle: '', chainItems: [],
    chainEndShort: '', chainEndInfo: '', chainEndDesc: '',
    entryTitle: '', entryPrimary: null, entryLinks: []
  },

  onLoad: function (options) {
    const id = (options && options.id) || '';
    let route = null;
    for (let i = 0; i < SPECIALS.length; i++) {
      if (SPECIALS[i].id === id) { route = SPECIALS[i]; break; }
    }
    if (!route) route = SPECIALS[0] || null;       /* id 缺省/非法 → 回落首条 */
    this._route = route;
    this._imgErr = {};
    this.setData({ hasRoute: !!route, fullOpen: false, _imgErr: {} });
  },

  /* 从作品详情页返回 / 重复进入时刷新已看状态，折叠态保留 */
  onShow: function () {
    if (this._route) this.build();
  },

  build: function () {
    const r = this._route;
    if (!r) return;

    /* 复联5 上映信息：专题内部最小映射，派生口径与 H5 一致 */
    const U = r.upcoming || {};
    const U_DATE = fmtDate(U.date);
    const U_EN = String(U.en || '').toUpperCase();
    const U_CN = String(U.title || '');
    const U_SHORT = String(U.en || '').split(':').pop().trim();
    const numMatch = U_CN.match(/联盟(\d+)/);
    const U_NUM = numMatch ? numMatch[1] : '';
    const U_INFO = U_CN + (U_DATE ? ' · ' + U_DATE : '');

    const coreNodes = buildNodes(r.core.items, 'c', { kw: true, tag: true, yr: true }, this._imgErr || {});
    const fullNodes = r.full
      ? buildNodes(r.full.items, 'f', { type: true }, this._imgErr || {})
      : [];
    const coreSeen = coreNodes.filter(function (n) { return n.seen; }).length;
    const coreTotal = coreNodes.length;
    const badge = (coreSeen >= coreTotal)
      ? ('已看完 ' + coreSeen + ' / ' + coreTotal)
      : ('已标记 ' + coreSeen + ' / ' + coreTotal);

    const originM = mcuData.get(r.origin.workId);

    this.setData({
      title: r.title,
      tagline: r.tagline,
      heroNote: r.heroNote,
      disclaimer: r.disclaimer || '',
      heroDate: U_DATE,
      heroEn: U_EN,
      hasHeroDate: !!(U_DATE && U_EN),
      coreCount: coreTotal,
      fullCount: fullNodes.length,
      hasFull: !!r.full,
      coreTitle: r.core.title,
      fullTitle: r.full ? r.full.title : '',
      fullDesc: r.full ? r.full.desc : '',
      badge: badge,
      originCn: originM ? originM.cn : '？',
      originKw: r.origin.kw,
      endpointNum: U_NUM,
      endpointEn: U_SHORT.toUpperCase(),
      endpointCn: U_INFO,
      coreNodes: coreNodes,
      fullNodes: fullNodes,
      chainTitle: r.chain.title,
      chainItems: r.chain.items.map(function (c, i) {
        return { key: 'k' + i, t: c.t, d: c.d };
      }),
      chainEndShort: U_SHORT,
      chainEndInfo: U_INFO,
      chainEndDesc: r.chain.end.d,
      entryTitle: r.entry.title,
      entryPrimary: r.entry.primary,
      entryLinks: r.entry.links
    });
  },

  /* ---- 交互 ---- */

  /* 序号圆点：切换已看（catchtap 阻止冒泡，不会触发作品详情跳转） */
  onToggle: function (e) {
    const id = e.currentTarget.dataset.workId;
    if (!id) return;
    userState.toggle(id);        /* 复用现有状态，与 movie 页共用 watched */
    this.build();               /* 局部重算徽章 + 核心列表 + 折叠列表 */
  },

  /* 整卡：进入作品详情 */
  onGoMovie: function (e) {
    const id = e.currentTarget.dataset.workId;
    if (!id) return;
    wx.navigateTo({ url: '/pages/movie/movie?id=' + encodeURIComponent(id) });
  },

  /* 折叠区开关（WXML 条件渲染，无 details / DOM） */
  onToggleFull: function () {
    this.setData({ fullOpen: !this.data.fullOpen });
  },

  /* Hero CTA1：滚动到核心路线 */
  onGoCore: function () {
    this.scrollTo('#sp-core');
  },

  /* Hero CTA2：展开完整路线并滚动 */
  onGoFull: function () {
    this.setData({ fullOpen: true }, () => {
      setTimeout(() => { this.scrollTo('#sp-full'); }, 60);
    });
  },

  scrollTo: function (selector) {
    const query = wx.createSelectorQuery();
    query.select(selector).boundingClientRect();
    query.selectViewport().scrollOffset();
    query.exec((res) => {
      const rect = res && res[0];
      const view = res && res[1];
      if (!rect || !view) return;
      wx.pageScrollTo({
        scrollTop: Math.max(0, view.scrollTop + rect.top - 8),
        duration: 260
      });
    });
  },

  /* 底部入口：仅小程序内部路由 */
  onEntry: function (e) {
    const url = e.currentTarget.dataset.route;
    const mode = e.currentTarget.dataset.mode;
    if (!url) return;
    if (mode === 'switchTab') wx.switchTab({ url: url });
    else wx.navigateTo({ url: url });
  },

  /* CDN 海报加载失败 → 阶段色 + 首字兜底（不新增图片资源） */
  onImgError: function (e) {
    const key = e.currentTarget.dataset.key;
    if (!key || this._imgErr[key]) return;
    this._imgErr[key] = true;
    this.build();
  }
});
