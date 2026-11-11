/* 临时验证：截图介绍页排版修改效果 */
const { chromium } = require('playwright');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const HTML = path.join(ROOT, 'genui-app', 'index.html');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 360, height: 360 },
    deviceScaleFactor: 2
  });
  await page.goto('file://' + HTML.replace(/\\/g, '/'));
  await page.waitForTimeout(500);
  await page.screenshot({
    path: path.join(ROOT, 'scratch', 'spacing-fix-newcomer-360.png'),
    fullPage: false
  });
  console.log('截图完成');
  await browser.close();
})();
