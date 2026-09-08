/* ============================================================
 * 首页 home（Tab1）· V1.2 视觉系统落地（按《MCU-V1.2-Visual-Design-System》VDS V2）
 * ------------------------------------------------------------
 * 结构（2026-09-07 抖音合规整改后，3 模块）：
 *   ① Hero Banner（进度条）→ ② 旅程卡（当前观看）+ 推荐下一部 → ③ 最近观看
 * 整改说明：原「功能入口 2×2（宇宙入口）」「热门角色」两模块属内容资讯型，
 *   按抖音《版本审核标准》第二节（类目缺失需删除对应功能）移除。
 * 数据纪律：全部来自 models（单一可信源），仅装配本页视图模型；
 *   图片 URL 只存在于 visuals.js（经 mcuData 转发层访问，禁硬编码）。
 * 跳转：所有入口统一指向「我的MCU」观影记录页（Tab）。
 * ============================================================ */

const mcuData = require('../../models/mcuData.js');
const userState = require('../../models/userState.js');
const recommend = require('../../models/recommend.js');

/* 传奇标签映射（saga 取值：infinity / multiverse） */
const SAGA_LABEL = { infinity: '无限传奇', multiverse: '多元宇宙' };

/* 最近观看最多展示 */
const RECENT_MAX = 6;

/* 电影视图模型：取 poster/backdrop（缺失为 null，前端走兜底） */
function movieVM(id) {
  const m = mcuData.get(id);
  if (!m) return null;
  const v = mcuData.visual(id);
  const phaseNo = m.phase || 1;
  const saga = SAGA_LABEL[m.saga] || '';
  return {
    id: m.id,
    poster: (v && v.poster) ? v.poster : null,
    backdrop: (v && v.backdrop) ? v.backdrop : null,
    name: m.cn,
    enName: m.en || '',
    phaseText: 'Phase ' + phaseNo + (saga ? ' · ' + saga : ''),
    year: m.year ? String(m.year) : '',
    initial: m.cn.charAt(0),
    phase: phaseNo
  };
}

Page({
  data: {
    heroBanner: '',   /* ① Hero Banner 背景（hero-banner.jpg） */
    heroMeta: '',     /* Hero 副标题文案（59 部 · 24 角色 · 6 阶段） */
    progressPercent: 0, /* Hero 迷你旅程条进度 */
    progress: null,   /* ① 旅程卡：当前观看 */
    recommend: null,  /* ② 推荐下一部大卡 */
    recent: [],       /* ③ 最近观看 */
    libraryEntry: null /* ④ 作品查询入口（2026-09-08 新增） */
  },

  onShow() { this.refresh(); },

  /* ---- 数据装配（仅本页视图模型） ---- */
  refresh() {
    const count = userState.count();
    const total = mcuData.all.length;
    const hasProgress = count > 0;
    const state = userState.getState();
    const watched = state.watched || {};
    const latest = userState.latest();

    /* ① Hero Banner（VDS §2.2）+ 迷你旅程条 */
    const heroBanner = mcuData.heroBanner() || '';
    const progressPercent = total > 0 ? Math.min(100, Math.round(count / total * 100)) : 0;

    /* ② 旅程/推荐卡（VDS §2.2：Hero 吸收进度信息，旅程卡简化为当前电影推荐） */
    const currentId = (hasProgress && latest) ? latest.id : 'iron-man';
    const cur = movieVM(currentId);
    const isCurrent = !watched[currentId];
    const progress = {
      count: count,
      total: total,
      journeyLabel: '我的 MCU 旅程',
      phaseText: hasProgress ? cur.phaseText : 'Phase 1 · 无限传奇',
      movie: {
        id: cur.id,
        poster: cur.poster,
        name: cur.name,
        enName: cur.enName,
        phaseText: cur.phaseText,
        year: cur.year,
        initial: cur.initial,
        phase: cur.phase,
        statusLabel: isCurrent ? '当前观看' : '已观看',
        statusCls: isCurrent ? 'st-current' : 'st-done'
      }
    };

    /* ② 推荐下一部 */
    let recMovie = movieVM('iron-man');
    if (hasProgress && latest) {
      const r = recommend.next(latest.id, 'mainline');
      if (r && r.content) recMovie = movieVM(r.content.id);
    }
    /* CTA 文案与「点击即标记」的实际行为保持一致（避免文案与行为不符） */
    const recSeen = userState.isSeen(recMovie.id);
    const recommendCard = {
      id: recMovie.id,
      poster: recMovie.poster,
      initial: recMovie.initial,
      phase: recMovie.phase,
      tag: '推荐下一部',
      phaseLabel: recMovie.phaseText,
      name: recMovie.name,
      subInfo: recMovie.year ? ('Phase ' + recMovie.phase + ' · ' + recMovie.year) : recMovie.phaseText,
      reason: hasProgress ? '上一部留下的悬念，从这里继续' : 'MCU 的起点，一切从这里开始',
      cta: recSeen ? '取消已看' : '标记为已看'
    };

    /* ③ 最近观看（按观看时间倒序取最近 6 部） */
    const recentIds = Object.keys(watched).sort(function (a, b) { return watched[b] - watched[a]; });
    const recent = recentIds.slice(0, RECENT_MAX).map(function (id) {
      const m = mcuData.get(id);
      if (!m) return null;
      const v = mcuData.visual(id);
      return {
        id: id,
        name: m.cn,
        initial: m.cn.charAt(0),
        poster: (v && v.poster) ? v.poster : '',
        phase: m.phase || 1
      };
    }).filter(Boolean);

    /* Hero 副标题：仅保留观影进度相关统计，弱化内容库表述（审核合规调整） */
    /* 作品查询入口：为 Tab2 提供明确、可被立即理解的入口 */
    const libraryEntry = {
      title: '作品查询',
      desc: '按名称 / 类型 / 阶段 / 观看状态检索已有作品',
      statText: '全库 ' + total + ' 部 · 已看 ' + count + ' · 未看 ' + (total - count)
    };

    this.setData({
      heroBanner: heroBanner,
      heroMeta: total + ' 部作品 · 6 个阶段',
      progressPercent: progressPercent,
      progress: progress,
      recommend: recommendCard,
      recent: recent,
      libraryEntry: libraryEntry
    });
  },

  /* ---- 交互 ----
   * 2026-09-07 合规整改：按抖音《版本审核标准》第二节「类目缺失需删除对应功能」，
   * 已移除电影详情 / 观影路线 / 角色图鉴 / 角色详情 / 关系探索 / 宇宙全景图 / 浏览全部
   * 等内容资讯型页面。原指向这些页面的入口统一收敛至「我的MCU」观影记录页（Tab）。
   */

  /* 推荐/继续 → 标记已看（把「记录」主链路闭环在首页）
   * 2026-09-07：movie / route-detail 页已按审核要求移除，原跳转入口改为本地标记，
   * 复用 userState.toggle（纯本地 storage，不上云）；标记后 refresh 自动推进到下一部。 */
  goContinue(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    const seen = userState.toggle(id);
    tt.showToast({ title: seen ? '已标记为已看' : '已取消已看', icon: 'none' });
    this.refresh();
  },

  /* 最近观看 / 推荐卡海报 → 作品详情
   * 2026-09-08：作品详情（轻量版）已重建为信息查询工具页，此处恢复跳转，
   * 用户可查看作品基础信息并进行标记已看 / 收藏操作。 */
  goDetail(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    tt.navigateTo({ url: '/pages/movie/movie?id=' + id });
  },

  /* Hero 迷你旅程条 → 我的MCU（观影记录） */
  goJourney() {
    tt.switchTab({ url: '/pages/my-mcu/my-mcu' });
  },

  /* 作品查询入口 → 作品查询页（Tab2）
   * 2026-09-08 新增：首页必须有明确入口，使用户一眼理解本产品的查询能力。 */
  goLibrary() {
    tt.switchTab({ url: '/pages/library/library' });
  },

  /* 头像远程 URL 加载失败兜底（CDN/网络异常时自动降级到阵营色首字徽章，G-19） */
  onImgError(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    const map = this.data._imgErr || {};
    if (map[id]) return;
    map[id] = 1;
    this.setData({ _imgErr: map });
  }
});
