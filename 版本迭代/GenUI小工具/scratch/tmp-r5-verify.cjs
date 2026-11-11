/* 临时验证脚本：启动 genui preview（R5 修订稿），Playwright 实测 360/414 双档 */
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const APP = process.argv[2] || 'v2.0-R5-修订稿-20261105/index.html';
const TAG = process.argv[3] || 'R5';

function startPreview() {
  return new Promise((resolve, reject) => {
    const child = spawn('genui', ['preview', APP, '-n', 'MCU观影助手', '--qr-image'], {
      cwd: ROOT, shell: true
    });
    let buf = '';
    const timer = setTimeout(() => reject(new Error('预览启动超时')), 60000);
    const onData = (d) => {
      buf += d.toString();
      const m = buf.match(/127\.0\.0\.1:(\d+)/);
      if (m) { clearTimeout(timer); resolve({ url: 'http://127.0.0.1:' + m[1], child }); }
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('error', (e) => { clearTimeout(timer); reject(e); });
  });
}

(async () => {
  const { url, child } = await startPreview();
  console.log('预览地址:', url);
  const { chromium } = require('playwright');
  const browser = await chromium.launch({ channel: 'msedge' }).catch(() => chromium.launch({ channel: 'chrome' }));
  const out = { url, viewports: {} };
  try {
    for (const vp of [{ w: 360, h: 760 }, { w: 414, h: 820 }]) {
      const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 2 });
      const page = await ctx.newPage();
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2500);
      let fr = null;
      for (let i = 0; i < 40 && !fr; i++) {
        for (const f of page.frames()) {
          try {
            if (await f.evaluate(() => !!document.querySelector('.mcu-route-canvas'))) { fr = f; break; }
          } catch (e) { /* ignore */ }
        }
        if (!fr) await page.waitForTimeout(300);
      }
      if (!fr) { out.viewports[vp.w] = { error: '未找到产物 frame' }; await ctx.close(); continue; }
      const m = await fr.evaluate(() => {
        const q = (s) => document.querySelector(s);
        const qa = (s) => Array.prototype.slice.call(document.querySelectorAll(s));
        const box = q('.vc-component-container');
        const canvas = q('.mcu-route-canvas');
        const pages = qa('.mcu-page');
        const intro = pages[0], work = pages[1];
        const r = (el) => el.getBoundingClientRect();
        const rows = (sel) => Array.prototype.slice.call(sel.querySelectorAll(':scope > .mcu-block-row, :scope > .mcu-field-row'));
        const gaps = (arr) => arr.length > 1 ? arr.slice(1).map((row, i) => Math.round(r(row).top - r(arr[i]).bottom)) : [];
        const lines = (els) => els.map((b) => Math.round(r(b).height / parseFloat(getComputedStyle(b).lineHeight)));
        const introRows = Array.from(intro.querySelectorAll('.mcu-block-row'));
        const workRows = Array.from(work.querySelectorAll('.mcu-field-row'));
        const introBodies = introRows.map(x => x.querySelector('.mcu-block-body'));
        const workBodies = workRows.map(x => x.querySelector('.mcu-field-body'));
        const pageOverflow = pages.map((p, i) => ({ i, over: p.scrollHeight > p.clientHeight + 1, sh: p.scrollHeight, ch: p.clientHeight }));
        return {
          container: { w: Math.round(r(box).width), h: Math.round(r(box).height) },
          canvas: { w: Math.round(r(canvas).width), h: Math.round(r(canvas).height) },
          headH: Math.round(r(intro.querySelector('.mcu-page-head')).height),
          pagerH: Math.round(r(canvas.querySelector('.mcu-pager')).height),
          introFieldsH: Math.round(r(intro.querySelector('.mcu-page-blocks')).height),
          introRows: introRows.map(x => ({ h: Math.round(r(x).height), label: x.querySelector('.mcu-block-label').textContent })),
          introGaps: gaps(introRows),
          introLineHeights: introBodies.map(b => getComputedStyle(b).lineHeight),
          introLines: lines(introBodies),
          introOverflow: intro.scrollHeight > intro.clientHeight + 1,
          workFieldsH: Math.round(r(work.querySelector('.mcu-page-fields')).height),
          workRows: workRows.map(x => ({ h: Math.round(r(x).height), label: x.querySelector('.mcu-field-label').textContent })),
          workGaps: gaps(workRows),
          workLineHeights: workBodies.map(b => getComputedStyle(b).lineHeight),
          workLines: lines(workBodies),
          workOverflow: work.scrollHeight > work.clientHeight + 1,
          canvasHOverflow: canvas.scrollHeight > canvas.clientHeight + 1,
          docOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
          boxOverflow: box.scrollWidth > box.clientWidth + 1,
          titleTruncated: qa('.mcu-page-title').filter((t) => t.scrollWidth > t.clientWidth + 1).map((t) => t.textContent),
          pageOverflow: pageOverflow.filter(x => x.over),
          scrollW: document.documentElement.scrollWidth,
          clientW: document.documentElement.clientWidth
        };
      });
      out.viewports[vp.w] = m;
      const shot = path.join(ROOT, 'screenshots', 'R5-介绍页-' + vp.w + '.png');
      await page.screenshot({ path: shot });
      out.viewports[vp.w].screenshot = shot;
      await ctx.close();
    }
  } finally {
    await browser.close();
    try { child.kill(); } catch (e) { /* ignore */ }
  }
  console.log(JSON.stringify(out, null, 2));
})();
