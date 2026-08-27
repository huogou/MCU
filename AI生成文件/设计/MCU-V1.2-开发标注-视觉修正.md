# MCU V1.2 开发标注（视觉修正）

> 版本：V1.2-R2 · 2026-08-26
> 设计：QoderWork CN（设计AI）
> 目标：开发可直接执行的 CSS 修正清单 + 资源接入指引
> 依据：四页面视觉审查报告 + 视觉资源补充规范
> 预计工时：P0+P1 约 40 分钟（不含关系探索页重做）

---

## 一、首页（home.wxss + home.js）

### 1.1 间距修正（8 处）

```css
/* L221 .exp-row */
gap: 16rpx;
→ gap: var(--space-sm);          /* 16→20 */

/* L272 .char-card */
padding: 24rpx 16rpx;
→ padding: var(--space-sm) var(--space-xs);   /* 24 16→20 8 */

/* L108 .jm-en */
margin-top: 4rpx;
→ margin-top: var(--space-xs);   /* 4→8 */

/* L114 .jm-phase */
margin-top: 4rpx;
→ margin-top: var(--space-xs);   /* 4→8 */

/* L187 .rec-sub */
margin-top: 4rpx;
→ margin-top: var(--space-xs);   /* 4→8 */

/* L301 .char-name */
margin-top: 16rpx;
→ margin-top: var(--space-sm);   /* 16→20 */

/* L306 .char-faction */
margin-top: 6rpx;
→ margin-top: var(--space-xs);   /* 6→8 */

/* L325 .recent-item */
margin-right: 24rpx;
→ margin-right: var(--space-sm); /* 24→20 */

/* L346 .recent-name */
margin-top: 12rpx;
→ margin-top: var(--space-xs);   /* 12→8 */
```

### 1.2 字重修正（1 处）

```css
/* L179 .rec-name */
font-weight: 700;
→ font-weight: 600;              /* 推荐卡电影名不应用最重字重 */
```

### 1.3 角色头像接入（home.js）

当前 `hotChars` 的 `poster` 字段返回空字符串兜底。需改为调用 `visuals.avatar()`。

**home.js 修改位置：** `movieVM()` 函数中角色头像字段（约 L148 附近）

```javascript
// 当前（伪代码）
poster: charPoster || ''

// 改为
poster: visuals.avatar(c.id) || ''
```

> 注意：`visuals` 模块需在 home.js 顶部 require：
> ```javascript
> const visuals = require('../../data/visuals.js');
> ```

### 1.4 首页背景图接入（home.js）

确认 `homeBg` 字段已调用 `visuals.homeBg()`。如未接入：

```javascript
// data 中新增
homeBg: visuals.homeBg()
```

---

## 二、电影详情页（movie.wxss）

### 2.1 间距修正（7 处）

```css
/* L17 .movie-nav-bar */
padding: var(--space-sm) var(--page-x) 12rpx;
→ padding: var(--space-sm) var(--page-x) var(--space-xs);  /* 12→8 */

/* L84 .hero-phase */
margin-bottom: 12rpx;
→ margin-bottom: var(--space-xs);   /* 12→8 */

/* L207 .resource-title */
margin-bottom: 6rpx;
→ margin-bottom: var(--space-xs);   /* 6→8 */

/* L273 .why-label */
margin-bottom: 12rpx;
→ margin-bottom: var(--space-xs);   /* 12→8 */

/* L278 .why-ctx */
margin-bottom: 10rpx;
→ margin-bottom: var(--space-xs);   /* 10→8 */

/* L369 .seq-card */
gap: 12rpx;
→ gap: var(--space-xs);             /* 12→8 */

/* L480 .next-rec-title */
margin-bottom: 6rpx;
→ margin-bottom: var(--space-xs);   /* 6→8 */
```

### 2.2 圆角 Bug 修正（1 处）

```css
/* L454 .next-rec-poster */
border-radius: var(--space-xs);     /* Bug：用了 spacing token */
→ border-radius: var(--radius-sm);  /* 应使用 radius token = 12rpx */
```

### 2.3 字重修正（2 处）

```css
/* L389 .seq-poster text */
font-weight: 700;
→ font-weight: 600;

/* L463 .next-rec-poster text */
font-weight: 700;
→ font-weight: 600;
```

---

## 三、角色详情页（character.wxss）

### 3.1 间距修正（3 处）

```css
/* L61 .related-cn */
margin-top: 14rpx;
→ margin-top: var(--space-sm);      /* 14→20 */

/* L62 .related-shared */
margin-top: 6rpx;
→ margin-top: var(--space-xs);      /* 6→8 */

/* L46 .phase-tag */
padding: 6rpx 14rpx;
→ padding: var(--space-xs) 14rpx;   /* 6→8 */
```

### 3.2 圆角修正（1 处）

```css
/* L46 .phase-tag */
border-radius: 10rpx;
→ border-radius: var(--radius-sm);  /* 10→12 */
```

---

## 四、关系探索页（explore）

### 4.1 执行方案

**完整重做** explore.wxml / explore.wxss / explore.js。

按《MCU-V1.2-关系探索页视觉方案》执行，该文档含：
- 完整 wxml 结构模板（§6.1）
- CSS 规格（§6.3）
- JS 关系对派生逻辑（§6.2）
- 预定义特殊关系表（§4.2）
- 验收标准（§8）

### 4.2 关键改动点

| 改动 | 说明 |
|------|------|
| wxml | 入口区改 2 列横排 + 新增筛选 Chips + 新增关系对卡片列表 |
| wxss | 大部分重写（新增 .filter-row / .chip / .pair-card / .pair-char / .pair-relation 等） |
| js | 新增关系对派生逻辑（SPECIAL_RELATIONS + 同阵营盟友 + 共同出演计算）+ 筛选切换 |
| 数据 | 零改动（CHARACTERS / CAMPS 不变） |

### 4.3 visuals.js 接入

关系探索页角色头像使用 `visuals.avatar(id)`：

```javascript
// explore.js 顶部
const visuals = require('../../data/visuals.js');

// 构建关系对时
fromAvatar: visuals.avatar(fromId),
toAvatar: visuals.avatar(toId),
```

---

## 五、资源文件清单

### 5.1 已生成资源（待缩放+上传 CDN）

| 文件 | 路径 | 当前尺寸 | 目标尺寸 | 目标大小 |
|------|------|---------|---------|---------|
| 24 角色头像 | assets/avatars/{id}.jpg | 1024×1024 | 300×300 | ≤50KB/张 |
| 首页背景 | assets/backgrounds/home-bg.jpg | 1536×1024 | 750×500 | ≤100KB |
| 阶段图×6 | assets/phases/phase-{1-6}.jpg | 1536×1024 | 750×400 | ≤80KB/张 |

### 5.2 命名规范

- 角色头像：`{角色id}.jpg`（与 characters.js id 完全一致）
- 首页背景：`home-bg.jpg`
- 阶段图：`phase-{N}.jpg`（N=1~6）

### 5.3 CDN 上传后 visuals.js 切换

```javascript
// 当前（本地路径）
const LOCAL = '/assets';

// 上传 CDN 后改为
const LOCAL = CDN + '/assets';
```

改后所有 `avatar()` / `phase()` / `homeBg()` 自动返回 CDN URL。

---

## 六、执行顺序建议

```
第一阶段（纯 CSS 修正，约 30 分钟）：
  ① home.wxss 8 处间距 + 1 处字重
  ② movie.wxss 7 处间距 + 1 处圆角 + 2 处字重
  ③ character.wxss 3 处间距 + 1 处圆角

第二阶段（JS 修改，约 10 分钟）：
  ④ home.js 角色头像改 visuals.avatar()
  ⑤ home.js 确认 homeBg 接入

第三阶段（页面重做，约 2-3 小时）：
  ⑥ explore.wxml/wxss/js 按设计稿重做

第四阶段（资源处理，约 30 分钟）：
  ⑦ 31 张图片缩放至目标尺寸
   上传 CDN
  ⑨ visuals.js 切换 LOCAL 常量

第五阶段（验收）：
  ⑩ 提交 4 页面截图 → 设计验收 → 策划验收
```

---

## 七、修改后验证清单

| 验证项 | 方法 | 预期 |
|--------|------|------|
| 零裸 hex | 搜索页面 wxss 中 # | 组件规则区零匹配 |
| 零 500 字重 | 搜索 font-weight: 5 | 零匹配 |
| 零 800 字重 | 搜索 font-weight: 8 | 零匹配 |
| 间距全 Token | 搜索 rpx（间距场景） | 仅剩 Token 定义和特殊值 |
| 圆角全 Token | 搜索 border-radius | 仅 var(--radius-*) |
| 角色头像加载 | DevTools 查看网络请求 | avatar 路径有请求 |
| 首页背景加载 | DevTools 查看网络请求 | home-bg 路径有请求 |
| 关系探索筛选 | 点击各 Chip | 列表实时过滤 |
| 关系对头像 | DevTools 查看 | 真实图片加载 |
