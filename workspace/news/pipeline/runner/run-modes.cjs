/* ============================================================
 * N1 · 运行模式定义与持久化边界（D1/D2 裁定落地）
 * ------------------------------------------------------------
 * 本模块只定义「模式」与「dry-run / --persist 语义边界」，
 * 不触碰任何 G1–G10 冻结模块、不改变 8 态 / 33 字段 / 判定语义。
 *
 * D1｜dry-run 是否写 run-history：不写。
 *   - dry-run 是纯模拟：可计算、统计、校验、预览；
 *   - 不 append run-history、不写任何生产持久化数据、不产生持久化副作用。
 *
 * D2｜生产业务数据持久化开关：
 *   - production-* 模式默认不持久化业务数据；
 *   - 仅显式 --persist 才允许正式落盘（capture-store / candidate-store / deliveries）；
 *   - run-history 属「运行审计记录」，与业务数据持久化严格解耦：
 *     production-* 运行时必须写 run-history，dry-run 不写。
 *   - dry-run + --persist 语义冲突，必须拒绝。
 *
 * 行为矩阵（最终裁定）：
 *   dry-run                        → 业务落盘 NO  / run-history NO  / 零文件（D1/D2 验收锁定）
 *   dry-run-full（P1-C 新增）      → 全链路模拟（collect→review/AI/dedup→delivery-preview
 *                                     + G4 只读诊断）；业务落盘 NO / run-history NO /
 *                                     可写 scratch 诊断（不碰正式归档）；用于 scheduler dry-run
 *   production-capture             → 业务落盘 NO  / run-history YES
 *   production-capture  + --persist→ 业务落盘 YES / run-history YES
 *   production-review              → 业务落盘 NO  / run-history YES
 *   production-review   + --persist→ 业务落盘 YES / run-history YES
 *   production-delivery-preview    → 业务落盘 NO  / run-history YES
 *   production-delivery-preview+--persist→业务落盘 YES / run-history YES
 * ============================================================ */
'use strict';

const path = require('path');

const MODES = Object.freeze([
  'dry-run',
  'dry-run-full',
  'production-capture',
  'production-review',
  'production-delivery-preview'
]);
const PRODUCTION_MODES = Object.freeze([
  'production-capture',
  'production-review',
  'production-delivery-preview'
]);
const DRY_MODES = Object.freeze(['dry-run', 'dry-run-full']);
/* §4：首选已验证成功来源；S003/S005 失败留痕、S001 单列人工通道（不进 RSS collector） */
const DEFAULT_CAPTURE_SOURCES = Object.freeze(['S002', 'S004', 'S006']);
const DRY_RUN = 'dry-run';
const DRY_RUN_FULL = 'dry-run-full';

function fail(code, message) {
  const e = new Error('[' + code + '] ' + message);
  e.code = code;
  throw e;
}

/** 校验运行模式合法性 */
function validateMode(m) {
  if (MODES.indexOf(m) < 0) {
    fail('UNKNOWN_MODE', '未知运行模式：' + String(m) + '（允许：' + MODES.join(' / ') + '）');
  }
  return m;
}

function isDryRun(m) { return DRY_MODES.indexOf(m) >= 0; }
function isProduction(m) { return PRODUCTION_MODES.indexOf(m) >= 0; }

/** D1：仅 production 模式写 run-history；dry-run / dry-run-full 均不写 */
function requiresRunHistory(m) { return isProduction(m); }

/** D2 安全边界：dry-run + --persist 语义冲突，必须拒绝（不写、不静默忽略） */
function checkPersistConflict(m, persist) {
  if (isDryRun(m) && persist === true) {
    fail('PARAM_CONFLICT',
      'dry-run 与 --persist 语义冲突：dry-run 是纯模拟模式，不产生任何持久化副作用，拒绝执行');
  }
  return true;
}

/** 默认正式业务目录（须位于 pipeline/ 内，满足 capture-store 写入守卫） */
function defaultDirs(pipelineDir) {
  const p = pipelineDir || path.resolve(__dirname, '..');
  return {
    captures: path.join(p, 'captures'),
    candidates: path.join(p, 'candidates'),
    deliveries: path.join(p, 'deliveries'),
    runHistory: path.join(p, 'run-history'),
    /* N1.2 P1-A：状态追踪层目录（仅 production + 本目录存在时启用） */
    status: path.join(p, 'status')
  };
}

module.exports = {
  MODES: MODES,
  PRODUCTION_MODES: PRODUCTION_MODES,
  DRY_MODES: DRY_MODES,
  DEFAULT_CAPTURE_SOURCES: DEFAULT_CAPTURE_SOURCES,
  DRY_RUN: DRY_RUN,
  DRY_RUN_FULL: DRY_RUN_FULL,
  validateMode: validateMode,
  isDryRun: isDryRun,
  isProduction: isProduction,
  requiresRunHistory: requiresRunHistory,
  checkPersistConflict: checkPersistConflict,
  defaultDirs: defaultDirs
};
