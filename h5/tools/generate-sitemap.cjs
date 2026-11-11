#!/usr/bin/env node
/* ============================================================
 * MCU Atlas H5 · sitemap.xml 生成器（唯一写入者，本地工具）
 * ------------------------------------------------------------
 * 用法（在仓库根目录执行）：
 *   node h5/tools/generate-sitemap.cjs                 # 生成/更新 h5/sitemap.xml
 *   node h5/tools/generate-sitemap.cjs --check         # 只校验基础 URL 段与当前数据一致
 *
 * V2.1 §6.3 参数（T1–T7）：
 *   --extra <file>        追加 URL（每行 1 个绝对 URL；# 开头为注释）
 *   --out <path>          输出路径（默认 h5/sitemap.xml）
 *   --h5 <dir>            指定 H5 根（默认脚本上一级）
 *   --min-count <n>       合并后 URL 数 < n 则 exit 1
 *   --allow-remove <file> 显式允许移除的 URL 白名单（下架用）
 *   --prev <file>         只增不减比对的上一版（默认输出文件自身）
 *   --check               校验基础段一致性（不写入）
 *
 * 排序与去重（T6）：
 *   - 基础 URL 段保持原有顺序不变
 *   - --extra 段自身排序后追加
 *   - 全表出现重复 → exit 1（不静默跳过）
 *
 * 收录原则：只列「规范 URL + 可访问的页面」，且不含未上映作品。
 * 明确排除：
 *   /index.html            （与 / 重复，规范 URL 为 /）
 *   /special               （与 /special.html 重复，规范 URL 为 /special.html?id=）
 *   /map-pc.html           （站内无入口的孤立页，且与 map.html 全景图重复）
 *   /news-detail.html      （原始 HTML 含 noindex）
 *   社区族薄页 /api/ /百度验证文件
 * 本轮不擅自开放资讯详情收录，是否纳入需单独评估。
 * ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

function parseArgs(argv) {
  const args = { check: false, extra: null, out: null, h5: null, minCount: null, allowRemove: null, prev: null };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--check') args.check = true;
    else if (a === '--extra') args.extra = path.resolve(argv[++i]);
    else if (a === '--out') args.out = path.resolve(argv[++i]);
    else if (a === '--h5') args.h5 = path.resolve(argv[++i]);
    else if (a === '--min-count') args.minCount = Number(argv[++i]);
    else if (a === '--allow-remove') args.allowRemove = path.resolve(argv[++i]);
    else if (a === '--prev') args.prev = path.resolve(argv[++i]);
    else {
      console.error('[sitemap] 未知参数：' + a);
      process.exit(1);
    }
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const H5 = args.h5 || path.resolve(__dirname, '..');
const DATA = path.join(H5, 'data');
const OUT = args.out || path.join(H5, 'sitemap.xml');
const ORIGIN = 'https://www.mcuatlas.xyz';

function loadData() {
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  ['movies', 'series', 'special', 'short', 'content', 'routes', 'special-routes'].forEach(function (name) {
    const p = path.join(DATA, name + '.js');
    vm.runInContext(fs.readFileSync(p, 'utf8'), sandbox, { filename: p, timeout: 2000 });
  });
  return sandbox.window;
}

function xmlEsc(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function readUrlList(file, label) {
  if (!file) return [];
  if (!fs.existsSync(file)) {
    console.error('[sitemap] ' + label + ' 文件不存在：' + file);
    process.exit(1);
  }
  const lines = fs.readFileSync(file, 'utf8').replace(/\r\n?/g, '\n').split('\n');
  const urls = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    urls.push(line);
  }
  return urls;
}

function validateExtra(urls) {
  const seen = new Set();
  for (const url of urls) {
    if (/[\s]/.test(url)) {
      console.error('[sitemap] extra URL 含空白：' + url);
      process.exit(1);
    }
    if (/[&<>"']/.test(url)) {
      console.error('[sitemap] extra URL 含 XML 特殊字符（请使用转义前的裸 URL）：' + url);
      process.exit(1);
    }
    if (!url.startsWith(ORIGIN + '/')) {
      console.error('[sitemap] extra URL 必须属于 ' + ORIGIN + '：' + url);
      process.exit(1);
    }
    if (url.includes('..')) {
      console.error('[sitemap] extra URL 不得含 ..：' + url);
      process.exit(1);
    }
    if (seen.has(url)) {
      console.error('[sitemap] extra 存在重复 URL：' + url);
      process.exit(1);
    }
    seen.add(url);
  }
}

const w = loadData();
const released = w.MCU_CONTENT || [];
const routes = w.MCU_ROUTES || [];
const specials = w.MCU_SPECIAL_ROUTES || [];

/* 生成前守卫：模板必须存在、已上映集合不得混入未上映、URL 不得重复 */
const templates = ['index.html', 'routes.html', 'route-detail.html', 'movie.html',
  'special.html', 'news.html', 'next.html', 'map.html'];
const missing = templates.filter(function (f) { return !fs.existsSync(path.join(H5, f)); });
if (missing.length) {
  console.error('[sitemap] 缺少模板文件：' + missing.join(', '));
  process.exit(1);
}
if (released.some(function (m) { return m.releaseStatus === 'upcoming'; })) {
  console.error('[sitemap] 已上映集合混入未上映作品，拒绝生成。');
  process.exit(1);
}
if (!released.length || !routes.length) {
  console.error('[sitemap] 数据为空，拒绝生成。');
  process.exit(1);
}

const baseUrls = [ORIGIN + '/', ORIGIN + '/routes.html'];
routes.forEach(function (r) {
  baseUrls.push(ORIGIN + '/route-detail.html?id=' + encodeURIComponent(r.id));
});
released.forEach(function (m) {
  baseUrls.push(ORIGIN + '/movie.html?id=' + encodeURIComponent(m.id));
});
specials.forEach(function (s) {
  baseUrls.push(ORIGIN + '/special.html?id=' + encodeURIComponent(s.id));
});
baseUrls.push(ORIGIN + '/news.html', ORIGIN + '/next.html', ORIGIN + '/map.html');

if (new Set(baseUrls).size !== baseUrls.length) {
  console.error('[sitemap] 基础 URL 存在重复，拒绝生成。');
  process.exit(1);
}

const extraUrls = readUrlList(args.extra, '--extra');
validateExtra(extraUrls);
const extraSorted = extraUrls.slice().sort();
for (const url of extraSorted) {
  if (baseUrls.includes(url)) {
    console.error('[sitemap] extra URL 与基础 URL 重复：' + url);
    process.exit(1);
  }
}

const urls = baseUrls.concat(extraSorted);
if (new Set(urls).size !== urls.length) {
  console.error('[sitemap] 合并后存在重复 URL，拒绝生成。');
  process.exit(1);
}
if (Number.isFinite(args.minCount) && urls.length < args.minCount) {
  console.error('[sitemap] 合并后 URL 数 ' + urls.length + ' < --min-count ' + args.minCount + '，拒绝写入。');
  process.exit(1);
}

const allowRemove = new Set(readUrlList(args.allowRemove, '--allow-remove'));
for (const u of allowRemove) {
  if (!u.startsWith(ORIGIN + '/article/')) {
    console.error('[sitemap] --allow-remove 只能用于 CMS 的 /article/ URL，基础 76 条永不允许移除：' + u);
    process.exit(1);
  }
}
const prevFile = args.prev || OUT;
if (!args.check && fs.existsSync(prevFile)) {
  const prevParsed = parseStrictSitemap(fs.readFileSync(prevFile, 'utf8'));
  if (!prevParsed.ok) {
    console.error('[sitemap] 上一版 sitemap 结构非法，拒绝生成：' + prevParsed.error);
    process.exit(1);
  }
  const prevUrls = prevParsed.locs;
  const missingPrev = prevUrls.filter(function (u) { return !urls.includes(u) && !allowRemove.has(u); });
  if (missingPrev.length) {
    console.error('[sitemap] 只增不减守卫触发：' + missingPrev.length + ' 条既有 URL 将消失（未在 --allow-remove 白名单）');
    for (const u of missingPrev.slice(0, 5)) console.error('  - ' + u);
    process.exit(1);
  }
}

const xml = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<!-- 由 h5/tools/generate-sitemap.cjs 生成，请勿手工编辑 -->',
  '<!-- 规范 URL：首页 / ；专题 /special.html?id= ；不含 /index.html、/special、noindex 页与未上映作品 -->',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
].concat(urls.map(function (u) { return '  <url><loc>' + xmlEsc(u) + '</loc></url>'; }))
  .concat(['</urlset>', '']).join('\n');

function readLocList(text) {
  const out = [];
  const re = /<loc>([\s\S]*?)<\/loc>/g;
  let m;
  while ((m = re.exec(text))) out.push(m[1].trim());
  return out;
}

/* 严格结构：只允许 urlset → url → loc，无属性、无 lastmod/priority、无额外元素 */
function parseStrictSitemap(text) {
  let s = String(text || '').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  if (!s) return { ok: false, error: '文件不存在或为空' };
  if (/<!DOCTYPE/i.test(s)) return { ok: false, error: '出现 DOCTYPE' };
  if (/<script\b/i.test(s)) return { ok: false, error: '出现 <script>' };
  s = s.replace(/<!--[\s\S]*?-->/g, '');
  const m = new RegExp(
    '^<\\?xml\\s+version="1\\.0"\\s+encoding="UTF-8"\\?>\\s*'
    + '<urlset xmlns="http:\\/\\/www\\.sitemaps\\.org\\/schemas\\/sitemap\\/0\\.9">'
    + '([\\s\\S]*)</urlset>\\s*$'
  ).exec(s);
  if (!m) return { ok: false, error: 'XML 声明/urlset 根元素/收尾不正确' };
  const body = m[1];
  const re = /<url><loc>([^<]*)<\/loc><\/url>/g;
  const locs = [];
  let last = 0;
  let mm;
  while ((mm = re.exec(body))) {
    if (body.slice(last, mm.index).trim() !== '') return { ok: false, error: '出现 url/loc 之外的节点或文本' };
    const url = mm[1];
    if (!url) return { ok: false, error: 'loc 为空' };
    if (/[&<>"\s]/.test(url)) return { ok: false, error: 'loc 含未转义字符或空白' };
    if (!url.startsWith(ORIGIN + '/')) return { ok: false, error: 'loc 不属于本站' };
    if (url.includes('..')) return { ok: false, error: 'loc 含 ..' };
    locs.push(url);
    last = re.lastIndex;
  }
  if (body.slice(last).trim() !== '') return { ok: false, error: '出现 url/loc 之外的节点或文本' };
  if (!locs.length) return { ok: false, error: '没有 loc' };
  return { ok: true, locs };
}

if (args.check) {
  const cur = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
  const parsed = parseStrictSitemap(cur);
  if (!parsed.ok) {
    console.error('[sitemap] --check 未通过：' + parsed.error);
    process.exit(1);
  }
  const curLocs = parsed.locs;
  const baseOk = curLocs.length >= baseUrls.length
    && baseUrls.every(function (u, idx) { return curLocs[idx] === u; });
  if (!baseOk) {
    console.error('[sitemap] --check 未通过：现有 sitemap 基础段与当前数据不一致（现有 ' + curLocs.length + ' 条，基础 ' + baseUrls.length + ' 条），请重新生成。');
    process.exit(1);
  }
  if (new Set(curLocs).size !== curLocs.length) {
    console.error('[sitemap] --check 未通过：存在重复 loc');
    process.exit(1);
  }

  // 带 --extra：整表必须与「基础 + 本次清单」完全一致（可发现 extra 区域被替换/多/少）
  if (args.extra) {
    const sameLength = curLocs.length === urls.length;
    const sameOrder = sameLength && urls.every(function (u, idx) { return curLocs[idx] === u; });
    if (!sameOrder) {
      const firstDiff = sameLength ? urls.findIndex(function (u, idx) { return curLocs[idx] !== u; }) : -1;
      console.error('[sitemap] --check 未通过：整表与 --extra 清单不一致'
        + (firstDiff >= 0 ? '（首个差异 index=' + firstDiff + '，期望 ' + urls[firstDiff] + '，实际 ' + curLocs[firstDiff] + '）' : '（数量 ' + urls.length + ' vs ' + curLocs.length + '）'));
      process.exit(1);
    }
  } else {
    // 不带 --extra：至少保证 extra 区域全部是本站 /article/ URL、严格升序、无基础段混入
    const tail = curLocs.slice(baseUrls.length);
    for (let i = 0; i < tail.length; i += 1) {
      const u = tail[i];
      if (!u.startsWith(ORIGIN + '/article/')) {
        console.error('[sitemap] --check 未通过：extra 区域出现非 /article/ URL：' + u);
        process.exit(1);
      }
      if (i > 0 && tail[i - 1] >= u) {
        console.error('[sitemap] --check 未通过：extra 区域未严格升序（' + tail[i - 1] + ' >= ' + u + '）');
        process.exit(1);
      }
    }
  }
  console.log('[sitemap] --check 通过：基础段 ' + baseUrls.length + ' 条顺序一致'
    + (args.extra ? '，整表与 --extra 清单一致' : '，extra 区域格式/排序正常')
    + '（文件共 ' + curLocs.length + ' 条 URL）。');
} else {
  const selfCheck = parseStrictSitemap(xml);
  if (!selfCheck.ok) {
    console.error('[sitemap] 内部错误：生成结果不符合严格结构：' + selfCheck.error);
    process.exit(1);
  }
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const tmp = OUT + '.tmp-' + process.pid;
  fs.writeFileSync(tmp, xml, 'utf8');
  fs.renameSync(tmp, OUT);
  console.log('[sitemap] 已生成 ' + path.relative(process.cwd(), OUT) + '，共 ' + urls.length + ' 条 URL（基础 ' + baseUrls.length + ' + extra ' + extraSorted.length + '）。');
}
