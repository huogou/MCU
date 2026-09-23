/* verify-v24.cjs · 抖音 V2.4 引流清除全量自检
 * 1) 全目录零引流残留（渲染层+代码层） 2) 无悬空引用 3) V2.3 功能保持 4) 版本号 */
const fs = require('fs');
const path = require('path');
const base = 'D:/SEO/发挥余热/漫威电影宇宙导航/douyin';
let pass = 0, fail = 0;
function t(name, ok) { ok ? pass++ : fail++; console.log((ok ? 'PASS' : 'FAIL') + ' | ' + name); }

/* ---- 1. 全目录引流残留扫描（含所有 js/wxml/wxss/json） ---- */
const BAD = [/h5-guide/i, /h5Link/i, /mcuatlas/i, /goH5/i, /H5\s*完整/, /打开\s*H5/, /前往\s*H5/, /复制链接/, /setClipboardData/i, /copyH5Link/i, /window\.open/i, /ad-share/];
let leaks = [];
function walk(d) {
  let ents;
  try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch (e) { return; }
  for (const e of ents) {
    const f = path.join(d, e.name);
    if (e.isDirectory()) { walk(f); continue; }
    if (!/\.(js|wxml|wxss|json)$/i.test(e.name)) continue;
    const lines = fs.readFileSync(f, 'utf8').split('\n');
    lines.forEach((l, i) => {
      /* 剔除整行注释后再判定（注释里的历史说明不算渲染/执行内容） */
      const stripped = l.replace(/<!--[\s\S]*?-->/g, '').replace(/^\s*\/\/.*$/, '').replace(/\/\*[\s\S]*?\*\//g, '');
      BAD.forEach(p => { if (p.test(stripped)) leaks.push(path.relative(base, f) + ':' + (i + 1) + ' [' + p + '] ' + l.trim().slice(0, 70)); });
    });
  }
}
walk(base);
t('全目录零引流残留（' + BAD.length + ' 个特征 × 全部源码行）', leaks.length === 0);
if (leaks.length) console.log(leaks.map(x => '  ↳ ' + x).join('\n'));

/* ---- 2. 组件与模型已物理删除 ---- */
['components/h5-guide/h5-guide.js', 'components/h5-guide/h5-guide.wxml', 'components/h5-guide/h5-guide.wxss', 'components/h5-guide/h5-guide.json', 'models/h5Link.js'].forEach(f => {
  t('已删除: ' + f, !fs.existsSync(path.join(base, f)));
});

/* ---- 3. 无悬空引用 ---- */
const pages = ['home', 'journey', 'movie', 'my-mcu', 'library', 'about', 'agreement', 'privacy', 'share', 'feedback'];
pages.forEach(p => {
  const json = JSON.parse(fs.readFileSync(path.join(base, 'pages/' + p + '/' + p + '.json'), 'utf8'));
  const uc = Object.keys(json.usingComponents || {});
  t(p + '.json 无 h5-guide 组件注册', uc.indexOf('h5-guide') === -1);
  const js = fs.readFileSync(path.join(base, 'pages/' + p + '/' + p + '.js'), 'utf8');
  t(p + '.js 无 h5Link require', js.indexOf('h5Link') === -1);
});

/* ---- 4. V2.3 功能保持（宇宙节点页 + 关键链路） ---- */
const mw = fs.readFileSync(path.join(base, 'pages/movie/movie.wxml'), 'utf8');
const mj = fs.readFileSync(path.join(base, 'pages/movie/movie.js'), 'utf8');
['宇宙节点', '关联节点', '进入宇宙导航'].forEach(k => t('movie.wxml 保留: ' + k, mw.indexOf(k) > -1));
t('movie.js 保留宇宙序号', mj.indexOf("'宇宙序号'") > -1);
t('movie.js 保留节点互跳', mj.indexOf('goRelated') > -1 && mj.indexOf('redirectTo') > -1);
t('movie.js 保留 goJourney', mj.indexOf('goJourney') > -1 && mj.indexOf('/pages/journey/journey') > -1);
t('movie 无删除项回潮（poster/观看/收藏/上映）', ['poster', 'watched', '收藏', '上映'].every(k => mw.indexOf(k) === -1));
/* 入口 6 处兼容 */
let entries = 0;
pages.forEach(p => {
  const js = fs.readFileSync(path.join(base, 'pages/' + p + '/' + p + '.js'), 'utf8');
  entries += (js.match(/pages\/movie\/movie/g) || []).length;
});
t('movie 入口引用存在（≥4 处）', entries >= 4);
/* journey 保留 */
const jw = fs.readFileSync(path.join(base, 'pages/journey/journey.wxml'), 'utf8');
t('journey 路线列表保留', jw.indexOf('route-list') > -1 && jw.indexOf('goDetail') > -1);
t('journey allDone 按钮已删（保留标题）', jw.indexOf('ad-share') === -1 && jw.indexOf('恭喜') > -1);

/* ---- 5. 版本号 ---- */
const about = fs.readFileSync(path.join(base, 'pages/about/about.wxml'), 'utf8');
t('about 版本=V2.4 且日期 09-23', about.indexOf('V2.4') > -1 && about.indexOf('2026-09-23') > -1);

console.log('==== ' + pass + ' PASS, ' + fail + ' FAIL ====');
process.exit(fail ? 1 : 0);
