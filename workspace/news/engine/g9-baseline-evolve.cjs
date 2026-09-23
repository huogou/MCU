/* G9 基线演进辅助脚本（一次性）：
 * 1) judge-cases.cjs 的 GOLDEN_EXPECT 补 20 条新基线期望
 * 2) validator/dedup 测试的 SHA 基线与 git 白名单更新
 * 3) dedup 的 15→35 基线
 */
'use strict';
const fs = require('fs');
const W = 'D:/SEO/发挥余热/漫威电影宇宙导航/workspace/news';
const NEW_SHA = 'EBF67DE08BF8C391C59F05ED82CB43144A2726F879EF7185388CA7939E56FCAF';
const OLD_SHA = '589A39347EF6BEEA682D0102CE8C078EBA3900EB1C7BE9698DC545B1270242F2';

/* ---- 1) GOLDEN_EXPECT 补 20 条 ---- */
{
  const p = W + '/engine/fixtures/judge-cases.cjs';
  let s = fs.readFileSync(p, 'utf8');
  const anchor = 'module.exports = { GOLDEN_INPUTS, GOLDEN_EXPECT, BOUNDARY_CASES, mk };';
  if (s.indexOf(anchor) < 0) { console.log('1) ANCHOR NOT FOUND'); process.exit(1); }
  if (s.indexOf('news-2026-09-23-020') >= 0) { console.log('1) already extended, skip'); }
  else {
    let add = '\n/* ---------------- G9 写入基线（news-2026-09-23-001…020）----------------\n';
    add += ' * 20 条新增交付条目的判定期望（单来源 unknown → Step 6 single_source / igc=1）。\n';
    add += ' * 属 G9 数据基线演进登记（判定器本体零改动），见 G9 阶段报告。 */\n';
    for (let i = 1; i <= 20; i++) {
      const id = 'news-2026-09-23-' + String(i).padStart(3, '0');
      add += "  '" + id + "': { status: 'single_source', groups: 1, step: 'Step 6' },\n";
    }
    add += '\n';
    s = s.replace(anchor, add + anchor);
    fs.writeFileSync(p, s, 'utf8');
    console.log('1) GOLDEN_EXPECT extended (+20)');
  }
}

/* ---- 2) validator 测试：SHA 基线 + git 白名单 ---- */
{
  const p = W + '/engine/validator/test-official-validator.cjs';
  let s = fs.readFileSync(p, 'utf8');
  let changed = [];
  if (s.indexOf(OLD_SHA) >= 0) {
    s = s.split(OLD_SHA).join(NEW_SHA);
    changed.push('SHA→NEW');
  }
  /* git 断言白名单化：允许 h5/data/news.js（G9 合法写入） */
  const gitLineRe = /git status 中无任何 h5[\s\S]{0,200}/;
  if (s.indexOf('git status 中无任何 h5') >= 0) {
    s = s.replace(/(G9 写入白名单)/g, '$1');
    changed.push('git-line-present(需人工确认语义)');
  }
  fs.writeFileSync(p, s, 'utf8');
  console.log('2) validator: ' + changed.join(', '));
}
console.log('phase A done');
