# manual.src.html の番号の位置（@@名前@@）を、撮影時の部品の位置から埋めて manual.html にする
import json, os
d = os.path.dirname(os.path.abspath(__file__))
r = json.load(open(os.path.join(d, 'img/rects.json')))
def pos(x, y): return 'left:%.1f%%;top:%.1f%%' % (x / 1440 * 100, y / 900 * 100)
c = lambda k, fx=0.5, fy=0.5: (r[k]['x'] + r[k]['width'] * fx, r[k]['y'] + r[k]['height'] * fy)
P = {'pill': c('pill'), 'report': c('report', 0.5, 1.05), 'tabs': (r['side']['x'] + 150, r['side']['y'] + 14), 'scenes': c('scenes', 0.93, 0.5), 'tools': c('tools', 0.42, 0.5),
     'focus': c('focus', 0.5, 1.2), 'view': c('view', 0.5, 0.55), 'tag0': c('tag0', 0.5, 1.15), 'legend': c('legend', 1.03, 0.5), 'cams': c('cams', 0.5, -0.35), 'dock': c('dock', 0.5, 0.5)}
s = open(os.path.join(d, 'manual.src.html')).read()
for k, v in P.items(): s = s.replace('@@' + k + '@@', pos(*v))
assert '@@' not in s
open(os.path.join(d, 'manual.html'), 'w').write(s)
print('manual.html ok')
