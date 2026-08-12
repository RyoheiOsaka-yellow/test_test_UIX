# Logo Design Intelligence — v15 prototype

An interactive, single-file prototype of the pipeline described in the build pack:

```
Meaning → Genome → Construction → Search → Perception → Similarity → Human Edit → Re-test → Export
```

Open `index.html` in any browser. No build step, no dependencies, no network calls.

## What it actually does

This is not a mockup with placeholder images. The marks on screen are generated at runtime
from structured data:

| Stage | Implemented behaviour |
| --- | --- |
| Meaning | Free-text brief compiled once into a 5-axis meaning vector, then never read again |
| Genome | 4 territories selected by vector distance; 16 grammars each = 64 parameter windows |
| Construction | Each genome builds a `ConstructionGraph` of named ops that emits the SVG |
| Search | ~2,000 candidate genomes sampled inside the grammar windows |
| Perception | Validity screen, then 16 px legibility, contrast, economy, balance, distinctiveness |
| Similarity | Weighted distance against a 56-entry construction corpus → clear / review / conflict |
| Human Edit | Every genome parameter exposed as a control; each change logged with its prior value |
| Re-test | Scores recompute live and show the delta against the search-time state |
| Export | Primitives flattened to `<path>` here and only here; genome + provenance ride along |

Everything is deterministic: the brief hashes to a seed, so the same brief reproduces the
same 2,000 candidates and the same 24 representatives on every run.

## Constraints honoured from `00_START_HERE.md`

- No prompt-to-image path exists in the build — the genome is the source of truth.
- Similarity output is a **design-collision** signal and is labelled as such. No trademark
  or legal clearance claim is made anywhere in the UI or in the exported file.
- Shape psychology is never asserted as fact; territory theses are stated as positions.
- Geometry stays parametric until export, where it is flattened to path data.
- Every edit is reversible individually and carries provenance to the exported SVG.

## Known prototype boundaries

- Wordmark type is live `<text>`; outline conversion is a downstream task and the
  acceptance panel says so rather than claiming it is done.
- Ink coverage is estimated analytically per archetype rather than rasterised.
- The corpus is synthetic — it stands in for the real screening index.
