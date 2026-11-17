#!/usr/bin/env python3
"""index.html と assets/ を1つのHTMLにまとめる（確認・共有用）。
使い方: python3 build-single.py  →  dist/ecoproject.html"""
import base64, mimetypes, os, re

root = os.path.dirname(os.path.abspath(__file__))
read = lambda p: open(os.path.join(root, p), encoding='utf-8').read()
html = read('index.html')

html = re.sub(r'\s*<link rel="preload" as="image"[^>]*>', '', html)
html = re.sub(r'\s(?:srcset|sizes)="[^"]*"', '', html)
html = html.replace('<link rel="stylesheet" href="assets/css/style.css">',
                    '<style>\n' + read('assets/css/style.css') + '</style>')
html = html.replace('<script src="assets/js/main.js" defer></script>',
                    '<script>\n' + read('assets/js/main.js') + '</script>')

def data_uri(m):
    path = m.group(0)
    if not os.path.isfile(os.path.join(root, path)):
        return path  # コメント内の差し替え予定ファイル名などはそのまま
    mime = mimetypes.guess_type(path)[0] or 'image/webp'
    with open(os.path.join(root, path), 'rb') as f:
        return 'data:%s;base64,%s' % (mime, base64.b64encode(f.read()).decode())
html = re.sub(r'(?<=src=")assets/img/[\w.-]+|(?<=href=")assets/img/[\w.-]+', data_uri, html)  # 属性内のみ（注釈の文字は残す）

os.makedirs(os.path.join(root, 'dist'), exist_ok=True)
out = os.path.join(root, 'dist', 'ecoproject.html')
open(out, 'w', encoding='utf-8').write(html)
print(out, '%.1f MB' % (os.path.getsize(out) / 1e6))
