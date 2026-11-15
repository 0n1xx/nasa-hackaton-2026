// Canadian Wildland Fire Information System (Natural Resources Canada) — free, no key.
// Active fires as reported by fire agencies, and satellite hotspots for the last 24 h.
// Docs: https://cwfis.cfs.nrcan.gc.ca/datamart
import type { ActiveFire, Hotspot } from '../../shared/types.ts'
import { cached, fetchUpstream, num, registerIntegration } from '../util.ts'

registerIntegration({ id: 'cwfis', name: 'CWFIS (Natural Resources Canada)', needsKey: false, configured: true, purpose: 'Agency-reported active fires; satellite hotspots for the last 24 hours' })

// CWFIS moved active fires to the CWFIF GeoServer (the old activefires.csv now returns 404).
// The filter keeps only records valid right now.
const ACTIVE_WFS = 'https://geoserver.cwfif.nrcan.gc.ca/geoserver/wfs?service=WFS&version=2.0.0&request=GetFeature&outputFormat=application/json&typeName=public:cwfif_national_activefires&srsName=EPSG:4326&count=5000&CQL_FILTER=' + encodeURIComponent('now()>=record_start AND now()<=record_end')
const HOTSPOT_WFS = 'https://cwfis.cfs.nrcan.gc.ca/geoserver/public/ows?service=WFS&version=2.0.0&request=GetFeature&typeName=public:hotspots_24h&count=8000&outputFormat=application/json&srsName=EPSG:4326'

export function getActiveFires(): Promise<ActiveFire[]> {
  return cached('cwfis:active', async () => {
    const j = await fetchUpstream('cwfis', ACTIVE_WFS, 'json', 25000)
    if (!Array.isArray(j?.features)) throw new Error('CWFIS active fires: malformed response')
    return j.features.flatMap((f: any, i: number): ActiveFire[] => {
      const p = f.properties ?? {}
      const lat = num(p.latitude) ?? num(f.geometry?.coordinates?.[1]), lon = num(p.longitude) ?? num(f.geometry?.coordinates?.[0])
      if (lat == null || lon == null || Math.abs(lat) > 90 || Math.abs(lon) > 180) return [] // drop malformed rows
      return [{ id: String(p.national_fire_id ?? p.id ?? i), name: String(p.agency_fire_id ?? p.national_fire_id ?? 'Unnamed'), agency: String(p.agency_code ?? '').toUpperCase(), lat, lon, hectares: Math.max(0, num(p.fire_size) ?? 0), startDate: p.situation_report_date ?? null, stage: String(p.stage_of_control_status ?? '').toUpperCase() }]
    })
  })
}

export function getHotspots24h(): Promise<Hotspot[]> {
  return cached('cwfis:hotspots', async () => {
    const j = await fetchUpstream('cwfis', HOTSPOT_WFS, 'json', 25000)
    if (!Array.isArray(j?.features)) throw new Error('CWFIS hotspots: malformed response')
    return j.features.flatMap((f: any): Hotspot[] => {
      const p = f.properties ?? {}
      const lat = num(p.lat) ?? num(f.geometry?.coordinates?.[1]), lon = num(p.lon) ?? num(f.geometry?.coordinates?.[0])
      if (lat == null || lon == null || Math.abs(lat) > 90) return []
      return [{ lat, lon, frp: num(p.frp), time: p.rep_date ?? null, sensor: [p.sensor, p.satellite].filter(Boolean).join(' ') || 'CWFIS' }]
    })
  })
}
