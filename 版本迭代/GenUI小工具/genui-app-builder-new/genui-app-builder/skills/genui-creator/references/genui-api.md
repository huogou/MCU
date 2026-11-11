# GenUI API 规范

容器会注入 **`window.genui.*`**，作品通过它调用平台能力。字段以本文档为准，表中未声明的字段不要传。

> `window.genui` 是 `development-rules.md` §3.5「调用产物外注入的接口」的**唯一例外**。本文未列出的 API 与注入对象一律不得调用。

## 调用约定

| 项 | 规则 |
| --- | --- |
| 入口 | `window.genui.<apiName>(options)` |
| 注入时机 | 由容器注入。本地直接打开 HTML 时 `window.genui` 不存在，调用前必须判断存在性 |
| 返回值 | 无返回值，不要依赖返回结果做后续逻辑 |
| 失败 | 调用失败不影响作品运行，不要重试、不要向用户提示、不要写降级兜底 |

## sendLog

上报一次用户交互打点。

- **调用**：`window.genui.sendLog(options)`

### 请求参数

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | :---: | --- |
| `area` | `"operation" \| "custom"` | 是 | 打点来源区域：交互发生在 `assets/` 下的平台组件上传 `operation`，其余传 `custom` |

### 什么情况要打点

| 场景 | 是否打点 | `area` |
| --- | :---: | --- |
| 操作组件：按钮、Tabs、开关、复选框、单选框、下拉选择、步骤进度条、滑动条、提示 icon、重置按钮等 | 是 | `operation` |
| 点击 / 拖动画布区内的元素 | 是 | `custom` |
| 首屏初始化、自动播放的动画帧、程序自身触发的状态变化 | 否 | — |

- **【必须】** 连续手势（拖动滑动条、拖拽画布元素）只在**交互结束时**上报一次，不要在 `move` / 每一帧里上报。

### 示例

统一包一层，避免每个调用点都写存在性判断：

```js
function sendLog(area) {
    if (window.genui && typeof window.genui.sendLog === 'function') {
        window.genui.sendLog({ area: area });
    }
}
