"""從「空花圃」插畫產生活花園的圖層與種花位置。
用法：python3 scripts/garden-scene.py <空花圃插畫.png> <輸出資料夾> <預覽圖> <開滿花的插畫.png>
輸出：backdrop.webp（整張背景）、tree.webp / vines.webp（隨風搖曳的覆蓋層）、spots.json（每一小叢花的位置，依種植順序）"""
import sys, json
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage

src, out = sys.argv[1], sys.argv[2].rstrip('/') + '/'
im = Image.open(src).convert('RGB')
W, H = im.size
im.save(out + 'backdrop.webp', quality=80, method=4)

def overlay(box, name, ellipse, plant_only=False):
    c = im.crop(box).convert('RGBA')
    w, h = c.size
    m = Image.new('L', (w, h), 0)
    ImageDraw.Draw(m).ellipse([ellipse[0] * w, ellipse[1] * h, ellipse[2] * w, ellipse[3] * h], fill=255)
    m = m.filter(ImageFilter.GaussianBlur(min(w, h) * 0.08))
    if plant_only:
        # 只留葉子與花（綠、紫、粉），白色的玻璃屋框架不動
        a = np.array(c.convert('RGB')).astype(float)
        r, g, b = a[..., 0], a[..., 1], a[..., 2]
        mx, mn = a.max(2), a.min(2); sat = (mx - mn) / (mx + 1e-6)
        leaf = (sat > 0.18) & (g > 0.9 * r) & (g > b + 20)
        purple = (sat > 0.12) & (b > g + 8)
        pink = (sat > 0.2) & (r - g > 22) & (r > 180) & (b > g - 22)
        p = ndimage.binary_opening(leaf | purple | pink, iterations=1)
        p = ndimage.binary_closing(p, iterations=3)
        lab, n = ndimage.label(p)
        if n:
            sz = ndimage.sum(p, lab, range(1, n + 1))
            p = np.isin(lab, [i + 1 for i, v in enumerate(sz) if v > 60])
        p = ndimage.gaussian_filter(p.astype(float), 0.8)
        m = Image.fromarray((np.array(m).astype(float) * np.clip(p * 1.3, 0, 1)).astype(np.uint8))
    c.putalpha(m)
    c.save(out + name, quality=84, method=4)

overlay((0, 0, 860, 360), 'tree.webp', (-0.3, -0.6, 1.0, 0.95), True)     # 左上大樹的樹冠
# 樹冠只留大樹自己的葉子：去掉溫室旁的藤蔓（右下）和遠處淡綠色的背景樹（右上，飽和度較低）
_t = Image.open(out + 'tree.webp').convert('RGBA')
_a = np.array(_t).astype(float)
_r, _g, _b = _a[..., 0], _a[..., 1], _a[..., 2]
_sat = (_a[..., :3].max(2) - _a[..., :3].min(2)) / (_a[..., :3].max(2) + 1e-6)
_yy, _xx = np.mgrid[0:_a.shape[0], 0:_a.shape[1]]
_keep = ~(((_xx > 470) & (_yy > 150)) | ((_xx > 560) & (_sat < 0.32)))
_a[..., 3] *= ndimage.gaussian_filter(_keep.astype(float), 3)
Image.fromarray(_a.astype(np.uint8), 'RGBA').save(out + 'tree.webp', quality=84, method=4)
LEFT, RIGHT = (480, 170, 760, 480), (1020, 150, 1300, 520)
overlay(LEFT, 'vines.webp', (0.05, -0.1, 0.95, 1.0), True)                   # 溫室左側的藤蔓
overlay(RIGHT, 'vines-right.webp', (0.08, -0.05, 0.92, 1.0), True)          # 溫室右側的藤蔓
if len(sys.argv) > 4:                                                  # 開滿花的版本：紫藤、玫瑰藤
    full = Image.open(sys.argv[4]).convert('RGB')
    keep = im
    im = full
    overlay(LEFT, 'vines-wisteria.webp', (0.05, -0.1, 0.95, 1.0), True)
    overlay(RIGHT, 'vines-rose.webp', (0.08, -0.05, 0.92, 1.0), True)
    im = keep

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

# ---- 大樹：樹冠分成幾叢各自擺動；只把「葉子底下」的背景補色，葉子之間的天空、樹枝保留原圖 ----
import cv2
src_full = np.array(im).astype(float)
TW, TH = 860, 380
a = src_full[:TH, :TW]
r, g, b = a[..., 0], a[..., 1], a[..., 2]
mx, mn = a.max(2), a.min(2); sat = (mx - mn) / (mx + 1e-6)
yy, xx = np.mgrid[0:TH, 0:TW]
leaf = (sat > 0.18) & (g > 0.9 * r) & (g > b + 20)
leaf &= ~(((xx > 470) & (yy > 150)) | ((xx > 560) & (sat < 0.32)))     # 溫室藤蔓、遠處背景樹
leaf[170:380, 245:375] = False                                          # 路燈
trunk = (r - g > 32) & (b < 150)
leaf = ndimage.binary_closing(leaf, structure=np.ones((3, 3)), iterations=2)
leaf = ndimage.binary_fill_holes(leaf) & ~trunk                          # 補起葉子內部的小洞
leaf = ndimage.binary_opening(leaf, iterations=2)
lab, n = ndimage.label(leaf)
sizes = ndimage.sum(leaf, lab, range(1, n + 1))
leaf = np.isin(lab, [i + 1 for i, v in enumerate(sizes) if v > 150])
alpha = np.clip(ndimage.gaussian_filter(leaf.astype(float), 0.8) * 1.5, 0, 1)
rgba = np.dstack([a, alpha * 255]).astype(np.uint8)
lab, n = ndimage.label(leaf)
cents = ndimage.center_of_mass(leaf, lab, range(1, n + 1))
CLUSTERS = [lambda cx, cy: cx < 240 and cy > 140, lambda cx, cy: cx < 330 and cy <= 140,
            lambda cx, cy: 330 <= cx < 520, lambda cx, cy: cx >= 520 or (cx >= 240 and cy > 140)]
grown = ndimage.grey_dilation(lab, size=(3, 3))     # 讓邊緣羽化的像素也歸到同一叢
for k, rule in enumerate(CLUSTERS):
    ids = [i + 1 for i, (cy, cx) in enumerate(cents) if rule(cx, cy)]
    part = rgba.copy()
    part[..., 3] = np.where(np.isin(grown, ids), rgba[..., 3], 0)
    Image.fromarray(part, 'RGBA').save(out + f'tree-{k}.webp', quality=88, method=4)
bd = np.array(im).copy()
fill = np.zeros(bd.shape[:2], np.uint8)
fill[:TH, :TW] = (ndimage.binary_dilation(leaf, iterations=1) & ~trunk).astype(np.uint8) * 255
bd = cv2.inpaint(np.ascontiguousarray(bd[..., ::-1]), fill, 6, cv2.INPAINT_TELEA)[..., ::-1]
Image.fromarray(bd).save(out + 'backdrop.webp', quality=82, method=4)
print('tree clusters + backdrop inpainted')
