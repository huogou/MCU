/* ============================================================
 * 电影详情 movie（子页，含资源模块）· D12-A Step3-5 恢复
 * ------------------------------------------------------------
 * 依据：D10-A 冻结稿「电影详情页」（恢复资料/D10原型/D10-A_观影主线强化原型.html
 *       line 674-966 样式 + line 1474-1790 三态页面结构）
 * 恢复范围：Hero 区 + 状态三态 + 主 CTA 三态联动 + 观看资源折叠模块
 *          + 为什么现在看 + 前后关联（上映序）+ 看完之后（下一部推荐）
 *          + userState 状态联动（开始观看 / 标记为已观看）
 * 数据纪律：
 *   - 全部来自 models（mcuData / userState / recommend）与 data/*.js（单一可信源），
 *     不引入第二套数据；「为什么现在看」用 CONTENT.role（已在数据内，回答"为何重要"），
 *     路线上下文来自 routes.js。
 *   - resources 层当前为空（项目方未提供链接），资源模块按结构渲染占位，
 *     不填链接、不开发下载。
 *   - 阶段色 / 海报兜底严格引用 data/visuals.js 与 models/mcuData.phaseColor，
 *     颜色零 raw hex（hero-bg 渐变用 JS 由阶段 hex 转 rgba，技术必要）。
 * ============================================================ */

const mcuData = require('../../models/mcuData.js');
const userState = require('../../models/userState.js');
const recommend = require('../../models/recommend.js');
const resources = require('../../data/resources.js');
const achievements = require('../../models/achievements.js');

/* 传奇标签映射（saga 数据取值：infinity / multiverse） */
const SAGA_LABEL = { infinity: '无限传奇', multiverse: '多元宇宙传奇' };

/* 阵营 → 视觉类（兜底渐变/描边，与设计 §4.4 一致；gray=反派/未定义） */
const CAMP_MAP = {
  avengers: { cls: 'red',    label: '复仇者' },
  asgard:   { cls: 'blue',   label: '阿斯加德' },
  guardians:{ cls: 'purple', label: '银河护卫队' },
  wakanda:  { cls: 'gold',   label: '瓦坎达' },
  shield:   { cls: 'blue',   label: '神盾局' },
  mutant:   { cls: 'purple', label: '变种人' },
  villain:  { cls: 'gray',   label: '反派' },
  street:   { cls: 'red',    label: '街头英雄' }
};
function campCls(camp) { return CAMP_MAP[camp] || { cls: 'gray', label: camp || '' }; }

/* 中文阶段数字（1-6） */
function cnPhase(n) {
  return ['一', '二', '三', '四', '五', '六'][n - 1] || String(n);
}

/* hex → rgba（hero-bg 渐变用，阶段色 + 透明度） */
function hexToRgba(hex, a) {
  hex = (hex || '').replace('#', '');
  if (hex.length === 3) hex = hex.split('').map(function (c) { return c + c; }).join('');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
}

/* 构建海报卡描述符（用于 Hero / 前后关联 / 下一部推荐） */
function posterCard(m, roleLabel, isCurrent) {
  if (!m) return null;
  const v = mcuData.visual(m.id);
  return {
    id: m.id,
    cn: m.cn,
    poster: (v && v.poster) ? v.poster : '',
    posterClass: 'poster-p' + (m.phase || 1),
    letter: (m.cn || '').charAt(0),
    phase: m.phase || 1,
    roleLabel: roleLabel,
    isCurrent: !!isCurrent,
    watched: userState.isSeen(m.id)
  };
}

Page({
  data: {
    notFound: false,
    id: '',

    /* Hero */
    posterImg: '',
    posterClass: 'poster-p1',
    posterLetter: '',
    heroBg: '',
    cn: '',
    en: '',
    phaseText: '',
    phaseDot: '',
    chips: [],

    /* 状态 + CTA */
    status: { cls: 'unwatched', text: '未观看', ico: 'circle' },
    cta: { state: 'unwatched', cls: 'primary', text: '开始观看' },

    /* 资源模块 */
    resource: { exists: false, title: '观看资源', sub: '想看时，资源会在这里', pending: true },
    resourceExpanded: false,

    /* 为什么现在看 */
    why: { ctx: '', text: '' },

    /* 前后关联 */
    seqPrev: null,
    seqCur: null,
    seqNext: null,

    /* 主要角色（M-08/M-09） */
    mainChars: [],

    /* 看完之后 */
    mark: { marked: false, text: '标记为已观看' },
    nextRec: null,

    /* 成就弹窗（V1.1 Step5：仅观影完成后触发，shown 去重防频繁弹窗） */
    achPopup: null
  },

  /* 当前三态（交互处理时复用，避免重复读 storage） */
  _state: 'unwatched',

  onLoad(options) {
    const id = (options && options.id) || '';
    this.setData({ id: id });
    this.refresh();
  },

  onShow() {
    /* 从下一部详情返回时，状态可能已变化，刷新 */
    if (this.data.id) this.refresh();
  },

  /* ---- 数据装配 ---- */
  refresh() {
    const id = this.data.id;
    const m = mcuData.get(id);
    if (!m) {
      this.setData({ notFound: true });
      return;
    }

    const state = userState.watchState(id);
    this._state = state;

    const v = mcuData.visual(id);
    const phase = m.phase || 1;
    const phaseColor = mcuData.phaseColor(phase);

    /* Hero */
    const chips = [];
    const sagaLabel = SAGA_LABEL[m.saga];
    if (sagaLabel) chips.push({ cls: 'gold', text: sagaLabel });
    const impLabel = mcuData.impLabel[m.importance];
    if (impLabel) chips.push({ cls: 'blue', text: impLabel });
    const typeLabel = mcuData.typeLabel[m.type];
    if (typeLabel) chips.push({ cls: '', text: typeLabel });

    /* 状态 + CTA */
    const status = this.buildStatus(state);
    const cta = this.buildCta(state);

    /* 资源模块 */
    const res = resources.get(id);
    const resource = res
      ? { exists: true, title: res.title || m.cn, sub: '已为你准备好观影资源', pending: false }
      : { exists: false, title: '观看资源', sub: '想看时，资源会在这里', pending: true };

    /* 为什么现在看（role + 路线上下文） */
    const why = this.buildWhy(m);

    /* 主要角色（M-08/M-09：content.chars 前 4 位；真实头像优先，缺图 G-19 兜底） */
    const mainChars = (m.chars && m.chars.length)
      ? m.chars.slice(0, 4).map(function (cid) {
          const c = mcuData.getChar(cid);
          if (!c) return null;
          const camp = campCls(c.camp);
          const avatar = mcuData.avatar(c.id) || '';   /* V1.2：24 张真实头像；缺失空 → G-19 兜底 */
          const parts = (c.cn || '').split(' / ');
          return {
            id: c.id,
            name: parts.length > 1 ? parts[1] : (parts[0] || ''),
            initial: (c.cn || '').charAt(0),
            avatar: avatar,
            factionCls: 'fbg-' + camp.cls,
            ringCls: 'fring-' + camp.cls,
            factionLabel: camp.label
          };
        }).filter(Boolean)
      : [];

    /* 前后关联（PANO_CONN 权威连接图，mainline 优先 + 上映序最接近） */
    const nb = mcuData.panoNeighbors(id);
    const prev = nb.prev;
    const next = nb.next;
    const seqPrev = posterCard(prev, prev ? (userState.isSeen(prev.id) ? '已看' : '前一部') : '', false);
    const seqCur = posterCard(m, userState.isSeen(id) ? '已看' : '当前', true);
    const seqNext = posterCard(next, next ? '下一部' : '', false);

    /* 看完之后 */
    const mark = this.buildMark(state);
    const nx = recommend.next(id, 'mainline');
    const nextRec = nx && nx.content
      ? (function () {
          const vx = mcuData.visual(nx.content.id);
          return {
            id: nx.content.id,
            cn: nx.content.cn,
            poster: (vx && vx.poster) ? vx.poster : '',
            posterClass: 'poster-p' + (nx.content.phase || 1),
            letter: (nx.content.cn || '').charAt(0),
            label: state === 'watched' ? '继续看下一部' : '看完这部之后',
            why: nx.why
          };
        })()
      : null;

    this.setData({
      notFound: false,
      posterImg: v.poster || '',
      posterClass: 'poster-p' + phase,
      posterLetter: (m.cn || '').charAt(0),
      heroBg: (v.backdrop)
        ? 'background-image: linear-gradient(160deg, ' + hexToRgba(phaseColor, 0.38) + ' 0%, ' + hexToRgba(phaseColor, 0.12) + ' 42%, var(--bg) 100%), url(\"' + v.backdrop + '\"); background-size: cover; background-position: center;'
        : 'background: linear-gradient(160deg, ' + hexToRgba(phaseColor, 0.08) + ', transparent 50%, var(--bg));',
      cn: m.cn,
      en: m.en || '',
      phaseText: '第' + cnPhase(phase) + '阶段' + (m.year ? ' · ' + m.year : ''),
      phaseDot: phaseColor,
      chips: chips,
      status: status,
      cta: cta,
      resource: resource,
      why: why,
      mainChars: mainChars,
      seqPrev: seqPrev,
      seqCur: seqCur,
      seqNext: seqNext,
      mark: mark,
      nextRec: nextRec
    });
  },

  buildStatus(state) {
    if (state === 'watched') return { cls: 'watched', text: '已观看', ico: 'check' };
    if (state === 'watching') return { cls: 'watching', text: '正在观看', ico: 'play' };
    return { cls: 'unwatched', text: '未观看', ico: 'circle' };
  },

  buildCta(state) {
    if (state === 'watched') return { state: 'watched', cls: 'done', text: '已观看' };
    if (state === 'watching') return { state: 'watching', cls: 'primary', text: '继续观看' };
    return { state: 'unwatched', cls: 'primary', text: '开始观看' };
  },

  buildMark(state) {
    if (state === 'watched') return { marked: true, text: '已标记为观看' };
    return { marked: false, text: '标记为已观看' };
  },

  buildWhy(m) {
    let ctx = '';
    const route = mcuData.routeById('newcomer');
    if (route && route.items) {
      const idx = route.items.indexOf(m.id);
      if (idx >= 0) ctx = '你正沿「新手入坑」路线观看，这是第 ' + (idx + 1) + ' 部。';
    }
    return { ctx: ctx, text: m.role || '' };
  },

  /* ---- 交互 ---- */
  onBack() {
    wx.navigateBack({ delta: 1 });
  },

  /* 主 CTA 三态联动 */
  onPrimaryCta() {
    if (this._state === 'unwatched') {
      userState.want(this.data.id);            /* → 正在观看 */
      wx.showToast({ title: '已加入正在观看', icon: 'none' });
      this.refresh();
    } else if (this._state === 'watching') {
      /* 继续观看：展开资源模块（无播放器，资源入口在此） */
      this.setData({ resourceExpanded: true });
    }
    /* watched：done 态，无操作 */
  },

  /* 标记为已观看（V1.1 Step5：完成后触发成就检测，仅弹一次，不频繁打扰） */
  onMarkWatched() {
    if (this._state === 'watched') return;
    this.setData({ achPopup: null });            /* 先清旧弹窗（防残留） */
    userState.toggle(this.data.id);            /* → 已观看 */
    wx.showToast({ title: '已标记为已观看', icon: 'none' });
    this.refresh();
    /* 成就检测：新解锁且未提示过的，弹出（多个时只弹第一个，其余在成就墙可见） */
    const fresh = achievements.check();
    if (fresh && fresh.length) {
      const first = fresh[0];
      if (!achievements.isShown(first.id)) {
        achievements.markShown(first.id);
        this.setData({ achPopup: first });
      }
    }
  },

  /* 成就弹窗：关闭 */
  closeAchPopup() {
    this.setData({ achPopup: null });
  },

  noop() {},

  /* 成就弹窗：分享我的进度 → share 页（Step4 已就绪） */
  goShareFromAch() {
    this.setData({ achPopup: null });
    wx.navigateTo({ url: '/pages/share/share?type=progress' });
  },

  onToggleResource() {
    this.setData({ resourceExpanded: !this.data.resourceExpanded });
  },

  onResourceOpen() {
    if (this.data.resource && this.data.resource.exists) {
      /* 链接由项目方提供后在此打开；当前均为 pending，提示整理中 */
      wx.showToast({ title: '资源整理中，敬请期待', icon: 'none' });
    } else {
      wx.showToast({ title: '资源整理中，敬请期待', icon: 'none' });
    }
  },

  /* 前后关联 / 下一部 → 跳转该片详情 */
  onGoMovie(e) {
    const id = e.currentTarget.dataset.id;
    if (!id || id === this.data.id) return;
    wx.navigateTo({ url: '/pages/movie/movie?id=' + id });
  },

  /* 主要角色 → 跳转角色详情 */
  onGoChar(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    wx.navigateTo({ url: '/pages/character/character?id=' + id });
  }
});
