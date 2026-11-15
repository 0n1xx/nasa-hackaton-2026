// The "Ask for help" request letter, built from one PlaceReport. Pure: no DOM, no clock, no locale.
//
// Rules (docs/plans/2026-11-14-community-hub.md, voice guide):
// - Facts and the request only. Never speak for the Nation beyond that: the person sending it decides.
// - Blanks the person fills in themselves: [your name], [your role], [phone].
// - Our number is an estimate, never an official fire danger rating; the letter links the official one.
// - In the example scenario the letter says so at the top and the bottom, so a copied or printed
//   example can never pass for a real request.

import type { Compass8, DayWeather, Mode, PlaceReport, RiskLevel } from './types.ts'
import type { WarningSign } from './signals.ts'
import { levelLabel } from './risk.ts'
import { smokePlain } from './aqi.ts'
import { fullDates, outlookPhrase } from './outlookWords.ts'
import type { ProvinceContacts } from './contacts.ts'

export type NeedKey = 'crews' | 'pumps' | 'brush' | 'evac' | 'air'

/** The "What you need" choices, in page order. The label is used as is in the letter. */
export const NEEDS: { key: NeedKey; label: string; defaultOn: boolean }[] = [
  { key: 'crews', label: 'Firefighters ready nearby', defaultOn: true },
  { key: 'pumps', label: 'Pumps, hoses and sprinklers for homes', defaultOn: true },
  { key: 'brush', label: 'Help clearing brush near homes', defaultOn: false },
  { key: 'evac', label: 'Plans and transport if people need to leave', defaultOn: false },
  { key: 'air', label: 'Air cleaners for a clean-air room', defaultOn: false },
]

export const EXAMPLE_MARK = 'EXAMPLE ONLY — not real conditions'
const EXAMPLE_TOP = `${EXAMPLE_MARK}. This letter was made from the Before the Smoke example scenario: the fires, weather and smoke in it are made up. Do not send it as a real request.`
const EXAMPLE_BOTTOM = `${EXAMPLE_MARK}.`

export const BLANK_NAME = '[your name]'
export const BLANK_ROLE = '[your role]'
export const BLANK_PHONE = '[phone]'

export interface LetterInput {
  place: PlaceReport
  needs: NeedKey[]
  name?: string
  role?: string
  phone?: string
  contacts: ProvinceContacts
  mode: Mode
}

export interface Letter { subject: string; body: string }

// --- Dates: YYYY-MM-DD local-day strings, formatted without the runtime's locale ---

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

/** "2026-11-15" → "Sunday 15 November". Returns the input unchanged when it is not a date. */
export function dayDate(iso: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '')
  if (!m) return iso ?? ''
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const wd = new Date(Date.UTC(y, mo - 1, d)).getUTCDay()
  return `${WEEKDAYS[wd]} ${d} ${MONTHS[mo - 1]}`
}

const COMPASS: Record<Compass8, string> = {
  N: 'north', NE: 'north-east', E: 'east', SE: 'south-east', S: 'south', SW: 'south-west', W: 'west', NW: 'north-west',
}
const STAGE: Record<string, string> = { OC: 'out of control', BH: 'being held', UC: 'under control', EX: 'out' }

const words = (level: RiskLevel) => levelLabel(level).toLowerCase()
const lcFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1)
const noStop = (s: string) => s.trim().replace(/\.$/, '')
const thousands = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
const num = (s: string) => { const m = /-?\d+(\.\d+)?/.exec(s); return m ? Number(m[0]) : null }
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

/** The active warning signs the community page counts: the outlook sign is left out (it is the risk sentence itself). */
export function countedSigns(signs: WarningSign[]): WarningSign[] {
  return signs.filter((s) => s.active && s.key !== 'outlook')
}

/** The day the wind peaks, by the same rule as shared/signals.ts (today, then the next 3 forecast days). */
function windPeak(days: DayWeather[]): DayWeather | null {
  const today = days.filter((d) => d.kind === 'historical').at(-1)
  const window = [today, ...days.filter((d) => d.kind === 'forecast').slice(0, 3)].filter((d): d is DayWeather => !!d && d.windMax != null)
  return window.length ? window.reduce((a, b) => (b.windMax! > a.windMax! ? b : a)) : null
}

/** One plain sentence per active warning sign. */
function signSentence(s: WarningSign, place: PlaceReport): string {
  switch (s.key) {
    case 'heat': {
      const n = /in (\d+) days/.exec(s.value)?.[1]
      return `Heat is building: ${lcFirst(noStop(s.detail))}${n ? ` in ${n} days` : ''}.`
    }
    case 'humidity': return `The air is drying out: ${lcFirst(noStop(s.detail))}.`
    case 'dry': {
      const m = /^(\d+)(\+?)/.exec(s.value)
      if (!m) return 'There has been no soaking rain for several days.'
      return `There has been no soaking rain for ${m[1]} days${m[2] ? ' or more' : ''}.`
    }
    case 'wind': {
      const peak = windPeak(place.risk.days)
      const kmh = peak?.windMax != null ? Math.round(peak.windMax) : num(s.value)
      const when = peak ? (peak.date === place.risk.todayDate ? 'today' : `on ${dayDate(peak.date)}`) : ''
      return `Strong wind is expected${kmh != null ? `, up to ${kmh} km/h` : ''}${when ? ` ${when}` : ''}.`
    }
    case 'fire': {
      const n = num(s.value)
      return n != null
        ? `Satellites spotted heat in ${plural(n, 'place')} within 100 km in the last 24 hours.`
        : 'Satellites spotted heat within 100 km in the last 24 hours.'
    }
    case 'smoke': return `Smoke is getting thicker: ${lcFirst(noStop(s.detail)).replace(/^fine particles/, 'fine smoke particles')}.`
    default: return `${s.label}: ${lcFirst(noStop(s.detail))}.`
  }
}

/** "Fire risk near X is high today ... expected to be very high from Monday 16 November." */
function riskSentence(place: PlaceReport): string {
  const name = place.community.name
  const o = place.outlook
  const todayLevel = o.todayLevel ?? place.risk.today.level
  const todayDate = o.todayDate ?? place.risk.todayDate
  const head = `Fire risk near ${name} is ${words(todayLevel)} today, ${dayDate(todayDate)} (${place.risk.today.score} out of 100 on our estimate)`
  // The community page's status rule (shared/outlookWords.ts), with full dates: "expected to reach very high
  // on Thursday 16 July" for a single higher day, "expected to be very high from …" only when it holds.
  const ahead = place.risk.timeline.filter((d) => d.kind === 'forecast')
  const phrase = outlookPhrase({ todayLevel, ahead, firstHigherLevelDate: o.firstHigherLevelDate, horizon: place.horizon }, fullDates)
  return phrase ? `${head}, and ${phrase.text}.` : `${head}.`
}

function firesSentence(place: PlaceReport): string | null {
  const f = place.fires
  if (!f) return null // the source was down: never read that as "no fires"
  const near = f.nearest[0]
  if (!near) return 'No wildfires are reported by fire crews within 100 km.'
  const parts = [near.name, near.hectares > 0 ? `about ${thousands(near.hectares)} hectares` : '', STAGE[near.stage] ?? ''].filter(Boolean)
  let s = `The nearest wildfire reported by fire crews is ${near.distanceKm} km ${COMPASS[near.bearing] ?? ''} of the community${parts.length ? ` (${parts.join(', ')})` : ''}.`
  if (f.within50km > 1) s += ` ${f.within50km} wildfires are reported within 50 km.`
  else if (f.within100km > 1) s += ` ${f.within100km} wildfires are reported within 100 km.`
  return s.replace(/ {2,}/g, ' ')
}

function smokeSentence(place: PlaceReport): string | null {
  const aqi = place.air?.now.usAqi
  const plain = smokePlain(aqi)
  if (aqi == null || !plain) return null
  // The same word as the community page and the assistant (shared/aqi.ts smokePlain).
  return `Smoke in the air today: ${plain.word} (smoke reading ${Math.round(aqi)} on the US air quality scale, where over 300 is the worst level).`
}

function historySentence(place: PlaceReport): string | null {
  const h = place.history
  if (!h || h.tMaxPercentile == null || h.todayTMax == null) return null
  const p = Math.round(h.tMaxPercentile)
  const hot = h.todayTMax >= 15 ? 'hotter' : 'warmer'
  const rank = p >= 100 ? `${hot} than almost every` : p >= 50 ? `${hot} than ${p} out of 100` : `cooler than ${100 - p} out of 100`
  let s = `NASA’s ${h.period.years}-year weather record for this location (${h.period.startYear} to ${h.period.endYear}): today’s high of ${Math.round(h.todayTMax * 10) / 10} °C is ${rank} days from ${h.window.label} in past years.`
  const t = h.fireSeasonTMax
  if (t.trend === 'rising' && t.mannKendallP < 0.05 && t.senPerDecade > 0) {
    s += ` Summer highs here have risen by about ${Math.round(t.senPerDecade * 10) / 10} °C per decade since ${h.period.startYear}.`
  }
  return s
}

/** Puts the example marks back at the top and bottom if an edit removed them. Safe to call more than once. */
export function ensureExampleMarks(text: string): string {
  const lines = text.replace(/\s+$/, '').split('\n')
  const first = lines.findIndex((l) => l.trim() !== '')
  let out = text.replace(/\s+$/, '')
  if (first < 0 || !lines[first].includes(EXAMPLE_MARK)) out = `${EXAMPLE_TOP}\n\n${out}`
  const last = out.split('\n').filter((l) => l.trim() !== '').at(-1) ?? ''
  if (!last.includes(EXAMPLE_MARK)) out = `${out}\n\n${EXAMPLE_BOTTOM}`
  return out
}

export function buildLetter(input: LetterInput): Letter {
  const { place, contacts, mode } = input
  const name = input.name?.trim() || BLANK_NAME
  const role = input.role?.trim() || BLANK_ROLE
  const phone = input.phone?.trim() || BLANK_PHONE
  const community = place.community.name
  const where = contacts.provinceName ? `${community}, in ${contacts.provinceName}` : community

  const needs = NEEDS.filter((n) => input.needs.includes(n.key)).map((n) => n.label)
  const act = place.outlook.actByDate
  const by = !act || act === (place.outlook.todayDate ?? place.risk.todayDate) ? 'now' : `by ${dayDate(act)}`

  const signs = countedSigns(place.signs)
  const facts = [firesSentence(place), smokeSentence(place), historySentence(place)].filter((s): s is string => !!s)

  const rating = contacts.wildfireAgency?.officialRatingUrl
    ? `The official rating${contacts.provinceName ? ` for ${contacts.provinceName}` : ''} is at:`
    : 'Official fire danger information is at:'

  const lines: string[] = []
  if (mode === 'sim') lines.push(EXAMPLE_TOP, '')
  lines.push(
    'Hello,',
    '',
    `My name is ${name}. I am ${role} at ${where}. I am writing to ask for wildfire help before a fire starts.`,
    '',
    riskSentence(place),
    '',
    `We are asking for this help to be ready ${by}:`,
    ...(needs.length ? needs : ['[the help you need]']).map((n) => `- ${n}`),
    '',
    'What the data shows',
    '',
    signs.length ? `${plural(signs.length, 'warning sign')} right now:` : 'No warning signs are showing right now.',
    ...signs.map((s) => `- ${signSentence(s, place)}`),
  )
  if (facts.length) lines.push('', ...facts)
  lines.push(
    '',
    `This estimate comes from Before the Smoke, a student prototype using NASA satellite data and weather forecasts. It is not an official fire danger rating. ${rating}`,
    // The link on its own line, with no full stop after it, so mail apps keep it clickable.
    contacts.officialRatingUrl,
    '',
    'Please let me know what help can be ready, and when.',
    '',
    'Thank you,',
    '',
    name,
    `${role}, ${community}`,
    phone,
  )
  if (mode === 'sim') lines.push('', EXAMPLE_BOTTOM)

  const subject = `${mode === 'sim' ? `${EXAMPLE_MARK}: ` : ''}Request for wildfire help, ${community}`
  return { subject, body: lines.join('\n') }
}

/** Longest mailto: link we build. Some mail apps and Windows truncate or refuse links much past 2,000 characters. */
export const MAILTO_MAX = 1900

const enc = (s: string) => encodeURIComponent(s.replace(/\r?\n/g, '\r\n'))

/**
 * A mailto: link with the subject and body URL-encoded. When it would be longer than `max`, the
 * body is cut at a word boundary and ends with a note to paste the full letter; an example
 * letter keeps its bottom mark.
 */
export function mailtoHref(to: string[], subject: string, body: string, max = MAILTO_MAX): { href: string; trimmed: boolean } {
  const build = (b: string) => `mailto:${to.join(',')}?subject=${enc(subject)}&body=${enc(b)}`
  const full = build(body)
  if (full.length <= max) return { href: full, trimmed: false }

  const example = body.includes(EXAMPLE_MARK)
  let core = body.replace(/\s+$/, '')
  if (example && core.split('\n').at(-1)?.includes(EXAMPLE_MARK)) core = core.split('\n').slice(0, -1).join('\n').replace(/\s+$/, '')
  const tail = `\n\n[The letter is cut short here to fit in an email link. Use "Copy the letter" on the Before the Smoke page and paste the full letter. The fire risk in it is an estimate from a student prototype, not an official fire danger rating.]${example ? `\n\n${EXAMPLE_BOTTOM}` : ''}`

  let lo = 0, hi = core.length
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2)
    if (build(core.slice(0, mid) + tail).length <= max) lo = mid
    else hi = mid - 1
  }
  let cut = core.slice(0, lo)
  const space = Math.max(cut.lastIndexOf('\n'), cut.lastIndexOf(' '))
  if (space > 0 && lo < core.length) cut = cut.slice(0, space)
  return { href: build(cut.replace(/\s+$/, '') + tail), trimmed: true }
}
