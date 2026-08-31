/* ============================================================
 * MCU 宇宙导航 - 角色数据（V1 骨架版）
 * ------------------------------------------------------------
 * 对应项目说明第十四章。V1 只做骨架，用于支撑三件事：
 *   1. 电影详情页展示「相关角色」
 *   2. 角色 → 出现过哪些电影（回答"某角色出现在哪些电影"这类搜索）
 *   3. 宇宙地图上的角色节点，作为电影之间的连接枢纽
 *
 * 待策划 AI 补充：角色故事发展、角色之间的关系边、参与的重大事件。
 * 补充时请只增字段、不改 id，避免破坏 movies.js 里的 chars 引用。
 *
 * camp 阵营取值：avengers / guardians / asgard / wakanda /
 *                shield / mutant / villain / street
 * ============================================================ */

window.MCU_CHARACTERS = [
  { id: 'tony', cn: '托尼·斯塔克 / 钢铁侠', en: 'Tony Stark', camp: 'avengers',
    first: 'iron-man',
    note: 'MCU 的第一个主角，也是弧线最完整的一个。他的每次决策失误都会成为下一部电影的起因。' },
  { id: 'steve', cn: '史蒂夫·罗杰斯 / 美国队长', en: 'Steve Rogers', camp: 'avengers',
    first: 'captain-america-first-avenger',
    note: '横跨八十年的角色。他与托尼的分歧不是脾气问题，而是两种世界观的正面冲突。' },
  { id: 'thor', cn: '索尔 / 雷神', en: 'Thor', camp: 'asgard',
    first: 'thor',
    note: '把 MCU 从地球科技带向九界神话的那个人。他失去过锤子、家乡、父亲和兄弟。' },
  { id: 'natasha', cn: '娜塔莎·罗曼诺夫 / 黑寡妇', en: 'Natasha Romanoff', camp: 'shield',
    first: 'iron-man-2',
    note: '连接神盾局与复仇者的枢纽人物，也是整个团队里唯一没有超能力却始终在场的人。' },
  { id: 'banner', cn: '布鲁斯·班纳 / 浩克', en: 'Bruce Banner', camp: 'avengers',
    first: 'incredible-hulk',
    note: 'MCU 里唯一换过主演的核心角色，这也是《无敌浩克》在观影顺序里比较尴尬的原因。' },
  { id: 'clint', cn: '克林特·巴顿 / 鹰眼', en: 'Clint Barton', camp: 'shield',
    first: 'thor',
    note: '初代复联里存在感最低但情感线最实的一个，他和娜塔莎的过往是《终局之战》最重的一场戏。' },
  { id: 'loki', cn: '洛基', en: 'Loki', camp: 'asgard',
    first: 'thor',
    note: 'MCU 跨度最长的反派兼配角。他在《复仇者联盟》里的失败，间接引出了后来的多元宇宙。' },
  { id: 'fury', cn: '尼克·弗瑞', en: 'Nick Fury', camp: 'shield',
    first: 'iron-man',
    note: '复仇者计划的发起人。他几乎只出现在片尾彩蛋里，却是把这些独立电影串成宇宙的那只手。' },
  { id: 'bucky', cn: '巴基·巴恩斯 / 冬日战士', en: 'Bucky Barnes', camp: 'avengers',
    first: 'captain-america-first-avenger',
    note: '美队线的情感核心。他被九头蛇改造的这段历史，直接引爆了《内战》的最终决裂。' },
  { id: 'sam', cn: '山姆·威尔逊 / 猎鹰 → 美国队长', en: 'Sam Wilson', camp: 'avengers',
    first: 'winter-soldier',
    note: 'MCU 目前唯一完成"从配角接过主角身份"的角色，这条传承线走了十一年。' },
  { id: 'peter', cn: '彼得·帕克 / 蜘蛛侠', en: 'Peter Parker', camp: 'avengers',
    first: 'civil-war',
    note: '他的所有故事都建立在与托尼·斯塔克的师徒关系上。理解这一点，才能理解他后面每一次选择。' },
  { id: 'strange', cn: '斯蒂芬·斯特兰奇 / 奇异博士', en: 'Stephen Strange', camp: 'avengers',
    first: 'doctor-strange',
    note: '把魔法与多元宇宙带进 MCU 的人。也是他亲手把多元宇宙的口子撕开的。' },
  { id: 'tchalla', cn: '特查拉 / 黑豹', en: "T'Challa", camp: 'wakanda',
    first: 'civil-war',
    note: '他让瓦坎达从隐世之国走向开放，这个决定直接促成了《无限战争》的地球决战地点。' },
  { id: 'wanda', cn: '旺达·马克西莫夫 / 绯红女巫', en: 'Wanda Maximoff', camp: 'avengers',
    first: 'age-of-ultron',
    note: 'MCU 里从反派到英雄再到反派的完整轮回，弧线跨度七年。' },
  { id: 'vision', cn: '幻视', en: 'Vision', camp: 'avengers',
    first: 'age-of-ultron',
    note: '额头上的心灵宝石让他从诞生第一天起就是灭霸的目标，这个设定决定了他的结局。' },
  { id: 'scott', cn: '斯科特·朗 / 蚁人', en: 'Scott Lang', camp: 'avengers',
    first: 'ant-man',
    note: '看起来最不重要的一个，却是《终局之战》唯一的破局点——因为只有他从量子领域回来了。' },
  { id: 'carol', cn: '卡罗尔·丹弗斯 / 惊奇队长', en: 'Carol Danvers', camp: 'avengers',
    first: 'captain-marvel',
    note: '弗瑞在消散前发出的求救信号是打给她的。她的存在解释了"复仇者"这个名字的由来。' },
  { id: 'starlord', cn: '彼得·奎尔 / 星爵', en: 'Peter Quill', camp: 'guardians',
    first: 'guardians',
    note: '银河护卫队的领队。他在泰坦星上失控的那一拳，是《无限战争》败局的直接触发点之一。' },
  { id: 'gamora', cn: '卡魔拉', en: 'Gamora', camp: 'guardians',
    first: 'guardians',
    note: '灭霸的养女。她与灭霸的关系是《无限战争》情感强度最高的部分，也是灵魂宝石的代价。' },
  { id: 'thanos', cn: '灭霸', en: 'Thanos', camp: 'villain',
    first: 'avengers',
    note: 'MCU 铺垫时间最长的反派，从 2012 年的一个彩蛋镜头到 2018 年正式出手，中间隔了六年。' },
  { id: 'shangchi', cn: '尚气', en: 'Shang-Chi', camp: 'avengers',
    first: 'shang-chi',
    note: '他的登场补完了《钢铁侠1》里悬了十三年的"十环组织"伏笔。' },
  { id: 'yelena', cn: '叶莲娜·贝洛娃', en: 'Yelena Belova', camp: 'avengers',
    first: 'black-widow',
    note: '娜塔莎的妹妹，也是《雷霆特攻队》的核心。她是第五阶段新老交替的关键人物。' },
  { id: 'wade', cn: '韦德·威尔逊 / 死侍', en: 'Wade Wilson', camp: 'mutant',
    first: 'deadpool-wolverine',
    note: '他的登场是 MCU 正式吸收福斯宇宙的标志，也为变种人后续进入主线扫清了障碍。' },
  { id: 'logan', cn: '罗根 / 金刚狼', en: 'Logan', camp: 'mutant',
    first: 'deadpool-wolverine',
    note: 'X 战警宇宙的招牌角色。他在 MCU 的首次出场，本身就是一次跨宇宙的叙事宣言。' }
];

window.MCU_CAMPS = {
  avengers:  { label: '复仇者阵营', color: '#E8483F' },
  guardians: { label: '银河护卫队', color: '#28B487' },
  asgard:    { label: '阿斯加德',   color: '#F0A932' },
  wakanda:   { label: '瓦坎达',     color: '#8B6FE8' },
  shield:    { label: '神盾局',     color: '#5B8DEF' },
  mutant:    { label: '变种人',     color: '#E8A33F' },
  villain:   { label: '反派',       color: '#7A8296' },
  street:    { label: '街头英雄',   color: '#C25B8E' }
};
