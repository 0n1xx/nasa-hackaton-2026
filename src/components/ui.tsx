import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { RiskLevel } from '../../shared/types.ts'
import { LEVEL_COLORS, LEVEL_STEP, levelLabel } from '../../shared/risk.ts'
import { EXPLAIN } from '../explain.ts'

/**
 * The 4-step level meter: 1 to 4 filled segments, each outlined in ink, so a level reads without
 * colour (greyscale print, washed-out projector). Always pair it with the level word.
 *   <LevelMeter level="High" />            [▮▮▮▯]
 *   <LevelMeter level="High" size="lg" />  bigger segments for the community status
 */
export function LevelMeter({ level, size = 'md', className = '' }: { level: RiskLevel; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const step = LEVEL_STEP[level], fill = LEVEL_COLORS[level]
  const seg = size === 'lg' ? 'h-4 w-7' : size === 'sm' ? 'h-2.5 w-3.5' : 'h-3 w-5'
  return <span role="img" aria-label={`${levelLabel(level)}: ${step} of 4`} className={`inline-flex shrink-0 items-center gap-[3px] ${className}`}>
    {[1, 2, 3, 4].map((i) => <span key={i} className={`${seg} rounded-[2px] border-[1.5px] border-fg`}
      style={{ background: i <= step ? fill : 'transparent', printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }} />)}
  </span>
}

/** "High" with its meter, the standard way to show a level in a sentence or a row. */
export function LevelTag({ level, size = 'md' }: { level: RiskLevel; size?: 'sm' | 'md' | 'lg' }) {
  return <span className="inline-flex items-center gap-2 whitespace-nowrap"><LevelMeter level={level} size={size} /><span className="font-semibold">{levelLabel(level)}</span></span>
}

export const fmt = (v: number | null | undefined, digits = 0, unit = '') => (v == null || Number.isNaN(v) ? '—' : `${v.toLocaleString(undefined, { maximumFractionDigits: digits, minimumFractionDigits: digits })}${unit}`)

const PLACE_NAMES: Record<string, string> = {
  AB: 'Alberta', BC: 'British Columbia', MB: 'Manitoba', NB: 'New Brunswick', NL: 'Newfoundland and Labrador', NS: 'Nova Scotia',
  NT: 'Northwest Territories', NU: 'Nunavut', ON: 'Ontario', PE: 'Prince Edward Island', QC: 'Quebec', SK: 'Saskatchewan', YT: 'Yukon',
  PC: 'Parks Canada',
}
/** Province, territory or agency code spelled out ("ON" -> "Ontario"); anything else is passed through. */
export const placeName = (code: string | null | undefined) => (code ? PLACE_NAMES[code.toUpperCase()] ?? code : '')

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

