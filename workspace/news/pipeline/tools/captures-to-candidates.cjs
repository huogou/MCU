/* ============================================================
 * N1.2 U2 · L0 captures → L1 candidates 生产桥接（真实 DashScope）
 * ------------------------------------------------------------
 * 定位：把 production-capture 落盘的 L0 原始捕获，经**真实 AI Provider**
 *   分析并构造为合法 L1 候选（35 字段），写入候选归档（全 pending，
 *   等待人工审核）。这是「自动采集 → 人工审核」之间的生产桥接层。
 *
 * 链路（严格复用冻结件，零修改）：
 *   captures/<date>.captures.json（L0）
 *     → NA.analyzeCandidate（adapter → contract-validator 7 字段 → bridge）
 *     → CI.fromRawCapture（idSpace 约束 + 35 字段 + L1 校验）
 *     → CandS.appendCandidates（幂等去重落盘）
 *     → status/item-status analysis{}（P1-B：confidence 等扩展字段落位）
 *
 * 纪律：
 *   1. AI 调用上限由 --limit 控制（小批量；默认 3，最大 20）；
 *   2. 单条 AI 失败不阻断批量（fail_reasons 记录）；
 *   3. 不自动 approve、不写 news.js、不碰 deliveries；
 *   4. Key 仅经环境变量 DASHSCOPE_API_KEY；任何输出不含 Key。
 *
 * 用法：
 *   node tools/captures-to-candidates.cjs --date 20261012 [--limit 3]
 *   node tools/captures-to-candidates.cjs --date 20261012 --limit 3 --dry-run
 *
 * 退出码：0 成功 / 1 运行失败 / 2 参数错误
 * ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');

const PIPELINE = path.resolve(__dirname, '..');
const NA = require(path.join(PIPELINE, 'ai', 'news-analyzer.cjs'));        /* P1-B（冻结，只读） */
const CI = require(path.join(PIPELINE, 'candidate-item.cjs'));             /* L1 构造/校验（冻结） */
const CandS = require(path.join(PIPELINE, 'candidate-store.cjs'));         /* L1 归档（冻结） */
const ID = require(path.join(PIPELINE, 'ai-provider', 'id-space.cjs'));    /* h5 真实 idSpace（冻结） */
const SM = require(path.join(PIPELINE, 'status', 'status-machine.cjs'));   /* P1-A 状态层（冻结） */
const DS = require(path.join(PIPELINE, 'ai-provider', 'providers', 'dashscope.cjs'));

function fail(code, message, exitCode) {
  const e = new Error('[' + code + '] ' + message);
  e.code = code;
  e._exit = exitCode || 1;
  throw e;
}

function parseArgs(argv) {
  const a = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (t === '--date') a.date = argv[++i];
    else if (t === '--limit') a.limit = parseInt(argv[++i], 10);
    else if (t === '--dry-run') a.dryRun = true;
    else if (t === '--json') a.json = true;
    else a._.push(t);
  }
  return a;
}

function todayCompact() { return new Date().toISOString().slice(0, 10).replace(/-/g, ''); }

async function main() {
  const a = parseArgs(process.argv.slice(2));
  const date = a.date || todayCompact();
  const limit = Math.min(Math.max(a.limit || 3, 1), 20);   /* 硬顶 20：小批量护栏 */

  /* ---- 输入：当日 L0 捕获归档 ---- */
  const capPath = path.join(PIPELINE, 'captures', date + '.captures.json');
  if (!fs.existsSync(capPath)) fail('CAPTURES_NOT_FOUND', '当日捕获归档不存在：' + capPath + '（先运行 production-capture）');
  const capDoc = JSON.parse(fs.readFileSync(capPath, 'utf8'));
  const captures = Array.isArray(capDoc.captures) ? capDoc.captures : [];
  if (!captures.length) fail('CAPTURES_EMPTY', '当日捕获归档为空：' + capPath);

  /* ---- 真实 idSpace（复用 h5/data，不建第二套） ---- */
  const space = ID.loadIdSpace();

  /* ---- 真实 DashScope Provider（Key 仅来自环境变量） ---- */
  const KEY = process.env.DASHSCOPE_API_KEY || '';
  if (!KEY.trim()) fail('KEY_MISSING', 'DASHSCOPE_API_KEY 未配置（环境变量）');
  const MODEL = process.env.U1_MODEL || 'qwen3.8-flash';
  const provider = DS.createDashScopeProvider({ apiKey: KEY, model: MODEL, baseUrl: DS.DEFAULT_BASE, timeoutMs: 60000 });
  const meta = { model: MODEL, structuredOutput: 'json_schema' };

  /* ---- 选取本批待分析捕获（前 limit 条；内容指纹稳定，重复运行安全） ---- */
  const batch = captures.slice(0, limit);

  const report = {
    date: date,
    model: MODEL,
    captures_total: captures.length,
    batch_size: batch.length,
    ai_success: 0,
    ai_failed: 0,
    candidates_added: 0,
    candidates_skipped: 0,
    candidates_conflicts: 0,
    fail_reasons: [],
    dry_run: !!a.dryRun
  };

  const l1s = [];
  const analysisMap = {};
  for (let i = 0; i < batch.length; i++) {
    const cap = batch[i];
    try {
      /* adapter → contract-validator（7 字段）→ bridge；异常向上抛由本处捕获 */
      const res = await NA.analyzeCandidate({
        provider: provider,
        candidate: cap,
        meta: meta,
        idSpace: space,
        seq: i + 1
      });
      if (!res.seven) throw Object.assign(new Error('seven 为空'), { code: 'SEVEN_EMPTY' });
      /* L0 → L1：fromRawCapture 内部完成 idSpace 丢弃 + 35 字段 + validate */
      const l1 = CI.fromRawCapture(
        cap,
        Object.assign({}, res.seven, { ai_model: res.ai_model || MODEL, gate_status: 'pending' }),
        { seq: i + 1, idSpace: space }
      );
      l1s.push(l1);
      analysisMap[l1.candidate_id] = res.extensions;
      report.ai_success++;
      console.log('  AI✓ ' + (cap.title_raw || '').slice(0, 46) + ' → ' + l1.candidate_id +
        '（' + (res.extensions.credibility || '?') + '/' + (res.extensions.confidence ?? '?') + '）');
    } catch (e) {
      report.ai_failed++;
      report.fail_reasons.push({ capture_id: cap.capture_id || '', code: (e && e.code) || 'ERROR', message: e && e.message });
      console.log('  AI✗ ' + (cap.title_raw || '').slice(0, 46) + ' → ' + ((e && e.code) || 'ERROR'));
    }
  }

  /* ---- 落盘：候选归档（幂等）+ status analysis（P1-B 语义） ---- */
  if (!a.dryRun && l1s.length) {
    const r = CandS.appendCandidates(l1s, { dir: CandS.DEFAULT_DIR, date: date });
    report.candidates_added = r.added;
    report.candidates_skipped = r.skipped;
    report.candidates_conflicts = r.conflicts.length;
    report.candidates_file = r.file;
    const itemStore = SM.createItemStore({ dir: path.join(PIPELINE, 'status'), date: date });
    l1s.forEach(function (c) {
      itemStore.setAnalysis('cand-' + c.candidate_id, analysisMap[c.candidate_id]);
      itemStore.mark('cand-' + c.candidate_id, 'L1', 'AI_ANALYZED', { by: 'captures-to-candidates', evidence: 'ai:' + MODEL, note: 'enriched' });
    });
  }

  console.log('\n---- summary ----');
  console.log(JSON.stringify(report, null, 2));
  if (a.json) return;
  if (report.ai_failed && !report.ai_success) process.exit(1);
}

main().catch(function (e) {
  console.error('失败：' + (e && e.message));
  process.exit(e && e._exit ? e._exit : 1);
});
