/* ============================================================
 * MCU 宇宙导航（小程序） - 全景图布局配置（pano）
 * ------------------------------------------------------------
 * 来源：H5 mcu-navigator/map.html（PANO_MOVIES / PANO_CONN）+ D7 验收
 * （PHASE_COLS / LAYOUT 几何常量）
 *
 * 性质＝视觉布局 + 已策划连线，不含内容事实。
 * - PANO_MOVIES 节点 id 全部指回 content 单一源（未另建电影表）。
 * - PANO_CONN 41 条（mainline 15 / support 18 / cross 8）与 H5 完全一致
 *   （含 H5 中 endgame→far-from-home 的 support 重复边，保持原样）。
 * - 坐标已按 D7 最终验收压缩至 3400px（k = 3400/4240 ≈ 0.8019，
 *   left 四舍五入；与 D7 报告 PHASE_COLS 位置 48/674/1299/2165/2710/3159
 *   及同行最小间距 12px 完全吻合）。
 * - 卡片保持 60×90（用户处方「只压间距、卡片保持 60×90」）。
 * ============================================================ */

/* 节点：{ id, cls, left, [top], [upcoming 字段] }
 * cls ∈ mainline / support-above / support-below */
const PANO_MOVIES = [
  { id: 'incredible-hulk', cls: 'support-above', left: 156 },
  { id: 'iron-man-2', cls: 'support-above', left: 261 },
  { id: 'iron-man', cls: 'mainline', left: 80 },
  { id: 'thor', cls: 'mainline', left: 289 },
  { id: 'captain-america-first-avenger', cls: 'mainline', left: 393 },
  { id: 'avengers', cls: 'mainline', left: 521 },
  { id: 'iron-man-3', cls: 'support-above', left: 706 },
  { id: 'thor-dark-world', cls: 'support-above', left: 810 },
  { id: 'winter-soldier', cls: 'mainline', left: 738 },
  { id: 'guardians', cls: 'mainline', left: 914 },
  { id: 'age-of-ultron', cls: 'mainline', left: 1075 },
  { id: 'ant-man', cls: 'support-below', left: 962 },
  { id: 'doctor-strange', cls: 'support-above', left: 1331 },
  { id: 'guardians-2', cls: 'support-above', left: 1540 },
  { id: 'black-panther', cls: 'support-above', left: 1748 },
  { id: 'ant-man-wasp', cls: 'support-above', left: 1852 },
  { id: 'captain-marvel', cls: 'support-above', left: 1957 },
  { id: 'civil-war', cls: 'mainline', left: 1363 },
  { id: 'spider-man-homecoming', cls: 'mainline', left: 1467 },
  { id: 'thor-ragnarok', cls: 'mainline', left: 1644 },
  { id: 'infinity-war', cls: 'mainline', left: 2005 },
  { id: 'endgame', cls: 'mainline', left: 2085 },
  { id: 'far-from-home', cls: 'support-below', left: 2149 },
  { id: 'black-widow', cls: 'support-above', left: 2197 },
  { id: 'shang-chi', cls: 'support-above', left: 2301 },
  { id: 'eternals', cls: 'support-above', left: 2406 },
  { id: 'no-way-home', cls: 'mainline', left: 2269 },
  { id: 'multiverse-of-madness', cls: 'mainline', left: 2446 },
  { id: 'love-and-thunder', cls: 'support-below', left: 2366 },
  { id: 'wakanda-forever', cls: 'support-below', left: 2526 },
  { id: 'quantumania', cls: 'support-below', left: 2726 },
  { id: 'guardians-3', cls: 'support-below', left: 2799 },
  { id: 'the-marvels', cls: 'support-below', left: 2871 },
  { id: 'deadpool-wolverine', cls: 'support-below', left: 2943 },
  { id: 'brave-new-world', cls: 'support-below', left: 3015 },
  { id: 'thunderbolts', cls: 'support-below', left: 3087 },
  { id: 'fantastic-four', cls: 'mainline', left: 3192 },
  { id: 'brand-new-day', cls: 'mainline', left: 3288 },
  /* 已官宣待映（不在 CONTENT 单一源），保留最小配置供占位展示 */
  { id: 'avengers-5', cls: 'mainline upcoming phase-6', left: 3192, top: 480, title: '毁灭之日', year: '2026', upcoming: true },
  { id: 'avengers-6', cls: 'mainline upcoming phase-6', left: 3288, top: 480, title: '秘密战争', year: '2027', upcoming: true }
];

/* 连线：[from, to, type]，type ∈ mainline / support / cross（与 H5 原样一致） */
const PANO_CONN = [
  ['iron-man', 'avengers', 'mainline'], ['thor', 'avengers', 'mainline'], ['captain-america-first-avenger', 'avengers', 'mainline'],
  ['avengers', 'winter-soldier', 'mainline'], ['avengers', 'age-of-ultron', 'mainline'], ['winter-soldier', 'civil-war', 'mainline'],
  ['guardians', 'infinity-war', 'mainline'], ['age-of-ultron', 'infinity-war', 'mainline'], ['civil-war', 'spider-man-homecoming', 'mainline'],
  ['civil-war', 'infinity-war', 'mainline'], ['doctor-strange', 'thor-ragnarok', 'support'], ['thor-ragnarok', 'infinity-war', 'mainline'],
  ['infinity-war', 'endgame', 'mainline'], ['endgame', 'far-from-home', 'mainline'], ['far-from-home', 'no-way-home', 'mainline'],
  ['no-way-home', 'multiverse-of-madness', 'mainline'], ['fantastic-four', 'brand-new-day', 'support'],
  ['iron-man', 'iron-man-2', 'support'], ['iron-man', 'incredible-hulk', 'support'], ['iron-man-2', 'avengers', 'support'],
  ['avengers', 'iron-man-3', 'support'], ['avengers', 'thor-dark-world', 'support'], ['age-of-ultron', 'ant-man', 'support'],
  ['ant-man', 'endgame', 'support'], ['ant-man', 'ant-man-wasp', 'support'], ['captain-america-first-avenger', 'doctor-strange', 'support'],
  ['doctor-strange', 'infinity-war', 'support'], ['civil-war', 'black-panther', 'support'], ['black-panther', 'infinity-war', 'support'],
  ['guardians', 'guardians-2', 'support'], ['captain-marvel', 'endgame', 'support'], ['endgame', 'far-from-home', 'support'],
  ['no-way-home', 'brand-new-day', 'support'],
  ['iron-man', 'shang-chi', 'cross'], ['ant-man-wasp', 'quantumania', 'cross'], ['captain-marvel', 'the-marvels', 'cross'],
  ['black-widow', 'thunderbolts', 'cross'], ['eternals', 'fantastic-four', 'cross'], ['endgame', 'brave-new-world', 'cross'],
  ['thor-ragnarok', 'love-and-thunder', 'cross'], ['guardians-2', 'guardians-3', 'cross']
];

/* 阶段列（标题含年份；位置为 3400px 压缩后的 left，D7 验收值） */
const PHASE_COLS = [
  { phase: 1, left: 48,  title: '第一阶段', years: '2008 – 2012' },
  { phase: 2, left: 674, title: '第二阶段', years: '2013 – 2015' },
  { phase: 3, left: 1299, title: '第三阶段', years: '2016 – 2019' },
  { phase: 4, left: 2165, title: '第四阶段', years: '2021 – 2022' },
  { phase: 5, left: 2710, title: '第五阶段', years: '2023 – 2025' },
  { phase: 6, left: 3159, title: '第六阶段', years: '2025 –' }
];

/* 布局几何常量（3400px 压缩版）
 * cardW/cardH 为用户处方 60×90；三层 top 以 H5 移动端布局为基准重建，
 * 属视觉排布，可在设计确认后微调（不影响数据）。 */
const LAYOUT = {
  canvasW: 3400,        /* 画布总宽（D7 最终验收压缩值） */
  canvasH: 720,         /* 画布高（H5 原高，移动端可微调） */
  cardW: 60,            /* 电影卡宽 */
  cardH: 90,            /* 电影卡高（含标题区，海报位为 cardW 等比） */
  mainlineTop: 260,     /* 中轨 top */
  supportAboveTop: 70,  /* 上轨 top */
  supportBelowTop: 440, /* 下轨 top */
  goldenTrackTop: 310,  /* 金色主线轨道 top */
  phaseColTop: 0,       /* 阶段列 top */
  phaseColHeight: 720   /* 阶段列高度 */
};

module.exports = { PANO_MOVIES, PANO_CONN, PHASE_COLS, LAYOUT };
