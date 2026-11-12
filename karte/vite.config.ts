import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// SINGLE=1 のときは、JS・CSSをすべて埋め込んだ1枚のHTMLを出力する(npm run build:html)
const single = process.env.SINGLE === '1';

export default defineConfig({
  base: './',
  plugins: [react(), ...(single ? [viteSingleFile()] : [])],
  build: single ? { outDir: 'dist-single' } : {},
  server: { host: true, port: 5173 },
});
