/* ============================================================
 * V1.1 Step6 角色主页 · 视觉预览生成（模拟渲染非真机截图）
 * ------------------------------------------------------------
 * 用真实数据（mcuData + characters）SVG→sharp 生成：
 *   - assets/preview/_characters-list-preview.png    角色图鉴列表页
 *   - assets/preview/_character-detail-preview.png   角色详情页（托尼）
 * ============================================================ */
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

/* mock wx（userState 依赖） */
global.wx = {
  getStorageSync: function () { return ''; },
  setStorageSync: function () {},
  navigateTo: function () {},
  setNavigationBarTitle: function () {},
  cloud: { init: function () {} }
};

const mcuData = require('./models/mcuData.js');
const userState = require('./models/userState.js');
const { CHARACTERS, CAMPS } = require('./data/characters.js');
const { TYPE_LABEL } = require('./data/content.js');

const BG = '#0B0E14', S1 = '#141925', S2 = '#1C2330', S3 = '#232C3D';
const GOLD = '#E9A93B', TXT = '#E8ECF4', SUB = '#A8B0C0', WEAK = '#6B7384';
const LINE = 'rgba(255,255,255,0.08)';
const FONT = 'Microsoft YaHei, PingFang SC, sans-serif';

function card(x, y, w, h, fill, stroke) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="20" fill="${fill}" stroke="${stroke || LINE}" stroke-width="1.5"/>`;
}
function txt(x, y, s, size, fill, weight) {
  return `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" font-family="${FONT}" font-weight="${weight || 400}">${s}</text>`;
}
/* 中文按字号近似宽度截断 */
function clip(s, size, maxChars) {
  if (!s) return '';
  const chars = (s.length * size) / size; // 每字符约 size px
  const limit = Math.floor(maxChars);
  return s.length > limit ? s.slice(0, limit) + '…' : s;
}

const OUT = path.join(__dirname, 'assets', 'preview');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

/* —— 数据组装（与页面逻辑一致）—— */
const listChars = CHARACTERS.map(function (c) {
  const first = mcuData.get(c.first);
  const apps = mcuData.charAppearances(c.id);
  return { id: c.id, cn: c.cn, en: c.en, camp: c.camp, note: c.note,
    avatar: (c.cn || '?').charAt(0), count: apps.count, firstCn: first ? first.cn : '' };
});

const tonyId = 'tony';
const tChar = mcuData.getChar(tonyId);
const tCamp = CAMPS[tChar.camp];
const tFirst = mcuData.get(tChar.first);
const tFilms = mcuData.filmsOfChar(tonyId).map(function (m) {
  return { id: m.id, cn: m.cn, en: m.en, phase: m.phase || 1,
    phaseColor: mcuData.phaseColor(m.phase), letter: (m.cn || '?').charAt(0),
    typeLabel: TYPE_LABEL[m.type] || '', status: userState.watchState(m.id) };
});
const myFilms = {}; tFilms.forEach(function (m) { myFilms[m.id] = true; });
const related = CHARACTERS.map(function (c) {
  if (c.id === tonyId) return null;
  const shared = mcuData.filmsOfChar(c.id).filter(function (m) { return myFilms[m.id]; }).length;
  return shared ? { id: c.id, cn: c.cn, camp: c.camp, shared: shared,
    avatar: (c.cn || '?').charAt(0), color: (CAMPS[c.camp] || {}).color || '#7A8296' } : null;
}).filter(Boolean).sort(function (a, b) { return b.shared - a.shared; }).slice(0, 6);

/* ========== 图1：角色图鉴列表页（750×1500） ========== */
let s1 = `<svg xmlns="http://www.w3.org/2000/svg" width="750" height="1500" viewBox="0 0 750 1500">
<rect width="750" height="1500" fill="${BG}"/>
`;
s1 += txt(40, 74, '角色图鉴', 46, TXT, 700);
s1 += txt(40, 108, '24 位角色 · 8 大阵营 · 从角色读懂宇宙关系', 24, SUB);
/* chips */
let cx = 40;
const chips = [['全部', GOLD, true], ['复仇者阵营', '#E8483F', false], ['银河护卫队', '#28B487', false], ['阿斯加德', '#F0A932', false], ['瓦坎达', '#8B6FE8', false], ['神盾局', '#5B8DEF', false], ['变种人', '#E8A33F', false], ['反派', '#7A8296', false]];
chips.forEach(function (ch) {
  const w = ch[0].length * 24 + 40;
  const fill = ch[2] ? 'rgba(233,169,59,0.10)' : S2;
  const stroke = ch[2] ? GOLD : LINE;
  const color = ch[2] ? GOLD : ch[1];
  s1 += `<rect x="${cx}" y="136" width="${w}" height="52" rx="26" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>`;
  s1 += txt(cx + 20, 169, ch[0], 24, color, ch[2] ? 600 : 400);
  cx += w + 16;
});
s1 += txt(40, 230, '共 24 位角色', 22, WEAK);

/* 角色卡片 ×4（托尼/史蒂夫/索尔/娜塔莎） */
const top4 = [listChars[0], listChars[1], listChars[2], listChars[3]];
top4.forEach(function (c, i) {
  const y = 256 + i * 208;
  const camp = CAMPS[c.camp] || { color: '#7A8296', label: '未知' };
  s1 += card(40, y, 670, 190, S2);
  s1 += `<circle cx="104" cy="${y + 95}" r="44" fill="${camp.color}26" stroke="${camp.color}66" stroke-width="2"/>`;
  s1 += txt(84, y + 108, c.avatar, 40, camp.color, 700);
  s1 += txt(168, y + 52, c.cn, 30, TXT, 600);
  s1 += txt(168, y + 82, c.en, 20, SUB);
  s1 += txt(168, y + 120, clip(c.note, 22, 24), 22, SUB);
  s1 += `<rect x="168" y="${y + 148}" width="112" height="30" rx="15" fill="${camp.color}26"/>`;
  s1 += txt(178, y + 169, camp.label, 20, camp.color);
  s1 += txt(296, y + 169, '首登场 · ' + clip(c.firstCn, 20, 12), 20, WEAK);
  s1 += `<text x="608" y="${y + 56}" font-size="28" fill="${GOLD}" font-family="${FONT}" font-weight="700" text-anchor="end">${c.count}</text>`;
  s1 += txt(616, y + 56, ' 部作品', 20, WEAK);
  s1 += txt(640, y + 100, '›', 40, WEAK);
});
s1 += `</svg>`;
fs.writeFileSync(path.join(OUT, '_characters-list-preview.svg'), s1);

/* ========== 图2：角色详情页·托尼（750×1700） ========== */
const heroGrad = `<linearGradient id="h" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${tCamp.color}33"/><stop offset="1" stop-color="rgba(11,14,20,0)"/></linearGradient>`;
let s2 = `<svg xmlns="http://www.w3.org/2000/svg" width="750" height="1700" viewBox="0 0 750 1700">
<defs>${heroGrad}</defs>
<rect width="750" height="1700" fill="${BG}"/>
<rect width="750" height="420" fill="url(#h)"/>
`;
/* Hero */
s2 += `<circle cx="375" cy="150" r="72" fill="${tCamp.color}26" stroke="${tCamp.color}" stroke-width="4"/>`;
s2 += txt(344, 178, '托', 62, tCamp.color, 700);
s2 += `<text x="375" y="262" font-size="40" fill="${TXT}" font-family="${FONT}" font-weight="700" text-anchor="middle">托尼·斯塔克 / 钢铁侠</text>`;
s2 += `<text x="375" y="296" font-size="24" fill="${SUB}" font-family="${FONT}" text-anchor="middle">Tony Stark</text>`;
s2 += `<rect x="252" y="320" width="128" height="34" rx="17" fill="${tCamp.color}26"/>`;
s2 += txt(276, 343, tCamp.label, 22, tCamp.color);
s2 += txt(430, 343, tFilms.length + ' 部关联作品', 22, WEAK);
/* 简介 */
s2 += card(40, 450, 670, 200, S2);
s2 += txt(68, 494, '角色简介', 26, GOLD, 600);
s2 += txt(68, 536, clip(tChar.note, 26, 26), 26, SUB);
s2 += txt(68, 572, clip(tChar.note.slice(26), 26, 26), 26, SUB);
s2 += txt(68, 608, clip(tChar.note.slice(52), 26, 20), 26, SUB);
/* 首次出现 */
s2 += card(40, 680, 670, 130, S2);
s2 += txt(68, 724, '首次出现', 26, GOLD, 600);
s2 += `<rect x="68" y="748" width="60" height="50" rx="10" fill="${mcuData.phaseColor(tFirst.phase)}"/>`;
s2 += txt(82, 781, tFirst.letter, 28, 'rgba(255,255,255,0.85)', 700);
s2 += txt(148, 770, tFirst.cn, 28, TXT, 600);
s2 += txt(148, 794, tFirst.en, 20, SUB);
s2 += `<rect x="596" y="754" width="84" height="38" rx="10" fill="none" stroke="${LINE}"/>`;
s2 += txt(610, 779, 'P' + tFirst.phase, 20, WEAK);
/* 关联作品（前 4 行） */
s2 += card(40, 840, 670, 330, S2);
s2 += txt(68, 884, '关联作品（' + tFilms.length + '）', 26, GOLD, 600);
tFilms.slice(0, 4).forEach(function (m, i) {
  const y = 912 + i * 62;
  s2 += `<rect x="68" y="${y}" width="60" height="46" rx="9" fill="${m.phaseColor}"/>`;
  s2 += txt(82, y + 32, m.letter, 26, 'rgba(255,255,255,0.85)', 700);
  s2 += txt(148, y + 26, m.cn, 26, TXT, 600);
  s2 += txt(148, y + 44, m.en + (m.typeLabel ? ' · ' + m.typeLabel : ''), 18, WEAK);
  s2 += `<rect x="588" y="${y + 8}" width="80" height="30" rx="6" fill="rgba(233,169,59,0.15)"/>`;
  s2 += txt(602, y + 29, m.status === 'watched' ? '已看' : (m.status === 'watching' ? '在看' : '未看'), 19, GOLD);
});
/* 关系探索 */
s2 += card(40, 1200, 670, 340, S2);
s2 += txt(68, 1244, '关系探索', 26, GOLD, 600);
related.forEach(function (r, i) {
  const col = i % 3, row = Math.floor(i / 3);
  const x = 68 + col * 218, y = 1272 + row * 126;
  s2 += `<rect x="${x}" y="${y}" width="196" height="110" rx="16" fill="${S1}" stroke="${LINE}" stroke-width="1"/>`;
  s2 += `<circle cx="${x + 98}" cy="${y + 34}" r="26" fill="${r.color}22" stroke="${r.color}" stroke-width="1.5"/>`;
  s2 += txt(x + 84, y + 41, r.avatar, 24, r.color, 700);
  s2 += txt(x + 98, y + 76, clip(r.cn.split(' / ')[0], 22, 5), 22, TXT, 600);
  s2 += `<text x="${x + 98}" y="${y + 98}" font-size="17" fill="${WEAK}" font-family="${FONT}" text-anchor="middle">共同出演 ${r.shared} 部</text>`;
});
s2 += `</svg>`;
fs.writeFileSync(path.join(OUT, '_character-detail-preview.svg'), s2);

Promise.all([
  sharp(Buffer.from(s1)).png().toFile(path.join(OUT, '_characters-list-preview.png')),
  sharp(Buffer.from(s2)).png().toFile(path.join(OUT, '_character-detail-preview.png'))
]).then(function () {
  fs.unlinkSync(path.join(OUT, '_characters-list-preview.svg'));
  fs.unlinkSync(path.join(OUT, '_character-detail-preview.svg'));
  console.log('预览图已生成:\n  assets/preview/_characters-list-preview.png (750×1500)\n  assets/preview/_character-detail-preview.png (750×1700)');
}).catch(function (e) { console.error('生成失败:', e.message); process.exit(1); });
