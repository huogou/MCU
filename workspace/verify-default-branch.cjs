/* verify-default-branch.cjs · 用本地 git 凭据验证 GitHub 默认分支（凭据不打印） */
const { spawn } = require('child_process');
const https = require('https');
const base = 'D:/SEO/发挥余热/漫威电影宇宙导航';
const gp = spawn('git', ['-C', base, 'credential', 'fill'], { stdio: ['pipe', 'pipe', 'ignore'] });
gp.stdin.write('protocol=https\nhost=github.com\n\n');
gp.stdin.end();
let cred = '';
gp.stdout.on('data', c => cred += c);
gp.on('close', function () {
  const m = cred.match(/password=(.+)/);
  if (!m) { console.log('NO_CRED'); process.exit(2); }
  const token = m[1].trim();
  function get(url) {
    return new Promise(function (res) {
      https.get(url, { headers: { 'User-Agent': 'verify', 'Authorization': 'token ' + token } }, function (r) {
        let d = '';
        r.on('data', c => d += c);
        r.on('end', () => res({ code: r.statusCode, body: d }));
      }).on('error', e => res({ code: 0, body: e.message }));
    });
  }
  (async function () {
    let r = await get('https://api.github.com/repos/huogou/MCU');
    if (r.code !== 200) { console.log('HTTP ' + r.code); process.exit(2); }
    const repo = JSON.parse(r.body);
    console.log('default_branch: ' + repo.default_branch);
    console.log('pushed_at: ' + repo.pushed_at);
    console.log('private: ' + repo.private);
    process.exit(0);
  })();
});
