/**
 * MCU 观影助手 · GenUI 数据集构建器（信息架构重设计 V2.0）
 * ------------------------------------------------------------
 * 数据单一可信源：h5/data/*.js（母项目，只读引用）
 * 输出：genui-app/static/data.js（构建期生成，请勿手工编辑）
 *
 * 依据：
 *   docs/产品/GenUI-MCU观影助手-信息架构重设计V2.0.html（V2.0-R3 冻结规格）
 *   §11.1 作品卡字段映射 / §11.2 路线介绍页 4 块 / §6 字数预算 / §7.2 徽章三态
 *
 * V2.0 纪律：
 *   1. 仍只有三条路线：新手入门 / 主线精选 / 复联5补课；作品清单与顺序冻结（同 V1.0）。
 *   2. 每条路线 = 1 页路线介绍（intro 4 块）+ N 页作品（badge/reason/role/gains/next）。
 *   3. 字段来源全部可回溯母项目：routes(forWho/why/desc) / special-routes(kw/chain) /
 *      movies.role / movies.sf / movies.next.*.why / relations.why / upcoming.note。
 *      仅「怎么排」与少量衔接句为新撰句式，事实依据见每条注释。
 *   4. 长度断言（§6 预算）：reason ≤36 / role ≤54 / gains ≤36（每要点 ≤15）/ next ≤36 /
 *      intro 的 适合谁 ≤36、为什么 ≤54、怎么排 ≤36、看完获得 ≤39。超预算即构建报错退出，
 *      UI 不做 truncate 兜底 —— 从机制上根除文字截断（零省略号）。
 *   5. 后续关联措辞分级（§11.1 V2.0-R2 收紧）：仅 relations.type 为 sequel / prereq
 *      （或同一剧集续季）才可用「下一部 / 承接」，其余一律「关联《作品》」。
 *   6. 反倒挂：后续关联目标若在本路线内，其序号必须大于本作序号（或指向 upcoming avengers-5）。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
/* 母项目（单一可信源）位于工作区根目录的 h5/data，并非 GenUI 子目录内 */
const WORKSPACE = path.resolve(ROOT, '..', '..');
const H5 = path.join(WORKSPACE, 'h5', 'data');
const OUT = path.join(ROOT, 'genui-app', 'static', 'data.js');

const PHASE_SHORT = {
  1: '第一阶段',
  2: '第二阶段',
  3: '第三阶段',
  4: '第四阶段',
  5: '第五阶段',
  6: '第六阶段'
};

/**
 * 剧集分季年份覆盖表。
 * 母项目 series.js 中《洛基》仅存整剧单一年份 2021，无「分季」字段；
 * 设计稿 V1.0（已验收）与 V2.0-R3 §13 决策 5 均指定洛基 S2 显示年份为 2023，
 * 故此处以「设计稿指定显示值」覆盖 S2 年份（构建期固定映射，非运行时推断）。
 */
const SERIES_SEASON_YEAR = {
  'loki|S1': 2021,
  'loki|S2': 2023
};

/* ── §6 字数预算（全角字口径；ASCII 记 0.5，含空格）── */
const BUDGET = {
  name: 16,
  reason: 36,
  role: 54,
  gains: 36,
  gainPoint: 15,
  next: 36,
  forWho: 36,
  why: 54,
  order: 36,
  outcome: 39,
  badge: 4
};

/* 可见宽度：CJK/全角记 1，ASCII 记 0.5（360 档 12px 正文 19 全角字/行） */
function vw(s) {
  let w = 0;
  for (const ch of String(s)) w += ch.charCodeAt(0) < 128 ? 0.5 : 1;
  return w;
}

/* ── 路线介绍页 4 块（§11.2 派生边界）── */
const INTRO = {
  newcomer: {
    /* 改自 routes.js newcomer.forWho */
    forWho: '完全没看过 MCU，或只零散看过一两部——这条路线就是为你准备的。',
    /* 改自 newcomer.why + desc（与设计 §10.1 全量文案一致，删去重复的"枝叶随时可补"） */
    why: 'MCU 有 30 多部，全看门槛太高，中途弃剧的风险远大于"错过细节"的损失。这条路线只留 12 部，先把主干立住。',
    /* 新撰句式：因果依据为 newcomer.items 手写顺序 + 各作 role（起源→组队→裂痕→终局） */
    order: '按世界观建立顺序：起源 → 组队 → 裂痕 → 终局，每一步都在为下一步铺垫。',
    /* 改自 newcomer.desc 结论句（V2.0-R3-2 校准：12 部 = 新手主干，非完整经历） */
    outcome: '看完这 12 部，你就能了解无限传奇的主干故事，并具备继续探索其他分支的基础。'
  },
  essential: {
    /* 改自 routes.js essential.forWho */
    forWho: '时间有限，不想全看，只想搞懂主线剧情。',
    /* 改自 essential.why 原文 */
    why: 'MCU 并不是每部都在推进同一个故事。这条路线把对主线可选的支线全部摘掉，只留实质推动剧情的必看。',
    /* 新撰句式：事实依据 generator=mainline + ro 上映序；按 §13 决策 9 注明"院线电影主线" */
    order: '只取标记为「核心主线」的 18 部院线电影，按北美上映顺序排列。',
    /* 改自 essential.desc */
    outcome: '理清从无限传奇到多元宇宙的主干走向，跳过的支线不看也不影响理解主线。'
  },
  'avengers-doomsday': {
    /* 改自 special-routes tagline + origin；片名取 upcoming.js 已验证数据 */
    forWho: '已看完《终局之战》，想在《复仇者联盟5：毁灭之日》上映前快速补上前情。',
    /* 改自 heroNote + chain 链主题；未使用"最短路线"等无可比证据的表述（R2-3）；
       V2.0-R4（R4-3）裁定版：保留链主题「跨宇宙角色」，仅压缩连接词以适配 54 字预算 */
    why: '8 部精简补课路线。终局之后时间前跳、多元宇宙开启、跨宇宙角色与新英雄入局——补完接上《复联5：毁灭之日》。',
    /* 新撰句式：顺序依据 core.items 的 kw 序列；7 个环节全保留，仅压缩措辞以适配 36 字预算 */
    order: '按链条顺序：TVA→多元宇宙→世人所知→穿越者→新秩序→反英雄→入口。',
    /* chain.end 原文（"三条线汇合到毁灭博士…"） */
    outcome: '三条线汇合到毁灭博士，前面补的每一环都在这里收束。'
  }
};

/* ── 推荐理由（为什么看它）：按 (路线, 作品) 单独派生 ── */
const REASON = {
  newcomer: {
    'iron-man': '入坑第一站：起源故事不依赖任何前作，单看就是一个完整好故事。', /* sf 独立性 + starter 语义（R3-1） */
    'captain-america-first-avenger': '入坑友好：二战背景的起源故事，不需要任何前作，单看也完整。',
    thor: '入坑友好：一个关于傲慢与成长的独立故事，看完就认识索尔和洛基。',
    avengers: '系列首次大集结：六位互不对付的英雄被迫组成一支队伍。', /* sf 原文 */
    'winter-soldier': '谍战式悬念：神盾局早已被渗透，队长还要面对一名身手相当的杀手。', /* sf 原文 */
    guardians: '入坑友好：全新角色、全新舞台，不看前面的电影也能跟上。', /* starter + sf */
    'age-of-ultron': '一次出于好意的失控：想造防御系统，却造出要灭绝人类的 AI。', /* sf 原文 */
    'civil-war': '英雄之间的正面决裂：一份管控协议，把复仇者分成两派。', /* sf 原文 */
    'thor-ragnarok': '看点是一次彻底的推翻重来：锤子没了、阿斯加德危在旦夕。', /* sf + role */
    'black-panther': '新手路线里少数的支线：不依赖前作、独立完整，把瓦坎达这块世界观拼图补全。', /* 路线收录理由 + sf（R3-3）；删"故事"二字以适配 36 字预算 */
    'infinity-war': '反派真正赢了一次：英雄在毫无准备的状态下迎战灭霸。', /* role + sf */
    endgame: '五年后的最后一次机会：每个人都必须做出自己的选择。' /* sf 原文 */
  },
  essential: {
    'iron-man': '主线的第一颗种子：片尾彩蛋第一次说出"复仇者计划"。', /* next.mainline.why */
    thor: '洛基的动机全在这部里，不看就接不上《复仇者联盟》。', /* next.mainline.why 结论 */
    'captain-america-first-avenger': '二战起源，美队与巴基的关系从这部立起。', /* relations → winter-soldier */
    avengers: '六位互不对付的英雄被迫组队，第一次集体迎战洛基。', /* sf */
    'winter-soldier': '神盾局在这部解体，复仇者从此只能自己扛。', /* next.mainline.why */
    guardians: '宇宙线的起点：灭霸与卡魔拉的关系在这里第一次展开。', /* role + next.understand */
    'age-of-ultron': '索科维亚的伤亡催生管控协议，内战的分裂从这里开始。', /* next.mainline.why */
    'civil-war': '复仇者在这里正式解体，灭霸等的就是这个空档。', /* next.mainline.why */
    'doctor-strange': '魔法与多元宇宙的入口：时间宝石第一次现身。', /* role */
    'spider-man-homecoming': '托尼与彼得的师徒线从这部立起，一路影响到《英雄无归》。', /* role */
    'thor-ragnarok': '雷神彻底重塑的一部：锤子、家乡和父亲在它结束时都没了。', /* relations thor→ragnarok */
    'infinity-war': '六颗宝石集齐之战：英雄在毫无准备的状态下应战。', /* sf */
    endgame: '时间劫案成立的一战：所有线索在这里一次性兑现。', /* relations ant-man→endgame + role */
    'far-from-home': '后钢铁侠时代的第一个答案：没有托尼之后怎么办。', /* role + next.mainline.why */
    'no-way-home': '一道失控的遗忘咒，把不该出现的东西带进这个世界。', /* sf 原文 */
    'multiverse-of-madness': '承接《英雄无归》咒语失控的后果，多元宇宙的规则在这里被正式打破。', /* relations nwh→mom（sequel） */
    'fantastic-four': '全新的平行宇宙登场：第六阶段的另一条线从这里开始。', /* role */
    'brand-new-day': '最新的院线电影：被全世界遗忘的彼得，独自守着纽约。' /* role + sf */
  },
  'avengers-doomsday': {
    'loki@洛基 S1': 'TVA / 时间线：先懂 TVA 与神圣时间线，多元宇宙才有后续。', /* kw + chain 链首 */
    'loki@洛基 S2': '多元宇宙正式开启：承接 S1 的神圣时间线破裂，多元宇宙成主线。', /* kw + relations loki→mom */
    'multiverse-of-madness': '宇宙碰撞：多元宇宙的规则在这里被正式打破。', /* kw + role */
    'no-way-home': '多元宇宙暴露于人：一道失控的咒语，把多元宇宙撕开了口子。', /* kw + sf */
    'deadpool-wolverine': '穿越者入局：死侍要找的那个金刚狼，来自另一个宇宙。', /* kw + sf */
    'brave-new-world': '新世界秩序：山姆接过盾牌后的第一部个人电影。', /* kw + relations falcon→bnw */
    thunderbolts: '反英雄集结：一批边缘角色凑成新队伍，为复联5做人员储备。', /* kw + role */
    'fantastic-four': '入口开启：平行宇宙 Earth-828 登场，是复联5多宇宙汇合的关键一方。' /* kw + role + upcoming.note */
  }
};

/* ── 信息增量（看完你会懂）：2 要点，各 ≤15 字 ── */
const GAINS = {
  newcomer: {
    'iron-man': ['托尼如何成为钢铁侠', '"复仇者计划"从何而来'],
    'captain-america-first-avenger': ['血清如何造出美队', '宇宙魔方的来历'],
    thor: ['索尔为何被放逐', '洛基的来历'],
    avengers: ['英雄如何组队', '洛基为何入侵地球'],
    'winter-soldier': ['神盾局为何倒塌', '冬兵的真实身份'],
    guardians: ['灭霸与卡魔拉的父女关系', '无限宝石成体系'],
    'age-of-ultron': ['奥创为何诞生', '团队信任如何崩塌'],
    'civil-war': ['协议为何引起分裂', '蜘蛛侠与黑豹登场'],
    'thor-ragnarok': ['索尔如何失去一切', '阿斯加德的结局'],
    'black-panther': ['瓦坎达与振金科技', '特查拉继承王位'],
    'infinity-war': ['六颗宝石如何集齐', '英雄为何失败'],
    endgame: ['时间旅行如何成立', '无限传奇如何收尾']
  },
  essential: {
    'iron-man': ['托尼如何成为钢铁侠', '"复仇者计划"从何而来'],
    thor: ['索尔为何被放逐', '洛基的来历'],
    'captain-america-first-avenger': ['血清如何造出美队', '宇宙魔方的来历'],
    avengers: ['英雄如何组队', '洛基为何入侵地球'],
    'winter-soldier': ['神盾局为何倒塌', '冬兵的真实身份'],
    guardians: ['灭霸与卡魔拉的父女关系', '无限宝石成体系'],
    'age-of-ultron': ['奥创为何诞生', '团队信任如何崩塌'],
    'civil-war': ['协议为何引起分裂', '蜘蛛侠与黑豹登场'],
    'doctor-strange': ['魔法体系如何运作', '时间宝石的用途'],
    'spider-man-homecoming': ['彼得与托尼的关系', '他为何急于证明自己'],
    'thor-ragnarok': ['索尔如何失去一切', '阿斯加德的结局'],
    'infinity-war': ['六颗宝石如何集齐', '英雄为何失败'],
    endgame: ['时间旅行如何成立', '无限传奇如何收尾'],
    'far-from-home': ['托尼走后留下什么', '无限传奇如何收官'],
    'no-way-home': ['咒语为何失控', '彼得的身份危机'],
    'multiverse-of-madness': ['多元宇宙如何被穿行', '旺达的结局'],
    'fantastic-four': ['Earth-828 复古未来世界', '四位成员的异能组合'],
    'brand-new-day': ['彼得为何孤身一人', '片尾如何接向复联5']
  },
  'avengers-doomsday': {
    'loki@洛基 S1': ['TVA 与神圣时间线', '洛基的变体身份'],
    'loki@洛基 S2': ['神圣时间线为何破裂', '多元宇宙如何开启'],
    'multiverse-of-madness': ['多元宇宙如何被穿行', '旺达的结局'],
    'no-way-home': ['咒语为何失控', '多元宇宙如何被撕开'],
    'deadpool-wolverine': ['死侍为何要找金刚狼', '变种人如何并入 MCU'],
    'brave-new-world': ['山姆如何接住盾牌', '政治漩涡中的抉择'],
    thunderbolts: ['这批人为何凑到一起', '新队伍如何成型'],
    'fantastic-four': ['Earth-828 的世界设定', '四位成员的异能组合']
  }
};

/* ── 后续关联：t = 文案，ref = 母项目作品 id（用于反倒挂与措辞机械校验）── */
const NEXT = {
  newcomer: {
    'iron-man': { t: '片尾彩蛋的"复仇者计划"，在《复仇者联盟》中正式兑现。', ref: 'avengers' },
    'captain-america-first-avenger': { t: '下一部《复仇者联盟》：美队冰封七十年后醒来，第一场仗就是它。', ref: 'avengers' },
    thor: { t: '承接《复仇者联盟》：这部结尾坠入虚空的洛基，正是它的反派。', ref: 'avengers' },
    avengers: { t: '下一部《冬日战士》：正面处理纽约之战后神盾局扩权的后果。', ref: 'winter-soldier' },
    'winter-soldier': { t: '下一部《奥创纪元》：神盾局倒了，复仇者独立行动后的第一场大祸。', ref: 'age-of-ultron' },
    guardians: { t: '关联《奥创纪元》：宇宙线暂歇，地球线继续拼无限宝石的另一半。', ref: 'age-of-ultron' },
    'age-of-ultron': { t: '下一部《内战》：索科维亚的伤亡直接催生管控协议，分裂由此开始。', ref: 'civil-war' },
    'civil-war': { t: '下一部《无限战争》：复仇者四分五裂，灭霸正是在他们最散时动手。', ref: 'infinity-war' },
    'thor-ragnarok': { t: '下一部《无限战争》：一头一尾是同一艘飞船，中间没有间隔。', ref: 'infinity-war' },
    'black-panther': { t: '关联《复仇者联盟3：无限战争》：瓦坎达是地球决战的战场。', ref: 'infinity-war' },
    'infinity-war': { t: '下一部《终局之战》：同一个故事的上下半场，结局没有写完。', ref: 'endgame' },
    endgame: { t: '下一部《蜘蛛侠：英雄远征》：无限传奇的正式收官。', ref: 'far-from-home' }
  },
  essential: {
    'iron-man': { t: '片尾彩蛋的"复仇者计划"，在《复仇者联盟》中正式兑现。', ref: 'avengers' },
    thor: { t: '承接《复仇者联盟》：这部结尾坠入虚空的洛基，正是它的反派。', ref: 'avengers' },
    'captain-america-first-avenger': { t: '下一部《复仇者联盟》：美队冰封七十年后醒来，第一场仗就是它。', ref: 'avengers' },
    avengers: { t: '下一部《冬日战士》：正面处理纽约之战后神盾局扩权的后果。', ref: 'winter-soldier' },
    'winter-soldier': { t: '下一部《奥创纪元》：神盾局倒了，复仇者独立行动后的第一场大祸。', ref: 'age-of-ultron' },
    guardians: { t: '关联《奥创纪元》：宇宙线暂歇，地球线继续拼无限宝石的另一半。', ref: 'age-of-ultron' },
    'age-of-ultron': { t: '下一部《内战》：索科维亚的伤亡直接催生管控协议，分裂由此开始。', ref: 'civil-war' },
    'civil-war': { t: '下一部《无限战争》：复仇者四分五裂，灭霸正是在他们最散时动手。', ref: 'infinity-war' },
    'doctor-strange': { t: '关联《诸神黄昏》：片尾彩蛋里索尔来找他，直接接上开场。', ref: 'thor-ragnarok' },
    'spider-man-homecoming': { t: '关联《无限战争》：彼得下一次登场，就是被带上泰坦星。', ref: 'infinity-war' },
    'thor-ragnarok': { t: '下一部《无限战争》：一头一尾是同一艘飞船，中间没有间隔。', ref: 'infinity-war' },
    'infinity-war': { t: '下一部《终局之战》：同一个故事的上下半场，结局没有写完。', ref: 'endgame' },
    endgame: { t: '下一部《蜘蛛侠：英雄远征》：无限传奇的正式收官。', ref: 'far-from-home' },
    'far-from-home': { t: '下一部《英雄无归》：身份被公开，整部电影都在收拾这个烂摊子。', ref: 'no-way-home' },
    'no-way-home': { t: '下一部《疯狂多元宇宙》：咒语失控的后果，开场就在收拾。', ref: 'multiverse-of-madness' },
    'multiverse-of-madness': { t: '关联《蚁人与黄蜂女：量子狂潮》：多元宇宙规则被打破后引出统领性威胁。', ref: 'quantumania' },
    'fantastic-four': { t: '关联《蜘蛛侠：崭新之日》：两部都在为《复联5》做汇流准备。', ref: 'brand-new-day' },
    'brand-new-day': { t: '片尾直接连向《复联5：毁灭之日》：三条线在那里汇合。', ref: 'avengers-5' }
  },
  'avengers-doomsday': {
    'loki@洛基 S1': { t: '下一部《洛基 S2》：多元宇宙正式开启。', ref: 'loki@洛基 S2' },
    'loki@洛基 S2': { t: '关联《奇异博士2：疯狂多元宇宙》：它的前提正是多元宇宙开启。', ref: 'multiverse-of-madness' },
    'multiverse-of-madness': { t: '关联《蚁人与黄蜂女：量子狂潮》：它引出统领性的新威胁。', ref: 'quantumania' },
    'no-way-home': { t: '下一部《蜘蛛侠：崭新之日》：结局把彼得推回了原点。', ref: 'brand-new-day' },
    'deadpool-wolverine': { t: '关联《勇敢新世界》：变种人进门之后，地球政治格局也在变。', ref: 'brave-new-world' },
    'brave-new-world': { t: '关联《雷霆特攻队》：另一批非典型英雄接着被推上台。', ref: 'thunderbolts' },
    thunderbolts: { t: '关联《神奇四侠：初露锋芒》：第六阶段由此开启，并引入平行宇宙。', ref: 'fantastic-four' },
    'fantastic-four': { t: '关联《蜘蛛侠：崭新之日》：两部都在为《复联5》做汇流准备。', ref: 'brand-new-day' }
  }
};

/* ── 剧情作用：母项目 role 原文直接引用；超 54 字时按母项目语义压缩 ── */
const ROLE_OVERRIDE = {
  /* 原文 66 字 → 压缩（保留"总开关 + TVA/神圣时间线 + 后续源头"，见 §10.2 洛基卡） */
  loki: '多元宇宙故事的总开关。TVA 与"神圣时间线"的设定，是后续多元宇宙一切的源头。',
  /* 原文 58 字 → 压缩（保留"三部曲第一部 + 导师关系 + 影响到英雄无归"） */
  'spider-man-homecoming': '蜘蛛侠 MCU 三部曲的第一部。它把"托尼是彼得的导师"这层关系立住，师徒线一路影响到《英雄无归》。'
};

function loadGlobal(file, key) {
  const src = fs.readFileSync(path.join(H5, file), 'utf8');
  const sandbox = {};
  new Function('window', src)(sandbox);
  const v = sandbox[key];
  if (!v) throw new Error('未找到全局变量 ' + key + '（' + file + '）');
  return v;
}

function phaseShortOf(phase) {
  return PHASE_SHORT[phase] || ('第' + phase + '阶段');
}

const errors = [];

function assertLen(where, value, budget) {
  if (value == null || value === '') {
    errors.push(where + ' 缺失');
    return;
  }
  const w = vw(value);
  if (w > budget) {
    errors.push(where + ' 超预算 ' + w.toFixed(1) + ' > ' + budget + ' ：' + value);
  }
}

function build() {
  const movies = loadGlobal('movies.js', 'MCU_MOVIES');
  const series = loadGlobal('series.js', 'MCU_SERIES');
  const routes = loadGlobal('routes.js', 'MCU_ROUTES');
  const special = loadGlobal('special-routes.js', 'MCU_SPECIAL_ROUTES');
  const relations = loadGlobal('relations.js', 'MCU_RELATIONS');

  const movieById = {};
  movies.forEach(function (m) { movieById[m.id] = m; });
  const seriesById = {};
  series.forEach(function (s) { seriesById[s.id] = s; });

  /* relations 类型索引：from|to → [type...]（用于后续关联措辞分级机械校验）*/
  const relType = {};
  relations.forEach(function (r) {
    const k = r.from + '|' + r.to;
    (relType[k] = relType[k] || []).push(r.type);
  });

  /* 母项目电影按上映顺序排序，保证「主线精选」按母项目 ro 顺序输出 */
  const moviesByRo = movies.slice().sort(function (a, b) { return a.ro - b.ro; });

  function movieItem(m) {
    if (!m) return null;
    return {
      id: m.id,
      key: m.id,
      name: m.cn,
      year: m.year,
      phase: m.phase,
      phaseShort: phaseShortOf(m.phase),
      isSeries: false,
      type: 'movie'
    };
  }

  function seriesItem(s, label) {
    if (!s) return null;
    const season = label ? (label.match(/S(\d+)/) || [])[1] : null;
    const key = s.id + '|S' + (season || '1');
    const year = (season && SERIES_SEASON_YEAR[key] != null) ? SERIES_SEASON_YEAR[key] : s.year;
    return {
      id: s.id,
      key: s.id + (label ? '@' + label : ''),
      name: label || s.cn,
      year: year,
      phase: s.phase,
      phaseShort: phaseShortOf(s.phase),
      isSeries: true,
      type: 'series'
    };
  }

  /* ── 路线一：新手入门（母项目 newcomer 显式 items，保留母项目原顺序）── */
  const newcomer = routes.filter(function (r) { return r.id === 'newcomer'; })[0];
  const newcomerItems = (newcomer.items || [])
    .map(function (id) { return movieItem(movieById[id]); })
    .filter(Boolean);

  /* ── 路线二：主线精选（母项目 essential，generator=mainline → 主线电影，按上映顺序）── */
  const essential = routes.filter(function (r) { return r.id === 'essential'; })[0];
  let essentialIds;
  if (Array.isArray(essential.items) && essential.items.length) {
    essentialIds = essential.items.slice();
  } else if (essential.generator === 'mainline' || essential.generator === 'essential') {
    essentialIds = moviesByRo.filter(function (m) { return m.mainline; }).map(function (m) { return m.id; });
  } else {
    essentialIds = [];
  }
  const essentialItems = essentialIds
    .map(function (id) { return movieItem(movieById[id]); })
    .filter(Boolean);

  /* ── 路线三：复联5补课（母项目 special-routes.js avengers-doomsday.core.items，8 项）── */
  const ads = special.filter(function (s) { return s.id === 'avengers-doomsday'; })[0];
  const adItems = (ads.core.items || [])
    .map(function (it) {
      const s = seriesById[it.workId];
      if (s) return seriesItem(s, it.label);
      return movieItem(movieById[it.workId]);
    })
    .filter(Boolean);
  /* kw 只用于文档派生依据，不直接上屏（R2-3 已去除"第 X 环"序号） */
  const adKws = (ads.core.items || []).map(function (it) { return it.kw; });

  /* ── 推荐级别徽章（§7.2 三态）：mainline/importance + 路线成员资格 ── */
  const routeIdSet = {};
  [newcomerItems, essentialItems, adItems].forEach(function (arr) {
    arr.forEach(function (it) { routeIdSet[it.id] = true; });
  });

  function badgeOf(it) {
    const s = seriesById[it.id];
    const m = movieById[it.id];
    if (s) {
      if (s.importance === 'core') return '必看';
      if (s.importance === 'recommended') return '推荐';
      if (s.importance === 'optional') return '补充';
      return '推荐';
    }
    if (m && m.mainline) return '必看';
    return routeIdSet[it.id] ? '推荐' : '补充';
  }

  function roleOf(it) {
    if (ROLE_OVERRIDE[it.id]) return ROLE_OVERRIDE[it.id];
    const w = seriesById[it.id] || movieById[it.id];
    return w ? w.role : '';
  }

  const routeDefs = [
    { id: 'newcomer', name: '新手入门', items: newcomerItems },
    { id: 'essential', name: '主线精选', items: essentialItems },
    { id: 'avengers-doomsday', name: '复联5补课', items: adItems }
  ];

  const badgeStat = {};

  const payload = {
    version: '2026-11-03',
    routes: routeDefs.map(function (r) {
      const idxOf = {};
      r.items.forEach(function (it, i) { idxOf[it.key] = i; });

      const items = r.items.map(function (it, i) {
        const reason = (REASON[r.id] || {})[it.key];
        const gains = (GAINS[r.id] || {})[it.key];
        const nextDef = (NEXT[r.id] || {})[it.key];
        const role = roleOf(it);
        const badge = badgeOf(it);

        /* 覆盖率（授权单 §四-4：25 个渲染条目全部覆盖 badge 源 / role / next 或 kw）*/
        if (!reason) errors.push('缺少推荐理由：' + r.id + ' / ' + it.key);
        if (!gains || gains.length !== 2) errors.push('缺少信息增量（须 2 要点）：' + r.id + ' / ' + it.key);
        if (!role) errors.push('缺少剧情作用：' + r.id + ' / ' + it.key);
        if (!nextDef || !nextDef.t) errors.push('缺少后续关联：' + r.id + ' / ' + it.key);
        if (!badge) errors.push('缺少推荐级别源：' + r.id + ' / ' + it.key);

        /* 字数预算断言（§6）*/
        assertLen(r.id + '/' + it.key + ' reason', reason, BUDGET.reason);
        assertLen(r.id + '/' + it.key + ' role', role, BUDGET.role);
        assertLen(r.id + '/' + it.key + ' next', nextDef && nextDef.t, BUDGET.next);
        assertLen(r.id + '/' + it.key + ' badge', badge, BUDGET.badge);
        assertLen(r.id + '/' + it.key + ' name', it.name, BUDGET.name);
        if (gains) {
          gains.forEach(function (g, gi) {
            assertLen(r.id + '/' + it.key + ' gains[' + gi + ']', g, BUDGET.gainPoint);
          });
          assertLen(r.id + '/' + it.key + ' gains(整行)', '看懂：①' + gains[0] + ' ②' + gains[1] + '。', BUDGET.gains);
        }

        /* 后续关联：措辞分级 + 反倒挂（§11.1 V2.0-R1/R2）*/
        if (nextDef && nextDef.ref) {
          const ref = nextDef.ref;
          const refBase = ref.split('@')[0];
          const sameSeries = refBase === it.id;
          const types = relType[it.id + '|' + refBase] || [];
          const direct = sameSeries || types.indexOf('sequel') >= 0 || types.indexOf('prereq') >= 0;
          const usesDirectional = /下一部|承接/.test(nextDef.t);
          if (usesDirectional && !direct) {
            errors.push('措辞越级（非 sequel/prereq 不得用"下一部/承接"）：' + r.id + '/' + it.key +
              ' → ' + ref + '（relations=' + (types.join(',') || '无') + '）：' + nextDef.t);
          }
          if (Object.prototype.hasOwnProperty.call(idxOf, ref)) {
            if (idxOf[ref] <= i) {
              errors.push('后续关联倒挂：' + r.id + '/' + it.key + '(#' + (i + 1) + ') → ' + ref + '(#' + (idxOf[ref] + 1) + ')');
            }
          }
        }

        badgeStat[badge] = (badgeStat[badge] || 0) + 1;

        return {
          id: it.id,
          name: it.name,
          year: it.year,
          phase: it.phase,
          phaseShort: it.phaseShort,
          isSeries: it.isSeries,
          type: it.type,
          badge: badge,
          reason: reason,
          role: role,
          gains: gains,
          next: nextDef ? nextDef.t : ''
        };
      });

      const intro = INTRO[r.id];
      assertLen(r.id + ' intro.forWho', intro.forWho, BUDGET.forWho);
      assertLen(r.id + ' intro.why', intro.why, BUDGET.why);
      assertLen(r.id + ' intro.order', intro.order, BUDGET.order);
      assertLen(r.id + ' intro.outcome', intro.outcome, BUDGET.outcome);

      return {
        id: r.id,
        name: r.name,
        count: items.length,
        intro: intro,
        items: items
      };
    })
  };

  if (errors.length) {
    console.error('✘ 构建失败：' + errors.length + ' 处断言未通过\n');
    errors.forEach(function (e) { console.error('  - ' + e); });
    process.exit(1);
  }

  const banner = [
    '/* ============================================================',
    ' * MCU 观影助手 · GenUI V2.0 专用数据集（构建期生成，请勿手工编辑）',
    ' * ------------------------------------------------------------',
    ' * 由 genui-app-tools/build-data.cjs 从母项目 h5/data/{movies,series,routes,special-routes,relations}.js 自动生成。',
    ' * 数据单一可信源为母项目；本文件仅做字段裁剪与文案派生，构建期含字数预算断言。',
    ' * 重新生成：node genui-app-tools/build-data.cjs',
    ' * ============================================================ */'
  ].join('\n');

  /* 输出格式：路由与作品各占一行，兼顾可读性与体积（§12 估 23–28KB）*/
  const line = (o) => JSON.stringify(o);
  const bodyLines = ['window.MCU_GENUI_DATA = {', '  "version": ' + line(payload.version) + ',', '  "routes": ['];
  payload.routes.forEach(function (r, ri) {
    bodyLines.push('    {');
    bodyLines.push('      "id": ' + line(r.id) + ', "name": ' + line(r.name) + ', "count": ' + r.count + ',');
    bodyLines.push('      "intro": ' + line(r.intro) + ',');
    bodyLines.push('      "items": [');
    r.items.forEach(function (it, ii) {
      bodyLines.push('        ' + line(it) + (ii < r.items.length - 1 ? ',' : ''));
    });
    bodyLines.push('      ]');
    bodyLines.push('    }' + (ri < payload.routes.length - 1 ? ',' : ''));
  });
  bodyLines.push('  ]', '};');
  const body = bodyLines.join('\n') + '\n';

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, banner + '\n' + body, 'utf8');

  const bytes = fs.statSync(OUT).size;
  console.log('✔ 已生成 ' + path.relative(ROOT, OUT));
  payload.routes.forEach(function (r) {
    console.log('  - ' + r.name + ' (' + r.id + ') → ' + r.count + ' 部作品 / ' + (r.count + 1) + ' 页');
    r.items.forEach(function (it, i) {
      console.log('      ' + String(i + 1).padStart(2, '0') +
        ' ' + it.name + ' · ' + it.year + ' · ' + it.phaseShort +
        ' · [' + it.badge + ']' + (it.isSeries ? ' · [剧]' : ''));
    });
  });
  const totalItems = payload.routes.reduce(function (n, r) { return n + r.items.length; }, 0);
  const uniqueIds = {};
  payload.routes.forEach(function (r) { r.items.forEach(function (it) { uniqueIds[it.id] = true; }); });
  console.log('  渲染条目    : ' + totalItems + ' 条（去重 ' + Object.keys(uniqueIds).length + ' 个 id）');
  console.log('  徽章分布    : ' + Object.keys(badgeStat).map(function (k) { return k + ' ' + badgeStat[k]; }).join(' / '));
  console.log('  复联5补课 kw: ' + adKws.join(' → '));
  console.log('  长度断言    : 全过（reason≤' + BUDGET.reason + ' role≤' + BUDGET.role +
    ' gains≤' + BUDGET.gains + '/点≤' + BUDGET.gainPoint + ' next≤' + BUDGET.next + '）');
  console.log('  文件体积    : ' + (bytes / 1024).toFixed(1) + ' KB');
}

build();
