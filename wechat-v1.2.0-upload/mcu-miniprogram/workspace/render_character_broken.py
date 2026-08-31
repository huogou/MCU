import subprocess, os
from PIL import Image, ImageChops
CHROME = r"C:/Program Files/Google/Chrome/Application/chrome.exe"
SRC = r"D:/tmp/character_preview.html"
BROKEN = r"D:/tmp/character_broken.html"
RAW = r"D:/tmp/character_broken.png"

# 故意破坏所有 CDN 图片 URL（指向拒绝连接的地址），验证"真实图片"假设
html = open(SRC, encoding="utf-8").read()
html = html.replace("https://mcu-d6gw0brqoa9521b58-1307093647.tcloudbaseapp.com",
                    "http://127.0.0.1:9")
open(BROKEN, "w", encoding="utf-8").write(html)

subprocess.run([CHROME,"--headless","--disable-gpu","--no-sandbox","--hide-scrollbars",
                "--force-device-scale-factor=1","--window-size=375,4000",
                "--screenshot="+RAW,"file:///"+BROKEN],check=True,capture_output=True)
im = Image.open(RAW).convert("RGB")
bg = im.getpixel((2,2))
diff = ImageChops.difference(im, Image.new("RGB", im.size, bg))
bbox = diff.getbbox(); im2 = im.crop(bbox) if bbox else im
W,H = im2.size
def buckets(img,step=24):
    w,h=img.size; res=[]
    for i in range(step):
        y0=int(h*i/step); y1=int(h*(i+1)/step)
        q=img.crop((0,y0,w,y1)).point(lambda p:(p//32)*32)
        res.append(len(q.getcolors(maxcolors=1000000)))
    return res
counts=buckets(im2)
print("BROKEN-URL render size:",W,H)
for i,c in enumerate(counts): print(f"  strip {i:2d} colors={c}")
print("max broken:",max(counts),"min:",min(counts))
