/* ============================================================
 * MCU 宇宙导航 - 电影主数据
 * ------------------------------------------------------------
 * 数据口径：本文件仅收录 MCU 院线电影（38 部），不含 Disney+ 剧集/特别呈现/短片。
 * 截至 2026-08，已上映院线电影共 38 部
 * （《钢铁侠》2008-05-02 → 《蜘蛛侠：崭新之日》2026-07-31）。
 * 全量 59 个 MCU 内容（电影+剧集+特别呈现+短片）由 content.js 统一合成，请勿在此冗余。
 *
 * 为什么用 .js 而不是 .json：
 *   本项目要求「双击 index.html 即可运行」。浏览器在 file:// 协议下
 *   会拦截 fetch() 读取本地 JSON，因此数据以全局变量形式挂载。
 *   后续接入服务端或小程序时，把 window.MCU_MOVIES = 去掉即为标准 JSON。
 *
 * 字段说明：
 *   id       唯一标识，同时用作 URL 参数与关系表外键
 *   cn/en    中英片名
 *   date     北美上映日期
 *   phase    所属阶段 1-6
 *   saga     infinity（无限传奇）| multiverse（多元宇宙传奇）
 *   ro       上映顺序序号 1-38
 *   co       故事时间线顺序序号 1-38
 *   coLabel  故事发生的大致年份（展示用）
 *   mainline 是否核心主线（精简主线路线的筛选依据）
 *   starter  是否适合新手第一部接触
 *   role     它在 MCU 中承担什么作用（回答"这部电影的意义"）
 *   sf       无剧透简介（剧透等级 = 无剧透 时展示）
 *   chars    出场重点角色 id
 *   next     手写的下一部推荐；未写的由 app.js 自动兜底
 * ============================================================ */

window.MCU_MOVIES = [
  {
    id: 'iron-man', cn: '钢铁侠', en: 'Iron Man',
    year: 2008, date: '2008-05-02', phase: 1, saga: 'infinity',
    ro: 1, co: 3, coLabel: '2010 年',
    mainline: true, starter: true,
    role: '整个 MCU 的起点。它确立了这个宇宙的基调，也埋下了后来十年所有故事的第一颗种子。',
    sf: '军火商托尼·斯塔克在一次绑架中造出第一套动力装甲，从此走上英雄之路。',
    chars: ['tony', 'fury'],
    next: {
      mainline: { id: 'avengers', why: '钢铁侠片尾彩蛋里尼克·弗瑞第一次提到"复仇者计划"，这条线的正式兑现就是《复仇者联盟》。中间几部是分头介绍角色，赶时间可以先跳。' },
      understand: { id: 'captain-america-first-avenger', why: '想真正看懂 MCU 的世界观，需要知道钢铁侠的父亲霍华德·斯塔克在二战时期做了什么——那是宇宙魔方和美国队长故事的开端，也解释了托尼后来的很多行为动机。' }
    }
  },
  {
    id: 'incredible-hulk', cn: '无敌浩克', en: 'The Incredible Hulk',
    year: 2008, date: '2008-06-13', phase: 1, saga: 'infinity',
    ro: 2, co: 4, coLabel: '2011 年',
    mainline: false, starter: false,
    role: 'MCU 最游离的一部。它交代了浩克的来历，但主演后来更换，剧情影响也有限，属于可跳过作品。',
    sf: '布鲁斯·班纳因实验事故变成绿巨人，一边躲避军方追捕，一边寻找解药。',
    chars: ['banner'],
    next: {
      mainline: { id: 'avengers', why: '这部的剧情对主线影响很小，唯一重要的是片尾托尼·斯塔克出场——那句对话直接指向《复仇者联盟》的组队。' }
    }
  },
  {
    id: 'iron-man-2', cn: '钢铁侠2', en: 'Iron Man 2',
    year: 2010, date: '2010-05-07', phase: 1, saga: 'infinity',
    ro: 3, co: 5, coLabel: '2011 年',
    mainline: false, starter: false,
    role: '承上启下的过渡作。它正式把黑寡妇和神盾局推到台前，为组队做人员铺垫。',
    sf: '托尼身体状况恶化，同时要应对一个同样掌握方舟反应堆技术的复仇者。',
    chars: ['tony', 'natasha', 'fury'],
    next: {
      mainline: { id: 'avengers', why: '黑寡妇和神盾局在这部登场，人齐了就该组队。' }
    }
  },
  {
    id: 'thor', cn: '雷神', en: 'Thor',
    year: 2011, date: '2011-05-06', phase: 1, saga: 'infinity',
    ro: 4, co: 6, coLabel: '2011 年',
    mainline: true, starter: false,
    role: '把 MCU 从"地球科技"拓展到"九界神话"。洛基这个贯穿全宇宙的角色从这里开始。',
    sf: '阿斯加德王子索尔因傲慢被放逐地球，必须重新证明自己配得上雷神之锤。',
    chars: ['thor', 'loki'],
    next: {
      mainline: { id: 'avengers', why: '《雷神》结尾洛基坠入虚空，而《复仇者联盟》的反派正是他。不看这部，你不会明白洛基为什么恨索尔、又为什么要打地球。' }
    }
  },
  {
    id: 'captain-america-first-avenger', cn: '美国队长：复仇者先锋', en: 'Captain America: The First Avenger',
    year: 2011, date: '2011-07-22', phase: 1, saga: 'infinity',
    ro: 5, co: 1, coLabel: '1943–1945 年',
    mainline: true, starter: false,
    role: 'MCU 故事时间线上最早的一部。宇宙魔方、九头蛇、霍华德·斯塔克这三条影响深远的线索都从这里发源。',
    sf: '二战期间，体弱的史蒂夫·罗杰斯接受超级士兵血清改造，成为美国队长对抗九头蛇。',
    chars: ['steve', 'bucky'],
    next: {
      mainline: { id: 'avengers', why: '美队在结尾被冰封，七十年后被神盾局唤醒——《复仇者联盟》就是他睁眼后的第一场仗。' },
      understand: { id: 'winter-soldier', why: '这部里"牺牲"的巴基是后面《冬日战士》的核心。想看懂美队三部曲的情感主线，这两部必须连着看。' }
    }
  },
  {
    id: 'avengers', cn: '复仇者联盟', en: 'The Avengers',
    year: 2012, date: '2012-05-04', phase: 1, saga: 'infinity',
    ro: 6, co: 7, coLabel: '2012 年',
    mainline: true, starter: true,
    role: '第一阶段的收束点，也是 MCU 商业模式成立的证明：分散的独立电影可以汇成一场集体战役。',
    sf: '洛基入侵地球，尼克·弗瑞召集六位互不对付的英雄组成复仇者联盟。',
    chars: ['tony', 'steve', 'thor', 'natasha', 'banner', 'clint', 'loki', 'fury'],
    next: {
      mainline: { id: 'winter-soldier', why: '纽约之战让全世界知道了超级英雄的存在，也让神盾局的权力被彻底放大。《冬日战士》正面处理这个后果，是第二阶段质量最高、对主线影响最深的一部。' },
      understand: { id: 'iron-man-3', why: '纽约之战给托尼留下了严重的心理创伤，《钢铁侠3》整部电影都在处理这件事。想理解托尼后来为什么执着于"给地球造一副盔甲"，这部是关键。' }
    }
  },
  {
    id: 'iron-man-3', cn: '钢铁侠3', en: 'Iron Man 3',
    year: 2013, date: '2013-05-03', phase: 2, saga: 'infinity',
    ro: 7, co: 8, coLabel: '2012 年末',
    mainline: false, starter: false,
    role: '处理纽约之战的心理余波。它解释了托尼的焦虑从何而来，这份焦虑后来直接催生了奥创。',
    sf: '经历纽约之战后，托尼陷入创伤后应激障碍，同时面临一个神秘恐怖分子的袭击。',
    chars: ['tony'],
    next: {
      mainline: { id: 'winter-soldier', why: '这部主要处理托尼的个人状态。要回到影响全局的主线，下一站是《冬日战士》。' }
    }
  },
  {
    id: 'thor-dark-world', cn: '雷神2：黑暗世界', en: 'Thor: The Dark World',
    year: 2013, date: '2013-11-08', phase: 2, saga: 'infinity',
    ro: 8, co: 9, coLabel: '2013 年',
    mainline: false, starter: false,
    role: '公认较弱的一部，但它交代了第二颗无限宝石（以太粒子／现实宝石）的下落。',
    sf: '黑暗精灵为夺取上古力量以太粒子入侵，索尔被迫与洛基合作。',
    chars: ['thor', 'loki'],
    next: {
      mainline: { id: 'winter-soldier', why: '宝石线索已经交代完，回到地球主线。' }
    }
  },
  {
    id: 'winter-soldier', cn: '美国队长2：冬日战士', en: 'Captain America: The Winter Soldier',
    year: 2014, date: '2014-04-04', phase: 2, saga: 'infinity',
    ro: 9, co: 10, coLabel: '2014 年',
    mainline: true, starter: false,
    role: '整个 MCU 格局的转折点。神盾局在这部里倒塌，从此英雄失去了官方靠山，也直接引出《内战》的对立。',
    sf: '美国队长发现自己效力的神盾局早已被渗透，同时遭遇一名身手与他不相上下的杀手。',
    chars: ['steve', 'natasha', 'bucky', 'sam', 'fury'],
    next: {
      mainline: { id: 'age-of-ultron', why: '神盾局倒了，复仇者从此要自己扛。《奥创纪元》就是他们独立行动后的第一场大祸，也是内部裂痕的开始。' },
      understand: { id: 'civil-war', why: '这部揭露的巴基身份，是《内战》里美队和托尼决裂的直接导火索。这两部本质上是同一个故事的上下半场。' }
    }
  },
  {
    id: 'guardians', cn: '银河护卫队', en: 'Guardians of the Galaxy',
    year: 2014, date: '2014-08-01', phase: 2, saga: 'infinity',
    ro: 10, co: 11, coLabel: '2014 年',
    mainline: true, starter: true,
    role: '把 MCU 正式拓展到宇宙尺度。灭霸、收藏家、力量宝石都在这里第一次被完整展示。',
    sf: '一群银河系边缘的亡命之徒被迫联手，阻止一颗神秘宝球落入狂热者手中。',
    chars: ['starlord', 'gamora', 'thanos'],
    next: {
      mainline: { id: 'age-of-ultron', why: '宇宙线暂告一段落，地球线的《奥创纪元》正在推进无限宝石的另一半拼图。' },
      understand: { id: 'infinity-war', why: '这部第一次正面介绍灭霸和他的养女卡魔拉。他们的关系是《无限战争》最重要的情感支点，不看这部会完全无感。' }
    }
  },
  {
    id: 'age-of-ultron', cn: '复仇者联盟2：奥创纪元', en: 'Avengers: Age of Ultron',
    year: 2015, date: '2015-05-01', phase: 2, saga: 'infinity',
    ro: 11, co: 13, coLabel: '2015 年',
    mainline: true, starter: false,
    role: '复仇者内部矛盾的正式爆发点。托尼擅自造出奥创，团队信任崩塌，为《内战》铺好全部动机。',
    sf: '托尼试图造出一套全球防御系统，结果人工智能奥创决定人类才是威胁。',
    chars: ['tony', 'steve', 'thor', 'natasha', 'banner', 'clint', 'wanda', 'vision'],
    next: {
      mainline: { id: 'civil-war', why: '索科维亚的平民伤亡直接导致各国政府要求管控超级英雄，这份协议就是《内战》分裂的起因。两部是严格的因果关系。' }
    }
  },
  {
    id: 'ant-man', cn: '蚁人', en: 'Ant-Man',
    year: 2015, date: '2015-07-17', phase: 2, saga: 'infinity',
    ro: 12, co: 14, coLabel: '2015 年',
    mainline: false, starter: false,
    role: '引入量子领域这个概念。它当时看着像小品，五年后却成了《终局之战》翻盘的唯一钥匙。',
    sf: '窃贼斯科特·朗接手一套能自由缩放身体的战衣，被迫完成一次高难度潜入。',
    chars: ['scott'],
    next: {
      mainline: { id: 'civil-war', why: '蚁人下一次出场就是《内战》机场大战，直接站队美队。' },
      understand: { id: 'endgame', why: '这部提出的量子领域时间流速差异，是《终局之战》"时间劫案"能成立的全部理论基础。' }
    }
  },
  {
    id: 'civil-war', cn: '美国队长3：内战', en: 'Captain America: Civil War',
    year: 2016, date: '2016-05-06', phase: 3, saga: 'infinity',
    ro: 13, co: 15, coLabel: '2016 年',
    mainline: true, starter: false,
    role: '复仇者的正式解体。它同时完成了三件事：拆散团队、引入蜘蛛侠、引入黑豹——三条后续主线在这一部里同时启动。',
    sf: '一份要求超级英雄接受政府管辖的协议，把复仇者分成了针锋相对的两派。',
    chars: ['tony', 'steve', 'bucky', 'natasha', 'sam', 'wanda', 'vision', 'scott', 'peter', 'tchalla'],
    next: {
      mainline: { id: 'infinity-war', why: '内战之后复仇者四分五裂，灭霸恰恰是在他们最散的时候动手的。这个"分裂—被各个击破"的因果，是《无限战争》悲剧性的核心。' },
      understand: { id: 'spider-man-homecoming', why: '托尼在这部里把蜘蛛侠拉进战场，《英雄归来》紧接着回答"这个高中生后来怎么样了"。想搞懂蜘蛛侠和钢铁侠的关系，必须连看。' }
    }
  },
  {
    id: 'doctor-strange', cn: '奇异博士', en: 'Doctor Strange',
    year: 2016, date: '2016-11-04', phase: 3, saga: 'infinity',
    ro: 14, co: 19, coLabel: '2016–2017 年',
    mainline: true, starter: false,
    role: '把魔法和多元宇宙引入 MCU。时间宝石在这里现身，而"多元宇宙"这个词后来撑起了整个第四、五、六阶段。',
    sf: '傲慢的神经外科医生失去双手后远赴东方求医，却踏入了一个完全超出他认知的领域。',
    chars: ['strange'],
    next: {
      mainline: { id: 'thor-ragnarok', why: '奇异博士片尾彩蛋里索尔来到地球找他帮忙，那段对话直接接上《诸神黄昏》的开场。' },
      understand: { id: 'infinity-war', why: '时间宝石在他手上，而《无限战争》全片最关键的一个决定就是由他做出的。' }
    }
  },
  {
    id: 'guardians-2', cn: '银河护卫队2', en: 'Guardians of the Galaxy Vol. 2',
    year: 2017, date: '2017-05-05', phase: 3, saga: 'infinity',
    ro: 15, co: 12, coLabel: '2014 年',
    mainline: false, starter: false,
    role: '主要处理护卫队内部的家庭关系。对宇宙主线推进不多，但为《银护3》和卡魔拉姐妹线打了底。',
    sf: '星爵终于见到了自己的亲生父亲，但对方的真实目的并不像看上去那么温情。',
    chars: ['starlord', 'gamora'],
    next: {
      mainline: { id: 'infinity-war', why: '护卫队下一次出场就是《无限战争》开场，和索尔在太空相遇。' }
    }
  },
  {
    id: 'spider-man-homecoming', cn: '蜘蛛侠：英雄归来', en: 'Spider-Man: Homecoming',
    year: 2017, date: '2017-07-07', phase: 3, saga: 'infinity',
    ro: 16, co: 18, coLabel: '2016 年',
    mainline: true, starter: true,
    role: '蜘蛛侠 MCU 三部曲的第一部。它把"托尼·斯塔克是彼得的导师"这层关系正式立住，这条师徒线一路影响到《英雄无归》。',
    sf: '刚参加完机场大战的高中生彼得·帕克急于证明自己，却撞上了一个来历不简单的对手。',
    chars: ['peter', 'tony'],
    next: {
      mainline: { id: 'infinity-war', why: '彼得下一次登场就是《无限战争》，托尼把他带上了泰坦星。他们师徒关系的走向在那部里迎来第一个转折。' },
      understand: { id: 'civil-war', why: '如果你还没看《内战》，会不明白托尼为什么突然出现在彼得家里、彼得那套战衣哪来的。《内战》是这部的直接前置。' }
    }
  },
  {
    id: 'thor-ragnarok', cn: '雷神3：诸神黄昏', en: 'Thor: Ragnarok',
    year: 2017, date: '2017-11-03', phase: 3, saga: 'infinity',
    ro: 17, co: 20, coLabel: '2017 年',
    mainline: true, starter: false,
    role: '重塑了雷神这个角色，同时把阿斯加德彻底摧毁。片尾那艘难民船，正是《无限战争》开场被灭霸屠杀的那艘。',
    sf: '阿斯加德面临毁灭预言，失去雷神之锤的索尔被困在一颗垃圾星球上。',
    chars: ['thor', 'loki', 'banner'],
    next: {
      mainline: { id: 'infinity-war', why: '《诸神黄昏》的最后一个镜头和《无限战争》的第一个镜头是连着的——同一艘飞船，中间没有间隔。这是 MCU 衔接最紧的一次。' }
    }
  },
  {
    id: 'black-panther', cn: '黑豹', en: 'Black Panther',
    year: 2018, date: '2018-02-16', phase: 3, saga: 'infinity',
    ro: 18, co: 17, coLabel: '2016 年',
    mainline: false, starter: false,
    role: '完整建立瓦坎达这个国家。这个地点在《无限战争》成为决战战场，在第四阶段又承接了黑豹传承。',
    sf: '特查拉回国继承王位，却发现一个来自家族秘密的挑战者。',
    chars: ['tchalla'],
    next: {
      mainline: { id: 'infinity-war', why: '瓦坎达在这部里从隐世之国走向开放，而《无限战争》地球战场的决战就发生在这里。' }
    }
  },
  {
    id: 'ant-man-wasp', cn: '蚁人2：黄蜂女现身', en: 'Ant-Man and the Wasp',
    year: 2018, date: '2018-07-06', phase: 3, saga: 'infinity',
    ro: 20, co: 21, coLabel: '2018 年',
    mainline: false, starter: false,
    role: '故事时间点在《无限战争》期间。它的片尾彩蛋是斯科特被困量子领域，这个设定直接开启了《终局之战》。',
    sf: '斯科特在软禁期间被拉回战场，帮助皮姆父女从量子领域救回失踪三十年的人。',
    chars: ['scott'],
    next: {
      mainline: { id: 'endgame', why: '片尾彩蛋里所有人化为灰烬、只剩斯科特困在量子领域——这个"被困住的幸存者"就是《终局之战》全部计划的起点。' }
    }
  },
  {
    id: 'infinity-war', cn: '复仇者联盟3：无限战争', en: 'Avengers: Infinity War',
    year: 2018, date: '2018-04-27', phase: 3, saga: 'infinity',
    ro: 19, co: 22, coLabel: '2018 年',
    mainline: true, starter: false,
    role: '十年铺垫的总兑现。前面十九部电影埋的线索在这一部里全部收拢，也是 MCU 第一次让反派真正赢了。',
    sf: '灭霸开始收集六颗无限宝石，地球和宇宙的英雄被迫在毫无准备的状态下应战。',
    chars: ['thanos', 'tony', 'steve', 'thor', 'strange', 'peter', 'starlord', 'gamora', 'wanda', 'vision', 'tchalla'],
    next: {
      mainline: { id: 'endgame', why: '这是同一个故事的上半场。《无限战争》的结局是一个未完成的句子，不看《终局之战》没有任何意义。' }
    }
  },
  {
    id: 'captain-marvel', cn: '惊奇队长', en: 'Captain Marvel',
    year: 2019, date: '2019-03-08', phase: 3, saga: 'infinity',
    ro: 21, co: 2, coLabel: '1995 年',
    mainline: false, starter: false,
    role: '一部前传。它解释了尼克·弗瑞为什么会想到组建复仇者，也交代了宇宙魔方在 1995 年的下落。',
    sf: '一名失忆的克里星战士回到地球，逐渐拼凑出自己被抹去的过去。',
    chars: ['carol', 'fury'],
    next: {
      mainline: { id: 'endgame', why: '《无限战争》片尾彩蛋弗瑞发出的求救信号，接收方就是她。她在《终局之战》开场就出现了。' }
    }
  },
  {
    id: 'endgame', cn: '复仇者联盟4：终局之战', en: 'Avengers: Endgame',
    year: 2019, date: '2019-04-26', phase: 3, saga: 'infinity',
    ro: 22, co: 23, coLabel: '2018 & 2023 年',
    mainline: true, starter: false,
    role: '无限传奇的终点。二十二部电影、十一年的故事在这里收尾，也是 MCU 迄今为止情感浓度最高的一部。',
    sf: '幸存的复仇者在五年之后找到了一线机会，代价是每个人都必须做出选择。',
    chars: ['tony', 'steve', 'thor', 'natasha', 'banner', 'clint', 'scott', 'carol', 'thanos'],
    next: {
      mainline: { id: 'far-from-home', why: '《终局之战》之后世界变成了什么样？《英雄远征》是官方给出的第一份答案，也是无限传奇正式收尾的最后一部。' },
      understand: { id: 'no-way-home', why: '如果你只想追一条线，可以直接跳到蜘蛛侠三部曲的终章——它处理的正是"后钢铁侠时代"的核心命题。' }
    }
  },
  {
    id: 'far-from-home', cn: '蜘蛛侠：英雄远征', en: 'Spider-Man: Far From Home',
    year: 2019, date: '2019-07-02', phase: 3, saga: 'infinity',
    ro: 23, co: 26, coLabel: '2024 年',
    mainline: true, starter: false,
    role: '无限传奇的正式收官之作。它处理托尼离开后留下的空位，同时用一个彩蛋把彼得推入下一部的绝境。',
    sf: '彼得只想安心过一个欧洲修学旅行，却被卷进一场跨维度的威胁。',
    chars: ['peter'],
    next: {
      mainline: { id: 'no-way-home', why: '片尾彩蛋里彼得的身份被公之于众，全世界都知道他是谁了。《英雄无归》整部电影都在解决这个烂摊子，是严丝合缝的直接续集。' }
    }
  },
  {
    id: 'black-widow', cn: '黑寡妇', en: 'Black Widow',
    year: 2021, date: '2021-07-09', phase: 4, saga: 'multiverse',
    ro: 24, co: 16, coLabel: '2016 年',
    mainline: false, starter: false,
    role: '一部补完性质的前传，故事发生在《内战》之后。它最大的作用是引入叶莲娜，这个角色后来成了《雷霆特攻队》的核心。',
    sf: '内战之后的逃亡期间，娜塔莎被迫回头面对自己被训练成杀手的那段过去。',
    chars: ['natasha', 'yelena'],
    next: {
      mainline: { id: 'shang-chi', why: '这部是补完前传，主线并未推进。第四阶段真正往前走的下一站是《尚气》。' },
      understand: { id: 'thunderbolts', why: '这部引入的叶莲娜是《雷霆特攻队》的主角。想顺着这条线走，可以直接跳过去。' }
    }
  },
  {
    id: 'shang-chi', cn: '尚气与十环传奇', en: 'Shang-Chi and the Legend of the Ten Rings',
    year: 2021, date: '2021-09-03', phase: 4, saga: 'multiverse',
    ro: 25, co: 25, coLabel: '2024 年',
    mainline: false, starter: false,
    role: '引入十环这件来历未明的神器，同时补上《钢铁侠1》里"十环组织"这个悬了十几年的伏笔。',
    sf: '一个在旧金山当代客泊车的年轻人，被迫回去面对自己父亲统治的地下帝国。',
    chars: ['shangchi'],
    next: {
      mainline: { id: 'eternals', why: '按第四阶段的推进顺序，下一部是同样在扩张世界观边界的《永恒族》。' }
    }
  },
  {
    id: 'eternals', cn: '永恒族', en: 'Eternals',
    year: 2021, date: '2021-11-05', phase: 4, saga: 'multiverse',
    ro: 26, co: 24, coLabel: '2023 年',
    mainline: false, starter: false,
    role: '把 MCU 的时间尺度拉到七千年。它引入了天神组这个凌驾于一切之上的存在，但与其他作品的联动目前仍然很弱。',
    sf: '一群隐居地球数千年的永恒者，因为一场异变不得不重新现身。',
    chars: [],
    next: {
      mainline: { id: 'no-way-home', why: '这部相对独立，可以跳。第四阶段真正的重头戏是《英雄无归》——多元宇宙从那里被正式撕开。' }
    }
  },
  {
    id: 'no-way-home', cn: '蜘蛛侠：英雄无归', en: 'Spider-Man: No Way Home',
    year: 2021, date: '2021-12-17', phase: 4, saga: 'multiverse',
    ro: 27, co: 27, coLabel: '2024 年',
    mainline: true, starter: false,
    role: '多元宇宙正式打开的那一刻。它既是蜘蛛侠个人故事的成人礼，也是整个第四阶段的结构性转折点。',
    sf: '身份暴露后走投无路的彼得请奇异博士施法，却让不该出现的东西闯进了这个世界。',
    chars: ['peter', 'strange'],
    next: {
      mainline: { id: 'multiverse-of-madness', why: '奇异博士在这部里为彼得施的咒失控了，《疯狂多元宇宙》开场就在收拾这个后果。两部之间是明确的因果承接。' },
      understand: { id: 'brand-new-day', why: '这部的结局把彼得推回了原点——全世界都忘了他。《崭新之日》正是从这个设定往下讲的。' }
    }
  },
  {
    id: 'multiverse-of-madness', cn: '奇异博士2：疯狂多元宇宙', en: 'Doctor Strange in the Multiverse of Madness',
    year: 2022, date: '2022-05-06', phase: 4, saga: 'multiverse',
    ro: 28, co: 29, coLabel: '2025 年',
    mainline: true, starter: false,
    role: '第一次真正带观众穿越多个平行宇宙。它也是旺达角色弧线的终点，情绪落点极重。',
    sf: '一个能在宇宙间穿行的女孩被追杀，奇异博士被卷入一场跨越现实的追逐。',
    chars: ['strange', 'wanda'],
    next: {
      mainline: { id: 'quantumania', why: '多元宇宙的规则被打破后，MCU 需要一个统领性的威胁。《量子狂潮》承担了引入这个威胁的任务。' }
    }
  },
  {
    id: 'love-and-thunder', cn: '雷神4：爱与雷霆', en: 'Thor: Love and Thunder',
    year: 2022, date: '2022-07-08', phase: 4, saga: 'multiverse',
    ro: 29, co: 30, coLabel: '2025 年',
    mainline: false, starter: false,
    role: '索尔的个人篇章。对主线推进有限，主要是给这个角色一个新的情感落点。',
    sf: '索尔的平静生活被一个专门猎杀神明的敌人打断，而他的前女友举起了雷神之锤。',
    chars: ['thor'],
    next: {
      mainline: { id: 'quantumania', why: '这部相对独立，回到主线请看《量子狂潮》。' }
    }
  },
  {
    id: 'wakanda-forever', cn: '黑豹2：瓦坎达万岁', en: 'Black Panther: Wakanda Forever',
    year: 2022, date: '2022-11-11', phase: 4, saga: 'multiverse',
    ro: 30, co: 31, coLabel: '2025 年',
    mainline: false, starter: false,
    role: '完成黑豹的传承交接，同时引入海底王国塔洛坎这个新势力。第四阶段的收官作。',
    sf: '失去国王的瓦坎达，必须同时面对内部的空缺和一个来自海底的挑战者。',
    chars: [],
    next: {
      mainline: { id: 'quantumania', why: '第四阶段到此结束，第五阶段从《量子狂潮》开启。' }
    }
  },
  {
    id: 'quantumania', cn: '蚁人与黄蜂女：量子狂潮', en: 'Ant-Man and the Wasp: Quantumania',
    year: 2023, date: '2023-02-17', phase: 5, saga: 'multiverse',
    ro: 31, co: 32, coLabel: '2026 年',
    mainline: false, starter: false,
    role: '第五阶段的开篇。它把量子领域完整展开，并试图立起一个统领多元宇宙的反派。',
    sf: '斯科特一家意外被吸入量子领域，在那里遇到了一个被流放的统治者。',
    chars: ['scott'],
    next: {
      mainline: { id: 'deadpool-wolverine', why: '多元宇宙的规则讲完了，接下来是把这套规则玩到极致的一部——《死侍与金刚狼》正式把福斯宇宙并入 MCU。' }
    }
  },
  {
    id: 'guardians-3', cn: '银河护卫队3', en: 'Guardians of the Galaxy Vol. 3',
    year: 2023, date: '2023-05-05', phase: 5, saga: 'multiverse',
    ro: 32, co: 33, coLabel: '2026 年',
    mainline: false, starter: false,
    role: '银河护卫队三部曲的终章。它给这支队伍一个完整收尾，宇宙线暂时告一段落。',
    sf: '为了救火箭浣熊的命，护卫队必须闯入一个改造了他的组织。',
    chars: ['starlord'],
    next: {
      mainline: { id: 'deadpool-wolverine', why: '宇宙线收尾，主线回到多元宇宙这条大船上。' }
    }
  },
  {
    id: 'the-marvels', cn: '惊奇队长2', en: 'The Marvels',
    year: 2023, date: '2023-11-10', phase: 5, saga: 'multiverse',
    ro: 33, co: 34, coLabel: '2026 年',
    mainline: false, starter: false,
    role: '把三位与光有关的角色绑在一起。片尾彩蛋指向变种人，是 MCU 引入 X 战警的信号之一。',
    sf: '三个能力互相干扰的英雄被迫每次出手都交换位置，只能学着合作。',
    chars: ['carol'],
    next: {
      mainline: { id: 'deadpool-wolverine', why: '片尾彩蛋提到的变种人世界，在《死侍与金刚狼》里被正式打开。' }
    }
  },
  {
    id: 'deadpool-wolverine', cn: '死侍与金刚狼', en: 'Deadpool & Wolverine',
    year: 2024, date: '2024-07-26', phase: 5, saga: 'multiverse',
    ro: 34, co: 28, coLabel: '2024 年',
    mainline: false, starter: false,
    role: '正式把福斯的 X 战警／死侍宇宙并入 MCU 多元宇宙体系。它为后面变种人的登场清好了法理障碍。',
    sf: '死侍为了保住自己的世界，不得不去找一个完全不想被找到的金刚狼。',
    chars: ['wade', 'logan'],
    next: {
      mainline: { id: 'brave-new-world', why: '变种人的门打开了，但地球的政治格局也在变。《勇敢新世界》处理的是后者。' }
    }
  },
  {
    id: 'brave-new-world', cn: '美国队长4：勇敢新世界', en: 'Captain America: Brave New World',
    year: 2025, date: '2025-02-14', phase: 5, saga: 'multiverse',
    ro: 35, co: 35, coLabel: '2027 年',
    mainline: false, starter: false,
    role: '完成美国队长盾牌的交接，同时把《无敌浩克》里的旧角色重新拉回主线——这是那部电影十七年后第一次真正被启用。',
    sf: '接过盾牌的山姆·威尔逊，第一次要在政治漩涡中间做出判断。',
    chars: ['sam'],
    next: {
      mainline: { id: 'thunderbolts', why: '新一代英雄的班底在这部里成型，《雷霆特攻队》紧接着把另一批"非典型英雄"推上台。' }
    }
  },
  {
    id: 'thunderbolts', cn: '雷霆特攻队*', en: 'Thunderbolts*',
    year: 2025, date: '2025-05-02', phase: 5, saga: 'multiverse',
    ro: 36, co: 36, coLabel: '2027 年',
    mainline: false, starter: false,
    role: '第五阶段的收官。它把此前散落在各部电影里的边缘角色收拢成一支新队伍，为《复联5》做人员储备。',
    sf: '一群各怀心事的前反派和特工被同一个任务凑到一起，谁也不信任谁。',
    chars: ['yelena'],
    next: {
      mainline: { id: 'fantastic-four', why: '第五阶段结束，第六阶段从《神奇四侠：初露锋芒》开始，同时引入一个全新的平行宇宙。' }
    }
  },
  {
    id: 'fantastic-four', cn: '神奇四侠：初露锋芒', en: 'The Fantastic Four: First Steps',
    year: 2025, date: '2025-07-25', phase: 6, saga: 'multiverse',
    ro: 37, co: 37, coLabel: '平行宇宙 Earth-828',
    mainline: true, starter: false,
    role: '第六阶段的开篇。它发生在一个独立的平行宇宙里，这四个角色是《复联5：毁灭之日》多宇宙汇合的关键一方。',
    sf: '在一个复古未来风格的地球上，四位获得异能的探险者要面对一个吞噬星球的存在。',
    chars: [],
    next: {
      mainline: { id: 'brand-new-day', why: '第六阶段目前上映的下一部就是《崭新之日》，两部都在为年底的《复联5》做汇流准备。' }
    }
  },
  {
    id: 'brand-new-day', cn: '蜘蛛侠：崭新之日', en: 'Spider-Man: Brand New Day',
    year: 2026, date: '2026-07-31', phase: 6, saga: 'multiverse',
    ro: 38, co: 38, coLabel: '《英雄无归》四年后',
    mainline: true, starter: false,
    role: '目前 MCU 最新的院线电影。它承接《英雄无归》被全世界遗忘的结局，同时片尾直接连向《复联5：毁灭之日》。',
    sf: '被所有人忘记的彼得·帕克独自守着纽约，直到几个意料之外的人找上门。',
    chars: ['peter'],
    next: {
      understand: { id: 'no-way-home', why: '这部的全部前提，是《英雄无归》结尾那个"所有人都忘记了彼得·帕克"的咒语。没看那部，你会完全不明白他为什么一个人。' }
    }
  }
];

/* 尚未上映，仅用于路线页面提示，不进入推荐与地图计算 */
window.MCU_UPCOMING = [
  { cn: '复仇者联盟5：毁灭之日', en: 'Avengers: Doomsday', date: '2026-12-18', note: '三个宇宙汇合，毁灭博士登场' },
  { cn: '复仇者联盟6：秘密战争', en: 'Avengers: Secret Wars', date: '2027-12-17', note: '多元宇宙传奇的终章' }
];
