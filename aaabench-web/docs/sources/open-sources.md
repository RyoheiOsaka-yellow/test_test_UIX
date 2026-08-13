# Where things come from

Licence first, quality second, convenience last. An asset with no recorded provenance has to be
removed later, and "later" always means after it is load-bearing.

Everything below is well known and long-lived, but **check before you rely on it** — terms and
availability move, and this file is a starting point, not a guarantee. `tools/refs.py` is the one
source verified by the harness itself on every setup run.

## Reference photographs (this is the one you will use most)

- **Openverse** — `python3 tools/refs.py find "…"`. No key, licence printed with every result.
  This is for *looking*, first and foremost. CC0/PD results can also be texture source material;
  NC and ND results are reference only, never shipped.

## Textures and HDRIs

| source | licence | notes |
|---|---|---|
| Poly Haven | CC0 | textures, HDRIs and models, no account, direct downloads |
| ambientCG | CC0 | large PBR texture library, several resolutions per material |
| Kenney | CC0 | stylised kits, props, UI, audio — vast and consistent |

A CC0 texture still needs recording: which file, from where, when. Not for the licence — for you,
in three weeks, when you need the 4K version of one of four hundred.

## Models

| source | licence | notes |
|---|---|---|
| Poly Haven | CC0 | small but excellent |
| Smithsonian Open Access | CC0 | scanned real objects, heavy, decimate them |
| Sketchfab (CC0/CC-BY filter) | mixed | check per model; account for downloads |
| Quaternius / Kenney kits | CC0 | game-ready, low-poly, consistent scale |

Scanned and marketplace models are almost always too dense for a city. Budget by *what it costs
in frame*, not by what it cost to acquire: a 200k-triangle bollard is worse than no bollard.

## Sound

| source | licence | notes |
|---|---|---|
| Freesound | mixed CC0/CC-BY | account needed; filter by licence |
| Sonniss GDC bundles | royalty-free | large downloads, professional quality |
| Kenney audio | CC0 | UI and simple effects |

Room tone and footsteps do more work than any music track. Procedural audio in the Web Audio API
(filtered noise for wind, rain and traffic beds) needs no asset at all and never repeats.

## Fonts

Google Fonts (Open Font License) is the safe default, and a city needs many typefaces — signage,
official notices, hand-painted, digital displays. Do not use a font *as* a brand: invent the
brand, then set it.

## Map data (for shape, never for a copy)

| source | licence | notes |
|---|---|---|
| OpenStreetMap | ODbL | the structure of real places: road hierarchies, block sizes, land use mixes |
| Natural Earth | public domain | coastlines and terrain at region scale |
| Copernicus / SRTM elevation | open, varies by product | real terrain, if you want a real shape underneath |

ODbL is share-alike on the *data*. Study the arrangement of real places, learn the ratios, then
build your own. Do not ship a reprojection of a real city — the demand asks for an invented one
anyway.

## What to record, per asset

A single `ASSETS.md` (or a JSON manifest, better) with one row each:

```
path                         source            licence   author        retrieved
public/assets/crane.glb      polyhaven.com     CC0       Poly Haven    2026-03-14
```

Write the row when you download the file, not at the end. At the end you will not remember, and
an unrecorded asset is one you have to delete.

## Making it yourself is usually faster

For a city, the highest-value assets are the ones no library has: your signage, your brands, your
posters, your number plates, your graffiti, your shop fronts. All of that is a `<canvas>`, a font,
and a texture upload — unique per instance, exactly the thing that defeats repetition, and it
costs no download and no licence.
