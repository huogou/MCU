/* ============================================================
 * MCU 宇宙导航（小程序） - 全局常量（Token 权威来源）
 * ------------------------------------------------------------
 * 阶段色：与 H5 assets/css/style.css 的 --p1..--p6 一致（唯一权威值）。
 * 类型/重要度展示色：与 H5 style.css 的 --type-* / --imp-* 一致。
 * 小程序端统一从本文件取色，页面禁止写死颜色（D12 视觉债整改方向）。
 * ============================================================ */

/* 六阶段色（p1 #5B8DEF … p6 #C25B8E，项目 D10 Token 权威值） */
const PHASE = {
  1: '#5B8DEF',
  2: '#28B487',
  3: '#F0A932',
  4: '#8B6FE8',
  5: '#E8483F',
  6: '#C25B8E'
};

/* 阶段展示名（全景图 PHASE_COLS 与详情页徽标用） */
const PHASE_LABEL = {
  1: '第一阶段',
  2: '第二阶段',
  3: '第三阶段',
  4: '第四阶段',
  5: '第五阶段',
  6: '第六阶段'
};

/* 类型展示色（对应 H5 style.css --type-movie 等） */
const TYPE_COLOR = {
  movie:   '#F0A932',
  series:  '#5B8DEF',
  special: '#8B6FE8',
  short:   '#28B487'
};

/* 重要度展示色（对应 H5 style.css --imp-core 等） */
const IMP_COLOR = {
  core:        '#E8483F',
  recommended: '#F0A932',
  optional:    '#7A8296'
};

/* 全景图连线颜色（对应 H5 map.html .conn-mainline / .conn-support / .conn-cross） */
const CONN_COLOR = {
  mainline: '#F2B233',
  support:  'rgba(255,255,255,0.15)',
  cross:    '#9B6DFF'
};

module.exports = {
  PHASE,
  PHASE_LABEL,
  TYPE_COLOR,
  IMP_COLOR,
  CONN_COLOR
};
