/* ============================================================
 * MCU 抖音小程序 · TabBar 图标门禁检查
 * ------------------------------------------------------------
 * 为什么存在：
 *   2026-09-08 新增「作品」Tab 图标时发现：既有 4 张图标（2026-08 生成）的
 *   实际色值为 normal #6B7384 / active #E9A93B，而 app.json 与
 *   render-tab-icons.js 的 STATES 常量声明的是 #555F73 / #F2B233——
 *   即「设计 Token」与「已产出图片」之间存在历史漂移。
 *   这类问题靠肉眼很难稳定发现，故固化为自动检查。
 *
 * 检查项：
 *   ① 图标文件存在（含 selected 态）
 *   ② 尺寸与位深正确
 *   ③ 非透明像素占比在合理区间（防「空图 / 全透明」导致的无显示）
 *   ④ 常态 / 激活态确实使用了不同颜色（防两态同图的「激活态无反馈」）
 *   ⑤ 打印实际平均色，便于发现同组图标间的色值漂移
 *
 * 依赖 sharp：需带 NODE_PATH 指向已安装 sharp 的 node_modules
 * 运行：cd douyin && NODE_PATH=<...>/node_modules node utils/check-tab-icons.js
 * ============================================================ */

const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const ROOT = path.resolve(__dirname, '..');

const appJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'app.json'), 'utf8'));

let pass = 0, fail = 0;
const failures = [];
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; failures.push(name + (extra ? '  → ' + extra : '')); console.log('  FAIL  ' + name + (extra ? '  → ' + extra : '')); }
}

async function inspect(relPath) {
  const abs = path.join(ROOT, relPath);
  if (!fs.existsSync(abs)) return null;
  const { data, info } = await sharp(abs).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let opaque = 0, rSum = 0, gSum = 0, bSum = 0;
  for (let i = 0; i < data.length; i += info.channels) {
    if (data[i + 3] > 40) { opaque++; rSum += data[i]; gSum += data[i + 1]; bSum += data[i + 2]; }
  }
  const coverage = opaque / (info.width * info.height);
  const hex = opaque
    ? '#' + [rSum, gSum, bSum].map((s) => Math.round(s / opaque).toString(16).padStart(2, '0')).join('')
    : null;
  return { width: info.width, height: info.height, coverage: coverage, hex: hex, bytes: fs.statSync(abs).size };
}

(async () => {
  console.log('══════ TabBar 图标门禁 ══════');
  const list = appJson.tabBar.list;

  for (const item of list) {
    console.log('\n── ' + item.text + ' ──');
    const nAbs = path.join(ROOT, item.iconPath);
    const aAbs = path.join(ROOT, item.selectedIconPath);
    ok(item.text + '·常态图标存在', fs.existsSync(nAbs), item.iconPath);
    ok(item.text + '·激活图标存在', fs.existsSync(aAbs), item.selectedIconPath);
    if (!fs.existsSync(nAbs) || !fs.existsSync(aAbs)) continue;

    const n = await inspect(item.iconPath);
    const a = await inspect(item.selectedIconPath);
    console.log('     常态 ' + `${n.width}x${n.height}`.padEnd(8) + '覆盖率 ' + (n.coverage * 100).toFixed(1) + '%  平均色 ' + n.hex + '  ' + n.bytes + 'B');
    console.log('     激活 ' + `${a.width}x${a.height}`.padEnd(8) + '覆盖率 ' + (a.coverage * 100).toFixed(1) + '%  平均色 ' + a.hex + '  ' + a.bytes + 'B');

    ok(item.text + '·常态尺寸 81x81', n.width === 81 && n.height === 81, n.width + 'x' + n.height);
    ok(item.text + '·激活尺寸 81x81', a.width === 81 && a.height === 81, a.width + 'x' + a.height);
    ok(item.text + '·常态非空白（覆盖率 >5%）', n.coverage > 0.05, (n.coverage * 100).toFixed(1) + '%');
    ok(item.text + '·激活非空白（覆盖率 >5%）', a.coverage > 0.05, (a.coverage * 100).toFixed(1) + '%');
    ok(item.text + '·两态颜色不同（激活态有视觉反馈）', n.hex !== a.hex, n.hex + ' vs ' + a.hex);
  }

  /* 跨 Tab 色值漂移检测：常态之间、激活态之间应保持一致 */
  console.log('\n── 跨 Tab 色值一致性 ──');
  const normals = [], actives = [];
  for (const item of list) {
    const n = await inspect(item.iconPath);
    const a = await inspect(item.selectedIconPath);
    if (n) normals.push({ text: item.text, hex: n.hex });
    if (a) actives.push({ text: item.text, hex: a.hex });
  }
  const normSet = Array.from(new Set(normals.map((x) => x.hex)));
  const actSet = Array.from(new Set(actives.map((x) => x.hex)));
  console.log('     常态色集合：' + normSet.join(' , '));
  console.log('     激活色集合：' + actSet.join(' , '));

  /* 判据说明：不同字形（房子/网格/盾牌）的抗锯齿边缘采样不同，
     平均色的单通道差异可能在 1~2/255 之间波动，属不可感知差异。
     因此用「通道级容差」而非「字符串全等」判定，并输出实测最大偏差。 */
  const TOLERANCE = 3;
  function maxChannelDelta(list) {
    let max = 0;
    for (let i = 1; i < list.length; i++) {
      const a = list[0].hex, b = list[i].hex;
      for (let c = 1; c <= 5; c += 2) {
        max = Math.max(max, Math.abs(parseInt(a.slice(c, c + 2), 16) - parseInt(b.slice(c, c + 2), 16)));
      }
    }
    return max;
  }
  const nDelta = maxChannelDelta(normals);
  const aDelta = maxChannelDelta(actives);
  console.log('     常态最大通道偏差：' + nDelta + ' / 255（容差 ' + TOLERANCE + '）');
  console.log('     激活最大通道偏差：' + aDelta + ' / 255（容差 ' + TOLERANCE + '）');
  ok('常态色一致（无漂移）', nDelta <= TOLERANCE, normSet.join(',') + ' Δ=' + nDelta);
  ok('激活色一致（无漂移）', aDelta <= TOLERANCE, actSet.join(',') + ' Δ=' + aDelta);

  console.log('\n════════════════════════════════');
  console.log('  通过 ' + pass + ' 项 / 失败 ' + fail + ' 项');
  if (fail) { console.log('  失败清单：'); failures.forEach((f) => console.log('   - ' + f)); }
  console.log('════════════════════════════════');
  process.exit(fail ? 1 : 0);
})();
