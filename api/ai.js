import Anthropic from '@anthropic-ai/sdk'

// Server-side AI handler: the only code that holds an API key. Served at /api/ai by
// netlify/functions/ai.mjs in production and by the Vite dev server locally. The phone sends either
// pre-computed summary numbers or one leftover entry note; nothing else.
//
// Set ONE of these in .env.local (local) or Netlify → Site configuration → Environment variables:
//   GROQ_API_KEY       → Groq (free tier). Optional GROQ_MODEL, default below.
//   ANTHROPIC_API_KEY  → Claude.
// Request bodies are never logged.

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
// Groq's recommended replacement after the Llama 3.x shutdown (16 Aug 2026).
const GROQ_DEFAULT_MODEL = 'openai/gpt-oss-120b'
const CLAUDE_MODEL = 'claude-opus-5-5'

const SUMMARY_SYSTEM = `You write spending summaries for a personal expense tracker used in India.
You get a JSON object of facts that were already calculated. Write 3-4 short sentences in plain,
friendly English addressed to the user as "you". Say where most of the money went, how it compares
with the previous period when that is given, how much of the monthly budget is left (or how far over)
when a budget is given, and end with one specific, practical observation drawn from the data
(for example a category that grew a lot, or a few big entries that explain the total).
Only use numbers that appear in the facts, exactly as written - never add, subtract or compute new totals or percentages.
If the facts have no comparedTo field, don't mention any comparison or missing data at all.
No markdown, no bullet points, no headings, no greeting.`

const CATEGORIZE_SYSTEM = `You sort expense notes from an Indian expense tracker into categories.
Reply with exactly one category name copied from the list you are given, and nothing else.
If nothing fits well, reply with "Other" when it is in the list.`

class ProviderError extends Error {
  constructor(message, status) {
    super(message)
    this.status = status
  }
}

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } })

async function askGroq(system, content, maxTokens) {
  const model = process.env.GROQ_MODEL || GROQ_DEFAULT_MODEL
  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      // gpt-oss is a reasoning model: keep thinking short and leave room for it in the limit.
      ...(model.startsWith('openai/gpt-oss') ? { reasoning_effort: 'low', include_reasoning: false } : {}),
      max_completion_tokens: maxTokens + 1000,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content },
      ],
    }),
    signal: AbortSignal.timeout(20000),
  })
  if (!res.ok) {
    if (res.status === 401) throw new ProviderError('The server API key is invalid.', 503)
    if (res.status === 404 || res.status === 400) {
      console.error('Groq rejected the request', res.status, (await res.text()).slice(0, 300))
      throw new ProviderError(`The AI model "${model}" isn't available. Set GROQ_MODEL to a current Groq model.`, 502)
    }
    if (res.status === 429) throw new ProviderError('Too many AI requests right now. Try again in a minute.', 429)
    console.error('Groq error', res.status)
    throw new ProviderError('The AI service had a problem. Try again later.', 502)
  }
  const data = await res.json()
  return (data.choices?.[0]?.message?.content || '').trim()
}

let claude
async function askClaude(system, content, maxTokens) {
  claude ??= new Anthropic({ timeout: 40000, maxRetries: 1 })
  try {
    const response = await claude.beta.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: maxTokens * 4, // room for thinking, which is always on for this model
      // If Claude declines, the API retries on Anthropic's recommended fallback model.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low' },
      system,
      messages: [{ role: 'user', content }],
    })
    if (response.stop_reason === 'refusal') return ''
    return response.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim()
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) throw new ProviderError('The server API key is invalid.', 503)
    if (err instanceof Anthropic.RateLimitError) {
      throw new ProviderError('Too many AI requests right now. Try again in a minute.', 429)
    }
    if (err instanceof Anthropic.APIError) {
      console.error('Anthropic API error', err.status)
      throw new ProviderError('The AI service had a problem. Try again later.', 502)
    }
    throw err
  }
}

function provider() {
  if (process.env.GROQ_API_KEY) return askGroq
  if (process.env.ANTHROPIC_API_KEY) return askClaude
  return null
}

export async function POST(request) {
  // Only our own pages may call this.
  const origin = request.headers.get('origin')
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host')
  if (origin && host && new URL(origin).host !== host) return json({ error: 'Forbidden' }, 403)

  const ask = provider()
  if (!ask) {
    return json({ error: 'AI is not set up yet (add GROQ_API_KEY on the server).' }, 503)
  }

  let body
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Bad request' }, 400)
  }

  try {
    if (body.mode === 'summary') {
      const facts = JSON.stringify(body.stats ?? {})
      if (facts.length > 12000) return json({ error: 'Too much data' }, 413)
      const text = await ask(SUMMARY_SYSTEM, `Facts:\n${facts}`, 600)
      if (!text) return json({ error: 'The AI could not write a summary this time.' }, 422)
      return json({ text })
    }

    if (body.mode === 'categorize') {
      const text = String(body.text ?? '').slice(0, 300)
      const categories = (Array.isArray(body.categories) ? body.categories : [])
        .map(String)
        .slice(0, 40)
      if (!text || !categories.length) return json({ error: 'Bad request' }, 400)
      const answer = await ask(
        CATEGORIZE_SYSTEM,
        `Categories: ${categories.join(', ')}\nExpense note: ${text}`,
        20,
      )
      // Validate in code: anything not on the list is rejected.
      const clean = (answer || '').replace(/[."'\s]+$/g, '').replace(/^["'\s]+/, '').toLowerCase()
      const category = categories.find((c) => c.toLowerCase() === clean) ?? null
      return json({ category })
    }

    return json({ error: 'Unknown mode' }, 400)
  } catch (err) {
    if (err instanceof ProviderError) return json({ error: err.message }, err.status)
    console.error('AI function error', err?.name)
    return json({ error: 'Something went wrong.' }, 500)
  }
}
