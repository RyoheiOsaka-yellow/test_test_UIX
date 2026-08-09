# CineOS V3 Implementation Roadmap

## Milestone 0 — Canonical identity and graph
Implement first.

Deliver:
- stable IDs
- graph entity registry
- relationship edges
- immutable identity / mutable versions
- provenance

Acceptance:
A Shot can be referenced identically by USD, OTIO, AI run, continuity, color and media records.

## Milestone 1 — Digital Twin / USD export
Deliver:
- digital twin schema
- set / prop / camera / light export
- transforms and time samples
- custom CineOS metadata

## Milestone 2 — Editorial and Color
Deliver:
- OTIO export/import
- ColorPipeline domain model
- AMF/CLF adapter interfaces

## Milestone 3 — Sound planner
Deliver:
- sound plan
- equipment noise metadata
- boom-safe zone
- ADR risk heuristic

## Milestone 4 — Continuity
Deliver:
- continuity state store
- shot/take comparison API
- manual continuity UI
- visual-QA interface stub

## Milestone 5 — AI QA loop
Deliver:
- generation-run store
- scoring profiles
- diagnostics
- regeneration recommendations
- version tree

## Milestone 6 — Causal cinematography
Deliver:
- causal graph store
- what-if query
- side-effect explanations
- confidence / provenance

## Milestone 7 — Inverse cinematography
Deliver:
- inference result schema
- multiple hypotheses
- confidence ranges
- virtual setup reconstruction interface

## Milestone 8 — Live / ST 2110 metadata
Deliver data model and documentation adapter first.
Do not attempt full broadcast routing inside CineOS.

## Testing principles
- no adapter may mutate canonical identity
- every inferred value has confidence
- every measured value has provenance
- creative heuristic is labeled
- hazardous SFX construction is excluded
