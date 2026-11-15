import HistoryContext from './HistoryContext.tsx'
import { useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import {
  Area, Bar, CartesianGrid, ComposedChart, Line, LineChart, BarChart, ReferenceArea, ResponsiveContainer, XAxis, YAxis,
} from 'recharts'
import type { DayWeather, RegionRisk, RiskDay } from '../../shared/types.ts'
import { LEVEL_COLORS } from '../../shared/risk.ts'
import { linearTrend, mannKendall, predictBand, type LinearTrend } from '../../shared/stats.ts'
import { useApi } from '../api.ts'
import { useApp } from '../state.tsx'
import HorizonSelector from './HorizonSelector.tsx'
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

function StatCard({ label: title, k, big, sub, line, color }: { label: string; k: string; big: string; sub: string; line: string; color?: string }) {
  return (
    <div className="rounded-xl border border-black/10 p-5">
      <p className="text-[13px] font-semibold text-[var(--color-mute)]"><InfoPopover k={k}>{title}</InfoPopover></p>
      <p className="font-display condensed mt-1 text-[40px] font-bold leading-none tabular-nums" style={{ color: color ?? INK }}>{big}</p>
      <p className="mt-2 text-[15px] font-medium tabular-nums">{sub}</p>
      <p className="mt-1 text-[13px] leading-snug text-[var(--color-mute)]">{line}</p>
    </div>
  )
}

interface MiniProps { title: string; unit: string; rows: { label: string; v: number | null }[]; color: string; bars?: boolean; tick: (v: string, i: number) => string }

function Mini({ title, unit, rows, color, bars, tick }: MiniProps) {
  const vals = rows.map((r) => r.v).filter((v): v is number => v != null)
  const lt = vals.length >= 3 ? linearTrend(vals) : null
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[14px] font-semibold">{title}</p>
        {lt && <p className="text-[13px] tabular-nums text-[var(--color-mute)]">{signed(lt.slope)} {unit}/day ({fmtP(lt.pValue)})</p>}
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
      // forecast line starts at today so the two segments join
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
  const anomaly = todayWx?.tMax != null && normal != null ? todayWx.tMax - normal : null
  const rh = wx.map((w) => w.d.rhMin).filter((v): v is number => v != null)
  const rhTrend = rh.length >= 3 ? linearTrend(rh) : null

  const todayIdx = Math.max(0, tl.findIndex((t) => t.kind === 'today'))
  // Up to 19 days: past, today and a 14-day forecast. Past 10, label today and every other day.
  const tick = (v: string, i: number) => (tl.length <= 10 || (i - todayIdx) % 2 === 0 ? v : '')
  const hasConf = tl.some((t) => t.kind === 'forecast' && t.confidence)
  const nPast = tl.filter((t) => t.kind === 'historical').length

  return { chart, fitObs, mk, wx, anomaly, normal, month, rhTrend, n: tl.length, nObs: observed.length, nPast, tick, hasConf }
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

  const mkWord = s ? (s.mk.trend === 'rising' ? 'Rising' : s.mk.trend === 'falling' ? 'Falling' : 'No clear trend') : ''
  const mkLine = s?.mk.trend === 'rising' ? "Risk is going up, and that's unlikely to be chance."
    : s?.mk.trend === 'falling' ? "Risk is coming down, and that's unlikely to be chance."
      : 'Ups and downs we cannot tell apart from chance.'

  return createPortal(
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Risk trend">
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

        <h2 className="font-display condensed pr-12 text-[32px] font-bold leading-tight">Risk trend: {region?.short ?? region?.name}</h2>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <p className="text-[15px] text-[var(--color-mute)]">Past {s?.nPast ?? 4} days, today and {horizon}-day forecast</p>
          <HorizonSelector />
        </div>

        {risk.error ? (
          <div className="mt-8 text-[14px]">
            <p>Couldn't load data</p>
            <button type="button" onClick={risk.reload} className="mt-1 font-semibold text-[#c24a17] hover:underline">Try again</button>
          </div>
        ) : !s ? (
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
                    // Medium and Low confidence forecast days are drawn lighter.
                    dot={(p: { cx?: number; cy?: number; index: number; payload: { conf: Confidence | null } }) => (p.cx == null || p.cy == null
                      ? <g key={p.index} />
                      : <circle key={p.index} cx={p.cx} cy={p.cy} r={4} fill="#fff" stroke={EMBER} strokeWidth={2.5} strokeOpacity={p.payload.conf ? CONF_OPACITY[p.payload.conf] : 1} />)}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 pl-8 text-[13px] text-[var(--color-mute)]">
              <InfoPopover k="pastDay"><span className="inline-block h-[3px] w-6 rounded" style={{ background: EMBER }} />Observed</InfoPopover>
              <InfoPopover k="predictedDay"><span className="inline-block w-6 border-t-[3px] border-dashed" style={{ borderColor: EMBER }} />Predicted</InfoPopover>
              <InfoPopover k="trendBand"><span className="inline-block w-6 border-t-2 border-dotted" style={{ borderColor: INK }} />Trend with 95% band</InfoPopover>
            </div>
            {s.hasConf && <p className="mt-1.5 pl-8 text-[13px] text-[var(--color-mute)]"><InfoPopover k="confidence">Forecast days use forecast weather, so confidence is lower than for observed days.</InfoPopover></p>}

            {/* Stat cards */}
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <StatCard
                label="Trend test (Mann–Kendall)"
                k="mannKendall"
                big={mkWord}
                sub={fmtP(s.mk.pValue)}
                line={mkLine}
                color={s.mk.trend === 'rising' ? EMBER : undefined}
              />
              <StatCard
                label="Linear trend"
                k="linearTrend"
                big={`${signed(s.fitObs.slope)} pts/day`}
                sub={`R² ${s.fitObs.r2.toFixed(2)}, ${fmtP(s.fitObs.pValue)}`}
                line={`Straight line through the ${s.nObs} observed days.`}
              />
              {s.anomaly != null ? (
                <StatCard
                  label="Temperature anomaly"
                  k="tempAnomaly"
                  big={`${signed(s.anomaly)} °C`}
                  sub={s.anomaly >= 0 ? 'above normal' : 'below normal'}
                  line={`Today's high vs the NASA POWER ${MONTHS[s.month]} normal (${s.normal!.toFixed(1)} °C).`}
                  color={s.anomaly >= 3 ? EMBER : undefined}
                />
              ) : s.rhTrend ? (
                <StatCard
                  label="Humidity trend"
                  k="humidityTrend"
                  big={`${signed(s.rhTrend.slope)} %/day`}
                  sub={fmtP(s.rhTrend.pValue)}
                  line="Daily minimum humidity, straight-line fit."
                />
              ) : null}
            </div>

            {/* Small multiples */}
            <div className="mt-7 grid gap-6 md:grid-cols-3">
              <Mini tick={s.tick} title="Max temperature" unit="°C" color={EMBER} rows={s.wx.map((w) => ({ label: w.label, v: w.d.tMax }))} />
              <Mini tick={s.tick} title="Min humidity" unit="%" color="#2f6db3" rows={s.wx.map((w) => ({ label: w.label, v: w.d.rhMin }))} />
              <Mini tick={s.tick} title="Rain" unit="mm" color="#3b8fc4" bars rows={s.wx.map((w) => ({ label: w.label, v: w.d.precip }))} />
            </div>

            <p className="mt-6 text-[12px] text-[var(--color-mute)]">
              Tests on {s.n} daily values; prototype index, not validated against fire records.
            </p>

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
