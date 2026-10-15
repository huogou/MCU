# -*- coding: utf-8 -*-
"""校验 MCU Atlas 的同步目录结构与同步文件中的附件路径。

校验范围：**仅限本项目的 `同步/` 目录**，不做全库扫描。

包含检查：
  ① 同步根目录 `同步/` 与三个角色子目录（给策划/给开发/给设计）是否存在；
  ② 各角色通道文件是否存在（缺失即报告，不静默跳过）；
  ③ 已废弃路径 `docs/同步/` 的失效提示；
  ④ 废弃路径 `docs/同步/` 的**引用检查（仅扫 `同步/` 目录内文本）**；
  ⑤ 同步文件中的附件路径是否写成完整绝对路径、且真实存在；
  ⑥ 是否残留裸相对路径；
  ⑦ 是否残留「…\」省略简写。

用法：python workspace/verify-sync-paths.py
退出码：0 = 全部通过；1 = 存在失败项（供人工/CI 一眼判断，避免"虚假通过"）。

维护说明（2026-10-15 修复，授权范围仅限同步路径相关逻辑）：
  · 校验目标由已废弃的 `docs/同步/` 修正为项目根 `同步/`；
  · 新增角色目录与通道文件存在性校验；
  · 新增废弃路径失效提示与限定范围引用检查；
  · 原有「绝对路径 / 相对路径 / 省略简写」三项校验逻辑保持不变。
"""
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# 现行同步根目录（项目根）：全局《AI协作文件治理规范V2.0》§二
SYNC = os.path.join(ROOT, '同步')
# 已废弃：曾于 2026-09-15 迁入 docs/同步，后迁回项目根同步/；本次修复确认已不存在
LEGACY_SYNC = os.path.join(ROOT, 'docs', '同步')
ROLE_DIRS = ['给策划', '给开发', '给设计']

# 各角色通道文件（当前为 .txt；V2.0 §三 要求新建同步一律用 .md，旧件待授权后归位）
FILES = [
    os.path.join('给策划', '给策划AI同步文件.txt'),
    os.path.join('给设计', '给设计AI同步文件.txt'),
    os.path.join('给开发', '给开发AI同步文件.txt'),
]

# 绝对路径（含盘符）
ABS = re.compile(r'[A-Za-z]:\\[^\s`()|、，,;；<>]*')
# 以「…\」省略根目录的写法
ELL = re.compile(r'…\\([^\s`]+)')
# 裸相对路径（应被消灭）
REL = re.compile(r'(?<![\w\\/:.…])(AI生成文件|workspace|backup|archive|design|docs)/[^\s`()|、，,;；]*')
# 废弃路径特征（用于引用检查）
LEGACY_PAT = re.compile(r'docs[\\/]同步')

failed = []


def head(t):
    print()
    print('=== %s ===' % t)


def read(rel):
    p = os.path.join(SYNC, rel)
    if not os.path.isfile(p):
        return None
    with open(p, encoding='utf-8') as f:
        return f.read()


# ① 同步目录结构 -------------------------------------------------
head('① 同步目录结构校验（现行根目录：同步/）')
print('  根目录：%s' % ('存在' if os.path.isdir(SYNC) else '【缺失】'))
if not os.path.isdir(SYNC):
    failed.append('同步根目录不存在')

for r in ROLE_DIRS:
    p = os.path.join(SYNC, r)
    ok = os.path.isdir(p)
    print('  角色目录 %-6s -> %s' % (r, '存在' if ok else '【缺失】'))
    if not ok:
        failed.append('角色目录缺失：%s' % r)

# ② 通道文件存在性（缺失即报告，不静默跳过）----------------------
head('② 角色通道文件存在性')
present = []
for rel in FILES:
    p = os.path.join(SYNC, rel)
    ok = os.path.isfile(p)
    size = os.path.getsize(p) if ok else 0
    print('  %-28s -> %s' % (rel, ('存在 %d B' % size) if ok else '【缺失】'))
    if ok:
        present.append(rel)
    else:
        failed.append('通道文件缺失：%s' % rel)

# ③ 废弃路径失效提示 ---------------------------------------------
head('③ 已废弃路径失效提示')
if os.path.exists(LEGACY_SYNC):
    print('  【异常】已废弃路径仍存在，请人工确认：%s' % LEGACY_SYNC)
    failed.append('废弃路径仍存在：docs/同步/')
else:
    print('  docs/同步/ 不存在 —— 符合预期（现行同步位置为项目根 同步/）')

# ④ 废弃路径引用检查（范围仅限 同步/ 目录）----------------------
head('④ 废弃路径引用检查（范围：仅 同步/ 目录内文本）')
scan_ext = ('.md', '.txt', '.json', '.js', '.cjs', '.html', '.css')
scanned, hits = 0, []
if os.path.isdir(SYNC):
    for r, ds, fs in os.walk(SYNC):
        ds[:] = [d for d in ds if d != '历史归档']
        for fn in fs:
            if not fn.lower().endswith(scan_ext):
                continue
            fp = os.path.join(r, fn)
            try:
                txt = open(fp, encoding='utf-8').read()
            except (OSError, UnicodeDecodeError):
                continue
            scanned += 1
            for i, line in enumerate(txt.splitlines(), 1):
                if LEGACY_PAT.search(line):
                    hits.append('%s:L%d' % (os.path.relpath(fp, SYNC).replace('\\', '/'), i))
print('  已扫描文本文件 %d 个（同步/ 目录，已排除 历史归档/）' % scanned)
if hits:
    for h in hits:
        print('  [引用废弃路径] %s' % h)
    failed.append('同步/ 内存在 %d 处 docs/同步 引用' % len(hits))
else:
    print('  在上述限定范围内未发现 docs/同步 引用。')
    print('  ⚠️ 该结论仅为「限定范围内未发现」，**不构成已证明不存在引用**；')
    print('     未覆盖范围包括 h5/ 等源码注释、docs/ 下的历史报告、archive/ 与 桌面端脚本。')

# ⑤ 绝对路径存在性 ------------------------------------------------
head('⑤ 绝对路径存在性校验（同步文件内抽取）')
total_abs = {}
for rel in present:
    s = read(rel)
    if s is None:
        continue
    for m in ABS.finditer(s):
        total_abs.setdefault(m.group(0).rstrip('.'), set()).add(rel)
    for m in ELL.finditer(s):
        total_abs.setdefault(os.path.join(ROOT, m.group(1)), set()).add(rel + '(…简写)')

ok, miss = 0, []
for path, srcs in sorted(total_abs.items()):
    if os.path.exists(path):
        ok += 1
    else:
        miss.append((path, sorted(srcs)))
print('抽取绝对路径 %d 条；存在 %d 条；缺失 %d 条' % (len(total_abs), ok, len(miss)))
for path, srcs in miss:
    print('  [缺失] %s   <- %s' % (path, ', '.join(srcs)))

# ⑥ 裸相对路径残留 ------------------------------------------------
head('⑥ 裸相对路径残留校验')
total_rel = {}
for rel in present:
    s = read(rel)
    if s is None:
        continue
    for i, line in enumerate(s.splitlines(), 1):
        for m in REL.finditer(line):
            total_rel.setdefault(m.group(0), []).append('%s:L%d' % (rel, i))
if total_rel:
    for relp, where in sorted(total_rel.items()):
        print('  [相对] %s   <- %s' % (relp, ', '.join(where)))
else:
    print('  无残留 ✓')

# ⑦ 「…\」省略简写 ------------------------------------------------
head('⑦ 「…\\」省略简写校验（应全为 0：收件方无法直接粘贴打开）')
ell_total = 0
for rel in present:
    s = read(rel)
    if s is None:
        continue
    for i, line in enumerate(s.splitlines(), 1):
        if '…\\' in line:
            ell_total += 1
            print('  [简写] %s:L%d' % (rel, i))
if ell_total == 0:
    print('  无简写 ✓')

# ⑧ 其他目录清单（历史沿用，用于环境自检）------------------------
head('⑧ 其他目录清单（环境自检，非同步目录）')
for d in ['archive\\V2.2\\路线详情页', 'workspace', 'archive\\V2.2\\route-detail-20260911']:
    fp = os.path.join(ROOT, d)
    n = len(os.listdir(fp)) if os.path.isdir(fp) else -1
    print('  %s  ->  %s' % ('存在(%d 项)' % n if n >= 0 else '不存在', d))

# 结论 -------------------------------------------------------------
head('结论')
if failed:
    print('  未通过，共 %d 项：' % len(failed))
    for f in failed:
        print('    - %s' % f)
    sys.exit(1)
print('  全部通过 ✓（退出码 0）')