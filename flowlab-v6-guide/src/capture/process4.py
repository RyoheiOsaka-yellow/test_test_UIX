"""Crops for the 3D-model-first guide (legacy FLOW LAB 3D screens + 2D map)."""
from PIL import Image
import os, sys, json
SP = sys.argv[1]; L = SP + '/legf/'; R = SP + '/raw/'; O = SP + '/img4/'
os.makedirs(O, exist_ok=True)
out = {}
def save(name, im, q=82):
    p = O + name + '.webp'; im.save(p, 'WEBP', quality=q, method=6)
    out[name] = {'w': im.size[0], 'h': im.size[1], 'kb': os.path.getsize(p) // 1024}
def load(n, d=L): return Image.open(d + n + '.png').convert('RGB')
def fit(im, w): return im if im.size[0] <= w else im.resize((w, round(im.size[1] * w / im.size[0])), Image.LANCZOS)
big = {'m_hero': 'L_ex_all', 'm_site_ui': 'L_site_ui', 'm_p1_close': 'I_p1_close', 'm_p1_ui': 'I_paint1_ui',
       'm_bim_ui': 'L_bim_ui', 'm_detail_ui': 'I_p1_detail_ui', 'm_section_ui': 'I_p1_section_ui', 'm_play_ui': 'L_play_cong_ui'}
for k, v in big.items(): save(k, fit(load(v), 2000))
mid = {'m_gate': 'L_ex_gate', 'm_wh': 'L_ex_wh', 'm_tanks': 'L_ex_tanks', 'm_sunset': 'L_ex_sunset',
       'm_bim': 'L_bim_clean', 'm_mep': 'I_p1_mep', 'm_clash_ui': 'L_clash_ui', 'm_section': 'I_p1_section',
       'm_walk': 'I_p1_walk', 'm_draw': 'I_p1_draw', 'm_draw_site': 'L_draw_site', 'm_play': 'L_play_cong', 'm_p1_play': 'I_p1_play',
       'm_tint': 'I_tint', 'm_varnish': 'I_varnish', 'm_lab': 'I_lab', 'm_whGen': 'I_whGen'}
for k, v in mid.items(): save(k, fit(load(v), 1300))
save('m_paint2', fit(load('I_paint2').crop((700, 380, 2500, 1392)), 1300))
for n in ['P_ana', 'P_stats_p1', 'P_ws_ledger', 'P_ws_conn', 'P_ws_check', 'P_ws_detail', 'P_sch', 'P_clash']:
    save('m_' + n[2:].lower(), load(n), 84)
save('m_map2d', fit(load('d02_dash', R).crop((110, 1040, 1942, 2226)), 1500), 82)
json.dump(out, open(O + 'sizes.json', 'w'), indent=1)
print(len(out), 'total KB', sum(v['kb'] for v in out.values()))
