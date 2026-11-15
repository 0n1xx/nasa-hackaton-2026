// Gridded risk index for the map: one score per cell per day (past → today → forecast).
// Each cell is scored at its centre by services.ts scorePoint, the same function as regions and /api/place.
import type { Envelope, Mode, RiskGrid } from '../shared/types.ts'
import { DEFAULT_HORIZON } from '../shared/horizon.ts'
import { nearestRegion } from './data/regions.ts'
import { pointsRisk } from './services.ts'
import { cached } from './util.ts'

/** Cells further than this from every region centre are left off the map. */
const RADIUS_KM = 450

function buildCells(dLat: number, dLon: number) {
  const cells: { lat: number; lon: number }[] = []
  for (let lat = 49; lat <= 61 + 1e-9; lat += dLat) {
    for (let lon = -125; lon <= -70 + 1e-9; lon += dLon) {
      if (nearestRegion(lat, lon, RADIUS_KM)) cells.push({ lat: +lat.toFixed(3), lon: +lon.toFixed(3) })
    }
  }
  return cells
}

async function compute(mode: Mode, horizon: number): Promise<Envelope<RiskGrid>> {
  const [cellLat, cellLon] = mode === 'sim' ? [1.0, 1.5] : [2.0, 3.0]
  const cells = buildCells(cellLat, cellLon)
  // One weather fetch (chunked by 40 in live mode) and one hotspot fetch for all cells.
  const { points, sources } = await pointsRisk(mode, cells, horizon)

  const days: RiskGrid['days'] = points[0]?.timeline.map((t) => ({ date: t.date, kind: t.kind })) ?? []
  const out = points.map((p) => {
    const byDate = new Map(p.timeline.map((t) => [t.date, t.score]))
    const scores = days.map((d, di) => byDate.get(d.date) ?? p.timeline[Math.min(di, p.timeline.length - 1)]?.score ?? 0)
    return { lat: p.lat, lon: p.lon, scores }
  })
  return { data: { days, cellLat, cellLon, cells: out, horizon }, sources }
}

export async function riskGrid(mode: Mode, days = DEFAULT_HORIZON): Promise<Envelope<RiskGrid>> {
  return cached(`risk-grid:${mode}:${days}`, () => compute(mode, days), 10 * 60 * 1000)
}
