#!/usr/bin/env node
// Worker test runner (npm --prefix worker test). Local only, never --remote.
// Wipes and migrates .wrangler/test-state (and test-state-cap), starts the fake OpenAI server and two
// `wrangler dev --local` instances (the second with a tiny AI_CAP_CAD for the spend-cap test), waits for
// /api/health, runs `node --test tests/`, and always stops what it started.
import { spawn, spawnSync } from 'node:child_process'
import { rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const workerDir = join(dirname(fileURLToPath(import.meta.url)), '..')
const WORKER_PORT = Number(process.env.TF_WORKER_PORT || 8302)
const FAKE_PORT = Number(process.env.TF_FAKE_AI_PORT || 8303)
const CAP_PORT = Number(process.env.TF_WORKER_CAP_PORT || WORKER_PORT + 50)
const STATE = '.wrangler/test-state'
const CAP_STATE = '.wrangler/test-state-cap'
// Nothing is sent: no wrangler telemetry.
const quietEnv = { ...process.env, WRANGLER_SEND_METRICS: 'false', CI: '1', NO_UPDATE_NOTIFIER: '1', FORCE_COLOR: '0' }

const children = []
function start(name, cmd, args, env = quietEnv) {
  const child = spawn(cmd, args, { cwd: workerDir, env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] })
  let log = ''
  const keep = (d) => {
    log = (log + d).slice(-8000)
  }
  child.stdout.on('data', keep)
  child.stderr.on('data', keep)
  child.name = name
  child.log = () => log
  children.push(child)
  return child
}

function stopAll() {
  for (const c of children) {
    if (c.exitCode !== null || c.signalCode !== null) continue
    try {
      process.kill(-c.pid, 'SIGTERM')
    } catch {}
  }
}
function hardStop() {
  for (const c of children) {
    try {
      process.kill(-c.pid, 'SIGKILL')
    } catch {}
  }
}
process.on('exit', hardStop)
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    stopAll()
    setTimeout(() => process.exit(130), 1500)
  })
}

async function waitFor(url, child, ms = 90000) {
  const t0 = Date.now()
  while (Date.now() - t0 < ms) {
    if (child.exitCode !== null) throw new Error(`${child.name} exited early:\n${child.log()}`)
    try {
      const r = await fetch(url)
      if (r.ok) return
    } catch {}
    await new Promise((r) => setTimeout(r, 400))
  }
  throw new Error(`${child.name} not healthy at ${url} after ${ms} ms:\n${child.log()}`)
}

function migrate(state) {
  rmSync(join(workerDir, state), { recursive: true, force: true })
  const r = spawnSync('wrangler', ['d1', 'migrations', 'apply', 'tone-finder', '--local', '--persist-to', state], {
    cwd: workerDir,
    env: quietEnv,
    encoding: 'utf8',
  })
  if (r.status !== 0) throw new Error(`migrations failed for ${state}:\n${r.stdout}\n${r.stderr}`)
}

function wranglerDev(name, port, state, extraVars = []) {
  const vars = ['ADMIN_TOKEN:test-admin-token', 'OPENAI_API_KEY:test-key', `OPENAI_BASE_URL:http://127.0.0.1:${FAKE_PORT}/v1`, ...extraVars]
  return start(name, 'wrangler', [
    'dev',
    '--local',
    '--port',
    String(port),
    '--ip',
    '127.0.0.1',
    '--persist-to',
    state,
    '--inspector-port',
    String(port + 1000),
    '--show-interactive-dev-session=false',
    ...vars.flatMap((v) => ['--var', v]),
  ])
}

// Refuse to start if any port is already taken: otherwise the health wait can succeed against someone else's Worker
// (a running demo with a real key) and the tests would send requests to it.
async function portFree(port) {
  const { createServer } = await import('node:net')
  return new Promise((resolve) => {
    const s = createServer()
    s.once('error', () => resolve(false))
    s.listen(port, '127.0.0.1', () => s.close(() => resolve(true)))
  })
}

let code = 1
try {
  const busy = []
  for (const p of [WORKER_PORT, FAKE_PORT, CAP_PORT, WORKER_PORT + 1000, CAP_PORT + 1000]) if (!(await portFree(p))) busy.push(p)
  if (busy.length)
    throw new Error(
      `port(s) already in use: ${busy.join(', ')}. Set TF_WORKER_PORT / TF_FAKE_AI_PORT / TF_WORKER_CAP_PORT to free ports. Nothing was started or sent.`,
    )
  migrate(STATE)
  migrate(CAP_STATE)
  const fake = start('fake-openai', process.execPath, ['tests/fake-openai.mjs'], { ...quietEnv, TF_FAKE_AI_PORT: String(FAKE_PORT) })
  const main = wranglerDev('worker', WORKER_PORT, STATE)
  const cap = wranglerDev('worker-cap', CAP_PORT, CAP_STATE, ['AI_CAP_CAD:0.0001'])
  await waitFor(`http://127.0.0.1:${FAKE_PORT}/count`, fake)
  await waitFor(`http://127.0.0.1:${WORKER_PORT}/api/health`, main)
  await waitFor(`http://127.0.0.1:${CAP_PORT}/api/health`, cap)
  const t = spawn(process.execPath, ['--test', '--test-concurrency=1', 'tests/'], {
    cwd: workerDir,
    stdio: 'inherit',
    env: {
      ...process.env,
      TF_WORKER_URL: `http://127.0.0.1:${WORKER_PORT}`,
      TF_WORKER_CAP_URL: `http://127.0.0.1:${CAP_PORT}`,
      TF_FAKE_AI_URL: `http://127.0.0.1:${FAKE_PORT}`,
      TF_ADMIN_TOKEN: 'test-admin-token',
    },
  })
  code = await new Promise((r) => t.on('exit', (c) => r(c ?? 1)))
} catch (e) {
  console.error(e.message)
  code = 1
} finally {
  stopAll()
  await new Promise((r) => setTimeout(r, 1500))
  hardStop()
}
process.exit(code)
