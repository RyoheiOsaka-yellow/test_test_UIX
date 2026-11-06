#!/usr/bin/env node
// Write docs/CATALOG.md: every species with its names, where it lives, and what it does.
import { join } from "node:path";
import { ROOT, species, categories, save } from "./lib/sealib.mjs";

const lines = ["# Catalog / 図鑑", "", `${Object.keys(species).length} species, every one a small piece of code in \`src/species/<category>/<name>.js\`.`, "",
  "| | 和名 | Name | Scientific name | Region | Size |", "|---|---|---|---|---|---|"];
for (const c of categories) {
  const ids = Object.keys(species).filter((id) => id.startsWith(c.id + "/"));
  lines.push(`| **${c.ja} ${c.name}** | | | | | |`);
  for (const id of ids) {
    const m = species[id].meta;
    lines.push(`| ![](previews/${id.replace("/", "-")}.gif) | ${m.ja} | ${m.name} (\`${id}\`) | *${m.sci}* | ${m.region} | ${m.length} |`);
  }
}
lines.push("");
for (const c of categories) {
  lines.push(`## ${c.ja} ${c.name}`, "", c.blurb, "");
  for (const id of Object.keys(species).filter((id) => id.startsWith(c.id + "/"))) {
    const m = species[id].meta;
    lines.push(`### ${m.ja} — ${m.name}`, "", `*${m.sci}* · ${m.region} · ${m.length} · \`${id}\` · ${m.size[0]}×${m.size[1]} px, ${m.duration} s loop at ${m.fps} fps`, "", m.jadesc, "", m.desc, "", `tags: ${m.tags.join(", ")}`, "");
  }
}
save(join(ROOT, "docs", "CATALOG.md"), lines.join("\n"));
console.log("docs/CATALOG.md written");
