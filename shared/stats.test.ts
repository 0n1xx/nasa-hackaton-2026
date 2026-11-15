import test from 'node:test'
import assert from 'node:assert/strict'
import { linearTrend, mannKendall, predictBand, tCritical, tTwoSidedP, zScore } from './stats.ts'

test('t distribution: t = 2.447, df = 6 gives two-sided p ≈ 0.05', () => {
  assert.ok(Math.abs(tTwoSidedP(2.447, 6) - 0.05) < 0.005)
  assert.ok(Math.abs(tCritical(6) - 2.447) < 0.01)
  assert.ok(Math.abs(tCritical(30) - 2.042) < 0.01)
  assert.equal(tTwoSidedP(0, 5), 1)
})

test('clearly rising series: significant slope and Mann–Kendall says rising', () => {
  const y = [54, 55, 60, 62, 67, 81, 80, 82]
  const lt = linearTrend(y)
  assert.ok(lt.slope > 3)
  assert.ok(lt.pValue < 0.05)
  assert.ok(lt.r2 > 0.8)
  const mk = mannKendall(y)
  assert.ok(mk.pValue < 0.05)
  assert.equal(mk.trend, 'rising')
  assert.ok(mk.S > 0 && mk.tau > 0)
})

test('flat noisy series: no significant trend', () => {
  const y = [50, 53, 48, 52, 49, 51, 50, 52]
  assert.ok(linearTrend(y).pValue > 0.05)
  const mk = mannKendall(y)
  assert.ok(mk.pValue > 0.05)
  assert.equal(mk.trend, 'none')
})

test('falling series is detected as falling', () => {
  assert.equal(mannKendall([9, 8, 7, 6, 5, 4, 3, 2]).trend, 'falling')
})

test('predictBand: fit on the line, band widens away from the centre', () => {
  const lt = linearTrend([1, 3, 2, 4, 5])
  const mid = predictBand(lt, 2)
  const far = predictBand(lt, 7)
  assert.ok(Math.abs(mid.fit - (lt.intercept + lt.slope * 2)) < 1e-9)
  assert.ok(mid.lo < mid.fit && mid.fit < mid.hi)
  assert.ok(far.hi - far.lo > mid.hi - mid.lo)
})

test('zScore', () => {
  assert.equal(zScore(12, 10, 2), 1)
  assert.equal(zScore(5, 5, 0), 0)
})

import { percentileRank, quantiles, senSlope } from './stats.ts'

test('senSlope: exact line, robust to one outlier, handles NaN', () => {
  assert.equal(senSlope([1, 3, 5, 7, 9]), 2)
  assert.equal(senSlope([1, 3, 5, 100, 9, 11]), 2)
  assert.equal(senSlope([0, NaN, 2, 3]), 1)
  assert.equal(senSlope([4]), 0)
})

test('quantiles: type-7 interpolation', () => {
  assert.deepEqual(quantiles([3, 1, 2, 4, 5], [0, 0.25, 0.5, 1]), [1, 2, 3, 5])
  assert.deepEqual(quantiles([1, 2], [0.5]), [1.5])
  assert.ok(Number.isNaN(quantiles([], [0.5])[0]))
})

test('percentileRank: inverse of a percentile table, clamps, ties', () => {
  const q = quantiles(Array.from({ length: 1000 }, (_, i) => i), Array.from({ length: 101 }, (_, i) => i / 100))
  assert.ok(Math.abs(percentileRank(q[96], q) - 96) < 1e-9)
  assert.ok(Math.abs(percentileRank((q[40] + q[41]) / 2, q) - 40.5) < 1e-9)
  assert.equal(percentileRank(-5, q), 0)
  assert.equal(percentileRank(5000, q), 100)
  assert.equal(percentileRank(2, [1, 2, 2, 3]), 50)
})
