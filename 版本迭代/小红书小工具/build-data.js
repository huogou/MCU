/* ============================================================
 * MCU Atlas × 小红书小工具 — H5 → 小红书 数据同步管线
 * ------------------------------------------------------------
 * 数据母库（只读）：../../h5/data/*.js
 * 产物：dist/assets/data.js（全局变量，经典脚本，无 ES Module）
 *
 * 运行：node build-data.js        （由 build-zip.js 自动调用）
 * 特性：可重复运行、不修改母库、结果确定（无时间戳参与内容）
 *
 * 转换原则：
 *   1. 只读取，不改写 H5 母库。
 *   2. 过滤 pendingReview / confidence=pending_review / 未上映预置条目。
 *   3. 不接入 news.js（mock 资讯），不做任何剧情推断。
 *   4. 复联5 本体只保留官方定档信息，推断性表述统一标注「推测」。
 *   5. 图片资源不进入包体（容器不联网 + 体积门禁），仅统计覆盖率。
 * ============================================================ */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const H5_DATA_DIR = path.resolve(__dirname, '..', '..', 'h5', 'data');
const OUT_FILE = path.join(__dirname, 'dist', 'assets', 'data.js');
const REPORT_FILE = path.join(__dirname, 'build-report.json');

/* 需要结合的数据文件（news.js 明确不接入） */
const DATA_FILES = [
  'movies', 'series', 'special', 'short', 'content',
  'characters', 'relations', 'routes', 'special-routes',
  'upcoming', 'posters', 'stills', 'visuals'
];

/* 小红书端不需要、且不参与查询的字段（减小包体） */
const DROP_CONTENT_FIELDS = [
  'next', 'source', 'source_type', 'source_url', 'verified_at', 'sourceNote'
];

function loadH5Data() {
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  const missing = [];
  DATA_FILES.forEach(function (name) {
    const file = path.join(H5_DATA_DIR, name + '.js');
    if (!fs.existsSync(file)) { missing.push(name); return; }
    vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: name + '.js' });
  });
  if (missing.length) {
    throw new Error('母库缺少数据文件：' + missing.join(', '));
  }
  return sandbox.window;
}

/* ---------- 过滤：未上映 / 待核实 ---------- */
function isExcluded(c) {
  if (!c || !c.id) return true;
  if (c.releaseStatus === 'upcoming') return true;
  if (c.pendingReview === true) return true;
  if (c.confidence === 'pending_review') return true;
  return false;
}

function cleanContent(c) {
  const out = {};
  Object.keys(c).forEach(function (k) {
    if (DROP_CONTENT_FIELDS.indexOf(k) !== -1) return;
    if (k === 'mainline' || k === 'starter') return;      // 已派生为 importance
    if (k === 'pendingReview' || k === 'confidence') return;
    if (c[k] === undefined || c[k] === null) return;      // 空字段不落库
    out[k] = c[k];
  });
  return out;
}

/* ---------- 复联5 文案：分离官方确认信息与推测 ---------- */
const SPECULATION_LABEL = '推测';
const AVENGERS5_OFFICIAL_NOTE = '漫威影业已公布档期与正式片名，剧情与角色信息尚未由官方公布。';
/* 官方英文名已确认；中文名暂用辅助称呼，H5 母库中的旧中文名仅在产物层统一，不修改母库。 */
const AVENGERS5_CN = '复仇者联盟5';
const AVENGERS5_EN = 'Avengers: Doomsday';
const AVENGERS5_TITLE_NOTE = '中文名暂用「复仇者联盟5」（非官方译名），官方英文名为 Avengers: Doomsday。';
const LEGACY_AVENGERS5_CN = '复仇者联盟：末日';

/* 产物层名称归一：仅替换旧片名，避免首页 / 专题 / 详情 / 分享卡出现名称冲突 */
function normalizeDisplayNames(value) {
  if (typeof value === 'string') return value.split(LEGACY_AVENGERS5_CN).join(AVENGERS5_CN);
  if (Array.isArray(value)) return value.map(normalizeDisplayNames);
  if (value && typeof value === 'object') {
    Object.keys(value).forEach(function (k) { value[k] = normalizeDisplayNames(value[k]); });
  }
  return value;
}

function buildUpcoming(upcoming) {
  const kept = [];
  const dropped = [];
  upcoming.forEach(function (u) {
    if (u.pendingReview === true) { dropped.push(u.id); return; }
    const item = {
      id: u.id,
      contentId: u.contentId || null,
      title: u.title,
      en: u.en,
      date: u.date,
      status: u.status,
      phase: u.phase === null || u.phase === undefined ? null : u.phase,
      seriesNo: u.seriesNo === undefined ? null : u.seriesNo
    };
    if (u.id === 'avengers-5') {
      item.title = AVENGERS5_CN;
      item.en = AVENGERS5_EN;
      item.titleNote = AVENGERS5_TITLE_NOTE;
      item.note = AVENGERS5_OFFICIAL_NOTE;
      item.speculation = null;
      item.speculationLabel = SPECULATION_LABEL;
    } else {
      item.note = u.note || '';
      item.speculation = null;
      item.speculationLabel = SPECULATION_LABEL;
    }
    kept.push(item);
  });
  return { kept: kept, dropped: dropped };
}

/* ---------- 函数编译：把母库 JS 函数体原样转成包内函数字面量 ---------- */
function rebuildCamapsSource(srcText) {
  const m = srcText.match(/window\.MCU_CAMPS\s*=\s*(\{[\s\S]*?\});\s*$/m);
  if (!m) throw new Error('无法从 characters.js 提取 MCU_CAMPS');
  return m[1];
}

/* 完整路线在 H5 源中没有逐条 kw；仅补保守的已上映作品导览，
   不引入复联5剧情、角色阵容或汇合关系等未经官方确认的信息。 */
const FULL_ROUTE_REASONS = {
  'loki': '理解 TVA、神圣时间线与多元宇宙主线',
  'wandavision': '理解旺达在《奇异博士2》前的角色变化',
  'multiverse-of-madness': '了解平行宇宙设定与旺达故事线',
  'no-way-home': '理解多元宇宙对主宇宙的影响',
  'quantumania': '了解量子领域与第五阶段背景',
  'deadpool-wolverine': '了解死侍、金刚狼与多元宇宙的联系',
  'falcon-winter-soldier': '了解山姆接任美国队长及相关新角色',
  'brave-new-world': '了解山姆作为美国队长的后续故事',
  'hawkeye': '认识凯特·毕肖普与叶莲娜的后续线索',
  'thunderbolts': '认识新团队成员及其此前经历',
  'ironheart': '认识莉莉·威廉姆斯与新一代科技英雄线',
  'fantastic-four': '认识神奇四侠及其所在平行宇宙',
  'daredevil-born-again': '了解夜魔侠、金并等纽约街头角色',
  'what-if': '通过动画合集了解平行宇宙设定（非 MCU 正史）'
};

function buildSpecialRoutes(specialRoutes, contentById, upcomingById) {
  const VALID_WORK = /^[a-z0-9-]+$/;
  const list = [];
  specialRoutes.forEach(function (r) {
    const items = [];
    const missingWorks = [];
    function mapItems(group, useFullReasons) {
      if (!group || !group.items) return null;
      return group.items.map(function (it) {
        if (!VALID_WORK.test(String(it.workId || ''))) {
          throw new Error('非法 workId：' + it.workId);
        }
        const c = contentById[it.workId];
        if (!c) { missingWorks.push(it.workId); return null; }
        return {
          workId: it.workId,
          label: it.label || null,
          kw: it.kw || (useFullReasons ? FULL_ROUTE_REASONS[it.workId] : null),
          cn: c.cn,
          en: c.en || '',
          year: c.year || null,
          type: c.type
        };
      }).filter(Boolean);
    }
    const core = mapItems(r.core, false);
    const full = mapItems(r.full, true);
    if (missingWorks.length) {
      throw new Error('专题 ' + r.id + ' 引用了不存在的作品：' + missingWorks.join(', '));
    }
    const up = upcomingById[r.upcomingId];
    if (!up) throw new Error('专题 ' + r.id + ' 引用了不存在的未上映条目：' + r.upcomingId);

    const chain = r.chain || { items: [] };
    list.push({
      id: r.id,
      upcomingId: r.upcomingId,
      title: r.title,
      tagline: r.tagline,
      heroNote: r.heroNote,
      origin: r.origin ? {
        workId: r.origin.workId,
        kw: r.origin.kw,
        cn: (contentById[r.origin.workId] || {}).cn || ''
      } : null,
      core: core ? { title: r.core.title, items: core } : null,
      full: full ? { title: r.full.title, desc: r.full.desc || '', items: full } : null,
      chain: {
        title: chain.title || '为什么值得补',
        items: (chain.items || []).map(function (x) { return { t: x.t, d: x.d, speculative: false }; }),
        end: chain.end ? { d: chain.end.d, speculative: true, label: SPECULATION_LABEL } : null
      },
      hero: {
        title: up.title,
        titleNote: up.titleNote || null,
        en: up.en,
        date: up.date,
        status: up.status,
        note: up.note,
        speculation: up.speculation || null,
        speculationLabel: SPECULATION_LABEL
      }
    });
  });
  return list;
}

/* ---------- 主流程 ---------- */
function build() {
  const w = loadH5Data();
  const report = { generatedBy: 'build-data.js', source: '../../h5/data', sourceCounts: {}, outputCounts: {}, filtered: {}, warnings: [] };

  const contentAll = (w.MCU_CONTENT_ALL || w.MCU_CONTENT || []).slice();
  const contentReleased = (w.MCU_CONTENT || []).slice();
  const characters = (w.MCU_CHARACTERS || []).slice();
  const relations = (w.MCU_RELATIONS || []).slice();
  const routes = (w.MCU_ROUTES || []).slice();
  const specialRoutes = (w.MCU_SPECIAL_ROUTES || []).slice();
  const upcoming = (w.MCU_UPCOMING || []).slice();
  const posters = w.MCU_POSTERS || {};
  const stills = w.MCU_STILLS || {};

  report.sourceCounts = {
    movie: (w.MCU_MOVIES || []).length,
    series: (w.MCU_SERIES || []).length,
    special: (w.MCU_SPECIAL || []).length,
    short: (w.MCU_SHORT || []).length,
    contentReleased: contentReleased.length,
    contentAll: contentAll.length,
    characters: characters.length,
    relations: relations.length,
    routes: routes.length,
    specialRoutes: specialRoutes.length,
    upcoming: upcoming.length,
    posters: Object.keys(posters).length,
    stills: Object.keys(stills).length
  };

  /* 1. 作品：过滤 + 精简字段 */
  const excluded = [];
  const content = contentReleased.filter(function (c) {
    if (isExcluded(c)) { excluded.push(c.id); return false; }
    return true;
  }).map(cleanContent);

  const contentById = {};
  content.forEach(function (c) { contentById[c.id] = c; });

  /* 2. 角色：只保留有登场作品引用的角色 */
  const trackedChars = {};
  content.forEach(function (c) {
    (c.chars || []).forEach(function (id) { trackedChars[id] = true; });
  });
  const charList = characters.filter(function (ch) {
    if (ch.pendingReview === true) return false;
    return !!trackedChars[ch.id];
  }).map(function (ch) {
    const out = { id: ch.id, cn: ch.cn, en: ch.en, camp: ch.camp, first: ch.first };
    if (ch.note) out.note = ch.note;
    if (!contentById[ch.first]) out.first = null;
    return out;
  });
  const charIds = {};
  charList.forEach(function (ch) { charIds[ch.id] = true; });

  /* 角色引用一致性：清理指向不存在角色的引用 */
  let droppedCharRefs = 0;
  content.forEach(function (c) {
    if (!c.chars) return;
    const kept = c.chars.filter(function (id) { return !!charIds[id]; });
    droppedCharRefs += c.chars.length - kept.length;
    if (kept.length) c.chars = kept; else delete c.chars;
  });

  /* 3. 关系：两端与类型必须有效 */
  const relTypes = Object.keys(w.MCU_REL_TYPES || {});
  const relList = [];
  let droppedRel = 0;
  relations.forEach(function (r) {
    if (!contentById[r.from] || !contentById[r.to]) { droppedRel++; return; }
    if (relTypes.length && relTypes.indexOf(r.type) === -1) { droppedRel++; return; }
    relList.push({ from: r.from, to: r.to, type: r.type, weight: r.weight || null, why: r.why || '' });
  });

  /* 4. 路线：generator 路线保留生成规则，手写路线校验引用 */
  const routeList = [];
  routes.forEach(function (r) {
    const out = { id: r.id, kind: r.kind, name: r.name, tagline: r.tagline };
    if (r.forWho) out.forWho = r.forWho;
    if (r.desc) out.desc = r.desc;
    if (r.why) out.why = r.why;
    if (r.note) out.note = r.note;
    if (r.generator) {
      /* generator 路线由端上按规则生成，此处只保留规则与校验合法性 */
      if (['release', 'chrono', 'mainline', 'essential'].indexOf(r.generator) === -1) {
        report.warnings.push('未知 generator：' + r.generator);
        return;
      }
      out.generator = r.generator;
      out.items = [];
      routeList.push(out);
      return;
    }
    const items = (r.items || []).filter(function (id) { return !!contentById[id]; });
    if (!items.length) { report.warnings.push('路线 ' + r.id + ' 无有效作品，已跳过'); return; }
    if (items.length !== (r.items || []).length) {
      report.warnings.push('路线 ' + r.id + ' 过滤了 ' + ((r.items || []).length - items.length) + ' 个无效引用');
    }
    out.items = items;
    routeList.push(out);
  });

  /* 5. 未上映 / 专题 */
  const up = buildUpcoming(upcoming);
  const upcomingById = {};
  up.kept.forEach(function (u) { upcomingById[u.id] = u; });
  const special = buildSpecialRoutes(specialRoutes, contentById, upcomingById);

  /* 产物层统一复联5中文名，避免旧中文名流向首页 / 详情 / 专题 / 分享卡 */
  [content, charList, relList, routeList, up.kept, special].forEach(normalizeDisplayNames);

  /* 6. 统计 */
  const byType = { movie: 0, series: 0, special: 0, short: 0 };
  content.forEach(function (c) { if (byType[c.type] !== undefined) byType[c.type]++; });
  report.outputCounts = {
    content: content.length,
    movie: byType.movie,
    series: byType.series,
    special: byType.special,
    short: byType.short,
    characters: charList.length,
    relations: relList.length,
    routes: routeList.length,
    specialRoutes: special.length,
    upcoming: up.kept.length
  };
  report.filtered = {
    excludedContent: excluded,
    droppedRelations: droppedRel,
    droppedCharacterRefs: droppedCharRefs,
    droppedUpcoming: up.dropped
  };
  report.imageCoverage = {
    posters: Object.keys(posters).length + ' 条海报记录（未写入包体）',
    stills: Object.keys(stills).length + ' 条剧照记录（未写入包体）',
    reason: '容器不联网、且图片会突破体积门禁；小红书端采用程序化视觉卡，不引用外部或相对图片路径。'
  };

  /* 7. 组装产物 */
  const banner = [
    '/* 本文件由 build-data.js 自动生成，请勿手工修改。',
    ' * 数据母库：h5/data/*.js（只读）',
    ' * 已上映内容 ' + content.length + ' 条｜角色 ' + charList.length + ' 个｜关系 ' + relList.length + ' 条｜路线 ' + routeList.length + ' 条',
    ' */'
  ].join('\n');

  const parts = [];
  parts.push(banner);
  parts.push('window.MCU_TYPE = ' + JSON.stringify(w.MCU_TYPE || {}) + ';');
  parts.push('window.MCU_TYPE_LABEL = ' + JSON.stringify(w.MCU_TYPE_LABEL || {}) + ';');
  parts.push('window.MCU_IMPORTANCE = ' + JSON.stringify(w.MCU_IMPORTANCE || {}) + ';');
  parts.push('window.MCU_IMPORTANCE_LABEL = ' + JSON.stringify(w.MCU_IMPORTANCE_LABEL || {}) + ';');
  parts.push('window.MCU_CAMPS = ' + rebuildCamapsSource(fs.readFileSync(path.join(H5_DATA_DIR, 'characters.js'), 'utf8')) + ';');
  parts.push('window.MCU_REL_TYPES = ' + JSON.stringify(w.MCU_REL_TYPES || {}) + ';');
  parts.push('window.MCU_CONTENT = ' + JSON.stringify(content) + ';');
  parts.push('window.MCU_CHARACTERS = ' + JSON.stringify(charList) + ';');
  parts.push('window.MCU_RELATIONS = ' + JSON.stringify(relList) + ';');
  parts.push('window.MCU_ROUTES = ' + JSON.stringify(routeList) + ';');
  parts.push('window.MCU_UPCOMING = ' + JSON.stringify(up.kept) + ';');
  parts.push('window.MCU_SPECIAL_ROUTES = ' + JSON.stringify(special) + ';');
  parts.push('window.MCU_DATA_META = ' + JSON.stringify({
    version: 'V2.0',
    syncedFrom: 'h5/data',
    contentCount: content.length,
    releasedOnly: true
  }) + ';');

  const output = parts.join('\n') + '\n';
  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, output, 'utf8');
  fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2), 'utf8');

  report.artifact = { file: path.relative(__dirname, OUT_FILE), bytes: Buffer.byteLength(output, 'utf8') };
  console.log('[build-data] ' + report.artifact.file + ' ' + report.artifact.bytes + ' bytes');
  console.log('[build-data] 源 -> 产物数量对照：');
  console.log('  作品 ' + report.sourceCounts.contentReleased + ' -> ' + report.outputCounts.content +
    ' (电影 ' + byType.movie + ' / 剧集 ' + byType.series + ' / 特别呈现 ' + byType.special + ' / 短片 ' + byType.short + ')');
  console.log('  角色 ' + report.sourceCounts.characters + ' -> ' + report.outputCounts.characters);
  console.log('  关系 ' + report.sourceCounts.relations + ' -> ' + report.outputCounts.relations);
  console.log('  路线 ' + report.sourceCounts.routes + ' -> ' + report.outputCounts.routes);
  console.log('  专题 ' + report.sourceCounts.specialRoutes + ' -> ' + report.outputCounts.specialRoutes);
  console.log('  未上映 ' + report.sourceCounts.upcoming + ' -> ' + report.outputCounts.upcoming +
    '（过滤待核实：' + (report.filtered.droppedUpcoming.join(', ') || '无') + '）');
  if (report.warnings.length) {
    console.log('[build-data] 警告：');
    report.warnings.forEach(function (x) { console.log('  - ' + x); });
  }
  fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2), 'utf8');
  return report;
}

if (require.main === module) {
  try {
    build();
  } catch (err) {
    console.error('[build-data] 失败：' + err.message);
    process.exit(1);
  }
}

module.exports = { build: build };
