/* ============================================================
 * 首页 home（Tab1）· V2.0.0 轻量版重构
 * ------------------------------------------------------------
 * 结构（5 层）：
 *   ① 进度 Hero（数据型，非影视背景图）
 *   ② 核心入口 2×2（首次观看/继续观看/观看路线/宇宙关系→H5）
 *   ③ 下一步建议（仅顺序逻辑，无剧情推荐理由）
 *   ④ 最近标记（横滚，工具属性）
 *   ⑤ H5 引导（工具型引导卡，非影视推广 Banner）
 *
 * V2.0 变更：
 *   - 删除 heroBanner 影视背景图 → 改为数据型进度卡
 *   - 删除 rec-reason 推荐理由（禁止剧情推荐）
 *   - 新增 4 个核心入口（含宇宙关系→H5 引导）
 *   - 新增 H5 引导卡
 * ============================================================ */

const mcuData = require('../../models/mcuData.js');
const userState = require('../../models/userState.js');
const recommend = require('../../models/recommend.js');
const { PHASE_LABEL } = require('../../data/constants.js');

const RECENT_MAX = 6;

/* 电影视图模型（精简：仅工具型字段） */
function movieVM(id) {
  const m = mcuData.get(id);
  if (!m) return null;
  const v = mcuData.visual(id);
  const phaseNo = m.phase || 1;
  return {
    id: m.id,
    poster: (v && v.poster) ? v.poster : null,
    name: m.cn,
    enName: m.en || '',
    phase: phaseNo,
    phaseText: PHASE_LABEL[phaseNo] || '',
    year: m.year ? String(m.year) : '',
    initial: m.cn.charAt(0),
    typeLabel: mcuData.typeLabel[m.type] || '作品',
    typeKey: m.type,
    ro: m.ro
  };
}

Page({
  data: {
    /* ① 进度 Hero */
    progressPercent: 0,
    progressCount: 0,
    progressTotal: 0,
    phaseText: '',
    hasProgress: false,

    /* ② 核心入口 */
    entries: [],

    /* ③ 下一步 */
    nextStep: null,

    /* ④ 最近标记 */
    recent: [],

    /* ⑤ H5 引导 */
    h5Guide: {
      title: '想深入探索 MCU 宇宙？',
      desc: '查看完整宇宙关系'
    }
  },

  onShow() { this.refresh(); },

  refresh() {
    const count = userState.count();
    const total = mcuData.all.length;
    const hasProgress = count > 0;
    const state = userState.getState();
    const watched = state.watched || {};
    const latest = userState.latest();

    const progressPercent = total > 0 ? Math.min(100, Math.round(count / total * 100)) : 0;

    /* ② 核心入口装配 */
    let continueMovie = null;
    let firstWatch = movieVM('iron-man');

    if (hasProgress && latest) {
      /* 继续观看 = 下一部未看的作品 */
      const r = recommend.next(latest.id, 'mainline');
      if (r && r.content) continueMovie = movieVM(r.content.id);
    }
    if (!continueMovie && hasProgress) {
      /* fallback：取上映序下一个未看的 */
      const byRelease = mcuData.byRelease;
      for (let i = 0; i < byRelease.length; i++) {
        if (!userState.isSeen(byRelease[i].id)) {
          continueMovie = movieVM(byRelease[i].id);
          break;
        }
      }
    }

    const entries = [
      {
        key: 'first',
        icon: '1',
        iconColor: 'gold',
        title: '第一次观看',
        desc: '从《钢铁侠》开始',
        action: 'navigate',
        targetId: 'iron-man'
      },
      {
        key: 'continue',
        icon: '▶',
        iconColor: 'green',
        title: '继续观看',
        desc: continueMovie
          ? '第 ' + continueMovie.ro + ' 部 · ' + continueMovie.name
          : '开始你的旅程',
        action: continueMovie ? 'navigate' : 'none',
        targetId: continueMovie ? continueMovie.id : ''
      },
      {
        key: 'journey',
        icon: '≡',
        iconColor: 'blue',
        title: '观看路线',
        desc: '上映顺序 / 主线必看',
        action: 'switchTab',
        targetUrl: '/pages/journey/journey'
      },
      {
        key: 'universe',
        icon: '◈',
        iconColor: 'orange',
        title: '宇宙关系',
        desc: '前往 H5 →',
        action: 'h5'
      }
    ];

    /* ③ 下一步（仅顺序逻辑，无推荐理由） */
    let nextStep = null;
    if (continueMovie) {
      const seen = userState.isSeen(continueMovie.id);
      nextStep = {
        id: continueMovie.id,
        order: '第 ' + continueMovie.ro + ' 部',
        name: continueMovie.name,
        typeLabel: continueMovie.typeLabel,
        typeKey: continueMovie.typeKey,
        phaseText: continueMovie.phaseText,
        poster: continueMovie.poster,
        initial: continueMovie.initial,
        phase: continueMovie.phase,
        watched: seen
      };
    }

    /* ④ 最近标记 */
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

    /* 进度 Hero 阶段文案 */
    let phaseText = '';
    if (hasProgress && latest) {
      phaseText = PHASE_LABEL[latest.phase] || '';
    } else {
      phaseText = '尚未开始';
    }

    this.setData({
      progressPercent: progressPercent,
      progressCount: count,
      progressTotal: total,
      phaseText: phaseText,
      hasProgress: hasProgress,
      entries: entries,
      nextStep: nextStep,
      recent: recent
    });
  },

  /* ---- 入口点击 ---- */
  onEntry(e) {
    const entry = this.data.entries.find(x => x.key === e.currentTarget.dataset.key);
    if (!entry || entry.action === 'none') return;
    if (entry.action === 'navigate') {
      tt.navigateTo({ url: '/pages/movie/movie?id=' + entry.targetId });
    } else if (entry.action === 'switchTab') {
      tt.switchTab({ url: entry.targetUrl });
    } else if (entry.action === 'h5') {
      this.goH5();
    }
  },

  /* ---- 下一步 → 作品节点页 ---- */
  goDetail(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    tt.navigateTo({ url: '/pages/movie/movie?id=' + id });
  },

  /* ---- 进度 Hero → 路线页 ---- */
  goJourney() {
    tt.switchTab({ url: '/pages/journey/journey' });
  },

  /* ---- H5 引导（V2.0.0 真机修复：弹窗回调内复制会 fail，收敛到 h5Link 直调） ---- */
  goH5() {
    require('../../models/h5Link.js').copy();
  }
});
