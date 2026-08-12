/* ============================================================
   LORE — codex, sample types, mission definitions

   Twelve codex entries, most of them sealed until you have been
   somewhere or drilled something. Five missions and an ending.
   ============================================================ */

export const CODEX = [
  {
    id: 'dossier', tag: 'DOSSIER', title: 'OPERATION ANAXAGORAS',
    meta: 'SELENE DIRECTORATE · CLEARANCE COBALT', start: true,
    body: [
      `Beacon-9 stands on the floor of Anaxagoras at 73.4° north, nine degrees west of the meridian. Far enough toward the limb that Earth never clears more than a hand's width of the rim wall, and the sun never gets above nineteen degrees. Shadows here do not shorten at midday. They only turn.`,
      `The station reported nominal for six hundred and eleven days. On the six hundred and twelfth it sent one unscheduled burst — four seconds of carrier, no payload — and then nothing at all. That was two hundred and fourteen days ago.`,
      `You operate MU-7 CASSIOPEIA, put down by descent sled on a clear patch of floor east of the station. Survey the basin. Sample it. Restore the relay chain so we can hear you. Determine why Beacon-9 stopped talking.`,
      `You will notice that this dossier does not say what Beacon-9 was for.`
    ]
  },
  {
    id: 'regolith', tag: 'PRIMER', title: 'THE FLOOR OF THE BASIN',
    meta: 'SURVEY PRIMER · REV 12', start: true,
    body: [
      `Regolith is not sand. It is rock that has been shattered, welded by micrometeorite glass, shattered again, and salted with meteoritic iron for four billion years, with no water and no wind to round a single grain. Every particle is a splinter. It packs to roughly forty per cent void, it holds a bootprint indefinitely, and it will find its way through a bearing seal inside one season.`,
      `Bearing strength in the top few centimetres runs about twelve kilopascals. Your contact pressure at rest gives you one to two centimetres of sink and about six per cent of your weight back as rolling resistance, which is close to what Apollo measured with a heavier vehicle and softer tyres.`,
      `Drive gently. At one sixth of a gravity you have one sixth of the grip, and a grade you would not notice on Earth will put you on your roof.`
    ]
  },
  {
    id: 'light', tag: 'PRIMER', title: 'WHY NOTHING LOOKS FAR AWAY',
    meta: 'OPTICS NOTE · FOR OPERATORS', start: true,
    body: [
      `You will misjudge every distance out there for the first hour, and the reason is that there is no air to do the work your eye expects.`,
      `On Earth a ridge ten kilometres off is paler and bluer than one at two. That gradient is the only depth cue you have at range, and here it does not exist: the rim wall is exactly as contrasty at three kilometres as the rock beside your wheel. A boulder the size of a bus and a pebble beside the lens are the same shade of grey.`,
      `The surface is not Lambertian either. It scatters back toward the source, so driving down-sun washes the ground out and hides every slope in front of you, and driving up-sun paints every crater in hard relief. Plan your traverses accordingly. The shadow of your own mast is the most reliable rangefinder you have.`
    ]
  },
  {
    id: 'first-return', tag: 'FIELD NOTE', title: 'THE FIRST RETURN',
    meta: 'GPR · SUBSURFACE ECHO 001',
    body: [
      `The radar came back wrong on the first sweep of the mission, which is not how these things usually go.`,
      `A buried boulder gives you one hard hyperbola. Ice gives a broad low-velocity smear. What came back from a little over four metres under the basin floor was neither: a repeating hexagonal return, coherent across sixty metres, with voids inside it.`,
      `Nothing in regolith forms hexagonal voids. Cooling basalt does something like it on Earth and this is neither columnar nor basalt. The dielectric constant reads like glass.`,
      `Recommend excavation.`
    ]
  },
  {
    id: 'lattice', tag: 'ANALYSIS', title: 'THE VITRIFIED LATTICE',
    meta: 'SAMPLE 007 · MASS SPEC AND THIN SECTION',
    body: [
      `The core is a hollow tube of lunar glass. Outer diameter forty-one millimetres, wall three, interior smooth and completely unweathered.`,
      `It is a fulgurite — the scar left when a very large current passes through loose silicate and fuses a pipe along its own path. On Earth you find them wherever lightning strikes a beach.`,
      `There is no lightning here. There is no atmosphere to hold a charge column together.`,
      `The chemistry is entirely local: the glass is made of the regolith it sits in, so nothing arrived from outside. Only the current did.`
    ]
  },
  {
    id: 'terminator', tag: 'ANALYSIS', title: 'A KILOVOLT ACROSS FOUR METRES',
    meta: 'ELECTROSTATICS · UNCIRCULATED',
    body: [
      `The dayside charges positive as ultraviolet knocks photoelectrons off it. The nightside charges negative under the solar wind. Between them, at the terminator, the potential difference across a few metres of ground can exceed a kilovolt, and the finest fraction of the dust lifts off the surface and stays up.`,
      `Apollo photographed the horizon glow from lunar orbit and the argument about it is not settled.`,
      `That mechanism moves grains. It does not fuse forty metres of pipe.`,
      `Whatever wrote the lattice under this basin was four orders of magnitude past anything the terminator can do, and it did it more than once — the returns are stacked, and the deeper ones are older.`
    ]
  },
  {
    id: 'relays', tag: 'ENGINEERING', title: 'WHY THE RELAYS EXIST',
    meta: 'COMMS PLAN · REV 4',
    body: [
      `Earth sits between thirteen and sixteen degrees above the horizon here and never leaves that band. From the floor of the basin the rim wall is in the way, which means that from where you are standing there is no Earth and there is no link.`,
      `The chain solves it by height, not by power. Three masts on the high ground, each in line of sight of the next and the last one able to see over the crest. Deploy them in order. The moment the third one comes up you have a path home.`,
      `Beacon-9 had the same chain and it worked for six hundred days. You will find the masts still standing. What you will not find is the station's own high-gain, which is on the ground eight metres from where it was bolted.`
    ]
  },
  {
    id: 'beacon9', tag: 'SITE REPORT', title: 'BEACON-9',
    meta: 'ARRIVAL · EXTERIOR SURVEY',
    body: [
      `Two habitat cylinders on a shielding berm, a connecting tunnel, an airlock on the west face, and a solar farm that has been quietly making power for two hundred and fourteen days with nobody drawing any of it.`,
      `There is no impact damage. Nothing is scorched. The dust on the panels is the ordinary slow fall of a place where nothing happens.`,
      `The high-gain mast is down. It is not bent and it has not corroded — the bolts are backed out, all eight of them, evenly, the way a person does it and the way an accident never does.`,
      `Somebody took the antenna down from the outside, carefully, and then walked away.`
    ]
  },
  {
    id: 'shaft', tag: 'SITE REPORT', title: 'THE SHAFT',
    meta: 'GRID REFERENCE WITHHELD',
    body: [
      `Ninety metres north-west of the station there is a hole in the floor of the basin that is not a crater.`,
      `It is four metres across and it is round to within a few centimetres. The wall is glass — the same glass as the core sample, the same local chemistry, the same unweathered interior. It goes down past the range of the radar.`,
      `There is a cable in it. Ordinary station cable, spooled off a drum somebody dragged out here, running over the lip and down into the dark, and the drum is empty.`,
      `They did not find this and report it. They found it and went down.`
    ]
  },
  {
    id: 'carrier', tag: 'TRANSCRIPT', title: 'FOUR SECONDS OF CARRIER',
    meta: 'BURST 612-01 · REPROCESSED',
    body: [
      `Reprocessed at the highest gain the relay chain will support, the burst is not empty.`,
      `There is a payload. It is four seconds of the station's own uplink oscillator being pulled off frequency and let go, twice, in a pattern that is not in any of our codes and is not noise. Analysis calls it a mechanical modulation: something physically moving the cavity.`,
      `The station's transmitter was in the equipment cylinder. The equipment cylinder is sealed and the dust on its hatch has not been disturbed since before the burst.`,
      `Nothing inside that room moved. Something outside it did.`
    ]
  },
  {
    id: 'directive', tag: 'DOSSIER', title: 'WHAT THE DOSSIER DID NOT SAY',
    meta: 'CLEARANCE COBALT · APPENDED ON ARRIVAL',
    body: [
      `Beacon-9 was not a survey station. It was a listening post, and it was not listening to Earth.`,
      `The lattice was mapped from orbit eleven years ago. The station was put on top of it to find out how deep it went and whether it was still being written. The crew of four were told what you were told.`,
      `On day six hundred and eleven the return from the deep array changed. On day six hundred and twelve they took the high-gain down — deliberately, from the outside, so that nothing could be sent — and went down the shaft.`,
      `You are not here to find out what happened to them. You are here to find out whether it is still happening.`
    ]
  },
  {
    id: 'silence', tag: 'CLOSING', title: 'THE SILENCE AT ANAXAGORAS',
    meta: 'END OF TRAVERSE',
    body: [
      `The relay chain is up. The link is good. Everything you have gathered is on its way to a receiver on a planet you can see from the rim and not from the floor.`,
      `The lattice is not a formation. It is a record of something that has been passing current through the crust of this basin at intervals for a very long time, and the intervals are getting shorter.`,
      `The last thing the rover's radar recorded, forty minutes before the link came up, was a new return. Four metres down, hexagonal, coherent, and warm.`,
      `It was not there on the first sweep.`
    ]
  }
];

/* Nine sample types. What you get depends on where you drill and how
   deep the field says the interesting layer is. */
export const SAMPLES = [
  { id: 'mare', name: 'MARE BASALT', tag: 'M', hint: 'Common floor material.' },
  { id: 'breccia', name: 'IMPACT BRECCIA', tag: 'B', hint: 'Welded fragments, near crater rims.' },
  { id: 'agglutinate', name: 'AGGLUTINATE', tag: 'A', hint: 'Micrometeorite-welded soil.' },
  { id: 'anorthosite', name: 'ANORTHOSITE', tag: 'N', hint: 'Highland float from the rim wall.' },
  { id: 'glass', name: 'IMPACT GLASS', tag: 'G', hint: 'Spherules in fresh ejecta.' },
  { id: 'ilmenite', name: 'ILMENITE SAND', tag: 'I', hint: 'Titanium-rich, magnetically sorted.' },
  { id: 'volatile', name: 'VOLATILE ICE', tag: 'V', hint: 'Only in permanent shadow.' },
  { id: 'lattice', name: 'VITRIFIED LATTICE', tag: 'L', hint: 'The thing under the floor.', key: true },
  { id: 'cable', name: 'STATION CABLE', tag: 'C', hint: 'Recovered at the shaft.', key: true }
];

/* Five missions and an ending. Each one unlocks codex entries when it
   completes; a few unlock earlier, on the event itself. */
export function buildMissions(layout) {
  return [
    {
      id: 'shakedown',
      title: 'SHAKEDOWN',
      detail: 'Drive 150 m from the sled and run one ground-penetrating radar sweep.',
      goal: { drive: 150, radar: 1 },
      unlock: ['first-return'],
      done: 'SURVEY PACKAGE NOMINAL'
    },
    {
      id: 'core',
      title: 'CORE SAMPLE',
      detail: 'Take three cores, including one over the lattice return north-west of the sled.',
      goal: { samples: 3, sampleAt: { pos: layout.lattice, radius: 34, id: 'lattice' } },
      unlock: ['lattice', 'terminator'],
      done: 'SAMPLE 007 LOGGED'
    },
    {
      id: 'relay',
      title: 'RESTORE THE CHAIN',
      detail: 'Raise all three relay masts. Drive to each and hold E.',
      goal: { relays: 3 },
      unlock: ['relays'],
      done: 'LINK MARGIN 4.1 dB'
    },
    {
      id: 'station',
      title: 'BEACON-9',
      detail: 'Reach the station and survey the exterior.',
      goal: { visit: { pos: layout.station, radius: 22 } },
      unlock: ['beacon9', 'carrier'],
      done: 'EXTERIOR SURVEY COMPLETE'
    },
    {
      id: 'shaft',
      title: 'THE SHAFT',
      detail: 'Something is drawing cable into the ground north-west of the station.',
      goal: { visit: { pos: layout.shaft, radius: 16 }, radarAt: { pos: layout.shaft, radius: 60 } },
      unlock: ['shaft', 'directive', 'silence'],
      done: 'TRANSMITTING',
      final: true
    }
  ];
}
