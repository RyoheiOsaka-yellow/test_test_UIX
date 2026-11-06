#!/usr/bin/env node
// Small GIF previews of every species for the catalog: docs/previews/<category>-<name>.gif
import { join } from "node:path";
import { ROOT, resolveIds, renderFrames, gif, save, species } from "./lib/sealib.mjs";

const ids = resolveIds(process.argv.slice(2).length ? process.argv.slice(2) : ["all"]);
for (const id of ids) {
  const m = species[id].meta, r = renderFrames(id, { bg: m.bg, fps: 15 });
  const file = save(join(ROOT, "docs", "previews", `${id.replace("/", "-")}.gif`), gif(r, 2));
  console.log(`${id} -> ${file.replace(ROOT + "/", "")}`);
}
