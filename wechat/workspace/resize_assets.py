# 专项②a 图片缩放压缩（57MB → ~2MB）
# 规格：头像 300×300(JPEG85) / home-bg 750×500(80) / phase 750×400(80,cover) /
#       hero-banner 750×420(80,cover) / entry 400×300(80)
# 覆盖原文件（同路径，visuals.js 引用不变）；保持比例 + center-crop
import os
from PIL import Image

ROOT = r"D:\SEO\发挥余热\漫威电影宇宙导航\mcu-miniprogram\assets"

def cover_resize(img, tw, th):
    """等比缩放至覆盖目标尺寸后中心裁剪"""
    sw, sh = img.size
    scale = max(tw / sw, th / sh)
    nw, nh = int(round(sw * scale)), int(round(sh * scale))
    img = img.resize((nw, nh), Image.LANCZOS)
    x = (nw - tw) // 2
    y = (nh - th) // 2
    return img.crop((x, y, x + tw, y + th))

def fit_resize(img, tw, th):
    """等比缩放至完全适配（不裁剪，比例一致时用）"""
    return img.resize((tw, th), Image.LANCZOS)

JOBS = [
    # (相对路径, 目标宽, 目标高, 质量, 模式)
    ("avatars", 300, 300, 85, "fit"),
    ("backgrounds/home-bg.jpg", 750, 500, 80, "fit"),
    ("phases", 750, 400, 80, "cover"),
    ("hero/hero-banner.jpg", 750, 420, 80, "cover"),
    ("entries", 400, 300, 80, "fit"),
]

report = []  # (file, orig_bytes, new_bytes, new_size)
total_orig = 0
total_new = 0

for rel, tw, th, q, mode in JOBS:
    base = os.path.join(ROOT, rel)
    if os.path.isdir(base):
        files = [f for f in os.listdir(base) if f.lower().endswith(('.jpg', '.jpeg', '.png'))]
    else:
        files = [os.path.basename(base)]
    for fn in sorted(files):
        src = os.path.join(base, fn)
        try:
            img = Image.open(src)
        except Exception as e:
            print("SKIP", src, e)
            continue
        orig_bytes = os.path.getsize(src)
        total_orig += orig_bytes
        if mode == "fit":
            out = fit_resize(img, tw, th)
        else:
            out = cover_resize(img, tw, th)
        # 输出到同路径覆盖（保持格式 jpg）
        out = out.convert("RGB")
        out.save(src, "JPEG", quality=q, optimize=True, progressive=True)
        new_bytes = os.path.getsize(src)
        total_new += new_bytes
        report.append((src.split("assets")[1], orig_bytes, new_bytes, f"{out.size[0]}x{out.size[1]}"))
        print(f"{src.split(chr(92))[-1]:22s} {orig_bytes/1024:8.1f}KB -> {new_bytes/1024:6.1f}KB  {out.size[0]}x{out.size[1]}")

print("\n=== 汇总 ===")
print(f"原始总大小: {total_orig/1024/1024:.2f} MB")
print(f"优化后总大小: {total_new/1024/1024:.2f} MB")
print(f"压缩比: {total_new/total_orig*100:.1f}%")
