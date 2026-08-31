/* ============================================================
 * MCU 宇宙导航（小程序） - 剧集数据（Disney+ / Marvel Studios 出品）
 * ------------------------------------------------------------
 * 来源：H5 mcu-navigator/data/series.js（唯一可信源，机械适配）
 * 适配方式：window.MCU_SERIES = [ ... ] → module.exports（去 window 前缀）
 * 数据内容 100% 一致，仅改变加载方式。禁止修改数据。
 *
 * 数据口径：仅收录已正式上线、且被 Marvel 官方时间线（2026-06-02 发布）
 * 列入"Complete MCU Timeline"的 Disney+ 剧集。
 * type = 'series'；importance 取值见 data/content.js 的 IMPORTANCE。
 * ============================================================ */

module.exports = [
  {
    id: 'wandavision', cn: '旺达幻视', en: 'WandaVision',
    year: 2021, date: '2021-01-15', phase: 4, type: 'series',
    importance: 'core', episodes: '9 集', saga: 'multiverse',
    coLabel: '2023 年',
    role: '多元宇宙裂痕的起点。它直接引出《奇异博士2》与《阿加莎》，并把"西景镇幻象"钉进主线。',
    sf: '旺达在幻视死后用混沌魔法造出一个看似完美的理想小镇，却一步步揭开这份力量有多危险。',
    chars: []
  },
  {
    id: 'falcon-winter-soldier', cn: '猎鹰与冬兵', en: 'The Falcon and the Winter Soldier',
    year: 2021, date: '2021-03-19', phase: 4, type: 'series',
    importance: 'core', episodes: '6 集',
    coLabel: '2024 年',
    role: '山姆正式接任美国队长，引入约翰·沃克（美国特工）与瓦伦蒂娜，直连《美国队长4：勇敢新世界》。',
    sf: '斯蒂夫退役后，山姆与巴基追查超级士兵血清黑市，同时面对"谁配当下一任美国队长"的命题。',
    chars: []
  },
  {
    id: 'loki', cn: '洛基', en: 'Loki',
    year: 2021, date: '2021-06-09', phase: 4, type: 'series',
    importance: 'core', episodes: 'S1 6集 / S2 6集', saga: 'multiverse',
    coLabel: '2023 年',
    role: '多元宇宙故事的总开关。时间变异管理局（TVA）与"神圣时间线"的设定，是《奇异博士2》《蚁人3》《死侍3》乃至未来复仇者联盟的源头。',
    sf: '洛基盗走宇宙魔方后被 TVA 带走，卷入一场关于多元宇宙诞生与命运的抗争。',
    chars: []
  },
  {
    id: 'hawkeye', cn: '鹰眼', en: 'Hawkeye',
    year: 2021, date: '2021-11-24', phase: 4, type: 'series',
    importance: 'recommended', episodes: '6 集',
    coLabel: '2024 年',
    role: '凯特·毕肖普接棒；引出《回声》；叶莲娜与克隆体事件为后续埋线。',
    sf: '圣诞节期间，克林特在纽约遇上了崇拜自己的神射手凯特，两人一起收拾运动用品黑帮惹出的烂摊子。',
    chars: []
  },
  {
    id: 'moon-knight', cn: '月光骑士', en: 'Moon Knight',
    year: 2022, date: '2022-03-30', phase: 4, type: 'series',
    importance: 'optional', episodes: '6 集',
    coLabel: '2024 年',
    role: '引入埃及神系（孔苏 / 月神）与多重人格，基本是独立支线，对主线影响有限。',
    sf: '礼品店职员马克被月神孔苏选中成为夜晚的复仇者，却要先战胜自己体内的人格战争。',
    chars: []
  },
  {
    id: 'ms-marvel', cn: 'ms. 惊奇女士', en: 'Ms. Marvel',
    year: 2022, date: '2022-06-08', phase: 4, type: 'series',
    importance: 'recommended', episodes: '6 集',
    coLabel: '2025 年',
    role: '卡玛拉·克汗登场，直连《惊奇队长2》（与惊奇队长、莫妮卡、光子组队）。',
    sf: '新泽西少女卡玛拉觉醒异能，踏上寻找自我与家族渊源的旅程。',
    chars: []
  },
  {
    id: 'she-hulk', cn: '女浩克', en: 'She-Hulk: Attorney at Law',
    year: 2022, date: '2022-08-18', phase: 4, type: 'series',
    importance: 'optional', episodes: '9 集',
    coLabel: '2025 年',
    role: '承接班纳的 Hulk 线；黄蜂女、奇异博士、夜魔侠客串，属法律向支线。',
    sf: '詹妮弗被班纳的血意外赋予浩克之力，一边当律师一边学着与绿色一面共处。',
    chars: []
  },
  {
    id: 'secret-invasion', cn: '秘密入侵', en: 'Secret Invasion',
    year: 2023, date: '2023-06-21', phase: 5, type: 'series',
    importance: 'recommended', episodes: '6 集',
    coLabel: '2026 年',
    role: '弗瑞与斯克鲁人；承接《终局之战》后的地球秩序，引出瓦伦蒂娜与后续队伍集结。',
    sf: '弗瑞发现斯克鲁人已在地球潜伏多年并策划取代人类，一场无声入侵浮出水面。',
    chars: []
  },
  {
    id: 'echo', cn: '回声', en: 'Echo',
    year: 2024, date: '2024-01-09', phase: 5, type: 'series',
    importance: 'recommended', episodes: '5 集（Marvel Spotlight）',
    coLabel: '2025 年',
    role: '《鹰眼》衍生；金并（Kingpin）正式进入 MCU 主线，铺垫《夜魔侠：重生》。',
    sf: '聋人原住民少女玛雅在离开纽约后回到故乡，直面家族创伤与金并的阴影。',
    chars: []
  },
  {
    id: 'agatha-all-along', cn: '阿加莎', en: 'Agatha All Along',
    year: 2024, date: '2024-09-18', phase: 5, type: 'series',
    importance: 'recommended', episodes: '9 集', saga: 'multiverse',
    coLabel: '2026 年',
    role: '《旺达幻视》衍生；魔女线，连接旺达的魔法宇宙与多元宇宙。',
    sf: '失忆的阿加莎被少年比利唤醒，被迫重走女巫之路以夺回力量。',
    chars: []
  },
  {
    id: 'daredevil-born-again', cn: '夜魔侠：重生', en: 'Daredevil: Born Again',
    year: 2025, date: '2025-03-04', phase: 5, type: 'series',
    importance: 'core', episodes: 'S1 9集 / S2 进行中',
    coLabel: '2026 年',
    role: '把网飞版夜魔侠纳入 MCU 正史；金并、惩罚者回归，连接纽约街头与复仇者层级。',
    sf: '律师马特·默多克在失去一切后再次披上义警红衣，与宿敌金并在纽约街头全面开战。',
    chars: []
  },
  {
    id: 'ironheart', cn: '铁心', en: 'Ironheart',
    year: 2025, date: '2025-06-24', phase: 5, type: 'series',
    importance: 'recommended', episodes: '6 集',
    coLabel: '2026 年',
    role: '继承钢铁侠技术线；瓦坎达 / STEM 方向，连接《黑豹》后续与新一代英雄。',
    sf: '麻省理工天才蕾丝·威廉姆斯用自制战甲填补托尼留下的空白，却引出与魔法的交易。',
    chars: []
  },
  {
    id: 'wonder-man', cn: '神奇侠', en: 'Wonder Man',
    year: 2026, date: '2026-01-27', phase: 6, type: 'series',
    importance: 'optional', episodes: '8 集',
    coLabel: '2027 年',
    role: '第六阶段新英雄，指向西海岸复仇者方向。',
    sf: '好莱坞特技演员西蒙获得超能力，被卷入超级英雄产业的明暗两面。',
    chars: []
  },
  {
    id: 'what-if', cn: '假如…？', en: 'What If...?',
    year: 2021, date: '2021-08-11', phase: 4, type: 'series',
    importance: 'optional', episodes: '动画合集 S1-S3', saga: 'multiverse',
    coLabel: '多元宇宙',
    role: '多元宇宙"如果"平行宇宙合集，非正史，但用来解释多元宇宙的运作机制。',
    sf: '观察者带领观众旁观一个个偏离主线的平行宇宙。',
    chars: []
  }
];
