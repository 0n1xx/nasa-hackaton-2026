import test from 'node:test'
import assert from 'node:assert/strict'
import type { DayWeather, RegionRisk, RiskDay } from './types.ts'
import { daysBuilding, warningSigns } from './signals.ts'

const day = (date: string, o: Partial<DayWeather> = {}, kind: DayWeather['kind'] = 'historical'): DayWeather =>
  ({ date, kind, tMax: 20, rhMin: 60, windMax: 15, windDir: 200, precip: 0, vpdMax: 1, soil: 0.25, snow: 0, ...o })

function region(days: DayWeather[], timeline: RiskDay[], hotspots = 0): RegionRisk {
  return { days, timeline, hotspots100km: hotspots, today: { score: timeline.find((t) => t.kind === 'today')?.score ?? 40 } } as unknown as RegionRisk
}

test('a week of building heat and drying trips the slow signs', () => {
  const days = [
    day('2026-07-08', { tMax: 19, rhMin: 62, precip: 12 }), day('2026-07-09', { tMax: 21, rhMin: 55, precip: 0 }),
    day('2026-07-10', { tMax: 24.5, rhMin: 48 }), day('2026-07-11', { tMax: 26, rhMin: 40 }), day('2026-07-12', { tMax: 27, rhMin: 34 }),
    day('2026-07-13', { tMax: 29, rhMin: 30 }), day('2026-07-14', { tMax: 30, rhMin: 28, windMax: 25 }),
    day('2026-07-15', { tMax: 31, windMax: 38 }, 'forecast'),
  ]
  const timeline: RiskDay[] = [{ date: '2026-07-14', kind: 'today', score: 66, level: 'High' }, { date: '2026-07-15', kind: 'forecast', score: 80, level: 'Critical' }]
  const s = warningSigns(region(days, timeline, 4))
  const on = (k: string) => s.find((x) => x.key === k)?.active
  assert.equal(on('heat'), true)
  assert.equal(on('humidity'), true)
  assert.equal(on('dry'), true)
  assert.equal(on('wind'), true)
  assert.equal(on('fire'), true)
  assert.equal(on('outlook'), true)
  assert.equal(s.find((x) => x.key === 'dry')?.since, '2026-07-09')
  assert.equal(daysBuilding(s, '2026-07-14'), 6)
})

test('a cold dry spell alone is not "building"', () => {
  const days = Array.from({ length: 8 }, (_, i) => day(`2026-11-0${i + 1}`, { tMax: i === 7 ? 3 : 6, rhMin: 72, precip: 0 }))
  const timeline: RiskDay[] = [{ date: '2026-11-08', kind: 'today', score: 38, level: 'Moderate' }, { date: '2026-11-09', kind: 'forecast', score: 36, level: 'Moderate' }]
  const s = warningSigns(region(days, timeline))
  assert.equal(s.find((x) => x.key === 'dry')?.active, true)
  assert.equal(daysBuilding(s, '2026-11-08'), 0)
})

test('cool, damp, calm weather trips nothing', () => {
  const days = Array.from({ length: 8 }, (_, i) => day(`2026-09-0${i + 1}`, { tMax: 12, rhMin: 70, precip: i % 2 ? 5 : 0 }))
  const timeline: RiskDay[] = [{ date: '2026-09-08', kind: 'today', score: 12, level: 'Low' }, { date: '2026-09-09', kind: 'forecast', score: 14, level: 'Low' }]
  const s = warningSigns(region(days, timeline))
  assert.equal(s.filter((x) => x.active).length, 0)
  assert.equal(daysBuilding(s, '2026-09-08'), 0)
})
