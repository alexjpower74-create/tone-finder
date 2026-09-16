// app/serve.mjs, against the server Playwright starts. Raw node:http keeps paths exactly as written
// (fetch and Playwright's request would normalise "/../" before sending).
import { expect, test } from '@playwright/test'
import { rmSync, writeFileSync } from 'node:fs'
import http from 'node:http'
import { ONCE } from './fixtures.mjs'

const PORT = Number(process.env.TF_APP_PORT || 8301)
// A real dotfile inside app/, so the dotfile rule is what decides (a path like /.rig/BRIEF.md isn't under app/
// and would 404 even without the rule).
const PROBE = new URL('../.tf-dotfile-probe.txt', import.meta.url)

function raw(method, path) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port: PORT, method, path }, (res) => {
      res.resume()
      res.on('end', () => resolve({ status: res.statusCode, type: res.headers['content-type'] ?? '' }))
    })
    req.on('error', reject)
    req.end()
  })
}

test.describe('serve.mjs', () => {
  // biome-ignore lint/correctness/noEmptyPattern: Playwright requires the fixtures object destructuring pattern to reach testInfo
  test.beforeEach(({}, ti) => test.skip(ti.project.name !== ONCE, 'server checks run once'))
  test.beforeAll(() => writeFileSync(PROBE, 'probe\n'))
  test.afterAll(() => rmSync(PROBE, { force: true }))

  const ok = [
    ['/', 'text/html'],
    ['/index.html', 'text/html'],
    ['/app.css', 'text/css'],
    ['/api.js', 'text/javascript'],
    ['/mock/models.json', 'application/json'],
  ]
  for (const [path, type] of ok) {
    test(`200 ${type} for ${path}`, async () => {
      const r = await raw('GET', path)
      expect(r.status).toBe(200)
      expect(r.type).toContain(type)
    })
  }

  const missing = [
    '/tests/',
    '/tests/ask.spec.mjs',
    '/tools/',
    '/tools/build-mock.mjs',
    '/mock/',
    '/mock',
    '/serve.mjs',
    '/playwright.config.mjs',
    '/../package.json',
    '/%2e%2e/package.json',
    '/..%2fAGENTS.md',
    '/.rig/BRIEF.md',
    '/.tf-dotfile-probe.txt',
    '/nope.html',
  ]
  for (const path of missing) {
    test(`404 for ${path}`, async () => {
      const r = await raw('GET', path)
      expect(r.status).toBe(404)
      expect(r.type).toContain('text/html')
    })
  }

  test('405 for POST', async () => {
    expect((await raw('POST', '/index.html')).status).toBe(405)
  })
})
