import test from 'node:test'
import assert from 'node:assert/strict'
import { simAirSeries, simWeather } from './sim.ts'

const pt = { lat: 48.38, lon: -89.25 }

test('simWeather: 7 past days + today + horizon, and the default 11 days never change', () => {
  const [d3] = simWeather([pt], 3), [d7] = simWeather([pt], 7), [d14] = simWeather([pt], 14), [d1] = simWeather([pt], 1)
  assert.equal(d3.days.length, 11)
  assert.equal(d7.days.length, 15)
  assert.equal(d14.days.length, 22)
  assert.equal(d1.days.length, 9)
  assert.deepEqual(d7.days.slice(0, 11), d3.days)
  assert.deepEqual(d14.days.slice(0, 15), d7.days)
  assert.deepEqual(d1.days, d3.days.slice(0, 9))
  assert.equal(d7.days.filter((d) => d.kind === 'forecast').length, 7)
})

test('simAirSeries: forecast hours stop at the air horizon cap (6 days)', () => {
  const fc = (days: number) => simAirSeries(pt, 1, days).hourly.filter((h) => h.kind === 'forecast').length
  assert.equal(fc(3), 72)
  assert.equal(fc(6), 144)
  assert.equal(fc(14), 144)
})
