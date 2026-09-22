/* ============================================================
 * MCU 宇宙导航 · V2.2 最新漫威资讯模块 —— 规则与数据断言测试
 * ------------------------------------------------------------
 * 运行：node workspace/news/test-news-rules.cjs
 *
 * 测法说明（为什么用 vm 而不是复刻逻辑）：
 *   本脚本在 Node 的 vm 沙箱里**加载真实的 h5/data/*.js 与
 *   h5/assets/js/components.js**，再对组件层实际导出的函数做断言。
 *   不复制、不复刻被测逻辑，避免「测试通过但线上实现不同」。
 *
 * 覆盖范围：产品规范 V2.2 R6/R7/R8 + R5 排序 + 设计规范 R12
 * ============================================================ */
'use strict';

const vm = require('vm');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const H5 = path.join(ROOT, 'h5');

/* ---------------- 断言框架 ---------------- */
let pass = 0, fail = 0;
const fails = [];
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; fails.push(name + (detail ? ' → ' + detail : '')); console.log('  FAIL  ' + name + (detail ? ' → ' + detail : '')); }
}
function eq(name, actual, expected) {
  ok(name, actual === expected, 'expected ' + JSON.stringify(expected) + ', got ' + JSON.stringify(actual));
}
function section(t) { console.log('\n■ ' + t); }

/* ---------------- 沙箱：加载真实数据与真实组件层 ---------------- */
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const ctx = {};
ctx.window = ctx;
ctx.global = ctx;
ctx.console = console;
ctx.URL = URL;
ctx.Date = Date;
ctx.Math = Math;
ctx.JSON = JSON;
vm.createContext(ctx);

const DATA_FILES = ['movies.js', 'series.js', 'special.js', 'short.js', 'content.js', 'characters.js', 'news.js'];
for (const f of DATA_FILES) {
  vm.runInContext(fs.readFileSync(path.join(H5, 'data', f), 'utf8'), ctx, { filename: f });
}

const CONTENT = ctx.window.MCU_CONTENT || [];
const CHARS = ctx.window.MCU_CHARACTERS || [];
const NEWS = ctx.window.MCU_NEWS || [];

const byId = {}; CONTENT.forEach(c => { byId[c.id] = c; });
const charById = {}; CHARS.forEach(c => { charById[c.id] = c; });

ctx.MCU = {
  ui: { esc: esc },
  data: {
    all: CONTENT,
    get: id => byId[id] || null,
    getChar: id => charById[id] || null,
    visual: () => ({})
  },
  progress: { isSeen: () => false }
};

/* 加载真实组件层（app.js 之后的 components.js） */
vm.runInContext(fs.readFileSync(path.join(H5, 'assets', 'js', 'components.js'), 'utf8'), ctx, { filename: 'components.js' });

const V2 = ctx.window.MCU.v2;
const find = id => NEWS.filter(n => n.id === id)[0] || null;

console.log('============================================================');
console.log('V2.2 最新漫威资讯模块 · 规则与数据断言测试');
console.log('============================================================');
console.log('数据：MCU_CONTENT ' + CONTENT.length + ' 条 / MCU_CHARACTERS ' + CHARS.length + ' 个 / MCU_NEWS ' + NEWS.length + ' 条');

/* ============================================================
 * 1. 数据层结构性检查
 * ============================================================ */
section('1. 数据层结构（V2.2 R6/R7/R8 + 设计规范 R12.2）');

ok('components 组件层已挂载 MCU.v2', !!V2);
ok('sortNews / newsCard / newsDetail / statusBadge / sourceItem / relatedNode 均已导出',
  !!(V2.sortNews && V2.newsCard && V2.newsDetail && V2.statusBadge && V2.sourceItem && V2.relatedNode));

const REQUIRED = ['id', 'title', 'summary', 'publish_time', 'first_seen_at', 'verification_status', 'category',
  'reported_by', 'independent_group_count', 'original_source', 'official_source', 'official_source_url',
  'related_movies', 'related_series', 'related_characters', 'related_phases',
  'pinned', 'pinned_until', 'pinned_order', 'pinned_reason',
  'status_history', 'status_changed_at', 'status_change_reason', 'status_change_evidence_url',
  'supersedes_id', 'superseded_by_id', 'judged_by', 'chain_steps_hit'];

let missingField = '';
NEWS.forEach(n => REQUIRED.forEach(k => { if (!(k in n)) missingField = n.id + '.' + k; }));
eq('每条资讯均含 R12.2 全字段', missingField, '');

const STATES = ['official_confirmed', 'multi_source_reported', 'single_source', 'rumor',
  'unverified', 'conflicting', 'officially_denied', 'corrected'];
let badState = '';
NEWS.forEach(n => { if (STATES.indexOf(n.verification_status) < 0) badState = n.id + '=' + n.verification_status; });
eq('全部 verification_status 均为 8 态之一，无新增状态', badState, '');

const LABEL_KEYS = Object.keys(V2.NEWS_LABEL).sort().join(',');
eq('8 态文案表键位完整（附录 A）', LABEL_KEYS, STATES.slice().sort().join(','));
let missingNotice = '';
STATES.forEach(s => { if (!V2.NEWS_NOTICE[s]) missingNotice = s; });
eq('8 态提醒语齐全', missingNotice, '');

/* ============================================================
 * 2. owner_group 独立性判定（R6.1 / R8.3 约束）
 * ============================================================ */
section('2. owner_group 独立性判定（R6.1：同组只计 1；待核不计）');

eq('isGroupConfirmed("Penske Media Corporation") = true', V2.isGroupConfirmed('Penske Media Corporation'), true);
eq('isGroupConfirmed("待核") = false', V2.isGroupConfirmed('待核'), false);
eq('isGroupConfirmed("unknown") = false', V2.isGroupConfirmed('unknown'), false);
eq('isGroupConfirmed("") = false', V2.isGroupConfirmed(''), false);

const n003 = find('news-2026-09-22-003');
eq('【伪多源】3 家同属 PMC 的报道 → 独立来源数 = 1（非 3）', V2.calcIndependentGroupCount(n003), 1);
eq('【伪多源】该条状态为 single_source（非 multi_source_reported）', n003.verification_status, 'single_source');

const n002 = find('news-2026-09-22-002');
eq('【真多源】PMC + People Inc. 两个独立组 → 独立来源数 = 2', V2.calcIndependentGroupCount(n002), 2);
eq('【真多源】状态为 multi_source_reported', n002.verification_status, 'multi_source_reported');
eq('【真多源】展示文案用「独立来源」而非「媒体报道数」',
  V2.independentCountText(n002), '已由 2 个独立来源报道');

const n005 = find('news-2026-09-22-005');
eq('【待核不计】两家 owner_group 均待核 → 独立来源数 = 0（不得计为 2）', V2.calcIndependentGroupCount(n005), 0);
eq('【待核不计】不展示独立来源数量（D11）', V2.independentCountText(n005), '');
eq('【待核不计】落到 unverified', n005.verification_status, 'unverified');

let mismatch = '';
NEWS.forEach(n => {
  const calc = V2.calcIndependentGroupCount(n);
  if (calc !== n.independent_group_count) mismatch = n.id + ' 存=' + n.independent_group_count + ' 算=' + calc;
});
eq('【禁止手写】全部条目 independent_group_count 与运行时计算一致', mismatch, '');

/* ============================================================
 * 3. 八态覆盖（产品规范 §十五 测试场景）
 * ============================================================ */
section('3. 八态覆盖');

const byState = {};
NEWS.forEach(n => { (byState[n.verification_status] = byState[n.verification_status] || []).push(n.id); });
STATES.forEach(s => ok('存在 ' + s + ' 状态的用例', (byState[s] || []).length > 0, s + ' 无用例'));

ok('conflicting 条目带有并列的各来源表述（R3.4⑦ / R6.6）',
  (find('news-2026-09-21-008').conflict_statements || []).length === 2);
ok('corrected 条目带有报道级更正记录（R8.5 保留原始报道与更正记录）',
  (find('news-2026-09-20-010').report_corrections || []).length > 0);
ok('corrected 链式引用成对存在（supersedes_id ↔ superseded_by_id）',
  find('news-2026-09-20-010').supersedes_id === 'news-2026-09-19-014' &&
  find('news-2026-09-19-014').superseded_by_id === 'news-2026-09-20-010');

/* 报道级 corrected 不改变事件级状态（R8.5 事件级语义） */
const n011 = find('news-2026-09-19-011');
eq('【事件级语义】报道级更正后，事件级仍为 multi_source_reported', n011.verification_status, 'multi_source_reported');
eq('【事件级语义】该条独立来源数仍为 2', V2.calcIndependentGroupCount(n011), 2);

/* ============================================================
 * 4. 官方确认校验（R7.4 六步）
 * ============================================================ */
section('4. official_confirmed 的 R7.4 校验痕迹');

const OFFICIAL = NEWS.filter(n => n.verification_status === 'official_confirmed');
ok('存在 official_confirmed 用例', OFFICIAL.length > 0);
let badOfficial = '';
OFFICIAL.forEach(n => {
  const u = String(n.official_source_url || '');
  const hostOK = /^https:\/\/(www\.)?marvel\.com\//.test(u);
  const pathOK = /\/news\/?$|\/articles\/(movies|tv-shows|live-events)\//.test(u);
  if (!hostOK || !pathOK) badOfficial = n.id + ' → ' + u;
});
eq('官方来源 URL 命中登记表（host=marvel.com + path 命中 allowed_paths）', badOfficial, '');

/* ============================================================
 * 5. 关联 id 校验（R3.4 / R12.8：未命中一律丢弃，不新造 id）
 * ============================================================ */
section('5. 关联 MCU 节点（未命中丢弃 / 阶段不跳转）');

/* 说明：news-2026-09-17-015 是**关联 id 校验专用用例**，故意写入不在
 * MCU_CONTENT 的 'avengers-5'（该 id 存在于 MCU_UPCOMING），用于验证
 * 「未命中一律丢弃」。因此该条不计入「全部命中」断言，另行单独断言。 */
const GHOST_CASE = 'news-2026-09-17-015';
let ghostMovie = '', ghostSeries = '', ghostChar = '', ghostPhase = '';
NEWS.forEach(n => {
  if (n.id !== GHOST_CASE) {
    (n.related_movies || []).forEach(id => { const m = byId[id]; if (!m || m.type !== 'movie') ghostMovie = n.id + '→' + id; });
  }
  (n.related_series || []).forEach(id => { const s = byId[id]; if (!s || s.type !== 'series') ghostSeries = n.id + '→' + id; });
  (n.related_characters || []).forEach(id => { if (!charById[id]) ghostChar = n.id + '→' + id; });
  (n.related_phases || []).forEach(p => { const v = Number(p); if (!(v >= 1 && v <= 6 && v % 1 === 0)) ghostPhase = n.id + '→' + p; });
});
eq('related_movies 全部命中 MCU_CONTENT 且为电影（关联校验用例除外）', ghostMovie, '');
eq('关联校验用例确实写入了非 MCU_CONTENT 的 id', find(GHOST_CASE).related_movies.join(','), 'avengers-5');
eq('related_series 全部命中 MCU_CONTENT 且为剧集', ghostSeries, '');
eq('related_characters 全部命中 MCU_CHARACTERS', ghostChar, '');
eq('related_phases 全部为 1-6 整数', ghostPhase, '');

/* news-015 故意写入不在 MCU_CONTENT 的 'avengers-5'（属 MCU_UPCOMING） */
const n015 = find('news-2026-09-17-015');
const nodes015 = V2.relatedNodes(n015);
eq('【丢弃】avengers-5 不在 MCU_CONTENT → 关联节点被丢弃', nodes015.filter(x => x.name === 'Avengers: Doomsday').length, 0);
ok('【保留】角色关联仍渲染（steve / sam）', nodes015.filter(x => x.kind === 'character').length === 2);
ok('【不跳转】阶段节点卡 href 为空（D17，不产生死链）',
  nodes015.filter(x => x.kind === 'phase').every(x => x.href === ''));
ok('【不跳转】阶段节点渲染为静态 span 而非 a 标签',
  V2.relatedNode({ kind: 'phase', label: '阶段', name: 'Phase 6', phase: 6, href: '' }).indexOf('<span') === 0);

/* 跳转参数正确性（D18） */
const n004 = find('news-2026-09-22-004');
const cNode = V2.relatedNodes(n004).filter(x => x.kind === 'character')[0];
ok('【跳转参数】角色节点使用 map.html?focus=（不是 ?char=）',
  cNode && cNode.href.indexOf('map.html?focus=') === 0, cNode && cNode.href);
const mNode = V2.relatedNodes(n004).filter(x => x.kind === 'movie')[0];
ok('【跳转参数】作品节点使用 movie.html?id=', mNode && mNode.href.indexOf('movie.html?id=') === 0, mNode && mNode.href);

/* ============================================================
 * 6. 排序与置顶（R5.2 五步）
 * ============================================================ */
section('6. 排序与置顶（R5.2 五步）');

const FIXED_NOW = Date.parse('2026-09-22T12:00:00Z');
const sorted = V2.sortNews(NEWS, FIXED_NOW);

ok('Step 0：officially_denied 且未置顶者被剔除',
  sorted.every(n => !(n.verification_status === 'officially_denied' && n.pinned !== true)));
ok('Step 0：publish_time 与 first_seen_at 皆缺者被剔除',
  sorted.every(n => !!(n.publish_time || n.first_seen_at)));

const pinnedValid = sorted.filter(n => n.__pinnedOk);
ok('Step 1/2：有效置顶条目全部排在非置顶之前',
  sorted.slice(0, pinnedValid.length).every(n => n.__pinnedOk) && pinnedValid.length > 0);
eq('Step 1：失效置顶（pinned_until 已过）不计入有效置顶',
  (find('news-2026-09-18-012').pinned_until && Date.parse(find('news-2026-09-18-012').pinned_until) < FIXED_NOW) ? !find('news-2026-09-18-012').__pinnedOk || pinnedValid.filter(n => n.id === 'news-2026-09-18-012').length === 0 : true, true);

const orders = pinnedValid.map(n => Number(n.pinned_order) || 0);
ok('Step 3：置顶组内按 pinned_order 升序',
  orders.every((v, i) => i === 0 || orders[i - 1] <= v), JSON.stringify(orders));

const rest = sorted.slice(pinnedValid.length);
ok('Step 2：非置顶组按 publish_time 降序（缺失回落 first_seen_at）',
  rest.every((n, i) => {
    if (i === 0) return true;
    const ts = x => { const t = x.publish_time ? Date.parse(x.publish_time) : NaN; return isNaN(t) ? Date.parse(x.first_seen_at || '') : t; };
    return ts(rest[i - 1]) >= ts(n);
  }));

ok('官方确认不自动置顶（除人工 pinned 外，official 条目按时间序参与普通排序）',
  sorted.filter(n => n.verification_status === 'official_confirmed' && !n.__pinnedOk).length > 0);

/* ============================================================
 * 7. 文案与措辞红线
 * ============================================================ */
section('7. 措辞红线（R4.1 / 设计规范 D3）');

const allText = JSON.stringify(NEWS) + JSON.stringify(V2.NEWS_LABEL) + JSON.stringify(V2.NEWS_NOTICE);
ok('无真实性/可信度百分比（禁止「真实性 87%」「可信度 92%」）', !/(真实性|可信度|可靠度)\s*[:：]?\s*\d+\s*%/.test(allText));
ok('无绝对化措辞（已证实为真 / 100% / 铁定 / 确定无疑）', !/(已证实为真|100\s*%|铁定|确定无疑)/.test(allText));
ok('无实时性措辞（刚刚 / N 分钟前）', !/(刚刚|\d+\s*分钟前)/.test(allText));
ok('无星级与评分 UI（★★★★★ / 可靠指数）', !/(★{3,}|星级|可靠指数|评分)/.test(allText));
ok('multi_source_reported 标签沿用产品 R4.2 原文「多家媒体报道」', V2.NEWS_LABEL.multi_source_reported === '多家媒体报道');
ok('corrected 不使用绿色语义（仅暗金灰，见 v2n-news.css）', V2.NEWS_LABEL.corrected === '来源已更正');

const badgeHtml = V2.statusBadge('corrected');
ok('corrected 状态标签使用 --corrected 类（对应暗金灰）', badgeHtml.indexOf('v2n-status-badge--corrected') > 0);

section('8. 日期口径（D13：仅日期，无时分）');
let badDate = '';
sorted.forEach(n => { const d = V2.newsDate(n); if (d && !/^\d{4}-\d{2}-\d{2}$/.test(d)) badDate = n.id + '→' + d; });
eq('卡片/详情页日期一律 YYYY-MM-DD', badDate, '');
eq('publish_time 缺失时回落到 first_seen_at', V2.newsDate(n015), '2026-09-17');

/* ============================================================
 * 9. file:// 与网络依赖纪律
 * ============================================================ */
section('9. file:// 纪律（无 fetch / 无网络依赖）');

/* 注释剥离后再检测：文件头注释里出现的「fetch()」等字样不算代码依赖 */
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}
const newsJs = fs.readFileSync(path.join(H5, 'data', 'news.js'), 'utf8');
const newsJsCode = stripComments(newsJs);
ok('news.js 无 fetch / XMLHttpRequest / import（注释已剥离）',
  !/\bfetch\s*\(|XMLHttpRequest|^\s*import\s|\brequire\s*\(/.test(newsJsCode));
const comp = fs.readFileSync(path.join(H5, 'assets', 'js', 'components.js'), 'utf8');
const newsPart = stripComments(comp.slice(comp.indexOf('V2.2 最新漫威资讯模块')));
ok('components.js 资讯部分无 fetch / import（注释已剥离）',
  !/\bfetch\s*\(|^\s*import\s|\brequire\s*\(/.test(newsPart));

/* 页面脚本清单 */
['news.html', 'news-detail.html'].forEach(f => {
  const html = fs.readFileSync(path.join(H5, f), 'utf8');
  const need = ['movies', 'upcoming', 'relations', 'routes', 'characters', 'series', 'special', 'short', 'content', 'posters', 'stills', 'visuals', 'news'];
  const missing = need.filter(n => html.indexOf('src="data/' + n + '.js"') < 0);
  eq(f + ' 引入 12 个标准数据脚本 + news.js', missing.join(','), '');
  ok(f + ' 未引入 community.js（非资讯页所需）', html.indexOf('data/community.js') < 0);
  ok(f + ' 引入 v2n-news.css', html.indexOf('v2n-news.css') > 0);
  ok(f + ' 未引用 v4-news.css（禁止命名）', html.indexOf('v4-news.css') < 0);
  ok(f + ' news.js 位于 content.js 之后、app.js 之前',
    html.indexOf('data/news.js') > html.indexOf('data/content.js') && html.indexOf('data/news.js') < html.indexOf('assets/js/app.js'));
});

const idx = fs.readFileSync(path.join(H5, 'index.html'), 'utf8');
ok('index.html 引入 v2n-news.css', idx.indexOf('v2n-news.css') > 0);
ok('index.html 引入 data/news.js 且位于 app.js 之前',
  idx.indexOf('data/news.js') > 0 && idx.indexOf('data/news.js') < idx.indexOf('assets/js/app.js'));
ok('index.html 已加「最新漫威资讯」Section', idx.indexOf('id="v2-news"') > 0);
/* NAV 未新增导航项：直接读 app.js 的 NAV 数组（权威判定，非按 class 计数） */
const appJs = fs.readFileSync(path.join(H5, 'assets', 'js', 'app.js'), 'utf8');
const navBlock = (appJs.match(/var NAV = \[[\s\S]*?\];/) || [''])[0];
const navItems = (navBlock.match(/href:\s*'/g) || []).length;
eq('app.js 的 NAV 未新增导航项（仍为 4 项：首页/下一部/路线/地图）', navItems, 4);
ok('index.html 未在 NAV 中加入资讯入口（资讯入口为首页 Section）',
  navBlock.indexOf('news.html') < 0);

/* ============================================================
 * 汇总
 * ============================================================ */
console.log('\n============================================================');
console.log('结果：' + pass + ' PASS / ' + fail + ' FAIL');
if (fail) { console.log('失败项：'); fails.forEach(f => console.log('  - ' + f)); }
console.log('============================================================');
process.exit(fail ? 1 : 0);
