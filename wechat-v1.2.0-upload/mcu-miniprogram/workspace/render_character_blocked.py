import subprocess, os
from PIL import Image, ImageChops

CHROME = r"C:/Program Files/Google/Chrome/Application/chrome.exe"
SRC = r"D:/tmp/character_preview.html"
RAW = r"D:/tmp/character_blocked.png"

# 阻断所有外部网络（CDN 图片无法加载），验证"真实图片"假设
subprocess.run([CHROME, "--headless", "--disable-gpu", "--no-sandbox",
                "--hide-scrollbars", "--force-device-scale-factor=1",
                "--window-size=375,4000",
                "--host-resolver-rules=MAP * 127.0.0.1, EXCLUDE localhost",
                "--screenshot="+RAW, "file:///"+SRC],
               check=True, capture_output=True)
im = Image.open(RAW).convert("RGB")
bg = im.getpixel((2, 2))
diff = ImageChops.difference(im, Image.new("RGB", im.size, bg))
bbox = diff.getbbox()
im2 = im.crop(bbox) if bbox else im
W, H = im2.size

def buckets(img, step=24):
    w, h = img.size; res = []
    for i in range(step):
        y0 = int(h*i/step); y1 = int(h*(i+1)/step)
        strip = img.crop((0, y0, w, y1))
        q = strip.point(lambda p: (p//32)*32)
        res.append(len(q.getcolors(maxcolors=1000000)))
    return res

counts = buckets(im2)
print("BLOCKED render size:", W, H)
print("strip color-bucket counts (top->bottom):")
for i, c in enumerate(counts):
    print(f"  strip {i:2d} colors={c}")
print("max blocked:", max(counts), "min:", min(counts))
