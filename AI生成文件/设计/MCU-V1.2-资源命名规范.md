# MCU V1.2 图片资源命名规范

> 版本：V1.2 · 2026-08-26
> 设计：QoderWork CN（设计AI）
> 配套：visuals.js 已接入全部映射

---

## 一、目录结构

```
mcu-miniprogram/assets/
├── avatars/          ← 角色头像（24张）
│   ├── tony.jpg
│   ├── steve.jpg
│   ├── thor.jpg
│   ├── natasha.jpg
│   ├── banner.jpg
│   ├── clint.jpg
│   ├── loki.jpg
│   ├── fury.jpg
│   ├── bucky.jpg
│   ├── sam.jpg
│   ├── peter.jpg
│   ├── strange.jpg
│   ├── tchalla.jpg
│   ├── wanda.jpg
│   ├── vision.jpg
│   ├── scott.jpg
│   ├── carol.jpg
│   ├── starlord.jpg
│   ├── gamora.jpg
│   ├── thanos.jpg
│   ├── shangchi.jpg
│   ├── yelena.jpg
│   ├── wade.jpg
│   └── logan.jpg
├── backgrounds/      ← 首页背景（1张）
│   └── home-bg.jpg
└── phases/           ← 阶段代表图（6张）
    ├── phase-1.jpg
    ├── phase-2.jpg
    ├── phase-3.jpg
    ├── phase-4.jpg
    ├── phase-5.jpg
    └── phase-6.jpg
```

---

## 二、命名规则

### 2.1 角色头像

| 规则 | 说明 |
|------|------|
| 文件名 | `{角色id}.jpg`，与 characters.js 中的 id 完全一致 |
| 尺寸 | 300×300px（原图为 1024×1024，需缩放） |
| 格式 | JPEG，质量 85% |
| 单张大小 | ≤ 50KB |
| 命名示例 | tony.jpg / steve.jpg / captain-america.jpg（如有） |

### 2.2 首页背景

| 规则 | 说明 |
|------|------|
| 文件名 | `home-bg.jpg` |
| 尺寸 | 750×500px（原图 1536×1024，需缩放） |
| 格式 | JPEG，质量 80% |
| 大小 | ≤ 100KB |

### 2.3 阶段代表图

| 规则 | 说明 |
|------|------|
| 文件名 | `phase-{N}.jpg`，N = 1~6 |
| 尺寸 | 750×400px（原图 1536×1024，需裁剪缩放） |
| 格式 | JPEG，质量 80% |
| 单张大小 | ≤ 80KB |

### 2.4 阶段编号对照

| 阶段 | 名称 | 代表内容 |
|------|------|---------|
| phase-1 | 复仇者集结 | 钢铁侠/美队/雷神/浩克/黑寡妇/鹰眼组队 |
| phase-2 | 宇宙扩展 | 无限宝石初现、新威胁浮现 |
| phase-3 | 无限传奇终章 | 无限手套、终局之战 |
| phase-4 | 新纪元 | 多元宇宙开启、新一代英雄 |
| phase-5 | 多元宇宙混乱 | 平行现实碰撞、秘密揭露 |
| phase-6 | 未来篇章 | 漫威新未来、更多英雄登场 |

---

## 三、CDN 上传指引

当前资源为本地文件（相对路径 `/assets/...`）。上传 CDN 后需更新 visuals.js：

### 3.1 上传步骤

1. 将所有图片压缩至目标尺寸（见上表）
2. 上传至 CloudBase 静态托管：
   - `assets/avatars/*.jpg` → `/assets/avatars/`
   - `assets/backgrounds/home-bg.jpg` → `/assets/backgrounds/`
   - `assets/phases/phase-*.jpg` → `/assets/phases/`
3. 验证 HTTP 200（curl 测试）
4. 更新 visuals.js 中的 LOCAL 常量：
   ```javascript
   // 本地路径（当前）
   const LOCAL = '/assets';
   // 上传 CDN 后改为：
   const LOCAL = CDN + '/assets';
   ```

### 3.2 体积预算

| 类别 | 数量 | 单张上限 | 合计上限 |
|------|------|---------|---------|
| 角色头像 | 24 | 50KB | 1.2MB |
| 首页背景 | 1 | 100KB | 100KB |
| 阶段代表图 | 6 | 80KB | 480KB |
| **总计** | **31** | | **≈1.8MB** |

注意：小程序主包限制 2MB。如果本地打包超限，必须优先上传 CDN。

---

## 四、visuals.js 接入方式

### 4.1 访问函数

```javascript
const visuals = require('../../data/visuals.js');

// 角色头像
const avatarUrl = visuals.avatar('tony');   // → '/assets/avatars/tony.jpg'
const avatarNull = visuals.avatar('unknown'); // → null

// 阶段代表图
const phaseUrl = visuals.phase(1);  // → '/assets/phases/phase-1.jpg'

// 首页背景
const bgUrl = visuals.homeBg();     // → '/assets/backgrounds/home-bg.jpg'

// 电影海报/剧照（原有，不变）
const v = visuals.visual('iron-man');
// v.poster   → CDN + '/assets/posters/iron-man.jpg'
// v.backdrop → CDN + '/assets/stills/iron-man.jpg'
```

### 4.2 在页面中使用

```xml
<!-- 角色头像（wxml） -->
<image class="avatar" src="{{avatarUrl}}" mode="aspectFill" wx:if="{{avatarUrl}}" />
<view class="avatar-fallback" wx:else style="background:{{campColor}}">{{firstChar}}</view>

<!-- 首页背景 -->
<image class="home-bg" src="{{homeBgUrl}}" mode="aspectFill" />

<!-- 阶段代表图 -->
<image class="phase-img" src="{{phaseUrl}}" mode="aspectFill" />
```

---

## 五、资源状态总览

| 资源类别 | 数量 | 状态 | 位置 |
|---------|------|------|------|
| 电影海报 | 38/59 | ✅ 已上线 CDN | CloudBase 静态托管 |
| 电影剧照 | 38/59 | ✅ 已上线 CDN | CloudBase 静态托管 |
| 角色头像 | 24/24 | ✅ 已生成（本地） | assets/avatars/ |
| 首页背景 | 1/1 | ✅ 已生成（本地） | assets/backgrounds/ |
| 阶段代表图 | 6/6 | ✅ 已生成（本地） | assets/phases/ |
| 电影海报（缺） | 21 | ⏳ 待补充 | — |
| 电影剧照（缺） | 21 | ⏳ 待补充 | — |
