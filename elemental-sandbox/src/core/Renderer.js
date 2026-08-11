import * as THREE from 'three';

export function createRenderer(canvas, settings) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: settings.renderer.antialias,
    powerPreference: 'high-performance',
    stencil: false,
    alpha: false,
  });

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, settings.renderer.maxPixelRatio));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = settings.renderer.exposure;
  renderer.shadowMap.enabled = settings.renderer.shadows;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.setClearColor(0x05070b, 1);
  renderer.autoClear = true;

  return renderer;
}
