/* V1.1 Step3 我的MCU 2.0 · 逻辑冒烟（临时测试脚本，测完删除） */
const store = {};
let toasts = [];
global.wx = {
  getStorageSync: function (k) { return store[k] || ''; },
  setStorageSync: function (k, v) { store[k] = v; },
  switchTab: function () {},
  navigateTo: function (o) { global.__nav = o.url; },
  showToast: function (o) { toasts.push(o.title); },
  cloud: { init: function () {} }
};

let pageConf = null;
global.Page = function (conf) { pageConf = conf; };

require('./pages/my-mcu/my-mcu.js');

function run(name, state) {
  if (state && Object.keys(state).length) {
    store['mcu_nav_user_v1'] = JSON.parse(JSON.stringify(state));
  } else {
    delete store['mcu_nav_user_v1'];
  }
  const inst = Object.assign({}, pageConf, { data: JSON.parse(JSON.stringify(pageConf.data)) });
  inst.setData = function (patch) { Object.assign(this.data, patch); };
  inst.onShow.call(inst);
  return inst;
}

let pass = 0, fail = 0;
function assert(cond, msg) {
  if (cond) { pass++; console.log('  ✓ ' + msg); }
  else { fail++; console.log('  ✗ FAIL: ' + msg); }
}
const T = Date.now();

console.log('— 用例1 新用户（无观看记录 → 空状态）—');
let inst = run('new', {});
let d = inst.data;
assert(d.explored === 0 && d.total === 59, '进度区 0/59（统一 X/59）');
assert(d.percent === 0, '进度 0%');
assert(d.current && d.current.name === '新手入坑', '当前路线默认 新手入坑');
assert(d.current.phaseText === 'Phase 1', '当前阶段 Phase 1（无观看）');
assert(d.journey.progressText === '0 / 59', '旅程摘要进度 0/59');
assert(d.recentList.length === 0, '最近观看空（空状态）');
assert(d.watchedList.length === 0, '观看记录空（空状态）');
assert(d.entrances.length === 2, '入口预留 2 个（分享+成就）');
assert(d.entrances[0].key === 'share' && d.entrances[1].key === 'achievement', '入口 key：share / achievement');

console.log('— 用例2 老用户（有观看记录 → 正确进度）—');
inst = run('old', {
  watched: { 'iron-man': T, 'thor': T + 1000, 'avengers': T + 2000, 'winter-soldier': T + 3000 },
  favorite: { 'black-panther': T }
});
d = inst.data;
assert(d.explored === 4 && d.total === 59, '进度区 4/59');
assert(d.current.name === '新手入坑', '当前路线默认 新手入坑');
assert(d.journey.phaseText === 'Phase 2', '当前阶段 Phase 2（watched 最新上映 winter-soldier 属 phase2）');
assert(d.recentList.length === 3, '最近观看 3 部（RECENT_MAX=3）');
assert(d.recentList[0].id === 'winter-soldier', '最近观看第一=最新（winter-soldier）');
assert(d.recentList[0].letter === '美', '最近观看海报首字（美队2）');
assert(d.watchedList.length === 4, '观看记录 4 部');
assert(d.watchedList[0].id === 'winter-soldier', '观看记录按时间倒序（最新在前）');
assert(d.favCount === 1 && d.hasFav === true, '收藏 1 部');

console.log('— 用例3 多路线用户（current_route 正确显示）—');
inst = run('multi', {
  watched: { 'iron-man': T, 'avengers': T },
  saved_routes: [
    { id: 'r1', routeId: 'newcomer', createdAt: T, currentIndex: 1, note: '' },
    { id: 'r2', routeId: 'ironman-line', createdAt: T, currentIndex: 2, note: '' }
  ],
  current_route: 'r2'
});
d = inst.data;
assert(d.current.routeId === 'ironman-line', 'current_route 解析 → 钢铁侠路线');
assert(d.current.name === '钢铁侠路线', '路线名称=钢铁侠路线');
assert(d.current.watched >= 1, '路线已看进度 ≥1（iron-man 在路线内）');
assert(d.current.nextId === 'iron-man-2', '路线下一部=iron-man-2（未看首部）');

console.log('— 用例4 入口点击（占位提示，不跳详情）—');
toasts = [];
inst.goEntry({ currentTarget: { dataset: { key: 'share' } } });
inst.goEntry({ currentTarget: { dataset: { key: 'achievement' } } });
assert(toasts.length === 2 && toasts[0].indexOf('分享海报') >= 0 && toasts[1].indexOf('成就系统') >= 0, '分享/成就入口 toast 占位提示');

console.log('— 用例5 V1.0 数据兼容（读取不改写）—');
const legacy = { watched: { 'iron-man': T, 'thor': T }, want_to_watch: {}, favorite: {}, saved_routes: [], milestones_shown: { 5: true } };
run('legacy', legacy);
const before = JSON.stringify(store['mcu_nav_user_v1']);
run('legacy2', legacy);
const after = JSON.stringify(store['mcu_nav_user_v1']);
assert(before === after, 'mcu_nav_user_v1 读取后字节级不变（V1.0 兼容）');

console.log('\n结果: ' + pass + ' 通过 / ' + fail + ' 失败');
process.exit(fail ? 1 : 0);
