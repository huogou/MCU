/* ============================================================
 * G5.4 · S001 专项只读探活（为《S001 html-parser 专项设计》取证）
 * ------------------------------------------------------------
 * ★ 只取证，不实现解析器（任务书：S001 专项只出设计文档，不写代码）。
 * 取证项：
 *   1. marvel.com/robots.txt 状态 + 对 /news、/articles/ 的 policy
 *   2. /news 列表页 status / 字节数 / content-type
 *   3. 列表页 <a href> 中 /articles/* 链接形态分布（影视类过滤依据）
 *   4. application/ld+json 出现次数、@type 分布、首个对象顶层键
 *   5. __NEXT_DATA__ / 站点框架特征
 * 合规：UA=MCUAtlasBot/1.0、单次运行 2 个 GET、robots 优先、无重试循环。
 * 留档：out-s001-probe.txt + 原始 HTML 样本（workspace/sources-probe-s001-news.html）
 * ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');

const HT = require('../http-transport.cjs');

const LOG = path.join(__dirname, 'out-s001-probe.txt');
const SAMPLE = path.resolve(__dirname, '..', '..', '..', '..', 'sources-probe-s001-news.html');
const _lines = [];
function L(s) { _lines.push(s); }
process.on('exit', function () {
  try { fs.writeFileSync(LOG, _lines.join('\n') + '\n', 'utf8'); } catch (e) {}
});

function get(url) {
  return new Promise(function (resolve) {
    const req = https.get(url, {
      headers: { 'User-Agent': HT.UA, 'Accept': 'text/html,*/*;q=0.5' }, timeout: 20000
    }, function (res) {
      /* 跟随一次重定向 */
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const loc = /^https?:\/\//i.test(res.headers.location) ? res.headers.location
          : 'https://www.marvel.com' + res.headers.location;
        res.resume();
        get(loc).then(resolve);
        return;
      }
      let body = '';
      res.on('data', function (c) { body += c; if (body.length > 2 * 1024 * 1024) req.destroy(); });
      res.on('end', function () { resolve({ status: res.statusCode, body: body, contentType: res.headers['content-type'] || '' }); });
    });
    req.on('timeout', function () { req.destroy(); resolve({ status: 0, body: '', err: 'ETIMEDOUT' }); });
    req.on('error', function (e) { resolve({ status: 0, body: '', err: e.code || 'ENETWORK' }); });
  });
}

(async function main() {
  L('S001 只读探活  ' + new Date().toISOString());
  L('UA: ' + HT.UA);

  /* 1) robots.txt */
  const rb = await get('https://www.marvel.com/robots.txt');
  L('\n[1] robots.txt  status=' + rb.status + (rb.err ? ' err=' + rb.err : '') + '  bytes=' + rb.body.length);
  if (rb.body) {
    const parsed = HT.parseRobots(rb.body);
    L('    groups=' + parsed.groups.length + '  named_agents=' + parsed.named_agents.slice(0, 10).join(','));
    ['/news', '/articles/movies/', '/articles/tv-shows/', '/articles/comics/', '/'].forEach(function (p) {
      const m = HT.matchRobots(parsed, p);
      L('    path ' + p + '  →  ' + (m.allowed ? 'ALLOW' : 'DISALLOW') + '  (rule=' + m.rule + ', matched=' + m.matched + ')');
    });
    L('    robots 原文前 600 字：');
    L('    ' + rb.body.slice(0, 600).replace(/\n/g, '\n    '));
  }

  /* 2) /news 列表页 */
  const pg = await get('https://www.marvel.com/news');
  L('\n[2] /news  status=' + pg.status + (pg.err ? ' err=' + pg.err : '') +
    '  bytes=' + pg.body.length + '  contentType=' + pg.contentType);
  if (pg.status !== 200) { L('（列表页未取到，探活终止）'); return; }

  /* 样本留档（供设计文档与后续专项引用） */
  try { fs.writeFileSync(SAMPLE, pg.body, 'utf8'); L('    样本已留档：' + SAMPLE); } catch (e) { L('    样本留档失败：' + e.message); }

  /* 3) /articles/* 链接形态分布 */
  const counts = {};
  const re = /href="(\/articles\/[^"#?]+)/g;
  let m, total = 0;
  while ((m = re.exec(pg.body)) !== null) {
    total++;
    const seg = m[1].split('/')[1] || '?';   /* /articles/<seg>/... */
    counts[seg] = (counts[seg] || 0) + 1;
  }
  L('\n[3] /articles/* 链接分布（href 计数，含重复）  total=' + total);
  Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; }).forEach(function (k) {
    L('    /articles/' + k + '/  × ' + counts[k]);
  });

  /* 4) JSON-LD */
  const ldRe = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  const blocks = [];
  let lm;
  while ((lm = ldRe.exec(pg.body)) !== null && blocks.length < 10) blocks.push(lm[1].trim());
  L('\n[4] application/ld+json  blocks=' + blocks.length);
  blocks.slice(0, 3).forEach(function (b, i) {
    try {
      const obj = JSON.parse(b);
      const arr = Array.isArray(obj) ? obj : [obj];
      arr.forEach(function (o) {
        L('    block[' + i + ']  @type=' + JSON.stringify(o['@type'] || o['@graph'] && '(has @graph)') +
          '  topKeys=' + Object.keys(o).slice(0, 15).join(','));
      });
    } catch (e) {
      L('    block[' + i + ']  JSON 解析失败（' + b.slice(0, 60).replace(/\n/g, ' ') + '…）');
    }
  });

  /* 5) 框架特征 */
  L('\n[5] 框架特征');
  L('    __NEXT_DATA__: ' + (pg.body.indexOf('__NEXT_DATA__') >= 0 ? '存在（Next.js）' : '未见'));
  L('    wp-content: ' + (pg.body.indexOf('wp-content') >= 0 ? '存在（WordPress）' : '未见'));
  L('    drupal: ' + (/drupal/i.test(pg.body) ? '存在' : '未见'));
  const titleM = /<title[^>]*>([^<]*)<\/title>/i.exec(pg.body);
  L('    <title>: ' + (titleM ? titleM[1].trim().slice(0, 80) : '未取到'));

  L('\n探活结束（共 2 次 GET：robots.txt + /news）。');
})();
