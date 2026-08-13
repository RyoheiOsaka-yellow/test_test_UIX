// Where the game is, once there is one.
//
// Deliberately empty. There is no title screen, no HUD, no map, no pause menu, no controller,
// no save. A world you can only look at through the inspection camera is a diorama; the demand
// asks for something that opens like a game and is played like one.
//
// Whatever you mount here should be yours end to end — screens, input, camera rig, the shape
// of a session. Push anything that needs a tick onto ctx.systems:
//
//   ctx.systems.push({ name: 'traffic', update(dt) { … } })

export function mountGame(ctx) {}
