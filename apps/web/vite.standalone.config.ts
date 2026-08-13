import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

/**
 * Builds the standalone viewer as one self-contained HTML file: no server, no
 * external requests, everything (three.js, React, the hydrostatics engines and
 * the vessel model) inlined.
 */
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  build: {
    outDir: 'dist-standalone',
    rollupOptions: { input: 'standalone.html' },
    assetsInlineLimit: 100_000_000,
    cssCodeSplit: false,
    reportCompressedSize: false,
  },
});
