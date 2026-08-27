# MCU V1.2 图片资源清单

> 版本：V1.2-DS · 2026-08-25
> 设计：QoderWork CN（设计AI）
> 依据：《MCU V1.2 Design System》+ GPT《V1.2 联合升级任务书》
> 状态：待策划AI（GPT）审核
> 配套文件：《MCU-V1.2页面视觉升级方案》《MCU-V1.2开发视觉标注》

---

## 一、资源总览

| 类别 | 数量 | 单张尺寸(px) | 格式 | 单张大小(目标) | 总计 |
|------|------|-------------|------|----------------|------|
| 电影/内容海报 | 59 张 | 400×600 | JPG | ~50KB | ~3MB |
| 角色头像 | 24 张 | 300×300 | JPG | ~30KB | ~720KB |
| 阶段代表图 | 6 张 | 750×400 | JPG | ~80KB | ~480KB |
| 首页背景 | 1 张 | 750×500 | JPG | ~100KB | ~100KB |
| 电影场景图 | 59 张 | 750×500 | JPG | ~80KB | ~4.7MB |
| 角色场景图 | 24 张 | 750×500 | JPG | ~80KB | ~1.9MB |
| **合计** | **173 张** | | | | **~10.9MB** |

**托管方案**：网络图片 + 本地缓存（微信主包限制 2MB，不可全部打包）。图片托管在图床/云存储（腾讯云 COS / 七牛云），小程序通过 URL 加载，利用微信缓存机制。

---

## 二、电影/内容海报（59 张）

### 2.1 规格

- 尺寸：400×600 px（2:3 海报比例）
- 格式：JPG，质量 80%
- 命名：`{id}.jpg`（与 data/content.js 中的 id 一致）
- 存放路径：`/assets/posters/{id}.jpg`
- 使用页面：首页推荐大卡、电影详情页 Hero、前后关联、全景图阶段内横滚、最近观看、角色详情关联作品

### 2.2 完整清单

#### Phase 1（6 张）

| ID | 中文名 | 搜索关键词 |
|----|--------|-----------|
| iron-man | 钢铁侠 | 钢铁侠 电影海报 官方 2008 |
| iron-man-2 | 钢铁侠2 | 钢铁侠2 电影海报 2010 |
| incredible-hulk | 无敌浩克 | 无敌浩克 电影海报 2008 |
| thor | 雷神 | 雷神1 电影海报 2011 |
| captain-america | 美国队长 | 美国队长1 复仇者先锋 海报 |
| avengers | 复仇者联盟 | 复仇者联盟1 电影海报 2012 |

#### Phase 2（6 张）

| ID | 中文名 | 搜索关键词 |
|----|--------|-----------|
| iron-man-3 | 钢铁侠3 | 钢铁侠3 电影海报 2013 |
| thor-dark-world | 雷神2 | 雷神2黑暗世界 海报 |
| captain-winter | 美队2 | 美国队长2冬兵 海报 |
| guardians | 银河护卫队 | 银河护卫队1 海报 2014 |
| avengers-age-ultron | 复联2 | 复仇者联盟2奥创纪元 海报 |
| ant-man | 蚁人 | 蚁人1 电影海报 2015 |

#### Phase 3（13 张）

| ID | 中文名 | 搜索关键词 |
|----|--------|-----------|
| captain-civil | 美队3 | 美国队长3内战 海报 |
| doctor-strange | 奇异博士 | 奇异博士1 电影海报 2016 |
| guardians-vol2 | 银护2 | 银河护卫队2 海报 2017 |
| spider-homecoming | 蜘蛛侠1 | 蜘蛛侠英雄归来 海报 |
| thor-ragnarok | 雷神3 | 雷神3诸神黄昏 海报 |
| black-panther | 黑豹 | 黑豹1 电影海报 2018 |
| avengers-iw | 复联3 | 复仇者联盟3无限战争 海报 |
| ant-man-wasp | 蚁人2 | 蚁人2黄蜂女现身 海报 |
| captain-marvel | 惊奇队长 | 惊奇队长1 电影海报 2019 |
| avengers-endgame | 复联4 | 复仇者联盟4终局之战 海报 |
| spider-far-from-home | 蜘蛛侠2 | 蜘蛛侠远征故乡 海报 |

#### Phase 4（16 张）

| ID | 中文名 | 搜索关键词 |
|----|--------|-----------|
| black-widow | 黑寡妇 | 黑寡妇 电影海报 2021 |
| falcon-winter | 猎鹰与冬兵 | 猎鹰与冬兵 剧集海报 |
| wandavision | 旺达幻视 | 旺达幻视 剧集海报 |
| loki | 洛基 | 洛基 剧集海报 2021 |
| shang-chi | 尚气 | 尚气与十环传奇 海报 |
| eternals | 永恒族 | 永恒族 电影海报 |
| spider-no-way-home | 蜘蛛侠3 | 蜘蛛侠英雄无归 海报 |
| hawkeye | 鹰眼 | 鹰眼 剧集海报 |
| doctor-strange-mom | 奇异博士2 | 奇异博士疯狂多元宇宙 海报 |
| thor-love-thunder | 雷神4 | 雷神4爱与雷霆 海报 |
| she-hulk | 女浩克 | 女浩克 剧集海报 |
| black-panther-2 | 黑豹2 | 黑豹2瓦干达万岁 海报 |
| ant-man-quantumania | 蚁人3 | 蚁人3量子狂热 海报 |
| guardians-vol3 | 银护3 | 银河护卫队3 海报 |
| the-marvels | 惊奇队长2 | 惊奇队长2 Marvels 海报 |
| loki-s2 | 洛基S2 | 洛基第二季 海报 |

#### Phase 5+（未来，8 张 + 剧集/短片）

| ID | 中文名 | 搜索关键词 |
|----|--------|-----------|
| deadpool-wolverine | 死侍与金刚狼 | 死侍与金刚狼 海报 2024 |
| daredevil-reborn | 超胆侠 | 超胆侠重生 剧集海报 |
| ironheart | 钢铁之心 | 钢铁之心 剧集海报 |
| captain-america-bn | 美队4 | 美国队长4美丽新世界 海报 |
| thunderbolts | 雷霆特工队 | 雷霆特工队 电影海报 |
| fantastic-four | 神奇四侠 | 神奇四侠2025 海报 |
| armor-wars | 装甲战争 | 装甲战争 海报 |
| avengers-doomsday | 复联5 | 复仇者联盟5末日 海报 |
| avengers-secret-wars | 复联6 | 复仇者联盟秘密战争 海报 |

> 其余剧集/特别呈现/短片的 ID 与 data/content.js 一致，搜索"{中文名} 海报"即可。共 59 张。

---

## 三、角色头像（24 张）

### 3.1 规格

- 尺寸：300×300 px（正方形，面部居中）
- 格式：JPG，质量 85%
- 命名：`{charId}.jpg`（与 data/characters.js 中的 id 一致）
- 存放路径：`/assets/characters/{charId}.jpg`
- 要求：正面或四分之三侧面，面部清晰，背景简洁
- 使用页面：首页热门角色、角色图鉴、角色详情、电影详情主要角色、关系探索

### 3.2 完整清单

#### 复仇者（13 位）

| ID | 中文名 | 搜索关键词 |
|----|--------|-----------|
| tony | 钢铁侠/托尼·斯塔克 | 钢铁侠 Tony Stark 角色照 官方 |
| steve | 美国队长/史蒂夫 | 美国队长 Steve Rogers 角色照 |
| bruce | 浩克/布鲁斯·班纳 | 浩克 Hulk Bruce Banner 角色照 |
| clint | 鹰眼/克林特 | 鹰眼 Hawkeye Clint 角色照 |
| natasha | 黑寡妇/娜塔莎 | 黑寡妇 Natasha Romanoff 角色照 |
| peter | 蜘蛛侠/彼得 | 蜘蛛侠 Peter Parker 角色照 |
| wanda | 旺达/绯红女巫 | 绯红女巫 Wanda Maximoff 角色照 |
| vision | 幻视 | 幻视 Vision 角色照 |
| sam | 猎鹰/美国队长2 | 猎鹰 Falcon Sam Wilson 角色照 |
| bucky | 冬兵/巴基 | 冬兵 Bucky Barnes 角色照 |
| stephen | 奇异博士 | 奇异博士 Stephen Strange 角色照 |
| carol | 惊奇队长 | 惊奇队长 Carol Danvers 角色照 |

#### 银河护卫队（6 位）

| ID | 中文名 | 搜索关键词 |
|----|--------|-----------|
| star-lord | 星爵 | 星爵 Star-Lord 角色照 |
| gamora | 卡魔拉 | 卡魔拉 Gamora 角色照 |
| drax | 德拉克斯 | 德拉克斯 Drax 角色照 |
| rocket | 火箭浣熊 | 火箭浣熊 Rocket 角色照 |
| groot | 格鲁特 | 格鲁特 Groot 角色照 |
| mantis | 螳螂女 | 螳螂女 Mantis 角色照 |

#### 瓦坎达（2 位）

| ID | 中文名 | 搜索关键词 |
|----|--------|-----------|
| t-challa | 黑豹/特查拉 | 黑豹 T'Challa 角色照 |
| shuri | 苏睿 | 苏睿 Shuri 角色照 |

#### 其他阵营（3 位）

| ID | 阵营 | 中文名 | 搜索关键词 |
|----|------|--------|-----------|
| matt | 街头英雄 | 超胆侠 | 超胆侠 Daredevil Matt Murdock 角色照 |
| wolverine | 变种人 | 金刚狼 | 金刚狼 Wolverine 角色照 2024 |
| thanos | 反派 | 灭霸 | 灭霸 Thanos 角色照 |

---

## 四、阶段代表图（6 张）

### 4.1 规格

- 尺寸：750×400 px（小程序全宽，宽幅）
- 格式：JPG，质量 80%
- 命名：`phase-{n}.jpg`（n = 1~6）
- 存放路径：`/assets/phases/phase-{n}.jpg`
- 要求：能代表该阶段视觉氛围的群像或标志性场景
- 使用页面：首页宇宙入口3卡片背景、全景图阶段背景

### 4.2 完整清单

| Phase | 文件名 | 建议视觉 | 搜索关键词 |
|-------|--------|---------|-----------|
| P1 | phase-1.jpg | 初代复仇者群像 | 复仇者联盟1 剧照 群像 初代六人 |
| P2 | phase-2.jpg | 复仇者基地/新团队 | 复仇者联盟 基地 团队 剧照 |
| P3 | phase-3.jpg | 无限战争/灭霸响指 | 复联3 无限战争 剧照 史诗 |
| P4 | phase-4.jpg | 多元宇宙开启 | 洛基 多元宇宙 TVA 剧照 |
| P5 | phase-5.jpg | 新世代英雄 | 死侍金刚狼 剧照 新英雄 |
| P6 | phase-6.jpg | 秘密战争 | 复联 秘密战争 概念图 预告 |

---

## 五、首页背景图（1 张）

### 5.1 规格

- 尺寸：750×500 px
- 格式：JPG，质量 80%
- 命名：`home-bg.jpg`
- 存放路径：`/assets/bg/home-bg.jpg`
- 要求：暗色宇宙/星空主题，底部渐变为 --bg (#080B12)，不抢 foreground 注意力
- 使用页面：首页旅程进度卡背景、我的MCU旅程页背景

### 5.2 搜索关键词

`漫威宇宙 星空 暗色 背景` 或 `MCU cosmic dark background wallpaper`

---

## 六、电影场景图（59 张）← V1.2 新增

### 6.1 规格

- 尺寸：750×500 px（小程序全宽）
- 格式：JPG，质量 80%
- 命名：`{id}-scene.jpg`（与 content.js 中的 id 对应）
- 存放路径：`/assets/scenes/{id}-scene.jpg`
- 要求：该电影中最具代表性的场景截图或官方剧照，暗色调优先
- 使用页面：电影详情页 Hero 背景图

### 6.2 搜索关键词规则

每部电影搜索：`"{中文名} 剧照 场景"` 或 `"{英文名} movie still scene"`

示例：
- iron-man → "钢铁侠1 剧照 场景 托尼"
- avengers-endgame → "复联4 终局之战 剧照 最终战"
- loki → "洛基 剧集 剧照 TVA"

> 59 张与海报一一对应，搜索同期进行。

---

## 七、角色场景图（24 张）← V1.2 新增

### 7.1 规格

- 尺寸：750×500 px（小程序全宽）
- 格式：JPG，质量 80%
- 命名：`{charId}-scene.jpg`（与 characters.js 中的 id 对应）
- 存放路径：`/assets/scenes/{charId}-scene.jpg`
- 要求：该角色在 MCU 中最具辨识度的场景截图或官方宣传照
- 使用页面：角色详情页 Hero 背景图

### 7.2 搜索关键词规则

每位角色搜索：`"{角色中文名} {角色英文名} 剧照 场景"`

示例：
- tony → "钢铁侠 Tony Stark 剧照 经典场景"
- thor → "雷神 Thor 剧照 阿斯加德"
- thanos → "灭霸 Thanos 剧照 无限战争"

> 24 张与头像一一对应，搜索同期进行。

---

## 八、图片目录结构

```
mcu-miniprogram/
  assets/
    posters/          ← 59 张电影海报
      iron-man.jpg
      iron-man-2.jpg
      ...（59 个）
    characters/       ← 24 张角色头像
      tony.jpg
      steve.jpg
      ...（24 个）
    phases/           ← 6 张阶段代表图
      phase-1.jpg
      phase-2.jpg
      ...（6 个）
    scenes/           ← 83 张场景图（59 电影 + 24 角色）
      iron-man-scene.jpg
      tony-scene.jpg
      ...（83 个）
    bg/               ← 背景图
      home-bg.jpg
    icons/            ← 功能图标（SVG 或 PNG）
      tab/            ← TabBar 图标（已有）
```

---

## 九、图片加载策略

### 9.1 为什么不能全部打包

微信主包限制 2MB，173 张图片总计 ~10.9MB，远超限制。即使分包也不合理。

### 9.2 推荐方案：网络图片 + 本地缓存

- 图片托管在图床/云存储（腾讯云 COS / 七牛云 / 任何可生成 URL 的服务）
- 小程序通过 URL 加载图片
- 利用微信的 `wx.getImageInfo` 缓存机制，加载过的图片自动缓存
- 图片加载期间显示阶段色渐变占位（已有 poster-pN 样式）

### 9.3 降级方案（图片未就位时）

| 图片类型 | 降级表现 |
|---------|---------|
| 海报 | 阶段色渐变 + 首字（当前实现，保留作为 fallback） |
| 角色头像 | 阵营色渐变 + 首字（当前实现，保留作为 fallback） |
| 背景图 | 纯色 --bg（当前实现） |
| 阶段代表图 | 阶段色纯色 |

### 9.4 抓取优先级

| 优先级 | 图片类别 | 数量 | 理由 |
|--------|---------|------|------|
| P0 | 电影海报 | 59 张 | 覆盖所有页面核心视觉 |
| P0 | 角色头像 | 24 张 | 覆盖首页/图鉴/详情/关系 |
| P1 | 首页背景 | 1 张 | 氛围提升最大 |
| P1 | 阶段代表图 | 6 张 | 全景图+首页入口 |
| P2 | 电影场景图 | 59 张 | 电影详情背景 |
| P2 | 角色场景图 | 24 张 | 角色详情背景 |

---

## 十、visuals.js 数据对接

开发需填充 visuals.js 中的映射关系：

```javascript
// 海报映射（59 项）
const posters = {
  'iron-man': 'https://cdn.example.com/posters/iron-man.jpg',
  'iron-man-2': 'https://cdn.example.com/posters/iron-man-2.jpg',
  // ... 59 项
};

// 角色头像映射（24 项）
const characters = {
  'tony': 'https://cdn.example.com/characters/tony.jpg',
  'steve': 'https://cdn.example.com/characters/steve.jpg',
  // ... 24 项
};

// 阶段代表图映射（6 项）
const phases = {
  1: 'https://cdn.example.com/phases/phase-1.jpg',
  // ... 6 项
};

// 场景图映射（83 项）
const movieScenes = {
  'iron-man': 'https://cdn.example.com/scenes/iron-man-scene.jpg',
  // ... 59 项
};

const charScenes = {
  'tony': 'https://cdn.example.com/scenes/tony-scene.jpg',
  // ... 24 项
};

// 背景图
const backgrounds = {
  'home': 'https://cdn.example.com/bg/home-bg.jpg'
};
```
