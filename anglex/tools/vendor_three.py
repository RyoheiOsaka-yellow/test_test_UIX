# three.js の addons（examples/jsm）を依存関係ごと取得して vendor/three/ に保存する（オフライン版ビルド用）
import re, subprocess, pathlib, sys
ROOT = pathlib.Path(__file__).resolve().parent.parent; VEN = ROOT / 'vendor' / 'three'; VER = '0.180.0'
BASE = f'https://cdn.jsdelivr.net/npm/three@{VER}/'
ENTRIES = ['examples/jsm/controls/OrbitControls.js', 'examples/jsm/controls/TransformControls.js', 'examples/jsm/environments/RoomEnvironment.js', 'examples/jsm/libs/fflate.module.js', 'examples/jsm/loaders/RGBELoader.js', 'examples/jsm/postprocessing/EffectComposer.js', 'examples/jsm/postprocessing/GTAOPass.js', 'examples/jsm/postprocessing/OutputPass.js', 'examples/jsm/postprocessing/RenderPass.js', 'examples/jsm/postprocessing/SMAAPass.js', 'examples/jsm/renderers/CSS2DRenderer.js', 'examples/jsm/exporters/GLTFExporter.js', 'examples/jsm/loaders/FBXLoader.js', 'examples/jsm/loaders/GLTFLoader.js', 'examples/jsm/loaders/OBJLoader.js', 'examples/jsm/loaders/STLLoader.js']
IMP = re.compile(r"""((?:import|export)\s*(?:[^'";]*?\s*from\s*)?['"])([^'"]+)(['"])""")
def fetch(rel):
    out = VEN / rel
    if out.exists() and out.stat().st_size > 0: return out.read_text(encoding='utf-8')
    out.parent.mkdir(parents=True, exist_ok=True)
    r = subprocess.run(['curl', '-sSL', '--max-time', '120', '-o', str(out), BASE + rel]); 
    if r.returncode or not out.exists() or out.stat().st_size == 0: raise SystemExit('fetch failed ' + rel)
    return out.read_text(encoding='utf-8')
seen = set(); todo = list(ENTRIES)
while todo:
    rel = todo.pop()
    if rel in seen: continue
    seen.add(rel); src = fetch(rel)
    for m in IMP.finditer(src):
        spec = m.group(2)
        if spec.startswith('.'):
            tgt = (pathlib.PurePosixPath(rel).parent / spec); parts = []
            for p in str(tgt).split('/'):
                if p == '..': parts.pop()
                elif p and p != '.': parts.append(p)
            todo.append('/'.join(parts))
        elif spec == 'three': pass
        else: print('external spec', spec, 'in', rel)
print('vendored', len(seen), 'modules under', VEN)
