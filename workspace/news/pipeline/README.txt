MCU 宇宙导航 · 资讯管道目录（workspace/news/pipeline/）
==========================================================
建立：2026-09-23（G5）
性质：**管道层**。三层数据结构（RawCapture → CandidateItem → EventCandidate）的落盘位置。
规范依据：《候选数据 Candidate Schema V1.0》（docs\产品\资讯模块\）

目录
----
  captures\    L0 RawCapture   一次采集、一个来源出口、一条原始条目
  candidates\  L1 CandidateItem 经 AI 整理后的候选条目（按 event_key 聚合前的单位）
  events\      L2 EventCandidate 由 event-merger 归并出的事件对象

落盘命名建议
------------
  captures\YYYY-MM-DD.captures.json
  candidates\YYYY-MM-DD.json
  events\YYYY-MM-DD.events.json
  编码：UTF-8（无 BOM）；格式：JSON

★ 硬约束（不可协商）
--------------------
  1. 本目录及其子目录**不得**出现在 h5\ / wechat\ / douyin\ 下。
  2. 本目录的任何字段**不得**进入 33 字段交付物（h5\data\news.js）。
  3. L0/L1/L2 **不得**产出任何状态字段：
     verification_status / status_history / status_changed_at /
     judged_by / chain_steps_hit / status_change_reason /
     status_change_evidence_url / conflict_resolved_at /
     conflict_resolved_by_evidence_url
     → 状态只能由 G1 判定器按 R8.3 重算。
  4. L0/L1/L2 **不得**产出交付物 id（news-YYYY-MM-DD-NNN）——该 id 由 G6 落库时生成。
  5. ★ 修订（2026-09-23 G5.4）：原约束「候选层不得写入任何真实网络抓取内容
     （G5 只建接口，不接网络）」**按《G5.4 生产采集稳定性验证任务书》解除**——
     真实采集内容自本阶段起可进入 L1/L2 落盘用于稳定性验证；
     硬约束 1–4 仍然全部有效（不进 h5、不进 33 字段、不产状态、不产交付物 id）。

三层对应的模块
--------------
  raw-capture.cjs      L0：从采集输入构造 RawCapture（**14 字段**；2026-09-23 按 G5 任务书由 16 修订，
                       event_key / first_publish_time 上移至 L1）
  candidate-item.cjs   L1：从 RawCapture + AI 整理结果构造 CandidateItem（**35 字段** = 14 + 21）
                       并导出 toMergerInput()：把 candidate_id 桥接为 merger 需要的 id
  capture-store.cjs    capture 归档：只追加不覆盖（G5 修订段新增）
  candidate-store.cjs  候选归档：按 registry_id+content_hash 去重（G5.4 新增）
  ..\engine\dedup\event-merger.cjs  L2：由 G4 交付，本层只消费，不修改
  ※ 注意目录关系：engine\（judge/registry/validator/dedup）与 pipeline\ 是**平级**，
    本目录模块引用引擎模块的路径为 `../engine/...`。
  ※ ★ tester 必读：候选对象的标识字段是 `candidate_id`，而 merger 读的是 `id`
    → 喂给 merger 之前**必须**经 `toMergerInput()`，否则 report_count 恒为 0。

回归基线
--------
  既有 8 项断言（411 条）必须保持全绿；本目录新增物不得改动
  G1 judge / G2 registry / G3 validator / G4 dedup 的任何代码。
