/* ============================================================
 * N1 · 生产运行编排器（D1/D2 裁定落地）
 * ------------------------------------------------------------
 * 职责：把既有的「采集 → 候选 → 审核 → Gate → Delivery」冻结管道
 *       串成一个可重复运行的生产流程，并严格按 D1/D2 矩阵接线
 *       run-history 与业务数据持久化。
 *
 * ★ 本模块是「接线层」，不重写/不重构/不重新设计任何冻结件：
 *   - 采集用 base-collector.collectLive（含 LIVE_ALLOWED 守卫、S001 不在内）
 *   - 候选用 candidate-store、审核用 review-queue / review-actions
 *   - Gate 用 gate.review、交付用 delivery-converter（零网络、不写 h5）
 *   - run-history 用 run-history.record（10 字段封闭集、append-only）
 *   - 不自动 approve、不自动写 news.js、不改 8 态 / 33 字段 / 判定语义
 *
 * 行为矩阵（见 run-modes.cjs）：
 *   dry-run                  → 纯内存计算 + 终端/报告输出；不写 run-history、不落盘
 *   production-*            → 必须写 run-history
 *   production-* + --persist→ 额外正式写业务归档（capture/candidate/deliveries）
 *   production-*（无persist）→ 可写临时 scratch，但不碰正式业务归档
 * ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');

const M = require('./run-modes.cjs');
const RH = require('../run-history/run-history.cjs');
const CS = require('../capture-store.cjs');
const CandS = require('../candidate-store.cjs');
const RQ = require('../review/review-queue.cjs');
const RA = require('../review/review-actions.cjs');
const GATE = require('../gate/gate.cjs');
const DC = require('../delivery/delivery-converter.cjs');
const SM = require('../status/status-machine.cjs');   /* N1.2 P1-A 状态追踪层（隔离于 L0/L1/L2） */

function fail(code, message) {
  const e = new Error('[' + code + '] ' + message);
  e.code = code;
  throw e;
}

function nowIso() { return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'); }

function writeJson(file, obj) {
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(obj, null, 2), 'utf8');
}

/* ---------------- 阶段 1：采集（L0 RawCapture） ---------------- */

/**
 * 产出 RawCapture 数组。
 *   - opts.captures 直接给定（测试 / 离线）→ 原样返回，source 统计为 0；
 *   - 否则走真实采集器 collectLive（可注入 transport；S001 不在 LIVE_ALLOWED，
 *     强行传入会被 collectLive 的守卫拒绝 → fail closed）。
 */
async function collectStage(opts) {
  if (Array.isArray(opts.captures)) {
    return { captures: opts.captures.slice(), source_success: 0, source_failed: 0, reasons: [] };
  }
  const BC = require('../collectors/base-collector.cjs');
  const sources = (Array.isArray(opts.sources) && opts.sources.length)
    ? opts.sources : M.DEFAULT_CAPTURE_SOURCES.slice();
  const o = { date: opts.date, now: opts.now };
  /* 注入取数通道（测试 / 离线）；未注入 → 真实 http-transport（live，需人工触发） */
  if (typeof opts.transport === 'function') {
    o.httpTransport = { transport: opts.transport, summary: function () { return {}; } };
  }
  let success = 0, failed = 0;
  const reasons = [];
  const captures = [];
  for (let i = 0; i < sources.length; i++) {
    const sid = sources[i];
    try {
      const r = await BC.collectLive(sid, o);
      if (r.captures && r.captures.length) captures.push.apply(captures, r.captures);
      if (r.errors && r.errors.length) { failed++; reasons.push({ source: sid, errors: r.errors }); }
      else success++;
    } catch (e) {
      failed++;
      reasons.push({ source: sid, errors: [{ code: e.code || 'ERROR', message: e.message }] });
    }
  }
  return { captures: captures, source_success: success, source_failed: failed, reasons: reasons };
}

/* ---------------- 阶段 2：候选（L1） ---------------- */

function loadDefaultCandidates() {
  const f = path.join(__dirname, '..', 'ai-normalizer', 'output', '20260923.json');
  const doc = JSON.parse(fs.readFileSync(f, 'utf8'));
  return doc.candidates || [];
}

function reviewStage(opts) {
  if (Array.isArray(opts.candidates)) return opts.candidates.slice();
  return loadDefaultCandidates();
}

/* ---------------- 阶段 3：人工审核决策（保留闸门语义） ---------------- */

/**
 * 应用人工审核决策（approve / reject）。
 *   - reject 必须附 reason（review-actions 已 fail closed）；
 *   - 不自动 approve、不修改状态字段、不碰 DeliveryItem；
 *   - 目标候选找不到 → 计入 anomaly，不中断批。
 */
function applyDecisions(candidates, decisions, operator, now) {
  const byId = {};
  candidates.forEach(function (c) { byId[c.candidate_id] = c; });
  const approved = [], rejected = [], anomalies = [];
  (Array.isArray(decisions) ? decisions : []).forEach(function (d, i) {
    const c = byId[d.candidate_id];
    if (!c) { anomalies.push({ candidate_id: d.candidate_id, reason: 'DECISION_TARGET_NOT_FOUND' }); return; }
    try {
      const r = RA.applyDecision(c, {
        action: d.action,
        reason: d.reason,
        operator: operator || 'manual-reviewer',
        now: now,
        reviewSeq: i + 1
      });
      if (d.action === 'approve') approved.push(r.candidate);
      else if (d.action === 'reject') rejected.push(r.candidate);
      else anomalies.push({ candidate_id: d.candidate_id, reason: 'UNKNOWN_ACTION:' + String(d.action) });
    } catch (e) {
      anomalies.push({ candidate_id: d.candidate_id, code: e.code, message: e.message });
    }
  });
  return { approved: approved, rejected: rejected, anomalies: anomalies };
}

/* ---------------- 主入口 ---------------- */

/**
 * @param {object} opts {
 *   mode, persist(bool), sources?, captures?, candidates?, decisions?,
 *   transport?(fn), operator?, date, now,
 *   dirs: { captures, candidates, deliveries, runHistory, scratch }
 * }
 * @returns {Promise<object>} { mode, persist, isDryRun, runHistoryRecorded,
 *   runId, metrics(15+), persisted, artifacts }
 */
async function runPipeline(opts) {
  opts = opts || {};
  const mode = M.validateMode(opts.mode);
  const persist = !!opts.persist;
  M.checkPersistConflict(mode, persist);          /* dry-run + --persist → 抛 PARAM_CONFLICT */
  const isDry = M.isDryRun(mode);
  const now = opts.now || nowIso();
  const start = now;
  const dirs = opts.dirs || {};

  const metrics = {
    mode: mode, persist: persist,
    run_id: null,
    start_time: start, end_time: null,
    source_success: 0, source_failed: 0,
    rawcapture_count: 0, capture_count: 0, candidate_count: 0,
    ai_normalized_count: 0,
    approved_count: 0, rejected_count: 0,
    delivery_count: 0, actual_writes: 0,        /* N1 恒为 0：preview 不写 news.js */
    skipped_count: 0, event_count: 0, anomaly_count: 0,
    source_fail_reasons: [],
    ai_processed_count: 0,                     /* N1.2 P1-B：AI 分析成功条数 */
    analyze_fail_reasons: []                    /* N1.2 P1-B：ANALYZE 阶段失败原因 */
  };
  const result = {
    mode: mode, persist: persist, isDryRun: isDry,
    runHistoryRecorded: false, runId: null,
    metrics: metrics, persisted: {}, artifacts: {}
  };

  /* production 模式：提前分配唯一 run_id（run-history 与 deliveries 预览文件名共用） */
  let runId = null;
  if (!isDry) runId = RH.nextRunId({ dir: dirs.runHistory, date: opts.date });

  /* N1.2 P1-A · 状态追踪层接线：仅当显式配置 dirs.status 且非 dry-run 时启用。
   * test-d1d2 等测试不传 dirs.status → 状态层完全关闭，不影响既有测试。 */
  const statusDir = (dirs && dirs.status) ? dirs.status : null;
  const statusEnabled = !!statusDir && !isDry;
  let itemStore = null, runStore = null;
  if (statusEnabled) {
    itemStore = SM.createItemStore({ dir: statusDir, date: opts.date });
    runStore = SM.createRunStore({ dir: statusDir, runId: runId, mode: mode, start_time: start });
  }

  /* ---- 采集阶段（dry-run / dry-run-full / production-capture 都跑，用于预览/落盘） ---- */
  if (mode === 'dry-run' || mode === 'dry-run-full' || mode === 'production-capture') {
    const cs = await collectStage(opts);
    metrics.rawcapture_count = cs.captures.length;
    metrics.capture_count = cs.captures.length;
    metrics.source_success = cs.source_success;
    metrics.source_failed = cs.source_failed;
    metrics.source_fail_reasons = cs.reasons;
    metrics.anomaly_count = cs.reasons.length;
    result.artifacts.captures = cs.captures;
    /* P1-A 状态通知：采集完成 → FETCHED（item 级，仅 production + 已配置 status） */
    if (statusEnabled && itemStore) {
      cs.captures.forEach(function (c) {
        itemStore.mark('cap-' + (c.capture_id || '?'), 'L0', 'FETCHED',
          { by: 'collector', evidence: 'collect:' + (c.registry_id || ''), note: 'L0 captured' });
      });
      if (runStore) runStore.setStage('COLLECT', { status: 'done', count: cs.captures.length, source_success: cs.source_success, source_failed: cs.source_failed });
    }
    if (mode === 'production-capture') {
      if (persist) {
        const r = CS.appendCaptures(cs.captures, { dir: dirs.captures, date: opts.date });
        metrics.skipped_count += r.skipped;
        result.persisted.captures = r;
      } else if (dirs.scratch) {
        /* D2：可写临时 scratch，不碰正式业务归档 */
        writeJson(path.join(dirs.scratch, 'captures.json'),
          { mode: mode, count: cs.captures.length, captures: cs.captures });
      }
    }
  }

  /* ---- 审核队列阶段（dry-run-full / production-review） ---- */
  if (mode === 'dry-run-full' || mode === 'production-review') {
    const candidates = reviewStage(opts);
    metrics.candidate_count = candidates.length;
    result.artifacts.candidates = candidates;

    const hasAi = !!(opts.aiProvider && opts.aiMeta && opts.aiMeta.model);
    if (hasAi) {
      /* N1.2 P1-B · NewsAnalyzer 生产分析路径（单条失败不阻断批量） */
      const NA = require('../ai/news-analyzer.cjs');
      const DD = require('../dedup/index.cjs');
      const analyzedInputs = [];
      for (let ci = 0; ci < candidates.length; ci++) {
        const c = candidates[ci];
        const id = 'cand-' + (c.candidate_id || '?');
        try {
          const res = await NA.analyzeCandidate({
            provider: opts.aiProvider,
            candidate: c,
            meta: opts.aiMeta,
            sourceInfo: opts.sourceInfo || null,
            reportCount: opts.reportCount,
            idSpace: opts.idSpace || null,
            seq: ci + 1
          });
          if (statusEnabled && itemStore) {
            itemStore.setAnalysis(id, res.extensions);       /* 扩展字段落 status（不进 L1） */
            itemStore.mark(id, 'L1', 'AI_ANALYZED',
              { by: 'news-analyzer', evidence: 'ai:' + (res.ai_model || ''), note: 'enriched' });
          }
          metrics.ai_processed_count++;
          analyzedInputs.push({
            id: id,
            title: c.title || (res.seven && res.seven.title) || '',
            content: c.summary || (res.seven && res.seven.summary) || '',
            eventKey: c.event_key || ''
          });
        } catch (e) {
          /* 失败条目：不推进 AI_ANALYZED（维持 FETCHED），记录 fail_reasons，不吞异常 */
          metrics.analyze_fail_reasons.push({
            stage: 'ANALYZE', source: (c.candidate_id || ''),
            code: (e && e.code) || 'ERROR', message: (e && e.message) || String(e)
          });
          metrics.anomaly_count++;
        }
      }
      metrics.ai_normalized_count = metrics.ai_processed_count;
      /* N1.2 P1-B · 语义去重预筛（只标记不删除，写入 status 并行映射） */
      if (statusEnabled && itemStore && analyzedInputs.length) {
        const hints = DD.detectHints(analyzedInputs, {});
        hints.forEach(function (h) { itemStore.addDedupHint(h.id, h); });
      }
      if (runStore) runStore.setStage('ANALYZE', { status: 'done', count: metrics.ai_processed_count, failed: metrics.analyze_fail_reasons.length });
    } else {
      /* 既有路径（§5 前：AI 整理视为上游已完成，直接标记 AI_ANALYZED） */
      metrics.ai_normalized_count = candidates.length;
      if (statusEnabled && itemStore) {
        candidates.forEach(function (c) {
          itemStore.mark('cand-' + (c.candidate_id || '?'), 'L1', 'AI_ANALYZED',
            { by: 'news-analyzer', evidence: 'ai:' + (c.ai_model || ''), note: 'L1 AI analyzed' });
        });
        if (runStore) runStore.setStage('ANALYZE', { status: 'done', count: candidates.length });
      }
    }

    const q = RQ.buildQueue(candidates, { date: opts.date, generated_at: now });
    result.artifacts.reviewQueue = q.doc;
    if (persist) {
      const r = CandS.appendCandidates(candidates, { dir: dirs.candidates, date: opts.date });
      metrics.skipped_count += r.skipped;
      result.persisted.candidates = r;
    } else if (dirs.scratch) {
      writeJson(path.join(dirs.scratch, 'candidates.json'),
        { mode: mode, count: candidates.length, candidates: candidates, reviewQueue: q.doc });
    }
  }

  /* ---- 交付预览阶段（dry-run-full / production-delivery-preview，不写 news.js） ---- */
  if (mode === 'dry-run-full' || mode === 'production-delivery-preview') {
    const candidates = (Array.isArray(opts.candidates) ? opts.candidates.slice() : reviewStage(opts));
    const dec = applyDecisions(candidates, opts.decisions, opts.operator, now);
    metrics.candidate_count = candidates.length;
    metrics.approved_count = dec.approved.length;
    metrics.rejected_count = dec.rejected.length;
    metrics.anomaly_count = dec.anomalies.length;
    result.artifacts.anomalies = dec.anomalies;

    const gate = GATE.review(dec.approved, {});
    const conv = DC.toDeliveries(gate.approved, { now: now });
    metrics.delivery_count = conv.items.length;
    metrics.event_count = gate.approved.length;
    result.artifacts.deliveries = conv.items;
    result.artifacts.report = conv.report;
    /* P1-A 状态通知：Gate 通过 → VERIFIED；交付预览产出 → PUBLISHED
     * 交付预览项与 approved 候选 1:1 对应，故直接对 approved 候选标记两态（避免交付物 id 缺失导致误聚合） */
    if (statusEnabled && itemStore) {
      dec.approved.forEach(function (c) {
        const id = 'cand-' + (c.candidate_id || '?');
        itemStore.mark(id, 'L1', 'VERIFIED', { by: 'gate', evidence: 'gate:approve', note: 'verified' });
        itemStore.mark(id, 'L1', 'PUBLISHED', { by: 'delivery', evidence: 'delivery-preview', note: 'delivered' });
      });
      if (runStore) {
        runStore.setStage('VERIFY', { status: 'done', approved: dec.approved.length, rejected: dec.rejected.length });
        runStore.setStage('DELIVER', { status: 'done', count: conv.items.length });
      }
    }

    if (persist) {
      const file = path.join(dirs.deliveries, runId + '.delivery-preview.json');
      CS.assertInsidePipeline(file);                  /* 守卫：仍须在 pipeline/ 内 */
      writeJson(file, {
        schema_version: '1.0', layer: 'L3-PREVIEW', run_id: runId,
        generated_at: now, mode: mode, count: conv.items.length,
        items: conv.items, report: conv.report
      });
      result.persisted.deliveries = { file: file, run_id: runId, count: conv.items.length };
    } else if (dirs.scratch) {
      writeJson(path.join(dirs.scratch, 'delivery-preview.json'),
        { mode: mode, count: conv.items.length, items: conv.items, report: conv.report });
    }
  }

  metrics.end_time = nowIso();

  /* ---- run-history 接线（仅 production 模式；dry-run 不写） ---- */
  if (!isDry) {
    const failReasons = (metrics.source_fail_reasons || []).map(function (r) {
      const e = (r.errors && r.errors[0]) || {};
      return { stage: 'COLLECT', source: r.source || '', code: e.code || '', message: e.message || '' };
    }).concat((metrics.analyze_fail_reasons || []).map(function (r) {
      return { stage: r.stage || 'ANALYZE', source: r.source || '', code: r.code || '', message: r.message || '' };
    }));
    const entry = {
      run_id: runId,
      start_time: metrics.start_time,
      end_time: metrics.end_time,
      source_success: metrics.source_success,
      source_failed: metrics.source_failed,
      capture_count: metrics.capture_count,
      candidate_count: metrics.candidate_count,
      approved_count: metrics.approved_count,
      rejected_count: metrics.rejected_count,
      delivery_count: metrics.delivery_count,
      /* N1.2 P1-A 增强：可选扩展字段（向后兼容，不纳入 10 字段封闭集） */
      ai_processed_count: (typeof metrics.ai_processed_count === 'number' ? metrics.ai_processed_count : 0),
      fail_reasons: failReasons
    };
    RH.record(entry, { dir: dirs.runHistory });     /* 10 必填 + 可选扩展、append-only、原子写 */
    result.runId = runId;
    result.runHistoryRecorded = true;
    metrics.run_id = runId;

    /* P1-A 状态层落盘（production + 已配置 status 时） */
    if (statusEnabled) {
      if (itemStore) itemStore.persist();
      if (runStore) { runStore.finalize(); runStore.persist(); }
    }
  }

  return result;
}

module.exports = {
  runPipeline: runPipeline,
  collectStage: collectStage,
  reviewStage: reviewStage,
  applyDecisions: applyDecisions
};
