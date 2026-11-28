"""用 AI 去背（rembg isnet-general-use）重新裁出 40 種花 × 5 階段，並以莖／土壤為中心擺正。
用法：python3 scripts/slice-flowers-ai.py <圖鑑資料夾> <輸出資料夾>（需先跑過 slice-flowers.py 產生 manifest 與肖像）"""
import sys, json, importlib.util
import numpy as np
from PIL import Image
from scipy import ndimage
from rembg import new_session, remove

SRC, OUT = sys.argv[1].rstrip('/') + '/', sys.argv[2].rstrip('/') + '/'
spec = importlib.util.spec_from_file_location('sf', __file__.replace('slice-flowers-ai.py', 'slice-flowers.py'))
src_text = open(spec.origin).read()
ns = {}
exec(src_text.split('manifest = []')[0].replace("SRC, OUT = sys.argv[1].rstrip('/') + '/', sys.argv[2].rstrip('/') + '/'", ''), ns)
CHARTS, STAGE_X, seeds, old_cutout = ns['CHARTS'], ns['STAGE_X'], ns['seeds'], ns['cutout']
session = new_session('isnet-general-use')
UP, OUTSCALE = 4, 2

def cut(im, box, white=False):
    c = im.crop(box)
    big = c.resize((c.width * UP, c.height * UP), Image.LANCZOS)
    res = np.array(remove(big, session=session, post_process_mask=False)).astype(float)
    a = res[..., 3] / 255
    # 原本依顏色的去背：放大到同尺寸，當作「花在哪裡」的參考
    om = np.array(Image.fromarray(old_cutout(np.array(c), white=white)[..., 3]).resize(big.size, Image.BILINEAR)).astype(float) / 255 > 0.5
    a = a * ndimage.binary_dilation(om, iterations=3 * UP)                      # AI 多抓到的卡片背景去掉
    inner = ndimage.gaussian_filter(ndimage.binary_erosion(om, iterations=2 * UP).astype(float), 1.5 * UP)
    a = np.maximum(a, np.clip(inner * 1.6 - 0.3, 0, 1))                          # AI 漏掉的花瓣補回來
    # 只留最大的那一塊（加上與它相連的部分），去掉旁邊被切到的鄰居
    m = a > 0.5
    lab, n = ndimage.label(m)
    if n:
        sz = ndimage.sum(m, lab, range(1, n + 1))
        keep = np.isin(lab, [i + 1 for i, v in enumerate(sz) if v >= sz.max() * 0.15])
        a = a * ndimage.binary_dilation(keep, iterations=6)
    # 邊緣去色邊：半透明像素改用旁邊不透明的顏色
    rgb = np.array(big.convert('RGB')).astype(float)
    solid = a > 0.9
    if solid.any():
        idx = ndimage.distance_transform_edt(~solid, return_distances=False, return_indices=True)
        rgb = np.where((a < 0.9)[..., None], rgb[idx[0], idx[1]], rgb)
    out = Image.fromarray(np.dstack([rgb, a * 255]).astype(np.uint8), 'RGBA')
    bb = out.getbbox()
    out = out.crop(bb) if bb else out
    # 擺正：以最下面 15% （土壤與莖）的重心為中心，左右補透明讓它在正中間
    al = np.array(out)[..., 3].astype(float)
    base = al[int(al.shape[0] * 0.85):]
    cx = (base.sum(0) * np.arange(al.shape[1])).sum() / max(base.sum(), 1)
    half = int(max(cx, al.shape[1] - cx)) + 2
    canvas = Image.new('RGBA', (half * 2, out.height))
    canvas.paste(out, (int(half - cx), 0))
    return canvas.resize((canvas.width * OUTSCALE // UP, canvas.height * OUTSCALE // UP), Image.LANCZOS)

man = json.load(open(OUT + 'manifest.json'))
byid = {f['id']: f for f in man['flowers']}
for ci, f in enumerate(CHARTS):
    im = Image.open(SRC + f).convert('RGB')
    for col, pts in enumerate(seeds(np.array(im))):
        for r, (sy, sx) in enumerate(pts):
            fid = f'f{ci * 10 + col * 5 + r:02d}'
            sizes = []
            for si, (dx0, dx1) in enumerate(STAGE_X):
                box = (sx + dx0 - 4, sy - 18, sx + dx1 + 4, sy + 16) if si == 0 else (sx + dx0, sy - (91 if si == 4 else 84), sx + dx1, sy + 27)
                spr = cut(im, box, white=(ci == 2 or fid == 'f03'))
                spr.save(f'{OUT}{fid}-{si}.webp', quality=90, method=4)
                sizes.append([spr.width // OUTSCALE, spr.height // OUTSCALE])
            byid[fid]['sizes'] = sizes
            print(fid, flush=True)
json.dump(man, open(OUT + 'manifest.json', 'w'), ensure_ascii=False)
