---
name: game-ai
description: Crowds, traffic and NPC behaviour at city scale — steering, flow fields, graph following, state machines, LOD for simulation. Use when building pedestrians, vehicles, wildlife, or any behaviour that must run for thousands of entities inside a frame budget.
---

# Behaviour at scale

The constraint shapes everything: thousands of entities, a few milliseconds. That rules out
per-agent pathfinding every frame and rules in graphs, flow fields and cheap steering.

## Traffic — follow the graph, not the road

Vehicles are points on a lane graph with a position along an edge, a speed, and a leader.

```js
// gap-keeping: the whole of believable traffic in four lines
const gap = leader ? leader.s - self.s - VEHICLE_LEN : Infinity
const desired = Math.min(self.maxSpeed, Math.sqrt(Math.max(0, 2 * DECEL * (gap - MIN_GAP))))
self.speed += clamp(desired - self.speed, -DECEL * dt, ACCEL * dt)
self.s += self.speed * dt
```

- Route chosen once at spawn (weighted random over the graph, or a real path if it matters).
- Junctions hold a token: a signal cycle, or a reservation the first arrival takes. Cars must
  visibly **stop** — that is what makes a junction legible.
- Lane change only where it is legal, and only as a lateral offset lerp; never simulate it.
- Despawn out of view, respawn at the edge of the active radius. Nobody counts cars.
- Render with an `InstancedMesh` per vehicle type; write matrices from a typed array.

Real numbers — densities, speeds, following distances, signal timings — are in
`docs/workflow/systems.md`.

## Pedestrians — steering on a walkable graph

- Seek along the pavement graph + separation from neighbours + wall avoidance. Three forces,
  clamped, is enough.
- Neighbour queries need a **spatial hash** (a grid of cell → agent list, rebuilt each frame).
  All-pairs separation is O(n²) and it is the thing that will melt the frame.
- Crossings are gated edges: agents queue at the kerb, cross when the signal or the gap allows.
  Queueing is what makes a crowd look like it has rules.
- **Flow fields** beat per-agent paths when many agents share a destination: one vector field per
  district-scale goal, sampled per agent. Cost is per field, not per agent.
- Distribute density by *reason*: entrances, transit, markets, shops. Uniform density is the tell.

## Behaviour

A state machine is almost always enough, and a behaviour tree is worth it only when states start
sharing sub-behaviours:

```
idle → walk-to(goal) → wait-at(crossing) → enter(shop) → (off-screen timer) → leave
```

The interesting behaviour is **reactive**, not deliberative: turn to look at a siren, step aside
for the player, huddle under an awning when it rains, cluster at a stall. Each is a few lines and
each is worth more than a planner.

## Simulation LOD

| ring | rate | detail |
|---|---|---|
| < 50 m | every frame | full steering, animation, collision |
| 50–200 m | 4–10 Hz | steering, cheap animation |
| 200–600 m | 1 Hz | position advanced along the graph, no steering |
| beyond | none | statistical: spawn on approach at plausible density |

Advance sleeping agents by dead reckoning so they are in a sensible place when they wake. A crowd
that teleports when you turn around is worse than no crowd.

## Wildlife, and the rest of the living world

Gulls at the harbour, pigeons in the square, rats at night, a cat on a wall, a dog with an owner.
These are boids or scripted loops — near-free, and they do a disproportionate amount of the work
of making a place feel alive, because they move when nothing else does.

## How to check it

- `play` the game and watch. Does traffic stop? Do people wait? Does anybody walk through a wall?
- Photograph a junction over a signal cycle.
- Count identical agents in one frame. Two of the same person is worse than ten fewer people.
- Profile the update: agents × the cost of one is a number you should know, not discover.
