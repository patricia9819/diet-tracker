"""從夜晚版插畫裁出夜空圖層（天空、星星、雲）與紙雕月亮。
用法：python3 scripts/night-sky.py <夜晚插畫.png> <輸出資料夾>"""
import sys
import numpy as np
import cv2
from PIL import Image
from scipy import ndimage
src, out = sys.argv[1], sys.argv[2].rstrip('/') + '/'
img = np.array(Image.open(src).convert('RGB'))
n = img.astype(float)
r, g, b = n[..., 0], n[..., 1], n[..., 2]
lum = n.mean(2)

# 月亮：黃色、亮，位在右上
yy, xx = np.mgrid[0:n.shape[0], 0:n.shape[1]]
moonish = ((r + g) / 2 - b > 30) & (lum > 150) & (xx > 1180) & (xx < 1440) & (yy < 200)
moon = ndimage.binary_fill_holes(ndimage.binary_closing(moonish, iterations=2))
lab, k = ndimage.label(moon)
sz = ndimage.sum(moon, lab, range(1, k + 1))
moon = lab == (np.argmax(sz) + 1)
y0, y1 = np.nonzero(moon)[0].min(), np.nonzero(moon)[0].max()
x0, x1 = np.nonzero(moon)[1].min(), np.nonzero(moon)[1].max()
S = 4
pad = 10
crop = n[y0 - pad:y1 + pad, x0 - pad:x1 + pad]
big = np.array(Image.fromarray(crop.astype(np.uint8)).resize((crop.shape[1] * S, crop.shape[0] * S), Image.BICUBIC)).astype(float)
br, bg_, bb = big[..., 0], big[..., 1], big[..., 2]
yel = (br + bg_) / 2 - bb
a = np.clip((yel - 24) / 16, 0, 1) * np.clip((big.mean(2) - 158) / 22, 0, 1)
core = ndimage.binary_fill_holes(a > 0.5)
lab2, k2 = ndimage.label(core)
s2 = ndimage.sum(core, lab2, range(1, k2 + 1))
core = lab2 == (np.argmax(s2) + 1)
a = np.where(ndimage.binary_dilation(core, iterations=S), a, 0)
a = np.maximum(a, ndimage.binary_erosion(core, iterations=S).astype(float))
a = ndimage.gaussian_filter(a, 0.35 * S)
solid = a > 0.95
idx = ndimage.distance_transform_edt(~solid, return_distances=False, return_indices=True)
rgb = np.where((a < 0.95)[..., None], big[idx[0], idx[1]], big)
m = Image.fromarray(np.dstack([rgb, a * 255]).astype(np.uint8), 'RGBA')
m = m.crop(m.getbbox())
m = m.resize((m.width // 2, m.height // 2), Image.LANCZOS)
m.save(out + 'moon.webp', quality=92)
print('moon', m.size, 'at', (x0 + x1) // 2, (y0 + y1) // 2)

# 夜空：深藍紫色的天空（含星星），右上角連同雲一起；月亮位置補成天空色
sky = (b > r + 4) & (lum < 175)
sky[560:] = False
sky |= (xx > 1130) & (yy < 215) & ~ndimage.binary_dilation(moon, iterations=6) & (lum < 225)
sky = ndimage.binary_closing(sky, iterations=3)
sky = ndimage.binary_fill_holes(sky)
lab, k = ndimage.label(sky)
sz = ndimage.sum(sky, lab, range(1, k + 1))
sky = np.isin(lab, [i + 1 for i, v in enumerate(sz) if v > 800])
hole = ndimage.binary_dilation(moon, iterations=8).astype(np.uint8) * 255
filled = cv2.inpaint(np.ascontiguousarray(img[..., ::-1]), hole, 15, cv2.INPAINT_TELEA)[..., ::-1]
sky |= hole > 0
alpha = np.clip(ndimage.gaussian_filter(sky.astype(float), 1.2) * 1.3, 0, 1)
Image.fromarray(np.dstack([filled, alpha * 255]).astype(np.uint8), 'RGBA').save(out + 'night-sky.webp', quality=82, method=4)
print('night sky saved')
