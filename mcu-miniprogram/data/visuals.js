/* ============================================================
 * MCU 宇宙导航（小程序） - 统一视觉资源层
 * ------------------------------------------------------------
 * 来源：H5 mcu-navigator/data/{posters,stills}.js（唯一可信源，机械适配）
 * 单一入口：visual(id) → { poster, backdrop }
 *   - poster   : 竖版海报（2:3），来源 posters 映射
 *   - backdrop : 横版大图（16:9），来源 stills 映射
 *
 * V1.2 资源接入（2026-08-25）：
 *   - 38 张海报 + 38 张剧照已按 H5 同名登记，指向 CloudBase 静态托管
 *     （https://mcu-d6gw0brqoa9521b58-1307093647.tcloudbaseapp.com/assets/...），
 *     curl 实测 HTTP 200 在线。
 *   - 加载依赖：mp 后台将上述域名加入 downloadFile 合法域名（人工配置一次）。
 *   - 未接入域名前 image 加载失败 → 前端按 design 规则自动兜底
 *     （阶段色渐变 + 首字），不破图。
 *   - 缺失资源（如剧集/未收录海报）返回 null，由前端统一兜底。
 *
 * 设计纪律：
 *   1. 页面只调用 models/mcuData.js 的 visual(id)，禁止把图片 URL 写死在页面。
 *   2. 新增图片：按 H5 同名文件登记后自动生效，不改页面逻辑。
 * ============================================================ */

/* CloudBase 静态托管根 */
const CDN = 'https://mcu-d6gw0brqoa9521b58-1307093647.tcloudbaseapp.com';

/* 竖版海报映射（38 部已上映院线电影，与 H5 data/posters.js 同名） */
const posters = {
  'iron-man':                      CDN + '/assets/posters/iron-man.jpg',
  'incredible-hulk':               CDN + '/assets/posters/incredible-hulk.jpg',
  'iron-man-2':                    CDN + '/assets/posters/iron-man-2.jpg',
  'thor':                          CDN + '/assets/posters/thor.jpg',
  'captain-america-first-avenger': CDN + '/assets/posters/captain-america-first-avenger.jpg',
  'avengers':                      CDN + '/assets/posters/avengers.jpg',
  'iron-man-3':                    CDN + '/assets/posters/iron-man-3.jpg',
  'thor-dark-world':               CDN + '/assets/posters/thor-dark-world.jpg',
  'winter-soldier':                CDN + '/assets/posters/winter-soldier.jpg',
  'guardians':                     CDN + '/assets/posters/guardians.jpg',
  'age-of-ultron':                 CDN + '/assets/posters/age-of-ultron.jpg',
  'ant-man':                       CDN + '/assets/posters/ant-man.jpg',
  'civil-war':                     CDN + '/assets/posters/civil-war.jpg',
  'doctor-strange':                CDN + '/assets/posters/doctor-strange.jpg',
  'guardians-2':                   CDN + '/assets/posters/guardians-2.jpg',
  'spider-man-homecoming':         CDN + '/assets/posters/spider-man-homecoming.jpg',
  'thor-ragnarok':                 CDN + '/assets/posters/thor-ragnarok.jpg',
  'black-panther':                 CDN + '/assets/posters/black-panther.jpg',
  'ant-man-wasp':                  CDN + '/assets/posters/ant-man-wasp.jpg',
  'infinity-war':                  CDN + '/assets/posters/infinity-war.jpg',
  'captain-marvel':                CDN + '/assets/posters/captain-marvel.jpg',
  'endgame':                       CDN + '/assets/posters/endgame.jpg',
  'far-from-home':                 CDN + '/assets/posters/far-from-home.jpg',
  'black-widow':                   CDN + '/assets/posters/black-widow.jpg',
  'shang-chi':                     CDN + '/assets/posters/shang-chi.jpg',
  'eternals':                      CDN + '/assets/posters/eternals.jpg',
  'no-way-home':                   CDN + '/assets/posters/no-way-home.jpg',
  'multiverse-of-madness':         CDN + '/assets/posters/multiverse-of-madness.jpg',
  'love-and-thunder':              CDN + '/assets/posters/love-and-thunder.jpg',
  'wakanda-forever':               CDN + '/assets/posters/wakanda-forever.jpg',
  'quantumania':                   CDN + '/assets/posters/quantumania.jpg',
  'guardians-3':                   CDN + '/assets/posters/guardians-3.jpg',
  'the-marvels':                   CDN + '/assets/posters/the-marvels.jpg',
  'deadpool-wolverine':            CDN + '/assets/posters/deadpool-wolverine.jpg',
  'brave-new-world':               CDN + '/assets/posters/brave-new-world.jpg',
  'thunderbolts':                  CDN + '/assets/posters/thunderbolts.jpg',
  'fantastic-four':                CDN + '/assets/posters/fantastic-four.jpg',
  'brand-new-day':                 CDN + '/assets/posters/brand-new-day.jpg'
};

/* 横版剧照映射（38 部，与 H5 data/stills.js 同名） */
const stills = {
  'iron-man':                      CDN + '/assets/stills/iron-man.jpg',
  'incredible-hulk':               CDN + '/assets/stills/incredible-hulk.jpg',
  'iron-man-2':                    CDN + '/assets/stills/iron-man-2.jpg',
  'thor':                          CDN + '/assets/stills/thor.jpg',
  'captain-america-first-avenger': CDN + '/assets/stills/captain-america-first-avenger.jpg',
  'avengers':                      CDN + '/assets/stills/avengers.jpg',
  'iron-man-3':                    CDN + '/assets/stills/iron-man-3.jpg',
  'thor-dark-world':               CDN + '/assets/stills/thor-dark-world.jpg',
  'winter-soldier':                CDN + '/assets/stills/winter-soldier.jpg',
  'guardians':                     CDN + '/assets/stills/guardians.jpg',
  'age-of-ultron':                 CDN + '/assets/stills/age-of-ultron.jpg',
  'ant-man':                       CDN + '/assets/stills/ant-man.jpg',
  'civil-war':                     CDN + '/assets/stills/civil-war.jpg',
  'doctor-strange':                CDN + '/assets/stills/doctor-strange.jpg',
  'guardians-2':                   CDN + '/assets/stills/guardians-2.jpg',
  'spider-man-homecoming':         CDN + '/assets/stills/spider-man-homecoming.jpg',
  'thor-ragnarok':                 CDN + '/assets/stills/thor-ragnarok.jpg',
  'black-panther':                 CDN + '/assets/stills/black-panther.jpg',
  'ant-man-wasp':                  CDN + '/assets/stills/ant-man-wasp.jpg',
  'infinity-war':                  CDN + '/assets/stills/infinity-war.jpg',
  'captain-marvel':                CDN + '/assets/stills/captain-marvel.jpg',
  'endgame':                       CDN + '/assets/stills/endgame.jpg',
  'far-from-home':                 CDN + '/assets/stills/far-from-home.jpg',
  'black-widow':                   CDN + '/assets/stills/black-widow.jpg',
  'shang-chi':                     CDN + '/assets/stills/shang-chi.jpg',
  'eternals':                      CDN + '/assets/stills/eternals.jpg',
  'no-way-home':                   CDN + '/assets/stills/no-way-home.jpg',
  'multiverse-of-madness':         CDN + '/assets/stills/multiverse-of-madness.jpg',
  'love-and-thunder':              CDN + '/assets/stills/love-and-thunder.jpg',
  'wakanda-forever':               CDN + '/assets/stills/wakanda-forever.jpg',
  'quantumania':                   CDN + '/assets/stills/quantumania.jpg',
  'guardians-3':                   CDN + '/assets/stills/guardians-3.jpg',
  'the-marvels':                   CDN + '/assets/stills/the-marvels.jpg',
  'deadpool-wolverine':            CDN + '/assets/stills/deadpool-wolverine.jpg',
  'brave-new-world':               CDN + '/assets/stills/brave-new-world.jpg',
  'thunderbolts':                  CDN + '/assets/stills/thunderbolts.jpg',
  'fantastic-four':                CDN + '/assets/stills/fantastic-four.jpg',
  'brand-new-day':                 CDN + '/assets/stills/brand-new-day.jpg'
};

function visual(id) {
  return {
    poster:   (id && posters[id]) ? posters[id] : null,
    backdrop: (id && stills[id])  ? stills[id]  : null
  };
}

module.exports = { visual, posters, stills };
