/* ============================================================
 * 宇宙节点信息页 movie · V2.3 轻量化
 * ------------------------------------------------------------
 * V2.3 变更（结构性删除，非文案替换）：
 *   - 删除海报、英文片名、内容类型标签
 *   - 删除观看状态卡、标记已看、收藏
 *   - 删除上映日期；「上映顺序」改「宇宙序号」
 *   - 相关作品 → 关联节点（名称 + 所属阶段）
 *   - 新增底部「进入宇宙导航」按钮
 * 定位：MCU 宇宙节点查询/导航页
 * 展示字段仅：中文名、阶段、时间节点、宇宙序号、关联节点
 * 纪律：颜色一律引用 app.wxss 变量，零 raw hex 泄漏
 * ============================================================ */

const mcuData = require('../../models/mcuData.js');
const { PHASE_LABEL } = require('../../data/constants.js');

const REL_MAX = 4;

Page({
  data: {
    id: '',
    cn: '',
    phase: 1,
    phaseText: '',
    year: '',
    infoRows: [],
    relations: [],
    relCount: 0,
    hasRelations: false,
    notFound: false
  },

  onLoad(options) {
    const id = (options && options.id) || '';
    if (!id) { this.setData({ notFound: true }); return; }
    this.setData({ id: id });
    this.refresh();
  },

  onShow() {
    if (this.data.id) this.refresh();
  },

  refresh() {
    const c = mcuData.get(this.data.id);
    if (!c) { this.setData({ notFound: true }); return; }

    /* ── 宇宙节点信息（仅节点维度字段，无影视内容） ── */
    const rows = [
      { k: '时间节点', v: c.year ? (c.year + '年') : '—' },
      { k: 'MCU 阶段', v: PHASE_LABEL[c.phase] || ('第' + c.phase + '阶段') },
      { k: '宇宙序号', v: String(c.ro || '—') }
    ];

    /* ── 关联节点（仅名称 + 所属阶段；点击进入对应节点页） ── */
    const relRaw = mcuData.relationsOf(c.id) || [];
    const relations = relRaw.slice(0, REL_MAX).map(function (r) {
      const other = mcuData.get(r.other);
      return {
        id: r.other,
        cn: other ? other.cn : r.other,
        phaseLabel: other ? (PHASE_LABEL[other.phase || 1] || '') : ''
      };
    });

    this.setData({
      notFound: false,
      cn: c.cn,
      phase: c.phase || 1,
      phaseText: PHASE_LABEL[c.phase] || '',
      year: c.year ? String(c.year) : '',
      infoRows: rows,
      relations: relations,
      relCount: relRaw.length,
      hasRelations: relations.length > 0
    });

    tt.setNavigationBarTitle({ title: c.cn || '宇宙节点' });
  },

  /* ---- 关联节点 → 节点间导航 ---- */
  goRelated(e) {
    const id = e.currentTarget.dataset.id;
    if (!id || id === this.data.id) return;
    tt.redirectTo({ url: '/pages/movie/movie?id=' + id });
  },

  /* ---- 底部：进入宇宙导航（现有路线页） ---- */
  goJourney() {
    tt.switchTab({ url: '/pages/journey/journey' });
  },

  /* ---- 异常兜底 ---- */
  goLibrary() {
    tt.switchTab({ url: '/pages/library/library' });
  }
});
