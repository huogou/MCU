/* ============================================================
 * MCU 宇宙导航 - 统一视觉资源层（V1.3 A3 / A4）
 * ------------------------------------------------------------
 * 单一入口：global.MCU_VISUAL(id) → { poster, backdrop }
 *   - poster   : 竖版海报（2:3），来源 MCU_POSTERS（assets/posters/{id}.jpg）
 *   - backdrop : 横版大图（16:9），来源 MCU_STILLS（assets/stills/{id}.jpg）
 *
 * 设计纪律：
 *   1. 页面只调用 MCU.data.visual(id)，禁止把图片 URL 写死在 HTML / 各页 JS。
 *   2. 缺失任意资源返回 null，由前端统一兜底（阶段色视觉卡），不破图。
 *
 * 视觉来源说明：
 *   - 本项目采用真实 TMDB 海报/剧照作视觉底层（38 部院线电影）。
 *   - 原 V1.3 第五章规划的「风格化原创视觉卡」（assets/visual-cards/）
 *     经评估未单独产出，对应目录已于 2026-08-13 清理，本项目不使用该字段。
 *   - 版权：用户 2026-08-13 决策——小程序不涉及盈利与商业行为，
 *     不处理版权授权；页脚（app.js）已保留「图片素材版权归原作者及漫威影业所有，侵删」声明。
 * ============================================================ */
(function (global) {
  'use strict';

  function visual(id) {
    var posters = global.MCU_POSTERS || {};
    var stills  = global.MCU_STILLS || {};

    return {
      poster:   (id && posters[id]) ? posters[id] : null,
      backdrop: (id && stills[id])  ? stills[id]  : null
    };
  }

  global.MCU_VISUAL = visual;
})(window);
