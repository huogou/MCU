/* ============================================================
 * MCU 宇宙导航（小程序） - 观影路线
 * ------------------------------------------------------------
 * 来源：H5 mcu-navigator/data/routes.js（唯一可信源，机械适配）
 * 适配方式：window.MCU_ROUTES = [ ... ] → module.exports（去 window 前缀）
 * 数据内容 100% 一致，仅改变加载方式。禁止修改数据。
 *
 * 路线分三类：
 *   basic   基础观看逻辑（新手 / 上映顺序 / 时间线 / 精简主线）
 *   topic   专题路线（跟着某个角色或某条故事线走）
 *
 * items 为空数组时，由 models/mcuData.js expandRoute 按 generator 字段自动生成：
 *   release    按上映顺序排全部 MCU 内容（电影+剧集+特别呈现+短片）
 *   chrono     按故事时间线排全部 MCU 内容
 *   mainline   只取 importance=core（必看）的内容，按上映顺序
 *   essential  只取 importance 为 core 或 recommended（必看+推荐）的内容
 * 手写 items 的路线优先使用手写顺序。
 * ============================================================ */

module.exports = [
  {
    id: 'newcomer', kind: 'basic', name: '新手入坑',
    tagline: '第一次看漫威，就照这个来',
    forWho: '完全没看过 MCU，或者只零散看过一两部',
    desc: '这条路线砍掉了所有支线和补完性质的作品，只留下最能建立世界观、且单独拿出来也好看的十二部。看完它你就完整经历了无限传奇，也具备了自由探索其他分支的基础。',
    why: '不按上映顺序全看，是因为全部 MCU 内容对新人来说门槛太高，中途弃剧的风险远大于"错过细节"的损失。先把主干立住，枝叶随时可以回头补。',
    generator: null,
    items: [
      'iron-man', 'captain-america-first-avenger', 'thor', 'avengers',
      'winter-soldier', 'guardians', 'age-of-ultron', 'civil-war',
      'thor-ragnarok', 'black-panther', 'infinity-war', 'endgame'
    ]
  },
  {
    id: 'release', kind: 'basic', name: '上映顺序',
    tagline: '和当年的观众用同一种节奏',
    forWho: '想完整体验 MCU 十八年来的原始观影感受',
    desc: '严格按北美上映日期排列的全部 MCU 内容——院线电影、Disney+ 剧集、特别呈现与短片混排在同一根时间轴上。这是漫威创作时预设的顺序，彩蛋与反转都照这个节奏设计。',
    why: '按上映顺序看，你会和当年的观众一样，先被彩蛋吊足胃口，再等到几年后兑现。这种"埋线—回收"的爽感是时间线顺序给不了的。',
    generator: 'release', items: []
  },
  {
    id: 'chrono', kind: 'basic', name: 'MCU 时间线',
    tagline: '按故事真正发生的先后顺序',
    forWho: '已经刷过一遍，想从世界观角度重新理一次',
    desc: '按 MCU 内部故事发生的时间排序，从 1943 年的二战一直到《崭新之日》。',
    why: '这条路线更适合二刷。第一次看就用时间线，会提前知道很多本该在后面才揭晓的事，反转的效果会被大幅削弱。',
    note: '时间线顺序基于社区通行的梳理，个别作品（如《永恒族》《死侍与金刚狼》）的准确定位在影迷中仍有争议，此处采用相对主流的排法。',
    generator: 'chrono', items: []
  },
  {
    id: 'essential', kind: 'basic', name: '精简主线',
    tagline: '不想全看，只想搞懂主线剧情',
    forWho: '时间有限，只想弄明白这个宇宙到底在讲什么',
    desc: '只保留对整体剧情有实质推动的「必看」内容。跳过的部分基本都是角色个人篇章或补完性前传，不看不影响你理解主线走向。',
    why: 'MCU 的内容并不是每部都在推进同一个故事。有相当一部分是在扩充世界观边界或给单个角色补背景，对主线是可选项。这条路线把可选项全部摘掉。',
    generator: 'mainline', items: []
  },

  {
    id: 'recommended', kind: 'basic', name: '推荐完整',
    tagline: '必看 + 推荐，主线不漏、关键支线也补齐',
    forWho: '想看懂主线，又不愿错过多元宇宙等关键的剧集支线',
    desc: '在「必看」基础上，补入所有被标记为「推荐」的内容——包括《洛基》《旺达幻视》《猎鹰与冬兵》《夜魔侠：重生》等支撑多元宇宙与新阶段的关键剧集。看完这条，你对当前 MCU 的骨架与枝叶都有概念。',
    why: '「精简主线」只给骨架，会把《洛基》这种"多元宇宙总开关"也摘掉。但《洛基》偏偏是理解后续一切的前提，所以单独留一条把必看与推荐一并收下的路线。',
    generator: 'essential', items: []
  },

  {
    id: 'spiderman', kind: 'topic', name: '蜘蛛侠路线',
    tagline: '只想看懂蜘蛛侠，需要补哪几部',
    forWho: '因为《崭新之日》入坑，想快速补上前情',
    desc: '从彼得·帕克进入 MCU 之前的必要背景开始，一路到最新的《崭新之日》。',
    why: '蜘蛛侠在 MCU 里不是独立英雄，他的故事完全建立在与托尼·斯塔克的师徒关系之上。所以这条路线必须从《钢铁侠》和《内战》开始——否则你会看不懂他为什么一直在追一个已经不在的人的认可。',
    generator: null,
    items: [
      'iron-man', 'avengers', 'civil-war', 'spider-man-homecoming',
      'infinity-war', 'endgame', 'far-from-home', 'no-way-home', 'brand-new-day'
    ]
  },
  {
    id: 'avengers-line', kind: 'topic', name: '复仇者联盟路线',
    tagline: '这支队伍是怎么聚起来又散掉的',
    forWho: '只关心复联四部曲，想补齐必要前置',
    desc: '围绕复仇者联盟这支队伍的组建、分裂、溃败与重聚，覆盖四部复联正传及其必要前置。',
    why: '复联四部曲单独看是断裂的。队伍为什么会散、托尼和美队为什么翻脸、灭霸为什么能赢，答案都不在复联电影本身，而在《冬日战士》和《内战》这两部美队独立片里。',
    generator: null,
    items: [
      'iron-man', 'thor', 'captain-america-first-avenger', 'avengers',
      'winter-soldier', 'guardians', 'age-of-ultron', 'civil-war',
      'thor-ragnarok', 'infinity-war', 'endgame'
    ]
  },
  {
    id: 'ironman-line', kind: 'topic', name: '钢铁侠路线',
    tagline: '托尼·斯塔克的完整弧线',
    forWho: '想完整跟完 MCU 第一个主角的十一年',
    desc: '从一个军火商到最后那个选择，托尼·斯塔克的全部关键节点。',
    why: '托尼是 MCU 弧线最完整的角色。他的每一次转变都有明确的前因：纽约之战给了他创伤，创伤造出了奥创，奥创造成了内战，内战导致了分裂，分裂让灭霸得手。这是一条严密的因果链。',
    generator: null,
    items: [
      'iron-man', 'iron-man-2', 'avengers', 'iron-man-3',
      'age-of-ultron', 'civil-war', 'spider-man-homecoming', 'infinity-war', 'endgame'
    ]
  },
  {
    id: 'captain-line', kind: 'topic', name: '美国队长路线',
    tagline: '从二战到盾牌交接',
    forWho: '想跟完盾牌从史蒂夫传到山姆的全过程',
    desc: '横跨八十多年故事时间的一条线，也是 MCU 里少数完整讲完"传承"的主题。',
    why: '美队线的独特之处在于它有两个主角。前半段是史蒂夫·罗杰斯从二战到退场，后半段是山姆·威尔逊接过盾牌之后如何证明自己配得上。中间的《冬日战士》是两段的枢纽。',
    generator: null,
    items: [
      'captain-america-first-avenger', 'avengers', 'winter-soldier',
      'age-of-ultron', 'civil-war', 'infinity-war', 'endgame', 'brave-new-world'
    ]
  },
  {
    id: 'multiverse-line', kind: 'topic', name: '多元宇宙路线',
    tagline: '多元宇宙到底是怎么开的',
    forWho: '想搞懂现在 MCU 在讲什么，为《复联5》做准备',
    desc: '从时间宝石到平行宇宙汇合，MCU 第二个大时代的完整脉络。',
    why: '多元宇宙不是突然出现的概念，它有明确的开门顺序：奇异博士带来魔法与时间，《终局之战》的时间旅行制造了分支，《英雄无归》的咒语撕开了口子，之后的每一部都在扩大这道口子。',
    note: '多元宇宙的关键剧集《洛基》《旺达幻视》已纳入全站内容，可在「推荐完整 / 全部 MCU」视图或宇宙地图中查看；本路线聚焦院线电影主线。',
    generator: null,
    items: [
      'doctor-strange', 'endgame', 'no-way-home', 'multiverse-of-madness',
      'quantumania', 'deadpool-wolverine', 'fantastic-four', 'brand-new-day'
    ]
  },
  {
    id: 'infinity-stones', kind: 'topic', name: '无限宝石路线',
    tagline: '六颗宝石分别在哪部出现',
    forWho: '想把六颗宝石的来龙去脉理清楚',
    desc: '按宝石首次现身的顺序排列，看完你会知道每一颗从哪来、经过谁的手、最后去了哪。',
    why: '无限宝石是无限传奇最核心的线索，但它们的登场极度分散，横跨十年、六部电影。集中看这一条线，你会发现漫威早在 2011 年就已经在铺 2018 年的局。',
    generator: null,
    items: [
      'captain-america-first-avenger', 'thor-dark-world', 'guardians',
      'avengers', 'age-of-ultron', 'doctor-strange', 'infinity-war', 'endgame'
    ]
  }
];
