import { Link } from 'react-router-dom'
import type { RegionAir, RegionRisk, RegionSummary, RiskLevel } from '../../shared/types.ts'
import { LEVEL_COLORS } from '../../shared/risk.ts'
import { SIGNS_NOTE, warningSigns } from '../../shared/signals.ts'
import { useApi } from '../api.ts'
import { useApp } from '../state.tsx'
import { ACTIONS, DISCLAIMER, FOCUS, dayLabel, summarize } from '../actions.ts'
import { SignList } from '../components/Signals.tsx'
import RiskStrip from '../components/RiskStrip.tsx'
import { Async, ButtonLink, KIND, KindBadge, PageHead, Panel, RiskPill, Sources, fmt } from '../components/ui.tsx'

function Dial({ score, color, band, level }: { score: number; color: string; band: number; level: string }) {
  const lo = Math.max(0, score - band), hi = Math.min(100, score + band)
  return <div role="img" aria-label={`Risk index ${score} out of 100, ${level}`}>
    <div className="flex flex-wrap items-baseline gap-x-4">
      <span className="num font-display condensed text-[96px] leading-[0.9] font-semibold tracking-[-0.02em]" style={{ color }}>{score}</span>
      <span className="font-display condensed text-[30px] leading-none font-semibold">{level}</span>
    </div>
    <div className="relative mt-5 h-1.5 rounded bg-ink-700">
      <span className="absolute top-0 h-1.5 rounded opacity-30" style={{ left: `${lo}%`, width: `${hi - lo}%`, background: color }} />
      <span className="absolute top-0 left-0 h-1.5 rounded" style={{ width: `${score}%`, background: color, transition: 'width .5s ease' }} />
      {[25, 50, 75].map((t) => <span key={t} className="absolute -top-1 h-3.5 w-px bg-fg" style={{ left: `${t}%` }} />)}
    </div>
    <div className="mt-1.5 grid grid-cols-4 text-[12px] text-mute"><span>Low</span><span>Moderate</span><span>High</span><span>Critical</span></div>
  </div>
}

/** Bar colour for a factor's own 0–1 severity score. */
const severity = (s: number | null) => (s == null ? 'var(--color-dim)' : s > 0.66 ? LEVEL_COLORS.Critical : s > 0.33 ? LEVEL_COLORS.High : LEVEL_COLORS.Low)

export default function Risk() {
  const { region, setRegionId, mode } = useApp()
  const risk = useApi<RegionRisk>(region ? `risk/${region.id}` : null)
  const air = useApi<RegionAir>(region ? `air/${region.id}?pastDays=7` : null)
  const summary = useApi<RegionSummary[]>('summary')

  return <>
    <PageHead kicker="Early warning" title={`Are fire conditions lining up in ${region?.short ?? 'this region'}?`}>
      The conditions that let wildfires start and spread often line up days ahead: heat building, humidity falling, no soaking rain, strong wind, fire already on the landscape, thickening smoke. This page tracks them for the selected region, with a risk index for today and the next 72 hours, so crews and equipment can be in place before ignition. It cannot say where or when a fire will start.
    </PageHead>
    <Async state={risk} height={520}>{(r) => {
      const c = LEVEL_COLORS[r.today.level], month = mode === 'sim' ? 6 : new Date().getMonth()
      const today = r.days.filter((d) => d.kind === 'historical').at(-1)
      const normalT = r.climate?.tempC[month], normalP = r.climate?.precipMmDay[month]
      const rain7 = r.today.factors.find((f) => f.key === 'precip7d')?.value

      // Signs wait for air quality to settle (loaded for this region, or failed), so the count does not jump from 6 to 7.
      const airHere = air.data?.region.id === r.region.id ? air.data : null
      const airSettled = !air.loading && (airHere != null || air.error != null)
      const signs = airSettled ? warningSigns(r, airHere) : null
      // The forecast line and guidance level do not depend on the signs, so they show straight away.
      const s = summarize(r, signs ?? [])
      const guidance: RiskLevel = s.guidance

      return <div className="space-y-10">
        {/* 1. Level today, and what is driving it */}
        <div className="grid grid-cols-1 gap-x-12 gap-y-10 xl:grid-cols-[340px_1fr]">
          <Panel title="Risk index today">
            <Dial score={r.today.score} color={c} band={r.today.uncertainty} level={r.today.level} />
            <dl className="mt-4 space-y-2 text-[12.5px]">
              <div className="flex justify-between gap-3"><dt className="text-mute">Confidence</dt><dd className={`num ${r.today.confidence === 'Low' ? 'text-sun' : ''}`}>{r.today.confidence}</dd></div>
              <div className="text-mute">Why: {r.today.confidenceWhy}.</div>
              <div className="flex justify-between gap-3"><dt className="text-mute">Uncertainty band</dt><dd className="num">{Math.max(0, r.today.score - r.today.uncertainty)}–{Math.min(100, r.today.score + r.today.uncertainty)}</dd></div>
              {r.today.snowGate && <div className="rounded-md border border-sky/40 bg-sky/8 p-2 text-sky">Snow cover or freezing temperatures: the index is scaled down to 20%, because surface fuels cannot carry fire.</div>}
            </dl>
            <p className="mt-3 text-[12.5px] leading-relaxed text-mute">A relative index from a rule-based prototype. It is not a probability of ignition and has not been validated against fire records.</p>
          </Panel>

          <Panel title="What is driving it" sub="Each bar is the number of points a condition adds to today’s index. Hover a row for the scoring rule.">
            <ul className="space-y-2.5">{r.today.factors.map((f) => { const maxPts = f.weight * 100
              return <li key={f.key} title={f.explain} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 text-[12.5px] md:grid-cols-[230px_1fr_76px_64px]">
                <span className="truncate">{f.label}</span>
                <div className="order-3 col-span-2 h-2.5 overflow-hidden rounded bg-ink-700 md:order-none md:col-span-1" aria-hidden><div className="h-full rounded" style={{ width: `${Math.min(100, (f.contribution / 18) * 100)}%`, background: severity(f.score), transition: 'width .5s ease' }} /></div>
                <span className="num text-right text-mute">{f.value == null ? 'missing' : `${fmt(f.value, f.unit === 'm³/m³' || f.unit === 'kPa' || f.unit === 'index' ? 2 : 0)} ${f.unit === 'index' ? '' : f.unit}`}</span>
                <span className="num hidden text-right md:block">+{fmt(f.contribution, 1)}<span className="text-dim"> /{maxPts.toFixed(0)}</span></span>
              </li> })}</ul>
            <p className="mt-3 text-[11.5px] text-dim">Bar colour shows how severe each input is on its own scale: green low, orange elevated, red severe. Maximum possible points per factor are shown after the slash.</p>
            <Sources sources={risk.sources} />
          </Panel>
        </div>

        {/* 2. The outlook, and the warning signs that have tripped */}
        <div className="grid grid-cols-1 gap-x-12 gap-y-10 xl:grid-cols-2">
          <Panel title="Past week and 72-hour outlook" sub="Past days use weather model analyses; outlook days use the forecast. Satellite detections are held at today’s count.">
            {s.forecast && <p className="mb-2 text-[15px] font-medium">{s.forecast.charAt(0).toUpperCase() + s.forecast.slice(1)}.</p>}
            <RiskStrip timeline={r.timeline} />
          </Panel>

          <Panel title="Warning signs" sub="Plain-language checks on the same data: which conditions are lining up, and since when.">
            {signs ? <>
              <p className="mb-3 text-[15px] font-medium">{s.signs}{s.building && <span className="font-normal text-mute"> {s.building}</span>}</p>
              <SignList signs={signs} />
              {!airHere && <p className="mt-3 text-[12px] text-mute">Air quality data could not be loaded, so the smoke sign is not included.</p>}
            </> : <div className="skeleton h-[300px]" role="status" aria-label="Loading warning signs" />}
            <p className="mt-3 text-[11.5px] text-dim">{SIGNS_NOTE}</p>
          </Panel>
        </div>

        {/* 3. Hand-off to the brief: the one primary action on this page */}
        <section className="fade-in flex flex-col gap-5 rounded-xl border border-line bg-ink-900 p-5 md:flex-row md:items-center md:justify-between md:p-7" style={{ borderLeft: `4px solid ${LEVEL_COLORS[guidance]}` }}>
          <div className="max-w-3xl">
            {signs ? <p className="text-[17px] leading-snug font-medium md:text-[19px]">{s.bottomLine}</p> : <div className="skeleton h-6 w-72 max-w-full" />}
            <p className="mt-1.5 text-[13.5px] text-mute">Turn this into a one-page situation brief for fire and emergency management agencies and community leadership, ready to print or paste.</p>
          </div>
          <div className="shrink-0"><ButtonLink to="/brief" primary>Situation brief</ButtonLink></div>
        </section>

        {/* 4. What to do, and how today compares with a normal year */}
        <div className="grid grid-cols-1 gap-x-12 gap-y-10 xl:grid-cols-[1.3fr_1fr]">
          <Panel title="What to do before ignition" sub={`${s.guidanceDay ? `Guidance for ${guidance} risk, the level forecast for ${dayLabel(s.guidanceDay.date, s.todayIso)}.` : `Guidance for ${guidance} risk, today’s level.`} ${FOCUS[guidance]} Starting points for discussion, to be adapted locally.`} right={<Link to="/preparedness" className="text-[12.5px] text-sky underline">All recommendations</Link>}>
            <div className="grid gap-5 md:grid-cols-2">{(['agency', 'community'] as const).map((who) => <div key={who}><p className="label mb-1.5">{who === 'agency' ? 'For fire and emergency management agencies' : 'For community leadership to consider'}</p>
              <ul className="space-y-1.5 text-[12.5px] leading-relaxed">{ACTIONS[guidance][who].map((a) => <li key={a} className="flex gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: LEVEL_COLORS[guidance] }} />{a}</li>)}</ul></div>)}</div>
            <p className="mt-3 text-[11.5px] text-dim">{DISCLAIMER}</p>
          </Panel>

          <Panel title="Compared with a normal year" sub={mode === 'sim' ? 'Scenario conditions against simulated July normals.' : `Today against the long-term ${new Date().toLocaleDateString(undefined, { month: 'long' })} average at this location.`}>
            {r.climate ? <dl className="space-y-3 text-[13px]">
              {[{ k: 'Daily maximum temperature', now: today?.tMax, norm: normalT, u: '°C', d: 1 }, { k: 'Rain per day, last 7 days', now: rain7 == null ? null : rain7 / 7, norm: normalP, u: 'mm', d: 1 }, { k: 'Relative humidity (daily min vs mean)', now: today?.rhMin, norm: r.climate.rh[month], u: '%', d: 0 }].map((x) => { const diff = x.now != null && x.norm != null && !Number.isNaN(x.norm) ? x.now - x.norm : null
                return <div key={x.k}><dt className="text-mute">{x.k}</dt><dd className="num mt-0.5 flex flex-wrap items-baseline gap-x-3"><span className="text-[18px]">{fmt(x.now, x.d)} {x.u}</span><span className="text-mute">normal {fmt(x.norm, x.d)} {x.u}</span>{diff != null && <span className={Math.abs(diff) < 1 ? 'text-dim' : 'text-ember'}>{diff > 0 ? '+' : ''}{fmt(diff, x.d)}</span>}</dd></div> })}
              <div className="flex items-center gap-2 pt-1 text-[11.5px] text-dim"><KindBadge kind={mode === 'sim' ? 'simulated' : 'historical'} />{mode === 'sim' ? 'Simulated normals' : 'NASA POWER climatology'}</div>
            </dl> : <p className="rounded-lg border border-dashed border-line p-4 text-[13px] text-mute">Climate normals from NASA POWER could not be loaded, so no historical comparison is shown.</p>}
          </Panel>
        </div>

        {/* 5. Other regions, and how to read the data */}
        <div className="grid grid-cols-1 gap-x-12 gap-y-10 xl:grid-cols-2">
          <Panel title="All regions" sub="Select a row to see another region’s early warning.">
            <Async state={summary} height={200}>{(rows) => <ul className="divide-y divide-line/60">{[...rows].sort((a, b) => b.risk.score - a.risk.score).map((x) => <li key={x.region.id}><button type="button" onClick={() => setRegionId(x.region.id)} aria-current={x.region.id === r.region.id || undefined} className={`flex w-full items-center justify-between gap-3 px-1.5 py-1.5 text-left text-[13px] hover:bg-ink-800 ${x.region.id === r.region.id ? 'font-semibold' : 'text-mute'}`}><span>{x.region.name}</span><RiskPill level={x.risk.level} score={x.risk.score} /></button></li>)}</ul>}</Async>
          </Panel>
          <Panel title="How to read the data types on this site">
            <ul className="grid gap-x-6 gap-y-2.5 sm:grid-cols-2">{(['observed', 'historical', 'forecast', 'model', 'simulated'] as const).map((k) => <li key={k} className="border-t border-line pt-2.5"><KindBadge kind={k} /><p className="mt-1.5 text-[12px] leading-relaxed text-mute">{KIND[k].desc}.</p></li>)}</ul>
            <p className="mt-3 text-[12.5px] text-mute">Weights, scoring rules and limits are on the <Link className="text-sky underline" to="/data">Data &amp; methods</Link> page.</p>
          </Panel>
        </div>
      </div> }}</Async>
  </>
}
