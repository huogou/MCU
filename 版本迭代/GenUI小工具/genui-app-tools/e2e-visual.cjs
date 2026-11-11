/**
 * 视觉集成 e2e 验证（信息架构 V2.0 · 分页）：360 / 414 两档手机尺寸 + 三条路线 + 分页交互
 * 用法：node genui-app-tools\e2e-visual.cjs <preview-url>
 * 结果写入 scratch/e2e-visual-result.json 并打印。
 *
 * 改造说明（2026-11-03，§12 / §14）：
 *   删除 V1.0 的 3 项旧断言（"列表可上下滑动" / "主线精选可滚动" / "切换后列表位置重置"）；
 *   按 V2.0 分页口径重写为：无垂直滚动、页码精确、翻页正确、滑动不切路线、字段行数≤预算、
 *   徽章三态、进度条宽度 (k−1)/N、kicker 序号、首末页禁用 no-op、切路线页码重置、重置回默认、
 *   console 零错误；保留 1:1 卡片 / 零横向溢出 / 剧集标签 / 无外部资源等既有意图。
 */
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'scratch', 'e2e-visual-result.json');
let child = null;

fs.mkdirSync(path.dirname(OUT), { recursive: true });

/* §5.3 / §5.4 / §6：字段行数上限（按用户侧标签）*/
const LINE_BUDGET = {
  '适合谁': 2,
  '为什么': 3,
  '怎么排': 2,
  '看完获得': 2,
  '为什么看它': 2,
  '它的作用': 3,
  '看完你会懂': 2,
  '后续关联': 2
};

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

/* 预览 harness 自身注入的外部资源报错（cosmic css / 统计脚本 / favicon）不计入产物错误 */
function isHarnessNoise(line) {
  return /ms\.bdstatic|hm\.baidu|favicon|cos-icon|cosmic\/tokens|ERR_CONNECTION_CLOSED|status of 404/i.test(line);
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

  for (const vp of [{ w: 360, h: 760 }, { w: 414, h: 820 }]) {
    const ctx = await browser.newContext({
      viewport: { width: vp.w, height: vp.h },
      deviceScaleFactor: 2
    });
    const page = await ctx.newPage();
    const logs = [];
    const pageErrors = [];
    page.on('console', (m) => { if (m.type() === 'error') logs.push('[console.error] ' + m.text()); });
    page.on('pageerror', (e) => pageErrors.push('[pageerror] ' + e.message));
    await page.goto(URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);

    let fr = null;
    for (let i = 0; i < 40; i++) {
      for (const f of page.frames()) {
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
      out.viewports[vp.w] = v;
      await ctx.close();
      continue;
    }

    /* ── 读取当前分页状态与全部页面的版式度量 ── */
    const readState = () => fr.evaluate(() => {
      const q = (s) => document.querySelector(s);
      const qa = (s) => Array.prototype.slice.call(document.querySelectorAll(s));
      const box = q('.vc-component-container');
      const demo = q('.vc-component-demo');
      const canvas = q('.mcu-route-canvas');
      const track = q('.mcu-page-track');
      const pager = q('.mcu-pager');
      const pages = qa('.mcu-page');

      const tf = track ? (track.style.transform || '') : '';
      const m = tf.match(/translateX\((-?[\d.]+)%\)/);
      const pageIndex = m ? Math.round(-parseFloat(m[1]) / 100) : 0;
      const cur = pages[pageIndex] || null;

      const prev = q('.mcu-pager-prev');
      const next = q('.mcu-pager-next');
      const prog = q('.mcu-pager-progress');
      const num = q('.mcu-pager-num');

      const LBL = '.mcu-field-label, .mcu-block-label';
      const BODY = '.mcu-field-body, .mcu-block-body';
      const allRows = [];
      /* 逐页测量：内容自然高 / 实际间距 / 上下贴合度（R4-⑯ 字段区纵向铺满） */
      const pageFit = pages.map((p, pi) => {
        const f = p.querySelector('.mcu-page-fields');
        if (!f) return { page: pi, avail: 0, content: 0, gaps: [], topPad: 0, bottomPad: 0 };
        const rows = Array.prototype.slice.call(f.querySelectorAll('.mcu-field-row, .mcu-block-row'));
        const sum = rows.reduce((s, r) => s + r.getBoundingClientRect().height, 0);
        const gaps = [];
        for (let i = 1; i < rows.length; i++) {
          gaps.push(Math.round((rows[i].getBoundingClientRect().top - rows[i - 1].getBoundingClientRect().bottom) * 10) / 10);
        }
        const fb = f.getBoundingClientRect();
        return {
          page: pi,
          avail: Math.round(fb.height),
          content: Math.round(sum),
          gaps: gaps,
          topPad: Math.round(((rows[0] || fb).getBoundingClientRect().top - fb.top) * 10) / 10,
          bottomPad: Math.round((fb.bottom - rows[rows.length - 1].getBoundingClientRect().bottom) * 10) / 10,
          usedHeight: Math.round(sum + gaps.reduce((s, g) => s + g, 0))
        };
      });
      pages.forEach((p, pi) => {
        Array.prototype.slice.call(p.querySelectorAll('.mcu-field-row, .mcu-block-row')).forEach((row) => {
          const label = (row.querySelector(LBL) || {}).textContent || '';
          const body = row.querySelector(BODY);
          const lh = body ? parseFloat(getComputedStyle(body).lineHeight) : 0;
          const h = body ? body.getBoundingClientRect().height : 0;
          allRows.push({
            page: pi,
            label: label.trim(),
            lines: lh ? Math.round(h / lh) : 0,
            lineHeight: lh,
            fontSize: body ? parseFloat(getComputedStyle(body).fontSize) : 0,
            overflow: body ? (body.scrollHeight - body.clientHeight) : 0,
            textLen: body ? body.textContent.length : 0,
            sample: body ? body.textContent.slice(0, 18) : ''
          });
        });
      });

      return {
        activeTab: (q('.vc-tabs-option-active span') || {}).textContent || null,
        tabs: qa('.vc-tabs-option span').map((s) => s.textContent),
        dataRouteCount: (window.MCU_GENUI_DATA.routes || []).map((r) => r.items.length),
        pageIndex: pageIndex,
        pageCount: pages.length,
        pagerNum: num ? num.textContent.trim() : null,
        prevDisabled: prev ? prev.getAttribute('aria-disabled') : null,
        nextDisabled: next ? next.getAttribute('aria-disabled') : null,
        prevClassDisabled: prev ? prev.classList.contains('is-disabled') : null,
        nextClassDisabled: next ? next.classList.contains('is-disabled') : null,
        progressPct: (prog && pager)
          ? +((prog.getBoundingClientRect().width / pager.getBoundingClientRect().width) * 100).toFixed(1)
          : null,
        kicker: cur ? (cur.querySelector('.mcu-page-kicker') || {}).textContent : null,
        title: cur ? (cur.querySelector('.mcu-page-title') || {}).textContent : null,
        badge: cur && cur.querySelector('.mcu-badge')
          ? {
            text: cur.querySelector('.mcu-badge').textContent,
            cls: cur.querySelector('.mcu-badge').className
          }
          : null,
        seriesTag: cur ? !!cur.querySelector('.mcu-series-tag') : false,
        introBlocks: cur ? cur.querySelectorAll('.mcu-block-row').length : 0,
        fieldRows: cur ? cur.querySelectorAll('.mcu-field-row').length : 0,
        allRows: allRows,
        titleTruncated: qa('.mcu-page-title').filter((t) => t.scrollWidth > t.clientWidth + 1)
          .map((t) => t.textContent),
        pageFit: pageFit,
        curFit: pageFit[pageIndex] || null,
        /* 字段标签（52px 固定宽）不得裁字 */
        labelOverflow: qa('.mcu-field-label, .mcu-block-label')
          .filter((l) => l.scrollWidth > l.clientWidth + 1)
          .map((l) => l.textContent + ':' + l.scrollWidth + '/' + l.clientWidth),
        cardW: Math.round(box.getBoundingClientRect().width),
        cardH: Math.round(box.getBoundingClientRect().height),
        ratio: +(box.getBoundingClientRect().width / box.getBoundingClientRect().height).toFixed(3),
        canvasH: Math.round(canvas.getBoundingClientRect().height),
        headH: cur ? Math.round(cur.querySelector('.mcu-page-head').getBoundingClientRect().height) : 0,
        fieldsH: cur ? Math.round(cur.querySelector('.mcu-page-fields').getBoundingClientRect().height) : 0,
        pagerH: pager ? Math.round(pager.getBoundingClientRect().height) : 0,
        /* 无垂直滚动：画布/轨道/每页/字段区都不应出现可滚动内容 */
        canvasScrollable: canvas.scrollHeight > canvas.clientHeight + 1,
        trackScrollable: track.scrollHeight > track.clientHeight + 1,
        pageScrollable: pages.some((p) => p.scrollHeight > p.clientHeight + 1),
        fieldsScrollable: pages.some((p) => {
          const f = p.querySelector('.mcu-page-fields');
          return f ? f.scrollHeight > f.clientHeight + 1 : false;
        }),
        docOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
        boxOverflow: box.scrollWidth > box.clientWidth + 1,
        canvasFitsDemo: canvas.getBoundingClientRect().bottom <= demo.getBoundingClientRect().bottom + 1,
        externalRes: (function () {
          const root = document.querySelector('.vc-component-wrapper');
          if (!root) return 0;
          return root.querySelectorAll('[src^="http"],link[href^="http"]').length;
        })(),
        externalResDetail: Array.prototype.slice.call(
          document.querySelectorAll('[src^="http"],link[href^="http"]')
        ).map((e) => (e.tagName + '|' + (e.getAttribute('src') || e.getAttribute('href'))).slice(0, 120))
      };
    });

    const clickNext = () => fr.evaluate(() => document.getElementById('mcu-pager-next').click());
    const clickPrev = () => fr.evaluate(() => document.getElementById('mcu-pager-prev').click());
    const clickTab = (idx) => fr.evaluate((i) => {
      const el = document.querySelectorAll('.vc-tabs-option')[i];
      if (!el) return false;
      el.click();
      return true;
    }, idx);
    const clickReset = () => fr.evaluate(() => document.getElementById('vc-component-reset').click());

    /* 逐页前进/后退（每次点击后等过 300ms busy 锁）*/
    async function goTo(target) {
      let cur = (await readState()).pageIndex;
      let guard = 0;
      while (cur < target && guard++ < 30) {
        await clickNext();
        await page.waitForTimeout(340);
        cur = (await readState()).pageIndex;
      }
      guard = 0;
      while (cur > target && guard++ < 30) {
        await clickPrev();
        await page.waitForTimeout(340);
        cur = (await readState()).pageIndex;
      }
      return cur;
    }

    /* 滑动：在画布内真实拖动（pointer 事件 + touch-action:none）
       注意 1：轨道自身带 translateX，翻页后其 boundingBox 已左移出视口，故取画布区坐标；
       注意 2：产物位于 preview iframe 内，必须用 Playwright locator.boundingBox()
       取「主页面坐标系」坐标（evaluate 的 getBoundingClientRect 是 iframe 局部坐标）。*/
    async function swipe(dir, vertical) {
      const c = await fr.locator('.mcu-route-canvas').boundingBox();
      const p = await fr.locator('.mcu-pager').boundingBox();
      if (!c || !p) throw new Error('未取到画布/页码条位置');
      const cx = c.x + c.width / 2;
      const trackTop = c.y;
      const trackH = p.y - c.y;
      const cy = trackTop + trackH / 2;
      if (vertical) {
        /* 斜向拖动：|Δx|=30 ≥24，但 |Δx| < 1.5|Δy| → 方向锁定后不翻页 */
        await page.mouse.move(cx + 15, cy - 30);
        await page.mouse.down();
        for (let i = 1; i <= 5; i++) {
          await page.mouse.move(cx + 15 - 6 * i, cy - 30 + 12 * i);
          await page.waitForTimeout(16);
        }
        await page.mouse.up();
        await page.waitForTimeout(340);
        return;
      }
      const from = dir < 0 ? c.x + c.width * 0.8 : c.x + c.width * 0.2;
      const to = dir < 0 ? c.x + c.width * 0.2 : c.x + c.width * 0.8;
      await page.mouse.move(from, cy);
      await page.mouse.down();
      for (let i = 1; i <= 5; i++) {
        await page.mouse.move(from + (to - from) * (i / 5), cy);
        await page.waitForTimeout(16);
      }
      await page.mouse.up();
      await page.waitForTimeout(340);
    }

    /* ── 初始态（默认 新手入门 · 第 1 页）── */
    v.initial = await readState();

    /* 首末页禁用 no-op：第 1 页点 ◀ 不得翻页 */
    await clickPrev();
    await page.waitForTimeout(200);
    v.afterPrevOnFirst = await readState();

    /* 下一页：第 2 页 = 作品 01 */
    await clickNext();
    await page.waitForTimeout(340);
    v.page2 = await readState();

    /* 中段：第 3 页（作品 02）*/
    await clickNext();
    await page.waitForTimeout(340);
    v.page3 = await readState();

    /* 末页：点 12 次到 13/13 */
    v.last = null;
    for (let i = 0; i < 12; i++) {
      await clickNext();
      await page.waitForTimeout(340);
    }
    v.last = await readState();
    /* 末页 ▶ 禁用 no-op */
    await clickNext();
    await page.waitForTimeout(200);
    v.afterNextOnLast = await readState();

    /* 滑动不切路线：重置后左滑 → 第 2 页且 Tabs 不变 */
    await clickReset();
    await page.waitForTimeout(300);
    v.afterResetA = await readState();
    await swipe(-1);
    v.afterSwipeLeft = await readState();
    await swipe(1);
    v.afterSwipeRight = await readState();
    /* 纵向拖动不应翻页（方向锁定）*/
    await swipe(-1, true);
    v.afterVerticalDrag = await readState();

    /* 黑豹 = 新手入门作品 10（第 11 页）：推荐级徽章形态 */
    v.blackPantherIndex = await goTo(10);
    v.blackPanther = await readState();

    /* 切路线：页码重置为 1/N */
    await clickTab(1);
    await page.waitForTimeout(400);
    v.afterEssential = await readState();
    /* 主线精选第 17 页：最长片名（奇异博士2：疯狂多元宇宙）单行完整 */
    v.essentialPage17Index = await goTo(16);
    v.essentialPage17 = await readState();

    await clickTab(2);
    await page.waitForTimeout(400);
    v.afterDoomsday = await readState();
    v.doomsdayPage2Index = await goTo(1);
    v.doomsdayPage2 = await readState();
    v.doomsdayPage3Index = await goTo(2);
    v.doomsdayPage3 = await readState();

    /* 重置：回新手入门第 1 页 */
    await clickReset();
    await page.waitForTimeout(400);
    v.afterReset = await readState();

    /* 截图：三路线介绍页 + 一条作品页 */
    await fr.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: path.resolve(__dirname, '..', 'scratch', 'visual-v2-intro-' + vp.w + '.png') });
    await clickNext();
    await page.waitForTimeout(340);
    await page.screenshot({ path: path.resolve(__dirname, '..', 'scratch', 'visual-v2-item-' + vp.w + '.png') });
    await clickTab(2);
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.resolve(__dirname, '..', 'scratch', 'visual-v2-doomsday-' + vp.w + '.png') });
    await clickNext();
    await page.waitForTimeout(340);
    await page.screenshot({ path: path.resolve(__dirname, '..', 'scratch', 'visual-v2-doomsday-item-' + vp.w + '.png') });

    v.consoleErrors = logs.filter((l) => !isHarnessNoise(l));
    v.pageErrors = pageErrors;
    v.consoleNoise = logs.filter((l) => isHarnessNoise(l)).length;
    out.viewports[vp.w] = v;
    await ctx.close();
  }

  await browser.close();

  /* ── 断言（§14 十五项账单 → 分页口径）── */
  const checks = [];
  const add = (vp, name, ok, detail) => checks.push({ viewport: vp, name: name, pass: !!ok, detail: detail || '' });

  Object.keys(out.viewports).forEach((vp) => {
    const v = out.viewports[vp];
    if (!v.found) { add(vp, '找到产物 frame', false, v.error || ''); return; }
    const init = v.initial;
    const totalNewcomer = init.dataRouteCount[0] + 1;

    add(vp, '1:1 卡片比例 (0.99~1.01)', init.ratio >= 0.99 && init.ratio <= 1.01, 'ratio=' + init.ratio);
    add(vp, '无文档横向溢出', init.docOverflow === false, 'docOverflow=' + init.docOverflow);
    add(vp, '无容器横向溢出', init.boxOverflow === false, 'boxOverflow=' + init.boxOverflow);
    add(vp, '画布完整落在 demo 内', init.canvasFitsDemo === true, 'canvasFitsDemo=' + init.canvasFitsDemo);

    /* ① 无垂直滚动（画布 / 轨道 / 每页 / 字段区）*/
    add(vp, '无垂直滚动（画布/轨道/每页/字段区）',
      init.canvasScrollable === false && init.trackScrollable === false &&
      init.pageScrollable === false && init.fieldsScrollable === false,
      'canvas=' + init.canvasScrollable + ' track=' + init.trackScrollable +
      ' page=' + init.pageScrollable + ' fields=' + init.fieldsScrollable);

    /* ② 骨架账单：页头 36 + 页码条 26 固定；字段区自适应且内容不得超出（逐页核对）*/
    const skeleton = init.headH + init.fieldsH + init.pagerH;
    const overFit = init.pageFit.filter((f) => f.usedHeight > f.avail + 1);
    const minHead = Math.min.apply(null, init.pageFit.map((f) => f.avail - f.usedHeight));
    add(vp, '骨架 ≤ 内容区（页头36 + 页码26 + 字段区自适应）',
      init.headH === 36 && init.pagerH === 26 && skeleton <= init.canvasH + 1,
      'head=' + init.headH + ' fields=' + init.fieldsH + ' pager=' + init.pagerH +
      ' canvas=' + init.canvasH + ' 骨架=' + skeleton);
    add(vp, '字段内容不超出字段区（全 ' + init.pageFit.length + ' 页逐页核对）',
      overFit.length === 0,
      '最小余量=' + minHead + 'px 超页=' + JSON.stringify(overFit));

    /* ⑯（V2.0-R4）字段区纵向铺满：间距 ≥4px（弹性）+ 上下贴合（无连续空白） */
    const allGaps = init.pageFit.reduce((a, f) => a.concat(f.gaps), []);
    const minGap = Math.min.apply(null, allGaps);
    const maxGap = Math.max.apply(null, allGaps);
    const notFlush = init.pageFit.filter((f) => f.topPad > 1 || f.bottomPad > 1);
    add(vp, '字段区纵向铺满（间距 ≥4px + 上下贴合，R4-⑯）',
      minGap >= 3.5 && notFlush.length === 0,
      '间距 ' + minGap + '–' + maxGap + 'px（' + allGaps.length + ' 处）· 未贴合页=' +
      JSON.stringify(notFlush.map((f) => 'p' + f.page + ' top' + f.topPad + '/bottom' + f.bottomPad)));

    /* ③ 默认进入：新手入门 · 第 1 页 1/13 */
    add(vp, '默认进入新手入门 第 1 页',
      init.activeTab === '新手入门' && init.pageIndex === 0 &&
      init.pagerNum === '1 / ' + totalNewcomer && init.title === '路线介绍',
      'active=' + init.activeTab + ' page=' + init.pageIndex + ' num=' + init.pagerNum + ' title=' + init.title);
    add(vp, 'Tabs 三项齐全', init.tabs.join(',') === '新手入门,主线精选,复联5补课', 'tabs=' + init.tabs.join('|'));

    /* ④ 介绍页 4 块 */
    add(vp, '介绍页 4 块齐全', init.introBlocks === 4 && init.fieldRows === 0,
      'blocks=' + init.introBlocks + ' fields=' + init.fieldRows);

    /* ⑤ 首/末页按钮禁用 + no-op */
    add(vp, '首页 ◀ 禁用且 no-op',
      init.prevDisabled === 'true' && init.prevClassDisabled === true &&
      v.afterPrevOnFirst.pageIndex === 0 && v.afterPrevOnFirst.pagerNum === init.pagerNum,
      'aria=' + init.prevDisabled + ' class=' + init.prevClassDisabled +
      ' 点击后 page=' + v.afterPrevOnFirst.pageIndex);

    add(vp, '末页 ▶ 禁用且 no-op',
      v.last.nextDisabled === 'true' && v.last.nextClassDisabled === true &&
      v.last.pageIndex === totalNewcomer - 1 && v.last.pagerNum === totalNewcomer + ' / ' + totalNewcomer &&
      v.afterNextOnLast.pageIndex === totalNewcomer - 1,
      'aria=' + v.last.nextDisabled + ' num=' + v.last.pagerNum + ' 点击后 page=' + v.afterNextOnLast.pageIndex);

    /* ⑥ 翻页正确 + 页码精确 + kicker 序号 + 进度条 */
    const p2 = v.page2;
    add(vp, '下一页 → 第 2 页（作品 01 钢铁侠 必看）',
      p2.pageIndex === 1 && p2.pagerNum === '2 / ' + totalNewcomer &&
      p2.title === '钢铁侠' && p2.badge && p2.badge.text === '必看' &&
      p2.fieldRows === 4 && p2.introBlocks === 0,
      'num=' + p2.pagerNum + ' title=' + p2.title + ' badge=' + (p2.badge && p2.badge.text) + ' rows=' + p2.fieldRows);
    add(vp, 'kicker 作品序号 = ITEM 01/12',
      (p2.kicker || '').indexOf('ITEM 01/12') === 0 && (p2.kicker || '').indexOf('PHASE 01') > 0,
      'kicker=' + p2.kicker);
    add(vp, '进度条宽度 = (k−1)/N（第 1 部 8.3%）',
      Math.abs(p2.progressPct - 8.3) <= 0.8,
      'progress=' + p2.progressPct + '% 期望≈8.3%');
    add(vp, '进度条 0%（介绍页）/ 100%（末页）',
      init.progressPct === 0 && v.last.progressPct === 100,
      'intro=' + init.progressPct + '% last=' + v.last.progressPct + '%');

    /* ⑦ kicker 序号与页码一致（第 3 页 = 作品 02）*/
    add(vp, 'kicker 序号与页码一致（第 3 页 = ITEM 02/12）',
      (v.page3.kicker || '').indexOf('ITEM 02/12') === 0 && v.page3.pagerNum === '3 / ' + totalNewcomer,
      'kicker=' + v.page3.kicker + ' num=' + v.page3.pagerNum);

    /* 徽章三态：必看=实心金类 / 推荐=描边金类（黑豹 = 新手入门作品 10，第 11 页）*/
    add(vp, '徽章三态类名正确（必看 core / 推荐 recommended）',
      p2.badge.cls.indexOf('mcu-badge-core') >= 0 &&
      v.blackPanther.badge && v.blackPanther.badge.text === '推荐' &&
      v.blackPanther.badge.cls.indexOf('mcu-badge-recommended') >= 0,
      '必看 cls=' + p2.badge.cls + ' ｜ 推荐 title=' + v.blackPanther.title +
      ' cls=' + (v.blackPanther.badge && v.blackPanther.badge.cls));

    /* ⑨ 滑动不切路线 */
    add(vp, '滑动翻页生效', v.afterSwipeLeft.pageIndex === 1, 'page=' + v.afterSwipeLeft.pageIndex);
    add(vp, '滑动不触发路线切换', v.afterSwipeLeft.activeTab === '新手入门' && v.afterSwipeRight.activeTab === '新手入门',
      'left=' + v.afterSwipeLeft.activeTab + ' right=' + v.afterSwipeRight.activeTab);
    add(vp, '右滑回上一页', v.afterSwipeRight.pageIndex === 0, 'page=' + v.afterSwipeRight.pageIndex);
    add(vp, '纵向拖动不翻页（方向锁定）', v.afterVerticalDrag.pageIndex === 0,
      'page=' + v.afterVerticalDrag.pageIndex);

    /* ⑩ 切路线页码重置 */
    add(vp, '切主线精选 → 页码重置 1/19',
      v.afterEssential.activeTab === '主线精选' && v.afterEssential.pageIndex === 0 &&
      v.afterEssential.pagerNum === '1 / ' + (v.afterEssential.dataRouteCount[1] + 1) &&
      v.afterEssential.prevDisabled === 'true',
      'active=' + v.afterEssential.activeTab + ' num=' + v.afterEssential.pagerNum);
    add(vp, '切复联5补课 → 页码重置 1/9',
      v.afterDoomsday.activeTab === '复联5补课' && v.afterDoomsday.pageIndex === 0 &&
      v.afterDoomsday.pagerNum === '1 / ' + (v.afterDoomsday.dataRouteCount[2] + 1),
      'active=' + v.afterDoomsday.activeTab + ' num=' + v.afterDoomsday.pagerNum);

    /* ⑪ 长片名不截断（主线精选第 17 页 奇异博士2：疯狂多元宇宙）*/
    add(vp, '最长片名单行完整（奇异博士2）',
      v.essentialPage17Index === 16 && v.essentialPage17.title === '奇异博士2：疯狂多元宇宙' &&
      v.essentialPage17.titleTruncated.length === 0,
      'index=' + v.essentialPage17Index + ' title=' + v.essentialPage17.title +
      ' truncated=' + JSON.stringify(v.essentialPage17.titleTruncated));

    /* ⑫ 剧集：洛基 S1 2021 / S2 2023 + 「剧」标签 */
    add(vp, '复联5补课 洛基 S1（2021 · 剧）',
      v.doomsdayPage2Index === 1 && v.doomsdayPage2.title === '洛基 S1' &&
      (v.doomsdayPage2.kicker || '').indexOf('2021 · 剧') > 0 && v.doomsdayPage2.seriesTag === true,
      'title=' + v.doomsdayPage2.title + ' kicker=' + v.doomsdayPage2.kicker + ' seriesTag=' + v.doomsdayPage2.seriesTag);
    add(vp, '复联5补课 洛基 S2（2023 · 剧）',
      v.doomsdayPage3Index === 2 && v.doomsdayPage3.title === '洛基 S2' &&
      (v.doomsdayPage3.kicker || '').indexOf('2023 · 剧') > 0 && v.doomsdayPage3.seriesTag === true,
      'title=' + v.doomsdayPage3.title + ' kicker=' + v.doomsdayPage3.kicker);

    /* ⑬ 重置回默认 */
    add(vp, '重置回默认（新手入门 1/13）',
      v.afterReset.activeTab === '新手入门' && v.afterReset.pageIndex === 0 &&
      v.afterReset.pagerNum === '1 / ' + totalNewcomer,
      'active=' + v.afterReset.activeTab + ' num=' + v.afterReset.pagerNum);

    /* ⑭ 字段行数 ≤ 预算 且零截断（全 38 页逐字段核对）*/
    const over = init.allRows.filter((r) => {
      const budget = LINE_BUDGET[r.label];
      return budget != null && r.lines > budget;
    });
    const clipped = init.allRows.filter((r) => r.overflow > 1);
    add(vp, '全部字段行数 ≤ 预算且零裁切',
      over.length === 0 && clipped.length === 0,
      '超行=' + JSON.stringify(over.map((r) => r.label + '@p' + r.page + ':' + r.lines + '行')) +
      ' 裁切=' + JSON.stringify(clipped.map((r) => r.label + '@p' + r.page)));
    add(vp, '字段标签不裁字（52px）', init.labelOverflow.length === 0,
      '溢出=' + JSON.stringify(init.labelOverflow).slice(0, 300));
    add(vp, '正文 12px / 行高 16px（§6 规格值）',
      init.allRows.every((r) => r.fontSize === 12 && r.lineHeight === 16),
      'fontSizes=' + JSON.stringify(Array.from(new Set(init.allRows.map((r) => r.fontSize)))) +
      ' lh=' + JSON.stringify(Array.from(new Set(init.allRows.map((r) => r.lineHeight)))) +
      ' 行高比=' + (init.allRows.length ? (init.allRows[0].lineHeight / init.allRows[0].fontSize).toFixed(2) : '-'));

    /* ⑮ 资源与错误 */
    add(vp, '产品内无外部网络资源引用', init.externalRes === 0,
      'product=' + init.externalRes + ' → ' + JSON.stringify(init.externalResDetail));
    add(vp, 'console 零错误', v.consoleErrors.length === 0 && v.pageErrors.length === 0,
      'errors=' + JSON.stringify(v.consoleErrors.concat(v.pageErrors)) + '（已过滤预览 harness 噪声 ' + v.consoleNoise + ' 条）');
  });

  out.assertions = checks;
  out.ALL_PASS = checks.every((c) => c.pass);
  console.log('\n=== V2.0 分页断言 ===');
  checks.forEach((c) => console.log('  [' + (c.pass ? 'PASS' : 'FAIL') + '] ' + c.viewport + 'px  ' + c.name + '   ' + c.detail));
  const failed = checks.filter((c) => !c.pass);
  console.log(out.ALL_PASS ? '\n*** 全部断言通过 ***' : '\n*** ' + failed.length + ' 项断言失败 ***');

  fs.writeFileSync(OUT, JSON.stringify(out, null, 2), 'utf8');
  console.log('\n结果已写入: ' + OUT);
  stopPreview();
  process.exit(out.ALL_PASS ? 0 : 1);
})().catch((e) => {
  console.error('e2e 失败: ' + e.message);
  stopPreview();
  process.exit(1);
});
