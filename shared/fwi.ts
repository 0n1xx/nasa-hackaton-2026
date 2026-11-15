// Canada's Fire Weather Index (FWI) at the nearest fire weather station.
//
// The Canadian Forest Fire Weather Index System is what Canada's fire agencies use to rate fire danger.
// Natural Resources Canada (CWFIS) publishes it for about 800 weather stations, for today and the next
// two days (server/sources/cwfisStations.ts). A station that has stopped for the season reports -101;
// we store that as null and look for the next nearest station that is still reporting.
import type { RiskLevel } from './types.ts'

/** A station further away than this is not used: the index describes local weather. */
export const FWI_MAX_KM = 200
/** Stations within this distance decide whether "the fire weather stations near you have stopped for the winter". */
export const FWI_NEAR_KM = 150

export interface FwiStation {
  name: string
  lat: number
  lon: number
  /** the day the values are for, YYYY-MM-DD */
  date: string
  /** null when the station has stopped calculating for the season */
  fwi: number | null
  ffmc: number | null
  dmc: number | null
  dc: number | null
  isi: number | null
  bui: number | null
}

export interface OfficialFwi {
  station: string
  km: number
  date: string
  fwi: number
  level: RiskLevel
  ffmc: number | null
  dmc: number | null
  dc: number | null
  isi: number | null
  bui: number | null
}

/** The FWI bands on the CWFIS fire weather maps: under 5, 5–10, 10–20, 20–30, 30 and over. Our four levels
 *  merge the top two (very high and extreme) into "Very high". */
export function fwiLevel(fwi: number): RiskLevel {
  return fwi < 5 ? 'Low' : fwi < 10 ? 'Moderate' : fwi < 20 ? 'High' : 'Critical'
}

function km(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const r = Math.PI / 180, dLat = (bLat - aLat) * r, dLon = (bLon - aLon) * r
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * r) * Math.cos(bLat * r) * Math.sin(dLon / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(h))
}

/** Stations grouped by day, so many points can be looked up against the same list. */
export class FwiLookup {
  private byDate = new Map<string, FwiStation[]>()
  constructor(stations: FwiStation[]) {
    for (const s of stations) (this.byDate.get(s.date) ?? this.byDate.set(s.date, []).get(s.date)!).push(s)
  }
  get dates(): string[] { return [...this.byDate.keys()].sort() }

  /** The nearest station still reporting on `date`, within FWI_MAX_KM; null if none. */
  nearest(lat: number, lon: number, date: string): OfficialFwi | null {
    let best: FwiStation | null = null, bd = Infinity
    for (const s of this.byDate.get(date) ?? []) {
      if (s.fwi == null) continue
      const d = km(lat, lon, s.lat, s.lon)
      if (d < bd) { bd = d; best = s }
    }
    if (!best || bd > FWI_MAX_KM) return null
    return { station: best.name, km: Math.round(bd), date, fwi: best.fwi!, level: fwiLevel(best.fwi!), ffmc: best.ffmc, dmc: best.dmc, dc: best.dc, isi: best.isi, bui: best.bui }
  }

  /** FWI for each day the stations cover, at this point. Days with no station in range are left out. */
  byDay(lat: number, lon: number): Map<string, number> {
    const out = new Map<string, number>()
    for (const d of this.byDate.keys()) { const n = this.nearest(lat, lon, d); if (n) out.set(d, n.fwi) }
    return out
  }

  /** True when there are stations within FWI_NEAR_KM on `date` and every one of them has stopped for the season. */
  resting(lat: number, lon: number, date: string): boolean {
    const near = (this.byDate.get(date) ?? []).filter((s) => km(lat, lon, s.lat, s.lon) <= FWI_NEAR_KM)
    return near.length > 0 && near.every((s) => s.fwi == null)
  }
}
