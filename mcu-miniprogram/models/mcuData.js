/* ============================================================
 * MCU 宇宙导航（小程序） - 数据访问层（mcuData）
 * ------------------------------------------------------------
 * 来源：H5 mcu-navigator/assets/js/app.js 的 MCU.data（唯一可信源，机械适配）
 * 职责：统一读取 CONTENT / RELATIONS / CHARACTERS / ROUTES / PHASE，
 *       对外暴露与 H5 一致的查询接口，页面只与 mcuData 交互。
 * 数据全部来自 data/*.js 模块（单一源），此处只做索引与查询，不产生数据。
 * ============================================================ */

const { CONTENT, TYPE, TYPE_LABEL, IMPORTANCE, IMPORTANCE_LABEL, IMPORTANCE_RANK } = require('../data/content.js');
const { RELATIONS, REL_TYPES } = require('../data/relations.js');
const ROUTES = require('../data/routes.js');
const { CHARACTERS, CAMPS } = require('../data/characters.js');
const { PHASE } = require('../data/constants.js');
const { PANO_CONN } = require('./pano.js');
const visuals = require('../data/visuals.js');

/* ---- 索引 ---- */
const byId = {};
CONTENT.forEach(function (m) { byId[m.id] = m; });

const charById = {};
CHARACTERS.forEach(function (c) { charById[c.id] = c; });

const byRelease = CONTENT.slice().sort(function (a, b) { return a.ro - b.ro; });
const byChrono = CONTENT.slice().sort(function (a, b) { return a.co - b.co; });

/* 邻接表：每部内容 -> 所有与它相连的边（含反向） */
const adj = {};
CONTENT.forEach(function (m) { adj[m.id] = []; });
RELATIONS.forEach(function (r) {
  if (adj[r.from]) adj[r.from].push({ other: r.to, type: r.type, weight: r.weight, why: r.why });
  if (adj[r.to])   adj[r.to].push({ other: r.from, type: r.type, weight: r.weight, why: r.why });
});

/* 全景连接邻接表（PANO_CONN → 前驱/后继，标记是否主线边） */
const panoAdj = { pred: {}, succ: {} };
PANO_CONN.forEach(function (e) {
  if (!panoAdj.succ[e[0]]) panoAdj.succ[e[0]] = [];
  if (!panoAdj.pred[e[1]]) panoAdj.pred[e[1]] = [];
  panoAdj.succ[e[0]].push({ other: e[1], main: e[2] === 'mainline' });
  panoAdj.pred[e[1]].push({ other: e[0], main: e[2] === 'mainline' });
});

/* 三视图：core=主线必看, recommended=推荐观看, all=完整宇宙 */
const VIEW_MODES = {
  core:        { label: '主线必看', desc: '必看内容，剧情不中断', imps: ['core'] },
  recommended: { label: '推荐观看', desc: '必看 + 推荐，补齐关键支线', imps: ['core', 'recommended'] },
  all:         { label: '完整宇宙', desc: '电影 / 剧集 / 特别呈现 / 短片全收录', imps: ['core', 'recommended', 'optional'] }
};

function impOK(item, imps) { return imps.indexOf(item.importance) !== -1; }

const state = { viewMode: 'all', typeFilter: null };

function counts() {
  const c = { movie: 0, series: 0, special: 0, short: 0 };
  CONTENT.forEach(function (x) { if (c[x.type] != null) c[x.type]++; });
  return c;
}

const data = {
  all: CONTENT,
  byRelease: byRelease,
  byChrono: byChrono,
  routes: ROUTES,
  types: REL_TYPES,
  typeLabel: TYPE_LABEL,
  impLabel: IMPORTANCE_LABEL,
  viewModes: VIEW_MODES,
  counts: counts,

  get state() { return state; },
  setView: function (v) { if (VIEW_MODES[v]) state.viewMode = v; },
  setTypeFilter: function (t) { state.typeFilter = (t || null); },
  viewLabel: function () { return (VIEW_MODES[state.viewMode] || VIEW_MODES.all).label; },

  /* 按当前视图 + 类型过滤后的内容（三视图的核心出口） */
  filtered: function () {
    const vm = VIEW_MODES[state.viewMode] || VIEW_MODES.all;
    return CONTENT.filter(function (c) {
      if (!impOK(c, vm.imps)) return false;
      if (state.typeFilter && c.type !== state.typeFilter) return false;
      return true;
    });
  },

  get: function (id) { return byId[id] || null; },
  getChar: function (id) { return charById[id] || null; },

  /* 角色「出现作品数量」：从全部内容的 chars 反查（电影/剧集/特别呈现/短片都算），
     不改动 characters 结构。返回 { list: [content...], count: n }。 */
  charAppearances: function (id) {
    if (!id) return { list: [], count: 0 };
    const list = CONTENT.filter(function (c) {
      return c.chars && c.chars.indexOf(id) >= 0;
    });
    return { list: list, count: list.length };
  },

  /* 与某内容相关的全部关系，按强度降序 */
  relationsOf: function (id) {
    return (adj[id] || []).slice().sort(function (a, b) { return b.weight - a.weight; });
  },

  /* 按上映顺序的前一部 / 后一部 */
  prevByRelease: function (id) {
    const m = byId[id]; if (!m) return null;
    return byRelease[m.ro - 2] || null;
  },
  nextByRelease: function (id) {
    const m = byId[id]; if (!m) return null;
    return byRelease[m.ro] || null;
  },

  /* 前后关联（观影位置）：以 PANO_CONN 为权威连接图，
   * 取 mainline 边优先、上映序最接近当前片的单一前驱/后继。
   * 前驱：to===id 的边，取 mainline 优先 + ro 最大；
   * 后继：from===id 的边，取 mainline 优先 + ro 最小。
   * 无对应边返回 null（页面渲染为占位）。 */
  panoNeighbors: function (id) {
    function pick(arr, dir) {
      if (!arr || !arr.length) return null;
      const nodes = arr.map(function (a) {
        const m = byId[a.other];
        return m ? { id: a.other, ro: m.ro, main: a.main } : null;
      }).filter(Boolean);
      if (!nodes.length) return null;
      nodes.sort(function (a, b) {
        if (a.main !== b.main) return a.main ? -1 : 1;
        return dir === 'prev' ? (b.ro - a.ro) : (a.ro - b.ro);
      });
      return byId[nodes[0].id];
    }
    return { prev: pick(panoAdj.pred[id], 'prev'), next: pick(panoAdj.succ[id], 'next') };
  },

  /* 展开一条路线为内容数组 */
  expandRoute: function (route) {
    if (route.items && route.items.length) {
      return route.items.map(function (id) { return byId[id]; }).filter(Boolean);
    }
    if (route.generator === 'release')  return byRelease.slice();
    if (route.generator === 'chrono')   return byChrono.slice();
    if (route.generator === 'mainline') return byRelease.filter(function (m) { return m.importance === 'core' || m.mainline; });
    if (route.generator === 'essential') return byRelease.filter(function (m) { return m.importance === 'core' || m.importance === 'recommended'; });
    return [];
  },

  routeById: function (id) {
    for (let i = 0; i < ROUTES.length; i++) if (ROUTES[i].id === id) return ROUTES[i];
    return null;
  },

  /* 阶段色：返回 hex 色值（H5 返回 CSS 变量，小程序直接用 constants 权威色值） */
  phaseColor: function (p) {
    return (p && p >= 1 && p <= 6) ? PHASE[p] : '#7A8296';
  },

  /* 统一视觉入口：页面只调用 data.*，不直接读图片 URL（禁硬编码） */
  visual: function (id) {
    return visuals.visual(id);
  },

  /* 角色头像（V1.2 资源接入：24 张本地，缺失返回 null → 前端 G-19 兜底） */
  avatar: function (charId) {
    return visuals.avatar(charId);
  },

  /* 首页背景图（V1.2 资源接入：home-bg.jpg 本地） */
  homeBg: function () {
    return visuals.homeBg();
  },

  /* 该角色出现过的作品（由 chars 反查） */
  filmsOfChar: function (charId) {
    return byRelease.filter(function (m) {
      return m.chars && m.chars.indexOf(charId) !== -1;
    });
  }
};

module.exports = data;
