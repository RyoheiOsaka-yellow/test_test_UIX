# CineOS Claude Code Package

This package is the implementation handoff for the Virtual Film Production & Cinematography OS.

Start Claude Code in this directory and tell it to read `CLAUDE.md`.

## Key files
- `CLAUDE.md`: development constitution / instructions
- `knowledge/MASTER_CINEMATOGRAPHY_OS_V4.md`: full master knowledge
- `data/equipment_master.json`: equipment seed database
- `data/technique_rules.json`: executable reasoning rules
- `data/shot_recipes.json`: recipe seeds
- `schemas/`: canonical validation schemas
- `examples/`: example project JSON
- `docs/IMPLEMENTATION_ROADMAP.md`: development order
- `src_reference/`: prior source documents

The equipment database is intentionally capability-first and seeded rather than pretending to be a final exhaustive worldwide inventory. Extend it with official manufacturer/rental data while preserving provenance.


## V2 additions

- Screenplay → beats → coverage solver specification
- Blocking and lighting-zone model
- Lens metadata timeline and distortion/vignetting profiles
- Photometric lighting solver
- Practical FX visual-state engine
- Motion-control/Techvis feasibility model
- Virtual Production live-metadata model


## V3 — Film Production Digital Twin

V3 adds:

- canonical production graph and stable Shot identity
- OpenUSD scene interchange design
- Digital Twin assets
- ACES 2 / AMF / CLF color-pipeline adapter design
- OpenTimelineIO editorial interchange
- Production Sound planner
- Continuity state + future visual QA
- AI generation QA / regeneration loop
- Inverse Cinematography architecture
- Causal Cinematography Graph
- Production Design material reasoning
- SMPTE ST 2110 live-IP metadata model
- planned-vs-actual capture tracking

Start Claude Code with:

`Read CLAUDE.md and implement the V3 Canonical Production Identity + Graph milestone first.`
