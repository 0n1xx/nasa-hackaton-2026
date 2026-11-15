import test from 'node:test'
import assert from 'node:assert/strict'
import type { RiskDay } from './types.ts'
import { levelFor } from './risk.ts'
import { riskOutlook } from './outlook.ts'

/** Timeline from scores: `past` historical days, then today, then forecast days. Dates 2026-07-01 onward. */
function tl(past: number[], today: number, ahead: number[]): RiskDay[] {
  const all = [...past.map((s) => ['historical', s] as const), ['today', today] as const, ...ahead.map((s) => ['forecast', s] as const)]
  return all.map(([kind, score], i) => ({ date: `2026-07-${String(i + 1).padStart(2, '0')}`, kind, score, level: levelFor(score) }))
}

test('rise later in the look-ahead: act by the day before the first higher level', () => {
  // today 07-05 Moderate (40); 07-06 Moderate; 07-07 High; 07-08 Critical
  const o = riskOutlook(tl([30, 32, 35, 38], 40, [45, 60, 80]))!
  assert.equal(o.todayDate, '2026-07-05')
  assert.equal(o.todayLevel, 'Moderate')
  assert.equal(o.firstHigherLevelDate, '2026-07-07')
  assert.equal(o.actByDate, '2026-07-06')
  assert.deepEqual([o.peakLevel, o.peakScore, o.peakDate], ['Critical', 80, '2026-07-08'])
})

test('higher level tomorrow: act by today', () => {
  const o = riskOutlook(tl([30], 48, [55, 52]))!
  assert.equal(o.firstHigherLevelDate, '2026-07-03')
  assert.equal(o.actByDate, '2026-07-02')
  assert.equal(o.actByDate, o.todayDate)
})

test('no rise in level (a higher score at the same level does not count)', () => {
  const o = riskOutlook(tl([20], 52, [60, 74, 50]))!
  assert.equal(o.firstHigherLevelDate, null)
  assert.equal(o.actByDate, null)
  assert.deepEqual([o.peakLevel, o.peakScore, o.peakDate], ['High', 74, '2026-07-04'])
})

test('falling risk: the peak is today', () => {
  const o = riskOutlook(tl([60], 70, [55, 40]))!
  assert.equal(o.firstHigherLevelDate, null)
  assert.deepEqual([o.peakLevel, o.peakScore, o.peakDate], ['High', 70, '2026-07-02'])
})

test('today already Critical: nothing higher, act-by is null', () => {
  const o = riskOutlook(tl([70], 82, [90, 85]))!
  assert.equal(o.todayLevel, 'Critical')
  assert.equal(o.firstHigherLevelDate, null)
  assert.equal(o.actByDate, null)
  assert.equal(o.peakScore, 90)
})

test('past days are ignored for the peak and the rise', () => {
  const o = riskOutlook(tl([95, 90], 30, [32]))!
  assert.deepEqual([o.peakScore, o.peakDate], [32, '2026-07-04'])
  assert.equal(o.firstHigherLevelDate, null)
})

test('a tie for the peak goes to the earliest day', () => {
  const o = riskOutlook(tl([], 40, [66, 66, 50]))!
  assert.equal(o.peakDate, '2026-07-02')
})

test('no today entry: falls back to the last past day; all-forecast has no today', () => {
  const noToday: RiskDay[] = tl([30, 35], 0, [60]).filter((d) => d.kind !== 'today')
  const o = riskOutlook(noToday)!
  assert.equal(o.todayDate, '2026-07-02')
  assert.equal(o.firstHigherLevelDate, '2026-07-04')
  assert.equal(o.actByDate, '2026-07-02')
  const fc = riskOutlook(tl([], 0, [30, 60]).filter((d) => d.kind === 'forecast'))!
  assert.equal(fc.todayDate, null)
  assert.equal(fc.actByDate, null)
  assert.deepEqual([fc.peakScore, fc.peakDate], [60, '2026-07-03'])
})

test('empty timeline gives null', () => {
  assert.equal(riskOutlook([]), null)
})
