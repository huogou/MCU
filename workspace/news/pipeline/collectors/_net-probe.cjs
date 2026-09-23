/* 一次性：探测本环境是否可出网（不涉及项目代码） */
'use strict';
const https = require('https');
const targets = [
  'https://variety.com/feed/',
  'https://thedirect.com/rss'
];
let done = 0;
targets.forEach(function (u) {
  const req = https.get(u, {
    headers: { 'User-Agent': 'MCUAtlasBot/1.0 (+https://mcu.yaokaixin.top/)' },
    timeout: 8000
  }, function (res) {
    let n = 0;
    res.on('data', function (c) { n += c.length; if (n > 4096) req.destroy(); });
    res.on('end', function () {
      process.stdout.write('OK ' + res.statusCode + ' ' + n + 'B ' + u + '\n');
      if (++done === targets.length) process.exit(0);
    });
  });
  req.on('timeout', function () { req.destroy(); process.stdout.write('TIMEOUT ' + u + '\n'); if (++done === targets.length) process.exit(0); });
  req.on('error', function (e) { process.stdout.write('ERR ' + (e.code || e.message) + ' ' + u + '\n'); if (++done === targets.length) process.exit(0); });
});
setTimeout(function () { process.stdout.write('GLOBAL_TIMEOUT\n'); process.exit(0); }, 12000);
