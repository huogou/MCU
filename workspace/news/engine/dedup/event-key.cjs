/* ============================================================
 * MCU 宇宙导航 · 事件指纹 event_key V1.0（G4）
 * ------------------------------------------------------------
 * 用途：识别「同一条新闻事件」，为去重与合并提供确定性指纹。
 *
 * 性质：纯函数。零网络、零 AI、零副作用、无时间依赖。
 *   ★ 同输入必得同输出（确定性由测试断言）。
 *
 * ★ 明确禁止：**直接对 title 做 hash**。
 *   本实现把 event_key 拆成三个可审计的成分，再对**成分**取指纹：
 *     ① entitySig  关联实体集合（movie / series / character）—— **主信号**
 *     ② actionSig  标题命中的「事件动作词」集合（封闭词表，不含状态词）
 *     ③ textSig    标题文本指纹（2-gram + 拉丁/数字词）—— **仅作兜底**
 *   并通过 explain() 把三者**显式暴露**，便于审计与排障。
 *
 * ★ 两条关键设计取舍：
 *   1) **publish_time 不参与 key 计算**。
 *      理由：需求 E4 要求「日期不同 → 可识别同事件」；
 *      时间只交给 merger 做**时间窗口候选判断**（见 event-merger.cjs）。
 *   2) **状态词不参与 key 计算**（官方 / 正式 / 官宣 / 确认 / 否认 / 辟谣 /
 *      传闻 / 网传 / 爆料 / 据称 / 疑似 / 将 / 已 / 可能 …）。
 *      理由：R8.8「状态不是永久事实标签」—— 同一条事件会随证据演进改状态，
 *      事件身份必须**跨状态稳定**，否则每次状态变更都会产生新的 event_key。
 * ============================================================ */
'use strict';

const crypto = require('crypto');

const KEY_VERSION = '1';
const KEY_PREFIX = 'evt1-';

/* ------------------------------------------------------------
 * 词表（全部为封闭词表，可审计、可回归）
 * ------------------------------------------------------------ */

/* 媒体模板词 —— 直接删除（不承载事件信息） */
const TEMPLATE_WORDS = Object.freeze([
  '独家', '快讯', '首发', '重磅', '突发', '深度', '解读', '观察', '盘点',
  '汇总', '梳理', '最新', '据悉', '据外媒', '编译', '译文', '转载', '来源',
  '图集', '组图', '高清图', '视频', '全文', '原文', '一文看懂', '划重点',
  '首支', '首曝', '首度', '首次'
]);

/* 状态 / 措辞词 —— 删除（事件身份须跨状态稳定，R8.8） */
const STATUS_WORDS = Object.freeze([
  '官方', '正式', '官宣', '确认', '证实', '否认', '辟谣', '澄清',
  '传闻', '网传', '爆料', '曝', '据称', '疑似', '未具名', '有消息称',
  '业内人士称', '消息人士称', '可能', '或将', '将要', '预计', '拟',
  '正在', '已经', '已', '将', '计划'
]);

/* 功能词 —— 删除（不承载名词信息） */
const FUNCTION_WORDS = Object.freeze([
  '的', '了', '在', '与', '和', '及', '其', '该', '这', '那', '是', '为',
  '被', '把', '对', '从', '到', '并', '而', '但', '等', '之', '中', '就',
  '都', '也', '还', '又', '再', '更', '很', '最', '关于', '对于', '由',
  '向', '给', '让', '使', '以', '于', '则', '因', '所', '如', '若', '或'
]);

/* 事件动作词（★★ 供 actionSig 使用；**刻意不含状态词**）
 * 语义：描述「发生了什么」，而不是「这条消息可信度如何」。 */
const ACTION_WORDS = Object.freeze([
  '预告', '预告片', '上映', '定档', '改档', '撤档', '延期', '提前',
  '杀青', '开机', '开拍', '拍摄', '补拍', '重拍',
  '选角', '加盟', '回归', '退出', '离开', '换角',
  '续集', '续订', '取消', '完结', '季终', '重启', '衍生',
  '首映', '首播', '播出', '上线', '下架', '重映',
  '票房', '口碑', '评分', '破纪录',
  '剧照', '海报', '物料', '幕后', '花絮', '片段', '删减',
  '开发', '筹备', '立项', '制作', '拍摄计划',
  '访谈', '采访', '问答', '座谈',
  '特展', '活动', '展会', '发布会', '见面会',
  '联动', '客串', '同框', '彩蛋',
  '定名', '改名', '换名', '更名'
]);

/* 日期模式（先于符号清理执行） */
const DATE_PATTERNS = Object.freeze([
  /\d{4}\s*年\s*\d{1,2}\s*月\s*\d{1,2}\s*日/g,
  /\d{4}\s*年\s*\d{1,2}\s*月/g,
  /\d{1,2}\s*月\s*\d{1,2}\s*日/g,
  /\d{4}[-/.]\d{1,2}[-/.]\d{1,2}/g,
  /\d{1,2}[-/.]\d{1,2}[-/.]\d{4}/g,
  /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{1,2}(st|nd|rd|th)?(,?\s*\d{4})?/gi,
  /\b\d{1,2}(st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?(,?\s*\d{4})?/gi
]);

/* ------------------------------------------------------------
 * 文本标准化
 * ------------------------------------------------------------ */

/** 全角 → 半角（含全角空格） */
function toHalfWidth(s) {
  return String(s).replace(/[\uFF01-\uFF5E]/g, function (c) {
    return String.fromCharCode(c.charCodeAt(0) - 0xFEE0);
  }).replace(/\u3000/g, ' ');
}

/**
 * 标题标准化：去日期 → 去噪声括号 → 去符号 → 去模板/状态/功能词
 * 返回 { normalized, removed: { dates, brackets } }
 */
function normalizeTitle(title) {
  let s = String(title == null ? '' : title);
  s = toHalfWidth(s);
  s = s.toLowerCase();

  /* 1) 去噪声括号（【】〖〗［］[_]） */
  const bracketRe = /【[^】]*】|〖[^〗]*〗|［[^］]*］|\[[^\]]*\]/g;
  const bracketHits = (s.match(bracketRe) || []).slice();
  s = s.replace(bracketRe, ' ');

  /* 2) 去日期 */
  const dateHits = [];
  DATE_PATTERNS.forEach(function (re) {
    const m = s.match(re);
    if (m) dateHits.push.apply(dateHits, m);
    s = s.replace(re, ' ');
  });

  /* 3) 去括号符号，但保留括号内内容（《》〈〉「」『』""''()（） 等一律去符号留内容） */
  s = s.replace(/[《》〈〉「」『』“”‘’"'`()（）\[\]{}<>]/g, ' ');

  /* 4) 去所有标点与符号（保留中日韩文字、字母、数字、空格） */
  s = s.replace(/[^\u4e00-\u9fff\u3400-\u4dbfa-z0-9\s]/g, ' ');

  /* 5) 去词表词（模板 / 状态 / 功能）—— 用空格替换，避免粘连产生假词 */
  const all = TEMPLATE_WORDS.concat(STATUS_WORDS, FUNCTION_WORDS)
    .slice()
    .sort(function (a, b) { return b.length - a.length; });   /* 长词优先，避免短词切碎长词 */
  all.forEach(function (w) {
    if (!w) return;
    s = s.split(w).join(' ');
  });

  /* 6) 去独立出现的长数字（疑似年份，如 2026 / 1999） */
  s = s.replace(/\b(19|20)\d{2}\b/g, ' ');

  /* 7) 压缩空白 */
  s = s.replace(/\s+/g, ' ').trim();

  return { normalized: s, removed: { dates: dateHits, brackets: bracketHits } };
}

/* ------------------------------------------------------------
 * 三个成分
 * ------------------------------------------------------------ */

const KIND_KEYS = Object.freeze([
  ['movie', 'related_movies'],
  ['series', 'related_series'],
  ['character', 'related_characters']
]);

/** 成分 ①：关联实体集合 → 规范化为 kind:id 并排序去重 */
function buildEntitySig(input) {
  const src = input || {};
  const list = [];
  KIND_KEYS.forEach(function (pair) {
    const kind = pair[0], field = pair[1];
    const arr = src[field];
    if (!Array.isArray(arr)) return;
    arr.forEach(function (id) {
      if (id == null) return;
      const v = String(id).trim().toLowerCase();
      if (!v) return;
      list.push(kind + ':' + v);
    });
  });
  return Array.from(new Set(list)).sort();
}

/** 成分 ②：动作词集合（在标准化文本上扫描封闭词表） */
function buildActionSig(normalized) {
  const hits = [];
  const s = String(normalized || '');
  ACTION_WORDS.forEach(function (w) {
    if (w && s.indexOf(w) >= 0) hits.push(w);
  });
  /* 去掉被更长词包含的短词（如「预告」与「预告片」同时命中时只留长的） */
  const filtered = hits.filter(function (w) {
    return !hits.some(function (o) { return o !== w && o.length > w.length && o.indexOf(w) >= 0; });
  });
  return Array.from(new Set(filtered)).sort();
}

/** 成分 ③：文本指纹（中文 2-gram + 拉丁词 + 数字），**仅作兜底** */
function buildTextSig(normalized) {
  const s = String(normalized || '');
  const tokens = [];
  /* 中文段：段内取 2-gram；单字段取单字 */
  const runs = s.match(/[\u4e00-\u9fff\u3400-\u4dbf]+/g) || [];
  runs.forEach(function (run) {
    if (run.length === 1) { tokens.push(run); return; }
    for (let i = 0; i + 2 <= run.length; i++) tokens.push(run.substr(i, 2));
  });
  /* 拉丁词与数字 */
  (s.match(/[a-z0-9]+/g) || []).forEach(function (t) { tokens.push(t); });

  const uniq = Array.from(new Set(tokens)).sort();
  if (!uniq.length) return '';
  return sha1(uniq.join('|')).slice(0, 10);
}

/* ------------------------------------------------------------
 * 指纹
 * ------------------------------------------------------------ */

function sha1(s) {
  return crypto.createHash('sha1').update(String(s), 'utf8').digest('hex');
}

function normalizeCategory(c) {
  const v = String(c == null ? '' : c).trim().toLowerCase();
  return v || 'unknown';
}

/**
 * 生成 event_key。
 * @param {object} input {
 *   title, summary, category,
 *   related_movies, related_series, related_characters,
 *   publish_time   ← ★ 参与签名校验但**不影响 key**
 * }
 * @returns {string} 形如 evt1-xxxxxxxxxxxxxxxx
 */
function buildEventKey(input) {
  const src = input || {};
  const norm = normalizeTitle(src.title);
  const entitySig = buildEntitySig(src);
  const actionSig = buildActionSig(norm.normalized);
  const textSig = buildTextSig(norm.normalized);
  const category = normalizeCategory(src.category);

  /* ★ 模式选择：
   *   有实体 → mode='entity'，**不含标题文本**（措辞差异不影响事件身份，E1 由此成立）
   *   无实体 → mode='text'  ，退化为文本指纹（宁可不合，不可误合） */
  const mode = entitySig.length ? 'entity' : 'text';
  const payload = [
    'v=' + KEY_VERSION,
    'cat=' + category,
    'ent=' + entitySig.join(','),
    'act=' + actionSig.join(','),
    'mode=' + mode,
    'txt=' + (mode === 'text' ? textSig : '')
  ].join(';');

  return KEY_PREFIX + sha1(payload).slice(0, 16);
}

/**
 * 审计接口：返回 key 的全部成分，便于排障与人工复核。
 * （key 本身不可逆，本函数是唯一的可解释入口）
 */
function explain(input) {
  const src = input || {};
  const norm = normalizeTitle(src.title);
  const entitySig = buildEntitySig(src);
  const actionSig = buildActionSig(norm.normalized);
  const textSig = buildTextSig(norm.normalized);
  const category = normalizeCategory(src.category);
  const mode = entitySig.length ? 'entity' : 'text';

  return {
    event_key: buildEventKey(src),
    key_version: KEY_VERSION,
    mode: mode,
    category: category,
    entity_sig: entitySig,
    action_sig: actionSig,
    text_sig: mode === 'text' ? textSig : '(未使用)',
    normalized_title: norm.normalized,
    removed: norm.removed,
    time_participates: false,          /* ★ publish_time 不参与 key */
    note: 'publish_time 与状态词均不参与 key；时间仅用于 merger 的窗口候选判断'
  };
}

module.exports = {
  KEY_VERSION,
  KEY_PREFIX,
  TEMPLATE_WORDS,
  STATUS_WORDS,
  FUNCTION_WORDS,
  ACTION_WORDS,
  normalizeTitle,
  buildEntitySig,
  buildActionSig,
  buildTextSig,
  buildEventKey,
  explain
};
