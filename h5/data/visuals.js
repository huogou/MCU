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

  /* ── 资源基址（CDN 支持，2026-09-10 V2.0）────────────────────
   * 默认留空：沿用数据文件里的相对路径，本地 file:// 双击打开与同域部署都可用。
   * 若日后把图片迁到独立 CDN，只需在引入本文件**之前**设置一次：
   *     <script>window.MCU_ASSET_BASE = 'https://cdn.example.com/mcu/';</script>
   * 全站海报 / 剧照自动切换，无需改动任何页面或数据文件。
   * 已是绝对地址（http(s):// 或 //）的路径不做拼接，避免重复前缀。 */
  var ASSET_BASE = global.MCU_ASSET_BASE || '';

  function resolve(p) {
    if (!p) return null;
    if (/^(https?:)?\/\//i.test(p)) return p;
    return ASSET_BASE + p;
  }

  function visual(id) {
    var posters = global.MCU_POSTERS || {};
    var stills  = global.MCU_STILLS || {};

    return {
      poster:   (id && posters[id]) ? resolve(posters[id]) : null,
      backdrop: (id && stills[id])  ? resolve(stills[id])  : null
    };
  }

  global.MCU_VISUAL = visual;
})(window);
