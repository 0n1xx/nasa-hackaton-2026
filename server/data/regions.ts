import type { Region } from '../../shared/types.ts'
import { km } from '../util.ts'

// Monitoring regions. `historyIndex` is a hand-set relative baseline (an assumption),
// used only as the smallest-weight factor in the risk index.
export const REGIONS: Region[] = [
  { id: 'thunder-bay', name: 'Thunder Bay District, Northwestern Ontario', short: 'Thunder Bay', province: 'ON', lat: 49.4, lon: -89.4, zoom: 7, historyIndex: 0.6 },
  { id: 'kenora-red-lake', name: 'Kenora – Red Lake, Northwestern Ontario', short: 'Kenora–Red Lake', province: 'ON', lat: 51.0, lon: -93.8, zoom: 7, historyIndex: 0.7 },
  { id: 'far-north-on', name: 'Far North Ontario', short: 'Far North ON', province: 'ON', lat: 52.9, lon: -89.5, zoom: 6, historyIndex: 0.65 },
  { id: 'n-manitoba', name: 'Northern Manitoba', short: 'N. Manitoba', province: 'MB', lat: 55.3, lon: -99.5, zoom: 6, historyIndex: 0.75 },
  { id: 'n-sask', name: 'Northern Saskatchewan', short: 'N. Saskatchewan', province: 'SK', lat: 55.6, lon: -105.3, zoom: 6, historyIndex: 0.85 },
  { id: 'n-alberta', name: 'Northern Alberta', short: 'N. Alberta', province: 'AB', lat: 57.2, lon: -113.5, zoom: 6, historyIndex: 0.8 },
  { id: 'bc-interior', name: 'British Columbia Interior', short: 'BC Interior', province: 'BC', lat: 51.5, lon: -121.3, zoom: 6, historyIndex: 0.75 },
  { id: 'nwt-south', name: 'South Slave, Northwest Territories', short: 'South Slave NWT', province: 'NT', lat: 61.3, lon: -115.5, zoom: 6, historyIndex: 0.8 },
  { id: 'n-quebec', name: 'Nord-du-Québec', short: 'Nord-du-Québec', province: 'QC', lat: 50.5, lon: -75.5, zoom: 6, historyIndex: 0.55 },
]
export const regionById = (id: string) => REGIONS.find((r) => r.id === id)

/** A point further than this from every region centre has no region (and the default baseline below). */
export const REGION_REACH_KM = 600
/** Baseline historyIndex for a point with no region within REGION_REACH_KM. An assumption, like the hand-set values above. */
export const DEFAULT_HISTORY_INDEX = 0.5

/** The region whose centre is nearest to the point, if within maxKm. */
export function nearestRegion(lat: number, lon: number, maxKm = REGION_REACH_KM): Region | null {
  let best: Region | null = null, bestKm = Infinity
  for (const r of REGIONS) { const d = km(lat, lon, r.lat, r.lon); if (d < bestKm) { bestKm = d; best = r } }
  return bestKm <= maxKm ? best : null
}

/** The risk index's regional baseline for any point: the nearest region's, else DEFAULT_HISTORY_INDEX.
 *  Derived from the point alone, so a map cell, a region and a community at the same spot get the same score. */
export const historyIndexAt = (lat: number, lon: number) => nearestRegion(lat, lon)?.historyIndex ?? DEFAULT_HISTORY_INDEX
