# -*- coding: utf-8 -*-
"""打包 H5 发布物：仅收集线上需要的文件，排除开发残留。
用法：python workspace/build-h5-release.py
产物：%TEMP%/mcu-h5-release.tar.gz
"""
import os
import tarfile
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'h5')

# 线上不需要 / 不应公开的文件与目录
EXCLUDE_DIRS = {'review'}
EXCLUDE_FILES = {
    'project.config.json',          # 微信开发者工具配置
    'project.private.config.json',  # 同上（可能含本地路径）
    'workspace-tokenize-map6.js',   # 开发期一次性脚本
    '_redirects',                   # Cloudflare Pages 专用，nginx 无效
}

out = os.path.join(tempfile.gettempdir(), 'mcu-h5-release.tar.gz')
kept, skipped = [], []

with tarfile.open(out, 'w:gz') as tar:
    for root, dirs, files in os.walk(SRC):
        dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]
        for f in files:
            fp = os.path.join(root, f)
            rel = os.path.relpath(fp, SRC).replace('\\', '/')
            if f in EXCLUDE_FILES:
                skipped.append(rel)
                continue
            tar.add(fp, arcname=rel)
            kept.append(rel)

print('打包完成:', out, '大小 %.1f KB' % (os.path.getsize(out) / 1024))
print('收录 %d 个文件' % len(kept))

top = {}
for r in kept:
    top[r.split('/')[0]] = top.get(r.split('/')[0], 0) + 1
print('顶层分布:', dict(sorted(top.items())))
print()
print('已排除（开发残留）:')
for s in sorted(skipped):
    print('  -', s)
print()
print('收录清单:')
for r in sorted(kept):
    print('   ', r)
