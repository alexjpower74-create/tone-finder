#!/usr/bin/env node
// npm run demo: local migrations → Worker on 8302 + app on 8301 → wait for health → load the guide →
// "Open http://127.0.0.1:8301/". Stops both on Ctrl+C or when either one dies. Local only, nothing is sent.
import { spawn, spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadGuide, config } from './load-guide.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const workerDir = join(root, 'worker')
const WORKER_PORT = 8302
const APP_PORT = 8301
// tf2 owns app/serve.mjs; TF_APP_SERVE only exists so this script can be tested without it.
const appServe = resolve(root, process.env.TF_APP_SERVE || 'app/serve.mjs')
const quietEnv = { ...process.env, WRANGLER_SEND_METRICS: 'false', FORCE_COLOR: '0' }

const children = []
let stopping = false

function stop(code) {
  if (stopping) return
  stopping = true
  for (const c of children) {
    try {
      process.kill(-c.pid, 'SIGTERM')
    } catch {}
  }
  setTimeout(() => {
    for (const c of children) {
      try {
        process.kill(-c.pid, 'SIGKILL')
      } catch {}
    }
    process.exit(code)
  }, 1500)
}

function start(name, cmd, args, cwd) {
  const child = spawn(cmd, args, { cwd, env: quietEnv, detached: true, stdio: ['ignore', 'inherit', 'inherit'] })
  child.on('exit', (code, signal) => {
    if (stopping) return
    console.error(`demo: ${name} stopped (${signal || `exit ${code}`}); stopping the rest.`)
    stop(1)
  })
  children.push(child)
  return child
}

async function waitFor(url, what, ms = 90000) {
  const t0 = Date.now()
  while (Date.now() - t0 < ms) {
    if (stopping) throw new Error('stopped')
    try {
      if ((await fetch(url)).ok) return
    } catch {}
    await new Promise((r) => setTimeout(r, 400))
  }
  throw new Error(`${what} did not answer at ${url} within ${ms / 1000} s`)
}

process.on('SIGINT', () => {
  console.log('\nStopping…')
  stop(0)
})
process.on('SIGTERM', () => stop(0))

if (!existsSync(appServe)) {
  console.error(`demo: ${appServe} not found (the app is tf2's slice).`)
  process.exit(1)
}

const mig = spawnSync('wrangler', ['d1', 'migrations', 'apply', 'tone-finder', '--local'], { cwd: workerDir, env: { ...quietEnv, CI: '1' }, encoding: 'utf8' })
if (mig.status !== 0) {
  console.error(`demo: local migrations failed\n${mig.stdout}\n${mig.stderr}`)
  process.exit(1)
}
console.log('Local D1 migrations applied.')

start('worker', 'wrangler', ['dev', '--local', '--port', String(WORKER_PORT), '--ip', '127.0.0.1', '--show-interactive-dev-session=false'], workerDir)
start('app', process.execPath, [appServe, '--port', String(APP_PORT)], root)

try {
  await waitFor(`http://127.0.0.1:${WORKER_PORT}/api/health`, 'Worker')
  await waitFor(`http://127.0.0.1:${APP_PORT}/`, 'App')
  const r = await loadGuide({ ...config(), url: `http://127.0.0.1:${WORKER_PORT}` })
  console.log(`Loaded ${r.pages} guide pages (sha256 ${r.sha}).`)
  console.log(`\nOpen http://127.0.0.1:${APP_PORT}/\n`)
} catch (e) {
  if (!stopping) {
    console.error(`demo: ${e.message}`)
    stop(1)
  }
}
