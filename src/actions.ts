import type { RegionRisk, RiskDay, RiskLevel } from '../shared/types.ts'
import { daysBuilding, type WarningSign } from '../shared/signals.ts'

// Preparedness guidance keyed to the risk level. General-purpose prompts for
// discussion, to be adapted by each community and agency — not instructions.
// Agency items are written as things to do BEFORE ignition: the point of early
// warning is to have people and equipment in place while there is still time.
// Strings must stay unique within each list (they are used as React keys).
export const ACTIONS: Record<RiskLevel, { community: string[]; agency: string[] }> = {
  Low: {
    community: ['Review and update the community emergency plan while conditions are calm.', 'Test communication channels: radio, phone trees, social media, door-to-door lists.', 'Plan fuel reduction and cultural or prescribed burning with knowledge keepers and fire crews.'],
    agency: ['Fund and schedule fuel management and Indigenous-led fire stewardship work.', 'Service pumps, hose, sprinkler kits and air quality sensors, and record where each is stored.', 'Agree pre-positioning and host-community arrangements with First Nations before the season starts.'],
  },
  Moderate: {
    community: ['Check conditions daily; note wind direction and new detections nearby.', 'Confirm who needs extra support: Elders, infants, people with heart or lung conditions.', 'Check clean-air spaces, filters and pump and hose equipment.'],
    agency: ['Check this region every day: weather, new satellite detections and smoke.', 'Confirm which crews, aircraft, pumps and sprinkler kits could reach the region within 24 hours, and share that with community leadership.', 'Open a direct line with community emergency coordinators.'],
  },
  High: {
    community: ['Hold a meeting with leadership and your local fire crew to check you are ready.', 'Set up community structure protection where equipment exists (sprinklers, cleared perimeters).', 'Open clean-air shelters if smoke is rising; share air quality updates in the community’s languages.', 'Decide, as a community, the conditions under which vulnerable members would leave first.'],
    agency: ['Pre-position initial-attack crews, pumps, hose and sprinkler kits near the region’s communities before ignitions occur.', 'Put aircraft on standby within reach of the region and confirm fuel and water for them.', 'Deliver air purifiers, N95 masks and generator fuel to communities ahead of the smoke.', 'Brief community leadership daily and act on local observations.'],
  },
  Critical: {
    community: ['Activate the community emergency plan at the level leadership chooses.', 'Keep one trusted, frequent information channel running; counter rumours quickly.', 'Protect people most affected by smoke first: clean-air rooms, masks, medical support.', 'Share what people see on the land with fire crews; local knowledge guides where equipment goes.'],
    agency: ['Move crews, pumps, hose and sprinkler kits into the region’s communities now, before ignitions occur, as community leadership agrees.', 'Hold aircraft and initial-attack crews on standby for this region, with fuel and water staged nearby.', 'Set up structure protection where community leadership asks for it, including cultural sites they choose to share.', 'Deliver air purifiers, N95 masks and generator fuel to clean-air shelters now.', 'Treat requests from community leadership as priority tasking and reply with clear timelines.'],
  },
}

/** One line on what the guidance at each level is for. */
export const FOCUS: Record<RiskLevel, string> = {
  Low: 'Conditions are calm: a time for preparation.',
  Moderate: 'Watch closely and confirm what could be moved, and how fast.',
  High: 'Move resources into position before ignitions occur.',
  Critical: 'Resources should be in place now, before ignitions occur.',
}

export const DISCLAIMER = 'The risk index is an unvalidated prototype. Use official fire danger ratings and local knowledge for real decisions.'

// ---------------------------------------------------------------------------
// Plain-language summary shared by the Early warning page and the Situation brief,
// so both say exactly the same thing. Generated from data, never written by hand.

export const LEVEL_RANK: Record<RiskLevel, number> = { Low: 0, Moderate: 1, High: 2, Critical: 3 }

/** Weekday name for a YYYY-MM-DD date, read the same way as the warning signs read it. */
export const weekday = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('en-CA', { weekday: 'long' })

/** "tomorrow" for the day after todayIso, otherwise the weekday name. Relative wording stays right
 *  even when the data's calendar day differs from the viewer's (the simulated scenario dates in UTC). */
export function dayLabel(iso: string, todayIso: string | undefined) {
  if (todayIso && Math.round((Date.parse(`${iso}T12:00:00`) - Date.parse(`${todayIso}T12:00:00`)) / 86400000) === 1) return 'tomorrow'
  return weekday(iso)
}

export interface Summary {
  /** "forecast Critical from tomorrow (81)", or null with no forecast days */
  forecast: string | null
  /** "Risk is High today (67) and forecast Critical from tomorrow (81)." */
  risk: string
  /** "6 of 7 warning signs are active." */
  signs: string
  /** risk + signs */
  bottomLine: string
  /** "Conditions have been building for 6 days.", or null when nothing slow-building is active */
  building: string | null
  activeSigns: number
  /** Forecast days only */
  ahead: RiskDay[]
  /** The level the guidance should follow: the higher of today's level and the forecast peak */
  guidance: RiskLevel
  /** First forecast day at the guidance level, when the guidance comes from the forecast rather than today */
  guidanceDay: RiskDay | null
  /** The data's own "today" (YYYY-MM-DD), for dayLabel() */
  todayIso: string | undefined
}

export function summarize(r: RegionRisk, signs: WarningSign[]): Summary {
  const today = r.today
  const ahead = r.timeline.filter((t) => t.kind === 'forecast')
  const todayIso = r.timeline.find((t) => t.kind === 'today')?.date ?? r.days.filter((d) => d.kind === 'historical').at(-1)?.date
  const day = (iso: string) => dayLabel(iso, todayIso)
  let forecast: string | null = null
  let guidance: RiskLevel = today.level
  let guidanceDay: RiskDay | null = null

  if (ahead.length) {
    const peak = ahead.reduce((a, b) => (LEVEL_RANK[b.level] > LEVEL_RANK[a.level] ? b : a)).level
    const last = ahead[ahead.length - 1]
    if (LEVEL_RANK[peak] > LEVEL_RANK[today.level]) {
      const i = ahead.findIndex((d) => d.level === peak)
      const first = ahead[i], when = day(first.date)
      const holds = ahead.slice(i).every((d) => d.level === peak)
      forecast = holds ? `forecast ${peak} from ${when} (${first.score})` : `forecast to reach ${peak} ${when === 'tomorrow' ? when : `on ${when}`} (${first.score})`
      guidance = peak
      guidanceDay = first
    } else if (ahead.every((d) => d.level === today.level)) {
      forecast = `forecast to stay ${today.level} through ${day(last.date)}`
    } else if (LEVEL_RANK[last.level] < LEVEL_RANK[today.level]) {
      forecast = `forecast to ease to ${last.level} by ${day(last.date)}`
    } else {
      forecast = `forecast to stay at or below ${today.level} through ${day(last.date)}`
    }
  }

  const activeSigns = signs.filter((s) => s.active).length
  const signsLine = !signs.length ? '' : activeSigns === 0 ? 'No warning signs are active.'
    : `${activeSigns} of ${signs.length} warning signs ${activeSigns === 1 ? 'is' : 'are'} active.`

  const n = todayIso ? daysBuilding(signs, todayIso) : 0
  const building = n >= 2 ? `Conditions have been building for ${n} days.` : n === 1 ? 'Conditions started lining up today.' : null

  const risk = `Risk is ${today.level} today (${today.score})${forecast ? ` and ${forecast}` : ''}.`
  return { forecast, risk, signs: signsLine, bottomLine: signsLine ? `${risk} ${signsLine}` : risk, building, activeSigns, ahead, guidance, guidanceDay, todayIso }
}
