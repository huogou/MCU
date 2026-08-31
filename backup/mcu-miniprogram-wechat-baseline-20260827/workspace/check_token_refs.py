# -*- coding: utf-8 -*-
"""校验：所有页面 wxss 的 var(--xxx) 引用必须在 app.wxss 有定义。"""
import re, os, glob

ROOT = r"D:\SEO\发挥余热\漫威电影宇宙导航\mcu-miniprogram"
app = open(os.path.join(ROOT, "app.wxss"), encoding="utf-8").read()
defined = set(re.findall(r"(--[a-zA-Z0-9-]+)\s*:", app))
pages = sorted(glob.glob(os.path.join(ROOT, "pages", "*", "*.wxss")))

bad = []
total_refs = 0
for p in pages:
    txt = open(p, encoding="utf-8").read()
    refs = re.findall(r"var\((--[a-zA-Z0-9-]+)\)", txt)
    total_refs += len(refs)
    for r in refs:
        if r not in defined:
            bad.append((os.path.relpath(p, ROOT), r))

print(f"app.wxss 已定义 Token 数: {len(defined)}")
print(f"页面 var() 引用总数: {total_refs}")
if bad:
    print(">>> 悬空引用（错误）:")
    for f, r in bad:
        print(f"   {f}: {r}")
    raise SystemExit(1)
else:
    print(">>> 全部 var() 引用均能在 app.wxss 解析，无悬空引用 ✅")
