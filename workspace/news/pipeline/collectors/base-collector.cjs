/* ============================================================
 * collectors · base-collector.cjs（G5.2）
 * ------------------------------------------------------------
 * 职责（**仅此三件**，任务书第 2 节）：
 *   1. 获取来源内容
 *   2. 保存原始信息
 *   3. 生成 RawCapture（L0）
 *
 * ★ 明确不做：
 *   · 不生成 verification_status / judged_by / status_history / 任何 8 态
 *   · **不修改标题语义**（title_raw 原样）
 *   · **不合并事件**（何时归并由 L2 的 event-merger 负责）
 *   · 不进入 G6、不产出 DeliveryItem、不写 h5/
 *
 * 链路：source_registry → source-fetcher → parser → normalizer → RawCapture(L0)
 *      → （可选）capture-store 追加落盘
 * ============================================================ */
'use strict';

const path = require('path');

const RC = require('../raw-capture.cjs');
const SF = require('./source-fetcher.cjs');
const P = require('./parser.cjs');
const NM = require('./normalizer.cjs');

const COLLECTOR_VERSION = '1.0';

function makeRunId(d) {
  const s = (d ? new Date(d) : new Date()).toISOString().slice(0, 10).replace(/-/g, '');
  return 'run' + s;
}

function nowIso() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/** 深扫：输出不得含状态字段，也不得含 L0 之外的 event_key / first_publish_time */
function assertCleanOutput(obj) {
  const hits = [];
  const bad = NM.STATE_FIELDS.concat(NM.NOT_L0_FIELDS);
  (function walk(n, p) {
    if (n == null || typeof n !== 'object') return;
    if (Array.isArray(n)) { n.forEach(function (x, i) { walk(x, p + '[' + i + ']'); }); return; }
    Object.keys(n).forEach(function (k) {
      if (bad.indexOf(k) >= 0) hits.push((p ? p + '.' : '') + k);
      walk(n[k], p ? p + '.' + k : k);
    });
  })(obj, '');
  if (hits.length) {
    const e = new Error('[FORBIDDEN_FIELD] 采集输出含禁止字段：' + hits.join(', '));
    e.code = 'FORBIDDEN_FIELD';
    throw e;
  }
  return true;
}

/**
 * 采集**单个来源**。
 * @param {string} sourceId registry_id（如 'S004'）
 * @param {object} opts { run_id, fixtureDir, transport, now, http_status }
 * @returns {Promise<object>}
 */
function collect(sourceId, opts) {
  const o = opts || {};
  const runId = o.run_id || makeRunId();
  const fetchedAt = o.now || nowIso();

  const result = {
    collector_version: COLLECTOR_VERSION,
    registry_id: sourceId,
    run_id: runId,
    source: null,
    gate: null,
    fetch: null,
    parse: null,
    captures: [],
    errors: [],
    stats: { parsed_items: 0, accepted: 0, rejected: 0, records_saved: 0 }
  };

  /* 1) 读登记表（未登记 → UNKNOWN_REGISTRY_ID） */
  let source;
  try {
    source = SF.getSource(sourceId);
  } catch (e) {
    result.errors.push({ stage: 'registry', code: e.code || 'ERROR', message: e.message });
    result.stats.rejected++;
    return Promise.resolve(result);
  }
  result.source = source;

  /* 2) 合规守卫 */
  const gate = SF.isCollectable(source);
  result.gate = gate;
  if (!gate.ok && !o.allowDisabled) {
    result.errors.push({ stage: 'gate', code: gate.code, message: gate.message });
    return Promise.resolve(result);
  }

  /* 3) 取内容 → 4) 解析 → 5) 归一化 → 6) 生成 RawCapture
   * ★ 关键：fetchContent 可能**同步抛错**（如本地夹具缺失）→ 必须 try 住，
   *   否则 collect() 会直接抛出，导致 collectAll() 整批中断
   *   （违反「单源失败不得中断批量」的 fail closed 原则）。 */
  let fetchPromise;
  try {
    fetchPromise = SF.fetchContent(source, o);
  } catch (e) {
    result.errors.push({ stage: 'fetch', code: e.code || 'ERROR', message: e.message });
    return Promise.resolve(result);
  }
  return fetchPromise.then(function (res) {
    result.fetch = { status: res.status, url: res.url, transport: res.transport, bytes: res.body.length };
    const parsed = P.parse(res.body, source.feed_type);
    result.parse = {
      ok: parsed.ok, code: parsed.code || '', message: parsed.message || '',
      count: (parsed.items || []).length, diagnostic: parsed.diagnostic || null
    };
    if (!parsed.ok) {
      result.errors.push({ stage: 'parse', code: parsed.code, message: parsed.message });
      return result;
    }
    result.stats.parsed_items = parsed.items.length;

    parsed.items.forEach(function (item, i) {
      try {
        const input = NM.toCaptureInput(item, source, {
          run_id: runId, seq: i + 1, fetched_at: fetchedAt,
          http_status: (o.http_status != null ? o.http_status : res.status)
        });
        const capture = RC.create(input);
        const v = RC.validate(capture);
        if (!v.pass) {
          result.errors.push({ stage: 'validate', index: i, code: 'CAPTURE_INVALID', message: JSON.stringify(v.issues) });
          result.stats.rejected++;
          return;
        }
        result.captures.push(capture);
        result.stats.accepted++;
      } catch (e) {
        /* ★ fail closed：单条失败不影响其他条；**不静默**，逐条记录 */
        result.errors.push({
          stage: 'normalize', index: i, title: item && item.title_raw,
          code: e.code || 'ERROR', message: e.message
        });
        result.stats.rejected++;
      }
    });

    assertCleanOutput(result);
    return result;
  }, function (e) {
    result.errors.push({ stage: 'fetch', code: e.code || 'ERROR', message: e.message });
    return result;
  });
}

/**
 * 采集并**追加落盘**（保存原始信息）。
 * @param {string} sourceId
 * @param {object} opts { ..., storeDir, storeDate }
 */
function collectAndStore(sourceId, opts) {
  const o = opts || {};
  return collect(sourceId, o).then(function (res) {
    if (!res.captures.length) return res;
    const CS = require('../capture-store.cjs');
    const sres = CS.appendCaptures(res.captures, { dir: o.storeDir, date: o.storeDate });
    res.store = { file: sres.file, added: sres.added, skipped: sres.skipped, conflicts: sres.conflicts, total: sres.total };
    res.stats.records_saved = sres.added + sres.skipped;
    return res;
  });
}

/** 采集全部**可采集**来源（顺序执行，互不影响） */
function collectAll(opts) {
  const list = SF.listSources({ collectableOnly: true });
  const out = [];
  return list.reduce(function (chain, s) {
    return chain.then(function () {
      return collect(s.registry_id, opts).then(function (r) { out.push(r); });
    });
  }, Promise.resolve()).then(function () {
    return {
      collector_version: COLLECTOR_VERSION,
      sources: out.map(function (r) { return r.registry_id; }),
      results: out,
      totals: {
        sources_tried: out.length,
        accepted: out.reduce(function (n, r) { return n + r.stats.accepted; }, 0),
        rejected: out.reduce(function (n, r) { return n + r.stats.rejected; }, 0),
        errors: out.reduce(function (n, r) { return n + r.errors.length; }, 0)
      }
    };
  });
}

/* ============================================================
 * 真实联网采集（G5.3）
 * ------------------------------------------------------------
 * ★ 默认关闭：只有显式调用 collectLive() 才会启用 http transport。
 * ★ 来源白名单（任务书 §2）：**仅 S002–S006**；S001（Marvel HTML）与
 *   S007–S012 一律拒绝，即使调用方传入也不放行。
 * ============================================================ */
const LIVE_ALLOWED = Object.freeze(['S002', 'S003', 'S004', 'S005', 'S006']);

/**
 * 真实联网采集单源。
 * @param {string} sourceId 必须在 LIVE_ALLOWED 内
 * @param {object} opts { ...collect 的 opts, ...http transport 的 options }
 */
function collectLive(sourceId, opts) {
  const o = opts || {};
  /* ★ 同步校验（在返回 Promise 之前）—— 允许调用方用 try/catch 捕获 */
  if (LIVE_ALLOWED.indexOf(sourceId) < 0) {
    const e = new Error('[LIVE_SOURCE_NOT_ALLOWED] 本阶段联网白名单仅 ' + LIVE_ALLOWED.join('/') + '，拒绝：' + sourceId);
    e.code = 'LIVE_SOURCE_NOT_ALLOWED';
    throw e;
  }
  const HT = require('./http-transport.cjs');   /* 惰性 require：默认路径不加载网络模块 */
  /* 允许传入**已建好的** transport（使多个来源共享限速状态、robots 缓存与请求预算） */
  const t = o.httpTransport || HT.createHttpTransport(o.http || {});
  return collect(sourceId, Object.assign({}, o, { transport: t.transport })).then(function (r) {
    r.transport = 'http';
    r.http = t.summary();
    return r;
  });
}

/** 真实联网采集白名单内全部来源（顺序执行，单源失败不影响其他） */
function collectLiveAll(opts) {
  const o = opts || {};
  const out = [];
  return LIVE_ALLOWED.reduce(function (chain, id) {
    return chain.then(function () {
      return collectLive(id, o).then(function (r) {
        if (o.storeDir) {
          try {
            const CS = require('../capture-store.cjs');
            const s = r.captures.length ? CS.appendCaptures(r.captures, { dir: o.storeDir, date: o.storeDate })
              : { added: 0, skipped: 0, conflicts: [], total: 0, file: '' };
            r.store = { file: s.file, added: s.added, skipped: s.skipped, conflicts: s.conflicts, total: s.total };
            r.stats.records_saved = s.added + s.skipped;
          } catch (e) {
            r.errors.push({ stage: 'store', code: e.code || 'ERROR', message: e.message });
          }
        }
        out.push(r);
      });
    });
  }, Promise.resolve()).then(function () {
    return {
      collector_version: COLLECTOR_VERSION,
      transport: 'http',
      sources: out.map(function (r) { return r.registry_id; }),
      results: out,
      totals: {
        sources_tried: out.length,
        sources_ok: out.filter(function (r) { return r.errors.length === 0; }).length,
        accepted: out.reduce(function (n, r) { return n + r.stats.accepted; }, 0),
        rejected: out.reduce(function (n, r) { return n + r.stats.rejected; }, 0),
        errors: out.reduce(function (n, r) { return n + r.errors.length; }, 0)
      }
    };
  });
}

module.exports = {
  COLLECTOR_VERSION,
  LIVE_ALLOWED,
  makeRunId,
  nowIso,
  assertCleanOutput,
  collect,
  collectAndStore,
  collectAll,
  collectLive,
  collectLiveAll,
  /* 便于测试与复用 */
  parser: P,
  fetcher: SF,
  normalizer: NM
};
