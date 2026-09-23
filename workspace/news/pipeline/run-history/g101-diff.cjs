/* G10.1 部署差异对比：本地 h5 vs 服务器 md5 清单 → 差异清单（新增/修改/相同/仅服务器有） */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const H5 = path.join(ROOT, 'h5');
const serverLines = fs.readFileSync(path.join(__dirname, 'server-md5-before.txt'), 'utf8')
  .split('\n').filter(l => /^[0-9a-f]{32}/.test(l.trim()));
const server = {};   /* ./rel → md5 */
serverLines.forEach(l => {
  const m = /^\s*([0-9a-f]{32})\s+\.\/(.+)$/.exec(l.trim());
  if (m) server[m[2].replace(/\\/g, '/')] = m[1];
});

function walk(dir, base) {
  const out = [];
  fs.readdirSync(dir).forEach(name => {
    const full = path.join(dir, name);
    const rel = (base ? base + '/' : '') + name;
    const st = fs.statSync(full);
    if (st.isDirectory()) out.push(...walk(full, rel));
    else out.push({ rel: rel.replace(/\\/g, '/'), full: full });
  });
  return out;
}

const local = walk(H5, '');
const result = { add: [], diff: [], same: [], server_only: [] };
const localRel = {};
local.forEach(f => {
  localRel[f.rel] = true;
  const md5 = crypto.createHash('md5').update(fs.readFileSync(f.full)).digest('hex');
  if (!(f.rel in server)) result.add.push(f.rel);
  else if (server[f.rel] !== md5) result.diff.push(f.rel);
  else result.same.push(f.rel);
});
Object.keys(server).forEach(rel => { if (!localRel[rel]) result.server_only.push(rel); });

console.log('本地文件=' + local.length + '｜服务器文件=' + serverLines.length);
console.log('新增(本地有服务器无)=' + result.add.length);
console.log('修改(两边都有但md5不同)=' + result.diff.length);
console.log('一致=' + result.same.length);
console.log('仅服务器有=' + result.server_only.length + ' → ' + result.server_only.join(', '));
console.log('\n--- 新增 ---'); result.add.forEach(f => console.log('  ' + f));
console.log('--- 修改 ---'); result.diff.forEach(f => console.log('  ' + f));

fs.writeFileSync(path.join(__dirname, 'deploy-diff-20260923.json'),
  JSON.stringify({ local_count: local.length, server_count: serverLines.length,
    add: result.add, diff: result.diff, same_count: result.same.length,
    server_only: result.server_only }, null, 2), 'utf8');
console.log('\n差异清单已留档：deploy-diff-20260923.json');
