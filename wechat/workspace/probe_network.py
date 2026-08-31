import subprocess, os
from PIL import Image, ImageChops
CHROME = r"C:/Program Files/Google/Chrome/Application/chrome.exe"
CDN = "https://mcu-d6gw0brqoa9521b58-1307093647.tcloudbaseapp.com/assets/posters/iron-man.jpg"
html = f'<!DOCTYPE html><html><body style="margin:0"><img src="{CDN}" style="width:200px;height:300px;display:block"></body></html>'
open(r"D:/tmp/net_test.html","w",encoding="utf-8").write(html)
RAW = r"D:/tmp/net_test.png"
subprocess.run([CHROME,"--headless","--disable-gpu","--no-sandbox","--hide-scrollbars",
                "--force-device-scale-factor=1","--window-size=200,300",
                "--screenshot="+RAW,"file:///D:/tmp/net_test.html"],check=True,capture_output=True)
im = Image.open(RAW).convert("RGB")
# 探针：图像区域应是一张照片（颜色极多）；若加载失败，区域为空白/破裂图标（极少颜色）
q = im.point(lambda p:(p//16)*16)
cols = q.getcolors(maxcolors=2000000)
print("net_test image size:", im.size, "distinct quantized colors:", len(cols))
# 取中心 100x100 统计
cx,cy=im.size[0]//2,im.size[1]//2
center=im.crop((cx-50,cy-50,cx+50,cy+50))
qc=center.point(lambda p:(p//16)*16)
print("center 100x100 distinct colors:", len(qc.getcolors(maxcolors=2000000)))
