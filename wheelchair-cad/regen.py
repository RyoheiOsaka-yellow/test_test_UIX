#!/usr/bin/env python3
"""One-command regeneration: dashboard parameter JSON -> CadQuery -> studio build.

  python3 regen.py params.json          # params.json = 「設計 → CAD 再生成パラメータを書き出し」で得た JSON
  python3 regen.py                      # 既定パラメータで再生成
  python3 regen.py params.json --step   # STEP アセンブリも書き出す
"""
import subprocess, sys, os, time
here = os.path.dirname(os.path.abspath(__file__))
args = [a for a in sys.argv[1:] if not a.startswith('--')]; flags = [a for a in sys.argv[1:] if a.startswith('--')]
cmd = [sys.executable, os.path.join(here, 'wheelchair_cad.py'), '0.7'] + flags
if args: cmd += ['--params', os.path.abspath(args[0])]
t = time.time()
for c in (cmd, [sys.executable, os.path.join(here, 'gen_js.py')], ['bash', os.path.join(here, '..', 'studio-core', 'build.sh')]):
    print('▶', ' '.join(os.path.relpath(x) if os.path.exists(x) else x for x in c), flush=True)
    r = subprocess.run(c, cwd=here); 
    if r.returncode: sys.exit(r.returncode)
print(f'done in {time.time()-t:.0f}s → wheelchair-studio/index.html (CAD モードで確認)')
