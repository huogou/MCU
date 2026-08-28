/* 双小程序入口 · 环境检测验证
 * 与 mcu-navigator/assets/js/app.js 中 ui._detectEnv 的逻辑保持一致。
 * 运行：node ua_test.js
 */
/* 判定顺序：先 App 内嵌（微信/抖音），再桌面，最后手机浏览器。
 * 原因：Android UA 含 "Linux"，若先判 desktop 会误判安卓微信/抖音为 PC。 */
function detectEnv(ua) {
  ua = ua || '';
  if (/micromessenger/i.test(ua)) return 'wechat';
  if (/bytedancewebview|douyin|aweme/i.test(ua)) return 'douyin';
  if (/windows|macintosh|linux/i.test(ua) && !/mobile/i.test(ua)) return 'desktop';
  return 'mobile';
}

var cases = [
  ['PC Chrome', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36', 'desktop'],
  ['PC Mac Safari', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15', 'desktop'],
  ['iPhone 微信', 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 MicroMessenger/8.0.40', 'wechat'],
  ['Android 微信', 'Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36 MicroMessenger/8.0.40', 'wechat'],
  ['抖音 App 内嵌', 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 BytedanceWebview/d8a21c6', 'douyin'],
  ['抖音 douyin 标识', 'Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36 Douyin/28.0.0', 'douyin'],
  ['TikTok(aweme)', 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0) AppleWebKit/605.1.15 Aweme/28.0.0', 'douyin'],
  ['手机 Safari', 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1', 'mobile'],
  ['手机 Chrome', 'Mozilla/5.0 (Linux; Android 12; Mobile) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36', 'mobile'],
  ['iPad', 'Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1', 'mobile']
];

var pass = 0, fail = 0;
cases.forEach(function (c) {
  var name = c[0], ua = c[1], want = c[2];
  var got = detectEnv(ua);
  var ok = (got === want);
  if (ok) { pass++; } else { fail++; }
  var mark = ok ? 'PASS' : 'FAIL';
  var tail = ok ? '' : '  (期望 ' + want + ')';
  console.log(mark + '  ' + name + ' -> ' + got + tail);
});
console.log('\n结果: ' + pass + ' 通过 / ' + fail + ' 失败');
process.exit(fail > 0 ? 1 : 0);
