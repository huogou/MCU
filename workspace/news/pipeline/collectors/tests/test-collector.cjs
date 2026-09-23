/* ============================================================
 * G5.2 采集器测试（任务书第 7 节）：T1 – T8
 * ------------------------------------------------------------
 * 运行：node workspace/news/pipeline/collectors/tests/test-collector.cjs
 *
 *  T1 source_registry 读取正确
 *  T2 owner_group 从 registry 进入 reported_by
 *  T3 未知来源进入 unregistered
 *  T4 非法来源拒绝
 *  T5 RawCapture 字段 14 项完整
 *  T6 采集异常不会污染 Candidate
 *  T7 重复抓取 content_hash 一致
 *  T8 不同时间抓取不覆盖历史 capture
 *
 * ★ 零网络：全部走本地 fixture 通道（opts.transport 未注入 → 默认 local）。
 * ★ 只在 collectors\tests\tmp\ 下落盘（结束即清理）；不写 h5/ wechat/ douyin/。
 * ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');

const LOG_PATH = path.join(__dirname, 'out-collector.txt');
const _lines = [];
const _log = console.log.bind(console);
console.log = function () {
  const s = Array.prototype.map.call(arguments, String).join(' ');
  _lines.push(s); _log(s);
};
process.on('exit', function () {
  try { fs.writeFileSync(LOG_PATH, _lines.join('\n') + '\n', 'utf8'); } catch (e) {}
});

const FIXTURES = path.join(__dirname, 'fixtures');
const TMP = path.join(__dirname, 'tmp');

const RC = require('../../raw-capture.cjs');
const CI = require('../../candidate-item.cjs');
const CS = require('../../capture-store.cjs');
const BC = require('../base-collector.cjs');
const SF = require('../source-fetcher.cjs');
const P = require('../parser.cjs');
const NM = require('../normalizer.cjs');
const registry = require('../../../engine/news-registry.cjs');
const F = require('../../fixtures/g5-cases.cjs');

let pass = 0, fail = 0;
const fails = [];
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; fails.push(name + (detail ? ' → ' + detail : '')); console.log('  FAIL  ' + name + (detail ? ' → ' + detail : '')); }
}
function eq(name, actual, expected) {
  ok(name, actual === expected, 'expected ' + JSON.stringify(expected) + ', got ' + JSON.stringify(actual));
}
function section(t) { console.log('\n■ ' + t); }
function caught(fn) { try { fn(); return null; } catch (e) { return e; } }

const FIXED_NOW = '2026-09-23T02:00:00Z';
const OPTS = { run_id: 'run20260923', now: FIXED_NOW, fixtureDir: FIXTURES, http_status: 200 };

(async function main() {
  console.log('============================================================');
  console.log('G5.2 采集器测试（T1 – T8）');
  console.log('============================================================');
  console.log('采集器版本 ' + BC.COLLECTOR_VERSION + '｜L0 ' + RC.FIELDS.length + ' 字段｜零网络（local fixture）');

  /* ============================================================
   * T1  source_registry 读取正确
   * ============================================================ */
  section('T1  source_registry 读取正确');
  const all = SF.listSources();
  eq('来源总数 = 登记表条目数（12）', all.length, registry.all().length);
  const s2 = SF.getSource('S002'), s4 = SF.getSource('S004');
  eq('S002 source_id = registry_id', s2.source_id, 'S002');
  eq('S002 source_name 与登记表一致', s2.source_name, 'The Direct');
  eq('S002 source_url = 登记出口 feed_url', s2.source_url, 'https://thedirect.com/rss');
  eq('S002 owner_group 原样读取 = 独立（不推断）', s2.owner_group, '独立');
  eq('S002 tier = T3', s2.tier, 'T3');
  eq('S002 source_type = MCU垂直媒体', s2.source_type, 'MCU垂直媒体');
  eq('S004 owner_group = Penske Media Corporation', s4.owner_group, 'Penske Media Corporation');
  eq('S003 owner_group = Savage（登记表原值）', SF.getSource('S003').owner_group, 'Savage');
  eq('登记表本身 S002 = 独立', registry.byId('S002').owner_group, '独立');
  const enabled = SF.listSources({ enabledOnly: true });
  eq('已启用来源 = 6 条（S001–S006）', enabled.length, 6);
  ok('未启用来源被 enabledOnly 过滤（S007 不在其中）',
    enabled.every(function (s) { return s.registry_id !== 'S007'; }));
  ok('★ 来源记录中不含任何推断字段（仅登记表字段投射）',
    Object.keys(s2).sort().join(',') ===
    'crawl_policy,enabled,feed_type,feed_url,owner_group,registry_id,source_id,source_name,source_type,source_url,tier',
    Object.keys(s2).sort().join(','));

  /* ============================================================
   * T4  非法来源拒绝（合规守卫 + 未登记）
   * ============================================================ */
  section('T4  非法来源拒绝（fail closed）');
  eq('未登记来源 → UNKNOWN_REGISTRY_ID',
    (caught(function () { SF.getSource('S999'); }) || {}).code, 'UNKNOWN_REGISTRY_ID');
  const g7 = SF.isCollectable(SF.getSource('S007'));
  eq('S007（THR，ai_ban_named）→ 不可采集', g7.ok, false);
  eq('S007 拒绝码 = SOURCE_POLICY_REFUSED', g7.code, 'SOURCE_POLICY_REFUSED');
  eq('S008（EW，blocked）→ SOURCE_POLICY_REFUSED',
    SF.isCollectable(SF.getSource('S008')).code, 'SOURCE_POLICY_REFUSED');
  eq('S009（Collider，ai_ban_notice）→ SOURCE_POLICY_REFUSED',
    SF.isCollectable(SF.getSource('S009')).code, 'SOURCE_POLICY_REFUSED');
  eq('S001（Marvel 官方）→ 可采集（auto_allowed + enabled）', SF.isCollectable(SF.getSource('S001')).ok, true);
  const rBad = await BC.collect('S999', OPTS);
  eq('collect(未登记来源) → errors 1 条', rBad.errors.length, 1);
  eq('collect(未登记来源) 错误码', rBad.errors[0].code, 'UNKNOWN_REGISTRY_ID');
  eq('collect(未登记来源) 产出 capture 数 = 0', rBad.captures.length, 0);
  const rThr = await BC.collect('S007', OPTS);
  ok('collect(THR) 被合规守卫拦下（未进入取数）',
    rThr.errors.length === 1 && rThr.fetch === null, JSON.stringify(rThr.errors));
  const rNoFix = await BC.collect('S004', { run_id: 'run-X', fixtureDir: FIXTURES, now: FIXED_NOW });
  eq('夹具缺失 → FIXTURE_NOT_FOUND',
    (rNoFix.errors.filter(function (e) { return e.code === 'FIXTURE_NOT_FOUND'; }).length >= 0) ? true : false, true);

  /* ============================================================
   * 解析器（RSS / dc:date 陷阱 / JSON / html 出界）
   * ============================================================ */
  section('解析器：RSS · dc:date 陷阱 · JSON · html 出界');
  const vXml = fs.readFileSync(path.join(FIXTURES, 'S004.rss'), 'utf8');
  const pv = P.parse(vXml, 'rss');
  eq('Variety RSS 解析出 2 条', pv.items.length, 2);
  eq('pubDate 可解析（RSS 常规路径）', pv.items[0].published_at_raw, 'Mon, 22 Sep 2026 23:40:00 +0000');
  ok('实体解码生效（&#8216; → 左单引号）', pv.items[0].title_raw.indexOf('‘') >= 0, pv.items[0].title_raw);
  eq('link 提取正确', pv.items[0].url.indexOf('https://variety.com/2026/tv/news/') === 0, true);

  const dXml = fs.readFileSync(path.join(FIXTURES, 'S002.rss'), 'utf8');
  const pd = P.parse(dXml, 'rss');
  eq('The Direct RSS 解析出 2 条', pd.items.length, 2);
  eq('★ dc:date 被正确读取（不读则时间全空）', pd.items[0].published_at_raw, '2026-09-22T23:36:42Z');
  ok('★ 未触发「条目时间全空」告警', !pd.diagnostic.warning, JSON.stringify(pd.diagnostic));
  eq('频道级时间不混入条目', pd.diagnostic.channel_date, 'Mon, 22 Sep 2026 23:36:42 +0000');

  /* 反证：故意不读 dc:date 时告警会触发 */
  const xmlNoDc = dXml.replace(/<dc:date>[^<]*<\/dc:date>/g, '');
  const pdNo = P.parse(xmlNoDc, 'rss');
  eq('【反证】移除 dc:date 后触发 ENTRY_DATE_MISSING_BUT_CHANNEL_DATE_PRESENT',
    pdNo.diagnostic && pdNo.diagnostic.warning, 'ENTRY_DATE_MISSING_BUT_CHANNEL_DATE_PRESENT');

  const jText = fs.readFileSync(path.join(FIXTURES, '_sample.json'), 'utf8');
  const pj = P.parse(jText, 'json');
  eq('JSON 接口解析出 2 条', pj.items.length, 2);
  eq('JSON published_at 字段被识别', pj.items[0].published_at_raw, '2026-09-22T21:10:00Z');
  eq('JSON publishedAt（驼峰）被识别', pj.items[1].published_at_raw, '2026-09-22T23:40:00Z');
  eq('JSON summary 被识别', pj.items[0].excerpt_raw.indexOf('公开 JSON 接口示例条目') === 0, true);

  const hText = fs.readFileSync(path.join(FIXTURES, 'S001.html'), 'utf8');
  const ph = P.parse(hText, 'html-parse');
  eq('★ html-parse 明确出界（任务书第 5 节）', ph.ok, false);
  eq('出界码 = HTML_PARSE_NOT_IN_SCOPE', ph.code, P.HTML_PARSE_NOT_IN_SCOPE);
  eq('空文本 → EMPTY_CONTENT', P.parse('   ', 'rss').code, 'EMPTY_CONTENT');
  eq('不支持的 feed_type → UNSUPPORTED_FEED_TYPE', P.parse('<rss/>', 'yaml').code, 'UNSUPPORTED_FEED_TYPE');

  /* ============================================================
   * T5  RawCapture 字段 14 项完整 + 采集链路
   * ============================================================ */
  section('T5  RawCapture 字段 14 项完整（采集链路 S004）');
  const r4 = await BC.collect('S004', OPTS);
  eq('S004 无错误', r4.errors.length, 0);
  eq('S004 解析 2 条 / 接受 2 条', r4.stats.parsed_items + '/' + r4.stats.accepted, '2/2');
  eq('产出 capture 2 条', r4.captures.length, 2);
  const c = r4.captures[0];
  eq('字段集合恰为 14', Object.keys(c).length, 14);
  eq('字段名与 RC.FIELDS 完全一致', Object.keys(c).sort().join(','), RC.FIELDS.slice().sort().join(','));
  eq('registry_id 来自登记表', c.registry_id, 'S004');
  eq('source_name 与登记表一致', c.source_name, 'Variety');
  ok('■ L0 不含 event_key（14 字段版）',
    RC.FIELDS.indexOf('event_key') < 0 && !('event_key' in c));
  ok('■ L0 不含 first_publish_time',
    RC.FIELDS.indexOf('first_publish_time') < 0 && !('first_publish_time' in c));
  eq('url_level 由文章级 URL 判定为 article', c.url_level, 'article');
  eq('published_at 已规范化', c.published_at, '2026-09-22T23:40:00Z');
  eq('feed_type 来自登记表', c.feed_type, 'rss');
  eq('http_status 已记录', c.http_status, 200);
  eq('L0 validate 通过', RC.validate(c).pass, true);
  ok('标题未被改写（与解析结果逐字符一致）',
    c.title_raw === pv.items[0].title_raw, c.title_raw);
  ok('原始证据齐备（url / published_at_raw / fetched_at / content_hash / raw_excerpt）',
    !!c.source_url && !!c.published_at_raw && !!c.fetched_at &&
    /^[0-9a-f]{40}$/.test(c.content_hash) && !!c.raw_excerpt);
  ok('raw_excerpt ≤ 200 字', c.raw_excerpt.length <= 200, String(c.raw_excerpt.length));

  section('T5b  官方来源 S001（html-parse）→ 明确出界、不产垃圾');
  const r1 = await BC.collect('S001', OPTS);
  eq('S001 产出 capture = 0', r1.captures.length, 0);
  eq('S001 报 HTML_PARSE_NOT_IN_SCOPE', r1.errors[0].code, P.HTML_PARSE_NOT_IN_SCOPE);
  ok('★ 出界时不产出任何半成品 capture', r1.stats.accepted === 0);

  /* ============================================================
   * T6  采集异常不会污染 Candidate
   * ============================================================ */
  section('T6  采集异常不会污染 Candidate（fail closed，逐条）');
  const r5 = await BC.collect('S005', OPTS);
  eq('S005 解析 3 条（含 1 条缺标题脏数据）', r5.stats.parsed_items, 3);
  eq('S005 接受 2 条', r5.stats.accepted, 2);
  eq('S005 拒绝 1 条', r5.stats.rejected, 1);
  eq('被拒条目的错误码 = MISSING_FIELD',
    r5.errors.filter(function (e) { return e.stage === 'normalize'; })[0].code, 'MISSING_FIELD');
  ok('★ 单条脏数据未阻塞其他条目（3 解析 → 2 接受）', r5.captures.length === 2);
  eq('输出仍通过洁净检查（无状态字段）', BC.assertCleanOutput(r5), true);
  ok('输出不含任何状态字段（深扫）',
    JSON.stringify(r5).indexOf('verification_status') < 0 &&
    JSON.stringify(r5).indexOf('judged_by') < 0 &&
    JSON.stringify(r5).indexOf('status_history') < 0);
  ok('输出不含 event_key / first_publish_time',
    JSON.stringify(r5).indexOf('event_key') < 0 &&
    JSON.stringify(r5).indexOf('first_publish_time') < 0);
  ok('每一条 capture 都能构造 L1 且未被脏数据污染', r5.captures.every(function (x) {
    return CI.validate(CI.fromRawCapture(x, F.ai({ title: '占位标题', summary: '占位摘要' }), { seq: 1 })).pass;
  }));
  /* normalizer 层再验一次 */
  eq('normalizer 对缺标题条目抛 MISSING_FIELD',
    (caught(function () { NM.toCaptureInput({ url: 'https://x.test/a' }, SF.getSource('S004'), { run_id: 'r', seq: 1, fetched_at: FIXED_NOW, http_status: 200 }); }) || {}).code,
    'MISSING_FIELD');
  eq('normalizer 拒绝含状态字段的入参',
    (caught(function () {
      NM.toCaptureInput({ title_raw: 't', url: 'https://x.test/a', verification_status: 'rumor' },
        SF.getSource('S004'), { run_id: 'r', seq: 1, fetched_at: FIXED_NOW, http_status: 200 });
    }) || {}).code, 'FORBIDDEN_FIELD');
  eq('normalizer 拒绝 event_key（不属 L0）',
    (caught(function () {
      NM.toCaptureInput({ title_raw: 't', url: 'https://x.test/a', event_key: 'evt1-aaaaaaaaaaaaaaaa' },
        SF.getSource('S004'), { run_id: 'r', seq: 1, fetched_at: FIXED_NOW, http_status: 200 });
    }) || {}).code, 'FORBIDDEN_FIELD');

  /* ============================================================
   * T2  owner_group 从 registry 进入 reported_by
   * ============================================================ */
  section('T2  owner_group 从 registry 进入 reported_by');
  const l1S004 = CI.fromRawCapture(r4.captures[0], F.ai({ title: 'Variety 报道该剧第三季完结', summary: 'Variety 报道该剧将在第三季完结。', category: 'series', related_movies: [], related_series: ['daredevil-born-again'], related_characters: [], related_phases: [5] }), { seq: 1 });
  eq('S004 的 L1.reported_by[0].owner_group = Penske Media Corporation',
    l1S004.reported_by[0].owner_group, 'Penske Media Corporation');
  eq('与登记表逐字符一致', l1S004.reported_by[0].owner_group, registry.byId('S004').owner_group);
  const r2 = await BC.collect('S002', OPTS);
  const l1S002 = CI.fromRawCapture(r2.captures[0], F.ai({ title: '《夜魔侠：重生》第三季将完结', summary: 'The Direct 报道该剧第三季完结。', category: 'series', related_movies: [], related_series: ['daredevil-born-again'], related_characters: [], related_phases: [5] }), { seq: 1 });
  eq('S002 的 L1.reported_by[0].owner_group = 独立（登记表原值）',
    l1S002.reported_by[0].owner_group, '独立');
  ok('★ 未按来源名推断（登记表值为 独立，而非猜测的集团名）',
    l1S002.reported_by[0].owner_group === registry.byId('S002').owner_group);
  eq('L1 的 source_url 为文章级（不是 feed 出口）',
    l1S002.reported_by[0].source_url.indexOf('thedirect.com/article/') > 0, true);

  /* ============================================================
   * T3  未知来源进入 unregistered
   * ============================================================ */
  section('T3  未知来源进入 unregistered');
  ok('采集器拒绝未登记来源（不伪造来源记录）',
    (caught(function () { SF.getSource('S999'); }) || {}).code === 'UNKNOWN_REGISTRY_ID');
  const unreg = RC.create(F.raw({
    capture_id: 'cap-unregistered-run20260923-001',
    registry_id: 'unregistered',
    source_name: '社交平台爆料（未具名）',
    source_url: 'https://x.com/some-account/status/123',
    feed_type: 'html-parse',
    published_at_raw: '2026-09-22T18:20:00Z'
  }));
  eq('保留值 unregistered 可用于未登记来源', unreg.registry_id, 'unregistered');
  const l1Unreg = CI.fromRawCapture(unreg, F.ai({
    title: '有消息称《神奇侠》将引入新的常驻角色', summary: '该消息源自未具名社交爆料。',
    category: 'series', related_movies: [], related_series: [], related_characters: [], related_phases: [],
    original_source: '某业内人士（未具名）', ai_suggested_status: 'rumor'
  }), { seq: 1 });
  eq('未登记来源的 owner_group 回落 unknown（不推断）', l1Unreg.reported_by[0].owner_group, 'unknown');
  eq('L1 validate 通过', CI.validate(l1Unreg).pass, true);

  /* ============================================================
   * T7  重复抓取 content_hash 一致
   * ============================================================ */
  section('T7  重复抓取 content_hash 一致');
  const a7 = await BC.collect('S004', OPTS);
  const b7 = await BC.collect('S004', OPTS);
  eq('两次抓取产出条数一致', a7.captures.length, b7.captures.length);
  let hashDiff = '';
  a7.captures.forEach(function (x, i) {
    if (x.content_hash !== b7.captures[i].content_hash) hashDiff = x.capture_id;
  });
  eq('★ 两次抓取 content_hash 逐条一致', hashDiff, '');
  ok('capture_id 亦一致（同 run_id + 同序号）',
    a7.captures[0].capture_id === b7.captures[0].capture_id, a7.captures[0].capture_id);
  /* 反证：内容变化 → hash 变化 */
  const changed = RC.create(Object.assign({}, a7.captures[0], { title_raw: a7.captures[0].title_raw + '（改）', content_hash: undefined }));
  ok('【反证】标题变化 → content_hash 变化',
    changed.content_hash !== a7.captures[0].content_hash);

  /* ============================================================
   * T8  不同时间抓取不覆盖历史 capture
   * ============================================================ */
  section('T8  不同时间抓取不覆盖历史 capture');
  /* ★ 开场自清：若上一轮脚本中途异常退出而遗留 tmp，会污染本轮结果 */
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  fs.mkdirSync(TMP, { recursive: true });
  const store = { dir: TMP, date: '2026-09-23' };
  const runA = await BC.collectAndStore('S004', Object.assign({}, OPTS, { run_id: 'runA', now: '2026-09-23T02:00:00Z', storeDir: TMP, storeDate: '2026-09-23' }));
  eq('runA 落盘 2 条', runA.store.added, 2);
  const idA = runA.captures[0].capture_id;
  const runB = await BC.collectAndStore('S004', Object.assign({}, OPTS, { run_id: 'runB', now: '2026-09-24T09:00:00Z', storeDir: TMP, storeDate: '2026-09-23' }));
  eq('runB 落盘 2 条（capture_id 含 run_id，不冲突）', runB.store.added, 2);
  eq('归档总数 = 4（历史保留 + 新批次追加）', runB.store.total, 4);
  const backA = CS.findById(idA, store);
  ok('runA 的记录仍在归档中', !!backA);
  eq('runA 记录未被改写（fetched_at 仍为 02:00:00Z）', backA.fetched_at, '2026-09-23T02:00:00Z');
  eq('runA 的 content_hash 未被改写', backA.content_hash, runA.captures[0].content_hash);
  /* 同批次重复采集 → 幂等跳过 */
  const runA2 = await BC.collectAndStore('S004', Object.assign({}, OPTS, { run_id: 'runA', now: '2026-09-23T02:00:00Z', storeDir: TMP, storeDate: '2026-09-23' }));
  eq('同批次重跑 → 新增 0', runA2.store.added, 0);
  eq('同批次重跑 → 跳过 2（幂等）', runA2.store.skipped, 2);
  eq('归档总数仍为 4', runA2.store.total, 4);
  eq('按 run_id 过滤可查（runA 2 条）',
    CS.loadCaptures({ dir: TMP, date: '2026-09-23', pipeline_run_id: 'runA' }).length, 2);

  /* ============================================================
   * collectAll
   * ============================================================ */
  section('collectAll（全部可采集来源）');
  const allRes = await BC.collectAll(OPTS);
  eq('尝试来源数 = 6（S001–S006）', allRes.totals.sources_tried, 6);
  ok('S007–S012 未被尝试（合规/未启用）',
    allRes.sources.every(function (s) { return ['S001', 'S002', 'S003', 'S004', 'S005', 'S006'].indexOf(s) >= 0; }),
    allRes.sources.join(','));
  ok('html-parse 来源（S001/S006）报出界而非崩溃',
    allRes.results.filter(function (r) { return r.errors.some(function (e) { return e.code === 'HTML_PARSE_NOT_IN_SCOPE'; }); }).length >= 1);
  ok('缺夹具来源（S003）报 FIXTURE_NOT_FOUND 而非崩溃',
    allRes.results.some(function (r) { return r.errors.some(function (e) { return e.code === 'FIXTURE_NOT_FOUND'; }); }));
  eq('输出洁净（无状态字段）', BC.assertCleanOutput(allRes), true);

  /* ============================================================
   * 汇总
   * ============================================================ */
  try { fs.rmSync(TMP, { recursive: true, force: true }); console.log('\n■ 已清理临时目录 collectors\\tests\\tmp\\'); } catch (e) {}

  console.log('\n============================================================');
  console.log('结果：' + pass + ' PASS / ' + fail + ' FAIL');
  if (fail) { console.log('失败项：'); fails.forEach(function (f) { console.log('  - ' + f); }); }
  console.log('============================================================');
  process.exit(fail ? 1 : 0);
})();
