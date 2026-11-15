import { useSearchParams } from 'react-router-dom'
import MapView from '../components/MapView.tsx'
import { PageHead } from '../components/ui.tsx'

export default function MapPage() {
  const [q] = useSearchParams()
  const d = q.get('date') ?? ''
  // ?date=2026-07-14 opens the same NASA imagery view as the button on the map (handled in MapView).
  return <>
    <PageHead kicker="Wildfire map" title="Fire, smoke and communities on one map">
      Fire reports, satellite detections, modelled smoke and real NASA imagery. Select any marker for details.
    </PageHead>
    <MapView height="68vh" initialDate={/^\d{4}-\d{2}-\d{2}$/.test(d) ? d : ''} />
  </>
}
