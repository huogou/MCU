/* V1.1 Step3 我的MCU 2.0 视觉预览生成（临时脚本，模拟渲染非真机截图） */
const sharp = require('sharp');
const fs = require('fs');

const BG = '#0B0E14', S2 = '#1C2330', GOLD = '#E9A93B', TXT = '#E8ECF4', SUB = '#A8B0C0', WEAK = '#6B7384', LINE = 'rgba(255,255,255,0.08)';
const P1 = '#5B8DEF', P2 = '#28B487', P3 = '#F0A932', P4 = '#8B6FE8';

function card(x, y, w, h, fill, stroke) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="20" fill="${fill}" stroke="${stroke || LINE}" stroke-width="1.5"/>`;
}
function txt(x, y, s, size, fill, weight) {
  return `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" font-family="PingFang SC, sans-serif" font-weight="${weight || 400}">${s}</text>`;
}

/* ========== 老用户态（750×1500） ========== */
let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="750" height="1500" viewBox="0 0 750 1500">
<rect width="750" height="1500" fill="${BG}"/>
`;

/* ① 顶部个人进度区 */
svg += `<rect width="750" height="300" fill="rgba(233,169,59,0.06)"/>`;
svg += txt(72, 84, '我的漫威旅程', 26, WEAK);
svg += txt(72, 170, '4', 76, GOLD, 700);
svg += txt(146, 158, '/', 42, SUB, 600);
svg += txt(186, 158, '59', 42, SUB, 600);
svg += txt(72, 206, '已探索作品', 24, WEAK);
svg += `<rect x="72" y="236" width="606" height="10" rx="5" fill="#232C3D"/><rect x="72" y="236" width="41" height="10" rx="5" fill="${GOLD}"/>`;
svg += txt(72, 272, '整体进度 7% · 已看 4 部', 22, WEAK);

/* ② 入口预留行 */
svg += card(40, 324, 326, 150, `linear-gradient(135deg, rgba(233,169,59,0.10), rgba(233,169,59,0.02))`, 'rgba(233,169,59,0.3)');
svg += txt(64, 380, '分享我的 MCU 进度', 28, GOLD, 600);
svg += txt(64, 422, '生成观影报告海报', 22, WEAK);
svg += `<rect x="262" y="324" width="104" height="44" fill="${GOLD}" rx="0 20 0 14"/><text x="282" y="353" font-size="20" fill="${BG}" font-weight="600" font-family="PingFang SC, sans-serif">即将上线</text>`;
svg += card(384, 324, 326, 150, S2);
svg += txt(408, 380, '我的成就', 28, TXT, 600);
svg += txt(408, 422, '观影纪念徽章', 22, WEAK);

/* ③ 当前路线区 */
svg += txt(72, 522, '当前路线', 24, WEAK);
svg += card(40, 544, 670, 220, S2, 'rgba(233,169,59,0.2)');
svg += txt(72, 596, '继续你的路线 · Phase 2', 24, GOLD, 600);
svg += txt(72, 644, '新手入坑', 34, TXT, 700);
svg += txt(72, 692, '2 / 12 部 · 下一部 奇异博士', 24, SUB);
svg += `<rect x="72" y="716" width="606" height="8" rx="4" fill="#232C3D"/><rect x="72" y="716" width="101" height="8" rx="4" fill="${GOLD}"/>`;
svg += `<rect x="576" y="580" width="102" height="56" rx="8" fill="${GOLD}"/><text x="598" y="618" font-size="24" fill="${BG}" font-weight="600" font-family="PingFang SC, sans-serif">继续观看</text>`;

/* ④ 最近观看 */
svg += txt(72, 822, '最近观看', 24, WEAK);
const recent = [['winter-soldier', P2, '美'], ['avengers', P1, '复'], ['thor', P1, '雷']];
recent.forEach(function (r, i) {
  const x = 40 + i * 230;
  svg += `<rect x="${x}" y="846" width="200" height="260" rx="14" fill="linear-gradient(135deg, ${r[1]}, rgba(0,0,0,0.5))"/>`;
  svg += txt(x + 80, 990, r[2], 52, 'rgba(255,255,255,0.7)', 800);
  svg += `<rect x="${x}" y="1072" width="200" height="34" fill="rgba(11,14,20,0.55)" rx="0 0 14 14"/><text x="${x + 70}" y="1095" font-size="20" fill="${WEAK}" font-family="PingFang SC, sans-serif">已看</text>`;
  svg += txt(x + 40, 1132, ['美国队长2', '复仇者联盟', '雷神'][i], 24, SUB);
});

/* ⑤ 观看记录 */
svg += txt(72, 1190, '观看记录 · 4 部', 24, WEAK);
const rows = [['winter-soldier', P2, '美国队长2', 'Captain America', '第2阶段·无限传奇', '电影'], ['avengers', P1, '复仇者联盟', 'The Avengers', '第1阶段·无限传奇', '电影'], ['thor', P1, '雷神', 'Thor', '第1阶段·无限传奇', '电影'], ['iron-man', P1, '钢铁侠', 'Iron Man', '第1阶段·无限传奇', '电影']];
rows.forEach(function (r, i) {
  const y = 1214 + i * 70;
  svg += card(40, y, 670, 60, S2);
  svg += `<rect x="60" y="${y + 12}" width="44" height="36" rx="6" fill="linear-gradient(135deg, ${r[1]}, rgba(0,0,0,0.5))"/>`;
  svg += txt(76, y + 38, r[2][0], 20, 'rgba(255,255,255,0.7)', 700);
  svg += txt(120, y + 32, r[2], 24, TXT, 600);
  svg += txt(120, y + 50, r[3] + ' · ' + r[4] + ' · ' + r[5], 18, WEAK);
  svg += `<rect x="600" y="${y + 16}" width="74" height="30" rx="6" fill="#232C3D"/><text x="620" y="${y + 37}" font-size="20" fill="${WEAK}" font-family="PingFang SC, sans-serif">已看</text>`;
});
svg += `</svg>`;
fs.writeFileSync('assets/icons/tab/_my-mcu-v11-old-preview.svg', svg);

/* ========== 新用户态（750×1000） ========== */
let svg2 = `<svg xmlns="http://www.w3.org/2000/svg" width="750" height="1000" viewBox="0 0 750 1000">
<rect width="750" height="1000" fill="${BG}"/>
`;
svg2 += `<rect width="750" height="300" fill="rgba(233,169,59,0.06)"/>`;
svg2 += txt(72, 84, '我的漫威旅程', 26, WEAK);
svg2 += txt(72, 170, '0', 76, GOLD, 700);
svg2 += txt(146, 158, '/', 42, SUB, 600);
svg2 += txt(186, 158, '59', 42, SUB, 600);
svg2 += txt(72, 206, '已探索作品', 24, WEAK);
svg2 += `<rect x="72" y="236" width="606" height="10" rx="5" fill="#232C3D"/>`;
svg2 += txt(72, 272, '整体进度 0% · 已看 0 部', 22, WEAK);
svg2 += card(40, 324, 326, 150, `linear-gradient(135deg, rgba(233,169,59,0.10), rgba(233,169,59,0.02))`, 'rgba(233,169,59,0.3)');
svg2 += txt(64, 380, '分享我的 MCU 进度', 28, GOLD, 600);
svg2 += txt(64, 422, '生成观影报告海报', 22, WEAK);
svg2 += card(384, 324, 326, 150, S2);
svg2 += txt(408, 380, '我的成就', 28, TXT, 600);
svg2 += txt(408, 422, '观影纪念徽章', 22, WEAK);
svg2 += txt(72, 522, '当前路线', 24, WEAK);
svg2 += card(40, 544, 670, 200, S2, 'rgba(233,169,59,0.2)');
svg2 += txt(72, 596, '继续你的路线 · Phase 1', 24, GOLD, 600);
svg2 += txt(72, 644, '新手入坑', 34, TXT, 700);
svg2 += txt(72, 692, '0 / 12 部 · 下一部 钢铁侠', 24, SUB);
svg2 += `<rect x="72" y="712" width="606" height="8" rx="4" fill="#232C3D"/>`;
svg2 += txt(72, 800, '最近观看', 24, WEAK);
svg2 += txt(72, 850, '还没有观看记录，去首页挑一部开始吧', 24, WEAK);
svg2 += txt(72, 920, '观看记录 · 0 部', 24, WEAK);
svg2 += txt(72, 968, '还没有观看记录，去首页挑一部开始吧', 24, WEAK);
svg2 += `</svg>`;
fs.writeFileSync('assets/icons/tab/_my-mcu-v11-new-preview.svg', svg2);

Promise.all([
  sharp(Buffer.from(svg)).png().toFile('assets/icons/tab/_my-mcu-v11-old-preview.png'),
  sharp(Buffer.from(svg2)).png().toFile('assets/icons/tab/_my-mcu-v11-new-preview.png')
]).then(function () {
  console.log('预览图已生成: _my-mcu-v11-old-preview.png (老用户态 750×1500) / _my-mcu-v11-new-preview.png (新用户态 750×1000)');
  fs.unlinkSync('assets/icons/tab/_my-mcu-v11-old-preview.svg');
  fs.unlinkSync('assets/icons/tab/_my-mcu-v11-new-preview.svg');
}).catch(function (e) { console.error('生成失败:', e.message); process.exit(1); });
