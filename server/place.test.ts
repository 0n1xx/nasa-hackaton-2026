// /api/place core logic and community search, in simulated mode (no network: the 42-year history is not exercised here).
import test from 'node:test'
import assert from 'node:assert/strict'
import { riskOutlook } from '../shared/outlook.ts'
import { placeCore, powerCell } from './place.ts'
import { pointRisk, pointsRisk, regionRisk, scorePoint } from './services.ts'
import { simHotspots, simWeather } from './sim.ts'
import { allCommunities, communityById, normalizeName, searchCommunities } from './directory.ts'
import { regionById } from './data/regions.ts'

const WHITESAND = communityById('whitesand')!

test('place: timeline is 4 past days + today + days ahead, for every horizon', async () => {
  for (const days of [1, 3, 7, 14]) {
    const { data } = await placeCore('sim', 'whitesand', days)
    assert.equal(data.risk.timeline.length, 4 + 1 + days, `days=${days}`)
    assert.equal(data.risk.timeline.filter((t) => t.kind === 'today').length, 1)
    assert.equal(data.risk.timeline.filter((t) => t.kind === 'forecast').length, days)
    assert.equal(data.risk.timeline[4].date, data.risk.todayDate)
    assert.equal(data.horizon, days)
    for (const t of data.risk.timeline) assert.ok(t.confidence && typeof t.uncertainty === 'number')
  }
})

test('place: the same point via pointRisk, a batch, or the grid scorer gives the same today score', async () => {
  const { data } = await placeCore('sim', 'whitesand', 3)
  const pt = { lat: WHITESAND.lat, lon: WHITESAND.lon }
  const single = await pointRisk('sim', pt, 3)
  assert.equal(single.today.score, data.risk.today.score)
  assert.deepEqual(single.timeline, data.risk.timeline)
  // The map grid scores its cells through pointsRisk in batches: position in the batch must not matter.
  const batch = await pointsRisk('sim', [{ lat: 49, lon: -95 }, pt, { lat: 55, lon: -100 }], 3)
  assert.equal(batch.points[1].today.score, data.risk.today.score)
  // And the pure scorer on the raw inputs.
  assert.equal(scorePoint(simWeather([pt], 3)[0], simHotspots(1), pt, 'sim', 3).today.score, data.risk.today.score)
})

test('region panel: the region score is pointRisk at the region point', async () => {
  const tb = regionById('thunder-bay')!
  const [{ data }, p] = await Promise.all([regionRisk('sim', 'thunder-bay', 3), pointRisk('sim', tb, 3)])
  assert.equal(data.today.score, p.today.score)
  assert.equal(p.historyIndex, tb.historyIndex)
})

test('place: outlook, signs, fires and air are filled from the same point', async () => {
  const { data, sources } = await placeCore('sim', 'whitesand', 7)
  assert.deepEqual(data.outlook, riskOutlook(data.risk.timeline))
  assert.ok(data.signs.some((s) => s.key === 'smoke'), 'smoke sign needs 48 h of air history')
  assert.ok(data.fires && data.fires.nearest.length <= 5 && data.fires.nearest.length > 0)
  const d = data.fires!.nearest.map((f) => f.distanceKm)
  assert.deepEqual(d, [...d].sort((a, b) => a - b))
  assert.ok(data.fires!.within50km <= data.fires!.within100km)
  assert.ok(data.hotspots24h && data.hotspots24h.within50km <= data.hotspots24h.within100km)
  assert.equal(data.hotspots24h!.within100km, data.risk.hotspots100km)
  assert.ok(data.air && data.air.max3d.days === 3 && data.air.max3d.pm25 != null)
  // Smoke maximum: the 3 whole local days after today, whatever the hour (sim air times are UTC).
  const next = (iso: string, n: number) => { const t = new Date(`${iso}T12:00:00`); t.setDate(t.getDate() + n); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}` }
  assert.deepEqual(data.air!.max3d.daily.map((x) => x.date), [1, 2, 3].map((n) => next(data.risk.todayDate, n)))
  assert.equal(data.air!.max3d.pm25, Math.max(...data.air!.max3d.daily.map((x) => x.pm25)))
  assert.equal(data.region?.id, 'thunder-bay')
  assert.ok(sources.some((s) => s.id === 'communities'))
  assert.equal(new Set(sources.map((s) => s.id)).size, sources.length, 'sources are de-duplicated')
})

test('place: unknown community is NotFound', async () => {
  await assert.rejects(placeCore('sim', 'no-such-place', 3), (e: Error) => e.constructor.name === 'NotFound')
})

test('powerCell snaps to the 0.5° × 0.625° POWER grid', () => {
  assert.deepEqual(powerCell(50.3, -89.04), { lat: 50.5, lon: -88.75 })
  assert.deepEqual(powerCell(49.4, -89.4), { lat: 49.5, lon: -89.375 })
})

test('search: alternate names in parentheses and word prefixes', () => {
  const ids = (q: string) => searchCommunities(q).data.map((m) => m.id)
  assert.equal(ids('Collins')[0], 'collins')
  assert.equal(ids('coll')[0], 'collins')
  assert.equal(ids('white')[0], 'whitesand')
  assert.equal(ids('WHITESAND FIRST NATION')[0], 'whitesand')
  assert.equal(ids('gull bay')[0], 'gull-bay')
  assert.equal(ids('kat')[0], 'katlodeeche')
  assert.equal(ids('Kátł’odeeche')[0], 'katlodeeche')
  assert.equal(normalizeName("K'atl’odeeche  ʼFirst  Nation"), 'katlodeeche first nation')
  assert.deepEqual(ids(''), [])
  assert.ok(ids('a').length <= 10)
})

test('directory: manual list wins; ISC duplicates are dropped but searchable by their ISC name', () => {
  const all = allCommunities()
  assert.equal(new Set(all.map((c) => c.id)).size, all.length, 'ids are unique')
  if (!all.some((c) => c.source === 'isc')) return // ISC file not present: manual list only
  assert.equal(communityById('isc-190'), undefined, 'ISC "Whitesand" merges into the manual entry')
  assert.equal(communityById('isc-188'), undefined, 'ISC "Gull Bay" merges into the manual entry')
  assert.equal(communityById('whitesand')?.bandNumber, 190)
  assert.equal(searchCommunities('cross lake').data[0]?.id, 'pimicikamak')
  // Every search result opens as a place.
  for (const q of ['white', 'lake', 'cree', 'first', 'nation']) for (const m of searchCommunities(q).data) assert.ok(communityById(m.id), m.id)
  // ISC region: nearest region centre within 600 km, else null.
  const far = all.find((c) => c.source === 'isc' && c.province === 'PE')
  if (far) assert.equal(far.regionId, null)
})
