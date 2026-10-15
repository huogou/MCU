/**
 * 视觉集成 e2e 验证：360 / 414 两档手机尺寸 + 三模块 + 交互
 * 用法：node genui-app-tools\e2e-visual.cjs <preview-url>
 * 结果写入 scratch/e2e-visual-result.json 并打印
 */
const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'scratch', 'e2e-visual-result.json');
let child = null;

/** 启动 genui preview 并解析端口；不传 URL 时自启，避免服务生命周期问题 */
function startPreview() {
  return new Promise((resolve, reject) => {
    child = spawn('genui', ['preview', 'genui-app/index.html', '-n', 'MCU观影助手', '--qr-image'], {
      cwd: ROOT, shell: true
    });
    let buf = '';
    const timer = setTimeout(() => reject(new Error('预览启动超时')), 60000);
    const onData = (d) => {
      buf += d.toString();
      const m = buf.match(/127\.0\.0\.1:(\d+)/);
      if (m) { clearTimeout(timer); resolve('http://127.0.0.1:' + m[1]); }
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('error', (e) => { clearTimeout(timer); reject(e); });
  });
}

function stopPreview() {
  if (child) { try { child.kill(); } catch (e) { /* ignore */ } }
}

(async () => {
  const URL = process.argv[2] || await startPreview();
  console.log('预览地址: ' + URL);

  /* playwright 可能只装在全局，优先本地，失败回退全局 */
  let chromium;
  try {
    ({ chromium } = require('playwright'));
  } catch (e) {
    const { execSync } = require('child_process');
    const root = execSync('npm root -g', { encoding: 'utf8' }).trim();
    const p = path.join(root, '@playwright', 'cli', 'node_modules', 'playwright');
    ({ chromium } = require(p));
    console.log('使用全局 playwright: ' + p);
  }

  /* 优先用系统已安装的 Chrome/Edge，避免额外下载浏览器 */
  /* 预览容器把产物放在 srcdoc iframe（origin=null）中，Chrome 的 Private Network Access
     会拦截其对 127.0.0.1 的请求，导致 static/data.js 加载失败、画布空白。
     故关闭该策略以完成本地验证（仅影响测试环境，不影响产物本身）。 */
  const LAUNCH_ARGS = [
    '--disable-features=BlockInsecurePrivateNetworkRequests,PrivateNetworkAccessSendPreflights',
    '--disable-web-security',
    '--allow-running-insecure-content'
  ];
  let browser = null;
  const channels = ['chrome', 'msedge'];
  for (const ch of channels) {
    try {
      browser = await chromium.launch({ channel: ch, args: LAUNCH_ARGS });
      console.log('使用系统浏览器: ' + ch);
      break;
    } catch (e) { /* 尝试下一个 */ }
  }
  if (!browser) {
    browser = await chromium.launch({ args: LAUNCH_ARGS });
    console.log('使用 playwright 内置 chromium');
  }
  const out = { url: URL, viewports: {} };

  for (const vp of [{ w: 360, h: 760 }, { w: 414, h: 820 }]) {
    const ctx = await browser.newContext({
      viewport: { width: vp.w, height: vp.h },
      deviceScaleFactor: 2
    });
    const page = await ctx.newPage();
    const logs = [];
    page.on('console', (m) => logs.push('[' + m.type() + '] ' + m.text()));
    page.on('pageerror', (e) => logs.push('[pageerror] ' + e.message));
    await page.goto(URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
    console.log('=== console ===');
    logs.filter(function (l) {
      return l.indexOf('hm.baidu') < 0 && l.indexOf('favicon') < 0;
    }).slice(0, 12).forEach(function (l) { console.log('  ' + l); });

    // 定位承载产物的 frame：预览容器为 iframe 嵌套 srcdoc iframe，需轮询等待，
    // 且必须命中真正渲染产物的那一层（含 .mcu-route-canvas）
    let fr = null;
    for (let i = 0; i < 40; i++) {
      const cands = page.frames();
      for (const f of cands) {
        try {
          const ok = await f.evaluate(() => !!document.querySelector('.mcu-route-canvas')
            || !!document.querySelector('.mcu-discover-canvas')
            || !!document.querySelector('.vc-component-container'));
          if (ok) { fr = f; break; }
        } catch (e) { /* 未加载完成 */ }
      }
      if (fr) break;
      await page.waitForTimeout(300);
    }
    const v = { found: !!fr };
    if (!fr) {
      v.error = '未找到承载产物的 frame，frames=' + JSON.stringify(page.frames().map(f => f.url().slice(0, 70)));
    }
    if (fr) {
      /* 安全点击：元素不存在时返回 false 而不抛错，避免单点失败中断全部 */
      const tap = async (sel) => fr.evaluate((s) => {
        const el = document.querySelector(s);
        if (!el) return false;
        el.click();
        return true;
      }, sel);
      // A 模块 F1 时间轴
      v.A = await fr.evaluate(() => {
        const box = document.querySelector('.vc-component-container');
        if (!box) return { error: '无 .vc-component-container' };
        const demo = document.querySelector('.vc-component-demo');
        if (!demo) return { error: '无 .vc-component-demo', demoHTML: box.innerHTML.slice(0, 300) };
        const c = box.getBoundingClientRect();
        const d = demo.getBoundingClientRect();
        const tl = document.querySelector('.mcu-timeline');
        const nm = document.querySelector('.mcu-tl-name');
        return {
          cardW: Math.round(c.width),
          cardH: Math.round(c.height),
          ratio: +(c.width / c.height).toFixed(3),
          demoPct: +(d.height / c.height * 100).toFixed(1),
          eyebrow: (document.querySelector('.mcu-route-eyebrow') || {}).textContent,
          routeTitle: (document.querySelector('.mcu-route-title') || {}).textContent,
          pills: document.querySelectorAll('.mcu-stat-pill').length,
          tlItems: document.querySelectorAll('.mcu-tl-item').length,
          currentItems: document.querySelectorAll('.mcu-tl-item.current').length,
          phaseDots: document.querySelectorAll('.mcu-phase-dot').length,
          footerText: (document.querySelector('.mcu-route-footer-text') || {}).textContent,
          timelineScrollable: tl ? tl.scrollHeight > tl.clientHeight : null,
          docOverflow: document.documentElement.scrollHeight > document.documentElement.clientHeight,
          boxOverflow: box.scrollHeight > box.clientHeight,
          nameTruncated: nm ? nm.scrollWidth > nm.clientWidth : null,
          hasRouteCanvas: !!document.querySelector('.mcu-route-canvas')
        };
      });

      // B 模块：点击 footer 展开档案卡
      v.tapFooter = await tap('#mcu-route-footer');
      await page.waitForTimeout(700);
      v.B = await fr.evaluate(() => {
        const box = document.querySelector('.vc-component-container');
        const demo = document.querySelector('.vc-component-demo');
        if (!box || !demo) return { error: '容器缺失' };
        const d = demo.getBoundingClientRect();
        const c = box.getBoundingClientRect();
        return {
          opened: !!document.querySelector('.mcu-film-card'),
          archiveNo: (document.querySelector('.mcu-archive-no') || {}).textContent,
          title: (document.querySelector('.mcu-archive-title') || {}).textContent,
          hasPoster: !!document.querySelector('.mcu-archive-poster'),
          hasPosterClass: !!document.querySelector('.mcu-archive-visual.has-poster'),
          programmatic: !!document.querySelector('.mcu-archive-roman'),
          roman: (document.querySelector('.mcu-archive-roman') || {}).textContent,
          filmIcon: !!document.querySelector('.mcu-archive-film-icon'),
          desc: (document.querySelector('.mcu-archive-desc') || {}).textContent,
          tags: document.querySelectorAll('.mcu-archive-tag').length,
          demoPct: +(d.height / c.height * 100).toFixed(1),
          docOverflow: document.documentElement.scrollHeight > document.documentElement.clientHeight,
          boxOverflow: box.scrollHeight > box.clientHeight,
          externalRes: document.querySelectorAll('[src^="http"],link[href^="http"]').length
        };
      });

      // 返回时间轴 → 切 F3
      v.tapCardBack = await tap('.mcu-film-card');
      await page.waitForTimeout(600);
      v.tapTabRandom = await tap('#tab-random');
      await page.waitForTimeout(700);

      // C 模块 F3 发现卡（V1.1 结构：海报片名 + 元信息 + 理由 + 可点提示条）
      v.C = await fr.evaluate(() => {
        const box = document.querySelector('.vc-component-container');
        const demo = document.querySelector('.vc-component-demo');
        if (!box || !demo) return { error: '容器缺失' };
        const d = demo.getBoundingClientRect();
        const c = box.getBoundingClientRect();
        const phaseTag = document.querySelector('.mcu-discover-phase-tag');
        const metaTxt = (document.querySelector('.mcu-discover-meta') || {}).textContent || '';
        return {
          badgeGone: !document.querySelector('.mcu-discover-header'),
          heroTitle: (document.querySelector('.mcu-discover-hero-title') || {}).textContent,
          phaseTagOnPoster: !!phaseTag,
          metaText: metaTxt.trim(),
          phaseOccurrencesInMeta: (metaTxt.match(/第.阶段/g) || []).length,
          reasonLabel: (document.querySelector('.mcu-discover-reason-label') || {}).textContent,
          reasonText: (document.querySelector('.mcu-discover-reason-text') || {}).textContent,
          reasonLen: ((document.querySelector('.mcu-discover-reason-text') || {}).textContent || '').length,
          bodyTitleGone: !document.querySelector('.mcu-discover-body .mcu-discover-title'),
          dividerGone: !document.querySelector('.mcu-discover-divider'),
          poster: !!document.querySelector('.mcu-discover-hero-poster'),
          roman: (document.querySelector('.mcu-discover-hero-roman') || {}).textContent,
          foot: (document.querySelector('.mcu-discover-foot-text') || {}).textContent,
          footClickable: !!document.querySelector('#mcu-discover-foot[role="button"]'),
          archiveNo: (document.querySelector('.mcu-discover-foot-right') || {}).textContent,
          bottomBtnGone: !document.getElementById('mcu-shuffle'),
          /* 溢出诊断：各层高度与 body 内容需求 */
          layerHeights: (function () {
            const pick = function (s) {
              const e = document.querySelector(s);
              return e ? Math.round(e.getBoundingClientRect().height) : null;
            };
            return {
              canvas: pick('.mcu-discover-canvas'),
              header: pick('.mcu-discover-header'),
              card: pick('.mcu-discover-card'),
              hero: pick('.mcu-discover-hero'),
              body: pick('.mcu-discover-body'),
              meta: pick('.mcu-discover-meta'),
              reason: pick('.mcu-discover-reason'),
              foot: pick('.mcu-discover-foot')
            };
          })(),
          bodyScrollH: (function () {
            const b = document.querySelector('.mcu-discover-body');
            return b ? b.scrollHeight : null;
          })(),
          bodyClientH: (function () {
            const b = document.querySelector('.mcu-discover-body');
            return b ? b.clientHeight : null;
          })(),
          reasonClamp: (function () {
            const t = document.querySelector('.mcu-discover-reason-text');
            if (!t) return null;
            const cs = getComputedStyle(t);
            return { clamp: cs.webkitLineClamp, lh: cs.lineHeight, fs: cs.fontSize, h: Math.round(t.getBoundingClientRect().height) };
          })(),
          demoPct: +(d.height / c.height * 100).toFixed(1),
          docOverflow: document.documentElement.scrollHeight > document.documentElement.clientHeight,
          boxOverflow: box.scrollHeight > box.clientHeight
        };
      });

      // 换一部 → 验证变化（V1.1：入口为卡片底部提示条）
      const t1 = await fr.evaluate(() => (document.querySelector('.mcu-discover-hero-title') || {}).textContent);
      await tap('#mcu-discover-foot');
      await page.waitForTimeout(600);
      const t2 = await fr.evaluate(() => (document.querySelector('.mcu-discover-hero-title') || {}).textContent);
      v.shuffle = { from: t1, to: t2, changed: t1 !== t2 };

      // 截图：F3 在「有真实海报」状态下先截（此时刚换过一部，大概率有海报）
      await page.screenshot({ path: path.resolve(__dirname, '..', 'scratch', 'visual-f3-' + vp.w + '.png') });
      await tap('#tab-route');
      await page.waitForTimeout(700);
      await page.screenshot({ path: path.resolve(__dirname, '..', 'scratch', 'visual-f1-' + vp.w + '.png') });
      await fr.evaluate(() => {
        const f = document.querySelector('#mcu-route-footer');
        if (f) f.click();
      });
      await page.waitForTimeout(700);
      await page.screenshot({ path: path.resolve(__dirname, '..', 'scratch', 'visual-b-' + vp.w + '.png') });

      // 程序化视觉卡（F3 无海报影片）——放在截图后，避免影响截图状态
      await tap('#tab-random');
      await page.waitForTimeout(500);
      let tries = 0, fb = null;
      while (tries < 25 && !fb) {
        await tap('#mcu-discover-foot');
        await page.waitForTimeout(150);
        fb = await fr.evaluate(() => {
          const r = document.querySelector('.mcu-discover-hero-roman');
          if (!r) return null;
          return {
            title: (document.querySelector('.mcu-discover-hero-title') || {}).textContent,
            roman: r.textContent,
            filmIcon: !!document.querySelector('.mcu-discover-hero .mcu-archive-film-icon')
          };
        });
        tries++;
      }
      v.C_programmatic = fb || '未在 25 次内命中无海报影片';
    }
    out.viewports[vp.w] = v;
    await ctx.close();
  }

  await browser.close();
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2), 'utf8');
  console.log(JSON.stringify(out, null, 2));
  console.log('\n结果已写入: ' + OUT);
  stopPreview();
  process.exit(0);
})().catch(function (e) {
  console.error('e2e 失败: ' + e.message);
  stopPreview();
  process.exit(1);
});
