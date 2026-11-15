// Combines data sources into the views the UI needs. No HTTP details here.
import type { ActiveFire, CommunityExposure, DayWeather, Envelope, Hotspot, Mode, RegionAir, RegionRisk, RegionSummary, RiskDay, SourceMeta, ClimateNormals, AirTrend } from '../shared/types.ts'
import { computeRisk, type RiskInputs } from '../shared/risk.ts'
import { REGIONS, regionById } from './data/regions.ts'
import { COMMUNITIES } from './data/communities.ts'
import { getActiveFires, getHotspots24h } from './sources/cwfis.ts'
import { firmsConfigured, firmsSourceLabel, getFirmsHotspots } from './sources/firms.ts'
import { getAirNow, getAirSeries, getAirTrend, getWeather, type WeatherResult } from './sources/openMeteo.ts'
import { getClimate } from './sources/power.ts'
import { simActiveFires, simAirNow, simAirSeries, simClimate, simHotspots, simWeather } from './sim.ts'
import { km, src } from './util.ts'

const SIM_NOTE = 'Simulated demonstration scenario — not an observation'
const simSrc = (id: string, what: string): SourceMeta => src(id, `Simulated ${what}`, 'simulated', undefined, SIM_NOTE)

export class NotFound extends Error {}
export class BadRequest extends Error {}

export async function activeFires(mode: Mode): Promise<Envelope<ActiveFire[]>> {
  if (mode === 'sim') return { data: simActiveFires(), sources: [simSrc('sim-fires', 'active fires')] }
  return { data: await getActiveFires(), sources: [src('cwfis-active', 'CWFIS active fires (agency-reported)', 'observed', 'https://cwfis.cfs.nrcan.gc.ca/datamart', 'Updated daily by provincial, territorial and Parks Canada fire agencies')] }
}

export async function hotspots(mode: Mode, days: number, date?: string): Promise<Envelope<Hotspot[]>> {
  if (mode === 'sim') return { data: simHotspots(days), sources: [simSrc('sim-hotspots', 'satellite detections')] }
  if (firmsConfigured()) {
    return { data: await getFirmsHotspots(days, date), sources: [src('firms', firmsSourceLabel(), 'observed', 'https://firms.modaps.eosdis.nasa.gov/', date ? `Detections from ${date}, ${days} day(s)` : `Last ${days} day(s)`)] }
  }
  if (date) throw new BadRequest('Vector fire detections for a past date need a NASA FIRMS key (FIRMS_MAP_KEY). The NASA GIBS satellite layers on the map still work for any date.')
  return { data: await getHotspots24h(), sources: [src('cwfis-hotspots', 'CWFIS satellite hotspots, last 24 h', 'observed', 'https://cwfis.cfs.nrcan.gc.ca/datamart', 'No FIRMS key set, so only the last 24 hours are available')] }
}

const weather = (mode: Mode, pts: { lat: number; lon: number }[]) => (mode === 'sim' ? Promise.resolve(simWeather(pts)) : getWeather(pts))
const airNow = (mode: Mode, pts: { lat: number; lon: number }[]) => (mode === 'sim' ? Promise.resolve(simAirNow(pts)) : getAirNow(pts))
const wxSrc = (mode: Mode) => mode === 'sim' ? simSrc('sim-weather', 'weather') : src('open-meteo-weather', 'Open-Meteo weather (model analysis + forecast)', 'model', 'https://open-meteo.com/', 'Gridded numerical weather models, not station measurements')
const airSrc = (mode: Mode) => mode === 'sim' ? simSrc('sim-air', 'air quality') : src('open-meteo-air', 'Open-Meteo air quality (CAMS global model)', 'model', 'https://open-meteo.com/en/docs/air-quality-api', 'Modelled at roughly 40 km resolution; not ground monitors. AQI shown is the US EPA scale')
const riskSrc = () => src('risk-model', 'BorealWatch risk index v0.1', 'model', undefined, 'Rule-based prototype, unvalidated. A relative index, not a probability')

const within = (pts: { lat: number; lon: number }[], lat: number, lon: number, radius: number) => pts.reduce((n, p) => n + (km(lat, lon, p.lat, p.lon) <= radius ? 1 : 0), 0)

/** Risk for each day we can score (needs at least 3 days of rain history before it). */
function riskDays(wx: WeatherResult, hotspots100km: number | null, historyIndex: number, mode: Mode) {
  const today = wx.days.filter((d) => d.kind === 'historical').at(-1)?.date
  const out: { day: DayWeather; inputs: RiskInputs }[] = []
  wx.days.forEach((day, i) => {
    if (i < 3) return
    const prior = wx.days.slice(Math.max(0, i - 7), i).map((d) => d.precip).filter((v): v is number => v != null)
    const precip7d = prior.length ? (prior.reduce((a, b) => a + b, 0) * 7) / prior.length : null
    out.push({ day, inputs: { tMax: day.tMax, rhMin: day.rhMin, windMax: day.windMax, precip7d: precip7d == null ? null : +precip7d.toFixed(1), soil: day.soil, vpdMax: day.vpdMax, hotspots100km, historyIndex, snow: day.snow, quality: mode === 'sim' ? 'simulated' : day.kind === 'forecast' ? 'forecast' : 'observed' } })
  })
  return { today, out }
}

/** Hotspots are optional for risk: if that source is down we still score, with lower confidence. */
async function softHotspots(mode: Mode): Promise<{ list: Hotspot[] | null; sources: SourceMeta[] }> {
  try { const h = await hotspots(mode, 1); return { list: h.data, sources: h.sources } } catch { return { list: null, sources: [] } }
}
async function softFires(mode: Mode): Promise<{ list: ActiveFire[] | null; sources: SourceMeta[] }> {
  try { const f = await activeFires(mode); return { list: f.data, sources: f.sources } } catch { return { list: null, sources: [] } }
}

export async function regionSummaries(mode: Mode): Promise<Envelope<RegionSummary[]>> {
  const [wx, air, hs, fires] = await Promise.all([weather(mode, REGIONS), airNow(mode, REGIONS), softHotspots(mode), softFires(mode)])
  const data = REGIONS.map((region, i): RegionSummary => {
    const n = hs.list ? within(hs.list, region.lat, region.lon, 100) : null
    const { today, out } = riskDays(wx[i], n, region.historyIndex, mode)
    const idx = out.findIndex((o) => o.day.date === today)
    const now = computeRisk(out[idx]?.inputs ?? out.at(-1)!.inputs)
    const ahead = out[Math.min(out.length - 1, idx + 3)]
    return { region, risk: { score: now.score, level: now.level, confidence: now.confidence, trend: ahead ? computeRisk(ahead.inputs).score - now.score : 0 }, air: air[i], hotspots100km: n ?? 0, activeFires250km: fires.list ? within(fires.list, region.lat, region.lon, 250) : 0 }
  })
  return { data, sources: [wxSrc(mode), airSrc(mode), ...hs.sources, ...fires.sources, riskSrc()] }
}

export async function regionRisk(mode: Mode, id: string): Promise<Envelope<RegionRisk>> {
  const region = regionById(id)
  if (!region) throw new NotFound(`Unknown region "${id}"`)
  const [[wx], hs, climate] = await Promise.all([
    weather(mode, [region]), softHotspots(mode),
    (mode === 'sim' ? Promise.resolve(simClimate(region.lat)) : getClimate(region.lat, region.lon)).catch((): ClimateNormals | null => null),
  ])
  const n = hs.list ? within(hs.list, region.lat, region.lon, 100) : null
  const { today, out } = riskDays(wx, n, region.historyIndex, mode)
  const todayEntry = out.find((o) => o.day.date === today) ?? out.at(-1)!
  const timeline: RiskDay[] = out.map((o) => { const r = computeRisk(o.inputs); return { date: o.day.date, kind: o.day.date === today ? 'today' : o.day.kind, score: r.score, level: r.level } })
  const sources = [wxSrc(mode), ...hs.sources, riskSrc()]
  if (climate) sources.push(mode === 'sim' ? simSrc('sim-climate', 'climate normals') : src('nasa-power', 'NASA POWER climatology', 'historical', 'https://power.larc.nasa.gov/', 'Long-term monthly means from NASA reanalysis'))
  return { data: { region, current: wx.current, today: computeRisk(todayEntry.inputs), timeline, days: wx.days, hotspots100km: n ?? 0, climate }, sources }
}

export async function regionAir(mode: Mode, id: string, pastDays: number): Promise<Envelope<RegionAir>> {
  const region = regionById(id)
  if (!region) throw new NotFound(`Unknown region "${id}"`)
  const { now, hourly } = mode === 'sim' ? simAirSeries(region, pastDays) : await getAirSeries(region, pastDays)
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
