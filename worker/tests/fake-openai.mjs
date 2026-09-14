#!/usr/bin/env node
// Fake OpenAI chat-completions server for tests (docs/API.md §9). Never used for real calls.
// POST /v1/chat/completions: scripted by a word in the query (fake-plant, fake-puppets, fake-error, fake-badjson).
// GET /count, POST /reset, GET /last (request shape, never the key). Canned quotes are short strings chosen by the
// tests: some verified on their page, some broken on purpose.
import { createServer } from 'node:http'
import { pathToFileURL } from 'node:url'

export const SCENARIOS = {
  'fake-plant': {
    pick: {
      general_knowledge: [{ text: 'FAKE general knowledge: a planted line for the tests.' }],
      search_terms: [],
      picks: [
        { model_id: 'brit-brown-and-fas-brown', unit_name: 'Brown Sound Deluxe' },
        { model_id: '1959slp', unit_name: '1959SLP' },
      ],
    },
    cite: {
      suggestions: [
        {
          model_id: '1959slp',
          unit_name: '1959SLP',
          citations: [
            { page: 28, quote: 'Models of a 100 watt Superlead Plexi re-issue' }, // (i) verified on p. 28
            { page: 60, quote: 'Turn up Presence in the Brit Brown model' }, // (ii) real, but p. 60 is another model
            { page: 28, quote: 'Models of a 100 watt Superlead Plexy re-issue' }, // (iii) one changed character
          ],
        },
        { model_id: 'brit-brown-and-fas-brown', unit_name: 'Brown Sound Deluxe', citations: [{ page: 60, quote: 'Turn up Presence in the Brit Brown model' }] },
      ],
    },
  },
  'fake-attrib': {
    pick: { general_knowledge: [], search_terms: [], picks: [{ model_id: 'matchbox-d-30', unit_name: 'Matchbox D-30' }] },
    cite: {
      suggestions: [
        {
          model_id: 'matchbox-d-30',
          unit_name: 'Matchbox D-30',
          // The real model's p. 188 citation opens with the previous passage's attribution.
          citations: [{ page: 188, quote: '– Manual Fractal Audio’s model is based on channel 1 (12AX7) with Master bypassed. It’s a favorite of many players, for clean tones with chime as well as crunchy work.' }],
        },
      ],
    },
  },
  'fake-fold': {
    pick: {
      general_knowledge: [],
      search_terms: [],
      picks: [
        { model_id: 'brit-brown-and-fas-brown', unit_name: 'Brit Brown' },
        { model_id: 'ods-100', unit_name: 'ODS-100' },
      ],
    },
    cite: {
      suggestions: [
        {
          model_id: 'brit-brown-and-fas-brown',
          unit_name: 'Brit Brown',
          citations: [
            { page: 60, quote: 'custom amp models by fractal audio, recreating EVH\'s "Brown Sound"' }, // straight quotes, lower case: kept
            { page: 60, quote: 'Custom amp models by Fractal Audio, recreating EVH’s “Brawn Sound”' }, // one letter changed: dropped
            { page: 61, quote: 'Custom amp models by Fractal Audio, recreating EVH’s “Brown Sound”' }, // right text, wrong page: dropped
          ],
        },
        { model_id: 'ods-100', unit_name: 'ODS-100', citations: [{ page: 201, quote: 'which produces an up front sparkling tone,' }] }, // fragment: full sentence
      ],
    },
  },
  'fake-gk': {
    pick: {
      general_knowledge: [
        { text: 'The provided guide candidate points to Fractal Audio’s own Brown Sound-style models for that vibe.' },
        { text: 'FAKE: Eddie Van Halen played a modded Marshall Superlead on the early records.' },
        { text: 'From the model list, Brit Brown fits best.' },
      ],
      search_terms: ['van halen', 'brown sound', 'master'],
      picks: [{ model_id: 'brit-brown-and-fas-brown', unit_name: 'Brit Brown' }],
    },
    cite: {
      suggestions: [
        { model_id: 'brit-brown-and-fas-brown', unit_name: 'Brit Brown', citations: [{ page: 60, quote: 'Turn up Presence in the Brit Brown model' }] },
      ],
    },
  },
  'fake-span': {
    pick: { general_knowledge: [], search_terms: [], picks: [{ model_id: '1959slp', unit_name: '1959SLP' }] },
    cite: {
      suggestions: [
        // An exact substring of p. 28 that runs from one box into the next (API.md §4.2): must be dropped.
        { model_id: '1959slp', unit_name: '1959SLP', citations: [{ page: 28, quote: 'Or just crank everything, like Eddie Van Halen “My settings for a “typical” Plexi tone are Bass 2, Mid 8, Treble 7.5.' }] },
      ],
    },
  },
  'fake-nonsense': {
    // A query the guide can't support, and no general knowledge: the real model still picked VOX-style amps.
    pick: {
      general_knowledge: [],
      search_terms: ['chime', 'vox', 'bright', 'clean'],
      picks: [{ model_id: 'class-a-30w', unit_name: 'Class-A 30W TB' }],
    },
    cite: {
      suggestions: [
        {
          model_id: 'class-a-30w',
          unit_name: 'Class-A 30W TB',
          citations: [{ page: 109, quote: 'What also works well with VOX amps is to boost the signal at the input stage, for example by increasing Input Trim, or by adding a Drive such as FET Boost or SDD.' }],
        },
      ],
    },
  },
  'fake-puppets': {
    pick: {
      general_knowledge: [{ text: 'FAKE: the rhythm guitars on Master of Puppets were recorded with a MESA/Boogie Mark IIC+.' }],
      search_terms: ['metallica', 'mark iic+'],
      picks: [{ model_id: 'usa-iic-plus-and-usa-iic-plus-plus', unit_name: 'USA IIC+' }],
    },
    cite: {
      suggestions: [
        { model_id: 'usa-iic-plus-and-usa-iic-plus-plus', unit_name: 'USA IIC+', citations: [{ page: 270, quote: 'also referred to as “Metallica’s IIC+”' }] },
      ],
    },
  },
}
const DEFAULT = { pick: { general_knowledge: [], search_terms: [], picks: [] }, cite: { suggestions: [] } }
export const USAGE = { prompt_tokens: 1500, completion_tokens: 400, prompt_tokens_details: { cached_tokens: 500 } }

function queryOf(step, messages) {
  const user = messages.find((m) => m.role === 'user')?.content || ''
  if (step === 'pick') {
    try {
      return String(JSON.parse(user).query || '')
    } catch {
      return ''
    }
  }
  return (/^QUERY: (.*)$/m.exec(user) || [])[1] || ''
}

export function startFake({ port = Number(process.env.TF_FAKE_AI_PORT || 8303), host = '127.0.0.1' } = {}) {
  let count = 0
  let last = null
  const server = createServer((req, res) => {
    const send = (status, body, type = 'application/json') => {
      res.writeHead(status, { 'content-type': type })
      res.end(typeof body === 'string' ? body : JSON.stringify(body))
    }
    if (req.method === 'GET' && req.url === '/count') return send(200, { count })
    if (req.method === 'GET' && req.url === '/last') return send(200, last || {})
    if (req.method === 'POST' && req.url === '/reset') {
      count = 0
      last = null
      return send(200, { ok: true })
    }
    if (req.method !== 'POST' || req.url !== '/v1/chat/completions') return send(404, { error: 'not_found' })
    let raw = ''
    req.on('data', (c) => (raw += c))
    req.on('end', () => {
      count++
      let body
      try {
        body = JSON.parse(raw)
      } catch {
        return send(400, { error: 'bad_request' })
      }
      const messages = Array.isArray(body.messages) ? body.messages : []
      const system = messages.find((m) => m.role === 'system')?.content || ''
      const step = system.includes('STEP: pick') ? 'pick' : system.includes('STEP: cite') ? 'cite' : 'unknown'
      const query = queryOf(step, messages)
      last = {
        step,
        authorization: /^Bearer \S+$/.test(req.headers.authorization || '') ? 'present' : 'missing',
        model: body.model,
        max_completion_tokens: body.max_completion_tokens,
        reasoning_effort: body.reasoning_effort,
        response_format: body.response_format,
      }
      if (query.includes('fake-error')) return send(500, { error: { message: 'fake server error' } })
      const content = query.includes('fake-badjson')
        ? 'this is not json'
        : JSON.stringify((Object.entries(SCENARIOS).find(([k]) => query.includes(k))?.[1] || DEFAULT)[step] || {})
      send(200, {
        id: `fake-${count}`,
        object: 'chat.completion',
        model: body.model,
        choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }],
        usage: USAGE,
      })
    })
  })
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, host, () =>
      resolve({
        port: server.address().port,
        count: () => count,
        close: () => new Promise((r) => server.close(() => r())),
      }),
    )
  })
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const fake = await startFake()
  console.log(`fake-openai listening on 127.0.0.1:${fake.port}`)
  const stop = () => fake.close().then(() => process.exit(0))
  process.on('SIGINT', stop)
  process.on('SIGTERM', stop)
}
