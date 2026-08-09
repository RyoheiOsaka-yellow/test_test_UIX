# CineOS V8 --- Pattern DNA & Reference Intelligence

## 0. Objective

V6 made editing a first-class reasoning domain. V7 introduced an
Editorial Pattern Library.

V8 adds a higher-order layer:

**Pattern DNA**

The goal is not to copy existing films, commercials, music videos,
television, social videos or creators.

The goal is to decompose reference works into reusable cinematic
principles and connect those principles to:

`Intent → Editorial Structure → Coverage → Camera → Lens → Movement → Lighting → Art/Material → SFX → VFX → Sound → Edit → Generative Video Prompt`.

Pattern DNA must describe **why a visual sequence works**, not merely
what it looks like.

------------------------------------------------------------------------

# 1. Three Layers

## Layer A --- V6 Editorial Intelligence

Understands editing grammar and downstream post-production.

## Layer B --- V7 Pattern Library

Stores reusable production/editorial archetypes.

## Layer C --- V8 Pattern DNA

Extracts reusable cinematic attributes from reference works and composes
new patterns.

V8 should therefore be able to answer:

> What makes this reference feel luxurious, tense, refreshing,
> nostalgic, chaotic, intimate or monumental?

and convert that answer into controllable production variables.

------------------------------------------------------------------------

# 2. Pattern DNA Object

``` yaml
pattern_dna:
  dna_id:
  source_reference_id:
  source_type:
  provenance:
  rights_context:
  analysis_confidence:

  narrative:
    premise_function:
    dramatic_beats:
    information_strategy:
    emotional_curve:

  editorial:
    pacing_profile:
    shot_duration_profile:
    cut_motivations:
    transition_families:
    reaction_strategy:
    montage_strategy:
    sound_picture_relationship:

  camera:
    shot_size_distribution:
    angle_distribution:
    lens_character:
    camera_height:
    camera_distance:
    movement_profile:
    stability_profile:
    subjective_objective_profile:

  composition:
    symmetry:
    negative_space:
    headroom:
    leading_lines:
    depth_layers:
    foreground_occlusion:
    subject_placement:

  lighting:
    key_quality:
    key_direction:
    contrast:
    fill_strategy:
    edge_strategy:
    practical_strategy:
    color_temperature_relation:
    atmospheric_light:
    specular_strategy:

  material:
    skin_rendering:
    glass:
    metal:
    liquid:
    food:
    fabric:
    automotive_paint:
    product_surface:

  environment:
    time_of_day:
    weather:
    haze:
    rain:
    wind:
    smoke:
    dust:
    snow:
    water:
    practical_fx:

  sound:
    dialogue_density:
    ambience:
    foley:
    hard_fx:
    music_relationship:
    silence_strategy:

  post:
    color_character:
    grain_texture:
    halation:
    sharpness:
    bloom:
    motion_blur:
    vfx_density:

  generative:
    stable_attributes:
    fragile_attributes:
    recommended_clip_modularity:
    continuity_risks:
    prompt_tokens_to_avoid:
```

------------------------------------------------------------------------

# 3. Reference Ingestion

Supported reference types should include:

-   film
-   television drama
-   commercial
-   branded film
-   music video
-   documentary
-   fashion film
-   beauty film
-   food film
-   automotive film
-   sports promo
-   live performance
-   trailer
-   social video
-   still photography
-   title sequence
-   animation
-   virtual production
-   CG/VFX sequence

Reference ingestion may come from: - user-uploaded legal reference
media - manually entered observations - licensed/internal datasets -
public metadata and factual production information - user-created CineOS
projects

Do not assume that publicly viewable media can be copied into a training
corpus without rights review.

------------------------------------------------------------------------

# 4. Shot Decomposition

For each reference sequence, decompose into shots.

Per shot:

``` yaml
reference_shot:
  shot_id:
  source_range:
  duration:
  narrative_role:
  subject:
  shot_size:
  camera_angle:
  camera_height:
  lens_estimate:
  depth_of_field:
  camera_motion:
  motion_speed:
  composition:
  lighting_estimate:
  material_behavior:
  environment_fx:
  sound_event:
  transition_in:
  transition_out:
  confidence:
```

Estimates must be marked as estimates.

------------------------------------------------------------------------

# 5. Sequence Decomposition

A sequence is more than a list of shots.

Extract: - opening strategy - escalation - reveal order - reaction
order - rhythm acceleration - silence - repetition - visual motifs -
product timing - hero timing - CTA/title timing - geography strategy -
emotional peak - release

------------------------------------------------------------------------

# 6. Visual DNA

Visual DNA should capture relationships rather than superficial
adjectives.

Bad: `cinematic, premium, beautiful`

Better:
`large soft source 45° camera-left + negative fill camera-right + narrow warm practical in deep background + 85mm shallow portrait + slow 10cm push-in + reaction held after dialogue`.

------------------------------------------------------------------------

# 7. Camera DNA

Represent distributions.

Example:

``` yaml
camera_dna:
  shot_sizes:
    ECU: 0.20
    CU: 0.35
    MCU: 0.25
    MS: 0.10
    WS: 0.10
  movement:
    locked: 0.25
    slow_push: 0.35
    handheld: 0.15
    lateral: 0.15
    crane: 0.10
```

Do not pretend estimates are measured facts unless actual metadata
exists.

------------------------------------------------------------------------

# 8. Lens DNA

Describe: - focal-length tendency - compression - distortion - minimum
focus behavior - depth-of-field tendency - flare behavior -
anamorphic/spherical character - macro/probe usage - zoom vs prime
behavior

Separate optical characteristics from camera-position effects.

------------------------------------------------------------------------

# 9. Movement DNA

Movement dimensions: - motivation - direction - amplitude - velocity -
acceleration - smoothness - parallax - orbit - push/pull - tracking -
handheld energy - whip - crane - drone - vehicle - robotic repeatability

A "slow push-in" is not enough. CineOS should know what event motivates
the push.

------------------------------------------------------------------------

# 10. Lighting DNA

Represent: - source size - direction - height - distance - softness -
contrast - fill ratio - edge/rim - negative fill - bounce - diffusion -
practicals - reflection cards - flags/grids - atmospheric interaction

For product work, lighting DNA must be material-aware.

------------------------------------------------------------------------

# 11. Material DNA

## Glass

Transmission, edge highlights, reflection control, background
separation.

## Liquid

Backlight/transmission, viscosity cues, bubbles, splash, condensation,
pour continuity.

## Metal

Large reflection sources, edge definition, black cards, highlight
movement.

## Glossy product

Reflection geometry is often more important than direct illumination.

## Skin

Source size, angle, specular control, texture preservation and eye
light.

## Food

Moisture, steam, glaze, texture, heat cues and color fidelity.

## Fabric

Raking light, movement, weave, translucency and silhouette.

------------------------------------------------------------------------

# 12. Special Effects DNA

Capture the editorial/visual role of: - rain - wind - snow - fog -
haze - smoke - dust - debris - sparks - fire - water - splash -
condensation - steam - bubbles - breakaway effects - atmospheric
particles

V8 stores the desired visible effect and capture relationship.

Hazardous real-world construction, pyrotechnic charges, explosive
quantities, ignition systems or dangerous stunt execution remain outside
automated procedural guidance.

------------------------------------------------------------------------

# 13. Drone / Aerial DNA

Analyze: - altitude impression - pitch - orbit radius - subject lock -
reveal - top-down - parallax - chase - crane-like rise - landscape
scale - speed - transition to ground camera

Separate drone aesthetic from a specific drone model.

Equipment selection happens later.

------------------------------------------------------------------------

# 14. Sound DNA

Extract: - dialogue/music ratio - ambience density - transient
emphasis - silence - Foley prominence - sound bridges - prelap/postlap -
subjective sound - bass-impact moments - product ASMR - crowd energy

------------------------------------------------------------------------

# 15. Color / Texture DNA

Represent: - contrast - black level - highlight rolloff - saturation -
hue bias - skin separation - highlight warmth/coolness - grain -
halation - bloom - sharpening - diffusion character

Avoid using vague film-stock names as substitutes for measurable visual
attributes.

------------------------------------------------------------------------

# 16. Editorial DNA

Extract: - median shot duration - duration distribution - local
acceleration/deceleration - reaction timing - dialogue overlap - montage
density - transition families - cut-on-motion tendency - use of long
holds - reveal timing - information withholding - end-frame behavior

------------------------------------------------------------------------

# 17. Commercial DNA

Commercial analysis adds: - product first appearance - product total
visibility - benefit demonstration - sensory proof - human payoff -
packshot - logo - CTA - legal - brand mnemonic

------------------------------------------------------------------------

# 18. Genre DNA Families

V8 should support DNA clusters for:

-   luxury
-   refreshing
-   appetizing
-   beauty
-   clinical
-   futuristic
-   playful
-   nostalgic
-   documentary-natural
-   high-energy sports
-   intimate drama
-   suspense
-   horror
-   comedy
-   romance
-   epic
-   gritty
-   surreal
-   dreamlike
-   retro
-   social-native
-   UGC-like
-   fashion editorial
-   automotive premium
-   architectural minimalism

These are multidimensional clusters, not single style tags.

------------------------------------------------------------------------

# 19. Pattern DNA Composition

New patterns can be synthesized from several DNA sources.

Example:

``` text
Refreshing beverage editorial DNA
+
Luxury cosmetics lighting DNA
+
Sports movement DNA
+
Social 9:16 hook DNA
=
New premium sports drink pattern
```

The system must record lineage.

------------------------------------------------------------------------

# 20. DNA Distance

Similarity should be calculated across dimensions.

Possible vector groups: - editorial - camera - lighting - material -
sound - color - movement - narrative

Allow user-adjustable weighting.

A visually similar reference can have a very different editorial DNA.

------------------------------------------------------------------------

# 21. DNA Retrieval

User: \> 夏の夕方、少しレトロでスマホ撮影っぽいワインCM

Retrieve independently: - warm late-day lighting DNA - casual
handheld/mobile camera DNA - retro texture DNA - wine/product editorial
DNA - relaxed lifestyle performance DNA

Then synthesize.

------------------------------------------------------------------------

# 22. Anti-Copy Layer

Pattern DNA should actively avoid over-reproducing a single reference.

Controls: - require multiple-reference synthesis where appropriate -
separate general techniques from distinctive expressive choices - track
source lineage - avoid recreating identifiable shots too literally
unless the user owns/provides the source and asks for transformation
within allowed use - generate abstracted production variables rather
than "copy this director"

------------------------------------------------------------------------

# 23. Provenance

Every extracted DNA item should know: - source - source type -
extraction method - human vs model annotation - confidence - date -
rights/usage context where known

------------------------------------------------------------------------

# 24. Expert Annotation

Experts should be able to correct: - estimated lens - lighting
direction - shot role - transition - movement - material technique -
SFX/VFX interpretation

Corrections become higher-confidence knowledge.

------------------------------------------------------------------------

# 25. Learning Loop

``` text
Reference
→ DNA Extraction
→ Expert Correction
→ Pattern
→ Production Plan
→ Generated/Captured Result
→ Editorial Outcome
→ User/Editor Override
→ Pattern Performance
→ Library Update
```

Do not automatically promote every generated pattern to canonical
knowledge.

------------------------------------------------------------------------

# 26. Pattern Performance

Track project-level signals: - generated-shot acceptance - regeneration
count - continuity failures - edit utilization - client/editor
approval - coverage waste - missing coverage - product fidelity -
runtime compliance

These metrics help rank patterns.

------------------------------------------------------------------------

# 27. Failure DNA

Store recurring failure modes.

Examples: - AI liquid geometry breaks during complex camera move - label
deforms under rotation - hands fail during product interaction - long
prompt combines too many beats - whip transition loses identity -
drone-like motion causes impossible parallax - rain consistency changes
across cuts

Failure DNA can recommend safer production decomposition.

------------------------------------------------------------------------

# 28. Real / AI / CG / VP / Hybrid Routing

Pattern DNA should help choose execution mode per shot.

Examples: - physically complex liquid macro → real/high-speed or
controlled CG may outperform generative video - impossible environment
transformation → CG/generative/VP - precise branded packshot → real/CG
with strong geometry control - atmospheric lifestyle insert → generative
video may be suitable

Routing must be capability-based, not ideological.

------------------------------------------------------------------------

# 29. Seedance Compiler

Pattern DNA becomes explicit instructions.

Per shot:

``` yaml
seedance_shot:
  editorial_role:
  target_duration:
  aspect_ratio:
  start_state:
  end_state:
  subject_identity:
  subject_action:
  product_state:
  camera_position:
  camera_height:
  lens_character:
  framing:
  camera_motion:
  movement_speed:
  lighting:
  material_behavior:
  atmosphere:
  special_effect:
  background:
  sound_intent:
  continuity_from:
  continuity_to:
  negative_constraints:
  qa_targets:
```

------------------------------------------------------------------------

# 30. Prompt Granularity

CineOS should decide whether to generate: - one continuous shot -
several modular shots - a transition-only shot - an insert - a clean
product plate - a reaction - an environment plate

The goal is editable material, not merely an impressive isolated
generation.

------------------------------------------------------------------------

# 31. Still Photography DNA

The same engine should support still photography.

Still-specific attributes: - hero angle - camera height - focal plane -
focus stacking - product orientation - reflection design - background
gradient - tabletop geometry - shadow character - prop styling -
splash/liquid timing - beauty retouch intent

Still Pattern DNA can share lighting/material knowledge with motion.

------------------------------------------------------------------------

# 32. Storyboard / Lighting Diagram Output

V8 should generate structured data for: - shot list - storyboard
frames - top-down camera diagram - lighting diagram - equipment list -
continuity notes - SFX/VFX notes - edit timeline - Seedance prompt - PDF
production book

The diagram is generated from the same canonical shot state, never from
separate manually drifting text.

------------------------------------------------------------------------

# 33. Search UX

Users should be able to search by natural language:

-   "爽やかな炭酸飲料"
-   "90年代の少し荒いMV"
-   "高級化粧品のマクロ"
-   "静かな会話劇"
-   "不穏なホラー"
-   "Appleっぽい" should be translated into attributes rather than
    direct imitation: minimal product staging, controlled reflections,
    restrained typography, etc.

Return several DNA candidates and explain differences.

------------------------------------------------------------------------

# 34. Pattern Mixer

UI concept:

``` text
EDITORIAL      [A─────●──B]
CAMERA         [A──●────B]
LIGHTING       [A──────●B]
COLOR          [A─●─────B]
MOVEMENT       [A────●──B]
SOUND          [A───●───B]
```

Users can blend different reference DNAs by dimension.

------------------------------------------------------------------------

# 35. Constraint Layer

Pattern DNA cannot override: - user locked requirements - equipment
limitations - location constraints - safety rules - product fidelity -
continuity - runtime - aspect ratio - legal requirements

------------------------------------------------------------------------

# 36. Implementation Priorities

## Phase 1

DNA schema + manual annotation + pattern retrieval.

## Phase 2

Reference shot decomposition.

## Phase 3

Automatic feature extraction with confidence.

## Phase 4

DNA mixer and synthesis.

## Phase 5

Pattern performance and failure learning.

## Phase 6

Full compiler to production book and Seedance.

Do not start with a giant uncontrolled scraper.

------------------------------------------------------------------------

# 37. Initial Taxonomy Size

Recommended target:

-   50--100 high-quality curated DNA archetypes first
-   500--1,000 validated subpatterns
-   2,000--5,000 derived combinations
-   later expansion from real project learning

Quality and provenance matter more than raw count.

------------------------------------------------------------------------

# 38. Canonical End-to-End Flow

``` text
User Intent
↓
Reference / Pattern Search
↓
Pattern DNA Retrieval
↓
DNA Mixer
↓
Editorial Pattern Synthesis
↓
Coverage Sufficiency
↓
Shot Architecture
↓
Camera / Lens / Movement
↓
Lighting / Material
↓
SFX / VFX / Sound
↓
Equipment Compatibility
↓
Execution Router
  ├ Real
  ├ AI
  ├ CG
  ├ VP
  └ Hybrid
↓
Seedance / Generation Instructions
↓
Storyboard / Diagram / Production PDF
↓
Generated or Captured Media
↓
Editorial QA
↓
Timeline / Post
↓
Pattern Performance Learning
```

------------------------------------------------------------------------

# 39. V8 Product Principle

CineOS should not become a library of "cool shots."

It should become a **cinematography and editorial reasoning system**
capable of explaining:

-   what to shoot
-   why to shoot it
-   how to shoot it
-   how to light it
-   what equipment is required
-   how it should cut
-   what assets are missing
-   whether real/AI/CG/VP is appropriate
-   how to instruct a generative-video model
-   how to validate the result

That is the role of Pattern DNA.
