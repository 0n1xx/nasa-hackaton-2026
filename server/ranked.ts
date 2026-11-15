// Every community on the map, scored at its own point with the same function as /api/place (services.ts
// pointsRisk -> scorePoint), so a community's number on the home list, the map and its own page agree.
//
// One computation per mode (at MAX_HORIZON, sliced per look-ahead), cached an hour, feeds both endpoints:
//   GET /api/places/ranked?mode=&days=&limit=   highest expected risk over today + the look-ahead
//   GET /api/places/levels?mode=&days=          every community's score for each day (map discs, "use my location")
// Live weather comes from Open-Meteo in 40-point requests (pointsRisk chunks them), about 440 points in all.
import type { Envelope, Mode, RiskDay, RiskLevel, SourceMeta } from '../shared/types.ts'
import { riskOutlook } from '../shared/outlook.ts'
import { allCommunities, locationSource } from './directory.ts'
import { pointsRisk } from './services.ts'
import { MAX_HORIZON } from '../shared/horizon.ts'

/** The area whose communities are ranked and drawn. Wide enough for southern Ontario and Quebec, the Atlantic
 *  provinces, the Yukon and the North, not only the 48–62° N band. The home map still opens on that band
 *  (HeroMap HOME_BOUNDS), where most communities and the risk are; people pan out for the rest. */
export const MAP_AREA = { latMin: 41.5, latMax: 69.5, lonMin: -141, lonMax: -52 }
/** An hour: the weather models behind it update hourly, and one live refresh of all 641 communities costs roughly
 *  1,000 to 1,300 of Open-Meteo's free-tier calls (by its fractional counting; limits 5,000 an hour, 10,000 a day). Every 10 minutes ran into HTTP 429. */
const TTL = 60 * 60 * 1000

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

interface Computed { list: Scored[]; sources: SourceMeta[]; ms: number; partial: boolean }

/** Open-Meteo takes up to 40 points per request (services.ts uses the same chunks, so the cache keys match). */
const CHUNK = 40
/** Pause between live chunk requests that actually went upstream, to stay under Open-Meteo's per-minute limit. */
const PACE_MS = 250
/** A list with skipped chunks is kept for 5 minutes, then the missing communities are tried again. Retrying every
 *  minute while Open-Meteo was refusing requests kept the limit hit. */
const PARTIAL_TTL = 5 * 60 * 1000
/** After the TTL, the last good list is still served (and refreshed in the background) for up to this long. */
const STALE_MS = 3 * 60 * 60 * 1000
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Every map community scored ONCE per mode at MAX_HORIZON; each look-ahead is a slice of it (scoredPlaces).
 * A day's score does not depend on the look-ahead: services.ts riskDays scores day i from wx.days[i] and the
 * 7 days before it only, and the horizon just stops the loop (the sim draws days past +3 from their own
 * generator, so they never shift). A chunk whose weather fails is skipped, the rest is returned.
 */
async function compute(mode: Mode): Promise<Computed> {
  const t0 = Date.now()
  const comms = mapCommunities()
  const list: Scored[] = []
  let sources: SourceMeta[] = []
  const failed: { n: number; msg: string }[] = []
  let wentUpstream = false
  for (let i = 0; i < comms.length; i += CHUNK) {
    const part = comms.slice(i, i + CHUNK)
    if (mode === 'live' && wentUpstream) await sleep(PACE_MS)
    const t = Date.now()
    try {
      const r = await pointsRisk(mode, part.map((c) => ({ lat: c.lat, lon: c.lon })), MAX_HORIZON)
      if (!sources.length) sources = r.sources
      part.forEach((c, j) => list.push({
        c: { id: c.id, name: c.name, kind: c.kind, province: c.province, lat: c.lat, lon: c.lon },
        timeline: r.points[j].timeline, todayDate: r.points[j].todayDate,
      }))
    } catch (e) {
      failed.push({ n: part.length, msg: (e as Error).message })
    }
    wentUpstream = Date.now() - t > 20 // a cached chunk answers in a few ms; only pace real requests
  }
  if (!list.length) throw new Error(failed[0]?.msg ?? 'No communities could be scored')
  if (failed.length) {
    // One line per computation, not one per chunk.
    console.warn(`[places] weather failed for ${failed.length} of ${Math.ceil(comms.length / CHUNK)} chunks; ${failed.reduce((a, f) => a + f.n, 0)} communities left out for now (${failed[0].msg})`)
  }
  const locs = [...new Map(comms.map((c) => [c.source, locationSource(c)])).values()]
  const ms = Date.now() - t0
  if (mode === 'live') console.log(`[places] scored ${list.length} of ${comms.length} communities (live, ${MAX_HORIZON} days ahead) in ${ms} ms`)
  return { list, sources: [...sources, ...locs], ms, partial: failed.length > 0 }
}

const memo = new Map<Mode, { at: number; value: Computed }>()
const inflight = new Map<Mode, Promise<Computed>>()

/** One computation per mode at a time (concurrent requests share it). Failures are not cached. */
function refresh(mode: Mode): Promise<Computed> {
  let p = inflight.get(mode)
  if (!p) {
    p = compute(mode).then((value) => { memo.set(mode, { at: Date.now(), value }); return value }).finally(() => inflight.delete(mode))
    inflight.set(mode, p)
  }
  return p
}

async function computed(mode: Mode): Promise<Computed> {
  const hit = memo.get(mode)
  const age = hit ? Date.now() - hit.at : Infinity
  if (hit && age < (hit.value.partial ? PARTIAL_TTL : TTL)) return hit.value
  if (hit && !hit.value.partial && age < STALE_MS) {
    // Serve the last good list now and refresh behind it.
    refresh(mode).catch((e) => console.warn(`[places] refresh failed, still serving the last list: ${(e as Error).message}`))
    return hit.value
  }
  try { return await refresh(mode) } catch (e) { if (hit && age < STALE_MS) return hit.value; throw e }
}

/** Today and the first `days` look-ahead days of a MAX_HORIZON timeline (the same cut as services.ts riskDays). */
function sliceTimeline(t: RiskDay[], days: number): RiskDay[] {
  let ahead = 0
  return t.filter((d) => d.kind !== 'forecast' || ++ahead <= days)
}

/** The one shared computation for both endpoints, cut to the look-ahead. */
export async function scoredPlaces(mode: Mode, days: number): Promise<Computed> {
  const v = await computed(mode)
  return { ...v, list: v.list.map((s) => ({ ...s, timeline: sliceTimeline(s.timeline, days) })) }
}

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
