// Combines data sources into the views the UI needs. No HTTP details here.
import type { ActiveFire, CommunityExposure, DayWeather, Envelope, Hotspot, Mode, RegionAir, RegionRisk, RegionSummary, RiskDay, RiskResult, SourceMeta, ClimateNormals, AirTrend } from '../shared/types.ts'
import { computeRisk, type RiskInputs } from '../shared/risk.ts'
import { DEFAULT_HORIZON } from '../shared/horizon.ts'
import { REGIONS, historyIndexAt, regionById } from './data/regions.ts'
import { COMMUNITIES } from './data/communities.ts'
import { getActiveFires, getHotspots24h } from './sources/cwfis.ts'
import { getFwiStations } from './sources/cwfisStations.ts'
import { FwiLookup, type OfficialFwi } from '../shared/fwi.ts'
import { firmsConfigured, firmsSourceLabel, getFirmsHotspots } from './sources/firms.ts'
import { getAirNow, getAirSeries, getAirTrend, getWeather, type Pt, type WeatherResult } from './sources/openMeteo.ts'
import { getClimate } from './sources/power.ts'
import { simActiveFires, simAirNow, simAirSeries, simClimate, simHotspots, simWeather } from './sim.ts'
import { km, src } from './util.ts'
import { NO_HEAT_DAYS, STALE_DAYS, currentFires } from './fires.ts'

const SIM_NOTE = 'Simulated demonstration scenario — not an observation'
export const simSrc = (id: string, what: string): SourceMeta => src(id, `Simulated ${what}`, 'simulated', undefined, SIM_NOTE)

export class NotFound extends Error {}
export class BadRequest extends Error {}

export async function activeFires(mode: Mode): Promise<Envelope<ActiveFire[]>> {
  if (mode === 'sim') return { data: simActiveFires(), sources: [simSrc('sim-fires', 'active fires')] }
  const [all, hs] = await Promise.all([getActiveFires(), softHotspots(mode)])
  const { kept, hidden } = currentFires(all, hs.list, Date.now())
  const note = `Reported by provincial, territorial and Parks Canada fire agencies. Fires not yet declared out stay on this list for months, so ${hidden} report${hidden === 1 ? '' : 's'} ${hs.list ? `with no update in ${STALE_DAYS} days and no satellite heat nearby` : `with no update in ${NO_HEAT_DAYS} days (satellite heat could not be checked)`} ${hidden === 1 ? 'is' : 'are'} left off.`
  return { data: kept, sources: [src('cwfis-active', 'CWFIS active fires (agency-reported)', 'observed', 'https://cwfis.cfs.nrcan.gc.ca/datamart', note)] }
}

export async function hotspots(mode: Mode, days: number, date?: string): Promise<Envelope<Hotspot[]>> {
  if (mode === 'sim') return { data: simHotspots(days), sources: [simSrc('sim-hotspots', 'satellite detections')] }
  if (firmsConfigured()) {
    return { data: await getFirmsHotspots(days, date), sources: [src('firms', firmsSourceLabel(), 'observed', 'https://firms.modaps.eosdis.nasa.gov/', date ? `Detections from ${date}, ${days} day(s)` : `Last ${days} day(s)`)] }
  }
  if (date) throw new BadRequest('Vector fire detections for a past date need a NASA FIRMS key (FIRMS_MAP_KEY). The NASA GIBS satellite layers on the map still work for any date.')
  return { data: await getHotspots24h(), sources: [src('cwfis-hotspots', 'CWFIS satellite hotspots, last 24 h', 'observed', 'https://cwfis.cfs.nrcan.gc.ca/datamart', 'No FIRMS key set, so only the last 24 hours are available')] }
}

/** Weather for many points; live requests go to Open-Meteo in chunks of 40 points (one URL each). */
async function weather(mode: Mode, pts: Pt[], days: number): Promise<WeatherResult[]> {
  if (mode === 'sim') return simWeather(pts, days)
  const out: WeatherResult[] = []
  for (let i = 0; i < pts.length; i += 40) out.push(...(await getWeather(pts.slice(i, i + 40), days)))
  return out
}
const airNow = (mode: Mode, pts: { lat: number; lon: number }[]) => (mode === 'sim' ? Promise.resolve(simAirNow(pts)) : getAirNow(pts))
export const wxSrc = (mode: Mode) => mode === 'sim' ? simSrc('sim-weather', 'weather') : src('open-meteo-weather', 'Open-Meteo weather (model analysis + forecast)', 'model', 'https://open-meteo.com/', 'Gridded numerical weather models, not station measurements')
export const airSrc = (mode: Mode) => mode === 'sim' ? simSrc('sim-air', 'air quality') : src('open-meteo-air', 'Open-Meteo air quality (CAMS global model)', 'model', 'https://open-meteo.com/en/docs/air-quality-api', 'Modelled at roughly 40 km resolution; not ground monitors. AQI shown is the US EPA scale')
export const riskSrc = () => src('risk-model', 'Before the Smoke risk index v0.1', 'model', undefined, 'Rule-based prototype, unvalidated. A relative index, not a probability')

/** How many of pts lie within radius km of (lat, lon). */
export const within = (pts: { lat: number; lon: number }[], lat: number, lon: number, radius: number) => pts.reduce((n, p) => n + (km(lat, lon, p.lat, p.lon) <= radius ? 1 : 0), 0)

/**
 * Canada's Fire Weather Index for a day. The stations cover today and the next two days; after the last day they
 * cover, the last reading is held (a persistence forecast), so the score does not jump on the day the official
 * index runs out. Days before the first covered day (the past days) have none.
 */
export function fwiOn(fwiByDay: Map<string, number> | undefined, date: string): number | null {
  if (!fwiByDay?.size) return null
  const hit = fwiByDay.get(date)
  if (hit != null) return hit
  const last = [...fwiByDay.keys()].sort().at(-1)!
  return date > last ? fwiByDay.get(last)! : null
}

/** Risk for each day we can score (needs at least 3 days of rain history before it), up to `days` ahead of today. */
export function riskDays(wx: WeatherResult, hotspots100km: number | null, historyIndex: number, mode: Mode, days = DEFAULT_HORIZON, fwiByDay?: Map<string, number>) {
  const today = wx.days.filter((d) => d.kind === 'historical').at(-1)?.date
  const out: { day: DayWeather; inputs: RiskInputs }[] = []
  let ahead = 0
  wx.days.forEach((day, i) => {
    if (i < 3) return
    if (day.kind === 'forecast' && ++ahead > days) return
    const prior = wx.days.slice(Math.max(0, i - 7), i).map((d) => d.precip).filter((v): v is number => v != null)
    const precip7d = prior.length ? (prior.reduce((a, b) => a + b, 0) * 7) / prior.length : null
    out.push({ day, inputs: { tMax: day.tMax, rhMin: day.rhMin, windMax: day.windMax, precip7d: precip7d == null ? null : +precip7d.toFixed(1), soil: day.soil, vpdMax: day.vpdMax, hotspots100km, historyIndex, snow: day.snow, fwi: fwiOn(fwiByDay, day.date), quality: mode === 'sim' ? 'simulated' : day.kind === 'forecast' ? 'forecast' : 'observed' } })
  })
  return { today, out }
}

/** Hotspots are optional for risk: if that source is down we still score, with lower confidence. */
export async function softHotspots(mode: Mode): Promise<{ list: Hotspot[] | null; sources: SourceMeta[] }> {
  try { const h = await hotspots(mode, 1); return { list: h.data, sources: h.sources } } catch { return { list: null, sources: [] } }
}
/** Canada's Fire Weather Index at stations (live only). Optional for risk: if CWFIS is down we score without it. */
export async function softFwi(mode: Mode): Promise<{ lookup: FwiLookup | null; sources: SourceMeta[] }> {
  if (mode === 'sim') return { lookup: null, sources: [] }
  try {
    const lookup = new FwiLookup(await getFwiStations())
    return { lookup, sources: [src('cwfis-fwi', 'CWFIS fire weather stations (Fire Weather Index)', 'model', 'https://cwfis.cfs.nrcan.gc.ca/maps/fw', `Canada’s official Fire Weather Index at about 800 stations, for ${lookup.dates.join(', ')}`)] }
  } catch { return { lookup: null, sources: [] } }
}
export async function softFires(mode: Mode): Promise<{ list: ActiveFire[] | null; sources: SourceMeta[] }> {
  try { const f = await activeFires(mode); return { list: f.data, sources: f.sources } } catch { return { list: null, sources: [] } }
}

/** Risk at one point: everything the map, a region panel and a community view show as "the number". */
export interface PointRisk {
  lat: number; lon: number
  /** regional baseline used, from the point alone (data/regions.ts historyIndexAt) */
  historyIndex: number
  /** satellite detections within 100 km, last 24 h; null when that source is down (scored without it) */
  hotspots100km: number | null
  /** the weather's today (local date at the point) */
  todayDate: string
  today: RiskResult
  timeline: RiskDay[]
  wx: WeatherResult
  /** Canada's Fire Weather Index today at the nearest station still reporting; null when none in range, or in the example */
  official: OfficialFwi | null
  /** every fire weather station near this point has stopped for the season */
  fwiResting: boolean
}

/**
 * THE risk computation for a point. The map grid, region panels, region summaries and /api/place all score
 * through here, so the same point with the same weather always gets the same number. Pure (no I/O).
 */
export function scorePoint(wx: WeatherResult, hs: Hotspot[] | null, pt: Pt, mode: Mode, days: number, fwi: FwiLookup | null = null): PointRisk {
  const historyIndex = historyIndexAt(pt.lat, pt.lon)
  const n = hs ? within(hs, pt.lat, pt.lon, 100) : null
  const { today, out } = riskDays(wx, n, historyIndex, mode, days, fwi?.byDay(pt.lat, pt.lon))
  const todayEntry = out.find((o) => o.day.date === today) ?? out.at(-1)!
  const timeline: RiskDay[] = out.map((o) => { const r = computeRisk(o.inputs); return { date: o.day.date, kind: o.day.date === today ? 'today' : o.day.kind, score: r.score, level: r.level, confidence: r.confidence, uncertainty: r.uncertainty } })
  const todayDate = todayEntry.day.date
  return {
    lat: pt.lat, lon: pt.lon, historyIndex, hotspots100km: n, todayDate, today: computeRisk(todayEntry.inputs), timeline, wx,
    official: fwi?.nearest(pt.lat, pt.lon, todayDate) ?? null, fwiResting: fwi?.resting(pt.lat, pt.lon, todayDate) ?? false,
  }
}

/** Score many points with one weather fetch (chunked), one hotspot fetch and one fire weather station fetch. */
export async function pointsRisk(mode: Mode, pts: Pt[], days = DEFAULT_HORIZON) {
  const [wx, hs, fwi] = await Promise.all([weather(mode, pts, days), softHotspots(mode), softFwi(mode)])
  return { points: pts.map((p, i) => scorePoint(wx[i], hs.list, p, mode, days, fwi.lookup)), hotspots: hs.list, hotspotSources: hs.sources, sources: [wxSrc(mode), ...hs.sources, ...fwi.sources, riskSrc()] }
}

/** Risk at one point (weather fetched at that point). */
export async function pointRisk(mode: Mode, pt: Pt, days = DEFAULT_HORIZON) {
  const r = await pointsRisk(mode, [{ lat: pt.lat, lon: pt.lon }], days)
  return { ...r.points[0], hotspots: r.hotspots, sources: r.sources }
}

export async function regionSummaries(mode: Mode, days = DEFAULT_HORIZON): Promise<Envelope<RegionSummary[]>> {
  const [pr, air, fires] = await Promise.all([pointsRisk(mode, REGIONS, days), airNow(mode, REGIONS), softFires(mode)])
  const data = REGIONS.map((region, i): RegionSummary => {
    const p = pr.points[i], now = p.today
    const idx = p.timeline.findIndex((t) => t.kind === 'today')
    const ahead = p.timeline[Math.min(p.timeline.length - 1, idx + days)]
    return { region, risk: { score: now.score, level: now.level, confidence: now.confidence, trend: ahead ? ahead.score - now.score : 0 }, air: air[i], hotspots100km: p.hotspots100km ?? 0, activeFires250km: fires.list ? within(fires.list, region.lat, region.lon, 250) : 0 }
  })
  return { data, sources: [wxSrc(mode), airSrc(mode), ...pr.hotspotSources, ...fires.sources, riskSrc()] }
}

export async function regionRisk(mode: Mode, id: string, days = DEFAULT_HORIZON): Promise<Envelope<RegionRisk>> {
  const region = regionById(id)
  if (!region) throw new NotFound(`Unknown region "${id}"`)
  const [p, climate] = await Promise.all([
    pointRisk(mode, region, days),
    (mode === 'sim' ? Promise.resolve(simClimate(region.lat)) : getClimate(region.lat, region.lon)).catch((): ClimateNormals | null => null),
  ])
  const sources = [...p.sources]
  if (climate) sources.push(mode === 'sim' ? simSrc('sim-climate', 'climate normals') : src('nasa-power', 'NASA POWER climatology', 'historical', 'https://power.larc.nasa.gov/', 'Long-term monthly means from NASA reanalysis'))
  return { data: { region, current: p.wx.current, today: p.today, timeline: p.timeline, days: p.wx.days, hotspots100km: p.hotspots100km ?? 0, climate, horizon: days }, sources }
}

/** Air series for a region; the forecast part stops at min(days, MAX_AIR_HORIZON) because the air-quality model ends there. */
export async function regionAir(mode: Mode, id: string, pastDays: number, days = DEFAULT_HORIZON): Promise<Envelope<RegionAir>> {
  const region = regionById(id)
  if (!region) throw new NotFound(`Unknown region "${id}"`)
  const { now, hourly } = mode === 'sim' ? simAirSeries(region, pastDays, days) : await getAirSeries(region, pastDays, days)
  const byDay = new Map<string, { sum: number; n: number; fc: boolean }>()
  for (const h of hourly) {
    if (h.pm25 == null) continue
    const d = byDay.get(h.time.slice(0, 10)) ?? byDay.set(h.time.slice(0, 10), { sum: 0, n: 0, fc: true }).get(h.time.slice(0, 10))!
    d.sum += h.pm25; d.n++; if (h.kind === 'model') d.fc = false
  }
  const daily = [...byDay.entries()].filter(([, v]) => v.n >= 12).map(([date, v]) => ({ date, pm25: +(v.sum / v.n).toFixed(1), kind: v.fc ? 'forecast' as const : 'model' as const }))
  return { data: { region, now, hourly, daily }, sources: [airSrc(mode)] }
}

export async function communities(mode: Mode): Promise<Envelope<CommunityExposure[]>> {
  const [air, fires, hs] = await Promise.all([airNow(mode, COMMUNITIES).catch(() => null), softFires(mode), softHotspots(mode)])
  if (!air && !fires.list && !hs.list) throw new Error('No exposure data sources are reachable right now')
  const data = COMMUNITIES.map((c, i): CommunityExposure => {
    const near = (fires.list ?? []).map((f) => ({ f, d: km(c.lat, c.lon, f.lat, f.lon) })).sort((a, b) => a.d - b.d)
    return { ...c, nearestFireKm: near[0] ? Math.round(near[0].d) : null, nearestFireName: near[0]?.f.name ?? null, fires100km: near.filter((x) => x.d <= 100).length, hotspots100km: hs.list ? within(hs.list, c.lat, c.lon, 100) : 0, pm25: air?.[i]?.pm25 ?? null, usAqi: air?.[i]?.usAqi ?? null }
  })
  return { data, sources: [...fires.sources, ...hs.sources, ...(air ? [airSrc(mode)] : []), src('communities', 'Community locations (approximate, public)', 'reference', 'https://open.canada.ca/data/en/dataset/b6567c5c-8339-4055-99fa-63f92114d9e4', 'Demonstration subset with rounded coordinates')] }
}

export async function airTrends(mode: Mode): Promise<Envelope<AirTrend[]>> {
  const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null)
  const raw = mode === 'sim'
    ? REGIONS.map((r) => { const past = simAirSeries(r, 2).hourly.filter((h) => h.kind === 'model').map((h) => h.pm25 ?? 0); return { last24: mean(past.slice(-24)), prev24: mean(past.slice(-48, -24)) } })
    : await getAirTrend(REGIONS)
  const round = (v: number | null) => (v == null ? null : +v.toFixed(1))
  return { data: REGIONS.map((r, i) => ({ regionId: r.id, short: r.short, last24: round(raw[i].last24), prev24: round(raw[i].prev24), change: raw[i].last24 != null && raw[i].prev24 != null ? +(raw[i].last24! - raw[i].prev24!).toFixed(1) : null })), sources: [airSrc(mode)] }
}
