/**
 * Regenerates /public/demo/detections.json from the "Normal Production" scenario.
 *   node --experimental-strip-types scripts/generate-detections.mts
 */
import { writeFileSync } from 'node:fs'
import { generateTracks, tracksToTimeline } from '../src/data/demoDetections.ts'
import { SCENARIOS } from '../src/data/scenarios.ts'

const tracks = generateTracks(SCENARIOS.normal, { durationSeconds: 120 })
const timeline = tracksToTimeline(tracks)
writeFileSync(new URL('../public/demo/detections.json', import.meta.url), JSON.stringify(timeline, null, 2))
console.log(`wrote ${timeline.length} keyframes for ${tracks.length} tracks`)
