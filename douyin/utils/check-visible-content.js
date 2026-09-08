/* ============================================================
 * MCU 抖音小程序 · 用户可见内容合规审计（V1.3.0 提审门禁）
 * ------------------------------------------------------------
 * 与第二阶段脚本的区别：
 *   check-home-conformance.js / smoke-tool-features.js 管「结构/逻辑」
 *   本脚本只管一件事：**用户在界面上真正能看到的那部分文字**。
 *
 * 为什么需要单独做：
 *   详情页会渲染 data 层的 sf（简介）与 relations 的 why（作品关系说明）。
 *   这两处是「数据文本 → 用户界面」的通道，漏检就会形成可见合规风险。
 *
 * 覆盖来源（全部为用户可见）：
 *   ① 所有 *.wxml 的文本节点（已剔除 <!-- --> 注释与 {{}} 插值）
 *   ② 所有 *.js 去除注释后的中英文字符串字面量（会被 setData 渲染的文案）
 *   ③ 数据层被渲染的字段：cn / en / sf / episodes / coLabel / why /
 *      route.name / route.tagline / 成就全字段
 *   ④ 篇幅统计（长文本排版风险量化）
 *
 * 运行：cd douyin && node utils/check-visible-content.js
 * ============================================================ */

const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

/* ── 禁用词表（用户可见层面零容忍） ── */
const FORBIDDEN = [
  '官方授权', '官方合作', '官方支持', '官方关系', '官方', '正版', '授权',
  '资讯', '新闻', '热点', '影评', '票房', '演员资讯', '娱乐资讯',
  '独家', '首播', '最新消息', '媒体报道'
];

/* ── 工具：安全剥离 JS 注释（尊重引号，避免误删字符串里的 // 与 /*） ── */
function stripJsComments(src) {
  let out = '';
  let i = 0;
  const n = src.length;
  let state = 'code';           // code | line | block | sq | dq | bq
  while (i < n) {
    const ch = src[i], nx = src[i + 1];
    if (state === 'code') {
      if (ch === '/' && nx === '/') { state = 'line'; i += 2; continue; }
      if (ch === '/' && nx === '*') { state = 'block'; i += 2; continue; }
      if (ch === "'") { state = 'sq'; out += ch; i++; continue; }
      if (ch === '"') { state = 'dq'; out += ch; i++; continue; }
      if (ch === '`') { state = 'bq'; out += ch; i++; continue; }
      out += ch; i++; continue;
    }
    if (state === 'line') {
      if (ch === '\n') { state = 'code'; out += ch; }
      i++; continue;
    }
    if (state === 'block') {
      if (ch === '*' && nx === '/') { state = 'code'; i += 2; continue; }
      if (ch === '\n') out += ch;   /* 保留行号，便于定位 */
      i++; continue;
    }
    /* 引号内原样保留 */
    out += ch;
    if (ch === '\\') { out += src[i + 1] || ''; i += 2; continue; }
    if ((state === 'sq' && ch === "'") || (state === 'dq' && ch === '"') || (state === 'bq' && ch === '`')) state = 'code';
    i++;
  }
  return out;
}

/* ── 工具：提取字符串字面量 ── */
function extractStrings(src) {
  const out = [];
  const re = /'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g;
  let m;
  while ((m = re.exec(src)) !== null) out.push(m[0].slice(1, -1));
  return out;
}

const hits = [];
function scanText(text, origin) {
  if (!text) return;
  FORBIDDEN.forEach(function (w) {
    if (text.indexOf(w) >= 0) hits.push({ source: origin, word: w, text: text.slice(0, 120) });
  });
}

/* ══════ ① WXML 文本节点（用户可见） ══════ */
function walkWxml(dir) {
  const results = [];
  fs.readdirSync(dir).forEach(function (d) {
    const p = path.join(dir, d);
    if (!fs.statSync(p).isDirectory()) return;
    fs.readdirSync(p).forEach(function (f) {
      if (!f.endsWith('.wxml')) return;
      const fp = path.join(p, f);
      let src = fs.readFileSync(fp, 'utf8');
      src = src.replace(/<!--[\s\S]*?-->/g, '');          // 去注释
      src = src.replace(/<[^>]*>/g, '\u0001');             // 标签 → 分隔符
      src.split('\u0001').forEach(function (seg) {
        const t = seg.replace(/\s+/g, ' ').trim();
        if (t) results.push({ file: 'pages/' + d + '/' + f, text: t });
      });
    });
  });
  return results;
}
const wxmlTexts = walkWxml(path.join(ROOT, 'pages'));
wxmlTexts.forEach(function (x) { scanText(x.text, 'WXML可见文本 ' + x.file); });

/* ══════ ② JS 去注释后的字符串字面量 ══════ */
function walkJs(dir, rel) {
  const results = [];
  fs.readdirSync(dir).forEach(function (d) {
    const p = path.join(dir, d);
    const st = fs.statSync(p);
    if (st.isDirectory()) { results.push.apply(results, walkJs(p, rel + d + '/')); return; }
    if (!d.endsWith('.js')) return;
    const src = stripJsComments(fs.readFileSync(p, 'utf8'));
    extractStrings(src).forEach(function (s) {
      if (/[一-龥]/.test(s)) results.push({ file: rel + d, text: s });
    });
  });
  return results;
}
const jsTexts = [];
['pages', 'models'].forEach(function (d) {
  const dir = path.join(ROOT, d);
  if (fs.existsSync(dir)) jsTexts.push.apply(jsTexts, walkJs(dir, d + '/'));
});
if (fs.existsSync(path.join(ROOT, 'app.js'))) {
  const src = stripJsComments(fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8'));
  extractStrings(src).forEach(function (s) { if (/[一-龥]/.test(s)) jsTexts.push({ file: 'app.js', text: s }); });
}
jsTexts.forEach(function (x) { scanText(x.text, 'JS字符串 ' + x.file); });

/* ══════ ③ 数据层「被渲染字段」（这部分最容易漏检） ══════ */
const { CONTENT, TYPE_LABEL, IMPORTANCE_LABEL } = require(path.join(ROOT, 'data/content.js'));
const { RELATIONS } = require(path.join(ROOT, 'data/relations.js'));
const ROUTES = require(path.join(ROOT, 'data/routes.js'));
let ACHIEVEMENTS = [];
try {
  const A = require(path.join(ROOT, 'models/achievements.js'));
  if (typeof A.all === 'function') ACHIEVEMENTS = A.all();
} catch (e) { /* 成就模块不可用时跳过 */ }

Object.keys(TYPE_LABEL).forEach(function (k) { scanText(TYPE_LABEL[k], 'data/content.js 类型标签'); });
Object.keys(IMPORTANCE_LABEL).forEach(function (k) { scanText(IMPORTANCE_LABEL[k], 'data/content.js 重要度标签'); });

CONTENT.forEach(function (c) {
  scanText(c.cn, 'CONTENT.cn ' + c.id);
  scanText(c.en, 'CONTENT.en ' + c.id);
  scanText(c.sf, 'CONTENT.sf(简介) ' + c.id);        // 详情页「作品简介」
  scanText(c.episodes, 'CONTENT.episodes ' + c.id);
  scanText(c.coLabel, 'CONTENT.coLabel ' + c.id);
});
RELATIONS.forEach(function (r, i) {
  scanText(r.why, 'RELATIONS.why(详情页可见) #' + i + ' ' + r.from + '→' + r.to);
});
ROUTES.forEach(function (r) {
  scanText(r.name, 'ROUTES.name ' + r.id);            // 我的MCU「我的片单进度」可见
  scanText(r.tagline, 'ROUTES.tagline ' + r.id);
});
ACHIEVEMENTS.forEach(function (a) {
  ['name', 'desc', 'icon'].forEach(function (k) { if (typeof a[k] === 'string') scanText(a[k], 'ACHIEVEMENTS.' + k + ' ' + a.id); });
});

/* ══════ ④ 长文本排版风险量化 ══════ */
let maxSf = { len: 0 }, maxWhy = { len: 0 }, maxCn = { len: 0 }, maxEn = { len: 0 };
CONTENT.forEach(function (c) {
  if (c.sf && c.sf.length > maxSf.len) maxSf = { len: c.sf.length, id: c.id, text: c.sf };
  if (c.cn && c.cn.length > maxCn.len) maxCn = { len: c.cn.length, id: c.id, text: c.cn };
  if (c.en && c.en.length > maxEn.len) maxEn = { len: c.en.length, id: c.id, text: c.en };
});
RELATIONS.forEach(function (r, i) {
  if (r.why && r.why.length > maxWhy.len) maxWhy = { len: r.why.length, idx: i, text: r.why };
});

/* 每部作品的关系条数分布（详情页最多渲染 4 条） */
const relCount = {};
RELATIONS.forEach(function (r) { relCount[r.from] = (relCount[r.from] || 0) + 1; relCount[r.to] = (relCount[r.to] || 0) + 1; });
const maxRel = Object.keys(relCount).sort(function (a, b) { return relCount[b] - relCount[a]; })[0];

/* 检查长文本容器是否被设为不换行（会导致溢出/截断） */
const nowrapRisks = [];
['pages/movie/movie.wxss', 'pages/library/library.wxss', 'pages/my-mcu/my-mcu.wxss', 'pages/home/home.wxss'].forEach(function (f) {
  const fp = path.join(ROOT, f);
  if (!fs.existsSync(fp)) return;
  const lines = fs.readFileSync(fp, 'utf8').split('\n');
  lines.forEach(function (ln, i) {
    if (/white-space:\s*nowrap/.test(ln)) nowrapRisks.push(f + ':' + (i + 1) + '  ' + ln.trim());
  });
});

/* ══════ 输出 ══════ */
console.log('══════ 用户可见内容合规审计 ══════');
console.log('扫描规模：');
console.log('  WXML 文本节点      ' + wxmlTexts.length + ' 条');
console.log('  JS 去注释字符串    ' + jsTexts.length + ' 条（含中文）');
console.log('  CONTENT            ' + CONTENT.length + ' 条');
console.log('  RELATIONS.why      ' + RELATIONS.length + ' 条');
console.log('  ROUTES             ' + ROUTES.length + ' 条');
console.log('  ACHIEVEMENTS       ' + ACHIEVEMENTS.length + ' 条');
console.log('');

if (hits.length === 0) {
  console.log('  禁用词命中：0 —— 用户可见内容全部合规 ✔');
} else {
  console.log('  禁用词命中 ' + hits.length + ' 处（均为用户可见内容，必须处理）：');
  hits.forEach(function (h) {
    console.log('   - [' + h.word + '] ' + h.source);
    console.log('     ' + h.text);
  });
}

console.log('\n══════ 长文本排版风险量化 ══════');
console.log('  最长简介 sf：' + maxSf.len + ' 字  (' + maxSf.id + ')');
console.log('  最长关系 why：' + maxWhy.len + ' 字  (#' + maxWhy.idx + ')');
console.log('  最长中文名：' + maxCn.len + ' 字  (' + maxCn.id + ' → ' + maxCn.text + ')');
console.log('  最长英文名：' + maxEn.len + ' 字  (' + maxEn.id + ')');
console.log('  单作品最多关系数：' + relCount[maxRel] + ' 条 (' + maxRel + ')，详情页实际渲染上限 4 条');
console.log('');
if (nowrapRisks.length === 0) {
  console.log('  强制不换行（nowrap）容器：0 —— 长文本可正常换行，无截断风险 ✔');
} else {
  console.log('  强制不换行（nowrap）容器 ' + nowrapRisks.length + ' 处（需确认是否承载长文本）：');
  nowrapRisks.forEach(function (x) { console.log('   - ' + x); });
}

console.log('\n════════════════════════════════');
process.exit(hits.length ? 1 : 0);
