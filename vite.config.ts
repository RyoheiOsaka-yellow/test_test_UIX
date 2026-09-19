import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * Jev proxy plugin.
 *
 * The TYPESAFE_API_KEY must never reach the browser bundle. In Phase 1 the Vite
 * dev server acts as a thin proxy: the browser posts a structured decision
 * request to /api/jev/decide, and this plugin forwards it to the Jev endpoint
 * with the key attached server-side. For production deployments replace this
 * with an equivalent FastAPI / Express route (see README, "Real Jev Mode").
 */
function jevProxyPlugin(env: Record<string, string>): Plugin {
  const apiKey = env.TYPESAFE_API_KEY || process.env.TYPESAFE_API_KEY || ''
  const apiUrl =
    env.JEV_API_URL || process.env.JEV_API_URL || 'https://api.typesafe.ai/v1/jev/decide'

  return {
    name: 'jev-decision-proxy',
    configureServer(server) {
      server.middlewares.use('/api/jev/status', (_req, res) => {
        res.setHeader('content-type', 'application/json')
        res.end(JSON.stringify({ enabled: apiKey.length > 0, endpoint: apiKey ? apiUrl : null }))
      })
      server.middlewares.use('/api/jev/decide', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end()
          return
        }
        if (!apiKey) {
          res.statusCode = 503
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify({ error: 'TYPESAFE_API_KEY not configured' }))
          return
        }
        const chunks: Buffer[] = []
        for await (const chunk of req) chunks.push(chunk as Buffer)
        const body = Buffer.concat(chunks).toString('utf8')
        try {
          const upstream = await fetch(apiUrl, {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              authorization: `Bearer ${apiKey}`,
            },
            body,
          })
          res.statusCode = upstream.status
          res.setHeader('content-type', 'application/json')
          res.end(await upstream.text())
        } catch (err) {
          res.statusCode = 502
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify({ error: String(err) }))
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), tailwindcss(), jevProxyPlugin(env)],
    resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
    define: {
      // Boolean only. The key itself is never exposed to the client.
      __JEV_KEY_PRESENT__: JSON.stringify(
        Boolean(env.TYPESAFE_API_KEY || process.env.TYPESAFE_API_KEY),
      ),
    },
    base: './',
    server: { port: 5173, host: true },
  }
})
