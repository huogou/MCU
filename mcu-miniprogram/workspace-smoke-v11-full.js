/* ============================================================
 * V1.1 上线前全量验收 · 三场景完整用户流程（mock wx/Page）
 * ------------------------------------------------------------
 * 场景1 新用户首入：首页→路线→电影详情→标记观看→返回首页→继续观看
 * 场景2 老用户继续：首页(当前路线/阶段/下一部)+我的MCU(进度/最近观看/成就)+分享(海报数据)
 * 场景3 探索用户：探索→角色图鉴→角色详情→关联电影→电影详情（含返回路径）
 * ============================================================ */
const store = {};
let navs = [];        // navigateTo/switchTab/navigateBack 记录
let toasts = [];
let titles = [];

/* 微信 storage 语义：序列化透明，读写均为对象 */
global.wx = {
  getStorageSync: function (k) { return store[k] || ''; },
  setStorageSync: function (k, v) { store[k] = v; },
  navigateTo: function (o) { navs.push('TO:' + o.url); },
  switchTab: function (o) { navs.push('TAB:' + o.url); },
  navigateBack: function () { navs.push('BACK'); },
  setNavigationBarTitle: function (o) { titles.push(o.title); },
  showToast: function (o) { toasts.push(o.title || ''); },
  getSystemInfoSync: function () { return { pixelRatio: 2 }; },
  createSelectorQuery: function () { return { select: function () { return this; }, fields: function () { return this; }, exec: function (cb) { cb && cb(null); } }; },
  cloud: { init: function () {} }
};

let pages = {};
let lastConf = null;
global.Page = function (conf) { lastConf = conf; pages[conf.__name || 'anon'] = conf; };

function load(path, name) {
  lastConf = null;
  require(path);
  if (!lastConf) throw new Error('页面未注册: ' + path);
  lastConf.__name = name;
  pages[name] = lastConf;
  return lastConf;
}
function inst(conf) {
  const i = Object.assign({}, conf, { data: JSON.parse(JSON.stringify(conf.data || {})) });
  i.setData = function (patch) { Object.assign(this.data, patch); };
  return i;
}
let pass = 0, fail = 0;
function assert(cond, msg) {
  if (cond) { pass++; console.log('  ✓ ' + msg); }
  else { fail++; console.log('  ✗ FAIL: ' + msg); }
}
function freshUser() { delete store['mcu_nav_user_v1']; navs = []; toasts = []; }

/* ============================================================
 * 场景1：新用户首次进入
 * ============================================================ */
console.log('══ 场景1 新用户首次进入 ══');
freshUser();
load('./pages/home/home.js', 'home');
load('./pages/routes/routes.js', 'routes');
load('./pages/movie/movie.js', 'movie');

const home1 = inst(pages.home);
home1.onShow.call(home1);
const h1 = home1.data;
assert(h1.hasProgress === false, '① 首页新用户态 hasProgress=false');
assert(Array.isArray(h1.hotStart) && h1.hotStart.length > 0, '① 首页引导：热门起点卡 ' + h1.hotStart.length + ' 张');
assert(Array.isArray(h1.featureCards) && h1.featureCards.length >= 2, '① 首页引导：功能卡 ' + h1.featureCards.length + ' 张（探索/进度）');
assert(h1.cta !== null, '① 首页引导：主 CTA 存在');

/* 首页 → 路线 */
const rt = inst(pages.routes);
rt.onLoad.call(rt);
const mcuData = require('./models/mcuData.js');
assert(mcuData.routes.length === 11, '② 路线数据 11 条（实际 ' + mcuData.routes.length + '）');
assert(rt.data.current && rt.data.current.name, '② 路线页当前路线卡加载（' + (rt.data.current && rt.data.current.name) + '）');
assert(Array.isArray(rt.data.list) && rt.data.list.length > 0, '② 路线页列表加载 ' + (rt.data.list && rt.data.list.length) + ' 条');

/* 路线 → 电影详情 */
const mv1 = inst(pages.movie);
mv1.onLoad.call(mv1, { id: 'iron-man' });
assert(mv1.data.notFound !== true && mv1.data.cn === '钢铁侠', '③ 电影详情：钢铁侠加载成功');
assert(mv1.data.status && mv1.data.status.cls === 'unwatched', '③ 电影详情：初始未看状态');

/* 标记观看 */
navs = [];
mv1.onMarkWatched.call(mv1);
const saved1 = JSON.parse(JSON.stringify(store['mcu_nav_user_v1'] || {}));
assert(saved1.watched && saved1.watched['iron-man'], '④ 标记观看：watched 已写入 storage（' + Object.keys(saved1.watched || {}).length + ' 部）');
assert(mv1.data.status && mv1.data.status.cls === 'watched', '④ 标记观看：页面状态已看');

/* 返回首页 → 继续观看 */
home1.onShow.call(home1);
const h1b = home1.data;
assert(h1b.hasProgress === true, '⑤ 返回首页：老用户态切换 hasProgress=true');
assert(h1b.journey !== null && h1b.ring.count === 1, '⑤ 继续观看：旅程卡 count=1/59');
assert(h1b.nextCard !== null && h1b.nextCard.id, '⑤ 继续观看：下一站推荐卡出现（' + (h1b.nextCard && h1b.nextCard.cn) + '）');
assert(store['mcu_nav_user_v1'] && store['mcu_nav_user_v1'].last_watched === 'iron-man', '⑤ 数据保存：last_watched=iron-man');

/* ============================================================
 * 场景2：老用户继续使用（预置 4 部已看 + 1 收藏 + 当前路线）
 * ============================================================ */
console.log('══ 场景2 老用户继续使用 ══');
freshUser();
const T = Date.now();
store['mcu_nav_user_v1'] = {
  watched: { 'iron-man': T - 4e7, 'iron-man-2': T - 3e7, 'avengers': T - 2e7, 'thor': T - 1e7 },
  want_to_watch: {},
  favorite: { 'endgame': T - 1e7 },
  saved_routes: [{ id: 'sr1', routeId: 'newcomer', createdAt: T - 5e7, currentIndex: 2, note: '' }],
  last_watched: 'thor',
  current_route: 'sr1',
  current_content: 'avengers',
  milestones_shown: {}
};
load('./pages/my-mcu/my-mcu.js', 'my-mcu');

/* 首页：当前路线 / 当前阶段 / 下一部推荐 */
const home2 = inst(pages.home);
home2.onShow.call(home2);
const h2 = home2.data;
assert(h2.ring.count === 4 && h2.ring.total === 59, '① 首页进度环 4/59');
assert(h2.journey && h2.journey.routeName, '① 首页当前路线：' + (h2.journey && h2.journey.routeName));
assert(h2.phaseTitle && h2.phaseTitle.length > 0, '① 首页当前阶段：' + h2.phaseTitle);
assert(h2.nextCard && h2.nextCard.cn, '① 首页下一部推荐：' + (h2.nextCard && h2.nextCard.cn));

/* 我的MCU：进度 / 最近观看 / 成就 */
const mm = inst(pages['my-mcu']);
mm.onShow.call(mm);
const md = mm.data;
assert(md.explored === 4 && md.total === 59, '② 我的MCU 进度 4/59');
assert(Array.isArray(md.recentList) && md.recentList.length > 0, '② 我的MCU 最近观看 ' + (md.recentList && md.recentList.length) + ' 部');
assert(md.recentList && md.recentList[0].id === 'thor', '② 最近观看第一为最后观看 thor');
assert(md.achProgress && md.achProgress.count >= 1, '② 我的MCU 成就墙：' + (md.achProgress && md.achProgress.count) + '/' + (md.achProgress && md.achProgress.total) + ' 已解锁');
const achievements = require('./models/achievements.js');
const achProgress = achievements.progress();
assert(achProgress && achProgress.count >= 1, '② 成就：老用户已解锁 ' + (achProgress && achProgress.count) + ' 项（初入漫威）');

/* 分享：海报数据装配 */
load('./pages/share/share.js', 'share');
const sh = inst(pages.share);
sh.onLoad.call(sh, { type: 'progress' });
const sd = sh.data;
assert(sd.count === 4 && sd.total === 59, '③ 分享海报数据：4/59');
assert(sd.routeName && sd.routeName.length > 0, '③ 分享海报数据：当前路线 ' + sd.routeName);
assert(sd.phaseText && sd.phaseText.length > 0, '③ 分享海报数据：阶段 ' + sd.phaseText);
const shareData = require('./models/shareData.js');
shareData.record('progress');
assert(shareData.getStats().total >= 1, '③ 分享记录：total=' + shareData.getStats().total);

/* ============================================================
 * 场景3：探索用户（角色体系链路）
 * ============================================================ */
console.log('══ 场景3 探索用户 ══');
freshUser();
load('./pages/explore/explore.js', 'explore');
load('./pages/characters/characters.js', 'characters');
load('./pages/character/character.js', 'character');

/* 探索页 → 角色图鉴 */
const ex = inst(pages.explore);
ex.onLoad.call(ex);
assert(ex.data.totalChars === 24, '① 探索页角色总数 24');
navs = [];
ex.goCharacters.call(ex);
assert(navs[0] === 'TO:/pages/characters/characters', '① 探索页→角色图鉴入口跳转 ✓');

/* 角色图鉴 → 角色详情 */
const cl = inst(pages.characters);
cl.onLoad.call(cl);
assert(cl.data.filtered.length === 24, '② 角色图鉴加载 24 位');
navs = [];
cl.goCharacter.call(cl, { currentTarget: { dataset: { id: 'tony' } } });
assert(navs[0] === 'TO:/pages/character/character?id=tony', '② 角色图鉴→角色详情跳转 ✓');

/* 角色详情：关联电影 → 电影详情 */
const cd = inst(pages.character);
cd.onLoad.call(cd, { id: 'tony' });
const cdd = cd.data;
assert(cdd.notFound === false && cdd.char.id === 'tony', '③ 角色详情：托尼加载成功');
assert(cdd.first && cdd.first.id === 'iron-man', '③ 角色详情：首秀 iron-man');
assert(cdd.films.length === 9, '③ 角色详情：关联作品 9 部（实际 ' + cdd.films.length + '）');
assert(cdd.related.length >= 1, '③ 角色详情：关系探索 ' + cdd.related.length + ' 位');
navs = [];
const linkFilmId = cdd.films[0].id;
cd.goMovie.call(cd, { currentTarget: { dataset: { id: linkFilmId } } });
assert(navs[0] === 'TO:/pages/movie/movie?id=' + linkFilmId, '③ 关联作品→电影详情跳转 ✓');

/* 电影详情加载一致性 */
const mv3 = inst(pages.movie);
mv3.onLoad.call(mv3, { id: linkFilmId });
assert(mv3.data.notFound !== true && mv3.data.cn, '④ 电影详情：' + mv3.data.cn + ' 加载一致');

/* 关联角色 → 二级角色详情 */
navs = [];
const relId = cdd.related[0].id;
cd.goCharacter.call(cd, { currentTarget: { dataset: { id: relId } } });
assert(navs[0] === 'TO:/pages/character/character?id=' + relId, '④ 关联角色→角色详情（二级）跳转 ✓');

/* 返回路径 */
navs = [];
cd.goBack.call(cd);
assert(navs[0] === 'BACK', '⑤ 返回路径：navigateBack ✓');
/* 非法角色 → notFound 兜底 */
const bad = inst(pages.character);
bad.onLoad.call(bad, { id: 'no-such' });
assert(bad.data.notFound === true, '⑤ 非法角色 id → 友好兜底页 ✓');
/* 非法电影 → notFound 兜底 */
const badMv = inst(pages.movie);
badMv.onLoad.call(badMv, { id: 'no-such-film' });
assert(badMv.data.notFound === true, '⑤ 非法电影 id → 友好兜底页 ✓');

/* ============================================================
 * 汇总
 * ============================================================ */
console.log('\n========== 三场景验收结果：' + pass + ' 通过 / ' + fail + ' 失败 ==========');
process.exit(fail ? 1 : 0);
