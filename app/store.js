// Binder picks saved on this device. localStorage can be missing, full or blocked (private windows,
// cleared site data), so every access is wrapped and the app still works without it.
export const BINDER_KEY = 'tf.binder.v1'

function readRaw() {
  try {
    const raw = globalThis.localStorage?.getItem(BINDER_KEY)
    if (!raw) return []
    const list = JSON.parse(raw)
    return Array.isArray(list) ? list.filter((p) => p && p.suggestion && p.suggestion.model_id) : []
  } catch {
    return []
  }
}

function writeRaw(list) {
  try {
    globalThis.localStorage?.setItem(BINDER_KEY, JSON.stringify(list))
    return true
  } catch {
    return false
  }
}

// Same query + same model = same pick.
export function pickKey(query, modelId) {
  return `${String(query ?? '')
    .trim()
    .toLowerCase()}|${modelId}`
}

export function listPicks() {
  return readRaw()
}

export function hasPick(query, modelId) {
  const key = pickKey(query, modelId)
  return readRaw().some((p) => pickKey(p.query, p.suggestion.model_id) === key)
}

// Returns true when saved. False means storage is unavailable.
export function addPick(query, suggestion) {
  if (hasPick(query, suggestion.model_id)) return true
  const list = readRaw()
  list.push({ query, suggestion, saved_at: new Date().toISOString() })
  return writeRaw(list)
}

export function removePick(query, modelId) {
  const key = pickKey(query, modelId)
  return writeRaw(readRaw().filter((p) => pickKey(p.query, p.suggestion.model_id) !== key))
}

export function storageAvailable() {
  try {
    const probe = '__tf_probe__'
    globalThis.localStorage.setItem(probe, '1')
    globalThis.localStorage.removeItem(probe)
    return true
  } catch {
    return false
  }
}
