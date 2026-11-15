import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { Info } from 'lucide-react'
import type { DataKind, RiskLevel, SourceMeta } from '../../shared/types.ts'
import { LEVEL_COLORS, levelLabel } from '../../shared/risk.ts'
import { aqiBand } from '../../shared/aqi.ts'
import type { ApiState } from '../api.ts'
import { useApp } from '../state.tsx'
import { EXPLAIN } from '../explain.ts'

// Colours follow the tokens in styles.css: moss (observed), sky (forecast), sun (simulated), mute (the rest).
export const KIND: Record<DataKind, { label: string; color: string; desc: string }> = {
  observed: { label: 'Measured', color: '#2e7d57', desc: 'Seen by satellites or reported by fire agencies' },
  historical: { label: 'Past records', color: '#52615a', desc: 'Past records and long-term averages' },
  forecast: { label: 'Forecast', color: '#2f6690', desc: 'What weather and smoke models expect' },
  model: { label: 'Estimate', color: '#52615a', desc: 'Worked out by a model, including our fire risk score' },
  simulated: { label: 'Example scenario', color: '#8a6400', desc: 'Made up to show how the app works; not real' },
  reference: { label: 'Reference', color: '#52615a', desc: 'Fixed background information' },
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

/** "10:34 PM" for today, "Nov 13, 10:34 PM" otherwise. */
export const fmtUpdated = (iso: string) => {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  return d.toDateString() === new Date().toDateString() ? time : `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${time}`
}

/** "49.98° N, 88.79° W" */
export const fmtPlace = (lat: number, lon: number) =>
  `${Math.abs(lat).toFixed(2)}° ${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lon).toFixed(2)}° ${lon >= 0 ? 'E' : 'W'}`

const PLACE_NAMES: Record<string, string> = {
  AB: 'Alberta', BC: 'British Columbia', MB: 'Manitoba', NB: 'New Brunswick', NL: 'Newfoundland and Labrador', NS: 'Nova Scotia',
  NT: 'Northwest Territories', NU: 'Nunavut', ON: 'Ontario', PE: 'Prince Edward Island', QC: 'Quebec', SK: 'Saskatchewan', YT: 'Yukon',
  PC: 'Parks Canada',
}
/** Province, territory or agency code spelled out ("ON" -> "Ontario"); anything else is passed through. */
export const placeName = (code: string | null | undefined) => (code ? PLACE_NAMES[code.toUpperCase()] ?? code : '')

// A Canadian football field including both end zones: 150 × 65 yards = 137.16 m × 59.44 m ≈ 8,152 m².
const FOOTBALL_FIELD_HA = (137.16 * 59.436) / 10000

/** "13,663 hectares (about 17,000 football fields)", "less than 1 hectare". */
export const fmtArea = (ha: number | null | undefined) => {
  if (ha == null || Number.isNaN(ha)) return 'not reported'
  if (ha < 1) return 'less than 1 hectare'
  const rounded = Math.round(ha)
  const fields = ha / FOOTBALL_FIELD_HA
  const n = fields < 10 ? Math.max(1, Math.round(fields)) : Number(fields.toPrecision(2))
  return `${rounded.toLocaleString('en-US')} hectare${rounded === 1 ? '' : 's'} (about ${n.toLocaleString('en-US')} football field${n === 1 ? '' : 's'})`
}

/** Where a dataset came from, in plain words, from its id. Example data says so instead. */
export function sourceLine(s: SourceMeta | undefined): string | null {
  if (!s) return null
  if (s.kind === 'simulated') return 'Example scenario, not real conditions'
  const from: Record<string, string> = {
    'cwfis-active': 'From Canada’s wildfire information system (CWFIS)',
    'cwfis-hotspots': 'Satellite heat data from Canada’s wildfire information system (CWFIS)',
    'open-meteo-weather': 'Our estimate from Open-Meteo weather and satellite heat data',
    'open-meteo-air': 'From the Open-Meteo air quality model',
    communities: 'From a short list of public, approximate community locations',
  }
  const text = from[s.id] ?? (s.id.startsWith('firms') ? 'Satellite heat data from NASA FIRMS' : `From ${s.label}`)
  return s.kind === 'reference' ? text : `${text}, updated ${fmtUpdated(s.fetchedAt)}`
}

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
    <p className="font-medium text-flame">We could not load this right now</p>
    <p className="text-[13px] text-mute">{state.error}</p>
    <div className="flex flex-wrap gap-2">
      <Btn onClick={state.reload}>Try again</Btn>
      {mode === 'live' && <Btn onClick={() => setMode('sim')}>Open the example scenario instead</Btn>}
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

/** Level swatch plus ink text: the level colours are too light to carry text on white. Words first, the score second. */
export function RiskPill({ level, score, explain = true }: { level: RiskLevel; score?: number; explain?: boolean }) {
  const pill = <span className="num inline-flex items-center gap-1.5 text-[13px] whitespace-nowrap" title={score != null ? `${levelLabel(level)} fire risk, ${score} out of 100` : undefined}>
    <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: LEVEL_COLORS[level] }} />
    <span className="font-semibold text-fg">{levelLabel(level)}</span>
    {score != null && <span className="text-mute">({score})</span>}
  </span>
  return explain ? <InfoPopover k={`level.${level}`}>{pill}</InfoPopover> : pill
}

export function AqiPill({ aqi, explain = true }: { aqi: number | null; explain?: boolean }) {
  const b = aqiBand(aqi)
  if (!b) return <span className="num text-dim">—</span>
  const pill = <span className="num inline-flex items-center gap-1.5 text-[13px] whitespace-nowrap" title={explain ? undefined : `Air quality ${aqi}: ${b.label}`}>
    <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: b.color }} />
    <span className="font-semibold text-fg">{b.label}</span><span className="text-mute">({aqi})</span>
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

const EDGE = 8 // closest the card may come to the window edge
const GAP = 6 // space between trigger and card

/**
 * Any marker, swatch or heading that explains itself: click or tap toggles a small card from EXPLAIN.
 * The card lives in a portal on document.body with fixed positioning, so no panel, map or sheet can clip it.
 * It opens below the trigger, flips above when there is no room, and is clamped inside the window.
 * Esc (which returns focus to the trigger), a click outside, scrolling the page or the panel around it, or resizing closes it.
 */
export function InfoPopover({ k, children, className = '' }: { k: keyof typeof EXPLAIN | string; children: ReactNode; className?: string }) {
  const e = EXPLAIN[k]
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const card = useRef<HTMLSpanElement>(null)
  const id = useId()

  const close = useCallback((refocus = false) => {
    setOpen(false)
    setPos(null)
    if (refocus) trigger.current?.focus()
  }, [])

  // Measure the rendered card, then place it before the browser paints.
  useLayoutEffect(() => {
    if (!open) return
    const t = trigger.current?.getBoundingClientRect()
    const c = card.current
    if (!t || !c) return
    const vw = document.documentElement.clientWidth || window.innerWidth
    const vh = window.innerHeight
    const w = c.offsetWidth, h = c.offsetHeight
    const left = Math.max(EDGE, Math.min(t.left, vw - w - EDGE))
    const below = t.bottom + GAP, above = t.top - GAP - h
    const fitsBelow = below + h <= vh - EDGE, fitsAbove = above >= EDGE
    let top = fitsBelow || (!fitsAbove && vh - t.bottom >= t.top) ? below : above
    top = Math.max(EDGE, Math.min(top, vh - h - EDGE))
    setPos({ top, left })
  }, [open])

  useEffect(() => {
    if (!open) return
    const inside = (n: EventTarget | null) => n instanceof Node && (!!trigger.current?.contains(n) || !!card.current?.contains(n))
    const away = (ev: PointerEvent) => { if (!inside(ev.target)) close() }
    // Stop Esc here so it closes only the card, not a sheet the card sits in.
    const esc = (ev: KeyboardEvent) => { if (ev.key === 'Escape') { ev.stopPropagation(); close(true) } }
    // Close when the trigger moves: the page or any box around the trigger scrolled. Other scrolling (the card, a map strip) is ignored.
    const scroll = (ev: Event) => {
      const t = ev.target
      if (t === document || t === window || (t instanceof Node && trigger.current && t.contains(trigger.current))) close()
    }
    const resize = () => close()
    document.addEventListener('pointerdown', away)
    document.addEventListener('keydown', esc)
    window.addEventListener('scroll', scroll, true)
    window.addEventListener('resize', resize)
    return () => {
      document.removeEventListener('pointerdown', away)
      document.removeEventListener('keydown', esc)
      window.removeEventListener('scroll', scroll, true)
      window.removeEventListener('resize', resize)
    }
  }, [open, close])

  if (!e) return <span className={className}>{children}</span>
  return <span className="relative inline-flex">
    <button ref={trigger} type="button" aria-expanded={open} aria-controls={open ? id : undefined} aria-haspopup="dialog"
      onClick={(ev) => { ev.stopPropagation(); if (open) close(); else setOpen(true) }}
      className={`inline-flex cursor-pointer items-center gap-2 rounded-md text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#13211b] ${className}`}>
      {children}
    </button>
    {open && createPortal(
      <span ref={card} id={id} role="dialog" aria-label={e.title} onClick={(ev) => ev.stopPropagation()}
        style={{ position: 'fixed', top: pos?.top ?? 0, left: pos?.left ?? 0, visibility: pos ? 'visible' : 'hidden' }}
        className="z-[3000] block w-[288px] max-w-[calc(100vw-16px)] rounded-xl border border-line bg-white p-3.5 text-left font-sans text-[13.5px] leading-snug font-normal tracking-normal text-fg normal-case shadow-[0_10px_30px_rgb(19_33_27/0.18)]">
        <span className="block text-[14px] font-semibold">{e.title}</span>
        <span className="mt-1 block">{e.body}</span>
        {e.detail && <span className="mt-2 block text-[12px] leading-snug text-mute">{e.detail}</span>}
      </span>,
      document.body,
    )}
  </span>
}

/** A small info icon for headings, explained from EXPLAIN. */
export function InfoDot({ k }: { k: keyof typeof EXPLAIN | string }) {
  return <InfoPopover k={k} className="text-mute hover:text-fg"><Info size={14} aria-label={`About ${EXPLAIN[k]?.title ?? k}`} /></InfoPopover>
}
