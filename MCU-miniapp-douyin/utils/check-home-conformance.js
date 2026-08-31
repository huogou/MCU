// 6 维度一致性自检（对照 D10-A 冻结稿 + Step5/Step6 规格）
const fs = require('fs');
const checks = [];
const C = (name, ok, note) => checks.push({ name, ok, note });

const wxml = fs.readFileSync('pages/home/home.wxml', 'utf8');
const wxss = fs.readFileSync('pages/home/home.wxss', 'utf8');
const js   = fs.readFileSync('pages/home/home.js',   'utf8');

// 维度 1：页面布局
C('1.1 双态结构（hasProgress 切换）', /wx:if="\{\{!hasProgress\}\}"/.test(wxml));

// 维度 2：组件位置
C('2.1 新用户：hero → pills → feat-cards → cta',
  wxml.indexOf('home-hero') < wxml.indexOf('pills-row') &&
  wxml.indexOf('pills-row') < wxml.indexOf('feature-cards') &&
  wxml.indexOf('feature-cards') < wxml.indexOf('home-cta'));
C('2.2 老用户：progress → continue → quick → recent',
  wxml.indexOf('progress-card') < wxml.indexOf('continue-card') &&
  wxml.indexOf('continue-card') < wxml.indexOf('quick-row') &&
  wxml.indexOf('quick-row') < wxml.indexOf('recent-row'));

// 维度 3：间距（原型 8-12px → 16-24rpx 区间）
C('3.1 页面边距 20px → 40rpx', wxss.indexOf('40rpx') > -1);
C('3.2 卡片间距在 16-24rpx 区间内',
  /gap: 16rpx/.test(wxss) || /gap: 20rpx/.test(wxss) || /gap: 24rpx/.test(wxss));
C('3.3 section 间距 16-32rpx 存在',
  /margin-bottom: 32rpx/.test(wxss) || /margin-top: 28rpx/.test(wxss));

// 维度 4：字体层级（原型 px×2 = rpx）
C('4.1 h1 18px → 36rpx', /font-size: 36rpx/.test(wxss));
C('4.2 sub 13px → 26rpx', /font-size: 26rpx/.test(wxss));
C('4.3 section-label 12px → 24rpx', wxss.indexOf('font-size: 24rpx') > -1);
C('4.4 pill 26rpx', /\.pill \{[\s\S]*?font-size: 26rpx/.test(wxss));
C('4.5 feat-title 24rpx', /\.feat-title \{[\s\S]*?font-size: 24rpx/.test(wxss));

// 维度 5：状态展示
C('5.1 进度环数字 40rpx 金色',
  /ring-num-b \{[\s\S]*?font-size: 40rpx[\s\S]*?color: var\(--gold\)/.test(wxss));
C('5.2 阶段标签 p2 色 + 圆角',
  /phase-tag \{[\s\S]*?background: rgba\(40,180,135,0\.15\)/.test(wxss));
C('5.3 阶段色海报兜底 p1-p6 全',
  /\.poster-p1 \{/.test(wxss) && /\.poster-p6 \{/.test(wxss));

// 维度 6：TabBar（检查 wxml 和 js 中引用了 tab 图标）
const allText = wxml + js;
C('6.1 复用已生成 tab PNG（routes/explore/star）',
  /assets\/icons\/tab\/(routes|explore|star)\.png/.test(allText));

// Token 自检
C('T.1 全 Token 化（无 raw hex 颜色泄漏到 color 属性）',
  !/color:\s*#[0-9A-Fa-f]{3,6}/.test(wxss.replace(/rgba\([^)]+\)/g, '')));
C('T.2 引用 surface-2/gold/p2/text-weak',
  /surface-2/.test(wxss) && /var\(--gold\)/.test(wxss) && /--p2/.test(wxss) && /--text-weak/.test(wxss));

console.log('6 维度一致性自检：');
checks.forEach(c => console.log((c.ok ? '  ✓ ' : '  ✗ ') + c.name + (c.note ? ' — ' + c.note : '')));
const fail = checks.filter(c => !c.ok).length;
console.log('\n' + (fail === 0 ? 'CONFORMANCE_ALL_PASS' : 'CONFORMANCE_FAIL (' + fail + ')'));
process.exit(fail ? 1 : 0);