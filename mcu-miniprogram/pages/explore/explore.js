/* ============================================================
 * 关系探索 explore（Tab3）· V1.2 完整重做（P0④）
 * ------------------------------------------------------------
 * 依据：《MCU-V1.2-关系探索页视觉方案》（QoderWork CN 2026-08-26）
 * 定位：从 V1.1「入口聚合页」→「MCU 角色关系网络探索」
 * 核心：关系类型筛选 Chips + 关系对卡片（双头像 + 关系类型 + 共同出演数）
 *
 * 数据纪律（铁律）：
 *   - CHARACTERS / RELATIONS / CAMPS 数据模型零改动
 *   - 关系对全部在视图层派生（同阵营盟友 + 跨阵营高频共现对手
 *     + 预定义特殊关系表），不改任何数据文件
 *   - 角色头像经 visuals.avatar(id)（缺失 null → G-19 首字兜底）
 *   - 阵营色用 §4.4 映射（.fc-/.fbg-/.fring-/.pill- 全局类），零裸 hex
 *
 * 跳转保留：goPano / goCharacters / goCharacter（与 V1.1 一致）
 * ============================================================ */

const mcuData = require('../../models/mcuData.js');
const { CHARACTERS } = require('../../data/characters.js');
const visuals = require('../../data/visuals.js');

/* ---- 阵营 → 色类 + 标签（设计 §4.4，与 movie/character 页一致） ---- */
const CAMP_MAP = {
  avengers:  { cls: 'red',    label: '复仇者' },
  asgard:    { cls: 'blue',   label: '阿斯加德' },
  guardians: { cls: 'purple', label: '银河护卫队' },
  wakanda:   { cls: 'gold',   label: '瓦坎达' },
  shield:    { cls: 'blue',   label: '神盾局' },
  mutant:    { cls: 'purple', label: '变种人' },
  villain:   { cls: 'gray',   label: '反派' },
  street:    { cls: 'red',    label: '街头英雄' }
};
function campOf(camp) { return CAMP_MAP[camp] || { cls: 'gray', label: camp || '' }; }

/* ---- 关系类型 → 标签 + 色类（方案 §3.3 / §5.2） ---- */
const REL_TYPE_MAP = {
  ally:   { label: '盟友', cls: 'rel-ally' },
  enemy:  { label: '敌人', cls: 'rel-enemy' },
  mentor: { label: '师徒', cls: 'rel-mentor' },
  family: { label: '家人', cls: 'rel-family' },
  rival:  { label: '对手', cls: 'rel-rival' }
};

/* ---- 筛选 chips（方案 §3.3，6 种，单选） ---- */
const FILTERS = [
  { key: 'all', label: '全部' },
  { key: 'ally', label: '盟友' },
  { key: 'enemy', label: '敌人' },
  { key: 'mentor', label: '师徒' },
  { key: 'family', label: '家人' },
  { key: 'rival', label: '对手' }
];

/* ---- 预定义特殊关系（方案 §4.2，9 对，优先于阵营推断） ---- */
const SPECIAL_RELATIONS = [
  { from: 'tony',    to: 'peter',   type: 'mentor' },
  { from: 'strange', to: 'wanda',   type: 'rival' },
  { from: 'thanos',  to: 'gamora',  type: 'family' },
  { from: 'thanos',  to: 'tony',    type: 'enemy' },
  { from: 'steve',   to: 'bucky',   type: 'family' },
  { from: 'thor',    to: 'loki',    type: 'family' },
  { from: 'natasha', to: 'clint',   type: 'ally' },
  { from: 'wade',    to: 'logan',   type: 'rival' },
  { from: 'tchalla', to: 'starlord',type: 'rival' }
];

/* ---- 视图层派生工具 ---- */

/* 角色对唯一 key（双向同 key） */
function pairKey(a, b) { return a < b ? a + '|' + b : b + '|' + a; }

/* 角色英雄名：cn '托尼·斯塔克 / 钢铁侠' → '钢铁侠'（无 '/' 用全名） */
function heroOf(cn) {
  if (!cn) return '';
  const parts = cn.split(' / ');
  return (parts.length > 1 ? parts[1] : cn).trim();
}

/* 共同出演数：两角色同时出现的作品数（经 mcuData.filmsOfChar 反查，只读） */
function coCount(aId, bId) {
  const fa = mcuData.filmsOfChar(aId);
  const fb = mcuData.filmsOfChar(bId);
  if (!fa.length || !fb.length) return 0;
  const setB = {};
  fb.forEach(function (f) { setB[f.id] = true; });
  return fa.filter(function (f) { return setB[f.id]; }).length;
}

/* 组装一张关系对卡片（零裸 hex：色一律经全局类） */
function makePair(aId, bId, type, count, special) {
  const A = mcuData.getChar(aId);
  const B = mcuData.getChar(bId);
  if (!A || !B) return null;
  const aCamp = campOf(A.camp);
  const bCamp = campOf(B.camp);
  const rel = REL_TYPE_MAP[type] || REL_TYPE_MAP.ally;
  return {
    key: pairKey(aId, bId),
    relType: type,
    relLabel: rel.label,
    relCls: rel.cls,
    coCount: count,
    special: !!special,
    fromId: A.id, fromFirst: (heroOf(A.cn) || A.cn).charAt(0),
    fromAvatar: visuals.avatar(A.id) || '',
    fromCn: heroOf(A.cn), fromEn: A.en,
    fromCampCls: aCamp.cls, fromCampLabel: aCamp.label,
    toId: B.id, toFirst: (heroOf(B.cn) || B.cn).charAt(0),
    toAvatar: visuals.avatar(B.id) || '',
    toCn: heroOf(B.cn), toEn: B.en,
    toCampCls: bCamp.cls, toCampLabel: bCamp.label
  };
}

/* 派生全部关系对（方案 §4：SPECIAL 优先 → 同阵营盟友 → 跨阵营 3+ 共演对手） */
function derivePairs() {
  const pairs = [];
  const usedKeys = {};

  /* 1. 预定义特殊关系（9 对，置顶） */
  SPECIAL_RELATIONS.forEach(function (p) {
    const k = pairKey(p.from, p.to);
    usedKeys[k] = true;
    const card = makePair(p.from, p.to, p.type, coCount(p.from, p.to), true);
    if (card) pairs.push(card);
  });

  /* 2. 同阵营 = 盟友（有共同出演才算"并肩作战"；每阵营按共演数取 top 4，控制列表体量） */
  const campGroups = {};
  CHARACTERS.forEach(function (c) {
    (campGroups[c.camp] = campGroups[c.camp] || []).push(c.id);
  });
  Object.keys(campGroups).forEach(function (camp) {
    const ids = campGroups[camp];
    const cands = [];
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const k = pairKey(ids[i], ids[j]);
        if (usedKeys[k]) continue;
        const n = coCount(ids[i], ids[j]);
        if (n >= 1) cands.push({ a: ids[i], b: ids[j], n: n, k: k });
      }
    }
    cands.sort(function (x, y) { return y.n - x.n; });
    cands.slice(0, 4).forEach(function (cand) {
      usedKeys[cand.k] = true;
      const card = makePair(cand.a, cand.b, 'ally', cand.n, false);
      if (card) pairs.push(card);
    });
  });

  /* 3. 跨阵营高频共现（≥3 部）= 对手（排除 SPECIAL） */
  const cross = [];
  for (let i = 0; i < CHARACTERS.length; i++) {
    for (let j = i + 1; j < CHARACTERS.length; j++) {
      const a = CHARACTERS[i], b = CHARACTERS[j];
      if (a.camp === b.camp) continue;
      const k = pairKey(a.id, b.id);
      if (usedKeys[k]) continue;
      const n = coCount(a.id, b.id);
      if (n >= 3) cross.push({ a: a.id, b: b.id, n: n, k: k });
    }
  }
  cross.sort(function (x, y) { return y.n - x.n; });
  cross.slice(0, 6).forEach(function (cand) {
    const card = makePair(cand.a, cand.b, 'rival', cand.n, false);
    if (card) pairs.push(card);
  });

  /* 排序：SPECIAL 置顶 → 共同出演数降序 */
  pairs.sort(function (x, y) {
    if (x.special !== y.special) return x.special ? -1 : 1;
    return y.coCount - x.coCount;
  });
  return pairs;
}

Page({
  data: {
    totalChars: CHARACTERS.length,
    filters: FILTERS,
    activeFilter: 'all',
    pairs: []
  },

  onLoad: function () {
    this.allPairs = derivePairs();
    this.setData({ pairs: this.allPairs, totalChars: CHARACTERS.length });
  },

  /* 筛选 chips：单选实时过滤（P0 验收项） */
  onFilter: function (e) {
    const key = e.currentTarget.dataset.key || 'all';
    const pairs = key === 'all'
      ? this.allPairs
      : this.allPairs.filter(function (p) { return p.relType === key; });
    this.setData({ activeFilter: key, pairs: pairs });
  },

  /* 入口：宇宙全景图（保留） */
  goPano: function () {
    wx.navigateTo({ url: '/pages/panorama/panorama' });
  },

  /* 入口：角色图鉴（保留） */
  goCharacters: function () {
    wx.navigateTo({ url: '/pages/characters/characters' });
  },

  /* 关系对卡片点击 → 角色详情（左右角色各自可点） */
  goCharacter: function (e) {
    const id = e.currentTarget.dataset.id;
    if (id) wx.navigateTo({ url: '/pages/character/character?id=' + id });
  }
});
