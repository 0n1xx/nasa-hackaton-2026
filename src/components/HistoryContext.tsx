// Long-term context: decades of NASA POWER daily records for the selected area.
// Every number here is computed from the record (GET /api/climate-history/:id); nothing is hand-written.
import { CartesianGrid, ComposedChart, Line, ResponsiveContainer, XAxis, YAxis } from 'recharts'
import type { ClimateHistory, RegionRisk } from '../../shared/types.ts'
import { percentileRank } from '../../shared/stats.ts'
import { useApi } from '../api.ts'
import { useApp } from '../state.tsx'

const EMBER = '#c24a17'
const INK = '#1f2328'
const MUTE = '#6b7280'

const fmtP = (p: number) => (p < 0.001 ? 'p < 0.001' : `p = ${p < 0.1 ? p.toFixed(3) : p.toFixed(2)}`)
const signed = (v: number, d = 1) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(d)}`

function Fact({ title, big, sub, line }: { title: string; big: string; sub: string; line?: string }) {
  return (
    <div className="rounded-xl border border-black/10 p-5">
      <p className="text-[14px] font-semibold">{title}</p>
      <p className="font-display condensed mt-2 text-[34px] font-bold leading-none tabular-nums">{big}</p>
      <p className="mt-2 text-[15px] font-medium leading-snug">{sub}</p>
      {line && <p className="mt-1 text-[13px] leading-snug text-[var(--color-mute)]">{line}</p>}
    </div>
  )
}

export default function HistoryContext() {
  const { region, mode } = useApp()
  const hist = useApi<ClimateHistory>(region ? `climate-history/${region.id}` : null)
  const risk = useApi<RegionRisk>(region ? `risk/${region.id}` : null)

  if (hist.error) {
    return (
      <section className="mt-10 text-[14px]">
        <p>We could not load the long-term NASA records for this place. {hist.error}</p>
        <button type="button" onClick={hist.reload} className="mt-1 font-semibold text-[#c24a17] hover:underline">Try again</button>
      </section>
    )
  }
  const h = hist.data
  if (!h) return <section className="mt-10" aria-busy="true"><div className="skeleton h-[320px] w-full" /></section>

  const { period, window: win, metrics } = h
  const t = metrics.tMax
  const tr = t.trend
  const p = tr.mannKendall.pValue
  // Same rule as the trend test elsewhere: a change is called real only when p < 0.05.
  const significant = p < 0.05
  const first = t.annual[0]?.year ?? period.startYear
  const rows = t.annual.map((a) => ({ year: a.year, v: a.value, fit: tr.senIntercept + (tr.senPerDecade / 10) * (a.year - first) }))

  // Today vs history: the latest observed (or example) day from the risk endpoint.
  const days = risk.data?.days ?? []
  const today = [...days].reverse().find((d) => d.kind === 'historical' && d.tMax != null)
  const pr = today?.tMax != null ? percentileRank(today.tMax, t.window.q) : NaN
  const rank = Number.isFinite(pr) ? Math.round(pr) : null

  // Hottest fire seasons on record (ranked by season-average daily high).
  const top = [...t.annual].sort((a, b) => b.value - a.value).slice(0, 3)

  return (
    <section className="mt-10">
      <h3 className="font-display condensed text-[28px] font-bold leading-tight">{period.years} years of NASA weather records for this place</h3>
      <p className="mt-1 text-[15px] text-[var(--color-mute)]">Daily records from {period.startYear} to {period.endYear}, from NASA’s POWER project</p>

      <p className="mt-5 text-[14px] font-semibold">Average daytime high in fire season (May to September), each year</p>
      <div className="mt-2 h-[180px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 6, right: 12, bottom: 0, left: -8 }}>
            <CartesianGrid vertical={false} stroke="#000" strokeOpacity={0.06} />
            <XAxis dataKey="year" type="number" domain={['dataMin', 'dataMax']} ticks={rows.filter((r) => r.year % 10 === 0).map((r) => r.year)} tick={{ fontSize: 13, fill: MUTE }} tickLine={false} axisLine={false} />
            <YAxis domain={['dataMin - 0.5', 'dataMax + 0.5']} tickFormatter={(v: number) => `${Math.round(v)}°`} tick={{ fontSize: 13, fill: MUTE }} tickLine={false} axisLine={false} width={40} allowDecimals={false} />
            <Line dataKey="v" stroke={EMBER} strokeWidth={2.5} dot={{ r: 2.5, fill: EMBER, strokeWidth: 0 }} isAnimationActive={false} />
            <Line dataKey="fit" stroke={INK} strokeOpacity={0.6} strokeWidth={2} strokeDasharray="2 5" strokeLinecap="round" dot={false} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 pl-8 text-[13px] text-[var(--color-mute)]">
        <span className="flex items-center gap-2"><span className="inline-block h-[3px] w-6 rounded" style={{ background: EMBER }} />Each year (°C)</span>
        <span className="flex items-center gap-2"><span className="inline-block w-6 border-t-2 border-dotted" style={{ borderColor: INK }} />Long-term direction</span>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <Fact
          title="Are fire seasons getting hotter here?"
          big={significant ? (tr.senPerDecade > 0 ? 'Yes' : 'No, cooler') : 'Not clear'}
          sub={`${signed(tr.senPerDecade)} °C every 10 years since ${period.startYear}`}
          line={significant ? `This change is ${p < 0.01 ? 'very unlikely' : 'unlikely'} to be chance.` : 'This change could be chance.'}
        />
        <Fact
          title="Today compared with the past"
          big={rank == null ? '—' : `${rank} of 100`}
          sub={rank == null ? 'No reading for today yet' : `Hotter than ${rank} of every 100 ${win.label} days since ${period.startYear}`}
          line={today?.tMax != null ? `Today’s high is ${today.tMax.toFixed(0)} °C. A typical ${win.label} day here reaches ${t.window.mean.toFixed(0)} °C.` : undefined}
        />
        <Fact
          title="Hottest fire season on record"
          big={top[0] ? String(top[0].year) : '—'}
          sub={top[0] ? `The hottest since ${period.startYear}, with an average high of ${top[0].value.toFixed(1)} °C` : 'Not enough data'}
          line={top.length > 2 ? `Next hottest: ${top[1].year} and ${top[2].year}` : undefined}
        />
      </div>

      <p className="mt-4 text-[12.5px] text-[var(--color-mute)]">
        <span className="font-medium">Details for experts:</span> long-term direction is Sen’s slope on the season averages, {signed(tr.senPerDecade, 2)} °C per decade; Mann–Kendall trend test {fmtP(p)}{significant ? '' : ', not significant at 0.05'}. Today is ranked against {win.label} daily highs in every year of the record.
      </p>
      {mode === 'sim' && <p className="mt-2 text-[13px] text-[var(--color-mute)]">Today’s values come from the example scenario; the {period.years}-year record is real NASA data.</p>}
    </section>
  )
}
