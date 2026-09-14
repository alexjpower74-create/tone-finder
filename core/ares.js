// Ares firmware note and per-suggestion flags (docs/API.md §4.5).

export const ARES = Object.freeze({
  firmware: 'Ares',
  guide_firmware: 'Quantum 7.02',
  note: 'yek\'s guide was written for Quantum 7.02. Your Axe-Fx II runs Ares, which came later. Quantum 9.00 removed Motor Drive and Transformer Grind from the Amp block and replaced them with Speaker Compression (Spkr Comp), and Fractal says Ares amp modeling "should sound very similar".',
  sources: Object.freeze([
    Object.freeze({
      url: 'https://forum.fractalaudio.com/threads/axe-fx-ii-quantum-rev-9-00-firmware-release.131649/',
      fetched: '2026-09-14',
      quote: 'Removed the “Motor Drive” and “Transformer Grind” algorithms and associated parameters from the Amp block. These have been replaced by the new “Speaker Compression” algorithm.',
    }),
    Object.freeze({
      url: 'https://forum.fractalaudio.com/threads/axe-fx-ii-ares-rev-1-00-firmware-release.148248/',
      fetched: '2026-09-14',
      quote: 'Not all aspects of the Ares modeling were able to be ported but the most important parts were and the amp modeling should sound very similar.',
    }),
  ]),
})

export const ARES_ADVICE =
  'Your firmware doesn\'t have this control. Skip this step: Fractal replaced it with Speaker Compression (Spkr Comp), which resets to 3.0.'

const ARES_RE = /motor\s*drive|(transformer|xformer|xfrmr)\s*grind/gi

// A fresh copy per Answer, so no caller can mutate the constant through a response object.
export function aresObject() {
  return JSON.parse(JSON.stringify(ARES))
}

// items: [{ text, where: "why"|"settings"|"direction"|"ai", page }] → flags, one per hit.
export function aresFlags(items) {
  const flags = []
  const seen = new Set()
  for (const { text, where, page = null } of items) {
    if (typeof text !== 'string') continue
    for (const m of text.matchAll(ARES_RE)) {
      const param = /^motor/i.test(m[0]) ? 'Motor Drive' : 'Transformer Grind'
      const key = `${param}|${where}|${text}`
      if (seen.has(key)) continue
      seen.add(key)
      flags.push({ param, where, quote: text, page, advice: ARES_ADVICE })
    }
  }
  return flags
}
