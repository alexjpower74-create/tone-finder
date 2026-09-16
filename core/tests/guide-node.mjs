// Node-only: read the guide from TF_GUIDE_DIR for tests and scripts. Never skips: a missing guide throws
// `guide not found at <path>` so the run fails (docs/API.md §2).
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { parsePages } from '../guide.js'

export const DEFAULT_GUIDE_DIR = join(homedir(), 'Claude/Reference/Yek Fractal Amp Guide')

export function guideDir() {
  return process.env.TF_GUIDE_DIR || DEFAULT_GUIDE_DIR
}

export function loadGuideText(dir = guideDir()) {
  const path = join(dir, 'yek-guide-fulltext.txt')
  if (!existsSync(path)) throw new Error(`guide not found at ${path}`)
  return readFileSync(path, 'utf8')
}

export function loadPages(dir = guideDir()) {
  return parsePages(loadGuideText(dir))
}

export function loadSections(dir = guideDir()) {
  const path = join(dir, 'yek-guide-sections.json')
  if (!existsSync(path)) throw new Error(`guide not found at ${path}`)
  return JSON.parse(readFileSync(path, 'utf8'))
}
