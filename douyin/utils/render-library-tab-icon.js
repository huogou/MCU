/* 作品查询 TabBar 图标渲染脚本（2026-09-08 新增）
 * 用途：本轮整改 TabBar 由 2 项扩为 3 项（首页 / 作品 / 我的MCU），
 *       需为「作品」页补充 tab 图标，样式须与既有 8 张完全一致。
 * 样式来源：utils/render-tab-icons.js（唯一权威）
 *   normal: stroke #555F73 / fill none
 *   active: stroke #F2B233 / fill rgba(242,178,51,0.15)
 * 输出：assets/icons/tab/library.png、library-active.png（81x81 透明底）
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

/* 「作品库」2x2 网格图标（viewBox 0 0 24 24，与同行图标同规格） */
const GRID_BODY =
  '<rect x="3" y="3" width="7.5" height="7.5" rx="1.5"/>' +
  '<rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5"/>' +
  '<rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5"/>' +
  '<rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5"/>';

/* ⚠ 关键：这里刻意使用「与实际产出 PNG 一致」的色值，而不是 app.json 里的
   新 Token（#555F73 / #F2B233）。原因：
   现存 4 张 Tab 图标（home / my-mcu，2026-08 生成）实际测量到的平均色为
   normal #6B7384 / active #E9A93B，与 render-tab-icons.js STATES 常量声明的
   #555F73 / #F2B233 存在历史漂移（旧图未随 Token 更新而重绘）。
   若新图标用新 Token，同一个 TabBar 内三个图标会出现肉眼可见的深浅差异。
   → 本轮以「与兄弟图标视觉一致」为准；不动已通过的 4 张旧图。
   → Token 漂移本身作为遗留项上报，待产品决定是否需要整体统一。 */
const STATES = {
  normal: { stroke: '#6B7384', fill: 'none' },
  active: { stroke: '#E9A93B', fill: 'rgba(233,169,59,0.15)' }
};

const OUT_DIR = path.join(__dirname, '..', 'assets', 'icons', 'tab');

function svgSource(stroke, fill, body) {
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" width="81" height="81" viewBox="-2.5 -2.5 29 29">' +
    '<g stroke="' + stroke + '" fill="' + fill + '" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' +
    body + '</g></svg>'
  );
}

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const manifest = [];
  for (const [state, style] of Object.entries(STATES)) {
    const name = state === 'normal' ? 'library.png' : 'library-active.png';
    const outPath = path.join(OUT_DIR, name);
    const svg = svgSource(style.stroke, style.fill, GRID_BODY);
    try {
      await sharp(Buffer.from(svg)).png().toFile(outPath);
    } catch (e) {
      console.error('RENDER_FAIL', name, e && e.message);
      process.exit(1);
    }
    const meta = await sharp(outPath).metadata();
    manifest.push({ file: name, size: meta.width + 'x' + meta.height, bytes: fs.statSync(outPath).size });
  }
  console.log('RENDER_OK');
  console.table(manifest);
})();
