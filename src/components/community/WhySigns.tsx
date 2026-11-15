import { useState } from 'react'
import type { PlaceReport } from '../../../shared/types.ts'
import { activeSignCount, historySentence, shownSigns, signSentence } from './words.ts'

const FIRST = 3

/** "Why: 5 warning signs right now", each sign as a plain sentence (critique §1b, fix 11). */
export default function WhySigns({ place }: { place: PlaceReport }) {
  const [all, setAll] = useState(false)
  // Same count as the help letter and the assistant: active signs EXCLUDING the outlook sign,
  // because the status sentence above already says what the risk is expected to do.
  const n = activeSignCount(place.signs)
  const { active, quiet } = shownSigns(place.signs)
  const history = historySentence(place)
  const first = active.slice(0, FIRST), rest = active.slice(FIRST)
  const more = rest.length > 0 || quiet.length > 0
  const heading = n === 0 ? 'Why: no warning signs right now' : `Why: ${n} warning sign${n === 1 ? '' : 's'} right now`

  return <section aria-labelledby="why" className="mt-5">
    <h2 id="why" className="text-[19px] font-semibold">{heading}</h2>
    {first.length > 0 && <ul className="mt-1.5 space-y-1 text-[17px] leading-[1.45]">
      {first.map((s) => <li key={s.key}>{signSentence(s, place)}</li>)}
    </ul>}
    {all && rest.length > 0 && <ul className="mt-1 space-y-1 text-[17px] leading-[1.45]">
      {rest.map((s) => <li key={s.key}>{signSentence(s, place)}</li>)}
    </ul>}
    {all && quiet.length > 0 && <>
      <h3 className="mt-3 text-[15px] font-semibold">Not a warning sign right now</h3>
      <ul className="mt-0.5 space-y-1 text-[15px] leading-[1.45] text-mute">
        {quiet.map((s) => <li key={s.key}>{signSentence(s, place)}</li>)}
      </ul>
    </>}
    {history && <p className="mt-1.5 text-[15px] leading-[1.45] text-mute">{history}</p>}
    {all && <p className="mt-1.5 text-[15px] leading-[1.45] text-mute">These checks are our own rules of thumb. They have not yet been tested against past fires.</p>}
    {more && <button type="button" aria-expanded={all} onClick={() => setAll((v) => !v)}
      className="mt-2 inline-flex min-h-10 items-center rounded-md border border-edge bg-white px-3 text-[15px] font-semibold hover:bg-ink-800">
      {all ? 'Show fewer' : n > FIRST ? `See all ${n} warning signs` : 'See what else we check'}
    </button>}
  </section>
}
