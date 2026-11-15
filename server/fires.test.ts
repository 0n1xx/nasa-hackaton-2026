// Which agency fire reports count as "a fire now". Rows below are shaped like real CWFIS records from 15 November 2026.
import test from 'node:test'
import assert from 'node:assert/strict'
import type { ActiveFire, Hotspot } from '../shared/types.ts'
import { NO_HEAT_DAYS, STALE_DAYS, currentFires, lastTouched } from './fires.ts'

const NOW = Date.parse('2026-11-15T12:00:00Z')
const fire = (id: string, over: Partial<ActiveFire>): ActiveFire => ({ id, name: id, agency: 'BC', lat: 52, lon: -121, hectares: 100, startDate: '2026-07-17T00:00:00Z', stage: 'UC', statusDate: null, recordStart: null, ...over })

test('fires: last touched is the older of the status date and the record date', () => {
  // Parks Canada re-stamps record_start; the Northwest Territories re-stamp status_date every day.
  assert.equal(lastTouched(fire('pc', { statusDate: '2026-05-31T00:00:00Z', recordStart: '2026-11-09T00:00:00Z' })), '2026-05-31T00:00:00Z')
  assert.equal(lastTouched(fire('nt', { statusDate: '2026-11-14T00:00:00Z', recordStart: '2026-10-06T00:00:00Z' })), '2026-10-06T00:00:00Z')
  assert.equal(lastTouched(fire('one', { statusDate: '2026-11-02T00:00:00Z' })), '2026-11-02T00:00:00Z')
  assert.equal(lastTouched(fire('none', {})), null)
})

test('fires: reports untouched for more than two weeks are hidden, recent ones stay', () => {
  const list = [
    fire('qc-2023', { agency: 'QC', stage: 'OC', startDate: '2023-05-25T00:00:00Z', statusDate: '2023-05-25T00:00:00Z', recordStart: '2026-07-09T00:00:00Z' }),
    fire('qc-july', { agency: 'QC', stage: 'OC', statusDate: '2026-07-10T00:00:00Z', recordStart: '2026-08-10T00:00:00Z' }),
    fire('pc-may', { agency: 'PC', statusDate: '2026-05-31T00:00:00Z', recordStart: '2026-11-09T00:00:00Z' }),
    fire('nt-daily', { agency: 'NT', stage: 'OC', statusDate: '2026-11-14T11:00:00Z', recordStart: '2026-10-06T00:00:00Z' }),
    fire('bc-nov2', { statusDate: '2026-11-02T00:00:00Z', recordStart: '2026-11-09T00:00:00Z' }),
    fire('bc-new', { stage: 'OC', startDate: '2026-11-13T14:39:00Z', statusDate: '2026-11-14T11:03:00Z', recordStart: '2026-11-14T23:45:00Z' }),
  ]
  const { kept, hidden } = currentFires(list, [], NOW)
  assert.deepEqual(kept.map((f) => f.id), ['bc-nov2', 'bc-new'])
  assert.equal(hidden, 4)
  assert.equal(STALE_DAYS, 14)
})

test('fires: an old report stays when a satellite still sees heat at it', () => {
  const big = fire('on-big', { agency: 'ON', lat: 51, lon: -90, hectares: 300000, statusDate: '2026-09-17T00:00:00Z', recordStart: '2026-09-17T00:00:00Z' })
  const small = fire('qc-small', { agency: 'QC', lat: 50, lon: -75, hectares: 20, statusDate: '2026-07-01T00:00:00Z', recordStart: '2026-08-01T00:00:00Z' })
  const heat = (lat: number, lon: number): Hotspot => ({ lat, lon, frp: 12, time: '2026-11-15T06:00:00Z', sensor: 'VIIRS' })
  // 25 km from the big fire's point is inside its burned area; 25 km from a 20-hectare fire is a different fire.
  const { kept } = currentFires([big, small], [heat(51.22, -90), heat(50.22, -75)], NOW)
  assert.deepEqual(kept.map((f) => f.id), ['on-big'])
})

test('fires: fires reported out are never kept, and a report with no dates is kept', () => {
  const { kept } = currentFires([fire('ex', { stage: 'EX', statusDate: '2026-11-14T00:00:00Z' }), fire('undated', {})], [], NOW)
  assert.deepEqual(kept.map((f) => f.id), ['undated'])
})

test('fires: when the satellite feed is down, reports from the last 60 days stay', () => {
  const oct = fire('on-oct', { agency: 'ON', stage: 'OC', statusDate: '2026-10-01T00:00:00Z', recordStart: '2026-10-13T00:00:00Z' })
  const july = fire('qc-july', { agency: 'QC', stage: 'OC', statusDate: '2026-07-10T00:00:00Z', recordStart: '2026-08-10T00:00:00Z' })
  assert.equal(NO_HEAT_DAYS, 60)
  assert.deepEqual(currentFires([oct, july], null, NOW).kept.map((f) => f.id), ['on-oct'])
  assert.deepEqual(currentFires([oct, july], [], NOW).kept.map((f) => f.id), [])
})
