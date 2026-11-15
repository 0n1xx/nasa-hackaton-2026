// Every sentence the community view says, built from one PlaceReport. Pure functions, no React,
// so the wording can be checked from the command line against a saved /api/place response.
// Voice: docs/plans/2026-11-14-community-hub.md (plain, warm, "expected", never "forecast" or "predicted").

import type { Compass8, PlaceFire, PlaceReport, RiskDay, RiskLevel } from '../../../shared/types.ts'
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
const daysBetween = (a: string, b: string) => Math.round((at(b).getTime() - at(a).getTime()) / 86400000)

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

/** "Very high (75 out of 100)": the number is secondary, after the word. */
export const scoreLine = (p: PlaceReport) => `${levelLabel(todayLevel(p))} (${p.risk.today.score} out of 100)`

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

/** "Today's high is hotter than 96 of every 100 mid-July days since 1984 (NASA records)." Null unless the record is in. */
export function historySentence(p: PlaceReport): string | null {
  const h = p.history
  if (p.historyStatus !== 'ok' || !h || h.tMaxPercentile == null) return null
  const n = Math.round(h.tMaxPercentile)
  const w = h.window
  let days: string
  if (/^mid-/i.test(w.label)) days = `${w.label} days`
  else {
    const m = (mmdd: string) => at(`2001-${mmdd.slice(0, 2)}-${mmdd.slice(2, 4)}`).toLocaleDateString('en-CA', { month: 'long' })
    const d = (mmdd: string) => Number(mmdd.slice(2, 4))
    days = m(w.startMMDD) === m(w.endMMDD) ? `days from ${d(w.startMMDD)} to ${d(w.endMMDD)} ${m(w.endMMDD)}` : `days from ${d(w.startMMDD)} ${m(w.startMMDD)} to ${d(w.endMMDD)} ${m(w.endMMDD)}`
  }
  const since = `since ${h.period.startYear} (NASA records)`
  if (n >= 100) return `Today's high is hotter than any of the ${days} ${since}.`
  return n >= 50 ? `Today's high is hotter than ${n} of every 100 ${days} ${since}.` : `Today's high is cooler than ${100 - n} of every 100 ${days} ${since}.`
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
