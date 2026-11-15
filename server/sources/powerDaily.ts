// NASA POWER daily point data, 1984 to the last full year. Free, no key. About 1 MB per point.
// Docs: https://power.larc.nasa.gov/docs/services/api/temporal/daily/
// Cached in memory and on disk (server/.cache, 7-day TTL) so restarts do not re-download 40+ years.
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { cached, fetchUpstream, num, registerIntegration } from '../util.ts'

registerIntegration({ id: 'nasa-power-daily', name: 'NASA POWER daily (1984–present)', needsKey: false, configured: true, purpose: 'Decades of daily temperature, humidity, rain, wind and soil wetness for long-term trends' })

export const POWER_START_YEAR = 1984
const TTL = 7 * 24 * 3600 * 1000
const CACHE_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.cache')

export interface PowerDaily {
  /** YYYYMMDD, ascending */
  dates: string[]
  /** null = missing (POWER fill value −999) */
  tMax: (number | null)[]  // T2M_MAX, °C
  rh: (number | null)[]    // RH2M, %, daily mean
  precip: (number | null)[] // PRECTOTCORR, mm/day
  wind: (number | null)[]  // WS10M, m/s, daily mean at 10 m
  soil: (number | null)[]  // GWETTOP, 0–1 surface soil wetness
  startYear: number
  endYear: number
}

const PARAMS = { tMax: 'T2M_MAX', rh: 'RH2M', precip: 'PRECTOTCORR', wind: 'WS10M', soil: 'GWETTOP' } as const

async function fetchPower(lat: number, lon: number, endYear: number): Promise<PowerDaily> {
  const url = `https://power.larc.nasa.gov/api/temporal/daily/point?parameters=${Object.values(PARAMS).join(',')}&community=AG&longitude=${lon}&latitude=${lat}&start=${POWER_START_YEAR}0101&end=${endYear}1231&format=JSON`
  const p = (await fetchUpstream('nasa-power-daily', url, 'json', 45000))?.properties?.parameter
  if (!p?.T2M_MAX || typeof p.T2M_MAX !== 'object') throw new Error('NASA POWER daily: malformed response')
  const dates = Object.keys(p.T2M_MAX).filter((d) => /^\d{8}$/.test(d)).sort()
  const col = (k: string) => dates.map((d) => { const v = num(p[k]?.[d]); return v == null || v <= -900 ? null : v })
  return {
    dates,
    tMax: col(PARAMS.tMax), rh: col(PARAMS.rh), precip: col(PARAMS.precip), wind: col(PARAMS.wind), soil: col(PARAMS.soil),
    startYear: POWER_START_YEAR, endYear,
  }
}

export function getPowerDaily(lat: number, lon: number): Promise<PowerDaily> {
  const endYear = new Date().getFullYear() - 1 // last full year
  return cached(`power-daily:${lat},${lon}:${endYear}`, async () => {
    const file = path.join(CACHE_DIR, `power-daily-${lat}-${lon}.json`)
    try {
      const st = await stat(file)
      if (Date.now() - st.mtimeMs < TTL) {
        const hit = JSON.parse(await readFile(file, 'utf8')) as PowerDaily
        if (hit.endYear === endYear && hit.dates?.length) return hit
      }
    } catch { /* no cache file yet, or unreadable: fetch */ }
    const data = await fetchPower(lat, lon, endYear)
    try {
      await mkdir(CACHE_DIR, { recursive: true })
      await writeFile(file, JSON.stringify(data))
    } catch (e) { console.warn('[power-daily] could not write disk cache:', (e as Error).message) }
    return data
  }, TTL)
}
