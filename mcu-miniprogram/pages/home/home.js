/* ============================================================
 * 首页 home（Tab1）· D12-A Step3-4 双态 + V1.1 Step2 继续观看增强
 * ------------------------------------------------------------
 * 依据：D10-A 冻结稿「首页双态」（恢复资料/D10原型/D10-A_观影主线强化原型.html
 *       pageHomeNew / pageHomeOld）+ V1.1 设计定稿（旅程状态卡 / 下一站推荐卡）
 * 双态：
 *   新用户：品牌引导（欢迎进入 MCU）+ 8 热门起点 pills + 3 功能入口卡 + 「从钢铁侠开始」CTA
 *   老用户：旅程状态卡（当前路线/阶段/进度）→ 进度环 → 下一站推荐卡 → 快捷入口 → 最近看过
 * 数据：全部来自 models（单一可信源），不引入第二套数据；
 *       热门起点 hotStart 为页面 UI 配置（id 数组，自动剔除不存在 id）。
 * V1.1 Step2 变化：
 *   - 新增 journey 旅程状态卡：当前路线（current_route→saved_routes→ROUTES，默认新手入坑）/
 *     当前阶段（watched 最新上映作品 phase，Phase N）/ 观看进度（count / CONTENT 全量 59）
 *   - 继续观看卡升级为「下一站推荐卡」：推荐作品为主体（海报/名称/阶段/说明/继续观看）
 *   - 进度分母统一为 CONTENT 全量 59（与我的MCU 同口径；V1.0 首页为 counts().movie=38）
 * ============================================================ */

const mcuData = require('../../models/mcuData.js');
const userState = require('../../models/userState.js');
const recommend = require('../../models/recommend.js');

/* 首页热门起点（8 个，与 D10 核心原型 1161-1170 行一致；缺失 id 自动剔除） */
const HOT_START_IDS = [
  'iron-man', 'avengers', 'spider-man-homecoming', 'doctor-strange',
  'guardians', 'captain-america-first-avenger', 'thor', 'black-panther'
];

/* 传奇标签映射（saga 数据取值：infinity / multiverse） */
const SAGA_LABEL = { infinity: '无限传奇', multiverse: '多元宇宙' };

/* 首页「下一部推荐」默认模式（D10-A 观影主线强化：主线优先） */
const DEFAULT_REC_MODE = 'mainline';

/* 最近看过最多展示数量 */
const RECENT_MAX = 6;

/* 功能入口卡（新用户态）：route → Tab1 路线，explore → Tab2 探索，
 * pick → 路线选择（D10-A 原型该卡无跳转绑定，恢复决策：指向路线页，待策划确认） */
const FEATURE_CARDS = [
  { key: 'route',   title: '观影路线', desc: '按顺序一步步看', icon: '/assets/icons/tab/routes.png' },
  { key: 'explore', title: '宇宙探索', desc: '查关系看脉络',   icon: '/assets/icons/tab/explore.png' },
  { key: 'pick',    title: '帮我选',   desc: '刚看完推荐下一部', icon: '/assets/icons/tab/star.png' }
];

/* 快捷入口（老用户态）：新手入坑路线 → Tab1；宇宙探索 → Tab2 */
const QUICK_CARDS = [
  { key: 'route',   title: '新手入坑路线', desc: '已看 0 / 12 部', icon: '/assets/icons/tab/routes.png' },
  { key: 'explore', title: '宇宙探索',     desc: '查看关系网络',   icon: '/assets/icons/tab/explore.png' }
];

Page({
  data: {
    hasProgress: false,

    /* 新用户态 */
    hotStart: [],
    featureCards: FEATURE_CARDS,
    cta: null,

    /* 老用户态 */
    ring: { count: 0, total: 0, percent: 0 },
    phaseTitle: '',
    phaseTag: '',
    journey: null,
    nextCard: null,
    quickCards: QUICK_CARDS,
    recent: []
  },

  onShow() {
    this.refresh();
  },

  onReady() {
    /* 进度环 canvas 2d（微信不支持内联 SVG，D10 Step8 记录同款方案）；
     * canvas 无法读取 CSS 变量，环色为 Token 权威值直写（surface-3 / gold） */
    if (this.data.hasProgress) this.drawRing();
  },

  /* ---- 进度环绘制（老用户态） ---- */
  drawRing() {
    const query = wx.createSelectorQuery();
    query.select('#ringCanvas').fields({ node: true, size: true }).exec((res) => {
      if (!res || !res[0] || !res[0].node) return;
      const canvas = res[0].node;
      const ctx = canvas.getContext('2d');
      const dpr = wx.getSystemInfoSync().pixelRatio;
      const w = res[0].width;
      const h = res[0].height;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.scale(dpr, dpr);

      const cx = w / 2;
      const cy = h / 2;
      const r = Math.min(w, h) / 2 - 6;
      const pct = this.data.ring.total ? Math.min(1, this.data.ring.count / this.data.ring.total) : 0;

      ctx.clearRect(0, 0, w, h);
      /* 底环 surface-3 #232C3D */
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = '#232C3D';
      ctx.lineWidth = 5;
      ctx.stroke();
      /* 金环 gold #E9A93B（起点 12 点方向，顺时针） */
      ctx.beginPath();
      ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct);
      ctx.strokeStyle = '#E9A93B';
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.stroke();
    });
  },

  /* ---- 数据装配：根据用户进度切双态 ---- */
  refresh() {
    const count = userState.count();
    /* 进度分母统一 CONTENT 全量 59（V1.1 Step2：与我的MCU 同口径；V1.0 首页为 counts().movie=38） */
    const total = mcuData.all.length;
    const hasProgress = count > 0;

    this.setData({
      hasProgress,
      hotStart: this.buildHotStart(),
      cta: this.buildCta(),
      ring: { count, total, percent: total ? Math.round(count / total * 100) : 0 },
      ...this.buildOldUserData()
    });
  },

  /* 新用户：8 个热门起点 pills（id → 内容，缺失剔除） */
  buildHotStart() {
    const list = [];
    HOT_START_IDS.forEach(function (id) {
      const m = mcuData.get(id);
      if (m) list.push({ id: m.id, cn: m.cn, phase: m.phase || 1 });
    });
    return list;
  },

  /* 新用户：「从钢铁侠开始」CTA 卡（iron-man 缺失时回退第一部上映内容） */
  buildCta() {
    const start = mcuData.get('iron-man') || mcuData.byRelease[0];
    if (!start) return null;
    return {
      id: start.id,
      cn: start.cn,
      en: start.en || '',
      phase: start.phase || 1,
      desc: 'MCU 的起点，一切从这里开始。2008 年改变了超级英雄电影的一部作品。'
    };
  },

  /* 老用户：旅程状态卡 + 进度信息 + 下一站推荐卡 + 快捷 + 最近看过 */
  buildOldUserData() {
    const state = userState.getState();
    const latest = userState.latest();
    const journey = this.buildJourney(state, latest);
    const nextCard = this.buildNextCard(latest);
    const route = mcuData.routeById('newcomer');
    const routeTotal = route ? (route.items || []).length : 12;

    return {
      journey: journey,
      phaseTitle: journey.phaseTitle,
      phaseTag: journey.phaseTag,
      nextCard: nextCard,
      quickCards: [
        { key: 'route', title: '新手入坑路线', desc: '已看 ' + Math.min(countNewcomerProgress(state, route), routeTotal) + ' / ' + routeTotal + ' 部', icon: '/assets/icons/tab/routes.png' },
        { key: 'explore', title: '宇宙探索', desc: '查看关系网络', icon: '/assets/icons/tab/explore.png' }
      ],
      recent: this.buildRecent()
    };
  },

  /* 当前旅程状态卡（V1.1 Step2）：
   * 当前路线 = current_route → saved_routes[].routeId → ROUTES.name（无则默认新手入坑）
   * 当前阶段 = watched 最新上映作品的 phase（无观看则 Phase 1）
   * 观看进度 = count / CONTENT 全量 59 */
  buildJourney(state, latest) {
    const routeId = this.resolveCurrentRouteId(state);
    const route = mcuData.routeById(routeId) || mcuData.routeById('newcomer');
    const routeName = route ? route.name : '新手入坑';
    const phaseNo = latest ? (latest.phase || 1) : 1;
    const count = userState.count();
    const total = mcuData.all.length;
    const saga = latest ? (SAGA_LABEL[latest.saga] || '') : '';
    return {
      routeName: routeName,
      phaseNo: phaseNo,
      phaseText: 'Phase ' + phaseNo,
      progressText: count + ' / ' + total,
      phaseTitle: latest ? ('正在看第' + cnPhase(phaseNo) + '阶段') : '准备开始你的旅程',
      phaseTag: saga ? ('第' + cnPhase(phaseNo) + '阶段 · ' + saga) : (latest ? ('第' + cnPhase(phaseNo) + '阶段') : '')
    };
  },

  /* current_route 解析：saved_routes 中 id === current_route 的项取其 routeId（指令四：优先显示 current_route） */
  resolveCurrentRouteId(state) {
    const cur = state.current_route;
    const saved = state.saved_routes || [];
    for (let i = 0; i < saved.length; i++) {
      if (saved[i].id === cur) return saved[i].routeId;
    }
    return 'newcomer';
  },

  /* 下一站推荐卡（V1.1 Step2）：以 recommend.next 结果为主体（海报/名称/阶段/说明/继续观看） */
  buildNextCard(latest) {
    if (!latest) return null;
    const next = recommend.next(latest.id, DEFAULT_REC_MODE);
    if (!next || !next.content) {
      return { id: null, done: true, cn: '', phase: 0, why: '主线已看完' };
    }
    const c = next.content;
    const why = c.role || next.why || '';
    return {
      id: c.id,
      cn: c.cn,
      en: c.en || '',
      phase: c.phase || 1,
      phaseText: 'Phase ' + (c.phase || 1),
      whyShort: why.slice(0, 40),
      lastSeen: latest.cn
    };
  },

  /* 最近看过：按观看时间倒序取最近 6 部 */
  buildRecent() {
    const state = userState.getState();
    const watched = state.watched || {};
    const ids = Object.keys(watched).sort(function (a, b) { return watched[b] - watched[a]; });
    const list = [];
    ids.slice(0, RECENT_MAX).forEach(function (id) {
      const m = mcuData.get(id);
      if (m) list.push({ id: m.id, cn: m.cn, phase: m.phase || 1 });
    });
    return list;
  },

  /* ---- 交互 ---- */
  goTab(e) {
    const key = e.currentTarget.dataset.key;
    if (key === 'route') wx.switchTab({ url: '/pages/routes/routes' });
    else if (key === 'explore') wx.switchTab({ url: '/pages/explore/explore' });
    else if (key === 'pick') wx.switchTab({ url: '/pages/routes/routes' });
  },

  goMovie(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    wx.navigateTo({ url: '/pages/movie/movie?id=' + id });
  },

  goStart(e) {
    const id = e.currentTarget.dataset.id || 'iron-man';
    wx.navigateTo({ url: '/pages/movie/movie?id=' + id });
  },

  /* 下一站推荐卡 → 电影详情（V1.1 Step2） */
  goNext(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    wx.navigateTo({ url: '/pages/movie/movie?id=' + id });
  }
});

/* 中文阶段数字（1-6） */
function cnPhase(n) {
  return ['一', '二', '三', '四', '五', '六'][n - 1] || String(n);
}

/* 新手入坑路线已看进度（按路线 items 顺序，返回已看的数量） */
function countNewcomerProgress(state, route) {
  const watched = state.watched || {};
  const items = route ? (route.items || []) : [];
  let c = 0;
  items.forEach(function (id) { if (watched[id]) c++; });
  return c;
}
