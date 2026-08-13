---
name: asset-pipeline
description: Sourcing, converting, licensing and loading assets — glTF, textures, atlases, procedural canvas textures, and the manifest that keeps provenance. Use when bringing in any external asset, when texture memory grows, or when deciding whether to make something rather than find it.
---

# Assets

## Make, or take?

For a city, the highest-value assets are the ones no library has: your signage, your brands, your
posters, your shopfronts, your number plates, your graffiti. All of that is a `<canvas>`, a font
and a `CanvasTexture` — unique per instance, no download, no licence, and it defeats repetition,
which is the biggest single tell.

```js
const c = document.createElement('canvas'); c.width = 512; c.height = 128
const g = c.getContext('2d')
g.fillStyle = '#2b2a26'; g.fillRect(0, 0, 512, 128)
g.font = '600 64px "Barlow Condensed"'; g.fillStyle = '#e8d9a0'
g.fillText('KESTREL FISH CO.', 24, 88)
const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace
```

Take, rather than make, when the thing is generic and detailed: a real crane, a scanned bollard, a
photographic material, an HDRI. Sources and licences are in `docs/sources/open-sources.md`.

## The manifest, from the first asset

```json
{ "path": "public/assets/crane.glb", "source": "polyhaven.com/a/harbour_crane",
  "licence": "CC0", "author": "Poly Haven", "retrieved": "2026-03-14", "tris": 24500 }
```

Write the row when you download the file. An asset with no provenance has to be removed later, and
"later" is always after it is load-bearing.

## Conversion

- **glTF/GLB** for geometry. Draco for large meshes (decoder in `public/draco/`).
- **KTX2/Basis** for textures shipped in bulk; otherwise optimised JPEG (photographic) or PNG
  (masks, UI). Keep the texture *count* down as hard as the byte size — each one is a state change
  and an upload stall.
- Atlas small textures. Twenty 256² props in one 1024² atlas is one material and, with instancing,
  one draw call.
- Colour space: albedo/emissive are sRGB, everything else is linear. This is the most common
  import bug and it looks like "everything is washed out".

## Budgets per asset class

| | triangles | texture |
|---|---|---|
| hero landmark | 20–60k | 2K, a few maps |
| building (near) | 2–8k | shares a district atlas |
| building (far / LOD) | 100–800 | atlas |
| street prop | 200–2000 | shared 512² atlas |
| character (near) | 8–20k | 1K |
| character (far) | 500–2000 | atlas or impostor |

A 200k-triangle bollard placed 300 times is 60M triangles and a failed budget. Decimate on import,
or do not import.

## Loading

- Load once, instance many. Cache by URL.
- Load in priority order: what is in frame, then what is near, then the rest. The first frame
  should appear before everything has arrived.
- Stream by distance for a large map; a city that takes four minutes to load is a city nobody sees.
- Dispose what you unload (`geometry.dispose()`, `material.dispose()`, every texture) or memory
  grows until the tab dies mid-run.

## Generated assets

Bake expensive generation to disk (`GLTFExporter` → `public/generated/`) rather than regenerating
on every page load. Cold starts are tested deliberately by the harness, and a minute of generation
is a minute you pay on every single look.

`public/generated/` and `src/world/generated/` are excluded from the dev server's file watcher, so
writing a hundred files there does not reload the page halfway through the pass.
