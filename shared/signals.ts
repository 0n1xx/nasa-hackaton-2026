// Early warning signs: plain-language checks on the same weather, fire and smoke
// data the risk index uses, so a person can see WHICH conditions are lining up
// and since when.
//
// Every threshold below is a team assumption chosen for readability, in the same
// spirit as shared/risk.ts. None has been validated against fire records. A sign
// being active means "worth watching", not "a fire will start".

import type { DayWeather, RegionAir, RegionRisk } from './types.ts'

export type SignKey = 'heat' | 'humidity' | 'dry' | 'wind' | 'fire' | 'smoke' | 'outlook'

export interface WarningSign {
  key: SignKey
  /** Short name, e.g. "Heat building" */
  label: string
  active: boolean
  /** The headline figure, e.g. "+10.3 °C in 7 days" */
  value: string
  /** One sentence on what the data shows */
  detail: string
  /** When the sign counts as active, in plain words */
  rule: string
  /** First day (YYYY-MM-DD) of the unbroken run of days ending today on which the sign held. null for signs that are not day-by-day */
  since: string | null
}

export const SIGNS_NOTE = 'Warning-sign thresholds are team assumptions for this prototype. They have not been validated against fire records.'

/** Rain below this (mm in a day) does not wet forest fuels. 0.1 inch, the common "wetting rain" cut-off. */
export const WETTING_RAIN_MM = 2.5

const r1 = (v: number) => Math.round(v * 10) / 10
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)
const dayName = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('en-CA', { weekday: 'long' })

/** First date of the unbroken run of days, ending at the last element, for which test() holds. */
function runStart(days: DayWeather[], test: (d: DayWeather) => boolean): string | null {
  let start: string | null = null
  for (let i = days.length - 1; i >= 0; i--) {
    if (!test(days[i])) break
    start = days[i].date
  }
  return start
}

function runLength(days: DayWeather[], test: (d: DayWeather) => boolean): number {
  let n = 0
  for (let i = days.length - 1; i >= 0 && test(days[i]); i--) n++
  return n
}

/** Compute the warning signs for a region. Pass air to include the smoke sign. */
export function warningSigns(risk: RegionRisk, air?: RegionAir | null): WarningSign[] {
  const past = risk.days.filter((d) => d.kind === 'historical')
  const ahead = risk.days.filter((d) => d.kind === 'forecast')
  const today = past.at(-1)
  const first = past[0]
  const signs: WarningSign[] = []

  // 1. Heat building: today's maximum against the first day in the window (about a week ago).
  {
    const rule = 'Active when the daily maximum is 5 °C or more above where it was a week ago.'
    if (today?.tMax != null && first?.tMax != null) {
      const rise = today.tMax - first.tMax
      const active = rise >= 5
      signs.push({ key: 'heat', label: 'Heat building', active, value: `${rise >= 0 ? '+' : '−'}${Math.abs(r1(rise))} °C in ${past.length - 1} days`,
        detail: `The daily high went from ${r1(first.tMax)} °C to ${r1(today.tMax)} °C.`, rule,
        since: active ? runStart(past, (d) => d.tMax != null && d.tMax - first.tMax! >= 5) : null })
    }
  }

  // 2. Air drying out: minimum relative humidity.
  {
    const rule = 'Active when the day’s lowest humidity is 35% or below. Dry air dries fine fuels within hours.'
    if (today?.rhMin != null) {
      const active = today.rhMin <= 35
      signs.push({ key: 'humidity', label: 'Air drying out', active, value: `${Math.round(today.rhMin)}% humidity`,
        detail: first?.rhMin != null ? `Lowest humidity fell from ${Math.round(first.rhMin)}% to ${Math.round(today.rhMin)}% over the week.` : `Lowest humidity today is ${Math.round(today.rhMin)}%.`, rule,
        since: active ? runStart(past, (d) => d.rhMin != null && d.rhMin <= 35) : null })
    }
  }

  // 3. No wetting rain.
  {
    const rule = `Active after 3 or more days in a row without wetting rain (${WETTING_RAIN_MM} mm or more in a day).`
    if (past.length && past.every((d) => d.precip != null)) {
      const dry = (d: DayWeather) => (d.precip ?? 0) < WETTING_RAIN_MM
      const n = runLength(past, dry)
      const active = n >= 3
      const all = n === past.length
      signs.push({ key: 'dry', label: 'No soaking rain', active, value: all ? `${n}+ days dry` : `${n} day${n === 1 ? '' : 's'} dry`,
        detail: n === 0 ? 'There was wetting rain today.' : all ? `No wetting rain in any of the last ${n} days.` : `The last wetting rain was ${n} day${n === 1 ? '' : 's'} ago.`, rule,
        since: active ? runStart(past, dry) : null })
    }
  }

  // 4. Wind in the next three days (wind drives spread).
  {
    const rule = 'Active when the daily maximum wind reaches 30 km/h today or in the next 3 days.'
    const window = [today, ...ahead].filter((d): d is DayWeather => !!d && d.windMax != null)
    if (window.length) {
      const peak = window.reduce((a, b) => (b.windMax! > a.windMax! ? b : a))
      const active = peak.windMax! >= 30
      signs.push({ key: 'wind', label: 'Strong wind ahead', active, value: `${Math.round(peak.windMax!)} km/h`,
        detail: peak === today ? `Wind reaches ${Math.round(peak.windMax!)} km/h today.` : `Wind peaks at ${Math.round(peak.windMax!)} km/h on ${dayName(peak.date)}.`, rule, since: null })
    }
  }

  // 5. Fire already on the landscape.
  {
    const n = risk.hotspots100km
    signs.push({ key: 'fire', label: 'Fire detected nearby', active: n > 0, value: `${n} detection${n === 1 ? '' : 's'}`,
      detail: n > 0 ? `Satellites picked up ${n} heat signature${n === 1 ? '' : 's'} within 100 km in the last 24 hours.` : 'No satellite fire detections within 100 km in the last 24 hours.',
      rule: 'Active when satellites detect any heat signature within 100 km in the last 24 hours.', since: null })
  }

  // 6. Smoke thickening (only when air quality data is supplied).
  if (air) {
    const model = air.hourly.filter((h) => h.kind === 'model').map((h) => h.pm25).filter((v): v is number => v != null)
    const last = mean(model.slice(-24)), prev = mean(model.slice(-48, -24))
    if (last != null && prev != null) {
      const change = prev > 0 ? (last - prev) / prev : 0
      const active = last >= 15 && change >= 0.2
      signs.push({ key: 'smoke', label: 'Smoke thickening', active, value: `${change >= 0 ? '+' : '−'}${Math.abs(Math.round(change * 100))}% PM2.5`,
        detail: `Fine particles averaged ${r1(last)} µg/m³ over the last 24 hours, against ${r1(prev)} the day before.`,
        rule: 'Active when 24-hour PM2.5 is at least 15 µg/m³ and 20% or more above the previous 24 hours.', since: null })
    }
  }

  // 7. The risk index outlook.
  {
    const todayScore = risk.today.score
    const fc = risk.timeline.filter((t) => t.kind === 'forecast')
    if (fc.length) {
      // The first forecast day at Critical if there is one, otherwise the highest forecast day.
      const peak = fc.find((t) => t.score >= 75) ?? fc.reduce((a, b) => (b.score > a.score ? b : a))
      const rise = peak.score - todayScore
      const active = peak.score >= 75 || rise >= 10
      signs.push({ key: 'outlook', label: peak.score >= 75 ? 'Critical in the forecast' : 'Risk rising', active, value: `${peak.level} by ${dayName(peak.date)}`,
        detail: `The index is ${todayScore} today and forecast to reach ${peak.score} (${peak.level}) on ${dayName(peak.date)}.`,
        rule: 'Active when the 72-hour forecast reaches Critical (75+) or climbs 10 points or more above today.', since: null })
    }
  }

  return signs
}

/** How many days the slow-building signs (heat, humidity, dry) have been lining up.
 *  0 unless at least two of them are active together: a dry week of cold November air alone is not "building". */
export function daysBuilding(signs: WarningSign[], todayIso: string): number {
  const starts = signs.filter((s) => s.active && s.since).map((s) => s.since!)
  if (starts.length < 2) return 0
  const earliest = starts.sort()[0]
  return Math.round((Date.parse(`${todayIso}T12:00:00`) - Date.parse(`${earliest}T12:00:00`)) / 86400000) + 1
}
