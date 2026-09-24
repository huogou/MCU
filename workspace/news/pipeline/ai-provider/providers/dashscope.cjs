/* ============================================================
 * N1.2 U1 · DashScope（阿里云百炼）Provider
 * ------------------------------------------------------------
 * 形态：OpenAI-compatible Chat Completions（P5）。
 * 目标：单次「文本 → 7 字段 JSON」（§6 / §8）。不做工具/联网/Agent。
 * 结构化输出（§7）：优先 JSON Schema；不支持时可由上层退回 JSON Object。
 * ★ Provider 只负责「拿到模型返回的对象」；最终契约仍由 N1.1
 *   contract-validator.cjs 校验（禁止绕过）。Provider 不注入 ai_model。
 * ============================================================ */
'use strict';

const A = require('../adapter.cjs');
const PT = require('../provider-transport.cjs');

const DEFAULT_BASE = 'https://dashscope.aliyuncs.com/compatible-mode/v1';
const SEVEN = Object.freeze([
  'title', 'summary', 'category',
  'related_movies', 'related_series', 'related_characters', 'related_phases'
]);

function fail(code, message) {
  const e = new Error('[' + code + '] ' + message);
  e.code = code;
  throw e;
}

/* JSON Schema（与 7 字段契约对齐；不创造第二套定义） */
const JSON_SCHEMA = Object.freeze({
  name: 'mcu_news_structuring',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: SEVEN.slice(),
    properties: {
      title: { type: 'string' },
      summary: { type: 'string' },
      category: { type: 'string' },
      related_movies: { type: 'array', items: { type: 'string' } },
      related_series: { type: 'array', items: { type: 'string' } },
      related_characters: { type: 'array', items: { type: 'string' } },
      related_phases: { type: 'array', items: { type: 'integer' } }
    }
  }
});

function buildMessages(payload) {
  const sys = [
    'You are a strict news-structuring function for an MCU (Marvel Cinematic Universe) news index.',
    'Output EXACTLY ONE JSON object with EXACTLY these 7 keys and nothing else:',
    'title, summary, category, related_movies, related_series, related_characters, related_phases.',
    'Rules:',
    '- title and summary MUST be Simplified Chinese plain text; NO HTML, NO Markdown.',
    '- category MUST be exactly one of: movie, series, special, short, character, industry.',
    '- related_movies / related_series / related_characters MUST be arrays of strings (use [] if unknown).',
    '- related_phases MUST be an array of integers between 1 and 6 (use [] if unknown).',
    '- NEVER output ai_model or any key outside the 7 listed.',
    '- Return raw JSON only, no prose, no code fences.'
  ].join('\n');
  const user = 'Source material (JSON, minimal fields):\n' + JSON.stringify(payload)
    + '\n\nReturn the 7-field JSON object now.';
  return [{ role: 'system', content: sys }, { role: 'user', content: user }];
}

/**
 * 创建 DashScope provider。
 * @param {object} cfg { apiKey, model, baseUrl?, structuredOutput?, temperature?, transport? }
 * @returns provider（N1.1 createProvider 产物）
 */
function createDashScopeProvider(cfg) {
  const c = cfg || {};
  if (!c.apiKey || !String(c.apiKey).trim()) fail('PROVIDER_KEY_MISSING', '缺少 apiKey');
  if (!c.model || !String(c.model).trim()) fail('PROVIDER_MODEL_MISSING', '缺少 model');
  const baseUrl = String(c.baseUrl || DEFAULT_BASE).replace(/\/+$/, '');
  const url = baseUrl + '/chat/completions';
  const transport = c.transport || PT.createProviderTransport({ timeoutMs: c.timeoutMs });
  const structuredOutput = c.structuredOutput || 'json_schema';
  const temperature = (c.temperature == null ? 0.2 : c.temperature);

  async function provide(input) {
    const body = {
      model: String(c.model),
      messages: buildMessages(input),
      temperature: temperature
    };
    if (structuredOutput === 'json_schema') body.response_format = { type: 'json_schema', json_schema: JSON_SCHEMA };
    else if (structuredOutput === 'json_object') body.response_format = { type: 'json_object' };

    /* Authorization 只在此处构造，绝不记录 / 绝不返回 */
    const headers = { 'Authorization': 'Bearer ' + String(c.apiKey) };

    const res = await transport.postJson(url, headers, body);

    let doc = null;
    try { doc = JSON.parse(res.text); } catch (e) { doc = null; }

    if (res.status !== 200) {
      const pcode = (doc && doc.error && doc.error.code) ? String(doc.error.code) : ('HTTP_' + res.status);
      const pmsg = (doc && doc.error && doc.error.message) ? String(doc.error.message) : ('HTTP ' + res.status);
      const e = new Error('[PROVIDER_HTTP_ERROR] ' + pcode + ' ' + pmsg.slice(0, 240));
      e.code = 'PROVIDER_HTTP_ERROR';
      e.http_status = res.status;
      e.provider_code = pcode;
      throw e;
    }

    const content = doc && doc.choices && doc.choices[0] && doc.choices[0].message
      && doc.choices[0].message.content;
    if (content == null) fail('PROVIDER_EMPTY_RESPONSE', 'Provider 未返回 message.content');

    let obj;
    if (typeof content === 'string') {
      try { obj = JSON.parse(content); }
      catch (e) { fail('PROVIDER_BAD_JSON', 'Provider 返回内容不是合法 JSON'); }
    } else {
      obj = content;
    }
    /* 原样返回给 N1.1 validator（不裁剪字段、不注入 ai_model） */
    return obj;
  }

  return A.createProvider('dashscope', { provide: provide });
}

module.exports = { createDashScopeProvider, DEFAULT_BASE, SEVEN, JSON_SCHEMA, buildMessages };
