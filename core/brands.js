// Fixed brand table (docs/API.md §3 rule 4). A brand is assigned only when one of its tokens occurs in the
// section title as a whole word (case-sensitive: "HOOK" is the brand, "Hook" in "Capt Hook" is not needed).
export const BRANDS = [
  ['Fender', ['Fender']],
  ['Marshall', ['Marshall']],
  ['MESA/Boogie', ['MESA']],
  ['VOX', ['VOX']],
  ['Bogner', ['Bogner']],
  ['Diezel', ['Diezel']],
  ['Engl', ['Engl']],
  ['Friedman', ['Friedman']],
  ['Soldano', ['Soldano']],
  ['Orange', ['Orange']],
  ['Dumble', ['Dumble']],
  ['Trainwreck', ['Trainwreck']],
  ['Matchless', ['Matchless']],
  ['Dr. Z', ['Dr. Z']],
  ['Carol-Ann', ['Carol-Ann']],
  ['Cameron', ['Cameron']],
  ['Splawn', ['Splawn']],
  ['Suhr', ['Suhr']],
  ['Two-Rock', ['Two-Rock']],
  ['Fuchs', ['Fuchs']],
  ['Budda', ['Budda']],
  ['Bad Cat', ['Bad Cat']],
  ['Hiwatt', ['Hiwatt']],
  ['Peavey', ['Peavey']],
  ['EVH', ['EVH']],
  ['Roland', ['Roland']],
  ['Ampeg', ['Ampeg']],
  ['Supro', ['Supro']],
  ['Gibson', ['Gibson']],
  ['Carvin', ['Carvin']],
  ['Divided By 13', ['Divided By 13']],
  ['Swart', ['Swart']],
  ['Komet', ['Komet']],
  ['Cornford', ['Cornford']],
  ['Morgan', ['Morgan']],
  ['Carr', ['Carr']],
  ['Blankenship', ['Blankenship']],
  ['Bludotone', ['Bludotone']],
  ['HOOK', ['HOOK']],
  ['Custom Audio', ['Custom Audio']],
  ['Fryette', ['Fryette']],
  ['Paul Ruby', ['Paul Ruby']],
  ['Fractal Audio', ['FAS']],
]

function tokenRegex(token) {
  const esc = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp('(?<![A-Za-z0-9])' + esc + '(?![A-Za-z0-9])')
}

const COMPILED = BRANDS.map(([brand, tokens]) => [brand, tokens.map(tokenRegex)])

// Brands in table order.
export function brandsForSection(section) {
  return COMPILED.filter(([, res]) => res.some((re) => re.test(section))).map(([b]) => b)
}
