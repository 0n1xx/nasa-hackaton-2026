// Every community on the map, scored at its own point with the same function as /api/place (services.ts
// pointsRisk -> scorePoint), so a community's number on the home list, the map and its own page agree.
//
// One computation per (mode, days), cached 10 minutes, feeds both endpoints:
//   GET /api/places/ranked?mode=&days=&limit=   highest expected risk over today + the look-ahead
//   GET /api/places/levels?mode=&days=          every community's score for each day (map discs, "use my location")
// Live weather comes from Open-Meteo in 40-point requests (pointsRisk chunks them), about 440 points in all.
import type { Envelope, Mode, RiskDay, RiskLevel, SourceMeta } from '../shared/types.ts'
import { riskOutlook } from '../shared/outlook.ts'
import { allCommunities, locationSource } from './directory.ts'
import { pointsRisk } from './services.ts'
import { cached } from './util.ts'

/** The map area (HeroMap bounds). Communities outside it are not ranked or drawn. */
export const MAP_AREA = { latMin: 48, latMax: 62, lonMin: -126, lonMax: -70 }
const TTL = 10 * 60 * 1000

export interface RankedPlace {
  id: string; name: string; kind: string; province: string
  todayDate: string
  todayLevel: RiskLevel; todayScore: number
  /** Highest score from today to the end of the look-ahead (earliest day on a tie), as shared/outlook.ts riskOutlook. */
  peakLevel: RiskLevel; peakScore: number; peakDate: string
  /** First day, from today on, at the peak level: "Very high from Sunday". Equals todayDate when today is already there. */
  peakLevelFrom: string
}

/** Every community inside the map area with its score for each day (past days, today, look-ahead),
 *  scored at the community's own point, same as /api/place. scores[i] belongs to days[i]. */
export interface PlaceLevels {
  days: { date: string; kind: 'historical' | 'today' | 'forecast' }[]
  places: { id: string; name: string; kind: string; province: string; lat: number; lon: number; scores: number[] }[]
}

interface Scored {
  c: { id: string; name: string; kind: string; province: string; lat: number; lon: number }
  timeline: RiskDay[]
  todayDate: string
}

export const mapCommunities = () => allCommunities().filter((c) =>
  c.lat >= MAP_AREA.latMin && c.lat <= MAP_AREA.latMax && c.lon >= MAP_AREA.lonMin && c.lon <= MAP_AREA.lonMax)

async function compute(mode: Mode, days: number): Promise<{ list: Scored[]; sources: SourceMeta[]; ms: number }> {
  const t0 = Date.now()
  const comms = mapCommunities()
  const { points, sources } = await pointsRisk(mode, comms.map((c) => ({ lat: c.lat, lon: c.lon })), days)
  const list = comms.map((c, i): Scored => ({
    c: { id: c.id, name: c.name, kind: c.kind, province: c.province, lat: c.lat, lon: c.lon },
    timeline: points[i].timeline, todayDate: points[i].todayDate,
  }))
  const locs = [...new Map(comms.map((c) => [c.source, locationSource(c)])).values()]
  const ms = Date.now() - t0
  if (mode === 'live') console.log(`[places] scored ${comms.length} communities (live, ${days} days ahead) in ${ms} ms`)
  return { list, sources: [...sources, ...locs], ms }
}

/** The one shared computation for both endpoints. */
export const scoredPlaces = (mode: Mode, days: number) => cached(`places:${mode}:${days}`, () => compute(mode, days), TTL)

const RANK: Record<RiskLevel, number> = { Low: 0, Moderate: 1, High: 2, Critical: 3 }

export function rankRow(s: Scored): RankedPlace | null {
  const o = riskOutlook(s.timeline)
  if (!o || !o.todayDate || !o.todayLevel) return null
  const today = s.timeline.find((t) => t.date === o.todayDate)!
  const from = s.timeline.findIndex((t) => t.date === o.todayDate)
  const reach = s.timeline.slice(from).find((t) => RANK[t.level] >= RANK[o.peakLevel])
  return {
    id: s.c.id, name: s.c.name, kind: s.c.kind, province: s.c.province,
    todayDate: o.todayDate, todayLevel: today.level, todayScore: today.score,
    peakLevel: o.peakLevel, peakScore: o.peakScore, peakDate: o.peakDate, peakLevelFrom: reach?.date ?? o.peakDate,
  }
}

export async function rankedPlaces(mode: Mode, days: number, limit = 8): Promise<Envelope<RankedPlace[]>> {
  const { list, sources } = await scoredPlaces(mode, days)
  const rows = list.map(rankRow).filter((r): r is RankedPlace => !!r)
  rows.sort((a, b) => b.peakScore - a.peakScore || b.todayScore - a.todayScore || a.name.localeCompare(b.name))
  return { data: rows.slice(0, Math.max(1, limit)), sources }
}

export async function placeLevels(mode: Mode, days: number): Promise<Envelope<PlaceLevels>> {
  const { list, sources } = await scoredPlaces(mode, days)
  // Align by position: every timeline is past days + today + `days` ahead, and each place's own today sits at the
  // same index. (Live dates are local to each point, so far-west places can still be on yesterday near midnight.)
  const ref = list[0]?.timeline ?? []
  const out: PlaceLevels = {
    days: ref.map((t) => ({ date: t.date, kind: t.kind })),
    places: list.map((s) => ({ ...s.c, scores: ref.map((_, i) => s.timeline[i]?.score ?? s.timeline.at(-1)?.score ?? 0) })),
  }
  return { data: out, sources }
}
