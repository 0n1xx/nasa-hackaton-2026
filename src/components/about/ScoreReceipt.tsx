// "A worked example" on /about: one community's fire risk, added up like a shop receipt.
// It always uses the example scenario (no network needed, same numbers every time) and the real
// computation: each line is a factor's contribution from shared/risk.ts computeRisk, via /api/place.
import { useEffect, useState } from 'react'
import type { PlaceReport, RiskFactor } from '../../../shared/types.ts'
import { LevelTag } from '../ui.tsx'

const ID = 'whitesand'
const r1 = (v: number) => Math.round(v * 10) / 10

/** How thirsty the air is, in words: vapour pressure deficit (kPa). */
const thirst = (v: number) => (v >= 2 ? 'very thirsty' : v >= 1 ? 'thirsty' : v >= 0.4 ? 'a little thirsty' : 'damp')

/** Each fact in plain words, and what the raw number was. */
const LINES: Record<string, { label: string; raw: (v: number) => string }> = {
  fwi: { label: 'Canada’s official fire weather reading', raw: (v) => `Fire Weather Index ${r1(v)} at the nearest station` },
  rhMin: { label: 'Dry air', raw: (v) => `humidity fell to ${Math.round(v)}%` },
  precip7d: { label: 'No rain this week', raw: (v) => `${r1(v)} mm of rain in the last 7 days` },
  windMax: { label: 'Wind', raw: (v) => `wind up to ${Math.round(v)} km/h` },
  tMax: { label: 'Heat', raw: (v) => `a high of ${r1(v)} °C` },
  hotspots100km: { label: 'Fire seen by satellites nearby', raw: (v) => `${Math.round(v)} heat spot${Math.round(v) === 1 ? '' : 's'} within 100 km` },
  vpdMax: { label: 'Thirsty air', raw: (v) => `${thirst(v)} (${r1(v)} kPa)` },
  soil: { label: 'Dry ground', raw: (v) => `the top of the ground was ${Math.round(v * 100)}% water` },
  historyIndex: { label: 'This area’s past fires (our rough guess)', raw: (v) => `${Math.round(v * 10)} out of 10` },
}

function Line({ f }: { f: RiskFactor }) {
  const line = LINES[f.key]
  const pts = Math.round(f.contribution)
  return <li className="flex items-baseline justify-between gap-4 border-b border-dotted border-edge py-2 last:border-b-0">
    <span>
      <span className="font-semibold">{line?.label ?? f.label}</span>
      {f.value != null && line && <span className="block text-[15px] text-mute">{line.raw(f.value)}</span>}
    </span>
    <span className="num shrink-0 text-[18px] font-semibold">+{pts}</span>
  </li>
}

export default function ScoreReceipt() {
  const [place, setPlace] = useState<PlaceReport | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    const ctrl = new AbortController()
    fetch(`/api/place/${ID}?mode=sim&days=3`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((env) => setPlace(env.data))
      .catch((e) => { if (e.name !== 'AbortError') setFailed(true) })
    return () => ctrl.abort()
  }, [])

  if (failed) return <p className="mt-4 text-[16px] text-mute">The worked example could not load just now.</p>
  if (!place) return <div className="skeleton mt-4 h-72 max-w-[30rem]" aria-busy="true" />

  const t = place.risk.today
  const adding = t.factors.filter((f) => Math.round(f.contribution) > 0)
  const nothing = t.factors.filter((f) => Math.round(f.contribution) <= 0)
  const day = new Date(`${place.risk.todayDate}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
  const why = (f: RiskFactor) => {
    const line = LINES[f.key]
    if (f.key === 'fwi' && f.value == null) return `${line.label}: the example has none, so the other facts share its points`
    return `${line?.label ?? f.label}${f.value != null && line ? `: ${line.raw(f.value)}` : ''}`
  }

  return <div className="mt-4">
    <div className="max-w-[30rem] rounded-sm border border-fg bg-white px-5 py-4">
      <p className="text-[15px] text-mute">{place.community.name}, {day} (example)</p>
      <ul className="mt-2" aria-label="Points each fact added">
        {adding.map((f) => <Line key={f.key} f={f} />)}
      </ul>
      <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t-2 border-fg pt-3">
        <span className="text-[18px] font-semibold">Total</span>
        <span className="num text-[18px] font-semibold">{t.score} out of 100</span>
      </div>
      <p className="mt-2 flex justify-end"><LevelTag level={t.level} size="md" /></p>
    </div>
    <div className="max-w-[38rem] space-y-2 text-[16px]">
      {nothing.length > 0 && <>
        <p className="mt-3 font-semibold">Added nothing that day:</p>
        <ul className="list-disc space-y-1 pl-5">{nothing.map((f) => <li key={f.key}>{why(f)}.</li>)}</ul>
      </>}
      <p>{t.drying >= 1
        ? 'The air was warm and dry enough to dry things out, so wind and the dry week counted in full. On a cold, damp day they would have counted for little or nothing.'
        : `The air was cool or damp, so wind and the dry week only counted ${Math.round(t.drying * 100)}% of their usual points.`}</p>
      <p className="text-[15px] text-mute">The weather in the example is made up, but the sums are done exactly the way the site does them for every community, every day. Points are rounded, so they may not add up exactly.</p>
    </div>
  </div>
}
