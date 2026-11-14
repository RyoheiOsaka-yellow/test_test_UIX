#!/usr/bin/env python3
"""ANGLEX が書き出した IFC を、独立した実装（IfcOpenShell）で検証する。
  1) スキーマ検証（属性の数・型・WHERE ルール）
  2) 形状の生成（押し出し・開口のブーリアン演算を含む）→ 要素ごとの外形寸法と体積
  3) 2 ファイルを渡すと、同じ GlobalId の要素どうしで外形と体積を比べる（面の集まり版 ⇔ 断面押し出し版）
使い方: python ifc_check.py a.ifc [b.ifc]   （結果は JSON で標準出力へ）
準備:   pip install ifcopenshell"""
import sys, json, multiprocessing
import ifcopenshell, ifcopenshell.validate, ifcopenshell.geom

def volume(verts, faces):
    v = 0.0
    for i in range(0, len(faces), 3):
        a, b, c = faces[i] * 3, faces[i + 1] * 3, faces[i + 2] * 3
        ax, ay, az = verts[a], verts[a + 1], verts[a + 2]; bx, by, bz = verts[b], verts[b + 1], verts[b + 2]; cx, cy, cz = verts[c], verts[c + 1], verts[c + 2]
        v += (ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)) / 6.0
    return abs(v)

def load(path):
    f = ifcopenshell.open(path)
    logger = ifcopenshell.validate.json_logger()
    ifcopenshell.validate.validate(f, logger, express_rules=True)
    errs = [str(s.get('message', s))[:240] for s in logger.statements]
    counts = {}
    for e in f:
        counts[e.is_a()] = counts.get(e.is_a(), 0) + 1
    settings = ifcopenshell.geom.settings(); settings.set('use-world-coords', True)
    elems = {}; failed = []
    it = ifcopenshell.geom.iterator(settings, f, max(1, multiprocessing.cpu_count() // 2))
    if it.initialize():
        while True:
            sh = it.get(); g = sh.geometry; verts = g.verts; faces = g.faces
            if len(verts) >= 9:
                xs, ys, zs = verts[0::3], verts[1::3], verts[2::3]
                # IfcOpenShell の形状は m 単位 → mm へ
                elems[sh.guid] = {'type': sh.type, 'name': sh.name, 'min': [min(xs) * 1000, min(ys) * 1000, min(zs) * 1000], 'max': [max(xs) * 1000, max(ys) * 1000, max(zs) * 1000], 'vol': volume(verts, faces) * 1e9, 'tris': len(faces) // 3}
            else:
                failed.append(sh.guid)
            if not it.next():
                break
    products = [e for e in f.by_type('IfcElement') if e.Representation is not None and not e.is_a('IfcOpeningElement')]
    missing = [e.GlobalId for e in products if e.GlobalId not in elems]
    psets = sum(1 for _ in f.by_type('IfcPropertySet'))
    sample = None
    for e in f.by_type('IfcMember')[:1]:
        import ifcopenshell.util.element as U
        ps = U.get_psets(e); mat = U.get_material(e)
        sample = {'name': e.Name, 'psets': {k: {kk: vv for kk, vv in list(v.items())[:8]} for k, v in ps.items()}, 'material': mat.is_a() if mat else None, 'material_name': getattr(mat, 'Name', None) if mat else None}
    return {'file': path.split('/')[-1], 'schema': f.schema, 'entities': sum(counts.values()), 'counts': {k: counts[k] for k in sorted(counts) if k in ('IfcProject', 'IfcBuildingStorey', 'IfcElementAssembly', 'IfcMember', 'IfcPlate', 'IfcPipeSegment', 'IfcMechanicalFastener', 'IfcFastener', 'IfcBuildingElementProxy', 'IfcOpeningElement', 'IfcRelVoidsElement', 'IfcExtrudedAreaSolid', 'IfcTriangulatedFaceSet', 'IfcLShapeProfileDef', 'IfcUShapeProfileDef', 'IfcRectangleProfileDef', 'IfcCircleHollowProfileDef', 'IfcMaterialProfileSet', 'IfcPropertySet')}, 'validation_errors': len(errs), 'validation_samples': errs[:8], 'geometry_ok': len(elems), 'geometry_failed': len(failed) + len(missing), 'products': len(products), 'psets': psets, 'sample': sample}, elems

def main():
    a, ea = load(sys.argv[1]); out = {'a': a}
    if len(sys.argv) > 2:
        b, eb = load(sys.argv[2]); out['b'] = b
        rows = []; worst_box = 0.0; worst_vol = 0.0
        for gid, x in ea.items():
            y = eb.get(gid)
            if not y: continue
            dbox = max(max(abs(x['min'][i] - y['min'][i]), abs(x['max'][i] - y['max'][i])) for i in range(3))
            dvol = abs(x['vol'] - y['vol']) / max(x['vol'], 1e-9) * 100
            rows.append({'name': x['name'], 'type': x['type'], 'dbox_mm': round(dbox, 3), 'vol_a_mm3': round(x['vol']), 'vol_b_mm3': round(y['vol']), 'dvol_pct': round(dvol, 2)})
        steel = [r for r in rows if r['type'] in ('IfcMember', 'IfcPlate', 'IfcPipeSegment')]
        out['compare'] = {'matched': len(rows), 'steel': len(steel), 'max_dbox_mm': max([r['dbox_mm'] for r in steel] or [0]), 'max_dvol_pct': max([r['dvol_pct'] for r in steel] or [0]), 'worst': sorted(steel, key=lambda r: -max(r['dbox_mm'], r['dvol_pct']))[:6], 'rows': steel, 'total_vol_a_mm3': round(sum(r['vol_a_mm3'] for r in steel)), 'total_vol_b_mm3': round(sum(r['vol_b_mm3'] for r in steel))}
    print(json.dumps(out, ensure_ascii=False))

if __name__ == '__main__':
    main()
