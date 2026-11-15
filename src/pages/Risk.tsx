import { Bar, BarChart, CartesianGrid, Cell, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Link } from 'react-router-dom'
import type { RegionRisk, RegionSummary } from '../../shared/types.ts'
import { LEVEL_COLORS } from '../../shared/risk.ts'
import { useApi } from '../api.ts'
import { useApp } from '../state.tsx'
import { ACTIONS, DISCLAIMER } from '../actions.ts'
import { Async, KIND, KindBadge, PageHead, Panel, RiskPill, Sources, chartAxis, chartGrid, fmt, tooltipStyle } from '../components/ui.tsx'

function Dial({ score, color, band, level }: { score: number; color: string; band: number; level: string }) {
  const lo = Math.max(0, score - band), hi = Math.min(100, score + band)
  return <div role="img" aria-label={`Risk index ${score} out of 100, ${level}`}>
    <div className="flex flex-wrap items-baseline gap-x-4"><span className="num text-[88px] leading-none font-semibold tracking-[-0.04em]" style={{ color }}>{score}</span><span className="text-[24px] font-semibold">{level}</span></div>
    <div className="relative mt-4 h-1.5 rounded bg-ink-700">
      <span className="absolute top-0 h-1.5 rounded opacity-30" style={{ left: `${lo}%`, width: `${hi - lo}%`, background: color }} />
      <span className="absolute top-0 left-0 h-1.5 rounded" style={{ width: `${score}%`, background: color, transition: 'width .5s ease' }} />
      {[25, 50, 75].map((t) => <span key={t} className="absolute -top-1 h-3.5 w-px bg-fg" style={{ left: `${t}%` }} />)}
    </div>
    <div className="mt-1.5 grid grid-cols-4 text-[12px] text-mute"><span>Low</span><span>Moderate</span><span>High</span><span>Critical</span></div>
  </div>
}

export default function Risk() {
  const { region, setRegionId, mode } = useApp()
  const risk = useApi<RegionRisk>(region ? `risk/${region.id}` : null)
  const summary = useApi<RegionSummary[]>('summary')

  return <>
    <PageHead kicker="Wildfire risk assessment" title={`How risky are conditions · ${region?.short}`}>
      A transparent index built from weather, dryness and fire already on the landscape. It shows which conditions are driving risk and how that is expected to change over 72 hours. It cannot say where or when a fire will start.
    </PageHead>
    <Async state={risk} height={520}>{(r) => {
      const c = LEVEL_COLORS[r.today.level], month = mode === 'sim' ? 6 : new Date().getMonth()
      const today = r.days.filter((d) => d.kind === 'historical').at(-1)
      const normalT = r.climate?.tempC[month], normalP = r.climate?.precipMmDay[month]
      const rain7 = r.today.factors.find((f) => f.key === 'precip7d')?.value
      return <div className="space-y-10">
        <div className="grid grid-cols-1 gap-x-12 gap-y-10 xl:grid-cols-[330px_1fr]">
          <Panel title="Estimated risk today">
            <Dial score={r.today.score} color={c} band={r.today.uncertainty} level={r.today.level} />
            <dl className="mt-3 space-y-2 text-[12.5px]">
              <div className="flex justify-between gap-3"><dt className="text-mute">Confidence</dt><dd className="num" style={{ color: r.today.confidence === 'Low' ? '#e3c341' : undefined }}>{r.today.confidence}</dd></div>
              <div className="text-mute">Why: {r.today.confidenceWhy}.</div>
              <div className="flex justify-between gap-3"><dt className="text-mute">Uncertainty band</dt><dd className="num">{Math.max(0, r.today.score - r.today.uncertainty)}–{Math.min(100, r.today.score + r.today.uncertainty)}</dd></div>
              {r.today.snowGate && <div className="rounded-md border border-sky/40 bg-sky/8 p-2 text-sky">Snow cover or freezing temperatures: the index is scaled down to 20%, because surface fuels cannot carry fire.</div>}
            </dl>
            <p className="mt-3 text-[12.5px] leading-relaxed text-mute">This is a relative index from a rule-based prototype. It is not a probability of ignition and has not been validated against fire records.</p>
          </Panel>

          <Panel title="What is driving it" sub="Each bar is the number of points a condition adds to today’s index. Hover a row for the scoring rule.">
            <ul className="space-y-2.5">{r.today.factors.map((f) => { const maxPts = f.weight * 100
              return <li key={f.key} title={f.explain} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 text-[12.5px] md:grid-cols-[230px_1fr_70px_60px]">
                <span className="truncate">{f.label}</span>
                <div className="order-3 col-span-2 h-2.5 overflow-hidden rounded bg-ink-700 md:order-none md:col-span-1" aria-hidden><div className="h-full rounded" style={{ width: `${Math.min(100, (f.contribution / 18) * 100)}%`, background: f.score == null ? '#7f8c99' : f.score > 0.66 ? '#e5484d' : f.score > 0.33 ? '#f2884b' : '#5fc48f', transition: 'width .5s ease' }} /></div>
                <span className="num text-right text-mute">{f.value == null ? 'missing' : `${fmt(f.value, f.unit === 'm³/m³' || f.unit === 'kPa' || f.unit === 'index' ? 2 : 0)} ${f.unit === 'index' ? '' : f.unit}`}</span>
                <span className="num hidden text-right md:block">+{fmt(f.contribution, 1)}<span className="text-dim"> /{maxPts.toFixed(0)}</span></span>
              </li> })}</ul>
            <p className="mt-3 text-[11.5px] text-dim">Bar colour shows how severe each input is on its own scale (green low, red high). Maximum possible points per factor are shown after the slash.</p>
            <Sources sources={risk.sources} />
          </Panel>
        </div>

        <div className="grid grid-cols-1 gap-x-12 gap-y-10 xl:grid-cols-[1.4fr_1fr]">
          <Panel title="Change over time and 72-hour outlook" sub="Past days use weather model analyses; outlook days use the forecast. Satellite detections are held at today’s count.">
            <div className="h-[250px]"><ResponsiveContainer><BarChart data={r.timeline.map((d) => ({ ...d, label: new Date(d.date + 'T12:00').toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' }) }))} margin={{ left: -18, right: 8, top: 8 }}>
              <CartesianGrid {...chartGrid} /><XAxis dataKey="label" {...chartAxis} /><YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} {...chartAxis} />
              {[[25, 50, '#e3c341'], [50, 75, '#f2884b'], [75, 100, '#e5484d']].map(([a, b, col]) => <ReferenceArea key={a} y1={a as number} y2={b as number} fill={col as string} fillOpacity={0.04} />)}
              <Tooltip {...tooltipStyle} formatter={(v: number, _n, p) => [`${v} · ${p.payload.level}`, p.payload.kind === 'forecast' ? 'Forecast-based estimate' : p.payload.kind === 'today' ? 'Today' : 'Past estimate']} />
              <Bar dataKey="score" radius={[4, 4, 0, 0]} isAnimationActive={false}>{r.timeline.map((d) => <Cell key={d.date} fill={LEVEL_COLORS[d.level]} fillOpacity={d.kind === 'forecast' ? 0.45 : d.kind === 'today' ? 1 : 0.75} stroke={d.kind === 'today' ? '#141b22' : d.kind === 'forecast' ? LEVEL_COLORS[d.level] : 'none'} strokeDasharray={d.kind === 'forecast' ? '4 3' : undefined} />)}</Bar>
            </BarChart></ResponsiveContainer></div>
            <div className="mt-1 flex flex-wrap gap-2"><KindBadge kind={mode === 'sim' ? 'simulated' : 'model'} /><KindBadge kind="forecast" /><span className="text-[11.5px] text-dim">Outlined bar is today; faded, dashed bars are the outlook.</span></div>
          </Panel>

          <Panel title="Compared with a normal year" sub={mode === 'sim' ? 'Scenario conditions against simulated July normals.' : `Today against the long-term ${new Date().toLocaleDateString(undefined, { month: 'long' })} average at this location.`}>
            {r.climate ? <dl className="space-y-3 text-[13px]">
              {[{ k: 'Daily maximum temperature', now: today?.tMax, norm: normalT, u: '°C', d: 1 }, { k: 'Rain per day, last 7 days', now: rain7 == null ? null : rain7 / 7, norm: normalP, u: 'mm', d: 1 }, { k: 'Relative humidity (daily min vs mean)', now: today?.rhMin, norm: r.climate.rh[month], u: '%', d: 0 }].map((x) => { const diff = x.now != null && x.norm != null && !Number.isNaN(x.norm) ? x.now - x.norm : null
                return <div key={x.k}><dt className="text-mute">{x.k}</dt><dd className="num mt-0.5 flex items-baseline gap-3"><span className="text-[18px]">{fmt(x.now, x.d)} {x.u}</span><span className="text-mute">normal {fmt(x.norm, x.d)} {x.u}</span>{diff != null && <span style={{ color: Math.abs(diff) < 1 ? '#9aa7b4' : '#f2884b' }}>{diff > 0 ? '+' : ''}{fmt(diff, x.d)}</span>}</dd></div> })}
              <div className="flex items-center gap-2 pt-1 text-[11.5px] text-dim"><KindBadge kind={mode === 'sim' ? 'simulated' : 'historical'} />{mode === 'sim' ? 'Simulated normals' : 'NASA POWER climatology'}</div>
            </dl> : <p className="rounded-lg border border-dashed border-line p-4 text-[13px] text-mute">Climate normals from NASA POWER could not be loaded, so no historical comparison is shown.</p>}
          </Panel>
        </div>

        <div className="grid grid-cols-1 gap-x-12 gap-y-10 xl:grid-cols-2">
          <Panel title={`Preparedness at ${r.today.level} risk`} sub="Starting points for discussion, to be adapted locally." right={<Link to="/preparedness" className="text-[12.5px] text-sky underline">All recommendations</Link>}>
            <div className="grid gap-4 md:grid-cols-2">{(['community', 'agency'] as const).map((who) => <div key={who}><p className="label mb-1.5">{who === 'community' ? 'Communities' : 'Agencies and governments'}</p>
              <ul className="space-y-1.5 text-[12.5px] leading-relaxed">{ACTIONS[r.today.level][who].map((a) => <li key={a} className="flex gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: c }} />{a}</li>)}</ul></div>)}</div>
            <p className="mt-3 text-[11.5px] text-dim">{DISCLAIMER}</p>
          </Panel>
          <Panel title="All regions" sub="Select a row to assess another region.">
            <Async state={summary} height={200}>{(rows) => <ul className="divide-y divide-line/60">{[...rows].sort((a, b) => b.risk.score - a.risk.score).map((s) => <li key={s.region.id}><button onClick={() => setRegionId(s.region.id)} className={`flex w-full items-center justify-between gap-3 px-1.5 py-1.5 text-left text-[13px] hover:bg-ink-800 ${s.region.id === r.region.id ? 'font-semibold' : 'text-mute'}`}><span>{s.region.name}</span><RiskPill level={s.risk.level} score={s.risk.score} /></button></li>)}</ul>}</Async>
          </Panel>
        </div>

        <Panel title="How to read the data types on this site">
          <ul className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-5">{(['observed', 'historical', 'forecast', 'model', 'simulated'] as const).map((k) => <li key={k} className="border-t border-line pt-2.5"><KindBadge kind={k} /><p className="mt-1.5 text-[12px] leading-relaxed text-mute">{KIND[k].desc}.</p></li>)}</ul>
          <p className="mt-3 text-[12.5px] text-mute">Weights, scoring rules and limits are on the <Link className="text-sky underline" to="/data">Data &amp; methods</Link> page.</p>
        </Panel>
      </div> }}</Async>
  </>
}
