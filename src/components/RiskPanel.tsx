import { useState } from 'react'
import { Link } from 'react-router-dom'
import { HORIZONS } from '../../shared/horizon.ts'
import type { RankedPlace } from '../../server/ranked.ts'
import { useApi } from '../api.ts'
import { useApp } from '../state.tsx'
import FindCommunity from './FindCommunity.tsx'
import { horizonWords, nextWords } from './HorizonSelector.tsx'
import { LevelTag, placeName } from './ui.tsx'

// The home panel (docs/design/critique-and-direction.md §3.1, §3.2): find your community, then the
// communities with the highest expected fire risk over the look-ahead. Everything about one place
// (status, warning signs, what to do, who to ask) lives on the community view, /c/:id.

const SHORT = 6
const LONG = 20

const dayDiff = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00`) - Date.parse(`${a}T12:00:00`)) / 86400000)

/** "tomorrow", "Sunday", or "Monday 23 November" when it is a week or more away (a weekday alone would be ambiguous). */
function whenWords(today: string, date: string): string {
  const n = dayDiff(today, date)
  const d = new Date(`${date}T12:00:00`)
  if (n === 1) return 'tomorrow'
  if (n < 7) return d.toLocaleDateString('en-CA', { weekday: 'long' })
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
}

/** One square segmented control, the only look-ahead control on the home screen. */
function LookAhead() {
  const { horizon, setHorizon } = useApp()
  return <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
    <span id="look-ahead-label" className="text-[15px] text-mute">Look ahead</span>
    <div role="group" aria-labelledby="look-ahead-label" className="inline-flex overflow-hidden rounded-md border border-edge">
      {HORIZONS.map((d, i) => <button key={d} type="button" aria-pressed={horizon === d} onClick={() => setHorizon(d)}
        className={`h-10 px-2.5 text-[15px] whitespace-nowrap ${i ? 'border-l border-edge' : ''} ${horizon === d ? 'bg-fg font-semibold text-white' : 'bg-white text-fg hover:bg-ink-850'}`}>
        {horizonWords(d)}
      </button>)}
    </div>
  </div>
}

function Row({ r }: { r: RankedPlace }) {
  const later = r.peakLevelFrom > r.todayDate
  return <li className="border-t border-line">
    <Link to={`/c/${encodeURIComponent(r.id)}`} className="-mx-4 block px-4 py-2 hover:bg-ink-900 focus-visible:bg-ink-900 md:-mx-6 md:px-6">
      <span className="block text-[17px] leading-snug font-semibold text-fg">{r.name}</span>
      <span className="mt-0.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[16px] leading-snug">
        <span className="text-[15px] text-mute">{placeName(r.province)}</span>
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
          <LevelTag level={r.peakLevel} size="sm" />
          {later && <span>from {whenWords(r.todayDate, r.peakLevelFrom)}</span>}
        </span>
      </span>
    </Link>
  </li>
}

function RankedList() {
  const { horizon } = useApp()
  // One request for the longer list; "Show the top 20" only reveals more rows, so nothing reloads.
  const ranked = useApi<RankedPlace[]>(`places/ranked?limit=${LONG}`)
  const [all, setAll] = useState(false)
  const rows = ranked.data ?? []
  const shown = all ? rows : rows.slice(0, SHORT)

  return <section aria-labelledby="ranked-head" className="mt-7">
    <h2 id="ranked-head" className="text-[19px] leading-snug font-semibold">Highest fire risk, {nextWords(horizon).replace(/^the /, '')}</h2>
    <div className="mt-3"><LookAhead /></div>

    {ranked.error && !ranked.loading ? <div role="alert" className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
      <p className="text-[17px]">Couldn't load the list. Try again.</p>
      <button type="button" onClick={ranked.reload} className="h-10 rounded-md border border-edge bg-white px-4 text-[16px] font-semibold text-fg hover:bg-ink-850">Try again</button>
    </div>
      : !ranked.data ? <ul aria-label="Loading the list" className="mt-3">
        {Array.from({ length: SHORT }, (_, i) => <li key={i} className="border-t border-line py-3">
          <div className="skeleton h-[18px] w-3/4" /><div className="skeleton mt-2 h-[16px] w-1/2" />
        </li>)}
      </ul>
        : <>
          <ul aria-busy={ranked.loading} className={`mt-3 border-b border-line transition-opacity ${ranked.loading ? 'opacity-60' : ''}`}>
            {shown.map((r) => <Row key={r.id} r={r} />)}
          </ul>
          {rows.length > SHORT && <button type="button" aria-expanded={all} onClick={() => setAll((v) => !v)}
            className="mt-1 h-9 rounded-md px-1 text-[16px] font-semibold text-action underline underline-offset-2 hover:text-action-deep">
            {all ? 'Show fewer' : `Show the top ${rows.length}`}
          </button>}
        </>}
  </section>
}

/** Home panel: Find your community + Highest fire risk. */
export default function HomePanel() {
  return <div className="flex min-h-full flex-col px-4 pt-5 pb-5 text-fg md:px-6">
    <h1 className="text-[26px] leading-tight font-semibold">Find your community</h1>
    <p className="mt-2 text-[17px] leading-normal">See the fire risk for the next few days, what you can do, and who to ask for help.</p>
    <div className="mt-4"><FindCommunity /></div>
    <RankedList />
    {/* TODO: link the provincial fire danger rating here once the contacts data provides the official URLs. */}
    <p className="mt-6 text-[15px] text-mute md:mt-auto md:pt-4">Our estimate, not an official fire danger rating.</p>
  </div>
}
