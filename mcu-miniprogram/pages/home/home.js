/* ============================================================
 * 首页 home（Tab1）· V1.2 视觉还原（按《MCU-V1.2视觉验收清单》H-01~H-18）
 * ------------------------------------------------------------
 * 结构（与《页面视觉升级方案》§2.3 一致，5 模块）：
 *   ① 旅程进度卡 → ② 推荐下一部大卡 → ③ 宇宙入口 3 列
 *   → ④ 热门角色横滚 → ⑤ 最近观看横滚
 * 数据纪律：全部来自 models（单一可信源），不引入第二套数据；
 *   仅重构本页视图模型（Page.data 装配），底层数据模型不动。
 * 图片：统一经 mcuData.visual(id) 取 poster/backdrop；
 *   角色头像(24张)/首页背景(1张)当前无资源 → 返回 null → 前端合规兜底
 *   （阶段色渐变+首字 / 宇宙渐变占位），不破图（G-18/G-19）。
 * 跳转目标与既有页面一致，不新增/不改：
 *   旅程当前电影/推荐/最近观看 → 电影详情；宇宙入口 → 时间线/角色图鉴/关系探索；
 *   热门角色 → 角色详情。
 * ============================================================ */

const mcuData = require('../../models/mcuData.js');
const userState = require('../../models/userState.js');
const recommend = require('../../models/recommend.js');

/* 传奇标签映射（saga 取值：infinity / multiverse） */
const SAGA_LABEL = { infinity: '无限传奇', multiverse: '多元宇宙' };

/* 最近观看最多展示 */
const RECENT_MAX = 6;

/* 首页热门角色（4 位，与《V1.2》示例一致；id 用于跳转角色详情） */
const HOT_CHAR_IDS = ['tony', 'steve', 'thor', 'peter'];

/* 阵营 → 颜色 class + 中文标签（依据验收清单 C-04：复仇者红/阿斯加德蓝/银护紫/瓦坎达金） */
const CAMP_MAP = {
  avengers:  { cls: 'red',    label: '复仇者' },
  asgard:    { cls: 'blue',   label: '阿斯加德' },
  guardians: { cls: 'purple', label: '银河护卫队' },
  wakanda:   { cls: 'gold',   label: '瓦坎达' },
  shield:    { cls: 'blue',   label: '神盾局' }
};

/* 宇宙入口 3 列（依据 §2.3③：时间线蓝 / 角色图鉴红 / 关系探索紫） */
const EXPLORE_ENTRIES = [
  { key: 'timeline',   title: '宇宙时间线', glyph: '◷', bg: 'exp-blue' },
  { key: 'characters', title: '角色图鉴',   glyph: '✦', bg: 'exp-red' },
  { key: 'relation',   title: '关系探索',   glyph: '⬡', bg: 'exp-purple' }
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
    progress: null,    /* ① 旅程进度卡 */
    recommend: null,  /* ② 推荐下一部大卡 */
    exploreEntries: [], /* ③ 宇宙入口 3 列 */
    hotChars: [],     /* ④ 热门角色 */
    recent: [],       /* ⑤ 最近观看 */
    homeBg: ''        /* 旅程卡背景（home-bg.jpg，缺失空 → 渐变占位） */
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

    /* ① 旅程进度卡 */
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

    /* ④ 热门角色（V1.2 头像资源：visuals.avatar 24 张；缺失返回 null → 前端 G-19 兜底） */
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

    this.setData({
      progress: progress,
      recommend: recommendCard,
      exploreEntries: EXPLORE_ENTRIES,
      hotChars: hotChars,
      recent: recent,
      homeBg: mcuData.homeBg() || ''
    });
  },

  /* ---- 交互（跳转目标与旧版一致，不新增/不改） ---- */

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

  /* 宇宙入口 → 对应页面 */
  goExplore(e) {
    const key = e.currentTarget.dataset.key;
    if (key === 'timeline') wx.navigateTo({ url: '/pages/panorama/panorama' });
    else if (key === 'characters') wx.navigateTo({ url: '/pages/characters/characters' });
    else if (key === 'relation') wx.switchTab({ url: '/pages/explore/explore' });
  },

  /* 热门角色 → 角色详情 */
  goChar(e) {
    const id = e.currentTarget.dataset.id;
    if (id) wx.navigateTo({ url: '/pages/character/character?id=' + id });
  }
});
