// ================= 人物モデル（Quaternius, CC0）：歩行・待機アニメ付きの作業者と、着席者の一括ベイク =================
// 読込前・読込失敗時は従来の手続き人形（fallback）を表示する。
const CHAR_FILES = { worker_m:"models/worker_m.glb", worker_f:"models/worker_f.glb", casual_m:"models/casual_m.glb", casual_f:"models/casual_f.glb" };
const PEOPLE = { cache:{}, list:[], seated:[], count:0, baked:0 };
const SKIN_TONES = [0xf1c9a5, 0xe7b48f, 0xd9a47c, 0xc68e6a];
const P_SHIRT = [0xe9ecef, 0x9fb7d4, 0x5b7fa6, 0x2f3f57, 0xb9c4a0, 0xd9b99b, 0x7a8894, 0xc86b5a];
const P_PANTS = [0x2a3345, 0x3a3f4a, 0x55606e, 0x6a5a48, 0x1f2630];
const P_HAIR  = [0x2a211c, 0x3b2a1e, 0x1a1a1a, 0x5a4632, 0x6b6b6b];
function loadChar(k){ if (!PEOPLE.cache[k]) PEOPLE.cache[k] = assetLoader().loadAsync(CHAR_FILES[k]).then(g => { g.scene.updateMatrixWorld(true); const bb = new THREE.Box3().setFromObject(g.scene); return { scene:g.scene, anims:g.animations, h:bb.max.y - bb.min.y }; }); return PEOPLE.cache[k]; }
// 役割ごとの配色。hall: 紺の作業服＋高視認ベスト＋ヘルメット、office: 私服
function outfit(kind, rnd){ const pick = a => a[Math.floor(rnd() * a.length)];
  return kind === "hall" ? { Skin:pick(SKIN_TONES), Shirt:0x2b3a55, Vest: rnd() < 0.7 ? 0xf28c28 : 0xd7e03a, Pants:0x1f2a40, Hat: rnd() < 0.75 ? 0xf6d33b : 0xf2f2f0, Face:0x1c1c1c, Hair:pick(P_HAIR), Belt:0x2a2a2a }
                         : { Skin:pick(SKIN_TONES), Shirt:pick(P_SHIRT), Vest:pick(P_SHIRT), Pants:pick(P_PANTS), Hat:0x39424e, Face:0x1c1c1c, Hair:pick(P_HAIR), Belt:0x3a2a1e }; }
function dressChar(root, of){ root.traverse(o => { if (!o.isMesh) return; const m = o.material.clone(); const c = of[m.name]; if (c !== undefined) m.color.set(c); m.roughness = 0.85; m.metalness = 0; o.material = m; o.castShadow = true; o.receiveShadow = false; o.frustumCulled = false; }); }

// ---- 動く人物：手続き人形の Group を holder にして、読込後に差し替える ----
function makePerson(kind = "hall"){
  const g = makeWorker(kind); const idx = PEOPLE.count++; const rnd = sRand("person" + idx); const female = rnd() < 0.35; const key = (kind === "hall" ? "worker_" : "casual_") + (female ? "f" : "m");
  g.userData.person = { kind, key, blend:0, ready:false }; g.userData.layer = "people";
  loadChar(key).then(ch => { const root = SkeletonUtils.clone(ch.scene); const s = (1.66 + rnd() * 0.12) / ch.h; root.scale.setScalar(s); dressChar(root, outfit(kind, rnd));
    g.children.forEach(c => { c.visible = false; }); g.add(root);
    const mx = new THREE.AnimationMixer(root); const idle = mx.clipAction(ch.anims.find(a => a.name === "Idle")); const walk = mx.clipAction(ch.anims.find(a => a.name === "Walk"));
    idle.play(); walk.play(); idle.time = rnd() * 4; walk.setEffectiveWeight(0); mx.update(0);
    Object.assign(g.userData.person, { mx, idle, walk, root, ready:true }); PEOPLE.list.push(g); dirtyShadow(); }).catch(err => console.warn("character load failed", key, err?.message || err));
  return g;
}
const _pwp = new THREE.Vector3();
function updatePeople(dt){ const cp = camera.position;
  for (let i = PEOPLE.list.length - 1; i >= 0; i--){ const g = PEOPLE.list[i]; const p = g.userData.person; let vis = true, top = g; for (let o = g; o; o = o.parent){ if (!o.visible) vis = false; top = o; } if (top !== scene){ PEOPLE.list.splice(i, 1); continue; } if (!vis) continue;
    g.getWorldPosition(_pwp); if (_pwp.distanceToSquared(cp) > 160 * 160) continue;   // 遠景はアニメ更新を省く
    const target = g.userData.moving ? 1 : 0; p.blend += (target - p.blend) * Math.min(1, dt * 6); p.walk.setEffectiveWeight(p.blend); p.idle.setEffectiveWeight(1 - p.blend);
    p.walk.timeScale = clamp((g.userData.speed || 0.9) / 0.85, 0.8, 1.7); p.mx.update(dt); } }

// ---- 着席者：SitDown の最終姿勢を静的ジオメトリに焼き、階ごとに 1 メッシュへ結合（描画 1 回）----
function bakePose(ch, clipName){ const root = SkeletonUtils.clone(ch.scene); const mx = new THREE.AnimationMixer(root); const clip = ch.anims.find(a => a.name === clipName); const act = mx.clipAction(clip); act.setLoop(THREE.LoopOnce); act.clampWhenFinished = true; act.play(); mx.setTime(clip.duration * 0.999);
  root.updateMatrixWorld(true); const anchor = new THREE.Vector3(); root.traverse(o => { if (o.isBone && o.name === "Hips") o.getWorldPosition(anchor); });
  const parts = []; const v = new THREE.Vector3(); let minY = Infinity;
  root.traverse(o => { if (!o.isSkinnedMesh) return; o.skeleton.update(); const src = o.geometry, pos = src.attributes.position, out = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++){ o.getVertexPosition(i, v); v.applyMatrix4(o.matrixWorld); out[i*3] = v.x; out[i*3+1] = v.y; out[i*3+2] = v.z; if (v.y < minY) minY = v.y; }
    const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.BufferAttribute(out, 3)); if (src.index) geo.setIndex(Array.from(src.index.array)); geo.computeVertexNormals(); parts.push({ geo, mat:o.material.name }); });
  return { parts, anchor, minY, h:ch.h }; }
const PEOPLE_FB_MATS = () => [M.skin, M.shirt, M.uniform2, M.uniform];
function bakeSeated(){ if (!PEOPLE.seated.length) return;
  Promise.all(["casual_m", "casual_f"].map(loadChar)).then(chars => { const poses = chars.map(c => bakePose(c, "SitDown")); const mat = new THREE.MeshStandardMaterial({ vertexColors:true, roughness:0.85, metalness:0 }); const col = new THREE.Color(); const mtx = new THREE.Matrix4(), tmp = new THREE.Matrix4();
    for (const grp of PEOPLE.seated){ if (grp.done || !grp.parent) continue; const geos = []; const rnd = sRand("seated" + grp.seats.length + grp.parent.name);
      for (const [x, z, ry] of grp.seats){ const pose = poses[rnd() < 0.4 ? 1 : 0]; const of = outfit("office", rnd); const s = (1.62 + rnd() * 0.12) / pose.h;
        mtx.makeRotationY(ry).setPosition(x, 0, z); tmp.makeScale(s, s, s); mtx.multiply(tmp); tmp.makeTranslation(-pose.anchor.x, -pose.minY, -pose.anchor.z + 0.12); mtx.multiply(tmp);
        for (const part of pose.parts){ const g = part.geo.clone().applyMatrix4(mtx); const n = g.attributes.position.count; const ca = new Float32Array(n * 3); col.set(of[part.mat] ?? 0x888888); for (let i = 0; i < n; i++){ ca[i*3] = col.r; ca[i*3+1] = col.g; ca[i*3+2] = col.b; } g.setAttribute("color", new THREE.BufferAttribute(ca, 3)); geos.push(g); } }
      const merged = mergeGeometries(geos, false); geos.forEach(g => g.dispose()); const mesh = new THREE.Mesh(merged, mat); mesh.castShadow = true; mesh.receiveShadow = false; mesh.name = "seatedPeople"; mesh.userData.layer = "people";
      const fb = grp.parent.children.filter(c => c.isMesh && PEOPLE_FB_MATS().includes(c.material)); if (fb.length) mesh.position.y = fb[0].position.y; fb.forEach(c => { c.visible = false; c.userData.layer = null; });
      mesh.visible = (typeof layerState === "undefined") || layerState.people !== false; grp.parent.add(mesh); grp.done = true; PEOPLE.baked += grp.seats.length; }
    dirtyShadow(); }).catch(err => console.warn("seated bake failed", err?.message || err)); }
