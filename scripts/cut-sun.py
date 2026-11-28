"""從插畫裁出紙雕太陽：放大 4 倍後依「黃色程度」做柔和去背，邊緣顏色往太陽本色收，避免粉色陰影與鋸齒。"""
import sys
import numpy as np
from PIL import Image
from scipy import ndimage
src, dst = sys.argv[1], sys.argv[2]
im = Image.open(src).convert('RGB').crop((1255, 0, 1465, 172))
S = 4
big = np.array(im.resize((im.width * S, im.height * S), Image.BICUBIC)).astype(float)
r, g, b = big[..., 0], big[..., 1], big[..., 2]
edge = np.concatenate([big[0], big[-1], big[:, 0], big[:, -1]])
sky = np.median(edge, 0)
yellow = (r + g) / 2 - b                      # 太陽約 90，天空約 15，粉色紙影約 30–40
sky_y = (sky[0] + sky[1]) / 2 - sky[2]
alpha = np.clip((yellow - sky_y - 33) / 12, 0, 1)
core = ndimage.binary_fill_holes(alpha > 0.5)
lab, n = ndimage.label(core)
sizes = ndimage.sum(core, lab, range(1, n + 1))
core = lab == (np.argmax(sizes) + 1)
# 中間的圓（含淡色外圈）整個保留
ys, xs = np.nonzero(core)
cy, cx = (ys.min() + ys.max()) / 2, (xs.min() + xs.max()) / 2
R = 0.262 * (xs.max() - xs.min())
yy, xx = np.mgrid[0:core.shape[0], 0:core.shape[1]]
disc = (yy - cy) ** 2 + (xx - cx) ** 2 <= R ** 2
core |= disc
alpha = np.maximum(alpha, disc.astype(float))
alpha = np.where(ndimage.binary_dilation(core, iterations=S), alpha, 0)
alpha = np.maximum(alpha, ndimage.binary_erosion(core, iterations=S).astype(float))
alpha = ndimage.gaussian_filter(alpha, 0.35 * S)
# 邊緣去色邊：半透明像素的顏色換成附近不透明的太陽顏色
solid = alpha > 0.95
idx = ndimage.distance_transform_edt(~solid, return_distances=False, return_indices=True)
fixed = big[idx[0], idx[1]]
rgb = np.where((alpha < 0.95)[..., None], fixed, big)
out = Image.fromarray(np.dstack([rgb, alpha * 255]).astype(np.uint8), 'RGBA')
out = out.crop(out.getbbox()).resize((out.width // 2, out.height // 2), Image.LANCZOS)
out.save(dst, quality=92)
print(out.size)
