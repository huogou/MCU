/** 诊断：量取 F1 时间轴各层盒子，确认列表被压缩的根因 */
const path = require('path');
const { spawn, execSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..');

function startPreview() {
  return new Promise((resolve, reject) => {
    const child = spawn('genui', ['preview', 'genui-app/index.html', '-n', 'MCU观影助手'], { cwd: ROOT, shell: true });
    let buf = '';
    const t = setTimeout(() => reject(new Error('timeout')), 60000);
    const on = (d) => {
      buf += d.toString();
      const m = buf.match(/127\.0\.0\.1:(\d+)/);
      if (m) { clearTimeout(t); resolve({ url: 'http://127.0.0.1:' + m[1], child }); }
    };
    child.stdout.on('data', on);
    child.stderr.on('data', on);
  });
}

(async () => {
  let chromium;
  try { ({ chromium } = require('playwright')); }
  catch (e) {
    const root = execSync('npm root -g', { encoding: 'utf8' }).trim();
    ({ chromium } = require(path.join(root, '@playwright', 'cli', 'node_modules', 'playwright')));
  }
  const { url, child } = await startPreview();
  const browser = await chromium.launch({ channel: 'chrome' });
  const ctx = await browser.newContext({ viewport: { width: 360, height: 760 } });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  let fr = null;
  for (let i = 0; i < 40 && !fr; i++) {
    for (const f of page.frames()) {
      try { if (await f.evaluate(() => !!document.querySelector('.mcu-route-canvas'))) { fr = f; break; } } catch (e) {}
    }
    if (!fr) await page.waitForTimeout(300);
  }
  if (!fr) { console.log('no frame'); process.exit(1); }

  const r = await fr.evaluate(() => {
    function box(sel) {
      const el = document.querySelector(sel);
      if (!el) return { sel, missing: true };
      const b = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return {
        sel,
        top: Math.round(b.top), h: Math.round(b.height), w: Math.round(b.width),
        flex: cs.flex, minH: cs.minHeight, overflow: cs.overflow,
        display: cs.display, scrollH: el.scrollHeight, clientH: el.clientHeight
      };
    }
    return JSON.stringify([
      box('.vc-component-container'),
      box('.vc-component-header'),
      box('.vc-component-card-wrapper'),
      box('.vc-component-demo'),
      box('.mcu-route-canvas'),
      box('.mcu-route-header'),
      box('.mcu-timeline'),
      box('.mcu-tl-item'),
      box('.mcu-route-footer')
    ], null, 1);
  });
  console.log(r);
  await browser.close();
  try { child.kill(); } catch (e) {}
  process.exit(0);
})().catch(e => { console.error(e.message); process.exit(1); });
