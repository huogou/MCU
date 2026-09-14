# -*- coding: utf-8 -*-
"""生产部署验证（新域名 + 旧域名对照），校验状态码与关键版本标记。
用法：python workspace/verify-deploy.py
"""
import ssl
import urllib.request

NEW = 'https://mcu.yaokaixin.top'
OLD = 'https://mcu.yaoqiang.xin'

PAGES = ['/', '/index.html', '/routes.html', '/movie.html?id=iron-man', '/next.html',
         '/map.html', '/route-detail.html?id=newcomer', '/route-detail.html?id=release',
         '/route-detail.html?id=chrono',
         '/assets/css/style.css', '/assets/css/v2.css', '/assets/js/app.js',
         '/assets/js/components.js', '/data/routes.js', '/data/upcoming.js',
         '/assets/posters/iron-man.jpg', '/assets/stills/iron-man.jpg',
         '/assets/miniprogram/qrcode.png',
         # 应已清除
         '/review/', '/project.config.json', '/_redirects']


def get(url, timeout=20):
    ctx = ssl.create_default_context()
    req = urllib.request.Request(url, headers={'User-Agent': 'deploy-verify/1.0'})
    try:
        with urllib.request.urlopen(req, timeout=timeout, context=ctx) as r:
            return r.status, r.read()
    except urllib.error.HTTPError as e:
        return e.code, b''
    except Exception as e:
        return 'ERR:' + type(e).__name__, b''


print('=== 新域名 mcu.yaokaixin.top ===')
for p in PAGES:
    code, body = get(NEW + p)
    print('  %-42s -> %s' % (p, code))

print()
print('=== 版本标记核对（新域名实际内容）===')
MARK = [
    ('/index.html', b'v2-hero', 'V2.0 首页组件容器'),
    ('/index.html', b'route-detail.html?id=', 'V2.2 首页入口联动'),
    ('/index.html', b'see-slot' if False else b'seen-slot', 'V2.1 已看列表槽位'),
    ('/assets/css/style.css', b'#080B12', 'Token 统一（#080B12）'),
    ('/assets/css/style.css', b'#F2B233', 'Token 统一（#F2B233）'),
    ('/assets/css/v2.css', b'V2.2 \xe8\xa7\x82\xe5\xbd\xb1\xe8\xb7\xaf\xe7\xba\xbf\xe8\xaf\xa6\xe6\x83\x85\xe9\xa1\xb5'.decode('utf-8').encode(), 'v2.css 含 route-detail 样式块'),
    ('/route-detail.html', b'rd-hero', 'route-detail 六大模块'),
    ('/route-detail.html', b'routes.html?r=', 'route-detail 内「返回路线」指向总览页'),
    ('/assets/js/app.js', b"'route-detail.html': ['id']", 'app.js canonical KEEP 表'),
    ('/data/routes.js', b'newcomer', 'routes.js 路线数据'),
]
for p, needle, label in MARK:
    code, body = get(NEW + p)
    ok = needle in body if isinstance(body, bytes) else False
    print('  %-42s %s  %s' % (p, '命中' if ok else '未命中', label))

print()
print('=== 旧域名 mcu.yaoqiang.xin（当前仍在线）===')
for p in ['/', '/route-detail.html?id=newcomer', '/assets/css/v2.css', '/index.html']:
    code, body = get(OLD + p)
    print('  %-42s -> %s' % (p, code))
code, body = get(OLD + '/index.html')
print('  旧站 index.html 是否含 v2-hero:', b'v2-hero' in body)
