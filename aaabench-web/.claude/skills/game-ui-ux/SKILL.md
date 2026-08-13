---
name: game-ui-ux
description: Title screens, HUD, full-screen map, menus and settings for a browser game — DOM overlay vs in-canvas, layout, readability, input. Use when building any screen the player sees that is not the world itself.
---

# The game's own screens

The demand is explicit: it has to *open like a game*, not like a level with text over it. A world
with no screens is a diorama.

## DOM overlay, not canvas UI

In a browser, HTML/CSS over the canvas is the right choice for almost all UI: text renders
properly at every size, layout is free, accessibility works, and it costs no draw calls. Reserve
in-canvas rendering for things that must live in the world (floating markers, damage numbers,
signage) — and even those can be DOM elements positioned by projecting a world point.

```js
const v = worldPos.clone().project(camera)              // NDC
el.style.transform = `translate(-50%,-50%) translate(${(v.x * .5 + .5) * w}px, ${(-v.y * .5 + .5) * h}px)`
el.style.display = v.z > 1 ? 'none' : ''                // behind the camera
```

Keep the overlay in one root element with `pointer-events: none`, and turn pointer events back on
for the things that are actually interactive. Otherwise the canvas stops receiving input and the
game silently becomes unplayable.

## The screens you need

- **Title.** The game's name, a background that is not the level with the HUD hidden — a rendered
  view, a still, a slow camera move. Start / continue / settings. It is also the user gesture that
  unlocks audio.
- **HUD.** As little as possible: what the player needs *right now*. A minimap or compass, an
  objective, contextual prompts. Everything on the HUD is something the world failed to
  communicate; that is sometimes the right trade, but notice it.
- **Map.** Full screen, named districts, streets legible, a player marker with a facing arrow,
  markers for objectives. It must agree with the world — a map that contradicts what you can see
  is worse than no map. Generate it from your own road graph rather than drawing it by hand, and
  it stays correct as the city changes.
- **Pause.** Resume, settings, quit. Actually pauses (the harness has `pause()`; your game needs
  its own).
- **Settings.** Sensitivity, invert Y, volume sliders, quality preset, key rebinding. Each one
  must do something — a settings screen full of decoration is a lie the player will find.

## Readability

- Minimum 16 px equivalent for body text at 1080p; 14 px only for dense secondary data.
- Contrast ratio ≥ 4.5:1 against the *worst* background it will sit over — which in a game is a
  bright sky, so put text on a scrim, a shadow or a panel.
- Safe area: keep everything 5 % in from the edges.
- Do not encode meaning in colour alone; ~4 % of players will not see it.
- Test at 1280×720 as well as 1920×1080 — layouts that only work at one size are common.

## Diegetic where it earns it

Signage, station boards, phone screens, shop displays and street names are UI that lives in the
world. They cost a canvas texture each and they do more for immersion than any HUD element. A city
is covered in words; that is a UI problem as much as an art one.

## Feel

- Every button needs hover, active and disabled states, and a sound.
- Transitions 150–250 ms. Slower feels sluggish; instant feels broken.
- Never block input during a transition — buffer it.
- Keyboard navigation through menus, not just mouse.

## Checks

`node tools/play.mjs --script '[{"shot":"title"},{"click":[640,420]},{"wait":2},{"shot":"after-start"},{"key":"m"},{"shot":"map"},{"key":"Escape"},{"shot":"pause"}]'`

Then read the four images. This is exactly the sequence a stranger performs in their first fifteen
seconds, and if any of it does not work, nothing behind it will ever be seen.
