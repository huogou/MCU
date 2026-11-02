/* ============================================================
 * N1.2 U3 · 每日运行观察记录生成器（只读）
 * ------------------------------------------------------------
 * 用法：
 *   node tools/daily-observation.cjs --date 20261012 [--out <dir>]
 *   node tools/daily-observation.cjs                # 默认今天
 *
 * 数据源（全部只读，不写任何业务数据）：
 *   - captures/<date>.captures.json          采集数量 / 成功源
 *   - candidates/<date>.json                 候选数量 / gate 分布
 *   - candidates/review-history.json         当日审核动作
 *   - deliveries/*<date>*                    当日 delivery preview
 *   - tools/state/news-write-state.json      当日发布记录
 *   - run-history/*.json                     当日运行记录
 *   - /var/log/mcu-atlas-capture.log         采集日志错误/退出码
 *
 * 输出：<out>/YYYY-MM-DD资讯运行记录.md（默认 <pipeline>/runtime/）
 * ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');

const PIPELINE = path.resolve(__dirname, '..');
const LOG_FILE = '/var/log/mcu-atlas-capture.log';

function parseArgs(argv) {
  const a = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (t === '--date') a.date = argv[++i];
    else if (t === '--out') a.out = argv[++i];
    else a._.push(t);
  }
  return a;
}

function todayCompact() { return new Date().toISOString().slice(0, 10).replace(/-/g, ''); }
function readJsonSafe(p) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return null; } }
function listDirSafe(d) { try { return fs.readdirSync(d); } catch (e) { return []; } }

async function main() {
  const a = parseArgs(process.argv.slice(2));
  const D = a.date || todayCompact();
  const iso = D.slice(0, 4) + '-' + D.slice(4, 6) + '-' + D.slice(6, 8);
  const outDir = a.out || path.join(PIPELINE, 'runtime');

  /* 1. 采集 */
  const capFile = path.join(PIPELINE, 'captures', D + '.captures.json');
  let captureCount = 0, sources = [];
  const capDoc = readJsonSafe(capFile);
  if (capDoc && Array.isArray(capDoc.captures)) {
    captureCount = capDoc.captures.length;
    const sset = {};
    capDoc.captures.forEach(function (c) { if (c.registry_id) sset[c.registry_id] = (sset[c.registry_id] || 0) + 1; });
    sources = Object.keys(sset).map(function (k) { return k + '(' + sset[k] + ')'; });
  }

  /* 2. 候选 */
  const candFile = path.join(PIPELINE, 'candidates', D + '.json');
  let candCount = 0, gateDist = {};
  const candDoc = readJsonSafe(candFile);
  if (candDoc && Array.isArray(candDoc.candidates)) {
    candCount = candDoc.candidates.length;
    candDoc.candidates.forEach(function (c) { gateDist[c.gate_status] = (gateDist[c.gate_status] || 0) + 1; });
  }

  /* 3. 审核（当日 review-history 条目） */
  const hist = readJsonSafe(path.join(PIPELINE, 'candidates', 'review-history.json'));
  const reviews = (hist && Array.isArray(hist.entries)) ? hist.entries.filter(function (h) {
    return String(h.created_at || '').slice(0, 10).replace(/-/g, '') === D;
  }) : [];

  /* 4. 发布（当日 news-write-state 条目） */
  const wstate = readJsonSafe(path.join(PIPELINE, 'tools', 'state', 'news-write-state.json'));
  const writes = (wstate && Array.isArray(wstate.writes)) ? wstate.writes.filter(function (w) {
    return String(w.written_at || '').slice(0, 10).replace(/-/g, '') === D;
  }) : [];

  /* 5. delivery preview（当日） */
  const previews = listDirSafe(path.join(PIPELINE, 'deliveries')).filter(function (f) { return f.indexOf(D) >= 0; });

  /* 6. run-history（当日） */
  const runs = listDirSafe(path.join(PIPELINE, 'run-history')).filter(function (f) { return f.indexOf(D) >= 0; });

  /* 7. 采集日志错误/退出码（当日附近窗口） */
  let logErrors = '（无采集日志或无错误记录）';
  try {
    const log = fs.readFileSync(LOG_FILE, 'utf8');
    const lines = log.split('\n');
    const idx = [];
    lines.forEach(function (l, i) { if (l.indexOf(D) >= 0) idx.push(i); });
    if (idx.length) {
      const seg = lines.slice(Math.max(0, idx[0] - 2), idx[idx.length - 1] + 2);
      const bad = seg.filter(function (l) {
        if (/_failed"?\s*:\s*0/.test(l)) return false;          /* 零值统计行不算错误 */
        if (/_reasons"?\s*:\s*\[\s*\]/.test(l)) return false;    /* 空原因列表不算错误 */
        return /error|fail|EXIT=[^0]|超时|timeout|Error|FAIL/i.test(l);
      });
      logErrors = bad.length ? bad.slice(0, 10).join('\n') : '无错误（退出码 0）';
    }
  } catch (e) { /* 日志不可读：忽略 */ }

  /* 8. AI 耗时：当日若有桥接运行记录则取，否则标注待补 */
  const aiDuration = process.env.AI_DURATION_NOTE || '待人工补充（tools/captures-to-candidates 未自动记录耗时）';

  /* 汇总行 */
  const gateStr = Object.keys(gateDist).map(function (k) { return k + ' ' + gateDist[k]; }).join(' / ') || '-';
  const md = [
    '# ' + iso + ' 资讯运行记录',
    '',
    '> 生成：tools/daily-observation.cjs（只读采集，自动生成于 ' + new Date().toISOString().replace(/\.\d{3}Z$/, 'Z') + '）',
    '',
    '| 指标 | 值 |',
    '|---|---|',
    '| capture 数量 | ' + captureCount + ' |',
    '| 成功新闻源 | ' + (sources.length ? sources.join(', ') : '-') + ' |',
    '| candidate 数量 | ' + candCount + (candCount ? '（' + gateStr + '）' : '') + ' |',
    '| AI 生成数量 | ' + candCount + '（captures-to-candidates 产出即 AI 生成） |',
    '| 审核数量 | ' + reviews.length + (reviews.length ? '（' + reviews.map(function (r) { return r.action; }).join('/') + '）' : '') + ' |',
    '| 发布数量 | ' + writes.length + (writes.length ? '（' + writes.map(function (w) { return '+' + w.added_count + ' 条 → ' + String(w.sha_after).slice(0, 8); }).join('；') + '）' : '') + ' |',
    '| delivery preview | ' + (previews.length ? previews.join(', ') : '-') + ' |',
    '| run-history | ' + (runs.length ? runs.join(', ') : '-') + ' |',
    '| API 耗时 | ' + aiDuration + ' |',
    '',
    '## 审核明细',
    reviews.length ? reviews.map(function (r) { return '- ' + r.review_id + ' ' + r.action + ' ' + r.candidate_id + '（' + r.operator + '）' + (r.reason ? ' 原因：' + r.reason : ''); }).join('\n') : '- 无',
    '',
    '## 发布明细',
    writes.length ? writes.map(function (w) { return '- ' + w.run_id + '：+' + w.added_count + ' 条（' + w.old_count + '→' + w.new_count + '）operator=' + w.operator + ' sha ' + String(w.sha_before).slice(0, 8) + '→' + String(w.sha_after).slice(0, 8); }).join('\n') : '- 无',
    '',
    '## 错误日志',
    '```',
    logErrors,
    '```',
    ''
  ].join('\n');

  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, iso + '资讯运行记录.md');
  fs.writeFileSync(outFile, md, 'utf8');
  console.log('已生成：' + outFile);
  console.log('capture=' + captureCount + ' candidates=' + candCount + ' reviews=' + reviews.length + ' writes=' + writes.length);
}

main().catch(function (e) { console.error('失败：' + e.message); process.exit(1); });
