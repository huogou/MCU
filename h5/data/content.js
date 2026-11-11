/* ============================================================
 * MCU 宇宙导航 - 内容模型合成器（CONTENT）
 * ------------------------------------------------------------
 * 本文件把四类内容合并为统一的「MCU 内容（Content）」：
 *   电影(movie) + 剧集(series) + 特别呈现(special) + 短片(short)
 *
 * 设计要点：
 *   - 不直接改动 movies.js，只在此处为电影派生 type/importance，
 *     保持数据文件「只增字段、不改 id」的纪律。
 *   - 全局上映序(ro / order) 与故事时间线序(co / tl) 在此统一重算，
 *     两者严格分离、绝不混用：
 *       ro = order = 上映/上线顺序（按发布日期）
 *       co = tl    = 故事发生时间线（按剧情年代）
 *     电影与剧集在同一套序号下排序（发布日期来自官方时间线）。
 *   - 类型/重要度常量为全局唯一来源，设计 AI 的 V1.1 同名常量保持一致。
 *
 * 加载顺序：须在其他 data/*.js 之后、app.js 之前加载。
 * ============================================================ */

/* —— 类型常量（与设计 AI V1.1 命名一致）—— */
window.MCU_TYPE = { MOVIE: 'movie', SERIES: 'series', SPECIAL: 'special', SHORT: 'short' };
window.MCU_TYPE_LABEL = { movie: '电影', series: '剧集', special: '特别呈现', short: '短片' };

/* —— 重要度常量（必看/推荐/可选）——
 * 电影：mainline → core；starter → recommended；其余 → optional。
 * 剧集/特别篇/短片：各自数据文件已标 importance，原样保留。 */
window.MCU_IMPORTANCE = { CORE: 'core', RECOMMENDED: 'recommended', OPTIONAL: 'optional' };
window.MCU_IMPORTANCE_LABEL = { core: '必看', recommended: '推荐', optional: '可选观看' };
window.MCU_IMPORTANCE_RANK = { core: 0, recommended: 1, optional: 2 };

(function () {
  var MOVIES  = window.MCU_MOVIES  || [];
  var SERIES  = window.MCU_SERIES  || [];
  var SPECIAL = window.MCU_SPECIAL || [];
  var SHORT   = window.MCU_SHORT   || [];

  /* 电影派生 type/importance（不动源文件） */
  var movies = MOVIES.map(function (m) {
    var imp = m.mainline ? 'core' : (m.starter ? 'recommended' : 'optional');
    var copy = {};
    for (var k in m) if (m.hasOwnProperty(k)) copy[k] = m[k];
    copy.type = 'movie';
    copy.importance = imp;
    return copy;
  });

  var content = movies.concat(SERIES, SPECIAL, SHORT);

  /* ---- 第十四条：来源元数据统一注入 ----
   * 所有内容的基础数据均来自 Marvel 官方 Complete MCU Timeline（2026-06-02 发布），
   * 关键日期与阶段经维基百科交叉验证；两源冲突或无法确认的一律不收录。
   * 每条内容由此获得可追溯来源字段，单条若自带 source 则优先使用。 */
  var DEFAULT_SOURCE = {
    source:      'Marvel 官方 Complete MCU Timeline（2026-06-02 发布）',
    source_type: 'S',
    source_url:  'https://en.wikipedia.org/wiki/Marvel_Cinematic_Universe',
    verified_at: '2026-06-02',
    confidence:  'high'
  };
  content.forEach(function (c) {
    for (var k in DEFAULT_SOURCE) if (!(k in c)) c[k] = DEFAULT_SOURCE[k];
    /* 发布状态：缺省即已上映；未上映条目必须在源数据显式标注。 */
    if (!c.releaseStatus) c.releaseStatus = 'released';
  });

  /* 未上映条目不继承「已核验」来源口径，也不占用上映/时间线序号。
     保留在 MCU_CONTENT_ALL 中，仅供作品详情、未来计划与关系引用。 */
  content.forEach(function (c) {
    if (c.releaseStatus !== 'upcoming') return;
    c.source = '项目内整理（未上映预置条目，非官方核验数据）';
    c.verified_at = null;
    c.confidence = 'pending_review';
    c.ro = null;
    c.co = null;
  });

  /* 已上映集合：资料库 / 观影路线 / 下一部推荐 / 进度 / 统计 / 地图的唯一口径。 */
  var released = content.filter(function (c) { return c.releaseStatus !== 'upcoming'; });

  /* 故事时间线序（tl / co）：四类内容统一用「故事年份」作主排序键。
   * 主排序键取自 coLabel 中的年份（电影与剧集/特别呈现/短片用同一把尺子），
   * 缺 coLabel 时回退到发行年。旧实现误用电影自有的 co（1-38 尺度）作排序键，
   * 而剧集/特别呈现/短片的 coLabel 年份是 2023-2027，
   * 导致「全部电影」被排在「全部非电影」之前，时间线严重失真——现已修正。
   * 同一年内：电影用其策划 co 保证年内次序精确；其余用发行日期作次级序。 */
  function storyYear(c) {
    if (c.coLabel) { var y = parseInt(c.coLabel, 10); if (!isNaN(y)) return y; }
    return c.year || 0;
  }
  function storySub(c) {
    if (c.type === 'movie' && c.co != null) return c.co;          // 电影：用策划序，年内次序最准
    var d = (c.date || '').match(/(\d{4})-(\d{2})-(\d{2})/);
    return d ? (+d[1]) * 10000 + (+d[2]) * 100 + (+d[3]) : 99999999;
  }
  released.sort(function (a, b) {
    var ya = storyYear(a), yb = storyYear(b);
    if (ya !== yb) return ya - yb;
    return storySub(a) - storySub(b);
  });
  released.forEach(function (c, i) { c.co = i + 1; });   // co = 故事时间线序（chronology order）

  /* 上映序（ro / order）：统一按发布日期排（电影与剧集同尺度），与 co 严格分离 */
  released.sort(function (a, b) { return String(a.date || '').localeCompare(String(b.date || '')); });
  released.forEach(function (c, i) { c.ro = i + 1; });   // ro = 上映顺序（release order）

  /* 全部内容（含未上映）：只用于按 id 查详情与保留关系引用，绝不参与「已看」统计。 */
  window.MCU_CONTENT_ALL = content;
  window.MCU_CONTENT = released;
})();
