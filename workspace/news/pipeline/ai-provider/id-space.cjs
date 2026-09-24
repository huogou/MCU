/* ============================================================
 * N1.3 · idSpace 约束（Provider 输出后的项目业务校验）
 * ------------------------------------------------------------
 * 定位：模型只能「提出候选实体」，不能自行创造项目不存在的实体 ID。
 *   在 Provider 输出进入 Normalizer / persistence 之前，对 related_* 施加
 *   项目**真实实体空间**约束。
 *
 * 硬约束：
 *   - **复用**项目既有实体空间（h5/data 的 MCU_CONTENT / MCU_CHARACTERS），
 *     加载方式与 ai-normalizer/build-g55.cjs 完全一致 —— 不创建第二套实体库。
 *   - **不修改** N1.1 的 7 字段 Provider contract；本约束只过滤 related_* 数组，
 *     不增/删字段，不把 idSpace 加入 Provider contract。
 *   - 规则：存在 → 保留；不存在 → 删除；格式非法 → 删除；空数组 → 允许；
 *     绝不为保留模型结果而创建不存在的实体。
 *   - 纯函数（constrain / validateRelated 零网络、零副作用）。
 * ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

/* ai-provider → pipeline → news → workspace → 项目根 */
const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

const PHASE_MIN = 1;
const PHASE_MAX = 6;

function fail(code, message) {
  const e = new Error('[' + code + '] ' + message);
  e.code = code;
  throw e;
}

/**
 * 加载项目真实实体空间（与 build-g55.cjs §1 同一来源与加载方式）。
 * @returns {{content:Set<string>, character:Set<string>, phases:Set<number>, source:string, counts:object}}
 */
function loadIdSpace() {
  const ctx = {};
  ctx.window = ctx; ctx.global = ctx; ctx.console = console;
  ctx.URL = URL; ctx.Date = Date; ctx.Math = Math; ctx.JSON = JSON;
  vm.createContext(ctx);
  ['movies.js', 'series.js', 'special.js', 'short.js', 'content.js', 'characters.js']
    .forEach(function (f) {
      vm.runInContext(fs.readFileSync(path.join(ROOT, 'h5', 'data', f), 'utf8'), ctx, { filename: f });
    });
  const content = new Set((ctx.window.MCU_CONTENT || []).map(function (x) { return x.id; }));
  const character = new Set((ctx.window.MCU_CHARACTERS || []).map(function (x) { return x.id; }));
  const phases = new Set([1, 2, 3, 4, 5, 6]);
  return {
    content: content,
    character: character,
    phases: phases,
    source: 'h5/data/{movies,series,special,short,content,characters}.js（既有单一可信源）',
    counts: { content: content.size, character: character.size, phases: phases.size }
  };
}

/** 过滤一组 id：命中真实空间则保留（去重），否则记入 dropped */
function filterIds(arr, set, bucket) {
  const a = Array.isArray(arr) ? arr : [];
  const kept = [];
  a.forEach(function (x) {
    const v = String(x == null ? '' : x).trim();
    if (v && set.has(v)) {
      if (kept.indexOf(v) < 0) kept.push(v);
    } else {
      bucket.push(v || String(x));
    }
  });
  return kept;
}

/**
 * 对 Provider 7 字段（或已注入 ai_model 的 8 字段）施加 idSpace 约束。
 * 只过滤 related_*；输出保留全部原字段（不增/不删）。
 * @returns {{fields:object, dropped:{movies:[],series:[],characters:[],phases:[]}, droppedCount:number}}
 */
function constrain(fields, space) {
  if (!fields || typeof fields !== 'object' || Array.isArray(fields)) {
    fail('IDSPACE_INVALID', 'constrain 需要普通对象');
  }
  if (!space || !(space.content instanceof Set) || !(space.character instanceof Set)) {
    fail('IDSPACE_MISSING', 'constrain 需要真实 idSpace（content / character Set）');
  }
  const out = Object.assign({}, fields);        /* 保留全部原字段 */
  const dropped = { movies: [], series: [], characters: [], phases: [] };
  out.related_movies = filterIds(fields.related_movies, space.content, dropped.movies);
  out.related_series = filterIds(fields.related_series, space.content, dropped.series);
  out.related_characters = filterIds(fields.related_characters, space.character, dropped.characters);
  const ph = [];
  (Array.isArray(fields.related_phases) ? fields.related_phases : []).forEach(function (p) {
    const ok = Number.isInteger(p) && p >= PHASE_MIN && p <= PHASE_MAX;
    if (ok) { if (ph.indexOf(p) < 0) ph.push(p); } else { dropped.phases.push(p); }
  });
  out.related_phases = ph;
  const droppedCount = dropped.movies.length + dropped.series.length +
    dropped.characters.length + dropped.phases.length;
  return { fields: out, dropped: dropped, droppedCount: droppedCount };
}

/** 校验结果中的 related_* 是否全部落在真实空间内（final idSpace validation） */
function validateRelated(obj, space) {
  const violations = [];
  if (!obj || typeof obj !== 'object') return { ok: false, violations: ['NOT_OBJECT'] };
  [['related_movies', space.content], ['related_series', space.content], ['related_characters', space.character]]
    .forEach(function (pair) {
      (Array.isArray(obj[pair[0]]) ? obj[pair[0]] : []).forEach(function (id) {
        if (!pair[1].has(String(id).trim())) violations.push(pair[0] + ':' + id);
      });
    });
  (Array.isArray(obj.related_phases) ? obj.related_phases : []).forEach(function (p) {
    if (!(Number.isInteger(p) && p >= PHASE_MIN && p <= PHASE_MAX)) violations.push('related_phases:' + p);
  });
  return { ok: violations.length === 0, violations: violations };
}

module.exports = { loadIdSpace, constrain, validateRelated, PHASE_MIN, PHASE_MAX, ROOT };
