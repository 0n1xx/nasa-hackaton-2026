// Situation brief: a one-page, printable summary of the early warning for the
// selected region, addressed to fire and emergency management agencies and to
// community leadership. Every sentence is generated from the data on screen.
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { CommunityExposure, Region, RegionAir, RegionRisk, SourceMeta } from '../../shared/types.ts'
import { LEVEL_COLORS } from '../../shared/risk.ts'
import { SIGNS_NOTE, warningSigns, type WarningSign } from '../../shared/signals.ts'
import { aqiBand } from '../../shared/aqi.ts'
import type { ApiState } from '../api.ts'
import { useApi } from '../api.ts'
import { useApp } from '../state.tsx'
import { ACTIONS, DISCLAIMER, FOCUS, LEVEL_RANK, dayLabel, summarize, type Summary } from '../actions.ts'
import { Async, KIND, fmt, fmtTime } from '../components/ui.tsx'

// The app shell scrolls inside <main> at full viewport height, which would clip a
// printout to one page. While the brief is mounted, let the page flow for print.
const PRINT_CSS = `@media print {
  @page { margin: 14mm 13mm; }
  html, body, #root, #root > div { height: auto !important; overflow: visible !important; display: block !important; }
  main { height: auto !important; overflow: visible !important; }
  main > div { max-width: none !important; padding: 0 !important; }
  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .fade-in { animation: none !important; }
}`

const FOR_WHOM = 'Fire and emergency management agencies, and community leadership'
const COMMUNITY_NOTE = 'Locations are public and rounded, from a small demonstration list assembled without community involvement. Distance is not danger: wind, terrain, water and local knowledge decide that. This brief does not speak for any community; each community’s leadership decides what applies to them.'
const INDEX_NOTE = 'The index is a relative score. It is not a probability, and it does not predict where or when a fire will start.'

const stamp = (d: Date) => d.toLocaleString('en-CA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })
const dedupe = (xs: SourceMeta[]) => xs.filter((s, i) => xs.findIndex((x) => x.id === s.id) === i)

const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1)

function guidanceNote(r: RegionRisk, s: Summary) {
  const why = s.guidanceDay
    ? `Guidance for ${s.guidance} risk: the level forecast for ${dayLabel(s.guidanceDay.date, s.todayIso)}, higher than today’s ${r.today.level}.`
    : `Guidance for ${s.guidance} risk, today’s level.`
  return `${why} ${FOCUS[s.guidance]}`
}

/** A clean plain-text version of the brief, for pasting into email, chat or a briefing note. */
function briefText(o: { region: Region; generated: Date; simulated: boolean; r: RegionRisk; air: RegionAir | null; s: Summary; signs: WarningSign[]; comms: CommunityExposure[] | null; sources: SourceMeta[] }) {
  const { r, s } = o
  const band = aqiBand(o.air?.now.usAqi)
  const L: string[] = [
    `Situation brief: ${o.region.name}`,
    `Generated ${stamp(o.generated)}`,
    `Data: ${o.simulated ? 'Simulated scenario: not real conditions. Every figure in this brief is invented for demonstration.' : 'Live data from the sources listed below.'}`,
    `For: ${FOR_WHOM}`,
    '',
    'Bottom line',
    s.bottomLine,
    `Risk index today: ${r.today.score} (${r.today.level})`,
  ]
  if (s.ahead.length) L.push(`Next ${s.ahead.length * 24} hours: ${s.ahead.map((d) => `${cap(dayLabel(d.date, s.todayIso))} ${d.score} (${d.level})`).join(', ')}`)
  L.push(`Satellite fire detections within 100 km, last 24 hours: ${r.hotspots100km}`)
  L.push(`US AQI now: ${o.air?.now.usAqi != null ? `${o.air.now.usAqi}${band ? ` (${band.label})` : ''}` : 'not available'}`)

  L.push('', `Warning signs: ${s.activeSigns} of ${o.signs.length} active`)
  o.signs.forEach((x) => L.push(`- ${x.active ? 'Active' : 'Clear'}. ${x.label}: ${x.value}. ${x.detail}`))
  if (s.building) L.push(s.building)
  if (!o.air) L.push('Air quality data could not be loaded, so the smoke sign is not included.')

  L.push('', 'Communities in this region')
  if (o.comms == null) L.push('Community exposure data could not be loaded.')
  else if (!o.comms.length) L.push('No communities in this region are in the demonstration list.')
  else o.comms.forEach((c) => { const b = aqiBand(c.usAqi)
    L.push(`- ${c.name}: nearest active fire ${c.nearestFireKm == null ? 'not available' : `${c.nearestFireKm} km`}; ${c.hotspots100km} satellite detection${c.hotspots100km === 1 ? '' : 's'} within 100 km; PM2.5 ${fmt(c.pm25, 1)} µg/m³; US AQI ${c.usAqi ?? '—'}${b ? ` (${b.label})` : ''}`) })
  L.push(COMMUNITY_NOTE)

  L.push('', 'Recommended actions before ignition', guidanceNote(r, s), '', 'For fire and emergency management agencies:')
  ACTIONS[s.guidance].agency.forEach((a, i) => L.push(`${i + 1}. ${a}`))
  L.push('', 'For community leadership to consider (prompts for discussion, not instructions):')
  ACTIONS[s.guidance].community.forEach((a) => L.push(`- ${a}`))

  L.push('', 'Sources')
  o.sources.forEach((x) => L.push(`- ${x.label} (${KIND[x.kind].label}), retrieved ${fmtTime(x.fetchedAt)}${x.url ? `: ${x.url}` : ''}`))
  L.push('', 'Caveats')
  if (o.simulated) L.push('- Every figure in this brief comes from a simulated scenario invented for demonstration. It does not describe real conditions.')
  L.push(`- ${DISCLAIMER}`, `- ${INDEX_NOTE}`, `- ${SIGNS_NOTE}`)
  if (!o.simulated) L.push('- Smoke and air quality figures are model estimates, not ground monitor readings.')
  return L.join('\n')
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); return true }
  } catch { /* blocked or not a secure origin: try the older route */ }
  try {
    const ta = document.createElement('textarea')
    ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0'
    document.body.appendChild(ta); ta.select()
    const ok = document.execCommand('copy')
    ta.remove()
    return ok
  } catch { return false }
}

const shortStamp = (d: Date) => d.toLocaleString('en-CA', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })

export default function Brief() {
  const { region, mode, horizon } = useApp()
  const risk = useApi<RegionRisk>(region ? `risk/${region.id}` : null)
  const air = useApi<RegionAir>(region ? `air/${region.id}?pastDays=7` : null)
  const communities = useApi<CommunityExposure[]>('communities')
  const [copy, setCopy] = useState<'idle' | 'copied' | 'failed'>('idle')
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])

  // A brief never shows stale numbers: wait until risk and air are loaded for THIS region and mode.
  const r = !risk.loading && risk.data?.region.id === region?.id ? risk.data : null
  const airHere = !air.loading && air.data?.region.id === region?.id ? air.data : null
  const airSettled = !air.loading && (airHere != null || air.error != null)
  const ready = r != null && airSettled
  const view: ApiState<RegionRisk> = { ...risk, data: ready ? r : null, loading: !ready && !risk.error }

  const signs = useMemo(() => (ready && r ? warningSigns(r, airHere) : []), [ready, r, airHere])
  const s = useMemo(() => (r ? summarize(r, signs) : null), [r, signs])
  // Listed alphabetically: the brief does not rank communities.
  const comms = useMemo(() => communities.data ? communities.data.filter((c) => c.regionId === region?.id).sort((a, b) => a.name.localeCompare(b.name)) : null, [communities.data, region])
  const sources = useMemo(() => dedupe([...risk.sources, ...air.sources, ...communities.sources]), [risk.sources, air.sources, communities.sources])
  const simulated = mode === 'sim' || sources.some((x) => x.kind === 'simulated')
  // Stamped when the data arrives, and reused in the copied text.
  const generated = useMemo(() => new Date(), [r, airHere, communities.data])

  // Name the printout / saved PDF after the brief.
  useEffect(() => {
    if (!region) return
    const before = document.title
    document.title = `Situation brief: ${region.name}`
    return () => { document.title = before }
  }, [region])

  async function onCopy() {
    if (!ready || !r || !s || !region) return
    const ok = await copyToClipboard(briefText({ region, generated, simulated, r, air: airHere, s, signs, comms, sources }))
    setCopy(ok ? 'copied' : 'failed')
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setCopy('idle'), ok ? 2000 : 6000)
  }

  const btn = 'inline-flex min-h-10 items-center justify-center rounded-md px-4 text-[14px] font-semibold whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-50'
  const h2 = 'font-display condensed text-[20px] leading-tight font-semibold print:text-[17px]'

  return <div className="fade-in mx-auto max-w-[760px] bg-ink-950 px-4 py-8 md:px-0 md:py-12 print:max-w-none print:p-0">
    <style>{PRINT_CSS}</style>

    <div className="mb-12 flex flex-wrap items-center justify-between gap-3 print:hidden">
      <Link to="/" className="text-[14px] text-mute hover:text-fg">← Back to map</Link>
      <div className="flex items-center gap-2">
        <button type="button" onClick={onCopy} disabled={!ready} className={`${btn} min-w-[112px] border border-line text-fg hover:border-fg`}>{copy === 'copied' ? 'Copied' : 'Copy text'}</button>
        <button type="button" onClick={() => window.print()} disabled={!ready} className={`${btn} bg-fg text-white hover:opacity-90`}>Print</button>
      </div>
      <p role="status" aria-live="polite" className={copy === 'failed' ? 'w-full text-[13px] text-flame sm:text-right' : 'sr-only'}>
        {copy === 'failed' ? 'Copy did not work: this browser blocked clipboard access. Use Print to save a PDF.' : copy === 'copied' ? 'Brief copied as plain text.' : ''}
      </p>
    </div>

    <article>
      <Async state={view} height={640}>{(r) => {
        const sm = s!
        const peak = sm.ahead.length ? sm.ahead.reduce((a, b) => (LEVEL_RANK[b.level] > LEVEL_RANK[a.level] ? b : a)) : null
        const active = signs.filter((x) => x.active)
        return <>
          <header className="border-b border-line pb-8">
            <h1 className="font-display condensed text-[40px] leading-none font-semibold tracking-[-0.01em] md:text-[44px] print:text-[34px]">Situation brief</h1>
            <p className="mt-3 text-[15px] text-mute">{r.region.name} · <span className="num">{shortStamp(generated)}</span></p>
            {simulated && <p className="mt-2 text-[13px] font-medium text-sun">Simulated scenario, not real conditions.</p>}
          </header>

          <p className="mt-10 text-[21px] leading-snug font-medium md:text-[24px] print:mt-7 print:text-[18px]">{sm.bottomLine}</p>

          <dl className="mt-10 grid grid-cols-3 gap-6 print:mt-7">
            <div>
              <dt className="text-[13px] text-mute">Risk today</dt>
              <dd className="mt-2 leading-none font-semibold" style={{ color: LEVEL_COLORS[r.today.level] }}><span className="num text-[34px] md:text-[44px]">{r.today.score}</span> <span className="text-[15px] md:text-[18px]">{r.today.level}</span></dd>
            </div>
            <div>
              <dt className="text-[13px] text-mute">Next {horizon} day{horizon === 1 ? '' : 's'}</dt>
              <dd className="mt-2 text-[28px] leading-none font-semibold md:text-[44px]" style={peak ? { color: LEVEL_COLORS[peak.level] } : undefined}>{peak ? peak.level : '—'}</dd>
            </div>
            <div>
              <dt className="text-[13px] text-mute">Warning signs</dt>
              <dd className="mt-2 leading-none font-semibold"><span className="num text-[34px] md:text-[44px]">{sm.activeSigns}</span><span className="text-[15px] text-mute md:text-[18px]"> of {signs.length}</span></dd>
            </div>
          </dl>

          <div className="mt-12 grid gap-x-12 gap-y-10 md:grid-cols-2 print:mt-8 print:grid-cols-2">
            <section className="break-inside-avoid">
              <h2 className={h2}>Warning signs</h2>
              {active.length
                ? <ul className="mt-3 space-y-2 text-[15px] print:text-[13px]">
                    {active.map((x) => <li key={x.key} className="flex items-baseline justify-between gap-4"><span>{x.label}</span><span className="num shrink-0 text-right text-mute">{x.value}</span></li>)}
                  </ul>
                : <p className="mt-3 text-[15px] text-mute">None active.</p>}
            </section>

            <section className="break-inside-avoid">
              <h2 className={h2}>Communities</h2>
              <Async state={communities} height={120} empty={() => (comms && comms.length === 0 ? 'No communities in this region are in the list.' : null)}>{() =>
                <ul className="mt-3 space-y-2 text-[15px] print:text-[13px]">
                  {(comms ?? []).map((x) => <li key={x.id} className="flex items-baseline justify-between gap-4"><span>{x.name}</span><span className="num shrink-0 text-right text-mute">{x.nearestFireKm == null ? '—' : `${x.nearestFireKm} km from fire`}</span></li>)}
                </ul>}</Async>
              <p className="mt-3 text-[12.5px] text-dim">Public locations only. We do not speak for any community.</p>
            </section>
          </div>

          <section className="mt-12 break-inside-avoid print:mt-8">
            <h2 className={h2}>Move before ignition</h2>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-[15px] leading-relaxed marker:text-mute print:text-[13px]">
              {ACTIONS[sm.guidance].agency.slice(0, 4).map((a) => <li key={a} className="pl-1">{a}</li>)}
            </ol>
          </section>

          <p className="mt-14 text-[12px] leading-relaxed text-mute print:mt-8">
            Risk index is an unvalidated prototype, not a probability. Data: NASA GIBS, NASA POWER, CWFIS, Open-Meteo.{simulated && ' Simulated scenario.'}
          </p>
        </>
      }}</Async>
    </article>
  </div>
}
