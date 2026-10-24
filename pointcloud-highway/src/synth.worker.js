import { synthesize } from './synth.js';

self.onmessage = (ev) => {
  const { data, options } = ev.data;
  const t0 = performance.now();
  const out = synthesize(data, options, (p) => self.postMessage({ type: 'progress', p }));
  self.postMessage({ type: 'done', ms: performance.now() - t0, ...out }, [out.pos.buffer, out.inten.buffer, out.cls.buffer, out.dev.buffer, out.elem.buffer, out.nrm.buffer]);
};
