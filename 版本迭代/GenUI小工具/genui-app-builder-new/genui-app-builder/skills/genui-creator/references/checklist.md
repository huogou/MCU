# 检查清单

> 把三份规范转换为提交前可以逐项执行的检查。每节标注规则出处，某项不通过时回到对应 reference 定位。
>
> **执行规则：**
> - **必须**逐项走完，不跳项。
> - 任一项不通过：定位问题 → 修复 → **从第 1 节重新执行完整清单**，不要只复查修过的那一项。

## 1. 产物结构

> 出处：`package-format.md`
>

- [ ] `index.html` 未放在任何子目录中，文件名全小写
- [ ] 产物内只有一个入口 `index.html`
- [ ] 除 `index.html` 外的所有文件平铺在 `static/` 目录下
- [ ] 入口声明了 `<!DOCTYPE html>`、`<meta charset="utf-8">` 与 viewport
- [ ] 所有文件后缀在白名单内（`package-format.md` 第 6 节）
- [ ] ZIP 为标准 deflate 格式、未加密、未分卷，解压后未多包一层同名目录
- [ ] 不含 `__MACOSX/`、`.DS_Store`、`Thumbs.db` 等系统生成文件
- [ ] 不含空目录、未被引用的文件
- [ ] 解压后总体积不超过 8MB（含内联的 Data URL 图片）

## 2. 代码

> 出处：`development-rules.md`，小节号对应该文件的小节。

### 2.1 代码来源（§3.1）

> **例外：** cosmic tokens 样式表与 cosmic icon（`cos-icon`）字体按 `layout.html` 的写法直接使用，本节的第三方 URL / 外部样式表 / 字体服务各项不适用于它们。

- [ ] 无任何第三方 URL：HTML、CSS、JS 中不含 `http://`、`https://`、`//` 开头的外部地址
- [ ] 无外部 `<script src>`、无外部 Module、无第三方 CDN 代码
- [ ] 无外部 `<link rel="stylesheet">`、无外部 `@import`、无指向产物外的 CSS `url()`、无第三方字体服务
- [ ] 动态 `import()` 与动态创建的 `script` 只用相对路径指向产物内文件
- [ ] 无 `dns-prefetch` / `preconnect`

### 2.2 运行时生成可执行代码（§3.2）

- [ ] 无 `eval`、`new Function`
- [ ] 无字符串形式的 `setTimeout` / `setInterval`
- [ ] 无 `document.write`、无通过 `innerHTML` / `script.textContent` 插入脚本文本
- [ ] 未把 Data URL / Blob URL 用作脚本、Module 或 Worker 入口
- [ ] 无 `onclick` / `onload` / `onerror` 等行内事件属性，事件全部用 `addEventListener`
- [ ] 无 `javascript:` URI

### 2.3 网络与存储（§3.1 / §3.3）

- [ ] 无产物外的 `fetch` / `XMLHttpRequest`
- [ ] 无 `WebSocket` / `EventSource` / `sendBeacon` / `RTCPeerConnection`
- [ ] 表单不向产物外提交数据，`submit` 时 `preventDefault()` 并在产物内处理
- [ ] 无 `localStorage` / `sessionStorage` / `indexedDB` / `document.cookie` / Cache API
- [ ] 全部运行状态保存在内存变量中，作品在「每次打开都是初始状态」下自洽

### 2.4 用户文件与设备（§3.4）

- [ ] 无 `<input type="file">`、无 File System Access API
- [ ] 无 `getUserMedia` / `getDisplayMedia` / Geolocation / 剪贴板读取
- [ ] 无 Bluetooth / USB / Serial / HID / NFC

### 2.5 展示边界（§3.5）

- [ ] 无 `window.open`、无外部 `location` 跳转、无 `<meta http-equiv="refresh">`
- [ ] 无 `<iframe>` / `<object>` / `<embed>`
- [ ] 无 `target="_top"` / `target="_parent"`，未读写 `parent` / `top` / `frameElement`
- [ ] 无 `postMessage` 向产物外发送消息，未调用产物外注入的接口（`genui-api.md` 列出的 `window.genui.*` 除外）
- [ ] 无 `alert` / `confirm` / `prompt`，弹层全部用产物内 DOM 实现
- [ ] 无 `requestFullscreen` / `requestPictureInPicture` / `requestPointerLock`
- [ ] 无 `Notification` / Push API

### 2.6 后台执行与二进制（§3.6）

- [ ] 无 `new Worker` / `new SharedWorker` / `serviceWorker.register`
- [ ] 无 `AudioWorklet` / `PaintWorklet` 等 Worklet
- [ ] 无 `WebAssembly.*`，未引入依赖 WASM 的库
- [ ] 无 Background Sync / Periodic Background Sync

## 3. 视觉

> 出处：`visual-guidelines.md`，小节号对应该文件的小节；该文件未约束的部分按通用 Web 最佳实践处理。

### 3.1 结构形态与骨架（§1）

- [ ] 已明确用形态 A（画布区 + 操作区）还是形态 B（整屏画布）
- [ ] 形态 A 的骨架直接照搬 `layout.html`，卡片容器、表头、画布区、操作区的结构与取值未自行改动
- [ ] 形态 B 沿用了 `layout.html` 的卡片容器与 1:1 实现
- [ ] 形态 A 下画布区高度占比 ≥ 50%，操作区未把画布区挤压到不可辨识
- [ ] 形态 A 交互控件集中在操作区，未散落在画布区

### 3.2 画布与响应式（§2）

- [ ] 1:1 正方形响应式适配，内部元素随容器缩放
- [ ] 最小 360px 屏宽下内容可读、交互可用
- [ ] 首帧容器宽高为 `0` 时不报错、不空白，就绪后能正常首绘
- [ ] 容器内无滚动条，内容没有溢出容器导致撑出滚动条
- [ ] body 已显式清除默认 padding / margin（`body { margin: 0; padding: 0; }`），未依赖浏览器默认边距

### 3.3 表头（§3）

- [ ] 表头内容为「小工具 · 项目名称」，其中项目名称不超过 10 个字，高 45px、内间距左右上 15px / 下 12px、底描边 0.5px
- [ ] 形态 A 表头照搬 `layout.html` 的 `.vc-component-header`，配色用 `--cos-*` token，未写死 hex
- [ ] 形态 B 表头为浮层，按画布背景明度取了对应的一套配色，且不随 `prefers-color-scheme` 切换
- [ ] 提示 icon 16×16px、与文字间距 3px，点击/悬浮弹出气泡
- [ ] 表头右侧只放了 icon 操作按钮（最多 3 个），未放标题、说明、状态、计数、单位、标签或装饰元素；按钮均有无障碍名称
- [ ] 表头右侧功能 icon 均为 18×18px、相邻间距 18px，整体靠右对齐且距右边缘 15px，颜色按形态取值
- [ ] 声音按钮只在作品有声音时出现且默认静音；点击后实际声音与静音 / 开启 icon 同步切换
- [ ] 播放按钮只在有可播放、暂停的持续过程时出现且默认非播放态；点击后实际播放状态与播放 / 暂停 icon 同步切换，播放结束或重置后恢复为播放 icon
- [ ] 每个作品表头都有重置按钮；纯参数或纯拖拽作品也能将参数与视图恢复初始态
- [ ] 重置后动画、轨迹、临时高亮、运动状态与各项参数都回到初始态，点击有 icon 旋转反馈

### 3.4 token 与配色（§7 / §10）

- [ ] 有对应 token 的颜色都用了 `var(--cos-*)`，未改写成固定 hex
- [ ] 未自造 `--cos-*` 名称，未在产物内重新定义 `--cos-*`（无自写的 `:root` 覆盖）
- [ ] 未自行给 `--cos-*` 加 `prefers-color-scheme` 覆盖
- [ ] 深浅两种配色环境下内容均可读

### 3.5 画布区与信息密度（§4 / §9）

- [ ] 主内容不显小，四周无过多无意义边距
- [ ] 画布区内的文字、面板、坐标轴沿用 §7 的 token 与组件规格，未自成一套
- [ ] 排版无重叠、无溢出、无文字截断
- [ ] 无大面积无意义空白，也不堆砌信息
- [ ] 所有文字的实际渲染字号不低于 14px；仅形态 B 沉浸态的非主功能文案可豁免，且在 360px 屏宽下仍可辨识
- [ ] 无硬编码的一次性魔法数值堆砌导致的布局错位

## 4. 交互

> 出处：`visual-guidelines.md` §5 / §6

### 4.1 组件

- [ ] 用到的组件样式直接照搬 `assets/components/` 下的参考实现，未做样式覆盖
- [ ] 未自造 `assets/components/` 已有的组件

### 4.2 控件数量与排布

- [ ] 整个作品只用了一次 Tabs，各 Tab 下操作区高度一致
- [ ] 未用按钮实现 Tab 切换效果
- [ ] 每个 Tab（无 Tabs 时为整个作品）的滑动条不超过 4 个，排列方式符合 §5.3 的优先级规则
- [ ] 两两一排时行间距 9px、列间距 22px；滑动条为奇数个时最后一个铺满整行
- [ ] 按钮不超过 2 个；单按钮用 `plain`，双按钮为 `primary` + `plain`；按钮内无图标

### 4.3 交互质量

- [ ] 每个控件操作都有即时、可观察的视觉反馈
- [ ] 无死状态：任意操作序列后作品仍可继续使用
- [ ] 未把上下滑动占为交互手势；
- [ ] 参数取**最小值与最大值**时，所有元素仍完整落在可视区内，不越界、不被裁切
- [ ] 多个参数的**极值组合**下同样不越界

## 5. 资源

> 出处：`package-format.md` §5 / §6，`development-rules.md` §2.2 / §2.5

- [ ] HTML / CSS / JS 中引用的每个资源都真实存在于产物内
- [ ] 所有路径为相对路径，无绝对路径、协议相对路径、上跳路径
- [ ] 字体文件随产物提交，未引用第三方字体服务
- [ ] 音频在代码里生成，未加载音频文件；WebGL 几何数据放 JSON 或在代码中生成
- [ ] Data URL 只用于图片，未用作脚本 / 样式表 / 字体来源

## 6. 打点

> 出处：`genui-api.md`

- [ ] 每个用户主动交互都调用了 `window.genui.sendLog`，`area` 取值符合「平台组件 → `operation`，其余 → `custom`」
- [ ] 调用前判断了 `window.genui` 存在，缺失时作品仍能正常运行
- [ ] 连续手势只在交互结束时上报一次；未为初始化、自动动画等非用户触发的行为打点
- [ ] `sendLog` 只传了 `area`，未传字段表未声明的字段
