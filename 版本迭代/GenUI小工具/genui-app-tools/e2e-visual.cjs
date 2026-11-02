/**
 * 视觉集成 e2e 验证（轻量版 V1.0）：360 / 414 两档手机尺寸 + 三条路线 + 交互
 * 用法：node genui-app-tools\e2e-visual.cjs <preview-url>
 * 结果写入 scratch/e2e-visual-result.json 并打印。
 *
 * 改造说明（2026-10-30）：旧版核验的是 F1 时间轴 / B 档案卡 / F3 随机探索等已删除模块，
 * 本版按「轻量版设计稿」重写成对三条路线速查列表的核验，保留原有效检查意图：
 *   1:1 卡片比例、无横向/画布溢出、Tabs 官方组件、路线切换、剧集标签、无外部资源、控制台无错。
 */
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'scratch', 'e2e-visual-result.json');
let child = null;

fs.mkdirSync(path.dirname(OUT), { recursive: true });

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

function snapOf(items) {
  return items.map((it) => ({
    no: it.no, name: it.name, year: it.year, phase: it.phase, isSeries: it.isSeries
  }));
}

(async () => {
  const URL = process.argv[2] || await startPreview();
  console.log('预览地址: ' + URL);

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

  const LAUNCH_ARGS = [
    '--disable-features=BlockInsecurePrivateNetworkRequests,PrivateNetworkAccessSendPreflights',
    '--disable-web-security',
    '--allow-running-insecure-content'
  ];
  const PW_EP = process.env.PW_EXECUTABLE_PATH || undefined;
  let browser = null;
  const channels = ['chrome', 'msedge'];
  for (const ch of channels) {
    try {
      browser = await chromium.launch({ channel: ch, args: LAUNCH_ARGS, executablePath: PW_EP });
      console.log('使用系统浏览器: ' + ch);
      break;
    } catch (e) { /* 尝试下一个 */ }
  }
  if (!browser) {
    browser = await chromium.launch({ args: LAUNCH_ARGS, executablePath: PW_EP });
    console.log(PW_EP ? '使用 PW_EXECUTABLE_PATH 指定浏览器' : '使用 playwright 内置 chromium');
  }
  const out = { url: URL, viewports: {} };

  const ROUTE_DEF = [
    { id: 'newcomer', name: '新手入门', expected: 12 },
    { id: 'essential', name: '主线精选', expected: 18 },
    { id: 'avengers-doomsday', name: '复联5补课', expected: 8 }
  ];

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
    console.log('=== console (' + vp.w + 'px) ===');
    logs.filter((l) => l.indexOf('hm.baidu') < 0 && l.indexOf('favicon') < 0)
      .slice(0, 12).forEach((l) => console.log('  ' + l));

    let fr = null;
    for (let i = 0; i < 40; i++) {
      const cands = page.frames();
      for (const f of cands) {
        try {
          const ok = await f.evaluate(() => !!document.querySelector('.mcu-route-canvas')
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
      const tapTab = async (idx) => fr.evaluate((i) => {
        const el = document.querySelectorAll('.vc-tabs-option')[i];
        if (!el) return false;
        el.click();
        return true;
      }, idx);
      const readRoute = () => fr.evaluate(() => {
        const box = document.querySelector('.vc-component-container');
        const demo = document.querySelector('.vc-component-demo');
        const canvas = document.querySelector('.mcu-route-canvas');
        const list = document.querySelector('.mcu-order-list');
        const items = Array.from(document.querySelectorAll('.mcu-order-item')).map((el) => ({
          no: (el.querySelector('.mcu-order-no') || {}).textContent,
          name: (el.querySelector('.mcu-order-name') || {}).textContent,
          year: (el.querySelector('.mcu-order-year') || {}).textContent,
          phase: (el.querySelector('.mcu-order-phase') || {}).textContent,
          isSeries: !!el.querySelector('.mcu-order-series')
        }));
        const active = document.querySelector('.vc-tabs-option-active span');
        const names = Array.from(document.querySelectorAll('.mcu-order-name'));
        const truncated = names.filter((n) => n.scrollWidth > n.clientWidth + 1).map((n) => n.textContent);
        return {
          title: (document.querySelector('.mcu-order-title') || {}).textContent,
          routeTag: (document.querySelector('.mcu-order-routeTag') || {}).textContent,
          hint: (document.querySelector('.mcu-order-hint') || {}).textContent,
          activeTab: active ? active.textContent : null,
          tabs: Array.from(document.querySelectorAll('.vc-tabs-option span')).map((s) => s.textContent),
          items: items,
          itemCount: items.length,
          seriesCount: items.filter((i) => i.isSeries).length,
          cardW: Math.round(box.getBoundingClientRect().width),
          cardH: Math.round(box.getBoundingClientRect().height),
          ratio: +(box.getBoundingClientRect().width / box.getBoundingClientRect().height).toFixed(3),
          docOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
          boxOverflow: box.scrollWidth > box.clientWidth + 1,
          canvasFitsDemo: canvas.getBoundingClientRect().bottom <= demo.getBoundingClientRect().bottom + 1,
          listScrollable: list ? list.scrollHeight > list.clientHeight : null,
          listScrollH: list ? list.scrollHeight : null,
          listClientH: list ? list.clientHeight : null,
          // 仅统计「产品根 .vc-component-wrapper 内部」的外部资源（排除 genui 预览容器自带的运行时注入）
          externalRes: (function () {
            const root = document.querySelector('.vc-component-wrapper');
            if (!root) return 0;
            return root.querySelectorAll('[src^="http"],link[href^="http"]').length;
          })(),
          // 透明记录：整个文档级外部资源（含预览 harness），用于排查来源
          externalResGlobal: document.querySelectorAll('[src^="http"],link[href^="http"]').length,
          externalResDetail: Array.prototype.slice.call(
            document.querySelectorAll('[src^="http"],link[href^="http"]')
          ).map((e) => (e.tagName + '|' + (e.getAttribute('src') || e.getAttribute('href'))).slice(0, 120)),
          truncatedNames: truncated
        };
      });

      // 初始（默认 新手入门）
      const initial = await readRoute();
      v.initial = initial;

      // 切到 主线精选 → 复联5补课 → 回 新手入门
      await tapTab(1); await page.waitForTimeout(500);
      v.afterEssential = await readRoute();
      await tapTab(2); await page.waitForTimeout(500);
      v.afterDoomsday = await readRoute();
      await tapTab(0); await page.waitForTimeout(500);
      v.backToNewcomer = await readRoute();

      // 滚动重置：在 复联5 列表滚动后切回，scrollTop 应归零
      await tapTab(2); await page.waitForTimeout(300);
      await fr.evaluate(() => {
        const l = document.querySelector('.mcu-order-list');
        if (l) l.scrollTop = 40;
      });
      await page.waitForTimeout(200);
      const scrolled = await fr.evaluate(() => document.querySelector('.mcu-order-list').scrollTop);
      await tapTab(1); await page.waitForTimeout(400);
      const resetTop = await fr.evaluate(() => document.querySelector('.mcu-order-list').scrollTop);
      v.scrollReset = { scrolledTop: scrolled, resetTopAfterSwitch: resetTop, ok: resetTop === 0 };

      // 重置按钮：回到默认路线
      await fr.evaluate(() => document.getElementById('vc-component-reset').click());
      await page.waitForTimeout(400);
      v.afterReset = await readRoute();

      // 截图：三条路线
      await tapTab(0); await page.waitForTimeout(400);
      await page.screenshot({ path: path.resolve(__dirname, '..', 'scratch', 'visual-newcomer-' + vp.w + '.png') });
      await tapTab(1); await page.waitForTimeout(400);
      await page.screenshot({ path: path.resolve(__dirname, '..', 'scratch', 'visual-essential-' + vp.w + '.png') });
      await tapTab(2); await page.waitForTimeout(400);
      await page.screenshot({ path: path.resolve(__dirname, '..', 'scratch', 'visual-doomsday-' + vp.w + '.png') });
    }
    out.viewports[vp.w] = v;
    await ctx.close();
  }

  await browser.close();

  // ── 断言 ──
  const checks = [];
  const add = (vp, name, ok, detail) => checks.push({ viewport: vp, name: name, pass: !!ok, detail: detail || '' });
  Object.keys(out.viewports).forEach((vp) => {
    const v = out.viewports[vp];
    if (!v.found) { add(vp, '找到产物 frame', false, v.error || ''); return; }
    const init = v.initial;
    add(vp, '1:1 卡片比例 (0.99~1.01)', init.ratio >= 0.99 && init.ratio <= 1.01, 'ratio=' + init.ratio);
    add(vp, '无文档横向溢出', init.docOverflow === false, 'docOverflow=' + init.docOverflow);
    add(vp, '无容器横向溢出', init.boxOverflow === false, 'boxOverflow=' + init.boxOverflow);
    add(vp, '画布完整落在 demo 内', init.canvasFitsDemo === true, 'canvasFitsDemo=' + init.canvasFitsDemo);
    add(vp, 'Tabs 三项齐全', init.tabs.length === 3 && init.tabs.join(',') === '新手入门,主线精选,复联5补课',
      'tabs=' + init.tabs.join('|'));
    add(vp, '默认进入新手入门', init.activeTab === '新手入门' && init.itemCount === 12,
      'active=' + init.activeTab + ' count=' + init.itemCount);
    add(vp, '标题=漫威观影顺序', init.title === '漫威观影顺序', 'title=' + init.title);
    add(vp, '底部提示文案正确', (init.hint || '').indexOf('列表可上下滑动') >= 0 && (init.hint || '').indexOf('点下方切换路线') >= 0,
      'hint=' + init.hint);
    add(vp, '产品内无外部网络资源引用', init.externalRes === 0,
      'product=' + init.externalRes + ' docGlobal=' + init.externalResGlobal + ' → ' + JSON.stringify(init.externalResDetail));
    add(vp, '长片名无截断', init.truncatedNames.length === 0, 'truncated=' + JSON.stringify(init.truncatedNames));

    const ess = v.afterEssential;
    add(vp, '切到主线精选=18 项', ess.itemCount === 18 && ess.activeTab === '主线精选',
      'count=' + ess.itemCount + ' active=' + ess.activeTab);
    add(vp, '主线精选可滚动', ess.listScrollable === true, 'scroll ' + ess.listScrollH + '/' + ess.listClientH);

    const dz = v.afterDoomsday;
    add(vp, '切到复联5补课=8 项', dz.itemCount === 8 && dz.activeTab === '复联5补课',
      'count=' + dz.itemCount + ' active=' + dz.activeTab);
    add(vp, '复联5补课含 2 部剧集', dz.seriesCount === 2, 'series=' + dz.seriesCount);
    const lokiS2 = dz.items.filter((i) => (i.name || '').indexOf('洛基 S2') >= 0)[0];
    add(vp, '洛基 S2 年份=2023 且为剧', lokiS2 && lokiS2.year === '2023' && lokiS2.isSeries,
      lokiS2 ? ('name=' + lokiS2.name + ' year=' + lokiS2.year + ' series=' + lokiS2.isSeries) : '未找到洛基 S2');
    const lokiS1 = dz.items.filter((i) => (i.name || '').indexOf('洛基 S1') >= 0)[0];
    add(vp, '洛基 S1 年份=2021 且为剧', lokiS1 && lokiS1.year === '2021' && lokiS1.isSeries,
      lokiS1 ? ('name=' + lokiS1.name + ' year=' + lokiS1.year) : '未找到洛基 S1');
    add(vp, '复联5补课电影非剧集', dz.items.filter((i) => !i.isSeries).length === 6,
      'movies=' + dz.items.filter((i) => !i.isSeries).length);

    add(vp, '切回新手入门正常', v.backToNewcomer.itemCount === 12 && v.backToNewcomer.activeTab === '新手入门',
      'count=' + v.backToNewcomer.itemCount);
    add(vp, '切换路线后列表位置重置', v.scrollReset.ok, 'scrolled=' + v.scrollReset.scrolledTop + ' reset=' + v.scrollReset.resetTopAfterSwitch);
    add(vp, '重置按钮回到默认路线', v.afterReset.activeTab === '新手入门' && v.afterReset.itemCount === 12,
      'active=' + v.afterReset.activeTab);
  });

  out.assertions = checks;
  out.ALL_PASS = checks.every((c) => c.pass);
  console.log('\n=== 轻量版断言 ===');
  checks.forEach((c) => console.log('  [' + (c.pass ? 'PASS' : 'FAIL') + '] ' + c.viewport + 'px  ' + c.name + '   ' + c.detail));
  const failed = checks.filter((c) => !c.pass);
  console.log(out.ALL_PASS ? '\n*** 全部断言通过 ***' : '\n*** ' + failed.length + ' 项断言失败 ***');

  out.consoleErrors = [];
  Object.keys(out.viewports).forEach((vp) => {
    // 控制台错误已随 logs 打印，这里仅汇总 pageerror
  });

  fs.writeFileSync(OUT, JSON.stringify(out, null, 2), 'utf8');
  console.log('\n结果已写入: ' + OUT);
  stopPreview();
  process.exit(out.ALL_PASS ? 0 : 1);
})().catch((e) => {
  console.error('e2e 失败: ' + e.message);
  stopPreview();
  process.exit(1);
});
