#!/usr/bin/env node
/* ============================================================
 * MCU Atlas H5 · 发布前「线上 / 本地」数据差异检查（只读）
 * ------------------------------------------------------------
 * 用法（在仓库根目录执行）：
 *   node h5/tools/check-live-local-diff.cjs            # 比较数据集合，检测漂移
 *   node h5/tools/check-live-local-diff.cjs --full    # 额外列出页面/配置文件的全文差异
 *
 * 只做只读检查：不写任何文件、不修改线上、不部署。
 * 比较口径是「条目 id 集合」而非全文 hash，因此本地新增字段
 * （如 releaseStatus / contentId）不会被误判为数据漂移。
 * 退出码：0=集合一致；1=存在线上独有或本地独有条目；2=线上读取失败。
 * ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const H5 = path.resolve(__dirname, '..');
const ORIGIN = 'https://www.mcuatlas.xyz';
const DATA_FILES = [
  'movies', 'series', 'special', 'short', 'content', 'routes', 'relations',
  'characters', 'upcoming', 'special-routes', 'news', 'community',
  'posters', 'stills', 'visuals'
];
const ID_SETS = [
  'MCU_MOVIES', 'MCU_SERIES', 'MCU_SPECIAL', 'MCU_SHORT', 'MCU_CHARACTERS',
  'MCU_ROUTES', 'MCU_SPECIAL_ROUTES', 'MCU_NEWS', 'MCU_UPCOMING'
];
const FULL_FILES = [
  'index.html', 'routes.html', 'route-detail.html', 'movie.html', 'special.html',
  'news.html', 'news-detail.html', 'next.html', 'map.html', 'map-pc.html',
  'community.html', 'topic-detail.html', 'my-community.html', 'post-create.html',
  'robots.txt', 'sitemap.xml',
  'assets/js/app.js', 'assets/js/components.js', 'assets/js/forum.js'
];

function norm(s) { return String(s).replace(/\r\n/g, '\n'); }

function evalAll(texts, errors) {
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  DATA_FILES.forEach(function (name) {
    if (!texts[name]) return;
    try {
      vm.runInContext(texts[name], sandbox, { filename: name + '.js' });
    } catch (e) {
      errors.push(name + '.js 解析失败: ' + e.message);
    }
  });
  return sandbox.window;
}

function idsOf(arr) {
  return (arr || []).map(function (x) { return String(x.id); }).filter(Boolean);
}

function diffSets(a, b) {
  const sa = new Set(a), sb = new Set(b);
  return {
    onlyRemote: a.filter(function (x) { return !sb.has(x); }),
    onlyLocal: b.filter(function (x) { return !sa.has(x); })
  };
}

async function fetchText(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return await res.text();
}

async function main() {
  const full = process.argv.indexOf('--full') >= 0;
  const localTexts = {}, remoteTexts = {};
  const errors = [];
  let netFailed = 0;

  DATA_FILES.forEach(function (name) {
    const p = path.join(H5, 'data', name + '.js');
    if (fs.existsSync(p)) localTexts[name] = fs.readFileSync(p, 'utf8');
    else errors.push('本地缺少 data/' + name + '.js');
  });

  for (const name of DATA_FILES) {
    try {
      remoteTexts[name] = await fetchText(ORIGIN + '/data/' + name + '.js');
    } catch (e) {
      netFailed++;
      errors.push('线上读取 data/' + name + '.js 失败: ' + e.message);
    }
  }

  const L = evalAll(localTexts, errors);
  const R = evalAll(remoteTexts, errors);

  console.log('=== 线上 / 本地数据集合差异检查 ===');
  console.log('集合'.padEnd(22) + '线上'.padEnd(8) + '本地'.padEnd(8) + '线上独有 / 本地独有');
  let drift = 0;

  ID_SETS.forEach(function (key) {
    const a = idsOf(R[key]), b = idsOf(L[key]);
    const d = diffSets(a, b);
    const flag = (d.onlyRemote.length || d.onlyLocal.length) ? ' <== 需处理' : '';
    console.log(
      key.padEnd(22) + String(a.length).padEnd(8) + String(b.length).padEnd(8) +
      '[' + d.onlyRemote.join(', ') + '] / [' + d.onlyLocal.join(', ') + ']' + flag
    );
    if (d.onlyRemote.length || d.onlyLocal.length) drift++;
  });

  /* 关系表用 from->to 作为键 */
  const relKey = function (r) { return r.from + '->' + r.to; };
  const relR = (R.MCU_RELATIONS || []).map(relKey);
  const relL = (L.MCU_RELATIONS || []).map(relKey);
  const relD = diffSets(relR, relL);
  console.log('MCU_RELATIONS'.padEnd(22) + String(relR.length).padEnd(8) + String(relL.length).padEnd(8) +
    '[' + relD.onlyRemote.join(', ') + '] / [' + relD.onlyLocal.join(', ') + ']' +
    ((relD.onlyRemote.length || relD.onlyLocal.length) ? ' <== 需处理' : ''));
  if (relD.onlyRemote.length || relD.onlyLocal.length) drift++;

  /* 未上映集合：线上尚未部署 releaseStatus 时只作提示，不计入数据漂移。 */
  const upR = (R.MCU_CONTENT_ALL || []).filter(function (x) { return x.releaseStatus === 'upcoming'; }).map(function (x) { return x.id; }).sort();
  const upL = (L.MCU_CONTENT_ALL || []).filter(function (x) { return x.releaseStatus === 'upcoming'; }).map(function (x) { return x.id; }).sort();
  if (!R.MCU_CONTENT_ALL) {
    console.log('未上映集合：线上尚无 releaseStatus / MCU_CONTENT_ALL（本轮修复后的预期差异，不计入漂移）');
  } else {
    console.log('未上映集合 线上=[' + upR.join(', ') + '] 本地=[' + upL.join(', ') + ']');
    if (upR.join(',') !== upL.join(',')) drift++;
  }

  if (full) {
    console.log('');
    console.log('=== 页面 / 配置全文差异（部署前预期会列出的待更新文件）===');
    for (const f of FULL_FILES) {
      const lp = path.join(H5, f);
      if (!fs.existsSync(lp)) { console.log('DIFF ' + f + ' (本地缺失)'); continue; }
      try {
        const remote = await fetchText(ORIGIN + '/' + f);
        if (norm(remote) !== norm(fs.readFileSync(lp, 'utf8'))) console.log('DIFF ' + f);
      } catch (e) {
        console.log('SKIP ' + f + ' (' + e.message + ')');
      }
    }
  }

  errors.forEach(function (e) { console.log('WARN ' + e); });
  console.log('');
  if (netFailed) {
    console.log('结论：线上读取不完整（' + netFailed + ' 个文件），结果不可用于发布判定。');
    process.exitCode = 2;
  } else if (drift) {
    console.log('结论：发现 ' + drift + ' 处数据集合差异。发布前须先按线上回同步或人工确认。');
    process.exitCode = 1;
  } else {
    console.log('结论：PASS —— 线上与本地的条目集合一致，无数据漂移。');
    process.exitCode = 0;
  }
}

main().catch(function (e) {
  console.error('[check] 执行失败: ' + e.message);
  process.exitCode = 2;
});
