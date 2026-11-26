#!/usr/bin/env python3
"""開口（穴・切欠き）が、独立した実装（IfcOpenShell）で正しく引かれるかを確かめる。
  断面押し出し版（押し出し + 開口）の体積を、面の集まり版（ANGLEX の 3D の形そのもの）の体積と比べる。
  断面の角の丸みなどで両者にはもともと一定の差があるので、加工のない同じ断面の部材での比を基準にして、加工のある部材の比がそれと合うかを見る。
  IfcOpenShell の既定の形状エンジン（OpenCASCADE）は、版によっては開口を引かないことがあるため、CGAL のエンジンで確かめる。
使い方: python ifc_openings.py swept.ifc mesh.ifc "加工のある部材の名前" "加工のない同じ断面の部材の名前"   （結果は JSON）"""
import sys, json
import ifcopenshell, ifcopenshell.geom


def volume(g):
    verts, faces = g.verts, g.faces
    k = 1e9 if max(abs(x) for x in verts) < 50 else 1
    v = 0.0
    for i in range(0, len(faces), 3):
        a, b, c = faces[i] * 3, faces[i + 1] * 3, faces[i + 2] * 3
        ax, ay, az = verts[a:a + 3]; bx, by, bz = verts[b:b + 3]; cx, cy, cz = verts[c:c + 3]
        v += (ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)) / 6.0
    return abs(v) * k


def vol(f, name, kernel=None, openings=True):
    el = [e for e in f.by_type('IfcMember') if e.Name == name][0]
    s = ifcopenshell.geom.settings(); s.set('disable-opening-subtractions', not openings)
    sh = ifcopenshell.geom.create_shape(s, el, geometry_library=kernel) if kernel else ifcopenshell.geom.create_shape(s, el)
    n = len([r for r in f.by_type('IfcRelVoidsElement') if r.RelatingBuildingElement == el])
    return volume(sh.geometry), n


swept, mesh = ifcopenshell.open(sys.argv[1]), ifcopenshell.open(sys.argv[2])
cut, plain = sys.argv[3], sys.argv[4]
out = {'version': ifcopenshell.version, 'cut': cut, 'plain': plain}
try:
    out['mesh_cut'], _ = vol(mesh, cut); out['mesh_plain'], _ = vol(mesh, plain)
    out['swept_plain'], _ = vol(swept, plain, 'cgal'); out['swept_cut'], out['openings'] = vol(swept, cut, 'cgal')
    out['swept_cut_no_openings'], _ = vol(swept, cut, 'cgal', False)
    try:
        out['swept_cut_default_kernel'], _ = vol(swept, cut)
    except Exception as e:
        out['swept_cut_default_kernel'] = None
    base = out['swept_plain'] / out['mesh_plain']; got = out['swept_cut'] / out['mesh_cut']
    out['ratio_plain'] = round(base, 4); out['ratio_cut'] = round(got, 4); out['diff_pct'] = round(abs(got - base) * 100, 2)
    out['removed_mm3'] = round(out['swept_cut_no_openings'] - out['swept_cut']); out['removed_mesh_mm3'] = round(out['mesh_plain'] * out['swept_cut_no_openings'] / out['swept_plain'] - out['mesh_cut'])
    out['default_kernel_subtracts'] = bool(out['swept_cut_default_kernel'] and out['swept_cut_default_kernel'] < out['swept_cut_no_openings'] * 0.995)
    out['ok'] = out['diff_pct'] < 1.0 and out['removed_mm3'] > 1000
except Exception as e:
    out['error'] = str(e); out['ok'] = False
for k in ('mesh_cut', 'mesh_plain', 'swept_plain', 'swept_cut', 'swept_cut_no_openings', 'swept_cut_default_kernel'):
    if isinstance(out.get(k), float):
        out[k] = round(out[k])
print(json.dumps(out, ensure_ascii=False))
