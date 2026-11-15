// Canada's Fire Weather Index at fire weather stations — CWFIS (Natural Resources Canada), free, no key.
// One WFS request returns about 800 SCRIBE forecast stations for today and the next two days, each with the
// full Canadian Forest Fire Weather Index System codes (FFMC, DMC, DC, ISI, BUI, FWI).
// A station that has stopped for the season reports -101 for every code; that becomes null here.
// Layer: public:firewx_scribe on https://cwfis.cfs.nrcan.gc.ca/geoserver/public/ows
import type { FwiStation } from '../../shared/fwi.ts'
import { cached, fetchUpstream, num, registerIntegration } from '../util.ts'

registerIntegration({ id: 'cwfis-fwi', name: 'CWFIS fire weather stations (Natural Resources Canada)', needsKey: false, configured: true, purpose: 'Canada’s official Fire Weather Index at about 800 weather stations, today and the next two days' })

const URL = 'https://cwfis.cfs.nrcan.gc.ca/geoserver/public/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=public:firewx_scribe&outputFormat=application/json'
/** The stations are updated once or twice a day. */
const TTL_MS = 60 * 60 * 1000

const code = (v: unknown): number | null => { const n = num(v); return n == null || n < 0 ? null : n }

export function parseStations(json: any): FwiStation[] {
  if (!Array.isArray(json?.features)) throw new Error('CWFIS fire weather stations: malformed response')
  return json.features.flatMap((f: any): FwiStation[] => {
    const p = f?.properties ?? {}
    // The geometry is in metres (EPSG:3978); the latitude and longitude properties are degrees.
    const lat = num(p.latitude), lon = num(p.longitude), date = typeof p.rep_date === 'string' ? p.rep_date.slice(0, 10) : null
    if (lat == null || lon == null || !date || Math.abs(lat) > 90 || Math.abs(lon) > 180) return []
    return [{ name: String(p.name ?? p.wmo ?? 'Station'), lat, lon, date, fwi: code(p.fwi), ffmc: code(p.ffmc), dmc: code(p.dmc), dc: code(p.dc), isi: code(p.isi), bui: code(p.bui) }]
  })
}

export function getFwiStations(): Promise<FwiStation[]> {
  return cached('cwfis:fwi-stations', async () => parseStations(await fetchUpstream('cwfis-fwi', URL, 'json', 30000)), TTL_MS)
}
