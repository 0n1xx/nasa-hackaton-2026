import { useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import type { PlaceReport, RiskLevel } from '../../../shared/types.ts'
import { LEVEL_COLORS, levelLabel } from '../../../shared/risk.ts'
import {
  dayOfMonth, fullDate, heatTrendSentence, humidityTrendSentence, rainTrendSentence, riskTrendSentence, todayIndex,
  trendDays, weekdayShort, windTrendSentence, type TrendDay,
} from './words.ts'

// "How things are changing": fire risk day by day, then the weather behind it as small multiples on the same day
// axis. Hand-drawn SVG (no chart library on this page, so phones stay light). Every chart has its sentence above it,
// today's value written on it, and the same numbers in a table, so nothing needs a tooltip.

const INK = '#1b1f1d', MUTE = '#4a524e', GRID = '#e4e3dc', BASE = '#b8b7ae', TODAY_BG = '#efede6', RAIN = '#2f6690'
/** Right-hand gutter for the axis words, the same on every day chart so the days line up from chart to chart. */
const GUTTER = 84
const FS = 14
const LEVELS: RiskLevel[] = ['Low', 'Moderate', 'High', 'Critical']

function useWidth() {
  const ref = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    setW(Math.floor(el.getBoundingClientRect().width))
    const ro = new ResizeObserver(([e]) => setW(Math.floor(e.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, w] as const
}

const safeId = (s: string) => s.replace(/[^a-zA-Z0-9_-]/g, '')
const num = (v: number) => { const n = Math.round(v); return n < 0 ? `−${-n}` : String(n) }

interface Geo { n: number; plotW: number; step: number; bar: number; cx: (i: number) => number; t: number }
function geo(w: number, n: number, t: number): Geo {
  const plotW = Math.max(80, w - GUTTER), step = plotW / Math.max(1, n)
  return { n, plotW, step, bar: Math.max(4, Math.min(24, step - 3)), cx: (i) => step * (i + 0.5), t }
}

/** Day names under a chart. Today always; the others as room allows (first, last, then outwards from today). */
function DayLabels({ days, g, y, dates }: { days: TrendDay[]; g: Geo; y: number; dates: boolean }) {
  const text = (i: number) => (days[i].kind === 'today' ? 'Today' : weekdayShort(days[i].date))
  const width = (i: number) => text(i).length * 8 + 6
  const order = [g.t, 0, g.n - 1, ...days.map((_, i) => i).sort((a, b) => Math.abs(a - g.t) - Math.abs(b - g.t))]
  const placed: [number, number][] = []
  const shown = new Set<number>()
  for (const i of order) {
    if (shown.has(i)) continue
    const half = width(i) / 2, c = g.cx(i)
    if (c - half < -2 || c + half > g.plotW + GUTTER - 2) continue
    if (placed.some(([a, b]) => c - half < b + 4 && c + half > a - 4)) continue
    placed.push([c - half, c + half]); shown.add(i)
  }
  return <g aria-hidden fontSize={FS} textAnchor="middle">
    {[...shown].map((i) => <g key={i}>
      <text x={g.cx(i)} y={y} fill={INK} fontWeight={i === g.t ? 600 : 400}>{text(i)}</text>
      {dates && <text x={g.cx(i)} y={y + 17} fill={MUTE}>{dayOfMonth(days[i].date)}</text>}
    </g>)}
  </g>
}

/** 45° stripes for the days ahead: expected, so less certain. */
function Hatch({ id, color }: { id: string; color: string }) {
  return <pattern id={id} patternUnits="userSpaceOnUse" width={6} height={6} patternTransform="rotate(45)">
    <rect width={6} height={6} fill="#ffffff" /><rect width={3} height={6} fill={color} />
  </pattern>
}

const colPath = (x: number, y: number, w: number, yb: number, r = 3) => {
  const rr = Math.min(r, w / 2, Math.max(0, yb - y))
  return `M${x},${yb}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${yb}Z`
}

/** Fading of the stripes further ahead, as on the look-ahead cells ("Further ahead is less certain"). */
const aheadAlpha = (i: number, g: Geo) => (i <= g.t ? 1 : 1 - 0.45 * ((i - g.t - 1) / Math.max(1, g.n - g.t - 2)))

function RiskChart({ days, w, label }: { days: TrendDay[]; w: number; label: string }) {
  const uid = safeId(useId())
  const g = geo(w, days.length, todayIndex(days))
  const top = 8, plotH = 136, H = top + plotH + 44
  const y = (s: number) => top + plotH * (1 - Math.max(0, Math.min(100, s)) / 100)
  return <svg width={w} height={H} role="img" aria-label={label} className="block overflow-visible">
    <defs>{LEVELS.map((l) => <Hatch key={l} id={`${uid}-${l}`} color={LEVEL_COLORS[l]} />)}</defs>
    <rect x={g.t * g.step} y={0} width={g.step} height={top + plotH} fill={TODAY_BG} />
    {[25, 50, 75].map((v) => <line key={v} x1={0} x2={g.plotW} y1={y(v)} y2={y(v)} stroke={GRID} />)}
    <line x1={0} x2={g.plotW} y1={y(0)} y2={y(0)} stroke={BASE} />
    {/* The four levels, as a key on the right: colour strip and word. */}
    {LEVELS.map((l, k) => <g key={l} aria-hidden>
      <rect x={g.plotW + 8} y={y((k + 1) * 25) + 1} width={6} height={plotH / 4 - 2} fill={LEVEL_COLORS[l]} stroke={INK} strokeWidth={1} />
      <text x={g.plotW + 20} y={y(k * 25 + 12.5)} dominantBaseline="middle" fontSize={FS} fill={INK}>{levelLabel(l)}</text>
    </g>)}
    {days.map((d, i) => {
      const s = d.risk.score, x = g.cx(i) - g.bar / 2, yt = Math.min(y(s), y(0) - 2)
      const ahead = d.kind === 'forecast'
      const p = colPath(x, yt, g.bar, y(0))
      const u = d.risk.uncertainty
      return <g key={d.date}>
        <path d={p} fill={ahead ? `url(#${uid}-${d.risk.level})` : LEVEL_COLORS[d.risk.level]} opacity={aheadAlpha(i, g)} />
        <path d={p} fill="none" stroke={INK} strokeWidth={i === g.t ? 2.5 : 1.25} />
        {u != null && u > 0 && <g stroke={INK} strokeLinecap="round">
          <line x1={g.cx(i)} x2={g.cx(i)} y1={y(s + u)} y2={y(s - u)} stroke="#ffffff" strokeWidth={4} />
          <line x1={g.cx(i)} x2={g.cx(i)} y1={y(s + u)} y2={y(s - u)} strokeWidth={1.5} strokeOpacity={0.75} />
          <line x1={g.cx(i) - 3} x2={g.cx(i) + 3} y1={y(s + u)} y2={y(s + u)} strokeWidth={1.5} strokeOpacity={0.75} />
        </g>}
      </g>
    })}
    <DayLabels days={days} g={g} y={top + plotH + 19} dates />
  </svg>
}

interface MiniSpec { get: (d: TrendDay) => number | null | undefined; domain: (vals: number[]) => [number, number, number[]]; unit: (v: number, top: boolean) => string; value: (v: number) => string; bars?: boolean }

const ceilTo = (v: number, s: number) => Math.ceil(v / s) * s
const SPECS: Record<'heat' | 'humidity' | 'wind' | 'rain', MiniSpec> = {
  heat: {
    get: (d) => d.wx?.tMax,
    domain: (vals) => {
      let lo = Math.floor(Math.min(...vals) / 5) * 5, hi = Math.ceil(Math.max(...vals) / 5) * 5
      if (hi === lo) hi += 5
      while (hi - lo < 10) { if (hi - Math.max(...vals) < Math.min(...vals) - lo) hi += 5; else lo -= 5 }
      const ticks: number[] = []
      for (let v = lo; v <= hi; v += 5) ticks.push(v)
      return [lo, hi, ticks.length > 3 ? [lo, (lo + hi) / 2, hi] : ticks]
    },
    unit: (v, top) => (top ? `${num(v)} °C` : num(v)), value: (v) => `${num(v)} °C`,
  },
  humidity: { get: (d) => d.wx?.rhMin, domain: () => [0, 100, [0, 50, 100]], unit: (v) => `${num(v)}%`, value: (v) => `${num(v)}%` },
  wind: {
    get: (d) => d.wx?.windMax,
    domain: (vals) => { const hi = Math.max(40, ceilTo(Math.max(...vals), 20)); return [0, hi, [0, hi / 2, hi]] },
    unit: (v, top) => (top ? `${num(v)} km/h` : num(v)), value: (v) => `${num(v)} km/h`,
  },
  rain: {
    get: (d) => d.wx?.precip, bars: true,
    domain: (vals) => { const hi = Math.max(10, ceilTo(Math.max(...vals), 10)); return [0, hi, [0, hi]] },
    unit: (v, top) => (top ? `${num(v)} mm` : num(v)), value: (v) => (v < 0.5 ? 'none' : `${v < 10 ? (Math.round(v * 10) / 10).toString() : num(v)} mm`),
  },
}

function MiniChart({ days, w, spec, label }: { days: TrendDay[]; w: number; spec: MiniSpec; label: string }) {
  const uid = safeId(useId())
  const g = geo(w, days.length, todayIndex(days))
  const vals = days.map(spec.get).map((v) => (v != null && Number.isFinite(v) ? v : null))
  const present = vals.filter((v): v is number => v != null)
  const top = 22, plotH = 60, H = top + plotH + 26
  if (!present.length) return <p className="text-[15px] text-mute">No readings for these days.</p>
  const [lo, hi, ticks] = spec.domain(present)
  const y = (v: number) => top + plotH * (1 - (v - lo) / (hi - lo))
  const pts = vals.map((v, i) => (v == null ? null : { x: g.cx(i), y: y(v), i }))
  // Solid through the past days and today, dashed from today into the days ahead.
  const seg = (from: number, to: number) => {
    let d = '', pen = false
    for (let i = from; i <= to; i++) { const p = pts[i]; if (!p) { pen = false; continue } d += `${pen ? 'L' : 'M'}${p.x},${p.y}`; pen = true }
    return d
  }
  const tv = vals[g.t]
  const tx = Math.max(24, Math.min(g.plotW - 8, g.cx(g.t)))
  return <svg width={w} height={H} role="img" aria-label={label} className="block overflow-visible">
    <defs><Hatch id={`${uid}-r`} color={RAIN} /></defs>
    <rect x={g.t * g.step} y={0} width={g.step} height={top + plotH} fill={TODAY_BG} />
    {ticks.map((v, k) => <g key={v}>
      <line x1={0} x2={g.plotW} y1={y(v)} y2={y(v)} stroke={v === lo ? BASE : GRID} />
      <text x={g.plotW + 8} y={y(v)} dominantBaseline="middle" fontSize={FS} fill={MUTE}>{spec.unit(v, k === ticks.length - 1)}</text>
    </g>)}
    {spec.bars
      ? vals.map((v, i) => v == null || v < 0.05 ? null : <g key={i} opacity={aheadAlpha(i, g)}>
        <path d={colPath(g.cx(i) - g.bar / 2, Math.min(y(v), y(0) - 2), g.bar, y(0))} fill={days[i].kind === 'forecast' ? `url(#${uid}-r)` : RAIN} />
        {days[i].kind === 'forecast' && <path d={colPath(g.cx(i) - g.bar / 2, Math.min(y(v), y(0) - 2), g.bar, y(0))} fill="none" stroke={RAIN} strokeWidth={1} />}
      </g>)
      : <>
        <path d={seg(0, g.t)} fill="none" stroke={INK} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        <path d={seg(g.t, g.n - 1)} fill="none" stroke={INK} strokeWidth={2} strokeDasharray="5 4" strokeLinejoin="round" />
        {pts.map((p) => p && <circle key={p.i} cx={p.x} cy={p.y} r={p.i === g.t ? 5 : 3.5}
          fill={days[p.i].kind === 'forecast' ? '#ffffff' : INK} stroke={days[p.i].kind === 'forecast' ? INK : '#ffffff'} strokeWidth={days[p.i].kind === 'forecast' ? 1.5 : 2} />)}
      </>}
    {tv != null && <text x={tx} y={Math.min(y(tv), y(lo)) - 9} textAnchor="middle" fontSize={FS} fontWeight={600} fill={INK} stroke="#ffffff" strokeWidth={4} paintOrder="stroke">{spec.value(tv)}</text>}
    <DayLabels days={days} g={g} y={top + plotH + 19} dates={false} />
  </svg>
}

/** "Friday 10 July: 26 °C. Saturday 11 July: 25 °C (expected)." for a screen reader. */
const listFor = (days: TrendDay[], get: (d: TrendDay) => number | null | undefined, fmt: (v: number) => string) =>
  days.map((d) => { const v = get(d); return `${d.kind === 'today' ? 'Today' : fullDate(d.date)}: ${v == null ? 'no reading' : fmt(v)}${d.kind === 'forecast' ? ' (expected)' : ''}` }).join('. ')

function Figure({ title, what, children }: { title: string; what: string; children: ReactNode }) {
  return <figure className="mt-5 border-t border-line pt-3">
    <h3 className="text-[17px] leading-[1.45] font-semibold">{title}</h3>
    <figcaption className="mt-0.5 text-[15px] text-mute">{what}</figcaption>
    <div className="mt-2">{children}</div>
  </figure>
}

export default function Trends({ place, example }: { place: PlaceReport; example: boolean }) {
  const [ref, w] = useWidth()
  const [table, setTable] = useState(false)
  const days = trendDays(place)
  if (days.length < 2) return null
  const past = days.filter((d) => d.kind === 'historical').length
  const ahead = days.filter((d) => d.kind === 'forecast').length
  const span = `The past ${past} days, today and ${ahead === 1 ? 'tomorrow' : `the next ${ahead} days`}.`
  const minis = [
    { key: 'heat' as const, title: heatTrendSentence(days), what: 'Highest temperature each day' },
    { key: 'humidity' as const, title: humidityTrendSentence(days), what: 'Lowest humidity each day: the lower, the drier the air' },
    { key: 'wind' as const, title: windTrendSentence(days), what: 'Strongest wind each day' },
    { key: 'rain' as const, title: rainTrendSentence(days), what: 'Rain each day' },
  ]
  const riskTitle = riskTrendSentence(place)
  const fmtRain = (v: number) => (v < 0.5 ? 'no rain' : `${(Math.round(v * 10) / 10).toString()} mm`)

  return <section aria-labelledby="trends" className="mt-5">
    <h2 id="trends" className="text-[19px] font-semibold">How things are changing</h2>
    <p className="mt-1 text-[15px] leading-[1.45] text-mute">{span} Striped bars and dashed lines are days ahead: expected, so less certain.{example ? ' In this example the weather is made up.' : ''}</p>

    <div ref={ref} className="min-w-0">
      <Figure title={riskTitle} what="Fire risk each day, our estimate">
        {w > 0 ? <RiskChart days={days} w={w} label={`${riskTitle} ${days.map((d) => `${d.kind === 'today' ? 'Today' : fullDate(d.date)}: ${levelLabel(d.risk.level)}, ${d.risk.score} out of 100${d.kind === 'forecast' ? ' (expected)' : ''}`).join('. ')}.`} /> : <div style={{ height: 188 }} />}
        <p className="mt-1 text-[15px] leading-[1.45] text-mute">The thin line on each bar shows how much higher or lower that day could be.</p>
      </Figure>

      {minis.map((m) => m.title && <Figure key={m.key} title={m.title} what={m.what}>
        {w > 0 ? <MiniChart days={days} w={w} spec={SPECS[m.key]} label={`${m.title} ${listFor(days, SPECS[m.key].get, m.key === 'rain' ? fmtRain : SPECS[m.key].value)}.`} /> : <div style={{ height: 108 }} />}
      </Figure>)}
    </div>

    <button type="button" aria-expanded={table} onClick={() => setTable((v) => !v)}
      className="mt-3 inline-flex min-h-10 items-center rounded-md border border-edge bg-white px-3 text-[15px] font-semibold hover:bg-ink-800">
      {table ? 'Hide the numbers' : 'See the numbers'}
    </button>
    {table && <div className="fade-in mt-3 overflow-x-auto">
      <table className="num w-full border-collapse text-left text-[14px] leading-snug">
        <caption className="sr-only">Fire risk and weather each day</caption>
        <thead className="text-mute">
          <tr className="border-b border-line align-bottom">
            <th scope="col" className="py-1.5 pr-2 font-semibold">Day</th>
            <th scope="col" className="py-1.5 pr-2 font-semibold">Fire risk</th>
            <th scope="col" className="py-1.5 pr-2 font-semibold">High °C</th>
            <th scope="col" className="py-1.5 pr-2 font-semibold">Humidity %</th>
            <th scope="col" className="py-1.5 pr-2 font-semibold">Wind km/h</th>
            <th scope="col" className="py-1.5 font-semibold">Rain mm</th>
          </tr>
        </thead>
        <tbody>
          {days.map((d) => <tr key={d.date} className={`border-b border-line ${d.kind === 'today' ? 'font-semibold' : ''}`}>
            <th scope="row" className="py-1.5 pr-2 font-[inherit]">{d.kind === 'today' ? 'Today' : `${weekdayShort(d.date)} ${dayOfMonth(d.date)}`}{d.kind === 'forecast' ? '*' : ''}</th>
            <td className="py-1.5 pr-2">{levelLabel(d.risk.level)} {d.risk.score}</td>
            <td className="py-1.5 pr-2">{d.wx?.tMax != null ? num(d.wx.tMax) : '–'}</td>
            <td className="py-1.5 pr-2">{d.wx?.rhMin != null ? num(d.wx.rhMin) : '–'}</td>
            <td className="py-1.5 pr-2">{d.wx?.windMax != null ? num(d.wx.windMax) : '–'}</td>
            <td className="py-1.5">{d.wx?.precip != null ? (Math.round(d.wx.precip * 10) / 10).toString() : '–'}</td>
          </tr>)}
        </tbody>
      </table>
      <p className="mt-1.5 text-[14px] text-mute">* Expected. Fire risk is out of 100, our estimate.</p>
    </div>}
  </section>
}
