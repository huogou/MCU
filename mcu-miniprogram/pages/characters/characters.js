// 角色图鉴 characters（角色列表）· V1.1 Step6
// 数据纪律：
//   - 只读 CHARACTERS / RELATIONS / CONTENT（经 models/mcuData 统一访问，单一可信源）
//   - 关联作品数量 = charAppearances(id).count（从全部内容的 chars 字段反查，不改数据结构）
//   - 角色头像：数据层无角色图片资源（visuals 仅海报/剧照且当前为空），
//     采用「首字徽章」视觉方案（阵营色圆形徽章 + 中文名首字），不引入第二套数据。
const mcuData = require('../../models/mcuData.js');
const { CHARACTERS, CAMPS } = require('../../data/characters.js');

Page({
  data: {
    totalChars: 0,
    totalCamps: 0,
    camps: CAMPS,
    campKeys: [],
    activeCamp: 'all',
    filtered: [],
    filteredCount: 0
  },

  onLoad: function () {
    const campKeys = Object.keys(CAMPS);
    const chars = CHARACTERS.map(function (c) {
      const first = mcuData.get(c.first);
      const apps = mcuData.charAppearances(c.id);
      return {
        id: c.id,
        cn: c.cn,
        en: c.en,
        camp: c.camp,
        note: c.note,
        avatar: (c.cn || '?').charAt(0),
        count: apps.count,
        firstCn: first ? first.cn : ''
      };
    });
    this.setData({
      totalChars: chars.length,
      totalCamps: campKeys.length,
      campKeys: campKeys,
      _all: chars
    });
    this.applyFilter('all');
  },

  applyFilter: function (camp) {
    const all = this.data._all || [];
    const filtered = camp === 'all'
      ? all
      : all.filter(function (c) { return c.camp === camp; });
    this.setData({ activeCamp: camp, filtered: filtered, filteredCount: filtered.length });
  },

  tapCamp: function (e) {
    this.applyFilter(e.currentTarget.dataset.camp);
  },

  goCharacter: function (e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: '/pages/character/character?id=' + id });
  }
});
