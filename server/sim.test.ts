import test from 'node:test'
import assert from 'node:assert/strict'
import { SIM_NOW_MS, simActiveFires, simAirSeries, simHotspots, simLocalDay, simWeather } from './sim.ts'

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

test('the scenario is pinned to Tuesday 14 July 2026, 3 p.m. Central, whatever the real clock or server zone', () => {
  assert.equal(new Date(SIM_NOW_MS).toISOString(), '2026-07-14T20:00:00.000Z')
  assert.equal(simLocalDay(SIM_NOW_MS), '2026-07-14')
  const [w] = simWeather([pt], 14)
  assert.equal(w.days[0].date, '2026-07-07')
  assert.equal(w.days[7].date, '2026-07-14')
  assert.equal(w.days[8].date, '2026-07-15')
  assert.equal(w.days.at(-1)!.date, '2026-07-28')
  assert.equal(w.current.time, '2026-07-14T15:00')
  assert.ok(simActiveFires().every((f) => f.startDate === '2026-07-08'))
  for (const h of simHotspots(1)) assert.ok(Date.parse(h.time!) <= SIM_NOW_MS && Date.parse(h.time!) >= SIM_NOW_MS - 86400000)
  const air = simAirSeries(pt, 2, 4)
  assert.equal(air.now.time, '2026-07-14T15:00')
  assert.equal(air.hourly[0].time, '2026-07-12T15:00')
  assert.equal(air.hourly.find((h) => h.kind === 'forecast')!.time, '2026-07-14T16:00')
})
