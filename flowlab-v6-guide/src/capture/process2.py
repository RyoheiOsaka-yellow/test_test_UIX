from PIL import Image
import os, sys, json
SP = sys.argv[1]; R = SP + '/raw/'; O = SP + '/img2/'
os.makedirs(O, exist_ok=True)
out = {}
def save(name, im, q=84):
    p = O + name + '.webp'; im.save(p, 'WEBP', quality=q, method=6)
    out[name] = {'w': im.size[0], 'h': im.size[1], 'kb': os.path.getsize(p) // 1024}
def load(n): return Image.open(R + n + '.png').convert('RGB')
def fit(im, w): return im if im.size[0] <= w else im.resize((w, round(im.size[1] * w / im.size[0])), Image.LANCZOS)
def css(im, x0, y0, x1, y1): return im.crop((x0 * 2, y0 * 2, x1 * 2, y1 * 2))
s01, s05 = load('s01_replay_start'), load('s05_plan_default')
save('p_s01', fit(s01, 2200), 82)
save('p_s05', fit(s05, 2000), 80)
save('u_left_replay', css(s01, 14, 90, 296, 356))
save('u_mode_plan', css(s05, 14, 90, 190, 178))
c02 = load('c02_left_plan'); save('u_change', c02.crop((0, 900, c02.size[0], 1640)))
c03 = load('c03_right_plan'); save('u_edges', c03.crop((0, 1680, c03.size[0], 2110)))
save('u_result', css(s05, 1244, 83, 1586, 395))
for n in ['s07_plan_research100', 's08_plan_moveoff']:
    save('u_' + n.split('_', 2)[2], css(load(n), 1244, 83, 1586, 300))
save('u_result_short', css(s05, 1244, 83, 1586, 300))
top = load('s04_top'); save('u_topbtn', top.crop((2520, 18, 3200, 122)))
save('u_bottom', load('s04_bottom'), 86)
z1 = load('z1_replay_zoom'); W, H = z1.size; save('p_z1', fit(z1.crop((0, int(H * .20), W, int(H * .70))), 1500), 82)
z4 = load('z4_plan_second'); W, H = z4.size; save('p_z4', fit(z4.crop((0, int(H * .12), W, int(H * .80))), 1500), 82)
d03 = load('d03_dash'); save('u_map_move', d03.crop((110, 1100, 1906, 2254)), 82)
for i in range(1, 6):
    d = load(f'd0{i}_dash'); save(f't_d0{i}', fit(css(d, 0, 180, 1600, 1080), 1100), 76)
json.dump(out, open(O + 'sizes.json', 'w'), indent=1)
for k, v in out.items(): print(k, v)
print('total KB', sum(v['kb'] for v in out.values()))
# wide strip of the second-factory view for page 4 (both relocation markers visible)
z4 = load('z4_plan_second'); W, H = z4.size; save('p_z4b', fit(z4.crop((0, int(H * .392), W, int(H * .80))), 1500), 82)
json.dump(out, open(O + 'sizes.json', 'w'), indent=1); print('p_z4b', out['p_z4b'])
