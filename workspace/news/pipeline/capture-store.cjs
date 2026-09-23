/* ============================================================
 * capture 归档（capture store）
 * ------------------------------------------------------------
 * 用途：把 L0 RawCapture **追加落盘**，并保证：
 *   1. **重复采集不会覆盖历史 capture**（同 capture_id 且内容不同 →
 *      保留原始记录、计入 conflicts、绝不覆盖）；
 *   2. 幂等：同 capture_id 且内容完全一致 → 跳过（skipped）；
 *   3. 原子写：先写 .tmp 再 rename，避免半截文件；
 *   4. 写入位置**严格限制在 pipeline\ 目录内** —— 不得写入
 *      h5\ / wechat\ / douyin\。
 *
 * ★ 证据可追溯：capture 一经落盘即不可被后续批次改写，
 *   L1 的 `capture_refs` 永远能指回「当时那条原始证据」。
 *
 * 性质：本模块**会写文件**（这是它的职责），但只写 pipeline\ 内；
 *       零网络。测试使用临时目录并在结束时清理。
 * ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');

const PIPELINE_DIR = __dirname;
const DEFAULT_DIR = path.join(__dirname, 'captures');

function fail(code, message) {
  const e = new Error('[' + code + '] ' + message);
  e.code = code;
  throw e;
}

function todayFrom(opts) {
  if (opts && opts.date) return String(opts.date);
  return new Date().toISOString().slice(0, 10);
}

function archivePath(opts) {
  const dir = (opts && opts.dir) ? String(opts.dir) : DEFAULT_DIR;
  return path.join(dir, todayFrom(opts) + '.captures.json');
}

/** ★ 写入位置守卫：必须落在 pipeline\ 内 */
function assertInsidePipeline(filePath) {
  const abs = path.resolve(filePath);
  const base = path.resolve(PIPELINE_DIR) + path.sep;
  if (abs.indexOf(base) !== 0) {
    fail('WRITE_OUTSIDE_PIPELINE', '拒绝写入 pipeline 之外的路径：' + abs);
  }
  ['h5', 'wechat', 'douyin'].forEach(function (d) {
    if (abs.indexOf(path.sep + d + path.sep) >= 0) {
      fail('WRITE_FORBIDDEN_DIR', '拒绝写入受保护目录：' + abs);
    }
  });
  return abs;
}

/** 读取归档；不存在 → {exists:false, captures:[]} */
function readArchive(opts) {
  const file = assertInsidePipeline(archivePath(opts));
  if (!fs.existsSync(file)) return { file: file, exists: false, captures: [], version: null };
  let doc;
  try {
    doc = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    /* ★ 归档损坏时**绝不覆盖**，直接报错交人工处理 */
    fail('ARCHIVE_CORRUPT', '归档文件无法解析，拒绝覆盖：' + file);
  }
  if (!doc || !Array.isArray(doc.captures)) {
    fail('ARCHIVE_MALFORMED', '归档结构非法（缺 captures 数组）：' + file);
  }
  return { file: file, exists: true, captures: doc.captures, version: doc.schema_version || null };
}

/**
 * 追加保存 captures（并集，绝不覆盖历史）。
 * @returns {{file, existed, added, skipped, conflicts, total}}
 */
function appendCaptures(captures, opts) {
  const list = Array.isArray(captures) ? captures : [];
  list.forEach(function (c) {
    const v = require('./raw-capture.cjs').validate(c);
    if (!v.pass) fail('CAPTURE_INVALID', '落盘前发现非法 L0：' + JSON.stringify(v.issues.slice(0, 2)));
  });

  const arc = readArchive(opts);
  const file = arc.file;
  const index = Object.create(null);
  arc.captures.forEach(function (c) { index[c.capture_id] = c; });

  const merged = arc.captures.slice();
  const added = [];
  const skipped = [];
  const conflicts = [];

  list.forEach(function (c) {
    const exist = index[c.capture_id];
    if (!exist) {
      merged.push(c); index[c.capture_id] = c; added.push(c.capture_id); return;
    }
    if (JSON.stringify(exist) === JSON.stringify(c)) { skipped.push(c.capture_id); return; }
    /* ★ 同 id 不同内容：保留原记录，不覆盖 */
    conflicts.push({
      capture_id: c.capture_id,
      reason: '同 capture_id 但内容不同 → 保留原始记录，未覆盖',
      existing_pipeline_run_id: exist.pipeline_run_id,
      incoming_pipeline_run_id: c.pipeline_run_id
    });
  });

  if (added.length || !arc.exists) {
    const dir = path.dirname(file);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const doc = {
      schema_version: '1.1',
      layer: 'L0',
      updated_at: new Date().toISOString(),
      count: merged.length,
      note: 'capture 归档：只追加、不覆盖；同 capture_id 不同内容一律保留原始记录',
      captures: merged
    };
    const tmp = file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(doc, null, 2), 'utf8');
    fs.renameSync(tmp, file);          /* 原子替换（临时文件在 pipeline 内） */
  }

  return {
    file: file,
    existed: arc.exists,
    added: added.length,
    skipped: skipped.length,
    conflicts: conflicts,
    total: merged.length
  };
}

/** 读取全部 capture（可按 registry_id / run 过滤） */
function loadCaptures(opts) {
  const arc = readArchive(opts);
  let out = arc.captures;
  if (opts && opts.pipeline_run_id) out = out.filter(function (c) { return c.pipeline_run_id === opts.pipeline_run_id; });
  if (opts && opts.registry_id) out = out.filter(function (c) { return c.registry_id === opts.registry_id; });
  return out;
}

/** 按 capture_id 取单条（L1 的 capture_refs 取证入口） */
function findById(captureId, opts) {
  const list = loadCaptures(opts);
  return list.filter(function (c) { return c.capture_id === captureId; })[0] || null;
}

module.exports = {
  PIPELINE_DIR,
  DEFAULT_DIR,
  archivePath,
  assertInsidePipeline,
  readArchive,
  appendCaptures,
  loadCaptures,
  findById
};
