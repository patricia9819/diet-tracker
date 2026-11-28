"""產生花圃用的花：去掉每株底下的土堆與外圍的米色紙邊，莖的底部淡出，種進花圃土壤才自然。
輸出 flowers/fXX-g3.webp（花苞）、fXX-g4.webp（盛開），並在 manifest 加上 gsizes。"""
import sys, json
import numpy as np
from PIL import Image
from scipy import ndimage
D = sys.argv[1].rstrip('/') + '/'
man = json.load(open(D + 'manifest.json'))
for fl in man['flowers']:
    gs = []
    for st in (2, 3, 4):
        im = np.array(Image.open(f"{D}{fl['id']}-{st}.webp").convert('RGBA')).astype(float)
        rgb, a = im[..., :3], im[..., 3] / 255
        r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
        mx, mn = rgb.max(2), rgb.min(2); sat = (mx - mn) / (mx + 1e-6); lum = rgb.mean(2)
        H, W = a.shape
        # 1) 土堆：底部的棕色區塊 → 從土堆頂端切掉
        soil = (r > 110) & (g > 60) & (g < 150) & (b < 115) & (r - g > 28) & (a > 0.5)
        cut = H
        for y in range(int(H * 0.62), H):
            row = a[y] > 0.5
            if row.sum() and soil[y].sum() > 0.3 * row.sum():
                cut = y; break
        cut = min(H, cut + 3)
        rgb, a = rgb[:cut], a[:cut]
        sat, lum, r, g, b = sat[:cut], lum[:cut], r[:cut], g[:cut], b[:cut]
        # 2) 外圍米色紙邊：靠近邊緣、偏暖、亮、低飽和的像素拿掉
        solid = a > 0.5
        edge = solid & ~ndimage.binary_erosion(solid, iterations=5)
        cream = edge & (lum > 185) & (sat > 0.06) & (sat < 0.36) & (r >= g) & (g >= b - 4) & ((r - g) < 30)
        a = np.where(cream, 0, a)
        m = ndimage.binary_opening(a > 0.5, iterations=1)
        a = np.minimum(a, ndimage.gaussian_filter(m.astype(float), 0.8) * 1.3)
        # 3) 底部 10% 淡出，莖像是從土裡長出來
        h = a.shape[0]; fade = max(4, int(h * 0.1))
        a[h - fade:] *= np.linspace(1, 0.15, fade)[:, None]
        out = Image.fromarray(np.dstack([rgb, np.clip(a, 0, 1) * 255]).astype(np.uint8), 'RGBA')
        bb = out.getbbox(); out = out.crop((0, 0, out.width, bb[3])) if bb else out
        out.save(f"{D}{fl['id']}-g{st}.webp", quality=90, method=4)
        gs.append([out.width // 2, out.height // 2])
    fl['gsizes'] = gs
json.dump(man, open(D + 'manifest.json', 'w'), ensure_ascii=False)
print('ok')
