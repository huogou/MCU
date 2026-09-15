# -*- coding: utf-8 -*-
"""校验同步文件中的附件路径：① 是否都写成了完整绝对路径；② 路径是否真实存在。
用法：python workspace/verify-sync-paths.py
"""
import os
import re

ROOT = r'D:\SEO\发挥余热\漫威电影宇宙导航'
SYNC = os.path.join(ROOT, 'docs', '同步')  # 2026-09-15 目录整理：同步文件已迁至 docs/同步/
FILES = ['给设计AI同步文件.txt', '给策划AI同步文件.txt',
         '给开发AI同步文件.txt']

# 绝对路径（含盘符）
ABS = re.compile(r'[A-Za-z]:\\[^\s`()|、，,;；<>]*')
# 以「…\」省略根目录的写法
ELL = re.compile(r'…\\([^\s`]+)')
# 裸相对路径（应被消灭）
REL = re.compile(r'(?<![\w\\/:.…])(AI生成文件|workspace|backup|archive|design|docs)/[^\s`()|、，,;；]*')

total_abs, total_rel = {}, {}
for f in FILES:
    p = os.path.join(SYNC, f)
    if not os.path.exists(p):
        continue
    s = open(p, encoding='utf-8').read()
    for m in ABS.finditer(s):
        total_abs.setdefault(m.group(0).rstrip('.'), set()).add(f)
    for m in ELL.finditer(s):
        total_abs.setdefault(os.path.join(ROOT, m.group(1)), set()).add(f + '(…简写)')
    for i, line in enumerate(s.splitlines(), 1):
        for m in REL.finditer(line):
            total_rel.setdefault(m.group(0), []).append('%s:L%d' % (f, i))

print('=== 绝对路径存在性校验 ===')
ok, miss = 0, []
for path, srcs in sorted(total_abs.items()):
    # 目录也算存在
    if os.path.exists(path):
        ok += 1
    else:
        miss.append((path, sorted(srcs)))
print('抽取绝对路径 %d 条；存在 %d 条；缺失 %d 条' % (len(total_abs), ok, len(miss)))
for path, srcs in miss:
    print('  [缺失] %s   <- %s' % (path, ', '.join(srcs)))

print()
print('=== 裸相对路径残留校验 ===')
if total_rel:
    for rel, where in sorted(total_rel.items()):
        print('  [相对] %s   <- %s' % (rel, ', '.join(where)))
else:
    print('  无残留 ✓')

print()
print('=== 「…\\」省略简写校验（应全为 0：收件方无法直接粘贴打开）===')
ell_total = 0
for f in FILES:
    p = os.path.join(SYNC, f)
    if not os.path.exists(p):
        continue
    for i, line in enumerate(open(p, encoding='utf-8').read().splitlines(), 1):
        if '…\\' in line:
            ell_total += 1
            print('  [简写] %s:L%d' % (f, i))
if ell_total == 0:
    print('  无简写 ✓')

print()
print('=== 目录清单 ===')
for d in ['archive\\V2.2\\路线详情页', 'workspace', 'archive\\V2.2\\route-detail-20260911',
          'docs\\同步\\历史归档\\2026-09-11']:
    fp = os.path.join(ROOT, d)
    n = len(os.listdir(fp)) if os.path.isdir(fp) else -1
    print('  %s  ->  %s' % ('存在(%d 项)' % n if n >= 0 else '不存在', d))
