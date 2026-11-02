# 资讯每日审核发布 SOP

> 版本：V1（2026-10-12）
> 适用范围：MCU Atlas H5 资讯模块（方案 2：RSS 自动采集 + AI 整理 + 人工审核）
> 执行人：每日审核员（产品负责人指定）
> 服务器：8.137.48.145 · 部署根目录 `/www/wwwroot/mcu-atlas-news/workspace/news/pipeline`

---

## 每日流程（约 10–15 分钟）

### 1. 检查采集日志

```bash
tail -40 /var/log/mcu-atlas-capture.log
```

确认：
- `source_success: 3`（S002 The Direct / S004 Variety / S006 Disney 公告）
- `source_failed: 0`；若有失败源，记录 `source_fail_reasons` 并在当日审核时知悉覆盖缺口
- `actual_writes: 0`（采集层永不写 news.js，此为正常值）
- 日志缺失或整文件为空 → 采集未运行，先排查 cron（`systemctl status crond`、`crontab -l`、`grep mcu /etc/cron.d/mcu-atlas-capture`）

### 2. 查看待审核候选

```bash
cd /www/wwwroot/mcu-atlas-news/workspace/news/pipeline
/opt/node24/bin/node tools/gate-review.cjs list pending --date $(date +%Y%m%d)
```

输出字段：`candidate_id` / `source` / `conf`（AI 置信度，如有）/ `verification`（AI 建议八态）/ `title`。

> 候选在每日 review（AI 整理）后产生；采集当日若无候选，说明当日无新增去重后内容，直接结束当日流程。

### 3. 逐条确认（审核四问）

对每条 pending 候选核对：

| 确认项 | 判断标准 |
|---|---|
| **来源** | `source` 是否在白名单媒体（The Direct / Variety / Disney 官方等）；非权威源从严 |
| **是否官宣** | `verification` 为 `official_confirmed` 优先；`rumor` / `unverified` / `conflicting` 默认驳回或降权 |
| **是否剧透** | 涉及未上映影片关键情节、未公布角色、大结局内容的，**一律驳回**（reason 注明"剧透"） |
| **AI 摘要准确性** | 摘要与标题语义一致、无夸大、无编造型表述（AI 幻觉迹象：具体数字/引语/日期与标题不符） |

### 4. 审核操作

```bash
# 通过
/opt/node24/bin/node tools/gate-review.cjs approve <candidate_id> --operator <你的名字> --date $(date +%Y%m%d)

# 驳回（原因必填）
/opt/node24/bin/node tools/gate-review.cjs reject <candidate_id> --reason "剧透内容" --operator <你的名字> --date $(date +%Y%m%d)
```

纪律：
- approve/reject 只能人工显式执行，工具本身不做任何自动判断；
- 每次操作自动留痕 `candidates/review-history.json`（`rev-YYYYMMDD-NNN`，append-only）；
- 重复审核同一候选会被拒绝（`ALREADY_DECIDED`）；
- reject 无原因会被拒绝（fail closed）。

### 5. 生成 Delivery Preview（人工触发，非自动）

```bash
cd /www/wwwroot/mcu-atlas-news/workspace/news/pipeline
/opt/node24/bin/node runner/run-n1.cjs --mode production-delivery-preview \
  --date $(date +%Y%m%d) --operator <你的名字> --persist
```

产出：`deliveries/<runId>.delivery-preview.json`（33 字段封闭集，与 H5 news.js 键集对齐）。
复核预览内容：标题、摘要、分类、关联电影/角色/阶段 id 是否正确。

### 6. 人工授权写入 news.js（唯一发布动作）

预览确认无误后：

```bash
cd /www/wwwroot/mcu-atlas-news/workspace/news/pipeline
/opt/node24/bin/node review/run-g9-write.cjs --date $(date +%Y%m%d)
```

写入器自动执行：基线 SHA 校验（防重复写入）→ 双备份 → append-only 插入（旧条目字节不变）→ vm 重载校验。

**双人复核建议**：执行人 + 确认人各核对一次 `deliveries/*.delivery-preview.json` 后再执行写入。

写入后抽查线上：`curl -s https://mcuatlas.xyz/news.html | grep -c "news-"`（或浏览器打开资讯页确认新条目展示）。

---

## 禁止事项（任何步骤都不得违反）

1. 不得跳过 gate-review 直接改候选归档的 `gate_status`；
2. 不得为赶时间批量 approve 未逐条核对的候选；
3. 不得执行 `run-g9-write` 以外的任何 news.js 写操作；
4. 不得开启 `autoProduction` / 修改 `productionAllowed` 为 true 长期保留；
5. 不得在未核对 delivery preview 的情况下写入线上。

## 异常处理

| 现象 | 处理 |
|---|---|
| 采集日志缺失 | 检查 cron 服务与 `/etc/cron.d/mcu-atlas-capture`，手动补跑（见实施报告 §二-1 的模拟命令） |
| 某源连续失败 3 日+ | 在登记表临时禁用该源前先人工访问确认（源自身故障 vs 我方网络问题） |
| 候选归档损坏 | **不要覆盖**——工具 fail closed；从 run-history/captures 重新生成 |
| 误操作 approve/reject | 当天内可对同一候选再次操作会被拒（ALREADY_DECIDED）；需回滚时联系开发 AI 依 review-history 留痕处理 |
