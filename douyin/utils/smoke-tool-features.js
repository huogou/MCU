/* ============================================================
 * MCU 抖音小程序 · 工具化功能冒烟测试（headless）
 * ------------------------------------------------------------
 * 覆盖：2026-09-08 整改第二阶段新增的
 *   作品查询（搜索/类型/阶段/状态/排序）· 作品详情 · 已看 · 收藏 ·
 *   跨页数据联动 · LocalStorage 持久化 · 跳转链路无死链
 *
 * 运行方式（在 douyin/ 目录下执行）：
 *   node utils/smoke-tool-features.js
 *
 * 原理：
 *   1. 桩化全局 tt 运行时（getStorageSync/setStorageSync 走内存 Map）
 *   2. 桩化全局 Page()，捕获页面配置对象后手动实例化
 *   3. 直接调用页面生命周期与方法，断言 this.data 与 userState 真实落库结果
 *   说明：本测试验证数据层与页面逻辑，不验证像素级视觉。
 * ============================================================ */

const path = require('path');
const fs = require('fs');

/* ───────── ① 桩化 tt 运行时 ───────── */
const store = new Map();
const navLog = [];
global.tt = {
  getStorageSync: function (k) { return store.get(k); },
  setStorageSync: function (k, v) { store.set(k, v); },
  removeStorageSync: function (k) { store.delete(k); },
  showToast: function () {},
  showModal: function () {},
  setNavigationBarTitle: function () {},
  createCanvasContext: function () {
    return {
      setFillStyle() {}, fillRect() {}, fillText() {}, drawImage() {}, save() {}, restore() {},
      setFontSize() {}, setTextAlign() {}, measureText() { return { width: 10 }; }, beginPath() {},
      arc() {}, fill() {}, stroke() {}, moveTo() {}, lineTo() {}, closePath() {}, setLineWidth() {},
      setStrokeStyle() {}, setGlobalAlpha() {}, clearRect() {}, translate() {}, rotate() {}, clip() {},
      createLinearGradient() { return { addColorStop() {} }; }, draw() {}, drawImageAsync() {}
    };
  },
  createSelectorQuery: function () {
    return { select() { return { boundingClientRect() { return this; }, exec() {} }; },
             selectAll() { return { boundingClientRect() { return this; }, exec() {} }; },
             in() { return this; } };
  },
  getSystemInfoSync: function () { return { windowWidth: 375, pixelRatio: 2, platform: 'devtools' }; },
  navigateTo: function (o) { navLog.push({ type: 'navigateTo', url: o.url }); },
  redirectTo: function (o) { navLog.push({ type: 'redirectTo', url: o.url }); },
  switchTab: function (o) { navLog.push({ type: 'switchTab', url: o.url }); },
  getStorage: function (o) { if (o && o.success) o.success({ data: store.get(o.key) }); },
  setStorage: function (o) { store.set(o.key, o.data); if (o && o.success) o.success(); }
};
global.App = function () {};
global.getApp = function () { return { globalData: { storeKey: 'mcu_nav_user_v1' } }; };

/* ───────── ② 断言框架 ───────── */
let pass = 0, fail = 0;
const failures = [];
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; failures.push(name + (extra ? '  → ' + extra : '')); console.log('  FAIL  ' + name + (extra ? '  → ' + extra : '')); }
}
function eq(name, actual, expected) { ok(name, actual === expected, 'got ' + JSON.stringify(actual) + ', want ' + JSON.stringify(expected)); }
function section(t) { console.log('\n── ' + t + ' ──'); }

/* ───────── ③ 页面挂载 ───────── */
function mount(relPath) {
  const abs = path.resolve(__dirname, '..', relPath);
  let cfg = null;
  const prevPage = global.Page;
  global.Page = function (c) { cfg = c; };
  delete require.cache[require.resolve(abs)];
  require(abs);
  global.Page = prevPage;
  if (!cfg) throw new Error('Page() not captured: ' + relPath);
  const page = {};
  for (const k in cfg) if (Object.prototype.hasOwnProperty.call(cfg, k)) page[k] = cfg[k];
  page.data = cfg.data ? JSON.parse(JSON.stringify(cfg.data)) : {};
  page.setData = function (partial, cb) {
    for (const k in partial) if (Object.prototype.hasOwnProperty.call(partial, k)) page.data[k] = partial[k];
    if (typeof cb === 'function') cb.call(page);
  };
  return page;
}

const ROOT = path.resolve(__dirname, '..');
const mcuData = require(path.join(ROOT, 'models/mcuData.js'));
const userState = require(path.join(ROOT, 'models/userState.js'));

/* 清空本地数据，保证每次运行起点一致 */
store.clear();
userState.setState({ watched: {}, want_to_watch: {}, favorite: {}, saved_routes: [], milestones_shown: {} });

/* ══════════════════════════════════════════════════════════
   A. 数据源完整性
   ══════════════════════════════════════════════════════════ */
section('A. 数据源完整性');
const TOTAL = mcuData.all.length;
eq('A1 内容总数 59', TOTAL, 59);
eq('A2 上映序列表长度与总数一致', mcuData.byRelease.length, TOTAL);
let roAscending = true;
for (let i = 1; i < mcuData.byRelease.length; i++) {
  if (mcuData.byRelease[i].ro < mcuData.byRelease[i - 1].ro) roAscending = false;
}
ok('A3 byRelease 按 ro 升序', roAscending);
let fieldsComplete = true, missing = [];
mcuData.all.forEach(function (c) {
  if (!c.id || !c.cn || !c.type || !c.date || !c.phase) { fieldsComplete = false; missing.push(c.id); }
});
ok('A4 所有作品含 id/cn/type/date/phase', fieldsComplete, missing.join(','));

const typeCounts = mcuData.counts();
eq('A5 类型计数 电影 38', typeCounts.movie, 38);

/* ══════════════════════════════════════════════════════════
   B. 作品查询页（library）
   ══════════════════════════════════════════════════════════ */
section('B. 作品查询 library');
const lib = mount('pages/library/library.js');
lib.onLoad();
lib.applyFilters();
eq('B1 默认无筛选返回全部', lib.data.resultCount, TOTAL);

lib.setData({ typeKey: 'movie' }, function () { this.applyFilters(); });
eq('B2 类型=电影', lib.data.resultCount, typeCounts.movie);

lib.setData({ typeKey: 'series' }, function () { this.applyFilters(); });
eq('B3 类型=剧集', lib.data.resultCount, typeCounts.series);

lib.setData({ typeKey: 'all', phaseKey: 1 }, function () { this.applyFilters(); });
const p1 = mcuData.all.filter(function (c) { return c.phase === 1; }).length;
eq('B4 阶段=P1', lib.data.resultCount, p1);

lib.setData({ phaseKey: 0, keyword: '钢铁侠' }, function () { this.applyFilters(); });
ok('B5 中文关键词命中', lib.data.resultCount >= 1 && lib.data.list.every(function (x) { return x.cn.indexOf('钢铁侠') >= 0; }),
   'count=' + lib.data.resultCount);

lib.setData({ keyword: 'iron' }, function () { this.applyFilters(); });
const ironExpect = mcuData.all.filter(function (c) { return (c.en || '').toLowerCase().indexOf('iron') >= 0; }).length;
eq('B6 英文关键词命中数', lib.data.resultCount, ironExpect);

lib.setData({ keyword: 'zzz-不存在' }, function () { this.applyFilters(); });
eq('B7 无匹配结果计数为 0', lib.data.resultCount, 0);
eq('B7b 无匹配时 hasResult=false', lib.data.hasResult, false);

lib.setData({ keyword: '' }, function () { this.applyFilters(); });

/* 排序切换 */
lib.setData({ sortKey: 'chrono' }, function () { this.applyFilters(); });
eq('B8 切换故事时间线排序后数量不变', lib.data.resultCount, TOTAL);
lib.setData({ sortKey: 'release' }, function () { this.applyFilters(); });

/* 重置 */
lib.setData({ typeKey: 'special', phaseKey: 4, statusKey: 'watched' }, function () { this.applyFilters(); });
lib.onReset();
eq('B9 重置后恢复全部', lib.data.resultCount, TOTAL);
eq('B9b 重置后 isFiltering=false', lib.data.isFiltering, false);

/* ══════════════════════════════════════════════════════════
   C. 作品详情页（movie）
   ══════════════════════════════════════════════════════════ */
section('C. 作品详情 movie');
const mv = mount('pages/movie/movie.js');
mv.onLoad({ id: 'endgame' });
eq('C1 id 有效时 notFound=false', mv.data.notFound, false);
eq('C2 作品名称正确', mv.data.cn, mcuData.get('endgame').cn);
ok('C3 信息表不少于 5 行', mv.data.infoRows.length >= 5, 'rows=' + mv.data.infoRows.length);
ok('C4 信息表含「MCU 阶段」', mv.data.infoRows.some(function (r) { return r.k === 'MCU 阶段'; }));
ok('C5 信息表含上映日期行', mv.data.infoRows.some(function (r) { return String(r.k).indexOf('日期') > 0; }));
ok('C6 简介非空', !!mv.data.synopsis);
ok('C7 类型标签非空', !!mv.data.typeLabel);
ok('C8 阶段标签非空', !!mv.data.phaseText);
ok('C9 相关作品 ≤4 条', mv.data.relations.length <= 4, 'count=' + mv.data.relations.length);
ok('C10 相关作品每条含类型标签', mv.data.relations.every(function (r) { return !!r.typeLabel; }));
ok('C11 初始状态为未看', mv.data.watched === false && mv.data.watchedLabel === '标记为已看');
ok('C12 初始按钮文案为收藏', mv.data.favorLabel === '收藏这部作品');

const mvBad = mount('pages/movie/movie.js');
mvBad.onLoad({});
eq('C13 缺 id 走兜底', mvBad.data.notFound, true);
const mvMissing = mount('pages/movie/movie.js');
mvMissing.onLoad({ id: 'not-a-real-id' });
eq('C14 id 不存在走兜底', mvMissing.data.notFound, true);

/* ══════════════════════════════════════════════════════════
   D. 观影记录：标记已看 / 取消已看
   ══════════════════════════════════════════════════════════ */
section('D. 观影记录（已看 / 取消）');
eq('D1 初始已看数为 0', userState.count(), 0);
mv.onToggleWatched();
eq('D2 详情标记已看后 userState.count=1', userState.count(), 1);
eq('D3 详情页 watched 状态同步', mv.data.watched, true);
eq('D4 按钮文案切换为取消已看', mv.data.watchedLabel, '取消已看');

/* 跨页联动：my-mcu */
const my = mount('pages/my-mcu/my-mcu.js');
my.refresh();
eq('D5 MyMCU 已看数同步=1', my.data.explored, 1);
eq('D6 MyMCU 未看数=总数-1', my.data.unwatchedCount, TOTAL - 1);
my.setData({ listKey: 'watched' }, function () { this.buildList(); });
eq('D7 MyMCU 已看列表含该作品', my.data.list.length, 1);
eq('D7b 已看列表项 id 正确', my.data.list[0].id, 'endgame');
my.setData({ listKey: 'unwatched' }, function () { this.buildList(); });
eq('D8 MyMCU 未看列表=总数-1', my.data.list.length, TOTAL - 1);

/* 跨页联动：library 状态筛选 */
lib.setData({ statusKey: 'watched' }, function () { this.applyFilters(); });
eq('D9 作品查询「已看」筛选=1', lib.data.resultCount, 1);
lib.setData({ statusKey: 'unwatched' }, function () { this.applyFilters(); });
eq('D10 作品查询「未看」筛选=总数-1', lib.data.resultCount, TOTAL - 1);
lib.setData({ statusKey: 'all', typeKey: 'all' }, function () { this.applyFilters(); });

/* 取消已看 */
mv.onToggleWatched();
eq('D11 取消已看后 userState.count=0', userState.count(), 0);
eq('D12 详情页 watched 回落到 false', mv.data.watched, false);
my.refresh();
eq('D13 MyMCU 已看数回落到 0', my.data.explored, 0);
my.setData({ listKey: 'watched' }, function () { this.buildList(); });
eq('D14 MyMCU 已看列表清空', my.data.list.length, 0);

/* ══════════════════════════════════════════════════════════
   E. 收藏
   ══════════════════════════════════════════════════════════ */
section('E. 收藏（此前有 toggleFav 无入口，本轮补齐）');
eq('E1 初始收藏数为 0', userState.favIds().length, 0);
mv.onToggleFav();
eq('E2 详情「收藏」后 favorites=1', userState.favIds().length, 1);
eq('E3 详情页 favored=true', mv.data.favored, true);
eq('E4 按钮文案切换为取消收藏', mv.data.favorLabel, '取消收藏');

my.refresh();
eq('E5 MyMCU 收藏计数同步=1', my.data.favCount, 1);
my.setData({ listKey: 'fav' }, function () { this.buildList(); });
eq('E6 MyMCU 收藏列表含该作品', my.data.list.length, 1);
eq('E6b 收藏列表项 favored=true', my.data.list[0].favored, true);

lib.applyFilters();
const favItem = lib.data.list.find(function (x) { return x.id === 'endgame'; });
ok('E7 作品查询列表标记 favored', favItem && favItem.favored === true);

/* 再收藏一部，验证多条目 */
mv.setData({ id: 'iron-man' }, function () { this.refresh(); });
mv.onToggleFav();
eq('E8 第二部收藏后 favorites=2', userState.favIds().length, 2);

/* 列表内联取消收藏 */
my.refresh();
my.setData({ listKey: 'fav' }, function () { this.buildList(); });
eq('E9 收藏列表为 2 条', my.data.list.length, 2);
const targetId = my.data.list[0].id;
my.onToggleFavItem({ currentTarget: { dataset: { id: targetId } } });
eq('E10 内联取消收藏后收藏列表=1', my.data.list.length, 1);
eq('E11 取消的是指定作品', my.data.list[0].id !== targetId, true);
eq('E12 userState 收藏数同步=1', userState.favIds().length, 1);

/* ══════════════════════════════════════════════════════════
   F. LocalStorage 持久化（模拟退出重进）
   ══════════════════════════════════════════════════════════ */
section('F. LocalStorage 持久化');
const beforeWatched = userState.count();
const beforeFav = userState.favIds().length;
const persistedRaw = store.get('mcu_nav_user_v1');
ok('F1 storage key 已落盘', !!persistedRaw && typeof persistedRaw === 'object');
eq('F2 落盘已看数与内存一致', Object.keys(persistedRaw.watched).length, beforeWatched);
eq('F3 落盘收藏数与内存一致', Object.keys(persistedRaw.favorite).length, beforeFav);

/* 彻底重新挂载所有页面（等价于冷启动），模型层会重新从 storage 读 */
const my2 = mount('pages/my-mcu/my-mcu.js');
my2.refresh();
eq('F4 重进后 MyMCU 已看数保持', my2.data.explored, beforeWatched);
eq('F5 重进后 MyMCU 收藏数保持', my2.data.favCount, beforeFav);
my2.setData({ listKey: 'fav' }, function () { this.buildList(); });
eq('F6 重进后收藏列表仍可显示', my2.data.list.length, beforeFav);

const lib2 = mount('pages/library/library.js');
lib2.onLoad();
lib2.applyFilters();
eq('F7 重进后作品查询收藏计数保持', lib2.data.favCount, beforeFav);

/* 清空后再次验证写入路径 */
userState.clear();
eq('F8 clear 后已看归零', userState.count(), 0);

/* ══════════════════════════════════════════════════════════
   G. 跳转链路与页面注册（死链检查）
   ══════════════════════════════════════════════════════════ */
section('G. 跳转链路无死链');
const appJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'app.json'), 'utf8'));
const registered = appJson.pages.map(function (p) { return '/' + p; });

/* 1. 静态扫描所有页面源码中的跳转目标 */
const pageDirs = fs.readdirSync(path.join(ROOT, 'pages'));
const deadLinks = [];
pageDirs.forEach(function (d) {
  const files = fs.readdirSync(path.join(ROOT, 'pages', d));
  files.filter(function (f) { return f.endsWith('.js') || f.endsWith('.wxml'); }).forEach(function (f) {
    const src = fs.readFileSync(path.join(ROOT, 'pages', d, f), 'utf8');
    const re = /url:\s*'([^']+)'/g;
    let m;
    while ((m = re.exec(src)) !== null) {
      const u = m[1].split('?')[0];
      if (u.indexOf('/pages/') === 0 && registered.indexOf(u) < 0) deadLinks.push(d + '/' + f + ' → ' + u);
    }
  });
});
ok('G1 无未注册页面跳转（死链）', deadLinks.length === 0, deadLinks.join(' | '));

/* 2. TabBar 配置完整性 */
ok('G2 TabBar 含 3 项', appJson.tabBar.list.length === 3);
appJson.tabBar.list.forEach(function (t) {
  ok('G3 TabBar 页已注册：' + t.text, registered.indexOf('/' + t.pagePath) >= 0);
  ok('G4 TabBar 图标存在：' + t.text,
     fs.existsSync(path.join(ROOT, t.iconPath)) && fs.existsSync(path.join(ROOT, t.selectedIconPath)));
});

/* 3. 每个页面的四件套齐全 */
let missingFiles = [];
appJson.pages.forEach(function (p) {
  ['.js', '.json', '.wxml', '.wxss'].forEach(function (ext) {
    if (!fs.existsSync(path.join(ROOT, p + ext))) missingFiles.push(p + ext);
  });
});
ok('G5 所有页面四件套齐全', missingFiles.length === 0, missingFiles.join(','));

/* 4. 运行时跳转可达：详情 → 相关作品 */
navLog.length = 0;
mv.setData({ id: 'endgame' }, function () { this.refresh(); });
if (mv.data.relations.length) {
  mv.goRelated({ currentTarget: { dataset: { id: mv.data.relations[0].id } } });
  ok('G6 相关作品点击产生跳转', navLog.length === 1 && navLog[0].url.indexOf('/pages/movie/movie?id=') === 0,
     JSON.stringify(navLog));
} else {
  ok('G6 相关作品点击产生跳转（该作品无关系，跳过）', true);
}

/* 5. 首页入口 → 作品查询 Tab */
navLog.length = 0;
const home = mount('pages/home/home.js');
home.onShow();
ok('G7 首页装配了作品查询入口', !!home.data.libraryEntry && home.data.libraryEntry.title === '作品查询');
home.goLibrary();
ok('G8 首页入口跳转 Tab2', navLog.length === 1 && navLog[0].url === '/pages/library/library', JSON.stringify(navLog));

/* 6. 列表 → 详情 */
navLog.length = 0;
lib.setData({ keyword: '复仇者' }, function () { this.applyFilters(); });
if (lib.data.list.length) {
  lib.goDetail({ currentTarget: { dataset: { id: lib.data.list[0].id } } });
  ok('G9 作品列表点击进详情', navLog.length === 1 && navLog[0].url.indexOf('/pages/movie/movie?id=') === 0,
     JSON.stringify(navLog));
} else {
  ok('G9 作品列表点击进详情（无结果，跳过）', true);
}

/* ══════════════════════════════════════════════════════════
   H. 关键页面可正常加载（防白屏）
   ══════════════════════════════════════════════════════════ */
section('H. 关键页面加载');
try {
  const fb = mount('pages/feedback/feedback.js');
  if (typeof fb.onLoad === 'function') fb.onLoad({ from: 'my-mcu' });
  ok('H1 feedback 页可加载', true);
} catch (e) { ok('H1 feedback 页可加载', false, e.message); }

try {
  const sh = mount('pages/share/share.js');
  if (typeof sh.onLoad === 'function') sh.onLoad({ type: 'progress' });
  ok('H2 share 页可加载', true);
} catch (e) { ok('H2 share 页可加载', false, e.message); }

try {
  const ho = mount('pages/home/home.js');
  ho.onShow();
  /* 首页的总数挂在 progress.total 下，不是 data.total */
  ok('H3 home 页 refresh 正常',
     ho.data.progress && ho.data.progress.total > 0 && !!ho.data.recommend && !!ho.data.recent,
     'total=' + (ho.data.progress && ho.data.progress.total));
} catch (e) { ok('H3 home 页 refresh 正常', false, e.message); }

/* ══════════════════════════════════════════════════════════
   汇总
   ══════════════════════════════════════════════════════════ */
console.log('\n════════════════════════════════════');
console.log('  通过 ' + pass + ' 项 / 失败 ' + fail + ' 项');
if (fail) {
  console.log('  失败清单：');
  failures.forEach(function (f) { console.log('   - ' + f); });
}
console.log('════════════════════════════════════');
process.exit(fail ? 1 : 0);
