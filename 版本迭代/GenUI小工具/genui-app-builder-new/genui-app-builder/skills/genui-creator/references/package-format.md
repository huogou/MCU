# 打包产物规范

> 本文件定义最终提交产物应该是什么结构，以及 ZIP 内文件和资源如何组织。

## 1. 产物说明

提交物有两种形态：

| 形态 | 适用 | 说明 |
|---|---|---|
| 单 HTML 文件 | 产物只有 HTML / CSS / JS 内容，无外部资源 | 直接提交 `index.html` |
| ZIP 压缩包 | 含图片、字体、数据文件等独立资源 | 解压后根目录必须有 `index.html` |

**【建议】** 产物只包含 HTML / CSS / JS 内容时，全部样式与脚本内联到单个 `index.html`，不拆成多个文件、不打 ZIP。只有确实需要随包提交资源时才用 ZIP 形态。

**【必须】** 产物内引用的每个资源都真实存在于包内。资源完整性是规则校验项。

## 2. 目录结构

```
<产物根>/
├── index.html          # 【必须】入口，必须在根目录
└── static/             # 【可选】除 index.html 外的所有文件平铺放这里
    ├── main.css
    ├── app.js
    ├── stage-bg.png
    └── number.woff2
```

- **【必须】** `index.html` 位于根目录，不得放入任何子目录。
- **【必须】** 除 `index.html` 外的所有文件平铺在 `static/` 下，不在根目录直接放其他文件。

## 3. 入口文件

- **【必须】** 文件名固定为 `index.html`，全小写。
- **【必须】** 产物内有且只有一个入口 `index.html`（子目录中不得出现同名入口文件）。
- **【必须】** 声明 `<!DOCTYPE html>`、`<meta charset="utf-8">` 和 viewport。

## 4. 资源目录

- **【必须】** 字体文件随产物提交，不引用第三方字体服务。
- **【禁止】** 空目录（ZIP 中无意义的占位目录）。

## 5. 资源引用

- **【必须】** 所有路径为**相对路径**，且不指向产物根之外。
- **【禁止】** 使用绝对路径（`/assets/x.png`）、协议相对路径（`//cdn/x.png`）、上跳路径（`../../x.png`）。

```html
<!-- ✅ 相对路径指向产物内资源 -->
<img src="./static/diagram.png" alt="示意图">
<link rel="stylesheet" href="./static/main.css">
<script src="./static/app.js"></script>

<!-- ❌ 第三方 URL：规则校验拦截 + 运行时阻断 -->
<img src="https://img.example.com/diagram.png">
<script src="https://cdn.example.com/lib.js"></script>
<link rel="stylesheet" href="https://cdn.example.com/base.css">

<!-- ❌ 绝对路径 / 协议相对路径 -->
<img src="/static/diagram.png">
<script src="//cdn.example.com/lib.js"></script>
```

```css
/* ✅ CSS 与它引用的资源同在 static/ 下，直接同级引用 */
@font-face { src: url('./number.woff2') format('woff2'); }
.hero { background-image: url('./bg.png'); }

/* ❌ 外部 @import / 外部 url() / 第三方字体 */
@import url('https://fonts.example.com/css?family=X');
.hero { background-image: url('https://img.example.com/bg.png'); }
```

- **【限制】** Data URL 只能用于图片，MIME 限 `image/png`、`image/jpeg`、`image/gif`、`image/webp`、`image/svg+xml`；**禁止**用作脚本、样式表或字体来源。体积计入产物总体积（见第 7 节）。

## 6. 允许的文件类型

**【必须】** 产物内只包含下表后缀的文件。文件类型是规则校验项，出现白名单外的后缀即拦截。

| 后缀 | 用途 | 是否必需 | 说明 |
|---|---|---|---|
| `.html` | 模板文件 | 是 | 入口必须是 `index.html`，有且只有一个，且在根目录 |
| `.css` | 样式文件 | 否 | |
| `.js` | 脚本文件 | 否 | ES Module 也用 `.js`，不用 `.mjs` |
| `.png` / `.jpg` / `.jpeg` / `.gif` / `.webp` / `.svg` | 图片资源 | 否 | |
| `.woff` / `.woff2` | 字体文件 | 否 | 不支持 `.ttf` / `.otf` |
| `.json` | 静态数据 / 配置 | 否 | |

## 7. 文件大小限制

- **【必须】** 产物**解压后**总体积不超过 **8MB**（全部文件之和，含内联的 Data URL 图片；不按 ZIP 压缩后的体积计）。
- 文件数量与单文件体积平台不做限制，只受 8MB 总量约束。
- **【必须】** 提交前删除未被引用的文件。

## 8. ZIP 要求

- **【必须】** 使用标准 ZIP 格式（deflate），不使用 rar / 7z / tar.gz。
- **【必须】** 解压后**根目录直接是 `index.html`**，不能多包一层同名目录。
- **【必须】** 不加密、不设密码、不分卷。
- **【禁止】** 包含 `__MACOSX/`、`.DS_Store`、`Thumbs.db` 等系统生成文件。

用命令行打包并排除系统文件：

```bash
cd <产物根>
zip -r ../genui-app.zip . -x '.*' -x '__MACOSX/*' -x '*/.DS_Store'
```

打包后自检解压结构：

```bash
unzip -l ../genui-app.zip | head -20   # 第一层应能直接看到 index.html
```

## 9. 完整示例

### 单文件形态（默认）

```
index.html          # 结构 + <style> + <script> 全部内联
```

### ZIP 形态（有随包资源时）

```
genui-app.zip
└── (解压后)
    ├── index.html
    └── static/
        ├── main.css
        ├── app.js
        └── stage-bg.png
```