# -*- coding: utf-8 -*-
"""H5 域名切换前置勘察：权威 DNS 解析 + 各域名实际服务状态。
用法：python workspace/domain-recon.py
"""
import json
import ssl
import urllib.parse
import urllib.request

DOH = [
    ('AliDNS', 'https://223.5.5.5/resolve'),
    ('DNSPod', 'https://119.29.29.29/d'),
]
NAMES = ['yaokaixin.top', 'www.yaokaixin.top', 'mcuatlas.xyz',
         'mcu.mcuatlas.xyz', 'mcu.yaoqiang.xin', 'yaoqiang.xin']


def doh(name, typ='A'):
    """用阿里 DoH 取权威解析（IP 直连，不走本地 DNS）。"""
    q = urllib.parse.urlencode({'name': name, 'type': typ})
    req = urllib.request.Request('https://223.5.5.5/resolve?' + q,
                                 headers={'accept': 'application/dns-json'})
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    with urllib.request.urlopen(req, timeout=8, context=ctx) as r:
        return json.loads(r.read().decode('utf-8'))


print('=== 权威 DoH 解析（AliDNS 223.5.5.5）===')
for n in NAMES:
    try:
        for t in ('A', 'AAAA'):
            d = doh(n, t)
            ans = d.get('Answer') or []
            vals = [a.get('data') for a in ans if a.get('type') in (1, 5, 28)]
            if t == 'A':
                print('%-22s A   -> %s   (Status=%s)' % (n, vals or '无记录', d.get('Status')))
    except Exception as e:
        print('%-22s 查询失败: %s' % (n, e))

print()
print('=== NS 记录（判断 DNS 托管在哪）===')
for n in ['yaokaixin.top', 'mcuatlas.xyz', 'yaoqiang.xin']:
    try:
        d = doh(n, 'NS')
        vals = [a.get('data') for a in (d.get('Answer') or []) if a.get('type') == 2]
        print('%-18s NS -> %s' % (n, vals or '无记录'))
    except Exception as e:
        print('%-18s NS 查询失败: %s' % (n, e))

print()
print('=== 各域名 HTTP/HTTPS 实际响应 ===')
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE
for url in ['https://mcu.yaoqiang.xin/', 'http://yaokaixin.top/', 'https://yaokaixin.top/',
            'http://www.yaokaixin.top/', 'https://www.yaokaixin.top/',
            'http://mcuatlas.xyz/', 'https://mcuatlas.xyz/',
            'https://mcu.yaoqiang.xin/assets/posters/iron-man.jpg']:
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'recon/1.0'})
        with urllib.request.urlopen(req, timeout=10, context=ctx) as r:
            body = r.read(300).decode('utf-8', 'ignore').replace('\n', ' ')[:90]
            print('%-52s -> %s %s | %s' % (url, r.status, r.headers.get('Server', ''), body[:70]))
    except Exception as e:
        code = getattr(e, 'code', None)
        print('%-52s -> %s %s' % (url, code if code else 'ERR', type(e).__name__ + ':' + str(e)[:70]))
