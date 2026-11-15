// Which agency fire reports count as "a fire now".
//
// CWFIS lists every fire an agency has not declared out. Many are never declared out: on
// 15 November 2026 the feed held 105 "active" fires, most untouched since summer, including
// Quebec fires from 2020 and 2023 still marked out of control. Agencies also re-stamp records
// automatically (Parks Canada re-publishes record_start, the Northwest Territories re-stamp
// status_date daily), so neither date alone says when a person last looked at the fire.
//
// Rule: a report counts if the OLDER of its two dates is within STALE_DAYS, or a satellite
// detected heat at the fire in the last day. Reports with no dates are kept: we can't judge them.
// When the satellite feed is down we can't check for heat, so the window widens to NO_HEAT_DAYS
// rather than hiding long-running summer fires whose status has not changed.
import type { ActiveFire, Hotspot } from '../shared/types.ts'
import { lastTouched } from '../shared/fires.ts'
import { km } from './util.ts'

export { lastTouched }

export const STALE_DAYS = 14
export const NO_HEAT_DAYS = 60
const OUT = new Set(['EX', 'OUT'])

/** How far from a fire's reported point satellite heat still counts as that fire: the radius of a
 *  circle of the fire's size, plus half again, and never under 5 km. */
const heatRadiusKm = (hectares: number) => Math.max(5, 1.5 * Math.sqrt(hectares / 100 / Math.PI))

export function currentFires(fires: ActiveFire[], hotspots: Hotspot[] | null, nowMs: number): { kept: ActiveFire[]; hidden: number } {
  const cutoff = nowMs - (hotspots ? STALE_DAYS : NO_HEAT_DAYS) * 86400000
  const kept = fires.filter((f) => {
    if (OUT.has(f.stage.toUpperCase())) return false
    const t = lastTouched(f)
    if (t == null || Date.parse(t) >= cutoff) return true
    const r = heatRadiusKm(f.hectares)
    return !!hotspots && hotspots.some((h) => km(f.lat, f.lon, h.lat, h.lon) <= r)
  })
  return { kept, hidden: fires.length - kept.length }
}
