// Every sentence the community view says, built from one PlaceReport. Pure functions, no React,
// so the wording can be checked from the command line against a saved /api/place response.
// Voice: docs/plans/2026-11-14-community-hub.md (plain, warm, "expected", never "forecast" or "predicted").

import type { Compass8, DayWeather, PlaceFire, PlaceReport, RiskDay, RiskLevel } from '../../../shared/types.ts'
import type { WarningSign } from '../../../shared/signals.ts'
import { levelFor, levelLabel } from '../../../shared/risk.ts'
import { SMOKE_MEDICAL, SMOKE_RANK, aqiFromPm25, smokePlain, smokeReading, type SmokeWord } from '../../../shared/aqi.ts'
import { aheadPhrase, dayWord, outlookPhrase, relativeDays } from '../../../shared/outlookWords.ts'

export { aheadPhrase, dayWord }

const RANK: Record<RiskLevel, number> = { Low: 0, Moderate: 1, High: 2, Critical: 3 }

/** "very high", for the middle of a sentence. */
export const lower = (l: RiskLevel) => levelLabel(l).toLowerCase()

// Dates are local-day strings (YYYY-MM-DD). Read them at noon so a time zone never moves the day.
const at = (iso: string) => new Date(`${iso}T12:00:00`)
export const weekdayLong = (iso: string) => at(iso).toLocaleDateString('en-CA', { weekday: 'long' })
export const weekdayShort = (iso: string) => at(iso).toLocaleDateString('en-CA', { weekday: 'short' }).replace('.', '')
export const dayOfMonth = (iso: string) => Number(iso.slice(8, 10))
export const monthLong = (iso: string) => at(iso).toLocaleDateString('en-CA', { month: 'long' })
/** "Tuesday 17 November" */
export const fullDate = (iso: string) => `${weekdayLong(iso)} ${dayOfMonth(iso)} ${monthLong(iso)}`

/** The data's own today. Never new Date(): the example scenario is set on 14 July 2026, and live dates are local to the place. */
export function todayOf(p: PlaceReport): string {
  return p.outlook.todayDate ?? p.risk.timeline.find((d) => d.kind === 'today')?.date ?? p.risk.todayDate
}

const onDay = (iso: string, todayIso: string) => {
  const w = dayWord(iso, todayIso)
  return w === 'today' || w === 'tomorrow' ? w : `on ${w}`
}

/** Today and the look-ahead days, in order (past days left out). */
export function lookAheadDays(p: PlaceReport): RiskDay[] {
  return p.risk.timeline.filter((d) => d.kind !== 'historical')
}

export function todayLevel(p: PlaceReport): RiskLevel {
  return p.outlook.todayLevel ?? p.risk.today.level
}

// ---------------------------------------------------------------------------------------------
// 2. Status

/** "Fire risk is high today." + "It is expected to be very high from Sunday." (or stay / ease / stay at or below). */
export function statusSentence(p: PlaceReport): { first: string; second: string | null } {
  const today = todayOf(p)
  const L = todayLevel(p)
  const first = `Fire risk is ${lower(L)} today.`
  // The shared rule (shared/outlookWords.ts), so the letter and the assistant say the same thing.
  const o = outlookPhrase({ todayLevel: L, ahead: p.risk.timeline.filter((d) => d.kind === 'forecast'), firstHigherLevelDate: p.outlook.firstHigherLevelDate, horizon: p.horizon }, relativeDays(today))
  if (!o) return { first, second: null }
  // One joined sentence for the steady case: 'Fire risk is high today and expected to stay high for the next 3 days.'
  return o.steady ? { first: first.slice(0, -1), second: `and ${o.text}.` } : { first, second: `It is ${o.text}.` }
}

// ---------------------------------------------------------------------------------------------
// 3. How sure are we?

const SURE: Record<'High' | 'Medium' | 'Low', string> = { High: 'Fairly sure', Medium: 'Somewhat sure', Low: 'Not very sure' }

export function howSure(p: PlaceReport): { word: string; reason: string; range: string } {
  const t = p.risk.today
  const why = t.confidenceWhy ?? ''
  const unchecked = 'our estimate has not yet been checked against past fires'
  const missing = /(\d+) of \d+ inputs missing/.exec(why)
  const reason = /simulated/.test(why) ? `This is example data, and ${unchecked}.`
    : missing ? `Some weather readings are missing, and ${unchecked}.`
      : /forecast/.test(why) ? `It uses forecast weather, and ${unchecked}.`
        : `${unchecked[0].toUpperCase()}${unchecked.slice(1)}.`
  const clamp = (v: number) => Math.max(0, Math.min(100, v))
  const lo = levelFor(clamp(t.score - t.uncertainty)), hi = levelFor(clamp(t.score + t.uncertainty))
  const range = lo === hi ? `It could be a little higher or lower, but it would still be ${lower(lo)}.`
    : `It could be anywhere from ${levelLabel(lo)} to ${levelLabel(hi)}.`
  return { word: SURE[t.confidence] ?? 'Not very sure', reason, range }
}

// ---------------------------------------------------------------------------------------------
// 4. Look ahead

/** "Highest: Very high on Tuesday 17 November." for the compact week views. */
export function highestLine(p: PlaceReport): string {
  const today = todayOf(p)
  const o = p.outlook
  return o.peakDate === today ? `Highest: ${levelLabel(o.peakLevel)} today.` : `Highest: ${levelLabel(o.peakLevel)} on ${fullDate(o.peakDate)}.`
}

// ---------------------------------------------------------------------------------------------
// 5. Why: warning signs

/**
 * The number of warning signs the page, the help letter and the assistant all quote.
 * The outlook sign ("risk rising" / "very high in the forecast") is left OUT: the status sentence
 * already says what the risk is expected to do, so counting it again would double-count.
 */
export function activeSignCount(signs: WarningSign[]): number {
  return signs.filter((s) => s.active && s.key !== 'outlook').length
}

/** The signs shown under "Why", active first, outlook left out (see activeSignCount). */
export function shownSigns(signs: WarningSign[]): { active: WarningSign[]; quiet: WarningSign[] } {
  const list = signs.filter((s) => s.key !== 'outlook')
  return { active: list.filter((s) => s.active), quiet: list.filter((s) => !s.active) }
}

const num = (re: RegExp, s: string) => { const m = re.exec(s); return m ? Number(m[1]) : null }

/** The wind sign's day as "today", "tomorrow" or a weekday, matched back to the weather day it came from. */
function windDay(s: WarningSign, p: PlaceReport): string {
  if (/today/.test(s.detail)) return 'today'
  const name = /on (\w+)\./.exec(s.detail)?.[1]
  const speed = num(/(\d+) km\/h/, s.value)
  const today = todayOf(p)
  const d = p.risk.days.find((x) => x.kind === 'forecast' && x.windMax != null && Math.round(x.windMax) === speed && weekdayLong(x.date) === name)
  return d ? dayWord(d.date, today) : name ?? 'in the next few days'
}

/** One plain sentence per sign (critique §1b). Never shows the sign's raw label, value or rule. */
export function signSentence(s: WarningSign, p: PlaceReport): string {
  switch (s.key) {
    case 'heat': {
      const m = /^([+−-])\s?([\d.]+)/.exec(s.value)
      const n = m ? Math.round(Number(m[2])) : null
      const up = m?.[1] === '+'
      if (s.active) return `Hotter: today's high is ${n} °C above last week's.`
      return n == null || n === 0 ? "Today's high is about the same as last week's." : up ? `Today's high is ${n} °C above last week's, not enough to count as a warning sign.` : `Cooler: today's high is ${n} °C below last week's.`
    }
    case 'humidity': {
      const n = num(/(\d+)%/, s.value)
      return s.active ? `Dry air: humidity is down to ${n}%. We count it as a warning sign at 35% or lower.` : `The air is not very dry: humidity is ${n}% at its lowest today.`
    }
    case 'dry': {
      const n = num(/(\d+)/, s.value) ?? 0
      const atLeast = /\+/.test(s.value)
      if (s.active) return `No soaking rain for ${atLeast ? 'at least ' : ''}${n} days.`
      return n === 0 ? 'There was soaking rain today.' : `There was soaking rain ${n} day${n === 1 ? '' : 's'} ago.`
    }
    case 'wind': {
      const v = num(/(\d+) km\/h/, s.value)
      const day = windDay(s, p)
      if (!s.active) return `No strong wind expected soon (up to ${v} km/h).`
      return day === 'today' ? `Strong wind today, up to ${v} km/h.` : `Strong wind expected ${day}, up to ${v} km/h.`
    }
    case 'fire': {
      // Feed down: the sign arrives as 0, which must never read as "no heat spotted".
      if (p.hotspots24h == null) return 'Satellite heat data is not available right now.'
      const n = num(/(\d+)/, s.value) ?? 0
      return n > 0 ? `Heat spotted by satellites ${n} time${n === 1 ? '' : 's'} within 100 km in the last day.` : 'No heat spotted by satellites within 100 km in the last day.'
    }
    case 'smoke':
      return s.active ? 'Smoke is getting thicker than the day before.' : 'Smoke is not getting thicker.'
    default:
      return s.label
  }
}

// ---------------------------------------------------------------------------------------------
// 6. Compared with 42 years of NASA records (NASA POWER daily weather at the community's grid square)
// Sentence first, number second. The test names stay inside "How we tested this" (glossary).

/** A no-break space: keeps "p = 0.30" and "0.1 °C" on one line. */
const NB = String.fromCharCode(0xa0)
/** "p = 0.30", "p = 0.012", "p < 0.001": the exact form, as on /about. */
export const fmtP = (p: number) => (p < 0.001 ? `p${NB}<${NB}0.001` : `p${NB}=${NB}${p < 0.1 ? p.toFixed(3) : p.toFixed(2)}`)
/** Below this size (°C per decade) a change reads as "no real change", never "−0.0". */
export const tiny = (v: number) => Math.abs(v) < 0.05
/** "+0.11", "−0.30", or "0" when tiny. */
export const signed = (v: number, d = 1) => (tiny(v) ? '0' : `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(d)}`)
/** A change is called real only when p < 0.05 (/about, "Trend tests"). */
export const SIGNIFICANT_P = 0.05
/** " °C" after a no-break space, so "0.1 °C" never wraps between the number and the unit. */
const C = `${NB}°C`

/** "7 to 21 July", "28 June to 12 July": a comparison window given as MMDD strings. */
export function windowDates(w: { startMMDD: string; endMMDD: string }): string {
  const m = (mmdd: string) => at(`2001-${mmdd.slice(0, 2)}-${mmdd.slice(2, 4)}`).toLocaleDateString('en-CA', { month: 'long' })
  const d = (mmdd: string) => Number(mmdd.slice(2, 4))
  return m(w.startMMDD) === m(w.endMMDD) ? `${d(w.startMMDD)} to ${d(w.endMMDD)} ${m(w.endMMDD)}` : `${d(w.startMMDD)} ${m(w.startMMDD)} to ${d(w.endMMDD)} ${m(w.endMMDD)}`
}

/** "Today's high is hotter than 96 of every 100 mid-July days since 1984." Null unless the record is in. */
export function historySentence(p: PlaceReport): string | null {
  const h = p.history
  if (p.historyStatus !== 'ok' || !h || h.tMaxPercentile == null) return null
  const n = Math.round(h.tMaxPercentile)
  const w = h.window
  const days = /^mid-/i.test(w.label) ? `${w.label} days` : `days from ${windowDates(w)}`
  const since = `since ${h.period.startYear}`
  // "Hotter" for a summer day; "warmer" when today's high is cold ("hotter" at -1 °C reads oddly).
  const hot = h.todayTMax == null || h.todayTMax >= 15 ? 'hotter' : 'warmer'
  if (n >= 100) return `Today's high is ${hot} than any of the ${days} ${since}.`
  return n >= 50 ? `Today's high is ${hot} than ${n} of every 100 ${days} ${since}.` : `Today's high is cooler than ${100 - n} of every 100 ${days} ${since}.`
}

/**
 * The long-term direction of fire-season daytime highs, in words, with the p-value last.
 * "Daytime highs from May to September have warmed by about 0.4 °C every 10 years here since 1984. This is very unlikely to be chance (p < 0.01)."
 * "Daytime highs from May to September have warmed a little here since 1984, about 0.1 °C every 10 years. That is small enough that it could be chance (p = 0.30)."
 */
export function trendSentence(p: PlaceReport): string | null {
  const h = p.history
  if (p.historyStatus !== 'ok' || !h) return null
  const { senPerDecade: sen, mannKendallP: pv } = h.fireSeasonTMax
  if (!Number.isFinite(sen) || !Number.isFinite(pv)) return null
  const since = h.period.startYear
  const pShort = pv < 0.01 ? `p${NB}<${NB}0.01` : fmtP(pv)
  const highs = 'Daytime highs from May to September'
  if (tiny(sen)) return `${highs} have barely changed here since ${since} (${pShort}).`
  const dir = sen > 0 ? 'warmed' : 'cooled'
  const size = `about ${Math.abs(sen).toFixed(1)}${C} every 10 years`
  if (pv < SIGNIFICANT_P) return `${highs} have ${dir} by ${size} here since ${since}. This is ${pv < 0.01 ? 'very unlikely' : 'unlikely'} to be chance (${pShort}).`
  return `${highs} have ${dir} a little here since ${since}, ${size}. That is small enough that it could be chance (${pShort}).`
}

const deg = (v: number, pos: string, neg: string) => `${Math.abs(v)}° ${v >= 0 ? pos : neg}`
/** "23.3", "−0.7" (a true minus sign), never "−0.0". */
const c1 = (v: number) => { const s = v.toFixed(1); return s === '-0.0' ? '0.0' : s.replace('-', '−') }

/**
 * "How we tested this": which data, which tests, and the numbers they gave. Each part is a heading and one
 * short paragraph. The percentile part is left out when there is no reading for today.
 */
export function recordDetails(p: PlaceReport): { title: string; text: string }[] {
  const h = p.history
  if (p.historyStatus !== 'ok' || !h) return []
  const { period, point, window: w, tMax } = h
  const t = h.fireSeasonTMax
  const out: { title: string; text: string }[] = [{
    title: 'The data',
    text: `NASA POWER daily weather from ${period.startYear} to ${period.endYear}: ${period.years} years, ${period.days.toLocaleString('en-CA')} days. `
      + `The values are for a grid square about 50 km across, centred at ${deg(point.lat, 'N', 'S')}, ${deg(point.lon, 'E', 'W')}, not for a single weather station.`,
  }]
  if (h.todayTMax != null && h.tMaxPercentile != null) out.push({
    title: 'Percentile rank of today’s high',
    text: `We ranked today’s high, ${c1(h.todayTMax)}${C}, among the ${tMax.window.n.toLocaleString('en-CA')} daily highs from ${windowDates(w)} in every year of the record. `
      + `Its percentile rank is ${Math.round(h.tMaxPercentile)} out of 100. The average of those daily highs is ${c1(tMax.window.mean)}${C}.`,
  })
  const sig = t.mannKendallP < SIGNIFICANT_P
  out.push({
    title: 'Mann–Kendall trend test and Sen’s slope',
    text: `We took the average daytime high of each fire season (1 May to 30 September), ${tMax.annual.length} values. `
      + `The Mann–Kendall test on them gives Kendall’s τ${NB}=${NB}${t.tau.toFixed(2)} and ${fmtP(t.mannKendallP)}, ${sig ? 'significant' : 'not significant'} at p${NB}<${NB}0.05. `
      + `Sen’s slope is ${tiny(t.senPerDecade) ? 'about 0' : signed(t.senPerDecade, 2)}${C} per decade.`,
  })
  return out
}

// ---------------------------------------------------------------------------------------------
// 7. How things are changing (Trends.tsx): one plain sentence above each chart, from the same days the chart
// draws. Past days say "has"; days ahead say "expected". Small wobbles read as "about the same".

/** One day on the trend charts: the risk timeline day and the weather for the same date. */
export interface TrendDay { date: string; kind: RiskDay['kind']; risk: RiskDay; wx: DayWeather | null }

/**
 * The risk timeline (past days, today, the days ahead) with each day's weather joined by date. risk.days holds
 * more past days than the timeline and calls today 'historical', so it is never read by position.
 */
export function trendDays(p: PlaceReport): TrendDay[] {
  const wx = new Map(p.risk.days.map((d) => [d.date, d]))
  return p.risk.timeline.map((d) => ({ date: d.date, kind: d.kind, risk: d, wx: wx.get(d.date) ?? null }))
}

/** Index of today on the timeline (the last past day if the timeline has no 'today'). */
export function todayIndex(days: { kind: RiskDay['kind'] }[]): number {
  const i = days.findIndex((d) => d.kind === 'today')
  if (i >= 0) return i
  const firstAhead = days.findIndex((d) => d.kind === 'forecast')
  return Math.max(0, (firstAhead < 0 ? days.length : firstAhead) - 1)
}

/** Wind at or above this (km/h) is "strong": the same line as the wind warning sign (shared/signals.ts). */
export const STRONG_WIND_KMH = 30
/** A day with at least this much rain (mm) counts as a day with rain. */
export const RAIN_DAY_MM = 1

/** A whole number with a true minus sign and never "−0". */
const whole = (v: number) => { const n = Math.round(v); return n === 0 ? '0' : n < 0 ? `−${-n}` : String(n) }
const degC = (v: number) => `${whole(v)}${C}`
const pct = (v: number) => `${whole(v)}%`
const kmh = (v: number) => `${whole(v)}${NB}km/h`
const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length

/** "today", or "on Friday" for another day: past days by weekday, days ahead as the status sentence says them. */
const whenWord = (iso: string, todayIso: string) => (iso === todayIso ? 'today' : onDay(iso, todayIso))

type Pick1 = (d: TrendDay) => number | null | undefined
/** The days up to and including today, and the days ahead, that have a value. */
function split(days: TrendDay[], get: Pick1) {
  const t = todayIndex(days)
  const has = (d: TrendDay) => { const v = get(d); return v != null && Number.isFinite(v) }
  return { upTo: days.slice(0, t + 1).filter(has), ahead: days.slice(t + 1).filter(has), today: days[t]?.date ?? '' }
}

/**
 * Fire risk, past days to the days ahead: "Fire risk has gone up 4 days in a row and is expected to stay very high."
 * A run counts only from 3 days and 5 points, so a wobble of a point or two never reads as a rise.
 */
export function riskTrendSentence(p: PlaceReport): string {
  const tl = p.risk.timeline
  const t = todayIndex(tl)
  const upTo = tl.slice(0, t + 1), ahead = tl.slice(t + 1)
  const T = upTo[upTo.length - 1]
  if (!T) return 'There is no fire risk estimate for these days.'
  const todayIso = T.date
  let up = 0, down = 0
  for (let i = upTo.length - 1; i > 0 && upTo[i].score > upTo[i - 1].score; i--) up++
  for (let i = upTo.length - 1; i > 0 && upTo[i].score < upTo[i - 1].score; i--) down++
  const n = upTo.length
  let past: string
  let dir: 'up' | 'down' | 'flat'
  if (up >= 3 && T.score - upTo[n - 1 - up].score >= 5) { past = `Fire risk has gone up ${up} days in a row`; dir = 'up' }
  else if (down >= 3 && upTo[n - 1 - down].score - T.score >= 5) { past = `Fire risk has come down ${down} days in a row`; dir = 'down' }
  else if (n > 1 && upTo.every((d) => d.level === T.level)) { past = `Fire risk has been ${lower(T.level)} for the last ${n} days`; dir = 'flat' }
  else if (n > 1 && T.score - upTo[0].score >= 10) { past = `Fire risk has gone up since ${weekdayLong(upTo[0].date)}`; dir = 'up' }
  else if (n > 1 && upTo[0].score - T.score >= 10) { past = `Fire risk has come down since ${weekdayLong(upTo[0].date)}`; dir = 'down' }
  else if (n > 1) { past = `Fire risk has gone up and down, but is about where it was on ${weekdayLong(upTo[0].date)}`; dir = 'flat' }
  else { past = `Fire risk is ${lower(T.level)} today`; dir = 'flat' }

  if (!ahead.length) return `${past}.`
  const rankT = RANK[T.level]
  const top = ahead.reduce((a, b) => (RANK[b.level] > RANK[a.level] ? b : a))
  let next: string, nextDir: 'up' | 'down' | 'flat'
  if (RANK[top.level] > rankT) { next = `expected to reach ${lower(top.level)} ${onDay(top.date, todayIso)}`; nextDir = 'up' }
  else if (ahead.every((d) => d.level === T.level)) { next = `expected to stay ${lower(T.level)}`; nextDir = 'flat' }
  else if (ahead.every((d) => RANK[d.level] < rankT)) { next = 'expected to come down'; nextDir = 'down' }
  else { next = `expected to stay at or below ${lower(T.level)}`; nextDir = 'flat' }
  const turn = (dir === 'up' && nextDir === 'down') || (dir === 'down' && nextDir === 'up') || (dir === 'flat' && nextDir === 'up' && /^Fire risk has been/.test(past))
  return `${past}${turn ? ', but is' : ' and is'} ${next}.`
}

/** Daily highs: "Daytime highs have gone up from 26 °C on Friday to 31 °C today." Changes under 3 °C are "about the same". */
export function heatTrendSentence(days: TrendDay[]): string | null {
  const v = (d: TrendDay) => d.wx?.tMax
  const { upTo, ahead, today } = split(days, v)
  if (!upTo.length) return null
  const first = upTo[0], last = upTo[upTo.length - 1]
  const a = v(first)!, b = v(last)!
  let s: string
  if (upTo.length > 1 && b - a >= 3) s = `Daytime highs have gone up from ${degC(a)} ${onDay(first.date, today)} to ${degC(b)} ${whenWord(last.date, today)}`
  else if (upTo.length > 1 && a - b >= 3) s = `Daytime highs have gone down from ${degC(a)} ${onDay(first.date, today)} to ${degC(b)} ${whenWord(last.date, today)}`
  else s = upTo.length > 1 ? `Daytime highs have stayed about the same, around ${degC(avg(upTo.map((d) => v(d)!)))}` : `Today's high is ${degC(b)}`
  if (ahead.length) {
    const hot = ahead.reduce((x, y) => (v(y)! > v(x)! ? y : x)), cool = ahead.reduce((x, y) => (v(y)! < v(x)! ? y : x))
    if (v(hot)! - b >= 3) s += `, and ${degC(v(hot)!)} is expected ${onDay(hot.date, today)}`
    else if (b - v(cool)! >= 3) s += `, and cooler days are expected, down to ${degC(v(cool)!)} ${onDay(cool.date, today)}`
  }
  return `${s}.`
}

/** Lowest humidity: "The air has been getting drier: humidity is down from 40% on Friday to 23% today." Under 8 points is "about the same". */
export function humidityTrendSentence(days: TrendDay[]): string | null {
  const v = (d: TrendDay) => d.wx?.rhMin
  const { upTo, ahead, today } = split(days, v)
  if (!upTo.length) return null
  const first = upTo[0], last = upTo[upTo.length - 1]
  const a = v(first)!, b = v(last)!
  let s: string
  if (upTo.length > 1 && a - b >= 8) s = `The air has been getting drier: humidity is down from ${pct(a)} ${onDay(first.date, today)} to ${pct(b)} ${whenWord(last.date, today)}`
  else if (upTo.length > 1 && b - a >= 8) s = `The air has been getting damper: humidity is up from ${pct(a)} ${onDay(first.date, today)} to ${pct(b)} ${whenWord(last.date, today)}`
  else {
    const m = upTo.length > 1 ? avg(upTo.map((d) => v(d)!)) : b
    s = m <= 35 ? `The air has stayed dry, with humidity around ${pct(m)}` : m >= 60 ? `The air has stayed damp, with humidity around ${pct(m)}` : `Humidity has stayed about the same, around ${pct(m)}`
  }
  if (ahead.length) {
    const dry = ahead.reduce((x, y) => (v(y)! < v(x)! ? y : x)), damp = ahead.reduce((x, y) => (v(y)! > v(x)! ? y : x))
    if (b - v(dry)! >= 8) s += `, and drier air is expected ${onDay(dry.date, today)}, down to ${pct(v(dry)!)}`
    else if (v(damp)! - b >= 15) s += `, and damper air is expected ${onDay(damp.date, today)}`
  }
  return `${s}.`
}

/** Strongest wind, today and the days ahead: "Strong wind is expected on Thursday, up to 38 km/h." */
export function windTrendSentence(days: TrendDay[]): string | null {
  const v = (d: TrendDay) => d.wx?.windMax
  const { upTo, ahead, today } = split(days, v)
  const todays = upTo.length && upTo[upTo.length - 1].date === today ? [upTo[upTo.length - 1]] : []
  const win = [...todays, ...ahead]
  if (!win.length) return null
  const peak = win.reduce((x, y) => (v(y)! > v(x)! ? y : x))
  const w = v(peak)!
  if (w >= STRONG_WIND_KMH) return peak.date === today ? `Strong wind today, up to ${kmh(w)}.` : `Strong wind is expected ${onDay(peak.date, today)}, up to ${kmh(w)}.`
  return `No strong wind is expected, at most ${kmh(w)} ${whenWord(peak.date, today)}.`
}

/** Rain: "No rain in the last 5 days, and none is expected for the next 3 days." A rain day has 1 mm or more. */
export function rainTrendSentence(days: TrendDay[]): string | null {
  const v = (d: TrendDay) => d.wx?.precip
  const { upTo, ahead, today } = split(days, v)
  if (!upTo.length && !ahead.length) return null
  const wet = (d: TrendDay) => v(d)! >= RAIN_DAY_MM
  const n = upTo.length, k = upTo.filter(wet).length
  let s = ''
  let dry = false
  if (n) {
    if (k === 0) { s = upTo.some((d) => v(d)! >= 0.2) ? `Hardly any rain in the last ${n} days` : `No rain in the last ${n} days`; dry = true }
    else if (k === n) s = `Rain every day for the last ${n} days`
    else s = `Rain on ${k} of the last ${n} days`
  }
  if (!ahead.length) return s ? `${s}.` : null
  const wetAhead = ahead.filter(wet)
  let next: string
  if (!wetAhead.length) next = ahead.length === 1 ? 'none is expected tomorrow' : `none is expected ${aheadPhrase(ahead.length)}`
  else if (wetAhead.length === 1) next = `rain is expected ${onDay(wetAhead[0].date, today)}`
  else next = `rain is expected on ${wetAhead.length} of the next ${ahead.length} days`
  if (!s) return `${next[0].toUpperCase()}${next.slice(1)}.`
  return `${s}${dry && wetAhead.length ? ', but' : ', and'} ${next}.`
}

// ---------------------------------------------------------------------------------------------
// Nearest fire and smoke

const COMPASS: Record<Compass8, string> = { N: 'north', NE: 'north-east', E: 'east', SE: 'south-east', S: 'south', SW: 'south-west', W: 'west', NW: 'north-west' }
const STAGE: Record<string, string> = { OC: 'out of control', BH: 'being held: not expected to spread for now', UC: 'under control', EX: 'out' }

/** "Wildfire 13 km south-west, being held: not expected to spread for now." */
export function fireSentence(f: PlaceFire): string {
  const stage = STAGE[f.stage?.toUpperCase()]
  const where = f.distanceKm < 1 ? 'Wildfire less than 1 km away' : `Wildfire ${f.distanceKm} km ${COMPASS[f.bearing] ?? ''}`.trimEnd()
  return stage ? `${where}, ${stage}.` : `${where}.`
}

/** "About 166 square kilometres." */
export function fireSize(f: PlaceFire): string | null {
  if (f.hectares == null || Number.isNaN(f.hectares)) return null
  const km2 = f.hectares / 100
  if (km2 < 1) return 'Less than 1 square kilometre.'
  const n = km2 >= 10 ? Math.round(km2).toLocaleString('en-CA') : (Math.round(km2 * 10) / 10).toLocaleString('en-CA')
  return `About ${n} square kilometre${n === '1' ? '' : 's'}.`
}

export function fireCounts(f: NonNullable<PlaceReport['fires']>): string {
  if (!f.within50km && !f.within100km) return 'No wildfires reported within 100 km.'
  return `${f.within50km} wildfire${f.within50km === 1 ? '' : 's'} reported within 50 km, and ${f.within100km} within 100 km.`
}

export function heatCounts(h: NonNullable<PlaceReport['hotspots24h']>): string {
  if (!h.within50km && !h.within100km) return 'No heat spotted by satellites within 100 km in the last day.'
  return `Heat spotted by satellites ${h.within50km} time${h.within50km === 1 ? '' : 's'} within 50 km, and ${h.within100km} within 100 km, in the last day.`
}

export type SmokeLevel = SmokeWord

/** Smoke in words from the US AQI (or PM2.5 when the AQI is missing), on the one shared scale (shared/aqi.ts smokePlain). */
export function smokeLevel(usAqi: number | null | undefined, pm25?: number | null): SmokeLevel | null {
  return smokePlain(usAqi ?? aqiFromPm25(pm25))?.word ?? null
}

export function smokeWords(p: PlaceReport): { line: string; advice: string; number: string | null; ahead: string | null } | null {
  if (!p.air) return null
  const now = p.air.now
  const lvl = smokeLevel(now.usAqi, now.pm25)
  if (!lvl) return null
  // One number on the main screen, with the scale in words; no µg/m³ here (docs/design/review-wave3.md #10).
  const aqi = now.usAqi ?? aqiFromPm25(now.pm25)
  const number = aqi != null && !Number.isNaN(aqi) ? smokeReading(aqi) : null
  let ahead: string | null = null
  const m = p.air.max3d
  const lvl3 = smokeLevel(m.usAqi, m.pm25)
  if (lvl3 && m.date && SMOKE_RANK[lvl3] > SMOKE_RANK[lvl]) ahead = `Expected to be ${lvl3} ${onDay(m.date, todayOf(p))}.`
  return { line: `Smoke in the air: ${lvl} today.`, advice: SMOKE_RANK[lvl] >= SMOKE_RANK.heavy ? `${smokePlain(aqi)!.healthLine} ${SMOKE_MEDICAL}` : smokePlain(aqi)!.healthLine, number, ahead }
}

/** The level the "What you can do now" list follows: today's, or the highest expected in the look-ahead when that is higher. */
export function guidanceLevel(p: PlaceReport): { level: RiskLevel; fromDate: string | null } {
  const L = todayLevel(p)
  const peak = p.outlook.peakLevel
  // The first day at the peak level, so this agrees with the status sentence ('very high from tomorrow').
  if (RANK[peak] > RANK[L]) return { level: peak, fromDate: p.risk.timeline.find((d) => d.kind === 'forecast' && d.level === peak)?.date ?? p.outlook.peakDate }
  return { level: L, fromDate: null }
}
