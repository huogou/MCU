/* ============================================================
 * MCU 抖音小程序 · Canvas 海报 headless 冒烟测试（V1.3.0 提审门禁）
 * ------------------------------------------------------------
 * 目的：在无抖音开发者工具的环境下，尽可能逼近真机验证
 *       我的MCU → 分享 → 海报生成 → 保存相册 这条链路。
 *
 * 覆盖：
 *   ① 海报 Canvas 绘制（draw 全链路不抛异常、确实产生了绘制指令）
 *   ② 保存成功路径（写文件成功 → 存相册成功 → 提示「已保存到相册」）
 *   ③ 保存失败路径（写文件失败 → 提示「海报生成失败」且不崩溃）
 *   ④ 相册权限拒绝路径（存相册 fail(auth deny) → 弹权限引导 Modal）
 *   ⑤ 缺input canvas 未就绪时的兜底（不应抛异常）
 *
 * 不能覆盖（需真机/IDE 验证）：实际像素渲染效果、真实相册写入、权限弹窗样式。
 *
 * 运行：cd douyin && node utils/smoke-canvas.js
 * ============================================================ */

const path = require('path');
const fs = require('fs');
const ROOT = path.resolve(__dirname, '..');

/* ───────── ① 可录制调用行为的 tt 运行时桩 ───────── */
const store = new Map();
const calls = [];
const rec = (name) => (...a) => { calls.push({ fn: name, args: a }); };

/* Canvas 2D 上下文：Proxy 兜底，任何未知方法都不会让绘制崩溃 */
const ctxOps = [];
const makeCtx = () => new Proxy({}, {
  get(target, prop) {
    if (prop === 'measureText') return (s) => ({ width: String(s == null ? '' : s).length * 14 });
    if (prop === 'createLinearGradient') return () => ({ addColorStop() {} });
    if (prop === 'createRadialGradient') return () => ({ addColorStop() {} });
    if (typeof prop === 'symbol') return undefined;
    return (...args) => { ctxOps.push({ op: String(prop), args }); };
  },
  set(target, prop, value) { target[prop] = value; return true; }
});

/* Canvas 节点 */
const makeCanvasNode = () => {
  const ctx = makeCtx();
  return {
    width: 0, height: 0,
    getContext: () => ctx,
    createImage: () => {
      const img = { _src: '', onload: null, onerror: null };
      Object.defineProperty(img, 'src', {
        get() { return img._src; },
        set(v) {
          img._src = v;
          /* 模拟异步加载成功 */
          setImmediate(() => { if (img.onload) img.onload(); });
        }
      });
      return img;
    },
    toDataURL: () => 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
  };
};

let canvasNode = null;
let writeFileBehavior = 'success';   // success | fail
let albumBehavior = 'success';       // success | authFail | fail

global.tt = {
  getStorageSync: (k) => store.get(k),
  setStorageSync: (k, v) => store.set(k, v),
  removeStorageSync: (k) => store.delete(k),
  showToast: rec('showToast'),
  showModal: rec('showModal'),
  openSetting: rec('openSetting'),
  setNavigationBarTitle: rec('setNavigationBarTitle'),
  getSystemInfoSync: () => ({ windowWidth: 375, pixelRatio: 2, platform: 'devtools' }),
  createSelectorQuery: function () {
    return {
      in() { return this; },
      select() {
        return {
          fields() {
            return { exec(cb) { canvasNode = makeCanvasNode(); setImmediate(() => cb([{ node: canvasNode, width: 375, height: 600 }])); } };
          },
          boundingClientRect() { return { exec() {} }; }
        };
      },
      selectAll() { return { boundingClientRect() { return { exec() {} }; } }; }
    };
  },
  getFileSystemManager: function () {
    return {
      writeFile: function (opt) {
        calls.push({ fn: 'writeFile', args: [opt && opt.filePath] });
        setImmediate(() => { if (writeFileBehavior === 'success') opt.success && opt.success(); else opt.fail && opt.fail({ errMsg: 'writeFile:fail' }); });
      }
    };
  },
  saveImageToPhotosAlbum: function (opt) {
    calls.push({ fn: 'saveImageToPhotosAlbum', args: [opt && opt.filePath] });
    setImmediate(() => {
      if (albumBehavior === 'success') opt.success && opt.success();
      else if (albumBehavior === 'authFail') opt.fail && opt.fail({ errMsg: 'saveImageToPhotosAlbum:fail auth deny' });
      else opt.fail && opt.fail({ errMsg: 'saveImageToPhotosAlbum:fail unknown' });
    });
  },
  navigateTo: rec('navigateTo'),
  redirectTo: rec('redirectTo'),
  switchTab: rec('switchTab'),
  env: { USER_DATA_PATH: '/tmp/mock-user-data-path' }
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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ───────── ③ 页面挂载 ───────── */
function mount(relPath) {
  const abs = path.resolve(ROOT, relPath);
  let cfg = null;
  const prev = global.Page;
  global.Page = function (c) { cfg = c; };
  delete require.cache[require.resolve(abs)];
  require(abs);
  global.Page = prev;
  const page = {};
  for (const k in cfg) if (Object.prototype.hasOwnProperty.call(cfg, k)) page[k] = cfg[k];
  page.data = cfg.data ? JSON.parse(JSON.stringify(cfg.data)) : {};
  page.setData = function (partial, cb) {
    for (const k in partial) if (Object.prototype.hasOwnProperty.call(partial, k)) page.data[k] = partial[k];
    if (typeof cb === 'function') cb.call(page);
  };
  return page;
}

/* ══════════ 主流程 ══════════ */
(async () => {
  /* 造数据：3 部已看 + 1 收藏，确保海报有「最近观看」区内容 */
  const key = 'mcu_nav_user_v1';
  const now = Date.now();
  store.set(key, {
    watched: { 'iron-man': now - 3000, 'avengers': now - 2000, 'endgame': now - 1000 },
    want_to_watch: {},
    favorite: { 'endgame': now },
    saved_routes: [],
    milestones_shown: {}
  });

  console.log('\n── I. Canvas 海报生成 ──');
  const share = mount('pages/share/share.js');

  share.onLoad({ type: 'progress' });
  eq('I1 海报类型=progress', share.data.type, 'progress');
  eq('I2 已看数取自 userState=3', share.data.count, 3);
  ok('I3 总数正确(59)', share.data.total === 59, 'total=' + share.data.total);
  ok('I4 片单名称非空', !!share.data.routeName, JSON.stringify(share.data.routeName));

  ctxOps.length = 0;
  share.onReady();                 // → initCanvas → 加载图片 → draw
  await sleep(400);                // 等待 setImmediate 链走完

  ok('I5 canvas 节点已初始化', !!share._canvas, 'canvas=' + String(share._canvas));
  ok('I6 绘制指令数量 > 100（真实发生了绘制）', ctxOps.length > 100, 'ops=' + ctxOps.length);
  const opNames = Array.from(new Set(ctxOps.map((x) => x.op)));
  ['scale', 'fillRect', 'fillText', 'beginPath', 'arc', 'fill'].forEach(function (need) {
    ok('I7 关键绘制指令存在：' + need, opNames.indexOf(need) >= 0, 'ops=' + opNames.join(','));
  });

  console.log('\n── J. 保存相册（成功路径）──');
  calls.length = 0;
  writeFileBehavior = 'success';
  albumBehavior = 'success';
  share.savePoster();
  await sleep(200);
  const wrote = calls.find((c) => c.fn === 'writeFile');
  ok('J1 调用了写文件', !!wrote, JSON.stringify(calls.map((c) => c.fn)));
  ok('J2 写文件路径合法(.png)', !!wrote && /\.png$/.test(String(wrote.args[0])), wrote && String(wrote.args[0]));
  const saved = calls.find((c) => c.fn === 'saveImageToPhotosAlbum');
  ok('J3 调用了保存到相册', !!saved);
  const toasted = calls.find((c) => c.fn === 'showToast' && c.args[0] && c.args[0].title === '已保存到相册');
  ok('J4 提示「已保存到相册」', !!toasted);

  console.log('\n── K. 保存失败兜底 ──');
  calls.length = 0;
  writeFileBehavior = 'fail';
  share.savePoster();
  await sleep(200);
  const failToast = calls.find((c) => c.fn === 'showToast' && c.args[0] && c.args[0].title === '海报生成失败，请重试');
  ok('K1 写文件失败 → 友好提示不崩溃', !!failToast);

  console.log('\n── L. 相册权限拒绝兜底 ──');
  calls.length = 0;
  writeFileBehavior = 'success';
  albumBehavior = 'authFail';
  share.savePoster();
  await sleep(200);
  const modal = calls.find((c) => c.fn === 'showModal');
  ok('L1 权限拒绝 → 弹出权限引导', !!modal, JSON.stringify(calls.map((c) => c.fn)));
  ok('L2 引导文案含「相册权限」', !!modal && String(modal.args[0] && modal.args[0].title).indexOf('相册权限') >= 0,
     modal && String(modal.args[0].title));

  console.log('\n── M. Canvas 未就绪兜底 ──');
  const share2 = mount('pages/share/share.js');
  share2.onLoad({ type: 'progress' });
  calls.length = 0;
  let threw = false;
  try { share2.savePoster(); } catch (e) { threw = true; }
  await sleep(50);
  ok('M1 canvas 未就绪时不抛异常', !threw);
  const waitToast = calls.find((c) => c.fn === 'showToast' && c.args[0] && c.args[0].title === '海报生成中，请稍后');
  ok('M2 canvas 未就绪时给出等待提示', !!waitToast);

  console.log('\n── N. 转发配置 ──');
  let shareRet = null;
  try { shareRet = share.onShareAppMessage(); } catch (e) { shareRet = null; }
  ok('N1 转发方法可用', !!shareRet);
  ok('N2 转发 path 指向已注册页', !!shareRet && shareRet.path.indexOf('/pages/share/share') === 0,
     shareRet && shareRet.path);
  const appJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'app.json'), 'utf8'));
  ok('N3 转发路径无死链', !!shareRet && appJson.pages.indexOf(shareRet.path.split('?')[0].replace(/^\//, '')) >= 0);
  ok('N4 转发标题无违规词', !!shareRet &&
     !/官方|正版|授权|资讯|新闻|热点|影评|票房/.test(shareRet.title), shareRet && shareRet.title);

  console.log('\n════════════════════════════════');
  console.log('  通过 ' + pass + ' 项 / 失败 ' + fail + ' 项');
  if (fail) { console.log('  失败清单：'); failures.forEach((f) => console.log('   - ' + f)); }
  console.log('════════════════════════════════');
  process.exit(fail ? 1 : 0);
})();
