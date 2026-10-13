/* ============================================================
 * MCU 宇宙导航 - 专题路线数据（Special Routes）
 * ------------------------------------------------------------
 * 用途：社交流量落地页专题（当前仅「复联5补课路线」）。
 * 页面：h5/special.html  →  /special?id=avengers-doomsday
 * 规格：docs/同步/复联5补课路线专题-H5-设计AI正式规格-V1.md
 *
 * ── 数据纪律（三条硬约束）──────────────────────────────
 *  1. 本文件**只存引用**：作品名称一律运行时经
 *     MCU.data.get(workId).cn 读取，**禁止在此复制作品数据**。
 *  2. label 仅用于「同 id 多节点」的区分（当前只有洛基 S1/S2），
 *     其余节点 label 一律留 null，**禁止二次命名作品**。
 *  3. 上映日期 / 英文片名 / 复联5 中文片名一律取自
 *     MCU_UPCOMING[upcomingId]，**禁止硬编码**。
 *
 * ── 为什么不放进 routes.js ─────────────────────────────
 *  routes.js 是三端单一数据源（经 sync_data.sh 同步到微信/抖音），
 *  新增会同时改变小程序 routes / route-detail 页面；且现有 schema
 *  无 kw / 无「核心 + 完整」双路线分组。本专题为 H5 独立专题页，
 *  故走独立文件，**不改 routes.js / movies.js / series.js / shared/data**。
 *
 * 字段说明：
 *   id           专题 id，与 URL ?id= 同命名空间
 *   upcomingId   MCU_UPCOMING 中的条目 id（Hero 日期 / 英文名 / 中文片名来源）
 *   title        页面主标题（专题名，非作品名）
 *   tagline      副标题
 *   heroNote     Hero 双 CTA 下方的辅助说明
 *   origin       起点条：已看完的那部作品（不编号、不计入进度、不可点击）
 *   core         核心路线（默认展开）
 *   full         完整路线（默认折叠）；为 null 时该区块**整体不渲染**
 *   chain        「为什么要补」五段链（前 4 环文案 + 末环金色卡说明）
 *   entry        底部入口区
 * ============================================================ */

window.MCU_SPECIAL_ROUTES = [
  {
    id: 'avengers-doomsday',
    upcomingId: 'avengers-5',

    title: '复联5补课路线',
    tagline: '从《终局之战》之后，快速补到《毁灭之日》',
    heroNote: '8 部 = 最短路线 · 15 部 = 完整理解路线',

    /* 起点条：你在社交平台刷完《复联4》重映之后的「已看完」位置 */
    origin: { workId: 'endgame', kw: '时间线起点' },

    /* ── 核心路线 8 部（顺序依设计规格 figB / 6.3） ── */
    core: {
      title: '核心补课路线 · 8部',
      items: [
        { workId: 'loki',                  label: '洛基 S1', kw: 'TVA / 时间线' },
        { workId: 'loki',                  label: '洛基 S2', kw: '多元宇宙正式开启' },
        { workId: 'multiverse-of-madness', label: null,     kw: '宇宙碰撞' },
        { workId: 'no-way-home',           label: null,     kw: '多元宇宙暴露于人' },
        { workId: 'deadpool-wolverine',    label: null,     kw: '穿越者入局' },
        { workId: 'brave-new-world',       label: null,     kw: '新世界秩序' },
        { workId: 'thunderbolts',          label: null,     kw: '反英雄集结' },
        { workId: 'fantastic-four',        label: null,     kw: '入口开启' }
      ]
    },

    /* ── 完整路线 15 部（顺序依设计规格 6.3 逐字；默认折叠） ── */
    full: {
      title: '完整补课路线 · 15部',
      desc: '想把人物、多元宇宙与新一代英雄线索补得更完整，可以继续这条路线。（MCU Atlas 整理路线，非官方指定片单）',
      items: [
        { workId: 'loki',                  label: '洛基 S1' },
        { workId: 'loki',                  label: '洛基 S2' },
        { workId: 'wandavision',           label: null },
        { workId: 'multiverse-of-madness', label: null },
        { workId: 'no-way-home',           label: null },
        { workId: 'quantumania',           label: null },
        { workId: 'deadpool-wolverine',    label: null },
        { workId: 'falcon-winter-soldier', label: null },
        { workId: 'brave-new-world',       label: null },
        { workId: 'hawkeye',               label: null },
        { workId: 'thunderbolts',          label: null },
        { workId: 'ironheart',             label: null },
        { workId: 'fantastic-four',        label: null },
        { workId: 'daredevil-born-again',  label: null },
        { workId: 'what-if',               label: null }
      ]
    },

    /* ── 「为什么要补」五段链 ──
       前 4 环文案在此；第 5 环（Doomsday 金色卡）的标题运行时取自
       upcoming.en，**不落库**，避免二次命名与硬编码。 */
    chain: {
      title: '为什么要补',
      items: [
        { t: '时间线',     d: '终局之战后，时间向前跳了数年，新阶段都在战后世界展开。' },
        { t: '多元宇宙',   d: '洛基与奇异博士，把「平行宇宙」从设定变成了主线。' },
        { t: '跨宇宙角色', d: '死侍、金刚狼、神奇四侠来自其他宇宙，只有多元宇宙接得住他们。' },
        { t: '新一代英雄', d: '山姆接盾、雷霆特攻队集结，他们是新阶段的主要战力。' }
      ],
      end: { d: '三条线汇合到毁灭博士，前面补的每一环都在这里收束。' }
    },

    /* ── 底部入口 ── */
    entry: {
      title: '还想继续探索 MCU？',
      primary: { text: '进入 MCU 宇宙导航', href: 'index.html' },
      links: [
        { text: '查看全部观影路线 →', href: 'routes.html' },
        { text: '探索 MCU 宇宙地图 →', href: 'map.html' }
      ]
    }
  }
];