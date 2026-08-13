---
name: save-systems
description: Persisting game state in the browser — what to save, schema versioning, migration, autosave and corruption. Use when adding saves, when a save breaks after a change, or when deciding what world state is authoritative.
---

# Saves

The demand asks for one thing: the world survives a reload with the player where they left it.
Everything below is how that stays true after three weeks of changes.

## What to save

Save **decisions**, not derived state:

| save | do not save |
|---|---|
| player position, rotation, health, inventory | the scene graph |
| flags, counters, mission progress | NPC positions (respawn them plausibly) |
| time of day, weather state and its timer | particle systems, animation state |
| world deltas: doors opened, things destroyed, purchases | anything a generator can reproduce from a seed |
| the generation seed(s) | the generated city |

A save that contains the world is a save that breaks every time the world changes. A save that
contains the seed plus the deltas keeps working, and it is three orders of magnitude smaller.

## Where

- `localStorage` — ~5 MB, synchronous, fine for a JSON save of a few hundred KB. Simplest thing
  that works.
- `IndexedDB` — for anything larger or binary (a heightmap edit, a screenshot thumbnail per slot).
  Asynchronous; wrap it once and forget it.
- Never save on every frame. Debounce, or save on events plus a timer.

## Versioning, from the first save

```js
const SAVE_VERSION = 4

function migrate(save) {
  if (save.v === undefined) save.v = 1
  if (save.v < 2) { save.flags = Object.keys(save.flags || {}); save.v = 2 }
  if (save.v < 3) { save.weather = { state: 'clear', t: 0 }; save.v = 3 }
  if (save.v < 4) { save.player.rot = save.player.yaw ?? 0; delete save.player.yaw; save.v = 4 }
  return save
}
```

Write the version field before you need it. A save format without one cannot be migrated, only
discarded — and discarding is what turns "I changed the flag store" into "every save is gone".

## Autosave and slots

- Autosave on meaningful boundaries: mission complete, district entered, every 2–5 minutes of play.
- Keep at least two autosave slots and alternate. An autosave that overwrites the only copy is a
  bug-amplifier: one bad state and there is nothing to go back to.
- Write to a temporary key, verify it parses, then swap. A save interrupted halfway is otherwise
  an unparseable string in the only slot.

## Corruption and absence

Every load path needs three branches: no save, a save that fails to parse, and a save from a
version you cannot migrate. All three end at "start a new game and say so" — never at a white
screen and never at a thrown exception during boot, which the sensors will report as a build that
does not render.

```js
try { state = migrate(JSON.parse(raw)) }
catch (e) { console.warn('save unreadable, starting fresh:', e.message); state = fresh() }
```

## Determinism

If the city comes from a generator, the save's seed must reproduce it exactly. That means the
generator uses a seeded RNG throughout, in a fixed order, with no dependence on iteration order of
a `Set`, `Object.keys`, timing, or floating-point accumulation across a variable frame rate. Test
it: generate twice from one seed and compare a hash of the parcel list. This is also the property
that makes a bug reproducible at all.
