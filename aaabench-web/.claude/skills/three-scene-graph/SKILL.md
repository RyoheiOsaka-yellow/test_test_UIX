---
name: three-scene-graph
description: three.js scene structure, units, transforms, instancing and disposal. Use when building or restructuring world geometry, when object counts grow past a few thousand, or when things are the wrong size, in the wrong place, or leaking memory.
---

# Scene graph

## Units and conventions

One three.js unit = **one metre**. Keep it that way for the whole project; a world with a mixed
scale convention is a world where every physics constant, every camera distance and every fog
setting is wrong in a different place.

Y is up. Z is toward the viewer at identity. `camera.lookAt` is in world space and must be called
after the position is set. `object.up` matters for `lookAt` — set it before, not after.

Near and far planes are a ratio problem, not an absolute one: `near: 0.1, far: 40000` gives poor
depth precision. Prefer `near: 0.3` and a `far` no larger than your fog end, or use a logarithmic
depth buffer if you genuinely need both.

## Structure that survives a city

```
scene
  world/
    terrain/            heightfield chunks
    districts/
      harbour/          one group per district — cull, hide, measure, LOD as a unit
        blocks/
        props/          instanced meshes live here
    roads/
    water/
  systems/              things with a tick; nothing visual owns simulation state
  game/                 player, camera rig
```

Name everything. `scene.getObjectByName` and a `describe()` that reports meaningful names is worth
more than any inspector. `Mesh_00417` tells you nothing at 3 a.m.

## Transforms

- `updateMatrixWorld` runs once per frame; if you read a world position after moving a parent in
  the same frame, call `object.updateMatrixWorld(true)` first or you will read stale data.
- `matrixAutoUpdate = false` on static geometry (buildings, ground, props) saves a per-frame matrix
  composition for every object — measurable once you are past a few thousand.
- Reuse temporaries. `new THREE.Vector3()` inside an update loop allocates 60 times a second per
  object; hoist them to module scope.

## Instancing — the single most important technique here

```js
const mesh = new THREE.InstancedMesh(geometry, material, count)
mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)   // only if it moves
const m = new THREE.Matrix4()
for (let i = 0; i < count; i++) {
  m.compose(position[i], quaternion[i], scale[i])
  mesh.setMatrixAt(i, m)
  mesh.setColorAt(i, colour[i])                        // per-instance variation, free
}
mesh.instanceMatrix.needsUpdate = true
```

Everything repeated goes through this: windows, lamps, bollards, bins, trees, parked cars,
pedestrians, birds. Per-instance colour plus a small atlas gives variation without extra draws.

Frustum culling is per-`InstancedMesh`, so **instance per district, not per city** — one city-wide
instanced mesh is never culled and its bounding sphere spans the map.

## LOD and visibility

- `THREE.LOD` for anything with a silhouette worth simplifying. Two levels plus a billboard is
  usually enough; three is luxury.
- Hide whole district groups by distance. `group.visible = false` skips the subtree entirely and
  is the cheapest win available.
- `geometry.computeBoundingSphere()` after you modify positions, or culling uses stale bounds and
  objects pop out of existence while on screen.

## Disposal — the leak that ends long runs

Removing an object from the scene does **not** free its GPU memory:

```js
function destroy(obj) {
  obj.traverse(o => {
    o.geometry?.dispose()
    for (const m of [].concat(o.material || [])) {
      for (const k of Object.keys(m)) if (m[k]?.isTexture) m[k].dispose()
      m.dispose()
    }
  })
  obj.parent?.remove(obj)
}
```

A generator that rebuilds a district ten times without disposing has ten copies resident. Watch
`renderer.info.memory` across a regeneration — it should return to where it started.
