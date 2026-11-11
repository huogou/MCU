---
name: genui-app-builder
description: >-
  GenUI 生产工具总入口。按用户意图在应用创作与 CLI 工具流程之间路由，
  支持创作、修改、预览、检查、配置、登录和发布，也支持跨阶段连续执行。
metadata:
  version: "1.1.0"
---

# GenUI 生产工具

对用户只呈现一个“GenUI 生产工具”。内部由两个 Skill 分工：

- `genui-creator`：创作、修改、视觉与交互规范、产物组织和创作阶段自查。
- `genui-toolkit`：`preview`、`check`、`list`、`app.json`、`login`、`logout` 和 `publish`。

预览应用效果必须走 `genui preview`，直接打开 HTML 不能代表上线后的真实效果。

开发态路径为 `../genui-creator/SKILL.md` 和 `../genui-toolkit/SKILL.md`；构建产物路径为 `skills/genui-creator/SKILL.md` 和 `skills/genui-toolkit/SKILL.md`。选择实际存在的一套路径，不能同时读取两套。路由后完整读取对应 `SKILL.md`，并按其要求读取 reference。

## 路由

| 用户需求 | 使用 |
| --- | --- |
| 从零创作；修改功能、样式或交互；适配创作规范 | `genui-creator` |
| 单独整理或重新打包交付产物；检查视觉、代码组织或产物结构是否符合创作规范 | `genui-creator` |
| 本地预览；执行 `genui check`；检查 HTML/ZIP 产物；查看应用列表 | `genui-toolkit` |
| 创建、读取或修改 `app.json`；登录或登出 | `genui-toolkit` |
| 发布已有可用的本地应用；更新线上应用；提交审核 | `genui-toolkit` |
| 同时要求创作或修改，并继续预览、CLI 检查或发布 | 先 `genui-creator`，再 `genui-toolkit` |
| 没有可用产物，必须先生产或修复才能执行工具流程 | 先 `genui-creator`，再 `genui-toolkit` |

歧义按对象处理：创作规范、视觉、代码组织和产物结构自查走 creator；明确执行 `genui check` 或检查 HTML/ZIP 走 toolkit。单独整理最终产物走 creator；publish 中按本地依赖自动生成 ZIP 走 toolkit。用户只说“发布”“上线”或“提交审核”时，不默认读取 creator。

## 组合交接

1. creator 完成创作、修改和必要自查。
2. 确认应用目录、HTML 或 ZIP 真实存在且可用。
3. 将产物路径和已确定的信息交给 toolkit，不要求用户重复提供。
4. toolkit 负责后续 CLI、配置、检查和发布流程；其当前规则是唯一依据。
5. 最终发布确认严格服从 toolkit 当前规则。

不要让用户选择内部 Skill，也不要在本入口复制子 Skill 的依赖、参数、配置或确认规则。

## 失败传播

- creator 失败：停止依赖该产物的工具流程。
- toolkit 失败：保留仍有效的创作结果，不重做无关创作步骤。
- 用户修改需求：只重做受影响阶段及其后续依赖。
- 明确说明已完成和未完成部分，不把部分结果描述为完整交付。
