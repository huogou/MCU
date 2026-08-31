# V1.2 Step2 资源接入验证：home 预览渲染 + 像素探针
import subprocess, os
from PIL import Image

CHROME = r"C:/Program Files/Google/Chrome/Application/chrome.exe"
HTML = r"D:/SEO/发挥余热/漫威电影宇宙导航/mcu-miniprogram/workspace/home_v12_preview.html"
RAW = r"D:/tmp/home_v12_raw.png"
OUT = r"D:/SEO/发挥余热/漫威电影宇宙导航/AI生成文件/小程序/V1.2首页_资源接入预览.png"

if os.path.exists(RAW):
    os.remove(RAW)
r = subprocess.run([
    CHROME, "--headless", "--disable-gpu", "--hide-scrollbars",
    "--force-device-scale-factor=1", "--window-size=375,1400",
    "--screenshot=" + RAW, HTML
], capture_output=True, text=True, timeout=90)
print("chrome rc:", r.returncode)

img = Image.open(RAW)
W, H = img.size
print("raw size:", W, "x", H)

# 裁剪内容区（去掉滚动空白）
bbox = img.convert("RGB").getbbox()
print("content bbox:", bbox)
if bbox:
    img = img.crop((bbox[0], bbox[1], bbox[2], bbox[3]))
img.save(OUT, "PNG")
print("final:", img.size)

def strip_colors(im, y0, y1):
    """横向条带的颜色桶数量（越多样=真实图内容）"""
    region = im.crop((0, y0, im.size[0], y1)).convert("RGB")
    return len(set(region.getdata()))

# 探针：旅程卡背景带（home-bg 应在上部 0~120px 左右）
print("strip journey-bg 0-100:", strip_colors(img, 0, min(100, img.size[1])))
# 热门角色头像带（找包含 4 个圆头像的带）
h = img.size[1]
for name, y0, y1 in [("journey-top", 0, 120), ("journey-full", 0, 300), ("chars-zone", max(0, h-420), h)]:
    if y0 < y1 and y1 <= h:
        print(f"strip {name} {y0}-{y1}:", strip_colors(img, y0, y1))
