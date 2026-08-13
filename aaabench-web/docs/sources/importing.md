# Getting things in

## Geometry

**glTF / GLB is the format.** Everything else is a conversion step you will regret.

```js
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'

const draco = new DRACOLoader().setDecoderPath('/draco/')   // copy the decoder into public/
const loader = new GLTFLoader().setDRACOLoader(draco)
const gltf = await loader.loadAsync('/assets/crane.glb')
```

Checks worth making on every import, because each of these has a distinctive failure look:

- **Scale.** glTF is metres by default; plenty of exports are not. Put it next to the 1.8 m
  reference and look before you place 400 of them.
- **Origin.** A model whose origin is its centre floats or sinks when you place it on the ground.
  Re-centre to the base at import.
- **Up axis.** Z-up exports arrive lying down.
- **Triangle count.** `gltf.scene.traverse(o => o.isMesh && (n += o.geometry.index.count / 3))`
  before you commit to it. Decimate with `SimplifyModifier`, or in Blender if it is installed.
- **Materials.** Imported materials often bring their own textures and shader variants, which is
  how a texture count doubles quietly. Re-material anything you place in bulk.

**Instancing beats loading.** One mesh loaded once and drawn 800 times with `InstancedMesh` is a
draw call and a bit. Eight hundred loaded models are eight hundred draw calls and eight hundred
copies in memory.

## Textures

- **KTX2 (Basis)** for anything shipped in bulk: GPU-compressed, a fraction of the memory, loaded
  with `KTX2Loader`. Convert with `toktx` / `basisu` if available, or ship optimised JPEG/PNG and
  keep the count down.
- **Colour space matters**: colour maps are sRGB (`texture.colorSpace = THREE.SRGBColorSpace`);
  normal, roughness, metalness and AO maps are linear. Getting this wrong is the classic "why does
  everything look washed out / plastic".
- **Atlas the small things.** Twenty 256² prop textures in one 1024² atlas is one texture, one
  material, and — with instancing — one draw call.
- **Mipmaps and anisotropy**: `texture.anisotropy = renderer.capabilities.getMaxAnisotropy()` on
  ground and road surfaces, or every receding surface shimmers.
- **Repeat wisely.** A tiling texture that repeats visibly at 4 m is the second-most-obvious tell
  after repeated buildings. Break it with a large-scale noise multiply, decals and dirt.

## Audio

Web Audio, decoded once and reused. Autoplay is blocked until a user gesture, which is one of the
reasons the game needs a title screen. Keep concurrent voices capped and pool them: a hundred
simultaneous footstep sources costs more than the entire crowd's geometry.

## Generated content

Anything you generate — heightfields, block layouts, baked geometry, atlases — belongs in
`AgentCity/public/generated/` or `src/world/generated/`. Both are excluded from the dev server's
file watching, so writing a hundred files does not reload the page halfway through the
generation pass.

Bake generated geometry to `.glb` with `GLTFExporter` when a generation pass is slow. Regenerating
a city on every page load is a minute you pay every single time you look at it, and it makes cold
starts — which the harness tests deliberately — expensive.

## The size trap

Every asset arrives with a size, and the sum is what a player downloads before they see anything.
A city that takes four minutes to load is a city nobody sees. Keep a running total, stream what
you can by distance, and make the first frame appear before everything has arrived.
