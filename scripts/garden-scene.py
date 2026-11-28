"""從「空花圃」插畫產生活花園的圖層與種花位置。
用法：python3 scripts/garden-scene.py <空花圃插畫.png> <輸出資料夾>
輸出：backdrop.webp（整張背景）、tree.webp / vines.webp（隨風搖曳的覆蓋層）、spots.json（每一小叢花的位置，依種植順序）"""
import sys, json
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage

src, out = sys.argv[1], sys.argv[2].rstrip('/') + '/'
im = Image.open(src).convert('RGB')
W, H = im.size
im.save(out + 'backdrop.webp', quality=80, method=4)

def overlay(box, name, ellipse):
    c = im.crop(box).convert('RGBA')
    w, h = c.size
    m = Image.new('L', (w, h), 0)
    ImageDraw.Draw(m).ellipse([ellipse[0] * w, ellipse[1] * h, ellipse[2] * w, ellipse[3] * h], fill=255)
    m = m.filter(ImageFilter.GaussianBlur(min(w, h) * 0.08))
    c.putalpha(m)
    c.save(out + name, quality=84, method=4)

overlay((0, 0, 860, 360), 'tree.webp', (-0.3, -0.6, 1.0, 0.95))       # 左上大樹的樹冠
overlay((495, 190, 735, 470), 'vines.webp', (0.05, -0.1, 0.95, 1.0))   # 溫室左側的藤蔓

# 找出土壤花圃（棕色區域），再補上被植物擋住的兩小塊
a = np.array(im).astype(float)
r, g, b = a[..., 0], a[..., 1], a[..., 2]
soil = (r > 135) & (r < 228) & (g > 90) & (g < 165) & (b > 60) & (b < 130) & (r - g > 35) & (g - b > 18)
soil[:500] = False
soil = ndimage.binary_opening(soil, iterations=2)
soil = ndimage.binary_closing(soil, iterations=8)
soil = ndimage.binary_fill_holes(soil)
lab, n = ndimage.label(soil)
sizes = ndimage.sum(soil, lab, range(1, n + 1))
soil = np.isin(lab, [i + 1 for i, s in enumerate(sizes) if s > 4000])
yy, xx = np.mgrid[0:H, 0:W]
for cx, cy, rx, ry in [(1060, 818, 95, 34), (1470, 726, 62, 22)]:   # 噴泉旁、右後方
    soil |= ((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2 <= 1
inner = ndimage.binary_erosion(soil, iterations=14)               # 離花圃邊緣留一點距離

# 在花圃裡均勻挑選種花點（間距隨遠近縮放）
rng = np.random.default_rng(20261128)
cand = np.argwhere(inner)
rng.shuffle(cand)
spots = []
for y, x in cand:
    depth = 0.72 + (y - 640) / (1000 - 640) * 0.33
    gap = 74 * depth
    if all((x - sx) ** 2 + ((y - sy) * 1.6) ** 2 >= gap ** 2 for sx, sy, _ in spots):
        spots.append((int(x), int(y), round(float(depth), 3)))
# 種植順序：前方大花圃先種，再輪流到其他花圃（用固定亂數，每次結果一樣）
bed_of = lambda s: 0 if s[1] > 800 and s[0] < 700 else 1 if s[1] < 760 and s[0] < 900 else 2 if s[0] > 1120 and s[1] > 850 else 3
groups = {}
for s in spots: groups.setdefault(bed_of(s), []).append(s)
for gname in groups: rng.shuffle(groups[gname])
order = []
while any(groups.values()):
    for k in [0, 2, 1, 3, 0]:
        if groups.get(k): order.append(groups[k].pop())
json.dump({'w': W, 'h': H, 'spots': [{'x': x, 'y': y, 's': s} for x, y, s in order]}, open(out + 'spots.json', 'w'))
print(len(order), 'spots')
vis = (np.array(im) * 0.6).astype(np.uint8)
d = Image.fromarray(vis); dr = ImageDraw.Draw(d)
for i, (x, y, s) in enumerate(order):
    dr.ellipse([x - 30 * s, y - 12 * s, x + 30 * s, y + 12 * s], outline=(255, 80, 80), width=3); dr.text((x - 6, y - 6), str(i), fill=(255, 255, 255))
d.resize((768, 512)).save(sys.argv[3] if len(sys.argv) > 3 else out + '_spots_preview.png')
