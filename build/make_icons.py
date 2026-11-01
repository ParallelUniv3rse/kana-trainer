"""Draws the app icons: あ in a practice square, indigo on paper. Run from project root."""
from PIL import Image, ImageDraw, ImageFont

INK, PAPER, GRID = (35, 48, 90), (242, 244, 248), (82, 98, 150)

def icon(size, pad_ratio=0.0):
    img = Image.new("RGB", (size, size), INK)
    d = ImageDraw.Draw(img)
    pad = int(size * (0.16 + pad_ratio))
    box = (pad, pad, size - pad, size - pad)
    w = max(2, size // 90)
    # dashed centre guides
    cx = cy = size // 2
    dash = max(4, size // 40)
    for i in range(box[0], box[2], dash * 2):
        d.line([(i, cy), (min(i + dash, box[2]), cy)], fill=GRID, width=w)
        d.line([(cx, i), (cx, min(i + dash, box[3]))], fill=GRID, width=w)
    d.rounded_rectangle(box, radius=size // 14, outline=GRID, width=w * 2)
    font = ImageFont.truetype("build/NotoSansJP.ttf", int((box[2] - box[0]) * 0.78))
    font.set_variation_by_axes([600])
    d.text((cx, cy + size * 0.01), "あ", font=font, fill=PAPER, anchor="mm")
    return img

icon(192).save("icons/icon-192.png")
icon(512).save("icons/icon-512.png")
icon(512, 0.06).save("icons/icon-maskable-512.png")
icon(180).save("icons/apple-touch-icon.png")
print("icons done")
