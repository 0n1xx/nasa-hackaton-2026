// The built-in assistant: intents for the suggested questions and common misspellings, and answers
// that never leak undefined/NaN or code words, across levels, modes, provinces and missing data.
import test from 'node:test'
import assert from 'node:assert/strict'
import { SUGGESTED, SUGGESTED_QUESTIONS, answer, classifyIntent, type Intent } from './assistant.ts'
import { levelFor } from './risk.ts'
import { riskOutlook } from './outlook.ts'
import type { PlaceReport, RiskLevel } from './types.ts'
import { placeCore } from '../server/place.ts'

const base = async (): Promise<PlaceReport> => ({ ...(await placeCore('sim', 'whitesand', 3)).data, history: null, historyStatus: 'loading' })

/** The same report with the whole timeline shifted so today sits at `score`. */
function atScore(r: PlaceReport, score: number): PlaceReport {
  const shift = score - r.risk.today.score
  const timeline = r.risk.timeline.map((t) => { const s = Math.max(0, Math.min(100, t.score + shift)); return { ...t, score: s, level: levelFor(s) } })
  return { ...r, risk: { ...r.risk, timeline, today: { ...r.risk.today, score, level: levelFor(score) } }, outlook: riskOutlook(timeline)! }
}

const ALL: Intent[] = ['risk_now', 'why', 'when_worse', 'what_to_do', 'who_to_contact', 'request_help', 'smoke_health', 'how_sure', 'meaning_of_level', 'evacuation', 'data_sources', 'greeting', 'unknown']
const BAD = /undefined|NaN|\bnull\b|Critical|Moderate|\[object|PM2\.5|index is/

function sentences(text: string) { return text.split(/(?<=[.?!])\s+(?=[A-Z])/).filter(Boolean).length }

test('assistant: each suggested question maps to its intent', () => {
  assert.deepEqual(SUGGESTED_QUESTIONS, ['Why is the risk high?', 'What can we do this week?', 'Who can send firefighters?', 'Is the smoke safe to breathe?', 'How sure are you?'])
  for (const s of SUGGESTED) assert.equal(classifyIntent(s.question), s.intent, s.question)
})

test('assistant: other questions and misspellings', () => {
  const cases: [string, Intent][] = [
    ['who can send firefigthers', 'who_to_contact'],
    ['we need fire fighters here', 'who_to_contact'],
    ['is it too smokey to go outside', 'smoke_health'],
    ['is the air ok to breath', 'smoke_health'],
    ['What does very high mean?', 'meaning_of_level'],
    ['Write the request for us', 'request_help'],
    ['Should we evacuate?', 'evacuation'],
    ['do we need to evacuate because of the smoke', 'evacuation'],
    ['When will it get worse?', 'when_worse'],
    ['Is it going to be worse this weekend?', 'when_worse'],
    ['What is the fire risk today?', 'risk_now'],
    ['How bad is it?', 'risk_now'],
    ['how acurate is this', 'how_sure'],
    ['Where does the data come from?', 'data_sources'],
    ['how do we prepare', 'what_to_do'],
    ['Who do we call?', 'who_to_contact'],
    ['why is it so high', 'why'],
    ['Hi!', 'greeting'],
    ['hello there', 'greeting'],
    ['Hi, why is the risk high?', 'why'],
    ['What is the capital of France?', 'unknown'],
    ['', 'unknown'],
  ]
  for (const [q, want] of cases) assert.equal(classifyIntent(q), want, q)
})

test('assistant: answers never leak undefined, NaN or code words, and stay within 3 sentences', async () => {
  const r0 = await base()
  const variants: [string, PlaceReport | null][] = [
    ['full', r0], ['no report', null],
    ['air null', { ...r0, air: null }], ['fires null', { ...r0, fires: null }], ['hotspots null', { ...r0, hotspots24h: null, risk: { ...r0.risk, hotspots100km: null } }],
    ['no fires near', { ...r0, fires: { nearest: [], within50km: 0, within100km: 0 } }],
    ['no signs', { ...r0, signs: r0.signs.map((s) => ({ ...s, active: false })) }],
  ]
  for (const score of [10, 35, 60, 90]) variants.push([`score ${score}`, atScore(r0, score)])
  for (const prov of ['ON', 'MB', 'SK', 'AB', 'BC', 'QC', 'NT', 'YT', 'NS', 'NU', 'Ontario', 'XX', '']) variants.push([`province ${prov}`, { ...r0, community: { ...r0.community, province: prov } }])
  for (const mode of ['sim', 'live'] as const) {
    for (const [label, report] of variants) {
      for (const intent of ALL) {
        const a = answer(intent, { report, mode, question: 'What does high mean?' })
        const where = `${mode} ${label} ${intent}`
        assert.ok(a.text.length > 0, where)
        assert.doesNotMatch(a.text, BAD, `${where}: ${a.text}`)
        assert.doesNotMatch(a.from, BAD, `${where}: ${a.from}`)
        assert.ok(a.from.length > 0, `${where}: from line`)
        assert.ok(sentences(a.text) <= 3, `${where}: ${a.text}`)
        for (const act of a.actions) {
          assert.ok(act.label && act.to, where)
          assert.doesNotMatch(act.label + act.to, /undefined|NaN/, where)
        }
      }
    }
  }
})

test('assistant: example mode says so on every answer that quotes the numbers', async () => {
  const r = await base()
  for (const intent of ['risk_now', 'why', 'when_worse', 'what_to_do', 'smoke_health', 'how_sure', 'request_help'] as Intent[]) {
    assert.match(answer(intent, { report: r, mode: 'sim' }).text, /In this example scenario, /, intent)
    assert.doesNotMatch(answer(intent, { report: r, mode: 'live' }).text, /example scenario/i, intent)
  }
})

test('assistant: contacts are the verified ones for the province, never invented', async () => {
  const r = await base()
  const on = answer('who_to_contact', { report: r, mode: 'sim' })
  assert.match(on.text, /911/)
  assert.match(on.text, /310-FIRE/)
  assert.match(on.text, /French and Mattawa/)
  assert.doesNotMatch(on.text, /AFFES|@/)
  // The email address is a button (a mailto: link), not part of the sentence.
  assert.ok(on.actions.some((a) => a.to === 'mailto:emergencyon-urgenceon@sac-isc.gc.ca'))
  assert.ok(on.actions.some((a) => a.to === '/c/whitesand/help'))
  assert.ok(on.actions.every((a) => !a.label.includes(':')), 'no colon labels')
  // Alberta's office lists a phone and an email: both get a button, and neither goes in the sentence.
  const ab = answer('who_to_contact', { report: { ...r, community: { ...r.community, province: 'AB' } }, mode: 'live' })
  assert.ok(ab.actions.some((a) => a.to === 'tel:7804957707'))
  assert.ok(ab.actions.some((a) => a.to === 'mailto:ab.emergency@sac-isc.gc.ca'))
  assert.doesNotMatch(ab.text, /780-495-7707|@/)
  // Saskatchewan: the report number was not confirmed on an official page, so point to the page instead.
  const sk = answer('who_to_contact', { report: { ...r, community: { ...r.community, province: 'SK' } }, mode: 'live' })
  assert.doesNotMatch(sk.text, /667-9660|SPSA/)
  assert.ok(sk.actions.some((a) => a.to.startsWith('https://www.saskpublicsafety.ca/')))
})

test('assistant: levels use the page words and the risk is honest when it is not high', async () => {
  const r = await base()
  const why = answer('why', { report: r, mode: 'sim' })
  assert.match(why.text, /very high today \(\d+ out of 100\)/)
  assert.ok(why.actions.some((a) => a.to === '#why'))
  const low = answer('why', { report: atScore(r, 10), mode: 'live' })
  assert.match(low.text, /^Fire risk is low today \(10 out of 100\), so it is not high right now/)
  const sure = answer('how_sure', { report: r, mode: 'sim' })
  assert.match(sure.text, /not very sure/)
  assert.match(sure.text, /not an official fire danger rating/)
  assert.doesNotMatch(sure.text, /±|%/)
  const smoke = answer('smoke_health', { report: r, mode: 'sim' })
  assert.doesNotMatch(smoke.text, /\bsafe\b/i)
  assert.match(smoke.text, /smoke reading: \d+ on the US air quality scale, where over 300 is the worst level/)
  assert.doesNotMatch(smoke.text, /air quality index/)
  assert.match(smoke.text, /Get medical help/)
  const unk = answer('unknown', { report: r, mode: 'sim' })
  assert.deepEqual(unk.actions.map((a) => a.label), SUGGESTED_QUESTIONS)
})

test('assistant: common ways of asking whether to leave get the evacuation answer', () => {
  for (const q of ['Do we need to leave?', 'Is it time to leave?', 'Should we leave?', 'Do we have to go?', 'Evacuate?', 'Do we have to leave?', 'Does this mean we should leave?']) {
    assert.equal(classifyIntent(q), 'evacuation', q)
  }
  // Not evacuation: "go to" someone for help, and "make sure" is not "how sure".
  assert.equal(classifyIntent('Who do we need to go to for firefighters?'), 'who_to_contact')
  assert.notEqual(classifyIntent('What should we do to make sure we are ready?'), 'how_sure')
})

test('assistant: days a week or more away are named with the date, not a bare weekday', async () => {
  const r = await placeCore('sim', 'whitesand', 14).then((p) => p.data)
  const today = r.risk.todayDate
  const far = r.risk.timeline.filter((t) => t.kind === 'forecast').at(-1)!
  // Make the last day the peak, 14 days out.
  const timeline = r.risk.timeline.map((t) => (t.date === far.date ? { ...t, score: 99, level: levelFor(99) } : t))
  const p: PlaceReport = { ...r, history: null, historyStatus: 'loading', risk: { ...r.risk, timeline }, outlook: riskOutlook(timeline)! }
  const a = answer('when_worse', { report: p, mode: 'live' })
  assert.match(a.text, /expected to be (Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday) \d{1,2} (July|August)/, a.text)
  assert.ok(today < far.date)
})

test('smoke: a reading of 183 is "heavy" on the page, in the letter and in the assistant', async () => {
  const { smokePlain } = await import('./aqi.ts')
  const { smokeWords } = await import('../src/components/community/words.ts')
  const { buildLetter } = await import('./letter.ts')
  const { contactsFor } = await import('./contacts.ts')
  assert.equal(smokePlain(183)?.word, 'heavy')
  assert.equal(smokePlain(50)?.word, 'very little')
  assert.equal(smokePlain(301)?.word, 'very heavy')
  const r0 = await base()
  const r: PlaceReport = { ...r0, air: { ...r0.air!, now: { ...r0.air!.now, usAqi: 183 } } }
  assert.equal(smokeWords(r)?.line, 'Smoke in the air: heavy today.')
  assert.match(smokeWords(r)!.number!, /^Smoke reading: 183 on the US air quality scale \(over 300 is the worst level\)\.$/)
  assert.match(answer('smoke_health', { report: r, mode: 'live' }).text, /there is heavy smoke in the air today/i)
  assert.match(buildLetter({ place: r, needs: [], contacts: contactsFor('ON'), mode: 'live' }).body, /Smoke in the air today: heavy \(/)
})
