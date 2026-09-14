# -*- coding: utf-8 -*-
"""小程序视觉资源（visuals.js）CDN 全量验证。
- 解析 shared/data/visuals.js 生成的全部 /assets/ 路径
- 校验拼接规范：必须以 /assets/ 开头、无双斜杠、无重复域名、无旧域残留
- 逐条对新域发起 HTTP 请求，确认 200
用法：python workspace/verify-mini-cdn.py
"""
import re
import ssl
import urllib.request

ROOT = r'D:\SEO\发挥余热\漫威电影宇宙导航'
FILES = ['shared/data/visuals.js', 'wechat/data/visuals.js', 'douyin/data/visuals.js']
NEW = 'https://mcu.yaokaixin.top'
OLD = 'mcu.yaoqiang.xin'

paths = {}
dup = {}
for f in FILES:
    src = open(ROOT + '\\' + f.replace('/', '\\'), encoding='utf-8').read()
    # 旧域残留（排除注释行）
    for i, line in enumerate(src.splitlines(), 1):
        if OLD in line and not line.strip().startswith(('*', '/*', '//')):
            print('[旧域残留·运行时] %s:%d: %s' % (f, i, line.strip()[:100]))
    for m in re.finditer(r"'(/assets/[^']+)'", src):
        p = m.group(1)
        paths.setdefault(p, set()).add(f)

print('=== 1. 路径拼接规范检查（共 %d 条唯一路径）===' % len(paths))
bad = [p for p in paths if not p.startswith('/assets/')
       or '//' in p[1:]
       or 'http' in p
       or OLD in p
       or 'mcu.yaokaixin.top' in p]
if bad:
    for p in bad:
        print('  [拼接异常]', p)
else:
    print('  全部以 /assets/ 开头、无双斜杠、无重复域名、无旧域残留 ✓')

print()
print('=== 2. 逐条 HTTP 验证（新域）===')
ctx = ssl.create_default_context()
fail, ok = [], 0
bycat = {}
for p in sorted(paths):
    cat = p.split('/')[2] if len(p.split('/')) > 2 else '?'
    bycat[cat] = bycat.get(cat, 0) + 1
    try:
        with urllib.request.urlopen(urllib.request.Request(NEW + p,
                headers={'User-Agent': 'cdn-verify/1'}), timeout=20, context=ctx) as r:
            if r.status == 200:
                ok += 1
            else:
                fail.append((p, r.status))
    except urllib.error.HTTPError as e:
        fail.append((p, e.code))
    except Exception as e:
        fail.append((p, 'ERR:' + type(e).__name__))

print('  按类别分布:', dict(sorted(bycat.items())))
print('  通过 %d / %d' % (ok, len(paths)))
if fail:
    print('  失败清单:')
    for p, why in fail:
        print('    [%s] %s' % (why, p))
else:
    print('  无失败 ✓')

print()
print('=== 3. 三份源码一致性（CDN 常量）===')
for f in FILES:
    src = open(ROOT + '\\' + f.replace('/', '\\'), encoding='utf-8').read()
    m = re.search(r"const CDN = '([^']+)'", src)
    print('  %-28s -> %s' % (f, m.group(1) if m else '(未找到)'))
