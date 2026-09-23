/* ============================================================
 * collectors · source-fetcher.cjs（G5.2）
 * ------------------------------------------------------------
 * 职责两件：
 *   1. **读登记表**：把 source_registry 投影成采集器需要的来源记录
 *   2. **取来源内容**：把来源内容取成**文本**交给 parser
 *
 * ★★ 关键设计：**取数通道可注入（transport），本模块不内置任何网络代码**
 *   原因（引任务书第 5 节）：本阶段允许 mock feed / RSS / 公开 JSON 接口 /
 *   本地 fixture；**「真实网页抓取需单独评估」**。
 *   → 因此：
 *     · 默认通道 `local`：从本地 fixture 目录读取（零网络，可完整测试）
 *     · 未来联网：由调用方**注入** `opts.transport = async () => ({status, body, ...})`，
 *       届时单独评估后再实现；本模块代码**不需要改动**
 *
 * ★★ 两条纪律：
 *   1. **禁止根据名称推断 owner_group** —— 一律从登记表字段**原样读取**；
 *      登记表缺失或未确认时**不得猜测**，按登记表实际值（`独立` / `待核` / `unknown`）透传
 *   2. **合规守卫**：`enabled=false` 或 `crawl_policy ∈ {ai_ban_named, ai_ban_notice, blocked}`
 *      的来源**拒绝采集**（R6.3）
 * ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');

const registry = require('../../engine/news-registry.cjs');

const POLICY_REFUSE = ['ai_ban_named', 'ai_ban_notice', 'blocked'];

function fail(code, message) {
  const e = new Error('[' + code + '] ' + message);
  e.code = code;
  throw e;
}

/* ---------------- 1. 读登记表 ---------------- */

/**
 * 把登记表条目投影成采集器来源记录。
 * ★ 字段名映射说明（任务书第 3 节的叫法 ↔ 登记表实际字段名）：
 *     source_id   ≡ registry_id
 *     source_url  ≡ feed_url（登记出口）
 *   两个名字都保留，避免下游按不同叫法取不到值。
 * ★ owner_group 原样透传，**不做任何推断**。
 */
function projectSource(entry) {
  if (!entry) return null;
  return {
    source_id: entry.registry_id,
    registry_id: entry.registry_id,
    source_name: entry.source_name,
    source_url: entry.feed_url || '',
    feed_url: entry.feed_url || '',
    owner_group: entry.owner_group || 'unknown',
    source_type: entry.source_type,
    tier: entry.tier,
    feed_type: entry.feed_type,
    crawl_policy: entry.crawl_policy,
    enabled: entry.enabled === true
  };
}

/** 全部来源（可选：仅已启用 / 仅可采集） */
function listSources(opts) {
  const o = opts || {};
  let list = registry.all().map(projectSource).filter(Boolean);
  if (o.enabledOnly) list = list.filter(function (s) { return s.enabled; });
  if (o.collectableOnly) list = list.filter(function (s) { return isCollectable(s).ok; });
  return list;
}

/** 按 registry_id 取来源（未登记 → 抛 UNKNOWN_REGISTRY_ID，fail closed） */
function getSource(sourceId) {
  const p = projectSource(registry.byId(sourceId));
  if (!p) fail('UNKNOWN_REGISTRY_ID', '来源未在登记表中：' + sourceId);
  return p;
}

/** 合规与可用性守卫
 * ★ 检查顺序：**先政策、后启用** —— 对 THR/EW/Collider 这类
 *   「因合规政策而停用」的来源，应报 `SOURCE_POLICY_REFUSED`
 *   （说明是合规原因），而不是笼统的 `SOURCE_DISABLED`。 */
function isCollectable(source) {
  const s = source || {};
  if (POLICY_REFUSE.indexOf(s.crawl_policy) >= 0) {
    return {
      ok: false, code: 'SOURCE_POLICY_REFUSED',
      message: '来源 crawl_policy=' + s.crawl_policy + '，按 R6.3 禁止采集（仅可人工录入）'
    };
  }
  if (!s.enabled) return { ok: false, code: 'SOURCE_DISABLED', message: '来源未启用（enabled=false）' };
  if (!s.feed_url) return { ok: false, code: 'SOURCE_NO_FEED_URL', message: '来源未登记可用出口' };
  return { ok: true, code: '', message: '' };
}

/* ---------------- 2. 取内容 ---------------- */

const FIXTURE_EXT = ['rss', 'xml', 'json', 'html'];

/** 在 fixture 目录中定位某来源的夹具文件 */
function findFixture(source, opts) {
  const dir = (opts && opts.fixtureDir) ? String(opts.fixtureDir) : '';
  if (!dir) return '';
  for (let i = 0; i < FIXTURE_EXT.length; i++) {
    const p = path.join(dir, source.registry_id + '.' + FIXTURE_EXT[i]);
    if (fs.existsSync(p)) return p;
  }
  return '';
}

/**
 * 本地 fixture 通道（默认）。
 * @returns {Promise<{status, body, contentType, fetched_at, url, transport}>}
 */
function localTransport(source, opts) {
  const file = findFixture(source, opts);
  if (!file) {
    fail('FIXTURE_NOT_FOUND',
      '未找到来源夹具：' + source.registry_id + '（期望 ' + FIXTURE_EXT.join('/') + ' 之一）');
  }
  const body = fs.readFileSync(file, 'utf8');
  const ext = path.extname(file).slice(1).toLowerCase();
  return Promise.resolve({
    status: 200,
    body: body,
    contentType: ext === 'json' ? 'application/json' : (ext === 'html' ? 'text/html' : 'application/rss+xml'),
    fetched_at: (opts && opts.now) || new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    url: (opts && opts.url) || source.feed_url,
    transport: 'local'
  });
}

/**
 * 取来源内容（统一入口）。
 * @param {object} source  projectSource 出来的来源记录
 * @param {object} opts    { fixtureDir, transport, now, allowDisabled }
 * @returns {Promise<{status, body, contentType, fetched_at, url, transport}>}
 * @throws SOURCE_DISABLED / SOURCE_POLICY_REFUSED / SOURCE_NO_FEED_URL /
 *         FIXTURE_NOT_FOUND / TRANSPORT_FAILED
 */
function fetchContent(source, opts) {
  const o = opts || {};
  const gate = isCollectable(source);
  if (!gate.ok && !o.allowDisabled) fail(gate.code, gate.message);

  /* ★ 联网通道由调用方注入；本模块不内置任何网络实现 */
  const transport = (typeof o.transport === 'function') ? o.transport : localTransport;
  let p;
  try {
    p = transport(source, o);
  } catch (e) {
    /* ★ 保留原始错误码（如 FIXTURE_NOT_FOUND），不要一律降级为 TRANSPORT_FAILED */
    fail((e && e.code) || 'TRANSPORT_FAILED', '取数通道抛错：' + (e && e.message));
  }
  return Promise.resolve(p).then(function (res) {
    if (!res || typeof res.body !== 'string') {
      fail('TRANSPORT_FAILED', '取数通道未返回文本 body');
    }
    return res;
  }, function (e) {
    fail((e && e.code) || 'TRANSPORT_FAILED', '取数通道失败：' + (e && e.message));
  });
}

module.exports = {
  POLICY_REFUSE,
  FIXTURE_EXT,
  projectSource,
  listSources,
  getSource,
  isCollectable,
  findFixture,
  localTransport,
  fetchContent
};
