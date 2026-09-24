/* ============================================================
 * N1.2 U1 · AI Input Projection（P1：出域最小化）
 * ------------------------------------------------------------
 * 定位：在真实 Provider 调用之前，把 L1 candidate **投影**为
 *       「完成新闻结构化所需的最小业务内容」。
 *
 * 硬约束（P1 / §4 / §5）：
 *   - 禁止 JSON.stringify(l1Candidate) 直送；只允许白名单字段出域；
 *   - 白名单必须显式；任何无法确定是否应出域的字段 → 默认不出域；
 *   - 输出键必须全部落在白名单内（越权键立即失败，不静默）；
 *   - 本模块不联网、不落盘、纯函数。
 * ============================================================ */
'use strict';

/* 允许出域的最小字段（显式 allowlist）——仅原始标题 + 原始摘要 */
const ALLOW = Object.freeze(['title_raw', 'raw_excerpt']);

/* 默认禁止出域字段（明示；实际由 allowlist 结构保证不出域） */
const FORBIDDEN = Object.freeze([
  /* 内部运行 / 管道元数据 */
  'ai_model', 'run_id', 'pipeline_run_id', 'provider', 'provider_status',
  'gate_status', 'ai_suggested_status', 'verification_status', 'judged_by',
  'status_history', 'candidate_id', 'event_key', 'capture_id', 'capture_refs',
  'content_hash', 'registry_id', 'occurrence',
  /* 重试 / 错误 / 路径 / 环境 */
  'retry', 'retry_count', 'error', 'error_code', 'reason',
  'filesystem_path', 'file', 'path', 'env', 'environment',
  /* 凭据类 */
  'api_key', 'apikey', 'token', 'authorization', 'credentials', 'secret',
  /* 来源元数据 / URL（7 字段结构化不需要，默认不出域） */
  'source_url', 'original_source_url', 'original_source', 'url_level',
  'reported_by', 'owner_group', 'source_name', 'feed_type', 'http_status'
]);

function fail(code, message) {
  const e = new Error('[' + code + '] ' + message);
  e.code = code;
  throw e;
}

/**
 * 投影：L1 candidate → 最小 Provider payload。
 * @param {object} candidate L1 候选
 * @returns {{payload:object, allowed:string[], forbidden:string[], fieldCount:number}}
 * @throws PROJECTION_INVALID | PROJECTION_LEAK
 */
function project(candidate) {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    fail('PROJECTION_INVALID', 'projection 输入必须是普通对象');
  }
  const payload = {};
  ALLOW.forEach(function (k) {
    if (k in candidate && candidate[k] != null && String(candidate[k]).trim()) {
      payload[k] = String(candidate[k]);
    }
  });
  /* 结构保证：输出键必须全部在白名单内 */
  Object.keys(payload).forEach(function (k) {
    if (ALLOW.indexOf(k) < 0) fail('PROJECTION_LEAK', '投影输出出现白名单之外字段：' + k);
  });
  return {
    payload: payload,
    allowed: ALLOW.slice(),
    forbidden: FORBIDDEN.slice(),
    fieldCount: Object.keys(payload).length
  };
}

/** 扫描输入中命中的禁止字段名（供安全测试断言，不参与出域） */
function scanForbidden(obj) {
  const present = [];
  if (obj && typeof obj === 'object') {
    Object.keys(obj).forEach(function (k) {
      if (FORBIDDEN.indexOf(k) >= 0) present.push(k);
    });
  }
  return present;
}

module.exports = { ALLOW, FORBIDDEN, project, scanForbidden };
