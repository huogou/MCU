/* 双小程序入口 · 渲染冒烟测试
 * 用最小 DOM 桩真实加载 mcu-navigator/assets/js/app.js，
 * 在 5 种 UA 下调用 MCU.ui.openMpModal，断言弹窗结构正确。
 * 运行：node mp_entry_smoke.js
 */
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var ROOT = 'D:/SEO/发挥余热/漫威电影宇宙导航/mcu-navigator';
var UA_PRESETS = {
  desktop: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
  wechat:  'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 MicroMessenger/8.0.40',
  douyin:  'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 BytedanceWebview/d8a21c6',
  mobile:  'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1'
};

var pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : '')); }
}

/* ---------- 极简 DOM 桩 ---------- */
function makeEl(tag) {
  var el = {
    tagName: (tag || 'div').toUpperCase(),
    _attrs: {}, _children: [], style: {}, _html: '', textContent: '',
    classList: {
      _s: {},
      add: function (c) { this._s[c] = 1; },
      remove: function (c) { delete this._s[c]; },
      contains: function (c) { return !!this._s[c]; }
    },
    setAttribute: function (k, v) { this._attrs[k] = String(v); },
    getAttribute: function (k) { return k in this._attrs ? this._attrs[k] : null; },
    appendChild: function (c) { this._children.push(c); return c; },
    addEventListener: function () {},
    querySelector: function (sel) { return findIn(this, sel); },
    querySelectorAll: function (sel) { return collect(this, sel); },
    closest: function () { return null; },
    get innerHTML() { return this._html; },
    set innerHTML(v) { this._html = String(v); this._children = []; }
  };
  /* 关键：真实 DOM 里 innerHTML 中的节点是可查询的。
     本桩不解析 HTML，因此 querySelector 找不到时返回一个占位元素，
     以保证 onclick 赋值等后续操作不报错（模拟「节点确实存在」）。 */
  var origQuery = el.querySelector;
  el.querySelector = function (sel) {
    var found = origQuery.call(this, sel);
    if (found) return found;
    var ph = makeEl('div');
    ph._class = String(sel).replace(/^\./, '');
    this._children.push(ph);
    return ph;
  };
  Object.defineProperty(el, 'className', {
    get: function () { return this._class || ''; },
    set: function (v) { this._class = String(v); }
  });
  return el;
}
/* 仅支持本测试用到的简单类选择器（逗号分隔） */
function matchSimple(el, sel) {
  sel = sel.trim().replace(/^\./, '');
  return (el._class || '').split(/\s+/).indexOf(sel) >= 0;
}
function findIn(root, sel) {
  var sels = sel.split(',').map(function (s) { return s.trim(); });
  var stack = [root];
  while (stack.length) {
    var n = stack.shift();
    if (!n._children) continue;
    for (var i = 0; i < n._children.length; i++) {
      var c = n._children[i];
      if (c._class) {
        for (var j = 0; j < sels.length; j++) {
          if (matchSimple(c, sels[j])) return c;
        }
      }
      stack.push(c);
    }
  }
  return null;
}
function collect(root, sel) {
  var out = [], stack = [root];
  while (stack.length) {
    var n = stack.shift();
    if (!n._children) continue;
    for (var i = 0; i < n._children.length; i++) {
      var c = n._children[i];
      if (c._class && matchSimple(c, sel)) out.push(c);
      stack.push(c);
    }
  }
  return out;
}

var body = makeEl('body');
function buildSandbox(ua) {
  var documentStub = {
    body: body,
    createElement: makeEl,
    getElementById: function () { return null; },
    querySelector: function () { return null; },
    querySelectorAll: function () { return []; },
    addEventListener: function () {}
  };
  var sb = {
    console: console,
    document: documentStub,
    navigator: { userAgent: ua },
    location: { search: '', pathname: '/index.html', href: 'https://mcu.example.com/index.html', origin: 'https://mcu.example.com', hash: '' },
    localStorage: (function () { var m = {}; return { getItem: function (k) { return k in m ? m[k] : null; }, setItem: function (k, v) { m[k] = String(v); }, removeItem: function (k) { delete m[k]; } }; })(),
    setTimeout: setTimeout, clearTimeout: clearTimeout,
    setInterval: setInterval, clearInterval: clearInterval,
    Date: Date, Math: Math, JSON: JSON, Object: Object, Array: Array,
    String: String, Number: Number, Boolean: Boolean, RegExp: RegExp,
    Error: Error, parseInt: parseInt, parseFloat: parseFloat,
    isNaN: isNaN, encodeURIComponent: encodeURIComponent,
    decodeURIComponent: decodeURIComponent, Promise: Promise,
    URLSearchParams: URLSearchParams, URL: URL,
    requestAnimationFrame: function (cb) { setTimeout(cb, 0); },
    matchMedia: function () { return { matches: false, addEventListener: function () {}, addListener: function () {} }; }
  };
  sb.window = sb;
  sb.window.matchMedia = sb.matchMedia;
  sb.wx = { miniProgram: { navigateTo: function () {} } };
  sb.window.wx = sb.wx;
  return sb;
}

/* ---------- 加载 app.js ---------- */
var appCode = fs.readFileSync(path.join(ROOT, 'assets/js/app.js'), 'utf8');
var DATA_FILES = ['movies', 'relations', 'routes', 'characters', 'series', 'special', 'short', 'content', 'posters', 'stills', 'visuals'];

console.log('\n=== 双小程序入口 · 渲染冒烟测试 ===\n');

Object.keys(UA_PRESETS).forEach(function (envName) {
  console.log('[' + envName + ']');
  var sb = buildSandbox(UA_PRESETS[envName]);
  var ctx = vm.createContext(sb);
  try {
    DATA_FILES.forEach(function (f) {
      var p = path.join(ROOT, 'data', f + '.js');
      if (fs.existsSync(p)) vm.runInContext(fs.readFileSync(p, 'utf8'), ctx, { filename: f });
    });
    vm.runInContext(appCode, ctx, { filename: 'app.js' });
  } catch (e) {
    ok('app.js 加载无异常', false, e.message);
    return;
  }

  var MCU = sb.window.MCU;
  if (!MCU || !MCU.ui) { ok('MCU.ui 已暴露', false); return; }

  /* 环境检测 */
  ok('_detectEnv = ' + envName, MCU.ui._detectEnv() === envName, '实际=' + MCU.ui._detectEnv());

  /* 打开弹窗 */
  body._children = [];
  try {
    MCU.ui.openMpModal('测试标题', '测试描述', null);
  } catch (e) {
    ok('openMpModal 无异常', false, e.message);
    return;
  }

  var ov = body._children[0];
  ok('弹窗已挂载', !!ov);
  if (!ov) return;
  var html = ov._html || '';
  ok('含标题节点 .mp-modal-t', html.indexOf('mp-modal-t') >= 0);
  ok('含内容体 .mp-modal-body', html.indexOf('mp-modal-body') >= 0);
  ok('含说明 .mp-modal-note', html.indexOf('mp-modal-note') >= 0);
  ok('含关闭按钮', html.indexOf('mp-modal-close') >= 0);

  /* 内容体：真实 DOM 中 bodyEl.innerHTML 即渲染结果，直接取该节点内容。
     （本桩不解析 HTML，故不能从父级 _html 中查找子节点的动态内容） */
  var bodyNode = ov.querySelector('.mp-modal-body');
  var bhtml = (bodyNode && bodyNode._html) || '';
  ok('内容体已渲染', bhtml.length > 0);

  /* 双平台：微信与抖音必须同时出现（平台平级） */
  ok('含微信小程序', bhtml.indexOf('微信小程序') >= 0);
  ok('含抖音小程序', bhtml.indexOf('抖音小程序') >= 0);

  /* 二维码断言：
     非环境态（PC/手机）—— 两平台均展示二维码，可断言微信真实图片；
     环境态 —— 主卡展示本平台二维码，另一平台仅为次级按钮（无二维码），
               故此处不断言微信真实图片（属预期行为，非缺陷）。 */
  var isEnvState = (envName === 'wechat' || envName === 'douyin');
  if (!isEnvState) {
    ok('微信二维码用真实图片', bhtml.indexOf('assets/miniprogram/qrcode.png') >= 0);
  } else {
    ok('环境态主卡有二维码区', bhtml.indexOf('mp-qr-box') >= 0);
  }
  /* 抖音二维码未上线，任何状态下均为占位 SVG */
  ok('抖音二维码为占位 SVG', bhtml.indexOf('mp-qr-box-fb') >= 0);

  /* 状态类名 */
  var bcls = bodyNode ? (bodyNode.className || '') : '';
  if (envName === 'desktop') ok('PC 态类名 is-pc', bcls.indexOf('is-pc') >= 0, bcls);
  if (envName === 'mobile')  ok('手机态类名 is-mobile', bcls.indexOf('is-mobile') >= 0, bcls);
  if (envName === 'wechat')  ok('微信态类名 is-env', bcls.indexOf('is-env') >= 0, bcls);
  if (envName === 'douyin')  ok('抖音态类名 is-env', bcls.indexOf('is-env') >= 0, bcls);

  /* 环境态应含「推荐」徽标与「其他平台」切换 */
  if (envName === 'wechat' || envName === 'douyin') {
    ok('环境态含推荐徽标', bhtml.indexOf('推荐') >= 0);
    ok('环境态含其他平台切换', bhtml.indexOf('data-mp-switch') >= 0);
    /* 环境态主卡应为对应平台：微信环境主推微信，抖音环境主推抖音 */
    var wantPlat = (envName === 'wechat') ? 'wechat' : 'douyin';
    ok('主卡 data-platform = ' + wantPlat, bhtml.indexOf('data-platform="' + wantPlat + '"') >= 0);
  }
  console.log('');
});

/* 六档 mpEntry 变体仍可渲染 */
console.log('[mpEntry 六档变体]');
var sb0 = buildSandbox(UA_PRESETS.mobile);
var ctx0 = vm.createContext(sb0);
DATA_FILES.forEach(function (f) {
  var p = path.join(ROOT, 'data', f + '.js');
  if (fs.existsSync(p)) vm.runInContext(fs.readFileSync(p, 'utf8'), ctx0, { filename: f });
});
vm.runInContext(appCode, ctx0, { filename: 'app.js' });
var ui0 = sb0.window.MCU.ui;
['compact', 'inline', 'card', 'module', 'pano', 'foot'].forEach(function (v) {
  var out = ui0.mpEntry({ variant: v, title: 'T', desc: 'D' });
  ok('variant=' + v + ' 可渲染', typeof out === 'string' && out.length > 0);
});

console.log('\n=== 结果：' + pass + ' 通过 / ' + fail + ' 失败 ===');
process.exit(fail > 0 ? 1 : 0);
