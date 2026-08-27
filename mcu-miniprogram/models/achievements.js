/* ============================================================
 * MCU 宇宙导航（小程序） - 成就数据模型（achievements）
 * ------------------------------------------------------------
 * V1.1 Step5 新增（独立模型，不碰 V1.0 任何数据）
 * 定位：轻量观影纪念，非游戏（无等级/XP/排行榜/竞争机制）
 * 判定：只读 userState（watched/favorite/saved_routes）+ shareData（total）
 * 存储：独立键 mcu_nav_achievements_v1
 *   { gained: [{id, at}], shown: {id: true} }
 *   - gained 已解锁记录；shown 已弹窗提示记录（控制不重复打扰）
 * 禁止修改 mcu_nav_user_v1 / CONTENT / ROUTES / RELATIONS / CHARACTERS / PANO
 * ============================================================ */

const mcuData = require('./mcuData.js');
const userState = require('./userState.js');
const shareData = require('./shareData.js');

const KEY = 'mcu_nav_achievements_v1';

/* ---- 第一版 6 项成就定义（指令四） ----
 * ① 初入漫威：观看第一部 MCU 电影
 * ② 第一阶段完成：Phase 1 核心电影 4 部全看（iron-man/thor/captain-america-first-avenger/avengers）
 *    —— 指令列表含 6 部电影（core4+optional2），括号注明「只统计 4 部核心电影，以当前项目
 *       Phase1 数据实际配置为准」；实测 Phase1 core=4 部（数据模型确认报告已定）
 * ③ 无限传奇探索者：Infinity Saga 23 部电影全看（saga=infinity 实测 23 部，全为电影）
 * ④ 新手入坑完成：新手入坑路线 12 部全看
 * ⑤ 收藏家：收藏数量 ≥ 5
 * ⑥ 分享新人：shareData.total ≥ 1
 * ---- 全部基于现有字段推导，零新增数据字段 ---- */
const ACHIEVEMENTS = [
  {
    id: 'first-step', name: '初入漫威', desc: '观看第一部 MCU 电影',
    icon: '一', group: '里程',
    test: function () { return userState.count() >= 1; }
  },
  {
    id: 'phase-1-done', name: '第一阶段完成', desc: '看完 Phase 1 核心电影（4 部）',
    icon: '壹', group: '阶段',
    test: function () {
      const cores = mcuData.all.filter(function (m) {
        return m.phase === 1 && m.importance === 'core';
      });
      if (!cores.length) return false;
      for (let i = 0; i < cores.length; i++) {
        if (!userState.isSeen(cores[i].id)) return false;
      }
      return true;
    }
  },
  {
    id: 'infinity-explorer', name: '无限传奇探索者', desc: '看完无限传奇 23 部电影',
    icon: '无', group: '阶段',
    test: function () {
      const inf = mcuData.all.filter(function (m) { return m.saga === 'infinity'; });
      if (!inf.length) return false;
      for (let i = 0; i < inf.length; i++) {
        if (!userState.isSeen(inf[i].id)) return false;
      }
      return true;
    }
  },
  {
    id: 'newcomer-done', name: '新手入坑完成', desc: '看完新手入坑路线全部 12 部',
    icon: '新', group: '路线',
    test: function () {
      const route = mcuData.routeById('newcomer');
      const items = route ? mcuData.expandRoute(route) : [];
      if (!items.length) return false;
      for (let i = 0; i < items.length; i++) {
        if (items[i] && !userState.isSeen(items[i].id)) return false;
      }
      return true;
    }
  },
  {
    id: 'collector-5', name: '收藏家', desc: '收藏数量达到 5',
    icon: '藏', group: '探索',
    test: function () { return userState.favIds().length >= 5; }
  },
  {
    id: 'sharer-1', name: '分享新人', desc: '完成首次分享',
    icon: '享', group: '分享',
    test: function () { return (shareData.getStats().total || 0) >= 1; }
  }
];

function readState() {
  try {
    const raw = wx.getStorageSync(KEY);
    if (raw) return raw;
  } catch (e) {}
  return { gained: [], shown: {} };
}

function writeState(s) {
  try { wx.setStorageSync(KEY, s); } catch (e) {}
}

const achievements = {
  /* 定义表（只读） */
  list: ACHIEVEMENTS,

  /* 全部成就 → 带解锁状态（成就墙展示用）
   * 口径：金徽章 = 已记录解锁 或 当前条件已满足（实时判定，历史用户也能看到成就）；
   *       gained 记录用于弹窗去重，展示不依赖是否弹过 */
  all: function () {
    const s = readState();
    const gainedMap = {};
    (s.gained || []).forEach(function (g) { gainedMap[g.id] = true; });
    return ACHIEVEMENTS.map(function (a) {
      return { id: a.id, name: a.name, desc: a.desc, icon: a.icon, group: a.group, gained: !!gainedMap[a.id] || a.test() };
    });
  },

  /* 已解锁成就列表（含时间，仅已记录项） */
  gained: function () {
    return (readState().gained || []).slice();
  },

  /* 已解锁数 / 总数（实时口径，与成就墙一致） */
  progress: function () {
    const s = readState();
    const m = {};
    (s.gained || []).forEach(function (g) { m[g.id] = true; });
    let c = 0;
    ACHIEVEMENTS.forEach(function (a) { if (m[a.id] || a.test()) c++; });
    return { count: c, total: ACHIEVEMENTS.length };
  },

  isGained: function (id) {
    return (readState().gained || []).some(function (g) { return g.id === id; });
  },

  /* 观影完成后检测：返回本次新解锁的成就数组（未解锁且条件满足）；同时写入记录 */
  check: function () {
    const s = readState();
    const gainedMap = {};
    (s.gained || []).forEach(function (g) { gainedMap[g.id] = true; });
    const fresh = [];
    ACHIEVEMENTS.forEach(function (a) {
      if (!gainedMap[a.id] && a.test()) {
        gainedMap[a.id] = true;
        s.gained.push({ id: a.id, at: Date.now() });
        fresh.push({ id: a.id, name: a.name, desc: a.desc, icon: a.icon, group: a.group });
      }
    });
    if (fresh.length) writeState(s);
    return fresh;
  },

  /* 标记成就已提示（弹窗去重：同一成就只弹一次） */
  markShown: function (id) {
    const s = readState();
    s.shown = s.shown || {};
    s.shown[id] = true;
    writeState(s);
  },

  isShown: function (id) {
    const s = readState();
    return !!(s.shown && s.shown[id]);
  },

  /* 成就墙解锁条件提示（未解锁点击时展示） */
  pendingDesc: function (id) {
    const a = ACHIEVEMENTS.find(function (x) { return x.id === id; });
    return a ? a.desc : '';
  }
};

module.exports = achievements;
