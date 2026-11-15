import { Link } from 'react-router-dom'
import { Flame } from 'lucide-react'
import type { PlaceReport } from '../../../shared/types.ts'
import { placeName } from '../ui.tsx'
import { fireCounts, fireSentence, fireSize, heatCounts, smokeWords } from './words.ts'

/** "Nearest fire and smoke". A missing source is said in words, never shown as 0. */
export default function FireAndSmoke({ place, example }: { place: PlaceReport; example: boolean }) {
  const fires = place.fires
  const nearest = fires?.nearest[0] ?? null
  const smoke = smokeWords(place)
  const agency = nearest ? placeName(nearest.agency) : ''

  return <section aria-labelledby="fire-smoke" className="mt-6 border-t border-line pt-5">
    <h2 id="fire-smoke" className="text-[19px] font-semibold">Nearest fire and smoke</h2>

    {fires == null ? <p className="mt-1.5 text-[17px]">Fire reports are not available right now.</p> : <>
      {nearest && <div className="mt-2 flex items-start gap-2.5">
        <Flame aria-hidden className="mt-[3px] h-5 w-5 shrink-0 text-fg" strokeWidth={2} />
        <div className="text-[17px] leading-[1.45]">
          <p className="font-semibold">{fireSentence(nearest)}{example && <span className="font-normal"> Example fire.</span>}</p>
          <p className="text-[15px] text-mute">{[fireSize(nearest), agency ? `Reported by ${agency} fire crews.` : null].filter(Boolean).join(' ')}</p>
        </div>
      </div>}
      <p className="mt-1.5 text-[17px] leading-[1.45]">{fireCounts(fires)}</p>
    </>}
    <p className="mt-1 text-[17px] leading-[1.45]">
      {place.hotspots24h == null ? 'Satellite heat data is not available right now.' : heatCounts(place.hotspots24h)}
    </p>

    <div className="mt-3">
      {smoke == null ? <p className="text-[17px]">Smoke readings are not available right now.</p> : <>
        <p className="text-[17px] font-semibold">{smoke.line}</p>
        {smoke.ahead && <p className="text-[17px]">{smoke.ahead}</p>}
        <p className="mt-0.5 text-[17px] leading-[1.45]">{smoke.advice}</p>
        {smoke.number && <p className="mt-0.5 text-[15px] text-mute">{smoke.number}</p>}
      </>}
    </div>

    <p className="mt-3 text-[17px]">
      <Link to="/about#trend" className="text-action underline underline-offset-2 hover:text-action-deep">How the risk changed this week</Link>
    </p>
  </section>
}
