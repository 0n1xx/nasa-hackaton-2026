// NASA POWER — long-term monthly climatology for a point. Free, no key.
// Docs: https://power.larc.nasa.gov/docs/services/api/temporal/climatology/
import type { ClimateNormals } from '../../shared/types.ts'
import { cached, fetchUpstream, num, registerIntegration } from '../util.ts'

registerIntegration({ id: 'nasa-power', name: 'NASA POWER', needsKey: false, configured: true, purpose: 'Long-term monthly temperature, rain and humidity normals for historical comparison' })

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

export function getClimate(lat: number, lon: number): Promise<ClimateNormals> {
  const url = `https://power.larc.nasa.gov/api/temporal/climatology/point?parameters=T2M_MAX,PRECTOTCORR,RH2M&community=AG&longitude=${lon}&latitude=${lat}&format=JSON`
  return cached(`power:${lat},${lon}`, async () => {
    const p = (await fetchUpstream('nasa-power', url, 'json', 20000))?.properties?.parameter
    if (!p?.T2M_MAX) throw new Error('NASA POWER: malformed response')
    const row = (k: string) => MONTHS.map((m) => { const v = num(p[k]?.[m]); return v == null || v <= -900 ? NaN : v }) // -999 = missing
    return { tempC: row('T2M_MAX'), precipMmDay: row('PRECTOTCORR'), rh: row('RH2M') }
  }, 24 * 3600 * 1000)
}
