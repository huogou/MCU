/* ============================================================
 * N1.2 · manualCaptureLoader（S001 人工投递入口，D1 D+A 方案）
 * ------------------------------------------------------------
 * 定位：人工把结构化 JSON 投递到 inbox 目录 → 转换为现有 L0 RawCapture。
 *
 * 设计约束（D1 正式拍板 + 冻结边界）：
 *   - 复用现有 L0 入参能力（raw-capture.cjs 的 RC.create 与校验）；
 *   - 文件投递型入口（JSON）；不建设后台 UI；不建设常驻目录监听；
 *   - 不自动调用真实 AI；支持测试 fixture；
 *   - 输入错误必须明确失败（进 errors，不静默）；成功必须能进入后续 Adapter 流程；
 *   - 失败 fail-closed：单条失败不影响其它条；不污染正式数据。
 *
 * 说明：G5.2 parser.cjs 对 html-parse 返回 HTML_PARSE_NOT_IN_SCOPE（不在范围），
 *   故本入口接收**结构化 JSON**（已是合法 L0，或最小人工提交结构），而非原始 HTML。
 * ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');

const RC = require('../raw-capture.cjs');             /* G5（冻结，仅读） */
const REG = require('../../engine/news-registry.cjs'); /* 登记表（仅读） */

const DEFAULT_REGISTRY_ID = 'S001';   /* D1：S001 = manual-only（代码白名单排除 S001 自动采集） */
const DEFAULT_FEED_TYPE = 'html-parse';

function nowIso() { return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'); }

/**
 * 读取 inbox 目录下的 JSON 投递，转换为 L0 RawCapture 列表。
 * @param {string} inboxDir 投递目录
 * @param {object} opts { registryId, runId, fetchedAt, httpStatus, feedType }
 * @returns {{captures:Array, errors:Array}}
 */
function loadInbox(inboxDir, opts) {
  opts = opts || {};
  const out = { captures: [], errors: [] };

  if (!inboxDir || !fs.existsSync(inboxDir) || !fs.statSync(inboxDir).isDirectory()) {
    out.errors.push({ stage: 'inbox', code: 'INBOX_NOT_FOUND', message: 'inbox 目录不存在：' + inboxDir });
    return out;
  }

  const files = fs.readdirSync(inboxDir);
  const runId = opts.runId || ('manual-' + new Date().toISOString().slice(0, 10).replace(/-/g, ''));
  const fetchedAt = opts.fetchedAt || nowIso();
  const registryId = opts.registryId || DEFAULT_REGISTRY_ID;
  const feedType = opts.feedType || (REG.byId(registryId) ? REG.byId(registryId).feed_type : DEFAULT_FEED_TYPE);

  files.forEach(function (f, idx) {
    const file = path.join(inboxDir, f);
    /* 仅接受 .json 投递；非 JSON 类型明确失败（不静默跳过） */
    if (!/\.json$/i.test(f)) {
      out.errors.push({ stage: 'inbox', file: f, code: 'UNSUPPORTED_FILE_TYPE', message: 'inbox 仅接受 .json 投递，忽略：' + f });
      return;
    }
    let doc;
    try { doc = JSON.parse(fs.readFileSync(file, 'utf8')); }
    catch (e) { out.errors.push({ stage: 'inbox', file: f, code: 'JSON_PARSE_FAILED', message: e.message }); return; }

    /* 情形 A：已是合法 L0 RawCapture → 直接收（复用现有 L0 契约） */
    const v = RC.validate(doc, { allowExtraFields: false });
    if (v.pass) { out.captures.push(doc); return; }

    /* 情形 B：人工提交的最小结构 → 组装 L0 入参后 RC.create（校验失败明确抛出，不静默） */
    try {
      const src = REG.byId(registryId);
      if (!src) throw new Error('registry_id 未登记：' + registryId);
      const input = {
        capture_id: 'cap-' + registryId + '-' + runId + '-' + String(idx + 1).padStart(3, '0'),
        pipeline_run_id: runId,
        registry_id: registryId,
        source_name: src.source_name,
        source_url: String(doc.source_url || '').trim(),
        title_raw: String(doc.title_raw == null ? '' : doc.title_raw).trim(),
        published_at_raw: String(doc.published_at_raw == null ? '' : doc.published_at_raw),
        fetched_at: fetchedAt,
        feed_type: feedType,
        http_status: opts.httpStatus != null ? opts.httpStatus : 200,
        raw_excerpt: String(doc.raw_excerpt != null ? doc.raw_excerpt : (doc.title_raw || '')).slice(0, 200)
      };
      const capture = RC.create(input);   /* RC.create 内部强校验，失败抛明确错误码 */
      out.captures.push(capture);
    } catch (e) {
      out.errors.push({ stage: 'convert', file: f, code: e.code || 'CAPTURE_INVALID', message: e.message });
    }
  });

  return out;
}

module.exports = { loadInbox, DEFAULT_REGISTRY_ID, DEFAULT_FEED_TYPE };
