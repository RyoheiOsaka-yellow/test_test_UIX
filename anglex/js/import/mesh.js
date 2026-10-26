// 3D メッシュ形式（Revit/Rebro/Tfas 等からのエクスポート）: glTF/GLB, OBJ, STL, FBX, 3DM(未対応→案内)
import * as THREE from 'three';
export async function loadMesh(file) {
  const ext = file.name.split('.').pop().toLowerCase(); const buf = await file.arrayBuffer();
  if (ext === 'glb' || ext === 'gltf') { const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js'); const l = new GLTFLoader(); const g = await new Promise((res, rej) => l.parse(buf, '', res, rej)); return finish(g.scene, 'glTF', 1000); }
  if (ext === 'obj') { const { OBJLoader } = await import('three/addons/loaders/OBJLoader.js'); const o = new OBJLoader().parse(new TextDecoder().decode(buf)); return finish(o, 'OBJ', 1); }
  if (ext === 'stl') { const { STLLoader } = await import('three/addons/loaders/STLLoader.js'); const geo = new STLLoader().parse(buf); const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x9aa4ae, metalness: 0.5, roughness: 0.6 })); return finish(m, 'STL', 1); }
  if (ext === 'fbx') { const { FBXLoader } = await import('three/addons/loaders/FBXLoader.js'); const o = new FBXLoader().parse(buf, ''); return finish(o, 'FBX', 10); }
  throw new Error('未対応の3D形式: ' + ext);
}
function finish(obj, kind, scaleGuess) { obj.traverse(o => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; if (!o.material || !o.material.isMeshStandardMaterial) o.material = new THREE.MeshStandardMaterial({ color: 0x9aa4ae, metalness: 0.5, roughness: 0.6 }); } });
  const box = new THREE.Box3().setFromObject(obj); const size = box.getSize(new THREE.Vector3()).length(); // 単位推定: 1〜50 なら m とみなし ×1000
  const scale = size > 0 && size < 60 ? 1000 : size < 600 ? 10 : 1; obj.scale.setScalar(scale); const names = []; obj.traverse(o => { if (o.name) names.push(o.name); }); return { object: obj, kind, scale, names, bbox: new THREE.Box3().setFromObject(obj) }; }
