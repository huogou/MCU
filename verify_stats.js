/* ============================================================
 * verify_stats.js — H5 运营数据闭环 · 自动化埋点测试
 * 作用：在 Node 中用 mock 的 window / CloudBase / document 真实加载
 *       mcu-navigator 的 data/*.js + assets/js/app.js，模拟 8 类场景，
 *       断言 stats / feedback 集合写入的 channel 与事件名正确。
 * 不触发任何真实网络（window.cloudbase 桩走本地内存）。
 * ============================================================ */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = 'D:/SEO/发挥余热/漫威电影宇宙导航/mcu-navigator';
const DATA_FILES = ['movies', 'relations', 'routes', 'characters', 'series', 'special', 'short', 'content', 'posters', 'stills', 'visuals'];

const writes = [];                 // 捕获 CloudBase 写入 {collection, doc}
const clickHandlers = [];         // 捕获 document click 监听
const wxNavigateCalls = [];       // 捕获 wx.miniProgram.navigateTo 调用

/* ---------- CloudBase 桩 ---------- */
function makeDb() {
  return {
    collection(name) {
      return {
        add(doc) {
          writes.push({ collection: name, doc: Object.assign({}, doc) });
          return Promise.resolve({ id: 'mock_' + Math.random().toString(36).slice(2) });
        }
      };
    }
  };
}
const fakeApp = {
  auth() {
    return {
      anonymousAuthProvider() { return { signIn() { return Promise.resolve(); } }; },
      signInAnonymously() { return Promise.resolve(); },
      signInWithAnonymousAuthProvider() { return Promise.resolve(); }
    };
  },
  database() { return makeDb(); }
};
const cloudbaseFactory = { init() { return fakeApp; } };

/* ---------- DOM 桩 ---------- */
const elCache = {};
function makeEl(tag) {
  const el = {
    tagName: (tag || 'div').toUpperCase(),
    _attrs: {},
    _children: [],
    style: {},
    classList: {
      _s: new Set(),
      add(c) { this._s.add(c); },
      remove(c) { this._s.delete(c); },
      contains(c) { return this._s.has(c); },
      toggle(c, f) { if (f === undefined) { this._s.has(c) ? this._s.delete(c) : this._s.add(c); } else { f ? this._s.add(c) : this._s.delete(c); } }
    },
    innerHTML: '',
    textContent: '',
    value: '',
    onclick: null,
    dataset: {},
    disabled: false,
    setAttribute(k, v) { this._attrs[k] = String(v); if (k.indexOf('data-') === 0) this.dataset[k.slice(5)] = String(v); },
    getAttribute(k) { return k in this._attrs ? this._attrs[k] : null; },
    appendChild(c) { this._children.push(c); return c; },
    addEventListener() {},
    removeEventListener() {},
    querySelector(sel) {
      if (sel && sel.indexOf('fb-type.on') >= 0) return { getAttribute(k) { return k === 'data-v' ? '电影信息' : null; } };
      return null;
    },
    querySelectorAll() { return []; },
    closest() { return null; },
    insertAdjacentHTML() {},
    removeChild() {}
  };
  return el;
}
const documentStub = {
  _idCache: {},
  getElementById(id) { if (!this._idCache[id]) this._idCache[id] = makeEl('div'); return this._idCache[id]; },
  createElement(tag) { return makeEl(tag); },
  querySelector(sel) {
    if (sel && sel.indexOf('fb-type.on') >= 0) return { getAttribute(k) { return k === 'data-v' ? '电影信息' : null; } };
    return null;
  },
  addEventListener(type, fn) { if (type === 'click') clickHandlers.push(fn); },
  removeEventListener() {},
  body: makeEl('body'),
  head: makeEl('head'),
  referrer: 'https://weibo.com/'
};

/* ---------- 全局沙箱 ---------- */
const sandbox = {
  console,
  URLSearchParams,
  URL,
  Promise,
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
  Date,
  Math,
  JSON,
  Object,
  Array,
  String,
  Number,
  Boolean,
  RegExp,
  Error,
  parseInt,
  parseFloat,
  isNaN,
  isFinite,
  encodeURIComponent,
  decodeURIComponent,
  Map,
  Set,
  // 运行环境桩
  cloudbase: cloudbaseFactory,
  navigator: { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148' },
  localStorage: (function () { const m = {}; return { getItem(k) { return k in m ? m[k] : null; }, setItem(k, v) { m[k] = String(v); }, removeItem(k) { delete m[k]; } }; })(),
  requestAnimationFrame(cb) { setTimeout(function () { try { cb(); } catch (e) {} }, 0); },
  document: documentStub
};
sandbox.window = sandbox;            // window === global
sandbox.wx = { miniProgram: { navigateTo(o) { wxNavigateCalls.push(o); } } };
sandbox.matchMedia = function () { return { matches: false, addEventListener() {}, addListener() {} }; };
sandbox.window.matchMedia = sandbox.matchMedia;
sandbox.window.cloudbase = cloudbaseFactory;
sandbox.window.wx = sandbox.wx;

const ctx = vm.createContext(sandbox);

/* ---------- 加载 data + app.js ---------- */
function load(rel) {
  const code = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  vm.runInContext(code, ctx, { filename: rel });
}
DATA_FILES.forEach(f => load('data/' + f + '.js'));
load('assets/js/app.js');

const MCU = sandbox.window.MCU;
if (!MCU || !MCU.stats) { console.error('FAIL: MCU.stats 未暴露'); process.exit(1); }

/* ---------- 测试工具 ---------- */
const delays = [];
function delay(ms) { return new Promise(r => setTimeout(r, ms)); }
let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (extra ? '  → ' + extra : '')); }
}
function setLoc(search, pathname) {
  sandbox.window.location = {
    search: search || '',
    pathname: pathname || '/index.html',
    href: 'https://mcu.example.com' + (pathname || '/index.html') + (search || ''),
    origin: 'https://mcu.example.com',
    hash: ''
  };
}
function lastWrites(collection) { return writes.filter(w => w.collection === collection); }
function clearWrites() { writes.length = 0; }

function fireClick(target) {
  const ev = { target: target, key: 'x' };
  clickHandlers.forEach(h => { try { h(ev); } catch (e) { console.log('    [handler error] ' + e.message); } });
}
function makeTarget(attrs, parent) {
  const el = makeEl('span');
  if (attrs) Object.keys(attrs).forEach(k => el.setAttribute(k, attrs[k]));
  if (parent) el.parentNode = parent;
  return el;
}

/* ============================================================
 * 场景执行
 * ============================================================ */
(async function main() {
  console.log('\n=== H5 运营数据闭环 · 埋点测试 ===\n');

  /* 1. douyin 参数进入 + 首页 PV */
  console.log('[1] douyin 参数进入 + 首页访问');
  setLoc('?from=douyin', '/index.html');
  clearWrites();
  MCU.ui.mount('index.html');
  await delay(60);
  {
    const pv = lastWrites('stats').filter(w => w.doc.type === 'pageview');
    ok('首页 pageview 已写入', pv.length >= 1);
    ok('pageview.page = home', pv.some(w => w.doc.page === 'home'), JSON.stringify(pv.map(w => w.doc.page)));
    ok('channel 归一为 douyin', pv.some(w => w.doc.channel === 'douyin'), pv.map(w => w.doc.channel).join(','));
    ok('from 原值保留 = douyin', pv.some(w => w.doc.from === 'douyin'));
  }

  /* 2. xiaohongshu 参数进入 + 电影详情 PV */
  console.log('[2] xiaohongshu 参数进入 + 电影详情访问');
  setLoc('?from=xiaohongshu&id=avengers', '/movie.html');
  clearWrites();
  MCU.ui.mount('movie.html');
  await delay(60);
  {
    const pv = lastWrites('stats').filter(w => w.doc.type === 'pageview');
    ok('电影详情 pageview 已写入', pv.length >= 1);
    ok('pageview.page = movie', pv.some(w => w.doc.page === 'movie'));
    ok('channel = xiaohongshu', pv.some(w => w.doc.channel === 'xiaohongshu'), pv.map(w => w.doc.channel).join(','));
    ok('payload.id = avengers', pv.some(w => w.doc.payload && w.doc.payload.id === 'avengers'));
  }

  /* 3. 无参数 → 默认 direct */
  console.log('[3] 无渠道参数 → direct');
  setLoc('', '/routes.html');
  sandbox.window.location.search = '?r=newcomer';
  sandbox.window.location.href = 'https://mcu.example.com/routes.html?r=newcomer';
  clearWrites();
  MCU.ui.mount('routes.html');
  await delay(60);
  {
    const pv = lastWrites('stats').filter(w => w.doc.type === 'pageview');
    ok('路线详情 pageview.page = route_detail', pv.some(w => w.doc.page === 'route_detail'), pv.map(w => w.doc.page).join(','));
    ok('channel 默认 direct', pv.some(w => w.doc.channel === 'direct'), pv.map(w => w.doc.channel).join(','));
    ok('payload.routeId = newcomer', pv.some(w => w.doc.payload && w.doc.payload.routeId === 'newcomer'));
  }

  /* 4. 小程序点击记录（mp 入口 + channel 透传） */
  console.log('[4] 进入小程序点击记录 + 微信内带参透传');
  setLoc('?from=douyin', '/index.html');
  clearWrites();
  wxNavigateCalls.length = 0;
  const mpBtn = makeEl('button');
  mpBtn.setAttribute('data-mp-title', '保存进度');
  mpBtn.setAttribute('data-mp-type', 'movie');
  mpBtn.setAttribute('data-mp-id', 'avengers');
  const mpTarget = makeTarget(null, mpBtn);
  fireClick(mpTarget);
  await delay(60);
  {
    const ev = lastWrites('stats').filter(w => w.doc.type === 'event' && w.doc.name === 'click_enter_miniprogram');
    ok('click_enter_miniprogram 事件已写入', ev.length >= 1);
    ok('事件 channel = douyin', ev.some(w => w.doc.channel === 'douyin'), ev.map(w => w.doc.channel).join(','));
    ok('payload.type/id 正确', ev.some(w => w.doc.payload && w.doc.payload.type === 'movie' && w.doc.payload.id === 'avengers'));
    ok('微信内 navigateTo 带 channel 透传', wxNavigateCalls.some(o => /channel=douyin/.test(o.url)), JSON.stringify(wxNavigateCalls));
  }

  /* 5. 电影详情点击 */
  console.log('[5] 电影详情点击');
  setLoc('?from=xiaohongshu', '/index.html');
  clearWrites();
  const aMovie = makeEl('a');
  aMovie.setAttribute('href', 'movie.html?id=iron-man');
  fireClick(aMovie);
  await delay(60);
  {
    const ev = lastWrites('stats').filter(w => w.doc.type === 'event' && w.doc.name === 'click_movie_detail');
    ok('click_movie_detail 事件已写入', ev.length >= 1);
    ok('payload.id = iron-man', ev.some(w => w.doc.payload && w.doc.payload.id === 'iron-man'));
    ok('channel = xiaohongshu', ev.some(w => w.doc.channel === 'xiaohongshu'));
  }

  /* 6. 关系探索点击 */
  console.log('[6] 关系探索点击');
  setLoc('?from=wechat', '/index.html');
  clearWrites();
  const aMap = makeEl('a');
  aMap.setAttribute('href', 'map.html');
  fireClick(aMap);
  await delay(60);
  {
    const ev = lastWrites('stats').filter(w => w.doc.type === 'event' && w.doc.name === 'click_relation_explore');
    ok('click_relation_explore 事件已写入', ev.length >= 1);
    ok('channel = wechat', ev.some(w => w.doc.channel === 'wechat'));
  }

  /* 7. 开始观看点击（seen-btn） */
  console.log('[7] 开始观看点击');
  setLoc('?from=douyin&id=avengers', '/movie.html');
  clearWrites();
  const seenBtn = makeEl('button');
  seenBtn.setAttribute('data-stat', 'click_start_watch');
  seenBtn.setAttribute('data-id', 'avengers');
  fireClick(seenBtn);
  await delay(60);
  {
    const ev = lastWrites('stats').filter(w => w.doc.type === 'event' && w.doc.name === 'click_start_watch');
    ok('click_start_watch 事件已写入', ev.length >= 1);
    ok('payload.id = avengers', ev.some(w => w.doc.payload && w.doc.payload.id === 'avengers'));
    ok('channel = douyin', ev.some(w => w.doc.channel === 'douyin'));
  }

  /* 8. 反馈提交渠道记录 */
  console.log('[8] 反馈提交渠道记录（H5↔小程序字段一致）');
  setLoc('?from=douyin&id=avengers', '/movie.html');
  clearWrites();
  // 通过 fb 委托打开反馈面板
  const fbTarget = makeTarget({ 'data-fb': '' });
  fireClick(fbTarget);
  await delay(30);
  // 填写并提交
  const fbText = documentStub.getElementById('fbText');
  fbText.value = '测试反馈内容：顺序有问题';
  const fbSubmit = documentStub.getElementById('fbSubmit');
  if (typeof fbSubmit.onclick === 'function') fbSubmit.onclick();
  await delay(80);
  {
    const fb = lastWrites('feedback');
    ok('feedback 集合已写入', fb.length >= 1, 'writes=' + fb.length);
    const d = fb[0] && fb[0].doc;
    ok('channel = douyin', d && d.channel === 'douyin', d && d.channel);
    ok('platform = h5', d && d.platform === 'h5', d && d.platform);
    ok('feedbackType = 电影信息', d && d.feedbackType === '电影信息', d && d.feedbackType);
    ok('content 正确', d && d.content === '测试反馈内容：顺序有问题', d && d.content);
    ok('contact 字段存在（与小程序一致）', d && 'contact' in d, d && Object.keys(d).join(','));
    ok('status = new', d && d.status === 'new');
  }

  /* ---------- 汇总 ---------- */
  console.log('\n=== 结果：' + pass + ' 通过 / ' + fail + ' 失败 ===');
  if (fail > 0) process.exit(2);
})().catch(e => { console.error('测试异常：', e); process.exit(3); });
