---
name: genui-toolkit
description: 使用 genui CLI 预览、静态检查、查询和发布 GenUI 应用，并管理 app.json 与登录状态。适用于本地预览、产物检查、应用列表、发布配置、提交审核、登录或登出；各能力可独立使用。
metadata:
  version: 1.0.0
---

# GenUI 工具

Skill 负责识别意图、发现应用、准备参数、取得必要确认、调用 CLI 和解释结果。编译、检查、上传、认证和平台接口调用由 `genui` CLI 负责，不要在 Skill 中重复实现或绕过 CLI。

## 按需读取

- 生成、读取或修改 `app.json` 时，完整读取 [references/app-json.md](references/app-json.md)。
- 用户要求新增发布、更新发布或提交审核时，完整读取上述配置说明和 [references/publish.md](references/publish.md)。

只读取当前能力需要的 reference。发布流程失败时停止依赖该结果的后续操作。

## CLI 前置检查

执行任何 CLI 命令前检查全局包、最新版本和命令可用性；只编辑 `app.json` 时不检查。

```bash
genui --version
npm view @cosui/genui-toolkit version
```

- `genui --version` 执行失败：说明当前 agent 环境无法使用全局 CLI，询问是否代为安装。用户明确同意后才执行 `npm i @cosui/genui-toolkit -g`。
- 已安装但不是最新版本：告知当前与最新版本，直接升级并重新验证，不再询问。
- 无法查询当前版本或最新版本、安装或升级失败、最终版本不一致：报告错误并停止 CLI 流程。

版本一致后执行：

```bash
genui --help
```

验证失败时停止。当前 `check` 是静态产物检查，不需要 Playwright Chromium。

## 能力矩阵

| 意图 | CLI | 输入与输出 | 风险和确认 |
| --- | --- | --- | --- |
| 本地预览 | `genui preview [project-path] [-n <name>] [-d <description>]` | HTML 或 ZIP；输出本机、手机地址和二维码 | 启动持续运行的本地服务并打开浏览器；直接执行 |
| 规则检查 | `genui check <artifact>` | 本地 HTML、ZIP 或 HTTP(S) URL；文本或 JSON | 只读；直接执行 |
| 应用列表 | `genui list` | 无参数；输出名称、AppKey 和审核状态 | 只读；直接执行，未登录时 CLI 会登录 |
| 登录 | `genui login` | 无参数；打开浏览器并保存登录态 | 用户要求登录时直接执行 |
| 登出 | `genui logout` | 无参数；清除本机登录态 | 执行前确认 |
| 发布 | `genui publish` | CLI 参数与当前目录 `app.json` 合并；`--dry-run` 输出最终信息但不上传 | 新增应用合并确认建议参数、预览效果和提交审核；已有应用确认最终信息后提交 |

除 `check` 的专用退出码外，命令成功为 0，失败为非零。每个命令结束后报告成功、失败或持续运行状态；保留原始错误摘要，不输出令牌、Cookie 或 JWT。

## 应用发现

需要本地路径时依次使用：用户明确给出的 HTML/ZIP、当前目录的 HTML/ZIP、对话中最近创建或修改的 GenUI 产物。存在多个合理候选时列出编号和绝对路径，不要代选。

`preview` 只接受 HTML 或 ZIP 文件。未传路径时读取当前目录 `app.json` 的 `projectPath`；传入 HTML/ZIP 时，标题和描述可从该文件同目录的 `app.json` 读取。显式 CLI 参数优先。ZIP 根目录必须包含 `index.html`，预览时解压到临时目录并在服务关闭后清理。目录和其他文件类型不支持。`check` 同样只接受 HTML 或 ZIP，不接受目录或 `-p`。

**【重要】** 产物生产完成后，不要启动自带的本地服务 server，也不要直接打开 HTML 判断效果，下一步必须通过 `genui preview` 预览。自带的本地服务或直接打开 HTML 样式不完整，不能代表上线后的真实效果。

## 独立能力

### 预览

```bash
genui preview <html-or-zip> [-n <name>] [-d <description>] [--qr-image]
```

可选 `-p/--project-path`、`-n/--name`、`-d/--description`、`--port <port>` 和 `--qr-image`。标题和描述表示组件标题与组件描述，显式参数优先，其次使用产物同目录或当前目录 `app.json`，仍缺失时由 CLI 使用默认文案。执行时必须传 `--qr-image`，并用 CLI 输出的绝对路径向用户展示 PNG。启动后返回电脑地址、手机地址、二维码和停止方式；持续运行不是卡住，用户要求停止时终止对应进程。二维码指向局域网内的本地预览页，手机与电脑必须连接同一 WiFi；这是判断上线效果的标准预览方式。

### 检查

```bash
genui check <artifact> [options]
```

`artifact` 可以是本地 HTML、ZIP，或指向 HTML/ZIP 的 HTTP(S) URL。

退出码：通过为 0；存在错误诊断为 1；参数无效、文件不可读、远程下载或执行异常为 2。向用户报告目标、是否通过、错误数、警告数和关键诊断；检查未通过时不要继续自动发布。

### 列表、登录、登出

- 列表：执行 `genui list`，原样整理名称、AppKey 和审核状态。
- 登录：执行 `genui login`；已登录则返回状态，否则等待浏览器登录成功或超时。
- 登出：提示会清除当前设备登录状态；用户明确确认后执行 `genui logout`。

## 发布前检查与确认

发布时按 [references/app-json.md](references/app-json.md) 管理配置，并按 [references/publish.md](references/publish.md) 执行。以下规则不得省略：

1. 用户未主动提供 AppKey 时，先询问新增应用还是已有应用。
2. 新增应用必须准备 `projectPath`、`name`、`logo`、`poster`、`brief`、`description` 六项建议值；建议值不能静默采用。Logo 与封面必须由用户提供真实本地图片，不生成、不编造。
3. 已有应用自动执行 `genui list` 选择 AppKey，只提交本次更新字段；除 AppKey 外至少更新一项，正式命令必须显式携带选定的 `--appkey`。
4. 必要预览和 `--dry-run` 成功后，一次展示最终信息并确认；明确告知“确认发布后将立即提交审核”。参数变化时重新预检，失败时停止。

## 组合流程

用户要求预览并发布、检查后发布或完整流程时，按用户点名顺序组合。预览服务阻塞后续步骤时，保留地址供查看并妥善停止。任何前置失败都停止发布；最终发布确认按上述 Skill 门禁完成。
