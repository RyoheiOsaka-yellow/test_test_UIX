---
name: shader-programming
description: GLSL in three.js — ShaderMaterial, onBeforeCompile, per-instance variation, and the cheap effects that make surfaces read as real. Use when writing custom materials, breaking up texture repetition, or adding wetness, wear, wind or emissive windows.
---

# Shaders

## Which mechanism

- **`MeshStandardMaterial` with maps** — the default. Do not write a shader to do what a roughness
  map does.
- **`onBeforeCompile`** — keep PBR, lighting and shadows, inject a little GLSL. This is the right
  tool for 90 % of what a city needs: dirt by height, wetness, per-instance colour and wear, wind.
- **`ShaderMaterial` / `RawShaderMaterial`** — full control, no lighting for free. Sky, water,
  screens, holograms, post effects.
- **NodeMaterial / TSL** exists in modern three and is worth knowing if you are living in WebGPU;
  on the WebGL2 renderer, `onBeforeCompile` is the pragmatic path.

## Injecting into a standard material

```js
material.onBeforeCompile = (shader) => {
  shader.uniforms.uWet = { value: 0 }
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\n varying vec3 vWorld;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\n vWorld = (modelMatrix * vec4(position,1.0)).xyz;')
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', '#include <common>\n uniform float uWet;\n varying vec3 vWorld;')
    .replace('#include <roughnessmap_fragment>', `
      #include <roughnessmap_fragment>
      float puddle = smoothstep(0.4, 0.0, vWorld.y);       // low ground stays wet
      roughnessFactor = mix(roughnessFactor, 0.08, uWet * puddle);
    `)
  material.userData.shader = shader                        // keep it to update uniforms later
}
```

Materials are cached by program: two meshes sharing a material share the injected shader. If you
need per-object uniforms, use per-instance attributes instead of cloning the material — a cloned
material is a new program and a new draw-call state change.

## Per-instance variation

The cheapest way to defeat repetition:

```js
geometry.setAttribute('aWear', new THREE.InstancedBufferAttribute(wearArray, 1))
// vertex:   attribute float aWear; varying float vWear;  vWear = aWear;
// fragment: diffuseColor.rgb *= mix(1.0, 0.72, vWear);  roughnessFactor = mix(r, 0.95, vWear);
```

One instanced mesh, a thousand objects, every one a different age. `InstancedMesh.setColorAt`
gives you colour for free without any GLSL at all.

## Effects that buy the most

- **Breaking tiling.** Multiply the albedo by a large-scale noise texture at a very different
  scale (say 1/64th the tiling frequency). Two textures, one multiply, and the 4 m repeat stops
  being visible — the second-biggest tell after repeated buildings.
- **Triplanar mapping** on terrain and cliffs, so nothing stretches on a slope.
- **Wetness**: roughness down, a slight normal flattening, a darkening of albedo, puddle masks
  from a low-frequency noise gated by world height. Drives the whole feel of rain.
- **Emissive windows**: an emissive map with per-instance on/off and colour jitter. Night is made
  of sources, and this is the cheapest source there is.
- **Wind**: displace vertices by `sin(time + worldPos.x)` scaled by a per-vertex "flexibility"
  attribute painted into the geometry (0 at the trunk, 1 at the leaf tips). Foliage, flags,
  laundry, awnings.
- **Vertex colour AO**: bake a cheap darkening into vertex colours where geometry meets ground.
  Contact for free, and contact is what makes objects sit rather than float.

## Costs on a software rasteriser

Fragment work is the expensive half here. A shader that samples six textures over a full-screen
surface costs far more than the same shader on a prop. Sample fewer, branch less (both sides of a
branch are usually evaluated), and prefer doing work per-vertex when the result is smooth.

## Debugging

- Output the value you doubt as a colour: `gl_FragColor = vec4(vec3(roughnessFactor), 1.0)`.
- A material that fails to compile logs the full shader with a line number to the console — read
  it through `console_drain`; three.js does not throw.
- A black object usually means normals or a missing light, not the shader. Check with
  `MeshNormalMaterial` before rewriting anything.
