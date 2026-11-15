// Long-term climate context from NASA POWER daily records (1984 to the last full year).
// The record itself is real NASA data in both modes; only the comparison window depends on the mode:
//   live: today's calendar date ± 7 days
//   sim:  7–21 July, because the simulated scenario is set in mid-July.
import type { ClimateHistory, ClimateMetricHistory, Envelope, Mode } from '../shared/types.ts'
import { linearTrend, mannKendall, quantiles, senSlope } from '../shared/stats.ts'
import { regionById } from './data/regions.ts'
import { getPowerDaily, type PowerDaily } from './sources/powerDaily.ts'
import { NotFound } from './services.ts'
import { SIM_NOW_MS, simLocalDay } from './sim.ts'
import { src } from './util.ts'

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const PCTS = Array.from({ length: 101 }, (_, i) => i / 100)
/** Fire season used for the per-year series: 1 May to 30 September. */
const SEASON = { from: '0501', to: '0930' }

const mmdd = (d: Date) => `${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`

/** The 15 calendar days (MMDD) centred on month/day, built in a non-leap year so 29 Feb never appears. */
function windowDays(month: number, day: number): { set: Set<string>; start: Date; end: Date } {
  const centre = Date.UTC(2001, month - 1, day)
  const days = Array.from({ length: 15 }, (_, i) => new Date(centre + (i - 7) * 86400000))
  return { set: new Set(days.map(mmdd)), start: days[0], end: days[14] }
}

function windowFor(mode: Mode) {
  if (mode === 'sim') {
    // The scenario's own today (14 July), never the real clock.
    const today = simLocalDay(SIM_NOW_MS)
    const w = windowDays(Number(today.slice(5, 7)), Number(today.slice(8, 10)))
    return { ...w, label: 'mid-July', note: 'The simulated scenario is set in mid-July, so today is compared with 7–21 July of every year.' }
  }
  const now = new Date()
  const w = windowDays(now.getMonth() + 1, now.getDate())
  const sameMonth = w.start.getUTCMonth() === w.end.getUTCMonth()
  const label = sameMonth
    ? `${MON[w.start.getUTCMonth()]} ${w.start.getUTCDate()}–${w.end.getUTCDate()}`
    : `${MON[w.start.getUTCMonth()]} ${w.start.getUTCDate()}–${MON[w.end.getUTCMonth()]} ${w.end.getUTCDate()}`
  return { ...w, label, note: "Today's calendar date ± 7 days in every year of the record." }
}

const mean = (v: number[]) => v.reduce((a, x) => a + x, 0) / v.length
const sd = (v: number[]) => { const m = mean(v); return Math.sqrt(v.reduce((a, x) => a + (x - m) ** 2, 0) / Math.max(1, v.length - 1)) }
const r = (v: number, d = 4) => (Number.isFinite(v) ? Number(v.toFixed(d)) : v)

type Key = 'tMax' | 'rh' | 'precip' | 'wind' | 'soil'
const META: Record<Key, { unit: string; annualUnit: string; label: string; total?: boolean }> = {
  tMax: { unit: '°C', annualUnit: '°C', label: 'Daily maximum temperature' },
  rh: { unit: '%', annualUnit: '%', label: 'Relative humidity (daily mean)' },
  precip: { unit: 'mm/day', annualUnit: 'mm', label: 'Precipitation', total: true },
  wind: { unit: 'm/s', annualUnit: 'm/s', label: 'Wind speed at 10 m (daily mean)' },
  soil: { unit: '0–1', annualUnit: '0–1', label: 'Surface soil wetness' },
}

function metric(d: PowerDaily, key: Key, win: Set<string>): ClimateMetricHistory {
  const vals = d[key]
  const inWin: number[] = []
  const byYear = new Map<number, { sum: number; n: number; days: number }>()
  for (let i = 0; i < d.dates.length; i++) {
    const date = d.dates[i], md = date.slice(4), v = vals[i]
    if (v != null && win.has(md)) inWin.push(v)
    if (md >= SEASON.from && md <= SEASON.to) {
      const y = Number(date.slice(0, 4))
      const b = byYear.get(y) ?? { sum: 0, n: 0, days: 0 }
      b.days++
      if (v != null) { b.sum += v; b.n++ }
      byYear.set(y, b)
    }
  }
  const m = META[key]
  // A season counts only with at least 90% of its days present.
  const annual = [...byYear.entries()].sort((a, b) => a[0] - b[0])
    .filter(([, b]) => b.n >= 0.9 * b.days)
    .map(([year, b]) => ({ year, value: r(m.total ? (b.sum / b.n) * b.days : b.sum / b.n, 3) }))
  const ys = annual.map((a) => a.value)
  const mk = mannKendall(ys)
  const lt = linearTrend(ys)
  const sen = senSlope(ys)
  // Sen line intercept (Conover): median of y_i − slope × i, reported at the first annual point.
  const resid = ys.map((y, i) => y - sen * i).sort((a, b) => a - b)
  const senIntercept = resid.length ? (resid.length % 2 ? resid[resid.length >> 1] : (resid[resid.length / 2 - 1] + resid[resid.length / 2]) / 2) : NaN
  return {
    unit: m.unit, annualUnit: m.annualUnit, label: m.label,
    window: { mean: r(mean(inWin), 3), sd: r(sd(inWin), 3), q: quantiles(inWin, PCTS).map((v) => r(v, 3)), n: inWin.length },
    annual,
    trend: {
      mannKendall: { tau: r(mk.tau), pValue: r(mk.pValue, 5), trend: mk.trend },
      senPerDecade: r(sen * 10),
      senIntercept: r(senIntercept),
      linear: { slope: r(lt.slope, 5), intercept: r(lt.intercept), r2: r(lt.r2), pValue: r(lt.pValue, 5) },
    },
  }
}

export async function climateHistory(mode: Mode, id: string): Promise<Envelope<ClimateHistory>> {
  const region = regionById(id)
  if (!region) throw new NotFound(`Unknown region: ${id}`)
  return climateHistoryAt(mode, region.lat, region.lon)
}

/** The same history for any point (used by /api/place for a community's location). */
export async function climateHistoryAt(mode: Mode, lat: number, lon: number): Promise<Envelope<ClimateHistory>> {
  const d = await getPowerDaily(lat, lon)
  const w = windowFor(mode)
  const years = new Set(d.dates.map((x) => x.slice(0, 4)))
  const data: ClimateHistory = {
    period: { startYear: d.startYear, endYear: d.endYear, years: years.size, days: d.dates.length },
    window: { label: w.label, startMMDD: mmdd(w.start), endMMDD: mmdd(w.end), note: w.note },
    metrics: {
      tMax: metric(d, 'tMax', w.set), rh: metric(d, 'rh', w.set), precip: metric(d, 'precip', w.set),
      wind: metric(d, 'wind', w.set), soil: metric(d, 'soil', w.set),
    },
  }
  return {
    data,
    sources: [src('nasa-power-daily', `NASA POWER daily, ${d.startYear}–${d.endYear}`, 'historical', 'https://power.larc.nasa.gov/', 'MERRA-2 / satellite-derived daily values on a ~0.5° grid')],
  }
}
