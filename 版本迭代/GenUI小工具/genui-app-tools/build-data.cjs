/**
 * MCU 观影助手 · GenUI 数据集构建器（轻量版 V1.0）
 * ------------------------------------------------------------
 * 数据单一可信源：h5/data/*.js（母项目）
 * 输出：genui-app/static/data.js（构建期生成，请勿手工编辑）
 *
 * 轻量版纪律（相对旧版 V1.4.1）：
 *   1. 仅保留三条路线：新手入门 / 主线精选 / 复联5补课。
 *   2. 路线数据全部取自母项目，不手工维护第二套电影数据。
 *   3. 「复联5补课」取自 h5/data/special-routes.js 的 avengers-doomsday.core.items
 *      （8 项：6 部电影 + 洛基 S1/S2 两部剧集），只读引用，不改母项目。
 *   4. 剧集与电影均带 cn / year / phase，剧集以 isSeries 标记、列表加「剧」标签。
 *   5. 删除海报白名单、随机探索池等旧版字段（包体由 ~714KB 降至 ~80KB）。
 *   6. 构建可重复执行：母项目数据变化后重跑本脚本即可重新生成快照。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
/* 母项目（单一可信源）位于工作区根目录的 h5/data，并非 GenUI 子目录内 */
const WORKSPACE = path.resolve(ROOT, '..', '..');
const H5 = path.join(WORKSPACE, 'h5', 'data');
const OUT = path.join(ROOT, 'genui-app', 'static', 'data.js');

const PHASE_SHORT = {
  1: '第一阶段',
  2: '第二阶段',
  3: '第三阶段',
  4: '第四阶段',
  5: '第五阶段',
  6: '第六阶段'
};

/**
 * 剧集分季年份覆盖表。
 * 母项目 series.js 中《洛基》仅存整剧单一年份 2021，无「分季」字段；
 * 设计稿 V1.0（已验收的轻量版唯一视觉/产品依据）明确指定洛基 S2 显示年份为 2023，
 * 故此处以「设计稿指定显示值」覆盖 S2 年份。本表为构建期固定映射，可重复执行，
 * 不依赖运行时推断，亦非据记忆编造影片。来源：docs/产品/GenUI-MCU观影助手-轻量版视觉设计V1.0.html。
 */
const SERIES_SEASON_YEAR = {
  'loki|S1': 2021,
  'loki|S2': 2023
};

function loadGlobal(file, key) {
  const src = fs.readFileSync(path.join(H5, file), 'utf8');
  const sandbox = {};
  new Function('window', src)(sandbox);
  const v = sandbox[key];
  if (!v) throw new Error('未找到全局变量 ' + key + '（' + file + '）');
  return v;
}

function phaseShortOf(phase) {
  return PHASE_SHORT[phase] || ('第' + phase + '阶段');
}

function build() {
  const movies = loadGlobal('movies.js', 'MCU_MOVIES');
  const series = loadGlobal('series.js', 'MCU_SERIES');
  const routes = loadGlobal('routes.js', 'MCU_ROUTES');
  const special = loadGlobal('special-routes.js', 'MCU_SPECIAL_ROUTES');

  const movieById = {};
  movies.forEach(function (m) { movieById[m.id] = m; });
  const seriesById = {};
  series.forEach(function (s) { seriesById[s.id] = s; });

  /* 母项目电影按上映顺序排序，保证「主线精选」等按母项目 ro 顺序输出 */
  const moviesByRo = movies.slice().sort(function (a, b) { return a.ro - b.ro; });

  function movieItem(m) {
    if (!m) return null;
    return {
      id: m.id,
      name: m.cn,
      year: m.year,
      phase: m.phase,
      phaseShort: phaseShortOf(m.phase),
      isSeries: false,
      type: 'movie'
    };
  }

  function seriesItem(s, label) {
    if (!s) return null;
    const season = label ? (label.match(/S(\d+)/) || [])[1] : null;
    const key = s.id + '|S' + (season || '1');
    const year = (season && SERIES_SEASON_YEAR[key] != null) ? SERIES_SEASON_YEAR[key] : s.year;
    return {
      id: s.id,
      name: label || s.cn,
      year: year,
      phase: s.phase,
      phaseShort: phaseShortOf(s.phase),
      isSeries: true,
      type: 'series'
    };
  }

  /* ── 路线一：新手入门（母项目 newcomer 显式 items，保留母项目原顺序）── */
  const newcomer = routes.filter(function (r) { return r.id === 'newcomer'; })[0];
  const newcomerItems = (newcomer.items || [])
    .map(function (id) { return movieItem(movieById[id]); })
    .filter(Boolean);

  /* ── 路线二：主线精选（母项目 essential，generator=mainline → 主线电影，按上映顺序）── */
  const essential = routes.filter(function (r) { return r.id === 'essential'; })[0];
  let essentialIds;
  if (Array.isArray(essential.items) && essential.items.length) {
    essentialIds = essential.items.slice();
  } else if (essential.generator === 'mainline' || essential.generator === 'essential') {
    essentialIds = moviesByRo.filter(function (m) { return m.mainline; }).map(function (m) { return m.id; });
  } else {
    essentialIds = [];
  }
  const essentialItems = essentialIds
    .map(function (id) { return movieItem(movieById[id]); })
    .filter(Boolean);

  /* ── 路线三：复联5补课（母项目 special-routes.js avengers-doomsday.core.items，8 项）── */
  const ads = special.filter(function (s) { return s.id === 'avengers-doomsday'; })[0];
  const adItems = (ads.core.items || [])
    .map(function (it) {
      const s = seriesById[it.workId];
      if (s) return seriesItem(s, it.label);
      return movieItem(movieById[it.workId]);
    })
    .filter(Boolean);

  const routeDefs = [
    {
      id: 'newcomer',
      name: '新手入门',
      desc: '第一次看漫威，照这个顺序看这 12 部就够了',
      items: newcomerItems
    },
    {
      id: 'essential',
      name: '主线精选',
      desc: '想理清主线剧情，按这个顺序看这 18 部',
      items: essentialItems
    },
    {
      id: 'avengers-doomsday',
      name: '复联5补课',
      desc: '已看完《终局之战》，补这 8 项接上复联5',
      items: adItems
    }
  ];

  const payload = {
    version: '2026-10-30',
    phases: {
      1: '第一阶段 · 无限传奇开启',
      2: '第二阶段 · 复仇者集结',
      3: '第三阶段 · 终局之战',
      4: '第四阶段 · 多元宇宙',
      5: '第五阶段 · 多元宇宙新篇',
      6: '第六阶段 · 崭新之日'
    },
    routes: routeDefs.map(function (r) {
      return {
        id: r.id,
        name: r.name,
        desc: r.desc,
        count: r.items.length,
        items: r.items
      };
    })
  };

  const banner = [
    '/* ============================================================',
    ' * MCU 观影助手 · GenUI 轻量版专用数据集（构建期生成，请勿手工编辑）',
    ' * ------------------------------------------------------------',
    ' * 由 genui-app/tools/build-data.cjs 从母项目 h5/data/{movies,series,routes,special-routes}.js 自动生成。',
    ' * 数据单一可信源为母项目；本文件仅做字段裁剪。',
    ' * 重新生成：node genui-app/tools/build-data.cjs',
    ' * ============================================================ */'
  ].join('\n');

  const body = 'window.MCU_GENUI_DATA = ' + JSON.stringify(payload, null, 2) + ';\n';

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, banner + body, 'utf8');

  const bytes = fs.statSync(OUT).size;
  console.log('✔ 已生成 ' + path.relative(ROOT, OUT));
  payload.routes.forEach(function (r) {
    console.log('  - ' + r.name + ' (' + r.id + ') → ' + r.count + ' 项');
    r.items.forEach(function (it, i) {
      console.log('      ' + String(i + 1).padStart(2, '0') +
        ' ' + it.name + ' · ' + it.year + ' · ' + it.phaseShort +
        (it.isSeries ? ' · [剧]' : ''));
    });
  });
  console.log('  文件体积    : ' + (bytes / 1024).toFixed(1) + ' KB');
}

build();
