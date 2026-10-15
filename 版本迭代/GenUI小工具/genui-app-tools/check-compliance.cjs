/**
 * GenUI 产物合规自查（开发侧自检，不替代官方 genui check）
 * 依据：genui-creator/references/development-rules.md 第 3 节 + package-format.md
 * 退出码：0 = 无违规；1 = 有违规
 */
const fs = require('fs');
const path = require('path');

const APP = path.resolve(__dirname, '..', 'genui-app');

function readAll(dir, acc) {
  acc = acc || [];
  fs.readdirSync(dir, { withFileTypes: true }).forEach((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) readAll(p, acc);
    else if (/\.(html|css|js|json)$/.test(e.name)) acc.push(p);
  });
  return acc;
}

const files = readAll(APP);
const sources = files.map((f) => ({
  file: path.relative(APP, f).replace(/\\/g, '/'),
  text: fs.readFileSync(f, 'utf8')
}));

const RULES = [
  ['外部 http(s) 资源引用', /(?:src|href)\s*=\s*["']https?:\/\//i],
  ['CSS @import 外部', /@import\s+(?:url\()?["']?https?:/i],
  ['外部字体服务', /fonts\.(?:googleapis|gstatic|bunny)|typekit/i],
  ['产物外 fetch', /fetch\s*\(\s*["']https?:/i],
  ['XMLHttpRequest', /XMLHttpRequest/],
  ['WebSocket / EventSource / sendBeacon', /\b(?:WebSocket|EventSource)\b|sendBeacon/],
  ['localStorage / sessionStorage', /\b(?:local|session)Storage\b/],
  ['indexedDB / Cache API', /indexedDB|caches\s*\.\s*open/],
  ['document.cookie', /document\s*\.\s*cookie/],
  ['eval', /[^.\w]eval\s*\(/],
  ['new Function', /new\s+Function\s*\(/],
  ['字符串形式 setTimeout/setInterval', /set(?:Timeout|Interval)\s*\(\s*["']/],
  ['document.write', /document\s*\.\s*write/],
  ['Data/Blob URL 作脚本', /import\s*\(\s*["'](?:data|blob):|src\s*=\s*["'](?:data|blob):text\/html/i],
  ['行内事件属性', /<[a-z][^>]*\son(?:click|load|error|mouseover)\s*=/i],
  ['javascript: URI', /javascript:/i],
  ['window.open', /window\s*\.\s*open/],
  ['iframe / object / embed', /<(?:iframe|object|embed)\b/i],
  ['target=_top / _parent', /target\s*=\s*["']_(?:top|parent)/i],
  ['访问 parent/top/frameElement', /\b(?:parent|top|frameElement)\s*[.[]/],
  ['postMessage', /postMessage/],
  ['alert / confirm / prompt', /\b(?:alert|confirm|prompt)\s*\(/],
  ['fullscreen / PictureInPicture', /requestFullscreen|requestPictureInPicture/],
  ['指针锁定', /requestPointerLock/],
  ['Notification / Push', /\bNotification\s*\(|PushManager/],
  ['Worker / ServiceWorker', /new\s+(?:Shared)?Worker|serviceWorker\s*\.\s*register/],
  ['Worklet', /AudioWorklet|PaintWorklet/],
  ['WebAssembly', /WebAssembly\s*\./],
  ['getUserMedia / getDisplayMedia / Geolocation', /getUserMedia|getDisplayMedia|geolocation/i],
  ['剪贴板读取', /clipboard\s*\.\s*read/i],
  ['Bluetooth / USB / Serial / NFC', /\bBluetooth\b|USBDevice|NDEFReader|\bnavigator\s*\.\s*usb/],
  ['File System Access / input file', /showOpenFilePicker|showSaveFilePicker|showDirectoryPicker|type\s*=\s*["']file/i],
  ['dns-prefetch / preconnect', /rel\s*=\s*["'](?:dns-prefetch|preconnect)["']|dns-prefetch/i],
  ['meta refresh', /http-equiv\s*=\s*["']refresh/i],
  ['绝对路径引用', /(?:src|href)\s*=\s*["']\/(?!\/)/],
  ['协议相对路径', /(?:src|href)\s*=\s*["']\/\//],
  ['上跳路径', /\.\.\/\.\.\//],
  // 说明：development-rules.md §2.3 明确允许「HTML 中固定存在的内联 <script>」，
  // §3.2 只禁运行时生成脚本。故内联 script 不算违规，此处不设该项规则。
  ['产物外注入接口（除 genui.sendLog）', /window\s*\.\s*(?!genui\b)[a-zA-Z_$]+\s*\.\s*(?:send|log|report|track|emit|post)\w*\s*\(/i]
];

let violations = 0;
console.log('检查文件 ' + sources.length + ' 个\n');

RULES.forEach(function (r) {
  const name = r[0];
  const re = r[1];
  const hits = [];
  sources.forEach(function (s) {
    const m = s.text.match(re);
    if (m) hits.push({ file: s.file, sample: m[0].slice(0, 60) });
  });
  if (hits.length) {
    violations++;
    console.log('[X] ' + name);
    hits.slice(0, 3).forEach(function (h) {
      console.log('      ' + h.file + '  →  ' + JSON.stringify(h.sample));
    });
  }
});

/* 产物结构与体积 */
const allFiles = [];
(function walk(d) {
  fs.readdirSync(d, { withFileTypes: true }).forEach((e) => {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else allFiles.push(p);
  });
})(APP);

const WHITELIST = ['.html', '.css', '.js', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.woff', '.woff2', '.json'];
const badExt = allFiles.filter((f) => WHITELIST.indexOf(path.extname(f).toLowerCase()) < 0);
if (badExt.length) {
  violations++;
  console.log('[X] 非白名单后缀');
  badExt.forEach((f) => console.log('      ' + path.relative(APP, f)));
}

const entry = path.join(APP, 'index.html');
if (!fs.existsSync(entry)) {
  violations++;
  console.log('[X] 根目录缺少 index.html');
}
const strayEntry = allFiles.filter((f) => path.basename(f) === 'index.html' && path.dirname(f) !== APP);
if (strayEntry.length) {
  violations++;
  console.log('[X] 存在子目录内的同名 index.html');
  strayEntry.forEach((f) => console.log('      ' + path.relative(APP, f)));
}

/* 除 index.html 外是否都在 static/ 下平铺 */
const outsideStatic = allFiles.filter(function (f) {
  const rel = path.relative(APP, f).replace(/\\/g, '/');
  if (rel === 'index.html') return false;
  return rel.indexOf('static/') !== 0;
});
if (outsideStatic.length) {
  violations++;
  console.log('[X] 非 index.html 文件未平铺在 static/ 下');
  outsideStatic.forEach((f) => console.log('      ' + path.relative(APP, f).replace(/\\/g, '/')));
}

const total = allFiles.reduce((s, f) => s + fs.statSync(f).size, 0);
const mb = total / 1024 / 1024;
console.log('\n产物体积: ' + mb.toFixed(2) + ' MB / 8.00 MB 上限');
if (mb > 8) {
  violations++;
  console.log('[X] 超过 8MB 上限');
}

/* 资源引用完整性：HTML 引用的资源必须真实存在 */
const html = fs.readFileSync(entry, 'utf8');
const refRe = /(?:src|href)\s*=\s*["'](\.\/[^"']+)["']/g;
let m;
while ((m = refRe.exec(html)) !== null) {
  const target = path.join(APP, m[1].replace(/^\.\//, ''));
  if (!fs.existsSync(target)) {
    violations++;
    console.log('[X] 引用了不存在的资源: ' + m[1]);
  }
}

/* 表头名称长度：先剥离 <style> 块，避免匹配到 CSS 里的同名类选择器 */
const bodyOnly = html.replace(/<style[\s\S]*?<\/style>/gi, '');
const titleMatch = bodyOnly.match(/class="vc-component-header-title"[^>]*>\s*([^<]+?)\s*</);
if (titleMatch) {
  const t = titleMatch[1].trim();
  const projName = t.replace(/^小工具\s*·\s*/, '');
  console.log('表头: ' + t + '（项目名 ' + projName.length + ' 字，上限 10）');
  if (projName.length > 10) {
    violations++;
    console.log('[X] 表头项目名超过 10 字');
  }
} else {
  violations++;
  console.log('[X] 未找到表头标题');
}

/* body 默认边距 */
if (!/body\s*\{[^}]*margin\s*:\s*0/.test(html)) {
  violations++;
  console.log('[X] 未显式清除 body 默认边距');
}

console.log('\n' + (violations === 0
  ? '*** 合规自查通过：0 违规 ***'
  : '*** ' + violations + ' 类违规需修复 ***'));
process.exit(violations === 0 ? 0 : 1);
