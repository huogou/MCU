// 关系探索 explore（Tab3） - V1.1 Step6 角色主页：入口聚合页
// 变更记录：
//   - Step3-7-C 恢复：角色网格内联展开（toggleChar/renderFilms）
//   - V1.1 Step6：角色详情收归独立页面（pages/character），
//     本页角色卡片点击 → 跳转角色详情；新增「角色图鉴」全量入口。
const mcuData = require('../../models/mcuData.js');
const { CHARACTERS, CAMPS } = require('../../data/characters.js');

Page({
  data: {
    chars: [],
    camps: CAMPS,
    totalChars: CHARACTERS.length
  },

  onLoad: function () {
    const chars = CHARACTERS.map(function (c) {
      const first = mcuData.get(c.first);
      return {
        id: c.id, cn: c.cn, en: c.en, camp: c.camp, note: c.note,
        firstCn: first ? first.cn : ''
      };
    });
    this.setData({ chars: chars, totalChars: CHARACTERS.length });
  },

  goPano: function () {
    wx.navigateTo({ url: '/pages/panorama/panorama' });
  },

  /* 角色图鉴（全量列表） */
  goCharacters: function () {
    wx.navigateTo({ url: '/pages/characters/characters' });
  },

  /* 热门角色 → 角色详情页 */
  goCharacter: function (e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: '/pages/character/character?id=' + id });
  }
});
