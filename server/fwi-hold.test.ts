// The official index covers 3 days; the score must not jump on day +3 because the index runs out.
import test from 'node:test'
import assert from 'node:assert/strict'
import { FwiLookup } from '../shared/fwi.ts'
import { computeRisk } from '../shared/risk.ts'
import { fwiOn, riskDays, scorePoint } from './services.ts'
import { simWeather } from './sim.ts'

test('fwi: held after the last covered day, none before the first', () => {
  const m = new Map([['2026-07-14', 4], ['2026-07-15', 6], ['2026-07-16', 9]])
  assert.equal(fwiOn(m, '2026-07-15'), 6)
  assert.equal(fwiOn(m, '2026-07-20'), 9)
  assert.equal(fwiOn(m, '2026-07-13'), null)
  assert.equal(fwiOn(undefined, '2026-07-15'), null)
})

test('fwi: on example weather with a three-day station feed, day +3 is scored with the held reading', () => {
  const pt = { lat: 50.3, lon: -89.04 }
  const wx = simWeather([pt], 7)[0]
  const st = (date: string, fwi: number) => ({ name: 'ARMSTRONG', lat: 50.28, lon: -88.92, date, fwi, ffmc: null, dmc: null, dc: null, isi: null, bui: null })
  const look = new FwiLookup([st('2026-07-14', 5), st('2026-07-15', 5), st('2026-07-16', 5)])
  const r = scorePoint(wx, [], pt, 'live', 7, look)
  const { out } = riskDays(wx, 0, r.historyIndex, 'live', 7, look.byDay(pt.lat, pt.lon))
  const d3 = out.find((o) => o.day.date === '2026-07-17')!
  assert.equal(d3.inputs.fwi, 5)
  assert.equal(r.timeline.find((t) => t.date === '2026-07-17')!.score, computeRisk(d3.inputs).score)
  // Past days are scored without it.
  assert.equal(out.find((o) => o.day.date === '2026-07-12')!.inputs.fwi, null)
})
