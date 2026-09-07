/* 抖音版 V1.2.0 · 7 页加载运行测试
 * 目的：逐个 require 页面 JS 并执行生命周期，捕获运行时异常（近似控制台报错检查）。
 */
const path = require('path');
const fs = require('fs');
const ROOT = path.join(__dirname, '..', 'douyin');
const PAGES = ['home', 'my-mcu', 'feedback', 'share', 'about', 'agreement', 'privacy'];

const store = {};
const errors = [];
const toasts = [];
const origErr = console.error;
console.error = (...a) => { errors.push(a.join(' ')); };

global.tt = {
  getStorageSync: (k) => (k in store ? store[k] : ''),
  setStorageSync: (k, v) => { store[k] = v; },
  removeStorageSync: (k) => { delete store[k]; },
  showToast: (o) => toasts.push(o),
  showModal: (o) => { if (o && o.fail) o.fail({ errMsg: 'cancel' }); },
  showLoading: () => {}, hideLoading: () => {},
  switchTab: () => {}, navigateTo: () => {}, navigateBack: () => {}, redirectTo: () => {},
  saveImageToPhotosAlbum: (o) => { if (o && o.success) o.success(); },
  openSetting: () => {}, getSetting: (o) => { if (o && o.success) o.success({ authSetting: {} }); },
  authorize: (o) => { if (o && o.success) o.success(); },
  getSystemInfoSync: () => ({ pixelRatio: 2, windowWidth: 375, windowHeight: 667, platform: 'devtools' }),
  env: { USER_DATA_PATH: '/tmp' },
  getFileSystemManager: () => ({ readFile: (o) => { if (o && o.fail) o.fail({}); }, writeFile: () => {} }),
  createSelectorQuery: () => ({
    select: () => ({
      fields: () => ({ exec: (cb) => { if (cb) cb([{ width: 300, height: 400, node: fakeCanvas() }]); } }),
      boundingClientRect: () => ({ exec: (cb) => { if (cb) cb([]); } })
    }),
    selectAll: () => ({ boundingClientRect: () => ({ exec: (cb) => { if (cb) cb([]); } }) }),
    in: () => this
  }),
  canvasToTempFilePath: (o) => { if (o && o.success) o.success({ tempFilePath: '/tmp/x.png' }); }
};
function fakeCanvas() {
  return {
    width: 300, height: 400,
    getContext: () => ({
      set fillStyle(v) {}, set font(v) {}, set textAlign(v) {}, set textBaseline(v) {},
      fillRect() {}, clearRect() {}, fillText() {}, drawImage() {}, save() {}, restore() {},
      beginPath() {}, arc() {}, fill() {}, stroke() {}, closePath() {}, moveTo() {}, lineTo() {},
      createLinearGradient: () => ({ addColorStop() {} }), measureText: () => ({ width: 50 }),
      setStrokeStyle() {}, setFillStyle() {}, setFontSize() {}, setTextAlign() {}, setTextBaseline() {},
      setLineWidth() {}, strokeRect() {}, translate() {}, scale() {}, draw: () => {}
    }),
    toDataURL: () => 'data:image/png;base64,'
  };
}
global.getApp = () => ({ globalData: { storeKey: 'mcu_nav_user_v1' } });
global.App = () => {};

let cap = null;
global.Page = (cfg) => { cap = cfg; };

let pass = 0, fail = 0;
console.log('==================================================');
console.log(' 7 页加载运行测试');
console.log('==================================================');

PAGES.forEach((name) => {
  const dir = path.join(ROOT, 'pages', name);
  const js = path.join(dir, name + '.js');
  const wxml = path.join(dir, name + '.wxml');
  const json = path.join(dir, name + '.json');
  const exists = [js, wxml, json].every(fs.existsSync);
  if (!exists) { fail++; console.log('  FAIL  ' + name + ' 文件缺失'); return; }

  let err = null;
  try {
    delete require.cache[require.resolve(js)];
    cap = null;
    require(js);
    if (!cap) throw new Error('Page() 未注册');
    const page = Object.assign({}, cap, { data: JSON.parse(JSON.stringify(cap.data || {})) });
    page.setData = function (o) { Object.assign(page.data, o); };
    const opts = name === 'share' ? { type: 'progress' } : {};
    if (typeof page.onLoad === 'function') page.onLoad(opts);
    if (typeof page.onShow === 'function') page.onShow();
  } catch (e) {
    err = e.message;
  }

  const wxmlSize = fs.statSync(wxml).size;
  if (err) { fail++; console.log('  FAIL  ' + name.padEnd(10) + ' 运行时异常 → ' + err); }
  else if (wxmlSize < 100) { fail++; console.log('  FAIL  ' + name.padEnd(10) + ' wxml 过小(' + wxmlSize + 'B)'); }
  else { pass++; console.log('  PASS  ' + name.padEnd(10) + ' 加载+生命周期无异常（wxml ' + wxmlSize + 'B）'); }
});

console.error = origErr;
console.log('\n控制台 error 输出：' + (errors.length ? errors.join(' | ') : '无'));
console.log('==================================================');
console.log(' 通过 ' + pass + ' / 失败 ' + fail);
console.log('==================================================');
process.exit(fail === 0 && errors.length === 0 ? 0 : 1);
