/* ============================================================
 * N1.2 · failure record / failure table（S004 B 方案）
 * ------------------------------------------------------------
 * 定位：轻量失败记录能力（结构化、append-only JSON）。
 *
 * 设计约束（S004 正式拍板 + 冻结边界）：
 *   - 单源失败不阻断整批（失败记录不影响采集的 fail-closed 行为）；
 *   - 失败必须留下结构化记录（run_id / source_id / stage / error_code /
 *     error_type / reason / timestamp / mode）；
 *   - 不进行自动重试；不因为失败自动降级为成功；
 *   - 不进入正式资讯数据；不污染 news.js；不改变现有 run-history。
 *   - S003=403 与 S005=ECONNREFUSED 当前继续保持 source_failed（由 base-collector 负责），
 *     本模块仅在其之外追加一份可排查的 failure record。
 * ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');

const FIELDS = Object.freeze([
  'run_id', 'source_id', 'stage', 'error_code', 'error_type', 'reason', 'timestamp', 'mode'
]);

function nowIso() { return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'); }
function fail(code, message) {
  const e = new Error('[' + code + '] ' + message);
  e.code = code;
  throw e;
}

/** 构造一条结构化 failure 记录（必填校验，不静默） */
function makeEntry(e) {
  const o = e || {};
  const entry = {
    run_id: String(o.run_id != null ? o.run_id : ''),
    source_id: String(o.source_id != null ? o.source_id : ''),
    stage: String(o.stage != null ? o.stage : ''),
    error_code: String(o.error_code != null ? o.error_code : ''),
    error_type: String(o.error_type != null ? o.error_type : ''),
    reason: String(o.reason != null ? o.reason : ''),
    timestamp: o.timestamp ? String(o.timestamp) : nowIso(),
    mode: String(o.mode != null ? o.mode : 'capture-only')
  };
  ['run_id', 'source_id', 'stage', 'error_code'].forEach(function (k) {
    if (!entry[k]) fail('FAILURE_RECORD_INVALID', 'failure record 缺必填字段：' + k);
  });
  return entry;
}

function defaultDir(opts) {
  if (opts && opts.dir) return opts.dir;
  return path.join(__dirname, 'records');   /* 默认 pipeline/failures/records/ */
}

/**
 * 记录一条失败（append-only JSON）。
 * @param {object} entry 原始失败信息
 * @param {object} opts { dir, date }
 * @returns {{file:string, entry:object, total:number}}
 */
function recordFailure(entry, opts) {
  const e = makeEntry(entry);
  const dir = defaultDir(opts);
  const date = (opts && opts.date) || e.timestamp.slice(0, 10).replace(/-/g, '');
  const file = path.join(dir, date + '.failures.json');
  fs.mkdirSync(dir, { recursive: true });
  let arr = [];
  if (fs.existsSync(file)) {
    try { arr = JSON.parse(fs.readFileSync(file, 'utf8')); if (!Array.isArray(arr)) arr = []; } catch (err) { arr = []; }
  }
  arr.push(e);
  fs.writeFileSync(file, JSON.stringify(arr, null, 2), 'utf8');
  return { file: file, entry: e, total: arr.length };
}

/**
 * 从采集结果（base-collector.collect 的 result.errors）批量记录。
 * @param {string} runId
 * @param {object} result base-collector.collect 返回（含 errors[]）
 * @param {string} mode 运行模式
 * @param {object} opts { dir, date }
 * @returns {Array} 已记录 entry 列表
 */
function recordFromCollectErrors(runId, result, mode, opts) {
  const errors = (result && result.errors) || [];
  const out = [];
  errors.forEach(function (er) {
    try {
      const r = recordFailure({
        run_id: runId,
        source_id: (result && result.registry_id) || 'unknown',
        stage: er.stage || 'unknown',
        error_code: er.code || 'ERROR',
        error_type: er.stage || 'unknown',
        reason: er.message || '',
        mode: mode || 'capture-only'
      }, opts);
      out.push(r.entry);
    } catch (e) { /* 单条失败不影响其它（fail-closed） */ }
  });
  return out;
}

module.exports = { recordFailure, recordFromCollectErrors, FIELDS, DEFAULT_DISABLED: true };
