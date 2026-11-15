import HeroMap from '../components/LazyHeroMap.tsx'
import HomePanel from '../components/RiskPanel.tsx'
import { MapSheetButton, useMapSheet } from '../components/MapSheet.tsx'

// Home (docs/design/critique-and-direction.md §3.1, §3.2).
// Desktop: the panel flush left, full height, 440 px, hairline border; the map fills the rest.
// Phone: one page scroll (the app's <main> scrolls), panel content first, then a 260 px map that does not
// grab the scroll. Tapping it opens the map full screen (components/MapSheet.tsx).
export default function Home() {
  const { open: mapOpen, setOpen: setMapOpen, sheetProps } = useMapSheet()

  return <div className="md:flex md:h-full">
    <aside aria-label="Find your community" className="quiet-scroll relative z-[1000] overflow-x-clip bg-white md:h-full md:w-[440px] md:shrink-0 md:overflow-y-auto md:border-r md:border-line">
      <HomePanel />
    </aside>
    <div {...sheetProps} className={mapOpen
      ? 'fixed inset-0 z-[1200] isolate bg-white md:static md:z-auto md:min-w-0 md:flex-1'
      : 'relative isolate h-[260px] border-t border-line md:h-full md:min-w-0 md:flex-1 md:border-t-0'}>
      <HeroMap />
      <MapSheetButton open={mapOpen} setOpen={setMapOpen} />
    </div>
  </div>
}
