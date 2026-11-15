// Long-term context: decades of NASA POWER daily records for the selected area.
// Every number here is computed from the record (GET /api/climate-history/:id); nothing is hand-written.
// Plain answer first in each block; the statistics sit in "Details for experts" (critique fix 13).
import { CartesianGrid, ComposedChart, Line, ResponsiveContainer, XAxis, YAxis } from 'recharts'
import type { ClimateHistory, RegionRisk } from '../../shared/types.ts'
import { percentileRank } from '../../shared/stats.ts'
import { useApi } from '../api.ts'
import { useApp } from '../state.tsx'
// The same p-value format, "no real change" rule and 0.05 cut-off as the community page's NASA record section.
import { SIGNIFICANT_P, fmtP, signed, tiny } from './community/words.ts'

const EMBER = '#c24a17'
const INK = '#1f2328'
const MUTE = '#4a524e'

function Answer({ q, a, line }: { q: string; a: string; line?: string }) {
  return (
    <div className="border-t border-line pt-4">
      <h4 className="text-[15px] font-semibold text-[var(--color-mute)]">{q}</h4>
      <p className="mt-1.5 text-[19px] font-semibold leading-snug">{a}</p>
      {line && <p className="mt-1.5 text-[15px] leading-snug text-[var(--color-mute)]">{line}</p>}
    </div>
  )
}

export default function HistoryContext() {
  const { region, mode } = useApp()
  const hist = useApi<ClimateHistory>(region ? `climate-history/${region.id}` : null)
  const risk = useApi<RegionRisk>(region ? `risk/${region.id}` : null)

  if (hist.error) {
    return (
      <section className="mt-4 text-[16px]">
        <p>We could not load the long-term NASA records for this place. {hist.error}</p>
        <button type="button" onClick={hist.reload} className="mt-1 font-semibold text-[var(--color-action)] hover:underline">Try again</button>
      </section>
    )
  }
  const h = hist.data
  if (!h) return <section className="mt-4" aria-busy="true"><div className="skeleton h-[320px] w-full" /></section>

  const { period, window: win, metrics } = h
  const t = metrics.tMax
  const tr = t.trend
  const p = tr.mannKendall.pValue
  const sen = tr.senPerDecade
  const since = period.startYear
  // Same rule as the trend test elsewhere: a change is called real only when p < 0.05.
  const significant = p < SIGNIFICANT_P
  const first = t.annual[0]?.year ?? period.startYear
  const rows = t.annual.map((a) => ({ year: a.year, v: a.value, fit: tr.senIntercept + (sen / 10) * (a.year - first) }))

  // One temperature normal for the whole sheet: the calendar window around today (mid-July in the example).
  const example = mode === 'sim'
  const windowDays = example ? 'mid-July days' : `days at this time of year (${win.label})`
  const typical = example ? 'A typical mid-July day here reaches' : 'A typical day here at this time of year reaches'

  // Today vs history: the latest observed (or example) day from the risk endpoint.
  const days = risk.data?.days ?? []
  const today = [...days].reverse().find((d) => d.kind === 'historical' && d.tMax != null)
  const pr = today?.tMax != null ? percentileRank(today.tMax, t.window.q) : NaN
  const rank = Number.isFinite(pr) ? Math.round(pr) : null

  // Hottest fire seasons on record (ranked by season-average daily high).
  const top = [...t.annual].sort((a, b) => b.value - a.value).slice(0, 3)

  const warmed = sen > 0 ? 'warmed' : 'cooled'
  const seasonAnswer = tiny(sen)
    ? `No real change since ${since}.`
    : significant
      ? `${sen > 0 ? 'Yes' : 'No'}. Fire seasons here have ${warmed} by about ${Math.abs(sen).toFixed(1)} °C every 10 years since ${since}.`
      : `Fire seasons here have ${warmed} a little since ${since}, not enough to rule out chance.`
  const seasonLine = !tiny(sen) && significant ? `That change is ${p < 0.01 ? 'very unlikely' : 'unlikely'} to be chance.` : undefined

  return (
    <section className="@container mt-4">
      <h3 className="text-[24px] font-semibold leading-tight">{period.years} years of NASA weather records for this place</h3>
      <p className="mt-1 text-[15px] text-[var(--color-mute)]">Daily records from {period.startYear} to {period.endYear}, from NASA’s POWER project</p>

      <div className="mt-5 grid gap-5 @3xl:grid-cols-3">
        <Answer q="Are fire seasons getting hotter here?" a={seasonAnswer} line={seasonLine} />
        <Answer
          q="Today compared with the past"
          a={rank == null ? 'There is no reading for today yet.' : `Today is ${today?.tMax != null && today.tMax < 15 ? 'warmer' : 'hotter'} than ${rank} in every 100 ${windowDays} since ${since}.`}
          line={today?.tMax != null ? `Today’s high is ${today.tMax.toFixed(0)} °C. ${typical} ${t.window.mean.toFixed(0)} °C.` : undefined}
        />
        <Answer
          q="Hottest fire season on record"
          a={top[0] ? `${top[0].year} was the hottest since ${since}, with an average high of ${top[0].value.toFixed(1)} °C.` : 'Not enough data yet.'}
          line={top.length > 2 ? `Next hottest: ${top[1].year} and ${top[2].year}.` : undefined}
        />
      </div>

      <p className="mt-7 text-[15px] font-semibold">Average daytime high in fire season (May to September), each year</p>
      <div className="mt-2 h-[190px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 6, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="#000" strokeOpacity={0.06} />
            <XAxis dataKey="year" type="number" domain={['dataMin', 'dataMax']} ticks={rows.filter((r) => r.year % 10 === 0).map((r) => r.year)} tick={{ fontSize: 14, fill: MUTE }} tickLine={false} axisLine={false} />
            <YAxis domain={['dataMin - 0.5', 'dataMax + 0.5']} tickFormatter={(v: number) => `${Math.round(v)}°`} tick={{ fontSize: 14, fill: MUTE }} tickLine={false} axisLine={false} width={44} allowDecimals={false} />
            <Line dataKey="v" stroke={EMBER} strokeWidth={2.5} dot={{ r: 2.5, fill: EMBER, strokeWidth: 0 }} isAnimationActive={false} />
            <Line dataKey="fit" stroke={INK} strokeOpacity={0.6} strokeWidth={2} strokeDasharray="2 5" strokeLinecap="round" dot={false} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 pl-11 text-[15px] text-[var(--color-mute)]">
        <span className="flex items-center gap-2"><span className="inline-block h-[3px] w-6 rounded" style={{ background: EMBER }} />Each year (°C)</span>
        <span className="flex items-center gap-2"><span className="inline-block w-6 border-t-2 border-dotted" style={{ borderColor: INK }} />Long-term direction</span>
      </div>

      {example && <p className="mt-4 text-[15px] text-[var(--color-mute)]">This example is set in mid-July. Today’s values come from the example scenario. The {period.years}-year record is real NASA data.</p>}

      <details className="mt-4 text-[15px]">
        <summary className="cursor-pointer font-semibold text-[var(--color-mute)] hover:text-[var(--color-fg)]">Details for experts</summary>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 leading-relaxed text-[var(--color-mute)]">
          <li>Long-term direction: Sen’s slope on the {t.annual.length} fire-season averages of the daily high (1 May to 30 September), {tiny(sen) ? 'no real change' : `${signed(sen, 2)} °C per decade`}.</li>
          <li>Mann–Kendall trend test on the same averages: {fmtP(p)}, Kendall’s τ = {tr.mannKendall.tau.toFixed(2)}{significant ? '' : ', not significant at 0.05'}.</li>
          <li>Least-squares line on the same averages: {tiny(tr.linear.slope * 10) ? 'no real change' : `${signed(tr.linear.slope * 10, 2)} °C per decade`}, R² = {tr.linear.r2.toFixed(2)}, {fmtP(tr.linear.pValue)}.</li>
          <li>Today is ranked (percentile rank) against {t.window.n.toLocaleString('en-CA')} daily highs from {win.label} in every year of the record. {win.note}</li>
          <li>NASA POWER daily values are for a grid cell about 50 km across, not a single station.</li>
        </ul>
      </details>
    </section>
  )
}
