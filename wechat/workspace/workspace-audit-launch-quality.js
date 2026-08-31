/* V1.2 上线前代码质量审计（只读，2026-08-27）
 * 覆盖：未使用 require / console|debugger / wx:for缺wx:key / 标签闭合 / wxss缺分号
 * 运行：node workspace-audit-launch-quality.js（在 mcu-miniprogram/ 根目录）
 * 输出：分项问题清单；不修改任何文件。
 */
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const results = { unusedRequires: [], consoleDebug: [], wxForNoKey: [], tagMismatch: [], wxssNoSemi: [] };

function walk(dir, ext, out) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, ext, out);
    else if (e.name.endsWith(ext)) out.push(p);
  }
}

/* 1) 未使用 require：pages/models/data/app.js（utils 两自检脚本已排除出包，不审） */
const jsFiles = [];
['pages', 'models', 'data'].forEach(d => walk(path.join(ROOT, d), '.js', jsFiles));
jsFiles.push(path.join(ROOT, 'app.js'));
for (const f of jsFiles) {
  const src = fs.readFileSync(f, 'utf8');
  const reqs = src.matchAll(/(?:const|let|var)\s+(\w+)\s*=\s*require\(\s*['"]([^'"]+)['"]\s*\)/g);
  for (const m of reqs) {
    const name = m[1], mod = m[2];
    const rest = src.replace(m[0], '');
    const re = new RegExp('\\b' + name + '\\b');
    if (!re.test(rest)) {
      results.unusedRequires.push({ file: f.replace(ROOT + path.sep, ''), name, mod });
    }
  }
}

/* 2) console.log/error/debug + debugger（业务代码） */
const reConsole = /console\.(log|error|debug)\s*\(|debugger\s*;/g;
for (const f of jsFiles) {
  const src = fs.readFileSync(f, 'utf8');
  for (const m of src.matchAll(reConsole)) {
    const lineNo = src.slice(0, m.index).split('\n').length;
    results.consoleDebug.push({ file: f.replace(ROOT + path.sep, ''), line: lineNo, code: m[0].trim() });
  }
}

/* 3) WXML：wx:for 缺 wx:key / 标签闭合 */
const wxmlFiles = [];
walk(path.join(ROOT, 'pages'), '.wxml', wxmlFiles);
for (const f of wxmlFiles) {
  const src = fs.readFileSync(f, 'utf8');
  const rel = f.replace(ROOT + path.sep, '');
  /* wx:for 无 wx:key（同一标签内） */
  const tagRe = /<([a-z-]+)\s+([^>]*?wx:for="[^"]*"[^>]*)>/g;
  for (const m of src.matchAll(tagRe)) {
    if (!m[2].includes('wx:key')) {
      const lineNo = src.slice(0, m.index).split('\n').length;
      results.wxForNoKey.push({ file: rel, line: lineNo, tag: m[1] });
    }
  }
  /* 标签闭合粗检：<view|scroll-view|text|image|block|button|input> */
  const tags = ['view', 'scroll-view', 'text', 'image', 'block', 'button', 'input', 'textarea'];
  for (const t of tags) {
    const open = (src.match(new RegExp('<' + t + '(\\s|>)', 'g')) || []).length;
    const close = (src.match(new RegExp('</' + t + '>', 'g')) || []).length;
    if (open !== close) {
      results.tagMismatch.push({ file: rel, tag: t, open, close });
    }
  }
}

/* 4) WXSS：单行声明缺尾部分号（含样式块内最后一条声明） */
const wxssFiles = [];
walk(path.join(ROOT, 'pages'), '.wxss', wxssFiles);
wxssFiles.push(path.join(ROOT, 'app.wxss'));
for (const f of wxssFiles) {
  const src = fs.readFileSync(f, 'utf8');
  const rel = f.replace(ROOT + path.sep, '');
  const clean = src.replace(/\/\*[\s\S]*?\*\//g, '');
  /* 样式块内：每条声明后应为 ; 或 } */
  const blocks = clean.matchAll(/\{([^{}]*)\}/g);
  for (const b of blocks) {
    const content = b[1];
    const decls = content.split(';');
    for (let i = 0; i < decls.length; i++) {
      const d = decls[i].trim();
      if (!d) continue;
      const colons = (d.match(/:/g) || []).length;
      /* 合并了后续声明（缺 ;）→ 出现 2+ 个 : */
      if (colons >= 2) {
        const off = b.index + content.indexOf(d);
        const lineNo = src.slice(0, off).split('\n').length;
        results.wxssNoSemi.push({ file: rel, line: lineNo, decl: d.slice(0, 80) });
      }
    }
  }
  /* 单行声明结尾非 ; { } :（最外层也检查） */
  const reLine = /^\s*([\w-]+)\s*:\s*([^;{}]+)$/gm;
  for (const m of clean.matchAll(reLine)) {
    if (/^\s*\/\//.test(m[0])) continue;
    const lineNo = src.slice(0, m.index).split('\n').length;
    results.wxssNoSemi.push({ file: rel, line: lineNo, decl: m[0].trim().slice(0, 80) });
  }
}

/* 输出 */
function dump(title, arr) {
  console.log('\n=== ' + title + '（' + arr.length + '）===');
  arr.forEach(x => console.log('  ' + JSON.stringify(x)));
}
dump('未使用 require', results.unusedRequires);
dump('console.log/error/debug + debugger', results.consoleDebug);
dump('wx:for 缺 wx:key', results.wxForNoKey);
dump('标签闭合不匹配', results.tagMismatch);
dump('wxss 缺分号', results.wxssNoSemi);
console.log('\n审计完成');
