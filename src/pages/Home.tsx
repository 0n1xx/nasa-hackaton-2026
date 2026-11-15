import HeroMap from '../components/HeroMap.tsx'
import RiskPanel from '../components/RiskPanel.tsx'

// The whole product on one screen: a full-bleed map with one floating panel.
// Phone: map on top, panel below. Tablet and up: panel floats over the map's left edge.
export default function Home() {
  return <div className="flex h-full flex-col md:relative md:block">
    <div className="relative h-[46vh] shrink-0 md:absolute md:inset-0 md:h-auto">
      <HeroMap />
    </div>
    <aside className="relative z-[1000] flex flex-1 flex-col overflow-y-auto bg-white md:absolute md:top-4 md:bottom-4 md:left-4 md:w-[360px] md:flex-none md:rounded-2xl md:pt-2 md:shadow-[0_12px_40px_rgb(19_33_27/0.16)]">
      <RiskPanel />
    </aside>
  </div>
}
