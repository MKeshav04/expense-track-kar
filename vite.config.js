import { execSync } from 'node:child_process'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// In local dev, serve api/ai.js at /api/ai the same way the Netlify function does in production.
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

  // Shown in Settings so you can tell which version a phone is running.
  let commit = process.env.COMMIT_REF?.slice(0, 7) // set by Netlify builds
  if (!commit) {
    try {
      commit = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
    } catch {
      commit = 'dev'
    }
  }
  const version = `${new Date().toISOString().slice(0, 10)} · ${commit}`

  return {
    define: { __APP_VERSION__: JSON.stringify(version) },
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
          // Code (/assets/*) isn't precached either: precaching drops the previous version's files
          // on update, which could leave a cached page pointing at files that no longer exist.
          // Instead hashed files are kept in a runtime cache (see below), old versions included.
          globPatterns: ['*.{svg,png}', 'registerSW.js'],
          navigateFallback: null,
          runtimeCaching: [
            {
              // Hashed build files never change, so cache-first is safe; keep old ones for a while
              // so any cached page always finds the code it was built with.
              urlPattern: ({ url }) => url.origin === self.location.origin && url.pathname.startsWith('/assets/'),
              handler: 'CacheFirst',
              options: {
                cacheName: 'assets',
                expiration: { maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 * 90 },
                cacheableResponse: { statuses: [200] },
              },
            },
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
