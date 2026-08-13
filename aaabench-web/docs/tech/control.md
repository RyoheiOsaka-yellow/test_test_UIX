# The control surface

Two ways into the running game, with the same capabilities behind both.

**MCP** (`agentcity`) — a long-lived headless browser attached to the dev server. Page state
survives between calls, exactly like an editor session: something you spawned with `eval_js` is
still there on the next capture. Use it for the loop of build → look → measure → fix.

**The CLI** (`tools/*.mjs`, `tools/refs.py`) — the same things as one-shot commands, each in its
own browser. Use it in scripts, in background jobs, in subagents, and whenever you want a batch of
shots without holding a conversation open.

## MCP tools

| tool | arguments that matter | notes |
|---|---|---|
| `viewport_capture` | `name`, and either `pose` or `from`/`to`/`fov` | returns a **path**, plus the frame verdict and scene numbers. Never returns the image inline — Read the file |
| `viewport_poses` | `add: {name, from, to, fov, note}` | poses are how two shots become comparable |
| `scene_describe` | `tree`, `depth` | counts by type, top-level names, world bounds in metres, running systems |
| `perf_sample` | `seconds`, `pose` | fixed 960×540, so the number means something between runs |
| `console_drain` | — | errors, warnings, logs, failed requests, boot errors; clears as it reads |
| `eval_js` | `code` | runs in the page; `return` for statements, bare expression otherwise |
| `play` | `steps`, `seconds`, `name` | real input on the game camera; reports whether anything moved |
| `reload` | — | throws page state away; the cold-start check |

## The command line

```bash
node tools/viewport.mjs shot harbour --pose street      # one shot
node tools/viewport.mjs shot block-a --from 120,60,-90 --to 0,8,0 --fov 40
node tools/viewport.mjs sweep before-lighting           # every pose, one file each
node tools/viewport.mjs poses
node tools/viewport.mjs diff a.png b.png                # RMSE if ImageMagick is present

node tools/qa.mjs stats | describe | tree --depth 3 | errors
node tools/qa.mjs perf --seconds 8 --pose aerial
node tools/qa.mjs budget                                # exits non-zero when over
node tools/qa.mjs calibrate                             # re-measure the empty-stage baseline
node tools/qa.mjs eval "window.__aaabench.describe().systems"

node tools/play.mjs --seconds 30 --shots 6
node tools/play.mjs --script '[{"key":"w","hold":4},{"click":[800,450]},{"shot":"menu"}]'

python3 tools/refs.py find "cargo terminal"
python3 tools/refs.py grab "fire escape" --n 4
```

Environment: `AAABENCH_PORT` (default 5173), `AAABENCH_URL`, `AAABENCH_CHROMIUM`,
`AAABENCH_QA_DIR` (default `/tmp/aaabench_qa`), `AAABENCH_REFS_DIR` (`/tmp/aaabench_refs`).

## What each tool is defending against

Knowing this makes the output readable:

- **Images as paths, never inline.** A 1600×900 PNG is over a megabyte of base64. At the rate this
  work needs to look at things, inlining would spend the context on transport instead of thinking.
- **The flat-frame check.** Every capture samples the frame and says so: `FLAT — one colour`
  means nothing is being drawn, or the camera is inside geometry, or the material never compiled.
  A screenshot tool that silently writes a photograph of a grey void is the single most expensive
  failure in this loop, because the filename looks the same either way.
- **Frame cost relative to a baseline.** There may be no GPU here. An absolute 60 fps target would
  be either unreachable or meaningless, and you would end up optimising the machine, not the world.
- **`play` reports camera delta.** "Input changed NOTHING" is a fact about the build that no
  screenshot shows.
- **A persistent page, cleared only on `reload`.** So that spawning something and then measuring
  it is two calls rather than one impossible one.

## Scripting inside the page

`eval_js` is the equivalent of an editor's scripting console. The scene is reachable from the
harness object, and anything you export yourself is reachable too:

```js
// count what is actually in the north district
const A = window.__aaabench
let n = 0
A.three?.scene?.traverse?.(o => { if (o.name.startsWith('north/')) n++ })
return n
```

Expose your own systems on `window` deliberately (`window.city = {...}`) and this becomes a real
console: spawn a block, measure it, delete it, without a reload and without a code round-trip.

Two habits worth keeping:

- Keep a `describe()` that talks about **your** world — districts, blocks, population, road
  kilometres — not just `Mesh: 40312`. You will read it a hundred times.
- Make destructive experiments undo themselves, or `reload` after them. A page whose state you no
  longer trust makes every subsequent measurement suspect.
