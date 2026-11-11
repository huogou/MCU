---
name: genui-creator
description: GenUI 创作者规范与提交指引。当需要为 GenUI 平台创作、修改或打包一个互动作品时使用；覆盖平台能力边界、代码约束、视觉规范、产物打包格式与提交前自查。
metadata:
  version: 1.0.0
---

# GenUI Creator

## 定位

GenUI 平台的创作者规范入口。回答五个问题：

- **代码能不能这么写** → `references/development-rules.md`
- **平台注入了哪些能力** → `references/genui-api.md`
- **页面应该做成什么样** → `references/visual-guidelines.md`
- **产物应该怎么组织** → `references/package-format.md`
- **现在能不能提交** → `references/checklist.md`

## 适用场景

- 从零创作一个 GenUI 作品
- 修改已有 GenUI 作品的功能、样式或交互
- 把作品打包成平台可接收的产物
- 提交前自查，或提交被规则校验拦截后定位问题

不适用：与 GenUI 产物无关的普通 Web 开发、平台侧的服务端开发。

## 核心原则

1. **产物自包含**：最终执行的每一行代码、每一个资源都必须在提交的产物里，不允许引入产物外的任何代码或资源。
2. **代码在提交时即可确定**：禁止一切在运行时才生成可执行代码的手段。
3. **不越出展示边界**：作品在自己的展示区域内运行，不得触碰承载它的页面，也不得越出展示区域。
4. **按需读取规范**：不要一次性加载全部 reference。按当前任务阶段读，减少无关上下文。

## 工作流程

### 1. 理解任务

判断当前处于哪个阶段，据此决定读哪些 reference（见下方「Reference 读取规则」）。

明确：作品要解决什么问题、需要哪些交互、用到的能力是否都在支持范围内。需求依赖不支持的能力时，调整设计方案，改用支持的能力实现。

### 2. 开发 GenUI

读 `references/development-rules.md`。

在写代码前先核对：本次要用的每一项 Web 能力落在「支持的能力」还是「不支持的能力」里。

接着读 `references/genui-api.md`：平台注入的 `window.genui.*` 是产物外接口的唯一例外，交互打点按该文件接入。

### 3. 处理视觉和交互

读 `references/visual-guidelines.md`。

用到具体控件时，再读 `assets/` 下对应的组件文件——样式规格以文件为准。

### 4. 打包项目

读 `references/package-format.md`。

按白名单后缀、目录结构与资源引用规则组织产物，确认 HTML 里引用的每个资源都在包内。

### 5. 提交前检查

读 `references/checklist.md`，逐项执行。

任一项不通过：定位问题 → 修复 → **重新执行完整清单**，不要只复查修过的那一项。

产物完成后，提醒用户下一步通过 `genui preview` 预览。预览容器会注入相关运行环境，直接打开 HTML 不能代表上线后的真实效果。

## Reference 读取规则

| 当前任务 | 必读 | 按需 |
|---|---|---|
| 创作新作品（完整流程） | development-rules → genui-api → visual-guidelines → package-format → checklist | `assets` 中用到的组件 |
| 修改功能逻辑 | development-rules | genui-api（若增删交互）；visual-guidelines（若改动影响表现） |
| 只改样式 / 布局 / 交互表现 | visual-guidelines | `assets/` 中用到的组件；development-rules（若引入新 API 或新资源） |
| 接入 / 调整打点 | genui-api | — |
| 只重新打包 | package-format | — |
| 提交前自查 / 校验被拦截 | checklist | 对应领域的 reference（定位具体规则） |

## 规则冲突处理

优先级从高到低：

```
1. 平台运行环境硬性限制   ← 运行时强制阻断，无法绕过
2. 开发规范               development-rules.md
3. GenUI API 规范         genui-api.md
4. 打包产物规范           package-format.md
5. 视觉与交互规范         visual-guidelines.md
6. 通用 Web 最佳实践
```

- 低优先级规范与高优先级冲突时，**服从高优先级**，并说明被放弃的是哪一条。
- 用户的显式指令高于本 Skill 的全部规范，但**不能高于第 1 层**：用户要求使用平台硬阻断的能力时，明确告知该能力在运行时会被阻断，并给出可行替代方案。
- 规范之间存在同级歧义时，选**更严格**的一侧。
