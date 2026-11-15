// Open-Meteo — free, no key. Weather forecast/analysis and CAMS-based air quality.
// Docs: https://open-meteo.com/en/docs and https://open-meteo.com/en/docs/air-quality-api
import type { AirNow, AirPoint, CurrentWeather, DayWeather } from '../../shared/types.ts'
import { cached, fetchUpstream, num, registerIntegration } from '../util.ts'

registerIntegration({ id: 'open-meteo-weather', name: 'Open-Meteo Weather', needsKey: false, configured: true, purpose: 'Temperature, humidity, wind, rain, soil moisture, VPD; 7 days back and 3 days ahead' })
registerIntegration({ id: 'open-meteo-air', name: 'Open-Meteo Air Quality (CAMS)', needsKey: false, configured: true, purpose: 'Modelled PM2.5, PM10, US AQI and aerosol optical depth' })

export interface Pt { lat: number; lon: number }
export interface WeatherResult { current: CurrentWeather; days: DayWeather[] }

const coords = (pts: Pt[]) => `latitude=${pts.map((p) => p.lat).join(',')}&longitude=${pts.map((p) => p.lon).join(',')}`
const asArray = (j: any) => (Array.isArray(j) ? j : [j])
const max = (a: number[]) => (a.length ? Math.max(...a) : null)
const min = (a: number[]) => (a.length ? Math.min(...a) : null)
const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null)
const sum = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) : null)

const HOURLY = 'temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,precipitation,vapour_pressure_deficit,soil_moisture_0_to_1cm,snow_depth'

/** Weather for several points in one request. Hourly values are aggregated to local days here. */
export function getWeather(pts: Pt[]): Promise<WeatherResult[]> {
  const url = `https://api.open-meteo.com/v1/forecast?${coords(pts)}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,precipitation&hourly=${HOURLY}&past_days=7&forecast_days=4&timezone=auto&wind_speed_unit=kmh`
  return cached(`wx:${coords(pts)}`, async () => {
    const json = asArray(await fetchUpstream('open-meteo-weather', url))
    if (json.length !== pts.length) throw new Error('Open-Meteo returned an unexpected number of locations')
    return json.map(parseWeather)
  })
}

function parseWeather(j: any): WeatherResult {
  const h = j?.hourly, c = j?.current
  if (!h?.time || !Array.isArray(h.time)) throw new Error('Open-Meteo weather: malformed response')
  const today = String(c?.time ?? '').slice(0, 10)
  const byDay = new Map<string, number[]>()
  h.time.forEach((t: string, i: number) => { const d = t.slice(0, 10); (byDay.get(d) ?? byDay.set(d, []).get(d)!).push(i) })
  const col = (name: string, idx: number[]) => idx.map((i) => num(h[name]?.[i])).filter((v): v is number => v != null)
  const days: DayWeather[] = [...byDay.entries()].map(([date, idx]) => {
    // wind direction at the hour of strongest wind
    const w = idx.map((i) => ({ s: num(h.wind_speed_10m?.[i]) ?? -1, d: num(h.wind_direction_10m?.[i]) })).sort((a, b) => b.s - a.s)[0]
    return {
      date, kind: date > today ? 'forecast' : 'historical',
      tMax: max(col('temperature_2m', idx)), rhMin: min(col('relative_humidity_2m', idx)),
      windMax: max(col('wind_speed_10m', idx)), windDir: w?.d ?? null,
      precip: sum(col('precipitation', idx)), vpdMax: max(col('vapour_pressure_deficit', idx)),
      soil: mean(col('soil_moisture_0_to_1cm', idx)), snow: max(col('snow_depth', idx)),
    }
  })
  return {
    current: { time: c?.time ?? new Date().toISOString(), temp: num(c?.temperature_2m), rh: num(c?.relative_humidity_2m), wind: num(c?.wind_speed_10m), windDir: num(c?.wind_direction_10m), precip: num(c?.precipitation) },
    days,
  }
}

/** Current air quality for many points (one request). */
export function getAirNow(pts: Pt[]): Promise<AirNow[]> {
  const url = `https://air-quality-api.open-meteo.com/v1/air-quality?${coords(pts)}&current=pm2_5,pm10,us_aqi,aerosol_optical_depth&timezone=auto`
  return cached(`airnow:${coords(pts)}`, async () => {
    const json = asArray(await fetchUpstream('open-meteo-air', url))
    if (json.length !== pts.length) throw new Error('Open-Meteo returned an unexpected number of locations')
    return json.map((j: any): AirNow => ({ time: j?.current?.time ?? '', pm25: num(j?.current?.pm2_5), pm10: num(j?.current?.pm10), usAqi: num(j?.current?.us_aqi), aod: num(j?.current?.aerosol_optical_depth) }))
  })
}

/** Hourly PM series for one point: `pastDays` back (max 92) and 3 days ahead. */
export function getAirSeries(pt: Pt, pastDays = 7): Promise<{ now: AirNow; hourly: AirPoint[] }> {
  const url = `https://air-quality-api.open-meteo.com/v1/air-quality?${coords([pt])}&current=pm2_5,pm10,us_aqi,aerosol_optical_depth&hourly=pm2_5,pm10&past_days=${pastDays}&forecast_days=4&timezone=auto`
  return cached(`air:${pt.lat},${pt.lon}:${pastDays}`, async () => {
    const j = await fetchUpstream('open-meteo-air', url)
    if (!Array.isArray(j?.hourly?.time)) throw new Error('Open-Meteo air quality: malformed response')
    const nowT = String(j.current?.time ?? '')
    const hourly: AirPoint[] = j.hourly.time.map((t: string, i: number) => ({ time: t, pm25: num(j.hourly.pm2_5?.[i]), pm10: num(j.hourly.pm10?.[i]), kind: t > nowT ? 'forecast' : 'model' }))
    return { now: { time: nowT, pm25: num(j.current?.pm2_5), pm10: num(j.current?.pm10), usAqi: num(j.current?.us_aqi), aod: num(j.current?.aerosol_optical_depth) }, hourly }
  })
}

/** Mean PM2.5 over the last 24 h and the 24 h before that, for many points (one request). */
export function getAirTrend(pts: Pt[]): Promise<{ last24: number | null; prev24: number | null }[]> {
  const url = `https://air-quality-api.open-meteo.com/v1/air-quality?${coords(pts)}&current=pm2_5&hourly=pm2_5&past_days=2&forecast_days=1&timezone=auto`
  return cached(`airtrend:${coords(pts)}`, async () => {
    const json = asArray(await fetchUpstream('open-meteo-air', url))
    return json.map((j: any) => {
      const nowT = String(j?.current?.time ?? ''), t: string[] = j?.hourly?.time ?? []
      const past = t.map((x, i) => ({ x, v: num(j.hourly.pm2_5?.[i]) })).filter((p) => p.x <= nowT && p.v != null).map((p) => p.v as number)
      return { last24: mean(past.slice(-24)), prev24: mean(past.slice(-48, -24)) }
    })
  })
}
