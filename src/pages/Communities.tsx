import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { CommunityExposure, HistoryData, RegionAir, RegionRisk } from '../../shared/types.ts'
import { useApi } from '../api.ts'
import { useApp } from '../state.tsx'
import { ACTIONS } from '../actions.ts'
import { AqiPill, Async, Btn, PageHead, Panel, RiskPill, Sources, Stat, chartAxis, chartGrid, fmt, tooltipStyle } from '../components/ui.tsx'

type SortKey = 'name' | 'nearestFireKm' | 'pm25' | 'hotspots100km'

export default function Communities() {
  const { region, regions, setRegionId } = useApp()
  const communities = useApi<CommunityExposure[]>('communities')
  const history = useApi<HistoryData>('history')
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
    <div className="space-y-10">
      <Async state={history} height={150}>{(h) => <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{h.evacuationFacts.map((f, i) => <article key={i} className="panel fade-in">
        <p className="num text-[30px] leading-none font-medium text-ember">{['42%', '14 of 16', '18.9%', '4.7×'][i]}</p>
        <p className="mt-2 text-[12.5px] leading-relaxed">{f.text}</p>
        <a href={f.url} target="_blank" rel="noreferrer" className="mt-2 block text-[11.5px] text-mute underline decoration-line underline-offset-2 hover:text-sky">{f.source}</a></article>)}</div>}</Async>

      <Panel title="Principles this page follows">
        <ul className="grid gap-x-6 gap-y-2 text-[12.5px] leading-relaxed text-mute md:grid-cols-2">
          {[['Communities decide.', 'Each Nation has its own governance, knowledge and priorities. Nothing here ranks communities or tells anyone what to do.'], ['Not one experience.', 'A road-access community beside a city and a fly-in community 500 km north face different realities. Figures are shown per community, never as a single “Indigenous” average.'], ['Data sovereignty.', 'Only general locations already on public maps are used. A real deployment should follow the First Nations principles of OCAP® (ownership, control, access, possession) and Métis and Inuit data governance, with communities holding their own data.'], ['Staying is legitimate.', 'Ties to territory are ancestral, cultural and spiritual. The aim is earlier warning and better resourcing so that leaving is a last resort chosen by the community.']].map(([t, d]) => <li key={t}><strong className="font-medium text-fg">{t}</strong> {d}</li>)}
        </ul>
      </Panel>

      <Panel title="Geographic exposure right now" sub="Distance to reported fires, satellite detections nearby and modelled smoke, for a demonstration set of communities."
        right={<div className="flex flex-wrap gap-1.5"><Btn active={scope === 'all'} onClick={() => setScope('all')}>All listed</Btn><Btn active={scope === 'region'} onClick={() => setScope('region')}>{region?.short} only</Btn></div>}>
        <Async state={communities} height={380} empty={() => (rows.length === 0 ? `No listed communities in ${region?.short}. Choose “All listed”.` : null)}>{() => <>
          <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-[12.5px]">
            <thead><tr className="label text-left">{([['name', 'Community'], ['nearestFireKm', 'Nearest active fire'], ['hotspots100km', 'Detections ≤100 km'], ['pm25', 'PM2.5 µg/m³']] as [SortKey, string][]).map(([k, l]) => <th key={k} className="pr-4 pb-2 align-bottom font-normal"><button className={`hover:text-fg ${sort === k ? 'text-fg font-semibold' : ''}`} onClick={() => setSort(k)} aria-label={`Sort by ${l}`}>{l}{sort === k ? ' ↓' : ''}</button></th>)}<th className="pb-2 font-normal">US AQI</th><th className="pb-2 font-normal">Publicly reported events</th></tr></thead>
            <tbody>{rows.map((c) => <tr key={c.id} className="border-t border-line/60 align-top">
              <td className="py-2 pr-3"><span className="text-fg">{c.name}</span><br /><span className="text-dim">{c.kind} · {c.province}</span></td>
              <td className="num py-2" style={{ color: c.nearestFireKm != null && c.nearestFireKm <= 50 ? '#e5484d' : c.nearestFireKm != null && c.nearestFireKm <= 100 ? '#f2884b' : undefined }}>{c.nearestFireKm == null ? '—' : `${c.nearestFireKm} km`}</td>
              <td className="num py-2">{c.hotspots100km}</td><td className="num py-2">{fmt(c.pm25, 1)}</td><td className="py-2"><AqiPill aqi={c.usAqi} /></td>
              <td className="py-2 text-mute">{c.reported.length ? c.reported.join('; ') : <span className="text-dim">none listed</span>}</td></tr>)}</tbody></table></div>
          <p className="mt-2 text-[11.5px] leading-relaxed text-dim">Proximity is not danger: wind, water, terrain and local fire knowledge decide that. “Publicly reported events” come from news coverage and are incomplete; a full record belongs to each community.</p>
          <Sources sources={communities.sources} /></>}</Async>
      </Panel>

      <div className="grid grid-cols-1 gap-x-12 gap-y-10 xl:grid-cols-2">
        <Panel title="Regional patterns" sub="Listed communities with an active fire within 100 km, and with US AQI over 100.">
          <Async state={communities} height={260}>{() => <div className="h-[260px]"><ResponsiveContainer><BarChart data={byRegion} margin={{ left: -18, right: 8 }}>
            <CartesianGrid {...chartGrid} /><XAxis dataKey="name" {...chartAxis} interval={0} tick={{ fontSize: 10, fill: '#9aa7b4' }} /><YAxis allowDecimals={false} {...chartAxis} />
            <Tooltip {...tooltipStyle} /><Legend wrapperStyle={{ fontSize: 11.5 }} />
            <Bar dataKey="listed" name="Listed" fill="#1f2933" radius={[3, 3, 0, 0]} isAnimationActive={false} /><Bar dataKey="nearFire" name="Fire ≤100 km" fill="#f2884b" radius={[3, 3, 0, 0]} isAnimationActive={false} /><Bar dataKey="smoky" name="AQI over 100" fill="#9cc4e4" radius={[3, 3, 0, 0]} isAnimationActive={false} />
          </BarChart></ResponsiveContainer></div>}</Async>
        </Panel>
        <Panel title="Repeated exposure" sub="What the evidence says, and what this prototype does not show.">
          <div className="space-y-2.5 text-[13px] leading-relaxed text-mute">
            <p>Analysis of the Canadian Wildland Fire Evacuation Database found 16 communities evacuated five or more times between 1980 and 2021. Fourteen were First Nations reserves. Some Nations have left home in back-to-back seasons.</p>
            <p>In the table above, the “publicly reported events” column gives a partial view of this. Several Northwestern Ontario communities appear in both 2025 and 2026 reporting.</p>
            <p className="rounded-md border border-line p-2.5 text-[12.5px]">BorealWatch does not publish a community-by-community evacuation count. That record is not open data, and counting evacuations without the community’s account of them would repeat the problem this project is trying to address.</p>
          </div>
        </Panel>
      </div>

      <section className="panel fade-in">
        <div className="pb-4"><p className="label">Case study</p><h2 className="text-[19px] font-semibold">Thunder Bay and Northwestern Ontario</h2></div>
        <div className="grid grid-cols-1 gap-x-12 gap-y-6 xl:grid-cols-[1fr_1.1fr]">
          <div className="space-y-2.5 text-[13px] leading-relaxed text-mute">
            <p>In mid-July 2026, wildfires in Northwestern Ontario forced evacuation orders for Whitesand, Namaygoosisagagun (Collins), Gull Bay, Lac des Mille Lacs and Lac La Croix First Nations and the town of Armstrong. Homes were destroyed in Collins, a community with no road access whose members left by boat. Neskantaga flew residents out days later.</p>
            <p>Most evacuees headed to Thunder Bay, where hotels filled within days and families were sent on to southern Ontario. Leaders said warnings came too late and that distant placements separated families.</p>
            <p className="text-fg">The same pieces of information existed before the orders: heat, dry air, wind, new satellite detections and thickening smoke. BorealWatch puts them side by side for the region, so a rising index and nearby detections can prompt a call days earlier.</p>
            <div className="flex flex-wrap gap-2 pt-1">
              <Link to="/map?date=2026-07-14" onClick={() => setRegionId('thunder-bay')} className="rounded-md border border-ember/50 bg-ember/12 px-3 py-1.5 text-[12.5px] text-ember hover:bg-ember/20">See NASA imagery for 14 July 2026 →</Link>
              <Link to="/risk" onClick={() => setRegionId('thunder-bay')} className="rounded-md border border-line bg-ink-800 px-3 py-1.5 text-[12.5px] hover:text-sky">Open today’s risk assessment</Link>
            </div>
            <p className="text-[11.5px] text-dim">Sources: The Canadian Press, CP24, CTV News and The Weather Network, July 2026. Event summary only; it is not a full account of what communities experienced.</p>
          </div>
          <div className="space-y-3">
            <Async state={tbRisk} height={90}>{(r) => <div className="grid grid-cols-2 gap-4 rounded-lg border border-line p-3 sm:grid-cols-4">
              <Stat label="Risk index" value={<RiskPill level={r.today.level} score={r.today.score} />} hint={`confidence ${r.today.confidence.toLowerCase()}`} />
              <Stat label="Max temp" value={fmt(r.days.filter((d) => d.kind === 'historical').at(-1)?.tMax, 1)} unit="°C" />
              <Stat label="Min humidity" value={fmt(r.days.filter((d) => d.kind === 'historical').at(-1)?.rhMin)} unit="%" />
              <Stat label="Detections ≤100 km" value={r.hotspots100km} />
            </div>}</Async>
            <Async state={tbAir} height={70}>{(a) => <div className="grid grid-cols-2 gap-4 rounded-lg border border-line p-3 sm:grid-cols-4">
              <Stat label="US AQI" value={<AqiPill aqi={a.now.usAqi} />} /><Stat label="PM2.5 now" value={fmt(a.now.pm25, 1)} unit="µg/m³" />
              <Stat label="7-day peak" value={fmt(Math.max(...a.hourly.filter((h) => h.kind === 'model').map((h) => h.pm25 ?? 0)), 0)} unit="µg/m³" />
              <Stat label="3-day outlook" value={fmt(Math.max(...a.hourly.filter((h) => h.kind === 'forecast').map((h) => h.pm25 ?? 0)), 0)} unit="µg/m³ peak" />
            </div>}</Async>
            <div className="rounded-lg border border-line p-3"><p className="label mb-1.5">Listed communities in the district</p>
              {tb.length ? <ul className="space-y-1 text-[12.5px]">{tb.map((c) => <li key={c.id} className="flex justify-between gap-3"><span>{c.name}</span><span className="num text-mute">{c.nearestFireKm == null ? 'no fire reported' : `fire ${c.nearestFireKm} km`} · PM2.5 {fmt(c.pm25, 0)}</span></li>)}</ul> : <p className="text-[12.5px] text-mute">{communities.loading ? 'Loading…' : 'Exposure data unavailable.'}</p>}</div>
            <Async state={tbRisk} height={60}>{(r) => <div className="rounded-lg border border-line p-3"><p className="label mb-1.5">Resources that may be needed at {r.today.level.toLowerCase()} risk</p>
              <ul className="space-y-1 text-[12.5px] text-mute">{ACTIONS[r.today.level].agency.slice(0, 3).map((a) => <li key={a}>· {a}</li>)}</ul></div>}</Async>
          </div>
        </div>
      </section>
    </div>
  </>
}
