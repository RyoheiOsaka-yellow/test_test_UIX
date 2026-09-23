"""Crops for the simulation-first guide (time-lapse, before/after, hero)."""
from PIL import Image
import os, sys, json
SP = sys.argv[1]; R = SP + '/raw/'; O = SP + '/img3/'
os.makedirs(O, exist_ok=True)
out = {}
def save(name, im, q=84):
    p = O + name + '.webp'; im.save(p, 'WEBP', quality=q, method=6)
    out[name] = {'w': im.size[0], 'h': im.size[1], 'kb': os.path.getsize(p) // 1024}
def load(n): return Image.open(R + n + '.png').convert('RGB')
def fit(im, w): return im if im.size[0] <= w else im.resize((w, round(im.size[1] * w / im.size[0])), Image.LANCZOS)
for t in ['1004', '1024', '1154']:
    save('k_rep_' + t, load('k_replay_' + t).crop((780, 400, 1480, 800)))
for n in ['before', 'after']:
    save('k_' + n, fit(load('k_plan_' + n).crop((180, 360, 1868, 1120)), 1400), 84)
save('k_hero', fit(load('k_hero').crop((60, 280, 1868, 1320)), 1600), 82)
json.dump(out, open(O + 'sizes.json', 'w'), indent=1)
for k, v in out.items(): print(k, v)
