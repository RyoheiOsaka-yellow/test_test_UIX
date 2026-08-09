# CLAUDE.md — CineOS / Virtual Film Production & Cinematography OS

## 0. Mission

Build a browser-based **Virtual Film Production & Cinematography Operating System** that converts creative intent into physically plausible cinematography and then into production documents and AI-video instructions.

The product must support:

- Feature film / cinema
- TV / streaming drama
- Commercials
- Music video
- Documentary / ENG
- Live / concert / multicamera
- Sports
- Fashion / beauty / food / automotive / product
- Still photography
- High-speed / macro / scientific imaging
- Drone / FPV / aerial
- Underwater
- Practical Special Effects / 特効
- Stunts interface
- VFX / ICVFX / Virtual Production
- Motion control / robotics
- Miniatures / stop motion / volumetric / spatial capture

The core translation is:

```text
creative language
→ visual intent
→ shot grammar
→ physical camera/lens/exposure
→ lighting / grip / movement / practical FX
→ feasibility / continuity / safety flags
→ virtual 3D studio
→ storyboard / techvis / lighting diagram
→ vendor-neutral shot JSON
→ Seedance / Veo / Runway / Kling / other prompt adapters
→ PDF / images / production sheets
```

## 1. Non-negotiable architecture

Do NOT hard-code creative knowledge into UI components.

Use four layers:

1. **Ontology** — physical and filmmaking concepts.
2. **Equipment database** — actual SKU and archetype capabilities.
3. **Rules / Recipes** — cinematography reasoning.
4. **Adapters** — output for AI models / PDF / diagrams / DMX / production docs.

Canonical internal representation must be vendor-neutral.

## 2. Source of truth

Read in this order:

1. `knowledge/MASTER_CINEMATOGRAPHY_OS_V4.md`
2. `knowledge/SFX_PRACTICAL_EFFECTS.md`
3. `knowledge/FILM_DRAMA_GRAMMAR.md`
4. `knowledge/LIGHTING_AND_MATERIALS.md`
5. `knowledge/CAMERA_LENS_MOVEMENT.md`
6. `data/equipment_master.json`
7. `data/technique_rules.json`
8. `data/shot_recipes.json`
9. `schemas/*.schema.json`

The `src_reference/` directory contains earlier large reference documents; it is reference-only, not the canonical application schema.

## 3. Safety policy inside the product

Practical FX must have `safety_class`:

- `A`: ordinary controlled filming operation.
- `B`: trained production crew / Grip / SFX / pilot / rigger required.
- `C`: specialist-only, permits/licensing/risk assessment required.

For Class C, the application may provide:

- cinematic purpose
- camera/fps/lens/lighting approach
- shot coverage
- continuity and reset planning
- VFX plate requirements
- department handoffs

It must **not** generate explosive compositions, pyrotechnic charge quantities, improvised ignition/detonation instructions, unsafe weapon modifications, or substitute aesthetic distances for safety distances.

Safety constraints override creative recommendations.

## 4. Coordinate convention

World space:

```text
+X = subject right
-X = subject left
+Y = behind subject
-Y = camera side
+Z = up
```

Store SI units internally. Use mm for macro UI when helpful.

Camera pose:

```json
{"position_m":[0,-3,1.6],"target_m":[0,0,1.55],"roll_deg":0}
```

## 5. Required engines

Implement modularly:

- `IntentParser`
- `SubjectMaterialClassifier`
- `ShotDesigner`
- `CoveragePlanner`
- `CameraLensSolver`
- `ExposureSolver`
- `LightingSolver`
- `ReflectionSolver`
- `GripMovementSolver`
- `PracticalFXPlanner`
- `ContinuityEngine`
- `VFXPlanner`
- `FeasibilityEngine`
- `SafetyFlagger`
- `EquipmentMatcher`
- `PromptCompiler`
- `StoryboardRenderer`
- `DiagramRenderer`
- `PDFExporter`

Do not create one giant recommendation function.

## 6. Reasoning order

Use this priority:

```text
SAFETY
→ physical feasibility
→ continuity
→ story / communication objective
→ subject material physics
→ blocking / coverage
→ camera & lens
→ exposure / frame rate
→ lighting
→ grip / motion
→ FX / VFX
→ equipment SKU
→ style refinement
```

A user may lock any field. Never silently override a lock; return a conflict with alternatives.

## 7. Product modes

- `film_drama`
- `commercial`
- `music_video`
- `documentary`
- `live_multicam`
- `sports`
- `still_catalog`
- `still_editorial`
- `product_tabletop`
- `vfx_heavy`
- `virtual_production`
- `ai_video_only`
- `hybrid_real_ai`

Mode changes heuristics, not physics.

## 8. Core UX

Beginner input can be as short as:

> 夜の豪雨。主人公が路地を走り、後方で大きな爆発。35mm映画の緊張感。

The system should infer a proposal but expose every assumption:

- scene/time/weather
- coverage plan
- camera/lens
- fps/shutter
- lighting motivation
- rain/wind/haze
- practical-vs-digital split
- SFX specialist flag
- clean plates / VFX references
- continuity state
- prompt output

Professional mode allows direct XYZ / focal / T-stop / lux / DMX / movement path locks.

## 9. Equipment recommendation rule

Always recommend **capability first, SKU second**.

Example:

```text
Need: 2kW-class flicker-safe daylight source through 12x12 diffusion
Examples: Aputure Electro Storm XT26, ARRI SkyPanel X array, comparable rental fixture
```

This prevents the engine from becoming brand-dependent.

## 10. Prompt compiler

Never output only vague phrases such as `cinematic lighting`.

Compile in this sequence:

```text
FORMAT
CONTINUITY LOCKS
SUBJECT & ACTION
ENVIRONMENT
CAMERA FORMAT
LENS
CAMERA START POSITION
CAMERA PATH + METRIC DISTANCE + DURATION
FOCUS
FRAME RATE / SHUTTER FEEL
LIGHTING DIRECTION / SIZE / MOTIVATION
MATERIAL PHYSICS
PRACTICAL FX
VFX / PHYSICS CONSTRAINTS
COLOR / FINISH
EDIT / SOUND CUES
NEGATIVE CONSTRAINTS
```

## 11. Testing

Write tests for rules, not only UI.

Minimum rule tests:

- 1000fps raises exposure/light demand vs 24fps.
- transparent glass recommends transmission/edge-control strategy.
- black glossy product recommends reflection sources, not simply more frontal light.
- rain scene recommends back/side-back lighting for rain visibility.
- destructive one-off FX increases multicamera recommendation score.
- Class C SFX never outputs construction/charge instructions.
- large-format camera + S35-only lens raises coverage/vignetting conflict.
- payload sum over drone/gimbal limit raises conflict.
- actor moves toward a close point source → exposure variation warning.
- exact branded packshot + generative-only mode → geometry/logo continuity warning and hybrid suggestion.

## 12. Development order

### Phase 1 — Reasoning MVP

- text input
- scene + shot JSON
- equipment archetype recommendation
- 2D top-view diagrams
- detailed AI prompt
- Markdown/PDF shot plan

### Phase 2 — 3D technical editor

- camera FOV
- DOF
- lights / beam cones
- diffusion / flags / negative fill
- camera paths
- sun path
- rain/wind/atmosphere volumes

### Phase 3 — Material-aware preview

- glass / metal / matte / skin / liquid reflection simulation
- product digital twin
- ray-traced reflection preview

### Phase 4 — Production integrations

- DMX cue export
- lens metadata / VP tracking
- rental inventory
- location LiDAR
- weather/sun
- multicamera and schedule optimization

## 13. File conventions

Use JSON for machine data, Markdown for knowledge, JSON Schema for validation.

IDs:

```text
CAM-...
LEN-...
LGT-...
GRP-...
MOV-...
DRN-...
SFX-...
TEC-...
REC-...
```

All equipment facts should include provenance when known:

```json
{"source_url":"...","verified_date":"YYYY-MM-DD","confidence":"official_spec"}
```

## 14. Definition of done for a generated shot

A shot is not complete until it contains:

- purpose
- timing
- composition
- camera position
- lens
- exposure settings or assumptions
- movement
- focus behavior
- lighting
- practical FX if any
- continuity state
- VFX notes if any
- audio cue if relevant
- safety classification
- equipment capability list
- AI prompt fragment

## 15. Guiding product principle

The moat is not a giant catalog. It is the **Cinematography Reasoning Graph** that maps vague intent to physical image-making decisions and back again.


# V2 DEVELOPMENT DIRECTIVE

Read these files before implementing advanced modules:

1. `knowledge/advanced/ADVANCED_PRODUCTION_REASONING_V5.md`
2. `data/advanced/advanced_rules.json`
3. `data/advanced/source_registry.json`
4. `schemas/advanced/*.schema.json`
5. `docs/IMPLEMENTATION_V2.md`

The next implementation milestone is **Narrative Reasoning MVP**:

```text
screenplay text
→ scene parser
→ beat parser
→ coverage solver
→ axis/eyeline validator
→ canonical shot JSON
→ explanation
```

After that, implement photometric and practical-FX solvers.

Do not:
- hard-code shot lists by genre,
- output “cinematic” as a substitute for physical parameters,
- confuse measured specs with subjective lens/camera look,
- emit hazardous construction details for safety-class-C effects,
- allow UI state to become the canonical data model.

All UI must consume domain objects and solver outputs.


# V3 DEVELOPMENT DIRECTIVE — FILM PRODUCTION DIGITAL TWIN

Before V3 implementation, read:

1. `knowledge/v3/FILM_PRODUCTION_DIGITAL_TWIN_V6.md`
2. `data/v3/standards_registry.json`
3. `data/v3/causal_cinematography_graph.json`
4. `data/v3/ai_generation_qa_profiles.json`
5. `schemas/v3/*.schema.json`
6. `adapters/specs/*.md`
7. `docs/v3/IMPLEMENTATION_ROADMAP_V3.md`

## First V3 milestone

Implement **Canonical Production Identity + Graph** before any UI work.

Minimum domain entities:

- Project
- Sequence
- Scene
- Shot
- Take
- MediaAsset
- DigitalTwin
- ColorPipeline
- ContinuityState
- SoundPlan
- AIGenerationRun

Minimum relationships:

- Scene contains Shot
- Shot has Take
- Take produces MediaAsset
- Shot uses DigitalTwin
- Shot uses ColorPipeline
- Shot has ContinuityState
- Shot has SoundPlan
- Shot has AIGenerationRun

## Identity rule

A filename, USD prim path, OTIO clip name, database row ID or AI provider ID is NOT a CineOS identity.

Use stable CineOS IDs.

## Planned vs actual

Never overwrite planned data when real capture differs.

Store:

`planned`
`actual`

and expose the difference.

## Interchange rule

OpenUSD, OTIO, AMF/CLF and ST 2110 structures are adapters/integration layers.
They are not the canonical CineOS data model.

## Inference rule

All inverse-cinematography estimates and visual continuity detections MUST include confidence and ranges where applicable.

## Safety rule

SFX safety-class-C data may represent visual event states and department requirements only.
Do not generate explosive, pyrotechnic, ignition, charge or hazardous rig construction instructions.
