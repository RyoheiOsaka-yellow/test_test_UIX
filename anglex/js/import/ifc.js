// IFC 読込: web-ifc（WASM）でジオメトリ＋プロパティ抽出。IfcMember / IfcPlate / IfcBeam / IfcColumn / IfcPipeSegment / IfcMechanicalFastener をサポート部材候補に
import * as THREE from 'three';
let ifcApi = null;
export async function loadWebIfc() { if (ifcApi) return ifcApi; const mod = await import('https://cdn.jsdelivr.net/npm/web-ifc@0.0.66/web-ifc-api.js'); const api = new mod.IfcAPI(); api.SetWasmPath('https://cdn.jsdelivr.net/npm/web-ifc@0.0.66/', true); await api.Init(); ifcApi = { api, mod }; return ifcApi; }
export async function parseIFC(arrayBuffer, { onProgress = null } = {}) {
  const { api, mod } = await loadWebIfc(); const modelID = api.OpenModel(new Uint8Array(arrayBuffer), { COORDINATE_TO_ORIGIN: true });
  const group = new THREE.Group(); group.name = 'IFC'; const elements = []; const matCache = new Map();
  api.StreamAllMeshes(modelID, mesh => {
    const expressID = mesh.expressID; const placed = mesh.geometries; const sub = new THREE.Group(); sub.userData.expressID = expressID;
    for (let i = 0; i < placed.size(); i++) { const pg = placed.get(i); const geom = api.GetGeometry(modelID, pg.geometryExpressID); const verts = api.GetVertexArray(geom.GetVertexData(), geom.GetVertexDataSize()); const idx = api.GetIndexArray(geom.GetIndexData(), geom.GetIndexDataSize());
      const g = new THREE.BufferGeometry(); const pos = new Float32Array(verts.length / 2), nor = new Float32Array(verts.length / 2); for (let k = 0; k < verts.length; k += 6) { pos.set([verts[k], verts[k + 1], verts[k + 2]], k / 2); nor.set([verts[k + 3], verts[k + 4], verts[k + 5]], k / 2); } g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setIndex(new THREE.BufferAttribute(idx, 1));
      const c = pg.color; const key = [c.x, c.y, c.z, c.w].map(v => Math.round(v * 100)).join(','); if (!matCache.has(key)) matCache.set(key, new THREE.MeshStandardMaterial({ color: new THREE.Color(c.x, c.y, c.z), transparent: c.w < 1, opacity: c.w, roughness: 0.7, metalness: 0.2 })); const m = new THREE.Mesh(g, matCache.get(key)); const M = new THREE.Matrix4().fromArray(pg.flatTransformation); m.applyMatrix4(M); m.castShadow = m.receiveShadow = true; sub.add(m); geom.delete(); }
    sub.scale.setScalar(1000); // m → mm
    group.add(sub);
  });
  // 要素属性
  const typeNames = {}; for (const [k, v] of Object.entries(mod)) if (typeof v === 'number' && /^IFC[A-Z]+$/.test(k)) typeNames[v] = k;
  const supportTypes = ['IFCMEMBER', 'IFCPLATE', 'IFCBEAM', 'IFCCOLUMN', 'IFCPIPESEGMENT', 'IFCMECHANICALFASTENER', 'IFCDISCRETEACCESSORY', 'IFCELEMENTASSEMBLY', 'IFCBUILDINGELEMENTPROXY', 'IFCFLOWSEGMENT'];
  for (const tn of supportTypes) { const code = mod[tn]; if (!code) continue; const ids = api.GetLineIDsWithType(modelID, code); for (let i = 0; i < ids.size(); i++) { const id = ids.get(i); try { const line = api.GetLine(modelID, id); const props = await propsOf(api, modelID, id); elements.push({ expressID: id, ifcType: tn, name: line.Name?.value || '', objectType: line.ObjectType?.value || '', tag: line.Tag?.value || '', props }); } catch (e) { } } }
  const project = (() => { try { const ids = api.GetLineIDsWithType(modelID, mod.IFCPROJECT); return ids.size() ? api.GetLine(modelID, ids.get(0)).Name?.value : null; } catch { return null; } })();
  api.CloseModel(modelID);
  return { group, elements, project, typeNames };
}
async function propsOf(api, modelID, id) { const out = {}; try { const rels = api.GetLineIDsWithType(modelID, 160246688 /* IFCRELDEFINESBYPROPERTIES */); for (let i = 0; i < rels.size(); i++) { const rel = api.GetLine(modelID, rels.get(i)); if (!rel.RelatedObjects?.some(o => o.value === id)) continue; const pset = api.GetLine(modelID, rel.RelatingPropertyDefinition.value); if (!pset.HasProperties) continue; for (const h of pset.HasProperties) { const pr = api.GetLine(modelID, h.value); if (pr.Name && pr.NominalValue) out[pr.Name.value] = pr.NominalValue.value; } } } catch (e) { } return out; }
