import HistoryContext from './HistoryContext.tsx'
import { useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import {
  Area, Bar, CartesianGrid, ComposedChart, Line, LineChart, BarChart, ReferenceArea, ResponsiveContainer, XAxis, YAxis,
} from 'recharts'
import type { DayWeather, RegionRisk, RiskDay } from '../../shared/types.ts'
import { LEVEL_COLORS } from '../../shared/risk.ts'
import { linearTrend, mannKendall, predictBand, type LinearTrend, type MannKendall } from '../../shared/stats.ts'
import { useApi } from '../api.ts'
import { useApp } from '../state.tsx'
import HorizonSelector, { nextWords } from './HorizonSelector.tsx'
import { InfoPopover } from './ui.tsx'

const EMBER = '#c24a17'
const INK = '#1f2328'
const MUTE = '#6b7280'
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

type Confidence = 'High' | 'Medium' | 'Low'
/** Forecast days may carry a confidence grade from the server. */
type Day = RiskDay & { confidence?: Confidence; uncertainty?: number }
const CONF_OPACITY: Record<Confidence, number> = { High: 1, Medium: 0.55, Low: 0.3 }

const label = (t: { date: string; kind: string }) =>
  t.kind === 'today' ? 'Today' : new Date(`${t.date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short' })

/** "p = 0.009", "p = 0.21", "p < 0.001" */
export const fmtP = (p: number) => (p < 0.001 ? 'p < 0.001' : `p = ${p < 0.1 ? p.toFixed(3) : p.toFixed(2)}`)
const signed = (v: number, d = 1) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(d)}`
/** A test result in words, for p < 0.05 only. */
export const chanceWords = (p: number) => (p < 0.01 ? 'very unlikely to be chance' : 'unlikely to be chance')

/** A question in words, then the answer, then one plain line. Statistics live in "Details for experts". */
function StatCard({ question, k, answer, sub, line, color }: { question: string; k: string; answer: string; sub: string; line: string; color?: string }) {
  return (
    <div className="rounded-xl border border-black/10 p-5">
      <p className="text-[14px] font-semibold"><InfoPopover k={k}>{question}</InfoPopover></p>
      <p className="font-display condensed mt-2 text-[34px] font-bold leading-none tabular-nums" style={{ color: color ?? INK }}>{answer}</p>
      <p className="mt-2 text-[15px] font-medium">{sub}</p>
      <p className="mt-1 text-[13px] leading-snug text-[var(--color-mute)]">{line}</p>
    </div>
  )
}

interface MiniProps { title: string; rows: { label: string; v: number | null }[]; lt: LinearTrend | null; color: string; bars?: boolean; tick: (v: string, i: number) => string }

function Mini({ title, rows, lt, color, bars, tick }: MiniProps) {
  const direction = !lt ? '' : lt.pValue < 0.05 ? (lt.slope > 0 ? 'Going up' : 'Going down') : 'No clear change'
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[14px] font-semibold">{title}</p>
        {direction && <p className="text-[13px] text-[var(--color-mute)]">{direction}</p>}
      </div>
      <div className="mt-1 h-[90px]">
        <ResponsiveContainer width="100%" height="100%">
          {bars ? (
            <BarChart data={rows} margin={{ top: 6, right: 4, bottom: 0, left: 4 }}>
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: MUTE }} tickLine={false} axisLine={false} interval={0} tickFormatter={tick} />
              <YAxis hide domain={[0, (max: number) => Math.max(5, max)]} />
              <Bar dataKey="v" fill={color} radius={[3, 3, 0, 0]} isAnimationActive={false} />
            </BarChart>
          ) : (
            <LineChart data={rows} margin={{ top: 6, right: 6, bottom: 0, left: 6 }}>
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: MUTE }} tickLine={false} axisLine={false} interval={0} tickFormatter={tick} />
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

function build(r: RegionRisk, mode: 'live' | 'sim') {
  const tl: Day[] = r.timeline
  const observed = tl.filter((t) => t.kind !== 'forecast')
  const fitObs: LinearTrend = linearTrend(observed.map((t) => t.score))
  const lastObs = observed.length - 1
  const chart = tl.map((t, i) => {
    const b = predictBand(fitObs, i)
    return {
      label: label(t),
      past: t.kind !== 'forecast' ? t.score : null,
      // expected line starts at today so the two segments join
      fcst: t.kind === 'forecast' || i === lastObs ? t.score : null,
      fit: Math.round(b.fit * 10) / 10,
      band: [Math.max(0, b.lo), Math.min(100, b.hi)] as [number, number],
      conf: t.kind === 'forecast' ? t.confidence ?? null : null,
    }
  })
  const mk = mannKendall(tl.map((t) => t.score))

  // Weather aligned to the risk timeline when possible, so all charts share one x axis.
  const byDate = new Map(r.days.map((d) => [d.date, d]))
  const aligned = tl.every((t) => byDate.has(t.date))
  const wx: { label: string; d: DayWeather }[] = aligned
    ? tl.map((t) => ({ label: label(t), d: byDate.get(t.date)! }))
    : r.days.map((d) => ({ label: label(d), d }))
  const todayDate = tl.find((t) => t.kind === 'today')?.date ?? observed.at(-1)?.date
  const todayWx = (todayDate && byDate.get(todayDate)) || r.days.filter((d) => d.kind === 'historical').at(-1)
  const month = mode === 'sim' ? 6 : new Date().getMonth()
  const normal = r.climate?.tempC?.[month]
  const todayHigh = todayWx?.tMax ?? null
  const anomaly = todayHigh != null && normal != null ? todayHigh - normal : null
  const rhTrend = trendOf(wx.map((w) => w.d.rhMin))
  const minis = { tMax: trendOf(wx.map((w) => w.d.tMax)), rhMin: rhTrend, precip: trendOf(wx.map((w) => w.d.precip)) }

  const todayIdx = Math.max(0, tl.findIndex((t) => t.kind === 'today'))
  // Up to 19 days: past, today and a 14-day forecast. Past 10, label today and every other day.
  const tick = (v: string, i: number) => (tl.length <= 10 || (i - todayIdx) % 2 === 0 ? v : '')
  const hasConf = tl.some((t) => t.kind === 'forecast' && t.confidence)
  const nPast = tl.filter((t) => t.kind === 'historical').length

  return { chart, fitObs, mk, wx, anomaly, normal, todayHigh, month, rhTrend, minis, n: tl.length, nObs: observed.length, nPast, tick, hasConf }
}

/** "Is this rise real?" and its answer, following the Mann–Kendall result, never the slope alone. */
function trendCard(mk: MannKendall, n: number) {
  const question = mk.S > 0 ? 'Is this rise real?' : mk.S < 0 ? 'Is this drop real?' : 'Is fire risk really changing?'
  if (mk.trend === 'none') {
    return { question, answer: 'Not clear yet', sub: 'It could be chance', line: `Over these ${n} days, the ups and downs cannot yet be told apart from chance.`, color: undefined }
  }
  const words = chanceWords(mk.pValue)
  return {
    question,
    answer: 'Yes',
    sub: words.charAt(0).toUpperCase() + words.slice(1),
    line: mk.trend === 'rising' ? `Fire risk has gone up steadily over these ${n} days.` : `Fire risk has come down steadily over these ${n} days.`,
    color: mk.trend === 'rising' ? EMBER : undefined,
  }
}

export default function TrendSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { region, mode, horizon } = useApp()
  const risk = useApi<RegionRisk>(open && region ? `risk/${region.id}` : null)
  const r = risk.data
  const s = useMemo(() => (r ? build(r, mode) : null), [r, mode])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const place = region?.short ?? region?.name ?? 'this area'
  const tc = s ? trendCard(s.mk, s.n) : null
  const month = s ? MONTHS[s.month] : ''

  return createPortal(
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={`How fire risk is changing near ${place}`}>
      <div className="absolute inset-0 bg-black/45" onClick={onClose} />
      <div className="fade-in relative max-h-[94vh] w-full max-w-[980px] overflow-y-auto rounded-2xl bg-white p-6 text-[var(--color-fg)] shadow-2xl md:p-8">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full text-[var(--color-mute)] transition-colors hover:bg-black/5 hover:text-[var(--color-fg)]"
        >
          <X size={22} strokeWidth={2.25} />
        </button>

        <h2 className="font-display condensed pr-12 text-[32px] font-bold leading-tight">How fire risk is changing near {place}</h2>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <p className="text-[15px] text-[var(--color-mute)]">The past {s?.nPast ?? 4} days, today and {nextWords(horizon)}</p>
          <HorizonSelector label />
        </div>

        {risk.error ? (
          <div className="mt-8 text-[14px]">
            <p>We could not load fire risk for this area.</p>
            <button type="button" onClick={risk.reload} className="mt-1 font-semibold text-[#c24a17] hover:underline">Try again</button>
          </div>
        ) : !s || !tc ? (
          <div className="skeleton mt-6 h-[300px] w-full" aria-busy="true" />
        ) : (
          <>
            {/* Main chart */}
            <div className="mt-5 h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={s.chart} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
                  <ReferenceArea y1={0} y2={25} fill={LEVEL_COLORS.Low} fillOpacity={0.08} stroke="none" ifOverflow="hidden" />
                  <ReferenceArea y1={25} y2={50} fill={LEVEL_COLORS.Moderate} fillOpacity={0.08} stroke="none" ifOverflow="hidden" />
                  <ReferenceArea y1={50} y2={75} fill={LEVEL_COLORS.High} fillOpacity={0.08} stroke="none" ifOverflow="hidden" />
                  <ReferenceArea y1={75} y2={100} fill={LEVEL_COLORS.Critical} fillOpacity={0.08} stroke="none" ifOverflow="hidden" />
                  <CartesianGrid vertical={false} stroke="#000" strokeOpacity={0.06} />
                  <XAxis dataKey="label" tick={{ fontSize: s.n > 10 ? 13 : 14, fill: INK }} tickLine={false} axisLine={false} interval={0} tickFormatter={s.tick} />
                  <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tick={{ fontSize: 13, fill: MUTE }} tickLine={false} axisLine={false} width={40} />
                  <Area dataKey="band" stroke="none" fill={INK} fillOpacity={0.08} isAnimationActive={false} />
                  <Line dataKey="fit" stroke={INK} strokeOpacity={0.55} strokeWidth={2} strokeDasharray="2 5" strokeLinecap="round" dot={false} isAnimationActive={false} />
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
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 pl-8 text-[13px] text-[var(--color-mute)]">
              <InfoPopover k="pastDay"><span className="inline-block h-[3px] w-6 rounded" style={{ background: EMBER }} />Past days and today</InfoPopover>
              <InfoPopover k="predictedDay"><span className="inline-block w-6 border-t-[3px] border-dashed" style={{ borderColor: EMBER }} />Expected</InfoPopover>
              <InfoPopover k="trendBand"><span className="inline-block w-6 border-t-2 border-dotted" style={{ borderColor: INK }} />General direction and likely range</InfoPopover>
            </div>
            {s.hasConf && <p className="mt-1.5 pl-8 text-[13px] text-[var(--color-mute)]"><InfoPopover k="confidence">Days ahead use the weather forecast, so we are less sure about them than about past days.</InfoPopover></p>}

            {/* Stat cards: each asks its question in words first */}
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <StatCard k="mannKendall" question={tc.question} answer={tc.answer} sub={tc.sub} line={tc.line} color={tc.color} />
              <StatCard
                k="linearTrend"
                question="How fast is it changing?"
                answer={`${signed(s.fitObs.slope)} a day`}
                sub="points out of 100, on average"
                line={`A straight line through the past ${s.nPast} days and today.`}
              />
              {s.anomaly != null ? (
                <StatCard
                  k="tempAnomaly"
                  question="Is it hotter than normal?"
                  answer={`${signed(s.anomaly)} °C`}
                  sub={s.anomaly >= 0 ? `hotter than a normal ${month} day` : `cooler than a normal ${month} day`}
                  line={`Today’s high compared with the usual ${month} high here, ${s.normal!.toFixed(0)} °C${mode === 'sim' ? ', both from the example scenario.' : ', from NASA records.'}`}
                  color={s.anomaly >= 3 ? EMBER : undefined}
                />
              ) : s.rhTrend ? (
                <StatCard
                  k="humidityTrend"
                  question="Is the air getting drier?"
                  answer={s.rhTrend.pValue < 0.05 ? (s.rhTrend.slope < 0 ? 'Yes' : 'No, damper') : 'Not clear yet'}
                  sub={`${signed(s.rhTrend.slope)}% humidity a day`}
                  line="The driest part of each day, over these days."
                />
              ) : null}
            </div>

            {/* Small multiples */}
            <div className="mt-7 grid gap-6 md:grid-cols-3">
              <Mini tick={s.tick} title="Highest temperature each day" lt={s.minis.tMax} color={EMBER} rows={s.wx.map((w) => ({ label: w.label, v: w.d.tMax }))} />
              <Mini tick={s.tick} title="Lowest humidity each day" lt={s.minis.rhMin} color="#2f6db3" rows={s.wx.map((w) => ({ label: w.label, v: w.d.rhMin }))} />
              <Mini tick={s.tick} title="Rain each day" lt={s.minis.precip} color="#3b8fc4" bars rows={s.wx.map((w) => ({ label: w.label, v: w.d.precip }))} />
            </div>

            <p className="mt-6 text-[13px] text-[var(--color-mute)]">
              This is our estimate, not an official fire danger rating, and it has not yet been checked against past fires.
            </p>
            <details className="mt-2 text-[12.5px] text-[var(--color-mute)]">
              <summary className="cursor-pointer font-medium hover:text-[var(--color-fg)]">Details for experts</summary>
              <ul className="mt-2 space-y-1 leading-snug">
                <li>Rise or drop: Mann–Kendall trend test on {s.n} daily scores (past, today and forecast), {fmtP(s.mk.pValue)}, Kendall’s τ = {s.mk.tau.toFixed(2)}; called real only when p &lt; 0.05.</li>
                <li>Speed: least-squares line through the {s.nObs} past and today scores, slope {signed(s.fitObs.slope, 2)} points a day, R² = {s.fitObs.r2.toFixed(2)}, {fmtP(s.fitObs.pValue)}. The shaded range is the 95% confidence band for the fitted line.</li>
                {s.anomaly != null && s.todayHigh != null && <li>Temperature: today’s high {s.todayHigh.toFixed(1)} °C against the {mode === 'sim' ? 'example scenario’s' : 'NASA POWER'} {month} average daily high of {s.normal!.toFixed(1)} °C.</li>}
                {s.rhTrend && <li>Lowest humidity: {signed(s.rhTrend.slope)}% a day, {fmtP(s.rhTrend.pValue)}.</li>}
                {s.minis.tMax && <li>Highest temperature: {signed(s.minis.tMax.slope)} °C a day, {fmtP(s.minis.tMax.pValue)}.</li>}
                {s.minis.precip && <li>Rain: {signed(s.minis.precip.slope)} mm a day, {fmtP(s.minis.precip.pValue)}. Small charts say going up or down only when p &lt; 0.05.</li>}
                <li>The fire risk score is a prototype index, not validated against fire records.</li>
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
