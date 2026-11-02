# MCU Atlas 资讯模块 · 发布操作说明（RUNBOOK）

> 配套脚本：`workspace/news/pipeline/tools/publish-news.cjs`
> 适用：将 G9 工作区 `news.js` 受控发布到生产 `mcu-h5/data/news.js`

## 0. 安全红线（务必遵守）
- 只允许发布**经过人工审核批准**的 `news.js`。
- **禁止**全量复制 `mcu-atlas-news/h5` 到 `mcu-h5`（会覆盖生产态页面与备份）。
- **禁止**无 `--manifest` 批准清单直接 `--publish`。
- 仅发布单文件 `data/news.js`；若发布引入新实体 ID，须另行同步 `content.js`/`characters.js`。

## 1. 发布前检查
- [ ] G9 已生成工作区 `news.js`（`/www/wwwroot/mcu-atlas-news/h5/data/news.js`）。
- [ ] 已产出批准清单文件，每条待发布记录以最终 `news-` id 为键（`approved_ids` 或 `entries[].action==='approve'`）。
- [ ] 确认当前工作区与生产基线一致（见步骤 2 差异应为纯新增）。

## 2. dry-run（必做，只读）
```bash
cd /www/wwwroot/mcu-atlas-news/workspace/news/pipeline/tools
/opt/node24/bin/node publish-news.cjs --dry-run
```
确认：
- 结构校验通过（≠事实审核通过）。
- 差异中**无"删除/变更"**（默认禁止；出现则停止并人工确认）。
- 新增记录全部命中批准清单。

## 3. 差异审阅与人工确认
- 将 dry-run 输出的"新增"清单交审核人确认。
- 确认无误后，由授权人执行步骤 4。

## 4. 正式发布（需授权）
```bash
/opt/node24/bin/node publish-news.cjs --publish --manifest /path/to/approved-manifest.json
```
脚本自动：结构校验 → 审核核对 → 备份生产文件（`.bak-pub-<时间戳>`）→ 原子替换 → 重新校验。
任一关键校验失败立即停止；若已替换则自动回滚并验证。

## 5. 发布后验证
- 首页/资讯列表页/详情页确认新资讯出现。
- 缓存响应头确认：
```bash
curl -ksI https://mcu.yaokaixin.top/data/news.js | grep -i cache-control
# 期望：Cache-Control: no-cache, must-revalidate
```
（已配置定向规则 `location = /data/news.js`，无需为发布额外刷新缓存。）

## 6. 回滚（两类，操作不同，切勿混淆）

### 6.1 资讯数据文件回滚（news.js）
- **备份位置（绝对路径，由发布脚本在 `--publish` 时自动生成）**：
  `/www/wwwroot/mcu-h5/data/news.js.bak-pub-<ISO8601时间戳>`
  时间戳形如 `2026-10-19T05-58-31-123Z`；**具体文件名以当次发布日志输出的"备份路径"为准**，禁止使用含义不明的通用占位。
- **恢复**：
  ```bash
  cp /www/wwwroot/mcu-h5/data/news.js.bak-pub-<对应时间戳> /www/wwwroot/mcu-h5/data/news.js
  ```
- **回滚后验证（纯数据恢复，不需要 nginx reload）**：
  1. 记录数与 ID 集合一致：
     ```bash
     /opt/node24/bin/node -e "const fs=require('fs'),vm=require('vm');const s={window:{}};vm.runInContext(fs.readFileSync('/www/wwwroot/mcu-h5/data/news.js','utf8'),s);const r=s.window.MCU_NEWS;console.log('count',r.length);console.log('ids',r.map(x=>x.id).sort().join(','))"
     ```
     与发布前基线（记录数、ID 集合）比对。
  2. 页面读取：浏览器分别打开首页 / 资讯列表页 / 详情页，确认资讯列表与发布前一致。
  3. 缓存已对 `news.js` 设 `no-cache`，浏览器刷新即取新值，无需清 CDN/重启。
- **脚本自身保障**：若 `--publish` 在"替换后校验"失败，脚本自动调用 `rollback()` 并用 `verifyTarget()` 比对记录数与 ID 集合，确认与原始备份一致后才退出（publish-news.cjs 行 203-209、151-154）。

### 6.2 nginx 配置回滚（缓存规则）
- **仅当需撤销 2026-10-19 实施的 `/data/news.js` 禁用缓存规则时执行。**
- **备份位置（本次实施已生成，绝对路径）**：
  - `/www/server/panel/vhost/nginx/mcu.yaokaixin.top.conf.bak-pub-2026-10-19T05-33-35-229Z`
  - `/www/server/panel/vhost/nginx/mcu.yaoqiang.xin.conf.bak-pub-2026-10-19T05-33-35-239Z`
  - `/www/server/panel/vhost/nginx/mcuatlas.xyz.conf.bak-pub-2026-10-19T05-33-35-240Z`
- **恢复**：
  ```bash
  cp /www/server/panel/vhost/nginx/mcu.yaokaixin.top.conf.bak-pub-2026-10-19T05-33-35-229Z /www/server/panel/vhost/nginx/mcu.yaokaixin.top.conf
  # 另两个域名同理，替换对应文件名
  ```
- **必须先 `nginx -t` 语法检查，通过后才 `nginx -s reload`（严禁 restart）。**
- **回滚后验证响应头**：
  ```bash
  curl -ksI https://mcu.yaokaixin.top/data/news.js | grep -i cache-control
  # 期望恢复为 max-age=604800（7 天, public），表示已回退到原全站 JS 缓存策略
  ```

## 7. 日志与备份
- 日志：脚本标准输出（含时间戳、级别、版本标识、备份路径）。
- 备份分两类（与第 6 节对应）：
  - **数据备份（每次 `--publish` 自动生成）**：`/www/wwwroot/mcu-h5/data/news.js.bak-pub-<ISO时间戳>`。
  - **nginx 配置备份（2026-10-19 实施缓存规则时生成）**：见第 6.2 节列出的三个 `.bak-pub-2026-10-19T05-33-35-*` 文件。

## 8. 自检（不碰生产）
```bash
/opt/node24/bin/node publish-news.cjs --self-test
```
用于回归：合法/缺字段/非法枚举/重复 ID/无证据/删除检测/备份失败/回滚 等场景。
