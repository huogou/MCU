/* ============================================================
 * 首页 home（Tab1）· V1.2 重构（严格按《V1.2 产品视觉重构》规范）
 * ------------------------------------------------------------
 * 固定结构（与 home.wxml 对齐，禁止删除模块）：
 *   ① 品牌区域 → ② 继续观看卡 → ③ 我的路线 → ④ 宇宙探索入口
 *   → ⑤ 热门角色 → ⑥ 最近观看 → Tab
 * 约束：不新增功能 / 不改数据结构 / 不改跳转逻辑 / 不自行设计（按规范执行）。
 * 双态：仅「继续观看卡」内容随 hasProgress 变化
 *   - 新人：从钢铁侠开始 / Phase 1 / 开始观看 / movieId=iron-man
 *   - 老用户：当前观看进度(已看 X/59) / 下一部电影(recommend.next) / 继续观看
 * 数据：全部来自 models（单一可信源），不引入第二套数据；
 *       热门角色 hotChars 取 4 位（tony/steve/thor/peter），关联作品数
 *       由 mcuData.charAppearances 反查；阶段色 avatar 取角色首登场作品 phase。
 * 我的路线：取当前路线（current_route→saved_routes→ROUTES，默认 newcomer），
 *       完成进度 = 路线 items 中已看数量；下一部推荐 = 路线内首个未看 item。
 * 跳转目标（与既有页面一致，不新增/不改）：
 *   继续观看/我的路线下一部/最近观看 → 电影详情
 *   时间线 → 全景页；角色关系 → 探索 Tab；阵营探索 → 角色图鉴
 *   热门角色 → 角色详情（查看故事线）
 * ============================================================ */

const mcuData = require('../../models/mcuData.js');
const userState = require('../../models/userState.js');
const recommend = require('../../models/recommend.js');

/* 传奇标签映射（saga 数据取值：infinity / multiverse） */
const SAGA_LABEL = { infinity: '无限传奇', multiverse: '多元宇宙' };

/* 最近看过最多展示数量 */
const RECENT_MAX = 6;

/* 首页热门角色（4 位：与《V1.2》示例一致；id 用于「查看故事线」跳转角色详情） */
const HOT_CHAR_IDS = ['tony', 'steve', 'thor', 'peter'];

/* 宇宙探索入口（统一入口行式；glyph 为统一字型标记，非混用图标库） */
const EXPLORE_ENTRIES = [
  { key: 'timeline', title: '时间线', desc: '宇宙全景时间线', glyph: '◷' },
  { key: 'relation', title: '角色关系', desc: '角色关系图谱', glyph: '✦' },
  { key: 'camp',     title: '阵营探索', desc: '阵营与势力',   glyph: '◈' }
];

/* 从角色 cn（'托尼·斯塔克 / 钢铁侠'）提取英雄名（'/' 之后部分） */
function heroOf(cn) {
  if (!cn) return '';
  const parts = cn.split('/');
  return (parts.length > 1 ? parts[1] : cn).trim();
}

Page({
  data: {
    continueCard: null,   /* 双态卡：新用户 / 老用户 */
    myRoute: null,        /* 我的路线 */
    exploreEntries: [],   /* 宇宙探索入口 */
    hotChars: [],         /* 热门角色（故事入口） */
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
      myRoute: this.buildMyRoute(),
      exploreEntries: EXPLORE_ENTRIES,
      hotChars: this.buildHotChars(),
      recent: this.buildRecent()
    });
  },

  /* ② 继续观看卡（双态） */
  buildContinueCard(hasProgress, count, total) {
    const newUser = {
      mainText: '从钢铁侠开始',
      phaseText: 'Phase 1',
      progressLabel: '',
      progressText: '',
      buttonText: '开始观看',
      movieId: 'iron-man'
    };
    if (!hasProgress) return newUser;

    /* 老用户：下一部电影 = recommend.next（主线优先），复用 V1.1「下一站推荐」既有逻辑 */
    const latest = userState.latest();
    const rec = latest ? recommend.next(latest.id, 'mainline') : null;
    const c = (rec && rec.content) ? rec.content : latest;
    if (!c) return newUser;

    const phaseNo = c.phase || 1;
    const saga = SAGA_LABEL[c.saga] || '';
    return {
      mainText: c.cn,
      phaseText: 'Phase ' + phaseNo + (saga ? ' · ' + saga : ''),
      progressLabel: '当前观看进度',
      progressText: '已看 ' + count + ' / ' + total,
      buttonText: '继续观看',
      movieId: c.id
    };
  },

  /* ③ 我的路线（当前路线 + 完成进度 + 路线内下一部推荐） */
  buildMyRoute() {
    const state = userState.getState();
    const routeId = this.resolveCurrentRouteId(state);
    const route = mcuData.routeById(routeId) || mcuData.routeById('newcomer');
    const items = (route && route.items) || [];
    const watched = state.watched || {};

    let done = 0;
    items.forEach(function (id) { if (watched[id]) done++; });

    let nextId = null;
    for (let i = 0; i < items.length; i++) {
      if (!watched[items[i]]) { nextId = items[i]; break; }
    }
    let nextName = '已看完当前路线';
    if (nextId) {
      const nm = mcuData.get(nextId);
      if (nm) nextName = nm.cn;
    }

    return {
      name: route ? route.name : '新手入坑',
      progressText: '已完成 ' + done + ' / ' + items.length + ' 部',
      nextName: nextName,
      nextId: nextId
    };
  },

  /* 当前路线解析：saved_routes 中 id === current_route 的项取其 routeId（默认 newcomer） */
  resolveCurrentRouteId(state) {
    const cur = state.current_route;
    const saved = state.saved_routes || [];
    for (let i = 0; i < saved.length; i++) {
      if (saved[i].id === cur) return saved[i].routeId;
    }
    return 'newcomer';
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

  /* 我的路线「继续路线」/ 最近观看 → 电影详情 */
  goMovie(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    wx.navigateTo({ url: '/pages/movie/movie?id=' + id });
  },

  /* 宇宙探索入口 → 对应页面 */
  goExplore(e) {
    const key = e.currentTarget.dataset.key;
    if (key === 'timeline') wx.navigateTo({ url: '/pages/panorama/panorama' });
    else if (key === 'relation') wx.switchTab({ url: '/pages/explore/explore' });
    else if (key === 'camp') wx.navigateTo({ url: '/pages/characters/characters' });
  },

  /* 热门角色 → 角色详情（查看故事线） */
  goChar(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    wx.navigateTo({ url: '/pages/character/character?id=' + id });
  }
});
