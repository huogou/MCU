/* ============================================================
 * G8-3/G8-4/G8-5 · 全量审核建议草案 + 首批 20 条预览 + 上线前检查
 * ------------------------------------------------------------
 * 运行：node workspace/news/pipeline/review/run-g8-sim.cjs
 * ★★ 草案性质（禁令「禁止自动批准」的遵守方式）：
 *   本脚本产出的全部 action 为**开发侧按《资讯审核规范V1.0》给出的
 *   建议草案**（operator=g8-draft-review）——不修改 review-queue、
 *   不变更任何 gate_status、不写入 review-history 正式决策链、
 *   不写 h5/data/news.js。真实审核须负责人逐条复核署名。
 * 流程：队列（133）→ 逐条建议（20 approve / 113 reject）→
 *   首批 20 条（含 1 条 modify 案例）→ Gate → DeliveryItem →
 *   delivery-final-preview.json + diff → 备份 news.js + SHA256 记录。
 * ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const vm = require('vm');

const LOG_PATH = path.join(__dirname, 'out-g8-sim.txt');
const _lines = [];
const _log = console.log.bind(console);
console.log = function () {
  const s = Array.prototype.map.call(arguments, String).join(' ');
  _lines.push(s); _log(s);
};
process.on('exit', function () {
  try { fs.writeFileSync(LOG_PATH, _lines.join('\n') + '\n', 'utf8'); } catch (e) {}
});

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const H5 = path.join(ROOT, 'h5');
const NEWS_JS = path.join(H5, 'data', 'news.js');
const sha256 = function (p) {
  return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex').toUpperCase();
};
const SHA_BEFORE = sha256(NEWS_JS);
const NOW = '2026-09-23T00:00:00Z';
const OPERATOR = 'g8-draft-review';
const BACKUP_DIR = path.join(__dirname, 'backup');

const AIOUT = require('../ai-normalizer/output/20260923.json');
const RQ = require('./review-queue.cjs');
const RA = require('./review-actions.cjs');
const GATE = require('../gate/gate.cjs');
const DC = require('../delivery/delivery-converter.cjs');

console.log('============================================================');
console.log('G8 全量审核建议草案 + 首批 20 条预览 + 上线前检查');
console.log('============================================================');

/* ---------------- 1) 审核队列（签名重算后） ---------------- */
const q = RQ.buildQueue(AIOUT.candidates, { date: '20260923', generated_at: NOW });
console.log('审核队列：' + q.doc.count + ' 条（全 pending，复用 G7 生成语义）');

/* ---------------- 2) 逐条建议（规范 V1.0 口径） ---------------- */
/* approve 建议 = 20 条（A 类 MCU 11 + B 类 Disney 影视生态 9） */
const APPROVE = {
  /* —— A 类：漫威/MCU 核心（11）—— */
  '漫威影业确认2027年终结其第三部Disney+三部曲': 'A',
  '《复仇者联盟：秘密战争》被指将修正《毁灭之日》最大缺憾': 'A',
  '《旺达幻视》续作公布第三位主要超级英雄': 'A',
  '蜘蛛侠与夜魔侠将在动画剧官方前传故事中提前重聚': 'A',
  '《复联4》重映版独家片段据报聚焦两位MCU角色会面': 'A',
  '漫威官方确认蜘蛛侠最不受欢迎的反派已存在于MCU': 'A',
  'Disney+即将上线全新漫威电视交叉联动项目并发布首支预告': 'A',
  '《毁灭之日》新剧照为猩红女巫回归传闻增添可信度': 'A',
  '《复联4》为Encore重映更换全新海报': 'A',
  '《幻视探案》首曝片段：奇异博士的忘却咒语对一名角色失效': 'A',
  '漫威影业SDCC震撼官宣：《毁灭之日》《恶灵骑士》《黑豹3》': 'A',
  /* —— B 类：Disney 官方影视生态重大事件（9，选择性收录）—— */
  '《波西·杰克逊》第三季确认十二主神全员登场': 'B',
  '《王国之心》获批准开拍首部原创剧集登陆Disney频道与Disney+': 'B',
  '《疯狂动物城3》主创预告鸟类角色带来意外惊喜': 'B',
  '《后裔：邪恶仙境》卡司预告新角色与新音乐': 'B',
  '迪士尼真人版《海洋奇缘》：强森与主创如何重塑经典': 'B',
  '《玩具总动员5》登顶2026全球开画冠军并创动画影史第二': 'B',
  '泰勒·斯威夫特为《玩具总动员5》创作新歌《我知道是你》': 'B',
  '「飞向太空…与20亿小时！」：Disney+如何助力《玩具总动员5》': 'B',
  '《摇滚夏令营3》主星谈音乐传承与迪士尼新生代': 'B'
};
/* modify 案例：统一剧名全称（对齐 S006 出口的完整剧名） */
const MODIFY = {
  '《波西·杰克逊》第三季确认十二主神全员登场': {
    modifications: { title: '《波西·杰克逊与奥林匹亚英雄》第三季确认十二主神全员登场' },
    reason: '统一剧名全称（与 Disney 官方出口一致），符合修改规则 M1/M5'
  }
};

/* reject 分类（拒绝规则 B1/B2/B3，按关键词归类 reason） */
function rejectReason(title) {
  if (/蓝甲侠|泥面|DCU|DC剧|古恩|乔丹|猎人|阿索卡|古古|星战|曼达洛|辛普森|堡垒之夜|Epic Games|超人总动员/.test(title)) {
    return '非漫威/MCU 且非 Tier B 影视生态事件（范围外 IP），命中拒绝规则 B1';
  }
  if (/任命|出任|首席|主席|财报|加速器|健康中心|退役|军人|慈善|公益|法务|禁制令|诉讼|和解|被控|去世|十亿|艾美|ESPY|NBA|NFL|F1|Formula|经济影响|许可|购物|抽奖|档案|对谈|粉丝大会|D23|巡游|Bus|广告|创作者|626|250周年|庆祝|礼赞|周\b/.test(title)) {
    return '纯公司运营/人事/财务/法务/公益/乐园运营/体育节目类公告，命中拒绝规则 B2';
  }
  if (/片单|盘点|回顾|档案|前瞻|故事|Changed|改变|幕后|Behind|力量|如何|为什么|为何/.test(title)) {
    return '名录/清单/回顾/盘点类内容，无具体事件，命中拒绝规则 B3';
  }
  if (/播客|广告|搜索|AI驱动|界面|语言|广告创意|会员|资料|Premium/.test(title)) {
    return '平台功能/运营动态，无内容生态事件，命中拒绝规则 B2';
  }
  return '超出收录范围（审核规范 §1 A1），命中拒绝规则 B1';
}

const reviewResult = [];
const approvedDraft = [];
q.doc.entries.forEach(function (e) {
  const a = APPROVE[e.title];
  if (a) {
    const tierNote = a === 'A' ? 'MCU 作品事件，符合收录规则 A1（核心范围）'
      : 'Disney 官方影视生态重大事件，符合收录规则 A1（Tier B 选择性收录）';
    reviewResult.push({
      candidate_id: e.candidate_id, title: e.title, operator: OPERATOR,
      action: 'approve', reason: tierNote, timestamp: NOW
    });
    approvedDraft.push(q.signed.find(function (c) { return c.candidate_id === e.candidate_id; }));
  } else {
    reviewResult.push({
      candidate_id: e.candidate_id, title: e.title, operator: OPERATOR,
      action: 'reject', reason: rejectReason(e.title), timestamp: NOW
    });
  }
});

const nA = reviewResult.filter(function (r) { return r.action === 'approve'; }).length;
const nR = reviewResult.filter(function (r) { return r.action === 'reject'; }).length;
console.log('建议分布：approve ' + nA + ' / reject ' + nR + '（共 ' + reviewResult.length + ' 条，operator=' + OPERATOR + '）');
if (reviewResult.length !== 133 || nA !== 20) {
  console.log('★ 建议数量异常（预期 133 条 / approve 20），终止');
  process.exit(1);
}

/* review-result-20260923.json（草案） */
const rrDoc = {
  schema_version: '1.0',
  nature: '★★ 草案：全部 action 为开发侧按《资讯审核规范V1.0》给出的建议，'
    + '须负责人逐条复核确认后方可作为真实审核决策；本文件不修改 review-queue、'
    + '不变更任何 gate_status、不写入 review-history 正式决策链',
  rule_basis: '资讯审核规范V1.0（docs/产品/资讯模块/）',
  date: '20260923',
  operator: OPERATOR,
  count: reviewResult.length,
  distribution: { approve: nA, reject: nR },
  results: reviewResult
};
const rrPath = path.join(__dirname, 'review-result-20260923.json');
fs.writeFileSync(rrPath, JSON.stringify(rrDoc, null, 2), 'utf8');
console.log('建议草案落盘：' + rrPath);

/* ---------------- 3) 首批 20 条：modify 案例 → Gate → DeliveryItem ---------------- */
console.log('\n■ 首批 20 条（含 1 条 AI 修改案例）→ Gate → DeliveryItem');
const batch = [];
approvedDraft.forEach(function (c) {
  const mod = MODIFY[c.title];
  if (mod) {
    const r = RA.applyDecision(c, {
      action: 'modify', operator: OPERATOR, now: NOW,
      modifications: mod.modifications, reason: mod.reason
    });
    const r2 = RA.applyDecision(r.candidate, {
      action: 'approve', operator: OPERATOR, now: NOW, reason: '修改后通过（G8-4 预览演练）'
    });
    batch.push(r2.candidate);
    console.log('  MODIFY+APPROVE  ' + c.candidate_id + ' → ' + r2.candidate.candidate_id);
  } else {
    /* ★ 每条候选都必须走动作链（Gate 消费的是 gate_status）；
     * 本 approve 仍属草案演练（不写 history/queue，等待负责人复核） */
    const r = RA.applyDecision(c, {
      action: 'approve', operator: OPERATOR, now: NOW,
      reason: 'G8-4 首批预览演练（草案，待负责人最终复核）'
    });
    batch.push(r.candidate);
  }
});
console.log('  批次：' + batch.length + ' 条（含 modify→approve 1 条）');

const gate = GATE.review(batch, {});
eqCheck('Gate approved = 20', gate.stats.approved, 20);
function eqCheck(name, a, b) {
  console.log('  ' + (a === b ? 'PASS' : 'FAIL') + '  ' + name +
    (a === b ? '' : '（expected ' + b + ', got ' + a + '）'));
  if (a !== b) process.exitCode = 1;
}
const conv = DC.toDeliveries(gate.approved, { now: NOW });
console.log('  DeliveryItem：' + conv.items.length + ' 条，33 字段=' +
  (conv.items.every(function (it) { return Object.keys(it).length === 33; }) ? '全部 OK' : '★ 异常'));

/* ---------------- 4) delivery-final-preview + diff ---------------- */
const ctx = {};
ctx.window = ctx; ctx.global = ctx; ctx.console = console;
ctx.URL = URL; ctx.Date = Date; ctx.Math = Math; ctx.JSON = JSON;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(NEWS_JS, 'utf8'), ctx, { filename: 'news.js' });
const existing = ctx.window.MCU_NEWS || [];
const existingById = {};
existing.forEach(function (n) { existingById[n.id] = n; });

const to_add = [], to_update = [], unchanged = [];
conv.items.forEach(function (it) {
  if (!existingById[it.id]) { to_add.push(it.id); return; }
  const real = existingById[it.id];
  const STABLE = ['title', 'summary', 'category', 'publish_time', 'first_seen_at',
    'verification_status', 'reported_by', 'independent_group_count',
    'original_source', 'original_source_url', 'official_source', 'official_source_url',
    'related_movies', 'related_series', 'related_characters', 'related_phases',
    'supersedes_id', 'superseded_by_id', 'report_corrections', 'conflict_statements', 'judged_by'];
  const diffK = STABLE.filter(function (k) { return JSON.stringify(it[k]) !== JSON.stringify(real[k]); });
  (diffK.length ? to_update : unchanged).push(it.id + (diffK.length ? '（差异:' + diffK.join(',') + '）' : '（内容一致）'));
});
console.log('\n■ diff（old news.js × 15 vs final-preview × 20，写入后总库 35）：');
console.log('  新增 ' + to_add.length + ' 条');
console.log('  修改 ' + to_update.length + ' 条：' + (to_update.join(', ') || '（无）'));
console.log('  删除 0 条（追加写入，现网 15 条全部保留）');
const previewIds = conv.items.map(function (it) { return it.id; });
console.log('  现网 supersedes 互链保护：010/014 ' +
  (previewIds.indexOf('news-2026-09-20-010') < 0 && previewIds.indexOf('news-2026-09-19-014') < 0
    ? '不在本批 → 保持原状 ✅' : '★ 被触及'));

const previewDoc = {
  schema_version: '1.0',
  layer: 'L3-DELIVERY-FINAL-PREVIEW',
  generated_at: NOW,
  nature: 'G8-4 首批上线准备预览（预计写入 news.js 的数据）；未写入 h5/data/news.js，等待负责人确认',
  review_basis: 'review-result-20260923.json（草案）+ 资讯审核规范V1.0',
  count: conv.items.length,
  coverage: {
    mcu_core: conv.items.filter(function (it) {
      return /漫威|MCU|复联|毁灭之日|蜘蛛侠|旺达幻视|幻视探案|猩红女巫/.test(it.title);
    }).length,
    disney_tier_b: conv.items.length - conv.items.filter(function (it) {
      return /漫威|MCU|复联|毁灭之日|蜘蛛侠|旺达幻视|幻视探案|猩红女巫/.test(it.title);
    }).length,
    single_source_events: conv.items.filter(function (it) { return it.independent_group_count === 1; }).length,
    ai_modified_cases: 1,
    reject_cases_reference: '见 review-result-20260923.json（reject 113 条）'
  },
  diff: {
    existing_count: existing.length,
    preview_count: conv.items.length,
    to_add: to_add,
    to_update: to_update,
    unchanged: unchanged,
    to_delete: 0,
    delete_semantics: '追加写入：现网 15 条全部保留，写入后总库 35 条；管道无删除语义',
    supersedes_protection: '现网互链对 010←014 不在本批，保持原状'
  },
  items: conv.items
};
const pvPath = path.join(ROOT, 'workspace', 'news', 'pipeline', 'deliveries', '20260923.delivery-final-preview.json');
fs.writeFileSync(pvPath, JSON.stringify(previewDoc, null, 2), 'utf8');
console.log('  最终预览：' + pvPath);

/* ---------------- 5) G8-5 上线前检查（备份/SHA256/待确认） ---------------- */
console.log('\n■ G8-5 上线前检查');
fs.mkdirSync(BACKUP_DIR, { recursive: true });
const backupPath = path.join(BACKUP_DIR, 'news.js.20260923');
fs.copyFileSync(NEWS_JS, backupPath);
const shaBackup = crypto.createHash('sha256').update(fs.readFileSync(backupPath)).digest('hex').toUpperCase();
eqCheck('备份文件 SHA256 == 现网', shaBackup, SHA_BEFORE);
const SHA_AFTER = sha256(NEWS_JS);
eqCheck('news.js 全程未被修改', SHA_AFTER, SHA_BEFORE);
console.log('  news.js SHA256 = ' + SHA_BEFORE);
console.log('  备份位置 = ' + backupPath);
console.log('\n  ★★★ 待负责人确认清单（确认前不执行任何写入）★★★');
console.log('  1. 复核 review-result-20260923.json（133 条建议草案，20 approve / 113 reject）');
console.log('  2. 确认《资讯审核规范V1.0》口径（Tier B 边界、人事类改判）');
console.log('  3. 确认 delivery-final-preview 20 条内容与追加写入');
console.log('  4. 确认后由负责人执行写入（backup 已就绪：' + backupPath + '）');
console.log('\n============================================================');
console.log('G8 模拟编排完成。');
console.log('============================================================');
