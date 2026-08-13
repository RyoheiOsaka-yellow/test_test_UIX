import { defineConfig } from 'vite'

// The harness owns the port. It boots this server, waits for it, and points a headless
// browser at it; a server that picks a different port when the first is busy is a server
// the harness cannot find, and every capture then silently photographs the wrong thing.
// strictPort makes that failure loud instead.
export default defineConfig({
  server: {
    host: '127.0.0.1',
    port: Number(process.env.AAABENCH_PORT || 5173),
    strictPort: true,
    // Generated content (heightfields, splat maps, baked meshes) lands in public/ and
    // src/world/generated/. Watching those with HMR reloads the page mid-generation, which
    // looks exactly like a crash. Ignore them; reload deliberately instead.
    watch: { ignored: ['**/public/generated/**', '**/src/world/generated/**'] },
  },
  build: { target: 'es2022', sourcemap: true },
})
