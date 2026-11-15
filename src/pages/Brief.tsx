// Situation brief: a one-page, printable summary of the early warning for the
// selected region, addressed to fire and emergency management agencies and to
// community leadership. Every sentence is generated from the data on screen.
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { CommunityExposure, Region, RegionAir, RegionRisk, SourceMeta } from '../../shared/types.ts'
import { LEVEL_COLORS } from '../../shared/risk.ts'
import { SIGNS_NOTE, warningSigns, type WarningSign } from '../../shared/signals.ts'
import { aqiBand } from '../../shared/aqi.ts'
import type { ApiState } from '../api.ts'
import { useApi } from '../api.ts'
import { useApp } from '../state.tsx'
import { ACTIONS, DISCLAIMER, FOCUS, dayLabel, summarize, type Summary } from '../actions.ts'
import { SignList } from '../components/Signals.tsx'
import { Async, KIND, Sources, fmt, fmtTime } from '../components/ui.tsx'

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

function Section({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return <section className="mt-10 border-t border-line pt-5 print:mt-7 print:pt-4">
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 break-after-avoid">
      <h2 className="font-display condensed text-[23px] leading-tight font-semibold print:text-[19px]">{title}</h2>
      {aside && <p className="text-[13px] text-mute">{aside}</p>}
    </div>
    <div className="mt-3">{children}</div>
  </section>
}

function Figure({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return <div className="min-w-0">
    <dt className="text-[12.5px] text-mute">{label}</dt>
    <dd className="mt-1 text-[22px] leading-none font-semibold print:text-[18px]">{children}</dd>
    {hint && <dd className="mt-1 text-[12px] text-dim">{hint}</dd>}
  </div>
}

function AqiCell({ aqi }: { aqi: number | null }) {
  const b = aqiBand(aqi)
  if (!b) return <span className="num text-dim">—</span>
  return <span className="inline-flex items-baseline gap-1.5"><span className="h-2 w-2 shrink-0 translate-y-[-1px] self-center rounded-full" style={{ background: b.color }} aria-hidden /><span className="num font-medium">{aqi}</span><span className="text-mute">{b.label}</span></span>
}

export default function Brief() {
  const { region, mode } = useApp()
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

  // Same look as ButtonLink in ui.tsx (these are <button>s, so they cannot use it directly).
  const btn = 'inline-flex min-h-11 items-center justify-center rounded-md px-5 text-[15px] font-semibold whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-50'

  return <div className="fade-in md:rounded-2xl md:bg-ink-900 md:px-6 md:py-7 lg:px-8 lg:py-8 print:rounded-none print:bg-transparent print:p-0">
    <style>{PRINT_CSS}</style>

    <div className="mx-auto mb-5 flex max-w-[880px] flex-wrap items-center justify-between gap-3 print:hidden">
      <Link to="/risk" className="text-[13.5px] text-mute underline decoration-line underline-offset-4 hover:text-fg">Back to early warning</Link>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={onCopy} disabled={!ready} className={`${btn} min-w-[140px] border border-edge bg-ink-950 text-fg hover:border-fg`}>{copy === 'copied' ? 'Copied' : 'Copy as text'}</button>
        <button type="button" onClick={() => window.print()} disabled={!ready} className={`${btn} bg-ember-deep text-white hover:bg-[#a63f12]`}>Print brief</button>
      </div>
      <p role="status" aria-live="polite" className={copy === 'failed' ? 'w-full text-[13px] text-flame sm:text-right' : 'sr-only'}>
        {copy === 'failed' ? 'Copy did not work: this browser blocked clipboard access. Select the text below, or use Print brief to save a PDF.' : copy === 'copied' ? 'Brief copied as plain text.' : ''}
      </p>
    </div>

    <article className="mx-auto max-w-[880px] bg-ink-950 md:rounded-xl md:border md:border-line md:px-10 md:py-10 lg:px-14 lg:py-12 md:shadow-[0_1px_2px_rgb(19_33_27/0.04),0_12px_32px_-12px_rgb(19_33_27/0.12)] print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none">
      <Async state={view} height={640}>{(r) => {
        const sm = s!
        const c = LEVEL_COLORS[r.today.level]
        const aqi = airHere?.now.usAqi ?? null, band = aqiBand(aqi)
        return <>
          <header>
            <div className="flex flex-wrap items-center justify-between gap-2 text-[12.5px] text-mute">
              <span className="font-semibold text-fg">Before the Smoke</span>
              <span>Early warning prototype, NASA Space Apps Challenge 2026</span>
            </div>
            <h1 className="mt-5 font-display condensed text-[36px] leading-[1.02] font-semibold tracking-[-0.01em] md:text-[48px] print:text-[34px]">Situation brief: {r.region.name}</h1>
            <dl className="mt-5 grid grid-cols-[88px_1fr] gap-x-4 gap-y-1.5 text-[13.5px]">
              <dt className="text-mute">Generated</dt><dd className="num">{stamp(generated)}</dd>
              <dt className="text-mute">Data</dt><dd>{simulated ? 'Simulated scenario' : 'Live data from the sources listed at the end'}</dd>
              <dt className="text-mute">For</dt><dd>{FOR_WHOM}</dd>
            </dl>
            {simulated && <p className="mt-5 rounded-lg border-2 border-sun bg-sun/8 px-4 py-3 text-[15px] font-semibold text-sun">
              Simulated scenario: not real conditions. <span className="font-normal">Every figure in this brief is invented for demonstration.</span>
            </p>}
          </header>

          <Section title="Bottom line">
            <p className="border-l-4 pl-4 text-[19px] leading-snug font-medium md:text-[23px] print:text-[17px]" style={{ borderColor: LEVEL_COLORS[sm.guidance] }}>{sm.bottomLine}</p>
            <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-5 md:grid-cols-4 print:grid-cols-4">
              <Figure label="Risk index today" hint="0–100, relative"><span aria-hidden className="mr-2 inline-block h-3 w-3 rounded-[3px] align-[2px]" style={{ background: c }} /><span className="num">{r.today.score}</span> <span className="text-[16px] font-medium text-mute">{r.today.level}</span></Figure>
              <Figure label="Warning signs active"><span className="num">{sm.activeSigns}</span><span className="text-[16px] text-mute"> of {signs.length}</span></Figure>
              <Figure label="Satellite detections" hint="Within 100 km, last 24 hours"><span className="num">{r.hotspots100km}</span></Figure>
              <Figure label="US AQI now" hint={band ? band.label : 'Not available'}><span className="num">{aqi ?? '—'}</span></Figure>
            </dl>
            {sm.ahead.length > 0 && <div className="mt-6">
              <p className="text-[12.5px] text-mute">Risk index, today and the next {sm.ahead.length * 24} hours</p>
              <ol className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4 print:grid-cols-4">
                {[{ date: r.timeline.find((t) => t.kind === 'today')?.date ?? '', score: r.today.score, level: r.today.level, today: true }, ...sm.ahead.map((d) => ({ ...d, today: false }))].map((d) =>
                  <li key={d.date || 'today'} className="rounded-md border border-line px-3 py-2 break-inside-avoid" style={{ borderLeft: `4px solid ${LEVEL_COLORS[d.level]}` }}>
                    <p className="text-[12.5px] text-mute">{d.today ? 'Today' : cap(dayLabel(d.date, sm.todayIso))}</p>
                    <p className="mt-0.5"><span className="num text-[18px] font-semibold">{d.score}</span> <span className="text-[13px] font-medium text-mute">{d.level}</span></p>
                  </li>)}
              </ol>
            </div>}
          </Section>

          <Section title="Warning signs" aside={`${sm.activeSigns} of ${signs.length} active`}>
            {sm.building && <p className="mb-3 text-[14px]">{sm.building}</p>}
            <SignList signs={signs} compact />
            {!airHere && <p className="mt-3 text-[12.5px] text-mute">Air quality data could not be loaded, so the smoke sign is not included.</p>}
            <p className="mt-3 text-[12px] text-dim">{SIGNS_NOTE}</p>
          </Section>

          <Section title="Communities in this region">
            <Async state={communities} height={200} empty={() => (comms && comms.length === 0 ? 'No communities in this region are in the demonstration list.' : null)}>{() => <>
              <div className="-mx-1 overflow-x-auto px-1 print:mx-0 print:overflow-visible print:px-0">
                <table className="w-full min-w-[560px] text-[13px] print:min-w-0 print:text-[11.5px]">
                  <thead><tr className="border-b border-line text-left text-[12px] text-mute">
                    <th className="py-2 pr-4 font-normal">Community</th>
                    <th className="py-2 pr-4 text-right font-normal">Nearest active fire</th>
                    <th className="py-2 pr-4 text-right font-normal">Detections within 100 km</th>
                    <th className="py-2 pr-4 text-right font-normal">PM2.5 µg/m³</th>
                    <th className="py-2 font-normal">US AQI</th>
                  </tr></thead>
                  <tbody>{(comms ?? []).map((x) => <tr key={x.id} className="border-b border-line/70 align-top break-inside-avoid">
                    <td className="py-2 pr-4"><span className="font-medium">{x.name}</span><span className="block text-[12px] text-dim">{x.kind}</span></td>
                    <td className="num py-2 pr-4 text-right">{x.nearestFireKm == null ? '—' : `${x.nearestFireKm} km`}</td>
                    <td className="num py-2 pr-4 text-right">{x.hotspots100km}</td>
                    <td className="num py-2 pr-4 text-right">{fmt(x.pm25, 1)}</td>
                    <td className="py-2"><AqiCell aqi={x.usAqi} /></td>
                  </tr>)}</tbody>
                </table>
              </div>
            </>}</Async>
            <p className="mt-3 text-[12.5px] leading-relaxed text-mute">{COMMUNITY_NOTE}</p>
          </Section>

          <Section title="Recommended actions before ignition">
            <p className="text-[14px] leading-relaxed text-mute">{guidanceNote(r, sm)}</p>
            <div className="mt-5 grid gap-x-10 gap-y-6 md:grid-cols-2 print:grid-cols-2">
              <div className="break-inside-avoid">
                <h3 className="text-[15px] font-semibold">For fire and emergency management agencies</h3>
                <ol className="mt-2.5 space-y-2.5 text-[13.5px] leading-relaxed print:text-[12px]">
                  {ACTIONS[sm.guidance].agency.map((a, i) => <li key={a} className="flex gap-3"><span className="num mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white" style={{ background: LEVEL_COLORS[sm.guidance] }}>{i + 1}</span>{a}</li>)}
                </ol>
              </div>
              <div className="break-inside-avoid">
                <h3 className="text-[15px] font-semibold">For community leadership to consider</h3>
                <p className="mt-0.5 text-[12.5px] text-mute">Prompts for discussion, not instructions. Each community decides what applies.</p>
                <ul className="mt-2.5 space-y-2.5 text-[13.5px] leading-relaxed print:text-[12px]">
                  {ACTIONS[sm.guidance].community.map((a) => <li key={a} className="flex gap-3"><span className="mt-[8px] h-1.5 w-1.5 shrink-0 rounded-full bg-mute" />{a}</li>)}
                </ul>
              </div>
            </div>
          </Section>

          <Section title="Sources and caveats">
            <Sources sources={sources} />
            <ul className="mt-4 space-y-1.5 text-[12.5px] leading-relaxed text-mute">
              {simulated && <li className="font-medium text-sun">Every figure in this brief comes from a simulated scenario invented for demonstration. It does not describe real conditions.</li>}
              <li>{DISCLAIMER}</li>
              <li>{INDEX_NOTE}</li>
              <li>{SIGNS_NOTE}</li>
              {!simulated && <li>Smoke and air quality figures are model estimates, not ground monitor readings.</li>}
            </ul>
          </Section>
        </>
      }}</Async>
    </article>
  </div>
}
