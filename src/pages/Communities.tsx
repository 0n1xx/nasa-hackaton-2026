import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { CommunityExposure, RegionAir, RegionRisk, SourceMeta } from '../../shared/types.ts'
import { useApi } from '../api.ts'
import { useApp } from '../state.tsx'
import { ACTIONS } from '../actions.ts'
import { NASA_DATE, NASA_LABEL } from '../components/MapView.tsx'
import { AqiPill, Async, Btn, ButtonLink, PageHead, Panel, RiskPill, Sources, Stat, chartAxis, chartGrid, fmt, tooltipStyle } from '../components/ui.tsx'

type SortKey = 'name' | 'nearestFireKm' | 'pm25' | 'hotspots100km'

// Only statistics from the verified table in docs/API_REQUIREMENTS.md ("Reference statistics") are quoted on this page.
const EVAC_SOURCE = { label: 'Dr. Amy Cardinal Christianson, Métis fire research scientist, reported by Global News and the Associated Press (2023), from the Canadian Wildland Fire Evacuation Database, 1980–2021', url: 'https://globalnews.ca/news/9918749/indigenous-vulnerable-wildfires-evacuations' }
const REPEAT_SOURCE = { label: 'Associated Press, July 2023, citing the same database analysis', url: 'https://www.claimsjournal.com/news/international/2023/07/20/318170.htm' }

const PRINCIPLES: [string, string][] = [
  ['Communities decide.', 'Each Nation has its own governance, knowledge and priorities. Nothing here ranks communities or tells anyone what to do.'],
  ['Not one experience.', 'A road-access community beside a city and a fly-in community 500 km north face different realities. Figures are shown per community, never as a single “Indigenous” average.'],
  ['Data sovereignty.', 'Only general locations already on public maps are used. A real deployment should follow the First Nations principles of OCAP® (ownership, control, access, possession) and Métis and Inuit data governance, with communities holding their own data.'],
  ['Staying is legitimate.', 'Ties to territory are ancestral, cultural and spiritual. The aim is earlier warning and better resourcing so that leaving is a last resort chosen by the community.'],
]

const COLS: [SortKey, string, 'ascending' | 'descending'][] = [
  ['name', 'Community', 'ascending'], ['nearestFireKm', 'Nearest active fire', 'ascending'], ['hotspots100km', 'Detections ≤100 km', 'descending'], ['pm25', 'PM2.5 µg/m³', 'descending'],
]
// First column stays put while the table scrolls sideways on a phone.
const STICKY = 'sticky left-0 z-[1] bg-ink-950 w-[10.5rem] min-w-[10.5rem] max-w-[10.5rem] max-md:shadow-[inset_-1px_0_0_var(--color-line)] md:w-auto md:min-w-[15rem] md:max-w-none'

const linkCls = 'text-mute underline decoration-line underline-offset-2 hover:text-sky'
const uniq = (s: SourceMeta[]) => s.filter((x, i) => s.findIndex((y) => y.id === x.id) === i)

/** One large share with a 0–100 bar, so 5% and 42% read on the same scale. */
function Share({ value, label, color, className = '' }: { value: number; label: string; color: string; className?: string }) {
  return <div className={`min-w-0 py-6 ${className}`}>
    <p className="font-display condensed num text-[88px] leading-[0.82] font-semibold tracking-[-0.01em] md:text-[120px]" style={{ color }}>{value}%</p>
    <p className="mt-3 max-w-sm text-[15px] leading-snug">{label}</p>
    <div className="mt-4 h-2.5 w-full max-w-md overflow-hidden rounded-full bg-ink-800" role="img" aria-label={`${value} out of 100`}>
      <div className="h-full rounded-full" style={{ width: `${value}%`, background: color }} />
    </div>
  </div>
}

export default function Communities() {
  const { region, regions, setRegionId } = useApp()
  const communities = useApi<CommunityExposure[]>('communities')
  const tbRisk = useApi<RegionRisk>('risk/thunder-bay')
  const tbAir = useApi<RegionAir>('air/thunder-bay?pastDays=7')
  const [scope, setScope] = useState<'region' | 'all'>('all')
  const [sort, setSort] = useState<SortKey>('nearestFireKm')

  const rows = useMemo(() => {
    const list = (communities.data ?? []).filter((c) => scope === 'all' || c.regionId === region?.id)
    return [...list].sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name) : sort === 'nearestFireKm' ? (a.nearestFireKm ?? 1e9) - (b.nearestFireKm ?? 1e9) : (b[sort] ?? -1) - (a[sort] ?? -1))
  }, [communities.data, scope, region, sort])

  const byRegion = useMemo(() => regions.map((r) => { const cs = (communities.data ?? []).filter((c) => c.regionId === r.id); const pm = cs.map((c) => c.pm25).filter((v): v is number => v != null)
    return { name: r.short, listed: cs.length, nearFire: cs.filter((c) => c.fires100km > 0).length, smoky: cs.filter((c) => (c.usAqi ?? 0) > 100).length, pm25: pm.length ? +(pm.reduce((a, b) => a + b, 0) / pm.length).toFixed(1) : 0 } }).filter((r) => r.listed > 0), [regions, communities.data])

  const tb = (communities.data ?? []).filter((c) => c.regionId === 'thunder-bay')

  return <>
    <PageHead kicker="Indigenous community impact" title="Who carries the weight of wildfire">
      First Nations and Métis communities live with wildfire and smoke far more often than the rest of Canada, on territories they have cared for since long before fire agencies existed. This page shows geographic exposure from open data. It does not speak for any community.
    </PageHead>
    <div className="space-y-12">
      <section aria-labelledby="evac-h" className="fade-in">
        <h2 id="evac-h" className="text-[16px] font-semibold">Who wildfire evacuations fall on</h2>
        <div className="mt-3 grid grid-cols-1 border-t border-line md:grid-cols-2">
          <Share value={5} label="Indigenous share of Canada’s population" color="var(--color-fg)" className="md:pr-10" />
          <Share value={42} label="Share of wildfire evacuation events, 1980 to 2021, that were in majority-Indigenous communities" color="var(--color-ember)" className="border-t border-line md:border-t-0 md:border-l md:pl-10" />
        </div>
        <p className="border-b border-line pb-4 text-[12.5px] leading-relaxed text-dim">Both figures are approximate. The 42% counts evacuation events, not individual evacuees. Source: <a href={EVAC_SOURCE.url} target="_blank" rel="noreferrer" className={linkCls}>{EVAC_SOURCE.label}</a>.</p>
        <div className="grid grid-cols-1 items-end gap-x-10 gap-y-3 border-b border-line py-6 md:grid-cols-[auto_minmax(0,1fr)]">
          <p className="font-display condensed num text-[64px] leading-[0.82] font-semibold md:text-[84px]">14 of 16</p>
          <div className="min-w-0 max-w-xl">
            <p className="text-[15px] leading-snug">communities evacuated five or more times between 1980 and 2021 were First Nations reserves.</p>
            <p className="mt-1.5 text-[12.5px] text-dim">Source: <a href={REPEAT_SOURCE.url} target="_blank" rel="noreferrer" className={linkCls}>{REPEAT_SOURCE.label}</a>.</p>
          </div>
        </div>
      </section>

      <Panel title="Principles this page follows">
        <ul className="grid gap-x-10 gap-y-3 text-[13.5px] leading-relaxed text-mute md:grid-cols-2">
          {PRINCIPLES.map(([t, d]) => <li key={t}><strong className="font-semibold text-fg">{t}</strong> {d}</li>)}
        </ul>
      </Panel>

      <Panel title="Geographic exposure right now" sub="Distance to reported fires, satellite detections nearby and modelled smoke, for a demonstration set of communities."
        right={<ButtonLink to="/brief" primary>Situation brief</ButtonLink>}>
        <div className="mb-3 flex flex-wrap gap-1.5" role="group" aria-label="Communities shown"><Btn active={scope === 'all'} onClick={() => setScope('all')}>All listed</Btn><Btn active={scope === 'region'} onClick={() => setScope('region')}>{`${region?.short ?? 'Region'} only`}</Btn></div>
        <Async state={communities} height={380} empty={() => (rows.length === 0 ? `No listed communities in ${region?.short}. Choose “All listed”.` : null)}>{() => <>
          <div className="overflow-x-auto" role="region" aria-label="Geographic exposure table" tabIndex={0}>
            <table className="w-full min-w-[760px] border-separate border-spacing-0 text-[13px]">
              <thead><tr className="text-left text-[12.5px] text-mute">
                {COLS.map(([k, l, dir], i) => <th key={k} scope="col" aria-sort={sort === k ? dir : undefined} className={`pr-4 pb-2 align-bottom font-normal ${i === 0 ? STICKY : ''}`}>
                  <button type="button" className={`text-left hover:text-fg ${sort === k ? 'font-semibold text-fg' : ''}`} onClick={() => setSort(k)}>{l}{sort === k && <span aria-hidden> ↓</span>}</button></th>)}
                <th scope="col" className="pr-4 pb-2 align-bottom font-normal">US AQI</th><th scope="col" className="pb-2 align-bottom font-normal">Publicly reported events</th>
              </tr></thead>
              <tbody>{rows.map((c) => <tr key={c.id} className="align-top">
                <th scope="row" className={`${STICKY} border-t border-line py-2.5 pr-3 text-left font-normal`}><span className="block text-fg">{c.name}</span><span className="block text-[12px] text-dim">{c.kind}, {c.province}</span></th>
                <td className={`num border-t border-line py-2.5 pr-4 ${c.nearestFireKm != null && c.nearestFireKm <= 50 ? 'font-medium text-flame' : c.nearestFireKm != null && c.nearestFireKm <= 100 ? 'text-ember' : ''}`}>{c.nearestFireKm == null ? '—' : `${c.nearestFireKm} km`}</td>
                <td className="num border-t border-line py-2.5 pr-4">{c.hotspots100km}</td>
                <td className="num border-t border-line py-2.5 pr-4">{fmt(c.pm25, 1)}</td>
                <td className="border-t border-line py-2.5 pr-4"><AqiPill aqi={c.usAqi} /></td>
                <td className="min-w-[13rem] border-t border-line py-2.5 text-mute">{c.reported.length ? c.reported.join('; ') : <span className="text-dim">none listed</span>}</td></tr>)}</tbody>
            </table>
          </div>
          <p className="mt-3 text-[12.5px] leading-relaxed text-dim">Proximity is not danger: wind, water, terrain and local fire knowledge decide that. “Publicly reported events” come from news coverage and are incomplete; a full record belongs to each community.</p>
          <Sources sources={communities.sources} /></>}</Async>
      </Panel>

      <div className="grid grid-cols-1 gap-x-12 gap-y-10 xl:grid-cols-2">
        <Panel title="Regional patterns" sub="Listed communities with an active fire within 100 km, and with US AQI over 100." className="min-w-0">
          <Async state={communities} height={260}>{() => <><div className="h-[260px]"><ResponsiveContainer><BarChart data={byRegion} margin={{ left: -18, right: 8 }}>
            <CartesianGrid {...chartGrid} /><XAxis dataKey="name" {...chartAxis} interval={0} tick={{ fontSize: 10, fill: '#52615a' }} /><YAxis allowDecimals={false} {...chartAxis} />
            <Tooltip {...tooltipStyle} /><Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="listed" name="Listed" fill="#b7c0ba" radius={[3, 3, 0, 0]} isAnimationActive={false} /><Bar dataKey="nearFire" name="Fire ≤100 km" fill="#d4551f" radius={[3, 3, 0, 0]} isAnimationActive={false} /><Bar dataKey="smoky" name="AQI over 100" fill="#2f6690" radius={[3, 3, 0, 0]} isAnimationActive={false} />
          </BarChart></ResponsiveContainer></div>
          <Sources sources={communities.sources} /></>}</Async>
        </Panel>
        <Panel title="Repeated exposure" sub="What this prototype does not show, and why." className="min-w-0">
          <div className="space-y-3 text-[13.5px] leading-relaxed text-mute">
            <p>The “publicly reported events” column in the table above comes from news coverage only. It is a partial view of the repeated evacuations described at the top of this page.</p>
            <p className="rounded-lg border border-line bg-ink-900 p-3 text-[13px]">Before the Smoke does not publish a community-by-community evacuation count. That record is not open data, and counting evacuations without the community’s account of them would repeat the problem this project is trying to address.</p>
          </div>
        </Panel>
      </div>

      <section className="panel fade-in" aria-labelledby="case-h">
        <p className="label">Case study</p>
        <h2 id="case-h" className="font-display condensed mt-1 text-[30px] leading-[1.05] font-semibold md:text-[38px]">Thunder Bay and Northwestern Ontario</h2>
        <div className="mt-5 grid grid-cols-1 gap-x-12 gap-y-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <div className="min-w-0 space-y-3 text-[14px] leading-relaxed text-mute">
            <p>In mid-July 2026, wildfires in Northwestern Ontario forced evacuation orders for Whitesand, Namaygoosisagagun (Collins), Gull Bay, Lac des Mille Lacs and Lac La Croix First Nations and the town of Armstrong. Homes were destroyed in Collins, a community with no road access whose members left by boat. Neskantaga flew residents out days later.</p>
            <p>Most evacuees headed to Thunder Bay, where hotel rooms ran out; Gull Bay First Nation said some evacuees were sleeping in their cars. In Whitesand, chief and council ordered a full evacuation before the province issued its mandatory order.</p>
            <p className="text-fg">The same pieces of information existed before the orders: heat, dry air, wind, new satellite detections and thickening smoke. Before the Smoke puts them side by side for the region, so a rising index and nearby detections can prompt a call days earlier.</p>
            <div className="flex flex-wrap gap-2.5 pt-1">
              {/* MapView applies the full NASA view (date, layers, Thunder Bay) for this URL. Ember stays on "Situation brief", this screen's one primary action. */}
              <ButtonLink to={`/map?date=${NASA_DATE}`}>{`Show ${NASA_LABEL}`}</ButtonLink>
              <Link to="/risk" onClick={() => setRegionId('thunder-bay')} className="inline-flex min-h-11 items-center justify-center rounded-md border border-edge bg-ink-950 px-5 text-[15px] font-semibold whitespace-nowrap text-fg hover:border-fg">Open today’s early warning</Link>
            </div>
            <p className="text-[12px] text-dim">Sources: The Canadian Press, CP24, CTV News and The Weather Network, July 2026. Event summary only; it is not a full account of what communities experienced.</p>
          </div>

          <div className="min-w-0 space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <h3 className="text-[15px] font-semibold">Today in Thunder Bay District</h3>
              <p className="text-[12.5px] text-dim">Current conditions, not July 2026</p>
            </div>
            <Async state={tbRisk} height={90}>{(r) => <div className="grid grid-cols-2 gap-4 rounded-lg border border-line p-3.5 sm:grid-cols-4">
              <Stat label="Risk index" value={<RiskPill level={r.today.level} score={r.today.score} />} hint={`confidence ${r.today.confidence.toLowerCase()}`} />
              <Stat label="Max temp" value={fmt(r.days.filter((d) => d.kind === 'historical').at(-1)?.tMax, 1)} unit="°C" />
              <Stat label="Min humidity" value={fmt(r.days.filter((d) => d.kind === 'historical').at(-1)?.rhMin)} unit="%" />
              <Stat label="Detections ≤100 km" value={r.hotspots100km} />
            </div>}</Async>
            <Async state={tbAir} height={70}>{(a) => <div className="grid grid-cols-2 gap-4 rounded-lg border border-line p-3.5 sm:grid-cols-4">
              <Stat label="US AQI" value={<AqiPill aqi={a.now.usAqi} />} /><Stat label="PM2.5 now" value={fmt(a.now.pm25, 1)} unit="µg/m³" />
              <Stat label="7-day peak" value={fmt(Math.max(...a.hourly.filter((h) => h.kind === 'model').map((h) => h.pm25 ?? 0)), 0)} unit="µg/m³" />
              <Stat label="3-day outlook" value={fmt(Math.max(...a.hourly.filter((h) => h.kind === 'forecast').map((h) => h.pm25 ?? 0)), 0)} unit="µg/m³ peak" />
            </div>}</Async>
            <div className="rounded-lg border border-line p-3.5"><p className="label mb-2">Listed communities in the district</p>
              {tb.length ? <ul className="space-y-1.5 text-[13px]">{tb.map((c) => <li key={c.id} className="flex flex-wrap justify-between gap-x-3"><span className="min-w-0">{c.name}</span><span className="num text-mute">{c.nearestFireKm == null ? 'no fire reported' : `fire ${c.nearestFireKm} km`}, PM2.5 {fmt(c.pm25, 0)}</span></li>)}</ul>
                : <p className="text-[13px] text-mute">{communities.loading ? 'Loading…' : 'Exposure data unavailable.'}</p>}</div>
            <Async state={tbRisk} height={60}>{(r) => <div className="rounded-lg border border-line p-3.5"><p className="label mb-2">Resources that may be needed at {r.today.level.toLowerCase()} risk</p>
              <ul className="list-disc space-y-1 pl-4 text-[13px] text-mute marker:text-dim">{ACTIONS[r.today.level].agency.slice(0, 3).map((a) => <li key={a}>{a}</li>)}</ul></div>}</Async>
            <Sources sources={uniq([...tbRisk.sources, ...tbAir.sources])} />
          </div>
        </div>
      </section>
    </div>
  </>
}
