/* ============================================================
 * N1 · 生产运行 CLI（D1/D2 裁定落地）
 * ------------------------------------------------------------
 * 用法示例：
 *   node run-n1.cjs --mode dry-run --capture-file caps.json
 *   node run-n1.cjs --mode production-capture --sources S002,S004,S006
 *   node run-n1.cjs --mode production-capture --sources S002,S004,S006 --persist
 *   node run-n1.cjs --mode production-review --candidate-file cands.json
 *   node run-n1.cjs --mode production-delivery-preview \
 *        --candidate-file cands.json --decisions-file dec.json --persist
 *
 * 默认业务目录 = pipeline/ 下 captures / candidates / deliveries / run-history；
 * 真实 live 爬取（无 --capture-file）由人工显式触发，本沙箱不自动联网。
 *
 * 退出码：
 *   0  成功
 *   2  参数错误 / 语义冲突（dry-run + --persist）
 *   1  运行异常
 * ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');
const M = require('./run-modes.cjs');
const { runPipeline } = require('./orchestrator.cjs');

function parseArgs(argv) {
  const a = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (t === '--mode') a.mode = argv[++i];
    else if (t === '--persist') a.persist = true;
    else if (t === '--sources') a.sources = argv[++i].split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    else if (t === '--capture-file') a.captureFile = argv[++i];
    else if (t === '--candidate-file') a.candidateFile = argv[++i];
    else if (t === '--decisions-file') a.decisionsFile = argv[++i];
    else if (t === '--out') a.out = argv[++i];
    else if (t === '--business-dir') a.businessDir = argv[++i];
    else if (t === '--run-history-dir') a.runHistoryDir = argv[++i];
    else if (t === '--date') a.date = argv[++i];
    else if (t === '--operator') a.operator = argv[++i];
    else a._.push(t);
  }
  return a;
}

function loadJsonFile(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

async function main() {
  const a = parseArgs(process.argv.slice(2));
  if (!a.mode) { console.error('缺少必需参数 --mode'); process.exit(2); }

  let mode;
  try { mode = M.validateMode(a.mode); }
  catch (e) { console.error('参数错误：' + e.message); process.exit(2); }

  /* D2：dry-run + --persist 必须拒绝（不静默忽略） */
  try { M.checkPersistConflict(mode, !!a.persist); }
  catch (e) { console.error('拒绝执行：' + e.message); process.exit(2); }

  const pipelineDir = path.resolve(__dirname, '..');
  const dirs = M.defaultDirs(pipelineDir);
  if (a.businessDir) {
    dirs.captures = path.join(a.businessDir, 'captures');
    dirs.candidates = path.join(a.businessDir, 'candidates');
    dirs.deliveries = path.join(a.businessDir, 'deliveries');
  }
  if (a.runHistoryDir) dirs.runHistory = a.runHistoryDir;
  const scratch = a.out || path.join(pipelineDir, 'runner', 'tmp-cli');

  const opts = {
    mode: mode,
    persist: !!a.persist,
    date: a.date || '20260924',
    now: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    dirs: Object.assign({}, dirs, { scratch: scratch }),
    sources: a.sources,
    operator: a.operator
  };
  if (a.captureFile) opts.captures = loadJsonFile(a.captureFile);
  if (a.candidateFile) opts.candidates = loadJsonFile(a.candidateFile);
  if (a.decisionsFile) opts.decisions = loadJsonFile(a.decisionsFile);

  const res = await runPipeline(opts);
  console.log(JSON.stringify({
    mode: res.mode,
    persist: res.persist,
    isDryRun: res.isDryRun,
    runHistoryRecorded: res.runHistoryRecorded,
    run_id: res.runId,
    metrics: res.metrics,
    persisted: res.persisted
  }, null, 2));
  process.exit(0);
}

main().catch(function (e) {
  console.error('运行失败：' + (e && e.message));
  process.exit(1);
});
