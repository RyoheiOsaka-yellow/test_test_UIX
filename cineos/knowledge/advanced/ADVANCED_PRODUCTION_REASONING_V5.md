# CineOS Advanced Production Reasoning — V5 Extension

## 1. Purpose

This document extends CineOS from a cinematography knowledge base into a production-reasoning system for feature film, drama, commercial, music video, documentary, live, still, VFX, virtual production and practical special effects.

The system must solve six linked problems:

1. screenplay → dramatic beats → coverage
2. actor blocking → camera zones → lighting zones
3. camera/lens metadata → physically plausible shot state
4. photometric lighting → exposure feasibility
5. practical effects → visual event timeline + continuity + VFX capture
6. motion-control / crane / drone → path feasibility + collision envelope

The canonical unit is always a `Shot`, but a Shot belongs to a Scene, and a Scene is driven by narrative intent and production constraints.

---

# 2. Screenplay → Coverage Solver

## 2.1 Scene parsing

Extract:

```yaml
scene:
  slugline:
  interior_exterior:
  location:
  time_of_day:
  characters: []
  props: []
  dramatic_goal:
  conflict:
  information_reveals: []
  physical_actions: []
  dialogue_beats: []
  emotional_beats: []
  practical_fx: []
  stunt_events: []
  vfx_events: []
```

## 2.2 Beat model

A beat is not a line of dialogue. It is a meaningful change in dramatic state.

```yaml
beat:
  id:
  type:
    - reveal
    - reaction
    - decision
    - action
    - interruption
    - escalation
    - reversal
    - silence
  subject:
  importance: 0.0-1.0
  duration_estimate_s:
  visual_priority:
```

Coverage should be generated from beats, not from arbitrary “cinematic” shot variety.

## 2.3 Coverage families

Narrative baseline:

- establishing / geography
- master
- group / two-shot
- over-the-shoulder
- single
- close single
- extreme close-up
- insert
- reaction
- POV
- cutaway
- moving master
- specialized event camera

Rules:

```text
IF geography is unclear
THEN establish space before relying on close coverage.

IF a reaction changes story meaning
THEN create dedicated reaction coverage or preserve it in a two-shot/master.

IF an object carries plot information
THEN create readable insert or motivated POV.

IF action is destructive / expensive / one-off
THEN prefer simultaneous multi-camera coverage subject to safety and visual plan.
```

## 2.4 Dialogue coverage

For 2-person dialogue:

```yaml
axis:
  actor_a:
  actor_b:
  line_of_action:
camera_side_lock:
```

Candidate set:

- master two-shot
- OTS A
- OTS B
- CU A
- CU B
- reaction inserts
- object insert if story relevant

Do not generate all coverage automatically. Select based on edit need, performance, schedule and tone.

## 2.5 180° rule

Represent the dramatic axis geometrically.

```yaml
axis:
  p1_xyz:
  p2_xyz:
  normal_vector:
  allowed_camera_halfspace:
```

Warnings:

- axis crossing without neutral bridge
- eyeline inversion
- screen-direction break

Allow intentional override with `creative_override_reason`.

## 2.6 30° rule

If consecutive camera positions are too similar, warn of jump-cut risk.

This is a heuristic, not an absolute rule.

## 2.7 Eyeline

Each character has a look target.

```yaml
eyeline:
  source_character:
  target:
  vector:
  camera_side:
  screen_direction:
```

## 2.8 Coverage optimization

Objective:

```text
maximize:
  dramatic clarity
  editorial flexibility
  performance continuity
  visual intent

minimize:
  setup count
  major relights
  lens swaps
  destructive resets
  schedule risk
```

---

# 3. Blocking Solver

## 3.1 Actor path

```yaml
blocking:
  character_id:
  keyframes:
    - t:
      xyz:
      body_yaw:
      head_yaw:
      eye_target:
      pose:
```

## 3.2 Blocking-derived camera zones

For each beat:

- line of sight
- desired shot size
- foreground occlusion
- axis
- background
- lens perspective
- operator path

Generate candidate camera locations.

## 3.3 Lighting zones

A drama scene may require playable zones rather than one perfect mark.

```yaml
lighting_zone:
  id:
  polygon_xyz:
  target_exposure:
  key_direction:
  motivation:
  contrast_range:
  eye_light_allowed:
```

Examples:

- WINDOW_ZONE
- TABLE_PRACTICAL_ZONE
- HALLWAY_POOL
- SOFA_CLOSEUP_ZONE

## 3.4 Exposure continuity across movement

If actor moves closer to a source, inverse-square falloff can cause exposure drift.

The solver can recommend:

- move source farther away
- use larger source
- add a second motivated source
- dim/cue fixtures
- accept exposure change creatively

---

# 4. Lens Metadata Model

## 4.1 Why lens metadata matters

A lens should not be represented only as focal length.

Per-shot / per-frame metadata may include:

```yaml
lens_state:
  lens_id:
  serial:
  focal_length_mm:
  focus_distance_m:
  t_stop:
  zoom_position:
  near_focus_limit:
  far_focus_limit:
  hyperfocal_distance_m:
  horizontal_fov_deg:
  entrance_pupil_position_mm:
  distortion_profile_id:
  vignetting_profile_id:
  shading_profile_id:
```

For zoom/focus moves, values are time-varying.

## 4.2 Lens timeline

```yaml
lens_timeline:
  - t: 0.0
    focal_mm: 40
    focus_m: 0.7
    t_stop: 2.8
  - t: 1.4
    focal_mm: 40
    focus_m: 2.8
    t_stop: 2.8
```

## 4.3 Distortion profile

```yaml
distortion:
  model:
  coefficients:
  calibrated_focus_positions: []
  calibrated_focals: []
  source:
  confidence:
```

## 4.4 Vignetting / shading

Store separately from creative vignette.

```yaml
lens_shading:
  radial_profile:
  color_shading:
  focus_dependency:
  iris_dependency:
```

## 4.5 Lens character

Subjective look metadata must be marked separately from measured data.

```yaml
look:
  contrast_score:
  flare_character:
  bokeh_character:
  breathing_score:
  edge_softness:
  chromatic_aberration:
  source_type: measured | review | subjective
```

---

# 5. Camera Image Model

Camera choice is not only resolution and dynamic range.

```yaml
camera_image_model:
  sensor_format:
  readout_mode:
  rolling_shutter_ms:
  global_shutter:
  highlight_rolloff:
  shadow_noise_character:
  color_response_profile:
  olpf:
  internal_sharpening:
  texture:
  raw_pipeline:
  debayer:
  base_ei_modes:
```

Prompt adapters should translate capabilities rather than simply outputting brand names.

Example:

```text
Instead of:
"shot on ALEXA"

Prefer:
"high dynamic-range cinema image with smooth highlight roll-off, restrained digital sharpening and natural skin-tone separation"
```

---

# 6. Photometric Lighting Solver

## 6.1 Fixture source data

Canonical fixture photometric structure:

```yaml
photometrics:
  cct_k:
  optic:
  distance_m:
  center_lux:
  beam_angle_deg:
  field_angle_deg:
  edge_lux:
```

Prefer manufacturer data.

## 6.2 Modifier loss

```yaml
modifier:
  transmission_stops:
  spread_deg:
  color_shift_duv:
  source_size_m:
```

## 6.3 Exposure feasibility

Inputs:

- fixture photometrics
- distance
- modifier losses
- fps
- shutter angle
- T-stop
- EI
- ambient level
- target exposure

High-speed exposure change:

```text
exposure_time = shutter_angle / 360 / fps
```

Relative stop loss from 24fps / 180° baseline:

```text
stop_loss = log2(target_fps / 24)
```

assuming same shutter angle.

Examples:

- 120fps ≈ 2.32 stops less exposure
- 240fps ≈ 3.32 stops
- 1000fps ≈ 5.38 stops

## 6.4 Light ratio

```text
stop_delta = log2(key_lux / fill_lux)
```

## 6.5 Large-source approximation

For large nearby sources, a simple point-source inverse-square model is insufficient. Use:

- fixture photometric interpolation
- source apparent size
- ray-traced or area-light approximation

## 6.6 Spectral model

Future-ready fields:

```yaml
spectral:
  CRI:
  TLCI:
  SSI_D32:
  SSI_D56:
  TM30:
  SPD_reference:
```

---

# 7. Modifier Database

Modifier records should be independent from fixtures.

Categories:

- 216 / full white diffusion
- 250 / half white diffusion
- opal
- grid cloth
- half grid
- quarter grid
- magic cloth
- muslin
- ultrabounce
- silver
- black solids
- nets
- scrims
- eggcrates
- snoots
- projector optics

Fields:

```yaml
modifier:
  category:
  nominal_size:
  transmission_stops:
  spread:
  reflectance:
  specularity:
  warmth_shift:
  texture:
  wind_risk:
```

---

# 8. Practical FX Physics Model

## 8.1 Core principle

Practical effects are modeled as visible phenomena, not as construction recipes.

Each effect has:

```yaml
effect:
  visual_state:
  force_field:
  particles:
  fluid:
  light_emission:
  environment_interaction:
  actor_interaction:
  continuity:
  reset:
  safety_class:
```

## 8.2 Rain

```yaml
rain:
  density:
  apparent_drop_size:
  fall_velocity_visual:
  wind_vector:
  backlight_angle:
  ground_splash:
  wetness_accumulation:
```

Visibility depends on:

- background luminance
- back/side light
- focal length
- shutter
- drop size
- density

## 8.3 Wind

```yaml
wind:
  base_speed_visual:
  direction:
  turbulence:
  gust_frequency:
  gust_strength:
```

Affected scene objects carry response parameters:

```yaml
cloth:
  mass:
  stiffness:
  area:
hair:
  length:
  stiffness:
foliage:
  drag:
```

## 8.4 Smoke / haze

```yaml
atmosphere:
  density:
  drift:
  diffusion:
  dissipation_rate:
  source_region:
```

## 8.5 Snow

```yaml
snow:
  flake_scale:
  density:
  drift:
  accumulation:
  foreground_fraction:
```

## 8.6 Fire / explosion visual event

Safety class C. No charge or construction data.

Visual state machine:

```text
PRE_EVENT
→ INTERACTIVE_FLASH
→ PRIMARY_EVENT
→ FIRE / DUST / DEBRIS
→ SMOKE DEVELOPMENT
→ AFTERMATH
```

Fields:

```yaml
event_visual:
  flash_duration_visual:
  flash_color:
  fireball_extent_visual:
  debris_cone_visual:
  dust_density:
  smoke_growth:
  interactive_light:
  camera_reaction:
```

## 8.7 Breakaway / destruction

Track persistent scene state:

```text
INTACT → DAMAGED → BROKEN
```

Broken objects must stay broken unless a reset/duplicate is declared.

---

# 9. Motion Control & Techvis

## 9.1 Rig model

```yaml
motion_rig:
  footprint:
  payload_kg:
  max_reach_m:
  min_height_m:
  max_height_m:
  axis_limits:
  max_velocity:
  max_acceleration:
  repeatability:
  collision_geometry:
  operator_exclusion_geometry:
```

## 9.2 Path validation

A requested camera spline must be checked against:

- mechanical reach
- axis limits
- payload
- collision
- set geometry
- floor
- ceiling
- actor
- props
- lighting
- crew path

## 9.3 Robot + external devices

Timeline can include:

- robot
- track
- turntable
- FIZ
- DMX light cue
- camera trigger
- high-speed capture trigger
- model mover

## 9.4 Motion-control event timeline

```yaml
timeline:
  - t: -1.0
    action: camera_buffer_arm
  - t: 0
    action: robot_move_start
  - t: 0.4
    action: focus_transition
  - t: 0.62
    action: light_sweep
  - t: 0.7
    action: visual_effect_event
```

Hazardous actual triggering remains outside CineOS.

---

# 10. Virtual Production Metadata

## 10.1 Real-time camera/lens metadata

Support canonical stream:

```yaml
live_metadata:
  timecode:
  recording_state:
  camera_pose:
  focal_length:
  focus_distance:
  iris:
  zoom:
  distortion:
  vignetting:
  shading:
```

## 10.2 Camera tracking

```yaml
tracking:
  xyz:
  quaternion:
  timestamp:
  confidence:
  latency_ms:
```

## 10.3 LED volume

```yaml
led_volume:
  frustum:
  genlock:
  refresh:
  camera_sync:
  display_transform:
  brightness:
  color_space:
  off_camera_lighting_panels:
```

## 10.4 Unreal adapter

Core CineOS data must remain engine-neutral. Unreal is an adapter.

```text
CineOS canonical shot
→ Unreal adapter
→ virtual camera / lights / tracking / LED
```

---

# 11. Screenplay-to-Shot Pipeline

```text
SCREENPLAY
  ↓
Scene Parser
  ↓
Beat Parser
  ↓
Blocking Hypothesis
  ↓
Coverage Solver
  ↓
Shot Candidates
  ↓
Axis / Eyeline Validator
  ↓
Camera-Lens Solver
  ↓
Lighting Zone Solver
  ↓
SFX / Stunt / VFX Event Planner
  ↓
Feasibility Solver
  ↓
Shot JSON
  ↓
Storyboard / Techvis / PDF / AI Prompt
```

---

# 12. Solver Explainability

Every solver output must contain reasons.

```yaml
recommendation:
  value: 85mm
  because:
    - close coverage benefits from reduced facial perspective exaggeration
    - camera can remain outside actor blocking path
    - background compression supports the intended isolation
  confidence: 0.82
  alternatives:
    - 65mm
    - 100mm
```

---

# 13. Conflict Solver

Examples:

- 1000fps + low-output fixture + T8 → exposure conflict
- 360° actor blocking + large frontal softbox → crew/light visibility conflict
- reflective car + white studio → uncontrolled reflection conflict
- wide master + boom + hard top light → boom-shadow risk
- robot path + overhead diffusion frame → collision conflict

Conflicts must be surfaced, not silently “fixed.”

---

# 14. Data Provenance

Each fact:

```yaml
provenance:
  type: official_spec | manual | measurement | heuristic | subjective
  source:
  verified_date:
  confidence:
```

Measured and subjective lens “look” fields must never be confused with official specifications.

---

# 15. Phase V Implementation Priority

1. screenplay parser
2. beat model
3. coverage solver
4. blocking path model
5. axis / eyeline validator
6. lens state timeline
7. photometric solver
8. modifier DB
9. practical FX state engine
10. motion-rig feasibility engine
11. VP metadata adapter
12. storyboard / PDF / prompt outputs

