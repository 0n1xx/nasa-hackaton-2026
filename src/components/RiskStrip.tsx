import type { CSSProperties } from 'react'
import type { RiskDay } from '../../shared/types.ts'
import { LEVEL_COLORS, levelLabel } from '../../shared/risk.ts'
import { InfoPopover } from './ui.tsx'

// One column per day of the risk timeline: past estimates, today, forecast.
// Bars are scaled 0–100 so the guides at 50 (High begins) and 75 (Very high begins) are honest.
// Past bars are solid, today is solid with a shaded band behind it, forecast bars are outlined and
// hatched, so the three read differently in greyscale and in print as well as in colour.

const at = (iso: string) => new Date(`${iso}T12:00:00`)
const dayShort = (iso: string) => at(iso).toLocaleDateString('en-CA', { weekday: 'short' })
const dayNum = (iso: string) => at(iso).getDate()
const dayLong = (iso: string) => at(iso).toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric' })

const PHASE: Record<RiskDay['kind'], { label: string; sr: string }> = {
  historical: { label: 'Past days', sr: 'past estimate' },
  today: { label: 'Today', sr: 'today' },
  forecast: { label: 'Expected', sr: 'expected' },
}

// Plot and guide-label gutter share one height so the guide labels line up with the lines.
const PLOT_H = 'h-[150px] sm:h-[200px] lg:h-[220px]'
const GAP = 'gap-x-1.5 sm:gap-x-2.5'
const GAP_DENSE = 'gap-x-[3px] sm:gap-x-1.5'

export default function RiskStrip({ timeline }: { timeline: RiskDay[] }) {
  if (!timeline.length) return null
  const cols: CSSProperties = { gridTemplateColumns: `repeat(${timeline.length}, minmax(0, 1fr))` }
  // Long horizons (up to 4 past + today + 14 forecast): tighter gaps, smaller numbers, and on narrow screens
  // day labels for today and every other day only.
  const dense = timeline.length > 10
  const gap = dense ? GAP_DENSE : GAP
  const todayIdx = Math.max(0, timeline.findIndex((d) => d.kind === 'today'))

  // Consecutive runs of the same kind, for the phase labels above the columns.
  const runs: { kind: RiskDay['kind']; count: number }[] = []
  for (const d of timeline) {
    const last = runs[runs.length - 1]
    if (last && last.kind === d.kind) last.count++
    else runs.push({ kind: d.kind, count: 1 })
  }

  return <figure className="min-w-0">
    <div className="grid grid-cols-[minmax(0,1fr)_3.75rem] gap-x-2 sm:grid-cols-[minmax(0,1fr)_4.25rem]">
      {/* Phase labels */}
      <div className={`grid ${gap}`} style={cols} aria-hidden>
        {runs.map((r, i) => <div key={i} style={{ gridColumn: `span ${r.count}` }} className={`border-t-2 pt-1.5 text-[11.5px] whitespace-nowrap sm:text-[12.5px] ${r.kind === 'today' ? 'border-fg text-center font-semibold text-fg' : 'border-edge text-mute'}`}>
          {PHASE[r.kind].label}
        </div>)}
      </div>
      <div aria-hidden />

      {/* Plot */}
      <div className={`relative mt-10 ${PLOT_H}`} aria-hidden>
        {[50, 75].map((g) => <div key={g} className={`absolute inset-x-0 border-t-[1.5px] border-dashed ${g === 75 ? 'border-flame' : 'border-fg/50'}`} style={{ bottom: `${g}%` }} />)}
        <div className="absolute inset-x-0 bottom-0 border-t border-fg/70" />
        <div className={`relative grid h-full ${gap}`} style={cols}>
          {timeline.map((d, i) => {
            const c = LEVEL_COLORS[d.level], fc = d.kind === 'forecast', today = d.kind === 'today'
            const delay = `${i * (dense ? 35 : 70)}ms`
            const bar: CSSProperties = fc
              ? ({ height: `${Math.max(d.score, 1.5)}%`, borderColor: c, '--c': c, animationDelay: delay } as CSSProperties)
              : { height: `${Math.max(d.score, 1.5)}%`, background: c, opacity: today ? 1 : 0.72, animationDelay: delay }
            return <div key={d.date} className="relative h-full" title={`${dayLong(d.date)}: ${levelLabel(d.level)} fire risk (${d.score} out of 100), ${PHASE[d.kind].sr}`}>
              {today && <div className="absolute inset-x-0 -top-10 bottom-0 rounded-t-md bg-ink-800" />}
              <div className={`strip-bar absolute inset-x-0 bottom-0 mx-auto w-[min(74%,3.25rem)] rounded-t-[3px] ${fc ? 'hatch border-[1.5px] border-b-0' : ''}`} style={bar} />
              <span className={`strip-num num font-display condensed absolute inset-x-0 text-center leading-none font-semibold text-fg ${dense ? (today ? 'text-[15px] sm:text-[24px]' : 'text-[10px] sm:text-[15px] lg:text-[17px]') : today ? 'text-[21px] sm:text-[30px]' : 'text-[15px] sm:text-[20px]'}`}
                style={{ bottom: `calc(${d.score}% + 6px)`, animationDelay: `${i * (dense ? 35 : 70) + 350}ms` }}>{d.score}</span>
            </div>
          })}
        </div>
      </div>

      {/* Guide labels, in a gutter wide enough for "Very high" so they never sit on a bar */}
      <div className={`relative mt-10 ${PLOT_H}`} aria-hidden>
        {([[75, 'Critical'], [50, 'High']] as const).map(([g, name]) => <span key={g} className={`absolute left-0 translate-y-1/2 text-[11.5px] leading-none font-semibold whitespace-nowrap sm:text-[12.5px] ${g === 75 ? 'text-flame' : 'text-mute'}`} style={{ bottom: `${g}%` }}>{levelLabel(name)}</span>)}
      </div>

      {/* Day labels */}
      <div className={`mt-2 grid ${gap}`} style={cols} aria-hidden>
        {timeline.map((d, i) => <div key={d.date} className={`text-center leading-tight ${dense ? 'text-[10.5px] sm:text-[12px]' : 'text-[12px] sm:text-[12.5px]'} ${d.kind === 'today' ? 'font-semibold text-fg' : 'text-mute'} ${dense && (i - todayIdx) % 2 !== 0 ? 'max-md:invisible' : ''}`}>
          {dayShort(d.date)}<span className={`num block ${d.kind === 'today' ? 'text-fg' : 'text-dim'}`}>{dayNum(d.date)}</span>
        </div>)}
      </div>
      <div aria-hidden />
    </div>

    {/* The same data for screen readers */}
    <ol className="sr-only">
      {timeline.map((d) => <li key={d.date}>{dayLong(d.date)}, {PHASE[d.kind].sr}: {levelLabel(d.level)} fire risk, {d.score} out of 100.</li>)}
    </ol>

    <figcaption className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[12px] text-mute">
      <InfoPopover k="pastDay" className="gap-1.5"><span aria-hidden className="h-3 w-3 rounded-[2px] bg-mute/70" />Past days, estimated</InfoPopover>
      <InfoPopover k="todayDay" className="gap-1.5"><span aria-hidden className="h-3 w-3 rounded-[2px] bg-ink-800 ring-1 ring-edge" />Today</InfoPopover>
      <InfoPopover k="predictedDay" className="gap-1.5"><span aria-hidden className="hatch h-3 w-3 rounded-[2px] border-[1.5px] border-mute" style={{ '--c': '#52615a' } as CSSProperties} />Expected</InfoPopover>
      <span className="inline-flex items-center gap-1.5"><span aria-hidden className="w-4 border-t border-dashed border-fg/50" />Where <InfoPopover k="level.High" className="underline decoration-dotted underline-offset-2">High (50)</InfoPopover> and <InfoPopover k="level.Critical" className="underline decoration-dotted underline-offset-2">Very high (75)</InfoPopover> begin</span>
    </figcaption>
  </figure>
}
