import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { ActiveFire, CommunityExposure, RegionAir, RegionRisk, RegionSummary, SourceMeta } from '../../shared/types.ts'
import { LEVEL_COLORS } from '../../shared/risk.ts'
import { SIGNS_NOTE, warningSigns } from '../../shared/signals.ts'
import { useApi } from '../api.ts'
import { useApp } from '../state.tsx'
import MapView from '../components/MapView.tsx'
import RiskStrip from '../components/RiskStrip.tsx'
import { SignList, heroCopy, longDate } from '../components/Signals.tsx'
import { AqiPill, Async, ButtonLink, InfoDot, KindBadge, Panel, RiskPill, Sources, fmt } from '../components/ui.tsx'

const uniqueSources = (s: SourceMeta[]) => s.filter((x, i) => s.findIndex((y) => y.id === x.id) === i)

// Wording, figures and source as in server/data/history.ts (evacuationFacts[0]).
const EVAC_SOURCE = { text: 'Canadian Wildland Fire Evacuation Database, 1980–2021. Analysis by Dr. Amy Cardinal Christianson, Métis fire research scientist, as reported by Global News and the Associated Press (2023).', url: 'https://globalnews.ca/news/9918749/indigenous-vulnerable-wildfires-evacuations' }

export default function Overview() {
  const { region, setRegionId, mode, setMode, horizon } = useApp()
  const nextDays = `${horizon} day${horizon === 1 ? '' : 's'}`
  const risk = useApi<RegionRisk>(region ? `risk/${region.id}` : null)
  const air = useApi<RegionAir>(region ? `air/${region.id}?pastDays=7` : null)
  const summary = useApi<RegionSummary[]>('summary')
  const fires = useApi<ActiveFire[]>('fires/active')
  const communities = useApi<CommunityExposure[]>('communities')

  const oc = fires.data?.filter((f) => f.stage === 'OC').length ?? 0
  const near = communities.data?.filter((c) => c.fires100km > 0 || (c.usAqi ?? 0) > 100)
  const rising = summary.data?.filter((s) => s.risk.trend >= 5)

  // Developments are generated from the data on screen, never written by hand.
  const developments: { text: string; to: string }[] = []
  const biggest = [...(fires.data ?? [])].filter((f) => f.stage === 'OC').sort((a, b) => b.hectares - a.hectares)[0]
  if (biggest) developments.push({ text: `Largest out-of-control fire: ${biggest.name} (${biggest.agency}), ${fmt(biggest.hectares)} ha reported.`, to: '/map' })
  if (rising?.length) developments.push({ text: `Risk index forecast to rise 5 points or more within ${nextDays} in ${rising.map((s) => s.region.short).join(', ')}.`, to: '/risk' })
  const worstAir = [...(summary.data ?? [])].sort((a, b) => (b.air.usAqi ?? 0) - (a.air.usAqi ?? 0))[0]
  if (worstAir && (worstAir.air.usAqi ?? 0) > 100) developments.push({ text: `Poorest air: ${worstAir.region.short}, US AQI ${worstAir.air.usAqi} (modelled).`, to: '/air' })

  return <div className="space-y-16 md:space-y-20">
    {/* Hero: the selected region's early warning, written from the data */}
    <section aria-labelledby="hero-title" className="md:pt-4">
      <Async state={risk} height={480}>{(r) => {
        // useApi keeps the previous region's data while reloading; only use air that matches this region.
        const airFor = air.data && air.data.region.id === r.region.id ? air.data : null
        const signs = warningSigns(r, airFor)
        const copy = heroCopy(r, signs)
        return <>
          <p className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[13.5px] text-mute">
            <span className="font-medium text-fg">{r.region.name}</span>
            {copy.todayIso && <span>{longDate(copy.todayIso)}</span>}
            <KindBadge kind={mode === 'sim' ? 'simulated' : 'model'} />
          </p>
          <h1 id="hero-title" className="font-display condensed mt-4 text-[40px] leading-[0.98] font-bold tracking-[-0.012em] text-balance sm:text-[52px] lg:text-[64px] xl:text-[72px]">{copy.headline}</h1>

          <div className="mt-8 grid grid-cols-1 gap-x-14 gap-y-10 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)]">
            <div>
              <p className="max-w-[36rem] text-[17px] leading-relaxed md:text-[18px] lg:text-[21px] lg:leading-snug">{copy.subline}</p>
              <div className="mt-7 flex flex-wrap gap-3">
                <ButtonLink to="/risk" primary>Open the early warning</ButtonLink>
                <ButtonLink to="/brief">Situation brief</ButtonLink>
              </div>
              {copy.state !== 'building' && mode === 'live' && <p className="mt-6 max-w-[36rem] text-[13.5px] leading-relaxed text-mute">
                To see how warning signs line up before a fire,{' '}
                <button type="button" onClick={() => setMode('sim')} className="text-sky underline underline-offset-2 hover:text-fg">open the simulated fire-season scenario</button>.
              </p>}
            </div>
            <div className="min-w-0">
              <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h2 className="flex items-center gap-1.5 text-[14.5px] font-semibold tracking-normal">Risk index by day<InfoDot k="riskIndex" /></h2>
                <p className="text-[12.5px] text-mute">A relative index from 0 to 100, not a probability</p>
              </div>
              <RiskStrip timeline={r.timeline} />
            </div>
          </div>

          <div className="mt-14 border-t border-fg/80 pt-6">
            <div className="mb-6 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
              <h2 className="font-display condensed text-[30px] leading-none font-bold">Warning signs</h2>
              <p className="text-[14px] text-mute">{copy.active
                ? <><span className="num font-semibold text-fg">{copy.active} of {copy.total}</span> active today{copy.earliest ? `, the earliest since ${longDate(copy.earliest)}` : ''}.</>
                : `None of the ${copy.total} is active today.`}</p>
            </div>
            <SignList signs={signs} />
            <p className="mt-7 max-w-[72ch] text-[12.5px] leading-relaxed text-mute">{SIGNS_NOTE} An active sign means conditions are worth watching, not that a fire will start.</p>
            <Sources sources={uniqueSources([...risk.sources, ...(airFor ? air.sources : [])])} />
          </div>
        </>
      }}</Async>
    </section>

    {/* Where to send resources first, and the national picture */}
    <div className="grid grid-cols-1 gap-x-14 gap-y-14 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
      <Panel title="Regions to watch" sub="Ranked by today’s risk index, to help decide where crews and equipment go first. Select a region to update every page.">
        <Async state={summary} height={340}>{(rows) => <>
          <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
            <table className="w-full min-w-[580px] text-[13.5px]">
              <caption className="sr-only">Regions ranked by risk index today</caption>
              <thead><tr className="text-left align-bottom text-[12.5px] text-mute">
                <th scope="col" className="w-12 pr-3 pb-2 pl-2 font-normal">Rank</th>
                <th scope="col" className="pr-4 pb-2 font-normal">Region</th>
                <th scope="col" className="pr-4 pb-2 font-normal">Risk today</th>
                <th scope="col" className="pr-4 pb-2 font-normal whitespace-nowrap">Next {nextDays}</th>
                <th scope="col" className="pr-4 pb-2 font-normal whitespace-nowrap">US AQI</th>
                <th scope="col" className="pr-2 pb-2 text-right font-normal whitespace-nowrap">Fire detections<span className="block text-[11.5px] text-dim">within 100 km</span></th>
              </tr></thead>
              <tbody>{[...rows].sort((a, b) => b.risk.score - a.risk.score).map((s, i) => {
                const sel = s.region.id === region?.id, t = s.risk.trend
                return <tr key={s.region.id} onClick={() => setRegionId(s.region.id)} className={`cursor-pointer border-t border-line ${sel ? 'bg-ink-850' : 'hover:bg-ink-900'}`}>
                  <td className={`num py-3 pl-2 text-mute ${sel ? 'shadow-[inset_3px_0_0_var(--color-fg)]' : ''}`}>{i + 1}</td>
                  <td className="py-3 pr-4">
                    <button type="button" aria-pressed={sel} onClick={(e) => { e.stopPropagation(); setRegionId(s.region.id) }} className={`text-left ${sel ? 'font-semibold' : 'font-medium'} hover:underline`}>{s.region.short}</button>
                  </td>
                  <td className="py-3 pr-4"><div className="flex items-center gap-2.5">
                    <div aria-hidden className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-ink-700 sm:block"><div className="h-full rounded-full" style={{ width: `${s.risk.score}%`, background: LEVEL_COLORS[s.risk.level] }} /></div>
                    <RiskPill level={s.risk.level} score={s.risk.score} />
                  </div></td>
                  <td className={`num py-3 pr-4 whitespace-nowrap ${t >= 5 ? 'font-semibold text-ember-deep' : t <= -5 ? 'text-moss' : 'text-mute'}`} title={`Forecast change in the risk index over the next ${nextDays}`}>{t > 0 ? `+${t}` : t < 0 ? `−${Math.abs(t)}` : '0'}</td>
                  <td className="py-3 pr-4"><AqiPill aqi={s.air.usAqi} /></td>
                  <td className="num py-3 pr-2 text-right">{s.hotspots100km}</td>
                </tr>
              })}</tbody>
            </table>
          </div>
          <Sources sources={summary.sources} />
        </>}</Async>
      </Panel>

      <Panel title="Across Canada right now" sub="Generated from the data on this page.">
        <dl className="divide-y divide-line border-y border-line">
          {[
            { k: 'Active wildfires', v: fires.data?.length, h: fires.data ? `${oc} out of control` : fires.error ? 'Fire reports unavailable' : 'Loading', to: '/map' },
            { k: 'Listed communities near fire or smoke', v: near?.length, h: communities.data ? `of ${communities.data.length}, with a fire within 100 km or US AQI over 100` : communities.error ? 'Community data unavailable' : 'Loading', to: '/communities' },
            { k: 'Regions where risk is rising', v: rising?.length, h: summary.data ? `of ${summary.data.length}, forecast up 5 points or more in ${nextDays}` : summary.error ? 'Regional data unavailable' : 'Loading', to: '/risk' },
          ].map((x) => <div key={x.k} className="grid grid-cols-[4.25rem_minmax(0,1fr)] items-baseline gap-x-4 py-3.5">
            <dt className="col-start-2 row-start-1"><Link to={x.to} className="font-medium underline decoration-line underline-offset-[3px] hover:decoration-fg">{x.k}</Link><span className="mt-0.5 block text-[12.5px] text-mute">{x.h}</span></dt>
            <dd className="num font-display condensed col-start-1 row-start-1 text-[38px] leading-none font-semibold">{x.v ?? '—'}</dd>
          </div>)}
        </dl>
        {developments.length > 0
          ? <ul className="mt-5 space-y-2.5 text-[13.5px]">{developments.map((d) => <li key={d.text} className="flex gap-2.5"><span aria-hidden className="mt-[8px] h-1 w-1 shrink-0 rounded-full bg-mute" /><Link to={d.to} className="hover:underline">{d.text}</Link></li>)}</ul>
          : <p className="mt-5 text-[13.5px] text-mute">{summary.loading || fires.loading ? 'Loading the national picture.' : 'Nothing notable in the current data. Outside fire season this is expected.'}</p>}
        <p className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-mute"><KindBadge kind={mode === 'sim' ? 'simulated' : 'observed'} />{mode === 'sim' ? 'Fire, community and air figures are simulated.' : 'Fire counts come from CWFIS agency reports. Air quality is modelled.'}</p>
      </Panel>
    </div>

    <Panel title="Fires and satellite detections across Canada" sub="Select a marker for details.">
      <MapView height="440px" compact />
    </Panel>

    {/* Why this matters */}
    <section aria-labelledby="why-title" className="rounded-2xl bg-ink-900 px-5 py-10 sm:px-8 md:px-12 md:py-14">
      <h2 id="why-title" className="font-display condensed text-[30px] leading-none font-bold">Why this matters</h2>
      <div className="mt-8 grid grid-cols-1 gap-10 md:grid-cols-2 md:gap-14">
        <Fact value={5} of="of Canada’s population">Indigenous people are about 5% of Canada’s population.</Fact>
        <Fact value={42} of="of wildfire evacuation events, 1980 to 2021">About 42% of wildfire evacuation events were in majority-Indigenous communities. This counts evacuation events, not individual evacuees.</Fact>
      </div>
      <p className="mt-10 max-w-[68ch] text-[16px] leading-relaxed">
        In mid-July 2026, wildfires in Northwestern Ontario forced evacuation orders for Whitesand, Namaygoosisagagun (Collins), Gull Bay, Lac des Mille Lacs and Lac La Croix First Nations. Leaving ancestral land is not a simple fix. Seeing conditions line up days ahead gives fire agencies time to move crews and equipment early, and communities time to prepare on their own terms, so fewer people have to leave.
      </p>
      <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
        <ButtonLink to="/communities">Read the community evidence</ButtonLink>
      </div>
      <p className="mt-8 max-w-[80ch] text-[12px] leading-relaxed text-mute">
        Source: {EVAC_SOURCE.text} <a href={EVAC_SOURCE.url} target="_blank" rel="noreferrer" className="text-sky underline underline-offset-2 hover:text-fg">Global News report</a>
      </p>
    </section>
  </div>
}

/** A large share with a 0–100% bar on the same scale as its neighbour, so the two compare honestly. */
function Fact({ value, of, children }: { value: number; of: string; children: ReactNode }) {
  return <figure className="min-w-0">
    <p className="flex flex-wrap items-baseline gap-x-3"><span className="num font-display condensed text-[88px] leading-[0.9] font-bold tracking-[-0.02em] md:text-[112px]">{value}%</span><span className="text-[15px] text-mute">{of}</span></p>
    <div aria-hidden className="mt-4 h-2.5 overflow-hidden rounded-full bg-ink-700"><div className="h-full rounded-full bg-fg" style={{ width: `${value}%` }} /></div>
    <figcaption className="mt-4 max-w-[46ch] text-[15px] leading-relaxed">{children}</figcaption>
  </figure>
}

