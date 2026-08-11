import * as THREE from 'three';

/**
 * Uniform objects shared by reference across every material in the sandbox.
 * One write per frame updates several hundred shader instances, and it keeps
 * "what time is it" a single answer rather than a per-material guess.
 */
export const frame = {
  uTime: { value: 0 },
  uSimTime: { value: 0 },
  uDelta: { value: 0 },
  uResolution: { value: new THREE.Vector2(1, 1) },
  uCameraPos: { value: new THREE.Vector3() },
  uParticleScale: { value: 1 },
  uParticleOpacity: { value: 1 },
  uSoftness: { value: 0.55 },
};

export function updateFrameUniforms(time, camera, size, settings) {
  frame.uTime.value = time.wall;
  frame.uSimTime.value = time.sim;
  frame.uDelta.value = time.simDelta;
  frame.uResolution.value.set(size.width, size.height);
  camera.getWorldPosition(frame.uCameraPos.value);
  frame.uParticleScale.value = settings.particles.globalScale;
  frame.uParticleOpacity.value = settings.particles.globalOpacity;
  frame.uSoftness.value = settings.particles.softness;
}
