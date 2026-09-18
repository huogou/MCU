/* prod-map-check.cjs · 线上终检：https://mcuatlas.xyz/map-pc.html 核心链路 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
async function main() {
  const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
  function CDP(u) { let id = 0; const pend = []; const evs = []; const ws = new WebSocket(u); ws.addEventListener('message', ev => { const m = JSON.parse(ev.data); if (m.id && pend[m.id]) { const f = pend[m.id]; delete pend[m.id]; f(m.error ? Promise.reject(new Error(JSON.stringify(m.error))) : Promise.resolve(m.result)) } if (m.method) evs.forEach(f2 => f2(m)); }); const raw = (method, params) => new Promise((res, rej) => { const mid = ++id; pend[mid] = p => p.then(res).catch(rej); ws.send(JSON.stringify({ id: mid, method, params: params || {} })) }); return { ready: new Promise(res => ws.addEventListener('open', res)), send: raw, onEvent: f2 => evs.push(f2), close: () => { try { ws.close(); } catch (e) {} } } }
  function connect(port) { return new Promise(function (res, rej) { http.get('http://127.0.0.1:' + port + '/json/list', function (r) { let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d).filter(t => t.type === 'page')[0].webSocketDebuggerUrl)); }).on('error', rej); }); }
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  let PASS = 0, FAIL = 0;
  function rec(name, pass, actual) { if (pass) PASS++; else FAIL++; console.log((pass ? 'PASS' : 'FAIL') + ' | ' + name + ' | ' + String(actual)); }
  const chrome = spawn(CHROME, ['--headless=new', '--remote-debugging-port=0', '--no-proxy-server', '--proxy-server=direct://', '--proxy-bypass-list=*', '--disable-gpu', '--user-data-dir=' + path.join(process.env.TEMP || 'D:/tmp', 'mcu-prod-' + Date.now()), '--window-size=1440,900', 'about:blank'], { stdio: ['ignore', 'pipe', 'pipe'] });
  let wsUrl = null; chrome.stderr.on('data', c => { const m = c.toString().match(/DevTools listening on (ws:\/\/\S+)/); if (m && !wsUrl) wsUrl = m[1] });
  while (!wsUrl) await sleep(200);
  const cdp = CDP(await connect(new URL(wsUrl).port)); await cdp.ready; await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
  let jsErr = 0;
  cdp.send('Log.enable').catch(() => {});
  cdp.onEvent(m => { if (m.method === 'Runtime.exceptionThrown') jsErr++; });
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await cdp.send('Page.navigate', { url: 'https://mcuatlas.xyz/map-pc.html?v=' + Date.now() });
  await sleep(3500);

  async function ev(expr) { const r = await cdp.send('Runtime.evaluate', { expression: expr, returnByValue: true }); return r.result.value; }
  const FOCUS_CHK =
    '(function(){'
    + 'var c=document.querySelector(".movie-node.center");if(!c)return JSON.stringify({err:"NO_CENTER"});'
    + 'var cr=c.getBoundingClientRect();'
    + 'var rels=[].slice.call(document.querySelectorAll(".movie-node.related"));'
    + 'var bgs=[].slice.call(document.querySelectorAll(".focus-conn-label-bg"));'
    + 'var cl=function(r){return {x1:r.x,y1:r.y,x2:r.x+r.width,y2:r.y+r.height};};'
    + 'var hit=function(a,b,p){return a.x1<b.x2+p&&a.x2+p>b.x1&&a.y1<b.y2+p&&a.y2+p>b.y1};'
    + 'var bad=[];'
    + '[].slice.call(document.querySelectorAll(".movie-node.center .node-label,.movie-node.center .node-year,.movie-node.related .node-label,.movie-node.related .node-year")).forEach(function(t){'
    + '  var tr=cl(t.getBoundingClientRect());'
    + '  bgs.forEach(function(b,i){ if(hit(tr,cl(b.getBoundingClientRect()),2)) bad.push("L"+i+"~"+(t.textContent||"").slice(0,6)); });'
    + '});'
    + 'var lblHit=0;'
    + 'for(var i=0;i<bgs.length;i++)for(var j=i+1;j<bgs.length;j++){if(hit(cl(bgs[i].getBoundingClientRect()),cl(bgs[j].getBoundingClientRect()),2))lblHit++;}'
    + 'return JSON.stringify({id:c.getAttribute("data-id"),name:(c.querySelector(".node-label")||{}).textContent||"",'
    + 'd:Math.round(cr.width),zoom:document.getElementById("zoom-display").textContent,'
    + 'nRel:rels.length,nLbl:bgs.length,textOverlap:bad,lblOverlap:lblHit});})()';

  /* ① 线上加载 */
  const ov = JSON.parse(await ev('(function(){return JSON.stringify({nodes:document.querySelectorAll(".movie-node").length,zoom:document.getElementById("zoom-display").textContent});})()'));
  rec('P1 线上加载(40节点)', ov.nodes === 40, 'nodes=' + ov.nodes + ' zoom=' + ov.zoom);

  /* ② 多关系探索（avengers 8 关联——最高密度） */
  await ev('(function(){var el=document.querySelector(\'.movie-node[data-id="avengers"]\');var r=el.getBoundingClientRect();el.dispatchEvent(new MouseEvent("click",{bubbles:true,cancelable:true,clientX:r.x+r.width/2,clientY:r.y+r.height/2}));return 1;})()');
  await sleep(1500);
  const f = JSON.parse(await ev(FOCUS_CHK));
  rec('P2 线上探索中心突出', f.id === 'avengers' && f.d >= 100, 'id=' + f.id + ' d=' + f.d + 'px zoom=' + f.zoom);
  rec('P3 线上标签齐全无残留', f.nRel === 8 && f.nLbl === 8, 'rel=' + f.nRel + ' labels=' + f.nLbl);
  rec('P4 线上标签不压文字', f.textOverlap.length === 0, JSON.stringify(f.textOverlap));
  rec('P5 线上标签互不重叠', f.lblOverlap === 0, 'overlap=' + f.lblOverlap);
  const s1 = await cdp.send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('D:/SEO/发挥余热/漫威电影宇宙导航/workspace/map-shots/prod-avengers.png', Buffer.from(s1.data, 'base64'));

  /* ③ 单节点 + 切换 */
  await ev('(function(){var el=document.querySelector(\'.movie-node.related[data-id="iron-man"]\');if(!el)return 0;var r=el.getBoundingClientRect();el.dispatchEvent(new MouseEvent("click",{bubbles:true,cancelable:true,clientX:r.x+r.width/2,clientY:r.y+r.height/2}));return 1;})()');
  await sleep(1500);
  const f2 = JSON.parse(await ev(FOCUS_CHK));
  rec('P6 切换中心正确', f2.id === 'iron-man' && f2.nLbl === f2.nRel, 'id=' + f2.id + ' rel=' + f2.nRel + ' labels=' + f2.nLbl);
  rec('P7 切换后无碰撞', f2.textOverlap.length === 0 && f2.lblOverlap === 0, '压文字=' + f2.textOverlap.length + ' 重叠=' + f2.lblOverlap);

  /* ④ 空白退出 */
  await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 1300, y: 200, button: 'left', clickCount: 1 });
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 1300, y: 200, button: 'left', clickCount: 1 });
  await sleep(1800);
  const back = await ev('document.querySelectorAll(".movie-node.center").length + "|" + document.getElementById("zoom-display").textContent');
  rec('P8 空白退出回全景', back.split('|')[0] === '0' && parseFloat(back.split('|')[1]) < 60, 'center=' + back);

  rec('P9 线上无JS异常', jsErr === 0, jsErr);
  await cdp.close().catch ? null : null; try { cdp.close(); } catch (e) {}
  chrome.kill();
  console.log('==== ' + PASS + ' PASS, ' + FAIL + ' FAIL ====');
  process.exit(FAIL ? 1 : 0);
}
main().catch(e => { console.log('FATAL', e.message); process.exit(2); });
