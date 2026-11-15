import { useEffect, useState } from 'react'
import HeroMap from '../components/HeroMap.tsx'
import HomePanel from '../components/RiskPanel.tsx'

// Home (docs/design/critique-and-direction.md §3.1, §3.2).
// Desktop: the panel flush left, full height, 440 px, hairline border; the map fills the rest.
// Phone: one page scroll (the app's <main> scrolls), panel content first, then a 260 px map that does not
// grab the scroll. Tapping it opens the map full screen.
export default function Home() {
  const [mapOpen, setMapOpen] = useState(false)

  useEffect(() => {
    // Leaflet only re-measures on window resize; nudge it when the map container changes size.
    window.dispatchEvent(new Event('resize'))
    if (!mapOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMapOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mapOpen])

  return <div className="md:flex md:h-full">
    <aside aria-label="Find your community" className="quiet-scroll relative z-[1000] overflow-x-clip bg-white md:h-full md:w-[440px] md:shrink-0 md:overflow-y-auto md:border-r md:border-line">
      <HomePanel />
    </aside>
    <div className={mapOpen
      ? 'fixed inset-0 z-[1200] isolate bg-white md:static md:z-auto md:min-w-0 md:flex-1'
      : 'relative isolate h-[260px] border-t border-line md:h-full md:min-w-0 md:flex-1 md:border-t-0'}>
      <HeroMap />
      {mapOpen
        ? <button type="button" onClick={() => setMapOpen(false)}
          className="absolute top-3 right-3 z-[1001] h-11 rounded-md border border-edge bg-white px-4 text-[17px] font-semibold text-fg shadow-sm md:hidden">
          Close map
        </button>
        // Phone only: a cover over the map so a swipe scrolls the page instead of panning the map.
        : <button type="button" onClick={() => setMapOpen(true)} aria-label="Open the map full screen"
          className="absolute inset-0 z-[1001] flex items-end justify-center pb-3 md:hidden">
          <span className="rounded-md border border-edge bg-white px-3 py-1.5 text-[15px] font-semibold text-fg shadow-sm">Open the map</span>
        </button>}
    </div>
  </div>
}
