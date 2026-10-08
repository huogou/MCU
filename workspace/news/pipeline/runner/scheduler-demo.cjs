/* ============================================================
 * N1.2 P1-C · Dry-Run 演示（手动触发，安全、无业务副作用）
 * ------------------------------------------------------------
 * 运行：node workspace/news/pipeline/runner/scheduler-demo.cjs
 * 行为：构造默认关闭调度器并显式 enable 仅做 dry-run，全链路模拟
 *   Registry → Capture → Candidate → AI → Dedup → Status(off) → G4(diag) → Delivery Preview
 * 产出：临时诊断报告（pipeline/runner/tests/tmp-p1c-dryrun/report.json），
 *       绝不写 run-history / status / 正式业务归档 / news.js。
 * ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');

const PIPELINE = path.resolve(__dirname, '..');
const { createScheduler } = require('./scheduler.cjs');
const A = require('../ai-provider/adapter.cjs');

const TMP = path.join(__dirname, 'tests', 'tmp-p1c-dryrun');
const DATE = '20260925';
const REAL_CAP = JSON.parse(fs.readFileSync(path.join(PIPELINE, 'captures', '20260923.captures.json'), 'utf8')).captures.slice(0, 4);
const REAL_CANDS = JSON.parse(fs.readFileSync(path.join(PIPELINE, 'ai-normalizer', 'output', '20260923.json'), 'utf8')).candidates.slice(0, 6);

const GOOD = {
  title: '《复仇者联盟5》正式立项开拍', summary: '漫威正式宣布第五部复仇者联盟电影立项。',
  category: 'movie', related_movies: ['avengers-5'], related_series: [],
  related_characters: ['iron-man'], related_phases: [5]
};
const provider = A.createProvider('stub', { provide: async function () { return Object.assign({}, GOOD); } });

async function main() {
  fs.mkdirSync(TMP, { recursive: true });
  const sched = createScheduler({ enabled: true, mode: 'dry-run-full', productionAllowed: false });
  const decisions = REAL_CANDS.slice(0, 3).map(function (c) { return { candidate_id: c.candidate_id, action: 'approve' }; })
    .concat(REAL_CANDS.slice(3).map(function (c) { return { candidate_id: c.candidate_id, action: 'reject', reason: 'demo-reject' }; }));

  const r = await sched.triggerDryRun({
    date: DATE,
    captures: REAL_CAP,
    candidates: REAL_CANDS,
    decisions: decisions,
    aiProvider: provider,
    aiMeta: { model: 'stub-model' },
    dirs: { scratch: TMP }
  });

  const m = r.result ? r.result.metrics : {};
  const summary = {
    kind: r.kind,
    execId: r.execId,
    ok: r.ok,
    error: r.error,
    runHistoryRecorded: r.runHistoryRecorded,
    sideEffects: r.sideEffects,
    g4: r.g4,
    metrics: {
      source_success: m.source_success, source_failed: m.source_failed,
      capture_count: m.capture_count, candidate_count: m.candidate_count,
      ai_processed_count: m.ai_processed_count, approved_count: m.approved_count,
      rejected_count: m.rejected_count, delivery_count: m.delivery_count,
      anomaly_count: m.anomaly_count
    },
    scratchFiles: fs.existsSync(TMP) ? fs.readdirSync(TMP) : []
  };
  fs.writeFileSync(path.join(TMP, 'report.json'), JSON.stringify(summary, null, 2), 'utf8');
  console.log('=== P1-C Dry-Run 演示 ===');
  console.log(JSON.stringify(summary, null, 2));
  console.log('结论：runHistoryRecorded=' + r.runHistoryRecorded + '，sideEffects=' + r.sideEffects + '（均应为 false / 无副作用）');
}

main().catch(function (e) { console.error(e); process.exit(1); });
