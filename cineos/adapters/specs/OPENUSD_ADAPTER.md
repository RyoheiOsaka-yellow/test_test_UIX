# OpenUSD Adapter Specification

## Direction
CineOS domain objects are canonical. USD is an interchange representation.

## Required MVP mappings
- Set / Prop / DigitalTwin → prim hierarchy
- Camera → camera prim
- Camera transform timeline → time-sampled transforms
- Character blocking → animated transforms or references
- Light → light prim where compatible
- Surface → material approximation
- Shot ID → custom metadata
- CineOS equipment metadata → custom namespace

## Custom namespace
Use a stable prefix such as:
`cineos:*`

Examples:
- `cineos:shotId`
- `cineos:equipmentId`
- `cineos:tStop`
- `cineos:fixtureId`
- `cineos:dmxCueId`

## Do not
- make USD prim paths the database identity
- overwrite CineOS IDs during USD import
- assume renderer-specific lighting will match physically without calibration
