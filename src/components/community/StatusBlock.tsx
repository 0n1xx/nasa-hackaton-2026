import { Link } from 'react-router-dom'
import type { PlaceReport } from '../../../shared/types.ts'
import { LevelTag, placeName } from '../ui.tsx'
import { howSure, statusSentence, todayLevel } from './words.ts'
import { officialLine } from './official.ts'

/** The official rating lives with the provincial agencies; CWFIS maps all of them (docs/research/preparedness.md §5). */
const OFFICIAL_RATING_URL = 'https://cwfis.cfs.nrcan.gc.ca/maps/fw?type=fwi'

/** Name, the status sentence with its level, and "How sure are we?" (critique §2, fix 9). */
export default function StatusBlock({ place }: { place: PlaceReport }) {
  const c = place.community
  const s = statusSentence(place)
  const sure = howSure(place)
  const official = officialLine(place)
  const province = placeName(c.province)
  return <>
    <header>
      <Link to="/" className="text-[15px] text-action underline underline-offset-2 hover:text-action-deep">All communities</Link>
      <h1 className="mt-1.5 text-[26px] leading-[1.2] font-semibold md:text-[28px]">{c.name}</h1>
      {province && <p className="text-[17px] text-mute">{province}</p>}
    </header>

    <section id="status" aria-label="Fire risk today" className="mt-4 scroll-mt-4">
      <p className="text-[22px] leading-[1.32] font-normal md:text-[24px]">
        <span className="font-semibold">{s.first}</span>{s.second && <> {s.second}</>}
      </p>
      <p className="mt-2.5 flex flex-wrap items-center gap-x-2 text-[17px]">
        <LevelTag level={todayLevel(place)} size="lg" />
        <span className="num">({place.risk.today.score} out of 100)</span>
      </p>
      <p className="mt-1.5 text-[15px] text-mute">
        Our estimate, not an official fire danger rating.{official ? <> {official}</> : null} <a href={OFFICIAL_RATING_URL} target="_blank" rel="noreferrer" className="text-action underline underline-offset-2 hover:text-action-deep">See the official map</a>
      </p>
    </section>

    <section id="how-sure" aria-label="How sure are we?" className="mt-4 scroll-mt-4">
      <p className="text-[17px] leading-[1.45]"><span className="font-semibold">How sure are we? {sure.word}.</span> {sure.reason}</p>
      <p className="mt-0.5 text-[17px] leading-[1.45]">{sure.range}</p>
    </section>
  </>
}
