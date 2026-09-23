from PIL import Image
import os, sys, json
SP = sys.argv[1]; R = SP + '/raw/'; O = SP + '/img/'
out = {}
def save(name, im, q=78):
    p = O + name + '.webp'; im.save(p, 'WEBP', quality=q, method=6)
    out[name] = {'w': im.size[0], 'h': im.size[1], 'kb': os.path.getsize(p) // 1024}
def load(n): return Image.open(R + n + '.png').convert('RGB')
def fit(im, w):
    return im if im.size[0] <= w else im.resize((w, round(im.size[1] * w / im.size[0])), Image.LANCZOS)
def trim_bottom(im, pad=24):
    # trim trailing rows that equal the bottom panel colour
    px = im.load(); W, H = im.size; bg = px[W // 2, H - 20]
    y = H - 20
    while y > 0:
        row = [px[x, y] for x in range(20, W - 20, 3)]
        if any(sum(abs(a - b) for a, b in zip(c, bg)) > 18 for c in row): break
        y -= 1
    return im.crop((0, 0, W, min(H, y + pad)))
# full screens (1600x900 css @2x)
for n in ['s01_replay_start', 's02_replay_all_0804', 's05_plan_default', 'l01_legacy']:
    save(n, fit(load(n), 2000), 80)
# right-panel result crops (css 1244,83,342,300)
for n in ['s05_plan_default', 's07_plan_research100', 's08_plan_moveoff']:
    im = load(n); save('r_' + n.split('_', 1)[1], im.crop((1244 * 2, 83 * 2, (1244 + 342) * 2, (83 + 312) * 2)), 84)
# zoomed 3D views: trim chip remnants (top) and bottom-panel overlap
for n in ['z1_replay_zoom', 'z2_replay_2f', 'z3_plan_overview', 'z4_plan_second']:
    im = load(n); W, H = im.size; save(n, fit(im.crop((0, 18, W, H - 30)), 1600), 80)
# panels @2x
for n in ['c01_left_replay', 'c02_left_plan', 'c03_right_plan']:
    save(n, trim_bottom(load(n)), 84)
save('s04_bottom', load('s04_bottom'), 86)
# dashboards
for n in ['d01_dash', 'd02_dash', 'd03_dash', 'd04_dash', 'd05_dash']:
    save(n, fit(load(n), 2000), 76)
json.dump(out, open(O + 'sizes.json', 'w'), indent=1)
tot = sum(v['kb'] for v in out.values())
for k, v in out.items(): print(k, v)
print('total KB', tot)
# split long panels
c02 = trim_bottom(load('c02_left_plan')); save('c02b_left_change', c02.crop((0, 860, c02.size[0], c02.size[1])), 84)
c03 = trim_bottom(load('c03_right_plan')); save('c03a_right_result', c03.crop((0, 0, c03.size[0], 1680)), 84); save('c03b_right_edges', c03.crop((0, 1680, c03.size[0], c03.size[1])), 84)
json.dump(out, open(O + 'sizes.json', 'w'), indent=1)
print('split', out['c02b_left_change'], out['c03a_right_result'], out['c03b_right_edges'])
