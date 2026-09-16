// 拉取线上 v2.css，验证 PC 方案 C 块是否已部署生效
const https = require('https');
const url = 'https://mcuatlas.xyz/assets/css/v2.css?_=' + Date.now();
https.get(url, { headers: { 'User-Agent': 'mcu-dev-check' } }, (res) => {
  let body = '';
  res.on('data', (c) => { body += c; });
  res.on('end', () => {
    const checks = {
      'HTTP状态': res.statusCode,
      '1024断点存在': /min-width:\s*1024px/.test(body),
      '容器1280': /max-width:\s*1280px/.test(body),
      '资料库5列': /repeat\(5,\s*1fr\)/.test(body),
      '我的MCU双列': /1\.4fr\s+1fr/.test(body),
      '未来计划双列': /#v2-upcoming \.v2-tl-list/.test(body),
      '方案C注释': /方案 C/.test(body)
    };
    console.log('bytes=' + body.length);
    for (const k of Object.keys(checks)) console.log(k + ': ' + checks[k]);
  });
}).on('error', (e) => { console.error('FETCH_ERR', e.message); process.exit(1); });
