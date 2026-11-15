import test from 'node:test'
import assert from 'node:assert/strict'
import { computeRisk, levelFor } from './risk.ts'
import { aqiFromPm25 } from './aqi.ts'

const base = { tMax: 20, rhMin: 45, windMax: 15, precip7d: 10, soil: 0.25, vpdMax: 1, hotspots100km: 0, historyIndex: 0.5, snow: 0, quality: 'observed' as const }

test('hot, dry, windy with fires nearby is Critical', () => {
  const r = computeRisk({ ...base, tMax: 33, rhMin: 15, windMax: 45, precip7d: 0, soil: 0.08, vpdMax: 3, hotspots100km: 80, historyIndex: 1 })
  assert.equal(r.score, 100); assert.equal(r.level, 'Critical')
})
test('cool and wet is Low', () => {
  const r = computeRisk({ ...base, tMax: 6, rhMin: 85, windMax: 5, precip7d: 40, soil: 0.4, vpdMax: 0.1, historyIndex: 0 })
  assert.ok(r.score < 10); assert.equal(r.level, 'Low')
})
test('snow cover gates the score down', () => {
  const dry = { ...base, rhMin: 20, precip7d: 0 }
  assert.ok(computeRisk({ ...dry, snow: 0.3 }).score < computeRisk(dry).score * 0.3)
})
test('contributions add up to the score; missing inputs renormalise and lower confidence', () => {
  const r = computeRisk({ ...base, soil: null, vpdMax: null })
  assert.ok(Math.abs(r.factors.reduce((a, f) => a + f.contribution, 0) - r.score) <= 1)
  assert.equal(r.confidence, 'Medium')
})
test('level thresholds', () => { assert.deepEqual([0, 25, 50, 75].map(levelFor), ['Low', 'Moderate', 'High', 'Critical']) })
test('US AQI from PM2.5 (2024 breakpoints)', () => {
  assert.equal(aqiFromPm25(9), 50); assert.equal(aqiFromPm25(35.4), 100); assert.equal(aqiFromPm25(55.5), 151); assert.equal(aqiFromPm25(null), null)
})

// Real conditions from 15 November 2026 (server/fixtures): cold, damp air with wind and little rain.
test('a cold, damp, windy November day with no rain is Low', () => {
  const r = computeRisk({ tMax: 2, rhMin: 62, windMax: 32, precip7d: 4, soil: 0.3, vpdMax: 0.2, hotspots100km: 0, historyIndex: 0.55, snow: 0, quality: 'observed' })
  assert.equal(r.level, 'Low')
  assert.equal(r.drying, 0)
  // Wind and the dry spell are listed but add nothing: the air cannot dry fuels.
  assert.equal(r.factors.find((f) => f.key === 'windMax')!.contribution, 0)
  assert.equal(r.factors.find((f) => f.key === 'precip7d')!.contribution, 0)
})
test('drying power: wind and a dry spell count in full once the air dries fuels fast', () => {
  const r = computeRisk({ ...base, vpdMax: 1.2 })
  assert.equal(r.drying, 1)
  const half = computeRisk({ ...base, vpdMax: 0.6 })
  assert.equal(half.drying, 0.5)
  assert.ok(half.score < r.score)
})
test('drying power falls back to temperature and humidity when vapour pressure deficit is missing', () => {
  const r = computeRisk({ ...base, vpdMax: null, tMax: 30, rhMin: 20 })
  assert.equal(r.drying, 1)
})
test('official Fire Weather Index: counts when present, and its absence is not a missing input', () => {
  const without = computeRisk(base)
  const low = computeRisk({ ...base, fwi: 0.4 }), high = computeRisk({ ...base, fwi: 30 })
  assert.ok(low.score < without.score && without.score < high.score)
  assert.equal(without.confidence, 'High')
  assert.equal(without.factors.find((f) => f.key === 'fwi')!.contribution, 0)
})
