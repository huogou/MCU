/* ============================================================
 * N1.2 · scheduler 脚手架（S002）
 * ------------------------------------------------------------
 * 性质：仅脚手架，不启用。
 *   - 默认关闭（DEFAULT_DISABLED = true）；不启用真实自动生产；
 *   - 默认运行模式 capture-only；保留人工触发能力；
 *   - 不因为建立 scheduler 就自动执行 production；不配置真实生产 cron；
 *   - 不自动调用真实 AI / 真实 Live；不修改正式资讯数据 / news.js。
 *
 * 安全护栏（强制）：autoProduction 恒为 false；即便 enabled=true，run() 也只到
 *   「计划层」，绝不触 production（capture-only / dry-run 仅作为可配置项存在，不执行）。
 * ============================================================ */
'use strict';

const DEFAULT_DISABLED = true;

function createScheduler(config) {
  const cfg = Object.assign(
    { enabled: false, mode: 'capture-only', frequency: null, autoProduction: false },
    config || {}
  );

  /* 安全护栏：脚手架永不自动 production；enabled 默认关闭 */
  if (cfg.enabled !== true) cfg.enabled = false;
  cfg.autoProduction = false;
  if (!cfg.mode) cfg.mode = 'capture-only';

  function plan() {
    return {
      enabled: cfg.enabled === true,
      mode: cfg.mode,
      frequency: cfg.frequency,
      autoProduction: false,
      wouldExecute: false   /* 脚手架不实现自动执行 */
    };
  }

  return {
    DEFAULT_DISABLED: DEFAULT_DISABLED,
    isEnabled: function () { return cfg.enabled === true; },
    getMode: function () { return cfg.mode; },
    getFrequency: function () { return cfg.frequency; },
    getConfig: function () { return Object.assign({}, cfg); },

    /* 手动触发：仅返回计划，不执行（真实执行由运营在 enabled 时显式调用；本脚手架不 proxy 生产） */
    triggerManual: function () {
      return Object.assign({ triggered: true, executed: false }, plan(), { action: 'manual-' + cfg.mode });
    },

    /* 调度执行入口：disabled 直接 skipped；即便 enabled，脚手架也仅暴露计划，绝不触 production */
    run: function () {
      if (cfg.enabled !== true) {
        return { skipped: true, executed: false, reason: 'scheduler disabled (DEFAULT_DISABLED=true)' };
      }
      /* enabled 但仍只到计划层：capture-only / dry-run 仅可配置，不自动 production */
      return {
        skipped: true, executed: false,
        reason: 'scaffold: auto production not implemented (capture-only/dry-run only)',
        plan: plan()
      };
    }
  };
}

module.exports = { createScheduler, DEFAULT_DISABLED };
