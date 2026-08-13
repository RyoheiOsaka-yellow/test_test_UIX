---
name: input-systems
description: Keyboard, mouse, pointer lock, gamepad and touch in the browser, plus rebinding, buffering and accessibility. Use when wiring the player controller, when input feels unresponsive, or when the play tool reports that input changed nothing.
---

# Input

## The layer, not the listener

Do not read `keydown` in the movement code. Build one input layer that maps physical inputs to
**actions**, and let everything read actions:

```js
const bindings = { moveForward: ['KeyW', 'ArrowUp'], jump: ['Space'], map: ['KeyM'], interact: ['KeyE'] }
input.isDown('moveForward'); input.pressed('jump'); input.axis('look')
```

This is what makes rebinding, gamepads, replay, and scripted play sessions possible at all. It
also makes the difference between "held" and "pressed this frame" explicit, which is the source of
half of all input bugs.

Use `event.code`, not `event.key`: `code` is the physical key, so WASD still works on AZERTY, and
it does not change with modifiers.

## Buffering and forgiveness

- Buffer presses for 100–150 ms so an action pressed slightly early still fires.
- Coyote time 80–120 ms after leaving ground.
- Consume a buffered press when it fires, or it fires twice.

## Pointer lock

```js
canvas.addEventListener('click', () => canvas.requestPointerLock())
document.addEventListener('pointerlockchange', () => { locked = document.pointerLockElement === canvas })
document.addEventListener('mousemove', e => { if (locked) look(e.movementX, e.movementY) })
```

- Only requestable from a user gesture, and `Escape` always releases it — design for the release
  (pause, do not keep walking).
- `movementX/Y` is unbounded and varies wildly between systems; multiply by a sensitivity the
  player can set, and clamp per-frame deltas so a spike does not spin the camera.
- Never apply mouse input scaled by `dt`. Mouse deltas are already per-event; scaling them by
  frame time makes sensitivity change with frame rate.

## Gamepad

Polled, not evented:

```js
const gp = navigator.getGamepads()[0]
if (gp) { move.set(dead(gp.axes[0]), dead(gp.axes[1])); if (gp.buttons[0].pressed) jump() }
```

Dead zone 0.15–0.25, radial rather than per-axis. Stick input is analogue — respect the magnitude
for walk vs run instead of thresholding it.

## Accessibility, briefly and non-optionally

- Rebindable keys, including for one-handed layouts.
- Hold-to-X alternatives for mash-to-X, and toggles for holds (sprint, aim, crouch).
- Sensitivity and invert Y on both axes, separately for stick and mouse.
- Camera-shake and motion-blur off switches. Some players cannot play without them.
- Subtitles for anything spoken, and captions for anything meaningful that is heard and not seen.
- Do not rely on colour alone for state.

## Focus and the browser

- Clear all held keys on `blur`, or the player returns to a game running forward into a wall.
- `preventDefault` on the keys you use — space scrolls, arrows scroll, `/` opens quick-find.
- The first audio needs a user gesture. The title screen is that gesture.
- Prevent the context menu on right-click if right-click is a game input.

## The check that matters

`node tools/play.mjs` synthesises real key and mouse events and reports the camera delta. If it
says `input changed NOTHING` after holding W for four seconds, the input layer is not connected —
and that is a fact about the build, not about the tool.
