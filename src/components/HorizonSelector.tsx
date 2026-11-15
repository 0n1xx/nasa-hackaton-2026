import { HORIZONS } from '../../shared/horizon.ts'
import { useApp } from '../state.tsx'
import { InfoPopover } from './ui.tsx'

/** "1 day", "3 days", "1 week", "2 weeks"; other day counts as "5 days". */
export const horizonWords = (d: number) => (d === 7 ? '1 week' : d === 14 ? '2 weeks' : `${d} day${d === 1 ? '' : 's'}`)

/** "the next day", "the next 3 days", "the next week", "the next 2 weeks". */
export const nextWords = (d: number) => (d === 1 ? 'the next day' : d === 7 ? 'the next week' : `the next ${horizonWords(d)}`)

/**
 * Segmented control for how far ahead to look (forecast days). Every forecast view follows it.
 * `label` adds a leading "Look ahead" that explains itself on tap; pages that already label the control leave it off.
 */
export default function HorizonSelector({ compact = false, label = false }: { compact?: boolean; label?: boolean }) {
  const { horizon, setHorizon } = useApp()
  return (
    <div className="inline-flex shrink-0 items-center gap-2">
      {label && (
        <InfoPopover k="horizon" className={`whitespace-nowrap font-medium text-mute underline decoration-dotted underline-offset-[3px] hover:text-fg ${compact ? 'text-[12px]' : 'text-[13px]'}`}>
          Look ahead
        </InfoPopover>
      )}
      <div className="inline-flex shrink-0 rounded-full bg-ink-800 p-0.5" role="group" aria-label="Look ahead">
        {HORIZONS.map((d) => (
          <button
            key={d}
            type="button"
            aria-pressed={horizon === d}
            onClick={() => setHorizon(d)}
            className={`rounded-full whitespace-nowrap tabular-nums transition-colors ${compact ? 'px-2 py-1 text-[12px]' : 'px-3.5 py-1.5 text-[13px]'} ${horizon === d ? 'bg-white font-medium text-fg shadow-sm' : 'text-mute hover:text-fg'}`}
          >
            {horizonWords(d)}
          </button>
        ))}
      </div>
    </div>
  )
}
