/* ============================================================
 * N1.2 P1-C · 生产调度入口（S002 升级为可执行安全调度器）
 * ------------------------------------------------------------
 * 安全护栏（强制，不可被配置绕过）：
 *   - DEFAULT_DISABLED = true：默认关闭，绝不自动触发任何生产；
 *   - autoProduction 恒为 false：调度器不自动进入 production；
 *   - production 需显式 productionAllowed=true（默认 false）且 execute=true 才运行；
 *   - disabled / plan-only 时 run() 只返回计划，绝不执行、绝不碰业务归档 / news.js。
 *
 * 职责边界（不复制 pipeline 逻辑）：
 *   - 调度器只编排 runPipeline（既有的 collect→review/AI/dedup→delivery-preview）；
 *   - AI / dedup / merge / Gate / Delivery 均由 orchestrator 内既有冻结/已验收模块完成；
 *   - dry-run 走 dry-run-full 模式：全链路模拟、无 run-history、无状态落盘、不碰业务归档；
 *   - production 走 production-* 模式序列，强制写 run-history 与（可选）正式归档。
 *
 * 幂等与并发：
 *   - 每次执行生成唯一 exec_id（dry-run）/ 由 run-history 分配 run_id（production）；
 *   - production 受独占锁 .scheduler-prod.lock 保护，禁止并发；
 *   - 同一日期已产出则短路（.scheduler-last-production.json），重复触发不产生重复归档。
 * ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');

const { runPipeline } = require('./orchestrator.cjs');
const M = require('./run-modes.cjs');
const RH = require('../run-history/run-history.cjs');

const DEFAULT_DISABLED = true;
const PROD_LOCK_FILE = path.join(__dirname, '.scheduler-prod.lock');
const PROD_LAST_RUN = path.join(__dirname, '.scheduler-last-production.json');
const LOCK_TTL_MS = 6 * 60 * 60 * 1000; /* 6h 锁过期兜底 */

function nowIso() { return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'); }
function genExecId() {
  return 'sched-' + nowIso().replace(/[:.]/g, '-') + '-' + process.pid + '-' + Math.random().toString(36).slice(2, 8);
}

function createScheduler(config) {
  const cfg = Object.assign(
    {
      enabled: false,
      mode: 'capture-only',        /* 调度器配置默认模式（旧契约保留；dry-run 实际走 dry-run-full 管道模式） */
      autoProduction: false,
      productionAllowed: false,
      concurrency: { lockTtlMs: LOCK_TTL_MS }
    },
    config || {}
  );
  /* 安全护栏：enabled 默认关闭；autoProduction 永不开启 */
  if (cfg.enabled !== true) cfg.enabled = false;
  cfg.autoProduction = false;

  function plan() {
    return {
      enabled: cfg.enabled === true,
      mode: cfg.mode,
      autoProduction: false,
      productionAllowed: cfg.productionAllowed === true,
      wouldExecute: false
    };
  }

  /* ---------------- 并发锁（仅 production） ---------------- */
  function readLock() {
    try {
      if (!fs.existsSync(PROD_LOCK_FILE)) return null;
      const rec = JSON.parse(fs.readFileSync(PROD_LOCK_FILE, 'utf8'));
      const age = Date.now() - (rec.startedAt || 0);
      if (age > (cfg.concurrency.lockTtlMs || LOCK_TTL_MS)) { try { fs.unlinkSync(PROD_LOCK_FILE); } catch (e) {} return null; }
      try {
        if (typeof rec.pid === 'number' && rec.pid > 0) process.kill(rec.pid, 0); /* 存活校验（best-effort） */
      } catch (e) {
        try { fs.unlinkSync(PROD_LOCK_FILE); } catch (e2) {} return null; /* 持有者已退出 → 锁失效 */
      }
      return rec;
    } catch (e) { return null; }
  }
  function writeLock(rec) {
    fs.mkdirSync(path.dirname(PROD_LOCK_FILE), { recursive: true });
    fs.writeFileSync(PROD_LOCK_FILE, JSON.stringify(rec), 'utf8');
  }
  function clearLock() { try { if (fs.existsSync(PROD_LOCK_FILE)) fs.unlinkSync(PROD_LOCK_FILE); } catch (e) {} }

  function readLastRun() {
    try { return fs.existsSync(PROD_LAST_RUN) ? JSON.parse(fs.readFileSync(PROD_LAST_RUN, 'utf8')) : null; }
    catch (e) { return null; }
  }
  function writeLastRun(rec) { fs.writeFileSync(PROD_LAST_RUN, JSON.stringify(rec), 'utf8'); }

  /* ---------------- dry-run 执行（全链路模拟，无副作用） ---------------- */
  async function triggerDryRun(opts) {
    opts = opts || {};
    const execId = genExecId();
    const dirs = opts.dirs || {};
    const runOpts = {
      mode: M.DRY_RUN_FULL,
      date: opts.date,
      now: opts.now,
      captures: Array.isArray(opts.captures) ? opts.captures : [], /* 默认空，避免触发真实采集网络 */
      candidates: opts.candidates,
      decisions: opts.decisions,
      aiProvider: opts.aiProvider || null,
      aiMeta: opts.aiMeta || null,
      sourceInfo: opts.sourceInfo || null,
      reportCount: opts.reportCount,
      idSpace: opts.idSpace || null,
      dirs: {
        captures: dirs.captures,
        candidates: dirs.candidates,
        deliveries: dirs.deliveries,
        runHistory: dirs.runHistory,
        scratch: dirs.scratch /* dry-run-full 允许写 scratch 诊断，不碰正式归档 */
      }
    };
    const result = {
      executed: true, kind: 'dry-run', execId: execId, ok: true, error: null,
      runHistoryRecorded: null, g4: null, sideEffects: false, result: null
    };
    try {
      const r = await runPipeline(runOpts);
      result.result = r;
      result.runHistoryRecorded = r.runHistoryRecorded; /* 必须为 false */
      /* G4 只读诊断（不持久化、不重排，复用既有 event-merger） */
      try {
        const CI = require('../candidate-item.cjs');
        const EM = require('../../engine/dedup/event-merger.cjs');
        const cands = (Array.isArray(opts.candidates) ? opts.candidates : (r.artifacts && r.artifacts.candidates)) || [];
        if (cands.length) {
          const merged = EM.mergeCandidates(CI.toMergerInputs(cands), { windowDays: 3 });
          result.g4 = { input: cands.length, events: merged.events ? merged.events.length : 0 };
        }
      } catch (e) {
        result.g4 = { error: String((e && e.message) || e) };
      }
    } catch (e) {
      result.ok = false;
      result.error = {
        code: (e && e.code) || 'ERROR',
        message: (e && e.message) || String(e),
        stack: (e && e.stack) ? String(e.stack).split('\n').slice(0, 3).join('\n') : ''
      };
    }
    return result;
  }

  /* ---------------- production 执行（需显式开启；带锁与幂等防护） ---------------- */
  async function triggerProduction(opts) {
    opts = opts || {};
    const execId = genExecId();
    if (cfg.productionAllowed !== true) {
      return { executed: false, skipped: true, reason: 'production not allowed (productionAllowed=false)', execId: execId };
    }
    const held = readLock();
    if (held) {
      return { executed: false, skipped: true, reason: 'concurrency lock held by ' + (held.execId || '?'), execId: execId, heldBy: held.execId };
    }
    const date = opts.date || new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const last = readLastRun();
    if (last && last.date === date && last.runId) {
      return { executed: false, skipped: true, reason: 'already produced for date ' + date + ' (run_id=' + last.runId + ')', execId: execId, priorRunId: last.runId };
    }
    writeLock({ execId: execId, pid: process.pid, startedAt: Date.now(), date: date });
    const out = { executed: true, kind: 'production', execId: execId, ok: true, error: null, stages: [], runIds: [], sideEffects: true };
    try {
      const baseDirs = opts.dirs || M.defaultDirs();
      const stages = ['production-capture', 'production-review', 'production-delivery-preview'];
      for (let i = 0; i < stages.length; i++) {
        const stageOpts = Object.assign({}, opts, {
          mode: stages[i],
          date: date,
          captures: (stages[i] === 'production-capture') ? (opts.captures || undefined) : undefined,
          candidates: (stages[i] === 'production-review') ? (opts.candidates || undefined) : undefined,
          decisions: (stages[i] === 'production-delivery-preview') ? (opts.decisions || undefined) : undefined,
          aiProvider: opts.aiProvider || null,
          aiMeta: opts.aiMeta || null,
          persist: opts.persist === true,
          dirs: baseDirs
        });
        const r = await runPipeline(stageOpts);
        out.stages.push({ stage: stages[i], runId: r.runId, runHistoryRecorded: r.runHistoryRecorded, metrics: r.metrics });
        if (r.runId) out.runIds.push(r.runId);
      }
      const lastRunId = out.runIds[out.runIds.length - 1] || null;
      writeLastRun({ date: date, execId: execId, runId: lastRunId, producedAt: nowIso() });
    } catch (e) {
      out.ok = false;
      out.error = { code: (e && e.code) || 'ERROR', message: (e && e.message) || String(e) };
    } finally {
      clearLock();
    }
    return out;
  }

  return {
    DEFAULT_DISABLED: DEFAULT_DISABLED,
    isEnabled: function () { return cfg.enabled === true; },
    getMode: function () { return cfg.mode; },
    getConfig: function () { return Object.assign({}, cfg); },
    plan: function () { return plan(); },

    /* 手动触发（旧契约保留）：仅返回计划，不执行（真实执行由 enabled 时显式调用） */
    triggerManual: function () {
      return Object.assign({ triggered: true, executed: false }, plan(), { action: 'manual-' + cfg.mode });
    },

    /* 调度执行入口（S002 安全契约保留）：
     *   - disabled → skipped（绝不执行）；
     *   - enabled 但 execute!==true → plan-only（绝不自动执行）；
     *   - execute:true + production:true → triggerProduction（需 productionAllowed）；
     *   - execute:true（非 production）→ triggerDryRun。 */
    run: function (opts) {
      opts = opts || {};
      if (cfg.enabled !== true) {
        return { skipped: true, executed: false, reason: 'scheduler disabled (DEFAULT_DISABLED=true)', plan: plan() };
      }
      if (opts.execute !== true) {
        return { skipped: true, executed: false, reason: 'plan-only (pass execute:true to run)', plan: plan() };
      }
      if (opts.production === true) return triggerProduction(opts);
      return triggerDryRun(opts);
    },

    /* 显式执行入口（CLI / 测试） */
    triggerDryRun: function (opts) { return triggerDryRun(opts); },
    triggerProduction: function (opts) { return triggerProduction(opts); },

    /* 并发/状态探针（测试用） */
    _lockState: function () { return readLock(); },
    _lastRun: function () { return readLastRun(); },
    _clearState: function () { clearLock(); try { if (fs.existsSync(PROD_LAST_RUN)) fs.unlinkSync(PROD_LAST_RUN); } catch (e) {} }
  };
}

module.exports = { createScheduler, DEFAULT_DISABLED };
