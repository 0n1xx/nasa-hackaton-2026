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
