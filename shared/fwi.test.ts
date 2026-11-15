import test from 'node:test'
import assert from 'node:assert/strict'
import { FWI_MAX_KM, FwiLookup, fwiLevel, type FwiStation } from './fwi.ts'

const st = (name: string, lat: number, lon: number, date: string, fwi: number | null): FwiStation => ({ name, lat, lon, date, fwi, ffmc: null, dmc: null, dc: null, isi: null, bui: null })

test('fwi: CWFIS map bands become our four levels', () => {
  assert.deepEqual([0, 4.9, 5, 9.9, 10, 19.9, 20, 37].map(fwiLevel), ['Low', 'Low', 'Moderate', 'Moderate', 'High', 'High', 'Critical', 'Critical'])
})

test('fwi: nearest station still reporting; stations stopped for the season are skipped', () => {
  // Chiniki (Alberta foothills): Bow Valley has stopped for the season, Sundre is still reporting.
  const look = new FwiLookup([st('BOW VALLEY', 51.08, -115.07, '2026-11-15', null), st('SUNDRE', 51.77, -114.68, '2026-11-15', 24.9), st('SUNDRE', 51.77, -114.68, '2026-11-16', 18)])
  const n = look.nearest(51.15, -114.85, '2026-11-15')!
  assert.equal(n.station, 'SUNDRE'); assert.equal(n.fwi, 24.9); assert.equal(n.level, 'Critical')
  assert.ok(n.km > 50 && n.km < 80)
  assert.deepEqual([...look.byDay(51.15, -114.85)], [['2026-11-15', 24.9], ['2026-11-16', 18]])
})

test('fwi: nothing within range gives null; a day the stations do not cover gives null', () => {
  const look = new FwiLookup([st('FAR', 60, -100, '2026-11-15', 3)])
  assert.ok(FWI_MAX_KM < 1000)
  assert.equal(look.nearest(50, -89, '2026-11-15'), null)
  assert.equal(look.nearest(60, -100, '2026-11-20'), null)
})

test('fwi: resting when every nearby station has stopped for the season', () => {
  const look = new FwiLookup([st('A', 68.2, -135, '2026-11-15', null), st('B', 68.4, -133.7, '2026-11-15', null), st('C', 49.6, -112.8, '2026-11-15', 22)])
  assert.equal(look.resting(68.3, -134.5, '2026-11-15'), true)
  assert.equal(look.resting(49.6, -112.8, '2026-11-15'), false)
  assert.equal(look.resting(30, -90, '2026-11-15'), false) // no stations near: unknown, not resting
})
