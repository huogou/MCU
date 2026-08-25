/* ============================================================
 * 首页 home（Tab1）· V1.2 重构（严格按《V1.2 UI Design System》）
 * ------------------------------------------------------------
 * 固定结构（自上而下，与 home.wxml 对齐，禁止删除模块）：
 *   ① 顶部品牌区 → ② 继续观看卡 → ③ 快捷入口 → ④ 新手路线推荐
 *   → ⑤ 热门角色 → ⑥ 最近观看 → Tab
 * 约束：不新增功能 / 不改数据结构 / 不改跳转逻辑 / 不自行设计（按规范执行）。
 * 双态：仅「继续观看卡」内容随 hasProgress 变化
 *   - 新用户：电影=钢铁侠 / 进度=未开始 / 按钮=开始观看 / movieId=iron-man
 *   - 老用户：电影=latest.cn / phaseText=Phase N · saga / 进度=已看 X / 59
 *             / 按钮=继续观看 / movieId=latest.id
 * 数据：全部来自 models（单一可信源），不引入第二套数据；
 *       热门角色 hotChars 取 4 位（tony/steve/thor/peter），关联作品数
 *       由 mcuData.charAppearances 反查，不改动 characters 结构。
 * 阶段色 avatar 取角色首次登场作品的 phase（poster-pN），沿用全局 phase token。
 * ============================================================ */

const mcuData = require('../../models/mcuData.js');
const userState = require('../../models/userState.js');

/* 传奇标签映射（saga 数据取值：infinity / multiverse） */
const SAGA_LABEL = { infinity: '无限传奇', multiverse: '多元宇宙' };

/* 最近看过最多展示数量 */
const RECENT_MAX = 6;

/* 首页热门角色（4 位：与《V1.2 UI Design System》示例一致） */
const HOT_CHAR_IDS = ['tony', 'steve', 'thor', 'peter'];

/* 从角色 cn（'托尼·斯塔克 / 钢铁侠'）提取英雄名（'/' 之后部分） */
function heroOf(cn) {
  if (!cn) return '';
  const parts = cn.split('/');
  return (parts.length > 1 ? parts[1] : cn).trim();
}

Page({
  data: {
    continueCard: null,   /* 双态卡：新用户 / 老用户 */
    quickEntries: [],     /* 三个核心入口 */
    routeRec: null,       /* 新手路线推荐 */
    hotChars: [],         /* 热门角色 */
    recent: []            /* 最近观看 */
  },

  onShow() {
    this.refresh();
  },

  /* ---- 数据装配 ---- */
  refresh() {
    const count = userState.count();
    const total = mcuData.all.length;
    const hasProgress = count > 0;

    this.setData({
      continueCard: this.buildContinueCard(hasProgress, count, total),
      quickEntries: this.buildQuickEntries(),
      routeRec: this.buildRouteRec(),
      hotChars: this.buildHotChars(),
      recent: this.buildRecent()
    });
  },

  /* ② 继续观看卡（双态） */
  buildContinueCard(hasProgress, count, total) {
    const fallback = {
      movieId: 'iron-man',
      movieName: '钢铁侠',
      phaseText: '未开始',
      progressText: '还没有观看记录',
      buttonText: '开始观看'
    };
    if (!hasProgress) {
      const start = mcuData.get('iron-man');
      if (start) fallback.movieName = start.cn;
      return fallback;
    }
    const latest = userState.latest();
    if (!latest) return fallback;
    const phaseNo = latest.phase || 1;
    const saga = SAGA_LABEL[latest.saga] || '';
    return {
      movieId: latest.id,
      movieName: latest.cn,
      phaseText: 'Phase ' + phaseNo + (saga ? ' · ' + saga : ''),
      progressText: '已看 ' + count + ' / ' + total,
      buttonText: '继续观看'
    };
  },

  /* ③ 三个核心入口（图标统一用 tab PNG；键位映射到对应 Tab） */
  buildQuickEntries() {
    return [
      { key: 'route',  title: '新手入坑', icon: '/assets/icons/tab/routes.png' },
      { key: 'explore', title: '宇宙探索', icon: '/assets/icons/tab/explore.png' },
      { key: 'my-mcu', title: '我的MCU', icon: '/assets/icons/tab/my-mcu.png' }
    ];
  },

  /* ④ 新手路线推荐（newcomer 路线） */
  buildRouteRec() {
    const route = mcuData.routeById('newcomer');
    return {
      name: route ? route.name : '新手入坑',
      count: route ? (route.items || []).length : 12,
      buttonText: '开始体验'
    };
  },

  /* ⑤ 热门角色（4 位；关联作品数反查，阶段色取首次登场作品 phase） */
  buildHotChars() {
    return HOT_CHAR_IDS.map(function (id) {
      const c = mcuData.getChar(id);
      if (!c) return null;
      const heroName = heroOf(c.cn);
      const firstMovie = mcuData.get(c.first);
      const phase = (firstMovie && firstMovie.phase) ? firstMovie.phase : 1;
      return {
        id: id,
        name: heroName,
        initial: heroName.charAt(0),
        phase: phase,
        count: mcuData.charAppearances(id).count
      };
    }).filter(Boolean);
  },

  /* ⑥ 最近观看（按观看时间倒序取最近 6 部） */
  buildRecent() {
    const state = userState.getState();
    const watched = state.watched || {};
    const ids = Object.keys(watched).sort(function (a, b) { return watched[b] - watched[a]; });
    return ids.slice(0, RECENT_MAX).map(function (id) {
      const m = mcuData.get(id);
      if (!m) return null;
      return {
        id: m.id,
        name: m.cn,
        initial: m.cn.charAt(0),
        phase: m.phase || 1
      };
    }).filter(Boolean);
  },

  /* ---- 交互（跳转目标与旧版一致，不新增/不改） ---- */
  /* 继续观看卡 → 电影详情 */
  goContinue(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    wx.navigateTo({ url: '/pages/movie/movie?id=' + id });
  },

  /* 快捷入口 / 新手路线推荐 → 对应 Tab */
  goTab(e) {
    const key = e.currentTarget.dataset.key;
    if (key === 'route') wx.switchTab({ url: '/pages/routes/routes' });
    else if (key === 'explore') wx.switchTab({ url: '/pages/explore/explore' });
    else if (key === 'my-mcu') wx.switchTab({ url: '/pages/my-mcu/my-mcu' });
  },

  /* 最近观看 → 电影详情 */
  goMovie(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    wx.navigateTo({ url: '/pages/movie/movie?id=' + id });
  }
});
