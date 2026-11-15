import test from 'node:test'
import assert from 'node:assert/strict'
import type { PlaceReport, RiskDay } from './types.ts'
import type { WarningSign } from './signals.ts'
import { levelFor } from './risk.ts'
import { contactsFor, letterRecipients } from './contacts.ts'
import { EXAMPLE_MARK, NEEDS, buildLetter, dayDate, ensureExampleMarks, mailtoHref } from './letter.ts'

const sign = (key: WarningSign['key'], active: boolean, value: string, detail: string): WarningSign =>
  ({ key, label: key, active, value, detail, rule: '', since: null })

/** A place like the Whitesand example: today 2026-11-15 (a Sunday), rising to High on Tuesday 17 November. */
function place(over: Partial<PlaceReport> = {}): PlaceReport {
  const scores: [string, RiskDay['kind'], number][] = [
    ['2026-11-13', 'historical', 30], ['2026-11-14', 'historical', 35], ['2026-11-15', 'today', 40],
    ['2026-11-16', 'forecast', 45], ['2026-11-17', 'forecast', 60], ['2026-11-18', 'forecast', 80],
  ]
  const timeline: RiskDay[] = scores.map(([date, kind, score]) => ({ date, kind, score, level: levelFor(score) }))
  const day = (date: string, kind: 'historical' | 'forecast', windMax: number) =>
    ({ date, kind, tMax: 25, rhMin: 30, windMax, windDir: 270, precip: 0, vpdMax: 2, soil: 0.2, snow: 0 })
  return {
    community: { id: 'whitesand', name: 'Whitesand First Nation', kind: 'First Nation', province: 'ON', regionId: 'thunder-bay', lat: 50.3, lon: -89.04, source: 'manual', bandNumber: 190, reported: [] },
    region: null,
    horizon: 3,
    risk: {
      todayDate: '2026-11-15',
      today: { score: 40, level: 'Moderate', uncertainty: 8, confidence: 'Medium', confidenceWhy: '', snowGate: false, factors: [] },
      timeline,
      hotspots100km: 12,
      historyIndex: 0.6,
      current: { time: '2026-11-15T12:00', temp: 20, rh: 30, wind: 20, windDir: 270, precip: 0 },
      days: [day('2026-11-14', 'historical', 20), day('2026-11-15', 'historical', 22), day('2026-11-16', 'forecast', 38), day('2026-11-17', 'forecast', 25)],
    },
    signs: [
      sign('heat', true, '+10.2 °C in 7 days', 'The daily high went from 20.3 °C to 30.5 °C.'),
      sign('humidity', true, '23% humidity', 'Lowest humidity fell from 56% to 23% over the week.'),
      sign('dry', true, '6 days dry', 'The last wetting rain was 6 days ago.'),
      sign('wind', true, '38 km/h', 'Wind peaks at 38 km/h on Monday.'),
      sign('fire', false, '0 detections', 'No satellite fire detections within 100 km in the last 24 hours.'),
      sign('outlook', true, 'Critical by Wednesday', 'The index is 40 today and forecast to reach 80 (Critical) on Wednesday.'),
    ],
    daysBuilding: 6,
    outlook: { todayDate: '2026-11-15', todayLevel: 'Moderate', peakLevel: 'Critical', peakScore: 80, peakDate: '2026-11-18', firstHigherLevelDate: '2026-11-17', actByDate: '2026-11-16' },
    fires: { nearest: [{ name: 'THU045', agency: 'ON', stage: 'BH', hectares: 16604, distanceKm: 13, bearing: 'SW' }], within50km: 6, within100km: 9 },
    hotspots24h: { within50km: 0, within100km: 0 },
    air: { now: { pm25: 310, pm10: 390, usAqi: 363, aod: 2, time: '2026-11-15T05:00' }, max3d: { pm25: 240, usAqi: 314, date: '2026-11-17', days: 3, daily: [] } },
    history: null,
    historyStatus: 'unavailable',
    ...over,
  }
}

const on = contactsFor('ON')
const defaults = NEEDS.filter((n) => n.defaultOn).map((n) => n.key)
const nonEmpty = (s: string) => s.split('\n').filter((l) => l.trim() !== '')

test('example mode marks the letter at the top and the bottom, and in the subject', () => {
  const { subject, body } = buildLetter({ place: place(), needs: defaults, contacts: on, mode: 'sim' })
  const lines = nonEmpty(body)
  assert.ok(lines[0].startsWith(EXAMPLE_MARK), lines[0])
  assert.ok(lines.at(-1)!.includes(EXAMPLE_MARK), lines.at(-1))
  assert.ok(subject.startsWith(EXAMPLE_MARK))
})

test('live mode has no example mark', () => {
  const { subject, body } = buildLetter({ place: place(), needs: defaults, contacts: on, mode: 'live' })
  assert.ok(!body.includes(EXAMPLE_MARK))
  assert.ok(!subject.includes(EXAMPLE_MARK))
})

test('no undefined, NaN or null, including with sources down and every need chosen', () => {
  const all = NEEDS.map((n) => n.key)
  for (const p of [place(), place({ fires: null, air: null, history: null, hotspots24h: null }), place({ fires: { nearest: [], within50km: 0, within100km: 0 } })]) {
    for (const mode of ['live', 'sim'] as const) {
      const { subject, body } = buildLetter({ place: p, needs: all, contacts: on, mode })
      for (const bad of ['undefined', 'NaN', 'null', '[object']) {
        assert.ok(!body.includes(bad), `${bad} in body:\n${body}`)
        assert.ok(!subject.includes(bad), `${bad} in subject`)
      }
    }
  }
})

test('the chosen needs appear, and only those', () => {
  const { body } = buildLetter({ place: place(), needs: ['crews', 'air'], contacts: on, mode: 'live' })
  assert.ok(body.includes('- Firefighters ready nearby'))
  assert.ok(body.includes('- Air cleaners for a clean-air room'))
  assert.ok(!body.includes('Pumps, hoses and sprinklers'))
})

test('no needs chosen leaves a blank to fill in', () => {
  const { body } = buildLetter({ place: place(), needs: [], contacts: on, mode: 'live' })
  assert.ok(body.includes('[the help you need]'))
})

test('dates are a weekday and a date', () => {
  assert.equal(dayDate('2026-11-15'), 'Sunday 15 November')
  assert.equal(dayDate('2026-07-01'), 'Wednesday 1 July')
  const { body } = buildLetter({ place: place(), needs: defaults, contacts: on, mode: 'live' })
  assert.ok(body.includes('expected to be high from Tuesday 17 November'), body)
  assert.ok(body.includes('ready by Monday 16 November:'), body)
  assert.ok(body.includes('up to 38 km/h on Monday 16 November'), body)
  // Every weekday named in the letter is followed by a day number and a month.
  const weekdays = body.match(/\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b[^\n]{0,20}/g) ?? []
  assert.ok(weekdays.length >= 3)
  for (const w of weekdays) assert.match(w, /^\w+day \d{1,2} (January|February|March|April|May|June|July|August|September|October|November|December)/, w)
})

test('no rise ahead: the risk sentence follows the page rule, and the help is asked for now', () => {
  const p = place({ outlook: { todayDate: '2026-11-15', todayLevel: 'Critical', peakLevel: 'Critical', peakScore: 94, peakDate: '2026-11-17', firstHigherLevelDate: null, actByDate: null } })
  p.risk.today = { ...p.risk.today, score: 75, level: 'Critical' }
  const { body } = buildLetter({ place: p, needs: defaults, contacts: on, mode: 'live' })
  assert.ok(body.includes('is very high today, Sunday 15 November'), body)
  assert.ok(body.includes('and expected to stay at or below very high for the next 3 days.'), body)
  assert.ok(body.includes('ready now:'), body)
})

test('a single very high day reads "reach … on", the same rule as the community page', async () => {
  const { statusSentence } = await import('../src/components/community/words.ts')
  // Fort William in the example: High on 14 and 15 July, Very high on 16 July, High again on 17 July.
  const scores: [string, RiskDay['kind'], number][] = [['2026-07-13', 'historical', 55], ['2026-07-14', 'today', 60], ['2026-07-15', 'forecast', 65], ['2026-07-16', 'forecast', 80], ['2026-07-17', 'forecast', 70]]
  const timeline: RiskDay[] = scores.map(([date, kind, score]) => ({ date, kind, score, level: levelFor(score) }))
  const p = place({ outlook: { todayDate: '2026-07-14', todayLevel: 'High', peakLevel: 'Critical', peakScore: 80, peakDate: '2026-07-16', firstHigherLevelDate: '2026-07-16', actByDate: '2026-07-15' } })
  p.risk = { ...p.risk, todayDate: '2026-07-14', timeline, today: { ...p.risk.today, score: 60, level: 'High' } }
  const { body } = buildLetter({ place: p, needs: defaults, contacts: on, mode: 'live' })
  assert.ok(body.includes('is high today, Tuesday 14 July (60 out of 100 on our estimate), and expected to reach very high on Thursday 16 July.'), body)
  assert.ok(!/very high from/.test(body), body)
  assert.equal(statusSentence(p).second, 'It is expected to reach very high on Thursday.')
})

test('warning-sign count leaves out the outlook sign and inactive signs', () => {
  const { body } = buildLetter({ place: place(), needs: defaults, contacts: on, mode: 'live' })
  assert.ok(body.includes('4 warning signs right now:'), body)
  assert.ok(body.includes('Heat is building: the daily high went from 20.3 °C to 30.5 °C in 7 days.'))
  assert.ok(body.includes('The nearest wildfire reported by fire crews is 13 km south-west of the community (THU045, about 16,604 hectares, being held).'))
})

test('blanks stay until filled, then the details replace them', () => {
  const blank = buildLetter({ place: place(), needs: defaults, contacts: on, mode: 'live' }).body
  for (const b of ['[your name]', '[your role]', '[phone]']) assert.ok(blank.includes(b))
  const filled = buildLetter({ place: place(), needs: defaults, contacts: on, mode: 'live', name: 'Pat Example', role: 'Emergency coordinator', phone: '807-555-0100' }).body
  for (const b of ['[your name]', '[your role]', '[phone]']) assert.ok(!filled.includes(b))
  assert.ok(filled.includes('My name is Pat Example. I am Emergency coordinator at Whitesand First Nation, in Ontario.'))
})

test('the letter says it is not an official rating and links the official one', () => {
  const { body } = buildLetter({ place: place(), needs: defaults, contacts: on, mode: 'live' })
  assert.ok(body.includes('It is not an official fire danger rating.'))
  assert.ok(body.includes(on.officialRatingUrl))
  const nt = buildLetter({ place: place(), needs: defaults, contacts: contactsFor('NT'), mode: 'live' }).body
  assert.ok(nt.includes('Official fire danger information is at:\nhttps://natural-resources.canada.ca/'))
})

test('ensureExampleMarks restores marks removed by an edit, and does nothing twice', () => {
  const edited = 'Hello,\n\nMy own words.'
  const fixed = ensureExampleMarks(edited)
  const lines = nonEmpty(fixed)
  assert.ok(lines[0].startsWith(EXAMPLE_MARK))
  assert.ok(lines.at(-1)!.includes(EXAMPLE_MARK))
  assert.equal(ensureExampleMarks(fixed), fixed)
})

test('mailto: encoded, short enough, and a trimmed example keeps its bottom mark', () => {
  const { subject, body } = buildLetter({ place: place(), needs: NEEDS.map((n) => n.key), contacts: on, mode: 'sim' })
  const long = body.replace('What the data shows', `What the data shows\n${'More words here. '.repeat(120)}`)
  const m = mailtoHref(letterRecipients(on), subject, long)
  assert.ok(m.trimmed)
  assert.ok(m.href.length <= 1900)
  assert.ok(m.href.startsWith('mailto:emergencyon-urgenceon@sac-isc.gc.ca?subject='))
  const decoded = decodeURIComponent(m.href.split('&body=')[1])
  assert.ok(decoded.trim().endsWith(`${EXAMPLE_MARK}.`), decoded.slice(-200))
  assert.ok(!/\s{3,}$/.test(decoded))
  const short = mailtoHref([], 'Hi', 'Line one\nLine two')
  assert.equal(short.href, 'mailto:?subject=Hi&body=Line%20one%0D%0ALine%20two')
  assert.equal(short.trimmed, false)
})

test('contacts: verified rows only, federal fallback elsewhere', () => {
  assert.equal(contactsFor('ON').reportFire?.number?.display, '310-FIRE (3473)')
  assert.equal(contactsFor('SK').reportFire?.number, null)
  assert.equal(contactsFor('on').isc.email, 'emergencyon-urgenceon@sac-isc.gc.ca')
  assert.equal(contactsFor('NT').isc.email, null)
  for (const code of ['ON', 'MB', 'SK', 'AB', 'BC', 'QC', 'NT', 'NB', 'YT', 'NU', '', 'XX']) {
    const c = contactsFor(code)
    assert.ok(c.isc.sourceUrl.startsWith('https://'))
    assert.equal(c.isc.checked, '14 November 2026')
    assert.ok(c.officialRatingUrl.startsWith('https://'))
  }
  assert.equal(contactsFor('NU').reportFire, null)
  assert.equal(contactsFor('NB').isc.name, 'Indigenous Services Canada, Atlantic region')
})
