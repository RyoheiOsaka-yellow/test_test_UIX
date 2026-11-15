#!/usr/bin/env python3
"""検証用の IFC を、ANGLEX とは別の実装（IfcOpenShell）で書く。鉄骨 CAD の書き出しに近い形:
IfcBeam / IfcColumn / IfcMember / IfcPlate に、規格の断面定義（IfcIShapeProfileDef など）を押し出した形状と、開口（IfcOpeningElement）を付ける。
dev/flows/ux22.js が「IFC を読む → 立体から部材へ変換」の確認に使う。
準備: pip install ifcopenshell     実行: python dev/external/make_ifc_steel.py dev/samples/ifc"""
import sys, json, math
import ifcopenshell, ifcopenshell.guid

out = sys.argv[1] if len(sys.argv) > 1 else '.'


def build(schema):
    f = ifcopenshell.file(schema=schema)
    new = f.create_entity
    gid = ifcopenshell.guid.new
    P = lambda *v: new('IfcCartesianPoint', [float(x) for x in v])
    D = lambda *v: new('IfcDirection', [float(x) for x in v])
    A3 = lambda o=(0, 0, 0), z=(0, 0, 1), x=(1, 0, 0): new('IfcAxis2Placement3D', P(*o), D(*z), D(*x))
    A2 = lambda: new('IfcAxis2Placement2D', new('IfcCartesianPoint', [0., 0.]), new('IfcDirection', [1., 0.]))
    person = new('IfcPerson', FamilyName='Tester'); org = new('IfcOrganization', Name='External')
    pao = new('IfcPersonAndOrganization', person, org)
    app = new('IfcApplication', org, '1.0', 'IfcOpenShell sample writer', 'IOS-SAMPLE')
    oh = new('IfcOwnerHistory', OwningUser=pao, OwningApplication=app, ChangeAction='ADDED', LastModifiedDate=1700000000, CreationDate=1700000000)
    units = new('IfcUnitAssignment', [new('IfcSIUnit', UnitType='LENGTHUNIT', Prefix='MILLI', Name='METRE'), new('IfcSIUnit', UnitType='PLANEANGLEUNIT', Name='RADIAN')])
    ctx = new('IfcGeometricRepresentationContext', ContextType='Model', CoordinateSpaceDimension=3, Precision=1e-5, WorldCoordinateSystem=A3())
    proj = new('IfcProject', gid(), oh, 'Steel sample', RepresentationContexts=[ctx], UnitsInContext=units)
    lp0 = new('IfcLocalPlacement', None, A3())
    site = new('IfcSite', gid(), oh, 'Site', ObjectPlacement=lp0, CompositionType='ELEMENT')
    bld = new('IfcBuilding', gid(), oh, 'Building', ObjectPlacement=new('IfcLocalPlacement', lp0, A3()), CompositionType='ELEMENT')
    st = new('IfcBuildingStorey', gid(), oh, '1F', ObjectPlacement=new('IfcLocalPlacement', lp0, A3()), CompositionType='ELEMENT', Elevation=0.)
    new('IfcRelAggregates', gid(), oh, RelatingObject=proj, RelatedObjects=[site])
    new('IfcRelAggregates', gid(), oh, RelatingObject=site, RelatedObjects=[bld])
    new('IfcRelAggregates', gid(), oh, RelatingObject=bld, RelatedObjects=[st])
    elems = []

    def element(cls, name, profile, length, origin, zdir, xdir, holes=()):
        """holes: (中心 x, y, z（部材のローカル座標）, 穴の向き 'x' か 'y', 径)"""
        solid = new('IfcExtrudedAreaSolid', profile, A3(), D(0, 0, 1), float(length))
        rep = new('IfcShapeRepresentation', ctx, 'Body', 'SweptSolid', [solid])
        lp = new('IfcLocalPlacement', lp0, A3(origin, zdir, xdir))
        kw = dict(GlobalId=gid(), OwnerHistory=oh, Name=name, ObjectPlacement=lp, Representation=new('IfcProductDefinitionShape', None, None, [rep]), Tag=name)
        el = new(cls, **kw); elems.append(el)
        for (x, y, z, ax, d) in holes:
            circ = new('IfcCircleProfileDef', 'AREA', None, A2(), d / 2)
            pos = A3((x - 30, y, z), (1, 0, 0), (0, 1, 0)) if ax == 'x' else A3((x, y - 30, z), (0, 1, 0), (0, 0, 1))
            hs = new('IfcExtrudedAreaSolid', circ, pos, D(0, 0, 1), 60.)
            hrep = new('IfcShapeRepresentation', ctx, 'Body', 'SweptSolid', [hs])
            op = new('IfcOpeningElement', gid(), oh, 'hole', ObjectPlacement=new('IfcLocalPlacement', lp, A3()), Representation=new('IfcProductDefinitionShape', None, None, [hrep]))
            new('IfcRelVoidsElement', gid(), oh, RelatingBuildingElement=el, RelatedOpeningElement=op)
        return el

    exp = []
    # 1) H 形鋼の梁 H-100x100x6x8 L=1200（X 向き）: ウェブに φ18 × 2
    pI = new('IfcIShapeProfileDef', 'AREA', 'H-100x100x6x8', A2(), 100., 100., 6., 8., 8.)
    element('IfcBeam', 'B1', pI, 1200, (0, 0, 3000), (1, 0, 0), (0, 1, 0), [(0, 0, 200, 'x', 18), (0, 0, 1000, 'x', 18)])
    exp.append({'spec': 'H-100x100x6x8', 'length': 1200, 'holes': 2, 'cls': 'IfcBeam'})
    # 2) 山形鋼 L-65x65x6 L=800（斜め 30°）: 水平の脚に φ14 × 2
    pL = new('IfcLShapeProfileDef', 'AREA', 'L-65x65x6', A2(), 65., 65., 6., 8.5, 4.)
    c, s = math.cos(math.radians(30)), math.sin(math.radians(30))
    element('IfcMember', 'M1', pL, 800, (500, 800, 2500), (c, s, 0), (-s, c, 0), [(0, -29.5, 150, 'y', 14), (0, -29.5, 650, 'y', 14)])
    exp.append({'spec': 'L-65x65x6', 'length': 800, 'holes': 2, 'cls': 'IfcMember'})
    # 3) 溝形鋼 [-100x50x5x7.5 L=900（Y 向き）: ウェブに φ14 × 1
    pU = new('IfcUShapeProfileDef', 'AREA', '[-100x50x5x7.5', A2(), 100., 50., 5., 7.5, None, None, None)
    element('IfcMember', 'M2', pU, 900, (-600, 0, 2800), (0, 1, 0), (0, 0, 1), [(-22.5, 0, 450, 'x', 14)])
    exp.append({'spec': '[-100x50x5x7.5', 'length': 900, 'holes': 1, 'cls': 'IfcMember'})
    # 4) 角形鋼管の柱 □-75x75x3.2 L=2500（鉛直）
    pR = new('IfcRectangleHollowProfileDef', 'AREA', 'SQ-75x75x3.2', A2(), 75., 75., 3.2, None, None)
    element('IfcColumn', 'C1', pR, 2500, (1500, 0, 0), (0, 0, 1), (1, 0, 0))
    exp.append({'spec': '□-75x75x3.2', 'length': 2500, 'holes': 0, 'cls': 'IfcColumn'})
    # 5) 鋼管 φ48.6x2.3 L=1000（斜め）
    pC = new('IfcCircleHollowProfileDef', 'AREA', 'STK-48.6x2.3', A2(), 24.3, 2.3)
    n = 1 / math.sqrt(2)
    element('IfcMember', 'M3', pC, 1000, (2000, 500, 1000), (n, 0, n), (0, 1, 0))
    exp.append({'spec': 'STK-48.6x2.3', 'length': 1000, 'holes': 0, 'cls': 'IfcMember'})
    # 6) 板 PL-9x200x150（水平）: φ18 × 4
    pP = new('IfcRectangleProfileDef', 'AREA', 'PL-9', A2(), 200., 150.)
    element('IfcPlate', 'P1', pP, 9, (1500, 0, 2500), (0, 0, 1), (1, 0, 0), [])
    pl = elems[-1]
    lp = pl.ObjectPlacement
    for (x, y) in [(-70, -45), (70, -45), (-70, 45), (70, 45)]:
        circ = new('IfcCircleProfileDef', 'AREA', None, A2(), 9.)
        hs = new('IfcExtrudedAreaSolid', circ, A3((x, y, -10)), D(0, 0, 1), 30.)
        op = new('IfcOpeningElement', gid(), oh, 'hole', ObjectPlacement=new('IfcLocalPlacement', lp, A3()), Representation=new('IfcProductDefinitionShape', None, None, [new('IfcShapeRepresentation', ctx, 'Body', 'SweptSolid', [hs])]))
        new('IfcRelVoidsElement', gid(), oh, RelatingBuildingElement=pl, RelatedOpeningElement=op)
    exp.append({'spec': 'PL-9x200x150', 'length': 200, 'holes': 4, 'cls': 'IfcPlate', 'alt': 'PL-9x150x200'})
    # 7) 平鋼 FB-6x50 L=400
    pF = new('IfcRectangleProfileDef', 'AREA', 'FB-6x50', A2(), 50., 6.)
    element('IfcMember', 'M4', pF, 400, (0, 1500, 2000), (0, 1, 0), (1, 0, 0))
    exp.append({'spec': 'FB-6x50', 'length': 400, 'holes': 0, 'cls': 'IfcMember'})
    new('IfcRelContainedInSpatialStructure', gid(), oh, RelatedElements=elems, RelatingStructure=st)
    return f, exp


for schema in ['IFC2X3', 'IFC4']:
    f, exp = build(schema)
    f.write(f'{out}/steel_external_{schema.lower()}.ifc')
    print('wrote', schema, len(exp), 'elements')
json.dump(exp, open(f'{out}/expected.json', 'w'), ensure_ascii=False, indent=1)
