/* ============================================================
 * G2 · 一次性取证脚本：校验 G1 内联种子数据（SOURCE_REGISTRY）
 * ------------------------------------------------------------
 * 目的：在 G2 把 G1 的内联种子替换为正式登记表之前，
 *       先对**原样**的 G1 种子做定向校验，留存取证。
 *
 * 说明：G1 内联种子只是登记表的**最小子集**（未含 20 字段全部），
 *       因此本次不做 R-05 字段齐备性校验，只针对**枚举与 owner_group** 做定向检查。
 *       这与任务要求的「tier / crawl_policy / health 枚举 + source_name 一致性」
 *       四项直接对应。
 *
 * ★ 本脚本只读，不修改任何文件。
 * ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');

const LOG_PATH = path.join(__dirname, 'out-registry-legacy.txt');
const _lines = [];
const _log = console.log.bind(console);
console.log = function () {
  const s = Array.prototype.map.call(arguments, String).join(' ');
  _lines.push(s); _log(s);
};
process.on('exit', function () {
  try { fs.writeFileSync(LOG_PATH, _lines.join('\n') + '\n', 'utf8'); } catch (e) {}
});

const R = require('./news-judge-rules.cjs');
const reg = require('./news-registry.cjs');

console.log('============================================================');
console.log('G2 · 取证：G1 内联种子数据（SOURCE_REGISTRY）定向校验');
console.log('============================================================');
console.log('被检对象：news-judge-rules.cjs 的 SOURCE_REGISTRY（' + R.SOURCE_REGISTRY.length + ' 条）');
console.log('检查项：tier / crawl_policy / health 枚举 + owner_group 非空 + source_name 唯一');
console.log('');

const issues = [];
const seen = Object.create(null);

R.SOURCE_REGISTRY.forEach(function (e) {
  const tag = e.registry_id + ' ' + e.source_name;
  if (reg.ENUMS.TIERS.indexOf(e.tier) < 0) issues.push('[tier] ' + tag + ' → 「' + e.tier + '」不在枚举 ' + reg.ENUMS.TIERS.join('/'));
  if (reg.ENUMS.CRAWL_POLICIES.indexOf(e.crawl_policy) < 0) issues.push('[crawl_policy] ' + tag + ' → 「' + e.crawl_policy + '」不在枚举 ' + reg.ENUMS.CRAWL_POLICIES.join('/'));
  if (reg.ENUMS.HEALTHS.indexOf(e.health) < 0) issues.push('[health] ' + tag + ' → 「' + e.health + '」不在枚举 ' + reg.ENUMS.HEALTHS.join('/'));
  if (typeof e.owner_group !== 'string' || !e.owner_group.trim()) issues.push('[owner_group] ' + tag + ' → 为空');
  if (seen[e.source_name]) issues.push('[source_name 重复] ' + e.source_name);
  seen[e.source_name] = 1;
});

if (issues.length) {
  console.log('发现问题 ' + issues.length + ' 处：');
  issues.forEach(function (s) { console.log('  FAIL  ' + s); });
} else {
  console.log('未发现问题。');
}

console.log('');
console.log('结论：G1 内联种子在枚举层面存在 ' + issues.length + ' 处违规；');
console.log('      G2 的正式登记表（registry/source-registry.json）已修正，见 out-registry-validate.txt。');

process.exit(0);
