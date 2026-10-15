/**
 * MCU 观影助手 · GenUI 数据集构建器
 * ------------------------------------------------------------
 * 数据单一可信源：h5/data/*.js（母项目）
 * 输出：genui-app/static/data.js（构建期生成，请勿手工编辑）
 *
 * 纪律：
 *   1. 所有 movies 字段直接从母项目读取，不手工改写，杜绝人为误差。
 *   2. 只做「字段裁剪 + 体积压缩」，不改业务语义。
 *   3. 压缩：role/sf 截断到配置长度，避免 8MB 红线。
 *   4. hero（是否有随包海报）由海报白名单推导，不独立维护。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const H5 = path.join(ROOT, 'h5', 'data');
const OUT = path.join(ROOT, 'genui-app', 'static', 'data.js');

/** 随包海报白名单：策划决策 C 混合方案，精选 15 张 */
const HEROES = [
  'iron-man', 'captain-america-first-avenger', 'thor', 'avengers',
  'winter-soldier', 'guardians', 'age-of-ultron', 'civil-war',
  'thor-ragnarok', 'black-panther', 'infinity-war', 'endgame',
  'far-from-home', 'no-way-home', 'brand-new-day'
];

const MAX_ROLE = 46;
const MAX_SF = 58;
/* 设计稿要求的短文本字段（视觉集成 2026-10-13）：
   noteShort  — F1 时间轴推荐理由，1 行，设计稿示例「一切的起点，托尼·斯塔克的蜕变奠定了整个MCU的基调」约 24 字
   reasonShort— F3 发现卡「为什么看这部」，3 行内
   eyebrow    — F1 路线头英文眉标（等宽小字 + 金线）
   roman      — 阶段罗马数字（程序化视觉卡用）
   phaseShort — 阶段短名（时间轴阶段标签用，避免「第一阶段 · 无限传奇开启」过长）
*/
const MAX_NOTE_SHORT = 26;
const MAX_REASON_SHORT = 62;

const PHASE_SHORT = {
  1: '第一阶段',
  2: '第二阶段',
  3: '第三阶段',
  4: '第四阶段',
  5: '第五阶段',
  6: '第六阶段'
};

const PHASE_ROMAN = {
  1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V', 6: 'VI'
};

/* 程序化视觉卡英文简称（设计稿 .mcu-archive-short，全大写、约 12 字符内） */
const SHORT_EN = {
  'iron-man': 'IRON MAN',
  'incredible-hulk': 'HULK',
  'iron-man-2': 'IRON MAN 2',
  'thor': 'THOR',
  'thor-dark-world': 'DARK WORLD',
  'captain-america-first-avenger': 'CAPTAIN AMERICA',
  'avengers': 'AVENGERS',
  'iron-man-3': 'IRON MAN 3',
  'winter-soldier': 'WINTER SOLDIER',
  'guardians': 'GUARDIANS',
  'age-of-ultron': 'AGE OF ULTRON',
  'ant-man': 'ANT-MAN',
  'civil-war': 'CIVIL WAR',
  'doctor-strange': 'DOCTOR STRANGE',
  'spider-man-homecoming': 'HOMEcoming',
  'thor-ragnarok': 'RAGNAROK',
  'black-panther': 'BLACK PANTHER',
  'infinity-war': 'INFINITY WAR',
  'ant-man-wasp': 'ANT-MAN WASP',
  'endgame': 'ENDGAME',
  'far-from-home': 'FAR FROM HOME',
  'no-way-home': 'NO WAY HOME',
  'multiverse-of-madness': 'MULTIVERSE',
  'quantumania': 'QUANTUMANIA',
  'deadpool-wolverine': 'DEADPOOL',
  'brave-new-world': 'BRAVE NEW WORLD',
  'fantastic-four': 'FANTASTIC FOUR',
  'brand-new-day': 'BRAND NEW DAY'
};

/* 无专属简称时的兜底：取阶段英文名 */
const PHASE_EN = {
  1: 'INFINITY SAGA',
  2: 'PHASE TWO',
  3: 'PHASE THREE',
  4: 'MULTIVERSE',
  5: 'MULTIVERSE SAGA',
  6: 'NEW ERA'
};

/* 路线眉标：与 routes.js 的 id 对应，设计稿要求英文等宽小字 */
const ROUTE_EYEBROW = {
  newcomer: 'INFINITY SAGA · ROUTE',
  essential: 'MAINLINE · ROUTE',
  release: 'RELEASE ORDER · ROUTE',
  chrono: 'MCU CHRONOLOGY · ROUTE'
};

function loadGlobal(file, key) {
  const src = fs.readFileSync(path.join(H5, file), 'utf8');
  const sandbox = {};
  new Function('window', src)(sandbox);
  const v = sandbox[key];
  if (!v) throw new Error('未找到全局变量 ' + key + '（' + file + '）');
  return v;
}

/** 按视觉估算截断，尽量在句子/词边界断开，避免半个词；结果长度恒不超过 max */
function clip(text, max) {
  const s = String(text || '').trim();
  if (s.length <= max) return s;
  let out = s.slice(0, max);
  const stops = ['，', '。', '、', '：', ';', ' '];
  for (let i = out.length - 1; i > max - 10; i--) {
    if (stops.indexOf(out[i]) >= 0) return out.slice(0, i);
  }
  // 无合适断点时截到 max-1 再补省略号，保证总长不超过 max
  return out.slice(0, max - 1) + '…';
}

function build() {
  const movies = loadGlobal('movies.js', 'MCU_MOVIES');
  const routes = loadGlobal('routes.js', 'MCU_ROUTES');

  const movieList = movies
    .slice()
    .sort((a, b) => a.ro - b.ro)
    .map((m) => ({
      id: m.id,
      cn: m.cn,
      year: m.year,
      phase: m.phase,
      ro: m.ro,
      co: m.co,
      mainline: !!m.mainline,
      starter: !!m.starter,
      hero: HEROES.indexOf(m.id) >= 0,
      role: clip(m.role, MAX_ROLE),
      sf: clip(m.sf, MAX_SF),
      /* 视觉集成新增：短文本字段（设计稿短文案位使用） */
      noteShort: clip(m.role, MAX_NOTE_SHORT),
      reasonShort: clip(m.role, MAX_REASON_SHORT),
      phaseShort: PHASE_SHORT[m.phase] || ('第' + m.phase + '阶段'),
      roman: PHASE_ROMAN[m.phase] || String(m.phase),
      /* 程序化视觉卡的英文简称，例：CIVIL WAR（设计稿 .mcu-archive-short） */
      shortEn: SHORT_EN[m.id] || PHASE_EN[m.phase] || 'MCU ' + m.ro,
      /* 档案卡编号，例：MCU-015 */
      archiveNo: 'MCU-' + String(m.ro).padStart(3, '0')
    }));

  // 只保留 V1 需要的基础观影路线；generator 路线在构建期展开为显式 items
  // 注意：母项目中「精简主线」的 id 是 essential，generator 才是 mainline
  const V1_ROUTES = ['newcomer', 'essential', 'release', 'chrono'];
  const routeList = routes
    .filter((r) => V1_ROUTES.indexOf(r.id) >= 0)
    .map((r) => {
      let items;
      if (Array.isArray(r.items) && r.items.length) {
        items = r.items.slice();
      } else if (r.generator === 'release') {
        items = movieList.map((m) => m.id); // 上映顺序 = ro 升序
      } else if (r.generator === 'mainline' || r.generator === 'essential') {
        items = movieList.filter((m) => m.mainline).map((m) => m.id);
      } else if (r.generator === 'chrono') {
        items = movieList.slice()
          .sort((a, b) => a.co - b.co)
          .map((m) => m.id);
      } else {
        items = [];
      }
      return {
        id: r.id,
        name: r.name,
        tagline: r.tagline,
        desc: clip(r.desc, 76),
        count: items.length,
        eyebrow: ROUTE_EYEBROW[r.id] || 'MCU · ROUTE',
        items: items
      };
    });

  // 随机探索候选池：主线作品，优先有随包海报的（视觉更完整）
  const randomPool = movieList
    .filter((m) => m.mainline)
    .sort((a, b) => (b.hero ? 1 : 0) - (a.hero ? 1 : 0) || a.ro - b.ro)
    .map((m) => m.id);

  const payload = {
    version: '2026-10-13',
    phases: {
      1: '第一阶段 · 无限传奇开启',
      2: '第二阶段 · 复仇者集结',
      3: '第三阶段 · 终局之战',
      4: '第四阶段 · 多元宇宙',
      5: '第五阶段 · 多元宇宙新篇',
      6: '第六阶段 · 崭新之日'
    },
    heroes: HEROES.slice(),
    routes: routeList,
    movies: movieList,
    randomPool: randomPool
  };

  const banner = [
    '/* ============================================================',
    ' * MCU 观影助手 · GenUI 专用数据集（构建期生成，请勿手工编辑）',
    ' * ------------------------------------------------------------',
    ' * 由 genui-app/tools/build-data.cjs 从 h5/data/{movies,routes}.js 自动生成。',
    ' * 数据单一可信源为母项目；本文件仅做字段裁剪与体积压缩。',
    ' * 重新生成：node genui-app/tools/build-data.cjs',
    ' * ============================================================ */'
  ].join('\n');

  const body = 'window.MCU_GENUI_DATA = ' +
    JSON.stringify(payload, null, 2) + ';\n';

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, banner + body, 'utf8');

  const bytes = fs.statSync(OUT).size;
  console.log('✔ 已生成 ' + path.relative(ROOT, OUT));
  console.log('  movies      : ' + movieList.length + ' 部（母项目 ' + movies.length + ' 部，一致）');
  console.log('  routes      : ' + routeList.length + ' 条');
  routeList.forEach((r) => console.log('    - ' + r.id + ' → ' + r.count + ' 部'));
  console.log('  heroes      : ' + movieList.filter((m) => m.hero).length + ' 部有随包海报');
  console.log('  randomPool  : ' + randomPool.length + ' 部');
  console.log('  文件体积    : ' + (bytes / 1024).toFixed(1) + ' KB');
}

build();
