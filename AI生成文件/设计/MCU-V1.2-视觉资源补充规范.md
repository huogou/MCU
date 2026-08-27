# MCU V1.2 视觉资源补充规范

> 版本：V1.2-R2 · 2026-08-26
> 设计：QoderWork CN（设计AI）
> 依据：GPT《下一阶段联合任务》+ 现有代码审查
> 配套：《MCU-V1.2-关系探索页视觉方案》《MCU-V1.2-资源命名规范》
> 状态：待策划AI（GPT）确认 → 确认后开发执行

---

## 一、总览

| 页面 | 资源类型 | 数量 | 状态 | 优先级 |
|------|---------|------|------|--------|
| 首页 | MCU宇宙背景图 | 1 | ✅ 已生成 | — |
| 首页 | 阶段代表图 | 6 | ✅ 已生成 | — |
| 首页 | 入口卡片图标（SVG） | 3 | ⏳ 待制作 | P1 |
| 电影详情 | 官方风格海报 | 38/59 | ✅ CDN已接入 | — |
| 电影详情 | 背景氛围图 | 38/59 | ✅ CDN已接入 | — |
| 电影详情 | 分类标签图标 | — | ℹ️ 见说明 | P2 |
| 角色页 | 24角色头像 | 24 | ✅ 已生成 | — |
| 角色页 | 角色背景图 | — | ℹ️ 用阵营氛围渐变 | — |
| 角色页 | 阵营标识 | 8 | ✅ 已在app.wxss | — |
| 关系探索 | 关系节点图标 | — | ℹ️ 用角色头像替代 | — |
| 关系探索 | 关系线颜色规范 | 5 | ✅ 已定义 | — |
| 关系探索 | 筛选按钮样式 | 6 | ✅ 已定义 | — |

---

## 二、首页资源

### 2.1 MCU宇宙背景图

| 项目 | 规格 |
|------|------|
| 文件名 | `home-bg.jpg` |
| 路径 | `mcu-miniprogram/assets/backgrounds/home-bg.jpg` |
| 目标尺寸 | 750×500px（当前 1536×1024，需缩放） |
| 格式 | JPEG，质量 80% |
| 目标大小 | ≤ 100KB |
| 视觉说明 | 深空背景 + 金色星座连线 + 紫色星云，无文字无人物 |
| 接入方式 | `visuals.homeBg()` → 首页 journey-bg-img |
| CSS | `opacity: 0.85`，叠在渐变罩层之上 |

### 2.2 阶段代表图

| 项目 | 规格 |
|------|------|
| 文件名 | `phase-{1-6}.jpg` |
| 路径 | `mcu-miniprogram/assets/phases/phase-{N}.jpg` |
| 目标尺寸 | 750×400px（当前 1536×1024，需裁剪缩放） |
| 格式 | JPEG，质量 80% |
| 单张大小 | ≤ 80KB |
| 接入方式 | `visuals.phase(n)` → 全景图等页面 |

各阶段视觉主题：

| 阶段 | 文件名 | 视觉主题 |
|------|--------|---------|
| Phase 1 | phase-1.jpg | 复仇者集结·六位英雄剪影·金色晨光 |
| Phase 2 | phase-2.jpg | 宇宙扩展·无限宝石·蓝色能量脉冲 |
| Phase 3 | phase-3.jpg | 终局之战·金色手套·紫色宇宙风暴 |
| Phase 4 | phase-4.jpg | 新纪元·多元宇宙传送门·蓝紫裂缝 |
| Phase 5 | phase-5.jpg | 多元混乱·现实碎片·红色维度能量 |
| Phase 6 | phase-6.jpg | 未来篇章·金色地平线·新星群 |

### 2.3 入口卡片图标（SVG）

首页"宇宙入口"3列使用 Unicode 占位（◷✦⬡），需替换为 SVG 图标。

| 入口 | 当前占位 | SVG 图标 | 颜色 | 尺寸 |
|------|---------|---------|------|------|
| 宇宙时间线 | ◷ | 时钟/时间线 icon | --gold | 48rpx 容器 |
| 角色图鉴 | ✦ | 星形/人物群 icon | --gold | 48rpx 容器 |
| 关系探索 | ⬡ | 网络/连接 icon | --gold | 48rpx 容器 |

**图标规格：**
- 线性风格，1.5rpx 描边
- 颜色：var(--gold)
- 容器：48×48rpx，圆角 12rpx
- 格式：内联 SVG（直接写在 wxml 中，不引入外部文件）

**开发替换方式：**
```xml
<!-- 替换前 -->
<view class="exp-ic">{{item.glyph}}</view>

<!-- 替换后（以时间线为例） -->
<view class="exp-ic">
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
    <circle cx="12" cy="12" r="10"/>
    <polyline points="12 6 12 12 16 14"/>
  </svg>
</view>
```

> 注：SVG 图标为 P1 优先级，Unicode 占位不影响功能，可延后处理。

---

## 三、电影详情页资源

### 3.1 官方风格海报

| 项目 | 规格 |
|------|------|
| 数量 | 38/59（院线电影已接入，剧集/未上映待补充） |
| 路径 | CDN `/assets/posters/{movie-id}.jpg` |
| 尺寸 | 400×600px（2:3） |
| 接入 | `visuals.visual(id).poster` |
| CSS | 220×320rpx，border-radius var(--radius-md)=20rpx，border 4rpx var(--gold-a20) |

### 3.2 背景氛围图（剧照）

| 项目 | 规格 |
|------|------|
| 数量 | 38/59（与海报同步） |
| 路径 | CDN `/assets/stills/{movie-id}.jpg` |
| 尺寸 | 750×500px（16:9 裁切） |
| 接入 | `visuals.visual(id).backdrop` → movie.js heroBg |
| CSS | `background-size: cover; background-position: center;` 叠渐变罩层 |

### 3.3 分类标签图标

当前电影详情页的 chips（类型/分级标签）为纯文字 + 彩色边框，无图标。

**设计决策：保持纯文字方案。**

理由：
1. 小程序 chip 尺寸有限（22rpx 字号 + 6/16rpx padding），加入图标会导致文字换行或溢出
2. 颜色已区分语义（gold=推荐/blue=信息/red=动作），视觉识别度足够
3. 增加图标会引入额外的 SVG 资源维护成本

如后续需要图标化，建议方案：在 chip 左侧加 16rpx 微型 icon（如播放/盾牌/闪电），但当前阶段不建议。

---

## 四、角色页资源

### 4.1 24 角色头像

| 项目 | 规格 |
|------|------|
| 文件名 | `{角色id}.jpg`（与 characters.js id 一致） |
| 路径 | `mcu-miniprogram/assets/avatars/{id}.jpg` |
| 目标尺寸 | 300×300px（当前 1024×1024，需缩放） |
| 格式 | JPEG，质量 85% |
| 单张大小 | ≤ 50KB |
| 总计 | 24 张 ≈ 1.2MB |
| 接入 | `visuals.avatar(id)` |

**各页面头像使用规格：**

| 页面 | 使用位置 | 显示尺寸 | CSS |
|------|---------|---------|-----|
| 首页 | 热门角色横滚 | 96rpx 圆形 | border 3rpx 阵营色 |
| 电影详情 | 主要角色模块 | 80rpx 圆形 | border 3rpx 阵营色 |
| 角色详情 | Hero 区 | 128rpx 圆形 | border 4rpx 阵营色 |
| 角色详情 | 关联角色网格 | 80rpx 圆形 | border 3rpx 阵营色 |
| 关系探索 | 关系对卡片 | 80rpx 圆形 | border 2rpx 阵营色 |

### 4.2 角色背景图

**设计决策：使用阵营氛围渐变，不单独制作角色背景图。**

每个角色的 Hero 区背景使用阵营色渐变（已在 character.wxss 实现）：

| 阵营 | CSS 类 | 渐变效果 |
|------|--------|---------|
| 复仇者/街头 | .hero-red | linear-gradient(160deg, --accent-red-a10, --surface-1 65%) |
| 阿斯加德/神盾 | .hero-blue | linear-gradient(160deg, --accent-blue-a10, --surface-1 65%) |
| 银护/变种人 | .hero-purple | linear-gradient(160deg, --accent-purple-a10, --surface-1 65%) |
| 瓦坎达 | .hero-gold | linear-gradient(160deg, --gold-a04, --surface-1 65%) |
| 反派 | .hero-gray | var(--surface-1) 纯色 |

理由：24 张独立背景图会增加约 2MB 资源量，且角色详情页 Hero 区高度有限（约 300rpx），渐变氛围已足够传达阵营感。

### 4.3 阵营标识

已在 `app.wxss` 全局定义（Step4 全局统一完成）：

| 类名前缀 | 用途 | 示例 |
|---------|------|------|
| `.fc-*` | 阵营色文字 | `.fc-red` → color: var(--accent-red) |
| `.fring-*` | 阵营色描边 | `.fring-red` → border-color: var(--accent-red) |
| `.fbg-*` | 阵营色背景 | `.fbg-red` → background: var(--accent-red) |
| `.pill-*` | 阵营胶囊标签 | `.pill-red` → 红底白字胶囊 |
| `.poster-pN` | 阶段色海报占位 | `.poster-p1` → Phase1 色渐变 |

---

## 五、关系探索页资源

### 5.1 关系节点图标

**设计决策：使用角色真实头像作为关系节点，不单独制作节点图标。**

关系探索页的核心是"角色之间的关系"，每个节点就是一个角色。使用已生成的 24 张角色头像作为节点图标，既统一视觉语言，又减少资源量。

### 5.2 关系线颜色规范

| 关系类型 | 颜色 Token | 色值 | 用途 |
|---------|-----------|------|------|
| 盟友 | --accent-blue | #4A9EF5 | 同阵营并肩作战 |
| 敌人 | --accent-red | #E85D5D | 对立阵营威胁 |
| 师徒 | --gold | #F2B233 | 传承与引导 |
| 家人 | --accent-purple | #9B7FE8 | 血缘或养育关系 |
| 对手 | --accent-red | #E85D5D | 竞争但非敌对 |

**连线 CSS 规格：**
- 线宽：1rpx
- 颜色：var(--surface-3) 默认，关系类型标签用功能色
- 标签文字：22rpx / 600 / 功能色
- 标签背景：透明（文字直接叠在连线上）

### 5.3 筛选按钮样式

| 状态 | 背景 | 文字 | 边框 | 字重 |
|------|------|------|------|------|
| 默认 | --surface-2 | --text-sub | --surface-3 | 400 |
| 选中 | --gold-a10 | --gold | --gold | 600 |

**规格：**
- 高度：56rpx
- 左右 padding：28rpx
- 圆角：999rpx（全圆角胶囊）
- 字号：24rpx（--fs-caption）
- 间距：chip 之间 8rpx（--space-xs）
- 容器：横向 scroll-view

---

## 六、资源体积预算

| 类别 | 数量 | 单张上限 | 合计 | 当前状态 |
|------|------|---------|------|---------|
| 角色头像 | 24 | 50KB | 1.2MB | ✅ 已生成（1024²，待缩放） |
| 首页背景 | 1 | 100KB | 100KB | ✅ 已生成（1536×1024，待缩放） |
| 阶段代表图 | 6 | 80KB | 480KB | ✅ 已生成（1536×1024，待裁剪） |
| 电影海报 | 38 | — | — | ✅ CDN 在线 |
| 电影剧照 | 38 | — | — | ✅ CDN 在线 |
| **本地资源总计** | **31** | | **≈1.8MB** | 待缩放后上传 CDN |

> 小程序主包限制 2MB。31 张本地资源缩放后约 1.8MB，接近上限。建议上传 CDN 后改用网络路径。

---

## 七、CDN 上传后 visuals.js 切换

当前 visuals.js 使用本地路径：
```javascript
const LOCAL = '/assets';
```

上传 CDN 后只需改一行：
```javascript
const LOCAL = CDN + '/assets';
```

所有 `avatar()` / `phase()` / `homeBg()` 返回值自动变为 CDN URL，页面无需任何改动。

---

## 八、待处理事项

| 事项 | 优先级 | 说明 |
|------|--------|------|
| 图片缩放 | P0 | 31 张原图需缩放至目标尺寸（见各节规格） |
| CDN 上传 | P0 | 缩放后上传至 CloudBase 静态托管 |
| visuals.js 切换 | P0 | 上传后改 LOCAL 常量 |
| SVG 图标替换 | P1 | 首页 3 入口 + 关系探索筛选，可延后 |
| 剩余 21 张海报/剧照 | P2 | 剧集 + 未上映电影，按需补充 |
