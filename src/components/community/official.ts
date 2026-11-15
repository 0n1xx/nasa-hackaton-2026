import type { PlaceReport } from '../../../shared/types.ts'
import type { RiskLevel } from '../../../shared/types.ts'

/** "SIOUX LOOKOUT" -> "Sioux Lookout", "MONTREAL (DORVAL)" -> "Montreal (Dorval)". */
export const stationName = (s: string) => s.toLowerCase().replace(/(^|[\s(\-./])([a-zà-ÿ])/g, (_, a: string, b: string) => a + b.toUpperCase())

/** The CWFIS map bands in words (shared/fwi.ts fwiLevel): our top level merges very high and extreme. */
const BAND: Record<RiskLevel, string> = { Low: 'low', Moderate: 'moderate', High: 'high', Critical: 'very high or extreme' }

/**
 * Canada's official Fire Weather Index next to our estimate, in one plain sentence. Null in the example
 * (the example has no official reading) and when no station is in range.
 */
export function officialLine(p: PlaceReport): string | null {
  const o = p.risk.official
  if (o) {
    const v = o.fwi < 1 ? o.fwi.toFixed(1) : String(Math.round(o.fwi))
    return `Canada’s fire weather station at ${stationName(o.station)}, ${o.km} km away, rates today ${BAND[o.level]} (Fire Weather Index ${v}).`
  }
  if (p.risk.fwiResting) return 'Canada’s fire weather stations near you have stopped for the season.'
  return null
}
