// 角色图鉴 characters（角色列表）· V1.1 Step6 + V1.2 P1 收尾
// 数据纪律：
//   - 只读 CHARACTERS / RELATIONS / CONTENT（经 models/mcuData 统一访问，单一可信源）
//   - 关联作品数量 = charAppearances(id).count（从全部内容的 chars 字段反查，不改数据结构）
//   - 头像：mcuData.avatar(id)（visuals 单一来源，24 张已接入 CDN）；缺图 G-19 首字徽章兜底。
//   - 阵营色：design §4.4 映射（禁 CAMPS 旧裸 hex），chip/徽章/胶囊全部走全局 .fc-/.fbg-/.fring-/.pill- 类。
const mcuData = require('../../models/mcuData.js');
const { CHARACTERS, CAMPS } = require('../../data/characters.js');

/* 阵营 → 全局类 cls（design §4.4：红=复仇者/街头 蓝=阿斯加德/神盾 紫=银护/变种人 金=瓦坎达 灰=反派） */
const CAMP_CLS = {
  avengers:  'red',
  street:    'red',
  asgard:    'blue',
  shield:    'blue',
  guardians: 'purple',
  mutant:    'purple',
  wakanda:   'gold',
  villain:   'gray'
};

Page({
  data: {
    totalChars: 0,
    totalCamps: 0,
    campChips: [],     // [{key,label,cls}] 阵营筛选（去内联 hex）
    activeCamp: 'all',
    filtered: [],
    filteredCount: 0
  },

  onLoad: function () {
    const campKeys = Object.keys(CAMPS);
    const campChips = campKeys.map(function (k) {
      return { key: k, label: CAMPS[k].label, cls: CAMP_CLS[k] || 'gray' };
    });
    const chars = CHARACTERS.map(function (c) {
      const first = mcuData.get(c.first);
      const apps = mcuData.charAppearances(c.id);
      const cls = CAMP_CLS[c.camp] || 'gray';
      return {
        id: c.id,
        cn: c.cn,
        en: c.en,
        camp: c.camp,
        note: c.note,
        avatar: (c.cn || '?').charAt(0),
        avatarImg: mcuData.avatar(c.id) || '',
        factionCls: cls,
        factionLabel: CAMPS[c.camp] ? CAMPS[c.camp].label : '',
        count: apps.count,
        firstCn: first ? first.cn : ''
      };
    });
    this.setData({
      totalChars: chars.length,
      totalCamps: campKeys.length,
      campChips: campChips,
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
  },

  /* 头像远程 URL 加载失败兜底（G-19 + R-P0-1：CDN/网络异常时自动降级到首字徽章） */
  onImgError: function (e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    const map = this.data._imgErr || {};
    if (map[id]) return;
    map[id] = 1;
    this.setData({ _imgErr: map });
  }
});
