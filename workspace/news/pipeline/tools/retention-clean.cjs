/* ============================================================
 * N1.2 资讯系统 · 存储保留与自动清理工具（retention-clean）
 * ------------------------------------------------------------
 * 定位：运维看护工具，解决审计 V1.0 发现的「无界线性增长」问题。
 *   每日 cron 采集会在 captures/ 与 status/item-status/ 各永久堆积
 *   一个文件（≈190K/天），发布会在 review/backup/ 与 h5/data/ 各留
 *   一份备份。本工具按保留期/保留份数清理过期数据，使存储封顶可控。
 *
 * 默认行为：DRY-RUN（只报告，不删除）。必须显式 --apply 才真正删除。
 *
 * 安全纪律：
 *   1. 仅允许在下方 ALLOWED 目录内操作；任何待删文件的真实路径若不在
 *      允许目录内 → 拒绝（绝不删除）。
 *   2. 绝不删除线上 news.js 本身：备份类目标只匹配 backup 文件名模式，
 *      且显式排除 basename === 'news.js'。
 *   3. 日期类目标按「文件名日期优先 / mtime 兜底」判断年龄，超过保留期才删。
 *   4. 备份类目标按 mtime 倒序保留最近 N 份，剩余才删；不足 N 份不删。
 *   5. 任意检查异常即跳过该文件并告警，绝不批量误删。
 *   6. 幂等：重复运行在已清理后不再产生删除。
 *
 * 用法：
 *   node tools/retention-clean.cjs                 # DRY-RUN（默认，安全）
 *   node tools/retention-clean.cjs --apply         # 真正执行清理
 *   node tools/retention-clean.cjs --apply --captures-retention 90 --backup-keep 10
 *
 * 退出码：0 成功 / 2 参数错误
 * ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');

const PIPELINE = path.resolve(__dirname, '..');
const ROOT = path.resolve(PIPELINE, '..', '..', '..'); // 服务器 = /www/wwwroot/mcu-atlas-news（其下 h5 软链→mcu-h5）

const DAY = 86400000;

function fail(message, exitCode) {
  console.error('终止：' + message);
  process.exit(exitCode || 2);
}

function parseArgs(argv) {
  const a = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (t === '--apply') a.apply = true;
    else if (t === '--pipeline') a.pipeline = argv[++i];
    else if (t === '--root') a.root = argv[++i];
    else if (t === '--h5-data') a.h5Data = argv[++i];
    else if (t === '--captures-retention') a.capturesRetention = Number(argv[++i]);
    else if (t === '--item-status-retention') a.itemStatusRetention = Number(argv[++i]);
    else if (t === '--runtime-retention') a.runtimeRetention = Number(argv[++i]);
    else if (t === '--backup-keep') a.backupKeep = Number(argv[++i]);
    else if (t === '--help' || t === '-h') a.help = true;
    else a._.push(t);
  }
  return a;
}

function resolveTargets(a) {
  const pipeline = a.pipeline ? path.resolve(a.pipeline) : PIPELINE;
  const root = a.root ? path.resolve(a.root) : ROOT;
  const h5Data = a.h5Data ? path.resolve(a.h5Data) : path.join(root, 'h5', 'data');
  return {
    captures: path.join(pipeline, 'captures'),
    itemStatus: path.join(pipeline, 'status', 'item-status'),
    runtime: path.join(pipeline, 'runtime'),
    reviewBackup: path.join(pipeline, 'review', 'backup'),
    h5Data: h5Data,
  };
}

/* 允许操作的目录（白名单）。删除前必须验证真实路径落在此范围内。 */
function buildAllowed(t) {
  return [t.captures, t.itemStatus, t.runtime, t.reviewBackup, t.h5Data];
}

function isInside(filePath, baseDir) {
  const rel = path.relative(baseDir, filePath);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

function parseYMD(name) {
  const m = name.match(/^(\d{4})(\d{2})(\d{2})/);
  if (!m) return null;
  const y = +m[1], mo = +m[2], d = +m[3];
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const ts = Date.UTC(y, mo - 1, d);
  if (isNaN(ts)) return null;
  return ts;
}

function ageDaysFromTs(ts) {
  return (Date.now() - ts) / DAY;
}

/* ---- 清理策略定义 ---- */
function buildRules(a, t) {
  const capturesRetention = (a.capturesRetention != null && !isNaN(a.capturesRetention)) ? a.capturesRetention : 90;
  const itemStatusRetention = (a.itemStatusRetention != null && !isNaN(a.itemStatusRetention)) ? a.itemStatusRetention : 90;
  const runtimeRetention = (a.runtimeRetention != null && !isNaN(a.runtimeRetention)) ? a.runtimeRetention : 180;
  const backupKeep = (a.backupKeep != null && !isNaN(a.backupKeep)) ? a.backupKeep : 10;
  return [
    { kind: 'date', dir: t.captures, retention: capturesRetention,
      pattern: /^(\d{8})\.captures\.json$/, desc: 'captures（采集原始，按日期保留 ' + capturesRetention + ' 天）' },
    { kind: 'date', dir: t.itemStatus, retention: itemStatusRetention,
      pattern: /^(\d{8})\.item-status\.json$/, desc: 'status/item-status（采集状态，按日期保留 ' + itemStatusRetention + ' 天）' },
    { kind: 'mtime', dir: t.runtime, retention: runtimeRetention,
      pattern: null, desc: 'runtime（运行记录，按 mtime 保留 ' + runtimeRetention + ' 天）' },
    { kind: 'backup', dir: t.reviewBackup, keep: backupKeep,
      pattern: /^news\.js\./, desc: 'review/backup（发布备份，保留最近 ' + backupKeep + ' 份）' },
    { kind: 'backup', dir: t.h5Data, keep: backupKeep,
      pattern: /^news\.js\.bak-/, desc: 'h5/data（发布备份，保留最近 ' + backupKeep + ' 份）' },
  ];
}

function listFiles(dir) {
  try {
    return fs.readdirSync(dir).map(function (n) { return path.join(dir, n); });
  } catch (e) {
    if (e.code === 'ENOENT') return [];
    throw e;
  }
}

function collectDeletions(rule, allowed, now) {
  const deletions = [];
  const files = listFiles(rule.dir);
  const candidates = [];
  for (const fp of files) {
    let st;
    try { st = fs.statSync(fp); } catch (e) { continue; }
    if (!st.isFile()) continue; // 仅处理文件，绝不删目录
    const base = path.basename(fp);

    // 守卫 1：真实路径必须落在允许目录内
    if (!allowed.some(function (d) { return isInside(fp, d); })) {
      console.error('  [守卫跳过] 路径越界，拒绝：' + fp);
      continue;
    }
    // 守卫 2：绝不删 news.js 本身
    if (base === 'news.js') {
      console.error('  [守卫跳过] 线上 news.js 受保护，拒绝：' + fp);
      continue;
    }

    if (rule.kind === 'date' || rule.kind === 'mtime') {
      let ts;
      if (rule.kind === 'date') {
        const m = base.match(rule.pattern);
        if (!m) { continue; } // 名称不匹配模式 → 不处理（安全，避免误删未知文件）
        ts = parseYMD(base);
        if (ts == null) ts = st.mtimeMs; // 解析失败 → mtime 兜底
      } else {
        ts = st.mtimeMs;
      }
      const age = ageDaysFromTs(ts);
      if (age > rule.retention) {
        candidates.push({ fp: fp, age: age, ts: ts });
      }
    } else if (rule.kind === 'backup') {
      if (!rule.pattern.test(base)) { continue; } // 仅匹配备份文件名模式
      candidates.push({ fp: fp, mtime: st.mtimeMs });
    }
  }

  if (rule.kind === 'backup') {
    candidates.sort(function (x, y) { return y.mtime - x.mtime; }); // 新→旧
    if (candidates.length > rule.keep) {
      for (let i = rule.keep; i < candidates.length; i++) deletions.push(candidates[i].fp);
    }
  } else {
    for (const c of candidates) deletions.push(c.fp);
  }
  return deletions;
}

function performDelete(fp, apply) {
  if (!apply) return false;
  try {
    fs.unlinkSync(fp);
    return true;
  } catch (e) {
    console.error('  [删除失败] ' + fp + ' : ' + e.message);
    return false;
  }
}

function main() {
  const a = parseArgs(process.argv.slice(2));
  if (a.help) {
    console.log('用法：node tools/retention-clean.cjs [--apply] [--captures-retention 90] [--item-status-retention 90] [--runtime-retention 180] [--backup-keep 10] [--pipeline <dir>] [--root <dir>] [--h5-data <dir>]');
    console.log('默认 DRY-RUN（不删除）。--apply 才真正清理。');
    process.exit(0);
  }
  const t = resolveTargets(a);
  const allowed = buildAllowed(t);
  const rules = buildRules(a, t);
  const now = Date.now();

  console.log('=== MCU Atlas 资讯存储保留清理 ' + (a.apply ? '(APPLY 模式)' : '(DRY-RUN 模式，不删除)') + ' ===');
  console.log('时间：' + new Date().toISOString());
  console.log('目标：');
  for (const r of rules) console.log('  - ' + r.desc + '  @ ' + r.dir);

  let totalDeleted = 0;
  const summary = [];
  for (const rule of rules) {
    const deletions = collectDeletions(rule, allowed, now);
    let done = 0;
    for (const fp of deletions) {
      const ok = performDelete(fp, a.apply);
      if (ok || !a.apply) {
        if (a.apply && ok) done++;
        console.log((a.apply ? '  删除：' : '  [将删除] ') + fp);
      }
    }
    if (a.apply) totalDeleted += done;
    else totalDeleted += deletions.length;
    summary.push({ target: rule.desc, dir: rule.dir, wouldDelete: deletions.length, deleted: a.apply ? done : 0 });
    console.log('  → ' + (a.apply ? '实际删除 ' + done : '将删除 ' + deletions.length) + ' 个文件');
  }

  console.log('=== 汇总 ===');
  console.log(JSON.stringify({ mode: a.apply ? 'apply' : 'dry-run', time: new Date().toISOString(), total: totalDeleted, details: summary }, null, 2));
  process.exit(0);
}

main();
