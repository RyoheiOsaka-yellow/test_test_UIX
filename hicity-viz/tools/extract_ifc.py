#!/usr/bin/env python3
"""Extract per-storey 2D floor plans (slab polygons + wall outlines) from HIC IFC models."""
import ifcopenshell, ifcopenshell.geom
import ifcopenshell.util.element as uel
import numpy as np, json, time, os, sys
from shapely.geometry import Polygon, MultiPolygon
from shapely.ops import unary_union

SP = os.path.dirname(os.path.abspath(__file__))
BUILDINGS = {'b1': 'A', 'b2': 'B', 'b3': 'C', 'b4': 'D', 'b5': 'E'}  # b4 file is "_5"

def tri_polys(verts, faces):
    """triangles -> list of shapely polygons (projected to XY), skipping degenerate."""
    polys = []
    v = verts
    for i in range(0, len(faces), 3):
        a, b, c = v[faces[i]], v[faces[i+1]], v[faces[i+2]]
        p = Polygon([(a[0], a[1]), (b[0], b[1]), (c[0], c[1])])
        if p.is_valid and p.area > 1e-4:
            polys.append(p)
    return polys

def rings_of(geom, simp=0.08):
    """shapely geom -> list of rings [[x,y],...] (exterior + holes), simplified."""
    out = []
    geoms = geom.geoms if isinstance(geom, MultiPolygon) else [geom]
    for g in geoms:
        g = g.simplify(simp)
        if g.is_empty or g.area < 0.5: continue
        if g.geom_type != 'Polygon': continue
        out.append([[round(x, 2), round(y, 2)] for x, y in g.exterior.coords])
        for hole in g.interiors:
            h = Polygon(hole)
            if h.area > 1.0:
                out.append([[round(x, 2), round(y, 2)] for x, y in hole.coords])
    return out

def process(key):
    path = f'{SP}/data/{key}.ifc'
    f = ifcopenshell.open(path)
    storeys = {s.id(): (s.Name, (s.Elevation or 0)/1000.0) for s in f.by_type('IfcBuildingStorey')}
    s = ifcopenshell.geom.settings()
    s.set('use-world-coords', True)
    include = (f.by_type('IfcSlab') + f.by_type('IfcWallStandardCase') + f.by_type('IfcWall')
               + f.by_type('IfcCurtainWall') + f.by_type('IfcStairFlight') + f.by_type('IfcStair'))
    it = ifcopenshell.geom.iterator(s, f, 4, include=include)
    buckets = {}  # (storey_id, kind) -> [polys]
    id2el = {e.id(): e for e in include}
    n = 0; t0 = time.time()
    if it.initialize():
        while True:
            sh = it.get()
            el = id2el.get(sh.id)
            if el is not None:
                cont = uel.get_container(el)
                sid = cont.id() if cont is not None and cont.is_a('IfcBuildingStorey') else None
                if sid is not None:
                    cls = el.is_a()
                    kind = ('slab' if cls == 'IfcSlab' else
                            'glass' if cls == 'IfcCurtainWall' else
                            'stair' if 'Stair' in cls else 'wall')
                    verts = np.array(sh.geometry.verts).reshape(-1, 3)
                    faces = sh.geometry.faces
                    if len(verts):
                        buckets.setdefault((sid, kind), []).extend(tri_polys(verts, faces))
            n += 1
            if not it.next(): break
    print(key, 'shapes', n, 'time', round(time.time()-t0, 1), flush=True)
    out = {'name': BUILDINGS[key], 'storeys': {}}
    for (sid, kind), polys in buckets.items():
        sname, elev = storeys[sid]
        st = out['storeys'].setdefault(sname, {'z': elev})
        u = unary_union(polys)
        # walls/glass keep finer detail, slabs coarser
        simp = 0.05 if kind in ('wall', 'glass') else 0.1
        st[kind] = rings_of(u, simp)
    return out

result = {}
for key in BUILDINGS:
    result[key] = process(key)
with open(f'{SP}/plans.json', 'w') as fp:
    json.dump(result, fp, separators=(',', ':'))
print('size', os.path.getsize(f'{SP}/plans.json'))
for k, v in result.items():
    for sn, st in sorted(v['storeys'].items(), key=lambda x: x[1]['z']):
        print(k, v['name'], sn, st['z'], {kk: len(vv) for kk, vv in st.items() if kk != 'z'})
