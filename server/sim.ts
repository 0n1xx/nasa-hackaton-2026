// SIMULATED demonstration scenario.
//
// Everything in this file is invented by a seeded random generator so the
// interface can be shown outside fire season or without a network connection.
// The scenario is loosely shaped like a severe mid-summer outbreak in
// Northwestern Ontario. None of it is an observation, and every response built
// from it carries kind: "simulated" so the UI labels it.
import type { ActiveFire, AirNow, AirPoint, ClimateNormals, Hotspot } from '../shared/types.ts'
import type { Pt, WeatherResult } from './sources/openMeteo.ts'
import { km } from './util.ts'
import { aqiFromPm25 } from '../shared/aqi.ts'
import { DEFAULT_HORIZON, MAX_AIR_HORIZON } from '../shared/horizon.ts'

function rng(seed: number) {
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}
/** Local calendar date (YYYY-MM-DD), not UTC, so 'today' matches the presenter's clock in the evening. */
const localDay = (ms: number) => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
const hash = (lat: number, lon: number) => Math.round(lat * 1000) * 7919 + Math.round(lon * 1000) * 104729

// cluster centre, spread (deg), number of fires, typical size (ha), agency
const CLUSTERS: [number, number, number, number, number, string][] = [
  [50.35, -89.3, 0.5, 9, 22000, 'ON'], [49.85, -92.3, 0.6, 6, 9000, 'ON'], [48.55, -91.9, 0.4, 4, 6000, 'ON'],
  [53.3, -88.6, 0.7, 6, 15000, 'ON'], [52.3, -93.6, 0.6, 4, 8000, 'ON'],
  [55.6, -100.4, 1.0, 7, 30000, 'MB'], [56.2, -105.2, 1.1, 8, 45000, 'SK'], [57.6, -113.2, 1.0, 5, 12000, 'AB'],
  [61.0, -116.2, 1.0, 5, 40000, 'NT'], [52.2, -122.0, 0.9, 6, 5000, 'BC'], [50.9, -75.2, 0.8, 3, 4000, 'QC'],
]
const STAGES = ['OC', 'OC', 'OC', 'BH', 'BH', 'UC']

let fireCache: ActiveFire[] | null = null
export function simActiveFires(): ActiveFire[] {
  if (fireCache) return fireCache
  const r = rng(20260714), out: ActiveFire[] = []
  const start = localDay(Date.now() - 6 * 86400000)
  for (const [lat, lon, spread, n, size, agency] of CLUSTERS) {
    for (let i = 0; i < n; i++) {
      out.push({ id: `SIM-${agency}-${out.length + 1}`, name: `SIM ${agency} ${String(out.length + 1).padStart(3, '0')}`, agency, lat: lat + (r() - 0.5) * 2 * spread, lon: lon + (r() - 0.5) * 3 * spread, hectares: Math.round(size * (0.05 + r() ** 2 * 1.6)), startDate: start, stage: STAGES[Math.floor(r() * STAGES.length)] })
    }
  }
  return (fireCache = out)
}

export function simHotspots(days: number): Hotspot[] {
  const r = rng(77 + days), out: Hotspot[] = []
  for (const f of simActiveFires()) {
    if (f.stage === 'UC') continue
    const n = Math.min(60, Math.round((3 + Math.sqrt(f.hectares) / 9) * (f.stage === 'OC' ? 1 : 0.4) * (0.6 + days * 0.4)))
    const rad = Math.sqrt(f.hectares) / 1100 + 0.02
    for (let i = 0; i < n; i++) {
      out.push({ lat: f.lat + (r() - 0.5) * 2 * rad, lon: f.lon + (r() - 0.5) * 3.2 * rad, frp: Math.round((2 + r() ** 3 * 180) * 10) / 10, time: new Date(Date.now() - r() * days * 86400000).toISOString(), sensor: 'SIMULATED' })
    }
  }
  return out
}

/** Smoke load at a point: inverse-distance sum over burning simulated fires. */
function smoke(lat: number, lon: number): number {
  let s = 0
  for (const f of simActiveFires()) if (f.stage !== 'UC') s += Math.sqrt(f.hectares) / (30 + km(lat, lon, f.lat, f.lon)) ** 1.35
  return s
}

/** Heat/dryness anomaly: strongest over NW Ontario, weaker elsewhere. */
const anomaly = (lat: number, lon: number) => Math.exp(-(((lat - 50.5) / 5) ** 2 + ((lon + 90.5) / 9) ** 2))

/** 7 past days, today and `horizon` days ahead. The first 11 days (-7 … +3) are identical for any horizon. */
export function simWeather(pts: Pt[], horizon = DEFAULT_HORIZON): WeatherResult[] {
  return pts.map((p) => {
    const r = rng(hash(p.lat, p.lon)), a = anomaly(p.lat, p.lon)
    // Days beyond +3 draw from their own generator so the original 11-day sequence never shifts.
    const rx = rng(hash(p.lat, p.lon) + 9173)
    const days = Array.from({ length: 8 + horizon }, (_, i) => {
      const off = i - 7 // -7 … +horizon
      // Past +3 the build has plateaued (build = 1): the same formulas continue, varied only by rx.
      const g = off > 3 ? rx : r
      // Heat and dryness build through the week from a cool, damp start, so the
      // scenario shows warning signs lining up days before the peak.
      const build = 0.1 + 0.9 * Math.min(1, i / 7)
      const tMax = 19 + 13 * a * build + (g() - 0.5) * 3 - Math.max(0, p.lat - 55) * 0.5
      const rhMin = Math.max(14, 62 - 40 * a * build + (g() - 0.5) * 10)
      const wet = i <= 1 ? g() < 0.55 + 0.4 * a : g() < 0.14 - 0.12 * a
      return {
        date: localDay(Date.now() + off * 86400000), kind: off > 0 ? 'forecast' as const : 'historical' as const,
        tMax: +tMax.toFixed(1), rhMin: Math.round(rhMin), windMax: +(12 + g() * 16 + 10 * a * (off >= -1 ? 1 : 0.4)).toFixed(1), windDir: Math.round(200 + g() * 90),
        precip: wet ? +((i <= 1 ? 8 : 1) + g() * 9).toFixed(1) : 0, vpdMax: +(0.6108 * Math.exp((17.27 * tMax) / (tMax + 237.3)) * (1 - rhMin / 100)).toFixed(2),
        soil: +(0.3 - 0.17 * a * build + (g() - 0.5) * 0.03).toFixed(3), snow: 0,
      }
    })
    const t = days[7]
    return { current: { time: new Date().toISOString().slice(0, 16), temp: +(t.tMax - 2).toFixed(1), rh: t.rhMin + 6, wind: +(t.windMax * 0.7).toFixed(1), windDir: t.windDir, precip: 0 }, days }
  })
}

const pmAt = (lat: number, lon: number, wobble = 1) => Math.round((5 + smoke(lat, lon) * 95 * wobble) * 10) / 10

export function simAirNow(pts: Pt[]): AirNow[] {
  return pts.map((p) => { const pm25 = pmAt(p.lat, p.lon); return { time: new Date().toISOString().slice(0, 16), pm25, pm10: +(pm25 * 1.25 + 4).toFixed(1), usAqi: aqiFromPm25(pm25), aod: +(0.08 + pm25 / 160).toFixed(2) } })
}

export function simAirSeries(p: Pt, pastDays: number, days = DEFAULT_HORIZON): { now: AirNow; hourly: AirPoint[] } {
  const r = rng(hash(p.lat, p.lon) + 5), hourly: AirPoint[] = []
  const now = Date.now(), H = 3600000, end = Math.min(days, MAX_AIR_HORIZON) * 24
  for (let h = -pastDays * 24; h <= end; h++) {
    const ramp = Math.min(1, Math.max(0.08, 1 + h / (24 * 6)))            // smoke builds over the last 6 days
    const pulse = 0.75 + 0.35 * Math.sin((h / 24) * 2 * Math.PI + 1) + (r() - 0.5) * 0.3 // overnight pooling
    const pm25 = Math.max(2, pmAt(p.lat, p.lon, ramp * pulse))
    hourly.push({ time: new Date(now + h * H).toISOString().slice(0, 16), pm25: +pm25.toFixed(1), pm10: +(pm25 * 1.25 + 4).toFixed(1), kind: h > 0 ? 'forecast' : 'model' })
  }
  return { now: simAirNow([p])[0], hourly }
}

export function simClimate(lat: number): ClimateNormals {
  const base = [-13, -10, -3, 6, 14, 20, 23, 22, 16, 8, -1, -9].map((t) => +(t - (lat - 49) * 0.7).toFixed(1))
  return { tempC: base, precipMmDay: [1.0, 0.8, 1.1, 1.5, 2.3, 3.0, 3.0, 2.8, 2.9, 2.2, 1.6, 1.2], rh: [78, 75, 70, 62, 58, 62, 66, 68, 72, 76, 82, 82] }
}
