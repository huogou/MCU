/* judge-cases.cjs GOLDEN_EXPECT 修复：补回闭合 }; 并正确插入 G9 基线 20 条 */
'use strict';
const fs = require('fs');
const p = 'D:/SEO/发挥余热/漫威电影宇宙导航/workspace/news/engine/fixtures/judge-cases.cjs';
let s = fs.readFileSync(p, 'utf8');

const anchor =
  "  'news-2026-09-17-015': { status: 'single_source',         groups: 1, step: 'Step 6' },\n" +
  "\n\n/* ---------------- 合成边界用例 B1–B10 ---------------- */";

if (s.indexOf(anchor) < 0) {
  console.log('ANCHOR NOT FOUND —— 需人工检查');
  const j = s.indexOf('const GOLDEN_EXPECT = {');
  const k = s.indexOf('news-2026-09-17-015', j);
  console.log(JSON.stringify(s.slice(k, k + 260)));
  process.exit(1);
}

let add = '';
for (let i = 1; i <= 20; i++) {
  const id = 'news-2026-09-23-' + String(i).padStart(3, '0');
  add += "  '" + id + "': { status: 'single_source', groups: 1, step: 'Step 6' },\n";
}
const replacement =
  "  'news-2026-09-17-015': { status: 'single_source',         groups: 1, step: 'Step 6' },\n" +
  "/* ---------------- G9 写入基线（news-2026-09-23-001…020，判定器本体零改动）---------------- */\n" +
  add +
  "};\n" +
  "\n/* ---------------- 合成边界用例 B1–B10 ---------------- */";

s = s.replace(anchor, replacement);
fs.writeFileSync(p, s, 'utf8');
console.log('FIXED: GOLDEN_EXPECT closed + G9 20 entries inserted');
