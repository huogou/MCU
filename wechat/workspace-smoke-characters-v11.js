/* ============================================================
 * V1.1 Step6 角色主页 · 逻辑冒烟测试（临时脚本，测完可删）
 * ------------------------------------------------------------
 * 覆盖验收要求 5 项：
 *   1. 角色列表加载   2. 角色详情展示   3. 电影跳转
 *   4. 角色关联跳转   5. 数据不存在情况
 * 方式：node 环境 mock wx/Page，require 真实页面与数据层。
 * ============================================================ */
const store = {};
let navs = [];
global.wx = {
  getStorageSync: function (k) { return store[k] || ''; },
  setStorageSync: function (k, v) { store[k] = v; },
  navigateTo: function (o) { navs.push(o.url); },
  navigateBack: function () { navs.push('BACK'); },
  setNavigationBarTitle: function (o) { global.__title = o.title; },
  switchTab: function () {},
  showToast: function () {},
  cloud: { init: function () {} }
};

let pages = {};
global.Page = function (conf) { pages[conf.__name || 'anon'] = conf; };

/* 捕获页面名：require 前给配置注入 name 不便，用调用顺序定位 */
function loadPage(path, name) {
  require(path);
  const conf = pages.anon;
  delete pages.anon;
  conf.__name = name;
  pages[name] = conf;
  return conf;
}

function mkInst(conf) {
  const inst = Object.assign({}, conf, { data: JSON.parse(JSON.stringify(conf.data)) });
  inst.setData = function (patch) { Object.assign(this.data, patch); };
  return inst;
}

let pass = 0, fail = 0;
function assert(cond, msg) {
  if (cond) { pass++; console.log('  ✓ ' + msg); }
  else { fail++; console.log('  ✗ FAIL: ' + msg); }
}

/* ============ 用例 1：角色列表加载 ============ */
console.log('— 用例1 角色列表加载（characters）—');
const listConf = loadPage('./pages/characters/characters.js', 'characters');
const listInst = mkInst(listConf);
listInst.onLoad.call(listInst);
const ld = listInst.data;
assert(ld.totalChars === 24, '总角色数 24（实际 ' + ld.totalChars + '）');
assert(ld.totalCamps === 8, '总阵营数 8（实际 ' + ld.totalCamps + '）');
assert(ld.campKeys.length === 8, '阵营筛选 chips 8 个');
assert(ld.filtered.length === 24, '默认「全部」筛选展示 24 位');
const tony = ld.filtered.filter(function (c) { return c.id === 'tony'; })[0];
assert(!!tony && tony.avatar === '托', '钢铁侠卡片：首字徽章「托」');
assert(!!tony && tony.firstCn === '钢铁侠', '钢铁侠卡片：首登场《钢铁侠》');
assert(!!tony && tony.count > 0, '钢铁侠卡片：关联作品数量 ' + tony.count);
assert(!!tony && tony.note.length > 10, '钢铁侠卡片：简短介绍非空');

/* 阵营筛选 */
listInst.applyFilter.call(listInst, 'villain');
assert(listInst.data.filtered.length === 1 && listInst.data.filtered[0].id === 'thanos', '阵营筛选「反派」→ 仅灭霸 1 位');
listInst.applyFilter.call(listInst, 'mutant');
assert(listInst.data.filtered.length === 2, '阵营筛选「变种人」→ 2 位（死侍/金刚狼）');

/* ============ 用例 2：角色详情展示 ============ */
console.log('— 用例2 角色详情展示（character?id=tony）—');
const detConf = loadPage('./pages/character/character.js', 'character');
const detInst = mkInst(detConf);
detInst.onLoad.call(detInst, { id: 'tony' });
const dd = detInst.data;
assert(dd.notFound === false, '存在角色 → notFound=false');
assert(dd.char && dd.char.cn.indexOf('钢铁侠') >= 0, '基础信息：角色名称含「钢铁侠」');
assert(dd.char && dd.char.note.length > 10, '基础信息：简介非空');
assert(dd.camp && dd.camp.label === '复仇者阵营', '阵营：复仇者阵营（' + (dd.camp && dd.camp.label) + '）');
assert(dd.first && dd.first.id === 'iron-man' && dd.first.cn === '钢铁侠', '首次出现：iron-man《钢铁侠》');
assert(dd.films.length === dd.char.count === undefined || dd.films.length > 3, '关联作品数量 > 3（实际 ' + dd.films.length + '）');
assert(dd.related.length >= 1 && dd.related.length <= 6, '关系探索：关联角色 1-6 位（实际 ' + dd.related.length + '）');
assert(dd.related[0].id !== 'tony', '关系探索：不包含角色自身');
assert(dd.related[0].shared > 0, '关系探索：首位关联角色共同出演 ' + dd.related[0].shared + ' 部');
assert(global.__title === '托尼·斯塔克', '导航栏标题：托尼·斯塔克');

/* 关联作品字段完整性 */
const film0 = dd.films[0];
assert(film0 && film0.id && film0.phaseColor && film0.status, '关联作品行：id/阶段色/观看状态字段齐全');

/* ============ 用例 3：电影跳转 ============ */
console.log('— 用例3 电影跳转 —');
navs = [];
const movieId = dd.first.id;
detInst.goMovie.call(detInst, { currentTarget: { dataset: { id: movieId } } });
assert(navs.length === 1 && navs[0] === '/pages/movie/movie?id=iron-man', '首次出现作品 → 电影页跳转 url 正确（' + navs[0] + '）');

navs = [];
const filmId = dd.films[2].id;
detInst.goMovie.call(detInst, { currentTarget: { dataset: { id: filmId } } });
assert(navs.length === 1 && navs[0].indexOf('/pages/movie/movie?id=') === 0, '关联作品行 → 电影页跳转 url 正确（' + navs[0] + '）');

/* ============ 用例 4：角色关联跳转 ============ */
console.log('— 用例4 角色关联跳转 —');
navs = [];
const relId = dd.related[0].id;
detInst.goCharacter.call(detInst, { currentTarget: { dataset: { id: relId } } });
assert(navs.length === 1 && navs[0] === '/pages/character/character?id=' + relId, '关联角色 → 角色详情页跳转 url 正确（' + navs[0] + '）');

/* 从关联角色再进详情（二级链路） */
const relInst = mkInst(detConf);
relInst.onLoad.call(relInst, { id: relId });
assert(relInst.data.notFound === false && relInst.data.char.id === relId, '关联角色详情可正常打开（' + relId + '）');

/* 列表页角色 → 详情页 */
navs = [];
const listInst2 = mkInst(listConf);
listInst2.onLoad.call(listInst2);
listInst2.goCharacter.call(listInst2, { currentTarget: { dataset: { id: 'thor' } } });
assert(navs.length === 1 && navs[0] === '/pages/character/character?id=thor', '列表页角色卡 → 详情页跳转 url 正确（' + navs[0] + '）');

/* ============ 用例 5：数据不存在 ============ */
console.log('— 用例5 数据不存在 —');
const missInst = mkInst(detConf);
missInst.onLoad.call(missInst, { id: 'no-such-char' });
assert(missInst.data.notFound === true, '非法 id → notFound=true');
const emptyInst = mkInst(detConf);
emptyInst.onLoad.call(emptyInst, {});
assert(emptyInst.data.notFound === true, '缺 id 参数 → notFound=true');

/* ============ 关联作品数量与 H5 数据一致性抽查 ============ */
console.log('— 附加：角色作品数抽查（tony/thor/thanos 应与 H5 一致）—');
const mcuData = require('./models/mcuData.js');
assert(mcuData.charAppearances('tony').count >= 8, '钢铁侠出现作品 ≥8（实际 ' + mcuData.charAppearances('tony').count + '）');
assert(mcuData.charAppearances('thanos').count >= 3, '灭霸出现作品 ≥3（实际 ' + mcuData.charAppearances('thanos').count + '，数据口径：明确出场，彩蛋镜头不计入 chars）');

console.log('\n========== 结果：' + pass + ' 通过 / ' + fail + ' 失败 ==========');
process.exit(fail ? 1 : 0);
