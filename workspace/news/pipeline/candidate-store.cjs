/* ============================================================
 * candidate 归档（candidate store）—— G5.4 新增
 * ------------------------------------------------------------
 * 用途：把 L1 CandidateItem **追加落盘**到 pipeline\candidates\，
 *       并保证「同源重复内容不重复生成有效候选」：
 *
 *   1. **去重键 = registry_id + content_hash**（★ 内容级幂等）
 *      —— capture_id 含 run_id 与序号，跨批次必然不同，
 *         不能作为内容身份；content_hash = sha1(source_url|title_raw|
 *         published_at) 与抓取时间无关，跨批稳定（T9.2 验证对象）。
 *   2. 同去重键且**语义内容一致** → skipped（幂等，沿用首条 candidate_id）；
 *      语义内容 = title / summary / category / related_* / publish_time
 *      —— ★ 刻意**不比较整对象**：候选的 fetched_at / capture_refs /
 *         candidate_id（含序号）跨批必变，整对象比较会把每次重跑
 *         都误判成冲突。这与 capture-store 的「整条逐字节比较」不同：
 *         capture 是**原始证据**（抓取时间不同=证据不同批，判 conflict），
 *         候选是**整理结果**（语义不变=同一候选）。
 *   3. 同去重键但语义内容不同 → conflict：保留原始候选、不覆盖。
 *   4. 原子写（.tmp → rename）；写入位置严格限制在 pipeline\ 内。
 *
 * ★ 三条硬禁止（对齐 pipeline\README.txt）：
 *   1. 不生成 / 不承载 verification_status 等状态字段（写入前深扫）；
 *   2. 不进入 33 字段交付物（本文件物理上位于 pipeline\ 内）；
 *   3. 不产出交付物 id（news-YYYY-MM-DD-NNN）。
 * ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');

const CS = require('./capture-store.cjs');        /* 复用写入位置守卫 */

const DEFAULT_DIR = path.join(CS.PIPELINE_DIR, 'candidates');

/* 语义内容比较字段：这些一致 → 视为同一候选（skipped） */
const SEMANTIC_FIELDS = Object.freeze([
  'title', 'summary', 'category',
  'related_movies', 'related_series', 'related_characters', 'related_phases',
  'publish_time'
]);

/* L1 一律禁止的状态字段（与 candidate-item.cjs 保持同源口径） */
const FORBIDDEN_KEYS = Object.freeze([
  'verification_status', 'status_history', 'status_changed_at',
  'judged_by', 'chain_steps_hit', 'status_change_reason',
  'status_change_evidence_url', 'conflict_resolved_at',
  'conflict_resolved_by_evidence_url',
  'id', 'independent_group_count',
  'supersedes_id', 'superseded_by_id',
  'official_source', 'official_source_url'
]);

function fail(code, message) {
  const e = new Error('[' + code + '] ' + message);
  e.code = code;
  throw e;
}

/** 候选去重键：registry_id + content_hash */
function dedupKeyOf(candidate) {
  if (!candidate || typeof candidate !== 'object') {
    fail('CANDIDATE_INVALID', '候选不是对象');
  }
  const rid = String(candidate.registry_id == null ? '' : candidate.registry_id).trim();
  const ch = String(candidate.content_hash == null ? '' : candidate.content_hash).trim();
  if (!rid || !ch) fail('CANDIDATE_INVALID',
    '候选缺 registry_id 或 content_hash（去重键不完整）：' + String(candidate.candidate_id || '?'));
  return rid + '|' + ch;
}

/** 语义内容指纹（用于 skipped / conflict 判定） */
function semanticSigOf(candidate) {
  return SEMANTIC_FIELDS.map(function (k) {
    return JSON.stringify(candidate[k] == null ? null : candidate[k]);
  }).join('\u0001');
}

/** 写入前深扫：候选内不得出现禁止字段 */
function assertCleanCandidate(candidate) {
  const hits = [];
  (function walk(n, p) {
    if (n == null || typeof n !== 'object') return;
    if (Array.isArray(n)) { n.forEach(function (x, i) { walk(x, p + '[' + i + ']'); }); return; }
    Object.keys(n).forEach(function (k) {
      if (FORBIDDEN_KEYS.indexOf(k) >= 0) hits.push((p ? p + '.' : '') + k);
      walk(n[k], p ? p + '.' + k : k);
    });
  })(candidate, '');
  if (hits.length) fail('FORBIDDEN_FIELD', '候选含禁止字段：' + hits.join(', '));
  return true;
}

function dayFrom(opts) {
  if (opts && opts.date) return String(opts.date);
  return new Date().toISOString().slice(0, 10);
}

function archivePath(opts) {
  const dir = (opts && opts.dir) ? String(opts.dir) : DEFAULT_DIR;
  return path.join(dir, dayFrom(opts) + '.json');
}

/** 读取候选归档；不存在 → {exists:false, candidates:[]} */
function readArchive(opts) {
  const file = CS.assertInsidePipeline(archivePath(opts));
  if (!fs.existsSync(file)) return { file: file, exists: false, candidates: [] };
  let doc;
  try {
    doc = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    fail('ARCHIVE_CORRUPT', '候选归档无法解析，拒绝覆盖：' + file);
  }
  if (!doc || !Array.isArray(doc.candidates)) {
    fail('ARCHIVE_MALFORMED', '候选归档结构非法（缺 candidates 数组）：' + file);
  }
  return { file: file, exists: true, candidates: doc.candidates };
}

/**
 * 追加保存候选（按 registry_id+content_hash 去重，绝不覆盖历史）。
 * @param {Array} candidates L1 候选数组（35 字段）
 * @param {object} opts { dir, date }
 * @returns {{file, existed, added, skipped, conflicts, total}}
 */
function appendCandidates(candidates, opts) {
  const list = Array.isArray(candidates) ? candidates : [];
  list.forEach(assertCleanCandidate);

  const arc = readArchive(opts);
  const file = arc.file;
  const index = Object.create(null);           /* dedup_key → candidate */
  arc.candidates.forEach(function (c) {
    const k = dedupKeyOf(c);
    if (!index[k]) index[k] = c;
  });

  const merged = arc.candidates.slice();
  const added = [], skipped = [], conflicts = [];

  list.forEach(function (c) {
    const k = dedupKeyOf(c);
    const exist = index[k];
    if (!exist) {
      merged.push(c); index[k] = c; added.push(String(c.candidate_id)); return;
    }
    if (semanticSigOf(exist) === semanticSigOf(c)) {
      skipped.push(String(c.candidate_id || k)); return;    /* 幂等：语义一致 */
    }
    /* 同键不同语义：保留原始候选，不覆盖 */
    conflicts.push({
      dedup_key: k,
      kept_candidate_id: exist.candidate_id,
      incoming_candidate_id: c.candidate_id,
      reason: '同 registry_id+content_hash 但语义内容不同 → 保留原始候选，未覆盖'
    });
  });

  if (added.length || !arc.exists) {
    const dir = path.dirname(file);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const doc = {
      schema_version: '1.0',
      layer: 'L1',
      updated_at: new Date().toISOString(),
      count: merged.length,
      dedup_key: 'registry_id + content_hash',
      note: '候选归档：按 registry_id+content_hash 去重；语义一致幂等跳过；同键异义保留原始',
      candidates: merged
    };
    const tmp = file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(doc, null, 2), 'utf8');
    fs.renameSync(tmp, file);
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

/** 读取全部候选（可按 registry_id / dedup 键过滤） */
function loadCandidates(opts) {
  const arc = readArchive(opts);
  let out = arc.candidates;
  if (opts && opts.registry_id) {
    out = out.filter(function (c) { return c.registry_id === opts.registry_id; });
  }
  return out;
}

module.exports = {
  DEFAULT_DIR,
  SEMANTIC_FIELDS,
  FORBIDDEN_KEYS,
  dedupKeyOf,
  semanticSigOf,
  assertCleanCandidate,
  archivePath,
  readArchive,
  appendCandidates,
  loadCandidates
};
