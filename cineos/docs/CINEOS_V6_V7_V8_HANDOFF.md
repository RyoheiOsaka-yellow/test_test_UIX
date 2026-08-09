# CineOS V6 → V7 → V8 Development Handoff

## V6 --- Editorial Intelligence

Editing becomes a canonical domain. Core objects include
EditorialIntent, EditDecision, Cut, Transition and Timeline. Implement
CoverageSufficiency, Selects, RoughCut reasoning, sound editorial, VFX
turnover, conform, version diff and QC. Preserve independent
picture/audio cut points and source/record time.

## V7 --- Editorial Pattern Library

Store reusable production/editorial archetypes and derived
duration/aspect variants. Retrieve multiple candidates, synthesize them,
then run CoverageSufficiency. Convert the result into
camera/lens/movement, lighting/material/SFX/VFX, equipment
compatibility, Shot JSON and Seedance instructions.

## V8 --- Pattern DNA

Analyze references into reusable multidimensional DNA rather than
copying surface style. DNA dimensions include narrative, editorial,
camera, composition, lens, movement, lighting, material,
environment/SFX, sound, color/texture, VFX/post and generative
stability. Mix DNA dimensions from multiple references, preserve
provenance/lineage, compile into V7 patterns, and route each shot to
Real/AI/CG/VP/Hybrid.

## Canonical End-to-End Architecture

``` text
User Intent
→ Reference / DNA Retrieval
→ DNA Mixer
→ Editorial Pattern Synthesis
→ Editorial Intent
→ Coverage Sufficiency
→ Shot Architecture
→ Camera / Lens / Movement
→ Lighting / Material
→ SFX / VFX / Sound
→ Equipment Compatibility
→ Execution Router
→ Seedance / Real Shoot / CG / VP
→ Storyboard / Lighting Diagram / Production PDF
→ Media
→ Editorial QA
→ Timeline / Post
→ Pattern Performance Learning
```

## Build order

1.  Stabilize V6 canonical editorial objects.
2.  Implement V7 retrieval/synthesis and CoverageSufficiency.
3.  Implement V8 PatternDNA schema/provenance.
4.  Add manual reference annotation before automated extraction.
5.  Add DNA retrieval and mixer.
6.  Compile V8 DNA into V7 patterns.
7.  Add execution routing.
8.  Add production-book outputs.
9.  Add performance/failure learning.
10. Expand the library only after provenance and quality controls are
    stable.
