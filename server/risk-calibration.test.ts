// The risk score against Canada's official Fire Weather Index, on real data from 15 November 2026:
// Open-Meteo weather at 80 communities (every 8th in the list, all provinces) and the CWFIS fire weather
// stations from the same morning.
//
// The official index is also one of the score's inputs, so agreement is measured on the WEATHER-ONLY score
// (no station lookup). Before drying power was added, 47 of the 71 places the official index rated low came
// out Medium on the weather alone, and 389 of 640 communities read Medium on the live map.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { FwiLookup, type FwiStation } from '../shared/fwi.ts'
import { LEVEL_STEP } from '../shared/risk.ts'
import type { DayWeather } from '../shared/types.ts'
import { scorePoint } from './services.ts'

const fx = JSON.parse(readFileSync(new URL('./fixtures/weather-2026-11-15.json', import.meta.url), 'utf8')) as { places: { id: string; name: string; lat: number; lon: number; days: DayWeather[] }[] }
const stations = (JSON.parse(readFileSync(new URL('./fixtures/fwi-stations-2026-11-15.json', import.meta.url), 'utf8')) as { stations: FwiStation[] }).stations
const look = new FwiLookup(stations)
const noCurrent = { time: '', temp: null, rh: null, wind: null, windDir: null, precip: null }

const rows = fx.places.map((p) => {
  const wx = { current: noCurrent, days: p.days }
  const weatherOnly = scorePoint(wx, [], p, 'live', 3)
  const withIndex = scorePoint(wx, [], p, 'live', 3, look)
  // No station in range, or every station near has stopped for the season: the official danger is low.
  const official = withIndex.official?.level ?? 'Low'
  return { id: p.id, weatherOnly: weatherOnly.today.level, withIndex: withIndex.today.level, official }
})

test('calibration (weather only): places the official index rates low come out Low, at least 90%', () => {
  const low = rows.filter((r) => r.official === 'Low')
  const agree = low.filter((r) => r.weatherOnly === 'Low').length
  assert.ok(low.length >= 60, `${low.length} official-low places`)
  assert.ok(agree / low.length >= 0.9, `${agree} of ${low.length} official-low places are Low`)
})

test('calibration (weather only): in mid-November most of the country reads Low', () => {
  const raised = rows.filter((r) => r.weatherOnly !== 'Low').length
  assert.ok(raised / rows.length <= 0.15, `${raised} of ${rows.length} above Low`)
})

// Not an agreement check (the index is an input here): it checks the input does its job where the
// weather alone misses dry prairie fuels that the official codes remember.
test('with the official index as an input, places it rates high or above are raised above Low', () => {
  const high = rows.filter((r) => LEVEL_STEP[r.official] >= 3)
  assert.ok(high.length >= 3)
  for (const r of high) assert.ok(LEVEL_STEP[r.withIndex] >= 2, `${r.id}: ${r.withIndex}, official ${r.official}`)
})
