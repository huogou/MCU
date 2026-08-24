import { spawn } from 'child_process';
import WebSocket from 'file:///C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules/ws/index.js';
import { setTimeout as sleep } from 'timers/promises';

const PORT = 9881;
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',
  [`--headless=new`, `--remote-debugging-port=${PORT}`, `--no-sandbox`, `--disable-gpu`, `about:blank`],
  { stdio: 'ignore' });
await sleep(3000);

const created = await fetch('http://127.0.0.1:' + PORT + '/json/new?about:blank', { method:'PUT' }).then(r=>r.json());
const wsUrl = created.webSocketDebuggerUrl;
const ws = new WebSocket(wsUrl);
let id=0; const pending={};
function send(method, params={}){ return new Promise(res=>{ const mid=++id; pending[mid]=res; ws.send(JSON.stringify({id:mid,method,params})); }); }
ws.on('message', d=>{ const m=JSON.parse(d); if(m.id&&pending[m.id]){ pending[m.id](m.result); delete pending[m.id]; } });
await new Promise(r=>ws.on('open',r));
await send('Page.enable',{});
await send('Runtime.enable',{});
await send('Page.navigate',{ url:'https://mcu-d6gw0brqoa9521b58-1307093647.tcloudbaseapp.com/index.html?from=douyin'});
await sleep(8000);

const out = await send('Runtime.evaluate',{ expression:`(function(){
  try {
    var q = JSON.parse(localStorage.getItem('_mcu_stats_queue')||'[]');
    return JSON.stringify({ cloudbase: !!window.cloudbase, stats: !!(window.MCU&&window.MCU.stats),
      queueLen: q.length, queueSample: q.slice(0,3) });
  } catch(e){ return JSON.stringify({err:String(e)}); }
})()`, returnByValue:true });
console.log('RAW:', JSON.stringify(out));
ws.close(); chrome.kill();
