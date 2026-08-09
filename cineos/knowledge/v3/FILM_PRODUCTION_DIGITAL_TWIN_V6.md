# CineOS V3 — Film Production Digital Twin & Visual Reasoning Architecture

## 0. Definition

CineOS V3 extends the system from a cinematography planner into a **Film Production Digital Twin + Visual Reasoning Engine**.

It must preserve one canonical identity across the entire production lifecycle:

```text
SCRIPT
  ↓
SCENE
  ↓
SHOT ID
  ↓
PREVIS / TECHVIS
  ↓
CAMERA / LENS / LIGHT / SFX / SOUND
  ↓
REAL SHOOT / AI GENERATION / VIRTUAL PRODUCTION
  ↓
EDITORIAL
  ↓
VFX
  ↓
COLOR
  ↓
DELIVERY
```

The canonical Shot ID must remain stable across all adapters.

Example:

```text
CINEOS_PRJ001_SC012_SH042
```

The shot may have multiple takes, versions, generated variants and VFX deliveries, but the conceptual shot identity remains stable.

---

# 1. Canonical Production Graph

The system is a graph rather than a flat project file.

Primary node types:

```text
Project
Sequence
Scene
Beat
Character
BlockingPath
Shot
Take
Camera
Lens
LensState
Light
Modifier
GripRig
MotionPath
PracticalFX
StuntEvent
SoundPlan
Set
SetSurface
Prop
WardrobeState
HairMakeupState
VFXTask
ColorPipeline
EditorialClip
MediaAsset
DigitalTwin
Delivery
AIModelRun
QAResult
```

Typical edges:

```text
Scene --contains--> Beat
Beat --motivates--> Shot
Character --follows--> BlockingPath
Shot --uses--> Camera
Shot --uses--> Lens
Shot --illuminated_by--> Light
Light --modified_by--> Modifier
Shot --captures--> PracticalFX
PracticalFX --changes_state_of--> Set
Shot --requires--> SoundPlan
Shot --generates--> MediaAsset
MediaAsset --appears_in--> EditorialClip
Shot --requires--> VFXTask
Shot --uses--> ColorPipeline
Shot --has_variant--> AIModelRun
AIModelRun --evaluated_by--> QAResult
```

A graph enables dependency-aware reasoning.

Example:

```text
Rain
  ↓ increases
Wardrobe wetness
  ↓ affects
Continuity
  ↓ constrains
Shot order
```

---

# 2. OpenUSD Scene Representation

## 2.1 Why USD

OpenUSD is a scalable scene-description system designed for complex animated 3D production. CineOS should use USD as an **interchange / scene representation adapter**, not necessarily as its only internal database.

Canonical domain objects remain CineOS-owned.

```text
CineOS canonical domain
        ↓
OpenUSD adapter
        ↓
.usda / .usd / .usdc
        ↓
Unreal / Maya / Houdini / other DCCs
```

## 2.2 USD mapping

Suggested namespace:

```text
/World
  /Sets
  /Props
  /Characters
  /Cameras
  /Lights
  /Rigging
  /FX
  /Metadata
```

Example:

```text
/World/Cameras/CINEOS_SH042_CAM_A
/World/Lights/CINEOS_SH042_KEY
/World/FX/CINEOS_SH042_RAIN
```

## 2.3 USD camera mapping

CineOS:

```yaml
camera:
  focal_length_mm:
  sensor_width_mm:
  sensor_height_mm:
  focus_distance_m:
  f_stop:
  clipping_range:
  transform:
```

USD adapter maps these into a `UsdGeomCamera`-compatible representation.

Do not silently convert T-stop into F-stop. If only T-stop is known, preserve it as custom metadata.

## 2.4 Time sampled values

Camera, lens, light, blocking and FX can change over time.

USD supports time-sampled values, so:

```yaml
camera_path:
  t=0: xyz A
  t=1: xyz B
```

can be authored as time samples.

## 2.5 Lights

Lighting nodes should map where practical to USD lighting schemas.

CineOS retains cinema-specific metadata:

```yaml
cineos:
  fixture_id:
  optic:
  diffusion:
  measured_lux:
  cct:
  ssi:
  dmxcue:
```

These may be stored as custom USD attributes when no standard field exists.

## 2.6 Materials

Set and product surfaces should expose PBR-like fields:

```yaml
surface:
  base_color:
  roughness:
  metallic:
  transmission:
  ior:
  clearcoat:
  emission:
```

This enables:

- reflection prediction
- product lighting
- camera visibility
- ray-traced previs

## 2.7 Layering strategy

Recommended layers:

```text
asset.usd
set.usd
blocking.usd
lighting.usd
camera.usd
fx.usd
shot_override.usd
```

The Shot stage composes these layers.

This supports non-destructive department workflows.

---

# 3. Digital Twin Asset Model

A Digital Twin represents a real or fictional object with geometry + appearance + production metadata.

```yaml
digital_twin:
  asset_id:
  asset_type:
  dimensions_m:
  geometry_uri:
  usd_uri:
  material_profiles:
  texture_uris:
  brand_assets:
  collision_proxy:
  mass_kg:
  pivot:
  articulation:
  reflectance_profile:
  scan_source:
  provenance:
```

Examples:

- bottle
- phone
- car
- room
- furniture
- costume
- studio light
- crane
- rain tower

A digital twin can have LODs:

```text
LOD0 bounding box
LOD1 techvis geometry
LOD2 previs
LOD3 visual
LOD4 final/VFX
```

Techvis should not require final-detail geometry.

---

# 4. Production Design Material Reasoning

## 4.1 Surface model

Every major set surface should be able to contribute to light.

```yaml
set_surface:
  albedo_linear:
  roughness:
  specular:
  metallic:
  transmission:
  normal_detail:
  acoustic_absorption:
```

Examples:

White wall:
- high diffuse bounce
- raises fill

Black velvet:
- strong absorption
- reduces fill

Polished floor:
- specular reflections
- may reveal fixtures / camera

Glass:
- reflection + transmission
- crew visibility risk

## 4.2 Set-light interaction

Rules:

```text
IF wall_albedo high AND source close
THEN room fill increases.

IF floor roughness low
THEN light/camera reflections become more visible.

IF ceiling dark
THEN top bounce effectiveness decreases.

IF room small AND walls white
THEN negative fill becomes more important.
```

## 4.3 Reflection visibility solver

Use camera ray + reflective surface normal to estimate whether:

- camera
- light
- boom
- crew
- flags

may be reflected.

Output:

```yaml
reflection_risk:
  object:
  surface:
  screen_region:
  severity:
  suggested_fix:
```

---

# 5. ACES 2 / AMF Color Pipeline

## 5.1 Color is a production object

Color cannot be only a LUT name.

```yaml
color_pipeline:
  pipeline_id:
  capture_transform:
  working_space:
  look_transform:
  output_transform:
  display_target:
  hdr_mode:
  amf_uri:
  clf_uri:
```

## 5.2 ACES 2

ACES 2 is treated as a supported end-to-end color-management framework.

CineOS should not reimplement ACES math unless necessary. Prefer external compliant libraries / OCIO configurations.

## 5.3 AMF

ACES Metadata File is a sidecar XML structure intended to communicate metadata needed to recreate an ACES viewing pipeline.

CineOS stores an internal color model and can export AMF.

Mapping:

```text
CineOS ColorPipeline
→ ACES AMF adapter
→ .amf
```

AMF is not the canonical CineOS project file.

## 5.4 CLF

Common LUT Format can exchange color transforms.

CineOS can reference:

```yaml
look:
  clf_uri:
  checksum:
```

## 5.5 Shot color continuity

Each Shot can inherit Scene Look.

```text
Project Look
  ↓
Sequence Look
  ↓
Scene Look
  ↓
Shot Override
```

Do not duplicate full look data on every Shot.

---

# 6. Editorial / OpenTimelineIO Integration

## 6.1 Editorial adapter

OpenTimelineIO is used as editorial interchange.

Canonical:

```text
CineOS Project
→ OTIO adapter
→ .otio
```

## 6.2 Shot metadata in OTIO

Each editorial clip should carry:

```yaml
cineos:
  project_id:
  scene_id:
  shot_id:
  take_id:
  media_asset_id:
  camera_id:
  lens_id:
  vfx_status:
  ai_generated:
  color_pipeline_id:
```

## 6.3 Editorial state

CineOS can track:

```yaml
editorial:
  selected_take:
  timeline_in:
  timeline_out:
  speed_effect:
  transition:
  audio_links:
  version:
```

## 6.4 Editorial round trip

Possible flow:

```text
CineOS planned timeline
→ OTIO
→ editor modifies
→ OTIO import
→ CineOS recognizes shot/take changes
```

Do not assume every NLE supports every OTIO feature equally; adapters may be lossy.

---

# 7. Production Sound Planner

Sound becomes a first-class department.

## 7.1 Sound plan

```yaml
sound_plan:
  dialogue_required:
  boom:
  lav:
  plant:
  stereo_ambience:
  room_tone:
  wild_lines:
  playback:
  timecode:
  noise_sources:
  adr_risk:
```

## 7.2 Boom geometry

A boom-safe volume can be computed from:

- camera frustum
- frame line
- actor position
- light shadow rays
- reflective surfaces

Output:

```yaml
boom_safe_zone:
  polygon:
  max_mic_depth:
  shadow_risk:
  reflection_risk:
```

## 7.3 Noise database

Equipment may expose:

```yaml
acoustic:
  noise_dba:
  variable_noise:
  fan_mode:
  distance_reference:
```

Where official measurements are unavailable, use qualitative values with low confidence.

## 7.4 SFX sound conflict

Rules:

```text
IF rain_rig high_noise AND sync_dialogue required
THEN ADR risk ↑

IF wind_machine close to actor
THEN dialogue capture difficulty ↑

IF fogger cue occurs during line
THEN schedule effect between dialogue takes where possible.
```

## 7.5 MOS / ADR recommendation

Output is a recommendation, not an automatic production decision.

---

# 8. Continuity Digital Twin

Continuity should be stateful.

## 8.1 State categories

```text
Character
Wardrobe
Hair
Makeup
Prop
Food
Liquid
Set damage
Wetness
Snow accumulation
Blood / dirt
Time of day
Sun direction
Practical light state
Screen content
```

## 8.2 State object

```yaml
continuity_state:
  shot_id:
  take_id:
  timestamp:
  entities:
    bottle:
      orientation_deg:
      liquid_percent:
      condensation:
    actor_a:
      hair_wetness:
      wardrobe_state:
      dirt_state:
```

## 8.3 Visual continuity QA

Future image/video analysis should compare:

```text
reference take
vs
candidate take
```

Potential detections:

- prop moved
- liquid level changed
- hair changed
- sleeve position changed
- watch moved
- set damage reset
- rain density mismatch
- sun direction mismatch
- background extra inconsistency

## 8.4 Confidence

Never report uncertain visual changes as definite.

```yaml
difference:
  attribute:
  confidence:
  reference_region:
  candidate_region:
```

---

# 9. Inverse Cinematography

Inverse cinematography estimates a plausible physical setup from a reference image/video.

It is an inference system, not forensic certainty.

## 9.1 Estimated variables

```yaml
inverse_estimate:
  camera:
    height:
    focal_length_range:
    pitch:
    roll:
    distance:
  lens:
    depth_character:
    distortion:
  lighting:
    key_azimuth:
    key_elevation:
    softness:
    fill_ratio:
    rim:
  environment:
    horizon:
    vanishing_points:
    sun_direction:
  material:
    reflections:
    roughness_estimates:
```

## 9.2 Workflow

```text
Reference
↓
segmentation
↓
vanishing-point estimation
↓
perspective / FOV hypothesis
↓
highlight/shadow analysis
↓
light hypotheses
↓
material hypotheses
↓
candidate virtual setups
↓
render comparisons
↓
ranked solutions
```

Multiple setups may produce similar images. Preserve uncertainty.

## 9.3 Output

```yaml
hypotheses:
  - rank: 1
    confidence: 0.63
    focal_mm_range: [65,90]
    key_azimuth_range: [-50,-30]
```

---

# 10. Causal Cinematography Graph

The system should represent cause → visual effect.

Examples:

```text
Source apparent size ↑
→ shadow edge softness ↑

Source distance ↓
→ apparent size ↑
→ softness ↑
AND
→ exposure falloff across subject path ↑

Frame rate ↑
→ exposure time ↓
→ light requirement ↑

Focal length ↑ + same framing
→ camera distance ↑
→ perspective relationship changes

Subject-background distance ↑
→ background blur potential ↑

Negative fill closer
→ fill reflection ↓
→ face contrast ↑
```

## 10.1 Causal node format

```yaml
causal_rule:
  cause:
  direction:
  effect:
  conditions:
  confidence:
  type:
    - physics
    - geometry
    - common_practice
    - heuristic
```

## 10.2 What-if solver

User:

> もっと背景をぼかしたい

System returns interventions:

```text
Open aperture
Increase subject-background distance
Change focal length + reposition camera
Use larger sensor / capture mode
```

Each intervention includes side effects.

---

# 11. AI Generation QA Loop

AI generation is not complete at prompt export.

```text
CineOS Shot
↓
Prompt Adapter
↓
Generation
↓
QA
↓
Diagnosis
↓
Prompt / structure revision
↓
Generation
```

## 11.1 QA categories

```yaml
qa:
  framing:
  camera_motion:
  lens_character:
  lighting_direction:
  product_geometry:
  face_identity:
  hand_integrity:
  text_logo:
  reflection_physics:
  liquid_continuity:
  object_count:
  wardrobe_continuity:
  weather_continuity:
  effect_physics:
```

## 11.2 Score

Scores are not all equally important.

```yaml
weights:
  product_geometry: 1.0
  framing: 0.8
  lighting: 0.7
  text_logo: 1.0
```

Brand/product work may prioritize geometry and text.
Narrative may prioritize performance, continuity and camera grammar.

## 11.3 Auto-diagnosis

Example:

```text
Problem: liquid level changes
→ strengthen continuity instruction
→ shorten shot
→ reduce product rotation
→ split action into cuts
→ recommend hybrid real/CG product
```

## 11.4 Version tree

```text
Shot 042
├─ GEN v1
├─ GEN v2
│  └─ selected
└─ GEN v3
```

All variants retain prompt, model, seed/reference IDs where available.

---

# 12. ST 2110 / Live IP Production

## 12.1 Scope

ST 2110 is relevant when CineOS expands into:

- live production
- broadcast studios
- virtual production
- multi-camera facilities
- IP video infrastructure

The suite carries separate elementary essence streams over managed IP.

## 12.2 Canonical network node

```yaml
live_stream:
  stream_id:
  essence_type:
    - video
    - audio
    - ancillary
    - metadata
  source_device:
  timing_domain:
  ptp_domain:
  multicast:
  redundancy:
  format:
```

## 12.3 CineOS responsibility

CineOS is not a replacement for a broadcast control system.

It can:

- model streams
- document routing intent
- attach streams to camera/audio nodes
- validate required synchronization metadata
- export integration manifests

Actual network engineering remains specialist work.

## 12.4 Timing

Live/VP pipelines require synchronization awareness.

Store:

```yaml
timing:
  timecode:
  genlock:
  ptp:
  latency_budget_ms:
```

---

# 13. Media Asset Provenance

Every asset should be traceable.

```yaml
media_asset:
  asset_id:
  shot_id:
  take_id:
  uri:
  checksum:
  created_at:
  source_type:
    - camera
    - audio
    - ai_generated
    - render
    - scan
    - stock
  model_info:
  rights:
  color_pipeline:
```

AI media adds:

```yaml
generation:
  provider:
  model:
  prompt_hash:
  reference_assets:
  generation_time:
```

---

# 14. Production Identity Model

IDs:

```text
PROJECT
SEQUENCE
SCENE
SHOT
TAKE
MEDIA
VFX TASK
GENERATION RUN
```

Example:

```text
PRJ001
PRJ001_SQ03
PRJ001_SQ03_SC012
PRJ001_SQ03_SC012_SH042
PRJ001_SQ03_SC012_SH042_TK003
PRJ001_SQ03_SC012_SH042_TK003_CAM_A_001
```

Never use filenames as identity.

---

# 15. Shot Lifecycle

```text
IDEA
→ PLANNED
→ PREVIS
→ TECHVIS
→ APPROVED
→ CAPTURED / GENERATED
→ SELECTED
→ EDITED
→ VFX
→ COLOR
→ FINAL
→ ARCHIVED
```

State transitions are logged.

---

# 16. VFX Task Graph

Each Shot may create tasks:

```text
camera track
roto
paint
wire removal
screen replacement
CG product
FX simulation
set extension
compositing
QC
```

Dependencies:

```text
camera track
→ CG render
→ comp
```

CineOS should track planning metadata, not replace a VFX production manager.

---

# 17. Virtual Production Stage Model

```yaml
vp_stage:
  led_geometry:
  pixel_pitch:
  processor:
  brightness:
  color_space:
  camera_tracking:
  genlock:
  render_nodes:
  frustum:
  off_camera_panels:
  practical_lighting:
```

## 17.1 Latency budget

Track:

```text
tracking
→ render
→ processing
→ display
→ camera
```

Latency may affect fast moves.

## 17.2 Lens calibration

VP requires:

- focal
- focus
- distortion
- nodal/entrance pupil behavior
- lens metadata

CineOS lens profiles become reusable calibration assets.

---

# 18. Look Development Digital Twin

A Look is not just “teal orange.”

```yaml
look:
  id:
  intent:
  reference_assets:
  contrast:
  toe:
  shoulder:
  saturation:
  hue_bias:
  skin_treatment:
  grain:
  halation:
  bloom:
  lens_diffusion:
  color_pipeline_id:
```

A look can be rendered as:

- technical metadata
- creative description
- AI prompt language
- CDL/CLF/AMF references

---

# 19. Delivery Model

Project may need:

```text
Cinema DCP
HDR master
SDR master
Broadcast
Web
9:16
16:9
4:5
1:1
Stills
Social cutdowns
```

Shot composition safe areas can be validated against delivery formats.

---

# 20. Multi-format Framing

Store canonical framing plus protected regions:

```yaml
framing:
  capture_aspect:
  primary_delivery:
  protect:
    - 2.39
    - 16:9
    - 9:16
```

Virtual camera overlays show all crops.

---

# 21. Production Planning Constraints

Every recommendation may be filtered by:

```yaml
constraints:
  budget:
  crew_size:
  studio_size:
  ceiling_height:
  available_power:
  owned_equipment:
  rental_availability:
  shoot_hours:
  talent_time:
  weather:
  permits:
  safety:
```

This converts ideal cinematography into production-realistic cinematography.

---

# 22. Cost Model

Do not hard-code volatile prices.

Store:

```yaml
cost_class:
  low
  medium
  high
  specialty
```

Dynamic rental price integrations can be separate adapters.

Shot-level cost drivers:

- setup complexity
- specialist crew
- equipment
- destructive reset
- VFX
- data
- location
- overtime risk

---

# 23. Carbon / Resource Model

Optional future module:

```yaml
resource:
  power_kwh:
  generator:
  transport_weight:
  consumables:
  water_usage:
```

Useful for production sustainability reporting.

---

# 24. QA Beyond AI

Real footage QC can evaluate:

- focus
- clipping
- dead pixels
- flicker
- rolling-shutter artifact
- dropped frames
- audio sync
- continuity
- framing
- boom intrusion

Each alert retains confidence.

---

# 25. On-set CineOS

Potential workflow:

```text
Plan
↓
tablet / workstation
↓
shot card
↓
live camera metadata
↓
actual take
↓
compare planned vs actual
↓
continuity / QC
```

Actual settings should overwrite `actual_capture`, never destroy `planned_capture`.

---

# 26. Planned vs Actual

```yaml
shot:
  planned:
    camera:
    lens:
    lights:
  actual:
    camera:
    lens:
    lights:
```

Variance report:

```text
planned 85mm
actual 75mm

planned T2.8
actual T4
```

This becomes valuable for future recommendation learning.

---

# 27. Knowledge Learning Loop

After production:

```text
planned
vs
actual
vs
selected take
vs
final image
```

CineOS can learn:

- what recommendations crews override
- what setups succeed
- which AI prompts fail
- which lens/light combinations produce desired results

Human approval remains central.

---

# 28. Recommendation Provenance

Every recommendation should say whether it comes from:

```text
physics
geometry
manufacturer spec
crew preference
project precedent
historical project data
heuristic
AI inference
```

---

# 29. Department Views

Same shot, different views.

Director:
- story / performance / framing

DP:
- camera / lens / exposure / look

Gaffer:
- fixtures / levels / power / cues

Grip:
- rigs / flags / camera movement / safety

SFX:
- effect state / reset / cue / safety

Sound:
- boom / noise / ADR

VFX:
- plates / tracking / metadata

DIT:
- codec / color / media / sync

Editor:
- selected take / timing

Producer:
- time / cost / risk

---

# 30. Core V3 APIs

Recommended service boundaries:

```text
SceneGraphService
ShotService
AssetService
CoverageSolver
BlockingSolver
LensService
PhotometricSolver
MaterialLightingSolver
PracticalFXSolver
MotionTechvisSolver
SoundPlanner
ContinuityService
InverseCinematographySolver
CausalGraphService
AIQAEvaluator
USDAdapter
ACESAdapter
OTIOAdapter
LiveIPAdapter
```

---

# 31. V3 Implementation Priorities

## Priority A — Canonical graph and identity
Do this first.

## Priority B — USD / OTIO / color adapters
Make interoperability possible.

## Priority C — Sound + Continuity
High production value and relatively independent.

## Priority D — AI QA loop
Important for generative workflows.

## Priority E — Inverse cinematography
High differentiation, technically harder.

## Priority F — Full causal graph
Turns CineOS into an explainable cinematography reasoning system.

---

# 32. Non-goals

CineOS should not attempt to:

- replace licensed SFX / stunt / rigging professionals
- become an NLE
- become a full DCC renderer
- become a broadcast router
- become a color-grading application
- replace on-set judgment

It should be the **shared reasoning and scene-data layer** connecting those systems.

---

# 33. Final Architectural Statement

CineOS should evolve into:

```text
FILM PRODUCTION DIGITAL TWIN
+
CINEMATOGRAPHY REASONING ENGINE
+
TECHVIS / PREVIS PLANNER
+
PRACTICAL FX PLANNER
+
GENERATIVE VIDEO DIRECTOR
+
INTERCHANGE LAYER
```

The core value is not any single database.

The core value is preserving **intent, physical cinematography, production state, and final media lineage** through one canonical graph.
