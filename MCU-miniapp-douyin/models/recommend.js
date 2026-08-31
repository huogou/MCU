/* ============================================================
 * MCU 宇宙导航（小程序） - 下一部推荐（recommend）
 * ------------------------------------------------------------
 * 来源：H5 mcu-navigator/assets/js/app.js 的 MCU.rec（唯一可信源，机械适配）
 * 职责：基于 RELATIONS 的 ro 顺序 + prereqOf，恢复三种模式的下一部推荐。
 * 推荐结果必须同时返回 content 与 movie（movie 保留作向后兼容别名），
 * 每种都必须给出「为什么」，没有理由的推荐视为无效。
 * 本阶段不优化算法，仅恢复原逻辑。
 * ============================================================ */

const mcuData = require('./mcuData.js');
const userState = require('./userState.js');
const { REL_TYPES } = require('../data/relations.js');

const MODES = {
  mainline: { label: '只想看主线', desc: '跳过支线，用最短路径把故事看完' },
  understand: { label: '想完整看懂', desc: '补上理解剧情必需的前置作品' },
  complete: { label: '想按顺序全看', desc: '严格按上映顺序，一部不落' }
};

function _result(content, why, fallback) {
  return { content: content, movie: content, why: why, fallback: fallback };
}

const rec = {
  modes: MODES,

  /**
   * 计算某内容在某种模式下的下一部推荐
   * @returns {{content: Object, movie: Object, why: String, fallback: Boolean}|null}
   */
  next: function (fromId, mode) {
    const m = mcuData.get(fromId);
    if (!m) return null;

    /* 优先使用数据里手写的推荐，理由质量最高 */
    if (m.next && m.next[mode]) {
      const picked = mcuData.get(m.next[mode].id);
      if (picked) return _result(picked, m.next[mode].why, false);
    }

    if (mode === 'complete') return this._complete(m);
    if (mode === 'mainline') return this._mainline(m);
    return this._understand(m);
  },

  /* 上映顺序的下一部 */
  _complete: function (m) {
    const byRelease = mcuData.byRelease;
    const nx = byRelease[m.ro];
    if (!nx) return null;
    return _result(nx,
      '按上映顺序，《' + m.cn + '》之后上映的就是它（' + nx.date + '）。'
      + '照这个顺序看，你会和当年的观众一样，按漫威设计的节奏依次接收到每一个伏笔和反转。',
      true);
  },

  /* 之后的第一部「核心」内容 */
  _mainline: function (m) {
    const byRelease = mcuData.byRelease;
    for (let i = m.ro; i < byRelease.length; i++) {
      if (byRelease[i].importance === 'core' || byRelease[i].mainline) {
        const nx = byRelease[i];
        const skipped = i - m.ro;
        let why = '《' + nx.cn + '》是《' + m.cn + '》之后第一部推动整体剧情的作品。';
        if (skipped > 0) {
          why += '中间跳过的 ' + skipped + ' 部属于角色个人篇章或补完性前传，'
               + '不看不会影响你理解主线走向。';
        }
        why += nx.role ? '它的作用是：' + nx.role : '';
        return _result(nx, why, true);
      }
    }
    return null;
  },

  /* 关系最强的、你还没看过的关联作品 */
  _understand: function (m) {
    const links = mcuData.relationsOf(m.id);
    const seen = userState.getState().watched;
    let best = null, bestScore = -1;

    links.forEach(function (l) {
      const o = mcuData.get(l.other);
      if (!o) return;
      let score = l.weight * 10;
      if (l.type === 'prereq') score += 8;
      if (l.type === 'sequel') score += 6;
      if (seen[o.id]) score -= 30;          /* 看过的降权 */
      if (o.ro < m.ro) score += 2;          /* 前置作品略微优先 */
      if (o.type !== m.type) score += 1;    /* 跨类型关联优先提示（剧集/电影互补） */
      if (score > bestScore) { bestScore = score; best = { link: l, content: o }; }
    });

    if (!best) return this._complete(m);
    const tName = (REL_TYPES[best.link.type] || {}).label || '关联';
    return _result(best.content,
      '这两部作品之间是「' + tName + '」关系。' + best.link.why,
      true);
  },

  /**
   * 某内容的前置作品（看之前建议先看什么）
   */
  prereqOf: function (id) {
    const m = mcuData.get(id); if (!m) return [];
    return mcuData.relationsOf(id).filter(function (l) {
      const c = mcuData.get(l.other);
      return c && c.ro < m.ro && (l.type === 'prereq' || l.type === 'sequel' || l.weight === 3);
    });
  },

  /**
   * 某内容的后续作品（看完之后建议看什么）
   */
  followOf: function (id) {
    const m = mcuData.get(id); if (!m) return [];
    return mcuData.relationsOf(id).filter(function (l) {
      const c = mcuData.get(l.other);
      return c && c.ro > m.ro;
    });
  }
};

module.exports = rec;
