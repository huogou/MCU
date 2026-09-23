/* ============================================================
 * G10 · 生产数据运行基线报告（对 news.js 现库 35 条实测）
 * ------------------------------------------------------------
 * 运行：node workspace/news/pipeline/run-history/run-baseline.cjs
 * 产出：production-baseline-20260923.json（五项统计 + SHA256 记录）
 * ★ 只读 news.js（零写入）。
 * ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const vm = require('vm');
const EM = require('../../engine/dedup/event-merger.cjs');

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const NEWS_JS = path.join(ROOT, 'h5', 'data', 'news.js');

const raw = fs.readFileSync(NEWS_JS, 'utf8');
const SHA = crypto.createHash('sha256').update(raw).digest('hex').toUpperCase();

const ctx = {};
ctx.window = ctx; ctx.global = ctx; ctx.console = console;
ctx.URL = URL; ctx.Date = Date; ctx.Math = Math; ctx.JSON = JSON;
vm.createContext(ctx);
vm.runInContext(raw, ctx, { filename: 'news.js' });
const N = ctx.window.MCU_NEWS || [];

/* 来源分布（reported_by 全部来源行统计） */
const srcCount = {};
let srcRows = 0;
N.forEach(function (n) {
  (n.reported_by || []).forEach(function (s) {
    srcRows++;
    const k = (s && s.source_name) || 'unknown';
    srcCount[k] = (srcCount[k] || 0) + 1;
  });
});

/* MCU / 非 MCU 双口径 */
const KW = /漫威|MCU|复联|毁灭之日|蜘蛛侠|旺达|幻视|猩红女巫|钢铁|雷神|美国队长|奇异博士|黑豹|银河护卫队|蚁人|惊奇|夜魔侠|神盾|秘密战争|Encore/i;
let mcuEntity = 0, mcuKeyword = 0;
N.forEach(function (n) {
  const hasEntity = (n.related_movies || []).length + (n.related_series || []).length +
    (n.related_characters || []).length > 0;
  if (hasEntity) mcuEntity++;
  if (KW.test(String(n.title || ''))) mcuKeyword++;
});

/* 单来源双口径 */
let singleByRows = 0, singleByIgc = 0;
N.forEach(function (n) {
  if ((n.reported_by || []).length === 1) singleByRows++;
  if (n.independent_group_count === 1) singleByIgc++;
});

/* 事件合并情况（3 天窗） */
const merged = EM.mergeCandidates(N.map(function (n) {
  return { id: n.id, title: n.title, category: n.category,
    related_movies: n.related_movies || [], related_series: n.related_series || [],
    related_characters: n.related_characters || [],
    publish_time: n.publish_time || '', first_seen_at: n.first_seen_at || '',
    reported_by: n.reported_by || [] };
}), { windowDays: 3 });

/* category 分布 */
const cat = {};
N.forEach(function (n) { cat[n.category] = (cat[n.category] || 0) + 1; });

const doc = {
  report: 'production-baseline',
  version: '1.0',
  date: '20260923',
  generated_at: new Date().toISOString(),
  sha256: SHA,
  total: N.length,
  source_distribution: srcCount,
  source_rows_total: srcRows,
  mcu_ratio: {
    by_entity_hit: { mcu: mcuEntity, other: N.length - mcuEntity },
    by_title_keyword: { mcu: mcuKeyword, other: N.length - mcuKeyword },
    note: '口径 A=related 实体命中（客观数据）；口径 B=title 关键词（审核口径）；双口径并列供产品确认'
  },
  single_source: {
    by_reported_by_len1: singleByRows,
    by_igc_eq_1: singleByIgc,
    ratio_rows: (singleByRows / N.length * 100).toFixed(1) + '%',
    ratio_igc: (singleByIgc / N.length * 100).toFixed(1) + '%'
  },
  review_pass_rate: {
    scope: 'G8 建议草案（133 条，operator=g8-draft-review，待负责人复核）',
    approved: 20, total: 133, rate: (20 / 133 * 100).toFixed(1) + '%'
  },
  event_merge: {
    window_days: 3,
    input: merged.stats.input_items,
    output_events: merged.stats.output_events,
    mergeable_events: merged.stats.mergeable_events,
    held_events: merged.stats.held_events,
    reports_preserved: merged.stats.reports_preserved,
    records_deleted: merged.stats.records_deleted
  },
  category_distribution: cat
};

const out = path.join(__dirname, 'production-baseline-20260923.json');
fs.writeFileSync(out, JSON.stringify(doc, null, 2), 'utf8');
console.log(JSON.stringify({ total: doc.total, sources: srcCount, mcu: doc.mcu_ratio,
  single: doc.single_source, pass_rate: doc.review_pass_rate.rate,
  merge: doc.event_merge.output_events + ' events (mergeable ' + merged.stats.mergeable_events + ')',
  sha: SHA.slice(0, 16) + '…' }, null, 1));
console.log('written: ' + out);
