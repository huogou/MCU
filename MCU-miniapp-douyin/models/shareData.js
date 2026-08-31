/* ============================================================
 * MCU 宇宙导航（小程序） - 分享数据模型（shareData）
 * ------------------------------------------------------------
 * V1.1 Step4 新增（独立模型，不碰 V1.0 任何数据）
 * 职责：
 *   1. 分享模板元数据（三类型：progress 观影进度 / route 路线 / movie 电影）
 *      —— 模板具体 canvas 绘制布局在 pages/share/share.js，本模型提供
 *         类型标签/标题/slogan/品牌等文案常量与画布尺寸常量
 *   2. 分享记录（独立键 mcu_nav_share_v1）：
 *      { total, byType: {progress, route, movie}, history: [{type, at}] }
 *      —— history 保留最近 MAX_HISTORY 条，防膨胀
 * 接口：template(type) / record(type) / getStats()
 * 铁律：不改 CONTENT/ROUTES/RELATIONS/CHARACTERS/PANO；不并入 mcu_nav_user_v1
 * ============================================================ */

const KEY = 'mcu_nav_share_v1';
const MAX_HISTORY = 50;

/* 画布逻辑尺寸（设计稿 px；绘制时按 dpr 缩放） */
const CANVAS = { width: 750, height: 1100 };

/* 品牌与通用文案 */
const BRAND = 'MCU 宇宙导航';
const SLOGAN = {
  progress: '分享我的 MCU 进度',
  route: '来一起走这条 MCU 路线',
  movie: '我在看 MCU，一起吗'
};

/* 三类型模板元数据（type 取值：progress / route / movie） */
const TEMPLATES = {
  progress: {
    type: 'progress',
    label: '观影进度海报',
    title: '我的 MCU 旅程',
    slogan: SLOGAN.progress,
    desc: '已观看数量 / 总数量 59 · 当前阶段'
  },
  route: {
    type: 'route',
    label: '路线分享海报',
    title: '我在走这条路线',
    slogan: SLOGAN.route,
    desc: '当前路线 · 路线特点 · 推荐信息'
  },
  movie: {
    type: 'movie',
    label: '电影分享海报',
    title: '电影分享',
    slogan: SLOGAN.movie,
    desc: '电影名称 · 简介 · 在 MCU 中的位置'
  }
};

function readState() {
  try {
    const raw = tt.getStorageSync(KEY);
    if (raw) return raw;
  } catch (e) {}
  return { total: 0, byType: { progress: 0, route: 0, movie: 0 }, history: [] };
}

function writeState(s) {
  try { tt.setStorageSync(KEY, s); } catch (e) {}
}

const shareData = {
  /* 画布尺寸与模板元数据（页面只读引用） */
  canvas: CANVAS,
  brand: BRAND,
  templates: TEMPLATES,

  /* 取模板元数据；非法类型返回 null */
  template: function (type) {
    return TEMPLATES[type] || null;
  },

  /* 分享成功记录（后台统计，不展示给用户）：
   * total+1 / byType[type]+1 / history 追加并裁剪至 MAX_HISTORY */
  record: function (type) {
    const t = TEMPLATES[type] ? type : 'progress';
    const s = readState();
    s.total = (s.total || 0) + 1;
    s.byType = s.byType || { progress: 0, route: 0, movie: 0 };
    s.byType[t] = (s.byType[t] || 0) + 1;
    s.history = s.history || [];
    s.history.push({ type: t, at: Date.now() });
    if (s.history.length > MAX_HISTORY) s.history = s.history.slice(-MAX_HISTORY);
    writeState(s);
    return s;
  },

  /* 读统计（成就系统 sharer-1 判定用 total） */
  getStats: function () {
    return readState();
  }
};

module.exports = shareData;
