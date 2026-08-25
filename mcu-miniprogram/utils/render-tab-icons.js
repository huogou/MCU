/* D12-A Step3-3 TabBar 图标渲染脚本（一次性工具，可留档可删除）
 * 图标来源：恢复资料/D10原型/D10-A_观影主线强化原型.html 内联 SVG（唯一权威）
 * 样式来源：原型 .tab-bar CSS —— 未选中 stroke #6B7384 / 选中 stroke #E9A93B + fill rgba(233,169,59,0.15)
 * 输出：assets/icons/tab/*.png（81x81，透明底，8 张：4 图标 × 2 态）
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// —— D10-A 原型 TabBar 四个图标（viewBox 0 0 24 24，与原型逐字符一致） ——
const ICONS = {
  home: {
    label: '首页',
    body:
      '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>' +
      '<polyline points="9 22 9 12 15 12 15 22"/>'
  },
  routes: {
    label: '路线',
    body: '<path d="M3 6h18M3 12h18M3 18h12"/>'
  },
  explore: {
    label: '探索',
    body: '<circle cx="12" cy="12" r="9"/><path d="M12 3v9l6 3"/>'
  },
  'my-mcu': {
    label: '我的MCU',
    body: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>'
  }
};

// —— 双态样式（V1.2 Token） ——
const STATES = {
  normal: { stroke: '#555F73', fill: 'none' },            // text-weak
  active: { stroke: '#F2B233', fill: 'rgba(242,178,51,0.15)' } // gold + 15% 金填充
};

const OUT_DIR = path.join(__dirname, '..', 'assets', 'icons', 'tab');

function svgSource(stroke, fill, body) {
  // 画布 81x81；viewBox 四周留 2.5 单位边距，避免图形顶格（原型 25px 图标带留白感）
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" width="81" height="81" viewBox="-2.5 -2.5 29 29">' +
    `<g stroke="${stroke}" fill="${fill}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${body}</g>` +
    '</svg>'
  );
}

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const manifest = [];
  for (const [key, icon] of Object.entries(ICONS)) {
    for (const [state, style] of Object.entries(STATES)) {
      const name = state === 'normal' ? `${key}.png` : `${key}-active.png`;
      const outPath = path.join(OUT_DIR, name);
      await sharp(Buffer.from(svgSource(style.stroke, style.fill, icon.body)))
        .png()
        .toFile(outPath);
      const meta = await sharp(outPath).metadata();
      manifest.push({ file: name, size: `${meta.width}x${meta.height}`, bytes: fs.statSync(outPath).size });
    }
  }
  console.log('RENDER_OK');
  console.table(manifest);
})();
