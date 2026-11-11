# 开发规范

> 本文件回答两件事：**能用什么**（第 2 节）、**不能用什么**（第 3 节）。写代码前逐项核对本次要用的 Web 能力落在哪一节。

## 1. 运行环境

GenUI 作品是一个**纯本地、不联网**的 Web 应用（HTML / CSS / JS）。请把它当作一个「能力受限的浏览器页面」来开发。

| 特征 | 含义 |
|---|---|
| 标准 Web 技术栈 | 用标准 HTML / CSS / JS 与标准 Web API 开发，不需要也不允许引入平台专有框架 |
| 完全自包含 | 页面、脚本、样式、图片、字体等资源全部随产物提交，不联网即可完整运行 |
| 状态不持久 | 存储类能力一律不可用，每次打开都是初始状态 |
| 在自己的展示区域内运行 | 不触碰承载它的页面，也不越出展示区域 |

## 2. 支持的能力

### 2.1 页面结构与交互

| 能力 | 使用边界 |
|---|---|
| 标准 HTML | 标准结构与语义化标签；第 3 节列出的标签与属性除外 |
| DOM API | 操作当前页面内的 `document` 与 DOM |
| 页面内导航 | Hash 路由、页面锚点、DOM 视图切换 |
| 用户交互事件 | 鼠标、触摸、键盘、Pointer 事件 |
| 表单控件 | `input`（不含 `type="file"`）、`select`、`textarea`、`button`；不向产物外提交数据 |

- **【必须】** 入口文件为产物根目录下的 `index.html`。
- **【必须】** 所有事件通过 `addEventListener` 绑定。

### 2.2 样式

| 能力 | 使用边界 |
|---|---|
| 标准 CSS | Flex、Grid、Media Query、Container Query、动画、过渡等 |
| 内联样式 | `<style>` 标签与 `style` 属性 |
| 产物内样式文件 | 相对路径引用产物内的 CSS |
| 字体 | 系统字体栈，或产物内通过相对路径引入的字体文件 |
| 高消耗样式 | 滤镜、阴影、动画可用，但不得造成明显卡顿、长任务或持续高 GPU 占用 |

产物外资源的替代做法：

- **图标**：用 cosmic icon（`cos-icon`），用法照搬 `assets/layout.html`；cosmic icon 里没有的图标才改用产物内的 SVG 或内联 SVG 符号，不引其它图标字体。
- **数字等宽字体**：把字体文件放进产物用相对路径引入，或改用系统等宽字体栈。

### 2.3 脚本

| 能力 | 使用边界 |
|---|---|
| 标准 JavaScript | 目标浏览器与 WebView 支持的 ECMAScript 语法 |
| 产物内脚本 | HTML 中固定存在的内联 `<script>`，或相对路径加载的产物内脚本|

### 2.4 图形与音频

| 能力 | 使用边界 |
|---|---|
| Canvas 2D | 绘图、图片处理 |
| SVG | 矢量渲染与交互 |
| WebGL 1 / 2 | 本地 3D 渲染；纹理用白名单内的图片格式，几何数据放 JSON 或在代码中生成 |
| Web Audio | 在代码里生成音频；不加载音频文件 |

### 2.5 产物内资源

| 能力 | 使用边界 |
|---|---|
| 相对路径引用 | 图片、字体、JSON 等随产物提交，用相对路径引用 |
| `fetch` 读静态数据 | 只能读产物内的文件 |
| Data URL 图片 | 只用于图片，MIME 限白名单内的图片类型；不作脚本、样式表、字体来源 |

- 目录结构、后缀白名单、体积上限见 `package-format.md`。

## 3. 不支持的能力

本节能力一律 **不使用**。

### 3.1 产物外的资源与网络

| 分类 | 具体不允许项 |
|---|---|
| 网络请求 | `fetch` / `XMLHttpRequest` 请求产物外地址 |
| 长连接与外发 | `WebSocket`、`EventSource`、`navigator.sendBeacon`、`RTCPeerConnection` |
| 外部代码 | 外部 `<script src>`、外部 Module、第三方 CDN 代码 |
| 外部样式与字体 | 外部 `<link rel="stylesheet">`、外部 `@import`、指向产物外的 `url()`、第三方字体服务 |
| 外部媒体与图片 | 任何第三方 URL 的图片、媒体、模块，包括 CDN、图床、埋点域名 |
| 外发数据 | `<form action>`、`<a href>` 指向产物外 |
| DNS 预取 | `<link rel="dns-prefetch">` / `preconnect` |

### 3.2 运行时生成可执行代码

| 分类 | 具体不允许项 |
|---|---|
| 运行时生成 JS | `eval`、`new Function`、字符串形式的 `setTimeout` / `setInterval`，以及通过 `script.textContent` / `innerHTML` / `document.write` 插入脚本文本 |
| Data / Blob URL 代码 | 把 Data URL 或 Blob URL 用作脚本、Module、Worker 入口 |
| 行内执行 | `onclick` / `onload` / `onerror` 等行内事件属性、`javascript:` URI |

```javascript
// ❌ 全部禁止
eval(src);
new Function('return ' + expr)();
setTimeout('tick()', 100);
el.innerHTML = '<script>...</script>';
document.write('<script src="..."></script>');
scriptEl.textContent = generatedCode;
import(blobUrl);
```

### 3.3 本地存储

| 分类 | 具体不允许项 |
|---|---|
| Web Storage | `window.localStorage`、`window.sessionStorage` |
| 数据库与缓存 | `indexedDB`、`caches.open()` 等 Cache API |
| Cookie | 读写 `document.cookie`，或依赖 Cookie 保存状态 |

### 3.4 用户文件与设备

| 分类 | 具体不允许项 |
|---|---|
| 读取用户本地文件 | `<input type="file">`、File System Access API（`showOpenFilePicker`、`showSaveFilePicker`、`showDirectoryPicker`、持久文件句柄） |
| 摄像头与麦克风 | `getUserMedia` |
| 屏幕与位置 | `getDisplayMedia`、Geolocation |
| 剪贴板 | 剪贴板读取 |
| 硬件接口 | Bluetooth、USB、Serial、HID、NFC |

### 3.5 越出展示区域

| 分类 | 具体不允许项 |
|---|---|
| 打开外部页面 | 外部链接、`window.open`、外部 `location` 跳转、`<meta http-equiv="refresh">` |
| 跳转承载页面 | `target="_top"` / `target="_parent"`，修改 `parent.location` / `top.location` |
| 访问承载页面 | 读取或修改 `parent`、`top`、`frameElement` 对应的内容 |
| 向产物外发送消息 | `postMessage` 发往产物外，以及调用产物外注入的接口 |
| 嵌套页面 | `<iframe>`、`<object>`、`<embed>` |
| 浏览器原生弹窗 | `alert`、`confirm`、`prompt` |
| 全屏与画中画 | `requestFullscreen`、`requestPictureInPicture` |
| 指针锁定 | `requestPointerLock` |
| 系统通知 | `Notification`、Push API |

- **【必须】** 作品数据不得离开产物。
- **【例外】** 平台注入的 `window.genui.*` 可以调用，用法与边界见 `genui-api.md`；除该文件列出的 API 外，不得调用任何产物外注入的接口。

### 3.6 后台执行与二进制

| 分类 | 具体不允许项 |
|---|---|
| Worker | `new Worker()`、`new SharedWorker()`、`navigator.serviceWorker.register()` |
| Worklet | `AudioWorklet`、`PaintWorklet` 等 |
| WebAssembly | `WebAssembly.compile()`、`WebAssembly.instantiate()`，以及依赖 WASM 的库 |
| 后台任务 | Background Sync、Periodic Background Sync |
