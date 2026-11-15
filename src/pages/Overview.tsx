import { Link } from 'react-router-dom'
import type { ActiveFire, CommunityExposure, RegionRisk, RegionSummary } from '../../shared/types.ts'
import { useApi } from '../api.ts'
import { useApp } from '../state.tsx'
import MapView from '../components/MapView.tsx'
import { AqiPill, Async, Panel, RiskPill, Sources, Stat, fmt, KindBadge } from '../components/ui.tsx'
import { LEVEL_COLORS } from '../../shared/risk.ts'

export default function Overview() {
  const { region, setRegionId, mode } = useApp()
  const summary = useApi<RegionSummary[]>('summary')
  const fires = useApi<ActiveFire[]>('fires/active')
  const communities = useApi<CommunityExposure[]>('communities')
  const risk = useApi<RegionRisk>(region ? `risk/${region.id}` : null)

  const oc = fires.data?.filter((f) => f.stage === 'OC').length
  const near = communities.data?.filter((c) => c.fires100km > 0 || (c.usAqi ?? 0) > 100)
  const rising = summary.data?.filter((s) => s.risk.trend >= 5)
  const kind = mode === 'sim' ? 'simulated' : 'observed'

  // "Recent developments" are generated from the data on screen, never written by hand.
  const developments: { text: string; to: string }[] = []
  const biggest = [...(fires.data ?? [])].filter((f) => f.stage === 'OC').sort((a, b) => b.hectares - a.hectares)[0]
  if (biggest) developments.push({ text: `Largest out-of-control fire: ${biggest.name} (${biggest.agency}), ${fmt(biggest.hectares)} ha reported.`, to: '/map' })
  const top = [...(summary.data ?? [])].sort((a, b) => b.risk.score - a.risk.score)[0]
  if (top) developments.push({ text: `Highest risk index: ${top.region.short} at ${top.risk.score} (${top.risk.level}).`, to: '/risk' })
  rising?.forEach((s) => developments.push({ text: `${s.region.short}: risk index forecast to rise ${s.risk.trend} points within 72 hours.`, to: '/risk' }))
  const worstAir = [...(summary.data ?? [])].sort((a, b) => (b.air.usAqi ?? 0) - (a.air.usAqi ?? 0))[0]
  if (worstAir && (worstAir.air.usAqi ?? 0) > 100) developments.push({ text: `Poorest air: ${worstAir.region.short}, US AQI ${worstAir.air.usAqi} (modelled).`, to: '/air' })
  if (near?.length) developments.push({ text: `${near.length} of ${communities.data!.length} listed communities have an active fire within 100 km or US AQI above 100.`, to: '/communities' })

  return <div className="space-y-10">
    <section className="fade-in pt-4">
      <h1 className="max-w-3xl text-[28px] leading-[1.15] font-semibold tracking-[-0.02em] md:text-[34px]">Track wildfires. Understand smoke. Protect communities.</h1>
      <p className="mt-2.5 max-w-2xl text-[15px] text-mute">Satellite fire detections, smoke and risk for Canada, built so First Nations and Métis communities and the agencies that work with them can see risk earlier and prepare on their own terms.</p>
      <div className="mt-8 grid grid-cols-1 border-y border-line md:grid-cols-3">
        {[
          { q: 'Where are wildfires happening?', to: '/map', v: fires.data ? fires.data.length : null, h: fires.data ? `active fires · ${oc} out of control` : fires.error ? 'fire reports unavailable' : 'active fires', accent: true },
          { q: 'Which communities may be affected?', to: '/communities', v: near ? near.length : null, h: `of ${communities.data?.length ?? '—'} listed · fire within 100 km or AQI over 100` },
          { q: 'Where is risk increasing?', to: '/risk', v: rising ? rising.length : null, h: `of ${summary.data?.length ?? '—'} regions${rising?.length ? ` · ${rising.map((r) => r.region.short).join(', ')}` : ''}` },
        ].map((x, i) => <Link key={x.q} to={x.to} className={`group flex flex-col gap-1.5 py-5 ${i ? 'border-t border-line md:border-t-0 md:border-l md:pl-6' : ''} md:pr-6`}>
          <span className="text-[13px] text-mute group-hover:text-fg">{x.q}</span>
          <span className={`num text-[44px] leading-none font-semibold tracking-[-0.02em] ${x.accent ? 'text-ember' : ''}`}>{x.v ?? '—'}</span>
          <span className="text-[13px] text-mute">{x.h}</span>
        </Link>)}
      </div>
      <p className="mt-2.5 flex items-center gap-2 text-[12px] text-dim"><KindBadge kind={kind} /> Fire counts {mode === 'sim' ? 'are simulated' : 'come from CWFIS agency reports'}; risk is a model estimate.</p>
    </section>

    <Panel title="Canada at a glance" sub="Active fires, satellite detections and community locations. Select a marker for details."><MapView height="440px" compact /></Panel>

    <div className="grid grid-cols-1 gap-x-12 gap-y-10 xl:grid-cols-[1.2fr_1fr]">
      <Panel title="Regions by risk index" sub="Select a region to update every section of the site.">
        <Async state={summary} height={300}>{(rows) => <>
          <div className="overflow-x-auto"><table className="w-full min-w-[600px] text-[13px]">
            <thead><tr className="label text-left"><th className="pb-2 font-normal">Region</th><th className="pb-2 font-normal">Risk index</th><th className="pr-5 pb-2 font-normal whitespace-nowrap">72 h</th><th className="pb-2 font-normal">US AQI</th><th className="pb-2 text-right font-normal">Detections ≤100 km</th></tr></thead>
            <tbody>{[...rows].sort((a, b) => b.risk.score - a.risk.score).map((s) => <tr key={s.region.id} onClick={() => setRegionId(s.region.id)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setRegionId(s.region.id)} className={`cursor-pointer border-t border-line hover:bg-ink-800 ${s.region.id === region?.id ? 'font-semibold' : ''}`}>
              <td className="py-2 pr-2">{s.region.short}</td>
              <td className="py-2 pr-5"><div className="flex items-center gap-2"><div className="h-1.5 w-20 overflow-hidden rounded bg-ink-700"><div className="h-full rounded" style={{ width: `${s.risk.score}%`, background: LEVEL_COLORS[s.risk.level] }} /></div><RiskPill level={s.risk.level} score={s.risk.score} /></div></td>
              <td className="num py-2 pr-5 whitespace-nowrap" style={{ color: s.risk.trend >= 5 ? '#f2884b' : s.risk.trend <= -5 ? '#5fc48f' : '#9aa7b4' }}>{s.risk.trend > 0 ? '▲' : s.risk.trend < 0 ? '▼' : '■'} {Math.abs(s.risk.trend)}</td>
              <td className="py-2"><AqiPill aqi={s.air.usAqi} /></td><td className="num py-2 text-right">{s.hotspots100km}</td>
            </tr>)}</tbody></table></div>
          <Sources sources={summary.sources} /></>}</Async>
      </Panel>

      <div className="space-y-10">
        <Panel title={`Key indicators · ${region?.short}`} right={<Link to="/risk" className="text-[12.5px] text-sky underline">Full assessment</Link>}>
          <Async state={risk} height={130}>{(r) => <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Temperature" value={fmt(r.current.temp, 1)} unit="°C" />
            <Stat label="Humidity" value={fmt(r.current.rh)} unit="%" color={(r.current.rh ?? 100) < 30 ? '#f2884b' : undefined} />
            <Stat label="Wind" value={fmt(r.current.wind)} unit="km/h" hint={r.current.windDir != null ? `from ${compass(r.current.windDir)}` : ''} />
            <Stat label="Risk index" value={r.today.score} unit="/100" color={LEVEL_COLORS[r.today.level]} hint={`${r.today.level} · ±${r.today.uncertainty}`} />
          </div>}</Async>
        </Panel>
        <Panel title="Recent developments" sub="Generated from the data on this page.">
          {developments.length ? <ul className="space-y-2">{developments.map((d, i) => <li key={i} className="flex gap-2.5 text-[13px]"><span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-mute" /><Link to={d.to} className="hover:text-sky">{d.text}</Link></li>)}</ul>
            : <p className="text-[13px] text-mute">{summary.loading ? 'Loading…' : 'Nothing notable in the current data. Outside fire season this is expected.'}</p>}
        </Panel>
      </div>
    </div>
  </div>
}

export const compass = (deg: number) => ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(deg / 45) % 8]
