"""從 4 張「花卉培育圖鑑」裁出 40 種花 × 5 個生長階段與圓形肖像，去背後輸出 WebP。
用法：python3 scripts/slice-flowers.py <圖鑑資料夾> <輸出資料夾>
圖鑑檔名依序：圖鑑I、圖鑑II、白色、藍色（見 CHARTS）。"""
import sys, json
from PIL import Image, ImageDraw, ImageFilter
import numpy as np
from scipy import ndimage

SRC, OUT = sys.argv[1].rstrip('/') + '/', sys.argv[2].rstrip('/') + '/'
CHARTS = ['be2955b8-image.png', '69e3c314-image.png', '3b59c201-image.png', '7e4d18bf-image.png']
GROUPS = ['圖鑑 I', '圖鑑 II', '白色花', '藍色花']
# [左欄 5 種, 右欄 5 種]，每種：(名稱, 花語)
FLOWERS = [
  [[('繡球花', '層疊綻放・溫柔圓滿'), ('鬱金香', '優雅挺立・春日詩意'), ('薰衣草', '清香寧靜・療癒放鬆'), ('瑪格麗特', '純真清新・日常小幸福'), ('玫瑰', '浪漫典雅・經典永恆')],
   [('紫藤花', '垂瀑花簾・夢幻優雅'), ('虞美人', '輕盈飄逸・自由盛放'), ('銀蓮花', '純淨靈動・微風搖曳'), ('鈴蘭', '清雅玲瓏・幸福再臨'), ('波斯菊', '輕盈明朗・秋日浪漫')]],
  [[('星藍鈴花', '靜謐優雅・如星垂落'), ('彼岸花', '神秘絢麗・曼妙綻放'), ('綠綉球', '層疊花團・隨季變色'), ('向日葵', '追光而生・明亮希望'), ('倒掛金鐘', '繽紛垂墜・精巧可愛')],
   [('金合歡', '陽光燦爛・溫暖活力'), ('鳶尾花', '高雅堅韌・氣質出眾'), ('萱草花', '朝開暮謝・溫柔守候'), ('芍藥', '雍容華美・富貴柔和'), ('山茶花', '冬日綻放・優雅堅定')]],
  [[('白百合', '純潔高雅・優雅莊麗'), ('白玫瑰', '純真告白・恆久優雅'), ('白繡球花', '圓滿純淨・溫柔包容'), ('茉莉花', '清香雅緻・純淨怡人'), ('白風信子', '馥郁芬芳・春意盎然')],
   [('白鈴蘭', '清新迷人・幸福再臨'), ('海芋', '簡潔大氣・純粹優美'), ('白色鬱金香', '純粹高貴・初春使者'), ('白銀蓮花', '清麗脫俗・靈動優雅'), ('雪花蓮', '迎雪而開・堅韌純潔')]],
  [[('藍繡球', '團簇盛放・清雅柔和'), ('勿忘草', '細緻可愛・永恆思念'), ('風鈴草', '鈴形花朵・輕盈靈動'), ('藍花鼠尾草', '清新芳香・療癒舒緩'), ('飛燕草', '高挑優雅・花序華麗')],
   [('矢車菊', '高潔清新・自然奔放'), ('藍星花', '星形小花・清涼可愛'), ('粉蝶花', '輕盈如蝶・遍地花海'), ('琉璃苣', '星芒花朵・清新獨特'), ('銀杯花', '清透淡雅・夢幻涼爽')]],
]
# 各階段相對「種子」中心的水平範圍（像素）
STAGE_X = [(-13, 15), (46, 116), (130, 212), (227, 308), (326, 438)]
SCALE = 2  # 輸出放大倍數，手機高解析度螢幕比較清楚

def seeds(a):
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    m = (r > 90) & (r < 190) & (g > 50) & (g < 130) & (b < 90) & (r - b > 60)
    out = []
    for x0, x1 in [(285, 330), (1040, 1090)]:
        lab, n = ndimage.label(m[:, x0:x1])
        pts = []
        for i, sl in enumerate(ndimage.find_objects(lab)):
            h, w = sl[0].stop - sl[0].start, sl[1].stop - sl[1].start
            if 5 <= h <= 22 and 4 <= w <= 18 and (lab[sl] == i + 1).sum() > 20 and sl[0].start > 180:
                pts.append(((sl[0].start + sl[0].stop) // 2, (sl[1].start + sl[1].stop) // 2 + x0))
        assert len(pts) == 5, (x0, pts)
        out.append(sorted(pts))
    return out

def cutout(rgb):
    c = rgb.astype(float)
    edge = np.concatenate([c[0], c[-1], c[:, 0], c[:, -1]])
    bg = np.median(edge, 0)
    mx, mn = c.max(2), c.min(2)
    sat = (mx - mn) / (mx + 1e-6)
    lum = c.mean(2)
    # 花、葉、土：有顏色或比紙張暗；紙張本身（含卡片底色）是亮而不飽和的米色
    # 白色花瓣是幾乎不帶顏色的灰白（飽和度 < 0.065），米色紙張則偏黃（約 0.1–0.2）
    # 花瓣四周淺米棕色的紙雕陰影（亮、飽和度中等）不算；粉色、紫色花瓣有較深的輪廓圍住，下面填滿時會補回來
    r, g, b = c[..., 0], c[..., 1], c[..., 2]
    warm = (r >= g) & (g >= b)              # 紙雕陰影是偏暖的米棕色；紫色、粉色花瓣藍色多於綠色
    fg = ((sat > 0.12) & ~warm) | ((sat > 0.16) & (lum < 212)) | (sat > 0.3) | (lum < bg.mean() - 24) | ((sat < 0.065) & (lum > 150))
    top = fg[:8].copy()
    if top.mean() > 0.25: fg[:8] = False      # 頂端整排都是前景＝卡片邊框
    m = ndimage.binary_closing(fg, structure=np.ones((3, 3)), iterations=3)
    m = ndimage.binary_fill_holes(m)          # 白色花瓣被輪廓圍住，填滿後就能保留
    m = ndimage.binary_opening(m, iterations=1)
    lab, n = ndimage.label(m)
    if n:
        sizes = ndimage.sum(np.ones_like(lab), lab, range(1, n + 1))
        keep = np.zeros_like(m)
        objs = ndimage.find_objects(lab)
        for i, sz in enumerate(sizes):
            h = objs[i][0].stop - objs[i][0].start
            w = objs[i][1].stop - objs[i][1].start
            if h < 9 and w > 3 * h: continue        # 上一張卡片的邊框線（又細又長）
            if sz >= sizes.max() * 0.3: keep |= lab == (i + 1)
        m = keep
    m = ndimage.binary_dilation(m, iterations=1)
    a = ndimage.gaussian_filter(m.astype(float), 0.8)
    return np.dstack([c, np.clip(a * 1.15, 0, 1) * 255]).astype(np.uint8)

manifest = []
for ci, f in enumerate(CHARTS):
    im = Image.open(SRC + f).convert('RGB')
    a = np.array(im)
    for col, pts in enumerate(seeds(a)):
        for r, (sy, sx) in enumerate(pts):
            fid = f'f{ci * 10 + col * 5 + r:02d}'
            name, words = FLOWERS[ci][col][r]
            sizes = []
            for si, (dx0, dx1) in enumerate(STAGE_X):
                box = (sx + dx0, sy - 13, sx + dx1, sy + 14) if si == 0 else (sx + dx0, sy - (91 if si == 4 else 84), sx + dx1, sy + 27)
                rgba = Image.fromarray(cutout(np.array(im.crop(box))), 'RGBA')
                bb = rgba.getbbox()
                rgba = rgba.crop(bb) if bb else rgba
                rgba = rgba.resize((rgba.width * SCALE, rgba.height * SCALE), Image.LANCZOS)
                rgba.save(f'{OUT}{fid}-{si}.webp', quality=88, method=4)
                sizes.append([rgba.width // SCALE, rgba.height // SCALE])
            # 圓形肖像
            cx, cy, R = sx - 207, sy - 14, 66
            p = im.crop((cx - R, cy - R, cx + R, cy + R)).resize((2 * R * SCALE // 2 * 2,) * 2, Image.LANCZOS)
            s = p.width
            mask = Image.new('L', (s * 4, s * 4), 0)
            ImageDraw.Draw(mask).ellipse((6, 6, s * 4 - 6, s * 4 - 6), fill=255)
            mask = mask.resize((s, s), Image.LANCZOS)
            out = Image.new('RGBA', (s, s)); out.paste(p, (0, 0), mask)
            out.save(f'{OUT}{fid}-p.webp', quality=86, method=4)
            manifest.append({'id': fid, 'name': name, 'words': words, 'group': ci, 'sizes': sizes})
json.dump({'groups': GROUPS, 'flowers': manifest}, open(OUT + 'manifest.json', 'w'), ensure_ascii=False)
print(len(manifest), 'flowers')
