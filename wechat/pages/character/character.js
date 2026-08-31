// 角色详情 character · V1.1 Step6
// ------------------------------------------------------------
// 数据纪律：
//   - 只读 CHARACTERS / RELATIONS / CONTENT（经 models/mcuData 统一访问）
//   - 首次出现作品 = CHARACTERS.first（数据内置字段）
//   - 关联作品 = mcuData.filmsOfChar(id)（chars 反查，上映序）
//   - 关系探索 = 「共同出演作品」推导（数据零修改）：
//       与该角色共同出现在同一部作品的其它角色，按共同作品数降序取前 6。
//   - 角色头像：首字徽章方案（阵营色），同列表页。
// ============================================================ */
const mcuData = require('../../models/mcuData.js');
const userState = require('../../models/userState.js');
const { CHARACTERS } = require('../../data/characters.js');
const { TYPE_LABEL } = require('../../data/content.js');

const RELATED_LIMIT = 6;

/* 阵营 → 视觉类（严格按设计 §4.4，拒绝 CAMPS 旧 hex；gray=反派/未定义） */
const CAMP_MAP = {
  avengers: { cls: 'red',    label: '复仇者' },
  guardians:{ cls: 'purple', label: '银河护卫队' },
  asgard:   { cls: 'blue',   label: '阿斯加德' },
  wakanda:  { cls: 'gold',   label: '瓦坎达' },
  shield:   { cls: 'blue',   label: '神盾局' },
  mutant:   { cls: 'purple', label: '变种人' },
  villain:  { cls: 'gray',   label: '反派' },
  street:   { cls: 'red',    label: '街头英雄' }
};
function factionOf(camp) { return CAMP_MAP[camp] || { cls: 'gray', label: camp || '未知阵营' }; }

/* 关联角色推导：共同出演作品数降序，取前 N（排除自身） */
function relatedChars(id) {
  const myFilms = {};
  mcuData.filmsOfChar(id).forEach(function (m) { myFilms[m.id] = true; });
  const list = [];
  CHARACTERS.forEach(function (c) {
    if (c.id === id) return;
    const shared = mcuData.filmsOfChar(c.id).filter(function (m) { return myFilms[m.id]; });
    if (shared.length) list.push({ id: c.id, cn: c.cn, camp: c.camp, shared: shared.length });
  });
  list.sort(function (a, b) { return b.shared - a.shared; });
  return list.slice(0, RELATED_LIMIT);
}

Page({
  data: {
    notFound: false,
    char: null,
    faction: null,
    first: null,
    films: [],
    related: []
  },

  onLoad: function (options) {
    const id = options.id || '';
    const char = mcuData.getChar(id);

    if (!char) {
      this.setData({ notFound: true });
      return;
    }

    const f = factionOf(char.camp);
    const faction = { cls: f.cls, label: f.label, ringCls: 'fring-' + f.cls, factionCls: 'fbg-' + f.cls };
    const avatarImg = mcuData.avatar(char.id) || '';   /* V1.2：24 张真实头像；缺失空 → G-19 兜底 */
    const first = mcuData.get(char.first);
    const firstCard = first ? {
      id: first.id, cn: first.cn, en: first.en, phase: first.phase || 1,
      phaseColor: mcuData.phaseColor(first.phase),
      letter: (first.cn || '?').charAt(0),
      poster: (mcuData.visual(first.id).poster) || '',
      posterClass: 'poster-p' + (first.phase || 1),
      typeLabel: TYPE_LABEL[first.type] || ''
    } : null;

    /* 关联作品（上映序，含观看状态） */
    const films = mcuData.filmsOfChar(id).map(function (m) {
      const v = mcuData.visual(m.id);
      return {
        id: m.id, cn: m.cn, en: m.en, phase: m.phase || 1,
        phaseColor: mcuData.phaseColor(m.phase),
        letter: (m.cn || '?').charAt(0),
        poster: (v && v.poster) ? v.poster : '',
        posterClass: 'poster-p' + (m.phase || 1),
        typeLabel: TYPE_LABEL[m.type] || '',
        status: userState.watchState(m.id)
      };
    });

    /* 关系探索：关联角色（真实头像，缺失 G-19 兜底） */
    const related = relatedChars(id).map(function (r) {
      const rf = factionOf(r.camp);
      return {
        id: r.id, cn: r.cn, shared: r.shared,
        avatar: (r.cn || '?').charAt(0),
        avatarImg: mcuData.avatar(r.id) || '',
        factionCls: 'fbg-' + rf.cls,
        ringCls: 'fring-' + rf.cls,
        fcCls: 'fc-' + rf.cls
      };
    });

    wx.setNavigationBarTitle({ title: char.cn.split(' / ')[0] });
    this.setData({
      notFound: false,
      char: {
        id: char.id, cn: char.cn, en: char.en, note: char.note,
        avatar: (char.cn || '?').charAt(0),
        avatarImg: avatarImg
      },
      faction: faction,
      first: firstCard,
      films: films,
      related: related
    });
  },

  goMovie: function (e) {
    wx.navigateTo({ url: '/pages/movie/movie?id=' + e.currentTarget.dataset.id });
  },

  goCharacter: function (e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: '/pages/character/character?id=' + id });
  },

  goBack: function () {
    wx.navigateBack();
  },

  /* 头像远程 URL 加载失败兜底（CDN/网络异常时自动降级到首字徽章，G-19） */
  onImgError: function (e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    const map = this.data._imgErr || {};
    if (map[id]) return;
    map[id] = 1;
    this.setData({ _imgErr: map });
  }
});
