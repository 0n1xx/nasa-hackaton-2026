import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { PlaceReport } from '../../../shared/types.ts'
import { historySentence, recordDetails, trendSentence } from './words.ts'

/**
 * "Compared with 42 years of NASA records": today's high against the same time of year since 1984, and the
 * long-term direction of fire-season highs, in words first. "How we tested this" names the tests (percentile
 * rank, Mann–Kendall, Sen's slope), the data and the numbers. Computed on the server (server/place.ts placeHistory).
 * The record downloads on first request: one quiet line while the page asks again (`waiting`), nothing if it fails.
 */
export default function NasaRecord({ place, example, waiting }: { place: PlaceReport; example: boolean; waiting: boolean }) {
  const [open, setOpen] = useState(false)
  const h = place.history

  if (place.historyStatus === 'loading') {
    return waiting ? <p role="status" className="mt-5 text-[15px] leading-[1.45] text-mute">Loading NASA’s long-term weather records for this place.</p> : null
  }
  if (place.historyStatus !== 'ok' || !h) return null
  const today = historySentence(place)
  const trend = trendSentence(place)
  if (!today && !trend) return null

  return <section aria-labelledby="nasa-record" className="mt-5">
    <h2 id="nasa-record" className="text-[19px] font-semibold">Compared with {h.period.years} years of NASA records</h2>
    {today && <p className="mt-1.5 text-[17px] leading-[1.45]">{today}</p>}
    {trend && <p className="mt-1 text-[17px] leading-[1.45]">{trend}</p>}
    {example && <p className="mt-1.5 text-[15px] leading-[1.45] text-mute">
      {/^mid-/i.test(h.window.label) ? `This example is set in ${h.window.label}, and today’s high is made up.` : 'Today’s high is made up for this example.'} The {h.period.years}-year record is real NASA data.
    </p>}
    <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)}
      className="mt-2 inline-flex min-h-10 items-center rounded-md border border-edge bg-white px-3 text-[15px] font-semibold hover:bg-ink-800">
      {open ? 'Hide how we tested this' : 'How we tested this'}
    </button>
    {open && <div className="fade-in mt-3 space-y-3 text-[16px] leading-[1.5]">
      {recordDetails(place).map((d) => <div key={d.title}>
        <h3 className="font-semibold">{d.title}</h3>
        <p className="mt-0.5">{d.text}</p>
      </div>)}
      <p>These tests describe the weather record. They do not feed the fire risk score.</p>
      <p>
        <Link to="/about#trend" className="text-action underline underline-offset-2 hover:text-action-deep">How these tests work</Link>
      </p>
    </div>}
  </section>
}
