// Home list and map levels, in simulated mode (no network).
import test from 'node:test'
import assert from 'node:assert/strict'
import { placeCore } from './place.ts'
import { mapCommunities, placeLevels, rankedPlaces } from './ranked.ts'

test('ranked: today and peak scores equal /api/place for the same community', async () => {
  const { data } = await rankedPlaces('sim', 3, 6)
  assert.equal(data.length, 6)
  for (const r of data.slice(0, 3)) {
    const { data: p } = await placeCore('sim', r.id, 3)
    assert.equal(r.todayScore, p.risk.today.score, r.id)
    assert.equal(r.todayDate, p.risk.todayDate, r.id)
    assert.equal(r.peakScore, p.outlook.peakScore, r.id)
    assert.equal(r.peakDate, p.outlook.peakDate, r.id)
  }
})

test('ranked: sorted by peak, then today; peakLevelFrom is the first day at the peak level', async () => {
  const { data } = await rankedPlaces('sim', 7, 20)
  for (let i = 1; i < data.length; i++) {
    const a = data[i - 1], b = data[i]
    assert.ok(a.peakScore > b.peakScore || (a.peakScore === b.peakScore && a.todayScore >= b.todayScore), `${a.id} before ${b.id}`)
  }
  for (const r of data) {
    assert.ok(r.peakLevelFrom >= r.todayDate && r.peakLevelFrom <= r.peakDate)
    if (r.peakLevel === r.todayLevel) assert.equal(r.peakLevelFrom, r.todayDate)
  }
})

test('levels: every map community, scores aligned to days, today matches /api/place', async () => {
  const { data } = await placeLevels('sim', 3)
  assert.equal(data.places.length, mapCommunities().length)
  assert.equal(data.days.length, 4 + 1 + 3)
  const ti = data.days.findIndex((d) => d.kind === 'today')
  assert.equal(ti, 4)
  for (const pl of data.places) assert.equal(pl.scores.length, data.days.length)
  const one = data.places.find((p) => p.id === 'whitesand')!
  const { data: p } = await placeCore('sim', 'whitesand', 3)
  assert.equal(one.scores[ti], p.risk.today.score)
  assert.deepEqual(one.scores, p.risk.timeline.map((t) => t.score))
})
