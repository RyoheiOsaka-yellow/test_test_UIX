// An empty stage. Not a start on the world — a floor, a sun and a sky, so that the sensors
// have something to report and you can tell "nothing built yet" apart from "the renderer is
// broken".
//
// Delete all of it. Nothing here is a suggestion about what your world should be: the ground
// is a flat grey plane precisely because a real place never is, and a city that still stands
// on this plane at the end is a city that never got its geography.

import * as THREE from 'three'

export async function createWorld(ctx) {
  const { scene } = ctx

  scene.background = new THREE.Color(0x9fb4c7)
  scene.fog = new THREE.Fog(0x9fb4c7, 400, 4000)

  const sun = new THREE.DirectionalLight(0xfff2e0, 2.4)
  sun.position.set(-600, 800, 400)
  sun.name = 'sun'
  scene.add(sun)

  const sky = new THREE.HemisphereLight(0xbdd7ee, 0x6b6255, 1.1)
  sky.name = 'skylight'
  scene.add(sky)

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(4000, 4000, 1, 1),
    new THREE.MeshStandardMaterial({ color: 0x6f7369, roughness: 1 })
  )
  ground.rotation.x = -Math.PI / 2
  ground.name = 'placeholder-ground'
  scene.add(ground)

  // A metre stick. Scale is the first thing that goes wrong and the last thing anyone checks:
  // this box is exactly 1.8m tall, standing at the origin. Compare anything you build to it.
  const human = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 1.8, 0.3),
    new THREE.MeshStandardMaterial({ color: 0xb2453a })
  )
  human.position.set(0, 0.9, 0)
  human.name = 'scale-reference-1m8'
  scene.add(human)

  return { name: 'empty-stage' }
}
