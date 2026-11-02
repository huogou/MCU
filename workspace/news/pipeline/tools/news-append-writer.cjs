/* ============================================================
 * N1.2 U2 · news.js 人工授权追加写入器（append-only）
 * ------------------------------------------------------------
 * 定位：生产闭环的**唯一发布动作**。把 delivery-preview 的 33 字段
 *   DeliveryItem 以文本级 append-only 方式写入 h5/data/news.js。
 *   安全模式完整复用 G9（run-g9-write.cjs）：
 *     - 写入前：SHA256 记录 + 可选基线比对（--expect-sha）
 *     - 双备份：news.js.bak-<ts>（h5/data 旁）+ pipeline/review/backup/ 副本
 *     - 字节级保证：旧内容全部字节不变（前缀/后缀校验）
 *     - vm 预验证 + 写入后 vm 复核（条数/旧条目零变化/新条目全在场）
 *     - 幂等：同一 preview run_id 重复写入 → 拒绝（state 记录）
 *
 * 纪律：
 *   1. 只追加，不修改、不删除任何既有条目；
 *   2. 任何检查失败即终止，绝不半写；
 *   3. 必须由人显式执行（本工具无自动触发路径）。
 *
 * 用法：
 *   node tools/news-append-writer.cjs --preview deliveries/<runId>.delivery-preview.json --operator <名>
 *   node tools/news-append-writer.cjs --preview <file> --operator <名> --expect-sha <sha256小写>
 *
 * 退出码：0 成功 / 1 校验或写入失败 / 2 参数错误
 * ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const vm = require('vm');

const PIPELINE = path.resolve(__dirname, '..');
const ROOT = path.resolve(PIPELINE, '..', '..', '..');
const NEWS_JS = path.join(ROOT, 'h5', 'data', 'news.js');
const STATE_FILE = path.join(PIPELINE, 'tools', 'state', 'news-write-state.json');
const BACKUP_DIR = path.join(PIPELINE, 'review', 'backup');

function fail(code, message, exitCode) {
  const e = new Error('[' + code + '] ' + message);
  e.code = code;
  e._exit = exitCode || 1;
  throw e;
}
function die(msg) { console.log('终止：' + msg); process.exit(1); }
function sha(s) { return crypto.createHash('sha256').update(s).digest('hex'); }

function parseArgs(argv) {
  const a = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (t === '--preview') a.preview = argv[++i];
    else if (t === '--operator') a.operator = argv[++i];
    else if (t === '--expect-sha') a.expectSha = argv[++i];
    else a._.push(t);
  }
  return a;
}

/* ---- 序列化器（对齐现网风格：单引号 / 2 空格缩进 / 组间空行；同 G9） ---- */
function jsStr(s) { return "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'"; }
function jsVal(v, ind) {
  const pad = '  '.repeat(ind);
  const padIn = '  '.repeat(ind + 1);
  if (v === null) return 'null';
  if (typeof v === 'string') return jsStr(v);
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) {
    if (v.length === 0) return '[]';
    return '[\n' + v.map(function (x) { return padIn + '  ' + jsVal(x, ind + 1); }).join(',\n') + '\n' + padIn + ']';
  }
  const keys = Object.keys(v);
  return '{\n' + keys.map(function (k) { return padIn + '  ' + k + ': ' + jsVal(v[k], ind + 1); }).join(',\n') + '\n' + pad + '}';
}
function serializeItem(it) { return '  ' + jsVal(it, 1); }

function loadNews(text) {
  const c = {};
  c.window = c; c.global = c; c.console = console;
  c.URL = URL; c.Date = Date; c.Math = Math; c.JSON = JSON;
  vm.createContext(c);
  vm.runInContext(text, c, { filename: 'news.js' });
  return c.window.MCU_NEWS;
}

function readState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); }
  catch (e) { return { writes: [] }; }
}

async function main() {
  const a = parseArgs(process.argv.slice(2));
  if (!a.preview) fail('ARG_MISSING', '缺少 --preview <delivery-preview.json>', 2);
  if (!a.operator || !a.operator.trim()) fail('OPERATOR_REQUIRED', '必须提供 --operator <发布授权人>', 2);
  if (!fs.existsSync(NEWS_JS)) fail('NEWS_JS_NOT_FOUND', 'news.js 不存在：' + NEWS_JS);

  const preview = JSON.parse(fs.readFileSync(a.preview, 'utf8'));
  const items = Array.isArray(preview.items) ? preview.items : [];
  if (!items.length) fail('PREVIEW_EMPTY', 'preview 无交付条目');
  const badField = items.filter(function (it) { return Object.keys(it).length !== 33; });
  if (badField.length) fail('FIELD_COUNT', '存在非 33 字段条目：' + badField.length + ' 条');
  const runId = preview.run_id || path.basename(a.preview);

  /* ---- 幂等守卫：同一 run_id 只允许写入一次 ---- */
  const state = readState();
  if (state.writes.some(function (w) { return w.run_id === runId; })) {
    fail('ALREADY_WRITTEN', '该 preview（run_id=' + runId + '）已写入过 news.js，拒绝重复执行（幂等）');
  }

  /* ---- 写入前：SHA 记录 + 可选基线比对 ---- */
  const rawBefore = fs.readFileSync(NEWS_JS, 'utf8');
  const shaBefore = sha(rawBefore);
  console.log('写入前 news.js SHA256 = ' + shaBefore);
  console.log('预览条目 ' + items.length + ' 条（run_id=' + runId + '）');
  if (a.expectSha && shaBefore !== a.expectSha.toLowerCase()) {
    fail('SHA_MISMATCH', '当前 SHA 与 --expect-sha 不一致（文件已被其他写入改动？），拒绝执行');
  }
  const existing = loadNews(rawBefore);

  /* ---- 双备份 ---- */
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const bak1 = NEWS_JS + '.bak-' + ts;
  const bak2 = path.join(BACKUP_DIR, 'news.js.' + ts);
  fs.copyFileSync(NEWS_JS, bak1);
  fs.copyFileSync(NEWS_JS, bak2);
  if (sha(fs.readFileSync(bak1)) !== shaBefore || sha(fs.readFileSync(bak2)) !== shaBefore) {
    fail('BACKUP_VERIFY', '备份校验失败，拒绝写入');
  }
  console.log('双备份完成：' + bak1 + ' + ' + bak2);

  /* ---- append-only 文本插入（锚点同 G9：数组闭合 '\n];' 之前） ---- */
  const newItemsText = items.map(serializeItem).join(',\n\n');
  const insertAnchor = '\n];';
  const anchorPos = rawBefore.lastIndexOf(insertAnchor);
  if (anchorPos < 0) die('未找到数组闭合锚点');
  const tailObjEnd = rawBefore.lastIndexOf('}', anchorPos);
  if (tailObjEnd < 0) die('未找到末条收尾');
  const newText = rawBefore.slice(0, tailObjEnd + 1) + ',\n\n' + newItemsText + rawBefore.slice(anchorPos);
  const oldPrefix = rawBefore.slice(0, tailObjEnd + 1);
  const oldSuffix = rawBefore.slice(anchorPos);
  if (!newText.startsWith(oldPrefix) || !newText.endsWith(oldSuffix)) die('字节级前缀/后缀校验失败');
  console.log('字节级保证：旧前缀 ' + oldPrefix.length + ' B + 插入 ' + (newText.length - oldPrefix.length - oldSuffix.length) + ' B + 旧后缀 ' + oldSuffix.length + ' B');

  /* ---- vm 预验证（写盘前） ---- */
  const previewNews = loadNews(newText);
  if (previewNews.length !== existing.length + items.length) {
    die('预验证条数异常：期望 ' + (existing.length + items.length) + '，实际 ' + previewNews.length);
  }
  const oldById = {};
  existing.forEach(function (n) { oldById[n.id] = JSON.stringify(n); });
  let oldMutated = 0;
  previewNews.forEach(function (n) { if (oldById[n.id] !== undefined && oldById[n.id] !== JSON.stringify(n)) oldMutated++; });
  if (oldMutated !== 0) die('旧条目在写入后发生变化：' + oldMutated);
  const newIds = items.map(function (it) { return it.id; });
  if (!newIds.every(function (id) { return previewNews.some(function (n) { return n.id === id; }); })) die('新条目未全部出现在写入结果中');
  console.log('vm 预验证通过：' + existing.length + ' 旧条目零变化 + ' + items.length + ' 新条目全部在场');

  /* ---- 正式写入 ---- */
  fs.writeFileSync(NEWS_JS, newText, 'utf8');

  /* ---- 写入后：SHA + vm 复核 ---- */
  const rawAfter = fs.readFileSync(NEWS_JS, 'utf8');
  const shaAfter = sha(rawAfter);
  const afterNews = loadNews(rawAfter);
  if (afterNews.length !== existing.length + items.length) die('写入后条数异常');
  let afterMutated = 0;
  afterNews.forEach(function (n) { if (oldById[n.id] !== undefined && oldById[n.id] !== JSON.stringify(n)) afterMutated++; });
  if (afterMutated !== 0) die('写入后旧条目发生变化：' + afterMutated);
  console.log('写入后 news.js SHA256 = ' + shaAfter);

  /* ---- state 记录（幂等依据；先确保目录存在，失败即终止并告警人工） ---- */
  state.writes.push({
    run_id: runId, operator: a.operator.trim(),
    sha_before: shaBefore, sha_after: shaAfter,
    old_count: existing.length, added_count: items.length, new_count: afterNews.length,
    preview_file: a.preview, written_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')
  });
  try {
    fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
    const tmp = STATE_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(state, null, 2), 'utf8');
    fs.renameSync(tmp, STATE_FILE);
  } catch (e) {
    /* news.js 已写入但幂等状态未落盘：明确报错，提示人工记录，防止重复执行 */
    fail('STATE_WRITE_FAILED', 'news.js 已写入但幂等状态写入失败：' + e.message +
      '。请勿重复执行本工具；如需重试先人工确认（当前 sha_after=' + shaAfter + '）');
  }

  console.log('\n==== 发布完成 ====');
  console.log(JSON.stringify({
    run_id: runId, operator: a.operator.trim(),
    sha_before: shaBefore, sha_after: shaAfter,
    entries: { before: existing.length, added: items.length, after: afterNews.length },
    new_ids: newIds, backups: [bak1, bak2]
  }, null, 2));
}

main().catch(function (e) {
  console.error('失败：' + (e && e.message));
  process.exit(e && e._exit ? e._exit : 1);
});
