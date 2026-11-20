#!/usr/bin/env python3
"""マニュアルの写真を、番号の丸と説明を焼き込んだ画像（PNG）にして書き出す。版ごとに ZIP にもまとめる。

使い方: python3 tools/export_manual_images.py <出力フォルダ> [--shots <撮影フォルダ>]
  撮影フォルダ（dev/manual-shots.mjs が撮った PNG と <版>_marks.json）を省くと docs/spec/img/manual/ の jpg を使う
出力: <出力フォルダ>/ANGLEX_v1_画像/01_main.png … と ANGLEX_v1_画像.zip（v2・v3 も同じ）
"""
import sys, json, pathlib, zipfile
from PIL import Image, ImageDraw, ImageFont
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from manual_content import VERSIONS
ROOT = pathlib.Path(__file__).resolve().parent.parent
args = sys.argv[1:]
SHOTS = pathlib.Path(args[args.index('--shots') + 1]) if '--shots' in args else None
OUT = pathlib.Path([a for i, a in enumerate(args) if not a.startswith('--') and (i == 0 or args[i - 1] != '--shots')][0])
IMG = ROOT / 'docs' / 'spec' / 'img' / 'manual'
FONT = next((p for p in ['/usr/share/fonts/opentype/ipafont-gothic/ipag.ttf', '/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc',
                         '/System/Library/Fonts/ヒラギノ角ゴシック W6.ttc', 'C:/Windows/Fonts/meiryob.ttc'] if pathlib.Path(p).exists()), None)
S = 2  # 2 倍で描いて縮める（丸の縁をなめらかに）


def font(px):
    return ImageFont.truetype(FONT, px * S) if FONT else ImageFont.load_default()


def hexrgb(h):
    h = h.lstrip('#'); return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def source(ver, name):
    if SHOTS and (SHOTS / f'{ver}_{name}.png').exists():
        return Image.open(SHOTS / f'{ver}_{name}.png').convert('RGB')
    p = IMG / f'{ver}_{name}.jpg'
    return Image.open(p).convert('RGB') if p.exists() else None


def marks_of(ver):
    p = (SHOTS / f'{ver}_marks.json') if SHOTS and (SHOTS / f'{ver}_marks.json').exists() else IMG / f'{ver}_marks.json'
    return json.loads(p.read_text(encoding='utf-8')) if p.exists() else {}


def dot(d, cx, cy, r, n, fill, f):
    d.ellipse([cx - r - 3 * S, cy - r - 3 * S, cx + r + 3 * S, cy + r + 3 * S], fill=(255, 255, 255))
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=fill)
    d.text((cx, cy), str(n), font=f, fill=(255, 255, 255), anchor='mm')


def compose(V, name, title, marks, idx):
    im = source(V['key'], name)
    if im is None:
        return None
    W = 1440; im = im.resize((W, round(im.height * W / im.width)), Image.LANCZOS); H = im.height
    acc = hexrgb(V['accent']); ms = marks.get(name, [])
    head = 64; cols = 2; row = 40; legend = 24 + ((len(ms) + cols - 1) // cols) * row + 16 if ms else 0
    c = Image.new('RGB', (W * S, (head + H + legend) * S), (255, 255, 255)); d = ImageDraw.Draw(c)
    # 見出し: 版の名前 ／ やりたいこと
    d.rectangle([0, 0, W * S, head * S], fill=(24, 27, 33)); d.rectangle([0, 0, 8 * S, head * S], fill=acc)
    d.text((28 * S, head * S // 2), f'{V["name"]}', font=font(22), fill=(255, 255, 255), anchor='lm')
    tw = d.textlength(V['name'], font=font(22))
    d.text((28 * S + tw + 18 * S, head * S // 2), f'{idx:02d}　{title}', font=font(20), fill=(203, 213, 225), anchor='lm')
    c.paste(im.resize((W * S, H * S), Image.LANCZOS), (0, head * S))
    # 囲みと番号
    for m in ms:
        x, y, w, h = (v / 100 for v in m['box'])
        d.rounded_rectangle([x * W * S, (head + y * H) * S, (x + w) * W * S, (head + (y + h) * H) * S], radius=6 * S, outline=acc, width=3 * S)
    f = font(17)
    for m in ms:  # 番号は囲みの左上の角に置く（中身を隠さない）。画面の端では内側へ寄せる
        bx, by = m['box'][0] / 100 * W, m['box'][1] / 100 * H
        cx = min(max(bx, 20), W - 20); cy = head + min(max(by, 20), H - 20)
        dot(d, cx * S, cy * S, 15 * S, m['n'], acc, f)
    # 下の説明
    y0 = head + H + 24; colw = (W - 56) // cols
    for i, m in enumerate(ms):
        x = 28 + (i % cols) * colw; y = y0 + (i // cols) * row + 14
        dot(d, (x + 14) * S, y * S, 13 * S, m['n'], acc, font(15))
        d.text(((x + 38) * S, y * S), m['label'], font=font(18), fill=(17, 24, 39), anchor='lm')
    return c.resize((W, head + H + legend), Image.LANCZOS)


OUT.mkdir(parents=True, exist_ok=True)
for V in VERSIONS:
    ver = V['key']; marks = marks_of(ver); order = []
    first = {'v1': 'main', 'v2': 'mode', 'v3': 'work'}[ver]
    for t in V['tasks']:
        for s in t['steps']:
            if s['shot'] not in [o[0] for o in order]:
                order.append((s['shot'], t['title']))
    if first not in [o[0] for o in order]:
        order.insert(0, (first, '画面の全体'))
    folder = OUT / f'ANGLEX_{ver}_画像'; folder.mkdir(exist_ok=True)
    for old in folder.glob('*.png'):
        old.unlink()
    files = []
    for i, (name, title) in enumerate(order, 1):
        img = compose(V, name, title, marks, i)
        if img is None:
            print('  写真なし', ver, name); continue
        p = folder / f'{i:02d}_{name}.png'; img.save(p, optimize=True); files.append(p)
    z = OUT / f'ANGLEX_{ver}_画像.zip'
    with zipfile.ZipFile(z, 'w', zipfile.ZIP_STORED) as zf:
        for p in files:
            zf.write(p, f'{folder.name}/{p.name}')
    print('wrote', z, len(files), '枚', f'{z.stat().st_size // 1024} KB')
