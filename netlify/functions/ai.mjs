// Netlify Function serving /api/ai. The real logic is shared with local dev in api/ai.js.
// Set GROQ_API_KEY in Netlify → Site configuration → Environment variables.
import { POST } from '../../api/ai.js'

export default async (request) => {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 })
  return POST(request)
}

export const config = { path: '/api/ai' }
