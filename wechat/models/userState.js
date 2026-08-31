/* ============================================================
 * MCU 宇宙导航（小程序） - 用户状态模型（userState）
 * ------------------------------------------------------------
 * 来源：H5 mcu-navigator/assets/js/app.js 的 MCU.progress（机械适配）
 * 迁移：H5 localStorage key = 'mcu_nav_user_v1' → wx.storage（游客免登录）
 * 保持字段兼容：
 *   watched         { contentId: timestamp }  已看
 *   want_to_watch   { contentId: timestamp }  想看
 *   favorite        { contentId: timestamp }  收藏
 *   saved_routes    [ { id, routeId, createdAt, currentIndex, note } ]  保存路线
 *   last_watched    contentId                 最后观看
 *   current_route   savedRouteId              当前进行中的保存路线
 *   current_content contentId                 当前看到的内容
 *   milestones_shown {}                       里程碑已提示记录
 * isSeen 向后兼容 V1 的 seen 语义。
 * ============================================================ */

const KEY = 'mcu_nav_user_v1';
const LEGACY_KEY = 'mcu_nav_seen_v1';
const mcuData = require('./mcuData.js');

function _uid() {
  return 'r_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
}

function readState() {
  try {
    const raw = wx.getStorageSync(KEY);
    if (raw) return raw;
  } catch (e) {}
  /* 兼容 V1 旧数据（H5 同步迁移场景）：迁移到 watched */
  try {
    const leg = wx.getStorageSync(LEGACY_KEY);
    if (leg) {
      const old = leg;
      const migrated = { watched: old || {}, want_to_watch: {}, favorite: {}, saved_routes: [], milestones_shown: {} };
      const ids = Object.keys(old || {});
      if (ids.length) migrated.last_watched = ids.sort(function (a, b) { return old[b] - old[a]; })[0];
      wx.setStorageSync(KEY, migrated);
      return migrated;
    }
  } catch (e) {}
  return { watched: {}, want_to_watch: {}, favorite: {}, saved_routes: [], milestones_shown: {} };
}

function writeState(state) {
  try { wx.setStorageSync(KEY, state); } catch (e) {}
}

function touch(state) {
  writeState(state);
  return state;
}

function markWatched(state, id) {
  state.watched[id] = Date.now();
  state.last_watched = id;
  state.current_content = id;
}
function unmarkWatched(state, id) {
  delete state.watched[id];
  if (state.last_watched === id) state.last_watched = null;
  if (state.current_content === id) state.current_content = null;
}

const progress = {
  /* ---- 已看（向后兼容 V1 的 seen 语义）---- */
  isSeen: function (id) { return !!readState().watched[id]; },
  toggle: function (id) {
    const s = readState();
    if (s.watched[id]) unmarkWatched(s, id); else markWatched(s, id);
    touch(s);
    return !!s.watched[id];
  },
  count: function () { return Object.keys(readState().watched).length; },
  total: function () { return mcuData.all.length; },
  seenIds: function () { return Object.keys(readState().watched); },
  clear: function () { writeState({ watched: {}, want_to_watch: {}, favorite: {}, saved_routes: [], milestones_shown: {} }); },

  /* 观看三态判定（D10-A：未观看 / 正在观看 / 已观看）
   * 已看优先；其次「想看」视为进行中；否则未看。
   * 注：原小程序实现细节未留存，此为按 D10-A 语义的恢复实现，待策划确认。 */
  watchState: function (id) {
    const s = readState();
    if (s.watched && s.watched[id]) return 'watched';
    if (s.want_to_watch && s.want_to_watch[id]) return 'watching';
    return 'unwatched';
  },

  /* 「我的 MCU 旅程」里程碑（5/10/20 部）。每个最多出现一次，
     用状态里的 milestones_shown 记录已提示过的节点，避免频繁打扰。 */
  MILESTONES: [5, 10, 20],
  checkMilestone: function () {
    const s = readState();
    const c = Object.keys(s.watched).length;
    const shown = s.milestones_shown || {};
    const TEXTS = {
      5:  { title: '你的 MCU 旅程已经开始了', desc: '已看 5 部，保存进度，下次继续。' },
      10: { title: '你已经走过 MCU 的一段旅程', desc: '保存观影进度，换设备也能继续。' },
      20: { title: '你的 MCU 旅程已经走得很远了', desc: '保存进度和路线，继续从这里出发。' }
    };
    for (let i = 0; i < this.MILESTONES.length; i++) {
      const n = this.MILESTONES[i];
      if (c >= n && !shown[n]) {
        shown[n] = true;
        s.milestones_shown = shown;
        touch(s);
        return { n: n, title: TEXTS[n].title, desc: TEXTS[n].desc };
      }
    }
    return null;
  },

  /* 已看内容里上映时间最晚的那部，用于首页"继续观看" */
  latest: function () {
    const ids = Object.keys(readState().watched);
    if (!ids.length) return null;
    const list = ids.map(function (i) { return mcuData.get(i); }).filter(Boolean);
    list.sort(function (a, b) { return b.ro - a.ro; });
    return list[0] || null;
  },

  /* ---- 想看 ---- */
  isWanted: function (id) { return !!readState().want_to_watch[id]; },
  want: function (id) {
    const s = readState(); s.want_to_watch[id] = Date.now(); touch(s);
    return true;
  },
  unwant: function (id) {
    const s = readState(); delete s.want_to_watch[id]; touch(s);
    return false;
  },
  toggleWant: function (id) { return this.isWanted(id) ? this.unwant(id) : this.want(id); },
  wantedIds: function () { return Object.keys(readState().want_to_watch); },

  /* ---- 收藏 ---- */
  isFav: function (id) { return !!readState().favorite[id]; },
  favorite: function (id) {
    const s = readState(); s.favorite[id] = Date.now(); touch(s);
    return true;
  },
  unfavorite: function (id) {
    const s = readState(); delete s.favorite[id]; touch(s);
    return false;
  },
  toggleFav: function (id) { return this.isFav(id) ? this.unfavorite(id) : this.favorite(id); },
  favIds: function () { return Object.keys(readState().favorite); },

  /* ---- 保存路线 ---- */
  saveRoute: function (routeId, note) {
    const s = readState();
    const item = { id: _uid(), routeId: routeId, createdAt: Date.now(), currentIndex: 0, note: note || '' };
    s.saved_routes.push(item);
    s.current_route = item.id;
    touch(s);
    return item;
  },
  unsaveRoute: function (savedId) {
    const s = readState();
    s.saved_routes = (s.saved_routes || []).filter(function (x) { return x.id !== savedId; });
    if (s.current_route === savedId) s.current_route = null;
    touch(s);
  },
  savedRoutes: function () { return (readState().saved_routes || []).slice(); },
  getSavedRoute: function (savedId) {
    return (readState().saved_routes || []).find(function (x) { return x.id === savedId; }) || null;
  },
  updateRouteIndex: function (savedId, index) {
    const s = readState();
    const r = (s.saved_routes || []).find(function (x) { return x.id === savedId; });
    if (r) { r.currentIndex = index; touch(s); return r; }
    return null;
  },
  setCurrentRoute: function (savedId) { const s = readState(); s.current_route = savedId; touch(s); },
  getCurrentRoute: function () { return readState().current_route; },

  /* ---- 当前内容（继续观看）---- */
  setCurrentContent: function (id) { const s = readState(); s.current_content = id; touch(s); },
  getCurrentContent: function () { return readState().current_content; },

  /* ---- 原始状态读写（迁移/同步用）---- */
  getState: function () { return readState(); },
  setState: function (obj) { writeState(obj); }
};

module.exports = progress;
