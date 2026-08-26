/* ============================================================
 * 首页 home（Tab1）· V1.2 视觉系统落地（按《MCU-V1.2-Visual-Design-System》VDS V2）
 * ------------------------------------------------------------
 * 结构（VDS §2.1，5 模块）：
 *   ① Hero Banner（新增，hero-banner.jpg + 迷你旅程条）
 *   → ② 旅程/推荐卡（简化：去背景图，紧凑电影推荐）
 *   → ③ 功能入口 2×2 视觉卡片（开始观看/时间线/角色图鉴/关系探索）
 *   → ④ 热门角色横滚 → ⑤ 最近观看横滚
 * 数据纪律：全部来自 models（单一可信源），仅装配本页视图模型；
 *   图片 URL 只存在于 visuals.js（经 mcuData 转发层访问，禁硬编码）。
 * 跳转：入口 4 卡路由对齐实际页面（watch→routes(Tab)、timeline→panorama、
 *   characters→characters、relationships→explore(Tab)）。
 * ============================================================ */

const mcuData = require('../../models/mcuData.js');
const userState = require('../../models/userState.js');
const recommend = require('../../models/recommend.js');

/* 传奇标签映射（saga 取值：infinity / multiverse） */
const SAGA_LABEL = { infinity: '无限传奇', multiverse: '多元宇宙' };

/* 最近观看最多展示 */
const RECENT_MAX = 6;

/* 首页热门角色（4 位；id 用于跳转角色详情） */
const HOT_CHAR_IDS = ['tony', 'steve', 'thor', 'peter'];

/* 阵营 → 颜色 class + 中文标签（设计 §4.4） */
const CAMP_MAP = {
  avengers:  { cls: 'red',    label: '复仇者' },
  asgard:    { cls: 'blue',   label: '阿斯加德' },
  guardians: { cls: 'purple', label: '银河护卫队' },
  wakanda:   { cls: 'gold',   label: '瓦坎达' },
  shield:    { cls: 'blue',   label: '神盾局' }
};

/* 功能入口 2×2 视觉卡片（VDS §2.3，4 张；key 驱动跳转分流 + visuals.entryBg 取背景） */
const ENTRY_CARDS = [
  { key: 'watch',         title: '开始观看',  desc: '38 部 · 按序排列', icon: '▶', route: '/pages/routes/routes' },
  { key: 'timeline',      title: '宇宙时间线', desc: '6 阶段 · 脉络清晰', icon: '◷', route: '/pages/panorama/panorama' },
  { key: 'characters',    title: '角色图鉴',  desc: '24 位 · 阵营关系', icon: '✦', route: '/pages/characters/characters' },
  { key: 'relationships', title: '关系探索',  desc: '92 条 · 网络图谱', icon: '⬡', route: '/pages/explore/explore' }
];

/* 从角色 cn（'托尼·斯塔克 / 钢铁侠'）提取英雄名（'/' 之后） */
function heroOf(cn) {
  if (!cn) return '';
  const parts = cn.split('/');
  return (parts.length > 1 ? parts[1] : cn).trim();
}

/* 电影视图模型：取 poster/backdrop（缺失为 null，前端走兜底） */
function movieVM(id) {
  const m = mcuData.get(id);
  if (!m) return null;
  const v = mcuData.visual(id);
  const phaseNo = m.phase || 1;
  const saga = SAGA_LABEL[m.saga] || '';
  return {
    id: m.id,
    poster: (v && v.poster) ? v.poster : null,
    backdrop: (v && v.backdrop) ? v.backdrop : null,
    name: m.cn,
    enName: m.en || '',
    phaseText: 'Phase ' + phaseNo + (saga ? ' · ' + saga : ''),
    year: m.year ? String(m.year) : '',
    initial: m.cn.charAt(0),
    phase: phaseNo
  };
}

Page({
  data: {
    heroBanner: '',   /* ① Hero Banner 背景（hero-banner.jpg） */
    heroMeta: '',     /* Hero 副标题文案（59 部 · 24 角色 · 6 阶段） */
    progressPercent: 0, /* Hero 迷你旅程条进度 */
    progress: null,   /* ② 旅程/推荐卡 */
    recommend: null,  /* ② 推荐下一部大卡 */
    entryCards: [],   /* ③ 功能入口 2×2 */
    hotChars: [],     /* ④ 热门角色 */
    recent: []        /* ⑤ 最近观看 */
  },

  onShow() { this.refresh(); },

  /* ---- 数据装配（仅本页视图模型） ---- */
  refresh() {
    const count = userState.count();
    const total = mcuData.all.length;
    const hasProgress = count > 0;
    const state = userState.getState();
    const watched = state.watched || {};
    const latest = userState.latest();

    /* ① Hero Banner（VDS §2.2）+ 迷你旅程条 */
    const heroBanner = mcuData.heroBanner() || '';
    const progressPercent = total > 0 ? Math.min(100, Math.round(count / total * 100)) : 0;

    /* ② 旅程/推荐卡（VDS §2.2：Hero 吸收进度信息，旅程卡简化为当前电影推荐） */
    const currentId = (hasProgress && latest) ? latest.id : 'iron-man';
    const cur = movieVM(currentId);
    const isCurrent = !watched[currentId];
    const progress = {
      count: count,
      total: total,
      journeyLabel: '我的 MCU 旅程',
      phaseText: hasProgress ? cur.phaseText : 'Phase 1 · 无限传奇',
      movie: {
        id: cur.id,
        poster: cur.poster,
        name: cur.name,
        enName: cur.enName,
        phaseText: cur.phaseText,
        year: cur.year,
        initial: cur.initial,
        phase: cur.phase,
        statusLabel: isCurrent ? '当前观看' : '已观看',
        statusCls: isCurrent ? 'st-current' : 'st-done'
      }
    };

    /* ② 推荐下一部 */
    let recMovie = movieVM('iron-man');
    if (hasProgress && latest) {
      const r = recommend.next(latest.id, 'mainline');
      if (r && r.content) recMovie = movieVM(r.content.id);
    }
    const recommendCard = {
      id: recMovie.id,
      poster: recMovie.poster,
      initial: recMovie.initial,
      phase: recMovie.phase,
      tag: '推荐下一部',
      phaseLabel: recMovie.phaseText,
      name: recMovie.name,
      subInfo: recMovie.year ? ('Phase ' + recMovie.phase + ' · ' + recMovie.year) : recMovie.phaseText,
      reason: hasProgress ? '上一部留下的悬念，从这里继续' : 'MCU 的起点，一切从这里开始',
      cta: hasProgress ? '继续观看' : '开始观看'
    };

    /* ③ 功能入口 2×2（VDS §2.3：bg 经 visuals.entryBg） */
    const entryCards = ENTRY_CARDS.map(function (e) {
      return {
        key: e.key,
        title: e.title,
        desc: e.desc,
        icon: e.icon,
        route: e.route,
        bg: mcuData.entryBg(e.key) || ''
      };
    });

    /* ④ 热门角色（24 张真实头像；缺失 G-19 兜底） */
    const hotChars = HOT_CHAR_IDS.map(function (id) {
      const c = mcuData.getChar(id);
      if (!c) return null;
      const heroName = heroOf(c.cn);
      const camp = CAMP_MAP[c.camp] || CAMP_MAP.avengers;
      return {
        id: id,
        name: heroName,
        initial: heroName.charAt(0),
        factionCls: camp.cls,
        factionLabel: camp.label,
        poster: mcuData.avatar(id) || ''
      };
    }).filter(Boolean);

    /* ⑤ 最近观看（按观看时间倒序取最近 6 部） */
    const recentIds = Object.keys(watched).sort(function (a, b) { return watched[b] - watched[a]; });
    const recent = recentIds.slice(0, RECENT_MAX).map(function (id) {
      const m = mcuData.get(id);
      if (!m) return null;
      const v = mcuData.visual(id);
      return {
        id: id,
        name: m.cn,
        initial: m.cn.charAt(0),
        poster: (v && v.poster) ? v.poster : '',
        phase: m.phase || 1
      };
    }).filter(Boolean);

    /* Hero 副标题（VDS §2.2 文案：总作品动态取，24 角色 / 6 阶段为数据常量） */
    this.setData({
      heroBanner: heroBanner,
      heroMeta: total + ' 部 · 24 角色 · 6 阶段',
      progressPercent: progressPercent,
      progress: progress,
      recommend: recommendCard,
      entryCards: entryCards,
      hotChars: hotChars,
      recent: recent
    });
  },

  /* ---- 交互 ---- */

  /* 推荐/继续 → 电影详情 */
  goContinue(e) {
    const id = e.currentTarget.dataset.id;
    if (id) wx.navigateTo({ url: '/pages/movie/movie?id=' + id });
  },

  /* 最近观看 → 电影详情 */
  goMovie(e) {
    const id = e.currentTarget.dataset.id;
    if (id) wx.navigateTo({ url: '/pages/movie/movie?id=' + id });
  },

  /* Hero 迷你旅程条 → 路线页（Tab） */
  goJourney() {
    wx.switchTab({ url: '/pages/routes/routes' });
  },

  /* 功能入口 2×2 → 对应页面（路由对齐实际页面；Tab 页用 switchTab） */
  onEntryTap(e) {
    const key = e.currentTarget.dataset.key;
    if (key === 'watch') wx.switchTab({ url: '/pages/routes/routes' });
    else if (key === 'timeline') wx.navigateTo({ url: '/pages/panorama/panorama' });
    else if (key === 'characters') wx.navigateTo({ url: '/pages/characters/characters' });
    else if (key === 'relationships') wx.switchTab({ url: '/pages/explore/explore' });
  },

  /* 热门角色 → 角色详情 */
  goChar(e) {
    const id = e.currentTarget.dataset.id;
    if (id) wx.navigateTo({ url: '/pages/character/character?id=' + id });
  }
});
