// One place, one number: everything the community view, the assistant and the help request need,
// computed at the community's own location (GET /api/place/:communityId).
//
// The risk comes from services.ts pointRisk, the same function the map grid and region panels use, so the
// same point gets the same score everywhere. (A map cell is scored at its centre, so the colour under a
// community can still differ a little from the community's own number.)
import type { ActiveFire, AirPoint, Envelope, Hotspot, Mode, PlaceHistory, PlaceReport, Region, RegionAir, RegionRisk, SourceMeta } from '../shared/types.ts'
import { DEFAULT_HORIZON } from '../shared/horizon.ts'
import { daysBuilding, warningSigns } from '../shared/signals.ts'
import { riskOutlook } from '../shared/outlook.ts'
import { percentileRank } from '../shared/stats.ts'
import { aqiFromPm25 } from '../shared/aqi.ts'
import { regionById } from './data/regions.ts'
import { communityById, locationSource } from './directory.ts'
import { NotFound, airSrc, pointRisk, softFires, within } from './services.ts'
import { climateHistoryAt } from './climate.ts'
import { getAirSeries, type Pt } from './sources/openMeteo.ts'
import { simAirSeries } from './sim.ts'
import { cached, compass8, km } from './util.ts'

const CORE_TTL = 10 * 60 * 1000
/** Fixed look-ahead for the smoke maximum, whatever ?days= is, so "the next 3 days" always means the same. */
const AIR_AHEAD_DAYS = 3
/** How long a place request waits for a first-time NASA POWER download (about 1 MB) before answering without it. */
const HISTORY_WAIT_MS = Number(process.env.PLACE_HISTORY_WAIT_MS ?? 8000)

type Core = Omit<PlaceReport, 'history' | 'historyStatus'>

const dedupe = (list: SourceMeta[]) => [...new Map(list.map((s) => [s.id, s])).values()]

/** Air series at the point: 2 past days (the smoke sign compares the last two 24 h means) and one day more than
 *  AIR_AHEAD_DAYS ahead, so the 3 whole days after today are always covered. null on failure. */
async function airAt(mode: Mode, pt: Pt) {
  try { return mode === 'sim' ? simAirSeries(pt, 2, AIR_AHEAD_DAYS + 1) : await getAirSeries(pt, 2, AIR_AHEAD_DAYS + 1) } catch { return null }
}

/** Local calendar day of an hourly air time. Both modes give local wall-clock times: live is local to the point
 *  (Open-Meteo timezone=auto), the example is in the scenario's own zone (sim.ts simLocalTime), so the date is the prefix. */
export const airDay = (time: string): string => time.slice(0, 10)

/** Highest daily-mean PM2.5 over the AIR_AHEAD_DAYS local days after todayDate (12+ forecast hours each, as in services.ts regionAir). */
export function max3d(hourly: AirPoint[], todayDate: string) {
  const byDay = new Map<string, { sum: number; n: number }>()
  for (const h of hourly) {
    const d = airDay(h.time)
    if (h.kind !== 'forecast' || h.pm25 == null || d <= todayDate) continue
    const b = byDay.get(d) ?? byDay.set(d, { sum: 0, n: 0 }).get(d)!
    b.sum += h.pm25; b.n++
  }
  const daily = [...byDay.entries()].filter(([, b]) => b.n >= 12).sort(([a], [b]) => a.localeCompare(b)).slice(0, AIR_AHEAD_DAYS)
    .map(([date, b]) => ({ date, pm25: +(b.sum / b.n).toFixed(1) }))
  const top = daily.reduce<{ date: string; pm25: number } | null>((a, d) => (!a || d.pm25 > a.pm25 ? d : a), null)
  return { pm25: top?.pm25 ?? null, usAqi: top ? aqiFromPm25(top.pm25) : null, date: top?.date ?? null, days: AIR_AHEAD_DAYS, daily }
}

function nearFires(list: ActiveFire[], lat: number, lon: number) {
  const near = list.map((f) => ({ f, d: km(lat, lon, f.lat, f.lon) })).sort((a, b) => a.d - b.d)
  return {
    nearest: near.slice(0, 5).map(({ f, d }) => ({ name: f.name, agency: f.agency, stage: f.stage, hectares: f.hectares, distanceKm: Math.round(d), bearing: compass8(lat, lon, f.lat, f.lon) })),
    within50km: near.filter((x) => x.d <= 50).length,
    within100km: near.filter((x) => x.d <= 100).length,
  }
}
const nearHotspots = (list: Hotspot[] | null, lat: number, lon: number) => (list ? { within50km: within(list, lat, lon, 50), within100km: within(list, lat, lon, 100) } : null)

/** Everything except the 42-year history. Exported for tests (no network in sim mode). */
export async function placeCore(mode: Mode, id: string, days = DEFAULT_HORIZON): Promise<Envelope<Core>> {
  const c = communityById(id)
  if (!c) throw new NotFound(`Unknown community "${id}"`)
  const pt = { lat: c.lat, lon: c.lon }
  const [p, fires, air] = await Promise.all([pointRisk(mode, pt, days), softFires(mode), airAt(mode, pt)])
  const region = c.regionId ? regionById(c.regionId) ?? null : null

  // warningSigns() takes region-shaped inputs; fill them from the point's own data.
  const here: Region = region ?? { id: c.id, name: c.name, short: c.name, province: c.province, lat: c.lat, lon: c.lon, zoom: 8, historyIndex: p.historyIndex }
  const riskLike: RegionRisk = { region: here, current: p.wx.current, today: p.today, timeline: p.timeline, days: p.wx.days, hotspots100km: p.hotspots100km ?? 0, climate: null, horizon: days }
  const airLike: RegionAir | null = air ? { region: here, now: air.now, hourly: air.hourly, daily: [] } : null
  const signs = warningSigns(riskLike, airLike)

  const data: Core = {
    community: { id: c.id, name: c.name, kind: c.kind, province: c.province, regionId: c.regionId, lat: c.lat, lon: c.lon, source: c.source, bandNumber: c.bandNumber, reported: c.reported },
    region,
    horizon: days,
    risk: { todayDate: p.todayDate, today: p.today, timeline: p.timeline, hotspots100km: p.hotspots100km, historyIndex: p.historyIndex, current: p.wx.current, days: p.wx.days, official: p.official, fwiResting: p.fwiResting },
    signs,
    daysBuilding: daysBuilding(signs, p.todayDate),
    outlook: riskOutlook(p.timeline)!,
    fires: fires.list ? nearFires(fires.list, c.lat, c.lon) : null,
    hotspots24h: nearHotspots(p.hotspots, c.lat, c.lon),
    air: air ? { now: air.now, max3d: max3d(air.hourly, p.todayDate) } : null,
  }
  return { data, sources: dedupe([...p.sources, ...fires.sources, ...(air ? [airSrc(mode)] : []), locationSource(c)]) }
}

/** NASA POWER's native MERRA-2 cell (0.5° lat × 0.625° lon) holding the point, so nearby communities share one download. */
export const powerCell = (lat: number, lon: number) => ({ lat: +(Math.round(lat / 0.5) * 0.5).toFixed(3), lon: +(Math.round(lon / 0.625) * 0.625).toFixed(3) })

/** POWER cells whose download outlived a request's wait (still in flight), and cells whose download failed recently. */
const historyInFlight = new Set<string>()
const historyFailedAt = new Map<string, number>()
const HISTORY_RETRY_MS = 60 * 1000

async function placeHistory(mode: Mode, core: Core): Promise<{ status: PlaceReport['historyStatus']; data: PlaceHistory | null; sources: SourceMeta[] }> {
  const cell = powerCell(core.community.lat, core.community.lon)
  const key = `${cell.lat},${cell.lon}`
  // Answer at once instead of waiting again: the download is still running, or it failed less than a minute ago.
  if (historyInFlight.has(key)) return { status: 'loading', data: null, sources: [] }
  if (Date.now() - (historyFailedAt.get(key) ?? -Infinity) < HISTORY_RETRY_MS) return { status: 'unavailable', data: null, sources: [] }
  const job = climateHistoryAt(mode, cell.lat, cell.lon)
  let settled = false
  job.then(() => { settled = true; historyInFlight.delete(key); historyFailedAt.delete(key) }, () => { settled = true; historyInFlight.delete(key); historyFailedAt.set(key, Date.now()) })
  let timer: NodeJS.Timeout | undefined
  const wait = new Promise<'wait'>((res) => { timer = setTimeout(() => res('wait'), HISTORY_WAIT_MS) })
  try {
    const h = await Promise.race([job, wait])
    // The download carries on into the cache (util.ts cached + disk), so a later request gets it.
    if (h === 'wait') { if (!settled) historyInFlight.add(key); return { status: 'loading', data: null, sources: [] } }
    const t = h.data.metrics.tMax
    // Today's high, as HistoryContext.tsx picks it: the latest past day with a value.
    const today = [...core.risk.days].reverse().find((d) => d.kind === 'historical' && d.tMax != null)?.tMax ?? null
    const rank = today != null ? percentileRank(today, t.window.q) : NaN
    return {
      status: 'ok',
      data: {
        point: cell, period: h.data.period, window: h.data.window,
        todayTMax: today, tMaxPercentile: Number.isFinite(rank) ? Math.round(rank) : null,
        fireSeasonTMax: { senPerDecade: t.trend.senPerDecade, mannKendallP: t.trend.mannKendall.pValue, tau: t.trend.mannKendall.tau, trend: t.trend.mannKendall.trend, unit: t.annualUnit },
        tMax: t,
      },
      sources: h.sources,
    }
  } catch {
    return { status: 'unavailable', data: null, sources: [] }
  } finally {
    clearTimeout(timer)
  }
}

export async function placeReport(mode: Mode, id: string, days = DEFAULT_HORIZON): Promise<Envelope<PlaceReport>> {
  if (!communityById(id)) throw new NotFound(`Unknown community "${id}"`)
  // The core is cached per (mode, days, community) for 10 minutes. The history sits outside that cache
  // (it has its own 7-day memory and disk cache) so a slow first download is not pinned as null for 10 minutes.
  const core = await cached(`place:${mode}:${days}:${id}`, () => placeCore(mode, id, days), CORE_TTL)
  const h = await placeHistory(mode, core.data)
  return { data: { ...core.data, history: h.data, historyStatus: h.status }, sources: dedupe([...core.sources, ...h.sources]) }
}
