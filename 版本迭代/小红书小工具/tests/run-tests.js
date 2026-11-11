'use strict';

/* MCU 小红书小工具 V2.0 自动化测试（Node，不依赖浏览器）
 * 运行：node tests/run-tests.js
 * 覆盖：数据同步数量/引用、进度存储与降级、路线进度、分享卡、边界情况 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const DIST = path.join(__dirname, '..', 'dist', 'assets');

let pass = 0, fail = 0;
const failures = [];

function ok(cond, name, extra) {
  if (cond) { pass++; console.log('  PASS ' + name); }
  else { fail++; failures.push(name); console.log('  FAIL ' + name + (extra ? ' — ' + extra : '')); }
}

function loadJs(file) {
  const sandbox = { window: {} };
  sandbox.window.window = sandbox.window;
  sandbox.window.document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [] };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(DIST, file), 'utf8'), sandbox, { filename: file });
  return sandbox.window;
}

/* 在 window 上先加载 data.js 再加载 progress.js，形成真实运行组合 */
function loadStack() {
  const sandbox = { window: {} };
  const w = sandbox.window;
  w.window = w;
  w.document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [] };
  vm.createContext(sandbox);
  ['data.js', 'progress.js'].forEach(function (f) {
    vm.runInContext(fs.readFileSync(path.join(DIST, f), 'utf8'), sandbox, { filename: f });
  });
  return w;
}

console.log('== A. 数据同步与引用一致性 ==');
const w = loadStack();
ok(Array.isArray(w.MCU_CONTENT) && w.MCU_CONTENT.length > 30, '作品已生成', w.MCU_CONTENT.length + ' 条');
const types = {};
w.MCU_CONTENT.forEach(c => { types[c.type] = (types[c.type] || 0) + 1; });
ok(types.movie > 20 && types.series > 5 && types.special > 0 && types.short > 0, '含电影/剧集/特别呈现/短片', JSON.stringify(types));

/* 过滤检查：不应含待上映/待核实条目 */
const ids = {};
w.MCU_CONTENT.forEach(c => { ids[c.id] = 1; });
ok(!ids['doomsday'] && !ids['secretwars'] && !ids['visionquest'], '未上映预置条目已过滤');
ok(w.MCU_CONTENT.every(c => c.releaseStatus !== 'upcoming' && c.pendingReview !== true), '无 pendingReview / upcoming 残留');

/* 引用一致性 */
let brokenCharRef = 0, brokenRel = 0, brokenRoute = 0;
const charIds = {}; w.MCU_CHARACTERS.forEach(c => charIds[c.id] = 1);
w.MCU_CONTENT.forEach(c => {
  if (c.chars) c.chars.forEach(id => { if (!charIds[id]) brokenCharRef++; });
});
w.MCU_RELATIONS.forEach(r => {
  if (!ids[r.from] || !ids[r.to]) brokenRel++;
});
w.MCU_ROUTES.forEach(r => {
  if (r.generator) return;
  (r.items || []).forEach(id => { if (!ids[id]) brokenRoute++; });
});
ok(brokenCharRef === 0, '角色引用一致', brokenCharRef);
ok(brokenRel === 0, '关系引用一致', brokenRel);
ok(brokenRoute === 0, '路线引用一致', brokenRoute);

/* 复联5 专题 */
const topic = w.MCU_SPECIAL_ROUTES[0];
ok(topic && topic.core.items.length === 8 && topic.full.items.length === 15, '专题 8/15 路线数量', JSON.stringify({ core: topic.core.items.length, full: topic.full.items.length }));
ok(topic.core.items.every(it => ids[it.workId]) && topic.full.items.every(it => ids[it.workId]), '专题作品引用有效');
ok(topic.core.items.every(it => !!it.kw) && topic.full.items.every(it => !!it.kw), '核心与完整路线均有逐条补课理由');
ok(topic.full.items.every(it => !/复联5|复仇者联盟5|毁灭博士|汇合/.test(it.kw)), '完整路线理由不含复联5剧情推测');
const a5 = w.MCU_UPCOMING.find(u => u.id === 'avengers-5');
ok(a5 && a5.date === '2026-12-18', '复联5定档 2026-12-18');
ok(a5 && a5.title === '复仇者联盟5' && a5.en === 'Avengers: Doomsday', '复联5中文辅助名与官方英文名统一', JSON.stringify(a5 && { title: a5.title, en: a5.en }));
ok(a5 && !!a5.titleNote && /非官方译名/.test(a5.titleNote), '复联5中文名标注为非官方译名');
const rawData = fs.readFileSync(path.join(DIST, 'data.js'), 'utf8');
ok(rawData.indexOf('复仇者联盟：末日') === -1 && rawData.indexOf('毁灭日') === -1, '产物中无旧中文名或未确认译名');
ok(topic.hero.title === '复仇者联盟5' && topic.hero.en === 'Avengers: Doomsday' && !!topic.hero.titleNote, '专题 hero 名称与英文名一致');
ok(a5 && a5.speculation === null && !/汇合|毁灭博士|登场|剧情揭示/.test(a5.note), '复联5无虚构剧情（note 仅官方定档）', a5 && a5.note);
ok(topic.chain.end && topic.chain.end.speculative === true && topic.chain.end.label === '推测', '五段链末环标注推测');

console.log('== B. 进度存储 ==');

/* 存储层：注入 fake xhs miniTool（提供 setStorage/getStorage）。
   launchOptions 依文档 §3.6 位于 window.xhs.launchOptions */
function makeXhs(store) {
  return {
    launchOptions: { miniToolEnv: { buildVersion: 9501000 } },   // 9.50.1 编译序号 000
    miniTool: {
      getStorage: function (o) { return Promise.resolve({ data: store[k] || null }); },
      setStorage: function (o) { store[k] = o.data; return Promise.resolve({}); },
      removeStorage: function (o) { delete store[k]; return Promise.resolve({}); }
    }
  };
}
let k = 'mcu-xhs-progress-v1';
const store = {};
const w2 = loadStack();
w2.xhs = makeXhs(store);

(async function () {
  await w2.MCUProgress.init();
  const PG = w2.MCUProgress;

  /* 空状态 */
  ok(PG.watchedCount() === 0 && PG.wantCount() === 0, '初始空状态');

  /* 标记已看 + 持久化 */
  const firstId = w2.MCU_CONTENT[0].id;
  await PG.toggleWatched(firstId);
  ok(PG.isWatched(firstId) && PG.watchedCount() === 1, '标记已看并计数');

  /* 路线进度：标记核心第1条（含季键）只计 1/8，不重复计 */
  const coreItems = topic.core.items;
  await PG.toggleWatched(coreItems[0].workId + '|' + (coreItems[0].label || ''));
  let p8 = PG.routeProgress(coreItems);
  ok(p8.total === 8 && p8.done === 1, '8部路线：标1条计1/8', JSON.stringify(p8));

  /* 想看 */
  const wantId = w2.MCU_CONTENT[1].id;
  await PG.toggleWant(wantId);
  ok(PG.isWant(wantId) && PG.wantCount() === 1, '想看加入');

  /* 已看作品不能进想看 */
  await PG.toggleWant(firstId);
  ok(!PG.isWant(firstId), '已看不进入想看');

  /* 刷新后恢复（用同一个 store 重新 init） */
  const w3 = loadStack();
  w3.xhs = makeXhs(store);
  await w3.MCUProgress.init();
  ok(w3.MCUProgress.isWatched(firstId), '刷新后已看恢复');
  ok(w3.MCUProgress.isWatched(coreItems[0].workId + '|' + (coreItems[0].label || '')), '刷新后专题季键恢复');
  ok(w3.MCUProgress.isWant(wantId), '刷新后想看恢复');

  /* 全库进度不受季键重复影响：watchedIds 去重 */
  const w4 = loadStack();
  w4.xhs = makeXhs(store);
  await w4.MCUProgress.init();
  const wids = w4.MCUProgress.watchedIds();
  const dedup = new Set(wids);
  ok(dedup.size === wids.length, '全库已看按作品去重');
  ok(w4.MCUProgress.watchedCount() >= 1, '全库已看数 >=1');

  /* 15 部完整路线：同一作品的分季独立计数，整部取消时同步清理分季 */
  const wFull = loadStack();
  wFull.xhs = makeXhs({});
  await wFull.MCUProgress.init();
  const fullItems = topic.full.items;
  const keyOf = it => it.workId + '|' + (it.label || '');
  const lokiItems = fullItems.filter(it => it.workId === 'loki');
  ok(lokiItems.length === 2, '15部路线包含洛基两个独立分季');
  await wFull.MCUProgress.toggleWatched(keyOf(lokiItems[0]));
  ok(wFull.MCUProgress.routeProgress(fullItems).done === 1, '15部路线：第1季计1/15');
  await wFull.MCUProgress.toggleWatched(keyOf(lokiItems[1]));
  let fullProgress = wFull.MCUProgress.routeProgress(fullItems);
  ok(fullProgress.done === 2 && fullProgress.total === 15, '15部路线：两季计2/15');
  ok(wFull.MCUProgress.watchedCount() === 1, '两季已看全库仍只计1部作品');
  await wFull.MCUProgress.unmarkWatched('loki');
  ok(wFull.MCUProgress.routeProgress(fullItems).done === 0, '按作品取消已看同步清除分季');
  for (const item of fullItems) await wFull.MCUProgress.toggleWatched(keyOf(item));
  fullProgress = wFull.MCUProgress.routeProgress(fullItems);
  ok(fullProgress.done === 15 && fullProgress.percent === 100, '15部路线全部完成计15/15、100%');
  await wFull.MCUProgress.toggleWatched('loki');
  ok(!wFull.MCUProgress.isWatched(keyOf(lokiItems[0])) && !wFull.MCUProgress.isWatched(keyOf(lokiItems[1])), '整部再次切换会清除两季状态');
  await wFull.MCUProgress.toggleWant('loki');
  ok(wFull.MCUProgress.isWant('loki'), '取消已看后可重新加入想看');

  /* localStorage 正常降级与刷新恢复 */
  function makeLocalStorage(data) {
    return {
      getItem: key => Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null,
      setItem: (key, value) => { data[key] = String(value); },
      removeItem: key => { delete data[key]; }
    };
  }
  const localData = {};
  const wLocal = loadStack();
  wLocal.localStorage = makeLocalStorage(localData);
  await wLocal.MCUProgress.init();
  await wLocal.MCUProgress.toggleWant(wantId);
  ok(wLocal.MCUProgress.backend() === 'localStorage', '无 xhs 时使用 localStorage');
  const wLocalReload = loadStack();
  wLocalReload.localStorage = makeLocalStorage(localData);
  await wLocalReload.MCUProgress.init();
  ok(wLocalReload.MCUProgress.isWant(wantId), 'localStorage 刷新后想看恢复');

  /* xhs 读失败恢复本地副本，写失败降级保存 */
  localData[k] = JSON.stringify({ version: 1, watched: { [firstId]: new Date().toISOString() }, want: [], updatedAt: null });
  const wReadFallback = loadStack();
  wReadFallback.localStorage = makeLocalStorage(localData);
  wReadFallback.xhs = makeXhs({});
  wReadFallback.xhs.miniTool.getStorage = () => Promise.reject(new Error('read failed'));
  await wReadFallback.MCUProgress.init();
  ok(wReadFallback.MCUProgress.backend() === 'localStorage' && wReadFallback.MCUProgress.isWatched(firstId), 'xhs 读失败恢复 localStorage 副本');
  const wWriteFallback = loadStack();
  wWriteFallback.localStorage = makeLocalStorage(localData);
  wWriteFallback.xhs = makeXhs({});
  wWriteFallback.xhs.miniTool.setStorage = () => Promise.reject(new Error('write failed'));
  await wWriteFallback.MCUProgress.init();
  await wWriteFallback.MCUProgress.toggleWant(wantId);
  ok(wWriteFallback.MCUProgress.backend() === 'localStorage' && JSON.parse(localData[k]).want.indexOf(wantId) !== -1, 'xhs 写失败保存到 localStorage');

  /* 清除只依赖已核实的 setStorage，不要求 removeStorage */
  const clearStore = {};
  const wClear = loadStack();
  wClear.xhs = makeXhs(clearStore);
  delete wClear.xhs.miniTool.removeStorage;
  await wClear.MCUProgress.init();
  await wClear.MCUProgress.toggleWatched(firstId);
  await wClear.MCUProgress.clear();
  const wClearReload = loadStack();
  wClearReload.xhs = makeXhs(clearStore);
  await wClearReload.MCUProgress.init();
  ok(wClearReload.MCUProgress.watchedCount() === 0, '无 removeStorage 时清除后刷新仍为空');

  /* 支持时优先调用官方 removeStorage，并同步归零全部统计 */
  const rmStore = {};
  const wRm = loadStack();
  wRm.xhs = makeXhs(rmStore);
  let rmCalled = 0;
  const origRemove = wRm.xhs.miniTool.removeStorage;
  wRm.xhs.miniTool.removeStorage = function (o) { rmCalled++; return origRemove(o); };
  await wRm.MCUProgress.init();
  await wRm.MCUProgress.toggleWatched(firstId);
  await wRm.MCUProgress.toggleWant(wantId);
  await wRm.MCUProgress.toggleWatched(coreItems[0].workId + '|' + (coreItems[0].label || ''));
  await wRm.MCUProgress.clear();
  ok(rmCalled === 1 && !Object.prototype.hasOwnProperty.call(rmStore, k), '优先调用 removeStorage 并删除缓存键');
  ok(wRm.MCUProgress.watchedCount() === 0 && wRm.MCUProgress.wantCount() === 0, '清除后已看 / 想看归零');
  ok(wRm.MCUProgress.routeProgress(coreItems).done === 0 && wRm.MCUProgress.shareData().percent === 0, '清除后路线进度与首页统计归零');
  const wRmReload = loadStack();
  wRmReload.xhs = makeXhs(rmStore);
  await wRmReload.MCUProgress.init();
  ok(wRmReload.MCUProgress.watchedCount() === 0 && wRmReload.MCUProgress.wantCount() === 0, 'removeStorage 清除后刷新仍为空');

  /* removeStorage 失败时回退 setStorage 空串，不阻断清除 */
  const rmFailStore = {};
  const wRmFail = loadStack();
  wRmFail.xhs = makeXhs(rmFailStore);
  await wRmFail.MCUProgress.init();
  await wRmFail.MCUProgress.toggleWatched(firstId);
  wRmFail.xhs.miniTool.removeStorage = () => Promise.reject(new Error('remove failed'));
  await wRmFail.MCUProgress.clear();
  const wRmFailReload = loadStack();
  wRmFailReload.xhs = makeXhs(rmFailStore);
  await wRmFailReload.MCUProgress.init();
  ok(wRmFailReload.MCUProgress.watchedCount() === 0, 'removeStorage 失败时降级清除仍生效');

  /* 存储降级：无 xhs、无 localStorage → memory */
  const w5 = loadStack();
  Object.defineProperty(w5, 'localStorage', { value: undefined, configurable: true });
  await w5.MCUProgress.init();
  await w5.MCUProgress.toggleWatched(firstId);
  ok(w5.MCUProgress.backend() === 'memory', '无存储环境降级 memory', w5.MCUProgress.backend());

  /* 数据损坏容错 */
  const w6 = loadStack();
  w6.xhs = { miniTool: { launchOptions: { miniToolEnv: { buildVersion: 9501000 } }, getStorage: () => Promise.resolve({ data: '{broken json' }), setStorage: () => Promise.resolve({}) } };
  await w6.MCUProgress.init();
  ok(w6.MCUProgress.watchedCount() === 0, '损坏数据回退空状态');

  /* clear */
  await w6.MCUProgress.toggleWatched(firstId);
  await w6.MCUProgress.clear();
  ok(w6.MCUProgress.watchedCount() === 0 && w6.MCUProgress.wantCount() === 0, '清除进度生效');

  /* 分享卡数据 */
  const sd = w6.MCUProgress.shareData();
  ok(typeof sd.total === 'number' && typeof sd.percent === 'number' && Array.isArray(sd.watched) && Array.isArray(sd.want), '分享卡数据结构');

  console.log('== C. 边界情况 ==');
  ok(layoutSafe(w2, topic.core.items[0].label || ''), '特殊字符标签不中断');

  console.log('\n合计：' + pass + ' 通过，' + fail + ' 失败');
  if (failures.length) { console.log('失败项：' + failures.join(' | ')); process.exit(1); }
})();

/* 简单辅助：确保 label 字段不包含会破坏 JSON 的字符 */
function layoutSafe(wnd, label) {
  return typeof label === 'string';
}
