/* ============================================================
 * MCU 宇宙导航（小程序） - 统一视觉资源层
 * ------------------------------------------------------------
 * 来源：H5 mcu-navigator/data/{posters,stills}.js（唯一可信源，机械适配）
 * 入口：
 *   visual(id)   → { poster, backdrop }      电影海报 + 剧照
 *   avatar(id)   → 角色头像路径（本地）
 *   phase(n)     → 阶段代表图路径（本地），n = 1~6
 *   homeBg()     → 首页背景图路径（本地）
 *
 * V1.2 资源接入（2026-08-26）：
 *   - 38 张海报 + 38 张剧照 → CloudBase 静态托管（CDN）
 *   - 24 张角色头像 → 本地 assets/avatars/（待上传 CDN）
 *   - 1 张首页背景 → 本地 assets/backgrounds/（待上传 CDN）
 *   - 6 张阶段代表图 → 本地 assets/phases/（待上传 CDN）
 *   - 本地资源使用相对路径，上传 CDN 后替换为 CDN + 路径即可
 *
 * 设计纪律：
 *   1. 页面只调用本模块的访问函数，禁止把图片 URL 写死在页面。
 *   2. 新增图片：按同名登记后自动生效，不改页面逻辑。
 *   3. 缺失资源返回 null，由前端统一兜底（阶段色渐变 + 首字）。
 * ============================================================ */

/* CloudBase 静态托管根 */
const CDN = 'https://mcu-d6gw0brqoa9521b58-1307093647.tcloudbaseapp.com';

/* 本地资源根（已上传 CDN：2026-08-26 专项②，缩放后 36 文件 ~0.75MB 已托管至 /assets/*） */
const LOCAL = CDN + '/assets';

/* ── 竖版海报映射（38 部院线电影） ── */
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

/* ── 横版剧照映射（38 部） ── */
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

/* ── 角色头像映射（24 位，本地资源） ── */
/* key = characters.js 中的 id */
const avatars = {
  'tony':     LOCAL + '/avatars/tony.jpg',
  'steve':    LOCAL + '/avatars/steve.jpg',
  'thor':     LOCAL + '/avatars/thor.jpg',
  'natasha':  LOCAL + '/avatars/natasha.jpg',
  'banner':   LOCAL + '/avatars/banner.jpg',
  'clint':    LOCAL + '/avatars/clint.jpg',
  'loki':     LOCAL + '/avatars/loki.jpg',
  'fury':     LOCAL + '/avatars/fury.jpg',
  'bucky':    LOCAL + '/avatars/bucky.jpg',
  'sam':      LOCAL + '/avatars/sam.jpg',
  'peter':    LOCAL + '/avatars/peter.jpg',
  'strange':  LOCAL + '/avatars/strange.jpg',
  'tchalla':  LOCAL + '/avatars/tchalla.jpg',
  'wanda':    LOCAL + '/avatars/wanda.jpg',
  'vision':   LOCAL + '/avatars/vision.jpg',
  'scott':    LOCAL + '/avatars/scott.jpg',
  'carol':    LOCAL + '/avatars/carol.jpg',
  'starlord': LOCAL + '/avatars/starlord.jpg',
  'gamora':   LOCAL + '/avatars/gamora.jpg',
  'thanos':   LOCAL + '/avatars/thanos.jpg',
  'shangchi': LOCAL + '/avatars/shangchi.jpg',
  'yelena':   LOCAL + '/avatars/yelena.jpg',
  'wade':     LOCAL + '/avatars/wade.jpg',
  'logan':    LOCAL + '/avatars/logan.jpg'
};

/* ── 阶段代表图映射（6 阶段，本地资源） ── */
const phases = {
  1: LOCAL + '/phases/phase-1.jpg',
  2: LOCAL + '/phases/phase-2.jpg',
  3: LOCAL + '/phases/phase-3.jpg',
  4: LOCAL + '/phases/phase-4.jpg',
  5: LOCAL + '/phases/phase-5.jpg',
  6: LOCAL + '/phases/phase-6.jpg'
};

/* ── 首页背景（本地资源） ── */
const homeBackground = LOCAL + '/backgrounds/home-bg.jpg';

/* ── Hero Banner（首页沉浸式入口，V1.2 VDS 新增） ── */
const heroBannerImg = LOCAL + '/hero/hero-banner.jpg';

/* ── 功能入口卡片背景（4 张，V1.2 VDS 新增） ── */
const entryBgs = {
  watch:       LOCAL + '/entries/entry-watch.jpg',
  timeline:    LOCAL + '/entries/entry-timeline.jpg',
  characters:  LOCAL + '/entries/entry-characters.jpg',
  relationships: LOCAL + '/entries/entry-relationships.jpg'
};

/* ── 访问函数 ── */

/**
 * 电影视觉资源
 * @param {string} id - 电影 ID（如 'iron-man'）
 * @returns {{ poster: string|null, backdrop: string|null }}
 */
function visual(id) {
  return {
    poster:   (id && posters[id]) ? posters[id] : null,
    backdrop: (id && stills[id])  ? stills[id]  : null
  };
}

/**
 * 角色头像
 * @param {string} id - 角色 ID（如 'tony'）
 * @returns {string|null}
 */
function avatar(id) {
  return (id && avatars[id]) ? avatars[id] : null;
}

/**
 * 阶段代表图
 * @param {number} n - 阶段编号 1~6
 * @returns {string|null}
 */
function phase(n) {
  return (n && phases[n]) ? phases[n] : null;
}

/**
 * 首页背景图
 * @returns {string}
 */
function homeBg() {
  return homeBackground;
}

/**
 * Hero Banner（首页沉浸式入口背景）
 * @returns {string}
 */
function heroBanner() {
  return heroBannerImg;
}

/**
 * 功能入口卡片背景
 * @param {string} key - watch / timeline / characters / relationships
 * @returns {string|null}
 */
function entryBg(key) {
  return (key && entryBgs[key]) ? entryBgs[key] : null;
}

module.exports = { visual, avatar, phase, homeBg, heroBanner, entryBg, posters, stills, avatars, phases, entryBgs };
