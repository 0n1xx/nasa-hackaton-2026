// "How fire risk changed this week": the trend sheet opened from the risk panel.
// Plain answer first in each block; Mann–Kendall, R², p, Sen's slope and the 95% band live in
// "Details for experts" (docs/design/critique-and-direction.md, fix 13).
import HistoryContext from './HistoryContext.tsx'
import { useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  Bar, CartesianGrid, ComposedChart, Line, LineChart, BarChart, ReferenceArea, ResponsiveContainer, XAxis, YAxis,
} from 'recharts'
import type { ClimateHistory, DayWeather, RegionRisk, RiskDay, RiskLevel } from '../../shared/types.ts'
import { LEVEL_COLORS, levelLabel } from '../../shared/risk.ts'
import { linearTrend, mannKendall, predictBand, type LinearTrend, type MannKendall } from '../../shared/stats.ts'
import { useApi } from '../api.ts'
import { useApp } from '../state.tsx'
import HorizonSelector, { nextWords } from './HorizonSelector.tsx'

const EMBER = '#c24a17'
const INK = '#1f2328'
const MUTE = '#4a524e'

type Confidence = 'High' | 'Medium' | 'Low'
/** Forecast days may carry a confidence grade from the server. */
type Day = RiskDay & { confidence?: Confidence; uncertainty?: number }
const CONF_OPACITY: Record<Confidence, number> = { High: 1, Medium: 0.55, Low: 0.3 }

const BANDS: { level: RiskLevel; y1: number; y2: number }[] = [
  { level: 'Low', y1: 0, y2: 25 }, { level: 'Moderate', y1: 25, y2: 50 }, { level: 'High', y1: 50, y2: 75 }, { level: 'Critical', y1: 75, y2: 100 },
]
/** Level words on a right-hand axis, one in the middle of each band. */
const bandWord = (v: number) => levelLabel(BANDS.find((b) => v > b.y1 && v < b.y2)?.level ?? 'Low')

const label = (t: { date: string; kind: string }) =>
  t.kind === 'today' ? 'Today' : new Date(`${t.date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short' })

/** "p = 0.009", "p = 0.21", "p < 0.001" */
export const fmtP = (p: number) => (p < 0.001 ? 'p < 0.001' : `p = ${p < 0.1 ? p.toFixed(3) : p.toFixed(2)}`)
/** Below this size a change reads as "No real change", never "−0.0". */
const tiny = (v: number) => Math.abs(v) < 0.05
const signed = (v: number, d = 1) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(d)}`
/** A slope with its unit, or "no real change" when it rounds to nothing. */
const change = (v: number, unit: string, d = 1) => (tiny(v) ? 'no real change' : `${signed(v, d)} ${unit}`)
/** A test result in words, for p < 0.05 only. */
export const chanceWords = (p: number) => (p < 0.01 ? 'very unlikely to be chance' : 'unlikely to be chance')
const about = (v: number) => (Math.abs(v) >= 1 ? String(Math.round(Math.abs(v))) : Math.abs(v).toFixed(1))

/** A question, then the plain answer, then one line of context. */
function Answer({ q, a, line, color }: { q: string; a: string; line?: string; color?: string }) {
  return (
    <div className="border-t border-line pt-4">
      <h3 className="text-[15px] font-semibold text-[var(--color-mute)]">{q}</h3>
      <p className="mt-1.5 text-[19px] font-semibold leading-snug" style={{ color: color ?? INK }}>{a}</p>
      {line && <p className="mt-1.5 text-[15px] leading-snug text-[var(--color-mute)]">{line}</p>}
    </div>
  )
}

interface MiniProps { title: string; rows: { label: string; v: number | null }[]; lt: LinearTrend | null; color: string; bars?: boolean; tick: (v: string, i: number) => string }

function Mini({ title, rows, lt, color, bars, tick }: MiniProps) {
  const direction = !lt ? '' : lt.pValue < 0.05 && !tiny(lt.slope) ? (lt.slope > 0 ? 'Going up' : 'Going down') : 'No clear change'
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[15px] font-semibold">{title}</p>
        {direction && <p className="text-[15px] text-[var(--color-mute)]">{direction}</p>}
      </div>
      <div className="mt-1 h-[96px]">
        <ResponsiveContainer width="100%" height="100%">
          {bars ? (
            <BarChart data={rows} margin={{ top: 6, right: 4, bottom: 0, left: 4 }}>
              <XAxis dataKey="label" tick={{ fontSize: 14, fill: MUTE }} tickLine={false} axisLine={false} interval={0} tickFormatter={tick} />
              <YAxis hide domain={[0, (max: number) => Math.max(5, max)]} />
              <Bar dataKey="v" fill={color} radius={[3, 3, 0, 0]} isAnimationActive={false} />
            </BarChart>
          ) : (
            <LineChart data={rows} margin={{ top: 6, right: 6, bottom: 0, left: 6 }}>
              <XAxis dataKey="label" tick={{ fontSize: 14, fill: MUTE }} tickLine={false} axisLine={false} interval={0} tickFormatter={tick} />
              <YAxis hide domain={['dataMin - 2', 'dataMax + 2']} />
              <Line dataKey="v" stroke={color} strokeWidth={2.5} dot={{ r: 2.5, fill: color }} isAnimationActive={false} connectNulls />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  )
}

const trendOf = (vals: (number | null)[]) => {
  const v = vals.filter((x): x is number => x != null)
  return v.length >= 3 ? linearTrend(v) : null
}

function build(r: RegionRisk, hist: ClimateHistory | null) {
  const tl: Day[] = r.timeline
  const observed = tl.filter((t) => t.kind !== 'forecast')
  const fitObs: LinearTrend = linearTrend(observed.map((t) => t.score))
  const lastObs = observed.length - 1
  const chart = tl.map((t, i) => ({
    label: label(t),
    past: t.kind !== 'forecast' ? t.score : null,
    // expected line starts at today so the two segments join
    fcst: t.kind === 'forecast' || i === lastObs ? t.score : null,
    conf: t.kind === 'forecast' ? t.confidence ?? null : null,
  }))
  // 95% confidence band of the fitted line at today: for the expert details only.
  const band = predictBand(fitObs, lastObs)
  const mk = mannKendall(tl.map((t) => t.score))

  // Weather aligned to the risk timeline when possible, so all charts share one x axis.
  const byDate = new Map(r.days.map((d) => [d.date, d]))
  const aligned = tl.every((t) => byDate.has(t.date))
  const wx: { label: string; d: DayWeather }[] = aligned
    ? tl.map((t) => ({ label: label(t), d: byDate.get(t.date)! }))
    : r.days.map((d) => ({ label: label(d), d }))

  // One temperature normal, the same as HistoryContext: today's high (latest observed or example day)
  // against the NASA POWER daily highs in the calendar window around today (mid-July in the example).
  const todayHigh = [...r.days].reverse().find((d) => d.kind === 'historical' && d.tMax != null)?.tMax ?? null
  const normal = hist?.metrics.tMax.window.mean ?? null
  const anomaly = todayHigh != null && normal != null ? todayHigh - normal : null
  const rhTrend = trendOf(wx.map((w) => w.d.rhMin))
  const minis = { tMax: trendOf(wx.map((w) => w.d.tMax)), rhMin: rhTrend, precip: trendOf(wx.map((w) => w.d.precip)) }

  const todayIdx = Math.max(0, tl.findIndex((t) => t.kind === 'today'))
  // Up to 19 days: past, today and a 14-day forecast. Past 10, label today and every other day.
  const tick = (v: string, i: number) => (tl.length <= 10 || (i - todayIdx) % 2 === 0 ? v : '')
  // Small charts are narrow: label only the first day, today and the last day.
  const miniTick = (v: string, i: number) => (i === 0 || i === todayIdx || i === wx.length - 1 ? v : '')
  const hasConf = tl.some((t) => t.kind === 'forecast' && t.confidence)
  const nPast = tl.filter((t) => t.kind === 'historical').length

  return { chart, fitObs, band, mk, wx, anomaly, normal, todayHigh, rhTrend, minis, n: tl.length, nObs: observed.length, nPast, tick, miniTick, hasConf }
}

/** "Is this rise real?" and its answer, following the Mann–Kendall result, never the slope alone. */
function trendAnswer(mk: MannKendall, n: number) {
  const q = mk.S > 0 ? 'Is this rise real?' : mk.S < 0 ? 'Is this drop real?' : 'Is fire risk really changing?'
  if (mk.trend === 'none') return { q, a: 'Not clear yet. It could be chance.', line: `Over these ${n} days, the ups and downs cannot yet be told apart from chance.`, color: undefined }
  return {
    q,
    a: `Yes, it is ${chanceWords(mk.pValue)}.`,
    line: mk.trend === 'rising' ? `Fire risk has gone up steadily over these ${n} days.` : `Fire risk has come down steadily over these ${n} days.`,
    color: mk.trend === 'rising' ? EMBER : undefined,
  }
}

export default function TrendSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { region, mode, horizon } = useApp()
  const risk = useApi<RegionRisk>(open && region ? `risk/${region.id}` : null)
  const hist = useApi<ClimateHistory>(open && region ? `climate-history/${region.id}` : null)
  const r = risk.data
  const s = useMemo(() => (r ? build(r, hist.data) : null), [r, hist.data])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const place = region?.short ?? region?.name ?? 'this area'
  const ta = s ? trendAnswer(s.mk, s.n) : null
  const example = mode === 'sim'
  const normalWords = example ? 'a normal mid-July day' : 'normal for this time of year'
  const win = hist.data?.window
  const years = hist.data?.period.years ?? 42

  return createPortal(
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={`How fire risk changed this week near ${place}`}>
      <div className="absolute inset-0 bg-black/45" onClick={onClose} />
      <div className="fade-in relative max-h-[94vh] w-full max-w-[980px] overflow-y-auto rounded-2xl bg-white p-6 text-[var(--color-fg)] shadow-2xl md:p-8">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-lg text-[var(--color-mute)] transition-colors hover:bg-black/5 hover:text-[var(--color-fg)]"
        >
          <X size={22} strokeWidth={2.25} />
        </button>

        <h2 className="pr-12 text-[28px] font-semibold leading-tight">How fire risk changed this week near {place}</h2>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <p className="text-[15px] text-[var(--color-mute)]">The past {s?.nPast ?? 4} days, today and {nextWords(horizon)}</p>
          <HorizonSelector label />
        </div>

        {risk.error ? (
          <div className="mt-8 text-[16px]">
            <p>We could not load fire risk for this area.</p>
            <button type="button" onClick={risk.reload} className="mt-1 font-semibold text-[var(--color-action)] hover:underline">Try again</button>
          </div>
        ) : !s || !ta ? (
          <div className="skeleton mt-6 h-[300px] w-full" aria-busy="true" />
        ) : (
          <>
            {/* Main chart */}
            <p className="mt-6 text-[15px] font-semibold text-[var(--color-mute)]">Fire risk, out of 100</p>
            <div className="mt-1 h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={s.chart} margin={{ top: 8, right: 0, bottom: 0, left: 0 }}>
                  {BANDS.map((b) => <ReferenceArea key={b.level} y1={b.y1} y2={b.y2} fill={LEVEL_COLORS[b.level]} fillOpacity={0.1} stroke="none" ifOverflow="hidden" />)}
                  <CartesianGrid vertical={false} stroke="#000" strokeOpacity={0.06} />
                  <XAxis dataKey="label" tick={{ fontSize: 14, fill: INK }} tickLine={false} axisLine={false} interval={0} tickFormatter={s.tick} />
                  <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tick={{ fontSize: 14, fill: MUTE }} tickLine={false} axisLine={false} width={44} />
                  <YAxis yAxisId="level" orientation="right" type="number" domain={[0, 100]} ticks={[12.5, 37.5, 62.5, 87.5]} tickFormatter={bandWord} tick={{ fontSize: 14, fill: MUTE }} tickLine={false} axisLine={false} width={78} />
                  {/* Invisible series so the level axis always renders. */}
                  <Line yAxisId="level" dataKey="past" stroke="none" dot={false} activeDot={false} legendType="none" isAnimationActive={false} />
                  <Line dataKey="past" stroke={EMBER} strokeWidth={3.5} dot={{ r: 4, fill: EMBER, strokeWidth: 0 }} isAnimationActive={false} />
                  <Line
                    dataKey="fcst" stroke={EMBER} strokeWidth={3.5} strokeDasharray="9 6" isAnimationActive={false}
                    // Medium and Low confidence days ahead are drawn lighter.
                    dot={(p: { cx?: number; cy?: number; index: number; payload: { conf: Confidence | null } }) => (p.cx == null || p.cy == null
                      ? <g key={p.index} />
                      : <circle key={p.index} cx={p.cx} cy={p.cy} r={4} fill="#fff" stroke={EMBER} strokeWidth={2.5} strokeOpacity={p.payload.conf ? CONF_OPACITY[p.payload.conf] : 1} />)}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 pl-11 text-[15px] text-[var(--color-mute)]">
              <span className="flex items-center gap-2"><span className="inline-block h-[3px] w-6 rounded" style={{ background: EMBER }} />Past days and today</span>
              <span className="flex items-center gap-2"><span className="inline-block w-6 border-t-[3px] border-dashed" style={{ borderColor: EMBER }} />Expected</span>
            </div>
            {s.hasConf && <p className="mt-1.5 pl-11 text-[15px] text-[var(--color-mute)]">Days ahead use the weather forecast, so we are less sure about them. The further ahead, the lighter the dot.</p>}

            {/* Plain answers: the question, then the answer, then one line */}
            <div className="mt-7 grid gap-5 md:grid-cols-3">
              <Answer q={ta.q} a={ta.a} line={ta.line} color={ta.color} />
              <Answer
                q="How fast is it changing?"
                a={tiny(s.fitObs.slope) ? 'No real change.' : `${s.fitObs.slope > 0 ? 'Up' : 'Down'} about ${about(s.fitObs.slope)} points a day.`}
                line={`On average, over the past ${s.nPast} days and today, on the score out of 100.`}
              />
              {s.anomaly != null && s.normal != null && s.todayHigh != null ? (
                <Answer
                  q="Is it hotter than normal?"
                  a={tiny(s.anomaly) ? (example ? 'About the same as a normal mid-July day.' : 'About normal for this time of year.') : s.anomaly > 0
                    ? `Yes, ${s.anomaly.toFixed(1)} °C hotter than ${normalWords}.`
                    : `No, ${Math.abs(s.anomaly).toFixed(1)} °C cooler than ${normalWords}.`}
                  line={`Today’s high is ${s.todayHigh.toFixed(0)} °C. ${example ? 'A typical mid-July day' : 'A typical day at this time of year'} here reaches ${s.normal.toFixed(0)} °C, from ${years} years of NASA records.${example ? ' This example is set in mid-July.' : ''}`}
                  color={s.anomaly >= 3 ? EMBER : undefined}
                />
              ) : s.rhTrend ? (
                <Answer
                  q="Is the air getting drier?"
                  a={s.rhTrend.pValue < 0.05 && !tiny(s.rhTrend.slope) ? (s.rhTrend.slope < 0 ? 'Yes, it is getting drier.' : 'No, it is getting damper.') : 'Not clear yet.'}
                  line={tiny(s.rhTrend.slope) ? 'The driest part of each day shows no real change.' : `The driest part of each day changed by about ${about(s.rhTrend.slope)}% humidity a day.`}
                />
              ) : null}
            </div>

            {/* Small multiples */}
            <div className="mt-8 grid gap-6 md:grid-cols-3">
              <Mini tick={s.miniTick} title="Highest temperature each day" lt={s.minis.tMax} color={EMBER} rows={s.wx.map((w) => ({ label: w.label, v: w.d.tMax }))} />
              <Mini tick={s.miniTick} title="Lowest humidity each day" lt={s.minis.rhMin} color="#2f6db3" rows={s.wx.map((w) => ({ label: w.label, v: w.d.rhMin }))} />
              <Mini tick={s.miniTick} title="Rain each day" lt={s.minis.precip} color="#3b8fc4" bars rows={s.wx.map((w) => ({ label: w.label, v: w.d.precip }))} />
            </div>

            <p className="mt-7 text-[15px] text-[var(--color-mute)]">
              This is our estimate, not an official fire danger rating, and it has not yet been checked against past fires.
            </p>
            <details className="mt-3 text-[15px]">
              <summary className="cursor-pointer font-semibold text-[var(--color-mute)] hover:text-[var(--color-fg)]">Details for experts</summary>
              <ul className="mt-2 list-disc space-y-1.5 pl-5 leading-relaxed text-[var(--color-mute)]">
                <li>Rise or drop: Mann–Kendall trend test on {s.n} daily scores (past, today and expected), {fmtP(s.mk.pValue)}, Kendall’s τ = {s.mk.tau.toFixed(2)}. Called real only when p &lt; 0.05.</li>
                <li>Speed: least-squares line through the {s.nObs} past and today scores, slope {change(s.fitObs.slope, 'points a day', 2)}, R² = {s.fitObs.r2.toFixed(2)}, {fmtP(s.fitObs.pValue)} (t-test on the slope). 95% confidence band for the fitted line at today: {Math.max(0, s.band.lo).toFixed(0)} to {Math.min(100, s.band.hi).toFixed(0)}.</li>
                {s.anomaly != null && s.todayHigh != null && s.normal != null && <li>Temperature: today’s high {s.todayHigh.toFixed(1)} °C against the mean daily high of {s.normal.toFixed(1)} °C for {win?.label ?? 'this window'} in every year of the NASA POWER record ({years} years). The same normal is used in the long-term section below.</li>}
                {s.rhTrend && <li>Lowest humidity: {change(s.rhTrend.slope, '% a day')}, {fmtP(s.rhTrend.pValue)}.</li>}
                {s.minis.tMax && <li>Highest temperature: {change(s.minis.tMax.slope, '°C a day')}, {fmtP(s.minis.tMax.pValue)}.</li>}
                {s.minis.precip && <li>Rain: {change(s.minis.precip.slope, 'mm a day')}, {fmtP(s.minis.precip.pValue)}. Small charts say going up or down only when p &lt; 0.05.</li>}
                <li>The fire risk score is a prototype, not validated against fire records. <Link to="/about#trend" onClick={onClose} className="text-[var(--color-action)] underline">How the score and these tests work</Link></li>
              </ul>
            </details>

            <div className="mt-8 border-t border-line pt-6">
              <HistoryContext />
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  )
}
