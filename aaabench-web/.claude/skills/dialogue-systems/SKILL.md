---
name: dialogue-systems
description: Writing and running dialogue — data format, branching, conditions, barks, and what makes game writing good rather than functional. Use when building conversations, mission text, radio, signage copy or NPC barks.
---

# Dialogue

## The data, not the code

Keep dialogue in data files, separate from the runtime. A JSON/YAML node graph is enough; you do
not need Ink or Yarn, though their *shape* is worth copying:

```json
{ "id": "harbourmaster/first",
  "speaker": "Vess",
  "text": "You're the one asking about the Kestrel. Don't.",
  "conditions": { "flags": ["metVess"], "timeOfDay": "night" },
  "choices": [
    { "text": "Why not?", "goto": "harbourmaster/why", "sets": ["askedWhy"] },
    { "text": "(leave)", "goto": null } ] }
```

The runtime is small: resolve conditions, show the node, take a choice, set flags, move on. Put
the complexity in the writing.

A flat flag store (`Set<string>`) plus a few counters handles almost every branch a city needs.
Version it with the save (see `save-systems`), or a mid-run write breaks every save.

## Barks — where most of the words live

Barks are one-liners triggered by context: passing a stall, rain starting, a siren, a player
running past. They are the cheapest dialogue there is and they do most of the work of making a
place inhabited.

Rules that keep them from becoming irritating: a cooldown per line and per speaker; never repeat
the same line inside a few minutes; 6–12 variants per situation; and silence as a valid outcome —
not every trigger fires.

## Writing that is not bad

The demand says the prose is directly readable as quality. What separates good from functional:

- **Characters want something and it costs them something.** A quest-giver with a want, a
  contradiction and a bad habit is a person; one with an objective is a vending machine.
- **Voices differ.** Vocabulary, sentence length, what they will not say. Read two lines with the
  names removed — if you cannot tell who is speaking, they are the same character.
- **Specifics, not adjectives.** "Two seasons on the northern boats, then the ice took the boat"
  beats "a hard life".
- **Subtext.** People rarely say the thing. They talk around it, and the player fills the gap.
- **Brevity.** Barks under 12 words. Conversation nodes under 40. Nobody reads the third
  paragraph.
- **The city speaks too.** Signage, notices, graffiti, menus, radio, ads. Hundreds of words of
  world-building that need no UI at all — and the place where inventing brands, prices and slang
  pays off.

## Presentation

- Text speed 30–50 characters/second, always skippable, never blocking input.
- Show the speaker's name and keep the camera on something worth looking at.
- Subtitles for spoken lines, on by default.
- If there are choices, make them differ in *intent*, not tone. Three ways of saying yes is not a
  choice.
- Barks belong in the world (above the head, or purely audio), not in a dialogue box.

## Missions

Anatomy that works: a reason (who wants this, why now), a place (specific, worth visiting), a
complication (the plan does not survive), and a consequence (something in the world changes).
Four beats. A mission that is "go here, press E" has one, and the player feels the missing three.

Write the mission's location into the city, not on top of it: the lock-up behind the fish market,
the flat above the pawnbroker. Missions sited in real places are what make the city feel like it
was built first — which, if you followed the phases, it was.
