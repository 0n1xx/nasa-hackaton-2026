import { lazy, Suspense } from 'react'
import type { MapFocus } from './HeroMap.tsx'

// The map (Leaflet, about a third of the app's code) loads after the panel. The panel is the answer and on a
// phone the map sits below it, so the words never wait for the map to download.
const HeroMap = lazy(() => import('./HeroMap.tsx'))

export default function LazyHeroMap(props: { focus?: MapFocus | null }) {
  return <Suspense fallback={<div aria-hidden className="skeleton absolute inset-0 rounded-none" />}>
    <HeroMap {...props} />
  </Suspense>
}
