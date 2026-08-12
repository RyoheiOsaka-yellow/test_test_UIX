import { defineConfig } from 'vite';

/**
 * `npm run build`  — a normal Vite build into dist/, served over http.
 *
 * `npm run build:single` sets SINGLE_FILE, which switches the bundle to a
 * classic IIFE so that scripts/inline.mjs can fold it into one HTML file that
 * opens straight off the filesystem. A `<script type="module">` cannot: Chrome
 * treats file:// as an opaque origin and refuses to load module scripts from it.
 */
const single = process.env.SINGLE_FILE === '1';

export default defineConfig({
  base: './',
  server: { host: '127.0.0.1', port: 5173 },
  build: {
    target: 'es2022',
    outDir: single ? 'dist-single' : 'dist',
    assetsInlineLimit: 0,
    modulePreload: false,
    cssCodeSplit: false,
    rollupOptions: single
      ? {
          output: {
            format: 'iife',
            inlineDynamicImports: true,
            entryFileNames: 'bundle.js',
            assetFileNames: 'bundle.[ext]',
          },
        }
      : {},
  },
});
