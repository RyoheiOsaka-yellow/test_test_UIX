// ================= XANTALOS Space：身振り（腕・首・胴の骨を動かす） =================
// 読み込んだキャラの骨（UpperArm/LowerArm/Fist/Head/Neck/Torso/Abdomen）に、毎フレーム AnimationMixer の後で回転を足す。
// 方向はアバターの向きを基準に与える（+z＝正面、+x＝本人の左、+y＝上）。腕は「この方向を向け」という狙い（aim）で指定する。
const SP_GEST_DUR = { wave:2.4, like:1.8, bow:1.8, clap:2.0, nod:1.6, point:2.2, coffee:2.2, ask:2.2, talk:2.6 };
const SP_BONE_MAP = { UpperArmL:"uaL", LowerArmL:"laL", FistL:"hL", UpperArmR:"uaR", LowerArmR:"laR", FistR:"hR", Head:"head", Neck:"neck", Torso:"torso", Abdomen:"abd" };
function spFindBones(root){ const b = {}; root.traverse(o => { if (!o.isBone) return; const k = SP_BONE_MAP[o.name.replace(/[._\s]/g, "")]; if (k && !b[k]) b[k] = o; }); return (b.uaR && b.laR && b.hR && b.uaL && b.laL && b.hL) ? b : null; }

// 身振りの中身：t＝開始からの秒。aim:[骨, 子の骨, 方向]、rot:[骨, 軸, 角度]
const SP_GEST = {
  wave:   t => ({ aim:[["uaR", "laR", [-0.6, 0.78, 0.15]], ["laR", "hR", [-0.15 + 0.5 * Math.sin(t * 9), 1, 0.2]]], rot:[["head", [0, 0, 1], -0.08]] }),
  like:   t => ({ aim:[["uaR", "laR", [-0.3, -0.8, 0.5]], ["laR", "hR", [0.1, 0.9, 0.45]]], rot:[["head", [1, 0, 0], 0.08]] }),
  bow:    t => { const a = Math.sin(Math.min(1, t / 1.5) * Math.PI); return { rot:[["abd", [1, 0, 0], 0.32 * a], ["torso", [1, 0, 0], 0.3 * a], ["head", [1, 0, 0], 0.15 * a]],
                  aim:[["uaR", "laR", [-0.12, -1, 0.25]], ["uaL", "laL", [0.12, -1, 0.25]], ["laR", "hR", [0.25, -0.8, 0.45]], ["laL", "hL", [-0.25, -0.8, 0.45]]] }; },
  clap:   t => { const k = 0.6 + 0.4 * Math.sin(t * 15); return { aim:[["uaR", "laR", [-0.35, -0.3, 0.9]], ["uaL", "laL", [0.35, -0.3, 0.9]], ["laR", "hR", [k, 0.25, 0.75]], ["laL", "hL", [-k, 0.25, 0.75]]] }; },
  nod:    t => ({ rot:[["head", [1, 0, 0], 0.32 * Math.abs(Math.sin(t * Math.PI * 1.9))], ["neck", [1, 0, 0], 0.1 * Math.abs(Math.sin(t * Math.PI * 1.9))]] }),
  point:  t => ({ aim:[["uaR", "laR", [-0.8, 0.2, 0.6]], ["laR", "hR", [-0.78, 0.22, 0.6]]], rot:[["head", [0, 1, 0], -0.35], ["torso", [0, 1, 0], -0.15]] }),   // 右斜め前を指す（向こうを見る）
  coffee: t => ({ aim:[["uaR", "laR", [-0.35, -0.78, 0.4]], ["laR", "hR", [0.35, 0.75 + 0.1 * Math.sin(t * 2), 0.5]]], rot:[["head", [1, 0, 0], -0.12 * Math.max(0, Math.sin(t * 2))]] }),
  ask:    t => ({ aim:[["uaR", "laR", [-0.22, 1, 0.02]], ["laR", "hR", [-0.12, 1, 0.04]]], rot:[["head", [0, 0, 1], 0.1]] }),
  talk:   t => ({ aim:[["uaR", "laR", [-0.35, -0.75, 0.45]], ["laR", "hR", [-0.3, 0.25 + 0.35 * Math.sin(t * 5.2), 0.9]],
                        ["uaL", "laL", [0.35, -0.8, 0.4]], ["laL", "hL", [0.3, 0.15 + 0.3 * Math.sin(t * 4.1 + 2), 0.9]]],
                  rot:[["head", [1, 0, 0], 0.07 * Math.sin(t * 3.7)], ["head", [0, 1, 0], 0.1 * Math.sin(t * 1.9)]] }),
};
const _gq = new THREE.Quaternion(), _gR2 = new THREE.Quaternion(), _gW = new THREE.Quaternion(), _gR = new THREE.Quaternion(), _gI = new THREE.Quaternion(), _gv1 = new THREE.Vector3(), _gv2 = new THREE.Vector3(), _gv3 = new THREE.Vector3();
// ワールドでの回転 R を骨のローカルに直して掛ける：新ローカル = L · W⁻¹ · R · W
function spApplyWorldRot(bone, R){ bone.getWorldQuaternion(_gW); const d = _gW.clone().invert().multiply(R).multiply(_gW); bone.quaternion.multiply(d); bone.updateMatrixWorld(true); }
function spGestAim(bone, child, dir, w, rootQ){ bone.getWorldPosition(_gv1); child.getWorldPosition(_gv2); _gv2.sub(_gv1); if (_gv2.lengthSq() < 1e-8) return; _gv2.normalize();
  _gv3.set(dir[0], dir[1], dir[2]).normalize().applyQuaternion(rootQ); _gR2.setFromUnitVectors(_gv2, _gv3); _gR.slerpQuaternions(_gI, _gR2, w); spApplyWorldRot(bone, _gR); }   // _gR2 を分けないと slerp の中で上書きされる
function spGestRot(bone, axis, ang, w, rootQ){ _gv3.set(axis[0], axis[1], axis[2]).normalize().applyQuaternion(rootQ); _gR.setFromAxisAngle(_gv3, ang * w); spApplyWorldRot(bone, _gR); }
// 骨の向きを身振り前に戻す（mixer.update の前に呼ぶ）。首・胴のようにアニメが毎フレーム書き戻さない骨でも回転が積み重ならない
function spGestureRestore(a){ if (!a.gSaved) return; for (const [b, q] of a.gSaved) b.quaternion.copy(q); a.gSaved = null; }
// 毎フレーム：mixer.update の後に呼ぶ。終わったら a.gest を消す
function spGestureUpdate(a, now){ const g = a.gest; if (!g || !a.bones || !a.root) return; const D = SP_GEST_DUR[g.e] || 2, t = g.hold != null ? g.hold : (now - g.t0) / 1000; if (t >= D){ a.gest = null; return; }   // hold：検証用に途中で止める
  const ramp = Math.min(1, t / 0.3, (D - t) / 0.35); const w = ramp * ramp * (3 - 2 * ramp); const def = SP_GEST[g.e]; if (!def) return; const o = def(t);
  const B = a.bones; a.gSaved = Object.values(B).map(b => [b, b.quaternion.clone()]);
  a.root.updateMatrixWorld(true); a.root.getWorldQuaternion(_gq);
  for (const [bn, axis, ang] of (o.rot || [])) if (B[bn]) spGestRot(B[bn], axis, ang, w, _gq);
  for (const [bn, cn, dir] of (o.aim || [])) if (B[bn] && B[cn]) spGestAim(B[bn], B[cn], dir, w, _gq); }
function spStartGesture(a, e){ if (!a || !SP_GEST[e]) return; if (a.gest && a.gest.e !== "talk" && e === "talk" && (performance.now() - a.gest.t0) / 1000 < (SP_GEST_DUR[a.gest.e] || 2)) return; a.gest = { e, t0: performance.now() }; }

// 検証用（最後に読み込まれるファイルで公開する）
window.__spaceFn = { spSeats, spSeatNear, spSitAt, spStand, spSetFP, spTalkTo, spEmote, spGoRoom, spWalkTo, spRoomOf, spStartGesture, navBuild, navPath, navFree, NAV, SEATS_RAW };
