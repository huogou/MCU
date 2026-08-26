# -*- coding: utf-8 -*-
"""V1.2 Step4 全局统一 · 安全 Token 化脚本（Work/开发 AI）· 全局版
规则：仅替换与 app.wxss Token 值【完全相等】的原始 rpx，像素零变化。
- border-radius: Nrpx -> var(--radius-*)  仅单值
- font-size:   Nrpx   -> var(--fs-*)
- box-shadow:  <精确 Token 字符串> -> var(--shadow-*)
- 间距 padding/margin/gap 内 Nrpx -> var(--space-*)（仅无歧义值 8/20/28/56/72；36 排除=space-lg/page-x 双映射）
- 多值 border-radius（如 32rpx 32rpx 0 0）、无 Token 映射值（10/4/2/44/40/60/64rpx 等）一律保留。
- Icon 属设计侧，不处理。
"""
import re, os, glob

ROOT = r"D:\SEO\发挥余热\漫威电影宇宙导航\mcu-miniprogram\pages"
PAGES = sorted(glob.glob(os.path.join(ROOT, "*", "*.wxss")))

RADIUS = {12: "sm", 16: "md", 20: "lg", 32: "xl", 999: "full"}
FONT   = {56: "display", 44: "display-sm", 36: "title", 28: "body", 24: "caption", 22: "mini"}
SPACE  = {8: "xs", 20: "sm", 28: "md", 56: "xl", 72: "2xl"}
SHADOW = {
    "0 4rpx 16rpx rgba(0,0,0,0.3)": "--shadow-card",
    "0 8rpx 32rpx rgba(0,0,0,0.4)": "--shadow-hero",
    "0 8rpx 24rpx rgba(242,178,51,0.12)": "--glow-gold",
    "0 12rpx 40rpx rgba(242,178,51,0.20)": "--glow-gold-strong",
}

re_radius = re.compile(r"border-radius:\s*(\d+)rpx\s*;")
re_font   = re.compile(r"font-size:\s*(\d+)rpx\s*;")
re_space  = re.compile(r"\b(8|20|28|56|72)rpx")
re_space_line = re.compile(r"(?:padding|margin|gap)(?:-[a-z]+)?\s*:")

def tokenize(text):
    log = []
    def rradius(m):
        n = int(m.group(1))
        if n in RADIUS:
            log.append(f"radius {n}rpx -> --radius-{RADIUS[n]}")
            return f"border-radius: var(--radius-{RADIUS[n]});"
        return m.group(0)
    def rfont(m):
        n = int(m.group(1))
        if n in FONT:
            log.append(f"font {n}rpx -> --fs-{FONT[n]}")
            return f"font-size: var(--fs-{FONT[n]});"
        return m.group(0)
    out = re_radius.sub(rradius, text)
    out = re_font.sub(rfont, out)
    for raw, tok in SHADOW.items():
        if raw in out:
            out = out.replace(f"box-shadow: {raw};", f"box-shadow: var({tok});")
            log.append(f"shadow -> var({tok})")
    # 间距：仅 padding/margin/gap 行内、无歧义值（不锚定行首，兼容单行多属性）
    lines = out.split("\n")
    for i, line in enumerate(lines):
        if re_space_line.search(line) and re_space.search(line):
            new = re_space.sub(lambda m: f"var(--space-{SPACE[int(m.group(1))]})", line)
            if new != line:
                lines[i] = new
                log.append(f"space -> {line.strip()[:46]}...")
    out = "\n".join(lines)
    return out, log

total = 0
for p in PAGES:
    src = open(p, encoding="utf-8").read()
    dst, log = tokenize(src)
    if src != dst:
        open(p, "w", encoding="utf-8").write(dst)
        rel = os.path.relpath(p, ROOT)
        print(f"\n=== {rel} ===  ({len(log)} 处)")
        for l in log:
            print("   ", l)
        total += len(log)
    else:
        print(f"=== {os.path.relpath(p, ROOT)} === 无匹配")
print(f"\n>>> 全局共 {total} 处安全 Token 化")
