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

const STATES = {
  normal: { stroke: '#555F73', fill: 'none' },
  active: { stroke: '#F2B233', fill: 'rgba(242,178,51,0.15)' }
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
