import type { ReactNode } from 'react'
import type { DataKind, RiskLevel, SourceMeta } from '../../shared/types.ts'
import { LEVEL_COLORS } from '../../shared/risk.ts'
import { aqiBand } from '../../shared/aqi.ts'
import type { ApiState } from '../api.ts'
import { useApp } from '../state.tsx'

export const KIND: Record<DataKind, { label: string; color: string; desc: string }> = {
  observed: { label: 'Observed', color: '#7fc8a0', desc: 'Measured by satellites or reported by fire agencies' },
  historical: { label: 'Historical', color: '#9aa7b4', desc: 'Past records and long-term averages' },
  forecast: { label: 'Forecast', color: '#9cc4e4', desc: 'Predicted by weather or air quality models' },
  model: { label: 'Model estimate', color: '#9aa7b4', desc: 'Calculated by a model, including our risk index' },
  simulated: { label: 'Simulated', color: '#d9b44a', desc: 'Invented for demonstration; not real' },
  reference: { label: 'Reference', color: '#9aa7b4', desc: 'Static reference information' },
}

export function KindBadge({ kind }: { kind: DataKind }) {
  const k = KIND[kind]
  return <span title={k.desc} className="inline-flex items-center gap-1.5 text-[12px] whitespace-nowrap" style={{ color: k.color }}>
    <span className="h-1.5 w-1.5 rounded-full" style={{ background: k.color }} />{k.label}
  </span>
}

export const fmtTime = (iso: string) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? iso : d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) }
export const fmt = (v: number | null | undefined, digits = 0, unit = '') => (v == null || Number.isNaN(v) ? '—' : `${v.toLocaleString(undefined, { maximumFractionDigits: digits, minimumFractionDigits: digits })}${unit}`)

/** Source and timestamp for every dataset, on one compact line. Hover a source for its caveat. */
export function Sources({ sources }: { sources: SourceMeta[] }) {
  if (!sources.length) return null
  return <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[12px] text-dim">
    {sources.map((s) => <li key={s.id} title={s.note} className="flex items-center gap-1.5">
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: KIND[s.kind].color }} />
      <span style={{ color: KIND[s.kind].color }}>{KIND[s.kind].label}</span>
      {s.url ? <a className="text-mute underline decoration-line underline-offset-2 hover:text-fg" href={s.url} target="_blank" rel="noreferrer">{s.label}</a> : <span className="text-mute">{s.label}</span>}
      <span className="num">{fmtTime(s.fetchedAt)}</span>
    </li>)}
  </ul>
}

export function Panel({ title, sub, right, children, className = '' }: { title?: string; sub?: string; right?: ReactNode; children: ReactNode; className?: string }) {
  return <section className={`panel fade-in ${className}`}>
    {(title || right) && <header className="mb-3 flex flex-wrap items-start justify-between gap-2">
      <div>{title && <h2 className="text-[16px] font-semibold">{title}</h2>}{sub && <p className="mt-0.5 text-[13px] text-mute">{sub}</p>}</div>
      {right}
    </header>}
    {children}
  </section>
}

/** Loading, error and empty states for anything backed by useApi. */
export function Async<T>({ state, children, height = 160, empty }: { state: ApiState<T>; children: (data: T) => ReactNode; height?: number; empty?: (d: T) => string | null }) {
  const { mode, setMode } = useApp()
  if (state.loading && !state.data) return <div className="skeleton" style={{ height }} role="status" aria-label="Loading" />
  if (state.error) return <div role="alert" className="flex flex-col items-start gap-2.5 rounded-lg border border-flame/40 bg-flame/8 p-4" style={{ minHeight: Math.min(height, 120) }}>
    <p className="font-medium text-flame">Data unavailable</p>
    <p className="text-[13px] text-mute">{state.error}</p>
    <div className="flex flex-wrap gap-2">
      <Btn onClick={state.reload}>Try again</Btn>
      {mode === 'live' && <Btn onClick={() => setMode('sim')}>Open the simulated scenario instead</Btn>}
    </div>
  </div>
  if (!state.data) return null
  const msg = empty?.(state.data)
  if (msg) return <div className="rounded-lg border border-dashed border-line p-5 text-center text-[13px] text-mute">{msg}</div>
  return <div className={state.loading ? 'opacity-60 transition-opacity' : 'transition-opacity'}>{children(state.data)}</div>
}

export function Btn({ children, onClick, active, title }: { children: ReactNode; onClick?: () => void; active?: boolean; title?: string }) {
  return <button type="button" title={title} onClick={onClick} aria-pressed={active} className={`rounded-lg border px-3 py-1.5 text-[13px] ${active ? 'border-fg bg-fg text-ink-950 font-medium' : 'border-[#2a3642] text-mute hover:border-mute hover:text-fg'}`}>{children}</button>
}

export function Stat({ label, value, unit, hint, color }: { label: string; value: ReactNode; unit?: string; hint?: ReactNode; color?: string }) {
  return <div className="min-w-0">
    <p className="label">{label}</p>
    <p className="num mt-1 text-[22px] leading-none font-medium" style={{ color }}>{value}{unit && <span className="ml-1 text-[12px] text-mute">{unit}</span>}</p>
    {hint && <p className="mt-1 text-[11.5px] text-mute">{hint}</p>}
  </div>
}

export function RiskPill({ level, score }: { level: RiskLevel; score?: number }) {
  const c = LEVEL_COLORS[level]
  return <span className="num inline-flex items-center gap-1.5 text-[13px] font-medium whitespace-nowrap" style={{ color: c }}>
    {score != null && <span>{score}</span>}{level}
  </span>
}

export function AqiPill({ aqi }: { aqi: number | null }) {
  const b = aqiBand(aqi)
  if (!b) return <span className="num text-dim">—</span>
  return <span className="num inline-flex items-center gap-1.5 text-[13px] font-medium whitespace-nowrap" style={{ color: b.color }} title={`US AQI ${aqi}: ${b.label}`}>{aqi} {b.label}</span>
}

export function PageHead({ kicker, title, children }: { kicker: string; title: string; children?: ReactNode }) {
  return <div className="mb-8">
    <p className="label">{kicker}</p>
    <h1 className="mt-1 text-[26px] leading-tight font-semibold md:text-[30px]">{title}</h1>
    {children && <p className="mt-2 max-w-3xl text-[14px] leading-relaxed text-mute">{children}</p>}
  </div>
}

export const chartAxis = { stroke: '#7f8c99', fontSize: 11, tickLine: false, axisLine: { stroke: '#1f2933' } } as const
export const chartGrid = { stroke: '#1f2933', strokeDasharray: '3 3', vertical: false } as const
export const tooltipStyle = { contentStyle: { background: '#141b22', border: '1px solid #1f2933', borderRadius: 8, fontSize: 12 }, labelStyle: { color: '#9aa7b4' }, itemStyle: { color: '#eef1f4' }, cursor: { fill: 'rgb(238 241 244 / 0.05)' } } as const
