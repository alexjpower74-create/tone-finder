// Run from the repo root: npx playwright test -c app/playwright.config.mjs
import { defineConfig } from '@playwright/test'
import { fileURLToPath } from 'node:url'

const PORT = Number(process.env.TF_APP_PORT || 8301)
const REPO = fileURLToPath(new URL('..', import.meta.url))

const phone = { viewport: { width: 390, height: 844 }, hasTouch: true }
const desktop = { viewport: { width: 1280, height: 800 } }

export default defineConfig({
  testDir: './tests',
  testMatch: /.*\.spec\.mjs$/,
  outputDir: './test-results',
  fullyParallel: true,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium-390', use: { browserName: 'chromium', ...phone } },
    { name: 'chromium-1280', use: { browserName: 'chromium', ...desktop } },
    { name: 'webkit-390', use: { browserName: 'webkit', ...phone } },
    { name: 'webkit-1280', use: { browserName: 'webkit', ...desktop } },
  ],
  webServer: {
    command: `node app/serve.mjs --port ${PORT}`,
    cwd: REPO,
    url: `http://127.0.0.1:${PORT}/index.html`,
    reuseExistingServer: false,
    timeout: 15_000,
  },
})
