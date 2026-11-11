#!/usr/bin/env node
/* ============================================================
 * MCU Atlas H5 · 第一轮基础修复本地回归（纯 Node，无第三方依赖）
 * ------------------------------------------------------------
 * 用法（在仓库根目录执行）：
 *   node h5/tools/regression-basic.cjs
 *
 * 覆盖：发布状态、序号、11 条路线、复联5专题、名称统一、
 *       下一部推荐去重口径、localStorage 键、robots/sitemap/canonical。
 * 浏览器渲染验证不在此脚本内，需另行跑浏览器冒烟。
 * 退出码：0=全部 PASS；1=存在 FAIL。
 * ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const H5 = path.resolve(__dirname, '..');
const DATA = path.join(H5, 'data');
const failures = [];

function check(name, cond, detail) {
  const ok = !!cond;
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' :: ' + detail : ''));
  if (!ok) failures.push(name);
}
function read(f) { return fs.readFileSync(path.join(H5, f), 'utf8'); }
function exists(f) { return fs.existsSync(path.join(H5, f)); }

/* ---------- 载入全部 H5 数据（content.js 合成已上映 / 全部两个集合） ---------- */
const sandbox = { window: {} };
vm.createContext(sandbox);
['movies', 'series', 'special', 'short', 'content', 'routes', 'relations',
  'characters', 'upcoming', 'special-routes', 'news', 'community',
  'posters', 'stills', 'visuals'].forEach(function (name) {
  const p = path.join(DATA, name + '.js');
  vm.runInContext(fs.readFileSync(p, 'utf8'), sandbox, { filename: p });
});
const w = sandbox.window;

const released = w.MCU_CONTENT || [];
const all = w.MCU_CONTENT_ALL || [];
const upcomingIds = all.filter(function (x) { return x.releaseStatus === 'upcoming'; })
  .map(function (x) { return x.id; }).sort();
const releasedIds = {};
released.forEach(function (m) { releasedIds[m.id] = 1; });
const allIds = {};
all.forEach(function (m) { allIds[m.id] = 1; });

/* ---------- 1. 发布状态 ---------- */
check('未上映条目恰为 3 部', upcomingIds.length === 3 &&
  upcomingIds.join(',') === 'doomsday,secretwars,visionquest', upcomingIds.join(','));
check('已上映集合不含未上映作品',
  !released.some(function (m) { return m.releaseStatus === 'upcoming'; }),
  '已上映 ' + released.length + ' 部 / 全部 ' + all.length + ' 部');
check('未上映条目不占用上映/时间线序号',
  all.filter(function (x) { return x.releaseStatus === 'upcoming'; })
    .every(function (x) { return x.ro === null && x.co === null; }));
check('已上映上映序 ro 连续 1..N',
  released.every(function (m, i) { return m.ro === i + 1; }), 'N=' + released.length);
check('已上映时间线序 co 唯一且落在 1..N',
  new Set(released.map(function (m) { return m.co; })).size === released.length &&
  released.every(function (m) { return m.co >= 1 && m.co <= released.length; }));
check('未上映条目来源标注为待核实，不继承官方核验口径',
  all.filter(function (x) { return x.releaseStatus === 'upcoming'; })
    .every(function (x) { return x.confidence === 'pending_review' && x.verified_at === null; }));

/* ---------- 2. 路线与专题 ---------- */
const routes = w.MCU_ROUTES || [];
check('11 条观影路线', routes.length === 11, '实际 ' + routes.length);
const badRouteItems = [];
routes.forEach(function (r) {
  (r.items || []).forEach(function (id) { if (!releasedIds[id]) badRouteItems.push(r.id + ':' + id); });
});
check('手写路线不含未上映 / 悬空作品', badRouteItems.length === 0, badRouteItems.join(', ') || '无一异常');
check('生成器路线所需常量齐备',
  ['release', 'chrono', 'mainline', 'essential'].every(function (g) {
    return routes.some(function (r) { return r.generator === g; });
  }));

const specials = w.MCU_SPECIAL_ROUTES || [];
check('复联5专题存在', specials.some(function (s) { return s.id === 'avengers-doomsday'; }));
const sp = specials[0];
check('专题核心 8 部 / 完整 15 部',
  sp.core.items.length === 8 && sp.full.items.length === 15,
  sp.core.items.length + '/' + sp.full.items.length);
const badSpecialItems = [];
[sp.origin].concat(sp.core.items, sp.full.items).forEach(function (it) {
  if (it && it.workId && !allIds[it.workId]) badSpecialItems.push(it.workId);
});
check('专题引用作品均可按 id 查到详情', badSpecialItems.length === 0, badSpecialItems.join(', ') || '无一悬空');

/* ---------- 3. 关系与名称统一 ---------- */
const badRel = (w.MCU_RELATIONS || []).filter(function (r) { return !allIds[r.from] || !allIds[r.to]; });
check('全部关系两端均可解析', badRel.length === 0, badRel.length + ' 条异常');
const up = w.MCU_UPCOMING || [];
const linked = up.filter(function (u) { return u.contentId; });
check('未来计划条目通过 contentId 关联未上映作品详情',
  linked.length === 2 && linked.every(function (u) {
    const m = all.find(function (x) { return x.id === u.contentId; });
    return m && m.releaseStatus === 'upcoming';
  }), linked.map(function (u) { return u.contentId; }).join(', '));
check('未来计划中文片名与作品主数据一致',
  linked.every(function (u) {
    const m = all.find(function (x) { return x.id === u.contentId; });
    return m && m.cn === u.title;
  }), up.map(function (u) { return u.title; }).join(' / '));
check('同一部片不会在下一部推荐里出现两次',
  up.filter(function (u) { return u.contentId && allIds[u.contentId]; }).length === 2 &&
  read('next.html').indexOf('linkedIds[u.contentId]') >= 0);
check('待核实档期已标记 pendingReview',
  up.filter(function (u) { return u.pendingReview; }).map(function (u) { return u.id; }).sort().join(',') ===
  'black-panther-3,ghost-rider');
check('VisionQuest 保留待核实标记且不进入已上映集合',
  !releasedIds.visionquest && (all.find(function (x) { return x.id === 'visionquest'; }) || {}).pendingReview === true);
check('专题副标题使用统一片名', sp.tagline.indexOf('复仇者联盟：末日') >= 0, sp.tagline);

/* ---------- 4. 用户数据兼容 ---------- */
const appJs = read('assets/js/app.js');
check('localStorage 键名未变（历史进度不丢失）',
  appJs.indexOf("var KEY = 'mcu_nav_user_v1'") >= 0 &&
  appJs.indexOf("var LEGACY_KEY = 'mcu_nav_seen_v1'") >= 0);
check('按 id 查询覆盖全部内容（含未上映）',
  appJs.indexOf('ALL_CONTENT.forEach(function (m) { byId[m.id] = m; })') >= 0);
check('观影进度统计排除未上映作品且保留原始记录',
  appJs.indexOf('isUpcoming: function (id)') >= 0 &&
  (appJs.match(/return !data\.isUpcoming\(id\);/g) || []).length === 2);
check('资讯条目数未因修复减少', (w.MCU_NEWS || []).length >= 49, '实际 ' + (w.MCU_NEWS || []).length);

/* ---------- 5. SEO 基础设施 ---------- */
check('robots.txt 存在且声明 Sitemap',
  exists('robots.txt') && read('robots.txt').indexOf('Sitemap: https://www.mcuatlas.xyz/sitemap.xml') >= 0);
check('sitemap.xml 存在', exists('sitemap.xml'));
const sitemap = exists('sitemap.xml') ? read('sitemap.xml') : '';
const locs = Array.from(sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)).map(function (m) { return m[1]; });
const expectedCount = 2 + routes.length + released.length + specials.length + 3;
check('sitemap URL 数与当前数据一致', locs.length === expectedCount,
  '实际 ' + locs.length + ' / 期望 ' + expectedCount);
check('sitemap 不含重复 URL', new Set(locs).size === locs.length);
check('sitemap 排除 /index.html 与无扩展名 /special',
  !locs.some(function (u) { return u === 'https://www.mcuatlas.xyz/index.html' || u.indexOf('/special?') >= 0 || u === 'https://www.mcuatlas.xyz/special'; }));
check('sitemap 排除 noindex 页与孤立地图页',
  !locs.some(function (u) { return /news-detail|map-pc|community|topic-detail|post-create/.test(u); }));
check('sitemap 不含未上映作品详情',
  !locs.some(function (u) { return upcomingIds.some(function (id) { return u.indexOf('id=' + id) >= 0; }); }));
check('sitemap 中所有模板文件真实存在',
  ['index.html', 'routes.html', 'route-detail.html', 'movie.html', 'special.html', 'news.html', 'next.html', 'map.html']
    .every(function (f) { return exists(f); }));

const staticPages = {
  'index.html': 'https://www.mcuatlas.xyz/',
  'routes.html': 'https://www.mcuatlas.xyz/routes.html',
  'news.html': 'https://www.mcuatlas.xyz/news.html',
  'next.html': 'https://www.mcuatlas.xyz/next.html',
  'map.html': 'https://www.mcuatlas.xyz/map.html'
};
Object.keys(staticPages).forEach(function (f) {
  check('静态 canonical: ' + f,
    read(f).indexOf('<link rel="canonical" data-static="1" href="' + staticPages[f] + '">') >= 0);
});
check('首页规范 URL 为 / 而非 /index.html',
  read('index.html').indexOf('<link rel="canonical" data-static="1" href="https://www.mcuatlas.xyz/">') >= 0);
check('运行时 canonical 规范化重复 URL',
  appJs.indexOf("'/index.html': '/'") >= 0 && appJs.indexOf("'/special': '/special.html'") >= 0);
check('资讯详情 canonical 保留 ?id=',
  appJs.indexOf("'news-detail.html': ['id']") >= 0);
check('资讯详情仍为 noindex（未擅自开放收录）',
  read('news-detail.html').indexOf('<meta name="robots" content="noindex">') >= 0);
check('参数化详情页未在原始 HTML 写入会互相归一的无参 canonical',
  ['movie.html', 'route-detail.html', 'special.html'].every(function (f) {
    return read(f).indexOf('rel="canonical"') < 0;
  }));
check('运行时 canonical 固定为 www 规范域名',
  appJs.indexOf("var CANON_ORIGIN = 'https://www.mcuatlas.xyz';") >= 0 &&
  appJs.indexOf('var canon = CANON_ORIGIN + path') >= 0);
check('sitemap 全部 URL 使用 www 域名',
  locs.length > 0 && locs.every(function (u) { return u.indexOf('https://www.mcuatlas.xyz/') === 0; }));
check('H5 目录内无「非 www」绝对规范地址残留', (function () {
  const found = [];
  function walk(dir) {
    fs.readdirSync(dir, { withFileTypes: true }).forEach(function (e) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { if (e.name !== 'review') walk(p); }
      else if (/\.(html|js|cjs|txt|xml|css)$/.test(e.name)) {
        if (/https?:\/\/(?!www\.)mcuatlas\.xyz/.test(fs.readFileSync(p, 'utf8'))) found.push(p);
      }
    });
  }
  walk(H5);
  if (found.length) console.log('      残留文件: ' + found.join(', '));
  return found.length === 0;
})());

console.log('');
if (failures.length) {
  console.log('结果：FAIL ' + failures.length + ' 项 -> ' + failures.join(' | '));
  process.exitCode = 1;
} else {
  console.log('结果：全部 PASS。');
  process.exitCode = 0;
}
