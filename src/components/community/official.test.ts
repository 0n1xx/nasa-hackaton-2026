import test from 'node:test'
import assert from 'node:assert/strict'
import type { PlaceReport } from '../../../shared/types.ts'
import type { OfficialFwi } from '../../../shared/fwi.ts'
import { officialLine, stationName } from './official.ts'

const place = (official: OfficialFwi | null, fwiResting = false) => ({ risk: { official, fwiResting } }) as unknown as PlaceReport
const o = (station: string, fwi: number, level: OfficialFwi['level'], km = 9): OfficialFwi => ({ station, km, date: '2026-11-15', fwi, level, ffmc: null, dmc: null, dc: null, isi: null, bui: null })

test('official: station names read as names', () => {
  assert.equal(stationName('ARMSTRONG'), 'Armstrong')
  assert.equal(stationName('MONTREAL (DORVAL)'), 'Montreal (Dorval)')
  assert.equal(stationName('CHWK NURSERY'), 'Chwk Nursery')
  assert.equal(stationName('TOM BROWNE LK'), 'Tom Browne Lk')
  assert.equal(stationName('STE-CATHARINES'), 'Ste-Catharines')
})

test('official: one plain sentence, with the band in words', () => {
  assert.equal(officialLine(place(o('ARMSTRONG', 0.463, 'Low'))), 'Canada’s fire weather station at Armstrong, 9 km away, rates today low (Fire Weather Index 0.5).')
  assert.equal(officialLine(place(o('LETHBRIDGE', 22.1, 'Critical', 40))), 'Canada’s fire weather station at Lethbridge, 40 km away, rates today very high or extreme (Fire Weather Index 22).')
})

test('official: stations stopped for the season, and no station at all', () => {
  assert.equal(officialLine(place(null, true)), 'Canada’s fire weather stations near you have stopped for the season.')
  assert.equal(officialLine(place(null, false)), null)
})
