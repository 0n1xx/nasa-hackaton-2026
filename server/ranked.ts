// STUB (to be built): communities ranked by their highest expected fire risk over the look-ahead,
// for the home screen's "Highest fire risk" list. Must use the same per-point scoring as
// /api/place (one number per place). GET /api/places/ranked?mode=&days=&limit=
import type { Envelope, Mode } from '../shared/types.ts'

export interface RankedPlace {
  id: string; name: string; kind: string; province: string
  todayLevel: string; todayScore: number
  peakLevel: string; peakScore: number; peakDate: string
}

export async function rankedPlaces(_mode: Mode, _days: number, _limit = 8): Promise<Envelope<RankedPlace[]>> {
  return { data: [], sources: [] }
}

/** Every community inside the map area with its level for each day (past days, today, look-ahead),
 *  scored at the community's own point, same as /api/place. GET /api/places/levels?mode=&days= */
export interface PlaceLevels {
  days: { date: string; kind: 'historical' | 'today' | 'forecast' }[]
  places: { id: string; name: string; kind: string; province: string; lat: number; lon: number; scores: number[] }[]
}

export async function placeLevels(_mode: Mode, _days: number): Promise<Envelope<PlaceLevels>> {
  return { data: { days: [], places: [] }, sources: [] }
}
