import type { CSSProperties } from 'react'
import type { PlaceReport, RiskDay, RiskLevel } from '../../../shared/types.ts'
import { HORIZONS } from '../../../shared/horizon.ts'
import { LEVEL_COLORS, LEVEL_STEP, levelLabel } from '../../../shared/risk.ts'
import { useApp } from '../../state.tsx'
import { LevelMeter } from '../ui.tsx'
import { dayOfMonth, fullDate, highestLine, lookAheadDays, todayOf, weekdayLong, weekdayShort } from './words.ts'

const HORIZON_WORDS: Record<number, string> = { 1: '1 day', 3: '3 days', 7: '1 week', 14: '2 weeks' }

/** Today: a solid light tint. Forecast days: white, with a hatched 8 px band along the top that fades the
 *  further out it is ("Further ahead is less certain"). The hatch never runs behind the words. */
function cellStyle(d: RiskDay, i: number, n: number): { className: string; style: CSSProperties } {
  const color = LEVEL_COLORS[d.level]
  if (d.kind === 'today') return { className: '', style: { background: `color-mix(in srgb, ${color} 24%, white)`, printColorAdjust: 'exact' } }
  const steps = Math.max(1, n - 1)
  const alpha = Math.round(30 - ((i - 1) / steps) * 18) // 30% next to today, down to 12% at the far end
  return { className: 'hatch-band', style: { ['--c' as string]: `color-mix(in srgb, ${color} ${alpha}%, transparent)` } }
}

const cellName = (d: RiskDay) => (d.kind === 'today' ? 'Today' : `${weekdayShort(d.date)} ${dayOfMonth(d.date)}`)
const ariaName = (d: RiskDay) => `${d.kind === 'today' ? 'Today' : fullDate(d.date)}: ${levelLabel(d.level)}${d.kind === 'forecast' ? ' (expected)' : ''}`

/** 4 stacked segments, filled bottom-up: the level meter turned on its side for the narrow week cells. */
function MiniMeter({ level }: { level: RiskLevel }) {
  const step = LEVEL_STEP[level]
  return <span aria-hidden className="inline-flex flex-col-reverse gap-[2px]">
    {[1, 2, 3, 4].map((i) => <span key={i} className="h-[6px] w-5 rounded-[2px] border-[1.5px] border-fg"
      style={{ background: i <= step ? LEVEL_COLORS[level] : 'transparent', printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }} />)}
  </span>
}

/** "Look ahead": the horizon control and one cell per day. Tapping a day moves the map to it. */
export default function LookAhead({ place, layout }: { place: PlaceReport; layout: 'cells' | 'list' }) {
  const { horizon, setHorizon, day, setDay } = useApp()
  const days = lookAheadDays(place)
  const today = todayOf(place)
  const selected = day ?? today
  const pick = (d: RiskDay) => setDay(d.kind === 'today' ? null : d.date)
  const compact = layout === 'cells' && days.length > 4
  const ring = (d: RiskDay) => (d.date === selected ? 'shadow-[inset_0_0_0_2px_var(--color-fg)]' : 'shadow-[inset_0_0_0_1px_var(--color-line)]')

  return <section aria-labelledby="look-ahead" className="mt-5">
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
      <h2 id="look-ahead" className="text-[19px] font-semibold">Look ahead</h2>
      <div role="group" aria-label="How far to look ahead" className="inline-flex overflow-hidden rounded-md border border-edge bg-white">
        {HORIZONS.map((h, i) => <button key={h} type="button" aria-pressed={horizon === h} onClick={() => setHorizon(h)}
          className={`h-11 px-3 text-[15px] whitespace-nowrap md:h-10 ${i ? 'border-l border-edge' : ''} ${horizon === h ? 'bg-fg font-semibold text-white' : 'text-fg hover:bg-ink-800'}`}>
          {HORIZON_WORDS[h] ?? `${h} days`}
        </button>)}
      </div>
    </div>

    {compact && <p className="mt-2 text-[15px]">{highestLine(place)}</p>}

    {layout === 'list' ? (
      <ul className="mt-3 border-t border-line">
        {days.map((d, i) => {
          const c = cellStyle(d, i, days.length)
          return <li key={d.date}>
            <button type="button" onClick={() => pick(d)} aria-pressed={d.date === selected} aria-label={ariaName(d)}
              className={`flex min-h-12 w-full items-center justify-between gap-3 border-b border-line px-3 py-2 text-left text-[17px] ${c.className} ${d.date === selected ? 'shadow-[inset_0_0_0_2px_var(--color-fg)]' : ''}`} style={c.style}>
              <span className="font-semibold">{d.kind === 'today' ? 'Today' : `${weekdayLong(d.date)} ${dayOfMonth(d.date)}`}</span>
              <span className="inline-flex items-center gap-2"><LevelMeter level={d.level} /><span className="w-[5.5rem] font-semibold">{levelLabel(d.level)}</span></span>
            </button>
          </li>
        })}
      </ul>
    ) : compact ? (
      <ul className="mt-2.5 grid grid-cols-8 gap-1">
        {days.map((d, i) => {
          const c = cellStyle(d, i, days.length)
          return <li key={d.date}>
            <button type="button" onClick={() => pick(d)} aria-pressed={d.date === selected} aria-label={ariaName(d)} title={ariaName(d)}
              className={`flex w-full flex-col items-center gap-1 rounded-md px-0.5 pt-2.5 pb-2 text-[15px] leading-tight ${c.className} ${ring(d)}`} style={c.style}>
              <span className="font-semibold">{d.kind === 'today' ? 'Today' : weekdayShort(d.date)}</span>
              <span className="num">{d.kind === 'today' ? ' ' : dayOfMonth(d.date)}</span>
              <MiniMeter level={d.level} />
            </button>
          </li>
        })}
      </ul>
    ) : (
      <ul className={`mt-2.5 grid gap-1.5 ${days.length <= 2 ? 'grid-cols-2' : 'grid-cols-4'}`}>
        {days.map((d, i) => {
          const c = cellStyle(d, i, days.length)
          return <li key={d.date}>
            <button type="button" onClick={() => pick(d)} aria-pressed={d.date === selected} aria-label={ariaName(d)}
              className={`flex w-full flex-col items-start gap-1.5 rounded-md px-2.5 pt-2.5 pb-2 text-left text-[15px] leading-tight ${c.className} ${ring(d)}`} style={c.style}>
              <span className="font-semibold">{cellName(d)}</span>
              <LevelMeter level={d.level} size="sm" />
              <span className="font-semibold">{levelLabel(d.level)}</span>
            </button>
          </li>
        })}
      </ul>
    )}
    <p className="mt-1.5 text-[15px] text-mute">
      Further ahead is less certain.{days.length > 1 && day && day !== today ? ` The map shows ${fullDate(day)}.` : ''}
    </p>
  </section>
}
