/* ============================================================
 * collectors · parser.cjs（G5.2）
 * ------------------------------------------------------------
 * 职责：把**已取得的文本**解析成「原始条目」列表。
 *   · 纯函数，零网络（不发起任何请求；文本由调用方提供）
 *   · 不生成任何状态字段
 *   · **不改写标题**（title_raw 原样保留）
 *
 * 支持的输入（任务书第 5 节）：
 *   rss | atom        —— 轻量级标签解析，无第三方依赖
 *   json              —— 公开 JSON 接口（数组 / items / data / entries / articles）
 *   mock / local      —— 与 rss/json 同构的本地夹具
 * **暂不支持**：复杂网页解析（html-parse）→ 明确返回
 *   `HTML_PARSE_NOT_IN_SCOPE`（任务书第 5 节：真实网页抓取需单独评估）
 *
 * ★ 实测陷阱（R6.2，必须遵守）：
 *   · The Direct 的条目级时间戳在 `<dc:date>`，`<pubDate>` 只出现在频道级
 *     → 时间字段解析必须按 `pubDate → dc:date → updated → published` 依次尝试
 *   · ComicBook 必须用 `/category/marvel/feed/`（路径错误会静默回落主 feed）
 *     → 该陷阱属「出口选择」，由 source_registry.feed_url 保证；
 *       本模块在解析前校验实际 URL 与登记出口是否一致
 * ============================================================ */
'use strict';

const HTML_PARSE_NOT_IN_SCOPE = 'HTML_PARSE_NOT_IN_SCOPE';

function fail(code, message) {
  const e = new Error('[' + code + '] ' + message);
  e.code = code;
  throw e;
}

/* ---------------- 工具 ---------------- */

const ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  ldquo: '“', rdquo: '”', lsquo: '‘', rsquo: '’', mdash: '—', ndash: '–', hellip: '…'
};

function decodeEntities(s) {
  return String(s == null ? '' : s)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#x([0-9a-f]+);/gi, function (_, h) { return String.fromCodePoint(parseInt(h, 16)); })
    .replace(/&#(\d+);/g, function (_, d) { return String.fromCodePoint(parseInt(d, 10)); })
    .replace(/&([a-z]+);/gi, function (m, n) { return ENTITIES[n.toLowerCase()] != null ? ENTITIES[n.toLowerCase()] : m; });
}

function escapeRe(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

/** 取第一个同名标签的内容 */
function tag(block, name) {
  const n = escapeRe(name);
  const m = new RegExp('<' + n + '\\b[^>]*>([\\s\\S]*?)<\\/' + n + '>', 'i').exec(block);
  return m ? decodeEntities(m[1]).trim() : '';
}

/** 取 link：兼容 RSS `<link>url</link>` 与 Atom `<link href="url"/>` */
function linkOf(block) {
  const direct = tag(block, 'link');
  if (direct) return direct;
  const m = /<link\b[^>]*\bhref\s*=\s*["']([^"']+)["']/i.exec(block);
  return m ? decodeEntities(m[1]).trim() : '';
}

/** 频道级时间（用于诊断：若条目级时间全空、而频道级有值，说明读错了标签） */
function channelDate(text) {
  const head = text.split(/<item\b|<entry\b/i)[0] || '';
  return tag(head, 'pubDate') || tag(head, 'lastBuildDate') || tag(head, 'updated');
}

/* ---------------- XML / RSS / Atom ---------------- */

function splitXmlItems(text) {
  const out = [];
  const re = /<item\b[^>]*>([\s\S]*?)<\/item>|<entry\b[^>]*>([\s\S]*?)<\/entry>/gi;
  let m;
  while ((m = re.exec(text)) !== null) out.push(m[1] != null ? m[1] : m[2]);
  return out;
}

/**
 * 解析 RSS / Atom 文本 → 原始条目[]
 * 每条：{ title_raw, url, published_at_raw, excerpt_raw, guid }
 * ※ 不做任何改写；**不生成状态**
 */
function parseXml(text) {
  const blocks = splitXmlItems(text);
  return blocks.map(function (b) {
    return {
      title_raw: tag(b, 'title'),
      url: linkOf(b),
      /* ★ 依次尝试：pubDate → dc:date → updated → published（The Direct 陷阱） */
      published_at_raw: tag(b, 'pubDate') || tag(b, 'dc:date') || tag(b, 'updated') || tag(b, 'published'),
      excerpt_raw: tag(b, 'description') || tag(b, 'content:encoded') || tag(b, 'summary') || tag(b, 'content'),
      guid: tag(b, 'guid') || tag(b, 'id')
    };
  });
}

/* ---------------- JSON ---------------- */

const JSON_TITLE = ['title', 'headline', 'name'];
const JSON_URL = ['url', 'link', 'permalink', 'webUrl', 'href'];
const JSON_DATE = ['published_at', 'publishedAt', 'published', 'pubDate', 'date', 'pub_date', 'created_at'];
const JSON_TEXT = ['summary', 'description', 'excerpt', 'abstract', 'content'];

function pick(o, keys) {
  for (let i = 0; i < keys.length; i++) {
    const v = o[keys[i]];
    if (typeof v === 'string' && v.trim()) return v.trim();
    if (typeof v === 'number') return String(v);
  }
  return '';
}

/** 解析公开 JSON 接口文本 → 原始条目[] */
function parseJson(text) {
  let doc;
  try { doc = JSON.parse(text); } catch (e) { fail('JSON_PARSE_FAILED', 'JSON 解析失败：' + e.message); }
  const arr = Array.isArray(doc) ? doc
    : (doc && (doc.items || doc.data || doc.entries || doc.articles || doc.results)) || [];
  if (!Array.isArray(arr)) fail('JSON_SHAPE_UNSUPPORTED', 'JSON 结构不支持：既非数组，也无 items/data/entries/articles/results');
  return arr.map(function (o) {
    const src = (o && typeof o === 'object') ? o : {};
    return {
      title_raw: pick(src, JSON_TITLE),
      url: pick(src, JSON_URL),
      published_at_raw: pick(src, JSON_DATE),
      excerpt_raw: pick(src, JSON_TEXT),
      guid: pick(src, ['id', 'guid', 'uuid'])
    };
  });
}

/* ---------------- 统一入口 ---------------- */

/**
 * 按 feed_type 解析文本。
 * @param {string} text 来源文本（由调用方取得，本模块不联网）
 * @param {string} feedType 'rss' | 'atom' | 'json' | 'html-parse'
 * @returns {{ok:boolean, items:Array, code?:string, message?:string, diagnostic?:object}}
 */
function parse(text, feedType) {
  const t = String(text == null ? '' : text);
  const ft = String(feedType || '').toLowerCase();

  if (ft === 'html-parse') {
    /* 任务书第 5 节：暂不要求复杂网页解析 */
    return {
      ok: false, items: [], code: HTML_PARSE_NOT_IN_SCOPE,
      message: 'html-parse 不在本阶段范围（真实网页抓取需单独评估）'
    };
  }
  if (!t.trim()) return { ok: false, items: [], code: 'EMPTY_CONTENT', message: '来源内容为空' };

  try {
    if (ft === 'rss' || ft === 'atom') {
      const items = parseXml(t);
      const diag = { item_count: items.length, channel_date: channelDate(t) };
      /* ★ 陷阱告警：条目级时间全空但频道级有值 → 很可能读错了标签 */
      if (items.length && items.every(function (x) { return !x.published_at_raw; }) && diag.channel_date) {
        diag.warning = 'ENTRY_DATE_MISSING_BUT_CHANNEL_DATE_PRESENT';
        diag.hint = '条目级时间全空而频道级有值 —— 检查是否漏读 <dc:date>（The Direct 陷阱）';
      }
      if (!items.length) return { ok: false, items: [], code: 'NO_ITEMS_PARSED', message: '未解析到任何条目', diagnostic: diag };
      return { ok: true, items: items, diagnostic: diag };
    }
    if (ft === 'json' || ft === 'mock' || ft === 'local') {
      const items = parseJson(t);
      if (!items.length) return { ok: false, items: [], code: 'NO_ITEMS_PARSED', message: '未解析到任何条目' };
      return { ok: true, items: items, diagnostic: { item_count: items.length } };
    }
    return { ok: false, items: [], code: 'UNSUPPORTED_FEED_TYPE', message: '不支持的 feed_type：' + feedType };
  } catch (e) {
    return { ok: false, items: [], code: e.code || 'PARSE_FAILED', message: e.message };
  }
}

module.exports = {
  HTML_PARSE_NOT_IN_SCOPE,
  decodeEntities,
  tag,
  linkOf,
  channelDate,
  splitXmlItems,
  parseXml,
  parseJson,
  parse
};
