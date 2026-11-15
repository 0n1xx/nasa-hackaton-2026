import { useSearchParams } from 'react-router-dom'
import MapView from '../components/MapView.tsx'
import { PageHead } from '../components/ui.tsx'

export default function MapPage() {
  const [q] = useSearchParams()
  const d = q.get('date') ?? ''
  return <>
    <PageHead kicker="Interactive wildfire map" title="Fire, smoke and communities on one map">
      Agency-reported fires, satellite detections, modelled smoke and NASA imagery. Choose a region in the top bar to fly there, pick a date to load that day’s satellite passes, and select any marker for details.
    </PageHead>
    <MapView height="68vh" initialDate={/^\d{4}-\d{2}-\d{2}$/.test(d) ? d : ''} />
  </>
}
