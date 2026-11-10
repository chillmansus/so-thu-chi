"""Draws the app icons into src/icons/: a three-part ring (the pie chart) with a "đ" in the middle."""
import math
import os
from PIL import Image, ImageDraw, ImageFilter, ImageFont

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "src", "icons")
BG = (11, 10, 9)
IVORY = (244, 239, 231)
PARTS = [((245, 167, 66), 0.46), ((47, 196, 168), 0.32), ((232, 121, 201), 0.22)]  # color, share
SS = 4  # draw big, then shrink for smooth edges


def font(size):
    for name in ("segoeuib.ttf", "arialbd.ttf", "DejaVuSans-Bold.ttf"):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            pass
    return ImageFont.load_default()


def draw(size, ring=0.33, rounded=True):
    s = size * SS
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if rounded:
        d.rounded_rectangle([0, 0, s - 1, s - 1], radius=int(s * 0.22), fill=BG)
    else:
        d.rectangle([0, 0, s, s], fill=BG)

    # warm glow behind the ring
    glow = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gr = int(s * ring * 1.25)
    gd.ellipse([s // 2 - gr, s // 2 - gr, s // 2 + gr, s // 2 + gr], fill=(120, 70, 20, 90))
    glow = glow.filter(ImageFilter.GaussianBlur(s * 0.09))
    mask = img.split()[3]
    img = Image.alpha_composite(img, Image.composite(glow, Image.new("RGBA", (s, s), (0, 0, 0, 0)), mask))
    d = ImageDraw.Draw(img)

    r = s * ring
    w = int(s * ring * 0.36)
    box = [s / 2 - r, s / 2 - r, s / 2 + r, s / 2 + r]
    gap = 9  # degrees between parts
    a = -90.0
    for color, share in PARTS:
        sweep = 360 * share
        d.arc(box, a + gap / 2, a + sweep - gap / 2, fill=color, width=w)
        # round the ends
        for ang in (a + gap / 2, a + sweep - gap / 2):
            cx = s / 2 + (r - w / 2) * math.cos(math.radians(ang))
            cy = s / 2 + (r - w / 2) * math.sin(math.radians(ang))
            d.ellipse([cx - w / 2, cy - w / 2, cx + w / 2, cy + w / 2], fill=color)
        a += sweep

    f = font(int(s * ring * 0.86))
    d.text((s / 2, s / 2 - s * 0.012), "đ", font=f, fill=IVORY, anchor="mm")
    return img.resize((size, size), Image.LANCZOS)


os.makedirs(OUT, exist_ok=True)
draw(512).save(os.path.join(OUT, "icon-512.png"))
draw(192).save(os.path.join(OUT, "icon-192.png"))
draw(512, ring=0.26, rounded=False).save(os.path.join(OUT, "maskable-512.png"))
draw(180, rounded=False).save(os.path.join(OUT, "apple-touch-icon.png"))
draw(64).save(os.path.join(OUT, "favicon-64.png"))
print("icons written to", os.path.normpath(OUT))
