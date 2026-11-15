// Where the fire risk goes over the look-ahead, in words. ONE rule for the community page's status
// sentence (src/components/community/words.ts), the request letter (shared/letter.ts) and the assistant
// (shared/assistant.ts), so all three say the same thing about the same days. Pure, no locale, no clock.
// Voice: docs/plans/2026-11-14-community-hub.md ("expected", never "forecast" or "predicted").

import type { RiskDay, RiskLevel } from './types.ts'
import { levelLabel } from './risk.ts'

const RANK: Record<RiskLevel, number> = { Low: 0, Moderate: 1, High: 2, Critical: 3 }
const lower = (l: RiskLevel) => levelLabel(l).toLowerCase()

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const utc = (iso: string) => { const [y, m, d] = iso.slice(0, 10).split('-').map(Number); return Date.UTC(y, m - 1, d) }

/** "Thursday" for a YYYY-MM-DD local day. */
export const weekdayOf = (iso: string) => WEEKDAYS[new Date(utc(iso)).getUTCDay()]
/** "Thursday 16 July" for a YYYY-MM-DD local day. */
export const weekdayDate = (iso: string) => `${weekdayOf(iso)} ${Number(iso.slice(8, 10))} ${MONTHS[Number(iso.slice(5, 7)) - 1]}`
export const daysBetween = (a: string, b: string) => Math.round((utc(b) - utc(a)) / 86400000)

/** "today", "tomorrow", "Tuesday", or "Monday 27 July" a week or more out (a bare weekday would be ambiguous). */
export function dayWord(iso: string, todayIso: string): string {
  const n = daysBetween(todayIso, iso)
  if (n === 0) return 'today'
  if (n === 1) return 'tomorrow'
  return n >= 7 ? weekdayDate(iso) : weekdayOf(iso)
}

/** "today", "tomorrow", "on Tuesday", "on Monday 27 July". */
export function onDayWord(iso: string, todayIso: string): string {
  const w = dayWord(iso, todayIso)
  return w === 'today' || w === 'tomorrow' ? w : `on ${w}`
}

/** "for the next 3 days", "tomorrow", "for the next week". */
export function aheadPhrase(horizon: number): string {
  if (horizon === 1) return 'tomorrow'
  if (horizon === 7) return 'for the next week'
  if (horizon === 14) return 'for the next 2 weeks'
  return `for the next ${horizon} days`
}

/** How a surface names a day: the page and the assistant say "tomorrow" / "Thursday"; the letter always writes the full date. */
export interface DayStyle {
  /** after "from" and "by": "tomorrow", "Thursday", "Thursday 16 July" */
  day: (iso: string) => string
  /** "tomorrow", "on Thursday", "on Thursday 16 July" */
  on: (iso: string) => string
}
export const relativeDays = (todayIso: string): DayStyle => ({ day: (d) => dayWord(d, todayIso), on: (d) => onDayWord(d, todayIso) })
export const fullDates: DayStyle = { day: weekdayDate, on: (d) => `on ${weekdayDate(d)}` }

export interface OutlookInput {
  todayLevel: RiskLevel
  /** The look-ahead days only (kind 'forecast'), in order. */
  ahead: RiskDay[]
  /** shared/outlook.ts riskOutlook: the first forecast day above today's level, or null. */
  firstHigherLevelDate: string | null
  horizon: number
}

/**
 * The outlook phrase, starting at "expected …" with no full stop, or null when there are no look-ahead days:
 * - rises and holds: "expected to be very high from Thursday" (+ " and … on …" when it climbs again later)
 * - rises but drops back: "expected to reach very high on Thursday"
 * - steady: "expected to stay high for the next 3 days"
 * - eases: "expected to ease to medium by Friday"
 * - otherwise: "expected to stay at or below high for the next 3 days"
 */
export function outlookPhrase(o: OutlookInput, style: DayStyle): { text: string; steady: boolean } | null {
  const { ahead, todayLevel: L } = o
  if (!ahead.length) return null
  const hi = o.firstHigherLevelDate ? ahead.findIndex((d) => d.date === o.firstHigherLevelDate) : -1
  if (hi >= 0) {
    // The level of the first higher day, not the peak: they can differ ("high from Sunday and very high on Tuesday").
    const h = ahead[hi]
    const rest = ahead.slice(hi)
    const holds = rest.every((d) => RANK[d.level] >= RANK[h.level])
    let s = holds ? `expected to be ${lower(h.level)} from ${style.day(h.date)}` : `expected to reach ${lower(h.level)} ${style.on(h.date)}`
    const peak = rest.reduce((a, b) => (RANK[b.level] > RANK[a.level] ? b : a))
    if (RANK[peak.level] > RANK[h.level]) s += ` and ${lower(peak.level)} ${style.on(peak.date)}`
    return { text: s, steady: false }
  }
  if (ahead.every((d) => d.level === L)) return { text: `expected to stay ${lower(L)} ${aheadPhrase(o.horizon)}`, steady: true }
  const last = ahead[ahead.length - 1]
  if (RANK[last.level] < RANK[L]) {
    // From the first day after which it stays at or below the last day's level.
    let j = ahead.length - 1
    while (j > 0 && RANK[ahead[j - 1].level] <= RANK[last.level]) j--
    return { text: `expected to ease to ${lower(last.level)} by ${style.day(ahead[j].date)}`, steady: false }
  }
  return { text: `expected to stay at or below ${lower(L)} ${aheadPhrase(o.horizon)}`, steady: false }
}
