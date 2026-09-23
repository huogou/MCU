/* ============================================================
 * MCU 宇宙导航 · 事件合并引擎 V1.0（G4）
 * ------------------------------------------------------------
 * 用途：把多条报道按「同一事件」归并，产出事件级条目，
 *       为后续人工审核与判定器重算提供**输入材料**。
 *
 * 性质：纯函数、纯规则层。零网络、零 AI、零副作用。
 *
 * ★★ 四条硬约束（写死在实现里，不得放宽）：
 *   1. **不自动修改 verification_status** —— 本层既不读取、也不产出、
 *      更不推导任何状态；状态只能由 G1 判定器按 R8.3 重算。
 *   2. **不自动合并不同事件** —— 不同 event_key 的条目**永不合并**；
 *      同一 event_key 但超出时间窗口的，判为 hold，交人工处理。
 *   3. **不删除任何报道记录** —— 输出中每条输入报道都必须能找到，
 *      且保留其 source_name / source_url / publish_time。
 *   4. **时间窗口仅用于候选判断** —— 只决定「是否可自动合并」，
 *      不改变任何条目内容、不改变任何状态。
 * ============================================================ */
'use strict';

const EK = require('./event-key.cjs');

const MERGER_VERSION = '1';
const WINDOW_DAYS_DEFAULT = 3;      /* 默认时间窗口：3 天 */

/* 输出中**禁止出现**的字段（状态相关一律不得由本层产出） */
const FORBIDDEN_OUTPUT_KEYS = Object.freeze([
  'verification_status',
  'judged_by',
  'chain_steps_hit',
  'status_change_reason',
  'status_change_evidence_url',
  'status_changed_at'
]);

/* ---------------- 时间工具 ---------------- */

/** 取用于窗口判断的时间：publish_time 优先，回落 first_seen_at；均无效返回 null */
function timeOf(item) {
  if (!item) return null;
  const raw = item.publish_time || item.first_seen_at || '';
  const t = Date.parse(raw);
  return isNaN(t) ? null : t;
}

function dayMs() { return 24 * 60 * 60 * 1000; }

function daysBetween(a, b) {
  return Math.abs(a - b) / dayMs();
}

/* ---------------- 报道记录（原样保留，绝不裁剪） ---------------- */

function toReport(item) {
  const rb = (item && item.reported_by) || [];
  return {
    id: item && item.id ? String(item.id) : '',
    publish_time: (item && item.publish_time) || '',
    first_seen_at: (item && item.first_seen_at) || '',
    source_names: rb.map(function (s) { return s && s.source_name; }).filter(Boolean),
    source_urls: rb.map(function (s) { return s && s.source_url; }).filter(Boolean),
    owner_groups: Array.from(new Set(rb.map(function (s) { return s && s.owner_group; })
      .filter(function (g) { return g != null && String(g).trim() !== ''; })))
  };
}

/* ---------------- 候选判定（只判断「能否自动合并」） ---------------- */

/**
 * 两两比较：是否同一事件、是否落在时间窗口内、合并决策是什么。
 * @returns {{same_event:boolean, within_window:boolean|null, decision:string, reason:string}}
 */
function decidePair(a, b, opts) {
  const windowDays = (opts && opts.windowDays) || WINDOW_DAYS_DEFAULT;
  const ka = EK.buildEventKey(a);
  const kb = EK.buildEventKey(b);

  if (ka !== kb) {
    return { same_event: false, within_window: null, decision: 'separate', reason: 'event_key 不同（不同事件）' };
  }
  const ta = timeOf(a), tb = timeOf(b);
  if (ta == null || tb == null) {
    return { same_event: true, within_window: null, decision: 'hold', reason: 'missing_time（缺时间，保守不合并）' };
  }
  const d = daysBetween(ta, tb);
  if (d <= windowDays) {
    return { same_event: true, within_window: true, decision: 'merge', reason: '同 key 且间隔 ' + d.toFixed(2) + ' 天 ≤ 窗口 ' + windowDays + ' 天' };
  }
  return { same_event: true, within_window: false, decision: 'hold', reason: 'out_of_window（同 key 但间隔 ' + d.toFixed(2) + ' 天 > 窗口 ' + windowDays + ' 天）' };
}

/* ---------------- 主入口 ---------------- */

/**
 * 按事件归并候选条目。
 * @param {Array} items 资讯条目数组（只读，不被修改）
 * @param {object} opts { windowDays:number }
 * @returns {object} { events:[…], stats:{…} }
 *   ※ 输出中**不含任何状态字段**（已由 FORBIDDEN_OUTPUT_KEYS 约束，测试会深层校验）
 */
function mergeCandidates(items, opts) {
  const list = Array.isArray(items) ? items.filter(function (x) { return x && typeof x === 'object'; }) : [];
  const windowDays = (opts && opts.windowDays) || WINDOW_DAYS_DEFAULT;

  /* 1) 按 event_key 分组 */
  const groups = Object.create(null);
  const order = [];
  list.forEach(function (it) {
    const k = EK.buildEventKey(it);
    if (!groups[k]) { groups[k] = []; order.push(k); }
    groups[k].push(it);
  });

  /* 2) 组内按时间窗口做链式聚类 */
  const events = [];
  order.forEach(function (k) {
    const group = groups[k];
    const timed = [];
    const untimed = [];
    group.forEach(function (it) {
      const t = timeOf(it);
      if (t == null) untimed.push(it); else timed.push({ it: it, t: t });
    });
    timed.sort(function (a, b) { return a.t - b.t; });

    const clusters = [];
    timed.forEach(function (x) {
      const last = clusters[clusters.length - 1];
      if (last && daysBetween(x.t, last.lastT) <= windowDays) {
        last.items.push(x.it); last.lastT = x.t;
      } else {
        clusters.push({ items: [x.it], firstT: x.t, lastT: x.t });
      }
    });

    function build(clusterItems, holdReason, decision) {
      const reports = clusterItems.map(toReport);
      const idList = reports.map(function (r) { return r.id; }).filter(Boolean);
      const times = clusterItems.map(timeOf).filter(function (t) { return t != null; });
      times.sort(function (a, b) { return a - b; });

      /* 来源证据并集 —— ★ 仅作**输入材料**交 G1 判定器重算，
       *   本层不产出、不推导任何状态。 */
      const seenSrc = Object.create(null);
      const srcUnion = [];
      clusterItems.forEach(function (it) {
        ((it && it.reported_by) || []).forEach(function (s) {
          if (!s) return;
          const key = [s.source_name, s.source_url, s.owner_group].join('|');
          if (seenSrc[key]) return;
          seenSrc[key] = 1;
          srcUnion.push({ source_name: s.source_name, source_url: s.source_url, owner_group: s.owner_group });
        });
      });
      const groups_ = Array.from(new Set(srcUnion.map(function (s) { return s.owner_group; })
        .filter(function (g) { return g != null && String(g).trim() !== ''; })));

      return {
        event_key: k,
        item_ids: idList,
        report_count: idList.length,
        category: EK.explain(clusterItems[0] || {}).category,
        first_publish_time: times.length ? new Date(times[0]).toISOString() : '',
        last_publish_time: times.length ? new Date(times[times.length - 1]).toISOString() : '',
        within_window: decision === 'merge',
        decision: decision,
        hold_reason: holdReason,
        reports: reports,                 /* ★ 不删除任何报道记录 */
        reported_by_union: srcUnion,      /* ★ 输入材料，不是状态 */
        distinct_owner_groups: groups_,
        note: '本条目不含任何状态信息；状态须由 G1 判定器按 R8.3 重算'
      };
    }

    if (clusters.length <= 1) {
      const clusterItems = clusters.length ? clusters[0].items : [];
      if (clusterItems.length) {
        events.push(build(clusterItems, '', clusterItems.length > 1 ? 'merge' : 'single'));
      }
      /* 无时间的条目：单独成条，保守不合并 */
      untimed.forEach(function (it) {
        events.push(build([it], 'missing_time', 'hold'));
      });
    } else {
      /* 同 key 但时间上分裂成多簇 → 一律 hold，不自动合并不同事件 */
      clusters.forEach(function (c) {
        events.push(build(c.items, 'out_of_window', 'hold'));
      });
      untimed.forEach(function (it) {
        events.push(build([it], 'missing_time', 'hold'));
      });
    }
  });

  const totalReports = events.reduce(function (n, e) { return n + e.report_count; }, 0);
  const mergeable = events.filter(function (e) { return e.decision === 'merge'; }).length;
  const held = events.filter(function (e) { return e.decision === 'hold'; }).length;

  return {
    merger_version: MERGER_VERSION,
    window_days: windowDays,
    events: events,
    stats: {
      input_items: list.length,
      output_events: events.length,
      reports_preserved: totalReports,
      mergeable_events: mergeable,
      held_events: held,
      records_deleted: list.length - totalReports      /* 恒为 0；显式暴露以便断言 */
    }
  };
}

/* ---------------- 深层禁用键检查（供测试与调用方自检） ---------------- */

/** 递归扫描对象中是否出现被禁状态字段；返回命中的键路径数组 */
function findForbiddenKeys(obj, pathPrefix) {
  const hits = [];
  (function walk(node, p) {
    if (node == null || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach(function (x, i) { walk(x, p + '[' + i + ']'); }); return; }
    Object.keys(node).forEach(function (k) {
      if (FORBIDDEN_OUTPUT_KEYS.indexOf(k) >= 0) hits.push(p + '.' + k);
      walk(node[k], p + '.' + k);
    });
  })(obj, pathPrefix || '');
  return hits;
}

module.exports = {
  MERGER_VERSION,
  WINDOW_DAYS_DEFAULT,
  FORBIDDEN_OUTPUT_KEYS,
  timeOf,
  daysBetween,
  decidePair,
  mergeCandidates,
  findForbiddenKeys
};
