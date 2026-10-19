import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// In local dev, serve api/ai.js at /api/ai the same way Vercel does in production.
function devApi() {
  return {
    name: 'dev-api',
    configureServer(server) {
      server.middlewares.use('/api/ai', async (req, res) => {
        try {
          const chunks = []
          for await (const c of req) chunks.push(c)
          const headers = {}
          for (const h of ['origin', 'host', 'content-type']) if (req.headers[h]) headers[h] = req.headers[h]
          const { POST } = await server.ssrLoadModule('/api/ai.js')
          const response = req.method === 'POST'
            ? await POST(new Request(`http://${req.headers.host}/api/ai`, { method: 'POST', headers, body: Buffer.concat(chunks) }))
            : new Response('Method not allowed', { status: 405 })
          res.statusCode = response.status
          res.setHeader('content-type', response.headers.get('content-type') || 'text/plain')
          res.end(await response.text())
        } catch (err) {
          console.error(err)
          res.statusCode = 500
          res.end(JSON.stringify({ error: 'Dev API error' }))
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // Server-only keys for api/ai.js in local dev. Never prefixed with VITE_, so never sent to the phone.
  for (const k of ['GROQ_API_KEY', 'GROQ_MODEL', 'ANTHROPIC_API_KEY']) if (env[k]) process.env[k] = env[k]

  return {
    plugins: [
      react(),
      devApi(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
        manifest: {
          name: 'Kharcha — Expense Track-kar',
          short_name: 'Kharcha',
          description: 'Type 150 food and you are done.',
          start_url: '/',
          display: 'standalone',
          background_color: '#17140f',
          theme_color: '#17140f',
          icons: [
            { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
            { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
          shortcuts: [{ name: 'Add expense', short_name: 'Add', url: '/' }],
        },
        workbox: {
          // The page itself is NOT precached: a precached index.html only refreshes when the
          // build changes, so server-side changes (e.g. Netlify settings) never reached phones.
          globPatterns: ['**/*.{js,css,svg,png,woff2}'],
          navigateFallback: null,
          runtimeCaching: [
            {
              // Online: always the latest page. Offline: the last copy we saw.
              urlPattern: ({ request, url }) =>
                request.mode === 'navigate' || (url.origin === self.location.origin && url.pathname === '/'),
              handler: 'NetworkFirst',
              options: {
                cacheName: 'pages',
                networkTimeoutSeconds: 4,
                matchOptions: { ignoreVary: true, ignoreSearch: true },
              },
            },
          ],
        },
      }),
    ],
    test: { include: ['src/**/*.test.js'] },
  }
})
