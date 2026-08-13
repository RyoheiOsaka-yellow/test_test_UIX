# Working in parallel

A city does not fit in one context. Subagents are how it gets built; file conflicts are how a
parallel run gets destroyed.

## Lanes that do not collide

Split by **files owned**, not by topic:

| lane | owns | never touches |
|---|---|---|
| geography | terrain, water, the road graph | anything downstream of the graph |
| blockout | block footprints, massing | façade code, materials |
| district N dressing | `src/world/districts/N/*` | any other district |
| traffic | `src/systems/traffic/*` and the road graph read-only | the graph itself |
| crowds | `src/systems/crowd/*` | traffic |
| screens & UI | `src/game/ui/*` | world code |
| audio | `src/systems/audio/*` | everything |
| writing | `docs/design/*`, mission data | code |
| assets | `public/assets/*`, the manifest | code that consumes it |

Two lanes may read the same file. Only one may write it. Write that ownership down where every
lane can see it, because "I assumed nobody else was in there" is the failure that costs a day.

## The barriers

Some things genuinely have to wait:

- **The road graph before traffic.** A traffic lane started against a graph that is still moving
  rebuilds itself twice.
- **Blockout before dressing.** Dressing a block whose footprint changes is work thrown away.
- **The asset manifest before consumers.** Two lanes independently deciding what a texture is
  called is a merge conflict with no correct resolution.
- **A shared standard before parallel quality work.** If two lanes disagree about what "finished"
  means, you get two districts that look like they came from different games — which, note, is
  also a specific failure the demand names.

## What to hand a lane

Not "dress the harbour district". A lane needs:

1. The district brief — what this place is, who is there, why it looks how it looks.
2. The standard — the tells, the density targets, the budget it must hold.
3. Its files, explicitly.
4. What to do when it finishes: what to measure, what to photograph, what to write down.
5. The rule that it may not go and change shared code to make its own work easier.

A lane that comes back with "done" and no captures has not finished; it has stopped.

## Merging

- Commit per lane, small, often.
- Merge on a cadence you control, not when a lane happens to finish.
- After every merge: `node tools/qa.mjs budget` and a pose sweep. Two lanes that each held the
  budget can break it together, and that is invisible until somebody looks.
- Generated files (heightmaps, baked geometry, atlases) do not merge. One owner, or regenerate
  after the merge from inputs that do merge.

## The failure to watch for

Parallel work multiplies output and divides coherence. The counter is the shared standard and one
place — you — that reads every lane's captures side by side and says "these are not the same
city". Nobody else is going to.
