/* ============================================================
 * G4 · 事件指纹 / 合并引擎 测试夹具
 * ------------------------------------------------------------
 * 覆盖任务要求的 E1–E6，另加 E7–E15 补充用例。
 * ★ 全部为合成输入；另在测试脚本中单独用**真实 15 条 news.js** 做集成跑（只读）。
 * ★ 本文件不修改任何生产数据。
 * ============================================================ */
'use strict';

function mk(over) {
  return Object.assign({
    id: 'X',
    title: '',
    summary: '',
    category: 'movie',
    related_movies: [],
    related_series: [],
    related_characters: [],
    publish_time: '2026-09-22',
    first_seen_at: '2026-09-22T00:00:00Z'
  }, over || {});
}

/* ---------------- E1 同事件不同标题 → 同 key ---------------- */

const E1 = {
  id: 'E1',
  desc: '同事件不同标题 → 同 event_key',
  sub: [
    {
      id: 'E1a',
      desc: '同一作品的同一事件，措辞不同（公布 / 发布）+ 模板词差异（首支 / 正式）',
      a: mk({ id: 'E1a-1', title: 'Marvel 官方公布《复仇者联盟5：毁灭之日》首支正式预告', related_movies: ['avengers-5'] }),
      b: mk({ id: 'E1a-2', title: '《复仇者联盟5：毁灭之日》首支预告正式发布', related_movies: ['avengers-5'] }),
      expectSameKey: true
    },
    {
      id: 'E1b',
      desc: '同一事件，一方带媒体模板词（【独家】）与状态词（已）',
      a: mk({ id: 'E1b-1', title: '【独家】《蜘蛛侠：崭新之日》续集已进入早期开发', related_movies: ['brand-new-day'] }),
      b: mk({ id: 'E1b-2', title: '蜘蛛侠崭新之日续集进入早期开发', related_movies: ['brand-new-day'] }),
      expectSameKey: true
    },
    {
      id: 'E1c',
      desc: '无关联实体（文本模式），一方带状态措辞（有消息称 / 将）',
      a: mk({ id: 'E1c-1', title: '有消息称《神奇侠》将引入新的常驻角色', category: 'series', related_series: [] }),
      b: mk({ id: 'E1c-2', title: '《神奇侠》引入新的常驻角色', category: 'series', related_series: [] }),
      expectSameKey: true
    }
  ]
};

/* ---------------- E2 同标题不同事件 → 不同 key ---------------- */

const E2 = {
  id: 'E2',
  desc: '同标题不同事件 → 不同 event_key（或同 key 但判定为 hold）',
  sub: [
    {
      id: 'E2a',
      desc: '标题完全相同，但关联的作品不同 → 不同 key',
      a: mk({ id: 'E2a-1', title: '第三季制作计划公布', category: 'series', related_series: ['loki'] }),
      b: mk({ id: 'E2a-2', title: '第三季制作计划公布', category: 'series', related_series: ['daredevil-born-again'] }),
      expectSameKey: false
    },
    {
      id: 'E2b',
      desc: '标题与实体完全相同，但时间相距很远 → 同 key，但 merger 必须判 hold（不自动合并）',
      a: mk({ id: 'E2b-1', title: '复仇者联盟5毁灭之日预告发布', related_movies: ['avengers-5'], publish_time: '2026-09-20' }),
      b: mk({ id: 'E2b-2', title: '复仇者联盟5毁灭之日预告发布', related_movies: ['avengers-5'], publish_time: '2026-07-01' }),
      expectSameKey: true,
      expectMergerDecision: 'hold',
      expectHoldReason: 'out_of_window'
    }
  ]
};

/* ---------------- E3 不同作品 → 不同 key ---------------- */

const E3 = {
  id: 'E3',
  desc: '不同作品 / 不同 category → 不同 event_key',
  sub: [
    {
      id: 'E3a',
      desc: '标题同构，作品不同',
      a: mk({ id: 'E3a-1', title: '续集正式立项', related_movies: ['thunderbolts'] }),
      b: mk({ id: 'E3b-1', title: '续集正式立项', related_movies: ['fantastic-four'] }),
      expectSameKey: false
    },
    {
      id: 'E3b',
      desc: '无实体时，category 不同 → 不同 key',
      a: mk({ id: 'E3b-x', title: '最新预告片公开', category: 'movie', related_movies: [] }),
      b: mk({ id: 'E3b-y', title: '最新预告片公开', category: 'series', related_series: [] }),
      expectSameKey: false
    }
  ]
};

/* ---------------- E4 日期不同 → 可识别同事件 ---------------- */

const E4 = {
  id: 'E4',
  desc: 'publish_time 不同不影响 event_key；同日/近邻日必须可识别为同一事件',
  sub: [
    {
      id: 'E4a',
      desc: '同一事件，publish_time 相差 1 天 → 同 key，且 merger 判 merge',
      a: mk({ id: 'E4a-1', title: '《夜魔侠：重生》第三季完结消息', related_series: ['daredevil-born-again'], category: 'series', publish_time: '2026-09-21' }),
      b: mk({ id: 'E4a-2', title: '《夜魔侠：重生》第三季完结消息', related_series: ['daredevil-born-again'], category: 'series', publish_time: '2026-09-22' }),
      expectSameKey: true,
      expectMergerDecision: 'merge'
    },
    {
      id: 'E4b',
      desc: '同一条数据仅改 publish_time（相差 300 天）→ key 完全不变',
      base: mk({ id: 'E4b', title: '《钢铁心》第二季档期消息', category: 'series', related_series: ['ironheart'], publish_time: '2026-01-01' }),
      altTime: '2027-01-01'
    }
  ]
};

/* ---------------- E5 空关联 → 不崩溃 ---------------- */

const E5 = {
  id: 'E5',
  desc: '关联字段缺失 / 空 / 非法类型 → 不抛错，返回合法 key',
  cases: [
    { id: 'E5a', desc: '完全不含关联字段', item: { title: '测试标题', category: 'movie' } },
    { id: 'E5b', desc: '关联字段为 null', item: mk({ id: 'E5b', title: '测试标题', related_movies: null, related_series: null, related_characters: null }) },
    { id: 'E5c', desc: '关联字段为空数组', item: mk({ id: 'E5c', title: '测试标题', related_movies: [], related_series: [], related_characters: [] }) },
    { id: 'E5d', desc: '关联数组含 null / 空白 / 非字符串元素', item: mk({ id: 'E5d', title: '测试标题', related_movies: [null, '  ', 123, 'Iron-Man'], related_characters: [undefined, 'tOnY'] }) },
    { id: 'E5e', desc: '关联字段类型错误（字符串而非数组）', item: mk({ id: 'E5e', title: '测试标题', related_movies: 'avengers-5' }) },
    { id: 'E5f', desc: '整个输入为空对象', item: {} },
    { id: 'E5g', desc: '输入为 null', item: null }
  ]
};

/* ---------------- E6 边界标题 ---------------- */

const E6 = {
  id: 'E6',
  desc: '边界标题 → 不抛错，返回合法 key',
  cases: [
    { id: 'E6a', desc: '空字符串', title: '' },
    { id: 'E6b', desc: 'null 标题', title: null },
    { id: 'E6c', desc: 'undefined 标题', title: undefined },
    { id: 'E6d', desc: '纯中文标点', title: '！！！？？？……——' },
    { id: 'E6e', desc: '纯英文标点与符号', title: '!!! ??? --- *** ~~~' },
    { id: 'E6f', desc: '全角字符 + 全角空格', title: 'ＭＡＲＶＥＬ　预告　确认' },
    { id: 'E6g', desc: '仅日期', title: '2026-09-22' },
    { id: 'E6h', desc: '仅媒体模板词与状态词', title: '【独家】官方正式确认' },
    { id: 'E6i', desc: '含 emoji 与符号', title: '🔥🔥 复仇者联盟5 预告 🎬【重磅】' },
    { id: 'E6j', desc: '超长标题（约 3000 字）', title: '复仇者联盟毁灭之日预告发布'.repeat(180) },
    { id: 'E6k', desc: '纯数字与空格', title: '12345 67890' },
    { id: 'E6l', desc: '中英混排 + 日期 + 括号', title: 'Avengers: Doomsday (2026年12月18日) 首支 Teaser Trailer【独家】' }
  ]
};

/* ---------------- E7–E15 补充用例 ---------------- */

const EXTRA = {
  id: 'E7-15',
  desc: '补充用例',
  items: [
    /* E7 确定性 */
    { id: 'E7', desc: '确定性：同输入两次调用返回同一 key（测试脚本断言）' },

    /* E8 证明「不是 title hash」 */
    {
      id: 'E8',
      desc: '★ 证明不是 title hash：不同 title、相同实体与相同动作词 → 同 key（若为 title hash 必不同）',
      a: mk({ id: 'E8-1', title: '甲媒体报道：复仇者联盟5毁灭之日预告公开', related_movies: ['avengers-5'] }),
      b: mk({ id: 'E8-2', title: '乙媒体：复仇者联盟5毁灭之日预告发布', related_movies: ['avengers-5'] })
    },

    /* E12 缺时间 → hold */
    {
      id: 'E12',
      desc: '缺时间（publish_time 与 first_seen_at 均无效）→ 同 key 但判 hold（missing_time）',
      a: mk({ id: 'E12-1', title: '复仇者联盟5毁灭之日预告发布', related_movies: ['avengers-5'], publish_time: '', first_seen_at: '' }),
      b: mk({ id: 'E12-2', title: '复仇者联盟5毁灭之日预告发布', related_movies: ['avengers-5'], publish_time: '2026-09-22' })
    },

    /* E13 动作词参与 */
    {
      id: 'E13',
      desc: '同一作品、不同动作 → 不同 key（定档 vs 改档）',
      a: mk({ id: 'E13-1', title: '复仇者联盟5毁灭之日定档', related_movies: ['avengers-5'] }),
      b: mk({ id: 'E13-2', title: '复仇者联盟5毁灭之日改档', related_movies: ['avengers-5'] })
    },

    /* E14 状态词不影响 key（R8.8：事件身份跨状态稳定） */
    {
      id: 'E14',
      desc: '★ 状态词不参与 key：官方确认版 与 传闻版（同实体同动作）→ 同 key',
      a: mk({ id: 'E14-1', title: 'Marvel 官方确认《雷霆特攻队*》续集进入开发', related_movies: ['thunderbolts'] }),
      b: mk({ id: 'E14-2', title: '网传《雷霆特攻队*》续集可能将进入开发', related_movies: ['thunderbolts'] })
    }
  ]
};

module.exports = { mk, E1, E2, E3, E4, E5, E6, EXTRA };
