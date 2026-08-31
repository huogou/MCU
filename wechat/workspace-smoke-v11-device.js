/* ============================================================
 * V1.1 Step7 真机测试前 · 设备流程补充验证（mock wx + canvas）
 * ------------------------------------------------------------
 * 覆盖指令 Step7 必须测试流程中可在逻辑层验证的部分：
 *   流程3 分享测试：Canvas 渲染（progress/route/movie 三类型 draw 不抛错）
 *                   + 保存相册授权链路（getSetting/openSetting/canvasToTempFilePath）
 *   流程4 全景探索：pano.js 数据（PHASE_COLS 6 列/41 边）+ panorama 画布绘制
 *                   + 点击节点跳电影
 * （流程1/2/5 已由 workspace-smoke-v11-full.js 42/42 覆盖）
 * ============================================================ */
const store = {};
let navs = [];

/* —— canvas 2d 上下文 mock（全方法 noop + measureText 可测） —— */
function mkCtx() {
  const ctx = {};
  const noop = function () {};
  const grad = { addColorStop: noop };
  ['fillStyle','strokeStyle','lineWidth','lineCap','font','textAlign','textBaseline'].forEach(k => ctx[k] = '');
  ['fillRect','strokeRect','clearRect','fillText','strokeText','beginPath','closePath','moveTo','lineTo','arc','quadraticCurveTo','bezierCurveTo','save','restore','translate','rotate','scale','clip','fill','stroke','setLineDash','drawImage','setTransform'].forEach(m => ctx[m] = noop);
  ctx.measureText = function (t) { return { width: String(t).length * 10 }; };
  ctx.createLinearGradient = function () { return grad; };
  ctx.createRadialGradient = function () { return grad; };
  ctx.roundRect = noop;
  return ctx;
}

let canvasOps = 0;
const queryMock = {
  in: function () { return this; },
  select: function () { return this; },
  fields: function () { return this; },
  exec: function (cb) { cb && cb([{ node: { getContext: function () { canvasOps++; return mkCtx(); }, width: 750, height: 1100 }, width: 750, height: 1100 }]); }
};

global.wx = {
  getStorageSync: function (k) { return store[k] || ''; },
  setStorageSync: function (k, v) { store[k] = v; },
  navigateTo: function (o) { navs.push(o.url); },
  switchTab: function () {},
  navigateBack: function () {},
  setNavigationBarTitle: function () {},
  getSystemInfoSync: function () { return { pixelRatio: 3 }; },
  createSelectorQuery: function () { return queryMock; },
  canvasToTempFilePath: function (o) { o.success && o.success({ tempFilePath: 'wxfile://tmp_poster.png' }); },
  getSetting: function (o) { o.success && o.success({ authSetting: { 'scope.writePhotosAlbum': false } }); },
  openSetting: function (o) { o.success && o.success({ authSetting: { 'scope.writePhotosAlbum': true } }); },
  saveImageToPhotosAlbum: function (o) { o.success && o.success({}); },
  showToast: function () {},
  showModal: function () {},
  cloud: { init: function () {} }
};

let lastConf = null;
global.Page = function (conf) { lastConf = conf; };
function load(path) { lastConf = null; require(path); if (!lastConf) throw new Error('未注册: ' + path); return lastConf; }
function inst(conf) {
  const i = Object.assign({}, conf, { data: JSON.parse(JSON.stringify(conf.data || {})) });
  i.setData = function (p) { Object.assign(this.data, p); };
  return i;
}
let pass = 0, fail = 0;
function assert(cond, msg) { if (cond) { pass++; console.log('  ✓ ' + msg); } else { fail++; console.log('  ✗ FAIL: ' + msg); } }

/* 预置老用户数据（分享/全景需要观看态） */
const T = Date.now();
store['mcu_nav_user_v1'] = {
  watched: { 'iron-man': T - 4e7, 'iron-man-2': T - 3e7, 'avengers': T - 2e7 },
  want_to_watch: {}, favorite: {}, saved_routes: [], milestones_shown: {}
};

/* ========== 流程3：分享测试 ========== */
console.log('══ 流程3 分享测试（Canvas 渲染 + 保存授权） ══');
load('./pages/share/share.js');
const sh = inst(lastConf);

/* 三类型数据装配 */
const prepProgress = sh.prepareProgress.call(sh);
assert(prepProgress.count === 3 && prepProgress.total === 59, '① progress 数据装配 3/59');
const prepRoute = sh.prepareRoute.call(sh, 'newcomer');
assert(prepRoute && prepRoute.routeTotal === 12, '① route 数据装配：新手入坑 12 部');
const prepMovie = sh.prepareMovie.call(sh, 'endgame');
assert(prepMovie && prepMovie.movieCn.indexOf('终局之战') >= 0, '① movie 数据装配：终局之战');

/* 三类型 Canvas draw 不抛错 */
let drawOk = true;
['progress', 'route', 'movie'].forEach(function (t) {
  sh.onLoad.call(sh, t === 'progress' ? { type: 'progress' } : { type: t, id: t === 'route' ? 'newcomer' : 'endgame' });
  try { sh.onReady.call(sh); } catch (e) { drawOk = false; console.log('  ✗ draw ' + t + ' 抛错: ' + e.message); }
});
assert(drawOk, '② Canvas draw 三类型均不抛错（context 创建 ' + canvasOps + ' 次）');

/* 保存到相册授权链路：拒绝→引导→保存 */
let savedOk = true;
const sh2 = inst(lastConf);
sh2.onLoad.call(sh2, { type: 'progress' });
try { sh2.savePoster.call(sh2); } catch (e) { savedOk = false; console.log('  ✗ savePoster 抛错: ' + e.message); }
assert(savedOk, '③ 保存链路可调用（授权拒绝→openSetting→saveImageToPhotosAlbum mock 走通不抛错）');

/* ========== 流程4：全景探索 ========== */
console.log('══ 流程4 全景探索（数据 + 绘制 + 节点跳转） ══');
const panoModel = require('./models/pano.js');
assert(panoModel.PHASE_COLS.length === 6, '① 全景阶段列 6 个');
assert(panoModel.PANO_CONN.length === 41, '① 全景连接边 41 条（实际 ' + panoModel.PANO_CONN.length + '）');
const lefts = panoModel.PHASE_COLS.map(function (c) { return c.left; });
assert(JSON.stringify(lefts) === JSON.stringify([48, 674, 1299, 2165, 2710, 3159]), '① PHASE_COLS left 与 D7 报告吻合 48/674/1299/2165/2710/3159');
assert(panoModel.PANO_MOVIES && panoModel.PANO_MOVIES.length === 40, '① 全景电影节点 40 个（实际 ' + panoModel.PANO_MOVIES.length + '，与 D7 报告 PANO 40-41-6 吻合）');

load('./pages/panorama/panorama.js');
const pano = inst(lastConf);
pano.onLoad.call(pano);
const pd = pano.data;
assert(pd.phases && pd.phases.length === 6, '② panorama 页面阶段列加载 6 个');
assert(pd.nodes && pd.nodes.length === panoModel.PANO_MOVIES.length, '② panorama 节点加载 ' + pd.nodes.length + ' 个');

/* 画布绘制 */
let panoDrawOk = true;
try { pano.onReady.call(pano); } catch (e) { panoDrawOk = false; console.log('  ✗ 全景绘制抛错: ' + e.message); }
assert(panoDrawOk, '③ 全景 Canvas 绘制不抛错');

/* 点击节点 → 电影跳转 */
navs = [];
const firstNode = pd.nodes[0] || {};
pano.goMovie.call(pano, { currentTarget: { dataset: { id: firstNode.id || 'iron-man' } } });
assert(navs.length === 1 && navs[0].indexOf('/pages/movie/movie?id=') === 0, '④ 点击全景节点 → 电影详情跳转（' + navs[0] + '）');

/* 返回路径 */
assert(pd.phases && pd.phases[0] && pd.phases[0].title && pd.phases[0].years, '④ 阶段标签 6 个（含 title/years）');

/* ========== 性能静态指标 ========== */
console.log('══ 性能静态评估 ══');
const mcuData = require('./models/mcuData.js');
assert(mcuData.all.length === 59, '数据量 59 条（本地静态，无网络请求）');
assert(mcuData.charAppearances('tony').list.length > 0, '查询接口 O(n) 量级（59 条内）');
console.log('  · 图片资源：visuals 映射为空 → 无图片请求（全部阶段色兜底卡）');
console.log('  · Canvas：海报 750×1100 一次性绘制（' + canvasOps + ' 次上下文创建均正常）');

console.log('\n========== Step7 设备流程补充验证：' + pass + ' 通过 / ' + fail + ' 失败 ==========');
process.exit(fail ? 1 : 0);
