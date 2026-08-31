import subprocess, os
from PIL import Image, ImageChops

CHROME = r"C:/Program Files/Google/Chrome/Application/chrome.exe"
SRC = r"D:/tmp/character_preview.html"
RAW = r"D:/tmp/character_raw.png"
OUT = r"D:/SEO/发挥余热/漫威电影宇宙导航/AI生成文件/小程序/V1.2角色详情_预览渲染.png"

# 1) Headless 渲染（375 宽，足够高以容纳整页）
subprocess.run([CHROME, "--headless", "--disable-gpu", "--no-sandbox",
                "--hide-scrollbars", "--force-device-scale-factor=1",
                "--window-size=375,4000", "--screenshot="+RAW, "file:///"+SRC],
               check=True, capture_output=True)
print("rendered raw:", RAW, os.path.getsize(RAW), "bytes")

# 2) 裁剪到内容 bbox（去除空白/默认背景外区域）
im = Image.open(RAW).convert("RGB")
bg = im.getpixel((2, 2))
# 用背景色做差异遮罩，找内容边界
diff = ImageChops.difference(im, Image.new("RGB", im.size, bg))
bbox = diff.getbbox()
if bbox:
    im2 = im.crop(bbox)
else:
    im2 = im
W, H = im2.size
print("cropped size:", W, H, "bg:", bg)

# 3) 颜色桶探针：将整图切成 24 条横带，统计每带独立颜色数
def buckets(img, step=24):
    w, h = img.size
    res = []
    for i in range(step):
        y0 = int(h*i/step); y1 = int(h*(i+1)/step)
        strip = img.crop((0, y0, w, y1))
        # 量化到 5bit/通道降低噪声
        q = strip.point(lambda p: (p//32)*32)
        cols = q.getcolors(maxcolors=1000000)
        res.append(len(cols))
    return res
counts = buckets(im2)
print("strip color-bucket counts (top->bottom):")
for i, c in enumerate(counts):
    print(f"  strip {i:2d} y[{int(H*i/24)}:{int(H*(i+1)/24)}] colors={c}")

# 判定：真实海报区域应有高颜色多样性（>800），氛围背景为低-中（<400）
maxc = max(counts); minc = min(counts)
print(f"min={minc} max={maxc}")
real_img_strips = sum(1 for c in counts if c > 800)
print("strips with real-image-level diversity (>800 colors):", real_img_strips)

# 4) 保存裁剪成品
os.makedirs(os.path.dirname(OUT), exist_ok=True)
im2.save(OUT)
print("SAVED", OUT, os.path.getsize(OUT), "bytes")
