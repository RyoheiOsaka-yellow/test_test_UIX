# Handbook index

Read `../PROMPT.md` (the demand) first. Everything here is reference — load what you need, when
you need it. None of it is a task list, and none of it tells you what your city should be.

## tech/ — driving the game without a GUI
- [control.md](tech/control.md) — the MCP control surface and the command-line tools, what each
  one is for, and the failure modes each one is built to catch
- [feedback.md](tech/feedback.md) — how to SEE it: poses, sweeps, the flat-frame check, reading
  your own screenshots honestly, before/after comparison, play sessions
- [capabilities.md](tech/capabilities.md) — everything on this machine: the browser and what it
  can rasterise, three.js and what ships with it, node, python, image tooling, network reach

## workflow/ — how this is actually built
- [phases.md](workflow/phases.md) — the production phases and their exit gates
- [level-pipeline.md](workflow/level-pipeline.md) — blockout → set dress → lighting → polish, and
  what "done" means at each stage
- [metrics.md](workflow/metrics.md) — real-world dimensions: road widths, storey heights, kerbs,
  parking bays, block sizes, plus the frame budget and where it goes
- [systems.md](workflow/systems.md) — traffic, crowds, day/night, weather, economy, wanted level:
  real parameters, not "add AI"
- [detail-density.md](workflow/detail-density.md) — how "thousands of unique things" is really
  done: combinatorial variation, per-block density targets, the eye-height pass
- [world-inventory.md](workflow/world-inventory.md) — the catalogue: hundreds of KINDS of thing a
  real map contains, and how to place them so they read as systems rather than scatter
- [parallel.md](workflow/parallel.md) — subagent lanes, what they may not share, and the barriers

## sources/ — getting assets in
- [open-sources.md](sources/open-sources.md) — login-free sources for models, textures, HDRIs,
  sound, fonts and map data, with the licences named
- [importing.md](sources/importing.md) — glTF, textures, KTX2/Draco, audio, and the size traps
