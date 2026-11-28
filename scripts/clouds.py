"""把天空的雲拆成獨立圖層（白天、夜晚各一組），雲後面補成天空，雲才能在 App 裡緩緩移動。
用法：python3 scripts/clouds.py <夜晚插畫.png> <garden 資料夾>"""
import sys, json
import numpy as np, cv2
from PIL import Image
from scipy import ndimage
from rembg import new_session, remove
night_src, out = sys.argv[1], sys.argv[2].rstrip('/') + '/'
sess = new_session('isnet-general-use')

def ai_alpha(img, box):
    c = Image.fromarray(img[..., :3]).crop(box)
    big = c.resize((c.width * 3, c.height * 3), Image.LANCZOS)
    return np.array(remove(big, session=sess).resize(c.size, Image.LANCZOS))[..., 3] / 255

def clean(m, minsize):
    m = ndimage.binary_closing(m, iterations=2)
    m = ndimage.binary_fill_holes(m)
    m = ndimage.binary_opening(m, iterations=2)
    lab, n = ndimage.label(m)
    if not n: return m
    sz = ndimage.sum(m, lab, range(1, n + 1))
    return np.isin(lab, [i + 1 for i, v in enumerate(sz) if v > minsize])

def pieces(img, mask, tag):
    H, W = mask.shape
    alpha = np.clip(ndimage.gaussian_filter(mask.astype(float), 0.8) * 1.4, 0, 1)
    lab, n = ndimage.label(ndimage.binary_dilation(mask, iterations=1))
    res = []
    for i, sl in enumerate(ndimage.find_objects(lab)):
        y0, y1, x0, x1 = max(0, sl[0].start - 3), min(H, sl[0].stop + 3), max(0, sl[1].start - 3), min(W, sl[1].stop + 3)
        part = img[y0:y1, x0:x1].copy()
        part[..., 3] = (alpha[y0:y1, x0:x1] * ndimage.binary_dilation(lab[y0:y1, x0:x1] == i + 1, iterations=2) * 255).astype(np.uint8)
        name = f'cloud-{tag}-{i}.webp'
        Image.fromarray(part, 'RGBA').save(out + name, quality=88, method=4)
        res.append({'src': name, 'x': int(x0), 'y': int(y0), 'w': int(x1 - x0), 'h': int(y1 - y0)})
    return res

def fill(img, hole, avoid):
    """每一塊補色區：用外圍一圈天空的顏色擬合平滑漸層（二次曲面）補上，再加細紙紋"""
    base = img[..., :3].astype(float)
    lab, n = ndimage.label(hole)
    rng = np.random.default_rng(3)
    for i, sl in enumerate(ndimage.find_objects(lab)):
        reg = lab == i + 1
        ring = ndimage.binary_dilation(reg, iterations=22) & ~ndimage.binary_dilation(reg, iterations=3) & ~avoid
        y0, y1 = max(0, sl[0].start - 30), min(base.shape[0], sl[0].stop + 30)
        x0, x1 = max(0, sl[1].start - 30), min(base.shape[1], sl[1].stop + 30)
        yy, xx = np.mgrid[y0:y1, x0:x1].astype(float)
        X = np.stack([np.ones_like(xx), xx, yy, xx * xx, yy * yy, xx * yy], -1) / [1, 1e3, 1e3, 1e6, 1e6, 1e6]
        rr = ring[y0:y1, x0:x1]
        sub = base[y0:y1, x0:x1]
        grain_std = min(2.5, (sub - ndimage.gaussian_filter(sub, (2, 2, 0)))[rr].std())
        grain = ndimage.gaussian_filter(rng.normal(0, 1, rr.shape), 0.6)
        grain = grain / (grain.std() + 1e-6) * grain_std
        for c in range(3):
            coef, *_ = np.linalg.lstsq(X[rr], sub[..., c][rr], rcond=None)
            f = X @ coef + grain
            w = ndimage.gaussian_filter(reg[y0:y1, x0:x1].astype(float), 1.5)
            sub[..., c] = sub[..., c] * (1 - w) + f * w
        base[y0:y1, x0:x1] = sub
    img[..., :3] = np.clip(base, 0, 255).astype(np.uint8)

def colors(a):
    r, g, b = a[..., 0].astype(float), a[..., 1].astype(float), a[..., 2].astype(float)
    return r, g, b, (r + g + b) / 3

# ---------- 白天：右上方那一團雲 ----------
img = np.array(Image.open(out + 'backdrop.webp').convert('RGBA'))
H, W = img.shape[:2]
r, g, b, lum = colors(img)
green = (g > r - 6) & (g > b + 8)
box = (1090, 0, 1530, 125)
m = np.zeros((H, W), bool)
m[box[1]:box[3], box[0]:box[2]] = ai_alpha(img, box) > 0.3
cloud = clean(m & ~ndimage.binary_dilation(green, iterations=3) & (lum > 185), 1500)
day = pieces(img, cloud, 'd')
yy, xx = np.mgrid[0:H, 0:W]
zone = (xx >= 1080) & (yy < 140) & ~ndimage.binary_dilation(green, iterations=4) & (lum > 140)   # 雲連同陰影的整片天空
zone = ndimage.binary_opening(zone, iterations=2) & ndimage.binary_dilation(cloud, iterations=26)
fill(img, zone | ndimage.binary_dilation(cloud, iterations=6) & ~green, ndimage.binary_dilation(zone | cloud | green, iterations=3) | (lum < 175))
Image.fromarray(img[..., :3]).save(out + 'backdrop.webp', quality=82, method=4)

# ---------- 夜晚 ----------
nimg = np.array(Image.open(night_src).convert('RGBA'))
r, g, b, lum = colors(nimg)
yy, xx = np.mgrid[0:H, 0:W]
moon = ((r + g) / 2 - b > 30) & (lum > 150) & (xx > 1180) & (xx < 1440) & (yy < 200)
moon = ndimage.binary_dilation(ndimage.binary_fill_holes(moon), iterations=10)
green = (g > r + 3) & (g > b + 6) & (lum < 200)
cloud = np.zeros((H, W), bool)
for box in [(1050, 55, 1300, 150), (1410, 25, 1536, 125)]:
    cloud[box[1]:box[3], box[0]:box[2]] |= ai_alpha(nimg, box) > 0.35
# 月亮下方那一大團：比夜空亮、不是黃色的月亮、不是樹
lower = np.zeros((H, W), bool); lower[105:235, 1270:1536] = True
navy = (b > r + 4) & (lum < 150)
cloud |= lower & ~navy & (lum > 150) & ((r + g) / 2 - b < 28) & ~green
cloud &= ~moon & ~ndimage.binary_dilation(green, iterations=2)
roof = (lum > 190) & (xx < 1180) & (yy > 95)        # 溫室屋頂的白色裝飾
cloud = clean(cloud & ~roof, 600)
# 偏暖色的小塊是月亮光暈，不是雲
lab, k = ndimage.label(cloud)
for i in range(1, k + 1):
    sel = lab == i
    if sel.sum() < 4000 and r[sel].mean() > b[sel].mean() + 4: cloud[sel] = False
# 月亮也拆成獨立的（App 另外畫月亮），先把雲和月亮一起補成夜空
night = pieces(nimg, cloud, 'n')
zone = (xx >= 1050) & (yy < 245) & ~ndimage.binary_dilation(green | roof, iterations=3)
zone &= ndimage.binary_dilation(cloud | moon, iterations=30)     # 月亮光暈、雲的陰影一起補成夜空
fill(nimg, zone, ndimage.binary_dilation(zone | green | roof, iterations=3) | ~navy)
# 夜空圖層：沿用原本的天空範圍
alpha = np.array(Image.open(out + 'night-sky.webp').convert('RGBA'))[..., 3]
nimg[..., 3] = alpha
Image.fromarray(nimg, 'RGBA').save(out + 'night-sky.webp', quality=82, method=4)
json.dump({'day': day, 'night': night}, open(out + 'clouds.json', 'w'))
print(len(day), 'day,', len(night), 'night')
