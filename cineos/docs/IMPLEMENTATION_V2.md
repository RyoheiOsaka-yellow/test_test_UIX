# CineOS V2 Implementation Plan

## New core modules

```text
src/
  domain/
    screenplay/
    scene/
    shot/
    lens/
    lighting/
    practical_fx/
    motion_rig/
    virtual_production/

  solvers/
    screenplay_parser.ts
    beat_parser.ts
    coverage_solver.ts
    blocking_solver.ts
    axis_validator.ts
    lens_state_solver.ts
    photometric_solver.ts
    material_lighting_solver.ts
    practical_fx_solver.ts
    motion_feasibility_solver.ts
    continuity_solver.ts
    prompt_compiler.ts

  adapters/
    seedance/
    generic_video/
    unreal/
    pdf/
```

## Phase 1 — Narrative reasoning

Deliver:

- scene parser
- beat extraction
- coverage candidates
- axis/eyeline validator
- shot reasons

Acceptance:

Input:
a two-character dialogue scene.

Output:
scene JSON + beats + 3–8 justified shots + axis warnings.

## Phase 2 — Blocking and lighting zones

Deliver:

- actor keyframe path
- camera candidate zones
- lighting zones
- exposure continuity warnings

## Phase 3 — Lens metadata

Deliver:

- lens state timeline
- distortion/vignetting profile references
- prompt translation
- Unreal-ready canonical fields

## Phase 4 — Photometric solver

Deliver:

- fixture photometric interpolation
- modifier loss
- fps/shutter exposure delta
- key/fill ratio
- insufficient-light warning

## Phase 5 — Practical FX event engine

Deliver:

- rain/wind/snow/haze/fire/explosion-visual state schemas
- continuity state machine
- destructive reset model
- safety class handling
- VFX capture requirements

## Phase 6 — Techvis

Deliver:

- motion rig envelope
- payload
- camera path
- collision
- reach feasibility
- alternatives

## Phase 7 — VP metadata

Deliver canonical live-metadata model and Unreal adapter.

## Core rule

The model may suggest visuals, but:
- measured facts require provenance
- safety class C never outputs hazardous construction recipes
- creative heuristics are labeled as heuristics
- exact equipment compatibility is validated before recommendation
