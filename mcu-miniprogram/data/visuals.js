/* ============================================================
 * MCU 宇宙导航（小程序） - 统一视觉资源层
 * ------------------------------------------------------------
 * 来源：H5 mcu-navigator/data/visuals.js（唯一可信源，机械适配）
 * 单一入口：visual(id) → { poster, backdrop }
 *   - poster   : 竖版海报（2:3），来源 posters 映射（assets/posters/{id}.jpg）
 *   - backdrop : 横版大图（16:9），来源 stills 映射（assets/stills/{id}.jpg）
 *
 * 设计纪律：
 *   1. 页面只调用 models/mcuData.js 的 visual(id)，禁止把图片 URL 写死在页面。
 *   2. 缺失任意资源返回 null，由前端统一兜底（阶段色视觉卡），不破图。
 *
 * 小程序端说明（Step3-2 数据层）：
 *   - 海报/剧照图片文件属 assets 阶段（Step3-3+ 填充），当前映射表保持空；
 *     图片文件就位后，按 H5 同名字段填入本地路径（/assets/posters/{id}.jpg）
 *     即自动生效，无需改页面逻辑。
 * ============================================================ */

/* 竖版海报映射（当前为空；图片资源就位后按 H5 data/posters.js 同名登记）
 * 例：'iron-man': '/assets/posters/iron-man.jpg' */
const posters = {};

/* 横版剧照映射（当前为空；图片资源就位后按 H5 data/stills.js 同名登记） */
const stills = {};

function visual(id) {
  return {
    poster:   (id && posters[id]) ? posters[id] : null,
    backdrop: (id && stills[id])  ? stills[id]  : null
  };
}

module.exports = { visual, posters, stills };
