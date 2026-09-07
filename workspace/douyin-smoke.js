/* 抖音版 V1.2.0 提审前冒烟测试（Node 仿真）
 * 目的：在不启动抖音开发者工具的前提下，真实执行首页逻辑与数据层写入，
 *       验证「标记已看」闭环、本地持久化、数据同步、CTA 状态与 Toast 文案。
 * 方式：mock tt.* API 与 Page()，require 真实 home.js / userState.js。
 */
const path = require('path');
const ROOT = path.join(__dirname, '..', 'douyin');

/* ---------- mock 环境 ---------- */
const store = {};
const toasts = [];
const navs = [];
global.tt = {
  getStorageSync: (k) => (k in store ? store[k] : ''),
  setStorageSync: (k, v) => { store[k] = v; },
  removeStorageSync: (k) => { delete store[k]; },
  showToast: (o) => toasts.push(o),
  showModal: (o) => toasts.push({ title: 'modal:' + (o.title || '') }),
  switchTab: (o) => navs.push('switchTab ' + o.url),
  navigateTo: (o) => navs.push('navigateTo ' + o.url),
  navigateBack: () => navs.push('navigateBack'),
  env: { USER_DATA_PATH: '/tmp' },
  getSystemInfoSync: () => ({ pixelRatio: 2, windowWidth: 375 }),
  createSelectorQuery: () => ({ select: () => ({ fields: () => ({ exec: () => {} }) }) }),
  getFileSystemManager: () => ({})
};
let captured = null;
global.Page = (cfg) => { captured = cfg; };
global.App = () => {};
global.getApp = () => ({ globalData: { storeKey: 'mcu_nav_user_v1' } });

/* ---------- 加载真实模块 ---------- */
const userState = require(path.join(ROOT, 'models/userState.js'));
const homePath = path.join(ROOT, 'pages/home/home.js');

function freshHome() {
  delete require.cache[require.resolve(homePath)];
  captured = null;
  require(homePath);
  const page = Object.assign({}, captured, { data: JSON.parse(JSON.stringify(captured.data || {})) });
  page.setData = function (obj) { Object.assign(page.data, obj); };
  return page;
}

/* ---------- 断言 ---------- */
let pass = 0, fail = 0;
function ck(name, cond, extra) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (extra ? '  → ' + extra : '')); }
}

console.log('==================================================');
console.log(' 抖音版 V1.2.0 冒烟测试（真实执行，非静态检查）');
console.log('==================================================');

/* ===== 测试 1：首页推荐卡片 标记已看 ===== */
console.log('\n[测试 1] 首页推荐卡片');
let page = freshHome();
page.onShow();
const recId1 = page.data.recommend && page.data.recommend.id;
ck('推荐卡渲染出作品', !!recId1, 'id=' + recId1);
ck('初始 CTA = 标记为已看', page.data.recommend.cta === '标记为已看', '实际=' + page.data.recommend.cta);
const cnt0 = userState.count();
ck('初始已看数 = 0', cnt0 === 0, '实际=' + cnt0);

toasts.length = 0;
page.goContinue({ currentTarget: { dataset: { id: recId1 } } });
ck('点击后 toggle 生效（count+1）', userState.count() === 1, 'count=' + userState.count());
ck('Toast 出现且文案正确', toasts.length === 1 && toasts[0].title === '已标记为已看',
  JSON.stringify(toasts));
ck('Toast 文案 ≤12 汉字', (toasts[0] ? toasts[0].title.length : 99) <= 12);

page.onShow();  // 模拟页面刷新
ck('刷新后推荐推进到下一部', page.data.recommend.id !== recId1,
  recId1 + ' → ' + page.data.recommend.id);
ck('推进后的新推荐仍为「标记为已看」（未看）', page.data.recommend.cta === '标记为已看',
  '实际=' + page.data.recommend.cta);
ck('已标记作品进入 journey（旅程卡）',
  page.data.progress.movie.id === recId1, page.data.progress.movie.id);
ck('旅程卡状态变为「已观看」', page.data.progress.movie.statusLabel === '已观看',
  '实际=' + page.data.progress.movie.statusLabel);
ck('最近观看出现该作品',
  page.data.recent.some((r) => r.id === recId1), JSON.stringify(page.data.recent.map((r) => r.id)));

/* ===== 测试 2：旅程卡片（对已看作品取消，再重新标记） ===== */
console.log('\n[测试 2] 首页旅程卡片（状态联动）');
const jmId = page.data.progress.movie.id;
ck('旅程卡渲染出作品', !!jmId, 'id=' + jmId);
ck('旅程卡当前为已观看', page.data.progress.movie.statusLabel === '已观看');
toasts.length = 0;
page.goContinue({ currentTarget: { dataset: { id: jmId } } });   // 已看 → 取消
ck('点击已看作品执行取消', userState.isSeen(jmId) === false);
ck('取消 Toast 正确', toasts.length === 1 && toasts[0].title === '已取消已看', JSON.stringify(toasts));
page.onShow();
ck('刷新后状态回到「当前观看」', page.data.progress.movie.statusLabel === '当前观看',
  '实际=' + page.data.progress.movie.statusLabel);

toasts.length = 0;
page.goContinue({ currentTarget: { dataset: { id: jmId } } });   // 未看 → 重新标记
ck('再次点击重新标记为已看', userState.isSeen(jmId) === true);
ck('重新标记 Toast 正确', toasts.length === 1 && toasts[0].title === '已标记为已看',
  JSON.stringify(toasts));
page.onShow();
ck('刷新后状态保持「已观看」', page.data.progress.movie.statusLabel === '已观看',
  '实际=' + page.data.progress.movie.statusLabel);

/* ===== 测试 3：取消已看（针对刚标记的作品） ===== */
console.log('\n[测试 3] 取消已看');
const before = userState.count();
toasts.length = 0;
page.goContinue({ currentTarget: { dataset: { id: jmId } } });
ck('取消后 count-1', userState.count() === before - 1, before + ' → ' + userState.count());
ck('取消 Toast 正确', toasts.length === 1 && toasts[0].title === '已取消已看', JSON.stringify(toasts));
ck('isSeen 返回 false', userState.isSeen(jmId) === false);
page.onShow();
ck('刷新后未回弹为已看', userState.isSeen(jmId) === false && page.data.progress.movie.statusLabel !== '已观看',
  'status=' + page.data.progress.movie.statusLabel);

/* 收尾：恢复一个已看状态，供持久化测试 */
userState.toggle(recId1);

/* ===== 测试 4：本地持久化（模拟退出重进） ===== */
console.log('\n[测试 4] 本地持久化');
const testId = 'avengers';
userState.toggle(testId);
const persisted = JSON.stringify(store).indexOf(testId) >= 0;
ck('写入落到 tt.setStorageSync', persisted);
const rawKeys = Object.keys(store);
ck('storage 键为 mcu_nav_user_v1', rawKeys.indexOf('mcu_nav_user_v1') >= 0, rawKeys.join(','));

// 模拟冷启动：清空模块缓存，只保留 store（相当于杀进程重进）
Object.keys(require.cache).forEach((k) => { if (k.indexOf('douyin') >= 0) delete require.cache[k]; });
const userState2 = require(path.join(ROOT, 'models/userState.js'));
ck('重进后仍能读到已看记录', userState2.isSeen(testId) === true);
ck('重进后 count 一致', userState2.count() === userState.count());
const page2 = freshHome();
page2.onShow();
ck('重进后首页进度非零', page2.data.progressPercent > 0, 'percent=' + page2.data.progressPercent);
ck('重进后最近观看有数据', page2.data.recent.length > 0, 'recent=' + page2.data.recent.length);

/* ===== 测试 5：我的MCU 数据同步 ===== */
console.log('\n[测试 5] 我的MCU 同步');
const myMcuPath = path.join(ROOT, 'pages/my-mcu/my-mcu.js');
delete require.cache[require.resolve(myMcuPath)];
let cap2 = null;
const bakPage = global.Page;
global.Page = (cfg) => { cap2 = cfg; };
require(myMcuPath);
global.Page = bakPage;
const mp = Object.assign({}, cap2, { data: JSON.parse(JSON.stringify(cap2.data || {})) });
mp.setData = function (o) { Object.assign(mp.data, o); };
if (typeof mp.onShow === 'function') mp.onShow();
else if (typeof mp.refresh === 'function') mp.refresh.call(mp);
ck('我的MCU 已看数 = 实际已看数',
  Number(mp.data.explored) === userState2.count(),
  '页面=' + mp.data.explored + ' 实际=' + userState2.count());
ck('我的MCU 观看记录非空', (mp.data.watchedList || []).length === userState2.count(),
  '列表=' + (mp.data.watchedList || []).length);
ck('我的MCU 百分比 > 0', Number(mp.data.percent) > 0, 'percent=' + mp.data.percent);

/* ---------- 汇总 ---------- */
console.log('\n==================================================');
console.log(' 通过 ' + pass + ' 项 / 失败 ' + fail + ' 项');
console.log('==================================================');
if (navs.length) console.log('跳转记录：', navs.join(' | '));
process.exit(fail === 0 ? 0 : 1);
