// Gridded risk index for the map: one score per cell per day (past → today → forecast).
import type { Envelope, Hotspot, Mode, RiskGrid, SourceMeta } from '../shared/types.ts'
import { computeRisk } from '../shared/risk.ts'
import { REGIONS } from './data/regions.ts'
import { getWeather, type WeatherResult } from './sources/openMeteo.ts'
import { simWeather } from './sim.ts'
import { hotspots, riskDays } from './services.ts'
import { cached, km, src } from './util.ts'

const SIM_NOTE = 'Simulated demonstration scenario — not an observation'
const RADIUS_KM = 450

function buildCells(dLat: number, dLon: number) {
  const cells: { lat: number; lon: number; historyIndex: number }[] = []
  for (let lat = 49; lat <= 61 + 1e-9; lat += dLat) {
    for (let lon = -125; lon <= -70 + 1e-9; lon += dLon) {
      let best = Infinity, hi = 0
      for (const r of REGIONS) { const d = km(lat, lon, r.lat, r.lon); if (d < best) { best = d; hi = r.historyIndex } }
      if (best <= RADIUS_KM) cells.push({ lat: +lat.toFixed(3), lon: +lon.toFixed(3), historyIndex: hi })
    }
  }
  return cells
}

async function compute(mode: Mode): Promise<Envelope<RiskGrid>> {
  const [cellLat, cellLon] = mode === 'sim' ? [1.0, 1.5] : [2.0, 3.0]
  const cells = buildCells(cellLat, cellLon)

  let wx: WeatherResult[]
  if (mode === 'sim') wx = simWeather(cells)
  else {
    wx = []
    for (let i = 0; i < cells.length; i += 40) wx.push(...(await getWeather(cells.slice(i, i + 40))))
  }

  // Hotspots are optional, as in services.ts softHotspots: score without them if the source is down.
  let hs: Hotspot[] | null = null, hsSources: SourceMeta[] = []
  try { const h = await hotspots(mode, 1); hs = h.data; hsSources = h.sources } catch { /* score without */ }

  let days: RiskGrid['days'] = []
  const out = cells.map((c, ci) => {
    const n = hs ? hs.reduce((k, p) => k + (km(c.lat, c.lon, p.lat, p.lon) <= 100 ? 1 : 0), 0) : null
    const { today, out: scored } = riskDays(wx[ci], n, c.historyIndex, mode)
    if (ci === 0) days = scored.map((o) => ({ date: o.day.date, kind: o.day.date === today ? 'today' : o.day.kind }))
    const byDate = new Map(scored.map((o) => [o.day.date, o.inputs]))
    const scores = days.map((d, di) => { const inp = byDate.get(d.date) ?? scored[Math.min(di, scored.length - 1)]?.inputs; return inp ? Math.round(computeRisk(inp).score) : 0 })
    return { lat: c.lat, lon: c.lon, scores }
  })

  const sources: SourceMeta[] = mode === 'sim'
    ? [src('sim-weather', 'Simulated weather', 'simulated', undefined, SIM_NOTE), ...hsSources, src('risk-model', 'Before the Smoke risk index v0.1', 'model', undefined, 'Rule-based prototype, unvalidated. A relative index, not a probability')]
    : [src('open-meteo-weather', 'Open-Meteo weather (model analysis + forecast)', 'model', 'https://open-meteo.com/', 'Gridded numerical weather models, not station measurements'), ...hsSources, src('risk-model', 'Before the Smoke risk index v0.1', 'model', undefined, 'Rule-based prototype, unvalidated. A relative index, not a probability')]
  return { data: { days, cellLat, cellLon, cells: out }, sources }
}

export async function riskGrid(mode: Mode): Promise<Envelope<RiskGrid>> {
  return cached(`risk-grid:${mode}`, () => compute(mode), 10 * 60 * 1000)
}
