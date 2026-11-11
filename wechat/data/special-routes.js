/* ============================================================
 * MCU 宇宙导航（小程序） - 专题路线数据（Special Routes）
 * ------------------------------------------------------------
 * 来源：h5/data/special-routes.js（window.MCU_SPECIAL_ROUTES）
 * 转换：V1.3.0 机械转换 —— 只改导出形式与入口字段，
 *       片单 workId / 顺序 / 标题 / 文案 / label / kw 全部原样保留。
 * 页面：pages/special/special?id=avengers-doomsday
 *
 * ── 数据纪律 ──────────────────────────────────────────
 *  1. 本文件**只存引用**：作品名称一律经 models/mcuData.get(id).cn
 *     运行时解析，禁止复制作品数据、禁止硬编码作品中文名。
 *  2. label 仅用于「同 workId 多节点」区分（洛基 S1/S2），其余为 null。
 *  3. 专题上映信息采用**专题内部最小映射**（upcoming），来源
 *     h5/data/upcoming.js 的 avengers-5 条目；不修改 movies.js /
 *     shared/data / sync_data.sh，不进入三端共享同步链。
 *  4. entry 的 route 全部为小程序内部路由，mode 指定跳转方式；
 *     禁止任何 HTML 页面 / 外链 / H5 地址。
 *  5. 本文件为端内独立专题数据，**不扩展 routes.js**，
 *     不影响原有 11 条路线与 6 条专题路线的片单。
 * ============================================================ */

module.exports = [
  {
    id: 'avengers-doomsday',
    upcomingId: 'avengers-5',

    title: '复联5补课路线',
    tagline: '从《终局之战》之后，快速补到《毁灭之日》',
    heroNote: '8 部 = 最短路线 · 15 部 = 完整理解路线',

    /* 产品决策：专题明确标注为独立整理的建议路线 */
    disclaimer: '本专题为 MCU Atlas 独立整理的建议路线，非官方指定片单。',

    /* 专题内部上映信息最小映射（来源：h5/data/upcoming.js avengers-5） */
    upcoming: {
      id: 'avengers-5',
      title: '复仇者联盟5：毁灭之日',
      en: 'Avengers: Doomsday',
      date: '2026-12-18'
    },

    /* 起点条：已看完的那部作品（不编号、不计入进度、不可点击） */
    origin: { workId: 'endgame', kw: '时间线起点' },

    /* ── 核心路线 8 部（顺序与 H5 逐字一致） ── */
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

    /* ── 完整路线 15 部（顺序与 H5 逐字一致；默认折叠） ── */
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

    /* ── 「为什么要补」五段链（4 环主题线索 + 终点金卡） ── */
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

    /* ── 底部入口：小程序内部路由（首页 / 路线 / 全景时间线） ── */
    entry: {
      title: '还想继续探索 MCU？',
      primary: {
        text: '进入 MCU 宇宙导航',
        route: '/pages/home/home',
        mode: 'switchTab'
      },
      links: [
        { text: '查看全部观影路线 →', route: '/pages/routes/routes', mode: 'switchTab' },
        { text: '探索 MCU 宇宙地图 →', route: '/pages/panorama/panorama', mode: 'navigateTo' }
      ]
    }
  }
];
