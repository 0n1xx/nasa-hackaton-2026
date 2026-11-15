import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Info } from 'lucide-react'
import type { DataKind, RiskLevel, SourceMeta } from '../../shared/types.ts'
import { LEVEL_COLORS } from '../../shared/risk.ts'
import { aqiBand } from '../../shared/aqi.ts'
import type { ApiState } from '../api.ts'
import { useApp } from '../state.tsx'
import { EXPLAIN } from '../explain.ts'

// Colours follow the tokens in styles.css: moss (observed), sky (forecast), sun (simulated), mute (the rest).
export const KIND: Record<DataKind, { label: string; color: string; desc: string }> = {
  observed: { label: 'Observed', color: '#2e7d57', desc: 'Measured by satellites or reported by fire agencies' },
  historical: { label: 'Historical', color: '#52615a', desc: 'Past records and long-term averages' },
  forecast: { label: 'Forecast', color: '#2f6690', desc: 'Predicted by weather or air quality models' },
  model: { label: 'Model estimate', color: '#52615a', desc: 'Calculated by a model, including our risk index' },
  simulated: { label: 'Simulated', color: '#8a6400', desc: 'Invented for demonstration; not real' },
  reference: { label: 'Reference', color: '#52615a', desc: 'Static reference information' },
}

export function KindBadge({ kind, explain = true }: { kind: DataKind; explain?: boolean }) {
  const k = KIND[kind]
  const badge = <span title={explain ? undefined : k.desc} className="inline-flex items-center gap-1.5 text-[12px] font-medium whitespace-nowrap" style={{ color: k.color }}>
    <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ background: k.color }} />{k.label}
  </span>
  return explain ? <InfoPopover k={`kind.${kind}`}>{badge}</InfoPopover> : badge
}

export const fmtTime = (iso: string) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? iso : d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) }
export const fmt = (v: number | null | undefined, digits = 0, unit = '') => (v == null || Number.isNaN(v) ? '—' : `${v.toLocaleString(undefined, { maximumFractionDigits: digits, minimumFractionDigits: digits })}${unit}`)

/** Source and timestamp for every dataset, on one compact line. Hover a source for its caveat. */
export function Sources({ sources }: { sources: SourceMeta[] }) {
  if (!sources.length) return null
  return <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[12px] text-dim">
    {sources.map((s) => <li key={s.id} title={s.note} className="flex items-center gap-1.5">
      <InfoPopover k={`kind.${s.kind}`} className="gap-1.5">
        <span role="img" aria-label={KIND[s.kind].label} className="h-1.5 w-1.5 rounded-full" style={{ background: KIND[s.kind].color }} />
        {!s.label.startsWith(KIND[s.kind].label) && <span style={{ color: KIND[s.kind].color }}>{KIND[s.kind].label}</span>}
      </InfoPopover>
      {s.url ? <a className="text-mute underline decoration-line underline-offset-2 hover:text-fg hover:decoration-mute" href={s.url} target="_blank" rel="noreferrer">{s.label}</a> : <span className="text-mute">{s.label}</span>}
      <span className="num">{fmtTime(s.fetchedAt)}</span>
    </li>)}
  </ul>
}

export function Panel({ title, info, sub, right, children, className = '' }: { title?: string; info?: string; sub?: string; right?: ReactNode; children: ReactNode; className?: string }) {
  return <section className={`panel fade-in ${className}`}>
    {(title || right) && <header className="mb-4 flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
      <div className="min-w-0">{title && <h2 className={`font-display condensed text-[24px] leading-tight font-semibold ${info ? "flex items-center gap-2" : ""}`}>{title}{info && <InfoDot k={info} />}</h2>}{sub && <p className="mt-1 max-w-[62ch] text-[13px] leading-relaxed text-mute">{sub}</p>}</div>
      {right}
    </header>}
    {children}
  </section>
}

/** Loading, error and empty states for anything backed by useApi. */
export function Async<T>({ state, children, height = 160, empty }: { state: ApiState<T>; children: (data: T) => ReactNode; height?: number; empty?: (d: T) => string | null }) {
  const { mode, setMode } = useApp()
  if (state.loading && !state.data) return <div className="skeleton" style={{ height }} role="status" aria-label="Loading" />
  if (state.error) return <div role="alert" className="flex flex-col items-start gap-2.5 rounded-lg border border-flame/40 bg-flame/5 p-4" style={{ minHeight: Math.min(height, 120) }}>
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
  return <button type="button" title={title} onClick={onClick} aria-pressed={active} className={`rounded-md border px-3 py-1.5 text-[13px] ${active ? 'border-fg bg-fg font-medium text-white' : 'border-edge bg-ink-950 text-mute hover:border-mute hover:text-fg'}`}>{children}</button>
}

/** A router link styled as a button. `primary` is the one ember action on a screen. */
export function ButtonLink({ to, children, primary = false }: { to: string; children: ReactNode; primary?: boolean }) {
  return <Link to={to} className={`inline-flex min-h-11 items-center justify-center rounded-md px-5 text-[15px] font-semibold whitespace-nowrap ${primary ? 'bg-ember-deep text-white hover:bg-[#a63f12]' : 'border border-edge bg-ink-950 text-fg hover:border-fg'}`}>{children}</Link>
}

export function Stat({ label, value, unit, hint, color }: { label: string; value: ReactNode; unit?: string; hint?: ReactNode; color?: string }) {
  return <div className="min-w-0">
    <p className="label">{label}</p>
    <p className="num mt-1 text-[22px] leading-none font-medium" style={{ color }}>{value}{unit && <span className="ml-1 text-[12px] text-mute">{unit}</span>}</p>
    {hint && <p className="mt-1 text-[11.5px] text-mute">{hint}</p>}
  </div>
}

/** Level swatch plus ink text: the level colours are too light to carry text on white. */
export function RiskPill({ level, score, explain = true }: { level: RiskLevel; score?: number; explain?: boolean }) {
  const pill = <span className="num inline-flex items-center gap-1.5 text-[13px] whitespace-nowrap">
    <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: LEVEL_COLORS[level] }} />
    {score != null && <span className="font-semibold text-fg">{score}</span>}
    <span className="text-mute">{level}</span>
  </span>
  return explain ? <InfoPopover k={`level.${level}`}>{pill}</InfoPopover> : pill
}

export function AqiPill({ aqi, explain = true }: { aqi: number | null; explain?: boolean }) {
  const b = aqiBand(aqi)
  if (!b) return <span className="num text-dim">—</span>
  const pill = <span className="num inline-flex items-center gap-1.5 text-[13px] whitespace-nowrap" title={explain ? undefined : `US AQI ${aqi}: ${b.label}`}>
    <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: b.color }} />
    <span className="font-semibold text-fg">{aqi}</span><span className="text-mute">{b.label}</span>
  </span>
  return explain ? <InfoPopover k="aqi">{pill}</InfoPopover> : pill
}

export function PageHead({ kicker, title, children }: { kicker: string; title: string; children?: ReactNode }) {
  return <div className="mb-10">
    <p className="text-[13px] font-medium text-mute">{kicker}</p>
    <h1 className="font-display condensed mt-1.5 text-[34px] leading-[1.02] font-bold tracking-[-0.01em] text-balance md:text-[44px]">{title}</h1>
    {children && <p className="mt-3 max-w-[68ch] text-[14.5px] leading-relaxed text-mute">{children}</p>}
  </div>
}

export const chartAxis = { stroke: '#75827c', fontSize: 11, tickLine: false, axisLine: { stroke: '#d9ded9' } } as const
export const chartGrid = { stroke: '#e8ebe7', strokeDasharray: '3 3', vertical: false } as const
export const tooltipStyle = { contentStyle: { background: '#ffffff', border: '1px solid #d9ded9', borderRadius: 8, fontSize: 12, boxShadow: '0 2px 8px rgb(19 33 27 / 0.08)' }, labelStyle: { color: '#52615a' }, itemStyle: { color: '#13211b' }, cursor: { fill: 'rgb(19 33 27 / 0.04)' } } as const

/** Any marker, swatch or heading that explains itself: click or tap toggles a small card from EXPLAIN. Esc or an outside click closes it. */
export function InfoPopover({ k, children, className = '' }: { k: keyof typeof EXPLAIN | string; children: ReactNode; className?: string }) {
  const e = EXPLAIN[k]
  const [open, setOpen] = useState(false)
  const [place, setPlace] = useState<{ right: boolean; up: boolean }>({ right: false, up: false })
  const wrap = useRef<HTMLSpanElement>(null)
  const id = useId()

  useEffect(() => {
    if (!open) return
    const r = wrap.current?.getBoundingClientRect()
    if (r) setPlace({ right: r.left + 296 > window.innerWidth, up: r.bottom + 190 > window.innerHeight && r.top > 200 })
    const away = (ev: PointerEvent) => { if (!wrap.current?.contains(ev.target as Node)) setOpen(false) }
    const esc = (ev: KeyboardEvent) => { if (ev.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', away)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', esc) }
  }, [open])

  if (!e) return <span className={className}>{children}</span>
  return <span ref={wrap} className="relative inline-flex">
    <button type="button" aria-expanded={open} aria-controls={id} onClick={(ev) => { ev.stopPropagation(); setOpen((o) => !o) }}
      className={`inline-flex cursor-pointer items-center gap-2 rounded-md text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#13211b] ${className}`}>
      {children}
    </button>
    {open && <span id={id} role="dialog" aria-label={e.title}
      className={`absolute z-[1100] block w-[280px] max-w-[calc(100vw-32px)] rounded-xl border border-line bg-white p-3 text-left text-[13px] leading-snug font-normal text-fg normal-case shadow-lg ${place.up ? 'bottom-full mb-2' : 'top-full mt-2'} ${place.right ? 'right-0' : 'left-0'}`}>
      <span className="block font-semibold">{e.title}</span>
      <span className="mt-1.5 block"><span className="text-mute">What: </span>{e.what}</span>
      <span className="mt-1 block"><span className="text-mute">Source: </span>{e.source}</span>
      <span className="mt-1 block"><span className="text-mute">How to read: </span>{e.read}</span>
    </span>}
  </span>
}

/** A small info icon for headings, explained from EXPLAIN. */
export function InfoDot({ k }: { k: keyof typeof EXPLAIN | string }) {
  return <InfoPopover k={k} className="text-mute hover:text-fg"><Info size={14} aria-label={`About ${EXPLAIN[k]?.title ?? k}`} /></InfoPopover>
}
