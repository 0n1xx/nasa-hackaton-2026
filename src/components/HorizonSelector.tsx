import { HORIZONS } from '../../shared/horizon.ts'
import { useApp } from '../state.tsx'

/** Segmented control for the forecast horizon (days ahead). Every forecast view follows it. */
export default function HorizonSelector({ compact = false }: { compact?: boolean }) {
  const { horizon, setHorizon } = useApp()
  return (
    <div className="inline-flex shrink-0 rounded-full bg-ink-800 p-0.5" role="group" aria-label="Forecast horizon">
      {HORIZONS.map((d) => (
        <button
          key={d}
          type="button"
          aria-pressed={horizon === d}
          aria-label={compact ? `${d} day${d === 1 ? '' : 's'}` : undefined}
          onClick={() => setHorizon(d)}
          className={`rounded-full tabular-nums transition-colors ${compact ? 'px-2.5 py-1 text-[12px]' : 'px-3.5 py-1.5 text-[13px]'} ${horizon === d ? 'bg-white font-medium text-fg shadow-sm' : 'text-mute hover:text-fg'}`}
        >
          {compact ? `${d}d` : `${d} day${d === 1 ? '' : 's'}`}
        </button>
      ))}
    </div>
  )
}
