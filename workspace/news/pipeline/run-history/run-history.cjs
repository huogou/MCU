/* ============================================================
 * 运行记录模块（G10）· run-history
 * ------------------------------------------------------------
 * 定位：**纯追加记录层**——记录每一次生产运行的统计快照。
 * ★ 零接线（结构保证「三不影响」）：
 *   · 不接入采集器 / Gate / 转换器 / 判定器 —— 不影响 judge；
 *   · 不产出 DeliveryItem —— 不进交付；
 *   · 不写生产数据文件（h5 数据层）—— 现有数据结构与内容零改动。
 *
 * 记录字段（任务书 §1，**恰 10 个**，封闭集）：
 *   run_id / start_time / end_time /
 *   source_success / source_failed /
 *   capture_count / candidate_count /
 *   approved_count / rejected_count / delivery_count
 *
 * 硬规则：
 *   1. append-only：历史记录绝不覆盖（run_id 重复 → RUN_ID_DUP 抛错）；
 *   2. 原子写（.tmp → rename）+ 写入位置守卫（复用 capture-store，
 *      拒绝 pipeline 外与 h5/wechat/douyin）；
 *   3. run_id 格式 run-YYYYMMDD-NNN（当日序号，nextRunId 分配）。
 * ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');
const CS = require('../capture-store.cjs');        /* 复用写入位置守卫 */

const LAYER = 'RUN-HISTORY';
const SCHEMA_VERSION = '1.0';
const DEFAULT_DIR = path.join(CS.PIPELINE_DIR, 'run-history');

const FIELDS = Object.freeze([
  'run_id', 'start_time', 'end_time',
  'source_success', 'source_failed',
  'capture_count', 'candidate_count',
  'approved_count', 'rejected_count', 'delivery_count'
]);

/* N1.2 P1-A 增强：可选扩展字段（向后兼容，不纳入 FIELDS 封闭集，
 * 因此既有「恰 10 字段」断言与 411 条回归不受影响）。
 *   ai_processed_count : 本次 AI 处理（AI_ANALYZED）条目数
 *   fail_reasons       : 各阶段失败原因数组 [{stage, source, code, message}] */
const OPTIONAL_FIELDS = Object.freeze(['ai_processed_count', 'fail_reasons']);
const ALLOWED_FIELDS = Object.freeze(FIELDS.concat(OPTIONAL_FIELDS));

const RUN_ID_RE = /^run-\d{8}-\d{3}$/;
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;

function fail(code, message) {
  const e = new Error('[' + code + '] ' + message);
  e.code = code;
  throw e;
}

function historyPath(opts) {
  const dir = (opts && opts.dir) ? String(opts.dir) : DEFAULT_DIR;
  return CS.assertInsidePipeline(path.join(dir, 'run-history.json'));
}

/** 读取运行历史；不存在 → 空文档 */
function load(opts) {
  const file = historyPath(opts);
  if (!fs.existsSync(file)) return { file: file, schema_version: SCHEMA_VERSION, count: 0, runs: [] };
  let doc;
  try { doc = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) {
    fail('HISTORY_CORRUPT', '运行历史无法解析，拒绝覆盖：' + file);
  }
  if (!doc || !Array.isArray(doc.runs)) fail('HISTORY_MALFORMED', '运行历史结构非法');
  return doc;
}

/** 分配当日下一个 run_id（读现有记录计数） */
function nextRunId(opts) {
  const doc = load(opts);
  const date = (opts && opts.date) || new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = 'run-' + date + '-';
  let max = 0;
  doc.runs.forEach(function (r) {
    if (r.run_id.indexOf(prefix) === 0) {
      const n = Number(r.run_id.slice(prefix.length));
      if (n > max) max = n;
    }
  });
  return prefix + String(max + 1).padStart(3, '0');
}

/** 校验一条记录（10 必填字段 + 可选扩展字段；run_id / 时间 ISO / 计数非负整数）
 *  - 历史 10 字段记录：通过（向后兼容，不写扩展字段也合法）
 *  - 新记录：可含 ai_processed_count / fail_reasons（仍受 ALLOWED_FIELDS 管控）
 *  - 任何 10 字段 / 可选字段之外的越权字段 → FIELD_SET_MISMATCH（守住封闭集） */
function validate(entry) {
  if (!entry || typeof entry !== 'object') fail('ENTRY_INVALID', '运行记录不是对象');
  const keys = Object.keys(entry);
  /* 1) 必填 10 字段缺一不可（缺字段 → FIELD_SET_MISMATCH，兼容 T1.4） */
  const missing = FIELDS.filter(function (f) { return !(f in entry); });
  if (missing.length) {
    fail('FIELD_SET_MISMATCH', '运行记录缺必填字段：' + missing.join(','));
  }
  /* 2) 不得出现 10 必填 + 可选扩展 之外的越权字段（兼容 T1.5：note → 拒绝） */
  const unknown = keys.filter(function (k) { return ALLOWED_FIELDS.indexOf(k) < 0; });
  if (unknown.length) {
    fail('FIELD_SET_MISMATCH', '运行记录含越权字段（非 10 必填/可选扩展）：' + unknown.join(','));
  }
  if (!RUN_ID_RE.test(String(entry.run_id))) fail('BAD_RUN_ID', 'run_id 形态非法：' + entry.run_id);
  [entry.start_time, entry.end_time].forEach(function (t) {
    if (!ISO_RE.test(String(t))) fail('BAD_TIME', '时间非 ISO8601(Z)：' + t);
  });
  ['source_success', 'source_failed', 'capture_count', 'candidate_count',
    'approved_count', 'rejected_count', 'delivery_count'].forEach(function (k) {
      if (!Number.isInteger(entry[k]) || entry[k] < 0) {
        fail('BAD_COUNT', k + ' 须为非负整数：' + entry[k]);
      }
    });
  /* 3) 可选扩展字段软校验（存在时才校验） */
  if ('ai_processed_count' in entry) {
    if (!Number.isInteger(entry.ai_processed_count) || entry.ai_processed_count < 0) {
      fail('BAD_COUNT', 'ai_processed_count 须为非负整数：' + entry.ai_processed_count);
    }
  }
  if ('fail_reasons' in entry) {
    if (!Array.isArray(entry.fail_reasons)) {
      fail('BAD_TYPE', 'fail_reasons 须为数组');
    }
  }
  return true;
}

/**
 * 追加一条运行记录（append-only，原子写）。
 * @param {object} entry 恰 10 字段
 * @param {object} opts  { dir, date }
 * @returns {{file, count, run_id}}
 */
function record(entry, opts) {
  validate(entry);
  const doc = load(opts);
  if (doc.runs.some(function (r) { return r.run_id === entry.run_id; })) {
    fail('RUN_ID_DUP', 'run_id 已存在（append-only，禁止覆盖）：' + entry.run_id);
  }
  doc.schema_version = SCHEMA_VERSION;
  doc.layer = LAYER;
  doc.updated_at = new Date().toISOString();
  doc.count = doc.runs.length + 1;
  doc.runs.push(entry);
  doc.note = '运行历史：只追加、不覆盖；零接线记录层（不影响 judge / DeliveryItem / 生产数据文件）';

  const file = historyPath(opts);
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(doc, null, 2), 'utf8');
  fs.renameSync(tmp, file);
  return { file: file, count: doc.count, run_id: entry.run_id };
}

module.exports = { LAYER, SCHEMA_VERSION, FIELDS, OPTIONAL_FIELDS, ALLOWED_FIELDS, DEFAULT_DIR, load, nextRunId, validate, record };
