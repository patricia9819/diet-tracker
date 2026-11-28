"""從花園插畫裁出「活花園」用的圖層：背景（溫室、大樹、路燈）、樹冠與紫藤（會隨風搖曳的覆蓋層）。
用法：python3 scripts/garden-scene.py <花園插畫.png> <輸出資料夾>"""
import sys
from PIL import Image, ImageDraw, ImageFilter
src, out = sys.argv[1], sys.argv[2].rstrip('/') + '/'
im = Image.open(src).convert('RGB')
X0, Y0, X1, Y1 = 300, 0, 1460, 500           # 背景範圍（原圖座標）
im.crop((X0, Y0, X1, Y1)).save(out + 'backdrop.webp', quality=82, method=4)

def overlay(box, name, ellipse):
    c = im.crop(box).convert('RGBA')
    w, h = c.size
    m = Image.new('L', (w, h), 0)
    ImageDraw.Draw(m).ellipse([ellipse[0] * w, ellipse[1] * h, ellipse[2] * w, ellipse[3] * h], fill=255)
    m = m.filter(ImageFilter.GaussianBlur(min(w, h) * 0.08))
    c.putalpha(m)
    c.save(out + name, quality=84, method=4)
    print(name, box)

overlay((300, 0, 860, 330), 'tree.webp', (-0.35, -0.6, 1.0, 0.95))      # 左上大樹的樹冠
overlay((515, 250, 735, 470), 'wisteria.webp', (0.05, -0.2, 0.95, 1.0))  # 溫室前的紫藤
