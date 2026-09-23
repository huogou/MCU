/* ============================================================
 * G5.4 一次性取证脚本：robots 审计回填 source-health-report.json
 * ------------------------------------------------------------
 * 背景：test-g5-4.cjs 首次运行时 origin 提取正则缺捕获组，
 *       health 报告的 robots_policy 落空。capture/candidates/events
 *       数据本身无缺陷，无需重采——本脚本对 5 个 origin **重取一次
 *       robots.txt**（robots.txt 是审计对象本身，取它无合规问题），
 *       用与 http-transport 完全相同的 parseRobots/matchRobots 重算
 *       policy 后回填。
 * ★ 诚实口径：回填值为「同日事后复查值」，非采集时刻原值；
 *   source-health-report.json 的 note 已注明。
 * ============================================================ */
'use strict';

const https = require('https');
const fs = require('fs');
const path = require('path');

const HT = require('../http-transport.cjs');

const REG = require(path.join(__dirname, '..', '..', '..', 'engine', 'news-registry.cjs'));
const HEALTH = path.join(__dirname, '..', '..', 'source-health-report.json');

function fetchRobots(origin) {
  return new Promise(function (resolve) {
    const req = https.get(origin + '/robots.txt', {
      headers: { 'User-Agent': HT.UA }, timeout: 15000
    }, function (res) {
      let body = '';
      res.on('data', function (c) { body += c; });
      res.on('end', function () { resolve({ status: res.statusCode, body: body }); });
    });
    req.on('timeout', function () { req.destroy(); resolve({ status: 0, body: '', err: 'ETIMEDOUT' }); });
    req.on('error', function (e) { resolve({ status: 0, body: '', err: e.code || 'ENETWORK' }); });
  });
}

async function main() {
  const doc = JSON.parse(fs.readFileSync(HEALTH, 'utf8'));
  const results = {};

  for (const id of Object.keys(doc.sources)) {
    const entry = REG.byId(id);
    if (!entry || !entry.feed_url) { results[id] = { note: '无登记出口' }; continue; }
    const om = /^(https?:\/\/[^\/?#]+)/i.exec(entry.feed_url);
    const origin = om ? om[1].toLowerCase() : '';
    const pm = /^https?:\/\/[^\/?#]+([^?#]*)/i.exec(entry.feed_url);
    const feedPath = pm ? (pm[1] || '/') : '/';

    const r = await fetchRobots(origin);
    const rec = { origin: origin, feed_path: feedPath, robots_status: r.status };
    if (r.status === 200 && r.body) {
      const parsed = HT.parseRobots(r.body);
      const m = HT.matchRobots(parsed, feedPath);
      rec.policy = m.allowed ? 'allow' : 'disallow';
      rec.matched_rule = m.rule;
    } else if (r.status === 404) {
      rec.policy = 'allow'; rec.note = 'robots.txt 404 → 按允许处理';
    } else {
      rec.policy = 'unknown'; rec.note = 'status=' + r.status + (r.err ? ' err=' + r.err : '');
    }
    results[id] = rec;
    console.log(id + '  ' + origin + '  robots=' + r.status + '  policy=' + rec.policy +
      (rec.matched_rule ? '  rule=' + rec.matched_rule : ''));
  }

  /* 回填：批级 per_source 与顶层 sources 聚合 */
  doc.robots_reaudit = {
    method: '同日事后复查（重取 robots.txt，parseRobots/matchRobots 与 http-transport 同源）',
    checked_at: new Date().toISOString(),
    results: results
  };
  Object.keys(results).forEach(function (id) {
    const rec = results[id];
    if (doc.sources[id]) doc.sources[id].robots_policy_last = rec.policy || null;
    doc.batches.forEach(function (b) {
      if (b.per_source && b.per_source[id] && 'robots_policy' in b.per_source[id]) {
        b.per_source[id].robots_policy = rec.policy || null;
      }
    });
  });
  doc.note = doc.note + '；robots_policy 为同日事后复查值（见 robots_reaudit），非采集时刻原值';
  fs.writeFileSync(HEALTH, JSON.stringify(doc, null, 2), 'utf8');
  console.log('回填完成：' + HEALTH);
}

main().catch(function (e) { console.error('FAIL: ' + e.message); process.exit(1); });
