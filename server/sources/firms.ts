// NASA FIRMS — active fire detections from VIIRS and MODIS. Free MAP_KEY required.
// The key is read from the environment and used only here, on the server.
// Docs: https://firms.modaps.eosdis.nasa.gov/api/area/
import type { Hotspot } from '../../shared/types.ts'
import { cached, fetchUpstream, num, parseCsv, registerIntegration } from '../util.ts'

const KEY = (process.env.FIRMS_MAP_KEY ?? '').trim()
const NRT_SOURCE = (process.env.FIRMS_SOURCE ?? 'VIIRS_NOAA20_NRT').trim()
const CANADA_BBOX = '-141,41.5,-52,72' // west,south,east,north

registerIntegration({ id: 'firms', name: 'NASA FIRMS', needsKey: true, configured: KEY.length > 0, purpose: 'Satellite fire detections (VIIRS/MODIS) with fire radiative power, for any date' })

export const firmsConfigured = () => KEY.length > 0
export const firmsSourceLabel = () => `NASA FIRMS (${NRT_SOURCE.replace(/_/g, ' ')})`

/**
 * Detections over Canada. `days` 1–5. With `date` (YYYY-MM-DD) returns that day onward.
 * Dates older than ~2 months are only in the standard-processing archive, so we
 * switch product for those (VIIRS S-NPP SP, which lags real time by a few months).
 */
export function getFirmsHotspots(days: number, date?: string): Promise<Hotspot[]> {
  if (!KEY) return Promise.reject(new Error('FIRMS_MAP_KEY is not set'))
  const d = Math.max(1, Math.min(5, Math.round(days)))
  const old = date ? Date.now() - Date.parse(date) > 55 * 86400000 : false
  const source = old ? 'VIIRS_SNPP_SP' : NRT_SOURCE
  const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${KEY}/${source}/${CANADA_BBOX}/${d}${date ? `/${date}` : ''}`
  return cached(`firms:${source}:${d}:${date ?? 'now'}`, async () => {
    const text: string = await fetchUpstream('firms', url, 'text', 30000)
    if (!/^latitude,longitude/i.test(text.trim())) throw new Error(`NASA FIRMS: ${text.trim().slice(0, 120) || 'empty response'}`)
    return parseCsv(text).flatMap((r): Hotspot[] => {
      const lat = num(r.latitude), lon = num(r.longitude)
      if (lat == null || lon == null) return []
      const t = r.acq_time?.padStart(4, '0')
      return [{ lat, lon, frp: num(r.frp), time: r.acq_date ? `${r.acq_date}T${t ? `${t.slice(0, 2)}:${t.slice(2)}` : '00:00'}Z` : null, sensor: `${r.instrument || 'VIIRS'} ${r.satellite || ''}`.trim() }]
    })
  })
}
