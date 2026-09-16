# -*- coding: utf-8 -*-
"""H5 新域名切换后的端到端验证（严格校验证书链与主机名）。
用法：python workspace/verify-domain-switch.py
"""
import ssl
import urllib.request

CHECKS = [
    ('https://mcuatlas.xyz/', 'strict'),
    ('https://mcuatlas.xyz/index.html', 'strict'),
    ('https://mcuatlas.xyz/routes.html', 'strict'),
    ('https://mcuatlas.xyz/movie.html?id=iron-man', 'strict'),
    ('https://mcuatlas.xyz/assets/css/style.css', 'strict'),
    ('https://mcuatlas.xyz/assets/posters/iron-man.jpg', 'strict'),
    ('https://mcuatlas.xyz/route-detail.html?id=newcomer', 'strict'),
    # 旧域名与博客：必须零影响
    ('https://mcu.yaoqiang.xin/', 'strict'),
    ('https://mcu.yaoqiang.xin/assets/posters/iron-man.jpg', 'strict'),
    ('https://yaoqiang.xin/', 'lenient'),
    ('https://yaokaixin.top/', 'lenient'),
]

print('=== HTTPS 校验（strict = 校验证书链与主机名）===')
for url, mode in CHECKS:
    ctx = ssl.create_default_context()
    if mode != 'strict':
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'switch-verify/1.0'})
        with urllib.request.urlopen(req, timeout=15, context=ctx) as r:
            body = r.read(120)
            note = ''
            if url.endswith('/'):
                note = body.decode('utf-8', 'ignore').replace('\n', ' ')[:60]
            print('%-58s -> %s  %s' % (url, r.status, note))
    except urllib.error.HTTPError as e:
        print('%-58s -> HTTP %s (%s)' % (url, e.code, e.reason))
    except Exception as e:
        print('%-58s -> ERR %s: %s' % (url, type(e).__name__, str(e)[:70]))

print()
print('=== HTTP → HTTPS 跳转检查 ===')
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *a, **k):
        return None


opener = urllib.request.build_opener(NoRedirect)
for url in ['http://mcuatlas.xyz/', 'http://mcu.yaoxin.top/'.replace('yaoxin', 'yaokaixin')]:
    try:
        r = opener.open(urllib.request.Request(url, headers={'User-Agent': 'v/1'}), timeout=12)
        print('%-40s -> %s' % (url, r.status))
    except urllib.error.HTTPError as e:
        print('%-40s -> %s  Location: %s' % (url, e.code, e.headers.get('Location')))

print()
print('=== 新域名证书信息 ===')
try:
    ctx = ssl.create_default_context()
    with ctx.wrap_socket(__import__('socket').socket(), server_hostname='mcuatlas.xyz') as s:
        s.settimeout(12)
        s.connect(('8.137.48.145', 443))
        c = s.getpeercert()
        subj = dict(x[0] for x in c['subject'])
        iss = dict(x[0] for x in c['issuer'])
        print('  CN       :', subj.get('commonName'))
        print('  SAN      :', [v for k, v in c.get('subjectAltName', []) if k == 'DNS'])
        print('  Issuer   :', iss.get('organizationName'), '/', iss.get('commonName'))
        print('  有效期至 :', c.get('notAfter'))
        print('  校验结果 : 通过（严格模式握手成功）')
except Exception as e:
    print('  证书校验失败:', type(e).__name__, e)
