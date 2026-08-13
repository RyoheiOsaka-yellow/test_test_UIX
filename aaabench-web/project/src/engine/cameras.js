// Default inspection poses.
//
// Four shots, because the failures show up at different distances: the silhouette from the
// air, the composition from the ground, the material from eye height, and the horizon from
// the water. A world that only works from one of them is not working.
//
// Add your own — a pose per district, per landmark, per shot you keep re-checking. They cost
// nothing and they are how you compare today's build against yesterday's.

export function registerDefaultPoses(A, ctx) {
  const R = () => worldRadius(ctx)

  A.addPose('aerial', {
    note: 'high and looking down — reads the plan: districts, road hierarchy, silhouette',
    position: () => [0, R() * 0.9, R() * 0.9],
    target: () => [0, 0, 0],
    fov: 55,
  })

  A.addPose('establishing', {
    note: 'the postcard — the whole place across open ground at a low angle',
    position: () => [R() * 1.1, R() * 0.22, R() * 1.1],
    target: () => [0, R() * 0.04, 0],
    fov: 40,
  })

  A.addPose('street', {
    note: 'eye height, 1.7m — where fakeness is obvious: materials, scale, clutter, wear',
    position: () => [0, 1.7, R() * 0.12],
    target: () => [0, 1.7, 0],
    fov: 60,
  })

  A.addPose('horizon', {
    note: 'off the edge looking back — silhouette against sky, fog and atmosphere',
    position: () => [0, R() * 0.05, R() * 1.6],
    target: () => [0, R() * 0.05, 0],
    fov: 35,
  })
}

// The poses have to follow the world as it grows: a 200m stage and a 6km city cannot share a
// hardcoded camera height, and a pose that ends up inside the ground reads as "the render
// broke" when it only means the numbers are stale.
function worldRadius(ctx) {
  const box = new ctx.THREE.Box3()
  ctx.scene.traverse((o) => {
    if (o.isMesh && o.geometry) {
      o.geometry.computeBoundingBox?.()
      if (o.geometry.boundingBox) box.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld))
    }
  })
  if (box.isEmpty()) return 500
  const s = box.getSize(new ctx.THREE.Vector3())
  return Math.max(200, Math.max(s.x, s.z) * 0.5)
}
