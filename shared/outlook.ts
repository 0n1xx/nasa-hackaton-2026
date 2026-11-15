// Risk outlook for one place: how high the risk gets over the look-ahead, and by when to act.
// Pure: reads only the RiskDay timeline (past days, today, forecast) from the server.

import type { RiskDay, RiskLevel, RiskOutlook } from './types.ts'

const RANK: Record<RiskLevel, number> = { Low: 0, Moderate: 1, High: 2, Critical: 3 }

/**
 * Today is the 'today' entry (or, failing that, the last non-forecast one). Past days are ignored.
 * - peak: the highest score from today to the end of the timeline; the earliest day wins a tie.
 * - firstHigherLevelDate: the first forecast day whose level is above today's level.
 * - actByDate: the timeline entry just before that day (dates are local-day strings, so no calendar maths);
 *   that is today when the higher level is expected tomorrow.
 * Returns null for an empty timeline.
 */
export function riskOutlook(timeline: RiskDay[]): RiskOutlook | null {
  if (!timeline.length) return null
  let ti = timeline.findIndex((d) => d.kind === 'today')
  if (ti < 0) for (let i = timeline.length - 1; i >= 0 && ti < 0; i--) if (timeline[i].kind !== 'forecast') ti = i
  const today = ti >= 0 ? timeline[ti] : null
  const from = Math.max(0, ti)

  let peak = timeline[from]
  for (let i = from + 1; i < timeline.length; i++) if (timeline[i].score > peak.score) peak = timeline[i]

  let higher = -1
  if (today) {
    for (let i = ti + 1; i < timeline.length; i++) {
      if (RANK[timeline[i].level] > RANK[today.level]) { higher = i; break }
    }
  }

  return {
    todayDate: today?.date ?? null,
    todayLevel: today?.level ?? null,
    peakLevel: peak.level, peakScore: peak.score, peakDate: peak.date,
    firstHigherLevelDate: higher > 0 ? timeline[higher].date : null,
    actByDate: higher > 0 ? timeline[higher - 1].date : null,
  }
}
