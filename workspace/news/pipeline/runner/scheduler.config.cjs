/* ============================================================
 * N1.2 P1-C · 调度器默认配置（安全默认值）
 * ------------------------------------------------------------
 * 默认：完全关闭，绝不自动进入 production。
 * 启用生产前必须由运维显式将 enabled / productionAllowed 置 true，
 * 并确认下方并发与生产边界已满足（见 P1-C 报告「生产启用前检查清单」）。
 * ============================================================ */
'use strict';

module.exports = {
  enabled: false,              /* 默认关闭：run() 只返回计划，绝不执行 */
  mode: 'capture-only',        /* 默认配置模式（旧契约）；dry-run 实际走 dry-run-full 管道模式 */
  autoProduction: false,       /* 恒为 false（护栏，不可绕过）：调度器不自动 production */
  productionAllowed: false,    /* 显式开启后才允许 triggerProduction */
  concurrency: {
    lockTtlMs: 6 * 60 * 60 * 1000   /* 生产独占锁过期兜底 6h */
  }
};
