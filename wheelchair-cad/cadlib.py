"""Shared CadQuery helpers for the studio CAD pipeline."""
import math, json, base64, struct
import cadquery as cq
from cadquery import Vector as V

def bent_tube(points, ro, ri, radius=40.0):
    """Hollow tube swept along a polyline with rounded bends (true bent tubing)."""
    path = cq.Workplane("XY").polyline([tuple(p) for p in points])
    p0, p1 = V(*points[0]), V(*points[1])
    d = (p1 - p0).normalized()
    plane = cq.Plane(origin=p0.toTuple(), normal=d.toTuple())
    outer = cq.Workplane(plane).circle(ro).sweep(path, transition="round")
    if ri > 0:
        inner = cq.Workplane(plane).circle(ri).sweep(cq.Workplane("XY").polyline([tuple(p) for p in points]), transition="round")
        return outer.cut(inner)
    return outer

def straight_tube(a, b, ro, ri=0.0):
    a, b = V(*a), V(*b); d = b - a; L = d.Length
    plane = cq.Plane(origin=a.toTuple(), normal=d.normalized().toTuple())
    wp = cq.Workplane(plane).circle(ro)
    if ri > 0: wp = wp.circle(ri)
    return wp.extrude(L)

def hex_bolt(d, L, head_h=None, af=None):
    """Hex head bolt along +Z, head at z<0."""
    af = af or {5: 8, 6: 10, 8: 13, 10: 17}.get(d, d * 1.6)
    head_h = head_h or d * 0.7
    head = cq.Workplane("XY").polygon(6, af / math.cos(math.pi / 6)).extrude(-head_h)
    shaft = cq.Workplane("XY").circle(d / 2).extrude(L)
    return head.union(shaft)

def hex_nut(d, af=None, h=None):
    af = af or {5: 8, 6: 10, 8: 13, 10: 17}.get(d, d * 1.6)
    h = h or d * 0.8
    return cq.Workplane("XY").polygon(6, af / math.cos(math.pi / 6)).extrude(h).faces(">Z").workplane().hole(d)

def socket_cap(d, L):
    head = cq.Workplane("XY").circle(d * 0.8).extrude(-d).faces("<Z").workplane().polygon(6, d * 0.6).cutBlind(-d * 0.6)
    return head.union(cq.Workplane("XY").circle(d / 2).extrude(L))

ROT_Z_TO_Y=[((1,0,0),-90)]
ROT_Z_TO_X=[((0,1,0),90)]

def place(shape, loc=(0, 0, 0), rot=None):
    """rot: list of (axis_vec, angle_deg) applied in order about origin, then translate."""
    s = shape.val() if isinstance(shape, cq.Workplane) else shape
    if rot:
        for ax, ang in rot:
            s = s.rotate(V(0, 0, 0), V(*ax), ang)
    return s.translate(V(*loc))

def mirror_y(solid):
    return solid.mirror("XZ")

# ---------- export ----------
def to_three(v):  # CadQuery Z-up (x fwd, y lateral, z up) -> three.js Y-up (x fwd, y up, z lateral)
    return (v[0], v[2], -v[1])

def tessellate(solid, tol=0.8, ang=0.5):
    verts, tris = solid.tessellate(tol, ang)
    pos = []
    for v in verts:
        x, y, z = to_three((v.x, v.y, v.z)); pos += [x, y, z]
    idx = [i for t in tris for i in t]
    # swap winding because the axis map (x,z,-y) is a proper rotation? det(+1) -> keep
    return pos, idx

def b64f32(arr): return base64.b64encode(struct.pack('<%df' % len(arr), *arr)).decode()
def b64u32(arr): return base64.b64encode(struct.pack('<%dI' % len(arr), *arr)).decode()

def mesh_record(solid, ex=(0, 0, 0), tol=0.8, ang=0.5):
    pos, idx = tessellate(solid, tol, ang)
    c = solid.Center()
    return {"p": b64f32(pos), "i": b64u32(idx), "n": len(idx) // 3, "vol": solid.Volume(),
            "cog": to_three((c.x, c.y, c.z)), "ex": to_three(ex)}
