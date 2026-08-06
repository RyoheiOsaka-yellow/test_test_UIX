/**
 * Reproducible micro-benchmarks for the mathcat kernel.
 *
 * Run with: node bench/bench.ts
 *
 * Each case runs in a hot loop over pre-allocated arrays — the intended
 * usage pattern — and reports ops/sec plus the heap growth observed across
 * the measured window, which should stay near zero because no operation
 * allocates.
 */
import * as mat4 from '../src/mat4.ts';
import * as quat from '../src/quat.ts';
import * as vec3 from '../src/vec3.ts';

const ITERATIONS = 2_000_000;

const a = new Float32Array([1, 2, 3]);
const b = new Float32Array([4, 5, 6]);
const v = new Float32Array(3);
const q = new Float32Array(4);
quat.fromEuler(q, 0.3, 0.5, 0.7);
const ma = new Float32Array(16);
const mb = new Float32Array(16);
const mo = new Float32Array(16);
mat4.compose(ma, a, q, [1, 1, 1]);
mat4.compose(mb, b, q, [2, 2, 2]);

type Case = { name: string; run: () => void };

const cases: Case[] = [
  { name: 'vec3.add', run: () => vec3.add(v, a, b) },
  { name: 'vec3.cross', run: () => vec3.cross(v, a, b) },
  { name: 'vec3.normalize', run: () => vec3.normalize(v, a) },
  { name: 'vec3.transformQuat', run: () => vec3.transformQuat(v, a, q) },
  { name: 'vec3.transformMat4', run: () => vec3.transformMat4(v, a, ma) },
  { name: 'quat.multiply', run: () => quat.multiply(q, q, q) },
  { name: 'quat.slerp', run: () => quat.slerp(q, q, q, 0.5) },
  { name: 'mat4.multiply', run: () => mat4.multiply(mo, ma, mb) },
  { name: 'mat4.invert', run: () => mat4.invert(mo, ma) },
];

const bench = ({ name, run }: Case): void => {
  // Warm up so the JIT settles on optimized, monomorphic code first.
  for (let i = 0; i < 100_000; i++) run();

  if (globalThis.gc) globalThis.gc();
  const heapBefore = process.memoryUsage().heapUsed;
  const start = process.hrtime.bigint();
  for (let i = 0; i < ITERATIONS; i++) run();
  const elapsedNs = Number(process.hrtime.bigint() - start);
  const heapGrowth = process.memoryUsage().heapUsed - heapBefore;

  const opsPerSec = (ITERATIONS / elapsedNs) * 1e9;
  const heapNote = `${(heapGrowth / 1024).toFixed(1)} KiB heap growth`;
  console.log(
    `${name.padEnd(22)} ${Math.round(opsPerSec).toLocaleString('en-US').padStart(15)} ops/s   ${heapNote}`,
  );
};

console.log(`mathcat benchmarks — ${ITERATIONS.toLocaleString('en-US')} iterations per case\n`);
for (const c of cases) bench(c);
