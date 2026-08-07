#!/usr/bin/env python3
"""Wraps the self-contained inner pages into full HTML documents."""
PAGES = [('src/inner.html', 'index.html'), ('src/blocks-inner.html', 'blocks.html'), ('src/glass-inner.html', 'glass.html')]
for src, dst in PAGES:
    inner = open(src).read()
    head, _, body = inner.partition('</style>')
    open(dst, 'w').write(f'''<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
{head}</style>
</head>
<body>{body}
</body>
</html>
''')
    print(dst, 'written')
